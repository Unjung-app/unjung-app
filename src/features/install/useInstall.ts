import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

// 홈 화면에 추가(PWA) 상태 판별. 웹에서만 의미가 있다.

export type InstallEnv =
  | { kind: 'native' } // 스토어 앱으로 실행 중 → 안내 필요 없음
  | { kind: 'installed' } // 이미 홈 화면 앱으로 실행 중
  | { kind: 'inapp'; app: string; isKakao: boolean; isAndroid: boolean } // 카톡·인스타 등 앱 안 브라우저 → 설치 불가
  | { kind: 'samsung' } // 삼성 인터넷: 설치 패키지가 Play Protect에 막히는 경우가 있어 크롬 권장
  | { kind: 'ios' } // 아이폰·아이패드 브라우저 → 공유 → 홈 화면에 추가
  | { kind: 'android'; canPrompt: boolean } // 안드로이드 → 설치 버튼(가능하면) 또는 메뉴 안내
  | { kind: 'desktop'; canPrompt: boolean };

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function detect(): InstallEnv {
  if (Platform.OS !== 'web') return { kind: 'native' };
  if (typeof window === 'undefined') return { kind: 'desktop', canPrompt: false };
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
  if (standalone) return { kind: 'installed' };

  const ua = nav.userAgent || '';
  const inapp = ua.match(/KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|everytimeApp|DaumApps|wv\)/i);
  if (inapp) return { kind: 'inapp', app: inapp[0], isKakao: /KAKAOTALK/i.test(ua), isAndroid: /Android/i.test(ua) };
  if (/SamsungBrowser/i.test(ua)) return { kind: 'samsung' };

  const canPrompt = !!(window as unknown as { __installPrompt?: PromptEvent }).__installPrompt;
  // iPadOS는 데스크톱 사파리처럼 보이므로 터치 지원으로 구분
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && nav.maxTouchPoints > 1);
  if (isIOS) return { kind: 'ios' };
  if (/Android/i.test(ua)) return { kind: 'android', canPrompt };
  return { kind: 'desktop', canPrompt };
}

export function useInstall() {
  const [env, setEnv] = useState<InstallEnv>(() => detect());

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setEnv(detect());
    window.addEventListener('installprompt-ready', update);
    window.addEventListener('appinstalled', update);
    return () => {
      window.removeEventListener('installprompt-ready', update);
      window.removeEventListener('appinstalled', update);
    };
  }, []);

  /** 안드로이드 크롬: 시스템 설치 창 띄우기 */
  const promptInstall = useCallback(async () => {
    const w = window as unknown as { __installPrompt?: PromptEvent };
    const ev = w.__installPrompt;
    if (!ev) return false;
    await ev.prompt();
    const choice = await ev.userChoice.catch(() => ({ outcome: 'dismissed' }));
    w.__installPrompt = undefined;
    setEnv(detect());
    return choice.outcome === 'accepted';
  }, []);

  /** 카카오톡 앱 안 브라우저 → 기본 브라우저로 다시 열기 */
  const openExternal = useCallback(() => {
    const url = typeof window !== 'undefined' ? window.location.href : 'https://unjung-app.vercel.app';
    Linking.openURL(`kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`).catch(() => {});
  }, []);

  /** 안드로이드: 같은 주소를 크롬으로 연다 (크롬이 없으면 플레이스토어의 크롬 페이지로) */
  const openInChrome = useCallback(() => {
    if (typeof window === 'undefined') return;
    const { host, pathname, search } = window.location;
    const fallback = encodeURIComponent('https://play.google.com/store/apps/details?id=com.android.chrome');
    window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
  }, []);

  return { env, promptInstall, openExternal, openInChrome };
}

export function needsInstall(env: InstallEnv) {
  return env.kind === 'ios' || env.kind === 'android' || env.kind === 'inapp' || env.kind === 'samsung';
}
