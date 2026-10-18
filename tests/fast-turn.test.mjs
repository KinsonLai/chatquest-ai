import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Engine } from "../src/engine.mjs";
import { createMcpServer } from "../src/server.mjs";

const check = {
  check_id: "read-dispatch",
  purpose: "Read the wet dispatch privately",
  attribute: "insight",
  difficulty: "standard",
  stakes: "Failure recovers only before the bell; no gate or signature.",
};
const outcome = {
  resolved_action: "Read dispatch",
  consequence: "Only a fragment recovered",
  next_decision: "Take the bridge",
};
function setup() {
  let rolls = 0;
  const e = new Engine(":memory:", {
    randomInt: () => {
      rolls++;
      return 1;
    },
  });
  const c = e.call("create_campaign", {
    name: "Fast story",
    template: "ferry",
    idempotency_key: "fast-create",
  });
  return {
    e,
    scope: { campaign_id: c.campaign_id, branch_id: "main" },
    rolls: () => rolls,
  };
}
test("bundled preparation preserves failed dice, full knowledge, canon and preview; replay does not reroll", () => {
  const { e, scope, rolls } = setup();
  try {
    const args = {
      ...scope,
      player_action: "Read the dispatch alone.",
      query: "dispatch",
      expected_revision: 0,
      checks: [check],
      world_preview: { elapsed_minutes: 15 },
    };
    const p = e.call("prepare_turn", args);
    assert.equal(p.revision, 0);
    assert.equal(p.adjudication_checks[0].outcome, "failure");
    assert.equal(p.gm.actors.jun.age, 13);
    assert.deepEqual(p.gm.knowledge.jun, {});
    assert.ok(p.canon.hits[0].text);
    assert.deepEqual(
      p.world_preview,
      e.call("preview_world", { ...scope, elapsed_minutes: 15 }),
    );
    const repeated = e.call("prepare_turn", args);
    assert.equal(repeated.check_context_sha256, p.check_context_sha256);
    assert.equal(rolls(), 1);
    assert.equal(e.call("get_state", scope).revision, 0);
    const commit = {
      ...scope,
      expected_revision: 0,
      preparation_id: p.preparation_id,
      player_action: p.player_action,
      policy_sha256: p.policy_sha256,
      check_context_sha256: p.check_context_sha256,
      idempotency_key: "fast-commit",
      narration:
        "Only before the bell survives. Jun has not read the dispatch.",
      summary: "A private failed inspection",
      outcome,
      changes: { elapsed_minutes: 15 },
      fact_updates: [
        {
          key: "dispatch",
          value: "before the bell",
          basis: "Read privately",
          known_by: ["player"],
        },
      ],
    };
    assert.throws(
      () =>
        e.call("commit_turn", {
          ...commit,
          check_results: [{ check_id: check.check_id, outcome: "success" }],
        }),
      /changed check results/i,
    );
    const saved = e.call("commit_turn", commit);
    assert.deepEqual(saved.world_events, p.world_preview.events);
    assert.deepEqual(e.call("commit_turn", commit), saved);
    assert.equal(
      e.call("get_knowledge", { ...scope, viewer: "jun" }).facts.dispatch,
      undefined,
    );
    const next = e.call("prepare_turn", {
      ...scope,
      player_action: "Leave",
      known_policy_sha256: p.policy_sha256,
    });
    assert.equal(next.guide, null);
    assert.equal(next.revision, 1);
  } finally {
    e.close();
  }
});

test("batch rejects stale revisions and rolls back all checks if any request fails", () => {
  const { e, scope, rolls } = setup();
  try {
    const args = { ...scope, player_action: "Inspect", checks: [check] };
    assert.throws(() => e.call("prepare_turn", args), /expected_revision/i);
    assert.throws(
      () => e.call("prepare_turn", { ...args, expected_revision: 1 }),
      /revision/i,
    );
    assert.equal(rolls(), 0);
    assert.throws(
      () =>
        e.call("prepare_turn", {
          ...args,
          expected_revision: 0,
          checks: [
            check,
            {
              ...check,
              check_id: "invalid",
              purpose: "Invalid second check",
              attribute: "missing",
            },
          ],
        }),
      /attribute/i,
    );
    assert.deepEqual(e.call("get_recovery", scope).adjudication_checks, []);
    assert.equal(e.store.get("SELECT count(*) AS n FROM preparations").n, 0);
    assert.equal(e.call("get_state", scope).revision, 0);
  } finally {
    e.close();
  }
});

test("a rejected batch preserves earlier pending checks and cannot evade the turn limit", () => {
  const { e, scope } = setup();
  try {
    const p = e.call("prepare_turn", { ...scope, player_action: "Inspect" });
    const first = e.call("roll_check", {
      ...scope,
      preparation_id: p.preparation_id,
      ...check,
    });
    const extra = (n) => ({
      ...check,
      check_id: `extra-${n}`,
      purpose: `Inspect mark ${n}`,
    });
    assert.throws(
      () =>
        e.call("prepare_turn", {
          ...scope,
          player_action: "Inspect",
          expected_revision: 0,
          checks: [extra(1), extra(2), extra(3)],
        }),
      /check limit/i,
    );
    assert.deepEqual(
      e.call("get_recovery", scope).adjudication_checks,
      first.adjudication_checks,
    );
    const bundled = e.call("prepare_turn", {
      ...scope,
      player_action: "Inspect",
      expected_revision: 0,
      checks: [extra(1)],
    });
    assert.equal(bundled.adjudication_checks.length, 2);
    assert.ok(
      bundled.adjudication_checks.some(
        (c) => c.check_id === check.check_id && c.outcome === "failure",
      ),
    );
  } finally {
    e.close();
  }
});

test("complete two-call MCP story and IF preserve private knowledge and the original save", async () => {
  const { e, scope } = setup();
  const server = createMcpServer(e),
    client = new Client({ name: "fast-story", version: "1" });
  const [local, remote] = InMemoryTransport.createLinkedPair();
  await server.connect(remote);
  await client.connect(local);
  let calls = 0;
  const call = async (name, args = {}) => {
    calls++;
    const r = await client.callTool({ name, arguments: args });
    assert.notEqual(r.isError, true, JSON.stringify(r));
    return r.structuredContent;
  };
  try {
    await call("read_guide", { section: "workflows" });
    let policy;
    async function scene(
      active,
      revision,
      key,
      action,
      changes,
      checks = [],
      facts = [],
      knowledge = [],
    ) {
      const before = calls;
      const p = await call("prepare_turn", {
        ...active,
        player_action: action,
        expected_revision: revision,
        checks,
        known_policy_sha256: policy,
        query: "dispatch ferry",
        world_preview: {
          elapsed_minutes: changes.elapsed_minutes,
          destination: changes.location,
        },
      });
      policy = p.policy_sha256;
      const r = await call("commit_turn", {
        ...active,
        expected_revision: p.revision,
        preparation_id: p.preparation_id,
        player_action: p.player_action,
        policy_sha256: p.policy_sha256,
        check_context_sha256: p.check_context_sha256,
        idempotency_key: key,
        narration: action,
        summary: action,
        outcome,
        changes,
        fact_updates: facts,
        knowledge_updates: knowledge,
      });
      assert.equal(calls - before, 2);
      assert.deepEqual(r.world_events, p.world_preview.events);
      return { p, r };
    }
    const discovery = await scene(
      scope,
      0,
      "inspect",
      "Robin reads alone. Only before the bell survives; Jun and Ada are outside.",
      { elapsed_minutes: 15 },
      [check],
      [
        {
          key: "dispatch",
          value: "before the bell",
          basis: "Robin inspected alone",
          known_by: ["player"],
        },
      ],
    );
    assert.equal(discovery.r.adjudication_checks[0].success, false);
    const fork = await call("create_branch", {
      ...scope,
      name: "Tell Jun",
      premise: "Share the fragment before leaving",
      idempotency_key: "if-create",
    });
    await scene(
      scope,
      1,
      "main-leave",
      "Robin takes the high bridge with Jun and Ada, keeping the fragment private.",
      {
        elapsed_minutes: 30,
        location: "East bank shelter",
        goals: ["Completed: all reached shelter"],
      },
    );
    const main = await call("get_state", { ...scope, viewer: "gm" });
    const alt = { campaign_id: scope.campaign_id, branch_id: fork.branch_id };
    assert.equal(
      (await call("get_knowledge", { ...alt, viewer: "jun" })).facts.dispatch,
      undefined,
    );
    await scene(
      alt,
      0,
      "if-share",
      "Robin shows Jun the fragment. Jun reads before the bell and asks which bell.",
      { elapsed_minutes: 5 },
      [],
      [],
      [
        {
          key: "dispatch",
          actors: ["jun"],
          mode: "told",
          basis: "Robin showed the fragment",
        },
      ],
    );
    assert.equal(
      (await call("get_knowledge", { ...alt, viewer: "jun" })).facts.dispatch
        .value,
      "before the bell",
    );
    await scene(
      alt,
      1,
      "if-leave",
      "The three take the bridge to the shelter.",
      {
        elapsed_minutes: 30,
        location: "East bank shelter",
        goals: ["Completed: all reached shelter"],
      },
    );
    assert.deepEqual(await call("get_state", { ...scope, viewer: "gm" }), main);
    assert.equal(main.state.knowledge.jun.dispatch, undefined);
    assert.equal(main.state.resources.coins, 6);
    assert.equal(
      (await call("get_state", alt)).state.location,
      "East bank shelter",
    );
  } finally {
    await client.close();
    await server.close();
    e.close();
  }
});
