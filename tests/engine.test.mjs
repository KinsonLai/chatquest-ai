import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/engine.mjs";
const setup = (template = "lantern", options = {}) => {
  const e = new Engine(":memory:", options),
    c = e.call("create_campaign", {
      name: "Test campaign",
      template,
      idempotency_key: "create-test-001",
    });
  return {
    e,
    c,
    scope: { campaign_id: c.campaign_id, branch_id: c.branch_id },
  };
};
const prep = (e, s, action = "Inspect the doorway.") =>
  e.call("prepare_turn", { ...s, player_action: action });
const turn = (p, s, changes = {}, key = "turn-test-001") => ({
  ...s,
  expected_revision: p.revision,
  preparation_id: p.preparation_id,
  player_action: p.player_action,
  policy_sha256: p.policy_sha256,
  check_context_sha256: p.check_context_sha256,
  idempotency_key: key,
  narration: "The doorway is inspected; the next choice remains open.",
  summary: "Inspected the doorway.",
  outcome: {
    resolved_action: "Inspect doorway",
    consequence: "The scene has been examined",
    next_decision: "Choose where to go",
  },
  changes,
});
test("three genres, replay, resource validation and no silent healing", () => {
  for (const template of ["lantern", "signal", "blackout"]) {
    const { e, scope } = setup(template),
      p = prep(e, scope),
      hp = p.state.player.vitals.health.current;
    const a = turn(p, scope, {
      vital_maxima: {
        health: { max: hp + 5, basis: "A declared test training reward" },
      },
    });
    const r = e.call("commit_turn", a);
    assert.equal(r.committed, true);
    assert.equal(r.revision, 1);
    assert.deepEqual(e.call("commit_turn", a), r);
    const state = e.call("get_state", scope).state;
    assert.equal(state.player.vitals.health.current, hp);
    assert.equal(state.player.vitals.health.max, hp + 5);
    assert.throws(
      () => e.call("commit_turn", { ...a, narration: "Changed content" }),
      /key/i,
    );
    const q = prep(e, scope);
    assert.throws(
      () =>
        e.call(
          "commit_turn",
          turn(
            q,
            scope,
            { resource_deltas: { credits: -999999 } },
            "bad-resource-key",
          ),
        ),
      /resource/i,
    );
    assert.equal(e.call("get_state", scope).revision, 1);
    e.close();
  }
});
test("failed checks remain discoverable; hash can fill missing acknowledgements but cannot rewrite results", () => {
  const { e, scope } = setup("lantern", { randomInt: () => 1 }),
    p = prep(e, scope),
    check = e.call("roll_check", {
      ...scope,
      preparation_id: p.preparation_id,
      check_id: "gate",
      purpose: "Convince the gatekeeper",
      attribute: "presence",
      difficulty: "hard",
      stakes: "The gatekeeper withholds the route.",
    });
  assert.equal(check.check.outcome, "failure");
  const again = prep(e, scope);
  assert.equal(again.adjudication_checks.length, 1);
  const a = turn(again, scope);
  assert.throws(
    () => e.call("commit_turn", { ...a, check_context_sha256: undefined }),
    (e) => e.code === "CHECKS_INCOMPLETE",
  );
  assert.throws(
    () =>
      e.call("commit_turn", {
        ...a,
        check_results: [{ check_id: "gate", outcome: "success" }],
      }),
    (e) => e.code === "CHECK_RESULTS_CONFLICT",
  );
  const receipt = e.call("commit_turn", a);
  assert.equal(receipt.adjudication_checks[0].outcome, "failure");
  assert.equal(receipt.automatic_repairs.length, 1);
  e.close();
});
test("forks and restore preserve historical knowledge; private changes do not update an NPC observation", () => {
  const { e, scope } = setup(),
    p = prep(e, scope);
  e.call("commit_turn", {
    ...turn(p, scope),
    fact_updates: [
      {
        key: "cache",
        value: "under the bridge",
        basis: "seen in the scene",
        known_by: ["player", "mira"],
      },
    ],
  });
  const first = e.call("get_state", scope),
    fork = e.call("create_branch", {
      ...scope,
      from_revision: 1,
      name: "Take the other road",
      premise: "Explore a different route",
      idempotency_key: "fork-test-001",
    }),
    fs = { campaign_id: scope.campaign_id, branch_id: fork.branch_id };
  const q = prep(e, scope);
  e.call("commit_turn", {
    ...turn(q, scope, {}, "turn-test-002"),
    fact_updates: [
      {
        key: "cache",
        value: "moved elsewhere",
        basis: "The player secretly moved it",
        known_by: ["player"],
      },
    ],
  });
  assert.equal(
    e.call("get_knowledge", { ...scope, viewer: "mira" }).facts.cache.value,
    "under the bridge",
  );
  assert.equal(
    e.call("get_knowledge", { ...fs, viewer: "gm" }).facts.cache.value,
    "under the bridge",
  );
  assert.deepEqual(e.call("get_state", fs).state, first.state);
  const fp = prep(e, fs);
  assert.throws(
    () =>
      e.call("commit_turn", {
        ...turn(fp, fs, {}, "cross-branch-proof"),
        branch_id: "main",
      }),
    /preparation|revision/i,
  );
  e.call("commit_turn", turn(fp, fs, {}, "fork-turn-001"));
  const restored = e.call("restore_checkpoint", {
    ...fs,
    expected_revision: 1,
    target_revision: 0,
    idempotency_key: "restore-test-001",
  });
  assert.equal(restored.revision, 2);
  assert.deepEqual(e.call("get_state", fs).state, first.state);
  assert.equal(e.call("get_state", scope).revision, 2);
  e.close();
});
test("local canon retrieval cites exact source lines and indexes CJK without a model API", () => {
  const { e, scope } = setup();
  e.call("ingest_canon", {
    campaign_id: scope.campaign_id,
    documents: [
      {
        id: "notes",
        title: "Public notes",
        text: "The copper key opens the north lock.\n銅鑰匙藏在古井旁邊。",
      },
    ],
  });
  for (const query of ["copper key", "銅鑰匙"]) {
    const r = e.call("search_canon", { campaign_id: scope.campaign_id, query });
    assert.ok(r.hits.length);
    const hit = r.hits.find((h) => h.citation.startsWith("notes@"));
    assert.ok(hit);
    assert.match(hit.citation, /notes@.*:L1-L2/);
    assert.ok(
      e
        .call("read_canon", {
          campaign_id: scope.campaign_id,
          chunk_id: hit.id,
        })
        .text.includes("銅鑰匙"),
    );
  }
  e.close();
});
test("world previews are deterministic, do not write, and commits preserve full world event history", () => {
  const { e, scope } = setup(),
    before = e.call("get_state", scope),
    a = e.call("preview_world", { ...scope, elapsed_minutes: 180 });
  assert.deepEqual(
    e.call("preview_world", { ...scope, elapsed_minutes: 180 }),
    a,
  );
  assert.deepEqual(e.call("get_state", scope), before);
  const p = prep(e, scope),
    r = e.call("commit_turn", turn(p, scope, { elapsed_minutes: 180 }));
  assert.deepEqual(r.world_events, a.events);
  assert.equal(e.call("get_state", scope).state.clock, 180);
  assert.equal(
    e.call("read_history", scope).events[0].receipt.event_id,
    r.event_id,
  );
  e.close();
});
test("recovery returns exact receipts, stale proposals reject, and guides describe every exposed tool", () => {
  const { e, scope } = setup(),
    p = prep(e, scope),
    a = turn(p, scope),
    r = e.call("commit_turn", a);
  assert.deepEqual(
    e.call("get_recovery", { ...scope, idempotency_key: a.idempotency_key })
      .submission.receipt,
    r,
  );
  assert.throws(
    () => e.call("commit_turn", { ...a, idempotency_key: "stale-new-key" }),
    /revision/i,
  );
  const guide = e.call("read_guide", { section: "tools" });
  assert.ok(guide.tools.some((t) => t.name === "create_branch"));
  assert.ok(!guide.tools.some((t) => t.name.includes("shell")));
  e.close();
});
