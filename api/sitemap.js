const {readProducts,uuid}=require('../server/catalog.cjs');
module.exports=async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;res.setHeader('Allow','GET, HEAD');return res.end();}
 try{const products=await readProducts();res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','public, max-age=300');
 const urls=['https://printx-eg.com/',...products.filter(p=>uuid.test(p.id)).map(p=>'https://printx-eg.com/products/'+p.id)];
 res.end(req.method==='HEAD'?'':'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>'<url><loc>'+url+'</loc></url>').join('')+'</urlset>');
 }catch(_){res.statusCode=503;res.setHeader('Cache-Control','no-store');res.end('Catalog unavailable');}
};
