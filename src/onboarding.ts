import {gridCells,identity,key,type Vec} from './math';
import {project} from './projections';
import {Puzzle} from './state';
import type {Level} from './levels';

export const onboardingKey='hexanexus.onboarding.v1';
export const learningSteps=[
 {title:'Поверните конструкцию',text:'Проведите пальцем по фигуре или фону.'},
 {title:'Поставьте кубик',text:'Нажмите на подсвеченную ячейку справа от основы.'},
 {title:'Уберите свой кубик',text:'Включите «Удалить» и коснитесь светлого кубика.'},
 {title:'Отмените удаление',text:'Нажмите «Отменить», чтобы вернуть последний ход.'},
 {title:'Сравните два силуэта',text:'Нажмите «Ошибки». Зелёный — совпало, жёлтый — нужен кубик.'},
 {title:'Завершите фигуру',text:'Поставьте кубик над светлым блоком — оба силуэта совпадут.'}
] as const;
type LearningStorage=Pick<Storage,'getItem'|'setItem'>;
export function learningLevel():Level{const fixed:Vec[]=[[0,0,0]],answer:Vec[]=[[1,0,0],[1,1,0]];return {name:'Знакомство с Гексанексусом',fixed,available:gridCells(3).filter(v=>key(v)!=='0,0,0'),limit:2,orientation:identity(),targets:project([...fixed,...answer],identity())};}
export class Onboarding {
 step=0;done=false;error='';canSkip=false;
 constructor(private storage?:LearningStorage){this.canSkip=hasExistingPlayer(storage);try{const v=JSON.parse(storage?.getItem(onboardingKey)??'null');if(v?.version===1){this.done=v.done===true;this.canSkip=v.canSkip===true;if(Number.isInteger(v.step)&&v.step>=0&&v.step<learningSteps.length)this.step=v.step;}else this.persist();}catch{this.persist();}}
 private persist(){try{this.storage?.setItem(onboardingKey,JSON.stringify({version:1,done:this.done,step:this.step,canSkip:this.canSkip}));this.error='';return true;}catch{this.error='Не удалось сохранить обучение. Освободите место и попробуйте ещё раз.';return false;}}
 advance(action:'rotate'|'place'|'remove'|'undo'|'silhouettes'|'solve'){
  const expected=['rotate','place','remove','undo','silhouettes','solve'][this.step];if(this.done||action!==expected)return false;
  const previous=this.step;if(this.step===5)this.done=true;else this.step++;
  if(!this.persist()){this.step=previous;this.done=false;return false;}return true;
 }
 skip(){const was=this.done;this.done=true;if(this.persist())return true;this.done=was;return false;}
 replay(){this.canSkip=this.done||this.canSkip;this.step=0;this.done=false;this.persist();}
 puzzle(){const p=new Puzzle(learningLevel());if(this.step>=2)p.place([1,0,0]);if(this.step===3)p.remove([1,0,0]);return p;}
 accepts(tool:'place'|'remove',cell:Vec){return (this.step===1&&tool==='place'&&key(cell)==='1,0,0')||(this.step===2&&tool==='remove'&&key(cell)==='1,0,0')||(this.step===5&&tool==='place'&&key(cell)==='1,1,0');}
}

export function hasExistingPlayer(storage?:Pick<Storage,'getItem'>){try{return ['hexanexus.progress.v2','hexanexus.campaign2.progress.v1','hexanexus.economy.v1','hexanexus.arcade.records.v1'].some(k=>storage?.getItem(k)!=null);}catch{return false;}}
