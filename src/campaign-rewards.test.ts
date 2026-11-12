import {describe,it,expect} from 'vitest';
import {CampaignRewards,completedRoyalCampaign,royalCampaignNames,royalRewardKey} from './campaign-rewards';
import {motyaSkins,motyaCollection,readMotyaSkin,saveMotyaSkin,skinStorageKey} from './motya-skins';
import {readProgress,progressKey} from './progress';

function memory(initial:Record<string,string>={}){const data=new Map(Object.entries(initial));return {data,getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}
describe('Эксклюзивная награда реальной кампании',()=>{
  it('остаётся только наградой кампании, седьмым и изначально закрытым костюмом',()=>{
    expect(motyaSkins).toHaveLength(7);const royal=motyaSkins.find(s=>s.id==='royal')!;
    expect(royal).toMatchObject({name:'Королева Мотя',rarity:'exclusive',initiallyUnlocked:false,acquisition:'campaign-30',canDropFromGifts:false,canPurchase:false});
    expect(motyaCollection('classic').ownedSkinIds).not.toContain('royal');expect(motyaCollection('classic',true).ownedSkinIds).toHaveLength(7);
  });
  it.each([0,1,10,29])('не выдаётся за %s пройденных уровней',count=>{
    const rewards=new CampaignRewards(memory(),royalCampaignNames.slice(0,count));expect(rewards.royalUnlocked).toBe(false);
  });
  it('не путает доступный последний уровень с пройденной кампанией',()=>{
    const storage=memory({[progressKey]:JSON.stringify({completed:[royalCampaignNames[29]],current:29,tutorialSeen:true})});
    const p=readProgress(storage,30);expect(p.current).toBe(29);expect(new CampaignRewards(storage,p.completed).royalUnlocked).toBe(false);
  });
  it('не принимает повторения и посторонние имена вместо реальных уровней',()=>{
    expect(completedRoyalCampaign(Array(30).fill(royalCampaignNames[0]))).toBe(false);
    expect(completedRoyalCampaign([...royalCampaignNames.slice(0,29),'Несуществующий уровень'])).toBe(false);
    expect(completedRoyalCampaign(Array.from({length:30},(_,i)=>'Уровень '+i))).toBe(false);
    expect(completedRoyalCampaign([...royalCampaignNames].reverse())).toBe(true);
  });
  it('разблокирует один раз при живом завершении всех уровней',()=>{
    const storage=memory(),rewards=new CampaignRewards(storage,[]);
    expect(rewards.recordCampaignCompletion(royalCampaignNames.slice(0,29))).toBe(false);
    expect(rewards.recordCampaignCompletion(royalCampaignNames)).toBe(true);expect(rewards.royalUnlocked).toBe(true);
    expect(rewards.recordCampaignCompletion(royalCampaignNames)).toBe(false);
    expect(JSON.parse(storage.getItem(royalRewardKey)!)).toMatchObject({unlocked:true,source:'campaign-30',announcementSeen:true});
  });
  it('мигрирует старое полное прохождение без повторного поздравления и изменений старых ключей',()=>{
    const original=JSON.stringify({completed:royalCampaignNames,current:29,tutorialSeen:true,resume:{level:royalCampaignNames[29],placed:[]}});
    const storage=memory({[progressKey]:original,'hexanexus.music':'{"enabled":false,"volume":0.3}',[skinStorageKey]:'wizard','hexanexus.phoebe.enabled':'false'});
    const rewards=new CampaignRewards(storage,readProgress(storage,30).completed);expect(rewards.royalUnlocked).toBe(true);
    expect(rewards.recordCampaignCompletion(royalCampaignNames)).toBe(false);
    expect(storage.getItem(progressKey)).toBe(original);expect(storage.getItem('hexanexus.music')).toBe('{"enabled":false,"volume":0.3}');expect(storage.getItem(skinStorageKey)).toBe('wizard');expect(storage.getItem('hexanexus.phoebe.enabled')).toBe('false');
  });
  it('сохраняет право навсегда после перезапуска и начала новой попытки',()=>{
    const storage=memory(),first=new CampaignRewards(storage,[]);first.recordCampaignCompletion(royalCampaignNames);
    const restarted=new CampaignRewards(storage,[]);expect(restarted.royalUnlocked).toBe(true);expect(restarted.recordCampaignCompletion(royalCampaignNames)).toBe(false);
  });
  it('не надевает royal без права и сохраняет выбор в прежнем ключе после получения',()=>{
    const storage=memory({[skinStorageKey]:'wizard'});expect(saveMotyaSkin(storage,'royal')).toBe(false);expect(readMotyaSkin(storage)).toBe('wizard');
    storage.setItem(skinStorageKey,'royal');expect(readMotyaSkin(storage)).toBe('classic');expect(motyaCollection('royal').equippedSkinId).toBe('classic');
    expect(saveMotyaSkin(storage,'royal',true)).toBe(true);expect(readMotyaSkin(storage,true)).toBe('royal');
  });
  it('безопасно обрабатывает повреждённую запись и недоступное хранилище',()=>{
    for(const value of ['bad','true','{"unlocked":true}','{"version":1,"unlocked":true,"source":"gift"}'])expect(new CampaignRewards(memory({[royalRewardKey]:value}),[]).royalUnlocked).toBe(false);
    const blocked={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');}};
    const rewards=new CampaignRewards(blocked,[]);expect(rewards.recordCampaignCompletion(royalCampaignNames)).toBe(true);expect(rewards.royalUnlocked).toBe(true);expect(rewards.recordCampaignCompletion(royalCampaignNames)).toBe(false);
  });
});
