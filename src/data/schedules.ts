// 데모 데이터(SPEC 3장). 실제 일정 날짜는 바꾸지 않고 "가정"(assumed: true) 값만 조정한다.
// 무게는 SPEC 2-2 표를 그대로 이 파일에서 계산한다(계산 모듈에 런타임 의존하지 않아 불러오는 순서와 무관).
import type { Schedule, Grade, ScheduleType, Difficulty } from '../types';

// ── 날짜 도우미(UTC 정수 일수, 시간대 무관) ──
function prevDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) - 86400000);
  return t.toISOString().slice(0, 10);
}

const D = (md: string): string => (md.startsWith('01-') ? `2027-${md}` : `2026-${md}`);

interface Base {
  id: string; name: string; type: ScheduleType; grade: Grade;
  due: string; eventDate?: string; w: number; L: number; p: number;
  fixed: boolean; internal: boolean; optional: boolean;
  difficulty?: Difficulty; subject?: string; period?: { start: string; end: string };
  assumed?: boolean;
}
function mk(b: Base): Schedule {
  const s: Schedule = { ...b, status: 'confirmed', source: 'demo', defaultW: b.w };
  if (!s.assumed) delete s.assumed;
  return s;
}

// ── 지필시험: 과목 준비 일수(수학 28 · 물리·화학 21 · 생명·지구 14 · 나머지 7)에 비례해 학년 전체 무게를 나눈다 ──
function subjectL(subject: string): number {
  if (/수학|대수|미적분/.test(subject)) return 28;
  if (/물리|화학/.test(subject)) return 21;
  if (/생명|지구/.test(subject)) return 14;
  return 7;
}
function examSet(grade: Grade, prefix: string, label: string, days: [string, [string, string][]][]): Schedule[] {
  const total = grade === 1 ? 8 : 7;
  const all = days.flatMap(([, subs]) => subs);
  const sumL = all.reduce((a, [, subj]) => a + subjectL(subj), 0);
  return days.flatMap(([md, subs]) =>
    subs.map(([key, subj]) => {
      const L = subjectL(subj);
      const event = D(md);
      return mk({
        id: `g${grade}-${prefix}-${key}`, name: `${label} ${subj}`, type: 'exam', grade,
        due: prevDay(event), eventDate: event, w: (total * L) / sumL, L, p: 1,
        fixed: true, internal: true, optional: false, subject: subj,
        assumed: true, // 과목별 시험일은 가정 배치
      });
    }),
  );
}

// 1학년 과목(10) · 2학년 과목(9, 가정) · 3학년 2차 과목(7, 가정)
const G1_MID: [string, [string, string][]][] = [
  ['10-14', [['alg', '수학(대수)'], ['kor', '국어'], ['info', '정보']]],
  ['10-15', [['phy', '물리학'], ['chem', '화학'], ['eng', '영어'], ['isci', '통합과학']]],
  ['10-16', [['calc', '수학(미적분Ⅱ)'], ['bio', '생명과학'], ['earth', '지구과학']]],
];
const G1_FINAL: [string, [string, string][]][] = [
  ['12-08', [['alg', '수학(대수)'], ['kor', '국어'], ['info', '정보']]],
  ['12-09', [['phy', '물리학'], ['chem', '화학']]],
  ['12-10', [['calc', '수학(미적분Ⅱ)'], ['eng', '영어'], ['earth', '지구과학']]],
  ['12-11', [['bio', '생명과학'], ['isci', '통합과학']]],
];
const G23_MID: [string, [string, string][]][] = [
  ['10-14', [['math1', '수학Ⅰ'], ['kor', '국어'], ['info', '정보']]],
  ['10-15', [['phy', '물리학'], ['chem', '화학'], ['eng', '영어']]],
  ['10-16', [['math2', '수학Ⅱ'], ['bio', '생명과학'], ['earth', '지구과학']]],
];
const G2_FINAL: [string, [string, string][]][] = [
  ['12-08', [['math1', '수학Ⅰ'], ['kor', '국어'], ['info', '정보']]],
  ['12-09', [['phy', '물리학'], ['chem', '화학']]],
  ['12-10', [['math2', '수학Ⅱ'], ['eng', '영어'], ['earth', '지구과학']]],
  ['12-11', [['bio', '생명과학']]],
];
const G3_SECOND: [string, [string, string][]][] = [
  ['11-04', [['math1', '수학Ⅰ'], ['kor', '국어']]],
  ['11-05', [['phy', '물리학'], ['chem', '화학'], ['eng', '영어']]],
  ['11-06', [['math2', '수학Ⅱ'], ['bio', '생명과학']]],
];

// ── 수행평가·자기평가서 기본값(난이도) ──
const DIFF: Record<Difficulty, { w: number; L: number }> = { easy: { w: 0.5, L: 2 }, medium: { w: 1.5, L: 5 }, hard: { w: 3, L: 10 } };
function task(type: 'performance' | 'self_eval', grade: Grade, id: string, name: string, md: string, difficulty: Difficulty, assumed = false, subject?: string): Schedule {
  const { w, L } = DIFF[difficulty];
  return mk({ id, name, type, grade, due: D(md), w, L, p: 1, fixed: false, internal: true, optional: false, difficulty, subject, assumed });
}
const perf = (g: Grade, id: string, name: string, md: string, d: Difficulty, assumed = false, subject?: string) => task('performance', g, id, name, md, d, assumed, subject);
const selfEval = (g: Grade, id: string, name: string, md: string, d: Difficulty, assumed = false, subject?: string) => task('self_eval', g, id, name, md, d, assumed, subject);

// ── 학교 행사(전 학년) ──
function allGrades(make: (g: Grade) => Schedule): Schedule[] { return ([1, 2, 3] as Grade[]).map(make); }

// 교내 일반대회 참가 비율(가정) · 축제 준비 참여 비율(가정)
const GENERAL_CONTEST_P = 0.5;
const FESTIVAL_P = 0.4;

const SCHOOL_EVENTS: Schedule[] = [
  ...allGrades((g) => mk({
    id: `g${g}-contest-1216`, name: '교내 수학·과학 경시대회 · 문제해결프로그래밍 경진대회', type: 'general_contest', grade: g,
    due: '2026-12-15', eventDate: '2026-12-16', w: 1, L: 5, p: GENERAL_CONTEST_P,
    fixed: false, internal: true, optional: true, assumed: true,
  })),
  ...allGrades((g) => mk({
    id: `g${g}-festival`, name: '축제 준비', type: 'school_event', grade: g,
    due: '2026-12-23', eventDate: '2026-12-24', w: 2, L: 7, p: FESTIVAL_P,
    fixed: true, internal: true, optional: true, assumed: true,
  })),
];

// ── 1학년 ──
const G1: Schedule[] = [
  ...examSet(1, 'mid', '2학기 1차 시험', G1_MID),
  ...examSet(1, 'final', '2학기 기말고사', G1_FINAL),
  mk({
    id: 'g1-creative-final', name: '창의연구발표회', type: 'research_final', grade: 1,
    due: '2026-11-09', eventDate: '2026-11-10', w: 6, L: 21, p: 1, fixed: true, internal: true, optional: true,
  }),
  mk({
    id: 'g1-rne-final', name: '창의재단 R&E 최종 발표 기간', type: 'research_final', grade: 1,
    due: '2026-12-11', period: { start: '2026-11-30', end: '2026-12-11' }, w: 3, L: 7, p: 0.4,
    fixed: true, internal: false, optional: true, assumed: true, // 참여 비율 0.4(가정)
  }),
  perf(1, 'g1-perf-kor', '국어 수행평가', '11-24', 'easy', false, '국어'),
  perf(1, 'g1-perf-info', '정보 수행평가', '12-01', 'medium', false, '정보'),
  perf(1, 'g1-perf-phy', '물리 수행평가', '12-14', 'medium', false, '물리학'),
  perf(1, 'g1-perf-bio', '생명과학 수행평가', '11-20', 'hard', false, '생명과학'),
  selfEval(1, 'g1-self-calc', '자기평가서 — 수학(미적분Ⅱ)', '12-22', 'medium', true, '수학(미적분Ⅱ)'),
  selfEval(1, 'g1-self-bio', '자기평가서 — 생명과학', '12-23', 'medium', true, '생명과학'),
  selfEval(1, 'g1-self-phy', '자기평가서 — 물리', '12-28', 'medium', true, '물리학'),
  selfEval(1, 'g1-self-earth', '자기평가서 — 지구과학', '12-30', 'medium', true, '지구과학'),
  // 가정 채움(아주 가볍게: 9월 초·11월 중순)
  perf(1, 'g1-perf-eng', '영어 수행평가', '09-11', 'easy', true, '영어'),
  mk({
    id: 'g1-club', name: '동아리 소개 발표', type: 'club', grade: 1,
    due: '2026-09-17', w: 2, L: 7, p: 0.3, fixed: false, internal: true, optional: true, assumed: true,
  }),
];

// ── 대학 입시(2·3학년) ──
interface Uni { key: string; name: string; doc: string; docName: string; interview: string; p2: number; p3: number; docAssumed?: boolean }
const UNIS: Uni[] = [
  { key: 'kaist', name: 'KAIST', doc: '09-09', docName: '원서·자기소개서', interview: '11-26', p2: 0.15, p3: 0.15 },
  { key: 'snu', name: '서울대', doc: '09-10', docName: '서류 업로드', interview: '11-27', p2: 0.15, p3: 0.05 },
  { key: 'postech', name: 'POSTECH', doc: '09-09', docName: '원서', interview: '11-28', p2: 0.18, p3: 0.18 },
  { key: 'skku', name: '성균관대', doc: '09-11', docName: '수시 원서접수', interview: '12-06', p2: 0.3, p3: 0.7, docAssumed: true },
  { key: 'hyu', name: '한양대', doc: '09-14', docName: '서류 업로드', interview: '11-22', p2: 0.2, p3: 0.47 },
];
function admissions(g: 2 | 3): Schedule[] {
  return UNIS.flatMap((u) => {
    const p = g === 2 ? u.p2 : u.p3;
    const event = D(u.interview);
    return [
      mk({
        id: `g${g}-adm-${u.key}-doc`, name: `${u.name} ${u.docName}`, type: 'admission_doc', grade: g,
        due: D(u.doc), w: 3, L: 14, p, fixed: true, internal: false, optional: true, assumed: u.docAssumed,
      }),
      mk({
        id: `g${g}-adm-${u.key}-interview`, name: `${u.name} 면접`, type: 'admission_interview', grade: g,
        due: prevDay(event), eventDate: event, w: 5, L: 21, p, fixed: true, internal: false, optional: true,
      }),
    ];
  });
}

// ── 2학년 ──
const G2: Schedule[] = [
  ...examSet(2, 'mid', '2학기 1차 시험', G23_MID),
  ...examSet(2, 'final', '2학기 기말고사', G2_FINAL),
  ...admissions(2),
  // 가정 채움
  perf(2, 'g2-perf-kor', '국어 수행평가', '09-25', 'easy', true, '국어'),
  perf(2, 'g2-perf-chem', '화학 실험 수행평가', '10-02', 'hard', true, '화학'),
  perf(2, 'g2-perf-eng', '영어 발표 수행평가', '10-30', 'medium', true, '영어'),
  perf(2, 'g2-perf-phy', '물리 탐구 수행평가', '11-19', 'hard', true, '물리학'),
  perf(2, 'g2-perf-info', '정보 프로젝트 수행평가', '12-18', 'medium', true, '정보'),
  mk({
    id: 'g2-olympiad', name: '교외 과학 올림피아드', type: 'contest', grade: 2,
    due: '2026-11-13', eventDate: '2026-11-14', w: 4, L: 14, p: 0.3, fixed: true, internal: false, optional: true, assumed: true,
  }),
  mk({
    id: 'g2-rne-mid', name: 'R&E 중간 발표', type: 'research_mid', grade: 2,
    due: '2026-10-22', eventDate: '2026-10-23', w: 4.5, L: 7, p: 0.4, fixed: false, internal: false, optional: true, assumed: true,
  }),
  mk({
    id: 'g2-club', name: '동아리 프로젝트 발표', type: 'club', grade: 2,
    due: '2026-12-29', w: 2, L: 7, p: 0.5, fixed: false, internal: true, optional: true, assumed: true,
  }),
];

// ── 3학년 ──
const G3: Schedule[] = [
  ...examSet(3, 'mid', '2학기 1차 시험', G23_MID),
  ...examSet(3, 'second', '2학기 2차 시험', G3_SECOND),
  ...admissions(3),
  // 가정 채움
  perf(3, 'g3-perf-kor', '국어 수행평가', '09-18', 'easy', true, '국어'),
  perf(3, 'g3-perf-eng', '영어 수행평가', '10-07', 'medium', true, '영어'),
  perf(3, 'g3-perf-bio', '생명과학 탐구 수행평가', '10-28', 'hard', true, '생명과학'),
  perf(3, 'g3-perf-math', '수학 과제 수행평가', '11-26', 'medium', true, '수학Ⅱ'),
  perf(3, 'g3-perf-chem', '화학 실험 수행평가', '11-27', 'hard', true, '화학'),
  mk({
    id: 'g3-contest', name: '교외 과학 탐구대회', type: 'contest', grade: 3,
    due: '2026-10-09', eventDate: '2026-10-10', w: 4, L: 14, p: 0.2, fixed: true, internal: false, optional: true, assumed: true,
  }),
  mk({
    id: 'g3-club', name: '동아리 활동 발표', type: 'club', grade: 3,
    due: '2026-12-18', w: 2, L: 7, p: 0.4, fixed: false, internal: true, optional: true, assumed: true,
  }),
];

export const DEMO_SCHEDULES: Schedule[] = [...G1, ...G2, ...G3, ...SCHOOL_EVENTS];
