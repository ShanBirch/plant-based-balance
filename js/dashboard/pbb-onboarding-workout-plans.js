(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.PBBOnboardingWorkoutPlans = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    const definitions = {};

    function add(id, label, equipment, program, target, libraryWorkoutIndex, icon, description) {
        const definition = {
            id,
            label,
            equipment,
            program,
            icon,
            fallback: 'yoga',
            fallbackIdx: target === 'lower' || target === 'legs' || target === 'lowerbody' ? 2 : 4
        };
        if (program === 'gym') definition.muscleGroup = target;
        else definition.subcategory = target;
        if (Number.isInteger(libraryWorkoutIndex)) definition.libraryWorkoutIndex = libraryWorkoutIndex;
        if (description) definition.description = description;
        definitions[id] = definition;
        return id;
    }

    function addSeries(prefix, count, create) {
        return Array.from({ length: count }, function (_, index) {
            const item = create(index);
            return add(prefix + '-' + (index + 1), item.label, item.equipment, item.program,
                item.target, item.index, item.icon, item.description);
        });
    }

    const gymFullBody = addSeries('gym-fullbody', 3, i => ({ label: 'Full Body ' + String.fromCharCode(65 + i), equipment: 'gym', program: 'gym', target: 'fullbody', index: i, icon: '🏋️' }));
    const gymUpper = addSeries('gym-upper', 2, i => ({ label: 'Upper Body ' + String.fromCharCode(65 + i), equipment: 'gym', program: 'gym', target: 'upper', index: i, icon: '🏋️' }));
    const gymLower = addSeries('gym-lower', 2, i => ({ label: 'Lower Body ' + String.fromCharCode(65 + i), equipment: 'gym', program: 'gym', target: 'lower', index: [0, 2][i], icon: '🏋️' }));
    const gymPush = addSeries('gym-push', 2, i => ({ label: 'Push ' + String.fromCharCode(65 + i), equipment: 'gym', program: 'gym', target: 'push', index: i, icon: '🏋️' }));
    const gymPull = addSeries('gym-pull', 2, i => ({ label: 'Pull ' + String.fromCharCode(65 + i), equipment: 'gym', program: 'gym', target: 'pull', index: i, icon: '🏋️' }));
    add('gym-chest-1', 'Chest', 'gym', 'gym', 'chest', 0, '🏋️');
    add('gym-back-1', 'Back', 'gym', 'gym', 'back', 0, '🏋️');
    add('gym-legs-1', 'Legs', 'gym', 'gym', 'legs', 0, '🏋️');
    add('gym-legs-2', 'Legs II', 'gym', 'gym', 'legs', 2, '🏋️');
    add('gym-shoulders-1', 'Shoulders', 'gym', 'gym', 'shoulders', 0, '🏋️');
    add('gym-arms-1', 'Arms', 'gym', 'gym', 'arms', 0, '🏋️');
    add('gym-chest-back-2', 'Chest + Back', 'gym', 'gym', 'upper', 1, '🏋️');

    const dbFullBody = addSeries('db-fullbody', 3, i => ({ label: 'Full Body ' + String.fromCharCode(65 + i), equipment: 'dumbbells', program: 'home_weights', target: 'fullbody', index: i, icon: '🏠' }));
    const dbUpper = addSeries('db-upper', 2, i => ({ label: 'Upper Body ' + String.fromCharCode(65 + i), equipment: 'dumbbells', program: 'home_weights', target: 'upper', index: i, icon: '🏠' }));
    const dbLower = addSeries('db-lower', 2, i => ({ label: 'Lower Body ' + String.fromCharCode(65 + i), equipment: 'dumbbells', program: 'home_weights', target: 'lower', index: i, icon: '🏠' }));
    add('db-chest-1', 'Chest', 'dumbbells', 'home', 'push', 0, '🏠');
    add('db-back-1', 'Back', 'dumbbells', 'home', 'pull', 0, '🏠');
    add('db-legs-1', 'Legs', 'dumbbells', 'home', 'lowerbody', 0, '🏠');
    add('db-legs-2', 'Legs II', 'dumbbells', 'home', 'lowerbody', 1, '🏠');
    add('db-shoulders-1', 'Shoulders', 'dumbbells', 'home_weights', 'shoulders', 0, '🏠');
    add('db-arms-1', 'Arms', 'dumbbells', 'home_weights', 'arms', 0, '🏠');
    add('db-chest-back-2', 'Chest + Back', 'dumbbells', 'home_weights', 'upper', 1, '🏠');
    add('db-push-1', 'Push A', 'dumbbells', 'home', 'push', 0, '🏠');
    add('db-pull-1', 'Pull A', 'dumbbells', 'home', 'pull', 0, '🏠');
    add('db-push-2', 'Push B', 'dumbbells', 'home', 'push', 4, '🏠');
    add('db-pull-2', 'Pull B', 'dumbbells', 'home', 'pull', 4, '🏠');

    const bandFullBody = addSeries('bands-fullbody', 3, i => ({ label: 'Full Body ' + String.fromCharCode(65 + i), equipment: 'bands', program: 'bands', target: 'fullbody', index: i, icon: '🔗' }));
    add('bands-upper-a', 'Upper Body A', 'bands', 'bands', 'upper', 0, '🔗');
    add('bands-upper-b', 'Upper Body B', 'bands', 'bands', 'upper', 1, '🔗');
    add('bands-lower-a', 'Lower Body A', 'bands', 'bands', 'lower', 0, '🔗');
    add('bands-lower-b', 'Lower Body B', 'bands', 'bands', 'lower', 1, '🔗');
    add('bands-upper-complete', 'Upper Body', 'bands', 'bands', 'upper', 4, '🔗');
    add('bands-lower-complete', 'Lower Body', 'bands', 'bands', 'lower', 4, '🔗');
    add('bands-chest-1', 'Chest', 'bands', 'bands', 'upper', 0, '🔗');
    add('bands-back-1', 'Back', 'bands', 'bands', 'upper', 1, '🔗');
    add('bands-legs-1', 'Legs', 'bands', 'bands', 'lower', 0, '🔗');
    add('bands-legs-2', 'Legs II', 'bands', 'bands', 'lower', 4, '🔗');
    add('bands-shoulders-1', 'Shoulders', 'bands', 'bands', 'upper', 3, '🔗');
    add('bands-arms-1', 'Arms', 'bands', 'bands', 'upper', 4, '🔗');
    add('bands-chest-back-2', 'Chest + Back', 'bands', 'bands', 'upper', 2, '🔗');
    add('bands-push-1', 'Push A', 'bands', 'bands', 'upper', 0, '🔗');
    add('bands-pull-1', 'Pull A', 'bands', 'bands', 'upper', 1, '🔗');
    add('bands-push-2', 'Push B', 'bands', 'bands', 'upper', 3, '🔗');
    add('bands-pull-2', 'Pull B', 'bands', 'bands', 'upper', 2, '🔗');

    const bwFullBody = addSeries('bw-fullbody', 3, i => ({ label: 'Full Body ' + String.fromCharCode(65 + i), equipment: 'none', program: 'bodyweight', target: 'noequipment_fullbody', index: i, icon: '🤸' }));
    add('bw-upper-a', 'Upper Body A', 'none', 'bodyweight', 'noequipment_upper', 0, '🤸');
    add('bw-upper-b', 'Upper Body B', 'none', 'bodyweight', 'noequipment_upper', 1, '🤸');
    add('bw-lower-a', 'Lower Body A', 'none', 'bodyweight', 'lowerbody', 0, '🤸');
    add('bw-lower-b', 'Lower Body B', 'none', 'bodyweight', 'lowerbody', 1, '🤸');
    add('bw-chest-1', 'Chest', 'none', 'bodyweight', 'noequipment_chest', 0, '🤸');
    add('bw-back-1', 'Back', 'none', 'bodyweight', 'noequipment_back', 0, '🤸');
    add('bw-legs-1', 'Legs', 'none', 'bodyweight', 'lowerbody', 0, '🤸');
    add('bw-legs-2', 'Legs II', 'none', 'bodyweight', 'lowerbody', 1, '🤸');
    add('bw-shoulders-1', 'Shoulders', 'none', 'bodyweight', 'noequipment_shoulders', 0, '🤸');
    add('bw-arms-1', 'Arms', 'none', 'bodyweight', 'noequipment_arms', 0, '🤸');
    add('bw-chest-back-2', 'Chest + Back', 'none', 'bodyweight', 'noequipment_upper', 1, '🤸');
    add('bw-push-1', 'Push A', 'none', 'bodyweight', 'noequipment_chest', 0, '🤸');
    add('bw-pull-1', 'Pull A', 'none', 'bodyweight', 'noequipment_back', 0, '🤸');
    add('bw-push-2', 'Push B', 'none', 'bodyweight', 'noequipment_shoulders', 0, '🤸');
    add('bw-pull-2', 'Pull B', 'none', 'bodyweight', 'noequipment_back', 1, '🤸');

    const strengthMatrix = {
        gym: {
            2: { split: 'upper_lower', sequence: [gymUpper[0], gymLower[0]] },
            3: { split: 'full_body', sequence: gymFullBody },
            4: { split: 'upper_lower', sequence: [gymUpper[0], gymLower[0], gymUpper[1], gymLower[1]] },
            5: { split: 'bro_split', sequence: ['gym-chest-1', 'gym-back-1', 'gym-legs-1', 'gym-shoulders-1', 'gym-arms-1'] },
            6: { split: 'ppl', sequence: [gymPush[0], gymPull[0], 'gym-legs-1', gymPush[1], gymPull[1], 'gym-legs-2'] },
            7: { split: 'bro_split_plus', sequence: ['gym-chest-1', 'gym-back-1', 'gym-legs-1', 'gym-shoulders-1', 'gym-arms-1', 'gym-chest-back-2', 'gym-legs-2'] }
        },
        dumbbells: {
            2: { split: 'upper_lower', sequence: [dbUpper[0], dbLower[0]] },
            3: { split: 'full_body', sequence: dbFullBody },
            4: { split: 'upper_lower', sequence: [dbUpper[0], dbLower[0], dbUpper[1], dbLower[1]] },
            5: { split: 'bro_split', sequence: ['db-chest-1', 'db-back-1', 'db-legs-1', 'db-shoulders-1', 'db-arms-1'] },
            6: { split: 'ppl', sequence: ['db-push-1', 'db-pull-1', 'db-legs-1', 'db-push-2', 'db-pull-2', 'db-legs-2'] },
            7: { split: 'bro_split_plus', sequence: ['db-chest-1', 'db-back-1', 'db-legs-1', 'db-shoulders-1', 'db-arms-1', 'db-chest-back-2', 'db-legs-2'] }
        },
        bands: {
            2: { split: 'upper_lower', sequence: ['bands-upper-complete', 'bands-lower-complete'] },
            3: { split: 'full_body', sequence: bandFullBody },
            4: { split: 'upper_lower', sequence: ['bands-upper-a', 'bands-lower-a', 'bands-upper-b', 'bands-lower-b'] },
            5: { split: 'bro_split', sequence: ['bands-chest-1', 'bands-back-1', 'bands-legs-1', 'bands-shoulders-1', 'bands-arms-1'] },
            6: { split: 'ppl', sequence: ['bands-push-1', 'bands-pull-1', 'bands-legs-1', 'bands-push-2', 'bands-pull-2', 'bands-legs-2'] },
            7: { split: 'bro_split_plus', sequence: ['bands-chest-1', 'bands-back-1', 'bands-legs-1', 'bands-shoulders-1', 'bands-arms-1', 'bands-chest-back-2', 'bands-legs-2'] }
        },
        none: {
            2: { split: 'upper_lower', sequence: ['bw-upper-a', 'bw-lower-a'] },
            3: { split: 'full_body', sequence: bwFullBody },
            4: { split: 'upper_lower', sequence: ['bw-upper-a', 'bw-lower-a', 'bw-upper-b', 'bw-lower-b'] },
            5: { split: 'bro_split', sequence: ['bw-chest-1', 'bw-back-1', 'bw-legs-1', 'bw-shoulders-1', 'bw-arms-1'] },
            6: { split: 'ppl', sequence: ['bw-push-1', 'bw-pull-1', 'bw-legs-1', 'bw-push-2', 'bw-pull-2', 'bw-legs-2'] },
            7: { split: 'bro_split_plus', sequence: ['bw-chest-1', 'bw-back-1', 'bw-legs-1', 'bw-shoulders-1', 'bw-arms-1', 'bw-chest-back-2', 'bw-legs-2'] }
        }
    };

    function normalizeEquipment(value) {
        const equipment = String(value || 'none').toLowerCase();
        if (equipment === 'home') return 'dumbbells';
        if (equipment === 'bodyweight') return 'none';
        return strengthMatrix[equipment] ? equipment : 'none';
    }

    function getPlan(equipment, frequency) {
        const normalizedEquipment = normalizeEquipment(equipment);
        const normalizedFrequency = Math.max(2, Math.min(7, Number(frequency) || 2));
        const plan = strengthMatrix[normalizedEquipment][normalizedFrequency];
        return {
            equipment: normalizedEquipment,
            frequency: normalizedFrequency,
            split: plan.split,
            sequence: plan.sequence.slice()
        };
    }

    function buildCalendar(equipment, frequency, trainingDays, recoveryOnRestDays) {
        const plan = getPlan(equipment, frequency);
        const selectedDays = new Set(Array.isArray(trainingDays) ? trainingDays : []);
        let workoutIndex = 0;
        const calendar = {};
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(function (day) {
            if (selectedDays.has(day)) {
                calendar[day] = plan.sequence[workoutIndex];
                workoutIndex++;
            } else {
                calendar[day] = recoveryOnRestDays ? 'yoga-restorative' : 'rest';
            }
        });
        return { calendar, plan };
    }

    function getDefinition(id, isMale) {
        const source = definitions[id];
        if (!source) return null;
        const definition = Object.assign({}, source);
        delete definition.id;
        delete definition.equipment;
        if (definition.program === 'gym') definition.program = isMale ? 'gym_split' : 'female_gym_split';
        return definition;
    }

    function getEquipmentOptions(equipment, frequency) {
        const normalizedEquipment = normalizeEquipment(equipment);
        const ids = getPlan(normalizedEquipment, frequency).sequence.filter(function (id, index, sequence) {
            return sequence.indexOf(id) === index;
        });
        return ids.map(id => ({
            id,
            name: definitions[id].label,
            icon: definitions[id].icon
        }));
    }

    return { definitions, strengthMatrix, normalizeEquipment, getPlan, buildCalendar, getDefinition, getEquipmentOptions };
});
