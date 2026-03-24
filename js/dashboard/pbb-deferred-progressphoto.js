// ===== WEEKLY PROGRESS PHOTO CARD LOGIC =====

    /**
     * Check if it's Monday and user hasn't uploaded a progress photo this week.
     * Shows the card only on Mondays (or any day the user hasn't done it that week).
     */
    async function checkAndShowProgressPhotoCard() {
        if (!window.currentUser) return;
        if (window._onboardingWizardPending) return;
        const wizard = document.getElementById('onboarding-wizard');
        if (wizard && wizard.style.display !== 'none') return;

        const card = document.getElementById('weekly-progress-photo-card');
        const doneCard = document.getElementById('weekly-progress-photo-done-card');
        const uploadingCard = document.getElementById('weekly-progress-photo-uploading');
        if (!card || !doneCard) return;

        try {
            // Only show on Mondays (day 1)
            const today = new Date();
            if (today.getDay() !== 1) {
                card.style.display = 'none';
                doneCard.style.display = 'none';
                if (uploadingCard) uploadingCard.style.display = 'none';
                return;
            }

            // Check if user already uploaded this week
            const thisWeeksPhoto = await db.progressPhotos.getThisWeeksPhoto(window.currentUser.id);

            if (thisWeeksPhoto) {
                // Already done this week
                card.style.display = 'none';
                if (uploadingCard) uploadingCard.style.display = 'none';
                const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
                const isDismissedLocal = localStorage.getItem('progressPhotoDoneCardDismissedDate') === today;
                const isDismissedCloud = (window._pbbDismissedDates && window._pbbDismissedDates['progressPhotoDoneCard']) === today;

                if (isDismissedLocal || isDismissedCloud) {
                    doneCard.style.display = 'none';
                    if (isDismissedCloud && !isDismissedLocal) {
                        try { localStorage.setItem('progressPhotoDoneCardDismissedDate', today); } catch(e) {}
                    }
                } else {
                    doneCard.style.display = 'flex';
                }
            } else {
                // Show the upload card
                card.style.display = 'block';
                doneCard.style.display = 'none';
                if (uploadingCard) uploadingCard.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking progress photo status:', error);
        }
    }

    /**
     * Handle progress photo file selection and upload
     */
    async function handleProgressPhotoSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const card = document.getElementById('weekly-progress-photo-card');
        const uploadingCard = document.getElementById('weekly-progress-photo-uploading');
        const doneCard = document.getElementById('weekly-progress-photo-done-card');

        try {
            // Show uploading state
            if (card) card.style.display = 'none';
            if (uploadingCard) uploadingCard.style.display = 'block';

            const userId = window.currentUser?.id;

            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Upload photo to B2
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', userId);

            const uploadResponse = await fetch('/api/upload-progress-photo', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || 'Failed to upload photo');
            }

            const uploadData = await uploadResponse.json();

            // Save to database
            await db.progressPhotos.save(userId, uploadData.url, uploadData.fileName);

            // Award 15 XP (add to lifetime_points for leveling)
            try {
                const { data: currentPoints } = await supabaseClient
                    .from('user_points')
                    .select('lifetime_points')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (currentPoints) {
                    await supabaseClient
                        .from('user_points')
                        .update({ lifetime_points: (currentPoints.lifetime_points || 0) + 15 })
                        .eq('user_id', userId);
                } else {
                    await supabaseClient
                        .from('user_points')
                        .insert({ user_id: userId, lifetime_points: 15, current_points: 0 });
                }

                if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
                if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
            } catch (xpError) {
                console.log('XP award skipped:', xpError);
            }

            // Show success - transition to done card
            if (uploadingCard) uploadingCard.style.display = 'none';
            if (doneCard) doneCard.style.display = 'flex';

            // Refresh points display if visible
            if (typeof refreshPointsDisplay === 'function') {
                refreshPointsDisplay();
            }

            console.log('Progress photo uploaded successfully!');

        } catch (error) {
            console.error('Error uploading progress photo:', error);
            if (uploadingCard) uploadingCard.style.display = 'none';
            if (card) card.style.display = 'block';
            alert('Failed to upload progress photo. Please try again.');
        }

        // Reset file input so same file can be re-selected
        event.target.value = '';
    }

    function dismissProgressPhotoDoneCard() {
        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
        try {
            localStorage.setItem('progressPhotoDoneCardDismissedDate', today);
        } catch (e) { console.warn('localStorage full', e); }
        
        // Sync to cloud
        if (typeof window.syncTrendDismissalToDb === 'function') {
            window.syncTrendDismissalToDb('progressPhotoDoneCard', today);
        }

        var el = document.getElementById('weekly-progress-photo-done-card');
        if (el) el.style.display = 'none';
    }

    // Set up event listeners
    (function() {
        // Card click opens getUserMedia camera instead of file input (which opens gallery in Capacitor WebView)
        var photoCard = document.getElementById('weekly-progress-photo-card');
        var photoInput = document.getElementById('progress-photo-input');
        if (photoCard) {
            photoCard.onclick = function() {
                openWorkoutCamera(function(file) {
                    handleProgressPhotoCaptureFromFile(file);
                }, 'Take your progress photo');
            };
        }
        // Keep file input handler as legacy fallback
        if (photoInput) {
            photoInput.onchange = handleProgressPhotoSelect;
        }
    })();

    // Handle progress photo from a File object (from getUserMedia camera modal)
    async function handleProgressPhotoCaptureFromFile(file) {
        if (!file) return;

        var card = document.getElementById('weekly-progress-photo-card');
        var uploadingCard = document.getElementById('weekly-progress-photo-uploading');
        var doneCard = document.getElementById('weekly-progress-photo-done-card');

        try {
            if (card) card.style.display = 'none';
            if (uploadingCard) uploadingCard.style.display = 'block';

            var userId = window.currentUser?.id;
            if (!userId) throw new Error('User not authenticated');

            var formData = new FormData();
            formData.append('file', file);
            formData.append('userId', userId);

            var uploadResponse = await fetch('/api/upload-progress-photo', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                var errorData = await uploadResponse.json();
                throw new Error(errorData.error || 'Failed to upload photo');
            }

            var uploadData = await uploadResponse.json();
            await db.progressPhotos.save(userId, uploadData.url, uploadData.fileName);

            try {
                var { data: currentPoints } = await supabaseClient
                    .from('user_points')
                    .select('lifetime_points')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (currentPoints) {
                    await supabaseClient
                        .from('user_points')
                        .update({ lifetime_points: (currentPoints.lifetime_points || 0) + 15 })
                        .eq('user_id', userId);
                } else {
                    await supabaseClient
                        .from('user_points')
                        .insert({ user_id: userId, lifetime_points: 15, current_points: 0 });
                }

                if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
                if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
            } catch (xpError) {
                console.log('XP award skipped:', xpError);
            }

            if (uploadingCard) uploadingCard.style.display = 'none';
            if (doneCard) doneCard.style.display = 'flex';

            if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay();
            console.log('Progress photo uploaded successfully!');

        } catch (error) {
            console.error('Error uploading progress photo:', error);
            if (uploadingCard) uploadingCard.style.display = 'none';
            if (card) card.style.display = 'block';
            alert('Failed to upload progress photo. Please try again.');
        }
    }
    window.handleProgressPhotoCaptureFromFile = handleProgressPhotoCaptureFromFile;

    // Make functions globally available
    window.dismissProgressPhotoDoneCard = dismissProgressPhotoDoneCard;
    window.checkAndShowProgressPhotoCard = checkAndShowProgressPhotoCard;