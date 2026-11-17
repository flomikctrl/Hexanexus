import './profile.css';
import {Economy,achievements,hexics} from './economy';
import {motyaSkins,skinById,skinSprite,type MotyaSkinId,type MotyaEmotion} from './motya-skins';
import {profileTitles,campaignProfileStats,arcadeProfileStats,playerNameError,normalizedPlayerName,type ProfileTitleId,type ProfileFrameId} from './player-profile';
import type {ArcadeRecords} from './arcade';
import {createSkinCard} from './skin-card';
import {giftSkinIds} from './gifts';

interface ProfileSources {completed:()=>readonly string[];completedSecond?:()=>readonly string[];records:()=>ArcadeRecords;canUse:(id:MotyaSkinId)=>boolean;worn:()=>MotyaSkinId}
export class PlayerProfileUI {
 private host=document.createElement('section');
 private dialog=document.createElement('dialog');
 private visible=false;
 private unsubscribe:()=>void;
 private events=new AbortController();
 constructor(private economy:Economy,private sources:ProfileSources,open:()=>void,back:()=>void,achievementsRoute:()=>void){
  const placeholder=document.querySelector('.lobby-profile')!,avatar=document.createElement('button');avatar.id='open-profile';avatar.className='lobby-profile player-avatar';avatar.type='button';avatar.title='Мой профиль';avatar.setAttribute('aria-label','Открыть мой профиль');
  avatar.innerHTML='<img draggable="false" alt="Аватарка игрока">';avatar.onclick=open;placeholder.replaceWith(avatar);
  this.host.id='profile-screen';this.host.className='screen collection-screen';this.host.hidden=true;this.host.setAttribute('aria-labelledby','profile-title');
  this.host.innerHTML=`<header class="collection-heading"><div><small>ВАШ УГОЛОК В МАСТЕРСКОЙ</small><h2 id="profile-title">Мой профиль</h2></div><button id="profile-back">← Меню</button></header><section class="profile-hero"><button id="profile-avatar" class="player-avatar" title="Выбрать аватарку" aria-label="Изменить аватарку"><img draggable="false" alt="Аватарка игрока"></button><div class="profile-identity"><h3 id="profile-name"></h3><p id="profile-rank"></p><button id="profile-edit-name">Изменить имя</button></div></section><p id="profile-wallet"></p><div id="profile-statistics" class="profile-statistics"></div><div class="profile-customize"><button id="profile-edit-avatar">Аватарка и эмоция</button><button id="profile-edit-title">Выбрать звание</button><button id="profile-edit-frame">Рамка аватарки</button></div><p class="profile-future">Кампании · 60 уровней</p><p id="profile-status" role="status"></p>`;
  this.dialog.id='profile-editor';this.dialog.className='profile-editor';this.dialog.setAttribute('aria-labelledby','profile-editor-title');
  this.dialog.innerHTML='<header class="collection-heading"><h2 id="profile-editor-title"></h2><button id="profile-editor-close" aria-label="Закрыть редактор">✕</button></header><form id="profile-form"><div id="profile-editor-content"></div><p id="profile-edit-error" role="status" aria-live="polite"></p><div class="profile-editor-actions"><button id="profile-save" class="primary" type="submit">Сохранить</button><button id="profile-cancel" type="button">Отмена</button></div></form>';
  document.getElementById('app')!.append(this.host,this.dialog);
  this.el<HTMLButtonElement>('profile-back').onclick=back;
  for(const kind of ['name','avatar','title','frame'] as const)this.el<HTMLButtonElement>('profile-edit-'+kind).onclick=()=>this.edit(kind);
  this.el<HTMLButtonElement>('profile-avatar').onclick=()=>this.edit('avatar');
  for(const id of ['profile-editor-close','profile-cancel'])this.el<HTMLButtonElement>(id).onclick=()=>this.closeEditor();
  this.dialog.addEventListener('cancel',event=>{event.preventDefault();this.closeEditor();},{signal:this.events.signal});
  this.dialog.addEventListener('close',()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();},{signal:this.events.signal});
  this.host.addEventListener('click',event=>{if((event.target as HTMLElement).closest('#profile-achievements'))achievementsRoute();},{signal:this.events.signal});
  this.unsubscribe=economy.subscribe(()=>this.refresh());this.refresh();
 }
 private el<T extends HTMLElement=HTMLElement>(id:string){return document.getElementById(id) as T;}
 setVisible(visible:boolean){this.visible=visible;this.host.hidden=!visible;if(visible){this.refresh();window.scrollTo(0,0);}else this.closeEditor();}
 private refresh(){
  const p=this.economy.profile;
  for(const selector of ['#open-profile','#profile-avatar']){
   const avatar=document.querySelector<HTMLElement>(selector)!,img=avatar.querySelector('img')!;img.src=skinSprite(p.avatar.skin,p.avatar.emotion);avatar.dataset.frame=p.frame;img.alt=`${skinById(p.avatar.skin).name} — ${ {IDLE:'обычная',SAD:'грустная',SHOCK:'удивлённая'}[p.avatar.emotion]}`;
  }
  this.el('open-profile').setAttribute('aria-label',`Мой профиль: ${p.name}`);
  if(!this.visible)return;
  this.el('profile-name').textContent=p.name;this.el('profile-rank').textContent=profileTitles.find(t=>t.id===p.title)!.name;
  this.el('profile-wallet').textContent=this.economy.ready?hexics(this.economy.balance):'Гексики недоступны';
  const campaign=campaignProfileStats(this.sources.completed()),arcade=arcadeProfileStats(this.sources.records()),owned=motyaSkins.filter(s=>this.sources.canUse(s.id)).length;
  this.el('profile-statistics').innerHTML=`<article class="profile-stat-card profile-campaign"><h3>${campaign.name}</h3><div class="profile-stat-line"><strong data-profile-stat="campaign">${campaign.completed}/${campaign.total}</strong><span>${campaign.percent}% пройдено</span></div><progress value="${campaign.completed}" max="${campaign.total}" aria-label="Пройдено ${campaign.completed} из ${campaign.total}"></progress></article><article class="profile-stat-card"><h3>Бесконечный режим</h3><dl><div><dt>Решено за партию</dt><dd data-profile-stat="solved">${arcade.solved}</dd></div><div><dt>Рекорд очков</dt><dd data-profile-stat="score">${arcade.score.toLocaleString('ru-RU')}</dd></div><div><dt>Лучшая серия</dt><dd data-profile-stat="streak">${arcade.streak}</dd></div></dl></article><article class="profile-stat-card"><h3>Коллекция Моти</h3><dl><div><dt>Открыто нарядов</dt><dd data-profile-stat="skins">${owned}/${motyaSkins.length}</dd></div><div><dt>Из подарков</dt><dd data-profile-stat="gifts">${this.economy.gifts.owned.length}/${giftSkinIds.length}</dd></div></dl><p id="profile-worn"></p></article><article class="profile-stat-card"><h3>Достижения</h3><div class="profile-stat-line"><strong data-profile-stat="achievements">${this.economy.snapshot.achievements.length}/${achievements.length}</strong><span>получено</span></div><button id="profile-achievements">Посмотреть достижения →</button></article>`;
  this.el('profile-worn').textContent='В игре: '+skinById(this.sources.worn()).name;
  const second=campaignProfileStats(this.sources.completedSecond?.()??[],'second'),locked=campaign.completed<30;
  this.el('profile-statistics').insertAdjacentHTML('beforeend',`<article class="profile-stat-card profile-second-campaign"><h3>${second.name} · Новая грань</h3><div class="profile-stat-line"><strong data-profile-stat="campaign2">${second.completed}/30</strong><span>${second.percent}% пройдено</span></div><progress value="${second.completed}" max="30" aria-label="Пройдено ${second.completed} из 30"></progress>${locked?'<p>🔒 Пройдите 30 уровней первой кампании</p>':''}</article>`);
  const future=this.host.querySelector('.profile-future')!;future.className='profile-future profile-campaign-total';future.textContent=`Общий прогресс: ${campaign.completed+second.completed}/60`;
  this.el('profile-status').textContent=this.economy.ready?'Все настройки хранятся только на этом устройстве.':'Профиль временно недоступен: '+this.economy.error;
  this.host.querySelectorAll<HTMLButtonElement>('.profile-customize button,#profile-edit-name,#profile-avatar').forEach(b=>b.disabled=!this.economy.ready);
 }
 closeEditor(){if(!this.dialog.open)return false;if(document.activeElement instanceof HTMLElement)document.activeElement.blur();this.dialog.close();return true;}
 private edit(kind:'name'|'avatar'|'title'|'frame'){
  if(!this.economy.ready||this.dialog.open)return;
  const p=this.economy.profile,content=this.el('profile-editor-content'),error=this.el('profile-edit-error'),save=this.el<HTMLButtonElement>('profile-save');
  content.replaceChildren();error.textContent='';save.disabled=false;this.dialog.dataset.kind=kind;
  this.el('profile-editor-title').textContent={name:'Имя игрока',avatar:'Аватарка Моти',title:'Звание',frame:'Рамка аватарки'}[kind];
  let commit:()=>boolean;
  if(kind==='name'){
   content.innerHTML='<label class="profile-name-label" for="profile-name-input">Как вас называть?</label><input id="profile-name-input" type="text" maxlength="40" autocomplete="nickname" enterkeyhint="done" aria-describedby="profile-name-count profile-edit-error"><p id="profile-name-count"></p><p class="profile-editor-note">От 1 до 20 символов. Имя видно только вам.</p>';
   const input=this.el<HTMLInputElement>('profile-name-input');input.value=p.name;
   const validate=()=>{error.textContent=playerNameError(input.value);save.disabled=!!error.textContent;input.setAttribute('aria-invalid',String(save.disabled));this.el('profile-name-count').textContent=`${Array.from(normalizedPlayerName(input.value)).length}/20`;};input.oninput=validate;validate();
   commit=()=>this.economy.editProfile({name:input.value});
  }else if(kind==='avatar'){
   let skin=p.avatar.skin,emotion=p.avatar.emotion;
   content.innerHTML='<div class="profile-avatar-preview player-avatar"><img id="profile-avatar-preview" alt="Предпросмотр аватарки" draggable="false"></div><div id="profile-avatar-emotions" role="group" aria-label="Эмоция аватарки"></div><div id="profile-avatar-grid" class="profile-avatar-grid"></div>';
   const update=()=>{this.el<HTMLImageElement>('profile-avatar-preview').src=skinSprite(skin,emotion);content.querySelectorAll<HTMLButtonElement>('[data-avatar-skin]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.avatarSkin===skin)));content.querySelectorAll<HTMLButtonElement>('[data-avatar-emotion]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.avatarEmotion===emotion)));};
   for(const [id,label]of [['IDLE','Обычная'],['SAD','Грустная'],['SHOCK','Удивлённая']] as const){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.avatarEmotion=id;b.onclick=()=>{emotion=id;update();};this.el('profile-avatar-emotions').append(b);}
   for(const outfit of motyaSkins){const b=createSkinCard({skin:outfit,className:'profile-avatar-option',unlocked:this.sources.canUse(outfit.id),selected:skin===outfit.id,disableLocked:true,showCondition:true,
    onSelect:()=>{skin=outfit.id;update();}});b.dataset.avatarSkin=outfit.id;this.el('profile-avatar-grid').append(b);
   }update();commit=()=>this.economy.editProfile({avatar:{skin,emotion}});
  }else if(kind==='title'){
   let title:ProfileTitleId=p.title;const group=document.createElement('div');group.className='profile-options';content.append(group);
   for(const t of profileTitles){const b=document.createElement('button');b.type='button';b.dataset.profileTitle=t.id;b.disabled=!p.unlockedTitles.includes(t.id);b.innerHTML=`<strong>${b.disabled?'🔒 ':''}${t.name}</strong><small>${t.condition}</small>`;b.setAttribute('aria-pressed',String(title===t.id));b.onclick=()=>{title=t.id;group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profileTitle===title)));};group.append(b);}
   commit=()=>this.economy.editProfile({title});
  }else{
   let frame:ProfileFrameId=p.frame;content.innerHTML='<div class="profile-options"><button type="button" data-profile-frame="plain"><strong>Обычная рамка</strong><small>Доступно всем</small></button><button type="button" data-profile-frame="gold"><strong>Золотая рамка</strong><small>Пройдите обе кампании</small></button></div>';
   const gold=content.querySelector<HTMLButtonElement>('[data-profile-frame=gold]')!;gold.disabled=!p.unlockedTitles.includes('facets');if(gold.disabled)gold.querySelector('strong')!.textContent='🔒 Золотая рамка';
   const mark=()=>content.querySelectorAll<HTMLButtonElement>('[data-profile-frame]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.profileFrame===frame)));
   content.querySelectorAll<HTMLButtonElement>('[data-profile-frame]').forEach(b=>b.onclick=()=>{frame=b.dataset.profileFrame as ProfileFrameId;mark();});mark();
   commit=()=>this.economy.editProfile({frame});
  }
  this.el<HTMLFormElement>('profile-form').onsubmit=event=>{event.preventDefault();if(save.disabled)return;if(commit())this.closeEditor();else error.textContent=this.economy.error||'Не удалось сохранить профиль. Попробуйте ещё раз.';};
  this.dialog.showModal();if(kind==='name')this.el<HTMLInputElement>('profile-name-input').focus({preventScroll:true});
 }
 dispose(){this.closeEditor();this.unsubscribe();this.events.abort();this.host.remove();this.dialog.remove();}
}
