"use client";

// [기록] 탭: 저장한 공부 기록 보기, 메모 확인, 삭제

import { useState } from "react";
import Modal from "./Modal";
import { formatTime, formatShort, todayKey, dateLabel, clockLabel } from "../_utils";

export default function RecordTab({ records, onDelete }) {
  const [deleteId, setDeleteId] = useState(null);

  // 오늘 기록과 합계
  const today = todayKey();
  const todayRecords = records.filter((r) => r.date === today);
  const todayTotal = todayRecords.reduce((sum, r) => sum + r.seconds, 0);

  // 오늘 과목별 합계 → [["수학", 3600], ["영어", 1200]]
  const bySubject = {};
  todayRecords.forEach((r) => {
    bySubject[r.subject] = (bySubject[r.subject] || 0) + r.seconds;
  });
  const subjectTotals = Object.entries(bySubject).sort((a, b) => b[1] - a[1]);

  // 날짜별로 묶기 (최근 기록이 위로)
  const sorted = [...records].sort((a, b) => b.savedAt - a.savedAt);
  const groups = [];
  sorted.forEach((r) => {
    const last = groups[groups.length - 1];
    if (last && last.date === r.date) last.items.push(r);
    else groups.push({ date: r.date, items: [r] });
  });

  const target = records.find((r) => r.id === deleteId);

  return (
    <div>
      {/* 오늘 요약 */}
      <div className="rounded-2xl bg-navy-900 p-5 text-white">
        <p className="text-sm text-navy-200">오늘 총 공부 시간</p>
        <p className="mt-1 text-3xl font-bold">{formatShort(todayTotal)}</p>
        {subjectTotals.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {subjectTotals.map(([subject, secs]) => (
              <span key={subject} className="rounded-full bg-white/10 px-3 py-1 text-xs">
                {subject} {formatShort(secs)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 기록 목록 */}
      {records.length === 0 ? (
        <p className="mt-5 rounded-xl bg-navy-50 p-4 text-center text-sm leading-relaxed text-navy-600">
          아직 저장한 기록이 없어요.
          <br />
          [타이머] 탭에서 공부한 뒤 [저장]을 눌러 보세요.
        </p>
      ) : (
        groups.map((group) => {
          const dayTotal = group.items.reduce((sum, r) => sum + r.seconds, 0);
          return (
            <section key={group.date} className="mt-6">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-bold text-navy-900">{dateLabel(group.date)}</h3>
                <span className="text-xs text-navy-500">합계 {formatShort(dayTotal)}</span>
              </div>
              <ul className="mt-2 divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white">
                {group.items.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy-900">
                        {r.subject}
                        <span className="ml-2 text-xs font-normal text-navy-400">
                          {clockLabel(r.savedAt)}
                        </span>
                      </p>
                      {r.memo && (
                        <p className="mt-0.5 break-words text-sm text-navy-500">{r.memo}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums text-navy-900">
                        {formatTime(r.seconds)}
                      </p>
                      <button
                        onClick={() => setDeleteId(r.id)}
                        className="mt-1 text-xs text-navy-400"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      {/* 삭제 확인 창 */}
      {target && (
        <Modal title="기록을 삭제할까요?" onClose={() => setDeleteId(null)}>
          <p className="text-sm leading-relaxed text-navy-600">
            {target.subject} {formatTime(target.seconds)} 기록이 사라지고,
            <br />
            랭킹 시간에서도 빠져요.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setDeleteId(null)}
              className="rounded-xl bg-navy-50 py-2.5 text-sm font-semibold text-navy-700"
            >
              취소
            </button>
            <button
              onClick={() => {
                onDelete(target.id);
                setDeleteId(null);
              }}
              className="rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white"
            >
              삭제
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}