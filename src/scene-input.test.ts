import {describe,it,expect,vi,afterEach} from 'vitest';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {Scene} from './scene';
import {Puzzle} from './state';
import {gridCells,identity,key,rotate,type Vec} from './math';
import {project} from './projections';
import {PointerTapGesture} from './interaction';
import {secondLevels,secondLevelWitnesses} from './levels-second';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

function fixture(){
 const p=new Puzzle({name:'Input regression',fixed:[[0,0,0]],available:gridCells(3).filter(c=>key(c)!=='0,0,0'),limit:4,orientation:identity(),targets:project([[0,0,0],[1,1,1]],identity())});p.place([1,0,0]);
 const v=Object.create(Scene.prototype) as Scene;
 Object.assign(v,{scene:new T.Scene(),group:new T.Group(),geometry:new T.BoxGeometry(.91,.91,.91),edgeGeometry:new T.EdgesGeometry(new T.BoxGeometry(.93,.93,.93)),cornerGeometry:new T.BoxGeometry(.12,.12,.12),panels:[new T.Group(),new T.Group()],directions:new T.Group(),objects:[],hover:null,menu:false,editing:false,busy:false,reduced:false,gesture:new PointerTapGesture(),cancelInput:()=>{},target:new T.Quaternion(),from:new T.Quaternion(),tool:'place',ray:new T.Raycaster(),mouse:new T.Vector2(),camera:new T.PerspectiveCamera(40,1,.1,100),renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,width:1000,height:1000}),style:{}}}});
 for(const panel of v.panels)panel.add(new T.Mesh(),new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial()));
 v.camera.position.set(6,4.8,7.6);v.camera.lookAt(0,0,0);v.camera.updateMatrixWorld();v.sync(p,false,false,'normal');return {p,v};
}
function pointer(v:Scene,cell:Vec){v.group.updateWorldMatrix(true,true);const p=new T.Vector3(...cell).applyMatrix4(v.group.matrixWorld).project(v.camera);return {clientX:(p.x+1)*500,clientY:(1-p.y)*500} as PointerEvent;}
function viewFor(p:Puzzle){const {v}=fixture();v.geometry=new RoundedBoxGeometry(.91,.91,.91,2,.055);v.controls={target:new T.Vector3(),update:()=>{}} as never;v.sync(p);return v;}
describe('Выбор пустых и занятых ячеек',()=>{
 it('восстановление 1.4.0: верхняя грань своего кубика выбирает соседний верхний ярус',()=>{
  const p=new Puzzle(secondLevels[1]);for(const cell of secondLevelWitnesses[p.level.name].slice(0,2))p.place(cell);const v=viewFor(p);
  v.pick(pointer(v,[-.5,.955,-.5]));expect(v.hover?.userData.cell).toEqual([-.5,1.5,-.5]);
 });
 for(const size of [3,4] as const)it(`старое управление ${size}×${size}×${size}: все шесть граней пользовательского кубика`,()=>{
  for(const axis of [0,1,2])for(const direction of [-1,1]){
   const parent:Vec=size===3?[0,0,0]:[-.5,-.5,-.5],fixed:Vec=[...parent],target:Vec=[...parent];fixed[axis]-=direction;target[axis]+=direction;
   const p=new Puzzle({name:'User faces',size,fixed:[fixed],available:gridCells(size).filter(c=>key(c)!==key(fixed)),limit:2,orientation:identity(),targets:project([fixed,parent,target],identity(),size)});expect(p.place(parent)).toBe(true);const v=viewFor(p);
   const camera:Vec=[...parent];camera[axis]+=8*direction;v.camera.position.set(...camera);v.camera.up.set(axis===1?1:0,axis===1?0:1,0);v.camera.lookAt(new T.Vector3(...parent));v.camera.updateMatrixWorld();
   const face:Vec=[...parent];face[axis]+=.455*direction;v.pick(pointer(v,face));expect(v.hover?.userData.cell).toEqual(target);expect(p.place(v.hover!.userData.cell)).toBe(true);
  }
 });
 it('II-02: выбирает верхнюю пустую клетку перед дальним своим кубиком и завершает уровень',()=>{
  const p=new Puzzle(secondLevels[1]),v=viewFor(p),order=secondLevelWitnesses[p.level.name];
  for(const cell of order){v.sync(p);v.pick(pointer(v,cell));expect(p.canPlace(cell)).toBe(true);expect(v.hover?.userData.cell).toEqual(cell);expect(p.place(v.hover!.userData.cell)).toBe(true);}
  expect(p.won).toBe(true);
 });
 for(const size of [3,4] as const)it(`${size}×${size}×${size}: выбирает все ярусы, границы и углы без изменения правил`,()=>{
  for(const cell of gridCells(size)){
   const fixed:Vec=[...cell];fixed[1]+=cell[1]>0?-1:1;
   const p=new Puzzle({name:'All tiers',size,fixed:[fixed],available:gridCells(size).filter(c=>key(c)!==key(fixed)),limit:2,orientation:identity(),targets:project([fixed,cell],identity(),size)}),v=viewFor(p);
   v.camera.position.set(cell[0]+8,cell[1]+6,cell[2]+10);v.camera.lookAt(new T.Vector3(...cell));v.camera.updateMatrixWorld();v.pick(pointer(v,cell));
   expect(p.canPlace([fixed[0]+1,fixed[1]+1,fixed[2]])).toBe(false);
   expect(v.hover?.userData.cell,key(cell)).toEqual(cell);expect(p.place(v.hover!.userData.cell)).toBe(true);expect(p.won).toBe(true);
   expect(p.place([cell[0],(size-1)/2+1,cell[2]])).toBe(false);
  }
 });
 it('верхний ярус выбирается после поворота фигуры и с разных сторон камеры',()=>{
  for(const direction of [-1,1])for(const axis of ['X','Y','Z'] as const){
   const p=new Puzzle(secondLevels[1]);for(const cell of secondLevelWitnesses[p.level.name].slice(0,4))p.place(cell);
   p.orientation=rotate(identity(),axis,direction);const v=viewFor(p),cell:Vec=[.5,1.5,.5];
   const q=v.group.quaternion.clone();v.camera.position.set(8,6.4,7.6*4/3).applyQuaternion(q);v.camera.up.set(0,1,0).applyQuaternion(q);v.camera.lookAt(0,0,0);v.camera.updateMatrixWorld();
   v.pick(pointer(v,cell));expect(v.hover?.userData.cell).toEqual(cell);
  }
 });
 it('верхний кубик удаляется и восстанавливается отменой; основа защищена',()=>{
  const p=new Puzzle(secondLevels[1]);for(const cell of secondLevelWitnesses[p.level.name].slice(0,3))p.place(cell);
  const v=viewFor(p),cell:Vec=[-.5,1.5,-.5];v.setInteraction('remove',2);v.pick(pointer(v,cell));expect(v.hover?.userData.cell).toEqual(cell);expect(p.remove(cell)).toBe(true);p.undo();expect(p.placed).toContainEqual(cell);expect(p.remove(p.level.fixed[0])).toBe(false);
 });
 it('восстанавливает выбор соседней грани своего блока без удаления',()=>{const {p,v}=fixture(),before=JSON.stringify(p);v.pick(pointer(v,[1,0,0]));expect(v.hover?.userData.cell).toEqual([1,0,1]);expect(JSON.stringify(p)).toBe(before);});
 it('позволяет выбрать пустую соседнюю позицию над пользовательским кубиком',()=>{const {p,v}=fixture();v.pick(pointer(v,[1,1,0]));expect(v.hover?.userData.cell).toEqual([1,1,0]);expect(p.canPlace(v.hover!.userData.cell)).toBe(true);expect(p.place(v.hover!.userData.cell)).toBe(true);});
 it('не меняет материал при выборе блока для удаления и удаляет без отложенного изображения',()=>{const {p,v}=fixture();v.setInteraction('remove',3);const old=v.objects.find(c=>c.userData.placed)!,m=old.material as T.MeshStandardMaterial,before=[m.emissive.getHex(),m.emissiveIntensity,old.scale.toArray()];v.pick(pointer(v,[1,0,0]));expect(v.hover).toBe(old);expect([m.emissive.getHex(),m.emissiveIntensity,old.scale.toArray()]).toEqual(before);expect(p.remove([1,0,0])).toBe(true);v.sync(p);expect(v.scene.children).not.toContain(old);expect(v.group.children).not.toContain(old);expect(v.objects.find(c=>key(c.userData.cell)==='1,0,0')?.userData.empty).toBe(true);p.undo();v.sync(p);expect(v.objects.find(c=>key(c.userData.cell)==='1,0,0')?.userData.placed).toBe(true);});
});

describe('Обработчики обычного касания без long press',()=>{
 function inputFixture(){
  const {p,v}=fixture(),canvas=Object.assign(new EventTarget(),{style:{},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:1000}),hasPointerCapture:()=>true});
  vi.stubGlobal('document',{querySelector:()=>null});vi.stubGlobal('window',new EventTarget());
  delete (v as unknown as {cancelInput?:()=>void}).cancelInput;
  Object.assign(v,{renderer:{domElement:canvas},listeners:new AbortController(),appActive:true,cameraAtPress:new T.Quaternion(),lobbyRotation:{cancel:vi.fn()}});
  const action=vi.fn((cell:Vec)=>{if(v.tool==='place')p.place(cell);else p.remove(cell);v.sync(p);});v.onCell=action;
  (v as unknown as {bindInput:(canvas:unknown)=>void}).bindInput(canvas);
  const dispatch=(type:string,cell:Vec,dx=0,id=1)=>{const point=pointer(v,cell),event=new Event(type,{cancelable:true});Object.assign(event,{button:0,pointerId:id,clientX:point.clientX+dx,clientY:point.clientY});canvas.dispatchEvent(event);};
  return {p,v,canvas,action,dispatch};
 }
 it('десять быстрых касаний вызывают ровно десять установок без таймеров',()=>{
  vi.useFakeTimers();const {p,v,action,dispatch}=inputFixture(),cell:Vec=[1,1,0];
  for(let i=0;i<10;i++){dispatch('pointerdown',cell);dispatch('pointerup',cell);expect(p.placed).toContainEqual(cell);p.undo();v.sync(p);}
  expect(action).toHaveBeenCalledTimes(10);expect(vi.getTimerCount()).toBe(0);
 });
 it('как в 1.4.0 не перехватывает движение OrbitControls и отличает тап от свайпа',()=>{
  const {p,v,canvas,action,dispatch}=inputFixture(),cell:Vec=[1,1,0],orbit=vi.fn();canvas.addEventListener('pointermove',orbit);
  dispatch('pointerdown',cell);dispatch('pointermove',cell,5);dispatch('pointerup',cell,5);expect(orbit).toHaveBeenCalledTimes(1);expect(action).toHaveBeenLastCalledWith(cell);expect(p.placed).toContainEqual(cell);
  p.undo();v.sync(p);action.mockClear();dispatch('pointerdown',cell);dispatch('pointermove',cell,20);dispatch('pointerup',cell,20);expect(orbit).toHaveBeenCalledTimes(2);expect(action).not.toHaveBeenCalled();
 });
 it('удержание своего кубика не создаёт таймеров и не удаляет его',()=>{
  vi.useFakeTimers();const {p,action,dispatch}=inputFixture(),cell:Vec=[1,0,0],before=structuredClone(p.placed);
  dispatch('pointerdown',cell);vi.advanceTimersByTime(5000);expect(p.placed).toEqual(before);expect(vi.getTimerCount()).toBe(0);dispatch('pointerup',cell);expect(p.placed).toContainEqual(cell);expect(p.placed.length).toBeGreaterThanOrEqual(before.length);expect(action).toHaveBeenCalledWith([1,0,1]);
 });
 it('режим удаления действует сразу на отпускании, затем отмена восстанавливает блок',()=>{
  vi.useFakeTimers();const {p,v,action,dispatch}=inputFixture(),cell:Vec=[1,0,0];v.setInteraction('remove',3);dispatch('pointerdown',cell);dispatch('pointerup',cell);expect(action).toHaveBeenCalledTimes(1);expect(p.placed).not.toContainEqual(cell);expect(vi.getTimerCount()).toBe(0);p.undo();expect(p.placed).toContainEqual(cell);
 });
 it('отмена, смена режима и второй палец не оставляют подавленным следующий тап',()=>{
  const {v,action,dispatch}=inputFixture(),cell:Vec=[1,1,0];
  dispatch('pointerdown',cell);dispatch('pointercancel',cell);dispatch('pointerup',cell);
  dispatch('pointerdown',cell);v.setInteraction('remove',3);dispatch('pointerup',cell);v.setInteraction('place',3);
  dispatch('pointerdown',cell,0,1);dispatch('pointerdown',cell,0,2);dispatch('pointerup',cell,0,1);dispatch('pointerup',cell,0,2);expect(action).not.toHaveBeenCalled();
  dispatch('pointerdown',cell);dispatch('pointerup',cell);expect(action).toHaveBeenCalledTimes(1);
 });
});
