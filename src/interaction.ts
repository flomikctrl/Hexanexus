import type {Vec} from './math';
import type {Puzzle} from './state';
export type Tool='place'|'remove';
export function act(puzzle:Puzzle,tool:Tool,cell:Vec){return tool==='place'?puzzle.place(cell):puzzle.remove(cell);}
export class ClickGesture {
  private start:{x:number;y:number}|null=null;private moved=false;
  begin(x:number,y:number){this.start={x,y};this.moved=false;}
  move(x:number,y:number){if(this.start&&Math.hypot(x-this.start.x,y-this.start.y)>6)this.moved=true;}
  end(x:number,y:number){this.move(x,y);const click=!!this.start&&!this.moved;this.cancel();return click;}
  cancel(){this.start=null;this.moved=false;}
}
export class PointerTapGesture {
  private pointers=new Set<number>();private primary:number|null=null;private blocked=false;private click=new ClickGesture();
  begin(id:number,x:number,y:number){if(!this.pointers.size){this.primary=id;this.blocked=false;this.click.begin(x,y);}else{this.blocked=true;this.click.cancel();}this.pointers.add(id);}
  move(id:number,x:number,y:number){if(id===this.primary&&!this.blocked)this.click.move(x,y);}
  end(id:number,x:number,y:number){const tap=this.pointers.has(id)&&id===this.primary&&!this.blocked&&this.pointers.size===1&&this.click.end(x,y);this.pointers.delete(id);if(!this.pointers.size)this.cancel();return tap;}
  cancel(){this.pointers.clear();this.primary=null;this.blocked=false;this.click.cancel();}
}
