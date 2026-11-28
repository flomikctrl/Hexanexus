export interface MatchAward {v:1;type:'award';id:string;playerId:string;winnerId:string;finishedAt:number;scores:{id:string;score:number}[]}
export function validAward(a:unknown):a is MatchAward {const m=a as MatchAward;return !!m&&m.v===1&&m.type==='award'&&typeof m.id==='string'&&m.id.length>0&&m.id.length<=80&&typeof m.playerId==='string'&&typeof m.winnerId==='string'&&Number.isFinite(m.finishedAt)&&m.finishedAt>=0&&Array.isArray(m.scores)&&m.scores.length===2&&new Set(m.scores.map(p=>p.id)).size===2&&m.scores.every(p=>typeof p.id==='string'&&p.id.length<=80&&Number.isInteger(p.score)&&p.score>=0&&p.score<=2)&&m.scores.some(p=>p.id===m.playerId)&&m.scores.some(p=>p.id===m.winnerId&&p.score===2)&&m.scores.filter(p=>p.score===2).length===1;}
export const hostResultsKey='hexanexus.duels.host.results.v1';
export type ResultStorage=Pick<Storage,'getItem'|'setItem'>;
interface Delivery {token:string;award:MatchAward}
export class ResultJournal {
 private pending:Delivery[]=[];
 constructor(private storage?:ResultStorage){try{const data=JSON.parse(storage?.getItem(hostResultsKey)??'[]');if(Array.isArray(data)&&data.every(d=>typeof d.token==='string'&&/^[a-f0-9]{64}$/.test(d.token)&&validAward(d.award)))this.pending=data;}catch{}}
 private commit(next:Delivery[]){try{this.storage?.setItem(hostResultsKey,JSON.stringify(next));this.pending=next;return true;}catch{return false;}}
 save(deliveries:Delivery[]){return this.commit([...this.pending.filter(d=>!deliveries.some(n=>n.award.id===d.award.id&&n.token===d.token)),...deliveries]);}
 forToken(token:string){return this.pending.filter(d=>d.token===token).map(d=>d.award);}
 ack(token:string,id:string){return this.commit(this.pending.filter(d=>d.token!==token||d.award.id!==id));}
}
