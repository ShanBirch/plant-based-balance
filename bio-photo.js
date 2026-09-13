(function(){
  'use strict';
  var themeButton=document.getElementById('bio-theme');
  var theme='light';
  try{var saved=localStorage.getItem('userThemePreference');if(saved==='dark'||saved==='antigravity')theme='dark';}catch(_){}
  function paint(){document.documentElement.dataset.theme=theme;themeButton.setAttribute('aria-label','Switch to '+(theme==='light'?'dark':'light')+' theme');}
  paint();
  themeButton.addEventListener('click',function(){theme=theme==='light'?'dark':'light';paint();try{localStorage.setItem('userThemePreference',theme);}catch(_){}});
  var params=new URLSearchParams(location.search);
  var keys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','campaign_id','adset_id','ad_id','creative_id'];
  var touch={};keys.forEach(function(key){if(params.has(key))touch[key]=params.get(key).slice(0,256);});
  try{if(Object.keys(touch).length){if(!localStorage.getItem('balance_first_touch'))localStorage.setItem('balance_first_touch',JSON.stringify(touch));localStorage.setItem('balance_last_touch',JSON.stringify(touch));}}catch(_){}
  function track(step,status){if(location.hostname==='localhost'||location.hostname==='127.0.0.1')return;window.BalanceOnboardingFunnel?.track('entry',step,status,{mode:'bio_photo_v1'});}
  document.querySelectorAll('[data-bio-link]').forEach(function(link){
    var target=new URL(link.href);keys.forEach(function(key){if(params.has(key))target.searchParams.set(key,params.get(key));});link.href=target.href;
    link.addEventListener('click',function(){track('bio_'+link.dataset.bioLink,'completed');});
  });
  track('bio_landing','viewed');
})();
