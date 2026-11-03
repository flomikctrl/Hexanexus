import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {PhoebeController} from './phoebe-state';
import {phoebeLines,phoebeLineCount} from './phoebe-lines';

describe('Разнообразные уместные реплики',()=>{
 beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(10000)});afterEach(()=>vi.useRealTimers());
 it('исключает три последние реплики даже при неизменном генераторе случайных чисел',()=>{
  const p=new PhoebeController(true,()=>{},()=>0),recent:string[]=[];
  for(let i=0;i<12;i++){expect(p.notify({type:'manual'})).toBe(true);expect(recent.slice(-3)).not.toContain(p.state.message);recent.push(p.state.message);vi.advanceTimersByTime(5600);}
  expect(new Set(recent).size).toBeGreaterThanOrEqual(4);
 });
 it('помнит недавние вступления после смены уровня, но отменяет старые таймеры',()=>{
  const p=new PhoebeController(true,()=>{},()=>0),seen:string[]=[];
  for(let i=0;i<4;i++){p.notify({type:'level-start',levelIndex:i,levelCount:30});expect(seen).not.toContain(p.state.message);seen.push(p.state.message);expect(vi.getTimerCount()).toBe(2);}
  vi.advanceTimersByTime(6000);expect(p.state.emotion).toBe('IDLE');expect(vi.getTimerCount()).toBe(0);
 });
 it('использует особые фразы только для последних пяти уровней',()=>{
  const p=new PhoebeController(true,()=>{},()=>0);
  p.notify({type:'level-start',levelIndex:24,levelCount:30});expect(phoebeLines.start).toContain(p.state.message);
  p.notify({type:'level-start',levelIndex:25,levelCount:30});expect(phoebeLines.late).toContain(p.state.message);
  p.notify({type:'game-win',levelCount:30});expect(phoebeLines.final).toContain(p.state.message);expect(p.state.animation).toBe('final-victory');
 });
 it('не хвалит нейтральные или ухудшающие установки',()=>{
  for(const random of [0,.1,.3,.5,.7,.99]){const p=new PhoebeController(true,()=>{},()=>random);p.notify({type:'placed',improved:false});expect(phoebeLines.placed).toContain(p.state.message);expect(phoebeLines.improved).not.toContain(p.state.message);}
  const p=new PhoebeController(true,()=>{},()=>.99);p.notify({type:'placed',improved:true});expect(phoebeLines.improved).toContain(p.state.message);
 });
 it('ограничивает автоматические сообщения и сохраняет приоритет победы',()=>{
  const p=new PhoebeController();p.notify({type:'placed'});expect(p.notify({type:'placed'})).toBe(false);
  p.notify({type:'level-win'});expect(p.notify({type:'manual'})).toBe(false);expect(p.notify({type:'diagnostics',hasErrors:true})).toBe(false);
  p.notify({type:'game-win',levelCount:30});expect(p.notify({type:'forbidden',reason:'stock'})).toBe(false);
 });
 it('содержит расширенные оригинальные наборы для всех событий',()=>{
  expect(phoebeLineCount).toBe(79);for(const pool of Object.values(phoebeLines))expect(pool.length).toBeGreaterThanOrEqual(3);
 });
});
