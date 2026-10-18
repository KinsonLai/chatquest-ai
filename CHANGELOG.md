# Changelog

## 0.4.0

Optional checks and world previews in `prepare_turn` reduce round trips while retaining existing dice, proof and commit validation. Added stale-revision protection for bundled dice, atomic rollback/replay tests, a completed MCP story with an independent IF, and a reproducible localhost HTTP benchmark. Updated the operating workflows to avoid refetching canon text, character knowledge and a policy already in context. Save schema and legacy policy bytes remain unchanged.

## 0.3.1

Server-handled failures now include chat-side retry instructions: recover an existing receipt or retry the exact authorized request once, without making the player repeat their prompt. Validation and permission failures are not marked retryable. Added MCP fault-injection tests for pre-write failure, lost post-commit response, SQLite contention and permanent errors. No change to the save schema or operating-policy bytes. Client-side safety blocks remain outside this handler.

## 0.3.0

Renamed the project and GitHub repository to ChatQuest AI (`chatquest-ai`), with a `chatquest` CLI. Updated current READMEs, client guides and npx release commands. Retained the `branchwright` CLI alias, old environment variables, default save path, resource URIs, operating policy and database schema. Added a v0.2 save/receipt/pending-check compatibility fixture and configuration precedence tests. Historical records keep their original branding.

## 0.2.0

Added the packaged `--demo` command, a fresh ferry world and complete story replay through real MCP calls. Added full success/failure and HTTP story tests, CLI checks, a separate model-led seven-scene transcript with receipts, and sourced English/Traditional Chinese ChatGPT, Claude and Grok connection guides. Updated README copy and one-line npx instructions using the GitHub release artifact. No npm registry or account-level client certification is implied.

## 0.1.0

Initial open-source preview. MCP-only Node/SQLite engine, three original worlds, local canon search, explicit branches, knowledge snapshots, fixed server dice, time-driven events, receipt recovery, operating skill and stdio/HTTP integration tests. No npm registry publication or model-client UI certification is implied by this source release.
