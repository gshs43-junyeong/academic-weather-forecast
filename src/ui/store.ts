import type { AppState, Store, Schedule, Grade, Role, Session, ViewName, GradeForecast, Weather, MoveResult } from '../types';
import { forecast, moveSchedule, weekIndexOf, SEMESTER, EXAMPLE } from '../calc';
import { DEMO_SCHEDULES } from '../data/schedules';

const KEY = 'awf:v1';
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

interface Saved { session: Session | null; role: Role; grade: Grade; schedules: Schedule[] }

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
      const saved: Saved = { session: state.session, role: state.role, grade: state.grade, schedules: state.schedules };
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
  function fc(list: Schedule[], grade: Grade): GradeForecast {
    let m = cache.get(list);
    if (!m) { m = new Map(); cache.set(list, m); }
    let f = m.get(grade);
    if (!f) {
      f = forecast(list, grade, baseline !== undefined ? { baseline } : undefined);
      m.set(grade, f);
    }
    return f;
  }
  const isTeacher = () => state.role === 'teacher';

  const store: Store = {
    getState: () => state,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    login(session) { set({ session: { ...session }, role: session.role, grade: session.grade }); },
    logout() { set({ session: null, detailOpen: false }); },
    setRole(role) { set({ role, session: state.session ? { ...state.session, role } : null }); },
    setGrade(grade) { set({ grade, session: state.session ? { ...state.session, grade } : null }); },
    selectWeek(index, openDetail) {
      const i = Math.max(0, Math.min(SEMESTER.weeks - 1, Math.round(index)));
      set({ selectedWeek: i, detailOpen: openDetail ?? state.detailOpen });
    },
    closeDetail() { set({ detailOpen: false }); },
    setView(view: ViewName, focusScheduleId?: string | null) {
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
    reset() {
      undoStack.length = 0;
      set({ schedules: base, focusScheduleId: null });
    },
  };
  return store;
}
