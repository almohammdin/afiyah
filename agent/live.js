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
  Object.assign(this,{onState,onLevel,onText,onTool,getToken,tools,instruction,loadSdk}); this.generation=0;this.state='idle';this.muted=false;this.sources=new Set();this.calls=new Map();
 }
 set(value){this.state=value;this.onState(value);}
 sendText(text){if(!this.active||!this.session)throw Error("ابدأ الاتصال الصوتي أولا");this.session.sendClientContent({turns:[{role:"user",parts:[{text}]}],turnComplete:true});}
 async start(){
  if(this.active)return;
  if(!this.getToken)throw Error('يلزم اعتماد رابط معاينة عافية في خدمة إصدار رمز الصوت');
  const generation=++this.generation;this.active=true;this.set('permission');
  try {
   const AC=globalThis.AudioContext||globalThis.webkitAudioContext;
   this.context=new AC();await this.context.resume();
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:false});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;this.stream.getTracks().forEach(t=>t.onended=()=>this.stop());
   this.set('connecting');
   const [token,sdk]=await Promise.all([this.getToken(),this.loadSdk()]);
   if(generation!==this.generation)return;
   const client=new sdk.GoogleGenAI({apiKey:token,httpOptions:{apiVersion:'v1beta'}});
   const session=await client.live.connect({model:'gemini-3.1-flash-live-preview',config:{responseModalities:['AUDIO'],systemInstruction:this.instruction,inputAudioTranscription:{},outputAudioTranscription:{},speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Kore'}}},tools:[{functionDeclarations:this.tools}]},callbacks:{onmessage:m=>{if(generation===this.generation)this.message(m,generation)},onerror:()=>{if(generation===this.generation){this.stop();this.set('failed')}},onclose:()=>{if(generation===this.generation){this.stop();this.set('failed')}}}});
   if(generation!==this.generation){session.close();return;}
   this.session=session;this.nextTime=this.context.currentTime;
   this.source=this.context.createMediaStreamSource(stream);
   this.processor=this.context.createScriptProcessor(4096,1,1);
   this.silent=this.context.createGain();this.silent.gain.value=0;
   this.processor.onaudioprocess=e=>{
    if(!this.active||this.muted||this.sources.size)return; // prevent speaker echo; explicit interruption remains available
    const input=e.inputBuffer.getChannelData(0);this.onLevel(Math.max(...input.map(Math.abs)));
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
  const result=await this.calls.get(call.id);
  if(generation===this.generation)this.session?.sendToolResponse({functionResponses:[{id:call.id,name:call.name,response:result}]});
 }
 message(message,generation){
  for(const call of message.toolCall?.functionCalls||[])void this.tool(call,generation);
  const content=message.serverContent;if(!content)return;
  if(content.interrupted)this.interrupt();
  if(content.inputTranscription?.text)this.onText('user',content.inputTranscription.text);
  if(content.outputTranscription?.text)this.onText('assistant',content.outputTranscription.text);
  for(const part of content.modelTurn?.parts||[])if(part.inlineData?.data)this.play(part.inlineData.data);
  if(content.turnComplete&&!this.sources.size)this.set(this.muted?'muted':'listening');
 }
 play(data){
  if(!this.active)return;
  const raw=atob(data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));if(bytes.length%2)return;
  const values=new DataView(bytes.buffer),buffer=this.context.createBuffer(1,bytes.length/2,24000),channel=buffer.getChannelData(0);
  for(let i=0;i<channel.length;i++)channel[i]=values.getInt16(i*2,true)/32768;
  const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.context.destination);
  source.onended=()=>{this.sources.delete(source);source.disconnect();if(this.active&&!this.sources.size)this.set(this.muted?'muted':'listening')};
  this.sources.add(source);this.nextTime=Math.max(this.context.currentTime,this.nextTime||0);source.start(this.nextTime);this.nextTime+=buffer.duration;this.set('speaking');
 }
 mute(){this.muted=!this.muted;this.stream?.getTracks().forEach(t=>t.enabled=!this.muted);if(this.muted)this.session?.sendRealtimeInput({audioStreamEnd:true});this.set(this.muted?'muted':this.active?'listening':'idle');}
 interrupt(){for(const source of this.sources){source.onended=null;try{source.stop();source.disconnect()}catch{}}this.sources.clear();this.nextTime=this.context?.currentTime||0;this.set(this.active?(this.muted?'muted':'listening'):'idle');}
 stop(){++this.generation;this.active=false;this.interrupt();const session=this.session;this.session=null;try{session?.close()}catch{};if(this.processor)this.processor.onaudioprocess=null;for(const node of [this.source,this.processor,this.silent])try{node?.disconnect()}catch{};this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop()});this.stream=null;this.context?.close().catch(()=>{});this.context=null;this.calls.clear();this.muted=false;this.set('idle');}
}
