(function() {
    let customCardsCache = [];

    async function loadMyCards() {
        const user = window.currentUser;
        if (!user) return;
        try {
            const { data, error } = await window.supabaseClient
                .from('custom_cards')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false });
            if (error) throw error;
            customCardsCache = data || [];
        } catch (e) {
            console.warn('Failed to load custom cards:', e);
            const local = localStorage.getItem('custom_cards');
            customCardsCache = local ? JSON.parse(local) : [];
        }
    }

    async function saveCustomCard(cardType, title, description, cardData) {
        const user = window.currentUser;
        if (!user) return null;
        const record = {
            user_id: user.id, card_type: cardType, title: title,
            description: description || '', card_data: cardData || {}, is_active: true
        };
        try {
            const { data, error } = await window.supabaseClient
                .from('custom_cards').insert(record).select().single();
            if (error) throw error;
            customCardsCache.unshift(data);
            renderDashboardCustomCards();
            return data;
        } catch (e) {
            console.error('Failed to save card:', e);
            const localCards = JSON.parse(localStorage.getItem('custom_cards') || '[]');
            const localCard = { ...record, id: 'local_' + Date.now(), created_at: new Date().toISOString() };
            localCards.unshift(localCard);
            localStorage.setItem('custom_cards', JSON.stringify(localCards));
            customCardsCache.unshift(localCard);
            renderDashboardCustomCards();
            return localCard;
        }
    }

    async function deleteCard(cardId) {
        if (!confirm('Delete this custom card?')) return;
        const user = window.currentUser;
        try {
            if (cardId.startsWith('local_')) {
                const localCards = JSON.parse(localStorage.getItem('custom_cards') || '[]');
                localStorage.setItem('custom_cards', JSON.stringify(localCards.filter(c => c.id !== cardId)));
            } else if (user) {
                await window.supabaseClient.from('custom_cards').delete().eq('id', cardId).eq('user_id', user.id);
            }
            customCardsCache = customCardsCache.filter(c => c.id !== cardId);
            renderDashboardCustomCards();
        } catch (e) { console.error('Failed to delete card:', e); }
    }

    function openCard(cardId) {
        const card = customCardsCache.find(c => c.id === cardId);
        if (!card) return;
        if (card.card_type === 'quiz') playCustomQuiz(card);
        else if (card.card_type === 'checklist') openCustomChecklist(card);
        else if (card.card_type === 'tracker') openCustomTracker(card);
        else if (card.card_type === 'challenge') openCustomChallenge(card);
    }

    function playCustomQuiz(card) {
        const games = card.card_data?.games;
        if (!games || games.length === 0) return;
        if (typeof window.playCustomQuizGames === 'function') {
            window.playCustomQuizGames(card.title, card.card_data);
            return;
        }
        let currentQ = 0, score = 0;

        function showQuestion() {
            if (currentQ >= games.length) { showQuizResult(); return; }
            const game = games[currentQ];
            let html = '';
            const qLabel = `<div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">Question ${currentQ + 1} of ${games.length}</div>`;

            if (game.type === 'swipe_true_false') {
                html = `<div style="text-align: center; padding: 20px;">${qLabel}<div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 24px; line-height: 1.4;">${game.question}</div><div style="display: flex; gap: 12px; justify-content: center;"><button onclick="window._quizAnswer(true)" style="flex: 1; max-width: 140px; padding: 14px; background: #10b981; color: white; border: none; border-radius: 14px; font-weight: 700; font-size: 1rem; cursor: pointer;">TRUE</button><button onclick="window._quizAnswer(false)" style="flex: 1; max-width: 140px; padding: 14px; background: #ef4444; color: white; border: none; border-radius: 14px; font-weight: 700; font-size: 1rem; cursor: pointer;">FALSE</button></div></div>`;
            } else if (game.type === 'fill_blank') {
                const btns = game.options.map(opt => `<button onclick="window._quizAnswer('${opt}')" style="padding: 10px 18px; background: #f1f5f9; color: var(--text-main); border: 2px solid #e2e8f0; border-radius: 12px; font-weight: 600; font-size: 0.9rem; cursor: pointer;">${opt}</button>`).join('');
                html = `<div style="text-align: center; padding: 20px;">${qLabel}<div style="font-size: 1rem; font-weight: 600; color: var(--text-main); margin-bottom: 20px; line-height: 1.4;">${game.sentence}</div><div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">${btns}</div></div>`;
            } else if (game.type === 'tap_all') {
                const opts = game.options.map((opt, i) => `<button data-idx="${i}" data-correct="${opt.correct}" onclick="this.classList.toggle('selected'); this.style.borderColor = this.classList.contains('selected') ? '#8b5cf6' : '#e2e8f0'; this.style.background = this.classList.contains('selected') ? '#ede9fe' : '#f8fafc';" style="padding: 12px 16px; background: #f8fafc; color: var(--text-main); border: 2px solid #e2e8f0; border-radius: 12px; font-size: 0.9rem; cursor: pointer; text-align: left;">${opt.text}</button>`).join('');
                html = `<div style="text-align: center; padding: 20px;">${qLabel.replace('</div>', ' — Tap all correct</div>')}<div style="font-size: 1rem; font-weight: 600; color: var(--text-main); margin-bottom: 16px; line-height: 1.4;">${game.question}</div><div id="quiz-tap-options" style="display: flex; flex-direction: column; gap: 8px;">${opts}</div><button onclick="window._quizSubmitTapAll()" style="margin-top: 14px; padding: 12px 28px; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer;">Submit</button></div>`;
            } else if (game.type === 'scenario_story') {
                const sopts = game.options.map(opt => `<button onclick="window._quizAnswer(${opt.correct})" style="padding: 12px 16px; background: #f8fafc; color: var(--text-main); border: 2px solid #e2e8f0; border-radius: 12px; font-size: 0.9rem; cursor: pointer; text-align: left;">${opt.text}</button>`).join('');
                html = `<div style="text-align: center; padding: 20px;">${qLabel}<div style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4; font-style: italic;">${game.scenario}</div><div style="font-size: 1rem; font-weight: 600; color: var(--text-main); margin-bottom: 16px;">${game.question}</div><div style="display: flex; flex-direction: column; gap: 8px;">${sopts}</div></div>`;
            } else { currentQ++; showQuestion(); return; }

            const modal = document.getElementById('custom-quiz-modal') || createQuizModal();
            document.getElementById('custom-quiz-body').innerHTML = html;
        }

        function createQuizModal() {
            const modal = document.createElement('div');
            modal.id = 'custom-quiz-modal';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center; padding: 20px;';
            modal.innerHTML = `<div style="background: white; border-radius: 20px; width: 100%; max-width: 400px; max-height: 80vh; overflow-y: auto; position: relative;"><button onclick="document.getElementById('custom-quiz-modal').remove()" style="position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 1.3rem; cursor: pointer; color: #94a3b8; z-index: 1;">&#x2715;</button><div id="custom-quiz-body"></div></div>`;
            document.body.appendChild(modal);
            return modal;
        }

        window._quizAnswer = function(answer) {
            const game = games[currentQ];
            let correct = false;
            if (game.type === 'swipe_true_false') correct = answer === game.answer;
            else if (game.type === 'fill_blank') correct = answer === game.answer;
            else if (game.type === 'scenario_story') correct = answer === true;
            if (correct) score++;
            currentQ++;
            showQuestion();
        };

        window._quizSubmitTapAll = function() {
            const btns = document.querySelectorAll('#quiz-tap-options button');
            let allCorrect = true;
            btns.forEach(btn => {
                if (btn.classList.contains('selected') !== (btn.dataset.correct === 'true')) allCorrect = false;
            });
            if (allCorrect) score++;
            currentQ++;
            showQuestion();
        };

        function showQuizResult() {
            const pct = Math.round((score / games.length) * 100);
            const modal = document.getElementById('custom-quiz-modal');
            if (!modal) return;
            document.getElementById('custom-quiz-body').innerHTML = `<div style="text-align: center; padding: 30px 20px;"><div style="font-size: 2.5rem; margin-bottom: 12px;">${pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚'}</div><div style="font-size: 1.3rem; font-weight: 800; color: var(--text-main); margin-bottom: 6px;">${score}/${games.length}</div><div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 20px;">${pct >= 80 ? 'Nailed it!' : pct >= 50 ? 'Good effort!' : 'Keep learning!'}</div><button onclick="document.getElementById('custom-quiz-modal').remove()" style="padding: 12px 28px; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: white; border: none; border-radius: 14px; font-weight: 700; font-size: 1rem; cursor: pointer;">Done</button></div>`;
        }
        showQuestion();
    }

    function openCustomChecklist(card) {
        const items = card.card_data?.items || [];
        const todayKey = `checklist_${card.id}_${getLocalDateString()}`;
        const checked = JSON.parse(localStorage.getItem(todayKey) || '[]');
        const icon = card.card_data?.icon || '✅';
        const modal = document.createElement('div');
        modal.id = 'custom-checklist-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center; padding: 20px;';
        const itemsHtml = items.map((item, i) => {
            const text = typeof item === 'string' ? item : item.text;
            const isChecked = checked.includes(i);
            return `<label style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: ${isChecked ? '#f0fdf4' : '#f8fafc'}; border-radius: 12px; cursor: pointer; border: 1px solid ${isChecked ? '#86efac' : '#e2e8f0'};"><input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window._checklistToggle('${todayKey}', ${i}, this.checked)" style="width: 18px; height: 18px; accent-color: #10b981;"><span style="font-size: 0.9rem; color: var(--text-main); ${isChecked ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${text}</span></label>`;
        }).join('');
        modal.innerHTML = `<div style="background: white; border-radius: 20px; width: 100%; max-width: 400px; max-height: 80vh; overflow-y: auto; position: relative; padding: 24px 20px;"><button onclick="document.getElementById('custom-checklist-modal').remove()" style="position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 1.3rem; cursor: pointer; color: #94a3b8;">&#x2715;</button><div style="text-align: center; margin-bottom: 16px;"><span style="font-size: 1.5rem;">${icon}</span><div style="font-weight: 700; font-size: 1.05rem; margin-top: 4px;">${card.title}</div></div><div style="display: flex; flex-direction: column; gap: 10px;">${itemsHtml}</div></div>`;
        document.body.appendChild(modal);
    }

    window._checklistToggle = function(key, index, isChecked) {
        const checked = JSON.parse(localStorage.getItem(key) || '[]');
        if (isChecked && !checked.includes(index)) checked.push(index);
        else if (!isChecked) { const idx = checked.indexOf(index); if (idx >= 0) checked.splice(idx, 1); }
        localStorage.setItem(key, JSON.stringify(checked));
    };

    function openCustomTracker(card) {
        const metrics = card.card_data?.metrics || [];
        const todayKey = `tracker_${card.id}_${getLocalDateString()}`;
        const saved = JSON.parse(localStorage.getItem(todayKey) || '{}');
        const icon = card.card_data?.icon || '📊';
        const modal = document.createElement('div');
        modal.id = 'custom-tracker-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center; padding: 20px;';
        const metricsHtml = metrics.map(m => {
            if (m.type === 'boolean') {
                return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #f8fafc; border-radius: 12px;"><span style="font-weight: 600; font-size: 0.9rem;">${m.name}</span><input type="checkbox" ${saved[m.name] ? 'checked' : ''} data-metric="${m.name}" style="width: 20px; height: 20px; accent-color: #10b981;"></div>`;
            } else if (m.type === 'rating') {
                const stars = [1,2,3,4,5].map(n => `<button data-metric="${m.name}" data-val="${n}" style="width: 36px; height: 36px; border-radius: 50%; border: none; background: ${(saved[m.name] || 0) >= n ? '#fbbf24' : '#e2e8f0'}; font-size: 0.9rem; cursor: pointer; font-weight: 700;">${n}</button>`).join('');
                return `<div style="padding: 12px 14px; background: #f8fafc; border-radius: 12px;"><div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 8px;">${m.name}</div><div style="display: flex; gap: 6px; justify-content: center;">${stars}</div></div>`;
            } else {
                return `<div style="padding: 12px 14px; background: #f8fafc; border-radius: 12px;"><div style="display: flex; justify-content: space-between; align-items: center;"><span style="font-weight: 600; font-size: 0.9rem;">${m.name}</span>${m.goal ? `<span style="font-size: 0.78rem; color: var(--text-muted);">Goal: ${m.goal} ${m.unit || ''}</span>` : ''}</div><div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;"><input type="number" data-metric="${m.name}" value="${saved[m.name] || ''}" placeholder="0" style="flex: 1; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 1rem; outline: none;">${m.unit ? `<span style="font-size: 0.85rem; color: var(--text-muted);">${m.unit}</span>` : ''}</div></div>`;
            }
        }).join('');
        modal.innerHTML = `<div style="background: white; border-radius: 20px; width: 100%; max-width: 400px; max-height: 80vh; overflow-y: auto; position: relative; padding: 24px 20px;"><button onclick="document.getElementById('custom-tracker-modal').remove()" style="position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 1.3rem; cursor: pointer; color: #94a3b8;">&#x2715;</button><div style="text-align: center; margin-bottom: 16px;"><span style="font-size: 1.5rem;">${icon}</span><div style="font-weight: 700; font-size: 1.05rem; margin-top: 4px;">${card.title}</div></div><div style="display: flex; flex-direction: column; gap: 14px;">${metricsHtml}</div><button onclick="window._trackerSave('${card.id}', '${todayKey}')" style="margin-top: 16px; width: 100%; padding: 14px; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; border: none; border-radius: 14px; font-weight: 700; font-size: 1rem; cursor: pointer;">Save Today's Log</button></div>`;
        document.body.appendChild(modal);
    }

    window._trackerSave = function(cardId, todayKey) {
        const modal = document.getElementById('custom-tracker-modal');
        if (!modal) return;
        const data = {};
        modal.querySelectorAll('[data-metric]').forEach(el => {
            const name = el.dataset.metric;
            if (el.type === 'checkbox') data[name] = el.checked;
            else if (el.type === 'number') data[name] = parseFloat(el.value) || 0;
            else if (el.dataset.val) {
                const rating = parseInt(el.dataset.val);
                if (el.style.background.includes('fbbf24')) data[name] = Math.max(data[name] || 0, rating);
            }
        });
        localStorage.setItem(todayKey, JSON.stringify(data));
        const user = window.currentUser;
        if (user) {
            window.supabaseClient.from('custom_card_logs').upsert({
                card_id: cardId, user_id: user.id,
                log_date: getLocalDateString(), log_data: data
            }, { onConflict: 'card_id,log_date' }).then(() => {}).catch(() => {});
        }
        modal.remove();
    };

    function openCustomChallenge(card) {
        const data = card.card_data || {};
        const icon = data.icon || '🏆';
        const startKey = `challenge_start_${card.id}`;
        const startDate = localStorage.getItem(startKey);
        let dayNum = 0, started = false;
        if (startDate) { started = true; dayNum = Math.floor((Date.now() - new Date(startDate).getTime()) / 86400000) + 1; }
        const progress = started ? Math.min(Math.round((dayNum / (data.duration_days || 30)) * 100), 100) : 0;
        const modal = document.createElement('div');
        modal.id = 'custom-challenge-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center; padding: 20px;';
        let rulesHtml = '';
        if (data.rules) data.rules.forEach(r => { rulesHtml += `<div style="font-size: 0.88rem; color: var(--text-main); padding: 4px 0;">&#x2022; ${r}</div>`; });
        const criteriaHtml = data.success_criteria ? `<div style="padding: 12px 14px; background: #f0fdf4; border-radius: 12px; margin-bottom: 14px;"><div style="font-weight: 600; font-size: 0.82rem; color: #16a34a; margin-bottom: 2px;">Success Criteria</div><div style="font-size: 0.85rem; color: var(--text-main);">${data.success_criteria}</div></div>` : '';
        let progressHtml = '';
        if (started) {
            progressHtml = `<div style="margin-bottom: 14px;"><div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted); margin-bottom: 6px;"><span>Day ${dayNum} of ${data.duration_days || '?'}</span><span>${progress}%</span></div><div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;"><div style="height: 100%; width: ${progress}%; background: linear-gradient(90deg, #f59e0b, #ef4444); border-radius: 4px;"></div></div></div>`;
            if (progress >= 100) progressHtml += `<div style="text-align: center; padding: 12px; background: linear-gradient(135deg, #f59e0b, #ef4444); border-radius: 14px; color: white; font-weight: 700;">Challenge Complete!${data.xp_reward ? ' +' + data.xp_reward + ' XP' : ''}</div>`;
        } else {
            progressHtml = `<button onclick="localStorage.setItem('${startKey}', new Date().toISOString()); document.getElementById('custom-challenge-modal').remove(); window._customCardOpen('${card.id}')" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #f59e0b, #ef4444); color: white; border: none; border-radius: 14px; font-weight: 700; font-size: 1rem; cursor: pointer;">Start Challenge</button>`;
        }
        modal.innerHTML = `<div style="background: white; border-radius: 20px; width: 100%; max-width: 400px; max-height: 80vh; overflow-y: auto; position: relative; padding: 24px 20px;"><button onclick="document.getElementById('custom-challenge-modal').remove()" style="position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 1.3rem; cursor: pointer; color: #94a3b8;">&#x2715;</button><div style="text-align: center; margin-bottom: 16px;"><span style="font-size: 2rem;">${icon}</span><div style="font-weight: 700; font-size: 1.1rem; margin-top: 6px;">${card.title}</div><div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">${data.duration_days || '?'} day challenge</div></div>${rulesHtml ? '<div style="margin-bottom: 14px;">' + rulesHtml + '</div>' : ''}${criteriaHtml}${progressHtml}</div>`;
        document.body.appendChild(modal);
    }

    function renderDashboardCustomCards() {
        let container = document.getElementById('dashboard-custom-cards');
        if (!container) {
            const aiCard = document.getElementById('ai-assistant-card');
            if (!aiCard) return;
            container = document.createElement('div');
            container.id = 'dashboard-custom-cards';
            aiCard.parentNode.insertBefore(container, aiCard.nextSibling);
        }
        if (customCardsCache.length === 0) { container.innerHTML = ''; return; }
        const typeIcons = { quiz: '🧠', tracker: '📊', challenge: '🏆', checklist: '✅' };
        const typeGradients = {
            quiz: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            tracker: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
            challenge: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            checklist: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        };
        const cards = customCardsCache.slice(0, 4);
        container.innerHTML = `<div style="margin: 0 25px 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">${cards.map(card => {
            const icon = card.card_data?.icon || typeIcons[card.card_type] || '📋';
            const gradient = typeGradients[card.card_type] || typeGradients.quiz;
            return `<div onclick="window._customCardOpen('${card.id}')" style="background: ${gradient}; border-radius: 14px; padding: 16px; color: white; cursor: pointer; position: relative; overflow: hidden; min-height: 80px;"><div style="position: absolute; top: -15px; right: -15px; width: 60px; height: 60px; background: rgba(255,255,255,0.1); border-radius: 50%;"></div><div style="font-size: 1.3rem; margin-bottom: 6px;">${icon}</div><div style="font-weight: 700; font-size: 0.85rem; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${card.title}</div><div style="font-size: 0.72rem; opacity: 0.85; text-transform: capitalize; margin-top: 2px;">${card.card_type}</div></div>`;
        }).join('')}</div>`;
    }

    window._customCardOpen = openCard;
    window._customCardDelete = deleteCard;
    window.saveCustomCard = saveCustomCard;
    window.renderDashboardCustomCards = renderDashboardCustomCards;
    window.loadMyCustomCards = loadMyCards;
    window.getCustomCardsCache = function() { return customCardsCache; };

    setTimeout(() => {
        if (window.currentUser) loadMyCards().then(() => renderDashboardCustomCards());
    }, 3000);
})();