import {levels} from './levels';
import {isSkinId,type MotyaSkinId,type MotyaEmotion} from './motya-skins';
import type {ArcadeRecords} from './arcade';
import {secondLevels} from './levels-second';

export const profileTitleIds=['novice','explorer','master','facets'] as const;
export type ProfileTitleId=typeof profileTitleIds[number];
export type ProfileFrameId='plain'|'gold';
export interface PlayerProfile {
 version:1;name:string;avatar:{skin:MotyaSkinId;emotion:MotyaEmotion};
 title:ProfileTitleId;frame:ProfileFrameId;unlockedTitles:ProfileTitleId[];
}
export const profileTitles=[
 {id:'novice',name:'Новичок',condition:'Доступно сразу'},
 {id:'explorer',name:'Исследователь',condition:'Пройдите 10 уровней первой кампании'},
 {id:'master',name:'Мастер силуэтов',condition:'Пройдите все 30 уровней первой кампании'},
 {id:'facets',name:'Повелитель граней',condition:'Пройдите обе кампании'}
] as const;
// Additional active campaigns can supply their real statistics here later.
export interface CampaignProfileStats {id:string;name:string;completed:number;total:number;percent:number}
const firstNames=levels.slice(0,30).map(l=>l.name);
export function campaignProfileStats(completed:readonly string[],campaign:'first'|'second'='first'):CampaignProfileStats{
 const names=campaign==='first'?firstNames:secondLevels.map(l=>l.name),count=names.filter(n=>completed.includes(n)).length;
 return {id:campaign==='first'?'campaign-1':'campaign-2',name:campaign==='first'?'Кампания I · 3×3×3':'Кампания II · 4×4×4',completed:count,total:names.length,percent:names.length?Math.round(count/names.length*100):0};
}
export function normalizedPlayerName(value:string){return value.trim().normalize('NFC');}
export function playerNameError(value:string){
 const name=normalizedPlayerName(value),length=Array.from(name).length;
 if(!length)return 'Введите имя от 1 до 20 символов.';
 if(length>20)return 'Имя должно содержать не больше 20 символов.';
 if(!/^[\p{L}\p{M}\p{N} _-]+$/u.test(name))return 'Используйте буквы, цифры, пробелы, дефис или подчёркивание.';
 return '';
}
export const isMotyaEmotion=(value:unknown):value is MotyaEmotion=>value==='IDLE'||value==='SAD'||value==='SHOCK';
export const defaultPlayerProfile=():PlayerProfile=>({version:1,name:'Игрок',avatar:{skin:'classic',emotion:'IDLE'},title:'novice',frame:'plain',unlockedTitles:['novice']});
export function normalizePlayerProfile(value:unknown,completed:readonly string[],canUse:(skin:MotyaSkinId)=>boolean,secondCompleted:readonly string[]=[]):PlayerProfile{
 const p=value as Partial<PlayerProfile>|null,profile=defaultPlayerProfile();
 const count=campaignProfileStats(completed).completed;
 const persisted=p?.version===1&&Array.isArray(p.unlockedTitles)?p.unlockedTitles:[];
 if(count>=10||persisted.includes('explorer'))profile.unlockedTitles.push('explorer');
 if(count>=30||persisted.includes('master'))profile.unlockedTitles.push('master');
 const both=count===30&&campaignProfileStats(secondCompleted,'second').completed===30;
 if(both)profile.unlockedTitles.push('facets');
 if(p?.version!==1)return profile;
 if(typeof p.name==='string'&&!playerNameError(p.name))profile.name=normalizedPlayerName(p.name);
 if(isSkinId(p.avatar?.skin)&&canUse(p.avatar.skin))profile.avatar.skin=p.avatar.skin;
 if(isMotyaEmotion(p.avatar?.emotion))profile.avatar.emotion=p.avatar.emotion;
 if(p.title&&profile.unlockedTitles.includes(p.title))profile.title=p.title;
 if(both&&p.frame==='gold')profile.frame='gold';
 return profile;
}
export interface ProfileEdit {name?:string;avatar?:{skin:MotyaSkinId;emotion:MotyaEmotion};title?:ProfileTitleId;frame?:ProfileFrameId}
export function editedPlayerProfile(profile:PlayerProfile,edit:ProfileEdit,canUse:(skin:MotyaSkinId)=>boolean):PlayerProfile|null{
 const next=structuredClone(profile);
 if(edit.name!==undefined){if(typeof edit.name!=='string'||playerNameError(edit.name))return null;next.name=normalizedPlayerName(edit.name);}
 if(edit.avatar!==undefined){if(!isSkinId(edit.avatar.skin)||!canUse(edit.avatar.skin)||!isMotyaEmotion(edit.avatar.emotion))return null;next.avatar={...edit.avatar};}
 if(edit.title!==undefined){if(!profile.unlockedTitles.includes(edit.title))return null;next.title=edit.title;}
 if(edit.frame!==undefined){if(edit.frame!=='plain'&&(edit.frame!=='gold'||!profile.unlockedTitles.includes('facets')))return null;next.frame=edit.frame;}
 return next;
}
export function arcadeProfileStats(records:ArcadeRecords){return {solved:Math.max(0,records.bestRound-1),score:records.bestScore,streak:records.bestStreak};}
