import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Engine } from "../src/engine.mjs";
const create = (e) =>
  e.call("create_campaign", {
    name: "Invariants",
    template: "lantern",
    idempotency_key: "invariants-create",
  });
const scope = (c) => ({ campaign_id: c.campaign_id, branch_id: "main" });
const proposal = (e, s, key = "invariant-turn") => {
  const p = e.call("prepare_turn", {
    ...s,
    player_action: "Ask about the bridge.",
  });
  return {
    ...s,
    player_action: p.player_action,
    preparation_id: p.preparation_id,
    expected_revision: p.revision,
    policy_sha256: p.policy_sha256,
    check_context_sha256: p.check_context_sha256,
    idempotency_key: key,
    narration: "The question is asked without revealing private information.",
    summary: "Asked about the bridge.",
    outcome: {
      resolved_action: "Asked a question",
      consequence: "The scene can continue",
      next_decision: "Choose a route",
    },
    changes: {},
  };
};
test("SQLite reopening preserves exact receipts and historical snapshots", () => {
  const dir = mkdtempSync(join(tmpdir(), "branchwright-persist-"));
  try {
    const path = join(dir, "game.sqlite");
    let e = new Engine(path);
    const c = create(e),
      s = scope(c),
      a = proposal(e, s),
      r = e.call("commit_turn", a);
    e.close();
    e = new Engine(path);
    assert.deepEqual(e.call("commit_turn", a), r);
    assert.equal(e.call("get_state", s).revision, 1);
    assert.equal(
      e.call("read_history", s).events[0].proposal.player_action,
      a.player_action,
    );
    e.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("cross-campaign source IDs, branch IDs and proofs cannot be substituted", () => {
  const e = new Engine(":memory:"),
    c = create(e),
    d = e.call("create_campaign", {
      name: "Other",
      template: "signal",
      idempotency_key: "other-campaign",
    }),
    s = scope(c),
    a = proposal(e, s);
  assert.throws(
    () => e.call("commit_turn", { ...a, campaign_id: d.campaign_id }),
    /preparation/i,
  );
  const hit = e.call("search_canon", {
    campaign_id: c.campaign_id,
    query: "bridge",
  }).hits[0];
  assert.throws(
    () =>
      e.call("read_canon", { campaign_id: d.campaign_id, chunk_id: hit.id }),
    /chunk/i,
  );
  e.close();
});
test("invalid knowledge and malformed typed changes roll back the whole turn", () => {
  const e = new Engine(":memory:"),
    s = scope(create(e)),
    a = proposal(e, s),
    before = e.call("get_state", { ...s, viewer: "gm" });
  assert.throws(
    () =>
      e.call("commit_turn", {
        ...a,
        changes: { resource_deltas: { credits: -5 } },
        fact_updates: [
          {
            key: "route",
            value: "north",
            basis: "told",
            known_by: ["not-an-actor"],
          },
        ],
      }),
    /recipient/i,
  );
  assert.deepEqual(e.call("get_state", { ...s, viewer: "gm" }), before);
  assert.throws(
    () =>
      e.call("commit_turn", {
        ...a,
        changes: { vital_maxima: { health: { max: 5, basis: "injury" } } },
      }),
    /vital/i,
  );
  assert.throws(() =>
    e.call("commit_turn", { ...a, changes: { resources: { credits: 999 } } }),
  );
  assert.deepEqual(e.call("get_state", { ...s, viewer: "gm" }), before);
  e.close();
});
test("later dice invalidate a seen context; repeated purpose cannot change stakes", () => {
  const e = new Engine(":memory:", { randomInt: () => 10 }),
    s = scope(create(e)),
    a = proposal(e, s),
    check = {
      ...s,
      preparation_id: a.preparation_id,
      check_id: "bridge",
      purpose: "Inspect the bridge",
      attribute: "insight",
      difficulty: "standard",
      stakes: "Miss a weak plank",
    };
  const r = e.call("roll_check", check);
  assert.deepEqual(
    e.call("roll_check", { ...check, check_id: "alias" }).check,
    r.check,
  );
  assert.throws(
    () => e.call("roll_check", { ...check, stakes: "No cost" }),
    /fixed/i,
  );
  assert.throws(
    () => e.call("commit_turn", a),
    (err) => err.code === "CHECK_CONTEXT_CHANGED",
  );
  assert.equal(e.call("get_state", s).revision, 0);
  e.close();
});
test("immutable canon batch rollback and literal FTS query cannot overwrite sources or inject SQL", () => {
  const e = new Engine(":memory:"),
    s = scope(create(e));
  assert.throws(
    () =>
      e.call("ingest_canon", {
        campaign_id: s.campaign_id,
        documents: [
          { id: "new", title: "New", text: "unique-rollback-marker" },
          { id: "opening", title: "Wrong edition", text: "overwritten" },
        ],
      }),
    /immutable|source ID/i,
  );
  assert.equal(
    e.call("search_canon", {
      campaign_id: s.campaign_id,
      query: "unique-rollback-marker",
    }).hits.length,
    0,
  );
  assert.doesNotThrow(() =>
    e.call("search_canon", {
      campaign_id: s.campaign_id,
      query: '" OR *; DROP TABLE campaigns; --',
    }),
  );
  assert.equal(e.call("list_campaigns", {}).campaigns.length, 1);
  e.close();
});
test("origin history clamps at fork point and pagination does not cross into later parent events", () => {
  const e = new Engine(":memory:"),
    s = scope(create(e));
  e.call("commit_turn", proposal(e, s, "history-1"));
  const f = e.call("create_branch", {
    ...s,
    name: "Before the reveal",
    premise: "Different route",
    from_revision: 1,
    idempotency_key: "history-fork",
  });
  e.call("commit_turn", proposal(e, s, "history-2"));
  const h = e.call("read_history", {
    campaign_id: s.campaign_id,
    branch_id: f.branch_id,
    origin: true,
  });
  assert.deepEqual(
    h.events.map((x) => x.revision),
    [1],
  );
  assert.equal(h.next_before_revision, null);
  const page = e.call("read_history", { ...s, limit: 1 });
  assert.equal(page.events[0].revision, 2);
  assert.equal(
    e.call("read_history", {
      ...s,
      before_revision: page.next_before_revision,
      limit: 1,
    }).events[0].revision,
    1,
  );
  e.close();
});
