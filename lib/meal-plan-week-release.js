(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;if(root)root.BalanceMealRelease=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
function dateKey(now){return new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
function releaseDate(plan,week){if(!/^\d{4}-\d{2}-\d{2}$/.test(plan?.weekly_release_start||''))return null;const d=new Date(plan.weekly_release_start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+(Number(week)-1)*7);return d.toISOString().slice(0,10);}
function available(plan,week,now=new Date()){const release=releaseDate(plan,week);return !release||dateKey(now)>=release;}
function current(plan,now=new Date()){return (plan?.weeks||[]).filter(w=>available(plan,w.week_number,now)).at(-1)?.week_number||1;}
function label(plan,week){const date=releaseDate(plan,week);return date?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',day:'numeric',month:'long'}).format(new Date(date+'T00:00:00Z')):'';}
return {available,current,releaseDate,label};
});
