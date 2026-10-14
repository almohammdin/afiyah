import {doses} from './domain.js?v=20261014-final';
export const shiftDate=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const monthStart=s=>s.slice(0,7)+'-01';
export function shiftMonth(s,n){const d=new Date(monthStart(s)+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,10);}
export function calendarDays(s,mode='month'){const first=mode==='month'?monthStart(s):s;const start=shiftDate(first,-new Date(first+'T12:00:00Z').getUTCDay());return Array.from({length:mode==='month'?42:7},(_,i)=>shiftDate(start,i));}
export const dateLabel=s=>new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
export const monthLabel=s=>new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
export const weekNames=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
export function timeline(entries,date){const events=entries.doseEvents||[];return [...doses((entries.medications||[]).filter(x=>!x.deleted),date).map(s=>({...s,kind:'medications',event:events.find(x=>x.id===s.id)})),...(entries.appointments||[]).filter(x=>!x.deleted&&x.date===date).map(x=>({...x,kind:'appointments'})),...(entries.tasks||[]).filter(x=>!x.deleted&&x.date===date).map(x=>({...x,kind:'tasks',time:''}))].sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));}
// Never infer historical unrecorded doses from today's prescription: schedules can change.
export function weekRecording(entries,today){return Array.from({length:7},(_,i)=>{const date=shiftDate(today,i-6),events=(entries.doseEvents||[]).filter(x=>x.day===date);return {date,given:events.filter(x=>x.status==='given').length,notGiven:events.filter(x=>x.status==='not-given').length,corrected:events.filter(x=>x.status==='corrected').length,unrecorded:date===today?timeline(entries,date).filter(x=>x.kind==='medications'&&!x.event).length:null};});}
