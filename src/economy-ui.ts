import './economy.css';
import {Economy,achievements,hexics,type EconomyChange} from './economy';
import type {MotyaAssistant} from './motya';
const coin='<img class="currency-icon" src="/icons/hexic.svg" alt="" aria-hidden="true">';
const icons={steps:'◈',cube:'⬡',crown:'♛',leaf:'❧',bolt:'ϟ',shield:'⛨',trophy:'♜'};
export class EconomyUI {
 private notice=document.createElement('div');
 private timer:ReturnType<typeof setTimeout>|undefined;
 constructor(private economy:Economy,private motya:MotyaAssistant,open:()=>void,back:()=>void){
  document.querySelector('#home .home-actions')!.insertAdjacentHTML('beforebegin',`<div class="home-wallet">${coin}<strong data-wallet></strong><span data-wallet-unit></span></div>`);
  document.getElementById('open-settings')!.insertAdjacentHTML('beforebegin','<button id="open-achievements">Достижения</button>');
  document.querySelector('.game-footer')!.insertAdjacentHTML('beforeend',`<div id="hint-wallet"><span class="wallet-small">${coin}<span data-wallet></span></span><span id="hint-price"></span></div>`);
  document.getElementById('app')!.insertAdjacentHTML('beforeend',`<section id="achievements-screen" class="screen collection-screen" hidden aria-labelledby="achievements-title"><header class="collection-heading"><div><small>МАСТЕРСКАЯ МОТИ</small><h2 id="achievements-title">Достижения</h2></div><button id="achievements-back">← Назад</button></header><div class="achievement-wallet">${coin}<strong data-wallet></strong><span>гексики</span></div><p class="achievement-intro">Награды начисляются автоматически. Гексики остаются с вами после партии.</p><div id="achievement-groups"></div><p id="economy-error" role="status"></p></section>`);
  this.notice.id='economy-notice';this.notice.hidden=true;this.notice.setAttribute('role','status');this.notice.setAttribute('aria-live','polite');document.body.append(this.notice);
  document.getElementById('open-achievements')!.onclick=open;document.getElementById('achievements-back')!.onclick=back;
  this.economy.subscribe(change=>{this.refresh();this.reward(change);});this.refresh();
  setTimeout(()=>{
   if(!this.notice.hidden||document.body.dataset.screen!=='home')return; // Keep other screens and live rewards clear.
   if(economy.initialCredit>0)this.announce(`+${hexics(economy.initialCredit)} · стартовый бонус и заслуженные награды`);
   else if(!economy.ready)this.announce(economy.error);
  },500);
 }
 refresh(){
  const e=this.economy,d=e.snapshot;
  for(const element of Array.from(document.querySelectorAll<HTMLElement>('[data-wallet]'))){element.textContent=e.ready?e.balance.toLocaleString('ru-RU'):'—';element.parentElement!.setAttribute('aria-label',e.ready?hexics(e.balance):'Гексики недоступны');const unit=element.parentElement!.querySelector('[data-wallet-unit], :scope > span:not([data-wallet])');if(unit)unit.textContent=e.ready?hexics(e.balance).split(' ').at(-1)!:'гексики';}
  const groups=document.getElementById('achievement-groups')!;
  groups.innerHTML=(['campaign','campaign2','endless'] as const).map(group=>`<section class="achievement-group"><h3>${group==='campaign'?'Первые силуэты':group==='campaign2'?'Новая грань':'Бесконечный режим'}</h3><div class="achievement-cards">${achievements.filter(a=>a.group===group).map(a=>{
   const unlocked=d.achievements.includes(a.id),value=Math.min(a.target,group==='campaign'?d.campaignRewards.length:group==='campaign2'?(d.campaign2?.rewards.length??0):d.bestSolved);
   return `<article class="achievement-card" data-achievement="${a.id}" data-earned="${unlocked}"><span class="achievement-icon" aria-hidden="true">${icons[a.icon]}</span><div><h4>${a.name}</h4><p>${group!=='endless'?`Пройти ${a.target} уровней`:`Решить ${a.target} раундов в одной партии`}</p><progress value="${value}" max="${a.target}" aria-label="${value} из ${a.target}"></progress><div class="achievement-meta"><span>${value} / ${a.target} · ${unlocked?'Получено':'Заблокировано'}</span><span class="achievement-reward">${coin}+${hexics(a.reward)}</span></div></div></article>`;
  }).join('')}</div></section>`).join('');
  document.getElementById('economy-error')!.textContent=e.error;
 }
 private reward(change:EconomyChange){
  if(change.achievements.length){const titles=change.achievements.map(id=>achievements.find(a=>a.id===id)!.name);queueMicrotask(()=>{this.announce(`Достижение: ${titles.join(', ')}! +${hexics(change.credited)}.`);this.motya.notify({type:'achievement',name:titles[0]});});}
  else if(change.reason==='campaign'&&change.credited>0)queueMicrotask(()=>this.announce(`Испытание пройдено! +${hexics(change.credited)}.`));
 }
 private announce(text:string){
  clearTimeout(this.timer);const dialog=document.querySelector<HTMLDialogElement>('#victory[open],#campaign-complete[open]'),screen=document.body.dataset.screen;
  this.notice.classList.toggle('economy-notice-inline',!!dialog||screen==='home'||screen==='achievements');
  if(dialog)dialog.insertBefore(this.notice,dialog.querySelector(':scope > button'));
  else if(screen==='home')document.querySelector('#home .home-actions')!.after(this.notice);
  else if(screen==='achievements')document.querySelector('#achievements-screen .collection-heading')!.after(this.notice);
  else document.body.append(this.notice);
  this.notice.textContent=text;this.notice.hidden=false;this.timer=setTimeout(()=>{this.notice.hidden=true;},4800);
 }
}
