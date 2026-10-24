import type { IconName } from '@/components/ui/Icon';

// 앱의 모든 기능 목록. 하단 탭 설정·'전체' 화면·라우팅이 이 표 하나를 기준으로 움직인다.
// 새 기능을 추가할 때: 여기에 한 줄 + src/app/(tabs)/<id>.tsx 화면 파일.

export type FeatureStatus = 'live' | 'soon';

export type Feature = {
  id: string;
  title: string;
  /** 하단 탭에 보일 이름 (4글자 이내 권장) */
  short: string;
  desc: string;
  icon: IconName;
  status: FeatureStatus;
};

export const FEATURES: Feature[] = [
  { id: 'timetable', title: '시간표', short: '시간표', desc: '내 반 주간 시간표와 지금 수업', icon: 'timetable', status: 'live' },
  { id: 'meal', title: '급식', short: '급식', desc: '이번 주 식단과 한줄평', icon: 'meal', status: 'live' },
  { id: 'tasks', title: '수행평가·숙제', short: '과제', desc: '우리 반 마감을 친구들과 함께 챙겨요', icon: 'task', status: 'live' },
  { id: 'calendar', title: '학사일정', short: '일정', desc: '시험·행사·휴업일과 D-day', icon: 'calendar', status: 'live' },
  { id: 'library', title: '도서관', short: '도서관', desc: '학교 도서관 장서 검색', icon: 'library', status: 'live' },
  { id: 'study', title: '공부 타이머', short: '공부', desc: '집중 모드로 공부하고 토큰 받기', icon: 'study', status: 'live' },
  { id: 'games', title: '게임', short: '게임', desc: '영단어·암산·운중 라이프 퀴즈 · 게임 랭킹', icon: 'game', status: 'live' },
  { id: 'ranking', title: '랭킹', short: '랭킹', desc: '반 대항 공부·토큰 랭킹', icon: 'ranking', status: 'live' },
  { id: 'notice', title: '학생 공지', short: '공지', desc: '학생이 올리고 검토위원이 확인한 학교 소식', icon: 'notice', status: 'live' },
  { id: 'lost', title: '분실물', short: '분실물', desc: '잃어버린 물건·주운 물건 찾기', icon: 'search', status: 'live' },
  { id: 'voice', title: '운중 보이스', short: '보이스', desc: '학생 설문과 건의', icon: 'voice', status: 'soon' },
  { id: 'sports', title: '스포츠 허브', short: '스포츠', desc: '반 대항전 일정과 결과', icon: 'sports', status: 'soon' },
];

export const FEATURE_BY_ID: Record<string, Feature> = Object.fromEntries(FEATURES.map((f) => [f.id, f]));

/** 하단 탭: 맨 앞 '오늘'과 맨 뒤 '전체'는 고정, 가운데는 학생이 고르는 칸 */
export const MAX_CUSTOM_TABS = 3;
export const DEFAULT_TABS = ['timetable', 'meal', 'tasks'];

export function sanitizeTabs(ids: unknown): string[] {
  if (!Array.isArray(ids)) return DEFAULT_TABS;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && FEATURE_BY_ID[id] && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
    if (out.length === MAX_CUSTOM_TABS) break;
  }
  return out;
}

/** 앱 정보에 표시하는 개발팀 (순서 그대로 표시) */
export const DEV_TEAM_NAME = '운중고 앱 학생 개발팀';
export const DEV_TEAM = ['이호원', '배종범', '김현석', '백지원', '김용원', '차지현'];
