/**
 * 週課表版面邏輯測試(純函數,不需要瀏覽器)。
 *
 * 跑法(專案沒有測試框架,用 tsx/node 直接執行):
 *   docker run --rm -v "$PWD":/app -w /app node:20-alpine \
 *     npx tsx src/composables/useTimetableLayout.test.ts
 */
import { PERIODS } from "./usePeriods";
import { buildTimetable } from "./useTimetableLayout";
import type { ScheduleCourse } from "./useSchedule";

let pass = 0;
let fail = 0;

function check(cond: boolean, msg: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.log(`  ✗ FAIL: ${msg}`);
  }
}

function course(
  id: string,
  name: string,
  time: string,
  slots: [string, string][]
): ScheduleCourse {
  return { course_id: id, name, credits: 3, time, teacher: "老師", slots };
}

console.log("[連續節次合併成一塊]");
{
  // 三234 → 週三、節次 2 起、跨 3 格
  const c = course("1", "資料庫系統", "三234", [
    ["三", "2"],
    ["三", "3"],
    ["三", "4"],
  ]);
  const { blocks, rows, weekdays } = buildTimetable([c]);
  check(blocks.length === 1, "三個連續節次合併成 1 塊");
  check(blocks[0].span === 3, `跨 3 格(得到 ${blocks[0]?.span}）`);
  check(weekdays[blocks[0].column - 2] === "三", "落在週三那欄");
  check(rows[blocks[0].rowStart - 2] === "2", "從節次 2 開始");
}

console.log("[不連續節次切成多塊]");
{
  // 一2 一6:中間斷開,要切成兩塊
  const c = course("2", "斷開的課", "一2一6", [
    ["一", "2"],
    ["一", "6"],
  ]);
  const { blocks } = buildTimetable([c]);
  check(blocks.length === 2, `切成 2 塊(得到 ${blocks.length}）`);
  check(
    blocks.every((b) => b.span === 1),
    "每塊各佔 1 格"
  );
}

console.log("[跨越不同天]");
{
  const c = course("3", "跨天的課", "三234五56", [
    ["三", "2"],
    ["三", "3"],
    ["三", "4"],
    ["五", "5"],
    ["五", "6"],
  ]);
  const { blocks, weekdays } = buildTimetable([c]);
  check(blocks.length === 2, "兩天各一塊");
  const cols = blocks.map((b) => weekdays[b.column - 2]).sort();
  check(cols.join() === "三,五", `落在週三與週五(得到 ${cols.join()}）`);
  check(
    blocks.find((b) => weekdays[b.column - 2] === "三")?.span === 3,
    "週三那塊跨 3 格"
  );
  check(
    blocks.find((b) => weekdays[b.column - 2] === "五")?.span === 2,
    "週五那塊跨 2 格"
  );
}

console.log("[跨越午休節次 C/D 仍算連續]");
{
  // 4,C,D 在 PERIODS 裡是相鄰的(…,4,C,D,5,…),應合併成一塊
  const c = course("4", "跨午休", "二4CD", [
    ["二", "4"],
    ["二", "C"],
    ["二", "D"],
  ]);
  const { blocks } = buildTimetable([c]);
  check(blocks.length === 1, "4CD 合併成一塊");
  check(blocks[0].span === 3, "跨 3 格");
}

console.log("[時間未定的課]");
{
  const c = course("5", "彈性時間課", "", []);
  const { blocks, undated } = buildTimetable([c]);
  check(blocks.length === 0, "不產生色塊");
  check(undated.length === 1, "列進「時間未定」清單");
}

console.log("[顯示範圍]");
{
  const empty = buildTimetable([]);
  check(empty.rows[0] === "1", "空課表也至少從節次 1 顯示");
  check(empty.rows[empty.rows.length - 1] === "8", "空課表至少顯示到節次 8");
  check(empty.weekdays.join("") === "一二三四五", "預設只顯示週一到週五");

  // 有早八(B)和晚上(E)的課 → 範圍要擴充
  const wide = buildTimetable([
    course("6", "早課", "一B", [["一", "B"]]),
    course("7", "夜間", "一E", [["一", "E"]]),
  ]);
  check(wide.rows[0] === "B", "有 B 節課時往前擴充");
  check(wide.rows[wide.rows.length - 1] === "E", "有 E 節課時往後擴充");

  // 有週六的課 → 欄位擴充
  const sat = buildTimetable([course("8", "週六課", "六3", [["六", "3"]])]);
  check(sat.weekdays.join("") === "一二三四五六", "有週六課時擴充欄位");
}

console.log("[顏色穩定]");
{
  const a = buildTimetable([course("1142703025001", "課", "三2", [["三", "2"]])]);
  const b = buildTimetable([course("1142703025001", "課", "三2", [["三", "2"]])]);
  check(a.blocks[0].color === b.blocks[0].color, "同一 course_id 每次同色");

  const other = buildTimetable([course("1142703022001", "別的課", "三2", [["三", "2"]])]);
  check(a.blocks[0].color !== other.blocks[0].color, "不同課不同色");
}

console.log("[節次順序與後端一致]");
{
  check(
    PERIODS.join("") === "AB1234CD5678EFGH",
    "PERIODS 與 utils/time.py 的 timeChar 相同"
  );
}

console.log(`\n結果:${pass} passed, ${fail} failed`);
// 用 throw 而非 process.exit:一樣會讓退出碼非零,又不必為了型別引入 @types/node
// (這支會被 vue-tsc 一起檢查)
if (fail) throw new Error(`${fail} 項未通過`);
