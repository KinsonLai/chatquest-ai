# ChatQuest AI

以 MCP 遊玩文字冒險，保存狀態、人物見聞與不同時間線。

[English](README.md) · [ChatGPT／Claude／Grok 連接教學](docs/clients.zh-TW.md) · [完整遊玩紀錄](docs/playtest.md) · [世界包格式](docs/world-packs.md) · [操作與恢復](docs/workflows.md)

模型透過 17 個 MCP 工具主持冒險，SQLite 記錄物資、裁定、人物所知與存檔。你可以回到某個選擇，走另一條路，保留兩邊的結果。伺服器沒有網頁 UI，也不呼叫模型 API；使用的聊天客戶端、遠端連接及託管服務仍有各自的帳號要求。

## 可以做什麼

- 從任一已存版本建立 IF，保留當時人物所知，不改來源線。
- 分開記錄世界真相與各人物最後見聞的值，秘密改變不會自動通知 NPC。
- 裁定由伺服器擲骰；重新準備仍能查回全部成功與失敗結果。
- 存檔原子提交，原請求配原鍵重試只回同一收據，避免重複扣款。
- 本機 FTS5/BM25 原典檢索，附來源雜湊與行號，支援 CJK bigram。
- 世界事件依遊戲時間、機率及冷卻演變；預演不等於已發生。
- JSON 世界包可替換題材、屬性、資源、人物與事件；附奇幻、太空、都市調查、港口冒險四個原創範例。
- 操作 skill、MCP resource、prompt 和即時工具 schema 均內建。

## 立即試跑

需要 Node.js 24+：

```sh
npx --yes --package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.3.0/chatquest-ai-0.3.0.tgz chatquest --demo
```

這個指令從 GitHub Release 下載套件，不用 clone，也不用 Git；目前尚未發布至 npm registry。

新 demo《The Last Ferry》從洪水前的碼頭開始，跑完五場主線與一條 IF。修船失敗會耗掉物資，登岸失敗會受傷並改走高橋。每場都經過真正的 MCP 呼叫、伺服器擲骰、存檔與核對。它使用預寫敘事和獨立記憶體資料庫，不改你的存檔，也不呼叫 LLM。另有[由模型實際操作的遊玩紀錄](docs/playtest.md)，附提交內容與收據。

要啟動 MCP，移除 `--demo`；stdio 會安靜等待客戶端。加上 `--http` 可啟動本機 HTTP，加上 `--help` 可查看選項。預設存檔在工作目錄下的 `.branchwright/state.sqlite`，連接客戶端時請指定固定的絕對路徑，以免換目錄後讀到另一個存檔。

stdio 客戶端設定：

```json
{
  "mcpServers": {
    "chatquest": {
      "command": "npx",
      "args": [
        "--yes",
        "--package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.3.0/chatquest-ai-0.3.0.tgz",
        "chatquest"
      ],
      "env": { "CHATQUEST_DB": "/absolute/path/to/adventure.sqlite" }
    }
  }
}
```

對模型說：「讀取 ChatQuest AI 操作指南與 workflows，以 ferry 世界包從頭開新冒險。讓我選擇 Robin 的行動，分開記錄各人物所知，取得 committed:true 才說存檔成功。」已有遊戲就先列出存檔及分支，以原 ID 續玩。

上面是本機 stdio 設定。ChatGPT、Grok 網頁版需要遠端連接：ChatGPT 可按帳號權限使用官方 Secure MCP Tunnel；公開 HTTPS 則須處理客戶端支援的認證。公開部署需要 TLS、認證及 hostname allowlist。目前是單一擁有者資料庫，沒有內建 OAuth 或多人帳號隔離。完整步驟見[繁中連接教學](docs/clients.zh-TW.md)；各聊天產品的帳號介面連接尚未實測。

## 從舊版升級

v0.3.0 起名稱改為 ChatQuest AI，套件叫 `chatquest-ai`，指令叫 `chatquest`。舊的 `branchwright` 指令及 `BRANCHWRIGHT_*` 環境變數仍可用；同時設定時，以 `CHATQUEST_*` 為先。

預設存檔仍是 `.branchwright/state.sqlite`，沿用原本的絕對資料庫路徑即可，不用搬檔或重建遊戲。分支 ID、收據、工具名稱、`branchwright://` resource URI，以及參與回合驗證的舊操作指南原文均保留，避免影響未提交回合。更新 connector metadata 後會看到新伺服器名稱。舊版發布紀錄與實跑逐字稿保留當時名稱。

## 正確的期望

這是 v0.3 早期版本。引擎能驗證數字、版本與收據，仍須檢查模型寫出的敘事、難度與人物反應。操作指南不能解除平台安全攔截。檢索採本機 FTS5/BM25，裁定採可配置難度的 d20；目前沒有神經 embedding、分支合併、存檔匯入或完整社會模擬。

專案不含私人小說、角色、正式遊戲資料庫或專屬部署設定。只匯入你有權使用的材料，資料庫請自行備份，不要加入公開 Git。

歡迎貢獻原創世界包、可重現錯誤和測試。如果你有在用，可以 star 讓其他玩家找到。MIT 授權。
