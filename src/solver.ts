import {apply, orientations, type Mat, type Vec} from './math';
import type {Level} from './levels';
import {project} from './projections';
import {adjacent} from './connectivity';
import {solveLarge} from './large-solver';
export interface Solution {placed:Vec[];orientation:Mat}
export function solve(l:Level,allowRotation=false):Solution|null {
  if(l.size===4){for(const m of allowRotation?orientations():[l.orientation]){const result=solveLarge(l,m);if(result)return result;}return null;}
  for(const m of allowRotation?orientations():[l.orientation]){
    const base=project(l.fixed,m);
    if(base.some((mask,s)=>mask.some((v,i)=>v&&!l.targets[s][i])))continue;
    const candidates=l.available.filter(p=>{const [x,y,z]=apply(m,p);return l.targets[0][(1-y)*3+x+1]&&l.targets[1][(1-y)*3+z+1];});
    const bits=(masks:typeof base)=>masks.flat().reduce((n,v,i)=>v?n|(1<<i):n,0);
    const goal=bits(l.targets),initial=bits(base);
    const masks=candidates.map(p=>bits(project([p],m)));
    const possible=masks.reduce((mask,m)=>mask|m,initial);if(possible!==goal)continue;
    const failed=new Set<number>();
    const search=(chosen:Vec[],covered:number,selected:number):Vec[]|null=>{
      if(covered===goal)return chosen;
      if(chosen.length>=l.limit)return null;
      let missing=goal&~covered,count=0;while(missing){missing&=missing-1;count++;}
      if(Math.ceil(count/2)>l.limit-chosen.length)return null;
      if(failed.has(selected))return null;
      for(let i=0;i<candidates.length;i++){
        if(selected&(1<<i)||![...l.fixed,...chosen].some(p=>adjacent(p,candidates[i])))continue;
        // A bridge can be necessary even when it adds no new silhouette pixels.
        const result=search([...chosen,candidates[i]],covered|masks[i],selected|(1<<i));if(result)return result;
      }
      failed.add(selected);return null;
    };
    const placed=search([],initial,0);if(placed)return {placed,orientation:m};
  }
  return null;
}
