import {describe,it,expect} from 'vitest';
import {ArcadeSession,arcadeSaveKey,arcadeRecordsKey,readArcadeSave,readArcadeRecords,roundLimit,type ArcadeStorage} from './arcade';
import {chooseTask,initialBoard,legalOperations,projectionKey,shapeKey,taskGroups} from './arcade-generator';
import {identity,type Vec} from './math';
import {connected} from './connectivity';
import {matches,project} from './projections';

class Memory implements ArcadeStorage {data=new Map<string,string>();getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,v);}}
const fixture=(seed=17)=>{let t=0;const storage=new Memory(),now=()=>t,session=ArcadeSession.create(seed,storage,now);session.resume();return {session,storage,now,advance:(ms:number)=>{t+=ms;}};};
const solutions=(s:ArcadeSession)=>legalOperations(s.state.fixed,s.puzzle.placed).filter(op=>matches(op.targets,s.state.targets));
const wrong=(s:ArcadeSession)=>legalOperations(s.state.fixed,s.puzzle.placed).find(op=>!matches(op.targets,s.state.targets))!;
const solve=(s:ArcadeSession)=>{const op=solutions(s)[0];expect(op).toBeDefined();return s.act(op.tool,op.cell);};

describe('one-action endless generator',()=>{
 it('starts with seven face-connected cubes and a connected immutable foundation',()=>{
  for(let seed=1;seed<=50;seed++){const s=ArcadeSession.create(seed);expect(s.puzzle.cells).toHaveLength(7);expect(connected([s.state.fixed[0]],s.state.fixed.slice(1))).toBe(true);expect(connected(s.state.fixed,s.puzzle.placed)).toBe(true);expect(solutions(s).length).toBeGreaterThan(0);expect(s.puzzle.won).toBe(false);}
 });
 it('only creates different, single-legal-action silhouette pairs',()=>{
  const {session:s}=fixture();for(let i=0;i<200;i++){const before=structuredClone(s.puzzle.cells);expect(matches(s.puzzle.projections,s.state.targets)).toBe(false);const op=solutions(s)[0];expect(s.act(op.tool,op.cell)).toBe('correct');expect(Math.abs(s.puzzle.cells.length-before.length)).toBe(1);expect(s.puzzle.cells).toEqual(expect.arrayContaining(s.state.fixed));expect(connected(s.state.fixed,s.puzzle.placed)).toBe(true);expect(s.state.round).toBe(i+2);}
 });
 it('accepts every alternative operation giving the same silhouettes',()=>{
  const {session:s}=fixture();let alternatives=taskGroups(s.state.fixed,s.puzzle.placed).find(g=>g.length>1);
  for(let i=0;!alternatives&&i<100;i++){solve(s);alternatives=taskGroups(s.state.fixed,s.puzzle.placed).find(g=>g.length>1);}
  expect(alternatives).toBeDefined();
  for(const op of alternatives!){const data=structuredClone({...s.state,placed:s.puzzle.placed,targets:alternatives![0].targets});const copy=new ArcadeSession(data);copy.resume();expect(copy.act(op.tool,op.cell)).toBe('correct');expect(copy.puzzle.placed).toEqual(op.placed);}
 });
 it('excludes hidden moves that change neither silhouette, while leaving them physically legal',()=>{
  const fixed:Vec[]=[[0,-1,0]],placed:Vec[]=[[0,0,0],[0,0,1],[1,0,0],[1,0,1]];
  const op=legalOperations(fixed,placed).find(op=>op.tool==='remove'&&String(op.cell)==='1,0,1')!;
  expect(matches(project([...fixed,...placed],identity()),op.targets)).toBe(true);
  expect(taskGroups(fixed,placed).flat()).not.toContainEqual(op);
  const base=fixture().session.state,history=[{shape:shapeKey([...fixed,...placed]),signature:projectionKey(project([...fixed,...placed],identity()))}],s=new ArcadeSession({...base,fixed,placed,history,targets:taskGroups(fixed,placed)[0][0].targets});s.resume();
  expect(s.act('remove',[1,0,1])).toBe('mistake');expect(s.state.lives).toBe(2);expect(s.puzzle.placed).toEqual(placed);
 });
 it('never offers disconnected removal, diagonal placement or immutable blocks',()=>{
  const ops=legalOperations([[0,0,0]],[[1,0,0],[1,1,0]]);
  expect(ops.some(op=>op.tool==='remove'&&String(op.cell)==='1,0,0')).toBe(false);
  expect(ops.some(op=>op.tool==='remove'&&String(op.cell)==='0,0,0')).toBe(false);
  expect(ops.some(op=>op.tool==='place'&&String(op.cell)==='-1,-1,-1')).toBe(false);
 });
 it('has a bounded, non-rejecting fallback even if every target is in recent history',()=>{
  const rng={rng:14},b=initialBoard(rng),groups=taskGroups(b.fixed,b.placed);
  const history=groups.flat().map(op=>({shape:op.shape,signature:op.signature}));
  expect(groups.some(g=>matches(g[0].targets,chooseTask(b.fixed,b.placed,history,rng)))).toBe(true);
 });
 it('strongly prefers new silhouettes when alternatives exist',()=>{
  let repeats=0;const {session:s}=fixture(42);
  for(let i=0;i<300;i++){if(s.state.history.some(h=>h.signature===projectionKey(s.state.targets)))repeats++;solve(s);}
  expect(repeats).toBeLessThan(70);
 });
 it('generation is deterministic for a seed and identical chosen operations',()=>{
  const a=fixture(902).session,b=fixture(902).session;
  for(let i=0;i<30;i++){expect(a.state.targets).toEqual(b.state.targets);const op=solutions(a)[0];expect(a.act(op.tool,op.cell)).toBe(b.act(op.tool,op.cell));expect(shapeKey(a.puzzle.cells)).toBe(shapeKey(b.puzzle.cells));}
 });
});

describe('lives, time and rollback',()=>{
 it('a wrong legal action loses exactly one life, rolls back and keeps target/time',()=>{
  const {session:s,advance}=fixture();const before=s.puzzle.cells,target=structuredClone(s.state.targets);advance(1234);const op=wrong(s);
  expect(s.act(op.tool,op.cell)).toBe('mistake');expect(s.state.lives).toBe(2);expect(s.puzzle.cells).toEqual(before);expect(s.state.targets).toEqual(target);expect(s.state.remainingMs).toBe(90000-1234);expect(s.state.round).toBe(1);expect(s.puzzle.history).toHaveLength(0);
 });
 it('technical rejections, fixed blocks, out-of-grid and detached cells cost no lives',()=>{
  const {session:s}=fixture();for(const [tool,cell]of [['remove',s.state.fixed[0]],['place',[8,0,0]],['place',[-1,1,1]]] as const)expect(s.act(tool,cell as Vec)).toBe('invalid');expect(s.state.lives).toBe(3);
 });
 it('third mistake ends a game and never counts it twice, including on restore',()=>{
  const {session:s,storage}=fixture();const op=wrong(s);
  expect(s.act(op.tool,op.cell)).toBe('mistake');expect(s.act(op.tool,op.cell)).toBe('mistake');expect(s.act(op.tool,op.cell)).toBe('end');
  expect(s.state.finished).toBe(true);expect(s.records.games).toBe(1);expect(s.act(op.tool,op.cell)).toBe('blocked');s.tick();s.pause();
  const restored=ArcadeSession.restore(storage)!;restored.resume();expect(restored.act(op.tool,op.cell)).toBe('blocked');expect(readArcadeRecords(storage).games).toBe(1);
 });
 it('timeout loses one life, keeps the task and resets only its timer',()=>{
  const {session:s,advance}=fixture();const target=structuredClone(s.state.targets);advance(95000);expect(s.tick()).toBe('timeout');expect(s.state.lives).toBe(2);expect(s.state.remainingMs).toBe(90000);s.tick();s.tick();expect(s.state.lives).toBe(2);expect(s.state.targets).toEqual(target);advance(90000);s.tick();advance(90000);expect(s.tick()).toBe('end');expect(s.state.lives).toBe(0);expect(s.state.remainingMs).toBe(0);
 });
 it('a click at expiry processes timeout once without also applying its action',()=>{
  const {session:s,advance}=fixture();const op=solutions(s)[0],before=s.puzzle.cells;advance(90000);expect(s.act(op.tool,op.cell)).toBe('timeout');expect(s.puzzle.cells).toEqual(before);expect(s.state.lives).toBe(2);
 });
 it('pause freezes monotonic time and blocks actions; background time is not charged',()=>{
  const {session:s,advance}=fixture();advance(1250);s.pause();const op=solutions(s)[0];advance(10000000);s.tick();expect(s.act(op.tool,op.cell)).toBe('blocked');expect(s.state.remainingMs).toBe(88750);s.resume();advance(750);s.tick();expect(s.state.remainingMs).toBe(88000);expect(s.state.lives).toBe(3);
 });
 it('a delayed native background signal freezes the last active tick without charging background time',()=>{
  const {session:s,advance}=fixture();advance(1200);s.tick();advance(200000);s.pause(false);expect(s.state.remainingMs).toBe(88800);expect(s.state.lives).toBe(3);s.resume();advance(300);s.tick();expect(s.state.remainingMs).toBe(88500);
 });
 it('uses elapsed time rather than callback count and ignores a clock moving backwards',()=>{
  const {session:s,advance}=fixture();for(let i=0;i<100;i++)s.tick();expect(s.state.remainingMs).toBe(90000);advance(11000);s.tick();expect(s.state.remainingMs).toBe(79000);advance(-1000);s.tick();expect(s.state.remainingMs).toBe(79000);advance(1000);s.tick();expect(s.state.remainingMs).toBe(79000);
 });
 it('has the specified seven difficulty steps and never goes below 30 seconds',()=>{
  expect([1,5,6,10,11,16,21,26,31,1000].map(roundLimit)).toEqual([90,90,80,80,70,60,50,40,30,30].map(n=>n*1000));
 });
 it('retains the current construction after success, adds score and advances once',()=>{
  const {session:s}=fixture();const op=solutions(s)[0];s.act(op.tool,op.cell);expect(s.puzzle.placed).toEqual(op.placed);expect(s.state.score).toBe(130);expect(s.state.round).toBe(2);expect(s.act(op.tool,op.cell)).toBe('invalid');expect(s.state.round).toBe(2);
 });
});

describe('isolated and defensive arcade persistence',()=>{
 it('restores the exact task, construction, RNG, score, lives, history and frozen time',()=>{
  const {session:s,storage,advance,now}=fixture();solve(s);advance(3456);s.pause();const expected=structuredClone(s.state);advance(10e8);const restored=ArcadeSession.restore(storage,now)!;
  expect(restored.state).toEqual(expected);expect(restored.state.paused).toBe(true);restored.resume();expect(restored.state.remainingMs).toBe(expected.remainingMs);expect(restored.puzzle.placed).toEqual(s.puzzle.placed);
 });
 it('preserves campaign progress, royal unlock, outfit and music byte-for-byte',()=>{
  const storage=new Memory();const values={'hexanexus.progress.v2':'old campaign','hexanexus.motya.royal.v1':'old award','hexanexus.music':'old volume','hexanexus.motya.skin.v1':'royal'};for(const[k,v]of Object.entries(values))storage.setItem(k,v);
  const s=ArcadeSession.create(7,storage);s.resume();solve(s);s.pause();ArcadeSession.restore(storage);for(const[k,v]of Object.entries(values))expect(storage.getItem(k)).toBe(v);
 });
 it('persists records and streaks across sessions and resets streak on a mistake',()=>{
  const {session:s,storage}=fixture();solve(s);solve(s);expect(s.state.streak).toBe(2);const op=wrong(s);s.act(op.tool,op.cell);expect(s.state.streak).toBe(0);expect(s.records.bestStreak).toBe(2);const record=readArcadeRecords(storage);const another=ArcadeSession.create(23,storage);expect(another.records).toEqual(record);
 });
 it('rejects corrupt, overlapping, disconnected, already-solved and unreachable saves',()=>{
  const {session:s,storage}=fixture();s.pause();const original=structuredClone(s.state);
  for(const mutate of [(s:any)=>s.lives=-1,(s:any)=>s.placed.push(s.fixed[0]),(s:any)=>s.remainingMs=1e8,(s:any)=>s.targets=project([...s.fixed,...s.placed],identity()),(s:any)=>s.targets=[Array(9).fill(false),Array(9).fill(false)],(s:any)=>s.rng=0,(s:any)=>s.history=[]]){const bad=structuredClone(original);mutate(bad);storage.setItem(arcadeSaveKey,JSON.stringify(bad));expect(readArcadeSave(storage)).toBeNull();}
 });
 it('handles inaccessible storage and malformed records without clearing other keys',()=>{
  const broken={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
  expect(readArcadeSave(broken)).toBeNull();const s=ArcadeSession.create(7,broken);s.resume();expect(s.saveFailed).toBe(true);expect(()=>solve(s)).not.toThrow();
  const storage=new Memory();storage.setItem(arcadeRecordsKey,'{"bestScore":-10}');expect(readArcadeRecords(storage).bestScore).toBe(0);
 });
 it('continues with the same next generated tasks after restoring RNG and history',()=>{
  const {session:s,storage,now}=fixture(812);for(let i=0;i<12;i++)solve(s);s.pause();const restored=ArcadeSession.restore(storage,now)!;s.resume();restored.resume();
  for(let i=0;i<15;i++){expect(restored.state.targets).toEqual(s.state.targets);const op=solutions(s)[0];s.act(op.tool,op.cell);restored.act(op.tool,op.cell);expect(restored.puzzle.cells).toEqual(s.puzzle.cells);}
 });
 it('emits future achievement events once, without currency or inventory writes',()=>{
  const events:string[]=[],storage=new Memory(),s=ArcadeSession.create(32,storage,()=>0,event=>events.push(event.type));s.resume();solve(s);solve(s);expect(events.filter(e=>e==='record')).toHaveLength(1);expect([...storage.data.keys()].sort()).toEqual([arcadeRecordsKey,arcadeSaveKey].sort());
 });
});
