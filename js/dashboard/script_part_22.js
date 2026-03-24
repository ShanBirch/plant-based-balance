// Image Modal Logic — defer on iOS to avoid DOM scan during critical DOMContentLoaded window
function _pbbInitImageModal() {
    const mealImages = document.querySelectorAll('.card-body img');
    mealImages.forEach(img => {
        img.addEventListener('click', function(e) {
            e.stopPropagation();
            openImageModal(this.src, this.alt);
        });
    });
}
if (window._pbbIsIOSSafari) {
    window.addEventListener('pbbInitComplete', _pbbInitImageModal, { once: true });
} else {
    document.addEventListener('DOMContentLoaded', _pbbInitImageModal);
}

function openImageModal(src, alt) {
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('modalImage');
    img.src = src;
    img.alt = alt || 'Meal Image';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; 
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.remove('active');
    document.body.style.overflow = ''; 
    setTimeout(() => {
        document.getElementById('modalImage').src = '';
    }, 300); 
}

// Close on escape key
document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
        closeImageModal();
    }
});

function showSupportTab(tab, btn) {
    // 1. Toggle Buttons
    const container = btn.parentElement;
    container.querySelectorAll('button').forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = '#718096';
    });
    btn.classList.add('active');
    btn.style.background = 'white';
    btn.style.color = 'var(--primary)';

    // 2. Toggle Content
    const chat = document.getElementById('support-chat');
    const comm = document.getElementById('support-community');
    const refl = document.getElementById('support-reflections');

    if (tab === 'chat') {
        chat.style.display = 'flex';
        comm.style.display = 'none';
        refl.style.display = 'none';
        // Scroll to bottom of chat messages after a short delay to ensure content is rendered
        setTimeout(() => {
            const chatContainer = document.getElementById('chat-messages-container');
            if (chatContainer) {
                const rect = chatContainer.getBoundingClientRect();
                const absoluteBottom = rect.bottom + window.pageYOffset;
                window.scrollTo({
                    top: absoluteBottom - window.innerHeight + 100, // 100px buffer for input box
                    behavior: 'smooth'
                });
            }
        }, 100);
    } else if (tab === 'community') {
        chat.style.display = 'none';
        comm.style.display = 'flex';
        refl.style.display = 'none';
        loadCommunityFeed(); // Refresh feed when opening
    } else if (tab === 'reflections') {
        chat.style.display = 'none';
        comm.style.display = 'none';
        refl.style.display = 'flex';
        loadAllReflections(); // Load reflections when opening
    }
}

// Helper function to scroll to bottom of chat messages
function scrollToBottomOfChat() {
    const chatContainer = document.getElementById('chat-messages-container');
    if (chatContainer) {
        // Check if container is inside a modal (has overflow-y: auto)
        const modal = document.getElementById('coach-chat-modal');
        if (modal && modal.style.display === 'flex') {
            // Scroll the container within the modal
            chatContainer.scrollTop = chatContainer.scrollHeight;
        } else {
            // Legacy full-page scroll
            const rect = chatContainer.getBoundingClientRect();
            const absoluteBottom = rect.bottom + window.pageYOffset;
            window.scrollTo({
                top: absoluteBottom - window.innerHeight + 100,
                behavior: 'smooth'
            });
        }
    }
}

// Consolidated Chat Logic (Old versions removed)


// Old chat logic removed.

// --- COMMUNITY CHAT LOGIC (HUMAN REFERRAL NETWORK ONLY) ---

function loadCommunityFeed() {
    let messages = [];
    try { messages = JSON.parse(localStorage.getItem('community_chat_history') || '[]'); } catch(e) {}
    if(messages.length === 0) {
        const sysMsg = {
            id: 'sys_' + Date.now(),
            isSystem: true,
            text: `Community group started`,
            timestamp: Date.now()
        };
        messages.push(sysMsg);
        localStorage.setItem('community_chat_history', JSON.stringify(messages));
    }
    renderChat(messages);
}

function renderChat(messages) {
    const container = document.getElementById('community-chat-stream');
    if(!container) return;

    // 1. Build a single massive string instead of touching the DOM repeatedly
    let fullHtml = '';

    messages.forEach((msg, msgIndex) => {
        const isMe = !msg.authorId || msg.authorId === 'current-user';

        // For other users, show their avatar and name
        let avatarHtml = '';
        let authorName = '';
        if(!isMe && msg.authorName) {
             // Use user's profile photo if available, otherwise use initials
             if (msg.authorAvatar) {
                 avatarHtml = `<img src="${msg.authorAvatar}" style="width:32px; height:32px; border-radius:50%; flex-shrink:0; align-self:flex-end; margin-bottom:5px; object-fit:cover;">`;
             } else {
                 const initials = msg.authorName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                 avatarHtml = `<div style="width:32px; height:32px; border-radius:50%; flex-shrink:0; align-self:flex-end; margin-bottom:5px; background:var(--primary); color:white; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:600;">${initials}</div>`;
             }
             authorName = msg.authorName;
        }

        const bBg = isMe ? 'var(--chat-bg-user)' : 'var(--chat-bg-coach)';
        const bText = isMe ? 'var(--chat-text-user)' : 'var(--chat-text-coach)';
        const bRadius = isMe ? '18px 18px 0 18px' : '18px 18px 18px 0';
        const bBorder = isMe ? 'none' : '1px solid var(--chat-border-coach)';
        const alignStyle = isMe ? "justify-content: flex-end;" : "justify-content: flex-start;";

        // Emoji reactions (keeping for human interactions)
        let reactionsHtml = '';
        if (msg.reactions && msg.reactions.length > 0) {
            const reactionCounts = {};
            msg.reactions.forEach(r => {
                reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
            });
            reactionsHtml = '<div style="display:flex; gap:4px; margin-top:4px; margin-left:10px; flex-wrap:wrap;">';
            Object.entries(reactionCounts).forEach(([emoji, count]) => {
                reactionsHtml += `<span style="font-size:0.85rem; background:#f1f5f9; padding:2px 6px; border-radius:10px; border:1px solid #e2e8f0;">${emoji} ${count > 1 ? count : ''}</span>`;
            });
            reactionsHtml += '</div>';
        }

        let messageHtml = '';
        if (msg.isSystem) {
            messageHtml = `<div style="text-align:center; margin: 20px 0; color:#94a3b8; font-size:0.8rem; font-weight:600; text-transform:uppercase; letter-spacing:1px;">${msg.text}</div>`;
        } else {
            messageHtml = `
            <div style="display:flex; ${alignStyle} margin-bottom: 12px; gap: 8px;">
                ${(!isMe && authorName) ? avatarHtml : ''}
                <div style="display:flex; flex-direction:column; max-width:75%; ${isMe ? 'align-items:flex-end;' : 'align-items:flex-start;'}">
                    ${(!isMe && authorName) ? `<div style="font-size:0.7rem; color:var(--text-muted); margin-left:10px; margin-bottom:2px;">${authorName}</div>` : ''}
                    <div>
                        <div style="padding: 10px 15px; font-size: 0.95rem; line-height: 1.4; background: ${bBg}; color: ${bText}; border-radius: ${bRadius}; border: ${bBorder}; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                            ${msg.text}
                        </div>
                        ${reactionsHtml}
                    </div>
                </div>
            </div>`;
        }

        // Append to string, NOT DOM
        fullHtml += messageHtml;
    });

    // 2. Update DOM exactly once
    container.innerHTML = fullHtml;
    container.scrollTop = container.scrollHeight;
}