// Best-effort screen wake lock, scoped to an active voice session.
export class ConversationScreen {
 constructor({nav=globalThis.navigator,doc=globalThis.document,now=Date.now,schedule=setTimeout,cancel=clearTimeout,idleMs=60000}={}){
  Object.assign(this,{nav,doc,now,schedule,cancel,idleMs});this.active=false;this.lock=null;this.pending=false;this.timer=null;this.lastAttempt=-Infinity;
  this.visibility=()=>{if(this.doc.visibilityState!=='visible')this.release();else if(this.wanted())void this.acquire()};
 }
 wanted(){return this.active&&this.now()<this.until&&this.doc?.visibilityState==='visible'}
 start(){this.stop();this.active=true;this.doc?.addEventListener('visibilitychange',this.visibility);this.activity()}
 activity(){if(!this.active)return;this.until=this.now()+this.idleMs;this.cancel(this.timer);this.timer=this.schedule(()=>this.release(),this.idleMs);if(this.wanted())void this.acquire()}
 async acquire(){
  if(this.lock||this.pending||!this.nav?.wakeLock||!this.wanted()||this.now()-this.lastAttempt<5000)return;
  this.pending=true;this.lastAttempt=this.now();
  try{const lock=await this.nav.wakeLock.request('screen');if(!this.wanted()){await lock.release();return}this.lock=lock;lock.addEventListener('release',()=>{if(this.lock===lock)this.lock=null})}catch{/* Platform refusal must not stop voice. */}finally{this.pending=false}
 }
 release(){const lock=this.lock;this.lock=null;if(lock)void lock.release().catch(()=>{})}
 stop(){this.active=false;this.cancel(this.timer);this.timer=null;this.doc?.removeEventListener('visibilitychange',this.visibility);this.release();this.lastAttempt=-Infinity}
}
