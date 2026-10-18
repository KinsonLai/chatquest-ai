import { z } from "zod";
const text = (max = 500) => z.string().trim().min(1).max(max),
  id = text(100),
  key = text(120),
  json = z.json();
const scope = { campaign_id: id, branch_id: id };
const checkFields = {
  check_id: id,
  purpose: text(400),
  attribute: text(80),
  difficulty: text(80),
  situational: z.number().int().min(-5).max(5).default(0),
  basis: text(500).optional(),
  stakes: text(500),
};
const previewFields = {
  elapsed_minutes: z.number().int().min(0).max(1440),
  destination: text(200).optional(),
};
const numbers = z.record(text(80), z.number().int().min(-1000000).max(1000000));
const vital = z
  .object({
    current: z.number().int().min(0).max(1000000),
    max: z.number().int().min(1).max(1000000),
  })
  .strict()
  .refine((v) => v.current <= v.max, "Current exceeds maximum");
export const World = z
  .object({
    id: text(80),
    name: text(100),
    genre: text(100),
    premise: text(3000),
    player: z
      .object({
        name: text(100),
        attributes: z.record(text(80), z.number().int().min(-10).max(30)),
        vitals: z.record(text(80), vital),
      })
      .strict(),
    actors: z
      .record(
        text(80),
        z
          .object({
            name: text(100),
            age: z.number().int().min(0).max(100000).optional(),
            experience: z.array(text(400)).max(12).default([]),
            intent: text(500),
            location: text(200),
          })
          .strict(),
      )
      .default({}),
    initial: z
      .object({
        location: text(200),
        resources: z.record(text(80), z.number().int().min(0).max(1000000)),
        inventory: z
          .record(text(80), z.number().int().min(0).max(10000))
          .default({}),
        goals: z.array(text(500)).max(20).default([]),
      })
      .strict(),
    rules: z
      .object({
        difficulties: z.record(text(80), z.number().int().min(1).max(100)),
        checks_per_turn: z.number().int().min(1).max(10).default(3),
        tick_minutes: z.number().int().min(1).max(1440).default(60),
      })
      .strict(),
    events: z
      .array(
        z
          .object({
            id: text(80),
            title: text(120),
            description: text(500),
            chance: z.number().min(0).max(1),
            locations: z.array(text(200)).max(20),
            cooldown_minutes: z.number().int().min(1).max(100000),
            visibility: z.enum(["public", "gm"]),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    canon: z
      .array(
        z
          .object({ id: text(100), title: text(200), text: text(100000) })
          .strict(),
      )
      .max(30)
      .default([]),
  })
  .strict();
const changes = z
  .object({
    location: text(200).optional(),
    elapsed_minutes: z.number().int().min(0).max(1440).optional(),
    goals: z.array(text(500)).max(20).optional(),
    resource_deltas: numbers.optional(),
    inventory_deltas: numbers.optional(),
    attribute_deltas: numbers.optional(),
    vital_deltas: numbers.optional(),
    vital_maxima: z
      .record(
        text(80),
        z
          .object({
            max: z.number().int().min(1).max(1000000),
            basis: text(500),
          })
          .strict(),
      )
      .optional(),
    player_status: text(500).optional(),
    actor_locations: z.record(text(80), text(200)).optional(),
  })
  .strict();
const ack = z
  .object({
    check_id: id,
    outcome: z.enum([
      "critical_success",
      "success",
      "costly_success",
      "near_miss",
      "failure",
    ]),
  })
  .strict();
const def = (description, schema, write = false) => ({
  description,
  schema,
  annotations: {
    readOnlyHint: !write,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
});
export const definitions = {
  read_guide: def(
    "Read the operating skill, workflows, pack format, or live tool schemas. No save changes.",
    z
      .object({
        section: z
          .enum(["overview", "workflows", "packs", "tools"])
          .default("overview"),
        tool_name: id.optional(),
      })
      .strict(),
  ),
  create_campaign: def(
    "Create an independent campaign from a bundled template or a supplied JSON world pack. Reuse the creation key on retries.",
    z
      .object({
        name: text(100),
        template: z.enum(["lantern", "signal", "blackout", "ferry"]).optional(),
        world: World.optional(),
        idempotency_key: key,
      })
      .strict(),
    true,
  ),
  list_campaigns: def(
    "List campaigns in this owner database.",
    z.object({}).strict(),
  ),
  ingest_canon: def(
    "Store supplied story text with hashes and line citations. No file or URL access. Existing source IDs are immutable; new editions need new IDs.",
    z
      .object({
        campaign_id: id,
        documents: z
          .array(
            z
              .object({ id: text(100), title: text(200), text: text(100000) })
              .strict(),
          )
          .min(1)
          .max(20),
      })
      .strict(),
    true,
  ),
  search_canon: def(
    "Search local canon using FTS5/BM25, including CJK bigrams. Read hits before citing; a miss is not proof of absence.",
    z
      .object({
        campaign_id: id,
        query: text(500),
        limit: z.number().int().min(1).max(8).default(4),
      })
      .strict(),
  ),
  read_canon: def(
    "Read an exact canon chunk and its hash/line citation.",
    z.object({ campaign_id: id, chunk_id: id }).strict(),
  ),
  create_branch: def(
    "Fork a current or historical snapshot. Copies point-in-time knowledge; never changes the source. Premise is an intention, not an accomplished event.",
    z
      .object({
        ...scope,
        from_revision: z.number().int().min(0).optional(),
        name: text(100),
        premise: text(1000),
        idempotency_key: key,
      })
      .strict(),
    true,
  ),
  list_branches: def(
    "List explicit branch IDs and origin revisions. There is no global active branch.",
    z.object({ campaign_id: id }).strict(),
  ),
  get_state: def(
    "Read branch state and revision. player view hides GM facts; gm view includes the authoritative ledger.",
    z
      .object({ ...scope, viewer: z.enum(["player", "gm"]).default("player") })
      .strict(),
  ),
  get_knowledge: def(
    "Read the last observed values known to one actor, player, or gm. NPC values do not follow secret world changes.",
    z.object({ ...scope, viewer: text(80) }).strict(),
  ),
  prepare_turn: def(
    "Prepare an exact player action; returns state, canon text, character knowledge, policy and all checks. Optional checks persist predeclared dice (requires expected_revision); optional world_preview includes events. Saves round trips, never commits the story.",
    z
      .object({
        ...scope,
        player_action: text(2000),
        query: text(500).optional(),
        known_policy_sha256: text(64).optional(),
        expected_revision: z.number().int().min(0).optional(),
        checks: z.array(z.object(checkFields).strict()).max(10).optional(),
        world_preview: z.object(previewFields).strict().optional(),
      })
      .strict(),
    true,
  ),
  roll_check: def(
    "Persist a server d20 result with fixed purpose, difficulty and stakes. No rerolling a purpose. Returns the complete check set and context hash.",
    z
      .object({
        ...scope,
        preparation_id: id,
        ...checkFields,
      })
      .strict(),
    true,
  ),
  preview_world: def(
    "Preview deterministic time-driven world events without changing the save or granting NPC knowledge.",
    z
      .object({
        ...scope,
        ...previewFields,
      })
      .strict(),
  ),
  commit_turn: def(
    "Atomically validate and commit the authorized scene. Preserve exact arguments/key on an unconfirmed retry. Only a committed receipt means success.",
    z
      .object({
        ...scope,
        expected_revision: z.number().int().min(0),
        preparation_id: id,
        player_action: text(2000),
        policy_sha256: text(64),
        check_context_sha256: text(64).optional(),
        check_results: z.array(ack).max(10).optional(),
        idempotency_key: key,
        narration: text(12000),
        summary: text(500),
        outcome: z
          .object({
            resolved_action: text(500),
            consequence: text(500),
            next_decision: text(500),
          })
          .strict(),
        changes: changes.default({}),
        fact_updates: z
          .array(
            z
              .object({
                key: text(100),
                value: json,
                basis: text(500),
                known_by: z.array(text(80)).max(20),
              })
              .strict(),
          )
          .max(20)
          .default([]),
        knowledge_updates: z
          .array(
            z
              .object({
                key: text(100),
                actors: z.array(text(80)).min(1).max(20),
                mode: z.enum(["observed", "told"]),
                basis: text(500),
              })
              .strict(),
          )
          .max(20)
          .default([]),
      })
      .strict(),
    true,
  ),
  get_recovery: def(
    "Read every pending check and look up an exact committed receipt by original key. No receipt at read time is not permission to replay with a new key.",
    z.object({ ...scope, idempotency_key: key.optional() }).strict(),
  ),
  read_history: def(
    "Read complete committed events, newest first. Follow next_before_revision without changing branch. Origin history is separate and clamped to the fork point.",
    z
      .object({
        ...scope,
        before_revision: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).max(10).default(5),
        origin: z.boolean().default(false),
      })
      .strict(),
  ),
  restore_checkpoint: def(
    "Only when the player explicitly requests it: append a revision restoring a saved snapshot, including knowledge and world clocks. Never erase history.",
    z
      .object({
        ...scope,
        expected_revision: z.number().int().min(0),
        target_revision: z.number().int().min(0),
        idempotency_key: key,
      })
      .strict(),
    true,
  ),
};
export function toolCatalogue() {
  return Object.entries(definitions).map(([name, d]) => ({
    name,
    description: d.description,
    inputSchema: z.toJSONSchema(d.schema, { target: "draft-7" }),
    annotations: d.annotations,
  }));
}
export class GameError extends Error {
  constructor(code, message, recovery) {
    super(message);
    this.code = code;
    this.recovery = recovery;
  }
}
export const fail = (code, message, recovery) => {
  throw new GameError(code, message, recovery);
};
