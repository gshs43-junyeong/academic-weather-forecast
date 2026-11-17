import type { Store, Role, Grade } from '../types';

const DEFAULT_ID: Record<Role, string> = { student: 'student01', teacher: 'teacher01' };

const ROLE_LABEL: Record<Role, string> = { student: '학생', teacher: '교사' };

/** 타이틀 화면. [시작하기]를 누르면 onStart. */
export function mountTitle(root: HTMLElement, onStart: () => void): void {
  const wrap = document.createElement('div');
  wrap.className = 'title-screen';
  wrap.dataset.testid = 'title-screen';
  wrap.innerHTML = `
    <div class="title-inner">
      <h1 class="title-main">학업 기상청</h1>
      <p class="title-en">Forecast Loop</p>
      <p class="title-lead">마감이 몰리는 주를 날씨로 미리 알려 주는 학업 예보예요.</p>
      <button type="button" class="btn title-start" data-testid="title-start">시작하기</button>
    </div>`;
  root.appendChild(wrap);
  wrap.querySelector('[data-testid="title-start"]')!.addEventListener('click', onStart);
}

/** 로그인 카드. 서버 없음 — 아이디는 처음 로그인한 역할에 묶인다(store.tryLogin). 비밀번호는 검증하지 않는다. */
export function mountLogin(root: HTMLElement, store: Store, onBack?: () => void): void {
  let role: Role = store.getState().role;
  let grade: Grade = 1;
  const wrap = document.createElement('div');
  wrap.className = 'login-wrap';
  wrap.innerHTML = `
    <form class="glass login-card" data-testid="login-card" novalidate>
      <h1 class="login-title">학업 기상청</h1>
      <p class="sub login-lead">우리 학교의 학업 날씨를 미리 봐요.</p>
      <div class="login-roles" role="group" aria-label="역할">
        <button type="button" class="pill" data-testid="login-role-student" data-role="student">학생</button>
        <button type="button" class="pill" data-testid="login-role-teacher" data-role="teacher">교사</button>
      </div>
      <label class="login-field"><span class="sub">아이디</span>
        <input type="text" name="id" data-testid="login-id" autocomplete="off" spellcheck="false" />
      </label>
      <label class="login-field"><span class="sub">비밀번호</span>
        <input type="password" name="pw" data-testid="login-pw" autocomplete="off" value="******" />
      </label>
      <div class="login-field"><span class="sub">학년</span>
        <div class="login-grades" role="group" aria-label="학년">
          ${[1, 2, 3].map((g) => `<button type="button" class="pill" data-grade="${g}">${g}학년</button>`).join('')}
        </div>
      </div>
      <p class="login-error" data-testid="login-error" role="alert" hidden></p>
      <button type="submit" class="btn login-submit" data-testid="login-submit">로그인</button>
      <p class="sub login-hint">체험용 계정이 미리 입력돼 있어요. 바로 로그인해 보세요.</p>
      <button type="button" class="link-btn login-back" data-testid="login-back">처음으로</button>
    </form>`;
  root.appendChild(wrap);

  const form = wrap.querySelector('form')!;
  const idInput = wrap.querySelector<HTMLInputElement>('[data-testid="login-id"]')!;
  const err = wrap.querySelector<HTMLElement>('.login-error')!;
  idInput.value = DEFAULT_ID[role];

  const paint = () => {
    wrap.querySelectorAll<HTMLButtonElement>('[data-role]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === role)));
    wrap.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.grade) === grade)));
  };
  paint();

  wrap.querySelectorAll<HTMLButtonElement>('[data-role]').forEach((b) =>
    b.addEventListener('click', () => {
      const next = b.dataset.role as Role;
      if (next === role) return;
      if (idInput.value.trim() === '' || idInput.value === DEFAULT_ID[role]) idInput.value = DEFAULT_ID[next];
      role = next;
      err.hidden = true;
      idInput.classList.remove('is-invalid');
      paint();
    }),
  );
  wrap.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach((b) =>
    b.addEventListener('click', () => { grade = Number(b.dataset.grade) as Grade; paint(); }),
  );
  idInput.addEventListener('input', () => { err.hidden = true; idInput.classList.remove('is-invalid'); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const userId = idInput.value.trim();
    if (!userId) {
      err.textContent = '아이디를 입력해 주세요.';
      err.hidden = false;
      idInput.classList.add('is-invalid');
      idInput.focus();
      return;
    }
    const res = store.tryLogin({ role, grade, userId });
    if (!res.ok) {
      const b = ROLE_LABEL[res.boundRole];
      err.textContent = `이 아이디는 ${b} 계정이에요. ${b === '교사' ? '교사로' : '학생으로'} 로그인해 주세요.`;
      err.hidden = false;
      idInput.classList.add('is-invalid');
      idInput.focus();
    }
  });
  wrap.querySelector('[data-testid="login-back"]')!.addEventListener('click', () => onBack?.());
}
