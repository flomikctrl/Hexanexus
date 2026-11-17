import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {Scene} from './scene';
import {HintOverlay} from './hint-overlay';
import {Puzzle} from './state';
import {secondLevels,secondLevelWitnesses} from './levels-second';
import {levels} from './levels';
import {gridCells,key,type Vec} from './math';
function fixture(){const view=Object.create(Scene.prototype) as Scene;
 Object.assign(view,{scene:new T.Scene(),group:new T.Group(),hints:new HintOverlay(),geometry:new T.BoxGeometry(.91,.91,.91),edgeGeometry:new T.EdgesGeometry(new T.BoxGeometry(.93,.93,.93)),cornerGeometry:new T.BoxGeometry(.12,.12,.12),panels:[new T.Group(),new T.Group()],directions:new T.Group(),hover:null,objects:[],fading:[],lastOccupied:new Set(),reduced:true,target:new T.Quaternion(),from:new T.Quaternion(),editing:false,menu:false,showEmpty:false,busy:false,tool:'place',ray:new T.Raycaster(),mouse:new T.Vector2(),camera:new T.PerspectiveCamera(40,1,.1,100),controls:{enableDamping:false,minDistance:6,maxDistance:13,target:new T.Vector3(),update:()=>{}},renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,width:1000,height:1000}),style:{}}}});
 for(const p of view.panels)p.add(new T.Mesh(),new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial()));return view;
}
describe('4×4×4: геометрия и выбор граней',()=>{
 it('создаёт 64 позиции, 16 клеток каждой панели, центр 0 и подходящую камеру',()=>{const v=fixture(),p=new Puzzle(secondLevels[0]);v.sync(p);expect(v.objects).toHaveLength(64);expect(v.panels.every(panel=>panel.children.length===18)).toBe(true);expect(v.controls.minDistance).toBe(8);expect(v.controls.target.toArray()).toEqual([0,0,0]);const positions=v.objects.map(o=>o.position.toArray());expect(Math.min(...positions.map(p=>p[0]))).toBe(-1.5);expect(Math.max(...positions.map(p=>p[0]))).toBe(1.5);});
 it('не обрезает крайние координаты и может выделить кубик снизу',()=>{const v=fixture(),p=new Puzzle(secondLevels[1]);for(const cell of secondLevelWitnesses[p.level.name].slice(0,2))p.place(cell);v.sync(p);v.setInteraction('remove',20);const cell=p.placed[0];v.preview(cell);expect(v.hover?.userData.cell).toEqual(cell);expect(v.objects.some(o=>key(o.userData.cell)==='1.5,1.5,1.5')).toBe(true);});
 it('Raycaster выбирает дальние грани со всех шести направлений',()=>{
  const v=fixture(),fixed:[number,number,number]=[-.5,-.5,-.5],p=new Puzzle({name:'ray-four',size:4,fixed:[fixed],available:gridCells(4).filter(c=>key(c)!==key(fixed)),limit:20,orientation:[[1,0,0],[0,1,0],[0,0,1]],targets:[Array(16).fill(true),Array(16).fill(true)]});v.sync(p);v.setInteraction('place',20);
  for(const axis of [0,1,2])for(const direction of [-1,1]){const position:Vec=[...fixed];position[axis]+=8*direction;v.camera.position.set(...position);v.camera.up.set(axis===1?1:0,axis===1?0:1,0);v.camera.lookAt(new T.Vector3(...fixed));v.camera.updateMatrixWorld();v.pick({clientX:500,clientY:500} as PointerEvent);const expected:Vec=[...fixed];expected[axis]+=direction;expect(v.hover?.userData.cell).toEqual(expected);}
 });
 it('при возврате к 3×3×3 удаляет лишние клетки панелей, переиспользует геометрии',()=>{const v=fixture();v.sync(new Puzzle(secondLevels[29]));const geo=v.geometry;v.sync(new Puzzle(levels[0]));expect(v.objects).toHaveLength(27);expect(v.panels.every(p=>p.children.length===11)).toBe(true);expect(v.geometry).toBe(geo);expect(v.controls.minDistance).toBe(6);const full=v.objects.find(o=>!o.userData.empty)!;expect(full.children.filter(o=>o instanceof T.InstancedMesh)).toHaveLength(1);});
});
