import type { Store, AppState } from '../types';
import { DEMO_SCHEDULES } from '../data/schedules';

const STORM_KEY = 'awf-complete-storm';
const SALT = 'academic-weather-2026';
const ORIGINAL_DUE = new Map(DEMO_SCHEDULES.map((s) => [s.id, s.due]));

/** FNV-1a 32비트 → 1000~9999 */
export function completeCode(userId: string): string {
  let h = 0x811c9dc5;
  const t = `${SALT}:${userId}`;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return String(1000 + (h % 9000));
}

function readStorm(): boolean { try { return sessionStorage.getItem(STORM_KEY) === '1'; } catch { return false; } }
function writeStorm() { try { sessionStorage.setItem(STORM_KEY, '1'); } catch { /* 무시 */ } }

const CHECK = '<svg class="cc-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const DOT = '<svg class="cc-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';

/** 체험 진행 표시와 체험 완료 코드 화면. body에 직접 붙는다. */
export function mountComplete(store: Store): void {
  let stormSeen = readStorm();
  const chip = document.createElement('div');
  chip.className = 'complete-chip';
  chip.dataset.testid = 'complete-chip';
  chip.setAttribute('role', 'status');
  document.body.append(chip);

  let screen: HTMLElement | null = null;
  let lastKey = '';

  function progress(s: AppState) {
    const moved = s.schedules.some((x) => ORIGINAL_DUE.has(x.id) && ORIGINAL_DUE.get(x.id) !== x.due);
    const added = s.schedules.some((x) => x.source === 'user' && x.type !== 'personal');
    if (!stormSeen && s.session && s.grade === 3) {
      const w = store.getForecast(3).weeks[s.selectedWeek]?.weather;
      if (w === 'storm') { stormSeen = true; writeStorm(); }
    }
    return [
      { label: '마감 옮기기', done: moved },
      { label: '일정 등록', done: added },
      { label: '3학년 폭풍 확인', done: stormSeen },
    ];
  }

  function open() {
    const s = store.getState();
    if (!s.session || screen) return;
    const code = completeCode(s.session.userId);
    screen = document.createElement('div');
    screen.className = 'complete-screen';
    screen.dataset.testid = 'complete-screen';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');
    screen.setAttribute('aria-label', '체험 완료');
    screen.innerHTML = `
      <div class="cs-rays" aria-hidden="true"></div>
      <div class="cs-card">
        <img class="cs-icon" src="/weather/sunny.webp" width="200" height="200" alt="맑음">
        <p class="cs-title">학교의 날씨를 바꿔 봤어요</p>
        <div class="cs-code" data-testid="complete-code">${code}</div>
        <p class="cs-sub">체험 완료! 코드: ${code}</p>
        <button type="button" class="cs-close" data-testid="complete-close">닫기</button>
      </div>`;
    document.body.append(screen);
    document.body.dataset.complete = 'true';
    const btn = screen.querySelector<HTMLButtonElement>('.cs-close')!;
    btn.addEventListener('click', close);
    screen.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    btn.focus();
  }
  function close() {
    screen?.remove(); screen = null;
    delete document.body.dataset.complete;
    chip.querySelector<HTMLButtonElement>('button')?.focus();
  }

  function render(s: AppState) {
    if (!s.session) { chip.hidden = true; if (screen) close(); lastKey = ''; return; }
    chip.hidden = false;
    const steps = progress(s);
    const n = steps.filter((x) => x.done).length;
    const key = steps.map((x) => (x.done ? 1 : 0)).join('');
    if (key === lastKey) return;
    lastKey = key;
    if (n === 3) {
      chip.classList.add('is-done');
      chip.innerHTML = `<button type="button" class="cc-open" data-testid="complete-open">${CHECK}<span>체험 완료 코드 보기</span></button>`;
      chip.querySelector('button')!.addEventListener('click', open);
    } else {
      chip.classList.remove('is-done');
      chip.innerHTML = `<span class="cc-count">체험 ${n}/3</span>` + steps.map((x) =>
        `<span class="cc-step${x.done ? ' is-on' : ''}">${x.done ? CHECK : DOT}${x.label}<span class="sr-only">${x.done ? ' 완료' : ' 남음'}</span></span>`).join('');
    }
  }

  store.subscribe(render);
  render(store.getState());
}
