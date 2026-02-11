// --- STORIES FEATURE ---

let currentStories = [];
let currentStoryIndex = 0;
let currentUserStories = [];
let currentUserStoryIndex = 0;
let storyProgressInterval = null;
let selectedStoryFile = null;
let allUserStoryGroups = []; // Store all user groups for swipe navigation
let currentUserGroupIndex = 0; // Current user group being viewed

// Touch/gesture tracking
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isHoldingStory = false;
let holdTimeout = null;

// Text overlay for stories
let storyTextOverlay = null;

// Generate thumbnail from video or image
async function generateThumbnail(file, mediaType) {
    try {
        if (mediaType === 'video') {
            // Generate thumbnail from first frame of video
            return new Promise((resolve, reject) => {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.muted = true;
                video.playsInline = true;

                video.onloadeddata = () => {
                    // Seek to 0.1 seconds to get a good frame
                    video.currentTime = 0.1;
                };

                video.onseeked = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = 800;
                        canvas.height = 800;

                        const ctx = canvas.getContext('2d');

                        // Calculate dimensions to crop to square
                        const size = Math.min(video.videoWidth, video.videoHeight);
                        const x = (video.videoWidth - size) / 2;
                        const y = (video.videoHeight - size) / 2;

                        // Draw cropped video frame to canvas
                        ctx.drawImage(video, x, y, size, size, 0, 0, 800, 800);

                        // Convert canvas to base64
                        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);

                        // Clean up
                        video.src = '';
                        URL.revokeObjectURL(video.src);

                        resolve(thumbnailUrl);
                    } catch (error) {
                        console.error('Error generating video thumbnail:', error);
                        resolve(null);
                    }
                };

                video.onerror = () => {
                    console.error('Error loading video for thumbnail');
                    resolve(null);
                };

                video.src = URL.createObjectURL(file);
            });
        } else if (mediaType === 'image') {
            // Generate thumbnail from image
            return new Promise((resolve, reject) => {
                const img = new Image();

                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = 800;
                        canvas.height = 800;

                        const ctx = canvas.getContext('2d');

                        // Calculate dimensions to crop to square
                        const size = Math.min(img.width, img.height);
                        const x = (img.width - size) / 2;
                        const y = (img.height - size) / 2;

                        // Draw cropped image to canvas
                        ctx.drawImage(img, x, y, size, size, 0, 0, 800, 800);

                        // Convert canvas to base64
                        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85);

                        resolve(thumbnailUrl);
                    } catch (error) {
                        console.error('Error generating image thumbnail:', error);
                        resolve(null);
                    }
                };

                img.onerror = () => {
                    console.error('Error loading image for thumbnail');
                    resolve(null);
                };

                img.src = URL.createObjectURL(file);
            });
        }
    } catch (error) {
        console.error('Error in generateThumbnail:', error);
        return null;
    }

    return null;
}

// Compress image to reduce file size for faster uploads
// Targets max 1920px dimension and JPEG quality 0.8
async function compressImage(file, onProgress) {
    return new Promise((resolve, reject) => {
        // Skip compression for already small files (< 2MB)
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB < 2) {
            console.log('Image already small, skipping compression');
            resolve(file);
            return;
        }

        if (onProgress) onProgress('Compressing image...');

        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            // Calculate new dimensions (max 1920px on longest side)
            const maxDim = 1920;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // Draw image to canvas
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob with reduced quality
            canvas.toBlob((blob) => {
                if (blob) {
                    const newSizeMB = (blob.size / (1024 * 1024)).toFixed(1);
                    console.log(`Image compressed: ${fileSizeMB.toFixed(1)}MB → ${newSizeMB}MB`);

                    // Create a new File object with the compressed data
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                } else {
                    console.warn('Image compression failed, using original');
                    resolve(file);
                }
            }, 'image/jpeg', 0.8); // 80% quality JPEG
        };

        img.onerror = () => {
            console.warn('Failed to load image for compression, using original');
            resolve(file);
        };

        // Load the image from the file
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.onerror = () => {
            console.warn('Failed to read image file, using original');
            resolve(file);
        };
        reader.readAsDataURL(file);
    });
}

// Compress video to reduce file size for faster uploads
// Targets ~720p resolution and reasonable bitrate
async function compressVideo(file, onProgress) {
    return new Promise((resolve, reject) => {
        // Skip compression for already small files (< 3MB)
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB < 3) {
            console.log('Video already small, skipping compression');
            resolve(file);
            return;
        }

        console.log(`Compressing video: ${fileSizeMB.toFixed(1)}MB`);
        if (onProgress) onProgress('Loading video...');

        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = async function() {
            try {
                // Calculate target dimensions (max 720p, maintain aspect ratio)
                const maxDimension = 720;
                let targetWidth = video.videoWidth;
                let targetHeight = video.videoHeight;

                if (targetWidth > targetHeight && targetWidth > maxDimension) {
                    targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
                    targetWidth = maxDimension;
                } else if (targetHeight > maxDimension) {
                    targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
                    targetHeight = maxDimension;
                }

                // Ensure even dimensions (required for some codecs)
                targetWidth = Math.round(targetWidth / 2) * 2;
                targetHeight = Math.round(targetHeight / 2) * 2;

                console.log(`Resizing from ${video.videoWidth}x${video.videoHeight} to ${targetWidth}x${targetHeight}`);
                if (onProgress) onProgress('Compressing...');

                // Create canvas for video frames
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');

                // Get canvas stream
                const canvasStream = canvas.captureStream(30); // 30fps

                // Try to get audio track from original video
                video.muted = false;
                try {
                    await video.play();
                    video.pause();
                    video.currentTime = 0;
                } catch (e) {
                    console.log('Could not play video for audio extraction');
                }

                // Set up MediaRecorder with target bitrate
                const targetBitrate = 1500000; // 1.5 Mbps for good quality at 720p
                let options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: targetBitrate };

                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = { mimeType: 'video/webm', videoBitsPerSecond: targetBitrate };
                }
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    options = { videoBitsPerSecond: targetBitrate };
                }

                const recorder = new MediaRecorder(canvasStream, options);
                const chunks = [];

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunks.push(e.data);
                };

                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const compressedFile = new File([blob], 'compressed-video.webm', { type: 'video/webm' });
                    const newSizeMB = compressedFile.size / (1024 * 1024);
                    console.log(`Compressed: ${fileSizeMB.toFixed(1)}MB → ${newSizeMB.toFixed(1)}MB`);

                    // Clean up
                    URL.revokeObjectURL(video.src);

                    resolve(compressedFile);
                };

                recorder.onerror = (e) => {
                    console.error('MediaRecorder error:', e);
                    URL.revokeObjectURL(video.src);
                    resolve(file); // Fall back to original on error
                };

                // Start recording
                recorder.start();

                // Play video and draw frames to canvas
                video.currentTime = 0;
                video.muted = true; // Mute during processing to avoid echo

                const drawFrame = () => {
                    if (video.paused || video.ended) {
                        recorder.stop();
                        return;
                    }
                    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
                    requestAnimationFrame(drawFrame);
                };

                video.onended = () => {
                    recorder.stop();
                };

                video.onplay = () => {
                    drawFrame();
                };

                // Handle progress updates
                video.ontimeupdate = () => {
                    if (onProgress && video.duration) {
                        const percent = Math.round((video.currentTime / video.duration) * 100);
                        onProgress(`Compressing... ${percent}%`);
                    }
                };

                await video.play();

            } catch (error) {
                console.error('Video compression error:', error);
                URL.revokeObjectURL(video.src);
                resolve(file); // Fall back to original on error
            }
        };

        video.onerror = function() {
            console.error('Failed to load video for compression');
            resolve(file); // Fall back to original on error
        };

        video.src = URL.createObjectURL(file);
    });
}

// Get profile photo as fallback thumbnail
function getProfilePhotoThumbnail() {
    // Try to get from localStorage first
    const profilePhoto = localStorage.getItem('profile_photo');
    if (profilePhoto) {
        return profilePhoto;
    }

    // Try to get from current user
    if (window.currentUser && window.currentUser.profile_photo) {
        return window.currentUser.profile_photo;
    }

    return null;
}

// Load and render stories carousel
window.loadStoriesCarousel = async function() {
    if (!window.currentUser) return;

    try {
        // Get all active stories from extended network
        const stories = await dbHelpers.stories.getNetworkStories(window.currentUser.id);

        // Group stories by user
        const groupedStories = {};
        stories.forEach(story => {
            if (!groupedStories[story.user_id]) {
                groupedStories[story.user_id] = {
                    user_id: story.user_id,
                    user_name: story.user_name,
                    profile_photo: story.profile_photo,
                    stories: [],
                    hasUnviewed: false
                };
            }
            groupedStories[story.user_id].stories.push(story);
            if (!story.has_viewed) {
                groupedStories[story.user_id].hasUnviewed = true;
            }
        });

        // Render story rings to main carousel
        const carousel = document.getElementById('stories-carousel');
        if (carousel) {
            // Keep the "Add Your Story" button
            const addButton = carousel.querySelector('.add-story-btn');
            carousel.innerHTML = '';
            if (addButton) {
                carousel.appendChild(addButton);
            }

            // Add story rings for each user
            const userGroups = Object.values(groupedStories);
            userGroups.forEach((userStoryGroup, index) => {
                const ring = createStoryRing(userStoryGroup, index, userGroups);
                carousel.appendChild(ring);
            });
        }

        // Also render to friends page carousel if it exists
        const friendsCarousel = document.getElementById('friends-stories-carousel');
        if (friendsCarousel) {
            // Keep the "Add Your Story" button
            const friendsAddButton = friendsCarousel.querySelector('.add-story-btn');
            friendsCarousel.innerHTML = '';
            if (friendsAddButton) {
                friendsCarousel.appendChild(friendsAddButton);
            }

            // Add story rings for each user
            const userGroups = Object.values(groupedStories);
            userGroups.forEach((userStoryGroup, index) => {
                const ring = createStoryRing(userStoryGroup, index, userGroups);
                ring.style.flexShrink = '0'; // Prevent shrinking in flex container
                friendsCarousel.appendChild(ring);
            });
        }

    } catch (error) {
        console.error('Error loading stories:', error);
    }
};

// Create a story ring element
function createStoryRing(userStoryGroup, groupIndex = 0, allGroups = []) {
    const div = document.createElement('div');
    div.className = 'story-ring';
    div.style.cssText = 'display: inline-block; text-align: center; cursor: pointer;';
    div.onclick = () => openStoryViewer(userStoryGroup, groupIndex, allGroups);

    const gradientColor = userStoryGroup.hasUnviewed
        ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
        : 'linear-gradient(135deg, #d1d5db, #9ca3af)';

    const initial = userStoryGroup.user_name ? userStoryGroup.user_name.charAt(0).toUpperCase() : '?';

    // Use thumbnail from the first story, fallback to profile photo
    let thumbnailUrl = null;
    if (userStoryGroup.stories && userStoryGroup.stories.length > 0) {
        thumbnailUrl = userStoryGroup.stories[0].thumbnail_url;
    }

    // Fallback chain: story thumbnail -> profile photo -> initial
    const avatarContent = thumbnailUrl
        ? `<img src="${thumbnailUrl}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
        : userStoryGroup.profile_photo
        ? `<img src="${userStoryGroup.profile_photo}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
        : `<span style="font-size: 1.5rem; color: white;">${initial}</span>`;

    div.innerHTML = `
        <div style="width: 70px; height: 70px; border-radius: 50%; background: ${gradientColor}; display: flex; align-items: center; justify-content: center; position: relative;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 3px solid white;">
                ${avatarContent}
            </div>
        </div>
        <p style="margin: 5px 0 0 0; font-size: 0.75rem; color: var(--text-muted); white-space: normal; width: 70px; overflow: hidden; text-overflow: ellipsis;">${userStoryGroup.user_name || 'Unknown'}</p>
    `;

    return div;
}

// Camera stream for Instagram-style camera
let cameraStream = null;
let mediaRecorder = null;
let recordedChunks = [];

// Open native phone camera (best quality and reliability)
window.openStoryCamera = async function() {
    console.log('Opening story camera - native phone camera mode');

    // Show choice modal to select photo or video
    const choiceModal = document.getElementById('story-choice-modal');
    if (choiceModal) {
        choiceModal.style.display = 'flex';
    } else {
        // Fallback: default to photo if modal doesn't exist
        openNativeCamera('photo');
    }
};

// Open native camera for photo or video
window.openNativeCamera = function(type) {
    console.log('Opening native camera for:', type);

    // Hide choice modal
    const choiceModal = document.getElementById('story-choice-modal');
    if (choiceModal) {
        choiceModal.style.display = 'none';
    }

    // Create file input to trigger native camera
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';

    if (type === 'photo') {
        fileInput.accept = 'image/*';
        fileInput.capture = 'environment'; // Opens native camera app
    } else if (type === 'video') {
        fileInput.accept = 'video/*';
        fileInput.capture = 'environment'; // Opens native camera app for video
    }

    let hasProcessedFile = false;

    fileInput.onchange = async function(e) {
        if (hasProcessedFile) return; // Prevent double-processing
        hasProcessedFile = true;

        const file = e.target.files[0];
        if (!file) {
            console.log('No file selected from camera');
            cleanup();
            return;
        }

        console.log('File captured:', file.name, file.type, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

        // Validate file type
        const isValidImage = type === 'photo' && file.type.startsWith('image/');
        const isValidVideo = type === 'video' && file.type.startsWith('video/');

        if (!isValidImage && !isValidVideo) {
            alert('Invalid file type. Please try again.');
            cleanup();
            return;
        }

        // Set as selected story file
        selectedStoryFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            const isVideo = file.type.startsWith('video/');
            showNativePreviewModal(e.target.result, isVideo ? 'video' : 'image');
        };
        reader.onerror = function(error) {
            console.error('FileReader error:', error);
            alert('Failed to load file. Please try again.');
            cleanup();
        };
        reader.readAsDataURL(file);

        // Clean up after a delay to ensure processing completes
        setTimeout(cleanup, 500);
    };

    function cleanup() {
        try {
            if (fileInput && fileInput.parentNode) {
                fileInput.parentNode.removeChild(fileInput);
            }
        } catch (e) {
            console.log('Cleanup error (non-critical):', e);
        }
    }

    // Handle cancel/blur events
    let cleanupTimer;
    fileInput.addEventListener('cancel', function() {
        console.log('Camera cancelled by user');
        cleanup();
    });

    // Fallback cleanup after 2 minutes if nothing happens
    cleanupTimer = setTimeout(() => {
        if (!hasProcessedFile) {
            console.log('Camera timeout - cleaning up');
            cleanup();
        }
    }, 120000);

    // Add to DOM and trigger
    document.body.appendChild(fileInput);

    // Small delay to ensure proper triggering on all devices
    setTimeout(() => {
        try {
            fileInput.click();
        } catch (error) {
            console.error('Failed to trigger camera:', error);
            alert('Camera unavailable. Please check your browser permissions.');
            cleanup();
        }
    }, 100);
};

// Close choice modal
window.closeChoiceModal = function() {
    const choiceModal = document.getElementById('story-choice-modal');
    if (choiceModal) {
        choiceModal.style.display = 'none';
    }
};

// Show preview modal for native camera capture
function showNativePreviewModal(dataUrl, type) {
    const previewModal = document.getElementById('story-preview-modal');
    const previewPhoto = document.getElementById('story-preview-photo');
    const previewVideo = document.getElementById('story-preview-video-player');

    if (!previewModal) return;

    // Show modal
    previewModal.style.display = 'flex';

    // Show appropriate preview
    if (type === 'image') {
        if (previewPhoto) {
            previewPhoto.src = dataUrl;
            previewPhoto.style.display = 'block';
        }
        if (previewVideo) {
            previewVideo.style.display = 'none';
            previewVideo.pause();
        }
    } else {
        if (previewVideo) {
            previewVideo.src = dataUrl;
            previewVideo.style.display = 'block';
            previewVideo.play().catch(err => console.log('Video autoplay prevented:', err));
        }
        if (previewPhoto) {
            previewPhoto.style.display = 'none';
        }
    }
}

// Close preview modal
window.closePreviewModal = function() {
    const previewModal = document.getElementById('story-preview-modal');
    const previewVideo = document.getElementById('story-preview-video-player');
    const textOverlayPreview = document.getElementById('story-text-overlay-preview');
    const textInput = document.getElementById('story-text-input');

    if (previewVideo) {
        previewVideo.pause();
        previewVideo.src = '';
    }

    if (previewModal) {
        previewModal.style.display = 'none';
    }

    // Clear text overlay
    if (textOverlayPreview) {
        textOverlayPreview.style.display = 'none';
        textOverlayPreview.textContent = '';
    }
    if (textInput) {
        textInput.value = '';
    }
    storyTextOverlay = null;

    selectedStoryFile = null;
};

// Show text editor overlay
window.showTextEditor = function() {
    const textEditorOverlay = document.getElementById('text-editor-overlay');
    const textInput = document.getElementById('story-text-input');

    if (textEditorOverlay) {
        textEditorOverlay.style.display = 'flex';
    }

    // Focus on the text input
    if (textInput) {
        // Set existing text if any
        if (storyTextOverlay) {
            textInput.value = storyTextOverlay;
        }
        setTimeout(() => textInput.focus(), 100);
    }
};

// Cancel text editor
window.cancelTextEditor = function() {
    const textEditorOverlay = document.getElementById('text-editor-overlay');

    if (textEditorOverlay) {
        textEditorOverlay.style.display = 'none';
    }
};

// Save text overlay
window.saveTextOverlay = function() {
    const textInput = document.getElementById('story-text-input');
    const textEditorOverlay = document.getElementById('text-editor-overlay');
    const textOverlayPreview = document.getElementById('story-text-overlay-preview');

    if (!textInput || !textEditorOverlay) return;

    const text = textInput.value.trim();

    // Save text to variable
    storyTextOverlay = text || null;

    // Update preview
    if (textOverlayPreview) {
        if (text) {
            textOverlayPreview.textContent = text;
            textOverlayPreview.style.display = 'block';
        } else {
            textOverlayPreview.style.display = 'none';
        }
    }

    // Hide text editor
    textEditorOverlay.style.display = 'none';
};

// Retake from preview
window.retakeFromPreview = function() {
    closePreviewModal();
    // Reopen camera choice
    openStoryCamera();
};

// Close camera modal
window.closeCameraModal = function() {
    const cameraModal = document.getElementById('story-camera-modal');
    const videoElement = document.getElementById('camera-preview');

    // Stop camera stream
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    // Stop recording if active
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }

    if (videoElement) {
        videoElement.srcObject = null;
    }

    if (cameraModal) {
        cameraModal.style.display = 'none';
    }

    recordedChunks = [];
};

// Capture photo from camera
let holdTimer = null;
let isHolding = false;

window.handleCameraButtonDown = function() {
    isHolding = false;

    // Start timer - if held for 200ms, start recording
    holdTimer = setTimeout(function() {
        isHolding = true;
        startVideoRecording();
    }, 200);
};

window.handleCameraButtonUp = function() {
    clearTimeout(holdTimer);

    if (isHolding) {
        // Was holding - stop recording
        stopVideoRecording();
    } else {
        // Was a tap - take photo
        capturePhoto();
    }
};

window.capturePhoto = function() {
    const videoElement = document.getElementById('camera-preview');
    if (!videoElement) return;

    // Create canvas to capture frame
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);

    // Convert to blob
    canvas.toBlob(function(blob) {
        console.log('Photo captured, blob size:', blob.size);

        // Create file from blob
        selectedStoryFile = new File([blob], 'story-photo.jpg', { type: 'image/jpeg' });
        console.log('selectedStoryFile set:', selectedStoryFile);

        // Show preview in camera modal
        const reader = new FileReader();
        reader.onload = function(e) {
            showCapturedPreview(e.target.result, 'image');
        };
        reader.readAsDataURL(selectedStoryFile);
    }, 'image/jpeg', 0.95);
};

// Show captured preview in camera modal
function showCapturedPreview(dataUrl, type) {
    const capturedPreview = document.getElementById('captured-preview');
    const capturedPhoto = document.getElementById('captured-photo');
    const capturedVideo = document.getElementById('captured-video');
    const cameraControls = document.getElementById('camera-controls');
    const postBtn = document.getElementById('post-story-btn');
    const retakeBtn = document.getElementById('retake-btn');

    // Hide camera controls
    if (cameraControls) cameraControls.style.display = 'none';

    // Show captured preview
    if (capturedPreview) capturedPreview.style.display = 'block';

    if (type === 'image') {
        if (capturedPhoto) {
            capturedPhoto.src = dataUrl;
            capturedPhoto.style.display = 'block';
        }
        if (capturedVideo) capturedVideo.style.display = 'none';
    } else {
        if (capturedVideo) {
            capturedVideo.src = dataUrl;
            capturedVideo.style.display = 'block';
        }
        if (capturedPhoto) capturedPhoto.style.display = 'none';
    }

    // Show Post and Retake buttons
    if (postBtn) postBtn.style.display = 'block';
    if (retakeBtn) retakeBtn.style.display = 'block';
}

// Retake photo/video
window.retakePhoto = function() {
    const capturedPreview = document.getElementById('captured-preview');
    const capturedPhoto = document.getElementById('captured-photo');
    const capturedVideo = document.getElementById('captured-video');
    const cameraControls = document.getElementById('camera-controls');
    const postBtn = document.getElementById('post-story-btn');
    const retakeBtn = document.getElementById('retake-btn');

    // Hide preview
    if (capturedPreview) capturedPreview.style.display = 'none';
    if (capturedPhoto) capturedPhoto.style.display = 'none';
    if (capturedVideo) {
        capturedVideo.pause();
        capturedVideo.src = '';
        capturedVideo.style.display = 'none';
    }

    // Show camera controls again
    if (cameraControls) cameraControls.style.display = 'flex';

    // Hide Post and Retake buttons
    if (postBtn) postBtn.style.display = 'none';
    if (retakeBtn) retakeBtn.style.display = 'none';

    // Clear selected file
    selectedStoryFile = null;
};

// Start/Stop video recording
let isRecording = false;
window.toggleVideoRecording = function() {
    if (!isRecording) {
        startVideoRecording();
    } else {
        stopVideoRecording();
    }
};

function startVideoRecording() {
    if (!cameraStream) return;

    recordedChunks = [];

    try {
        mediaRecorder = new MediaRecorder(cameraStream, {
            mimeType: 'video/webm;codecs=vp9'
        });
    } catch (e) {
        // Fallback for browsers that don't support vp9
        mediaRecorder = new MediaRecorder(cameraStream);
    }

    mediaRecorder.ondataavailable = function(event) {
        if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = function() {
        console.log('Video recording stopped, chunks:', recordedChunks.length);
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        console.log('Video blob size:', blob.size);

        selectedStoryFile = new File([blob], 'story-video.webm', { type: 'video/webm' });
        console.log('selectedStoryFile set:', selectedStoryFile);

        // Show preview in camera modal
        const reader = new FileReader();
        reader.onload = function(e) {
            showCapturedPreview(e.target.result, 'video');
        };
        reader.readAsDataURL(selectedStoryFile);

        isRecording = false;
        updateCaptureButton();
    };

    mediaRecorder.start();
    isRecording = true;
    updateCaptureButton();
}

function stopVideoRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

function updateCaptureButton() {
    const captureBtn = document.getElementById('camera-capture-btn');
    const recordingIndicator = document.getElementById('recording-indicator');

    if (captureBtn) {
        if (isRecording) {
            captureBtn.style.background = '#ef4444';
            captureBtn.style.transform = 'scale(1.1)';
        } else {
            captureBtn.style.background = 'white';
            captureBtn.style.transform = 'scale(1)';
        }
    }

    if (recordingIndicator) {
        recordingIndicator.style.display = isRecording ? 'block' : 'none';
    }
}

// Open story upload modal
window.openStoryUploadModal = function() {
    const modal = document.getElementById('story-upload-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Don't reset the form when opening - we want to keep the captured file!
    }
};

// Close story upload modal
window.closeStoryUploadModal = function() {
    const modal = document.getElementById('story-upload-modal');
    if (modal) {
        modal.style.display = 'none';
        resetStoryUploadForm();
    }
};

// Reset story upload form
function resetStoryUploadForm() {
    const imagePreview = document.getElementById('story-preview-image');
    const videoPreview = document.getElementById('story-preview-video');
    const placeholder = document.getElementById('story-preview-placeholder');
    const caption = document.getElementById('story-caption-input');
    const uploadButton = document.getElementById('story-upload-button');
    const fileInput = document.getElementById('story-file-input');

    if (imagePreview) imagePreview.style.display = 'none';
    if (videoPreview) {
        videoPreview.style.display = 'none';
        videoPreview.pause();
        videoPreview.src = '';
    }
    if (placeholder) placeholder.style.display = 'block';
    if (caption) caption.value = '';
    if (uploadButton) {
        uploadButton.disabled = true;
        uploadButton.style.opacity = '0.5';
    }
    if (fileInput) fileInput.value = '';
    selectedStoryFile = null;
}

// Handle story file selection
window.handleStoryFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    selectedStoryFile = file;
    const isVideo = file.type.startsWith('video/');

    // Open the modal first
    openStoryUploadModal();

    const reader = new FileReader();
    reader.onload = function(e) {
        const imagePreview = document.getElementById('story-preview-image');
        const videoPreview = document.getElementById('story-preview-video');
        const placeholder = document.getElementById('story-preview-placeholder');
        const uploadButton = document.getElementById('story-upload-button');

        if (placeholder) {
            placeholder.style.display = 'none';
        }

        if (isVideo) {
            // Show video preview
            if (videoPreview) {
                videoPreview.src = e.target.result;
                videoPreview.style.display = 'block';
            }
            if (imagePreview) {
                imagePreview.style.display = 'none';
            }
        } else {
            // Show image preview
            if (imagePreview) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
            }
            if (videoPreview) {
                videoPreview.style.display = 'none';
            }
        }

        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.style.opacity = '1';
        }
    };
    reader.readAsDataURL(file);
};

// Post captured story from preview modal
window.postCapturedStory = async function() {
    if (!selectedStoryFile || !window.currentUser) {
        alert('Unable to post story. Please try again.');
        return;
    }

    const postBtn = document.getElementById('preview-post-btn');

    try {
        // Disable button while uploading
        if (postBtn) {
            postBtn.textContent = 'Posting...';
            postBtn.disabled = true;
        }

        // Detect media type
        const isVideo = selectedStoryFile.type.startsWith('video/');
        const mediaType = isVideo ? 'video' : 'image';

        // Get video duration if it's a video
        let duration = 5; // default for images
        if (isVideo) {
            const videoElement = document.getElementById('story-preview-video-player');
            if (videoElement && videoElement.duration && videoElement.duration !== Infinity) {
                duration = Math.ceil(videoElement.duration);
            } else {
                // For very short videos or if duration unavailable, use 10s default
                duration = 10;
            }
        }

        // Compress media if needed for faster upload
        const originalSize = (selectedStoryFile.size / (1024 * 1024)).toFixed(1);

        if (isVideo) {
            if (postBtn) postBtn.textContent = `Compressing ${originalSize}MB...`;

            selectedStoryFile = await compressVideo(selectedStoryFile, (status) => {
                if (postBtn) postBtn.textContent = status;
            });

            const newSize = (selectedStoryFile.size / (1024 * 1024)).toFixed(1);
            console.log(`Video compression complete: ${originalSize}MB → ${newSize}MB`);
        } else {
            // Compress images too if they're large
            if (selectedStoryFile.size > 2 * 1024 * 1024) { // > 2MB
                if (postBtn) postBtn.textContent = `Compressing ${originalSize}MB...`;

                selectedStoryFile = await compressImage(selectedStoryFile, (status) => {
                    if (postBtn) postBtn.textContent = status;
                });

                const newSize = (selectedStoryFile.size / (1024 * 1024)).toFixed(1);
                console.log(`Image compression complete: ${originalSize}MB → ${newSize}MB`);
            }
        }

        // Generate thumbnail
        let thumbnailUrl = await generateThumbnail(selectedStoryFile, mediaType);

        // Fallback to profile photo if thumbnail generation fails
        if (!thumbnailUrl) {
            thumbnailUrl = getProfilePhotoThumbnail();
        }

        // Generate a temporary story ID for upload
        const tempStoryId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

        // Check file size - if > 5MB, use Backblaze B2, otherwise use Base64
        const fileSizeMB = selectedStoryFile.size / (1024 * 1024);
        let mediaUrl;

        if (fileSizeMB > 5) {
            // Upload to Backblaze B2 for larger files
            if (postBtn) {
                postBtn.textContent = `Uploading ${Math.round(fileSizeMB)}MB...`;
            }

            const formData = new FormData();
            formData.append('file', selectedStoryFile);
            formData.append('userId', window.currentUser.id);
            formData.append('storyId', tempStoryId);

            const uploadResponse = await fetch('/api/upload-story-media', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const uploadData = await uploadResponse.json();
            mediaUrl = uploadData.url;
        } else {
            // Use Base64 for smaller files (< 5MB)
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(selectedStoryFile);
            });
            mediaUrl = base64Data;
        }

        // Create story in database
        const story = await dbHelpers.stories.create(window.currentUser.id, {
            media_type: mediaType,
            media_url: mediaUrl,
            thumbnail_url: thumbnailUrl,
            caption: storyTextOverlay, // Save text overlay as caption
            duration: duration
        });

        console.log('Story created:', story);

        // Analyze story for workout content and award points (images only)
        let pointsMessage = '';
        if (mediaType === 'image' && story && story.id) {
            try {
                if (postBtn) postBtn.textContent = 'Checking for points...';

                // Get image as base64 for analysis
                let imageBase64 = null;
                if (mediaUrl.startsWith('data:')) {
                    // Already base64
                    const matches = mediaUrl.match(/^data:[^;]+;base64,(.+)$/);
                    if (matches) {
                        imageBase64 = matches[1];
                    }
                }

                const analyzeResponse = await fetch('/api/analyze-story-points', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: window.currentUser.id,
                        storyId: story.id,
                        imageBase64: imageBase64,
                        imageUrl: !imageBase64 ? mediaUrl : null,
                        mimeType: selectedStoryFile.type
                    })
                });

                if (analyzeResponse.ok) {
                    const pointsResult = await analyzeResponse.json();
                    console.log('Story points analysis:', pointsResult);

                    if (pointsResult.pointsAwarded > 0) {
                        pointsMessage = `\n\n🏆 +${pointsResult.pointsAwarded} points for your workout post!`;

                        // Refresh points display if available
                        if (typeof window.loadUserPoints === 'function') {
                            window.loadUserPoints();
                        }
                    }
                }
            } catch (pointsError) {
                console.error('Error analyzing story for points:', pointsError);
                // Don't fail the story post if points analysis fails
            }
        }

        // Close preview modal
        closePreviewModal();

        // Reload photo feed and stories carousel
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }
        await loadStoriesCarousel();

        // Show success message
        alert('Post shared!' + pointsMessage);

    } catch (error) {
        console.error('Error posting story:', error);
        alert('Failed to post story: ' + (error.message || 'Please try again.'));

        // Re-enable button
        if (postBtn) {
            postBtn.disabled = false;
            postBtn.textContent = 'Post';
        }
    }
};

// Upload story
window.uploadStory = async function() {
    console.log('uploadStory called');
    console.log('selectedStoryFile:', selectedStoryFile);
    console.log('currentUser:', window.currentUser);

    if (!selectedStoryFile) {
        alert('No file selected. Please capture a photo or video first.');
        return;
    }

    if (!window.currentUser) {
        alert('You must be logged in to share a post.');
        return;
    }

    const uploadButton = document.getElementById('story-upload-button');
    const caption = document.getElementById('story-caption-input');

    try {
        // Disable button while uploading
        if (uploadButton) {
            uploadButton.disabled = true;
            uploadButton.textContent = 'Uploading...';
        }

        // Detect media type
        const isVideo = selectedStoryFile.type.startsWith('video/');
        const mediaType = isVideo ? 'video' : 'image';
        console.log('Media type:', mediaType);

        // Get video duration if it's a video
        let duration = 5; // default for images
        if (isVideo) {
            const videoElement = document.getElementById('story-preview-video');
            if (videoElement && videoElement.duration) {
                duration = Math.ceil(videoElement.duration);
            }
        }
        console.log('Duration:', duration);

        // Compress video if needed for faster upload
        if (isVideo) {
            const originalSize = (selectedStoryFile.size / (1024 * 1024)).toFixed(1);
            if (uploadButton) uploadButton.textContent = `Compressing ${originalSize}MB...`;

            selectedStoryFile = await compressVideo(selectedStoryFile, (status) => {
                if (uploadButton) uploadButton.textContent = status;
            });

            const newSize = (selectedStoryFile.size / (1024 * 1024)).toFixed(1);
            console.log(`Video compression complete: ${originalSize}MB → ${newSize}MB`);
        }

        // Generate thumbnail
        let thumbnailUrl = await generateThumbnail(selectedStoryFile, mediaType);

        // Fallback to profile photo if thumbnail generation fails
        if (!thumbnailUrl) {
            thumbnailUrl = getProfilePhotoThumbnail();
        }

        // Generate a temporary story ID for upload
        const tempStoryId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        console.log('Story ID:', tempStoryId);

        // Check file size - if > 5MB, use Backblaze B2, otherwise use Base64
        const fileSizeMB = selectedStoryFile.size / (1024 * 1024);
        console.log('File size:', fileSizeMB, 'MB');
        let mediaUrl;

        if (fileSizeMB > 5) {
            // Upload to Backblaze B2 for larger files
            if (uploadButton) {
                uploadButton.textContent = `Uploading ${Math.round(fileSizeMB)}MB...`;
            }

            const formData = new FormData();
            formData.append('file', selectedStoryFile);
            formData.append('userId', window.currentUser.id);
            formData.append('storyId', tempStoryId);

            const uploadResponse = await fetch('/api/upload-story-media', {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || 'Upload failed');
            }

            const uploadData = await uploadResponse.json();
            mediaUrl = uploadData.url;

            console.log('Uploaded to B2:', uploadData);
        } else {
            // Use Base64 for smaller files (< 5MB)
            console.log('Converting to Base64...');
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsDataURL(selectedStoryFile);
            });
            mediaUrl = base64Data;
            console.log('Base64 conversion complete, length:', mediaUrl.length);
        }

        // Create story in database
        console.log('Creating story in database...');
        console.log('Story data:', {
            user_id: window.currentUser.id,
            media_type: mediaType,
            media_url_length: mediaUrl ? mediaUrl.length : 0,
            caption: caption ? caption.value.trim() : null,
            duration: duration
        });

        const story = await dbHelpers.stories.create(window.currentUser.id, {
            media_type: mediaType,
            media_url: mediaUrl,
            thumbnail_url: thumbnailUrl,
            caption: caption ? caption.value.trim() : null,
            duration: duration
        });

        console.log('Story created:', story);

        // Close modal
        closeStoryUploadModal();

        // Reload photo feed and stories carousel
        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }
        await loadStoriesCarousel();

        // Show success message
        alert('Post shared successfully!');

    } catch (error) {
        console.error('Error uploading story:', error);

        // Show detailed error on screen
        let errorMessage = 'Failed to upload story:\n\n';
        errorMessage += 'Error: ' + (error.message || 'Unknown error') + '\n\n';
        errorMessage += 'File type: ' + selectedStoryFile.type + '\n';
        errorMessage += 'File size: ' + (selectedStoryFile.size / 1024 / 1024).toFixed(2) + 'MB\n';
        errorMessage += 'User ID: ' + (window.currentUser ? window.currentUser.id : 'No user') + '\n\n';
        errorMessage += 'Please screenshot this and share it.';

        alert(errorMessage);

        // Re-enable button
        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.textContent = 'Share Story';
        }
    }
};

// Open story viewer
function openStoryViewer(userStoryGroup, userGroupIndex = 0, allGroups = []) {
    currentUserStories = userStoryGroup.stories;
    currentUserStoryIndex = 0;
    allUserStoryGroups = allGroups.length > 0 ? allGroups : [userStoryGroup];
    currentUserGroupIndex = userGroupIndex;

    const modal = document.getElementById('story-viewer-modal');
    if (modal) {
        modal.style.display = 'flex';
        setupStoryGestures(); // Setup touch gestures
        renderStory();
    }
}

// Setup gesture handlers for story viewer
function setupStoryGestures() {
    const modal = document.getElementById('story-viewer-modal');
    const contentContainer = document.getElementById('story-content-container');
    if (!modal || !contentContainer) return;

    // Remove any existing listeners
    contentContainer.removeEventListener('touchstart', handleStoryTouchStart);
    contentContainer.removeEventListener('touchend', handleStoryTouchEnd);
    contentContainer.removeEventListener('touchcancel', handleStoryTouchCancel);
    contentContainer.removeEventListener('touchmove', handleStoryTouchMove);

    // Add touch listeners (non-passive to allow preventDefault)
    contentContainer.addEventListener('touchstart', handleStoryTouchStart, { passive: false });
    contentContainer.addEventListener('touchmove', handleStoryTouchMove, { passive: false });
    contentContainer.addEventListener('touchend', handleStoryTouchEnd, { passive: false });
    contentContainer.addEventListener('touchcancel', handleStoryTouchCancel, { passive: false });
}

// Handle touch start - track position and time
function handleStoryTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();

    // Start hold timer - if held for 200ms, pause story
    holdTimeout = setTimeout(() => {
        isHoldingStory = true;
        pauseStory();
    }, 200);
}

// Handle touch move - prevent default for vertical swipes to stop browser actions
function handleStoryTouchMove(e) {
    if (!e.touches || e.touches.length === 0) return;

    const touchCurrentX = e.touches[0].clientX;
    const touchCurrentY = e.touches[0].clientY;

    const deltaX = touchCurrentX - touchStartX;
    const deltaY = touchCurrentY - touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // If moving more vertically than horizontally, prevent default to stop browser gestures
    if (absDeltaY > absDeltaX && absDeltaY > 10) {
        e.preventDefault();
    }
}

// Handle touch end - detect swipe or tap
function handleStoryTouchEnd(e) {
    clearTimeout(holdTimeout);

    // If was holding, resume story
    if (isHoldingStory) {
        isHoldingStory = false;
        resumeStory();
        return;
    }

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const touchDuration = Date.now() - touchStartTime;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Swipe threshold
    const swipeThreshold = 50;

    // Detect swipe direction
    if (absDeltaY > swipeThreshold && absDeltaY > absDeltaX) {
        // Vertical swipe detected - prevent default browser behavior
        e.preventDefault();

        if (deltaY > 0) {
            // Swipe down - exit
            closeStoryViewer();
        } else {
            // Swipe up - exit
            closeStoryViewer();
        }
    } else if (absDeltaX > swipeThreshold && absDeltaX > absDeltaY) {
        // Horizontal swipe detected - prevent default browser behavior
        e.preventDefault();

        if (deltaX > 0) {
            // Swipe right - previous user's stories
            navigateToPreviousUserStories();
        } else {
            // Swipe left - next user's stories
            navigateToNextUserStories();
        }
    }
    // If no swipe detected, the tap handlers on the navigation zones will handle it
}

// Handle touch cancel
function handleStoryTouchCancel() {
    clearTimeout(holdTimeout);
    if (isHoldingStory) {
        isHoldingStory = false;
        resumeStory();
    }
}

// Navigate to next user's stories
function navigateToNextUserStories() {
    if (currentUserGroupIndex < allUserStoryGroups.length - 1) {
        currentUserGroupIndex++;
        const nextUserGroup = allUserStoryGroups[currentUserGroupIndex];
        currentUserStories = nextUserGroup.stories;
        currentUserStoryIndex = 0;
        renderStory();
    } else {
        // No more users, close viewer
        closeStoryViewer();
    }
}

// Navigate to previous user's stories
function navigateToPreviousUserStories() {
    if (currentUserGroupIndex > 0) {
        currentUserGroupIndex--;
        const prevUserGroup = allUserStoryGroups[currentUserGroupIndex];
        currentUserStories = prevUserGroup.stories;
        currentUserStoryIndex = 0;
        renderStory();
    }
}

// Pause current story
function pauseStory() {
    const video = document.getElementById('story-video');

    // Pause video if playing
    if (video && video.style.display !== 'none') {
        video.pause();
    }

    // Pause image progress timer
    if (storyProgressInterval) {
        clearInterval(storyProgressInterval);
    }
}

// Resume current story
function resumeStory() {
    const video = document.getElementById('story-video');
    const story = currentUserStories[currentUserStoryIndex];

    // Resume video if it was playing
    if (video && video.style.display !== 'none') {
        video.play().catch(err => console.log('Resume play error:', err));
    } else {
        // Resume image progress timer
        const activeProgress = document.querySelector('.active-progress');
        if (activeProgress && story) {
            const currentProgress = parseFloat(activeProgress.style.width) || 0;
            const remainingProgress = 100 - currentProgress;
            const duration = story.duration || 5;
            const remainingDuration = (remainingProgress / 100) * duration;

            startStoryProgress(remainingDuration);
        }
    }
}

// Render current story
async function renderStory() {
    if (currentUserStoryIndex >= currentUserStories.length) {
        closeStoryViewer();
        return;
    }

    const story = currentUserStories[currentUserStoryIndex];

    // Update header
    const avatar = document.getElementById('story-user-avatar');
    const name = document.getElementById('story-user-name');
    const timestamp = document.getElementById('story-timestamp');
    const deleteButton = document.getElementById('story-delete-button');

    if (avatar) {
        if (story.profile_photo) {
            avatar.innerHTML = `<img src="${story.profile_photo}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        } else {
            const initial = story.user_name ? story.user_name.charAt(0).toUpperCase() : '?';
            avatar.innerHTML = initial;
        }
    }

    if (name) name.textContent = story.user_name || 'Unknown';
    if (timestamp) {
        const timeAgo = getTimeAgo(new Date(story.created_at));
        timestamp.textContent = timeAgo;
    }

    // Show delete button only for own stories
    if (deleteButton) {
        if (story.user_id === window.currentUser.id) {
            deleteButton.style.display = 'block';
            deleteButton.dataset.storyId = story.story_id;
        } else {
            deleteButton.style.display = 'none';
        }
    }

    // Update progress bars
    renderProgressBars();

    // Update media (image or video)
    const image = document.getElementById('story-image');
    const video = document.getElementById('story-video');

    if (story.media_type === 'video') {
        // Show video, hide image
        if (video) {
            video.src = story.media_url;
            video.style.display = 'block';
            video.currentTime = 0;

            // Play video and handle auto-advance
            video.play().catch(err => console.error('Video play error:', err));

            // Auto-advance when video ends
            video.onended = function() {
                clearInterval(storyProgressInterval);
                nextStory();
            };

            // Update progress as video plays
            video.ontimeupdate = function() {
                const activeProgress = document.querySelector('.active-progress');
                if (activeProgress && video.duration) {
                    const progress = (video.currentTime / video.duration) * 100;
                    activeProgress.style.width = progress + '%';
                }
            };
        }
        if (image) {
            image.style.display = 'none';
        }
    } else {
        // Show image, hide video
        if (image) {
            image.src = story.media_url;
            image.style.display = 'block';
        }
        if (video) {
            video.style.display = 'none';
            video.pause();
            video.src = '';
        }

        // Start progress timer for images
        startStoryProgress(story.duration || 5);
    }

    // Update caption/text overlay
    const captionOverlay = document.getElementById('story-caption-overlay');
    if (captionOverlay) {
        if (story.caption) {
            captionOverlay.textContent = story.caption;
            captionOverlay.style.display = 'block';
            // Center the text overlay like Instagram
            captionOverlay.style.bottom = 'auto';
            captionOverlay.style.top = '50%';
            captionOverlay.style.transform = 'translateY(-50%)';
            captionOverlay.style.background = 'transparent';
            captionOverlay.style.fontSize = '1.5rem';
            captionOverlay.style.fontWeight = '700';
            captionOverlay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
        } else {
            captionOverlay.style.display = 'none';
        }
    }

    // Mark as viewed
    if (!story.has_viewed && story.user_id !== window.currentUser.id) {
        await dbHelpers.stories.markAsViewed(story.story_id, window.currentUser.id);
    }

    // Load viewers if it's own story
    if (story.user_id === window.currentUser.id) {
        await loadStoryViewers(story.story_id);
    } else {
        const viewersSection = document.getElementById('story-viewers-section');
        if (viewersSection) viewersSection.style.display = 'none';
    }
}

// Render progress bars
function renderProgressBars() {
    const container = document.getElementById('story-progress-bars');
    if (!container) return;

    container.innerHTML = '';

    currentUserStories.forEach((story, index) => {
        const bar = document.createElement('div');
        bar.style.cssText = 'flex: 1; height: 3px; background: rgba(255,255,255,0.3); border-radius: 2px; overflow: hidden;';

        const progress = document.createElement('div');
        progress.style.cssText = 'height: 100%; background: white; width: 0%; transition: width 0.1s linear;';
        progress.dataset.storyIndex = index;

        if (index < currentUserStoryIndex) {
            progress.style.width = '100%';
        } else if (index === currentUserStoryIndex) {
            progress.classList.add('active-progress');
        }

        bar.appendChild(progress);
        container.appendChild(bar);
    });
}

// Start story progress animation
function startStoryProgress(duration) {
    clearInterval(storyProgressInterval);

    const activeProgress = document.querySelector('.active-progress');
    if (!activeProgress) return;

    let progress = 0;
    const increment = 100 / (duration * 10); // Update every 100ms

    storyProgressInterval = setInterval(() => {
        progress += increment;
        activeProgress.style.width = progress + '%';

        if (progress >= 100) {
            clearInterval(storyProgressInterval);
            nextStory();
        }
    }, 100);
}

// Navigate to next story
window.nextStory = function() {
    clearInterval(storyProgressInterval);
    currentUserStoryIndex++;
    renderStory();
};

// Navigate to previous story
window.previousStory = function() {
    clearInterval(storyProgressInterval);
    if (currentUserStoryIndex > 0) {
        currentUserStoryIndex--;
        renderStory();
    }
};

// Close story viewer
window.closeStoryViewer = function() {
    clearInterval(storyProgressInterval);

    // Pause any playing video
    const video = document.getElementById('story-video');
    if (video) {
        video.pause();
        video.src = '';
    }

    const modal = document.getElementById('story-viewer-modal');
    if (modal) {
        modal.style.display = 'none';
    }

    // Reload carousel to update viewed status
    loadStoriesCarousel();
};

// Load story viewers
async function loadStoryViewers(storyId) {
    try {
        const viewers = await dbHelpers.stories.getViewers(storyId);

        const viewersSection = document.getElementById('story-viewers-section');
        const viewersList = document.getElementById('story-viewers-list');
        const viewCount = document.getElementById('story-view-count');

        if (!viewersSection || !viewersList) return;

        if (viewers && viewers.length > 0) {
            viewersSection.style.display = 'block';

            if (viewCount) {
                viewCount.textContent = `${viewers.length} ${viewers.length === 1 ? 'view' : 'views'}`;
            }

            viewersList.innerHTML = viewers.map(view => {
                const initial = view.viewer.name ? view.viewer.name.charAt(0).toUpperCase() : '?';
                const avatarContent = view.viewer.profile_photo
                    ? `<img src="${view.viewer.profile_photo}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
                    : initial;

                return `
                    <div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; overflow: hidden;">
                            ${avatarContent}
                        </div>
                        <div style="flex: 1;">
                            <div style="color: white; font-weight: 600; font-size: 0.9rem;">${view.viewer.name || 'Unknown'}</div>
                            <div style="color: rgba(255,255,255,0.6); font-size: 0.75rem;">${getTimeAgo(new Date(view.viewed_at))}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            viewersSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading story viewers:', error);
    }
}

// Delete current story
window.deleteCurrentStory = async function() {
    const deleteButton = document.getElementById('story-delete-button');
    if (!deleteButton || !deleteButton.dataset.storyId) return;

    if (!confirm('Are you sure you want to delete this story?')) return;

    try {
        await dbHelpers.stories.delete(deleteButton.dataset.storyId);

        // Remove from current stories array
        currentUserStories.splice(currentUserStoryIndex, 1);

        if (currentUserStories.length === 0) {
            // No more stories, close viewer
            closeStoryViewer();
        } else {
            // Show next story or previous if at end
            if (currentUserStoryIndex >= currentUserStories.length) {
                currentUserStoryIndex = currentUserStories.length - 1;
            }
            renderStory();
        }

        // Reload carousel
        await loadStoriesCarousel();
    } catch (error) {
        console.error('Error deleting story:', error);
        alert('Failed to delete story. Please try again.');
    }
};

// Get time ago string
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}

// Clean up expired stories
async function cleanupExpiredStories() {
    try {
        const deletedCount = await dbHelpers.stories.cleanupExpired();
        if (deletedCount > 0) {
            console.log(`Cleaned up ${deletedCount} expired stories`);
        }
    } catch (error) {
        console.error('Error cleaning up expired stories:', error);
    }
}

// ============================================
// PHOTO FEED (Instagram/FB style grid)
// ============================================

// Available reactions for feed posts
const FEED_REACTIONS = [
    { key: 'love', emoji: '❤️', label: 'Love' },
    { key: 'muscle', emoji: '💪', label: 'Strong' },
    { key: 'fire', emoji: '🔥', label: 'Fire' },
    { key: 'clap', emoji: '👏', label: 'Clap' },
    { key: 'wow', emoji: '🤩', label: 'Wow' }
];

// Render aesthetic workout/PB card for feed display
window.renderWorkoutCard = function(cardData) {
    if (!cardData) return '<div style="padding:40px; text-align:center; color:#999;">Card data unavailable</div>';

    if (cardData.card_type === 'activity') {
        // Activity Card — blue/cyan gradient
        const intensityLabels = { light: 'Light', moderate: 'Moderate', vigorous: 'Vigorous' };
        const intensityEmojis = { light: '🚶', moderate: '🏃', vigorous: '🔥' };
        const activityEmoji = cardData.emoji || '🏃';
        const activityLabel = cardData.activity_label || cardData.activity_type || 'Activity';
        const duration = cardData.duration || '';
        const intensityLabel = intensityLabels[cardData.intensity] || 'Moderate';
        const intensityEmoji = intensityEmojis[cardData.intensity] || '🏃';
        const calories = cardData.calories || 0;

        return `
            <div style="width:100%; aspect-ratio:4/5; background:linear-gradient(160deg, #0c4a6e 0%, #0284c7 35%, #0ea5e9 70%, #38bdf8 100%); display:flex; flex-direction:column; justify-content:center; align-items:center; padding:30px; box-sizing:border-box; position:relative; overflow:hidden;">
                <div style="position:absolute; top:-30px; right:-30px; font-size:8rem; opacity:0.08; transform:rotate(15deg);">${activityEmoji}</div>
                <div style="position:absolute; bottom:-20px; left:-20px; font-size:6rem; opacity:0.06; transform:rotate(-10deg);">⚡</div>

                <div style="text-align:center; z-index:1;">
                    <div style="font-size:3rem; margin-bottom:8px;">${activityEmoji}</div>
                    <div style="font-size:0.75rem; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.85); margin-bottom:16px;">Activity Complete</div>
                    <div style="width:40px; height:2px; background:rgba(255,255,255,0.4); margin:0 auto 20px;"></div>

                    <div style="font-family:'Playfair Display',serif; font-size:1.6rem; font-weight:700; color:white; margin-bottom:20px; line-height:1.3;">${activityLabel}</div>

                    <div style="display:flex; gap:16px; justify-content:center; margin-bottom:24px;">
                        <div style="text-align:center;">
                            <div style="font-size:1.4rem; font-weight:800; color:white;">⏱ ${duration}</div>
                            <div style="font-size:0.7rem; color:rgba(255,255,255,0.6); margin-top:2px;">Duration</div>
                        </div>
                        <div style="width:1px; background:rgba(255,255,255,0.2);"></div>
                        <div style="text-align:center;">
                            <div style="font-size:1.4rem; font-weight:800; color:white;">${intensityEmoji} ${intensityLabel}</div>
                            <div style="font-size:0.7rem; color:rgba(255,255,255,0.6); margin-top:2px;">Intensity</div>
                        </div>
                    </div>

                    ${calories > 0 ? `
                        <div style="background:rgba(255,255,255,0.15); border-radius:12px; padding:14px 20px; display:inline-block;">
                            <div style="font-size:0.65rem; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Estimated Burn</div>
                            <div style="font-size:1.5rem; font-weight:800; color:white;">${calories} kcal</div>
                        </div>
                    ` : ''}
                </div>

                <div style="position:absolute; bottom:16px; left:0; right:0; text-align:center;">
                    <div style="width:30px; height:1px; background:rgba(255,255,255,0.3); margin:0 auto 8px;"></div>
                    <div style="font-size:0.65rem; color:rgba(255,255,255,0.5); letter-spacing:1px; font-weight:600;">FITGOTCHI 🌱</div>
                </div>
            </div>
        `;
    }

    if (cardData.card_type === 'pb') {
        // PB Card — gold/amber gradient
        const pbValue = cardData.pb_type === 'weight'
            ? `${cardData.value} kg`
            : `${cardData.value} reps`;
        const pbDetail = cardData.pb_type === 'weight'
            ? `× ${cardData.reps} rep${cardData.reps !== 1 ? 's' : ''}`
            : `@ ${cardData.weight || 0} kg`;
        const improvementText = cardData.improvement
            ? `${cardData.pb_type === 'weight' ? '+' + cardData.improvement + ' kg' : '+' + cardData.improvement + ' reps'}`
            : '';
        const previousText = cardData.previous != null
            ? `Previous: ${cardData.previous}${cardData.pb_type === 'weight' ? ' kg' : ' reps'}`
            : '';

        return `
            <div style="width:100%; aspect-ratio:4/5; background:linear-gradient(160deg, #92400e 0%, #d97706 30%, #f59e0b 60%, #fbbf24 100%); display:flex; flex-direction:column; justify-content:center; align-items:center; padding:30px; box-sizing:border-box; position:relative; overflow:hidden;">
                <div style="position:absolute; top:-30px; right:-30px; font-size:8rem; opacity:0.08; transform:rotate(15deg);">🏆</div>
                <div style="position:absolute; bottom:-20px; left:-20px; font-size:6rem; opacity:0.06; transform:rotate(-10deg);">⭐</div>

                <div style="text-align:center; z-index:1;">
                    <div style="font-size:2.8rem; margin-bottom:8px;">🏆</div>
                    <div style="font-size:0.75rem; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.85); margin-bottom:16px;">New Personal Best</div>
                    <div style="width:40px; height:2px; background:rgba(255,255,255,0.4); margin:0 auto 20px;"></div>

                    <div style="font-family:'Playfair Display',serif; font-size:1.4rem; font-weight:700; color:white; margin-bottom:24px; line-height:1.3;">${cardData.exercise || 'Exercise'}</div>

                    <div style="background:rgba(255,255,255,0.15); backdrop-filter:blur(10px); border-radius:16px; padding:20px 24px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.2);">
                        <div style="font-size:2.2rem; font-weight:800; color:white; font-family:'Montserrat',sans-serif;">${pbValue}</div>
                        <div style="font-size:0.95rem; color:rgba(255,255,255,0.85); margin-top:4px;">${pbDetail}</div>
                    </div>

                    ${improvementText ? `
                        <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.2); padding:8px 16px; border-radius:20px; margin-bottom:12px;">
                            <span style="font-size:1.1rem;">↑</span>
                            <span style="font-size:1rem; font-weight:700; color:white;">${improvementText}</span>
                        </div>
                    ` : ''}

                    ${previousText ? `<div style="font-size:0.8rem; color:rgba(255,255,255,0.6); margin-top:8px;">${previousText}</div>` : ''}
                </div>

                <div style="position:absolute; bottom:16px; left:0; right:0; text-align:center;">
                    <div style="width:30px; height:1px; background:rgba(255,255,255,0.3); margin:0 auto 8px;"></div>
                    <div style="font-size:0.65rem; color:rgba(255,255,255,0.5); letter-spacing:1px; font-weight:600;">FITGOTCHI 🌱</div>
                </div>
            </div>
        `;
    }

    // Workout Card — green gradient
    const exercises = cardData.exercises || [];
    const maxDisplay = 6;
    const displayExercises = exercises.slice(0, maxDisplay);
    const remaining = exercises.length - maxDisplay;

    // Build PBs section if present
    let pbsHtml = '';
    if (cardData.pbs && cardData.pbs.length > 0) {
        pbsHtml = cardData.pbs.map(pb => {
            const impText = pb.improvement ? (pb.type === 'weight' ? `+${pb.improvement}kg` : `+${pb.improvement}`) : '';
            return `
                <div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:rgba(251,191,36,0.2); border-radius:8px; border-left:3px solid #fbbf24;">
                    <span style="font-size:0.85rem;">🏆</span>
                    <span style="font-size:0.78rem; color:white; font-weight:600; flex:1;">${pb.exercise}</span>
                    ${impText ? `<span style="font-size:0.75rem; color:#4ade80; font-weight:700;">${impText}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    return `
        <div style="width:100%; aspect-ratio:4/5; background:linear-gradient(160deg, #022c22 0%, #046A38 35%, #059669 70%, #10b981 100%); display:flex; flex-direction:column; padding:28px 24px; box-sizing:border-box; position:relative; overflow:hidden;">
            <div style="position:absolute; top:-40px; right:-40px; font-size:10rem; opacity:0.04; transform:rotate(15deg);">💪</div>
            <div style="position:absolute; bottom:-30px; left:-30px; font-size:7rem; opacity:0.04; transform:rotate(-10deg);">🏋️</div>

            <div style="z-index:1; flex:1; display:flex; flex-direction:column;">
                <!-- Header -->
                <div style="margin-bottom:16px;">
                    <div style="font-size:1.5rem; margin-bottom:6px;">💪</div>
                    <div style="font-size:0.7rem; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.7);">Workout Complete</div>
                </div>

                <div style="width:30px; height:2px; background:rgba(255,255,255,0.3); margin-bottom:14px;"></div>

                <!-- Workout Name -->
                <div style="font-family:'Playfair Display',serif; font-size:1.3rem; font-weight:700; color:white; margin-bottom:4px; line-height:1.3;">${cardData.workout_name || 'Workout'}</div>

                <!-- Stats Row -->
                <div style="display:flex; gap:12px; align-items:center; margin-bottom:16px;">
                    ${cardData.duration ? `<span style="font-size:0.8rem; color:rgba(255,255,255,0.8); font-weight:600;">⏱ ${cardData.duration}</span>` : ''}
                    ${cardData.total_sets ? `<span style="font-size:0.8rem; color:rgba(255,255,255,0.8); font-weight:600;">${cardData.total_sets} sets</span>` : ''}
                </div>

                <!-- Exercises List -->
                <div style="flex:1; display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
                    ${displayExercises.map(ex => `
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
                            <span style="font-size:0.8rem; color:rgba(255,255,255,0.9); font-weight:500;">${ex.name}</span>
                            <span style="font-size:0.75rem; color:rgba(255,255,255,0.6); font-weight:600; white-space:nowrap; margin-left:8px;">${ex.best || ''}</span>
                        </div>
                    `).join('')}
                    ${remaining > 0 ? `<div style="font-size:0.75rem; color:rgba(255,255,255,0.5); padding-top:2px;">+${remaining} more exercise${remaining > 1 ? 's' : ''}</div>` : ''}
                </div>

                <!-- PBs Section -->
                ${pbsHtml ? `<div style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">${pbsHtml}</div>` : ''}

                <!-- Total Volume -->
                ${cardData.total_volume ? `
                    <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:10px 14px; text-align:center; margin-bottom:8px;">
                        <div style="font-size:0.65rem; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Total Volume</div>
                        <div style="font-size:1.1rem; font-weight:800; color:white;">${cardData.total_volume}</div>
                    </div>
                ` : ''}
            </div>

            <div style="text-align:center; z-index:1;">
                <div style="width:30px; height:1px; background:rgba(255,255,255,0.3); margin:0 auto 8px;"></div>
                <div style="font-size:0.65rem; color:rgba(255,255,255,0.5); letter-spacing:1px; font-weight:600;">FITGOTCHI 🌱</div>
            </div>
        </div>
    `;
};

// Load photo feed grid (replaces story carousel on home page)
window.loadPhotoFeed = async function(targetGridId = 'photo-feed-grid', emptyStateId = 'photo-feed-empty') {
    if (!window.currentUser) return;

    try {
        // Get all active stories from extended network
        const stories = await dbHelpers.stories.getNetworkStories(window.currentUser.id);

        const grid = document.getElementById(targetGridId);
        const emptyState = document.getElementById(emptyStateId);

        if (!grid) return;

        if (!stories || stories.length === 0) {
            grid.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Get bulk reactions for all stories
        const storyIds = stories.map(s => s.story_id || s.id);
        let reactionsMap = {};
        try {
            const reactions = await dbHelpers.stories.getBulkReactions(storyIds);
            reactions.forEach(r => {
                if (!reactionsMap[r.story_id]) reactionsMap[r.story_id] = [];
                reactionsMap[r.story_id].push(r);
            });
        } catch (e) {
            console.log('Could not load reactions:', e);
        }

        // Sort by newest first
        const sortedStories = [...stories].sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );

        // Render feed grid
        grid.innerHTML = sortedStories.map(story => {
            const storyId = story.story_id || story.id;
            const isVideo = story.media_type === 'video';
            const isWorkoutCard = story.media_type === 'workout_card';
            const thumbnailSrc = isVideo ? (story.thumbnail_url || story.media_url) : (story.media_url || story.thumbnail_url);
            const initial = story.user_name ? story.user_name.charAt(0).toUpperCase() : '?';
            const timeAgo = getTimeAgo(new Date(story.created_at));

            // Calculate reaction summary
            const storyReactions = reactionsMap[storyId] || [];
            const reactionCounts = {};
            let myReaction = null;
            storyReactions.forEach(r => {
                reactionCounts[r.reaction] = (reactionCounts[r.reaction] || 0) + 1;
                if (r.user_id === window.currentUser.id) myReaction = r.reaction;
            });

            // Build reaction summary display
            const totalReactions = storyReactions.length;
            let reactionSummary = '';
            if (totalReactions > 0) {
                const topReactions = Object.entries(reactionCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([key]) => {
                        const r = FEED_REACTIONS.find(fr => fr.key === key);
                        return r ? r.emoji : '';
                    }).join(' ');
                reactionSummary = `<div style="padding:4px 14px 0; font-size:0.8rem; color:var(--text-main); font-weight:600;">${topReactions} ${totalReactions} reaction${totalReactions !== 1 ? 's' : ''}</div>`;
            }

            // Video play icon overlay
            const videoIcon = isVideo ? `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:44px; height:44px; background:rgba(0,0,0,0.5); border-radius:50%; display:flex; align-items:center; justify-content:center;"><svg viewBox="0 0 24 24" style="width:22px; height:22px; fill:white;"><path d="M8 5v14l11-7z"/></svg></div>` : '';

            // User avatar
            const avatarHtml = story.profile_photo
                ? `<img src="${story.profile_photo}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
                : `<span style="font-size:0.7rem; color:white; font-weight:700;">${initial}</span>`;

            // Caption (skip for workout cards since caption contains JSON data)
            const captionHtml = (story.caption && !isWorkoutCard)
                ? `<div style="padding:4px 14px 8px; font-size:0.85rem; color:var(--text-main); line-height:1.4;"><span style="font-weight:600;">${story.user_name || ''}</span> ${story.caption}</div>`
                : '';

            // Quick reaction buttons for inline feed
            const quickReactions = FEED_REACTIONS.map(r => {
                const isActive = myReaction === r.key;
                return `<button data-reaction="${r.key}" onclick="event.stopPropagation(); toggleFeedReaction('${storyId}', '${r.key}', this)" style="background:none; border:none; padding:4px; cursor:pointer; font-size:1.2rem; opacity:${isActive ? '1' : '0.5'}; transform:${isActive ? 'scale(1.15)' : 'scale(1)'}; transition:all 0.2s;">${r.emoji}</button>`;
            }).join('');

            return `
                <div class="feed-post-card" data-story-id="${storyId}" style="background:white; border-bottom:8px solid #f1f5f9;">
                    <!-- Post header -->
                    <div style="display:flex; align-items:center; padding:10px 14px; gap:10px;">
                        <div style="width:34px; height:34px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; border:2px solid #e5e7eb;">
                            ${avatarHtml}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; font-size:0.85rem; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${story.user_name || 'Unknown'}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted);">${timeAgo}</div>
                        </div>
                    </div>
                    <!-- Full-width media -->
                    ${isWorkoutCard ? (() => {
                        let cardData = null;
                        try { cardData = JSON.parse(story.caption); } catch(e) {}
                        const hasPhoto = story.media_url && story.media_url.length > 10;
                        if (cardData && hasPhoto) {
                            const cId = 'feed-carousel-' + storyId.slice(0, 8);
                            return '<div id="' + cId + '" style="width:100%; overflow:hidden; position:relative; cursor:pointer;" onclick="openFeedPostViewer(\'' + storyId + '\')">' +
                                '<div class="carousel-track" style="display:flex; transition:transform 0.3s ease; width:200%;">' +
                                    '<div style="width:50%; flex-shrink:0;"><img src="' + story.media_url + '" style="width:100%; display:block; object-fit:cover;" loading="lazy"></div>' +
                                    '<div style="width:50%; flex-shrink:0;">' + renderWorkoutCard(cardData) + '</div>' +
                                '</div>' +
                                '<div style="position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; gap:6px; z-index:2;">' +
                                    '<div class="carousel-dot active" style="width:7px; height:7px; border-radius:50%; background:white; opacity:1; transition:opacity 0.2s; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); slideViewerCarousel(\'' + cId + '\', 0)"></div>' +
                                    '<div class="carousel-dot" style="width:7px; height:7px; border-radius:50%; background:white; opacity:0.4; transition:opacity 0.2s; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); slideViewerCarousel(\'' + cId + '\', 1)"></div>' +
                                '</div>' +
                            '</div>';
                        } else if (cardData) {
                            return '<div onclick="openFeedPostViewer(\'' + storyId + '\')" style="cursor:pointer; width:100%;">' + renderWorkoutCard(cardData) + '</div>';
                        }
                        return '<div onclick="openFeedPostViewer(\'' + storyId + '\')" style="cursor:pointer; padding:40px; text-align:center; color:#999;">Card unavailable</div>';
                    })() : `<div onclick="openFeedPostViewer('${storyId}')" style="cursor:pointer; position:relative; background:#000; width:100%;">
                        <img src="${thumbnailSrc}" style="width:100%; display:block; object-fit:cover;" loading="lazy" onerror="this.style.display='none'; this.parentElement.style.minHeight='200px'; this.parentElement.style.background='#f1f5f9';">
                        ${videoIcon}
                    </div>`}
                    <!-- Reaction buttons + comment icon -->
                    <div id="feed-reactions-${storyId}" style="display:flex; align-items:center; padding:6px 10px; gap:2px;">
                        ${quickReactions}
                        <button onclick="event.stopPropagation(); focusFeedComment('${storyId}')" style="background:none; border:none; padding:4px 4px 4px 8px; cursor:pointer; margin-left:auto; opacity:0.6; transition:opacity 0.2s;" aria-label="Comment">
                            <svg viewBox="0 0 24 24" style="width:22px; height:22px; fill:none; stroke:var(--text-main); stroke-width:2; stroke-linecap:round; stroke-linejoin:round;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        </button>
                    </div>
                    <!-- Reaction summary -->
                    <div id="feed-reaction-summary-${storyId}">
                        ${reactionSummary}
                    </div>
                    <!-- Caption -->
                    ${captionHtml}
                    <!-- Inline comments section -->
                    <div id="feed-comments-${storyId}" style="padding:0 14px;"></div>
                    <!-- Comment input -->
                    <div style="display:flex; align-items:center; padding:6px 14px 10px; gap:8px; border-top:1px solid #f1f5f9;">
                        <input id="feed-comment-input-${storyId}" type="text" placeholder="Add a comment..." maxlength="500" style="flex:1; border:none; outline:none; font-size:0.82rem; color:var(--text-main); background:transparent; padding:4px 0;" onkeydown="if(event.key==='Enter'){event.preventDefault(); postFeedComment('${storyId}', this);}" oninput="document.getElementById('feed-comment-btn-${storyId}').style.opacity = this.value.trim() ? '1' : '0.5';">
                        <button onclick="postFeedComment('${storyId}', document.getElementById('feed-comment-input-${storyId}'))" style="background:none; border:none; cursor:pointer; font-size:0.8rem; font-weight:600; color:var(--primary); opacity:0.5; padding:4px 2px; transition:opacity 0.2s;" id="feed-comment-btn-${storyId}">Post</button>
                    </div>
                    <div style="padding:0 14px 10px; font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">${timeAgo}</div>
                </div>
            `;
        }).join('');

        // Initialize touch swipe on any feed carousels
        setTimeout(() => {
            grid.querySelectorAll('[id^="feed-carousel-"]').forEach(carousel => {
                initCarouselSwipe(carousel.id);
            });
        }, 100);

        // Load comments for each post (non-blocking)
        sortedStories.forEach(story => {
            const sid = story.story_id || story.id;
            loadFeedComments(sid);
        });

    } catch (error) {
        console.error('Error loading photo feed:', error);
    }
};

// Open a feed post in full-screen viewer with reactions
window.openFeedPostViewer = async function(storyId) {
    if (!window.currentUser) return;

    try {
        // Find the story in loaded data or fetch it
        const stories = await dbHelpers.stories.getNetworkStories(window.currentUser.id);
        const story = stories.find(s => (s.story_id || s.id) === storyId);

        if (!story) {
            console.error('Story not found:', storyId);
            return;
        }

        const sid = story.story_id || story.id;
        const isVideo = story.media_type === 'video';
        const isWorkoutCard = story.media_type === 'workout_card';
        const initial = story.user_name ? story.user_name.charAt(0).toUpperCase() : '?';
        const timeAgo = getTimeAgo(new Date(story.created_at));
        const isOwn = story.user_id === window.currentUser.id;

        // Get reactions
        let storyReactions = [];
        try {
            storyReactions = await dbHelpers.stories.getReactions(sid);
        } catch (e) {
            console.log('Could not load reactions:', e);
        }

        // Build reaction buttons
        const reactionButtons = FEED_REACTIONS.map(r => {
            const reactionData = storyReactions.find(sr => sr.reaction === r.key);
            const count = reactionData ? reactionData.count : 0;
            const isActive = reactionData && reactionData.reacted_by_me;
            return `<button onclick="toggleFeedReaction('${sid}', '${r.key}', this)" style="background:${isActive ? 'var(--primary)' : '#f1f5f9'}; color:${isActive ? 'white' : 'var(--text-main)'}; border:none; padding:8px 12px; border-radius:20px; cursor:pointer; display:flex; align-items:center; gap:4px; font-size:0.85rem; transition:all 0.2s; font-weight:${isActive ? '700' : '500'};">
                <span>${r.emoji}</span>
                ${count > 0 ? `<span style="font-size:0.75rem;">${count}</span>` : ''}
            </button>`;
        }).join('');

        // User avatar
        const avatarHtml = story.profile_photo
            ? `<img src="${story.profile_photo}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
            : `<span style="color:white; font-weight:700;">${initial}</span>`;

        // Media element — handle workout cards, carousel posts, images, and videos
        let mediaHtml = '';
        if (isWorkoutCard) {
            // Check if this is a carousel post (photo + workout card)
            let cardData = null;
            try { cardData = JSON.parse(story.caption); } catch(e) {}

            if (cardData && story.media_url && story.media_url.length > 10) {
                // Carousel: photo + workout card with swipe dots
                const carouselId = 'viewer-carousel-' + sid.slice(0, 8);
                mediaHtml = `
                    <div id="${carouselId}" style="width:100%; overflow:hidden; position:relative;">
                        <div class="carousel-track" style="display:flex; transition:transform 0.3s ease; width:200%;">
                            <div style="width:50%; flex-shrink:0;">
                                <img src="${story.media_url}" style="width:100%; max-height:70vh; object-fit:contain; background:black;">
                            </div>
                            <div style="width:50%; flex-shrink:0;">
                                ${renderWorkoutCard(cardData)}
                            </div>
                        </div>
                        <div style="position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; gap:6px; z-index:2;">
                            <div class="carousel-dot active" style="width:7px; height:7px; border-radius:50%; background:white; opacity:1; transition:opacity 0.2s; cursor:pointer;" onclick="slideViewerCarousel('${carouselId}', 0)"></div>
                            <div class="carousel-dot" style="width:7px; height:7px; border-radius:50%; background:white; opacity:0.4; transition:opacity 0.2s; cursor:pointer;" onclick="slideViewerCarousel('${carouselId}', 1)"></div>
                        </div>
                    </div>
                `;
            } else if (cardData) {
                // Standalone workout card
                mediaHtml = `<div style="width:100%; max-height:70vh; overflow:auto;">${renderWorkoutCard(cardData)}</div>`;
            } else {
                mediaHtml = '<div style="padding:40px; text-align:center; color:#999;">Card unavailable</div>';
            }
        } else if (isVideo) {
            mediaHtml = `<video src="${story.media_url}" autoplay playsinline controls style="width:100%; max-height:70vh; object-fit:contain; background:black; border-radius:0;"></video>`;
        } else {
            mediaHtml = `<img src="${story.media_url}" style="width:100%; max-height:70vh; object-fit:contain; background:black;">`;
        }

        // Caption (skip for workout cards since caption contains JSON data)
        const captionHtml = (story.caption && !isWorkoutCard)
            ? `<div style="padding:10px 20px; font-size:0.9rem; color:var(--text-main); line-height:1.5;">${story.caption}</div>`
            : '';

        // Delete button for own posts
        const deleteBtn = isOwn
            ? `<button onclick="deleteFeedPost('${sid}')" style="background:none; border:none; color:#ef4444; font-size:0.8rem; font-weight:600; cursor:pointer; padding:4px 8px;">Delete</button>`
            : '';

        // Create or reuse viewer
        let viewer = document.getElementById('feed-post-viewer');
        if (!viewer) {
            viewer = document.createElement('div');
            viewer.id = 'feed-post-viewer';
            document.body.appendChild(viewer);
        }

        viewer.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:10009; display:flex; flex-direction:column; overflow-y:auto;';
        viewer.innerHTML = `
            <!-- Top bar -->
            <div style="display:flex; align-items:center; padding:15px 20px; gap:12px; flex-shrink:0;">
                <div style="width:40px; height:40px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
                    ${avatarHtml}
                </div>
                <div style="flex:1;">
                    <div style="color:white; font-weight:600; font-size:0.95rem;">${story.user_name || 'Unknown'}</div>
                    <div style="color:rgba(255,255,255,0.6); font-size:0.75rem;">${timeAgo}</div>
                </div>
                ${deleteBtn}
                <button onclick="closeFeedPostViewer()" style="background:none; border:none; color:white; font-size:1.8rem; cursor:pointer; line-height:1;">&times;</button>
            </div>

            <!-- Media -->
            <div style="flex:1; display:flex; align-items:center; justify-content:center; ${isWorkoutCard ? '' : 'background:black;'}">
                ${mediaHtml}
            </div>

            ${captionHtml ? `<div style="background:white;">${captionHtml}</div>` : ''}

            <!-- Reactions -->
            <div style="padding:12px 20px; background:white; display:flex; gap:8px; flex-wrap:wrap; align-items:center; border-top:1px solid #f1f5f9;">
                ${reactionButtons}
            </div>
        `;

        // Initialize swipe on viewer carousel if present
        const viewerCarousel = viewer.querySelector('[id^="viewer-carousel-"]');
        if (viewerCarousel) {
            initCarouselSwipe(viewerCarousel.id);
        }

        // Mark as viewed
        if (!story.has_viewed && story.user_id !== window.currentUser.id) {
            await dbHelpers.stories.markAsViewed(sid, window.currentUser.id);
        }

    } catch (error) {
        console.error('Error opening feed post:', error);
    }
};

// Close feed post viewer
window.closeFeedPostViewer = function() {
    const viewer = document.getElementById('feed-post-viewer');
    if (viewer) {
        // Pause any video
        const video = viewer.querySelector('video');
        if (video) {
            video.pause();
            video.src = '';
        }
        viewer.style.display = 'none';
        viewer.innerHTML = '';
    }
};

// Slide carousel to a specific index (0 = photo, 1 = workout card)
window.slideViewerCarousel = function(carouselId, index) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    const track = carousel.querySelector('.carousel-track');
    if (track) {
        track.style.transform = `translateX(-${index * 50}%)`;
    }
    // Update dots
    const dots = carousel.querySelectorAll('.carousel-dot');
    dots.forEach((dot, i) => {
        dot.style.opacity = i === index ? '1' : '0.4';
        if (i === index) dot.classList.add('active');
        else dot.classList.remove('active');
    });
};

// Initialize touch swipe on a carousel
window.initCarouselSwipe = function(carouselId) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    if (carousel.dataset.swipeInit) return;
    carousel.dataset.swipeInit = 'true';
    let startX = 0;
    let currentSlide = 0;

    carousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            if (diff > 0 && currentSlide === 0) { currentSlide = 1; }
            else if (diff < 0 && currentSlide === 1) { currentSlide = 0; }
            slideViewerCarousel(carouselId, currentSlide);
        }
    }, { passive: true });
};

// Toggle a reaction on a feed post (works inline on feed + in viewer)
window.toggleFeedReaction = async function(storyId, reactionKey, buttonEl) {
    if (!window.currentUser) return;

    // Optimistic UI update on the feed card
    const reactionsContainer = document.getElementById('feed-reactions-' + storyId);
    if (reactionsContainer) {
        const buttons = reactionsContainer.querySelectorAll('button[data-reaction]');
        const clickedBtn = [...buttons].find(b => b.dataset.reaction === reactionKey);
        const wasActive = clickedBtn && clickedBtn.style.opacity === '1';
        buttons.forEach(btn => {
            if (btn.dataset.reaction === reactionKey && !wasActive) {
                btn.style.opacity = '1';
                btn.style.transform = 'scale(1.15)';
            } else {
                btn.style.opacity = '0.5';
                btn.style.transform = 'scale(1)';
            }
        });
    }

    try {
        const result = await dbHelpers.stories.toggleReaction(storyId, window.currentUser.id, reactionKey);

        // If we're in the full-screen viewer, refresh it
        const viewer = document.getElementById('feed-post-viewer');
        if (viewer && viewer.style.display !== 'none' && viewer.dataset.storyId === storyId) {
            openFeedPostViewer(storyId);
            return;
        }

        // Otherwise update the feed card inline
        await updateFeedCardReactions(storyId);
    } catch (error) {
        console.error('Error toggling reaction:', error);
    }
};

// Update reaction buttons + summary for a single feed card without reloading
window.updateFeedCardReactions = async function(storyId) {
    try {
        const reactions = await dbHelpers.stories.getBulkReactions([storyId]);
        let myReaction = null;
        const reactionCounts = {};
        reactions.forEach(r => {
            reactionCounts[r.reaction] = (reactionCounts[r.reaction] || 0) + 1;
            if (r.user_id === window.currentUser.id) myReaction = r.reaction;
        });

        // Update buttons
        const container = document.getElementById('feed-reactions-' + storyId);
        if (container) {
            container.querySelectorAll('button[data-reaction]').forEach(btn => {
                const key = btn.dataset.reaction;
                const isActive = myReaction === key;
                btn.style.opacity = isActive ? '1' : '0.5';
                btn.style.transform = isActive ? 'scale(1.15)' : 'scale(1)';
            });
        }

        // Update summary
        const summaryEl = document.getElementById('feed-reaction-summary-' + storyId);
        if (summaryEl) {
            const totalReactions = reactions.length;
            if (totalReactions > 0) {
                const topReactions = Object.entries(reactionCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([key]) => {
                        const r = FEED_REACTIONS.find(fr => fr.key === key);
                        return r ? r.emoji : '';
                    }).join(' ');
                summaryEl.innerHTML = `<div style="padding:4px 14px 0; font-size:0.8rem; color:var(--text-main); font-weight:600;">${topReactions} ${totalReactions} reaction${totalReactions !== 1 ? 's' : ''}</div>`;
            } else {
                summaryEl.innerHTML = '';
            }
        }
    } catch (e) {
        console.log('Error updating feed reactions:', e);
    }
};

// ============================================
// INLINE FEED COMMENTS
// ============================================

// Focus the comment input for a post
window.focusFeedComment = function(storyId) {
    const input = document.getElementById('feed-comment-input-' + storyId);
    if (input) input.focus();
};

// Post a comment on a feed post
window.postFeedComment = async function(storyId, inputEl) {
    if (!window.currentUser || !inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;

    // Disable input while posting
    inputEl.disabled = true;
    const btn = document.getElementById('feed-comment-btn-' + storyId);
    if (btn) btn.style.opacity = '0.3';

    try {
        await dbHelpers.stories.addComment(storyId, window.currentUser.id, text);
        inputEl.value = '';
        // Reload comments for this post
        await loadFeedComments(storyId);
    } catch (error) {
        console.error('Error posting comment:', error);
    } finally {
        inputEl.disabled = false;
        if (btn) btn.style.opacity = '0.5';
    }
};

// Load and render comments for a single feed post
window.loadFeedComments = async function(storyId) {
    const container = document.getElementById('feed-comments-' + storyId);
    if (!container) return;

    try {
        const comments = await dbHelpers.stories.getComments(storyId, 3);
        if (!comments || comments.length === 0) {
            container.innerHTML = '';
            return;
        }

        // Show in chronological order (oldest first) for the preview
        const sorted = [...comments].reverse();
        const totalCount = comments.length;

        let html = '';
        // If there might be more comments, show a "view all" link
        if (totalCount >= 3) {
            html += `<div onclick="loadAllFeedComments('${storyId}')" style="font-size:0.78rem; color:var(--text-muted); cursor:pointer; padding:2px 0 4px;">View more comments</div>`;
        }
        sorted.forEach(c => {
            const commentTimeAgo = getTimeAgo(new Date(c.created_at));
            const isOwn = c.user_id === window.currentUser.id;
            html += `<div style="padding:2px 0; font-size:0.82rem; line-height:1.35; display:flex; gap:4px; align-items:baseline;">
                <span style="font-weight:600; color:var(--text-main); flex-shrink:0;">${c.user_name || 'Unknown'}</span>
                <span style="color:var(--text-main); word-break:break-word; flex:1;">${escapeHtml(c.comment_text)}</span>
                ${isOwn ? `<button onclick="deleteFeedComment('${c.comment_id}', '${storyId}')" style="background:none; border:none; cursor:pointer; font-size:0.65rem; color:var(--text-muted); padding:0 2px; flex-shrink:0;" aria-label="Delete">&times;</button>` : ''}
            </div>`;
        });
        container.innerHTML = html;
    } catch (error) {
        console.log('Could not load comments:', error);
    }
};

// Load all comments for a post (expanded view)
window.loadAllFeedComments = async function(storyId) {
    const container = document.getElementById('feed-comments-' + storyId);
    if (!container) return;

    try {
        const comments = await dbHelpers.stories.getComments(storyId, 50);
        if (!comments || comments.length === 0) {
            container.innerHTML = '';
            return;
        }

        const sorted = [...comments].reverse();
        let html = '';
        sorted.forEach(c => {
            const isOwn = c.user_id === window.currentUser.id;
            html += `<div style="padding:2px 0; font-size:0.82rem; line-height:1.35; display:flex; gap:4px; align-items:baseline;">
                <span style="font-weight:600; color:var(--text-main); flex-shrink:0;">${c.user_name || 'Unknown'}</span>
                <span style="color:var(--text-main); word-break:break-word; flex:1;">${escapeHtml(c.comment_text)}</span>
                ${isOwn ? `<button onclick="deleteFeedComment('${c.comment_id}', '${storyId}')" style="background:none; border:none; cursor:pointer; font-size:0.65rem; color:var(--text-muted); padding:0 2px; flex-shrink:0;" aria-label="Delete">&times;</button>` : ''}
            </div>`;
        });
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading all comments:', error);
    }
};

// Delete own comment
window.deleteFeedComment = async function(commentId, storyId) {
    if (!window.currentUser) return;
    try {
        await dbHelpers.stories.deleteComment(commentId);
        await loadFeedComments(storyId);
    } catch (error) {
        console.error('Error deleting comment:', error);
    }
};

// Simple HTML escape for comment text
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Delete a feed post
window.deleteFeedPost = async function(storyId) {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
        await dbHelpers.stories.delete(storyId);
        closeFeedPostViewer();
        // Refresh feeds
        loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post. Please try again.');
    }
};

// ============================================
// MESSAGES PANEL (Group Chats + Friends)
// ============================================

window.openFeedMessagesPanel = function() {
    const panel = document.getElementById('feed-messages-panel');
    if (panel) {
        panel.style.display = 'block';
        loadMessagesPanel();
    }
};

window.closeFeedMessagesPanel = function() {
    const panel = document.getElementById('feed-messages-panel');
    if (panel) {
        panel.style.display = 'none';
    }
};

// Load the messages panel content
async function loadMessagesPanel() {
    // Load group chats into panel
    try {
        const { data: chats, error } = await window.supabaseClient
            .rpc('get_user_group_chats', { user_uuid: window.currentUser.id });

        const container = document.getElementById('panel-group-chats');
        if (container) {
            if (!chats || chats.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:15px; color:var(--text-muted); font-size:0.85rem;">
                        <div style="margin-bottom:8px;">No group chats yet</div>
                        <button onclick="openCreateGroupChatModal(); closeFeedMessagesPanel();" style="background:var(--primary); color:white; border:none; padding:8px 16px; border-radius:8px; font-size:0.8rem; font-weight:600; cursor:pointer;">Create Chat</button>
                    </div>`;
            } else {
                container.innerHTML = chats.map(chat => `
                    <div onclick="openGroupChat('${chat.id}'); closeFeedMessagesPanel();" style="display:flex; align-items:center; padding:10px 12px; cursor:pointer; border-radius:10px; background:#f8fafc; transition:background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                        <div style="width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg, var(--primary), #10b981); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:0.9rem; margin-right:10px; flex-shrink:0;">
                            ${chat.name ? chat.name.charAt(0).toUpperCase() : 'G'}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; font-size:0.9rem; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${chat.name || 'Group Chat'}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${chat.member_count || 0} members</div>
                        </div>
                        <svg viewBox="0 0 24 24" style="width:16px; height:16px; fill:var(--text-muted); flex-shrink:0;"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                    </div>
                `).join('');
            }
        }
    } catch (e) {
        console.error('Error loading panel group chats:', e);
    }

    // Load friends into panel
    try {
        const { data: friends, error } = await window.supabaseClient
            .rpc('get_friends_with_status', { user_uuid: window.currentUser.id });

        const container = document.getElementById('panel-friends-list');
        const countLabel = document.getElementById('panel-friends-count');

        if (countLabel) {
            const count = friends ? friends.length : 0;
            countLabel.textContent = count === 0 ? '0 friends' : count === 1 ? '1 friend' : `${count} friends`;
        }

        if (container && friends && friends.length > 0) {
            container.innerHTML = friends.map(friend => {
                const initial = friend.name ? friend.name.charAt(0).toUpperCase() : '?';
                const avatarHtml = friend.profile_photo
                    ? `<img src="${friend.profile_photo}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
                    : `<span style="color:white; font-weight:700; font-size:0.85rem;">${initial}</span>`;

                // Status indicators
                let statusDot = '';
                if (friend.has_workout_today || friend.has_meal_today) {
                    statusDot = `<div style="position:absolute; bottom:1px; right:1px; width:10px; height:10px; background:#22c55e; border-radius:50%; border:2px solid white;"></div>`;
                }

                return `
                    <div onclick="openDirectMessage('${friend.friend_id}', '${(friend.name || '').replace(/'/g, "\\'")}'); closeFeedMessagesPanel();" style="display:flex; align-items:center; padding:10px 0; cursor:pointer; border-bottom:1px solid #f8fafc;">
                        <div style="position:relative; margin-right:10px;">
                            <div style="width:40px; height:40px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; overflow:hidden;">
                                ${avatarHtml}
                            </div>
                            ${statusDot}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; font-size:0.9rem; color:var(--text-main);">${friend.name || 'Unknown'}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted);">${friend.current_streak ? friend.current_streak + ' day streak' : ''}</div>
                        </div>
                        <svg viewBox="0 0 24 24" style="width:18px; height:18px; fill:var(--text-muted);"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                    </div>
                `;
            }).join('');
        } else if (container) {
            container.innerHTML = `
                <div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">
                    <div style="margin-bottom:8px;">No friends yet</div>
                    <button onclick="openAddFriendModal(); closeFeedMessagesPanel();" style="background:var(--primary); color:white; border:none; padding:8px 16px; border-radius:8px; font-size:0.8rem; font-weight:600; cursor:pointer;">Add Friends</button>
                </div>`;
        }
    } catch (e) {
        console.error('Error loading panel friends:', e);
    }
}

// Close panel when clicking the backdrop
if (typeof document !== 'undefined') {
    document.addEventListener('click', function(e) {
        const panel = document.getElementById('feed-messages-panel');
        const content = document.getElementById('feed-messages-panel-content');
        if (panel && panel.style.display !== 'none' && e.target === panel) {
            closeFeedMessagesPanel();
        }
    });
}

// Initialize stories on page load
if (typeof window.addEventListener !== 'undefined') {
    window.addEventListener('load', function() {
        if (window.currentUser) {
            // Clean up expired stories first
            cleanupExpiredStories().catch(e => console.warn('Init error:', e));

            // Load photo feed (friends/feed page)
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty').catch(e => console.warn('Init error:', e));

            // Load stories carousel (hidden, for compatibility)
            loadStoriesCarousel().catch(e => console.warn('Init error:', e));

            // Refresh feeds every 5 minutes
            setInterval(function() {
                loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
                loadStoriesCarousel();
            }, 5 * 60 * 1000);

            // Clean up expired stories every hour
            setInterval(cleanupExpiredStories, 60 * 60 * 1000);
        }
    });
}
