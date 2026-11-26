export const customizationKey='hexanexus.appearance.v1';
export const cubeSkins=[{id:'classic',name:'Классика'},{id:'wood',name:'Дерево'},{id:'crystal',name:'Кристалл'},{id:'gold',name:'Золото'}] as const;
export const fieldBackgrounds=[{id:'classic',name:'Классический'},{id:'stars',name:'Звёздная ночь'},{id:'forest',name:'Лес'},{id:'magic',name:'Магическая ночь'}] as const;
export type CubeSkin=typeof cubeSkins[number]['id'];
export type FieldBackground=typeof fieldBackgrounds[number]['id'];
export interface AppearanceSettings {version:1;cube:CubeSkin;background:FieldBackground}
export const defaultAppearance=():AppearanceSettings=>({version:1,cube:'classic',background:'classic'});
export function readAppearance(storage?:Pick<Storage,'getItem'>):AppearanceSettings {
 try{const v=JSON.parse(storage?.getItem(customizationKey)??'null');return {version:1,cube:cubeSkins.some(s=>s.id===v?.cube)?v.cube:'classic',background:fieldBackgrounds.some(s=>s.id===v?.background)?v.background:'classic'};}catch{return defaultAppearance();}
}
export class Customization {
 settings:AppearanceSettings;
 constructor(private storage?:Pick<Storage,'getItem'|'setItem'>){this.settings=readAppearance(storage);}
 select(kind:'cube'|'background',id:string){
  if(!(kind==='cube'?cubeSkins:fieldBackgrounds).some(s=>s.id===id))return false;
  const next={...this.settings,[kind]:id};
  try{if(!this.storage)return false;this.storage.setItem(customizationKey,JSON.stringify(next));this.settings=next;return true;}catch{return false;}
 }
}
