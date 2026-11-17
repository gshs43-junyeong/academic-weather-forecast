import type { Store, AppState, Grade, Weather, ViewName } from '../types';
import { mountLogin, mountTitle } from './login';
import { mountPlanner } from './planner';
import { mountReport } from './report';
import { mountHome } from './home';
import { mountTimeline } from './timeline';
import { openRegister } from './register';

/** 머리말(로고·학년·역할·나가기·일정 등록·보기 전환)과 화면 컨테이너. 로그인 전에는 로그인 카드만 보인다. */
export function mountShell(root: HTMLElement, store: Store): void {
  (window as any).__awf = { store };
  let mode: 'title' | 'login' | 'app' | null = null;
  let started = false;
  let app: { header: HTMLElement; views: Record<string, HTMLElement>; userEl: HTMLElement } | null = null;

  const weatherNow = (s: AppState): Weather | null => {
    try { return store.getForecast(s.grade).weeks[s.selectedWeek]?.weather ?? null; } catch { return null; }
  };

  const titleBox = document.createElement('div');
  titleBox.className = 'title-root';
  const loginBox = document.createElement('div');
  loginBox.className = 'login-root';
  const appBox = document.createElement('div');
  appBox.className = 'app-root';
  root.innerHTML = '';
  root.append(titleBox, loginBox, appBox);

  function buildApp() {
    const header = document.createElement('header');
    header.className = 'app-header';
    header.innerHTML = `
      <div class="hdr-left">
        <button type="button" class="logo" data-testid="logo-home" title="로그인 화면으로"><strong>학업 기상청</strong><span class="sub">Forecast Loop</span></button>
        <nav class="hdr-views" aria-label="보기">
          <button type="button" class="pill" data-testid="view-home" data-view-btn="home">기상 지도</button>
          <button type="button" class="pill" data-testid="view-timeline" data-view-btn="timeline">타임라인</button>
          <button type="button" class="pill" data-testid="view-planner" data-view-btn="planner">플래너</button>
          <button type="button" class="pill" data-testid="view-report" data-view-btn="report">학년 비교·리포트</button>
        </nav>
      </div>
      <div class="hdr-right">
        <div class="hdr-group" role="group" aria-label="학년">
          ${[1, 2, 3].map((g) => `<button type="button" class="pill" data-testid="grade-${g}" data-grade="${g}">${g}학년</button>`).join('')}
        </div>
        <button type="button" class="btn" data-testid="open-register">일정 등록</button>
        <span class="hdr-who"><span class="role-label" data-testid="role-label"></span><span class="sub hdr-user"></span></span>
        <button type="button" class="btn-ghost" data-testid="logout">나가기</button>
      </div>`;
    const main = document.createElement('main');
    main.className = 'app-main';
    const home = document.createElement('section');
    home.dataset.view = 'home';
    const timeline = document.createElement('section');
    timeline.dataset.view = 'timeline';
    const planner = document.createElement('section');
    planner.dataset.view = 'planner';
    const report = document.createElement('section');
    report.dataset.view = 'report';
    main.append(home, timeline, planner, report);
    appBox.append(header, main);

    header.querySelectorAll<HTMLButtonElement>('[data-view-btn]').forEach((b) =>
      b.addEventListener('click', () => store.setView(b.dataset.viewBtn as ViewName)));
    header.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach((b) =>
      b.addEventListener('click', () => store.setGrade(Number(b.dataset.grade) as Grade)));
    header.querySelector('[data-testid="open-register"]')!.addEventListener('click', () => openRegister(store));
    header.querySelector('[data-testid="logout"]')!.addEventListener('click', () => { started = true; store.logout(); });
    header.querySelector('[data-testid="logo-home"]')!.addEventListener('click', () => { started = true; store.logout(); });

    app = { header, views: { home, timeline, planner, report }, userEl: header.querySelector('.hdr-user')! };
    try { mountHome(home, store); } catch (e) { console.error(e); }
    try { mountTimeline(timeline, store); } catch (e) { console.error(e); }
    try { mountPlanner(planner, store); } catch (e) { console.error(e); }
    try { mountReport(report, store); } catch (e) { console.error(e); }
  }

  const last: Partial<Record<string, unknown>> = {};
  function changed(key: string, v: unknown) {
    if (last[key] === v) return false;
    last[key] = v;
    return true;
  }

  function render(s: AppState) {
    if (s.session) started = true;
    const want = s.session ? 'app' : started ? 'login' : 'title';
    if (want !== mode) {
      mode = want;
      titleBox.hidden = want !== 'title';
      loginBox.hidden = want !== 'login';
      appBox.hidden = want !== 'app';
      if (want === 'title') {
        titleBox.innerHTML = '';
        mountTitle(titleBox, () => { started = true; render(store.getState()); });
      } else if (want === 'login') {
        loginBox.innerHTML = '';
        mountLogin(loginBox, store, () => { started = false; render(store.getState()); });
      } else if (!app) buildApp();
    }
    document.body.dataset.screen = want;
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
    if (changed('role', s.role)) {
      const lbl = app.header.querySelector<HTMLElement>('[data-testid="role-label"]')!;
      lbl.textContent = s.role === 'teacher' ? '교사' : '학생';
      lbl.dataset.role = s.role;
      app.header.querySelector<HTMLElement>('[data-testid="view-planner"]')!.hidden = s.role !== 'student';
      app.header.querySelector<HTMLElement>('[data-testid="view-report"]')!.hidden = s.role !== 'teacher';
    }
    const uid = s.session?.userId ?? '';
    if (changed('user', uid)) app.userEl.textContent = uid;
  }

  store.subscribe(render);
  render(store.getState());
}
