import type { Store, AppState, Grade, Role, Weather } from '../types';
import { mountLogin } from './login';
import { mountHome } from './home';
import { mountTimeline } from './timeline';
import { openRegister } from './register';

/** 머리말(로고·학년·역할·나가기·일정 등록·보기 전환)과 화면 컨테이너. 로그인 전에는 로그인 카드만 보인다. */
export function mountShell(root: HTMLElement, store: Store): void {
  (window as any).__awf = { store };
  let mode: 'login' | 'app' | null = null;
  let app: { header: HTMLElement; views: Record<string, HTMLElement>; userEl: HTMLElement } | null = null;

  const weatherNow = (s: AppState): Weather | null => {
    try { return store.getForecast(s.grade).weeks[s.selectedWeek]?.weather ?? null; } catch { return null; }
  };

  const loginBox = document.createElement('div');
  loginBox.className = 'login-root';
  const appBox = document.createElement('div');
  appBox.className = 'app-root';
  root.innerHTML = '';
  root.append(loginBox, appBox);

  function buildApp() {
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
      <div class="hdr-left">
        <div class="logo"><strong>학업 기상청</strong><span class="sub">Forecast Loop</span></div>
        <nav class="hdr-views" aria-label="보기">
          <button type="button" class="pill" data-testid="view-home" data-view-btn="home">기상 지도</button>
          <button type="button" class="pill" data-testid="view-timeline" data-view-btn="timeline">타임라인</button>
        </nav>
      </div>
      <div class="hdr-right">
        <div class="hdr-group" role="group" aria-label="학년">
          ${[1, 2, 3].map((g) => `<button type="button" class="pill" data-testid="grade-${g}" data-grade="${g}">${g}학년</button>`).join('')}
        </div>
        <div class="hdr-group" role="group" aria-label="역할">
          <button type="button" class="pill" data-testid="role-student" data-role="student">학생</button>
          <button type="button" class="pill" data-testid="role-teacher" data-role="teacher">교사</button>
        </div>
        <button type="button" class="btn" data-testid="open-register">일정 등록</button>
        <span class="sub hdr-user"></span>
        <button type="button" class="btn-ghost" data-testid="logout">나가기</button>
      </div>`;
    const main = document.createElement('main');
    main.className = 'app-main';
    const home = document.createElement('section');
    home.dataset.view = 'home';
    const timeline = document.createElement('section');
    timeline.dataset.view = 'timeline';
    main.append(home, timeline);
    appBox.append(header, main);

    header.querySelectorAll<HTMLButtonElement>('[data-view-btn]').forEach((b) =>
      b.addEventListener('click', () => store.setView(b.dataset.viewBtn as 'home' | 'timeline')));
    header.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach((b) =>
      b.addEventListener('click', () => store.setGrade(Number(b.dataset.grade) as Grade)));
    header.querySelectorAll<HTMLButtonElement>('[data-role]').forEach((b) =>
      b.addEventListener('click', () => store.setRole(b.dataset.role as Role)));
    header.querySelector('[data-testid="open-register"]')!.addEventListener('click', () => openRegister(store));
    header.querySelector('[data-testid="logout"]')!.addEventListener('click', () => store.logout());

    app = { header, views: { home, timeline }, userEl: header.querySelector('.hdr-user')! };
    try { mountHome(home, store); } catch (e) { console.error(e); }
    try { mountTimeline(timeline, store); } catch (e) { console.error(e); }
  }

  const last: Partial<Record<string, unknown>> = {};
  function changed(key: string, v: unknown) {
    if (last[key] === v) return false;
    last[key] = v;
    return true;
  }

  function render(s: AppState) {
    const want = s.session ? 'app' : 'login';
    if (want !== mode) {
      mode = want;
      loginBox.hidden = want !== 'login';
      appBox.hidden = want !== 'app';
      if (want === 'login') {
        loginBox.innerHTML = '';
        mountLogin(loginBox, store);
      } else if (!app) buildApp();
    }
    document.body.dataset.role = s.role;
    const w = s.session ? weatherNow(s) : null;
    if (w) document.body.dataset.weather = w;
    else delete document.body.dataset.weather;
    if (!app || mode !== 'app') return;
    if (changed('view', s.view)) {
      for (const [k, el] of Object.entries(app.views)) el.hidden = k !== s.view;
      app.header.querySelectorAll<HTMLElement>('[data-view-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.viewBtn === s.view)));
    }
    if (changed('grade', s.grade))
      app.header.querySelectorAll<HTMLElement>('[data-grade]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.grade) === s.grade)));
    if (changed('role', s.role))
      app.header.querySelectorAll<HTMLElement>('[data-role]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === s.role)));
    const uid = s.session?.userId ?? '';
    if (changed('user', uid)) app.userEl.textContent = uid;
  }

  store.subscribe(render);
  render(store.getState());
}
