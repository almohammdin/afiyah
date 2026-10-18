import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveVoice,pcm16,liveInstruction} from '../preview/live.js';
test('live refuses missing token integration before microphone access',async()=>{
 const live=new LiveVoice();await assert.rejects(live.start(),/اعتماد رابط/);assert.equal(live.active,undefined);
});
test('same provider call id executes once and returns same result',async()=>{
 let count=0;const outputs=[];const live=new LiveVoice({onTool:async()=>{count++;return {ok:true}}});live.session={sendToolResponse:x=>outputs.push(x)};
 await Promise.all([live.tool({id:'1',name:'care_request'},0),live.tool({id:'1',name:'care_request'},0)]);assert.equal(count,1);assert.equal(outputs.length,2);
});
test('late tool result is not spoken in another patient session',async()=>{
 let release;let sent=false;const live=new LiveVoice({onTool:()=>new Promise(r=>release=r)});live.session={sendToolResponse:()=>sent=true};
 const promise=live.tool({id:'1'},0);await Promise.resolve();live.generation++;release({ok:true});await promise;assert.equal(sent,false);
});
test('audio conversion clamps signal to PCM16',()=>{assert.deepEqual([...pcm16(new Float32Array([-2,0,2]),16000)],[-32768,0,32767]);});
test('Saudi persona constrains tools and clinical advice',()=>{assert.match(liveInstruction,/سؤال واحد/);assert.match(liveInstruction,/care_request/);assert.match(liveInstruction,/997/);assert.match(liveInstruction,/937/);});
