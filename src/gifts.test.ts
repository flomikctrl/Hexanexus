import {describe,it,expect,vi} from 'vitest';
import {Economy,economyKey,giftPrice} from './economy';
import {chooseGift,giftOdds,giftSkinIds,secureBelow,validGifts} from './gifts';
import {motyaCollection,readMotyaSkin,saveMotyaSkin,skinStorageKey} from './motya-skins';
import {levels} from './levels';
import {BackNavigation} from './back-navigation';
const sources={completed:[],bestSolved:0};
function setup(balance=1500){
 const data=new Map<string,string>();let failed=false,writes=0;
 const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{if(failed)throw Error('disk');writes++;data.set(k,v);}};
 const initial=new Economy(storage,sources),snapshot=initial.snapshot;snapshot.balance=balance;data.set(economyKey,JSON.stringify(snapshot));
 const economy=new Economy(storage,sources);
 return {data,storage,economy,fail:(v=true)=>failed=v,writes:()=>writes,reload:()=>new Economy(storage,sources)};
}
describe('Подарки: точная математика без повторов',()=>{
 it('стоят ровно 300; шансы 60/25/15 относятся к редкостям',()=>{
  expect(giftPrice).toBe(300);expect(giftOdds([]).map(g=>g.probability)).toEqual([.6,.25,.15]);
  const counts=new Map<string,number>();for(let t=0;t<100;t++)for(let inner=0;inner<2;inner++){
   let n=0;const skin=chooseGift([],bound=>(n++===0?t:inner%bound))!;counts.set(skin,(counts.get(skin)??0)+1);
  }
  expect(Object.fromEntries(counts)).toEqual({baker:60,winter:60,cosmic:50,sleepy:15,wizard:15});
 });
 it.each([[0,'baker'],[59,'baker'],[60,'cosmic'],[84,'cosmic'],[85,'sleepy'],[99,'sleepy']] as const)('граница билета %s → %s',(ticket,expected)=>{
  let first=true;expect(chooseGift([],()=>{if(first){first=false;return ticket;}return 0;})).toBe(expected);
 });
 it('нормализует оставшиеся редкости, не повышает вес за число костюмов',()=>{
  expect(giftOdds(['baker']).map(g=>g.probability)).toEqual([.6,.25,.15]);
  expect(giftOdds(['baker','winter']).map(g=>g.probability)).toEqual([0,.625,.375]);
  expect(giftOdds(['cosmic']).map(g=>g.probability)).toEqual([.8,0,.2]);
 });
 it.each(giftSkinIds)('последний %s гарантирован, собранная коллекция пуста',last=>{
  const owned=giftSkinIds.filter(id=>id!==last);for(const value of [0,.99])expect(chooseGift(owned,n=>Math.floor(value*n))).toBe(last);
  expect(chooseGift([...giftSkinIds,'classic','royal'])).toBeNull();
 });
 it('отбрасывает хвост uint32 для равномерного выбора без modulo bias',()=>{
  let n=0;expect(secureBelow(100,a=>{a[0]=n++?4294967199:4294967295;return a;})).toBe(99);expect(n).toBe(2);
  expect(secureBelow(1,a=>{a[0]=4294967295;return a;})).toBe(0);
  expect(()=>secureBelow(0)).toThrow();expect(()=>secureBelow(100,a=>{a[0]=4294967295;return a;})).toThrow();
 });
 it('не принимает неверные случайные значения',()=>{for(const n of [-1,100,NaN,.5])expect(()=>chooseGift([],()=>n)).toThrow();});
});
describe('Атомарная покупка и одноразовая миграция',()=>{
 it.each([0,50,299])('не списывает при балансе %s',balance=>{const t=setup(balance),before=t.data.get(economyKey);expect(t.economy.buyGift(()=>0)).toBeNull();expect(t.data.get(economyKey)).toBe(before);});
 it('ровно 300: одна запись сразу содержит костюм и списание',()=>{
  const t=setup(300),before=t.writes();expect(t.economy.buyGift(()=>0)).toEqual({id:1,skin:'baker'});expect(t.writes()-before).toBe(1);
  const d=JSON.parse(t.data.get(economyKey)!);expect(d.balance).toBe(0);expect(d.gifts.owned).toEqual(['baker']);expect(d.gifts.pending).toEqual({id:1,skin:'baker'});
 });
 it('быстрый повторный тап и повторный вызов из подписчика не списывают дважды',()=>{
  const t=setup();t.economy.subscribe(()=>expect(t.economy.buyGift(()=>0)).toBeNull());
  expect(t.economy.buyGift(()=>0)).not.toBeNull();for(let i=0;i<20;i++)expect(t.economy.buyGift(()=>0)).toBeNull();expect(t.economy.balance).toBe(1200);
 });
 it('пять покупок дают все пять, шестая не списывает',()=>{
  const t=setup(1800),received=[];for(let i=0;i<5;i++){const r=t.economy.buyGift(()=>0)!;received.push(r.skin);expect(t.economy.acknowledgeGift(r.id)).toBe(true);}
  expect(new Set(received).size).toBe(5);expect(received).not.toContain('classic');expect(received).not.toContain('royal');expect(t.economy.balance).toBe(300);
  const before=t.data.get(economyKey);expect(t.economy.buyGift(()=>0)).toBeNull();expect(t.data.get(economyKey)).toBe(before);
 });
 it('ошибка записи не выдаёт костюм, не списывает; повтор после восстановления возможен',()=>{
  const t=setup(),before=t.data.get(economyKey);t.fail();expect(t.economy.buyGift(()=>0)).toBeNull();expect(t.economy.balance).toBe(1500);expect(t.economy.gifts.owned).toEqual([]);expect(t.data.get(economyKey)).toBe(before);
  t.fail(false);expect(t.economy.buyGift(()=>0)?.skin).toBe('baker');expect(t.economy.balance).toBe(1200);
 });
 it('отказ генератора не списывает деньги',()=>{const t=setup(),before=t.data.get(economyKey);expect(t.economy.buyGift(()=>{throw Error('random');})).toBeNull();expect(t.data.get(economyKey)).toBe(before);});
 it('закрытие приложения во время анимации сохраняет награду и тот же результат',()=>{
  const t=setup(),r=t.economy.buyGift(()=>0)!,again=t.reload();expect(again.balance).toBe(1200);expect(again.gifts.pending).toEqual(r);expect(again.gifts.owned).toEqual(['baker']);expect(again.buyGift(()=>0)).toBeNull();
  expect(again.acknowledgeGift(999)).toBe(false);expect(again.acknowledgeGift(r.id)).toBe(true);expect(t.reload().gifts.pending).toBeNull();expect(t.reload().gifts.owned).toEqual(['baker']);
 });
 it('ошибка закрытия результата сохраняет его и право на костюм',()=>{
  const t=setup(),r=t.economy.buyGift(()=>0)!;t.fail();expect(t.economy.acknowledgeGift(r.id)).toBe(false);expect(t.economy.gifts.pending).toEqual(r);expect(t.economy.gifts.owned).toEqual(['baker']);
 });
 it('не перезаписывает покупку другой открытой копии игры устаревшим кошельком',()=>{
  const t=setup(),stale=t.reload();expect(t.economy.buyGift(()=>0)).not.toBeNull();expect(stale.buyGift(()=>0)).toBeNull();expect(t.reload().balance).toBe(1200);
 });
 it('миграция один раз сохраняет 1325, все прогрессы, рекорды и достижения',()=>{
  const t=setup(1325),before=t.economy.snapshot;delete before.gifts;
  before.campaignRewards=levels.map(l=>l.name);before.achievements=['campaign-10','campaign-20','campaign-30','endless-10','endless-25','endless-50'];before.bestSolved=61;
  t.data.set(economyKey,JSON.stringify(before));t.data.set('hexanexus.progress.v2','original progress');t.data.set('hexanexus.arcade.records.v1','original records');t.data.set('hexanexus.music','original music');t.data.set(skinStorageKey,'wizard');
  const migrated=t.reload(),after=migrated.snapshot;expect(after).toEqual({...before,gifts:{version:1,owned:[],sequence:0,pending:null}});expect(migrated.balance).toBe(1325);
  expect(readMotyaSkin(t.storage,true,migrated.gifts.owned)).toBe('classic');expect(motyaCollection('wizard',true,migrated.gifts.owned).ownedSkinIds).toEqual(['classic','royal']);
  const r=migrated.buyGift(()=>0)!;migrated.acknowledgeGift(r.id);expect(t.reload().gifts.owned).toEqual(['baker']);expect(t.reload().balance).toBe(1025);
  expect(t.storage.getItem('hexanexus.progress.v2')).toBe('original progress');expect(t.storage.getItem('hexanexus.arcade.records.v1')).toBe('original records');expect(t.storage.getItem('hexanexus.music')).toBe('original music');
 });
 it('ошибка миграции не уничтожает старую запись и не позволяет покупать',()=>{
  const t=setup(1325),d=t.economy.snapshot;delete d.gifts;t.data.set(economyKey,JSON.stringify(d));const original=t.data.get(economyKey);t.fail();const failed=t.reload();expect(failed.ready).toBe(false);expect(failed.buyGift(()=>0)).toBeNull();expect(t.data.get(economyKey)).toBe(original);
 });
 it('закрытый нельзя надеть; полученный сохраняется в прежнем ключе',()=>{
  const t=setup();expect(saveMotyaSkin(t.storage,'wizard',true,t.economy.gifts.owned)).toBe(false);
  t.economy.buyGift(()=>0);expect(saveMotyaSkin(t.storage,'baker',false,t.economy.gifts.owned)).toBe(true);expect(readMotyaSkin(t.storage,false,t.reload().gifts.owned)).toBe('baker');
  expect(motyaCollection('royal',false,['royal']).ownedSkinIds).not.toContain('royal');
 });
 it('Back закрывает результат, не выходит из приложения и не повторяет покупку',()=>{
  const t=setup(),r=t.economy.buyGift(()=>0)!,exit=vi.fn();let open=true;
  const nav=new BackNavigation({closeModal:()=>{if(!open)return false;open=false;t.economy.acknowledgeGift(r.id);return true;},closeMenu:()=>false,screen:()=> 'wardrobe',home:vi.fn(),pause:vi.fn(),hintExit:vi.fn(),exit});
  expect(nav.handle()).toBe(true);expect(exit).not.toHaveBeenCalled();expect(t.economy.balance).toBe(1200);expect(t.economy.gifts.pending).toBeNull();
 });
 it('повреждённые новые данные не сбрасываются молча',()=>{
  const t=setup(),d=t.economy.snapshot;d.gifts!.owned=['baker','baker'];t.data.set(economyKey,JSON.stringify(d));const original=t.data.get(economyKey);expect(t.reload().ready).toBe(false);expect(t.data.get(economyKey)).toBe(original);
  expect(validGifts({version:1,owned:['royal'],sequence:1,pending:null})).toBe(false);
 });
});
