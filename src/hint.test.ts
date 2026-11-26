import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {Scene} from './scene';
import {HintOverlay} from './hint-overlay';
import {Puzzle} from './state';
import {levels} from './levels';
import {HintChain,findHintPath,hintSnapshot} from './hint-path';
import type {Vec} from './math';
import {PointerTapGesture} from './interaction';

function sceneFor(puzzle=new Puzzle(levels[0])){
 const view=Object.create(Scene.prototype) as Scene;
 view.cancelInput=()=>{}; // Gesture UI is not constructed by this Raycaster fixture.
 view.gesture=new PointerTapGesture();
 Object.assign(view,{scene:new T.Scene(),hints:new HintOverlay(),group:new T.Group(),geometry:new T.BoxGeometry(.91,.91,.91),edgeGeometry:new T.EdgesGeometry(new T.BoxGeometry(.93,.93,.93)),panels:[new T.Group(),new T.Group()],directions:new T.Group(),hover:null,objects:[],fading:[],lastOccupied:new Set(),reduced:true,target:new T.Quaternion(),from:new T.Quaternion(),editing:false,menu:false,showEmpty:false,busy:false,tool:'place',ray:new T.Raycaster(),mouse:new T.Vector2(),camera:new T.PerspectiveCamera(40,1,.1,100),renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,width:1000,height:1000}),style:{}}}});
 for(const panel of view.panels)panel.add(new T.Mesh(),new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial()));
 view.camera.position.set(6,4.8,7.6);view.camera.lookAt(0,0,0);view.camera.updateMatrixWorld();view.sync(puzzle,false,false,'normal');return {view,puzzle};
}
function pointAt(view:Scene,position:Vec){const point=new T.Vector3(...position).project(view.camera);return {clientX:(point.x+1)*500,clientY:(1-point.y)*500} as PointerEvent;}
describe('Пошаговые 3D-маркеры',()=>{
 it('рисует только показанные шаги и не раскрывает все пустые ячейки',()=>{
  const {view,puzzle}=sceneFor(),chain=new HintChain();chain.set(puzzle,findHintPath(hintSnapshot(puzzle)).steps);chain.next();view.setHints(chain.visible);
  expect(view.hints.count).toBe(1);expect(view.hints.group.children[0].userData.step).toBe(1);expect(view.objects.filter(c=>c.userData.empty&&(c.material as T.MeshStandardMaterial).opacity>0)).toHaveLength(0);chain.next();view.setHints(chain.visible);expect(view.hints.count).toBe(2);
 });
 it('не меняет модель, запас, историю, ориентацию, камеру и реальные объекты',()=>{
  const {view,puzzle}=sceneFor(),before=JSON.stringify(puzzle),camera=view.camera.matrixWorld.toArray(),objects=[...view.objects];view.setHints([{tool:'place',cell:[1,0,0],number:1},{tool:'place',cell:[1,1,0],number:2}]);expect(JSON.stringify(puzzle)).toBe(before);expect(view.camera.matrixWorld.toArray()).toEqual(camera);expect(view.objects).toEqual(objects);
 });
 it('Raycaster игнорирует маркеры, включая будущую пока недопустимую установку',()=>{
  const {view,puzzle}=sceneFor();view.pick(pointAt(view,[.455,0,0]));const original=view.hover?.userData.cell;expect(original).toEqual([1,0,0]);view.setHints([{tool:'place',cell:[1,0,0],number:1},{tool:'place',cell:[1,1,0],number:2}]);view.hints.group.updateMatrixWorld(true);view.pick(pointAt(view,[.455,0,0]));expect(view.hover?.userData.cell).toEqual(original);expect(view.ray.intersectObject(view.hints.group,true)).toHaveLength(0);view.pick(pointAt(view,[1,1,0]));expect(view.hover?.userData.cell??null).not.toEqual([1,1,0]);expect(puzzle.canPlace([1,1,0])).toBe(false);
 });
 it('различает удаление и установку в той же ячейке, не закрывая настоящий кубик',()=>{
  const {view,puzzle}=sceneFor();puzzle.place([1,0,0]);view.sync(puzzle,false,false,'normal');view.setHints([{tool:'remove',cell:[1,0,0],number:1},{tool:'place',cell:[1,0,0],number:2}]);expect(view.hints.group.children.map(g=>g.userData.tool)).toEqual(['remove','place']);expect(view.hints.group.children.every(g=>!g.children.some(c=>c instanceof T.Mesh))).toBe(true);const colors=view.hints.group.children.map(g=>(g.children[0] as T.LineSegments<T.BufferGeometry,T.LineBasicMaterial>).material.color.getHex());expect(colors[0]).not.toBe(colors[1]);view.setInteraction('remove',1);view.pick(pointAt(view,[1,0,.455]));expect(view.hover?.userData.cell).toEqual([1,0,0]);expect(puzzle.remove(view.hover!.userData.cell)).toBe(true);
 });
 it('очищает маркеры и сохраняет защиту основы',()=>{
  const {view,puzzle}=sceneFor();view.setHints([{tool:'place',cell:[1,0,0],number:1}]);view.setHints([]);expect(view.hints.count).toBe(0);expect(view.hints.group.children).toHaveLength(0);view.setInteraction('remove',2);view.pick(pointAt(view,[0,0,.455]));expect(view.hover?.userData.fixed).toBe(true);expect(puzzle.remove([0,0,0])).toBe(false);
 });
 it('разводит номера полного решения на мобильном экране, не меняя клетки подсказок',()=>{
  const puzzle=new Puzzle(levels[29]),hints=new HintOverlay(),steps=findHintPath(hintSnapshot(puzzle)).steps.map((s,i)=>({...s,number:i+1}));hints.set(steps,puzzle.cells);
  const width=390,height=844,aspect=width/height,camera=new T.PerspectiveCamera(T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(20))*.95/aspect)),aspect,.1,100);camera.position.set(6,4.8,7.6);camera.lookAt(0,0,0);hints.layout(camera,width,height);hints.group.updateMatrixWorld(true);
  const boxes=hints.group.children.map(root=>{const label=root.children.at(-1)!,p=label.getWorldPosition(new T.Vector3()),ndc=p.clone().project(camera),z=Math.abs(p.applyMatrix4(camera.matrixWorldInverse).z),scale=height/(2*z*Math.tan(T.MathUtils.degToRad(camera.fov/2)));return {x:(ndc.x+1)*width/2,y:(1-ndc.y)*height/2,w:label.scale.x*scale,h:label.scale.y*scale};});
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];expect(Math.abs(a.x-b.x)>=(a.w+b.w)/2||Math.abs(a.y-b.y)>=(a.h+b.h)/2).toBe(true);}
  expect(hints.group.children.map(root=>root.position.toArray())).toEqual(steps.map(s=>s.cell));
 });
});
