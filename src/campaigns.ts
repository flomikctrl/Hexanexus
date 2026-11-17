import {levels,levelGroups} from './levels';
import {secondLevels,secondLevelGroups} from './levels-second';
import {completedRoyalCampaign} from './campaign-rewards';
import {isLevelUnlocked} from './progress';
export type CampaignId='first'|'second';
export const campaigns={
 first:{id:'first' as const,name:'Первые силуэты',label:'Кампания I',size:3 as const,levels,groups:levelGroups,reward:20},
 second:{id:'second' as const,name:'Новая грань',label:'Кампания II',size:4 as const,levels:secondLevels,groups:secondLevelGroups,reward:50}
};
export const campaignUnlocked=(id:CampaignId,firstCompleted:readonly string[])=>id==='first'||completedRoyalCampaign(firstCompleted);
export const completedSecondCampaign=(completed:readonly string[])=>secondLevels.every(l=>completed.includes(l.name));
export function campaignLevelUnlocked(id:CampaignId,index:number,completed:readonly string[],current=0){
 const names=campaigns[id].levels.map(l=>l.name);
 return id==='first'?isLevelUnlocked(index,names,[...completed],current):index>=0&&index<names.length&&(completed.includes(names[index])||names.slice(0,index).every(n=>completed.includes(n)));
}
export const architectReward={id:'architect',name:'Мотя-архитектор',source:'campaign-2',canDropFromGifts:false,canPurchase:false,assetsReady:true,requiredSprites:['idle.png','sad.png','shock.png']} as const;
