/** 加班／請假備註字數上限（以 Unicode code point 計） */
export const OVERTIME_NOTE_MAX_LENGTH = 100;

const DIGIT_EMOJI = [
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
  "🔟",
] as const;

function lineNumberPrefix(index: number): string {
  return DIGIT_EMOJI[index] ?? String(index + 1);
}

/** 行首既有編號（數字 emoji 或純數字） */
const LINE_PREFIX_RE = /^(?:[0-9]\uFE0F?\u20E3|🔟|\d+[.\u3001]?)\s*/u;

function codePointLength(text: string): number {
  return Array.from(text).length;
}

export function clampOvertimeNote(text: string): string {
  const chars = Array.from(text);
  if (chars.length <= OVERTIME_NOTE_MAX_LENGTH) return text;
  return chars.slice(0, OVERTIME_NOTE_MAX_LENGTH).join("");
}

function stripLinePrefix(line: string): string {
  return line.replace(LINE_PREFIX_RE, "");
}

/**
 * 單行：不加編號。
 * 多行：每行前加 1️⃣ 2️⃣ …；僅在文字以 \\n 結尾時保留一個尾端空行（使用者剛按 Enter）。
 */
export function formatOvertimeNoteLines(text: string): string {
  const endsWithNewline = text.endsWith("\n");
  let lines = text.split("\n");

  if (!endsWithNewline) {
    while (lines.length > 1 && lines[lines.length - 1] === "") {
      lines.pop();
    }
  }

  if (lines.length <= 1) {
    return stripLinePrefix(lines[0] ?? "");
  }

  const bodies = lines.map(stripLinePrefix);
  const kept: string[] = [];

  for (let i = 0; i < bodies.length; i++) {
    const empty = bodies[i].trim() === "";
    const isLast = i === bodies.length - 1;
    if (!empty) {
      kept.push(bodies[i]);
    } else if (isLast && endsWithNewline) {
      kept.push("");
    }
  }

  const nonEmpty = kept.filter((b) => b.trim() !== "");
  if (nonEmpty.length <= 1 && kept.length <= 1) {
    return nonEmpty[0] ?? "";
  }

  return kept.map((b, i) => `${lineNumberPrefix(i)} ${b}`).join("\n");
}

/** 輸入過程：自動編號 */
export function applyOvertimeNoteInput(text: string): string {
  return clampOvertimeNote(formatOvertimeNoteLines(text));
}

/** 失焦／儲存：去掉尾端換行後格式化 */
export function finalizeOvertimeNote(text: string): string {
  return clampOvertimeNote(formatOvertimeNoteLines(text.replace(/\n+$/, "")));
}

/** 日曆等單行展示：換行改空白 */
export function flattenOvertimeNoteForDisplay(text: string): string {
  return clampOvertimeNote(text.replace(/\n/g, " ").trim());
}

export function overtimeNoteCharCount(text: string): number {
  return codePointLength(text);
}
