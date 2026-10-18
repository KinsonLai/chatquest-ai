# Install ChatQuest AI with an agent

Give this guide to an agent with terminal and configuration-file access. It can install the local server, configure a supported MCP client and run the checks below. Browser-only chats cannot install software on your computer. Remote account linking may still need you to sign in.

Copy this prompt:

> Install and configure ChatQuest AI for the MCP client I am using. Follow https://raw.githubusercontent.com/KinsonLai/chatquest-ai/main/docs/agent-install.md . Reuse my existing database and unrelated MCP settings. Complete the steps you can, test with a disposable database, and tell me which connection checks passed. Ask only for missing client/save-path information or a login that you cannot complete yourself.

## Instructions for the installing agent

Treat the user's installation request as permission for the local setup described here. Follow your host's permissions. Read this guide before changing files; don't install into every client you find. This guide installs the released engine, not a new game or a hosted service.

### 1. Find the client and existing save

Identify the user's chosen MCP client from the request and local context. If it is unclear, ask which client to configure. Read only its relevant MCP settings. Reuse an existing `chatquest` or `branchwright` entry rather than adding a second server pointed at the same save.

Record the effective launch command, database path and transport without printing credentials. Database precedence is `--db`, then `CHATQUEST_DB`, then `BRANCHWRIGHT_DB`, then `.branchwright/state.sqlite` relative to the server's working directory. Preserve that resolved path. If an old relative path cannot be resolved from the client's actual working directory, ask for the save location rather than silently creating a new game.

For a new installation with no existing save, use an absolute user-owned path such as `<home>/.chatquest-ai/data/adventure.sqlite`. Expand `<home>` with the actual user's home directory; do not leave placeholders, `~` or shell variables in the final JSON. Do not convert, move or overwrite an existing SQLite file, or use it for installation tests. Live SQLite backups need SQLite's backup mechanism or a stopped server, not a lone copy of its main file while WAL writes are active.

### 2. Check the runtime

Run these with the same Node executable the client will use:

```sh
node --version
node -p "process.execPath"
npm --version
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(':memory:');db.exec('CREATE VIRTUAL TABLE smoke USING fts5(body)');db.close()"
```

Require Node.js24+ and a working built-in SQLite/FTS5 runtime. Save the absolute Node executable path. If Node is missing or too old, use the user's existing version manager or normal user-level installation method where permitted. Do not replace a system runtime or change global npm settings to get past this check. If you cannot provide the required runtime, report that blocker before changing MCP configuration.

### 3. Install a pinned release

Use this release descriptor. These values refer to the published artifact, not a package on the npm registry:

```json
{
  "name": "chatquest-ai",
  "version": "0.3.1",
  "node_minimum_major": 24,
  "url": "https://github.com/KinsonLai/chatquest-ai/releases/download/v0.3.1/chatquest-ai-0.3.1.tgz",
  "release_metadata_url": "https://api.github.com/repos/KinsonLai/chatquest-ai/releases/tags/v0.3.1",
  "digest_source": "assets entry named chatquest-ai-0.3.1.tgz, digest field",
  "entrypoint": "node_modules/chatquest-ai/src/cli.mjs",
  "tool_count": 17
}
```

Read the release metadata URL and find the asset with the exact archive name. Require its browser_download_url to match the descriptor URL and its digest to be a SHA-256 value. Download the archive to a temporary directory with your normal HTTP/file tools, compute its SHA-256 and compare it to that published digest before installing. Stop if the digest is missing or mismatched; do not disable verification. Keep the archive name separate from shell commands and quote local paths.

Choose a user-owned versioned prefix such as `<home>/.chatquest-ai/runtime/0.3.1`. If that prefix already contains a working installation of this version, reuse it. Otherwise install the verified local archive:

```sh
npm install --prefix "/absolute/install-prefix" --ignore-scripts --omit=dev "/absolute/download/chatquest-ai-0.3.1.tgz"
```

Use an empty prefix for a fresh install. Do not install globally, use `sudo`, or overwrite another version's runtime. Resolve the installed entrypoint and check it with the absolute Node executable:

```sh
node "/absolute/install-prefix/node_modules/chatquest-ai/src/cli.mjs" --version
node "/absolute/install-prefix/node_modules/chatquest-ai/src/cli.mjs" --help
node "/absolute/install-prefix/node_modules/chatquest-ai/src/cli.mjs" --demo
```

Expect version `0.3.1`. The demo must finish five main scenes and a historical IF, ending with its verification message. It uses an in-memory child server and authored prose; it does not call a model or prove the chat client's connection. Do not pass the user's database to the demo.

For a client that already runs the pinned npx command successfully, you may keep that installation method instead. The [client guide](clients.md#one-line-launch) has the exact command. A stable local Node/entrypoint pair avoids npx launcher and PATH differences between a terminal and a desktop app.

### 4. Configure only the chosen client

For Claude Desktop or another client with an `mcpServers` JSON file, use its documented config location. Claude Desktop exposes it through Settings → Developer → Edit Config; common paths are `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS and `%APPDATA%/Claude/claude_desktop_config.json` on Windows. For another client or OS, inspect its installed documentation instead of guessing the path. [Official local-server guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

Before editing, save a timestamped local backup of the configuration with its file permissions preserved. Keep that backup private; it may contain credentials. Parse the existing file, merge just the selected ChatQuest entry, and preserve other servers, unrelated top-level settings and existing environment values. Do not replace the whole file with this example:

```json
{
  "mcpServers": {
    "chatquest": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/install-prefix/node_modules/chatquest-ai/src/cli.mjs",
        "--db",
        "/absolute/path/to/adventure.sqlite"
      ]
    }
  }
}
```

Substitute real absolute paths and use a JSON serializer. Windows paths can use forward slashes or escaped backslashes. Do not build shell command strings from those paths. Do not put `--demo` or `--http` into a stdio entry. If updating an old entry, keep its name and preserve its extra client settings. An explicit `--db` must point at the same effective save found in step1.

If the config is JSONC, TOML or another format, use that client's supported CLI/editor or a format-aware merge; do not parse it as plain JSON or strip comments. Re-read the config before writing to avoid overwriting a concurrent edit. Write a temporary sibling, validate it, then replace the config using a supported atomic file operation. Verify that unrelated settings survived. Do not close the user's active conversation just to force a restart; report when a restart/refresh is needed.

For Claude Code, prefer its MCP CLI over editing its internal files. Check for an existing entry first, choose the scope the user requested, and use the installed Node/entrypoint pair after the `--` separator. Reuse an existing scope; ask if you cannot determine whether the user wants a project-specific or personal install. See [Claude Code's official MCP guide](https://code.claude.com/docs/en/mcp) and run `claude mcp add --help` for the installed syntax.

For ChatGPT or Grok web, a local JSON edit does not create a cloud connection. Follow the [remote setup guide](clients.md) for the chosen product. ChatGPT needs a reachable endpoint or Secure MCP Tunnel. A private save on a public endpoint needs the compatible authentication layer described in that guide. This release has static bearer support, not built-in OAuth. Do not expose a real save without authentication or pretend that a tunnel finishes account linking. Continue local checks while any user login or missing account permission remains pending. [Official ChatGPT connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).

### 5. Verify the configured launch

Launch a test MCP client using the exact command, args and environment you wrote, but replace its database argument with a fresh absolute path in a temporary directory. This checks the configured executable rather than a different development checkout. Then:

1. Initialize MCP and discover the 17 tools. Read `read_guide` and `read_guide(section="workflows")`.
2. Call `list_campaigns` against the disposable database. Expect no campaigns before creating any. The `branchwright://` resource names and old guide branding are retained for compatibility; they do not indicate a failed upgrade.
3. The `--demo` check above must have completed. If you test extra writes, use only the disposable database and keep its IDs separate from the user's game.
4. Close the test client. Re-read the saved client entry and confirm it still points to the user's intended database, not the temporary one. Installation must not create a campaign in that database.
5. Refresh/restart the chosen chat client when appropriate. Verify its own tool discovery and a read-only guide call if you can access it. Do not label the product connection verified based only on the standalone SDK check.

If the chat client cannot be reached from your environment, say the runtime/config/standalone MCP check passed and that client activation remains pending. A quiet stdio process, `--version`, an HTTP browser GET or a successful config write alone does not establish a working connection. Tool approval and safety settings belong to the client; do not disable them to finish installation.

### 6. Hand back the installation

Report the installed version, runtime/entrypoint, chosen client and scope, config backup, final absolute database path, test results, and any remaining restart/login step. Keep credentials out of the report. Distinguish these statuses:

- Runtime installed and verified.
- Client configuration saved and validated.
- Standalone MCP handshake/tools/guide verified.
- Chat-product connection verified, or pending with the specific reason.

To roll back, stop only the server process you started and restore only the entry you changed from its backup after checking for later config edits. Leave unrelated entries and the database alone. Keep the previous runtime until the new connection has been verified.

This procedure does not publish a server, submit a plugin, install into other clients, or migrate game data. Start or resume the player's story only when requested, using the [operating guide](../skills/operating-branchwright/SKILL.md).

## Verification of this guide

On 2026-10-18, a local harness using the v0.3.0 archive followed the download, checksum, isolated install and demo steps. It merged a fixture client config containing an unrelated server and a legacy save path, checked the backup and preserved fields, then launched the installed entrypoint with a disposable database. MCP initialization, 17-tool discovery, both guide reads and an empty campaign list passed. The configured formal database was not created or changed. This used a fixture configuration, not a real chat application's settings; product-UI activation and remote login were not tested.
