# Live tool map

The server exposes17 tools. `read_guide(section="tools")` generates exact schemas from the registered definitions. Add `tool_name` for one tool; do not infer optional or nested fields from this summary.

| Group                  | Tools                                                        |
| ---------------------- | ------------------------------------------------------------ |
| Operating skill        | `read_guide`                                                 |
| Campaigns and settings | `create_campaign`, `list_campaigns`                          |
| Canon/RAG              | `ingest_canon`, `search_canon`, `read_canon`                 |
| Branches               | `create_branch`, `list_branches`                             |
| State and knowledge    | `get_state`, `get_knowledge`                                 |
| Turn lifecycle         | `prepare_turn`, `roll_check`, `preview_world`, `commit_turn` |
| Recovery and history   | `get_recovery`, `read_history`, `restore_checkpoint`         |

All branch operations explicitly require `campaign_id` and `branch_id`. Read-only annotations reflect behavior: preparation writes a proof, rolling persists a result, and ingestion changes canon. Neither an annotation nor a skill grants permission to bypass client approval.

Resources: `branchwright://guide`, `branchwright://packs/lantern`, `branchwright://packs/signal`, `branchwright://packs/blackout`, `branchwright://packs/ferry`. Prompt: `start-adventure` with optional `genre`.
