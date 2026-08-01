import { PERIODS, WEEKDAYS, periodIndex } from "./usePeriods";
import type { ScheduleCourse } from "./useSchedule";

/**
 * 把課表資料算成週課表格線的版面 —— 純函數,不碰 DOM,方便單獨驗證。
 *
 * 核心是把「一門課在同一天的連續節次」合併成一個色塊
 * (如 三234 → 週三、從節次 2 起、跨 3 格),不連續則切成多塊(如 三2 三6)。
 */
export interface TimetableBlock {
  key: string;
  course: ScheduleCourse;
  /** CSS grid 的欄號(已含時間軸那一欄的位移) */
  column: number;
  /** CSS grid 的列號(已含星期標頭那一列的位移) */
  rowStart: number;
  span: number;
  color: string;
  textColor: string;
}

export interface TimetableLayout {
  rows: string[];
  weekdays: string[];
  blocks: TimetableBlock[];
  undated: ScheduleCourse[];
}

/** 由 course_id 產生穩定色相,同一門課每次都同一個顏色。 */
export function colorOf(courseId: string): { bg: string; fg: string } {
  let hash = 0;
  for (const ch of courseId) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return { bg: `hsl(${hash} 55% 78%)`, fg: `hsl(${hash} 60% 18%)` };
}

/** 顯示到週幾:預設一~五,有週末的課才擴充。 */
function visibleWeekdays(courses: ScheduleCourse[]): string[] {
  const used = new Set(courses.flatMap((c) => (c.slots ?? []).map(([wd]) => wd)));
  let last = 4; // 週五
  WEEKDAYS.forEach((wd, i) => {
    if (used.has(wd) && i > last) last = i;
  });
  return [...WEEKDAYS.slice(0, last + 1)];
}

/** 顯示哪些節次:涵蓋所有課,並至少顯示 1~8 這段常態範圍。 */
function visibleRows(courses: ScheduleCourse[]): string[] {
  const idx = courses.flatMap((c) =>
    (c.slots ?? []).map(([, p]) => periodIndex(p)).filter((i) => i >= 0)
  );
  const from = Math.min(PERIODS.indexOf("1"), ...idx);
  const to = Math.max(PERIODS.indexOf("8"), ...idx);
  return [...PERIODS.slice(from, to + 1)];
}

export function buildTimetable(courses: ScheduleCourse[]): TimetableLayout {
  const rows = visibleRows(courses);
  const weekdays = visibleWeekdays(courses);
  const blocks: TimetableBlock[] = [];

  for (const course of courses) {
    const { bg, fg } = colorOf(course.course_id);

    // 依星期分組
    const byDay = new Map<string, number[]>();
    for (const [wd, p] of course.slots ?? []) {
      const i = periodIndex(p);
      if (i < 0) continue;
      byDay.set(wd, [...(byDay.get(wd) ?? []), i]);
    }

    for (const [wd, indices] of byDay) {
      const col = weekdays.indexOf(wd);
      if (col < 0) continue;
      const sorted = [...new Set(indices)].sort((a, b) => a - b);

      const flush = (start: number, end: number) => {
        const rowStart = rows.indexOf(PERIODS[start]);
        if (rowStart < 0) return;
        blocks.push({
          key: `${course.course_id}-${wd}-${start}`,
          course,
          column: col + 2, // +1 給時間軸欄,grid 從 1 起算
          rowStart: rowStart + 2, // +1 給星期標頭列
          span: end - start + 1,
          color: bg,
          textColor: fg,
        });
      };

      // 掃一遍切出連續區段
      let segStart = sorted[0];
      let prev = sorted[0];
      for (const i of sorted.slice(1)) {
        if (i !== prev + 1) {
          flush(segStart, prev);
          segStart = i;
        }
        prev = i;
      }
      flush(segStart, prev);
    }
  }

  return {
    rows,
    weekdays,
    blocks,
    undated: courses.filter((c) => !c.slots?.length),
  };
}
