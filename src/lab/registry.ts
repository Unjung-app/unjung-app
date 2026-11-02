// 실험실(베타): 참여원이 만드는 새 기능을 자동으로 찾아 등록한다.
// src/lab/<이름>/ 폴더에 meta.json(소개)과 index.tsx(화면)만 있으면 앱의 '전체 → 실험실'에 나타난다.
// → 새 기능을 추가해도 공용 파일(registry.ts·screens.tsx·라우트)을 고칠 필요가 없다.
// 대표만 수정한다.

/// <reference types="expo/types" />
import type { ComponentType } from 'react';
import { Platform } from 'react-native';

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

export type LabFeature = LabMeta & { slug: string; Screen: ComponentType };

const SLUG = /^[a-z](?:[a-z0-9]|-(?=[a-z0-9])){1,29}$/;

// Metro(Expo 번들러)가 빌드할 때 src/lab/*/ 의 meta.json·index.tsx 를 모두 찾아 묶는다.
const ctx = require.context('./', true, /^\.\/[^/]+\/(meta\.json|index\.tsx)$/);

function load(): LabFeature[] {
  const bySlug = new Map<string, { meta?: LabMeta; Screen?: ComponentType }>();
  for (const key of ctx.keys()) {
    const m = /^\.\/([^/]+)\/(meta\.json|index\.tsx)$/.exec(key);
    if (!m) continue;
    const [, slug, file] = m;
    if (!SLUG.test(slug)) continue;
    const entry = bySlug.get(slug) ?? {};
    try {
      const mod = ctx(key);
      if (file === 'meta.json') entry.meta = (mod?.default ?? mod) as LabMeta;
      else entry.Screen = (mod?.default ?? null) as ComponentType;
    } catch (e) {
      console.warn(`[실험실] ${slug}/${file}을 불러오지 못했어요`, e);
    }
    bySlug.set(slug, entry);
  }
  const out: LabFeature[] = [];
  for (const [slug, { meta, Screen }] of bySlug) {
    if (!meta || typeof meta.title !== 'string' || !Screen) {
      console.warn(`[실험실] ${slug}: meta.json(title)과 index.tsx(export default 화면)가 모두 있어야 해요`);
      continue;
    }
    out.push({ ...meta, slug, Screen });
  }
  return out.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}

export const LAB_FEATURES: LabFeature[] = load();
export const LAB_BY_SLUG: Record<string, LabFeature> = Object.fromEntries(LAB_FEATURES.map((f) => [f.slug, f]));

/** 정식 주소(출시 버전)인지. 개발 서버·Codespaces·미리보기 주소에서는 false */
function isProductionSite() {
  if (__DEV__) return false;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  return window.location.hostname === 'unjung-app.vercel.app';
}

/** 실험실이 보이는지: 관리자이거나, 정식 주소가 아닐 때(개발·미리보기) */
export function labVisible(role: string | null | undefined) {
  return role === 'admin' || !isProductionSite();
}
