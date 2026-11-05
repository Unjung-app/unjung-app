import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { seoulNow } from '@/lib/date';
import { useAuth } from './auth';

// 토큰 지갑 · 출석 스트릭 · 꾸미기.
// 모든 계산은 서버(Supabase 함수)가 한다. 앱은 결과를 보여 주기만 한다.

export type ShopKind = 'emoji' | 'name_color' | 'theme' | 'badge' | 'shield';
export type ShopItem = {
  id: string;
  kind: ShopKind;
  name: string;
  value: string;
  price: number;
  sold_from: string | null;
  sold_until: string | null;
  sort: number;
  /** false = 판매하지 않는 상품(예: 주간 게임왕 배지). 이름표 표시용으로만 불러온다 */
  active: boolean;
};
export type Equip = { emoji: string | null; name_color: string | null; theme: string | null; badge: string | null };
export type Wallet = {
  balance: number;
  week_earned: number;
  streak: number;
  best: number;
  shields: number;
  checked_today: boolean;
  today_is_school_day: boolean;
  inventory: string[];
  equip: Equip;
  nickname: string | null;
  nickname_changed_at: string | null;
  hide_in_ranking: boolean;
};
export type CheckinResult = { tokens: number; streak: number; shield_used: number; first_today: boolean; school_day: boolean };
export type LedgerRow = { id: number; delta: number; reason: string; ref_id: string; note: string | null; created_at: string };

type Result = { ok: true } | { ok: false; message: string };
export type TokenToastData = { id: number; amount: number; label: string };

type WalletState = {
  /** 로그인 안 했거나 아직 불러오는 중이면 null */
  wallet: Wallet | null;
  /** 오늘 처음 출석해서 토큰을 받았을 때만 채워짐 (홈 화면 안내용) */
  checkin: CheckinResult | null;
  dismissCheckin: () => void;
  /** 화면 아래에 잠깐 뜨는 '토큰 +n' 알림 */
  toast: TokenToastData | null;
  dismissToast: () => void;
  /** 토큰을 받은 걸 바로 알릴 때 (진동 + 알림). 지갑 숫자는 refresh로 맞춘다 */
  announce: (amount: number, label: string) => void;
  items: ShopItem[];
  itemById: Record<string, ShopItem>;
  /** label: 잔액이 늘었으면 알림에 쓸 이유 */
  refresh: (label?: string) => Promise<void>;
  loadItems: () => Promise<void>;
  loadLedger: () => Promise<LedgerRow[]>;
  buy: (itemId: string) => Promise<Result>;
  equip: (kind: Exclude<ShopKind, 'shield'>, itemId: string | null) => Promise<Result>;
  setNickname: (nickname: string) => Promise<Result>;
  setRankingHidden: (hidden: boolean) => Promise<Result>;
};

const Ctx = createContext<WalletState | null>(null);

const friendly = (message: string | undefined) =>
  message && /[가-힣]/.test(message) ? message : '잠시 뒤 다시 시도해 주세요.';

export function WalletProvider({ children }: { children: ReactNode }) {
  const { status, session } = useAuth();
  const signedIn = !!session && (status === 'ready' || status === 'needsEnrollment');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [checkin, setCheckin] = useState<CheckinResult | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const checkedDay = useRef<string | null>(null);
  const [toast, setToast] = useState<TokenToastData | null>(null);
  const lastBalance = useRef<number | null>(null);
  const toastSeq = useRef(0);

  const announce = useCallback((amount: number, label: string) => {
    if (amount <= 0) return;
    toastSeq.current += 1;
    setToast({ id: toastSeq.current, amount, label });
    rewardHaptic();
  }, []);

  // 새 지갑 정보를 받을 때마다 잔액이 늘었는지 보고 알린다
  const applyWallet = useCallback(
    (w: Wallet, label?: string) => {
      const prev = lastBalance.current;
      lastBalance.current = w.balance;
      setWallet(w);
      if (prev !== null && w.balance > prev) announce(w.balance - prev, label ?? '새로 받은 토큰');
    },
    [announce],
  );

  // 앱을 열 때(그리고 다시 앞으로 가져올 때) 하루 한 번 출석
  const doCheckIn = useCallback(async () => {
    const today = seoulNow().ymd;
    if (checkedDay.current === today) return;
    checkedDay.current = today;
    const { data, error } = await supabase.rpc('check_in');
    if (error || !data) {
      checkedDay.current = null;
      return;
    }
    const { checkin: c, ...w } = data as Wallet & { checkin: CheckinResult };
    const first = c?.first_today && c.tokens > 0;
    if (first) {
      lastBalance.current = w.balance;
      setWallet(w);
      setCheckin(c);
      announce(
        c.tokens,
        c.shield_used > 0
          ? `보호권으로 연속 출석을 지켰어요 · ${c.streak}일 연속`
          : c.tokens >= 30
            ? `출석 + 30일 연속 보너스 🎉`
            : c.tokens >= 10
              ? `출석 + 7일 연속 보너스 🎉`
            : c.school_day
              ? `출석 · ${c.streak}일 연속`
              : '출석 (주말엔 연속 출석이 쉬어요)',
      );
    } else applyWallet(w, '새로 받은 토큰');
  }, [announce, applyWallet]);

  const loadItems = useCallback(async () => {
    const { data } = await supabase.from('shop_items').select('id,kind,name,value,price,sold_from,sold_until,sort,active').order('sort');
    if (data) setItems(data as ShopItem[]);
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setWallet(null);
      setCheckin(null);
      checkedDay.current = null;
      lastBalance.current = null;
      return;
    }
    doCheckIn();
    loadItems();
    // 앱으로 돌아올 때: 날이 바뀌었으면 출석, 아니면 그사이 친구들이 준 토큰(공감·확인 등)을 확인
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      if (checkedDay.current !== seoulNow().ymd) doCheckIn();
      else
        supabase.rpc('my_wallet').then(({ data }) => {
          if (data) applyWallet(data as Wallet, '친구들 덕분에 받은 토큰');
        });
    });
    return () => sub.remove();
  }, [signedIn, doCheckIn, loadItems, applyWallet]);

  const refresh = useCallback(
    async (label?: string) => {
      const { data } = await supabase.rpc('my_wallet');
      if (data) applyWallet(data as Wallet, label);
    },
    [applyWallet],
  );

  const call = useCallback(
    async (fn: string, args: Record<string, unknown>): Promise<Result> => {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) return { ok: false, message: friendly(error.message) };
      if (data) applyWallet(data as Wallet);
      return { ok: true };
    },
    [applyWallet],
  );

  const loadLedger = useCallback(async () => {
    const { data } = await supabase
      .from('token_ledger')
      .select('id,delta,reason,ref_id,note,created_at')
      .order('created_at', { ascending: false })
      .limit(40);
    return (data as LedgerRow[] | null) ?? [];
  }, []);

  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  const value = useMemo<WalletState>(
    () => ({
      wallet,
      checkin,
      dismissCheckin: () => setCheckin(null),
      toast,
      dismissToast: () => setToast(null),
      announce,
      items,
      itemById,
      refresh,
      loadItems,
      loadLedger,
      buy: (id) => call('buy_item', { p_item: id }),
      equip: (kind, id) => call('equip_item', { p_kind: kind, p_item: id }),
      setNickname: (n) => call('set_nickname', { p_nickname: n }),
      setRankingHidden: (h) => call('set_ranking_hidden', { p_hidden: h }),
    }),
    [wallet, checkin, toast, announce, items, itemById, refresh, loadItems, loadLedger, call],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWallet must be used inside WalletProvider');
  return v;
}

/** 토큰을 받을 때 휴대폰 진동 (안드로이드 웹은 vibrate, 앱은 햅틱. 아이폰 웹은 지원 안 함) */
function rewardHaptic() {
  try {
    if (Platform.OS === 'web') {
      const nav = globalThis.navigator as Navigator | undefined;
      nav?.vibrate?.([35, 60, 70]);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  } catch {
    // 진동을 못 해도 알림 문구는 뜬다
  }
}

const GAME_NAME: Record<string, string> = { word: '영단어 러시', math: '암산 챌린지', life: '운중 라이프 퀴즈' };

/** 토큰 기록의 사람이 읽는 이름 */
export function ledgerLabel(row: Pick<LedgerRow, 'reason' | 'note'>) {
  switch (row.reason) {
    case 'check_in':
      return '출석';
    case 'streak_7':
      return '연속 출석 7일 보너스';
    case 'streak_30':
      return '연속 출석 30일 보너스 🎉';
    case 'survey':
      return '학생회 설문 참여';
    case 'shop':
      return `상점 · ${row.note ?? '구매'}`;
    case 'meal_review':
      return '급식 한줄평';
    case 'meal_like':
      return '한줄평 공감 받음';
    case 'study':
      return '집중 모드 공부';
    case 'task_confirmed':
      return '수행평가·숙제 등록';
    case 'notice_approved':
      return '학생 공지 승인';
    case 'lost_found':
      return '분실물 주인 찾아 줌';
    case 'review_done':
      return '검토위원 활동';
    case 'game':
      return `게임 한 판${row.note ? ` · ${GAME_NAME[row.note] ?? row.note}` : ''}`;
    case 'game_best':
      return '게임 주간 최고 기록 경신';
    case 'game_weekly':
      return '주간 게임 랭킹 보상';
    case 'feedback_done':
      return '내 의견이 반영됨';
    case 'admin':
      return `관리자 보정${row.note ? ` · ${row.note}` : ''}`;
    default:
      return '기타';
  }
}
