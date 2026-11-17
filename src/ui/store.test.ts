import { describe, it, expect } from 'vitest';
import type { Schedule } from '../types';
import { createStore } from './store';

const mk = (id: string, due: string, extra: Partial<Schedule> = {}): Schedule => ({
  id, name: id, type: 'performance', grade: 1, due, w: 3, L: 7, p: 1, fixed: false, internal: true,
  status: 'confirmed', optional: false, defaultW: 3, source: 'demo', ...extra,
});
const base = (): Schedule[] => [
  mk('a', '2026-11-20'),
  mk('b', '2026-11-19', { w: 4, defaultW: 4 }),
  mk('c', '2026-11-18', { w: 5, defaultW: 5 }),
  mk('fx', '2026-12-04', { type: 'exam', fixed: true, w: 6, defaultW: 6 }),
  mk('d', '2026-10-01', { w: 0.5, defaultW: 0.5 }),
];
const teacher = () => {
  const s = createStore({ schedules: base(), storage: false });
  s.login({ role: 'teacher', grade: 1, userId: 'teacher01' });
  return s;
};

describe('store', () => {
  it('인자 없이도 만들어진다(DOM 없음)', () => {
    const s = createStore();
    expect(s.getState().session).toBeNull();
    expect(s.getState().selectedWeek).toBe(11);
    expect(s.getState().view).toBe('home');
  });

  it('학생 move 거부(forbidden)', () => {
    const s = createStore({ schedules: base(), storage: false });
    s.login({ role: 'student', grade: 1, userId: 'student01' });
    expect(s.move('a', '2026-12-18')).toEqual({ ok: false, reason: 'forbidden' });
    expect(s.canUndo()).toBe(false);
    expect(s.can('report')).toBe(true);
    expect(s.can('move')).toBe(false);
  });

  it('학생도 개인 과제는 옮길 수 있다', () => {
    const s = createStore({ schedules: [...base(), mk('p1', '2026-11-25', { type: 'personal', source: 'user' })], storage: false });
    expect(s.move('p1', '2026-11-27').ok).toBe(true);
  });

  it('교사 고정 일정 move 거부(fixed)', () => {
    const s = teacher();
    expect(s.move('fx', '2026-12-18')).toEqual({ ok: false, reason: 'fixed' });
  });

  it('move 후 undo 복원, reset', () => {
    const s = teacher();
    const before = s.getState().schedules;
    const r = s.move('a', '2026-12-18');
    expect(r.ok).toBe(true);
    expect(s.getState().schedules.find((x) => x.id === 'a')!.due).toBe('2026-12-18');
    expect(s.undo()).toBe(true);
    expect(s.getState().schedules).toBe(before);
    expect(s.undo()).toBe(false);
    s.move('a', '2026-12-18');
    s.move('b', '2026-12-17');
    s.reset();
    expect(s.canUndo()).toBe(false);
    expect(s.getState().schedules.find((x) => x.id === 'a')!.due).toBe('2026-11-20');
    expect(s.getBadges()).toEqual({});
  });

  it('setWeight 범위·undo·resetWeight', () => {
    const s = teacher();
    expect(s.setWeight('a', 0.05)).toBe(false);
    expect(s.setWeight('a', 10.5)).toBe(false);
    expect(s.setWeight('a', 4.567)).toBe(true);
    expect(s.getState().schedules.find((x) => x.id === 'a')!.w).toBe(4.57);
    expect(s.undo()).toBe(true);
    expect(s.getState().schedules.find((x) => x.id === 'a')!.w).toBe(3);
    s.setWeight('a', 8);
    expect(s.resetWeight('a')).toBe(true);
    expect(s.getState().schedules.find((x) => x.id === 'a')!.w).toBe(3);
    s.login({ role: 'student', grade: 1, userId: 'student01' });
    expect(s.setWeight('a', 5)).toBe(false);
    expect(s.getState().session!.role).toBe('student');
  });

  it('addSchedules status: 학생 reported, 교사 confirmed', () => {
    const s = createStore({ schedules: base(), storage: false });
    s.login({ role: 'student', grade: 1, userId: 'x' });
    s.addSchedules([mk('n1', '2026-11-26', { source: 'user' })]);
    expect(s.getState().schedules.find((x) => x.id === 'n1')!.status).toBe('reported');
    s.login({ role: 'teacher', grade: 1, userId: 't' });
    s.addSchedules([mk('n2', '2026-11-27', { status: 'reported', source: 'user' })]);
    expect(s.getState().schedules.find((x) => x.id === 'n2')!.status).toBe('confirmed');
    expect(s.undo()).toBe(true);
    expect(s.getState().schedules.some((x) => x.id === 'n2')).toBe(false);
  });

  it('getBadges: 처음 상태 대비 날씨가 바뀐 주', () => {
    const s = teacher();
    const wk = 11;
    const beforeW = s.getForecast().weeks[wk].weather;
    s.move('c', '2026-10-02');
    s.move('b', '2026-10-03');
    const after = s.getForecast().weeks[wk].weather;
    const badges = s.getBadges();
    if (after !== beforeW) expect(badges[wk]).toEqual({ from: beforeW, to: after });
    expect(Object.keys(badges).length).toBeGreaterThan(0);
    for (const [i, b] of Object.entries(badges)) {
      expect(s.getBaseForecast().weeks[+i].weather).toBe(b.from);
      expect(s.getForecast().weeks[+i].weather).toBe(b.to);
    }
  });

  it('getForecast 메모이즈', () => {
    const s = teacher();
    expect(s.getForecast()).toBe(s.getForecast(1));
  });

  it('setRole은 역할을 바꾸지 않는다', () => {
    const s = createStore({ schedules: base(), storage: false });
    s.login({ role: 'student', grade: 1, userId: 'student01' });
    s.setRole('teacher');
    expect(s.getState().role).toBe('student');
    expect(s.getState().session!.role).toBe('student');
    expect(s.can('move')).toBe(false);
  });

  it('같은 아이디로 다른 역할 tryLogin 거부', () => {
    const s = createStore({ schedules: base(), storage: false });
    expect(s.tryLogin({ role: 'teacher', grade: 1, userId: 'student01' })).toEqual({ ok: false, reason: 'id_bound', boundRole: 'student' });
    expect(s.getState().session).toBeNull();
    expect(s.tryLogin({ role: 'student', grade: 1, userId: 'teacher01' })).toEqual({ ok: false, reason: 'id_bound', boundRole: 'teacher' });
    expect(s.tryLogin({ role: 'teacher', grade: 2, userId: 'newT' })).toEqual({ ok: true });
    expect(s.getState().role).toBe('teacher');
    s.logout();
    expect(s.tryLogin({ role: 'student', grade: 2, userId: 'newT' })).toEqual({ ok: false, reason: 'id_bound', boundRole: 'teacher' });
    expect(s.tryLogin({ role: 'student', grade: 1, userId: 'student01' })).toEqual({ ok: true });
  });

  it('개인 과제: 학년 예보에는 없고 개인 예보에는 있다', () => {
    const s = createStore({ schedules: base(), storage: false });
    s.tryLogin({ role: 'student', grade: 1, userId: 'student01' });
    const before = s.getForecast();
    const t = s.addPersonalTask({ name: '독서', hours: 10, startDate: '2026-11-23', due: '2026-11-29' })!;
    expect(t).not.toBeNull();
    expect(t.type).toBe('personal');
    expect(t.w).toBe(2.5);
    expect(t.defaultW).toBe(2.5);
    expect(t.L).toBe(7);
    expect(t.grade).toBe(1);
    const after = s.getForecast();
    expect(after.weeks.map((w) => w.W)).toEqual(before.weeks.map((w) => w.W));
    const pf = s.getPersonalForecast();
    expect(pf).toBe(s.getPersonalForecast());
    expect(pf.baseline).toBe(after.baseline);
    const wk = pf.weeks.find((w) => w.start === '2026-11-23')!;
    expect(wk.contributions.some((c) => c.scheduleId === t.id)).toBe(true);
    expect(s.getBadges()).toEqual({});
    expect(s.undo()).toBe(true);
    expect(s.getState().schedules.some((x) => x.id === t.id)).toBe(false);
  });

  it('addPersonalTask 검증', () => {
    const s = createStore({ schedules: base(), storage: false });
    s.tryLogin({ role: 'student', grade: 1, userId: 'student01' });
    expect(s.addPersonalTask({ name: ' ', hours: 4, startDate: '2026-11-20', due: '2026-11-21' })).toBeNull();
    expect(s.addPersonalTask({ name: 'a', hours: 0, startDate: '2026-11-20', due: '2026-11-21' })).toBeNull();
    expect(s.addPersonalTask({ name: 'a', hours: 201, startDate: '2026-11-20', due: '2026-11-21' })).toBeNull();
    expect(s.addPersonalTask({ name: 'a', hours: 4, startDate: '2026-11-22', due: '2026-11-21' })).toBeNull();
    expect(s.addPersonalTask({ name: 'a', hours: 4, startDate: '2026-11-20', due: '2027-02-01' })).toBeNull();
    expect(s.addPersonalTask({ name: 'a', hours: 3, startDate: '2026-11-21', due: '2026-11-21' })!.L).toBe(1);
    const t = teacher();
    expect(t.addPersonalTask({ name: 'a', hours: 4, startDate: '2026-11-20', due: '2026-11-21' })).toBeNull();
  });

  it('학생의 개인 과제 move 허용, 학교 일정은 forbidden', () => {
    const s = createStore({ schedules: base(), storage: false });
    s.tryLogin({ role: 'student', grade: 1, userId: 'student01' });
    const t = s.addPersonalTask({ name: '독서', hours: 8, startDate: '2026-11-23', due: '2026-11-29' })!;
    expect(s.move(t.id, '2026-12-06').ok).toBe(true);
    const moved = s.getState().schedules.find((x) => x.id === t.id)!;
    expect(moved.due).toBe('2026-12-06');
    expect(moved.startDate).toBe('2026-11-30');
    expect(s.move('a', '2026-12-18')).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('confirmSchedule: 교사만, reported → confirmed, undo', () => {
    const s = createStore({ schedules: [...base(), mk('r1', '2026-11-26', { status: 'reported', source: 'user' })], storage: false });
    s.login({ role: 'student', grade: 1, userId: 'student01' });
    expect(s.confirmSchedule('r1')).toBe(false);
    s.login({ role: 'teacher', grade: 1, userId: 'teacher01' });
    expect(s.confirmSchedule('r1')).toBe(true);
    expect(s.getState().schedules.find((x) => x.id === 'r1')!.status).toBe('confirmed');
    expect(s.confirmSchedule('r1')).toBe(false);
    expect(s.undo()).toBe(true);
    expect(s.getState().schedules.find((x) => x.id === 'r1')!.status).toBe('reported');
  });

  it('removeSchedule 권한', () => {
    const s = createStore({ schedules: [...base(), mk('u1', '2026-11-26', { source: 'user' })], storage: false });
    s.login({ role: 'student', grade: 1, userId: 'student01' });
    const t = s.addPersonalTask({ name: '독서', hours: 8, startDate: '2026-11-23', due: '2026-11-29' })!;
    expect(s.removeSchedule('u1')).toBe(false);
    expect(s.removeSchedule('a')).toBe(false);
    expect(s.removeSchedule(t.id)).toBe(true);
    s.login({ role: 'teacher', grade: 1, userId: 'teacher01' });
    expect(s.removeSchedule('a')).toBe(false);
    expect(s.removeSchedule('u1')).toBe(true);
    expect(s.undo()).toBe(true);
    expect(s.getState().schedules.some((x) => x.id === 'u1')).toBe(true);
  });

  it('setView: 학생 report, 교사 planner는 home으로', () => {
    const s = createStore({ schedules: base(), storage: false });
    s.login({ role: 'student', grade: 1, userId: 'student01' });
    s.setView('report');
    expect(s.getState().view).toBe('home');
    s.setView('planner');
    expect(s.getState().view).toBe('planner');
    s.login({ role: 'teacher', grade: 1, userId: 'teacher01' });
    s.setView('planner');
    expect(s.getState().view).toBe('home');
  });
  it('setFixed: 학생 불가, 교사 고정/가능 전환, undo 복원', () => {
    const st = createStore({ schedules: base(), storage: false });
    st.login({ role: 'student', grade: 1, userId: 'student01' });
    expect(st.setFixed('a', true)).toBe(false);
    const s = teacher();
    let n = 0;
    s.subscribe(() => { n++; });
    const before = s.getState().schedules;
    expect(s.setFixed('a', true)).toBe(true);
    expect(n).toBe(1);
    expect(s.setFixed('a', true)).toBe(false);
    expect(s.setFixed('zz', true)).toBe(false);
    expect(s.move('a', '2026-12-18')).toEqual({ ok: false, reason: 'fixed' });
    expect(s.undo()).toBe(true);
    expect(s.getState().schedules).toBe(before);
    expect(s.setFixed('fx', false)).toBe(true);
    expect(s.move('fx', '2026-12-11').ok).toBe(true);
    s.reset();
    expect(s.getState().schedules.find((x) => x.id === 'fx')!.fixed).toBe(true);
  });
});
