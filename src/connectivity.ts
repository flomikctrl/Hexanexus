import type {Vec,GridSize} from './math';
export const inGrid=(p:Vec,size:GridSize=3)=>p.length===3&&p.every(n=>Number.isInteger(n+(size-1)/2)&&Math.abs(n)<size/2);
export const adjacent=(a:Vec,b:Vec)=>a.reduce((n,v,i)=>n+Math.abs(v-b[i]),0)===1;
export function neighborFromNormal(cell:Vec,normal:Vec):Vec|null {
  if(!normal.every(Number.isFinite))return null;
  const axis=normal.reduce((best,n,i)=>Math.abs(n)>Math.abs(normal[best])?i:best,0);
  if(Math.abs(normal[axis])<1e-8)return null;
  const next:Vec=[...cell];next[axis]+=Math.sign(normal[axis]);return next;
}
// Every placed block must be reachable from at least one immutable anchor.
export function connectedOrder(fixed:Vec[],placed:Vec[]):Vec[]|null {
  const reached=[...fixed],pending=[...placed],order:Vec[]=[];
  while(pending.length){const i=pending.findIndex(p=>reached.some(v=>adjacent(v,p)));if(i<0)return null;const [p]=pending.splice(i,1);reached.push(p);order.push(p);}
  return order;
}
export const connected=(fixed:Vec[],placed:Vec[])=>connectedOrder(fixed,placed)!==null;
