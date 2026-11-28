import {it,expect,vi} from 'vitest';
import {DuelTaskSource,duelTaskKey,validDuelTask} from './generator';
import {Puzzle} from '../state';
import {connected} from '../connectivity';
import {solve} from '../solver';
it('generates 1000 distinct playable 3x3 tasks with legal construction paths and a 50-task history',()=>{
 const source=new DuelTaskSource(54231),seen=new Set<string>(),start=performance.now();
 for(let i=0;i<1000;i++){const {task,witness}=source.next();expect(validDuelTask(task)).toBe(true);expect(connected([task.fixed[0]],task.fixed.slice(1))).toBe(true);expect(witness.length).toBeGreaterThanOrEqual(3);const p=new Puzzle(task);expect(p.won).toBe(false);for(const c of witness)expect(p.place(c)).toBe(true);expect(p.won).toBe(true);expect(task.size??3).toBe(3);expect(seen.has(duelTaskKey(task))).toBe(false);seen.add(duelTaskKey(task));if(i%50===0){const alternate=solve(task);expect(alternate).not.toBeNull();const q=new Puzzle(task);alternate!.placed.forEach(c=>expect(q.place(c)).toBe(true));expect(q.won).toBe(true);}}
 expect(source.history).toHaveLength(50);expect(source.fallbacks).toBe(0);console.log(JSON.stringify({generated:seen.size,ms:performance.now()-start,attempts:source.attempts}));
},30000);
it('bounded attempts use a checked fallback when generation is exhausted',()=>{const source=new DuelTaskSource(1);vi.spyOn(source.history,'includes').mockReturnValue(true);const {task}=source.next();expect(source.attempts).toBe(32);expect(source.fallbacks).toBe(1);expect(solve(task)).not.toBeNull();expect(validDuelTask(task)).toBe(true);});
it('normalizes actual task conditions, ignoring names and cell order',()=>{const {task}=new DuelTaskSource(1).next();expect(duelTaskKey(task)).toBe(duelTaskKey({...task,name:'different',fixed:[...task.fixed].reverse(),available:[...task.available].reverse()}));expect(validDuelTask({...task,size:4})).toBe(false);expect(validDuelTask({...task,available:[...task.available,task.fixed[0]]})).toBe(false);});
