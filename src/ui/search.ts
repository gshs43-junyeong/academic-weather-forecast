import type { Schedule, Store } from '../types';
import { SEMESTER, TYPE_LABEL, WEATHER_LABEL, weekIndexOf } from '../calc/index';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const shown = (s: Schedule) => s.eventDate ?? s.due;
function fmtDate(d: string): string {
  const [y, m, dd] = d.split('-').map(Number);
  return `${m}/${dd}(${DOW[new Date(y, m - 1, dd).getDay()]})`;
}
function hay(s: Schedule): string {
  const d = shown(s); const [, m, dd] = d.split('-').map(Number);
  return norm([s.name, s.subject ?? '', TYPE_LABEL[s.type], `${m}/${dd}`, `${m}월${dd}일`, `${m}월`, `${s.grade}학년`].join(' '));
}
/** 이름에서 검색어와 겹치는 글자를 굵게(공백 무시) */
function highlight(name: string, terms: string[]): string {
  const mark = new Array(name.length).fill(false);
  const chars: { c: string; i: number }[] = [];
  for (let i = 0; i < name.length; i++) if (!/\s/.test(name[i])) chars.push({ c: name[i].toLowerCase(), i });
  const flat = chars.map((x) => x.c).join('');
  for (const t of terms) {
    let p = flat.indexOf(t);
    while (t && p >= 0) { for (let k = p; k < p + t.length; k++) mark[chars[k].i] = true; p = flat.indexOf(t, p + t.length); }
  }
  let out = ''; let open = false;
  for (let i = 0; i < name.length; i++) {
    if (mark[i] && !open) { out += '<b>'; open = true; }
    if (!mark[i] && open && !/\s/.test(name[i])) { out += '</b>'; open = false; }
    out += esc(name[i]);
  }
  return open ? out + '</b>' : out;
}

const ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`;
const LOCK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-label="고정"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;

/** 일정 검색(머리말 돋보기 → 검색 창). body·머리말에 직접 붙는다. */
export function mountSearch(store: Store): void {
  let allGrades = false;
  let active = 0;
  let results: Schedule[] = [];

  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn-ghost search-open';
  btn.dataset.testid = 'search-open';
  btn.setAttribute('aria-label', '일정 검색'); btn.title = '일정 검색 ( / )';
  btn.innerHTML = ICON;
  btn.addEventListener('click', () => open());

  const back = document.createElement('div');
  back.className = 'search-backdrop'; back.hidden = true;
  back.innerHTML = `
    <div class="search-modal glass" data-testid="search-modal" role="dialog" aria-modal="true" aria-label="일정 검색">
      <div class="search-bar">
        <span class="search-ico">${ICON}</span>
        <input class="search-input" data-testid="search-input" type="text" autocomplete="off" placeholder="일정 이름, 과목, 유형으로 찾아보세요" />
        <button type="button" class="pill search-grades" data-testid="search-all-grades" aria-pressed="false">전 학년</button>
        <button type="button" class="btn-ghost search-close" data-testid="search-close" aria-label="닫기">닫기</button>
      </div>
      <div class="search-head sub"></div>
      <ul class="search-list" role="listbox"></ul>
    </div>`;
  const modal = back.querySelector<HTMLElement>('.search-modal')!;
  const input = back.querySelector<HTMLInputElement>('.search-input')!;
  const gradesBtn = back.querySelector<HTMLButtonElement>('.search-grades')!;
  const list = back.querySelector<HTMLUListElement>('.search-list')!;
  const head = back.querySelector<HTMLElement>('.search-head')!;
  document.body.append(back);

  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  back.querySelector('.search-close')!.addEventListener('click', () => close());
  gradesBtn.addEventListener('click', () => { allGrades = !allGrades; gradesBtn.setAttribute('aria-pressed', String(allGrades)); active = 0; render(); input.focus(); });
  input.addEventListener('input', () => { active = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (results.length) { active = (active + 1) % results.length; paintActive(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (results.length) { active = (active - 1 + results.length) % results.length; paintActive(); } }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]); }
  });
  list.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const tl = t.closest<HTMLElement>('[data-tl]');
    if (tl) { const id = tl.dataset.tl!; close(); store.setView('timeline', id); return; }
    const li = t.closest<HTMLElement>('[data-id]');
    const s = li && results.find((x) => x.id === li.dataset.id);
    if (s) choose(s);
  });
  list.addEventListener('mousemove', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('[data-idx]');
    if (li && Number(li.dataset.idx) !== active) { active = Number(li.dataset.idx); paintActive(); }
  });

  document.addEventListener('keydown', (e) => {
    if (!store.getState().session) return;
    if (!back.hidden) { if (e.key === 'Escape') { e.preventDefault(); close(); } return; }
    const el = document.activeElement as HTMLElement | null;
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); open(); }
  });

  function open(): void {
    if (!store.getState().session) return;
    back.hidden = false; input.value = ''; active = 0; render();
    requestAnimationFrame(() => input.focus());
  }
  function close(): void { back.hidden = true; }

  function pool(): Schedule[] {
    const s = store.getState();
    return s.schedules.filter((x) => {
      if (x.type === 'personal') return s.role === 'student' && x.grade === s.grade;
      return allGrades || x.grade === s.grade;
    });
  }
  function sortKey(a: Schedule, b: Schedule): number {
    const t = SEMESTER.today;
    const pa = shown(a) >= t ? 0 : 1, pb = shown(b) >= t ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return pa === 0 ? shown(a).localeCompare(shown(b)) : shown(b).localeCompare(shown(a));
  }
  function render(): void {
    const q = input.value.trim();
    const terms = q.split(/\s+/).map(norm).filter(Boolean);
    if (!terms.length) {
      results = pool().filter((x) => shown(x) >= SEMESTER.today).sort(sortKey).slice(0, 5);
      head.textContent = '다가오는 일정';
    } else {
      results = pool().filter((x) => { const h = hay(x); return terms.every((t) => h.includes(t)); }).sort(sortKey).slice(0, 8);
      head.textContent = results.length ? `찾은 일정 ${results.length}개${results.length === 8 ? ' (가까운 8개)' : ''}` : '';
    }
    if (!results.length) {
      list.innerHTML = `<li class="search-empty" data-testid="search-empty">${terms.length ? '찾는 일정이 없어요. 다른 낱말로 찾아보세요.' : '다가오는 일정이 없어요.'}</li>`;
      return;
    }
    list.innerHTML = results.map((s, n) => {
      const wi = weekIndexOf(s.due);
      const wk = wi >= 0 ? store.getForecast(s.grade).weeks[wi] : undefined;
      const wx = wk ? `<img src="/weather/${wk.weather}.webp" width="20" height="20" alt="" /><span>${wi + 1}주 · ${WEATHER_LABEL[wk.weather]} <span class="num">R ${wk.R.toFixed(2)}</span></span>` : '';
      return `<li class="search-item" role="option" data-testid="search-result-${n}" data-id="${esc(s.id)}" data-idx="${n}">
        <div class="si-main">
          <div class="si-name">${s.fixed ? `<span class="si-lock" title="고정 일정">${LOCK}</span>` : ''}<span class="si-title">${highlight(s.name, terms)}</span>${s.status === 'reported' ? '<span class="badge si-rep">제보</span>' : ''}</div>
          <div class="si-meta sub"><span>${TYPE_LABEL[s.type]}</span><span>${s.grade}학년</span><span class="num">${fmtDate(shown(s))}</span><span class="si-wx${wk?.weather === 'storm' ? ' is-storm' : ''}">${wx}</span></div>
        </div>
        <button type="button" class="btn-ghost si-tl" data-tl="${esc(s.id)}">타임라인에서 보기</button>
      </li>`;
    }).join('');
    paintActive();
  }
  function paintActive(): void {
    list.querySelectorAll<HTMLElement>('[data-idx]').forEach((li) => {
      const on = Number(li.dataset.idx) === active;
      li.classList.toggle('is-active', on); li.setAttribute('aria-selected', String(on));
      if (on) li.scrollIntoView({ block: 'nearest' });
    });
  }
  function choose(s: Schedule): void {
    close();
    if (store.getState().grade !== s.grade) store.setGrade(s.grade);
    store.setView('home');
    const wi = weekIndexOf(s.due);
    if (wi >= 0) store.selectWeek(wi, true);
  }

  // 머리말에 끼워 넣기: search-open → about-open → complete-chip → open-register
  function place(): void {
    const logged = !!store.getState().session;
    const reg = document.querySelector<HTMLElement>('header [data-testid="open-register"]');
    if (!logged || !reg) { if (btn.isConnected) btn.remove(); if (!logged) close(); return; }
    const parent = reg.parentElement!;
    const anchor = ['about-open', 'complete-chip', 'open-register']
      .map((id) => parent.querySelector<HTMLElement>(`:scope > [data-testid="${id}"]`)).find(Boolean) ?? reg;
    if (btn.parentElement !== parent || btn.nextElementSibling !== anchor) parent.insertBefore(btn, anchor);
  }
  store.subscribe(() => place());
  new MutationObserver(() => place()).observe(document.body, { childList: true, subtree: true });
  place();
}
