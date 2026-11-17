import { describe, expect, it } from 'vitest';
import { DEMO_SCHEDULES } from '../data/schedules';
import { forecast, moveSchedule } from './index';
import { suggestRelief } from './relief';

const base = DEMO_SCHEDULES.filter((s) => s.type !== 'personal');

describe('suggestRelief', () => {
  it('1학년 17주(index 16, 폭풍): 제안이 R을 낮추고, 적용하면 afterR과 같고, 새 폭풍 주를 만들지 않는다', () => {
    const before = forecast(base, 1);
    expect(before.weeks[16].weather).toBe('storm');
    const list = suggestRelief(DEMO_SCHEDULES, 1, 16);
    console.log('index16', JSON.stringify(list));
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(3);
    for (const r of list) {
      expect(r.afterR).toBeLessThan(r.beforeR);
      const s = DEMO_SCHEDULES.find((x) => x.id === r.scheduleId)!;
      expect(s.fixed).toBe(false);
      expect(s.type).not.toBe('personal');
      const mv = moveSchedule(base, r.scheduleId, r.toDue);
      expect(mv.ok).toBe(true);
      if (!mv.ok) continue;
      const after = forecast(mv.schedules, 1);
      expect(Math.abs(after.weeks[16].R - r.afterR)).toBeLessThan(1e-9);
      after.weeks.forEach((w, i) => { if (i !== 16 && w.weather === 'storm') expect(before.weeks[i].weather).toBe('storm'); });
    }
    for (let i = 1; i < list.length; i++) expect(list[i].afterR).toBeGreaterThanOrEqual(list[i - 1].afterR);
  });

  it('개인 과제는 제안에 없다', () => {
    const p = { ...base.find((s) => s.grade === 1 && !s.fixed)!, id: 'p1', type: 'personal' as const, due: '2026-12-23', w: 3, L: 5, p: 1 };
    const list = suggestRelief([...DEMO_SCHEDULES, p], 1, 16);
    expect(list.some((r) => r.scheduleId === 'p1')).toBe(false);
  });

  it('1학년 14주(index 13, 기말 직전): 제안(정보 수행평가 1개)을 모두 적용해도 폭풍 — 고정 일정만으로도 폭풍', () => {
    const list = suggestRelief(DEMO_SCHEDULES, 1, 13, { count: 99 });
    let cur = base;
    for (const r of list) { const mv = moveSchedule(cur, r.scheduleId, r.toDue); if (mv.ok) cur = mv.schedules; }
    const w = forecast(cur, 1).weeks[13];
    console.log('index13', forecast(base, 1).weeks[13].R, JSON.stringify(list), 'allApplied', w.R, w.weather);
    for (const r of list) expect(r.afterR).toBeLessThan(r.beforeR);
    expect(w.weather).toBe('storm');
  });
});
