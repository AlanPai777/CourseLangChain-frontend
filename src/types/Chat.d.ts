interface ChatMessage {
  input: string
  output: string;
  time: Date;
}

/**
 * 後端 SSE 側通道送來的候選課程(payload: { type: "courses", courses: [...] })。
 *
 * course_id 直接取自 query_courses_tool 的輸出、不經 LLM 轉述,所以可以安心
 * 拿去打 /api/schedule;credits 是原樣帶回的字串("3"、"3.0"),只用於顯示。
 */
interface CourseCandidate {
  course_id: string;
  name: string;
  time: string;
  teacher: string;
  credits: string;
}