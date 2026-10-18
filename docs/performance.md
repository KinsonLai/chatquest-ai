# Fewer waits between scenes

The client model writes the story; ChatQuest AI reads and saves its state. Cutting tool round trips can reduce the wait before narration. It does not increase the model's token-generation speed.

## Bundle what is already decided

From a confirmed revision, `prepare_turn` can retrieve state and canon, persist predeclared checks, and preview a known time step in one call:

```json
{
  "campaign_id": "ACTUAL_CAMPAIGN_ID",
  "branch_id": "main",
  "expected_revision": 0,
  "player_action": "Read the wet dispatch alone.",
  "query": "dispatch",
  "checks": [
    {
      "check_id": "read-dispatch",
      "purpose": "Recover text from the wet dispatch",
      "attribute": "insight",
      "difficulty": "standard",
      "stakes": "Failure recovers only before the bell; no gate or signature."
    }
  ],
  "world_preview": { "elapsed_minutes": 15 }
}
```

These IDs, attributes and stakes are an example for the ferry pack. Use the actual campaign, confirmed revision and applicable rules. First load context with an ordinary preparation if those are not known. If the outcome determines the elapsed time, wait for it and use a separate preview. Dependent checks also stay sequential.

Read the returned guide, state, GM context, canon text and **all** `adjudication_checks`, including failures. Narrate their consequences, then call `commit_turn` with the existing proof, revision, policy and latest check-context hash. This keeps validation and persistence separate from the proposed scene. Only a committed receipt confirms the save.

The batch uses the existing roll and preview implementations inside one transaction. A failed batch leaves no partial proof or new checks in the database. Previously persisted checks remain. An exact repeat reuses recorded dice. A stale `expected_revision` rejects before rolling. Old `prepare_turn` / `roll_check` / `preview_world` calls continue to work.

## Read once when the data is already present

- `prepare_turn.gm.knowledge` contains each character's last observations. Preserve their recorded values; current GM facts do not update them.
- `prepare_turn.canon.hits` includes full chunk text and source citations. Reading that text does not require another tool call for the identical chunk.
- Read the workflows at startup or after losing context. Do not load the entire tool catalogue every scene. Request one tool's schema when needed.
- Send `known_policy_sha256` only while the exact returned guide remains in context. It suppresses repeated guide text, not checks or state. After context loss, omit the hash and reread the guide.
- Keep revision checks, receipt recovery, resource validation and full knowledge boundaries. Do not cache a mutable branch snapshot across turns or discard facts to make a response smaller.

In a local ferry probe, reusing the known policy reduced one prepared JSON payload from 6,684 to 3,428 bytes. That mechanism already existed; the new guidance makes its intended use explicit. Sizes depend on the pack and state.

## Reproduce the protocol benchmark

From a repository checkout with Node 24+ and dependencies installed:

```sh
npm run benchmark
```

The benchmark runs a warm-up, then 30 fixed-outcome turns per path through the official MCP client and actual localhost HTTP. Each turn has one check, a fixed preview and a commit. It asserts failed outcomes, preview/commit event equality and identical final GM state between paths. It uses in-memory SQLite and no formal saves.

One development-machine run:

| Measurement             | Separate tools | Bundled preparation |
| ----------------------- | -------------: | ------------------: |
| Tool calls for 30 turns |            120 |                  60 |
| Request JSON bytes      |         43,410 |              35,990 |
| Response JSON bytes     |        258,114 |             231,774 |
| Median local turn time  |       61.60 ms |            30.71 ms |
| p95 local turn time     |       64.28 ms |            32.93 ms |

Byte counts cover serialized tool requests/results, including the compatibility text and structured result; they exclude HTTP headers. Timings exclude startup and model reasoning. This is a single local protocol measurement, not a claim of twice-as-fast ChatGPT replies. Internet latency, client scheduling and the chosen model can dominate real play. Scenes that need dependent checks or outcome-dependent previews will use more than two calls.

The gameplay tests also play a short story to its shelter ending and an independent IF through MCP, checking that the private clue stays private on the original branch. This validates the state flow; it does not prove a model's dialogue quality or willingness to follow the workflow.
