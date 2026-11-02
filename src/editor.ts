import {orientations, key, type Vec} from './math';
import type {Level} from './levels';
export function parseLevel(text:string):Level {
  const l=JSON.parse(text);
  if(!l||typeof l.name!=='string'||!l.name.trim()||l.name.length>80)throw Error('Нужно название до 80 символов.');
  const valid=(a:unknown):a is Vec[]=>Array.isArray(a)&&a.length<=27&&a.every(p=>Array.isArray(p)&&p.length===3&&p.every(n=>Number.isInteger(n)&&Math.abs(n)<=1));
  if(!valid(l.fixed)||!valid(l.available))throw Error('Координаты должны быть целыми от −1 до 1.');
  const keys=[...l.fixed,...l.available].map(key);if(new Set(keys).size!==keys.length)throw Error('Ячейки повторяются или пересекаются.');
  if(!Number.isInteger(l.limit)||l.limit<0||l.limit>27)throw Error('Лимит должен быть от 0 до 27.');
  if(!Array.isArray(l.targets)||l.targets.length!==2||!l.targets.every((a:unknown)=>Array.isArray(a)&&a.length===9&&a.every(v=>typeof v==='boolean')))throw Error('Нужны две булевы матрицы по 9 клеток.');
  if(!orientations().some(m=>JSON.stringify(m)===JSON.stringify(l.orientation)))throw Error('Некорректная начальная ориентация.');
  return l;
}
