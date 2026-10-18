import { randomUUID, randomBytes, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { Store } from "./store.mjs";
import { World, definitions, toolCatalogue, fail } from "./schema.mjs";
import { sha, ingest, search } from "./canon.mjs";
import { advance } from "./world.mjs";
const clone = (v) => structuredClone(v),
  stamp = () => new Date().toISOString();
const reserved = (k) =>
  k
    .split(".")
    .some((p) => ["__proto__", "prototype", "constructor"].includes(p));
const GUIDE = readFileSync(
  new URL("../skills/operating-branchwright/SKILL.md", import.meta.url),
  "utf8",
);
const manuals = {
  overview: GUIDE,
  workflows: readFileSync(
    new URL("../docs/workflows.md", import.meta.url),
    "utf8",
  ),
  packs: readFileSync(
    new URL("../docs/world-packs.md", import.meta.url),
    "utf8",
  ),
};
export class Engine {
  constructor(filename, options = {}) {
    this.store = new Store(filename);
    this.randomInt = options.randomInt ?? (() => randomInt(1, 21));
  }
  close() {
    this.store.close();
  }
  call(name, args = {}) {
    const d = definitions[name];
    if (!d)
      fail(
        "UNKNOWN_TOOL",
        "Read the live tool guide before calling an unknown tool.",
      );
    if (Buffer.byteLength(JSON.stringify(args)) > 262144)
      fail(
        "INPUT_TOO_LARGE",
        "Keep one call below 256 KiB. Split canon ingestion into smaller calls.",
      );
    const parsed = d.schema.parse(args);
    const execute = () => this[name](parsed);
    return d.annotations.readOnlyHint
      ? execute()
      : this.store.transaction(execute);
  }
  campaign(id) {
    const row = this.store.get("SELECT * FROM campaigns WHERE id=?", id);
    if (!row)
      fail("CAMPAIGN_NOT_FOUND", "Campaign does not exist in this database.");
    return { ...row, world: JSON.parse(row.world) };
  }
  branch(a) {
    this.campaign(a.campaign_id);
    const row = this.store.get(
      "SELECT * FROM branches WHERE campaign=? AND id=?",
      a.campaign_id,
      a.branch_id,
    );
    if (!row)
      fail("BRANCH_NOT_FOUND", "Use list_branches and an explicit branch ID.");
    return { ...row, state: JSON.parse(row.state) };
  }
  policy(world) {
    return sha({ guide: GUIDE, rules: world.rules, pack: sha(world) });
  }
  publicState(s) {
    return {
      player: clone(s.player),
      location: s.location,
      clock: s.clock,
      resources: clone(s.resources),
      inventory: clone(s.inventory),
      goals: clone(s.goals),
      status: s.status,
    };
  }
  snapshot(a, revision, s) {
    const markdown = [
      "```text",
      `[Save] ${a.campaign_id}/${a.branch_id} · revision ${revision}`,
      `[Scene] ${s.location} · elapsed ${s.clock} minutes`,
      ...Object.entries(s.player.vitals).map(
        ([k, v]) => `[${k}] ${v.current}/${v.max}`,
      ),
      `[Resources] ${JSON.stringify(s.resources)}`,
      `[Inventory] ${JSON.stringify(s.inventory)}`,
      `[Goals] ${s.goals.join("; ")}`,
      "```",
    ].join("\n");
    return { branch_id: a.branch_id, revision, state_sha256: sha(s), markdown };
  }
  read_guide(a) {
    if (a.section === "tools") {
      const tools = toolCatalogue();
      if (a.tool_name) {
        const tool = tools.find((t) => t.name === a.tool_name);
        if (!tool)
          fail("UNKNOWN_TOOL", "Tool not found. Read the tools index.");
        return { tool };
      }
      return { tools };
    }
    if (a.tool_name)
      fail("INVALID_ARGUMENT", "tool_name is only used with section=tools.");
    return {
      section: a.section,
      text: manuals[a.section],
      guide_sha256: sha(GUIDE),
    };
  }
  create_campaign(a) {
    if (a.world && a.template)
      fail("INVALID_ARGUMENT", "Choose world or template, not both.");
    const signature = sha(a),
      old = this.store.get(
        "SELECT * FROM campaigns WHERE request_key=?",
        a.idempotency_key,
      );
    if (old) {
      if (old.request_hash !== signature)
        fail(
          "KEY_CONFLICT",
          "Creation key already belongs to a different request.",
        );
      return { campaign_id: old.id, branch_id: "main", created: false };
    }
    const template = a.template ?? "lantern",
      world = World.parse(
        a.world ??
          JSON.parse(
            readFileSync(
              new URL(`../examples/${template}.json`, import.meta.url),
              "utf8",
            ),
          ),
      );
    if (
      Object.keys(world.actors).some(
        (k) => ["player", "gm"].includes(k) || reserved(k),
      ) ||
      world.events.length !== new Set(world.events.map((e) => e.id)).size
    )
      fail(
        "INVALID_PACK",
        "Actor IDs are reserved or event IDs are duplicated.",
      );
    const state = {
      player: clone(world.player),
      location: world.initial.location,
      clock: 0,
      resources: clone(world.initial.resources),
      inventory: clone(world.initial.inventory),
      goals: clone(world.initial.goals),
      status: "",
      actors: Object.fromEntries(
        Object.entries(world.actors).map(([k, v]) => [
          k,
          { location: v.location },
        ]),
      ),
      facts: {},
      knowledge: Object.fromEntries(
        ["player", ...Object.keys(world.actors)].map((k) => [k, {}]),
      ),
      world: { cooldowns: {}, recent: [] },
    };
    const id = randomUUID(),
      serialized = JSON.stringify(state);
    this.store.run(
      "INSERT INTO campaigns VALUES(?,?,?,?,?,?,?)",
      id,
      a.name,
      JSON.stringify(world),
      randomBytes(32).toString("hex"),
      stamp(),
      a.idempotency_key,
      signature,
    );
    this.store.run(
      "INSERT INTO branches VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      id,
      "main",
      "Main",
      "Original timeline",
      null,
      null,
      0,
      serialized,
      serialized,
      "initial",
      signature,
    );
    ingest(this.store, id, world.canon);
    return {
      campaign_id: id,
      branch_id: "main",
      revision: 0,
      created: true,
      snapshot: this.snapshot({ campaign_id: id, branch_id: "main" }, 0, state),
    };
  }
  list_campaigns() {
    return {
      campaigns: this.store.all(
        "SELECT id,name,created FROM campaigns ORDER BY created,id",
      ),
    };
  }
  ingest_canon(a) {
    this.campaign(a.campaign_id);
    return ingest(this.store, a.campaign_id, a.documents);
  }
  search_canon(a) {
    this.campaign(a.campaign_id);
    return search(this.store, a.campaign_id, a.query, a.limit);
  }
  read_canon(a) {
    this.campaign(a.campaign_id);
    const row = this.store.get(
      "SELECT id,source,title,text,citation FROM chunks WHERE campaign=? AND id=?",
      a.campaign_id,
      a.chunk_id,
    );
    if (!row) fail("SOURCE_NOT_FOUND", "No such chunk in this campaign.");
    return row;
  }
  get_state(a) {
    const b = this.branch(a);
    return {
      campaign_id: a.campaign_id,
      branch_id: a.branch_id,
      revision: b.revision,
      state: a.viewer === "gm" ? b.state : this.publicState(b.state),
      state_sha256: sha(b.state),
    };
  }
  get_knowledge(a) {
    const s = this.branch(a).state;
    if (a.viewer === "gm")
      return {
        viewer: "gm",
        facts: clone(s.facts),
        qualification: "World truth is not shared character knowledge.",
      };
    if (!Object.hasOwn(s.knowledge, a.viewer))
      fail("ACTOR_NOT_FOUND", "No recorded knowledge for this actor.");
    return {
      viewer: a.viewer,
      facts: clone(s.knowledge[a.viewer]),
      qualification:
        "Last observed values, not live pointers to current secrets.",
    };
  }
  checkContext(a, b = this.branch(a)) {
    const checks = this.store
      .all(
        "SELECT result FROM checks WHERE campaign=? AND branch=? AND revision=? ORDER BY purpose",
        a.campaign_id,
        a.branch_id,
        b.revision,
      )
      .map((r) => JSON.parse(r.result));
    return {
      adjudication_checks: checks,
      check_context_sha256: sha({
        campaign: a.campaign_id,
        branch: a.branch_id,
        revision: b.revision,
        state: sha(b.state),
        checks,
        policy: this.policy(this.campaign(a.campaign_id).world),
      }),
    };
  }
  prepare_turn(a) {
    const b = this.branch(a),
      world = this.campaign(a.campaign_id).world,
      policy = this.policy(world),
      id = sha([
        a.campaign_id,
        a.branch_id,
        b.revision,
        a.player_action,
        sha(b.state),
        policy,
      ]);
    this.store.run(
      "INSERT OR IGNORE INTO preparations VALUES(?,?,?,?,?,?,?,?)",
      id,
      a.campaign_id,
      a.branch_id,
      b.revision,
      a.player_action,
      sha(b.state),
      policy,
      stamp(),
    );
    return {
      campaign_id: a.campaign_id,
      branch_id: a.branch_id,
      revision: b.revision,
      preparation_id: id,
      player_action: a.player_action,
      policy_sha256: policy,
      guide: a.known_policy_sha256 === policy ? null : GUIDE,
      state: this.publicState(b.state),
      gm: {
        actors: world.actors,
        actor_locations: b.state.actors,
        facts: b.state.facts,
        knowledge: b.state.knowledge,
        premise: world.premise,
        qualification: "GM context is not information every character knows.",
      },
      rules: world.rules,
      ...this.checkContext(a, b),
      canon: a.query
        ? search(this.store, a.campaign_id, a.query, 3)
        : { hits: [] },
    };
  }
  proof(a, b) {
    const p = this.store.get(
      "SELECT * FROM preparations WHERE id=? AND campaign=? AND branch=?",
      a.preparation_id,
      a.campaign_id,
      a.branch_id,
    );
    if (
      !p ||
      p.revision !== b.revision ||
      p.state_hash !== sha(b.state) ||
      p.policy !== this.policy(this.campaign(a.campaign_id).world)
    )
      fail(
        "PREPARATION_STALE",
        "Preparation is missing, belongs to another branch, or is stale. Prepare again without changing the save.",
      );
    return p;
  }
  roll_check(a) {
    const b = this.branch(a),
      p = this.proof(a, b),
      world = this.campaign(a.campaign_id).world,
      purpose = a.purpose
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\s\p{P}]/gu, ""),
      signature = sha({
        purpose,
        attribute: a.attribute,
        difficulty: a.difficulty,
        stakes: a.stakes,
        situational: a.situational,
        basis: a.basis ?? null,
      });
    const prior = this.store.get(
      "SELECT * FROM checks WHERE campaign=? AND branch=? AND revision=? AND (purpose=? OR check_id=?)",
      a.campaign_id,
      a.branch_id,
      b.revision,
      purpose,
      a.check_id,
    );
    if (prior) {
      if (prior.signature !== signature)
        fail(
          "REROLL_REFUSED",
          "This purpose or check ID already has fixed difficulty and stakes.",
        );
      return { check: JSON.parse(prior.result), ...this.checkContext(a, b) };
    }
    if (
      this.checkContext(a, b).adjudication_checks.length >=
      world.rules.checks_per_turn
    )
      fail("CHECK_LIMIT", "This revision already reached its check limit.");
    if (
      !Object.hasOwn(b.state.player.attributes, a.attribute) ||
      !Object.hasOwn(world.rules.difficulties, a.difficulty)
    )
      fail("RULE_NOT_FOUND", "Use a configured attribute and difficulty.");
    if (a.situational && !a.basis)
      fail("BASIS_REQUIRED", "Situational modifiers require a basis.");
    if (Object.values(b.state.player.vitals).some((v) => v.current === 0))
      fail(
        "INCAPACITATED",
        "A vital is at zero; resolve that condition before rolling.",
      );
    const die = this.randomInt();
    if (!Number.isInteger(die) || die < 1 || die > 20)
      throw Error("Invalid random source");
    const modifier = b.state.player.attributes[a.attribute] + a.situational,
      total = die + modifier,
      dc = world.rules.difficulties[a.difficulty],
      margin = total - dc,
      outcome =
        margin >= 0
          ? die === 20 || margin >= 10
            ? "critical_success"
            : margin <= 2
              ? "costly_success"
              : "success"
          : margin >= -3
            ? "near_miss"
            : "failure";
    const result = {
      check_id: a.check_id,
      purpose: a.purpose,
      attribute: a.attribute,
      difficulty: a.difficulty,
      die,
      modifier,
      total,
      dc,
      margin,
      outcome,
      success: margin >= 0,
      stakes: a.stakes,
      revision: p.revision,
    };
    this.store.run(
      "INSERT INTO checks VALUES(?,?,?,?,?,?,?)",
      a.campaign_id,
      a.branch_id,
      b.revision,
      purpose,
      a.check_id,
      signature,
      JSON.stringify(result),
    );
    return { check: result, ...this.checkContext(a, b) };
  }
  preview_world(a) {
    const b = this.branch(a),
      c = this.campaign(a.campaign_id);
    const result = advance(
      c.world,
      c.seed,
      b.state,
      a.elapsed_minutes,
      a.destination,
    );
    if (result.events.length > 128)
      fail(
        "WORLD_STEP_TOO_LARGE",
        "Too many world events; preview a smaller time step.",
      );
    return {
      revision: b.revision,
      events: result.events,
      observations: result.observations,
      qualification: result.qualification,
    };
  }
  reconcile(a, b) {
    const context = this.checkContext(a, b),
      received = a.check_results ?? [],
      checks = context.adjudication_checks;
    const recovery = {
      ...context,
      branch_id: a.branch_id,
      revision: b.revision,
      committed: false,
    };
    if (
      new Set(received.map((c) => c.check_id)).size !== received.length ||
      received.some(
        (r) =>
          !checks.some(
            (c) => c.check_id === r.check_id && c.outcome === r.outcome,
          ),
      )
    )
      fail(
        "CHECK_RESULTS_CONFLICT",
        "Unknown, duplicate or changed check results. Correct the narrative and results using the full list.",
        recovery,
      );
    if (
      a.check_context_sha256 !== undefined &&
      a.check_context_sha256 !== context.check_context_sha256
    )
      fail(
        "CHECK_CONTEXT_CHANGED",
        "Read the new complete check set before submitting.",
        recovery,
      );
    const missing = checks.filter(
      (c) => !received.some((r) => r.check_id === c.check_id),
    );
    if (missing.length && !a.check_context_sha256)
      fail(
        "CHECKS_INCOMPLETE",
        "Read all checks, including failures. Supply complete results or acknowledge this context hash after incorporating every outcome.",
        recovery,
      );
    return {
      checks,
      repairs: missing.length
        ? [
            {
              kind: "filled_missing_check_results",
              check_ids: missing.map((c) => c.check_id),
            },
          ]
        : [],
    };
  }
  apply(s, changes) {
    const state = clone(s);
    for (const field of [
      "resource_deltas",
      "inventory_deltas",
      "attribute_deltas",
      "vital_deltas",
      "vital_maxima",
      "actor_locations",
    ])
      if (changes[field])
        for (const k of Object.keys(changes[field]))
          if (reserved(k)) fail("INVALID_KEY", "Reserved object key.");
    for (const [field, target, max, allowNew, min] of [
      ["resource_deltas", state.resources, 1000000, false, 0],
      ["inventory_deltas", state.inventory, 10000, true, 0],
      ["attribute_deltas", state.player.attributes, 30, false, -10],
    ])
      for (const [k, delta] of Object.entries(changes[field] ?? {})) {
        if (!Object.hasOwn(target, k) && !allowNew)
          fail("UNKNOWN_RESOURCE", "Unknown resource or attribute: " + k);
        const next = (target[k] ?? 0) + delta;
        if (!Number.isSafeInteger(next) || next < min || next > max)
          fail(
            "RESOURCE_BOUNDS",
            "Resource, inventory or attribute outside allowed bounds.",
          );
        target[k] = next;
        if (allowNew && next === 0) delete target[k];
      }
    for (const [k, v] of Object.entries(changes.vital_maxima ?? {})) {
      if (!Object.hasOwn(state.player.vitals, k))
        fail("VITAL_NOT_FOUND", "Unknown vital.");
      state.player.vitals[k].max = v.max;
    }
    for (const [k, delta] of Object.entries(changes.vital_deltas ?? {})) {
      if (!Object.hasOwn(state.player.vitals, k))
        fail("VITAL_NOT_FOUND", "Unknown vital.");
      state.player.vitals[k].current += delta;
    }
    for (const v of Object.values(state.player.vitals))
      if (
        !Number.isSafeInteger(v.current) ||
        v.current < 0 ||
        v.current > v.max
      )
        fail(
          "VITAL_BOUNDS",
          "Current vital must be within the final maximum; no implicit healing or clamping.",
        );
    if (changes.goals) state.goals = changes.goals;
    if (changes.player_status !== undefined)
      state.status = changes.player_status;
    for (const [id, location] of Object.entries(
      changes.actor_locations ?? {},
    )) {
      if (!Object.hasOwn(state.actors, id))
        fail("ACTOR_NOT_FOUND", "Actor not found.");
      state.actors[id].location = location;
    }
    return state;
  }
  updateFacts(state, a, revision) {
    const allowed = (actor) => Object.hasOwn(state.knowledge, actor);
    const observe = (actor, key, mode, basis) => {
      if (!allowed(actor))
        fail("ACTOR_NOT_FOUND", "Unknown knowledge recipient.");
      state.knowledge[actor][key] = {
        value: clone(state.facts[key].value),
        observed_revision: revision,
        mode,
        basis,
      };
    };
    for (const f of a.fact_updates) {
      if (
        reserved(f.key) ||
        /^(player|resources|inventory|world)(\.|$)/.test(f.key) ||
        Buffer.byteLength(JSON.stringify(f.value)) > 4000
      )
        fail(
          "FACT_RESERVED",
          "Use typed changes for protected state; keep ordinary facts below 4 KiB.",
        );
      state.facts[f.key] = { value: clone(f.value), basis: f.basis, revision };
      for (const actor of f.known_by)
        if (actor !== "gm") observe(actor, f.key, "observed", f.basis);
    }
    for (const k of a.knowledge_updates) {
      if (!Object.hasOwn(state.facts, k.key))
        fail("FACT_NOT_FOUND", "Cannot grant knowledge of a nonexistent fact.");
      for (const actor of k.actors) observe(actor, k.key, k.mode, k.basis);
    }
    return state;
  }
  oldReceipt(a, hash) {
    const old = this.store.get(
      "SELECT request_hash,receipt FROM events WHERE campaign=? AND branch=? AND request_key=?",
      a.campaign_id,
      a.branch_id,
      a.idempotency_key,
    );
    if (!old) return null;
    if (hash && old.request_hash !== hash)
      fail(
        "KEY_CONFLICT",
        "This key already belongs to a different committed request.",
      );
    return JSON.parse(old.receipt);
  }
  append(a, b, state, payload, requestHash) {
    if (Buffer.byteLength(JSON.stringify(state)) > 128000)
      fail(
        "STATE_CAPACITY",
        "State exceeds 128 KiB; archive completed facts into canon before adding more.",
      );
    const revision = b.revision + 1,
      id = randomUUID(),
      receipt = {
        committed: true,
        campaign_id: a.campaign_id,
        branch_id: a.branch_id,
        revision,
        event_id: id,
        operation: payload.operation ?? "turn",
        narration: payload.narration ?? null,
        summary: payload.summary,
        adjudication_checks: payload.checks ?? [],
        automatic_repairs: payload.repairs ?? [],
        world_events: payload.world_events ?? [],
        snapshot: this.snapshot(a, revision, state),
      };
    this.store.run(
      "INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?)",
      a.campaign_id,
      a.branch_id,
      revision,
      id,
      a.idempotency_key,
      requestHash,
      JSON.stringify(state),
      JSON.stringify(receipt),
      JSON.stringify(a),
      stamp(),
    );
    const result = this.store.run(
      "UPDATE branches SET revision=?,state=? WHERE campaign=? AND id=? AND revision=?",
      revision,
      JSON.stringify(state),
      a.campaign_id,
      a.branch_id,
      b.revision,
    );
    if (Number(result.changes) !== 1)
      fail("REVISION_CHANGED", "Another turn committed first.");
    return receipt;
  }
  commit_turn(a) {
    const hash = sha(a),
      prior = this.oldReceipt(a, hash);
    if (prior) return prior;
    const b = this.branch(a);
    if (b.revision !== a.expected_revision)
      fail(
        "REVISION_CHANGED",
        "Revision changed. Read the save before rebuilding a proposal.",
      );
    const p = this.proof(a, b);
    if (p.action !== a.player_action || p.policy !== a.policy_sha256)
      fail(
        "PREPARATION_MISMATCH",
        "Use the original player action and current policy.",
      );
    const { checks, repairs } = this.reconcile(a, b);
    let state = this.apply(b.state, a.changes);
    const c = this.campaign(a.campaign_id),
      world = advance(
        c.world,
        c.seed,
        state,
        a.changes.elapsed_minutes ?? 0,
        a.changes.location ?? state.location,
      );
    if (world.events.length > 128)
      fail("WORLD_STEP_TOO_LARGE", "Use a smaller time step.");
    state = world.state;
    this.updateFacts(state, a, b.revision + 1);
    return this.append(
      a,
      b,
      state,
      {
        narration: a.narration,
        summary: a.summary,
        checks,
        repairs,
        world_events: world.events,
      },
      hash,
    );
  }
  get_recovery(a) {
    const b = this.branch(a);
    return {
      branch_id: a.branch_id,
      revision: b.revision,
      ...this.checkContext(a, b),
      submission: a.idempotency_key
        ? (() => {
            const r = this.oldReceipt(a);
            return r
              ? { status: "committed", receipt: r }
              : { status: "no_receipt_at_read" };
          })()
        : undefined,
      instruction:
        "Only a committed receipt confirms completion. Keep the exact original request and key when retrying an unconfirmed operation.",
    };
  }
  snapshotAt(a, revision, b = this.branch(a)) {
    if (revision === 0) return JSON.parse(b.initial);
    const e = this.store.get(
      "SELECT state FROM events WHERE campaign=? AND branch=? AND revision=?",
      a.campaign_id,
      a.branch_id,
      revision,
    );
    if (!e) fail("SNAPSHOT_NOT_FOUND", "No snapshot at that revision.");
    return JSON.parse(e.state);
  }
  create_branch(a) {
    const signature = sha(a),
      old = this.store.get(
        "SELECT id,request_hash FROM branches WHERE campaign=? AND request_key=?",
        a.campaign_id,
        a.idempotency_key,
      );
    if (old) {
      if (old.request_hash !== signature)
        fail("KEY_CONFLICT", "Branch key belongs to a different request.");
      return { campaign_id: a.campaign_id, branch_id: old.id, created: false };
    }
    const b = this.branch(a),
      revision = a.from_revision ?? b.revision;
    if (revision > b.revision)
      fail("SNAPSHOT_NOT_FOUND", "Cannot fork a future revision.");
    const state = this.snapshotAt(a, revision, b),
      id = "if_" + randomUUID().replaceAll("-", ""),
      serialized = JSON.stringify(state);
    this.store.run(
      "INSERT INTO branches VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      a.campaign_id,
      id,
      a.name,
      a.premise,
      a.branch_id,
      revision,
      0,
      serialized,
      serialized,
      a.idempotency_key,
      signature,
    );
    return {
      campaign_id: a.campaign_id,
      branch_id: id,
      revision: 0,
      source_branch_id: a.branch_id,
      source_revision: revision,
      created: true,
    };
  }
  list_branches(a) {
    this.campaign(a.campaign_id);
    return {
      branches: this.store.all(
        "SELECT id,name,premise,parent AS source_branch_id,parent_revision AS source_revision,revision FROM branches WHERE campaign=? ORDER BY rowid",
        a.campaign_id,
      ),
    };
  }
  read_history(a) {
    let target = { ...a },
      b = this.branch(a),
      bound = a.before_revision ?? b.revision + 1;
    if (a.origin) {
      if (!b.parent) fail("NO_ORIGIN", "This branch has no fork origin.");
      target.branch_id = b.parent;
      bound = Math.min(
        a.before_revision ?? b.parent_revision + 1,
        b.parent_revision + 1,
      );
    }
    const rows = this.store.all(
      "SELECT revision,receipt,request_json,created FROM events WHERE campaign=? AND branch=? AND revision<? ORDER BY revision DESC LIMIT ?",
      a.campaign_id,
      target.branch_id,
      bound,
      a.limit + 1,
    );
    let bytes = 0,
      events = [];
    for (const r of rows.slice(0, a.limit)) {
      const item = {
        revision: r.revision,
        created: r.created,
        receipt: JSON.parse(r.receipt),
        proposal: JSON.parse(r.request_json),
      };
      const size = Buffer.byteLength(JSON.stringify(item));
      if (events.length && bytes + size > 64000) break;
      events.push(item);
      bytes += size;
    }
    return {
      branch_id: a.branch_id,
      source_branch_id: target.branch_id,
      events,
      next_before_revision:
        (events.length < rows.length ? events.at(-1)?.revision : null) ?? null,
    };
  }
  restore_checkpoint(a) {
    const hash = sha(a),
      old = this.oldReceipt(a, hash);
    if (old) return old;
    const b = this.branch(a);
    if (b.revision !== a.expected_revision)
      fail("REVISION_CHANGED", "Revision changed before restore.");
    if (a.target_revision > b.revision)
      fail("SNAPSHOT_NOT_FOUND", "Cannot restore a future state.");
    const state = this.snapshotAt(a, a.target_revision, b);
    return this.append(
      a,
      b,
      state,
      {
        operation: "restore",
        summary: `Restored revision ${a.target_revision}; prior history is retained.`,
      },
      hash,
    );
  }
}
