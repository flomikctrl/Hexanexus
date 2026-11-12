import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {Scene} from './scene';
import {Puzzle} from './state';
import {levels} from './levels';
import {key,type Vec} from './math';

function sceneFor(puzzle=new Puzzle(levels[0])){
 const view=Object.create(Scene.prototype) as Scene;
 Object.assign(view,{scene:new T.Scene(),group:new T.Group(),geometry:new T.BoxGeometry(.91,.91,.91),edgeGeometry:new T.EdgesGeometry(new T.BoxGeometry(.93,.93,.93)),panels:[new T.Group(),new T.Group()],directions:new T.Group(),hover:null,objects:[],fading:[],lastOccupied:new Set(),reduced:true,target:new T.Quaternion(),from:new T.Quaternion(),editing:false,menu:false,showEmpty:false,busy:false,tool:'place',ray:new T.Raycaster(),mouse:new T.Vector2(),camera:new T.PerspectiveCamera(40,1,.1,100),renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,width:1000,height:1000}),style:{}}}});
 for(const panel of view.panels)panel.add(new T.Mesh(),new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial()));
 view.camera.position.set(6,4.8,7.6);view.camera.lookAt(0,0,0);view.camera.updateMatrixWorld();
 view.sync(puzzle,false,false,'normal');return {view,puzzle};
}
const ghosts=(view:Scene)=>view.objects.filter(c=>c.userData.empty&&(c.material as T.MeshStandardMaterial).opacity>0);
function pointAt(view:Scene,position:Vec){const point=new T.Vector3(...position).project(view.camera);return {clientX:(point.x+1)*500,clientY:(1-point.y)*500} as PointerEvent;}

describe('Простая 3D-подсказка',()=>{
 it('показывает только разрешённые соседние позиции и снова полностью их скрывает',()=>{
  const {view,puzzle}=sceneFor();expect(ghosts(view)).toHaveLength(0);view.setHintVisible(true);
  expect(ghosts(view).map(c=>key(c.userData.cell)).sort()).toEqual(puzzle.level.available.filter(p=>puzzle.canPlace(p)).map(key).sort());
  expect(ghosts(view).every(c=>c.children[0].visible)).toBe(true);view.setHintVisible(false);expect(ghosts(view)).toHaveLength(0);
  expect(view.objects.filter(c=>c.userData.empty).every(c=>!c.children[0].visible)).toBe(true);
 });
 it('не меняет модель, запас, историю, камеру, ориентацию и существующие объекты',()=>{
  const {view,puzzle}=sceneFor(),before=JSON.stringify(puzzle),camera=view.camera.matrixWorld.toArray(),rotation=view.group.quaternion.toArray(),refs=[...view.objects];
  view.setHintVisible(true);view.setHintVisible(false);
  expect(JSON.stringify(puzzle)).toBe(before);expect(view.camera.matrixWorld.toArray()).toEqual(camera);expect(view.group.quaternion.toArray()).toEqual(rotation);expect(view.objects).toEqual(refs);
 });
 it('Raycaster позволяет выбрать прозрачный кубик, но не диагональную ячейку',()=>{
  const {view,puzzle}=sceneFor();view.setHintVisible(true);view.pick(pointAt(view,[1,0,0]));expect(view.hover?.userData.cell).toEqual([1,0,0]);
  view.pick(pointAt(view,[1,1,0]));expect(view.hover?.userData.cell??null).not.toEqual([1,1,0]);expect(puzzle.canPlace([1,1,0])).toBe(false);
  if(view.hover)expect(puzzle.canPlace(view.hover.userData.cell)).toBe(true);
 });
 it('обновляет допустимые позиции после хода и скрывает их при пустом запасе',()=>{
  const {view,puzzle}=sceneFor();view.setHintVisible(true);expect(puzzle.place([1,0,0])).toBe(true);view.sync(puzzle,false,true,'normal');
  expect(ghosts(view).some(c=>key(c.userData.cell)==='1,1,0')).toBe(true);
  expect(puzzle.place([1,1,0])).toBe(true);view.sync(puzzle,false,true,'normal');expect(ghosts(view)).toHaveLength(0);
  puzzle.remove([1,1,0]);view.sync(puzzle,false,true,'normal');expect(ghosts(view).length).toBeGreaterThan(0);
 });
 it('прозрачные ячейки не мешают удалить свой кубик и не снимают защиту основы',()=>{
  const {view,puzzle}=sceneFor();puzzle.place([1,0,0]);view.sync(puzzle,false,true,'normal');view.setInteraction('remove',1);
  view.pick(pointAt(view,[1,0,.455]));expect(view.hover?.userData.cell).toEqual([1,0,0]);expect(puzzle.remove(view.hover!.userData.cell)).toBe(true);
  view.sync(puzzle,false,true,'normal');view.pick(pointAt(view,[0,0,.455]));expect(view.hover?.userData.fixed).toBe(true);expect(puzzle.remove(view.hover!.userData.cell)).toBe(false);
 });
});
