// 데모 데이터 조건(SPEC 1-3)을 계산 모듈로 확인한다.
import { describe, it, expect } from 'vitest';
import { DEMO_SCHEDULES } from './schedules';
import { forecast, moveSchedule, recommendDates, dayNumber, dateOf } from '../calc';
import type { Schedule, Grade, Weather } from '../types';

const STORM = 1.6;
const RAIN = 1.15;

const algebraSelfEval: Schedule = {
  id: 'g1-self-alg', name: '자기평가서 — 수학(대수)', type: 'self_eval', grade: 1, due: '2026-12-23',
  w: 1.5, L: 5, p: 1, fixed: false, internal: true, difficulty: 'medium', subject: '수학(대수)',
  status: 'confirmed', optional: false, defaultW: 1.5, source: 'demo',
};

function moved(): Schedule[] {
  const r = moveSchedule(DEMO_SCHEDULES, 'g1-self-bio', '2026-12-15');
  if (!r.ok) throw new Error(`move failed: ${r.reason}`);
  return r.schedules;
}

describe('데모 데이터 기본', () => {
  it('일정 30개 이상, id 중복 없음, due가 유효한 날짜', () => {
    expect(DEMO_SCHEDULES.length).toBeGreaterThanOrEqual(30);
    const ids = DEMO_SCHEDULES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of DEMO_SCHEDULES) {
      expect(s.due, s.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(dateOf(dayNumber(s.due)), s.id).toBe(s.due);
      if (s.eventDate) expect(dateOf(dayNumber(s.eventDate)), s.id).toBe(s.eventDate);
      expect(s.source).toBe('demo');
      expect(s.status).toBe('confirmed');
      expect(s.defaultW).toBe(s.w);
    }
  });
  it('지필시험 전체 무게: 1학년 8, 2·3학년 7 (시험 기간마다)', () => {
    const sums: Record<string, number> = {};
    for (const s of DEMO_SCHEDULES.filter((x) => x.type === 'exam')) {
      const key = `${s.grade}-${s.id.split('-')[1]}`;
      sums[key] = (sums[key] ?? 0) + s.w;
    }
    for (const [k, v] of Object.entries(sums)) expect(v, k).toBeCloseTo(k.startsWith('1-') ? 8 : 7, 9);
  });
  it('사람 지시 일정이 들어 있다', () => {
    const bio = DEMO_SCHEDULES.find((s) => s.id === 'g1-perf-bio');
    expect(bio).toMatchObject({ due: '2026-11-20', w: 3, L: 10, fixed: false, grade: 1 });
    const cr = DEMO_SCHEDULES.filter((s) => s.grade === 1 && s.name.includes('창의연구발표회'));
    expect(cr).toHaveLength(1);
    expect(cr[0]).toMatchObject({ eventDate: '2026-11-10', due: '2026-11-09', w: 6, L: 21, p: 1, fixed: true });
    expect(DEMO_SCHEDULES.find((s) => s.id === 'g1-self-bio')?.due).toBe('2026-12-23');
    expect(DEMO_SCHEDULES.some((s) => s.grade === 1 && s.type === 'self_eval' && s.subject?.includes('대수'))).toBe(false);
  });
});

describe('1학년 데모 흐름', () => {
  it('12월 첫째 주(13)와 넷째 주(16)가 폭풍, 13주 기여에 기말 준비와 R&E 발표 기간', () => {
    const fc = forecast(DEMO_SCHEDULES, 1);
    expect(fc.weeks[13].R).toBeGreaterThanOrEqual(STORM);
    expect(fc.weeks[16].R).toBeGreaterThanOrEqual(STORM);
    const ids = fc.weeks[13].contributions.map((c) => c.scheduleId);
    expect(ids.some((id) => id.startsWith('g1-final-'))).toBe(true);
    expect(ids).toContain('g1-rne-final');
  });
  it('생명 자평 12/23 → 12/15 이동: 16주 비, 15주 폭풍 아님', () => {
    const fc = forecast(moved(), 1);
    expect(fc.weeks[16].R).toBeGreaterThanOrEqual(RAIN);
    expect(fc.weeks[16].R).toBeLessThan(STORM);
    expect(fc.weeks[15].R).toBeLessThan(STORM);
  });
  it('그 상태에서 대수 자평(12/23)을 넣으면 16주 다시 폭풍, 추천 1순위는 폭풍이 아닌 주', () => {
    const list = [...moved(), algebraSelfEval];
    const fc = forecast(list, 1);
    expect(fc.weeks[16].R).toBeGreaterThanOrEqual(STORM);
    const rec = recommendDates(moved(), algebraSelfEval);
    expect(rec.length).toBeGreaterThan(0);
    expect(rec[0].maxR).toBeLessThan(STORM);
    expect(rec[0].weather).not.toBe('storm');
  });
});

describe('3학년·날씨 다양성', () => {
  it('3학년 11/23~11/29(12주)가 폭풍', () => {
    expect(forecast(DEMO_SCHEDULES, 3).weeks[12].R).toBeGreaterThanOrEqual(STORM);
  });
  it.each([1, 2, 3] as Grade[])('%i학년 18주에 맑음·구름·비·폭풍이 모두 나온다', (g) => {
    const seen = new Set<Weather>(forecast(DEMO_SCHEDULES, g).weeks.map((w) => w.weather));
    for (const w of ['sunny', 'cloudy', 'rain', 'storm'] as Weather[]) expect(seen.has(w), w).toBe(true);
  });
});
