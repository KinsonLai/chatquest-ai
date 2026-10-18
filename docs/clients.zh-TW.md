# 連接 ChatGPT、Claude 與 Grok

想交給 agent 安裝和設定，可使用 [Agent 安裝指南](agent-install.md)，裡面附有可直接轉交的指令。

教學依 2026-10-18 查閱的官方文件整理。選單與權限可能隨帳號改變；這裡將設定步驟與[實際測試範圍](playtest.md)分開記錄。詳細英文指令與故障表見 [clients.md](clients.md)。

## 一行啟動

先安裝 Node.js 24+（含 npm）。不用 clone 或安裝 Git：

```sh
npx --yes --package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.4.0/chatquest-ai-0.4.0.tgz chatquest
```

這會啟動 stdio，等待 MCP 客戶端連入；終端沒有劇情輸出是正常的。要看從頭開始的故事示範，在指令最後加 `--demo`。要提供 HTTP，加 `--http`。套件來自 GitHub Release，尚未發布至 npm registry。

正式遊戲請加 `--db` 指定固定的絕對路徑，例如 `--db D:/Games/adventure.sqlite`。沒有指定時，存檔在當前工作目錄下的 `.branchwright/state.sqlite`；換目錄可能讀到另一個資料庫。Demo 使用獨立記憶體資料庫，不接受正式存檔路徑。

## Claude Desktop：本機 stdio

在 Settings → Developer → Edit Config 開啟 `claude_desktop_config.json`，將 [README 的 mcpServers 設定](../README.zh-TW.md#立即試跑)合併進原設定，修改資料庫絕對路徑，然後重新啟動 Claude Desktop。在新對話啟用 ChatQuest AI。

本機設定不等於遠端 connector。不要在客戶端設定加入 `--demo`；它會輸出示範後結束。Windows 若找不到 `npx`，先檢查 Developer 日誌與 PATH，必要時指定執行檔絕對路徑；某些啟動器需要固定的 `cmd /c npx` 參數。[官方本機 MCP 教學](https://modelcontextprotocol.io/docs/develop/connect-local-servers)。

## Claude Code：本機或遠端

更換路徑後執行：

```sh
claude mcp add --transport stdio chatquest -- npx --yes --package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.4.0/chatquest-ai-0.4.0.tgz chatquest --db /absolute/path/adventure.sqlite
```

在 Claude Code 用 `/mcp` 檢查連線及工具權限。遠端 HTTP 可使用 Authorization header，完整指令見[英文教學](clients.md#claude-code)。[Claude Code 官方文件](https://code.claude.com/docs/en/mcp)。

## ChatGPT：官方私有通道或公開 HTTPS

在 ChatGPT 對話貼上 npx 指令，不會讓它在你的電腦啟動程式。可採以下路線：

1. **官方 Secure MCP Tunnel**：適合本機資料庫。需要可用的 Platform 組織／ChatGPT workspace 權限、tunnel ID、通道 runtime API key 及 `tunnel-client`。引擎本身仍不呼叫模型 API。
2. **公開 HTTPS `/mcp`**：正式私人存檔需另設符合 MCP 的 OAuth gateway。ChatQuest AI 只有固定 bearer token，沒有內建 OAuth；不能把它當成 ChatGPT 可直接完成的 OAuth 登入。

私有通道路線：按[官方文件](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)建立通道並安全提供 runtime credential，再配置 `tunnel-client` 將請求轉到 ChatQuest AI 的 npx stdio 指令。[可替換參數的完整指令](clients.md#chatgpt)已附在英文教學。執行 `doctor` 確認設定後，保持 `run` 運作。

在 ChatGPT Plugins 選 Add custom MCP server，Connection 選 Tunnel，指定同一個 tunnel，再完成認證、建立並安裝 plugin。新對話啟用它後才開始遊戲。若通道不在清單，核對 workspace 關聯及權限。[官方連接步驟](https://developers.openai.com/plugins/deploy/connect-chatgpt)。

沒有通道權限或 OAuth gateway 時，先用本機 stdio 客戶端。不要為了通過 discovery 而把正式資料庫改成免認證；這份發布沒有驗證你帳號內的 ChatGPT 連線。

## Claude 網頁／手機及 Grok：遠端 HTTPS

先按[遠端 HTTP 設定](clients.md#prepare-remote-http)啟動服務，配置 token、TLS、公開 hostname allowlist 及持久資料庫。若使用本機 tunnel，轉發到 port3333；公開網址必須包含 `/mcp`。每位擁有者應使用獨立資料庫與憑證，因為同一端點沒有多人資料隔離。

- **Claude**：Customize → Connectors → Add custom connector，輸入 HTTPS URL。若有 Request headers，設定 `Authorization: Bearer <token>`；不要把 token 貼進對話。完成後在新對話啟用 connector。[官方教學](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)。
- **Grok**：到 [Connectors](https://grok.com/connectors)，選 New Connector → Custom，輸入 URL 並完成介面提供的認證。若介面不能送固定 Authorization header，需要相容的 OAuth gateway，不能只靠網址或將 token 放在 query。[官方 connector 文件](https://docs.x.ai/grok/connectors)及 [tunnel 教學](https://docs.x.ai/grok/connectors/custom-mcp-tunneling)。

公開 tunnel 只解決網路可達性，不會替你完成帳號認證。Grok、Claude 網頁與 ChatGPT 的實際帳號連接，均須在你的介面按下列遊戲驗收步驟確認。

## 從頭開一個故事

連好後對模型說：

> 讀取 ChatQuest AI 的操作指南與 workflows。用 ferry 世界包及新的 creation key 建立獨立遊戲，從未讀公文的碼頭開場，讓我選 Robin 的行動。依伺服器裁定承接成功與失敗，精確扣除物資。人物只能使用自己見過或被告知的消息，對話要符合年齡與經歷。每回合有結果與下一個選擇，取得 committed:true 後才附上伺服器狀態快照。

續玩時先列出 campaigns／branches，使用原 ID 讀取狀態和歷史，不另建存檔。升級後先重新啟動伺服器、refresh 工具 metadata，再開新對話。

## 遊戲驗收

測試一場有結果的行動，核對失敗有沒有留下代價；獨自取得線索，再檢查不在場 NPC 不知情。用掉道具後核對餘量，重開程式仍須讀回原地點和版本。從舊版本建立 IF，實際走完另一條路，再比較主線完整狀態。若提交回應遺失，用原鍵查 `get_recovery`；未見成功收據就保留未確認狀態。

若遇到安全攔截，保留原錯誤與去除憑證的參數，不能換工具或編碼同一請求繞過。操作 skill 無法取消客戶端的安全檢查。
