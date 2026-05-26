// ===== WEEKLY PROGRESS PHOTO CARD LOGIC =====

const PROGRESS_PHOTO_PROMPT_START_HOUR = 0;
const PROGRESS_PHOTO_PROMPT_END_HOUR = 5;
const PROGRESS_PHOTO_COMPLETED_KEY = 'progressPhotoCompletedWeek';
const PROGRESS_PHOTO_SHOTS = [
    {
        key: 'front',
        title: 'Front facing',
        label: 'Take front-facing photo',
        guide: 'Face the camera with your whole body in frame.'
    },
    {
        key: 'side',
        title: 'Side facing',
        label: 'Take side-facing photo',
        guide: 'Turn sideways and keep the same distance from the camera.'
    },
    {
        key: 'back',
        title: 'Back facing',
        label: 'Take back-facing photo',
        guide: 'Face away from the camera with your whole body in frame.'
    }
];
let progressPhotoPromptRefreshTimer = null;
let progressPhotoPromptCheckTimer = null;
let progressPhotoCaptureState = null;

    /**
     * Progress photo prompt window: all Monday through Tuesday 5am, local time.
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

    function requestProgressPhotoCardCheck(delayMs) {
        if (progressPhotoPromptCheckTimer) {
            clearTimeout(progressPhotoPromptCheckTimer);
            progressPhotoPromptCheckTimer = null;
        }

        progressPhotoPromptCheckTimer = setTimeout(function() {
            progressPhotoPromptCheckTimer = null;
            checkAndShowProgressPhotoCard();
        }, Math.max(0, delayMs || 0));
    }

    function hideProgressPhotoCards(card, doneCard, uploadingCard) {
        if (card) card.style.display = 'none';
        if (doneCard) doneCard.style.display = 'none';
        if (uploadingCard) uploadingCard.style.display = 'none';
    }

    function showProgressPhotoUploadCard(card, doneCard, uploadingCard) {
        if (card) card.style.display = 'block';
        if (doneCard) doneCard.style.display = 'none';
        if (uploadingCard) uploadingCard.style.display = 'none';
    }

    function showProgressPhotoCompletedState(card, doneCard, uploadingCard) {
        if (card) card.style.display = 'none';
        if (uploadingCard) uploadingCard.style.display = 'none';

        const dismissKey = getProgressPhotoDismissKey();
        const isDismissedLocal = localStorage.getItem('progressPhotoDoneCardDismissedDate') === dismissKey;
        const isDismissedCloud = (window._pbbDismissedDates && window._pbbDismissedDates['progressPhotoDoneCard']) === dismissKey;

        if (isDismissedLocal || isDismissedCloud) {
            if (doneCard) doneCard.style.display = 'none';
            if (isDismissedCloud && !isDismissedLocal) {
                try { localStorage.setItem('progressPhotoDoneCardDismissedDate', dismissKey); } catch(e) {}
            }
        } else if (doneCard) {
            doneCard.style.display = 'flex';
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

    function markProgressPhotoCompletedForCurrentWeek() {
        const completionKey = getProgressPhotoDismissKey();
        window._pbbProgressPhotoCompletedWeek = completionKey;
        try {
            localStorage.setItem(PROGRESS_PHOTO_COMPLETED_KEY, completionKey);
        } catch (e) {}
        return completionKey;
    }

    function isProgressPhotoCompletedForCurrentWeek() {
        const completionKey = getProgressPhotoDismissKey();
        if (window._pbbProgressPhotoCompletedWeek === completionKey) return true;
        try {
            if (localStorage.getItem(PROGRESS_PHOTO_COMPLETED_KEY) === completionKey) {
                window._pbbProgressPhotoCompletedWeek = completionKey;
                return true;
            }
        } catch (e) {}
        return false;
    }

    function setProgressPhotoUploadingCopy(text) {
        const copy = document.getElementById('weekly-progress-photo-uploading-copy');
        if (copy) copy.textContent = text || 'Uploading your progress photos...';
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
                hideProgressPhotoCards(card, doneCard, uploadingCard);
                return;
            }

            if (isProgressPhotoCompletedForCurrentWeek()) {
                showProgressPhotoCompletedState(card, doneCard, uploadingCard);
                return;
            }

            const progressPhotos = window.db && window.db.progressPhotos;
            if (!progressPhotos || typeof progressPhotos.getThisWeeksPhoto !== 'function') {
                window._pbbProgressPhotoLastCheckError = 'progressPhotos helper not ready';
                showProgressPhotoUploadCard(card, doneCard, uploadingCard);
                requestProgressPhotoCardCheck(1500);
                return;
            }

            // Check if user already uploaded this week
            const thisWeeksPhoto = await progressPhotos.getThisWeeksPhoto(window.currentUser.id);

            if (thisWeeksPhoto) {
                // Already done this week
                markProgressPhotoCompletedForCurrentWeek();
                showProgressPhotoCompletedState(card, doneCard, uploadingCard);
            } else {
                // Show the upload card
                showProgressPhotoUploadCard(card, doneCard, uploadingCard);
            }
        } catch (error) {
            console.error('Error checking progress photo status:', error);
            window._pbbProgressPhotoLastCheckError = error && error.message ? error.message : String(error);
            if (isProgressPhotoCompletedForCurrentWeek()) {
                showProgressPhotoCompletedState(card, doneCard, uploadingCard);
                return;
            }
            if (isProgressPhotoPromptWindow(new Date())) {
                showProgressPhotoUploadCard(card, doneCard, uploadingCard);
            }
        }
    }

    function getProgressPhotoShotOverlay() {
        let overlay = document.getElementById('progress-photo-shot-guide');
        if (overlay) return overlay;

        overlay = document.createElement('div');
        overlay.id = 'progress-photo-shot-guide';
        overlay.style.cssText = 'display:none; position:fixed; inset:0; z-index:10012; background:rgba(10,10,18,0.94); padding:calc(20px + env(safe-area-inset-top, 0px)) 18px calc(20px + env(safe-area-inset-bottom, 0px)); box-sizing:border-box; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; align-items:center; justify-content:center;';
        document.body.appendChild(overlay);
        return overlay;
    }

    function closeProgressPhotoShotGuide() {
        progressPhotoCaptureState = null;
        const overlay = document.getElementById('progress-photo-shot-guide');
        if (overlay) overlay.style.display = 'none';
    }

    function renderProgressPhotoShotGuide(index) {
        const overlay = getProgressPhotoShotOverlay();
        const shot = PROGRESS_PHOTO_SHOTS[index] || PROGRESS_PHOTO_SHOTS[0];
        const completed = progressPhotoCaptureState?.shots?.filter(Boolean).length || 0;
        const dots = PROGRESS_PHOTO_SHOTS.map(function(item, dotIndex) {
            const isDone = Boolean(progressPhotoCaptureState?.shots?.[dotIndex]);
            const isCurrent = dotIndex === index;
            const bg = isDone ? '#22c55e' : (isCurrent ? '#ec4899' : 'rgba(255,255,255,0.18)');
            const color = (isDone || isCurrent) ? '#fff' : 'rgba(255,255,255,0.72)';
            return '<div style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:8px;">'
                + '<div style="width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:' + bg + '; color:' + color + '; font-size:0.82rem; font-weight:800;">' + (dotIndex + 1) + '</div>'
                + '<div style="font-size:0.72rem; color:' + color + '; font-weight:700; text-align:center; line-height:1.2;">' + item.title + '</div>'
                + '</div>';
        }).join('');

        overlay.innerHTML = ''
            + '<div style="width:100%; max-width:420px; color:#fff;">'
            + '<div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:22px;">'
            + '<div>'
            + '<div style="font-size:0.78rem; color:rgba(255,255,255,0.62); font-weight:800; text-transform:uppercase; letter-spacing:0;">Progress photo set</div>'
            + '<div style="font-size:1.35rem; line-height:1.15; font-weight:800; margin-top:5px;">' + shot.title + '</div>'
            + '</div>'
            + '<button type="button" id="progress-photo-guide-close" style="width:42px; height:42px; border-radius:50%; border:none; background:rgba(255,255,255,0.12); color:#fff; font-size:1.45rem; line-height:1; display:flex; align-items:center; justify-content:center;">&times;</button>'
            + '</div>'
            + '<div style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.14); border-radius:16px; padding:18px; margin-bottom:18px;">'
            + '<div style="display:flex; gap:10px; margin-bottom:20px;">' + dots + '</div>'
            + '<div style="font-size:0.88rem; color:rgba(255,255,255,0.72); font-weight:700; margin-bottom:8px;">Shot ' + (index + 1) + ' of ' + PROGRESS_PHOTO_SHOTS.length + '</div>'
            + '<div style="font-size:1.05rem; line-height:1.45; font-weight:700;">' + shot.guide + '</div>'
            + '<div style="font-size:0.88rem; line-height:1.4; color:rgba(255,255,255,0.68); margin-top:10px;">Keep the same lighting, distance, and posture each week.</div>'
            + '</div>'
            + '<button type="button" id="progress-photo-guide-capture" style="width:100%; border:none; border-radius:16px; background:linear-gradient(135deg,#ec4899,#f43f5e); color:#fff; padding:16px 18px; font-size:1rem; font-weight:800; box-shadow:0 12px 30px rgba(236,72,153,0.3);">Take ' + shot.title.toLowerCase() + ' photo</button>'
            + '<div style="text-align:center; color:rgba(255,255,255,0.58); font-size:0.82rem; margin-top:13px;">' + completed + ' captured</div>'
            + '</div>';

        const closeBtn = document.getElementById('progress-photo-guide-close');
        const captureBtn = document.getElementById('progress-photo-guide-capture');
        if (closeBtn) closeBtn.onclick = closeProgressPhotoShotGuide;
        if (captureBtn) captureBtn.onclick = function() {
            captureProgressPhotoShot(index);
        };
        overlay.style.display = 'flex';
    }

    function openProgressPhotoCapture(options) {
        const source = options && options.source === 'insights' ? 'insights' : 'home';
        progressPhotoCaptureState = {
            shots: new Array(PROGRESS_PHOTO_SHOTS.length),
            source
        };
        renderProgressPhotoShotGuide(0);
    }

    function continueProgressPhotoShotFlow(index, file) {
        if (!progressPhotoCaptureState) return;
        progressPhotoCaptureState.shots[index] = file;
        const nextIndex = index + 1;

        if (nextIndex < PROGRESS_PHOTO_SHOTS.length) {
            renderProgressPhotoShotGuide(nextIndex);
            return;
        }

        const shots = progressPhotoCaptureState.shots
            .map(function(shotFile, shotIndex) {
                return { meta: PROGRESS_PHOTO_SHOTS[shotIndex], file: shotFile };
            })
            .filter(function(item) { return item.file; });
        const source = progressPhotoCaptureState.source || 'home';
        closeProgressPhotoShotGuide();
        saveProgressPhotoSet(shots, { source });
    }

    function captureProgressPhotoShot(index) {
        const shot = PROGRESS_PHOTO_SHOTS[index] || PROGRESS_PHOTO_SHOTS[0];
        const photoInput = document.getElementById('progress-photo-input');

        if (typeof openWorkoutCamera === 'function') {
            openWorkoutCamera(function(file) {
                if (!file) return;
                continueProgressPhotoShotFlow(index, file);
            }, shot.label);
            return;
        }

        if (photoInput) {
            photoInput.onchange = function(event) {
                const file = event.target.files && event.target.files[0];
                event.target.value = '';
                photoInput.onchange = handleProgressPhotoSelect;
                if (!file) return;
                continueProgressPhotoShotFlow(index, file);
            };
            photoInput.click();
            return;
        }

        alert('Camera not available. Please try again.');
    }

    async function uploadProgressPhotoFile(userId, file) {
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

        return uploadResponse.json();
    }

    async function refreshProgressPhotoTimeline(userId) {
        if (!userId || typeof renderProgressPhotosTimeline !== 'function') return;
        if (!window.db?.progressPhotos?.getAll) return;

        try {
            const freshPhotos = await window.db.progressPhotos.getAll(userId, 52);
            window._progressPhotosData = freshPhotos;
            renderProgressPhotosTimeline(freshPhotos);
        } catch (error) {
            console.warn('Failed to refresh progress photo timeline:', error);
        }
    }

    function setProgressPhotoInsightsState(kind, message) {
        const container = document.getElementById('progress-photos-container');
        if (!container) return;

        const isError = kind === 'error';
        const color = isError ? '#ef4444' : 'var(--text-muted)';
        const title = isError ? 'Upload failed. Please try again.' : (message || 'Uploading your progress photos...');
        const retry = isError
            ? '<button onclick="window.addProgressPhotoFromInsightsView && window.addProgressPhotoFromInsightsView()" style="margin-top:14px; background:linear-gradient(135deg,#ec4899,#f43f5e); color:white; border:none; padding:10px 20px; border-radius:20px; cursor:pointer; font-size:0.85rem; font-weight:600;">Try Again</button>'
            : '';

        container.innerHTML = '<div style="text-align:center; padding:40px 20px; color:' + color + ';">'
            + '<div style="font-size:2rem; margin-bottom:12px; animation:' + (isError ? 'none' : 'pulse 1s infinite') + ';">' + (isError ? '!' : '...') + '</div>'
            + '<div style="font-weight:600; font-size:0.95rem;">' + title + '</div>'
            + retry
            + '</div>';
    }

    async function saveProgressPhotoSet(shots, options) {
        if (!shots || !shots.length) return;

        const card = document.getElementById('weekly-progress-photo-card');
        const uploadingCard = document.getElementById('weekly-progress-photo-uploading');
        const doneCard = document.getElementById('weekly-progress-photo-done-card');
        const userId = window.currentUser?.id;
        const source = options && options.source === 'insights' ? 'insights' : 'home';
        const isInsightsCapture = source === 'insights';

        try {
            if (!userId) throw new Error('User not authenticated');
            if (!window.db?.progressPhotos?.save) throw new Error('Progress photo storage unavailable');

            if (card) card.style.display = 'none';
            if (doneCard) doneCard.style.display = 'none';
            if (uploadingCard) uploadingCard.style.display = isInsightsCapture ? 'none' : 'block';
            setProgressPhotoUploadingCopy('Uploading 1 of ' + shots.length + ' progress photos...');
            if (isInsightsCapture) {
                setProgressPhotoInsightsState('uploading', 'Uploading 1 of ' + shots.length + ' progress photos...');
            }

            const uploads = [];
            for (let i = 0; i < shots.length; i++) {
                setProgressPhotoUploadingCopy('Uploading ' + (i + 1) + ' of ' + shots.length + ' progress photos...');
                if (isInsightsCapture) {
                    setProgressPhotoInsightsState('uploading', 'Uploading ' + (i + 1) + ' of ' + shots.length + ' progress photos...');
                }
                const uploadData = await uploadProgressPhotoFile(userId, shots[i].file);
                uploads.push({
                    angle: shots[i].meta.key,
                    title: shots[i].meta.title,
                    url: uploadData.url,
                    fileName: uploadData.fileName
                });
            }

            const notes = JSON.stringify({
                capture_type: uploads.length === PROGRESS_PHOTO_SHOTS.length ? 'three_shot_progress_photos' : 'single_progress_photo',
                saved_at: new Date().toISOString(),
                shots: uploads.map(function(upload) {
                    return {
                        angle: upload.angle,
                        title: upload.title,
                        photo_url: upload.url,
                        storage_path: upload.fileName
                    };
                })
            });
            const primaryUpload = uploads[0];
            const savedPhoto = await window.db.progressPhotos.save(userId, primaryUpload.url, primaryUpload.fileName, notes);

            markProgressPhotoCompletedForCurrentWeek();
            await awardProgressPhotoXP(userId, savedPhoto, shots[0].file);

            if (uploadingCard) uploadingCard.style.display = 'none';
            if (isInsightsCapture) {
                hideProgressPhotoCards(card, doneCard, uploadingCard);
            } else {
                showProgressPhotoCompletedState(card, doneCard, uploadingCard);
            }

            if (typeof refreshPointsDisplay === 'function') {
                refreshPointsDisplay();
            }
            await refreshProgressPhotoTimeline(userId);

            console.log('Progress photo set uploaded successfully!');

        } catch (error) {
            console.error('Error uploading progress photo:', error);
            if (uploadingCard) uploadingCard.style.display = 'none';
            if (isInsightsCapture) {
                setProgressPhotoInsightsState('error');
            } else {
                if (card) card.style.display = 'block';
                alert('Failed to upload progress photos. Please try again.');
            }
        }
    }

    /**
     * Handle progress photo file selection and upload
     */
    async function handleProgressPhotoSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        await saveProgressPhotoSet([{ meta: PROGRESS_PHOTO_SHOTS[0], file }]);

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
        // Card click starts the guided progress-photo sequence.
        var photoCard = document.getElementById('weekly-progress-photo-card');
        var photoInput = document.getElementById('progress-photo-input');
        if (photoCard) {
            photoCard.onclick = function() {
                openProgressPhotoCapture();
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
        if (card) card.style.display = 'none';
        await saveProgressPhotoSet([{ meta: PROGRESS_PHOTO_SHOTS[0], file }]);
    }
    window.handleProgressPhotoCaptureFromFile = handleProgressPhotoCaptureFromFile;
    window.openProgressPhotoCapture = openProgressPhotoCapture;
    window.closeProgressPhotoShotGuide = closeProgressPhotoShotGuide;
    window.awardProgressPhotoXP = awardProgressPhotoXP;
    window.isProgressPhotoPromptWindow = isProgressPhotoPromptWindow;
    window.getNextProgressPhotoPromptBoundary = getNextProgressPhotoPromptBoundary;
    window.requestProgressPhotoCardCheck = requestProgressPhotoCardCheck;

    // Make functions globally available
    window.dismissProgressPhotoDoneCard = dismissProgressPhotoDoneCard;
    window.checkAndShowProgressPhotoCard = checkAndShowProgressPhotoCard;

    function bootProgressPhotoCard() {
        scheduleProgressPhotoPromptRefresh();
        requestProgressPhotoCardCheck(500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootProgressPhotoCard, { once: true });
    } else {
        bootProgressPhotoCard();
    }

    window.addEventListener('pbbInitComplete', function() {
        requestProgressPhotoCardCheck(750);
    }, { once: true });

    window.addEventListener('appCriticalContentReady', function() {
        requestProgressPhotoCardCheck(500);
    }, { once: true });

    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) requestProgressPhotoCardCheck(250);
    });
