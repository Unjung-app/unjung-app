import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile = (file, require = () => { throw Error('unexpected import'); }) => {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, require, Date, Intl });
  return module.exports;
};
const date = compile('src/lib/date.ts');
const { personalize, completeChoices } = compile('src/features/timetable/personal.ts', name => {
  assert.equal(name, '@/lib/date'); return date;
});
const sql = fs.readFileSync('supabase/migrations/20261114000000_personal_timetable.sql','utf8');
const groups = JSON.parse(sql.split('$config$')[1]);
const choices = Object.fromEntries(groups.map(g => [g.id,g.subjects[0]]));
assert.ok(completeChoices(groups, choices));
assert.ok(!completeChoices(groups, {...choices,art:''}));
const general = [[[1,4],[2,4],[4,3]],[[1,3],[3,3],[5,1]],...Array(3).fill([[2,1],[3,1],[4,2]]),...Array(2).fill([[1,1],[2,3],[5,4]]),[[1,6],[4,6],[5,2]]];
const art = [...Array(2).fill([[1,6],[3,1]]),...Array(2).fill([[1,1],[2,7]]),...Array(2).fill([[2,4],[5,2]]),...Array(2).fill([[1,7],[2,6]])];
for (let c=1;c<=8;c++) {
  const lessons = Array.from({length:35},(_,i)=>({date:date.addDays('20261102',Math.floor(i/7)),period:i%7+1,subject:'기본',room:'원래 교실',tags:[]}));
  const result = personalize(lessons,groups,choices,c,2026,2);
  for (const [id,slots] of [['general',general[c-1]],['art',art[c-1]]]) for (const [day,period] of slots) {
    const row = result.find(l=>date.dayOfWeek(l.date)===day && l.period===period);
    assert.equal(row.subject,choices[id]); assert.equal(row.room,null);
  }
  assert.equal(result.filter(l=>l.subject!=='기본').length,17);
  assert.ok(lessons.every(l=>l.subject==='기본'));
}
const exceptional = [{date:'20261102',period:2,subject:'행사',room:null,tags:[]},{date:'20261102',period:2,subject:'보강 과목',room:null,tags:['보강']},{date:'20260803',period:2,subject:'이전 학기',room:null,tags:[]}];
assert.equal(JSON.stringify(personalize(exceptional,groups,choices,1,2026,2)),JSON.stringify(exceptional));
assert.equal(personalize([],groups,choices,1,2026,2).length,0);
console.log('8개 반 배치·원본 보존·특별활동·학기 구분 검사 통과');

// 홈과 시간표가 같은 계정 선택을 공유하고, 저장 성공 후 즉시 갱신되는지 확인한다.
const effects = [];
let notifications = 0;
let failSave = false;
const stored = new Map([['student-a', choices]]);
const fakeSupabase = {
  from(table) {
    const filters = {};
    const query = {
      select() { return query; },
      eq(k,v) { filters[k]=v; return query; },
      async maybeSingle() {
        return { data: table === 'timetable_configs' ? { groups } : stored.has(filters.user_id) ? { choices: stored.get(filters.user_id) } : null, error: null };
      },
    };
    return query;
  },
  async rpc(_name,args) {
    if (failSave) return {error:new Error('offline')};
    stored.set('student-a',args.p_choices); return {error:null};
  },
};
const {useSubjectSelection} = compile('src/features/timetable/selection.ts', name => {
  if (name === 'react') return {
    useCallback(fn) { return fn; },
    useEffect(effect) { effects.push(effect); },
    useSyncExternalStore(subscribe,get) { subscribe(()=>notifications++); return get(); },
  };
  if (name === '@/lib/supabase') return {supabase:fakeSupabase};
  if (name === './personal') return {completeChoices};
  throw Error(name);
});
assert.ok(useSubjectSelection('student-a',2026,2).loading);
const load = effects.shift(); load();
await new Promise(resolve=>setTimeout(resolve,0));
const homeSelection = useSubjectSelection('student-a',2026,2);
assert.equal(JSON.stringify(homeSelection.saved),JSON.stringify(choices));
const changed = {...choices,art:'미술'};
await homeSelection.save(changed);
assert.equal(useSubjectSelection('student-a',2026,2).saved.art,'미술');
assert.ok(notifications>0);
assert.equal(useSubjectSelection('student-b',2026,2).saved,null);
assert.equal(useSubjectSelection(null,2026,2).saved,null);
assert.equal(useSubjectSelection('student-a',2027,1).saved,null);
failSave = true;
await assert.rejects(homeSelection.save({...choices,art:'음악'}));
assert.equal(useSubjectSelection('student-a',2026,2).saved.art,'미술');
console.log('홈·시간표 선택 공유, 저장 즉시 반영, 계정·학기 격리, 저장 실패 보존 검사 통과');
