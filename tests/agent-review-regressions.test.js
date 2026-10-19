import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {safety} from '../agent/safety.js';
import {LiveVoice} from '../agent/live.js';
test('ordinary Arabic record commands do not trigger medical safety',()=>{
 for(const text of ['افتح الملف الصحي','متى الموعد القادم','اخبرني عن المساعد','كيف حال العالم','معلومات المريض'])assert.equal(safety(text,'SA'),null,text);
 for(const text of ['عندي ألم في صدري','عندي الم في صدري','ضيق تنفس'])assert.equal(safety(text,'SA').kind,'urgent',text);
 assert.equal(safety('عندي ألم في يدي','SA').kind,'support');
});
test('collapsed options do not hide result or emergency panel',()=>{
 const css=readFileSync(new URL('../agent/agent.css',import.meta.url),'utf8');
 const d=new JSDOM('<style>'+css+'</style><section id="care-agent"><div class="agent-body"><details id="agent-options"></details><div id="agent-results">نتيجة</div><details class="emergency-panel" open>مساعدة</details></div></section>');
 for(const sel of ['#agent-results','.emergency-panel'])assert.notEqual(d.window.getComputedStyle(d.window.document.querySelector(sel)).display,'none');
 d.window.close();
});
test('idle and connecting controls cannot claim listening or change mute',()=>{
 const live=new LiveVoice();live.mute();assert.equal(live.muted,false);assert.equal(live.state,'idle');
 live.active=true;live.set('connecting');live.interrupt();live.mute();assert.equal(live.state,'connecting');assert.equal(live.muted,false);live.stop();
});
test('explicit interruption drops remaining audio until the remote turn ends',()=>{
 const live=new LiveVoice();live.active=true;live.session={close(){}};live.set('speaking');live.interrupt();
 assert.equal(live.state,'listening');assert.equal(live.dropAudio,true);
 // No AudioContext exists: playing a late chunk would throw if not suppressed.
 live.play('AAA=');live.message({serverContent:{turnComplete:true}},live.generation);assert.equal(live.dropAudio,false);live.stop();
});
