import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {frameGame} from './game-framing';
describe('Портретное кадрирование',()=>{
 it.each([3,4])('увеличивает поле %i без изменения положения камеры и сохраняет обе пластины в кадре',size=>{
  const camera=new T.PerspectiveCamera(),scale=size/3;camera.position.set(6*scale,4.8*scale,7.6*scale);camera.lookAt(0,0,0);camera.updateMatrixWorld();const pos=camera.position.clone(),rotation=camera.quaternion.clone();
  frameGame(camera,384,785,false);const old=new T.Vector3(size/2,0,0).project(camera).x;frameGame(camera,384,785,true);expect(new T.Vector3(size/2,0,0).project(camera).x).toBeGreaterThan(old*1.09);expect(camera.position).toEqual(pos);expect(camera.quaternion.toArray()).toEqual(rotation.toArray());
  const points:T.Vector3[]=[];for(const x of [-size/2,size/2])for(const y of [-size/2,size/2])for(const z of [-size/2,size/2])points.push(new T.Vector3(x,y,z));
  for(const x of [-1.325*scale,1.325*scale])for(const y of [-1.325*scale,1.325*scale]){points.push(new T.Vector3(x,y,-(size/2+.75)));points.push(new T.Vector3(-(size/2+.75),y,x));}
  for(const point of points){point.project(camera);expect(Math.abs(point.x)).toBeLessThan(.98);expect(Math.abs(point.y)).toBeLessThan(.8);}
 });
 it('не меняет кадрирование обучения, меню и ПК, убирает смещение при повороте экрана',()=>{const c=new T.PerspectiveCamera();frameGame(c,390,844,false);expect(c.view?.enabled??false).toBe(false);frameGame(c,390,844,true);expect(c.view?.enabled).toBe(true);frameGame(c,844,390,true);expect(c.view?.enabled).toBe(false);frameGame(c,1440,900,true);expect(c.fov).toBeCloseTo(40);});
});
