"use client";

import { useState } from "react";
import Icon from "@/components/Icon";

const initialRanking = [
  { rank: 1, name: "학생 A", grade: 3, time: 428 },
  { rank: 2, name: "학생 B", grade: 2, time: 405 },
  { rank: 3, name: "학생 C", grade: 3, time: 392 },
  { rank: 4, name: "학생 D", grade: 1, time: 371 },
  { rank: 5, name: "학생 E", grade: 2, time: 356 },
  { rank: 6, name: "학생 F", grade: 1, time: 342 },
  { rank: 7, name: "학생 G", grade: 3, time: 330 },
  { rank: 8, name: "학생 H", grade: 2, time: 318 },
  { rank: 9, name: "학생 I", grade: 1, time: 301 },
  { rank: 10, name: "학생 J", grade: 3, time: 287 },
  { rank: 11, name: "학생 K", grade: 2, time: 274 },
  { rank: 12, name: "학생 L", grade: 1, time: 260 },
];

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}분`;
  }

  return `${hours}시간 ${mins}분`;
}

export default function StudyPage() {
  const [isStudying, setIsStudying] = useState(false);
  const [studyMinutes, setStudyMinutes] = useState(0);
  const [ranking, setRanking] = useState(initialRanking);

  function handleStudyToggle() {
    if (isStudying) {
      setStudyMinutes((prev) => prev + 60);
    }

    setIsStudying((prev) => !prev);
  }

  function addMyRanking() {
    const myTime = studyMinutes + (isStudying ? 60 : 0);

    if (myTime === 0) {
      return;
    }

    const newRanking = [
      ...ranking,
      {
        rank: 0,
        name: "나",
        grade: 2,
        time: myTime,
      },
    ]
      .sort((a, b) => b.time - a.time)
      .map((student, index) => ({
        ...student,
        rank: index + 1,
      }));

    setRanking(newRanking);
  }

  return (
    <main className="mx-auto min-h-screen max-w-[480px] bg-navy-50 px-4 pb-8">
      <section className="pt-5">
        <div className="mb-5">
          <p className="text-sm font-medium text-navy-500">STUDY CHALLENGE</p>
          <h1 className="mt-1 text-2xl font-bold text-navy-950">
            전학년 공부시간 경쟁
          </h1>
          <p className="mt-2 text-sm text-navy-600">
            오늘 공부한 시간을 기록하고 친구들과 비교해 보세요.
          </p>
        </div>

        <section className="rounded-3xl bg-navy-900 p-5 text-white shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              <Icon name="timer" className="h-5 w-5" />
            </div>

            <div>
              <p className="text-sm text-navy-200">오늘 공부시간</p>
              <p className="text-2xl font-bold">{formatTime(studyMinutes)}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStudyToggle}
            className={`mt-5 w-full rounded-2xl py-3.5 text-sm font-bold transition ${
              isStudying
                ? "bg-white text-navy-900"
                : "bg-navy-500 text-white"
            }`}
          >
            {isStudying ? "공부 종료" : "공부 시작"}
          </button>

          {isStudying && (
            <p className="mt-3 text-center text-xs text-navy-200">
              지금 공부시간을 기록하고 있어요.
            </p>
          )}
        </section>

        <button
          type="button"
          onClick={addMyRanking}
          className="mt-3 w-full rounded-2xl border border-navy-200 bg-white py-3 text-sm font-semibold text-navy-700"
        >
          내 공부시간 순위에 반영하기
        </button>

        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-bold text-navy-950">
                전체 순위
              </h2>
              <p className="mt-1 text-xs text-navy-500">
                공부시간이 많은 순서예요.
              </p>
            </div>

            <span className="text-xs font-medium text-navy-500">
              총 {ranking.length}명
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white">
            {ranking.map((student) => (
              <div
                key={`${student.name}-${student.rank}`}
                className="flex items-center gap-3 border-b border-navy-100 px-4 py-3.5 last:border-b-0"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    student.rank === 1
                      ? "bg-navy-900 text-white"
                      : student.rank === 2
                        ? "bg-navy-200 text-navy-900"
                        : student.rank === 3
                          ? "bg-navy-100 text-navy-800"
                          : "bg-navy-50 text-navy-500"
                  }`}
                >
                  {student.rank}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900">
                    {student.name}
                    {student.name === "나" && (
                      <span className="ml-1.5 text-xs font-medium text-navy-500">
                        나
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-navy-500">
                    {student.grade}학년
                  </p>
                </div>

                <p className="text-sm font-bold text-navy-800">
                  {formatTime(student.time)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
