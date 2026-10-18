# Contributing

Start with a small, reproducible change. For mechanics, add a failing invariant test before changing the engine. For a world pack, provide original or properly licensed content and a complete starting ledger. For model behavior, include the actual tool arguments/results with private data removed; a model's explanation of an error is not its raw cause.

Run `npm ci`, `npm test`, `npm run format:check`, `npm run check:release` and `npm run demo` before a PR. Keep the project MCP-only. Do not add a frontend or a model-provider dependency to the core.

Do not contribute live save databases, private manuscripts, tokens or machine-specific configuration. Use a new in-memory fixture for tests. Preserve exact receipt replay, campaign/branch isolation, historical knowledge and source citations. Changing a tool contract requires updating guides and transport tests.

Discuss alternate dice systems, multi-tenant hosting, embeddings and plugin execution in an issue before a large implementation. Keep reviews respectful and focused on reproducible behavior. Publicity is welcome; misleading compatibility claims, fabricated playthroughs and purchased engagement are not.
