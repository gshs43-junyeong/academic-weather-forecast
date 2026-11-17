// 공지문 해석 모듈(SPEC 2-4). 규칙 기반, 외부 요청 없음, 화면 요소에 접근하지 않는다.
import type { ParsedNotice } from '../types';
export const MAX_NOTICE_LENGTH = 2000;
/** 공지문을 해석한다. 찾지 못한 값은 value: null. 각 값의 근거 위치를 evidence로 돌려준다. */
export function parseNotice(_text: string): ParsedNotice { throw new Error('not implemented'); }
