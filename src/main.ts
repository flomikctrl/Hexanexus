import './style.css';
import {key,orientations,type Axis,type Vec} from './math';
import {levels,levelGroups,type Level} from './levels';
import {Puzzle} from './state';
import {solve} from './solver';
import {parseLevel} from './editor';
import {Scene} from './scene';
import {cellStyle,diagnose,type ProjectionMode} from './presentation';
import {act,PointerTapGesture,type Tool} from './interaction';
import {emptyProgress,readProgress,writeProgress,isFinalLevel,nextLevelIndex,isLevelUnlocked,type Progress} from './progress';
import {connectedOrder} from './connectivity';
import {PhoebeAssistant} from './phoebe';
import {BackgroundMusic} from './music';

document.querySelector('#app')!.innerHTML=`<div id="world"></div>
<main id="home" class="screen"><div class="home-copy"><span class="eyebrow">ПРОСТРАНСТВЕННАЯ ГОЛОВОЛОМКА</span><h1>Гексанексус</h1><p class="subtitle">Мастерская силуэтов</p><div class="gold-rule"></div><p class="intro">Одна конструкция. Два силуэта.<br>Найдите форму, которая объединит их.</p><div class="home-actions"><button id="play" class="primary">Играть <span>→</span></button><button id="choose-level">Выбор уровня</button><button id="how-to">Как играть</button><button id="open-editor">Редактор уровней</button></div><small id="progress-summary"></small></div><div class="home-signature">✦ &nbsp; ФОРМА · СВЕТ · РАВНОВЕСИЕ</div></main>
<section id="level-screen" class="screen" hidden><div class="page-heading"><div><small>МАСТЕРСКАЯ СИЛУЭТОВ</small><h2>Выберите испытание</h2></div><button id="levels-back">← Главное меню</button></div><div id="level-cards"></div><p class="screen-note">Все испытания доступны. Прогресс сохраняется в этом браузере.</p></section>
<section id="game-screen" hidden><header class="game-header"><div><small id="game-kicker">МАСТЕРСКАЯ СИЛУЭТОВ</small><h2 id="level-name"></h2></div><div class="game-status"><div class="inventory"><strong id="remaining"></strong><span>кубиков<br>в запасе</span></div><button id="menu" title="Открыть меню игры">☰ <span>Меню</span></button></div></header>
<div id="projection-help" hidden>Золотые стрелки — направления двух проекций.<br><span class="correct">✓ Совпало</span> · <span class="missing">+ Нужен кубик</span> · <span class="excess">− Лишний</span> · тёмный — пусто</div>
<div id="toast" role="status" aria-live="polite"></div>
<footer class="game-footer"><div class="toolbox"><div class="tool-modes" role="group" aria-label="Действие с кубиками"><button id="place" aria-pressed="true" class="active" title="Поставить кубик в свободную позицию">＋ Поставить</button><button id="remove" aria-pressed="false" title="Удалять только кубики, которые установили вы">− Удалить</button></div><button id="cells" title="Открыть выбор скрытых и внутренних ячеек" aria-expanded="false">Выбрать ячейку…</button></div><div class="actions"><button id="undo" title="Отменить последнее действие">↶ <span>Отменить</span></button><button id="reset" title="Вернуть исходные кубики">⟳ <span>Сбросить</span></button><button id="hint" title="Подсветить следующий шаг">✧ <span>Подсказка</span></button></div><p id="control-note">Перетаскивайте фон — обзор · Колесо — масштаб</p></footer>
<aside id="cell-drawer" hidden><div class="drawer-heading"><h3>Выберите место</h3><button id="close-cells" title="Закрыть выбор ячеек">✕</button></div><p>Наведите на плитку — увидите место в 3D.<br>Нажмите для выбранного действия.</p><div class="drawer-options"><button id="ghosts" aria-pressed="false">Показать позиции</button><label><input type="checkbox" id="isolate"> Скрыть остальные слои</label></div><div class="layer-controls"><label>Слой <select id="layer-axis"><option>X</option><option selected>Y</option><option>Z</option></select></label><div id="layers"><button data-layer="1">Верхний</button><button data-layer="0" class="active">Средний</button><button data-layer="-1">Нижний</button></div></div><div id="slice" class="slice"></div><p class="slice-key">◆ основа · ■ ваш кубик · + свободно · × закрыто</p></aside></section>
<section id="editor" hidden><div class="drawer-heading"><h2>Редактор уровня</h2><button id="editor-menu">Меню</button></div><label>Название<input id="name" maxlength="80"></label><label>Запас кубиков<input id="limit" type="number" min="0" max="27"></label><label>Инструмент<select id="tool"><option value="fixed">Фиксированный кубик</option><option value="available">Доступная ячейка</option><option value="blocked">Заблокированная ячейка</option></select></label><p>Меняйте ячейки через слои. Нажимайте на клетки целей, чтобы изменить образец.</p><label>Начальная ориентация<select id="orientation"></select></label><div class="editor-targets"><div id="left"><small>Цель XY · вдоль Z</small><div class="mask"></div></div><div id="right"><small>Цель ZY · вдоль X</small><div class="mask"></div></div></div><div class="editor-actions"><button id="validate">Проверить решение</button><button id="play-custom">Испытать уровень</button><button id="export">Экспорт JSON</button><button id="import">Импорт JSON</button></div><textarea id="json" aria-label="JSON уровня" placeholder="JSON для импорта или экспорта" spellcheck="false"></textarea></section>
<dialog id="pause"><small>ГЕКСАНЕКСУС</small><h2>Пауза в мастерской</h2><button id="resume" class="primary">Продолжить</button><button id="camera-reset" title="Вернуть только камеру, сохранив кубики">Сбросить ракурс</button><button id="pause-help">Как играть</button><label class="mode-label">Силуэты<select id="projection-mode"><option value="normal">Только целевые картинки</option><option value="training">Обучение: сравнение цветами</option></select></label><button id="pause-levels">Выбор уровня</button><button id="pause-home">Главное меню</button></dialog>
<dialog id="tutorial" aria-labelledby="tutorial-title"><small id="tutorial-count"></small><div id="tutorial-symbol" aria-hidden="true">◈</div><h2 id="tutorial-title"></h2><p id="tutorial-text"></p><div class="tutorial-buttons"><button id="tutorial-back">← Назад</button><button id="tutorial-next" class="primary">Далее →</button></div><button id="tutorial-close" class="quiet">Пропустить обучение</button></dialog>
<dialog id="victory"><div class="victory-symbol">✦</div><small>ГАРМОНИЯ ВОССТАНОВЛЕНА</small><h2>Головоломка решена!</h2><p>Оба силуэта совпадают. Вы нашли общую форму.</p><button id="next" class="primary">Следующее испытание →</button><button id="continue">Рассмотреть решение</button><button id="victory-levels">Выбор уровня</button></dialog>`;

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
document.querySelector('#app')!.insertAdjacentHTML('beforeend',`<dialog id="campaign-complete" aria-labelledby="campaign-title"><div class="completion-sparkles" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--spark:${i}">✦</i>`).join('')}<span>✦</span></div><small>МАСТЕРСКАЯ СИЛУЭТОВ</small><h2 id="campaign-title">Поздравляем!</h2><p>Вы прошли все уровни Гексанексуса!</p><p id="completion-count"></p><button id="completion-home" class="primary">Главное меню</button><button id="completion-levels">Выбор уровня</button><button id="completion-replay">Играть заново</button></dialog>`);
document.querySelector('#campaign-complete >p')!.textContent=`Вы прошли все ${levels.length} уровней Гексанексуса!`;
document.querySelector('#level-screen .screen-note')!.textContent='Новые испытания открываются последовательно. Прогресс сохраняется автоматически.';
document.querySelector('.game-footer .actions')!.insertAdjacentHTML('beforeend','<button id="initial-view" title="Вернуть камеру к центру конструкции, сохранив кубики">⌖ <span>Начальный ракурс</span></button>');
document.querySelector('.game-footer .actions')!.insertAdjacentHTML('beforeend','<button id="show-errors" aria-pressed="false" aria-controls="projection-help" title="Сравнить оба силуэта с целями без изменения кубиков">Показать ошибки</button>');
document.querySelector('.game-footer')!.insertAdjacentHTML('beforeend','<div id="block-legend" aria-label="Обозначения кубиков"><span><i class="base-swatch"></i>Основа</span><span><i class="player-swatch"></i>Ваш блок</span></div>');
el('projection-help').innerHTML='<div class="diagnostic-colors"><span class="correct">✓ Совпадает</span><span class="missing">+ Не хватает</span><span class="excess">− Лишнее заполнение</span><span class="empty">· Правильно пусто</span></div><div class="diagnostic-scores"><span id="xy-score" title="Проекция на XY, вдоль оси Z"></span><span id="zy-score" title="Проекция на ZY, вдоль оси X"></span></div>';
el('camera-reset').textContent='Начальный ракурс';
// Keep the playing surface clear; explanations remain available in the menu.
el('cells').innerHTML='▦ <span>Ячейки</span>';
el('initial-view').innerHTML='⌖ <span>Ракурс</span>';
el('show-errors').innerHTML='◉ <span>Ошибки</span>';
el('pause').append(el('block-legend'));
for(const button of Array.from(document.querySelectorAll<HTMLButtonElement>('.game-footer button')))button.setAttribute('aria-label',button.title);
const music=new BackgroundMusic();
music.mount(document.querySelector('.home-copy')!);
music.mount(el('pause'));
let progress:Progress=emptyProgress();try{progress=readProgress(localStorage,levels.length);}catch{}
let index=progress.current,puzzle=new Puzzle(levels[index]),draft:Level=structuredClone(levels[index]);
let selectedGroup=Math.floor(index/5);
el('level-cards').insertAdjacentHTML('beforebegin','<nav id="level-groups" aria-label="Группы уровней"></nav><h3 id="level-group-name"></h3>');
if(progress.resume?.level===puzzle.level.name){for(const p of connectedOrder(puzzle.level.fixed,progress.resume.placed)??[])puzzle.place(p);puzzle.history=[];}
let savedPuzzle=puzzle,custom=false,editing=false,screen:'home'|'levels'|'game'|'editor'='home';
let tool:Tool='place',ghosts=false,layer=0,axis:Axis='Y',projectionMode:ProjectionMode='normal',winShown=false;
const view=new Scene(el('world'));
const phoebe=new PhoebeAssistant();
const rotations=orientations();rotations.forEach((_,i)=>el<HTMLSelectElement>('orientation').add(new Option(`Ориентация ${i+1}`,String(i))));
function save(){try{writeProgress(localStorage,progress);}catch{}}
let toastTimer:ReturnType<typeof setTimeout>|undefined;
function message(text:string){
  clearTimeout(toastTimer);el('toast').textContent=text;
  toastTimer=setTimeout(()=>{el('toast').textContent='';},3200);
}
function showScreen(next:typeof screen){
  if(editing&&next!=='editor'){editing=false;puzzle=savedPuzzle;}
  screen=next;document.body.dataset.screen=next;
  el('home').hidden=next!=='home';el('level-screen').hidden=next!=='levels';el('game-screen').hidden=next!=='game'&&next!=='editor';el('editor').hidden=next!=='editor';
  document.body.classList.toggle('editing',next==='editor');view.setMenu(next==='home'||next==='levels');
  phoebe.setScreen(next);
  if(next==='home'||next==='levels'){drawer(false);view.directions.visible=false;}
  if(next==='home')el('progress-summary').textContent=`Пройдено ${levels.filter(l=>progress.completed.includes(l.name)).length} из ${levels.length} испытаний`;
  if(next==='levels'){selectedGroup=Math.floor(index/5);drawCards();}draw();
}
function startGame(){phoebe.notify({type:'level-start',levelIndex:custom?undefined:index,levelCount:custom?undefined:levels.length});showScreen('game');message('В режиме «Поставить» наведите на грань существующего кубика.');if(!progress.tutorialSeen)openTutorial();}
function loadLevel(i:number){if(!isLevelUnlocked(i,levels.map(l=>l.name),progress.completed,progress.current))return;index=i;progress.current=i;custom=false;puzzle=new Puzzle(structuredClone(levels[i]));savedPuzzle=puzzle;winShown=false;save();view.resetCamera();setTool('place');startGame();}
function checkWin(){
  if(editing||screen!=='game')return;
  if(!puzzle.won){winShown=false;return;}
  if(winShown)return;
  winShown=true;if(!custom&&!progress.completed.includes(levels[index].name)){progress.completed.push(levels[index].name);save();}
  closeDialog('tutorial');
  if(!custom&&isFinalLevel(index,levels.length)){
    el('completion-count').textContent=`Пройдено уровней: ${levels.filter(l=>progress.completed.includes(l.name)).length} из ${levels.length}`;
    el<HTMLDialogElement>('campaign-complete').showModal();
    phoebe.notify({type:'game-win',levelCount:levels.length});
  }else{el<HTMLDialogElement>('victory').showModal();phoebe.notify({type:'level-win'});}
}
function draw(){
  view.setInteraction(tool,puzzle.level.limit-puzzle.placed.length,editing);
  view.sync(puzzle,false,ghosts&&tool==='place',editing?'normal':projectionMode);
  view.setLayer(el<HTMLInputElement>('isolate').checked?{axis,value:layer}:null);
  view.directions.visible=screen==='game'&&projectionMode==='training';
  el('level-name').textContent=editing?'Редактор':puzzle.level.name;
  el('remaining').textContent=String(puzzle.level.limit-puzzle.placed.length);
  el<HTMLButtonElement>('undo').disabled=editing||!puzzle.history.length;
  updateDiagnosticUI();
  el('control-note').textContent=tool==='place'?'Наведите на грань кубика · Перетаскивание — обзор':'Удалить: нажмите на свой кубик · Нельзя разрывать конструкцию';
  for(const [s,id] of ['left','right'].entries()){
    const mask=el(id).querySelector('.mask')!;mask.replaceChildren();
    puzzle.level.targets[s].forEach((v,i)=>{const b=document.createElement('button');b.className=`pixel ${cellStyle(v,false,'normal')}`;b.textContent=v?'■':'·';b.title=v?'Целевая заполненная клетка':'Целевая пустая клетка';b.ariaLabel=`Цель ${s+1}, клетка ${i+1}: ${b.title}`;b.onclick=()=>{draft.targets[s][i]=!draft.targets[s][i];refreshDraft();};mask.append(b);});
  }
  drawSlice();checkWin();
  if(screen==='game'&&!custom&&!editing){progress.resume={level:puzzle.level.name,placed:structuredClone(puzzle.placed)};save();}
}
function updateDiagnosticUI(){
  const enabled=projectionMode==='training';
  el('show-errors').innerHTML=`◉ <span>${enabled?'Скрыть':'Ошибки'}</span>`;
  el('show-errors').setAttribute('aria-label',enabled?'Скрыть ошибки':'Показать ошибки');
  el('show-errors').setAttribute('aria-pressed',String(enabled));
  el<HTMLSelectElement>('projection-mode').value=projectionMode;
  el('projection-help').hidden=screen!=='game'||!enabled;
  const results=diagnose(puzzle.level.targets,puzzle.projections);
  el('xy-score').textContent=`XY: ${results[0].matches} / 9 совпадений`;
  el('zy-score').textContent=`ZY: ${results[1].matches} / 9 совпадений`;
}
function setProjectionMode(mode:ProjectionMode){
  projectionMode=mode;
  view.updateProjections(puzzle,editing?'normal':mode);
  view.directions.visible=screen==='game'&&mode==='training';
  updateDiagnosticUI();
  if(mode==='training')phoebe.notify({type:'diagnostics',hasErrors:diagnose(puzzle.level.targets,puzzle.projections).some(r=>r.matches<9)});
}
function setTool(next:Tool){tool=next;el('place').classList.toggle('active',tool==='place');el('remove').classList.toggle('active',tool==='remove');el('place').setAttribute('aria-pressed',String(tool==='place'));el('remove').setAttribute('aria-pressed',String(tool==='remove'));draw();}
function clickCell(cell:Vec){
  if(screen!=='game'&&screen!=='editor')return;
  if(editing){draft.fixed=draft.fixed.filter(p=>key(p)!==key(cell));draft.available=draft.available.filter(p=>key(p)!==key(cell));const t=el<HTMLSelectElement>('tool').value;if(t==='fixed')draft.fixed.push(cell);if(t==='available')draft.available.push(cell);refreshDraft();return;}
  const mismatches=()=>diagnose(puzzle.level.targets,puzzle.projections).reduce((sum,result)=>sum+9-result.matches,0);
  const before=mismatches();
  if(act(puzzle,tool,cell)){const improved=mismatches()<before;message(tool==='place'?'＋ Кубик установлен':'↶ Кубик в запасе');draw();if(tool==='place')phoebe.notify({type:'placed',improved});}
  else{
    const fixed=puzzle.level.fixed.some(p=>key(p)===key(cell)),placed=puzzle.placed.some(p=>key(p)===key(cell));
    message(tool==='place'?'Нужна свободная соседняя ячейка внутри сетки и кубик в запасе.':fixed?'Это основа конструкции. Удаление запрещено':placed?'Нельзя удалить: другие кубики потеряют связь с неподвижной основой.':'Удалять можно только кубики, которые установили вы.');
    phoebe.notify({type:'forbidden',reason:tool==='place'?(puzzle.placed.length>=puzzle.level.limit?'stock':'other'):fixed?'fixed':placed?'disconnected':'other'});
  }
}
view.onCell=clickCell;
// Observe a rejected zero-stock click without changing the scene's Raycaster
// or sending an action to the puzzle. A separate gesture guard filters drags.
const phoebeGesture=new PointerTapGesture();let emptyStockAtPress=false;
view.renderer.domElement.addEventListener('pointerdown',event=>{if(event.button!==0)return;phoebeGesture.begin(event.pointerId,event.clientX,event.clientY);emptyStockAtPress=screen==='game'&&tool==='place'&&puzzle.placed.length>=puzzle.level.limit&&!puzzle.won;});
view.renderer.domElement.addEventListener('pointermove',event=>phoebeGesture.move(event.pointerId,event.clientX,event.clientY));
view.renderer.domElement.addEventListener('pointerup',event=>{if(event.button!==0)return;if(phoebeGesture.end(event.pointerId,event.clientX,event.clientY)&&emptyStockAtPress&&screen==='game'&&tool==='place'&&view.ray.intersectObjects(view.objects.filter(o=>o.visible&&!o.userData.empty),false).length)phoebe.notify({type:'forbidden',reason:'stock'});emptyStockAtPress=false;});
for(const type of ['pointerleave','pointercancel'])view.renderer.domElement.addEventListener(type,()=>{phoebeGesture.cancel();emptyStockAtPress=false;});
function drawSlice(){
  const slice=el('slice');slice.replaceChildren();const a={X:0,Y:1,Z:2}[axis],other=[0,1,2].filter(i=>i!==a);
  for(let r=0;r<3;r++)for(let c=0;c<3;c++){
    const p:Vec=[0,0,0];p[a]=layer;p[other[0]]=c-1;p[other[1]]=1-r;
    const fixed=puzzle.level.fixed.some(v=>key(v)===key(p)),placed=puzzle.placed.some(v=>key(v)===key(p)),available=puzzle.level.available.some(v=>key(v)===key(p));
    const b=document.createElement('button');b.textContent=fixed?'◆':placed?'■':available?'+':'×';b.className=fixed?'fixed':placed?'placed':available?'available':'blocked';b.dataset.cell=key(p);
    b.title=editing?`Ячейка (${key(p)})`:fixed?'Неподвижная основа':placed?(tool==='remove'?'Удалить ваш кубик':'Ваш кубик. Для удаления выберите «Удалить».'):available?'Свободная позиция':'Закрытая позиция';b.ariaLabel=`${b.title}. Ячейка ${r*3+c+1}`;
    if(!editing&&available&&!placed&&!puzzle.canPlace(p))b.title='Сейчас недоступно: нужна общая грань с конструкцией и кубик в запасе.';
    if(!editing&&placed&&tool==='remove'&&!puzzle.canRemove(p))b.title='Нельзя удалить: этот кубик удерживает другие блоки.';
    b.ariaLabel=`${b.title}. Ячейка ${r*3+c+1}`;
    b.disabled=!editing&&(tool==='place'?!puzzle.canPlace(p):!placed);
    b.onpointerenter=()=>view.preview(p);b.onpointerleave=()=>view.preview(null);b.onfocus=()=>view.preview(p);b.onblur=()=>view.preview(null);b.onclick=()=>clickCell(p);slice.append(b);
  }
  document.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach(b=>b.classList.toggle('active',Number(b.dataset.layer)===layer));
}
function drawer(open:boolean){el('cell-drawer').hidden=!open;el('cells').setAttribute('aria-expanded',String(open));if(!open){el<HTMLInputElement>('isolate').checked=false;view.setLayer(null);view.preview(null);}}
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
  levels.forEach((l,i)=>{if(Math.floor(i/5)!==selectedGroup)return;const card=document.createElement('button');card.className='level-card';card.dataset.level=String(i);const unlocked=isLevelUnlocked(i,levels.map(l=>l.name),progress.completed,progress.current);card.disabled=!unlocked;card.classList.toggle('locked',!unlocked);const n=document.createElement('span');n.className='card-number';n.textContent=String(i+1).padStart(2,'0');const name=document.createElement('h3');name.textContent=l.name.split(' · ')[1]||l.name;const detail=document.createElement('p');detail.textContent=`${['Знакомство с формой','Глубина и пересечения','Пространственный вызов','Два направления','Взгляд с обратной стороны','Переплетённые пути','Каждый блок на счету','Несколько верных решений','Последовательность граней','Финальное испытание'][i]??levelGroups[Math.floor(i/5)]??'Новое испытание'} · ${l.limit} кубика`;const state=document.createElement('small');state.textContent=progress.completed.includes(l.name)?'✓ Пройдено':unlocked?'Начать испытание →':'Сначала пройдите предыдущее испытание';card.classList.toggle('completed',progress.completed.includes(l.name));card.append(n,name,detail,state);card.onclick=()=>loadLevel(i);cards.append(card);});
}
function closeDialog(id:string){el<HTMLDialogElement>(id).close();}
function openPause(){view.controls.enabled=false;el<HTMLDialogElement>('pause').showModal();}
el<HTMLDialogElement>('pause').addEventListener('close',()=>{view.controls.enabled=screen==='game'||screen==='editor';});
el('play').onclick=startGame;el('choose-level').onclick=()=>showScreen('levels');el('levels-back').onclick=()=>showScreen('home');el('menu').onclick=openPause;el('editor-menu').onclick=openPause;
el('resume').onclick=()=>closeDialog('pause');el('pause-home').onclick=()=>{closeDialog('pause');showScreen('home');};el('pause-levels').onclick=()=>{closeDialog('pause');showScreen('levels');};
el('camera-reset').onclick=()=>{view.resetCamera();closeDialog('pause');message('Ракурс восстановлен. Форма осталась на месте.');};
el('initial-view').onclick=()=>{view.resetCamera();message('Начальный ракурс восстановлен.');};
el('place').onclick=()=>setTool('place');el('remove').onclick=()=>setTool('remove');el('cells').onclick=()=>drawer(el('cell-drawer').hidden);el('close-cells').onclick=()=>drawer(false);
el('undo').onclick=()=>{puzzle.undo();draw();message('Последнее действие отменено.');};el('reset').onclick=()=>{puzzle.reset();draw();message('Уровень сброшен.');};
el('ghosts').onclick=()=>{ghosts=!ghosts;el('ghosts').setAttribute('aria-pressed',String(ghosts));el('ghosts').textContent=ghosts?'Скрыть позиции':'Показать позиции';draw();};
el<HTMLInputElement>('isolate').onchange=()=>draw();el<HTMLSelectElement>('layer-axis').onchange=e=>{axis=(e.target as HTMLSelectElement).value as Axis;draw();};
document.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach(b=>b.onclick=()=>{layer=Number(b.dataset.layer);draw();});
el<HTMLSelectElement>('projection-mode').onchange=e=>setProjectionMode((e.target as HTMLSelectElement).value as ProjectionMode);
el('show-errors').onclick=()=>setProjectionMode(projectionMode==='normal'?'training':'normal');
el('hint').onclick=()=>{
  const solution=solve(puzzle.level);if(!solution){message('Для этой цели решение не найдено.');return;}
  const extras=puzzle.placed.filter(p=>!solution.placed.some(v=>key(v)===key(p)));
  const extra=extras.find(p=>puzzle.canRemove(p))??(extras.length?puzzle.placed.find(p=>puzzle.canRemove(p)):undefined);
  const missing=solution.placed.find(p=>!puzzle.placed.some(v=>key(v)===key(p))&&puzzle.canPlace(p));const p=extra??missing;
  if(!p){message('Оба силуэта уже совпадают.');return;}setTool(extra?'remove':'place');axis='Y';layer=p[1];el<HTMLSelectElement>('layer-axis').value=axis;drawer(true);draw();view.preview(p);el('slice').querySelector<HTMLButtonElement>(`[data-cell="${key(p)}"]`)?.focus();message(extra?'Подсвечен кубик, который можно убрать.':'Подсвечено место для следующего кубика.');
};
el('next').onclick=()=>{closeDialog('victory');const next=nextLevelIndex(index,levels.length);if(next!==null)loadLevel(next);else showScreen('levels');};el('continue').onclick=()=>closeDialog('victory');el('victory-levels').onclick=()=>{closeDialog('victory');showScreen('levels');};
el('completion-home').onclick=()=>{closeDialog('campaign-complete');showScreen('home');};
el('completion-levels').onclick=()=>{closeDialog('campaign-complete');showScreen('levels');};
el('completion-replay').onclick=()=>{closeDialog('campaign-complete');loadLevel(0);};

const tutorial=[
  ['Осматривай конструкцию, вращая камеру мышкой','Зажми левую кнопку на фоне и веди мышь. Колесо приближает и отдаляет. Кубики при этом остаются на своих местах.','◈'],
  ['Сопоставь фигуру с двумя боковыми силуэтами','Две золотые панели стоят параллельно соседним граням сетки. Если вдоль линии взгляда есть хотя бы один кубик, клетка силуэта заполнена.','▦'],
  ['Устанавливай недостающие кубики','Выбери «Поставить» и наведи на грань существующего кубика. Предпросмотр появится в соседней ячейке. Клик присоединит блок этой гранью. По диагонали и отдельно строить нельзя. Для скрытых мест открой «Выбрать ячейку…».','＋'],
  ['При необходимости удаляй поставленные блоки','Переключись на «Удалить»: твои кубики подсвечиваются красным при наведении. Клик возвращает выбранный кубик в запас. Основу и кубики, удаление которых оторвёт остальные блоки, убрать нельзя.','−'],
  ['Добейся совпадения обоих силуэтов','Используй ограниченный запас и сопоставляй обе стороны. Через меню можно включить сравнение цветами: зелёный — совпало, жёлтый — нужен кубик, красный — лишний.','✦']
];
let tutorialStep=0;
function renderTutorial(){const [title,text,symbol]=tutorial[tutorialStep];el('tutorial-count').textContent=`ЗНАКОМСТВО · ${tutorialStep+1} / ${tutorial.length}`;el('tutorial-title').textContent=title;el('tutorial-text').textContent=text;el('tutorial-symbol').textContent=symbol;el<HTMLButtonElement>('tutorial-back').disabled=tutorialStep===0;el('tutorial-next').textContent=tutorialStep===tutorial.length-1?'Начать игру':'Далее →';}
function openTutorial(){tutorialStep=0;renderTutorial();el<HTMLDialogElement>('tutorial').showModal();}
function finishTutorial(){progress.tutorialSeen=true;save();closeDialog('tutorial');if(screen==='home'||screen==='levels')startGame();}
el('how-to').onclick=openTutorial;el('pause-help').onclick=()=>{closeDialog('pause');openTutorial();};el('tutorial-next').onclick=()=>{if(tutorialStep===tutorial.length-1)finishTutorial();else{tutorialStep++;renderTutorial();}};el('tutorial-back').onclick=()=>{if(tutorialStep>0){tutorialStep--;renderTutorial();}};el('tutorial-close').onclick=finishTutorial;
el<HTMLDialogElement>('tutorial').addEventListener('cancel',()=>{progress.tutorialSeen=true;save();});

function refreshDraft(){puzzle=new Puzzle(draft);draw();}
function fillEditor(){el<HTMLInputElement>('name').value=draft.name;el<HTMLInputElement>('limit').value=String(draft.limit);el<HTMLSelectElement>('orientation').value=String(rotations.findIndex(m=>JSON.stringify(m)===JSON.stringify(draft.orientation)));}
el('open-editor').onclick=()=>{savedPuzzle=puzzle;draft=structuredClone(puzzle.level);editing=true;showScreen('editor');fillEditor();refreshDraft();drawer(true);message('Выберите инструмент и изменяйте ячейки через слои.');};
el<HTMLInputElement>('name').oninput=e=>{draft.name=(e.target as HTMLInputElement).value;};el<HTMLInputElement>('limit').onchange=e=>{const n=Number((e.target as HTMLInputElement).value);if(Number.isInteger(n)&&n>=0&&n<=27){draft.limit=n;refreshDraft();}else message('Лимит должен быть целым от 0 до 27.');};
el<HTMLSelectElement>('orientation').onchange=e=>{draft.orientation=structuredClone(rotations[Number((e.target as HTMLSelectElement).value)]);refreshDraft();};
el('validate').onclick=()=>{try{parseLevel(JSON.stringify(draft));message(solve(draft)?'Данные корректны. Решение существует без вращения конструкции.':'Уровень не имеет решения в заданной ориентации.');}catch(e){message((e as Error).message);}};
el('export').onclick=()=>{try{parseLevel(JSON.stringify(draft));const json=JSON.stringify(draft,null,2);el<HTMLTextAreaElement>('json').value=json;const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='hexanexus-level.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){message((e as Error).message);}};
el('import').onclick=()=>{try{draft=parseLevel(el<HTMLTextAreaElement>('json').value);fillEditor();refreshDraft();message('Уровень импортирован. Проверьте решаемость.');}catch(e){message(`Ошибка импорта: ${(e as Error).message}`);}};
el('play-custom').onclick=()=>{try{const l=parseLevel(JSON.stringify(draft));if(!solve(l)){message('Уровень нельзя решить с сохранением связности. Измените цели или ячейки.');return;}editing=false;custom=true;puzzle=new Puzzle(l);savedPuzzle=puzzle;winShown=false;drawer(false);view.resetCamera();startGame();}catch(e){message((e as Error).message);}};
showScreen('home');phoebe.notify({type:'greeting'});
