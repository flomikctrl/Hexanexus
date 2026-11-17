import {apply,type GridSize, type Mat, type Vec} from './math';
export type Mask = boolean[];
export type Targets = [Mask, Mask];
// Rows run from +Y to -Y. Left: XY along Z. Right: ZY along X.
export function project(cells: Vec[], orientation: Mat,size:GridSize=3): Targets {
  const out: Targets=[Array(size*size).fill(false),Array(size*size).fill(false)],c=(size-1)/2;
  for(const p of cells){const [x,y,z]=apply(orientation,p);out[0][(c-y)*size+x+c]=true;out[1][(c-y)*size+z+c]=true;}
  return out;
}
export const equal = (a: Mask,b: Mask) => a.length===b.length&&a.every((v,i)=>v===b[i]);
export const matches = (a: Targets,b: Targets) => equal(a[0],b[0])&&equal(a[1],b[1]);
