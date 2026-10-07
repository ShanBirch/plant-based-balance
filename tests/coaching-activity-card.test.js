const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Wednesday coaching hero retains its title and duration without a workout-library entry',()=>{
 const source=fs.readFileSync('js/dashboard/dashboard-script-5-initialize_stripe_for_inapp_pu.js','utf8');
 const start=source.indexOf('    if (usingCustomProgram && (scheduleItem.isRest');const end=source.indexOf('    // Check if this is a Cycle Sync personalization',start);
 const context={usingCustomProgram:true,scheduleItem:{customWorkout:{type:'activity',name:'Zoom PT',duration:'45 min'}},suggestedProgram:'activity',wasOverriddenToYoga:false,customProgramInfo:{name:'Coaching plan'},assets:{recovery:{}},heroSched:null,heroProg:null,heroMeta:null,heroRestDay:false,heroActivityWorkout:null,heroLibraryInfo:null,heroInlineWorkout:null,window:{WORKOUT_DB:{}},overrideSubcategory:null};
 vm.runInNewContext(source.slice(start,end),context);
 assert.equal(context.heroSched.title,'Zoom PT');assert.equal(context.heroProg.estimatedTime,45);assert.equal(context.heroActivityWorkout.name,'Zoom PT');
});
