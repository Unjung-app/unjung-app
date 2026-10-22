import Link from "next/link";
import { MENU, STATUS_LABEL } from "@/lib/menu";
import Icon from "@/components/Icon";

// 홈 화면. 기능 목록은 각 기능 폴더의 feature.json 에서 자동으로 만들어집니다.
// 상태(사용 가능 → 만드는 중 → 아이디어)별로 묶어서 보여줍니다.

const GROUPS = [
  { status: "ready", title: "사용할 수 있어요", note: null },
  { status: "building", title: "만드는 중이에요", note: null },
  {
    status: "idea",
    title: "아이디어",
    note: "아직 아무도 만들지 않은 기능이에요. 누구든 맡아서 시작할 수 있어요.",
  },
];

const BADGE = {
  ready: "bg-emerald-50 text-emerald-700",
  building: "bg-amber-50 text-amber-700",
  idea: "bg-navy-50 text-navy-500",
};

export default function HomePage() {
  const makers = new Set(MENU.flatMap((m) => m.makers));

  return (
    <div className="flex-1">
      {/* 상단 인사 영역 */}
      <section className="bg-navy-900 px-5 pb-8 pt-2 text-white">
        <p className="text-sm text-navy-200">운중고등학교</p>
        <h2 className="mt-1 text-xl font-bold leading-snug">
          학생이 직접 만드는
          <br />
          우리 학교 앱
        </h2>
        <p className="mt-3 text-xs text-navy-200">
          기능 {MENU.length}개 · 만든 사람 {makers.size}명
        </p>
      </section>

      <div className="-mt-5 rounded-t-2xl bg-white px-4 pb-8 pt-2">
        {GROUPS.map(({ status, title, note }) => {
          const items = MENU.filter((m) => m.status === status);
          if (items.length === 0) return null;
          return (
            <section key={status} className="mt-5">
              <h3 className="mb-1 flex items-center gap-2 px-1 text-sm font-semibold text-navy-900">
                {title}
                <span className="text-xs font-normal text-navy-400">{items.length}</span>
              </h3>
              {note && <p className="mb-2 px-1 text-xs text-navy-500">{note}</p>}
              <ul className="mt-2 divide-y divide-navy-100 overflow-hidden rounded-2xl border border-navy-100">
                {items.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 bg-white px-4 py-3 transition hover:bg-navy-50"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy-50 text-navy-600">
                        <Icon name={item.icon} className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-navy-900">
                            {item.label}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${BADGE[item.status]}`}
                          >
                            {STATUS_LABEL[item.status]}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-navy-500">
                          {item.makers.length > 0
                            ? `만든 사람 · ${item.makers.join(", ")}`
                            : item.desc}
                        </span>
                      </span>
                      <Icon name="chevron" className="h-4 w-4 shrink-0 text-navy-300" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <a
          href="/guide.html"
          className="mt-8 block rounded-2xl bg-navy-50 px-4 py-3 text-center text-sm font-medium text-navy-700 transition hover:bg-navy-100"
        >
          이 앱 만들기에 참여하기 · 참여 안내서 →
        </a>
        <p className="mt-4 text-center text-xs text-navy-400">
          NERD LAB × 알고리즘 동아리
        </p>
      </div>
    </div>
  );
}
