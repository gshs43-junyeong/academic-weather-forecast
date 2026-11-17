// 모듈 공용 타입(계약). 모든 모듈이 이 파일을 기준으로 한다. 임의로 바꾸지 말 것(필드 추가는 선택 필드로만).
export type Grade = 1 | 2 | 3;
export type Role = 'student' | 'teacher';
export type Weather = 'sunny' | 'cloudy' | 'rain' | 'storm';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ScheduleType =
  | 'exam' // 지필시험(과목별)
  | 'research_final' // 연구활동 최종 발표·보고서(R&E, 창의연구)
  | 'research_mid' // 연구활동 중간 발표
  | 'contest' // 탐구대회·경시대회·올림피아드
  | 'performance' // 수행평가
  | 'general_contest' // 일반대회
  | 'self_eval' // 자기평가서
  | 'school_event' // 축제·체육대회 준비
  | 'club' // 동아리 활동
  | 'personal' // 개인 과제(MVP 4)
  | 'admission_doc' // 대학 입시 서류
  | 'admission_interview'; // 대학 입시 면접

/** 일정 하나. 학년마다 따로 등록한다(여러 학년 대상이면 학년 수만큼 만든다). */
export interface Schedule {
  id: string;
  name: string;
  type: ScheduleType;
  grade: Grade;
  /** 준비 분포의 마지막 날 'YYYY-MM-DD'. 당일 아침 행사(시험·발표·면접)는 행사 전날. 기간형은 기간 마지막 날. */
  due: string;
  /** 화면에 보여 줄 실제 행사일(시험일·면접일). 없으면 due와 같다. 이동 시 due와 같은 일수만큼 함께 움직인다. */
  eventDate?: string;
  /** 무게 */
  w: number;
  /** 준비 일수(마감일 포함) */
  L: number;
  /** 참여율 0~1 */
  p: number;
  /** 고정 일정(이동 불가) */
  fixed: boolean;
  /** 교내 여부 */
  internal: boolean;
  difficulty?: Difficulty;
  /** 시험 과목 */
  subject?: string;
  /** 기간형 일정: 무게 절반은 start 전 7일 삼각형, 절반은 기간 안 모든 날에 균등 */
  period?: { start: string; end: string };
  /** 확정(교사) / 제보(학생, 점선) */
  status: 'confirmed' | 'reported';
  /** 선택 일정(연구활동·대회·동아리·축제 역할). 개인 기상도 체크 대상 */
  optional: boolean;
  /** 2-2 표의 기본 무게. 교사가 w를 직접 바꿨으면 w !== defaultW → "무게 조정" 표시 */
  defaultW: number;
  source: 'demo' | 'user';
  /** SPEC 3장에서 "가정"으로 채운 값인지 */
  assumed?: boolean;
  /** 개인 과제 시작일(L = startDate~due) */
  startDate?: string;
}

export interface DayForecast { date: string; load: number; /** 일 단위 지수 = load ÷ (baseline ÷ 7) */ R: number; weather: Weather; }
export interface Contribution { scheduleId: string; name: string; type: ScheduleType; value: number; fixed: boolean; }
export interface WeekForecast {
  /** 0~17 (화면 표시는 index+1 주) */
  index: number; start: string; end: string;
  W: number; R: number; weather: Weather;
  days: DayForecast[]; // 월~일 7개
  contributions: Contribution[]; // 값이 큰 순, 0인 일정 제외, 합 = W
}
export interface GradeForecast { grade: Grade; /** W̄ */ baseline: number; weeks: WeekForecast[]; }
export interface ForecastOptions {
  /** 기준선을 직접 지정(계산 예시 W̄ = 4.5 등). 없으면 18주 평균 */
  baseline?: number;
  /** 제보(reported) 일정 포함 여부. 기본 true */
  includeReported?: boolean;
  /** 개인 기상도: 선택 일정은 checkedIds에 있으면 p=1, 없으면 p=0. 그 외는 p 그대로(시험·수행·자평 = 1) */
  personal?: { checkedIds: string[] };
}
export type MoveResult =
  | { ok: true; schedules: Schedule[] }
  | { ok: false; reason: 'fixed' | 'out_of_semester' | 'not_found' };
export interface Recommendation { date: string; weekIndex: number; /** 그 일정의 준비 구간이 걸치는 주들의 R 최댓값 */ maxR: number; weather: Weather; }
export interface AddPreview {
  /** 일정의 준비 구간이 걸치는 주들의 전후 */
  weeks: { index: number; beforeR: number; beforeWeather: Weather; R: number; weather: Weather }[];
  maxR: number; storm: boolean;
}
export interface TypeDefaults { w: number; L: number; p: number; fixed: boolean; optional: boolean; }

// ── 공지문 해석 ──
export interface Evidence { start: number; end: number; } // 원문 문자 위치 [start, end)
export interface ParsedField<T> { value: T | null; evidence: Evidence[]; }
export interface ParsedNotice {
  name: ParsedField<string>;
  type: ParsedField<ScheduleType>;
  difficulty: ParsedField<Difficulty>;
  subject: ParsedField<string>;
  /** 마감일(달력 날짜 그대로, 전날 변환 전) 'YYYY-MM-DD' */
  due: ParsedField<string>;
  grades: ParsedField<Grade[]>;
  p: ParsedField<number>;
  internal: ParsedField<boolean>;
  fixed: ParsedField<boolean>;
  /** 날짜가 학기 밖이면 true (화면에서 빨간 테두리) */
  dueOutOfSemester: boolean;
}
export interface SampleNotice {
  id: string; title: string; text: string;
  expected: { name: string; type: ScheduleType; difficulty: Difficulty | null; subject: string | null; due: string; grades: Grade[]; p: number; internal: boolean; fixed: boolean; };
}

// ── 화면 상태 ──
export interface Session { role: Role; grade: Grade; userId: string; }
export type ViewName = 'home' | 'timeline';
export interface AppState {
  session: Session | null; // null이면 로그인 카드
  role: Role; grade: Grade;
  selectedWeek: number; // 0~17
  view: ViewName;
  homeMode: 'weeks' | 'calendar';
  schedules: Schedule[]; // 현재 상태(시뮬레이션·등록 반영, 전 학년)
  focusScheduleId: string | null; // 타임라인에서 강조할 일정
  detailOpen: boolean; // 주 상세 패널
}
export interface Store {
  getState(): AppState;
  subscribe(fn: (s: AppState) => void): () => void;
  login(session: Session): void;
  logout(): void;
  setRole(role: Role): void;
  setGrade(grade: Grade): void;
  selectWeek(index: number, openDetail?: boolean): void;
  closeDetail(): void;
  setView(view: ViewName, focusScheduleId?: string | null): void;
  setHomeMode(mode: 'weeks' | 'calendar'): void;
  /** 현재 상태의 예보(메모이즈). grade 생략 시 선택 학년 */
  getForecast(grade?: Grade): GradeForecast;
  /** 처음 상태(초기화 기준)의 예보 */
  getBaseForecast(grade?: Grade): GradeForecast;
  /** 처음 상태 대비 날씨가 바뀐 주 → 전후 배지 */
  getBadges(grade?: Grade): Record<number, { from: Weather; to: Weather }>;
  /** 권한 검사 한 곳. move·editWeight·confirm은 교사만, report는 학생 */
  can(action: 'move' | 'editWeight' | 'confirm' | 'report' | 'report_view'): boolean;
  /** 이동(교사만, 고정이면 거부). 성공 시 되돌리기 기록에 쌓인다 */
  move(id: string, newDue: string): MoveResult | { ok: false; reason: 'forbidden' };
  /** 무게 직접 수정(교사만, 0.1~10). 되돌리기 대상 */
  setWeight(id: string, w: number): boolean;
  resetWeight(id: string): boolean;
  /** 등록. 역할에 따라 status가 confirmed/reported로 정해진다. 되돌리기 대상 */
  addSchedules(list: Schedule[]): void;
  undo(): boolean;
  canUndo(): boolean;
  /** 처음 상태로 */
  reset(): void;
}
