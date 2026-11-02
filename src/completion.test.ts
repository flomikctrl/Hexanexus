import {describe,it,expect} from 'vitest';
import {isFinalLevel,nextLevelIndex,emptyProgress,readProgress,writeProgress} from './progress';
import {Puzzle} from './state';
import {allCells,identity,type Vec} from './math';
import {project} from './projections';
import type {Level} from './levels';
describe('Конец списка уровней',()=>{
  it.each([1,3,5,8])('определяет последний уровень динамически для списка длины %s',count=>{
    expect(isFinalLevel(count-1,count)).toBe(true);expect(nextLevelIndex(count-1,count)).toBeNull();
    for(let i=0;i<count-1;i++){expect(isFinalLevel(i,count)).toBe(false);expect(nextLevelIndex(i,count)).toBe(i+1);}
  });
  it('не зацикливает пустой список и неверные индексы',()=>{expect(isFinalLevel(-1,0)).toBe(false);expect(nextLevelIndex(-1,3)).toBeNull();expect(nextLevelIndex(3,3)).toBeNull();});
  it('начало новой попытки не стирает отметки пройденных уровней',()=>{
    const p={...emptyProgress(),current:2,completed:['Первый','Второй','Последний'],tutorialSeen:true};let value='';const storage={setItem:(_:string,v:string)=>{value=v;},getItem:()=>value};
    writeProgress(storage,p);const replay=readProgress(storage,3);replay.current=0;writeProgress(storage,replay);expect(readProgress(storage,3).completed).toEqual(p.completed);
  });
});
describe('Сосед снизу',()=>{
  it('устанавливается через нижнюю грань, изменяет проекции и удаляется',()=>{
    const root:Vec=[0,0,0],below:Vec=[0,-1,0];const l:Level={name:'Нижняя грань',fixed:[root],available:allCells.filter(p=>p.toString()!==root.toString()),limit:2,orientation:identity(),targets:project([root,below],identity())};
    const p=new Puzzle(l),initial=p.projections;expect(p.place([1,-1,0])).toBe(false);expect(p.place(below)).toBe(true);expect(p.projections).not.toEqual(initial);expect(p.won).toBe(true);expect(p.place([0,-2,0])).toBe(false);expect(p.remove(root)).toBe(false);expect(p.remove(below)).toBe(true);expect(p.projections).toEqual(initial);
  });
});
