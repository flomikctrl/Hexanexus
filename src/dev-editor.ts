import './dev-editor.css';
﻿import {key,orientations,type Vec} from './math';
import {parseLevel} from './editor';
import {solve} from './solver';
import type {Level} from './levels';
interface EditorContext {
 getDraft:()=>Level;setDraft:(draft:Level)=>void;enter:()=>void;refresh:()=>void;
 play:(level:Level)=>void;openMenu:()=>void;message:(text:string)=>void;
}
export interface DevEditor {editCell:(cell:Vec)=>void;drawTargets:(level:Level)=>void;setVisible:(visible:boolean)=>void}
// Loaded only by a development build at /?editor=1. Not a production route.
export function mountDevEditor(ctx:EditorContext):DevEditor {
 document.getElementById('app')!.insertAdjacentHTML('beforeend',`<section id="editor" hidden><div class="drawer-heading"><h2>Редактор уровня</h2><button id="editor-menu">Меню</button></div><label>Название<input id="name" maxlength="80"></label><label>Запас кубиков<input id="limit" type="number" min="0" max="27"></label><label>Инструмент<select id="tool"><option value="fixed">Фиксированный кубик</option><option value="available">Доступная ячейка</option><option value="blocked">Заблокированная ячейка</option></select></label><p>Выбирайте ячейки в 3D, включив «Подсказку». Нажимайте на клетки целей, чтобы изменить образец.</p><label>Начальная ориентация<select id="orientation"></select></label><div class="editor-targets"><div id="left"><small>Цель XY · вдоль Z</small><div class="mask"></div></div><div id="right"><small>Цель ZY · вдоль X</small><div class="mask"></div></div></div><div class="editor-actions"><button id="validate">Проверить решение</button><button id="play-custom">Испытать уровень</button><button id="export">Экспорт JSON</button><button id="import">Импорт JSON</button></div><textarea id="json" aria-label="JSON уровня" placeholder="JSON для импорта или экспорта" spellcheck="false"></textarea></section>`);
 const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
 const rotations=orientations();rotations.forEach((_,i)=>el<HTMLSelectElement>('orientation').add(new Option(`Ориентация ${i+1}`,String(i))));
 const fill=()=>{const draft=ctx.getDraft();el<HTMLInputElement>('name').value=draft.name;el<HTMLInputElement>('limit').value=String(draft.limit);el<HTMLSelectElement>('orientation').value=String(rotations.findIndex(m=>JSON.stringify(m)===JSON.stringify(draft.orientation)));};
 const open=()=>{ctx.enter();fill();ctx.refresh();ctx.message('Редактор разработчика: выбирайте ячейки в 3D через «Подсказку».');};
 const button=document.createElement('button');button.id='open-editor';button.textContent='Редактор · dev';button.onclick=open;document.querySelector('.home-actions')!.append(button);
 el('editor-menu').onclick=ctx.openMenu;
 el<HTMLInputElement>('name').oninput=e=>{ctx.getDraft().name=(e.target as HTMLInputElement).value;};
 el<HTMLInputElement>('limit').onchange=e=>{const n=Number((e.target as HTMLInputElement).value);if(Number.isInteger(n)&&n>=0&&n<=27){ctx.getDraft().limit=n;ctx.refresh();}else ctx.message('Лимит должен быть целым от 0 до 27.');};
 el<HTMLSelectElement>('orientation').onchange=e=>{ctx.getDraft().orientation=structuredClone(rotations[Number((e.target as HTMLSelectElement).value)]);ctx.refresh();};
 el('validate').onclick=()=>{try{parseLevel(JSON.stringify(ctx.getDraft()));ctx.message(solve(ctx.getDraft())?'Данные корректны. Решение существует.':'Решение не найдено.');}catch(e){ctx.message((e as Error).message);}};
 el('export').onclick=()=>{try{const draft=ctx.getDraft();parseLevel(JSON.stringify(draft));const json=JSON.stringify(draft,null,2);el<HTMLTextAreaElement>('json').value=json;const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='hexanexus-level.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){ctx.message((e as Error).message);}};
 el('import').onclick=()=>{try{ctx.setDraft(parseLevel(el<HTMLTextAreaElement>('json').value));fill();ctx.refresh();ctx.message('Уровень импортирован.');}catch(e){ctx.message(`Ошибка импорта: ${(e as Error).message}`);}};
 el('play-custom').onclick=()=>{try{const level=parseLevel(JSON.stringify(ctx.getDraft()));if(!solve(level)){ctx.message('Уровень нельзя решить с сохранением связности.');return;}ctx.play(level);}catch(e){ctx.message((e as Error).message);}};
 const api:DevEditor={
  setVisible:visible=>{el('editor').hidden=!visible;},
  editCell:cell=>{const draft=ctx.getDraft();draft.fixed=draft.fixed.filter(p=>key(p)!==key(cell));draft.available=draft.available.filter(p=>key(p)!==key(cell));const tool=el<HTMLSelectElement>('tool').value;if(tool==='fixed')draft.fixed.push(cell);if(tool==='available')draft.available.push(cell);ctx.refresh();},
  drawTargets:level=>{for(const [s,id] of ['left','right'].entries()){
   const mask=el(id).querySelector('.mask')!;mask.replaceChildren();
   level.targets[s].forEach((v,i)=>{const b=document.createElement('button');b.className=`pixel ${v?'goal':'empty'}`;b.textContent=v?'■':'·';b.title=v?'Целевая заполненная клетка':'Целевая пустая клетка';b.onclick=()=>{ctx.getDraft().targets[s][i]=!ctx.getDraft().targets[s][i];ctx.refresh();};mask.append(b);});
  }}
 };
 // Let the caller retain api before an initial editor render is requested.
 queueMicrotask(open);return api;
}
