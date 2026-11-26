// Original composition: "Quiet Courtyard", warm D-major, 100 BPM.
// 32 bars / 76.8 seconds, A-A'-B-A'' form. No samples or third-party music.
// Rendered offline: the game only plays the resulting local WAV.
import {mkdir,writeFile} from 'node:fs/promises';
const rate=22050,bpm=100,beat=60/bpm,bars=32,seconds=bars*4*beat,count=Math.round(rate*seconds);
const left=new Float64Array(count),right=new Float64Array(count),events=[];
const motifs=[
 [66,null,null,69,null,null,67,null], [64,null,null,null,62,null,null,null],
 [67,null,null,69,null,null,71,null], [69,null,null,null,66,null,64,null],
 [62,null,null,66,null,null,69,null], [67,null,null,null,66,null,null,null],
 [64,null,null,66,null,null,61,null], [62,null,null,null,null,null,null,null]
];
const middle=[
 [69,null,null,null,71,null,74,null], [71,null,null,69,null,null,null,null],
 [67,null,null,null,66,null,64,null], [66,null,null,null,69,null,null,null],
 [67,null,null,71,null,null,69,null], [66,null,null,null,64,null,null,null],
 [61,null,null,null,64,null,66,null], [62,null,null,null,null,null,null,null]
];
// Light inversions of D, G and A major; no sustained bass or drone layer.
const harmony=[[62,66,69],[59,62,67],[62,66,69],[61,64,69],[62,66,69],[62,67,71],[61,64,69],[62,66,69]];
function note(at,midi,kind,gain,pan=0){events.push({at,midi,kind,gain,pan});}
for(let bar=0;bar<bars;bar++){
 const section=Math.floor(bar/8),phrase=bar%8,chord=harmony[phrase],start=bar*4*beat;
 const melody=(section===2?middle:motifs)[phrase];
 melody.forEach((m,step)=>{if(m===null)return;
  // A low, spacious piano phrase with a muted marimba reply.
  const shifted=section===3&&phrase===6&&step===3?m+2:m;
  note(start+step*.5*beat,shifted,section===1?'marimba':'piano',.085,-.15);
  if(phrase===4&&step===0)note(start,shifted+12,'bell',.008,.3);
 });
 [1,3].forEach((b,i)=>note(start+b*beat,chord[(i+section)%3],'pluck',.024,.25));
 chord.forEach((m,i)=>note(start+i*.16*beat,m-12,'piano',.026,-.25));
 if(phrase%2===1)note(start+2.5*beat,chord[1],'marimba',.018,.1);
}
const timbres={
 marimba:{duration:1.7,attack:.035,decay:2.6,partials:[[1,1],[2,.08],[3,.012]]},
 bell:{duration:1.8,attack:.055,decay:2.5,partials:[[1,1],[2,.035]]},
 pluck:{duration:1.25,attack:.028,decay:4.2,partials:[[1,1],[2,.1],[3,.018]]},
 piano:{duration:2.6,attack:.04,decay:2.2,partials:[[1,1],[2,.12],[3,.025]]}
};
for(const event of events){
 const voice=timbres[event.kind],frequency=440*2**((event.midi-69)/12),len=Math.round(voice.duration*rate),start=Math.round(event.at*rate);
 const panL=Math.sqrt((1-event.pan)/2),panR=Math.sqrt((1+event.pan)/2);
 for(let i=0;i<len;i++){
  const t=i/rate,attack=Math.min(1,t/voice.attack),release=Math.min(1,(voice.duration-t)/.18);
  const envelope=(.5-.5*Math.cos(Math.PI*attack))*Math.exp(-voice.decay*t)*Math.max(0,release);
  let value=0;for(const [harmonic,amplitude] of voice.partials)value+=amplitude*Math.sin(2*Math.PI*frequency*harmonic*t)*Math.exp(-.35*(harmonic-1)*t);
  value*=envelope*event.gain;
  const index=(start+i)%count;left[index]+=value*panL;right[index]+=value*panR;
  // Very quiet short room reflections, wrapped across the loop boundary too.
  const echo=(index+Math.round(.113*rate))%count;left[echo]+=value*.085*panR;right[echo]+=value*.085*panL;
  const echo2=(index+Math.round(.227*rate))%count;left[echo2]+=value*.035*panL;right[echo2]+=value*.035*panR;
 }
}
let peak=0,sum=0;for(let i=0;i<count;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));const normal=.55/peak,pcm=Buffer.alloc(count*4);
for(let i=0;i<count;i++){const l=left[i]*normal,r=right[i]*normal;sum+=l*l+r*r;pcm.writeInt16LE(Math.round(l*32767),i*4);pcm.writeInt16LE(Math.round(r*32767),i*4+2);}
const seam=Math.max(Math.abs(left[0]-left[count-1]),Math.abs(right[0]-right[count-1]))*normal;
// A seam sample may have the normal slope of a ringing note. Compare it with
// adjacent samples inside the recording, rather than forcing a silent boundary.
let maxStep=0;for(let i=1;i<count;i++)maxStep=Math.max(maxStep,Math.abs(left[i]-left[i-1]),Math.abs(right[i]-right[i-1]));
if(seam>maxStep*normal*1.05)throw Error('Loop seam exceeds the natural waveform slope: '+seam);
const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+pcm.length,4);h.write('WAVE',8);h.write('fmt ',12);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(2,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*4,28);h.writeUInt16LE(4,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);
await mkdir('public/audio',{recursive:true});await writeFile('public/audio/silhouette-loop.wav',Buffer.concat([h,pcm]));
const report={title:'Quiet Courtyard',bpm,seconds,bars,form:"A–A′–B–A″",key:'D major / pentatonic',voices:Object.keys(timbres),notes:events.length,sampleRate:rate,channels:2,peak:.55,rms:Math.sqrt(sum/(count*2)),seamDelta:seam,bytes:pcm.length+44,license:'Original composition and synthesized recording; no third-party samples'};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/music-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

// Original short warm completion cadence, following the same volume settings.
const winLength=Math.round(rate*1.35),win=Buffer.alloc(winLength*4);
for(let i=0;i<winLength;i++){const t=i/rate;let value=0;for(const [j,midi]of [62,66,69].entries()){const age=t-j*.12;if(age<0)continue;const env=Math.min(1,age/.045)*Math.exp(-3.3*age)*Math.min(1,(1.35-t)/.18);value+=Math.sin(2*Math.PI*(440*2**((midi-69)/12))*age)*env*.12;}const sample=Math.round(value*32767);win.writeInt16LE(sample,i*4);win.writeInt16LE(sample,i*4+2);}
const winHeader=Buffer.from(h);winHeader.writeUInt32LE(36+win.length,4);winHeader.writeUInt32LE(win.length,40);await writeFile('public/audio/victory.wav',Buffer.concat([winHeader,win]));
