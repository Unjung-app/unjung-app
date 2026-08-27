import ComingSoon from "@/components/ComingSoon";

export const metadata = {
  title: "급식 정보 | 운중고 스마트 캠퍼스",
};

export default function MealPage() {
  return (
    <ComingSoon
      title="급식 정보"
      desc="오늘·이번 주 식단과 영양 정보를 보여줄 화면입니다. 곧 만나요!"
      icon="meal"
    />
  );
}
