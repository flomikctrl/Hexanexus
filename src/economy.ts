import {levels} from './levels';
import {chooseGift,emptyGifts,validGifts,type GiftCollection,type GiftReceipt} from './gifts';
import {normalizePlayerProfile,editedPlayerProfile,type PlayerProfile,type ProfileEdit} from './player-profile';
import type {MotyaSkinId} from './motya-skins';
import {secondLevels} from './levels-second';

export const economyKey='hexanexus.economy.v1';
export const giftPrice=300;
export const hintPrice=2;
export const economyRewards={starter:50,campaignLevel:20,arcadeRound:5} as const;
export type EconomyStorage=Pick<Storage,'getItem'|'setItem'>;
export const achievements=[
 {id:'campaign-10',group:'campaign',name:'Первые успехи',target:10,reward:100,icon:'steps'},
 {id:'campaign-20',group:'campaign',name:'Мастер кубиков',target:20,reward:150,icon:'cube'},
 {id:'campaign-30',group:'campaign',name:'Легенда мастерской',target:30,reward:250,icon:'crown'},
 {id:'campaign2-10',group:'campaign2',name:'Новая грань: начало',target:10,reward:150,icon:'steps'},
 {id:'campaign2-20',group:'campaign2',name:'Новая грань: мастер',target:20,reward:250,icon:'cube'},
 {id:'campaign2-30',group:'campaign2',name:'Новая грань: покоритель',target:30,reward:500,icon:'crown'},
 {id:'endless-10',group:'endless',name:'Первые шаги',target:10,reward:25,icon:'leaf'},
 {id:'endless-25',group:'endless',name:'Не остановить',target:25,reward:50,icon:'bolt'},
 {id:'endless-50',group:'endless',name:'Железная выдержка',target:50,reward:100,icon:'shield'},
 {id:'endless-100',group:'endless',name:'Повелитель кубиков',target:100,reward:200,icon:'trophy'},
] as const;
export type AchievementId=typeof achievements[number]['id'];
const names=levels.map(l=>l.name),known=new Set(names);
const secondNames=secondLevels.map(l=>l.name),secondKnown=new Set(secondNames),hintKnown=new Set([...names,...secondNames]);
export interface EconomySources {completed:readonly string[];completedSecond?:readonly string[];bestSolved:number;session?:{id:string;solved:number}}
interface HintReceipt {level:string;cost:number;free:boolean}
export interface EconomyData {
 version:1;migration:1;balance:number;initialBonus:boolean;campaignRewards:string[];
 achievements:AchievementId[];freeHints:string[];arcadePaid:Record<string,number>;
 bestSolved:number;spends:Record<string,number>;pendingHint:HintReceipt|null;
 gifts?:GiftCollection;
 profile?:PlayerProfile;
 campaign2?:{version:1;rewards:string[];architectUnlocked:boolean};
}
export interface EconomyChange {credited:number;achievements:AchievementId[];reason:'migration'|'campaign'|'arcade'|'spend'|'hint'|'gift'|'profile'}
const integer=(n:unknown,max=Number.MAX_SAFE_INTEGER):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=max;
const strings=(v:unknown,valid:(s:string)=>boolean):v is string[]=>Array.isArray(v)&&v.every(x=>typeof x==='string'&&valid(x))&&new Set(v).size===v.length;
const entries=(v:unknown,positive=false)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.entries(v).every(([id,n])=>id.length>0&&id.length<=100&&integer(n)&&(!positive||Number(n)>0));
function decode(raw:string):EconomyData|null {
 try{
  const d=JSON.parse(raw);
  if(d?.version!==1||d.migration!==1||!integer(d.balance)||d.initialBonus!==true||!integer(d.bestSolved,1e8))return null;
  if(!strings(d.campaignRewards,s=>known.has(s))||!strings(d.freeHints,s=>hintKnown.has(s))||!strings(d.achievements,s=>achievements.some(a=>a.id===s)))return null;
  if(!entries(d.arcadePaid)||!Object.values(d.arcadePaid).every(n=>integer(n,1e8))||!entries(d.spends,true))return null;
  if(d.gifts!==undefined&&!validGifts(d.gifts))return null;
  if(d.campaign2!==undefined&&(d.campaign2?.version!==1||!strings(d.campaign2.rewards,s=>secondKnown.has(s))||typeof d.campaign2.architectUnlocked!=='boolean'))return null;
  const h=d.pendingHint;if(h!==null&&(!h||!hintKnown.has(h.level)||!d.freeHints.includes(h.level)||typeof h.free!=='boolean'||h.cost!==(h.free?0:hintPrice)))return null;
  return d;
 }catch{return null;}
}
export function hexics(amount:number){
 const n=Math.abs(amount),last=n%10,teen=n%100>=11&&n%100<=14;
 return `${amount.toLocaleString('ru-RU')} ${!teen&&last===1?'гексик':!teen&&last>=2&&last<=4?'гексика':'гексиков'}`;
}
const fresh=():EconomyData=>({version:1,migration:1,balance:0,initialBonus:true,campaignRewards:[],achievements:[],freeHints:[],arcadePaid:{},bestSolved:0,spends:{},pendingHint:null});
export class Economy {
 private data:EconomyData=fresh();
 private listeners=new Set<(change:EconomyChange)=>void>();
 ready=false;error='';initialCredit=0;initialAchievements:AchievementId[]=[];
 get balance(){return this.data.balance;}
 get snapshot(){return structuredClone(this.data);}
 constructor(private storage:EconomyStorage|undefined,sources:EconomySources,private profileRoyalUnlocked=false){
  let raw:string|null;try{if(!storage)throw Error();raw=storage.getItem(economyKey);}catch{this.error='Гексики недоступны: хранилище не отвечает.';return;}
  if(raw!==null){const parsed=decode(raw);if(!parsed){this.error='Не удалось прочитать гексики. Старые данные сохранены без изменений.';return;}this.data=parsed;}
  this.ready=true;
  const change:EconomyChange={credited:0,achievements:[],reason:'migration'};
  const ok=this.commit(d=>{
   // Versioned once-only migration: former free test outfits are not purchases.
   if(!d.gifts)d.gifts=emptyGifts();
   if(!d.campaign2)d.campaign2={version:1,rewards:[],architectUnlocked:false};
   if(raw===null){d.balance+=economyRewards.starter;change.credited+=economyRewards.starter;if(sources.session&&this.validSession(sources.session.id,sources.session.solved))d.arcadePaid[sources.session.id]=sources.session.solved;}
   // A reservation interrupted before delivery is refunded, not charged again.
   if(d.pendingHint){const h=d.pendingHint;d.balance+=h.cost;if(h.free)d.freeHints=d.freeHints.filter(n=>n!==h.level);d.pendingHint=null;}
   this.campaign(d,sources.completed,change);
   this.secondCampaign(d,sources.completedSecond??[],change);
   d.bestSolved=Math.max(d.bestSolved,integer(sources.bestSolved,1e8)?sources.bestSolved:0);
   if(raw!==null&&sources.session)this.arcade(d,sources.session.id,sources.session.solved,change);
   this.unlock(d,change);
   d.profile=normalizePlayerProfile(d.profile,sources.completed,skin=>this.profileCanUse(d,skin),d.campaign2.rewards);
  },change,true);
  if(!ok)this.ready=false;else{this.initialCredit=change.credited;this.initialAchievements=change.achievements;}
 }
 subscribe(listener:(change:EconomyChange)=>void){this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
 get gifts(){return structuredClone(this.data.gifts??emptyGifts());}
 get architectUnlocked(){return this.data.campaign2?.architectUnlocked===true;}
 get profile(){return normalizePlayerProfile(this.data.profile,this.data.campaign2?.rewards.length?this.data.campaignRewards:[],skin=>this.profileCanUse(this.data,skin),this.data.campaign2?.rewards??[]);}
 private profileCanUse(d:EconomyData,skin:MotyaSkinId){return skin==='classic'||(skin==='royal'?(this.profileRoyalUnlocked||names.slice(0,30).every(n=>d.campaignRewards.includes(n))):skin==='architect'?d.campaign2?.architectUnlocked===true:!!d.gifts?.owned.some(id=>id===skin));}
 editProfile(edit:ProfileEdit){
  if(!this.ready||!this.data.profile)return false;
  const next=editedPlayerProfile(this.data.profile,edit,skin=>this.profileCanUse(this.data,skin));
  if(!next){this.error='Проверьте имя и доступность выбранного оформления.';return false;}
  return this.commit(d=>{d.profile=next;},{credited:0,achievements:[],reason:'profile'});
 }
 private buyingGift=false;
 buyGift(below?:(bound:number)=>number):GiftReceipt|null{
  if(this.buyingGift||!this.ready||!this.data.gifts||this.data.gifts.pending||this.data.pendingHint||this.balance<giftPrice)return null;
  this.buyingGift=true;
  try{
   const stored=this.storage?.getItem(economyKey);
   if(!stored||JSON.stringify(decode(stored))!==JSON.stringify(this.data)){this.error='Сохранение изменилось. Перезапустите игру перед открытием подарка.';return null;}
   const skin=chooseGift(this.data.gifts.owned,below);if(!skin)return null;
   const receipt:GiftReceipt={id:this.data.gifts.sequence+1,skin};
   const ok=this.commit(d=>{d.balance-=giftPrice;d.gifts!.owned.push(skin);d.gifts!.sequence=receipt.id;d.gifts!.pending=receipt;},{credited:0,achievements:[],reason:'gift'});
   return ok?receipt:null;
  }catch{this.error='Не удалось открыть подарок. Гексики не списаны. Попробуйте ещё раз.';return null;}
  finally{this.buyingGift=false;}
 }
 acknowledgeGift(id:number){
  if(!this.data.gifts?.pending)return true;
  if(this.data.gifts.pending.id!==id)return false;
  return this.commit(d=>{d.gifts!.pending=null;},{credited:0,achievements:[],reason:'gift'});
 }
 private commit(mutator:(d:EconomyData)=>void,change:EconomyChange,silent=false){
  if(!this.ready||!this.storage)return false;
  const next=structuredClone(this.data);mutator(next);
  if(!integer(next.balance)){this.error='Не удалось сохранить гексики.';return false;}
  try{if(JSON.stringify(next)!==JSON.stringify(this.data)||silent)this.storage.setItem(economyKey,JSON.stringify(next));}
  catch{this.error='Не удалось сохранить гексики. Проверьте свободное место.';return false;}
  this.data=next;this.error='';if(!silent)for(const listener of this.listeners){try{listener(change);}catch(error){console.error('Не удалось обновить отображение гексиков',error);}}return true;
 }
 private unlock(d:EconomyData,c:EconomyChange){for(const a of achievements)if(!d.achievements.includes(a.id)&&(a.group==='campaign'?d.campaignRewards.length:a.group==='campaign2'?(d.campaign2?.rewards.length??0):d.bestSolved)>=a.target){d.achievements.push(a.id);d.balance+=a.reward;c.credited+=a.reward;c.achievements.push(a.id);}}
 private campaign(d:EconomyData,completed:readonly string[],c:EconomyChange){for(const name of new Set(completed))if(known.has(name)&&!d.campaignRewards.includes(name)){d.campaignRewards.push(name);d.balance+=economyRewards.campaignLevel;c.credited+=economyRewards.campaignLevel;}this.unlock(d,c);}
 syncCampaign(completed:readonly string[]){const c:EconomyChange={credited:0,achievements:[],reason:'campaign'};return this.commit(d=>{this.campaign(d,completed,c);d.profile=normalizePlayerProfile(d.profile,completed,skin=>this.profileCanUse(d,skin),d.campaign2?.rewards??[]);},c);}
 private secondCampaign(d:EconomyData,completed:readonly string[],change:EconomyChange){
  if(!names.every(n=>d.campaignRewards.includes(n))||!d.campaign2)return;
  for(const name of new Set(completed))if(secondKnown.has(name)&&!d.campaign2.rewards.includes(name)){d.campaign2.rewards.push(name);d.balance+=50;change.credited+=50;}
  if(secondNames.every(n=>d.campaign2!.rewards.includes(n)))d.campaign2.architectUnlocked=true;
  this.unlock(d,change);
 }
 syncSecondCampaign(completed:readonly string[]){if(!names.every(n=>this.data.campaignRewards.includes(n)))return false;const c:EconomyChange={credited:0,achievements:[],reason:'campaign'};return this.commit(d=>{this.secondCampaign(d,completed,c);d.profile=normalizePlayerProfile(d.profile,d.campaignRewards,skin=>this.profileCanUse(d,skin),d.campaign2?.rewards??[]);},c);}
 private validSession(id:string,solved:number){return typeof id==='string'&&id.length>0&&id.length<=80&&integer(solved,1e8)&&!['__proto__','constructor','prototype'].includes(id);}
 private arcade(d:EconomyData,id:string,solved:number,c:EconomyChange){
  if(!this.validSession(id,solved))return;
  const paid=Object.hasOwn(d.arcadePaid,id)?d.arcadePaid[id]:0,delta=Math.max(0,solved-paid);
  d.arcadePaid[id]=Math.max(paid,solved);d.balance+=delta*economyRewards.arcadeRound;c.credited+=delta*economyRewards.arcadeRound;d.bestSolved=Math.max(d.bestSolved,solved);this.unlock(d,c);
 }
 recordArcade(id:string,solved:number){const c:EconomyChange={credited:0,achievements:[],reason:'arcade'};return this.commit(d=>this.arcade(d,id,solved,c),c);}
 hintCost(level:string){return this.data.freeHints.includes(level)?hintPrice:0;}
 reserveHint(level:string){
  if(!this.ready||!hintKnown.has(level)||this.data.pendingHint)return false;
  const cost=this.hintCost(level);if(this.balance<cost){this.error=`Для подсказки нужно ${hexics(cost)}.`;return false;}
  return this.commit(d=>{d.balance-=cost;const free=!d.freeHints.includes(level);if(free)d.freeHints.push(level);d.pendingHint={level,cost,free};},{credited:0,achievements:[],reason:'hint'});
 }
 confirmHint(){return this.commit(d=>{d.pendingHint=null;},{credited:0,achievements:[],reason:'hint'});}
 cancelHint(){return this.commit(d=>{const h=d.pendingHint;if(h){d.balance+=h.cost;if(h.free)d.freeHints=d.freeHints.filter(n=>n!==h.level);d.pendingHint=null;}},{credited:0,achievements:[],reason:'hint'});}
 // Legacy idempotent debit API. Gifts use buyGift to persist ownership atomically.
 spend(amount:number,operationId:string){
  if(!integer(amount)||amount===0||!this.validSession(operationId,0)||!this.ready)return false;
  if(Object.hasOwn(this.data.spends,operationId))return this.data.spends[operationId]===amount;
  if(this.balance<amount||this.data.pendingHint)return false;
  return this.commit(d=>{d.balance-=amount;d.spends[operationId]=amount;},{credited:0,achievements:[],reason:'spend'});
 }
}
