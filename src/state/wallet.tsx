import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
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

type WalletState = {
  /** 로그인 안 했거나 아직 불러오는 중이면 null */
  wallet: Wallet | null;
  /** 오늘 처음 출석해서 토큰을 받았을 때만 채워짐 (홈 화면 안내용) */
  checkin: CheckinResult | null;
  dismissCheckin: () => void;
  items: ShopItem[];
  itemById: Record<string, ShopItem>;
  refresh: () => Promise<void>;
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
    setWallet(w);
    if (c?.first_today && c.tokens > 0) setCheckin(c);
  }, []);

  const loadItems = useCallback(async () => {
    const { data } = await supabase.from('shop_items').select('id,kind,name,value,price,sold_from,sold_until,sort').eq('active', true).order('sort');
    if (data) setItems(data as ShopItem[]);
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setWallet(null);
      setCheckin(null);
      checkedDay.current = null;
      return;
    }
    doCheckIn();
    loadItems();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') doCheckIn();
    });
    return () => sub.remove();
  }, [signedIn, doCheckIn, loadItems]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc('my_wallet');
    if (data) setWallet(data as Wallet);
  }, []);

  const call = useCallback(async (fn: string, args: Record<string, unknown>): Promise<Result> => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, message: friendly(error.message) };
    if (data) setWallet(data as Wallet);
    return { ok: true };
  }, []);

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
    [wallet, checkin, items, itemById, refresh, loadItems, loadLedger, call],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWallet must be used inside WalletProvider');
  return v;
}

/** 토큰 기록의 사람이 읽는 이름 */
export function ledgerLabel(row: Pick<LedgerRow, 'reason' | 'note'>) {
  switch (row.reason) {
    case 'check_in':
      return '출석';
    case 'streak_7':
      return '연속 출석 7일 보너스';
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
    case 'admin':
      return `관리자 보정${row.note ? ` · ${row.note}` : ''}`;
    default:
      return '기타';
  }
}
