# Connect a chat client

For an agent to handle the local install and configuration, use the [agent installation guide](agent-install.md).

These instructions were checked against the providers' documentation on 2026-10-18. Menu labels and account access can change. A server speaking MCP does not prove that a particular chat product can authenticate to it. See [tested flows](playtest.md) for the evidence collected for this release.

## Pick a route

| Client              | Route                              | Authentication                                                                        |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| Claude Desktop      | Local stdio process                | Local process; no HTTP token                                                          |
| Claude Code         | Local stdio, or remote HTTP        | Local process, or bearer header                                                       |
| Claude web / mobile | Public HTTPS connector             | Request header where offered, or an OAuth gateway                                     |
| ChatGPT             | Secure MCP Tunnel, or public HTTPS | Tunnel access, or an MCP-compatible OAuth gateway                                     |
| Grok web            | Public HTTPS custom connector      | The connector's supported auth; use an OAuth gateway if fixed headers are unavailable |

The engine is single-owner. Everyone who can use one endpoint accesses the same database. Give each owner a separate process, database and credentials. A tunnel changes reachability; it does not create per-user save isolation.

## One-line launch

Install Node.js 24 or newer, including npm. The package is distributed through GitHub Releases; it has not been published to the npm registry. The pinned release URL avoids requiring Git:

```sh
npx --yes --package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.3.0/chatquest-ai-0.3.0.tgz chatquest
```

This starts stdio and waits quietly for a client. To see a complete story replay in the terminal instead, append `--demo`. To host HTTP, append `--http`. `--help` lists the options.

The default save is `.branchwright/state.sqlite` relative to the process working directory. In a chat client's configuration, always supply an absolute `--db` path so a changed working directory does not appear to lose your game. `--demo` uses a separate in-memory server and exits without touching that save.

## Claude Desktop

Use Settings → Developer → Edit Config to edit `claude_desktop_config.json`. Merge the entry below with your existing configuration. Replace `/absolute/path/adventure.sqlite` with a path you own; on Windows, `D:/Games/adventure.sqlite` is valid JSON path syntax.

```json
{
  "mcpServers": {
    "chatquest": {
      "command": "npx",
      "args": [
        "--yes",
        "--package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.3.0/chatquest-ai-0.3.0.tgz",
        "chatquest",
        "--db",
        "/absolute/path/adventure.sqlite"
      ]
    }
  }
}
```

Restart Claude Desktop and check its Developer connection status. In a new conversation, enable ChatQuest AI and use the [opening prompt](#start-a-new-story). Do not add `--demo` to a client config: it prints a replay instead of serving MCP. Local config is a separate mechanism from Claude's cloud connectors. [Official local-server walkthrough](https://modelcontextprotocol.io/docs/develop/connect-local-servers).

If a Windows launcher cannot resolve `npx`, use its absolute executable path. Some launchers require `"command":"cmd"` with `"args":["/c","npx", ...]`; use only fixed launch arguments, and keep the save path quoted by JSON. Check the client log before changing transports. Node 24 must be available to the launched process, not only an unrelated terminal.

## Claude Code

Run this from your terminal, replacing the save path:

```sh
claude mcp add --transport stdio chatquest -- npx --yes --package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.3.0/chatquest-ai-0.3.0.tgz chatquest --db /absolute/path/adventure.sqlite
```

Use `/mcp` inside Claude Code to inspect the connection and review tool permissions. For a hosted server that accepts bearer credentials:

```sh
claude mcp add --transport http chatquest https://your-host.example/mcp --header "Authorization: Bearer YOUR_PRIVATE_TOKEN"
```

Treat saved headers and shell history as credentials. See [Claude Code's MCP guide](https://code.claude.com/docs/en/mcp) for scopes and credential handling. The documented commands are configuration examples; this release does not claim a Claude account-level UI test.

## Prepare remote HTTP

For Claude web or Grok, the cloud service needs a public HTTPS URL ending in `/mcp`. `http://localhost:3333/mcp` on your laptop is not such a URL. Start the server behind a TLS reverse proxy or tunnel with a bearer token and an explicit hostname allowlist.

macOS / Linux:

```sh
export CHATQUEST_TOKEN="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
export CHATQUEST_ALLOWED_HOSTS="your-host.example"
npx --yes --package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.3.0/chatquest-ai-0.3.0.tgz chatquest --http --db /absolute/path/adventure.sqlite
```

PowerShell:

```powershell
$env:CHATQUEST_TOKEN = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
$env:CHATQUEST_ALLOWED_HOSTS = 'your-host.example'
npx --yes --package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.3.0/chatquest-ai-0.3.0.tgz chatquest --http --db D:/Games/adventure.sqlite
```

Both examples listen on loopback. Put the proxy or tunnel on the same host, forwarding to port3333. If it preserves the public Host header, allow that exact hostname; do not use a wildcard. A container or separate proxy host may need `--host 0.0.0.0`; the server requires a token of at least24 characters for that binding. TLS, persistent storage and proxy configuration are supplied by the operator. Keep the token outside the chat and Git.

Before using a chat product, connect MCP Inspector to the HTTPS endpoint, supply the Authorization header, and run `read_guide`, then the [acceptance checklist](#check-an-actual-game). A normal browser GET is not a connection test: this stateless endpoint accepts MCP POST requests and returns405 to GET.

### Claude web and mobile

Open Customize → Connectors → Add custom connector, supply the HTTPS `/mcp` URL, and configure Authentication and Request headers. Where fixed headers are available, add `Authorization: Bearer <your token>` in the connector settings, not the conversation. Enable the connector in the new chat. Availability and workspace controls vary. [Official remote-connector setup](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

### ChatGPT

ChatGPT does not execute an `npx` command pasted into a conversation. The official connection guide provides public HTTPS and Secure MCP Tunnel routes. This release does not implement OAuth, and its static bearer token must not be described as ChatGPT OAuth. [Official ChatGPT connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).

For a private local server, use **Secure MCP Tunnel** if your account/workspace has access. It needs a tunnel ID, the appropriate Platform/workspace permissions, a tunnel runtime API key, and OpenAI's `tunnel-client`. ChatQuest AI itself still makes no model API calls. After obtaining those prerequisites, use the official CLI setup with your own tunnel ID and save path:

```sh
tunnel-client init --sample sample_mcp_stdio_local --profile chatquest --tunnel-id YOUR_TUNNEL_ID --mcp-command "npx --yes --package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.3.0/chatquest-ai-0.3.0.tgz chatquest --db /absolute/path/adventure.sqlite"
tunnel-client doctor --profile chatquest --explain
tunnel-client run --profile chatquest
```

Provide the runtime credential through the official secure setup/environment instructions. Keep the client running. In ChatGPT Plugins, select Add custom MCP server → Connection: Tunnel, choose the tunnel, configure authentication and create/install the plugin. Enable it in a new chat. [Official tunnel prerequisites and setup](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).

For public HTTPS with private saves, put a tested MCP OAuth 2.1 gateway in front of ChatQuest AI. It must validate the incoming user token and protect access to the single-owner backend; a generic HTTPS tunnel or random URL alone does not do this. Follow [OpenAI's authentication contract](https://developers.openai.com/plugins/build/auth). The gateway and a live ChatGPT connection are **not included or verified** here. Do not turn off auth on a real save to make discovery pass. If you lack tunnel access or a gateway, use local Claude/another stdio client first.

### Grok

Go to [Grok Connectors](https://grok.com/connectors), choose New Connector → Custom, and enter the public HTTPS `/mcp` URL. Complete the authentication offered by that interface, then enable the connector for your conversation. If it cannot send a fixed Authorization header, a static-token-only endpoint is not enough; use a compatible OAuth gateway. Do not put the bearer token in a URL query or remove authentication from a real save. [Official Grok connector setup](https://docs.x.ai/grok/connectors).

For local hosting, Grok documents [ngrok and Cloudflare tunnels](https://docs.x.ai/grok/connectors/custom-mcp-tunneling). Point a tunnel at port3333 and set `CHATQUEST_ALLOWED_HOSTS` to its assigned hostname when the Host is preserved. Keep both processes running. This release uses JSON Streamable HTTP, not legacy SSE. Tunnel setup does not prove Grok authentication or gameplay; those account-level steps remain unverified.

## Start a new story

Paste this after enabling the server:

> Read ChatQuest AI's operating guide and workflows. Create a new campaign from the ferry template, with a new creation key. Start at the opening before anyone reads the dispatch. Present the scene and let me choose Robin's actions. Use the server's checks, exact inventory and each character's knowledge. Give each turn a consequence and a next choice. Append the saved snapshot only after a committed receipt. Never reuse another campaign or my existing save without asking.

For a different setting, use `lantern`, `signal`, `blackout`, or provide a [custom pack](world-packs.md). To resume, ask the model to list campaigns and branches, choose the existing IDs, read the current state and recent history, then continue. Refresh connector metadata after upgrading; do not recreate a campaign to fix stale tool discovery.

## Check an actual game

1. Start a new test campaign; record its campaign and branch IDs.
2. Choose an uncertain action. Read the roll, then verify both prose and saved changes carry its result, including failure.
3. Find something alone. Ask an absent NPC about it; they must not know it until told. Grant knowledge to only one actor and recheck the other.
4. Spend a finite item. Verify its exact remaining count and refuse an unavailable-item action without inventing a replacement.
5. End the conversation/server, reconnect to the same database and IDs, and continue from the saved scene.
6. Fork an earlier revision, play a different route to an outcome, then verify the main state and knowledge are unchanged.
7. If a write's response is lost, look up the original key with `get_recovery`; preserve the exact request on retry. Report success only from `committed:true`.

## Troubleshooting

| Symptom                        | Check                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Terminal is quiet              | Stdio is waiting for a client; use `--demo` for visible output                                            |
| New/empty save after restart   | Same absolute `--db` path, campaign ID and branch ID                                                      |
| `node:sqlite` missing          | Node24+ in the actual client process                                                                      |
| HTTP401                        | Bearer header missing/wrong, or client needs OAuth rather than a fixed token                              |
| HTTP403                        | Exact Host allowlist and Origin; inspect proxy headers                                                    |
| HTTP405 in browser             | Use MCP Inspector, not a browser GET                                                                      |
| Can't find new tools/templates | Restart server, refresh metadata, start a new chat                                                        |
| Tool safety rejection          | Keep original error and arguments without credentials; do not route the denied write through another tool |

The operating skill guides the model. It cannot override platform permissions, guarantee characterization, or convert an unconfirmed write into a save.
