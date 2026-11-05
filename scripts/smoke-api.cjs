// Vercel 빌드 결과물(.vercel/output)의 서버 함수를 실제로 불러와 실행해 보는 검사. NEIS는 가짜 응답으로 대체.
// load each built function and call GET with NEIS mocked (container can't reach NEIS)
globalThis.fetch = async (url) => {
  const svc = new URL(url).pathname.split('/').pop();
  const wrap = (row) => ({ [svc]: [{ head: [{ list_total_count: row.length }, { RESULT: { CODE: 'INFO-000' } }] }, { row }] });
  const body = svc === 'schoolInfo' ? wrap([{ SCHUL_NM: '운중고등학교', SD_SCHUL_CODE: '7531999' }]) : svc === 'mealServiceDietInfo' ? wrap([{ MMEAL_SC_CODE: '2', MLSV_YMD: '20261026', DDISH_NM: '현미밥<br/>닭강정 (1.5)', CAL_INFO: '812.3 Kcal' }]) : { RESULT: { CODE: 'INFO-200' } };
  return new Response(JSON.stringify(body));
};
(async () => {
  for (const [f, q] of [['health', ''], ['meal', '?from=20261026&to=20261030'], ['timetable', '?grade=2&class=8&from=20261026&to=20261030'], ['schedule', '?from=20261026&to=20261231']]) {
    try {
      const m = require(require("path").resolve(process.argv[2], `${f}.func/api/${f}.js`));
      const r = await m.GET(new Request('https://x/api/' + f + q));
      const body = await r.text();
      console.log(f, r.status, body.slice(0, 140));
      if (r.status !== 200) process.exitCode = 1;
    } catch (e) { console.log(f, 'FAIL', e.code, e.message.split('\n')[0]); process.exitCode = 1; }
  }
})();
