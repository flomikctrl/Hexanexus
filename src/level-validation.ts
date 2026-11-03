import {levels,levelWitnesses,type Level} from './levels';
import {parseLevel} from './editor';
import {Puzzle} from './state';
import {solve} from './solver';
import {allCells,apply,orientations,key,type Vec} from './math';
import {project} from './projections';

// Canonicalize the entire task, not an arbitrary witness. Include both anchors
// and the volume allowed by the two silhouettes, under all 48 cube symmetries.
export function campaignSignature(level:Level){
  const volume=allCells.filter(p=>project([p],level.orientation).every((mask,s)=>mask.every((v,i)=>!v||level.targets[s][i])));
  const variants:string[]=[];
  for(const m of orientations())for(const reflection of [1,-1]){
    const cells=(set:Vec[])=>set.map(p=>key(apply(m,[p[0]*reflection,p[1],p[2]]))).sort();
    variants.push(JSON.stringify([cells(level.fixed),cells(volume)]));
  }
  return variants.sort()[0];
}
export function shortestSolution(level:Level){
  const base=project(level.fixed,level.orientation);
  const missing=level.targets.flat().filter((v,i)=>v&&!base.flat()[i]).length;
  for(let limit=Math.ceil(missing/2);limit<=level.limit;limit++){
    const result=solve({...level,limit});if(result)return result;
  }
  return null;
}
export function validateCampaign(campaign:Level[]=levels){
  const names=new Set<string>(),targets=new Set<string>(),symmetries=new Set<string>();
  return campaign.map((level,index)=>{
    parseLevel(JSON.stringify(level));if(names.has(level.name))throw Error('Повтор названия: '+level.name);names.add(level.name);
    const signature=JSON.stringify(level.targets);if(targets.has(signature))throw Error('Повтор силуэтов: '+level.name);targets.add(signature);
    const canonical=campaignSignature(level);if(symmetries.has(canonical))throw Error('Повтор с поворотом или отражением: '+level.name);symmetries.add(canonical);
    const replay=(moves:Vec[])=>{const p=new Puzzle(level);if(p.won)throw Error(level.name+': уже решён при запуске');for(const cell of moves){if(!p.place(cell))throw Error(level.name+': недопустимый ход '+key(cell));if(p.placed.length>level.limit)throw Error('Превышен запас');}if(!p.won)throw Error(level.name+': силуэты не совпали');};
    const witness=levelWitnesses[level.name];if(!witness)throw Error('Нет контрольной последовательности: '+level.name);replay(witness);
    const found=shortestSolution(level);if(!found)throw Error('Решатель не нашёл решение: '+level.name);replay(found.placed);
    const p=new Puzzle(level),branches:number[]=[],goalBranches:number[]=[];
    for(const move of found.placed){
      const choices=level.available.filter(v=>p.canPlace(v));branches.push(choices.length);
      goalBranches.push(choices.filter(v=>project([...p.cells,v],p.orientation).every((mask,s)=>mask.every((bit,i)=>!bit||level.targets[s][i]))).length);
      p.place(move);
    }
    return {number:index+1,name:level.name,fixed:level.fixed.length,limit:level.limit,witness,solution:found.placed,minimumMoves:found.placed.length,branches,goalBranches,valid:true};
  });
}
