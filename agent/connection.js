// Synthetic voice activation approved 2026-10-18. No secret is stored here.
export const connection = Object.freeze({enabled:true,origin:'https://almohammdin.github.io',endpoint:'https://mesraah-live-token.naif123456.workers.dev/token'});
let check;
export async function getLiveToken(forceRefresh=false){
 if(!connection.enabled)throw Error('الصوت جاهز للربط وينتظر اعتماد تفعيل الاختبار');
 if(location.origin!==connection.origin)throw Error('اختبار الصوت متاح من عنوان عافية الأصلي فقط');
 const [{initializeApp,getApps},{initializeAppCheck,ReCaptchaEnterpriseProvider,getToken}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-check.js')]);
 const name='afiyah-voice-test';
 const app=getApps().find(a=>a.name===name)||initializeApp({apiKey:'AIzaSyAAvC9y5jQ_7fAwmkCqBtgFDrBRF5t4uI0',authDomain:'mesraah-a2dfc.firebaseapp.com',projectId:'mesraah-a2dfc',appId:'1:986043593957:web:b848313ef8cf83a5f3500c'},name);
 if(!check)check=initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider('6LdgFnstAAAAAJod6T7NgPLzkfFkSYNbc4_q4rfe'),isTokenAutoRefreshEnabled:false});
 let attestation;try{attestation=await getToken(check,forceRefresh)}catch(error){throw Error('تعذر التحقق من التطبيق · '+(error.code||'app-check-failed'))}
 const response=await fetch(connection.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Firebase-AppCheck':attestation.token},body:'{}',signal:AbortSignal.timeout(15000)});
 const value=await response.json().catch(()=>({}));
 if(response.status===401&&!forceRefresh)return getLiveToken(true);
 if(!response.ok||!value.token){const code=[value.error,value.detail].filter(v=>typeof v==='string'&&/^[a-z0-9-]{1,60}$/.test(v)).join(' / ');throw Error(`تعذر إصدار رمز الصوت (${response.status})${code?' · '+code:''}`);}
 return value.token;
}

export async function checkVoiceConnection(){
 await import('https://cdn.jsdelivr.net/npm/@google/genai@2.14.0/+esm').catch(()=>{throw Error('تعذر تحميل مكتبة الصوت · voice-sdk-load')});
 await getLiveToken();
 return true;
}
