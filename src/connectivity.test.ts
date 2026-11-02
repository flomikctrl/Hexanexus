import {describe,it,expect} from 'vitest';
import {adjacent,connected,connectedOrder,inGrid,neighborFromNormal} from './connectivity';
import {allCells,identity,type Vec} from './math';
import {Puzzle} from './state';
import type {Level} from './levels';
import {levels} from './levels';
import {project} from './projections';
import {solve} from './solver';
const fixture=(fixed:Vec[]=[[-1,0,0]],limit=8):Level=>({name:'Связность',fixed,available:allCells.filter(p=>!fixed.some(v=>v.toString()===p.toString())),limit,orientation:identity(),targets:project(fixed,identity())});
describe('Соседство по граням',()=>{
  it('у центра ровно шесть соседей; ребро и угол не считаются',()=>{expect(allCells.filter(p=>adjacent([0,0,0],p))).toHaveLength(6);expect(adjacent([0,0,0],[1,1,0])).toBe(false);expect(adjacent([0,0,0],[1,1,1])).toBe(false);expect(adjacent([0,0,0],[0,0,0])).toBe(false);});
  it.each([[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]] as Vec[])('нормаль (%s, %s, %s) выбирает единственного соседа',(x,y,z)=>{const n:Vec=[x,y,z];expect(neighborFromNormal([0,0,0],n)).toEqual(n);});
  it('скруглённый край не создаёт диагонального смещения',()=>{expect(neighborFromNormal([0,0,0],[.2,.97,.1])).toEqual([0,1,0]);expect(neighborFromNormal([0,0,0],[0,0,0])).toBeNull();expect(neighborFromNormal([0,0,0],[NaN,0,1])).toBeNull();});
  it('границы и дробные координаты отклоняются',()=>{expect(inGrid([1,1,1])).toBe(true);expect(inGrid([2,0,0])).toBe(false);expect(inGrid([.5,0,0])).toBe(false);expect(inGrid([NaN,0,0])).toBe(false);});
  it('разрешает любую из шести граней независимо от цели',()=>{const p=new Puzzle(fixture([[0,0,0]]));for(const cell of allCells.filter(c=>adjacent(c,[0,0,0])))expect(p.place(cell)).toBe(true);expect(p.placed).toHaveLength(6);expect(p.won).toBe(false);});
  it('блокирует диагональ, изолированный блок, занятое место и выход из сетки',()=>{const p=new Puzzle(fixture());for(const c of [[0,1,0],[1,0,0],[-1,0,0],[-2,0,0],[.5,0,0]] as Vec[])expect(p.place(c)).toBe(false);expect(p.place([0,0,0])).toBe(true);expect(p.place([0,0,0])).toBe(false);expect(p.place([1,0,0])).toBe(true);expect(connected(p.level.fixed,p.placed)).toBe(true);});
  it('обновляет силуэты после законного размещения и удаления',()=>{const p=new Puzzle(fixture());const before=p.projections;expect(p.place([0,0,0])).toBe(true);expect(p.projections[0][4]).toBe(true);expect(p.projections).not.toEqual(before);expect(p.remove([0,0,0])).toBe(true);expect(p.projections).toEqual(before);});
});
describe('Связность с неподвижной основой',()=>{
  it('защищает мост, но разрешает удаление листа и отмену',()=>{const p=new Puzzle(fixture());p.place([0,0,0]);p.place([1,0,0]);const h=p.history.length;expect(p.remove([0,0,0])).toBe(false);expect(p.history).toHaveLength(h);expect(p.remove([-1,0,0])).toBe(false);expect(p.remove([1,0,0])).toBe(true);expect(p.remove([0,0,0])).toBe(true);p.undo();expect(connected(p.level.fixed,p.placed)).toBe(true);});
  it('разрешает удаление при наличии обходного пути',()=>{const p=new Puzzle(fixture([[0,0,0]]));for(const c of [[1,0,0],[1,1,0],[0,1,0]] as Vec[])expect(p.place(c)).toBe(true);expect(p.remove([1,0,0])).toBe(true);expect(connected(p.level.fixed,p.placed)).toBe(true);});
  it('работает с несколькими фиксированными якорями, но не принимает отдельный остров',()=>{expect(connected([[-1,0,0],[1,0,0]],[[0,0,0]])).toBe(true);expect(connected([[-1,0,0]],[[1,0,0],[1,1,0]])).toBe(false);expect(connected([],[[0,0,0]])).toBe(false);expect(connectedOrder([[-1,0,0]],[[1,0,0],[0,0,0]])).toEqual([[0,0,0],[1,0,0]]);});
  it('поиск учитывает необходимые мосты без новых пикселей проекции',()=>{
    const l=fixture([[-1,0,-1],[1,0,0]],2);l.available=[[-1,0,1],[-1,0,0]];l.targets=project([...l.fixed,[-1,0,1]],identity());const s=solve(l);expect(s?.placed).toEqual([[-1,0,0],[-1,0,1]]);const p=new Puzzle(l);for(const v of s!.placed)expect(p.place(v)).toBe(true);expect(p.won).toBe(true);
  });
  for(const l of levels)it(`${l.name}: все шаги решения достижимы, ошибочные позиции не вырезаны`,()=>{expect(l.available.length+l.fixed.length).toBe(27);const s=solve(l);expect(s).not.toBeNull();const p=new Puzzle(l);for(const cell of s!.placed){expect(p.canPlace(cell)).toBe(true);expect(p.place(cell)).toBe(true);expect(connected(l.fixed,p.placed)).toBe(true);}expect(p.won).toBe(true);});
});
