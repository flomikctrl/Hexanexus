import {levels} from './levels';

export const royalRewardKey='hexanexus.motya.royal.v1';
// This reward belongs to the original 30 campaign levels, even if more are added.
export const royalCampaignNames=levels.slice(0,30).map(level=>level.name);
type RewardStorage=Pick<Storage,'getItem'|'setItem'>;
export function completedRoyalCampaign(completed:readonly string[]){
  const known=new Set(completed);
  return royalCampaignNames.length===30&&royalCampaignNames.every(name=>known.has(name));
}
function readEntitlement(storage:RewardStorage|undefined){
  try{const value=JSON.parse(storage?.getItem(royalRewardKey)||'null');return value?.version===1&&value?.unlocked===true&&value?.source==='campaign-30';}catch{return false;}
}
export class CampaignRewards {
  private unlocked:boolean;
  get royalUnlocked(){return this.unlocked;}
  constructor(private storage:RewardStorage|undefined,completed:readonly string[]){
    this.unlocked=readEntitlement(storage);
    // Upgrade an old completed save silently. Never require replaying its levels.
    this.recordCampaignCompletion(completed);
  }
  recordCampaignCompletion(completed:readonly string[]):boolean {
    if(this.unlocked||!completedRoyalCampaign(completed))return false;
    this.unlocked=true;
    try{this.storage?.setItem(royalRewardKey,JSON.stringify({version:1,unlocked:true,source:'campaign-30',announcementSeen:true}));}catch{}
    // Only a new live grant produces the congratulation; ownership is permanent.
    return true;
  }
}
