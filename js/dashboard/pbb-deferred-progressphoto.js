// ===== WEEKLY PROGRESS PHOTO CARD LOGIC =====

const PROGRESS_PHOTO_PROMPT_START_HOUR = 5;
const PROGRESS_PHOTO_PROMPT_END_HOUR = 5;
let progressPhotoPromptRefreshTimer = null;

    /**
     * Progress photo prompt window: Monday 5am through Tuesday 5am, local time.
     */
    function isProgressPhotoPromptWindow(now) {
        const date = now || new Date();
        const day = date.getDay(); // 0=Sun, 1=Mon, 2=Tue
        const hour = date.getHours();
        return (day === 1 && hour >= PROGRESS_PHOTO_PROMPT_START_HOUR)
            || (day === 2 && hour < PROGRESS_PHOTO_PROMPT_END_HOUR);
    }

    function getNextProgressPhotoPromptBoundary(now) {
        const date = now || new Date();
        const next = new Date(date);
        next.setMinutes(0, 0, 0);

        const day = date.getDay();
        const hour = date.getHours();

        if (day === 1 && hour < PROGRESS_PHOTO_PROMPT_START_HOUR) {
            next.setHours(PROGRESS_PHOTO_PROMPT_START_HOUR, 0, 0, 0);
            return next;
        }

        if (isProgressPhotoPromptWindow(date)) {
            if (day === 1) {
                next.setDate(date.getDate() + 1);
            }
            next.setHours(PROGRESS_PHOTO_PROMPT_END_HOUR, 0, 0, 0);
            return next;
        }

        const daysUntilMonday = ((8 - day) % 7) || 7;
        next.setDate(date.getDate() + daysUntilMonday);
        next.setHours(PROGRESS_PHOTO_PROMPT_START_HOUR, 0, 0, 0);
        return next;
    }

    function scheduleProgressPhotoPromptRefresh() {
        if (progressPhotoPromptRefreshTimer) {
            clearTimeout(progressPhotoPromptRefreshTimer);
            progressPhotoPromptRefreshTimer = null;
        }

        const now = new Date();
        const nextBoundary = getNextProgressPhotoPromptBoundary(now);
        const delay = Math.max(0, nextBoundary.getTime() - now.getTime()) + 1000;

        if (delay > 0 && delay < 2147483647) {
            progressPhotoPromptRefreshTimer = setTimeout(function() {
                checkAndShowProgressPhotoCard();
            }, delay);
        }
    }

    function getProgressPhotoDismissKey() {
        try {
            if (window.db?.progressPhotos?._getCurrentWeekMonday) {
                return window.db.progressPhotos._getCurrentWeekMonday();
            }
        } catch (e) {}

        return typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
    }

    async function awardProgressPhotoXP(userId, photoRecord, file) {
        if (!userId || !photoRecord?.id) return null;

        try {
            const photoTimestamp = new Date(file?.lastModified || Date.now()).toISOString();
            const result = await window.db?.points?.awardPoints(
                userId,
                'progress_photo',
                photoRecord.id,
                { photoTimestamp, aiConfidence: 'high' }
            );

            if (result?.success) {
                if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
                if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
                if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay();
                return result;
            }

            console.warn('Progress photo XP award skipped:', result?.reason || result?.error || result);
        } catch (xpError) {
            console.warn('Progress photo XP award failed:', xpError);
        }

        return null;
    }

    /**
     * Check if the Monday prompt window is open and the user has not uploaded
     * a progress photo this week.
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
            scheduleProgressPhotoPromptRefresh();
            const today = new Date();
            if (!isProgressPhotoPromptWindow(today)) {
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
                const dismissKey = getProgressPhotoDismissKey();
                const isDismissedLocal = localStorage.getItem('progressPhotoDoneCardDismissedDate') === dismissKey;
                const isDismissedCloud = (window._pbbDismissedDates && window._pbbDismissedDates['progressPhotoDoneCard']) === dismissKey;

                if (isDismissedLocal || isDismissedCloud) {
                    doneCard.style.display = 'none';
                    if (isDismissedCloud && !isDismissedLocal) {
                        try { localStorage.setItem('progressPhotoDoneCardDismissedDate', dismissKey); } catch(e) {}
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
            const savedPhoto = await db.progressPhotos.save(userId, uploadData.url, uploadData.fileName);
            await awardProgressPhotoXP(userId, savedPhoto, file);

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
        const dismissKey = getProgressPhotoDismissKey();
        try {
            localStorage.setItem('progressPhotoDoneCardDismissedDate', dismissKey);
        } catch (e) { console.warn('localStorage full', e); }
        
        // Sync to cloud
        if (typeof window.syncTrendDismissalToDb === 'function') {
            window.syncTrendDismissalToDb('progressPhotoDoneCard', dismissKey);
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
            var savedPhoto = await db.progressPhotos.save(userId, uploadData.url, uploadData.fileName);
            await awardProgressPhotoXP(userId, savedPhoto, file);

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
    window.awardProgressPhotoXP = awardProgressPhotoXP;
    window.isProgressPhotoPromptWindow = isProgressPhotoPromptWindow;

    // Make functions globally available
    window.dismissProgressPhotoDoneCard = dismissProgressPhotoDoneCard;
    window.checkAndShowProgressPhotoCard = checkAndShowProgressPhotoCard;
