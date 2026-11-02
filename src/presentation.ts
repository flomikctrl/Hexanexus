export type ProjectionMode = 'training' | 'normal';
export type CellStyle = 'correct' | 'missing' | 'excess' | 'empty' | 'goal';
export const cellStyle = (target:boolean, actual:boolean, mode:ProjectionMode):CellStyle =>
  mode==='normal' ? (target?'goal':'empty') : target ? (actual?'correct':'missing') : (actual?'excess':'empty');
export const cellColors:Record<CellStyle,number> = {correct:0x50c995,missing:0xf1c65c,excess:0xef7867,empty:0x243e3b,goal:0xf1cf82};
export const cellLabels:Record<CellStyle,string> = {correct:'✓ Совпадает с образцом',missing:'+ Требуется кубик',excess:'− Лишний кубик',empty:'· Правильно пустая клетка',goal:'■ Целевая заполненная клетка'};
import type {Targets} from './projections';
export function diagnose(targets:Targets,actual:Targets){
  return targets.map((target,s)=>({
    styles:target.map((v,i)=>cellStyle(v,actual[s][i],'training')),
    matches:target.reduce((n,v,i)=>n+Number(v===actual[s][i]),0)
  }));
}
export const blockAppearance={
  fixed:{body:0x155851,emissive:0x103d34,emission:.24,edge:0xc9a55c,corner:0xb9934c},
  player:{body:0x67c9ad,emissive:0x31896a,emission:.42,edge:0xb3e3cb,corner:0x263e3b}
};
export const removalHighlight=(fixed:boolean,removable:boolean)=>fixed?0xffb84d:removable?0xee3525:0xef9245;
