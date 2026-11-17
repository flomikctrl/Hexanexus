export const progressKey='hexanexus.progress.v2';
import type {Vec} from './math';
import {inGrid} from './connectivity';
import type {GridSize} from './math';
export const secondProgressKey='hexanexus.campaign2.progress.v1';
export interface Progress {completed:string[];current:number;tutorialSeen:boolean;resume?:{level:string;placed:Vec[]}}
export const emptyProgress=():Progress=>({completed:[],current:0,tutorialSeen:false});
export const isFinalLevel=(index:number,count:number)=>count>0&&index===count-1;
export const nextLevelIndex=(index:number,count:number)=>Number.isInteger(index)&&index>=0&&index+1<count?index+1:null;
export function isLevelUnlocked(index:number,names:string[],completed:string[],current=0){
  if(index<0||index>=names.length)return false;
  if(index===0||completed.includes(names[index]))return true;
  // Keep every previously completed level accessible, even old non-linear saves.
  const furthest=names.reduce((n,name,i)=>completed.includes(name)?Math.max(n,i):n,-1);
  return index<=Math.max(furthest+1,current);
}
export function readProgress(storage:Pick<Storage,'getItem'>,count:number,saveKey=progressKey,size:GridSize=3):Progress {
  try{const p=JSON.parse(storage.getItem(saveKey)||'null');if(!p||typeof p!=='object')return emptyProgress();const result:Progress={completed:Array.isArray(p.completed)?[...new Set(p.completed.filter((v:unknown):v is string=>typeof v==='string'))] as string[]:[],current:Number.isInteger(p.current)&&p.current>=0&&p.current<count?p.current:0,tutorialSeen:p.tutorialSeen===true};if(p.resume&&typeof p.resume.level==='string'&&Array.isArray(p.resume.placed)&&p.resume.placed.length<=size**3&&p.resume.placed.every((v:unknown)=>Array.isArray(v)&&v.length===3&&inGrid(v as Vec,size)))result.resume=p.resume;return result;}catch{return emptyProgress();}
}
export function writeProgress(storage:Pick<Storage,'setItem'>,p:Progress,saveKey=progressKey){try{storage.setItem(saveKey,JSON.stringify(p));return true;}catch{return false;}}
