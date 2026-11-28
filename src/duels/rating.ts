export const duelRatingKey='hexanexus.duels.rating.v1';
export const persistentDuelRating=true;
export interface DuelRating {version:1;cups:number;matches:number;wins:number;losses:number;streak:number;bestStreak:number;receipts:string[];deltas?:Record<string,number>}
export const emptyDuelRating=():DuelRating=>({version:1,cups:0,matches:0,wins:0,losses:0,streak:0,bestStreak:0,receipts:[]});
export function duelRank(cups:number){return cups>=900?'Алмаз':cups>=500?'Платина':cups>=250?'Золото':cups>=100?'Серебро':'Бронза';}
export class DuelRatingStore {
 data=emptyDuelRating();
 constructor(private storage?:Pick<Storage,'getItem'|'setItem'>){try{const v=JSON.parse(storage?.getItem(duelRatingKey)??'null');if(v?.version===1&&['cups','matches','wins','losses','streak','bestStreak'].every(k=>Number.isSafeInteger(v[k])&&v[k]>=0)&&Array.isArray(v.receipts)&&v.receipts.every((s:unknown)=>typeof s==='string')&&v.matches===v.wins+v.losses)this.data=v;}catch{}}
 record(matchId:string,won:boolean,technical=false){if(technical||!matchId||matchId.length>80||this.data.receipts.includes(matchId)||!this.storage)return false;const latest=new DuelRatingStore(this.storage);this.data=latest.data;if(this.data.receipts.includes(matchId))return false;const d=structuredClone(this.data);d.receipts.push(matchId);d.matches++;if(won){d.wins++;d.cups+=25;d.streak++;d.bestStreak=Math.max(d.bestStreak,d.streak);}else{d.losses++;d.cups=Math.max(0,d.cups-10);d.streak=0;}d.deltas={...d.deltas,[matchId]:d.cups-this.data.cups};try{this.storage.setItem(duelRatingKey,JSON.stringify(d));this.data=d;return true;}catch{return false;}}
}

export function ratingSummary(d:DuelRating){return `${duelRank(d.cups)} · ${d.cups} 🏆 · Матчей: ${d.matches} · Побед: ${d.wins} · Поражений: ${d.losses} · Победы: ${d.matches?Math.round(d.wins/d.matches*100):0}% · Серия: ${d.streak} · Лучшая: ${d.bestStreak}`;}
