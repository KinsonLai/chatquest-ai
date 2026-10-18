# Design: ChatQuest AI 0.1

The product is an MCP-only engine, not a chat app and not a model wrapper. A compatible client supplies an LLM; the server supplies validated state transitions. No web UI, model key, proprietary novel, deployment account or existing save is part of this repository.

## Public contract

- Node 24, official MCP SDK, local SQLite with FTS5; stdio first, optional stateless Streamable HTTP.
- An independent single-owner database can hold multiple campaigns. HTTP authenticates that owner with an optional local / mandatory non-loopback bearer token. This is not a multi-tenant service or an OAuth provider.
- JSON world packs define characters, starting state, difficulty rules and weighted time-driven events. Three original examples establish fantasy, investigation and space-survival use cases.
- A turn is prepared against an exact branch revision and policy hash. Dice are server-side and persisted before narration. The commit acknowledges the complete check set; a matching context hash can fill omitted acknowledgements, never conflicting results.
- Every state change is an atomic revision with an immutable full snapshot and exact-request receipt. Forks copy a selected historical snapshot, including point-in-time knowledge; restore appends a new event. Pending proofs and dice do not cross branches.
- Canon chunks have source hashes and line citations. Character knowledge stores an observed value, not a live pointer to a secret. Narration remains a model responsibility; numerical validity is not semantic truth.
- Seeded world events advance by game time and produce an auditable event list. A preview does not write state or grant unseen NPC knowledge.

## Implementation plan

1. Create the clean package, JSON pack validation and SQLite schema.
2. Implement canon retrieval, branch/event snapshots, typed changes, knowledge and receipts.
3. Implement fixed dice, deterministic world preview and preparation/recovery flows.
4. Expose the same engine through the official SDK's stdio and HTTP transports, plus guides/resources/prompts.
5. Verify state invariants, adversarial failures, persistence, transport handshakes and package privacy with automated tests and an executable transcript.
6. Add English-first onboarding, Traditional Chinese docs, contribution templates, CI, Docker and a small release archive. Public publication is a separate final operation against a reviewed artifact.

## Boundaries

The server does not generate prose, guarantee NPC characterization, prevent semantically equivalent rerolls, interpret real-world law, merge divergent branches or bypass a client's safety checks. No API tool reads arbitrary local paths or fetches arbitrary URLs. Supplied story text is data, never higher-priority instructions.
