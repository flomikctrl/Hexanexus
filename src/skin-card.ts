import './skin-card.css';
import {rarityLabels,skinSprite,type MotyaSkin} from './motya-skins';

interface SkinCardOptions {
 skin:MotyaSkin;unlocked:boolean;selected:boolean;worn?:boolean;
 disableLocked?:boolean;showCondition?:boolean;className:string;onSelect:()=>void;
}
export function skinUnlockCondition(skin:MotyaSkin){
 return skin.id==='royal'?'Пройдите все 30 уровней первой кампании':skin.id==='architect'?'Пройдите 30 уровней кампании „Новая грань“':'Получите из подарков Моти';
}
// Shared portrait card; the caller retains selection, preview and ownership rules.
export function createSkinCard(options:SkinCardOptions):HTMLButtonElement{
 const {skin,unlocked,selected,worn=false}=options,button=document.createElement('button');
 button.type='button';button.className='motya-skin-card '+options.className;
 button.dataset.rarity=skin.rarity;button.dataset.locked=String(!unlocked);button.dataset.worn=String(worn&&unlocked);
 button.disabled=!!options.disableLocked&&!unlocked;button.setAttribute('aria-pressed',String(selected));
 const image=document.createElement('img');image.className='skin-card-preview';image.src=skinSprite(skin.id,'IDLE');image.alt='';image.draggable=false;image.loading='lazy';image.decoding='async';
 const name=document.createElement('span');name.className='skin-card-name';name.textContent=skin.name;
 const rarity=document.createElement('small');rarity.className='skin-card-rarity';rarity.textContent=rarityLabels[skin.rarity];
 const status=document.createElement('span');status.className='skin-card-status outfit-worn';
 status.textContent=!unlocked?(skin.acquisition.startsWith('campaign')?'🔒 За кампанию':'🔒 В подарках'):worn?'✓ Надето':'Доступно';
 button.append(image,name,rarity,status);
 const condition=!unlocked?skinUnlockCondition(skin):'';
 if(condition&&options.showCondition){const hint=document.createElement('small');hint.className='skin-card-condition';hint.textContent=condition;button.append(hint);}
 button.title=[skin.name,rarityLabels[skin.rarity],status.textContent,condition].filter(Boolean).join('. ');
 button.setAttribute('aria-label',button.title+(button.disabled?'':'. Предпросмотр'));
 button.onclick=options.onSelect;return button;
}
