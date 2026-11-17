import type { AppState, GradeForecast, Schedule, ScheduleType, Store, Weather, WeekForecast } from '../types';
import { SEMESTER, WEATHER_LABEL, TYPE_LABEL, addDays, diffDays, inSemester } from '../calc/index';

/** 나만의 과제 플래너(MVP 4, 학생) */

const TYPE_ORDER: ScheduleType[] = ['research_final', 'research_mid', 'contest', 'general_contest', 'club', 'school_event', 'admission_doc', 'admission_interview', 'exam', 'performance', 'self_eval'];

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function md(d: string): string {
  const [, m, day] = d.split('-').map(Number);
  return `${m}/${day}`;
}
function f2(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}
/** 그 주 목요일이 속한 달 기준 "12월 1주차" */
function monthWeekLabel(start: string): string {
  const [, m, day] = addDays(start, 3).split('-').map(Number);
  return `${m}월 ${Math.ceil(day / 7)}주차`;
}
function icon(w: Weather, size: number): string {
  return `<img src="/weather/${w}.webp" width="${size}" height="${size}" alt="" draggable="false">`;
}

function personalForecast(store: Store): GradeForecast {
  try {
    const f = store.getPersonalForecast();
    if (f && f.weeks && f.weeks.length) return f;
  } catch {
    /* 저장소가 아직 준비되지 않았으면 학년 예보로 */
  }
  return store.getForecast();
}

function isMine(s: Schedule, st: AppState): boolean {
  if (s.grade !== st.grade) return false;
  if (s.type === 'personal') return true;
  if (s.optional) return st.personalChecked.includes(s.id);
  return true;
}

function renderChecks(st: AppState): string {
  const opts = st.schedules.filter((s) => s.grade === st.grade && s.optional === true && s.type !== 'personal');
  const groups = new Map<ScheduleType, Schedule[]>();
  for (const s of opts) {
    if (!groups.has(s.type)) groups.set(s.type, []);
    groups.get(s.type)!.push(s);
  }
  const types = [...groups.keys()].sort((a, b) => TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b));
  const body = types.length
    ? types
        .map((t) => {
          const items = groups.get(t)!.sort((a, b) => a.due.localeCompare(b.due));
          return `<div class="pl-group"><div class="pl-group-title">${esc(TYPE_LABEL[t])}</div>${items
            .map((s) => {
              const checked = st.personalChecked.includes(s.id);
              return `<label class="pl-check${checked ? ' is-on' : ''}"><input type="checkbox" data-testid="pl-check-${esc(s.id)}" data-id="${esc(s.id)}"${checked ? ' checked' : ''}><span class="pl-check-name">${esc(s.name)}</span><span class="pl-check-date sub num">${md(s.eventDate ?? s.due)}</span></label>`;
            })
            .join('')}</div>`;
        })
        .join('')
    : `<p class="sub">이 학년에는 선택 일정이 없어요.</p>`;
  return `<h2 class="pl-title">내 참가 일정</h2><p class="sub pl-lead">참가하는 일정만 체크해 주세요. 시험·수행평가·자기평가서는 모두 반영돼요.</p><div class="pl-checks">${body}</div>`;
}

function stormInfo(pf: GradeForecast): { todayStorm: boolean; next: WeekForecast | null } {
  const today = SEMESTER.today;
  const cur = pf.weeks.find((w) => w.start <= today && today <= w.end);
  const next = pf.weeks.find((w) => w.weather === 'storm' && w.start > today) ?? null;
  return { todayStorm: !!cur && cur.weather === 'storm', next };
}

function renderForecast(pf: GradeForecast, gf: GradeForecast, st: AppState): string {
  const today = SEMESTER.today;
  const { todayStorm, next } = stormInfo(pf);
  const dday = todayStorm ? '지금 폭풍 주예요' : next ? `다음 폭풍까지 D-${diffDays(next.start, today)}` : '남은 폭풍이 없어요';
  let alert: string;
  if (next && diffDays(next.start, today) <= 14) {
    alert = `<div class="pl-alert is-storm" data-testid="pl-alert" data-weather="storm" role="alert">${icon('storm', 24)}<span><b>폭풍 경보:</b> ${monthWeekLabel(next.start)}(${md(next.start)}~${md(next.end)})가 폭풍이에요. 14일 전부터 준비를 시작해요.</span></div>`;
  } else {
    alert = `<div class="pl-alert is-calm" data-testid="pl-alert"><span>폭풍 14일 전에 경보로 알려 드려요.</span></div>`;
  }
  const cells = pf.weeks
    .map((w, i) => {
      const g = gf.weeks[i];
      const diff = g && g.weather !== w.weather ? `<span class="pl-diff">학년 ${WEATHER_LABEL[g.weather]} → 나 ${WEATHER_LABEL[w.weather]}</span>` : '';
      const isToday = w.start <= today && today <= w.end;
      return `<div class="pl-week${w.weather === 'storm' ? ' is-storm' : ''}${isToday ? ' is-today' : ''}" data-testid="pl-week-${i}" data-weather="${w.weather}" data-r="${f2(w.R)}" title="${md(w.start)}~${md(w.end)}"><div class="pl-week-top"><span class="pl-week-no num">${i + 1}주</span>${icon(w.weather, 24)}</div><div class="pl-week-r num">${f2(w.R)}</div><div class="pl-week-name">${WEATHER_LABEL[w.weather]}</div>${diff}</div>`;
    })
    .join('');

  // 시작 순서 제안
  const byId = new Map(st.schedules.map((s) => [s.id, s] as const));
  type Item = { name: string; L: number; start: string };
  let items: Item[] = [];
  let orderHead: string;
  if (next) {
    orderHead = `${monthWeekLabel(next.start)} 폭풍에 대비해 이 순서로 시작해요.`;
    items = next.contributions
      .map((c) => byId.get(c.scheduleId))
      .filter((s): s is Schedule => !!s)
      .map((s) => ({ name: s.name, L: s.L, start: addDays(s.due, -s.L + 1) }));
  } else {
    orderHead = '앞으로 4주 안에 마감인 일정이에요.';
    const until = addDays(today, 28);
    items = st.schedules
      .filter((s) => isMine(s, st) && s.due >= today && s.due <= until)
      .map((s) => ({ name: s.name, L: s.L, start: addDays(s.due, -s.L + 1) }));
  }
  items.sort((a, b) => b.L - a.L || a.start.localeCompare(b.start));
  items = items.slice(0, 6);
  const order = items.length
    ? `<ol class="pl-order-list">${items
        .map((it, n) => `<li data-testid="pl-order-item-${n}"><span class="num">${n + 1}.</span> ${esc(it.name)} · 준비 ${it.L}일 · ${md(it.start)}부터${it.start < today ? ' <span class="sub">(이미 시작)</span>' : ''}</li>`)
        .join('')}</ol>`
    : `<p class="sub">앞으로 4주 안에 마감인 일정이 없어요.</p>`;

  return `<div class="pl-fc-head"><h2 class="pl-title">개인 기상도</h2><span class="pl-dday num" data-testid="pl-dday">${dday}</span></div>${alert}<div class="pl-weeks">${cells}</div><div class="pl-order" data-testid="pl-order"><div class="pl-order-head"><b>시작 순서 제안</b><span class="sub">${orderHead}</span></div>${order}</div>`;
}

function renderTasks(st: AppState): string {
  const tasks = st.schedules.filter((s) => s.type === 'personal' && s.grade === st.grade).sort((a, b) => a.due.localeCompare(b.due));
  if (!tasks.length) {
    return `<div class="pl-empty"><p>아직 등록된 과제가 없어요. 첫 과제를 추가해 보세요.</p><p class="sub">타임라인에서 과제 막대를 끌어 옮길 수 있어요.</p><button type="button" class="btn-ghost" data-act="to-timeline">타임라인에서 보기</button></div>`;
  }
  return `<ul class="pl-tasks">${tasks
    .map((t) => {
      const start = t.startDate ?? addDays(t.due, -t.L + 1);
      return `<li class="pl-task" data-testid="pl-task-${esc(t.id)}"><div class="pl-task-main"><span class="pl-task-title">${esc(t.name)}</span><span class="sub num">${md(start)}~${md(t.due)} · 무게 ${f2(t.w)}</span></div><button type="button" class="btn-ghost pl-task-remove" data-testid="pl-task-remove-${esc(t.id)}" data-remove="${esc(t.id)}">삭제</button></li>`;
    })
    .join('')}</ul><p class="sub pl-tl-hint">타임라인에서 과제 막대를 끌어 옮길 수 있어요. <button type="button" class="pl-link" data-act="to-timeline">타임라인에서 보기</button></p>`;
}

export function mountPlanner(root: HTMLElement, store: Store): void {
  root.classList.add('planner-root');
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'planner';
  wrap.dataset.testid = 'planner';
  root.appendChild(wrap);

  let mode: 'none' | 'teacher' | 'student' = 'none';
  let colChecks: HTMLElement, colFc: HTMLElement, taskList: HTMLElement, hint: HTMLElement;
  let lastKey = '';

  const buildStudent = () => {
    wrap.innerHTML = `
      <section class="pl-col pl-col-checks glass"></section>
      <section class="pl-col pl-col-fc glass"></section>
      <section class="pl-col pl-col-tasks glass">
        <h2 class="pl-title">개인 과제</h2>
        <form class="pl-form" novalidate>
          <label class="pl-field pl-field-wide"><span class="sub">과제 이름</span><input type="text" data-testid="pl-task-name" maxlength="40" placeholder="예: 물리 실험 보고서"></label>
          <label class="pl-field"><span class="sub">예상 시간(시간)</span><input type="number" data-testid="pl-task-hours" min="0.5" step="0.5" placeholder="8"></label>
          <label class="pl-field"><span class="sub">시작일</span><input type="date" data-testid="pl-task-start" min="${SEMESTER.start}" max="${SEMESTER.end}" value="${SEMESTER.today}"></label>
          <label class="pl-field"><span class="sub">마감</span><input type="date" data-testid="pl-task-due" min="${SEMESTER.start}" max="${SEMESTER.end}"></label>
          <button type="submit" class="btn pl-add" data-testid="pl-task-add">과제 추가</button>
          <p class="pl-hint" data-testid="pl-task-hint" aria-live="polite"></p>
        </form>
        <div class="pl-task-list"></div>
      </section>`;
    colChecks = wrap.querySelector('.pl-col-checks')!;
    colFc = wrap.querySelector('.pl-col-fc')!;
    taskList = wrap.querySelector('.pl-task-list')!;
    hint = wrap.querySelector('[data-testid="pl-task-hint"]')!;
    const form = wrap.querySelector('form')!;
    const q = (id: string) => wrap.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = q('pl-task-name').value.trim();
      const hours = Number(q('pl-task-hours').value);
      const startDate = q('pl-task-start').value;
      const due = q('pl-task-due').value;
      let msg = '';
      if (!name) msg = '과제 이름을 입력해 주세요.';
      else if (!(hours > 0)) msg = '예상 시간은 0보다 커야 해요.';
      else if (!startDate || !due || !inSemester(startDate) || !inSemester(due)) msg = '학기 안의 날짜를 골라 주세요.';
      else if (due < startDate) msg = '마감은 시작일보다 뒤여야 해요.';
      if (!msg) {
        let res: Schedule | null = null;
        try {
          res = store.addPersonalTask({ name, hours, startDate, due });
        } catch {
          res = null;
        }
        if (!res) msg = '과제를 추가하지 못했어요. 입력을 다시 확인해 주세요.';
        else {
          q('pl-task-name').value = '';
          q('pl-task-hours').value = '';
          q('pl-task-due').value = '';
          hint.classList.remove('is-error');
          hint.textContent = `과제를 추가했어요: ${res.name}`;
          return;
        }
      }
      hint.classList.add('is-error');
      hint.textContent = msg;
    });
    wrap.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.type === 'checkbox' && t.dataset.id) {
        try {
          store.setPersonalChecked(t.dataset.id, t.checked);
        } catch {
          /* 저장소 준비 전 */
        }
      }
    });
    wrap.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act],[data-remove]');
      if (!el) return;
      if (el.dataset.act === 'to-timeline') store.setView('timeline');
      else if (el.dataset.remove) {
        try {
          store.removeSchedule(el.dataset.remove);
        } catch {
          /* 저장소 준비 전 */
        }
      }
    });
  };

  const render = (st: AppState) => {
    if (!st.session) return;
    if (st.role !== 'student') {
      if (mode !== 'teacher') {
        mode = 'teacher';
        lastKey = '';
        wrap.innerHTML = `<div class="pl-teacher glass">플래너는 학생 화면이에요.</div>`;
      }
      return;
    }
    if (mode !== 'student') {
      mode = 'student';
      lastKey = '';
      buildStudent();
    }
    let pf: GradeForecast, gf: GradeForecast;
    try {
      gf = store.getForecast();
      pf = personalForecast(store);
    } catch {
      colFc.innerHTML = `<p class="sub">예보를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>`;
      return;
    }
    const key = [st.grade, st.personalChecked.join(','), JSON.stringify(st.schedules.map((s) => [s.id, s.due, s.w, s.L])), pf.weeks.map((w) => w.R.toFixed(3) + w.weather).join(','), gf.weeks.map((w) => w.weather).join(',')].join('|');
    if (key === lastKey) return;
    lastKey = key;
    const scroll = colChecks.querySelector('.pl-checks')?.scrollTop ?? 0;
    colChecks.innerHTML = renderChecks(st);
    const pc = colChecks.querySelector('.pl-checks');
    if (pc) pc.scrollTop = scroll;
    colFc.innerHTML = renderForecast(pf, gf, st);
    taskList.innerHTML = renderTasks(st);
  };

  store.subscribe(render);
  render(store.getState());
}
