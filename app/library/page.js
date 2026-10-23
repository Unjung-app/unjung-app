"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

const BASE_URL = "https://read365.edunet.net/PureScreen/SchoolSearchResult";

function makeSearchUrl(keyword) {
  const params = new URLSearchParams({
    searchKeyword: keyword,
    provCode: "J10",
    neisCode: "J100005844",
    schoolName: "운중고등학교",
  });
  return `${BASE_URL}?${params.toString()}`;
}

export default function LibraryPage() {
  const [keyword, setKeyword] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const word = keyword.trim();
    if (!word) return;
    window.open(makeSearchUrl(word), "_blank", "noopener,noreferrer");
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 py-6">
      <div className="rounded-2xl bg-navy-50 p-5">
        <div className="flex items-center gap-2 text-navy-900">
          <Icon name="book" className="h-6 w-6" />
          <h1 className="text-lg font-bold">도서관 장서 검색</h1>
        </div>
        <p className="mt-2 text-sm text-navy-600">
          책 제목, 저자, 키워드를 검색하면 우리 학교 도서관 장서를 보여 줘요.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="검색어를 입력하세요"
            className="min-w-0 flex-1 rounded-xl border border-navy-200 bg-white px-4 py-3 text-sm text-navy-900 outline-none focus:border-navy-600"
          />
          <button
            type="submit"
            disabled={!keyword.trim()}
            className="rounded-xl bg-navy-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            검색
          </button>
        </form>

        <p className="mt-2 text-xs text-navy-600">
          검색 결과는 독서로(read365) 사이트가 새 탭에서 열려요.
        </p>
      </div>
    </main>
  );
}