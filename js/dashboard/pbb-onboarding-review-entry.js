(function(){
 'use strict';
 function refresh(){
  const button=document.getElementById('settings-onboarding-review');if(!button)return;
  const allowed=window.currentUser?.id==='00a6605e-8edb-4917-85ba-24a23f179059';
  button.innerHTML=allowed?'<span>🌸</span>View onboarding':'<span>🌸</span>Restart onboarding setup';
  if(allowed&&new URLSearchParams(location.search).get('review_return')==='settings'&&typeof window.switchTab==='function'){
   window.switchTab('profile');history.replaceState(null,'','/dashboard.html');
  }
 }
 window.openOnboardingReview=()=>{
  if(window.currentUser?.id==='00a6605e-8edb-4917-85ba-24a23f179059')location.assign('/dashboard.html?onboarding_replay=1');
  else window.initOnboardingWizard?.();
 };
 document.addEventListener('DOMContentLoaded',refresh);document.addEventListener('pbbInitComplete',refresh);window.addEventListener('focus',refresh);
})();
