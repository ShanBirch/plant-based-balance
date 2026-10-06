(function(root,factory){
    const api=factory(root);
    if(typeof module==='object'&&module.exports) module.exports=api;
    else root.BalancePersonalisedLearn=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
    'use strict';
    const PROFILE='family_lower_carb_v1';
    const enabled=()=>!!root.currentUser?.id&&!root.guestMode&&root.currentUser.user_metadata?.balance_learning_profile===PROFILE;
    const rows=[
        ['fuel-1-2','Energy balance without counting',
            `Your body uses energy for everyday life, movement and recovery. Over time, the relationship between energy eaten and energy used influences weight. A daily scale reading also reflects fluid, digestion and other changes; it cannot tell you exactly how much body fat changed.\n\nYou do not need to count calories for this coaching phase. Start with regular, satisfying meals, familiar protein foods and vegetables. Notice hunger, fullness, energy and how the routine fits family life, then discuss the pattern at your check-in.\n\nA lower-carbohydrate preference is one way to organise meals, not a guarantee of weight loss. Portion sizes, food choices and the pattern you can repeat still matter. Avoid making the meal so small that you are hungry and struggling later.\n\nPractical example: cook one mince-and-vegetable filling. Serve yours in lettuce cups, and let family members use shells or another side. Try the meal, then record what you actually ate, how satisfied you felt and what you would adjust. No calorie target is required.`,
            'Use repeatable meals and feedback to guide changes; calorie counting is not required for this phase.',
            [
                ['What is useful feedback after trying a family meal?',['Hunger, satisfaction, energy and how the meal worked','Only the calorie total','Whether everyone had the same portion'],0],
                ['What does a lower-carbohydrate meal guarantee?',['Weight loss regardless of portions','Nothing by itself; the overall pattern still matters','That protein and vegetables are unnecessary'],1],
                ['Which plan avoids cooking two dinners?',['Skip your dinner','Cook one filling and vary the serving base','Prepare a completely separate recipe'],1],
                ['What can a single scale reading show?',['The exact amount of body fat lost','A reading affected by fluid and digestion as well as longer-term change','Whether a meal contained enough fibre'],1]
            ]],
        ['fuel-2-2','Protein in familiar family meals',
            `Protein supplies amino acids used to maintain and repair body tissues. It supports muscle alongside appropriate resistance training, enough food and recovery. More protein does not automatically mean more muscle.\n\nUse foods you already enjoy. Mince or steak can be part of a meal; choose leaner cuts or mince when practical. Variety matters across the week, so discuss other familiar, tolerated protein foods with your coach rather than assuming every dinner must be red meat.\n\nFor a shared dinner, cook the protein and vegetables together or alongside each other. Serve different side portions at the table. Your lower-carbohydrate preference does not mean your family has to remove their usual rice, potatoes or shells.\n\nA numerical protein target has not been set here. Begin by including a familiar protein food in your meals, notice whether the meal satisfies you, and discuss portions and any food restrictions with your coach.`,
            'Build meals around familiar protein foods, include variety and adjust the sides without cooking twice.',
            [
                ['What does protein provide?',['Amino acids used by the body','A replacement for sleep','Guaranteed muscle growth'],0],
                ['Which approach suits one family dinner?',['Shared protein and vegetables with flexible sides','Everyone must follow identical portions','Only you eat a separate meal'],0],
                ['What supports muscle alongside protein?',['Appropriate training and recovery','Skipping all carbohydrate foods','Eating the largest possible protein portion'],0],
                ['What is the sensible next step before setting exact portions?',['Invent a target from another person','Discuss needs and food restrictions with your coach','Assume no allergies exist'],1]
            ]],
        ['fuel-2-3','Carbohydrates and your lower-carb preference',
            `Carbohydrates are a source of energy. They are found in foods such as fruit, grains, potatoes, legumes and milk. Foods containing carbohydrate can also provide fibre and other nutrients; carbohydrate is not a single category of good or bad foods.\n\nYour preference is lower carb, not a prescribed ketogenic diet. There is no fixed carbohydrate allowance in this course. Keep a range of vegetables and discuss which other foods fit your appetite, activity and preferences.\n\nFor taco night, use the same mince-and-vegetable filling: lettuce cups for you, shells for family members who want them. For steak and vegetables, put potatoes or another side on the table so each person can choose their serving.\n\nNotice energy during your usual classes, recovery and hunger later in the day. If the routine leaves you drained or persistently hungry, tell your coach so you can adjust it. Do not judge success only by how much carbohydrate you removed.`,
            'Lower carb can be a flexible serving preference while retaining variety, enough food and useful feedback.',
            [
                ['What has been prescribed here?',['A strict ketogenic allowance','No fixed carbohydrate allowance','Zero carbohydrates for the family'],1],
                ['Which is a practical taco-night swap?',['Shared filling, lettuce cups for you and shells for others','No filling for you','Two different dinners from scratch'],0],
                ['Why consider foods beyond their carbohydrate content?',['They may also supply fibre and other nutrients','All carbohydrate foods are identical','Fibre is irrelevant'],0],
                ['What should you report at check-in?',['Energy, recovery and hunger','Only how many foods you removed','Nothing unless the scale falls'],0]
            ]],
        ['fuel-2-4','Fats, flavour and satisfying meals',
            `Fat has important roles in the body and helps with absorption of fat-soluble vitamins. It also supplies energy. A lower-carbohydrate meal is not a reason to add unlimited oil, cheese or rich sauces.\n\nUse fats to make familiar meals enjoyable. Cooking oil, nuts, avocado and other foods can contribute unsaturated fats. Choose ingredients you tolerate and enjoy, and vary your foods across the week.\n\nWith mince or steak and vegetables, use a modest amount of cooking oil and offer sauces separately. Family members can add their preferred side without changing the shared main dish.\n\nPay attention to the whole meal: protein, vegetables, flavour and enough food to feel satisfied. Exact fat targets and calorie counting are not required for this coaching phase. Bring any food restrictions to your coach before adding unfamiliar ingredients.`,
            'Fat belongs in a varied meal; lower carb does not mean unlimited fat or a separate family dinner.',
            [
                ['What is one role of dietary fat?',['Helping absorb fat-soluble vitamins','Replacing all protein','Preventing every symptom'],0],
                ['Does lower carb mean unlimited added fat?',['Yes, portions no longer matter','No, the whole eating pattern still matters','Only when eating steak'],1],
                ['What keeps a family meal flexible?',['Serving sauces and sides separately','Removing everyone’s preferred sides','Making a second dinner'],0],
                ['What should guide ingredient choices?',['Taste, variety and confirmed tolerance','Assuming unfamiliar ingredients are safe','A rigid rule copied from someone else'],0]
            ]],
        ['fuel-5-5','One family meal, your sustainable way forward',
            `A sustainable meal routine should fit your life. You cook for the whole family and prefer basic foods: mince, steak and vegetables. Build from those familiar meals instead of creating a second menu for yourself.\n\nChoose a shared protein-and-vegetable base. Put sides on the table so you can choose a lower-carbohydrate serving while family members keep the sides they enjoy. Examples include taco filling with lettuce cups or shells, mince-and-vegetable sauce with vegetables or pasta, and steak with vegetables and optional potatoes.\n\nVary meals across the week and keep enough food to support daily life and training. These examples are a meal-building framework, not a full nutritional prescription. Food allergies, intolerances and other preferences still need to be confirmed.\n\nYour practical task is to cook and eat one shared family meal. Record the shared base, your serving swap, how satisfied you felt and what worked for the family. Review the real attempt with your coach and choose one adjustment to repeat. You do not need a calorie target to complete the attempt.`,
            'Cook one shared meal, vary the serving base, and use the real experience to refine a routine you can repeat.',
            [
                ['What is the practical task?',['Cook and eat a shared meal, then record the experience','Only plan a meal without trying it','Calculate a calorie target'],0],
                ['Which detail belongs in the reflection?',['Your serving swap and how it worked','An invented allergy-free claim','Only the recipe title'],0],
                ['What does this framework provide?',['A flexible way to build familiar meals','A guarantee of weight loss','A complete prescription for every nutrient'],0],
                ['What makes the next adjustment useful?',['It responds to the meal you actually tried','It makes the family cook twice','It removes as much food as possible'],0]
            ]]
    ];
    const adaptations=Object.fromEntries(rows.map(([id,title,intro,keyPoint,questions])=>[id,{id,title,intro,keyPoint,questions}]));
    const ids=()=>root.BalanceLearnCurriculum?.weeks('six_v2').flatMap(w=>w.lessonIds)||[];
    function lesson(original){
        if(!enabled())return original;
        if(!ids().includes(original?.id))return null;
        const row=adaptations[original.id];
        if(!row)return original;
        const games=row.questions.map(([question,options,correctIndex])=>({type:'scenario_story',scenario:'Apply this lesson to your everyday meals.',question,options,correctIndex,explanation:options[correctIndex]}));
        games.push(
            {type:'swipe_true_false',question:'Everyone in the family must eat identical portions.',answer:false,explanation:'Share the meal base and vary servings to fit each person.'},
            {type:'swipe_true_false',question:'You need a calorie target to try the shared-meal routine in this course.',answer:false,explanation:'Record the real meal experience without calorie counting.'},
            {type:'swipe_true_false',question:'Food preferences and confirmed tolerances matter when choosing ingredients.',answer:true,explanation:'Use familiar foods and confirm restrictions before adding ingredients.'},
            {type:'fill_blank',sentence:'A useful check-in describes what you actually _______.',options:['tried','imagined','guaranteed','avoided'],answer:'tried'}
        );
        return {...original,title:row.title,content:{intro:row.intro,keyPoint:row.keyPoint},games,personalised:true};
    }
    const menopauseWeeks=[
        {number:1,title:'Understand the transition',topics:['What menopause is and how symptoms vary','Patterns to record and when to seek care','Sleep, mood and everyday support']},
        {number:2,title:'Food, muscle and bone',topics:['Diet-inclusive meal foundations','Muscle, bone and movement','Nutrients and questions for your care team']},
        {number:3,title:'Symptoms, evidence and options',topics:['Read symptom-relief evidence and its limitations','Compare claims without promised outcomes','Discuss hormonal and non-hormonal options with your clinician']},
        {number:4,title:'Build your ongoing routine',topics:['A realistic routine for food, movement and recovery','Prepare questions and a symptom record','Review what helped and plan follow-up care']}
    ];
    function catalog(){return {type:'planned',id:'balance-menopause',title:'Balance Menopause',subtitle:'Four-week component after Balance Learn',description:'Your planned next course: understanding the transition, everyday food and movement, evidence and informed care. Lessons are awaiting clinical review and are not available yet.',accent:'#b8892b',number:2,progress:{completed:0,total:4,percent:0,isComplete:false},isUnlocked:false,previousTitle:'Clinical review',meta:'4 planned weeks · Not released'};}
    function openPlanned(){
        if(!enabled())return false;
        const view=root.document.getElementById('view-learning');
        view?.classList.add('menopause-active');
        const container=root.document.getElementById('learning-content');
        if(!container)return false;
        container.scrollTop=0;
        container.innerHTML='<div class="menopause-page"><header><small>Balance Menopause · Planned course</small><h2>Four weeks after Balance Learn</h2><p>Lessons are not released. Clinical review and the diet-inclusive content adaptation must be completed before access can open.</p></header><div class="menopause-note">This is your planned course outline. It does not contain the private review lessons or prescribe treatment.</div>'+menopauseWeeks.map(w=>'<section><h3>Week '+w.number+': '+w.title+'</h3><ul>'+w.topics.map(t=>'<li>'+t+'</li>').join('')+'</ul></section>').join('')+'<button onclick="window.backToCourseLibrary()">View your courses</button></div>';
        return true;
    }
    return {enabled,lesson,catalog,openPlanned,menopauseWeeks,profile:PROFILE,adaptations};
});
