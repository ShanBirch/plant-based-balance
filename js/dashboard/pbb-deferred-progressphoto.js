// ===== WEEKLY PROGRESS PHOTO CARD LOGIC =====

    const PROGRESS_PHOTO_XP = 20;

    const PROGRESS_PHOTO_POSES = [
        { key: 'front', emoji: '🧍', title: 'Face the camera', hint: 'Stand tall, arms relaxed at your sides', silhouette: 'M50,12 a8,8 0 1,0 0.01,0 M42,22 L58,22 L62,55 L58,55 L58,110 L54,110 L54,160 L50,160 L46,160 L46,110 L42,110 L42,55 L38,55 Z' },
        { key: 'left',  emoji: '👤', title: 'Turn to your side', hint: 'Left side to the camera · arms at your sides', silhouette: 'M50,12 a8,8 0 1,0 0.01,0 M46,22 L54,22 L57,55 L54,55 L54,110 L52,110 L52,160 L48,160 L48,110 L46,110 L46,55 L43,55 Z' },
        { key: 'back',  emoji: '🔄', title: 'Turn around', hint: 'Back to the camera · arms at your sides', silhouette: 'M50,12 a8,8 0 1,0 0.01,0 M42,22 L58,22 L62,55 L58,55 L58,110 L54,110 L54,160 L50,160 L46,160 L46,110 L42,110 L42,55 L38,55 Z' }
    ];

    /**
     * Check if it's Monday and user hasn't uploaded a progress photo this week.
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
            const today = new Date();
            if (today.getDay() !== 1) {
                card.style.display = 'none';
                doneCard.style.display = 'none';
                if (uploadingCard) uploadingCard.style.display = 'none';
                return;
            }

            const thisWeeksPhoto = await db.progressPhotos.getThisWeeksPhoto(window.currentUser.id);

            if (thisWeeksPhoto) {
                card.style.display = 'none';
                if (uploadingCard) uploadingCard.style.display = 'none';
                const todayStr = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
                const isDismissedLocal = localStorage.getItem('progressPhotoDoneCardDismissedDate') === todayStr;
                const isDismissedCloud = (window._pbbDismissedDates && window._pbbDismissedDates['progressPhotoDoneCard']) === todayStr;

                if (isDismissedLocal || isDismissedCloud) {
                    doneCard.style.display = 'none';
                    if (isDismissedCloud && !isDismissedLocal) {
                        try { localStorage.setItem('progressPhotoDoneCardDismissedDate', todayStr); } catch(e) {}
                    }
                } else {
                    doneCard.style.display = 'flex';
                }
            } else {
                card.style.display = 'block';
                doneCard.style.display = 'none';
                if (uploadingCard) uploadingCard.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking progress photo status:', error);
        }
    }

    // ---- Guided Multi-Angle Photo Session ----

    let ppsStream = null;
    let ppsFacingMode = 'user';
    let ppsCurrentPose = 0;
    let ppsCapturedFiles = [null, null, null];
    let ppsCountdownTimer = null;
    let ppsOnComplete = null;

    async function openProgressPhotoSession(onComplete) {
        ppsOnComplete = onComplete || null;
        ppsCurrentPose = 0;
        ppsCapturedFiles = [null, null, null];
        ppsFacingMode = 'user';

        const modal = document.getElementById('progress-photo-session-modal');
        if (!modal) { console.error('progress-photo-session-modal not found'); return; }

        // Request Android camera permission via native bridge if available
        if (window.NativePermissions) {
            try {
                if (window.NativePermissions.isPermissionPermanentlyDenied &&
                    window.NativePermissions.isPermissionPermanentlyDenied()) {
                    if (typeof showCameraPermissionSettingsDialog === 'function') showCameraPermissionSettingsDialog();
                    return;
                }
                if (typeof window.NativePermissions.hasCameraPermission === 'function'
                    && !window.NativePermissions.hasCameraPermission()) {
                    const granted = await new Promise((resolve) => {
                        window._onNativeCameraPermission = function(result) {
                            delete window._onNativeCameraPermission;
                            resolve(result);
                        };
                        window.NativePermissions.requestCameraPermission();
                        setTimeout(() => {
                            if (window._onNativeCameraPermission) {
                                delete window._onNativeCameraPermission;
                                resolve(false);
                            }
                        }, 60000);
                    });
                    if (!granted) {
                        if (typeof showCameraPermissionSettingsDialog === 'function') showCameraPermissionSettingsDialog();
                        return;
                    }
                }
            } catch (e) { console.warn('NativePermissions bridge error:', e); }
        }

        if (window.NativePermissions && window.NativePermissions.enterImmersiveMode) {
            try { window.NativePermissions.enterImmersiveMode(); } catch(e) {}
        }

        modal.style.display = 'flex';
        resetPoseUI();
        renderPoseThumbs();
        updatePoseIndicator();

        try {
            ppsStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: ppsFacingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false
            });
            const video = document.getElementById('pps-video');
            video.srcObject = ppsStream;
            await video.play();
        } catch (err) {
            console.error('Progress photo camera failed:', err);
            if (err && err.name === 'NotAllowedError' && typeof showCameraPermissionSettingsDialog === 'function') {
                showCameraPermissionSettingsDialog();
            } else if (typeof showToast === 'function') {
                showToast('Could not access camera. Check permissions.', 'error');
            }
            closeProgressPhotoSession();
        }
    }

    function stopProgressPhotoStream() {
        if (ppsStream) {
            ppsStream.getTracks().forEach(t => t.stop());
            ppsStream = null;
        }
        const video = document.getElementById('pps-video');
        if (video) video.srcObject = null;
    }

    function closeProgressPhotoSession() {
        clearCountdown();
        stopProgressPhotoStream();
        const modal = document.getElementById('progress-photo-session-modal');
        if (modal) modal.style.display = 'none';
        const uploading = document.getElementById('pps-uploading');
        if (uploading) uploading.style.display = 'none';
        if (window.NativePermissions && window.NativePermissions.exitImmersiveMode) {
            try { window.NativePermissions.exitImmersiveMode(); } catch(e) {}
        }
    }

    async function flipProgressPhotoCamera() {
        ppsFacingMode = ppsFacingMode === 'user' ? 'environment' : 'user';
        stopProgressPhotoStream();
        try {
            ppsStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: ppsFacingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false
            });
            const video = document.getElementById('pps-video');
            video.srcObject = ppsStream;
            // Mirror only for front camera
            video.style.transform = ppsFacingMode === 'user' ? 'scaleX(-1)' : 'none';
            await video.play();
        } catch (e) { console.warn('Flip failed:', e); }
    }

    function updatePoseIndicator() {
        const ind = document.getElementById('pps-pose-indicator');
        const emoji = document.getElementById('pps-pose-emoji');
        const title = document.getElementById('pps-pose-title');
        const hint = document.getElementById('pps-pose-hint');
        const sil = document.getElementById('pps-silhouette');
        const pose = PROGRESS_PHOTO_POSES[ppsCurrentPose];
        if (ind) ind.textContent = `Pose ${ppsCurrentPose + 1} of 3`;
        if (emoji) emoji.textContent = pose.emoji;
        if (title) title.textContent = pose.title;
        if (hint) hint.textContent = pose.hint;
        if (sil) sil.innerHTML = `<path d="${pose.silhouette}"/>`;
    }

    function renderPoseThumbs() {
        const thumbs = document.querySelectorAll('#pps-thumbs .pps-thumb');
        thumbs.forEach((el, i) => {
            const file = ppsCapturedFiles[i];
            const labels = ['Front', 'Side', 'Back'];
            if (file) {
                const url = URL.createObjectURL(file);
                el.style.backgroundImage = `url(${url})`;
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
                el.style.border = '2px solid #10b981';
                el.innerHTML = '<div style="background:#10b981; color:white; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:0.8rem; align-self:flex-end; margin:4px;">✓</div>';
                el.style.alignItems = 'flex-start';
                el.style.justifyContent = 'flex-end';
            } else if (i === ppsCurrentPose) {
                el.style.backgroundImage = '';
                el.style.border = '2px solid #ec4899';
                el.style.background = 'rgba(236,72,153,0.25)';
                el.innerHTML = labels[i];
                el.style.color = '#fff';
            } else {
                el.style.backgroundImage = '';
                el.style.border = '2px dashed rgba(255,255,255,0.4)';
                el.style.background = 'rgba(255,255,255,0.1)';
                el.innerHTML = labels[i];
                el.style.color = 'rgba(255,255,255,0.7)';
            }
        });
    }

    function clearCountdown() {
        if (ppsCountdownTimer) {
            clearTimeout(ppsCountdownTimer);
            ppsCountdownTimer = null;
        }
        const cd = document.getElementById('pps-countdown');
        if (cd) cd.style.display = 'none';
    }

    function resetPoseUI() {
        const startBtn = document.getElementById('pps-start-btn');
        const retakeBtn = document.getElementById('pps-retake-btn');
        const startLabel = document.getElementById('pps-start-label');
        if (startBtn) startBtn.style.display = 'flex';
        if (retakeBtn) retakeBtn.style.display = 'none';
        if (startLabel) startLabel.textContent = ppsCurrentPose === 0 ? 'Start 5s timer' : 'Next pose — start timer';
        clearCountdown();
    }

    function startProgressPoseCountdown() {
        const startBtn = document.getElementById('pps-start-btn');
        const retakeBtn = document.getElementById('pps-retake-btn');
        if (startBtn) startBtn.style.display = 'none';
        if (retakeBtn) retakeBtn.style.display = 'none';

        const cd = document.getElementById('pps-countdown');
        const num = document.getElementById('pps-countdown-num');
        if (cd) cd.style.display = 'flex';

        let count = 5;
        if (num) num.textContent = String(count);

        function tick() {
            count--;
            if (count > 0) {
                if (num) {
                    num.textContent = String(count);
                    num.style.transform = 'scale(1.3)';
                    num.style.opacity = '0.3';
                    requestAnimationFrame(() => {
                        num.style.transition = 'transform 0.8s ease-out, opacity 0.8s ease-out';
                        num.style.transform = 'scale(1)';
                        num.style.opacity = '1';
                    });
                }
                ppsCountdownTimer = setTimeout(tick, 1000);
            } else {
                if (num) num.textContent = '📸';
                ppsCountdownTimer = setTimeout(capturePoseNow, 300);
            }
        }
        ppsCountdownTimer = setTimeout(tick, 1000);
    }

    async function capturePoseNow() {
        const video = document.getElementById('pps-video');
        const canvas = document.getElementById('pps-canvas');
        if (!video || !canvas) return;

        // Shutter flash
        const flash = document.getElementById('pps-flash');
        if (flash) {
            flash.style.opacity = '0.9';
            setTimeout(() => { flash.style.opacity = '0'; }, 120);
        }

        const w = video.videoWidth || 1080;
        const h = video.videoHeight || 1920;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');

        // If front camera, un-mirror the saved image (video is mirrored for UX)
        if (ppsFacingMode === 'user') {
            ctx.save();
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(video, 0, 0, w, h);
            ctx.restore();
        } else {
            ctx.drawImage(video, 0, 0, w, h);
        }

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
        if (!blob) { console.error('Canvas toBlob failed'); return; }

        const poseKey = PROGRESS_PHOTO_POSES[ppsCurrentPose].key;
        const file = new File([blob], `progress-${poseKey}-${Date.now()}.jpg`, { type: 'image/jpeg' });
        ppsCapturedFiles[ppsCurrentPose] = file;

        clearCountdown();
        renderPoseThumbs();

        // Show retake + next buttons
        const retakeBtn = document.getElementById('pps-retake-btn');
        const startBtn = document.getElementById('pps-start-btn');
        const startLabel = document.getElementById('pps-start-label');
        if (retakeBtn) retakeBtn.style.display = 'block';

        if (ppsCurrentPose < 2) {
            // Advance to next pose
            setTimeout(() => {
                ppsCurrentPose++;
                updatePoseIndicator();
                renderPoseThumbs();
                if (startBtn) startBtn.style.display = 'flex';
                if (startLabel) startLabel.textContent = 'Start 5s timer';
            }, 900);
        } else {
            // All 3 captured — upload
            if (startBtn) startBtn.style.display = 'none';
            if (retakeBtn) retakeBtn.style.display = 'none';
            await uploadAllPoses();
        }
    }

    function retakeCurrentPose() {
        ppsCapturedFiles[ppsCurrentPose] = null;
        renderPoseThumbs();
        resetPoseUI();
    }

    async function uploadAllPoses() {
        const uploading = document.getElementById('pps-uploading');
        const status = document.getElementById('pps-uploading-status');
        if (uploading) uploading.style.display = 'flex';

        const userId = window.currentUser?.id;
        if (!userId) {
            alert('You need to be signed in to save progress photos.');
            closeProgressPhotoSession();
            return;
        }

        const existingPhoto = await db.progressPhotos.getThisWeeksPhoto(userId).catch(() => null);

        const urls = { front: null, left: null, back: null };
        let primaryUrl = null;
        let primaryFileName = null;

        try {
            for (let i = 0; i < 3; i++) {
                const file = ppsCapturedFiles[i];
                if (!file) continue;
                if (status) status.textContent = `Saving photo ${i + 1} of 3`;

                const formData = new FormData();
                formData.append('file', file);
                formData.append('userId', userId);

                const resp = await fetch('/api/upload-progress-photo', { method: 'POST', body: formData });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error || `Upload failed for pose ${i + 1}`);
                }
                const data = await resp.json();
                const key = PROGRESS_PHOTO_POSES[i].key;
                urls[key] = data.url;
                if (i === 0) { primaryUrl = data.url; primaryFileName = data.fileName; }
            }

            if (!primaryUrl) throw new Error('No photos captured');

            // Save with angles encoded in notes JSON (backward compat: photo_url stays front)
            const notesJson = JSON.stringify({ angles: urls });
            await db.progressPhotos.save(userId, primaryUrl, primaryFileName, notesJson);

            // Award XP only if first time this week
            if (!existingPhoto) {
                try {
                    const multiplier = typeof getXPMultiplier === 'function' ? await getXPMultiplier() : 1;
                    const xpAmount = PROGRESS_PHOTO_XP * multiplier;
                    const { data: currentPoints } = await supabaseClient
                        .from('user_points')
                        .select('lifetime_points')
                        .eq('user_id', userId)
                        .maybeSingle();

                    if (currentPoints) {
                        await supabaseClient
                            .from('user_points')
                            .update({ lifetime_points: (currentPoints.lifetime_points || 0) + xpAmount })
                            .eq('user_id', userId);
                    } else {
                        await supabaseClient
                            .from('user_points')
                            .insert({ user_id: userId, lifetime_points: xpAmount, current_points: 0 });
                    }

                    if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow();
                    if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay();
                    if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay();
                } catch (xpError) {
                    console.log('XP award skipped:', xpError);
                }
            }

            closeProgressPhotoSession();

            // Show the done card on home
            const card = document.getElementById('weekly-progress-photo-card');
            const doneCard = document.getElementById('weekly-progress-photo-done-card');
            if (card) card.style.display = 'none';
            if (doneCard) doneCard.style.display = 'flex';

            if (typeof ppsOnComplete === 'function') {
                try { ppsOnComplete(); } catch(e) {}
            }

            console.log('Progress photo session uploaded successfully!');
        } catch (error) {
            console.error('Error uploading progress photos:', error);
            if (uploading) uploading.style.display = 'none';
            alert('Failed to upload progress photos. Please try again.');
            const startBtn = document.getElementById('pps-start-btn');
            const retakeBtn = document.getElementById('pps-retake-btn');
            const startLabel = document.getElementById('pps-start-label');
            if (startBtn) { startBtn.style.display = 'flex'; }
            if (startLabel) startLabel.textContent = 'Try again';
            if (retakeBtn) retakeBtn.style.display = 'block';
        }
    }

    function dismissProgressPhotoDoneCard() {
        const today = typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().split('T')[0];
        try {
            localStorage.setItem('progressPhotoDoneCardDismissedDate', today);
        } catch (e) { console.warn('localStorage full', e); }

        if (typeof window.syncTrendDismissalToDb === 'function') {
            window.syncTrendDismissalToDb('progressPhotoDoneCard', today);
        }

        var el = document.getElementById('weekly-progress-photo-done-card');
        if (el) el.style.display = 'none';
    }

    // Wire up card click to launch guided session
    (function() {
        var photoCard = document.getElementById('weekly-progress-photo-card');
        if (photoCard) {
            photoCard.onclick = function() {
                openProgressPhotoSession();
            };
        }
    })();

    // Make functions globally available
    window.dismissProgressPhotoDoneCard = dismissProgressPhotoDoneCard;
    window.checkAndShowProgressPhotoCard = checkAndShowProgressPhotoCard;
    window.openProgressPhotoSession = openProgressPhotoSession;
    window.closeProgressPhotoSession = closeProgressPhotoSession;
    window.flipProgressPhotoCamera = flipProgressPhotoCamera;
    window.startProgressPoseCountdown = startProgressPoseCountdown;
    window.retakeCurrentPose = retakeCurrentPose;
