export interface PhoebeSprite {src:string;clip:string}
type SpriteImage=Pick<HTMLImageElement,'src'|'hidden'|'decode'>;

// Always reuses the same image. An obsolete decode may never reveal a sprite.
export class PhoebeSpriteSwitcher {
  private version=0;
  private requested:string|null=null;
  private pending:Promise<boolean>=Promise.resolve(false);
  private disposed=false;
  constructor(private image:SpriteImage,private commit:(sprite:PhoebeSprite)=>void){}
  show(sprite:PhoebeSprite):Promise<boolean>{
    if(this.disposed)return Promise.resolve(false);
    if(this.requested===sprite.src)return this.pending;
    const version=++this.version;this.requested=sprite.src;
    this.image.hidden=true;this.image.src=sprite.src;
    this.pending=this.image.decode().then(()=>{
      if(this.disposed||version!==this.version)return false;
      this.commit(sprite);this.image.hidden=false;return true;
    },error=>{
      if(this.disposed||version!==this.version)return false;
      this.requested=null;throw error;
    });
    return this.pending;
  }
  cancel(){this.version++;this.requested=null;this.image.hidden=true;}
  dispose(){this.disposed=true;this.cancel();}
}
