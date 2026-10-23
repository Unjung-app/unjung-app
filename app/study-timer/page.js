// 'unjung study timer' 기능의 첫 화면입니다.
  // 이 폴더(app/study-timer/) 안이라면 무엇이든 AI와 함께 마음껏 바꿔도 됩니다.

  export default function Page() {
    return (
      <div className="px-5 py-8">
        <p className="text-4xl">{"✨"}</p>
        <h2 className="mt-3 text-xl font-bold text-navy-900">{"unjung study timer"}</h2>
        <p className="mt-2 text-sm text-navy-500">{"아직 설명이 없어요."}</p>
        <p className="mt-6 rounded-xl bg-navy-50 p-4 text-sm leading-relaxed text-navy-700">
          아직 빈 화면이에요. npm run ai 를 실행하고, AI에게 이 화면에 무엇이 보였으면
          좋겠는지 이야기해 보세요.
        </p>
      </div>
    );
  }
  