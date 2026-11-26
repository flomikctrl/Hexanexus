import './arcade.css';
import {ArcadeSession,readArcadeRecords,type ArcadeEvent,type ArcadeResult,type ArcadeStorage} from './arcade';
import type {Scene} from './scene';
import type {MotyaAssistant} from './motya';
import type {Tool} from './interaction';
import type {Vec} from './math';
import type {Economy} from './economy';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
export class ArcadeUI {
 active=false;
 private session:ArcadeSession|null=null;
 private storage:ArcadeStorage|undefined;
 private tool:Tool='place';
 private lastSave=0;
 private rewarded=false;
 constructor(private view:Scene,private motya:MotyaAssistant,private enter:()=>void,private home:()=>void,private message:(text:string)=>void,private economy?:Economy){
  try{this.storage=localStorage;}catch{}
  this.session=ArcadeSession.restore(this.storage,undefined,event=>this.reaction(event));
  el('play').insertAdjacentHTML('afterend','<button id="open-arcade">Бесконечный режим</button>');
  document.querySelector('.game-header')!.insertAdjacentHTML('beforeend','<div id="arcade-hud" hidden><span id="arcade-score"></span><span id="arcade-lives" aria-label="Жизни"></span><time id="arcade-time" aria-label="Осталось времени"></time></div>');
  el('app').insertAdjacentHTML('beforeend',`<dialog id="arcade-entry" class="arcade-dialog" aria-labelledby="arcade-entry-title"><small>НОВЫЙ РЕЖИМ · ОФЛАЙН</small><h2 id="arcade-entry-title">Бесконечный режим</h2><p>Одна конструкция. Один ход на каждый новый силуэт: добавьте или удалите кубик. Ошибка сразу отнимает сердечко и отменяет ход. Всего три жизни.</p><p id="arcade-records"></p><button id="arcade-continue" class="primary">Продолжить партию</button><button id="arcade-start">Новая партия</button><button id="arcade-entry-home">Назад</button></dialog>
  <dialog id="arcade-pause" class="arcade-dialog" aria-labelledby="arcade-pause-title"><small>ТАЙМЕР ОСТАНОВЛЕН</small><h2 id="arcade-pause-title">Пауза</h2><button id="arcade-resume" class="primary">Продолжить</button><button id="arcade-view">Начальный ракурс</button><button id="arcade-pause-home">Сохранить и выйти</button><p>Найдите один ход для обоих силуэтов. Основа не удаляется. За запрещённый ход жизнь не снимается.</p></dialog>
  <dialog id="arcade-results" class="arcade-dialog" aria-labelledby="arcade-result-title"><small>БЕСКОНЕЧНЫЙ РЕЖИМ</small><h2 id="arcade-result-title">Хорошая работа!</h2><p id="arcade-result-values"></p><p id="arcade-result-records"></p><button id="arcade-replay" class="primary">Ещё одна партия</button><button id="arcade-result-home">Главное меню</button></dialog>`);
  el('open-arcade').onclick=()=>this.open();
  el('arcade-entry-home').onclick=()=>el<HTMLDialogElement>('arcade-entry').close();
  el('arcade-start').onclick=()=>{el<HTMLDialogElement>('arcade-entry').close();this.start(true);};
  el('arcade-continue').onclick=()=>{el<HTMLDialogElement>('arcade-entry').close();this.start(false);};
  el('arcade-resume').onclick=()=>this.resume();
  el('arcade-view').onclick=()=>this.view.resetCamera();
  for(const id of ['arcade-pause-home','arcade-result-home'])el(id).onclick=()=>{this.closeDialogs();this.leave();this.home();};
  el('arcade-replay').onclick=()=>{this.closeDialogs();this.start(true);};
  // Escape is a safe pause, not an implicit resume or a way to dismiss game over.
  for(const id of ['arcade-pause','arcade-results'])el<HTMLDialogElement>(id).addEventListener('cancel',event=>event.preventDefault());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause(true);});
  window.addEventListener('pagehide',()=>this.pause(true));window.addEventListener('blur',()=>this.pause(true));
  window.addEventListener('hexanexus:native-pause',()=>this.pause(true));
  setInterval(()=>{
   if(!this.active||!this.session||this.session.state.paused)return;
   const result=this.session.tick();if(result)this.handle(result);this.drawHud();
   if(performance.now()-this.lastSave>1000){this.session.persist();this.lastSave=performance.now();}
  },150);
 }
 private open(){
  const r=readArcadeRecords(this.storage);
  el('arcade-records').textContent=`Рекорд: ${r.bestScore} очков · Раунд ${r.bestRound}\nЛучшая серия: ${r.bestStreak} · Партий завершено: ${r.games}`;
  const resumable=!!this.session&&!this.session.state.finished;
  el('arcade-continue').hidden=!resumable;
  el('arcade-start').textContent=resumable?'Новая партия — заменить сохранённую':'Начать партию';
  el<HTMLDialogElement>('arcade-entry').showModal();
 }
 private start(fresh:boolean){
  if(fresh||!this.session)this.session=ArcadeSession.create(crypto.getRandomValues(new Uint32Array(1))[0],this.storage,undefined,event=>this.reaction(event));
  this.active=true;document.body.classList.add('arcade-playing');this.enter();this.tool='place';this.setTool('place');this.view.resetCamera();
  this.session!.resume();this.drawHud();this.motya.notify({type:'arcade',reaction:'start'});
  if(this.session!.saveFailed)this.message('Сохранение недоступно: не закрывайте приложение во время партии.');
 }
 leave(){
  if(!this.active)return;this.session?.pause();this.active=false;document.body.classList.remove('arcade-playing');el('arcade-hud').hidden=true;
  this.closeDialogs();this.view.gesture.cancel();
 }
 resume(){if(!this.active||!this.session||this.session.state.finished)return;el<HTMLDialogElement>('arcade-pause').close();this.session.resume();this.view.controls.enabled=true;this.view.gesture.cancel();this.drawHud();}
 pause(freezeLastTick=false){
  if(!this.active||!this.session||this.session.state.finished)return;
  this.session.pause(!freezeLastTick);this.view.controls.enabled=false;this.view.clearHover();this.view.gesture.cancel();
  if(this.session.state.finished){this.results();return;}
  if(!el<HTMLDialogElement>('arcade-pause').open)el<HTMLDialogElement>('arcade-pause').showModal();this.drawHud();
 }
 private closeDialogs(){for(const id of ['arcade-pause','arcade-results'])el<HTMLDialogElement>(id).close();}
 setTool(tool:Tool){
  this.tool=tool;for(const next of ['place','remove']){el(next).classList.toggle('active',next===tool);el(next).setAttribute('aria-pressed',String(next===tool));}this.draw();
 }
 act(cell:Vec,tool:Tool=this.tool){
  if(!this.active||!this.session)return;
  const result=this.session.act(tool,cell);this.handle(result);
  if(result!=='blocked'){this.draw();this.drawHud();}
 }
 private handle(result:ArcadeResult){
  if(result==='correct')this.message(`Верно! ${this.economy?(this.rewarded?'+5 гексиков. ':this.economy.error+' '):''}Новый силуэт — следующий ход.`);
  if(result==='mistake')this.message('Минус сердечко. Ход отменён; задача прежняя.');
  if(result==='timeout')this.message('Время вышло. Минус сердечко; попробуйте ту же задачу.');
  if(result==='invalid')this.message('Ход запрещён. Жизни сохранены.');
  if(result==='end')this.results();
 }
 draw(){
  if(!this.session)return;this.view.setInteraction(this.tool,27-this.session.puzzle.cells.length);this.view.sync(this.session.puzzle,false,false,'normal');this.view.directions.visible=false;
  this.drawHud();
 }
 private drawHud(){
  if(!this.active||!this.session)return;const s=this.session.state;
  el('arcade-hud').hidden=false;el('level-name').textContent=`Раунд ${s.round}`;el('arcade-score').textContent=`${s.score} очков`;
  el('arcade-lives').textContent='♥'.repeat(s.lives)+'♡'.repeat(3-s.lives);el('arcade-lives').setAttribute('aria-label',`Жизни: ${s.lives} из 3`);
  const seconds=Math.ceil(s.remainingMs/1000);el('arcade-time').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;el('arcade-time').classList.toggle('urgent',seconds<=10);
  el('menu').setAttribute('aria-label','Пауза бесконечного режима');
 }
 private reaction(event:ArcadeEvent){
  if(event.type==='correct')this.rewarded=this.economy?.recordArcade(event.id,event.round-1)??false;
  const reaction=event.type==='mistake'||event.type==='timeout'?'error':event.type==='correct'?'success':event.type;
  this.motya.notify({type:'arcade',reaction});
 }
 private results(){
  if(!this.session)return;this.view.controls.enabled=false;this.view.clearHover();this.view.gesture.cancel();const {state:s,records:r}=this.session;
  el('arcade-result-values').textContent=`Счёт: ${s.score}\nРаунд: ${s.round} · Решено: ${s.round-1}\nЛучшая серия партии: ${s.bestStreak}`;
  el('arcade-result-records').textContent=`Личный рекорд: ${r.bestScore} очков · Раунд ${r.bestRound}\nЛучшая серия: ${r.bestStreak} · Завершено партий: ${r.games}`;
  el<HTMLDialogElement>('arcade-pause').close();if(!el<HTMLDialogElement>('arcade-results').open)el<HTMLDialogElement>('arcade-results').showModal();
 }
}
