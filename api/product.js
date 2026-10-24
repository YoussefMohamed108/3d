const fs=require('node:fs/promises');
const path=require('node:path');
const catalog=require('../server/catalog.cjs');
module.exports=async(req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
 if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;res.setHeader('Allow','GET, HEAD');return res.end();}
 const id=typeof req.query.id==='string'?req.query.id:'';
 if(!catalog.uuid.test(id)){res.statusCode=404;return res.end(req.method==='HEAD'?'':catalog.errorPage(404));}
 try{const [products,content,shell]=await Promise.all([catalog.readProducts(id),catalog.readContent(),fs.readFile(path.join(process.cwd(),'index.html'),'utf8')]);
 if(!products[0]){res.statusCode=404;return res.end(req.method==='HEAD'?'':catalog.errorPage(404));}
 const canonicalPath=catalog.productPath(products[0]);
 let requestedSlug=typeof req.query.slug==='string'?req.query.slug:'';
 try { requestedSlug=decodeURIComponent(requestedSlug); } catch (_) { requestedSlug=''; }
 if(requestedSlug!==catalog.slug(products[0].name)){
  const params=new URL(req.url||'/', 'https://printx-eg.com').searchParams;
  params.delete('id');params.delete('slug');
  const suffix=params.toString();
  res.statusCode=308;res.setHeader('Location',canonicalPath+(suffix?'?'+suffix:''));
  return res.end();
 }
 const html=catalog.renderProduct(shell,products[0],content);return res.end(req.method==='HEAD'?'':html);
 }catch(_){res.statusCode=503;res.setHeader('Retry-After','60');return res.end(req.method==='HEAD'?'':catalog.errorPage(503));}
};
