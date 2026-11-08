import { Platform } from 'react-native';
import { supabase } from './supabase';
import { VAPID_PUBLIC_KEY } from './pushKey';

// 웹 푸시(PWA) 알림 켜기·끄기. 서버(DB)에는 '이 기기로 보내 주세요' 정보만 저장한다.
//  · 안드로이드 크롬·데스크톱: 브라우저에서 바로 켤 수 있다.
//  · 아이폰(iOS 16.4+): 홈 화면에 추가한 앱에서만 켤 수 있다.

export type PushSupport = 'ok' | 'needs-install' | 'unsupported';
export type PushState = 'on' | 'off' | 'blocked' | 'needs-install' | 'unsupported';

type Nav = Navigator & { standalone?: boolean };

export function pushSupport(): PushSupport {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'unsupported';
  const nav = window.navigator as Nav;
  const ua = nav.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && nav.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
  const has = 'serviceWorker' in nav && 'PushManager' in window && 'Notification' in window;
  if (isIOS && !standalone) return 'needs-install';
  return has ? 'ok' : 'unsupported';
}

function base64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** 서비스 워커 준비를 기다린다(로컬 http 등 등록이 안 되는 곳에서는 5초 뒤 포기) */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const ready = navigator.serviceWorker.ready;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 5000));
  return Promise.race([ready, timeout]);
}

/** 구독이 지금 앱의 공개 키로 만든 것인가(키를 바꾸면 옛 구독으로는 알림이 가지 않는다) */
function sameKey(sub: PushSubscription) {
  const k = sub.options?.applicationServerKey;
  if (!k) return true; // 알 수 없으면 그대로 둔다
  const a = new Uint8Array(k as ArrayBuffer);
  const b = base64ToBytes(VAPID_PUBLIC_KEY);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/** 이 기기의 구독을 지금 키로 맞춘다: 없으면 만들고, 옛 키면 지우고 새로 만든다(알림 허용은 그대로라 다시 묻지 않음) */
async function ensureSubscription(reg: ServiceWorkerRegistration) {
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub)) {
    await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
    await sub.unsubscribe().catch(() => false);
    sub = null;
  }
  return sub ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID_PUBLIC_KEY) }));
}

async function currentSubscription() {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function pushState(): Promise<PushState> {
  const s = pushSupport();
  if (s !== 'ok') return s;
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

async function save(sub: PushSubscription) {
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: j.endpoint ?? sub.endpoint,
    p_p256dh: j.keys?.p256dh ?? '',
    p_auth: j.keys?.auth ?? '',
    p_ua: navigator.userAgent.slice(0, 200),
  });
  return error;
}

export async function enablePush(): Promise<{ ok: true } | { ok: false; message: string }> {
  const s = pushSupport();
  if (s === 'needs-install') return { ok: false, message: '아이폰은 홈 화면에 추가한 앱에서 알림을 켤 수 있어요.' };
  if (s !== 'ok') return { ok: false, message: '이 브라우저는 알림을 지원하지 않아요. 크롬이나 홈 화면에 추가한 앱에서 해 보세요.' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, message: perm === 'denied' ? '알림이 차단되어 있어요. 브라우저(또는 휴대폰) 설정에서 이 사이트의 알림을 허용해 주세요.' : '알림 허용을 눌러 주세요.' };
  const reg = await registration();
  if (!reg) return { ok: false, message: '앱을 새로고침한 뒤 다시 시도해 주세요.' };
  try {
    const sub = await ensureSubscription(reg);
    const error = await save(sub);
    if (error) return { ok: false, message: /[가-힣]/.test(error.message) ? error.message : '알림 정보를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
    return { ok: true };
  } catch {
    return { ok: false, message: '알림을 켜지 못했어요. 잠시 뒤 다시 시도해 주세요.' };
  }
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.rpc('delete_push_subscription', { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => false);
}

/** 앱을 열 때: 이미 켜 둔 기기면 지금 로그인한 계정으로 다시 저장(계정 바꿈·만료 대비). 알림 키가 바뀌었으면 새 키로 다시 구독 */
export async function syncPush() {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return;
  const reg = await registration();
  if (!reg) return;
  try {
    const had = await reg.pushManager.getSubscription();
    if (!had) return; // 끈 기기는 그대로
    await save(await ensureSubscription(reg));
  } catch {
    /* 다음에 앱을 열 때 다시 */
  }
}
