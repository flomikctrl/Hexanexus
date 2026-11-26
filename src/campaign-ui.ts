import './campaigns.css';
import {campaigns,campaignUnlocked,type CampaignId} from './campaigns';
import type {Progress} from './progress';
export class CampaignSelection {
 private host=document.createElement('section');
 constructor(private progress:(id:CampaignId)=>Progress,private select:(id:CampaignId,play:boolean)=>void,back:()=>void){
  this.host.id='campaign-screen';this.host.className='screen collection-screen';this.host.hidden=true;
  this.host.innerHTML='<header class="collection-heading"><h2>Кампании</h2><button id="campaigns-back">Меню</button></header><div id="campaign-choices"></div>';
  document.getElementById('app')!.append(this.host);document.getElementById('campaigns-back')!.onclick=back;
 }
 setVisible(visible:boolean){this.host.hidden=!visible;if(!visible)return;const choices=this.host.querySelector('#campaign-choices')!;choices.replaceChildren();
  for(const id of ['first','second'] as const){const c=campaigns[id],p=this.progress(id),count=c.levels.filter(l=>p.completed.includes(l.name)).length,unlocked=campaignUnlocked(id,this.progress('first').completed),card=document.createElement('button');
   card.className='campaign-choice';card.dataset.campaign=id;card.dataset.locked=String(!unlocked);
   card.type='button';card.disabled=!unlocked;card.setAttribute('aria-label',`${c.name}, ${c.size}×${c.size}×${c.size}, ${count} из 30${unlocked?'':'. Пройдите первую кампанию'}`);
   card.innerHTML=`<span class="campaign-grid-icon">${c.size}×${c.size}×${c.size}</span><h3>${c.name}</h3><span class="campaign-progress">${count}/30</span><progress value="${count}" max="30" aria-label="${count} из 30"></progress>${unlocked?'':'<span class="campaign-lock">Пройдите первую кампанию</span>'}`;
   card.onclick=()=>{if(campaignUnlocked(id,this.progress('first').completed))this.select(id,false);};choices.append(card);
  }
 }
}
