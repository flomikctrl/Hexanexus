import {legalOperations,random,projectionKey,shapeKey} from '../arcade-generator';
import {allCells,identity,key,type Vec} from '../math';
import {project} from '../projections';
import {Puzzle} from '../state';
import {levels,type Level} from '../levels';
export const duelTaskKey=(l:Level)=>JSON.stringify([shapeKey(l.fixed),shapeKey(l.available),l.limit,l.orientation,projectionKey(l.targets)]);
export function validDuelTask(v:unknown):v is Level {
 const l=v as Level;if(!l||typeof l.name!=='string'||l.name.length>100||l.size!==undefined&&l.size!==3||JSON.stringify(l.orientation)!==JSON.stringify(identity())||!Number.isInteger(l.limit)||l.limit<1||l.limit>8)return false;
 const cells=(a:unknown):a is Vec[]=>Array.isArray(a)&&a.length<=27&&a.every(c=>Array.isArray(c)&&c.length===3&&c.every(n=>Number.isInteger(n)&&n>=-1&&n<=1))&&new Set(a.map(key)).size===a.length;
 return cells(l.fixed)&&l.fixed.length>0&&cells(l.available)&&new Set([...l.fixed,...l.available].map(key)).size===l.fixed.length+l.available.length&&Array.isArray(l.targets)&&l.targets.length===2&&l.targets.every(m=>Array.isArray(m)&&m.length===9&&m.every(b=>typeof b==='boolean'));
}
export class DuelTaskSource {
 readonly history:string[]=[];private seen=new Set<string>();private rng:{rng:number};attempts=0;fallbacks=0;
 constructor(seed=crypto.getRandomValues(new Uint32Array(1))[0]){this.rng={rng:seed||1};}
 next():{task:Level;witness:Vec[]}{
  for(let attempt=0;attempt<32;attempt++){
   this.attempts++;const fixed:Vec[]=[allCells[Math.floor(random(this.rng)*27)]],count=2+Math.floor(random(this.rng)*3);
   while(fixed.length<count){const ops=legalOperations(fixed,[]).filter(o=>o.tool==='place');fixed.push(ops[Math.floor(random(this.rng)*ops.length)].cell);}
   let placed:Vec[]=[];const moves=3+Math.floor(random(this.rng)*3);
   for(let i=0;i<moves;i++){const before=projectionKey(project([...fixed,...placed],identity()));const ops=legalOperations(fixed,placed).filter(o=>o.tool==='place'&&o.signature!==before);if(!ops.length)break;placed=ops[Math.floor(random(this.rng)*ops.length)].placed;}
   if(placed.length!==moves)continue;
   const task:Level={name:'Дуэль · Новая форма',fixed,available:allCells.filter(c=>!fixed.some(f=>key(f)===key(c))),limit:moves,orientation:identity(),targets:project([...fixed,...placed],identity())};
   const p=new Puzzle(task),signature=duelTaskKey(task);if(p.won||this.history.includes(signature)||this.seen.has(signature)||!placed.every(c=>p.place(c))||!p.won)continue;
   if(task.available.some(c=>{const one=new Puzzle(task);return one.place(c)&&one.won;}))continue;
   this.remember(signature);return {task,witness:placed};
  }
  this.fallbacks++;const candidates=levels.slice(0,6),task=structuredClone(candidates.find(l=>!this.history.includes(duelTaskKey(l)))??candidates.reduce((a,b)=>this.history.indexOf(duelTaskKey(a))<this.history.indexOf(duelTaskKey(b))?a:b));this.remember(duelTaskKey(task));return {task,witness:[]};
 }
 private remember(signature:string){this.seen.add(signature);if(this.seen.size>1024)this.seen.delete(this.seen.values().next().value!);const i=this.history.indexOf(signature);if(i>=0)this.history.splice(i,1);this.history.push(signature);if(this.history.length>50)this.history.shift();}
}
