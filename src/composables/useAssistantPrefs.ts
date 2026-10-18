import { ref, watch } from "vue";

/**
 * 政大 AI 助手的使用者偏好,存在瀏覽器的 localStorage。
 * 讀寫都包 try/catch:無痕視窗、被封鎖或被清掉時 localStorage 可能丟例外或是空的,
 * 頁面必須在沒有它的情況下照常運作(用預設值)。
 */
const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 存不了就算了,只是下次打開回到預設 */
  }
};

export type LogoShape = "circle" | "square";

export function useAssistantPrefs() {
  // 「查現場」開關:預設開(demo 要展示現場查詢);使用者關掉後記住
  const liveOn = ref(read("assistant.live") !== "off");
  watch(liveOn, (v) => write("assistant.live", v ? "on" : "off"));

  // 網站標誌的形狀:先用圓形,保留切換——網址加 ?logo=square 就會改成方形並記住(?logo=circle 改回來)
  let shape: LogoShape = read("assistant.logo") === "square" ? "square" : "circle";
  try {
    const q = new URLSearchParams(window.location.search).get("logo");
    if (q === "square" || q === "circle") {
      shape = q;
      write("assistant.logo", q);
    }
  } catch {
    /* 沒有 window.location 的環境(測試)就用上面的值 */
  }
  const logoShape = ref<LogoShape>(shape);

  return { liveOn, logoShape };
}
