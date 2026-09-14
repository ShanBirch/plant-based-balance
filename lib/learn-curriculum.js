(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BalanceLearnCurriculum = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const unit = id => Array.from({length:5}, (_,i) => id + '-' + (i+1));
  const food = ['fuel-1-2','fuel-2-2','fuel-2-3','fuel-2-4','fuel-5-5'];
  const week = (title, description, lessonIds, action) => ({title, description, lessonIds, action});
  const original = [
    week('Why change feels hard','See how past experience shapes expectations and how new evidence can change them.',unit('mind-1'),1),
    week('Work with your energy','Understand how sleep, stress and bodily needs influence your choices.',unit('mind-2'),2),
    week('Build a rhythm that sticks','Use small actions and repetition to practise a helpful routine.',unit('mind-4'),3),
    week('Take the fight out of food','Understand cravings and the context around eating without judging yourself.',unit('fuel-6'),4),
    week('Make progress easier to repeat','Shape routines, surroundings and support around the choices you want to repeat.',unit('mind-6'),5),
    week('Build your sustainable way forward','Bring energy, protein, carbohydrates and fats together in a flexible meal.',food,6)
  ];
  const experience = week('Experience shapes reality','Follow one gym experience through sensory signals, learned concepts, emotion and context.',unit('mind-3'),7);
  const freeEnergy = week('The prediction-action loop','Explore the free-energy principle: infer what is happening, weigh the evidence and act to learn or meet a need.',unit('mind-7'),8);
  const learning = week('What actually is learning?','Follow the model update: expectation, surprising evidence, confidence weighting and a changed prediction next time.',unit('mind-8'),9);
  const fresh = [original[0], experience, freeEnergy, original[1], learning,
    week('Make change repeatable','Connect small repeated actions with an environment and support system that help you practise.',[...unit('mind-4'),...unit('mind-6')],5),original[3],original[5]];
  const bridge = [...original,
    week('Experience and the prediction-action loop','Build on your first six weeks: explore how experience is constructed, then how perception and action work together.',[...unit('mind-3'),...unit('mind-7')],8),learning];
  // Six-week default: retain original week/action order and add the brain units in context.
  const six = original.map((w,i) => ({...w,lessonIds:[...w.lessonIds,...(i===0?unit('mind-3'):i===1?unit('mind-7'):i===2?unit('mind-8'):[])]}));
  six[0].description='See why change feels hard and how past experience shapes perception, expectations and emotion.';
  six[1].description='Connect sleep, stress and bodily needs with the prediction-action loop and free-energy principle.';
  six[2].description='Understand what learning actually is: test a small change, weigh surprising evidence and update what you expect next time.';
  function version(row) {
    const saved = row?.settings?.learn_curriculum;
    if (['six_v2','eight_v1','bridge_eight_v1','legacy_six'].includes(saved)) return saved;
    return 'six_v2';
  }
  function weeks(value='six_v2') {
    const v = typeof value==='string' ? value : version(value);
    return (v==='legacy_six'?original:v==='bridge_eight_v1'?bridge:v==='eight_v1'?fresh:six).map((w,i)=>({...w,number:i+1,lessonIds:[...w.lessonIds]}));
  }
  function actionIndex(number, value) { return weeks(value)[Number(number)-1]?.action; }
  function owner(id,value) { return weeks(value).find(w=>w.lessonIds.includes(id)); }
  return {version,weeks,actionIndex,owner,total:value=>weeks(value).length,original};
});
