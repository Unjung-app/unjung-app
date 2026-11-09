/**
 * 학생 게임 HTML에 '앱 연결 코드'를 자동으로 넣는다.
 * 개발자는 원본 HTML을 그대로 만들고, 점수만 UnjungGame.submitScore(n) 한 줄로 보낸다.
 *  · 예전에 손으로 넣은 연결 코드(표시 주석 사이)는 빼고 최신 코드로 바꾼다.
 *  · localStorage → 앱 계정 저장으로 바꿔 준다(게임 코드 수정 없이 이어하기).
 *  · alert/confirm/prompt(앱 안에서는 막힘) → 게임 화면 안의 안내로 바꾼다.
 */

const OLD_BRIDGE = /\/\*\s*=+\s*앱 연결 코드[\s\S]*?앱 연결 코드 끝\s*=*\s*\*\//g;

export function stripOldBridge(html: string) {
  return html.replace(OLD_BRIDGE, '/* (앱이 연결 코드를 자동으로 넣어요) */');
}

/** 게임 안에서 돌 연결 코드. ls: 지난번 localStorage 내용 */
function bridgeScript(ls: Record<string, string>, player: { nickname: string; grade: number | null }) {
  const init = JSON.stringify({ ls, player }).replace(/</g, '\\u003c');
  return `(function () {
  var INIT = ${init};
  var listeners = { pause: [] }, seq = 0, waiting = {};
  function ask(type, data) {
    return new Promise(function (resolve) { var id = ++seq; waiting[id] = resolve; parent.postMessage({ unjung: 1, id: id, type: type, data: data }, '*');
      setTimeout(function () { if (waiting[id]) { delete waiting[id]; resolve(null); } }, 8000); });
  }
  addEventListener('message', function (e) {
    var m = e.data; if (!m || m.unjung !== 1) return;
    if (m.reply && waiting[m.reply]) { waiting[m.reply](m.data); delete waiting[m.reply]; }
    if (m.type === 'player') Object.assign(api.player, m.data || {});
    if (m.type === 'pause') listeners.pause.forEach(function (f) { try { f(); } catch (x) {} });
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) listeners.pause.forEach(function (f) { try { f(); } catch (x) {} }); });
  var api = {
    inApp: true,
    player: INIT.player,
    submitScore: function (n, opts) { n = Math.max(0, Math.floor(Number(n) || 0)); return ask('score', { score: n, hold: !!(opts && opts.hold) }).then(function (r) { return r || { best: n }; }); },
    save: function (obj) { var s = JSON.stringify(obj === undefined ? null : obj); if (s.length > 10000) return Promise.reject(new Error('저장 데이터가 너무 커요(10KB까지)')); return ask('save', s); },
    load: function () { return ask('load').then(function (s) { try { return s ? JSON.parse(s) : null; } catch (x) { return null; } }); },
    onPause: function (fn) { listeners.pause.push(fn); },
    exit: function () { ask('exit'); },
    done: function () { ask('done'); },
    getStudyMinutes: function () { return ask('study').then(function (m) { return Math.max(0, Math.floor(Number(m) || 0)); }); }
  };
  window.UnjungGame = api;

  // localStorage 대신: 앱 계정에 저장(게임마다 50KB까지)
  var mem = Object.assign({}, INIT.ls || {}), t = 0;
  function flush() { t = 0; ask('lsave', JSON.stringify(mem)); }
  function later() { if (!t) t = setTimeout(flush, 1200); }
  var store = {
    getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[String(k)] = String(v); later(); },
    removeItem: function (k) { delete mem[String(k)]; later(); },
    clear: function () { mem = {}; later(); },
    key: function (i) { var ks = Object.keys(mem); return i < ks.length ? ks[i] : null; },
    get length() { return Object.keys(mem).length; }
  };
  try { Object.defineProperty(window, 'localStorage', { value: store, configurable: true }); } catch (x) {}
  try { Object.defineProperty(window, 'sessionStorage', { value: store, configurable: true }); } catch (x) {}
  addEventListener('pagehide', function () { if (t) { clearTimeout(t); flush(); } });

  // alert·confirm·prompt: 앱 안에서는 막혀 있어서 화면 안 안내로 바꾼다(confirm은 '예', prompt는 기본값)
  function toast(msg) {
    var d = document.createElement('div');
    d.textContent = String(msg == null ? '' : msg);
    d.style.cssText = 'position:fixed;left:50%;top:18px;transform:translateX(-50%);max-width:86%;z-index:2147483647;background:rgba(20,24,34,.92);color:#fff;padding:10px 14px;border-radius:12px;font:14px/1.45 system-ui,sans-serif;white-space:pre-line;text-align:center';
    (document.body || document.documentElement).appendChild(d);
    setTimeout(function () { d.remove(); }, 2600);
  }
  window.alert = function (m) { toast(m); };
  window.confirm = function (m) { toast(m); return true; };
  window.prompt = function (m, def) { toast(m); return def == null ? '' : String(def); };
  window.open = function () { return null; };

  ask('ready');
})();`;
}

export function buildGameDoc(html: string, opts: { ls?: Record<string, string>; base?: string; player?: { nickname: string; grade: number | null } }) {
  const clean = stripOldBridge(html);
  // 게임은 인터넷 통신·폼 전송을 못 하게 막는다(예전 /games 보안 설정과 같게)
  const csp = `<meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'">`;
  const tag = `${csp}${opts.base ? `<base href="${opts.base}">` : ''}<script>${bridgeScript(opts.ls ?? {}, opts.player ?? { nickname: '', grade: null })}</script>`;
  // 게임 코드보다 먼저 실행되도록 <head> 바로 뒤(없으면 맨 앞)에 넣는다
  if (/<head[^>]*>/i.test(clean)) return clean.replace(/<head[^>]*>/i, (m) => m + tag);
  if (/<html[^>]*>/i.test(clean)) return clean.replace(/<html[^>]*>/i, (m) => m + '<head>' + tag + '</head>');
  return tag + clean;
}

export type CheckItem = { ok: boolean; warn?: boolean; text: string };

/** 제출 전 자동 점검(개발자에게 보여 줌) */
export function checkGame(html: string): CheckItem[] {
  const out: CheckItem[] = [];
  const kb = Math.round(html.length / 1024);
  out.push({ ok: html.length <= 3_000_000, text: `파일 크기 ${kb}KB ${html.length <= 3_000_000 ? '(3MB까지 OK)' : '— 3MB를 넘어요. 그림을 줄여 주세요'}` });
  out.push({ ok: /<script[\s>]/i.test(html) && /<\/html>|<\/body>|<\/script>/i.test(html), text: /<\/html>/i.test(html) ? 'HTML 전체가 들어왔어요' : '끝부분(</html>)이 안 보여요. 코드를 끝까지 복사했는지 확인하세요' });
  const score = /UnjungGame\s*\.\s*submitScore\s*\(/.test(html);
  out.push({ ok: score, warn: !score, text: score ? '점수 보내기 코드가 있어요' : '점수 보내기 코드가 없어요 — 점수·토큰 보상 없이 플레이만 돼요' });
  const ext = html.match(/<(script|link|img|audio|video|source)[^>]+(src|href)\s*=\s*["']https?:\/\/[^"']+/gi) ?? [];
  out.push({ ok: ext.length === 0, warn: ext.length > 0, text: ext.length ? `외부 사이트 파일 ${ext.length}개 — 학교 와이파이·앱에서 막힐 수 있어요` : '외부 사이트 파일 없음' });
  if (/\b(fetch|XMLHttpRequest|WebSocket)\b/.test(html)) out.push({ ok: false, warn: true, text: '인터넷 통신 코드가 있어요 — 앱 안에서는 동작하지 않을 수 있어요' });
  if (/\b(alert|confirm|prompt)\s*\(/.test(html)) out.push({ ok: true, warn: true, text: 'alert·confirm 창은 앱이 화면 안 안내로 바꿔 줘요(confirm은 항상 "예")' });
  return out;
}
