import {describe,it,expect,vi} from 'vitest';
import {FrameLoop} from './frame-loop';
import {createLobbyFigure,lobbyCells} from './lobby-figure';
import * as T from 'three';
function fixture(){let id=0;const pending=new Map<number,FrameRequestCallback>(),draw=vi.fn();const loop=new FrameLoop(draw,cb=>{pending.set(++id,cb);return id;},n=>{pending.delete(n);});return {loop,draw,pending,tick:(t:number)=>{const callbacks=[...pending.values()];pending.clear();callbacks.forEach(cb=>cb(t));}};}
describe('one managed render loop',()=>{
 it('repeated start creates exactly one RAF chain',()=>{const f=fixture();for(let i=0;i<100;i++)f.loop.start();expect(f.pending.size).toBe(1);f.tick(16);expect(f.draw).toHaveBeenCalledTimes(1);expect(f.pending.size).toBe(1);});
 it('background stops callbacks and resume creates only one chain',()=>{const f=fixture();f.loop.start();f.loop.pause();expect(f.pending.size).toBe(0);f.tick(400);expect(f.draw).not.toHaveBeenCalled();f.loop.start();f.loop.start();f.tick(416);expect(f.draw).toHaveBeenCalledTimes(1);expect(f.pending.size).toBe(1);});
 it('disposal cancels all pending frames and cannot restart',()=>{const f=fixture();f.loop.start();f.loop.dispose();f.loop.start();expect(f.pending.size).toBe(0);f.tick(100);expect(f.draw).not.toHaveBeenCalled();});
 it('pause from inside a draw does not schedule another frame',()=>{let draw=0;const pending=new Map<number,FrameRequestCallback>();const l=new FrameLoop(()=>{draw++;l.pause();},fn=>{pending.set(1,fn);return 1;},n=>{pending.delete(n);});l.start();const fn=pending.get(1)!;pending.clear();fn(16);expect(draw).toBe(1);expect(pending.size).toBe(0);});
});
describe('batched decorative geometry',()=>{
 it('keeps all nine cells but uses one instanced body and one edge batch',()=>{const geo=new T.BoxGeometry(.91,.91,.91),edges=new T.EdgesGeometry(new T.BoxGeometry(.93,.93,.93)),group=createLobbyFigure(geo,edges);expect(group.children).toHaveLength(2);const body=group.children[0] as T.InstancedMesh;expect(body.count).toBe(9);expect(body.geometry).toBe(geo);expect(body.castShadow).toBe(false);const matrix=new T.Matrix4(),v=new T.Vector3();lobbyCells.forEach((cell,i)=>{body.getMatrixAt(i,matrix);v.setFromMatrixPosition(matrix);expect(v.toArray()).toEqual(cell);});expect((group.children[1] as T.LineSegments).geometry.getAttribute('position').count).toBe(edges.getAttribute('position').count*9);});
});
