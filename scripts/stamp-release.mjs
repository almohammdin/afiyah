import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname,join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
export async function stampAssets(root,version){
 const files=[];
 async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){
  if(['node_modules','.git','tests','scripts','preview','public'].includes(item.name))continue;
  const path=join(dir,item.name);
  if(item.isDirectory())await walk(path);else if(/\.(js|css|html)$/.test(item.name))files.push(path);
 }}
 await walk(root);
 for(const file of files){let source=await readFile(file,'utf8');
  // Stamp only quoted local JS/CSS URLs that resolve to real files.
  const refs=[...source.matchAll(/(["'])([^"'\s<>]+\.(?:js|css))(?:\?[^"'\s<>]*)?\1/g)];
  for(const match of refs){const path=match[2];if(/^(?:[a-z]+:|\/\/|\/)/i.test(path))continue;
   const target=resolve(dirname(file),path);if(relative(resolve(root),target).startsWith('..'))continue;
   if(!await stat(target).then(s=>s.isFile()).catch(()=>false))continue;
   source=source.replaceAll(match[0],match[1]+path+'?v='+version+match[1]);
  }
  await writeFile(file,source);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const file=process.argv[2]||'public/footer.js',build=process.env.GITHUB_RUN_NUMBER;
 if(!/^\d+$/.test(build||''))throw Error('Missing release build number');
 const source=await readFile(file,'utf8');
 if(!source.includes('data-release>'))throw Error('Missing visible release label');
 await writeFile(file,source.replace(/data-release>[^<]+</,'data-release>1.0.'+build+'<'));
 await stampAssets(dirname(file),'release-'+build);
}
