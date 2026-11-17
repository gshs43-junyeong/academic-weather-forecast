import type { Store, WeekForecast } from '../types';
import { WEATHER_LABEL } from '../calc/index';
import { suggestRelief } from '../calc/relief';

/** 주 상세: "이 주를 약하게 만드는 이동"(교사만, 비·폭풍 주) */
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function mdDow(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${m}/${day}(${DOW[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]})`;
}
/** "자기평가서 — 생명과학" → "생명과학 자기평가서" */
function displayName(n: string): string {
  const m = n.match(/^(.+?)\s+—\s+(.+)$/);
  return m ? `${m[2]} ${m[1]}` : n;
}
function josa(word: string): string {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return '을(를)';
  return (ch - 0xac00) % 28 ? '을' : '를';
}

export function reliefHtml(store: Store, wk: WeekForecast): string {
  if (!store.can('move')) return '';
  if (wk.weather !== 'rain' && wk.weather !== 'storm') return '';
  const st = store.getState();
  let list: ReturnType<typeof suggestRelief> = [];
  try { list = suggestRelief(st.schedules, st.grade, wk.index); } catch { list = []; }
  const body = list.length === 0
    ? `<div class="relief-empty sub" data-testid="relief-empty">옮길 수 있는 일정이 없어요. 학교가 정한 일정이 만든 날씨예요.</div>`
    : `<ul class="relief-list">${list.map((r, i) => {
        const nm = displayName(r.name);
        return `<li class="relief-item" data-testid="relief-item-${i}" data-id="${esc(r.scheduleId)}" data-to="${r.toDue}" data-after-r="${r.afterR.toFixed(2)}" data-weather="${r.afterWeather}">
          <span class="relief-dot"></span>
          <span class="relief-text"><b>${esc(nm)}</b>${josa(nm)} <span class="num">${mdDow(r.toDue)}</span>로 옮기면 <span class="num">R ${r.beforeR.toFixed(2)} → ${r.afterR.toFixed(2)}</span> · ${WEATHER_LABEL[r.afterWeather]}</span>
          <button type="button" class="btn relief-apply" data-testid="relief-apply-${i}" data-id="${esc(r.scheduleId)}" data-to="${r.toDue}">옮기기</button>
        </li>`;
      }).join('')}</ul>`;
  return `<section class="relief" data-testid="relief"><h3 class="detail-h">이 주를 약하게 만드는 이동</h3>${body}</section>`;
}
