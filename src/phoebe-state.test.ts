import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {PhoebeController,readPhoebeSetting,savePhoebeSetting,phoebeSettingKey,friendlyLines} from './phoebe-state';
describe('Независимые реакции Фиби',()=>{
  beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(10000);});afterEach(()=>vi.useRealTimers());
  it('начинает с IDLE и даёт приветствие/реакцию нового уровня',()=>{
    const p=new PhoebeController();expect(p.state.emotion).toBe('IDLE');expect(p.notify({type:'greeting'})).toBe(true);expect(p.state.message).toBe('Ну что, начнём?');p.notify({type:'level-start'});expect(p.state.emotion).toBe('IDLE');expect(p.state.message).toBe('Давай соберём эту загадку!');
  });
  it('показывает SAD только при несовпадениях, убирает облачко и возвращается в IDLE',()=>{
    const p=new PhoebeController();expect(p.notify({type:'diagnostics',hasErrors:false})).toBe(false);p.notify({type:'diagnostics',hasErrors:true});expect(p.state.emotion).toBe('SAD');expect(p.state.message).toContain('не сходится');vi.advanceTimersByTime(4200);expect(p.state.message).toBe('');expect(p.state.emotion).toBe('SAD');vi.advanceTimersByTime(600);expect(p.state.emotion).toBe('IDLE');expect(vi.getTimerCount()).toBe(0);
  });
  it.each(['fixed','stock','other'] as const)('реагирует SHOCK на запрещённое действие %s',reason=>{const p=new PhoebeController();p.notify({type:'forbidden',reason});expect(p.state.emotion).toBe('SHOCK');expect(p.state.animation).toBe('shock');vi.advanceTimersByTime(5000);expect(p.state.emotion).toBe('IDLE');});
  it('IDLE → SHOCK → IDLE: удивление длится ровно 2,6 секунды',()=>{
    const p=new PhoebeController();expect(p.state.emotion).toBe('IDLE');p.notify({type:'forbidden',reason:'fixed'});vi.advanceTimersByTime(2599);expect(p.state.emotion).toBe('SHOCK');expect(p.state.animation).toBe('shock');expect(p.notify({type:'placed'})).toBe(false);expect(p.notify({type:'diagnostics',hasErrors:true})).toBe(false);expect(p.notify({type:'forbidden',reason:'disconnected'})).toBe(false);vi.advanceTimersByTime(1);expect(p.state.emotion).toBe('IDLE');expect(p.state.message).toBe('');expect(vi.getTimerCount()).toBe(0);
  });
  it('SAD → SHOCK → IDLE: старые таймеры SAD не обрывают SHOCK',()=>{
    const p=new PhoebeController();p.notify({type:'diagnostics',hasErrors:true});vi.advanceTimersByTime(4000);p.notify({type:'forbidden',reason:'stock'});expect(p.state.emotion).toBe('SHOCK');vi.advanceTimersByTime(800);expect(p.state.emotion).toBe('SHOCK');expect(p.state.message).toContain('нет кубиков');vi.advanceTimersByTime(1799);expect(p.state.emotion).toBe('SHOCK');vi.advanceTimersByTime(1);expect(p.state.emotion).toBe('IDLE');expect(vi.getTimerCount()).toBe(0);
  });
  it('победа имеет приоритет и не перебивается ошибками, а финал сильнее обычной победы',()=>{
    const p=new PhoebeController();p.notify({type:'diagnostics',hasErrors:true});p.notify({type:'forbidden',reason:'fixed'});p.notify({type:'level-win'});expect(p.state.emotion).toBe('IDLE');expect(p.state.message).toBe('Ура! Мы справились!');expect(p.notify({type:'forbidden',reason:'stock'})).toBe(false);expect(p.notify({type:'diagnostics',hasErrors:true})).toBe(false);expect(p.notify({type:'manual'})).toBe(false);
    p.notify({type:'game-win'});expect(p.state.animation).toBe('final-victory');expect(p.state.message).toBe('Ты прошёл все испытания! Я так рада!');expect(p.notify({type:'level-win'})).toBe(false);vi.advanceTimersByTime(6000);expect(p.state.animation).toBe('idle');
  });
  it('не позволяет спамить кликами, репликами и анимациями',()=>{
    const p=new PhoebeController(true,()=>{},()=>.5);expect(friendlyLines.length).toBeGreaterThanOrEqual(5);expect(friendlyLines.length).toBeLessThanOrEqual(8);
    p.notify({type:'manual'});const first={...p.state};expect(friendlyLines).toContain(p.state.message);expect(p.notify({type:'manual'})).toBe(false);expect(p.state).toEqual(first);expect(p.notify({type:'placed'})).toBe(false);vi.advanceTimersByTime(5600);expect(p.notify({type:'manual'})).toBe(true);
  });
  it('отключение отменяет все таймеры и запрещает будущие реакции до включения',()=>{
    const render=vi.fn(),p=new PhoebeController(true,render);p.notify({type:'forbidden',reason:'fixed'});expect(vi.getTimerCount()).toBe(2);p.setEnabled(false);expect(vi.getTimerCount()).toBe(0);expect(p.state.enabled).toBe(false);expect(p.state.message).toBe('');const calls=render.mock.calls.length;vi.advanceTimersByTime(20000);expect(render).toHaveBeenCalledTimes(calls);expect(p.notify({type:'game-win'})).toBe(false);expect(vi.getTimerCount()).toBe(0);p.setEnabled(true);expect(p.state.emotion).toBe('IDLE');expect(p.notify({type:'manual'})).toBe(true);p.dispose();expect(vi.getTimerCount()).toBe(0);
  });
  it('новый уровень снимает старую победную реакцию, не оставляя отложенных событий',()=>{
    const p=new PhoebeController();p.notify({type:'game-win'});p.notify({type:'level-start'});expect(p.state.emotion).toBe('IDLE');expect(p.state.animation).toBe('idle');expect(p.state.message).toContain('соберём');expect(vi.getTimerCount()).toBe(2);vi.advanceTimersByTime(6000);expect(p.state.message).toBe('');expect(vi.getTimerCount()).toBe(0);
  });
  it('успешная установка вызывает обычную реплику с ограничением частоты',()=>{const p=new PhoebeController();p.notify({type:'placed'});expect(p.state.message).toBe('Отлично! Продолжай!');expect(p.state.animation).toBe('idle');});
});
describe('Сохранение настройки Фиби',()=>{
  it('включена по умолчанию; отдельный ключ сохраняет выключение',()=>{let value:string|null=null;const storage={getItem:()=>value,setItem:(key:string,v:string)=>{expect(key).toBe(phoebeSettingKey);value=v;}};expect(readPhoebeSetting(storage)).toBe(true);expect(savePhoebeSetting(storage,false)).toBe(true);expect(readPhoebeSetting(storage)).toBe(false);savePhoebeSetting(storage,true);expect(readPhoebeSetting(storage)).toBe(true);});
  it('отказ localStorage не мешает работе игры',()=>{expect(readPhoebeSetting({getItem:()=>{throw Error('denied');}})).toBe(true);expect(savePhoebeSetting({setItem:()=>{throw Error('denied');}},false)).toBe(false);});
});
