// 앱 전체에서 쓰는 아이콘 모음.
// 외부 아이콘 라이브러리 없이 인라인 SVG로 통일된 선 굵기(1.7)를 씁니다.

const PATHS = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  meal: (
    <>
      <path d="M6 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
      <path d="M8 13v8" />
      <path d="M17 3c-1.5 1.5-2 3.5-2 5.5S15.5 12 17 12.5V21" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  sports: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c2.8 2.2 4.5 5.4 4.5 9S14.8 18.8 12 21c-2.8-2.2-4.5-5.4-4.5-9S9.2 5.2 12 3Z" />
      <path d="M3.2 9.5h17.6M3.2 14.5h17.6" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21M9 21h6" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5Z" />
      <path d="M4 19.5A1.5 1.5 0 0 1 5.5 21H19v-3" />
      <path d="M8 7.5h7" />
    </>
  ),
  bell: (
    <>
      <path d="M18 15.5V10a6 6 0 1 0-12 0v5.5L4.5 18h15Z" />
      <path d="M10 21h4" />
    </>
  ),
  star: (
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8Z" />
  ),
  quiz: (
    <>
      <rect x="3" y="3.5" width="18" height="17" rx="3" />
      <path d="M9.3 9.2a2.8 2.8 0 1 1 3.5 2.7c-.5.2-.8.6-.8 1.1v.6" />
      <path d="M12 17h.01" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.5 1.8" />
      <path d="M9.5 2.5h5" />
    </>
  ),
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9 5 7 7-7 7" />,
};

export default function Icon({ name, className = "h-6 w-6" }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
