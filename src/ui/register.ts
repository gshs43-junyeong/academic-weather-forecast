import type { Store, Schedule, ScheduleType, Difficulty, Grade, ParsedNotice, AddPreview, Recommendation, Weather } from '../types';
import { defaultsFor, previewAdd, recommendDates, addDays, weekIndexOf, weekRange, SEMESTER, TYPE_LABEL, WEATHER_LABEL } from '../calc/index';
import { parseNotice, MAX_NOTICE_LENGTH } from '../parser/index';
import { SAMPLE_NOTICES } from '../data/samples';

const TYPES: ScheduleType[] = ['exam', 'research_final', 'research_mid', 'contest', 'performance', 'general_contest', 'self_eval', 'school_event', 'club'];
const EVENT_MORNING: ScheduleType[] = ['exam', 'research_final', 'research_mid', 'admission_interview'];
const DIFF_TYPES: ScheduleType[] = ['performance', 'self_eval'];
const DIFF_LABEL: Record<Difficulty, string> = { easy: '쉬움', medium: '중간', hard: '어려움' };
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

// ── 날짜 도우미(표시용, 시간대 무관) ──
const toN = (d: string): number => { const [y, m, dd] = d.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, dd) / 86400000); };
const fromN = (n: number): string => new Date(n * 86400000).toISOString().slice(0, 10);
const plusDays = (d: string, n: number): string => { try { return addDays(d, n); } catch { return fromN(toN(d) + n); } };
const md = (d: string): string => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const mdDow = (d: string): string => `${md(d)}(${DOW[new Date(toN(d) * 86400000).getUTCDay()]})`;
const weekIdx = (d: string): number => { try { return weekIndexOf(d); } catch { return Math.floor((toN(d) - toN(SEMESTER.start)) / 7); } };
const weekLabel = (i: number): string => { const s = fromN(toN(SEMESTER.start) + i * 7); const e = fromN(toN(s) + 6); return `${i + 1}주(${md(s)}~${Number(e.slice(8, 10))})`; };
const inSemester = (d: string): boolean => d >= SEMESTER.start && d <= SEMESTER.end;
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const icon = (w: Weather): string => `<img class="rg-ic" src="/weather/${w}.webp" alt="" width="20" height="20">`;
const r2 = (n: number): string => n.toFixed(2);

const FIELD_LABEL: Record<string, string> = { name: '일정명', type: '유형', due: '마감일', grades: '대상 학년', difficulty: '난이도', subject: '과목', internal: '교내/교외' };
const josa = (w: string, a: string, b: string): string => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c % 28 !== 0 ? a : b; };

/** 근거 표시: 겹치는 구간은 먼저 온 것 우선으로 잘라 낸다. */
export function renderEvidence(text: string, parsed: ParsedNotice | null): string {
  if (!parsed) return esc(text);
  const fields = ['due', 'type', 'name', 'grades', 'difficulty', 'internal', 'p', 'fixed', 'subject'] as const;
  const segs: { s: number; e: number; f: string }[] = [];
  for (const f of fields) for (const ev of (parsed[f]?.evidence ?? [])) {
    const s = Math.max(0, Math.min(text.length, ev.start)); const e = Math.max(s, Math.min(text.length, ev.end));
    if (e > s) segs.push({ s, e, f });
  }
  segs.sort((a, b) => a.s - b.s || b.e - a.e);
  let out = ''; let pos = 0;
  for (const g of segs) {
    const s = Math.max(g.s, pos); if (s >= g.e) continue;
    out += esc(text.slice(pos, s)) + `<mark class="ev" data-field="${g.f}">${esc(text.slice(s, g.e))}</mark>`;
    pos = g.e;
  }
  return out + esc(text.slice(pos));
}

export function openRegister(store: Store, preset?: Partial<Schedule>): void {
  document.querySelector('[data-testid="register-modal"]')?.closest('.rg-overlay')?.remove();
  const st0 = store.getState();
  const teacher = store.can('editWeight');
  const overlay = document.createElement('div');
  overlay.className = 'rg-overlay';
  overlay.innerHTML = `
  <div class="rg-modal glass" role="dialog" aria-modal="true" aria-labelledby="rg-title" data-testid="register-modal">
    <header class="rg-head">
      <h2 id="rg-title">일정 등록</h2>
      <span class="sub">${teacher ? '교사 · 확정 일정으로 등록해요' : '학생 · 제보로 등록해요'}</span>
      <button type="button" class="btn btn-ghost rg-close" data-testid="register-close" aria-label="닫기">닫기</button>
    </header>
    <div class="rg-body">
      <section class="rg-left">
        <label class="rg-label" for="rg-notice">공지문</label>
        <textarea id="rg-notice" class="rg-notice" data-testid="notice-input" maxlength="${MAX_NOTICE_LENGTH}" placeholder="학교 공지문을 붙여 넣어 주세요."></textarea>
        <div class="rg-row">
          <span class="sub num rg-count">0 / ${MAX_NOTICE_LENGTH.toLocaleString()}자</span>
        </div>
        <div class="rg-samples">
          <span class="sub">샘플</span>
          ${[0, 1, 2].map((i) => `<button type="button" class="pill rg-sample" data-testid="sample-${i}">${esc(SAMPLE_NOTICES[i]?.title ?? `샘플 ${i + 1}`)}</button>`).join('')}
        </div>
        <div class="rg-row">
          <button type="button" class="btn" data-testid="parse-btn">해석</button>
          <span class="sub rg-parse-msg" aria-live="polite"></span>
        </div>
        <div class="rg-preview-text" data-testid="notice-preview" aria-label="근거 표시"></div>
      </section>
      <section class="rg-right">
        <form class="rg-form" novalidate>
          <div class="rg-f rg-wide"><label for="rg-name">일정명</label>
            <input id="rg-name" data-testid="field-name" type="text" maxlength="60">
            <p class="rg-hint" data-testid="field-hint-name"></p></div>
          <div class="rg-f"><label for="rg-type">유형</label>
            <select id="rg-type" data-testid="field-type"><option value="">선택</option>${TYPES.map((t) => `<option value="${t}">${TYPE_LABEL[t]}</option>`).join('')}</select>
            <p class="rg-hint" data-testid="field-hint-type"></p></div>
          <div class="rg-f"><label for="rg-diff">난이도</label>
            <select id="rg-diff" data-testid="field-difficulty">${(Object.keys(DIFF_LABEL) as Difficulty[]).map((d) => `<option value="${d}"${d === 'medium' ? ' selected' : ''}>${DIFF_LABEL[d]}</option>`).join('')}</select>
            <p class="rg-hint" data-testid="field-hint-difficulty"></p></div>
          <div class="rg-f"><label for="rg-subject">과목</label>
            <input id="rg-subject" data-testid="field-subject" type="text" maxlength="20" placeholder="시험일 때만">
            <p class="rg-hint" data-testid="field-hint-subject"></p></div>
          <div class="rg-f"><label for="rg-due">마감일</label>
            <input id="rg-due" data-testid="field-due" type="date" min="${SEMESTER.start}" max="${SEMESTER.end}">
            <p class="rg-hint" data-testid="field-hint-due"></p></div>
          <div class="rg-f"><span class="rg-flabel">대상 학년</span>
            <div class="rg-checks" data-testid="field-grades">${[1, 2, 3].map((g) => `<label><input type="checkbox" value="${g}"${g === st0.grade ? ' checked' : ''}> ${g}학년</label>`).join('')}</div>
            <p class="rg-hint" data-testid="field-hint-grades"></p></div>
          <div class="rg-f"><label for="rg-internal">교내/교외</label>
            <select id="rg-internal" data-testid="field-internal"><option value="true">교내</option><option value="false">교외</option></select>
            <p class="rg-hint" data-testid="field-hint-internal"></p></div>
          <div class="rg-f"><span class="rg-flabel">고정 여부</span>
            <label class="rg-checks"><input type="checkbox" data-testid="field-fixed"> 학교가 정한 고정 일정</label>
            <p class="rg-hint" data-testid="field-hint-fixed"></p></div>
          <div class="rg-f"><label for="rg-weight">무게</label>
            <input id="rg-weight" class="num" data-testid="field-weight" type="number" min="0.1" max="10" step="0.1"${teacher ? '' : ' readonly'}>
            <p class="rg-hint" data-testid="field-hint-weight">${teacher ? '' : '무게는 선생님만 바꿀 수 있어요.'}</p></div>
          <div class="rg-f"><span class="rg-flabel">준비 일수 · 참여율</span>
            <p class="rg-ro num" data-testid="field-ro">-</p></div>
        </form>
        <div class="rg-pv">
          <h3>미리보기</h3>
          <div data-testid="preview-weather" class="rg-pv-weeks"><p class="sub">마감일·유형·학년을 정하면 날씨 변화를 보여 드려요.</p></div>
          <div data-testid="preview-warning" class="rg-warn" hidden></div>
          <div data-testid="preview-top3" class="rg-top3" hidden></div>
        </div>
        <footer class="rg-foot">
          <p class="sub rg-save-hint" data-testid="save-hint"></p>
          <button type="button" class="btn" data-testid="save-btn" disabled>${teacher ? '등록' : '제보'}</button>
        </footer>
      </section>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const $ = <T extends HTMLElement>(id: string): T => overlay.querySelector(`[data-testid="${id}"]`) as T;
  const notice = $<HTMLTextAreaElement>('notice-input');
  const count = overlay.querySelector('.rg-count') as HTMLElement;
  const parseMsg = overlay.querySelector('.rg-parse-msg') as HTMLElement;
  const noticePreview = $('notice-preview');
  const fName = $<HTMLInputElement>('field-name');
  const fType = $<HTMLSelectElement>('field-type');
  const fDiff = $<HTMLSelectElement>('field-difficulty');
  const fSubj = $<HTMLInputElement>('field-subject');
  const fDue = $<HTMLInputElement>('field-due');
  const fGrades = $('field-grades');
  const fInt = $<HTMLSelectElement>('field-internal');
  const fFixed = $<HTMLInputElement>('field-fixed');
  const fW = $<HTMLInputElement>('field-weight');
  const ro = $('field-ro');
  const saveBtn = $<HTMLButtonElement>('save-btn');
  const saveHint = $('save-hint');
  const pvWeeks = $('preview-weather');
  const pvWarn = $('preview-warning');
  const pvTop = $('preview-top3');
  let missHints: Record<string, string> = {};
  let parsedP: number | null = null;

  const grades = (): Grade[] => Array.from(fGrades.querySelectorAll<HTMLInputElement>('input:checked')).map((i) => Number(i.value) as Grade);
  const curGrade = (): Grade | null => { const g = grades(); return g.length ? (g.includes(store.getState().grade) ? store.getState().grade : g[0]) : null; };
  const type = (): ScheduleType | null => (fType.value ? (fType.value as ScheduleType) : null);
  const diff = (): Difficulty | undefined => (type() && DIFF_TYPES.includes(type()!) ? (fDiff.value as Difficulty) : undefined);
  const subj = (): string | undefined => (type() === 'exam' && fSubj.value.trim() ? fSubj.value.trim() : undefined);
  const defs = () => { const t = type(); if (!t) return null; try { return defaultsFor(t, { difficulty: diff(), internal: fInt.value === 'true', grade: curGrade() ?? undefined, subject: subj() }); } catch { return null; } };

  const close = (): void => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $('register-close').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

  const updateCount = (): void => { count.textContent = `${notice.value.length.toLocaleString()} / ${MAX_NOTICE_LENGTH.toLocaleString()}자`; };
  notice.addEventListener('input', updateCount);

  /** 유형·난이도·교내외가 바뀌면 기본값(무게·고정)을 다시 채운다. */
  const applyDefaults = (): void => {
    const t = type();
    fDiff.disabled = !(t && DIFF_TYPES.includes(t));
    fSubj.disabled = t !== 'exam';
    const d = defs();
    if (d) { fW.value = String(Math.round(d.w * 10) / 10); fFixed.checked = d.fixed; }
  };

  const fieldsWithIssue = new Set<string>();
  const setHint = (name: string, msg: string, invalid: boolean): void => {
    const h = overlay.querySelector(`[data-testid="field-hint-${name}"]`) as HTMLElement | null;
    if (h) h.textContent = msg;
    const el = overlay.querySelector(`[data-testid="field-${name}"]`) as HTMLElement | null;
    el?.classList.toggle('is-invalid', invalid);
    if (invalid) fieldsWithIssue.add(name);
  };

  const validate = (): void => {
    fieldsWithIssue.clear();
    const missing: string[] = []; const wrong: string[] = [];
    const base = (n: string): string => missHints[n] ?? '';
    // 일정명
    if (!fName.value.trim()) { missing.push('name'); setHint('name', base('name'), false); } else setHint('name', '', false);
    // 유형
    if (!type()) { missing.push('type'); setHint('type', base('type') || '목록에서 유형을 골라 주세요.', true); } else setHint('type', '', false);
    // 마감일
    if (!fDue.value) { missing.push('due'); setHint('due', base('due'), false); }
    else if (!inSemester(fDue.value)) { wrong.push('due'); setHint('due', '학기 안의 날짜를 골라 주세요.', true); }
    else setHint('due', '', false);
    // 학년
    if (!grades().length) { missing.push('grades'); setHint('grades', '학년을 하나 이상 골라 주세요.', true); } else setHint('grades', '', false);
    // 무게
    const w = Number(fW.value);
    if (fW.value === '') { missing.push('weight'); setHint('weight', teacher ? '' : '무게는 선생님만 바꿀 수 있어요.', false); }
    else if (!(w >= 0.1 && w <= 10)) { wrong.push('weight'); setHint('weight', '무게는 0.1~10 사이로 넣어 주세요.', true); }
    else setHint('weight', teacher ? '' : '무게는 선생님만 바꿀 수 있어요.', false);
    for (const n of ['difficulty', 'subject', 'internal']) setHint(n, base(n), false);

    const d = defs(); const p = parsedP ?? d?.p;
    ro.textContent = d ? `${d.L}일 · ${Math.round((p ?? 1) * 100)}%` : '-';

    const label: Record<string, string> = { ...FIELD_LABEL, weight: '무게' };
    if (missing.length) {
      const l = label[missing[0]];
      saveHint.textContent = `${l}${josa(l, '을', '를')} 입력해야 저장할 수 있어요.`;
    } else if (wrong.length) {
      const l = label[wrong[0]];
      saveHint.textContent = `${l}${josa(l, '을', '를')} 고쳐야 저장할 수 있어요.`;
    } else saveHint.textContent = teacher ? '확정 일정으로 등록해요.' : '제보로 등록해요. 선생님이 확정해요.';
    saveBtn.disabled = missing.length > 0 || wrong.length > 0;
    saveHint.classList.toggle('is-ready', !saveBtn.disabled);
    updatePreview();
  };

  const buildDraft = (grade: Grade, idSuffix: string): Schedule | null => {
    const t = type(); const date = fDue.value; const d = defs();
    if (!t || !date || !inSemester(date)) return null;
    const dd = d ?? { w: 1, L: 7, p: 1, fixed: false, optional: false };
    const w = Number(fW.value) >= 0.1 && Number(fW.value) <= 10 ? Number(fW.value) : dd.w;
    const morning = EVENT_MORNING.includes(t);
    const s: Schedule = {
      id: `u-${idSuffix}-${grade}`, type: t, grade, name: fName.value.trim() || TYPE_LABEL[t],
      due: morning ? plusDays(date, -1) : date,
      w, defaultW: dd.w, L: dd.L, p: parsedP ?? dd.p, optional: dd.optional,
      fixed: fFixed.checked, internal: fInt.value === 'true',
      status: 'confirmed', source: 'user',
    };
    if (morning) s.eventDate = date;
    const df = diff(); if (df) s.difficulty = df;
    const sb = subj(); if (sb) s.subject = sb;
    return s;
  };

  const updatePreview = (): void => {
    const g = curGrade();
    const draft = g ? buildDraft(g, 'draft') : null;
    pvWarn.hidden = true; pvTop.hidden = true; pvWarn.innerHTML = ''; pvTop.innerHTML = '';
    if (!draft) { pvWeeks.innerHTML = `<p class="sub">마감일·유형·학년을 정하면 날씨 변화를 보여 드려요.</p>`; return; }
    const schedules = store.getState().schedules;
    let pv: AddPreview;
    try { pv = previewAdd(schedules, draft); } catch { pvWeeks.innerHTML = `<p class="sub">예보 계산을 준비하고 있어요.</p>`; return; }
    pvWeeks.innerHTML = `<p class="sub">${g}학년 기준</p>` + pv.weeks.map((wk) => `
      <div class="rg-pv-week" data-weather="${wk.weather}" data-week="${wk.index}">
        <span class="rg-pv-wk">${weekLabel(wk.index)}</span>
        <span class="rg-pv-chg">${icon(wk.beforeWeather)}${WEATHER_LABEL[wk.beforeWeather]} → ${icon(wk.weather)}<b>${WEATHER_LABEL[wk.weather]}</b></span>
        <span class="num">R ${r2(wk.R)}</span>
      </div>`).join('');
    if (!pv.storm) return;
    const stormWeeks = pv.weeks.filter((w) => w.weather === 'storm');
    const top = stormWeeks.reduce((a, b) => (b.R > a.R ? b : a), stormWeeks[0] ?? { R: pv.maxR, index: weekIdx(draft.due) });
    pvWarn.hidden = false;
    pvWarn.innerHTML = `${icon('storm')}<span>${weekLabel(top.index)} 이 주가 폭풍이 돼요(R ${r2(top.R)})</span>`;
    let recs: Recommendation[] = [];
    try { recs = recommendDates(schedules, draft).slice(0, 3); } catch { recs = []; }
    pvTop.hidden = false;
    if (!recs.length) { pvTop.innerHTML = `<p class="sub">옮기기 좋은 맑은 날을 찾지 못했어요.</p>`; return; }
    const morning = EVENT_MORNING.includes(draft.type);
    const allStorm = recs.every((r) => r.weather === 'storm');
    pvTop.innerHTML = `<p class="rg-top-title">맑은 주 TOP 3</p><p class="sub">준비 기간이 걸치는 주의 R이 가장 낮은 순서예요.</p>`
      + (allStorm ? `<p class="sub" data-testid="preview-top3-note">전후 3주가 모두 폭풍이에요. 그중 가장 약한 주부터 보여 드려요.</p>` : '')
      + recs.map((r, i) => {
      // 추천 date는 due 기준 → 입력 칸 날짜(행사일)로 환산
      const inputDate = morning ? plusDays(r.date, 1) : r.date;
      const wi = weekIdx(inputDate);
      let wk: string;
      try { const rg = weekRange(wi); wk = `${wi + 1}주(${md(rg.start)}~${md(rg.end)})`; } catch { wk = weekLabel(wi); }
      return `<div class="rg-top-item" data-testid="preview-top3-item-${i}" data-date="${inputDate}" data-r="${r2(r.maxR)}" data-weather="${r.weather}">
        ${icon(r.weather)}<span>${wk} · ${mdDow(inputDate)} 마감 · 예상 R <span class="num">${r2(r.maxR)}</span> · ${WEATHER_LABEL[r.weather]}</span>
        <button type="button" class="btn btn-ghost rg-use" data-date="${inputDate}">이 날짜로</button></div>`;
    }).join('');
  };
  pvTop.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('.rg-use') as HTMLElement | null;
    if (!b) return;
    fDue.value = b.dataset.date!; validate();
  });

  // ── 해석 ──
  const doParse = (): void => {
    const text = notice.value;
    if (!text.trim()) { parseMsg.textContent = '공지문을 붙여 넣어 주세요.'; noticePreview.innerHTML = ''; return; }
    const t0 = performance.now();
    let parsed: ParsedNotice | null = null;
    try { parsed = parseNotice(text); } catch { parsed = null; }
    const ms = performance.now() - t0;
    noticePreview.dataset.elapsed = ms.toFixed(1);
    if (!parsed) { parseMsg.textContent = '해석하지 못했어요. 칸을 직접 입력해 주세요.'; noticePreview.innerHTML = esc(text); return; }
    noticePreview.innerHTML = renderEvidence(text, parsed);
    parseMsg.textContent = `해석했어요. 밑줄 친 부분이 근거예요. (${Math.round(ms)}ms)`;
    missHints = {};
    const miss = (n: string): void => { const l = FIELD_LABEL[n]; missHints[n] = `${l}${josa(l, '을', '를')} 찾지 못했어요. 직접 입력해 주세요.`; };
    fName.value = parsed.name.value ?? ''; if (!parsed.name.value) miss('name');
    const pt = parsed.type.value;
    fType.value = pt && TYPES.includes(pt) ? pt : ''; if (!fType.value) miss('type');
    if (parsed.difficulty.value) fDiff.value = parsed.difficulty.value;
    fSubj.value = parsed.subject.value ?? '';
    if (pt === 'exam' && !parsed.subject.value) miss('subject');
    fDue.value = parsed.due.value ?? ''; if (!parsed.due.value) miss('due');
    const gs = parsed.grades.value;
    fGrades.querySelectorAll<HTMLInputElement>('input').forEach((i) => { if (gs && gs.length) i.checked = gs.includes(Number(i.value) as Grade); });
    if (!gs || !gs.length) miss('grades');
    if (parsed.internal.value !== null) fInt.value = String(parsed.internal.value);
    parsedP = parsed.p.value;
    applyDefaults();
    if (parsed.fixed.value !== null) fFixed.checked = parsed.fixed.value;
    validate();
  };
  $('parse-btn').addEventListener('click', doParse);
  overlay.querySelectorAll<HTMLButtonElement>('.rg-sample').forEach((b, i) => b.addEventListener('click', () => {
    const s = SAMPLE_NOTICES[i]; if (!s) return;
    notice.value = s.text.slice(0, MAX_NOTICE_LENGTH); updateCount(); notice.focus();
  }));

  // ── 값이 바뀔 때마다 다시 검사 ──
  for (const el of [fType, fDiff, fInt]) el.addEventListener('change', () => { applyDefaults(); validate(); });
  fSubj.addEventListener('input', () => { applyDefaults(); validate(); });
  for (const el of [fName, fDue, fW]) el.addEventListener('input', validate);
  for (const el of [fDue, fFixed]) el.addEventListener('change', validate);
  fGrades.addEventListener('change', () => { applyDefaults(); validate(); });

  // ── 저장 ──
  saveBtn.addEventListener('click', () => {
    if (saveBtn.disabled) return;
    const stamp = String(Date.now());
    const list = grades().map((g) => buildDraft(g, stamp)).filter((s): s is Schedule => !!s);
    if (!list.length) return;
    const role = store.getState().role;
    store.addSchedules(list);
    close();
    try { store.selectWeek(weekIdx(list[0].due)); } catch { /* 저장소 준비 전 */ }
    toast(role === 'teacher' ? '확정 일정으로 등록했어요.' : '제보했어요. 선생님이 확정하면 실선으로 바뀌어요.');
  });

  // ── preset ──
  if (preset) {
    if (preset.name) fName.value = preset.name;
    if (preset.type && TYPES.includes(preset.type)) fType.value = preset.type;
    if (preset.difficulty) fDiff.value = preset.difficulty;
    if (preset.subject) fSubj.value = preset.subject;
    const d = preset.eventDate ?? preset.due; if (d) fDue.value = d;
    if (preset.grade) fGrades.querySelectorAll<HTMLInputElement>('input').forEach((i) => { i.checked = Number(i.value) === preset.grade; });
    if (preset.internal !== undefined) fInt.value = String(preset.internal);
    if (preset.p !== undefined) parsedP = preset.p;
  }
  applyDefaults();
  if (preset?.fixed !== undefined) fFixed.checked = preset.fixed;
  if (preset?.w !== undefined) fW.value = String(preset.w);
  validate();
  notice.focus();
}

function toast(msg: string): void {
  const t = document.createElement('div');
  t.className = 'rg-toast glass'; t.setAttribute('role', 'status'); t.dataset.testid = 'register-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('is-out'), 2600);
  setTimeout(() => t.remove(), 3000);
}
