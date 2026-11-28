import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {createServer as httpServer} from 'node:http';
import {networkInterfaces} from 'node:os';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {WebSocketServer,WebSocket} from 'ws';
import {build} from 'vite';
// Bundle the shared pure TS engine in memory. No dev server, HMR or watcher.
const bundle=await build({configFile:false,logLevel:'error',build:{ssr:resolve('src/duels/room-server.ts'),write:false,minify:false,rollupOptions:{output:{format:'es',inlineDynamicImports:true}}}});
const chunk=bundle.output.find(item=>item.type==='chunk');
const {DuelRooms,privateIPv4,maxDuelMessage}=await import('data:text/javascript;base64,'+Buffer.from(chunk.code).toString('base64'));
const addresses=Object.values(networkInterfaces()).flat().filter(i=>i?.family==='IPv4'&&!i.internal&&privateIPv4(i.address)).map(i=>i.address);
const host=process.env.DUEL_HOST||addresses[0]||'127.0.0.1',port=Number(process.env.DUEL_PORT||8787);
if(!privateIPv4(host)||host==='localhost'||!Number.isInteger(port)||port<1024||port>65535)throw Error('Use a numeric private LAN address and port 1024..65535');
mkdirSync('.tools',{recursive:true});const resultFile=resolve('.tools/duels-host-results.json');const storage={getItem:()=>existsSync(resultFile)?readFileSync(resultFile,'utf8'):null,setItem:(_key,value)=>{writeFileSync(resultFile+'.tmp',value);renameSync(resultFile+'.tmp',resultFile);}};
const sockets=new Map(),root=resolve('dist');
const server=httpServer(async(req,res)=>{try{if(req.url==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({service:'hexanexus-duels',protocol:1}));return;}const url=new URL(req.url,'http://localhost'),file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+sep)||(await stat(file)).isDirectory())throw Error();const content=await readFile(file);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.wav':'audio/wav','.ico':'image/x-icon'})[extname(file)]||'application/octet-stream');res.end(content);}catch{res.statusCode=404;res.end('Not found');}});
const ws=new WebSocketServer({noServer:true,maxPayload:maxDuelMessage,perMessageDeflate:false});
const rooms=new DuelRooms({send:(id,m)=>{const s=sockets.get(id);if(s?.readyState===WebSocket.OPEN)s.send(JSON.stringify(m));},close:id=>sockets.get(id)?.close()},()=>Date.now(),randomUUID,()=>randomBytes(32).toString('hex'),undefined,storage);
server.on('upgrade',(req,socket,head)=>{const peer=req.socket.remoteAddress?.replace('::ffff:','');let originOK=!req.headers.origin;try{if(req.headers.origin){const u=new URL(req.headers.origin);originOK=(u.origin==='https://localhost'||u.protocol==='http:'&&privateIPv4(u.hostname));}}catch{}
 if(!privateIPv4(peer||'')||!originOK||req.url!=='/duels'||sockets.size>=16){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}ws.handleUpgrade(req,socket,head,s=>ws.emit('connection',s,req));});
ws.on('connection',s=>{const id=randomUUID();sockets.set(id,s);let alive=true,count=0,bucket=Date.now();s.on('pong',()=>{alive=true});s.on('message',(data,binary)=>{if(binary){s.close(1003);return;}if(Date.now()-bucket>1000){bucket=Date.now();count=0;}if(++count>40){s.close(1008,'Too many messages');return;}rooms.receive(id,data.toString('utf8'));});s.on('close',()=>{rooms.disconnect(id);sockets.delete(id);});s.on('error',()=>{});s.heartbeat=()=>{if(!alive){s.terminate();return;}alive=false;s.ping();};});
const timer=setInterval(()=>rooms.tick(),100),heartbeat=setInterval(()=>{for(const s of sockets.values())s.heartbeat();},10000);
server.listen(port,host,()=>console.log(`Hexanexus LAN: http://${host}:${port}\nWebSocket: ws://${host}:${port}/duels\nOnly this private interface is bound. Stop with Ctrl+C.`));
function close(){clearInterval(timer);clearInterval(heartbeat);rooms.shutdown();for(const s of sockets.values())s.terminate();ws.close();server.close();process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
