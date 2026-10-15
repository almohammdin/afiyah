import {readFile,writeFile} from 'node:fs/promises';
const file=process.argv[2]||'public/footer.js';
const build=process.env.GITHUB_RUN_NUMBER;
if(!/^\d+$/.test(build||''))throw Error('Missing release build number');
const source=await readFile(file,'utf8');
if(!source.includes('data-release>'))throw Error('Missing visible release label');
await writeFile(file,source.replace(/data-release>[^<]+</,'data-release>1.0.'+build+'<'));
