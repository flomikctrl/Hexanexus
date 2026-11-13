import {describe,it,expect} from 'vitest';
import {Puzzle} from './state';
import {levels,type Level} from './levels';
import {allCells,identity,key,type Vec} from './math';
import {project} from './projections';
import {HintChain,findHintPath,hintSnapshot,replayHints,type HintStep} from './hint-path';
const custom=(fixed:Vec[],answer:Vec[],limit=answer.length):Level=>({name:'Подсказки',fixed,available:allCells.filter(p=>!fixed.some(v=>key(v)===key(p))),limit,orientation:identity(),targets:project([...fixed,...answer],identity())});
const apply=(p:Puzzle,step:HintStep)=>step.tool==='place'?p.place(step.cell):p.remove(step.cell);
describe('Допустимые пути к двум силуэтам',()=>{
 it.each(levels.map((level,i)=>({level,number:i+1})))('полностью решает уровень $number законными шагами',({level})=>{
  const p=new Puzzle(level),before=JSON.stringify(p),result=findHintPath(hintSnapshot(p));expect(result.status).toBe('found');expect(result.steps.length).toBeGreaterThan(0);expect(JSON.stringify(p)).toBe(before);expect(replayHints(hintSnapshot(p),result.steps)?.won).toBe(true);
 });
 it('учитывает вторую проекцию даже когда первая уже совпадает',()=>{
  const p=new Puzzle(custom([[0,0,0]],[[0,0,1]]));expect(p.projections[0]).toEqual(p.level.targets[0]);expect(p.won).toBe(false);const result=findHintPath(hintSnapshot(p));expect(result.status).toBe('found');expect(replayHints(hintSnapshot(p),result.steps)?.won).toBe(true);
 });
 it('находит пути после неверных законных установок и при полном запасе на поле',()=>{
  for(const index of [0,2,7,14,19,24,29]){const p=new Puzzle(levels[index]);while(p.placed.length<p.level.limit){const next=p.level.available.find(cell=>p.canPlace(cell)&&project([cell],p.orientation).some((mask,s)=>mask.some((v,i)=>v&&!p.level.targets[s][i])))??p.level.available.find(cell=>p.canPlace(cell));if(!next)break;p.place(next);}const before=JSON.stringify(p),result=findHintPath(hintSnapshot(p));expect(['found','solved']).toContain(result.status);expect(JSON.stringify(p)).toBe(before);expect(replayHints(hintSnapshot(p),result.steps)?.won).toBe(true);}
 });
 it('принимает альтернативное решение, сохраняя уже полезный блок',()=>{
  const p=new Puzzle(custom([[0,0,0]],[[1,0,0],[1,0,1]]));expect(p.place([0,0,1])).toBe(true);const result=findHintPath(hintSnapshot(p));expect(result.steps).toHaveLength(1);expect(result.steps[0].tool).toBe('place');expect(replayHints(hintSnapshot(p),result.steps)?.won).toBe(true);p.place([1,0,1]);expect(p.won).toBe(true);expect(findHintPath(hintSnapshot(p)).status).toBe('solved');
 });
 it('не удаляет опоры и не разрушает связность',()=>{
  const p=new Puzzle(custom([[0,0,0]],[[0,1,0],[0,1,1]],3));p.place([1,0,0]);p.place([1,1,0]);p.place([1,1,1]);const result=findHintPath(hintSnapshot(p));expect(result.status).toBe('found');const copy=new Puzzle(p.level);copy.placed=structuredClone(p.placed);for(const step of result.steps){expect(step.tool!=='remove'||!p.level.fixed.some(cell=>key(cell)===key(step.cell))).toBe(true);expect(apply(copy,step)).toBe(true);}expect(copy.won).toBe(true);
 });
 it('ограничивает вычисления и не выдаёт ложного шага при лимите',()=>{const result=findHintPath(hintSnapshot(new Puzzle(levels[29])),{maxExpanded:0});expect(result.status).toBe('limit');expect(result.steps).toEqual([]);expect(result.expanded).toBe(0);});
 it('обнаруживает невозможность убрать лишнюю фиксированную проекцию',()=>{const level=custom([[0,0,0]],[[1,0,0]]);level.targets=[Array(9).fill(false),Array(9).fill(false)];const result=findHintPath(hintSnapshot(new Puzzle(level)));expect(result.status).toBe('impossible');expect(result.steps).toEqual([]);});
 it('fallback удаляет в законном порядке и достраивает без эталонного ответа',()=>{const p=new Puzzle(levels[0]);p.place([1,0,0]);const result=findHintPath(hintSnapshot(p),{directBudget:0});expect(result.status).toBe('found');expect(result.fallback).toBe(true);expect(result.steps[0]).toEqual({tool:'remove',cell:[1,0,0]});expect(replayHints(hintSnapshot(p),result.steps)?.won).toBe(true);});
});
describe('Виртуальная цепочка',()=>{
 const planned=()=>{const p=new Puzzle(levels[0]),chain=new HintChain();expect(chain.set(p,findHintPath(hintSnapshot(p)).steps)).toBe(true);return {p,chain};};
 it('открывает по одному новому шагу, сохраняя предыдущие',()=>{const {p,chain}=planned(),before=JSON.stringify(p);expect(chain.next()?.number).toBe(1);expect(chain.next()?.number).toBe(2);expect(chain.visible.map(s=>s.number)).toEqual([1,2]);expect(chain.virtual?.won).toBe(true);expect(JSON.stringify(p)).toBe(before);});
 it('после конца ничего не повторяет и оставляет все шаги видимыми',()=>{const {p,chain}=planned();while(chain.next()){}const visible=chain.visible;for(let i=0;i<20;i++)expect(chain.next()).toBeNull();expect(chain.complete).toBe(true);expect(chain.visible).toEqual(visible);expect(p.placed).toEqual([]);});
 it('исключает выполненный шаг, сохраняет остальные и очищается при победе',()=>{const {p,chain}=planned();chain.next();chain.next();apply(p,chain.visible[0]);chain.reconcile(p);expect(chain.visible.map(s=>s.number)).toEqual([2]);expect(chain.next()).toBeNull();apply(p,chain.visible[0]);chain.reconcile(p);expect(p.won).toBe(true);expect(chain.visible).toEqual([]);expect(chain.hasPlan).toBe(false);});
 it('сбрасывает неподходящий путь после отклонения и находит новый',()=>{const {p,chain}=planned();chain.next();expect(p.place([-1,-1,1])).toBe(true);chain.reconcile(p);expect(chain.hasPlan).toBe(false);const result=findHintPath(hintSnapshot(p));expect(result.status).toBe('found');expect(chain.set(p,result.steps)).toBe(true);expect(chain.next()).not.toBeNull();});
 it('не сбрасывается после запрещённого действия без изменения модели',()=>{const {p,chain}=planned();chain.next();const before=chain.visible;expect(p.remove(p.level.fixed[0])).toBe(false);chain.reconcile(p);expect(chain.visible).toEqual(before);});
 it('сохраняет допустимую цепь после другого полезного хода',()=>{const p=new Puzzle(custom([[0,0,0]],[[1,0,0],[1,1,0],[0,0,1]],3)),chain=new HintChain();const path:HintStep[]=[{tool:'place',cell:[1,0,0]},{tool:'place',cell:[1,1,0]},{tool:'place',cell:[0,0,1]}];chain.set(p,path);chain.next();chain.next();p.place([0,0,1]);chain.reconcile(p);expect(chain.planned.map(s=>s.number)).toEqual([1,2]);expect(chain.visible.map(s=>s.number)).toEqual([1,2]);expect(chain.virtual?.won).toBe(true);});
 it('сохраняет порядок удаления и последующей установки в той же позиции',()=>{const p=new Puzzle(levels[0]);p.place([1,0,0]);const chain=new HintChain(),path:HintStep[]=[{tool:'remove',cell:[1,0,0]},{tool:'place',cell:[1,0,0]},{tool:'place',cell:[1,1,0]}];expect(chain.set(p,path)).toBe(true);chain.next();chain.next();chain.next();expect(chain.visible).toHaveLength(3);expect(chain.virtual?.won).toBe(true);apply(p,path[0]);chain.reconcile(p);expect(chain.visible.map(s=>s.number)).toEqual([2,3]);});
 it('отклоняет неверный путь, очищается при рестарте и смене уровня',()=>{const {p,chain}=planned();expect(chain.set(p,[{tool:'place',cell:[1,1,1]}])).toBe(false);chain.next();chain.clear();expect(chain.visible).toEqual([]);chain.set(p,findHintPath(hintSnapshot(p)).steps);chain.next();chain.reconcile(new Puzzle(levels[1]));expect(chain.hasPlan).toBe(false);});
});
