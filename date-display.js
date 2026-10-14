export const dateFormats=[['named','اسم الشهر'],['numeric','يوم / شهر / سنة'],['year-first','سنة / شهر / يوم']];
export function calendarDateParts(iso,calendar='gregory'){
 const d=new Date(`${iso}T12:00:00Z`);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==iso)return null;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('ar-SA',{calendar,numberingSystem:'latn',timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).formatToParts(d).map(x=>[x.type,x.value]));
 const numbers=Object.fromEntries(new Intl.DateTimeFormat('en',{calendar,numberingSystem:'latn',timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(d).map(x=>[x.type,x.value]));
 return {...parts,numericMonth:numbers.month,numericDay:numbers.day};
}
export function dualDates(iso,format='named'){
 const one=calendar=>{const p=calendarDateParts(iso,calendar);if(!p)return '';return format==='numeric'?`${p.numericDay} / ${p.numericMonth} / ${p.year}`:format==='year-first'?`${p.year} / ${p.numericMonth} / ${p.numericDay}`:`${p.day} ${p.month} ${p.year}`;};
 return {hijri:one('islamic-umalqura'),gregorian:one('gregory')};
}
export function clockTime(value=new Date(),timeZone='Asia/Riyadh'){return new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23',numberingSystem:'latn'}).format(value);}
