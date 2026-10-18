import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Engine } from "../src/engine.mjs";
import { listenHttp } from "../src/server.mjs";
const value = (r) => {
  assert.equal(r.isError, undefined, JSON.stringify(r));
  return r.structuredContent;
};
test("official client performs stdio discovery, resources, campaign, commit and recovery against a child process", async () => {
  const dir = mkdtempSync(join(tmpdir(), "branchwright-")),
    client = new Client({ name: "integration-test", version: "1.0.0" }),
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        fileURLToPath(new URL("../src/cli.mjs", import.meta.url)),
        "--db",
        join(dir, "test.sqlite"),
      ],
      stderr: "pipe",
    });
  try {
    await client.connect(transport);
    const list = await client.listTools();
    assert.equal(list.tools.length, 17);
    assert.equal((await client.listResources()).resources.length, 4);
    assert.ok(
      (await client.listPrompts()).prompts.some(
        (p) => p.name === "start-adventure",
      ),
    );
    assert.ok(
      (
        await client.readResource({ uri: "branchwright://guide" })
      ).contents[0].text.includes("committed:true"),
    );
    const c = value(
        await client.callTool({
          name: "create_campaign",
          arguments: {
            name: "Stdio adventure",
            template: "signal",
            idempotency_key: "stdio-create-001",
          },
        }),
      ),
      scope = { campaign_id: c.campaign_id, branch_id: c.branch_id };
    const p = value(
      await client.callTool({
        name: "prepare_turn",
        arguments: { ...scope, player_action: "Look around." },
      }),
    );
    const args = {
      ...scope,
      preparation_id: p.preparation_id,
      expected_revision: p.revision,
      player_action: p.player_action,
      policy_sha256: p.policy_sha256,
      check_context_sha256: p.check_context_sha256,
      idempotency_key: "stdio-turn-001",
      narration: "The receiver deck is quiet; the crew waits at the dock.",
      summary: "Looked around the dock.",
      outcome: {
        resolved_action: "Surveyed the dock",
        consequence: "No movement chosen yet",
        next_decision: "Choose a hatch",
      },
      changes: {},
    };
    const saved = value(
      await client.callTool({ name: "commit_turn", arguments: args }),
    );
    assert.equal(saved.committed, true);
    assert.deepEqual(
      value(await client.callTool({ name: "commit_turn", arguments: args })),
      saved,
    );
    assert.deepEqual(
      value(
        await client.callTool({
          name: "get_recovery",
          arguments: { ...scope, idempotency_key: args.idempotency_key },
        }),
      ).submission.receipt,
      saved,
    );
  } finally {
    await client.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("official client uses real HTTP; unauthorized hosts/origins/token reject, and no HTML/UI is served", async () => {
  const engine = new Engine(":memory:"),
    token = "test-token-long-enough-for-local-integration",
    server = await listenHttp(engine, { port: 0, token }),
    url = new URL(`http://127.0.0.1:${server.address().port}/mcp`),
    client = new Client({ name: "http-test", version: "1.0.0" });
  try {
    await assert.rejects(
      listenHttp(engine, { host: "0.0.0.0", port: 0 }),
      /requires.*TOKEN/,
    );
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            origin: "https://untrusted.example",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(new URL("/", url), {
          headers: { authorization: `Bearer ${token}` },
        })
      ).status,
      404,
    );
    await client.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { authorization: `Bearer ${token}` } },
      }),
    );
    assert.equal((await client.listTools()).tools.length, 17);
    const result = await client.callTool({
      name: "read_guide",
      arguments: { section: "tools", tool_name: "commit_turn" },
    });
    assert.equal(result.structuredContent.tool.name, "commit_turn");
    const invalid = await client.callTool({
      name: "read_guide",
      arguments: { section: "overview", unexpected: true },
    });
    assert.equal(invalid.isError, true);
    assert.equal(
      (
        await fetch(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 7,
            method: "ping",
            extra: "x".repeat(270000),
          }),
        })
      ).status,
      413,
    );
  } finally {
    await client.close();
    await new Promise((r) => server.close(r));
    engine.close();
  }
});
