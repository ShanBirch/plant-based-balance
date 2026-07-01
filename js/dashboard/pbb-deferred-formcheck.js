(function () {
    const MAX_FORM_CHECK_VIDEO_BYTES = 180 * 1024 * 1024;
    const WORKOUT_FEED_SHARE_QUEUE_DB = 'pbb_workout_feed_share_queue_v1';
    const WORKOUT_FEED_SHARE_QUEUE_STORE = 'uploads';
    let formCheckState = {
        file: null,
        objectUrl: null,
        source: 'movement',
        workoutName: '',
        previousBottomNavDisplay: ''
    };
    let workoutFeedShareState = {
        file: null,
        objectUrl: null,
        source: 'workout',
        workoutName: '',
        previousBottomNavDisplay: ''
    };
    let swipeRegistered = false;
    let workoutFeedShareSwipeRegistered = false;
    let workoutFeedShareRetryInProgress = false;
    let workoutFeedShareRetryTimer = null;
    let workoutFeedSharePendingInput = null;
    let workoutFeedShareCameraStream = null;
    let workoutFeedShareCameraFacingMode = 'environment';
    let workoutFeedShareRecorder = null;
    let workoutFeedShareRecorderChunks = [];
    let workoutFeedShareRecorderMimeType = '';
    let workoutFeedShareRecorderSaveOnStop = false;
    let workoutFeedShareRecorderStartedAt = 0;
    let workoutFeedShareRecorderTimer = null;
    let workoutFeedShareRecorderMaxTimer = null;

    function ensureFormCheckView() {
        let view = document.getElementById('view-form-check');
        if (view) return view;

        view = document.createElement('div');
        view.id = 'view-form-check';
        view.className = 'app-view';
        view.style.cssText = 'display:none; position:fixed; inset:0; z-index:700; background:#f8fafc; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain;';
        view.innerHTML = `
            <style>
                #view-form-check .form-check-header {
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    background: white;
                    padding: calc(15px + env(safe-area-inset-top, 0px)) 20px 15px 20px;
                    border-bottom: 1px solid #e2e8f0;
                    text-align: center;
                    box-sizing: border-box;
                }
                #view-form-check .form-check-title {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: var(--text-main);
                }
                #view-form-check .form-check-content {
                    padding: 20px;
                    padding-bottom: calc(28px + env(safe-area-inset-bottom, 0px));
                    max-width: 620px;
                    margin: 0 auto;
                    box-sizing: border-box;
                }
                #view-form-check .form-check-panel {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 18px;
                    box-shadow: 0 8px 24px rgba(15,23,42,0.06);
                    margin-bottom: 14px;
                }
                #view-form-check label {
                    display: block;
                    font-size: 0.82rem;
                    font-weight: 800;
                    color: var(--text-main);
                    margin-bottom: 8px;
                }
                #view-form-check input[type="text"],
                #view-form-check textarea {
                    width: 100%;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 13px 14px;
                    font: inherit;
                    color: var(--text-main);
                    background: #fff;
                    box-sizing: border-box;
                    outline: none;
                }
                #view-form-check textarea {
                    min-height: 96px;
                    resize: vertical;
                    line-height: 1.45;
                }
                #view-form-check .form-check-actions {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                #view-form-check .form-check-btn {
                    border: none;
                    border-radius: 14px;
                    padding: 14px 12px;
                    min-height: 52px;
                    font: inherit;
                    font-size: 0.92rem;
                    font-weight: 800;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    touch-action: manipulation;
                }
                #view-form-check .form-check-btn svg {
                    width: 20px;
                    height: 20px;
                    fill: currentColor;
                    flex-shrink: 0;
                }
                #view-form-check .form-check-btn-primary {
                    background: var(--primary);
                    color: white;
                    box-shadow: 0 8px 18px rgba(72,134,75,0.22);
                }
                #view-form-check .form-check-btn-secondary {
                    background: #eef2ff;
                    color: #3730a3;
                }
                #view-form-check .form-check-btn-muted {
                    background: #f1f5f9;
                    color: #475569;
                }
                #view-form-check .form-check-btn-danger {
                    background: #fef2f2;
                    color: #dc2626;
                }
                #view-form-check .form-check-status {
                    display: none;
                    padding: 12px 14px;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    line-height: 1.4;
                    margin-top: 12px;
                }
                #view-form-check .form-check-status.info { display:block; background:#eff6ff; color:#1d4ed8; }
                #view-form-check .form-check-status.success { display:block; background:#dcfce7; color:#166534; }
                #view-form-check .form-check-status.error { display:block; background:#fee2e2; color:#991b1b; }
                #form-check-video-preview {
                    display: none;
                    width: 100%;
                    max-height: 360px;
                    background: #020617;
                    border-radius: 14px;
                    margin-top: 12px;
                }
                @media (max-width: 360px) {
                    #view-form-check .form-check-actions { grid-template-columns: 1fr; }
                }
            </style>
            <div class="form-check-header">
                <div class="form-check-title">Form Check</div>
            </div>
            <div class="form-check-content">
                <div class="form-check-panel" style="background:linear-gradient(135deg,#102a1d 0%,#48864B 100%); color:white; border:none;">
                    <div style="font-size:0.78rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; opacity:0.85; margin-bottom:6px;">Send to Shannon</div>
                    <div style="font-size:1.25rem; font-weight:900; line-height:1.15; margin-bottom:8px;">Film a set for a quick technique check</div>
                    <div style="font-size:0.86rem; line-height:1.45; opacity:0.9;">Best with the whole body in frame, a side or 45 degree angle, and a clip under 60 seconds.</div>
                </div>

                <div class="form-check-panel">
                    <label for="form-check-exercise">Exercise</label>
                    <input type="text" id="form-check-exercise" placeholder="e.g. Squat, deadlift, push-up">
                    <div style="height:14px;"></div>
                    <label for="form-check-notes">What should Shannon check?</label>
                    <textarea id="form-check-notes" placeholder="e.g. not sure about depth, knee tracking, lower back position"></textarea>
                </div>

                <div class="form-check-panel">
                    <label>Video</label>
                    <div class="form-check-actions">
                        <button type="button" class="form-check-btn form-check-btn-primary" onclick="openFormCheckCapture()">
                            <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                            Film New Clip
                        </button>
                        <button type="button" class="form-check-btn form-check-btn-secondary" onclick="openFormCheckGallery()">
                            <svg viewBox="0 0 24 24"><path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/></svg>
                            Upload Clip
                        </button>
                    </div>
                    <input type="file" id="form-check-camera-input" accept="video/*" capture="environment" style="display:none;" onchange="handleFormCheckFileSelect(event)">
                    <input type="file" id="form-check-gallery-input" accept="video/*" style="display:none;" onchange="handleFormCheckFileSelect(event)">
                    <video id="form-check-video-preview" controls playsinline></video>
                    <button type="button" id="form-check-remove-video" class="form-check-btn form-check-btn-danger" style="display:none; width:100%; margin-top:10px;" onclick="clearFormCheckVideo()">Remove Clip</button>
                </div>

                <div class="form-check-panel">
                    <button type="button" id="form-check-submit-btn" class="form-check-btn form-check-btn-primary" style="width:100%;" onclick="submitFormCheck()">Send To Shannon</button>
                    <div id="form-check-status" class="form-check-status"></div>
                    <button type="button" class="form-check-btn form-check-btn-muted" style="width:100%; margin-top:10px;" onclick="closeFormCheck()">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(view);

        if (!swipeRegistered && typeof enableSwipeBackNavigation === 'function') {
            try {
                enableSwipeBackNavigation('view-form-check', closeFormCheck);
                swipeRegistered = true;
            } catch (e) {
                console.warn('[FormCheck] swipe registration failed', e);
            }
        }

        return view;
    }

    function getActiveWorkoutName() {
        const title = document.getElementById('workout-player-title');
        if (title && title.textContent && title.textContent.trim()) return title.textContent.trim();
        return window.currentWorkoutName || '';
    }

    function setStatus(message, type) {
        const status = document.getElementById('form-check-status');
        if (!status) return;
        status.textContent = message || '';
        status.className = 'form-check-status ' + (type || 'info');
    }

    function resetStatus() {
        const status = document.getElementById('form-check-status');
        if (!status) return;
        status.textContent = '';
        status.className = 'form-check-status';
    }

    function openFormCheck(options) {
        options = options || {};
        const view = ensureFormCheckView();
        const activeWorkout = document.getElementById('view-active-workout');
        formCheckState.source = options.source || (activeWorkout && activeWorkout.style.display !== 'none' ? 'workout' : 'movement');
        formCheckState.workoutName = options.workoutName || (formCheckState.source === 'workout' ? getActiveWorkoutName() : '');

        const exerciseInput = document.getElementById('form-check-exercise');
        const notesInput = document.getElementById('form-check-notes');
        if (exerciseInput) exerciseInput.value = options.exerciseName || '';
        if (notesInput) notesInput.value = '';
        clearFormCheckVideo();
        resetStatus();

        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            formCheckState.previousBottomNavDisplay = bottomNav.style.display || '';
            bottomNav.style.display = 'none';
        }

        view.scrollTop = 0;
        view.style.display = 'block';
        if (typeof pushNavigationState === 'function') {
            try { pushNavigationState('view-form-check', closeFormCheck); } catch (e) {}
        }
        setTimeout(function () {
            if (exerciseInput && !exerciseInput.value) exerciseInput.focus();
        }, 80);
    }

    function closeFormCheck() {
        const view = document.getElementById('view-form-check');
        if (view) view.style.display = 'none';
        clearFormCheckVideo();
        resetStatus();

        const bottomNav = document.querySelector('.bottom-nav');
        const activeWorkout = document.getElementById('view-active-workout');
        const isWorkoutOpen = activeWorkout && activeWorkout.style.display !== 'none';
        if (bottomNav && !isWorkoutOpen) {
            bottomNav.style.display = formCheckState.previousBottomNavDisplay || 'flex';
        }
    }

    function openFormCheckCapture() {
        const input = document.getElementById('form-check-camera-input');
        if (input) input.click();
    }

    function openFormCheckGallery() {
        const input = document.getElementById('form-check-gallery-input');
        if (input) input.click();
    }

    function handleFormCheckFileSelect(event) {
        const input = event && event.target;
        const file = input && input.files ? input.files[0] : null;
        if (input) input.value = '';
        if (!file) return;

        if (!file.type || !file.type.startsWith('video/')) {
            setStatus('Please choose a video clip.', 'error');
            return;
        }
        if (file.size > MAX_FORM_CHECK_VIDEO_BYTES) {
            setStatus('That video is too large. Keep form checks under 180 MB.', 'error');
            return;
        }

        clearFormCheckVideo();
        formCheckState.file = file;
        formCheckState.objectUrl = URL.createObjectURL(file);

        const preview = document.getElementById('form-check-video-preview');
        const removeBtn = document.getElementById('form-check-remove-video');
        if (preview) {
            preview.src = formCheckState.objectUrl;
            preview.style.display = 'block';
        }
        if (removeBtn) removeBtn.style.display = 'flex';
        setStatus('Clip ready. Add any notes, then send it to Shannon.', 'success');
    }

    function clearFormCheckVideo() {
        if (formCheckState.objectUrl) {
            try { URL.revokeObjectURL(formCheckState.objectUrl); } catch (e) {}
        }
        formCheckState.file = null;
        formCheckState.objectUrl = null;

        const preview = document.getElementById('form-check-video-preview');
        const removeBtn = document.getElementById('form-check-remove-video');
        if (preview) {
            preview.pause();
            preview.removeAttribute('src');
            preview.load();
            preview.style.display = 'none';
        }
        if (removeBtn) removeBtn.style.display = 'none';
    }

    function createRequestId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'form-check-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    }

    async function uploadFormCheckClip(userId, file, requestId) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', userId);
        formData.append('requestId', requestId);

        const response = await fetch('/api/upload-form-check-video', {
            method: 'POST',
            body: formData
        });
        const payload = await response.json().catch(function () { return {}; });

        if (!response.ok || !payload.success) {
            throw new Error(payload.error || 'Could not upload that clip. Please try again.');
        }

        return {
            publicUrl: payload.url,
            storagePath: payload.fileName,
            upload: payload
        };
    }

    function isUuid(value) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
    }

    async function getAuthAccessToken() {
        if (window.authHelpers && typeof window.authHelpers.getSession === 'function') {
            const session = await window.authHelpers.getSession();
            if (session && session.access_token) return session.access_token;
        }
        if (window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.getSession === 'function') {
            const result = await window.supabaseClient.auth.getSession();
            const session = result && result.data ? result.data.session : null;
            if (session && session.access_token) return session.access_token;
        }
        return '';
    }

    async function submitFormCheckRequest(payload) {
        const token = await getAuthAccessToken();
        if (!token) throw new Error('Please log in before sending a form check.');

        const response = await fetch('/.netlify/functions/submit-form-check-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json().catch(function () { return {}; });
        if (!response.ok || !result.success) {
            const error = new Error(result.error || 'Could not send the form check message.');
            error.status = response.status;
            throw error;
        }
        return result;
    }

    async function insertFormCheckNudgeFallback(userId, coachId, message, requestId) {
        const row = {
            sender_id: userId,
            receiver_id: coachId,
            message: message,
            nudge_type: 'form_check'
        };
        if (isUuid(requestId)) row.reference_id = requestId;

        const { data, error } = await window.supabaseClient
            .from('nudges')
            .insert(row)
            .select('id')
            .single();

        if (error) throw error;
        return { success: true, nudgeId: data && data.id ? data.id : null, fallback: true };
    }

    async function submitFormCheck() {
        const submitBtn = document.getElementById('form-check-submit-btn');
        const exerciseInput = document.getElementById('form-check-exercise');
        const notesInput = document.getElementById('form-check-notes');
        const userId = window.currentUser && window.currentUser.id;

        if (!userId) {
            setStatus('Please log in before sending a form check.', 'error');
            return;
        }
        if (!formCheckState.file) {
            setStatus('Film or upload a clip first.', 'error');
            return;
        }

        const exerciseName = (exerciseInput && exerciseInput.value.trim()) || 'Exercise';
        const notes = (notesInput && notesInput.value.trim()) || 'Please check my technique.';
        const requestId = createRequestId();

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Uploading...';
                submitBtn.style.opacity = '0.7';
            }
            setStatus('Uploading your clip...', 'info');

            let uploadResult;
            let primaryUploadError = null;
            try {
                uploadResult = await uploadFormCheckClip(userId, formCheckState.file, requestId);
            } catch (uploadError) {
                primaryUploadError = uploadError;
                console.warn('[FormCheck] B2 upload failed, trying Supabase fallback', uploadError);
            }

            if (!uploadResult && window.storageHelpers && typeof window.storageHelpers.uploadFormCheckVideo === 'function') {
                try {
                    uploadResult = await window.storageHelpers.uploadFormCheckVideo(userId, formCheckState.file, requestId);
                } catch (fallbackError) {
                    throw primaryUploadError || fallbackError;
                }
            }

            if (!uploadResult) {
                throw primaryUploadError || new Error('Video upload is not available yet. Please refresh and try again.');
            }

            setStatus('Sending request to Shannon...', 'info');
            const coachId = window._coachUserId || (typeof getCoachUserId === 'function' ? await getCoachUserId() : null);
            if (!coachId) throw new Error('Could not find Shannon in the app.');

            const messageLines = [
                'Form check request',
                'Exercise: ' + exerciseName
            ];
            messageLines.push('Video: [video: ' + uploadResult.publicUrl + ']');
            if (formCheckState.workoutName) messageLines.push('Workout: ' + formCheckState.workoutName);
            messageLines.push('Focus: ' + notes);

            const messageText = messageLines.join('\n');
            try {
                await submitFormCheckRequest({
                    coachId: coachId,
                    videoUrl: uploadResult.publicUrl,
                    exerciseName: exerciseName,
                    notes: notes,
                    workoutName: formCheckState.workoutName || '',
                    requestId: requestId
                });
            } catch (serverError) {
                if (serverError && serverError.status && serverError.status < 500 && serverError.status !== 404) {
                    throw serverError;
                }
                console.warn('[FormCheck] server submit failed, trying direct DM insert', serverError);
                await insertFormCheckNudgeFallback(userId, coachId, messageText, requestId);
            }

            setStatus('Sent to Shannon. He will reply in your DMs.', 'success');
            if (typeof showToast === 'function') showToast('Form check sent to Shannon', 'success');
            setTimeout(closeFormCheck, 900);
        } catch (error) {
            console.error('[FormCheck] submit failed', error);
            setStatus(error.message || 'Could not send that clip. Please try again.', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send To Shannon';
                submitBtn.style.opacity = '1';
            }
        }
    }

    function ensureWorkoutFeedShareView() {
        let view = document.getElementById('view-workout-feed-share');
        if (view) return view;

        view = document.createElement('div');
        view.id = 'view-workout-feed-share';
        view.className = 'app-view';
        view.style.cssText = 'display:none; position:fixed; inset:0; z-index:700; background:#f8fafc; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain;';
        view.innerHTML = `
            <style>
                #view-workout-feed-share .workout-feed-share-header {
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    background: white;
                    padding: calc(15px + env(safe-area-inset-top, 0px)) 20px 15px 20px;
                    border-bottom: 1px solid #e2e8f0;
                    text-align: center;
                    box-sizing: border-box;
                }
                #view-workout-feed-share .workout-feed-share-title {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: var(--text-main);
                }
                #view-workout-feed-share .workout-feed-share-content {
                    padding: 20px;
                    padding-bottom: calc(28px + env(safe-area-inset-bottom, 0px));
                    max-width: 620px;
                    margin: 0 auto;
                    box-sizing: border-box;
                }
                #view-workout-feed-share .workout-feed-share-panel {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 16px;
                    padding: 18px;
                    box-shadow: 0 8px 24px rgba(15,23,42,0.06);
                    margin-bottom: 14px;
                }
                #view-workout-feed-share label {
                    display: block;
                    font-size: 0.82rem;
                    font-weight: 800;
                    color: var(--text-main);
                    margin-bottom: 8px;
                }
                #view-workout-feed-share textarea {
                    width: 100%;
                    min-height: 96px;
                    resize: vertical;
                    line-height: 1.45;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 13px 14px;
                    font: inherit;
                    color: var(--text-main);
                    background: #fff;
                    box-sizing: border-box;
                    outline: none;
                }
                #view-workout-feed-share .workout-feed-share-actions {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                #view-workout-feed-share .workout-feed-share-btn {
                    border: none;
                    border-radius: 14px;
                    padding: 14px 12px;
                    min-height: 52px;
                    font: inherit;
                    font-size: 0.92rem;
                    font-weight: 800;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    touch-action: manipulation;
                }
                #view-workout-feed-share .workout-feed-share-btn svg {
                    width: 20px;
                    height: 20px;
                    fill: currentColor;
                    flex-shrink: 0;
                }
                #view-workout-feed-share .workout-feed-share-btn-primary {
                    background: linear-gradient(135deg, #7c2d12 0%, #dc2626 100%);
                    color: white;
                    box-shadow: 0 8px 18px rgba(220,38,38,0.22);
                }
                #view-workout-feed-share .workout-feed-share-btn-secondary {
                    background: #eef2ff;
                    color: #3730a3;
                }
                #view-workout-feed-share .workout-feed-share-btn-muted {
                    background: #f1f5f9;
                    color: #475569;
                }
                #view-workout-feed-share .workout-feed-share-btn-danger {
                    background: #fef2f2;
                    color: #dc2626;
                }
                #view-workout-feed-share .workout-feed-share-status {
                    display: none;
                    padding: 12px 14px;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    line-height: 1.4;
                    margin-top: 12px;
                }
                #view-workout-feed-share .workout-feed-share-status.info { display:block; background:#eff6ff; color:#1d4ed8; }
                #view-workout-feed-share .workout-feed-share-status.success { display:block; background:#dcfce7; color:#166534; }
                #view-workout-feed-share .workout-feed-share-status.error { display:block; background:#fee2e2; color:#991b1b; }
                #view-workout-feed-share .workout-feed-share-hero,
                #view-workout-feed-share .workout-feed-share-hero * {
                    color: #fff !important;
                    -webkit-text-fill-color: #fff !important;
                }
                #workout-feed-share-video-preview {
                    display: none;
                    width: 100%;
                    max-height: 360px;
                    background: #020617;
                    border-radius: 14px;
                    margin-top: 12px;
                }
                @media (max-width: 360px) {
                    #view-workout-feed-share .workout-feed-share-actions { grid-template-columns: 1fr; }
                }
            </style>
            <div class="workout-feed-share-header">
                <div class="workout-feed-share-title">Share a Set</div>
            </div>
            <div class="workout-feed-share-content">
                <div class="workout-feed-share-panel workout-feed-share-hero" style="background:linear-gradient(135deg,#111827 0%,#b91c1c 100%); color:#fff !important; -webkit-text-fill-color:#fff !important; border:none;">
                    <div style="font-size:0.78rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; opacity:0.9; margin-bottom:6px; color:#fff !important; -webkit-text-fill-color:#fff !important;">Stay in workout mode</div>
                    <div style="font-size:1.25rem; font-weight:900; line-height:1.15; margin-bottom:8px; color:#fff !important; -webkit-text-fill-color:#fff !important;">Record a set, post it to Feed, and earn +20 XP once a day</div>
                    <div style="font-size:0.86rem; line-height:1.45; opacity:0.92; color:#fff !important; -webkit-text-fill-color:#fff !important;">Open the camera or choose a clip from Photos, then keep your workout running while it uploads.</div>
                </div>

                <div class="workout-feed-share-panel">
                    <label for="workout-feed-share-caption">Caption</label>
                    <textarea id="workout-feed-share-caption" placeholder="Add a caption if you want"></textarea>
                    <div style="height:10px;"></div>
                    <div style="font-size:0.75rem; color:#64748b; font-weight:700;">The workout stays open while you post.</div>
                </div>

                <div class="workout-feed-share-panel">
                    <label>Video</label>
                    <div class="workout-feed-share-actions">
                        <button type="button" class="workout-feed-share-btn workout-feed-share-btn-primary" onclick="openWorkoutFeedShareCapture()">
                            <svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                            Camera
                        </button>
                        <button type="button" class="workout-feed-share-btn workout-feed-share-btn-secondary" onclick="openWorkoutFeedShareGallery()">
                            <svg viewBox="0 0 24 24"><path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/></svg>
                            Photos
                        </button>
                    </div>
                    <video id="workout-feed-share-video-preview" controls playsinline></video>
                    <button type="button" id="workout-feed-share-remove-video" class="workout-feed-share-btn workout-feed-share-btn-danger" style="display:none; width:100%; margin-top:10px;" onclick="clearWorkoutFeedShareVideo()">Remove Clip</button>
                </div>

                <div class="workout-feed-share-panel">
                    <button type="button" id="workout-feed-share-submit-btn" class="workout-feed-share-btn workout-feed-share-btn-primary" style="width:100%;" onclick="submitWorkoutFeedShare()">Post to Feed</button>
                    <div id="workout-feed-share-status" class="workout-feed-share-status"></div>
                    <button type="button" class="workout-feed-share-btn workout-feed-share-btn-muted" style="width:100%; margin-top:10px;" onclick="closeWorkoutFeedShare()">Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(view);

        if (!workoutFeedShareSwipeRegistered && typeof enableSwipeBackNavigation === 'function') {
            try {
                enableSwipeBackNavigation('view-workout-feed-share', closeWorkoutFeedShare);
                workoutFeedShareSwipeRegistered = true;
            } catch (e) {
                console.warn('[WorkoutFeedShare] swipe registration failed', e);
            }
        }

        return view;
    }

    function setWorkoutFeedShareStatus(message, type) {
        const status = document.getElementById('workout-feed-share-status');
        if (!status) return;
        status.textContent = message || '';
        status.className = 'workout-feed-share-status ' + (type || 'info');
    }

    function resetWorkoutFeedShareStatus() {
        const status = document.getElementById('workout-feed-share-status');
        if (!status) return;
        status.textContent = '';
        status.className = 'workout-feed-share-status';
    }

    function getWorkoutFeedShareQueueId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'share-set-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }

    function openWorkoutFeedShareQueueDb() {
        return new Promise(function (resolve, reject) {
            if (!window.indexedDB) {
                reject(new Error('Retry storage is not available on this phone.'));
                return;
            }
            const request = window.indexedDB.open(WORKOUT_FEED_SHARE_QUEUE_DB, 1);
            request.onupgradeneeded = function () {
                const db = request.result;
                if (!db.objectStoreNames.contains(WORKOUT_FEED_SHARE_QUEUE_STORE)) {
                    const store = db.createObjectStore(WORKOUT_FEED_SHARE_QUEUE_STORE, { keyPath: 'id' });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    store.createIndex('userId', 'userId', { unique: false });
                }
            };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error || new Error('Could not open retry storage.')); };
        });
    }

    async function putWorkoutFeedShareQueueItem(item) {
        const db = await openWorkoutFeedShareQueueDb();
        return new Promise(function (resolve, reject) {
            const tx = db.transaction(WORKOUT_FEED_SHARE_QUEUE_STORE, 'readwrite');
            tx.objectStore(WORKOUT_FEED_SHARE_QUEUE_STORE).put(item);
            tx.oncomplete = function () {
                db.close();
                resolve(item);
            };
            tx.onerror = function () {
                db.close();
                reject(tx.error || new Error('Could not save retry upload.'));
            };
        });
    }

    async function getWorkoutFeedShareQueueItems() {
        const db = await openWorkoutFeedShareQueueDb();
        return new Promise(function (resolve, reject) {
            const tx = db.transaction(WORKOUT_FEED_SHARE_QUEUE_STORE, 'readonly');
            const request = tx.objectStore(WORKOUT_FEED_SHARE_QUEUE_STORE).getAll();
            request.onsuccess = function () {
                db.close();
                resolve((request.result || []).sort(function (a, b) {
                    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
                }));
            };
            request.onerror = function () {
                db.close();
                reject(request.error || new Error('Could not read retry uploads.'));
            };
        });
    }

    async function deleteWorkoutFeedShareQueueItem(id) {
        const db = await openWorkoutFeedShareQueueDb();
        return new Promise(function (resolve, reject) {
            const tx = db.transaction(WORKOUT_FEED_SHARE_QUEUE_STORE, 'readwrite');
            tx.objectStore(WORKOUT_FEED_SHARE_QUEUE_STORE).delete(id);
            tx.oncomplete = function () {
                db.close();
                resolve();
            };
            tx.onerror = function () {
                db.close();
                reject(tx.error || new Error('Could not clear retry upload.'));
            };
        });
    }

    function getQueuedWorkoutFeedShareFile(item) {
        const file = item && item.file;
        if (!file) return null;
        if (typeof File !== 'undefined' && file instanceof File) return file;
        if (typeof Blob !== 'undefined' && file instanceof Blob) {
            if (typeof File !== 'undefined') {
                return new File([file], item.fileName || 'share-set-video.mp4', {
                    type: item.fileType || file.type || 'video/mp4',
                    lastModified: item.fileLastModified || Date.now()
                });
            }
            return file;
        }
        return null;
    }

    function isRetryableWorkoutFeedShareError(error) {
        if (navigator && navigator.onLine === false) return true;
        const message = String(error && (error.message || error.name || error.code) || '').toLowerCase();
        if (!message) return true;
        if (/(log in|record or upload|choose a video|could not shrink|trim it|missing media|invalid)/i.test(message)) return false;
        return /(upload|network|fetch|failed|timeout|offline|abort|server|internal|load failed|failed to fetch)/i.test(message);
    }

    function getWorkoutFeedShareSuccessMessage(result) {
        const pointsAwarded = Number(result && result.pointsAwarded ? result.pointsAwarded : 0);
        const dailyLimitReached = !!(result && result.awardResult && result.awardResult.dailyLimitReached);
        return pointsAwarded > 0
            ? `Posted to Feed! +${pointsAwarded} XP`
            : dailyLimitReached
                ? 'Posted to Feed! Share a Set XP is once per day.'
                : 'Posted to Feed!';
    }

    function refreshWorkoutFeedShareAfterPost() {
        try {
            if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay();
            if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
        } catch (e) {}
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }
        if (typeof loadStories === 'function') {
            loadStories();
        }
    }

    async function prepareWorkoutFeedShareClip(file, statusTarget) {
        if (typeof window.prepareUploadableFeedVideo !== 'function') return file;
        return window.prepareUploadableFeedVideo(file, function (status) {
            if (statusTarget) statusTarget.textContent = status;
        });
    }

    async function queueWorkoutFeedShareUpload(payload) {
        const file = payload && payload.file;
        const userId = payload && payload.userId;
        if (!file || !userId) throw new Error('Could not save that clip for retry.');

        const item = {
            id: getWorkoutFeedShareQueueId(),
            userId: userId,
            file: file,
            fileName: file.name || 'share-set-video.mp4',
            fileType: file.type || 'video/mp4',
            fileSize: file.size || 0,
            fileLastModified: file.lastModified || Date.now(),
            caption: payload.caption || '',
            workoutName: payload.workoutName || '',
            createdAt: new Date().toISOString(),
            attempts: 0,
            lastError: payload.lastError || ''
        };

        await putWorkoutFeedShareQueueItem(item);
        scheduleWorkoutFeedShareRetry(30000);
        return item;
    }

    function scheduleWorkoutFeedShareRetry(delayMs) {
        if (workoutFeedShareRetryTimer) clearTimeout(workoutFeedShareRetryTimer);
        workoutFeedShareRetryTimer = setTimeout(function () {
            retryWorkoutFeedShareQueue(false);
        }, Math.max(5000, Number(delayMs || 30000)));
    }

    function ensureWorkoutFeedShareUploadBanner() {
        let banner = document.getElementById('workout-feed-share-upload-banner');
        if (banner) return banner;

        const styleId = 'workout-feed-share-upload-banner-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                @keyframes workoutFeedShareSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes workoutFeedShareSweep {
                    0% { transform: translateX(-40%); }
                    50% { transform: translateX(120%); }
                    100% { transform: translateX(-40%); }
                }
                #workout-feed-share-upload-banner,
                #workout-feed-share-upload-banner * {
                    color: #fff !important;
                    -webkit-text-fill-color: #fff !important;
                }
            `;
            document.head.appendChild(style);
        }

        banner = document.createElement('div');
        banner.id = 'workout-feed-share-upload-banner';
        banner.style.cssText = 'display:none; position:fixed; left:16px; right:16px; bottom:calc(16px + env(safe-area-inset-bottom, 0px)); z-index:720; background:rgba(17,24,39,0.96); color:#fff; -webkit-text-fill-color:#fff; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:12px 14px; box-shadow:0 18px 40px rgba(0,0,0,0.28); backdrop-filter:blur(12px); overflow:hidden;';
        banner.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:34px; height:34px; border-radius:999px; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <svg viewBox="0 0 24 24" style="width:18px; height:18px; fill:currentColor; animation:workoutFeedShareSpin 1s linear infinite;"><path d="M12 4V1L8 5l4 4V6c2.76 0 5 2.24 5 5 0 .86-.22 1.67-.62 2.38l1.47 1.47C18.57 13.17 19 11.64 19 10c0-3.87-3.13-7-7-7zm-5.85.62L4.68 3.15C3.43 4.58 2.67 6.44 2.67 8.5c0 3.87 3.13 7 7 7v3l4-4-4-4v3c-2.76 0-5-2.24-5-5 0-1.36.54-2.59 1.42-3.5z"/></svg>
                </div>
                <div style="flex:1; min-width:0;">
                    <div id="workout-feed-share-upload-text" style="font-size:0.92rem; font-weight:900; line-height:1.2; color:#fff; -webkit-text-fill-color:#fff;">Uploading your set...</div>
                    <div id="workout-feed-share-upload-subtext" style="font-size:0.75rem; opacity:0.78; line-height:1.35; margin-top:3px; color:#fff; -webkit-text-fill-color:#fff;">You can keep training.</div>
                </div>
            </div>
            <div style="height:4px; background:rgba(255,255,255,0.12); border-radius:999px; margin-top:10px; overflow:hidden;">
                <div id="workout-feed-share-upload-bar" style="height:100%; width:36%; border-radius:999px; background:linear-gradient(90deg,#f97316,#ef4444); animation:workoutFeedShareSweep 1.15s ease-in-out infinite;"></div>
            </div>
            <div id="workout-feed-share-upload-actions" style="display:none; gap:8px; margin-top:10px;">
                <button type="button" onclick="retryWorkoutFeedShareQueue(true)" style="flex:1; min-height:38px; border:none; border-radius:10px; background:#fff; color:#7f1d1d !important; -webkit-text-fill-color:#7f1d1d !important; font-weight:900; font-size:0.82rem;">Retry now</button>
                <button type="button" onclick="hideWorkoutFeedShareUploadBanner()" style="min-height:38px; border:1px solid rgba(255,255,255,0.28); border-radius:10px; background:rgba(255,255,255,0.08); color:#fff !important; -webkit-text-fill-color:#fff !important; font-weight:800; font-size:0.82rem; padding:0 13px;">Later</button>
            </div>
        `;
        document.body.appendChild(banner);
        return banner;
    }

    function showWorkoutFeedShareUploadBanner(message, type, options) {
        options = options || {};
        const banner = ensureWorkoutFeedShareUploadBanner();
        const text = banner.querySelector('#workout-feed-share-upload-text');
        const subtext = banner.querySelector('#workout-feed-share-upload-subtext');
        const bar = banner.querySelector('#workout-feed-share-upload-bar');
        const actions = banner.querySelector('#workout-feed-share-upload-actions');
        if (text) text.textContent = message || 'Uploading your set...';
        if (text) {
            text.style.color = '#fff';
            text.style.webkitTextFillColor = '#fff';
        }
        if (subtext) {
            subtext.textContent = type === 'error'
                ? 'Please try that clip again.'
                : type === 'queued'
                    ? 'Saved on this phone. We will retry when reception improves.'
                : type === 'success'
                    ? 'Shared to Feed.'
                    : 'You can keep training.';
            subtext.style.color = '#fff';
            subtext.style.webkitTextFillColor = '#fff';
        }
        if (banner) {
            banner.style.display = 'block';
            banner.style.color = '#fff';
            banner.style.webkitTextFillColor = '#fff';
            banner.style.borderColor = type === 'error'
                ? 'rgba(248,113,113,0.28)'
                : type === 'queued'
                    ? 'rgba(251,191,36,0.32)'
                : type === 'success'
                    ? 'rgba(74,222,128,0.28)'
                    : 'rgba(255,255,255,0.08)';
            banner.style.background = type === 'error'
                ? 'rgba(127,29,29,0.96)'
                : type === 'queued'
                    ? 'rgba(120,53,15,0.96)'
                : type === 'success'
                    ? 'rgba(3, 78, 52, 0.96)'
                    : 'rgba(17,24,39,0.96)';
        }
        if (bar) {
            bar.style.animation = (type === 'success' || type === 'queued') ? 'none' : 'workoutFeedShareSweep 1.15s ease-in-out infinite';
            bar.style.width = type === 'queued' ? '100%' : '36%';
            bar.style.background = type === 'error'
                ? 'linear-gradient(90deg,#fb7185,#ef4444)'
                : type === 'queued'
                    ? 'linear-gradient(90deg,#facc15,#f97316)'
                : type === 'success'
                    ? 'linear-gradient(90deg,#4ade80,#16a34a)'
                    : 'linear-gradient(90deg,#f97316,#ef4444)';
        }
        if (actions) {
            actions.style.display = (type === 'queued' || options.retry === true) ? 'flex' : 'none';
        }
        return text || banner;
    }

    function hideWorkoutFeedShareUploadBanner(delayMs) {
        const banner = document.getElementById('workout-feed-share-upload-banner');
        if (!banner) return;
        const hide = function () {
            banner.style.display = 'none';
        };
        if (delayMs && delayMs > 0) {
            setTimeout(hide, delayMs);
        } else {
            hide();
        }
    }

    function openWorkoutFeedShare(options) {
        options = options || {};
        const view = ensureWorkoutFeedShareView();
        const activeWorkout = document.getElementById('view-active-workout');
        workoutFeedShareState.source = options.source || (activeWorkout && activeWorkout.style.display !== 'none' ? 'workout' : 'movement');
        workoutFeedShareState.workoutName = options.workoutName || (workoutFeedShareState.source === 'workout' ? getActiveWorkoutName() : '');

        clearWorkoutFeedShareVideo();
        resetWorkoutFeedShareStatus();

        const captionInput = document.getElementById('workout-feed-share-caption');
        if (captionInput) captionInput.value = '';

        const bottomNav = document.querySelector('.bottom-nav');
        if (bottomNav) {
            workoutFeedShareState.previousBottomNavDisplay = bottomNav.style.display || '';
            bottomNav.style.display = 'none';
        }

        view.scrollTop = 0;
        view.style.display = 'block';
        if (typeof pushNavigationState === 'function') {
            try { pushNavigationState('view-workout-feed-share', closeWorkoutFeedShare); } catch (e) {}
        }
    }

    function hideWorkoutFeedShareChooserForUpload() {
        const view = document.getElementById('view-workout-feed-share');
        if (view) view.style.display = 'none';

        const bottomNav = document.querySelector('.bottom-nav');
        const activeWorkout = document.getElementById('view-active-workout');
        const isWorkoutOpen = activeWorkout && activeWorkout.style.display !== 'none';
        if (bottomNav && !isWorkoutOpen) {
            bottomNav.style.display = workoutFeedShareState.previousBottomNavDisplay || 'flex';
        }
    }

    function closeWorkoutFeedShare() {
        const view = document.getElementById('view-workout-feed-share');
        if (view) view.style.display = 'none';
        clearWorkoutFeedShareVideo();
        resetWorkoutFeedShareStatus();

        const bottomNav = document.querySelector('.bottom-nav');
        const activeWorkout = document.getElementById('view-active-workout');
        const isWorkoutOpen = activeWorkout && activeWorkout.style.display !== 'none';
        if (bottomNav && !isWorkoutOpen) {
            bottomNav.style.display = workoutFeedShareState.previousBottomNavDisplay || 'flex';
        }
    }

    function openWorkoutFeedShareCapture() {
        if (hasNativeWorkoutFeedShareVideoCamera()) {
            void openNativeWorkoutFeedShareCamera();
            return;
        }
        void openWorkoutFeedShareInAppCamera();
    }

    function openWorkoutFeedShareGallery() {
        openWorkoutFeedShareFilePicker();
    }

    function hasNativeWorkoutFeedShareVideoCamera() {
        if (window.NativePermissions && typeof window.NativePermissions.takeWorkoutVideo === 'function') return true;
        const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BalanceVideoCapture;
        return !!(plugin && typeof plugin.captureWorkoutVideo === 'function');
    }

    function ensureWorkoutFeedShareInAppCameraView() {
        let modal = document.getElementById('workout-feed-share-camera-modal');
        if (modal) return modal;

        const style = document.createElement('style');
        style.id = 'workout-feed-share-camera-styles';
        style.textContent = `
            #workout-feed-share-camera-modal {
                display: none;
                position: fixed;
                inset: 0;
                z-index: 760;
                background: #000;
                color: #fff;
                -webkit-text-fill-color: #fff;
                flex-direction: column;
                overflow: hidden;
            }
            #workout-feed-share-camera-video::-webkit-media-controls,
            #workout-feed-share-camera-video::-webkit-media-controls-start-playback-button,
            #workout-feed-share-camera-video::-webkit-media-controls-panel,
            #workout-feed-share-camera-video::-webkit-media-controls-overlay-play-button {
                display: none !important;
                -webkit-appearance: none;
            }
            .workout-feed-share-camera-top {
                position: absolute;
                top: calc(14px + env(safe-area-inset-top, 0px));
                left: 14px;
                right: 14px;
                z-index: 4;
                display: flex;
                align-items: center;
                justify-content: space-between;
                pointer-events: none;
            }
            .workout-feed-share-camera-pill {
                min-height: 40px;
                border-radius: 999px;
                background: rgba(0,0,0,0.52);
                border: 1px solid rgba(255,255,255,0.12);
                color: #fff;
                -webkit-text-fill-color: #fff;
                backdrop-filter: blur(10px);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 14px;
                font-size: 0.86rem;
                font-weight: 900;
                pointer-events: auto;
            }
            .workout-feed-share-camera-icon-btn {
                width: 48px;
                height: 48px;
                border-radius: 999px;
                border: 1px solid rgba(255,255,255,0.12);
                background: rgba(0,0,0,0.52);
                color: #fff;
                -webkit-text-fill-color: #fff;
                backdrop-filter: blur(10px);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                pointer-events: auto;
            }
            .workout-feed-share-camera-bottom {
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 4;
                padding: 72px 20px calc(28px + env(safe-area-inset-bottom, 0px));
                background: linear-gradient(transparent, rgba(0,0,0,0.82) 42%);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 28px;
            }
            #workout-feed-share-camera-record-btn {
                width: 82px;
                height: 82px;
                border-radius: 999px;
                border: 4px solid rgba(255,255,255,0.92);
                background: transparent;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0;
            }
            #workout-feed-share-camera-record-btn span {
                width: 58px;
                height: 58px;
                border-radius: 999px;
                background: #ef4444;
                display: block;
                transition: all 0.16s ease;
            }
            #workout-feed-share-camera-record-btn.recording span {
                width: 34px;
                height: 34px;
                border-radius: 9px;
            }
            #workout-feed-share-camera-video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                background: #000;
                opacity: 0;
                transition: opacity 0.15s ease;
            }
        `;
        document.head.appendChild(style);

        modal = document.createElement('div');
        modal.id = 'workout-feed-share-camera-modal';
        modal.innerHTML = `
            <video id="workout-feed-share-camera-video" autoplay playsinline webkit-playsinline muted></video>
            <div class="workout-feed-share-camera-top">
                <button type="button" class="workout-feed-share-camera-icon-btn" onclick="closeWorkoutFeedShareInAppCamera(true)" aria-label="Close camera">
                    <svg viewBox="0 0 24 24" style="width:26px;height:26px;stroke:currentColor;fill:none;stroke-width:2.4;stroke-linecap:round;"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
                <div id="workout-feed-share-camera-status" class="workout-feed-share-camera-pill">Camera</div>
                <div style="width:48px;height:48px;"></div>
            </div>
            <div class="workout-feed-share-camera-bottom">
                <div style="width:50px;height:50px;"></div>
                <button type="button" id="workout-feed-share-camera-record-btn" onclick="toggleWorkoutFeedShareInAppRecording()" aria-label="Record set">
                    <span></span>
                </button>
                <button type="button" id="workout-feed-share-camera-flip-btn" class="workout-feed-share-camera-icon-btn" onclick="flipWorkoutFeedShareInAppCamera()" aria-label="Flip camera">
                    <svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><path d="M20 16V7a2 2 0 0 0-2-2H6"/><path d="m14 5 6 0 0 6"/><path d="M4 8v9a2 2 0 0 0 2 2h12"/><path d="m10 19-6 0 0-6"/></svg>
                </button>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    function setWorkoutFeedShareCameraStatus(message) {
        const status = document.getElementById('workout-feed-share-camera-status');
        if (status) status.textContent = message || 'Camera';
    }

    function formatWorkoutFeedShareCameraTime(ms) {
        const total = Math.max(0, Math.floor(ms / 1000));
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }

    function updateWorkoutFeedShareCameraRecordingUi(isRecording) {
        const recordBtn = document.getElementById('workout-feed-share-camera-record-btn');
        const flipBtn = document.getElementById('workout-feed-share-camera-flip-btn');
        if (recordBtn) {
            recordBtn.classList.toggle('recording', !!isRecording);
            recordBtn.setAttribute('aria-label', isRecording ? 'Stop recording' : 'Record set');
        }
        if (flipBtn) {
            flipBtn.disabled = !!isRecording;
            flipBtn.style.opacity = isRecording ? '0.4' : '1';
        }
    }

    function clearWorkoutFeedShareRecorderTimers() {
        if (workoutFeedShareRecorderTimer) {
            clearInterval(workoutFeedShareRecorderTimer);
            workoutFeedShareRecorderTimer = null;
        }
        if (workoutFeedShareRecorderMaxTimer) {
            clearTimeout(workoutFeedShareRecorderMaxTimer);
            workoutFeedShareRecorderMaxTimer = null;
        }
    }

    function stopWorkoutFeedShareCameraStream() {
        if (workoutFeedShareCameraStream) {
            try { workoutFeedShareCameraStream.getTracks().forEach(function (track) { track.stop(); }); } catch (e) {}
            workoutFeedShareCameraStream = null;
        }
        const video = document.getElementById('workout-feed-share-camera-video');
        if (video) {
            video.pause();
            video.srcObject = null;
            video.style.opacity = '0';
        }
    }

    function resetWorkoutFeedShareInAppCameraUi() {
        clearWorkoutFeedShareRecorderTimers();
        updateWorkoutFeedShareCameraRecordingUi(false);
        setWorkoutFeedShareCameraStatus('Camera');
    }

    async function getWorkoutFeedShareCameraStream() {
        const videoConstraints = {
            facingMode: { ideal: workoutFeedShareCameraFacingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 }
        };
        try {
            return await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true });
        } catch (firstError) {
            try {
                return await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
            } catch (secondError) {
                throw firstError || secondError;
            }
        }
    }

    async function openWorkoutFeedShareInAppCamera() {
        hideWorkoutFeedShareUploadBanner(1);
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function' || typeof window.MediaRecorder === 'undefined') {
            showWorkoutFeedShareUploadBanner('Camera recording is not available on this phone. Use Photos for now.', 'error');
            return;
        }

        const modal = ensureWorkoutFeedShareInAppCameraView();
        resetWorkoutFeedShareInAppCameraUi();
        modal.style.display = 'flex';

        if (window.NativePermissions && window.NativePermissions.enterImmersiveMode) {
            try { window.NativePermissions.enterImmersiveMode(); } catch (e) {}
        }

        try {
            stopWorkoutFeedShareCameraStream();
            setWorkoutFeedShareCameraStatus('Opening...');
            workoutFeedShareCameraStream = await getWorkoutFeedShareCameraStream();
            const video = document.getElementById('workout-feed-share-camera-video');
            if (!video) throw new Error('Camera preview is unavailable.');
            video.srcObject = workoutFeedShareCameraStream;
            video.muted = true;
            video.playsInline = true;
            await video.play();
            video.style.opacity = '1';
            setWorkoutFeedShareCameraStatus('Ready');
        } catch (error) {
            console.warn('[WorkoutFeedShare] in-app camera failed', error);
            closeWorkoutFeedShareInAppCamera(false);
            showWorkoutFeedShareUploadBanner('Could not open camera. Check camera permissions or use Photos.', 'error');
        }
    }

    function closeWorkoutFeedShareInAppCamera(cancelRecording) {
        if (workoutFeedShareRecorder && workoutFeedShareRecorder.state === 'recording') {
            stopWorkoutFeedShareInAppRecording(!cancelRecording);
            return;
        }
        const modal = document.getElementById('workout-feed-share-camera-modal');
        if (modal) modal.style.display = 'none';
        resetWorkoutFeedShareInAppCameraUi();
        stopWorkoutFeedShareCameraStream();
        if (window.NativePermissions && window.NativePermissions.exitImmersiveMode) {
            try { window.NativePermissions.exitImmersiveMode(); } catch (e) {}
        }
    }

    function getWorkoutFeedShareRecorderMimeType(stream) {
        if (typeof window.MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
        const hasAudio = !!(stream && typeof stream.getAudioTracks === 'function' && stream.getAudioTracks().length);
        const types = hasAudio
            ? [
                'video/mp4;codecs=h264,aac',
                'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
                'video/mp4',
                'video/webm;codecs=vp8,opus',
                'video/webm'
            ]
            : [
                'video/mp4;codecs=h264',
                'video/mp4;codecs=avc1.42E01E',
                'video/mp4',
                'video/webm;codecs=vp8',
                'video/webm'
            ];
        for (let i = 0; i < types.length; i += 1) {
            if (MediaRecorder.isTypeSupported(types[i])) return types[i];
        }
        return '';
    }

    function getWorkoutFeedShareRecorderExtension(mimeType) {
        const type = String(mimeType || '').toLowerCase();
        if (type.indexOf('webm') !== -1) return 'webm';
        if (type.indexOf('quicktime') !== -1) return 'mov';
        return 'mp4';
    }

    function startWorkoutFeedShareInAppRecording() {
        if (!workoutFeedShareCameraStream || workoutFeedShareRecorder) return;
        workoutFeedShareRecorderChunks = [];
        workoutFeedShareRecorderMimeType = getWorkoutFeedShareRecorderMimeType(workoutFeedShareCameraStream);
        workoutFeedShareRecorderSaveOnStop = true;

        try {
            const options = workoutFeedShareRecorderMimeType ? { mimeType: workoutFeedShareRecorderMimeType } : {};
            workoutFeedShareRecorder = new MediaRecorder(workoutFeedShareCameraStream, options);
        } catch (error) {
            console.warn('[WorkoutFeedShare] MediaRecorder unavailable', error);
            closeWorkoutFeedShareInAppCamera(false);
            showWorkoutFeedShareUploadBanner('Camera recording is not available on this phone. Use Photos for now.', 'error');
            return;
        }

        workoutFeedShareRecorder.ondataavailable = function (event) {
            if (event.data && event.data.size > 0) workoutFeedShareRecorderChunks.push(event.data);
        };
        workoutFeedShareRecorder.onerror = function (event) {
            console.warn('[WorkoutFeedShare] recorder error', event && event.error);
            workoutFeedShareRecorderSaveOnStop = false;
            setWorkoutFeedShareCameraStatus('Recording failed');
        };
        workoutFeedShareRecorder.onstop = handleWorkoutFeedShareInAppRecorderStop;

        workoutFeedShareRecorder.start(1000);
        workoutFeedShareRecorderStartedAt = Date.now();
        updateWorkoutFeedShareCameraRecordingUi(true);
        setWorkoutFeedShareCameraStatus('00:00');
        workoutFeedShareRecorderTimer = setInterval(function () {
            setWorkoutFeedShareCameraStatus(formatWorkoutFeedShareCameraTime(Date.now() - workoutFeedShareRecorderStartedAt));
        }, 500);
        workoutFeedShareRecorderMaxTimer = setTimeout(function () {
            stopWorkoutFeedShareInAppRecording(true);
        }, 75000);
    }

    function stopWorkoutFeedShareInAppRecording(saveRecording) {
        if (!workoutFeedShareRecorder) return;
        workoutFeedShareRecorderSaveOnStop = !!saveRecording;
        clearWorkoutFeedShareRecorderTimers();
        updateWorkoutFeedShareCameraRecordingUi(false);
        setWorkoutFeedShareCameraStatus(saveRecording ? 'Preparing...' : 'Camera');
        try {
            if (workoutFeedShareRecorder.state !== 'inactive') {
                workoutFeedShareRecorder.stop();
            }
        } catch (error) {
            console.warn('[WorkoutFeedShare] recorder stop failed', error);
            workoutFeedShareRecorder = null;
            if (saveRecording) showWorkoutFeedShareUploadBanner('Could not save that recording. Try again.', 'error');
        }
    }

    function handleWorkoutFeedShareInAppRecorderStop() {
        const recorder = workoutFeedShareRecorder;
        const shouldSave = workoutFeedShareRecorderSaveOnStop;
        const chunks = workoutFeedShareRecorderChunks.slice();
        const mimeType = workoutFeedShareRecorderMimeType || (recorder && recorder.mimeType) || 'video/mp4';

        workoutFeedShareRecorder = null;
        workoutFeedShareRecorderChunks = [];
        workoutFeedShareRecorderSaveOnStop = false;
        clearWorkoutFeedShareRecorderTimers();
        updateWorkoutFeedShareCameraRecordingUi(false);

        if (!shouldSave) {
            closeWorkoutFeedShareInAppCamera(false);
            return;
        }
        if (!chunks.length) {
            setWorkoutFeedShareCameraStatus('Try again');
            showWorkoutFeedShareUploadBanner('Could not save that recording. Try again.', 'error');
            return;
        }

        const blob = new Blob(chunks, { type: mimeType || 'video/mp4' });
        if (!blob.size) {
            setWorkoutFeedShareCameraStatus('Try again');
            showWorkoutFeedShareUploadBanner('The recorded clip was empty. Try again.', 'error');
            return;
        }

        const ext = getWorkoutFeedShareRecorderExtension(blob.type || mimeType);
        const fileName = 'share-set-' + Date.now() + '.' + ext;
        let file = blob;
        if (typeof File !== 'undefined') {
            file = new File([blob], fileName, {
                type: blob.type || mimeType || 'video/mp4',
                lastModified: Date.now()
            });
        } else {
            file.name = fileName;
            file.lastModified = Date.now();
        }

        closeWorkoutFeedShareInAppCamera(false);
        processWorkoutFeedShareSelectedFile(file);
    }

    function toggleWorkoutFeedShareInAppRecording() {
        if (workoutFeedShareRecorder && workoutFeedShareRecorder.state === 'recording') {
            stopWorkoutFeedShareInAppRecording(true);
            return;
        }
        startWorkoutFeedShareInAppRecording();
    }

    async function flipWorkoutFeedShareInAppCamera() {
        if (workoutFeedShareRecorder && workoutFeedShareRecorder.state === 'recording') return;
        workoutFeedShareCameraFacingMode = workoutFeedShareCameraFacingMode === 'environment' ? 'user' : 'environment';
        await openWorkoutFeedShareInAppCamera();
    }

    function getBalanceVideoCapturePlugin() {
        let plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BalanceVideoCapture;
        if (!plugin && window.Capacitor && typeof window.Capacitor.registerPlugin === 'function') {
            try { plugin = window.Capacitor.registerPlugin('BalanceVideoCapture'); } catch (e) {}
        }
        return plugin || null;
    }

    async function ensureNativeWorkoutVideoCameraPermission() {
        if (!window.NativePermissions || typeof window.NativePermissions.hasCameraPermission !== 'function') return true;
        try {
            if (window.NativePermissions.hasCameraPermission()) return true;
            if (window.NativePermissions.isPermissionPermanentlyDenied && window.NativePermissions.isPermissionPermanentlyDenied()) {
                return false;
            }
            if (typeof window.NativePermissions.requestCameraPermission !== 'function') return true;
            return await new Promise(function (resolve) {
                window._onNativeCameraPermission = function (result) {
                    delete window._onNativeCameraPermission;
                    resolve(!!result);
                };
                window.NativePermissions.requestCameraPermission();
                setTimeout(function () {
                    if (window._onNativeCameraPermission) {
                        delete window._onNativeCameraPermission;
                        resolve(false);
                    }
                }, 60000);
            });
        } catch (error) {
            console.warn('[WorkoutFeedShare] camera permission check failed', error);
            return true;
        }
    }

    async function captureAndroidWorkoutVideo() {
        if (!window.NativePermissions || typeof window.NativePermissions.takeWorkoutVideo !== 'function') return null;
        const granted = await ensureNativeWorkoutVideoCameraPermission();
        if (!granted) {
            throw new Error('Camera permission is blocked. Check app permissions.');
        }
        return new Promise(function (resolve) {
            let settled = false;
            window._onNativeWorkoutVideo = function (result) {
                if (settled) return;
                settled = true;
                delete window._onNativeWorkoutVideo;
                resolve(result || { cancelled: true });
            };
            try {
                window.NativePermissions.takeWorkoutVideo(75);
            } catch (error) {
                if (settled) return;
                settled = true;
                delete window._onNativeWorkoutVideo;
                resolve(null);
            }
            setTimeout(function () {
                if (settled) return;
                settled = true;
                delete window._onNativeWorkoutVideo;
                resolve({ cancelled: true });
            }, 180000);
        });
    }

    async function captureIosWorkoutVideo() {
        const plugin = getBalanceVideoCapturePlugin();
        if (!plugin || typeof plugin.captureWorkoutVideo !== 'function') return null;
        return plugin.captureWorkoutVideo({ maxDurationSeconds: 75 });
    }

    async function nativeWorkoutVideoResultToFile(result) {
        if (!result || result.cancelled) return null;

        let source = result.webPath || result.url || '';
        const rawPath = result.path || result.filePath || '';
        if (!source && rawPath && window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function') {
            source = window.Capacitor.convertFileSrc(rawPath);
        }
        if (!source) {
            throw new Error('The camera returned a clip the app could not read.');
        }

        const response = await fetch(source);
        if (!response.ok) throw new Error('Could not load the recorded clip.');

        const blob = await response.blob();
        if (!blob || !blob.size) throw new Error('The recorded clip was empty.');

        const fallbackName = result.name || ('share-set-' + Date.now() + '.mp4');
        const mimeType = result.mimeType || blob.type || getWorkoutFeedShareVideoMimeType({ name: fallbackName }) || 'video/mp4';
        return new File([blob], fallbackName, {
            type: mimeType,
            lastModified: Date.now()
        });
    }

    async function openNativeWorkoutFeedShareCamera() {
        const bannerLabel = showWorkoutFeedShareUploadBanner('Opening camera...', 'info');
        try {
            let result = await captureAndroidWorkoutVideo();
            if (!result) result = await captureIosWorkoutVideo();

            if (!result) {
                hideWorkoutFeedShareUploadBanner(1);
                await openWorkoutFeedShareInAppCamera();
                return;
            }
            if (result.cancelled) {
                hideWorkoutFeedShareUploadBanner(300);
                return;
            }

            if (bannerLabel) bannerLabel.textContent = 'Preparing your set...';
            const file = await nativeWorkoutVideoResultToFile(result);
            if (!file) {
                hideWorkoutFeedShareUploadBanner(300);
                return;
            }
            processWorkoutFeedShareSelectedFile(file);
        } catch (error) {
            console.error('[WorkoutFeedShare] native camera failed', error);
            hideWorkoutFeedShareUploadBanner(1);
            await openWorkoutFeedShareInAppCamera();
        }
    }

    function clearWorkoutFeedSharePendingInput() {
        if (!workoutFeedSharePendingInput) return;
        try {
            if (workoutFeedSharePendingInput.parentNode) {
                workoutFeedSharePendingInput.parentNode.removeChild(workoutFeedSharePendingInput);
            }
        } catch (e) {}
        workoutFeedSharePendingInput = null;
    }

    function openWorkoutFeedShareFilePicker() {
        clearWorkoutFeedSharePendingInput();

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.setAttribute('aria-hidden', 'true');
        input.style.cssText = 'position:fixed; left:-9999px; top:0; width:1px; height:1px; opacity:0; pointer-events:none;';

        workoutFeedSharePendingInput = input;

        input.addEventListener('change', function (event) {
            handleWorkoutFeedShareFileSelect(event);
            setTimeout(clearWorkoutFeedSharePendingInput, 0);
        }, { once: true });

        input.addEventListener('cancel', function () {
            clearWorkoutFeedSharePendingInput();
        }, { once: true });

        document.body.appendChild(input);
        try {
            input.click();
        } catch (error) {
            console.warn('[WorkoutFeedShare] camera picker failed', error);
            clearWorkoutFeedSharePendingInput();
            showWorkoutFeedShareUploadBanner('Could not open the camera. Tap Share a Set again.', 'error');
        }
    }

    function getWorkoutFeedShareVideoMimeType(file) {
        const type = String(file && file.type ? file.type : '').toLowerCase();
        if (type.startsWith('video/')) return type;

        const name = String(file && file.name ? file.name : '').toLowerCase();
        if (/\.(mov|qt)$/.test(name)) return 'video/quicktime';
        if (/\.(m4v)$/.test(name)) return 'video/x-m4v';
        if (/\.(webm)$/.test(name)) return 'video/webm';
        if (/\.(3gp|3gpp)$/.test(name)) return 'video/3gpp';
        if (/\.(mp4|mpeg|mpg)$/.test(name)) return 'video/mp4';
        return '';
    }

    function normalizeWorkoutFeedShareVideoFile(file) {
        const mimeType = getWorkoutFeedShareVideoMimeType(file);
        if (!mimeType) return null;
        if (file.type && String(file.type).toLowerCase().startsWith('video/')) return file;
        if (typeof File !== 'undefined') {
            const fileName = file.name || 'share-set-video.mp4';
            return new File([file], fileName, {
                type: mimeType,
                lastModified: file.lastModified || Date.now()
            });
        }
        return file;
    }

    function processWorkoutFeedShareSelectedFile(rawFile) {
        const file = normalizeWorkoutFeedShareVideoFile(rawFile);
        if (!file) {
            showWorkoutFeedShareUploadBanner('Please choose a video clip.', 'error');
            return;
        }
        clearWorkoutFeedShareVideo();
        workoutFeedShareState.file = file;
        workoutFeedShareState.objectUrl = URL.createObjectURL(file);
        hideWorkoutFeedShareChooserForUpload();
        const bannerLabel = showWorkoutFeedShareUploadBanner('Uploading your set...', 'info');
        void submitWorkoutFeedShare({
            postBtn: bannerLabel
        });
    }

    function handleWorkoutFeedShareFileSelect(event) {
        const input = event && event.target;
        const rawFile = input && input.files ? input.files[0] : null;
        if (input) input.value = '';
        if (!rawFile) return;
        processWorkoutFeedShareSelectedFile(rawFile);
    }

    function clearWorkoutFeedShareVideo() {
        if (workoutFeedShareState.objectUrl) {
            try { URL.revokeObjectURL(workoutFeedShareState.objectUrl); } catch (e) {}
        }
        workoutFeedShareState.file = null;
        workoutFeedShareState.objectUrl = null;

        const preview = document.getElementById('workout-feed-share-video-preview');
        const removeBtn = document.getElementById('workout-feed-share-remove-video');
        if (preview) {
            preview.pause();
            preview.removeAttribute('src');
            preview.load();
            preview.style.display = 'none';
        }
        if (removeBtn) removeBtn.style.display = 'none';
    }

    async function submitWorkoutFeedShare(options = {}) {
        const submitBtn = options.postBtn || document.getElementById('workout-feed-share-submit-btn');
        const captionInput = document.getElementById('workout-feed-share-caption');
        const userId = window.currentUser && window.currentUser.id;

        if (!userId) {
            showWorkoutFeedShareUploadBanner('Please log in before posting a workout clip.', 'error');
            return;
        }
        if (!workoutFeedShareState.file) {
            showWorkoutFeedShareUploadBanner('Record or upload a clip first.', 'error');
            return;
        }

        const caption = (options.caption && String(options.caption).trim()) || (captionInput && captionInput.value.trim()) || '';
        const workoutName = workoutFeedShareState.workoutName || getActiveWorkoutName();

        try {
            if (submitBtn && typeof submitBtn === 'object' && 'disabled' in submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Posting...';
                submitBtn.style.opacity = '0.7';
            }

            workoutFeedShareState.file = await prepareWorkoutFeedShareClip(workoutFeedShareState.file, submitBtn);

            if (navigator && navigator.onLine === false) {
                await queueWorkoutFeedShareUpload({
                    userId: userId,
                    file: workoutFeedShareState.file,
                    caption: caption,
                    workoutName: workoutName,
                    lastError: 'offline'
                });
                showWorkoutFeedShareUploadBanner('Saved for retry', 'queued', { retry: true });
                clearWorkoutFeedShareVideo();
                return;
            }

            const result = await window.createWorkoutFeedSharePost({
                file: workoutFeedShareState.file,
                caption: caption,
                workoutName: workoutName,
                source: 'feed_workout_share',
                postBtn: submitBtn,
                pointsType: 'workout_feed_share',
                skipVideoPreparation: true,
                uploadTimeoutMs: 45000
            });

            const successMessage = getWorkoutFeedShareSuccessMessage(result);
            showWorkoutFeedShareUploadBanner(successMessage, 'success');

            if (typeof showToast === 'function') showToast(successMessage, 'success');
            refreshWorkoutFeedShareAfterPost();
            hideWorkoutFeedShareUploadBanner(1800);
            setTimeout(clearWorkoutFeedShareVideo, 1800);
        } catch (error) {
            console.error('[WorkoutFeedShare] submit failed', error);
            if (isRetryableWorkoutFeedShareError(error) && workoutFeedShareState.file) {
                try {
                    await queueWorkoutFeedShareUpload({
                        userId: userId,
                        file: workoutFeedShareState.file,
                        caption: caption,
                        workoutName: workoutName,
                        lastError: error && error.message ? error.message : 'upload failed'
                    });
                    showWorkoutFeedShareUploadBanner('Saved for retry', 'queued', { retry: true });
                    clearWorkoutFeedShareVideo();
                    return;
                } catch (queueError) {
                    console.warn('[WorkoutFeedShare] retry queue failed', queueError);
                }
            }
            showWorkoutFeedShareUploadBanner(error.message || 'Could not share that clip. Please try again.', 'error');
        } finally {
            if (submitBtn && typeof submitBtn === 'object' && 'disabled' in submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Post to Feed';
                submitBtn.style.opacity = '1';
            }
        }
    }

    async function retryWorkoutFeedShareQueue(manual) {
        if (workoutFeedShareRetryInProgress) {
            if (manual) showWorkoutFeedShareUploadBanner('Retry already running...', 'info');
            return;
        }

        const userId = window.currentUser && window.currentUser.id;
        if (!userId) {
            if (manual) showWorkoutFeedShareUploadBanner('Log in before retrying Share a Set.', 'error');
            else scheduleWorkoutFeedShareRetry(30000);
            return;
        }

        if (navigator && navigator.onLine === false) {
            showWorkoutFeedShareUploadBanner('Waiting for reception', 'queued', { retry: true });
            scheduleWorkoutFeedShareRetry(45000);
            return;
        }

        workoutFeedShareRetryInProgress = true;
        try {
            const items = (await getWorkoutFeedShareQueueItems()).filter(function (item) {
                return item && item.userId === userId;
            });

            if (!items.length) {
                if (manual) {
                    showWorkoutFeedShareUploadBanner('No Share a Set uploads waiting.', 'success');
                    hideWorkoutFeedShareUploadBanner(1400);
                }
                return;
            }

            for (const item of items) {
                const queuedFile = getQueuedWorkoutFeedShareFile(item);
                if (!queuedFile) {
                    await deleteWorkoutFeedShareQueueItem(item.id);
                    continue;
                }

                const bannerLabel = showWorkoutFeedShareUploadBanner('Retrying Share a Set...', 'info');
                try {
                    const result = await window.createWorkoutFeedSharePost({
                        file: queuedFile,
                        caption: item.caption || '',
                        workoutName: item.workoutName || '',
                        source: 'feed_workout_share',
                        postBtn: bannerLabel,
                        pointsType: 'workout_feed_share',
                        skipVideoPreparation: true,
                        uploadTimeoutMs: 45000,
                        photoTimestamp: item.createdAt || new Date().toISOString()
                    });

                    await deleteWorkoutFeedShareQueueItem(item.id);
                    const successMessage = getWorkoutFeedShareSuccessMessage(result);
                    showWorkoutFeedShareUploadBanner(successMessage, 'success');
                    if (typeof showToast === 'function') showToast(successMessage, 'success');
                    refreshWorkoutFeedShareAfterPost();
                    hideWorkoutFeedShareUploadBanner(1800);
                } catch (error) {
                    console.warn('[WorkoutFeedShare] queued retry failed', error);
                    await putWorkoutFeedShareQueueItem({
                        ...item,
                        attempts: Number(item.attempts || 0) + 1,
                        lastAttemptAt: new Date().toISOString(),
                        lastError: error && error.message ? error.message : 'retry failed'
                    });
                    showWorkoutFeedShareUploadBanner('Saved for retry', 'queued', { retry: true });
                    scheduleWorkoutFeedShareRetry(Math.min(5 * 60 * 1000, 30000 * Math.max(1, Number(item.attempts || 1))));
                    break;
                }
            }
        } catch (error) {
            console.warn('[WorkoutFeedShare] retry queue unavailable', error);
            if (manual) showWorkoutFeedShareUploadBanner('Could not retry just now.', 'error');
        } finally {
            workoutFeedShareRetryInProgress = false;
        }
    }

    window.openFormCheck = openFormCheck;
    window.closeFormCheck = closeFormCheck;
    window.openFormCheckCapture = openFormCheckCapture;
    window.openFormCheckGallery = openFormCheckGallery;
    window.handleFormCheckFileSelect = handleFormCheckFileSelect;
    window.clearFormCheckVideo = clearFormCheckVideo;
    window.submitFormCheck = submitFormCheck;
    window.openWorkoutFeedShare = openWorkoutFeedShare;
    window.closeWorkoutFeedShare = closeWorkoutFeedShare;
    window.openWorkoutFeedShareCapture = openWorkoutFeedShareCapture;
    window.openWorkoutFeedShareGallery = openWorkoutFeedShareGallery;
    window.handleWorkoutFeedShareFileSelect = handleWorkoutFeedShareFileSelect;
    window.clearWorkoutFeedShareVideo = clearWorkoutFeedShareVideo;
    window.submitWorkoutFeedShare = submitWorkoutFeedShare;
    window.closeWorkoutFeedShareInAppCamera = closeWorkoutFeedShareInAppCamera;
    window.toggleWorkoutFeedShareInAppRecording = toggleWorkoutFeedShareInAppRecording;
    window.flipWorkoutFeedShareInAppCamera = flipWorkoutFeedShareInAppCamera;
    window.retryWorkoutFeedShareQueue = retryWorkoutFeedShareQueue;
    window.hideWorkoutFeedShareUploadBanner = hideWorkoutFeedShareUploadBanner;

    document.addEventListener('DOMContentLoaded', ensureFormCheckView);
    document.addEventListener('DOMContentLoaded', ensureWorkoutFeedShareView);
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () { retryWorkoutFeedShareQueue(false); }, 4000);
    });
    window.addEventListener('online', function () {
        setTimeout(function () { retryWorkoutFeedShareQueue(false); }, 1000);
    });
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            setTimeout(function () { retryWorkoutFeedShareQueue(false); }, 1500);
        }
    });
})();
