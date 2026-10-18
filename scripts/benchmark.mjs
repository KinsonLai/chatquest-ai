// Local HTTP protocol benchmark. No model generation or internet latency is measured.
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Engine } from "../src/engine.mjs";
import { listenHttp } from "../src/server.mjs";

const turns = 30;
async function measure(bundled) {
  const engine = new Engine(":memory:", { randomInt: () => 1 });
  const listener = await listenHttp(engine, { port: 0 });
  const client = new Client({ name: "local-performance-probe", version: "1" });
  let calls = 0,
    requestBytes = 0,
    responseBytes = 0;
  const call = async (name, args = {}, count = true) => {
    const request = { name, arguments: args };
    const result = await client.callTool(request);
    assert.notEqual(result.isError, true, JSON.stringify(result));
    if (count) {
      calls++;
      requestBytes += Buffer.byteLength(JSON.stringify(request));
      responseBytes += Buffer.byteLength(JSON.stringify(result));
    }
    return result.structuredContent;
  };
  try {
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${listener.address().port}/mcp`),
      ),
    );
    const c = await call(
      "create_campaign",
      {
        name: "Protocol probe",
        template: "ferry",
        idempotency_key: "probe-create",
      },
      false,
    );
    const scope = { campaign_id: c.campaign_id, branch_id: "main" };
    const initial = await call(
      "prepare_turn",
      { ...scope, player_action: "Inspect the quay" },
      false,
    );
    const times = [];
    for (let i = 0; i < turns; i++) {
      const check = {
        check_id: `probe-${i}`,
        purpose: `Inspect tide mark ${i}`,
        attribute: "insight",
        difficulty: "standard",
        stakes: "Failure leaves this mark unreadable",
      };
      const preview = { elapsed_minutes: 15 };
      const start = performance.now();
      const p = await call("prepare_turn", {
        ...scope,
        player_action: `Inspect tide mark ${i}`,
        known_policy_sha256: initial.policy_sha256,
        ...(bundled
          ? { expected_revision: i, checks: [check], world_preview: preview }
          : {}),
      });
      const context = bundled
        ? p
        : await call("roll_check", {
            ...scope,
            preparation_id: p.preparation_id,
            ...check,
          });
      const world = bundled
        ? p.world_preview
        : await call("preview_world", { ...scope, ...preview });
      const saved = await call("commit_turn", {
        ...scope,
        expected_revision: p.revision,
        preparation_id: p.preparation_id,
        player_action: p.player_action,
        policy_sha256: p.policy_sha256,
        check_context_sha256: context.check_context_sha256,
        idempotency_key: `probe-turn-${i}`,
        narration:
          "This mark remains unreadable. The group stays on the dry quay.",
        summary: "Failed tide-mark inspection",
        outcome: {
          resolved_action: "Inspected a mark",
          consequence: "Could not read it",
          next_decision: "Inspect another mark or leave",
        },
        changes: { elapsed_minutes: 15 },
      });
      assert.equal(saved.adjudication_checks[0].success, false);
      assert.deepEqual(saved.world_events, world.events);
      times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return {
      calls,
      request_bytes: requestBytes,
      response_bytes: responseBytes,
      ms_per_turn: {
        median: times[Math.floor(turns / 2)],
        p95: times[Math.floor(turns * 0.95)],
      },
      state: (await call("get_state", { ...scope, viewer: "gm" }, false)).state,
    };
  } finally {
    await client.close();
    await new Promise((resolve) => listener.close(resolve));
    engine.close();
  }
}
// Warm the SDK/runtime before either reported sample.
await measure(true);
const separate = await measure(false),
  bundled = await measure(true);
assert.deepEqual(bundled.state, separate.state);
delete bundled.state;
delete separate.state;
console.log(
  JSON.stringify(
    {
      method:
        "30 fixed-outcome turns per path over actual localhost HTTP; in-memory SQLite; warmed runtime; no LLM or WAN timing",
      same_final_state: true,
      separate,
      bundled,
    },
    null,
    2,
  ),
);
