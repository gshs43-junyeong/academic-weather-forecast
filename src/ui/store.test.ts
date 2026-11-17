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
    s.setRole('student');
    expect(s.setWeight('a', 5)).toBe(false);
    expect(s.getState().session!.role).toBe('student');
  });

  it('addSchedules status: 학생 reported, 교사 confirmed', () => {
    const s = createStore({ schedules: base(), storage: false });
    s.login({ role: 'student', grade: 1, userId: 'x' });
    s.addSchedules([mk('n1', '2026-11-26', { source: 'user' })]);
    expect(s.getState().schedules.find((x) => x.id === 'n1')!.status).toBe('reported');
    s.setRole('teacher');
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
});
