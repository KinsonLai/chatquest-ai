import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { VERSION } from "./version.mjs";

// A branching, author-written replay. It makes real MCP calls but does not call an LLM.
export async function playDemo(client, print = console.log) {
  const checks = [],
    events = [];
  async function call(name, args = {}) {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError)
      throw Error(JSON.stringify(result.structuredContent ?? result.content));
    return result.structuredContent;
  }
  await call("read_guide");
  await call("read_guide", { section: "workflows" });
  const campaign = await call("create_campaign", {
    name: "The Last Ferry: fresh demo",
    template: "ferry",
    idempotency_key: "ferry-demo-create",
  });
  const scope = { campaign_id: campaign.campaign_id, branch_id: "main" };
  print(
    "THE LAST FERRY\nFresh story • scripted replay • live server dice • temporary save\n",
  );
  print(
    "You reach the west quay with Jun's borrowed lantern. A split mooring ring hangs against the ferry. Ada keeps one boot on the gangplank.\n\n'Nobody boards until that line holds,' she says.\n\nJun points at the wet steps. 'It was below the second mark when I got here. Can I have my lamp back?'\n",
  );
  let sequence = 0;
  async function turn(active, action, resolve, check) {
    const p = await call("prepare_turn", {
      ...active,
      player_action: action,
      query: "quay ferry dispatch",
    });
    assert.ok(p.canon.hits.length > 0);
    let context = p;
    let rolled;
    if (check) {
      context = await call("roll_check", {
        ...active,
        preparation_id: p.preparation_id,
        ...check,
      });
      rolled = context.check;
      checks.push(rolled);
      print(
        `[Dice] ${rolled.purpose}: ${rolled.die} + ${rolled.modifier} = ${rolled.total} / DC ${rolled.dc} → ${rolled.outcome}`,
      );
    }
    const scene = resolve(rolled);
    const preview = await call("preview_world", {
      ...active,
      elapsed_minutes: scene.changes.elapsed_minutes ?? 0,
      destination: scene.changes.location ?? p.state.location,
    });
    if (preview.observations.length)
      scene.narration +=
        "\n\n" + preview.observations.map((e) => e.description).join("\n");
    const args = {
      ...active,
      expected_revision: p.revision,
      preparation_id: p.preparation_id,
      player_action: p.player_action,
      policy_sha256: p.policy_sha256,
      check_context_sha256: context.check_context_sha256,
      idempotency_key: `ferry-scene-${++sequence}`,
      ...scene,
    };
    const receipt = await call("commit_turn", args);
    assert.equal(receipt.committed, true);
    assert.deepEqual(receipt.world_events, preview.events);
    assert.deepEqual(await call("commit_turn", args), receipt);
    assert.deepEqual(
      (
        await call("get_recovery", {
          ...active,
          idempotency_key: args.idempotency_key,
        })
      ).submission.receipt,
      receipt,
    );
    events.push(...receipt.world_events);
    print(
      `\nPLAYER: ${action}\n\n${receipt.narration}\n\n${receipt.snapshot.markdown}\n`,
    );
    return { receipt, rolled };
  }
  await turn(
    scope,
    "Return Jun's lantern and ask him to show me the damaged mooring.",
    () => ({
      narration:
        "Jun takes the lantern and holds it under the ring. 'There. It opens when the boat pulls.' He shows you the split without going down the flooded steps.\n\nAda sends him back to the dry bollard. 'Hold that light for Robin. I've got a spare ring, but the mount needs binding too. Two coins for the ring.'\n\nThe empty ticket hut is still above water. You can inspect it before choosing how to cross.",
      summary: "Returned Jun's lantern; located the split ring.",
      outcome: {
        resolved_action: "Examined the mooring with Jun",
        consequence: "Lantern returned; repair requirements established",
        next_decision: "Inspect the hut or repair immediately",
      },
      changes: { elapsed_minutes: 5, inventory_deltas: { lantern: -1 } },
      fact_updates: [
        {
          key: "split_ring",
          value: true,
          basis: "All three examined the split mooring ring",
          known_by: ["player", "jun", "ada"],
        },
      ],
    }),
  );
  const inspected = await turn(
    scope,
    "Read the dispatch in the empty hut alone. Keep its contents private for now.",
    (r) => ({
      narration: r.success
        ? "The carbon underneath the dispatch has stayed dry: Gate Three was opened before the warning bell. The signature has bled through the paper; you cannot name its author. You fold the recovered line into your notebook.\n\nOutside, Jun calls, 'Did you find the ring?' He is waiting by the bollard with Ada. Neither has seen the dispatch."
        : "You lift the wet dispatch and the bottom edge tears away. Only 'before the bell' is readable. You cannot recover a gate number or a signature. You keep the scrap in your notebook.\n\nOutside, Jun calls, 'Did you find the ring?' He is waiting by the bollard with Ada. Neither has seen the dispatch.",
      summary:
        "Inspected the dispatch privately; unrecovered text remains unknown.",
      outcome: {
        resolved_action: "Read the damaged dispatch",
        consequence: r.success
          ? "Recovered the Gate Three reference, but no signature"
          : "Failed to recover the gate number; retained a fragment",
        next_decision:
          "Choose whether to share the finding or address the ferry",
      },
      changes: { elapsed_minutes: 7, inventory_deltas: { dispatch_scrap: 1 } },
      fact_updates: [
        {
          key: "dispatch",
          value: r.success
            ? "Gate Three opened before the warning bell; signature unreadable"
            : "Only 'before the bell' recovered; gate and author unknown",
          basis:
            "Robin inspected the wet dispatch alone; server result limits recovery",
          known_by: ["player"],
        },
      ],
    }),
    {
      check_id: "read-dispatch",
      purpose: "Recover text from the wet dispatch",
      attribute: "insight",
      difficulty: "standard",
      stakes:
        "Failure recovers only 'before the bell'; the gate number and signature cannot be read. No reroll.",
    },
  );
  for (const viewer of ["jun", "ada"])
    assert.equal(
      (await call("get_knowledge", { ...scope, viewer })).facts.dispatch,
      undefined,
    );
  const repaired = await turn(
    scope,
    "Pay Ada for the ring and bind the mount. Do not discuss the dispatch.",
    (r) => ({
      narration: r.success
        ? "Ada takes two coins and fits the spare ring. Your binding holds under the first pull; the patch keeps its edge from cutting the rope.\n\n'Good. Leave that turn where it is,' she says. Jun raises the lantern toward the bow. 'Can I get aboard now?'\n\nAda tests the line once more, then lets him across. She will handle the ferry; you must tend the landing rope."
        : "Ada takes two coins and fits the spare ring, but your binding slides as the ferry pulls. The patch tears and the first rope frays beyond use. The mount is still unsafe.\n\n'We're not launching on that,' Ada says. She points upstream. 'I can tow her along the guide cable. It'll take longer. Keep your other rope for the landing.'\n\nJun stays behind the dry bollard. 'I'm not swimming,' he says. Ada tells him he won't have to.",
      summary: r.success
        ? "Paid for and secured the replacement ring"
        : "Repair failed; paid for the ring and consumed supplies; Ada offers a slower tow",
      outcome: {
        resolved_action: "Attempted mooring repair",
        consequence: r.success
          ? "Ferry ready; 2 coins, one rope and patch consumed"
          : "Mount remains unsafe; supplies consumed and slower tow needed",
        next_decision: "Take the ferry with Ada or use the high footbridge",
      },
      changes: {
        elapsed_minutes: r.success ? 8 : 18,
        resource_deltas: { coins: -2 },
        inventory_deltas: { rope: -1, patch: -1 },
      },
      fact_updates: [
        {
          key: "repair",
          value: r.success ? "secured" : "failed; towline required",
          basis: "All three watched the repair test",
          known_by: ["player", "ada", "jun"],
        },
      ],
    }),
    {
      check_id: "bind-mount",
      purpose: "Bind the replacement mooring mount under load",
      attribute: "craft",
      difficulty: "standard",
      stakes:
        "Spend 2 coins, one rope and one patch either way. Failure leaves the mount unsafe; Ada's slower towline route remains possible and takes ten extra minutes.",
    },
  );
  const crossed = await turn(
    scope,
    "Take Ada's crossing plan and tend the remaining landing rope. Jun stays aboard, away from the rail.",
    (r) => ({
      narration: r.success
        ? "The second rope catches the east-bank bollard. You take its strain while Ada brings the ferry alongside. Jun steps onto dry stone only when she tells him.\n\n'Lamp first,' he says, passing it to Ada before climbing up. Water closes over the place where the boat touched. The shelter door is a short climb above you."
        : "The landing rope snags below the bollard and snaps tight across your hand. You lose two health pulling free. Ada backs the ferry away before the bow strikes the steps. The second rope is lost.\n\nBack at the west quay, Jun clings to the lantern. 'The bridge. Can we do the bridge now?'\n\nAda knots the ferry to the upper post with its own mooring line. 'Yes. We're walking.' The high footbridge is still above the flood.",
      summary: r.success
        ? "Landed on the east bank"
        : "Landing failed; lost rope and 2 health; retreated to use the high bridge",
      outcome: {
        resolved_action: "Attempted the crossing and landing",
        consequence: r.success
          ? "Reached east bank with companions; last rope used"
          : "Returned to west quay injured; high bridge remains open",
        next_decision: "Reach the shelter by the available route",
      },
      changes: {
        elapsed_minutes: 15,
        location: r.success ? "East bank landing" : "West quay",
        inventory_deltas: { rope: -1 },
        vital_deltas: { health: r.success ? 0 : -2 },
        actor_locations: {
          jun: r.success ? "East bank landing" : "West quay",
          ada: r.success ? "East bank landing" : "West quay",
        },
      },
    }),
    {
      check_id: "landing",
      purpose: "Catch the east-bank landing bollard",
      attribute: "agility",
      difficulty: "standard",
      stakes:
        "Use the remaining rope. Failure loses it, costs Robin 2 health and forces a retreat to the west quay; the high footbridge stays open.",
    },
  );
  await turn(
    scope,
    crossed.rolled.success
      ? "Walk up from the landing and open the shelter with Ada."
      : "Take the high footbridge with Ada and Jun, then open the shelter.",
    () => ({
      narration: crossed.rolled.success
        ? "Ada unlocks the shelter. Jun sets his lantern on the windowsill and starts rubbing his wet sleeves. 'Next time, we take the bridge first.'\n\n'Next time, you can tell me before we untie,' Ada says. She gets three blankets from the cupboard. You still have the dispatch scrap; neither companion has read it. Everyone is ashore."
        : "The high footbridge takes half an hour. Ada keeps Jun on the inside of the rail and unlocks the shelter when you reach the east bank.\n\nJun puts his lantern on the windowsill. 'I said I wasn't swimming.'\n\n'And you didn't,' Ada says, handing him a blanket. She leaves another beside your injured hand. You still have the dispatch scrap; neither companion has read it. Everyone is ashore.",
      summary:
        "Completed the crossing objective; unresolved dispatch retained privately.",
      outcome: {
        resolved_action: "Brought everyone into the east bank shelter",
        consequence: "Immediate danger resolved; costs and injuries remain",
        next_decision: "End the chapter or investigate who delayed the bell",
      },
      changes: {
        elapsed_minutes: crossed.rolled.success ? 5 : 30,
        location: "East bank shelter",
        actor_locations: { jun: "East bank shelter", ada: "East bank shelter" },
        goals: [
          "Completed: everyone reached the east bank shelter",
          "Optional: investigate the dispatch without assuming its author",
        ],
      },
    }),
  );
  const main = await call("get_state", { ...scope, viewer: "gm" });
  const fork = await call("create_branch", {
    ...scope,
    from_revision: 1,
    name: "Bridge first",
    premise: "Skip the ticket hut and walk the high footbridge",
    idempotency_key: "ferry-if",
  });
  const alternate = { ...scope, branch_id: fork.branch_id };
  print(
    "IF: return to the first decision and try the bridge before reading the dispatch.\n",
  );
  await turn(
    alternate,
    "Leave the dispatch unread and walk the high footbridge with Jun and Ada.",
    () => ({
      narration:
        "'Bridge, then,' Ada says. She ties the ferry at the upper post before joining you. Jun carries his own lantern and shows you the dry turn onto the bridge.\n\nHalf an hour later, Ada opens the east bank shelter. You have spent no coins or repair supplies. The ticket hut is behind you; you never read its dispatch.",
      summary:
        "Bridge-first alternative reaches the shelter without the dispatch.",
      outcome: {
        resolved_action: "Walked the high bridge",
        consequence:
          "Everyone safe; repair supplies retained; dispatch undiscovered",
        next_decision: "Remain sheltered or seek information later",
      },
      changes: {
        elapsed_minutes: 30,
        location: "East bank shelter",
        actor_locations: { jun: "East bank shelter", ada: "East bank shelter" },
        goals: ["Completed: everyone reached the east bank shelter"],
      },
    }),
  );
  assert.deepEqual(await call("get_state", { ...scope, viewer: "gm" }), main);
  const alternative = await call("get_state", { ...alternate, viewer: "gm" });
  assert.equal(alternative.state.knowledge.player.dispatch, undefined);
  assert.equal(alternative.state.resources.coins, 6);
  assert.equal(alternative.state.inventory.rope, 2);
  for (const viewer of ["jun", "ada"])
    assert.equal(
      (await call("get_knowledge", { ...scope, viewer })).facts.dispatch,
      undefined,
    );
  const history = await call("read_history", { ...scope, limit: 10 });
  print(
    "Verified: five main scenes, one played IF, exact retries, recovered receipts, complete rolls, private dispatch, unchanged main.\nThis is an authored replay with random dice, not a live LLM session. See docs/playtest.md for the separate model-led test.",
  );
  return {
    main,
    alternative,
    checks,
    events,
    history: history.events,
    inspected: inspected.rolled,
    repaired: repaired.rolled,
  };
}

export async function runDemo() {
  const client = new Client({ name: "branchwright-demo", version: VERSION });
  try {
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          fileURLToPath(new URL("cli.mjs", import.meta.url)),
          "--db",
          ":memory:",
        ],
        stderr: "inherit",
      }),
    );
    await playDemo(client);
  } finally {
    await client.close();
  }
}
