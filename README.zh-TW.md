# ChatQuest AI

用 AI 玩文字冒險，存檔續玩，或從某個選擇另開 IF 線。

[English](README.md) · [ChatGPT／Claude／Grok 連接教學](docs/clients.zh-TW.md) · [完整遊玩紀錄](docs/playtest.md) · [世界包格式](docs/world-packs.md) · [操作與恢復](docs/workflows.md)

想交給 coding agent 安裝，可以直接用[Agent 安裝指南](docs/agent-install.md)。

玩到後面，模型可能忘記用掉的道具，或讓角色知道沒聽過的秘密。ChatQuest AI 把背包、擲骰結果、劇情進度和各人物所知存進本機 SQLite，讓模型透過 MCP 查紀錄再繼續，減少長對話中靠猜補設定的機會。

你也可以回到之前的選擇，試另一條路，兩邊各自存檔。世界設定用 JSON 定義，修仙、太空求生或都市調查都可以自己寫。模型仍可能寫錯旁白；存下的數字和見聞，至少能拿來核對它寫的故事。

這是純 MCP 伺服器，提供 17 個工具，沒有網頁 UI，也不呼叫模型 API。你需要接上聊天客戶端；帳號、遠端連接和託管服務的要求見[連接教學](docs/clients.zh-TW.md)。

## 可以做什麼

- 開 IF：從任一已存版本分支，帶走當時的狀態和人物見聞，原本的故事繼續保留。
- 分開記人物所知：你獨自發現的秘密，可以只記在你的見聞裡。世界真相改變，也不會順便改掉 NPC 先前知道的版本。
- 保留裁定：由伺服器擲骰，成功和失敗都留下紀錄，重新準備回合也查得回來。
- 避免重複存檔：同一回合要嘛完整寫入，要嘛不寫入；用原內容和原識別鍵重送，只回傳原收據，不再扣一次物資。
- 查原文：本機 FTS5/BM25 搜尋附來源雜湊與行號，支援 CJK bigram，方便回查設定出處。
- 跑世界事件：依遊戲時間、機率和冷卻間隔產生事件。可以先預演，提交後才算發生。
- 換世界觀：JSON 世界包定義屬性、資源、人物與事件，附奇幻、太空、都市調查、港口冒險四個原創範例。
- 查操作方法：內建操作 skill、MCP resource、prompt，以及目前安裝版本的工具 schema。

## 立即試跑

也可以把這句交給有終端與檔案權限的 agent：

> 請依 https://raw.githubusercontent.com/KinsonLai/chatquest-ai/main/docs/agent-install.md 為我使用的 MCP 客戶端安裝 ChatQuest AI。保留原有存檔和其他 MCP 設定，用獨立測試資料庫驗收；完成後告訴我哪些步驟已驗證，以及是否還需要登入或重新啟動客戶端。

需要 Node.js 24+：

```sh
npx --yes --package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.4.0/chatquest-ai-0.4.0.tgz chatquest --demo
```

指令會從 GitHub Release 下載套件，不用 clone 或安裝 Git。目前還沒發布到 npm registry。

Demo《The Last Ferry》從洪水前的碼頭開始，走完五場主線，再試一條 IF。修船失敗會耗掉物資，登岸失敗會受傷，得改走高橋。敘事是預先寫好的，擲骰、MCP 呼叫和存檔則會實際執行。它使用獨立記憶體資料庫，不改你的存檔，也不呼叫 LLM。

如果想看模型怎樣主持，這裡另有[實際遊玩紀錄](docs/playtest.md)，附提交內容、收據和審稿發現的問題。

要啟動 MCP，移除 `--demo`；stdio 會安靜等待客戶端。加上 `--http` 可啟動本機 HTTP，加上 `--help` 可查看選項。預設存檔在工作目錄下的 `.branchwright/state.sqlite`，連接客戶端時請指定固定的絕對路徑，以免換目錄後讀到另一個存檔。

stdio 客戶端設定：

```json
{
  "mcpServers": {
    "chatquest": {
      "command": "npx",
      "args": [
        "--yes",
        "--package=https://github.com/KinsonLai/chatquest-ai/releases/download/v0.4.0/chatquest-ai-0.4.0.tgz",
        "chatquest"
      ],
      "env": { "CHATQUEST_DB": "/absolute/path/to/adventure.sqlite" }
    }
  }
}
```

連好後，可以對模型說：「讀取 ChatQuest AI 操作指南與 workflows，以 ferry 世界包從頭開新冒險。讓我選擇 Robin 的行動，分開記錄各人物所知，取得 committed:true 才說存檔成功。」要續玩就先列出存檔和分支，使用原 ID。

可恢復的伺服器錯誤會附上 `retry` 提示，請聊天端先查收據，再以原參數、原識別鍵重試一次，不用你重新輸入 prompt。這是給客戶端的指引，不是強制 hook；請求若在到達伺服器前就被封鎖，這個提示無法生效。

裁定條件和耗時已確定時，`prepare_turn` 可一併擲骰和預覽世界事件，讓這類場景由四次工具呼叫減至兩次，提交時仍做完整驗證。需要先看結果才能決定的步驟會保留。詳見[用法與本機量度](docs/performance.md)；這不會改變聊天模型本身的生成速度。

上面是本機 stdio 設定。ChatGPT、Grok 網頁版需要遠端連接；ChatGPT 也可在帳號權限允許時使用官方 Secure MCP Tunnel。公開部署要設定 TLS、認證和 hostname allowlist，步驟見[繁中連接教學](docs/clients.zh-TW.md)。目前一個資料庫供一位擁有者使用，沒有內建 OAuth 或多人帳號隔離。教學列出的各聊天產品帳號介面，還沒有逐一實測。

## 從舊版升級

v0.3.0 改名為 ChatQuest AI，套件叫 `chatquest-ai`，指令叫 `chatquest`。舊的 `branchwright` 指令和 `BRANCHWRIGHT_*` 環境變數仍可用；兩套變數都設定時，以 `CHATQUEST_*` 為先。

存檔仍放在 `.branchwright/state.sqlite`。沿用原本的絕對資料庫路徑就能續玩，不用搬檔或重建遊戲。分支 ID、收據、工具名稱和 `branchwright://` resource URI 都保留。舊操作指南的原文也沒改，因為回合驗證會用到它，改了反而會影響尚未提交的回合。更新 connector metadata 後會看到新名稱；舊發布紀錄和實跑逐字稿維持當時的名稱。

## 目前的限制

v0.3 還是早期版本。資料庫能檢查數字、版本和收據，但模型仍可能把秘密寫進不該知道的角色台詞，或給出不合理的難度。這些需要看實際劇情，不能只靠測試判定。操作指南也不能解除平台的安全攔截。

檢索用本機 FTS5/BM25，裁定用可配置難度的 d20。目前沒有神經 embedding、分支合併、存檔匯入或完整社會模擬。

專案不含私人小說、角色、正式遊戲資料庫或專屬部署設定。只匯入你有權使用的材料，資料庫請自行備份，不要加入公開 Git。

想參與的話，可以寫一個原創世界包，或附上能重現問題的操作和測試。覺得有用也歡迎給個 star。MIT 授權。
