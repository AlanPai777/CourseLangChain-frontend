import axios from "axios";
import { ref } from "vue";
import { useSession } from "./useSession";

/**
 * 「目前已排定的課表」——與後端 tools/session_schedule 同一份資料。
 *
 * 面板上的手動增刪、以及 agent 在對話中做的變更,改的都是後端那一份,
 * 衝堂判斷也由後端(scheduler.py 的純函數)決定,前端不自己算。
 */
export interface ScheduleCourse {
  course_id: string;
  name: string;
  credits: number;
  time: string;
  teacher: string;
  slots: [string, string][];
}

const courses = ref<ScheduleCourse[]>([]);
const totalCredits = ref(0);
const loading = ref(false);
const lastMessage = ref("");

export function useSchedule() {
  const { sessionId } = useSession();

  const apply = (data: any) => {
    courses.value = data.courses ?? [];
    totalCredits.value = data.total_credits ?? 0;
  };

  const refresh = async () => {
    loading.value = true;
    try {
      const res = await axios.get("/api/schedule", {
        params: { session_id: sessionId.value },
      });
      apply(res.data);
    } finally {
      loading.value = false;
    }
  };

  /**
   * 加課。後端遇衝堂、或加入同一門課的另一個班時,會自動移除舊的那幾門,
   * 並回傳 removed 與 removed_reasons({course_id: "same_name"|"conflict"})供提示。
   */
  const addCourse = async (courseId: string) => {
    loading.value = true;
    lastMessage.value = "";
    try {
      const res = await axios.post("/api/schedule", {
        session_id: sessionId.value,
        course_id: courseId.trim(),
      });
      apply(res.data);
      const removed: ScheduleCourse[] = res.data.removed ?? [];
      const reasons: Record<string, string> = res.data.removed_reasons ?? {};
      if (res.data.already) {
        lastMessage.value = `${res.data.added.name} 已經在課表裡了`;
      } else if (removed.length) {
        // 一律照後端標記的原因講 —— 同名換班時說「衝堂」是假的,會讓人以為時間撞了
        const names = removed
          .map((c) => {
            const why =
              reasons[c.course_id] === "same_name" ? "同一門課的另一班" : "衝堂";
            return `${c.name}(${c.time},${why})`;
          })
          .join("、");
        lastMessage.value = `已加入 ${res.data.added.name},已移除:${names}`;
      } else {
        lastMessage.value = `已加入 ${res.data.added.name}`;
      }
      return true;
    } catch (err: any) {
      lastMessage.value = err?.response?.data?.detail ?? "加入失敗,請確認課程代碼";
      return false;
    } finally {
      loading.value = false;
    }
  };

  const removeCourse = async (courseId: string) => {
    loading.value = true;
    try {
      const res = await axios.delete("/api/schedule", {
        params: { session_id: sessionId.value, course_id: courseId },
      });
      apply(res.data);
      lastMessage.value = "";
    } finally {
      loading.value = false;
    }
  };

  const clearSchedule = async () => {
    loading.value = true;
    try {
      const res = await axios.delete("/api/schedule", {
        params: { session_id: sessionId.value },
      });
      apply(res.data);
      lastMessage.value = "";
    } finally {
      loading.value = false;
    }
  };

  /** 換 session(開新對話)後,把面板的本地狀態也清乾淨。 */
  const resetLocal = () => {
    courses.value = [];
    totalCredits.value = 0;
    lastMessage.value = "";
  };

  return {
    courses,
    totalCredits,
    loading,
    lastMessage,
    refresh,
    addCourse,
    removeCourse,
    clearSchedule,
    resetLocal,
  };
}
