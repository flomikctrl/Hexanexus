import {describe,it,expect} from 'vitest';
import {Economy,economyKey} from './economy';
import {giftSkinIds,giftGroups,giftOdds,chooseGift,validGifts} from './gifts';
import {motyaSkins,skinById,skinStorageKey,readMotyaSkin,saveMotyaSkin} from './motya-skins';
import {levels} from './levels';
const old=['baker','winter','cosmic','sleepy','wizard'] as const;
const added=['flower','pirate','night','archdemon'] as const;
const completed=levels.map(l=>l.name),sources={completed,bestSolved:61};
function fixture(balance=55){
 const data=new Map<string,string>(),s={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
 const initial=new Economy(s,sources,true),d=initial.snapshot;d.balance=balance;d.gifts={version:1,owned:[...old],sequence:5,pending:null};d.profile={version:1,name:'Flom',avatar:{skin:'wizard',emotion:'SHOCK'},title:'master',frame:'plain',unlockedTitles:['novice','explorer','master']};
 data.set(economyKey,JSON.stringify(d));data.set(skinStorageKey,'cosmic');data.set('hexanexus.music','saved-music');data.set('hexanexus.progress.v2',JSON.stringify({completed,current:29,tutorialSeen:true}));data.set('hexanexus.arcade.records.v1','saved-records');
 return {data,s,d,reload:()=>new Economy(s,sources,true)};
}
describe('Расширение подарков 5 → 9 без сброса профиля',()=>{
 it('содержит 12 костюмов: девять подарочных, базовый и две награды кампаний',()=>{
  expect(motyaSkins).toHaveLength(12);expect(giftSkinIds).toHaveLength(9);expect(motyaSkins.filter(s=>s.acquisition==='gift').map(s=>s.id).sort()).toEqual([...giftSkinIds].sort());
  expect(added.map(id=>skinById(id).rarity)).toEqual(['common','rare','legendary','legendary']);
  for(const id of ['classic','royal','architect'])expect(giftSkinIds).not.toContain(id);
 });
 it('читает полную старую коллекцию как 5/9, не меняя ни одного существующего значения',()=>{
  const f=fixture(),before=Object.fromEntries(f.data),e=f.reload();expect(e.ready).toBe(true);expect(e.initialCredit).toBe(0);expect(e.snapshot).toEqual(f.d);expect(Object.fromEntries(f.data)).toEqual(before);expect(e.gifts.owned).toHaveLength(5);expect(e.buyGift(()=>0)).toBeNull();expect(e.balance).toBe(55);
  for(const id of added){expect(saveMotyaSkin(f.s,id,true,e.gifts.owned)).toBe(false);expect(e.editProfile({avatar:{skin:id,emotion:'IDLE'}})).toBe(false);}expect(f.data.get(skinStorageKey)).toBe('cosmic');
 });
 it('снова разрешает покупку при достаточном балансе; выдаёт новый наряд за 300',()=>{
  const f=fixture(355),e=f.reload(),r=e.buyGift(()=>0)!;expect(r).toEqual({id:6,skin:'flower'});expect(e.balance).toBe(55);expect(e.gifts.owned).toEqual([...old,'flower']);expect(e.buyGift(()=>0)).toBeNull();e.acknowledgeGift(r.id);expect(f.reload().balance).toBe(55);expect(f.reload().gifts.owned).toEqual([...old,'flower']);
 });
 it('расширяет сохранение 1.3.0 без новых начислений и сброса старых полей',()=>{
  const f=fixture(),legacy=structuredClone(f.d);delete legacy.campaign2;delete legacy.profile;f.data.set(economyKey,JSON.stringify(legacy));
  const e=f.reload(),after=e.snapshot;delete after.campaign2;delete after.profile;expect(after).toEqual(legacy);expect(e.initialCredit).toBe(0);expect(f.reload().snapshot).toEqual(e.snapshot);
 });
 it('сохраняет незакрытый старый подарок и не списывает повторно при миграции',()=>{
  const f=fixture(355);f.d.gifts!.pending={id:5,skin:'wizard'};f.data.set(economyKey,JSON.stringify(f.d));const e=f.reload();expect(e.buyGift(()=>0)).toBeNull();expect(e.gifts.pending).toEqual({id:5,skin:'wizard'});expect(e.balance).toBe(355);expect(e.acknowledgeGift(5)).toBe(true);expect(e.buyGift(()=>0)?.id).toBe(6);
 });
 it('открывает четыре оставшихся без повторов, даёт надеть и выбрать любые эмоции аватарки',()=>{
  const f=fixture(1500),e=f.reload(),received=[];
  for(let i=0;i<4;i++){const r=e.buyGift(()=>0)!;expect(added).toContain(r.skin);expect(old).not.toContain(r.skin);received.push(r.skin);expect(e.buyGift(()=>0)).toBeNull();e.acknowledgeGift(r.id);expect(saveMotyaSkin(f.s,r.skin,true,e.gifts.owned)).toBe(true);
   for(const emotion of ['IDLE','SAD','SHOCK'] as const){expect(e.editProfile({avatar:{skin:r.skin,emotion}})).toBe(true);expect(f.reload().profile.avatar).toEqual({skin:r.skin,emotion});}expect(readMotyaSkin(f.s,true,e.gifts.owned)).toBe(r.skin);}
  expect(new Set(received).size).toBe(4);expect(e.gifts.owned).toHaveLength(9);expect(e.balance).toBe(300);const before=e.snapshot;expect(e.buyGift(()=>0)).toBeNull();expect(e.snapshot).toEqual(before);expect(f.reload().snapshot).toEqual(before);
 });
 it('при старых 5/5 шансы остаются 60/25/15, внутри легендарных 50/50',()=>{
  expect(giftGroups.map(g=>g.weight)).toEqual([60,25,15]);const odds=giftOdds(old);expect(odds.map(g=>g.probability)).toEqual([.6,.25,.15]);expect(odds.map(g=>g.skins)).toEqual([['flower'],['pirate'],['night','archdemon']]);
  for(let inner=0;inner<2;inner++){let n=0;expect(chooseGift(old,()=>n++?inner:85)).toBe(inner?'archdemon':'night');}
  expect(giftOdds([...old,'flower']).map(g=>g.probability)).toEqual([0,.625,.375]);expect(validGifts({version:1,owned:[...giftSkinIds],sequence:9,pending:null})).toBe(true);
 });
});
