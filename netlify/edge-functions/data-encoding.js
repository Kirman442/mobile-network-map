import {COUNTRIES} from '../../src/components/data/countries.js';
const countryKeys = new Set(COUNTRIES.map(country => country.key));

// Explicit encoded URLs avoid subrequests/rewrites: next() serves the same static asset.
export default async function dataEncoding(request,context){
  const match=new URL(request.url).pathname.match(/^\/data\/([a-z_]+)\.(arrow(?:\.(gz|br))?|parquet)$/);
  if(!match)return;
  if(!countryKeys.has(match[1]))return new Response('Unknown country',{status:404});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
  const response=await context.next();
  if(response.status!==200)return response;
  const encoding=match[3]==='gz'?'gzip':match[3]==='br'?'br':'identity';
  const originEncoding=response.headers.get('content-encoding');
  if(originEncoding&&originEncoding!=='identity')return new Response('Unexpected origin compression',{status:502});
  const headers=new Headers(response.headers);
  headers.set('Content-Encoding',encoding);
  headers.set('Content-Type',match[2].startsWith('arrow')?'application/vnd.apache.arrow.file':'application/octet-stream');
  headers.set('Cache-Control','no-store, no-transform');
  headers.set('Timing-Allow-Origin','*');
  headers.set('X-Content-Type-Options','nosniff');
  // Only streaming headers change; no decompression/recompression or buffering here.
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
}
