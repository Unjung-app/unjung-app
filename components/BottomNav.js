"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU, PRIMARY_TABS } from "@/lib/menu";
import Icon from "@/components/Icon";

// 화면 아래에 고정되는 탭바.
// 주요 4개 메뉴 + '더보기'(9개 전체 메뉴 시트) 구성입니다.
export default function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 페이지가 바뀌면 더보기 시트를 닫습니다.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 시트가 열려 있을 때 뒤 배경 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isMoreActive =
    !open &&
    pathname !== "/" &&
    !PRIMARY_TABS.some((item) => item.href === pathname);

  return (
    <>
      {open && <MoreSheet onClose={() => setOpen(false)} pathname={pathname} />}

      <nav
        className="sticky bottom-0 z-50 border-t border-navy-100 bg-white shadow-nav"
        aria-label="주요 메뉴"
      >
        <ul className="mx-auto flex items-stretch">
          {PRIMARY_TABS.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.key} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                    active
                      ? "text-navy-700"
                      : "text-navy-400 hover:text-navy-600"
                  }`}
                >
                  <Icon name={item.icon} className="h-6 w-6" />
                  <span>{item.short}</span>
                </Link>
              </li>
            );
          })}

          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                open || isMoreActive
                  ? "text-navy-700"
                  : "text-navy-400 hover:text-navy-600"
              }`}
            >
              <Icon name={open ? "close" : "grid"} className="h-6 w-6" />
              <span>더보기</span>
            </button>
          </li>
        </ul>
        {/* 아이폰 홈 인디케이터 영역 */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}

// 9개 전체 메뉴를 보여주는 하단 시트
function MoreSheet({ onClose, pathname }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="메뉴 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-navy-950/50"
      />
      <div className="relative mb-16 w-full max-w-app rounded-t-2xl bg-white p-4 pb-6 shadow-card">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-navy-100" />
        <p className="mb-3 px-1 text-sm font-semibold text-navy-900">
          전체 메뉴
        </p>
        <ul className="grid grid-cols-3 gap-2">
          {MENU.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex h-[88px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1 text-center transition ${
                    active
                      ? "border-navy-500 bg-navy-50 text-navy-700"
                      : "border-navy-100 bg-white text-navy-600 hover:border-navy-300 hover:bg-navy-50"
                  }`}
                >
                  <Icon name={item.icon} className="h-6 w-6" />
                  <span className="text-[11px] font-medium leading-tight">
                    {item.short}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
