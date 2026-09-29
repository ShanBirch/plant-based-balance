// Carry real campaign evidence between public pages and the consultation.
(() => {
 const params=new URLSearchParams(location.search);
 const keys=['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','campaign_id','adset_id','ad_id','creative_id','placement','site_source_name','meta_ad_name','meta_ref'];
 const destinations=new Set(['/','/bio','/balance','/founders','/plant-based-fitness','/plant-based-challenge','/coaching','/fitness','/fitness-coaching','/book']);
 for(const link of document.querySelectorAll('a[href]')) {
 const url=new URL(link.href,location.origin);
 if(url.origin!==location.origin || !destinations.has(url.pathname.replace(/\.html$/,'')))continue;
 for(const key of keys)if(params.has(key)&&!url.searchParams.has(key))url.searchParams.set(key,params.get(key).slice(0,700));
 if(params.get('analytics_test')==='1')url.searchParams.set('analytics_test','1');
 link.href=url.pathname+url.search+url.hash;
 }
})();
