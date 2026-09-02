/**
 * 政大 AI 助手是獨立於排課系統的後端(不同 LangGraph graph、假設是不同 host),
 * 所以不走 /api 的 dev proxy,而是直接打這裡設定的絕對網址。
 *
 * VITE_ASSISTANT_API_BASE 尚未確認——待後端補上對話與語音轉文字端點後,
 * 在 .env(參考 .env.example)填入實際網址即可,元件端不用改。
 */
export const ASSISTANT_API_BASE = import.meta.env.VITE_ASSISTANT_API_BASE ?? "";

export const ASSISTANT_ASK_URL = `${ASSISTANT_API_BASE}/ask`;
export const ASSISTANT_UPLOAD_URL = `${ASSISTANT_API_BASE}/upload`;
