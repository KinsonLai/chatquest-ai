import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Engine } from "../src/engine.mjs";
import { runtimeConfig } from "../src/config.mjs";

test("renaming preserves a real v0.2 save, receipt, policy and pending failed check", () => {
  const f = JSON.parse(
    readFileSync(new URL("fixtures/legacy-v0.2.json", import.meta.url), "utf8"),
  );
  const e = new Engine(
    join(mkdtempSync(join(tmpdir(), "chatquest-legacy-")), "legacy.sqlite"),
  );
  try {
    e.store.transaction(() => {
      for (const [table, rows] of Object.entries(f.tables)) {
        for (const row of rows) {
          const keys = Object.keys(row);
          e.store.run(
            `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
            ...Object.values(row),
          );
        }
      }
    });
    assert.deepEqual(
      e.call("get_state", { ...f.scope, viewer: "gm" }),
      f.state,
    );
    assert.deepEqual(
      e.call("get_recovery", {
        ...f.scope,
        idempotency_key: "legacy-saved-turn",
      }).submission.receipt,
      f.receipt,
    );
    const p = f.preparation;
    const r = e.call("get_recovery", f.scope);
    assert.deepEqual(r.adjudication_checks, f.roll.adjudication_checks);
    const saved = e.call("commit_turn", {
      ...f.scope,
      preparation_id: p.preparation_id,
      expected_revision: p.revision,
      player_action: p.player_action,
      policy_sha256: p.policy_sha256,
      check_context_sha256: f.roll.check_context_sha256,
      idempotency_key: "after-rename",
      narration:
        "The wet dispatch yields only a fragment. Jun has not read it.",
      summary: "Failed reading preserved across rename.",
      outcome: {
        resolved_action: "Inspected dispatch",
        consequence: "Gate and author remain unreadable",
        next_decision: "Repair or take the bridge",
      },
      changes: { elapsed_minutes: 7 },
    });
    assert.equal(saved.committed, true);
    assert.equal(saved.revision, 2);
    assert.equal(saved.adjudication_checks[0].outcome, "failure");
    assert.deepEqual(
      e.call("get_recovery", {
        ...f.scope,
        idempotency_key: "legacy-saved-turn",
      }).submission.receipt,
      f.receipt,
    );
  } finally {
    e.close();
  }
});

test("new config names coexist with old settings and keep the default save location", () => {
  const cwd = join(tmpdir(), "chatquest-config");
  assert.equal(
    runtimeConfig({}, {}, cwd).db,
    join(cwd, ".branchwright", "state.sqlite"),
  );
  assert.deepEqual(
    runtimeConfig(
      {},
      {
        BRANCHWRIGHT_DB: "old.sqlite",
        BRANCHWRIGHT_TOKEN: "old-token",
        BRANCHWRIGHT_ALLOWED_HOSTS: "old.example",
      },
      cwd,
    ),
    { db: "old.sqlite", token: "old-token", allowedHosts: ["old.example"] },
  );
  assert.deepEqual(
    runtimeConfig(
      {},
      {
        CHATQUEST_DB: "new.sqlite",
        BRANCHWRIGHT_DB: "old.sqlite",
        CHATQUEST_TOKEN: "new-token",
        BRANCHWRIGHT_TOKEN: "old-token",
        CHATQUEST_ALLOWED_HOSTS: "new.example,other.example",
        BRANCHWRIGHT_ALLOWED_HOSTS: "old.example",
      },
      cwd,
    ),
    {
      db: "new.sqlite",
      token: "new-token",
      allowedHosts: ["new.example", "other.example"],
    },
  );
  assert.equal(
    runtimeConfig(
      { db: "explicit.sqlite" },
      { CHATQUEST_DB: "new.sqlite" },
      cwd,
    ).db,
    "explicit.sqlite",
  );
});
