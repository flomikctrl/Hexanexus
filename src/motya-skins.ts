export const skinIds=['classic','sleepy','baker','winter','wizard','cosmic','royal'] as const;
export type MotyaSkinId=typeof skinIds[number];
export type MotyaEmotion='IDLE'|'SAD'|'SHOCK';
export type SkinRarity='base'|'common'|'rare'|'legendary'|'exclusive';
export interface MotyaSkin {
  id:MotyaSkinId;name:string;rarity:SkinRarity;initiallyUnlocked:boolean;
  acquisition:'included'|'gift'|'campaign-30';description:string;
  canDropFromGifts?:boolean;canPurchase?:boolean;
}
export interface MotyaCollection {ownedSkinIds:MotyaSkinId[];equippedSkinId:MotyaSkinId}
export const skinStorageKey='hexanexus.motya.skin.v1';
export const rarityLabels:Record<SkinRarity,string>={base:'Базовая',common:'Обычная',rare:'Редкая',legendary:'Легендарная',exclusive:'Эксклюзивная'};
export const motyaSkins:readonly MotyaSkin[]=[
  {id:'classic',name:'Классическая Мотя',rarity:'base',initiallyUnlocked:true,acquisition:'included',description:'Мягкие крылышки и большое любопытство.'},
  {id:'sleepy',name:'Сонная Мотя',rarity:'legendary',initiallyUnlocked:false,acquisition:'gift',canDropFromGifts:true,description:'Ещё одну загадку — и под одеялко.'},
  {id:'baker',name:'Мотя-кондитер',rarity:'common',initiallyUnlocked:false,acquisition:'gift',canDropFromGifts:true,description:'Щепотка уюта, ложечка волшебства.'},
  {id:'winter',name:'Зимняя Мотя',rarity:'common',initiallyUnlocked:false,acquisition:'gift',canDropFromGifts:true,description:'В тёплом наряде даже снежинки не страшны.'},
  {id:'wizard',name:'Мотя-волшебница',rarity:'legendary',initiallyUnlocked:false,acquisition:'gift',canDropFromGifts:true,description:'Самое сильное заклинание — «попробуем ещё».'},
  {id:'cosmic',name:'Космическая Мотя',rarity:'rare',initiallyUnlocked:false,acquisition:'gift',canDropFromGifts:true,description:'Маленькая моль в большой вселенной форм.'},
  {id:'royal',name:'Королева Мотя',rarity:'exclusive',initiallyUnlocked:false,acquisition:'campaign-30',canDropFromGifts:false,canPurchase:false,description:'Корона для тех, кто разгадал все силуэты.'}
];
export function isSkinId(id:unknown):id is MotyaSkinId{return skinIds.some(value=>value===id);}
export function skinById(id:unknown):MotyaSkin{return motyaSkins.find(skin=>skin.id===id)??motyaSkins[0];}
export function skinSprite(id:MotyaSkinId,emotion:MotyaEmotion){return `/assets/motya/${id}/${emotion.toLowerCase()}.png`;}
export function readMotyaSkin(storage:Pick<Storage,'getItem'>,royalUnlocked=false,owned:readonly MotyaSkinId[]=[]):MotyaSkinId{
  try{const id=storage.getItem(skinStorageKey);return isSkinId(id)&&motyaCollection(id,royalUnlocked,owned).ownedSkinIds.includes(id)?id:'classic';}catch{return 'classic';}
}
export function saveMotyaSkin(storage:Pick<Storage,'setItem'>,id:MotyaSkinId,royalUnlocked=false,owned:readonly MotyaSkinId[]=[]){
  if(!isSkinId(id)||!motyaCollection(id,royalUnlocked,owned).ownedSkinIds.includes(id))return false;
  try{storage.setItem(skinStorageKey,isSkinId(id)?id:'classic');return true;}catch{return false;}
}
export function motyaCollection(equippedSkinId:MotyaSkinId,royalUnlocked=false,owned:readonly MotyaSkinId[]=[]):MotyaCollection{
  const ownedSkinIds=motyaSkins.filter(skin=>skin.initiallyUnlocked||(skin.id==='royal'?royalUnlocked:owned.includes(skin.id))).map(skin=>skin.id);
  return {ownedSkinIds,equippedSkinId:ownedSkinIds.includes(equippedSkinId)?equippedSkinId:'classic'};
}
