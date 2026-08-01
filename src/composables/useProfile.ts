import axios from "axios";
import { ref } from "vue";
import { useSession } from "./useSession";

/**
 * 成績單(可選)。使用者自 iNCCU 下載 JSON 後上傳,用於個人化排課。
 *
 * 隱私:檔案內容只在瀏覽器讀成 JSON 後送出一次,後端解析完即丟棄原始內容,
 * 不寫檔、不進資料庫;只有去識別化的修課狀況留在這段 session 的記憶體裡。
 * 使用者可隨時移除,關掉分頁或後端重啟也會消失。
 */
export interface ProfileSummary {
  has_profile: boolean;
  department?: string;
  grade_label?: string;
  earned_credits?: number | null;
  graduation_credits?: number | null;
  completed_count?: number;
  in_progress_count?: number;
  graduation_gaps?: string[];
}

const profile = ref<ProfileSummary>({ has_profile: false });
const uploading = ref(false);
const error = ref("");

export function useProfile() {
  const { sessionId } = useSession();

  const refresh = async () => {
    try {
      const res = await axios.get("/api/profile", {
        params: { session_id: sessionId.value },
      });
      profile.value = res.data;
    } catch {
      profile.value = { has_profile: false };
    }
  };

  const upload = async (file: File) => {
    uploading.value = true;
    error.value = "";
    try {
      const text = await file.text();
      let record: unknown;
      try {
        record = JSON.parse(text);
      } catch {
        error.value = "這個檔案不是有效的 JSON,請確認下載的是成績單原始檔";
        return false;
      }
      const res = await axios.post("/api/profile", {
        session_id: sessionId.value,
        record,
      });
      profile.value = res.data;
      return true;
    } catch (err: any) {
      error.value = err?.response?.data?.detail ?? "上傳失敗,請稍後再試";
      return false;
    } finally {
      uploading.value = false;
    }
  };

  const remove = async () => {
    try {
      await axios.delete("/api/profile", {
        params: { session_id: sessionId.value },
      });
    } finally {
      profile.value = { has_profile: false };
      error.value = "";
    }
  };

  const resetLocal = () => {
    profile.value = { has_profile: false };
    error.value = "";
  };

  return { profile, uploading, error, refresh, upload, remove, resetLocal };
}
