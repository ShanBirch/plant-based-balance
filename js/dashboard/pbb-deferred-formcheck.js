(function () {
    const MAX_FORM_CHECK_VIDEO_BYTES = 180 * 1024 * 1024;
    let formCheckState = {
        file: null,
        objectUrl: null,
        source: 'movement',
        workoutName: '',
        previousBottomNavDisplay: ''
    };
    let swipeRegistered = false;

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

            const { error } = await window.supabaseClient
                .from('nudges')
                .insert({
                    sender_id: userId,
                    receiver_id: coachId,
                    message: messageLines.join('\n'),
                    nudge_type: 'form_check'
                });

            if (error) throw error;

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

    window.openFormCheck = openFormCheck;
    window.closeFormCheck = closeFormCheck;
    window.openFormCheckCapture = openFormCheckCapture;
    window.openFormCheckGallery = openFormCheckGallery;
    window.handleFormCheckFileSelect = handleFormCheckFileSelect;
    window.clearFormCheckVideo = clearFormCheckVideo;
    window.submitFormCheck = submitFormCheck;

    document.addEventListener('DOMContentLoaded', ensureFormCheckView);
})();
