import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../example-patient.js';
import {validate,doses,sections} from '../domain.js';
test('example is fictional, comprehensive, independently created and date-relative',()=>{
 const a=makeExample('one',new Date('2026-12-31T10:00:00Z')),b=makeExample('two',new Date('2026-12-31T10:00:00Z'));
 assert.equal(a.patient._example,true);assert.equal(a.patient.ownerId,'one');
 for(const s of sections)for(const r of a.entries[s])validate(s,r);
 assert.equal(a.entries.medications.length,5);assert.equal(doses(a.entries.medications,'2026-12-31').length,6);
 assert.ok(a.entries.medications.every(m=>m.ingredient));assert.ok(a.entries.appointments.some(x=>x.date==='2026-10-25'&&x.name.includes('أشعة')));assert.ok(a.entries.appointments.some(x=>x.date==='2027-01-12'));assert.equal(a.entries.profile[0].hospitalFiles.length,3);assert.equal(a.entries.appointments[1].date,'2027-01-02');
 assert.ok(a.entries.doseEvents.every(x=>x.day<'2026-12-31'));
 a.entries.medications[0].name='edited';assert.notEqual(a.entries.medications[0].name,b.entries.medications[0].name);
});
