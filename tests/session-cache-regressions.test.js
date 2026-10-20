import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {stampAssets} from '../scripts/stamp-release.mjs';
import {safety} from '../agent/safety.js';
test('Arabic ta marbuta normalization covers dose questions and preserves ordinary commands',()=>{
 for(const text of ['جرعة زائدة من الدواء','جرعه زائده من الدواء'])assert.equal(safety(text,'SA')?.kind,'urgent');
 for(const text of ['كم حبة آخذ','كم حبه اخذ'])assert.equal(safety(text,'SA')?.kind,'medication');
 for(const text of ['افتح الملف الصحي','متى الموعد القادم','ابتلع الدواء حسب الوصفة','ما فيه تشنجات الحمد لله'])assert.equal(safety(text,'SA'),null);
});
test('release stamps entire local module graph including dynamic import and CSS, never external SDK',async()=>{
 const root=await mkdtemp(join(tmpdir(),'afiyah-release-'));
 try{await mkdir(join(root,'agent'));await writeFile(join(root,'index.html'),'<script src="app.js?v=old"></script><link href="base.css">');await writeFile(join(root,'base.css'),'');
 await writeFile(join(root,'app.js'),"import './agent/ui.js'; import('./agent/ui.js?v=old'); import 'https://example.com/sdk.js';");await writeFile(join(root,'agent/ui.js'),'');
 await stampAssets(root,'test123');const app=await readFile(join(root,'app.js'),'utf8');assert.equal((app.match(/ui.js\?v=test123/g)||[]).length,2);assert.ok(app.includes('https://example.com/sdk.js\''));assert.match(await readFile(join(root,'index.html'),'utf8'),/base.css\?v=test123/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('restored account survives trial and popup cancellation; guest cannot create unsaved patient',async()=>{
 globalThis.window=new JSDOM('',{url:'https://example.test'}).window;
 const D=await import('../data.js?auth-regression');let listener,signouts=0,rejectPopup=true;
 const account={uid:'account-a',email:'a@example.test'};
 const sdk={getAuth:()=>({}),setPersistence:async()=>{},onAuthStateChanged:(_,cb)=>{listener=cb;queueMicrotask(()=>cb(account));},GoogleAuthProvider:class{},signInWithPopup:async()=>{if(rejectPopup)throw Error('cancelled');return {user:account};},signOut:async()=>{signouts++;listener(null);}};
 D.startDemo();await D.init(()=>{},async name=>name==='app'?{initializeApp:()=>({})}:name==='auth'?sdk:{initializeFirestore:()=>({}),memoryLocalCache:()=>({})});
 assert.equal(D.isDemo(),true);assert.equal(D.user().uid,'demo-owner');
 await assert.rejects(D.login(),/cancelled/);assert.equal(D.isDemo(),true);
 await assert.rejects(D.createPatient({name:'Synthetic',basis:'self'}),/سجل الدخول/);
 await D.logout();assert.equal(signouts,0);assert.equal(D.user(),account);assert.equal(D.isDemo(),false);
 D.startDemo();rejectPopup=false;await D.login();assert.equal(D.user(),account);assert.equal(D.isDemo(),false);
});
