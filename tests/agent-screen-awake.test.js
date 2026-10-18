import test from 'node:test';
import assert from 'node:assert/strict';
import {ConversationScreen} from '../agent/screen-awake.js';
function setup(request){
 let time=0,callback,requests=0,releases=0;
 const doc=new EventTarget();doc.visibilityState='visible';
 const nav={wakeLock:{request:async()=>{requests++;if(request)return request();return {addEventListener(){},async release(){releases++}}}}};
 const screen=new ConversationScreen({doc,nav,now:()=>time,schedule:fn=>(callback=fn,1),cancel:()=>{callback=null}});
 return {screen,doc,advance:n=>time+=n,expire:()=>callback?.(),counts:()=>({requests,releases})};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('voice keeps screen awake, renews activity and releases after one idle minute',async()=>{
 const h=setup();h.screen.start();await tick();assert.equal(h.counts().requests,1);
 h.advance(45000);h.screen.activity();h.advance(59000);assert.equal(h.screen.wanted(),true);
 h.advance(1000);h.expire();await tick();assert.equal(h.counts().releases,1);
 h.screen.activity();await tick();assert.equal(h.counts().requests,2);h.screen.stop();await tick();assert.equal(h.counts().releases,2);
});
test('hidden page releases and visible page only reacquires while recent voice activity remains',async()=>{
 const h=setup();h.screen.start();await tick();h.advance(6000);
 h.doc.visibilityState='hidden';h.doc.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(h.counts().releases,1);
 h.doc.visibilityState='visible';h.doc.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(h.counts().requests,2);
 h.advance(60000);h.expire();h.doc.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(h.counts().requests,2);h.screen.stop();
});
test('pending wake lock released if voice ends before permission resolves',async()=>{
 let resolve,releases=0;const h=setup(()=>new Promise(r=>resolve=r));h.screen.start();h.screen.stop();
 resolve({async release(){releases++},addEventListener(){}});await tick();assert.equal(releases,1);assert.equal(h.screen.lock,null);
});
test('unsupported or refused wake lock does not fail voice lifecycle',async()=>{
 const screen=new ConversationScreen({nav:{},doc:{visibilityState:'visible',addEventListener(){},removeEventListener(){}}});screen.start();screen.stop();
 const h=setup(()=>Promise.reject(Error('NotAllowedError')));h.screen.start();await tick();assert.equal(h.screen.active,true);h.screen.activity();await tick();assert.equal(h.counts().requests,1);h.screen.stop();
});
