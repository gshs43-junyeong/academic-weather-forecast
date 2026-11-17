// 계산 모듈(SPEC 2-1~2-3). 화면 요소에 접근하지 않는다. 아래 시그니처는 계약이다 — 본문만 구현한다.
import type { Schedule, Grade, Weather, GradeForecast, ForecastOptions, MoveResult, Recommendation, AddPreview, TypeDefaults, ScheduleType, Difficulty } from '../types';

export const SEMESTER = { start: '2026-08-31', end: '2027-01-03', weeks: 18, today: '2026-11-17', year: 2026 } as const;
export const THRESHOLDS = { cloudy: 0.7, rain: 1.15, storm: 1.6 } as const;
export const WEATHER_LABEL: Record<Weather, string> = { sunny: '맑음', cloudy: '구름', rain: '비', storm: '폭풍' };
export const TYPE_LABEL: Record<ScheduleType, string> = {
  exam: '지필시험', research_final: '연구활동 최종', research_mid: '연구활동 중간', contest: '탐구대회·경시·올림피아드',
  performance: '수행평가', general_contest: '일반대회', self_eval: '자기평가서', school_event: '교내 행사',
  club: '동아리', personal: '개인 과제', admission_doc: '입시 서류', admission_interview: '입시 면접',
};
const DAY_MS = 86400000;
const EPS = 1e-9;

/** 'YYYY-MM-DD' → 정수 일수(시간대 무관) */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}
export function dateOf(n: number): string {
  const dt = new Date(n * DAY_MS);
  const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export function addDays(date: string, n: number): string { return dateOf(dayNumber(date) + n); }
/** a - b (일) */
export function diffDays(a: string, b: string): number { return dayNumber(a) - dayNumber(b); }
const SEM_START = dayNumber(SEMESTER.start);
const SEM_END = dayNumber(SEMESTER.end);
/** 날짜가 학기 안인지 */
export function inSemester(date: string): boolean { const n = dayNumber(date); return n >= SEM_START && n <= SEM_END; }
/** 학기 주 번호 0~17, 학기 밖이면 -1. 한 주는 월요일 시작 */
export function weekIndexOf(date: string): number {
  const n = dayNumber(date);
  if (n < SEM_START || n > SEM_END) return -1;
  return Math.floor((n - SEM_START) / 7);
}
export function weekRange(index: number): { start: string; end: string } {
  const s = SEM_START + index * 7;
  return { start: dateOf(s), end: dateOf(s + 6) };
}
export const HOLIDAYS: readonly string[] = ['2026-09-24', '2026-09-25', '2026-09-26', '2026-10-03', '2026-10-05', '2026-10-09', '2026-12-25', '2027-01-01'];
/** 주말 또는 공휴일(학기 중 공휴일 목록은 이 모듈에 상수로 둔다) */
export function isWeekendOrHoliday(date: string): boolean {
  const dow = new Date(dayNumber(date) * DAY_MS).getUTCDay();
  return dow === 0 || dow === 6 || HOLIDAYS.includes(date);
}
/** 준비 분포: L일 중 k번째 날(첫날 k=0)의 면적 = (2k+1) ÷ L² */
export function prepArea(L: number, k: number): number {
  if (L <= 0 || k < 0 || k >= L) return 0;
  return (2 * k + 1) / (L * L);
}
/** 일정의 부하가 걸치는 날짜 구간 [start, end](일수) */
export function prepRange(s: Schedule): { start: number; end: number } {
  if (s.period) {
    const ps = dayNumber(s.period.start), pe = dayNumber(s.period.end);
    return { start: ps - 7, end: Math.max(pe, ps) };
  }
  const due = dayNumber(s.due);
  return { start: due - s.L + 1, end: due };
}
function dayLoadN(s: Schedule, n: number): number {
  const wp = s.w * s.p;
  if (wp === 0) return 0;
  if (s.period) {
    const ps = dayNumber(s.period.start), pe = dayNumber(s.period.end);
    let v = 0;
    v += (wp / 2) * prepArea(7, n - (ps - 7));
    const len = pe - ps + 1;
    if (len > 0 && n >= ps && n <= pe) v += (wp / 2) / len;
    return v;
  }
  const due = dayNumber(s.due);
  return wp * prepArea(s.L, n - (due - s.L + 1));
}
/** 일정 하나가 그날 주는 부하 = w × p × 분포 면적(기간형 포함) */
export function scheduleDayLoad(s: Schedule, date: string): number { return dayLoadN(s, dayNumber(date)); }
/** 학년 필터 없이 주어진 일정들의 한 주(월요일 weekStart부터 7일) 부하 합 — 계산 예시 테스트용 */
export function weekLoad(schedules: Schedule[], weekStart: string): number {
  const s0 = dayNumber(weekStart);
  let t = 0;
  for (const s of schedules) for (let i = 0; i < 7; i++) t += dayLoadN(s, s0 + i);
  return t;
}
export function weatherOf(R: number): Weather {
  if (R + EPS < THRESHOLDS.cloudy) return 'sunny';
  if (R + EPS < THRESHOLDS.rain) return 'cloudy';
  if (R + EPS < THRESHOLDS.storm) return 'rain';
  return 'storm';
}
function effective(schedules: Schedule[], grade: Grade, opts?: ForecastOptions): Schedule[] {
  return schedules
    .filter((s) => s.grade === grade && !(opts?.includeReported === false && s.status === 'reported'))
    .map((s) => (opts?.personal && s.optional ? { ...s, p: opts.personal.checkedIds.includes(s.id) ? 1 : 0 } : s));
}
/** 학년 18주 예보 */
export function forecast(schedules: Schedule[], grade: Grade, opts?: ForecastOptions): GradeForecast {
  const list = effective(schedules, grade, opts);
  const raw = Array.from({ length: SEMESTER.weeks }, (_, i) => {
    const s0 = SEM_START + i * 7;
    const dayLoads = Array.from({ length: 7 }, (_, d) => list.reduce((a, s) => a + dayLoadN(s, s0 + d), 0));
    const contributions = list
      .map((s) => {
        let v = 0;
        for (let d = 0; d < 7; d++) v += dayLoadN(s, s0 + d);
        return { scheduleId: s.id, name: s.name, type: s.type, value: v, fixed: s.fixed };
      })
      .filter((c) => c.value > 1e-12)
      .sort((a, b) => b.value - a.value);
    return { s0, dayLoads, W: dayLoads.reduce((a, b) => a + b, 0), contributions };
  });
  const baseline = opts?.baseline ?? raw.reduce((a, r) => a + r.W, 0) / SEMESTER.weeks;
  const dayBase = baseline / 7;
  const weeks = raw.map((r, index) => {
    const R = baseline > 0 ? r.W / baseline : 0;
    return {
      index, start: dateOf(r.s0), end: dateOf(r.s0 + 6), W: r.W, R, weather: weatherOf(R),
      days: r.dayLoads.map((load, d) => {
        const dr = dayBase > 0 ? load / dayBase : 0;
        return { date: dateOf(r.s0 + d), load, R: dr, weather: weatherOf(dr) };
      }),
      contributions: r.contributions,
    };
  });
  return { grade, baseline, weeks };
}
function shift(s: Schedule, delta: number): Schedule {
  const out: Schedule = { ...s, due: addDays(s.due, delta) };
  if (s.eventDate) out.eventDate = addDays(s.eventDate, delta);
  if (s.startDate) out.startDate = addDays(s.startDate, delta);
  if (s.period) out.period = { start: addDays(s.period.start, delta), end: addDays(s.period.end, delta) };
  return out;
}
/** 이동. 고정이면 거부. due와 eventDate·period를 같은 일수만큼 옮긴 새 배열을 돌려준다(원본 불변) */
export function moveSchedule(schedules: Schedule[], id: string, newDue: string): MoveResult {
  const t = schedules.find((s) => s.id === id);
  if (!t) return { ok: false, reason: 'not_found' };
  if (t.fixed) return { ok: false, reason: 'fixed' };
  if (!inSemester(newDue)) return { ok: false, reason: 'out_of_semester' };
  const delta = diffDays(newDue, t.due);
  return { ok: true, schedules: schedules.map((s) => (s.id === id ? shift(s, delta) : s)) };
}
function coveredWeeks(s: Schedule): number[] {
  const r = prepRange(s);
  const set = new Set<number>();
  for (let n = r.start; n <= r.end; n++) { const w = weekIndexOf(dateOf(n)); if (w >= 0) set.add(w); }
  return [...set].sort((a, b) => a - b);
}
function maxROver(fc: GradeForecast, idx: number[]): number {
  return idx.reduce((m, i) => Math.max(m, fc.weeks[i].R), 0);
}
/** 맑은 주 추천 TOP 3 (SPEC 2-2). target이 schedules 안에 있으면 그 일정을 옮기는 것으로, 없으면 새로 넣는 것으로 계산. baseDate 기본 = target.due */
export function recommendDates(schedules: Schedule[], target: Schedule, opts?: { baseDate?: string; today?: string; count?: number }): Recommendation[] {
  if (target.fixed) return [];
  const base = opts?.baseDate ?? target.due;
  const today = dayNumber(opts?.today ?? SEMESTER.today);
  const count = opts?.count ?? 3;
  const existing = schedules.find((s) => s.id === target.id);
  const others = schedules.filter((s) => s.id !== target.id);
  const res: (Recommendation & { dist: number })[] = [];
  for (const off of [-21, -14, -7, 0, 7, 14, 21]) {
    if (off === 0 && existing) continue;
    const date = addDays(base, off);
    if (!inSemester(date) || dayNumber(date) <= today || isWeekendOrHoliday(date)) continue;
    const src = existing ?? target;
    const placed = shift(src, diffDays(date, src.due));
    const fc = forecast([...others, placed], target.grade);
    const idx = coveredWeeks(placed);
    const maxR = maxROver(fc, idx);
    res.push({ date, weekIndex: weekIndexOf(date), maxR, weather: weatherOf(maxR), dist: Math.abs(off) });
  }
  res.sort((a, b) => (Math.abs(a.maxR - b.maxR) > EPS ? a.maxR - b.maxR : a.dist - b.dist));
  return res.slice(0, count).map(({ dist: _d, ...r }) => r);
}
/** 저장 전 미리보기: draft를 넣었을 때 준비 구간이 걸치는 주들의 전후 */
export function previewAdd(schedules: Schedule[], draft: Schedule): AddPreview {
  const before = forecast(schedules, draft.grade);
  const after = forecast([...schedules, draft], draft.grade);
  const idx = coveredWeeks(draft);
  const weeks = idx.map((i) => ({ index: i, beforeR: before.weeks[i].R, beforeWeather: before.weeks[i].weather, R: after.weeks[i].R, weather: after.weeks[i].weather }));
  const maxR = maxROver(after, idx);
  return { weeks, maxR, storm: weatherOf(maxR) === 'storm' };
}
/** 시험 과목 준비 일수(수학 28 · 물리·화학 21 · 생명·지구 14 · 나머지 7). 과목명에 '수학','대수','미적분' 포함이면 수학 */
export function examSubjectL(subject: string): number {
  if (/수학|대수|미적분/.test(subject)) return 28;
  if (/물리|화학/.test(subject)) return 21;
  if (/생명|지구/.test(subject)) return 14;
  return 7;
}
export function examTotalWeight(grade: Grade): number { return grade === 1 ? 8 : 7; }
/** 학년 시험 기간 전체 무게(1학년 8, 2·3학년 7)를 과목 준비 일수 비율로 나눈다 */
export function examWeights(grade: Grade, subjects: string[]): { subject: string; L: number; w: number }[] {
  const Ls = subjects.map(examSubjectL);
  const sum = Ls.reduce((a, b) => a + b, 0);
  return subjects.map((subject, i) => ({ subject, L: Ls[i], w: sum > 0 ? (examTotalWeight(grade) * Ls[i]) / sum : 0 }));
}
/** 2-2 표의 기본값. exam은 과목 하나의 L만 의미가 있고 w는 examWeights로 구한다 */
export function defaultsFor(type: ScheduleType, opts?: { difficulty?: Difficulty; internal?: boolean; grade?: Grade; subject?: string }): TypeDefaults {
  const internal = opts?.internal ?? true;
  const diff = opts?.difficulty ?? 'medium';
  const byDiff = { easy: { w: 0.5, L: 2 }, medium: { w: 1.5, L: 5 }, hard: { w: 3, L: 10 } }[diff];
  switch (type) {
    case 'exam': {
      const grade = opts?.grade ?? 1;
      const L = examSubjectL(opts?.subject ?? '');
      return { w: (examTotalWeight(grade) * (L / 7)) / (grade === 1 ? 22 : 21), L, p: 1, fixed: true, optional: false };
    }
    case 'research_final': return { w: 6, L: 21, p: 1, fixed: true, optional: true };
    case 'research_mid': return { w: 4.5, L: 7, p: 1, fixed: false, optional: true };
    case 'contest': return { w: 4, L: 14, p: 0.2, fixed: !internal, optional: true };
    case 'performance':
    case 'self_eval': return { ...byDiff, p: 1, fixed: false, optional: false };
    case 'general_contest': return { w: 1, L: 5, p: internal ? 0.5 : 0.3, fixed: !internal, optional: true };
    case 'school_event': return { w: 2, L: 7, p: 0.4, fixed: true, optional: true };
    case 'club': return { w: 2, L: 7, p: 0.5, fixed: false, optional: true };
    case 'personal': return { w: 1, L: 7, p: 1, fixed: false, optional: false };
    case 'admission_doc': return { w: 3, L: 14, p: 0.2, fixed: true, optional: true };
    case 'admission_interview': return { w: 5, L: 21, p: 0.2, fixed: true, optional: true };
  }
}
function ex(id: string, name: string, w: number, L: number, p: number): Schedule {
  return { id, name, type: 'personal', grade: 1, due: '2026-11-08', w, L, p, fixed: false, internal: true, status: 'confirmed', optional: false, defaultW: w, source: 'demo' };
}
/** 계산 예시(SPEC 2-3 테스트 2)의 가상 일정 4개와 기준 주 월요일. W̄ = 4.5 */
export const EXAMPLE: { schedules: Schedule[]; weekStart: string; baseline: number } = {
  schedules: [ex('ex-a', '예시 A', 5, 14, 1), ex('ex-b', '예시 B', 2, 7, 1), ex('ex-c', '예시 C', 2, 5, 0.6), ex('ex-d', '예시 D', 3, 10, 0.4)],
  weekStart: '2026-11-02',
  baseline: 4.5,
};
