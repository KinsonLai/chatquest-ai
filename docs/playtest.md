# Gameplay verification

## Model-led session: The Last Ferry

On 2026-10-18, the Codex assistant played a fresh, isolated campaign through **31 actual MCP calls and seven committed scenes**: five main scenes, then two scenes on an IF branch. It chose test-player actions and wrote GM responses after reading the server results. The prewritten demo was not used to generate this session. Because one assistant played both roles, this is a bounded operating test, not an independent blind evaluation.

The development driver used the official MCP SDK and a real stdio child process. Each driver invocation restarted the server against the same isolated SQLite file, exercising continuation across process restarts. The test never opened another campaign database.

- [Unedited committed story, checks and snapshots](playtests/ferry-session.md)
- [Full timestamped MCP requests and responses](playtests/ferry-session.json)
- Driver: `scripts/session-client.mjs`, with an explicit `--db` and optional `--record` journal; send `{name,arguments}` JSON on stdin. The journal can contain GM secrets, so only publish intentionally public test settings.

| Scene | What the player tried                      | What happened                                                                                                                            |
| ----- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Main1 | Return the lantern and inspect the ring    | Jun uses his boat experience to show the split. Ada refuses an unsecured launch. Lantern leaves player inventory.                        |
| Main2 | Read the dispatch privately                | d20=2, +3, DC12: failure. Only a fragment is recovered. Robin does not learn the gate number or author. Neither NPC learns the contents. |
| Main3 | Buy and fit a replacement ring             | d20=13, +2, DC12: success. Coins6→4, rope2→1, patch1→0. Flood covers the lower steps at game minute15.                                   |
| Main4 | Cross and secure the landing               | d20=15, +2, DC12: success. The remaining rope secures the boat and leaves inventory. Everyone reaches the east bank.                     |
| Main5 | Enter the shelter; privately brief Ada     | The evacuation objective completes at minute40. Ada learns only the recovered fragment through a recorded `told` grant. Jun does not.    |
| IF1   | From main revision1, ask Jun to swim       | Jun refuses in line with the pack. No persuasion roll forces compliance. Supplies remain intact.                                         |
| IF2   | Accept the refusal and use the high bridge | The alternative reaches the shelter at minute36 with coins6, rope2 and patch1, without discovering the dispatch.                         |

After playing the IF, the main's complete GM state matched its pre-fork state, including its hash `c7ebe44e5f822350b696bc627d98c04ac83f7a1f9020afc00da3e23379a3dbfa`, revision5, resources and actor knowledge. The IF ended at revision2 with hash `2ccb4a0da20a43384908b99e2cccec1de6713778a9f8b0c713d1c69e3be2ed75`.

For recovery, the driver deliberately discarded the display of main3's commit response, then stopped. A new server process returned the same saved event through `get_recovery` using the original key. This tests recovery of a lost client-visible response, not a crash during SQLite commit. Final state, all three rolls, the two actors' knowledge and the receipts were checked against the recorded results.

### Prose review

Jun speaks about the mooring and his willingness to swim; he does not diagnose harbour-office decisions. Ada speaks as the ferrymaster, insists on a secure launch and declines to accuse anyone from an incomplete sentence. Dialogue answers the immediate request rather than repeating the ledger. Each scene changes a decision, information, supplies, position or objective.

One unsupported aside remains in the raw main5 receipt: it says Jun knows Robin brought something from the hut, without establishing his observation of the scrap. The aside should be deleted in an edited story. It is retained in the unedited transcript and is absent from the packaged replay. No dispatch-content grant or dialogue leak to Jun occurred. This is a prose-review finding, so the session is **not** evidence of perfect semantic compliance. The database cannot detect every unsupported narrative claim.

## Runnable story replay

`--demo` starts a new in-memory MCP server, introduces the quay scene, plays five scenes to the shelter, then plays a bridge-first IF. It uses authored, conditional prose and actual server dice. It is labelled a scripted replay and makes no model API call.

It checks exact commit retries, receipt recovery, complete check lists, canon retrieval, event previews versus saved events, private NPC knowledge, fork inventory and preservation of the complete main state. It never uses `BRANCHWRIGHT_DB` or a formal save.

Automated story tests force d20=1 and d20=20 through the engine's test injection to cover both full failure and full success routes. These fixed rolls are test fixtures, not live randomness or claims that every failed attempt must still succeed. The failure route loses supplies and health, retreats from the landing and reaches the shelter by the high bridge.

## Release checks

The suite has 20 tests, including full story routes over MCP, a complete authenticated HTTP game, the CLI demo over an actual stdio child, saved-state reopening and the original numerical, scope, canon and recovery invariants. Run:

```sh
npm ci --ignore-scripts
npm test
npm run demo
npm run format:check
npm run check:release
npm run check:package
```

CI runs on Windows, Linux and macOS. The release package is also launched with `npx` from a fresh npm cache; see [release notes](releases/v0.2.0.md) for the final distribution check.

## What this does not establish

The SDK/CLI and model-led tests do not prove account-level ChatGPT, Claude or Grok connection, tool approvals or UI behavior. The [client guide](clients.md) is sourced from official documentation, with authentication prerequisites called out. Docker execution and a production OAuth gateway remain unverified. This short scenario does not establish fairness, characterization or reliability across an indefinitely long campaign.
