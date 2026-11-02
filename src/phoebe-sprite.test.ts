import {describe,it,expect,vi} from 'vitest';
import {PhoebeSpriteSwitcher,type PhoebeSprite} from './phoebe-sprite';
const sprite=(name:string):PhoebeSprite=>({src:`/phoebe/phoebe-${name}.png`,clip:`clip-${name}`});
function deferred(){let resolve!:()=>void;let reject!:(error:Error)=>void;const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
describe('Один спрайт без наложения и гонок загрузки',()=>{
  it('скрывает прошлый кадр до декодирования нового, используя тот же img',async()=>{
    const idle=deferred(),shock=deferred(),back=deferred();const image={src:'',hidden:true,decode:vi.fn().mockReturnValueOnce(idle.promise).mockReturnValueOnce(shock.promise).mockReturnValueOnce(back.promise)},commit=vi.fn(),view=new PhoebeSpriteSwitcher(image,commit);
    const first=view.show(sprite('idle'));idle.resolve();expect(await first).toBe(true);expect(image.hidden).toBe(false);const sameImage=image;
    const second=view.show(sprite('shock'));expect(image).toBe(sameImage);expect(image.src).toBe('/phoebe/phoebe-shock.png');expect(image.hidden).toBe(true);shock.resolve();expect(await second).toBe(true);expect(image.hidden).toBe(false);expect(commit).toHaveBeenLastCalledWith(sprite('shock'));
    const third=view.show(sprite('idle'));expect(image.hidden).toBe(true);back.resolve();await third;expect(image.src).toBe('/phoebe/phoebe-idle.png');expect(image.hidden).toBe(false);expect(commit).toHaveBeenCalledTimes(3);
  });
  it('поздно загрузившийся IDLE не раскрывается поверх SHOCK',async()=>{
    const idle=deferred(),shock=deferred();const image={src:'',hidden:true,decode:vi.fn().mockReturnValueOnce(idle.promise).mockReturnValueOnce(shock.promise)},commit=vi.fn(),view=new PhoebeSpriteSwitcher(image,commit);
    const a=view.show(sprite('idle')),b=view.show(sprite('shock'));idle.resolve();expect(await a).toBe(false);expect(image.hidden).toBe(true);expect(commit).not.toHaveBeenCalled();shock.resolve();expect(await b).toBe(true);expect(image.src).toContain('shock');expect(commit).toHaveBeenCalledTimes(1);
  });
  it('SAD, SHOCK и IDLE при быстрых переключениях не возвращают старые изображения',async()=>{
    const sad=deferred(),shock=deferred(),idle=deferred();const image={src:'',hidden:true,decode:vi.fn().mockReturnValueOnce(sad.promise).mockReturnValueOnce(shock.promise).mockReturnValueOnce(idle.promise)},commit=vi.fn(),view=new PhoebeSpriteSwitcher(image,commit);
    const a=view.show(sprite('sad')),b=view.show(sprite('shock')),c=view.show(sprite('idle'));shock.resolve();await b;sad.resolve();await a;expect(image.hidden).toBe(true);expect(commit).not.toHaveBeenCalled();idle.resolve();await c;expect(commit).toHaveBeenCalledOnce();expect(commit).toHaveBeenLastCalledWith(sprite('idle'));expect(image.hidden).toBe(false);
  });
  it('повторный render не создаёт дополнительную загрузку',async()=>{
    const ready=deferred(),image={src:'',hidden:true,decode:vi.fn(()=>ready.promise)},view=new PhoebeSpriteSwitcher(image,()=>{});const a=view.show(sprite('shock')),b=view.show(sprite('shock'));expect(a).toBe(b);expect(image.decode).toHaveBeenCalledOnce();ready.resolve();await b;await view.show(sprite('shock'));expect(image.decode).toHaveBeenCalledOnce();
  });
  it('отключение и уничтожение отменяют запоздалое отображение',async()=>{
    const ready=deferred(),image={src:'',hidden:false,decode:()=>ready.promise},commit=vi.fn(),view=new PhoebeSpriteSwitcher(image,commit);const pending=view.show(sprite('shock'));view.cancel();ready.resolve();expect(await pending).toBe(false);expect(image.hidden).toBe(true);expect(commit).not.toHaveBeenCalled();view.dispose();expect(await view.show(sprite('idle'))).toBe(false);expect(image.hidden).toBe(true);
  });
  it('ошибка загрузки не оставляет видимым предыдущий спрайт',async()=>{
    const ready=deferred(),image={src:'',hidden:false,decode:()=>ready.promise},view=new PhoebeSpriteSwitcher(image,()=>{});const pending=view.show(sprite('shock'));ready.reject(Error('PNG failed'));await expect(pending).rejects.toThrow('PNG failed');expect(image.hidden).toBe(true);
  });
});
