import {apply, type Mat, type Vec} from './math';
export type Mask = boolean[];
export type Targets = [Mask, Mask];
// Rows run from +Y to -Y. Left: XY along Z. Right: ZY along X.
export function project(cells: Vec[], orientation: Mat): Targets {
  const out: Targets=[Array(9).fill(false),Array(9).fill(false)];
  for(const p of cells){const [x,y,z]=apply(orientation,p);out[0][(1-y)*3+x+1]=true;out[1][(1-y)*3+z+1]=true;}
  return out;
}
export const equal = (a: Mask,b: Mask) => a.every((v,i)=>v===b[i]);
export const matches = (a: Targets,b: Targets) => equal(a[0],b[0])&&equal(a[1],b[1]);
