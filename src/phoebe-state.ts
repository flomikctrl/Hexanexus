export type PhoebeEmotion='IDLE'|'SAD'|'SHOCK';
export type PhoebeAnimation='idle'|'sad'|'shock'|'tap'|'victory'|'final-victory';
export type PhoebeEvent=
  |{type:'greeting'|'level-start'|'placed'|'level-win'|'game-win'|'manual'}
  |{type:'diagnostics';hasErrors:boolean}
  |{type:'forbidden';reason:'fixed'|'stock'|'disconnected'|'other'};
export interface PhoebeState {enabled:boolean;emotion:PhoebeEmotion;animation:PhoebeAnimation;message:string}
export const phoebeSettingKey='hexanexus.phoebe.enabled';
export const friendlyLines=['Ты справишься!','Мне нравится эта головоломка!','Интересно, что получится?','Может, посмотрим с другой стороны?','Я верю в тебя!','Не спеши. У нас всё получится!','Каждый кубик — маленькое открытие.'];
const idle=(enabled:boolean):PhoebeState=>({enabled,emotion:'IDLE',animation:'idle',message:''});
export function readPhoebeSetting(storage:Pick<Storage,'getItem'>){try{return storage.getItem(phoebeSettingKey)!=='false';}catch{return true;}}
export function savePhoebeSetting(storage:Pick<Storage,'setItem'>,enabled:boolean){try{storage.setItem(phoebeSettingKey,String(enabled));return true;}catch{return false;}}

// This controller receives notifications only; it has no access to the puzzle.
export class PhoebeController {
  state:PhoebeState;
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
    if(event.type==='level-start'){this.reset();this.accepted.clear();this.lastSpeech=-Infinity;}
    if(event.type==='diagnostics'&&!event.hasErrors)return false;
    let emotion:PhoebeEmotion='IDLE',animation:PhoebeAnimation='idle',message='',priority=10,duration=4800;
    switch(event.type){
      case 'greeting':message='Ну что, начнём?';break;
      case 'level-start':message='Давай соберём эту загадку!';break;
      case 'placed':message='Отлично! Продолжай!';break;
      case 'manual':message=friendlyLines[Math.min(friendlyLines.length-1,Math.floor(this.random()*friendlyLines.length))];animation='tap';break;
      case 'diagnostics':emotion='SAD';animation='sad';message='Хм-м… кажется, тут что-то не сходится.';priority=20;break;
      case 'forbidden':priority=30;emotion='SHOCK';animation='shock';message=event.reason==='fixed'?'Ой! Этот кубик трогать нельзя!':event.reason==='stock'?'Кажется, у нас больше нет кубиков…':event.reason==='disconnected'?'Этот кубик держит другие блоки. Сначала уберём их.':'Ой! Так сделать не получится.';if(event.reason==='disconnected'){emotion='SAD';animation='sad';}else duration=2600;break;
      case 'level-win':priority=40;animation='victory';message='Ура! Мы справились!';duration=5200;break;
      case 'game-win':priority=50;animation='final-victory';message='Ты прошёл все испытания! Я так рада!';duration=6000;break;
    }
    if(now<this.activeUntil&&priority<this.priority)return false;
    if(now<this.activeUntil&&this.state.emotion==='SHOCK'&&emotion!=='SHOCK'&&priority<=this.priority)return false;
    const key=event.type==='forbidden'?`${event.type}:${event.reason}`:event.type;
    if(event.type==='manual'&&now-this.lastManual<4500)return false;
    if(now-(this.accepted.get(key)??-Infinity)<5000)return false;
    if(priority===10&&now-this.lastSpeech<5500)return false;
    this.clearTimers();this.accepted.set(key,now);this.lastSpeech=now;if(event.type==='manual')this.lastManual=now;
    this.priority=priority;this.activeUntil=now+duration;this.state={enabled:true,emotion,animation,message};this.publish();
    this.speechTimer=setTimeout(()=>{this.speechTimer=undefined;this.state={...this.state,message:''};this.publish();},4200);
    this.reactionTimer=setTimeout(()=>this.reset(),duration);
    return true;
  }
  dispose(){this.clearTimers();}
}
