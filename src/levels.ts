import {allCells, identity, key, type Mat, type Vec} from './math';
import {project, type Targets} from './projections';
export interface Level {name:string; fixed:Vec[]; available:Vec[]; limit:number; targets:Targets; orientation:Mat}
export const levelWitnesses:Record<string,Vec[]>={};
function make(name:string,fixed:Vec[], answer:Vec[]):Level {
  levelWitnesses[name]=structuredClone(answer);
  return {name,fixed,available:allCells.filter(p=>!fixed.some(v=>key(v)===key(p))),limit:answer.length,orientation:identity(),targets:project([...fixed,...answer],identity())};
}
export const levels:Level[]=[
  make('01 · Пробуждение', [[-1,-1,0],[0,-1,0],[0,0,0]], [[1,0,0],[1,1,0]]),
  make('02 · Смещение', [[-1,-1,-1],[-1,0,-1],[0,0,0]], [[1,0,0],[1,1,0],[1,0,1]]),
  make('03 · Переплетение', [[-1,-1,1],[0,0,0],[1,1,-1]], [[0,1,0],[-1,1,0],[0,1,1],[0,-1,0]]),
  make('04 · Перекрёсток', [[0,0,0]], [[-1,0,0],[1,0,0],[0,1,0],[0,0,1]]),
  make('05 · Скрытая грань', [[0,0,0],[0,1,0]], [[0,0,-1],[0,-1,-1],[1,-1,-1],[1,-1,0]]),
  make('06 · Переплетение', [[0,-1,0],[0,0,0]], [[-1,0,0],[-1,1,0],[-1,1,1],[0,1,1],[1,1,1]]),
  make('07 · Равновесие', [[0,0,0]], [[0,-1,0],[1,-1,0],[1,-1,-1],[1,0,-1],[1,1,-1]]),
  make('08 · Обман зрения', [[-1,0,0],[1,0,0],[0,-1,0]], [[-1,0,-1],[1,0,1],[1,1,0],[0,1,0],[-1,1,0]]),
  make('09 · Лабиринт граней', [[0,-1,-1]], [[-1,-1,-1],[-1,0,-1],[-1,0,0],[-1,1,0],[0,1,0],[1,1,0]]),
  make('10 · Последний силуэт', [[0,0,0]], [[0,-1,0],[-1,-1,0],[-1,-1,-1],[-1,0,-1],[-1,1,-1],[0,1,-1],[1,1,-1],[1,1,0]])
];
