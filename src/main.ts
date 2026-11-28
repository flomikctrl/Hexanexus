import './style.css';
import {key,type Vec} from './math';
import {levels as firstLevels,levelGroups as firstGroups,type Level} from './levels';
import {campaigns,campaignUnlocked,campaignLevelUnlocked,completedSecondCampaign,type CampaignId} from './campaigns';
import {CampaignSelection} from './campaign-ui';
import {secondProgressKey,progressKey} from './progress';
import {Puzzle} from './state';
import {Scene} from './scene';
import {diagnose,type ProjectionMode} from './presentation';
import {act,PointerTapGesture,type Tool} from './interaction';
import {emptyProgress,readProgress,writeProgress,isFinalLevel,nextLevelIndex,isLevelUnlocked,type Progress} from './progress';
import {connectedOrder} from './connectivity';
import {MotyaAssistant} from './motya';
import {MotyaWardrobe} from './wardrobe';
import type {DevEditor} from './dev-editor';
import {BackgroundMusic} from './music';
import {CampaignRewards,completedRoyalCampaign} from './campaign-rewards';
import type {MotyaSkinId} from './motya-skins';
import {ArcadeUI} from './arcade-ui';
import './menu.css';
import {CampaignHints} from './campaign-hints';
import {Economy} from './economy';
import {economySources} from './economy-sources';
import {EconomyUI} from './economy-ui';
import {Lobby} from './lobby';
import {BackNavigation,AndroidBackBinding} from './back-navigation';
import {App} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {PlayerProfileUI} from './profile-ui';
import {readArcadeRecords} from './arcade';
import './polish.css';
import {Onboarding,learningSteps} from './onboarding';
import './onboarding.css';
import {CompletionDelay} from './completion';
import {Customization} from './customization';
import {DuelsUI} from './duels/ui';

document.querySelector('#app')!.innerHTML=`<div id="world"></div>
<main id="home" class="screen"><div class="home-copy"><h1>Гексанексус</h1><div class="home-actions"><button id="play" class="primary">Кампания</button><button id="choose-level">Выбор уровней</button><button id="open-wardrobe">Костюмы и подарки</button><button id="open-settings">Настройки</button></div></div></main>
<section id="level-screen" class="screen" hidden><div class="page-heading"><div><small>МАСТЕРСКАЯ СИЛУЭТОВ</small><h2>Выберите испытание</h2></div><button id="levels-back">← Главное меню</button></div><div id="level-cards"></div><p class="screen-note">Все испытания доступны. Прогресс сохраняется в этом браузере.</p></section>
<section id="game-screen" hidden><header class="game-header"><div><small id="game-kicker">МАСТЕРСКАЯ СИЛУЭТОВ</small><h2 id="level-name"></h2></div><div class="game-status"><div class="inventory"><strong id="remaining"></strong><span>кубиков<br>в запасе</span></div><button id="menu" title="Открыть меню игры">☰ <span>Меню</span></button></div></header>
<div id="projection-help" hidden>Золотые стрелки — направления двух проекций.<br><span class="correct">✓ Совпало</span> · <span class="missing">+ Нужен кубик</span> · <span class="excess">− Лишний</span> · тёмный — пусто</div>
<div id="toast" role="status" aria-live="polite"></div>
<footer class="game-footer"><div class="toolbox"><div class="tool-modes" role="group" aria-label="Действие с кубиками"><button id="place" aria-pressed="true" class="active" title="Поставить кубик в свободную позицию">＋ Поставить</button><button id="remove" aria-pressed="false" title="Удалять только кубики, которые установили вы">− Удалить</button></div></div><div class="actions"><button id="undo" title="Отменить последнее действие">↶ <span>Отменить</span></button><button id="reset" title="Вернуть исходные кубики">⟳ <span>Сбросить</span></button><button id="hint" title="Показать следующий шаг решения">✧ <span>Подсказка</span></button></div><p id="control-note">Перетаскивайте фон — обзор · Колесо — масштаб</p></footer>
</section>
<dialog id="settings" aria-labelledby="settings-title"><div class="collection-heading"><h2 id="settings-title">Настройки</h2><button id="settings-close" aria-label="Закрыть настройки">✕</button></div><div id="music-settings"></div><div id="mascot-settings"></div><button id="how-to">Как играть</button></dialog>
<dialog id="pause"><small>ГЕКСАНЕКСУС</small><h2>Пауза</h2><button id="resume" class="primary">Продолжить</button><button id="camera-reset" title="Вернуть только камеру, сохранив кубики">Сбросить ракурс</button><button id="pause-help">Как играть</button><label class="mode-label">Силуэты<select id="projection-mode"><option value="normal">Только целевые картинки</option><option value="training">Обучение: сравнение цветами</option></select></label><button id="pause-settings">Настройки</button><button id="pause-levels">Выбор уровней</button><button id="pause-home">Главное меню</button></dialog>
<dialog id="victory"><div class="victory-symbol">✦</div><small>ГАРМОНИЯ ВОССТАНОВЛЕНА</small><h2>Головоломка решена!</h2><p>Оба силуэта совпадают. Вы нашли общую форму.</p><button id="next" class="primary">Следующее испытание →</button><button id="continue">Рассмотреть решение</button><button id="victory-levels">В главное меню</button></dialog>`;

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
document.querySelector('#app')!.insertAdjacentHTML('beforeend',`<dialog id="campaign-complete" aria-labelledby="campaign-title"><div class="completion-sparkles" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--spark:${i}">✦</i>`).join('')}<span>✦</span></div><small>МАСТЕРСКАЯ СИЛУЭТОВ</small><h2 id="campaign-title">Поздравляем!</h2><p>Вы прошли все уровни Гексанексуса!</p><p id="completion-count"></p><button id="completion-home" class="primary">Главное меню</button><button id="completion-levels">Выбор уровней</button><button id="completion-replay">Играть заново</button></dialog>`);
document.querySelector('#campaign-complete >p')!.textContent=`Вы прошли все ${firstLevels.length} уровней Гексанексуса!`;
el('completion-count').insertAdjacentHTML('afterend','<div id="royal-reward" class="royal-reward" hidden role="status"><p>Все 30 уровней пройдены! Открыт эксклюзивный костюм: Королева Мотя! 👑</p><button id="royal-reward-wardrobe">Посмотреть костюм</button></div>');
document.querySelector('#level-screen .screen-note')!.textContent='Новые испытания открываются последовательно. Прогресс сохраняется автоматически.';
document.querySelector('.game-footer .actions')!.insertAdjacentHTML('beforeend','<button id="initial-view" title="Вернуть камеру к центру конструкции, сохранив кубики">⌖ <span>Начальный ракурс</span></button>');
document.querySelector('.game-footer .actions')!.insertAdjacentHTML('beforeend','<button id="show-errors" aria-pressed="false" aria-controls="projection-help" title="Сравнить оба силуэта с целями без изменения кубиков">Показать ошибки</button>');
document.querySelector('.game-footer')!.insertAdjacentHTML('beforeend','<div id="block-legend" aria-label="Обозначения кубиков"><span><i class="base-swatch"></i>Основа</span><span><i class="player-swatch"></i>Ваш блок</span></div>');
el('projection-help').innerHTML='<div class="diagnostic-colors"><span class="correct">✓ Совпадает</span><span class="missing">+ Не хватает</span><span class="excess">− Лишнее заполнение</span><span class="empty">· Правильно пусто</span></div><div class="diagnostic-scores"><span id="xy-score" title="Проекция на XY, вдоль оси Z"></span><span id="zy-score" title="Проекция на ZY, вдоль оси X"></span></div>';
el('camera-reset').textContent='Начальный ракурс';
el('settings').insertAdjacentHTML('beforeend','<p id="app-version"></p>');
el('app-version').textContent=`Версия: ${import.meta.env.VITE_APP_VERSION}`;
// Keep the playing surface clear; explanations remain available in the menu.
el('initial-view').innerHTML='⌖ <span>Ракурс</span>';
el('show-errors').innerHTML='◉ <span>Ошибки</span>';
el('pause').append(el('block-legend'));
for(const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.game-footer button')))button.setAttribute('aria-label',button.title);
const music=new BackgroundMusic();
music.mount(el('music-settings'));
music.mount(el('pause'));
let firstProgress:Progress=emptyProgress(),secondProgress:Progress=emptyProgress();
try{firstProgress=readProgress(localStorage,firstLevels.length);secondProgress=readProgress(localStorage,30,secondProgressKey,4);}catch{}
let campaignId:CampaignId='first',levels=firstLevels,levelGroups=firstGroups,progress=firstProgress;
let rewardStorage:Storage|undefined;try{rewardStorage=localStorage;}catch{}
const rewards=new CampaignRewards(rewardStorage,progress.completed);
const onboarding=new Onboarding(rewardStorage);let learningActive=false;
const completion=new CompletionDelay();
const economy=new Economy(rewardStorage,economySources(rewardStorage),rewards.royalUnlocked);
let index=progress.current,puzzle=new Puzzle(levels[index]),draft:Level=structuredClone(levels[index]);
let selectedGroup=Math.floor(index/5);
el('level-cards').insertAdjacentHTML('beforebegin','<nav id="level-groups" aria-label="Группы уровней"></nav><h3 id="level-group-name"></h3>');
if(progress.resume?.level===puzzle.level.name){for(const p of connectedOrder(puzzle.level.fixed,progress.resume.placed)??[])puzzle.place(p);puzzle.history=[];}
let savedPuzzle=puzzle,custom=false,editing=false,screen:'home'|'levels'|'game'|'editor'|'wardrobe'|'achievements'|'profile'|'campaigns'|'duels'='home';
let tool:Tool='place',projectionMode:ProjectionMode='normal',winShown=false;
const customization=new Customization(rewardStorage);document.body.dataset.fieldBackground=customization.settings.background;
const view=new Scene(el('world'),customization.settings);
const motya=new MotyaAssistant(skin=>skin==='classic'||(skin==='royal'?rewards.royalUnlocked:economy.ready&&(skin==='architect'?economy.architectUnlocked:economy.gifts.owned.includes(skin))),economy.ready);
const wardrobe=new MotyaWardrobe(motya,()=>showScreen('home'),economy,customization,settings=>{document.body.dataset.fieldBackground=settings.background;view.setAppearance(settings);});
let arcade:ArcadeUI|undefined;
let duels:DuelsUI|undefined;
let achievementsFromProfile=false;
new EconomyUI(economy,motya,()=>{achievementsFromProfile=false;showScreen('achievements');},()=>showScreen(achievementsFromProfile?'profile':'home'));
const campaignHints=new CampaignHints(view,()=>puzzle,()=>screen==='game'&&!custom&&!editing&&!learningActive&&!arcade?.active&&!duels?.active,message,economy);
arcade=new ArcadeUI(view,motya,()=>showScreen('game'),()=>showScreen('home'),message,economy);
duels=new DuelsUI(view,()=>({name:economy.profile.name,skin:economy.profile.avatar.skin,emotion:economy.profile.avatar.emotion}),()=>showScreen('game'),()=>showScreen('duels'),()=>showScreen('home'),()=>{music.victory();motya.notify({type:'level-win'});motya.beginVictoryPresentation();});
const lobby=new Lobby(view);
const playerProfile=new PlayerProfileUI(economy,{completed:()=>firstProgress.completed,completedSecond:()=>secondProgress.completed,records:()=>readArcadeRecords(rewardStorage),canUse:id=>motya.isSkinUnlocked(id),worn:()=>motya.skin},()=>showScreen('profile'),()=>showScreen('home'),()=>{achievementsFromProfile=true;showScreen('achievements');},()=>showScreen('wardrobe'));
const campaignSelection=new CampaignSelection(id=>id==='first'?firstProgress:secondProgress,selectCampaign,()=>showScreen('home'));
el('royal-reward').insertAdjacentHTML('afterend','<div id="architect-reward" hidden role="status"><p>Все 30 уровней «Новой грани» пройдены! Открыт эксклюзивный костюм: Мотя-архитектор!</p><button id="architect-reward-wardrobe">Посмотреть костюм</button></div>');
let editor:DevEditor|undefined;
function save(){if(learningActive)return;try{writeProgress(localStorage,progress,campaignId==='first'?progressKey:secondProgressKey);}catch{}}
let toastTimer:ReturnType<typeof setTimeout>|undefined;
let backNavigation:BackNavigation|undefined;
function message(text:string){
  clearTimeout(toastTimer);el('toast').textContent=text;
  toastTimer=setTimeout(()=>{el('toast').textContent='';},3200);
}
function cancelVictoryPresentation(){completion.cancel();view.celebrate(false);music.stopVictory();motya.endVictoryPresentation();el('game-screen').inert=false;delete document.body.dataset.celebrating;}
function showScreen(next:typeof screen,previewSkin?:MotyaSkinId){
  if(learningActive&&next!=='game')return;
  if(next!=='game'){cancelVictoryPresentation();}
  backNavigation?.reset();
  if(next!=='game')arcade?.leave();
  if(next==='editor'&&!import.meta.env.DEV)return;
  if(next!=='wardrobe')wardrobe.close();
  if(editing&&next!=='editor'){editing=false;puzzle=savedPuzzle;}
  screen=next;document.body.dataset.screen=next;
  el('achievements-screen').hidden=next!=='achievements';
  el('home').hidden=next!=='home';el('level-screen').hidden=next!=='levels';el('game-screen').hidden=next!=='game'&&next!=='editor';editor?.setVisible(next==='editor');
  document.body.classList.toggle('editing',next==='editor');view.setMenu(next!=='game'&&next!=='editor');
  lobby.setVisible(next==='home');
  playerProfile.setVisible(next==='profile');campaignSelection.setVisible(next==='campaigns');
  duels?.setVisible(next==='duels');
  motya.setScreen(next);if(next==='wardrobe')wardrobe.open(previewSkin);
  if(next==='home'||next==='levels'||next==='wardrobe'||next==='profile'||next==='campaigns'){view.directions.visible=false;}
  if(next==='levels'){selectedGroup=Math.floor(index/5);el('level-screen').querySelector('h2')!.textContent=campaigns[campaignId].label+' · '+campaigns[campaignId].name;el('levels-back').textContent='← Кампании';drawCards();}draw();
}
function selectCampaign(id:CampaignId,play:boolean){
 if(!campaignUnlocked(id,firstProgress.completed))return;
 campaignHints.clear();campaignId=id;levels=campaigns[id].levels;levelGroups=campaigns[id].groups;progress=id==='first'?firstProgress:secondProgress;index=progress.current;if(!campaignLevelUnlocked(id,index,progress.completed,progress.current))index=0;
 puzzle=new Puzzle(levels[index]);if(progress.resume?.level===puzzle.level.name)for(const p of connectedOrder(puzzle.level.fixed,progress.resume.placed)??[])puzzle.place(p);puzzle.history=[];
 savedPuzzle=puzzle;custom=false;winShown=false;tool='place';if(play)startGame();else showScreen('levels');
}
function startGame(){arcade?.leave();motya.notify({type:'level-start',levelIndex:custom?undefined:index,levelCount:custom?undefined:levels.length});showScreen('game');message('Коснитесь свободной позиции для установки. Для удаления включите «Удалить».');}
function loadLevel(i:number){cancelVictoryPresentation();if(!campaignUnlocked(campaignId,firstProgress.completed))return;if(!campaignLevelUnlocked(campaignId,i,progress.completed,progress.current))return;campaignHints.clear();index=i;progress.current=i;custom=false;puzzle=new Puzzle(structuredClone(levels[i]));
 if(progress.resume?.level===puzzle.level.name){for(const cell of connectedOrder(puzzle.level.fixed,progress.resume.placed)??[])puzzle.place(cell);puzzle.history=[];if(puzzle.won&&progress.completed.includes(puzzle.level.name))puzzle=new Puzzle(structuredClone(levels[i]));}
 savedPuzzle=puzzle;winShown=false;save();view.resetCamera();setTool('place');startGame();}
function checkWin(){
 if(learningActive||arcade?.active||duels?.active||editing||screen!=='game')return;
 if(!puzzle.won){winShown=false;return;}campaignHints.clear();if(winShown)return;winShown=true;
 if(!custom&&!progress.completed.includes(levels[index].name)){progress.completed.push(levels[index].name);save();}
 if(!custom){if(campaignId==='first')economy.syncCampaign(firstProgress.completed);else economy.syncSecondCampaign(secondProgress.completed);}
 const royalJustUnlocked=!custom&&campaignId==='first'&&rewards.recordCampaignCompletion(firstProgress.completed);
 el('royal-reward').hidden=!royalJustUnlocked;el('architect-reward').hidden=custom||campaignId!=='second'||!completedSecondCampaign(secondProgress.completed);
 const final=!custom&&(royalJustUnlocked||isFinalLevel(index,levels.length)&&(campaignId==='first'?completedRoyalCampaign(firstProgress.completed):completedSecondCampaign(secondProgress.completed)));
 view.celebrate(true);document.body.dataset.celebrating='true';el('game-screen').inert=true;music.victory();motya.notify({type:final?'game-win':'level-win'});motya.beginVictoryPresentation();
 completion.start(()=>{
 if(screen!=='game'||!puzzle.won)return;
 delete document.body.dataset.celebrating;el('game-screen').inert=false;motya.endVictoryPresentation();
 if(final){
  el('campaign-complete').querySelector('p')!.textContent='Вы прошли все 30 уровней кампании «'+campaigns[campaignId].name+'»!';
  el('completion-count').textContent='Пройдено уровней: '+levels.filter(l=>progress.completed.includes(l.name)).length+' из 30';
  el<HTMLDialogElement>('campaign-complete').showModal();motya.notify({type:'game-win',levelCount:30});
 }else{el<HTMLDialogElement>('victory').showModal();motya.notify({type:'level-win'});}
 });
}
function draw(){
  view.setGameFraming(screen==='game'&&!learningActive);
  if(duels?.active){campaignHints.clear();duels.draw();return;}
  if(arcade?.active){campaignHints.clear();arcade.draw();return;}
  if(screen!=='game'&&screen!=='editor'){campaignHints.refresh();return;}
  if(editing)campaignHints.clear();
  view.setInteraction(tool,puzzle.level.limit-puzzle.placed.length,editing);
  view.sync(puzzle,false,learningActive&&(onboarding.step===1||onboarding.step===5),editing?'normal':projectionMode);
  if(learningActive)for(const cube of view.objects)if(cube.userData.empty){const allowed=onboarding.accepts('place',cube.userData.cell);(cube.material as import('three').MeshStandardMaterial).opacity=allowed?.22:0;cube.children[0].visible=allowed;}
  campaignHints.refresh();
  view.directions.visible=screen==='game'&&projectionMode==='training';
  el('level-name').textContent=editing?'Редактор':puzzle.level.name;
  el('remaining').textContent=String(puzzle.level.limit-puzzle.placed.length);
  for(const next of ['place','remove']){el(next).classList.toggle('active',next===tool);el(next).setAttribute('aria-pressed',String(next===tool));}
  el<HTMLButtonElement>('undo').disabled=editing||!puzzle.history.length;
  updateDiagnosticUI();
  el('control-note').textContent='Касание — действие · «Удалить» — убрать кубик · Свайп — обзор';
  if(import.meta.env.DEV&&editing)editor?.drawTargets(puzzle.level);
  checkWin();
  if(learningActive)renderLearning();
  if(screen==='game'&&!custom&&!editing&&!learningActive){progress.resume={level:puzzle.level.name,placed:structuredClone(puzzle.placed)};save();}
}
function updateDiagnosticUI(){
  const enabled=projectionMode==='training';
  el('show-errors').innerHTML=`◉ <span>${enabled?'Скрыть':'Ошибки'}</span>`;
  el('show-errors').setAttribute('aria-label',enabled?'Скрыть ошибки':'Показать ошибки');
  el('show-errors').setAttribute('aria-pressed',String(enabled));
  el<HTMLSelectElement>('projection-mode').value=projectionMode;
  el('projection-help').hidden=screen!=='game'||!enabled;
  const results=diagnose(puzzle.level.targets,puzzle.projections);
  el('xy-score').textContent=`XY: ${results[0].matches} / ${puzzle.size**2} совпадений`;
  el('zy-score').textContent=`ZY: ${results[1].matches} / ${puzzle.size**2} совпадений`;
}
function setProjectionMode(mode:ProjectionMode){
  if(arcade?.active)return;
  projectionMode=mode;
  view.updateProjections(puzzle,editing?'normal':mode);
  view.directions.visible=screen==='game'&&mode==='training';
  updateDiagnosticUI();
  if(mode==='training')motya.notify({type:'diagnostics',hasErrors:diagnose(puzzle.level.targets,puzzle.projections).some(r=>r.matches<puzzle.size**2)});
  if(learningActive&&mode==='training')advanceLearning('silhouettes');
}
function setTool(next:Tool){if(duels?.active){duels.setTool(next);return;}if(arcade?.active){arcade.setTool(next);return;}tool=next;el('place').classList.toggle('active',tool==='place');el('remove').classList.toggle('active',tool==='remove');el('place').setAttribute('aria-pressed',String(tool==='place'));el('remove').setAttribute('aria-pressed',String(tool==='remove'));draw();}
function clickCell(cell:Vec,action:Tool=tool){
  if(completion.pending||document.querySelector('dialog[open]'))return;
  if(duels?.active){duels.act(cell,action);return;}
  if(learningActive){if(!onboarding.accepts(action,cell))return;if(act(puzzle,action,cell)){advanceLearning(action==='remove'?'remove':puzzle.won?'solve':'place');if(learningActive)draw();}return;}
  if(arcade?.active){arcade.act(cell,action);return;}
  if(screen!=='game'&&screen!=='editor')return;
  if(editing){editor?.editCell(cell);return;}
  const mismatches=()=>diagnose(puzzle.level.targets,puzzle.projections).reduce((sum,result)=>sum+puzzle.size**2-result.matches,0);
  const before=mismatches();
  if(act(puzzle,action,cell)){const improved=mismatches()<before;message(action==='place'?'Кубик установлен':'Кубик в запасе');draw();if(action==='place')motya.notify({type:'placed',improved});}
  else{
    const fixed=puzzle.level.fixed.some(p=>key(p)===key(cell)),placed=puzzle.placed.some(p=>key(p)===key(cell));
    message(action==='place'?'Нужна свободная соседняя ячейка внутри сетки и кубик в запасе.':fixed?'Это основа конструкции. Удаление запрещено':placed?'Нельзя удалить: другие кубики потеряют связь с неподвижной основой.':'Удалять можно только кубики, которые установили вы.');
    motya.notify({type:'forbidden',reason:action==='place'?(puzzle.placed.length>=puzzle.level.limit?'stock':'other'):fixed?'fixed':placed?'disconnected':'other'});
  }
}
view.onCell=cell=>clickCell(cell,view.tool);
for(const id of ['victory','campaign-complete'])el(id).addEventListener('close',()=>{if(!completion.pending)cancelVictoryPresentation();});
view.onCameraRotate=()=>{if(learningActive)advanceLearning('rotate');};
// Observe a rejected zero-stock click without changing the scene's Raycaster
// or sending an action to the puzzle. A separate gesture guard filters drags.
const motyaGesture=new PointerTapGesture();let emptyStockAtPress=false,emptyStockPressAt=0;
view.renderer.domElement.addEventListener('pointerdown',event=>{if(event.button!==0)return;motyaGesture.begin(event.pointerId,event.clientX,event.clientY);emptyStockPressAt=event.timeStamp;emptyStockAtPress=!duels?.active&&!arcade?.active&&screen==='game'&&tool==='place'&&puzzle.placed.length>=puzzle.level.limit&&!puzzle.won;});
view.renderer.domElement.addEventListener('pointermove',event=>motyaGesture.move(event.pointerId,event.clientX,event.clientY));
view.renderer.domElement.addEventListener('pointerup',event=>{if(event.button!==0)return;if(motyaGesture.end(event.pointerId,event.clientX,event.clientY)&&event.timeStamp-emptyStockPressAt<600&&emptyStockAtPress&&screen==='game'&&tool==='place'&&view.ray.intersectObjects(view.objects.filter(o=>o.visible&&!o.userData.empty),false)[0]?.object.userData.fixed)motya.notify({type:'forbidden',reason:'stock'});emptyStockAtPress=false;});
for(const type of ['pointerleave','pointercancel'])view.renderer.domElement.addEventListener(type,()=>{motyaGesture.cancel();emptyStockAtPress=false;});
function drawCards(){
  const cards=el('level-cards');cards.replaceChildren();
  // Follow the active level when opening the list, while keeping six small groups.
  const groups=el('level-groups');groups.replaceChildren();
  for(let group=0;group<Math.ceil(levels.length/5);group++){
    const button=document.createElement('button');button.type='button';button.dataset.group=String(group);
    button.textContent=String(group*5+1)+'–'+Math.min((group+1)*5,levels.length);
    button.title=levelGroups[group]??'Испытания';button.setAttribute('aria-label',button.textContent+': '+button.title);
    button.setAttribute('aria-pressed',String(selectedGroup===group));button.onclick=()=>{selectedGroup=group;drawCards();};groups.append(button);
  }
  el('level-group-name').textContent=levelGroups[selectedGroup]??'Испытания';
  levels.forEach((l,i)=>{if(Math.floor(i/5)!==selectedGroup)return;const card=document.createElement('button');card.className='level-card';card.dataset.level=String(i);const unlocked=campaignLevelUnlocked(campaignId,i,progress.completed,progress.current);card.disabled=!unlocked;card.classList.toggle('locked',!unlocked);const n=document.createElement('span');n.className='card-number';n.textContent=String(i+1).padStart(2,'0');const name=document.createElement('h3');name.textContent=l.name.split(' · ')[1]||l.name;const detail=document.createElement('p');detail.textContent=`${['Знакомство с формой','Глубина и пересечения','Пространственный вызов','Два направления','Взгляд с обратной стороны','Переплетённые пути','Каждый блок на счету','Несколько верных решений','Последовательность граней','Финальное испытание'][i]??levelGroups[Math.floor(i/5)]??'Новое испытание'} · ${l.limit} кубика`;const state=document.createElement('small');state.textContent=progress.completed.includes(l.name)?'✓ Пройдено':unlocked?'Начать испытание →':'Сначала пройдите предыдущее испытание';card.classList.toggle('completed',progress.completed.includes(l.name));card.append(n,name,detail,state);card.onclick=()=>loadLevel(i);cards.append(card);});
}
function closeDialog(id:string){if(id==='victory'||id==='campaign-complete')cancelVictoryPresentation();el<HTMLDialogElement>(id).close();}
let settingsFromPause=false;
function openSettings(fromPause=false){settingsFromPause=fromPause;motya.setScreen('settings');view.controls.enabled=false;el<HTMLDialogElement>('settings').showModal();}
function openPause(){if(completion.pending)return;view.cancelInput();if(duels?.active){duels.pause();return;}if(arcade?.active){arcade.pause();return;}view.controls.enabled=false;el<HTMLDialogElement>('pause').showModal();}
el<HTMLDialogElement>('pause').addEventListener('close',()=>{view.controls.enabled=screen==='game'||screen==='editor';});
el('open-wardrobe').onclick=()=>showScreen('wardrobe');
el('open-settings').onclick=()=>openSettings();el('settings-close').onclick=()=>closeDialog('settings');
el<HTMLDialogElement>('settings').addEventListener('close',()=>{motya.setScreen(screen);view.controls.enabled=screen==='game'||screen==='editor';if(settingsFromPause&&screen==='game'){settingsFromPause=false;openPause();}});
el('pause-settings').onclick=()=>{closeDialog('pause');openSettings(true);};
el('play').onclick=()=>showScreen('campaigns');el('choose-level').onclick=()=>showScreen('campaigns');el('levels-back').onclick=()=>showScreen('campaigns');el('menu').onclick=openPause;
backNavigation=new BackNavigation({
 closeModal:()=>{
  if(wardrobe.closeGiftResult())return true;
  const dialog=Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).filter(d=>d.id!=='lobby-menu').at(-1);if(!dialog)return false;
  if(dialog.id==='arcade-pause')arcade?.resume();
  else if(dialog.id==='duels-result')duels?.leave();
  else if(dialog.id==='arcade-results')el('arcade-result-home').click();
  else dialog.close();return true;
 },
 closeMenu:()=>lobby.back(),screen:()=>screen,home:()=>{if(screen==='duels')duels?.leave();else showScreen(screen==='levels'?'campaigns':screen==='achievements'&&achievementsFromProfile?'profile':'home');},
 pause:()=>{if(arcade?.active)arcade.pause(true);else openPause();},
 hintExit:()=>lobby.hintExit(),exit:()=>{if(Capacitor.getPlatform()==='android')void App.exitApp();}
});
Object.assign(window,{hexanexusHandleBack:()=>backNavigation!.handle()});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&backNavigation!.handle(false))event.preventDefault();});
let androidBinding:AndroidBackBinding|undefined;
if(Capacitor.getPlatform()==='android'){
 androidBinding=new AndroidBackBinding({back:fn=>App.addListener('backButton',fn),pause:fn=>App.addListener('pause',fn),resume:fn=>App.addListener('resume',fn)},backNavigation,active=>{view.setAppActive(active);if(!active){arcade?.pause(true);wardrobe.finishGiftAnimation();}});
 void androidBinding.start();
}
if(import.meta.hot)import.meta.hot.dispose(()=>{void androidBinding?.dispose();duels?.dispose();wardrobe.dispose();playerProfile.dispose();view.dispose();});
el('resume').onclick=()=>closeDialog('pause');el('pause-home').onclick=()=>{closeDialog('pause');showScreen('home');};el('pause-levels').onclick=()=>{closeDialog('pause');showScreen('levels');};
el('camera-reset').onclick=()=>{view.resetCamera();closeDialog('pause');message('Ракурс восстановлен. Форма осталась на месте.');};
el('initial-view').onclick=()=>{view.resetCamera();message('Начальный ракурс восстановлен.');};
el('place').onclick=()=>setTool('place');el('remove').onclick=()=>setTool('remove');
el('undo').onclick=()=>{if(duels?.active){duels.undo();return;}if(arcade?.active||completion.pending||learningActive&&onboarding.step!==3)return;puzzle.undo();if(learningActive)advanceLearning('undo');draw();message('Последнее действие отменено.');};el('reset').onclick=()=>{if(arcade?.active||learningActive||completion.pending)return;campaignHints.clear();puzzle.reset();draw();message('Уровень сброшен.');};
el<HTMLSelectElement>('projection-mode').onchange=e=>setProjectionMode((e.target as HTMLSelectElement).value as ProjectionMode);
el('show-errors').onclick=()=>setProjectionMode(projectionMode==='normal'?'training':'normal');
el('next').onclick=()=>{closeDialog('victory');const next=nextLevelIndex(index,levels.length);if(next!==null)loadLevel(next);else showScreen('levels');};el('continue').onclick=()=>closeDialog('victory');el('victory-levels').onclick=()=>{closeDialog('victory');showScreen('home');};
el('completion-home').onclick=()=>{closeDialog('campaign-complete');showScreen('home');};
el('completion-levels').onclick=()=>{closeDialog('campaign-complete');showScreen('levels');};
el('completion-replay').onclick=()=>{closeDialog('campaign-complete');loadLevel(0);};
el('royal-reward-wardrobe').onclick=()=>{closeDialog('campaign-complete');showScreen('wardrobe','royal');};
el('architect-reward-wardrobe').onclick=()=>{closeDialog('campaign-complete');showScreen('wardrobe','architect');};

el('app').insertAdjacentHTML('beforeend','<aside id="learning-panel" hidden aria-live="polite"><small id="learning-count"></small><h3 id="learning-title"></h3><p id="learning-text"></p><button id="learning-skip" hidden>Я знаю, как играть</button></aside><dialog id="learning-confirm" aria-labelledby="learning-confirm-title"><h2 id="learning-confirm-title">Пропустить обучение?</h2><p>Вы сможете вернуться к нему в настройках.</p><button id="learning-confirm-skip" class="primary">Да, я знаю, как играть</button><button id="learning-confirm-stay">Продолжить обучение</button></dialog>');
function renderLearning(){
 const step=learningSteps[onboarding.step];el('learning-panel').hidden=!learningActive;if(!learningActive)return;
 el('learning-count').textContent='ЗНАКОМСТВО · '+(onboarding.step+1)+' / '+learningSteps.length;
 el('learning-title').textContent=step.title;el('learning-text').textContent=onboarding.error||step.text;
 el('learning-skip').hidden=!onboarding.canSkip;
 const action=onboarding.actionButton;
 for(const id of ['place','remove','undo','reset','hint','show-errors']){const b=el<HTMLButtonElement>(id);b.dataset.learningAction=String(id===action);b.disabled=id!==action;}
 for(const id of ['pause-levels','pause-home'])el<HTMLButtonElement>(id).disabled=true;
}
function beginLearning(replay=false){
 for(const d of Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')))d.close();
 if(!learningActive){savedPuzzle=puzzle;arcade?.leave();}
 if(replay&&onboarding.done)onboarding.replay();learningActive=true;document.body.dataset.learning='true';
 campaignHints.clear();puzzle=onboarding.puzzle();tool='place';projectionMode=onboarding.step>=5?'training':'normal';
 showScreen('game');view.resetCamera();renderLearning();
}
function finishLearning(){
 learningActive=false;delete document.body.dataset.learning;el('learning-panel').hidden=true;
 for(const id of ['place','remove','undo','reset','hint','show-errors','pause-levels','pause-home']){const b=el<HTMLButtonElement>(id);b.disabled=false;delete b.dataset.learningAction;}
 puzzle=savedPuzzle;tool='place';projectionMode='normal';view.controls.enabled=true;showScreen('home');message('Знакомство завершено!');
}
function advanceLearning(action:Parameters<Onboarding['advance']>[0]){if(!onboarding.advance(action)){if(onboarding.error){puzzle=onboarding.puzzle();draw();}renderLearning();return;}if(onboarding.done)finishLearning();else{renderLearning();draw();}}
function openTutorial(){beginLearning(true);}
el('how-to').onclick=()=>{closeDialog('settings');openTutorial();};el('pause-help').onclick=()=>{closeDialog('pause');if(!learningActive)openTutorial();};
el('learning-skip').onclick=()=>{if(onboarding.canSkip)el<HTMLDialogElement>('learning-confirm').showModal();};
el('learning-confirm-stay').onclick=()=>closeDialog('learning-confirm');
el('learning-confirm-skip').onclick=()=>{if(onboarding.canSkip&&onboarding.skip()){closeDialog('learning-confirm');finishLearning();}else renderLearning();};

if(import.meta.env.DEV&&new URLSearchParams(location.search).get('editor')==='1'){
  void import('./dev-editor').then(({mountDevEditor})=>{editor=mountDevEditor({
    getDraft:()=>draft,setDraft:level=>{draft=level;},
    enter:()=>{savedPuzzle=puzzle;draft=structuredClone(puzzle.level);editing=true;showScreen('editor');},
    refresh:()=>{puzzle=new Puzzle(draft);draw();},
    play:level=>{editing=false;custom=true;puzzle=new Puzzle(level);savedPuzzle=puzzle;winShown=false;view.resetCamera();startGame();},
    openMenu:openPause,message
  });});
}
if(onboarding.done){showScreen('home');motya.notify({type:'greeting'});}else beginLearning();
