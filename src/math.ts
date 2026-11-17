export type Vec = [number, number, number];
export type Axis = 'X' | 'Y' | 'Z';
export type Mat = [Vec, Vec, Vec];
export const identity = (): Mat => [[1,0,0],[0,1,0],[0,0,1]];
export const key = (v: Vec) => v.join(',');
export type GridSize=3|4;
const grids=new Map<GridSize,Vec[]>();
export function gridCells(size:GridSize=3):Vec[]{
 if(!grids.has(size)){const c=(size-1)/2;grids.set(size,Array.from({length:size**3},(_,i)=>[i%size-c,Math.floor(i/size)%size-c,Math.floor(i/(size*size))-c] as Vec));}
 return grids.get(size)!;
}
export const allCells:Vec[]=gridCells(3);
export const gridSize=(level:{size?:GridSize}):GridSize=>level.size??3;
export function turn([x,y,z]: Vec, axis: Axis, d = 1): Vec {
  const v: Vec = axis==='X' ? [x,-d*z,d*y] : axis==='Y' ? [d*z,y,-d*x] : [-d*y,d*x,z];
  return v.map(n => n===0 ? 0 : n) as Vec;
}
export const apply = (m: Mat, v: Vec): Vec => [0,1,2].map(i => m[0][i]*v[0]+m[1][i]*v[1]+m[2][i]*v[2]) as Vec;
export const rotate = (m: Mat, a: Axis, d=1): Mat => m.map(v=>turn(v,a,d)) as Mat;
export function orientations(): Mat[] {
  const out: Mat[] = [identity()]; const seen = new Set([JSON.stringify(out[0])]);
  for(let i=0;i<out.length;i++) for(const a of ['X','Y','Z'] as Axis[]) {
    const m=rotate(out[i],a); const k=JSON.stringify(m); if(!seen.has(k)){seen.add(k);out.push(m);}
  }
  return out;
}
