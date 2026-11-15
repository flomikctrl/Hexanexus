import type {MotyaSkinId} from './motya-skins';

export const giftSkinIds=['baker','winter','cosmic','sleepy','wizard'] as const;
export type GiftSkinId=typeof giftSkinIds[number];
export type GiftRarity='common'|'rare'|'legendary';
export const giftGroups:readonly {rarity:GiftRarity;weight:number;skins:readonly GiftSkinId[]}[]=[
 {rarity:'common',weight:60,skins:['baker','winter']},
 {rarity:'rare',weight:25,skins:['cosmic']},
 {rarity:'legendary',weight:15,skins:['sleepy','wizard']}
];
export interface GiftReceipt {id:number;skin:GiftSkinId}
export interface GiftCollection {version:1;owned:GiftSkinId[];sequence:number;pending:GiftReceipt|null}
export const emptyGifts=():GiftCollection=>({version:1,owned:[],sequence:0,pending:null});
export const isGiftSkin=(id:unknown):id is GiftSkinId=>giftSkinIds.some(s=>s===id);
export function validGifts(value:unknown):value is GiftCollection{
 const g=value as GiftCollection|undefined;
 return !!g&&g.version===1&&Array.isArray(g.owned)&&g.owned.every(isGiftSkin)&&new Set(g.owned).size===g.owned.length&&
  Number.isSafeInteger(g.sequence)&&g.sequence===g.owned.length&&
  (g.pending===null||!!g.pending&&g.pending.id===g.sequence&&isGiftSkin(g.pending.skin)&&g.owned.includes(g.pending.skin));
}
export function giftOdds(owned:readonly MotyaSkinId[]){
 const groups=giftGroups.map(g=>({...g,skins:g.skins.filter(s=>!owned.includes(s))}));
 const total=groups.reduce((sum,g)=>sum+(g.skins.length?g.weight:0),0);
 return groups.map(g=>({...g,probability:total&&g.skins.length?g.weight/total:0}));
}
// Rejection sampling avoids modulo bias, including when selecting one of three weights.
export function secureBelow(bound:number,fill:(array:Uint32Array)=>Uint32Array=a=>crypto.getRandomValues(a)){
 if(!Number.isSafeInteger(bound)||bound<1||bound>0x100000000)throw Error('Invalid random bound');
 const limit=Math.floor(0x100000000/bound)*bound,array=new Uint32Array(1);
 for(let attempt=0;attempt<128;attempt++){fill(array);if(array[0]<limit)return array[0]%bound;}
 throw Error('Random source unavailable');
}
export function chooseGift(owned:readonly MotyaSkinId[],below:(bound:number)=>number=secureBelow):GiftSkinId|null{
 const groups=giftOdds(owned).filter(g=>g.skins.length),total=groups.reduce((sum,g)=>sum+g.weight,0);
 if(!total)return null;
 const draw=(n:number)=>{const v=below(n);if(!Number.isInteger(v)||v<0||v>=n)throw Error('Invalid random sample');return v;};
 let ticket=draw(total);
 for(const group of groups){if(ticket<group.weight)return group.skins[draw(group.skins.length)];ticket-=group.weight;}
 throw Error('Invalid gift selection');
}
