import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { VERSION } from "../src/version.mjs";
const cli = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));
const run = (...args) =>
  spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    timeout: 20000,
  });
test("CLI identifies the installed release and explains quiet stdio startup", () => {
  assert.equal(run("--version").stdout.trim(), VERSION);
  const help = run("--help");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /waits for an MCP client/);
  assert.match(help.stdout, /--demo/);
});
test("demo cannot silently use a real campaign database", () => {
  const r = run("--demo", "--db", "must-not-create.sqlite");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /temporary save/);
});
test("packaged CLI demo plays a fresh story to resolution over an actual stdio child", () => {
  const r = run("--demo");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /THE LAST FERRY/);
  assert.match(r.stdout, /revision 5/);
  assert.match(r.stdout, /Completed: everyone reached/);
  assert.match(r.stdout, /IF: return to the first decision/);
  assert.match(r.stdout, /unchanged main/);
});
