import './hints.css';
import {HintChain,hintSnapshot,hintSignature,type HintPathResult} from './hint-path';
import type {Puzzle} from './state';
import type {Scene} from './scene';

export class CampaignHints {
 readonly chain=new HintChain();
 private button=document.getElementById('hint')!;
 private status=document.createElement('p');
 private job:{worker:Worker;timer:ReturnType<typeof setTimeout>;signature:string;queued:number}|null=null;
 constructor(private view:Scene,private puzzle:()=>Puzzle,private enabled:()=>boolean,private message:(text:string)=>void){
  this.button.removeAttribute('aria-pressed');this.button.title='Показать следующий шаг решения';this.button.setAttribute('aria-label',this.button.title);
  this.status.id='hint-status';this.status.hidden=true;this.status.setAttribute('aria-live','polite');document.querySelector('.game-footer')!.append(this.status);
  this.button.onclick=()=>this.next();
 }
 private cancel(){if(this.job){this.job.worker.terminate();clearTimeout(this.job.timer);this.job=null;}this.button.removeAttribute('aria-busy');}
 clear(){this.cancel();this.chain.clear();this.view.setHints([]);this.status.hidden=true;document.body.classList.remove('campaign-hints-visible');}
 refresh(){
  const p=this.puzzle();if(this.job&&this.job.signature!==hintSignature(p))this.cancel();
  this.chain.reconcile(p);this.render();
 }
 private render(){
  const visible=this.enabled()?this.chain.visible:[];this.view.setHints(visible);this.status.hidden=!visible.length;
  document.body.classList.toggle('campaign-hints-visible',visible.length>0);
  this.status.textContent=visible.length?`Подсказки: ${visible.length} · + поставить · − убрать`:'';
 }
 private reveal(){
  const step=this.chain.next();this.render();
  if(!step){this.message('Все шаги решения показаны!');return;}
  this.message(`Шаг ${step.number}: ${step.tool==='place'?'поставьте золотистый кубик (+)':'уберите оранжевый кубик (−)'}.${this.chain.complete?' Все шаги решения показаны!':''}`);
 }
 private next(){
  if(!this.enabled())return;
  this.refresh();if(this.puzzle().won){this.clear();this.message('Оба силуэта уже совпадают.');return;}
  if(this.chain.hasPlan){this.reveal();return;}
  if(this.job){this.job.queued++;return;}
  try{
   const worker=new Worker(new URL('./hint-worker.ts',import.meta.url),{type:'module'}),signature=hintSignature(this.puzzle());
   const fail=()=>{if(this.job?.worker!==worker)return;this.cancel();this.message('Не удалось найти путь за отведённое время. Измените конструкцию и попробуйте снова.');};
   this.job={worker,signature,queued:1,timer:setTimeout(fail,3000)};this.button.setAttribute('aria-busy','true');
   worker.onerror=fail;
   worker.onmessage=(event:MessageEvent<HintPathResult>)=>{
    if(this.job?.worker!==worker)return;const queued=this.job.queued;this.cancel();
    if(!this.enabled()||hintSignature(this.puzzle())!==signature)return;
    const result=event.data;
    if(result.status==='solved'){this.message('Оба силуэта уже совпадают.');return;}
    if(result.status!=='found'||!this.chain.set(this.puzzle(),result.steps)){
     this.message(result.status==='limit'?'Достигнут лимит поиска. Измените конструкцию и попробуйте снова.':'Не удалось найти допустимый путь к обоим силуэтам.');return;
    }
    for(let i=0;i<Math.min(queued,result.steps.length+1);i++)this.reveal();
   };
   worker.postMessage(hintSnapshot(this.puzzle()));
  }catch{this.cancel();this.message('Поиск подсказок недоступен в этом браузере.');}
 }
}
