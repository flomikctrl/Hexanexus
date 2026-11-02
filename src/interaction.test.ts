import {describe,it,expect} from 'vitest';
import {act,ClickGesture,PointerTapGesture} from './interaction';
import {Puzzle} from './state';
import {levels} from './levels';
import {emptyProgress,readProgress,writeProgress,progressKey,isLevelUnlocked} from './progress';
describe('Явные режимы действий',()=>{
  it('повторное размещение не удаляет кубик; только удаление возвращает запас',()=>{
    const p=new Puzzle(levels[0]),cell=levels[0].available[0],before=structuredClone(p.orientation);
    expect(act(p,'remove',cell)).toBe(false);expect(act(p,'place',cell)).toBe(true);expect(act(p,'place',cell)).toBe(false);expect(p.placed).toHaveLength(1);
    expect(act(p,'remove',cell)).toBe(true);expect(p.placed).toHaveLength(0);expect(p.orientation).toEqual(before);
  });
  it('основа не удаляется ни одним инструментом; запас ограничен',()=>{
    const p=new Puzzle(levels[0]);for(const tool of ['place','remove'] as const)expect(act(p,tool,levels[0].fixed[0])).toBe(false);
    for(const c of levels[0].available.slice(0,2))expect(act(p,'place',c)).toBe(true);expect(act(p,'place',levels[0].available[2])).toBe(false);
    p.undo();expect(p.placed).toHaveLength(1);p.reset();expect(p.placed).toHaveLength(0);
  });
});
describe('Клик и перетаскивание',()=>{
  it('тап одним пальцем работает, оба отпускания после pinch не являются тапом',()=>{const g=new PointerTapGesture();g.begin(1,0,0);expect(g.end(1,2,2)).toBe(true);g.begin(1,0,0);g.begin(2,30,0);g.move(1,-10,0);g.move(2,50,0);expect(g.end(1,-10,0)).toBe(false);expect(g.end(2,50,0)).toBe(false);g.begin(3,0,0);expect(g.end(3,0,0)).toBe(true);});
  it('отличает клик от движения и запоминает уход за порог даже при возврате мыши',()=>{const g=new ClickGesture();g.begin(0,0);expect(g.end(2,2)).toBe(true);g.begin(0,0);g.move(20,0);expect(g.end(0,0)).toBe(false);expect(g.end(0,0)).toBe(false);g.begin(0,0);g.cancel();expect(g.end(0,0)).toBe(false);});
});
describe('Сохранение прогресса',()=>{
  it('открывает кампанию последовательно и сохраняет доступ старых сохранений',()=>{const names=Array.from({length:10},(_,i)=>String(i));expect(isLevelUnlocked(0,names,[])).toBe(true);expect(isLevelUnlocked(1,names,[])).toBe(false);expect(isLevelUnlocked(1,names,['0'])).toBe(true);expect(isLevelUnlocked(2,names,['0'])).toBe(false);expect(isLevelUnlocked(3,names,['0','1','2'])).toBe(true);expect(isLevelUnlocked(4,names,['0','1','2'])).toBe(false);expect(isLevelUnlocked(2,names,[],2)).toBe(true);expect(isLevelUnlocked(3,names,['2'])).toBe(true);});
  it('сохраняет и загружает пройденные уровни, обучение и текущие кубики',()=>{const map=new Map<string,string>();const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};const p={...emptyProgress(),current:1,completed:[levels[0].name],tutorialSeen:true,resume:{level:levels[1].name,placed:[levels[1].available[0]]}};expect(writeProgress(storage,p)).toBe(true);expect(map.has(progressKey)).toBe(true);expect(readProgress(storage,levels.length)).toEqual(p);});
  it('безопасно обрабатывает повреждённые данные и отключённое хранилище',()=>{expect(readProgress({getItem:()=>'{broken'},3)).toEqual(emptyProgress());expect(readProgress({getItem:()=>JSON.stringify({current:999,completed:[1,'one','one'],resume:{placed:[[8,0,0]]}})},3)).toEqual({...emptyProgress(),completed:['one']});expect(writeProgress({setItem:()=>{throw Error('denied');}},emptyProgress())).toBe(false);});
});
