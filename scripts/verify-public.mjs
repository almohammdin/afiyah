import {readFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const root=resolve(process.argv[2]||'public'),seen=new Set();
async function check(file){
 if(seen.has(file))return;seen.add(file);
 await access(file);
 const source=await readFile(file,'utf8');
 const pattern=file.endsWith('.html')?/<script\b[^>]*\bsrc=["']([^"']+)["']/g:/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.[^"']+)["']/g;
 for(const match of source.matchAll(pattern)){
  const relative=match[1].split(/[?#]/)[0];
  if(relative.startsWith('http'))continue;
  const target=resolve(dirname(file),relative);
  try{await check(target);}catch(error){throw new Error(`Missing or invalid dependency ${relative} imported by ${file}`,{cause:error});}
 }
}
await check(resolve(root,'index.html'));
console.log(`Verified ${seen.size} published HTML/JavaScript files`);
