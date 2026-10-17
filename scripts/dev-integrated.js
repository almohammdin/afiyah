// Serves the actual application unchanged; no Firebase adapter replacement.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.pdf':'application/pdf'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');const path=decodeURIComponent(url.pathname).replace(/^\/afiyah(?=\/)/,'');const file=resolve(root,'.'+(path==='/'?'/index.html':path));
 if(!file.startsWith(root+'/')||/(?:^|\/)(?:\.[^/]+|node_modules)(?:\/|$)/.test(path)||!types[extname(file)]){res.writeHead(404);res.end();return;}
 const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-store'});res.end(body);
}catch{res.writeHead(404);res.end()}}).listen(Number(process.env.PORT)||4173,'0.0.0.0');
