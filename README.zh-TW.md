# Branchwright MCP

**讓模型講故事，讓引擎保存可核對的收據。**

[English](README.md) · [世界包格式](docs/world-packs.md) · [操作與恢復](docs/workflows.md)

純 MCP 的通用 LLM 文字冒險引擎：沒有網頁 UI，不在伺服器呼叫模型，不需要額外模型 API key。接上支援 MCP 的對話客戶端，就能以自己的世界設定開展冒險；模型負責敘事，SQLite 負責狀態、骰子、分支及存檔。

## 可以做什麼

- 從任一已存版本建立 IF，保留當時人物所知，不改來源線。
- 分開記錄世界真相與各人物最後見聞的值，秘密改變不會自動通知 NPC。
- 裁定由伺服器擲骰；重新準備仍能查回全部成功與失敗結果。
- 存檔原子提交，原請求配原鍵重試只回同一收據，避免重複扣款。
- 本機 FTS5/BM25 原典檢索，附來源雜湊與行號，支援 CJK bigram。
- 世界事件依遊戲時間、機率及冷卻演變；預演不等於已發生。
- JSON 世界包可替換題材、屬性、資源、人物與事件；附奇幻、太空、都市調查三個原創範例。
- 操作 skill、MCP resource、prompt 和即時工具 schema 均內建。

## 立即試跑

需要 Node.js 24+：

```sh
git clone https://github.com/KinsonLai/branchwright-mcp.git
cd branchwright-mcp
npm ci
npm run demo
```

示範會實際檢索、擲骰、存檔、重試、核對 NPC 不知情並建立 IF，使用記憶體資料庫，不改你的正式存檔。這是引擎測試，不是假稱由 LLM 實際遊玩的逐字稿。

stdio 客戶端設定：

```json
{
  "mcpServers": {
    "branchwright": {
      "command": "node",
      "args": ["/absolute/path/to/branchwright-mcp/src/cli.mjs"],
      "env": { "BRANCHWRIGHT_DB": "/absolute/path/to/adventure.sqlite" }
    }
  }
}
```

對模型說：「讀取 Branchwright 操作指南，以 signal 世界包開始新冒險；重大選擇交給我，人物知情分開，取得 committed:true 才說存檔成功。」已經有遊戲就先列出存檔，不另開線。

HTTP 用 `npm run start:http`，預設本機 `/mcp`，沒有首頁或控制台。公開部署需要 bearer token、TLS 及允許的 hostname；目前是單一擁有者資料庫，沒有 OAuth 或多人帳號隔離。官方 SDK 的 stdio／HTTP 整合測試已涵蓋；個別 ChatGPT 等產品介面的實際連接尚未驗證，不宣稱已通用接好。

## 正確的期望

這是 v0.1 初版。能驗證數字、版本與收據，不代表能自動認證整段敘事、難度公平或人物自然度。操作指南不能解除平台安全攔截。沒有神經 embedding、分支合併、存檔匯入或完整社會模擬；初版裁定為可配置難度的 d20。

專案不含私人小說、角色、正式遊戲資料庫或專屬部署設定。只匯入你有權使用的材料，資料庫請自行備份，不要加入公開 Git。

歡迎貢獻原創世界包、可重現錯誤和測試。如果這對你的跑團有用，可以 star 讓更多人找到；不承諾 star 數量，也不以假數據宣傳。MIT 授權。
