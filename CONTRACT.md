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

## 2차 루프 추가 (사람 지시 반영 — PROGRESS.md "사람 개입 기록" 11~ 참고)
### 파일 소유 추가
| 모듈 | 파일 |
|---|---|
| 플래너(MVP 4) | src/ui/planner.ts(+ planner-*.ts), src/styles/planner.css |
| 학년 비교·리포트(MVP 5) | src/ui/report.ts(+ report-*.ts), src/styles/report.css |
| 체험 완료·배경 영상 | src/ui/complete.ts, src/ui/background.ts, src/styles/complete.css, src/styles/background.css |
main.ts가 mountBackground(store) → mountShell(root, store) → mountComplete(store) 순서로 부른다. shell은 `<section data-view="planner">`(mountPlanner), `<section data-view="report">`(mountReport)도 만든다.

### 화면 흐름
- 타이틀 화면(title-screen: "학업 기상청" + 한 줄 설명 + [시작하기] title-start) → 로그인 카드 → 앱. 로고(logo-home)를 누르면 나가기와 같이 로그인 화면으로(일정 상태 유지).
- **역할은 로그인으로만 정해진다.** 머리말의 role-student / role-teacher 전환 버튼은 없앤다(현재 역할 표시 `role-label`만). 아이디는 처음 로그인한 역할에 묶이고(브라우저 저장소), 같은 아이디로 다른 역할을 고르면 거부("이 아이디는 학생 계정이에요.", login-error).
- 보기 탭: view-home(기상 지도), view-timeline(타임라인), view-planner(플래너 — 학생만 보임), view-report(학년 비교·리포트 — 교사만 보임).
- 개인 과제(type 'personal')는 학년 예보(getForecast)에 들어가지 않고 개인 예보(getPersonalForecast)에만 들어간다. 교사 화면에는 보이지 않는다.

### data-testid 추가
- 타이틀·로그인: `title-screen`, `title-start`, `login-error`, `logo-home`, `role-label`, `view-planner`, `view-report`
- 플래너: `planner`, `pl-check-{scheduleId}`(체크박스), `pl-week-{0..17}`(개인 기상도 칸, data-weather, data-r), `pl-dday`("다음 폭풍까지 D-n"), `pl-alert`(14일 전 경보 배너), `pl-order`(시작 순서 제안, 항목 `pl-order-item-{n}`), `pl-task-name`, `pl-task-hours`, `pl-task-start`, `pl-task-due`, `pl-task-add`, `pl-task-hint`, `pl-task-{id}`(목록), `pl-task-remove-{id}`
- 타임라인(학생): 주 눈금은 개인 예보(tl-week-{i}의 data-r·data-weather가 getPersonalForecast 값), `tl-mode-label`("개인 기상도" / "학년 기상도"), 개인 과제 막대 `bar-{id}`(data-type="personal"), 제보 확정 버튼 `confirm-btn`(교사)
- 리포트: `report`, `cmp-chart`(세 학년 겹친 차트), `cmp-line-{1..3}`, `cmp-storm-count-{1..3}`(폭풍 주 수 숫자), `rp-card`(다음 4주 요약), `rp-week-{0..3}`(data-weather, data-r), `rp-copy`, `rp-print`, `rp-copied`
- 체험 완료: `complete-chip`(진행 n/3), `complete-open`, `complete-screen`, `complete-code`(4자리), `complete-close`
- 배경: `bg-layer`(data-weather 또는 data-scene="main"), 그 안의 `video`

### 2차 추가 기능(사람 지시: 검색, GitHub 오픈소스 링크 등 기본 기능)
| 모듈 | 파일 |
|---|---|
| 일정 검색 | src/ui/search.ts, src/styles/search.css |
| 도움말·정보 | src/ui/about.ts, src/styles/about.css |
- 머리말 끼워 넣기 순서(오른쪽 묶음, [일정 등록] 앞): `search-open`(돋보기, 36px 아이콘 버튼) → `about-open`(물음표, 36px 아이콘 버튼) → `complete-chip` → `open-register`. 각 모듈이 스스로 끼워 넣고 shell이 다시 그려도 유지한다.
- data-testid: `search-open`, `search-modal`, `search-input`, `search-result-{n}`(data-id), `search-empty`, `search-close` / `about-open`, `about-modal`, `about-github`(a[href]), `about-reset`, `about-close`, `title-footer`(타이틀·로그인 화면 아래 작은 줄), `title-github`
- 저장소: GitHub 주소 https://github.com/gshs43-junyeong/academic-weather-forecast
- Store.setFixed(id, fixed): 교사의 고정/가능 설정.
