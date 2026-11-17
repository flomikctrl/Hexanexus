import {key, rotate,gridSize, type Axis, type Mat, type Vec} from './math';
import type {Level} from './levels';
import {matches, project} from './projections';
import {adjacent,connected,inGrid} from './connectivity';
export interface Snapshot {placed:Vec[]; orientation:Mat}
export class Puzzle {
  placed:Vec[]=[]; orientation:Mat; history:Snapshot[]=[];
  constructor(public level:Level){this.orientation=structuredClone(level.orientation);}
  get cells(){return [...this.level.fixed,...this.placed];}
  get size(){return gridSize(this.level);}
  get projections(){return project(this.cells,this.orientation,this.size);}
  get won(){return this.placed.length<=this.level.limit&&this.cells.every(p=>inGrid(p,this.size))&&new Set(this.cells.map(key)).size===this.cells.length&&connected(this.level.fixed,this.placed)&&matches(this.projections,this.level.targets);}
  save(){this.history.push(structuredClone({placed:this.placed,orientation:this.orientation}));}
  canPlace(p:Vec){return inGrid(p,this.size)&&!this.cells.some(v=>key(v)===key(p))&&this.placed.length<this.level.limit&&this.level.available.some(v=>key(v)===key(p))&&this.cells.some(v=>adjacent(v,p));}
  canRemove(p:Vec){const i=this.placed.findIndex(v=>key(v)===key(p));return i>=0&&connected(this.level.fixed,this.placed.filter((_,j)=>j!==i));}
  place(p:Vec){
    if(!this.canPlace(p))return false;
    this.save();this.placed.push([...p]);return true;
  }
  remove(p:Vec){
    const i=this.placed.findIndex(v=>key(v)===key(p));if(!this.canRemove(p))return false;
    this.save();this.placed.splice(i,1);return true;
  }
  toggle(p:Vec){
    return this.placed.some(v=>key(v)===key(p))?this.remove(p):this.place(p);
  }
  turn(a:Axis,d:number){this.save();this.orientation=rotate(this.orientation,a,d);}
  undo(){const s=this.history.pop();if(s){this.placed=s.placed;this.orientation=s.orientation;}}
  reset(){this.placed=[];this.orientation=structuredClone(this.level.orientation);this.history=[];}
}
