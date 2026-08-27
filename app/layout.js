import "./globals.css";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

// 색상·글꼴 같은 디자인 토큰은 app/globals.css 의 @theme 블록에서 한 번에 관리합니다.
// (Tailwind v4 는 tailwind.config.js 를 쓰지 않습니다.)

export const metadata = {
  title: "운중고 스마트 캠퍼스",
  description: "운중고등학교 학생 전용 스마트 캠퍼스 앱",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0E2748",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="font-sans">
        <div className="app-shell">
          <AppHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
