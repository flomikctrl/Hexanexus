// Original composition: "Lantern Courtyard", D-major pentatonic, 100 BPM.
// 32 bars / 76.8 seconds, A-A'-B-A'' form. No samples or third-party music.
// Rendered offline: the game only plays the resulting local WAV.
import {mkdir,writeFile} from 'node:fs/promises';
const rate=22050,bpm=100,beat=60/bpm,bars=32,seconds=bars*4*beat,count=Math.round(rate*seconds);
const left=new Float64Array(count),right=new Float64Array(count),events=[];
const motifs=[
 [74,null,78,81,null,78,76,null], [78,null,81,null,83,81,78,null],
 [79,null,81,83,null,81,78,null], [76,null,78,null,81,null,76,null],
 [74,null,78,81,86,null,83,null], [83,null,81,78,null,76,74,null],
 [79,null,78,76,81,null,78,null], [76,null,73,null,74,null,null,null]
];
const middle=[
 [81,null,83,86,null,83,81,null], [83,null,86,null,88,null,86,null],
 [86,null,83,81,null,79,78,null], [81,null,78,null,76,null,null,null],
 [79,null,83,86,null,83,81,null], [78,null,81,null,83,81,78,null],
 [76,null,78,81,null,76,73,null], [74,null,null,78,76,null,74,null]
];
// Light inversions of D, G and A major; no sustained bass or drone layer.
const harmony=[[62,66,69],[59,62,67],[62,66,69],[61,64,69],[62,66,69],[62,67,71],[61,64,69],[62,66,69]];
function note(at,midi,kind,gain,pan=0){events.push({at,midi,kind,gain,pan});}
for(let bar=0;bar<bars;bar++){
 const section=Math.floor(bar/8),phrase=bar%8,chord=harmony[phrase],start=bar*4*beat;
 const melody=(section===2?middle:motifs)[phrase];
 melody.forEach((m,step)=>{if(m===null)return;
  // Reprise changes register and leaves breathing space rather than looping a chord pad.
  const shifted=section===3&&phrase<4&&step===0?m+12:m;
  note(start+step*.5*beat,shifted,'marimba',section===2?.115:.13,-.2);
  if((phrase===0||phrase===4)&&step===0)note(start,shifted+12,'bell',.025,.45);
 });
 // Gently plucked accompaniment with an alternating sixteenth-note pickup.
 [0,1.5,2.5,3.5].forEach((b,i)=>note(start+b*beat,chord[i%3]+12,'pluck',.036,.35));
 chord.forEach((m,i)=>note(start+(i*.09)*beat,m,'piano',.047,-.3));
 if(phrase%2===1)note(start+2*beat,chord[1]+12,'piano',.03,.15);
 if(section===1||section===3)note(start+3.75*beat,chord[2]+12,'pluck',.022,.2);
}
const timbres={
 marimba:{duration:1.65,attack:.012,decay:2.9,partials:[[1,1],[2,.19],[3,.045],[4,.018]]},
 bell:{duration:2.4,attack:.022,decay:2.1,partials:[[1,1],[2,.12],[3,.045]]},
 pluck:{duration:1.05,attack:.009,decay:5.8,partials:[[1,1],[2,.24],[3,.085],[4,.03]]},
 piano:{duration:2.1,attack:.018,decay:2.65,partials:[[1,1],[2,.23],[3,.08],[4,.035]]}
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
const report={title:'Lantern Courtyard',bpm,seconds,bars,form:"A–A′–B–A″",key:'D major / pentatonic',voices:Object.keys(timbres),notes:events.length,sampleRate:rate,channels:2,peak:.55,rms:Math.sqrt(sum/(count*2)),seamDelta:seam,bytes:pcm.length+44,license:'Original composition and synthesized recording; no third-party samples'};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/music-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
