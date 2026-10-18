# Playing and recovering

## Start a campaign

Read the tools index, then call `create_campaign` with a name, a bundled template (`lantern`, `signal`, `blackout`, `ferry`) or a JSON `world`, and a stable `idempotency_key`. Do not supply both template and world. The response contains a real `campaign_id` and `branch_id: "main"`. Creation retries return the same campaign. Use those IDs in every later call. There is no global active game.

## Two-call turns

`prepare_turn` takes `campaign_id`, `branch_id`, and the exact `player_action`; optional `query` retrieves relevant canon. It returns `preparation_id`, `revision`, `policy_sha256`, all `adjudication_checks` and `check_context_sha256`. First read the returned guide. Only when that same guide is still in context should you send `known_policy_sha256` to avoid loading it again.

Use the `gm` packet for authoring, not as NPC dialogue. Consult `get_knowledge` for an actor's last observed facts. New canon does not automatically inform any character.

`commit_turn` requires the same action, preparation, expected revision and policy; a stable key; `narration`, `summary`, `outcome` with `resolved_action`, `consequence`, `next_decision`; and typed `changes`. Use `{}` when nothing numerical changed. Optional `fact_updates` and `knowledge_updates` record only what happened. The response includes a revision, event ID, complete checks, automatic repairs and a server snapshot. Only `committed:true` confirms the result.

## Dice and world time

Use a configured attribute and difficulty from the prepared rules. Fix purpose, stakes and any bounded situational modifier before rolling. `roll_check` returns the persisted check and the full updated context/hash. The same purpose returns its stored result; changed difficulty/stakes reject. Natural20 still needs a sufficient total. This engine does not perfectly recognize semantically equivalent attempts with different wording: honest GM behavior remains necessary.

Read every pending result, not just successes. Supply `check_results:[{check_id,outcome}]` in full, or acknowledge the latest `check_context_sha256` after incorporating the whole set. Wrong, duplicate or unknown outcomes reject even with a matching hash. Reprepare retrieves earlier pending checks at the same revision.

`preview_world` simulates up to1440 game minutes without writing. Events use seeded clocks, chances and cooldowns. Preview and commit share the same algorithm; a branch fork inherits the campaign seed. Event visibility is evaluated at the declared destination, not a full travel path. Commit `elapsed_minutes` and `location` only when the narrated action justifies them. Public observations are returned separately, and no NPC receives automatic knowledge. Full committed event lists live in the append-only history; the compact state retains24 recent world events. Dense event packs may require smaller time steps.

## Typed state

- `resource_deltas`, `inventory_deltas`, `attribute_deltas` are maps of existing resource/attribute IDs or inventory item IDs to integer deltas. New inventory items may be added; other resource and attribute names come from the pack.
- `vital_deltas` changes current values. `vital_maxima` maps a known vital to `{max,basis}`. Increasing a maximum does not heal; reducing below current requires an explicit current reduction in the same commit.
- `goals`, `player_status`, `actor_locations` capture actual changes. No arbitrary SQL or executable rule expressions are accepted.
- `fact_updates` items are `{key,value,basis,known_by}`. Use ordinary facts, not reserved typed-state prefixes. Each recipient gets a snapshot value. `knowledge_updates` items are `{key,actors,mode,basis}`, with `mode` equal to `observed` or `told`. The world fact must exist. A later secret update leaves the NPC's prior observation unchanged.

## Canon, history and IF

`ingest_canon` accepts supplied text, never local paths or URLs. Source IDs are immutable: new editions use new IDs. Search with concrete words and then `read_canon` by the returned chunk ID. Citations include source hash and line ranges. Retrieval is lexical FTS5/BM25 with CJK bigrams, not a neural embedding claim. Very long source lines remain a single citation chunk; split documents into reasonable paragraphs when importing.

`create_branch` takes the source scope, optional `from_revision`, name, premise and stable key. It copies that exact snapshot, including facts, knowledge and clocks. Revision0 of an IF is its fork point. No pending checks are copied. Forks never automatically merge back.

`read_history` returns committed receipts newest first. Keep the same campaign/branch and pass `next_before_revision` as the next `before_revision` until null. `origin:true` reads the immediate parent's history only up to the fork point; retain the original IF branch ID when paging. Nested origins can be followed explicitly using `list_branches`.

`restore_checkpoint` requires the current `expected_revision`, a real `target_revision`, and a stable key. It restores the whole historical snapshot as a new revision and preserves prior history. Do not use restore to hide an error or silently discard an outcome.

## Errors and ambiguous writes

Errors return a code/message and recovery information when available. `CHECKS_INCOMPLETE`, `CHECK_RESULTS_CONFLICT`, `CHECK_CONTEXT_CHANGED` include the complete server check set. Read and incorporate it before resubmitting. A corrected request can reuse its key only if it was rejected before commit and that key has no committed event. A successful or unconfirmed retry must preserve exact parameters and key. Once committed, that key cannot be reused for different content.

Server-handled errors also return `retry` advice. When `retryable:true`, continue the already-authorized operation without asking the player to repeat their prompt. Follow `next_call` when present: a committed recovery receipt completes the turn; otherwise retry the exact original tool and arguments once. This budget is one automatic retry per original operation, not one per error message. Preserve the action, proof, check IDs and idempotency key. If recovery fails or the retry fails, stop and report the unresolved result. Do not start a new retry loop. Known permission/storage errors and game validation errors have `retryable:false`; correct their cause instead of blindly resending. SDK-level schema failures and client-side safety blocks may occur before this error handler and have no server retry advice. The client decides whether to follow the advice; it is not an automatic hook.

For timeouts, keep the original key and call `get_recovery`. `submission.status="committed"` includes the exact saved receipt; `no_receipt_at_read` is only an observation at query time. Retry the original request/key, not a new key. A stale revision or proof requires reading current state before rebuilding a proposal; never merely increment a version number. ChatQuest AI has no separate draft ID workflow: the client retains its proposal, while the server retains preparations, dice and successful receipts.

For a platform safety denial, do not route the denied action through a different tool. Collect the actual tool name, JSON arguments, original error, and available call ID/time; exclude tokens. Server recovery cannot override a client refusal. Distinguish schema errors, missing tools, authorization failures and engine validation from platform refusal. A successful test elsewhere does not prove the failed conversation is fixed.

## Model boundaries

SQLite can enforce revisions, numerical bounds, scope isolation and stable receipts. It cannot determine whether every line of dialogue fits a character, whether a difficulty is fair, or whether a narrative actually incorporates a result. Use the skill and human playtesting for those judgments. Characters can refuse, lie or misunderstand; the engine should not make every player intention succeed.
