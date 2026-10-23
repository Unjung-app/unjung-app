import Icon from "@/components/Icon";

export const metadata = {
  title: "도서관 장서 검색 | 운중고 스마트 캠퍼스",
};

const SEARCH_URL =
  "https://read365.edunet.net/PureScreen/SchoolSearch?schoolName=%EC%9A%B4%EC%A4%91%EA%B3%A0%EB%93%B1%ED%95%99%EA%B5%90&provCode=J10&neisCode=J100005844";

export default function LibraryPage() {
  return (
    <main className="mx-auto w-full max-w-[480px] px-4 py-6">
      <div className="rounded-2xl bg-navy-50 p-5">
        <div className="flex items-center gap-2 text-navy-900">
          <Icon name="book" className="h-6 w-6" />
          <h1 className="text-lg font-bold">도서관 장서 검색</h1>
        </div>
        <p className="mt-2 text-sm text-navy-600">
          우리 학교 도서관에 어떤 책이 있는지, 대출 가능한지 확인할 수 있어요.
        </p>

        <a
          href={SEARCH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block rounded-xl bg-navy-900 py-3 text-center text-sm font-semibold text-white"
        >
          장서 검색하러 가기 →
        </a>
        <p className="mt-2 text-xs text-navy-600">
          독서로(read365) 사이트가 새 탭에서 열려요.
        </p>
      </div>
    </main>
  );
}
