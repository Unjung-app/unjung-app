import Constants from 'expo-constants';

/** 배포할 때 들어가는 git 커밋(로컬 개발에서는 빈 문자열) */
export const BUILD_ID = process.env.EXPO_PUBLIC_BUILD_ID ?? '';
/** 앱 버전: '1.0.0' (+ 배포 커밋 앞 7자리) */
export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const VERSION_LABEL = BUILD_ID ? `${APP_VERSION} (${BUILD_ID.slice(0, 7)})` : APP_VERSION;
