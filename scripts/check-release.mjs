import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative, join } from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const ignore = new Set(["node_modules", ".git", ".branchwright", "coverage"]);
const forbidden = [
  /[A-Z]:[\\/]Users[\\/]/i,
  /\.chatgpt\.site/i,
  /\b(?:ghp|gho)_[A-Za-z0-9]{20,}\b/,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  /\u592a\u865b\u7d00\u5143|\u6c88\u5b64\u821f|\u8449\u6e05\u79be/u,
];
const errors = [];
let count = 0;
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const path = join(dir, entry.name),
      name = relative(root, path);
    if (entry.isSymbolicLink()) {
      errors.push("Unexpected symlink: " + name);
      continue;
    }
    if (entry.isDirectory()) {
      visit(path);
      continue;
    }
    if (
      /\.(sqlite(?:-.*)?|db|tgz)$/.test(entry.name) ||
      entry.name === ".env" ||
      entry.name.startsWith(".env.")
    ) {
      errors.push("Private/runtime artifact: " + name);
      continue;
    }
    if (statSync(path).size > 2000000) {
      errors.push("Unexpected large file: " + name);
      continue;
    }
    const text = readFileSync(path, "utf8");
    for (const pattern of forbidden)
      if (pattern.test(text)) errors.push("Private material marker: " + name);
    count++;
  }
}
visit(root);
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (pkg.license !== "MIT" || !pkg.files?.includes("skills"))
  errors.push("Package metadata or skill distribution missing.");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Release hygiene passed: ${count} files checked; no save files, credentials, private setting markers or machine paths found. This scan is a release check, not a guarantee of secret detection.`,
  );
