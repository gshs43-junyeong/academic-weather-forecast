# CONTRACT — 모듈 경계와 화면 계약 (에이전트용)

기준은 SPEC.md. 사람 지시(PROGRESS.md "사람 개입 기록")가 SPEC보다 우선한다. 타입 계약은 `src/types.ts`, 계산 시그니처는 `src/calc/index.ts`.

## 파일 소유(자기 파일만 고친다. git 명령·package.json 수정·npm install 금지)
| 모듈 | 파일 |
|---|---|
| 계산 | src/calc/** (index.ts, *.test.ts) |
| 공지문 해석 | src/parser/**, src/data/samples.ts |
| 데모 데이터 | src/data/schedules.ts, src/data/schedules.test.ts |
| 저장소·로그인·머리말 | src/ui/store.ts, src/ui/login.ts, src/ui/shell.ts, src/ui/store.test.ts, src/styles/base.css |
| 홈·주 상세·달력 | src/ui/home.ts(+ src/ui/home-*.ts), src/styles/home.css |
| 타임라인 | src/ui/timeline.ts(+ src/ui/timeline-*.ts), src/styles/timeline.css |
| 등록 창 | src/ui/register.ts(+ src/ui/register-*.ts), src/styles/register.css |
src/types.ts, src/main.ts, src/styles/tokens.css, index.html은 고치지 않는다(꼭 필요하면 최종 보고에 적는다).

## 화면 구조
- 로그인 전: 로그인 카드만. 로그인 후: 머리말 + 보기 두 개(`home` = 기상 지도, `timeline` = 타임라인). shell이 `<section data-view="home">`, `<section data-view="timeline">`를 만들고 mountHome / mountTimeline을 한 번씩 호출한다. 현재 보기만 보인다.
- [일정 등록] 버튼(머리말) → `openRegister(store)`. 등록 창은 body에 붙는 모달.
- 프레임워크 없음. DOM API와 템플릿 문자열. 차트는 SVG 또는 div. 드래그는 포인터 이벤트.
- 날씨 아이콘: `/weather/{sunny|cloudy|rain|storm}.webp` (img). 배경 영상은 1차에서 쓰지 않는다(본문 배경은 base.css의 날씨별 그라데이션 + 가독성 막, body[data-weather]).
- 문구는 ui-tone 스킬(해요체, 짧게). 색·글꼴·간격은 src/styles/tokens.css 변수만 쓴다. 빨강은 폭풍 전용.
- 1280×720에서 홈(히어로 + 6×3 그리드 + 날씨 띠)이 가로 스크롤 없이 한 화면에 들어와야 한다.

## data-testid (inspector·자동화가 쓰는 이름 — 반드시 이 이름으로)
- 로그인: `login-card`, `login-id`(미리 입력), `login-pw`(type=password, 미리 입력), `login-role-student`, `login-role-teacher`, `login-submit`
- 머리말: `grade-1` `grade-2` `grade-3`, `role-student`, `role-teacher`(선택된 것에 aria-pressed="true"), `logout`, `open-register`, `view-home`, `view-timeline`
- 홈: `hero`(data-weather), `hero-r`, `hero-weather`, `hero-summary`, `week-card-{0..17}`(data-weather, data-r="1.79", 폭풍이면 class `is-storm`), `week-strip`, `home-mode-weeks`, `home-mode-calendar`, `calendar`, `cal-day-{YYYY-MM-DD}`(data-weather), `badge-{주 index}`("폭풍 → 비")
- 주 상세: `week-detail`, `detail-r`, `detail-w`, `day-bar-{0..6}`(data-load, data-weather), `contrib-bar`, `contrib-seg-{scheduleId}`(data-value), `contrib-sum`(기여 합, 소수 둘째 자리), `move-this`(교사만)
- 타임라인: `timeline`, `tl-week-{index}`(data-weather, data-r), `tl-badge-{index}`, `bar-{scheduleId}`(data-due, data-fixed="true|false", data-status), `undo`, `reset`, `top3`, `top3-item-{0..2}`(data-date, data-r), `top3-pin-{0..2}`, `weight-input`, `weight-save`, `weight-reset`
- 등록 창: `register-modal`, `notice-input`, `sample-{0..2}`, `parse-btn`, `notice-preview`(근거 밑줄은 `<mark class="ev" data-field="due">`), `field-name`, `field-type`, `field-difficulty`, `field-subject`, `field-due`, `field-grades`, `field-internal`, `field-fixed`, `field-weight`, 잘못된 칸은 class `is-invalid`, `field-hint-{name}`, `save-btn`, `save-hint`, `preview-weather`, `preview-warning`, `preview-top3`, `preview-top3-item-{0..2}`, `register-close`
- 자동화용 드래그 대체: `window.__awf = { store }` (shell이 노출) — store.move 로도 같은 결과가 나와야 한다.

## 날짜·주
- 18주: 2026-08-31(월) ~ 2027-01-03(일). 주 index 0 = 8/31~9/6, 13 = 11/30~12/6, 16 = 12/21~27. '오늘' = 2026-11-17 고정(SEMESTER.today).
- 일 단위 날씨 = 하루 부하 ÷ (W̄ ÷ 7), 기준 0.7/1.15/1.6. 폭풍 주 판정·배지·추천은 주 단위.
