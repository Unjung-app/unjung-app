"use client";

import { useState } from "react";

const mealWeeks = [
  {
    label: "10월 1주차",
    days: [
      { day: "월", date: "10/5", dateValue: "2026-10-05", menus: ["현미밥", "된장찌개", "닭갈비", "양배추샐러드", "깍두기"] },
      { day: "화", date: "10/6", dateValue: "2026-10-06", menus: ["흑미밥", "김치찌개", "제육볶음", "콩나물무침", "배추김치"] },
      { day: "수", date: "10/7", dateValue: "2026-10-07", menus: ["카레라이스", "유부장국", "치킨너겟", "오이무침", "깍두기"] },
      { day: "목", date: "10/8", dateValue: "2026-10-08", menus: ["보리밥", "순두부찌개", "소불고기", "시금치나물", "배추김치"] },
      { day: "금", date: "10/9", dateValue: "2026-10-09", menus: ["김치볶음밥", "계란국", "떡갈비", "콘샐러드", "깍두기"] },
    ],
  },
  {
    label: "10월 2주차",
    days: [
      { day: "월", date: "10/12", dateValue: "2026-10-12", menus: ["현미밥", "미역국", "돼지갈비찜", "숙주나물", "배추김치"] },
      { day: "화", date: "10/13", dateValue: "2026-10-13", menus: ["차조밥", "어묵국", "닭볶음탕", "브로콜리무침", "깍두기"] },
      { day: "수", date: "10/14", dateValue: "2026-10-14", menus: ["스파게티", "크림스프", "마늘빵", "그린샐러드", "피클"] },
      { day: "목", date: "10/15", dateValue: "2026-10-15", menus: ["보리밥", "콩나물국", "오징어볶음", "감자채볶음", "배추김치"] },
      { day: "금", date: "10/16", dateValue: "2026-10-16", menus: ["참치마요덮밥", "팽이버섯국", "핫도그", "단무지", "깍두기"] },
    ],
  },
  {
    label: "10월 3주차",
    days: [
      { day: "월", date: "10/19", dateValue: "2026-10-19", menus: ["흑미밥", "육개장", "생선까스", "타르타르소스", "배추김치"] },
      { day: "화", date: "10/20", dateValue: "2026-10-20", menus: ["현미밥", "감자수제비", "간장불고기", "상추겉절이", "깍두기"] },
      { day: "수", date: "10/21", dateValue: "2026-10-21", menus: ["오므라이스", "미소된장국", "소떡소떡", "양상추샐러드", "피클"] },
      { day: "목", date: "10/22", dateValue: "2026-10-22", menus: ["보리밥", "부대찌개", "고등어구이", "도토리묵무침", "배추김치"] },
      { day: "금", date: "10/23", dateValue: "2026-10-23", menus: ["짜장밥", "짬뽕국", "탕수육", "단무지", "배추김치"] },
    ],
  },
  {
    label: "10월 4주차",
    days: [
      { day: "월", date: "10/26", dateValue: "2026-10-26", menus: ["현미밥", "북어국", "닭강정", "마카로니샐러드", "깍두기"] },
      { day: "화", date: "10/27", dateValue: "2026-10-27", menus: ["흑미밥", "김치콩나물국", "돼지고기장조림", "어묵볶음", "배추김치"] },
      { day: "수", date: "10/28", dateValue: "2026-10-28", menus: ["불고기덮밥", "유부장국", "고구마맛탕", "단무지무침", "깍두기"] },
      { day: "목", date: "10/29", dateValue: "2026-10-29", menus: ["보리밥", "된장찌개", "오리불고기", "부추무침", "배추김치"] },
      { day: "금", date: "10/30", dateValue: "2026-10-30", menus: ["잔치국수", "주먹밥", "김말이튀김", "오이피클", "배추김치"] },
    ],
  },
];

export default function MealReviewPage() {
  const [weekIndex, setWeekIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);
  const [ratings, setRatings] = useState({});
  const [reviews, setReviews] = useState({});
  const [reviewText, setReviewText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const currentWeek = mealWeeks[weekIndex];
  const currentMeal = currentWeek.days[selectedDay];

  const reviewKey = `${weekIndex}-${selectedDay}`;
  const currentRating = ratings[reviewKey] || 0;
  const savedReview = reviews[reviewKey] || "";

  const today = new Date();
  const todayString = today.toISOString().split("T")[0];

  const canRate = currentMeal.dateValue <= todayString;

  const moveWeek = (direction) => {
    setWeekIndex((current) => {
      const next = current + direction;

      if (next < 0 || next >= mealWeeks.length) {
        return current;
      }

      setSelectedDay(0);
      setSubmitted(false);
      setReviewText("");

      return next;
    });
  };

  const changeDay = (index) => {
    const nextKey = `${weekIndex}-${index}`;

    setSelectedDay(index);
    setSubmitted(false);
    setReviewText(reviews[nextKey] || "");
  };

  const selectRating = (score) => {
    if (!canRate) {
      return;
    }

    setRatings((current) => ({
      ...current,
      [reviewKey]: score,
    }));
  };

  const submitReview = () => {
    if (!canRate || !reviewText.trim()) {
      return;
    }

    setReviews((current) => ({
      ...current,
      [reviewKey]: reviewText.trim(),
    }));

    setSubmitted(true);
  };

  return (
    <main className="min-h-screen bg-navy-50 px-4 py-6">
      <div className="mx-auto max-w-[480px]">
        <div className="mb-5">
          <p className="text-sm font-medium text-navy-500">
            운중고 스마트 캠퍼스
          </p>

          <h1 className="mt-1 text-2xl font-bold text-navy-900">
            이번 달 급식표
          </h1>
        </div>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveWeek(-1)}
              disabled={weekIndex === 0}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:text-navy-300"
            >
              ← 이전 주
            </button>

            <p className="text-base font-bold text-navy-900">
              {currentWeek.label}
            </p>

            <button
              type="button"
              onClick={() => moveWeek(1)}
              disabled={weekIndex === mealWeeks.length - 1}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-navy-700 transition hover:bg-navy-50 disabled:cursor-not-allowed disabled:text-navy-300"
            >
              다음 주 →
            </button>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {currentWeek.days.map((meal, index) => (
              <button
                key={meal.day}
                type="button"
                onClick={() => changeDay(index)}
                className={`rounded-xl px-2 py-3 text-center transition ${
                  selectedDay === index
                    ? "bg-navy-900 text-white"
                    : "bg-navy-50 text-navy-700 hover:bg-navy-100"
                }`}
              >
                <span className="block text-sm font-bold">
                  {meal.day}
                </span>

                <span
                  className={`mt-1 block text-xs ${
                    selectedDay === index
                      ? "text-navy-100"
                      : "text-navy-500"
                  }`}
                >
                  {meal.date}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="border-b border-navy-100 pb-4">
            <p className="text-sm font-medium text-navy-500">
              {currentMeal.date}
            </p>

            <h2 className="mt-1 text-xl font-bold text-navy-900">
              {currentMeal.day}요일 급식
            </h2>
          </div>

          <ul className="mt-4 space-y-3">
            {currentMeal.menus.map((menu, index) => (
              <li
                key={menu}
                className="flex items-center rounded-xl bg-navy-50 px-4 py-3 text-sm font-medium text-navy-800"
              >
                <span className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-navy-500">
                  {index + 1}
                </span>

                {menu}
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-2xl bg-navy-50 p-4 text-center">
            <p className="text-sm font-bold text-navy-800">
              {canRate
                ? "오늘 급식은 어땠나요?"
                : "아직 먹지 않은 급식이에요"}
            </p>

            <div className="mt-3 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => selectRating(score)}
                  disabled={!canRate}
                  aria-label={`${score}점`}
                  className={`rounded-lg px-1 text-3xl leading-none transition ${
                    canRate
                      ? "hover:scale-110"
                      : "cursor-not-allowed"
                  }`}
                >
                  <span
                    className={
                      !canRate
                        ? "text-navy-200"
                        : score <= currentRating
                          ? "text-yellow-400"
                          : "text-navy-200"
                    }
                  >
                    ★
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-2 text-xs text-navy-500">
              {canRate
                ? currentRating
                  ? `${currentRating}점으로 평가했어요!`
                  : "별을 눌러 급식을 평가해 보세요."
                : "급식을 먹은 후 별점을 남길 수 있어요."}
            </p>
          </div>

          <div className="mt-4 rounded-2xl bg-navy-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-navy-800">
                  한줄평 남기기
                </p>

                <p className="mt-1 text-xs text-navy-500">
                  급식에 대한 의견을 자유롭게 남겨주세요.
                </p>
              </div>

              <span className="text-xs text-navy-400">
                {reviewText.length}/100
              </span>
            </div>

            <textarea
              value={reviewText}
              onChange={(event) => {
                setReviewText(event.target.value.slice(0, 100));
                setSubmitted(false);
              }}
              disabled={!canRate}
              maxLength={100}
              rows={3}
              placeholder={
                canRate
                  ? "예: 오늘 닭갈비가 정말 맛있었어요!"
                  : "급식을 먹은 후 의견을 남길 수 있어요."
              }
              className="mt-3 w-full resize-none rounded-xl border border-navy-100 bg-white px-4 py-3 text-sm text-navy-800 outline-none placeholder:text-navy-300 focus:border-navy-400 disabled:cursor-not-allowed disabled:bg-navy-100"
            />

            <button
              type="button"
              onClick={submitReview}
              disabled={!canRate || !reviewText.trim()}
              className="mt-3 w-full rounded-xl bg-navy-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-navy-200"
            >
              의견 제출
            </button>

            {submitted && (
              <p className="mt-3 text-center text-xs font-medium text-navy-600">
                의견이 등록되었어요! 감사합니다 😊
              </p>
            )}

            {!submitted && savedReview && (
              <p className="mt-3 text-xs text-navy-500">
                이전에 작성한 의견을 수정할 수 있어요.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}