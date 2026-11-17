import type { Store, Schedule, ScheduleType, Weather, WeekForecast, Recommendation, AppState } from '../types';
import { recommendDates, SEMESTER, TYPE_LABEL, WEATHER_LABEL } from '../calc';

/** 타임라인·마감 시뮬레이터 */
const DAY = 16;
const BAR_H = 24;
const LANE = 28; // 막대 높이 + 단 간격 4px
const PAD = 4;
const WEEKS = 18;
const DAYS = WEEKS * 7;
const DAY_MS = 86400000;
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

// 계산 모듈과 독립적인 날짜 도우미(레이아웃 전용, UTC 기준)
const toN = (d: string): number => {
  const [y, m, dd] = d.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, dd) / DAY_MS);
};
const fromN = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);
const START = toN(SEMESTER.start);
const END = toN(SEMESTER.end);
const add = (d: string, k: number): string => fromN(toN(d) + k);
const md = (d: string): string => {
  const dt = new Date(toN(d) * DAY_MS);
  return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}(${DOW[dt.getUTCDay()]})`;
};

const ROWS: { key: string; label: string; types: ScheduleType[] }[] = [
  { key: 'exam', label: '시험', types: ['exam'] },
  { key: 'research', label: '연구활동', types: ['research_final', 'research_mid'] },
  { key: 'contest', label: '탐구대회', types: ['contest'] },
  { key: 'performance', label: '수행평가', types: ['performance'] },
  { key: 'self_eval', label: '자기평가서', types: ['self_eval'] },
  { key: 'general', label: '일반대회', types: ['general_contest'] },
  { key: 'event', label: '교내 행사·동아리', types: ['school_event', 'club'] },
  { key: 'admission', label: '입시', types: ['admission_doc', 'admission_interview'] },
  { key: 'personal', label: '개인 과제', types: ['personal'] },
];

const DOTS: Record<string, string> = { easy: '●○○', medium: '●●○', hard: '●●●' };
const LOCK =
  '<svg class="tl-lock" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

function span(s: Schedule): [number, number] {
  let a: number, b: number;
  if (s.period) {
    a = toN(s.period.start) - 7;
    b = toN(s.period.end);
  } else {
    b = toN(s.due);
    a = b - Math.max(1, s.L) + 1;
  }
  return [Math.max(START, a), Math.min(END, b)];
}

/** 이름 글자 폭 추정(px, 12~13px 글꼴 기준) */
function textW(t: string): number {
  let w = 0;
  for (const ch of t) w += /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af\u4e00-\u9fff]/.test(ch) ? 13 : 7.5;
  return Math.ceil(w);
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function mountTimeline(root: HTMLElement, store: Store): void {
  let selected: string | null = null;
  let lastFocus: string | null = null;
  let firstScroll = true;
  let revealId: string | null = null;
  const shown = (): boolean => el.getClientRects().length > 0 && el.offsetWidth > 0;
  let dragging = false;
  let pending = false;
  let toastTimer = 0;
  let recs: Recommendation[] = [];
  let prevPersonal: Weather[] | null = null;
  let personalBadges: Record<number, { from: Weather; to: Weather }> = {};

  root.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'tl';
  el.dataset.testid = 'timeline';
  el.setAttribute('data-testid', 'timeline');
  root.appendChild(el);

  const movable = (s: Schedule): boolean => (s.type === 'personal' ? true : store.can('move') && !s.fixed);

  function toast(msg: string): void {
    const t = el.querySelector<HTMLElement>('[data-testid="tl-toast"]');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => t.classList.remove('is-on'), 2400);
  }

  function render(): void {
    const st: AppState = store.getState();
    const teacher = st.role === 'teacher';
    const list = st.schedules.filter((s) => s.grade === st.grade && (teacher ? s.type !== 'personal' : true));
    if (st.focusScheduleId && st.focusScheduleId !== lastFocus) selected = st.focusScheduleId;
    const focusNow = st.focusScheduleId && st.focusScheduleId !== lastFocus ? st.focusScheduleId : null;
    lastFocus = st.focusScheduleId;
    if (selected && !list.some((s) => s.id === selected)) selected = null;

    const weeks: WeekForecast[] = teacher ? safe(() => store.getForecast().weeks, []) : safe(() => store.getPersonalForecast().weeks, []);
    let badges: Record<number, { from: Weather; to: Weather }>;
    if (teacher) {
      badges = safe(() => store.getBadges(), {} as Record<number, { from: Weather; to: Weather }>);
      prevPersonal = null;
    } else {
      const now = weeks.map((w) => w.weather);
      if (prevPersonal && prevPersonal.length === now.length) {
        const nb: Record<number, { from: Weather; to: Weather }> = {};
        now.forEach((w, i) => {
          if (prevPersonal![i] !== w) nb[i] = { from: prevPersonal![i], to: w };
        });
        if (Object.keys(nb).length) personalBadges = nb;
      } else personalBadges = {};
      prevPersonal = now;
      badges = personalBadges;
    }
    const sel = list.find((s) => s.id === selected) ?? null;
    recs = sel && !sel.fixed ? safe(() => recommendDates(st.schedules, sel).slice(0, 3), []) : [];

    const oldSc = el.querySelector<HTMLElement>('.tl-scroll');
    const prevScroll = oldSc?.scrollLeft ?? 0;
    const prevTop = oldSc?.scrollTop ?? 0;

    // 주 눈금
    let head = '';
    let strip = '';
    for (let i = 0; i < WEEKS; i++) {
      const wk = weeks[i];
      const weather: Weather = wk?.weather ?? 'sunny';
      const r = wk ? wk.R.toFixed(2) : '–';
      const ws = fromN(START + i * 7);
      const b = badges[i];
      const pins = recs
        .map((x, k) => (x.weekIndex === i ? `<span class="tl-pin" data-testid="top3-pin-${k}" title="추천 ${k + 1}">${k + 1}</span>` : ''))
        .join('');
      if (pins) strip += `<div class="tl-pins" style="left:${i * 7 * DAY}px;width:${7 * DAY}px">${pins}</div>`;
      head += `<div class="tl-week" data-testid="tl-week-${i}" data-week="${i}" data-weather="${weather}" data-r="${r}" style="left:${i * 7 * DAY}px;width:${7 * DAY}px">
        <div class="tl-week-top"><span class="tl-wn">${i + 1}주</span><span class="sub">${md(ws).replace(/\(.\)/, '')}</span></div>
        <div class="tl-week-mid"><img src="/weather/${weather}.webp" width="24" height="24" alt=""><span class="num">${r}</span></div>
        <div class="tl-week-name sub">${WEATHER_LABEL[weather]}</div>
        ${b ? `<span class="tl-badge badge" data-testid="tl-badge-${i}">${WEATHER_LABEL[b.from]} → ${WEATHER_LABEL[b.to]}</span>` : ''}
      </div>`;
    }

    // 유형별 줄
    let rows = '';
    let labels = '';
    for (const row of ROWS) {
      const items = list.filter((s) => row.types.includes(s.type)).sort((a, b) => span(a)[0] - span(b)[0]);
      if (!items.length) continue;
      // 막대 끝(px). 이름이 막대 밖에 쓰이면 그 폭까지 포함해 겹침을 계산한다.
      const laneEnds: number[] = [];
      const placed: { s: Schedule; lane: number; a: number; b: number; out: boolean }[] = [];
      for (const s of items) {
        const [a, b] = span(s);
        const w = Math.max(1, b - a + 1) * DAY;
        const locked = !movable(s);
        const nameW = textW(s.name);
        const inner = nameW + 24 + (s.difficulty ? 34 : 0) + (locked ? 16 : 0) + (s.w !== s.defaultW ? 52 : 0);
        const out = w < inner;
        const x0 = (a - START) * DAY;
        const x1 = x0 + w + (out ? nameW + 12 + (s.difficulty && w < 44 ? 34 : 0) : 0);
        let lane = laneEnds.findIndex((e) => e + 2 <= x0);
        if (lane < 0) {
          lane = laneEnds.length;
          laneEnds.push(x1);
        } else laneEnds[lane] = x1;
        placed.push({ s, lane, a, b, out });
      }
      const bars = placed
        .map(({ s, lane, a, b, out }) => {
          const w = Math.max(1, b - a + 1) * DAY;
          const locked = !movable(s);
          const cls = ['tl-bar', out ? 'is-out' : '', s.type === 'personal' ? 'is-personal' : '', s.fixed ? 'is-fixed' : '', locked && !s.fixed ? 'is-locked' : '', s.status === 'reported' ? 'is-reported' : '', s.id === selected ? 'is-selected' : '', movable(s) ? 'is-movable' : ''].join(' ');
          const adj = s.w !== s.defaultW ? '<span class="tl-adj">무게 조정</span>' : '';
          return `<button type="button" class="${cls}" data-testid="bar-${esc(s.id)}" data-id="${esc(s.id)}" data-due="${s.due}" data-fixed="${s.fixed}" data-status="${s.status}" data-type="${s.type}"
            style="left:${(a - START) * DAY}px;width:${w}px;top:${lane * LANE + PAD}px;height:${BAR_H}px" title="${esc(s.name)} · 마감 ${md(s.due)}">
            ${locked && (!out || w >= 28) ? LOCK : ''}${s.difficulty && (!out || w >= 44) ? `<span class="tl-dots">${DOTS[s.difficulty]}</span>` : ''}<span class="tl-name">${s.difficulty && out && w < 44 ? `<span class="tl-dots">${DOTS[s.difficulty]}</span> ` : ''}${esc(s.name)}</span>${adj}
          </button>`;
        })
        .join('');
      const h = laneEnds.length * LANE + PAD;
      rows += `<div class="tl-row" data-row="${row.key}" style="height:${h}px"><div class="tl-row-track" style="height:${h}px;width:${DAYS * DAY}px;background-size:${7 * DAY}px 100%">${bars}</div></div>`;
      labels += `<div class="tl-row-label" data-row="${row.key}" style="height:${h}px">${row.label}</div>`;
    }
    if (!rows) rows = `<div class="tl-empty sub">이 학년에는 아직 등록된 일정이 없어요.</div>`;

    const todayX = (toN(SEMESTER.today) - START) * DAY;
    const canUndo = safe(() => store.canUndo(), false);

    el.innerHTML = `
      <div class="tl-toolbar glass">
        <div><h2 class="tl-title">마감 시뮬레이터 <span class="tl-mode" data-testid="tl-mode-label">${teacher ? '학년 기상도' : '개인 기상도'}</span></h2><p class="sub">${teacher ? '막대를 끌어 마감을 옮겨 보세요.' : '개인 과제 막대를 끌어 옮겨 보세요. 학교 일정은 선생님만 옮길 수 있어요.'}</p></div>
        <div class="tl-actions">
          <button type="button" class="btn btn-ghost" data-testid="undo" ${canUndo ? '' : 'disabled'}>되돌리기</button>
          <button type="button" class="btn btn-ghost" data-testid="reset">초기화</button>
        </div>
      </div>
      <div class="tl-body">
        <div class="tl-frame glass">
          <div class="tl-labels"><div class="tl-labels-head"></div><div class="tl-labels-clip"><div class="tl-labels-inner">${labels}</div></div></div>
          <div class="tl-scroll-wrap">
            <div class="tl-scroll">
              <div class="tl-canvas" style="width:${DAYS * DAY}px">
                <div class="tl-sticky">
                  <div class="tl-strip">${strip}<span class="tl-today-pill" style="left:${todayX}px">오늘 ${md(SEMESTER.today).replace(/\(.\)/, '')}</span></div>
                  <div class="tl-head"><div class="tl-head-track" style="width:${DAYS * DAY}px">${head}</div></div>
                </div>
                <div class="tl-rows">${rows}</div>
                <div class="tl-today" style="left:${todayX}px"></div>
              </div>
            </div>
          </div>
        </div>
        ${sel ? panel(sel, teacher) : ''}
      </div>
      <div class="tl-toast glass" data-testid="tl-toast" role="status" aria-live="polite"></div>`;

    const sc = el.querySelector<HTMLElement>('.tl-scroll')!;
    const inner = el.querySelector<HTMLElement>('.tl-labels-inner')!;
    const syncLabels = (): void => {
      inner.style.transform = `translateY(${-sc.scrollTop}px)`;
    };
    sc.addEventListener('scroll', syncLabels, { passive: true });
    fit();
    // 다시 그려도 스크롤 위치는 그대로
    sc.scrollLeft = prevScroll;
    sc.scrollTop = prevTop;
    const target = focusNow ? el.querySelector<HTMLElement>(`[data-id="${CSS.escape(focusNow)}"]`) : null;
    if (target) {
      reveal(sc, target, true);
      firstScroll = false;
    } else if (firstScroll && shown()) {
      sc.scrollLeft = Math.max(0, todayX - 240);
      firstScroll = false;
    }
    if (revealId) {
      const b = el.querySelector<HTMLElement>(`[data-id="${CSS.escape(revealId)}"]`);
      if (b) reveal(sc, b, false);
      revealId = null;
    }
    syncLabels();
  }

  /** 막대가 스크롤 영역 안에 보이게(벗어났을 때만, nearest). 페이지는 움직이지 않는다. */
  function reveal(sc: HTMLElement, bar: HTMLElement, center: boolean): void {
    const r = sc.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    const stickyH = el.querySelector<HTMLElement>('.tl-sticky')?.offsetHeight ?? 0;
    const left = b.left - r.left + sc.scrollLeft;
    const top = b.top - r.top + sc.scrollTop;
    if (center) sc.scrollLeft = Math.max(0, left - 200);
    else if (b.left < r.left) sc.scrollLeft = Math.max(0, left - 24);
    else if (b.right > r.left + sc.clientWidth) sc.scrollLeft = left + b.width - sc.clientWidth + 24;
    if (b.top < r.top + stickyH) sc.scrollTop = Math.max(0, top - stickyH - PAD);
    else if (b.bottom > r.top + sc.clientHeight) sc.scrollTop = top + b.height - sc.clientHeight + PAD;
  }

  /** 타임라인 보기를 화면 남은 높이에 맞춘다 */
  function fit(): void {
    if (!shown()) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const h = `${Math.max(360, Math.floor(window.innerHeight - top))}px`;
    if (el.style.height !== h) el.style.height = h;
  }
  window.addEventListener('resize', fit);

  function panel(s: Schedule, teacher: boolean): string {
    const canW = safe(() => store.can('editWeight'), false);
    let top = '';
    const canApply = s.type === 'personal' ? !teacher : teacher && store.can('move');
    if (s.fixed) top = `<p class="sub tl-note">학교가 정한 일정이라 옮길 수 없어요.</p>`;
    else if (!recs.length) top = `<div data-testid="top3"><p class="sub tl-note">옮길 수 있는 날짜가 없어요.</p></div>`;
    else
      top = `<div class="tl-top3" data-testid="top3"><h4>맑은 주 TOP 3</h4><ol>${recs
        .map(
          (r, k) => `<li class="tl-top3-item" data-testid="top3-item-${k}" data-date="${r.date}" data-r="${r.maxR.toFixed(2)}" data-weather="${r.weather}">
          <span>${md(r.date)} · 예상 R <span class="num">${r.maxR.toFixed(2)}</span> · ${WEATHER_LABEL[r.weather]}</span>
          ${canApply ? `<button type="button" class="btn btn-ghost tl-apply" data-date="${r.date}">이 날짜로 옮기기</button>` : ''}
        </li>`,
        )
        .join('')}</ol></div>`;
    return `<aside class="tl-panel glass" data-testid="tl-panel">
      <div class="tl-panel-head"><h3>${esc(s.name)}</h3><button type="button" class="btn btn-ghost tl-close" aria-label="닫기">닫기</button></div>
      <dl class="tl-dl">
        <dt>유형</dt><dd>${TYPE_LABEL[s.type] ?? s.type}</dd>
        <dt>마감일</dt><dd>${md(s.due)}</dd>
        <dt>무게 w</dt><dd class="num">${s.w.toFixed(1)}${s.w !== s.defaultW ? ' <span class="tl-adj">무게 조정</span>' : ''}</dd>
        <dt>준비 L</dt><dd class="num">${s.L}일</dd>
        <dt>참여율 p</dt><dd class="num">${Math.round(s.p * 100)}%</dd>
        <dt>고정</dt><dd>${s.fixed ? '고정 일정' : '옮길 수 있어요'}</dd>
      </dl>
      ${s.status === 'reported' && teacher ? `<div class="tl-confirm"><p class="sub tl-note">학생이 제보한 일정이에요.</p><button type="button" class="btn" data-testid="confirm-btn">확정하기</button></div>` : ''}
      ${s.type === 'personal' && !teacher ? `<button type="button" class="btn btn-ghost tl-remove" data-testid="task-remove">삭제</button>` : ''}
      ${top}
      <div class="tl-weight">
        <label for="tl-w">무게</label>
        <input id="tl-w" type="number" min="0.1" max="10" step="0.1" value="${s.w}" data-testid="weight-input" ${canW ? '' : 'readonly disabled'}>
        <button type="button" class="btn" data-testid="weight-save" ${canW ? '' : 'disabled'}>저장</button>
        <button type="button" class="btn btn-ghost" data-testid="weight-reset" ${canW ? '' : 'disabled'}>기본값으로</button>
        <p class="sub tl-w-hint" data-testid="weight-hint">${canW ? '' : '무게는 선생님만 바꿀 수 있어요.'}</p>
      </div>
    </aside>`;
  }

  // 클릭(버튼)
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-testid="undo"]')) return void store.undo();
    if (t.closest('[data-testid="reset"]')) return void store.reset();
    if (t.closest('.tl-close')) {
      selected = null;
      return render();
    }
    if (t.closest('[data-testid="confirm-btn"]') && selected) {
      if (!store.confirmSchedule(selected)) toast('확정하지 못했어요. 다시 시도해 주세요.');
      return;
    }
    if (t.closest('[data-testid="task-remove"]') && selected) {
      const id = selected;
      selected = null;
      if (!store.removeSchedule(id)) {
        selected = id;
        toast('삭제하지 못했어요. 다시 시도해 주세요.');
      }
      return;
    }
    const ap = t.closest<HTMLElement>('.tl-apply');
    if (ap && selected) return void doMove(selected, ap.dataset.date!);
    if (t.closest('[data-testid="weight-save"]') && selected) {
      const inp = el.querySelector<HTMLInputElement>('[data-testid="weight-input"]')!;
      const v = Number(inp.value);
      if (!inp.value || !Number.isFinite(v) || v < 0.1 || v > 10) {
        inp.classList.add('is-invalid');
        el.querySelector<HTMLElement>('[data-testid="weight-hint"]')!.textContent = '무게는 0.1에서 10 사이로 입력해 주세요.';
        return;
      }
      store.setWeight(selected, Math.round(v * 10) / 10);
      return;
    }
    if (t.closest('[data-testid="weight-reset"]') && selected) return void store.resetWeight(selected);
  });

  function doMove(id: string, newDue: string): void {
    const r = store.move(id, newDue);
    if (!r.ok) {
      if (r.reason === 'out_of_semester') toast('학기 안의 날짜로 옮겨 주세요.');
      else if (r.reason === 'fixed') toast('학교가 정한 일정이라 옮길 수 없어요.');
      else if (r.reason === 'forbidden') toast('학교 일정은 선생님만 옮길 수 있어요.');
    }
  }

  // 드래그
  let drag: { id: string; bar: HTMLElement; x0: number; moved: boolean; can: boolean; s: Schedule; pid: number } | null = null;

  el.addEventListener('pointerdown', (e) => {
    const bar = (e.target as HTMLElement).closest<HTMLElement>('.tl-bar');
    if (!bar || e.button !== 0) return;
    const s = store.getState().schedules.find((x) => x.id === bar.dataset.id);
    if (!s) return;
    e.preventDefault();
    drag = { id: s.id, bar, x0: e.clientX, moved: false, can: movable(s), s, pid: e.pointerId };
  });

  const clearDrop = (): void => el.querySelectorAll('.tl-week.is-drop').forEach((n) => n.classList.remove('is-drop'));

  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dx) >= 5) {
      drag.moved = true;
      if (drag.can) {
        dragging = true;
        drag.bar.classList.add('is-dragging');
      }
    }
    if (!drag.moved || !drag.can) return;
    const days = Math.round(dx / DAY);
    drag.bar.style.transform = `translateX(${days * DAY}px)`;
    const nd = toN(drag.s.due) + days;
    const wi = Math.floor((nd - START) / 7);
    clearDrop();
    if (wi >= 0 && wi < WEEKS) el.querySelector(`.tl-week[data-week="${wi}"]`)?.classList.add('is-drop');
  });

  window.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    dragging = false;
    clearDrop();
    if (!d.moved) {
      selected = d.id;
      revealId = d.id; // 패널이 열려 폭이 줄어도 누른 막대가 보이게
      render();
      return;
    }
    if (!d.can) {
      d.bar.classList.remove('bounce');
      void d.bar.offsetWidth;
      d.bar.classList.add('bounce');
      toast(d.s.type !== 'personal' && !store.can('move') ? '학교 일정은 선생님만 옮길 수 있어요.' : '학교가 정한 일정이라 옮길 수 없어요.');
      if (pending) {
        pending = false;
        render();
      }
      return;
    }
    const days = Math.round((e.clientX - d.x0) / DAY);
    d.bar.classList.remove('is-dragging');
    d.bar.style.transform = '';
    pending = false;
    if (days === 0) return render();
    selected = d.id;
    revealId = d.id;
    const before = store.getState().schedules;
    doMove(d.id, add(d.s.due, days));
    if (store.getState().schedules === before) render();
  });

  window.addEventListener('pointercancel', () => {
    if (!drag) return;
    drag.bar.classList.remove('is-dragging');
    drag.bar.style.transform = '';
    drag = null;
    dragging = false;
    clearDrop();
  });

  store.subscribe(() => {
    if (dragging) {
      pending = true;
      return;
    }
    render();
  });

  // 보기가 처음 보일 때 '오늘' 부근으로 스크롤
  const io = new IntersectionObserver((ents) => {
    if (ents.some((x) => x.isIntersecting) && firstScroll) {
      fit();
      const sc = el.querySelector<HTMLElement>('.tl-scroll');
      if (sc) {
        sc.scrollLeft = Math.max(0, (toN(SEMESTER.today) - START) * DAY - 240);
        firstScroll = false;
      }
    }
  });
  io.observe(el);

  render();
}
