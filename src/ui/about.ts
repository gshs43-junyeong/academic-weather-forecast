import type { Store, Weather } from '../types';
import { THRESHOLDS, WEATHER_LABEL } from '../calc/index';

/** 도움말·정보(계산 방식, 출처, GitHub 링크, 체험 초기화). body·머리말에 직접 붙는다. */
const GITHUB = 'https://github.com/gshs43-junyeong/academic-weather-forecast';

const ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.6-2.8 4.2"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/></svg>`;

const WEIGHTS: [string, string, string][] = [
  ['시험', '1학년 8 · 2·3학년 7 (과목 수에 비례)', '—'],
  ['연구 최종 발표', '6', '21일'],
  ['연구 중간 발표', '4.5', '7일'],
  ['탐구대회·올림피아드', '4', '14일'],
  ['수행평가·자율평가', '0.5 / 1.5 / 3', '2 / 5 / 10일'],
  ['일반 대회', '1', '5일'],
  ['교내 행사', '2', '7일'],
  ['동아리', '2', '7일'],
  ['입시 서류', '3', '14일'],
  ['면접', '5', '21일'],
];

const SOURCES = [
  'KAIST 2027학년도 학사과정 모집요강(일반전형): admission.kaist.ac.kr',
  '서울대 2027학년도 수시모집 안내(2026.5.): admission.snu.ac.kr',
  'POSTECH 2027학년도 모집요강: adm-u.postech.ac.kr',
  '한양대 2027학년도 수시 모집요강: go.hanyang.ac.kr',
  '성균관대 2027 수시 면접 일정 보도(베리타스알파, 2026.9.) — 전형별 확정 일정은 입학처 확인 필요',
];

function weatherRows(): string {
  const rows: [Weather, string][] = [
    ['sunny', `R ${THRESHOLDS.cloudy} 미만`],
    ['cloudy', `R ${THRESHOLDS.cloudy} ~ ${THRESHOLDS.rain}`],
    ['rain', `R ${THRESHOLDS.rain} ~ ${THRESHOLDS.storm}`],
    ['storm', `R ${THRESHOLDS.storm} 이상`],
  ];
  return rows.map(([w, t]) => `<li class="ab-w" data-weather="${w}"><img src="/weather/${w}.webp" alt="" width="32" height="32"><strong>${WEATHER_LABEL[w]}</strong><span class="sub num">${t}</span></li>`).join('');
}

function modalHtml(): string {
  return `
  <div class="ab-panel glass" role="dialog" aria-modal="true" aria-labelledby="ab-title" data-testid="about-modal">
    <div class="ab-head">
      <h2 id="ab-title">도움말</h2>
      <button type="button" class="btn-ghost ab-x" data-testid="about-close" aria-label="닫기">닫기</button>
    </div>
    <div class="ab-body">
      <section><h3>학업 기상청은요</h3>
        <p>학교 일정이 몰리는 주를 날씨로 알려 주는 학업 예보 서비스예요. 학생은 다가올 바쁜 주를 미리 보고, 선생님은 마감을 옮겨 폭풍을 줄일 수 있어요.</p></section>
      <section><h3>날씨는 이렇게 계산해요</h3>
        <ol class="ab-steps">
          <li>일정마다 무게 <b>w</b> × 참여율 <b>p</b>를 마감 전 <b>L</b>일에 삼각형 모양으로 나눠요. 마감에 가까울수록 무거워요.</li>
          <li>한 주에 쌓인 값을 모두 더해 주간 부하 <b>W</b>를 구해요.</li>
          <li>W를 학기 평균으로 나눈 값이 <b>R</b>이에요. R로 날씨를 정해요.</li>
        </ol>
        <ul class="ab-weathers">${weatherRows()}</ul>
        <p class="sub">달력의 날짜 칸은 하루 단위로, 폭풍 주 판정은 주 단위로 계산해요.</p></section>
      <section><h3>일정 무게표</h3>
        <table class="ab-table"><thead><tr><th>유형</th><th>기본 무게</th><th>준비 일수</th></tr></thead>
        <tbody>${WEIGHTS.map(([a, b, c]) => `<tr><td>${a}</td><td class="num">${b}</td><td class="num">${c}</td></tr>`).join('')}</tbody></table>
        <p class="sub">선생님은 일정마다 무게를 직접 고칠 수 있어요.</p></section>
      <section><h3>역할</h3>
        <ul class="ab-list">
          <li><b>학생</b> 기상 지도, 일정 제보, 플래너</li>
          <li><b>교사</b> 일정 확정, 마감 시뮬레이터, 무게·고정 설정, 학년 비교·리포트</li>
        </ul>
        <p class="sub">역할은 로그인할 때 정해져요.</p></section>
      <section><h3>데이터와 개인정보</h3>
        <ul class="ab-list">
          <li>데모 데이터예요. 2026학년도 2학기 학사일정, 2027학년도 대학 모집요강, 가정한 값을 써요.</li>
          <li>실제 이름이나 학번은 없어요.</li>
          <li>입력한 내용은 이 브라우저에만 저장돼요.</li>
          <li>공지문 해석은 브라우저 안에서만 해요.</li>
        </ul></section>
      <section><h3>출처</h3>
        <ul class="ab-list ab-src">${SOURCES.map((s) => `<li>${s}</li>`).join('')}<li>배경 영상 일부: Pexels</li></ul></section>
      <section><h3>오픈소스</h3>
        <p>코드는 GitHub에 공개돼 있어요. <a data-testid="about-github" href="${GITHUB}" target="_blank" rel="noopener noreferrer">GitHub에서 코드 보기</a></p></section>
      <section><h3>단축키</h3>
        <ul class="ab-list"><li><kbd>/</kbd> 일정 검색</li><li><kbd>Esc</kbd> 창 닫기</li></ul></section>
      <section><h3>체험 초기화</h3>
        <div class="ab-reset">
          <button type="button" class="btn-ghost ab-reset-btn" data-testid="about-reset">처음 상태로 되돌리기</button>
          <div class="ab-confirm" hidden>
            <p>옮긴 일정과 등록한 일정, 로그인 기록이 모두 지워져요. 되돌릴까요?</p>
            <div class="ab-confirm-btns">
              <button type="button" class="btn" data-testid="about-reset-confirm">되돌리기</button>
              <button type="button" class="btn-ghost" data-testid="about-reset-cancel">취소</button>
            </div>
          </div>
        </div></section>
    </div>
  </div>`;
}

function resetAll(): void {
  try {
    const ks: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('awf:')) ks.push(k); }
    ks.forEach((k) => localStorage.removeItem(k));
  } catch { /* 무시 */ }
  try {
    const ks: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k && k.startsWith('awf')) ks.push(k); }
    ks.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* 무시 */ }
  try { location.href = location.pathname; } catch { /* 무시 */ }
}

export function mountAbout(store: Store): void {
  let overlay: HTMLElement | null = null;
  let lastFocus: HTMLElement | null = null;

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.removeEventListener('keydown', onKey, true);
    lastFocus?.focus?.();
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && overlay) { e.preventDefault(); e.stopPropagation(); close(); }
  }
  function open() {
    if (overlay) return;
    lastFocus = document.activeElement as HTMLElement | null;
    overlay = document.createElement('div');
    overlay.className = 'ab-overlay';
    overlay.innerHTML = modalHtml();
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
    const q = <T extends HTMLElement>(id: string) => overlay!.querySelector<T>(`[data-testid="${id}"]`)!;
    q('about-close').addEventListener('click', close);
    const confirmBox = overlay.querySelector<HTMLElement>('.ab-confirm')!;
    q('about-reset').addEventListener('click', () => { confirmBox.hidden = false; q('about-reset-confirm').focus(); });
    q('about-reset-cancel').addEventListener('click', () => { confirmBox.hidden = true; q('about-reset').focus(); });
    q('about-reset-confirm').addEventListener('click', resetAll);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey, true);
    q('about-close').focus();
  }

  function makeHeaderBtn(): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ab-open';
    b.dataset.testid = 'about-open';
    b.setAttribute('aria-label', '도움말');
    b.title = '도움말';
    b.innerHTML = ICON;
    b.addEventListener('click', open);
    return b;
  }

  function ensureHeader() {
    const reg = document.querySelector<HTMLElement>('[data-testid="open-register"]');
    if (!reg || !reg.parentElement) return;
    const parent = reg.parentElement;
    let btn = parent.querySelector<HTMLButtonElement>(':scope > [data-testid="about-open"]');
    const search = parent.querySelector<HTMLElement>(':scope > [data-testid="search-open"]');
    const chip = parent.querySelector<HTMLElement>(':scope > [data-testid="complete-chip"]');
    if (!btn) btn = makeHeaderBtn();
    // 원하는 자리: search-open 바로 뒤, 없으면 complete-chip 앞, 없으면 open-register 앞
    if (search) { if (search.nextElementSibling !== btn) search.after(btn); }
    else if (chip) { if (chip.previousElementSibling !== btn) chip.before(btn); }
    else if (reg.previousElementSibling !== btn) reg.before(btn);
  }

  function ensureFooter() {
    const scr = document.body.dataset.screen;
    let f = document.querySelector<HTMLElement>('[data-testid="title-footer"]');
    if (scr === 'title' || scr === 'login') {
      if (!f) {
        f = document.createElement('div');
        f.className = 'ab-footer';
        f.dataset.testid = 'title-footer';
        f.innerHTML = `<a data-testid="title-github" href="${GITHUB}" target="_blank" rel="noopener noreferrer">오픈소스 · GitHub에서 코드 보기</a><span aria-hidden="true">·</span><button type="button" data-testid="title-about">도움말</button>`;
        f.querySelector('[data-testid="title-about"]')!.addEventListener('click', open);
        document.body.appendChild(f);
      }
    } else if (f) f.remove();
  }

  let pending = false;
  function sync() {
    if (pending) return;
    pending = true;
    queueMicrotask(() => { pending = false; ensureHeader(); ensureFooter(); });
  }
  store.subscribe(sync);
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-screen'] });
  sync();
}
