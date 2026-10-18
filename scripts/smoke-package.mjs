// Keep this outside `npm test`: it installs into an isolated fresh npm cache.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { VERSION } from "../src/version.mjs";
const npmCli = process.env.npm_execpath;
if (!npmCli) throw Error("Run via npm run check:package [-- package-spec].");
const dir = mkdtempSync(join(tmpdir(), "branchwright-package-"));
const npm = (args, options = {}) =>
  execFileSync(process.execPath, [npmCli, ...args], {
    encoding: "utf8",
    timeout: 120000,
    ...options,
  });
const spec =
  process.argv[2] ??
  join(
    dir,
    JSON.parse(npm(["pack", "--pack-destination", dir, "--json"]))[0].filename,
  );
const sentinel = join(dir, "formal-save-must-not-exist.sqlite");
const options = {
  cwd: dir,
  env: { ...process.env, CHATQUEST_DB: sentinel, BRANCHWRIGHT_DB: sentinel },
};
const args = [
  "exec",
  "--yes",
  "--cache",
  join(dir, "cache"),
  "--package=" + spec,
  "--",
  "chatquest",
];
const output = npm([...args, "--demo"], options);
assert.match(output, /THE LAST FERRY/);
assert.match(output, /revision 5/);
assert.match(output, /IF: return to the first decision/);
assert.match(output, /unchanged main/);
assert.equal(existsSync(sentinel), false);
assert.equal(npm([...args, "--version"], options).trim(), VERSION);
assert.equal(
  npm([...args.slice(0, -1), "branchwright", "--version"], options).trim(),
  VERSION,
);
console.log(
  "PASS: isolated-cache package install, complete MCP story and IF, version, configured formal save untouched.",
);
console.log(
  "Temporary package/cache retained in the OS temp directory for inspection.",
);
