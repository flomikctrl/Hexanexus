import './lobby.css';
import {economyRewards,giftPrice,hintPrice,hexics} from './economy';
import type {Scene} from './scene';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
export class Lobby {
 private region:HTMLElement;
 private visible=false;
 private layoutFrame=0;
 private exitNote=document.createElement('div');
 private exitTimer:ReturnType<typeof setTimeout>|undefined;
 constructor(private view:Scene){
  const home=el('home'),actions=home.querySelector<HTMLElement>('.home-actions')!,title=home.querySelector('h1')!,version=el('home-version'),progress=el('progress-summary');
  const oldWallet=home.querySelector<HTMLElement>('.home-wallet')!,wallet=document.createElement('button');
  wallet.id='wallet-info';wallet.className='home-wallet';wallet.type='button';wallet.title='Как получить гексики?';wallet.setAttribute('aria-haspopup','dialog');wallet.setAttribute('aria-controls','currency-help');wallet.append(...Array.from(oldWallet.childNodes));
  const top=document.createElement('header');top.className='lobby-top';top.innerHTML='<div class="lobby-profile" role="img" aria-label="Место для будущей аватарки" title="Ваш уголок в мастерской"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="m20 2 15.6 9v18L20 38 4.4 29V11z" fill="none" stroke="currentColor"/><circle cx="20" cy="15" r="5" fill="currentColor" opacity=".8"/><path d="M10 30c0-9 20-9 20 0" fill="none" stroke="currentColor" stroke-width="2"/></svg></div><div class="lobby-top-actions"></div>';
  const toggle=document.createElement('button');toggle.id='lobby-menu-toggle';toggle.type='button';toggle.textContent='≡';toggle.title='Меню';toggle.setAttribute('aria-label','Дополнительное меню');toggle.setAttribute('aria-haspopup','dialog');toggle.setAttribute('aria-controls','lobby-menu');top.lastElementChild!.append(wallet,toggle);
  const brand=document.createElement('div');brand.className='lobby-brand';brand.innerHTML='<small>МАСТЕРСКАЯ СИЛУЭТОВ</small>';brand.append(title);brand.insertAdjacentHTML('beforeend','<p>Одна конструкция. Два силуэта.</p>');
  this.region=document.createElement('div');this.region.id='lobby-stage';this.region.setAttribute('aria-hidden','true');this.region.innerHTML='<span class="lobby-gesture-note">Потяните фигуру, чтобы повернуть</span>';
  const foot=document.createElement('footer');foot.className='lobby-foot';foot.append(version,progress);
  const menu=document.createElement('dialog');menu.id='lobby-menu';menu.className='lobby-dialog';menu.setAttribute('aria-labelledby','lobby-menu-title');menu.innerHTML='<div class="collection-heading"><h2 id="lobby-menu-title">Меню</h2><button id="lobby-menu-close" aria-label="Закрыть меню">✕</button></div><nav class="lobby-menu-items" aria-label="Разделы игры"></nav>';
  for(const id of ['choose-level','open-achievements','open-settings']){const button=el(id);button.addEventListener('click',()=>menu.close(),{capture:true});menu.querySelector('nav')!.append(button);}
  el('open-wardrobe').textContent='Костюмы и подарки';
  home.classList.add('home-lobby');home.replaceChildren(top,brand,this.region,actions,foot);el('app').append(menu);
  this.exitNote.id='lobby-exit-note';this.exitNote.hidden=true;this.exitNote.setAttribute('role','status');home.append(this.exitNote);
  el('app').insertAdjacentHTML('beforeend',`<dialog id="currency-help" class="lobby-dialog" aria-labelledby="currency-help-title"><div class="collection-heading"><h2 id="currency-help-title">Как получить гексики?</h2><button id="currency-help-close" aria-label="Закрыть информацию о гексиках">✕</button></div><h3>Зарабатывайте во время игры</h3><ul><li>Первое прохождение уровня кампании: <strong>+${hexics(economyRewards.campaignLevel)}</strong>.</li><li>Каждый успешно решённый раунд бесконечного режима: <strong>+${hexics(economyRewards.arcadeRound)}</strong>.</li><li>Достижения: дополнительные одноразовые награды.</li><li>Стартовый бонус нового игрока: <strong>+${hexics(economyRewards.starter)}</strong>.</li></ul><p class="currency-key-point">В бесконечном режиме гексики начисляются за каждый решённый раунд в каждой партии, даже без нового рекорда.</p><h3>На что можно потратить</h3><ul><li>Первая подсказка на каждом уровне бесплатная один раз.</li><li>Последующие подсказки: <strong>${hexics(hintPrice)}</strong>.</li><li>Подарки Моти: <strong>${hexics(giftPrice)}</strong> — один новый наряд без повторов.</li></ul><button id="currency-help-done" class="primary">Понятно</button></dialog>`);
  toggle.onclick=()=>menu.showModal();el('lobby-menu-close').onclick=()=>menu.close();
  wallet.onclick=()=>el<HTMLDialogElement>('currency-help').showModal();
  for(const id of ['currency-help-close','currency-help-done'])el(id).onclick=()=>el<HTMLDialogElement>('currency-help').close();
  for(const id of ['lobby-menu','currency-help']){
   const dialog=el<HTMLDialogElement>(id);dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();});
  }
  const align=()=>{if(this.layoutFrame)return;this.layoutFrame=requestAnimationFrame(()=>{this.layoutFrame=0;if(this.visible)this.view.setLobbyRegion(this.region.getBoundingClientRect());});};
  new ResizeObserver(align).observe(this.region);window.addEventListener('resize',align);window.visualViewport?.addEventListener('resize',align);
 }
 setVisible(visible:boolean){this.visible=visible;this.close();clearTimeout(this.exitTimer);this.exitNote.hidden=true;if(visible)this.view.setLobbyRegion(this.region.getBoundingClientRect());else if(this.view.lobbyRotation.active)this.view.setLobbyRegion(null);}
 hintExit(){clearTimeout(this.exitTimer);this.exitNote.textContent='Нажмите ещё раз для выхода';this.exitNote.hidden=false;this.exitTimer=setTimeout(()=>{this.exitNote.hidden=true;},2000);}
 close(){for(const id of ['lobby-menu','currency-help']){const d=el<HTMLDialogElement>(id);if(d.open)d.close();}}
 back(){for(const id of ['currency-help','lobby-menu']){const d=el<HTMLDialogElement>(id);if(d.open){d.close();return true;}}return false;}
}
