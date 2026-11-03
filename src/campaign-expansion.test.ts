import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {levels,levelWitnesses} from './levels';
import {validateCampaign,campaignSignature} from './level-validation';
import {isFinalLevel,nextLevelIndex,isLevelUnlocked,readProgress} from './progress';
import {project} from './projections';
import type {Vec} from './math';
import {Puzzle} from './state';

describe('Расширение существующей кампании',()=>{
 it('сохраняет первые десять уровней целиком, включая доступные клетки и цели',()=>{
  const original=JSON.parse(readFileSync(new URL('./fixtures/original-ten.json',import.meta.url),'utf8'));
  expect(levels.slice(0,10)).toEqual(original);expect(levels).toHaveLength(30);
 });
 it('имеет уникальные стабильные имена и непобедные начальные состояния',()=>{
  expect(new Set(levels.map(l=>l.name)).size).toBe(30);
  for(const level of levels)expect(new Puzzle(level).won,level.name).toBe(false);
 });
 it('распознаёт отражённую задачу независимо от порядка клеток',()=>{
  const l=levels[10],flip=([x,y,z]:Vec):Vec=>[-x,y,z];
  const fixed=l.fixed.map(flip),answer=levelWitnesses[l.name].map(flip);
  expect(campaignSignature({...l,fixed,targets:project([...fixed,...answer],l.orientation)})).toBe(campaignSignature(l));
 });
 it('не содержит пространственных дубликатов и находит кратчайшие решения финальных задач',()=>{
  const result=validateCampaign();expect(new Set(levels.map(campaignSignature)).size).toBe(30);
  expect(result.slice(25).map(r=>r.minimumMoves)).toEqual([7,8,8,8,9]);
  expect(result.slice(10).every(r=>r.solution.length<=r.limit&&r.branches.every(n=>n>0))).toBe(true);
 });
 it('сохраняет старое завершение десяти уровней и открывает одиннадцатый',()=>{
  const saved={completed:levels.slice(0,10).map(l=>l.name),current:9,tutorialSeen:true,resume:{level:levels[9].name,placed:levelWitnesses[levels[9].name]}};
  const p=readProgress({getItem:()=>JSON.stringify(saved)},levels.length);expect(p).toEqual(saved);
  expect(isLevelUnlocked(10,levels.map(l=>l.name),p.completed,p.current)).toBe(true);
  expect(isLevelUnlocked(11,levels.map(l=>l.name),p.completed,p.current)).toBe(false);
  expect(nextLevelIndex(9,levels.length)).toBe(10);expect(isFinalLevel(9,levels.length)).toBe(false);
  expect(isFinalLevel(29,levels.length)).toBe(true);expect(nextLevelIndex(29,levels.length)).toBeNull();
 });
 it('сохраняет оригинальную музыку байт в байт',()=>{
  expect(createHash('sha256').update(readFileSync(new URL('../public/audio/silhouette-loop.wav',import.meta.url))).digest('hex')).toBe('a82cafd6d8d67c1cb18a13390322c2a1d618ebb5808c5f884949123f52e75d9d');
 });
});
