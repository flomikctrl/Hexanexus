import {describe,it,expect} from 'vitest';
import {Economy,economyKey} from './economy';
import {economySources} from './economy-sources';
import {levels} from './levels';
import {secondLevels} from './levels-second';
import {progressKey,secondProgressKey,writeProgress} from './progress';
import {skinById,motyaSkins,motyaCollection,readMotyaSkin,saveMotyaSkin,skinStorageKey} from './motya-skins';
import {skinUnlockCondition} from './skin-card';
import {giftSkinIds,giftGroups,giftOdds,chooseGift} from './gifts';
import {CampaignRewards} from './campaign-rewards';
const first=levels.map(l=>l.name),second=secondLevels.map(l=>l.name);
function storage(){const data=new Map<string,string>();return {data,getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};}
function fixture(count:number){const s=storage();writeProgress(s,{completed:first,current:29,tutorialSeen:true});writeProgress(s,{completed:second.slice(0,count),current:Math.min(count,29),tutorialSeen:true},secondProgressKey);return {s,e:new Economy(s,economySources(s),true)};}
describe('Мотя-архитектор: настоящая награда второй кампании',()=>{
 it('добавляет восьмой образ и оставляет семь прежних ID на своих местах',()=>{
  expect(motyaSkins.slice(0,8).map(s=>s.id)).toEqual(['classic','sleepy','baker','winter','wizard','cosmic','royal','architect']);
  expect(skinById('architect')).toMatchObject({name:'Мотя-архитектор',rarity:'exclusive',initiallyUnlocked:false,acquisition:'campaign-2-30',canDropFromGifts:false,canPurchase:false});
  expect(skinUnlockCondition(skinById('architect'))).toBe('Пройдите 30 уровней кампании „Новая грань“');
 });
 it.each([0,1,29])('закрыт при %i завершённых уровнях II, даже после всех уровней I',count=>{
  const {e}=fixture(count);expect(e.architectUnlocked).toBe(false);expect(e.editProfile({avatar:{skin:'architect',emotion:'IDLE'}})).toBe(false);
 });
 it('не считает дубликаты, чужие ID и открытый последний уровень завершением',()=>{
  const s=storage();writeProgress(s,{completed:first,current:29,tutorialSeen:true});writeProgress(s,{completed:[...Array(30).fill(second[0]),...first],current:29,tutorialSeen:true},secondProgressKey);
  expect(new Economy(s,economySources(s),true).architectUnlocked).toBe(false);
 });
 it('открывается сразу при чтении ранее завершённой кампании без повторной награды',()=>{
  const {s,e}=fixture(30),before=e.snapshot;expect(e.architectUnlocked).toBe(true);
  const again=new Economy(s,economySources(s),true);expect(again.snapshot).toEqual(before);expect(again.initialCredit).toBe(0);
 });
 it('открывается после живого 30-го завершения и не меняет прежние квитанции',()=>{
  const {e}=fixture(29),before=e.snapshot;expect(e.syncSecondCampaign(second)).toBe(true);expect(e.architectUnlocked).toBe(true);
  expect(e.snapshot.campaignRewards).toEqual(before.campaignRewards);expect(e.gifts).toEqual(before.gifts);
  const balance=e.balance;e.syncSecondCampaign(second);expect(e.balance).toBe(balance);
 });
 it('использует уже сохранённое право и сохраняет обе независимые настройки',()=>{
  const {s,e}=fixture(30),before=e.snapshot,oldProgress=s.getItem(progressKey);s.setItem('hexanexus.music','old-music');
  expect(saveMotyaSkin(s,'architect',true,['architect'])).toBe(true);
  for(const emotion of ['IDLE','SAD','SHOCK'] as const){expect(e.editProfile({avatar:{skin:'architect',emotion}})).toBe(true);expect(new Economy(s,economySources(s),true).profile.avatar).toEqual({skin:'architect',emotion});}
  expect(readMotyaSkin(s,true,['architect'])).toBe('architect');expect(s.getItem(skinStorageKey)).toBe('architect');
  expect(motyaCollection('architect',true,['architect']).ownedSkinIds).toEqual(['classic','royal','architect']);
  const after=e.snapshot;expect(after.balance).toBe(before.balance);expect(after.achievements).toEqual(before.achievements);expect(after.gifts).toEqual(before.gifts);expect(s.getItem(progressKey)).toBe(oldProgress);expect(s.getItem('hexanexus.music')).toBe('old-music');
  expect(JSON.parse(s.getItem(economyKey)!).campaign2.architectUnlocked).toBe(true);
 });
 it('не позволяет надеть без права и сохраняет выбранный старый костюм',()=>{
  const {s}=fixture(29);saveMotyaSkin(s,'royal',true);expect(saveMotyaSkin(s,'architect',true)).toBe(false);expect(readMotyaSkin(s,true)).toBe('royal');
 });
 it('не входит в девять подарочных костюмов и не меняет их шансы',()=>{
  expect(giftSkinIds.slice(0,5)).toEqual(['baker','winter','cosmic','sleepy','wizard']);expect(giftGroups.map(g=>g.weight)).toEqual([60,25,15]);expect(giftOdds([]).map(g=>g.probability)).toEqual([.6,.25,.15]);
  for(let ticket=0;ticket<100;ticket++)expect(chooseGift([],bound=>bound===100?ticket:0)).not.toBe('architect');
 });
 it('Королева остаётся отдельной наградой кампании I',()=>{
  expect(new CampaignRewards(storage(),second).royalUnlocked).toBe(false);expect(new CampaignRewards(storage(),first).royalUnlocked).toBe(true);
  expect(skinById('royal').acquisition).toBe('campaign-30');
 });
});
