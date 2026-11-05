import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// 공개(publishable) 키는 원래 앱에 들어가도록 만든 값이다. 데이터 보호는 DB 규칙(RLS)이 맡는다.
// 비밀 키(secret/service_role)는 절대 앱에 넣지 않는다.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://uikvrgjqcktzcshvaxdj.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_FaUKtrpMbk2Ggz9__oaE4Q_56kif66n';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
});

export const SCHOOL_DOMAIN = 'unjung.hs.kr';
export const CONTACT_EMAIL = 'howonlee728@gmail.com';

export function isSchoolEmail(email: string | null | undefined) {
  return !!email && email.toLowerCase().endsWith(`@${SCHOOL_DOMAIN}`);
}
