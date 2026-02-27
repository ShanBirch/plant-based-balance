(function() {
    // ONE-TIME MIGRATION: fix cached model URLs that still contain the old /dbz/ path.
    // This was a bug where DBZ model URLs pointed to /shannonsvideos/dbz/ instead of /shannonsvideos/.
    // Without this, returning users who had a DBZ character selected see "could not load character".
    try {
        const keysToFix = ['fitgotchi_model_src', 'active_rare_skin'];
        const cachedSrc = localStorage.getItem('fitgotchi_model_src');
        if (cachedSrc && cachedSrc.includes('/shannonsvideos/dbz/')) {
            localStorage.setItem('fitgotchi_model_src', cachedSrc.replace('/shannonsvideos/dbz/', '/shannonsvideos/'));
        }
        // Also fix window._fitgotchiCachedModel if it was set by the early script
        if (window._fitgotchiCachedModel && window._fitgotchiCachedModel.includes('/shannonsvideos/dbz/')) {
            window._fitgotchiCachedModel = window._fitgotchiCachedModel.replace('/shannonsvideos/dbz/', '/shannonsvideos/');
            // Also patch the model-viewer src directly if it's already been set
            const mv = document.getElementById('tamagotchi-model');
            if (mv && mv.getAttribute('src') && mv.getAttribute('src').includes('/shannonsvideos/dbz/')) {
                mv.setAttribute('src', mv.getAttribute('src').replace('/shannonsvideos/dbz/', '/shannonsvideos/'));
            }
        }
    } catch(e) {}

    const RARE_TIERS = {
        LEGENDARY: { label: 'LEGENDARY', color: '#fbbf24', glow: 'rgba(251,191,36,0.4)', gradient: 'linear-gradient(135deg, #fbbf24, #f59e0b)', buyIn: 10000, weight: 1 },
        EPIC:      { label: 'EPIC',      color: '#a855f7', glow: 'rgba(168,85,247,0.4)', gradient: 'linear-gradient(135deg, #a855f7, #7c3aed)', buyIn: 5000,  weight: 3 },
        RARE:      { label: 'RARE',      color: '#3b82f6', glow: 'rgba(59,130,246,0.4)', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', buyIn: 2500,  weight: 5 },
        COMMON:    { label: 'COMMON',    color: '#6b7280', glow: 'rgba(107,114,128,0.4)', gradient: 'linear-gradient(135deg, #6b7280, #4b5563)', buyIn: 1000,  weight: 10 }
    };

    const RARE_COLLECTION = [
        { id: 'arny', name: 'Arny', model: 'https://f005.backblazeb2.com/file/shannonsvideos/arny.glb', emoji: '🥋', desc: 'The Austrian Oak', tier: 'LEGENDARY' },
        { id: 'optimus', name: 'Optimus', model: 'https://f005.backblazeb2.com/file/shannonsvideos/optimus.glb', emoji: '🚛', desc: 'Prime Leadership', tier: 'EPIC' },
        { id: 'ssj2_kid_gohan', name: 'SSJ2 Kid Gohan', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ssj2_kid_gohan.glb', emoji: '🌩️', desc: 'Unleashed Fury', tier: 'EPIC' },
        { id: 'goku', name: 'Goku', model: 'https://f005.backblazeb2.com/file/shannonsvideos/goku.glb', emoji: '🌌', desc: 'Super Saiyan God', tier: 'EPIC' },
        { id: 'majin_vegeta', name: 'Majin Vegeta', model: 'https://f005.backblazeb2.com/file/shannonsvideos/majin_vegeta.glb', emoji: 'Ⓜ️', desc: 'Price of Pride', tier: 'EPIC' },
        { id: 'cbum', name: 'CBum', model: 'https://f005.backblazeb2.com/file/shannonsvideos/cbum.glb', emoji: '🥇', desc: 'Modern Classic Physique', tier: 'RARE' },
        { id: 'ronny', name: 'Ronny', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ronny.glb', emoji: '👑', desc: 'The King of Intensity', tier: 'RARE' },
        { id: 'steve_irwin', name: 'Steve Irwin', model: 'https://f005.backblazeb2.com/file/shannonsvideos/steve_irwin.glb', emoji: '🐊', desc: 'The Crocodile Hunter', tier: 'RARE' },
        { id: 'itadori', name: 'Itadori', model: 'https://f005.backblazeb2.com/file/shannonsvideos/itadori.glb', emoji: '👹', desc: 'Sukuna\'s Vessel', tier: 'RARE' },
        { id: 'elon', name: 'Elon', model: 'https://f005.backblazeb2.com/file/shannonsvideos/elon.glb', emoji: '🚀', desc: 'Techno-King Mode', tier: 'COMMON' },
        { id: 'trump', name: 'Trump', model: 'https://f005.backblazeb2.com/file/shannonsvideos/trump.glb', emoji: '🇺🇸', desc: 'High Stakes Player', tier: 'COMMON' },
        { id: 'epstein', name: 'Epstein', model: 'https://f005.backblazeb2.com/file/shannonsvideos/epstein_rigged.glb', emoji: '🏝️', desc: 'Didn\'t Kill Himself', tier: 'COMMON' }
    ];

    const DBZ_COLLECTION = [
        { id: '18', name: 'Android 18', model: 'https://f005.backblazeb2.com/file/shannonsvideos/18_rigged_from_image_animated.glb', emoji: '🤖', desc: 'Deadly and Beautiful', tier: 'EPIC' },
        { id: 'adult_bulma', name: 'Adult Bulma', model: 'https://f005.backblazeb2.com/file/shannonsvideos/adult_bulma_rigged_from_image_animated.glb', emoji: '👩‍🔬', desc: 'Capsule Corp CEO', tier: 'EPIC' },
        { id: 'adult_chi_chi', name: 'Adult Chi Chi', model: 'https://f005.backblazeb2.com/file/shannonsvideos/adult_chi_chi_rigged_from_image_animated.glb', emoji: '👩', desc: 'Strongest Mom', tier: 'EPIC' },
        { id: 'adult_gohan_ssj2', name: 'Adult Gohan (SSJ2)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/adult_gohan_ssj2_rigged_from_image_animated.glb', emoji: '⚡', desc: 'Unleashed Power', tier: 'EPIC' },
        { id: 'adult_gohan_weak', name: 'Adult Gohan (Weak)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/adult_gohan_weak_rigged_from_image_animated.glb', emoji: '📚', desc: 'Scholar Mode', tier: 'EPIC' },
        { id: 'adult_vegeta_premium', name: 'Vegeta (Adult)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/adult_vegeta_premium_animated.glb', emoji: '🤴', desc: 'Prince of Saiyans', tier: 'EPIC' },
        { id: 'android_16', name: 'Android 16', model: 'https://f005.backblazeb2.com/file/shannonsvideos/android_16_rigged_from_image_animated.glb', emoji: '🌲', desc: 'Nature Lover', tier: 'EPIC' },
        { id: 'android_17_new', name: 'Android 17', model: 'https://f005.backblazeb2.com/file/shannonsvideos/android_17_new_rigged_from_image_animated.glb', emoji: '🔫', desc: 'The Ultimate Android', tier: 'EPIC' },
        { id: 'android_19', name: 'Android 19', model: 'https://f005.backblazeb2.com/file/shannonsvideos/android_19_rigged_from_image_animated.glb', emoji: '🤡', desc: 'Energy Absorber', tier: 'EPIC' },
        { id: 'arny_rigged', name: 'Arny', model: 'https://f005.backblazeb2.com/file/shannonsvideos/arny_rigged.glb', emoji: '🥋', desc: 'The Austrian Oak', tier: 'EPIC' },
        { id: 'broly_lssj', name: 'Broly (LSSJ)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/broly_lssj_rigged_from_image_animated.glb', emoji: '💥', desc: 'Legendary Super Saiyan', tier: 'EPIC' },
        { id: 'burter', name: 'Burter', model: 'https://f005.backblazeb2.com/file/shannonsvideos/burter_rigged_from_image_animated.glb', emoji: '💨', desc: 'The Blue Hurricane', tier: 'EPIC' },
        { id: 'captain_ginyu', name: 'Captain Ginyu', model: 'https://f005.backblazeb2.com/file/shannonsvideos/captain_ginyu_rigged_from_image_animated.glb', emoji: '🐸', desc: 'Leader of Ginyu Force', tier: 'EPIC' },
        { id: 'cbum_rigged', name: 'CBum', model: 'https://f005.backblazeb2.com/file/shannonsvideos/cbum_rigged.glb', emoji: '🥇', desc: 'Modern Classic Physique', tier: 'EPIC' },
        { id: 'cell_base', name: 'Cell (Base)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/cell_base_rigged_from_image_animated.glb', emoji: '🦗', desc: 'Imperfect Being', tier: 'EPIC' },
        { id: 'cell_perfect', name: 'Cell (Perfect)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/cell_perfect_rigged_from_image_animated.glb', emoji: '💎', desc: 'Perfect Warrior', tier: 'EPIC' },
        { id: 'chaozu_premium', name: 'Chaozu', model: 'https://f005.backblazeb2.com/file/shannonsvideos/chaozu_premium_animated.glb', emoji: '🥟', desc: 'Psychic Warrior', tier: 'EPIC' },
        { id: 'chaozu', name: 'Chaozu (Alt)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/chaozu_rigged_from_image_animated.glb', emoji: '🥟', desc: 'Psychic Hero', tier: 'EPIC' },
        { id: 'dabura', name: 'Dabura', model: 'https://f005.backblazeb2.com/file/shannonsvideos/dabura_rigged_from_image_animated.glb', emoji: '😈', desc: 'Demon King', tier: 'EPIC' },
        { id: 'dendi', name: 'Dende', model: 'https://f005.backblazeb2.com/file/shannonsvideos/dendi_rigged_from_image_animated.glb', emoji: '🐉', desc: 'Guardian of Earth', tier: 'EPIC' },
        { id: 'dr_gero', name: 'Dr. Gero', model: 'https://f005.backblazeb2.com/file/shannonsvideos/dr_gero_rigged_from_image_animated.glb', emoji: '🧠', desc: 'Mad Scientist', tier: 'EPIC' },
        { id: 'elon_rigged', name: 'Elon', model: 'https://f005.backblazeb2.com/file/shannonsvideos/elon_rigged.glb', emoji: '🚀', desc: 'Techno-King Mode', tier: 'EPIC' },
        { id: 'epstein_rigged', name: 'Epstein', model: 'https://f005.backblazeb2.com/file/shannonsvideos/epstein_rigged.glb', emoji: '🏝️', desc: "Didn't Kill Himself", tier: 'EPIC' },
        { id: 'fat_buu', name: 'Fat Buu', model: 'https://f005.backblazeb2.com/file/shannonsvideos/fat_buu_rigged_from_image_animated.glb', emoji: '🍬', desc: 'Magic Majin', tier: 'EPIC' },
        { id: 'freeza_final', name: 'Frieza (Final)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/freeza_final_rigged_from_image_animated.glb', emoji: '👽', desc: 'Emperor of Evil', tier: 'EPIC' },
        { id: 'freeza_first_form', name: 'Frieza (First Form)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/freeza_first_form_rigged_from_image_animated.glb', emoji: '🛸', desc: 'Tyrant in the Chair', tier: 'EPIC' },
        { id: 'future_gohan', name: 'Future Gohan', model: 'https://f005.backblazeb2.com/file/shannonsvideos/future_gohan_rigged_from_image_animated.glb', emoji: '⏳', desc: 'The Last Hope', tier: 'EPIC' },
        { id: 'future_trunks', name: 'Future Trunks', model: 'https://f005.backblazeb2.com/file/shannonsvideos/future_trunks_rigged_from_image_animated.glb', emoji: '🗡️', desc: 'Warrior from the Future', tier: 'EPIC' },
        { id: 'gohan_namek_armor', name: 'Gohan (Namek)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/gohan_namek_armor_rigged_from_image_animated.glb', emoji: '🛡️', desc: 'Young Warrior', tier: 'EPIC' },
        { id: 'gohan_rigged', name: 'Gohan (Teen)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/gohan_rigged.glb', emoji: '🐉', desc: 'Hidden Potential', tier: 'EPIC' },
        { id: 'goku_adult', name: 'Goku (Adult)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/goku_adult_animated.glb', emoji: '🌌', desc: "Earth's Protector", tier: 'EPIC' },
        { id: 'goku_rigged', name: 'Goku', model: 'https://f005.backblazeb2.com/file/shannonsvideos/goku_rigged.glb', emoji: '🌌', desc: 'Super Saiyan God', tier: 'EPIC' },
        { id: 'gotenks_ssj', name: 'Gotenks (SSJ)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/gotenks_ssj_rigged_from_image_animated.glb', emoji: '👻', desc: 'Fusion Power', tier: 'EPIC' },
        { id: 'goten', name: 'Goten', model: 'https://f005.backblazeb2.com/file/shannonsvideos/goten_rigged_from_image_animated.glb', emoji: '👦', desc: 'Youngest Saiyan', tier: 'EPIC' },
        { id: 'great_saiyaman', name: 'Great Saiyaman', model: 'https://f005.backblazeb2.com/file/shannonsvideos/great_saiyaman_rigged_from_image_animated.glb', emoji: '🦸', desc: 'Champion of Justice', tier: 'EPIC' },
        { id: 'guldo', name: 'Guldo', model: 'https://f005.backblazeb2.com/file/shannonsvideos/guldo_animated.glb', emoji: '⏱️', desc: 'Time Freezer', tier: 'EPIC' },
        { id: 'itadori_rigged', name: 'Itadori', model: 'https://f005.backblazeb2.com/file/shannonsvideos/itadori_rigged.glb', emoji: '👹', desc: "Sukuna's Vessel", tier: 'EPIC' },
        { id: 'jeice', name: 'Jeice', model: 'https://f005.backblazeb2.com/file/shannonsvideos/jeice_animated.glb', emoji: '🔴', desc: 'The Red Magma', tier: 'EPIC' },
        { id: 'kami', name: 'Kami', model: 'https://f005.backblazeb2.com/file/shannonsvideos/kami_animated.glb', emoji: '🕍', desc: 'God of Earth', tier: 'EPIC' },
        { id: 'kid_bulma', name: 'Kid Bulma', model: 'https://f005.backblazeb2.com/file/shannonsvideos/kid_bulma_animated.glb', emoji: '🎒', desc: 'Adventurer', tier: 'EPIC' },
        { id: 'kid_buu', name: 'Kid Buu', model: 'https://f005.backblazeb2.com/file/shannonsvideos/kid_buu_rigged_from_image_animated.glb', emoji: '💥', desc: 'Pure Chaos', tier: 'EPIC' },
        { id: 'kid_chi_chi', name: 'Kid Chi Chi', model: 'https://f005.backblazeb2.com/file/shannonsvideos/kid_chi_chi_animated.glb', emoji: '🥋', desc: "Ox King's Daughter", tier: 'EPIC' },
        { id: 'kid_gohan', name: 'Kid Gohan', model: 'https://f005.backblazeb2.com/file/shannonsvideos/kid_gohan_animated.glb', emoji: '🦁', desc: 'Wild Child', tier: 'EPIC' },
        { id: 'kid_goku', name: 'Kid Goku', model: 'https://f005.backblazeb2.com/file/shannonsvideos/kid_goku_rigged_from_image_animated.glb', emoji: '🐒', desc: 'The Boy with the Tail', tier: 'EPIC' },
        { id: 'king_cold', name: 'King Cold', model: 'https://f005.backblazeb2.com/file/shannonsvideos/king_cold_rigged_from_image_animated.glb', emoji: '🏰', desc: 'Intergalactic Tyrant', tier: 'EPIC' },
        { id: 'king_kai', name: 'King Kai', model: 'https://f005.backblazeb2.com/file/shannonsvideos/king_kai_animated.glb', emoji: '🪐', desc: 'Master of Kaio-ken', tier: 'EPIC' },
        { id: 'krillin', name: 'Krillin', model: 'https://f005.backblazeb2.com/file/shannonsvideos/krillin_animated.glb', emoji: '👨‍🦲', desc: 'Strongest Human', tier: 'EPIC' },
        { id: 'master_roshi', name: 'Master Roshi', model: 'https://f005.backblazeb2.com/file/shannonsvideos/master_roshi_animated.glb', emoji: '🐢', desc: 'Turtle Hermit', tier: 'EPIC' },
        { id: 'mecha_freeza', name: 'Mecha Frieza', model: 'https://f005.backblazeb2.com/file/shannonsvideos/mecha_freeza_rigged_from_image_animated.glb', emoji: '⚙️', desc: 'Rebuilt Tyrant', tier: 'EPIC' },
        { id: 'mr_popo', name: 'Mr. Popo', model: 'https://f005.backblazeb2.com/file/shannonsvideos/mr_popo_animated.glb', emoji: '🕌', desc: 'Servant of Kami', tier: 'EPIC' },
        { id: 'mr_satan', name: 'Mr. Satan', model: 'https://f005.backblazeb2.com/file/shannonsvideos/mr_satan_rigged_from_image_animated.glb', emoji: '🏆', desc: 'World Champion', tier: 'EPIC' },
        { id: 'nappa', name: 'Nappa', model: 'https://f005.backblazeb2.com/file/shannonsvideos/nappa_animated.glb', emoji: '👴', desc: 'Elite Saiyan Warrior', tier: 'EPIC' },
        { id: 'oolong', name: 'Oolong', model: 'https://f005.backblazeb2.com/file/shannonsvideos/oolong_animated.glb', emoji: '🐷', desc: 'Shapeshifting Swine', tier: 'EPIC' },
        { id: 'optimus', name: 'Optimus', model: 'https://f005.backblazeb2.com/file/shannonsvideos/optimus_rigged.glb', emoji: '🚛', desc: 'Prime Leadership', tier: 'EPIC' },
        { id: 'piccolo', name: 'Piccolo', model: 'https://f005.backblazeb2.com/file/shannonsvideos/piccolo_animated.glb', emoji: '🌵', desc: 'Special Beam Cannon', tier: 'EPIC' },
        { id: 'raditz', name: 'Raditz', model: 'https://f005.backblazeb2.com/file/shannonsvideos/raditz_animated.glb', emoji: '🌑', desc: 'The Low-Class Saiyan', tier: 'EPIC' },
        { id: 'recoome', name: 'Recoome', model: 'https://f005.backblazeb2.com/file/shannonsvideos/recoome_animated.glb', emoji: '🦾', desc: 'The Purple Power', tier: 'EPIC' },
        { id: 'ronny', name: 'Ronny', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ronny_rigged.glb', emoji: '👑', desc: 'The King of Intensity', tier: 'EPIC' },
        { id: 'ssj2_goku', name: 'Goku (SSJ2)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ssj2_goku_rigged_from_image_animated.glb', emoji: '⚡', desc: 'Ascended Saiyan', tier: 'EPIC' },
        { id: 'ssj3_goku', name: 'Goku (SSJ3)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ssj3_goku_rigged_from_image_animated.glb', emoji: '🦁', desc: 'Ultimate Saiyan Form', tier: 'EPIC' },
        { id: 'ssj3_gotenks', name: 'Gotenks (SSJ3)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ssj3_gotenks_rigged_from_image_animated.glb', emoji: '🌀', desc: 'Super Ghost Kamikaze', tier: 'EPIC' },
        { id: 'ssj_future_trunks', name: 'Future Trunks (SSJ)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ssj_future_trunks_rigged_from_image_animated.glb', emoji: '🗡️', desc: 'Sword of Hope', tier: 'EPIC' },
        { id: 'ssj_gohan_adult', name: 'Adult Gohan (SSJ)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ssj_gohan_adult_rigged_from_image_animated.glb', emoji: '🔆', desc: 'Golden Warrior', tier: 'EPIC' },
        { id: 'ssj_gohan_kid', name: 'Kid Gohan (SSJ)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ssj_gohan_kid_rigged_from_image_animated.glb', emoji: '🐯', desc: 'Fased Power', tier: 'EPIC' },
        { id: 'ssj_goku', name: 'Goku (SSJ)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ssj_goku_rigged_from_image_animated.glb', emoji: '🔥', desc: 'The Super Saiyan', tier: 'EPIC' },
        { id: 'ssj_vegeta', name: 'Vegeta (SSJ)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ssj_vegeta_rigged_from_image_animated.glb', emoji: '⚡', desc: 'Prince of Pride', tier: 'EPIC' },
        { id: 'steve_irwin', name: 'Steve Irwin', model: 'https://f005.backblazeb2.com/file/shannonsvideos/steve_irwin_rigged.glb', emoji: '🐊', desc: 'The Crocodile Hunter', tier: 'EPIC' },
        { id: 'super_buu', name: 'Super Buu', model: 'https://f005.backblazeb2.com/file/shannonsvideos/super_buu_rigged_from_image_animated.glb', emoji: '💢', desc: 'Absolute Evil', tier: 'EPIC' },
        { id: 'super_trunks_kid', name: 'Kid Trunks (Super)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/super_trunks_kid_rigged_from_image_animated.glb', emoji: '👦', desc: 'Mini trunks', tier: 'EPIC' },
        { id: 'super_trunks', name: 'Super Trunks', model: 'https://f005.backblazeb2.com/file/shannonsvideos/super_trunks_rigged_from_image_animated.glb', emoji: '💪', desc: 'Muscular Saiyan', tier: 'EPIC' },
        { id: 'super_vegeta_v3', name: 'Super Vegeta', model: 'https://f005.backblazeb2.com/file/shannonsvideos/super_vegeta_v3_rigged_from_image_animated.glb', emoji: '😤', desc: 'Final Flash!', tier: 'EPIC' },
        { id: 'supreme_kai', name: 'Supreme Kai', model: 'https://f005.backblazeb2.com/file/shannonsvideos/supreme_kai_rigged_from_image_animated.glb', emoji: '⚖️', desc: 'God of Creation', tier: 'EPIC' },
        { id: 'tien', name: 'Tien', model: 'https://f005.backblazeb2.com/file/shannonsvideos/tien_animated.glb', emoji: '👁️', desc: 'Three-Eyed Warrior', tier: 'EPIC' },
        { id: 'trump', name: 'Trump', model: 'https://f005.backblazeb2.com/file/shannonsvideos/trump_rigged.glb', emoji: '🇺🇸', desc: 'High Stakes Player', tier: 'EPIC' },
        { id: 'trunks_kid', name: 'Kid Trunks', model: 'https://f005.backblazeb2.com/file/shannonsvideos/trunks_kid_rigged_from_image_animated.glb', emoji: '👶', desc: 'Young Prince', tier: 'EPIC' },
        { id: 'ultimate_gohan', name: 'Ultimate Gohan', model: 'https://f005.backblazeb2.com/file/shannonsvideos/ultimate_gohan_rigged_from_image_animated.glb', emoji: '🔱', desc: "Elder Kai's Blessing", tier: 'EPIC' },
        { id: 'vegeta', name: 'Vegeta', model: 'https://f005.backblazeb2.com/file/shannonsvideos/vegeta_rigged.glb', emoji: '🤴', desc: 'Prince of All Saiyans', tier: 'EPIC' },
        { id: 'vegito_ssj', name: 'Vegito (SSJ)', model: 'https://f005.backblazeb2.com/file/shannonsvideos/vegito_ssj_rigged_from_image_animated.glb', emoji: '👐', desc: 'Ultimate Fusion', tier: 'EPIC' },
        { id: 'videl', name: 'Videl', model: 'https://f005.backblazeb2.com/file/shannonsvideos/videl_rigged_from_image_animated.glb', emoji: '🎀', desc: 'Justice Girl', tier: 'EPIC' },
        { id: 'yajirobe', name: 'Yajirobe', model: 'https://f005.backblazeb2.com/file/shannonsvideos/yajirobe_animated.glb', emoji: '🍖', desc: 'The Ronin', tier: 'EPIC' },
        { id: 'yamcha', name: 'Yamcha', model: 'https://f005.backblazeb2.com/file/shannonsvideos/yamcha_animated.glb', emoji: '🐺', desc: 'Wolf Fang Fist', tier: 'EPIC' },
        { id: 'young_chi_chi', name: 'Young Chi Chi', model: 'https://f005.backblazeb2.com/file/shannonsvideos/young_chi_chi_rigged_from_image_animated.glb', emoji: '⚔️', desc: 'Fire Mountain Princess', tier: 'EPIC' }
    ];

    // ============================================================
    // BACKGROUND MODEL PREFETCH - warm browser cache for 3D models
    // ============================================================
    (function prefetchRareModels() {
        // Wait for the main app (character model, calorie tracker, stats) to fully load
        // before starting background prefetch of rare 3D models
        const startPrefetch = () => {
            // Prioritize: 1) active skin, 2) featured monthly rare, 3) first in collection, 4) rest
            const activeRareSkinId = localStorage.getItem('active_rare_skin');
            const featured = getFeaturedMonthlyRareId();
            const priorityIds = new Set();
            if (activeRareSkinId) priorityIds.add(activeRareSkinId);
            if (featured) priorityIds.add(featured);
            priorityIds.add(RARE_COLLECTION[0].id); // First in list (shown when opening Rare Drops)

            const priorityModels = [];
            const remainingRareModels = [];
            RARE_COLLECTION.forEach(rare => {
                if (priorityIds.has(rare.id)) {
                    priorityModels.push(rare.model);
                } else {
                    remainingRareModels.push(rare.model);
                }
            });

            // Also include the active DBZ character as a priority prefetch
            const dbzPriorityModels = [];
            const dbzRemainingModels = [];
            (DBZ_COLLECTION || []).forEach(char => {
                if (priorityIds.has(char.id)) {
                    dbzPriorityModels.push(char.model);
                } else {
                    dbzRemainingModels.push(char.model);
                }
            });

            // Prefetch priority models first (active skin + featured rare + active DBZ char)
            prefetchBatch([...priorityModels, ...dbzPriorityModels], 400).then(() => {
                // Then prefetch the small RARE_COLLECTION (12 models) at 600ms stagger
                prefetchBatch(remainingRareModels, 600).then(() => {
                    // Finally prefetch all 82 DBZ models in the background at a slow 800ms stagger
                    // so they don't compete with the main app after the user opens the app
                    prefetchBatch(dbzRemainingModels, 800);
                });
            });
        };

        function prefetchBatch(urls, staggerMs) {
            const fetches = urls.map((url, i) => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        fetch(url, { mode: 'cors', credentials: 'omit', priority: 'low' })
                            .then(() => console.log('Prefetched:', url.split('/').pop()))
                            .catch(() => {}) // Silently ignore prefetch failures
                            .finally(resolve);
                    }, i * staggerMs);
                });
            });
            return Promise.all(fetches);
        }

        // Helper to get featured rare ID without creating the full object
        function getFeaturedMonthlyRareId() {
            const now = new Date();
            const monthIndex = now.getFullYear() * 12 + now.getMonth();
            const rare = RARE_COLLECTION[monthIndex % RARE_COLLECTION.length];
            return rare ? rare.id : null;
        }

        // Wait for the critical content (main character, calorie tracker, stats) to load,
        // then add an extra delay before starting rare model prefetch in the background
        function waitAndPrefetch() {
            if (window._appCriticalContentReady) {
                // Critical content already loaded — start after a short extra delay
                setTimeout(startPrefetch, 2000);
            } else {
                // Listen for the signal from the login overlay dismissal
                window.addEventListener('appCriticalContentReady', () => {
                    setTimeout(startPrefetch, 2000);
                }, { once: true });
                // Safety fallback: if signal never fires (e.g. overlay was hidden for returning users),
                // start after a generous delay
                setTimeout(() => {
                    if (!window._appCriticalContentReady) {
                        window._appCriticalContentReady = true;
                        startPrefetch();
                    }
                }, 15000);
            }
        }

        // Kick off the waiting logic after DOM is interactive
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', waitAndPrefetch);
        } else {
            waitAndPrefetch();
        }
        // Expose constants for other scripts
    window.RARE_COLLECTION = RARE_COLLECTION;
    window.DBZ_COLLECTION = DBZ_COLLECTION;
    window.RARE_TIERS = RARE_TIERS;
    window.selectRareSkin = selectRareSkin;
    window.isRareUnlocked = isRareUnlocked;
    window.clearRareSkin = clearRareSkin;
})();

    // Helper: check if a rare skin is unlocked
    function isRareUnlocked(id) {
        let unlocked = [];
        try { unlocked = JSON.parse(localStorage.getItem('user_rares_unlocked') || '[]'); } catch(e) {}
        return unlocked.includes(id);
    }

    // Helper: unlock a rare skin
    function unlockRare(id) {
        let unlocked = [];
        try { unlocked = JSON.parse(localStorage.getItem('user_rares_unlocked') || '[]'); } catch(e) {}
        if (!unlocked.includes(id)) {
            unlocked.push(id);
            localStorage.setItem('user_rares_unlocked', JSON.stringify(unlocked));
            try { if (typeof checkRareBadges === 'function') checkRareBadges(); } catch(e) {}
        }
    }

    // Helper: get weighted random rare drop (from all rares, weighted by tier)
    function getRandomRareDrop() {
        const pool = [];
        RARE_COLLECTION.forEach(rare => {
            const tierData = RARE_TIERS[rare.tier];
            if (tierData) {
                for (let i = 0; i < tierData.weight; i++) {
                    pool.push(rare);
                }
            }
        });
        return pool[Math.floor(Math.random() * pool.length)];
    }

    // Helper: get featured monthly rare (deterministic rotation by month)
    function getFeaturedMonthlyRare() {
        const now = new Date();
        const monthIndex = now.getFullYear() * 12 + now.getMonth();
        return RARE_COLLECTION[monthIndex % RARE_COLLECTION.length];
    }

    // Select a rare skin as active tamagotchi skin
    // Select an evolution skin (swap to any unlocked evolution model)
    window.selectEvolutionSkin = function(modelSrc, title) {
        // Clear any active rare skin
        localStorage.removeItem('active_rare_skin');
        // Save the selected evolution skin override
        localStorage.setItem('active_evolution_skin', modelSrc);
        // Update the main model-viewer immediately
        const modelViewer = document.getElementById('tamagotchi-model');
        if (modelViewer) {
            modelViewer.setAttribute('src', modelSrc);
            // Apply character colors + idle animation when model loads
            modelViewer.addEventListener('load', function onLoad() {
                if (window.applyCharacterColors) {
                    window.applyCharacterColors(modelViewer, modelSrc);
                }
                if (window.applyIdleAnimation) window.applyIdleAnimation(modelViewer);
                modelViewer.removeEventListener('load', onLoad);
            });
        }
        // Refresh active skin highlight instead of rebuilding the whole panel
        if (typeof window._refreshActiveSkin === 'function') {
            window._refreshActiveSkin('');
        }
        if (typeof window.closeAnimationSelector === 'function') {
            window.closeAnimationSelector();
        }
        showToast('🎨 ' + title + ' skin equipped!', 'success');
    };

    function selectRareSkin(id) {
        const rare = RARE_COLLECTION.find(r => r.id === id);
        if (!rare || !isRareUnlocked(id)) return;
        localStorage.setItem('active_rare_skin', id);
        localStorage.removeItem('active_evolution_skin');
        const modelViewer = document.getElementById('tamagotchi-model');
        if (modelViewer) {
            modelViewer.setAttribute('src', rare.model);
            // Apply idle/stand animation once model finishes loading
            modelViewer.addEventListener('load', function onLoad() {
                if (window.applyIdleAnimation) window.applyIdleAnimation(modelViewer);
                modelViewer.removeEventListener('load', onLoad);
            });
        }
        // Refresh active skin highlight in the already-rendered panel
        if (typeof window._refreshActiveSkin === 'function') {
            window._refreshActiveSkin(id);
        }
        if (typeof window.closeAnimationSelector === 'function') {
            window.closeAnimationSelector();
        }
        showToast(rare.emoji + ' ' + rare.name + ' skin equipped!', 'success');
    }

    function selectRareSkinFromDBZ(id) {
        const char = DBZ_COLLECTION.find(r => r.id === id);
        if (!char) return;
        localStorage.setItem('active_rare_skin', id);
        localStorage.removeItem('active_evolution_skin');
        const modelViewer = document.getElementById('tamagotchi-model');
        if (modelViewer) {
            modelViewer.setAttribute('src', char.model);
            // Apply idle/stand animation once model finishes loading — prevents T-pose
            modelViewer.addEventListener('load', function onLoad() {
                if (window.applyIdleAnimation) window.applyIdleAnimation(modelViewer);
                modelViewer.removeEventListener('load', onLoad);
            });
        }
        // Refresh active skin highlight in the already-rendered panel
        if (typeof window._refreshActiveSkin === 'function') {
            window._refreshActiveSkin(id);
        }
        if (typeof window.closeAnimationSelector === 'function') {
            window.closeAnimationSelector();
        }
        showToast(char.emoji + ' ' + char.name + ' skin equipped!', 'success');
    }

    // Clear rare skin and revert to level-based evolution
    function clearRareSkin() {
        localStorage.removeItem('active_rare_skin');
        localStorage.removeItem('active_evolution_skin');
        // Trigger level-based model update
        if (typeof updateTamagotchiDisplay === 'function') {
            updateTamagotchiDisplay();
        } else if (typeof updateFitGotchi === 'function') {
            updateFitGotchi();
        }
        // Refresh active skin highlight in the already-rendered panel
        if (typeof window._refreshActiveSkin === 'function') {
            window._refreshActiveSkin('');
        }
        if (typeof window.closeAnimationSelector === 'function') {
            window.closeAnimationSelector();
        }
        showToast('Reverted to level skin!', 'success');
    }

    // Render the featured monthly rare card on the home page
    function renderFeaturedRareCard() {
        const container = document.getElementById('rare-challenges-preview');
        if (!container) return;

        const featured = getFeaturedMonthlyRare();
        if (!featured) return;

        const tierData = RARE_TIERS[featured.tier];
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const currentMonth = monthNames[new Date().getMonth()];

        container.innerHTML = `
            <div class="card" onclick="openCreateChallengeModal('${featured.id}')" style="min-width: 280px; max-width: 340px; padding: 20px; border: 2px solid ${tierData.color}; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3), 0 0 20px ${tierData.glow}; border-radius: 16px;">
                <div style="position: absolute; top: -15px; right: -15px; font-size: 5rem; opacity: 0.08; transform: rotate(15deg);">${featured.emoji}</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <span style="font-size: 2rem;">${featured.emoji}</span>
                    <div>
                        <div style="font-weight: 800; color: white; font-size: 1.15rem;">${currentMonth} Featured</div>
                        <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.6rem; font-weight: 800; letter-spacing: 1.5px; background: ${tierData.gradient}; color: white;">${tierData.label}</span>
                    </div>
                </div>
                <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-bottom: 14px;">30 Days • ${tierData.buyIn.toLocaleString()} Coins</div>
                <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 10px;">
                    <div style="font-size: 1.4rem;">${featured.emoji}</div>
                    <div style="flex: 1;">
                        <div style="font-size: 0.6rem; color: rgba(255,255,255,0.5); text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Guaranteed Drop</div>
                        <div style="font-size: 0.85rem; font-weight: 700; color: ${tierData.color};">${featured.name}</div>
                    </div>
                    <div style="background: ${tierData.gradient}; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.65rem; font-weight: 800;">WIN</div>
                </div>
            </div>
        `;
    }

    // ============================================================
    // CHALLENGE COMPLETION & RARE REWARD GRANTING
    // ============================================================

    // Check for expired challenges that need completion
    async function checkAndCompleteExpiredChallenges() {
        if (!window.currentUser) return;

        try {
            // Get all active/pending challenges for this user that have passed their end date
            const { data: challenges, error } = await window.supabaseClient
                .from('challenge_participants')
                .select('challenge_id, challenges!inner(id, name, end_date, status, winner_id, winner_rewarded, rare_reward_id)')
                .eq('user_id', window.currentUser.id)
                .eq('status', 'accepted')
                .in('challenges.status', ['active', 'pending']);

            if (error || !challenges) return;

            const now = new Date();
            for (const cp of challenges) {
                const challenge = cp.challenges;
                const endDate = new Date(challenge.end_date);

                // If challenge has passed its end date and hasn't been completed
                if (endDate < now && !challenge.winner_rewarded) {
                    console.log('Completing expired challenge:', challenge.name);
                    await completeAndRewardChallenge(challenge.id);
                }
            }
        } catch (err) {
            console.error('Error checking expired challenges:', err);
        }
    }

    // Complete a challenge and handle rare reward
    async function completeAndRewardChallenge(challengeId) {
        try {
            const { data: result, error } = await window.supabaseClient
                .rpc('complete_challenge', { challenge_uuid: challengeId });

            if (error) {
                console.error('Error completing challenge:', error);
                return;
            }

            if (result?.error) {
                console.log('Challenge already completed:', result.message);
                return;
            }

            const winnerId = result?.winner_id;
            const rareRewardId = result?.rare_reward_id;
            const isCurrentUserWinner = winnerId === window.currentUser?.id;

            if (isCurrentUserWinner && rareRewardId) {
                // Unlock the rare skin locally
                unlockRare(rareRewardId);
                // Show the epic celebration modal
                showRareUnlockCelebration(rareRewardId, result.winner_name, true);
            } else if (isCurrentUserWinner) {
                // Winner but no rare reward — just show a simple congrats
                showToast('🏆 You won the challenge! +200 XP', 'success');
            } else {
                // Not the winner
                const winnerName = result?.winner_name || 'Someone';
                showToast(`Challenge complete! ${winnerName} won.`, 'info');
            }

            // Check challenge badges
            try { if (typeof checkChallengeBadges === 'function') checkChallengeBadges(); } catch(e) {}

            // Refresh challenges on home screen
            if (typeof loadHomeChallenges === 'function') loadHomeChallenges();

        } catch (err) {
            console.error('Error in completeAndRewardChallenge:', err);
        }
    }

    // ============================================================
    // UNLOCK CELEBRATION MODAL
    // ============================================================

    // Track which rare was just unlocked for the equip button
    window._lastUnlockedRareId = null;

    function showRareUnlockCelebration(rareId, winnerName, isWinner) {
        const rare = RARE_COLLECTION.find(r => r.id === rareId);
        if (!rare) return;

        const tierData = RARE_TIERS[rare.tier] || RARE_TIERS.COMMON;
        window._lastUnlockedRareId = rareId;

        const modal = document.getElementById('rare-unlock-celebration');
        if (!modal) return;

        // Set result text
        const resultText = document.getElementById('unlock-result-text');
        if (resultText) {
            resultText.textContent = isWinner ? 'YOU WON!' : 'REWARD UNLOCKED!';
            resultText.style.color = isWinner ? '#4ade80' : '#fbbf24';
        }

        // Set 3D model
        const viewer = document.getElementById('unlock-rare-viewer');
        if (viewer) viewer.setAttribute('src', rare.model);

        // Set glow ring color
        const glowRing = document.getElementById('unlock-glow-ring');
        if (glowRing) {
            glowRing.style.background = `radial-gradient(circle, ${tierData.glow} 0%, transparent 70%)`;
        }

        // Set tier badge
        const badgeEl = document.getElementById('unlock-tier-badge');
        if (badgeEl) {
            badgeEl.textContent = tierData.label;
            badgeEl.style.background = tierData.gradient;
        }

        // Set name and desc
        const nameEl = document.getElementById('unlock-rare-name');
        if (nameEl) nameEl.textContent = rare.name;
        const descEl = document.getElementById('unlock-rare-desc');
        if (descEl) descEl.textContent = rare.desc;

        // Generate sparkles
        generateSparkles(tierData.color);

        // Show the modal
        modal.style.display = 'flex';

        // Haptic feedback (if available)
        if (navigator.vibrate) navigator.vibrate([100, 50, 200, 50, 100]);
    }

    function generateSparkles(color) {
        const container = document.getElementById('unlock-sparkles');
        if (!container) return;
        container.innerHTML = '';

        const emojis = ['✨', '⭐', '🌟', '💫', '🎆', '🎇'];
        for (let i = 0; i < 20; i++) {
            const sparkle = document.createElement('div');
            sparkle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            sparkle.style.cssText = `
                position: absolute;
                font-size: ${0.8 + Math.random() * 1.5}rem;
                left: ${10 + Math.random() * 80}%;
                bottom: ${Math.random() * 40}%;
                animation: sparkleFloat ${1.5 + Math.random() * 2}s ease-out ${Math.random() * 1}s forwards;
                opacity: 0;
                pointer-events: none;
            `;
            // Start the animation after a brief delay
            setTimeout(() => sparkle.style.opacity = '1', i * 80);
            container.appendChild(sparkle);
        }
    }

    function equipUnlockedRare() {
        if (window._lastUnlockedRareId) {
            selectRareSkin(window._lastUnlockedRareId);
        }
        closeUnlockCelebration();
    }

    function closeUnlockCelebration() {
        const modal = document.getElementById('rare-unlock-celebration');
        if (modal) modal.style.display = 'none';
        // Clear the viewer to stop loading
        const viewer = document.getElementById('unlock-rare-viewer');
        if (viewer) viewer.removeAttribute('src');
        window._lastUnlockedRareId = null;
    }

    function openRareRewardsModal() {
        const modal = document.getElementById('rare-rewards-modal');
        if (modal) {
            modal.style.display = 'flex';
            renderRaresGrid();
            previewRare(RARE_COLLECTION[0].id);
        }
    }

    function closeRareRewardsModal() {
        const modal = document.getElementById('rare-rewards-modal');
        if (modal) modal.style.display = 'none';
        const viewer = document.getElementById('rare-reward-viewer');
        if (viewer) viewer.src = '';
    }

    function renderRaresGrid() {
        const grid = document.getElementById('rares-grid');
        let userProgress = [];
        try { userProgress = JSON.parse(localStorage.getItem('user_rares_unlocked') || '[]'); } catch(e) {}
        grid.innerHTML = RARE_COLLECTION.map(rare => {
            const isUnlocked = userProgress.includes(rare.id);
            const tierData = RARE_TIERS[rare.tier] || RARE_TIERS.COMMON;
            return `
                <div onclick="previewRare('${rare.id}')" class="rare-item-card" style="aspect-ratio: 1; border: 2px solid ${isUnlocked ? tierData.color : '#f1f5f9'}; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; background: ${isUnlocked ? '#fffbeb' : 'white'};">
                    <div style="position: absolute; top: 4px; left: 4px; padding: 1px 5px; border-radius: 3px; font-size: 0.45rem; font-weight: 800; letter-spacing: 1px; background: ${tierData.gradient}; color: white;">${tierData.label}</div>
                    <div style="font-size: 2rem; filter: ${isUnlocked ? 'none' : 'grayscale(1) opacity(0.5)'};">${rare.emoji}</div>
                    <div style="font-size: 0.65rem; font-weight: 700; margin-top: 5px; color: ${isUnlocked ? 'var(--primary)' : '#94a3b8'};">${rare.name.toUpperCase()}</div>
                    ${!isUnlocked ? '<div style="position: absolute; top: 5px; right: 5px; font-size: 0.7rem;">🔒</div>' : ''}
                </div>
            `;
        }).join('');
    }

    // ============================================================
    // BADGE SYSTEM
    // ============================================================

    const BADGES = [
        // Workout Badges
        { id: 'workout_1',   name: 'First Rep',       emoji: '🏋️', desc: 'Complete your first workout', category: 'Workouts', req: { type: 'workouts', count: 1 } },
        { id: 'workout_5',   name: 'Getting Started',  emoji: '💪', desc: 'Complete 5 workouts', category: 'Workouts', req: { type: 'workouts', count: 5 } },
        { id: 'workout_10',  name: 'Double Digits',    emoji: '🔟', desc: 'Complete 10 workouts', category: 'Workouts', req: { type: 'workouts', count: 10 } },
        { id: 'workout_25',  name: 'Quarter Century',  emoji: '⚡', desc: 'Complete 25 workouts', category: 'Workouts', req: { type: 'workouts', count: 25 } },
        { id: 'workout_50',  name: 'Half Century',     emoji: '🔥', desc: 'Complete 50 workouts', category: 'Workouts', req: { type: 'workouts', count: 50 } },
        { id: 'workout_100', name: 'Centurion',        emoji: '💯', desc: 'Complete 100 workouts', category: 'Workouts', req: { type: 'workouts', count: 100 } },
        { id: 'workout_365', name: 'Year Round',       emoji: '🗓️', desc: 'Complete 365 workouts', category: 'Workouts', req: { type: 'workouts', count: 365 } },
        // Streak Badges
        { id: 'streak_7',    name: 'On Fire',          emoji: '🔥', desc: '7-day workout streak', category: 'Streaks', req: { type: 'streak', count: 7 } },
        { id: 'streak_14',   name: 'Dedicated',        emoji: '⭐', desc: '14-day workout streak', category: 'Streaks', req: { type: 'streak', count: 14 } },
        { id: 'streak_30',   name: 'Iron Will',        emoji: '🏅', desc: '30-day workout streak', category: 'Streaks', req: { type: 'streak', count: 30 } },
        { id: 'streak_60',   name: 'Unbreakable',      emoji: '💎', desc: '60-day workout streak', category: 'Streaks', req: { type: 'streak', count: 60 } },
        // Meal Badges
        { id: 'meal_1',      name: 'First Bite',       emoji: '🥗', desc: 'Track your first meal', category: 'Nutrition', req: { type: 'meals', count: 1 } },
        { id: 'meal_10',     name: 'Meal Prep',        emoji: '🍽️', desc: 'Track 10 meals', category: 'Nutrition', req: { type: 'meals', count: 10 } },
        { id: 'meal_50',     name: 'Nutrition Nerd',   emoji: '📊', desc: 'Track 50 meals', category: 'Nutrition', req: { type: 'meals', count: 50 } },
        { id: 'meal_100',    name: 'Centurion Chef',   emoji: '👨‍🍳', desc: 'Track 100 meals', category: 'Nutrition', req: { type: 'meals', count: 100 } },
        { id: 'meal_365',    name: 'Year of Eating',   emoji: '🏆', desc: 'Track 365 meals', category: 'Nutrition', req: { type: 'meals', count: 365 } },
        // Personal Best Badges
        { id: 'pb_1',        name: 'First PB',         emoji: '🥇', desc: 'Set your first personal best', category: 'PBs', req: { type: 'pbs', count: 1 } },
        { id: 'pb_10',       name: 'PB Machine',       emoji: '⚡', desc: 'Set 10 personal bests', category: 'PBs', req: { type: 'pbs', count: 10 } },
        { id: 'pb_25',       name: 'Record Breaker',   emoji: '💥', desc: 'Set 25 personal bests', category: 'PBs', req: { type: 'pbs', count: 25 } },
        { id: 'pb_50',       name: 'Limitless',        emoji: '🚀', desc: 'Set 50 personal bests', category: 'PBs', req: { type: 'pbs', count: 50 } },
        // Rare Collection Badges
        { id: 'rare_1',      name: 'First Drop',       emoji: '✨', desc: 'Unlock your first rare skin', category: 'Collection', req: { type: 'rares', count: 1 } },
        { id: 'rare_3',      name: 'Collector',        emoji: '🎭', desc: 'Unlock 3 rare skins', category: 'Collection', req: { type: 'rares', count: 3 } },
        { id: 'rare_6',      name: 'Rare Hunter',      emoji: '🏹', desc: 'Unlock 6 rare skins', category: 'Collection', req: { type: 'rares', count: 6 } },
        { id: 'rare_11',     name: 'Complete Set',     emoji: '👑', desc: 'Unlock all 11 rare skins', category: 'Collection', req: { type: 'rares', count: 11 } },
        // Challenge Badges
        { id: 'challenge_1', name: 'Challenger',       emoji: '⚔️', desc: 'Enter your first challenge', category: 'Challenges', req: { type: 'challenges_entered', count: 1 } },
        { id: 'challenge_3', name: 'Competitor',       emoji: '🎯', desc: 'Complete 3 challenges', category: 'Challenges', req: { type: 'challenges_completed', count: 3 } },
        { id: 'challenge_w1',name: 'Champion',         emoji: '🏆', desc: 'Win your first challenge', category: 'Challenges', req: { type: 'challenges_won', count: 1 } },
        { id: 'challenge_w5',name: 'Legendary',        emoji: '🌟', desc: 'Win 5 challenges', category: 'Challenges', req: { type: 'challenges_won', count: 5 } },
        // Level Badges
        { id: 'level_10',    name: 'Rising Star',      emoji: '⭐', desc: 'Reach level 10', category: 'Level', req: { type: 'level', count: 10 } },
        { id: 'level_30',    name: 'Veteran',          emoji: '🎖️', desc: 'Reach level 30', category: 'Level', req: { type: 'level', count: 30 } },
        { id: 'level_50',    name: 'Elite',            emoji: '💎', desc: 'Reach level 50', category: 'Level', req: { type: 'level', count: 50 } },
        { id: 'level_99',    name: 'Legend',           emoji: '👑', desc: 'Reach level 99', category: 'Level', req: { type: 'level', count: 99 } }
    ];

    const BADGE_CATEGORIES = ['Workouts', 'Streaks', 'Nutrition', 'PBs', 'Collection', 'Challenges', 'Level'];

    function getEarnedBadges() {
        try { return JSON.parse(localStorage.getItem('user_badges_earned') || '[]'); } catch(e) { return []; }
    }

    function isBadgeEarned(id) {
        return getEarnedBadges().includes(id);
    }

    function earnBadge(id) {
        const earned = getEarnedBadges();
        if (earned.includes(id)) return false;
        earned.push(id);
        localStorage.setItem('user_badges_earned', JSON.stringify(earned));
        return true;
    }

    // Show a badge-earned toast with animation
    function showBadgeToast(badge) {
        const existing = document.getElementById('badge-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'badge-toast';
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.6rem;">${badge.emoji}</span>
                <div>
                    <div style="font-weight: 800; font-size: 0.8rem; color: #fbbf24; letter-spacing: 1px;">BADGE UNLOCKED!</div>
                    <div style="font-weight: 700; font-size: 0.95rem; color: white;">${badge.name}</div>
                    <div style="font-size: 0.7rem; color: rgba(255,255,255,0.6);">${badge.desc}</div>
                </div>
            </div>
        `;
        Object.assign(toast.style, {
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%) translateY(-100px)',
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)', border: '1px solid rgba(251,191,36,0.3)',
            borderRadius: '16px', padding: '14px 20px', zIndex: '99999', boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(251,191,36,0.2)',
            transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease', opacity: '0', minWidth: '240px'
        });
        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(-50%) translateY(0)';
            toast.style.opacity = '1';
        });

        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(-100px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 3500);
    }

    // Award a badge and show toast if new
    function awardBadge(id) {
        const badge = BADGES.find(b => b.id === id);
        if (!badge) return;
        const isNew = earnBadge(id);
        if (isNew) {
            showBadgeToast(badge);
            renderBadgeOverlay();
        }
    }

    // Check badges by type against a count
    function checkBadgesForType(type, count) {
        BADGES.filter(b => b.req.type === type && count >= b.req.count).forEach(b => awardBadge(b.id));
    }

    // Individual check functions called from existing code
    async function checkWorkoutBadges() {
        if (!window.currentUser) return;
        try {
            const count = await dbHelpers.workouts.getWorkoutCount(window.currentUser.id);
            checkBadgesForType('workouts', count);
        } catch(e) { console.error('Badge check workouts error:', e); }
    }

    function checkStreakBadges(streakCount) {
        if (typeof streakCount === 'number') checkBadgesForType('streak', streakCount);
    }

    async function checkMealBadges() {
        if (!window.currentUser) return;
        try {
            const { data } = await window.supabaseClient
                .from('user_points')
                .select('total_meals_logged')
                .eq('user_id', window.currentUser.id)
                .maybeSingle();
            if (data?.total_meals_logged) checkBadgesForType('meals', data.total_meals_logged);
        } catch(e) { console.error('Badge check meals error:', e); }
    }

    async function checkPBBadges() {
        if (!window.currentUser) return;
        try {
            const { data, count } = await window.supabaseClient
                .from('personal_bests')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', window.currentUser.id);
            if (count != null) checkBadgesForType('pbs', count);
        } catch(e) { console.error('Badge check PBs error:', e); }
    }

    function checkRareBadges() {
        let rares = [];
        try { rares = JSON.parse(localStorage.getItem('user_rares_unlocked') || '[]'); } catch(e) {}
        checkBadgesForType('rares', rares.length);
    }

    async function checkChallengeBadges() {
        if (!window.currentUser) return;
        try {
            const { data: challenges } = await window.supabaseClient
                .from('challenge_participants')
                .select('challenge_id, status, challenges!inner(status, winner_id)')
                .eq('user_id', window.currentUser.id);
            if (!challenges) return;
            const entered = challenges.filter(c => c.status === 'accepted').length;
            const completed = challenges.filter(c => c.challenges?.status === 'completed').length;
            const won = challenges.filter(c => c.challenges?.winner_id === window.currentUser.id).length;
            checkBadgesForType('challenges_entered', entered);
            checkBadgesForType('challenges_completed', completed);
            checkBadgesForType('challenges_won', won);
        } catch(e) { console.error('Badge check challenges error:', e); }
    }

    function checkLevelBadges(level) {
        if (typeof level === 'number') checkBadgesForType('level', level);
    }

    // Master check — called on page load
    async function checkAllBadges() {
        if (!window.currentUser) return;
        try {
            await checkWorkoutBadges();
            await checkMealBadges();
            await checkPBBadges();
            checkRareBadges();
            await checkChallengeBadges();
            // Streak + level pulled from existing UI
            const streakEl = document.getElementById('tamagotchi-streak');
            if (streakEl) checkStreakBadges(parseInt(streakEl.textContent) || 0);
            const levelEl = document.getElementById('tamagotchi-level');
            if (levelEl) checkLevelBadges(parseInt(levelEl.textContent) || 0);
        } catch(e) { console.error('checkAllBadges error:', e); }
    }

    // Render the small badge overlay on tamagotchi screen
    function renderBadgeOverlay() {
        const container = document.getElementById('tamagotchi-widget-container');
        if (!container) return;

        let overlay = document.getElementById('badge-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'badge-overlay';
            Object.assign(overlay.style, {
                position: 'absolute', top: '10px', left: '10px', zIndex: '5',
                display: 'flex', alignItems: 'center', gap: '3px',
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
                borderRadius: '20px', padding: '4px 8px', cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.1)', maxWidth: '180px'
            });
            overlay.onclick = () => openBadgeModal();
            container.appendChild(overlay);
        }

        const earned = getEarnedBadges();
        const earnedBadges = BADGES.filter(b => earned.includes(b.id));
        const maxShow = 5;
        const shown = earnedBadges.slice(-maxShow);
        const overflow = earnedBadges.length - maxShow;

        if (earnedBadges.length === 0) {
            overlay.style.display = 'none';
            return;
        }

        overlay.style.display = 'flex';
        overlay.innerHTML = shown.map(b =>
            `<span title="${b.name}" style="font-size: 0.85rem; line-height: 1;">${b.emoji}</span>`
        ).join('') + (overflow > 0 ? `<span style="font-size: 0.6rem; color: rgba(255,255,255,0.7); font-weight: 700; margin-left: 2px;">+${overflow}</span>` : '');
    }

    // Open the full badge collection modal
    function openBadgeModal() {
        const modal = document.getElementById('badge-collection-modal');
        if (!modal) return;
        modal.style.display = 'flex';
        renderBadgeGrid();
    }

    function closeBadgeModal() {
        const modal = document.getElementById('badge-collection-modal');
        if (modal) modal.style.display = 'none';
    }

    function renderBadgeGrid() {
        const content = document.getElementById('badge-grid-content');
        if (!content) return;
        const earned = getEarnedBadges();
        const totalEarned = earned.length;
        const totalBadges = BADGES.length;

        // Progress header
        const progressPct = Math.round((totalEarned / totalBadges) * 100);
        let html = `
            <div style="text-align: center; margin-bottom: 20px;">
                <div style="font-size: 2rem; margin-bottom: 6px;">🏅</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: white;">${totalEarned} / ${totalBadges} Badges</div>
                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 10px; margin-top: 8px; overflow: hidden;">
                    <div style="width: ${progressPct}%; height: 100%; background: linear-gradient(90deg, #3b82f6, #fbbf24); border-radius: 10px; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;

        // Categories
        BADGE_CATEGORIES.forEach(cat => {
            const catBadges = BADGES.filter(b => b.category === cat);
            const catEarned = catBadges.filter(b => earned.includes(b.id)).length;

            html += `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <div style="font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1.5px;">${cat}</div>
                        <div style="font-size: 0.65rem; color: rgba(255,255,255,0.3); font-weight: 600;">${catEarned}/${catBadges.length}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
            `;

            catBadges.forEach(badge => {
                const isEarned = earned.includes(badge.id);
                html += `
                    <div style="text-align: center; padding: 10px 4px; background: ${isEarned ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}; border-radius: 12px; border: 1px solid ${isEarned ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)'}; ${isEarned ? 'box-shadow: 0 0 12px rgba(251,191,36,0.1);' : 'opacity: 0.4;'}">
                        <div style="font-size: 1.5rem; margin-bottom: 4px; ${isEarned ? '' : 'filter: grayscale(1); opacity: 0.5;'}">${isEarned ? badge.emoji : '❓'}</div>
                        <div style="font-size: 0.6rem; font-weight: 700; color: ${isEarned ? 'white' : 'rgba(255,255,255,0.4)'}; line-height: 1.2;">${isEarned ? badge.name : '???'}</div>
                        <div style="font-size: 0.5rem; color: rgba(255,255,255,0.35); margin-top: 2px; line-height: 1.2;">${badge.desc}</div>
                    </div>
                `;
            });

            html += `</div></div>`;
        });

        content.innerHTML = html;
    }

    // Init badges on page load (delayed to not block initial render)
    setTimeout(() => {
        renderBadgeOverlay();
        setTimeout(() => checkAllBadges(), 3000);
    }, 2000);

    function previewRare(id) {
        const rare = RARE_COLLECTION.find(r => r.id === id);
        if (!rare) return;
        const tierData = RARE_TIERS[rare.tier] || RARE_TIERS.COMMON;
        const viewer = document.getElementById('rare-reward-viewer');
        const loader = document.getElementById('rare-preview-loading');
        const info = document.getElementById('rare-info-panel');
        const nameEl = document.getElementById('rare-reward-name');
        const descEl = document.getElementById('rare-reward-desc');
        const statusEl = document.getElementById('rare-reward-status');
        if (!viewer) return;
        loader.style.display = 'flex';
        info.style.display = 'block';
        if (nameEl) nameEl.textContent = rare.name;
        if (descEl) descEl.textContent = `${tierData.label} • ${rare.desc} • ${tierData.buyIn.toLocaleString()} Coins`;
        let unlocked = false;
        try { unlocked = JSON.parse(localStorage.getItem('user_rares_unlocked') || '[]').includes(id); } catch(e) {}
        if (statusEl) {
            statusEl.textContent = unlocked ? '🎉 UNLOCKED' : '🏆 CHALLENGE DROPS ONLY';
            statusEl.style.background = unlocked ? '#f0fdf4' : '#fef3c7';
            statusEl.style.color = unlocked ? '#166534' : '#92400e';
        }
        viewer.src = rare.model;
        viewer.addEventListener('load', () => {
            loader.style.display = 'none';
        }, { once: true });
    }

    // Expose constants for other scripts
    window.RARE_COLLECTION = RARE_COLLECTION;
    window.DBZ_COLLECTION = DBZ_COLLECTION;
    window.RARE_TIERS = RARE_TIERS;
    window.selectRareSkin = selectRareSkin;
    window.selectRareSkinFromDBZ = selectRareSkinFromDBZ;
    window.isRareUnlocked = isRareUnlocked;
    window.clearRareSkin = clearRareSkin;
})();


