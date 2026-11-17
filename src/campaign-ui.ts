import './campaigns.css';
import {campaigns,campaignUnlocked,type CampaignId} from './campaigns';
import type {Progress} from './progress';
export class CampaignSelection {
 private host=document.createElement('section');
 constructor(private progress:(id:CampaignId)=>Progress,private select:(id:CampaignId,play:boolean)=>void,back:()=>void){
  this.host.id='campaign-screen';this.host.className='screen collection-screen';this.host.hidden=true;
  this.host.innerHTML='<header class="collection-heading"><div><small>ДВЕ ГРАНИ МАСТЕРСКОЙ</small><h2>Выберите кампанию</h2></div><button id="campaigns-back">← Меню</button></header><div id="campaign-choices"></div>';
  document.getElementById('app')!.append(this.host);document.getElementById('campaigns-back')!.onclick=back;
 }
 setVisible(visible:boolean){this.host.hidden=!visible;if(!visible)return;const choices=this.host.querySelector('#campaign-choices')!;choices.replaceChildren();
  for(const id of ['first','second'] as const){const c=campaigns[id],p=this.progress(id),count=c.levels.filter(l=>p.completed.includes(l.name)).length,unlocked=campaignUnlocked(id,this.progress('first').completed),card=document.createElement('article');
   card.className='campaign-choice';card.dataset.campaign=id;card.dataset.locked=String(!unlocked);
   card.innerHTML=`<span class="campaign-grid-icon" aria-hidden="true">${c.size}×${c.size}×${c.size}</span><small>${c.label}</small><h3>${c.name}</h3><div class="campaign-progress">${count}/30 <span>уровней пройдено</span></div><progress value="${count}" max="30" aria-label="${count} из 30"></progress><p>${id==='first'?'Награда: Королева Мотя · +20 гексиков за уровень':'Новая пространственная задача · +50 гексиков за уровень'}</p><p class="campaign-lock">${unlocked?'': '🔒 Пройдите 30 уровней первой кампании'}</p><div class="campaign-choice-actions"><button class="primary" data-campaign-play="${id}" ${unlocked?'':'disabled'}>${count?'Продолжить':'Начать'}</button><button data-campaign-levels="${id}" ${unlocked?'':'disabled'}>Выбор уровней</button></div>`;
   for(const [selector,play]of [[`[data-campaign-play=${id}]`,true],[`[data-campaign-levels=${id}]`,false]] as const)card.querySelector<HTMLButtonElement>(selector)!.onclick=()=>{if(campaignUnlocked(id,this.progress('first').completed))this.select(id,play);};choices.append(card);
  }
 }
}
