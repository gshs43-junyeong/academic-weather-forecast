import type { AppState, Contribution, GradeForecast, Store, Weather, WeekForecast } from '../types';
import { WEATHER_LABEL } from '../calc/index';

/** 홈(히어로·18주 그리드·달력·날씨 띠)과 주 상세 */

const DOW = ['월', '화', '수', '목', '금', '토', '일'];
const LOCK_SVG =
  '<svg class="lock" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

function parts(d: string): { y: number; m: number; day: number } {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
}
function md(d: string): string {
  const p = parts(d);
  return `${p.m}/${p.day}`;
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function f2(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}
function icon(w: Weather, size: number, cls = ''): string {
  return `<img class="${cls}" src="/weather/${w}.webp" width="${size}" height="${size}" alt="" draggable="false">`;
}
/** 주의 월요일 기준 "12월 1주차" */
function monthWeekLabel(start: string): string {
  const p = parts(start);
  return `${p.m}월 ${Math.ceil(p.day / 7)}주차`;
}

function summary(state: AppState, wk: WeekForecast): string {
  if (wk.weather === 'sunny') return '한가한 주예요';
  const due = state.schedules.filter((s) => s.grade === state.grade && s.due >= wk.start && s.due <= wk.end).length;
  if (due > 0) return `마감 ${due}개가 겹쳤어요`;
  const prep = wk.contributions.filter((c) => c.value > 0).length;
  if (prep > 0) return `마감은 없지만 준비할 일정이 ${prep}개 있어요`;
  return '한가한 주예요';
}

function heroHtml(state: AppState, wk: WeekForecast): string {
  return `
  <div class="hero glass${wk.weather === 'storm' ? ' is-storm' : ''}" data-testid="hero" data-weather="${wk.weather}">
    <div class="hero-head">
      <div class="hero-title">${state.grade}학년 · ${monthWeekLabel(wk.start)}</div>
      <div class="sub num">${md(wk.start)} ~ ${md(wk.end)} · ${wk.index + 1}주</div>
    </div>
    ${icon(wk.weather, 160, 'hero-icon')}
    <div class="hero-r num" data-testid="hero-r">R ${f2(wk.R)}</div>
    <div class="hero-weather" data-testid="hero-weather">${WEATHER_LABEL[wk.weather]}</div>
    <div class="hero-summary" data-testid="hero-summary">${summary(state, wk)}</div>
  </div>`;
}

function weeksHtml(fc: GradeForecast, state: AppState, badges: Record<number, { from: Weather; to: Weather }>): string {
  return `<div class="week-grid">${fc.weeks
    .map((w) => {
      const sel = w.index === state.selectedWeek;
      const b = badges[w.index];
      const badge = b
        ? `<span class="badge week-badge" data-weather="${b.to}" data-testid="badge-${w.index}">${WEATHER_LABEL[b.from]} → ${WEATHER_LABEL[b.to]}</span>`
        : '';
      return `<button type="button" class="week-card glass${w.weather === 'storm' ? ' is-storm' : ''}${sel ? ' is-selected' : ''}"
        data-testid="week-card-${w.index}" data-week="${w.index}" data-weather="${w.weather}" data-r="${f2(w.R)}"${sel ? ' aria-current="true"' : ''}>
        <span class="wc-head"><b>${w.index + 1}주</b><span class="sub num">${md(w.start)}~${md(w.end)}</span></span>
        ${icon(w.weather, 48, 'wc-icon')}
        <span class="wc-r num">${f2(w.R)}</span>
        <span class="wc-name sub">${WEATHER_LABEL[w.weather]}</span>
        ${badge}
      </button>`;
    })
    .join('')}</div>`;
}

function calendarHtml(fc: GradeForecast, state: AppState): string {
  const head = `<div class="cal-row cal-headrow"><span class="cal-rowhead sub">주</span>${DOW.map((d) => `<span class="cal-dow sub">${d}</span>`).join('')}</div>`;
  const rows = fc.weeks
    .map((w) => {
      const sel = w.index === state.selectedWeek;
      const days = w.days
        .map((d) => {
          const p = parts(d.date);
          return `<button type="button" class="cal-day" data-testid="cal-day-${d.date}" data-week="${w.index}" data-weather="${d.weather}">
            <span class="num cal-date">${p.day === 1 ? `${p.m}/1` : p.day}</span>
            <span class="cal-w">${icon(d.weather, 20)}<span class="sub">${WEATHER_LABEL[d.weather]}</span></span>
          </button>`;
        })
        .join('');
      return `<div class="cal-row${sel ? ' is-selected' : ''}"${sel ? ' aria-current="true"' : ''}>
        <button type="button" class="cal-rowhead" data-week="${w.index}" data-weather="${w.weather}"><b>${w.index + 1}주</b><span class="sub">${WEATHER_LABEL[w.weather]}</span></button>${days}</div>`;
    })
    .join('');
  return `<div class="calendar" data-testid="calendar">
    <div class="cal-note sub">칸은 일 단위, 폭풍 주 판정은 주 단위예요</div>
    <div class="cal-scroll">${head}${rows}</div>
  </div>`;
}

function stripHtml(fc: GradeForecast, state: AppState): string {
  return `<div class="week-strip glass" data-testid="week-strip">${fc.weeks
    .map((w) => {
      const sel = w.index === state.selectedWeek;
      return `<button type="button" class="strip-cell${sel ? ' is-selected' : ''}" data-week="${w.index}" data-weather="${w.weather}"
        title="${w.index + 1}주 · ${WEATHER_LABEL[w.weather]} · R ${f2(w.R)}" aria-label="${w.index + 1}주 ${WEATHER_LABEL[w.weather]}"${sel ? ' aria-current="true"' : ''}>
        <span class="num">${w.index + 1}</span></button>`;
    })
    .join('')}</div>`;
}

function contribHtml(store: Store, wk: WeekForecast): string {
  const list: Contribution[] = wk.contributions.filter((c) => c.value > 0).slice().sort((a, b) => b.value - a.value);
  if (list.length === 0) return `<div class="detail-empty sub">이 주에는 준비할 일정이 없어요.</div>`;
  const total = list.reduce((a, c) => a + c.value, 0) || 1;
  // 표시 값(소수 둘째 자리)의 합이 실제 합과 0.01 이내가 되도록 최대 나머지 방식으로 반올림
  const target = Math.round(list.reduce((a, c) => a + c.value, 0) * 100);
  const floors = list.map((c) => Math.floor(c.value * 100 + 1e-9));
  let rest = target - floors.reduce((a, b) => a + b, 0);
  const order = list.map((c, i) => i).sort((a, b) => (list[b].value * 100 - floors[b]) - (list[a].value * 100 - floors[a]));
  for (const i of order) { if (rest <= 0) break; floors[i] += 1; rest -= 1; }
  const shown = floors.map((n) => (n / 100).toFixed(2));
  const canMove = store.can('move');
  const greys = ['--ink-2', '--ink-3'];
  const segs = list
    .map((c, i) => {
      const style = i === 0 ? 'background:var(--wc)' : `background:var(${greys[(i - 1) % 2]});opacity:${Math.max(0.25, 0.7 - i * 0.08).toFixed(2)}`;
      return `<span class="contrib-seg${i === 0 ? ' is-top' : ''}" data-testid="contrib-seg-${esc(c.scheduleId)}" data-value="${shown[i]}"
        style="flex-grow:${c.value / total};${style}" title="${esc(c.name)} ${f2(c.value)}"></span>`;
    })
    .join('');
  const shownSum = target / 100;
  const rows = list
    .map((c, i) => {
      const fixedNote = c.fixed ? `<span class="contrib-fixed sub">${LOCK_SVG}학교가 정한 일정</span>` : '';
      const move = canMove && !c.fixed
        ? `<button type="button" class="btn move-this" data-testid="move-this" data-id="${esc(c.scheduleId)}">이 일정을 옮기면?</button>`
        : '';
      return `<li class="contrib-item">
        <span class="contrib-dot${i === 0 ? ' is-top' : ''}"></span>
        <span class="contrib-name">${esc(c.name)}</span>${fixedNote}
        <span class="num contrib-val">${shown[i]}</span>${move}
      </li>`;
    })
    .join('');
  return `<div class="contrib-bar" data-testid="contrib-bar">${segs}</div>
    <ul class="contrib-list">${rows}</ul>
    <div class="contrib-sum num" data-testid="contrib-sum">기여 합 ${f2(shownSum)}</div>`;
}

function detailHtml(store: Store, wk: WeekForecast): string {
  const max = Math.max(0, ...wk.days.map((d) => d.load));
  const topIdx = max > 0 ? wk.days.findIndex((d) => d.load === max) : -1;
  const bars = wk.days
    .map((d, i) => {
      const h = max > 0 ? Math.max(2, (d.load / max) * 100) : 2;
      return `<div class="day-col">
        <div class="day-track"><div class="day-bar${i === topIdx ? ' is-top' : ''}" data-testid="day-bar-${i}" data-load="${f2(d.load)}" data-weather="${d.weather}" style="height:${h}%"></div></div>
        <div class="sub">${DOW[i]} <span class="num">${md(d.date)}</span></div>
        <div class="num day-load">${f2(d.load)}</div>
        <div class="sub">${WEATHER_LABEL[d.weather]}</div>
      </div>`;
    })
    .join('');
  return `<div class="week-detail glass${wk.weather === 'storm' ? ' is-storm' : ''}" data-testid="week-detail" data-weather="${wk.weather}" role="dialog" aria-label="${wk.index + 1}주 상세">
    <button type="button" class="btn detail-close" data-testid="detail-close" aria-label="닫기">닫기</button>
    <div class="detail-top">
      ${icon(wk.weather, 96, 'detail-icon')}
      <div>
        <div class="sub num">${wk.index + 1}주 · ${md(wk.start)} ~ ${md(wk.end)}</div>
        <div class="detail-r num" data-testid="detail-r">R ${f2(wk.R)}</div>
        <div class="detail-meta"><span class="detail-weather">${WEATHER_LABEL[wk.weather]}</span>
        <span class="sub num" data-testid="detail-w">주간 부하 W ${f2(wk.W)}</span></div>
      </div>
    </div>
    <div class="detail-body">
      <section class="detail-days"><h3 class="detail-h">일별 부하</h3><div class="day-bars">${bars}</div></section>
      <section class="detail-contrib"><h3 class="detail-h">원인 분해</h3>${contribHtml(store, wk)}</section>
    </div>
  </div>`;
}

export function mountHome(root: HTMLElement, store: Store): void {
  root.classList.add('home-root');
  let lastKey = '';

  const render = (state: AppState) => {
    if (!state.session) return;
    let fc: GradeForecast;
    let badges: Record<number, { from: Weather; to: Weather }> = {};
    try {
      fc = store.getForecast();
      badges = store.getBadges();
    } catch {
      root.innerHTML = `<div class="home-error glass">예보를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</div>`;
      lastKey = '';
      return;
    }
    if (!fc || !fc.weeks || fc.weeks.length === 0) {
      root.innerHTML = `<div class="home-error glass">아직 예보가 없어요.</div>`;
      lastKey = '';
      return;
    }
    const key = [fc === null ? '' : JSON.stringify(fc.weeks.map((w) => [w.R, w.weather])), state.grade, state.selectedWeek, state.homeMode, state.detailOpen, state.role, state.schedules.length, JSON.stringify(badges)].join('|');
    if (key === lastKey && root.childElementCount) return;
    lastKey = key;
    const sel = Math.min(Math.max(state.selectedWeek, 0), fc.weeks.length - 1);
    const wk = fc.weeks[sel];
    const calScroll = root.querySelector('.cal-scroll')?.scrollTop ?? null;
    root.innerHTML = `<div class="home">
      ${heroHtml(state, wk)}
      <div class="home-right">
        <div class="home-toolbar">
          <div class="seg" role="group" aria-label="보기 방식">
            <button type="button" class="pill" data-testid="home-mode-weeks" data-mode="weeks" aria-pressed="${state.homeMode === 'weeks'}">주간</button>
            <button type="button" class="pill" data-testid="home-mode-calendar" data-mode="calendar" aria-pressed="${state.homeMode === 'calendar'}">달력</button>
          </div>
          <span class="sub">${state.homeMode === 'weeks' ? '주를 누르면 자세히 볼 수 있어요' : '칸을 누르면 그 주를 골라요'}</span>
        </div>
        <div class="home-panel">
          ${state.homeMode === 'calendar' ? calendarHtml(fc, state) : weeksHtml(fc, state, badges)}
          ${state.detailOpen ? detailHtml(store, wk) : ''}
        </div>
      </div>
      ${stripHtml(fc, state)}
    </div>`;
    if (calScroll !== null) {
      const sc = root.querySelector('.cal-scroll');
      if (sc) sc.scrollTop = calScroll;
    }
  };

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const mode = t.closest<HTMLElement>('[data-mode]');
    if (mode) { store.setHomeMode(mode.dataset.mode as 'weeks' | 'calendar'); return; }
    if (t.closest('[data-testid="detail-close"]')) { store.closeDetail(); return; }
    const mv = t.closest<HTMLElement>('[data-testid="move-this"]');
    if (mv) { store.setView('timeline', mv.dataset.id ?? null); return; }
    const wkEl = t.closest<HTMLElement>('[data-week]');
    if (wkEl) {
      const idx = Number(wkEl.dataset.week);
      const openDetail = wkEl.classList.contains('week-card');
      store.selectWeek(idx, openDetail);
    }
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && store.getState().detailOpen) store.closeDetail();
  });

  store.subscribe(render);
  render(store.getState());
}
