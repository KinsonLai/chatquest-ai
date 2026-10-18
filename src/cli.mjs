#!/usr/bin/env node
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Engine } from "./engine.mjs";
import { createMcpServer, listenHttp } from "./server.mjs";
import { VERSION } from "./version.mjs";
const { values } = parseArgs({
  options: {
    http: { type: "boolean" },
    port: { type: "string" },
    host: { type: "string" },
    db: { type: "string" },
    help: { type: "boolean" },
    version: { type: "boolean" },
    demo: { type: "boolean" },
  },
});
if (values.help) {
  console.log(
    "Branchwright MCP\n  branchwright [--db path]                stdio (waits for an MCP client)\n  branchwright --http [--port 3333]        Streamable HTTP\n  branchwright --demo                     fresh five-scene story and IF replay; temporary save\nDefault save: .branchwright/state.sqlite in the working directory. Use an absolute --db path to resume reliably.\nEnvironment: BRANCHWRIGHT_DB, BRANCHWRIGHT_TOKEN, BRANCHWRIGHT_ALLOWED_HOSTS",
  );
  process.exit(0);
}
if (values.version) {
  console.log(VERSION);
  process.exit(0);
}
if (values.demo) {
  if (values.http || values.db || values.port || values.host) {
    console.error(
      "--demo uses a temporary save; do not combine it with server options.",
    );
    process.exit(1);
  }
  const { runDemo } = await import("./demo.mjs");
  await runDemo();
  process.exit(0);
}
const filename =
    values.db ??
    process.env.BRANCHWRIGHT_DB ??
    resolve(".branchwright/state.sqlite"),
  engine = new Engine(filename);
try {
  if (values.http) {
    const port = Number(values.port ?? 3333);
    if (!Number.isInteger(port) || port < 0 || port > 65535)
      throw Error("Invalid port.");
    const listener = await listenHttp(engine, {
      host: values.host ?? "127.0.0.1",
      port,
      token: process.env.BRANCHWRIGHT_TOKEN,
      allowedHosts: (process.env.BRANCHWRIGHT_ALLOWED_HOSTS ?? "")
        .split(",")
        .filter(Boolean),
    });
    console.error(
      `Branchwright MCP listening on ${JSON.stringify(listener.address())}; no web UI.`,
    );
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, () =>
        listener.close(() => {
          engine.close();
          process.exit(0);
        }),
      );
  } else {
    const server = createMcpServer(engine);
    server.onclose = () => engine.close();
    await server.connect(new StdioServerTransport());
  }
} catch (error) {
  console.error(error.message);
  engine.close();
  process.exitCode = 1;
}
