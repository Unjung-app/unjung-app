/**
 * 게임 목록. 참여 학생이 만든 HTML 게임(public/games/<id>/index.html)을 여기에 등록한다.
 * id는 영문 소문자·숫자·_ (2~30자). DB는 id를 따로 등록할 필요가 없다.
 * 새 게임 넣는 법: docs/games/README.md
 */
export type GameId = string;

export type GameInfo = {
  title: string;
  emoji: string;
  /** 한 줄 소개 */
  desc: string;
  /** 장르 배지 */
  tag: string;
  /** 만든 사람(이름) */
  by: string;
  /** 조작법 한 줄 */
  how: string;
};

export const GAMES: Record<GameId, GameInfo> = {
  patrol: {
    title: '운중고 딴짓 단속반',
    emoji: '👀',
    desc: '선생님이 되어 폰·간식 중인 학생을 찾아라',
    tag: '아케이드',
    by: '백지원',
    how: '딴짓하는 학생을 터치! 공부 중인 학생을 누르면 ♥가 줄어요',
  },
  disaster: {
    title: '운중고 재난 시뮬레이션',
    emoji: '🚨',
    desc: '화재·지진·태풍·좀비·공습, 20초 안에 살아남을 선택을',
    tag: '선택지',
    by: '송현우',
    how: '20초 안에 선택지를 눌러요. 엔딩을 모아 도감을 채워 보세요',
  },
  runner: {
    title: '수행 러너',
    emoji: '📄',
    desc: '날아간 수행평가지를 쫓아 학교를 달려라',
    tag: '타이밍',
    by: '김현석',
    how: '노란 표시에서 탭하면 꺾기·점프, 파란 띠는 꾹 누르고 끝에서 떼요. 한 번 실수하면 끝',
  },
  defense: {
    title: '운중 디펜스',
    emoji: '🛡️',
    desc: '몰려오는 시험 괴물을 막고 100점을 지켜라',
    tag: '디펜스',
    by: '김도윤',
    how: '아래 카드를 길옆 칸으로 끌어다 놓아요. 💎로 카드를 강화하면 점점 세져요',
  },
  tower: {
    title: '운중고 타워 쌓기',
    emoji: '🏫',
    desc: '운중고 건물을 하늘 끝까지 쌓아 올려라',
    tag: '캐주얼',
    by: '안현준, 김현석',
    how: '화면을 탭해서 층을 떨어뜨려요. 딱 맞추면 콤보 보너스',
  },
  campus_walk: {
    title: '학교 한바퀴',
    emoji: '🌸',
    desc: '교실부터 벚꽃 마당까지, 운중고의 여섯 장소를 탐험해요',
    tag: '3D 탐험',
    by: '장원준',
    how: '왼쪽 조이스틱으로 이동하고 화면을 드래그해 둘러봐요. 여섯 장소를 방문한 뒤 탐험 완료를 눌러요',
  },
};

export const GAME_IDS: GameId[] = Object.keys(GAMES);

export const gameUrl = (id: GameId) => `/games/${id}/index.html?unjung=1`;
