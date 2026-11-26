/** Delay only the presentation; awarding remains in the existing once-only path. */
export class CompletionDelay {
 private timer:ReturnType<typeof setTimeout>|undefined;
 get pending(){return this.timer!==undefined;}
 start(show:()=>void,delay=3000){if(this.pending)return false;this.timer=setTimeout(()=>{this.timer=undefined;show();},delay);return true;}
 cancel(){clearTimeout(this.timer);this.timer=undefined;}
}
