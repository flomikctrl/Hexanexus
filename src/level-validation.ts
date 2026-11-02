import {levels,levelWitnesses,type Level} from './levels';
import {parseLevel} from './editor';
import {Puzzle} from './state';
import {solve} from './solver';
import {key,type Vec} from './math';
export function validateCampaign(campaign:Level[]=levels){
  if(campaign.length!==10)throw Error('В кампании должно быть ровно 10 уровней.');
  const names=new Set<string>(),targets=new Set<string>();
  return campaign.map((level,index)=>{
    parseLevel(JSON.stringify(level));if(names.has(level.name))throw Error('Повтор названия: '+level.name);names.add(level.name);
    const signature=JSON.stringify(level.targets);if(targets.has(signature))throw Error('Повтор силуэтов: '+level.name);targets.add(signature);
    const replay=(moves:Vec[])=>{const p=new Puzzle(level);if(p.won)throw Error(level.name+': уже решён при запуске');for(const cell of moves){if(!p.place(cell))throw Error(level.name+': недопустимый ход '+key(cell));if(p.placed.length>level.limit)throw Error('Превышен запас');}if(!p.won)throw Error(level.name+': силуэты не совпали');};
    const witness=levelWitnesses[level.name];if(!witness)throw Error('Нет контрольной последовательности: '+level.name);replay(witness);
    const found=solve(level);if(!found)throw Error('Решатель не нашёл решение: '+level.name);replay(found.placed);
    return {number:index+1,name:level.name,fixed:level.fixed.length,limit:level.limit,witness,solution:found.placed,valid:true};
  });
}
