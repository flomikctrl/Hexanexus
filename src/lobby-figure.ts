import * as T from 'three';
import type {Vec} from './math';
export const lobbyCells:Vec[]=[[-1,-1,0],[0,-1,0],[1,-1,0],[-1,0,0],[1,0,0],[-1,1,0],[0,1,0],[1,1,0],[0,0,-1]];
export function createLobbyFigure(bodyGeometry:T.BufferGeometry,edgeGeometry:T.BufferGeometry){
 const group=new T.Group(),body=new T.InstancedMesh(bodyGeometry,new T.MeshStandardMaterial({color:0x3c9b92,metalness:.6,roughness:.3,emissive:0x164b42,emissiveIntensity:.35}),lobbyCells.length),transform=new T.Matrix4();
 const source=edgeGeometry.getAttribute('position'),positions=new Float32Array(source.count*3*lobbyCells.length);
 lobbyCells.forEach((cell,index)=>{body.setMatrixAt(index,transform.makeTranslation(...cell));for(let vertex=0;vertex<source.count;vertex++)for(let axis=0;axis<3;axis++)positions[(index*source.count+vertex)*3+axis]=source.getComponent(vertex,axis)+cell[axis];});
 body.instanceMatrix.needsUpdate=true;body.computeBoundingSphere();
 const edges=new T.BufferGeometry();edges.setAttribute('position',new T.BufferAttribute(positions,3));
 group.add(body,new T.LineSegments(edges,new T.LineBasicMaterial({color:0x98cfb7})));group.position.set(1,.25,0);return group;
}
