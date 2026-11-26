import {motyaSkins,skinById,rarityLabels,type MotyaSkinId,type MotyaEmotion} from './motya-skins';
import type {MotyaAssistant} from './motya';
import type {Economy} from './economy';
import {MotyaGifts} from './gift-ui';
import {createSkinCard,skinUnlockCondition} from './skin-card';

export class MotyaWardrobe {
  private selected:MotyaSkinId;
  private emotion:MotyaEmotion='IDLE';
  private opened=false;
  private host:HTMLElement;
  private tab:'wardrobe'|'gifts'='wardrobe';
  private gifts:MotyaGifts;
  constructor(private motya:MotyaAssistant,onBack:()=>void,economy:Economy){
    this.selected=motya.skin;
    this.host=document.createElement('section');this.host.id='wardrobe';this.host.className='screen collection-screen';this.host.hidden=true;
    this.host.innerHTML='<div class="collection-heading"><div><small>МАСТЕРСКАЯ СИЛУЭТОВ</small><h2>Мастерская Моти</h2></div><button id="wardrobe-back">← Меню</button></div><div id="wardrobe-stage" aria-label="Предпросмотр костюма"></div><div class="outfit-info"><h3 id="outfit-name"></h3><span id="outfit-rarity" class="rarity"></span><p id="outfit-description"></p></div><div id="wardrobe-emotions" role="group" aria-label="Эмоция в предпросмотре"><button data-emotion="IDLE">Обычная</button><button data-emotion="SAD">Грустная</button><button data-emotion="SHOCK">Удивлённая</button></div><div id="outfit-cards" aria-label="Доступные образы"></div><button id="outfit-wear" class="primary">Надеть</button><p id="wardrobe-status" role="status" aria-live="polite"></p>';
    document.getElementById('app')!.append(this.host);
    const equip=document.createElement('div');equip.className='wardrobe-equip';equip.setAttribute('aria-label','Надеть выбранный костюм');
    const selection=document.createElement('p');selection.id='outfit-selected';selection.className='wardrobe-equip-selection';
    equip.append(selection,this.host.querySelector('#outfit-wear')!,this.host.querySelector('#wardrobe-status')!);this.host.append(equip);
    const heading=this.host.firstElementChild!;heading.querySelector('h2')!.textContent='Мастерская Моти';
    const panel=document.createElement('div');panel.id='wardrobe-panel';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','wardrobe-tab');
    while(heading.nextSibling)panel.append(heading.nextSibling);
    const content=document.createElement('div');content.className='wardrobe-content';
    while(panel.firstChild&&panel.firstChild!==equip)content.append(panel.firstChild);
    panel.prepend(content);
    const tabs=document.createElement('div');tabs.id='workshop-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Мастерская Моти');tabs.innerHTML='<button id="wardrobe-tab" role="tab" aria-controls="wardrobe-panel">Костюмы</button><button id="gifts-tab" role="tab" aria-controls="gifts-panel">Подарки</button>';
    const gifts=document.createElement('div');gifts.id='gifts-panel';gifts.hidden=true;gifts.className='gift-placeholder';gifts.setAttribute('role','tabpanel');gifts.setAttribute('aria-labelledby','gifts-tab');
    this.host.append(tabs,panel,gifts);
    this.gifts=new MotyaGifts(gifts,economy,motya,()=>{if(this.opened&&this.tab==='wardrobe')this.render();});
    const tabNames=['wardrobe','gifts'] as const;
    for(const [i,name] of tabNames.entries()){
      const button=tabs.querySelector<HTMLButtonElement>('#'+name+'-tab')!;button.onclick=()=>this.setTab(name);
      button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?1:1-i;this.setTab(tabNames[next]);tabs.querySelector<HTMLButtonElement>('#'+tabNames[next]+'-tab')!.focus();};
    }
    this.host.querySelector<HTMLButtonElement>('#wardrobe-back')!.onclick=onBack;
    this.host.querySelectorAll<HTMLButtonElement>('#wardrobe-emotions [data-emotion]').forEach(button=>button.onclick=()=>{this.emotion=button.dataset.emotion as MotyaEmotion;this.render();});
    this.host.querySelector<HTMLButtonElement>('#outfit-wear')!.onclick=()=>{
      if(!this.motya.isSkinUnlocked(this.selected))return;
      const saved=this.motya.wearSkin(this.selected);this.render();
      this.host.querySelector('#wardrobe-status')!.textContent=saved?'Образ надет':'Не удалось сохранить образ. Попробуйте ещё раз.';
    };
  }
  open(previewSkin?:MotyaSkinId){this.opened=true;this.selected=previewSkin??this.motya.skin;this.emotion='IDLE';this.host.hidden=false;this.host.querySelector('#wardrobe-status')!.textContent='';this.setTab('wardrobe');}
  close(){this.gifts.hide();this.host.hidden=true;if(this.opened){this.opened=false;this.motya.endPreview();}}
  closeGiftResult(){return this.gifts.closeResult();}
  finishGiftAnimation(){this.gifts.finishAnimation();}
  dispose(){this.gifts.dispose();}
  back(){if(this.tab!=='gifts')return false;this.setTab('wardrobe');return true;}
  private setTab(tab:'wardrobe'|'gifts'){
    this.tab=tab;this.host.querySelector<HTMLElement>('#wardrobe-panel')!.hidden=tab!=='wardrobe';this.host.querySelector<HTMLElement>('#gifts-panel')!.hidden=tab!=='gifts';
    for(const name of ['wardrobe','gifts']){const button=this.host.querySelector<HTMLButtonElement>('#'+name+'-tab')!;button.setAttribute('aria-selected',String(name===tab));button.tabIndex=name===tab?0:-1;}
    if(tab==='wardrobe'){this.gifts.hide();this.render();}else this.gifts.show();
  }
  private render(){
    const selected=skinById(this.selected);this.host.querySelector('#outfit-name')!.textContent=selected.name;
    this.host.querySelector('#outfit-selected')!.textContent='Выбран костюм: '+selected.name;
    const rarity=this.host.querySelector<HTMLElement>('#outfit-rarity')!;rarity.textContent=rarityLabels[selected.rarity];rarity.dataset.rarity=selected.rarity;
    this.host.querySelector('#outfit-description')!.textContent=selected.description;
    this.host.querySelectorAll<HTMLButtonElement>('#wardrobe-emotions [data-emotion]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.emotion===this.emotion)));
    const cards=this.host.querySelector('#outfit-cards')!;cards.replaceChildren();
    for(const skin of motyaSkins){
      const card=createSkinCard({skin,className:'outfit-card',showCondition:skin.id==='architect',unlocked:this.motya.isSkinUnlocked(skin.id),selected:skin.id===this.selected,worn:skin.id===this.motya.skin,
        onSelect:()=>{this.selected=skin.id;this.host.querySelector('#wardrobe-status')!.textContent='';this.render();}});
      card.dataset.skin=skin.id;cards.append(card);
    }
    const unlocked=this.motya.isSkinUnlocked(this.selected);
    const wear=this.host.querySelector<HTMLButtonElement>('#outfit-wear')!;wear.disabled=!unlocked||this.selected===this.motya.skin;wear.textContent=!unlocked?(this.selected==='architect'?'🔒 '+skinUnlockCondition(selected):this.selected==='royal'?'🔒 Пройдите все 30 уровней':'🔒 Получите в подарках'):wear.disabled?'✓ Надето':'Надеть';
    this.motya.previewSkin(this.selected,this.emotion,this.host.querySelector('#wardrobe-stage')!);
  }
}
