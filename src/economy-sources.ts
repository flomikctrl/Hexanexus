import {levels} from './levels';
import {readProgress,secondProgressKey} from './progress';
import {readArcadeRecords,readArcadeSave} from './arcade';
import type {EconomySources,EconomyStorage} from './economy';

export function economySources(storage?:EconomyStorage):EconomySources {
 const save=readArcadeSave(storage),records=readArcadeRecords(storage);
 const completed=storage?readProgress(storage,levels.length).completed:[];
 return {completed,completedSecond:storage?readProgress(storage,30,secondProgressKey,4).completed:[],bestSolved:Math.max(0,records.bestRound-1,save?save.round-1:0),session:save?{id:save.id,solved:save.round-1}:undefined};
}
