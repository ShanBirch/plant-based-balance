(function () {
    const MAX_FORM_CHECK_VIDEO_BYTES = 180 * 1024 * 1024;
    const MAX_WORKOUT_FEED_SHARE_VIDEO_BYTES = 180 * 1024 * 1024;
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
                <div class="workout-feed-share-panel" style="background:linear-gradient(135deg,#111827 0%,#b91c1c 100%); color:white; border:none;">
                    <div style="font-size:0.78rem; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; opacity:0.85; margin-bottom:6px;">Stay in workout mode</div>
                    <div style="font-size:1.25rem; font-weight:900; line-height:1.15; margin-bottom:8px;">Record a set, post it to Feed, and earn +10 XP once a day</div>
                    <div style="font-size:0.86rem; line-height:1.45; opacity:0.9;">Open the camera, capture the clip, and keep your workout running.</div>
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
                            Record Clip
                        </button>
                        <button type="button" class="workout-feed-share-btn workout-feed-share-btn-secondary" onclick="openWorkoutFeedShareGallery()">
                            <svg viewBox="0 0 24 24"><path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/></svg>
                            Choose Clip
                        </button>
                    </div>
                    <input type="file" id="workout-feed-share-camera-input" accept="video/*" capture="environment" style="display:none;" onchange="handleWorkoutFeedShareFileSelect(event)">
                    <input type="file" id="workout-feed-share-gallery-input" accept="video/*" style="display:none;" onchange="handleWorkoutFeedShareFileSelect(event)">
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
            `;
            document.head.appendChild(style);
        }

        banner = document.createElement('div');
        banner.id = 'workout-feed-share-upload-banner';
        banner.style.cssText = 'display:none; position:fixed; left:16px; right:16px; bottom:calc(16px + env(safe-area-inset-bottom, 0px)); z-index:720; background:rgba(17,24,39,0.96); color:white; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:12px 14px; box-shadow:0 18px 40px rgba(0,0,0,0.28); backdrop-filter:blur(12px); overflow:hidden;';
        banner.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:34px; height:34px; border-radius:999px; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <svg viewBox="0 0 24 24" style="width:18px; height:18px; fill:currentColor; animation:workoutFeedShareSpin 1s linear infinite;"><path d="M12 4V1L8 5l4 4V6c2.76 0 5 2.24 5 5 0 .86-.22 1.67-.62 2.38l1.47 1.47C18.57 13.17 19 11.64 19 10c0-3.87-3.13-7-7-7zm-5.85.62L4.68 3.15C3.43 4.58 2.67 6.44 2.67 8.5c0 3.87 3.13 7 7 7v3l4-4-4-4v3c-2.76 0-5-2.24-5-5 0-1.36.54-2.59 1.42-3.5z"/></svg>
                </div>
                <div style="flex:1; min-width:0;">
                    <div id="workout-feed-share-upload-text" style="font-size:0.92rem; font-weight:900; line-height:1.2;">Uploading your set...</div>
                    <div id="workout-feed-share-upload-subtext" style="font-size:0.75rem; opacity:0.78; line-height:1.35; margin-top:3px;">You can keep training.</div>
                </div>
            </div>
            <div style="height:4px; background:rgba(255,255,255,0.12); border-radius:999px; margin-top:10px; overflow:hidden;">
                <div id="workout-feed-share-upload-bar" style="height:100%; width:36%; border-radius:999px; background:linear-gradient(90deg,#f97316,#ef4444); animation:workoutFeedShareSweep 1.15s ease-in-out infinite;"></div>
            </div>
        `;
        document.body.appendChild(banner);
        return banner;
    }

    function showWorkoutFeedShareUploadBanner(message, type) {
        const banner = ensureWorkoutFeedShareUploadBanner();
        const text = banner.querySelector('#workout-feed-share-upload-text');
        const subtext = banner.querySelector('#workout-feed-share-upload-subtext');
        const bar = banner.querySelector('#workout-feed-share-upload-bar');
        if (text) text.textContent = message || 'Uploading your set...';
        if (subtext) {
            subtext.textContent = type === 'error'
                ? 'Please try that clip again.'
                : type === 'success'
                    ? 'Shared to Feed.'
                    : 'You can keep training.';
        }
        if (banner) {
            banner.style.display = 'block';
            banner.style.borderColor = type === 'error'
                ? 'rgba(248,113,113,0.28)'
                : type === 'success'
                    ? 'rgba(74,222,128,0.28)'
                    : 'rgba(255,255,255,0.08)';
            banner.style.background = type === 'error'
                ? 'rgba(127,29,29,0.96)'
                : type === 'success'
                    ? 'rgba(3, 78, 52, 0.96)'
                    : 'rgba(17,24,39,0.96)';
        }
        if (bar) {
            bar.style.animation = type === 'success' ? 'none' : 'workoutFeedShareSweep 1.15s ease-in-out infinite';
            bar.style.background = type === 'error'
                ? 'linear-gradient(90deg,#fb7185,#ef4444)'
                : type === 'success'
                    ? 'linear-gradient(90deg,#4ade80,#16a34a)'
                    : 'linear-gradient(90deg,#f97316,#ef4444)';
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
        const activeWorkout = document.getElementById('view-active-workout');
        workoutFeedShareState.source = options.source || (activeWorkout && activeWorkout.style.display !== 'none' ? 'workout' : 'movement');
        workoutFeedShareState.workoutName = options.workoutName || (workoutFeedShareState.source === 'workout' ? getActiveWorkoutName() : '');

        clearWorkoutFeedShareVideo();
        resetWorkoutFeedShareStatus();
        openWorkoutFeedShareCapture();
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
        const input = document.getElementById('workout-feed-share-camera-input');
        if (input) input.click();
    }

    function openWorkoutFeedShareGallery() {
        const input = document.getElementById('workout-feed-share-gallery-input');
        if (input) input.click();
    }

    function handleWorkoutFeedShareFileSelect(event) {
        const input = event && event.target;
        const file = input && input.files ? input.files[0] : null;
        if (input) input.value = '';
        if (!file) return;

        if (!file.type || !file.type.startsWith('video/')) {
            showWorkoutFeedShareUploadBanner('Please choose a video clip.', 'error');
            return;
        }
        if (file.size > MAX_WORKOUT_FEED_SHARE_VIDEO_BYTES) {
            showWorkoutFeedShareUploadBanner('That video is too large. Keep workout shares under 180 MB.', 'error');
            return;
        }

        clearWorkoutFeedShareVideo();
        workoutFeedShareState.file = file;
        workoutFeedShareState.objectUrl = URL.createObjectURL(file);
        const bannerLabel = showWorkoutFeedShareUploadBanner('Uploading your set...', 'info');
        void submitWorkoutFeedShare({
            postBtn: bannerLabel
        });
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

        try {
            if (submitBtn && typeof submitBtn === 'object' && 'disabled' in submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Posting...';
                submitBtn.style.opacity = '0.7';
            }

            const result = await window.createWorkoutFeedSharePost({
                file: workoutFeedShareState.file,
                caption: caption,
                workoutName: workoutFeedShareState.workoutName || getActiveWorkoutName(),
                source: 'feed_workout_share',
                postBtn: submitBtn,
                pointsType: 'workout_feed_share'
            });

            const pointsAwarded = Number(result && result.pointsAwarded ? result.pointsAwarded : 0);
            const dailyLimitReached = !!(result && result.awardResult && result.awardResult.dailyLimitReached);
            const successMessage = pointsAwarded > 0
                ? `Posted to Feed! +${pointsAwarded} XP`
                : dailyLimitReached
                    ? 'Posted to Feed! Share a Set XP is once per day.'
                : 'Posted to Feed!';
            showWorkoutFeedShareUploadBanner(successMessage, 'success');

            if (typeof showToast === 'function') showToast(successMessage, 'success');
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
            hideWorkoutFeedShareUploadBanner(1800);
            setTimeout(clearWorkoutFeedShareVideo, 1800);
        } catch (error) {
            console.error('[WorkoutFeedShare] submit failed', error);
            showWorkoutFeedShareUploadBanner(error.message || 'Could not share that clip. Please try again.', 'error');
        } finally {
            if (submitBtn && typeof submitBtn === 'object' && 'disabled' in submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Post to Feed';
                submitBtn.style.opacity = '1';
            }
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

    document.addEventListener('DOMContentLoaded', ensureFormCheckView);
    document.addEventListener('DOMContentLoaded', ensureWorkoutFeedShareView);
})();
