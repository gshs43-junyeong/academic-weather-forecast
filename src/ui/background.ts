import type { Store, Weather, AppState } from '../types';

type Scene = 'main' | Weather;
const FADE_MS = 600;

function src(name: Scene) {
  return { webm: `/video/bg-${name}.webm`, mp4: `/video/bg-${name}.mp4`, poster: `/video/bg-${name}-poster.jpg` };
}

function makeVideo(): HTMLVideoElement {
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
  v.preload = 'none';
  v.className = 'bg-video';
  return v;
}

function setSources(v: HTMLVideoElement, name: Scene) {
  const s = src(name);
  v.dataset.name = name;
  v.poster = s.poster;
  v.innerHTML = '';
  const a = document.createElement('source'); a.src = s.webm; a.type = 'video/webm';
  const b = document.createElement('source'); b.src = s.mp4; b.type = 'video/mp4';
  v.append(a, b);
  v.load();
}

/** 배경 영상 층(SPEC 5-3). body 맨 앞에 직접 붙는다. */
export function mountBackground(store: Store): void {
  const layer = document.createElement('div');
  layer.dataset.testid = 'bg-layer';
  layer.className = 'bg-layer';
  layer.setAttribute('aria-hidden', 'true');
  const vids = [makeVideo(), makeVideo()];
  const pre = makeVideo(); // 다음 후보 미리 불러오기(최대 1개)
  pre.classList.add('bg-preload'); pre.autoplay = false;
  layer.append(vids[0], vids[1], pre);
  document.body.prepend(layer);

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const posterOnly = () => !!reduce?.matches || !!(navigator as any).connection?.saveData;
  let front = 0;
  let current: Scene | null = null;
  let fadeTimer = 0;

  const tryPlay = (v: HTMLVideoElement) => {
    if (posterOnly() || document.hidden || layer.dataset.fallback === 'true') return;
    const p = v.play(); if (p && typeof p.catch === 'function') p.catch(() => {});
  };
  const onFail = (ev: Event) => {
    const v = ev.currentTarget as HTMLVideoElement;
    if (v.dataset.name === current) { layer.dataset.fallback = 'true'; v.pause(); }
  };
  for (const v of vids) {
    v.addEventListener('error', onFail, true); // source 오류는 캡처로
    v.addEventListener('stalled', onFail);
  }

  function sceneOf(s: AppState): { scene: Scene; next: Scene | null } {
    const screen = document.body.dataset.screen;
    if (document.body.dataset.complete === 'true') return { scene: 'sunny', next: null };
    if (!s.session || screen === 'title' || screen === 'login') return { scene: 'main', next: s.session ? null : null };
    const weeks = store.getForecast().weeks;
    const i = Math.max(0, Math.min(weeks.length - 1, s.selectedWeek));
    const w = weeks[i]?.weather ?? 'sunny';
    let next: Scene | null = null;
    for (const j of [i + 1, i - 1]) {
      const nw = weeks[j]?.weather;
      if (nw && nw !== w) { next = nw; break; }
    }
    return { scene: w, next };
  }

  function apply() {
    const { scene, next } = sceneOf(store.getState());
    layer.dataset.poster = posterOnly() ? 'true' : 'false';
    if (scene !== current) {
      const prev = current;
      current = scene;
      if (scene === 'main') { layer.dataset.scene = 'main'; delete layer.dataset.weather; }
      else { layer.dataset.weather = scene; delete layer.dataset.scene; }
      layer.style.backgroundImage = `url(${src(scene).poster})`;
      layer.dataset.fallback = 'false';
      if (!posterOnly()) {
        const incoming = prev === null ? vids[front] : vids[1 - front];
        const outgoing = vids[front];
        if (incoming.dataset.name !== scene) { incoming.preload = 'auto'; setSources(incoming, scene); }
        incoming.preload = 'auto';
        tryPlay(incoming);
        incoming.classList.add('is-on');
        if (incoming !== outgoing) {
          outgoing.classList.remove('is-on');
          outgoing.preload = 'none';
          window.clearTimeout(fadeTimer);
          fadeTimer = window.setTimeout(() => { if (!outgoing.classList.contains('is-on')) outgoing.pause(); }, FADE_MS + 50);
          front = 1 - front;
        }
      }
    }
    if (!posterOnly() && next && pre.dataset.name !== next) { pre.preload = 'auto'; setSources(pre, next); }
  }

  store.subscribe(() => apply());
  new MutationObserver(() => apply()).observe(document.body, { attributes: true, attributeFilter: ['data-screen', 'data-complete'] });
  document.addEventListener('visibilitychange', () => {
    const v = vids[front];
    if (document.hidden) vids.forEach((x) => x.pause());
    else if (v.classList.contains('is-on')) tryPlay(v);
  });
  reduce?.addEventListener?.('change', () => {
    if (posterOnly()) vids.forEach((x) => { x.pause(); x.classList.remove('is-on'); });
    current = null; apply();
  });
  apply();
}
