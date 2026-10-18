// Advice for the chat client, not a background retry or an approval override.
export function retryAdvice(result, args, error, toolName) {
  const denied = [
    "PERMISSION_DENIED",
    "AUTHORIZATION_DENIED",
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "SAFETY_BLOCKED",
    "POLICY_DENIED",
  ].some((code) => code === error.code || code === result.code);
  const sqliteCode = Number.isInteger(error.errcode)
    ? error.errcode & 255
    : null;
  const busy =
    sqliteCode === 5 ||
    sqliteCode === 6 ||
    ["SQLITE_BUSY", "SQLITE_LOCKED"].includes(error.code);
  const permanent =
    denied ||
    ["EACCES", "EPERM", "ENOSPC", "EROFS"].includes(error.code) ||
    (sqliteCode !== null && !busy);
  if (result.code !== "INTERNAL_ERROR" || permanent) {
    return {
      retryable: false,
      action: denied ? "stop" : "read_error_and_correct",
      max_auto_retries: 0,
      instruction:
        "這不是可原樣重送的暫時錯誤。依 code 與 recovery 修正原回合；不能改掉失敗裁定。授權或安全拒絕須停止，不得繞過。",
    };
  }
  const scope =
    ["commit_turn", "restore_checkpoint"].includes(toolName) &&
    typeof args.idempotency_key === "string" &&
    typeof args.campaign_id === "string" &&
    typeof args.branch_id === "string"
      ? { campaign_id: args.campaign_id, branch_id: args.branch_id }
      : null;
  return {
    retryable: true,
    action: scope ? "recover_then_retry" : "retry_same_request",
    max_auto_retries: 1,
    preserve_original_request: true,
    ...(scope
      ? {
          next_call: {
            name: "get_recovery",
            arguments: {
              ...scope,
              ...(typeof args.idempotency_key === "string"
                ? { idempotency_key: args.idempotency_key }
                : {}),
            },
          },
        }
      : {}),
    instruction:
      "聊天端請接續原本已授權的操作，不必要求玩家重複輸入 prompt。若有 next_call，先查恢復資料：查詢失敗就停止；找到成功收據就直接回報，不再提交；確認沒有收據才以完全相同的工具、參數、原話和識別鍵重試一次。每個原始操作總共最多自動重試一次，仍失敗就保留未確認狀態並回報。不得重擲骰子、換鍵或繞過安全／權限拒絕；僅 committed:true 可確認存檔成功。",
  };
}
