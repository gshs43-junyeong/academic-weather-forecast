// 공지문 해석 모듈(SPEC 2-4). 규칙 기반, 외부 요청 없음, 화면 요소에 접근하지 않는다.
import type { Difficulty, Evidence, Grade, ParsedField, ParsedNotice, ScheduleType } from '../types';
import { defaultsFor, SEMESTER, TYPE_LABEL } from '../calc';

export const MAX_NOTICE_LENGTH = 2000;

const SUBJECTS = ['미적분', '대수', '수학', '물리', '화학', '생명과학', '지구과학', '통합과학', '국어', '영어', '정보'];

interface Hit { start: number; end: number; }
interface FoundDate { start: number; end: number; date: string; }

const ev = (h: Hit | null | undefined): Evidence[] => (h ? [{ start: h.start, end: h.end }] : []);
const empty = <T>(): ParsedField<T> => ({ value: null, evidence: [] });

/** 키워드 중 가장 먼저 나오는 위치 */
function findFirst(text: string, words: string[]): Hit | null {
  let best: Hit | null = null;
  for (const w of words) {
    const i = text.indexOf(w);
    if (i >= 0 && (!best || i < best.start || (i === best.start && w.length > best.end - best.start))) best = { start: i, end: i + w.length };
  }
  return best;
}

const pad = (n: number) => String(n).padStart(2, '0');

function validDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** 날짜 4형식("12월 11일", "12/11", "12.11", "12. 11.")을 모두 찾는다. 요일 "(금)"은 무시. */
export function findDates(text: string): FoundDate[] {
  const re = /(?<![\d.])(?:(20\d{2})\s*[년.\-/]\s*)?(\d{1,2})\s*(?:월\s*(\d{1,2})\s*일|\/\s*(\d{1,2})|\.\s*(\d{1,2})(?!\d)\.?)(?![\d:])/g;
  const out: FoundDate[] = [];
  for (const m of text.matchAll(re)) {
    const month = Number(m[2]);
    const day = Number(m[3] ?? m[4] ?? m[5]);
    const year = m[1] ? Number(m[1]) : month >= 8 ? SEMESTER.year : SEMESTER.year + 1;
    if (!validDate(year, month, day)) continue;
    const start = m.index!;
    out.push({ start, end: start + m[0].length, date: `${year}-${pad(month)}-${pad(day)}` });
  }
  return out;
}

function lineOf(text: string, pos: number): string {
  const s = text.lastIndexOf('\n', pos - 1) + 1;
  let e = text.indexOf('\n', pos);
  if (e < 0) e = text.length;
  return text.slice(s, e);
}

/** 마감 우선순위: 마감·제출·접수 마감·까지 > 일시·일자·대회일·발표일 > 기간("~")의 마지막 날 */
function pickDue(text: string, dates: FoundDate[]): FoundDate | null {
  if (dates.length === 0) return null;
  const tier = (d: FoundDate, i: number): number => {
    const line = lineOf(text, d.start);
    if (/마감|제출|까지/.test(line)) return 1;
    if (/일시|일자|대회일|발표일/.test(line)) return 2;
    if (i > 0 && /^\s*(?:\([월화수목금토일]\))?\s*[~∼～]\s*$/.test(text.slice(dates[i - 1].end, d.start))) return 3;
    return 4;
  };
  let best: { d: FoundDate; t: number } | null = null;
  dates.forEach((d, i) => {
    const t = tier(d, i);
    if (!best || t < best.t || (t === best.t && d.date > best.d.date)) best = { d, t };
  });
  return best!.d;
}

const TYPE_RULES: { type: ScheduleType | 'research'; words: string[] }[] = [
  { type: 'exam', words: ['지필', '중간고사', '기말고사'] },
  { type: 'research', words: ['R&E', '창의연구', '연구 발표회', '중간 발표', '최종 보고서'] },
  { type: 'contest', words: ['탐구대회', '경시대회', '올림피아드'] },
  { type: 'performance', words: ['수행평가', '수행'] },
  { type: 'general_contest', words: ['글쓰기', '포스터', 'UCC', '공모전'] },
  { type: 'self_eval', words: ['자기평가서', '자평'] },
  { type: 'school_event', words: ['축제', '체육대회'] },
  { type: 'club', words: ['동아리'] },
];

function findType(text: string): { type: ScheduleType; hit: Hit } | null {
  for (const r of TYPE_RULES) {
    const hit = findFirst(text, r.words);
    if (!hit) continue;
    if (r.type !== 'research') return { type: r.type, hit };
    const isMid = findFirst(text, ['중간 발표', '중간']);
    const isFinal = findFirst(text, ['최종 보고서', '최종', '발표회']);
    // "중간 발표회"처럼 둘 다 있으면 중간 표현을 먼저 본다.
    return { type: isMid ? 'research_mid' : 'research_final', hit: isMid ?? isFinal ?? hit };
  }
  // 과목명만 있으면 시험
  const subj = findFirst(text, SUBJECTS);
  if (subj) return { type: 'exam', hit: subj };
  return null;
}

function findDifficulty(text: string, type: ScheduleType | null): { value: Difficulty; hit: Hit | null } | null {
  if (type === 'performance') {
    const hard = findFirst(text, ['실험', '탐구', '발표']);
    if (hard) return { value: 'hard', hit: hard };
    const easy = findFirst(text, ['수업 시간 중', '수업 시간 내']);
    if (easy) return { value: 'easy', hit: easy };
    return { value: 'medium', hit: null };
  }
  if (type === 'self_eval') {
    const hard = findFirst(text, ['보고서']);
    if (hard) return { value: 'hard', hit: hard };
    const easy = findFirst(text, ['간단히', '몇 줄', '나열']);
    if (easy) return { value: 'easy', hit: easy };
    return { value: 'medium', hit: null };
  }
  return null;
}

function findGrades(text: string): ParsedField<Grade[]> {
  const set = new Set<Grade>();
  const evid: Evidence[] = [];
  for (const m of text.matchAll(/전\s?학년|전교생/g)) {
    [1, 2, 3].forEach((g) => set.add(g as Grade));
    evid.push({ start: m.index!, end: m.index! + m[0].length });
  }
  for (const m of text.matchAll(/(?<!\d)([1-3](?:\s*[·,ㆍ]\s*[1-3])*)\s*학년/g)) {
    for (const c of m[1].match(/[1-3]/g)!) set.add(Number(c) as Grade);
    evid.push({ start: m.index!, end: m.index! + m[0].length });
  }
  if (set.size === 0) return empty();
  return { value: [...set].sort((a, b) => a - b), evidence: evid.sort((a, b) => a.start - b.start) };
}

function findInternal(text: string): ParsedField<boolean> {
  const inHit = findFirst(text, ['교내', '본교']);
  if (inHit) return { value: true, evidence: ev(inHit) };
  const outHit = findFirst(text, ['시·도', '시도', '전국', '대한민국']);
  if (outHit) return { value: false, evidence: ev(outHit) };
  for (const m of text.matchAll(/(?:주최|주관)\s*[:：]?\s*([^\n]+)/g)) {
    const org = m[1].trim();
    if (org && !/학교|고등학교|본교|교내/.test(org)) {
      const s = m.index! + m[0].indexOf(org);
      return { value: false, evidence: [{ start: s, end: s + org.length }] };
    }
  }
  return empty();
}

const HEAD_RE = /^[\s■□◆◇●○▶▷※★☆#*\-–—·•]*(?:[\[【(〔]\s*(?:공지|안내|알림|공고|필독|중요)\s*[\]】)〕]\s*)?[\s■□◆◇●○▶▷※★☆#*\-–—·•]*/;

function findName(text: string, type: ScheduleType | null, due: string | null): ParsedField<string> {
  const br = /「([^」\n]+)」|<([^>\n]+)>|〈([^〉\n]+)〉|《([^》\n]+)》/.exec(text);
  if (br) {
    const inner = (br[1] ?? br[2] ?? br[3] ?? br[4]).trim();
    const s = br.index + br[0].indexOf(inner);
    if (inner) return { value: inner, evidence: [{ start: s, end: s + inner.length }] };
  }
  let pos = 0;
  for (const line of text.split('\n')) {
    const head = HEAD_RE.exec(line)![0].length;
    const name = line.slice(head).replace(/[\s■□◆◇●○▶▷※★☆#*\-–—·•]+$/, '');
    if (name) return { value: name, evidence: [{ start: pos + head, end: pos + head + name.length }] };
    pos += line.length + 1;
  }
  if (type) return { value: `${TYPE_LABEL[type]}${due ? ` ${due}` : ''}`, evidence: [] };
  return empty();
}

/** 공지문을 해석한다. 찾지 못한 값은 value: null. 각 값의 근거 위치를 evidence로 돌려준다. */
export function parseNotice(text: string): ParsedNotice {
  const src = text ?? '';
  const t = findType(src);
  const type: ParsedField<ScheduleType> = t ? { value: t.type, evidence: ev(t.hit) } : empty();

  let subject: ParsedField<string> = empty();
  if (t?.type === 'exam') {
    const h = findFirst(src, SUBJECTS);
    if (h) subject = { value: src.slice(h.start, h.end), evidence: ev(h) };
  }

  const dz = findDifficulty(src, t?.type ?? null);
  const difficulty: ParsedField<Difficulty> = dz ? { value: dz.value, evidence: ev(dz.hit) } : empty();

  const dueHit = pickDue(src, findDates(src));
  const due: ParsedField<string> = dueHit ? { value: dueHit.date, evidence: ev(dueHit) } : empty();
  const dueOutOfSemester = !!dueHit && (dueHit.date < SEMESTER.start || dueHit.date > SEMESTER.end);

  const grades = findGrades(src);
  const internal = findInternal(src);

  let p: ParsedField<number> = empty();
  let fixed: ParsedField<boolean> = empty();
  if (t) {
    const d = defaultsFor(t.type, {
      difficulty: difficulty.value ?? undefined,
      internal: internal.value ?? undefined,
      subject: subject.value ?? undefined,
    });
    const opt = findFirst(src, ['희망자', '신청자', '선발']);
    const all = findFirst(src, ['전원', '전 학년', '필수']);
    if (opt) p = { value: d.p, evidence: ev(opt) };
    else if (all) p = { value: 1, evidence: ev(all) };
    else p = { value: d.p, evidence: [] };
    fixed = { value: d.fixed, evidence: [...type.evidence, ...(t.type === 'contest' || t.type === 'general_contest' ? internal.evidence : [])] };
  }

  const name = findName(src, t?.type ?? null, due.value);
  return { name, type, difficulty, subject, due, grades, p, internal, fixed, dueOutOfSemester };
}
