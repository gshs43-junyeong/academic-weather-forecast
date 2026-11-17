import { describe, it, expect } from 'vitest';
import {
  prepArea, weekLoad, forecast, weatherOf, moveSchedule, examWeights, examSubjectL, defaultsFor,
  EXAMPLE, addDays, weekIndexOf, recommendDates, isWeekendOrHoliday, previewAdd,
} from './index';
import type { Schedule } from '../types';

const ex = EXAMPLE.schedules;
const exWeek = weekIndexOf(EXAMPLE.weekStart);
const moveB = () => ex.map((s) => (s.w === 2 && s.L === 7 ? { ...s, due: addDays(s.due, 7) } : s));
const MATH1 = ['대수', '미적분', '물리', '화학', '생명과학', '지구과학', '국어', '영어', '통합사회', '정보'];
const G2 = ['수학Ⅰ', '미적분', '물리학', '화학', '생명과학', '국어', '영어', '정보', '한국사'];

describe('계산 모듈 (SPEC 2-3)', () => {
  it('테스트 1 준비 분포 면적 합 = 1', () => {
    for (let L = 1; L <= 60; L++) {
      let sum = 0;
      for (let k = 0; k < L; k++) sum += prepArea(L, k);
      expect(Math.abs(sum - 1)).toBeLessThanOrEqual(1e-9);
    }
  });

  it('테스트 2 계산 예시 W = 8.042', () => {
    expect(ex).toHaveLength(4);
    expect(weekLoad([ex[0]], EXAMPLE.weekStart)).toBeCloseTo(3.75, 9);
    expect(weekLoad([ex[1]], EXAMPLE.weekStart)).toBeCloseTo(2.0, 9);
    expect(weekLoad([ex[2]], EXAMPLE.weekStart)).toBeCloseTo(1.2, 9);
    expect(weekLoad([ex[3]], EXAMPLE.weekStart)).toBeCloseTo(1.092, 9);
    expect(weekLoad(ex, EXAMPLE.weekStart)).toBeCloseTo(8.042, 9);
    const wk = forecast(ex, 1, { baseline: EXAMPLE.baseline }).weeks[exWeek];
    expect(wk.W.toFixed(2)).toBe('8.04');
  });

  it('테스트 3 W̄ = 4.5이면 R ≈ 1.787 폭풍, w2·L7 이동 후 W 6.042 R ≈ 1.343 비', () => {
    const wk = forecast(ex, 1, { baseline: 4.5 }).weeks[exWeek];
    expect(wk.R).toBeCloseTo(1.787, 3);
    expect(wk.R.toFixed(2)).toBe('1.79');
    expect(wk.weather).toBe('storm');
    const moved = moveSchedule(ex, ex[1].id, addDays(ex[1].due, 7));
    expect(moved.ok).toBe(true);
    const list = moved.ok ? moved.schedules : moveB();
    expect(weekLoad(list, EXAMPLE.weekStart)).toBeCloseTo(6.042, 9);
    const wk2 = forecast(list, 1, { baseline: 4.5 }).weeks[exWeek];
    expect(wk2.R).toBeCloseTo(1.343, 3);
    expect(wk2.weather).toBe('rain');
    expect(ex[1].due).toBe('2026-11-08'); // 원본 불변
  });

  it('테스트 4 경계값 R = 0.7 구름, 1.15 비, 1.6 폭풍', () => {
    expect(weatherOf(0.7)).toBe('cloudy');
    expect(weatherOf(1.15)).toBe('rain');
    expect(weatherOf(1.6)).toBe('storm');
    expect(weatherOf(0.69)).toBe('sunny');
    expect(weatherOf(0.1 * 7)).toBe('cloudy'); // 0.7000000000000001
    expect(weatherOf(1.15 - 1e-15)).toBe('rain');
  });

  it('테스트 5 원인 분해 기여 합 = W', () => {
    const fc = forecast(ex, 1);
    for (const wk of fc.weeks) {
      const sum = wk.contributions.reduce((a, c) => a + c.value, 0);
      expect(Math.abs(sum - wk.W)).toBeLessThan(0.01);
      for (let i = 1; i < wk.contributions.length; i++) expect(wk.contributions[i - 1].value).toBeGreaterThanOrEqual(wk.contributions[i].value);
      expect(wk.days).toHaveLength(7);
    }
  });

  it('테스트 6 고정 일정 이동 거부', () => {
    const fixed: Schedule[] = ex.map((s, i) => (i === 0 ? { ...s, fixed: true } : s));
    expect(moveSchedule(fixed, fixed[0].id, '2026-11-15')).toEqual({ ok: false, reason: 'fixed' });
    expect(moveSchedule(fixed, 'none', '2026-11-15')).toEqual({ ok: false, reason: 'not_found' });
    expect(moveSchedule(fixed, fixed[1].id, '2027-02-01')).toEqual({ ok: false, reason: 'out_of_semester' });
    expect(recommendDates(fixed, fixed[0])).toEqual([]);
  });

  it('테스트 7 시험 과목 무게(1학년 합 8, 대수 ≈ 1.45, 28일; 2학년 합 7)와 표 일치', () => {
    const w1 = examWeights(1, MATH1);
    expect(w1.reduce((a, x) => a + x.w, 0)).toBeCloseTo(8, 9);
    const alg = w1.find((x) => x.subject === '대수')!;
    expect(alg.w).toBeCloseTo((8 * 4) / 22, 9);
    expect(alg.w.toFixed(2)).toBe('1.45');
    expect(alg.L).toBe(28);
    expect(examSubjectL('대수')).toBe(28);
    expect(examWeights(2, G2).reduce((a, x) => a + x.w, 0)).toBeCloseTo(7, 9);
    expect(defaultsFor('exam', { grade: 1, subject: '대수' }).w).toBeCloseTo(alg.w, 9);
    expect(defaultsFor('performance', { difficulty: 'hard' }).w).toBe(3);
    expect(defaultsFor('self_eval', { difficulty: 'easy' }).w).toBe(0.5);
    expect(defaultsFor('general_contest').w).toBe(1);
  });

  it('테스트 8 순서 검사: 시험 전체 > 연구 최종 > 연구 중간 > 탐구대회 > 수행 최대 > 일반대회', () => {
    const order = [
      Math.min(examWeights(1, MATH1).reduce((a, x) => a + x.w, 0), examWeights(2, G2).reduce((a, x) => a + x.w, 0)),
      defaultsFor('research_final').w, defaultsFor('research_mid').w, defaultsFor('contest').w,
      defaultsFor('performance', { difficulty: 'hard' }).w, defaultsFor('general_contest').w,
    ];
    [7, 6, 4.5, 4, 3, 1].forEach((v, i) => expect(order[i]).toBeCloseTo(v, 9));
    for (let i = 1; i < order.length; i++) expect(order[i - 1]).toBeGreaterThan(order[i]);
  });
});

describe('추천·미리보기', () => {
  it('맑은 주 추천은 학기 안, 오늘 이후, 평일, maxR 오름차순', () => {
    const rec = recommendDates(ex, ex[1], { baseDate: '2026-11-25' });
    expect(rec.length).toBeGreaterThan(0);
    expect(rec.length).toBeLessThanOrEqual(3);
    for (const r of rec) { expect(isWeekendOrHoliday(r.date)).toBe(false); expect(r.date > '2026-11-17').toBe(true); expect(r.date).not.toBe('2026-11-25'); }
    for (let i = 1; i < rec.length; i++) expect(rec[i - 1].maxR).toBeLessThanOrEqual(rec[i].maxR);
    const nw = recommendDates(ex, { ...ex[1], id: 'new' }, { baseDate: '2026-11-25' });
    expect(nw.length).toBe(3);
  });
  it('previewAdd는 걸치는 주의 전후를 돌려준다', () => {
    const pv = previewAdd(ex, { ...ex[0], id: 'new', due: '2026-11-25' });
    expect(pv.weeks.length).toBeGreaterThan(0);
    for (const w of pv.weeks) expect(w.R).toBeGreaterThanOrEqual(w.beforeR);
    expect(isWeekendOrHoliday('2026-12-25')).toBe(true);
    expect(isWeekendOrHoliday('2026-11-17')).toBe(false);
  });
});
