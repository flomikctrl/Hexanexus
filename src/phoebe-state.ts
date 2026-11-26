import {phoebeLines,friendlyLines} from './phoebe-lines';
export {friendlyLines} from './phoebe-lines';
export type PhoebeEmotion='IDLE'|'SAD'|'SHOCK';
export type PhoebeAnimation='idle'|'sad'|'shock'|'tap'|'victory'|'final-victory';
export type PhoebeEvent=
  |{type:'achievement';name:string}
  |{type:'arcade';reaction:'start'|'success'|'error'|'record'|'end'}
  |{type:'greeting'|'level-win'|'manual'}
  |{type:'level-start';levelIndex?:number;levelCount?:number}
  |{type:'placed';improved?:boolean}
  |{type:'game-win';levelCount?:number}
  |{type:'diagnostics';hasErrors:boolean}
  |{type:'forbidden';reason:'fixed'|'stock'|'disconnected'|'other'};
export interface PhoebeState {enabled:boolean;emotion:PhoebeEmotion;animation:PhoebeAnimation;message:string}
const idle=(enabled:boolean):PhoebeState=>({enabled,emotion:'IDLE',animation:'idle',message:''});

// This controller receives notifications only; it has no access to the puzzle.
export class PhoebeController {
  state:PhoebeState;
  private recent:string[]=[];
  private priority=0;
  private activeUntil=0;
  private lastSpeech=-Infinity;
  private lastManual=-Infinity;
  private accepted=new Map<string,number>();
  private speechTimer:ReturnType<typeof setTimeout>|undefined;
  private reactionTimer:ReturnType<typeof setTimeout>|undefined;
  constructor(enabled=true,private render:(state:PhoebeState)=>void=()=>{},private random:()=>number=Math.random){this.state=idle(enabled);}
  private clearTimers(){clearTimeout(this.speechTimer);clearTimeout(this.reactionTimer);this.speechTimer=undefined;this.reactionTimer=undefined;}
  private publish(){this.render({...this.state});}
  reset(){this.clearTimers();this.priority=0;this.activeUntil=0;this.state=idle(this.state.enabled);this.publish();}
  setEnabled(enabled:boolean){this.clearTimers();this.priority=0;this.activeUntil=0;this.state=idle(enabled);this.publish();}
  notify(event:PhoebeEvent){
    if(!this.state.enabled)return false;
    const now=Date.now();
    if(event.type==='level-start'||event.type==='arcade'&&event.reaction==='start'){this.reset();this.accepted.clear();this.lastSpeech=-Infinity;}
    if(event.type==='diagnostics'&&!event.hasErrors)return false;
    let emotion:PhoebeEmotion='IDLE',animation:PhoebeAnimation='idle',message='',pool:string[]=[],priority=10,duration=4800;
    switch(event.type){
      case 'achievement':pool=[`Ура! «${event.name}» — наше достижение!`];animation='victory';priority=40;duration=3600;break;
      case 'arcade':{
        const lines={start:['Посмотрим, сколько продержимся!','Я буду считать кубики!','Новая мастерская начинается!'],success:['Есть! Ещё один!','Красиво получилось!','Продолжаем!'],error:['Ой! Минус сердечко…','Осторожнее с кубиками!','Ничего, попробуй ещё!'],record:['УРА! Новый рекорд!','Мы стали ещё лучше!','Я так тобой горжусь!'],end:['Мы хорошо постарались!','В следующий раз получится ещё лучше!']};
        pool=lines[event.reaction];duration=2600;
        if(event.reaction==='error'){emotion='SHOCK';animation='shock';priority=45;}
        if(event.reaction==='record'){animation='victory';priority=40;}
        if(event.reaction==='end'){emotion='SAD';animation='sad';priority=50;}
        break;
      }
      case 'greeting':pool=phoebeLines.greeting;break;
      case 'level-start':pool=event.levelIndex!==undefined&&event.levelCount!==undefined&&event.levelIndex>=event.levelCount-5?phoebeLines.late:phoebeLines.start;break;
      case 'placed':pool=event.improved? [...phoebeLines.placed,...phoebeLines.improved]:phoebeLines.placed;break;
      case 'manual':pool=friendlyLines;animation='tap';break;
      case 'diagnostics':emotion='SAD';animation='sad';pool=phoebeLines.diagnostics;priority=20;break;
      case 'forbidden':priority=30;emotion='SHOCK';animation='shock';pool=event.reason==='other'?phoebeLines.forbidden:phoebeLines[event.reason];if(event.reason==='disconnected'){emotion='SAD';animation='sad';}else duration=2600;break;
      case 'level-win':priority=40;animation='victory';pool=phoebeLines.win;duration=5200;break;
      case 'game-win':priority=50;animation='final-victory';pool=event.levelCount===30?phoebeLines.final:phoebeLines.final.filter(line=>!line.includes('тридцать'));duration=6000;break;
    }
    if(now<this.activeUntil&&priority<this.priority)return false;
    if(now<this.activeUntil&&this.state.emotion==='SHOCK'&&emotion!=='SHOCK'&&priority<=this.priority)return false;
    const key=event.type==='forbidden'?`${event.type}:${event.reason}`:event.type==='arcade'?`${event.type}:${event.reaction}`:event.type;
    if(event.type==='manual'&&now-this.lastManual<4500)return false;
    if(now-(this.accepted.get(key)??-Infinity)<5000)return false;
    if(priority===10&&now-this.lastSpeech<5500)return false;
    let choices=pool.filter(line=>!this.recent.includes(line));
    if(!choices.length)choices=pool.filter(line=>line!==this.recent.at(-1));
    if(!choices.length)choices=pool;
    message=choices[Math.max(0,Math.min(choices.length-1,Math.floor(this.random()*choices.length)))];
    this.recent=[...this.recent.slice(-2),message];
    this.clearTimers();this.accepted.set(key,now);this.lastSpeech=now;if(event.type==='manual')this.lastManual=now;
    this.priority=priority;this.activeUntil=now+duration;this.state={enabled:true,emotion,animation,message};this.publish();
    this.speechTimer=setTimeout(()=>{this.speechTimer=undefined;this.state={...this.state,message:''};this.publish();},4200);
    this.reactionTimer=setTimeout(()=>this.reset(),duration);
    return true;
  }
  dispose(){this.clearTimers();}
}
