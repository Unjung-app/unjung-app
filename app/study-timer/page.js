"use client";

// 'unjung study timer' 첫 화면이에요.
// 위쪽 탭: 타이머 | 기록 | 랭킹
// 내 과목과 기록은 이 휴대폰(localStorage)에 저장돼요.

import { useEffect, useState } from "react";
import TimerTab from "./_components/TimerTab";
import RecordTab from "./_components/RecordTab";
import RankingTab from "./_components/RankingTab";
import { makeId, todayKey } from "./_utils";

const STORAGE_KEY = "unjung-study-timer";

const TABS = [
  { id: "timer", label: "타이머" },
  { id: "record", label: "기록" },
  { id: "ranking", label: "랭킹" },
];

export default function Page() {
  const [tab, setTab] = useState("timer");
  const [subjects, setSubjects] = useState([]); // [{ id, name, elapsedMs }]
  const [running, setRunning] = useState(null); // { id, startedAt } 또는 null
  const [records, setRecords] = useState([]); // [{ id, subject, seconds, memo, date, savedAt }]
  const [now, setNow] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // 1) 처음 열 때: 저장해 둔 데이터 불러오기
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) {
        setSubjects(Array.isArray(saved.subjects) ? saved.subjects : []);
        setRunning(saved.running ?? null);
        setRecords(Array.isArray(saved.records) ? saved.records : []);
      }
    } catch (e) {
      // 불러오기에 실패해도 빈 상태로 시작해요.
    }
    setNow(Date.now());
    setLoaded(true);
  }, []);

  // 2) 무언가 바뀔 때마다 저장하기
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ subjects, running, records }));
    } catch (e) {
      // 저장에 실패해도 화면은 계속 쓸 수 있어요.
    }
  }, [subjects, running, records, loaded]);

  // 3) 1초마다 시계 갱신 (타이머 숫자가 움직이게)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 돌아가던 타이머를 멈추고, 흐른 시간을 그 과목에 더한 새 목록을 돌려줘요.
  function pausedList() {
    if (!running) return subjects;
    const passed = Date.now() - running.startedAt;
    return subjects.map((s) =>
      s.id === running.id ? { ...s, elapsedMs: s.elapsedMs + passed } : s
    );
  }

  function addSubject(name) {
    setSubjects([...subjects, { id: makeId(), name, elapsedMs: 0 }]);
  }

  function startSubject(id) {
    setSubjects(pausedList()); // 다른 과목이 돌고 있었다면 먼저 멈춰요
    setRunning({ id, startedAt: Date.now() });
    setNow(Date.now());
  }

  function pauseSubject() {
    setSubjects(pausedList());
    setRunning(null);
  }

  function resetSubject(id) {
    setSubjects(subjects.map((s) => (s.id === id ? { ...s, elapsedMs: 0 } : s)));
    if (running?.id === id) setRunning(null);
  }

  function deleteSubject(id) {
    setSubjects(subjects.filter((s) => s.id !== id));
    if (running?.id === id) setRunning(null);
  }

  function saveSubject(id, memo) {
    const subject = subjects.find((s) => s.id === id);
    if (!subject) return;

    let ms = subject.elapsedMs;
    if (running?.id === id) ms += Date.now() - running.startedAt;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 1) return;

    const record = {
      id: makeId(),
      subject: subject.name,
      seconds,
      memo: memo.trim(),
      date: todayKey(),
      savedAt: Date.now(),
    };
    setRecords([record, ...records]);
    setSubjects(subjects.map((s) => (s.id === id ? { ...s, elapsedMs: 0 } : s)));
    if (running?.id === id) setRunning(null);
  }

  function deleteRecord(id) {
    setRecords(records.filter((r) => r.id !== id));
  }

  // 랭킹·요약에 쓰는 내 시간(저장한 기록 기준)
  const today = todayKey();
  const myTodaySeconds = records
    .filter((r) => r.date === today)
    .reduce((sum, r) => sum + r.seconds, 0);
  const myTotalSeconds = records.reduce((sum, r) => sum + r.seconds, 0);

  return (
    <div className="px-5 pb-10 pt-6">
      <h2 className="text-xl font-bold text-navy-900">⏱️ unjung study timer</h2>

      {/* 위쪽 탭 버튼 */}
      <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-navy-50 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-white text-navy-900 shadow-sm" : "text-navy-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {!loaded ? (
          <p className="py-10 text-center text-sm text-navy-400">불러오는 중…</p>
        ) : tab === "timer" ? (
          <TimerTab
            subjects={subjects}
            running={running}
            now={now}
            todaySeconds={myTodaySeconds}
            onAdd={addSubject}
            onStart={startSubject}
            onPause={pauseSubject}
            onSave={saveSubject}
            onReset={resetSubject}
            onDelete={deleteSubject}
          />
        ) : tab === "record" ? (
          <RecordTab records={records} onDelete={deleteRecord} />
        ) : (
          <RankingTab myTodaySeconds={myTodaySeconds} myTotalSeconds={myTotalSeconds} now={now} />
        )}
      </div>
    </div>
  );
}