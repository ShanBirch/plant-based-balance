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
                        canvas.width = 200; // Thumbnail width
                        canvas.height = 200; // Thumbnail height

                        const ctx = canvas.getContext('2d');

                        // Calculate dimensions to crop to square
                        const size = Math.min(video.videoWidth, video.videoHeight);
                        const x = (video.videoWidth - size) / 2;
                        const y = (video.videoHeight - size) / 2;

                        // Draw cropped video frame to canvas
                        ctx.drawImage(video, x, y, size, size, 0, 0, 200, 200);

                        // Convert canvas to base64
                        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);

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
                        canvas.width = 200;
                        canvas.height = 200;

                        const ctx = canvas.getContext('2d');

                        // Calculate dimensions to crop to square
                        const size = Math.min(img.width, img.height);
                        const x = (img.width - size) / 2;
                        const y = (img.height - size) / 2;

                        // Draw cropped image to canvas
                        ctx.drawImage(img, x, y, size, size, 0, 0, 200, 200);

                        // Convert canvas to base64
                        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);

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

        // Reload stories carousel
        await loadStoriesCarousel();

        // Show success message
        alert('Story posted!' + pointsMessage);

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
        alert('You must be logged in to share a story.');
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

        // Reload stories carousel
        await loadStoriesCarousel();

        // Show success message
        alert('Story shared successfully!');

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

// Initialize stories on page load
if (typeof window.addEventListener !== 'undefined') {
    window.addEventListener('load', function() {
        if (window.currentUser) {
            // Clean up expired stories first
            cleanupExpiredStories();

            // Load stories carousel
            loadStoriesCarousel();

            // Refresh stories every 5 minutes
            setInterval(loadStoriesCarousel, 5 * 60 * 1000);

            // Clean up expired stories every hour
            setInterval(cleanupExpiredStories, 60 * 60 * 1000);
        }
    });
}
