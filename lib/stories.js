// --- STORIES FEATURE ---

let currentStories = [];
let currentStoryIndex = 0;
let currentUserStories = [];
let currentUserStoryIndex = 0;
let storyProgressInterval = null;
let selectedStoryFile = null;
let feedComposerFile = null;
let feedComposerPreviewUrl = null;
let allUserStoryGroups = []; // Store all user groups for swipe navigation
let currentUserGroupIndex = 0; // Current user group being viewed
let feedMentionState = null;
let feedMentionSearchTimer = null;
let feedMentionFriendsCache = null;
let feedMentionSearchCache = {};
const FEED_PAGE_SIZE = 8;
const FEED_PAGE_FETCH_SIZE = FEED_PAGE_SIZE + 1;
const FEED_PREFETCH_ROOT_MARGIN = '700px 0px';
const STORIES_CAROUSEL_FETCH_LIMIT = 50;
const feedPaginationStates = new Map();

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

function isInlineDataUrl(value) {
    return /^data:/i.test(String(value || '').trim());
}

function getPublicFeedMediaUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || isInlineDataUrl(raw)) return '';
    return raw;
}

function isFeedUploadVideoContentType(value) {
    return /^video\//i.test(String(value || '').trim());
}

function isFeedUploadImageContentType(value) {
    return /^image\//i.test(String(value || '').trim());
}

function assertFeedUploadMatchesMediaType(mediaType, file, uploadData) {
    const expectedType = String(mediaType || '').toLowerCase();
    if (expectedType !== 'video') return;

    const uploadContentType = String(uploadData && uploadData.contentType || '').trim();
    const fileContentType = String(file && file.type || '').trim();

    if (isFeedUploadImageContentType(uploadContentType) || isFeedUploadImageContentType(fileContentType)) {
        throw new Error('That clip saved as a photo instead of a video. Please record it again.');
    }

    if (uploadContentType && !isFeedUploadVideoContentType(uploadContentType)) {
        throw new Error('That clip did not save as a video. Please record it again.');
    }
}

function feedThumbnailDataUrlToFile(dataUrl, fileName = 'feed-video-thumbnail.jpg') {
    const raw = String(dataUrl || '').trim();
    if (!isInlineDataUrl(raw) || !raw.includes(',')) return null;

    const [header, payload] = raw.split(',', 2);
    const mimeMatch = header.match(/^data:([^;]+);base64/i);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    if (typeof File !== 'undefined') {
        return new File([bytes], fileName, { type: mimeType, lastModified: Date.now() });
    }

    const blob = new Blob([bytes], { type: mimeType });
    blob.name = fileName;
    return blob;
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

const FEED_VIDEO_UPLOAD_TARGET_BYTES = 4 * 1024 * 1024;
const PHONE_VIDEO_PRIMARY_MAX_DIMENSION = 720;
const PHONE_VIDEO_FALLBACK_MAX_DIMENSION = 540;
const PHONE_VIDEO_FINAL_MAX_DIMENSION = 360;

function formatUploadSize(bytes) {
    return `${Math.max(1, Math.round((Number(bytes) || 0) / (1024 * 1024)))}MB`;
}

function isRecorderMimeSupported(mimeType) {
    try {
        return !mimeType || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mimeType));
    } catch (_) {
        return false;
    }
}

function getVideoRecorderOptions(videoBitsPerSecond) {
    const candidates = [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
    ];

    for (const mimeType of candidates) {
        if (isRecorderMimeSupported(mimeType)) {
            return { mimeType, videoBitsPerSecond };
        }
    }

    return { videoBitsPerSecond };
}

function getVideoExtensionForMimeType(mimeType, fallbackName) {
    const type = String(mimeType || '').toLowerCase();
    if (type.includes('mp4')) return 'mp4';
    if (type.includes('webm')) return 'webm';
    const rawExt = String(fallbackName || '').split('.').pop() || '';
    const cleanExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanExt || 'mp4';
}

function buildCompressedVideoName(file, mimeType) {
    const original = String(file?.name || 'workout-set').replace(/\.[^.]+$/, '');
    const safeBase = (original.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'workout-set').slice(0, 70);
    return `${safeBase}-mobile.${getVideoExtensionForMimeType(mimeType, file?.name)}`;
}

// Compress video to phone-friendly dimensions before upload.
async function compressVideo(file, onProgress, options = {}) {
    return new Promise((resolve) => {
        const fileSizeMB = file.size / (1024 * 1024);
        const force = options.force === true;
        const maxBytes = Number(options.maxBytes || 0);
        if (!force && maxBytes && file.size <= maxBytes) {
            console.log('Video already fits upload target, skipping compression');
            resolve(file);
            return;
        }
        if (!force && !maxBytes && fileSizeMB < 3) {
            console.log('Video already small, skipping compression');
            resolve(file);
            return;
        }

        if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
            console.warn('Video compression is not available in this browser');
            resolve(file);
            return;
        }

        const maxDimension = Number(options.maxDimension || PHONE_VIDEO_PRIMARY_MAX_DIMENSION);
        const frameRate = Number(options.frameRate || 24);
        let videoBitsPerSecond = Number(options.videoBitsPerSecond || 1200000);
        const label = options.label || 'Compressing for phone...';

        console.log(`Compressing video: ${fileSizeMB.toFixed(1)}MB`);
        if (onProgress) onProgress('Loading video...');

        const video = document.createElement('video');
        const objectUrl = URL.createObjectURL(file);
        let settled = false;
        let recorder = null;
        let frameHandle = 0;

        function cleanup() {
            if (frameHandle) cancelAnimationFrame(frameHandle);
            try { URL.revokeObjectURL(objectUrl); } catch (_) {}
            try { video.pause(); } catch (_) {}
            video.removeAttribute('src');
            video.load();
        }

        function finish(result) {
            if (settled) return;
            settled = true;
            cleanup();
            resolve(result || file);
        }

        function stopRecorder() {
            if (!recorder || recorder.state === 'inactive') return;
            try {
                recorder.stop();
            } catch (error) {
                console.warn('Could not stop video recorder:', error);
                finish(file);
            }
        }

        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');

        video.onloadedmetadata = async function() {
            try {
                let targetWidth = video.videoWidth || maxDimension;
                let targetHeight = video.videoHeight || maxDimension;

                if (targetWidth >= targetHeight && targetWidth > maxDimension) {
                    targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
                    targetWidth = maxDimension;
                } else if (targetHeight > maxDimension) {
                    targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
                    targetHeight = maxDimension;
                }

                targetWidth = Math.max(2, Math.round(targetWidth / 2) * 2);
                targetHeight = Math.max(2, Math.round(targetHeight / 2) * 2);
                if (options.targetBytes && video.duration && Number.isFinite(video.duration)) {
                    const targetBudget = Math.floor((Number(options.targetBytes) * 8 * 0.82) / Math.max(1, video.duration));
                    const minBitrate = Number(options.minVideoBitsPerSecond || 260000);
                    videoBitsPerSecond = Math.max(minBitrate, Math.min(videoBitsPerSecond, targetBudget));
                }

                console.log(`Resizing from ${video.videoWidth}x${video.videoHeight} to ${targetWidth}x${targetHeight}`);
                if (onProgress) onProgress(label);

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx || typeof canvas.captureStream !== 'function') {
                    finish(file);
                    return;
                }

                const canvasStream = canvas.captureStream(frameRate);
                const recorderOptions = getVideoRecorderOptions(videoBitsPerSecond);
                recorder = new MediaRecorder(canvasStream, recorderOptions);
                const chunks = [];

                recorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) chunks.push(event.data);
                };

                recorder.onstop = () => {
                    const mimeType = recorder.mimeType || recorderOptions.mimeType || (chunks[0] && chunks[0].type) || 'video/mp4';
                    const blob = new Blob(chunks, { type: mimeType });
                    if (!blob.size) {
                        finish(file);
                        return;
                    }

                    const compressedFile = new File([blob], buildCompressedVideoName(file, mimeType), {
                        type: mimeType,
                        lastModified: Date.now()
                    });
                    const newSizeMB = compressedFile.size / (1024 * 1024);
                    console.log(`Compressed: ${fileSizeMB.toFixed(1)}MB to ${newSizeMB.toFixed(1)}MB`);
                    finish(compressedFile.size < file.size || force ? compressedFile : file);
                };

                recorder.onerror = (event) => {
                    console.error('MediaRecorder error:', event);
                    finish(file);
                };

                const drawFrame = () => {
                    if (settled) return;
                    if (video.ended || video.paused) {
                        stopRecorder();
                        return;
                    }
                    try {
                        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
                    } catch (error) {
                        console.error('Video draw error:', error);
                        stopRecorder();
                        return;
                    }
                    frameHandle = requestAnimationFrame(drawFrame);
                };

                video.onended = stopRecorder;
                video.ontimeupdate = () => {
                    if (onProgress && video.duration) {
                        const percent = Math.max(1, Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
                        onProgress(`Compressing... ${percent}%`);
                    }
                };

                recorder.start(1000);
                video.currentTime = 0;
                await video.play();
                drawFrame();
            } catch (error) {
                console.error('Video compression error:', error);
                finish(file);
            }
        };

        video.onerror = function() {
            console.error('Failed to load video for compression');
            finish(file);
        };

        video.src = objectUrl;
        video.load();
    });
}

async function prepareUploadableVideo(file, onProgress, options = {}) {
    let fileToUpload = file;
    const maxBytes = Number(options.maxBytes || FEED_VIDEO_UPLOAD_TARGET_BYTES);

    if (onProgress) onProgress(`Preparing ${formatUploadSize(file.size)} clip...`);
    fileToUpload = await compressVideo(fileToUpload, onProgress, {
        maxBytes,
        targetBytes: maxBytes,
        maxDimension: PHONE_VIDEO_PRIMARY_MAX_DIMENSION,
        frameRate: 24,
        videoBitsPerSecond: 1100000,
        minVideoBitsPerSecond: 420000,
        label: 'Compressing to phone HD...'
    });

    if (fileToUpload.size > maxBytes) {
        if (onProgress) onProgress('Shrinking a bit more...');
        fileToUpload = await compressVideo(fileToUpload, onProgress, {
            force: true,
            maxBytes,
            targetBytes: maxBytes,
            maxDimension: PHONE_VIDEO_FALLBACK_MAX_DIMENSION,
            frameRate: 24,
            videoBitsPerSecond: 720000,
            minVideoBitsPerSecond: 300000,
            label: 'Compressing for upload...'
        });
    }

    if (fileToUpload.size > maxBytes) {
        if (onProgress) onProgress('Making the upload smaller...');
        fileToUpload = await compressVideo(fileToUpload, onProgress, {
            force: true,
            maxBytes,
            targetBytes: maxBytes,
            maxDimension: PHONE_VIDEO_FINAL_MAX_DIMENSION,
            frameRate: 20,
            videoBitsPerSecond: 520000,
            minVideoBitsPerSecond: 220000,
            label: 'Final upload pass...'
        });
    }

    if (fileToUpload.size > maxBytes) {
        throw new Error('Could not shrink that video enough for mobile upload. Try trimming it to just the set.');
    }

    return fileToUpload;
}

window.prepareUploadableFeedVideo = async function(file, onProgress, options = {}) {
    return prepareUploadableVideo(file, onProgress, {
        ...options,
        maxBytes: Number(options.maxBytes || FEED_VIDEO_UPLOAD_TARGET_BYTES)
    });
};

window.getFeedVideoUploadTargetBytes = function() {
    return FEED_VIDEO_UPLOAD_TARGET_BYTES;
};

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
        const stories = await dbHelpers.stories.getNetworkStories(window.currentUser.id, {
            limit: STORIES_CAROUSEL_FETCH_LIMIT,
            offset: 0
        });

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

    // For photos, use the getUserMedia camera modal (file input opens gallery in Capacitor WebView)
    if (type === 'photo' && typeof openWorkoutCamera === 'function') {
        openWorkoutCamera(function(file) {
            if (!file) return;
            console.log('Story photo captured via getUserMedia:', file.name, file.type, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
            selectedStoryFile = file;

            const reader = new FileReader();
            reader.onload = function(e) {
                showNativePreviewModal(e.target.result, 'image');
            };
            reader.onerror = function(error) {
                console.error('FileReader error:', error);
                alert('Failed to load file. Please try again.');
            };
            reader.readAsDataURL(file);
        }, 'Take a story photo');
        return;
    }

    // For video (or fallback if openWorkoutCamera not available), use file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';

    if (type === 'photo') {
        fileInput.accept = 'image/*';
        fileInput.capture = 'environment';
    } else if (type === 'video') {
        fileInput.accept = 'video/*';
        fileInput.capture = 'environment';
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

        const tempStoryId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        const uploadData = await uploadStoryMediaToBackblaze(selectedStoryFile, {
            userId: window.currentUser.id,
            storyId: tempStoryId,
            source: 'feed_capture',
            postBtn
        });
        const mediaUrl = uploadData.url;

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

                const analysisDataUrl = await readFeedComposerFileAsDataUrl(selectedStoryFile);
                const imageBase64 = getBase64Payload(analysisDataUrl);

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

        await archiveFeedMediaAsset({
            story,
            userId: window.currentUser.id,
            mediaType,
            mediaUrl,
            thumbnailUrl,
            caption: storyTextOverlay || null,
            uploadData,
            mimeType: selectedStoryFile.type,
            source: 'feed_capture'
        });

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

        const tempStoryId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
        console.log('Story ID:', tempStoryId);

        const uploadData = await uploadStoryMediaToBackblaze(selectedStoryFile, {
            userId: window.currentUser.id,
            storyId: tempStoryId,
            source: 'feed_upload',
            postBtn: uploadButton
        });
        const mediaUrl = uploadData.url;
        console.log('Uploaded to B2:', uploadData);

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

        await archiveFeedMediaAsset({
            story,
            userId: window.currentUser.id,
            mediaType,
            mediaUrl,
            thumbnailUrl,
            caption: caption ? caption.value.trim() : null,
            uploadData,
            mimeType: selectedStoryFile.type,
            source: 'feed_upload'
        });

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

const FEED_MENTION_PROFILE_CACHE_KEY = 'pbb_feed_mention_profiles_v1';

function getFeedMentionHandle(raw) {
    const source = String(raw?.handle || raw?.name || raw?.user_name || raw?.friend_name || raw?.email || raw?.user_email || '').trim();
    const namePart = source.includes('@') ? source.split('@')[0] : source;
    return namePart
        .replace(/&amp;/g, 'and')
        .replace(/[^A-Za-z0-9_]+/g, '')
        .slice(0, 32);
}

function normalizeFeedMentionProfile(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const id = raw.id || raw.user_id || raw.friend_id || raw.profile_id || '';
    const name = raw.name || raw.user_name || raw.friend_name || raw.display_name || raw.full_name || raw.email || raw.user_email || '';
    const photo = raw.profile_photo || raw.user_photo || raw.friend_photo || raw.photo || '';
    const handle = getFeedMentionHandle({ name, email: raw.email || raw.user_email || '', handle: raw.handle });

    if (!id || !handle) return null;
    return {
        id: String(id),
        name: String(name || handle),
        photo: String(photo || ''),
        handle
    };
}

function getFeedMentionProfilesByHandle() {
    if (!window.pbbFeedMentionProfilesByHandle || typeof window.pbbFeedMentionProfilesByHandle !== 'object') {
        window.pbbFeedMentionProfilesByHandle = {};
        try {
            const cached = JSON.parse(localStorage.getItem(FEED_MENTION_PROFILE_CACHE_KEY) || '{}');
            if (cached && typeof cached === 'object') {
                window.pbbFeedMentionProfilesByHandle = cached;
            }
        } catch (_) {}
    }
    return window.pbbFeedMentionProfilesByHandle;
}

function persistFeedMentionProfiles() {
    try {
        const cache = getFeedMentionProfilesByHandle();
        const entries = Object.entries(cache).slice(-120);
        localStorage.setItem(FEED_MENTION_PROFILE_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch (_) {}
}

function rememberFeedMentionProfile(raw) {
    const profile = normalizeFeedMentionProfile(raw);
    if (!profile) return null;

    const cache = getFeedMentionProfilesByHandle();
    cache[profile.handle.toLowerCase()] = profile;
    persistFeedMentionProfiles();
    return profile;
}

function rememberFeedMentionProfiles(items) {
    (items || []).forEach(rememberFeedMentionProfile);
}

function getFeedMentionProfile(handle) {
    const cleanHandle = String(handle || '').replace(/^@/, '').toLowerCase();
    if (!cleanHandle) return null;
    return getFeedMentionProfilesByHandle()[cleanHandle] || null;
}

const MAX_INLINE_FEED_MEDIA_CHARS = 160000;

function parseFeedCardData(caption) {
    if (!caption || typeof caption !== 'string') return null;
    try {
        const parsed = JSON.parse(caption);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

function normalizeFeedCardPhotoUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const markerMatch = raw.match(/\[(?:photo|image):\s*(https?:\/\/[^\s\]]+)\]/i);
    if (markerMatch && markerMatch[1]) return markerMatch[1].trim();

    const lower = raw.toLowerCase();
    if (['text-input', 'photo_captured', 'null', 'undefined', 'none'].includes(lower)) return '';
    if (/^(https?:\/\/|data:image\/|blob:)/i.test(raw)) return raw;

    return '';
}

function getSafeFeedMediaUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^data:/i.test(raw) && raw.length > MAX_INLINE_FEED_MEDIA_CHARS) return '';
    return raw;
}

function getSafeFeedStoryMediaSrc(story, isVideo) {
    const candidates = isVideo
        ? [story && story.thumbnail_url, story && story.media_url]
        : [story && story.media_url, story && story.thumbnail_url];

    for (const candidate of candidates) {
        const safeUrl = getSafeFeedMediaUrl(candidate);
        if (safeUrl) return safeUrl;
    }

    return '';
}

const FEED_MEDIA_DOUBLE_TAP_MS = 260;
const feedMediaTapTimers = new Map();
const feedMediaViewerOpenTimes = new Map();

function stopFeedMediaEvent(event) {
    if (!event) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
}

function clearFeedMediaTapTimer(storyId) {
    const id = String(storyId || '');
    if (!id) return;
    const timer = feedMediaTapTimers.get(id);
    if (timer) clearTimeout(timer);
    feedMediaTapTimers.delete(id);
}

function getFeedInlineMediaElement(attributeName, storyId) {
    const id = String(storyId || '');
    if (!id || typeof document === 'undefined') return null;
    const nodes = document.querySelectorAll(`[${attributeName}]`);
    for (let i = 0; i < nodes.length; i += 1) {
        if (nodes[i].getAttribute(attributeName) === id) return nodes[i];
    }
    return null;
}

function openFeedMediaViewer(storyId) {
    const id = String(storyId || '');
    if (!id) return;
    const now = Date.now();
    if (now - (feedMediaViewerOpenTimes.get(id) || 0) < 500) return;
    feedMediaViewerOpenTimes.set(id, now);

    const video = getFeedInlineMediaElement('data-feed-inline-video', id);
    if (video && typeof video.pause === 'function' && !video.paused) {
        video.pause();
    }
    if (typeof window.openFeedPostViewer === 'function') {
        window.openFeedPostViewer(id);
    }
}

function setFeedInlineVideoUiState(storyId, playing) {
    const id = String(storyId || '');
    if (!id) return;
    const isPlaying = !!playing;
    const shell = getFeedInlineMediaElement('data-feed-video-shell', id);
    const poster = getFeedInlineMediaElement('data-feed-video-poster', id);
    const icon = getFeedInlineMediaElement('data-feed-video-play-icon', id);
    const video = getFeedInlineMediaElement('data-feed-inline-video', id);

    if (shell) shell.setAttribute('data-feed-video-playing', isPlaying ? 'true' : 'false');
    if (poster) poster.style.display = isPlaying ? 'none' : 'block';
    if (icon) icon.style.display = isPlaying ? 'none' : 'flex';
    if (video) {
        video.controls = isPlaying;
        video.style.pointerEvents = isPlaying ? 'auto' : 'none';
        video.style.display = (isPlaying || !poster) ? 'block' : 'none';
    }
}

window.setFeedInlineVideoUiState = setFeedInlineVideoUiState;

window.toggleFeedInlineVideo = async function(storyId) {
    const id = String(storyId || '');
    if (!id) return;
    const video = getFeedInlineMediaElement('data-feed-inline-video', id);
    if (!video) return;

    if (!video.paused && !video.ended) {
        video.pause();
        setFeedInlineVideoUiState(id, false);
        return;
    }

    document.querySelectorAll('[data-feed-inline-video]').forEach(otherVideo => {
        if (otherVideo === video) return;
        if (!otherVideo.paused && !otherVideo.ended && typeof otherVideo.pause === 'function') {
            otherVideo.pause();
        }
        const otherStoryId = otherVideo.getAttribute('data-feed-inline-video');
        if (otherStoryId) setFeedInlineVideoUiState(otherStoryId, false);
    });

    setFeedInlineVideoUiState(id, true);
    video.muted = false;
    try {
        await video.play();
    } catch (error) {
        video.muted = true;
        try {
            await video.play();
        } catch (mutedError) {
            console.warn('Could not play feed video inline:', mutedError || error);
            setFeedInlineVideoUiState(id, false);
        }
    }
};

window.handleFeedMediaTap = function(storyId, isVideo, event) {
    stopFeedMediaEvent(event);
    const id = String(storyId || '');
    if (!id) return;

    if (event && event.target && event.target.closest) {
        const activeVideo = event.target.closest('[data-feed-inline-video]');
        if (activeVideo && activeVideo.getAttribute('data-feed-inline-video') === id && !activeVideo.paused) {
            return;
        }
    }

    if (feedMediaTapTimers.has(id)) {
        clearFeedMediaTapTimer(id);
        openFeedMediaViewer(id);
        return;
    }

    const timer = setTimeout(function() {
        feedMediaTapTimers.delete(id);
        if (isVideo && typeof window.toggleFeedInlineVideo === 'function') {
            window.toggleFeedInlineVideo(id);
        }
    }, FEED_MEDIA_DOUBLE_TAP_MS);
    feedMediaTapTimers.set(id, timer);
};

window.handleFeedMediaDoubleTap = function(storyId, event) {
    stopFeedMediaEvent(event);
    const id = String(storyId || '');
    if (!id) return;
    clearFeedMediaTapTimer(id);
    openFeedMediaViewer(id);
};

function renderFeedVideoPreview(story, options = {}) {
    const mediaUrl = getSafeFeedMediaUrl(story && story.media_url);
    if (!mediaUrl) {
        return '<div style="width:100%; min-height:200px; background:#111827;"></div>';
    }

    const posterUrl = getSafeFeedMediaUrl(story && story.thumbnail_url);
    const posterAttr = posterUrl ? ` poster="${escapeHtml(posterUrl)}"` : '';
    const inlineStoryId = options.storyId ? String(options.storyId) : '';
    const extraClass = options.className ? ` class="${escapeHtml(options.className)}"` : '';
    const baseStyle = options.style || 'width:100%; display:block; object-fit:cover; background:#000; pointer-events:none;';
    const seekHandler = "try{if(!this.dataset.pbbPreviewSeeked){this.dataset.pbbPreviewSeeked='1';this.currentTime=Math.min(0.1,this.duration||0.1);}}catch(e){}";
    const errorHandler = "this.style.display='none';this.parentElement.style.minHeight='200px';this.parentElement.style.background='#111827';";

    if (inlineStoryId) {
        const safeInlineStoryIdAttr = escapeHtml(inlineStoryId);
        const safeInlineStoryIdJs = escapeJsString(inlineStoryId);
        const posterHtml = posterUrl
            ? `<img data-feed-video-poster="${safeInlineStoryIdAttr}" src="${escapeHtml(posterUrl)}" style="width:100%; display:block; object-fit:cover; background:#000;" loading="lazy" onerror="this.style.display='none';">`
            : '';
        const inlineVideoStyle = options.style || `width:100%; display:${posterUrl ? 'none' : 'block'}; object-fit:cover; background:#000; pointer-events:none;`;
        return `<div data-feed-video-shell="${safeInlineStoryIdAttr}" data-feed-video-playing="false" style="position:relative; width:100%; background:#000; overflow:hidden;">
            ${posterHtml}
            <video${extraClass} data-feed-inline-video="${safeInlineStoryIdAttr}" src="${escapeHtml(mediaUrl)}"${posterAttr} muted playsinline preload="metadata" style="${inlineVideoStyle}" onclick="event.stopPropagation();" onloadedmetadata="${seekHandler}" onplay="setFeedInlineVideoUiState('${safeInlineStoryIdJs}', true)" onpause="setFeedInlineVideoUiState('${safeInlineStoryIdJs}', false)" onended="setFeedInlineVideoUiState('${safeInlineStoryIdJs}', false)" onerror="${errorHandler}"></video>
        </div>`;
    }

    return `<video${extraClass} src="${escapeHtml(mediaUrl)}"${posterAttr} muted playsinline preload="metadata" style="${baseStyle}" onloadedmetadata="${seekHandler}" onerror="${errorHandler}" aria-hidden="true"></video>`;
}

window.renderFeedVideoPreview = renderFeedVideoPreview;

function getFeedTextPostSegments(text) {
    const raw = String(text || '').trim().replace(/\r\n/g, '\n');
    if (!raw) {
        return { headline: 'Shared a thought', body: '', wordCount: 0, charCount: 0, lineCount: 0 };
    }

    const lines = raw.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const words = raw.split(/\s+/).filter(Boolean);

    if (lines.length > 1 && lines[0].length <= 120) {
        return {
            headline: lines[0],
            body: lines.slice(1).join('\n'),
            wordCount: words.length,
            charCount: raw.length,
            lineCount: lines.length
        };
    }

    const sentenceMatch = raw.match(/^(.{18,120}?[.!?])\s+([\s\S]+)$/);
    if (sentenceMatch) {
        return {
            headline: sentenceMatch[1].trim(),
            body: sentenceMatch[2].trim(),
            wordCount: words.length,
            charCount: raw.length,
            lineCount: lines.length
        };
    }

    if (words.length <= 10) {
        return { headline: raw, body: '', wordCount: words.length, charCount: raw.length, lineCount: lines.length };
    }

    const headlineWordCount = words.length <= 24
        ? Math.ceil(words.length * 0.55)
        : Math.min(11, Math.max(7, Math.floor(words.length * 0.28)));

    return {
        headline: words.slice(0, headlineWordCount).join(' '),
        body: words.slice(headlineWordCount).join(' '),
        wordCount: words.length,
        charCount: raw.length,
        lineCount: lines.length
    };
}

function getFeedTextPostVariant(segments) {
    if (!segments) return 'poster';
    if (segments.charCount > 220 || segments.lineCount > 3) return 'note';
    if (segments.charCount > 115 || segments.wordCount > 24 || segments.lineCount > 2) return 'reflection';
    if (segments.wordCount <= 7 && segments.charCount <= 54) return 'poster';
    return 'bold';
}

function getFeedTextSize(length, stops) {
    for (const stop of stops) {
        if (length <= stop.max) return stop.size;
    }
    return stops[stops.length - 1].size;
}

function isFeedTextPostStory(story) {
    if (!story) return false;
    const mediaType = String(story.media_type || '').toLowerCase();
    if (mediaType === 'text') return true;

    const hasMedia = !!getSafeFeedMediaUrl(story.media_url) || !!getSafeFeedMediaUrl(story.thumbnail_url);
    const hasPlainText = !!String(story.caption || '').trim() && !parseFeedCardData(story.caption);
    const legacyEmptyImageText = mediaType === 'image' && !hasMedia && hasPlainText;
    const unknownNoMediaText = !mediaType && !hasMedia && hasPlainText;
    return legacyEmptyImageText || unknownNoMediaText;
}
function renderFeedTextPostCard(story, options = {}) {
    const segments = getFeedTextPostSegments(story && story.caption);
    const variant = options.variant || getFeedTextPostVariant(segments);
    const isViewer = options.context === 'viewer';
    const headlineLength = String(segments.headline || '').length;
    const bodyLength = String(segments.body || '').length;
    const posterHeadlineSize = getFeedTextSize(headlineLength, [
        { max: 18, size: '3.3rem' },
        { max: 34, size: '2.9rem' },
        { max: 54, size: '2.45rem' },
        { max: 80, size: '2.05rem' },
        { max: Infinity, size: '1.72rem' }
    ]);
    const headlineFontSize = getFeedTextSize(headlineLength, [
        { max: 48, size: '2.32rem' },
        { max: 76, size: '2.02rem' },
        { max: 105, size: '1.72rem' },
        { max: Infinity, size: '1.48rem' }
    ]);
    const noteHeadlineSize = getFeedTextSize(headlineLength, [
        { max: 54, size: '1.52rem' },
        { max: 95, size: '1.28rem' },
        { max: Infinity, size: '1.08rem' }
    ]);
    const bodyFontSize = getFeedTextSize(bodyLength, [
        { max: 95, size: '0.98rem' },
        { max: 180, size: '0.9rem' },
        { max: Infinity, size: '0.82rem' }
    ]);
    const shellHeight = isViewer
        ? 'min-height:min(70vh, 560px); max-height:70vh;'
        : 'height:clamp(300px, 100vw, 430px);';
    const shellOverflow = isViewer
        ? 'overflow-y:auto; -webkit-overflow-scrolling:touch;'
        : 'overflow:hidden;';
    const bodyClamp = isViewer
        ? ''
        : 'display:-webkit-box; -webkit-line-clamp:8; -webkit-box-orient:vertical; overflow:hidden;';

    if (variant === 'reflection') {
        return `
            <div class="feed-text-post-card feed-text-post-card-reflection" style="position:relative; width:100%; ${shellHeight} box-sizing:border-box; ${shellOverflow} background:linear-gradient(180deg,#fffdf6 0%,#edf7ed 100%); color:#142017; -webkit-text-fill-color:#142017; --feed-mention-color:#14532d;">
                <div style="position:absolute; inset:22px; border:1px solid rgba(20,83,45,0.18); border-radius:18px; pointer-events:none;"></div>
                <div style="position:absolute; left:32px; top:45px; width:76px; height:5px; border-radius:999px; background:#b8892b;"></div>
                <div style="position:relative; min-height:100%; display:flex; flex-direction:column; justify-content:space-between; gap:18px; padding:58px 32px 30px; box-sizing:border-box;">
                    <div>
                        <div style="display:inline-flex; align-items:center; min-height:24px; padding:0 10px; border-radius:999px; background:#def7e6; color:#14532d; -webkit-text-fill-color:#14532d; font-size:0.62rem; font-weight:900; text-transform:uppercase;">Check-in</div>
                        <div style="margin:22px 0 12px; font-family:'Playfair Display', Georgia, serif; font-size:${headlineFontSize}; line-height:1.07; font-weight:700; letter-spacing:0; overflow-wrap:anywhere; word-break:break-word;">${formatFeedText(segments.headline)}</div>
                        ${segments.body ? `<div style="font-family:'Inter', system-ui, sans-serif; font-size:${bodyFontSize}; line-height:1.42; font-weight:700; color:#3f4c42; -webkit-text-fill-color:#3f4c42; overflow-wrap:anywhere; word-break:break-word; white-space:normal; ${bodyClamp}">${formatFeedText(segments.body)}</div>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; color:#737c73; -webkit-text-fill-color:#737c73; font-size:0.7rem; font-weight:850; text-transform:uppercase;">
                        <span>Small win</span>
                        <span>Balance</span>
                    </div>
                </div>
            </div>`;
    }

    if (variant === 'note') {
        return `
            <div class="feed-text-post-card feed-text-post-card-note" style="position:relative; width:100%; ${shellHeight} box-sizing:border-box; ${shellOverflow} background:linear-gradient(160deg,#111827 0%,#1f2937 62%,#374151 125%); color:#f8fafc; -webkit-text-fill-color:#f8fafc; --feed-mention-color:#fde68a;">
                <div style="position:absolute; left:0; top:0; bottom:0; width:9px; background:#d8a03c;"></div>
                <div style="position:absolute; left:22px; right:22px; top:50px; bottom:50px; background:repeating-linear-gradient(180deg,rgba(255,255,255,0.05) 0,rgba(255,255,255,0.05) 1px,transparent 1px,transparent 34px); pointer-events:none;"></div>
                <div style="position:relative; min-height:100%; display:flex; flex-direction:column; justify-content:space-between; gap:18px; padding:34px 28px 28px 34px; box-sizing:border-box;">
                    <div>
                        <div style="display:inline-flex; align-items:center; min-height:24px; padding:0 10px; border-radius:6px; background:rgba(216,160,60,0.16); color:#fde68a; -webkit-text-fill-color:#fde68a; font-family:'Inter', system-ui, sans-serif; font-size:0.62rem; font-weight:900; text-transform:uppercase;">Diary</div>
                        <div style="margin:22px 0 13px; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:${noteHeadlineSize}; line-height:1.22; font-weight:900; letter-spacing:0; overflow-wrap:anywhere; word-break:break-word;">${formatFeedText(segments.headline)}</div>
                        ${segments.body ? `<div style="font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:${bodyFontSize}; line-height:1.55; font-weight:700; color:rgba(248,250,252,0.88); -webkit-text-fill-color:rgba(248,250,252,0.88); overflow-wrap:anywhere; word-break:break-word; white-space:normal; ${bodyClamp}">${formatFeedText(segments.body)}</div>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; color:rgba(248,250,252,0.68); -webkit-text-fill-color:rgba(248,250,252,0.68); font-family:'Inter', system-ui, sans-serif; font-size:0.7rem; font-weight:850; text-transform:uppercase;">
                        <span>Logged</span>
                        <span>+2 XP</span>
                    </div>
                </div>
            </div>`;
    }

    if (variant === 'poster') {
        return `
            <div class="feed-text-post-card feed-text-post-card-poster" style="position:relative; width:100%; ${shellHeight} box-sizing:border-box; ${shellOverflow} background:linear-gradient(145deg,#f8fafc 0%,#dff6e7 56%,#f8d66d 135%); color:#102016; -webkit-text-fill-color:#102016; --feed-mention-color:#166534;">
                <div style="position:absolute; inset:16px; border-radius:22px; border:2px solid rgba(16,32,22,0.12); pointer-events:none;"></div>
                <div style="position:absolute; right:26px; top:28px; font-family:'Playfair Display', Georgia, serif; font-size:3.1rem; line-height:1; color:rgba(20,83,45,0.18); -webkit-text-fill-color:rgba(20,83,45,0.18);">Aa</div>
                <div style="position:relative; min-height:100%; display:flex; flex-direction:column; justify-content:center; gap:18px; padding:38px 30px 30px; box-sizing:border-box;">
                    <div style="display:inline-flex; align-self:flex-start; align-items:center; min-height:24px; padding:0 10px; border-radius:999px; background:#14532d; color:white; -webkit-text-fill-color:white; font-family:'Inter', system-ui, sans-serif; font-size:0.62rem; font-weight:900; text-transform:uppercase;">Today clicked</div>
                    <div style="font-family:'Outfit','Inter',system-ui,sans-serif; font-size:${posterHeadlineSize}; line-height:0.98; font-weight:900; letter-spacing:0; overflow-wrap:anywhere; word-break:break-word;">${formatFeedText(segments.headline)}</div>
                    ${segments.body ? `<div style="font-family:'Inter', system-ui, sans-serif; font-size:${bodyFontSize}; line-height:1.35; font-weight:800; color:#35523b; -webkit-text-fill-color:#35523b; overflow-wrap:anywhere; word-break:break-word; white-space:normal; ${bodyClamp}">${formatFeedText(segments.body)}</div>` : ''}
                </div>
            </div>`;
    }

    return `
        <div class="feed-text-post-card feed-text-post-card-bold" style="position:relative; width:100%; ${shellHeight} box-sizing:border-box; ${shellOverflow} background:linear-gradient(135deg,#052e1b 0%,#14532d 58%,#b8892b 145%); color:white; -webkit-text-fill-color:white; --feed-mention-color:rgba(255,255,255,0.96);">
            <div style="position:absolute; width:178px; height:178px; border:1px solid rgba(255,255,255,0.2); border-radius:50%; top:-72px; right:-58px;"></div>
            <div style="position:absolute; width:132px; height:132px; border-radius:50%; border:30px solid rgba(216,160,60,0.16); left:-72px; bottom:-58px;"></div>
            <div style="position:relative; min-height:100%; display:flex; flex-direction:column; justify-content:space-between; gap:18px; padding:27px 24px 24px; box-sizing:border-box;">
                <div>
                    <div style="display:inline-flex; align-items:center; min-height:24px; padding:0 10px; border-radius:999px; background:rgba(255,255,255,0.13); color:#e7f8e9; -webkit-text-fill-color:#e7f8e9; font-size:0.62rem; font-weight:900; text-transform:uppercase;">Today clicked</div>
                    <div style="margin:24px 0 12px; font-family:'Outfit','Inter',system-ui,sans-serif; font-size:${headlineFontSize}; line-height:1.03; font-weight:900; letter-spacing:0; overflow-wrap:anywhere; word-break:break-word;">${formatFeedText(segments.headline)}</div>
                    ${segments.body ? `<div style="font-family:'Inter', system-ui, sans-serif; font-size:${bodyFontSize}; line-height:1.36; font-weight:760; color:rgba(255,255,255,0.9); -webkit-text-fill-color:rgba(255,255,255,0.9); overflow-wrap:anywhere; word-break:break-word; white-space:normal; ${bodyClamp}">${formatFeedText(segments.body)}</div>` : ''}
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; color:rgba(255,255,255,0.76); -webkit-text-fill-color:rgba(255,255,255,0.76); font-size:0.7rem; font-weight:850; text-transform:uppercase;">
                    <span>Text post</span>
                    <span>+2 XP</span>
                </div>
            </div>
        </div>`;
}
function getProgressPhotoSetPayload(story) {
    if (!story) return null;
    const payload = parseFeedCardData(story.caption);
    if (!payload || typeof payload !== 'object') return null;
    if (payload.card_type === 'progress_photo_set') return payload;

    const hasProgressPhotoShape = Array.isArray(payload.shots)
        && (payload.photo_id || payload.photo_week || payload.shot_count != null);
    return hasProgressPhotoShape ? Object.assign({ card_type: 'progress_photo_set' }, payload) : null;
}

function getProgressPhotoShotUrl(shot) {
    if (!shot || typeof shot !== 'object') return '';
    return getSafeFeedMediaUrl(shot.photo_url || shot.media_url || shot.url || shot.thumbnail_url || shot.thumbnailUrl);
}

function getProgressPhotoShotLabel(shot, index) {
    const rawAngle = String(shot && (shot.angle || shot.key || shot.position) || '').trim().toLowerCase();
    const angleLabels = {
        front: 'Front',
        centre: 'Centre',
        center: 'Centre',
        middle: 'Centre',
        side: 'Side',
        left: 'Left',
        right: 'Right',
        back: 'Back'
    };
    if (angleLabels[rawAngle]) return angleLabels[rawAngle];

    const title = String(shot && (shot.title || shot.label) || '').trim();
    if (title) return title.replace(/\s+facing$/i, '');

    return ['Front', 'Side', 'Back'][index] || 'Photo';
}

function getProgressPhotoShots(story) {
    const payload = getProgressPhotoSetPayload(story);
    const payloadShots = payload && Array.isArray(payload.shots) ? payload.shots : [];
    const shots = payloadShots.map((shot, index) => {
        const mediaUrl = getProgressPhotoShotUrl(shot);
        if (!mediaUrl) return null;
        return {
            mediaUrl,
            thumbnailUrl: getSafeFeedMediaUrl(shot.thumbnail_url || shot.thumbnailUrl) || mediaUrl,
            label: getProgressPhotoShotLabel(shot, index)
        };
    }).filter(Boolean);

    if (shots.length) return shots;

    const fallbackUrl = getSafeFeedStoryMediaSrc(story, false);
    return fallbackUrl ? [{ mediaUrl: fallbackUrl, thumbnailUrl: fallbackUrl, label: 'Progress' }] : [];
}

function getProgressPhotoCaptionText(story) {
    const payload = getProgressPhotoSetPayload(story);
    if (payload) {
        const explicit = String(payload.share_caption || payload.caption || '').trim();
        if (explicit) return explicit;
    }

    const shotCount = getProgressPhotoShots(story).length;
    return shotCount >= 3 ? 'Weekly progress photos locked in.' : 'Weekly progress photo locked in.';
}

function renderProgressPhotoSet(story, storyId, options = {}) {
    const shots = getProgressPhotoShots(story);
    if (!shots.length) return '';

    const isViewer = options.variant === 'viewer';
    const safeStoryId = escapeJsString(storyId || '');
    const carouselIdBase = String(storyId || 'progress-photo')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 40) || 'progress-photo';
    const carouselId = `${isViewer ? 'viewer' : 'feed'}-carousel-progress-${carouselIdBase}`;
    const slideCount = Math.max(shots.length, 1);
    const trackWidth = slideCount * 100;
    const slideWidth = 100 / slideCount;
    const openAttr = !isViewer && safeStoryId ? ` role="button" tabindex="0" onclick="handleFeedMediaTap('${safeStoryId}', false, event)" ondblclick="handleFeedMediaDoubleTap('${safeStoryId}', event)" onkeydown="if(event.key==='Enter'){handleFeedMediaDoubleTap('${safeStoryId}', event)}"` : '';
    const containerStyle = isViewer
        ? 'width:100%; overflow:hidden; position:relative; background:#000;'
        : 'cursor:pointer; width:100%; overflow:hidden; position:relative; background:#000;';
    const tileStyle = isViewer
        ? `width:${slideWidth}%; flex-shrink:0; position:relative; overflow:hidden; background:#020617; min-height:260px; height:min(70vh, 680px);`
        : `width:${slideWidth}%; flex-shrink:0; position:relative; overflow:hidden; background:#020617; aspect-ratio:4/5;`;
    const imgStyle = isViewer
        ? 'width:100%; height:100%; object-fit:contain; display:block; background:#000;'
        : 'width:100%; height:100%; object-fit:cover; display:block; background:#000;';
    const dotsHtml = slideCount > 1
        ? `<div style="position:absolute; bottom:${isViewer ? '14px' : '10px'}; left:50%; transform:translateX(-50%); display:flex; gap:6px; z-index:3; pointer-events:auto;">
            ${shots.map((_, index) => `
                <button type="button" class="carousel-dot${index === 0 ? ' active' : ''}" aria-label="Show progress photo ${index + 1}" onclick="event.stopPropagation(); slideViewerCarousel('${escapeJsString(carouselId)}', ${index})" style="width:7px; height:7px; border:none; border-radius:50%; background:white; opacity:${index === 0 ? '1' : '0.4'}; padding:0; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,0.35);"></button>
            `).join('')}
        </div>`
        : '';

    return `<div id="${escapeHtml(carouselId)}" data-slide-count="${slideCount}" data-current-slide="0"${openAttr} style="${containerStyle}">
        <div class="carousel-track" style="display:flex; transition:transform 0.3s ease; width:${trackWidth}%;">
            ${shots.map(shot => `
                <div style="${tileStyle}">
                    <img src="${escapeHtml(shot.thumbnailUrl || shot.mediaUrl)}" data-full-src="${escapeHtml(shot.mediaUrl)}" style="${imgStyle}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'; this.parentElement.style.background='#111827';">
                    <div style="position:absolute; left:8px; bottom:${slideCount > 1 ? (isViewer ? '32px' : '28px') : '8px'}; color:white; -webkit-text-fill-color:white; background:rgba(15,23,42,0.72); border-radius:999px; padding:5px 9px; font-size:${isViewer ? '0.76rem' : '0.68rem'}; font-weight:800; line-height:1; box-shadow:0 4px 12px rgba(0,0,0,0.24);">${escapeHtml(shot.label)}</div>
                </div>
            `).join('')}
        </div>
        ${dotsHtml}
    </div>`;
}

function getFeedCardPhotoUrl(story, cardData) {
    const candidates = [
        story && story.media_url,
        story && story.thumbnail_url,
        cardData && cardData.photo_url,
        cardData && cardData.photoUrl,
        cardData && cardData.image_url,
        cardData && cardData.imageUrl,
        cardData && cardData.media_url,
        cardData && cardData.mediaUrl,
        cardData && cardData.thumbnail_url,
        cardData && cardData.thumbnailUrl
    ];

    for (const candidate of candidates) {
        const url = getSafeFeedMediaUrl(normalizeFeedCardPhotoUrl(candidate));
        if (url) return url;
    }

    return '';
}

function getFeedMealCardId(cardData) {
    const mealId = String((cardData && (cardData.meal_id || cardData.mealId)) || '').trim();
    return mealId && /^[0-9a-f-]{20,}$/i.test(mealId) ? mealId : '';
}

async function persistHydratedMealCardPhoto(story, photoUrl, cardData) {
    try {
        if (!window.supabaseClient || !window.currentUser || !story || !photoUrl) return;
        const storyId = story.story_id || story.id;
        if (!storyId || story.user_id !== window.currentUser.id) return;

        const { error } = await window.supabaseClient
            .from('stories')
            .update({
                media_url: photoUrl,
                thumbnail_url: photoUrl,
                caption: JSON.stringify(cardData)
            })
            .eq('id', storyId)
            .eq('user_id', window.currentUser.id);

        if (error) {
            console.warn('Could not persist hydrated meal card photo:', error);
        }
    } catch (error) {
        console.warn('Could not persist hydrated meal card photo:', error);
    }
}

async function hydrateMealCardPhotos(stories) {
    if (!Array.isArray(stories) || stories.length === 0 || !window.supabaseClient || !window.currentUser) {
        return stories;
    }

    const targets = [];
    const mealIds = new Set();

    stories.forEach(story => {
        const cardData = parseFeedCardData(story && story.caption ? story.caption : '');
        if (!cardData || cardData.card_type !== 'meal') return;
        if (getFeedCardPhotoUrl(story, cardData)) return;

        const mealId = getFeedMealCardId(cardData);
        if (!mealId) return;

        targets.push({ story, cardData, mealId });
        mealIds.add(mealId);
    });

    if (targets.length === 0) return stories;

    try {
        const { data, error } = await window.supabaseClient
            .from('meal_logs')
            .select('id, photo_url, storage_path')
            .eq('user_id', window.currentUser.id)
            .in('id', Array.from(mealIds).slice(0, 100));

        if (error) {
            console.warn('Could not hydrate meal card photos:', error);
            return stories;
        }

        const photosByMealId = new Map();
        (data || []).forEach(meal => {
            const photoUrl = normalizeFeedCardPhotoUrl(meal.photo_url) || normalizeFeedCardPhotoUrl(meal.storage_path);
            if (photoUrl) photosByMealId.set(String(meal.id), photoUrl);
        });

        const persistTasks = [];
        targets.forEach(target => {
            const photoUrl = photosByMealId.get(target.mealId);
            if (!photoUrl) return;

            target.story.media_url = photoUrl;
            target.story.thumbnail_url = target.story.thumbnail_url || photoUrl;
            target.cardData.photo_url = photoUrl;
            target.cardData.photoUrl = photoUrl;
            target.story.caption = JSON.stringify(target.cardData);
            persistTasks.push(persistHydratedMealCardPhoto(target.story, photoUrl, target.cardData));
        });

        if (persistTasks.length) {
            Promise.all(persistTasks).catch(error => {
                console.warn('Could not persist one or more hydrated meal photos:', error);
            });
        }
    } catch (error) {
        console.warn('Could not hydrate meal card photos:', error);
    }

    return stories;
}

function buildMealFeedCaptionText(cardData) {
    if (!cardData || cardData.card_type !== 'meal') return '';
    if (cardData.share_caption && String(cardData.share_caption).trim()) {
        return String(cardData.share_caption).trim();
    }

    const ingredients = Array.isArray(cardData.ingredients) ? cardData.ingredients : [];
    const ingredientText = ingredients.length
        ? ingredients.map(item => {
            const name = String(item && item.name ? item.name : '').trim();
            const portion = String(item && item.portion ? item.portion : '').trim();
            if (!name) return '';
            return portion ? `${name} (${portion})` : name;
        }).filter(Boolean).join(', ')
        : String(cardData.foods || '').trim();

    const lines = [];
    if (cardData.meal_type) lines.push(String(cardData.meal_type));
    if (ingredientText) lines.push('Ingredients: ' + ingredientText);
    if (Number(cardData.calories) > 0) lines.push(Math.round(Number(cardData.calories)) + ' kcal');
    lines.push(`Protein ${Math.round(Number(cardData.protein || 0))}g | Carbs ${Math.round(Number(cardData.carbs || 0))}g | Fat ${Math.round(Number(cardData.fat || 0))}g`);
    return lines.filter(Boolean).join('\n');
}

// Render Friday weigh-in board-day card for the feed.
window.renderFridayWeighInCard = function(cardData) {
    if (!cardData) return '<div style="padding:40px; text-align:center; color:#999;">Card data unavailable</div>';

    const weightLabel = cardData.display_weight || (Number(cardData.weight_kg) ? Number(cardData.weight_kg).toFixed(1) + ' kg' : '--');
    const change = Number(cardData.change_kg);
    const hasChange = Number.isFinite(change);
    const absChange = hasChange ? Math.abs(change).toFixed(1) : null;
    const isDown = hasChange && change < 0;
    const isUp = hasChange && change > 0;
    const changeText = !hasChange
        ? 'First Friday marker'
        : isDown
            ? 'Down ' + absChange + ' kg from last Friday'
            : isUp
                ? 'Up ' + absChange + ' kg from last Friday'
                : 'Steady from last Friday';
    const chipBg = isDown ? 'rgba(22,163,74,0.28)' : isUp ? 'rgba(251,191,36,0.24)' : 'rgba(255,255,255,0.16)';
    const chipBorder = isDown ? 'rgba(134,239,172,0.55)' : isUp ? 'rgba(253,224,71,0.52)' : 'rgba(255,255,255,0.28)';
    const chipText = isDown ? '#dcfce7' : isUp ? '#fef9c3' : '#f8fafc';
    const dateLabel = cardData.weigh_in_date
        ? new Date(cardData.weigh_in_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
        : 'Friday';
    const challengeName = cardData.challenge_name || '30 Day Challenge';
    // Older saved Friday cards can carry the previous 2/10 XP payload values.
    const sharePoints = 5;

    return `
        <div style="width:100%; aspect-ratio:4/5; background:linear-gradient(145deg, #07111f 0%, #075985 42%, #0f766e 72%, #172554 100%); display:flex; flex-direction:column; padding:28px 24px; box-sizing:border-box; position:relative; overflow:hidden; color:#ffffff; text-shadow:0 2px 10px rgba(2,6,23,0.48);">
            <div style="position:absolute; right:-18px; top:22px; font-size:4.8rem; font-weight:950; letter-spacing:0.02em; color:rgba(255,255,255,0.1); transform:rotate(8deg);">FRI</div>
            <div style="position:absolute; left:-50px; bottom:-50px; width:170px; height:170px; border-radius:50%; background:rgba(255,255,255,0.08);"></div>
            <div style="position:absolute; right:-34px; bottom:74px; width:126px; height:126px; border-radius:50%; border:24px solid rgba(255,255,255,0.08);"></div>

            <div style="z-index:1; flex:1; display:flex; flex-direction:column;">
                <div style="font-size:0.72rem; font-weight:950; letter-spacing:3px; text-transform:uppercase; color:#e0f2fe; margin-bottom:10px;">Friday weigh-in</div>
                <div style="font-family:'Playfair Display',serif; font-size:2rem; line-height:1.05; font-weight:900; color:#ffffff; margin-bottom:8px;">Board day</div>
                <div style="font-size:0.84rem; line-height:1.35; color:#f8fafc; font-weight:760; max-width:250px;">${escapeHtml(challengeName)} check-in, shared to the feed.</div>

                <div style="margin:28px 0 18px; background:rgba(255,255,255,0.16); border:1px solid rgba(255,255,255,0.24); border-radius:18px; padding:20px 18px;">
                    <div style="font-size:0.72rem; color:#e0f2fe; font-weight:900; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:6px;">Logged weight</div>
                    <div style="font-size:3.1rem; line-height:1; font-weight:950; color:#ffffff;">${escapeHtml(weightLabel)}</div>
                    <div style="font-size:0.78rem; color:#f8fafc; font-weight:800; margin-top:8px;">${escapeHtml(dateLabel)}</div>
                </div>

                <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
                    <div style="background:${chipBg}; color:${chipText}; border:1px solid ${chipBorder}; border-radius:999px; padding:8px 11px; font-size:0.78rem; font-weight:900;">${escapeHtml(changeText)}</div>
                    <div style="background:rgba(37,99,235,0.28); color:#eff6ff; border:1px solid rgba(147,197,253,0.52); border-radius:999px; padding:8px 11px; font-size:0.78rem; font-weight:900;">+${sharePoints} XP feed share</div>
                </div>

                <div style="margin-top:auto; background:rgba(2,6,23,0.24); border:1px solid rgba(255,255,255,0.16); border-radius:14px; padding:12px 13px;">
                    <div style="font-size:0.76rem; color:#f8fafc; line-height:1.42; font-weight:750;">Friday weigh-ins are about showing up, seeing the trend, and keeping the group moving.</div>
                </div>
            </div>

            <div style="text-align:center; z-index:1; margin-top:16px;">
                <div style="width:30px; height:1px; background:rgba(255,255,255,0.42); margin:0 auto 8px;"></div>
                <div style="font-size:0.65rem; color:#e0f2fe; letter-spacing:1px; font-weight:800;">BALANCE</div>
            </div>
        </div>
    `;
};

// Render aesthetic workout/PB card for feed display
window.renderWorkoutCard = function(cardData) {
    if (!cardData) return '<div style="padding:40px; text-align:center; color:#999;">Card data unavailable</div>';
    if (cardData.card_type === 'friday_weigh_in') return window.renderFridayWeighInCard(cardData);

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
            <div style="width:100%; aspect-ratio:4/5; background:linear-gradient(160deg, #0c4a6e 0%, #0284c7 35%, #0ea5e9 70%, #38bdf8 100%); display:flex; flex-direction:column; justify-content:center; align-items:center; padding:30px; box-sizing:border-box; position:relative; overflow:hidden; color:#fff; text-shadow:0 2px 8px rgba(0,0,0,0.36);">
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
                            <div style="font-size:0.7rem; color:rgba(255,255,255,0.82); margin-top:2px;">Duration</div>
                        </div>
                        <div style="width:1px; background:rgba(255,255,255,0.2);"></div>
                        <div style="text-align:center;">
                            <div style="font-size:1.4rem; font-weight:800; color:white;">${intensityEmoji} ${intensityLabel}</div>
                            <div style="font-size:0.7rem; color:rgba(255,255,255,0.82); margin-top:2px;">Intensity</div>
                        </div>
                    </div>

                    ${calories > 0 ? `
                        <div style="background:rgba(255,255,255,0.15); border-radius:12px; padding:14px 20px; display:inline-block;">
                            <div style="font-size:0.65rem; color:rgba(255,255,255,0.84); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Estimated Burn</div>
                            <div style="font-size:1.5rem; font-weight:800; color:white;">${calories} kcal</div>
                        </div>
                    ` : ''}
                </div>

                <div style="position:absolute; bottom:16px; left:0; right:0; text-align:center;">
                    <div style="width:30px; height:1px; background:rgba(255,255,255,0.48); margin:0 auto 8px;"></div>
                    <div style="font-size:0.65rem; color:rgba(255,255,255,0.78); letter-spacing:1px; font-weight:700;">FITGOTCHI 🌱</div>
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
        <div style="width:100%; aspect-ratio:4/5; background:linear-gradient(160deg, #022c22 0%, #046A38 35%, #059669 70%, #10b981 100%); display:flex; flex-direction:column; padding:28px 24px; box-sizing:border-box; position:relative; overflow:hidden; color:#fff; text-shadow:0 2px 8px rgba(0,0,0,0.34);">
            <div style="position:absolute; top:-40px; right:-40px; font-size:10rem; opacity:0.04; transform:rotate(15deg);">💪</div>
            <div style="position:absolute; bottom:-30px; left:-30px; font-size:7rem; opacity:0.04; transform:rotate(-10deg);">🏋️</div>

            <div style="z-index:1; flex:1; display:flex; flex-direction:column;">
                <!-- Header -->
                <div style="margin-bottom:16px;">
                    <div style="font-size:1.5rem; margin-bottom:6px;">💪</div>
                    <div style="font-size:0.7rem; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.88);">Workout Complete</div>
                </div>

                <div style="width:30px; height:2px; background:rgba(255,255,255,0.3); margin-bottom:14px;"></div>

                <!-- Workout Name -->
                <div style="font-family:'Playfair Display',serif; font-size:1.3rem; font-weight:700; color:white; margin-bottom:4px; line-height:1.3;">${cardData.workout_name || 'Workout'}</div>

                <!-- Stats Row -->
                <div style="display:flex; gap:12px; align-items:center; margin-bottom:16px;">
                    ${cardData.duration ? `<span style="font-size:0.8rem; color:rgba(255,255,255,0.92); font-weight:700;">⏱ ${cardData.duration}</span>` : ''}
                    ${cardData.total_sets ? `<span style="font-size:0.8rem; color:rgba(255,255,255,0.92); font-weight:700;">${cardData.total_sets} sets</span>` : ''}
                </div>

                <!-- Exercises List -->
                <div style="flex:1; display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">
                    ${displayExercises.map(ex => `
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.08);">
                            <span style="font-size:0.8rem; color:rgba(255,255,255,0.9); font-weight:500;">${ex.name}</span>
                            <span style="font-size:0.75rem; color:rgba(255,255,255,0.82); font-weight:700; white-space:nowrap; margin-left:8px;">${ex.best || ''}</span>
                        </div>
                    `).join('')}
                    ${remaining > 0 ? `<div style="font-size:0.75rem; color:rgba(255,255,255,0.78); padding-top:2px;">+${remaining} more exercise${remaining > 1 ? 's' : ''}</div>` : ''}
                </div>

                <!-- PBs Section -->
                ${pbsHtml ? `<div style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;">${pbsHtml}</div>` : ''}

                <!-- Total Volume -->
                ${cardData.total_volume ? `
                    <div style="background:rgba(255,255,255,0.1); border-radius:10px; padding:10px 14px; text-align:center; margin-bottom:8px;">
                        <div style="font-size:0.65rem; color:rgba(255,255,255,0.84); text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Total Volume</div>
                        <div style="font-size:1.1rem; font-weight:800; color:white;">${cardData.total_volume}</div>
                    </div>
                ` : ''}
            </div>

            <div style="text-align:center; z-index:1;">
                <div style="width:30px; height:1px; background:rgba(255,255,255,0.48); margin:0 auto 8px;"></div>
                <div style="font-size:0.65rem; color:rgba(255,255,255,0.78); letter-spacing:1px; font-weight:700;">FITGOTCHI 🌱</div>
            </div>
        </div>
    `;
};

// Render aesthetic nutrition day card for feed display
window.renderNutritionCard = function(cardData) {
    if (!cardData) return '<div style="padding:40px; text-align:center; color:#999;">Card data unavailable</div>';

    const score = cardData.score || 0;
    const calories = cardData.calories || 0;
    const calorieGoal = cardData.calorie_goal || 2000;
    const protein = cardData.protein || 0;
    const proteinGoal = cardData.protein_goal || 50;
    const carbs = cardData.carbs || 0;
    const carbsGoal = cardData.carbs_goal || 250;
    const fat = cardData.fat || 0;
    const fatGoal = cardData.fat_goal || 70;
    const mealCount = cardData.meal_count || 0;
    const streak = cardData.streak || 0;

    // Determine grade
    let grade = 'Keep Going';
    let gradeColor = '#ef4444';
    if (score >= 90) { grade = 'Excellent'; gradeColor = '#10b981'; }
    else if (score >= 75) { grade = 'Great'; gradeColor = '#22c55e'; }
    else if (score >= 60) { grade = 'Good'; gradeColor = '#84cc16'; }
    else if (score >= 40) { grade = 'Decent'; gradeColor = '#f59e0b'; }

    // Calorie percentage
    const calPct = calorieGoal > 0 ? Math.min(100, Math.round((calories / calorieGoal) * 100)) : 0;

    // Macro bar helper
    function macroBar(actual, goal, color) {
        const pct = goal > 0 ? Math.min(100, Math.round((actual / goal) * 100)) : 0;
        return `<div style="flex:1; height:4px; background:rgba(255,255,255,0.15); border-radius:2px; overflow:hidden;">
            <div style="height:100%; width:${pct}%; background:${color}; border-radius:2px;"></div>
        </div>`;
    }

    return `
        <div style="width:100%; aspect-ratio:4/5; background:linear-gradient(160deg, #1e1b4b 0%, #4338ca 30%, #6366f1 60%, #818cf8 100%); display:flex; flex-direction:column; padding:28px 24px; box-sizing:border-box; position:relative; overflow:hidden; color:#fff; text-shadow:0 2px 8px rgba(0,0,0,0.34);">
            <div style="position:absolute; top:-30px; right:-30px; font-size:8rem; opacity:0.05; transform:rotate(15deg);">🥗</div>
            <div style="position:absolute; bottom:-20px; left:-20px; font-size:6rem; opacity:0.04; transform:rotate(-10deg);">✨</div>

            <div style="z-index:1; flex:1; display:flex; flex-direction:column;">
                <!-- Header -->
                <div style="margin-bottom:14px;">
                    <div style="font-size:1.4rem; margin-bottom:6px;">🥗</div>
                    <div style="font-size:0.7rem; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.9);">Daily Nutrition</div>
                </div>

                <div style="width:30px; height:2px; background:rgba(255,255,255,0.3); margin-bottom:16px;"></div>

                <!-- Score Circle -->
                <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
                    <div style="width:72px; height:72px; border-radius:50%; background:rgba(255,255,255,0.12); display:flex; align-items:center; justify-content:center; position:relative; flex-shrink:0;">
                        <svg viewBox="0 0 72 72" style="position:absolute; top:0; left:0; width:100%; height:100%; transform:rotate(-90deg);">
                            <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="5"/>
                            <circle cx="36" cy="36" r="30" fill="none" stroke="${gradeColor}" stroke-width="5" stroke-linecap="round"
                                stroke-dasharray="${2 * Math.PI * 30}" stroke-dashoffset="${2 * Math.PI * 30 * (1 - score / 100)}"/>
                        </svg>
                        <div style="font-size:1.4rem; font-weight:800; color:white; z-index:1;">${score}</div>
                    </div>
                    <div>
                        <div style="font-family:'Playfair Display',serif; font-size:1.3rem; font-weight:700; color:white; line-height:1.2;">${grade}</div>
                        <div style="font-size:0.75rem; color:rgba(255,255,255,0.84); margin-top:2px;">${mealCount} meal${mealCount !== 1 ? 's' : ''} logged</div>
                    </div>
                </div>

                <!-- Calories -->
                <div style="background:rgba(255,255,255,0.1); backdrop-filter:blur(8px); border-radius:14px; padding:14px 16px; margin-bottom:14px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px;">
                        <div style="font-size:0.7rem; color:rgba(255,255,255,0.84); text-transform:uppercase; letter-spacing:1px;">Calories</div>
                        <div style="font-size:0.75rem; color:rgba(255,255,255,0.82);">${calPct}%</div>
                    </div>
                    <div style="display:flex; align-items:baseline; gap:6px;">
                        <div style="font-size:1.5rem; font-weight:800; color:white;">${calories}</div>
                        <div style="font-size:0.8rem; color:rgba(255,255,255,0.84);">/ ${calorieGoal} kcal</div>
                    </div>
                </div>

                <!-- Macros Row -->
                <div style="display:flex; gap:8px; margin-bottom:16px;">
                    <div style="flex:1; background:rgba(255,255,255,0.08); border-radius:10px; padding:10px 12px;">
                        <div style="font-size:0.65rem; color:rgba(255,255,255,0.84); margin-bottom:4px;">Protein</div>
                        <div style="font-size:1rem; font-weight:700; color:#60a5fa; margin-bottom:6px;">${protein}g</div>
                        ${macroBar(protein, proteinGoal, '#60a5fa')}
                    </div>
                    <div style="flex:1; background:rgba(255,255,255,0.08); border-radius:10px; padding:10px 12px;">
                        <div style="font-size:0.65rem; color:rgba(255,255,255,0.84); margin-bottom:4px;">Carbs</div>
                        <div style="font-size:1rem; font-weight:700; color:#fbbf24; margin-bottom:6px;">${carbs}g</div>
                        ${macroBar(carbs, carbsGoal, '#fbbf24')}
                    </div>
                    <div style="flex:1; background:rgba(255,255,255,0.08); border-radius:10px; padding:10px 12px;">
                        <div style="font-size:0.65rem; color:rgba(255,255,255,0.84); margin-bottom:4px;">Fat</div>
                        <div style="font-size:1rem; font-weight:700; color:#f87171; margin-bottom:6px;">${fat}g</div>
                        ${macroBar(fat, fatGoal, '#f87171')}
                    </div>
                </div>

                ${streak >= 2 ? `
                    <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(255,255,255,0.1); padding:6px 14px; border-radius:20px; align-self:center;">
                        <span style="font-size:0.9rem;">🔥</span>
                        <span style="font-size:0.8rem; font-weight:600; color:white;">${streak} Day Streak</span>
                    </div>
                ` : ''}
            </div>

            <div style="text-align:center; z-index:1;">
                <div style="width:30px; height:1px; background:rgba(255,255,255,0.48); margin:0 auto 8px;"></div>
                <div style="font-size:0.65rem; color:rgba(255,255,255,0.78); letter-spacing:1px; font-weight:700;">FITGOTCHI 🌱</div>
            </div>
        </div>
    `;
};

// Render one logged meal as a feed card.
window.renderMealCard = function(cardData) {
    if (!cardData) return '<div style="padding:40px; text-align:center; color:#999;">Card data unavailable</div>';

    const mealType = cardData.meal_type || 'Meal';
    const foods = cardData.foods || 'Logged meal';
    const calories = Math.round(cardData.calories || 0);
    const protein = Math.round(cardData.protein || 0);
    const carbs = Math.round(cardData.carbs || 0);
    const fat = Math.round(cardData.fat || 0);

    return `
        <div class="feed-meal-card" style="width:100%; aspect-ratio:4/5; background:linear-gradient(160deg, #052e2b 0%, #0f766e 44%, #2563eb 100%); display:flex; flex-direction:column; padding:28px 24px; box-sizing:border-box; position:relative; overflow:hidden; color:#fff; text-shadow:0 2px 8px rgba(0,0,0,0.34);">
            <div style="position:absolute; top:-58px; right:-58px; width:170px; height:170px; border-radius:50%; border:28px solid rgba(255,255,255,0.06);"></div>
            <div style="position:absolute; bottom:-42px; left:-42px; width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,0.06);"></div>

            <div style="z-index:1; flex:1; display:flex; flex-direction:column;">
                <div class="feed-meal-card-muted" style="font-size:0.7rem; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.9); margin-bottom:10px;">Meal shared</div>
                <div class="feed-meal-card-title" style="font-family:'Playfair Display',serif; font-size:2rem; line-height:1.05; font-weight:800; color:white; margin-bottom:12px;">${escapeHtml(mealType)}</div>
                <div style="width:34px; height:2px; background:rgba(255,255,255,0.38); margin-bottom:16px;"></div>

                <div style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.14); border-radius:14px; padding:15px 16px; margin-bottom:16px;">
                    <div class="feed-meal-card-muted" style="font-size:0.75rem; color:rgba(255,255,255,0.84); text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">Food</div>
                    <div class="feed-meal-card-food" style="font-size:1rem; color:white; font-weight:750; line-height:1.35;">${escapeHtml(foods)}</div>
                </div>

                <div style="display:flex; align-items:baseline; gap:7px; margin-bottom:14px;">
                    <div class="feed-meal-card-calories" style="font-size:2.4rem; line-height:1; color:white; font-weight:900;">${calories}</div>
                    <div class="feed-meal-card-muted" style="font-size:0.82rem; color:rgba(255,255,255,0.84); font-weight:800;">kcal</div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin-top:auto;">
                    <div style="background:rgba(255,255,255,0.1); border-radius:12px; padding:11px 8px; text-align:center;">
                        <div class="feed-meal-card-macro-value" style="font-size:1.15rem; color:white; font-weight:900;">${protein}g</div>
                        <div class="feed-meal-card-muted" style="font-size:0.65rem; color:rgba(255,255,255,0.84); font-weight:800;">Protein</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.1); border-radius:12px; padding:11px 8px; text-align:center;">
                        <div class="feed-meal-card-macro-value" style="font-size:1.15rem; color:white; font-weight:900;">${carbs}g</div>
                        <div class="feed-meal-card-muted" style="font-size:0.65rem; color:rgba(255,255,255,0.84); font-weight:800;">Carbs</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.1); border-radius:12px; padding:11px 8px; text-align:center;">
                        <div class="feed-meal-card-macro-value" style="font-size:1.15rem; color:white; font-weight:900;">${fat}g</div>
                        <div class="feed-meal-card-muted" style="font-size:0.65rem; color:rgba(255,255,255,0.84); font-weight:800;">Fat</div>
                    </div>
                </div>
            </div>

            <div style="text-align:center; z-index:1;">
                <div style="width:30px; height:1px; background:rgba(255,255,255,0.48); margin:0 auto 8px;"></div>
                <div class="feed-meal-card-muted" style="font-size:0.65rem; color:rgba(255,255,255,0.78); letter-spacing:1px; font-weight:700;">BALANCE</div>
            </div>
        </div>
    `;
};

// Render an end-of-day fitness diary feed card.
window.renderFitnessDiaryCard = function(cardData) {
    if (!cardData) return '<div style="padding:40px; text-align:center; color:#999;">Card data unavailable</div>';

    function displayValue(value) {
        return String(value || '')
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, function(match) { return match.toUpperCase(); });
    }

    function cleanDiaryText(value) {
        const text = String(value || '').trim();
        return text;
    }

    const dateLabel = cardData.diary_date
        ? new Date(String(cardData.diary_date) + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
        : 'Today';
    const rating = displayValue(cardData.day_rating || 'Logged');
    const energy = displayValue(cardData.energy_level || 'Not set');
    const dayStory = cleanDiaryText(cardData.day_story || cardData.note);
    const goals = cleanDiaryText(cardData.goals);
    const highlight = cleanDiaryText(cardData.highlight);
    const struggle = cleanDiaryText(cardData.struggle);
    const reflectionRows = [
        dayStory ? { label: 'My day', value: dayStory, featured: true } : null,
        goals ? { label: 'Goals', value: goals } : null,
        highlight ? { label: 'Best thing', value: highlight } : null,
        struggle ? { label: 'Hardest part', value: struggle } : null
    ].filter(Boolean);

    const reflectionHtml = reflectionRows.length
        ? reflectionRows.map(row => `
            <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.14);border-radius:14px;padding:${row.featured ? '16px 17px' : '13px 14px'};">
                <div style="font-size:0.68rem;color:rgba(255,255,255,0.72);font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">${escapeHtml(row.label)}</div>
                <div style="font-size:${row.featured ? '0.96rem' : '0.9rem'};color:#ffffff;font-weight:780;line-height:1.38;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(row.value)}</div>
            </div>
        `).join('')
        : '<div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.14);border-radius:14px;padding:14px 15px;font-size:0.9rem;color:#ffffff;font-weight:780;line-height:1.38;">End-of-day diary entry logged.</div>';

    return `
        <div class="feed-fitness-diary-card" style="width:100%;min-height:clamp(640px,177vw,920px);background:linear-gradient(160deg,#10291f 0%,#0f766e 46%,#2563eb 100%);display:flex;flex-direction:column;padding:34px 26px 30px;box-sizing:border-box;position:relative;overflow:visible;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.32);">
            <div style="z-index:1;flex:1;display:flex;flex-direction:column;">
                <div style="font-size:0.7rem;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.88);margin-bottom:10px;">Fitness diary</div>
                <div style="font-family:'Playfair Display',serif;font-size:2rem;line-height:1.05;font-weight:900;color:white;margin-bottom:8px;">End of day</div>
                <div style="font-size:0.78rem;color:rgba(255,255,255,0.82);font-weight:800;margin-bottom:18px;">${escapeHtml(dateLabel)}</div>
                <div style="width:34px;height:2px;background:rgba(255,255,255,0.38);margin-bottom:14px;"></div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
                    <div style="background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.16);border-radius:14px;padding:12px;">
                        <div style="font-size:0.66rem;color:rgba(255,255,255,0.72);font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Today felt</div>
                        <div style="font-size:1rem;color:#ffffff;font-weight:900;line-height:1.15;">${escapeHtml(rating)}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.16);border-radius:14px;padding:12px;">
                        <div style="font-size:0.66rem;color:rgba(255,255,255,0.72);font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Energy</div>
                        <div style="font-size:1rem;color:#ffffff;font-weight:900;line-height:1.15;">${escapeHtml(energy)}</div>
                    </div>
                </div>

                <div style="display:flex;flex-direction:column;gap:9px;margin-top:2px;">
                    ${reflectionHtml}
                </div>
            </div>

            <div style="text-align:center;z-index:1;margin-top:14px;">
                <div style="width:30px;height:1px;background:rgba(255,255,255,0.48);margin:0 auto 8px;"></div>
                <div style="font-size:0.65rem;color:rgba(255,255,255,0.78);letter-spacing:1px;font-weight:700;">BALANCE</div>
            </div>
        </div>
    `;
};

// Render a daily check-in feed card.
window.renderCheckInCard = function(cardData) {
    if (!cardData) return '<div style="padding:40px; text-align:center; color:#999;">Card data unavailable</div>';

    function displayValue(value) {
        return String(value || '')
            .replace(/_/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, function(match) { return match.toUpperCase(); });
    }

    const dateLabel = cardData.checkin_date
        ? new Date(String(cardData.checkin_date) + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
        : 'Today';
    const title = cardData.title || 'Daily check-in';
    const symptoms = Array.isArray(cardData.symptoms) ? cardData.symptoms : [];
    const symptomLabel = symptoms.length
        ? symptoms.slice(0, 3).map(displayValue).join(', ') + (symptoms.length > 3 ? ' +' + (symptoms.length - 3) : '')
        : 'No symptoms logged';
    const rows = [
        cardData.energy ? { label: 'Energy', value: displayValue(cardData.energy) } : null,
        cardData.recovery ? { label: 'Recovery', value: displayValue(cardData.recovery) } : null,
        cardData.mood ? { label: 'Mood', value: displayValue(cardData.mood) } : null,
        cardData.equipment ? { label: 'Training setup', value: displayValue(cardData.equipment) } : null
    ].filter(Boolean).slice(0, 4);

    const rowsHtml = rows.length
        ? rows.map(row => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.12);">
                <div style="font-size:0.72rem;color:rgba(255,255,255,0.74);font-weight:850;text-transform:uppercase;letter-spacing:1px;">${escapeHtml(row.label)}</div>
                <div style="font-size:0.95rem;color:#ffffff;font-weight:900;text-align:right;">${escapeHtml(row.value)}</div>
            </div>
        `).join('')
        : '<div style="font-size:0.86rem;color:rgba(255,255,255,0.84);font-weight:760;line-height:1.45;">Checked in and updated today&apos;s plan.</div>';

    return `
        <div style="width:100%;aspect-ratio:4/5;background:linear-gradient(160deg,#052e2b 0%,#047857 42%,#0e7490 100%);display:flex;flex-direction:column;padding:28px 24px;box-sizing:border-box;position:relative;overflow:hidden;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.32);">
            <div style="position:absolute;right:-42px;top:-42px;width:170px;height:170px;border-radius:50%;border:28px solid rgba(255,255,255,0.06);"></div>
            <div style="position:absolute;left:-34px;bottom:-46px;width:138px;height:138px;border-radius:50%;background:rgba(255,255,255,0.07);"></div>

            <div style="z-index:1;flex:1;display:flex;flex-direction:column;">
                <div style="font-size:0.7rem;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.88);margin-bottom:10px;">Daily check-in</div>
                <div style="font-family:'Playfair Display',serif;font-size:2rem;line-height:1.05;font-weight:900;color:white;margin-bottom:8px;">${escapeHtml(title)}</div>
                <div style="font-size:0.78rem;color:rgba(255,255,255,0.82);font-weight:800;margin-bottom:18px;">${escapeHtml(dateLabel)}</div>
                <div style="width:34px;height:2px;background:rgba(255,255,255,0.38);margin-bottom:14px;"></div>

                <div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.16);border-radius:15px;padding:14px 16px;margin-bottom:15px;">
                    ${rowsHtml}
                </div>

                <div style="margin-top:auto;background:rgba(2,6,23,0.18);border:1px solid rgba(255,255,255,0.14);border-radius:14px;padding:12px 13px;">
                    <div style="font-size:0.7rem;color:rgba(255,255,255,0.72);font-weight:900;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Body signals</div>
                    <div style="font-size:0.86rem;color:#ffffff;font-weight:800;line-height:1.35;">${escapeHtml(symptomLabel)}</div>
                </div>
            </div>

            <div style="text-align:center;z-index:1;margin-top:14px;">
                <div style="width:30px;height:1px;background:rgba(255,255,255,0.48);margin:0 auto 8px;"></div>
                <div style="font-size:0.65rem;color:rgba(255,255,255,0.78);letter-spacing:1px;font-weight:700;">BALANCE</div>
            </div>
        </div>
    `;
};

// Render aesthetic level-up achievement card for feed display
window.renderLevelUpCard = function(cardData) {
    if (!cardData) return '<div style="padding:40px; text-align:center; color:#999;">Card data unavailable</div>';

    const level = cardData.level || 1;
    const title = cardData.title || 'Newcomer';
    const previousLevel = cardData.previous_level || null;
    const previousTitle = cardData.previous_title || null;
    const lifetimeXP = cardData.lifetime_xp || 0;
    const streak = cardData.streak || 0;

    // Choose gradient based on level tier
    let gradient, tierEmoji, tierLabel;
    if (level >= 90) {
        gradient = 'linear-gradient(160deg, #4a1942 0%, #9333ea 30%, #a855f7 60%, #c084fc 100%)';
        tierEmoji = '👑';
        tierLabel = 'LEGENDARY';
    } else if (level >= 70) {
        gradient = 'linear-gradient(160deg, #7c2d12 0%, #dc2626 30%, #ef4444 60%, #f87171 100%)';
        tierEmoji = '💎';
        tierLabel = 'ELITE';
    } else if (level >= 50) {
        gradient = 'linear-gradient(160deg, #78350f 0%, #d97706 30%, #f59e0b 60%, #fbbf24 100%)';
        tierEmoji = '⭐';
        tierLabel = 'ADVANCED';
    } else if (level >= 30) {
        gradient = 'linear-gradient(160deg, #064e3b 0%, #059669 30%, #10b981 60%, #34d399 100%)';
        tierEmoji = '🌟';
        tierLabel = 'RISING';
    } else {
        gradient = 'linear-gradient(160deg, #1e3a5f 0%, #2563eb 30%, #3b82f6 60%, #60a5fa 100%)';
        tierEmoji = '✨';
        tierLabel = 'GROWING';
    }

    // Title transition
    const titleTransition = (previousTitle && previousTitle !== title)
        ? `<div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:8px;">
                <span style="font-size:0.85rem; color:rgba(255,255,255,0.78); text-decoration:line-through;">${previousTitle}</span>
                <span style="font-size:0.85rem; color:rgba(255,255,255,0.86);">→</span>
                <span style="font-size:0.95rem; color:white; font-weight:700;">${title}</span>
           </div>`
        : `<div style="font-size:1rem; color:white; font-weight:700; margin-bottom:8px;">${title}</div>`;

    return `
        <div style="width:100%; aspect-ratio:4/5; background:${gradient}; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:30px; box-sizing:border-box; position:relative; overflow:hidden; color:#fff; text-shadow:0 2px 8px rgba(0,0,0,0.34);">
            <div style="position:absolute; top:-30px; right:-30px; font-size:8rem; opacity:0.06; transform:rotate(15deg);">${tierEmoji}</div>
            <div style="position:absolute; bottom:-20px; left:-20px; font-size:6rem; opacity:0.05; transform:rotate(-10deg);">⚡</div>

            <div style="text-align:center; z-index:1;">
                <div style="font-size:0.7rem; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.9); margin-bottom:16px;">${tierLabel}</div>

                <div style="font-size:2.8rem; margin-bottom:10px;">${tierEmoji}</div>

                <div style="font-size:0.75rem; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:rgba(255,255,255,0.85); margin-bottom:16px;">Level Up!</div>
                <div style="width:40px; height:2px; background:rgba(255,255,255,0.4); margin:0 auto 20px;"></div>

                <!-- Level Number -->
                <div style="background:rgba(255,255,255,0.15); backdrop-filter:blur(10px); border-radius:20px; padding:18px 32px; margin-bottom:16px; border:1px solid rgba(255,255,255,0.2); display:inline-block;">
                    <div style="font-size:2.8rem; font-weight:800; color:white; font-family:'Montserrat',sans-serif; line-height:1;">Lvl ${level}</div>
                </div>

                <!-- Title Transition -->
                ${titleTransition}

                <!-- Stats Row -->
                <div style="display:flex; gap:16px; justify-content:center; margin-top:16px;">
                    <div style="text-align:center;">
                        <div style="font-size:1.1rem; font-weight:800; color:white;">${lifetimeXP}</div>
                        <div style="font-size:0.65rem; color:rgba(255,255,255,0.84); margin-top:2px;">Total XP</div>
                    </div>
                    ${streak >= 2 ? `
                        <div style="width:1px; background:rgba(255,255,255,0.2);"></div>
                        <div style="text-align:center;">
                            <div style="font-size:1.1rem; font-weight:800; color:white;">🔥 ${streak}</div>
                            <div style="font-size:0.65rem; color:rgba(255,255,255,0.84); margin-top:2px;">Day Streak</div>
                        </div>
                    ` : ''}
                    <div style="width:1px; background:rgba(255,255,255,0.2);"></div>
                    <div style="text-align:center;">
                        <div style="font-size:1.1rem; font-weight:800; color:white;">${99 - level}</div>
                        <div style="font-size:0.65rem; color:rgba(255,255,255,0.84); margin-top:2px;">To Max</div>
                    </div>
                </div>
            </div>

            <div style="position:absolute; bottom:16px; left:0; right:0; text-align:center;">
                <div style="width:30px; height:1px; background:rgba(255,255,255,0.48); margin:0 auto 8px;"></div>
                <div style="font-size:0.65rem; color:rgba(255,255,255,0.78); letter-spacing:1px; font-weight:700;">FITGOTCHI 🌱</div>
            </div>
        </div>
    `;
};

const FEED_COMPOSER_POST_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function getStoredUserProfile() {
    if (window.userProfile && typeof window.userProfile === 'object') return window.userProfile;
    try {
        const sessionProfile = JSON.parse(sessionStorage.getItem('userProfile') || '{}');
        if (sessionProfile && Object.keys(sessionProfile).length) return sessionProfile;
    } catch (e) {}
    try {
        const localProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        if (localProfile && Object.keys(localProfile).length) return localProfile;
    } catch (e) {}
    return {};
}

function getFeedComposerText() {
    const input = document.getElementById('feed-composer-text');
    return input ? input.value.trim() : '';
}

function getFeedComposerMediaType(file) {
    if (!file || !file.type) return null;
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return null;
}

function getStoryMediaSourcePrefix(source) {
    const normalized = String(source || '').trim().toLowerCase();
    return normalized.startsWith('feed') ? normalized : 'feed';
}

function extractB2FileNameFromUrl(url) {
    const raw = String(url || '').trim();
    if (!raw || raw.startsWith('data:')) return '';
    try {
        const parsed = new URL(raw);
        const parts = parsed.pathname.split('/file/');
        if (parts.length < 2) return '';
        const bucketAndFile = parts[1].split('/');
        bucketAndFile.shift();
        return decodeURIComponent(bucketAndFile.join('/'));
    } catch (_) {
        return '';
    }
}

async function uploadStoryMediaToBackblaze(file, options = {}) {
    if (!file) throw new Error('Missing media file');

    const userId = options.userId || window.currentUser?.id;
    const storyId = options.storyId || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
    if (!userId || !storyId) throw new Error('Missing upload identifiers');

    const sizeMb = file.size / (1024 * 1024);
    const statusTarget = options.postBtn || null;
    if (statusTarget) {
        statusTarget.textContent = `Uploading ${Math.max(1, Math.round(sizeMb))}MB...`;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    formData.append('storyId', storyId);
    formData.append('source', getStoryMediaSourcePrefix(options.source));

    const timeoutMs = Number(options.timeoutMs || 90000);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const externalSignal = options.signal || options.abortSignal || null;
    let externalAbortHandler = null;
    if (controller && externalSignal) {
        if (externalSignal.aborted) {
            controller.abort();
        } else if (typeof externalSignal.addEventListener === 'function') {
            externalAbortHandler = function () { controller.abort(); };
            try {
                externalSignal.addEventListener('abort', externalAbortHandler, { once: true });
            } catch (_) {
                externalSignal.addEventListener('abort', externalAbortHandler);
            }
        }
    }
    const timeoutId = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    let uploadResponse;
    try {
        uploadResponse = await fetch('/api/upload-story-media', {
            method: 'POST',
            body: formData,
            signal: controller ? controller.signal : (externalSignal || undefined)
        });
    } catch (error) {
        if (error && error.name === 'AbortError') {
            throw new Error('Upload timed out. Saved for retry.');
        }
        throw error;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (externalSignal && externalAbortHandler && typeof externalSignal.removeEventListener === 'function') {
            externalSignal.removeEventListener('abort', externalAbortHandler);
        }
    }

    if (!uploadResponse.ok) {
        let errorMessage = 'Upload failed';
        try {
            const errorData = await uploadResponse.json();
            errorMessage = errorData.error || errorMessage;
        } catch (e) {}
        throw new Error(errorMessage);
    }

    return uploadResponse.json();
}

async function archiveFeedMediaAsset(asset) {
    try {
        const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
        const story = asset?.story || {};
        const userId = asset?.userId || window.currentUser?.id || story.user_id;
        const mediaUrl = String(asset?.mediaUrl || story.media_url || '').trim();
        const mediaType = String(asset?.mediaType || story.media_type || '').trim();

        if (!client || !story?.id || !userId || !mediaUrl || mediaUrl.startsWith('data:')) return;
        if (!['image', 'video'].includes(mediaType)) return;

        const uploadData = asset.uploadData || {};
        const archiveRow = {
            story_id: story.id,
            user_id: userId,
            media_type: mediaType,
            media_url: mediaUrl,
            thumbnail_url: asset.thumbnailUrl || story.thumbnail_url || null,
            caption: asset.caption || story.caption || null,
            source: getStoryMediaSourcePrefix(asset.source || 'feed'),
            b2_file_name: uploadData.fileName || extractB2FileNameFromUrl(mediaUrl) || null,
            b2_file_id: uploadData.fileId || null,
            content_type: uploadData.contentType || asset.mimeType || null,
            file_size_bytes: Number(uploadData.size || asset.fileSizeBytes || 0) || null,
            posted_at: story.created_at || new Date().toISOString(),
            feed_expires_at: story.expires_at || null,
            metadata: {
                duration: story.duration || asset.duration || null,
                background_color: story.background_color || null,
                archived_from: asset.source || 'feed'
            }
        };

        const { error } = await client
            .from('feed_media_assets')
            .upsert(archiveRow, { onConflict: 'story_id' });

        if (error) {
            console.warn('Could not archive feed media asset:', error);
        }
    } catch (error) {
        console.warn('Could not archive feed media asset:', error);
    }
}

function showFeedComposerToast(message, type) {
    if (typeof showToast === 'function') {
        showToast(message, type || 'info');
    } else {
        alert(message);
    }
}

function isDuplicatePointTransactionError(error) {
    const message = String(error && (error.message || error.details || error.hint || error.code) || '').toLowerCase();
    return (error && error.code === '23505') || message.includes('duplicate key') || message.includes('already exists');
}

function getDailyFeedCheckInReferenceType(dateKey) {
    return 'feed_check_in:' + String(dateKey || '').trim();
}

async function refreshDailyFeedCheckInAwardDisplays() {
    try { if (typeof refreshPointsDisplay === 'function') refreshPointsDisplay(); } catch (_) {}
    try { if (typeof refreshLevelDisplay === 'function') refreshLevelDisplay(); } catch (_) {}
    try { if (typeof refreshChallengeProgress === 'function') refreshChallengeProgress(); } catch (_) {}
    try { if (typeof triggerXPBarRainbow === 'function') triggerXPBarRainbow(); } catch (_) {}
    try {
        if (window.supabaseClient && window.currentUser?.id && typeof window.supabaseClient.rpc === 'function') {
            await window.supabaseClient.rpc('update_challenge_participant_points', { user_uuid: window.currentUser.id });
        }
    } catch (error) {
        console.warn('Could not refresh challenge points after Feed check-in share:', error);
    }
}

async function addDailyFeedCheckInPoints(pointsAmount) {
    const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    const userId = window.currentUser?.id;
    if (!client || !userId || !pointsAmount) return;

    const { data: currentPoints, error: fetchError } = await client
        .from('user_points')
        .select('current_points,lifetime_points')
        .eq('user_id', userId)
        .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    if (currentPoints) {
        const { error: updateError } = await client
            .from('user_points')
            .update({
                current_points: (currentPoints.current_points || 0) + pointsAmount,
                lifetime_points: (currentPoints.lifetime_points || 0) + pointsAmount
            })
            .eq('user_id', userId);
        if (updateError) throw updateError;
        return;
    }

    const { error: insertError } = await client
        .from('user_points')
        .insert({ user_id: userId, current_points: pointsAmount, lifetime_points: pointsAmount });

    if (insertError && !isDuplicatePointTransactionError(insertError)) throw insertError;
    if (!insertError) return;

    const { data: retryPoints, error: retryFetchError } = await client
        .from('user_points')
        .select('current_points,lifetime_points')
        .eq('user_id', userId)
        .maybeSingle();
    if (retryFetchError) throw retryFetchError;

    const { error: retryUpdateError } = await client
        .from('user_points')
        .update({
            current_points: (retryPoints?.current_points || 0) + pointsAmount,
            lifetime_points: (retryPoints?.lifetime_points || 0) + pointsAmount
        })
        .eq('user_id', userId);
    if (retryUpdateError) throw retryUpdateError;
}

window.awardDailyFeedCheckInXP = async function(story, dateKey, options = {}) {
    const pointsFromStory = Number(story?.points_awarded || 0);
    if (pointsFromStory > 0) {
        await refreshDailyFeedCheckInAwardDisplays();
        return pointsFromStory;
    }

    const client = window.supabaseClient || (typeof supabaseClient !== 'undefined' ? supabaseClient : null);
    const userId = window.currentUser?.id;
    if (!String(dateKey || '').trim()) return 0;
    const referenceType = getDailyFeedCheckInReferenceType(dateKey);
    if (!client || !userId || !referenceType) return 0;

    const txType = 'earn_feed_check_in';
    const { data: existingTx, error: existingError } = await client
        .from('point_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_type', txType)
        .eq('reference_type', referenceType)
        .limit(1)
        .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') throw existingError;
    if (existingTx) return 0;

    const pointsAmount = Number(options.points || 2);
    const { data: tx, error: txError } = await client
        .from('point_transactions')
        .insert({
            user_id: userId,
            transaction_type: txType,
            points_amount: pointsAmount,
            reference_id: story?.id || null,
            reference_type: referenceType,
            photo_verified: false,
            verification_method: options.verificationMethod || 'feed_checkin_card',
            description: options.description || 'Daily Feed check-in post'
        })
        .select('id')
        .single();

    if (txError) {
        if (isDuplicatePointTransactionError(txError)) return 0;
        throw txError;
    }

    if (!tx) return 0;

    await addDailyFeedCheckInPoints(pointsAmount);
    await refreshDailyFeedCheckInAwardDisplays();
    return pointsAmount;
};

function readFeedComposerFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function readFeedComposerImageDataUrlSafely(file) {
    try {
        return await readFeedComposerFileAsDataUrl(file);
    } catch (error) {
        console.warn('Could not prepare feed image for analysis or fallback:', error);
        return null;
    }
}

function getBase64Payload(dataUrl) {
    const match = String(dataUrl || '').match(/^data:[^;]+;base64,(.+)$/);
    return match ? match[1] : null;
}

window.updateFeedComposerAvatar = function() {
    const avatar = document.getElementById('feed-composer-avatar');
    if (!avatar) return;

    const profile = getStoredUserProfile();
    const photo = localStorage.getItem('profile_photo')
        || profile.profile_photo
        || window.currentUser?.profile_photo
        || '';
    const name = profile.name
        || window.currentUser?.user_metadata?.full_name
        || window.currentUser?.email
        || 'B';

    if (photo) {
        avatar.innerHTML = `<img src="${escapeHtml(photo)}" alt="" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
        avatar.textContent = String(name).charAt(0).toUpperCase() || 'B';
    }
};

window.updateFeedComposerState = function() {
    const btn = document.getElementById('feed-composer-post-btn');
    if (!btn) return;

    const canPost = !!getFeedComposerText() || !!feedComposerFile;
    const isLoading = btn.dataset.loading === 'true';
    btn.disabled = !canPost || isLoading;
    btn.style.opacity = (!canPost || isLoading) ? '0.45' : '1';
    btn.style.transform = canPost && !isLoading ? 'translateY(0)' : 'none';
};

window.focusFeedComposer = function() {
    const card = document.getElementById('feed-composer-card');
    const input = document.getElementById('feed-composer-text');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.updateFeedComposerAvatar();
    setTimeout(() => {
        if (input) input.focus();
    }, 220);
};

function setFeedComposerMediaSourceMenuOpen(isOpen) {
    const menu = document.getElementById('feed-composer-media-source-menu');
    const button = document.getElementById('feed-composer-media-source-button');
    if (!menu) return;

    menu.style.display = isOpen ? 'block' : 'none';
    if (button) button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function resetFeedComposerMediaInputs() {
    ['feed-composer-camera-input', 'feed-composer-file-input'].forEach((id) => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
}

window.toggleFeedComposerMediaSourceMenu = function(event) {
    if (event) event.stopPropagation();
    setFeedComposerShareMenuOpen(false);

    const menu = document.getElementById('feed-composer-media-source-menu');
    const isOpen = menu && menu.style.display !== 'none';
    setFeedComposerMediaSourceMenuOpen(!isOpen);
};

window.openFeedComposerMediaSource = function(source) {
    setFeedComposerMediaSourceMenuOpen(false);

    const inputId = source === 'camera' ? 'feed-composer-camera-input' : 'feed-composer-file-input';
    const input = document.getElementById(inputId);
    if (!input) {
        showFeedComposerToast('Media picker is not available.', 'error');
        return;
    }

    input.value = '';
    input.click();
};

if (!window.__feedComposerMediaSourceMenuDismissBound) {
    window.__feedComposerMediaSourceMenuDismissBound = true;

    document.addEventListener('click', (event) => {
        const menu = document.getElementById('feed-composer-media-source-menu');
        if (!menu || menu.style.display === 'none') return;

        const button = document.getElementById('feed-composer-media-source-button');
        if (menu.contains(event.target) || (button && button.contains(event.target))) return;
        setFeedComposerMediaSourceMenuOpen(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setFeedComposerMediaSourceMenuOpen(false);
    });
}

function setFeedComposerShareMenuOpen(isOpen) {
    const menu = document.getElementById('feed-composer-share-menu');
    const button = document.getElementById('feed-composer-share-menu-button');
    if (!menu) return;

    menu.style.display = isOpen ? 'block' : 'none';
    if (button) button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (isOpen) setFeedComposerMediaSourceMenuOpen(false);
}

function setFeedComposerShareActionLoading(isLoading, label) {
    const button = document.getElementById('feed-composer-share-menu-button');
    if (!button) return;
    if (isLoading) {
        button.dataset.originalText = button.textContent || 'Share';
        button.disabled = true;
        button.style.opacity = '0.65';
        button.innerHTML = `<span style="display:inline-flex; width:18px; height:18px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:spin 0.85s linear infinite;"></span>${escapeHtml(label || 'Sharing')}`;
    } else {
        button.disabled = false;
        button.style.opacity = '1';
        button.innerHTML = '<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round;"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"></path><path d="M16 6l-4-4-4 4"></path><path d="M12 2v13"></path></svg>Share';
    }
}

window.toggleFeedComposerShareMenu = function(event) {
    if (event) event.stopPropagation();

    const menu = document.getElementById('feed-composer-share-menu');
    const isOpen = menu && menu.style.display !== 'none';
    setFeedComposerShareMenuOpen(!isOpen);
};

if (!window.__feedComposerShareMenuDismissBound) {
    window.__feedComposerShareMenuDismissBound = true;

    document.addEventListener('click', (event) => {
        const menu = document.getElementById('feed-composer-share-menu');
        if (!menu || menu.style.display === 'none') return;

        const button = document.getElementById('feed-composer-share-menu-button');
        if (menu.contains(event.target) || (button && button.contains(event.target))) return;
        setFeedComposerShareMenuOpen(false);
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setFeedComposerShareMenuOpen(false);
    });
}

window.handleFeedComposerFileSelect = function(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const mediaType = getFeedComposerMediaType(file);
    if (!mediaType) {
        showFeedComposerToast('Choose a photo or video file.', 'error');
        event.target.value = '';
        return;
    }

    window.clearFeedComposerMedia(false);
    feedComposerFile = file;
    feedComposerPreviewUrl = URL.createObjectURL(file);

    const preview = document.getElementById('feed-composer-preview');
    const image = document.getElementById('feed-composer-preview-image');
    const video = document.getElementById('feed-composer-preview-video');
    const fileName = document.getElementById('feed-composer-file-name');

    if (preview) preview.style.display = 'block';
    if (image) {
        image.style.display = mediaType === 'image' ? 'block' : 'none';
        image.src = mediaType === 'image' ? feedComposerPreviewUrl : '';
    }
    if (video) {
        video.style.display = mediaType === 'video' ? 'block' : 'none';
        video.src = mediaType === 'video' ? feedComposerPreviewUrl : '';
    }
    if (fileName) {
        fileName.style.display = 'block';
        fileName.textContent = file.name || (mediaType === 'video' ? 'Video selected' : 'Photo selected');
    }

    window.updateFeedComposerState();
};

window.clearFeedComposerMedia = function(resetInput = true) {
    if (feedComposerPreviewUrl) {
        URL.revokeObjectURL(feedComposerPreviewUrl);
    }
    feedComposerPreviewUrl = null;
    feedComposerFile = null;

    const preview = document.getElementById('feed-composer-preview');
    const image = document.getElementById('feed-composer-preview-image');
    const video = document.getElementById('feed-composer-preview-video');
    const fileName = document.getElementById('feed-composer-file-name');

    if (preview) preview.style.display = 'none';
    if (image) {
        image.src = '';
        image.style.display = 'none';
    }
    if (video) {
        video.pause();
        video.src = '';
        video.style.display = 'none';
    }
    if (fileName) {
        fileName.textContent = '';
        fileName.style.display = 'none';
    }
    if (resetInput) resetFeedComposerMediaInputs();

    window.updateFeedComposerState();
};

function resetFeedComposer() {
    const input = document.getElementById('feed-composer-text');
    if (input) input.value = '';
    window.clearFeedComposerMedia();
    window.updateFeedComposerState();
}

function isFeedMentionInput(element) {
    if (!element || !['INPUT', 'TEXTAREA'].includes(element.tagName)) return false;
    const id = String(element.id || '');
    if (element.dataset && element.dataset.feedMentions === 'true') return true;
    return id === 'feed-composer-text'
        || id === 'feed-post-editor-textarea'
        || id === 'feed-post-editor-share-caption'
        || id === 'workout-feed-share-caption'
        || id.startsWith('feed-comment-input-');
}

function getActiveFeedMentionSearch(input) {
    if (!input || typeof input.selectionStart !== 'number') return null;

    const cursor = input.selectionStart;
    const textBeforeCursor = String(input.value || '').slice(0, cursor);
    const match = textBeforeCursor.match(/(^|[\s([{])@([A-Za-z0-9_]{0,40})$/);
    if (!match) return null;

    const query = match[2] || '';
    return {
        query,
        start: cursor - query.length - 1,
        end: cursor
    };
}

function ensureFeedMentionMenu() {
    let menu = document.getElementById('feed-mention-suggestions');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'feed-mention-suggestions';
        menu.style.cssText = 'display:none; position:fixed; z-index:10080; width:min(320px, calc(100vw - 24px)); max-height:240px; overflow-y:auto; -webkit-overflow-scrolling:touch; background:white; border:1px solid #dbe3ea; border-radius:14px; box-shadow:0 18px 40px rgba(15,23,42,0.22); padding:6px; box-sizing:border-box;';
        document.body.appendChild(menu);
    }
    return menu;
}

function closeFeedMentionMenu() {
    feedMentionState = null;
    const menu = document.getElementById('feed-mention-suggestions');
    if (menu) {
        menu.style.display = 'none';
        menu.innerHTML = '';
    }
}

function positionFeedMentionMenu(input) {
    const menu = ensureFeedMentionMenu();
    const rect = input.getBoundingClientRect();
    const width = Math.min(320, Math.max(220, rect.width));
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 360;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 640;
    const left = Math.max(12, Math.min(rect.left, viewportWidth - width - 12));
    const estimatedHeight = Math.min(240, Math.max(88, menu.scrollHeight || 180));
    let top = rect.bottom + 8;
    if (top + estimatedHeight > viewportHeight - 12 && rect.top > estimatedHeight + 12) {
        top = rect.top - estimatedHeight - 8;
    }

    menu.style.width = width + 'px';
    menu.style.left = left + 'px';
    menu.style.top = Math.max(12, top) + 'px';
}

function mapFeedMentionCandidates(rawItems) {
    const seen = new Set();
    return (rawItems || [])
        .map(rememberFeedMentionProfile)
        .filter(Boolean)
        .filter(profile => {
            const key = profile.id || profile.handle.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function mergeFeedMentionCandidateLists(...candidateLists) {
    const seen = new Set();
    const merged = [];

    candidateLists.flat().filter(Boolean).forEach(profile => {
        const normalized = rememberFeedMentionProfile(profile);
        if (!normalized) return;

        const key = normalized.id || normalized.handle.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(normalized);
    });

    return merged;
}

function getCachedFeedMentionCandidates() {
    return Object.values(getFeedMentionProfilesByHandle())
        .map(rememberFeedMentionProfile)
        .filter(Boolean);
}

async function loadFeedMentionFriends() {
    if (feedMentionFriendsCache) return feedMentionFriendsCache;

    let rawFriends = [];
    try {
        if (window.dbHelpers?.friends?.getFriendsWithFallback && window.currentUser?.id) {
            rawFriends = await window.dbHelpers.friends.getFriendsWithFallback(window.currentUser.id);
        } else if (window.supabaseClient?.rpc && window.currentUser?.id) {
            const { data, error } = await window.supabaseClient.rpc('get_friends_with_status', { user_uuid: window.currentUser.id });
            if (error) throw error;
            rawFriends = data || [];
        }
    } catch (error) {
        console.warn('Could not load mention friends:', error);
    }

    feedMentionFriendsCache = mapFeedMentionCandidates(rawFriends);
    return feedMentionFriendsCache;
}

function filterFeedMentionCandidates(candidates, query) {
    const q = String(query || '').toLowerCase();
    return (candidates || [])
        .filter(profile => {
            if (!q) return true;
            return profile.handle.toLowerCase().includes(q)
                || String(profile.name || '').toLowerCase().includes(q);
        })
        .slice(0, 8);
}

async function loadFeedMentionCandidates(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!window.currentUser?.id) return [];
    const localCandidates = filterFeedMentionCandidates(
        mergeFeedMentionCandidateLists(await loadFeedMentionFriends(), getCachedFeedMentionCandidates()),
        q
    );

    if (q.length < 2) {
        return localCandidates;
    }

    if (feedMentionSearchCache[q]) return feedMentionSearchCache[q];

    let candidates = [];
    try {
        if (window.dbHelpers?.friends?.searchUsers) {
            candidates = mapFeedMentionCandidates(await window.dbHelpers.friends.searchUsers(q, window.currentUser.id));
        }
    } catch (error) {
        console.warn('Could not search mention users:', error);
    }

    candidates = mergeFeedMentionCandidateLists(candidates, localCandidates);

    feedMentionSearchCache[q] = candidates.slice(0, 8);
    return feedMentionSearchCache[q];
}

function renderFeedMentionMenu() {
    const state = feedMentionState;
    const menu = ensureFeedMentionMenu();
    if (!state || !state.results || !state.results.length) {
        closeFeedMentionMenu();
        return;
    }

    menu.innerHTML = state.results.map((profile, index) => {
        const isActive = index === state.activeIndex;
        const name = profile.name || profile.handle;
        const initials = String(name || profile.handle || '?').charAt(0).toUpperCase();
        const avatar = profile.photo
            ? `<img src="${escapeHtml(profile.photo)}" alt="" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`
            : `<span style="color:white; font-weight:800; font-size:0.78rem;">${escapeHtml(initials)}</span>`;
        return `
            <button type="button" data-feed-mention-index="${index}" style="width:100%; border:none; border-radius:10px; background:${isActive ? '#eef2ff' : 'transparent'}; color:var(--text-main); -webkit-text-fill-color:var(--text-main); padding:9px 10px; display:flex; align-items:center; gap:10px; text-align:left; cursor:pointer; font-family:inherit;">
                <span style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg, var(--primary), #10b981); display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden;">${avatar}</span>
                <span style="min-width:0; flex:1;">
                    <span style="display:block; font-size:0.86rem; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(name)}</span>
                    <span style="display:block; font-size:0.73rem; color:var(--text-muted); -webkit-text-fill-color:var(--text-muted); font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">@${escapeHtml(profile.handle)}</span>
                </span>
            </button>
        `;
    }).join('');

    Array.from(menu.querySelectorAll('[data-feed-mention-index]')).forEach(button => {
        button.addEventListener('mousedown', event => event.preventDefault());
        button.addEventListener('click', () => selectFeedMentionCandidate(Number(button.dataset.feedMentionIndex || 0)));
    });

    menu.style.display = 'block';
    positionFeedMentionMenu(state.input);
}

async function refreshFeedMentionSuggestions(input) {
    if (!isFeedMentionInput(input)) {
        closeFeedMentionMenu();
        return;
    }

    const activeSearch = getActiveFeedMentionSearch(input);
    if (!activeSearch) {
        closeFeedMentionMenu();
        return;
    }

    feedMentionState = {
        input,
        query: activeSearch.query,
        start: activeSearch.start,
        end: activeSearch.end,
        activeIndex: 0,
        results: []
    };

    const results = await loadFeedMentionCandidates(activeSearch.query);
    if (!feedMentionState || feedMentionState.input !== input || feedMentionState.query !== activeSearch.query) return;
    feedMentionState.results = results;
    renderFeedMentionMenu();
}

function queueFeedMentionSuggestions(input) {
    clearTimeout(feedMentionSearchTimer);
    const activeSearch = getActiveFeedMentionSearch(input);
    const delay = activeSearch && activeSearch.query.length >= 2 ? 160 : 40;
    feedMentionSearchTimer = setTimeout(() => refreshFeedMentionSuggestions(input), delay);
}

function selectFeedMentionCandidate(index) {
    const state = feedMentionState;
    if (!state || !state.input || !state.results || !state.results.length) return;

    const profile = state.results[Math.max(0, Math.min(index, state.results.length - 1))];
    if (!profile) return;

    rememberFeedMentionProfile(profile);

    const input = state.input;
    const before = String(input.value || '').slice(0, state.start);
    const after = String(input.value || '').slice(state.end).replace(/^\s+/, '');
    const insert = '@' + profile.handle + ' ';
    input.value = before + insert + after;

    const cursor = before.length + insert.length;
    try {
        input.focus();
        input.setSelectionRange(cursor, cursor);
    } catch (_) {}

    input.dispatchEvent(new Event('input', { bubbles: true }));
    closeFeedMentionMenu();
}

function moveFeedMentionActiveIndex(delta) {
    if (!feedMentionState || !feedMentionState.results || !feedMentionState.results.length) return;
    const count = feedMentionState.results.length;
    feedMentionState.activeIndex = (feedMentionState.activeIndex + delta + count) % count;
    renderFeedMentionMenu();
}

function initFeedMentionAutocomplete() {
    if (window.__feedMentionAutocompleteBound) return;
    window.__feedMentionAutocompleteBound = true;

    document.addEventListener('input', event => {
        if (isFeedMentionInput(event.target)) queueFeedMentionSuggestions(event.target);
    });

    document.addEventListener('focusin', event => {
        if (isFeedMentionInput(event.target)) queueFeedMentionSuggestions(event.target);
    });

    document.addEventListener('keydown', event => {
        if (!feedMentionState || event.target !== feedMentionState.input) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            moveFeedMentionActiveIndex(1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            moveFeedMentionActiveIndex(-1);
        } else if (event.key === 'Enter' || event.key === 'Tab') {
            if (feedMentionState.results && feedMentionState.results.length) {
                event.preventDefault();
                selectFeedMentionCandidate(feedMentionState.activeIndex);
            }
        } else if (event.key === 'Escape') {
            closeFeedMentionMenu();
        }
    });

    document.addEventListener('click', event => {
        const menu = document.getElementById('feed-mention-suggestions');
        if (menu && menu.contains(event.target)) return;
        if (isFeedMentionInput(event.target)) {
            queueFeedMentionSuggestions(event.target);
            return;
        }
        closeFeedMentionMenu();
    });

    window.addEventListener('resize', () => {
        if (feedMentionState?.input) positionFeedMentionMenu(feedMentionState.input);
    });
}

initFeedMentionAutocomplete();

function buildWorkoutFeedShareCaption(workoutName, exerciseName) {
    const cleanWorkout = String(workoutName || '').trim();
    const cleanExercise = String(exerciseName || '').trim();

    if (cleanExercise && cleanWorkout) {
        return `Shared ${cleanExercise} during ${cleanWorkout}`;
    }
    if (cleanWorkout) {
        return `Shared this set during ${cleanWorkout}`;
    }
    if (cleanExercise) {
        return `Shared ${cleanExercise}`;
    }
    return 'Shared this set';
}

function buildWorkoutFeedSharePhotoHash(file) {
    if (!file) return '';
    return [
        'workout-feed-share',
        String(file.name || 'clip'),
        String(file.size || 0),
        String(file.lastModified || 0)
    ].join(':');
}

async function uploadFeedComposerMedia(file, mediaType, postBtn, options = {}) {
    let fileToUpload = file;
    const originalSize = (fileToUpload.size / (1024 * 1024)).toFixed(1);
    const uploadSource = options.source || 'feed_composer';
    const tempStoryId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

    if (mediaType === 'video' && !options.skipVideoPreparation) {
        if (postBtn) postBtn.textContent = `Compressing ${originalSize}MB`;
        fileToUpload = await prepareUploadableVideo(fileToUpload, (status) => {
            if (postBtn) postBtn.textContent = status;
        }, {
            maxBytes: FEED_VIDEO_UPLOAD_TARGET_BYTES
        });
    } else if (mediaType === 'image' && fileToUpload.size > 2 * 1024 * 1024) {
        if (postBtn) postBtn.textContent = `Compressing ${originalSize}MB`;
        fileToUpload = await compressImage(fileToUpload, (status) => {
            if (postBtn) postBtn.textContent = status;
        });
    }

    let thumbnailUrl = await generateThumbnail(fileToUpload, mediaType);
    if (!thumbnailUrl) thumbnailUrl = getPublicFeedMediaUrl(getProfilePhotoThumbnail());

    let mediaUrl = '';
    let analysisBase64 = null;
    let imageDataUrl = null;

    if (mediaType === 'image') {
        imageDataUrl = await readFeedComposerImageDataUrlSafely(fileToUpload);
        analysisBase64 = getBase64Payload(imageDataUrl);
    }

    let uploadData = null;
    let thumbnailUploadData = null;
    try {
        uploadData = await uploadStoryMediaToBackblaze(fileToUpload, {
            userId: window.currentUser.id,
            storyId: tempStoryId,
            source: uploadSource,
            postBtn,
            timeoutMs: options.uploadTimeoutMs || options.timeoutMs,
            abortSignal: options.abortSignal || options.signal
        });
        assertFeedUploadMatchesMediaType(mediaType, fileToUpload, uploadData);
        mediaUrl = uploadData.url;

        if (mediaType === 'video' && isInlineDataUrl(thumbnailUrl)) {
            const thumbnailFile = feedThumbnailDataUrlToFile(thumbnailUrl, `${tempStoryId}-thumbnail.jpg`);
            if (thumbnailFile) {
                if (postBtn) postBtn.textContent = 'Uploading thumbnail...';
                thumbnailUploadData = await uploadStoryMediaToBackblaze(thumbnailFile, {
                    userId: window.currentUser.id,
                    storyId: `${tempStoryId}-thumbnail`,
                    source: `${uploadSource}_thumbnail`,
                    postBtn,
                    timeoutMs: options.thumbnailUploadTimeoutMs || 30000,
                    abortSignal: options.abortSignal || options.signal
                });
                thumbnailUrl = thumbnailUploadData.url;
            }
        }
    } catch (error) {
        throw error;
    }

    thumbnailUrl = getPublicFeedMediaUrl(thumbnailUrl) || null;

    return {
        mediaUrl,
        thumbnailUrl,
        analysisBase64,
        mimeType: fileToUpload.type || file.type || '',
        uploadData,
        thumbnailUploadData
    };
}

window.createWorkoutFeedSharePost = async function(options = {}) {
    const userId = window.currentUser?.id;
    const file = options.file || null;

    if (!userId) {
        throw new Error('Please log in to post.');
    }
    if (!file) {
        throw new Error('Record a set first.');
    }

    const postBtn = options.postBtn || null;
    const mediaType = options.mediaType || getFeedComposerMediaType(file);
    if (mediaType !== 'video') {
        throw new Error('Share a Set needs a video clip.');
    }

    const upload = await uploadFeedComposerMedia(file, mediaType, postBtn, {
        source: options.source || 'feed_workout_share',
        skipVideoPreparation: options.skipVideoPreparation === true,
        uploadTimeoutMs: options.uploadTimeoutMs || options.timeoutMs,
        abortSignal: options.abortSignal || options.signal
    });
    const workoutName = String(options.workoutName || '').trim();
    const exerciseName = String(options.exerciseName || '').trim();
    const caption = String(options.caption || '').trim() || buildWorkoutFeedShareCaption(workoutName, exerciseName);
    const story = await dbHelpers.stories.create(userId, {
        media_type: mediaType,
        media_url: upload.mediaUrl,
        thumbnail_url: upload.thumbnailUrl,
        caption: caption,
        duration: 10,
        background_color: '#0f172a',
        expires_at: new Date(Date.now() + FEED_COMPOSER_POST_TTL_MS).toISOString()
    });

    if (story?.id && upload.mediaUrl) {
        await archiveFeedMediaAsset({
            story,
            userId,
            mediaType,
            mediaUrl: upload.mediaUrl,
            thumbnailUrl: upload.thumbnailUrl,
            caption: caption,
            uploadData: upload.uploadData || null,
            mimeType: upload.mimeType,
            source: options.source || 'feed_workout_share'
        });
    }
    let awardResult = null;
    if (story?.id && options.awardPoints !== false && window.db?.points && typeof window.db.points.awardPoints === 'function') {
        const awardType = options.pointsType || 'workout_feed_share';
        const photoTimestamp = options.photoTimestamp || new Date().toISOString();
        const photoHash = options.photoHash || buildWorkoutFeedSharePhotoHash(file);
        try {
            awardResult = await window.db.points.awardPoints(userId, awardType, story.id, {
                photoTimestamp: photoTimestamp,
                aiConfidence: options.aiConfidence || 'high',
                photoHash: photoHash
            });
        } catch (error) {
            console.warn('Workout feed share XP award failed:', error);
            awardResult = {
                success: false,
                error: error?.message || 'Could not award XP.'
            };
        }
    }

    const pointsAwarded = Number(awardResult?.pointsAwarded ?? story?.points_awarded ?? 0);
    return {
        story,
        pointsAwarded,
        awardResult,
        mediaType,
        mediaUrl: upload.mediaUrl,
        thumbnailUrl: upload.thumbnailUrl,
        uploadData: upload.uploadData || null,
        caption
    };
};

function getFeedShareClient() {
    return window.supabaseClient || window.supabase || null;
}

async function refreshFeedAfterDirectShare() {
    const tasks = [];
    if (typeof loadPhotoFeed === 'function') {
        tasks.push(loadPhotoFeed('friends-photo-feed', 'friends-feed-empty'));
    }
    if (typeof loadStoriesCarousel === 'function') {
        tasks.push(loadStoriesCarousel());
    }
    if (typeof loadStories === 'function') {
        tasks.push(loadStories());
    }
    if (typeof window.refreshWeeklyGoalsCard === 'function') {
        tasks.push(window.refreshWeeklyGoalsCard());
    }
    await Promise.allSettled(tasks);
}

function toFeedShareNumber(value) {
    const num = Number(value || 0);
    return Number.isFinite(num) ? num : 0;
}

function formatFeedShareNumber(value) {
    const num = toFeedShareNumber(value);
    if (!num) return '0';
    return Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
}

function toFeedShareOptionalNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function parseFeedShareTime(value) {
    if (!value) return NaN;
    const raw = String(value);
    const timeValue = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? `${raw}T12:00:00`
        : raw;
    const time = new Date(timeValue).getTime();
    return Number.isFinite(time) ? time : NaN;
}

function getFeedShareWorkoutDate(row) {
    const rawDate = row?.workout_date || row?.date || row?.created_at || '';
    if (!rawDate) return '';
    const dateText = String(rawDate);
    if (/^\d{4}-\d{2}-\d{2}/.test(dateText)) return dateText.slice(0, 10);
    const time = parseFeedShareTime(dateText);
    return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : '';
}

function getFeedShareRowTime(row) {
    const createdTime = parseFeedShareTime(row?.created_at);
    if (Number.isFinite(createdTime)) return createdTime;
    return parseFeedShareTime(row?.workout_date || row?.date);
}

function formatFeedShareDateLabel(value, options = {}) {
    const time = parseFeedShareTime(value);
    if (!Number.isFinite(time)) return '';
    return new Date(time).toLocaleDateString(undefined, Object.assign({
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    }, options));
}

function sortFeedShareWorkoutRowsForCard(rows) {
    return (rows || []).slice().sort((a, b) => {
        const timeA = getFeedShareRowTime(a);
        const timeB = getFeedShareRowTime(b);
        if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
            return timeA - timeB;
        }
        return toFeedShareNumber(a?.set_number) - toFeedShareNumber(b?.set_number);
    });
}

function getFeedShareWorkoutNameFromRows(rows, exercises) {
    const namedRow = (rows || []).find(row => {
        const name = String(row?.template_name || row?.workout_name || '').trim();
        return name && name.toLowerCase() !== 'history';
    });
    if (namedRow) return String(namedRow.template_name || namedRow.workout_name).trim();
    return exercises.length === 1 ? exercises[0].name : 'Workout complete';
}

function groupWorkoutRowsForFeedShare(rows, maxSessions = 6) {
    const sorted = (rows || [])
        .filter(row => row && row.exercise_name)
        .sort((a, b) => {
            const timeA = getFeedShareRowTime(a);
            const timeB = getFeedShareRowTime(b);
            if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
                return timeB - timeA;
            }
            return String(getFeedShareWorkoutDate(b)).localeCompare(String(getFeedShareWorkoutDate(a)));
        });

    const sessions = [];
    let current = null;
    const gapMs = 45 * 60 * 1000;

    sorted.forEach(row => {
        const workoutDate = getFeedShareWorkoutDate(row);
        const rowTime = getFeedShareRowTime(row);
        const dateChanged = current && workoutDate && current.workoutDate && workoutDate !== current.workoutDate;
        const timeGap = current && Number.isFinite(rowTime) && Number.isFinite(current.lastTime)
            ? Math.abs(current.lastTime - rowTime)
            : 0;
        const shouldStartSession = !current || dateChanged || timeGap > gapMs;

        if (shouldStartSession) {
            current = {
                id: `workout-session-${sessions.length}`,
                workoutDate,
                firstTime: rowTime,
                lastTime: rowTime,
                rows: []
            };
            sessions.push(current);
        }

        current.rows.push(row);
        if (Number.isFinite(rowTime)) current.lastTime = rowTime;
    });

    return sessions.slice(0, maxSessions).map((session, index) => {
        const sessionRows = sortFeedShareWorkoutRowsForCard(session.rows);
        const cardPayload = buildWorkoutCardPayloadFromRows(sessionRows);
        const exerciseCount = cardPayload.exercises?.length || 0;
        const dateLabel = cardPayload.date_label || formatFeedShareDateLabel(session.workoutDate);
        const setLabel = `${cardPayload.total_sets || sessionRows.length} set${(cardPayload.total_sets || sessionRows.length) === 1 ? '' : 's'}`;
        const exerciseLabel = `${exerciseCount} exercise${exerciseCount === 1 ? '' : 's'}`;
        return {
            id: session.id || `workout-session-${index}`,
            rows: sessionRows,
            cardPayload,
            title: cardPayload.workout_name || 'Workout complete',
            detail: [dateLabel, setLabel, exerciseLabel].filter(Boolean).join(' - ')
        };
    });
}

function getLatestWorkoutSessionRows(rows) {
    const sessions = groupWorkoutRowsForFeedShare(rows, 1);
    return sessions[0]?.rows || [];
}

function buildWorkoutCardPayloadFromRows(rows) {
    const workoutRows = sortFeedShareWorkoutRowsForCard(Array.isArray(rows) ? rows : []);
    const first = workoutRows[0] || {};
    const workoutDate = getFeedShareWorkoutDate(first) || new Date().toISOString().slice(0, 10);
    const exerciseMap = new Map();
    let totalVolume = 0;

    workoutRows.forEach(row => {
        const name = String(row.exercise_name || 'Exercise').trim() || 'Exercise';
        const reps = toFeedShareNumber(row.reps);
        const weight = toFeedShareNumber(row.weight_kg);
        totalVolume += reps * weight;

        const current = exerciseMap.get(name) || { name, sets: 0, bestVolume: -1, best: '' };
        current.sets += 1;
        const bestVolume = reps * weight;
        const best = weight > 0 && reps > 0
            ? `${formatFeedShareNumber(weight)}kg x ${formatFeedShareNumber(reps)}`
            : reps > 0
                ? `${formatFeedShareNumber(reps)} reps`
                : '';
        if (best && bestVolume >= current.bestVolume) {
            current.bestVolume = bestVolume;
            current.best = best;
        }
        exerciseMap.set(name, current);
    });

    const exercises = Array.from(exerciseMap.values()).map(item => ({
        name: item.name,
        best: item.best || `${item.sets} set${item.sets === 1 ? '' : 's'}`
    }));

    const totalVolumeLabel = totalVolume > 0
        ? `${Math.round(totalVolume).toLocaleString()} kg`
        : '';
    const dateLabel = workoutDate ? formatFeedShareDateLabel(workoutDate) : '';

    return {
        card_type: 'workout',
        workout_name: getFeedShareWorkoutNameFromRows(workoutRows, exercises),
        workout_date: workoutDate,
        date_label: dateLabel,
        total_sets: workoutRows.length,
        total_volume: totalVolumeLabel,
        exercises,
        share_caption: exercises.length
            ? `Shared ${workoutRows.length} set${workoutRows.length === 1 ? '' : 's'} from ${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`
            : 'Shared a workout'
    };
}

async function getLatestWorkoutRowsForFeedShare() {
    const client = getFeedShareClient();
    const userId = window.currentUser?.id;
    if (!client || !userId) {
        throw new Error('Workout history is still loading.');
    }

    const { data: latest, error: latestError } = await client
        .from('workouts')
        .select('workout_date, created_at')
        .eq('user_id', userId)
        .eq('workout_type', 'history')
        .not('workout_date', 'is', null)
        .order('workout_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (latestError) throw latestError;
    if (!latest?.workout_date) {
        throw new Error('No completed workout found.');
    }

    const { data: rows, error } = await client
        .from('workouts')
        .select('workout_date, exercise_name, set_number, reps, weight_kg, time_duration, created_at, template_name')
        .eq('user_id', userId)
        .eq('workout_type', 'history')
        .eq('workout_date', latest.workout_date)
        .order('created_at', { ascending: false })
        .order('set_number', { ascending: true })
        .limit(80);

    if (error) throw error;
    const sessionRows = getLatestWorkoutSessionRows(rows || []);
    if (!sessionRows.length) {
        throw new Error('No completed workout sets found.');
    }
    return sessionRows;
}

async function getRecentWorkoutSessionsForFeedShare(limit = 6) {
    const client = getFeedShareClient();
    const userId = window.currentUser?.id;
    if (!client || !userId) {
        throw new Error('Workout history is still loading.');
    }

    const { data: rows, error } = await client
        .from('workouts')
        .select('workout_date, exercise_name, set_number, reps, weight_kg, time_duration, created_at, template_name')
        .eq('user_id', userId)
        .eq('workout_type', 'history')
        .not('workout_date', 'is', null)
        .order('workout_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(240);

    if (error) throw error;
    return groupWorkoutRowsForFeedShare(rows || [], limit);
}

function buildPBCardPayloadFromHistoryRow(row) {
    if (!row) return null;
    const pbType = String(row.pb_type || row.type || 'weight').toLowerCase() === 'reps' ? 'reps' : 'weight';
    const value = toFeedShareOptionalNumber(row.new_value ?? row.value) ?? 0;
    const reps = toFeedShareOptionalNumber(row.new_reps ?? row.reps);
    const weight = toFeedShareOptionalNumber(row.new_weight_kg ?? row.weight);
    const improvement = toFeedShareOptionalNumber(row.improvement);
    const previous = toFeedShareOptionalNumber(row.previous_value ?? row.previous);

    return {
        card_type: 'pb',
        exercise: String(row.exercise_name || row.exercise || 'Personal best').trim() || 'Personal best',
        pb_type: pbType,
        value,
        reps: pbType === 'weight' ? (reps || 1) : reps,
        weight: pbType === 'reps' ? (weight || 0) : weight,
        improvement,
        previous
    };
}

function formatFeedSharePBValue(cardPayload) {
    if (!cardPayload) return '';
    if (cardPayload.pb_type === 'weight') {
        const reps = cardPayload.reps ? ` x ${formatFeedShareNumber(cardPayload.reps)}` : '';
        return `${formatFeedShareNumber(cardPayload.value)} kg${reps}`;
    }
    const weight = cardPayload.weight ? ` @ ${formatFeedShareNumber(cardPayload.weight)} kg` : '';
    return `${formatFeedShareNumber(cardPayload.value)} reps${weight}`;
}

async function getRecentPBsForFeedShare(limit = 8) {
    const client = getFeedShareClient();
    const userId = window.currentUser?.id;
    if (!client || !userId) {
        throw new Error('Personal bests are still loading.');
    }

    const { data: rows, error } = await client
        .from('pb_history')
        .select('*')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (rows || [])
        .map((row, index) => {
            const cardPayload = buildPBCardPayloadFromHistoryRow(row);
            if (!cardPayload) return null;
            const dateLabel = formatFeedShareDateLabel(row.achieved_at || row.workout_date || row.created_at, {
                month: 'short',
                day: 'numeric'
            });
            return {
                id: row.id || `pb-history-${index}`,
                row,
                cardPayload,
                title: cardPayload.exercise || 'Personal best',
                detail: [formatFeedSharePBValue(cardPayload), dateLabel].filter(Boolean).join(' - ')
            };
        })
        .filter(Boolean);
}

async function createFeedWorkoutCardStory(cardPayload, backgroundColor) {
    if (!window.currentUser?.id) {
        showFeedComposerToast('Please log in to share to Feed.', 'error');
        return null;
    }

    const helpers = window.dbHelpers || (typeof dbHelpers !== 'undefined' ? dbHelpers : null);
    if (!helpers?.stories || typeof helpers.stories.create !== 'function') {
        showFeedComposerToast('Feed is still loading. Try again in a moment.', 'info');
        return null;
    }

    if (!cardPayload) {
        showFeedComposerToast('Nothing was selected to share.', 'info');
        return null;
    }

    return helpers.stories.create(window.currentUser.id, {
        media_type: 'workout_card',
        media_url: '',
        thumbnail_url: null,
        caption: JSON.stringify(cardPayload),
        duration: 5,
        background_color: backgroundColor || '#064e3b',
        expires_at: new Date(Date.now() + FEED_COMPOSER_POST_TTL_MS).toISOString()
    });
}

let feedWorkoutShareChooserState = {
    isOpen: false,
    isLoading: false,
    isSharing: false,
    workouts: [],
    pbs: [],
    error: ''
};

function ensureFeedWorkoutShareChooser() {
    let chooser = document.getElementById('feed-workout-share-chooser');
    if (chooser) return chooser;
    if (!document.body) return null;

    chooser = document.createElement('div');
    chooser.id = 'feed-workout-share-chooser';
    chooser.setAttribute('role', 'dialog');
    chooser.setAttribute('aria-modal', 'true');
    chooser.setAttribute('aria-label', 'Choose workout or personal best to share');
    chooser.style.cssText = 'display:none; position:fixed; inset:0; z-index:100000; align-items:flex-end; justify-content:center; background:rgba(15,23,42,0.48); padding:12px; box-sizing:border-box; color:#111827; -webkit-text-fill-color:#111827; text-shadow:none;';
    chooser.innerHTML = `
        <div data-feed-workout-share-sheet style="width:min(100%, 540px); max-height:min(82vh, 720px); background:#ffffff; color:#111827; -webkit-text-fill-color:#111827; border:1px solid #d1fae5; border-radius:18px 18px 14px 14px; box-shadow:0 24px 60px rgba(15,23,42,0.28); display:flex; flex-direction:column; overflow:hidden; opacity:1; backdrop-filter:none; -webkit-backdrop-filter:none;">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:16px 16px 12px; border-bottom:1px solid #ecfdf5; background:#ffffff; color:#111827; -webkit-text-fill-color:#111827;">
                <div style="min-width:0;">
                    <div style="font-size:1rem; font-weight:900; color:#111827; -webkit-text-fill-color:#111827; line-height:1.2;">Choose workout or PB</div>
                    <div style="font-size:0.78rem; font-weight:700; color:#4b5563; -webkit-text-fill-color:#4b5563; line-height:1.35; margin-top:4px;">Pick the exact workout or personal best to post to Feed.</div>
                </div>
                <button type="button" onclick="closeFeedWorkoutShareChooser()" aria-label="Close share chooser" style="width:36px; height:36px; border:none; border-radius:50%; background:#f3f4f6; color:#111827; -webkit-text-fill-color:#111827; font-size:1.4rem; line-height:1; cursor:pointer; flex-shrink:0;">&times;</button>
            </div>
            <div id="feed-workout-share-chooser-content" style="overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; padding:14px 14px calc(14px + env(safe-area-inset-bottom)); background:#ffffff; color:#111827; -webkit-text-fill-color:#111827;"></div>
        </div>
    `;
    chooser.addEventListener('click', event => {
        if (event.target === chooser) window.closeFeedWorkoutShareChooser();
    });
    document.body.appendChild(chooser);
    return chooser;
}

function renderFeedWorkoutShareChooser() {
    const content = document.getElementById('feed-workout-share-chooser-content');
    if (!content) return;

    const state = feedWorkoutShareChooserState;
    if (state.isLoading) {
        content.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; gap:10px; min-height:190px; color:#111827; -webkit-text-fill-color:#111827; font-weight:800;">
                <span style="display:inline-flex; width:20px; height:20px; border:2px solid #0f766e; border-right-color:transparent; border-radius:50%; animation:spin 0.85s linear infinite;"></span>
                Loading workouts and PBs...
            </div>
        `;
        return;
    }

    const optionStyle = 'width:100%; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px; border:1px solid #e5e7eb; border-radius:12px; background:#ffffff; color:#111827; -webkit-text-fill-color:#111827; font-family:inherit; text-align:left; cursor:pointer; box-shadow:0 1px 3px rgba(15,23,42,0.05);';
    const mutedStyle = 'font-size:0.74rem; font-weight:700; color:#6b7280; -webkit-text-fill-color:#6b7280; line-height:1.35; margin-top:3px;';
    const sharePillStyle = 'font-size:0.72rem; font-weight:900; color:#0f766e; -webkit-text-fill-color:#0f766e; background:#ecfdf5; border-radius:999px; padding:6px 9px; flex-shrink:0;';

    const workoutHtml = state.workouts.length
        ? state.workouts.map((workout, index) => `
            <button type="button" onclick="shareFeedWorkoutChooserWorkout(${index})" ${state.isSharing ? 'disabled' : ''} style="${optionStyle}${state.isSharing ? 'opacity:0.65; cursor:wait;' : ''}">
                <span style="min-width:0;">
                    <span style="display:block; font-size:0.9rem; font-weight:900; color:#111827; -webkit-text-fill-color:#111827; line-height:1.25;">${escapeHtml(workout.title)}</span>
                    <span style="display:block; ${mutedStyle}">${escapeHtml(workout.detail || 'Workout summary')}</span>
                </span>
                <span style="${sharePillStyle}">Share</span>
            </button>
        `).join('')
        : '<div style="padding:12px; border:1px dashed #d1d5db; border-radius:12px; color:#6b7280; -webkit-text-fill-color:#6b7280; font-size:0.82rem; font-weight:700;">No completed workouts found yet.</div>';

    const pbHtml = state.pbs.length
        ? state.pbs.map((pb, index) => `
            <button type="button" onclick="shareFeedWorkoutChooserPB(${index})" ${state.isSharing ? 'disabled' : ''} style="${optionStyle}${state.isSharing ? 'opacity:0.65; cursor:wait;' : ''}">
                <span style="min-width:0;">
                    <span style="display:block; font-size:0.9rem; font-weight:900; color:#111827; -webkit-text-fill-color:#111827; line-height:1.25;">${escapeHtml(pb.title)}</span>
                    <span style="display:block; ${mutedStyle}">${escapeHtml(pb.detail || 'Personal best')}</span>
                </span>
                <span style="${sharePillStyle}">Share</span>
            </button>
        `).join('')
        : '<div style="padding:12px; border:1px dashed #d1d5db; border-radius:12px; color:#6b7280; -webkit-text-fill-color:#6b7280; font-size:0.82rem; font-weight:700;">No personal bests found yet.</div>';

    const emptyMessage = !state.workouts.length && !state.pbs.length && !state.error
        ? '<div style="margin-bottom:12px; padding:12px; border-radius:12px; background:#fef3c7; color:#92400e; -webkit-text-fill-color:#92400e; font-size:0.82rem; font-weight:800;">Complete a workout or hit a PB first, then it will show here.</div>'
        : '';

    content.innerHTML = `
        ${state.error ? `<div style="margin-bottom:12px; padding:12px; border-radius:12px; background:#fef2f2; color:#991b1b; -webkit-text-fill-color:#991b1b; font-size:0.82rem; font-weight:800;">${escapeHtml(state.error)}</div>` : ''}
        ${emptyMessage}
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:16px;">
            <div style="font-size:0.72rem; font-weight:900; text-transform:uppercase; letter-spacing:0; color:#047857; -webkit-text-fill-color:#047857;">Recent workouts</div>
            ${workoutHtml}
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="font-size:0.72rem; font-weight:900; text-transform:uppercase; letter-spacing:0; color:#92400e; -webkit-text-fill-color:#92400e;">Personal bests</div>
            ${pbHtml}
        </div>
    `;
}

async function loadFeedWorkoutShareChooserData() {
    feedWorkoutShareChooserState.isLoading = true;
    feedWorkoutShareChooserState.error = '';
    renderFeedWorkoutShareChooser();

    const [workoutResult, pbResult] = await Promise.allSettled([
        getRecentWorkoutSessionsForFeedShare(6),
        getRecentPBsForFeedShare(8)
    ]);

    feedWorkoutShareChooserState.workouts = workoutResult.status === 'fulfilled' ? workoutResult.value : [];
    feedWorkoutShareChooserState.pbs = pbResult.status === 'fulfilled' ? pbResult.value : [];
    feedWorkoutShareChooserState.isLoading = false;

    if (workoutResult.status === 'rejected' && pbResult.status === 'rejected') {
        console.error('Error loading Feed workout share chooser:', workoutResult.reason, pbResult.reason);
        feedWorkoutShareChooserState.error = 'Could not load workouts or PBs. Try again in a moment.';
    } else {
        if (workoutResult.status === 'rejected') console.warn('Could not load workout share options:', workoutResult.reason);
        if (pbResult.status === 'rejected') console.warn('Could not load PB share options:', pbResult.reason);
    }

    renderFeedWorkoutShareChooser();
}

window.closeFeedWorkoutShareChooser = function() {
    const chooser = document.getElementById('feed-workout-share-chooser');
    if (chooser) chooser.style.display = 'none';
    feedWorkoutShareChooserState.isOpen = false;
    feedWorkoutShareChooserState.isSharing = false;
};

window.openFeedWorkoutShareChooser = async function() {
    if (!window.currentUser?.id) {
        showFeedComposerToast('Please log in to share to Feed.', 'error');
        return;
    }

    const chooser = ensureFeedWorkoutShareChooser();
    if (!chooser) {
        showFeedComposerToast('Share chooser is still loading. Try again in a moment.', 'info');
        return;
    }

    feedWorkoutShareChooserState.isOpen = true;
    feedWorkoutShareChooserState.isSharing = false;
    chooser.style.display = 'flex';
    await loadFeedWorkoutShareChooserData();
};

if (!window.__feedWorkoutShareChooserDismissBound) {
    window.__feedWorkoutShareChooserDismissBound = true;
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') window.closeFeedWorkoutShareChooser();
    });
}

window.shareLatestWorkoutToFeed = async function(options = {}) {
    if (!window.currentUser?.id) {
        showFeedComposerToast('Please log in to share a workout.', 'error');
        return null;
    }

    try {
        const rows = Array.isArray(options.rows) && options.rows.length ? options.rows : await getLatestWorkoutRowsForFeedShare();
        const cardPayload = options.cardPayload || buildWorkoutCardPayloadFromRows(rows);
        const story = await createFeedWorkoutCardStory(cardPayload, '#064e3b');
        if (!story) return null;

        await refreshFeedAfterDirectShare();
        const pointsAwarded = Number(story?.points_awarded || 0);
        showFeedComposerToast(pointsAwarded > 0 ? `Workout shared! +${pointsAwarded} XP` : 'Workout shared to Feed.', 'success');
        return story;
    } catch (error) {
        console.error('Error sharing latest workout to feed:', error);
        showFeedComposerToast(error?.message || 'Could not share workout. Try again in a moment.', 'error');
        return null;
    }
};

window.shareFeedWorkoutChooserWorkout = async function(index) {
    const option = feedWorkoutShareChooserState.workouts[Number(index)];
    if (!option) {
        showFeedComposerToast('Choose a workout to share.', 'info');
        return;
    }

    feedWorkoutShareChooserState.isSharing = true;
    renderFeedWorkoutShareChooser();
    try {
        const story = await window.shareLatestWorkoutToFeed({
            rows: option.rows,
            cardPayload: option.cardPayload
        });
        if (story) window.closeFeedWorkoutShareChooser();
    } finally {
        feedWorkoutShareChooserState.isSharing = false;
        renderFeedWorkoutShareChooser();
    }
};

window.shareFeedWorkoutChooserPB = async function(index) {
    const option = feedWorkoutShareChooserState.pbs[Number(index)];
    if (!option?.cardPayload) {
        showFeedComposerToast('Choose a personal best to share.', 'info');
        return;
    }

    feedWorkoutShareChooserState.isSharing = true;
    renderFeedWorkoutShareChooser();
    try {
        const story = await createFeedWorkoutCardStory(option.cardPayload, '#f59e0b');
        if (!story) return;
        await refreshFeedAfterDirectShare();
        const pointsAwarded = Number(story?.points_awarded || 0);
        showFeedComposerToast(pointsAwarded > 0 ? `PB shared! +${pointsAwarded} XP` : 'PB shared to Feed.', 'success');
        window.closeFeedWorkoutShareChooser();
    } catch (error) {
        console.error('Error sharing PB to feed:', error);
        showFeedComposerToast(error?.message || 'Could not share PB. Try again in a moment.', 'error');
    } finally {
        feedWorkoutShareChooserState.isSharing = false;
        renderFeedWorkoutShareChooser();
    }
};

window.openFeedComposerShareSource = async function(source) {
    const shareSource = String(source || '').toLowerCase();
    setFeedComposerShareMenuOpen(false);

    if (!window.currentUser?.id) {
        showFeedComposerToast('Please log in to share to Feed.', 'error');
        return;
    }

    if (shareSource === 'set') {
        if (typeof window.openWorkoutFeedShare === 'function') {
            window.openWorkoutFeedShare({
                source: 'feed',
                workoutName: window.currentWorkoutName || ''
            });
        } else {
            showFeedComposerToast('Share a Set is still loading. Try again in a moment.', 'info');
        }
        return;
    }

    if (shareSource === 'meal') {
        if (typeof window.shareLatestMealToFeed !== 'function') {
            showFeedComposerToast('Meal sharing is still loading. Try again in a moment.', 'info');
            return;
        }
        setFeedComposerShareActionLoading(true, 'Meal');
        try {
            await window.shareLatestMealToFeed();
        } finally {
            setFeedComposerShareActionLoading(false);
        }
        return;
    }

    if (shareSource === 'workout') {
        await window.openFeedWorkoutShareChooser();
        return;
    }

    showFeedComposerToast('Choose something to share.', 'info');
};

window.submitFeedComposerPost = async function() {
    const postBtn = document.getElementById('feed-composer-post-btn');
    const caption = getFeedComposerText();

    if (!window.currentUser?.id) {
        showFeedComposerToast('Please log in to post.', 'error');
        return;
    }

    if (!caption && !feedComposerFile) {
        showFeedComposerToast('Add text, a photo, or a video first.', 'info');
        return;
    }

    try {
        if (postBtn) {
            postBtn.dataset.loading = 'true';
            postBtn.disabled = true;
            postBtn.style.opacity = '0.45';
            postBtn.textContent = 'Posting...';
        }

        let mediaType = 'text';
        let mediaUrl = '';
        let thumbnailUrl = null;
        let imageBase64 = null;
        let mimeType = '';
        let uploadData = null;

        if (feedComposerFile) {
            mediaType = getFeedComposerMediaType(feedComposerFile);
            const upload = await uploadFeedComposerMedia(feedComposerFile, mediaType, postBtn);
            mediaUrl = upload.mediaUrl;
            thumbnailUrl = upload.thumbnailUrl;
            imageBase64 = upload.analysisBase64;
            mimeType = upload.mimeType;
            uploadData = upload.uploadData || null;
        }

        if (postBtn) postBtn.textContent = 'Saving...';

        const story = await dbHelpers.stories.create(window.currentUser.id, {
            media_type: mediaType,
            media_url: mediaUrl,
            thumbnail_url: thumbnailUrl,
            caption: caption || null,
            duration: mediaType === 'video' ? 10 : 5,
            background_color: '#f8fafc',
            expires_at: new Date(Date.now() + FEED_COMPOSER_POST_TTL_MS).toISOString()
        });

        if (mediaType === 'image' && imageBase64 && story?.id && typeof analyzeStoryForPoints === 'function') {
            analyzeStoryForPoints(window.currentUser.id, story.id, imageBase64, mimeType).catch((error) => {
                console.warn('Feed composer story points analysis failed:', error);
            });
        }

        if (story?.id && mediaUrl) {
            await archiveFeedMediaAsset({
                story,
                userId: window.currentUser.id,
                mediaType,
                mediaUrl,
                thumbnailUrl,
                caption: caption || null,
                uploadData,
                mimeType,
                source: 'feed_composer'
            });
        }

        resetFeedComposer();
        const pointsAwarded = Number(story?.points_awarded || 0);
        showFeedComposerToast(pointsAwarded > 0 ? `Posted to Feed! +${pointsAwarded} XP` : 'Posted to Feed!', 'success');

        if (typeof loadPhotoFeed === 'function') {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
        }
        if (typeof loadStories === 'function') {
            loadStories();
        }
    } catch (error) {
        console.error('Error creating feed post:', error);
        showFeedComposerToast('Failed to post. Please try again.', 'error');
    } finally {
        if (postBtn) {
            postBtn.dataset.loading = 'false';
            postBtn.textContent = 'Post';
            window.updateFeedComposerState();
        }
    }
};

function renderFeedPostUnavailable(story, storyId) {
    const safeStoryId = escapeJsString(storyId || '');
    const canOpen = !!safeStoryId;
    const safeUserName = escapeHtml((story && story.user_name) || 'Unknown');
    const initial = ((story && story.user_name) ? story.user_name.charAt(0).toUpperCase() : '?');
    const timeAgo = story && story.created_at ? getTimeAgo(new Date(story.created_at)) : '';
    const avatarHtml = story && story.profile_photo
        ? `<img src="${escapeHtml(story.profile_photo)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
        : `<span style="font-size:0.7rem; color:white; font-weight:700;">${escapeHtml(initial)}</span>`;
    const progressPhotoPayload = getProgressPhotoSetPayload(story);
    const captionText = progressPhotoPayload ? getProgressPhotoCaptionText(story) : (story && story.caption);
    const captionHtml = captionText
        ? `<div style="padding:0 14px 14px; font-size:0.85rem; color:var(--text-main); line-height:1.4; word-break:break-word;">${formatFeedText(captionText)}</div>`
        : '';
    const openAttr = canOpen ? ` onclick="openFeedPostViewer('${safeStoryId}')"` : '';

    return `
        <div class="feed-post-card feed-post-card-unavailable" data-story-id="${escapeHtml(storyId || '')}" style="background:white; border-bottom:8px solid #f1f5f9;">
            <div style="display:flex; align-items:center; padding:10px 14px; gap:10px;">
                <div style="width:34px; height:34px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; border:2px solid #e5e7eb;">
                    ${avatarHtml}
                </div>
                <div style="flex:1; min-width:0;">
                    <div style="font-weight:600; font-size:0.85rem; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safeUserName}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted);">${escapeHtml(timeAgo)}</div>
                </div>
            </div>
            <div${openAttr} style="min-height:160px; background:#f8fafc; display:flex; align-items:center; justify-content:center; padding:28px; text-align:center; color:var(--text-muted); font-size:0.86rem; font-weight:700; ${canOpen ? 'cursor:pointer;' : ''}">
                Post unavailable
            </div>
            ${captionHtml}
        </div>
    `;
}

function getPhotoFeedState(targetGridId, emptyStateId) {
    const key = `${targetGridId}::${emptyStateId}`;
    let state = feedPaginationStates.get(key);
    if (!state) {
        const safeIdPart = String(key)
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 80) || 'main';
        state = {
            targetGridId,
            emptyStateId,
            offset: 0,
            hasMore: true,
            loading: false,
            observer: null,
            loadedStories: [],
            loadedStoryIds: new Set(),
            sentinelId: `feed-pagination-${safeIdPart}`
        };
        feedPaginationStates.set(key, state);
    }
    return state;
}

function resetPhotoFeedState(state) {
    if (!state) return;
    if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
    }
    state.offset = 0;
    state.hasMore = true;
    state.loadedStories = [];
    state.loadedStoryIds = new Set();
}

function removePhotoFeedPager(state) {
    if (!state) return;
    if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
    }
    const sentinel = document.getElementById(state.sentinelId);
    if (sentinel) sentinel.remove();
}

function setPhotoFeedPagerLoading(state) {
    const sentinel = state ? document.getElementById(state.sentinelId) : null;
    if (sentinel) {
        sentinel.innerHTML = '<span>Loading more...</span>';
    }
}

function renderPhotoFeedPager(state) {
    if (!state || !state.hasMore) {
        removePhotoFeedPager(state);
        return;
    }

    const grid = document.getElementById(state.targetGridId);
    if (!grid) return;
    removePhotoFeedPager(state);

    const moreButton = `
        <button type="button" onclick="loadMorePhotoFeed('${escapeJsString(state.targetGridId)}', '${escapeJsString(state.emptyStateId)}')" style="border:none; border-radius:999px; background:var(--primary); color:white; font-weight:800; font-size:0.85rem; padding:10px 20px; cursor:pointer;">
            Load more
        </button>
    `;
    const supportsObserver = typeof IntersectionObserver !== 'undefined';

    grid.insertAdjacentHTML('beforeend', `
        <div id="${state.sentinelId}" data-feed-pagination="true" style="padding:18px 15px 28px; text-align:center; color:var(--text-muted); font-size:0.82rem; font-weight:700;">
            ${supportsObserver ? '<span>Loading more...</span>' : moreButton}
        </div>
    `);

    const sentinel = document.getElementById(state.sentinelId);
    if (!sentinel || !supportsObserver) return;

    state.observer = new IntersectionObserver((entries) => {
        if (entries.some(entry => entry.isIntersecting)) {
            window.loadMorePhotoFeed(state.targetGridId, state.emptyStateId);
        }
    }, {
        root: null,
        rootMargin: FEED_PREFETCH_ROOT_MARGIN,
        threshold: 0.01
    });
    state.observer.observe(sentinel);
}

function renderPhotoFeedPagerError(state) {
    const grid = state ? document.getElementById(state.targetGridId) : null;
    if (!grid) return;
    removePhotoFeedPager(state);
    grid.insertAdjacentHTML('beforeend', `
        <div id="${state.sentinelId}" data-feed-pagination="true" style="margin:12px 15px 28px; padding:14px; border:1px solid #fee2e2; background:#fff7f7; border-radius:14px; text-align:center;">
            <div style="color:#7f1d1d; font-size:0.82rem; line-height:1.35; margin-bottom:10px;">More posts could not load.</div>
            <button type="button" onclick="loadMorePhotoFeed('${escapeJsString(state.targetGridId)}', '${escapeJsString(state.emptyStateId)}')" style="border:none; border-radius:999px; background:var(--primary); color:white; font-weight:800; font-size:0.85rem; padding:9px 18px; cursor:pointer;">Retry</button>
        </div>
    `);
}

function cachePhotoFeedStories(state, stories) {
    if (!state || !Array.isArray(stories)) return;
    stories.forEach(story => {
        const storyId = story && (story.story_id || story.id);
        if (!storyId) return;
        if (state.loadedStoryIds.has(storyId)) {
            const existingIndex = state.loadedStories.findIndex(item => (item.story_id || item.id) === storyId);
            if (existingIndex !== -1) state.loadedStories[existingIndex] = story;
            return;
        }
        state.loadedStoryIds.add(storyId);
        state.loadedStories.push(story);
    });
}

function findLoadedPhotoFeedStory(storyId) {
    const targetId = String(storyId || '');
    if (!targetId) return null;
    for (const state of feedPaginationStates.values()) {
        const story = state.loadedStories.find(item => String((item && (item.story_id || item.id)) || '') === targetId);
        if (story) return story;
    }
    return null;
}

window.loadMorePhotoFeed = function(targetGridId = 'photo-feed-grid', emptyStateId = 'photo-feed-empty') {
    return window.loadPhotoFeed(targetGridId, emptyStateId, { append: true });
};

// Load photo feed grid (replaces story carousel on home page)
window.loadPhotoFeed = async function(targetGridId = 'photo-feed-grid', emptyStateId = 'photo-feed-empty', options = {}) {
    if (!window.currentUser) return;

    const append = !!(options && options.append);
    const state = getPhotoFeedState(targetGridId, emptyStateId);
    if (state.loading || (append && !state.hasMore)) return;

    const grid = document.getElementById(targetGridId);
    const emptyState = document.getElementById(emptyStateId);
    if (!grid) return;
    if (typeof window.refreshWorkoutFeedShareRetryNotice === 'function') {
        try {
            const retryNoticeRefresh = window.refreshWorkoutFeedShareRetryNotice();
            if (retryNoticeRefresh && typeof retryNoticeRefresh.catch === 'function') {
                retryNoticeRefresh.catch(e => console.warn('Could not refresh Share a Set retry notice:', e));
            }
        } catch (e) {
            console.warn('Could not refresh Share a Set retry notice:', e);
        }
    }

    if (!append) {
        resetPhotoFeedState(state);
        grid.innerHTML = `
            <div style="padding:22px 15px; text-align:center; color:var(--text-muted); font-size:0.85rem; font-weight:700;">
                Loading feed...
            </div>
        `;
        if (emptyState) emptyState.style.display = 'none';
    } else {
        setPhotoFeedPagerLoading(state);
    }

    state.loading = true;

    try {
        if (typeof window.updateFeedComposerAvatar === 'function') {
            window.updateFeedComposerAvatar();
        }

        const fetchedStories = await dbHelpers.stories.getNetworkStories(window.currentUser.id, {
            limit: FEED_PAGE_FETCH_SIZE,
            offset: state.offset
        });
        const stories = Array.isArray(fetchedStories) ? fetchedStories : [];
        const pageStories = stories.slice(0, FEED_PAGE_SIZE);
        const visibleStories = append
            ? pageStories.filter(story => {
                const storyId = story && (story.story_id || story.id);
                return storyId && !state.loadedStoryIds.has(storyId);
            })
            : pageStories;

        state.offset += pageStories.length;
        state.hasMore = stories.length > FEED_PAGE_SIZE;

        if (!visibleStories.length) {
            state.loading = false;
            if (!append && pageStories.length === 0) {
                removePhotoFeedPager(state);
                grid.innerHTML = '';
                if (emptyState) emptyState.style.display = 'block';
            } else {
                renderPhotoFeedPager(state);
            }
            return;
        }

        await hydrateMealCardPhotos(visibleStories);

        if (emptyState) emptyState.style.display = 'none';

        // Get bulk reactions for just this page
        const storyIds = visibleStories.map(s => s.story_id || s.id).filter(Boolean);
        let reactionsMap = {};
        try {
            const reactions = storyIds.length ? await dbHelpers.stories.getBulkReactions(storyIds) : [];
            reactions.forEach(r => {
                if (!reactionsMap[r.story_id]) reactionsMap[r.story_id] = [];
                reactionsMap[r.story_id].push(r);
            });
        } catch (e) {
            console.log('Could not load reactions:', e);
        }

        // Sort by newest first
        const sortedStories = [...visibleStories].sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );
        rememberFeedMentionProfiles(sortedStories.map(story => ({
            id: story.user_id,
            name: story.user_name,
            profile_photo: story.profile_photo
        })));
        loadFeedMentionFriends().catch(error => {
            console.warn('Could not pre-load Feed mention friends:', error);
        });

        // Render feed grid
        const renderedFeedHtml = sortedStories.map(story => {
            try {
            const storyId = story.story_id || story.id;
            const safeStoryId = escapeJsString(storyId || '');
            const isVideo = story.media_type === 'video';
            const progressPhotoPayload = getProgressPhotoSetPayload(story);
            const isProgressPhoto = story.media_type === 'progress_photo' || !!progressPhotoPayload;
            const progressPhotoShots = isProgressPhoto ? getProgressPhotoShots(story) : [];
            const progressPhotoCaptionText = isProgressPhoto ? getProgressPhotoCaptionText(story) : '';
            const isWorkoutCard = story.media_type === 'workout_card';
            const isNutritionCard = story.media_type === 'nutrition_card';
            const isMealCard = story.media_type === 'meal_card';
            const isLevelUpCard = story.media_type === 'level_up_card';
            const isCheckInCard = story.media_type === 'checkin_card';
            const isCardType = isWorkoutCard || isNutritionCard || isMealCard || isLevelUpCard || isCheckInCard;
            const videoPreviewSrc = isVideo ? getSafeFeedMediaUrl(story.media_url) : '';
            const videoThumbnailSrc = isVideo ? getSafeFeedMediaUrl(story.thumbnail_url) : '';
            const thumbnailSrc = isVideo
                ? (videoThumbnailSrc || videoPreviewSrc)
                : getSafeFeedStoryMediaSrc(story, false);
            const isTextPost = !isProgressPhoto && isFeedTextPostStory(story);
            const missingMediaHtml = (!isCardType && !isTextPost && !thumbnailSrc && progressPhotoShots.length === 0)
                ? `<div onclick="openFeedPostViewer('${storyId}')" style="cursor:pointer; min-height:180px; background:#f8fafc; display:flex; align-items:center; justify-content:center; padding:28px; text-align:center; color:var(--text-muted); font-size:0.86rem; font-weight:700;">Post media unavailable</div>`
                : '';
            const initial = story.user_name ? story.user_name.charAt(0).toUpperCase() : '?';
            const timeAgo = getTimeAgo(new Date(story.created_at));
            const safeUserName = escapeHtml(story.user_name || 'Unknown');
            const profileNameArg = escapeJsString(story.user_name || 'Unknown');
            const profilePhotoArg = escapeJsString(story.profile_photo || '');
            const isOwnStory = story.user_id && window.currentUser && story.user_id === window.currentUser.id;
            const commentPlaceholder = isOwnStory ? 'Add a comment or @tag...' : 'Add a comment or @tag (+2 XP)';

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
            const videoIcon = isVideo && videoPreviewSrc ? `<div data-feed-video-play-icon="${escapeHtml(storyId || '')}" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:44px; height:44px; background:rgba(0,0,0,0.5); border-radius:50%; display:flex; align-items:center; justify-content:center; pointer-events:none;"><svg viewBox="0 0 24 24" style="width:22px; height:22px; fill:white;"><path d="M8 5v14l11-7z"/></svg></div>` : '';
            const mediaTapAttrs = `role="button" tabindex="0" onclick="handleFeedMediaTap('${safeStoryId}', ${isVideo ? 'true' : 'false'}, event)" ondblclick="handleFeedMediaDoubleTap('${safeStoryId}', event)" onkeydown="if(event.key==='Enter'){handleFeedMediaDoubleTap('${safeStoryId}', event)}"`;

            // User avatar
            const avatarHtml = story.profile_photo
                ? `<img src="${escapeHtml(story.profile_photo)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
                : `<span style="font-size:0.7rem; color:white; font-weight:700;">${initial}</span>`;
            const timeLabel = getFeedStoryTimeLabel(story, timeAgo);
            const canEditStory = isFeedStoryEditable(story);

            // Card captions usually store JSON. Meal cards expose a human-readable caption from that payload.
            const parsedCardDataForCaption = isCardType ? parseFeedCardData(story.caption) : null;
            const mealCardCaptionText = parsedCardDataForCaption && parsedCardDataForCaption.card_type === 'meal'
                ? buildMealFeedCaptionText(parsedCardDataForCaption)
                : '';
            const captionHtml = mealCardCaptionText
                ? `<div style="padding:4px 14px 8px; font-size:0.85rem; color:var(--text-main); line-height:1.4;"><span style="font-weight:600;">${safeUserName}</span> ${formatFeedText(mealCardCaptionText)}</div>`
                : progressPhotoCaptionText
                    ? `<div style="padding:4px 14px 8px; font-size:0.85rem; color:var(--text-main); line-height:1.4;"><span style="font-weight:600;">${safeUserName}</span> ${formatFeedText(progressPhotoCaptionText)}</div>`
                : (story.caption && !isCardType && !isTextPost && !progressPhotoPayload)
                    ? `<div style="padding:4px 14px 8px; font-size:0.85rem; color:var(--text-main); line-height:1.4;"><span style="font-weight:600;">${safeUserName}</span> ${formatFeedText(story.caption)}</div>`
                    : '';
            const textPostHtml = isTextPost
                ? `<div onclick="openFeedPostViewer('${storyId}')" style="cursor:pointer; width:100%;">
                    ${renderFeedTextPostCard(story)}
                </div>`
                : '';

            // Quick reaction buttons for inline feed
            const quickReactions = FEED_REACTIONS.map(r => {
                const isActive = myReaction === r.key;
                return `<button data-reaction="${r.key}" onclick="event.stopPropagation(); toggleFeedReaction('${storyId}', '${r.key}', this)" style="background:none; border:none; padding:4px; cursor:pointer; font-size:1.2rem; opacity:${isActive ? '1' : '0.5'}; transform:${isActive ? 'scale(1.15)' : 'scale(1)'}; transition:all 0.2s;">${r.emoji}</button>`;
            }).join('');

            return `
                <div class="feed-post-card" data-story-id="${storyId}" style="background:white; border-bottom:8px solid #f1f5f9;">
                    <!-- Post header (clickable to open profile) -->
                    <div onclick="if(typeof viewUserProfile==='function') viewUserProfile('${story.user_id}', '${profileNameArg}', '${profilePhotoArg}')" style="display:flex; align-items:center; padding:10px 14px; gap:10px; cursor:pointer;">
                        <div style="width:34px; height:34px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; border:2px solid #e5e7eb;">
                            ${avatarHtml}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; font-size:0.85rem; color:var(--text-main); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${safeUserName}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted);">${timeLabel}</div>
                        </div>
                        ${canEditStory ? renderFeedPostActionsMenu(storyId, 'card') : ''}
                    </div>
                    <!-- Full-width media -->
                    ${isCardType ? (() => {
                        let cardData = parsedCardDataForCaption || parseFeedCardData(story.caption);
                        const cardPhotoSrc = getFeedCardPhotoUrl(story, cardData);
                        const hasPhoto = !!cardPhotoSrc;
                        const isMealPayload = cardData && cardData.card_type === 'meal';
                        const isCheckInPayload = cardData && cardData.card_type === 'daily_checkin';
                        const isFitnessDiaryPayload = cardData && cardData.card_type === 'fitness_diary';

                        // Pick the right renderer
                        const renderFn = isFitnessDiaryPayload ? renderFitnessDiaryCard
                            : isCheckInPayload ? renderCheckInCard
                            : isMealPayload ? renderMealCard
                            : isNutritionCard ? renderNutritionCard
                            : isMealCard ? renderMealCard
                            : isLevelUpCard ? renderLevelUpCard
                            : renderWorkoutCard;

                        if (cardData && hasPhoto && (isWorkoutCard || isMealCard || isMealPayload)) {
                            const cId = 'feed-carousel-' + storyId.slice(0, 8);
                            return '<div id="' + cId + '" style="width:100%; overflow:hidden; position:relative; cursor:pointer;" onclick="openFeedPostViewer(\'' + storyId + '\')">' +
                                '<div class="carousel-track" style="display:flex; transition:transform 0.3s ease; width:200%;">' +
                                    '<div style="width:50%; flex-shrink:0;"><img src="' + escapeHtml(cardPhotoSrc) + '" style="width:100%; display:block; object-fit:cover;" loading="lazy" referrerpolicy="no-referrer"></div>' +
                                    '<div style="width:50%; flex-shrink:0;">' + renderFn(cardData) + '</div>' +
                                '</div>' +
                                '<div style="position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; gap:6px; z-index:2;">' +
                                    '<div class="carousel-dot active" style="width:7px; height:7px; border-radius:50%; background:white; opacity:1; transition:opacity 0.2s; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); slideViewerCarousel(\'' + cId + '\', 0)"></div>' +
                                    '<div class="carousel-dot" style="width:7px; height:7px; border-radius:50%; background:white; opacity:0.4; transition:opacity 0.2s; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.3);" onclick="event.stopPropagation(); slideViewerCarousel(\'' + cId + '\', 1)"></div>' +
                                '</div>' +
                            '</div>';
                        } else if (cardData) {
                            return '<div onclick="openFeedPostViewer(\'' + storyId + '\')" style="cursor:pointer; width:100%;">' + renderFn(cardData) + '</div>';
                        }
                        return '<div onclick="openFeedPostViewer(\'' + storyId + '\')" style="cursor:pointer; padding:40px; text-align:center; color:#999;">Card unavailable</div>';
                    })() : isTextPost ? textPostHtml : progressPhotoShots.length ? renderProgressPhotoSet(story, storyId) : thumbnailSrc ? `<div ${mediaTapAttrs} style="cursor:pointer; position:relative; background:#000; width:100%;">
                        ${isVideo && videoPreviewSrc ? renderFeedVideoPreview(story, { storyId }) : `<img src="${escapeHtml(thumbnailSrc || '')}" style="width:100%; display:block; object-fit:cover;" loading="lazy" onerror="this.style.display='none'; this.parentElement.style.minHeight='200px'; this.parentElement.style.background='#f1f5f9';">`}
                        ${videoIcon}
                    </div>` : missingMediaHtml}
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
                        <input id="feed-comment-input-${storyId}" type="text" placeholder="${commentPlaceholder}" maxlength="500" style="flex:1; border:none; outline:none; font-size:0.82rem; color:var(--text-main); background:transparent; padding:4px 0;" onkeydown="if(event.key==='Enter'){event.preventDefault(); postFeedComment('${storyId}', this);}" oninput="document.getElementById('feed-comment-btn-${storyId}').style.opacity = this.value.trim() ? '1' : '0.5';">
                        <button onclick="postFeedComment('${storyId}', document.getElementById('feed-comment-input-${storyId}'))" style="background:none; border:none; cursor:pointer; font-size:0.8rem; font-weight:600; color:var(--primary); opacity:0.5; padding:4px 2px; transition:opacity 0.2s;" id="feed-comment-btn-${storyId}">Post</button>
                    </div>
                    <div style="padding:0 14px 10px; font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">${timeLabel}</div>
                </div>
            `;
            } catch (error) {
                const fallbackStoryId = story && (story.story_id || story.id) ? String(story.story_id || story.id) : '';
                console.warn('Could not render feed post:', fallbackStoryId, error);
                return renderFeedPostUnavailable(story, fallbackStoryId);
            }
        }).join('');

        removePhotoFeedPager(state);
        if (append) {
            grid.insertAdjacentHTML('beforeend', renderedFeedHtml);
        } else {
            grid.innerHTML = renderedFeedHtml;
        }
        cachePhotoFeedStories(state, sortedStories);
        state.loading = false;
        renderPhotoFeedPager(state);

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
        state.loading = false;
        if (append) {
            renderPhotoFeedPagerError(state);
            return;
        }
        if (emptyState) emptyState.style.display = 'none';
        if (grid) {
            grid.innerHTML = `
                <div style="margin:18px 15px; padding:18px; border:1px solid #fee2e2; background:#fff7f7; border-radius:14px; text-align:center;">
                    <div style="font-weight:800; color:#991b1b; font-size:0.95rem; margin-bottom:6px;">Feed could not load</div>
                    <div style="color:#7f1d1d; font-size:0.82rem; line-height:1.35; margin-bottom:12px;">Try again in a moment.</div>
                    <button type="button" onclick="loadPhotoFeed('${escapeJsString(targetGridId)}', '${escapeJsString(emptyStateId)}')" style="border:none; border-radius:999px; background:var(--primary); color:white; font-weight:800; font-size:0.85rem; padding:9px 18px; cursor:pointer;">Retry</button>
                </div>
            `;
        }
    }
};

// Open a feed post in full-screen viewer with reactions
window.openFeedPostViewer = async function(storyId) {
    if (!window.currentUser) return;
    if (typeof window.closeFeedPostEditor === 'function') {
        window.closeFeedPostEditor();
    }
    if (typeof window.closeFeedPostActionsMenu === 'function') {
        window.closeFeedPostActionsMenu();
    }

    try {
        let story = findLoadedPhotoFeedStory(storyId);
        if (!story && dbHelpers.stories.getFeedStory) {
            try {
                story = await dbHelpers.stories.getFeedStory(storyId, window.currentUser.id);
                if (story) {
                    await hydrateMealCardPhotos([story]);
                }
            } catch (error) {
                console.warn('Could not fetch feed post directly:', error);
            }
        }
        if (!story) {
            const stories = await dbHelpers.stories.getNetworkStories(window.currentUser.id, {
                limit: 50,
                offset: 0
            });
            await hydrateMealCardPhotos(stories);
            story = (stories || []).find(s => (s.story_id || s.id) === storyId);
        }

        if (!story) {
            console.error('Story not found:', storyId);
            return;
        }

        const sid = story.story_id || story.id;
        const isVideo = story.media_type === 'video';
        const progressPhotoPayload = getProgressPhotoSetPayload(story);
        const isProgressPhoto = story.media_type === 'progress_photo' || !!progressPhotoPayload;
        const progressPhotoShots = isProgressPhoto ? getProgressPhotoShots(story) : [];
        const progressPhotoCaptionText = isProgressPhoto ? getProgressPhotoCaptionText(story) : '';
        const isWorkoutCard = story.media_type === 'workout_card';
        const isNutritionCard = story.media_type === 'nutrition_card';
        const isMealCard = story.media_type === 'meal_card';
        const isLevelUpCard = story.media_type === 'level_up_card';
        const isCheckInCard = story.media_type === 'checkin_card';
        const isCardType = isWorkoutCard || isNutritionCard || isMealCard || isLevelUpCard || isCheckInCard;
        const isTextPost = !isProgressPhoto && isFeedTextPostStory(story);
        const initial = story.user_name ? story.user_name.charAt(0).toUpperCase() : '?';
        const timeAgo = getTimeAgo(new Date(story.created_at));
        const isOwn = story.user_id === window.currentUser.id;
        const safeUserName = escapeHtml(story.user_name || 'Unknown');
        const timeLabel = getFeedStoryTimeLabel(story, timeAgo);
        const canEditStory = isFeedStoryEditable(story);
        const profileNameArg = escapeJsString(story.user_name || 'Unknown');
        const profilePhotoArg = escapeJsString(story.profile_photo || '');

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
            ? `<img src="${escapeHtml(story.profile_photo)}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
            : `<span style="color:white; -webkit-text-fill-color:white; font-weight:700;">${initial}</span>`;

        // Media element — handle all card types, carousel posts, images, and videos
        let mediaHtml = '';
        let viewerCardData = null;

        // Pick the right card renderer
        const cardRenderFn = isNutritionCard ? renderNutritionCard
            : isMealCard ? renderMealCard
            : isLevelUpCard ? renderLevelUpCard
            : isCheckInCard ? renderCheckInCard
            : renderWorkoutCard;

        if (isCardType) {
            let cardData = parseFeedCardData(story.caption);
            viewerCardData = cardData;
            const isMealPayload = cardData && cardData.card_type === 'meal';
            const isCheckInPayload = cardData && cardData.card_type === 'daily_checkin';
            const isFitnessDiaryPayload = cardData && cardData.card_type === 'fitness_diary';
            const renderCard = isFitnessDiaryPayload ? renderFitnessDiaryCard
                : isCheckInPayload ? renderCheckInCard
                : isMealPayload ? renderMealCard
                : cardRenderFn;
            const cardPhotoSrc = getFeedCardPhotoUrl(story, cardData);

            if (cardData && cardPhotoSrc && (isWorkoutCard || isMealCard || isMealPayload)) {
                // Carousel: photo + card with swipe dots
                const carouselId = 'viewer-carousel-' + sid.slice(0, 8);
                mediaHtml = `
                    <div id="${carouselId}" style="width:100%; overflow:hidden; position:relative;">
                        <div class="carousel-track" style="display:flex; transition:transform 0.3s ease; width:200%;">
                            <div style="width:50%; flex-shrink:0;">
                                <img src="${escapeHtml(cardPhotoSrc)}" style="width:100%; max-height:70vh; object-fit:contain; background:black;" referrerpolicy="no-referrer">
                            </div>
                            <div style="width:50%; flex-shrink:0;">
                                ${renderCard(cardData)}
                            </div>
                        </div>
                        <div style="position:absolute; bottom:12px; left:50%; transform:translateX(-50%); display:flex; gap:6px; z-index:2;">
                            <div class="carousel-dot active" style="width:7px; height:7px; border-radius:50%; background:white; opacity:1; transition:opacity 0.2s; cursor:pointer;" onclick="slideViewerCarousel('${carouselId}', 0)"></div>
                            <div class="carousel-dot" style="width:7px; height:7px; border-radius:50%; background:white; opacity:0.4; transition:opacity 0.2s; cursor:pointer;" onclick="slideViewerCarousel('${carouselId}', 1)"></div>
                        </div>
                    </div>
                `;
            } else if (cardData) {
                // Standalone card (nutrition, level-up, or workout without photo)
                mediaHtml = `<div style="width:100%; max-height:70vh; overflow:auto;">${renderCard(cardData)}</div>`;
            } else {
                mediaHtml = '<div style="padding:40px; text-align:center; color:#999;">Card unavailable</div>';
            }
        } else if (isTextPost) {
            mediaHtml = `<div style="width:100%; max-width:620px; box-sizing:border-box;">${renderFeedTextPostCard(story, { context: 'viewer' })}</div>`;
        } else if (progressPhotoShots.length) {
            mediaHtml = renderProgressPhotoSet(story, sid, { variant: 'viewer' });
        } else if (isVideo) {
            const posterAttr = story.thumbnail_url ? ` poster="${escapeHtml(story.thumbnail_url)}"` : '';
            mediaHtml = `<video src="${escapeHtml(story.media_url)}"${posterAttr} autoplay playsinline controls style="width:100%; max-height:70vh; object-fit:contain; background:black; border-radius:0;"></video>`;
        } else {
            mediaHtml = `<img src="${escapeHtml(story.media_url)}" style="width:100%; max-height:70vh; object-fit:contain; background:black;">`;
        }

        // Card captions usually store JSON. Meal cards expose a human-readable caption from that payload.
        const mealViewerCaptionText = viewerCardData && viewerCardData.card_type === 'meal'
            ? buildMealFeedCaptionText(viewerCardData)
            : '';
        const captionHtml = mealViewerCaptionText
            ? `<div style="padding:10px 20px; font-size:0.9rem; color:var(--text-main); line-height:1.5;">${formatFeedText(mealViewerCaptionText)}</div>`
            : progressPhotoCaptionText
                ? `<div style="padding:10px 20px; font-size:0.9rem; color:var(--text-main); line-height:1.5;">${formatFeedText(progressPhotoCaptionText)}</div>`
            : (story.caption && !isCardType && !isTextPost && !progressPhotoPayload)
                ? `<div style="padding:10px 20px; font-size:0.9rem; color:var(--text-main); line-height:1.5;">${formatFeedText(story.caption)}</div>`
                : '';
        const mediaStageBackground = (isWorkoutCard || isCheckInCard || isTextPost) ? 'background:#f6f8f4;' : 'background:black;';

        // Delete button for own posts
        const actionsMenu = isOwn && canEditStory
            ? renderFeedPostActionsMenu(sid, 'viewer')
            : '';

        // Create or reuse viewer
        let viewer = document.getElementById('feed-post-viewer');
        if (!viewer) {
            viewer = document.createElement('div');
            viewer.id = 'feed-post-viewer';
            document.body.appendChild(viewer);
        }

        viewer.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:10009; display:flex; flex-direction:column; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain;';
        viewer.dataset.storyId = sid;
        viewer.innerHTML = `
            <!-- Top bar -->
            <div style="position:sticky; top:0; z-index:2; display:flex; align-items:center; padding:calc(15px + env(safe-area-inset-top, 0px)) 16px 14px 16px; gap:12px; flex-shrink:0; background:linear-gradient(180deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.84) 100%); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border-bottom:1px solid rgba(255,255,255,0.06); color:white; -webkit-text-fill-color:white;">
                <div onclick="closeFeedPostViewer(); if(typeof viewUserProfile==='function') viewUserProfile('${story.user_id}', '${profileNameArg}', '${profilePhotoArg}')" style="width:40px; height:40px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; cursor:pointer;">
                    ${avatarHtml}
                </div>
                <div onclick="closeFeedPostViewer(); if(typeof viewUserProfile==='function') viewUserProfile('${story.user_id}', '${profileNameArg}', '${profilePhotoArg}')" style="flex:1; cursor:pointer;">
                    <div style="color:white; -webkit-text-fill-color:white; font-weight:600; font-size:0.95rem;">${safeUserName}</div>
                    <div style="color:rgba(255,255,255,0.68); -webkit-text-fill-color:rgba(255,255,255,0.68); font-size:0.75rem;">${timeLabel}</div>
                </div>
                ${actionsMenu}
                <button type="button" aria-label="Close feed photo" onclick="closeFeedPostViewer()" style="width:42px; height:42px; border-radius:50%; border:1px solid rgba(255,255,255,0.34); background:rgba(255,255,255,0.16); color:white; -webkit-text-fill-color:white; font-size:1.85rem; font-weight:800; cursor:pointer; line-height:1; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; padding:0; box-shadow:0 10px 24px rgba(0,0,0,0.32);">&times;</button>
            </div>

            <!-- Media -->
            <div style="flex:1; display:flex; align-items:center; justify-content:center; ${mediaStageBackground}">
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
    if (typeof window.closeFeedPostEditor === 'function') {
        window.closeFeedPostEditor();
    }
    if (typeof window.closeFeedPostActionsMenu === 'function') {
        window.closeFeedPostActionsMenu();
    }
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

let feedPostEditorState = null;
let feedPostEditorBindingsInstalled = false;
let feedPostActionsMenuState = null;
let feedPostActionsMenuBindingsInstalled = false;

function cloneFeedCardData(cardData) {
    if (!cardData || typeof cardData !== 'object') return {};
    try {
        return JSON.parse(JSON.stringify(cardData));
    } catch (_) {
        return Object.assign({}, cardData);
    }
}

function getFeedEditorValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '') : '';
}

function getFeedEditorTrimmedValue(id) {
    return getFeedEditorValue(id).trim();
}

function getFeedEditorNumberValue(id) {
    const raw = getFeedEditorTrimmedValue(id);
    if (!raw) return null;
    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
}

function getFeedEditorLines(id) {
    return getFeedEditorValue(id)
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
}

function splitFeedEditorLine(line) {
    const raw = String(line || '').trim();
    if (!raw) return [];
    if (raw.includes('|')) return raw.split('|').map(part => part.trim()).filter(Boolean);
    if (raw.includes(' - ')) return raw.split(' - ').map(part => part.trim()).filter(Boolean);
    if (raw.includes(':')) return raw.split(':').map(part => part.trim()).filter(Boolean);
    return [raw];
}

function parseFeedIngredientsText(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const parts = splitFeedEditorLine(line);
            const name = String(parts[0] || '').trim();
            const portion = String(parts.slice(1).join(' | ') || '').trim();
            if (!name) return null;
            const next = { name };
            if (portion) {
                next.portion = portion;
                next.amount = portion;
            }
            return next;
        })
        .filter(Boolean);
}

function parseFeedExercisesText(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const parts = splitFeedEditorLine(line);
            const name = String(parts[0] || '').trim();
            const best = String(parts.slice(1).join(' | ') || '').trim();
            if (!name) return null;
            return best ? { name, best } : { name };
        })
        .filter(Boolean);
}

function parseFeedPbsText(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const parts = splitFeedEditorLine(line);
            const exercise = String(parts[0] || '').trim();
            if (!exercise) return null;
            const type = String(parts[1] || '').trim();
            const improvement = String(parts[2] || parts.slice(2).join(' | ') || '').trim();
            const next = { exercise };
            if (type) next.type = type;
            if (improvement) next.improvement = improvement;
            return next;
        })
        .filter(Boolean);
}

function parseFeedListText(text) {
    return String(text || '')
        .split(/[\n,]+/)
        .map(item => item.trim())
        .filter(Boolean);
}

function renderFeedEditorField(label, controlHtml, helpText = '', wrapperStyle = '') {
    return `
        <label style="display:flex; flex-direction:column; gap:6px; ${wrapperStyle}">
            <span style="font-size:0.73rem; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:var(--text-muted); -webkit-text-fill-color:var(--text-muted);">${escapeHtml(label)}</span>
            ${controlHtml}
            ${helpText ? `<div style="font-size:0.72rem; line-height:1.35; color:var(--text-muted); -webkit-text-fill-color:var(--text-muted);">${escapeHtml(helpText)}</div>` : ''}
        </label>
    `;
}

function renderFeedEditorInput(id, label, value, attrs = '', helpText = '', wrapperStyle = '') {
    return renderFeedEditorField(label, `
        <input id="${id}" type="text" value="${escapeHtml(value ?? '')}" oninput="updateFeedPostEditorState()" ${attrs} style="width:100%; border:1px solid #dbe3ea; border-radius:14px; padding:11px 12px; box-sizing:border-box; background:#f8fafc; color:var(--text-main); -webkit-text-fill-color:var(--text-main); font-family:inherit; font-size:0.95rem; line-height:1.3; outline:none;">
    `, helpText, wrapperStyle);
}

function renderFeedEditorTextarea(id, label, value, attrs = '', helpText = '', wrapperStyle = '') {
    return renderFeedEditorField(label, `
        <textarea id="${id}" oninput="updateFeedPostEditorState()" ${attrs} style="width:100%; min-height:120px; resize:vertical; border:1px solid #dbe3ea; border-radius:14px; padding:11px 12px; box-sizing:border-box; background:#f8fafc; color:var(--text-main); -webkit-text-fill-color:var(--text-main); font-family:inherit; font-size:0.95rem; line-height:1.45; outline:none;">${escapeHtml(value ?? '')}</textarea>
    `, helpText, wrapperStyle);
}

function renderFeedEditorSelect(id, label, value, options, attrs = '', helpText = '', wrapperStyle = '') {
    const optionHtml = (options || []).map(option => {
        const optionValue = String(option && option.value != null ? option.value : '');
        const optionLabel = String(option && option.label != null ? option.label : optionValue);
        const isSelected = String(value ?? '') === optionValue;
        return `<option value="${escapeHtml(optionValue)}"${isSelected ? ' selected' : ''}>${escapeHtml(optionLabel)}</option>`;
    }).join('');

    return renderFeedEditorField(label, `
        <select id="${id}" onchange="updateFeedPostEditorState()" ${attrs} style="width:100%; border:1px solid #dbe3ea; border-radius:14px; padding:11px 12px; box-sizing:border-box; background:#f8fafc; color:var(--text-main); -webkit-text-fill-color:var(--text-main); font-family:inherit; font-size:0.95rem; line-height:1.3; outline:none;">
            ${optionHtml}
        </select>
    `, helpText, wrapperStyle);
}

function renderFeedEditorBlock(title, description, contentHtml) {
    return `
        <div style="padding:14px; border:1px solid #eef2f7; border-radius:18px; background:#ffffff; display:flex; flex-direction:column; gap:12px;">
            <div>
                <div style="font-size:0.78rem; font-weight:900; letter-spacing:1.4px; text-transform:uppercase; color:var(--primary); -webkit-text-fill-color:var(--primary);">${escapeHtml(title)}</div>
                ${description ? `<div style="margin-top:4px; font-size:0.84rem; line-height:1.4; color:var(--text-muted); -webkit-text-fill-color:var(--text-muted);">${escapeHtml(description)}</div>` : ''}
            </div>
            <div style="display:flex; flex-direction:column; gap:12px;">
                ${contentHtml}
            </div>
        </div>
    `;
}

function formatFeedIngredientsForEdit(cardData) {
    const ingredients = Array.isArray(cardData && cardData.ingredients) ? cardData.ingredients : [];
    return ingredients.map(item => {
        const name = String(item && item.name ? item.name : '').trim();
        if (!name) return '';
        const portion = String(item && (item.portion || item.amount) ? (item.portion || item.amount) : '').trim();
        return portion ? `${name} | ${portion}` : name;
    }).filter(Boolean).join('\n');
}

function formatFeedExercisesForEdit(cardData) {
    const exercises = Array.isArray(cardData && cardData.exercises) ? cardData.exercises : [];
    return exercises.map(item => {
        const name = String(item && item.name ? item.name : '').trim();
        if (!name) return '';
        const best = String(item && item.best ? item.best : '').trim();
        return best ? `${name} | ${best}` : name;
    }).filter(Boolean).join('\n');
}

function formatFeedPbsForEdit(cardData) {
    const pbs = Array.isArray(cardData && cardData.pbs) ? cardData.pbs : [];
    return pbs.map(item => {
        const exercise = String(item && item.exercise ? item.exercise : '').trim();
        if (!exercise) return '';
        const type = String(item && item.type ? item.type : '').trim();
        const improvement = String(item && item.improvement ? item.improvement : '').trim();
        const parts = [exercise];
        if (type) parts.push(type);
        if (improvement) parts.push(improvement);
        return parts.join(' | ');
    }).filter(Boolean).join('\n');
}

function formatFeedSymptomsForEdit(cardData) {
    const symptoms = Array.isArray(cardData && cardData.symptoms) ? cardData.symptoms : [];
    return symptoms.map(symptom => String(symptom || '').trim()).filter(Boolean).join('\n');
}

function getFeedPostEditorConfig(story) {
    const mediaType = String(story && story.media_type ? story.media_type : '').toLowerCase();
    const cardData = parseFeedCardData(story && story.caption ? story.caption : '');
    const cardType = String(cardData && cardData.card_type ? cardData.card_type : '').toLowerCase();

    if (mediaType === 'text') {
        return {
            editKind: 'text',
            title: 'Edit post',
            subtitle: 'Fix the post text without deleting and reposting.',
            placeholder: 'Update your post text...',
            allowBlank: false,
            cardData: null
        };
    }

    if (cardType === 'meal' || mediaType === 'meal_card') {
        return {
            editKind: 'meal',
            title: 'Edit meal card',
            subtitle: 'Update the meal details and the feed will re-render from the saved card payload.',
            placeholder: '',
            allowBlank: false,
            cardData
        };
    }

    if (mediaType === 'workout_card' && !['activity', 'pb', 'friday_weigh_in'].includes(cardType)) {
        return {
            editKind: 'workout',
            title: 'Edit workout card',
            subtitle: 'Update the workout summary, exercise list, or PB rows.',
            placeholder: '',
            allowBlank: false,
            cardData
        };
    }

    if (cardType === 'activity') {
        return {
            editKind: 'activity',
            title: 'Edit activity card',
            subtitle: 'Update the activity summary that powers this post.',
            placeholder: '',
            allowBlank: false,
            cardData
        };
    }

    if (cardType === 'pb') {
        return {
            editKind: 'pb',
            title: 'Edit PB card',
            subtitle: 'Update the personal-best details shown in the feed card.',
            placeholder: '',
            allowBlank: false,
            cardData
        };
    }

    if (cardType === 'friday_weigh_in') {
        return {
            editKind: 'friday_weigh_in',
            title: 'Edit weigh-in card',
            subtitle: 'Update the logged Friday weigh-in details.',
            placeholder: '',
            allowBlank: false,
            cardData
        };
    }

    if (mediaType === 'nutrition_card') {
        return {
            editKind: 'nutrition',
            title: 'Edit nutrition card',
            subtitle: 'Update the daily nutrition summary values.',
            placeholder: '',
            allowBlank: false,
            cardData
        };
    }

    if (mediaType === 'checkin_card' || cardType === 'daily_checkin') {
        return {
            editKind: 'daily_checkin',
            title: 'Edit check-in card',
            subtitle: 'Update the check-in details and symptom list.',
            placeholder: '',
            allowBlank: false,
            cardData
        };
    }

    if (mediaType === 'fitness_diary_card' || cardType === 'fitness_diary') {
        return {
            editKind: 'fitness_diary',
            title: 'Edit diary card',
            subtitle: 'Update the end-of-day reflection card details.',
            placeholder: '',
            allowBlank: false,
            cardData
        };
    }

    if (mediaType === 'level_up_card' || cardType === 'level_up') {
        return {
            editKind: 'level_up',
            title: 'Edit level card',
            subtitle: 'Update the level-up details in this achievement card.',
            placeholder: '',
            allowBlank: false,
            cardData
        };
    }

    if (cardData) {
        return {
            editKind: 'json',
            title: 'Edit card JSON',
            subtitle: 'Advanced mode for a saved card payload. Keep it valid JSON.',
            placeholder: '',
            allowBlank: false,
            cardData
        };
    }

    return {
        editKind: mediaType === 'image' || mediaType === 'video' ? 'caption' : 'text',
        title: mediaType === 'image' || mediaType === 'video' ? 'Edit caption' : 'Edit post',
        subtitle: mediaType === 'image' || mediaType === 'video'
            ? 'Fix the caption without changing the attached media.'
            : 'Fix the post text without deleting and reposting.',
        placeholder: mediaType === 'image' || mediaType === 'video'
            ? 'Update the caption for this post...'
            : 'Update your post text...',
        allowBlank: mediaType !== 'text',
        cardData: null
    };
}

function buildFeedPostEditorBody(config, story) {
    const cardData = config.cardData ? cloneFeedCardData(config.cardData) : {};
    const bodyParts = [];

    if (config.editKind === 'text' || config.editKind === 'caption') {
        bodyParts.push(renderFeedEditorBlock(
            'Post text',
            config.subtitle,
            `
                ${renderFeedEditorTextarea(
                    'feed-post-editor-textarea',
                    'Caption',
                    String(story.caption || ''),
                    `maxlength="1000" placeholder="${escapeHtml(config.placeholder)}"`,
                    config.editKind === 'text'
                        ? 'You can fix typos or update the caption without reposting.'
                        : 'You can update the caption while keeping the photo or video.'
                )}
            `
        ));
        return bodyParts.join('');
    }

    if (config.editKind === 'meal') {
        bodyParts.push(renderFeedEditorBlock(
            'Meal details',
            config.subtitle,
            [
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-meal-type', 'Meal type', cardData.meal_type || '', '', 'Breakfast, lunch, dinner or snack', 'flex:1 1 180px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-foods', 'Foods', cardData.foods || '', '', 'Short summary of the meal', 'flex:1 1 220px; min-width:0;'),
                '</div>',
                renderFeedEditorTextarea('feed-post-editor-ingredients', 'Ingredients', formatFeedIngredientsForEdit(cardData), 'rows="4" placeholder="One ingredient per line: Chickpeas | 1 cup"', 'Use one ingredient per line. Separate name and portion with a pipe.', 'flex:1 1 100%;'),
                renderFeedEditorTextarea('feed-post-editor-share-caption', 'Share caption', cardData.share_caption || '', 'rows="3" placeholder="Optional caption shown at the top of the card"', 'Optional. Leave blank to use the generated meal summary.', 'flex:1 1 100%;'),
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-calories', 'Calories', cardData.calories != null ? cardData.calories : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 140px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-protein', 'Protein', cardData.protein != null ? cardData.protein : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 140px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-carbs', 'Carbs', cardData.carbs != null ? cardData.carbs : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 140px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-fat', 'Fat', cardData.fat != null ? cardData.fat : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 140px; min-width:0;'),
                '</div>'
            ].join('')
        ));
        return bodyParts.join('');
    }

    if (config.editKind === 'workout') {
        bodyParts.push(renderFeedEditorBlock(
            'Workout summary',
            config.subtitle,
            [
                renderFeedEditorInput('feed-post-editor-workout-name', 'Workout name', cardData.workout_name || '', '', 'Name of the workout or split'),
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-duration', 'Duration', cardData.duration || '', '', 'Example: 45 min or 1 hour', 'flex:1 1 160px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-total-sets', 'Total sets', cardData.total_sets != null ? cardData.total_sets : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 120px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-total-volume', 'Total volume', cardData.total_volume || '', '', 'Example: 7,200 kg', 'flex:1 1 160px; min-width:0;'),
                '</div>',
                renderFeedEditorTextarea('feed-post-editor-exercises', 'Exercises', formatFeedExercisesForEdit(cardData), 'rows="5" placeholder="One exercise per line: Squat | 120kg x 5"', 'Use one line per exercise. Add best effort or notes after a pipe.', 'flex:1 1 100%;'),
                renderFeedEditorTextarea('feed-post-editor-pbs', 'PB rows', formatFeedPbsForEdit(cardData), 'rows="4" placeholder="Exercise | type | improvement"', 'Optional. One PB line per row.', 'flex:1 1 100%;')
            ].join('')
        ));
        return bodyParts.join('');
    }

    if (config.editKind === 'activity') {
        bodyParts.push(renderFeedEditorBlock(
            'Activity details',
            config.subtitle,
            [
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-activity-label', 'Activity label', cardData.activity_label || '', '', 'What this activity should be called', 'flex:1 1 220px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-activity-type', 'Activity type', cardData.activity_type || '', '', 'Optional system label', 'flex:1 1 180px; min-width:0;'),
                '</div>',
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-emoji', 'Emoji', cardData.emoji || '', '', 'Example: 🏃 or 🚴', 'flex:1 1 120px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-activity-duration', 'Duration', cardData.duration || '', '', 'Example: 30 min', 'flex:1 1 160px; min-width:0;'),
                renderFeedEditorSelect('feed-post-editor-intensity', 'Intensity', cardData.intensity || 'moderate', [
                    { value: 'light', label: 'Light' },
                    { value: 'moderate', label: 'Moderate' },
                    { value: 'vigorous', label: 'Vigorous' }
                ], '', '', 'flex:1 1 160px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-activity-calories', 'Calories', cardData.calories != null ? cardData.calories : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 120px; min-width:0;'),
                '</div>'
            ].join('')
        ));
        return bodyParts.join('');
    }

    if (config.editKind === 'pb') {
        bodyParts.push(renderFeedEditorBlock(
            'PB details',
            config.subtitle,
            [
                renderFeedEditorInput('feed-post-editor-pb-exercise', 'Exercise', cardData.exercise || '', '', 'Exercise name shown on the card'),
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorSelect('feed-post-editor-pb-type', 'PB type', cardData.pb_type || 'weight', [
                    { value: 'weight', label: 'Weight' },
                    { value: 'reps', label: 'Reps' }
                ], '', '', 'flex:1 1 130px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-pb-value', 'Value', cardData.value != null ? cardData.value : '', '', 'Primary PB number', 'flex:1 1 130px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-pb-reps', 'Reps', cardData.reps != null ? cardData.reps : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 120px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-pb-weight', 'Weight', cardData.weight != null ? cardData.weight : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 120px; min-width:0;'),
                '</div>',
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-pb-improvement', 'Improvement', cardData.improvement != null ? cardData.improvement : '', '', 'How much better this result is', 'flex:1 1 160px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-pb-previous', 'Previous', cardData.previous != null ? cardData.previous : '', '', 'Previous result before this PB', 'flex:1 1 160px; min-width:0;'),
                '</div>'
            ].join('')
        ));
        return bodyParts.join('');
    }

    if (config.editKind === 'friday_weigh_in') {
        bodyParts.push(renderFeedEditorBlock(
            'Weigh-in details',
            config.subtitle,
            [
                renderFeedEditorInput('feed-post-editor-display-weight', 'Display weight', cardData.display_weight || '', '', 'Shown exactly on the card'),
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-weight-kg', 'Weight kg', cardData.weight_kg != null ? cardData.weight_kg : '', 'inputmode="decimal" step="0.1" min="0" placeholder="0.0"', '', 'flex:1 1 120px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-change-kg', 'Change kg', cardData.change_kg != null ? cardData.change_kg : '', 'inputmode="decimal" step="0.1" placeholder="0.0"', '', 'flex:1 1 120px; min-width:0;'),
                '</div>',
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-weigh-in-date', 'Weigh-in date', cardData.weigh_in_date || '', '', 'YYYY-MM-DD', 'flex:1 1 160px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-challenge-name', 'Challenge name', cardData.challenge_name || '', '', 'Optional challenge label', 'flex:1 1 180px; min-width:0;'),
                '</div>'
            ].join('')
        ));
        return bodyParts.join('');
    }

    if (config.editKind === 'nutrition') {
        bodyParts.push(renderFeedEditorBlock(
            'Nutrition details',
            config.subtitle,
            [
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-score', 'Score', cardData.score != null ? cardData.score : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 120px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-calories', 'Calories', cardData.calories != null ? cardData.calories : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 120px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-calorie-goal', 'Calorie goal', cardData.calorie_goal != null ? cardData.calorie_goal : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 140px; min-width:0;'),
                '</div>',
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-protein-goal', 'Protein goal', cardData.protein_goal != null ? cardData.protein_goal : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 130px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-protein', 'Protein', cardData.protein != null ? cardData.protein : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 130px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-carbs-goal', 'Carbs goal', cardData.carbs_goal != null ? cardData.carbs_goal : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 130px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-carbs', 'Carbs', cardData.carbs != null ? cardData.carbs : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 130px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-fat-goal', 'Fat goal', cardData.fat_goal != null ? cardData.fat_goal : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 130px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-fat', 'Fat', cardData.fat != null ? cardData.fat : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 130px; min-width:0;'),
                '</div>',
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-meal-count', 'Meal count', cardData.meal_count != null ? cardData.meal_count : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 120px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-streak', 'Streak', cardData.streak != null ? cardData.streak : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 120px; min-width:0;'),
                '</div>'
            ].join('')
        ));
        return bodyParts.join('');
    }

    if (config.editKind === 'daily_checkin') {
        bodyParts.push(renderFeedEditorBlock(
            'Check-in details',
            config.subtitle,
            [
                renderFeedEditorInput('feed-post-editor-checkin-title', 'Title', cardData.title || '', '', 'Card title shown at the top'),
                renderFeedEditorInput('feed-post-editor-checkin-date', 'Check-in date', cardData.checkin_date || '', '', 'YYYY-MM-DD'),
                renderFeedEditorTextarea('feed-post-editor-symptoms', 'Symptoms', formatFeedSymptomsForEdit(cardData), 'rows="4" placeholder="One symptom per line or comma separated"', 'Use one symptom per line, or separate them with commas.', 'flex:1 1 100%;'),
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-energy', 'Energy', cardData.energy || '', '', 'Example: low, okay, high', 'flex:1 1 160px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-recovery', 'Recovery', cardData.recovery || '', '', 'Example: tight, good, poor', 'flex:1 1 160px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-mood', 'Mood', cardData.mood || '', '', 'Example: calm, flat, great', 'flex:1 1 160px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-equipment', 'Equipment', cardData.equipment || '', '', 'Optional setup notes', 'flex:1 1 160px; min-width:0;'),
                '</div>'
            ].join('')
        ));
        return bodyParts.join('');
    }

    if (config.editKind === 'fitness_diary') {
        bodyParts.push(renderFeedEditorBlock(
            'Diary details',
            config.subtitle,
            [
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-diary-date', 'Diary date', cardData.diary_date || '', '', 'YYYY-MM-DD', 'flex:1 1 160px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-day-rating', 'Day rating', cardData.day_rating || '', '', 'Example: Great, okay, hard', 'flex:1 1 180px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-energy-level', 'Energy level', cardData.energy_level || '', '', 'Example: high, medium, low', 'flex:1 1 180px; min-width:0;'),
                '</div>',
                renderFeedEditorTextarea('feed-post-editor-goals', 'Goals', cardData.goals || '', 'rows="3" placeholder="Current fitness goals"', 'Shown first on the reflection card.', 'flex:1 1 100%;'),
                renderFeedEditorTextarea('feed-post-editor-highlight', 'Highlight', cardData.highlight || '', 'rows="3" placeholder="Best thing that happened today"', 'Shown on the reflection card.', 'flex:1 1 100%;'),
                renderFeedEditorTextarea('feed-post-editor-struggle', 'Struggle', cardData.struggle || '', 'rows="3" placeholder="Hardest part of the day"', 'Shown on the reflection card.', 'flex:1 1 100%;'),
                renderFeedEditorTextarea('feed-post-editor-note', 'Tell me about today', cardData.note || cardData.day_story || '', 'rows="5" placeholder="Work, training, food, stress, wins, motivation, what clicked, what felt hard"', 'Shown as the main diary reflection on the Feed card.', 'flex:1 1 100%;')
            ].join('')
        ));
        return bodyParts.join('');
    }

    if (config.editKind === 'level_up') {
        bodyParts.push(renderFeedEditorBlock(
            'Level details',
            config.subtitle,
            [
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-level', 'Level', cardData.level != null ? cardData.level : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 120px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-lifetime-xp', 'Lifetime XP', cardData.lifetime_xp != null ? cardData.lifetime_xp : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 140px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-streak', 'Streak', cardData.streak != null ? cardData.streak : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 120px; min-width:0;'),
                '</div>',
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-level-title', 'Title', cardData.title || '', '', 'New title for this level', 'flex:1 1 180px; min-width:0;'),
                renderFeedEditorInput('feed-post-editor-previous-title', 'Previous title', cardData.previous_title || '', '', 'Optional previous title', 'flex:1 1 180px; min-width:0;'),
                '</div>',
                '<div style="display:flex; flex-wrap:wrap; gap:10px;">',
                renderFeedEditorInput('feed-post-editor-previous-level', 'Previous level', cardData.previous_level != null ? cardData.previous_level : '', 'inputmode="numeric" step="1" min="0" placeholder="0"', '', 'flex:1 1 140px; min-width:0;'),
                '</div>'
            ].join('')
        ));
        return bodyParts.join('');
    }

    bodyParts.push(renderFeedEditorBlock(
        'Card JSON',
        config.subtitle,
        `
            ${renderFeedEditorTextarea(
                'feed-post-editor-json',
                'JSON payload',
                story.caption || '',
                'rows="14" placeholder="Paste valid JSON here"',
                'Advanced mode. Keep the payload valid JSON so the card still renders.',
                'flex:1 1 100%;'
            )}
        `
    ));

    return bodyParts.join('');
}

function getFeedPostEditorPayload() {
    if (!feedPostEditorState) return null;

    const mode = feedPostEditorState.editKind;
    if (mode === 'text' || mode === 'caption') {
        const textarea = document.getElementById('feed-post-editor-textarea');
        if (!textarea) return null;
        const value = textarea.value.trim();
        if (mode === 'text' && !value) return null;
        return value;
    }

    if (mode === 'json') {
        const textarea = document.getElementById('feed-post-editor-json');
        if (!textarea) return null;
        const raw = textarea.value.trim();
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    }

    const cardData = cloneFeedCardData(feedPostEditorState.cardData || {});

    if (mode === 'meal') {
        cardData.card_type = 'meal';
        cardData.meal_type = getFeedEditorTrimmedValue('feed-post-editor-meal-type') || null;
        cardData.foods = getFeedEditorTrimmedValue('feed-post-editor-foods') || null;
        cardData.ingredients = parseFeedIngredientsText(getFeedEditorValue('feed-post-editor-ingredients'));
        const shareCaption = getFeedEditorTrimmedValue('feed-post-editor-share-caption');
        if (shareCaption) cardData.share_caption = shareCaption;
        else delete cardData.share_caption;
        cardData.calories = getFeedEditorNumberValue('feed-post-editor-calories');
        cardData.protein = getFeedEditorNumberValue('feed-post-editor-protein');
        cardData.carbs = getFeedEditorNumberValue('feed-post-editor-carbs');
        cardData.fat = getFeedEditorNumberValue('feed-post-editor-fat');
        return cardData;
    }

    if (mode === 'workout') {
        cardData.workout_name = getFeedEditorTrimmedValue('feed-post-editor-workout-name') || null;
        cardData.duration = getFeedEditorTrimmedValue('feed-post-editor-duration') || null;
        cardData.total_sets = getFeedEditorNumberValue('feed-post-editor-total-sets');
        cardData.total_volume = getFeedEditorTrimmedValue('feed-post-editor-total-volume') || null;
        cardData.exercises = parseFeedExercisesText(getFeedEditorValue('feed-post-editor-exercises'));
        cardData.pbs = parseFeedPbsText(getFeedEditorValue('feed-post-editor-pbs'));
        return cardData;
    }

    if (mode === 'activity') {
        cardData.card_type = 'activity';
        cardData.activity_label = getFeedEditorTrimmedValue('feed-post-editor-activity-label') || null;
        cardData.activity_type = getFeedEditorTrimmedValue('feed-post-editor-activity-type') || null;
        cardData.emoji = getFeedEditorTrimmedValue('feed-post-editor-emoji') || null;
        cardData.duration = getFeedEditorTrimmedValue('feed-post-editor-activity-duration') || null;
        cardData.intensity = getFeedEditorTrimmedValue('feed-post-editor-intensity') || null;
        cardData.calories = getFeedEditorNumberValue('feed-post-editor-activity-calories');
        return cardData;
    }

    if (mode === 'pb') {
        cardData.card_type = 'pb';
        cardData.exercise = getFeedEditorTrimmedValue('feed-post-editor-pb-exercise') || null;
        cardData.pb_type = getFeedEditorTrimmedValue('feed-post-editor-pb-type') || null;
        cardData.value = getFeedEditorTrimmedValue('feed-post-editor-pb-value') || null;
        cardData.reps = getFeedEditorNumberValue('feed-post-editor-pb-reps');
        cardData.weight = getFeedEditorNumberValue('feed-post-editor-pb-weight');
        cardData.improvement = getFeedEditorTrimmedValue('feed-post-editor-pb-improvement') || null;
        cardData.previous = getFeedEditorTrimmedValue('feed-post-editor-pb-previous') || null;
        return cardData;
    }

    if (mode === 'friday_weigh_in') {
        cardData.card_type = 'friday_weigh_in';
        cardData.display_weight = getFeedEditorTrimmedValue('feed-post-editor-display-weight') || null;
        cardData.weight_kg = getFeedEditorNumberValue('feed-post-editor-weight-kg');
        cardData.change_kg = getFeedEditorNumberValue('feed-post-editor-change-kg');
        cardData.weigh_in_date = getFeedEditorTrimmedValue('feed-post-editor-weigh-in-date') || null;
        cardData.challenge_name = getFeedEditorTrimmedValue('feed-post-editor-challenge-name') || null;
        return cardData;
    }

    if (mode === 'nutrition') {
        cardData.card_type = 'nutrition';
        cardData.score = getFeedEditorNumberValue('feed-post-editor-score');
        cardData.calories = getFeedEditorNumberValue('feed-post-editor-calories');
        cardData.calorie_goal = getFeedEditorNumberValue('feed-post-editor-calorie-goal');
        cardData.protein = getFeedEditorNumberValue('feed-post-editor-protein');
        cardData.protein_goal = getFeedEditorNumberValue('feed-post-editor-protein-goal');
        cardData.carbs = getFeedEditorNumberValue('feed-post-editor-carbs');
        cardData.carbs_goal = getFeedEditorNumberValue('feed-post-editor-carbs-goal');
        cardData.fat = getFeedEditorNumberValue('feed-post-editor-fat');
        cardData.fat_goal = getFeedEditorNumberValue('feed-post-editor-fat-goal');
        cardData.meal_count = getFeedEditorNumberValue('feed-post-editor-meal-count');
        cardData.streak = getFeedEditorNumberValue('feed-post-editor-streak');
        return cardData;
    }

    if (mode === 'daily_checkin') {
        cardData.card_type = 'daily_checkin';
        cardData.title = getFeedEditorTrimmedValue('feed-post-editor-checkin-title') || null;
        cardData.checkin_date = getFeedEditorTrimmedValue('feed-post-editor-checkin-date') || null;
        cardData.symptoms = parseFeedListText(getFeedEditorValue('feed-post-editor-symptoms'));
        cardData.energy = getFeedEditorTrimmedValue('feed-post-editor-energy') || null;
        cardData.recovery = getFeedEditorTrimmedValue('feed-post-editor-recovery') || null;
        cardData.mood = getFeedEditorTrimmedValue('feed-post-editor-mood') || null;
        cardData.equipment = getFeedEditorTrimmedValue('feed-post-editor-equipment') || null;
        return cardData;
    }

    if (mode === 'fitness_diary') {
        cardData.card_type = 'fitness_diary';
        cardData.diary_date = getFeedEditorTrimmedValue('feed-post-editor-diary-date') || null;
        cardData.day_rating = getFeedEditorTrimmedValue('feed-post-editor-day-rating') || null;
        cardData.energy_level = getFeedEditorTrimmedValue('feed-post-editor-energy-level') || null;
        cardData.goals = getFeedEditorTrimmedValue('feed-post-editor-goals') || null;
        cardData.highlight = getFeedEditorTrimmedValue('feed-post-editor-highlight') || null;
        cardData.struggle = getFeedEditorTrimmedValue('feed-post-editor-struggle') || null;
        cardData.note = getFeedEditorTrimmedValue('feed-post-editor-note') || null;
        return cardData;
    }

    if (mode === 'level_up') {
        cardData.card_type = 'level_up';
        cardData.level = getFeedEditorNumberValue('feed-post-editor-level');
        cardData.title = getFeedEditorTrimmedValue('feed-post-editor-level-title') || null;
        cardData.previous_level = getFeedEditorNumberValue('feed-post-editor-previous-level');
        cardData.previous_title = getFeedEditorTrimmedValue('feed-post-editor-previous-title') || null;
        cardData.lifetime_xp = getFeedEditorNumberValue('feed-post-editor-lifetime-xp');
        cardData.streak = getFeedEditorNumberValue('feed-post-editor-streak');
        return cardData;
    }

    return null;
}

function getFeedPostEditorSignature() {
    const payload = getFeedPostEditorPayload();
    if (payload === null || payload === undefined) return null;
    return typeof payload === 'string' ? payload : JSON.stringify(payload);
}

function ensureFeedPostActionsMenuBindings() {
    if (feedPostActionsMenuBindingsInstalled) return;
    feedPostActionsMenuBindingsInstalled = true;

    document.addEventListener('click', (event) => {
        if (!feedPostActionsMenuState) return;
        if (event.target.closest('[data-feed-post-actions]')) return;
        window.closeFeedPostActionsMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            window.closeFeedPostActionsMenu();
        }
    });
}

function closeFeedPostActionsMenuInternal() {
    feedPostActionsMenuState = null;
    document.querySelectorAll('[data-feed-post-actions-menu]').forEach(menu => {
        menu.style.display = 'none';
    });
    document.querySelectorAll('[data-feed-post-actions-trigger]').forEach(trigger => {
        trigger.setAttribute('aria-expanded', 'false');
    });
}

window.closeFeedPostActionsMenu = function() {
    closeFeedPostActionsMenuInternal();
};

window.toggleFeedPostActionsMenu = function(storyId, variant, triggerEl) {
    if (!triggerEl) return;
    ensureFeedPostActionsMenuBindings();

    const container = triggerEl.closest('[data-feed-post-actions]');
    if (!container) return;

    const menu = container.querySelector('[data-feed-post-actions-menu]');
    if (!menu) return;

    const normalizedStoryId = String(storyId || '');
    const normalizedVariant = String(variant || 'card');
    const isSameMenu = feedPostActionsMenuState
        && feedPostActionsMenuState.storyId === normalizedStoryId
        && feedPostActionsMenuState.variant === normalizedVariant;

    closeFeedPostActionsMenuInternal();
    if (isSameMenu) return;

    menu.style.display = 'block';
    triggerEl.setAttribute('aria-expanded', 'true');
    feedPostActionsMenuState = {
        storyId: normalizedStoryId,
        variant: normalizedVariant
    };
};

function ensureFeedPostEditorOverlay() {
    let overlay = document.getElementById('feed-post-editor-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'feed-post-editor-overlay';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:10020; display:none; align-items:center; justify-content:center; background:rgba(15,23,42,0.72); padding:calc(20px + env(safe-area-inset-top, 0px)) 16px calc(20px + env(safe-area-inset-bottom, 0px)) 16px; box-sizing:border-box;';
        document.body.appendChild(overlay);
    }

    if (!feedPostEditorBindingsInstalled) {
        feedPostEditorBindingsInstalled = true;
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                window.closeFeedPostEditor();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            const currentOverlay = document.getElementById('feed-post-editor-overlay');
            if (currentOverlay && currentOverlay.style.display !== 'none') {
                window.closeFeedPostEditor();
            }
        });
    }

    return overlay;
}

function updateFeedPostEditorState() {
    const saveBtn = document.getElementById('feed-post-editor-save-btn');
    if (!saveBtn || !feedPostEditorState) return;

    const currentSignature = getFeedPostEditorSignature();
    const hasChanged = currentSignature !== null && currentSignature !== feedPostEditorState.originalSignature;
    let isValid = currentSignature !== null;
    if (feedPostEditorState.editKind === 'text') {
        const textarea = document.getElementById('feed-post-editor-textarea');
        isValid = !!textarea && textarea.value.trim().length > 0;
    }

    saveBtn.disabled = !hasChanged || !isValid;
    saveBtn.style.opacity = saveBtn.disabled ? '0.45' : '1';
    saveBtn.style.cursor = saveBtn.disabled ? 'not-allowed' : 'pointer';

    const textarea = document.getElementById('feed-post-editor-textarea');
    if (textarea) {
        const count = document.getElementById('feed-post-editor-count');
        if (count) {
            count.textContent = `${textarea.value.length}/1000`;
        }
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 320) + 'px';
    }
}

window.updateFeedPostEditorState = updateFeedPostEditorState;

window.closeFeedPostEditor = function() {
    feedPostEditorState = null;
    const overlay = document.getElementById('feed-post-editor-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.innerHTML = '';
    }
};

window.openFeedPostEditor = async function(storyId) {
    if (!window.currentUser?.id) return;

    try {
        window.closeFeedPostEditor();
        if (typeof window.closeFeedPostActionsMenu === 'function') {
            window.closeFeedPostActionsMenu();
        }

        const story = await dbHelpers.stories.get(storyId);
        if (!story) {
            showFeedComposerToast('Post not found.', 'error');
            return;
        }

        if (!isFeedStoryEditable(story)) {
            showFeedComposerToast('Only your own posts can be edited.', 'info');
            return;
        }

        const config = getFeedPostEditorConfig(story);
        const overlay = ensureFeedPostEditorOverlay();

        feedPostEditorState = {
            storyId: story.id || storyId,
            mediaType: String(story.media_type || '').toLowerCase(),
            editKind: config.editKind,
            allowBlank: !!config.allowBlank,
            cardData: config.cardData ? cloneFeedCardData(config.cardData) : null,
            originalSignature: null
        };

        overlay.innerHTML = `
            <div id="feed-post-editor-sheet" style="width:min(100%, 620px); max-height:100%; overflow:hidden; display:flex; flex-direction:column; background:white; border-radius:24px; box-shadow:0 24px 60px rgba(15,23,42,0.28);">
                <div style="padding:18px 18px 14px; border-bottom:1px solid #eef2f7; display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
                    <div style="min-width:0;">
                        <div style="font-size:0.72rem; font-weight:900; letter-spacing:1.6px; text-transform:uppercase; color:var(--primary); -webkit-text-fill-color:var(--primary);">Feed edit</div>
                        <div style="margin-top:4px; font-family:'Playfair Display', serif; font-size:1.35rem; font-weight:700; color:var(--text-main); -webkit-text-fill-color:var(--text-main);">${escapeHtml(config.title)}</div>
                        <div style="margin-top:6px; font-size:0.84rem; line-height:1.45; color:var(--text-muted); -webkit-text-fill-color:var(--text-muted);">${escapeHtml(config.subtitle)}</div>
                    </div>
                    <button type="button" onclick="closeFeedPostEditor()" aria-label="Close edit post" style="width:36px; height:36px; border-radius:50%; border:1px solid #e5e7eb; background:#f8fafc; color:var(--text-main); font-size:1.2rem; font-weight:800; cursor:pointer; flex-shrink:0; line-height:1;">&times;</button>
                </div>
                <div style="padding:16px 18px 18px; display:flex; flex-direction:column; gap:12px; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain;">
                    ${buildFeedPostEditorBody(config, story)}
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding-top:4px;">
                        <div style="font-size:0.75rem; color:var(--text-muted); -webkit-text-fill-color:var(--text-muted); line-height:1.35;">
                            ${config.editKind === 'text'
                                ? 'You can fix typos or update the text without reposting.'
                                : config.editKind === 'caption'
                                    ? 'Update the caption while keeping the attached media the same.'
                                    : 'Edit the saved payload for this card and re-render the feed post.'}
                        </div>
                        ${(config.editKind === 'text' || config.editKind === 'caption')
                            ? '<div id="feed-post-editor-count" style="font-size:0.75rem; color:var(--text-muted); -webkit-text-fill-color:var(--text-muted); font-weight:700;">0/1000</div>'
                            : ''}
                    </div>
                    <div style="display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:wrap; padding-top:4px;">
                        <button type="button" onclick="closeFeedPostEditor()" style="padding:10px 16px; border-radius:999px; border:1px solid #e5e7eb; background:#f8fafc; color:var(--text-main); -webkit-text-fill-color:var(--text-main); font-size:0.85rem; font-weight:800; cursor:pointer;">Cancel</button>
                        <button type="button" id="feed-post-editor-save-btn" onclick="saveFeedPostEdit()" style="padding:10px 16px; border-radius:999px; border:none; background:var(--primary); color:white; -webkit-text-fill-color:white; font-size:0.85rem; font-weight:800; cursor:pointer; opacity:0.45;" disabled>Save changes</button>
                    </div>
                </div>
            </div>
        `;

        overlay.style.display = 'flex';

        feedPostEditorState.originalSignature = getFeedPostEditorSignature();

        const firstField = overlay.querySelector('input, textarea, select');
        if (firstField) {
            setTimeout(() => {
                try {
                    firstField.focus();
                    if (firstField.tagName === 'TEXTAREA') {
                        const end = firstField.value.length;
                        firstField.setSelectionRange(end, end);
                    }
                } catch (e) {}
                updateFeedPostEditorState();
            }, 50);
        } else {
            updateFeedPostEditorState();
        }
    } catch (error) {
        console.error('Error opening feed post editor:', error);
        showFeedComposerToast('Could not open edit mode. Please try again.', 'error');
    }
};

window.saveFeedPostEdit = async function() {
    if (!feedPostEditorState || !window.currentUser?.id) return;

    const saveBtn = document.getElementById('feed-post-editor-save-btn');
    const payload = getFeedPostEditorPayload();
    if (payload === null) {
        showFeedComposerToast(feedPostEditorState.editKind === 'json' ? 'Please fix the JSON before saving.' : 'Please complete the fields before saving.', 'info');
        return;
    }

    const currentSignature = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (currentSignature === feedPostEditorState.originalSignature) {
        window.closeFeedPostEditor();
        return;
    }

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.45';
            saveBtn.textContent = 'Saving...';
        }

        const storyId = feedPostEditorState.storyId;
        const shouldReopenViewer = (() => {
            const viewer = document.getElementById('feed-post-viewer');
            return !!(viewer && viewer.style.display !== 'none' && viewer.dataset.storyId === storyId);
        })();

        const updates = typeof payload === 'string'
            ? { caption: payload || null }
            : { caption: JSON.stringify(payload) };

        await dbHelpers.stories.update(storyId, updates, window.currentUser.id);

        window.closeFeedPostEditor();

        const refreshTasks = [];
        if (typeof loadPhotoFeed === 'function') {
            refreshTasks.push(loadPhotoFeed('friends-photo-feed', 'friends-feed-empty'));
        }
        if (typeof loadStoriesCarousel === 'function') {
            refreshTasks.push(loadStoriesCarousel());
        }
        if (typeof loadStories === 'function') {
            refreshTasks.push(loadStories());
        }
        await Promise.all(refreshTasks);

        if (shouldReopenViewer && typeof openFeedPostViewer === 'function') {
            await openFeedPostViewer(storyId);
        }

        showFeedComposerToast('Post updated', 'success');
    } catch (error) {
        console.error('Error saving feed post edit:', error);
        showFeedComposerToast('Could not save your edit. Please try again.', 'error');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.textContent = 'Save changes';
        }
        updateFeedPostEditorState();
    }
};

// Slide carousel to a specific index.
window.slideViewerCarousel = function(carouselId, index) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    const dots = carousel.querySelectorAll('.carousel-dot');
    const slideCount = Number(carousel.dataset.slideCount) || dots.length || 1;
    const maxIndex = Math.max(slideCount - 1, 0);
    const safeIndex = Math.max(0, Math.min(Number(index) || 0, maxIndex));
    const track = carousel.querySelector('.carousel-track');
    if (track) {
        track.style.transform = `translateX(-${safeIndex * (100 / slideCount)}%)`;
    }
    carousel.dataset.currentSlide = String(safeIndex);

    dots.forEach((dot, i) => {
        dot.style.opacity = i === safeIndex ? '1' : '0.4';
        if (i === safeIndex) dot.classList.add('active');
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

    carousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
            const slideCount = Number(carousel.dataset.slideCount) || carousel.querySelectorAll('.carousel-dot').length || 1;
            let currentSlide = Math.max(0, Math.min(Number(carousel.dataset.currentSlide) || 0, slideCount - 1));
            if (diff > 0 && currentSlide < slideCount - 1) currentSlide += 1;
            else if (diff < 0 && currentSlide > 0) currentSlide -= 1;
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

function getFeedMentionProfilesFromText(text) {
    const raw = String(text == null ? '' : text);
    const mentionRegex = /(^|[\s([{])@([A-Za-z0-9_]{1,40})/g;
    const profilesById = new Map();
    let match;

    while ((match = mentionRegex.exec(raw)) !== null) {
        const profile = getFeedMentionProfile(match[2]);
        if (!profile || !profile.id) continue;
        if (window.currentUser && profile.id === window.currentUser.id) continue;
        profilesById.set(profile.id, profile);
    }

    return Array.from(profilesById.values());
}

function getFeedMentionUserIdsFromText(text) {
    return getFeedMentionProfilesFromText(text).map(profile => profile.id);
}

function rememberFeedCommentMentionProfiles(comments) {
    const mentionProfiles = [];
    (comments || []).forEach(comment => {
        const mentions = Array.isArray(comment?.mentions) ? comment.mentions : [];
        mentions.forEach(mention => {
            mentionProfiles.push({
                id: mention.id || mention.user_id || mention.mentioned_user_id,
                name: mention.name || mention.user_name || mention.display_name || mention.full_name,
                profile_photo: mention.profile_photo || mention.photo || mention.user_photo
            });
        });
    });
    rememberFeedMentionProfiles(mentionProfiles);
}

// Post a comment on a feed post
window.postFeedComment = async function(storyId, inputEl) {
    if (!window.currentUser || !inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;
    const mentionedUserIds = getFeedMentionUserIdsFromText(text);

    // Disable input while posting
    inputEl.disabled = true;
    const btn = document.getElementById('feed-comment-btn-' + storyId);
    if (btn) btn.style.opacity = '0.3';

    try {
        await dbHelpers.stories.addComment(storyId, window.currentUser.id, text, mentionedUserIds);
        inputEl.value = '';
        closeFeedMentionMenu();
        // Reload comments for this post
        await loadFeedComments(storyId);
    } catch (error) {
        console.error('Error posting comment:', error);
    } finally {
        inputEl.disabled = false;
        if (btn) btn.style.opacity = '0.5';
    }
};

function getFeedCommentLikeCount(comment) {
    const count = Number(comment ? comment.like_count : 0);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function isFeedCommentLikedByMe(comment) {
    return !!(comment && (comment.liked_by_me === true || comment.liked_by_me === 'true'));
}

function setFeedCommentLikeButtonState(button, liked, count) {
    if (!button) return;
    const nextCount = Math.max(0, Number.isFinite(Number(count)) ? Math.floor(Number(count)) : 0);
    button.dataset.liked = liked ? 'true' : 'false';
    button.dataset.likeCount = String(nextCount);
    button.setAttribute('aria-pressed', liked ? 'true' : 'false');
    button.setAttribute('aria-label', liked ? 'Unlike comment' : 'Like comment');
    button.title = liked ? 'Unlike comment' : 'Like comment';
    button.style.color = liked ? '#ef4444' : 'var(--text-muted)';
    button.style.opacity = liked || nextCount > 0 ? '1' : '0.62';

    const icon = button.querySelector('svg');
    if (icon) icon.style.fill = liked ? 'currentColor' : 'none';

    const countEl = button.querySelector('.feed-comment-like-count');
    if (countEl) countEl.textContent = nextCount > 0 ? String(nextCount) : '';
}

function updateFeedCommentLikeButtons(commentId, liked, count, fallbackButton) {
    const buttons = Array.from(document.querySelectorAll('.feed-comment-like-btn'))
        .filter(button => button.dataset.commentId === commentId);
    if (fallbackButton && !buttons.includes(fallbackButton)) buttons.push(fallbackButton);
    buttons.forEach(button => setFeedCommentLikeButtonState(button, liked, count));
}

function renderFeedCommentLikeButton(comment, storyId) {
    const commentId = String(comment && (comment.comment_id || comment.id) || '');
    if (!commentId) return '';

    const liked = isFeedCommentLikedByMe(comment);
    const likeCount = getFeedCommentLikeCount(comment);
    const jsCommentId = escapeJsString(commentId);
    const jsStoryId = escapeJsString(storyId);

    return `<button type="button" class="feed-comment-like-btn" data-comment-id="${escapeHtml(commentId)}" data-liked="${liked ? 'true' : 'false'}" data-like-count="${likeCount}" aria-pressed="${liked ? 'true' : 'false'}" aria-label="${liked ? 'Unlike comment' : 'Like comment'}" title="${liked ? 'Unlike comment' : 'Like comment'}" onclick="event.stopPropagation(); toggleFeedCommentLike('${jsCommentId}', '${jsStoryId}', this)" style="background:none; border:none; color:${liked ? '#ef4444' : 'var(--text-muted)'}; opacity:${liked || likeCount > 0 ? '1' : '0.62'}; cursor:pointer; padding:1px 2px; min-width:34px; min-height:24px; display:inline-flex; align-items:center; justify-content:center; gap:2px; flex-shrink:0; transition:color 0.18s ease, opacity 0.18s ease, transform 0.18s ease;">
        <svg viewBox="0 0 24 24" aria-hidden="true" style="width:14px; height:14px; fill:${liked ? 'currentColor' : 'none'}; stroke:currentColor; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; flex-shrink:0;"><path d="M20.8 4.6c-1.5-1.5-4-1.5-5.5 0L12 7.9 8.7 4.6c-1.5-1.5-4-1.5-5.5 0s-1.5 4 0 5.5L12 18.9l8.8-8.8c1.5-1.5 1.5-4 0-5.5z"/></svg>
        <span class="feed-comment-like-count" style="font-size:0.68rem; font-weight:700; line-height:1;">${likeCount > 0 ? likeCount : ''}</span>
    </button>`;
}

function renderFeedCommentRow(comment, storyId) {
    const isOwn = !!(window.currentUser && comment.user_id === window.currentUser.id);
    const commentId = String(comment.comment_id || comment.id || '');

    return `<div class="feed-comment-row" style="padding:2px 0; font-size:0.82rem; line-height:1.35; display:flex; gap:4px; align-items:flex-start;">
        <span style="font-weight:600; color:var(--text-main); flex-shrink:0;">${escapeHtml(comment.user_name || 'Unknown')}</span>
        <span style="color:var(--text-main); word-break:break-word; flex:1; min-width:0;">${formatFeedText(comment.comment_text)}</span>
        ${renderFeedCommentLikeButton(comment, storyId)}
        ${isOwn ? `<button onclick="deleteFeedComment('${escapeJsString(commentId)}', '${escapeJsString(storyId)}')" style="background:none; border:none; cursor:pointer; font-size:0.65rem; color:var(--text-muted); padding:0 2px; min-width:20px; min-height:22px; flex-shrink:0;" aria-label="Delete">&times;</button>` : ''}
    </div>`;
}

// Toggle a like on a feed comment.
window.toggleFeedCommentLike = async function(commentId, storyId, buttonEl) {
    if (!window.currentUser || !commentId) return;

    const previousLiked = buttonEl ? buttonEl.dataset.liked === 'true' : false;
    const previousCount = buttonEl ? Number(buttonEl.dataset.likeCount || 0) : 0;
    const optimisticLiked = !previousLiked;
    const optimisticCount = Math.max(0, previousCount + (optimisticLiked ? 1 : -1));

    updateFeedCommentLikeButtons(commentId, optimisticLiked, optimisticCount, buttonEl);
    if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.style.transform = optimisticLiked ? 'scale(1.08)' : 'scale(1)';
    }

    try {
        const result = await dbHelpers.stories.toggleCommentLike(commentId);
        const liked = !!(result && result.liked_by_me);
        const count = Number(result && result.like_count);
        updateFeedCommentLikeButtons(commentId, liked, Number.isFinite(count) ? count : optimisticCount, buttonEl);
    } catch (error) {
        console.error('Error toggling feed comment like:', error);
        updateFeedCommentLikeButtons(commentId, previousLiked, previousCount, buttonEl);
    } finally {
        if (buttonEl) {
            buttonEl.disabled = false;
            buttonEl.style.transform = 'scale(1)';
        }
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
        rememberFeedMentionProfiles(comments.map(comment => ({
            id: comment.user_id,
            name: comment.user_name,
            profile_photo: comment.profile_photo
        })));
        rememberFeedCommentMentionProfiles(comments);

        // Show in chronological order (oldest first) for the preview
        const sorted = [...comments].reverse();
        const totalCount = comments.length;

        let html = '';
        // If there might be more comments, show a "view all" link
        if (totalCount >= 3) {
            html += `<div onclick="loadAllFeedComments('${storyId}')" style="font-size:0.78rem; color:var(--text-muted); cursor:pointer; padding:2px 0 4px;">View more comments</div>`;
        }
        sorted.forEach(c => {
            html += renderFeedCommentRow(c, storyId);
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
        rememberFeedMentionProfiles(comments.map(comment => ({
            id: comment.user_id,
            name: comment.user_name,
            profile_photo: comment.profile_photo
        })));
        rememberFeedCommentMentionProfiles(comments);

        const sorted = [...comments].reverse();
        let html = '';
        sorted.forEach(c => {
            html += renderFeedCommentRow(c, storyId);
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
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}

function escapeFeedTextSegment(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
}

function renderFeedMentionHandle(handle) {
    const cleanHandle = getFeedMentionHandle({ handle });
    if (!cleanHandle) return escapeFeedTextSegment('@' + String(handle || ''));

    const profile = getFeedMentionProfile(cleanHandle);
    const label = '@' + cleanHandle;

    if (profile && profile.id) {
        return `<button type="button" class="feed-mention-link" onclick="event.stopPropagation(); openFeedMentionProfile('${escapeJsString(profile.id)}', '${escapeJsString(profile.name)}', '${escapeJsString(profile.photo)}')" style="display:inline; border:none; background:transparent; padding:0; margin:0; color:var(--feed-mention-color,#2563eb); -webkit-text-fill-color:var(--feed-mention-color,#2563eb); font:inherit; font-weight:800; cursor:pointer;">${escapeHtml(label)}</button>`;
    }

    return `<span class="feed-mention-text" style="color:var(--feed-mention-color,#2563eb); -webkit-text-fill-color:var(--feed-mention-color,#2563eb); font-weight:800;">${escapeHtml(label)}</span>`;
}

function formatFeedText(text) {
    const raw = String(text == null ? '' : text);
    const mentionRegex = /(^|[\s([{])@([A-Za-z0-9_]{1,40})/g;
    let html = '';
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(raw)) !== null) {
        const prefix = match[1] || '';
        const mentionStart = match.index + prefix.length;
        html += escapeFeedTextSegment(raw.slice(lastIndex, mentionStart));
        html += renderFeedMentionHandle(match[2]);
        lastIndex = mentionStart + match[0].length - prefix.length;
    }

    html += escapeFeedTextSegment(raw.slice(lastIndex));
    return html;
}

function escapeJsString(text) {
    return String(text == null ? '' : text)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

window.openFeedMentionProfile = function(userId, userName, userPhoto) {
    if (!userId || typeof viewUserProfile !== 'function') return;
    try {
        if (typeof closeFeedPostViewer === 'function') closeFeedPostViewer();
    } catch (_) {}
    viewUserProfile(userId, userName || 'Profile', userPhoto || '');
};

function isFeedStoryEdited(story) {
    if (!story || !story.created_at || !story.updated_at) return false;

    const createdAt = new Date(story.created_at).getTime();
    const updatedAt = new Date(story.updated_at).getTime();
    if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return false;

    return updatedAt - createdAt > 1000;
}

function getFeedStoryTimeLabel(story, timeAgo) {
    return isFeedStoryEdited(story) ? `${timeAgo} · Edited` : timeAgo;
}

function isFeedStoryEditable(story) {
    if (!story || !window.currentUser || story.user_id !== window.currentUser.id) return false;

    const mediaType = String(story.media_type || '').toLowerCase();
    const hasMedia = !!String(story.media_url || story.thumbnail_url || '').trim();
    const cardData = parseFeedCardData(story.caption);

    if (mediaType === 'text' || mediaType === 'image' || mediaType === 'video') {
        return true;
    }

    if (cardData && typeof cardData === 'object') {
        return true;
    }

    return !hasMedia;
}

function renderFeedPostActionsMenu(storyId, variant = 'card') {
    const isViewer = variant === 'viewer';
    const triggerIconColor = isViewer ? '#ffffff' : '#111827';
    const triggerStyles = isViewer
        ? 'background:rgba(255,255,255,0.14); color:#ffffff; -webkit-text-fill-color:#ffffff; border:1px solid rgba(255,255,255,0.24); box-shadow:0 10px 22px rgba(0,0,0,0.24);'
        : 'background:#ffffff; color:#111827; -webkit-text-fill-color:#111827; border:1px solid rgba(15,23,42,0.18); box-shadow:0 8px 18px rgba(15,23,42,0.12);';
    const menuStyles = isViewer
        ? 'background:rgba(17,24,39,0.98); color:#ffffff; -webkit-text-fill-color:#ffffff; border:1px solid rgba(255,255,255,0.1); box-shadow:0 18px 40px rgba(0,0,0,0.35);'
        : 'background:#ffffff; color:#111827; -webkit-text-fill-color:#111827; border:1px solid rgba(15,23,42,0.08); box-shadow:0 18px 40px rgba(15,23,42,0.16);';
    const itemStyles = isViewer
        ? 'background:transparent; color:#ffffff; -webkit-text-fill-color:#ffffff;'
        : 'background:transparent; color:#111827; -webkit-text-fill-color:#111827;';
    const deleteItemStyles = isViewer
        ? 'background:transparent; color:#fca5a5; -webkit-text-fill-color:#fca5a5;'
        : 'background:transparent; color:#dc2626; -webkit-text-fill-color:#dc2626;';

    return `
        <div class="feed-post-actions" data-feed-post-actions style="position:relative; flex-shrink:0;" onclick="event.stopPropagation();">
            <button type="button" class="feed-post-actions-btn feed-post-edit-btn" data-feed-post-actions-trigger aria-label="Post actions" aria-expanded="false" onclick="event.stopPropagation(); toggleFeedPostActionsMenu('${escapeJsString(storyId)}', '${variant}', this)" style="display:inline-flex; align-items:center; justify-content:center; width:36px; height:36px; padding:0; border-radius:50%; ${triggerStyles} cursor:pointer; flex-shrink:0; line-height:1; font-size:1.2rem; font-weight:900;">
                <span aria-hidden="true" style="display:block; color:${triggerIconColor}; -webkit-text-fill-color:${triggerIconColor}; line-height:1;">&#8942;</span>
            </button>
            <div data-feed-post-actions-menu style="display:none; position:absolute; right:0; top:calc(100% + 8px); min-width:170px; padding:6px; border-radius:16px; z-index:40; ${menuStyles};">
                <button type="button" onclick="event.stopPropagation(); closeFeedPostActionsMenu(); openFeedPostEditor('${escapeJsString(storyId)}')" style="width:100%; border:none; border-radius:12px; padding:11px 12px; text-align:left; cursor:pointer; font-size:0.85rem; font-weight:800; line-height:1.25; ${itemStyles};">
                    Edit
                </button>
                <button type="button" onclick="event.stopPropagation(); closeFeedPostActionsMenu(); deleteFeedPost('${escapeJsString(storyId)}')" style="width:100%; border:none; border-radius:12px; padding:11px 12px; text-align:left; cursor:pointer; font-size:0.85rem; font-weight:800; line-height:1.25; ${deleteItemStyles};">
                    Delete
                </button>
            </div>
        </div>
    `;
}

function renderFeedPostEditButton(storyId, variant = 'card') {
    return renderFeedPostActionsMenu(storyId, variant);
}

// Delete a feed post
window.deleteFeedPost = async function(storyId) {
    if (!confirm('Are you sure you want to delete this post?')) return;

    try {
        if (typeof window.closeFeedPostActionsMenu === 'function') {
            window.closeFeedPostActionsMenu();
        }
        if (typeof window.closeFeedPostEditor === 'function') {
            window.closeFeedPostEditor();
        }
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
            const visibleChats = (typeof window.filterVisibleGroupChats === 'function')
                ? window.filterVisibleGroupChats(chats)
                : (chats || []);

            if (!visibleChats || visibleChats.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:15px; color:var(--text-muted); font-size:0.85rem;">
                        <div style="margin-bottom:8px;">No group chats yet</div>
                        <button onclick="openCreateGroupChatModal(); closeFeedMessagesPanel();" style="background:var(--primary); color:white; border:none; padding:8px 16px; border-radius:8px; font-size:0.8rem; font-weight:600; cursor:pointer;">Create Chat</button>
                    </div>`;
            } else {
                container.innerHTML = visibleChats.map(chat => `
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

        // Pin coach account to top of friends list
        const coachId = window._coachUserId || (typeof getCoachUserId === 'function' ? await getCoachUserId() : null);
        if (coachId && friends) {
            friends.sort((a, b) => {
                if (a.friend_id === coachId) return -1;
                if (b.friend_id === coachId) return 1;
                return 0;
            });
        }

        const container = document.getElementById('panel-friends-list');
        const countLabel = document.getElementById('panel-friends-count');

        if (countLabel) {
            const count = friends ? friends.length : 0;
            countLabel.textContent = count === 0 ? '0 friends' : count === 1 ? '1 friend' : `${count} friends`;
        }

        if (container && friends && friends.length > 0) {
            container.innerHTML = friends.map(friend => {
                const friendName = friend.friend_name || friend.name || '';
                const friendPhoto = friend.friend_photo || friend.profile_photo || '';
                const initial = friendName ? friendName.charAt(0).toUpperCase() : '?';
                const avatarHtml = friendPhoto
                    ? `<img src="${friendPhoto}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
                    : `<span style="color:white; font-weight:700; font-size:0.85rem;">${initial}</span>`;

                // Status indicators
                let statusDot = '';
                if (friend.has_workout_today || friend.has_meal_today) {
                    statusDot = `<div style="position:absolute; bottom:1px; right:1px; width:10px; height:10px; background:#22c55e; border-radius:50%; border:2px solid white;"></div>`;
                }

                return `
                    <div onclick="openDirectMessage('${friend.friend_id}', '${friendName.replace(/'/g, "\\'")}'); closeFeedMessagesPanel();" style="display:flex; align-items:center; padding:10px 0; cursor:pointer; border-bottom:1px solid #f8fafc;">
                        <div style="position:relative; margin-right:10px;">
                            <div style="width:40px; height:40px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; overflow:hidden;">
                                ${avatarHtml}
                            </div>
                            ${statusDot}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:600; font-size:0.9rem; color:var(--text-main);">${friendName || 'Friend'}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted);">${friend.current_streak ? '🔥 ' + friend.current_streak : ''}</div>
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

// Initialize stories/feed once auth and the dashboard DOM are ready. Auth is async,
// and on iOS this file is loaded after pbbInitComplete, so window.load alone is too early.
let storiesFeatureInitialized = false;
let storiesFeatureInitTimer = null;
let storiesFeatureInitAttempts = 0;
let storiesFeatureRefreshInterval = null;
let storiesFeatureCleanupInterval = null;

async function initializeStoriesFeature() {
    if (storiesFeatureInitialized) return true;
    if (!window.currentUser || !window.dbHelpers || !window.dbHelpers.stories) return false;
    if (!document.getElementById('friends-photo-feed')) return false;

    storiesFeatureInitialized = true;

    cleanupExpiredStories().catch(e => console.warn('Init error:', e));
    loadPhotoFeed('friends-photo-feed', 'friends-feed-empty').catch(e => console.warn('Init error:', e));
    loadStoriesCarousel().catch(e => console.warn('Init error:', e));

    if (!storiesFeatureRefreshInterval) {
        storiesFeatureRefreshInterval = setInterval(function() {
            loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
            loadStoriesCarousel();
        }, 5 * 60 * 1000);
    }

    if (!storiesFeatureCleanupInterval) {
        storiesFeatureCleanupInterval = setInterval(cleanupExpiredStories, 60 * 60 * 1000);
    }

    return true;
}

function scheduleStoriesFeatureInit(delayMs = 0) {
    if (storiesFeatureInitialized || storiesFeatureInitTimer) return;

    storiesFeatureInitTimer = setTimeout(async function() {
        storiesFeatureInitTimer = null;
        const didInit = await initializeStoriesFeature();
        if (!didInit && storiesFeatureInitAttempts < 80) {
            storiesFeatureInitAttempts += 1;
            scheduleStoriesFeatureInit(250);
        }
    }, delayMs);
}

window.initializeStoriesFeature = initializeStoriesFeature;

if (typeof window.addEventListener !== 'undefined') {
    window.addEventListener('load', function() {
        scheduleStoriesFeatureInit();
    });
    window.addEventListener('pbbAuthReady', function() {
        scheduleStoriesFeatureInit();
    });
    window.addEventListener('pbbInitComplete', function() {
        scheduleStoriesFeatureInit();
    });
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            scheduleStoriesFeatureInit();
        });
    } else {
        scheduleStoriesFeatureInit();
    }
}
