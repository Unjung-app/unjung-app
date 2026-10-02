
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const GAME_WIDTH = 360;
const GAME_HEIGHT = 560;
const BIRD_X = 88;
const BIRD_SIZE = 30;
const PIPE_WIDTH = 58;
const PIPE_GAP = 158;
const GRAVITY = 0.34;
const FLAP_POWER = -6.2;
const PIPE_SPEED = 2.5;

function createPipe(x) {
  const gapY = 130 + Math.random() * 250;

  return {
    x,
    gapY,
    passed: false,
    id: `${Date.now()}-${Math.random()}`,
  };
}

export default function QuizPage() {
  const router = useRouter();
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const gameRef = useRef(null);
  const [gameState, setGameState] = useState("ready");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);

  const resetGame = useCallback(() => {
    gameRef.current = {
      birdY: GAME_HEIGHT * 0.43,
      velocity: 0,
      pipes: [createPipe(270), createPipe(490)],
      score: 0,
      started: false,
      ended: false,
      lastTime: 0,
    };

    setScore(0);
    setGameState("ready");
  }, []);

  const flap = useCallback(() => {
    const game = gameRef.current;
    if (!game || game.ended) return;

    if (!game.started) {
      game.started = true;
      setGameState("playing");
    }

    game.velocity = FLAP_POWER;
  }, []);

  useEffect(() => {
    resetGame();

    try {
      const saved = Number(localStorage.getItem("quiz-flappy-best") || 0);
      setBestScore(saved);
    } catch {
      // 점수 저장이 안 되는 환경에서도 게임은 실행돼요.
    }
  }, [resetGame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId;
    let lastFrame = 0;

    function draw(time) {
      const game = gameRef.current;
      if (!game) {
        animationId = requestAnimationFrame(draw);
        return;
      }

      const dt = lastFrame ? Math.min((time - lastFrame) / 16.67, 2) : 1;
      lastFrame = time;

      const w = GAME_WIDTH;
      const h = GAME_HEIGHT;

      // 하늘과 부드러운 배경
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#d9f3ff");
      sky.addColorStop(1, "#f0fbff");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // 햇빛
      const sun = ctx.createRadialGradient(285, 75, 4, 285, 75, 65);
      sun.addColorStop(0, "rgba(255,255,255,0.9)");
      sun.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(210, 0, 150, 145);

      // 구름
      function drawCloud(x, y, scale) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.arc(0, 10, 17, 0, Math.PI * 2);
        ctx.arc(20, 0, 23, 0, Math.PI * 2);
        ctx.arc(43, 11, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      drawCloud(35, 90, 0.8);
      drawCloud(205, 180, 0.65);
      drawCloud(90, 300, 0.6);

      if (game.started && !game.ended) {
        game.velocity += GRAVITY * dt;
        game.birdY += game.velocity * dt;

        for (const pipe of game.pipes) {
          pipe.x -= PIPE_SPEED * dt;

          if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
            pipe.passed = true;
            game.score += 1;
            setScore(game.score);
          }

          const birdLeft = BIRD_X - BIRD_SIZE / 2;
          const birdRight = BIRD_X + BIRD_SIZE / 2;
          const birdTop = game.birdY - BIRD_SIZE / 2;
          const birdBottom = game.birdY + BIRD_SIZE / 2;

          const overlapsX =
            birdRight > pipe.x && birdLeft < pipe.x + PIPE_WIDTH;

          if (
            overlapsX &&
            (birdTop < pipe.gapY - PIPE_GAP / 2 ||
              birdBottom > pipe.gapY + PIPE_GAP / 2)
          ) {
            game.ended = true;
          }
        }

        game.pipes = game.pipes.filter(
          (pipe) => pipe.x > -PIPE_WIDTH - 10
        );

        if (
          game.pipes.length === 0 ||
          game.pipes[game.pipes.length - 1].x < w - 190
        ) {
          game.pipes.push(createPipe(w + 20));
        }

        if (
          game.birdY - BIRD_SIZE / 2 < 0 ||
          game.birdY + BIRD_SIZE / 2 > h - 35
        ) {
          game.ended = true;
        }

        if (game.ended) {
          setGameState("over");
          setBestScore((previous) => {
            const next = Math.max(previous, game.score);

            try {
              localStorage.setItem("quiz-flappy-best", String(next));
            } catch {
              // 브라우저 저장 기능을 사용할 수 없어도 계속 플레이할 수 있어요.
            }

            return next;
          });
        }
      }

      // 바닥
      ctx.fillStyle = "#b9e7b2";
      ctx.fillRect(0, h - 35, w, 35);
      ctx.fillStyle = "#86d28d";
      ctx.fillRect(0, h - 35, w, 5);

      // 장애물 그리기
      for (const pipe of game.pipes) {
        const topHeight = pipe.gapY - PIPE_GAP / 2;
        const bottomY = pipe.gapY + PIPE_GAP / 2;

        function drawPipeBody(x, y, width, height, upsideDown) {
          if (height <= 0) return;

          const gradient = ctx.createLinearGradient(x, 0, x + width, 0);
          gradient.addColorStop(0, "#159c74");
          gradient.addColorStop(0.45, "#42d6a0");
          gradient.addColorStop(1, "#0d966e");

          ctx.fillStyle = gradient;
          ctx.fillRect(x + 5, y, width - 10, height);

          ctx.fillStyle = "#39c995";
          ctx.fillRect(x, upsideDown ? y + height - 20 : y, width, 20);

          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(x + 10, y + (upsideDown ? height - 18 : 5), 5, Math.max(0, height - 25));
        }

        drawPipeBody(pipe.x, 0, PIPE_WIDTH, topHeight, true);
        drawPipeBody(pipe.x, bottomY, PIPE_WIDTH, h - 35 - bottomY, false);
      }

      // 새 그림자
      ctx.save();
      ctx.translate(BIRD_X, game.birdY + 4);
      ctx.fillStyle = "rgba(40,100,130,0.13)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 귀여운 새
      ctx.save();
      ctx.translate(BIRD_X, game.birdY);
      const tilt = game.started
        ? Math.max(-0.35, Math.min(0.65, game.velocity * 0.07))
        : Math.sin(time / 250) * 0.06;
      ctx.rotate(tilt);

      ctx.fillStyle = "#ffca5c";
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffe29a";
      ctx.beginPath();
      ctx.ellipse(-4, 5, 9, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f5ad36";
      ctx.beginPath();
      ctx.ellipse(-7, 4, 7, 5, -0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(7, -5, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#27374d";
      ctx.beginPath();
      ctx.arc(9, -5, 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ff8b5c";
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.lineTo(23, 3);
      ctx.lineTo(13, 6);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // 점수
      if (game.started && !game.ended) {
        ctx.save();
        ctx.font = "800 32px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.strokeText(String(game.score), w / 2, 55);
        ctx.fillStyle = "#244765";
        ctx.fillText(String(game.score), w / 2, 55);
        ctx.restore();
      }

      animationId = requestAnimationFrame(draw);
    }

    animationId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animationId);
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        if (gameState !== "over") flap();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flap, gameState]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[480px] bg-slate-50 px-5 pb-8 pt-6 text-slate-800">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-emerald-600">
            SMART CAMPUS ARCADE
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">
            플러피 버드
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            장애물 사이를 날아가며 기록을 세워 봐!
          </p>
        </div>
        <div className="rounded-2xl bg-white px-3 py-2 text-center shadow-sm ring-1 ring-slate-100">
          <p className="text-[10px] font-bold text-slate-400">최고 점수</p>
          <p className="text-xl font-black text-emerald-600">{bestScore}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[28px] bg-sky-100 shadow-lg shadow-sky-900/10 ring-1 ring-white">
        <div
          className="relative touch-manipulation"
          onPointerDown={() => {
            if (gameState !== "over") flap();
          }}
          role="button"
          tabIndex={0}
          aria-label="게임 화면. 누르면 새가 날아오릅니다."
        >
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="block h-auto w-full select-none"
          />

          {gameState === "ready" && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 p-6">
              <div className="w-full rounded-3xl bg-white/95 p-6 text-center shadow-xl backdrop-blur-sm">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-3xl">
                  🐤
                </div>
                <h2 className="text-xl font-black">날아오를 준비 됐니?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  화면을 누르거나 스페이스바를 눌러
                  <br />
                  초록색 장애물을 피해 봐!
                </p>
                <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  화면을 눌러 시작하기
                </div>
              </div>
            </div>
          )}

          {gameState === "over" && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 p-6">
              <div
                className="w-full rounded-3xl bg-white p-6 text-center shadow-2xl"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-3xl">
                  🪽
                </div>
                <p className="text-xs font-extrabold tracking-[0.2em] text-orange-500">
                  GAME OVER
                </p>
                <h2 className="mt-2 text-2xl font-black">비행 종료!</h2>
                <p className="mt-2 text-sm text-slate-500">
                  도전해 줘서 고마워. 다시 기록에 도전해 봐!
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-sky-50 p-4">
                    <p className="text-xs font-bold text-slate-400">이번 점수</p>
                    <p className="mt-1 text-3xl font-black text-sky-700">
                      {score}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-xs font-bold text-slate-400">최고 점수</p>
                    <p className="mt-1 text-3xl font-black text-emerald-700">
                      {bestScore}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetGame}
                  className="mt-5 w-full rounded-2xl bg-emerald-500 px-4 py-4 font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-600 active:scale-[0.98]"
                >
                  ↻ 다시 시작
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  끝내기 · 앱 첫 화면
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-semibold text-slate-400">현재 점수</p>
          <p className="mt-1 text-2xl font-black">{score}점</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-semibold text-slate-400">조작 방법</p>
          <p className="mt-1 text-sm font-bold">화면 터치 · 스페이스바</p>
        </div>
      </div>

      <p className="mt-5 text-center text-xs leading-5 text-slate-400">
        기록은 이 브라우저에 저장돼요.
        <br />
        무리하지 말고 즐겁게 플레이해 봐!
      </p>
    </main>
  );
}