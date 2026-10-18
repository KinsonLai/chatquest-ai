import assert from "node:assert/strict";
import { Engine } from "../src/engine.mjs";
const engine = new Engine(":memory:");
try {
  const c = engine.call("create_campaign", {
      name: "A signal with two futures",
      template: "signal",
      idempotency_key: "demo-create",
    }),
    s = { campaign_id: c.campaign_id, branch_id: "main" };
  console.log("BRANCHWRIGHT — one model, two futures, real receipts\n");
  console.log("1. CREATE  The Quiet Signal / main / revision0");
  const p = engine.call("prepare_turn", {
    ...s,
    player_action:
      "Inspect the receiver. Keep the finding private until I decide what to tell Ren.",
    query: "receiver",
  });
  console.log(`2. RETRIEVE ${p.canon.hits[0].citation}`);
  const r = engine.call("roll_check", {
    ...s,
    preparation_id: p.preparation_id,
    check_id: "receiver",
    purpose: "Decode the interrupted call",
    attribute: "insight",
    difficulty: "standard",
    stakes: "The message remains fragmentary; no automatic fuel loss.",
  });
  console.log(
    `3. ROLL    d20=${r.check.die} + ${r.check.modifier} = ${r.check.total}, DC${r.check.dc}: ${r.check.outcome}`,
  );
  const finding = r.check.success
    ? "A clean call sign"
    : "An incomplete call sign";
  const a = {
    ...s,
    expected_revision: p.revision,
    preparation_id: p.preparation_id,
    player_action: p.player_action,
    policy_sha256: p.policy_sha256,
    check_context_sha256: r.check_context_sha256,
    idempotency_key: "demo-turn",
    narration: r.check.success
      ? "The receiver yields a call sign. Ren waits by the dock; you have not told them the finding."
      : "The receiver cannot resolve the whole message. Ren waits at the dock, unaware of what little you recovered.",
    summary: "Inspected the receiver; retained private information.",
    outcome: {
      resolved_action: "Inspected the receiver",
      consequence: finding + " recorded privately",
      next_decision: "Tell Ren or investigate alone",
    },
    changes: { elapsed_minutes: 60 },
    fact_updates: [
      {
        key: "decoded_signal",
        value: finding,
        basis: "Result of this receiver inspection",
        known_by: ["player"],
      },
    ],
  };
  const receipt = engine.call("commit_turn", a);
  assert.deepEqual(engine.call("commit_turn", a), receipt);
  console.log(
    `4. COMMIT  revision${receipt.revision}; exact retry returns the same event`,
  );
  assert.equal(
    engine.call("get_knowledge", { ...s, viewer: "ren" }).facts.decoded_signal,
    undefined,
  );
  console.log("5. KNOW    Player knows the finding. Ren does not.");
  const fork = engine.call("create_branch", {
    ...s,
    from_revision: 0,
    name: "Leave the receiver alone",
    premise: "Try the service hatch first",
    idempotency_key: "demo-fork",
  });
  assert.equal(engine.call("get_state", s).revision, 1);
  assert.equal(
    engine.call("get_state", {
      campaign_id: c.campaign_id,
      branch_id: fork.branch_id,
    }).revision,
    0,
  );
  console.log(
    "6. FORK    Alternative starts at revision0. Main remains revision1.",
  );
  console.log(
    "\n" +
      receipt.snapshot.markdown +
      "\n\nThis is an engine demonstration, not an actual LLM playthrough. Dice vary; assertions are real.",
  );
} finally {
  engine.close();
}
