"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { findMenuByHref } from "@/lib/menu";
import Icon from "@/components/Icon";

// 모든 페이지 위쪽에 공통으로 붙는 헤더.
// 홈에서는 앱 이름을, 하위 페이지에서는 뒤로가기 + 페이지 이름을 보여줍니다.
export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === "/";
  const current = findMenuByHref(pathname);

  return (
    <header className="sticky top-0 z-30 bg-navy-900 text-white">
      <div className="flex h-14 items-center gap-2 px-4">
        {isHome ? (
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/15 text-sm font-bold">
              운
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold leading-tight">
                운중고 스마트 캠퍼스
              </span>
              <span className="block truncate text-[11px] leading-tight text-navy-200">
                Unjung High School
              </span>
            </span>
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="뒤로 가기"
              className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition hover:bg-white/10 active:bg-white/20"
            >
              <Icon name="chevron" className="h-5 w-5 rotate-180" />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold">
              {current ? current.label : "운중고 스마트 캠퍼스"}
            </h1>
            <Link
              href="/"
              aria-label="홈으로"
              className="-mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/90 transition hover:bg-white/10 active:bg-white/20"
            >
              <Icon name="home" className="h-5 w-5" />
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
