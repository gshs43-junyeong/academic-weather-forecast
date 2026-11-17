import type { Grade, Schedule, Weather } from '../types';
import { SEMESTER, addDays, dayNumber, diffDays, forecast, inSemester, isWeekendOrHoliday, moveSchedule } from './index';

/** 폭풍 완화 제안(교사용): 그 주의 R을 가장 많이 낮추는 일정 이동 */
export interface ReliefSuggestion { scheduleId: string; name: string; fromDue: string; toDue: string; beforeR: number; afterR: number; afterWeather: Weather; }

export function suggestRelief(schedules: Schedule[], grade: Grade, weekIndex: number, opts?: { today?: string; count?: number }): ReliefSuggestion[] {
  const today = dayNumber(opts?.today ?? SEMESTER.today);
  const count = opts?.count ?? 3;
  const base = schedules.filter((s) => s.type !== 'personal');
  const fc = forecast(base, grade);
  const wk = fc.weeks[weekIndex];
  if (!wk) return [];
  const beforeR = wk.R;
  const ids = new Set(wk.contributions.filter((c) => c.value > 0).map((c) => c.scheduleId));
  const targets = base.filter((s) => s.grade === grade && ids.has(s.id) && !s.fixed && dayNumber(s.due) > today);
  const out: (ReliefSuggestion & { dist: number })[] = [];
  for (const s of targets) {
    let best: (ReliefSuggestion & { dist: number }) | null = null;
    for (const off of [-21, -14, -7, 7, 14, 21]) {
      const toDue = addDays(s.due, off);
      const shown = s.eventDate ? addDays(s.eventDate, off) : toDue;
      if (!inSemester(toDue) || dayNumber(toDue) <= today || isWeekendOrHoliday(shown)) continue;
      const mv = moveSchedule(base, s.id, toDue);
      if (!mv.ok) continue;
      const after = forecast(mv.schedules, grade);
      const newStorm = after.weeks.some((w, i) => i !== weekIndex && w.weather === 'storm' && fc.weeks[i].weather !== 'storm');
      if (newStorm) continue;
      const a = after.weeks[weekIndex];
      const cand = { scheduleId: s.id, name: s.name, fromDue: s.due, toDue, beforeR, afterR: a.R, afterWeather: a.weather, dist: Math.abs(diffDays(toDue, s.due)) };
      if (!best || cand.afterR < best.afterR - 1e-9 || (Math.abs(cand.afterR - best.afterR) <= 1e-9 && cand.dist < best.dist)) best = cand;
    }
    if (best && best.afterR <= beforeR - 0.01) out.push(best);
  }
  out.sort((a, b) => a.afterR - b.afterR || a.dist - b.dist);
  return out.slice(0, count).map(({ dist: _d, ...r }) => r);
}
