import {motyaSkins,skinById,rarityLabels,motyaCollection,type MotyaSkinId,type MotyaEmotion} from './motya-skins';
import type {MotyaAssistant} from './motya';

export class MotyaWardrobe {
  private selected:MotyaSkinId;
  private emotion:MotyaEmotion='IDLE';
  private opened=false;
  private host:HTMLElement;
  constructor(private motya:MotyaAssistant,onBack:()=>void){
    this.selected=motya.skin;
    this.host=document.createElement('section');this.host.id='wardrobe';this.host.className='screen collection-screen';this.host.hidden=true;
    this.host.innerHTML='<div class="collection-heading"><div><small>МАСТЕРСКАЯ СИЛУЭТОВ</small><h2>Гардероб Моти</h2></div><button id="wardrobe-back">← Меню</button></div><div id="wardrobe-stage" aria-label="Предпросмотр костюма"></div><div class="outfit-info"><h3 id="outfit-name"></h3><span id="outfit-rarity" class="rarity"></span><p id="outfit-description"></p></div><div id="wardrobe-emotions" role="group" aria-label="Эмоция в предпросмотре"><button data-emotion="IDLE">Обычная</button><button data-emotion="SAD">Грустная</button><button data-emotion="SHOCK">Удивлённая</button></div><div id="outfit-cards" aria-label="Доступные образы"></div><button id="outfit-wear" class="primary">Надеть</button><p id="wardrobe-status" role="status" aria-live="polite"></p>';
    document.getElementById('app')!.append(this.host);
    this.host.querySelector<HTMLButtonElement>('#wardrobe-back')!.onclick=onBack;
    this.host.querySelectorAll<HTMLButtonElement>('[data-emotion]').forEach(button=>button.onclick=()=>{this.emotion=button.dataset.emotion as MotyaEmotion;this.render();});
    this.host.querySelector<HTMLButtonElement>('#outfit-wear')!.onclick=()=>{
      if(!this.motya.isSkinUnlocked(this.selected))return;
      const saved=this.motya.wearSkin(this.selected);this.render();
      this.host.querySelector('#wardrobe-status')!.textContent=saved?'Образ надет':'Образ надет. Сохранение на этом устройстве недоступно.';
    };
  }
  open(previewSkin?:MotyaSkinId){this.opened=true;this.selected=previewSkin??this.motya.skin;this.emotion='IDLE';this.host.hidden=false;this.host.querySelector('#wardrobe-status')!.textContent='';this.render();}
  close(){this.host.hidden=true;if(this.opened){this.opened=false;this.motya.endPreview();}}
  private render(){
    const selected=skinById(this.selected);this.host.querySelector('#outfit-name')!.textContent=selected.name;
    const rarity=this.host.querySelector<HTMLElement>('#outfit-rarity')!;rarity.textContent=rarityLabels[selected.rarity];rarity.dataset.rarity=selected.rarity;
    this.host.querySelector('#outfit-description')!.textContent=selected.description;
    this.host.querySelectorAll<HTMLButtonElement>('[data-emotion]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.emotion===this.emotion)));
    const cards=this.host.querySelector('#outfit-cards')!;cards.replaceChildren();const collection=motyaCollection(this.motya.skin,this.motya.isSkinUnlocked('royal'));
    for(const skin of motyaSkins){
      const card=document.createElement('button');card.type='button';card.className='outfit-card';card.dataset.skin=skin.id;card.dataset.rarity=skin.rarity;
      const unlocked=collection.ownedSkinIds.includes(skin.id);card.dataset.locked=String(!unlocked);card.setAttribute('aria-pressed',String(skin.id===this.selected));
      const name=document.createElement('span');name.textContent=skin.name;
      const rarity=document.createElement('small');rarity.textContent=rarityLabels[skin.rarity];
      const worn=document.createElement('span');worn.className='outfit-worn';worn.textContent=!unlocked?'🔒 Пройдите все 30 уровней':skin.id===this.motya.skin?'✓ Надето':'Доступно';
      card.setAttribute('aria-label',skin.name+'. '+worn.textContent+'. Предпросмотр');
      card.append(name,rarity,worn);card.onclick=()=>{this.selected=skin.id;this.host.querySelector('#wardrobe-status')!.textContent='';this.render();};cards.append(card);
    }
    const unlocked=collection.ownedSkinIds.includes(this.selected);
    const wear=this.host.querySelector<HTMLButtonElement>('#outfit-wear')!;wear.disabled=!unlocked||this.selected===this.motya.skin;wear.textContent=!unlocked?'🔒 Пройдите все 30 уровней':wear.disabled?'✓ Надето':'Надеть';
    this.motya.previewSkin(this.selected,this.emotion,this.host.querySelector('#wardrobe-stage')!);
  }
}
