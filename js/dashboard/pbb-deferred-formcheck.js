(function () {
    const MAX_FORM_CHECK_VIDEO_BYTES = 180 * 1024 * 1024;
    const WORKOUT_FEED_SHARE_QUEUE_DB = 'pbb_workout_feed_share_queue_v1';
    const WORKOUT_FEED_SHARE_QUEUE_STORE = 'uploads';
    const WORKOUT_FEED_SHARE_UPLOAD_TIMEOUT_MS = 300000;
    const WORKOUT_FEED_SHARE_NATIVE_UPLOAD_TIMEOUT_MAX_MS = 900000;
    const WORKOUT_FEED_SHARE_NATIVE_UPLOAD_TIMEOUT_MS_PER_MB = 10000;
    const WORKOUT_FEED_SHARE_LATE_RETRY_DELAY_MS = 120000;
    // Share a Set uploads large clips direct to B2. Keep the original HD file
    // whenever it is within the direct-upload ceiling to avoid phone re-encode crashes.
    const WORKOUT_FEED_SHARE_VIDEO_TARGET_BYTES = 100 * 1024 * 1024;
    const WORKOUT_FEED_SHARE_DIRECT_UPLOAD_MAX_BYTES = 1024 * 1024 * 1024;
    // iOS WKWebView can release a gallery-backed File after its hidden picker
    // is cleared. Copy ordinary phone clips while that picker is still alive.
    const WORKOUT_FEED_SHARE_IOS_STABLE_FILE_MAX_BYTES = 128 * 1024 * 1024;
    const WORKOUT_FEED_SHARE_CAMERA_VIDEO_BITS_PER_SECOND = 16000000;
    const WORKOUT_FEED_SHARE_CAMERA_AUDIO_BITS_PER_SECOND = 192000;
    const WORKOUT_FEED_SHARE_RECORDING_WIDTH = 1080;
    const WORKOUT_FEED_SHARE_RECORDING_HEIGHT = 1920;
    const WORKOUT_FEED_SHARE_CAMERA_FRAME_RATE = 30;
    const WORKOUT_FEED_SHARE_RETRY_NOTICE_ID = 'workout-feed-share-retry-notice';
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
    let workoutFeedShareUploadHideTimer = null;
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
    let workoutFeedShareRecordingStream = null;
    let workoutFeedShareRecordingFrameId = null;
    let workoutFeedShareCaptureTarget = 'share-set';
    let workoutFeedShareSuspendedSurface = null;
    let workoutFeedShareDiagnosticAttemptId = '';
    const workoutFeedShareNativeValidatedFiles = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

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
                    border: 1px solid rgba(184,137,43,0.24);
                    border-radius: 16px;
                    padding: 18px;
                    box-shadow: 0 8px 24px rgba(184,137,43,0.08);
                    margin-bottom: 14px;
                }
                #view-form-check .form-check-hero {
                    background: linear-gradient(135deg,#ffffff 0%,#fff8df 100%);
                    border: 1px solid rgba(184,137,43,0.32);
                    color: #151515;
                    box-shadow: 0 10px 26px rgba(184,137,43,0.12);
                }
                #view-form-check .form-check-eyebrow {
                    font-size: 0.78rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #b8892b;
                    margin-bottom: 6px;
                }
                #view-form-check .form-check-hero-title {
                    font-size: 1.25rem;
                    font-weight: 900;
                    line-height: 1.15;
                    margin-bottom: 8px;
                    color: #151515;
                }
                #view-form-check .form-check-hero-copy {
                    font-size: 0.86rem;
                    line-height: 1.45;
                    color: #6f6a61;
                    font-weight: 700;
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
                    background: linear-gradient(135deg,#b8892b 0%,#e4bd55 100%);
                    color: #151515;
                    -webkit-text-fill-color: #151515;
                    box-shadow: 0 8px 18px rgba(184,137,43,0.22);
                }
                #view-form-check .form-check-btn-secondary {
                    background: #fff;
                    color: #151515;
                    -webkit-text-fill-color: #151515;
                    border: 1px solid rgba(184,137,43,0.32);
                }
                #view-form-check .form-check-btn-muted {
                    background: #f8f5ee;
                    color: #6f6a61;
                    -webkit-text-fill-color: #6f6a61;
                }
                #view-form-check .form-check-btn-danger {
                    background: #fff;
                    color: #7a5a18;
                    -webkit-text-fill-color: #7a5a18;
                    border: 1px solid rgba(184,137,43,0.32);
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
                <div class="form-check-panel form-check-hero">
                    <div class="form-check-eyebrow">Send to Shannon</div>
                    <div class="form-check-hero-title">Film a set for a quick technique check</div>
                    <div class="form-check-hero-copy">Best with the whole body in frame, a side or 45 degree angle, and a clip under 60 seconds.</div>
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
                            Camera
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

    function isWorkoutFeedShareActiveWorkoutOpen() {
        const activeWorkout = document.getElementById('view-active-workout');
        return !!(activeWorkout && activeWorkout.style.display !== 'none');
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
        workoutFeedShareCaptureTarget = 'form-check';
        logWorkoutFeedShareDiagnostic('form_check_open', {
            formSource: formCheckState.source,
            hasWorkoutName: !!formCheckState.workoutName
        });

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
        openWorkoutFeedShareCameraForFile({ target: 'form-check' });
    }

    function openFormCheckGallery() {
        openWorkoutFeedShareGalleryForFile({ target: 'form-check' });
    }

    async function handleFormCheckFileSelect(event) {
        const input = event && event.target;
        const rawFile = input && input.files ? input.files[0] : null;
        logWorkoutFeedShareDiagnostic('form_check_gallery_result', {
            cancelled: !rawFile,
            ...getWorkoutFeedShareFileDiagnostic(rawFile)
        });
        const file = rawFile
            ? await materializeWorkoutFeedShareFile(rawFile, 'form_check_gallery')
            : null;
        if (input) input.value = '';
        if (!file) return;
        handleFormCheckVideoFile(file);
    }

    function getFormCheckVideoMimeType(file) {
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

    function handleFormCheckVideoFile(file) {
        if (!getFormCheckVideoMimeType(file)) {
            logWorkoutFeedShareDiagnostic('form_check_file_rejected', {
                reason: 'missing_video_mime_type',
                ...getWorkoutFeedShareFileDiagnostic(file)
            });
            setStatus('Please choose a video clip.', 'error');
            return;
        }
        if (file.size > MAX_FORM_CHECK_VIDEO_BYTES) {
            logWorkoutFeedShareDiagnostic('form_check_file_rejected', {
                reason: 'file_too_large',
                maximumBytes: MAX_FORM_CHECK_VIDEO_BYTES,
                ...getWorkoutFeedShareFileDiagnostic(file)
            });
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
        logWorkoutFeedShareDiagnostic('form_check_file_ready', getWorkoutFeedShareFileDiagnostic(file));
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

        logWorkoutFeedShareDiagnostic('form_check_upload_request_start', {
            requestId,
            ...getWorkoutFeedShareFileDiagnostic(file)
        });

        let response;
        try {
            response = await fetch('/api/upload-form-check-video', {
                method: 'POST',
                body: formData
            });
        } catch (error) {
            logWorkoutFeedShareDiagnostic('form_check_upload_network_error', {
                requestId,
                errorName: error && error.name ? error.name : 'Error',
                errorMessage: error && error.message ? error.message : String(error || 'upload request failed'),
                ...getWorkoutFeedShareFileDiagnostic(file)
            });
            throw error;
        }
        const payload = await response.json().catch(function () { return {}; });
        logWorkoutFeedShareDiagnostic('form_check_upload_response', {
            requestId,
            httpStatus: response.status,
            responseOk: response.ok,
            payloadSuccess: payload.success === true,
            errorMessage: payload.error || '',
            uploadedBytes: Number(payload.size || 0)
        });

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

    function buildFormCheckMessageText(uploadResult, exerciseName, notes, workoutName) {
        const messageLines = [
            'Form check request',
            'Exercise: ' + exerciseName
        ];
        messageLines.push('Video: [video: ' + uploadResult.publicUrl + ']');
        if (workoutName) messageLines.push('Workout: ' + workoutName);
        messageLines.push('Focus: ' + notes);
        return messageLines.join('\n');
    }

    async function submitFormCheckInBackground(job) {
        if (!job || !job.userId || !job.coachId || !job.file) return;

        workoutFeedShareCaptureTarget = 'form-check';
        workoutFeedShareDiagnosticAttemptId = job.attemptId || workoutFeedShareDiagnosticAttemptId;
        logWorkoutFeedShareDiagnostic('form_check_background_submit_start', {
            requestId: job.requestId,
            ...getWorkoutFeedShareFileDiagnostic(job.file)
        });

        try {
            let uploadResult;
            let primaryUploadError = null;
            try {
                uploadResult = await uploadFormCheckClip(job.userId, job.file, job.requestId);
                logWorkoutFeedShareDiagnostic('form_check_primary_upload_success', {
                    requestId: job.requestId,
                    uploadedBytes: Number(uploadResult?.upload?.size || job.file.size || 0)
                });
            } catch (uploadError) {
                primaryUploadError = uploadError;
                console.warn('[FormCheck] B2 upload failed, trying Supabase fallback', uploadError);
                logWorkoutFeedShareDiagnostic('form_check_primary_upload_failed', {
                    requestId: job.requestId,
                    errorName: uploadError && uploadError.name ? uploadError.name : 'Error',
                    errorMessage: uploadError && uploadError.message ? uploadError.message : String(uploadError || 'primary upload failed')
                });
            }

            if (!uploadResult && window.storageHelpers && typeof window.storageHelpers.uploadFormCheckVideo === 'function') {
                try {
                    logWorkoutFeedShareDiagnostic('form_check_fallback_upload_start', {
                        requestId: job.requestId,
                        ...getWorkoutFeedShareFileDiagnostic(job.file)
                    });
                    uploadResult = await window.storageHelpers.uploadFormCheckVideo(job.userId, job.file, job.requestId);
                    logWorkoutFeedShareDiagnostic('form_check_fallback_upload_success', {
                        requestId: job.requestId,
                        uploadedBytes: Number(job.file.size || 0)
                    });
                } catch (fallbackError) {
                    logWorkoutFeedShareDiagnostic('form_check_fallback_upload_failed', {
                        requestId: job.requestId,
                        errorName: fallbackError && fallbackError.name ? fallbackError.name : 'Error',
                        errorMessage: fallbackError && fallbackError.message ? fallbackError.message : String(fallbackError || 'fallback upload failed')
                    });
                    throw primaryUploadError || fallbackError;
                }
            }

            if (!uploadResult) {
                throw primaryUploadError || new Error('Video upload is not available yet. Please refresh and try again.');
            }

            const messageText = buildFormCheckMessageText(uploadResult, job.exerciseName, job.notes, job.workoutName);
            try {
                await submitFormCheckRequest({
                    coachId: job.coachId,
                    videoUrl: uploadResult.publicUrl,
                    exerciseName: job.exerciseName,
                    notes: job.notes,
                    workoutName: job.workoutName || '',
                    requestId: job.requestId
                });
                logWorkoutFeedShareDiagnostic('form_check_message_submit_success', {
                    requestId: job.requestId,
                    submitMode: 'server'
                });
            } catch (serverError) {
                if (serverError && serverError.status && serverError.status < 500 && serverError.status !== 404) {
                    throw serverError;
                }
                console.warn('[FormCheck] server submit failed, trying direct DM insert', serverError);
                await insertFormCheckNudgeFallback(job.userId, job.coachId, messageText, job.requestId);
                logWorkoutFeedShareDiagnostic('form_check_message_submit_success', {
                    requestId: job.requestId,
                    submitMode: 'direct_fallback',
                    serverErrorMessage: serverError && serverError.message ? serverError.message : ''
                });
            }

            logWorkoutFeedShareDiagnostic('form_check_submit_success', {
                requestId: job.requestId
            });
            if (typeof showToast === 'function') showToast('Form check sent to Shannon', 'success');
        } catch (error) {
            console.error('[FormCheck] background submit failed', error);
            logWorkoutFeedShareDiagnostic('form_check_submit_failed', {
                requestId: job.requestId,
                errorName: error && error.name ? error.name : 'Error',
                errorMessage: error && error.message ? error.message : String(error || 'form check failed'),
                ...getWorkoutFeedShareFileDiagnostic(job.file)
            });
            if (typeof showToast === 'function') {
                showToast(error.message || 'Form check upload failed. Please try again.', 'error');
            }
        }
    }

    function queueFormCheckBackgroundSubmit(job) {
        setTimeout(function () {
            submitFormCheckInBackground(job);
        }, 300);
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
        const pendingFile = formCheckState.file;
        const workoutName = formCheckState.workoutName || '';

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';
                submitBtn.style.opacity = '0.7';
            }
            setStatus('Video uploading in the background. You can keep working out.', 'info');
            const coachId = window._coachUserId || (typeof getCoachUserId === 'function' ? await getCoachUserId() : null);
            if (!coachId) throw new Error('Could not find Shannon in the app.');

            logWorkoutFeedShareDiagnostic('form_check_submit_queued', {
                requestId,
                hasCoachId: true,
                ...getWorkoutFeedShareFileDiagnostic(pendingFile)
            });

            closeFormCheck();
            if (typeof showToast === 'function') {
                showToast('Video uploading. You can keep working out.', 'success');
            }
            queueFormCheckBackgroundSubmit({
                userId: userId,
                coachId: coachId,
                file: pendingFile,
                exerciseName: exerciseName,
                notes: notes,
                workoutName: workoutName,
                requestId: requestId,
                attemptId: workoutFeedShareDiagnosticAttemptId
            });
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
                    border: 1px solid rgba(184,137,43,0.24);
                    border-radius: 16px;
                    padding: 18px;
                    box-shadow: 0 8px 24px rgba(184,137,43,0.08);
                    margin-bottom: 14px;
                }
                #view-workout-feed-share .workout-feed-share-hero {
                    background: linear-gradient(135deg,#ffffff 0%,#fff8df 100%);
                    border: 1px solid rgba(184,137,43,0.32);
                    color: #151515;
                    box-shadow: 0 10px 26px rgba(184,137,43,0.12);
                }
                #view-workout-feed-share .workout-feed-share-eyebrow {
                    font-size: 0.78rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #b8892b;
                    margin-bottom: 6px;
                }
                #view-workout-feed-share .workout-feed-share-hero-title {
                    font-size: 1.25rem;
                    font-weight: 900;
                    line-height: 1.15;
                    margin-bottom: 8px;
                    color: #151515;
                }
                #view-workout-feed-share .workout-feed-share-hero-copy {
                    font-size: 0.86rem;
                    line-height: 1.45;
                    color: #6f6a61;
                    font-weight: 700;
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
                    background: linear-gradient(135deg,#b8892b 0%,#e4bd55 100%);
                    color: #151515;
                    -webkit-text-fill-color: #151515;
                    box-shadow: 0 8px 18px rgba(184,137,43,0.22);
                }
                #view-workout-feed-share .workout-feed-share-btn-secondary {
                    background: #fff;
                    color: #151515;
                    -webkit-text-fill-color: #151515;
                    border: 1px solid rgba(184,137,43,0.32);
                }
                #view-workout-feed-share .workout-feed-share-btn-muted {
                    background: #f8f5ee;
                    color: #6f6a61;
                    -webkit-text-fill-color: #6f6a61;
                }
                #view-workout-feed-share .workout-feed-share-btn-danger {
                    background: #fff;
                    color: #7a5a18;
                    -webkit-text-fill-color: #7a5a18;
                    border: 1px solid rgba(184,137,43,0.32);
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
                <div class="workout-feed-share-panel workout-feed-share-hero">
                    <div class="workout-feed-share-eyebrow">Stay in workout mode</div>
                    <div class="workout-feed-share-hero-title">Record a set, post it to Feed, and earn +15 XP once a day</div>
                    <div class="workout-feed-share-hero-copy">Open the camera or choose a clip from Photos, then keep your workout running while it uploads.</div>
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

    function getWorkoutFeedShareFileDiagnostic(file) {
        if (!file) return {};
        return {
            clientFileName: file.name || 'share-set-video.mp4',
            contentType: file.type || '',
            fileSizeBytes: file.size || 0,
            fileLastModified: file.lastModified || null
        };
    }

    function getWorkoutFeedShareDiagnosticId(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return String(prefix || 'video-upload') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    }

    function beginWorkoutFeedShareDiagnosticAttempt(target, trigger) {
        workoutFeedShareCaptureTarget = target || workoutFeedShareCaptureTarget || 'share-set';
        workoutFeedShareDiagnosticAttemptId = getWorkoutFeedShareDiagnosticId('video-upload');
        logWorkoutFeedShareDiagnostic('video_upload_attempt_start', {
            captureTarget: workoutFeedShareCaptureTarget,
            trigger: trigger || 'unknown',
            hasNativeCamera: hasNativeWorkoutFeedShareVideoCamera(),
            nativePlatform: isWorkoutFeedShareNativePlatform()
        });
        return workoutFeedShareDiagnosticAttemptId;
    }

    function logWorkoutFeedShareDiagnostic(event, data) {
        if (typeof window.logFeedUploadDiagnostic !== 'function') return;
        window.logFeedUploadDiagnostic(event, {
            source: workoutFeedShareCaptureTarget === 'form-check'
                ? 'form_check'
                : workoutFeedShareCaptureTarget === 'custom-exercise'
                    ? 'custom_exercise'
                    : 'feed_workout_share',
            userId: window.currentUser && window.currentUser.id,
            captureTarget: workoutFeedShareCaptureTarget,
            attemptId: workoutFeedShareDiagnosticAttemptId,
            ...data
        });
    }

    function getWorkoutFeedShareUploadTimeoutMs(file) {
        const fallback = WORKOUT_FEED_SHARE_UPLOAD_TIMEOUT_MS;
        const sizeMb = Math.ceil(Number(file && file.size || 0) / (1024 * 1024));
        if (!isWorkoutFeedShareNativePlatform() || !Number.isFinite(sizeMb) || sizeMb <= 0) return fallback;
        return Math.min(
            WORKOUT_FEED_SHARE_NATIVE_UPLOAD_TIMEOUT_MAX_MS,
            Math.max(fallback, sizeMb * WORKOUT_FEED_SHARE_NATIVE_UPLOAD_TIMEOUT_MS_PER_MB)
        );
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

    function compareWorkoutFeedShareQueueNewestFirst(a, b) {
        const aTime = Date.parse(a && a.createdAt || '');
        const bTime = Date.parse(b && b.createdAt || '');
        if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
            return bTime - aTime;
        }
        return String(b && b.id || '').localeCompare(String(a && a.id || ''));
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
        if (/(log in|record or upload|choose a video|photo instead of a video|not a video|could not shrink|trim it|missing media|invalid)/i.test(message)) return false;
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

    const WORKOUT_FEED_SHARE_INVALID_VIDEO_MESSAGE = 'That recording saved as a photo instead of a video. Please record the set again.';

    function getWorkoutFeedShareAscii(bytes, start, length) {
        if (!bytes || bytes.length < start + length) return '';
        let text = '';
        for (let i = start; i < start + length; i += 1) {
            const code = bytes[i];
            text += code >= 32 && code <= 126 ? String.fromCharCode(code) : ' ';
        }
        return text;
    }

    function hasWorkoutFeedShareImageSignature(bytes) {
        if (!bytes || bytes.length < 4) return false;
        if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
        if (getWorkoutFeedShareAscii(bytes, 0, 4) === 'GIF8') return true;
        if (getWorkoutFeedShareAscii(bytes, 0, 4) === 'RIFF' && getWorkoutFeedShareAscii(bytes, 8, 4) === 'WEBP') return true;
        if (getWorkoutFeedShareAscii(bytes, 4, 4) === 'ftyp') {
            const brandText = getWorkoutFeedShareAscii(bytes, 8, Math.min(24, bytes.length - 8)).toLowerCase();
            return /\b(heic|heix|heif|mif1|msf1|avif)\b/.test(brandText);
        }
        return false;
    }

    function hasWorkoutFeedShareVideoSignature(bytes) {
        if (!bytes || bytes.length < 4) return false;
        if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return true;
        if (getWorkoutFeedShareAscii(bytes, 0, 4) === 'OggS') return true;
        if (getWorkoutFeedShareAscii(bytes, 4, 4) === 'ftyp') {
            return !hasWorkoutFeedShareImageSignature(bytes);
        }
        return false;
    }

    async function readWorkoutFeedShareHeaderBytes(file) {
        if (!file || typeof file.slice !== 'function') return null;
        const blob = file.slice(0, 32);
        if (!blob || typeof blob.arrayBuffer !== 'function') return null;
        try {
            return new Uint8Array(await blob.arrayBuffer());
        } catch (error) {
            console.warn('[WorkoutFeedShare] could not inspect clip header', error);
            return null;
        }
    }

    function isWorkoutFeedShareImageMimeType(type) {
        return /^image\//i.test(String(type || '').trim());
    }

    function isWorkoutFeedShareDeclaredVideo(file) {
        const type = String(file && file.type ? file.type : '').toLowerCase();
        return type.startsWith('video/') || !!getWorkoutFeedShareVideoMimeType(file);
    }

    async function assertWorkoutFeedShareVideoFile(file) {
        if (!file) throw new Error('Please choose a video clip.');
        const headerBytes = await readWorkoutFeedShareHeaderBytes(file);

        if (isWorkoutFeedShareImageMimeType(file.type) || hasWorkoutFeedShareImageSignature(headerBytes)) {
            throw new Error(WORKOUT_FEED_SHARE_INVALID_VIDEO_MESSAGE);
        }

        if (headerBytes && headerBytes.length && !hasWorkoutFeedShareVideoSignature(headerBytes) && !isWorkoutFeedShareDeclaredVideo(file)) {
            throw new Error('Please choose a video clip.');
        }
    }

    async function prepareWorkoutFeedShareClip(file, statusTarget) {
        await assertWorkoutFeedShareVideoFile(file);
        if (Number(file && file.size || 0) > 0 && file.size <= WORKOUT_FEED_SHARE_DIRECT_UPLOAD_MAX_BYTES) {
            return file;
        }
        if (typeof window.prepareUploadableFeedVideo !== 'function') return file;
        const preparedFile = await window.prepareUploadableFeedVideo(file, function (status) {
            if (statusTarget) statusTarget.textContent = status;
        }, {
            maxBytes: WORKOUT_FEED_SHARE_VIDEO_TARGET_BYTES
        });
        await assertWorkoutFeedShareVideoFile(preparedFile);
        return preparedFile;
    }

    async function queueWorkoutFeedShareUpload(payload) {
        const file = payload && payload.file;
        const userId = payload && payload.userId;
        if (!file || !userId) throw new Error('Could not save that clip for retry.');

        const retryDelayMs = Math.max(0, Number(payload.retryDelayMs || 0));
        const createdAt = payload.createdAt || new Date().toISOString();
        const nextAttemptAt = payload.nextAttemptAt || (retryDelayMs
            ? new Date(Date.now() + retryDelayMs).toISOString()
            : createdAt);
        const item = {
            id: payload.id || getWorkoutFeedShareQueueId(),
            userId: userId,
            file: file,
            fileName: file.name || 'share-set-video.mp4',
            fileType: file.type || 'video/mp4',
            fileSize: file.size || 0,
            fileLastModified: file.lastModified || Date.now(),
            caption: payload.caption || '',
            workoutName: payload.workoutName || '',
            createdAt: createdAt,
            attempts: Number(payload.attempts || 0),
            lastAttemptAt: payload.lastAttemptAt || null,
            nextAttemptAt: nextAttemptAt,
            lastError: payload.lastError || ''
        };

        await putWorkoutFeedShareQueueItem(item);
        if (item.lastError === 'posting') {
            logWorkoutFeedShareDiagnostic('share_set_queue_staged', {
                queueId: item.id,
                workoutName: item.workoutName,
                nextAttemptAt: item.nextAttemptAt,
                ...getWorkoutFeedShareFileDiagnostic(file)
            });
        }
        if (item.lastError && item.lastError !== 'posting') {
            logWorkoutFeedShareDiagnostic('share_set_saved_for_retry', {
                queueId: item.id,
                reason: item.lastError,
                attempts: item.attempts,
                nextAttemptAt: item.nextAttemptAt,
                workoutName: item.workoutName,
                ...getWorkoutFeedShareFileDiagnostic(file)
            });
        }
        refreshWorkoutFeedShareRetryNotice().catch(function () {});
        return item;
    }

    function scheduleWorkoutFeedShareRetry(delayMs) {
        if (workoutFeedShareRetryTimer) clearTimeout(workoutFeedShareRetryTimer);
        workoutFeedShareRetryTimer = null;
    }

    function resetWorkoutFeedShareUploadBannerMotion(banner) {
        if (!banner) return;
        banner.style.transition = '';
        banner.style.transform = '';
        banner.style.opacity = '1';
    }

    function installWorkoutFeedShareUploadBannerDismissHandlers(banner) {
        if (!banner || banner.dataset.dismissHandlersAttached === 'true') return;
        banner.dataset.dismissHandlersAttached = 'true';

        let startX = 0;
        let startY = 0;
        let lastX = 0;
        let lastY = 0;
        let tracking = false;
        let dragging = false;

        const getTouchPoint = function (event) {
            const touch = event && event.changedTouches && event.changedTouches[0]
                ? event.changedTouches[0]
                : event && event.touches && event.touches[0]
                    ? event.touches[0]
                    : null;
            return touch ? { x: touch.clientX, y: touch.clientY } : null;
        };

        const resetDragState = function () {
            startX = 0;
            startY = 0;
            lastX = 0;
            lastY = 0;
            tracking = false;
            dragging = false;
        };

        banner.addEventListener('touchstart', function (event) {
            const target = event && event.target;
            if (target && typeof target.closest === 'function' && target.closest('button')) return;
            const point = getTouchPoint(event);
            if (!point) return;
            startX = point.x;
            startY = point.y;
            lastX = 0;
            lastY = 0;
            tracking = true;
            dragging = false;
            banner.style.transition = '';
        }, { passive: true });

        banner.addEventListener('touchmove', function (event) {
            if (!tracking) return;
            const point = getTouchPoint(event);
            if (!point) return;

            lastX = point.x - startX;
            lastY = point.y - startY;
            const absX = Math.abs(lastX);
            const downY = Math.max(0, lastY);
            const dragDistance = Math.max(absX, downY);
            if (!dragging && dragDistance < 10) return;

            dragging = true;
            banner.style.transform = 'translate(' + lastX + 'px, ' + downY + 'px)';
            banner.style.opacity = String(Math.max(0.35, 1 - (dragDistance / 220)));
            if (event.cancelable) event.preventDefault();
        }, { passive: false });

        const finishSwipe = function () {
            if (!tracking) return;

            const absX = Math.abs(lastX);
            const downY = Math.max(0, lastY);
            const shouldDismiss = absX > 80 || downY > 60;
            if (shouldDismiss) {
                const exitX = absX >= downY ? (lastX < 0 ? '-120%' : '120%') : lastX + 'px';
                const exitY = downY > absX ? '140%' : downY + 'px';
                banner.style.transition = 'transform 0.18s ease-out, opacity 0.18s ease-out';
                banner.style.transform = 'translate(' + exitX + ', ' + exitY + ')';
                banner.style.opacity = '0';
                resetDragState();
                setTimeout(function () { hideWorkoutFeedShareUploadBanner(); }, 170);
                return;
            }

            banner.style.transition = 'transform 0.18s ease-out, opacity 0.18s ease-out';
            banner.style.transform = 'translate(0, 0)';
            banner.style.opacity = '1';
            resetDragState();
            setTimeout(function () {
                if (banner.style.display !== 'none') banner.style.transition = '';
            }, 190);
        };

        banner.addEventListener('touchend', finishSwipe, { passive: true });
        banner.addEventListener('touchcancel', function () {
            if (!tracking) return;
            banner.style.transition = 'transform 0.18s ease-out, opacity 0.18s ease-out';
            banner.style.transform = 'translate(0, 0)';
            banner.style.opacity = '1';
            resetDragState();
        }, { passive: true });
    }

    function getWorkoutFeedShareNextRetryDelay(items) {
        const now = Date.now();
        let soonest = 0;
        let hasDueItem = false;
        (items || []).forEach(function (item) {
            const ts = Date.parse(item && item.nextAttemptAt || '');
            if (!Number.isFinite(ts) || ts <= now) {
                hasDueItem = true;
                return;
            }
            if (!soonest || ts < soonest) soonest = ts;
        });
        if (hasDueItem) return 5000;
        return soonest ? Math.max(5000, soonest - now) : 30000;
    }

    function markWorkoutFeedShareTimeoutError(message) {
        const error = new Error(message || 'Upload timed out. Saved for retry.');
        error.name = 'WorkoutFeedShareTimeout';
        error.workoutFeedShareTimeout = true;
        return error;
    }

    function waitForWorkoutFeedSharePost(promise, timeoutMs, controller) {
        let timeoutId = null;
        const timeout = new Promise(function (_, reject) {
            timeoutId = setTimeout(function () {
                if (controller && typeof controller.abort === 'function') {
                    try { controller.abort(); } catch (e) {}
                }
                reject(markWorkoutFeedShareTimeoutError());
            }, Math.max(15000, Number(timeoutMs || WORKOUT_FEED_SHARE_UPLOAD_TIMEOUT_MS) + 5000));
        });
        return Promise.race([promise, timeout]).finally(function () {
            if (timeoutId) clearTimeout(timeoutId);
        });
    }

    function forgetQueuedWorkoutFeedShareOnLateSuccess(postPromise, queueItem) {
        if (!postPromise || !queueItem || !queueItem.id) return;
        postPromise.then(function () {
            clearPostedWorkoutFeedShareQueueItems(queueItem).catch(function () {});
        }).catch(function () {});
    }

    function escapeWorkoutFeedShareHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[char] || char;
        });
    }

    function formatWorkoutFeedShareFileSize(bytes) {
        const size = Number(bytes || 0);
        if (!Number.isFinite(size) || size <= 0) return '';
        if (size < 1024 * 1024) return Math.max(1, Math.round(size / 1024)) + 'KB';
        return (Math.round((size / (1024 * 1024)) * 10) / 10) + 'MB';
    }

    function formatWorkoutFeedShareQueuedAge(item) {
        const ts = Date.parse(item && item.createdAt || '');
        if (!Number.isFinite(ts)) return 'Saved for later';
        const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
        if (minutes < 1) return 'Saved just now';
        if (minutes < 60) return 'Saved ' + minutes + 'm ago';
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return 'Saved ' + hours + 'h ago';
        return 'Saved ' + Math.floor(hours / 24) + 'd ago';
    }

    function ensureWorkoutFeedShareRetryNotice() {
        const feedComposer = document.getElementById('feed-composer-card');
        const feedSection = document.getElementById('friends-feed-section');
        const anchor = feedComposer || feedSection;
        if (!anchor || !anchor.parentNode) return null;

        const styleId = WORKOUT_FEED_SHARE_RETRY_NOTICE_ID + '-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID},
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} * {
                    box-sizing: border-box;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} {
                    margin: 0 15px 12px;
                    background: #fff7ed;
                    border: 1px solid #fed7aa;
                    border-radius: 14px;
                    box-shadow: 0 8px 24px rgba(154, 52, 18, 0.12);
                    overflow: hidden;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-inner {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                    padding: 12px;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-icon {
                    width: 38px;
                    height: 38px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #7c2d12, #dc2626);
                    color: #fff;
                    -webkit-text-fill-color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-title {
                    color: #431407;
                    -webkit-text-fill-color: #431407;
                    font-size: 0.92rem;
                    font-weight: 900;
                    line-height: 1.2;
                    margin-bottom: 3px;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-content {
                    flex: 1;
                    min-width: 0;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-top: 8px;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 9px;
                    border: 1px solid rgba(124, 45, 18, 0.12);
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.6);
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-row-title {
                    color: #431407;
                    -webkit-text-fill-color: #431407;
                    font-size: 0.84rem;
                    font-weight: 900;
                    line-height: 1.2;
                    margin-bottom: 2px;
                    overflow-wrap: anywhere;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-body,
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-meta {
                    color: #7c2d12;
                    -webkit-text-fill-color: #7c2d12;
                    font-size: 0.76rem;
                    font-weight: 700;
                    line-height: 1.32;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} button {
                    min-height: 38px;
                    border: none;
                    border-radius: 999px;
                    padding: 0 15px;
                    background: #dc2626;
                    color: #fff;
                    -webkit-text-fill-color: #fff;
                    font-size: 0.8rem;
                    font-weight: 900;
                    cursor: pointer;
                    box-shadow: 0 8px 18px rgba(220, 38, 38, 0.2);
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} button[disabled] {
                    opacity: 0.62;
                    cursor: default;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-clear {
                    width: 38px;
                    min-width: 38px;
                    padding: 0;
                    background: rgba(124, 45, 18, 0.1);
                    color: #7c2d12;
                    -webkit-text-fill-color: #7c2d12;
                    border: 1px solid rgba(124, 45, 18, 0.16);
                    box-shadow: none;
                }
                #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-clear svg {
                    width: 17px;
                    height: 17px;
                    display: block;
                    margin: 0 auto;
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 2.5;
                    stroke-linecap: round;
                }
                @media (max-width: 430px) {
                    #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-inner {
                        align-items: flex-start;
                    }
                    #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-row {
                        align-items: flex-start;
                        flex-direction: column;
                    }
                    #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-actions {
                        align-self: stretch;
                    }
                    #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} .share-set-retry-actions button:first-child {
                        flex: 1;
                    }
                    #${WORKOUT_FEED_SHARE_RETRY_NOTICE_ID} button {
                        padding: 0 12px;
                        white-space: nowrap;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        let notice = document.getElementById(WORKOUT_FEED_SHARE_RETRY_NOTICE_ID);
        if (!notice) {
            notice = document.createElement('div');
            notice.id = WORKOUT_FEED_SHARE_RETRY_NOTICE_ID;
            notice.style.display = 'none';
            anchor.parentNode.insertBefore(notice, anchor);
        }
        return notice;
    }

    async function getCurrentUserWorkoutFeedShareQueueItems() {
        const userId = window.currentUser && window.currentUser.id;
        if (!userId) return [];
        const items = await getWorkoutFeedShareQueueItems();
        return (items || []).filter(function (item) {
            return item && item.userId === userId;
        });
    }

    function isWorkoutFeedSharePostingStagingItem(item) {
        return String(item && item.lastError || '') === 'posting';
    }

    function isMatchingPostedWorkoutFeedShareQueueItem(item, referenceItem) {
        if (!item || !referenceItem) return false;
        if (item.id && referenceItem.id && item.id === referenceItem.id) return true;
        if (item.userId && referenceItem.userId && item.userId !== referenceItem.userId) return false;

        const itemSize = Number(item.fileSize || 0);
        const referenceSize = Number(referenceItem.fileSize || 0);
        if (itemSize && referenceSize && itemSize !== referenceSize) return false;

        const itemModified = Number(item.fileLastModified || 0);
        const referenceModified = Number(referenceItem.fileLastModified || 0);
        if (itemModified && referenceModified && itemModified === referenceModified) return true;

        const itemCreated = Date.parse(item.createdAt || '');
        const referenceCreated = Date.parse(referenceItem.createdAt || '');
        const sameWorkout = String(item.workoutName || '') === String(referenceItem.workoutName || '');
        return sameWorkout &&
            itemSize > 0 &&
            referenceSize > 0 &&
            Number.isFinite(itemCreated) &&
            Number.isFinite(referenceCreated) &&
            Math.abs(itemCreated - referenceCreated) <= 10 * 60 * 1000;
    }

    async function clearPostedWorkoutFeedShareQueueItems(referenceItem) {
        if (!referenceItem) return;
        try {
            const items = await getWorkoutFeedShareQueueItems();
            const matches = (items || []).filter(function (item) {
                return isMatchingPostedWorkoutFeedShareQueueItem(item, referenceItem);
            });
            for (const item of matches) {
                if (item && item.id) await deleteWorkoutFeedShareQueueItem(item.id);
            }
        } catch (error) {
            console.warn('[WorkoutFeedShare] posted queue cleanup failed', error);
        }
        refreshWorkoutFeedShareRetryNotice().catch(function () {});
    }

    async function discardWorkoutFeedShareQueue(manual, targetId) {
        if (workoutFeedShareRetryTimer) {
            clearTimeout(workoutFeedShareRetryTimer);
            workoutFeedShareRetryTimer = null;
        }

        try {
            const requestedQueueId = targetId ? String(targetId) : '';
            let items = (await getCurrentUserWorkoutFeedShareQueueItems()).filter(function (item) {
                return !isWorkoutFeedSharePostingStagingItem(item);
            });
            if (requestedQueueId) {
                items = items.filter(function (item) {
                    return String(item && item.id || '') === requestedQueueId;
                });
            }
            for (const item of items) {
                if (item && item.id) await deleteWorkoutFeedShareQueueItem(item.id);
            }
            if (items.length) {
                logWorkoutFeedShareDiagnostic('share_set_retry_discarded', {
                    queueId: requestedQueueId,
                    discardedCount: items.length,
                    manual: manual === true
                });
            }
            await refreshWorkoutFeedShareRetryNotice();
            const message = items.length === 1 ? 'Saved upload cleared' : 'Saved uploads cleared';
            showWorkoutFeedShareUploadBanner(items.length ? message : 'No saved uploads found', 'success');
            hideWorkoutFeedShareUploadBanner(1400);
            if (manual && typeof showToast === 'function') {
                showToast(items.length ? message : 'No saved uploads found', 'success');
            }
        } catch (error) {
            console.warn('[WorkoutFeedShare] could not clear saved uploads', error);
            if (manual) showWorkoutFeedShareUploadBanner('Could not clear saved uploads.', 'error');
        }
    }

    async function refreshWorkoutFeedShareRetryNotice() {
        const notice = ensureWorkoutFeedShareRetryNotice();
        if (!notice) return;

        let items = [];
        try {
            items = (await getCurrentUserWorkoutFeedShareQueueItems()).filter(function (item) {
                return !isWorkoutFeedSharePostingStagingItem(item);
            });
        } catch (error) {
            console.warn('[WorkoutFeedShare] retry notice unavailable', error);
            notice.style.display = 'none';
            return;
        }

        if (!items.length) {
            if (workoutFeedShareRetryTimer) {
                clearTimeout(workoutFeedShareRetryTimer);
                workoutFeedShareRetryTimer = null;
            }
            notice.style.display = 'none';
            notice.innerHTML = '';
            return;
        }

        items = items.slice().sort(compareWorkoutFeedShareQueueNewestFirst);
        const count = items.length;
        const title = count === 1 ? 'Share a Set is saved' : count + ' Share a Set uploads are saved';
        const rowsHtml = items.map(function (item, index) {
            const fileSize = formatWorkoutFeedShareFileSize(item.fileSize);
            const workoutName = String(item.workoutName || '').trim();
            const rowTitle = workoutName || 'Saved set';
            const rowBody = count === 1
                ? 'Saved on this phone. Tap Post now to try again.'
                : (index === 0 ? 'Newest saved set.' : 'Older saved set.');
            const metaParts = [formatWorkoutFeedShareQueuedAge(item)];
            if (fileSize) metaParts.push(fileSize);
            if (navigator && navigator.onLine === false) metaParts.push('Waiting for reception');
            const buttonText = workoutFeedShareRetryInProgress ? 'Posting...' : 'Post now';
            const queueId = escapeWorkoutFeedShareHtml(item && item.id || '');
            return `
                <div class="share-set-retry-row">
                    <div style="flex:1; min-width:0;">
                        <div class="share-set-retry-row-title">${escapeWorkoutFeedShareHtml(rowTitle)}</div>
                        <div class="share-set-retry-body">${escapeWorkoutFeedShareHtml(rowBody)}</div>
                        <div class="share-set-retry-meta">${escapeWorkoutFeedShareHtml(metaParts.join(' | '))}</div>
                    </div>
                    <div class="share-set-retry-actions">
                        <button type="button" data-share-set-retry-post="${queueId}" ${workoutFeedShareRetryInProgress ? 'disabled' : ''}>${escapeWorkoutFeedShareHtml(buttonText)}</button>
                        <button type="button" class="share-set-retry-clear" aria-label="Clear this saved Share a Set upload" data-share-set-retry-clear="${queueId}" ${workoutFeedShareRetryInProgress ? 'disabled' : ''}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        notice.innerHTML = `
            <div class="share-set-retry-inner">
                <div class="share-set-retry-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor;"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
                </div>
                <div class="share-set-retry-content">
                    <div class="share-set-retry-title">${escapeWorkoutFeedShareHtml(title)}</div>
                    <div class="share-set-retry-stack">${rowsHtml}</div>
                </div>
            </div>
        `;
        notice.style.display = 'block';
        notice.querySelectorAll('[data-share-set-retry-post]').forEach(function (button) {
            button.addEventListener('click', function () {
                postWorkoutFeedShareQueueNow(button.getAttribute('data-share-set-retry-post'));
            });
        });
        notice.querySelectorAll('[data-share-set-retry-clear]').forEach(function (button) {
            button.addEventListener('click', function () {
                discardWorkoutFeedShareQueue(true, button.getAttribute('data-share-set-retry-clear'));
            });
        });
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
                #workout-feed-share-upload-dismiss {
                    width: 34px;
                    height: 34px;
                    border: 1px solid rgba(255,255,255,0.22);
                    border-radius: 999px;
                    background: rgba(255,255,255,0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 0;
                    margin-left: 2px;
                    flex-shrink: 0;
                    cursor: pointer;
                    touch-action: manipulation;
                }
                #workout-feed-share-upload-dismiss:active {
                    transform: scale(0.96);
                }
                #workout-feed-share-upload-dismiss svg {
                    width: 18px;
                    height: 18px;
                    display: block;
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 2.5;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }
            `;
            document.head.appendChild(style);
        }

        banner = document.createElement('div');
        banner.id = 'workout-feed-share-upload-banner';
        banner.style.cssText = 'display:none; position:fixed; left:16px; right:16px; bottom:calc(16px + env(safe-area-inset-bottom, 0px)); z-index:10060; background:rgba(17,24,39,0.96); color:#fff; -webkit-text-fill-color:#fff; border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:12px 14px; box-shadow:0 18px 40px rgba(0,0,0,0.28); backdrop-filter:blur(12px); overflow:hidden;';
        banner.innerHTML = `
            <div style="display:flex; align-items:flex-start; gap:10px;">
                <div style="width:34px; height:34px; border-radius:999px; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                    <svg viewBox="0 0 24 24" style="width:18px; height:18px; fill:currentColor; animation:workoutFeedShareSpin 1s linear infinite;"><path d="M12 4V1L8 5l4 4V6c2.76 0 5 2.24 5 5 0 .86-.22 1.67-.62 2.38l1.47 1.47C18.57 13.17 19 11.64 19 10c0-3.87-3.13-7-7-7zm-5.85.62L4.68 3.15C3.43 4.58 2.67 6.44 2.67 8.5c0 3.87 3.13 7 7 7v3l4-4-4-4v3c-2.76 0-5-2.24-5-5 0-1.36.54-2.59 1.42-3.5z"/></svg>
                </div>
                <div style="flex:1; min-width:0; padding-top:1px;">
                    <div id="workout-feed-share-upload-text" style="font-size:0.92rem; font-weight:900; line-height:1.2; color:#fff; -webkit-text-fill-color:#fff;">Uploading your set...</div>
                    <div id="workout-feed-share-upload-subtext" style="font-size:0.75rem; opacity:0.78; line-height:1.35; margin-top:3px; color:#fff; -webkit-text-fill-color:#fff;">You can keep training.</div>
                </div>
                <button type="button" id="workout-feed-share-upload-dismiss" onclick="hideWorkoutFeedShareUploadBanner()" aria-label="Dismiss message">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
            </div>
            <div style="height:4px; background:rgba(255,255,255,0.12); border-radius:999px; margin-top:10px; overflow:hidden;">
                <div id="workout-feed-share-upload-bar" style="height:100%; width:36%; border-radius:999px; background:linear-gradient(90deg,#f97316,#ef4444); animation:workoutFeedShareSweep 1.15s ease-in-out infinite;"></div>
            </div>
            <div id="workout-feed-share-upload-actions" style="display:none; gap:8px; margin-top:10px;">
                <button type="button" onclick="postWorkoutFeedShareQueueNow()" style="flex:1; min-height:38px; border:none; border-radius:10px; background:#fff; color:#7f1d1d !important; -webkit-text-fill-color:#7f1d1d !important; font-weight:900; font-size:0.82rem;">Post now</button>
                <button type="button" onclick="hideWorkoutFeedShareUploadBanner()" style="min-height:38px; border:1px solid rgba(255,255,255,0.28); border-radius:10px; background:rgba(255,255,255,0.08); color:#fff !important; -webkit-text-fill-color:#fff !important; font-weight:800; font-size:0.82rem; padding:0 13px;">Later</button>
            </div>
        `;
        document.body.appendChild(banner);
        installWorkoutFeedShareUploadBannerDismissHandlers(banner);
        return banner;
    }

    function updateWorkoutFeedShareUploadBannerPlacement(banner) {
        if (!banner) return;
        const bottomNav = document.querySelector('.bottom-nav');
        let navHeight = 0;
        if (bottomNav) {
            const style = window.getComputedStyle ? window.getComputedStyle(bottomNav) : null;
            const rect = bottomNav.getBoundingClientRect ? bottomNav.getBoundingClientRect() : null;
            const visible = style && style.display !== 'none' && style.visibility !== 'hidden' && rect && rect.height > 0;
            if (visible) navHeight = Math.ceil(rect.height);
        }
        banner.style.zIndex = '10060';
        banner.style.bottom = navHeight > 0
            ? (navHeight + 14) + 'px'
            : 'calc(16px + env(safe-area-inset-bottom, 0px))';
    }

    function showWorkoutFeedShareUploadBanner(message, type, options) {
        options = options || {};
        const banner = ensureWorkoutFeedShareUploadBanner();
        if (workoutFeedShareUploadHideTimer) {
            clearTimeout(workoutFeedShareUploadHideTimer);
            workoutFeedShareUploadHideTimer = null;
        }
        resetWorkoutFeedShareUploadBannerMotion(banner);
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
                    ? 'Saved on this phone. Tap Post now to try again.'
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
            updateWorkoutFeedShareUploadBannerPlacement(banner);
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
            actions.style.display = ((type === 'queued' || options.retry === true) && options.retry !== false) ? 'flex' : 'none';
        }
        return text || banner;
    }

    function hideWorkoutFeedShareUploadBanner(delayMs) {
        const banner = document.getElementById('workout-feed-share-upload-banner');
        if (!banner) return;
        if (workoutFeedShareUploadHideTimer) {
            clearTimeout(workoutFeedShareUploadHideTimer);
            workoutFeedShareUploadHideTimer = null;
        }
        const hide = function () {
            resetWorkoutFeedShareUploadBannerMotion(banner);
            banner.style.display = 'none';
            workoutFeedShareUploadHideTimer = null;
        };
        if (delayMs && delayMs > 0) {
            workoutFeedShareUploadHideTimer = setTimeout(hide, delayMs);
        } else {
            hide();
        }
    }

    function openWorkoutFeedShare(options) {
        options = options || {};
        const view = ensureWorkoutFeedShareView();
        const activeWorkout = document.getElementById('view-active-workout');
        workoutFeedShareCaptureTarget = 'share-set';
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
        beginWorkoutFeedShareDiagnosticAttempt('share-set', 'camera');
        const hasNativeCamera = hasNativeWorkoutFeedShareVideoCamera();
        const nativePlatform = isWorkoutFeedShareNativePlatform();
        logWorkoutFeedShareDiagnostic('share_set_capture_open', {
            captureTarget: workoutFeedShareCaptureTarget,
            hasNativeCamera,
            nativePlatform
        });
        if (hasNativeCamera) {
            void openNativeWorkoutFeedShareCamera();
            return;
        }
        if (isIosNativeWorkoutFeedShare()) {
            logWorkoutFeedShareDiagnostic('video_ios_system_camera_picker', {
                fallbackReason: 'native_camera_plugin_unavailable'
            });
            openWorkoutFeedShareCameraPicker();
            return;
        }
        if (nativePlatform) {
            void openWorkoutFeedShareInAppCamera();
            return;
        }
        openWorkoutFeedShareCameraPicker();
    }

    function openWorkoutFeedShareGallery() {
        beginWorkoutFeedShareDiagnosticAttempt('share-set', 'gallery');
        logWorkoutFeedShareDiagnostic('share_set_gallery_open', {
            captureTarget: workoutFeedShareCaptureTarget,
            nativePlatform: isWorkoutFeedShareNativePlatform()
        });
        openWorkoutFeedShareFilePicker();
    }

    function openWorkoutFeedShareCameraPicker() {
        openWorkoutFeedShareFilePicker({ capture: true });
    }

    function openWorkoutFeedShareCameraForFile(options = {}) {
        restoreWorkoutFeedShareCaptureSurface();
        beginWorkoutFeedShareDiagnosticAttempt(options.target || 'share-set', 'camera');
        suspendWorkoutFeedShareCaptureSurface();
        if (hasNativeWorkoutFeedShareVideoCamera()) {
            void openWorkoutFeedShareCameraAfterSurfaceSettles(openNativeWorkoutFeedShareCamera);
            return true;
        }
        if (isIosNativeWorkoutFeedShare()) {
            logWorkoutFeedShareDiagnostic('video_ios_system_camera_picker', {
                fallbackReason: 'native_camera_plugin_unavailable'
            });
            void openWorkoutFeedShareCameraAfterSurfaceSettles(openWorkoutFeedShareCameraPicker);
            return true;
        }
        if (isWorkoutFeedShareNativePlatform()) {
            void openWorkoutFeedShareCameraAfterSurfaceSettles(openWorkoutFeedShareInAppCamera);
            return true;
        }
        openWorkoutFeedShareCameraPicker();
        return true;
    }

    function openWorkoutFeedShareGalleryForFile(options = {}) {
        restoreWorkoutFeedShareCaptureSurface();
        beginWorkoutFeedShareDiagnosticAttempt(options.target || 'share-set', 'gallery');
        suspendWorkoutFeedShareCaptureSurface();
        logWorkoutFeedShareDiagnostic('video_gallery_picker_open', {
            nativePlatform: isWorkoutFeedShareNativePlatform()
        });
        openWorkoutFeedShareFilePicker();
        return true;
    }

    function waitForWorkoutFeedShareHiddenSurfacePaint() {
        try { void document.body.offsetHeight; } catch (e) {}
        return new Promise(resolve => {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
                return;
            }
            setTimeout(resolve, 50);
        });
    }

    async function openWorkoutFeedShareCameraAfterSurfaceSettles(openCamera) {
        try {
            await waitForWorkoutFeedShareHiddenSurfacePaint();
            await openCamera();
        } catch (error) {
            console.error('[WorkoutFeedShare] camera launch failed after hiding surface', error);
            logWorkoutFeedShareDiagnostic('share_set_camera_launch_failed', {
                captureTarget: workoutFeedShareCaptureTarget,
                errorName: error && error.name ? error.name : 'Error',
                errorMessage: error && error.message ? error.message : String(error || 'camera launch failed')
            });
            restoreWorkoutFeedShareCaptureSurface();
            showWorkoutFeedShareUploadBanner('Could not open the camera. Check app permissions or use Photos.', 'error');
        }
    }

    function suspendWorkoutFeedShareCaptureSurface() {
        if (workoutFeedShareCaptureTarget === 'form-check') {
            const view = document.getElementById('view-form-check');
            if (view && view.style.display !== 'none') {
                workoutFeedShareSuspendedSurface = {
                    target: 'form-check',
                    display: view.style.display || 'block'
                };
                view.style.display = 'none';
            }
            return;
        }
        if (workoutFeedShareCaptureTarget === 'custom-exercise' && typeof window.suspendCustomExerciseCameraModal === 'function') {
            workoutFeedShareSuspendedSurface = {
                target: 'custom-exercise',
                suspended: window.suspendCustomExerciseCameraModal()
            };
        }
    }

    function restoreWorkoutFeedShareCaptureSurface() {
        const suspended = workoutFeedShareSuspendedSurface;
        if (!suspended) return;
        workoutFeedShareSuspendedSurface = null;
        if (suspended.target === 'form-check') {
            const view = document.getElementById('view-form-check');
            if (view) view.style.display = suspended.display || 'block';
            return;
        }
        if (suspended.target === 'custom-exercise' && typeof window.restoreCustomExerciseCameraModal === 'function') {
            window.restoreCustomExerciseCameraModal(suspended.suspended);
        }
    }

    function getWorkoutFeedShareCapturePreparingLabel() {
        return workoutFeedShareCaptureTarget === 'share-set' ? 'Preparing your set...' : 'Preparing video...';
    }

    function routeWorkoutFeedShareCapturedFile(file) {
        logWorkoutFeedShareDiagnostic('share_set_file_captured', {
            captureTarget: workoutFeedShareCaptureTarget,
            ...getWorkoutFeedShareFileDiagnostic(file)
        });
        if (workoutFeedShareCaptureTarget === 'form-check') {
            restoreWorkoutFeedShareCaptureSurface();
            handleFormCheckVideoFile(file);
            hideWorkoutFeedShareUploadBanner(300);
            return;
        }
        if (workoutFeedShareCaptureTarget === 'custom-exercise') {
            if (typeof window.handleCustomExerciseCapturedVideoFile === 'function') {
                restoreWorkoutFeedShareCaptureSurface();
                window.handleCustomExerciseCapturedVideoFile(file);
                hideWorkoutFeedShareUploadBanner(300);
                return;
            }
            showWorkoutFeedShareUploadBanner('Exercise video tool is still loading. Try Camera again.', 'error');
            return;
        }
        void processWorkoutFeedShareSelectedFile(file);
    }

    function isWorkoutFeedShareNativePlatform() {
        return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
    }

    function hasNativeWorkoutFeedShareVideoCamera() {
        if (window.NativePermissions && typeof window.NativePermissions.takeWorkoutVideo === 'function') return true;
        const plugin = getBalanceVideoCapturePlugin();
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
                object-fit: contain;
                background: #000;
                opacity: 0;
                transition: opacity 0.15s ease;
            }
            #workout-feed-share-camera-canvas {
                display: none;
            }
        `;
        document.head.appendChild(style);

        modal = document.createElement('div');
        modal.id = 'workout-feed-share-camera-modal';
        modal.innerHTML = `
            <video id="workout-feed-share-camera-video" autoplay playsinline webkit-playsinline muted></video>
            <canvas id="workout-feed-share-camera-canvas" width="${WORKOUT_FEED_SHARE_RECORDING_WIDTH}" height="${WORKOUT_FEED_SHARE_RECORDING_HEIGHT}" aria-hidden="true"></canvas>
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

    function stopWorkoutFeedShareRecordingStream() {
        if (workoutFeedShareRecordingFrameId !== null) {
            try { window.cancelAnimationFrame(workoutFeedShareRecordingFrameId); } catch (e) {}
            workoutFeedShareRecordingFrameId = null;
        }
        if (workoutFeedShareRecordingStream && workoutFeedShareRecordingStream !== workoutFeedShareCameraStream) {
            const cameraTracks = workoutFeedShareCameraStream && typeof workoutFeedShareCameraStream.getTracks === 'function'
                ? workoutFeedShareCameraStream.getTracks()
                : [];
            try {
                workoutFeedShareRecordingStream.getTracks().forEach(function (track) {
                    if (cameraTracks.indexOf(track) === -1) track.stop();
                });
            } catch (e) {}
        }
        workoutFeedShareRecordingStream = null;
    }

    function stopWorkoutFeedShareCameraStream() {
        stopWorkoutFeedShareRecordingStream();
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

    function drawWorkoutFeedShareCameraFrame(video, canvas, context) {
        context.fillStyle = '#000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
        const drawWidth = Math.round(sourceWidth * scale);
        const drawHeight = Math.round(sourceHeight * scale);
        const drawX = Math.round((canvas.width - drawWidth) / 2);
        const drawY = Math.round((canvas.height - drawHeight) / 2);

        try {
            context.drawImage(video, drawX, drawY, drawWidth, drawHeight);
        } catch (error) {}
    }

    function createWorkoutFeedSharePortraitRecordingStream() {
        stopWorkoutFeedShareRecordingStream();

        const video = document.getElementById('workout-feed-share-camera-video');
        const canvas = document.getElementById('workout-feed-share-camera-canvas');
        if (!video || !canvas || typeof canvas.captureStream !== 'function' || typeof window.requestAnimationFrame !== 'function') {
            return workoutFeedShareCameraStream;
        }

        canvas.width = WORKOUT_FEED_SHARE_RECORDING_WIDTH;
        canvas.height = WORKOUT_FEED_SHARE_RECORDING_HEIGHT;
        const context = canvas.getContext('2d');
        if (!context) return workoutFeedShareCameraStream;

        const renderFrame = function () {
            drawWorkoutFeedShareCameraFrame(video, canvas, context);
            workoutFeedShareRecordingFrameId = window.requestAnimationFrame(renderFrame);
        };
        renderFrame();

        let stream = null;
        try {
            stream = canvas.captureStream(WORKOUT_FEED_SHARE_CAMERA_FRAME_RATE);
        } catch (error) {
            stopWorkoutFeedShareRecordingStream();
            console.warn('[WorkoutFeedShare] portrait recording stream unavailable', error);
            return workoutFeedShareCameraStream;
        }

        if (!stream || typeof stream.addTrack !== 'function') {
            stopWorkoutFeedShareRecordingStream();
            return workoutFeedShareCameraStream;
        }

        const audioTracks = workoutFeedShareCameraStream && typeof workoutFeedShareCameraStream.getAudioTracks === 'function'
            ? workoutFeedShareCameraStream.getAudioTracks()
            : [];
        audioTracks.forEach(function (track) {
            try { stream.addTrack(track); } catch (e) {}
        });

        workoutFeedShareRecordingStream = stream;
        return stream;
    }

    function resetWorkoutFeedShareInAppCameraUi() {
        clearWorkoutFeedShareRecorderTimers();
        updateWorkoutFeedShareCameraRecordingUi(false);
        setWorkoutFeedShareCameraStatus('Camera');
    }

    async function getWorkoutFeedShareCameraStream() {
        const primaryVideoConstraints = {
            facingMode: { ideal: workoutFeedShareCameraFacingMode },
            width: { ideal: WORKOUT_FEED_SHARE_RECORDING_WIDTH },
            height: { ideal: WORKOUT_FEED_SHARE_RECORDING_HEIGHT },
            aspectRatio: { ideal: 9 / 16 },
            frameRate: { ideal: WORKOUT_FEED_SHARE_CAMERA_FRAME_RATE, max: WORKOUT_FEED_SHARE_CAMERA_FRAME_RATE }
        };
        const fallbackVideoConstraints = {
            facingMode: { ideal: workoutFeedShareCameraFacingMode },
            width: { ideal: 720 },
            height: { ideal: 1280 },
            aspectRatio: { ideal: 9 / 16 },
            frameRate: { ideal: WORKOUT_FEED_SHARE_CAMERA_FRAME_RATE, max: WORKOUT_FEED_SHARE_CAMERA_FRAME_RATE }
        };
        const genericVideoConstraints = {
            facingMode: { ideal: workoutFeedShareCameraFacingMode },
            frameRate: { ideal: WORKOUT_FEED_SHARE_CAMERA_FRAME_RATE, max: WORKOUT_FEED_SHARE_CAMERA_FRAME_RATE }
        };

        const attempts = [
            { video: primaryVideoConstraints, audio: true },
            { video: primaryVideoConstraints, audio: false },
            { video: fallbackVideoConstraints, audio: true },
            { video: fallbackVideoConstraints, audio: false },
            { video: genericVideoConstraints, audio: true },
            { video: genericVideoConstraints, audio: false }
        ];
        let firstError = null;
        for (let i = 0; i < attempts.length; i += 1) {
            try {
                return await navigator.mediaDevices.getUserMedia(attempts[i]);
            } catch (error) {
                if (!firstError) firstError = error;
            }
        }
        throw firstError || new Error('Camera stream is unavailable.');
    }

    async function openWorkoutFeedShareInAppCamera(options = {}) {
        hideWorkoutFeedShareUploadBanner(1);
        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function' || typeof window.MediaRecorder === 'undefined') {
            if (options.silentFallback) return false;
            showWorkoutFeedShareUploadBanner('Camera recording is not available on this phone. Use Photos for now.', 'error');
            return false;
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
            return true;
        } catch (error) {
            console.warn('[WorkoutFeedShare] in-app camera failed', error);
            closeWorkoutFeedShareInAppCamera(false);
            if (!options.silentFallback) {
                showWorkoutFeedShareUploadBanner('Could not open camera. Check camera permissions or use Photos.', 'error');
            }
            return false;
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
        restoreWorkoutFeedShareCaptureSurface();
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
        const recordingStream = createWorkoutFeedSharePortraitRecordingStream();
        workoutFeedShareRecorderChunks = [];
        workoutFeedShareRecorderMimeType = getWorkoutFeedShareRecorderMimeType(recordingStream);
        workoutFeedShareRecorderSaveOnStop = true;
        const hasAudioTracks = !!(recordingStream && typeof recordingStream.getAudioTracks === 'function' && recordingStream.getAudioTracks().length);

        try {
            const options = {
                videoBitsPerSecond: WORKOUT_FEED_SHARE_CAMERA_VIDEO_BITS_PER_SECOND
            };
            if (workoutFeedShareRecorderMimeType) options.mimeType = workoutFeedShareRecorderMimeType;
            if (hasAudioTracks) options.audioBitsPerSecond = WORKOUT_FEED_SHARE_CAMERA_AUDIO_BITS_PER_SECOND;
            workoutFeedShareRecorder = new MediaRecorder(recordingStream, options);
        } catch (error) {
            try {
                const fallbackOptions = workoutFeedShareRecorderMimeType ? { mimeType: workoutFeedShareRecorderMimeType } : {};
                workoutFeedShareRecorder = new MediaRecorder(recordingStream, fallbackOptions);
            } catch (fallbackError) {
                console.warn('[WorkoutFeedShare] MediaRecorder unavailable', fallbackError || error);
                stopWorkoutFeedShareRecordingStream();
                closeWorkoutFeedShareInAppCamera(false);
                showWorkoutFeedShareUploadBanner('Camera recording is not available on this phone. Use Photos for now.', 'error');
                return;
            }
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

        try {
            workoutFeedShareRecorder.start(1000);
        } catch (error) {
            console.warn('[WorkoutFeedShare] recorder start failed', error);
            workoutFeedShareRecorder = null;
            stopWorkoutFeedShareRecordingStream();
            closeWorkoutFeedShareInAppCamera(false);
            showWorkoutFeedShareUploadBanner('Camera recording is not available on this phone. Use Photos for now.', 'error');
            return;
        }
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
            stopWorkoutFeedShareRecordingStream();
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
        stopWorkoutFeedShareRecordingStream();

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
        routeWorkoutFeedShareCapturedFile(file);
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
        if (!isWorkoutFeedShareNativePlatform()) return null;
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
        logWorkoutFeedShareDiagnostic('share_set_native_camera_android_start', {
            captureTarget: workoutFeedShareCaptureTarget
        });
        const granted = await ensureNativeWorkoutVideoCameraPermission();
        if (!granted) {
            logWorkoutFeedShareDiagnostic('share_set_native_camera_permission_denied', {
                captureTarget: workoutFeedShareCaptureTarget,
                platform: 'android'
            });
            throw new Error('Camera permission is blocked. Check app permissions.');
        }
        return new Promise(function (resolve) {
            let settled = false;
            window._onNativeWorkoutVideo = function (result) {
                if (settled) return;
                settled = true;
                delete window._onNativeWorkoutVideo;
                logWorkoutFeedShareDiagnostic('share_set_native_camera_android_result', {
                    captureTarget: workoutFeedShareCaptureTarget,
                    cancelled: !!(result && result.cancelled),
                    reason: result && result.reason || ''
                });
                resolve(result || { cancelled: true });
            };
            try {
                window.NativePermissions.takeWorkoutVideo(75);
            } catch (error) {
                if (settled) return;
                settled = true;
                delete window._onNativeWorkoutVideo;
                logWorkoutFeedShareDiagnostic('share_set_native_camera_android_error', {
                    captureTarget: workoutFeedShareCaptureTarget,
                    errorName: error && error.name ? error.name : 'Error',
                    errorMessage: error && error.message ? error.message : String(error || 'camera bridge failed')
                });
                resolve(null);
            }
            setTimeout(function () {
                if (settled) return;
                settled = true;
                delete window._onNativeWorkoutVideo;
                logWorkoutFeedShareDiagnostic('share_set_native_camera_android_timeout', {
                    captureTarget: workoutFeedShareCaptureTarget
                });
                resolve({ cancelled: true });
            }, 180000);
        });
    }

    async function captureIosWorkoutVideo() {
        const plugin = getBalanceVideoCapturePlugin();
        if (!plugin || typeof plugin.captureWorkoutVideo !== 'function') {
            logWorkoutFeedShareDiagnostic('share_set_native_camera_ios_unavailable', {
                hasPlugin: !!plugin,
                hasCaptureMethod: !!(plugin && typeof plugin.captureWorkoutVideo === 'function')
            });
            return null;
        }
        logWorkoutFeedShareDiagnostic('share_set_native_camera_ios_start', {
            captureTarget: workoutFeedShareCaptureTarget
        });
        const result = await plugin.captureWorkoutVideo({
            maxDurationSeconds: 75,
            includeDataBase64: true
        });
        logWorkoutFeedShareDiagnostic('share_set_native_camera_ios_result', {
            captureTarget: workoutFeedShareCaptureTarget,
            cancelled: !!(result && result.cancelled),
            reason: result && result.reason || '',
            hasWebPath: !!(result && result.webPath),
            hasFilePath: !!(result && (result.path || result.filePath)),
            hasInlineData: !!(result && result.dataBase64),
            reportedSizeBytes: Number(result && result.size || 0),
            reportedMimeType: result && result.mimeType || '',
            reportedFileName: result && result.name || ''
        });
        return result;
    }

    async function openWorkoutFeedShareCameraFallback() {
        if (isIosNativeWorkoutFeedShare()) {
            logWorkoutFeedShareDiagnostic('video_ios_system_camera_picker', {
                fallbackReason: 'native_camera_plugin_failed'
            });
            openWorkoutFeedShareCameraPicker();
            return;
        }
        if (isWorkoutFeedShareNativePlatform()) {
            const opened = await openWorkoutFeedShareInAppCamera({ silentFallback: true });
            if (!opened) {
                showWorkoutFeedShareUploadBanner('Could not open the camera. Check app permissions or use Photos.', 'error');
                restoreWorkoutFeedShareCaptureSurface();
            }
            return;
        }
        openWorkoutFeedShareCameraPicker();
    }

    function showWorkoutFeedShareNativeCameraUnavailable() {
        showWorkoutFeedShareUploadBanner('Camera needs the latest app update. Use Photos for an existing video for now.', 'error');
    }

    async function readWorkoutFeedShareNativeVideoBlob(source) {
        let fetchError = null;
        try {
            const response = await fetch(source);
            logWorkoutFeedShareDiagnostic('video_native_file_read_response', {
                httpStatus: response.status,
                responseOk: response.ok,
                responseType: response.type || '',
                responseContentType: response.headers && response.headers.get ? (response.headers.get('content-type') || '') : '',
                responseContentLength: response.headers && response.headers.get ? Number(response.headers.get('content-length') || 0) : 0
            });
            if (!response.ok) throw new Error('Could not load the recorded clip.');

            const blob = await response.blob();
            if (!blob || !blob.size) throw new Error('The recorded clip was empty.');
            return blob;
        } catch (error) {
            fetchError = error;
            logWorkoutFeedShareDiagnostic('video_native_file_read_fetch_failed', {
                errorName: error && error.name ? error.name : 'Error',
                errorMessage: error && error.message ? error.message : String(error || 'native file fetch failed')
            });
        }

        logWorkoutFeedShareDiagnostic('video_native_file_read_xhr_start', {});
        try {
            const blob = await new Promise(function (resolve, reject) {
                const request = new XMLHttpRequest();
                request.open('GET', source, true);
                request.responseType = 'blob';
                request.onload = function () {
                    const responseBlob = request.response;
                    const acceptedStatus = (request.status >= 200 && request.status < 300) || request.status === 0;
                    if (acceptedStatus && responseBlob && responseBlob.size) {
                        resolve(responseBlob);
                        return;
                    }
                    reject(new Error('Could not load the recorded clip (status ' + request.status + ').'));
                };
                request.onerror = function () {
                    reject(new Error('Could not read the recorded clip from the phone.'));
                };
                request.onabort = function () {
                    reject(new Error('Reading the recorded clip was cancelled.'));
                };
                request.send();
            });
            logWorkoutFeedShareDiagnostic('video_native_file_read_xhr_success', {
                blobSizeBytes: Number(blob && blob.size || 0),
                blobType: blob && blob.type || ''
            });
            return blob;
        } catch (error) {
            logWorkoutFeedShareDiagnostic('video_native_file_read_xhr_error', {
                errorName: error && error.name ? error.name : 'Error',
                errorMessage: error && error.message ? error.message : String(error || 'native file XHR failed'),
                fetchErrorName: fetchError && fetchError.name ? fetchError.name : 'Error',
                fetchErrorMessage: fetchError && fetchError.message ? fetchError.message : String(fetchError || 'native file fetch failed')
            });
            logWorkoutFeedShareDiagnostic('video_native_file_read_network_error', {
                errorName: error && error.name ? error.name : 'Error',
                errorMessage: error && error.message ? error.message : String(error || 'native file read failed')
            });
            throw error;
        }
    }

    function nativeWorkoutVideoBase64ToBlob(dataBase64, mimeType) {
        const raw = String(dataBase64 || '').replace(/^data:[^;]+;base64,/i, '');
        if (!raw) throw new Error('The camera returned empty video data.');

        const chunkSize = 1024 * 1024;
        const byteParts = [];
        for (let offset = 0; offset < raw.length; offset += chunkSize) {
            const decoded = atob(raw.slice(offset, offset + chunkSize));
            const bytes = new Uint8Array(decoded.length);
            for (let index = 0; index < decoded.length; index += 1) {
                bytes[index] = decoded.charCodeAt(index);
            }
            byteParts.push(bytes);
        }
        const blob = new Blob(byteParts, { type: mimeType || 'video/quicktime' });
        if (!blob.size) throw new Error('The camera returned empty video data.');
        return blob;
    }

    async function nativeWorkoutVideoResultToFile(result) {
        if (!result || result.cancelled) return null;

        let source = result.webPath || result.url || '';
        const rawPath = result.path || result.filePath || '';
        if (!source && rawPath && window.Capacitor && typeof window.Capacitor.convertFileSrc === 'function') {
            source = window.Capacitor.convertFileSrc(rawPath);
        }
        if (!source && !result.dataBase64) {
            throw new Error('The camera returned a clip the app could not read.');
        }

        logWorkoutFeedShareDiagnostic('video_native_file_read_start', {
            sourceKind: result.webPath ? 'web_path' : result.url ? 'url' : 'converted_file_path',
            reportedSizeBytes: Number(result.size || 0),
            reportedMimeType: result.mimeType || '',
            reportedFileName: result.name || ''
        });
        const hasInlineNativeVideoData = !!result.dataBase64;
        let blob;
        if (hasInlineNativeVideoData) {
            logWorkoutFeedShareDiagnostic('video_native_file_inline_data_start', {
                encodedLength: String(result.dataBase64).length
            });
            blob = nativeWorkoutVideoBase64ToBlob(result.dataBase64, result.mimeType);
            logWorkoutFeedShareDiagnostic('video_native_file_inline_data_ready', {
                blobSizeBytes: Number(blob && blob.size || 0),
                blobType: blob && blob.type || ''
            });
        } else {
            blob = await readWorkoutFeedShareNativeVideoBlob(source);
        }
        logWorkoutFeedShareDiagnostic('video_native_file_blob_ready', {
            blobSizeBytes: Number(blob && blob.size || 0),
            blobType: blob && blob.type || ''
        });
        if (!blob || !blob.size) throw new Error('The recorded clip was empty.');

        const fallbackName = result.name || ('share-set-' + Date.now() + '.mp4');
        const mimeType = result.mimeType || blob.type || getWorkoutFeedShareVideoMimeType({ name: fallbackName }) || 'video/mp4';
        const file = new File([blob], fallbackName, {
            type: mimeType,
            lastModified: Date.now()
        });
        // WebKit can hang while re-reading the header of a File reconstructed
        // from a native plugin payload. The native bridge copied the movie from
        // UIImagePickerController and supplied its video MIME type, while the
        // upload endpoint still independently validates the bytes.
        if (!hasInlineNativeVideoData) {
            await assertWorkoutFeedShareVideoFile(file);
        } else {
            if (workoutFeedShareNativeValidatedFiles) workoutFeedShareNativeValidatedFiles.add(file);
            logWorkoutFeedShareDiagnostic('video_native_file_validation_bypassed', {
                blobSizeBytes: Number(blob && blob.size || 0),
                blobType: blob && blob.type || ''
            });
        }
        return file;
    }

    async function openNativeWorkoutFeedShareCamera() {
        const bannerLabel = workoutFeedShareCaptureTarget === 'share-set'
            ? showWorkoutFeedShareUploadBanner('Opening camera...', 'info')
            : null;
        try {
            let result = await captureAndroidWorkoutVideo();
            if (!result) result = await captureIosWorkoutVideo();

            if (!result) {
                hideWorkoutFeedShareUploadBanner(1);
                await openWorkoutFeedShareCameraFallback();
                return;
            }
            if (result.cancelled) {
                hideWorkoutFeedShareUploadBanner(result.reason ? 1 : 300);
                if (result.reason) await openWorkoutFeedShareCameraFallback();
                else restoreWorkoutFeedShareCaptureSurface();
                return;
            }

            if (bannerLabel) bannerLabel.textContent = getWorkoutFeedShareCapturePreparingLabel();
            const file = await nativeWorkoutVideoResultToFile(result);
            if (!file) {
                hideWorkoutFeedShareUploadBanner(300);
                restoreWorkoutFeedShareCaptureSurface();
                return;
            }
            logWorkoutFeedShareDiagnostic('share_set_native_file_ready', {
                captureTarget: workoutFeedShareCaptureTarget,
                ...getWorkoutFeedShareFileDiagnostic(file)
            });
            routeWorkoutFeedShareCapturedFile(file);
        } catch (error) {
            console.error('[WorkoutFeedShare] native camera failed', error);
            logWorkoutFeedShareDiagnostic('share_set_native_camera_failed', {
                captureTarget: workoutFeedShareCaptureTarget,
                errorName: error && error.name ? error.name : 'Error',
                errorMessage: error && error.message ? error.message : String(error || 'native camera failed')
            });
            hideWorkoutFeedShareUploadBanner(1);
            await openWorkoutFeedShareCameraFallback();
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

    function openWorkoutFeedShareFilePicker(options = {}) {
        clearWorkoutFeedSharePendingInput();

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = options.capture ? 'video/*;capture=camcorder' : 'video/*';
        if (options.capture) {
            input.capture = 'camcorder';
            input.setAttribute('accept', 'video/*;capture=camcorder');
            input.setAttribute('capture', 'camcorder');
        }
        input.setAttribute('aria-hidden', 'true');
        input.style.display = 'none';

        workoutFeedSharePendingInput = input;

        input.addEventListener('change', function (event) {
            logWorkoutFeedShareDiagnostic('video_file_picker_change', {
                capture: options.capture === true,
                hasFile: !!(event && event.target && event.target.files && event.target.files[0])
            });
            void handleWorkoutFeedShareFileSelect(event).finally(function () {
                setTimeout(clearWorkoutFeedSharePendingInput, 0);
            });
        }, { once: true });

        input.addEventListener('cancel', function () {
            logWorkoutFeedShareDiagnostic('video_file_picker_cancelled', {
                capture: options.capture === true
            });
            clearWorkoutFeedSharePendingInput();
            restoreWorkoutFeedShareCaptureSurface();
        }, { once: true });

        document.body.appendChild(input);
        try {
            input.click();
        } catch (error) {
            console.warn('[WorkoutFeedShare] camera picker failed', error);
            logWorkoutFeedShareDiagnostic('share_set_file_picker_failed', {
                captureTarget: workoutFeedShareCaptureTarget,
                capture: options.capture === true,
                errorName: error && error.name ? error.name : 'Error',
                errorMessage: error && error.message ? error.message : String(error || 'picker failed')
            });
            clearWorkoutFeedSharePendingInput();
            showWorkoutFeedShareUploadBanner('Could not open the camera. Tap Share a Set again.', 'error');
            restoreWorkoutFeedShareCaptureSurface();
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

    function isIosNativeWorkoutFeedShare() {
        try {
            const userAgent = navigator.userAgent || '';
            return isWorkoutFeedShareNativePlatform()
                && /(iPhone|iPad|iPod)/i.test(userAgent)
                && /FitGotchi-Native/i.test(userAgent);
        } catch (_) {
            return false;
        }
    }

    async function materializeWorkoutFeedShareFile(file, stage) {
        const fileSize = Number(file && file.size || 0);
        const isIosNative = isIosNativeWorkoutFeedShare();
        if (!isIosNative
            || !file
            || typeof file.arrayBuffer !== 'function'
            || !Number.isFinite(fileSize)
            || fileSize <= 0
            || fileSize > WORKOUT_FEED_SHARE_IOS_STABLE_FILE_MAX_BYTES) {
            logWorkoutFeedShareDiagnostic('video_file_materialize_skipped', {
                stage: stage || 'capture',
                isIosNative,
                hasFile: !!file,
                hasArrayBuffer: !!(file && typeof file.arrayBuffer === 'function'),
                maximumCopyBytes: WORKOUT_FEED_SHARE_IOS_STABLE_FILE_MAX_BYTES,
                reason: !isIosNative
                    ? 'not_ios_native'
                    : !file
                        ? 'missing_file'
                        : fileSize > WORKOUT_FEED_SHARE_IOS_STABLE_FILE_MAX_BYTES
                            ? 'file_too_large_to_copy'
                            : 'file_not_readable',
                ...getWorkoutFeedShareFileDiagnostic(file)
            });
            return file;
        }

        try {
            const bytes = await file.arrayBuffer();
            if (bytes.byteLength !== fileSize) {
                throw new Error('The selected video could not be copied safely.');
            }
            const fileName = file.name || 'share-set-video.mp4';
            const fileType = getWorkoutFeedShareVideoMimeType(file) || file.type || 'video/mp4';
            const stableFile = typeof File !== 'undefined'
                ? new File([bytes], fileName, {
                    type: fileType,
                    lastModified: file.lastModified || Date.now()
                })
                : new Blob([bytes], { type: fileType });
            logWorkoutFeedShareDiagnostic('share_set_file_materialized', {
                stage: stage || 'capture',
                materializedBytes: bytes.byteLength,
                ...getWorkoutFeedShareFileDiagnostic(stableFile)
            });
            return stableFile;
        } catch (error) {
            logWorkoutFeedShareDiagnostic('share_set_file_materialize_failed', {
                stage: stage || 'capture',
                errorName: error && error.name ? error.name : 'Error',
                errorMessage: error && error.message ? error.message : String(error || 'file copy failed'),
                ...getWorkoutFeedShareFileDiagnostic(file)
            });
            return file;
        }
    }

    async function processWorkoutFeedShareSelectedFile(rawFile) {
        logWorkoutFeedShareDiagnostic('share_set_file_received', {
            captureTarget: workoutFeedShareCaptureTarget,
            ...getWorkoutFeedShareFileDiagnostic(rawFile)
        });
        const file = normalizeWorkoutFeedShareVideoFile(rawFile);
        if (!file) {
            logWorkoutFeedShareDiagnostic('share_set_file_rejected', {
                captureTarget: workoutFeedShareCaptureTarget,
                reason: 'missing_video_mime_type',
                ...getWorkoutFeedShareFileDiagnostic(rawFile)
            });
            showWorkoutFeedShareUploadBanner('Please choose a video clip.', 'error');
            return;
        }
        try {
            const nativeValidated = !!(workoutFeedShareNativeValidatedFiles && workoutFeedShareNativeValidatedFiles.has(file));
            if (!nativeValidated) await assertWorkoutFeedShareVideoFile(file);
            else logWorkoutFeedShareDiagnostic('share_set_native_file_validation_reused', {
                captureTarget: workoutFeedShareCaptureTarget,
                ...getWorkoutFeedShareFileDiagnostic(file)
            });
        } catch (error) {
            logWorkoutFeedShareDiagnostic('share_set_file_rejected', {
                captureTarget: workoutFeedShareCaptureTarget,
                reason: error && error.message ? error.message : WORKOUT_FEED_SHARE_INVALID_VIDEO_MESSAGE,
                ...getWorkoutFeedShareFileDiagnostic(file)
            });
            showWorkoutFeedShareUploadBanner(error.message || WORKOUT_FEED_SHARE_INVALID_VIDEO_MESSAGE, 'error');
            return;
        }
        clearWorkoutFeedShareVideo();
        workoutFeedShareState.file = file;
        workoutFeedShareState.objectUrl = URL.createObjectURL(file);
        hideWorkoutFeedShareChooserForUpload();
        const bannerLabel = showWorkoutFeedShareUploadBanner('Uploading your set...', 'info');
        logWorkoutFeedShareDiagnostic('share_set_file_ready_for_upload', {
            captureTarget: workoutFeedShareCaptureTarget,
            ...getWorkoutFeedShareFileDiagnostic(file)
        });
        void submitWorkoutFeedShare({
            postBtn: bannerLabel
        });
    }

    async function handleWorkoutFeedShareFileSelect(event) {
        const input = event && event.target;
        const rawFile = input && input.files ? input.files[0] : null;
        if (!rawFile) {
            if (input) input.value = '';
            restoreWorkoutFeedShareCaptureSurface();
            return;
        }
        // Keep the hidden iOS picker mounted until its gallery-backed File is
        // copied. Removing it first is what leaves later multipart reads with
        // a WebKit NotFoundError.
        const stableFile = await materializeWorkoutFeedShareFile(rawFile, 'gallery_picker');
        if (input) input.value = '';
        routeWorkoutFeedShareCapturedFile(stableFile);
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
        let postPromise = null;
        let initialQueueItem = null;
        let uploadTimeoutMs = getWorkoutFeedShareUploadTimeoutMs(workoutFeedShareState.file);

        try {
            if (submitBtn && typeof submitBtn === 'object' && 'disabled' in submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Posting...';
                submitBtn.style.opacity = '0.7';
            }

            workoutFeedShareState.file = await prepareWorkoutFeedShareClip(workoutFeedShareState.file, submitBtn);
            uploadTimeoutMs = getWorkoutFeedShareUploadTimeoutMs(workoutFeedShareState.file);
            logWorkoutFeedShareDiagnostic('share_set_submit_start', {
                workoutName,
                uploadTimeoutMs,
                ...getWorkoutFeedShareFileDiagnostic(workoutFeedShareState.file)
            });

            if (navigator && navigator.onLine === false) {
                await queueWorkoutFeedShareUpload({
                    userId: userId,
                    file: workoutFeedShareState.file,
                    caption: caption,
                    workoutName: workoutName,
                    lastError: 'offline',
                    autoRetry: true
                });
                showWorkoutFeedShareUploadBanner('Saved for retry', 'queued', { retry: true });
                clearWorkoutFeedShareVideo();
                return;
            }

            // iOS can hand us a fresh camera/picker File that fails when uploaded
            // immediately from the workout screen. Persist and read it back first,
            // matching the Feed retry path that is already reliable.
            try {
                initialQueueItem = await queueWorkoutFeedShareUpload({
                    userId: userId,
                    file: workoutFeedShareState.file,
                    caption: caption,
                    workoutName: workoutName,
                    lastError: 'posting',
                    autoRetry: false
                });
            } catch (queueError) {
                console.warn('[WorkoutFeedShare] first-post queue staging failed', queueError);
                logWorkoutFeedShareDiagnostic('share_set_queue_stage_failed', {
                    workoutName,
                    errorName: queueError && queueError.name ? queueError.name : 'Error',
                    errorMessage: queueError && queueError.message ? queueError.message : String(queueError || 'queue staging failed'),
                    ...getWorkoutFeedShareFileDiagnostic(workoutFeedShareState.file)
                });
                initialQueueItem = null;
            }

            const uploadFile = initialQueueItem
                ? (getQueuedWorkoutFeedShareFile(initialQueueItem) || workoutFeedShareState.file)
                : workoutFeedShareState.file;
            uploadTimeoutMs = getWorkoutFeedShareUploadTimeoutMs(uploadFile);
            logWorkoutFeedShareDiagnostic('share_set_post_attempt', {
                queueId: initialQueueItem && initialQueueItem.id || '',
                workoutName,
                uploadTimeoutMs,
                ...getWorkoutFeedShareFileDiagnostic(uploadFile)
            });
            const uploadController = typeof AbortController !== 'undefined' ? new AbortController() : null;
            postPromise = window.createWorkoutFeedSharePost({
                file: uploadFile,
                caption: caption,
                workoutName: workoutName,
                source: 'feed_workout_share',
                postBtn: submitBtn,
                pointsType: 'workout_feed_share',
                skipVideoPreparation: true,
                uploadTimeoutMs,
                photoTimestamp: initialQueueItem ? initialQueueItem.createdAt : undefined,
                abortSignal: uploadController ? uploadController.signal : null
            });
            const result = await waitForWorkoutFeedSharePost(postPromise, uploadTimeoutMs, uploadController);
            if (initialQueueItem && initialQueueItem.id) {
                await clearPostedWorkoutFeedShareQueueItems(initialQueueItem);
            }

            const successMessage = getWorkoutFeedShareSuccessMessage(result);
            showWorkoutFeedShareUploadBanner(successMessage, 'success');

            if (typeof showToast === 'function') showToast(successMessage, 'success');
            logWorkoutFeedShareDiagnostic('share_set_submit_success', {
                storyId: result && result.story && result.story.id || '',
                queueId: initialQueueItem && initialQueueItem.id || '',
                pointsAwarded: Number(result && result.pointsAwarded || 0),
                uploadTimeoutMs
            });
            refreshWorkoutFeedShareAfterPost();
            hideWorkoutFeedShareUploadBanner(1800);
            setTimeout(clearWorkoutFeedShareVideo, 1800);
        } catch (error) {
            console.error('[WorkoutFeedShare] submit failed', error);
            if (isRetryableWorkoutFeedShareError(error) && workoutFeedShareState.file) {
                try {
                    const retryDelayMs = error && error.workoutFeedShareTimeout ? WORKOUT_FEED_SHARE_LATE_RETRY_DELAY_MS : 30000;
                    let queueItem = initialQueueItem;
                    if (queueItem && queueItem.id) {
                        queueItem = {
                            ...queueItem,
                            attempts: Number(queueItem.attempts || 0) + 1,
                            lastAttemptAt: new Date().toISOString(),
                            nextAttemptAt: new Date(Date.now() + retryDelayMs).toISOString(),
                            lastError: error && error.message ? error.message : 'upload failed'
                        };
                        await putWorkoutFeedShareQueueItem(queueItem);
                        logWorkoutFeedShareDiagnostic('share_set_saved_for_retry', {
                            queueId: queueItem.id,
                            reason: queueItem.lastError,
                            attempts: queueItem.attempts,
                            nextAttemptAt: queueItem.nextAttemptAt,
                            workoutName: queueItem.workoutName,
                            ...getWorkoutFeedShareFileDiagnostic(getQueuedWorkoutFeedShareFile(queueItem) || workoutFeedShareState.file)
                        });
                        refreshWorkoutFeedShareRetryNotice().catch(function () {});
                    } else {
                        queueItem = await queueWorkoutFeedShareUpload({
                            userId: userId,
                            file: workoutFeedShareState.file,
                            caption: caption,
                            workoutName: workoutName,
                            lastError: error && error.message ? error.message : 'upload failed',
                            retryDelayMs: retryDelayMs,
                            autoRetry: true
                        });
                    }
                    if (error && error.workoutFeedShareTimeout && postPromise) {
                        forgetQueuedWorkoutFeedShareOnLateSuccess(postPromise, queueItem);
                    }
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

    async function retryWorkoutFeedShareQueue(manual, targetId) {
        if (workoutFeedShareRetryInProgress) {
            if (manual) showWorkoutFeedShareUploadBanner('Retry already running...', 'info');
            return;
        }

        const userId = window.currentUser && window.currentUser.id;
        if (!userId) {
            if (manual) showWorkoutFeedShareUploadBanner('Log in before retrying Share a Set.', 'error');
            return;
        }

        if (navigator && navigator.onLine === false) {
            if (manual) showWorkoutFeedShareUploadBanner('Waiting for reception', 'queued', { retry: true });
            return;
        }

        if (!manual && isWorkoutFeedShareActiveWorkoutOpen()) {
            return;
        }

        workoutFeedShareRetryInProgress = true;
        refreshWorkoutFeedShareRetryNotice().catch(function () {});
        try {
            const requestedQueueId = targetId ? String(targetId) : '';
            const queuedItems = (await getWorkoutFeedShareQueueItems()).filter(function (item) {
                return item && item.userId === userId && !isWorkoutFeedSharePostingStagingItem(item);
            });
            const now = Date.now();
            let items = manual ? queuedItems.slice() : queuedItems.filter(function (item) {
                const nextAttempt = Date.parse(item.nextAttemptAt || item.createdAt || '');
                return !Number.isFinite(nextAttempt) || nextAttempt <= now;
            });
            if (requestedQueueId) {
                items = items.filter(function (item) {
                    return String(item && item.id || '') === requestedQueueId;
                });
            } else if (manual) {
                items = items.sort(compareWorkoutFeedShareQueueNewestFirst).slice(0, 1);
            }

            if (!items.length) {
                if (manual) {
                    if (queuedItems.length) {
                        showWorkoutFeedShareUploadBanner('Upload is saved', 'queued', { retry: true });
                    } else {
                        showWorkoutFeedShareUploadBanner('No Share a Set uploads waiting.', 'success');
                        hideWorkoutFeedShareUploadBanner(1400);
                    }
                } else if (queuedItems.length) {
                    refreshWorkoutFeedShareRetryNotice().catch(function () {});
                }
                return;
            }

            for (let item of items) {
                let queuedFile = getQueuedWorkoutFeedShareFile(item);
                if (!queuedFile) {
                    logWorkoutFeedShareDiagnostic('share_set_retry_dropped', {
                        queueId: item.id,
                        reason: 'missing_queued_file',
                        attempts: Number(item.attempts || 0),
                        nextAttemptAt: item.nextAttemptAt || ''
                    });
                    await deleteWorkoutFeedShareQueueItem(item.id);
                    continue;
                }

                const stableQueuedFile = await materializeWorkoutFeedShareFile(queuedFile, 'retry_queue');
                if (stableQueuedFile !== queuedFile) {
                    queuedFile = stableQueuedFile;
                    item = {
                        ...item,
                        file: stableQueuedFile,
                        fileName: stableQueuedFile.name || item.fileName,
                        fileType: stableQueuedFile.type || item.fileType,
                        fileSize: stableQueuedFile.size || item.fileSize,
                        fileLastModified: stableQueuedFile.lastModified || item.fileLastModified
                    };
                    await putWorkoutFeedShareQueueItem(item);
                }

                const bannerLabel = showWorkoutFeedShareUploadBanner('Retrying Share a Set...', 'info');
                let postPromise = null;
                try {
                    const preparedQueuedFile = await prepareWorkoutFeedShareClip(queuedFile, bannerLabel);
                    const retryUploadTimeoutMs = getWorkoutFeedShareUploadTimeoutMs(preparedQueuedFile);
                    logWorkoutFeedShareDiagnostic('share_set_retry_attempt', {
                        queueId: item.id,
                        targetedRetry: !!requestedQueueId,
                        attempts: Number(item.attempts || 0),
                        manualRetry: manual === true,
                        uploadTimeoutMs: retryUploadTimeoutMs,
                        ...getWorkoutFeedShareFileDiagnostic(preparedQueuedFile)
                    });
                    const uploadController = typeof AbortController !== 'undefined' ? new AbortController() : null;
                    postPromise = window.createWorkoutFeedSharePost({
                        file: preparedQueuedFile,
                        caption: item.caption || '',
                        workoutName: item.workoutName || '',
                        source: 'feed_workout_share',
                        postBtn: bannerLabel,
                        pointsType: 'workout_feed_share',
                        skipVideoPreparation: true,
                        uploadTimeoutMs: retryUploadTimeoutMs,
                        photoTimestamp: item.createdAt || new Date().toISOString(),
                        abortSignal: uploadController ? uploadController.signal : null
                    });
                    const result = await waitForWorkoutFeedSharePost(postPromise, retryUploadTimeoutMs, uploadController);

                    await deleteWorkoutFeedShareQueueItem(item.id);
                    const successMessage = getWorkoutFeedShareSuccessMessage(result);
                    showWorkoutFeedShareUploadBanner(successMessage, 'success');
                    if (typeof showToast === 'function') showToast(successMessage, 'success');
                    refreshWorkoutFeedShareAfterPost();
                    hideWorkoutFeedShareUploadBanner(1800);
                } catch (error) {
                    console.warn('[WorkoutFeedShare] queued retry failed', error);
                    if (!isRetryableWorkoutFeedShareError(error)) {
                        logWorkoutFeedShareDiagnostic('share_set_retry_dropped', {
                            queueId: item.id,
                            reason: error && error.message ? error.message : 'not_retryable',
                            attempts: Number(item.attempts || 0),
                            ...getWorkoutFeedShareFileDiagnostic(queuedFile)
                        });
                        await deleteWorkoutFeedShareQueueItem(item.id);
                        showWorkoutFeedShareUploadBanner(error.message || WORKOUT_FEED_SHARE_INVALID_VIDEO_MESSAGE, 'error');
                        break;
                    }
                    const nextRetryDelayMs = Math.min(5 * 60 * 1000, 30000 * Math.max(1, Number(item.attempts || 1)));
                    const retryItem = {
                        ...item,
                        attempts: Number(item.attempts || 0) + 1,
                        lastAttemptAt: new Date().toISOString(),
                        nextAttemptAt: new Date(Date.now() + nextRetryDelayMs).toISOString(),
                        lastError: error && error.message ? error.message : 'retry failed'
                    };
                    await putWorkoutFeedShareQueueItem(retryItem);
                    logWorkoutFeedShareDiagnostic('share_set_retry_failed', {
                        queueId: retryItem.id,
                        reason: retryItem.lastError,
                        targetedRetry: !!requestedQueueId,
                        attempts: retryItem.attempts,
                        nextAttemptAt: retryItem.nextAttemptAt,
                        manualRetry: manual === true,
                        ...getWorkoutFeedShareFileDiagnostic(queuedFile)
                    });
                    if (error && error.workoutFeedShareTimeout && postPromise) {
                        forgetQueuedWorkoutFeedShareOnLateSuccess(postPromise, item);
                    }
                    showWorkoutFeedShareUploadBanner('Saved for retry', 'queued', { retry: true });
                    break;
                }
            }
        } catch (error) {
            console.warn('[WorkoutFeedShare] retry queue unavailable', error);
            if (manual) showWorkoutFeedShareUploadBanner('Could not retry just now.', 'error');
        } finally {
            workoutFeedShareRetryInProgress = false;
            refreshWorkoutFeedShareRetryNotice().catch(function () {});
        }
    }

    function postWorkoutFeedShareQueueNow(targetId) {
        return retryWorkoutFeedShareQueue(true, targetId);
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
    window.openWorkoutFeedShareCameraForFile = openWorkoutFeedShareCameraForFile;
    window.openWorkoutFeedShareGalleryForFile = openWorkoutFeedShareGalleryForFile;
    window.openWorkoutFeedShareGallery = openWorkoutFeedShareGallery;
    window.prepareBalanceVideoUploadFile = function (file, stage, target) {
        if (target) workoutFeedShareCaptureTarget = target;
        return materializeWorkoutFeedShareFile(file, stage);
    };
    window.handleWorkoutFeedShareFileSelect = handleWorkoutFeedShareFileSelect;
    window.clearWorkoutFeedShareVideo = clearWorkoutFeedShareVideo;
    window.submitWorkoutFeedShare = submitWorkoutFeedShare;
    window.closeWorkoutFeedShareInAppCamera = closeWorkoutFeedShareInAppCamera;
    window.toggleWorkoutFeedShareInAppRecording = toggleWorkoutFeedShareInAppRecording;
    window.flipWorkoutFeedShareInAppCamera = flipWorkoutFeedShareInAppCamera;
    window.retryWorkoutFeedShareQueue = retryWorkoutFeedShareQueue;
    window.postWorkoutFeedShareQueueNow = postWorkoutFeedShareQueueNow;
    window.discardWorkoutFeedShareQueue = discardWorkoutFeedShareQueue;
    window.hideWorkoutFeedShareUploadBanner = hideWorkoutFeedShareUploadBanner;
    window.refreshWorkoutFeedShareRetryNotice = refreshWorkoutFeedShareRetryNotice;

    document.addEventListener('DOMContentLoaded', ensureFormCheckView);
    document.addEventListener('DOMContentLoaded', function () {
        ensureWorkoutFeedShareView();
        refreshWorkoutFeedShareRetryNotice().catch(function () {});
    });
    window.addEventListener('online', function () {
        refreshWorkoutFeedShareRetryNotice().catch(function () {});
    });
    window.addEventListener('offline', function () {
        refreshWorkoutFeedShareRetryNotice().catch(function () {});
    });
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            refreshWorkoutFeedShareRetryNotice().catch(function () {});
        }
    });
})();
