import { describe, expect, it, vi, afterEach } from 'vitest';
import { parseNotice, findDates } from './index';
import { SAMPLE_NOTICES } from '../data/samples';
import type { ParsedNotice } from '../types';

const slice = (text: string, r: ParsedNotice, key: keyof Omit<ParsedNotice, 'dueOutOfSemester'>) =>
  r[key].evidence.map((e) => text.slice(e.start, e.end));

describe('MVP3-④ 샘플 3개 정답 일치', () => {
  it('샘플은 3개, 순서대로 올림피아드·창의연구 최종·실험 수행평가', () => {
    expect(SAMPLE_NOTICES.map((s) => s.expected.type)).toEqual(['contest', 'research_final', 'performance']);
  });
  for (const s of SAMPLE_NOTICES) {
    it(`${s.title}: 모든 칸이 정답과 같다`, () => {
      const r = parseNotice(s.text);
      expect({
        name: r.name.value, type: r.type.value, difficulty: r.difficulty.value, subject: r.subject.value,
        due: r.due.value, grades: r.grades.value, p: r.p.value, internal: r.internal.value, fixed: r.fixed.value,
      }).toEqual(s.expected);
      expect(r.dueOutOfSemester).toBe(false);
    });
    it(`${s.title}: 날짜는 학기 안, 오늘 이후, 평일이고 날짜가 2개 이상`, () => {
      const d = s.expected.due;
      expect(d >= '2026-11-17' && d <= '2027-01-03').toBe(true);
      const day = new Date(d + 'T00:00:00Z').getUTCDay();
      expect(day).toBeGreaterThan(0);
      expect(day).toBeLessThan(6);
      expect(findDates(s.text).length).toBeGreaterThanOrEqual(2);
      expect(s.text.split('\n').length).toBeGreaterThanOrEqual(4);
    });
    it(`${s.title}: 근거 위치가 원문의 근거 문자열을 가리킨다`, () => {
      const r = parseNotice(s.text);
      for (const key of ['name', 'type', 'due', 'grades', 'internal'] as const) {
        expect(r[key].evidence.length).toBeGreaterThan(0);
        for (const e of r[key].evidence) {
          expect(e.start).toBeGreaterThanOrEqual(0);
          expect(e.end).toBeLessThanOrEqual(s.text.length);
          expect(e.end).toBeGreaterThan(e.start);
        }
      }
      expect(slice(s.text, r, 'name')[0]).toBe(s.expected.name);
      expect(findDates(slice(s.text, r, 'due')[0])[0].date).toBe(s.expected.due);
    });
  }
  it('근거 문자열 내용', () => {
    const [a, b, c] = SAMPLE_NOTICES;
    const ra = parseNotice(a.text), rb = parseNotice(b.text), rc = parseNotice(c.text);
    expect(slice(a.text, ra, 'type')).toEqual(['올림피아드']);
    expect(slice(a.text, ra, 'due')).toEqual(['12월 11일']);
    expect(slice(a.text, ra, 'grades')).toEqual(['1·2학년']);
    expect(slice(a.text, ra, 'p')).toEqual(['희망자']);
    expect(slice(a.text, ra, 'internal')).toEqual(['전국']);
    expect(slice(b.text, rb, 'due')).toEqual(['12/14']);
    expect(slice(b.text, rb, 'p')).toEqual(['전원']);
    expect(slice(b.text, rb, 'internal')).toEqual(['본교']);
    expect(slice(c.text, rc, 'due')).toEqual(['12. 9.']);
    expect(['실험', '탐구']).toContain(slice(c.text, rc, 'difficulty')[0]);
  });
});

describe('날짜', () => {
  it('4형식 + 요일 무시', () => {
    for (const s of ['12월 11일', '12/11', '12.11', '12. 11.', '12월 11일(금)', '12/11(금)', '12. 11.(금)']) {
      const r = parseNotice(`대회일: ${s}`);
      expect(r.due.value, s).toBe('2026-12-11');
    }
  });
  it('연도 없으면 학기 연도(1월은 2027), 명시 연도는 그대로', () => {
    expect(parseNotice('마감: 1월 2일').due.value).toBe('2027-01-02');
    expect(parseNotice('마감: 9월 2일').due.value).toBe('2026-09-02');
    expect(parseNotice('일시: 2026. 12. 16.(수) 13:30').due.value).toBe('2026-12-16');
    expect(parseNotice('일시: 2026년 12월 3일').due.value).toBe('2026-12-03');
  });
  it('없는 날짜·시각은 날짜가 아니다', () => {
    expect(findDates('2월 30일 14:00 13.40 오후')).toEqual([]);
  });
});

describe('마감 우선순위', () => {
  it('마감·제출·접수 마감·까지 > 일시 계열', () => {
    expect(parseNotice('일시: 12월 16일\n자료 제출: 12월 14일').due.value).toBe('2026-12-14');
    expect(parseNotice('대회일: 12월 16일\n접수 마감: 12월 1일').due.value).toBe('2026-12-01');
    expect(parseNotice('발표일: 12월 16일\n보고서는 12월 2일까지').due.value).toBe('2026-12-02');
    expect(parseNotice('발표일: 12월 16일\n원서 마감 12.3').due.value).toBe('2026-12-03');
  });
  it('일시·일자·대회일·발표일 > 기간의 마지막 날', () => {
    expect(parseNotice('기간: 11월 18일 ~ 11월 27일\n대회일: 12월 11일').due.value).toBe('2026-12-11');
    expect(parseNotice('기간: 11월 18일 ~ 11월 27일\n일자: 11월 20일').due.value).toBe('2026-11-20');
    expect(parseNotice('발표일 12/7, 신청 11/20').due.value).toBe('2026-12-07');
  });
  it('기간("~")만 있으면 마지막 날', () => {
    expect(parseNotice('행사 기간 11월 30일(월) ~ 12월 4일(금)').due.value).toBe('2026-12-04');
    expect(parseNotice('행사 기간 12. 1. ~ 12. 3.').due.value).toBe('2026-12-03');
  });
  it('날짜가 없으면 null', () => {
    const r = parseNotice('동아리 발표 안내');
    expect(r.due).toEqual({ value: null, evidence: [] });
    expect(r.dueOutOfSemester).toBe(false);
  });
  it('학기 밖 날짜는 dueOutOfSemester', () => {
    expect(parseNotice('마감: 2027년 3월 5일').dueOutOfSemester).toBe(true);
    expect(parseNotice('마감: 8월 20일').dueOutOfSemester).toBe(true);
    expect(parseNotice('마감: 8월 31일').dueOutOfSemester).toBe(false);
    expect(parseNotice('마감: 2027. 1. 3.').dueOutOfSemester).toBe(false);
  });
});

describe('유형', () => {
  const ty = (s: string) => parseNotice(s).type.value;
  it('키워드 사전', () => {
    expect(ty('2학기 기말고사 일정')).toBe('exam');
    expect(ty('지필평가 안내')).toBe('exam');
    expect(ty('R&E 최종 보고서 제출')).toBe('research_final');
    expect(ty('창의연구 중간 발표')).toBe('research_mid');
    expect(ty('창의연구 발표회')).toBe('research_final');
    expect(ty('R&E 안내')).toBe('research_final');
    expect(ty('수학 경시대회')).toBe('contest');
    expect(ty('과학 탐구대회')).toBe('contest');
    expect(ty('국어 수행평가')).toBe('performance');
    expect(ty('UCC 공모전')).toBe('general_contest');
    expect(ty('포스터 그리기')).toBe('general_contest');
    expect(ty('자기평가서 작성')).toBe('self_eval');
    expect(ty('자평 안내')).toBe('self_eval');
    expect(ty('체육대회 준비')).toBe('school_event');
    expect(ty('축제 부스')).toBe('school_event');
    expect(ty('동아리 발표')).toBe('club');
    expect(ty('물리 시험 범위')).toBe('exam');
  });
  it('여러 개면 순위가 높은 유형', () => {
    expect(ty('기말고사 이후 창의연구 발표회')).toBe('exam');
    expect(ty('R&E 팀 올림피아드 참가')).toBe('research_final');
    expect(ty('올림피아드 대비 수행평가')).toBe('contest');
    expect(ty('수행평가로 포스터 제작')).toBe('performance');
    expect(ty('공모전 자기평가서')).toBe('general_contest');
    expect(ty('자기평가서 축제')).toBe('self_eval');
    expect(ty('축제 동아리 부스')).toBe('school_event');
  });
  it('못 찾으면 null(다른 유형 의존 칸도 null)', () => {
    const r = parseNotice('가정통신문 회신 바랍니다');
    expect(r.type).toEqual({ value: null, evidence: [] });
    expect(r.p.value).toBeNull();
    expect(r.fixed.value).toBeNull();
    expect(r.difficulty.value).toBeNull();
    expect(r.grades).toEqual({ value: null, evidence: [] });
    expect(r.internal).toEqual({ value: null, evidence: [] });
  });
  it('시험이면 과목을 채우고 난이도는 null', () => {
    const r = parseNotice('기말고사 미적분 시험 12월 10일');
    expect(r.type.value).toBe('exam');
    expect(r.subject.value).toBe('미적분');
    expect(r.difficulty.value).toBeNull();
    expect(r.fixed.value).toBe(true);
    expect(r.p.value).toBe(1);
    expect(parseNotice('기말고사 생명과학').subject.value).toBe('생명과학');
  });
  it('시험이 아니면 과목은 null', () => {
    expect(parseNotice('화학 수행평가').subject.value).toBeNull();
  });
});

describe('난이도', () => {
  const df = (s: string) => parseNotice(s).difficulty.value;
  it('수행평가', () => {
    expect(df('실험 보고서 제출 수행평가')).toBe('hard');
    expect(df('수행평가 발표')).toBe('hard');
    expect(df('수행평가 수업 시간 중 작성')).toBe('easy');
    expect(df('수행평가 수업 시간 내 해결')).toBe('easy');
    expect(df('수행평가 독서 감상문')).toBe('medium');
  });
  it('자기평가서', () => {
    expect(df('자기평가서와 보고서')).toBe('hard');
    expect(df('한 학기 활동을 간단히 자기평가서')).toBe('easy');
    expect(df('자평 몇 줄')).toBe('easy');
    expect(df('자기평가서 활동 나열')).toBe('easy');
    expect(df('자기평가서 작성')).toBe('medium');
  });
  it('그 외 유형은 null', () => {
    expect(df('동아리 발표')).toBeNull();
  });
});

describe('학년', () => {
  const gr = (s: string) => parseNotice(s).grades.value;
  it('표현들', () => {
    expect(gr('대상: 1학년')).toEqual([1]);
    expect(gr('대상: 1·2학년')).toEqual([1, 2]);
    expect(gr('대상: 1, 2학년')).toEqual([1, 2]);
    expect(gr('대상: 2,3학년')).toEqual([2, 3]);
    expect(gr('대상: 전 학년')).toEqual([1, 2, 3]);
    expect(gr('대상: 전교생')).toEqual([1, 2, 3]);
    expect(gr('2027학년도 안내')).toBeNull();
    expect(gr('안내')).toBeNull();
  });
});

describe('참여율·교내/교외·고정', () => {
  it('희망자·신청자·선발 → 유형 기본 비율', () => {
    expect(parseNotice('올림피아드 신청자').p.value).toBe(0.2);
    expect(parseNotice('교내 경시대회 선발').p.value).toBe(0.2);
    expect(parseNotice('동아리 희망자').p.value).toBe(0.5);
  });
  it('전원·전 학년·필수 → 1.0', () => {
    expect(parseNotice('올림피아드 전원 참가').p.value).toBe(1);
    expect(parseNotice('동아리 필수').p.value).toBe(1);
    expect(parseNotice('축제 전 학년').p.value).toBe(1);
  });
  it('둘 다 없으면 유형 기본값', () => {
    expect(parseNotice('체육대회 준비').p.value).toBe(0.4);
    expect(parseNotice('수행평가').p.value).toBe(1);
  });
  it('교내/교외', () => {
    expect(parseNotice('교내 경시대회').internal.value).toBe(true);
    expect(parseNotice('본교 강당').internal.value).toBe(true);
    expect(parseNotice('시·도 경시대회').internal.value).toBe(false);
    expect(parseNotice('전국 대회').internal.value).toBe(false);
    expect(parseNotice('대한민국 공모전').internal.value).toBe(false);
    expect(parseNotice('경시대회\n주최: 한국수학재단').internal.value).toBe(false);
    expect(parseNotice('경시대회\n주최: 우리 고등학교').internal.value).toBeNull();
    expect(parseNotice('경시대회').internal.value).toBeNull();
  });
  it('고정 여부는 2-2 표', () => {
    expect(parseNotice('교내 경시대회').fixed.value).toBe(false);
    expect(parseNotice('전국 경시대회').fixed.value).toBe(true);
    expect(parseNotice('교내 공모전').fixed.value).toBe(false);
    expect(parseNotice('전국 공모전').fixed.value).toBe(true);
    expect(parseNotice('창의연구 중간 발표').fixed.value).toBe(false);
    expect(parseNotice('창의연구 최종 발표회').fixed.value).toBe(true);
    expect(parseNotice('축제').fixed.value).toBe(true);
    expect(parseNotice('동아리').fixed.value).toBe(false);
  });
});

describe('일정명', () => {
  it('「 」·< > 안의 제목이 첫 줄보다 먼저', () => {
    expect(parseNotice('[안내] 공지\n「겨울 축제」 준비').name.value).toBe('겨울 축제');
    expect(parseNotice('알림\n<국어 수행평가> 안내').name.value).toBe('국어 수행평가');
  });
  it('첫 줄에서 머리표·기호 제거', () => {
    const text = '\n  [공지] ■ 2학기 동아리 발표 안내 ■\n내용';
    const r = parseNotice(text);
    expect(r.name.value).toBe('2학기 동아리 발표 안내');
    expect(text.slice(r.name.evidence[0].start, r.name.evidence[0].end)).toBe('2학기 동아리 발표 안내');
  });
  it('빈 글이면 모두 null', () => {
    const r = parseNotice('');
    expect(r.name.value).toBeNull();
    expect(r.type.value).toBeNull();
  });
});

describe('성능·외부 요청', () => {
  afterEach(() => vi.restoreAllMocks());
  it('2,000자 공지문을 50ms 안에 해석', () => {
    let text = SAMPLE_NOTICES[0].text + '\n';
    while (text.length < 2000) text += '참고: 11월 20일 ~ 11월 25일, 12/1, 12. 3. 교내 1·2학년 희망자 안내 사항입니다.\n';
    text = text.slice(0, 2000);
    expect(text.length).toBe(2000);
    const t0 = performance.now();
    parseNotice(text);
    expect(performance.now() - t0).toBeLessThan(50);
  });
  it('MVP3-⑤ 외부 요청 0건', () => {
    const spy = vi.fn();
    const orig = globalThis.fetch;
    (globalThis as { fetch: unknown }).fetch = spy;
    try {
      for (const s of SAMPLE_NOTICES) parseNotice(s.text);
      parseNotice('전국 올림피아드 12월 11일');
    } finally {
      (globalThis as { fetch: unknown }).fetch = orig;
    }
    expect(spy).not.toHaveBeenCalled();
  });
});
