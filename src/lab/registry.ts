// 실험실(베타): 참여원이 만드는 새 기능을 자동으로 찾아 등록한다.
// src/lab/<이름>/ 폴더에 meta.json(소개)과 index.tsx(화면)만 있으면 앱의 '전체 → 실험실'에 나타난다.
// → 새 기능을 추가해도 공용 파일(registry.ts·screens.tsx·라우트)을 고칠 필요가 없다.
// 대표만 수정한다.

/// <reference types="expo/types" />
import type { ComponentType } from 'react';

export type LabMeta = {
  /** 기능 이름 */
  title: string;
  /** 한 줄 설명 */
  desc?: string;
  /** 이모지 한 개 */
  emoji?: string;
  /** 만든 사람 영문 이름 */
  makers?: string[];
  /** building = 만드는 중, ready = 다 만듦(정식 기능 후보) */
  status?: 'building' | 'ready';
};

export type LabFeature = Required<Pick<LabMeta, 'title' | 'makers'>> &
  Omit<LabMeta, 'title' | 'makers'> & {
    slug: string;
    /** 화면을 열 때 처음 불러온다(앱 시작 때 실험실 코드가 실행되지 않게) */
    loadScreen: () => ComponentType | null;
  };

const SLUG = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,29}$/;

// Metro(Expo 번들러)가 빌드할 때 src/lab/*/ 의 meta.json·index.tsx 를 모두 찾아 묶는다.
// 묶기만 하고, index.tsx는 그 화면을 열 때 처음 실행한다.
const ctx = require.context('./', true, /^\.\/[^/]+\/(meta\.json|index\.tsx)$/);

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

/** meta.json을 안전하게 읽는다. 형식이 틀려도 앱이 멈추지 않게 */
function cleanMeta(raw: unknown): LabMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 40);
  if (!title) return null;
  const makers = Array.isArray(r.makers) ? r.makers.filter((m): m is string => typeof m === 'string').slice(0, 10) : [];
  return {
    title,
    desc: str(r.desc, 80),
    emoji: str(r.emoji, 8),
    makers,
    status: r.status === 'ready' ? 'ready' : 'building',
  };
}

function load(): LabFeature[] {
  const keys = ctx.keys();
  const out: LabFeature[] = [];
  for (const key of keys) {
    const m = /^\.\/([^/]+)\/meta\.json$/.exec(key);
    if (!m) continue;
    const slug = m[1];
    if (!SLUG.test(slug)) continue;
    const screenKey = `./${slug}/index.tsx`;
    if (!keys.includes(screenKey)) {
      console.warn(`[실험실] ${slug}: index.tsx가 없어요`);
      continue;
    }
    let meta: LabMeta | null = null;
    try {
      const mod = ctx(key);
      meta = cleanMeta(mod?.default ?? mod);
    } catch (e) {
      console.warn(`[실험실] ${slug}/meta.json을 읽지 못했어요`, e);
    }
    if (!meta) {
      console.warn(`[실험실] ${slug}: meta.json에 title(기능 이름)이 있어야 해요`);
      continue;
    }
    let cached: ComponentType | null | undefined;
    out.push({
      ...meta,
      title: meta.title,
      makers: meta.makers ?? [],
      slug,
      loadScreen: () => {
        if (cached === undefined) {
          const mod = ctx(screenKey);
          cached = typeof mod?.default === 'function' ? (mod.default as ComponentType) : null;
        }
        return cached;
      },
    });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}

export const LAB_FEATURES: LabFeature[] = load();
export const LAB_BY_SLUG: Record<string, LabFeature> = Object.fromEntries(LAB_FEATURES.map((f) => [f.slug, f]));

/**
 * 정식 배포인지. 개발 서버(Codespaces 포함)와 Vercel 미리보기 배포에서는 false.
 * EXPO_PUBLIC_VERCEL_ENV는 vercel.json buildCommand가 넣어 준다. 값이 없으면 정식으로 본다(안전한 쪽).
 */
function isProduction() {
  if (__DEV__) return false;
  return process.env.EXPO_PUBLIC_VERCEL_ENV !== 'preview';
}

/** 실험실이 보이는지: 관리자이거나, 정식 주소가 아닐 때(개발·미리보기) */
export function labVisible(role: string | null | undefined) {
  return role === 'admin' || !isProduction();
}
