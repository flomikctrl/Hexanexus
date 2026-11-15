import {describe,it,expect} from 'vitest';
import {Economy,economyKey,achievements,hexics,giftPrice,type EconomyData} from './economy';
import {economySources} from './economy-sources';
import {levels} from './levels';
import {progressKey} from './progress';
import {ArcadeSession,arcadeRecordsKey,arcadeSaveKey} from './arcade';
import {taskGroups} from './arcade-generator';
import {matches} from './projections';
import {CampaignRewards,royalRewardKey} from './campaign-rewards';

class Memory {
 data=new Map<string,string>();fail=false;failRead=false;afterWrite=false;
 getItem(k:string){if(this.failRead)throw Error('read unavailable');return this.data.get(k)??null;}
 setItem(k:string,v:string){if(this.fail&&k===economyKey)throw Error('quota');this.data.set(k,v);if(this.afterWrite&&k===economyKey){this.afterWrite=false;throw Error('interrupted after durable write');}}
}
const completed=(n:number)=>levels.slice(0,n).map(l=>l.name);
const load=(s:Memory)=>new Economy(s,economySources(s));
const oldCampaign=(s:Memory,n:number)=>s.setItem(progressKey,JSON.stringify({completed:completed(n),current:29,tutorialSeen:true}));
const solve=(s:ArcadeSession)=>{const op=taskGroups(s.state.fixed,s.puzzle.placed).flat().find(op=>matches(op.targets,s.state.targets))!;return s.act(op.tool,op.cell);};
const records=(s:Memory,bestRound:number)=>s.setItem(arcadeRecordsKey,JSON.stringify({version:1,bestRound,bestScore:9999,bestStreak:0,games:1,counted:['old']}));

describe('economy migration and campaign',()=>{
 it.each([[0,50],[5,150],[10,350],[20,700],[30,1150]])('migrates %i completed levels to %i, exactly once',(n,balance)=>{
  const s=new Memory();oldCampaign(s,n);const original=s.getItem(progressKey);const e=load(s);expect(e.ready).toBe(true);expect(e.balance).toBe(balance);expect(e.initialCredit).toBe(balance);
  const raw=s.getItem(economyKey);for(let i=0;i<3;i++){expect(load(s).balance).toBe(balance);expect(load(s).initialCredit).toBe(0);expect(s.getItem(economyKey)).toBe(raw);}expect(s.getItem(progressKey)).toBe(original);
 });
 it('does not mistake unlock/current index, duplicates or unknown names for completions',()=>{
  const s=new Memory();s.setItem(progressKey,JSON.stringify({completed:[levels[0].name,levels[0].name,'unknown',null,12],current:29}));expect(load(s).balance).toBe(70);expect(load(s).snapshot.campaignRewards).toEqual([levels[0].name]);
 });
 it('awards each new completion once, even on repeat win notifications',()=>{
  const s=new Memory(),e=load(s);e.syncCampaign(completed(1));expect(e.balance).toBe(70);e.syncCampaign(completed(1));expect(e.balance).toBe(70);e.syncCampaign(completed(2));expect(e.balance).toBe(90);expect(load(s).balance).toBe(90);
 });
 it('recovers a campaign save committed just before the reward handler was interrupted',()=>{
  const s=new Memory();load(s);oldCampaign(s,10);expect(load(s).balance).toBe(350);expect(load(s).balance).toBe(350);
 });
 it.each([[9,230,0],[10,350,1],[19,530,1],[20,700,2],[29,880,2],[30,1150,3]])('campaign threshold %i yields %i and %i badges',(n,balance,count)=>{
  const s=new Memory(),e=load(s);e.syncCampaign(completed(n));expect(e.balance).toBe(balance);expect(e.snapshot.achievements).toHaveLength(count);e.syncCampaign(completed(n));expect(e.balance).toBe(balance);
 });
 it('preserves skins, music, royal ownership, legacy campaign and arcade records',()=>{
  const s=new Memory();oldCampaign(s,30);records(s,62);s.setItem('hexanexus.music','{"enabled":true,"volume":0.1}');s.setItem('hexanexus.motya.skin.v1','royal');new CampaignRewards(s,completed(30));expect(s.getItem(royalRewardKey)).not.toBeNull();
  const before=new Map(s.data);const e=load(s);expect(e.balance).toBe(1325);expect(e.snapshot.achievements).toHaveLength(6);for(const [k,v] of before)expect(s.getItem(k)).toBe(v);
 });
 it('only pays achievements for old records, never retroactive base rewards',()=>{const s=new Memory();records(s,62);const e=load(s);expect(e.balance).toBe(225);expect(e.snapshot.arcadePaid).toEqual({});expect(load(s).balance).toBe(225);});
 it.each([[10,0],[11,25],[25,25],[26,75],[50,75],[51,175],[100,175],[101,375]])('old displayed round %i grants %i in achievements',(round,reward)=>{const s=new Memory();records(s,round);expect(load(s).balance).toBe(50+reward);});
 it('ignores corrupt legacy data rather than guessing progress',()=>{const s=new Memory();s.setItem(progressKey,'{broken');s.setItem(arcadeRecordsKey,'{"version":1,"bestRound":101}');expect(load(s).balance).toBe(50);expect(s.getItem(progressKey)).toBe('{broken');});
});

describe('unlimited arcade income and crash recovery',()=>{
 it('pays 555 base currency across 30,20,30,31, independent of records',()=>{
  const s=new Memory(),e=load(s);for(const [game,count] of [30,20,30,31].entries())for(let solved=1;solved<=count;solved++)e.recordArcade('game-'+game,solved);
  const badgeRewards=achievements.filter(a=>e.snapshot.achievements.includes(a.id)).reduce((sum,a)=>sum+a.reward,0);expect(e.balance-50-badgeRewards).toBe(555);expect(badgeRewards).toBe(75);expect(e.balance).toBe(680);
 });
 it('deduplicates only within a session and retains paid rounds after reload',()=>{
  const s=new Memory();const e=load(s);e.recordArcade('one',1);e.recordArcade('one',1);e.recordArcade('two',1);expect(e.balance).toBe(60);const again=load(s);again.recordArcade('one',1);expect(again.balance).toBe(60);again.recordArcade('one',2);expect(again.balance).toBe(65);
 });
 it.each([[9,45,0],[10,75,1],[24,145,1],[25,200,2],[49,320,2],[50,425,3],[99,670,3],[100,875,4]])('after %i solved, grants %i plus starter and %i badges',(solved,reward,count)=>{
  const s=new Memory(),e=load(s);e.recordArcade('game',solved);expect(e.balance).toBe(50+reward);expect(e.snapshot.achievements).toHaveLength(count);e.recordArcade('game',solved);expect(e.balance).toBe(50+reward);
 });
 it('awards on actual successful actions, not mistakes, timeout, pause or final results',()=>{
  const store=new Memory(),e=load(store);let now=0;const session=ArcadeSession.create(22,store,()=>now,event=>{if(event.type==='correct')e.recordArcade(event.id,event.round-1);});session.resume();
  expect(solve(session)).toBe('correct');expect(e.balance).toBe(55);session.pause();session.resume();expect(e.balance).toBe(55);
  const wrong=taskGroups(session.state.fixed,session.puzzle.placed).flat().find(op=>!matches(op.targets,session.state.targets))!;expect(session.act(wrong.tool,wrong.cell)).toBe('mistake');expect(e.balance).toBe(55);now+=95000;session.tick();now+=95000;session.tick();expect(session.state.finished).toBe(true);expect(e.balance).toBe(55);expect(load(store).balance).toBe(55);
 });
 it('baselines an old resumed party and pays only subsequent solves',()=>{
  const store=new Memory();const old=ArcadeSession.create(15,store,()=>0);old.resume();for(let i=0;i<61;i++)solve(old);
  const before=store.getItem(arcadeSaveKey),e=load(store);expect(e.balance).toBe(225);expect(e.snapshot.arcadePaid[old.state.id]).toBe(61);expect(store.getItem(arcadeSaveKey)).toBe(before);
  const restored=ArcadeSession.restore(store,()=>0,event=>{if(event.type==='correct')e.recordArcade(event.id,event.round-1);})!;restored.resume();solve(restored);expect(e.balance).toBe(230);expect(load(store).balance).toBe(230);
 });
 it('recovers the gap between durable round completion and economy delivery exactly once',()=>{
  const store=new Memory();load(store);const session=ArcadeSession.create(88,store,()=>0,event=>{if(event.type==='correct')throw Error('process stopped');});session.resume();expect(()=>solve(session)).toThrow('process stopped');expect(JSON.parse(store.getItem(arcadeSaveKey)!).round).toBe(2);expect(load(store).balance).toBe(55);expect(load(store).balance).toBe(55);
 });
 it('survives termination after wallet write and before in-memory acknowledgement',()=>{
  const store=new Memory(),e=load(store);store.afterWrite=true;e.recordArcade('same',1);const restored=load(store);expect(restored.balance).toBe(55);restored.recordArcade('same',1);expect(restored.balance).toBe(55);
 });
 it('does not forget old session receipts after many newer sessions',()=>{const s=new Memory(),e=load(s);for(let i=0;i<150;i++)e.recordArcade('session-'+i,1);expect(e.balance).toBe(800);const restored=load(s);restored.recordArcade('session-0',1);expect(restored.balance).toBe(800);});
});

describe('hint fees and safe debits',()=>{
 it('first hint per level is free for lifetime, subsequent hints cost two',()=>{
  const s=new Memory(),e=load(s),name=levels[0].name;expect(e.hintCost(name)).toBe(0);expect(e.reserveHint(name)).toBe(true);e.confirmHint();expect(e.balance).toBe(50);expect(e.hintCost(name)).toBe(2);expect(e.reserveHint(name)).toBe(true);e.confirmHint();expect(e.balance).toBe(48);
  const again=load(s);expect(again.hintCost(name)).toBe(2);again.reserveHint(name);again.confirmHint();expect(again.balance).toBe(46);expect(again.hintCost(levels[1].name)).toBe(0);
 });
 it('insufficient funds does not deliver or consume a further hint',()=>{const e=load(new Memory()),name=levels[0].name;e.reserveHint(name);e.confirmHint();e.spend(49,'other');expect(e.reserveHint(name)).toBe(false);expect(e.balance).toBe(1);expect(e.snapshot.pendingHint).toBeNull();});
 it('a technical lock cannot charge another queued request',()=>{const e=load(new Memory()),name=levels[0].name;e.reserveHint(name);e.confirmHint();e.reserveHint(name);const b=e.balance;expect(e.reserveHint(name)).toBe(false);expect(e.balance).toBe(b);e.confirmHint();});
 it('cancels an undelivered hint without a fee or a consumed free attempt',()=>{const e=load(new Memory()),name=levels[0].name;e.reserveHint(name);e.cancelHint();expect(e.hintCost(name)).toBe(0);expect(e.balance).toBe(50);e.reserveHint(name);e.confirmHint();e.reserveHint(name);expect(e.balance).toBe(48);e.cancelHint();expect(e.balance).toBe(50);expect(e.hintCost(name)).toBe(2);});
 it('recovers an interrupted free hint reservation without reissuing starter rewards',()=>{const s=new Memory(),e=load(s),name=levels[0].name;e.reserveHint(name);const restored=load(s);expect(restored.balance).toBe(50);expect(restored.hintCost(name)).toBe(0);expect(restored.initialCredit).toBe(0);});
 it('refunds a paid hint interrupted before display acknowledgement exactly once',()=>{const s=new Memory(),e=load(s),name=levels[0].name;e.reserveHint(name);e.confirmHint();e.reserveHint(name);expect(e.balance).toBe(48);const restored=load(s);expect(restored.balance).toBe(50);expect(restored.hintCost(name)).toBe(2);expect(load(s).balance).toBe(50);});
 it('confirmed spending survives reboot and does not re-enable free hints',()=>{const s=new Memory(),e=load(s),name=levels[0].name;e.reserveHint(name);e.confirmHint();e.reserveHint(name);e.confirmHint();expect(load(s).balance).toBe(48);expect(load(s).hintCost(name)).toBe(2);});
 it('atomic write failure cannot consume balance or a free hint',()=>{const s=new Memory(),e=load(s);s.fail=true;const before=s.getItem(economyKey);expect(e.reserveHint(levels[0].name)).toBe(false);expect(e.balance).toBe(50);expect(e.hintCost(levels[0].name)).toBe(0);expect(s.getItem(economyKey)).toBe(before);});
 it('future debit API is idempotent and has no boxes or inventory side effects',()=>{const s=new Memory();oldCampaign(s,30);const e=load(s);expect(giftPrice).toBe(300);expect(e.spend(300,'future-order')).toBe(true);expect(e.balance).toBe(850);expect(e.spend(300,'future-order')).toBe(true);expect(e.balance).toBe(850);expect(e.spend(301,'future-order')).toBe(false);expect(load(s).balance).toBe(850);expect([...s.data.keys()].sort()).toEqual([economyKey,progressKey].sort());});
 it.each([0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER])('rejects invalid or unaffordable debit %s',amount=>{const e=load(new Memory());expect(e.spend(amount,'invalid')).toBe(false);expect(e.balance).toBe(50);});
 it('does not grant rewards or mark them paid if storage rejected the transaction',()=>{const s=new Memory(),e=load(s);s.fail=true;e.syncCampaign(completed(10));e.recordArcade('id',1);expect(e.balance).toBe(50);expect(e.snapshot.campaignRewards).toHaveLength(0);expect(e.snapshot.arcadePaid).toEqual({});s.fail=false;e.syncCampaign(completed(10));expect(e.balance).toBe(350);});
 it('starter and receipt survive an interruption immediately after the first write',()=>{const s=new Memory();s.afterWrite=true;load(s);expect(load(s).balance).toBe(50);expect(load(s).initialCredit).toBe(0);});
 it('preserves malformed or unknown economy records without overwriting them',()=>{for(const raw of ['{broken','{}','{"version":99}','{"version":1,"balance":50}']){const s=new Memory();oldCampaign(s,30);s.setItem(economyKey,raw);const e=load(s);expect(e.ready).toBe(false);expect(e.spend(1,'no')).toBe(false);expect(s.getItem(economyKey)).toBe(raw);expect(s.getItem(progressKey)).not.toBeNull();}});
 it('fails closed when storage is unavailable',()=>{const s=new Memory();s.failRead=true;expect(load(s).ready).toBe(false);const e=new Economy(undefined,{completed:[],bestSolved:0});expect(e.reserveHint(levels[0].name)).toBe(false);});
 it('stores a complete debit and its operation receipt together',()=>{const s=new Memory(),e=load(s);s.afterWrite=true;expect(e.spend(10,'interrupt')).toBe(false);const restored=load(s);expect(restored.balance).toBe(40);expect(restored.spend(10,'interrupt')).toBe(true);expect(restored.balance).toBe(40);});
 it('rejects tampered negative balances without clearing data',()=>{const s=new Memory();const e=load(s),data=e.snapshot;data.balance=-1;s.setItem(economyKey,JSON.stringify(data));expect(load(s).ready).toBe(false);expect(JSON.parse(s.getItem(economyKey)!).balance).toBe(-1);});
 it('uses a neutral storage key and data fields for future naming changes',()=>{const e=load(new Memory());expect(economyKey).toBe('hexanexus.economy.v1');expect(Object.keys(e.snapshot)).not.toContain('stars');});
});

describe('currency grammar',()=>{
 it.each([[1,'1 гексик'],[2,'2 гексика'],[5,'5 гексиков'],[11,'11 гексиков'],[12,'12 гексиков'],[14,'14 гексиков'],[21,'21 гексик'],[22,'22 гексика'],[25,'25 гексиков'],[101,'101 гексик'],[111,'111 гексиков'],[0,'0 гексиков']])('formats %i correctly',(value,text)=>expect(hexics(Number(value))).toBe(text));
});
