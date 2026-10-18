import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Engine } from "../src/engine.mjs";
import { createMcpServer } from "../src/server.mjs";
import { GameError } from "../src/schema.mjs";

async function session(run) {
  const engine = new Engine(":memory:");
  const server = createMcpServer(engine);
  const client = new Client({ name: "retry-test", version: "1" });
  const [local, remote] = InMemoryTransport.createLinkedPair();
  await server.connect(remote);
  await client.connect(local);
  try {
    await run(engine, client);
  } finally {
    await client.close();
    await server.close();
    engine.close();
  }
}
const call = async (client, name, args = {}) =>
  client.callTool({ name, arguments: args });
const value = (r) => {
  assert.notEqual(r.isError, true, JSON.stringify(r));
  return r.structuredContent;
};
async function turn(client) {
  const c = value(
    await call(client, "create_campaign", {
      name: "Retry test",
      template: "ferry",
      idempotency_key: "retry-create",
    }),
  );
  const scope = { campaign_id: c.campaign_id, branch_id: "main" };
  const p = value(
    await call(client, "prepare_turn", {
      ...scope,
      player_action: "Pay two coins for a replacement ring.",
    }),
  );
  return {
    scope,
    args: {
      ...scope,
      expected_revision: p.revision,
      preparation_id: p.preparation_id,
      player_action: p.player_action,
      policy_sha256: p.policy_sha256,
      idempotency_key: "retry-payment",
      narration: "Ada takes two coins and provides the replacement ring.",
      summary: "Bought a ring.",
      outcome: {
        resolved_action: "Paid for ring",
        consequence: "Two coins spent",
        next_decision: "Repair the mount",
      },
      changes: { resource_deltas: { coins: -2 } },
    },
  };
}

for (const afterCommit of [false, true]) {
  test(`chat-side recovery ${afterCommit ? "finds a lost receipt" : "retries a transient failure"} without a duplicate charge`, async () =>
    session(async (engine, client) => {
      const { scope, args } = await turn(client);
      const original = engine.call.bind(engine);
      let failed = false,
        commits = 0;
      engine.call = (name, a) => {
        if (name !== "commit_turn") return original(name, a);
        commits++;
        if (!failed) {
          failed = true;
          if (afterCommit) original(name, a);
          throw Error("injected service failure");
        }
        return original(name, a);
      };
      const first = await call(client, "commit_turn", args);
      assert.equal(first.isError, true);
      const hint = first.structuredContent.retry;
      assert.equal(hint.retryable, true);
      assert.equal(hint.max_auto_retries, 1);
      assert.equal(hint.action, "recover_then_retry");
      assert.deepEqual(hint.next_call, {
        name: "get_recovery",
        arguments: { ...scope, idempotency_key: args.idempotency_key },
      });
      assert.match(hint.instruction, /不必要求玩家重複/);
      const recovery = value(await client.callTool(hint.next_call));
      const saved =
        recovery.submission.status === "committed"
          ? recovery.submission.receipt
          : value(await call(client, "commit_turn", args));
      assert.equal(saved.committed, true);
      assert.equal(commits, afterCommit ? 1 : 2);
      const state = value(await call(client, "get_state", scope));
      assert.equal(state.revision, 1);
      assert.equal(state.state.resources.coins, 4);
    }));
}

test("SQLite busy read requests one exact retry; permanent or permission errors do not", async () =>
  session(async (engine, client) => {
    const original = engine.call.bind(engine);
    let mode = "busy";
    engine.call = (name, a) => {
      if (mode === "busy") {
        const e = Error("database is locked");
        e.errcode = 5;
        throw e;
      }
      if (mode === "denied")
        throw new GameError("PERMISSION_DENIED", "Not authorized.");
      if (mode === "invalid")
        throw new GameError("RESOURCE_BOUNDS", "Not enough coins.");
      if (mode === "raw-denied") {
        const e = Error("Permission denied");
        e.code = "PERMISSION_DENIED";
        throw e;
      }
      if (mode === "disk-full") {
        const e = Error("No space");
        e.code = "ENOSPC";
        throw e;
      }
      return original(name, a);
    };
    const busy = await call(client, "read_guide");
    assert.equal(busy.structuredContent.retry.action, "retry_same_request");
    assert.equal(busy.structuredContent.retry.max_auto_retries, 1);
    const recoveryBusy = await call(client, "get_recovery", {
      campaign_id: "test",
      branch_id: "main",
      idempotency_key: "test-key",
    });
    assert.equal(
      recoveryBusy.structuredContent.retry.action,
      "retry_same_request",
    );
    assert.equal(recoveryBusy.structuredContent.retry.next_call, undefined);
    const branchBusy = await call(client, "create_branch", {
      campaign_id: "test",
      branch_id: "main",
      name: "IF retry",
      premise: "Take another route",
      idempotency_key: "shared-key",
    });
    // Branch keys belong to a separate namespace from event receipts.
    assert.equal(
      branchBusy.structuredContent.retry.action,
      "retry_same_request",
    );
    assert.equal(branchBusy.structuredContent.retry.next_call, undefined);
    mode = "ok";
    assert.ok(value(await call(client, "read_guide")).text);
    for (mode of ["denied", "invalid", "raw-denied", "disk-full"]) {
      const error = await call(client, "read_guide");
      assert.equal(error.structuredContent.retry.retryable, false);
      assert.equal(error.structuredContent.retry.max_auto_retries, 0);
    }
  }));
