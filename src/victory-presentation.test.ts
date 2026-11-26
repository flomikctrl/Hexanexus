import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {VictoryPresentation,victoryDuration} from './victory-presentation';
function setup(size=4,distance=14,aspect=.49){const figure=new T.Group();for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const cube=new T.Mesh(new T.BoxGeometry(.91,.91,.91));cube.position.set(x*(size-1)/2,y*(size-1)/2,z*(size-1)/2);figure.add(cube);}figure.rotation.set(.2,.3,.1);
 const panels=[new T.Group(),new T.Group()];panels[0].position.set(0,0,-3);panels[1].position.set(-3,0,0);for(const p of panels)p.add(new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial({opacity:.8})));
 const camera=new T.PerspectiveCamera(T.MathUtils.radToDeg(2*Math.atan(Math.tan(T.MathUtils.degToRad(20))*Math.max(1,.95/aspect))),aspect,.1,100);camera.position.set(6,4.8,7.6).normalize().multiplyScalar(distance);camera.lookAt(0,0,0);camera.updateMatrixWorld();return{figure,panels,camera,sequence:new VictoryPresentation()};}
describe('Победная презентация без изменения решения',()=>{
 it('раздвигает и скрывает пластины, делает полный оборот и точно возвращает позу',()=>{
  const {figure,panels,camera,sequence}=setup(),rotation=figure.quaternion.clone(),positions=figure.children.map(c=>c.position.toArray()),cameraPose=camera.matrixWorld.toArray();sequence.start(figure,panels,camera,0);sequence.update(275);expect(panels.every(p=>p.visible)).toBe(true);expect((panels[0].children[0] as T.Mesh<T.BoxGeometry,T.MeshBasicMaterial>).material.opacity).toBeLessThan(.8);sequence.update(550);expect(panels.every(p=>!p.visible)).toBe(true);sequence.update(1550);expect(figure.quaternion.angleTo(rotation)).toBeCloseTo(Math.PI);sequence.update(victoryDuration);expect(figure.quaternion.toArray()).toEqual(rotation.toArray());expect(figure.scale.toArray()).toEqual([1,1,1]);expect(figure.children.map(c=>c.position.toArray())).toEqual(positions);expect(camera.matrixWorld.toArray()).toEqual(cameraPose);
 });
 it('отмена в середине восстанавливает материалы, позиции, масштаб и видимость',()=>{
  const {figure,panels,camera,sequence}=setup(),rotation=figure.quaternion.clone(),positions=panels.map(p=>p.position.toArray());sequence.start(figure,panels,camera,0);sequence.start(figure,panels,camera,100);sequence.update(1300);sequence.cancel();sequence.cancel();expect(figure.quaternion.toArray()).toEqual(rotation.toArray());expect(panels.map(p=>p.position.toArray())).toEqual(positions);for(const p of panels){expect(p.visible).toBe(true);const material=(p.children[0] as T.Mesh<T.BoxGeometry,T.MeshBasicMaterial>).material;expect(material.opacity).toBe(.8);expect(material.transparent).toBe(false);expect(material.depthWrite).toBe(true);}
 });
 for(const size of [3,4])it(`${size}×${size}×${size}: вращение не обрезается на близком и обычном ракурсе`,()=>{
  for(const distance of [size*2,14])for(const aspect of [.45,1.8]){const {figure,panels,camera,sequence}=setup(size,distance,aspect);sequence.start(figure,panels,camera,0);for(let t=550;t<=2550;t+=100){sequence.update(t);figure.updateWorldMatrix(true,true);for(const cube of figure.children)for(const x of [-.455,.455])for(const y of [-.455,.455])for(const z of [-.455,.455]){const p=new T.Vector3(x,y,z).applyMatrix4(cube.matrixWorld).project(camera);expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1);}}sequence.cancel();}
 });
});
