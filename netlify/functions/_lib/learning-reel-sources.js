const LEARNING_REEL_TOPIC_LABELS = {
    plant_based_cooking: 'Plant-based cooking',
    macronutrient_science: 'Macros',
    micronutrient_science: 'Vitamins & minerals',
    behavior_change_science: 'Behaviour change',
    mindset: 'Mindset',
    neuroscience: 'Neuroscience',
    longevity: 'Longevity',
    workout_motivation: 'Workout motivation',
    weight_training_technique: 'Weight training technique',
    meal_prep_planning: 'Meal prep & planning',
    protein_science: 'Protein',
    supplements: 'Supplements',
    recovery_sleep_energy: 'Recovery, sleep & energy',
    fat_loss_basics: 'Fat loss',
    muscle_gain_basics: 'Muscle growth'
};

const SUBSCRIBER_TIER_SCORE = {
    '20m+': 36,
    '10m+': 34,
    '8m+': 32,
    '7m+': 31,
    '6m+': 30,
    '4m+': 28,
    '3m+': 25,
    '1m+': 21,
    '750k+': 18,
    '500k+': 15,
    '250k+': 12,
    '100k+': 9,
    academic: 18,
    expert: 14
};

const TOPIC_KEYWORD_RE = {
    plant_based_cooking: /\b(plant|vegan|vegetarian|recipe|meal|cook|cooking|lentil|tofu|beans?|tempeh|protein)\b/i,
    macronutrient_science: /\b(macro|macronutrient|calorie|protein|carb|carbs|fat|fats|energy balance|nutrition)\b/i,
    micronutrient_science: /\b(micronutrient|vitamin|mineral|iron|b12|calcium|zinc|iodine|omega|nutrient)\b/i,
    behavior_change_science: /\b(behaviou?r|habit|tiny habit|behavior design|identity|consistency|motivation|discipline|prompt)\b/i,
    mindset: /\b(mindset|motivation|emotion|confidence|identity|habit|consistency|resilience|lisa feldman barrett|huberman|fogg)\b/i,
    neuroscience: /\b(neuro|brain|dopamine|emotion|prediction|predictive|barrett|huberman|nervous system)\b/i,
    longevity: /\b(longevity|healthspan|lifespan|aging|ageing|metabolic|zone 2|vo2|sleep|recovery|cardio|microbiome)\b/i,
    workout_motivation: /\b(workout|training|train|motivation|discipline|consistency|habit|excuse|energy|show up|start|identity|dopamine)\b/i,
    weight_training_technique: /\b(form|technique|squat|deadlift|bench|press|row|hinge|lunge|training|lifting|mobility)\b/i,
    meal_prep_planning: /\b(meal prep|meal planning|prep|batch|weekly meals|recipe|plant|vegan|protein)\b/i,
    protein_science: /\b(protein|amino|leucine|muscle protein|plant protein|vegan protein|protein intake|hypertrophy)\b/i,
    supplements: /\b(supplement|creatine|b12|iron|omega|algae|vitamin|mineral|protein powder|evidence)\b/i,
    recovery_sleep_energy: /\b(recovery|sleep|energy|fatigue|stress|deload|soreness|nervous system|circadian|mobility)\b/i,
    fat_loss_basics: /\b(fat loss|weight loss|calorie|deficit|dieting|satiety|sustainable|maintenance|energy balance)\b/i,
    muscle_gain_basics: /\b(muscle|hypertrophy|strength|progressive overload|protein|training|volume|reps)\b/i
};

const LEARNING_REEL_BLOCKLIST_RE = /\b(detox|cleanse|miracle|belly fat|fat burner|carnivore|liver king|medical medium|dr\.?\s*berg|gary brecka|alkaline|parasite cleanse|adrenal fatigue|hormone reset|cortisol face|ozempic alternative|ice hack|hack your|age backwards|anti[-\s]?aging secrets?|lose \d+\s*(?:kg|kilos?|pounds?|lbs?)|after 50|fitfixen)\b/i;

const CURATED_LEARNING_REEL_SOURCES = [
    {
        id: 'pick_up_limes',
        channelTitle: 'Pick Up Limes',
        channelId: 'UCq2E1mIwUKMWzCA4liA_XGQ',
        handle: '@PickUpLimes',
        subscriberTier: '4m+',
        qualityScore: 94,
        sourceKind: 'plant_based_practical',
        profileUrl: 'https://www.youtube.com/@PickUpLimes',
        aliases: ['pick up limes', 'pickuplimes'],
        topics: {
            plant_based_cooking: ['high protein vegan meals', 'plant based cooking tips', 'healthy vegan recipes'],
            meal_prep_planning: ['vegan meal prep', 'weekly plant based meals', 'healthy meal planning']
        }
    },
    {
        id: 'rainbow_plant_life',
        channelTitle: 'Rainbow Plant Life',
        channelId: 'UCDbZvuDA_tZ6XP5wKKFuemQ',
        handle: '@RainbowPlantLife',
        subscriberTier: '1m+',
        qualityScore: 92,
        sourceKind: 'plant_based_practical',
        profileUrl: 'https://www.youtube.com/@RainbowPlantLife',
        aliases: ['rainbow plant life', 'rainbowplantlife'],
        topics: {
            plant_based_cooking: ['high protein vegan recipes', 'easy vegan meals', 'lentil tofu beans recipes'],
            meal_prep_planning: ['vegan meal prep', 'batch cooking vegan', 'weekly plant based meals']
        }
    },
    {
        id: 'simnett_nutrition',
        channelTitle: 'Simnett Nutrition',
        channelId: 'UCpyhJZhJQWKDdJCR07jPY-Q',
        handle: '@SimnettNutrition',
        subscriberTier: '750k+',
        qualityScore: 88,
        sourceKind: 'plant_based_fitness',
        profileUrl: 'https://www.youtube.com/@SimnettNutrition',
        aliases: ['simnett nutrition', 'simnettnutrition', 'derek simnett'],
        topics: {
            plant_based_cooking: ['high protein vegan meals', 'plant based fitness meals'],
            meal_prep_planning: ['easy vegan meal prep', 'high protein vegan prep'],
            protein_science: ['plant based protein tips', 'vegan protein intake'],
            muscle_gain_basics: ['vegan muscle gain', 'plant based muscle building']
        }
    },
    {
        id: 'nutritionfacts',
        channelTitle: 'NutritionFacts.org',
        channelId: 'UCddn8dUxYdgJz3Qr5mjADtA',
        handle: '@NutritionFactsOrg',
        subscriberTier: '1m+',
        qualityScore: 96,
        sourceKind: 'evidence_nutrition',
        profileUrl: 'https://www.youtube.com/@NutritionFactsOrg',
        aliases: ['nutritionfacts.org', 'nutritionfacts org', 'nutrition facts', 'nutritionfacts'],
        topics: {
            plant_based_cooking: ['whole food plant based meals', 'plant based nutrition basics'],
            micronutrient_science: ['b12 iron calcium vegan', 'vitamins minerals plant based', 'micronutrients'],
            longevity: ['longevity nutrition', 'healthspan diet', 'plant based longevity'],
            protein_science: ['plant protein', 'protein quality', 'amino acids plant based'],
            supplements: ['b12 supplement', 'omega 3 supplement', 'iron zinc iodine vegan'],
            fat_loss_basics: ['whole food plant based weight loss', 'calorie density']
        }
    },
    {
        id: 'the_proof',
        channelTitle: 'The Proof with Simon Hill',
        channelId: 'UChRSPNKMRhZxBmbivC8L_FA',
        handle: '@TheProofWithSimonHill',
        subscriberTier: '100k+',
        qualityScore: 91,
        sourceKind: 'plant_based_science',
        profileUrl: 'https://www.youtube.com/@TheProofWithSimonHill',
        aliases: ['the proof with simon hill', 'the proof', 'simon hill', 'plant proof', 'the proof clips'],
        topics: {
            macronutrient_science: ['protein carbohydrates fats explained', 'nutrition science macros'],
            micronutrient_science: ['plant based micronutrients', 'omega 3 b12 iron'],
            longevity: ['plant based longevity', 'cardiometabolic health', 'healthspan nutrition'],
            protein_science: ['protein debate', 'plant protein muscle', 'protein intake'],
            supplements: ['creatine b12 omega 3', 'supplements evidence'],
            fat_loss_basics: ['sustainable weight loss nutrition', 'calorie deficit plant based']
        }
    },
    {
        id: 'jeff_nippard',
        channelTitle: 'Jeff Nippard',
        channelId: 'UC68TLK0mAEzUyHx5x5k-S1Q',
        handle: '@JeffNippard',
        subscriberTier: '7m+',
        qualityScore: 92,
        sourceKind: 'evidence_fitness',
        profileUrl: 'https://www.youtube.com/@JeffNippard',
        aliases: ['jeff nippard', 'jeffnippard'],
        topics: {
            macronutrient_science: ['macros explained', 'protein carbs fat', 'calorie deficit'],
            workout_motivation: ['workout motivation', 'training consistency', 'stay consistent lifting'],
            weight_training_technique: ['exercise form', 'lifting technique', 'best exercises'],
            protein_science: ['protein intake', 'protein timing', 'muscle protein synthesis'],
            fat_loss_basics: ['fat loss basics', 'calorie deficit', 'dieting science'],
            muscle_gain_basics: ['hypertrophy basics', 'progressive overload', 'build muscle']
        }
    },
    {
        id: 'renaissance_periodization',
        channelTitle: 'Renaissance Periodization',
        channelId: 'UCfQgsKhHjSyRLOp9mnffqVg',
        handle: '@RenaissancePeriodization',
        subscriberTier: '3m+',
        qualityScore: 90,
        sourceKind: 'evidence_fitness',
        profileUrl: 'https://www.youtube.com/@RenaissancePeriodization',
        aliases: ['renaissance periodization', 'rp strength', 'dr mike israetel', 'mike israetel'],
        topics: {
            macronutrient_science: ['macros explained', 'nutrition for fat loss', 'dieting basics'],
            workout_motivation: ['training motivation', 'workout discipline', 'stay consistent training'],
            weight_training_technique: ['lifting technique', 'training form', 'exercise science'],
            protein_science: ['protein for muscle growth', 'protein intake'],
            recovery_sleep_energy: ['recovery from training', 'deloads', 'training fatigue'],
            fat_loss_basics: ['fat loss basics', 'diet fatigue', 'sustainable dieting'],
            muscle_gain_basics: ['hypertrophy training', 'muscle growth basics', 'training volume']
        }
    },
    {
        id: 'dr_layne_norton',
        channelTitle: 'Dr. Layne Norton',
        channelId: 'UCqMBA83S0TnfTlTeE5j1mgQ',
        handle: '@BioLayne',
        subscriberTier: '250k+',
        qualityScore: 88,
        sourceKind: 'evidence_nutrition',
        profileUrl: 'https://www.youtube.com/@BioLayne',
        aliases: ['dr layne norton', 'layne norton', 'biolayne', 'layne norton phd'],
        topics: {
            macronutrient_science: ['calorie deficit', 'macros nutrition', 'energy balance'],
            protein_science: ['protein intake', 'protein myths', 'protein muscle'],
            supplements: ['creatine evidence', 'supplement myths'],
            fat_loss_basics: ['fat loss calorie deficit', 'sustainable dieting'],
            muscle_gain_basics: ['muscle growth nutrition', 'protein hypertrophy']
        }
    },
    {
        id: 'precision_nutrition',
        channelTitle: 'Precision Nutrition',
        handle: '@PrecisionNutrition',
        subscriberTier: '250k+',
        qualityScore: 85,
        sourceKind: 'coaching_nutrition',
        profileUrl: 'https://www.youtube.com/@PrecisionNutrition',
        aliases: ['precision nutrition'],
        topics: {
            behavior_change_science: ['healthy habits', 'behavior change coaching', 'nutrition habits'],
            workout_motivation: ['fitness motivation habits', 'workout consistency', 'healthy habits'],
            macronutrient_science: ['macros explained', 'nutrition basics'],
            fat_loss_basics: ['sustainable fat loss', 'weight loss habits'],
            meal_prep_planning: ['meal planning habits', 'healthy meal prep']
        }
    },
    {
        id: 'squat_university',
        channelTitle: 'Squat University',
        channelId: 'UCyPYQTT20IgzVw92LDvtClw',
        handle: '@SquatUniversity',
        subscriberTier: '6m+',
        qualityScore: 90,
        sourceKind: 'technique_mobility',
        profileUrl: 'https://www.youtube.com/@SquatUniversity',
        aliases: ['squat university', 'squatuniversity'],
        topics: {
            weight_training_technique: ['squat form', 'deadlift form', 'lifting technique', 'gym form tips'],
            recovery_sleep_energy: ['mobility recovery', 'training pain', 'movement fixes']
        }
    },
    {
        id: 'athlean_x',
        channelTitle: 'ATHLEAN-X',
        handle: '@athleanx',
        subscriberTier: '10m+',
        qualityScore: 84,
        sourceKind: 'technique_strength',
        profileUrl: 'https://www.youtube.com/@athleanx',
        aliases: ['athlean x', 'athlean-x', 'athleanx', 'jeff cavaliere'],
        topics: {
            workout_motivation: ['workout excuses', 'training motivation', 'stay consistent workouts'],
            weight_training_technique: ['exercise form', 'shoulder safe lifting', 'athletic strength technique'],
            muscle_gain_basics: ['build muscle technique', 'muscle growth exercises']
        }
    },
    {
        id: 'jeremy_ethier',
        channelTitle: 'Jeremy Ethier',
        channelId: 'UCERm5yFZ1SptUEU4wZ2vJvw',
        handle: '@JeremyEthier',
        subscriberTier: '7m+',
        qualityScore: 82,
        sourceKind: 'mainstream_fitness',
        profileUrl: 'https://www.youtube.com/@JeremyEthier',
        aliases: ['jeremy ethier', 'built with science'],
        topics: {
            workout_motivation: ['workout motivation', 'training consistency'],
            weight_training_technique: ['exercise form', 'gym technique'],
            fat_loss_basics: ['fat loss basics', 'weight loss science'],
            muscle_gain_basics: ['build muscle', 'hypertrophy basics']
        }
    },
    {
        id: 'andrew_huberman',
        channelTitle: 'Andrew Huberman',
        channelId: 'UC2D2CMWXMOVWx7giW1n3LIg',
        handle: '@hubermanlab',
        subscriberTier: '7m+',
        qualityScore: 86,
        sourceKind: 'neuroscience_health',
        profileUrl: 'https://www.youtube.com/@hubermanlab',
        aliases: ['andrew huberman', 'huberman lab'],
        topics: {
            behavior_change_science: ['habits behavior change', 'motivation dopamine'],
            mindset: ['motivation habits', 'stress mindset', 'emotion regulation'],
            neuroscience: ['dopamine motivation', 'brain habits', 'nervous system'],
            workout_motivation: ['motivation dopamine', 'habits exercise', 'workout consistency'],
            longevity: ['sleep exercise longevity', 'healthspan habits'],
            recovery_sleep_energy: ['sleep tools', 'recovery sleep', 'circadian rhythm']
        }
    },
    {
        id: 'big_think',
        channelTitle: 'Big Think',
        channelId: 'UCvQECJukTDE2i6aCoMnS-Vg',
        handle: '@bigthink',
        subscriberTier: '8m+',
        qualityScore: 84,
        sourceKind: 'expert_host',
        profileUrl: 'https://www.youtube.com/@bigthink',
        aliases: ['big think', 'bigthink'],
        topics: {
            behavior_change_science: ['behavior science habits', 'psychology motivation'],
            mindset: { queries: ['lisa feldman barrett emotions', 'mindset psychology', 'confidence psychology'], priority: 28 },
            workout_motivation: ['motivation psychology', 'habit psychology', 'discipline psychology'],
            neuroscience: { queries: ['lisa feldman barrett brain emotions', 'predictive brain', 'neuroscience emotions'], priority: 32 }
        }
    },
    {
        id: 'ted_ed',
        channelTitle: 'TED-Ed',
        channelId: 'UCsooa4yRKGN_zEE8iknghZA',
        handle: '@TEDEd',
        subscriberTier: '20m+',
        qualityScore: 82,
        sourceKind: 'education_host',
        profileUrl: 'https://www.youtube.com/@TEDEd',
        aliases: ['ted ed', 'ted-ed', 'teded'],
        topics: {
            behavior_change_science: ['habit psychology', 'behavior science', 'motivation psychology'],
            mindset: ['emotions brain', 'motivation psychology', 'resilience psychology'],
            neuroscience: ['brain dopamine', 'neuroscience explained', 'how the brain works'],
            workout_motivation: ['motivation psychology', 'exercise habits', 'how motivation works'],
            longevity: ['sleep health', 'exercise health', 'aging biology']
        }
    },
    {
        id: 'ted',
        channelTitle: 'TED',
        channelId: 'UCAuUUnT6oDeKwE6v1NGQxug',
        handle: '@TED',
        subscriberTier: '20m+',
        qualityScore: 80,
        sourceKind: 'expert_host',
        profileUrl: 'https://www.youtube.com/@TED',
        aliases: ['ted'],
        topics: {
            behavior_change_science: ['behavior change', 'habit change', 'motivation psychology'],
            mindset: { queries: ['lisa feldman barrett emotions', 'resilience', 'mindset psychology'], priority: 24 },
            neuroscience: { queries: ['lisa feldman barrett emotions', 'brain emotions', 'neuroscience talk'], priority: 24 }
        }
    },
    {
        id: 'bj_fogg',
        channelTitle: 'BJ Fogg',
        handle: '@BJFogg',
        subscriberTier: 'expert',
        qualityScore: 90,
        sourceKind: 'behavior_science',
        profileUrl: 'https://www.youtube.com/@BJFogg',
        aliases: ['bj fogg', 'b j fogg', 'behavior design lab', 'stanford behavior design lab'],
        topics: {
            behavior_change_science: ['tiny habits', 'behavior design', 'habit design'],
            workout_motivation: ['tiny habits exercise', 'workout habits', 'behavior design workouts'],
            mindset: ['tiny habits motivation', 'behavior design confidence']
        }
    },
    {
        id: 'foundmyfitness',
        channelTitle: 'Dr. Rhonda Patrick',
        channelId: 'UCWF8SqJVNlx-ctXbLswcTcA',
        handle: '@foundmyfitness',
        subscriberTier: '750k+',
        qualityScore: 88,
        sourceKind: 'longevity_science',
        profileUrl: 'https://www.youtube.com/@foundmyfitness',
        aliases: ['foundmyfitness', 'found my fitness', 'rhonda patrick', 'dr rhonda patrick'],
        topics: {
            micronutrient_science: ['micronutrients', 'omega 3', 'vitamins minerals'],
            longevity: ['longevity healthspan', 'exercise aging', 'metabolic health'],
            supplements: ['creatine evidence', 'omega 3 evidence', 'supplements science'],
            recovery_sleep_energy: ['sleep recovery', 'exercise recovery', 'energy health']
        }
    },
    {
        id: 'examine',
        channelTitle: 'Examine',
        handle: '@Examinecom',
        subscriberTier: 'expert',
        qualityScore: 86,
        sourceKind: 'evidence_supplements',
        profileUrl: 'https://www.youtube.com/@Examinecom',
        aliases: ['examine', 'examine.com', 'examine com'],
        topics: {
            supplements: ['creatine evidence', 'supplement evidence', 'b12 iron omega 3'],
            protein_science: ['protein evidence', 'protein intake']
        }
    }
];

function normalizeLearningSourceText(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function sourceTopicConfig(source, topicId) {
    const value = source?.topics?.[topicId];
    if (!value) return null;
    if (Array.isArray(value)) return { queries: value, priority: 0 };
    if (typeof value === 'object') {
        return {
            queries: Array.isArray(value.queries) ? value.queries : [],
            priority: Number(value.priority || 0)
        };
    }
    return null;
}

function sourceSupportsTopic(source, topicId) {
    return !!sourceTopicConfig(source, topicId);
}

function getCuratedLearningReelSources(topicId) {
    return CURATED_LEARNING_REEL_SOURCES
        .filter(source => sourceSupportsTopic(source, topicId))
        .sort((a, b) => scoreSourceForTopic(b, topicId) - scoreSourceForTopic(a, topicId));
}

function scoreSourceForTopic(source, topicId) {
    const topicConfig = sourceTopicConfig(source, topicId) || {};
    return Number(source.qualityScore || 0)
        + Number(SUBSCRIBER_TIER_SCORE[source.subscriberTier] || 0)
        + Number(topicConfig.priority || 0);
}

function sourceMatchesChannel(source, channelTitle, channelId = '') {
    const normalizedChannelId = String(channelId || '').trim();
    if (normalizedChannelId && source.channelId && normalizedChannelId === source.channelId) return true;

    const normalizedChannel = normalizeLearningSourceText(channelTitle);
    if (!normalizedChannel) return false;

    const aliases = [
        source.channelTitle,
        source.handle,
        ...(Array.isArray(source.aliases) ? source.aliases : [])
    ]
        .map(normalizeLearningSourceText)
        .filter(Boolean);

    return aliases.some(alias => {
        if (normalizedChannel === alias) return true;
        if (alias.length < 8) return false;
        return normalizedChannel.includes(alias) || alias.includes(normalizedChannel);
    });
}

function findCuratedLearningReelSource(candidate, topicId = '') {
    const sources = topicId
        ? getCuratedLearningReelSources(topicId)
        : CURATED_LEARNING_REEL_SOURCES;
    return sources.find(source => sourceMatchesChannel(
        source,
        candidate?.channelTitle || candidate?.channel || candidate?.source || '',
        candidate?.channelId || candidate?.channel_id || ''
    )) || null;
}

function buildCuratedLearningReelQueries(topicId, options = {}) {
    const perSource = Math.max(1, Math.min(4, Number(options.perSource || 2)));
    const includeShorts = options.includeShorts !== false;
    const suffix = includeShorts ? ' shorts' : '';
    return getCuratedLearningReelSources(topicId).flatMap(source => {
        const topicConfig = sourceTopicConfig(source, topicId);
        return (topicConfig?.queries || [])
            .slice(0, perSource)
            .map(query => `${source.channelTitle} ${query}${suffix}`);
    });
}

function curatedLearningReelSourceNames(topicId) {
    return getCuratedLearningReelSources(topicId).map(source => source.channelTitle);
}

function learningReelCandidateRejectReason(candidate, topicId) {
    const text = `${candidate?.title || ''} ${candidate?.description || ''} ${candidate?.channelTitle || ''}`;
    if (LEARNING_REEL_BLOCKLIST_RE.test(text)) return 'blocked_topic_or_creator';
    const source = findCuratedLearningReelSource(candidate, topicId);
    if (!source) return 'source_not_curated_for_topic';
    const topicRe = TOPIC_KEYWORD_RE[topicId];
    if (topicRe && !topicRe.test(text)) return 'topic_mismatch';
    const durationSec = Number(candidate?.durationSec || candidate?.duration_sec || 0);
    if (durationSec && (durationSec < 15 || durationSec > 240)) return 'duration_outside_short_learning_range';
    return '';
}

function scoreCuratedLearningReelCandidate(candidate, topicId = candidate?.topicId || candidate?.topic_id || '') {
    const rejectReason = learningReelCandidateRejectReason(candidate, topicId);
    if (rejectReason) return -1000;

    const source = findCuratedLearningReelSource(candidate, topicId);
    const text = `${candidate?.title || ''} ${candidate?.description || ''}`;
    const durationSec = Number(candidate?.durationSec || candidate?.duration_sec || 0);
    const views = Number(candidate?.viewCount || candidate?.view_count || 0);
    let score = scoreSourceForTopic(source, topicId);

    if (candidate?.channelId && source?.channelId && candidate.channelId === source.channelId) score += 18;
    if (durationSec >= 25 && durationSec <= 90) score += 18;
    else if (durationSec > 90 && durationSec <= 150) score += 10;
    if (/\b(shorts?|reels?|clip)\b/i.test(text)) score += 8;
    if (/\b(science|evidence|explained|basics|tips|mistakes|how to|guide)\b/i.test(text)) score += 8;
    if (views > 1000000) score += 14;
    else if (views > 100000) score += 10;
    else if (views > 10000) score += 6;
    else if (views > 1000) score += 2;

    return score;
}

function getCuratedLearningReelTopicSummary(topicId) {
    return {
        id: topicId,
        label: LEARNING_REEL_TOPIC_LABELS[topicId] || topicId,
        sources: getCuratedLearningReelSources(topicId).map(source => ({
            id: source.id,
            channelTitle: source.channelTitle,
            handle: source.handle || '',
            subscriberTier: source.subscriberTier,
            sourceKind: source.sourceKind,
            profileUrl: source.profileUrl
        })),
        queries: buildCuratedLearningReelQueries(topicId, { perSource: 1 })
    };
}

module.exports = {
    CURATED_LEARNING_REEL_SOURCES,
    LEARNING_REEL_TOPIC_LABELS,
    LEARNING_REEL_BLOCKLIST_RE,
    TOPIC_KEYWORD_RE,
    buildCuratedLearningReelQueries,
    curatedLearningReelSourceNames,
    findCuratedLearningReelSource,
    getCuratedLearningReelSources,
    getCuratedLearningReelTopicSummary,
    learningReelCandidateRejectReason,
    normalizeLearningSourceText,
    scoreCuratedLearningReelCandidate,
    scoreSourceForTopic,
    sourceMatchesChannel
};
