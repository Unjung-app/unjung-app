"use client";

// [타이머] 탭: 과목 추가, 과목별 시작·일시정지·저장·초기화·삭제

import { useState } from "react";
import Modal from "./Modal";
import { formatTime } from "../_utils";

const btnGray = "rounded-xl bg-navy-50 py-2.5 text-sm font-semibold text-navy-700";
const btnDark = "rounded-xl bg-navy-900 py-2.5 text-sm font-semibold text-white";
const btnRed = "rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white";

export default function TimerTab({
  subjects,
  running,
  now,
  todaySeconds,
  onAdd,
  onStart,
  onPause,
  onSave,
  onReset,
  onDelete,
}) {
  const [name, setName] = useState("");
  const [modal, setModal] = useState(null); // { type: "save" | "reset" | "delete", id }
  const [memo, setMemo] = useState("");

  // 이 과목에 쌓인 시간(초). 돌아가는 중이면 흐르는 시간까지 더해요.
  function secondsOf(subject) {
    let ms = subject.elapsedMs;
    if (running && running.id === subject.id) {
      ms += Math.max(0, now - running.startedAt);
    }
    return Math.floor(ms / 1000);
  }

  function handleAdd(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
  }

  function openModal(type, id) {
    setMemo("");
    setModal({ type, id });
  }

  function closeModal() {
    setModal(null);
  }

  const target = modal ? subjects.find((s) => s.id === modal.id) : null;
  const runningSubject = running ? subjects.find((s) => s.id === running.id) : null;

  return (
    <div>
      {/* 오늘 요약 */}
      <div className="rounded-2xl bg-navy-900 p-5 text-white">
        <p className="text-sm text-navy-200">오늘 저장한 공부 시간</p>
        <p className="mt-1 font-mono text-4xl font-bold tabular-nums">
          {formatTime(todaySeconds)}
        </p>
        <div className="mt-3 text-sm text-navy-200">
          {runningSubject ? (
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              {runningSubject.name} 공부 중
            </span>
          ) : (
            "타이머가 멈춰 있어요"
          )}
        </div>
      </div>

      {/* 과목 추가 */}
      <form onSubmit={handleAdd} className="mt-5 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={15}
          placeholder="과목 이름 (예: 수학)"
          className="min-w-0 flex-1 rounded-xl border border-navy-200 bg-white px-4 py-3 text-base text-navy-900 outline-none focus:border-navy-500"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-xl bg-navy-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          추가
        </button>
      </form>

      {/* 과목 목록 */}
      {subjects.length === 0 ? (
        <p className="mt-5 rounded-xl bg-navy-50 p-4 text-center text-sm leading-relaxed text-navy-600">
          아직 과목이 없어요.
          <br />
          위에 과목 이름을 적고 [추가]를 눌러 보세요.
        </p>
      ) : (
        <>
          <ul className="mt-5 space-y-3">
            {subjects.map((s) => {
              const isRunning = running?.id === s.id;
              const secs = secondsOf(s);
              return (
                <li
                  key={s.id}
                  className={`rounded-2xl border p-4 ${
                    isRunning ? "border-emerald-400 bg-emerald-50" : "border-navy-100 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-navy-900">{s.name}</p>
                    <button
                      onClick={() => openModal("delete", s.id)}
                      className="text-xs text-navy-400"
                    >
                      삭제
                    </button>
                  </div>

                  <p
                    className={`mt-1 font-mono text-3xl font-bold tabular-nums ${
                      isRunning ? "text-emerald-700" : "text-navy-900"
                    }`}
                  >
                    {formatTime(secs)}
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {isRunning ? (
                      <button
                        onClick={onPause}
                        className="rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white"
                      >
                        일시정지
                      </button>
                    ) : (
                      <button
                        onClick={() => onStart(s.id)}
                        className="rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white"
                      >
                        {secs > 0 ? "계속" : "시작"}
                      </button>
                    )}
                    <button
                      onClick={() => openModal("save", s.id)}
                      disabled={secs < 1}
                      className={`${btnDark} disabled:opacity-30`}
                    >
                      저장
                    </button>
                    <button
                      onClick={() => openModal("reset", s.id)}
                      disabled={secs < 1}
                      className={`${btnGray} disabled:opacity-40`}
                    >
                      초기화
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-navy-400">
            한 번에 한 과목만 잴 수 있어요. 다른 과목을 시작하면 지금 과목은 자동으로 멈춰요.
          </p>
        </>
      )}

      {/* 저장 창 */}
      {modal?.type === "save" && target && (
        <Modal title="기록 저장" onClose={closeModal}>
          <p className="text-sm text-navy-600">
            {target.name} ·{" "}
            <span className="font-mono font-semibold text-navy-900">
              {formatTime(secondsOf(target))}
            </span>
          </p>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={100}
            rows={3}
            placeholder="메모 (안 써도 돼요) 예: 문제집 3단원 끝!"
            className="mt-3 w-full resize-none rounded-xl border border-navy-200 px-3 py-2 text-base text-navy-900 outline-none focus:border-navy-500"
          />
          <p className="mt-1 text-xs text-navy-400">저장하면 이 과목 타이머는 0으로 돌아가요.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={closeModal} className={btnGray}>
              취소
            </button>
            <button
              onClick={() => {
                onSave(target.id, memo);
                closeModal();
              }}
              className={btnDark}
            >
              저장
            </button>
          </div>
        </Modal>
      )}

      {/* 초기화 확인 창 */}
      {modal?.type === "reset" && target && (
        <Modal title="타이머를 초기화할까요?" onClose={closeModal}>
          <p className="text-sm leading-relaxed text-navy-600">
            {target.name}의 {formatTime(secondsOf(target))}이(가) 0이 돼요.
            <br />
            저장하지 않은 시간은 사라져요.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={closeModal} className={btnGray}>
              취소
            </button>
            <button
              onClick={() => {
                onReset(target.id);
                closeModal();
              }}
              className={btnRed}
            >
              초기화
            </button>
          </div>
        </Modal>
      )}

      {/* 삭제 확인 창 */}
      {modal?.type === "delete" && target && (
        <Modal title="과목을 삭제할까요?" onClose={closeModal}>
          <p className="text-sm leading-relaxed text-navy-600">
            [{target.name}] 과목이 목록에서 사라져요.
            {secondsOf(target) > 0 && " 저장하지 않은 시간도 사라져요."}
            <br />
            이미 저장한 기록은 [기록] 탭에 그대로 남아요.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={closeModal} className={btnGray}>
              취소
            </button>
            <button
              onClick={() => {
                onDelete(target.id);
                closeModal();
              }}
              className={btnRed}
            >
              삭제
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}