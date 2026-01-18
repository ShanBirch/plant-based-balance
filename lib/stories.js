// --- STORIES FEATURE ---

let currentStories = [];
let currentStoryIndex = 0;
let currentUserStories = [];
let currentUserStoryIndex = 0;
let storyProgressInterval = null;
let selectedStoryFile = null;

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

        // Render story rings
        const carousel = document.getElementById('stories-carousel');
        if (!carousel) return;

        // Keep the "Add Your Story" button
        const addButton = carousel.querySelector('.add-story-btn');
        carousel.innerHTML = '';
        if (addButton) {
            carousel.appendChild(addButton);
        }

        // Add story rings for each user
        Object.values(groupedStories).forEach(userStoryGroup => {
            const ring = createStoryRing(userStoryGroup);
            carousel.appendChild(ring);
        });

    } catch (error) {
        console.error('Error loading stories:', error);
    }
};

// Create a story ring element
function createStoryRing(userStoryGroup) {
    const div = document.createElement('div');
    div.className = 'story-ring';
    div.style.cssText = 'display: inline-block; text-align: center; cursor: pointer;';
    div.onclick = () => openStoryViewer(userStoryGroup);

    const gradientColor = userStoryGroup.hasUnviewed
        ? 'linear-gradient(135deg, var(--primary), var(--secondary))'
        : 'linear-gradient(135deg, #d1d5db, #9ca3af)';

    const initial = userStoryGroup.user_name ? userStoryGroup.user_name.charAt(0).toUpperCase() : '?';
    const avatarContent = userStoryGroup.profile_photo
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

// Open story upload modal
window.openStoryUploadModal = function() {
    const modal = document.getElementById('story-upload-modal');
    if (modal) {
        modal.style.display = 'flex';
        resetStoryUploadForm();
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

// Upload story
window.uploadStory = async function() {
    if (!selectedStoryFile || !window.currentUser) return;

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

        // Get video duration if it's a video
        let duration = 5; // default for images
        if (isVideo) {
            const videoElement = document.getElementById('story-preview-video');
            if (videoElement && videoElement.duration) {
                duration = Math.ceil(videoElement.duration);
            }
        }

        // Generate a temporary story ID for upload
        const tempStoryId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

        // Check file size - if > 5MB, use Backblaze B2, otherwise use Base64
        const fileSizeMB = selectedStoryFile.size / (1024 * 1024);
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
        alert('Failed to upload story: ' + (error.message || 'Please try again.'));

        // Re-enable button
        if (uploadButton) {
            uploadButton.disabled = false;
            uploadButton.textContent = 'Share Story';
        }
    }
};

// Open story viewer
function openStoryViewer(userStoryGroup) {
    currentUserStories = userStoryGroup.stories;
    currentUserStoryIndex = 0;

    const modal = document.getElementById('story-viewer-modal');
    if (modal) {
        modal.style.display = 'flex';
        renderStory();
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

    // Update caption
    const captionOverlay = document.getElementById('story-caption-overlay');
    if (captionOverlay) {
        if (story.caption) {
            captionOverlay.textContent = story.caption;
            captionOverlay.style.display = 'block';
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
