import Link from "next/link";
import { MENU } from "@/lib/menu";
import Icon from "@/components/Icon";

export default function HomePage() {
  return (
    <div className="flex-1">
      {/* 상단 인사 영역 */}
      <section className="bg-navy-900 px-5 pb-8 pt-2 text-white">
        <p className="text-sm text-navy-200">운중고등학교</p>
        <h2 className="mt-1 text-xl font-bold leading-snug">
          오늘 필요한 학교 정보를
          <br />
          한 곳에서 확인하세요
        </h2>
      </section>

      {/* 9개 기능 바로가기 그리드 */}
      <section className="-mt-5 rounded-t-2xl bg-white px-4 pb-8 pt-5">
        <h3 className="mb-3 px-1 text-sm font-semibold text-navy-900">
          전체 기능
        </h3>

        <ul className="grid grid-cols-3 gap-2.5">
          {MENU.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex h-[100px] flex-col items-center justify-center gap-2 rounded-2xl border border-navy-100 bg-navy-50/60 px-1.5 text-center transition hover:border-navy-300 hover:bg-navy-100 active:scale-[0.98]"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-navy-600 shadow-sm">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-medium leading-tight text-navy-800">
                  {item.short}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {/* 기능 설명 목록 */}
        <h3 className="mb-2 mt-8 px-1 text-sm font-semibold text-navy-900">
          기능 안내
        </h3>
        <ul className="divide-y divide-navy-100 overflow-hidden rounded-2xl border border-navy-100">
          {MENU.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex items-center gap-3 bg-white px-4 py-3 transition hover:bg-navy-50"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600">
                  <Icon name={item.icon} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-navy-900">
                    {item.label}
                  </span>
                  <span className="block truncate text-xs text-navy-500">
                    {item.desc}
                  </span>
                </span>
                <Icon name="chevron" className="h-4 w-4 shrink-0 text-navy-300" />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-center text-xs text-navy-400">
          지금은 화면 틀만 준비된 단계입니다.
        </p>
      </section>
    </div>
  );
}
