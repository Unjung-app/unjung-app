"use client";

// 화면 가운데에 뜨는 확인 창이에요.
// 바깥(어두운 부분)을 누르면 닫혀요.

export default function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-navy-900">{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}