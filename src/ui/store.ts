import type { AppState, Store, Schedule, Grade, Role, Session, ViewName, GradeForecast, Weather, MoveResult } from '../types';
import { forecast, moveSchedule, weekIndexOf, inSemester, diffDays, SEMESTER, EXAMPLE } from '../calc';
import { DEMO_SCHEDULES } from '../data/schedules';

const KEY = 'awf:v1';
const ACCOUNTS_KEY = 'awf:accounts';
const DEFAULT_ACCOUNTS: Record<string, Role> = { student01: 'student', teacher01: 'teacher' };
const clone = (list: Schedule[]): Schedule[] => list.map((s) => ({ ...s, period: s.period ? { ...s.period } : undefined }));

function getParams(): URLSearchParams {
  try {
    if (typeof window !== 'undefined' && window.location) return new URLSearchParams(window.location.search);
  } catch { /* ignore */ }
  return new URLSearchParams();
}
function getStorage(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* ignore */ }
  return null;
}
function safeWeekIndex(date: string, fallback: number): number {
  try {
    const i = weekIndexOf(date);
    return i >= 0 ? i : fallback;
  } catch { return fallback; }
}

interface Saved { session: Session | null; role: Role; grade: Grade; schedules: Schedule[]; personalChecked?: string[] }

/** 앱 상태 저장소. ?example=1 이면 계산 예시(EXAMPLE, 기준선 4.5)를 1학년 데이터로 불러온다. */
export function createStore(opts?: { schedules?: Schedule[]; storage?: boolean }): Store {
  const params = getParams();
  const example = !opts?.schedules && params.get('example') === '1';
  const fresh = params.get('fresh') === '1';
  const useStorage = !example && opts?.storage !== false && !opts?.schedules;
  const storage = useStorage ? getStorage() : null;
  const baseline = example ? EXAMPLE.baseline : undefined;

  const base: Schedule[] = clone(opts?.schedules ?? (example ? EXAMPLE.schedules : DEMO_SCHEDULES));

  let state: AppState = {
    session: null,
    role: 'student',
    grade: 1,
    selectedWeek: example ? safeWeekIndex(EXAMPLE.weekStart, 9) : safeWeekIndex(SEMESTER.today, 11),
    view: 'home',
    homeMode: 'weeks',
    schedules: clone(base),
    focusScheduleId: null,
    detailOpen: false,
    personalChecked: [],
  };

  if (storage) {
    try {
      if (fresh) storage.removeItem(KEY);
      else {
        const raw = storage.getItem(KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<Saved>;
          if (saved.role === 'student' || saved.role === 'teacher') state.role = saved.role;
          if (saved.grade === 1 || saved.grade === 2 || saved.grade === 3) state.grade = saved.grade;
          if (saved.session && typeof saved.session.userId === 'string') state.session = saved.session;
          if (Array.isArray(saved.schedules)) state.schedules = saved.schedules;
          if (Array.isArray(saved.personalChecked)) state.personalChecked = saved.personalChecked.filter((x) => typeof x === 'string');
        }
      }
    } catch { /* 저장소 실패 → 가상 데이터 */ }
  }

  const listeners = new Set<(s: AppState) => void>();
  const undoStack: Schedule[][] = [];
  const cache = new WeakMap<Schedule[], Map<Grade, GradeForecast>>();

  function persist() {
    if (!storage) return;
    try {
      const saved: Saved = { session: state.session, role: state.role, grade: state.grade, schedules: state.schedules, personalChecked: state.personalChecked };
      storage.setItem(KEY, JSON.stringify(saved));
    } catch { /* ignore */ }
  }
  function set(patch: Partial<AppState>) {
    state = { ...state, ...patch };
    persist();
    for (const fn of [...listeners]) {
      try { fn(state); } catch (e) { console.error(e); }
    }
  }
  function commit(next: Schedule[]) {
    undoStack.push(state.schedules);
    set({ schedules: next });
  }
  const noPersonal = new WeakMap<Schedule[], Schedule[]>();
  function schoolOnly(list: Schedule[]): Schedule[] {
    let v = noPersonal.get(list);
    if (!v) { v = list.filter((x) => x.type !== 'personal'); noPersonal.set(list, v); }
    return v;
  }
  function fc(list: Schedule[], grade: Grade): GradeForecast {
    let m = cache.get(list);
    if (!m) { m = new Map(); cache.set(list, m); }
    let f = m.get(grade);
    if (!f) {
      f = forecast(schoolOnly(list), grade, baseline !== undefined ? { baseline } : undefined);
      m.set(grade, f);
    }
    return f;
  }
  // 개인 예보 메모: 일정 배열·체크 배열·학년이 같으면 재사용
  let pMemo: { list: Schedule[]; checked: string[]; grade: Grade; f: GradeForecast } | null = null;

  // 아이디-역할 묶음. 저장소를 못 쓰면 메모리
  let memAccounts: Record<string, Role> = { ...DEFAULT_ACCOUNTS };
  const accStorage = opts?.storage === false || opts?.schedules ? null : getStorage();
  if (accStorage && fresh) { try { accStorage.removeItem(ACCOUNTS_KEY); } catch { /* ignore */ } }
  function readAccounts(): Record<string, Role> {
    if (accStorage) {
      try {
        const raw = accStorage.getItem(ACCOUNTS_KEY);
        const obj = raw ? (JSON.parse(raw) as Record<string, Role>) : {};
        return { ...DEFAULT_ACCOUNTS, ...memAccounts, ...obj, student01: 'student', teacher01: 'teacher' };
      } catch { /* ignore */ }
    }
    return { ...memAccounts, student01: 'student', teacher01: 'teacher' };
  }
  function writeAccounts(acc: Record<string, Role>) {
    memAccounts = { ...acc };
    if (!accStorage) return;
    try { accStorage.setItem(ACCOUNTS_KEY, JSON.stringify(acc)); } catch { /* ignore */ }
  }
  const findIdx = (id: string) => state.schedules.findIndex((x) => x.id === id);
  const isTeacher = () => state.role === 'teacher';

  const store: Store = {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    login(session) {
      const v = state.view;
      const view: ViewName = (v === 'report' && session.role === 'student') || (v === 'planner' && session.role === 'teacher') ? 'home' : v;
      set({ session: { ...session }, role: session.role, grade: session.grade, view });
    },
    logout() { set({ session: null, detailOpen: false }); },
    setRole() { /* 역할은 로그인으로만 정해진다 */ },
    tryLogin(session) {
      const userId = (session.userId || '').trim();
      const acc = readAccounts();
      const bound = acc[userId];
      if (bound && bound !== session.role) return { ok: false, reason: 'id_bound', boundRole: bound };
      if (!bound && userId) writeAccounts({ ...acc, [userId]: session.role });
      store.login({ ...session, userId });
      return { ok: true };
    },
    setGrade(grade) { set({ grade, session: state.session ? { ...state.session, grade } : null }); },
    selectWeek(index, openDetail) {
      const i = Math.max(0, Math.min(SEMESTER.weeks - 1, Math.round(index)));
      set({ selectedWeek: i, detailOpen: openDetail ?? state.detailOpen });
    },
    closeDetail() { set({ detailOpen: false }); },
    setView(view: ViewName, focusScheduleId?: string | null) {
      if ((view === 'report' && state.role === 'student') || (view === 'planner' && state.role === 'teacher')) view = 'home';
      set({ view, focusScheduleId: focusScheduleId === undefined ? state.focusScheduleId : focusScheduleId });
    },
    setHomeMode(mode) { set({ homeMode: mode }); },
    getForecast: (grade) => fc(state.schedules, grade ?? state.grade),
    getBaseForecast: (grade) => fc(base, grade ?? state.grade),
    getBadges(grade) {
      const g = grade ?? state.grade;
      const out: Record<number, { from: Weather; to: Weather }> = {};
      if (state.schedules === base) return out;
      const now = fc(state.schedules, g).weeks;
      const before = fc(base, g).weeks;
      for (let i = 0; i < now.length; i++) {
        const b = before[i];
        if (b && b.weather !== now[i].weather) out[now[i].index] = { from: b.weather, to: now[i].weather };
      }
      return out;
    },
    can(action) {
      if (action === 'report_view') return true;
      if (action === 'report') return state.role === 'student';
      return isTeacher();
    },
    move(id, newDue): MoveResult | { ok: false; reason: 'forbidden' } {
      const s = state.schedules.find((x) => x.id === id);
      if (!s) return { ok: false, reason: 'not_found' };
      const allowed = isTeacher() || (s.type === 'personal' && state.role === 'student');
      if (!allowed) return { ok: false, reason: 'forbidden' };
      if (s.fixed) return { ok: false, reason: 'fixed' };
      const r = moveSchedule(state.schedules, id, newDue);
      if (r.ok) commit(r.schedules);
      return r;
    },
    setWeight(id, w) {
      if (!isTeacher() || !Number.isFinite(w)) return false;
      const v = Math.round(w * 100) / 100;
      if (v < 0.1 || v > 10) return false;
      const i = state.schedules.findIndex((x) => x.id === id);
      if (i < 0) return false;
      const next = state.schedules.slice();
      next[i] = { ...next[i], w: v };
      commit(next);
      return true;
    },
    setFixed(id, fixed) {
      if (!isTeacher()) return false;
      const i = findIdx(id);
      if (i < 0) return false;
      const s = state.schedules[i];
      if (s.type === 'personal' || s.fixed === fixed) return false;
      const next = state.schedules.slice();
      next[i] = { ...s, fixed };
      commit(next);
      return true;
    },
    resetWeight(id) {
      if (!isTeacher()) return false;
      const i = state.schedules.findIndex((x) => x.id === id);
      if (i < 0) return false;
      if (state.schedules[i].w === state.schedules[i].defaultW) return true;
      const next = state.schedules.slice();
      next[i] = { ...next[i], w: next[i].defaultW };
      commit(next);
      return true;
    },
    addSchedules(list) {
      if (!list.length) return;
      const status = isTeacher() ? 'confirmed' : 'reported';
      commit([...state.schedules, ...list.map((s) => ({ ...s, status } as Schedule))]);
    },
    undo() {
      const prev = undoStack.pop();
      if (!prev) return false;
      set({ schedules: prev });
      return true;
    },
    canUndo: () => undoStack.length > 0,
    setPersonalChecked(id, checked) {
      const has = state.personalChecked.includes(id);
      if (checked === has) return;
      set({ personalChecked: checked ? [...state.personalChecked, id] : state.personalChecked.filter((x) => x !== id) });
    },
    getPersonalForecast() {
      const g = state.grade;
      if (pMemo && pMemo.list === state.schedules && pMemo.checked === state.personalChecked && pMemo.grade === g) return pMemo.f;
      const f = forecast(state.schedules, g, { personal: { checkedIds: state.personalChecked }, baseline: fc(state.schedules, g).baseline });
      pMemo = { list: state.schedules, checked: state.personalChecked, grade: g, f };
      return f;
    },
    addPersonalTask(input) {
      if (state.role !== 'student') return null;
      const name = (input?.name ?? '').trim();
      const hours = Number(input?.hours);
      const { startDate, due } = input ?? ({} as typeof input);
      if (!name || !Number.isFinite(hours) || hours <= 0 || hours > 200) return null;
      if (typeof startDate !== 'string' || typeof due !== 'string') return null;
      try {
        if (!inSemester(startDate) || !inSemester(due)) return null;
        if (diffDays(due, startDate) < 0) return null;
      } catch { return null; }
      const w = Math.round((hours / 4) * 100) / 100;
      const s: Schedule = {
        id: `p-${Date.now()}`, name, type: 'personal', grade: state.grade, due, startDate,
        w, defaultW: w, L: diffDays(due, startDate) + 1, p: 1,
        fixed: false, internal: true, optional: false, status: 'confirmed', source: 'user',
      };
      while (state.schedules.some((x) => x.id === s.id)) s.id += 'x';
      commit([...state.schedules, s]);
      return s;
    },
    removeSchedule(id) {
      const i = findIdx(id);
      if (i < 0) return false;
      const s = state.schedules[i];
      const ok = s.type === 'personal' ? state.role === 'student' : s.source === 'user' && isTeacher();
      if (!ok) return false;
      commit(state.schedules.filter((x) => x.id !== id));
      if (state.personalChecked.includes(id)) set({ personalChecked: state.personalChecked.filter((x) => x !== id) });
      return true;
    },
    confirmSchedule(id) {
      if (!isTeacher()) return false;
      const i = findIdx(id);
      if (i < 0 || state.schedules[i].status !== 'reported') return false;
      const next = state.schedules.slice();
      next[i] = { ...next[i], status: 'confirmed' };
      commit(next);
      return true;
    },
    reset() {
      undoStack.length = 0;
      set({ schedules: base, focusScheduleId: null });
    },
  };
  return store;
}
