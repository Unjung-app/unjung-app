
import Icon from "@/components/Icon";

export const metadata = {
  title: "통합 공지 | 운중고 스마트 캠퍼스",
};

const grades = [
  {
    grade: 1,
    title: "1학년",
    desc: "1학년 공지사항 확인하기",
    href: "/notice/grade1",
    icon: "sprout",
  },
  {
    grade: 2,
    title: "2학년",
    desc: "2학년 공지사항 확인하기",
    href: "/notice/grade2",
    icon: "flower-2",
  },
  {
    grade: 3,
    title: "3학년",
    desc: "3학년 공지사항 확인하기",
    href: "/notice/grade3",
    icon: "tree-deciduous",
  },
];

export default function NoticePage() {
  return (
    <main className="mx-auto w-full max-w-[480px] px-5 py-6">
      <div className="mb-6">
        <p className="text-sm font-medium text-navy-600">
          UNJUNG HIGH SCHOOL
        </p>
        <h1 className="mt-2 text-2xl font-bold text-navy-900">
          통합 공지
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          공지사항을 확인할 학년을 선택해 주세요.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {grades.map((item) => (
          <a
            key={item.grade}
            href={item.href}
            className="group flex min-h-28 items-center gap-4 rounded-2xl border border-navy-100 bg-white p-5 shadow-sm transition hover:border-navy-300 hover:shadow-md active:scale-[0.99]"
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-navy-900 text-white">
              <Icon name="bell" className="h-7 w-7" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-navy-900">
                {item.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {item.desc}
              </p>
            </div>

            <span className="text-2xl text-navy-400 transition group-hover:translate-x-1">
              ›
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}
