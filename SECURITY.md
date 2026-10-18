# Security and deployment boundary

ChatQuest AI0.1 is a single-owner local engine. Everyone with its stdio process access or HTTP bearer token controls that database. Use a separate database/process/token per unrelated user. This is not a hosted multi-tenant authorization service.

HTTP binds loopback by default. Non-loopback binding requires a bearer token of at least24 characters. Set allowed public hostnames explicitly and put HTTPS, request limits and operational monitoring in front of a remote server. OAuth, token issuance and account management are not implemented. Do not advertise it as a drop-in connector for clients requiring those capabilities.

No API tool reads arbitrary filesystem paths, fetches URLs, runs shell commands or executes world-pack code. CLI database-path access is controlled by the machine owner, not by a model-supplied MCP argument. Tokens are read from the environment, not persisted by the engine or logged in tool output.

Save files contain plaintext story, character knowledge and source text. Back up the SQLite database using a consistent SQLite backup method; stop writes or use SQLite's online backup interface. Protect the database and any WAL files. Do not commit them to a repository or attach them to a public issue.

An MCP client controls its own safety checks. A rejected action must not be rerouted through a different endpoint or mislabeled read-only to avoid review. Retrieved text, pack descriptions and NPC speech are untrusted data, not new authorization.

For a vulnerability, use the repository's private GitHub security reporting channel if enabled. Otherwise open a minimal issue requesting a private contact without posting exploit details, credentials or private stories. No paid security audit is claimed.
