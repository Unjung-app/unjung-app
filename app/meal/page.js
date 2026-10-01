import ComingSoon from "@/components/ComingSoon";

export const metadata = {
  title: "급식 정보 | 운중고 스마트 캠퍼스",
};

export default function MealPage() {
  return (
    <ComingSoon
      title="급식 정보"
      desc="오늘 점심 메뉴가 곧 이곳에 표시됩니다!"
      icon="meal"
    />
  );
}