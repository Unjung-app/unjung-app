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
    by: '',
    how: '딴짓하는 학생을 터치! 공부 중인 학생을 누르면 ♥가 줄어요',
  },
  tower: {
    title: '운중고 타워 쌓기',
    emoji: '🏫',
    desc: '운중고 건물을 하늘 끝까지 쌓아 올려라',
    tag: '캐주얼',
    by: '',
    how: '화면을 탭해서 층을 떨어뜨려요. 딱 맞추면 콤보 보너스',
  },
};

export const GAME_IDS: GameId[] = Object.keys(GAMES);

export const gameUrl = (id: GameId) => `/games/${id}/index.html?unjung=1`;
