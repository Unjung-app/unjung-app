import type { ComponentType } from 'react';
import { CalendarScreen } from './calendar/CalendarScreen';
import { ComingSoonScreen } from './ComingSoonScreen';
import { LibraryScreen } from './library/LibraryScreen';
import { MealScreen } from './meal/MealScreen';
import { GamesScreen } from './games/GamesScreen';
import { LostScreen } from './lost/LostScreen';
import { NoticeScreen } from './notice/NoticeScreen';
import { RankingScreen } from './ranking/RankingScreen';
import { StudyScreen } from './study/StudyScreen';
import { TasksScreen } from './tasks/TasksScreen';
import { TimetableScreen } from './timetable/TimetableScreen';
import { VoiceScreen } from './voice/VoiceScreen';

type ScreenProps = { inStack?: boolean };

const soon = (id: string): ComponentType<ScreenProps> =>
  function Soon(props: ScreenProps) {
    return <ComingSoonScreen id={id} {...props} />;
  };

/** 기능 id → 화면. 탭 화면과 '전체'에서 연 화면이 같은 컴포넌트를 쓴다. */
export const FEATURE_SCREENS: Record<string, ComponentType<ScreenProps>> = {
  timetable: TimetableScreen,
  meal: MealScreen,
  tasks: TasksScreen,
  calendar: CalendarScreen,
  library: LibraryScreen,
  study: StudyScreen,
  games: GamesScreen,
  ranking: RankingScreen,
  notice: NoticeScreen,
  lost: LostScreen,
  voice: VoiceScreen,
  sports: soon('sports'),
};
