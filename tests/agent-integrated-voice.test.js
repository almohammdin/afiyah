import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveVoice} from '../agent/live.js';
test('integrated live transport starts, sends structured tools, mutes and releases microphone on stop (mocked)',async()=>{
 let stopped=0,closed=0,config,callbacks,clientOptions;const messages=[],track={enabled:true,stop(){stopped++}};
 const node=()=>({connect(){},disconnect(){},gain:{value:1}});
 class AudioContext{constructor(){this.currentTime=0;this.sampleRate=48000;this.destination={}}async resume(){}async close(){closed++}createMediaStreamSource(){return node()}createScriptProcessor(){return node()}createGain(){return node()}}
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track]})}}});globalThis.AudioContext=AudioContext;
 const remote={close(){},sendRealtimeInput:m=>messages.push(m),sendToolResponse:m=>messages.push(m),sendClientContent:m=>messages.push(m)};
 const loadSdk=async()=>({GoogleGenAI:class{constructor(options){clientOptions=options;this.live={connect:async opts=>{config=opts.config;callbacks=opts.callbacks;return remote}}}}});
 const live=new LiveVoice({getToken:async()=>'synthetic-test-token',loadSdk,tools:[{name:'care_action'}],onTool:async()=>({ok:true,persisted:true})});
 await live.start();assert.equal(clientOptions.httpOptions.apiVersion,'v1beta');assert.equal(live.state,'listening');assert.equal(config.tools[0].functionDeclarations[0].name,'care_action');assert.equal(config.realtimeInputConfig.automaticActivityDetection.startOfSpeechSensitivity,'START_SENSITIVITY_LOW');
 live.mute();assert.equal(track.enabled,false);live.mute();assert.equal(track.enabled,true);
 live.sendText('افتح الأدوية');assert.equal(messages.at(-1).turnComplete,true);
 live.interrupt();assert.equal(live.state,'listening');live.stop();assert.equal(stopped,1);assert.equal(closed,1);assert.equal(live.active,false);
 callbacks.onmessage({toolCall:{functionCalls:[{id:'late',name:'care_action'}]}});await Promise.resolve();assert.equal(messages.some(m=>m.functionResponses),false);
});
test('late microphone permission after stop immediately releases track (mocked)',async()=>{
 let release,stopped=0;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>release=r)}}});
 const live=new LiveVoice({getToken:async()=>'test'}),start=live.start();await Promise.resolve();live.stop();release({getTracks:()=>[{stop(){stopped++}}]});await start;assert.equal(stopped,1);assert.equal(live.active,false);
});
test('writing connects without microphone and never plays received audio (mocked)',async()=>{
 let callbacks,sent;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>{throw Error('must not request microphone')}}}});
 const loadSdk=async()=>({GoogleGenAI:class{constructor(){this.live={connect:async options=>{callbacks=options.callbacks;return {close(){},sendClientContent:m=>sent=m}}}}}});
 const live=new LiveVoice({getToken:async()=>'synthetic',loadSdk});await live.start({textOnly:true});assert.equal(live.state,'writing');assert.equal(live.context,undefined);
 live.play=()=>{throw Error('must not play audio')};callbacks.onmessage({serverContent:{modelTurn:{parts:[{inlineData:{data:'AAA='}}]},turnComplete:true}});
 live.sendText('افتح الأدوية');assert.equal(sent.turns[0].parts[0].text,'افتح الأدوية');assert.equal(live.state,'writing');live.stop();assert.equal(live.active,false);
});

test('diagnostics distinguish remote interruption and turn completion without recording transcript',()=>{
 const events=[];const live=new LiveVoice({onDiagnostic:e=>events.push(e)});
 live.active=true;live.session={close(){}};
 live.message({serverContent:{interrupted:true,inputTranscription:{text:'synthetic private text'}}},live.generation);
 live.message({serverContent:{turnComplete:true}},live.generation);
 assert.deepEqual(events.map(e=>e.kind),['remote-interruption','turn-complete']);
 assert.equal(JSON.stringify(events).includes('synthetic private text'),false);live.stop();
});
test('output audio buffers first chunk and queues later chunks continuously',()=>{
 const scheduled=[];const live=new LiveVoice();live.active=true;
 live.context={currentTime:1,createBuffer:()=>({duration:.1,getChannelData:()=>new Float32Array(1)}),createBufferSource:()=>({connect(){},start:t=>scheduled.push(t),stop(){},disconnect(){}}),close:async()=>{}};
 live.play('AAA=');live.play('AAA=');
 assert.equal(scheduled[0],1.08);assert.ok(Math.abs(scheduled[1]-1.18)<.00001);live.stop();
});
