import './gifts.css';
import {Economy,giftPrice,hexics} from './economy';
import {giftOdds,type GiftReceipt} from './gifts';
import {skinById,rarityLabels} from './motya-skins';
import type {MotyaAssistant} from './motya';

const box='<svg class="gift-box" viewBox="0 0 120 130" aria-hidden="true"><g class="gift-body"><path d="M16 59h88v59H16z" fill="#325f4c" stroke="#d1ba7f" stroke-width="2"/><path d="M52 59h16v59H52z" fill="#d0b476"/><path d="M20 66h28v46H20z" fill="#91b68b" opacity=".12"/></g><g class="gift-lid"><path d="M10 43h100v22H10z" fill="#527c5b" stroke="#e0ca8f" stroke-width="2"/><path d="M52 43h16v22H52z" fill="#ecd29a"/><path d="M60 44C23 43 21 8 40 15c13 5 20 29 20 29s10-31 25-29c21 3 8 29-25 29z" fill="#d6b979" stroke="#f2dca4" stroke-width="2"/></g></svg>';
export class MotyaGifts {
 private dialog=document.createElement('dialog');
 private timer:ReturnType<typeof setTimeout>|undefined;
 private reactionTimer:ReturnType<typeof setTimeout>|undefined;
 private receipt:GiftReceipt|null=null;
 private opening=false;
 private visible=false;
 private events=new AbortController();
 private unsubscribe:()=>void;
 constructor(private host:HTMLElement,private economy:Economy,private motya:MotyaAssistant,private changed:()=>void){
  host.className='motya-gifts';
  host.innerHTML=`<h3>Подарки Моти</h3><div class="gift-summary"><span id="gift-balance"></span><span id="gift-collection"></span></div><div id="gift-odds" aria-label="Актуальные шансы редкостей"></div><div id="gift-stage"><div class="gift-box-wrap">${box}</div><div id="gift-motya"></div></div><p class="gift-motto">Один подарок — один новый наряд!</p><button id="gift-open" class="primary"></button><p class="gift-price">Стоимость: ${hexics(giftPrice)} · Без повторов</p><p id="gift-status" role="status" aria-live="polite"></p>`;
  this.dialog.id='gift-result';this.dialog.className='gift-result';this.dialog.setAttribute('aria-labelledby','gift-result-title');
  this.dialog.innerHTML=`<small id="gift-result-kicker">ПОДАРОК ОТ МОТИ</small><h2 id="gift-result-title">Открываем подарок…</h2><span id="gift-result-rarity" class="rarity"></span><div id="gift-result-stage"><div class="gift-opening-box">${box}</div><div id="gift-result-motya"></div><div class="gift-sparks" aria-hidden="true">${Array.from({length:8},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div></div><p id="gift-reaction" role="status" aria-live="polite"></p><button id="gift-skip">Пропустить анимацию</button><div id="gift-result-actions"><button id="gift-wear" class="primary">Надеть</button><button id="gift-continue">Продолжить</button></div><p id="gift-result-error" role="status"></p>`;
  document.getElementById('app')!.append(this.dialog);
  this.el<HTMLButtonElement>('gift-open').onclick=()=>this.buy();
  this.el<HTMLButtonElement>('gift-skip').onclick=()=>this.finishAnimation();
  this.el<HTMLButtonElement>('gift-continue').onclick=()=>this.closeResult();
  this.el<HTMLButtonElement>('gift-wear').onclick=()=>{
   if(!this.receipt||this.opening)return;
   const ok=motya.wearSkin(this.receipt.skin);this.el('gift-result-error').textContent=ok?'Образ надет и сохранён':'Не удалось сохранить выбранный образ. Попробуйте ещё раз.';
   this.el<HTMLButtonElement>('gift-wear').disabled=ok;this.el('gift-wear').textContent=ok?'✓ Надето':'Надеть';this.changed();
  };
  this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.closeResult();},{signal:this.events.signal});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.finishAnimation();},{signal:this.events.signal});
  this.unsubscribe=economy.subscribe(()=>this.refresh());this.refresh();
 }
 private el<T extends HTMLElement=HTMLElement>(id:string){return document.getElementById(id) as T;}
 refresh(){
  const {owned,pending}=this.economy.gifts,button=this.el<HTMLButtonElement>('gift-open');
  this.el('gift-balance').textContent=this.economy.ready?hexics(this.economy.balance):'Гексики недоступны';
  this.el('gift-collection').textContent=`Коллекция: ${owned.length}/5`;
  const odds=this.el('gift-odds');odds.replaceChildren();
  for(const group of giftOdds(owned)){
   const item=document.createElement('span');item.dataset.rarity=group.rarity;
   item.textContent=`${{common:'Обычные',rare:'Редкие',legendary:'Легендарные'}[group.rarity]}: ${group.skins.length?`${(group.probability*100).toLocaleString('ru-RU',{maximumFractionDigits:2})}%`:'собраны'}`;
   item.title=group.skins.map(id=>skinById(id).name).join(', ');odds.append(item);
  }
  const complete=owned.length===5,poor=this.economy.balance<giftPrice;
  button.disabled=!this.economy.ready||complete||poor||!!pending||this.dialog.open;
  button.textContent=!this.economy.ready?'Подарки недоступны':pending?'Подарок уже открыт':complete?'Коллекция собрана!':poor?'Недостаточно гексиков':`Открыть за ${giftPrice} ⬡`;
 }
 show(){this.visible=true;this.refresh();this.mount();const pending=this.economy.gifts.pending;if(pending)this.present(pending,false);}
 hide(){this.visible=false;this.clearTimers();this.opening=false;this.dialog.close();this.receipt=null;}
 private mount(){this.motya.previewSkin(this.motya.skin,'IDLE',this.el('gift-motya'));}
 private buy(){
  if(this.dialog.open||this.receipt||this.opening)return;
  const receipt=this.economy.buyGift();
  if(!receipt){this.el('gift-status').textContent=this.economy.error||'Не удалось открыть подарок. Гексики не списаны.';this.refresh();return;}
  this.el('gift-status').textContent='';this.present(receipt,!matchMedia('(prefers-reduced-motion: reduce)').matches);this.changed();
 }
 private present(receipt:GiftReceipt,animate:boolean){
  if(this.dialog.open)return;
  this.receipt=receipt;const skin=skinById(receipt.skin);this.dialog.dataset.rarity=skin.rarity;
  this.el('gift-result-rarity').textContent=rarityLabels[skin.rarity];this.el('gift-result-error').textContent='';
  this.el<HTMLButtonElement>('gift-wear').disabled=this.motya.skin===receipt.skin;this.el('gift-wear').textContent=this.motya.skin===receipt.skin?'✓ Надето':'Надеть';
  this.opening=animate;this.dialog.dataset.opening=String(animate);this.el('gift-result-actions').hidden=animate;this.el('gift-skip').hidden=!animate;
  this.el('gift-result-title').textContent=animate?'Открываем подарок…':skin.name;
  this.el('gift-reaction').textContent=animate?'Немного волшебства…':'Новый наряд! Мотя в восторге!';
  this.motya.previewSkin(animate?this.motya.skin:receipt.skin,animate?'IDLE':'SHOCK',this.el('gift-result-motya'));
  this.dialog.showModal();this.refresh();
  if(animate)this.timer=setTimeout(()=>this.finishAnimation(),1900);else this.react();
 }
 finishAnimation(){
  if(!this.opening||!this.receipt)return;clearTimeout(this.timer);this.timer=undefined;this.opening=false;
  this.dialog.dataset.opening='false';this.el('gift-result-title').textContent=skinById(this.receipt.skin).name;
  this.el('gift-reaction').textContent='Новый наряд! Мотя в восторге!';this.el('gift-result-actions').hidden=false;this.el('gift-skip').hidden=true;
  this.motya.previewSkin(this.receipt.skin,'SHOCK',this.el('gift-result-motya'));this.react();
 }
 private react(){clearTimeout(this.reactionTimer);this.reactionTimer=setTimeout(()=>{if(this.receipt&&this.dialog.open)this.motya.previewSkin(this.receipt.skin,'IDLE',this.el('gift-result-motya'));},850);}
 closeResult(){
  if(!this.dialog.open)return false;
  this.finishAnimation();
  if(this.receipt&&!this.economy.acknowledgeGift(this.receipt.id)){this.el('gift-result-error').textContent='Не удалось сохранить закрытие. Наряд уже ваш. Попробуйте ещё раз.';return true;}
  this.clearTimers();this.dialog.close();this.receipt=null;if(this.visible)this.mount();this.refresh();this.changed();return true;
 }
 private clearTimers(){clearTimeout(this.timer);clearTimeout(this.reactionTimer);this.timer=undefined;this.reactionTimer=undefined;}
 dispose(){this.hide();this.unsubscribe();this.events.abort();this.dialog.remove();}
}
