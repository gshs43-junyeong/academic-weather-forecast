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
const NI = (): never => { throw new Error('not implemented'); };

/** 'YYYY-MM-DD' → 정수 일수(시간대 무관) */
export function dayNumber(_date: string): number { return NI(); }
export function dateOf(_n: number): string { return NI(); }
export function addDays(_date: string, _n: number): string { return NI(); }
/** a - b (일) */
export function diffDays(_a: string, _b: string): number { return NI(); }
/** 학기 주 번호 0~17, 학기 밖이면 -1. 한 주는 월요일 시작 */
export function weekIndexOf(_date: string): number { return NI(); }
export function weekRange(_index: number): { start: string; end: string } { return NI(); }
/** 주말 또는 공휴일(학기 중 공휴일 목록은 이 모듈에 상수로 둔다) */
export function isWeekendOrHoliday(_date: string): boolean { return NI(); }
/** 준비 분포: L일 중 k번째 날(첫날 k=0)의 면적 = (2k+1) ÷ L² */
export function prepArea(_L: number, _k: number): number { return NI(); }
/** 일정 하나가 그날 주는 부하 = w × p × 분포 면적(기간형 포함) */
export function scheduleDayLoad(_s: Schedule, _date: string): number { return NI(); }
/** 학년 필터 없이 주어진 일정들의 한 주(월요일 weekStart부터 7일) 부하 합 — 계산 예시 테스트용 */
export function weekLoad(_schedules: Schedule[], _weekStart: string): number { return NI(); }
export function weatherOf(_R: number): Weather { return NI(); }
/** 학년 18주 예보 */
export function forecast(_schedules: Schedule[], _grade: Grade, _opts?: ForecastOptions): GradeForecast { return NI(); }
/** 이동. 고정이면 거부. due와 eventDate·period를 같은 일수만큼 옮긴 새 배열을 돌려준다(원본 불변) */
export function moveSchedule(_schedules: Schedule[], _id: string, _newDue: string): MoveResult { return NI(); }
/** 맑은 주 추천 TOP 3 (SPEC 2-2). target이 schedules 안에 있으면 그 일정을 옮기는 것으로, 없으면 새로 넣는 것으로 계산. baseDate 기본 = target.due */
export function recommendDates(_schedules: Schedule[], _target: Schedule, _opts?: { baseDate?: string; today?: string; count?: number }): Recommendation[] { return NI(); }
/** 저장 전 미리보기: draft를 넣었을 때 준비 구간이 걸치는 주들의 전후 */
export function previewAdd(_schedules: Schedule[], _draft: Schedule): AddPreview { return NI(); }
/** 시험 과목 준비 일수(수학 28 · 물리·화학 21 · 생명·지구 14 · 나머지 7). 과목명에 '수학','대수','미적분' 포함이면 수학 */
export function examSubjectL(_subject: string): number { return NI(); }
/** 학년 시험 기간 전체 무게(1학년 8, 2·3학년 7)를 과목 준비 일수 비율로 나눈다 */
export function examWeights(_grade: Grade, _subjects: string[]): { subject: string; L: number; w: number }[] { return NI(); }
/** 2-2 표의 기본값. exam은 과목 하나의 L만 의미가 있고 w는 examWeights로 구한다 */
export function defaultsFor(_type: ScheduleType, _opts?: { difficulty?: Difficulty; internal?: boolean; grade?: Grade; subject?: string }): TypeDefaults { return NI(); }
/** 계산 예시(SPEC 2-3 테스트 2)의 가상 일정 4개와 기준 주 월요일. W̄ = 4.5 */
export const EXAMPLE: { schedules: Schedule[]; weekStart: string; baseline: number } = { schedules: [], weekStart: '2026-11-02', baseline: 4.5 };
