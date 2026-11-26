import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const skins=['classic','sleepy','baker','winter','wizard','cosmic','royal','architect','flower','pirate','night','archdemon'],emotions=['idle','sad','shock'],report=[];
for(const skin of skins)for(const emotion of emotions){
 const path=`public/assets/motya/${skin}/${emotion}.png`,png=await readFile(path),width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 if(width!==(skin==='royal'?1254:skin==='architect'?724:skin==='night'?340:1024)||height!==width||png[24]!==8||png[25]!==6||png[28]!==0)throw Error('Unexpected PNG format: '+path);
 const chunks=[];for(let i=8;i<png.length;){const n=png.readUInt32BE(i),kind=png.toString('ascii',i+4,i+8);if(kind==='IDAT')chunks.push(png.subarray(i+8,i+8+n));i+=12+n;}
 const raw=inflateSync(Buffer.concat(chunks)),stride=width*4+1;let prev=new Uint8Array(width),transparent=0,visible=0,minX=width,minY=height,maxX=0,maxY=0;
 for(let y=0;y<height;y++){
  const current=new Uint8Array(width),filter=raw[y*stride];
  for(let x=0;x<width;x++){
   const a=x?current[x-1]:0,b=prev[x],c=x?prev[x-1]:0;let predictor=0;
   if(filter===1)predictor=a;else if(filter===2)predictor=b;else if(filter===3)predictor=Math.floor((a+b)/2);else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);predictor=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}else if(filter!==0)throw Error('Invalid filter');
   const alpha=current[x]=(raw[y*stride+1+x*4+3]+predictor)&255;if(alpha===0)transparent++;
   if(alpha>32){visible++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  }prev=current;
 }
 if(!transparent||!visible)throw Error('Missing transparent background or character: '+path);
 report.push({skin,emotion,width,height,transparent,visible,bounds:[minX,minY,maxX,maxY],sha256:createHash('sha256').update(png).digest('hex')});
}
// The replacement sprites must use the same visual canvas as classic/sleepy.
for(const skin of ['baker','winter','cosmic']){
 const sprites=report.filter(sprite=>sprite.skin===skin);
 for(const sprite of sprites){
  const [left,top,right,bottom]=sprite.bounds;
  if(right-left+1<925||right-left+1>948||Math.abs((left+right)/2-511.5)>2||Math.abs(bottom-999)>2||top<220||top>305||sprite.visible<390000||sprite.visible>500000)throw Error('Sprite scale/alignment regression: '+skin+'/'+sprite.emotion);
 }
}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/motya-assets.json',JSON.stringify(report,null,2));console.table(report.map(({skin,emotion,transparent,bounds})=>({skin,emotion,transparent,bounds:bounds.join(',')})));
