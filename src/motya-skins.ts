export const skinIds=['classic','sleepy','baker','winter','wizard','cosmic','royal'] as const;
export type MotyaSkinId=typeof skinIds[number];
export type MotyaEmotion='IDLE'|'SAD'|'SHOCK';
export type SkinRarity='base'|'rare'|'legendary'|'exclusive';
export interface MotyaSkin {
  id:MotyaSkinId;name:string;rarity:SkinRarity;initiallyUnlocked:boolean;
  acquisition:'included'|'campaign-30';description:string;
  canDropFromGifts?:boolean;canPurchase?:boolean;
}
export interface MotyaCollection {ownedSkinIds:MotyaSkinId[];equippedSkinId:MotyaSkinId}
export const skinStorageKey='hexanexus.motya.skin.v1';
export const rarityLabels:Record<SkinRarity,string>={base:'Базовая',rare:'Редкая',legendary:'Легендарная',exclusive:'Эксклюзивная'};
export const motyaSkins:readonly MotyaSkin[]=[
  {id:'classic',name:'Классическая Мотя',rarity:'base',initiallyUnlocked:true,acquisition:'included',description:'Мягкие крылышки и большое любопытство.'},
  {id:'sleepy',name:'Сонная Мотя',rarity:'rare',initiallyUnlocked:true,acquisition:'included',description:'Ещё одну загадку — и под одеялко.'},
  {id:'baker',name:'Мотя-кондитер',rarity:'rare',initiallyUnlocked:true,acquisition:'included',description:'Щепотка уюта, ложечка волшебства.'},
  {id:'winter',name:'Зимняя Мотя',rarity:'rare',initiallyUnlocked:true,acquisition:'included',description:'В тёплом наряде даже снежинки не страшны.'},
  {id:'wizard',name:'Мотя-волшебница',rarity:'legendary',initiallyUnlocked:true,acquisition:'included',description:'Самое сильное заклинание — «попробуем ещё».'},
  {id:'cosmic',name:'Космическая Мотя',rarity:'legendary',initiallyUnlocked:true,acquisition:'included',description:'Маленькая моль в большой вселенной форм.'},
  {id:'royal',name:'Королева Мотя',rarity:'exclusive',initiallyUnlocked:false,acquisition:'campaign-30',canDropFromGifts:false,canPurchase:false,description:'Корона для тех, кто разгадал все силуэты.'}
];
export function isSkinId(id:unknown):id is MotyaSkinId{return skinIds.some(value=>value===id);}
export function skinById(id:unknown):MotyaSkin{return motyaSkins.find(skin=>skin.id===id)??motyaSkins[0];}
export function skinSprite(id:MotyaSkinId,emotion:MotyaEmotion){return `/assets/motya/${id}/${emotion.toLowerCase()}.png`;}
export function readMotyaSkin(storage:Pick<Storage,'getItem'>,royalUnlocked=false):MotyaSkinId{
  try{const id=storage.getItem(skinStorageKey);return isSkinId(id)&&(id!=='royal'||royalUnlocked)?id:'classic';}catch{return 'classic';}
}
export function saveMotyaSkin(storage:Pick<Storage,'setItem'>,id:MotyaSkinId,royalUnlocked=false){
  if(id==='royal'&&!royalUnlocked)return false;
  try{storage.setItem(skinStorageKey,isSkinId(id)?id:'classic');return true;}catch{return false;}
}
// Royal is campaign-only. Included outfits retain their previous free availability.
export function motyaCollection(equippedSkinId:MotyaSkinId,royalUnlocked=false):MotyaCollection{
  return {ownedSkinIds:motyaSkins.filter(skin=>skin.initiallyUnlocked||skin.id==='royal'&&royalUnlocked).map(skin=>skin.id),equippedSkinId:equippedSkinId==='royal'&&!royalUnlocked?'classic':equippedSkinId};
}
