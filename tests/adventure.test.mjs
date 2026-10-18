import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Engine } from "../src/engine.mjs";
import { createMcpServer } from "../src/server.mjs";
import { playDemo } from "../src/demo.mjs";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { listenHttp } from "../src/server.mjs";

for (const die of [1, 20]) {
  test(`complete ferry story over MCP, including ${die === 1 ? "failed" : "successful"} checks, recovery and a played IF`, async () => {
    const engine = new Engine(":memory:", { randomInt: () => die });
    const server = createMcpServer(engine);
    const client = new Client({ name: "story-test", version: "1" });
    const [local, remote] = InMemoryTransport.createLinkedPair();
    await server.connect(remote);
    await client.connect(local);
    try {
      const result = await playDemo(client, () => {});
      assert.equal(result.main.revision, 5);
      assert.equal(result.alternative.revision, 1);
      assert.equal(result.main.state.resources.coins, 4);
      assert.equal(result.main.state.inventory.rope, undefined);
      assert.equal(result.main.state.inventory.patch, undefined);
      assert.equal(result.main.state.location, "East bank shelter");
      assert.equal(
        result.main.state.goals[0],
        "Completed: everyone reached the east bank shelter",
      );
      assert.equal(
        result.checks.every((c) => c.success === (die === 20)),
        true,
      );
      assert.equal(result.history.length, 5);
      assert.ok(result.events.some((e) => e.kind === "tide"));
    } finally {
      await client.close();
      await server.close();
      engine.close();
    }
  });
}

test("complete ferry game over authenticated HTTP, not only tool discovery", async () => {
  const engine = new Engine(":memory:");
  const token = "isolated-http-story-test-token-32";
  const listener = await listenHttp(engine, { port: 0, token });
  const client = new Client({ name: "http-story", version: "1" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${listener.address().port}/mcp`),
        { requestInit: { headers: { authorization: `Bearer ${token}` } } },
      ),
    );
    const result = await playDemo(client, () => {});
    assert.equal(result.main.revision, 5);
    assert.equal(result.main.state.location, "East bank shelter");
    assert.equal(result.alternative.state.resources.coins, 6);
  } finally {
    await client.close();
    await new Promise((resolve) => listener.close(resolve));
    engine.close();
  }
});
