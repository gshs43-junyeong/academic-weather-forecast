import type { Grade, GradeForecast, Store, WeekForecast } from '../types';
import { SEMESTER, THRESHOLDS, WEATHER_LABEL, weekIndexOf } from '../calc/index';

/** 학년 비교·주간 리포트(MVP 5, 교사) */
const GRADES: Grade[] = [1, 2, 3];
const DASH: Record<Grade, string> = { 1: '', 2: '8 5', 3: '2 4' };
const STROKE: Record<Grade, string> = { 1: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const f2 = (n: number) => n.toFixed(2);

function chartSvg(fcs: GradeForecast[], todayIdx: number): string {
  const W = 600, H = 280, L = 40, R = 64, T = 16, B = 40;
  const pw = W - L - R, ph = H - T - B;
  const maxR = Math.max(2, ...fcs.flatMap((f) => f.weeks.map((w) => w.R)));
  const yMax = Math.ceil(maxR * 2) / 2;
  const x = (i: number) => L + (i + 0.5) * (pw / 18);
  const y = (r: number) => T + ph - (Math.min(r, yMax) / yMax) * ph;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="세 학년 기상도 비교" data-testid="cmp-chart" class="cmp-svg">`;
  s += `<rect x="${L}" y="${T}" width="${pw}" height="${y(THRESHOLDS.storm) - T}" fill="var(--w-storm-soft)"/>`;
  const bands: [number, string][] = [[THRESHOLDS.cloudy, '구름'], [THRESHOLDS.rain, '비'], [THRESHOLDS.storm, '폭풍']];
  for (const [v, lab] of bands) {
    s += `<line x1="${L}" x2="${L + pw}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line-ink)" stroke-width="1"/>`;
    s += `<text x="${L + 4}" y="${y(v) - 4}" class="cmp-band">${lab} ${v}</text>`;
  }
  for (let v = 0; v <= yMax + 1e-9; v += 0.5) s += `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="cmp-tick">${v.toFixed(1)}</text>`;
  let lastMonth = '';
  fcs[0].weeks.forEach((w, i) => {
    s += `<text x="${x(i)}" y="${T + ph + 16}" text-anchor="middle" class="cmp-tick">${i + 1}</text>`;
    const m = Number(w.end.slice(5, 7));
    if (String(m) !== lastMonth) { lastMonth = String(m); s += `<text x="${x(i)}" y="${T + ph + 32}" text-anchor="middle" class="cmp-month">${m}월</text>`; }
  });
  if (todayIdx >= 0) {
    s += `<line x1="${x(todayIdx)}" x2="${x(todayIdx)}" y1="${T}" y2="${T + ph}" stroke="var(--ink)" stroke-width="1.5"/>`;
    s += `<text x="${x(todayIdx) + 4}" y="${T + 12}" class="cmp-today">오늘</text>`;
  }
  const ends: { g: Grade; yy: number }[] = [];
  for (const f of fcs) {
    const pts = f.weeks.map((w, i) => `${x(i)},${y(w.R)}`).join(' ');
    s += `<polyline data-testid="cmp-line-${f.grade}" points="${pts}" fill="none" stroke="${STROKE[f.grade]}" stroke-width="2.5" stroke-dasharray="${DASH[f.grade]}" stroke-linejoin="round"/>`;
    f.weeks.forEach((w, i) => { if (w.weather === 'storm') s += `<circle cx="${x(i)}" cy="${y(w.R)}" r="4" fill="var(--w-storm)"><title>${f.grade}학년 ${i + 1}주 R ${f2(w.R)} 폭풍</title></circle>`; });
    ends.push({ g: f.grade, yy: y(f.weeks[17].R) });
  }
  ends.sort((a, b) => a.yy - b.yy);
  for (let i = 1; i < ends.length; i++) if (ends[i].yy - ends[i - 1].yy < 14) ends[i].yy = ends[i - 1].yy + 14;
  for (const e of ends) s += `<text x="${x(17) + 8}" y="${e.yy + 4}" class="cmp-end" fill="${STROKE[e.g]}">${e.g}학년</text>`;
  return s + '</svg>';
}

function strips(fcs: GradeForecast[], todayIdx: number, sel: Grade): string {
  return fcs.map((f) => `<div class="cmp-strip${f.grade === sel ? ' is-sel' : ''}"><span class="cmp-strip-label">${f.grade}학년</span><div class="cmp-cells">${
    f.weeks.map((w, i) => `<span class="cmp-cell${i === todayIdx ? ' is-today' : ''}" data-weather="${w.weather}" title="${f.grade}학년 ${i + 1}주 R ${f2(w.R)} ${WEATHER_LABEL[w.weather]}"></span>`).join('')
  }</div></div>`).join('');
}

function reportText(g: Grade, weeks: WeekForecast[], title: string, summary: string): string {
  const lines = [title, summary, ''];
  for (const w of weeks) {
    lines.push(`${w.index + 1}주 (${md(w.start)}~${md(w.end)}) ${WEATHER_LABEL[w.weather]} · R ${f2(w.R)}`);
    const top = w.contributions.slice(0, 3);
    if (!top.length) lines.push('  - 큰 일정 없음');
    for (const c of top) lines.push(`  - ${c.name} · ${f2(c.value)}${c.fixed ? ' · 고정' : ''}`);
  }
  void g;
  return lines.join('\n');
}

function summaryOf(weeks: WeekForecast[]): string {
  const n = (k: string) => weeks.filter((w) => w.weather === k).length;
  const parts: string[] = [];
  if (n('storm')) parts.push(`폭풍 ${n('storm')}주`);
  if (n('rain')) parts.push(`비 ${n('rain')}주`);
  if (!parts.length) return `${weeks.length}주 모두 폭풍·비 없이 지나갈 것 같아요.`;
  return `${weeks.length}주 중 ${parts.join(', ')}예요.`;
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* 대체 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}

export function mountReport(root: HTMLElement, store: Store): void {
  const el = document.createElement('div');
  el.className = 'report';
  el.dataset.testid = 'report';
  root.appendChild(el);
  let copiedMsg = '';

  const render = () => {
    const st = store.getState();
    const role = st.session?.role ?? st.role;
    if (role !== 'teacher') { el.innerHTML = `<div class="glass rp-empty">리포트는 선생님 화면이에요.</div>`; return; }
    const sel = st.grade;
    const fcs = GRADES.map((g) => store.getForecast(g));
    const todayIdx = weekIndexOf(SEMESTER.today);
    const start = Math.max(0, Math.min(todayIdx < 0 ? 0 : todayIdx, 14));
    const weeks = fcs[sel - 1].weeks.slice(start, start + 4);
    const title = `${sel}학년 주간 예보 · ${md(weeks[0].start)}~${md(weeks[weeks.length - 1].end)}`;
    const summary = summaryOf(weeks);
    const text = reportText(sel, weeks, title, summary);

    const counts = fcs.map((f) => `<div class="cmp-count${f.grade === sel ? ' is-sel' : ''}"><span>${f.grade}학년 폭풍</span> <b class="num" data-testid="cmp-storm-count-${f.grade}">${f.weeks.filter((w) => w.weather === 'storm').length}</b><span>주</span></div>`).join('');

    const weekRows = weeks.map((w, i) => {
      const top = w.contributions.slice(0, 3);
      return `<li class="rp-week" data-testid="rp-week-${i}" data-weather="${w.weather}" data-r="${f2(w.R)}">
        <div class="rp-week-head">
          <img src="/weather/${w.weather}.webp" width="32" height="32" alt="">
          <div class="rp-week-when"><b>${w.index + 1}주</b> <span class="sub num">${md(w.start)}~${md(w.end)}</span></div>
          <div class="rp-week-wx"><b>${WEATHER_LABEL[w.weather]}</b> <span class="num">R ${f2(w.R)}</span></div>
        </div>
        <ol class="rp-causes">${top.length ? top.map((c) => `<li><span class="rp-cname">${esc(c.name)}</span><span class="num">${f2(c.value)}</span>${c.fixed ? '<span class="rp-fixed">고정</span>' : ''}</li>`).join('') : '<li class="sub">큰 일정이 없어요.</li>'}</ol>
      </li>`;
    }).join('');

    el.innerHTML = `
      <section class="glass report-cmp">
        <h2 class="rp-h">학년 비교</h2>
        <p class="sub">세 학년 기상도를 같은 시간축에 겹쳤어요. 빨간 점이 폭풍 주예요.</p>
        <div class="cmp-legend sub">
          ${GRADES.map((g) => `<span><svg width="32" height="8"><line x1="0" x2="32" y1="4" y2="4" stroke="${STROKE[g]}" stroke-width="2.5" stroke-dasharray="${DASH[g]}"/></svg>${g}학년</span>`).join('')}
        </div>
        ${chartSvg(fcs, todayIdx)}
        <div class="cmp-strips">${strips(fcs, todayIdx, sel)}</div>
        <div class="cmp-counts">${counts}</div>
      </section>
      <section class="glass rp-card" data-testid="rp-card">
        <div class="rp-top">
          <div><h2 class="rp-h rp-title">${title}</h2><p class="rp-summary">${summary}</p></div>
          <div class="rp-actions">
            <button type="button" class="btn-ghost" data-testid="rp-copy">복사</button>
            <button type="button" class="btn-ghost" data-testid="rp-print">인쇄</button>
          </div>
        </div>
        <p class="sub rp-copied" data-testid="rp-copied" aria-live="polite">${copiedMsg}</p>
        <ol class="rp-weeks">${weekRows}</ol>
      </section>`;
    const card = el.querySelector<HTMLElement>('.rp-card')!;
    card.dataset.text = text;
    el.querySelector<HTMLButtonElement>('[data-testid="rp-copy"]')!.addEventListener('click', async () => {
      const ok = await copyText(text);
      copiedMsg = ok ? '리포트를 복사했어요.' : '복사하지 못했어요. 글자를 직접 골라 복사해 주세요.';
      const c = el.querySelector<HTMLElement>('[data-testid="rp-copied"]'); if (c) c.textContent = copiedMsg;
    });
    el.querySelector<HTMLButtonElement>('[data-testid="rp-print"]')!.addEventListener('click', () => window.print());
  };
  let lastGrade = store.getState().grade;
  store.subscribe((s) => { if (s.grade !== lastGrade) { lastGrade = s.grade; copiedMsg = ''; } render(); });
  render();
}
