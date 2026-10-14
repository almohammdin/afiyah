import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../data.js';
test('patient isolation, section permissions, record updates, and revocation in demo',async()=>{
 D.startDemo();const first=(await D.patients())[0];
 const second=await D.addPatient({name:'اختبار',relation:'',birthYear:'',blood:''});
 await D.saveRecord(second,'tasks',{name:'مهمة خاصة بالملف الثاني',status:'pending'});
 assert.equal((await D.records(first)).tasks.length,2);
 assert.equal((await D.records(second)).tasks.length,1);
 const shared={...first,ownerId:'someone-else',grant:{readSections:['tasks'],editSections:[]}};
 assert.equal(D.canRead(shared,'tasks'),true);assert.equal(D.canRead(shared,'medications'),false);
 await assert.rejects(D.saveRecord(shared,'tasks',{name:'unauthorized'}));
 assert.deepEqual((await D.records(shared)).medications,[]);
 await D.share(first,{email:'TEST@example.com',readSections:['tasks'],editSections:[]});
 const grant=(await D.members(first))[0];assert.equal(grant.email,'test@example.com');assert.equal(grant.status,'pending');
 await D.revoke(first,grant);assert.equal((await D.members(first)).length,0);
 await D.logout();assert.equal(D.currentUser(),null);
});
test('live sign-in stays closed until backend configuration is explicitly enabled',async()=>{
 assert.equal(D.ready(),false);await assert.rejects(D.login());
});
