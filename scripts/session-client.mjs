// Development driver: one JSON {name, arguments} (or an array) on stdin.
// Each invocation starts a fresh real stdio server, so using the same --db tests resumption.
import { parseArgs } from "node:util";
import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const { values } = parseArgs({
  options: { db: { type: "string" }, record: { type: "string" } },
});
if (!values.db)
  throw Error("Supply an explicit --db for this development driver.");
const parts = [];
for await (const part of process.stdin) parts.push(part);
const input = JSON.parse(
  Buffer.concat(parts)
    .toString("utf8")
    .replace(/^\uFEFF/, ""),
);
const client = new Client({ name: "model-playtest-driver", version: "1" });
try {
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [
        fileURLToPath(new URL("../src/cli.mjs", import.meta.url)),
        "--db",
        values.db,
      ],
      stderr: "inherit",
    }),
  );
  for (const request of Array.isArray(input) ? input : [input]) {
    const result = await client.callTool(request);
    if (values.record)
      appendFileSync(
        values.record,
        JSON.stringify({ time: new Date().toISOString(), request, result }) +
          "\n",
      );
    console.log(
      JSON.stringify({
        tool: request.name,
        isError: result.isError ?? false,
        result: result.structuredContent ?? result.content,
      }),
    );
    if (result.isError) process.exitCode = 1;
  }
} finally {
  await client.close();
}
