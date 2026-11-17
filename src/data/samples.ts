// 샘플 공지문 3개와 정답(SPEC 2-4, 3-5). 가상 공지문이며 실제 이름·학번은 없다.
import type { SampleNotice } from '../types';

export const SAMPLE_NOTICES: SampleNotice[] = [
  {
    id: 'sample-olympiad',
    title: '교외 올림피아드 공고',
    text: [
      '[공지] 2026 전국 청소년 과학 올림피아드 참가 신청 안내',
      '',
      '■ 대상: 1·2학년 희망자',
      '■ 주최: 한국청소년과학재단',
      '■ 접수 기간: 11월 18일(수) ~ 11월 27일(금)',
      '■ 대회일: 12월 11일(금) 09:00',
      '■ 내용: 물질과 에너지, 생명 시스템 분야 필기 및 서술형 문항',
      '',
      '참가를 원하는 학생은 담임 선생님께 신청서를 내 주세요.',
    ].join('\n'),
    expected: { name: '2026 전국 청소년 과학 올림피아드 참가 신청 안내', type: 'contest', difficulty: null, subject: null, due: '2026-12-11', grades: [1, 2], p: 0.2, internal: false, fixed: true },
  },
  {
    id: 'sample-research-final',
    title: '창의연구 최종 발표회 안내',
    text: [
      '「2학기 창의연구 최종 발표회」 개최 안내',
      '',
      '1. 대상: 1학년 전원',
      '2. 일시: 2026. 12. 16.(수) 13:30 ~ 16:30',
      '3. 장소: 본교 시청각실',
      '4. 발표 자료 제출: 12/14(월)까지 팀별 담당 선생님께',
      '5. 내용: 팀별 연구 결과 발표(10분) 및 질의응답(5분)',
    ].join('\n'),
    expected: { name: '2학기 창의연구 최종 발표회', type: 'research_final', difficulty: null, subject: null, due: '2026-12-14', grades: [1], p: 1, internal: true, fixed: true },
  },
  {
    id: 'sample-performance',
    title: '실험 수행평가 안내',
    text: [
      '<과학탐구실험 수행평가> 안내',
      '',
      '- 대상: 1학년 전원',
      '- 실험 일시: 11월 30일(월) ~ 12월 4일(금), 본교 과학실',
      '- 보고서 제출: 12. 9.(수)까지',
      '- 내용: 모둠별 실험을 설계하고 수행한 뒤 결과 보고서를 작성합니다.',
    ].join('\n'),
    expected: { name: '과학탐구실험 수행평가', type: 'performance', difficulty: 'hard', subject: null, due: '2026-12-09', grades: [1], p: 1, internal: true, fixed: false },
  },
];
