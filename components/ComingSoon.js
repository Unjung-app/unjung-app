import Link from "next/link";
import Icon from "@/components/Icon";

// 아직 내용이 없는 기능 페이지에 공통으로 쓰는 '준비 중' 화면.
export default function ComingSoon({ title, desc, icon }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-navy-100 text-navy-600">
        <Icon name={icon} className="h-8 w-8" />
      </div>

      <h2 className="text-lg font-semibold text-navy-900">
        {title} 기능 준비 중입니다
      </h2>

      {desc && (
        <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-navy-500">
          {desc}
        </p>
      )}

      <span className="mt-5 rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-600">
        Coming soon
      </span>

      <Link
        href="/"
        className="mt-8 text-sm font-medium text-navy-600 underline underline-offset-4 hover:text-navy-800"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
