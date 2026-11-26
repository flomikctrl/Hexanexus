import {describe,it,expect,vi,afterEach} from 'vitest';
import {Onboarding,onboardingKey,hasExistingPlayer} from './onboarding';
import {PointerTapGesture} from './interaction';
import {Scene} from './scene';
import {CompletionDelay} from './completion';
const storage=()=>{const data=new Map<string,string>();return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};};
afterEach(()=>vi.useRealTimers());
describe('Интерактивное знакомство',()=>{
 it('проходит только через требуемые действия на решаемой фигуре',()=>{const s=storage(),m=new Onboarding(s);expect(m.canSkip).toBe(false);expect(m.advance('solve')).toBe(false);expect(m.advance('rotate')).toBe(true);let p=m.puzzle();expect(m.accepts('place',[1,0,0])).toBe(true);expect(m.accepts('place',[-1,0,0])).toBe(false);expect(p.place([1,0,0])).toBe(true);m.advance('place');p=m.puzzle();expect(p.canRemove([1,0,0])).toBe(true);p.remove([1,0,0]);m.advance('remove');p=m.puzzle();p.undo();expect(p.placed).toEqual([[1,0,0]]);m.advance('undo');m.advance('silhouettes');p=m.puzzle();p.place([1,1,0]);expect(p.won).toBe(true);expect(m.advance('solve')).toBe(true);expect(new Onboarding(s).done).toBe(true);});
 it('восстанавливает каждый этап без изменения игровых ключей и наград',()=>{const s=storage();s.setItem('hexanexus.economy.v1','wallet');s.setItem('hexanexus.campaign2.progress.v1','campaign');const m=new Onboarding(s);for(const action of ['rotate','place','remove','undo','silhouettes'] as const){m.advance(action);const resumed=new Onboarding(s);expect(resumed.step).toBe(m.step);expect(resumed.puzzle().cells).toEqual(m.puzzle().cells);}expect(s.getItem('hexanexus.economy.v1')).toBe('wallet');expect(s.getItem('hexanexus.campaign2.progress.v1')).toBe('campaign');expect([...s.data.keys()]).toHaveLength(3);});
 it('не превращает нового игрока в старого после создания кошелька и перезапуска',()=>{const s=storage();new Onboarding(s);s.setItem('hexanexus.economy.v1','new wallet');expect(new Onboarding(s).canSkip).toBe(false);});
 it('узнаёт старого игрока и сохраняет явный пропуск',()=>{const s=storage();s.setItem('hexanexus.progress.v2','old');expect(hasExistingPlayer(s)).toBe(true);const m=new Onboarding(s);expect(m.canSkip).toBe(true);expect(m.skip()).toBe(true);expect(new Onboarding(s).done).toBe(true);expect(s.getItem('hexanexus.progress.v2')).toBe('old');});
 it('не завершает этап при ошибке записи',()=>{const s=storage(),m=new Onboarding(s);s.setItem=()=>{throw Error('quota');};expect(m.advance('rotate')).toBe(false);expect(m.step).toBe(0);expect(m.skip()).toBe(false);expect(m.done).toBe(false);expect(m.error).not.toBe('');});
 it('безопасно читает повреждённый флаг',()=>{const s=storage();s.setItem(onboardingKey,'{broken');expect(new Onboarding(s).step).toBe(0);expect(new Onboarding(s).done).toBe(false);});
});
describe('Отмена касания и завершение',()=>{
 it('уход в фон отменяет касание без таймеров удаления',()=>{vi.useFakeTimers();vi.stubGlobal('document',{hidden:false});try{const v=Object.create(Scene.prototype) as Scene,g=new PointerTapGesture();Object.assign(v,{gesture:g,lobbyRotation:{suspend:vi.fn(),cancel:vi.fn()},loop:{pause:vi.fn(),start:vi.fn()}});g.begin(1,0,0);v.setAppActive(false);vi.advanceTimersByTime(1000);expect(g.end(1,0,0)).toBe(false);expect(vi.getTimerCount()).toBe(0);}finally{vi.unstubAllGlobals();}});
 it('показывает победу через три секунды один раз и отменяет отложенное окно при выходе',()=>{vi.useFakeTimers();const f=vi.fn(),d=new CompletionDelay();expect(d.start(f)).toBe(true);expect(d.start(f)).toBe(false);vi.advanceTimersByTime(2999);expect(f).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(f).toHaveBeenCalledTimes(1);d.start(f);d.cancel();vi.advanceTimersByTime(3000);expect(f).toHaveBeenCalledTimes(1);});
});
