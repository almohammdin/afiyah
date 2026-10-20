import {ConversationScreen} from './screen-awake.js?v=20261020-timers';
import { persona } from './policy.js';

export const liveInstruction = `${persona}
أنت مساعد عافية الصوتي. تكلم بلهجة سعودية طبيعية لطيفة وهادئة، بجمل قصيرة وسؤال واحد عند نقص المعلومات. لا تبدأ كل رد بتحية ولا تقرأ الواجهة كلها. انطق أسماء الأدوية والتركيزات والأوقات ببطء، ولا تخمن كلمة غير واضحة. هذه جلسة اختبار بملفات افتراضية فقط، اطلب عدم ذكر معلومات شخصية أو صحية حقيقية.
استخدم care_request لكل طلب يتعلق بسجل أو تنقل، وانتظر نتيجته. لا تعتبر إرسال الطلب نجاحا. إذا كانت النتيجة للمراجعة فاطلب مراجعة البطاقة ولا تعتمدها بنفسك. استخدم open_input لإظهار الكتابة أو المرفقات أو زر الكاميرا عند الحاجة. الكاميرا لا تعمل إلا بضغط المستخدم. لا تعط جرعة أو تشخيصا أو إرشادات إسعافية تفصيلية. عند طارئ محتمل وجه لطلب المساعدة مبكرا، ولا تفترض البلد من اللغة. في السعودية 997 للإسعاف و937 للاستشارة. لا تستخدم الاستشارة بدلا من الإسعاف. لا تقرأ ملفا بصوت حتى يحدده المستخدم ويوافق على سماعه`;
export const liveTools = [{name:'care_request',description:'تنفيذ طلب في ملف الاختبار المحدد عبر أدوات عافية؛ النتيجة هي المرجع الوحيد لنجاح الحفظ',parameters:{type:'OBJECT',properties:{text:{type:'STRING'}},required:['text']}},{name:'open_input',description:'فتح مطوية الكتابة أو إرفاق الملف أو إظهار زر الكاميرا دون تشغيلها',parameters:{type:'OBJECT',properties:{mode:{type:'STRING',enum:['text','attachment','camera']}},required:['mode']}}];

export function pcm16(input, rate) {
 const ratio=rate/16000, out=new Int16Array(Math.floor(input.length/ratio));
 for(let i=0;i<out.length;i++){const value=Math.max(-1,Math.min(1,input[Math.floor(i*ratio)]));out[i]=value<0?value*32768:value*32767;}
 return out;
}
export class LiveVoice {
 constructor({onState=()=>{},onLevel=()=>{},onText=()=>{},onTool=async()=>({ok:false}),getToken,tools=liveTools,instruction=liveInstruction,loadSdk=()=>import('https://cdn.jsdelivr.net/npm/@google/genai@2.14.0/+esm')}={}) {
  Object.assign(this,{onState,onLevel,onText,onTool,getToken,tools,instruction,loadSdk}); this.screen=new ConversationScreen();this.generation=0;this.state='idle';this.muted=false;this.sources=new Set();this.calls=new Map();
 }
 set(value){this.state=value;this.onState(value);}
 sendText(text){if(!this.active||!this.session)throw Error("ابدأ الاتصال الصوتي أولا");this.session.sendClientContent({turns:[{role:"user",parts:[{text}]}],turnComplete:true});}
 prepareAudio(){
  const AC=globalThis.AudioContext||globalThis.webkitAudioContext;
  const context=new AC(),resumed=context.resume();
  // Attach a rejection handler immediately while the local patient selection runs.
  resumed.catch(()=>{});
  return {context,resumed,dispose(){void context.close().catch(()=>{})}};
 }
 async start({textOnly=false,prepared}={}){
  if(this.active)return;
  if(!this.getToken)throw Error('يلزم اعتماد رابط معاينة عافية في خدمة إصدار رمز الصوت');
  const generation=++this.generation;this.active=true;this.muted=false;this.dropAudio=false;this.textOnly=textOnly;this.set(textOnly?'connecting':'permission');
  try {
   let stream;
   if(!textOnly){
   const AC=globalThis.AudioContext||globalThis.webkitAudioContext;
   this.context=prepared?.context||new AC();
   const resumed=prepared?.resumed||this.context.resume();
   // Start both permission operations before yielding, and clean up late streams.
   const media=navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:false}).then(value=>{
    if(generation!==this.generation){value.getTracks().forEach(t=>t.stop());return null;}
    this.stream=value;return value;
   });
   let timer;
   try{[stream]=await Promise.race([Promise.all([media,resumed]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('permission-timeout'),{name:'TimeoutError'})),15000)})]);}finally{clearTimeout(timer)}
   if(!stream)return;
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.stream.getTracks().forEach(t=>t.onended=()=>this.stop());
   }
   this.set('connecting');
   const [token,sdk]=await Promise.all([this.getToken(),this.loadSdk()]);
   if(generation!==this.generation)return;
   const client=new sdk.GoogleGenAI({apiKey:token,httpOptions:{apiVersion:'v1beta'}});
   const session=await client.live.connect({model:'gemini-3.1-flash-live-preview',config:{responseModalities:['AUDIO'],systemInstruction:this.instruction,inputAudioTranscription:{},outputAudioTranscription:{},speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Kore'}}},tools:[{functionDeclarations:this.tools}]},callbacks:{onmessage:m=>{if(generation===this.generation)this.message(m,generation)},onerror:()=>{if(generation===this.generation){this.stop();this.set('failed')}},onclose:()=>{if(generation===this.generation){this.stop();this.set('ended')}}}});
   if(generation!==this.generation){session.close();return;}
   this.session=session;if(!textOnly)this.screen.start();if(textOnly){this.set('writing');return;}this.nextTime=this.context.currentTime;
   this.source=this.context.createMediaStreamSource(stream);
   this.processor=this.context.createScriptProcessor(4096,1,1);
   this.silent=this.context.createGain();this.silent.gain.value=0;
   this.processor.onaudioprocess=e=>{
    if(!this.active||this.muted||!this.session)return;
    const input=e.inputBuffer.getChannelData(0);let energy=0,peak=0;for(const value of input){energy+=value*value;peak=Math.max(peak,Math.abs(value));}if(!this.sources.size)this.onLevel(peak);
    if(Math.sqrt(energy/input.length)>0.025)this.screen.activity();
    const pcm=pcm16(input,this.context.sampleRate),bytes=new Uint8Array(pcm.buffer);
    this.session.sendRealtimeInput({audio:{data:btoa(String.fromCharCode(...bytes)),mimeType:'audio/pcm;rate=16000'}});
   };
   this.source.connect(this.processor);this.processor.connect(this.silent);this.silent.connect(this.context.destination);this.set('listening');
  }catch(error){if(generation===this.generation){this.stop();this.set('failed');throw error;}}
 }
 async tool(call,generation){
  // Cache the promise, including failed responses: repeats never execute twice.
  if(!call.id||generation!==this.generation)return;
  if(!this.calls.has(call.id))this.calls.set(call.id,Promise.resolve().then(()=>this.onTool(call.name,call.args||{},call.id)).catch(()=>({ok:false,message:'لم يتأكد تنفيذ الطلب'})));
  if(this.session&&!this.sources.size)this.set('processing');
  const result=await this.calls.get(call.id);
  if(generation===this.generation){this.session?.sendToolResponse({functionResponses:[{id:call.id,name:call.name,response:result}]});if(this.state==='processing')this.set(this.textOnly?'writing':this.muted?'muted':'listening');}
 }
 message(message,generation){
  for(const call of message.toolCall?.functionCalls||[])void this.tool(call,generation);
  const content=message.serverContent;if(!content)return;
  if(content.interrupted){this.interrupt();this.dropAudio=false;}
  if(content.inputTranscription?.text){this.screen.activity();this.onText('user',content.inputTranscription.text);}
  if(content.outputTranscription?.text)this.onText('assistant',content.outputTranscription.text);
  for(const part of content.modelTurn?.parts||[])if(part.inlineData?.data&&!this.textOnly)this.play(part.inlineData.data);
  if(content.turnComplete)this.dropAudio=false;
  if(content.turnComplete&&!this.sources.size)this.set(this.textOnly?'writing':this.muted?'muted':'listening');
 }
 play(data){
  if(!this.active||this.dropAudio)return;
  const raw=atob(data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(bytes.length%2)return;
  const values=new DataView(bytes.buffer),buffer=this.context.createBuffer(1,bytes.length/2,24000),channel=buffer.getChannelData(0);
  for(let i=0;i<channel.length;i++)channel[i]=values.getInt16(i*2,true)/32768;
  const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.context.destination);
  source.onended=()=>{this.sources.delete(source);source.disconnect();this.screen.activity();if(this.active&&!this.sources.size)this.set(this.muted?'muted':'listening')};
  this.screen.activity();this.sources.add(source);this.nextTime=Math.max(this.context.currentTime,this.nextTime||0);source.start(this.nextTime);this.nextTime+=buffer.duration;this.set('speaking');
 }
 mute(){if(!this.active||!this.session||this.textOnly)return;this.muted=!this.muted;this.stream?.getTracks().forEach(t=>t.enabled=!this.muted);if(this.muted)this.session?.sendRealtimeInput({audioStreamEnd:true});this.set(this.muted?'muted':this.active?'listening':'idle');}
 interrupt(){if(this.active&&!this.session)return;this.dropAudio=true;for(const source of this.sources){source.onended=null;try{source.stop();source.disconnect()}catch{}}this.sources.clear();this.nextTime=this.context?.currentTime||0;this.set(this.active?(this.textOnly?'writing':this.muted?'muted':'listening'):'idle');}
 stop(){this.screen.stop();++this.generation;this.active=false;this.interrupt();const session=this.session;this.session=null;try{session?.close()}catch{};if(this.processor)this.processor.onaudioprocess=null;for(const node of [this.source,this.processor,this.silent])try{node?.disconnect()}catch{};this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop()});this.stream=null;this.context?.close().catch(()=>{});this.context=null;this.calls.clear();this.muted=false;this.set('idle');}
}
