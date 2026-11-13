import {findHintPath,type HintSnapshot,type HintPathResult} from './hint-path';
const scope=self as unknown as {onmessage:((e:MessageEvent<HintSnapshot>)=>void)|null;postMessage:(value:HintPathResult)=>void};
scope.onmessage=event=>{try{scope.postMessage(findHintPath(event.data));}catch{scope.postMessage({status:'impossible',steps:[],expanded:0,fallback:false});}};
