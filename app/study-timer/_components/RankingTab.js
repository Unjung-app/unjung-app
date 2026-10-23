"use client";

// [랭킹] 탭: 친구 현황 + 오늘 / 전체 누적 랭킹
// 친구는 _data.js의 예시 데이터예요. "나"의 시간만 진짜 기록이에요.

import { useState } from "react";
import { exampleFriends } from "../_data";
import { formatTime, formatShort } from "../_utils";

const MEDALS = ["🥇", "🥈", "🥉"];

const MODES = [
  { id: "today", label: "오늘" },
  { id: "total", label: "전체 누적" },
];

export default function RankingTab({ myTodaySeconds, myTotalSeconds, now }) {
  const [mode, setMode] = useState("today"); // "today" 또는 "total"
  const [openedAt] = useState(() => Date.now()); // 예시 친구 시간이 흐르게 하는 기준

  // 나 + 예시 친구들을 한 줄로 세우기
  const people = [
    { id: "me", name: "나", avatar: "🙋", today: myTodaySeconds, total: myTotalSeconds, isMe: true },
    ...exampleFriends.map((f) => ({
      id: f.id,
      name: f.name,
      avatar: f.avatar,
      today: f.todaySeconds,
      total: f.totalSeconds,
      isMe: false,
    })),
  ];
  const ranked = [...people].sort((a, b) => b[mode] - a[mode]);

  return (
    <div>
      <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
        👀 친구들은 아직 <b>예시 데이터</b>예요. 학교 앱에 데이터베이스가 연결되면 진짜 친구로
        바뀌어요. &quot;나&quot;의 시간은 진짜 기록이에요!
      </p>

      {/* 친구 현황 */}
      <section className="mt-5">
        <h3 className="text-sm font-bold text-navy-900">친구 현황</h3>
        <ul className="mt-2 divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white">
          {exampleFriends.map((f) => {
            const liveSeconds = f.studying
              ? f.studying.minutesAgo * 60 + Math.max(0, (now - openedAt) / 1000)
              : 0;
            return (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-2xl">{f.avatar}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy-900">{f.name}</p>
                  {f.studying ? (
                    <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {f.studying.subject} 공부 중
                    </p>
                  ) : (
                    <p className="text-xs text-navy-400">쉬는 중</p>
                  )}
                </div>
                {f.studying && (
                  <span className="font-mono text-sm font-semibold tabular-nums text-emerald-700">
                    {formatTime(liveSeconds)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* 랭킹 */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy-900">랭킹</h3>
          <div className="flex rounded-lg bg-navy-50 p-0.5 text-xs font-semibold">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`rounded-md px-3 py-1.5 ${
                  mode === m.id ? "bg-white text-navy-900 shadow-sm" : "text-navy-500"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <ol className="mt-2 space-y-2">
          {ranked.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
                p.isMe ? "bg-navy-900 text-white" : "border border-navy-100 bg-white text-navy-900"
              }`}
            >
              <span className="w-7 text-center text-lg font-bold">{MEDALS[i] ?? i + 1}</span>
              <span className="text-xl">{p.avatar}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
              <span className={`text-sm font-semibold ${p.isMe ? "text-white" : "text-navy-700"}`}>
                {formatShort(p[mode])}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-navy-400">
          랭킹은 [저장]한 기록으로 계산해요. 기록을 지우면 랭킹 시간에서도 빠져요.
        </p>
      </section>
    </div>
  );
}