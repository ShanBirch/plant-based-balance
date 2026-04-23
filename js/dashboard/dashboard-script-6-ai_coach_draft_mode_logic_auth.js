// --- AI COACH DRAFT MODE LOGIC & AUTHENTICATION ---
// Overrides and Extensions for the Coach Command Center

let isCoachMode = false;
let currentDMRecipient = null;

// Run fn as soon as the DOM is ready. On iOS this file is injected via
// `document.head.appendChild(...)` ~2s after pbbInitComplete to reduce init
// memory pressure — which means DOMContentLoaded has already fired by the
// time we parse. A bare `document.addEventListener('DOMContentLoaded', fn)`
// therefore silently never runs on iOS, which breaks every init block below
// (most visibly: subscribeToCoachMessages never fires, so the iPhone never
// gets the realtime + polling DM subscription that drives the red unread
// badge, the "New message" highlight on the sender in the inbox, and the
// per-sender red dot). Route all init through this helper instead.
function _runWhenDomReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
        // Async to preserve the "runs after current script" semantics
        // callers implicitly relied on with DOMContentLoaded.
        setTimeout(fn, 0);
    }
}


function checkUserRole() {
    // DISABLED: Coach Mode is replaced by admin-dashboard.html
    // All users should see the normal dashboard.
    return;
}

window.toggleCoachMode = function(show) {
    isCoachMode = show;
    const dash = document.getElementById('view-coach-dashboard');
    if (show) {
        if(dash) dash.style.display = 'block';
        if(typeof initCoachDashboard === 'function') initCoachDashboard();
        const returnBtn = document.getElementById('return-to-coach-btn');
        if(returnBtn) returnBtn.remove();
    } else {
        if(dash) dash.style.display = 'none';
    }
};

// User fact tracking - remembers key details across sessions
// User fact tracking - remembers key details across sessions
async function getUserFacts() {
    const user = window.currentUser;
    if (!user) return {};
    
    try {
        const facts = await dbHelpers.userFacts.get(user.id);
        if (facts) return facts;
        return {
            location: '',
            struggles: [],
            preferences: [],
            health_notes: [],
            personal_details: [],
            goals: []
        };
    } catch (e) {
        console.error("Error fetching user facts", e);
        return {};
    }
}

async function saveUserFact(category, fact) {
    const user = window.currentUser;
    if (!user) return;

    try {
        const facts = await getUserFacts();
        if (category === 'location') {
            facts.location = fact;
        } else if (Array.isArray(facts[category])) {
            // Avoid duplicates
            if (!facts[category].includes(fact)) {
                facts[category].push(fact);
            }
        } else {
             // Create array if missing
             facts[category] = [fact];
        }
        await dbHelpers.userFacts.upsert(user.id, facts);
    } catch(e) {
        console.error("Error saving user fact", e);
    }
}

async function gatherContext() {
    let dayNum = 1;
    const profile = await window.getUserProfile();
    
    if(profile && profile.program_start_date) {
         const start = new Date(profile.program_start_date);
         if(!isNaN(start)) {
             const diff = new Date() - start;
             dayNum = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
             if(dayNum < 1) dayNum = 1;
         }
    }
    
    // Get latest check-in for energy/sleep
    let energy = 'Unknown';
    let sleep = 'Unknown';
    try {
        const user = window.currentUser;
        if(user) {
            const today = getLocalDateString();
            const checkin = await dbHelpers.checkins.get(user.id, today);
            if(checkin) {
                energy = checkin.energy;
                sleep = checkin.sleep;
            }
        }
    } catch(e) {}

    const facts = await getUserFacts();

    return {
        name: profile?.name || "Friend",
        profile: (profile?.result || 'CORTISOL').toUpperCase(),
        sleep: sleep,
        energy: energy,
        challengeDay: dayNum,
        userFacts: facts
    };
}

// triggerCoachResponse removed - coach chat now uses direct messaging via nudges table

// ==========================================
// APPROVAL SYSTEM FUNCTIONS
// ==========================================

// VAPID Public Key for Web Push - Must match VAPID_PUBLIC_KEY in Netlify env vars
const VAPID_PUBLIC_KEY = 'BLYkAQao_i-6MnaGCpr3hST-GqSEjcAnA3JYOGEEOtVS8dn1LX3FkpFqAbIFNbjsafyPJRoHa6n-dRq6NvT1OBI';

/**
 * Initialize admin settings on page load
 * Shows admin-only UI elements
 */
async function initAdminSettings() {
    try {
        const isAdmin = await db.pushSubscriptions.isAdmin();
        if (isAdmin) {
            const adminBoard = document.getElementById('admin-board-setting');
            if (adminBoard) {
                adminBoard.style.display = 'block';
            }
        }
    } catch (error) {
        console.log('Not admin or error checking:', error);
    }
}

// Call on page load
_runWhenDomReady(() => {
    setTimeout(initAdminSettings, 1000); // Delay to ensure auth is ready
});

/**
 * Helper: Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}



// ==========================================
// COMMUNITY CHAT HELPER FUNCTIONS
// ==========================================

// Helper: Add typing indicator for community member
function addCommunityTypingIndicator(personaName) {
    const container = document.getElementById('community-messages-container');
    if (!container) return;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'community-typing-indicator';
    typingDiv.dataset.persona = personaName;
    typingDiv.style.cssText = "display: flex; align-items: center; margin-bottom: 12px; margin-left:10px;";
    typingDiv.innerHTML = `
        <div style="font-size: 0.75rem; color: #94a3b8; margin-right: 8px;">${personaName} is typing</div>
        <div style="width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both;"></div>
        <div style="width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; margin: 0 3px; animation: bounce 1.4s infinite ease-in-out both 0.16s;"></div>
        <div style="width: 6px; height: 6px; background: #94a3b8; border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both 0.32s;"></div>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

// Helper: Remove all typing indicators (or specific one)
function removeCommunityTypingIndicators(personaName = null) {
    if (personaName) {
        const indicators = document.querySelectorAll(`.community-typing-indicator[data-persona="${personaName}"]`);
        indicators.forEach(ind => ind.remove());
    } else {
        const indicators = document.querySelectorAll('.community-typing-indicator');
        indicators.forEach(ind => ind.remove());
    }
}

// Helper: Add emoji reaction to a message
function addEmojiReaction(messageIndex, emoji, reactorId) {
    let messages = [];
    try { messages = JSON.parse(localStorage.getItem('community_chat_history') || '[]'); } catch(e) {}
    if (messageIndex >= 0 && messageIndex < messages.length) {
        if (!messages[messageIndex].reactions) {
            messages[messageIndex].reactions = [];
        }
        messages[messageIndex].reactions.push({ emoji, reactorId });
        localStorage.setItem('community_chat_history', JSON.stringify(messages));
        renderChat(messages);
    }
}

// Helper: Mark message as read by member
function markMessageAsRead(messageIndex, memberId) {
    let messages = [];
    try { messages = JSON.parse(localStorage.getItem('community_chat_history') || '[]'); } catch(e) {}
    if (messageIndex >= 0 && messageIndex < messages.length) {
        if (!messages[messageIndex].readBy) {
            messages[messageIndex].readBy = [];
        }
        if (!messages[messageIndex].readBy.includes(memberId)) {
            messages[messageIndex].readBy.push(memberId);
        }
        localStorage.setItem('community_chat_history', JSON.stringify(messages));
    }
}

// Helper: Get member online status based on time of day (Brisbane time)
function getMemberOnlineStatus() {
    const now = new Date();
    const bneTime = new Date(now.toLocaleString("en-US", {timeZone: "Australia/Brisbane"}));
    const hour = bneTime.getHours();

    // Online status based on time of day
    // Peak activity: 7am-10am, 12pm-2pm, 2pm-6pm, 6pm-10pm
    // Low activity: 10pm-7am
    const onlineMembers = [];

    AI_MEMBERS.forEach(member => {
        let onlineChance = 0.3; // Base 30% chance

        if (hour >= 7 && hour < 10) onlineChance = 0.7; // Morning peak
        else if (hour >= 12 && hour < 14) onlineChance = 0.6; // Lunch peak
        else if (hour >= 14 && hour < 18) onlineChance = 0.5; // Afternoon moderate
        else if (hour >= 18 && hour < 22) onlineChance = 0.8; // Evening peak (highest)
        else if (hour >= 22 || hour < 7) onlineChance = 0.1; // Night/early morning

        if (Math.random() < onlineChance) {
            onlineMembers.push(member.id);
        }
    });

    return onlineMembers;
}

// Helper: Check if should respond to message and when
function shouldRespondToMessage() {
    const rand = Math.random();

    // 10% - No response (dead air)
    if (rand < 0.10) return { type: false };

    // 40% - Immediate response (2-10s)
    if (rand < 0.50) {
        const subRand = Math.random();
        if (subRand < 0.3) return { type: 'emoji', delay: 0 }; // 12% emoji immediate
        return { type: 'text', delay: 0 }; // 28% text immediate
    }

    // 25% - Quick delay (1-3 minutes)
    if (rand < 0.75) {
        const delay = 60000 + Math.random() * 120000; // 1-3 min
        return { type: 'text', delay: delay };
    }

    // 15% - Medium delay (5-15 minutes)
    if (rand < 0.90) {
        const delay = 300000 + Math.random() * 600000; // 5-15 min
        return { type: 'text', delay: delay };
    }

    // 10% - Long delay (30min-2 hours)
    const delay = 1800000 + Math.random() * 5400000; // 30min-2hrs
    return { type: 'text', delay: delay };
}

async function triggerAICommunityResponse(userMsg, chainCount = 0) {
    const lowMsg = userMsg.toLowerCase();
    let fullHistory = [];
    try { fullHistory = JSON.parse(localStorage.getItem('community_chat_history') || '[]'); } catch(e) {}

    // Check if there's been recent activity (conversation flow)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    const recentActivity = fullHistory.slice(-5).some(m =>
        m.timestamp > fiveMinutesAgo && m.authorId !== 'current-user'
    );
    const isActiveConversation = recentActivity || chainCount > 0;

    // Mark user's message as read by some members
    const lastMsgIndex = fullHistory.length - 1;
    if (lastMsgIndex >= 0 && fullHistory[lastMsgIndex].authorId === 'current-user') {
        const onlineMembers = getMemberOnlineStatus();
        const readersCount = Math.floor(Math.random() * Math.min(onlineMembers.length, 8)) + 2;
        for (let i = 0; i < readersCount; i++) {
            const randomMember = onlineMembers[Math.floor(Math.random() * onlineMembers.length)];
            markMessageAsRead(lastMsgIndex, randomMember);
        }
        renderChat(fullHistory);
    }

    // Check if should respond and when
    const response = shouldRespondToMessage();

    if (response.type === false) {
        // Dead air - no response
        return;
    }

    // Calculate total delay (base delay from shouldRespond + immediate response timing)
    const baseDelay = response.delay || 0;

    if (response.type === 'emoji') {
        // Just emoji reaction, no text
        const emojis = ['👍', '❤️', '🎉', '😂', '💪', '🙌', '✨', '🔥', '💯', '👏'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        const onlineMembers = getMemberOnlineStatus();
        const randomReactor = AI_MEMBERS.find(m => onlineMembers.includes(m.id)) || AI_MEMBERS[0];

        // Delay before reaction - quicker than text but still realistic
        let emojiImmediateDelay;
        if (isActiveConversation) {
            emojiImmediateDelay = 5000 + Math.random() * 25000; // 5-30s during active chat
        } else {
            emojiImmediateDelay = 30000 + Math.random() * 90000; // 30s-2min cold start
        }
        const emojiDelay = baseDelay + emojiImmediateDelay;
        setTimeout(() => {
            addEmojiReaction(lastMsgIndex, randomEmoji, randomReactor.id);
        }, emojiDelay);
        return;
    }

    // TEXT RESPONSE - Full logic (can be immediate or delayed)

    // 1. Thread Persistence & Direct Address Logic
    let persona = null;
    const onlineMembers = getMemberOnlineStatus();

    // A) Check for direct address (highest priority)
    for (const m of AI_MEMBERS) {
        const firstName = m.name.split(' ')[0].toLowerCase();
        if (lowMsg.includes(firstName)) {
            persona = m;
            break;
        }
    }

    // B) Active participants tracking (like real group chats!)
    if (!persona && fullHistory.length > 0) {
        const fifteenMinsAgo = Date.now() - (15 * 60 * 1000);
        const recentMessages = fullHistory.slice(-10).filter(m => m.timestamp > fifteenMinsAgo);

        const activeParticipants = [];
        const participantCounts = {};

        recentMessages.forEach(msg => {
            if (msg.authorId && msg.authorId !== 'current-user') {
                if (!participantCounts[msg.authorId]) {
                    participantCounts[msg.authorId] = 0;
                    const member = AI_MEMBERS.find(m => m.id === msg.authorId);
                    if (member && onlineMembers.includes(member.id)) {
                        activeParticipants.push(member);
                    }
                }
                participantCounts[msg.authorId]++;
            }
        });

        if (activeParticipants.length > 0) {
            const pickFromActive = Math.random() < 0.7; // 70% chance

            if (pickFromActive) {
                const weighted = [];
                activeParticipants.forEach(p => {
                    const count = participantCounts[p.id] || 1;
                    for (let i = 0; i < count; i++) {
                        weighted.push(p);
                    }
                });
                persona = weighted[Math.floor(Math.random() * weighted.length)];
            }
        }
    }

    // C) Fallback: pick someone random who's online
    if (!persona) {
        const onlineAIMembers = AI_MEMBERS.filter(m => onlineMembers.includes(m.id));
        persona = onlineAIMembers.length > 0
            ? onlineAIMembers[Math.floor(Math.random() * onlineAIMembers.length)]
            : AI_MEMBERS[Math.floor(Math.random() * AI_MEMBERS.length)];
    }

    // Multiple people typing at once (30% chance)
    const multipleTyping = Math.random() < 0.3 && chainCount === 0;
    let secondTyper = null;
    if (multipleTyping) {
        const otherOnlineMembers = AI_MEMBERS.filter(m => onlineMembers.includes(m.id) && m.id !== persona.id);
        if (otherOnlineMembers.length > 0) {
            secondTyper = otherOnlineMembers[Math.floor(Math.random() * otherOnlineMembers.length)];
        }
    }

    // Variable response timing based on conversation flow
    // Plus any delay from shouldRespondToMessage (for delayed responses)
    let immediateDelay;
    if (isActiveConversation) {
        // Active conversation: 15 seconds to 2 minutes
        immediateDelay = 15000 + Math.random() * 105000; // 15s-2min
    } else {
        // Cold start: 2-5 minutes
        immediateDelay = 120000 + Math.random() * 180000; // 2-5min
    }
    const totalDelay = baseDelay + immediateDelay;

    setTimeout(async () => {
        // Show typing indicator(s)
        addCommunityTypingIndicator(persona.name.split(' ')[0]);
        if (secondTyper) {
            setTimeout(() => addCommunityTypingIndicator(secondTyper.name.split(' ')[0]), 500 + Math.random() * 1000);
        }

        try {
            const historyContext = fullHistory.slice(-20).map(m => ({
                role: m.authorId === 'current-user' ? 'user' : 'model',
                text: `${m.authorName || 'Member'}: ${m.text}`,
                timestamp: m.timestamp
            }));

            // Determine what to respond to (current message vs earlier message)
            let contextMessage = userMsg;
            if (fullHistory.length > 3 && Math.random() < 0.25) {
                // 25% chance to respond to an earlier message (2-4 messages back)
                const lookBack = Math.floor(Math.random() * 3) + 2;
                const earlierMsg = fullHistory[fullHistory.length - lookBack];
                if (earlierMsg) {
                    contextMessage = `(Responding to earlier: "${earlierMsg.text}") ${userMsg}`;
                }
            }

            const response = await fetch('/.netlify/functions/ai-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'community',
                    message: contextMessage,
                    memberPersona: persona,
                    chatHistory: historyContext,
                    currentDateTime: new Date().toLocaleString(),
                    allowShortAcknowledgments: true // New flag for AI
                })
            });
            const data = await response.json();

            // If second typer, remove their indicator after first person responds
            if (secondTyper) {
                setTimeout(() => removeCommunityTypingIndicators(secondTyper.name.split(' ')[0]), 1000 + Math.random() * 2000);
            }

            if (data.reply) {
                const parts = data.reply.split(/\s*\|\|\|\s*/g).filter(s => s && s.trim());
                let totalDelay = 0;

                parts.forEach((part, idx) => {
                    if (idx > 0) {
                        setTimeout(() => addCommunityTypingIndicator(persona.name.split(' ')[0]), totalDelay);
                        totalDelay += 800 + Math.random() * 400;
                    }

                    const partDelay = 1200 + (part.length * 20);
                    setTimeout(() => {
                        removeCommunityTypingIndicators(persona.name.split(' ')[0]);
                        saveCommunityMessage(persona, part);

                        // If secondTyper exists, have them respond too (cross-talk!)
                        if (idx === parts.length - 1 && secondTyper && Math.random() < 0.6) {
                            const crossTalkDelay = 1000 + Math.random() * 2000; // 1-3s
                            setTimeout(() => triggerCrossTalkResponse(userMsg, secondTyper), crossTalkDelay);
                        }

                        // If it's the last part, consider triggering a peer response or jump-in
                        if (idx === parts.length - 1 && !secondTyper) {
                            if (chainCount < 2 && Math.random() < 0.35) {
                                const availableOnline = AI_MEMBERS.filter(m => onlineMembers.includes(m.id) && m.id !== persona.id);
                                if (availableOnline.length > 0) {
                                    const peerPersona = availableOnline[Math.floor(Math.random() * availableOnline.length)];
                                    const peerDelay = Math.random() < 0.5
                                        ? 2000 + Math.random() * 2000  // Fast: 2-4s
                                        : 5000 + Math.random() * 3000; // Slower: 5-8s
                                    setTimeout(() => triggerJumpInResponse(part, peerPersona, chainCount + 1), peerDelay);
                                }
                            }
                        }
                    }, totalDelay);
                    totalDelay += partDelay;
                });
            } else {
                removeCommunityTypingIndicators();
            }
        } catch (e) {
            removeCommunityTypingIndicators();
            console.log("Comm skip", e);
        }
    }, totalDelay);
}

async function triggerJumpInResponse(prevContext, persona, chainCount) {
    try {
        // Show typing indicator first
        addCommunityTypingIndicator(persona.name.split(' ')[0]);

        const fullHistory = JSON.parse(localStorage.getItem('community_chat_history') || '[]');
        const historyContext = fullHistory.slice(-20).map(m => ({
            role: m.authorId === 'current-user' ? 'user' : 'model',
            text: `${m.authorName || 'Member'}: ${m.text}`,
            timestamp: m.timestamp
        }));

        const response = await fetch('/.netlify/functions/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'community',
                message: `(Respond to: "${prevContext}")`,
                memberPersona: persona,
                chatHistory: historyContext,
                currentDateTime: new Date().toLocaleString(),
                allowShortAcknowledgments: true
            })
        });
        const data = await response.json();

        if (data.reply) {
            const parts = data.reply.split(/\s*\|\|\|\s*/g).filter(s => s && s.trim());
            let totalDelay = 0;

            parts.forEach((part, idx) => {
                if (idx > 0) {
                    // Show typing indicator before subsequent messages
                    setTimeout(() => addCommunityTypingIndicator(persona.name.split(' ')[0]), totalDelay);
                    totalDelay += 800 + Math.random() * 400; // 0.8-1.2s typing indicator
                }

                const partDelay = 1200 + (part.length * 20);
                setTimeout(() => {
                    removeCommunityTypingIndicators(persona.name.split(' ')[0]);
                    saveCommunityMessage(persona, part);

                    // Chain limit check with variable timing (only for online members)
                    if (idx === parts.length - 1 && chainCount < 2 && Math.random() < 0.3) {
                        const onlineMembers = getMemberOnlineStatus();
                        const availableNext = AI_MEMBERS.filter(m => m.id !== persona.id && onlineMembers.includes(m.id));
                        if (availableNext.length > 0) {
                            const nextPersona = availableNext[Math.floor(Math.random() * availableNext.length)];
                            const nextDelay = Math.random() < 0.5
                                ? 2000 + Math.random() * 2000  // Fast: 2-4s
                                : 4000 + Math.random() * 4000; // Slower: 4-8s
                            setTimeout(() => triggerJumpInResponse(part, nextPersona, chainCount + 1), nextDelay);
                        }
                    }
                }, totalDelay);
                totalDelay += partDelay;
            });
        } else {
            removeCommunityTypingIndicators(persona.name.split(' ')[0]);
        }
    } catch (e) {
        removeCommunityTypingIndicators(persona.name.split(' ')[0]);
        console.log("JumpIn skip", e);
    }
}

// Cross-talk: Second person responds with their own take
async function triggerCrossTalkResponse(originalMsg, persona) {
    try {
        // Short delay, then show typing
        setTimeout(() => {
            addCommunityTypingIndicator(persona.name.split(' ')[0]);
        }, 200);

        const fullHistory = JSON.parse(localStorage.getItem('community_chat_history') || '[]');
        const historyContext = fullHistory.slice(-20).map(m => ({
            role: m.authorId === 'current-user' ? 'user' : 'model',
            text: `${m.authorName || 'Member'}: ${m.text}`,
            timestamp: m.timestamp
        }));

        // Cross-talk often responds with short acknowledgments or different perspectives
        const response = await fetch('/.netlify/functions/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'community',
                message: originalMsg,
                memberPersona: persona,
                chatHistory: historyContext,
                currentDateTime: new Date().toLocaleString(),
                allowShortAcknowledgments: true,
                crossTalk: true // Flag for potentially shorter, different-angle response
            })
        });
        const data = await response.json();

        if (data.reply) {
            const parts = data.reply.split(/\s*\|\|\|\s*/g).filter(s => s && s.trim());
            let totalDelay = 0;

            parts.forEach((part, idx) => {
                if (idx > 0) {
                    setTimeout(() => addCommunityTypingIndicator(persona.name.split(' ')[0]), totalDelay);
                    totalDelay += 800 + Math.random() * 400;
                }

                const partDelay = 1200 + (part.length * 20);
                setTimeout(() => {
                    removeCommunityTypingIndicators(persona.name.split(' ')[0]);
                    saveCommunityMessage(persona, part);
                }, totalDelay);
                totalDelay += partDelay;
            });
        } else {
            removeCommunityTypingIndicators(persona.name.split(' ')[0]);
        }
    } catch (e) {
        removeCommunityTypingIndicators(persona.name.split(' ')[0]);
        console.log("CrossTalk skip", e);
    }
}

// ========================================
// AUTONOMOUS COMMUNITY MESSAGING SYSTEM
// ========================================

// Autonomous message topics for random conversations
const AUTONOMOUS_TOPICS = [
    { type: 'workout', prompts: [
        'Just finished an amazing morning walk! The fresh air really helps clear my head. Anyone else moving today?',
        'Did a gentle yoga flow this morning and feeling so much better. How do you all prefer to move?',
        'Trying to stay consistent with strength training but some days are harder than others. Anyone else struggling with motivation this week?',
        'That new workout in the Build section was challenging! How did everyone else find it?',
        'Taking a rest day today and trying not to feel guilty about it. Self-compassion is hard sometimes!',
        'Swimming has been such a game-changer for my joint pain. What movement makes you feel best?'
    ]},
    { type: 'nutrition', prompts: [
        'Made the most delicious plant-based Buddha bowl for lunch! Feeling so nourished. What\'s everyone eating today?',
        'Anyone else notice their cravings change throughout their cycle? I\'m craving all the green things this week.',
        'Finally nailed a good protein smoothie recipe. The key is frozen banana and a pinch of cinnamon!',
        'Struggling with meal prep this week. Life got busy. Anyone have quick go-to meals?',
        'My hot flashes have been better since I cut back on spicy foods. Anyone else notice food triggers?',
        'Just meal prepped for the week and feeling so organized! How do you all stay on track?'
    ]},
    { type: 'wellness', prompts: [
        'Had the best sleep last night after doing that evening wind-down routine. Game changer!',
        'Brain fog is real today. Anyone else? How do you cope when you\'re feeling scattered?',
        'Trying to be more mindful about my stress levels. Noticed my shoulders are always tense!',
        'The guided meditation in the resources section has been so helpful. Anyone else trying meditation?',
        'Feeling really grateful for this community today. It helps knowing we\'re all in this together.',
        'Energy levels have been all over the place this week. Hormones are wild! How\'s everyone feeling?'
    ]},
    { type: 'progress', prompts: [
        'Finally feeling like my cortisol is balancing out. The changes are subtle but they\'re there!',
        'Tracking my symptoms has been so eye-opening. Highly recommend if you haven\'t started yet.',
        'Hit a milestone today - 30 days of consistent movement! Never thought I\'d get here.',
        'Some days feel like steps backward, but trying to trust the process. Anyone else feel this way?',
        'My mood has been so much more stable lately. Plant-based eating is really making a difference.',
        'Noticing improvements in my sleep quality. It\'s the small wins that keep me going!'
    ]},
    { type: 'support', prompts: [
        'Having a tough day today. Just needed to share that with people who understand.',
        'This journey isn\'t linear and that\'s okay. Being gentle with myself today.',
        'Anyone else find perimenopause harder than they expected? Some days I feel lost.',
        'The support in this group means everything. Thank you for being here.',
        'Reminder to drink water! I always forget and then wonder why I feel terrible.',
        'How is everyone\'s week going? Really curious to hear how you\'re all doing.'
    ]}
];

// Saturday morning check-in prompts (Coach Shannon initiates these)
const SATURDAY_CHECKIN_PROMPTS = [
    'Morning everyone! Check-in time. How\'d your week go? I want to hear the real stuff - wins, struggles, whatever\'s on your mind.',
    'Hey everyone, Saturday check-in. What happened this week that actually mattered to you? Big or small, I\'m curious.',
    'Happy Saturday! Let\'s take a moment to reflect. What was the most challenging thing you dealt with this week and how did you work through it?',
    'Morning! Weekly check-in time. What surprised you about yourself this week? I always find these reflections so revealing.',
    'Saturday vibes! How are you all really doing? Share what\'s going on - the good, the messy, all of it.',
    'Hey friends! Check-in time. What did you learn about your body or your patterns this week? Let\'s share.',
    'Morning everyone. What\'s one thing from this week that you\'re still thinking about? Could be a win, a struggle, or just something that stuck with you.',
    'Saturday check-in! How did you take care of yourself this week? And how did it actually feel doing it?',
    'Hey all! Time for our weekly reflection. What was different about this week compared to last? Even small shifts count.',
    'Morning! Let\'s hear your stories. What moment this week made you feel most like yourself?'
];

// Get a random item from array
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Get random autonomous message prompt
function getRandomAutonomousPrompt() {
    const topic = getRandomItem(AUTONOMOUS_TOPICS);
    return getRandomItem(topic.prompts);
}

// Determine number of responses based on probability
function getResponseCount() {
    const rand = Math.random() * 100;
    if (rand < 10) return 0;      // 10% - no replies
    if (rand < 40) return 1;      // 30% - one reply
    if (rand < 75) return 2;      // 35% - two replies
    if (rand < 90) return 3;      // 15% - three replies
    return 4;                     // 10% - four replies
}

// Initiate autonomous community conversation
async function initiateAutonomousConversation(isCheckIn = false) {
    try {
        const fullHistory = JSON.parse(localStorage.getItem('community_chat_history') || '[]');

        // Select initiating member
        let initiator;
        if (isCheckIn) {
            // Coach Shannon always leads Saturday check-ins
            initiator = AI_MEMBERS.find(m => m.id === 'm0');
        } else {
            // For random messages, exclude Coach Shannon for more natural peer feel
            const nonCoachMembers = AI_MEMBERS.filter(m => m.id !== 'm0');
            initiator = getRandomItem(nonCoachMembers);
        }

        // Get message content
        const messageText = isCheckIn ? getRandomItem(SATURDAY_CHECKIN_PROMPTS) : getRandomAutonomousPrompt();

        // Add initiator message to chat
        saveCommunityMessage(initiator, messageText);

        // Determine number of responses
        const responseCount = isCheckIn ? Math.floor(Math.random() * 3) + 18 : getResponseCount(); // Check-ins get 18-20 responses

        if (responseCount === 0) {
            console.log('Autonomous message sent with no replies');
            return;
        }

        // Generate responses with varying delays
        const availableResponders = AI_MEMBERS.filter(m => m.id !== initiator.id);
        const responders = [];

        // Select unique responders
        for (let i = 0; i < responseCount && responders.length < availableResponders.length; i++) {
            let responder;
            do {
                responder = getRandomItem(availableResponders);
            } while (responders.find(r => r.id === responder.id));
            responders.push(responder);
        }

        // Schedule responses with realistic delays
        responders.forEach((responder, idx) => {
            let delay;
            if (isCheckIn) {
                // Spread check-ins over 3-5 hours (10,800,000 - 18,000,000 ms)
                const minDelay = 3 * 60 * 60 * 1000; // 3 hours in ms
                const maxDelay = 5 * 60 * 60 * 1000; // 5 hours in ms
                const timeRange = maxDelay - minDelay;
                // Distribute responders across the time range with some randomness
                const basePosition = (idx / responseCount) * timeRange;
                const randomJitter = (Math.random() - 0.5) * (timeRange / responseCount) * 2;
                delay = minDelay + basePosition + randomJitter;
            } else {
                // Regular messages have shorter delays
                const baseDelay = 8000;
                const randomDelay = baseDelay + (Math.random() * 15000);
                delay = (idx * 10000) + randomDelay;
            }

            setTimeout(async () => {
                try {
                    const currentHistory = JSON.parse(localStorage.getItem('community_chat_history') || '[]');
                    const historyContext = currentHistory.slice(-20).map(m => ({
                        role: m.authorId === 'current-user' ? 'user' : 'model',
                        text: `${m.authorName || 'Member'}: ${m.text}`,
                        timestamp: m.timestamp
                    }));

                    // Get previous check-in stories for this member to build continuity
                    let previousStories = '';
                    if (isCheckIn) {
                        const checkInHistory = JSON.parse(localStorage.getItem('saturday_checkin_stories') || '{}');
                        if (checkInHistory[responder.id] && checkInHistory[responder.id].length > 0) {
                            const recentStories = checkInHistory[responder.id].slice(-3); // Last 3 check-ins
                            previousStories = '\nYour previous check-in reflections: ' + recentStories.map(s => `"${s}"`).join(' | ');
                        }
                    }

                    // Enhanced prompt for check-ins
                    let promptMessage = messageText;
                    if (isCheckIn) {
                        promptMessage = `(This is your Saturday morning check-in. Shannon is asking the group to reflect on their week. Share an authentic, personal story from your week - something real and specific that happened to you. Talk about actual moments, feelings, struggles, or wins. Be vulnerable and detailed. Build on your journey over time.${previousStories} Respond to: "${messageText}")`;
                    }

                    // Call AI to generate response
                    const response = await fetch('/.netlify/functions/ai-chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            mode: 'community',
                            message: promptMessage,
                            memberPersona: responder,
                            chatHistory: historyContext,
                            currentDateTime: new Date().toLocaleString(),
                            isAutonomous: true
                        })
                    });

                    const data = await response.json();
                    if (data.reply) {
                        const parts = data.reply.split(/\s*\|\|\|\s*/g).filter(s => s && s.trim());
                        let totalDelay = 0;

                        parts.forEach((part, partIdx) => {
                            const partDelay = 1200 + (part.length * 20);
                            setTimeout(() => {
                                let msgs = JSON.parse(localStorage.getItem('community_chat_history') || '[]');
                                msgs.push({
                                    authorId: responder.id,
                                    authorName: responder.name,
                                    authorAvatar: responder.id.replace('m', ''),
                                    text: part,
                                    timestamp: Date.now()
                                });
                                // Cap chat history to 100 messages to prevent unbounded localStorage growth (iOS memory)
                                if (msgs.length > 100) msgs = msgs.slice(-100);
                                localStorage.setItem('community_chat_history', JSON.stringify(msgs));
                                if (typeof renderChat === 'function') renderChat(msgs);

                                // Save check-in story for continuity (only on last part)
                                if (isCheckIn && partIdx === parts.length - 1) {
                                    const checkInHistory = JSON.parse(localStorage.getItem('saturday_checkin_stories') || '{}');
                                    if (!checkInHistory[responder.id]) {
                                        checkInHistory[responder.id] = [];
                                    }
                                    // Store the full response (all parts combined) for this member
                                    checkInHistory[responder.id].push(data.reply.replace(/\s*\|\|\|\s*/g, ' '));
                                    // Keep only last 5 check-ins per member
                                    if (checkInHistory[responder.id].length > 5) {
                                        checkInHistory[responder.id].shift();
                                    }
                                    localStorage.setItem('saturday_checkin_stories', JSON.stringify(checkInHistory));

                                    // 40% chance someone reacts to this check-in story
                                    if (Math.random() < 0.4) {
                                        // Pick someone who will respond or has already responded
                                        const potentialReactors = responders.filter(r => r.id !== responder.id);
                                        if (potentialReactors.length > 0) {
                                            const reactor = getRandomItem(potentialReactors);
                                            const reactionDelay = 5000 + Math.random() * 15000; // 5-20 seconds after story
                                            setTimeout(() => {
                                                triggerCheckInReaction(part, responder, reactor);
                                            }, reactionDelay);
                                        }
                                    }
                                }
                            }, totalDelay);
                            totalDelay += partDelay;
                        });
                    }
                } catch (e) {
                    console.log('Autonomous response skip', e);
                }
            }, delay);
        });

    } catch (e) {
        console.log('Autonomous conversation skip', e);
    }
}

// Trigger a reaction/comment to a check-in story
async function triggerCheckInReaction(storyText, originalAuthor, reactor) {
    try {
        const currentHistory = JSON.parse(localStorage.getItem('community_chat_history') || '[]');
        const historyContext = currentHistory.slice(-20).map(m => ({
            role: m.authorId === 'current-user' ? 'user' : 'model',
            text: `${m.authorName || 'Member'}: ${m.text}`,
            timestamp: m.timestamp
        }));

        // Generate a supportive reaction/comment
        const reactionPrompt = `(${originalAuthor.name} just shared their check-in story. React to it with a brief, supportive comment. Be empathetic, relate to their experience, offer encouragement, or share how you connect with what they said. Keep it short and genuine - 1-2 sentences max. You're commenting on: "${storyText}")`;

        const response = await fetch('/.netlify/functions/ai-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: 'community',
                message: reactionPrompt,
                memberPersona: reactor,
                chatHistory: historyContext,
                currentDateTime: new Date().toLocaleString(),
                isAutonomous: true
            })
        });

        const data = await response.json();
        if (data.reply) {
            // Reactions should be quick and short, no multi-part needed
            const reactionText = data.reply.replace(/\s*\|\|\|\s*/g, ' ');
            saveCommunityMessage(reactor, reactionText);
            
            console.log(`💬 ${reactor.name} reacted to ${originalAuthor.name}'s story`);
        }
    } catch (e) {
        console.log('Check-in reaction skip', e);
    }
}

// Check if it's Saturday morning (7-9 AM Brisbane time)
function isSaturdayMorning() {
    const now = new Date();

    // Convert to Brisbane time (AEST/AEDT UTC+10/+11)
    const brisbaneTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Brisbane' }));
    const day = brisbaneTime.getDay();
    const hour = brisbaneTime.getHours();

    return day === 6 && hour >= 7 && hour < 9;
}

// Get last check-in date
function getLastCheckInDate() {
    const lastCheckIn = localStorage.getItem('last_saturday_checkin');
    return lastCheckIn ? new Date(lastCheckIn) : null;
}

// Check if check-in already happened this week
function checkInAlreadyDone() {
    const lastCheckIn = getLastCheckInDate();
    if (!lastCheckIn) return false;

    const now = new Date();
    const daysSinceLastCheckIn = (now - lastCheckIn) / (1000 * 60 * 60 * 24);

    // If less than 6 days since last check-in, it already happened this week
    return daysSinceLastCheckIn < 6;
}

// Trigger Saturday morning check-in
function triggerSaturdayCheckIn() {
    if (checkInAlreadyDone()) {
        console.log('Saturday check-in already done this week');
        return;
    }

    console.log('Initiating Saturday morning check-in...');
    localStorage.setItem('last_saturday_checkin', new Date().toISOString());
    initiateAutonomousConversation(true);
}

// Get last autonomous message time
function getLastAutonomousMessageTime() {
    const lastTime = localStorage.getItem('last_autonomous_message');
    return lastTime ? parseInt(lastTime) : 0;
}

// Check if it's time for autonomous message
function shouldTriggerAutonomousMessage() {
    const lastTime = getLastAutonomousMessageTime();
    const now = Date.now();
    const timeSinceLast = now - lastTime;

    // Random interval between 1-2 hours (3600000-7200000 ms)
    const minInterval = 60 * 60 * 1000; // 1 hour
    const maxInterval = 2 * 60 * 60 * 1000; // 2 hours
    const randomInterval = minInterval + Math.random() * (maxInterval - minInterval);

    return timeSinceLast > randomInterval;
}

// Trigger random autonomous message
function triggerAutonomousMessage() {
    console.log('Initiating autonomous community message...');
    localStorage.setItem('last_autonomous_message', Date.now().toString());
    initiateAutonomousConversation(false);
}

// Main autonomous system controller
function checkAutonomousActivity() {
    // Check for Saturday morning check-in first
    if (isSaturdayMorning()) {
        triggerSaturdayCheckIn();
        return; // Don't do random messages during check-in window
    }

    // Check for random autonomous messages
    if (shouldTriggerAutonomousMessage()) {
        triggerAutonomousMessage();
    }
}

// Initialize autonomous system
function initializeAutonomousSystem() {
    console.log('Autonomous community messaging system initialized');

    // Check immediately on load
    setTimeout(() => {
        checkAutonomousActivity();
    }, 5000); // Wait 5 seconds after page load

    // Check every 30 minutes
    setInterval(() => {
        checkAutonomousActivity();
    }, 30 * 60 * 1000);
}

// Start autonomous system when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAutonomousSystem);
} else {
    initializeAutonomousSystem();
}

// ========================================
// TESTING & DEBUG FUNCTIONS
// ========================================

// Manual triggers for testing (accessible via browser console)
window.testAutonomousMessage = function() {
    console.log('🧪 Testing autonomous message...');
    initiateAutonomousConversation(false);
};

window.testSaturdayCheckIn = function() {
    console.log('🧪 Testing Saturday check-in...');
    initiateAutonomousConversation(true);
};

window.resetAutonomousTimers = function() {
    console.log('🔄 Resetting autonomous timers...');
    localStorage.removeItem('last_autonomous_message');
    localStorage.removeItem('last_saturday_checkin');
    console.log('✅ Timers reset! Next check will trigger new messages.');
};

window.getAutonomousStatus = function() {
    const lastMsg = getLastAutonomousMessageTime();
    const lastCheckIn = getLastCheckInDate();
    const nextMsgIn = lastMsg ? Math.max(0, (60 * 60 * 1000) - (Date.now() - lastMsg)) : 0;

    console.log('📊 Autonomous System Status:');
    console.log('─────────────────────────────');
    console.log(`Last autonomous message: ${lastMsg ? new Date(lastMsg).toLocaleString() : 'Never'}`);
    console.log(`Next message in: ${Math.floor(nextMsgIn / 60000)} minutes (approximately)`);
    console.log(`Last Saturday check-in: ${lastCheckIn ? lastCheckIn.toLocaleString() : 'Never'}`);
    console.log(`Is Saturday morning now: ${isSaturdayMorning()}`);
    console.log(`Check-in already done this week: ${checkInAlreadyDone()}`);
    console.log('─────────────────────────────');
    console.log('💡 Try: testAutonomousMessage() or testSaturdayCheckIn()');
    console.log('💡 View stories: viewCheckInStories()');
};

window.viewCheckInStories = function(memberId) {
    let checkInHistory = {};
    try { checkInHistory = JSON.parse(localStorage.getItem('saturday_checkin_stories') || '{}'); } catch(e) {}

    if (memberId) {
        // Show specific member's stories
        const member = AI_MEMBERS.find(m => m.id === memberId);
        if (!member) {
            console.log(`❌ Member ${memberId} not found`);
            return;
        }
        console.log(`\n📖 Check-in Stories for ${member.name} (${memberId})`);
        console.log('═══════════════════════════════════════');
        if (checkInHistory[memberId] && checkInHistory[memberId].length > 0) {
            checkInHistory[memberId].forEach((story, idx) => {
                console.log(`\n[Week ${idx + 1}]:`);
                console.log(story);
                console.log('─────────────────────────────────────');
            });
        } else {
            console.log('No stories yet for this member.');
        }
    } else {
        // Show all members with stories
        console.log('\n📚 All Saturday Check-in Story History');
        console.log('═══════════════════════════════════════');
        const membersWithStories = Object.keys(checkInHistory);
        if (membersWithStories.length === 0) {
            console.log('No check-in stories recorded yet.');
            console.log('\n💡 Run testSaturdayCheckIn() to generate some stories!');
        } else {
            membersWithStories.forEach(id => {
                const member = AI_MEMBERS.find(m => m.id === id);
                const storyCount = checkInHistory[id].length;
                console.log(`\n${member ? member.name : id} (${id}): ${storyCount} check-in${storyCount > 1 ? 's' : ''}`);
                console.log(`💡 View details: viewCheckInStories('${id}')`);
            });
        }
    }
};

// ========================================
// END AUTONOMOUS COMMUNITY MESSAGING
// ========================================

window.openAsClient = function() {
    toggleCoachMode(false);
    if(typeof switchAppTab === 'function') switchAppTab('dashboard');
    const btn = document.createElement('div');
    btn.id = 'return-to-coach-btn';
    btn.innerHTML = '⏎ Return to Coach View';
    btn.style.cssText = 'position:fixed; bottom:90px; right:20px; background:#1e293b; color:white; padding:12px 20px; border-radius:50px; font-weight:bold; box-shadow:0 10px 25px rgba(0,0,0,0.3); z-index:10000; cursor:pointer; font-size:0.9rem;';
    btn.onclick = () => toggleCoachMode(true);
    document.body.appendChild(btn);
};

// Old submitCoachMessage removed as it is now defined earlier in the file.

// Load coach chat history from nudges table
window.loadChatHistory = async function() {
    const container = document.getElementById('chat-messages-container');
    if (!container || !window.currentUser) return;

    container.innerHTML = '';

    // Refresh Supabase session so RLS queries work with a valid JWT
    try {
        const { data: sessionData } = await window.supabaseClient.auth.getSession();
        if (!sessionData?.session) {
            await window.supabaseClient.auth.refreshSession();
        }
    } catch (authErr) {
        console.warn('[CoachChat] Session refresh failed (non-fatal):', authErr.message);
    }

    const coachId = await getCoachUserId();
    if (!coachId) {
        container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">Could not load messages.</div>`;
        return;
    }

    try {
        const userId = window.currentUser.id;
        console.log('[CoachChat] Loading messages between', userId.substring(0, 8), 'and coach', coachId.substring(0, 8));

        const { data: messages, error } = await window.supabaseClient
            .from('nudges')
            .select('*')
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${coachId}),and(sender_id.eq.${coachId},receiver_id.eq.${userId})`)
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) throw error;

        if (!messages || messages.length === 0) {
            const profile = await window.getUserProfile();
            const userName = profile?.name || '';
            const greeting = userName ? `Hey ${userName}!` : 'Hey!';
            container.innerHTML = `
                <div style="display: flex; justify-content: flex-start; align-items: flex-end; margin-bottom: 20px; animation: fadeIn 0.3s ease;">
                     <img src="assets/coach_shannon.jpg" style="width: 36px; height: 36px; border-radius: 50%; margin-right: 10px; flex-shrink: 0; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); object-fit: cover;">
                     <div style="display: flex; flex-direction: column; align-items: flex-start; max-width: 80%;">
                         <div style="background: var(--chat-bg-coach); color: var(--chat-text-coach); padding: 12px 18px; border-radius: 18px 18px 18px 0; border: 1px solid var(--chat-border-coach); font-size: 1rem; line-height: 1.5; box-shadow: 0 2px 5px rgba(0,0,0,0.05); text-align: left;">
                             <p style="margin: 0; white-space: pre-wrap;">${greeting} Shannon here. Send me a message any time!</p>
                         </div>
                         <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 5px; margin-left: 5px;">Shannon</span>
                     </div>
                </div>`;
            return;
        }

        messages.forEach(msg => {
            const isUser = msg.sender_id === window.currentUser.id;
            const rowDiv = document.createElement('div');
            rowDiv.style.cssText = `display: flex; justify-content: ${isUser ? 'flex-end' : 'flex-start'}; align-items: flex-end; margin-bottom: 20px; animation: fadeIn 0.3s ease;`;

            const timeStr = new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const msgText = msg.message || '';

            if (isUser) {
                rowDiv.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: flex-end; max-width: 80%;">
                        <div style="background: var(--chat-bg-user); color: var(--chat-text-user); padding: 12px 18px; border-radius: 18px 18px 0 18px; font-size: 1rem; line-height: 1.5; box-shadow: 0 2px 5px rgba(0,0,0,0.05); text-align: left;">${msgText}</div>
                        <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 5px; margin-right: 5px;">You  ${timeStr}</span>
                    </div>
                    <img src="https://ui-avatars.com/api/?name=You&background=cbd5e1&color=fff" style="width: 36px; height: 36px; border-radius: 50%; margin-left: 10px; flex-shrink: 0; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                `;
            } else {
                rowDiv.innerHTML = `
                    <img src="assets/coach_shannon.jpg" style="width: 36px; height: 36px; border-radius: 50%; margin-right: 10px; flex-shrink: 0; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); object-fit: cover;">
                    <div style="display: flex; flex-direction: column; align-items: flex-start; max-width: 80%;">
                        <div style="background: var(--chat-bg-coach); color: var(--chat-text-coach); padding: 12px 18px; border-radius: 18px 18px 18px 0; border: 1px solid var(--chat-border-coach); font-size: 1rem; line-height: 1.5; box-shadow: 0 2px 5px rgba(0,0,0,0.05); text-align: left;">
                            <p style="margin: 0; white-space: pre-wrap;">${msgText}</p>
                        </div>
                        <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 5px; margin-left: 5px;">Shannon  ${timeStr}</span>
                    </div>
                `;
            }
            container.appendChild(rowDiv);
        });
        scrollToBottomOfChat();

        // Mark coach messages as read
        await window.supabaseClient
            .from('nudges')
            .update({ read_at: new Date().toISOString() })
            .eq('receiver_id', window.currentUser.id)
            .eq('sender_id', coachId)
            .is('read_at', null);

    } catch (error) {
        console.error('Error loading coach chat history:', error);
        container.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444;">Failed to load messages</div>`;
    }
};

// Append a new incoming message to the coach chat UI
window.appendCoachMessage = function(text) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    const rowDiv = document.createElement('div');
    rowDiv.style.cssText = "display: flex; justify-content: flex-start; align-items: flex-end; margin-bottom: 20px; animation: fadeIn 0.3s ease;";

    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    rowDiv.innerHTML = `
        <img src="assets/coach_shannon.jpg" style="width: 36px; height: 36px; border-radius: 50%; margin-right: 10px; flex-shrink: 0; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); object-fit: cover;">
        <div style="display: flex; flex-direction: column; align-items: flex-start; max-width: 80%;">
            <div style="background: var(--chat-bg-coach); color: var(--chat-text-coach); padding: 12px 18px; border-radius: 18px 18px 18px 0; border: 1px solid var(--chat-border-coach); font-size: 1rem; line-height: 1.5; box-shadow: 0 2px 5px rgba(0,0,0,0.05); text-align: left;">
                <p style="margin: 0; white-space: pre-wrap;">${text}</p>
            </div>
            <span style="font-size: 0.7rem; color: var(--text-muted); margin-top: 5px; margin-left: 5px;">Shannon  ${timeStr}</span>
        </div>
    `;

    container.appendChild(rowDiv);
    scrollToBottomOfChat();

    // Mark as unread
    localStorage.setItem('coach_unread_messages', 'true');

    // Update message badges (inbox icon, nav button, app icon)
    if (typeof updateMessageBadges === 'function') {
        updateMessageBadges((window._unreadDMCount || 0) + 1);
    }
};

/**
 * Show an in-app notification banner when a DM arrives.
 * Slides down from the top of the screen like a native push notification.
 * Tapping it opens the conversation with the sender.
 */
window.showDMNotificationBanner = function showDMNotificationBanner(senderName, senderPhoto, messageText, senderId, extras) {
    // `extras` (optional): { nudgeType, referenceId } — lets special nudges
    // like challenge invites route the banner tap straight into the accept flow.
    const nudgeType = extras && extras.nudgeType ? extras.nudgeType : null;
    const referenceId = extras && extras.referenceId ? extras.referenceId : null;
    // Remove any existing DM notification banner
    const existing = document.getElementById('dm-notification-banner');
    if (existing) existing.remove();

    const preview = messageText.length > 80 ? messageText.substring(0, 80) + '...' : messageText;
    const initials = (senderName || '?').charAt(0).toUpperCase();
    const avatarHtml = senderPhoto
        ? '<img src="' + senderPhoto + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;">'
        : '<div style="width:40px;height:40px;border-radius:50%;background:var(--primary);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;">' + initials + '</div>';

    const banner = document.createElement('div');
    banner.id = 'dm-notification-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;padding:calc(10px + env(safe-area-inset-top, 0px)) 16px 12px;background:rgba(255,255,255,0.97);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 4px 24px rgba(0,0,0,0.15);cursor:pointer;animation:dmBannerSlideIn 0.35s ease-out;border-bottom:1px solid #e2e8f0;';
    banner.innerHTML = '<div style="display:flex;align-items:center;gap:12px;max-width:600px;margin:0 auto;">'
        + avatarHtml
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-weight:700;font-size:0.9rem;color:#1e293b;">' + (senderName || 'New Message') + '</div>'
        + '<div style="font-size:0.82rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + preview + '</div>'
        + '</div>'
        + '<div style="font-size:0.7rem;color:#94a3b8;flex-shrink:0;">now</div>'
        + '</div>';

    // Tap to open conversation
    banner.addEventListener('click', function() {
        banner.remove();
        if (senderId) {
            const isGameMessage = messageText.includes('🎮') && (messageText.includes('challenge') || messageText.includes('Tap here to play!') || messageText.includes('turn'));
            const isQuizBattle = messageText.includes('⚡ QUIZ BATTLE');
            const isChallengeInvite = nudgeType === 'challenge_invite' && !!referenceId;

            if (isChallengeInvite) {
                if (typeof window.handleChallengeInviteMessageClick === 'function') {
                    window.handleChallengeInviteMessageClick(referenceId);
                } else if (typeof openDirectMessage === 'function') {
                    openDirectMessage(senderId, senderName || 'User', senderPhoto || '');
                }
            } else if (isQuizBattle) {
                 if (typeof window.handleQuizBattleMessageClick === 'function') {
                    window.handleQuizBattleMessageClick(senderId);
                } else {
                    if (typeof window.switchAppTab === 'function') window.switchAppTab('learning');
                }
            } else if (isGameMessage && typeof window.handleGameMessageClick === 'function') {
                window.handleGameMessageClick(senderId);
            } else {
                // Open the DM conversation with this sender
                if (typeof openDirectMessage === 'function') {
                    openDirectMessage(senderId, senderName || 'User', senderPhoto || '');
                } else if (typeof window.switchAppTab === 'function') {
                    window.switchAppTab('social');
                }
            }
        }
    });

    // Add slide-in animation if not already defined
    if (!document.getElementById('dm-banner-animation-style')) {
        const style = document.createElement('style');
        style.id = 'dm-banner-animation-style';
        style.textContent = '@keyframes dmBannerSlideIn{from{transform:translateY(-100%);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes dmBannerSlideOut{from{transform:translateY(0);opacity:1}to{transform:translateY(-100%);opacity:0}}';
        document.head.appendChild(style);
    }

    document.body.appendChild(banner);

    // Play notification sound (short vibration pattern for native)
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    // Native Android: fire a local notification so the app icon gets a badge dot.
    // The heads-up display + shade entry triggers the launcher badge dot automatically.
    if (typeof isNativeApp === 'function' && isNativeApp()) {
        var _ln = typeof window._getLocalNotificationsPlugin === 'function' ? window._getLocalNotificationsPlugin() : null;
        if (_ln) {
            _ln.schedule({
                notifications: [{
                    id: 7777 + (Date.now() % 1000),
                    title: senderName || 'New Message',
                    body: messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText,
                    sound: 'default',
                    smallIcon: 'ic_stat_notification',
                    channelId: 'dm-messages',
                    autoCancel: true,
                    extra: { type: 'dm_message', senderName: senderName || '' }
                }]
            }).catch(function(e) { console.warn('[Badge] Local notif error:', e); });
        }
    }

    // Auto-dismiss after 5 seconds
    setTimeout(function() {
        if (banner.parentNode) {
            banner.style.animation = 'dmBannerSlideOut 0.3s ease-in forwards';
            setTimeout(function() { if (banner.parentNode) banner.remove(); }, 300);
        }
    }, 5000);
}

/**
 * Unread DM counter — tracks new messages while user is not viewing them.
 * Persists across tab switches via localStorage.
 */
window._unreadDMCount = parseInt(localStorage.getItem('unread_dm_count') || '0', 10);

function updateMessageBadges(count) {
    window._unreadDMCount = count;
    localStorage.setItem('unread_dm_count', String(count));

    // Message inbox icon badge (Feed header)
    var inboxBadge = document.getElementById('message-inbox-badge');
    if (inboxBadge) {
        if (count > 0) {
            inboxBadge.textContent = count > 9 ? '9+' : String(count);
            inboxBadge.style.display = 'flex';
        } else {
            inboxBadge.style.display = 'none';
        }
    }

    // Update all header message badges across tabs (Home, Meals, Movement, Learn, Cycle)
    var headerBadges = document.querySelectorAll('.header-msg-badge');
    headerBadges.forEach(function(badge) {
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : String(count);
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    });

    // Feed nav button badge (bottom bar)
    var navBadge = document.getElementById('feed-nav-badge');
    if (navBadge) {
        if (count > 0) {
            navBadge.textContent = count > 9 ? '9+' : String(count);
            navBadge.style.display = 'flex';
        } else {
            navBadge.style.display = 'none';
        }
    }

    // App icon badge — PWA uses setAppBadge, native Android uses local notifications
    if (count > 0 && 'setAppBadge' in navigator) {
        navigator.setAppBadge(count).catch(function() {});
    } else if (count === 0) {
        if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(function() {});
        if ('setAppBadge' in navigator) navigator.setAppBadge(0).catch(function() {});
    }

    // Native Android: badge dots come from notifications in the shade.
    // Cancel the silent badge notification when count hits 0.
    if (count === 0 && typeof isNativeApp === 'function' && isNativeApp()) {
        var _ln2 = typeof window._getLocalNotificationsPlugin === 'function' ? window._getLocalNotificationsPlugin() : null;
        if (_ln2) { _ln2.cancel({ notifications: [{ id: 7777 }] }).catch(function() {}); }
    }
}

function clearMessageBadges() {
    updateMessageBadges(0);
    clearAllUnreadSenders();
}

// Play a short notification chime for in-app DM alerts
function playNotificationSound() {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);       // A5
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08); // ~C#6
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
    } catch (e) { /* audio not available */ }
}

/**
 * Per-sender unread tracking — stores which sender IDs have unread messages.
 * Used to show notification dots next to contacts in the messages panel.
 */
function getUnreadSenderIds() {
    try {
        return JSON.parse(localStorage.getItem('unread_sender_ids') || '[]');
    } catch (e) { return []; }
}

function addUnreadSender(senderId) {
    var senders = getUnreadSenderIds();
    if (senders.indexOf(senderId) === -1) {
        senders.push(senderId);
        localStorage.setItem('unread_sender_ids', JSON.stringify(senders));
    }
    // Update badge count based on number of unique senders
    updateMessageBadges(senders.length);
    // Refresh messages panel dots if it's open
    refreshPanelUnreadDots();
}

function clearUnreadSender(senderId) {
    var senders = getUnreadSenderIds();
    var idx = senders.indexOf(senderId);
    if (idx !== -1) {
        senders.splice(idx, 1);
        localStorage.setItem('unread_sender_ids', JSON.stringify(senders));
    }
    // Update badge count
    updateMessageBadges(senders.length);
    refreshPanelUnreadDots();
}

function clearAllUnreadSenders() {
    localStorage.setItem('unread_sender_ids', '[]');
    refreshPanelUnreadDots();
}

function refreshPanelUnreadDots() {
    var senders = getUnreadSenderIds();
    var dots = document.querySelectorAll('.dm-unread-dot');
    dots.forEach(function(dot) {
        var sid = dot.getAttribute('data-sender-id');
        if (sid) {
            dot.style.display = senders.indexOf(sid) !== -1 ? 'block' : 'none';
        }
    });

    // Handle hardcoded coach dots
    if (window._coachUserId) {
        var coachDots = document.querySelectorAll('.coach-unread-dot');
        var hasUnreadCoach = senders.indexOf(window._coachUserId) !== -1;
        coachDots.forEach(function(dot) {
            dot.style.display = hasUnreadCoach ? 'block' : 'none';
        });
    }
}

// Expose messaging functions on window so native-push.js can call them
window.addUnreadSender = addUnreadSender;
window.clearUnreadSender = clearUnreadSender;
window.refreshPanelUnreadDots = refreshPanelUnreadDots;
window.updateMessageBadges = updateMessageBadges;
window.clearMessageBadges = clearMessageBadges;

// Restore badge state on load
(function() {
    var stored = parseInt(localStorage.getItem('unread_dm_count') || '0', 10);
    if (stored > 0) updateMessageBadges(stored);
})();

/**
 * Admin unresponded messages checker.
 * For admin users, checks all DM conversations and finds ones where the last
 * message was sent by the other person (i.e. admin hasn't replied yet).
 * Shows a prominent pulsing badge on message icons so admins never miss a message.
 */
window._adminUnrespondedCount = 0;

async function checkAdminUnrespondedMessages() {
    if (!window.supabaseClient || !window.currentUser) return;

    // Check if current user is admin
    try {
        var isAdmin = await db.pushSubscriptions.isAdmin();
        if (!isAdmin) return;
    } catch (e) { return; }

    var userId = window.currentUser.id;

    try {
        // Get all messages where user is sender or receiver, ordered by newest first
        var { data: messages, error } = await window.supabaseClient
            .from('nudges')
            .select('id, sender_id, receiver_id, created_at, read_at')
            .or('sender_id.eq.' + userId + ',receiver_id.eq.' + userId)
            .order('created_at', { ascending: false })
            .limit(500);

        if (error || !messages) return;

        // Group by conversation partner and find last message per conversation
        var conversations = {};
        for (var i = 0; i < messages.length; i++) {
            var msg = messages[i];
            var partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
            if (!conversations[partnerId]) {
                conversations[partnerId] = msg; // first = most recent due to ordering
            }
        }

        // Count conversations where last message is FROM the other person (unresponded)
        var unrespondedCount = 0;
        var unrespondedPartners = [];
        var partnerIds = Object.keys(conversations);
        for (var j = 0; j < partnerIds.length; j++) {
            var lastMsg = conversations[partnerIds[j]];
            if (lastMsg.sender_id !== userId) {
                unrespondedCount++;
                unrespondedPartners.push(partnerIds[j]);
            }
        }

        window._adminUnrespondedCount = unrespondedCount;
        window._adminUnrespondedPartners = unrespondedPartners;

        // Update the header icon pulsing
        updateAdminUnrespondedUI(unrespondedCount);

        // Refresh friend cards in the messages panel if it's open
        var panel = document.getElementById('feed-messages-panel');
        if (panel && panel.style.display !== 'none') {
            applyUnrespondedHighlights();
        }

    } catch (e) {
        console.warn('[AdminUnresponded] Error checking:', e);
    }
}

function updateAdminUnrespondedUI(count) {
    // Add/update pulsing effect on header message icons when there are unresponded messages
    var icons = document.querySelectorAll('.header-msg-icon');
    icons.forEach(function(icon) {
        if (count > 0) {
            icon.classList.add('has-unresponded');
        } else {
            icon.classList.remove('has-unresponded');
        }
    });
}

/**
 * Apply red glow highlighting to friend cards in the messages panel
 * for conversations where the admin hasn't responded yet.
 */
function applyUnrespondedHighlights() {
    var partners = window._adminUnrespondedPartners || [];
    var rows = document.querySelectorAll('.panel-friend-row');
    rows.forEach(function(row) {
        var friendId = row.getAttribute('data-friend-id');
        if (partners.indexOf(friendId) !== -1) {
            row.classList.add('unresponded-row');
        } else {
            row.classList.remove('unresponded-row');
        }
    });
}

// Start admin unresponded checker after auth is ready
function startAdminUnrespondedPolling() {
    // Initial check after a delay for auth
    setTimeout(function() {
        checkAdminUnrespondedMessages();
    }, 3000);

    // Re-check every 30 seconds
    setInterval(function() {
        checkAdminUnrespondedMessages();
    }, 30000);
}

// Kick off when DOM is ready
_runWhenDomReady(function() {
    setTimeout(startAdminUnrespondedPolling, 2000);
});

/**
 * Subscribe to Supabase Realtime for new DMs (nudges) to this user
 * Messages appear instantly when coach (or anyone) sends a nudge
 */
window.subscribeToCoachMessages = function(userId) {
    if (window.guestMode) return; // No Realtime in guest mode
    if (!userId || !window.supabaseClient) return;

    // Track message IDs we've already shown to avoid duplicates.
    // Cap at 200 entries to prevent unbounded memory growth on iOS.
    window._shownMessageIds = window._shownMessageIds || new Set();
    if (window._shownMessageIds.size > 200) {
        var arr = Array.from(window._shownMessageIds);
        window._shownMessageIds = new Set(arr.slice(-100));
    }

    const channel = window.supabaseClient
        .channel('dm-messages-' + userId)
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'nudges',
                filter: `receiver_id=eq.${userId}`
            },
            async (payload) => {
                const newMessage = payload.new;

                // Avoid duplicates
                if (window._shownMessageIds.has(newMessage.id)) return;
                window._shownMessageIds.add(newMessage.id);

                // Don't notify for our own messages
                if (newMessage.sender_id === userId) return;

                // Check if the coach chat modal is open and message is from coach
                const coachId = await getCoachUserId();
                const modal = document.getElementById('coach-chat-modal');
                const isCoachChatOpen = modal && modal.style.display === 'flex';

                // Check if the DM modal is open AND visible for this sender
                const dmModal = document.getElementById('direct-message-modal');
                const isDMModalVisible = dmModal && (dmModal.style.display === 'flex' || dmModal.style.display === 'block');
                const isDMOpenForSender = isDMModalVisible
                    && typeof currentDMRecipient !== 'undefined'
                    && currentDMRecipient
                    && currentDMRecipient.id === newMessage.sender_id;

                if (coachId && newMessage.sender_id === coachId && isCoachChatOpen) {
                    // Display the message in the coach chat (user is already viewing it)
                    appendCoachMessage(newMessage.message);
                } else if (isDMOpenForSender) {
                    // DM modal is open for this sender - reload messages (user is viewing it)
                    loadDirectMessages(currentDMRecipient.id);
                } else {
                    // Message arrived but user is NOT viewing this conversation
                    // Show in-app notification banner

                    // Look up sender info for the notification
                    let senderName = 'New Message';
                    let senderPhoto = '';

                    if (coachId && newMessage.sender_id === coachId) {
                        senderName = 'Coach Shannon';
                        senderPhoto = 'assets/coach_shannon.jpg';
                        localStorage.setItem('coach_unread_messages', 'true');
                    } else {
                        // Look up sender name from the users table
                        try {
                            const { data: senderData } = await window.supabaseClient
                                .from('users')
                                .select('name, profile_photo')
                                .eq('id', newMessage.sender_id)
                                .maybeSingle();
                            if (senderData) {
                                senderName = senderData.name || 'Someone';
                                senderPhoto = senderData.profile_photo || '';
                            }
                        } catch (e) {
                            console.warn('Could not look up sender:', e);
                        }
                    }

                    // Show the in-app notification banner
                    showDMNotificationBanner(senderName, senderPhoto, newMessage.message, newMessage.sender_id, {
                        nudgeType: newMessage.nudge_type,
                        referenceId: newMessage.reference_id
                    });

                    // Play notification sound
                    playNotificationSound();

                    // Update unread badges (inbox icon, nav button, app icon)
                    updateMessageBadges((window._unreadDMCount || 0) + 1);

                    // Track this sender as having unread messages (for dots in messages panel)
                    addUnreadSender(newMessage.sender_id);
                }

                console.log('Realtime: New DM received from', newMessage.sender_id);
            }
        )
        .subscribe((status) => {
            console.log('[DM-Realtime] Subscription status:', status, 'for user:', userId);
            if (status === 'CHANNEL_ERROR') {
                console.warn('[DM-Realtime] Channel error — nudges table may not be in supabase_realtime publication. Relying on polling fallback.');
            }
        });

    console.log('[DM-Realtime] Subscribed to nudges changes + started 15s polling fallback for user:', userId);

    // Store channel reference for cleanup
    window._coachMessagesChannel = channel;

    // Start polling fallback in case Realtime publication is not enabled for nudges
    startDMPolling(userId);
};

/**
 * Polling fallback for DM notifications.
 * Checks for new messages every 15 seconds. This ensures notifications
 * work even if the nudges table is not in the supabase_realtime publication.
 * Once Realtime is working, both systems coexist safely because
 * _shownMessageIds prevents duplicate notifications.
 */
function startDMPolling(userId) {
    if (window._dmPollingInterval) clearInterval(window._dmPollingInterval);
    if (!userId || !window.supabaseClient) {
        console.warn('[DMPoll] Cannot start polling — userId:', userId, 'supabaseClient:', !!window.supabaseClient);
        return;
    }

    // Track the latest message timestamp we've seen
    window._lastDMPollTime = window._lastDMPollTime || new Date().toISOString();
    console.log('[DMPoll] Starting 15s polling for user:', userId, 'from:', window._lastDMPollTime);

    // Periodically refresh the Supabase session so the JWT stays valid.
    // A stale JWT causes RLS-protected queries to silently return 0 rows.
    var _lastSessionRefresh = Date.now();
    window._dmPollingInterval = setInterval(async () => {
        try {
            // Refresh session every 10 minutes to prevent stale JWTs
            if (Date.now() - _lastSessionRefresh > 10 * 60 * 1000) {
                try {
                    await window.supabaseClient.auth.getSession();
                    _lastSessionRefresh = Date.now();
                } catch (e) { /* non-fatal */ }
            }
            const { data: newMessages, error } = await window.supabaseClient
                .from('nudges')
                .select('id, sender_id, receiver_id, message, created_at, nudge_type, reference_id')
                .eq('receiver_id', userId)
                .neq('sender_id', userId)
                .gt('created_at', window._lastDMPollTime)
                .order('created_at', { ascending: true })
                .limit(10);

            if (error) {
                console.warn('[DMPoll] Query error:', error.message);
                return;
            }
            if (!newMessages || newMessages.length === 0) return;

            console.log('[DMPoll] Found', newMessages.length, 'new message(s)');

            // Update the poll timestamp to the latest message
            window._lastDMPollTime = newMessages[newMessages.length - 1].created_at;

            // Ensure dedup set exists; cap at 200 entries to prevent iOS memory growth
            window._shownMessageIds = window._shownMessageIds || new Set();
            if (window._shownMessageIds.size > 200) {
                var arr = Array.from(window._shownMessageIds);
                window._shownMessageIds = new Set(arr.slice(-100));
            }

            for (const msg of newMessages) {
                // Skip if already shown by Realtime
                if (window._shownMessageIds.has(msg.id)) continue;
                window._shownMessageIds.add(msg.id);

                // Check if user is currently viewing this conversation
                const dmModal = document.getElementById('direct-message-modal');
                const isDMModalVisible = dmModal && (dmModal.style.display === 'flex' || dmModal.style.display === 'block');
                const isDMOpenForSender = isDMModalVisible
                    && typeof currentDMRecipient !== 'undefined'
                    && currentDMRecipient
                    && currentDMRecipient.id === msg.sender_id;

                const coachId = window._coachUserId;
                const coachModal = document.getElementById('coach-chat-modal');
                const isCoachChatOpen = coachModal && coachModal.style.display === 'flex';

                if (coachId && msg.sender_id === coachId && isCoachChatOpen) {
                    appendCoachMessage(msg.message);
                } else if (isDMOpenForSender) {
                    loadDirectMessages(currentDMRecipient.id);
                } else {
                    // Show notification
                    let senderName = 'New Message';
                    let senderPhoto = '';

                    if (coachId && msg.sender_id === coachId) {
                        senderName = 'Coach Shannon';
                        senderPhoto = 'assets/coach_shannon.jpg';
                        localStorage.setItem('coach_unread_messages', 'true');
                    } else {
                        try {
                            const { data: senderData } = await window.supabaseClient
                                .from('users')
                                .select('name, profile_photo')
                                .eq('id', msg.sender_id)
                                .maybeSingle();
                            if (senderData) {
                                senderName = senderData.name || 'Someone';
                                senderPhoto = senderData.profile_photo || '';
                            }
                        } catch (e) { /* ignore */ }
                    }

                    showDMNotificationBanner(senderName, senderPhoto, msg.message, msg.sender_id, {
                        nudgeType: msg.nudge_type,
                        referenceId: msg.reference_id
                    });
                    playNotificationSound();
                    updateMessageBadges((window._unreadDMCount || 0) + 1);
                    addUnreadSender(msg.sender_id);
                }
            }
        } catch (e) {
            console.warn('[DMPoll] Error:', e);
        }
    }, 5000); // Poll every 5 seconds for responsive notifications

    // Pause DM polling when page is hidden to save memory/CPU on iOS
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            if (window._dmPollingInterval) { clearInterval(window._dmPollingInterval); window._dmPollingInterval = null; }
        } else if (!window._dmPollingInterval && userId) {
            startDMPolling(userId);
        }
    });
}

window.openCoachChat = function() {
    openCoachChatModal();

    // Clear unread flag
    localStorage.removeItem('coach_unread_messages');

    // Clear coach from unread senders (badge count updated inside clearUnreadSender)
    if (window._coachUserId) clearUnreadSender(window._coachUserId);
};

// Helper to save AI community messages to DB and Local Cache
async function saveCommunityMessage(persona, text) {
    // 1. Save to DB (Fire and forget to avoid blocking UI too much, or await if needed)
    const user = window.currentUser;
    if(user) {
        // We do not await this to keep UI snappy for animations, or we catch errors
        dbHelpers.conversations.create(user.id, 'community', 'model', text, persona.name).catch(e => console.error("DB Save Error", e));
    }

    // 2. Update Local Cache (for immediate UI and autonomous logic)
    let msgs = [];
    try { msgs = JSON.parse(localStorage.getItem('community_chat_history') || '[]'); } catch(e) {}
    
    // SAFETY LIMIT: Only keep last 50 messages to prevent crash
    if (msgs.length > 50) {
        msgs = msgs.slice(msgs.length - 50); 
    }

    msgs.push({
        authorId: persona.id,
        authorName: persona.name,
        authorAvatar: (persona.id || 'm1').replace('m', ''),
        text: text,
        timestamp: Date.now()
    });
    
    try {
        localStorage.setItem('community_chat_history', JSON.stringify(msgs));
    } catch(e) {
        console.warn("Storage full, clearing old history");
        localStorage.removeItem('community_chat_history'); // Emergency clear
    }
    
    // 3. Render
    if(typeof renderChat === 'function') renderChat(msgs);
}

window.loadCommunityFeed = async function() {
    if(!window.currentUser) return;

    try {
        // Get user's referral network (people they invited + who invited them)
        const network = await dbHelpers.referrals.getReferralNetwork(window.currentUser.id);

        // Create a Set of allowed user IDs (network + current user)
        const allowedUserIds = new Set([window.currentUser.id]);
        if (network && network.length > 0) {
            network.forEach(n => allowedUserIds.add(n.network_user_id));
        }

        // Get all community messages for this user
        const dbMessages = await dbHelpers.conversations.getHistory(window.currentUser.id, 'community');

        // Filter to only show messages from referral network
        const filteredMessages = dbMessages.filter(m => allowedUserIds.has(m.user_id));

        // Map DB messages to UI format for human-only chat
        const messages = filteredMessages.map(m => {
            const isCurrentUser = m.user_id === window.currentUser.id;

            return {
                authorId: isCurrentUser ? 'current-user' : (m.user_id || 'other-user'),
                authorName: m.author_name || (isCurrentUser ? 'You' : 'Friend'),
                authorAvatar: m.author_avatar || '', // Will show initials if no avatar
                text: m.message_text || m.text,
                timestamp: m.timestamp || new Date(m.created_at).getTime(),
                reactions: m.reactions || []
            };
        });

        // Cache for UI (keep last 50 messages)
        const cachedMessages = messages.slice(-50);
        localStorage.setItem('community_chat_history', JSON.stringify(cachedMessages));

        if(typeof renderChat === 'function') renderChat(cachedMessages);
    } catch (error) {
        console.error('Error loading community feed:', error);
        // Show empty chat on error
        if(typeof renderChat === 'function') renderChat([]);
    }
};

async function sendCommunityMessage() {
    const input = document.getElementById('community-chat-input');
    const text = input.value?.trim();
    if(!text) return;
    
    input.value = '';
    
    // Optimistic UI Update
    const user = window.currentUser || {};
    const userName = (await window.getUserProfile())?.name || 'Friend';
    
    const tempMsg = { 
        authorId: 'current-user', 
        authorName: userName,
        text, 
        timestamp: Date.now() 
    };
    
    let messages = [];
    try { messages = JSON.parse(localStorage.getItem('community_chat_history') || '[]'); } catch(e) {}
    messages.push(tempMsg);
    renderChat(messages); // Render immediately

    // Save to DB
    await dbHelpers.conversations.create(user.id, 'community', 'user', text, userName);

    // No AI responses - this is human-only referral network chat
}

// --- REFERRAL SYSTEM ---

let currentReferralCode = null;

// Client-side fallback code generator (used if database function fails)
function generateReferralCodeFallback() {
    // Generate a random 8-character alphanumeric code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    console.log('Generated fallback referral code:', code);
    return code;
}

// Check if referral code already exists in database
async function isReferralCodeUnique(code) {
    try {
        const existingUser = await window.dbHelpers.referrals.getUserByReferralCode(code);
        return !existingUser; // If no user found, code is unique
    } catch (error) {
        // If error is "not found", code is unique
        if (error.message && error.message.includes('not found')) {
            return true;
        }
        console.error('Error checking code uniqueness:', error);
        return true; // Assume unique if we can't check
    }
}

// Dismiss referral banner
function dismissReferralBanner() {
    const banner = document.getElementById('referral-invite-banner');
    if (banner) {
        banner.style.display = 'none';
        localStorage.setItem('referral_banner_dismissed', 'true');
    }
}

// Check if banner was dismissed and hide it
function checkReferralBannerDismissed() {
    const dismissed = localStorage.getItem('referral_banner_dismissed');
    if (dismissed === 'true') {
        const banner = document.getElementById('referral-invite-banner');
        if (banner) banner.style.display = 'none';
    }
}

// Load referral stats and update UI
async function loadReferralStats() {
    if (!window.currentUser) {
        const error = new Error('No current user found. Please ensure you are logged in.');
        console.error('loadReferralStats:', error.message);
        throw error;
    }

    // Check if banner was dismissed
    checkReferralBannerDismissed();

    try {
        console.log('Loading referral stats for user:', window.currentUser.id);
        const stats = await window.dbHelpers.referrals.getStats(window.currentUser.id);
        console.log('Referral stats loaded:', stats);

        // Check if user has a referral code, if not generate one using database function
        if (!stats.referralCode) {
            console.log('No referral code found, generating one...');

            let newCode = null;
            let usedFallback = false;

            try {
                // Try database function first
                console.log('Calling database generateReferralCode()...');
                newCode = await window.dbHelpers.referrals.generateReferralCode();
                console.log('Generated code via database:', newCode);

                if (!newCode) {
                    console.warn('Database function returned no code, using fallback generator');
                    usedFallback = true;
                    throw new Error('Database returned null');
                }
            } catch (dbError) {
                console.error('Database code generation failed:', dbError.message);
                console.log('Falling back to client-side code generation...');
                usedFallback = true;

                // Try client-side generation with uniqueness check
                let attempts = 0;
                const maxAttempts = 10;

                while (attempts < maxAttempts) {
                    newCode = generateReferralCodeFallback();
                    const isUnique = await isReferralCodeUnique(newCode);

                    if (isUnique) {
                        console.log('✓ Generated unique code (client-side):', newCode);
                        break;
                    }

                    attempts++;
                    console.log(`Code collision, retrying... (${attempts}/${maxAttempts})`);
                }

                if (attempts >= maxAttempts) {
                    throw new Error('Failed to generate unique referral code after multiple attempts');
                }
            }

            // Update user record with new referral code
            if (newCode) {
                try {
                    console.log('Updating user with new referral code...');
                    await window.dbHelpers.users.update(window.currentUser.id, {
                        referral_code: newCode
                    });
                    stats.referralCode = newCode;
                    console.log(`✓ Successfully saved referral code (${usedFallback ? 'fallback' : 'database'}):`, newCode);
                } catch (updateError) {
                    console.error('❌ Error saving referral code:', updateError);
                    throw new Error(`Failed to save referral code: ${updateError.message}`);
                }
            } else {
                throw new Error('No referral code generated');
            }
        }

        // Update stats in banner
        if (document.getElementById('referral-count')) {
            document.getElementById('referral-count').textContent = stats.totalReferrals || 0;
        }
        if (document.getElementById('free-days-count')) {
            document.getElementById('free-days-count').textContent = stats.freeDaysEarned || 0;
        }

        // Update network count in header (will be updated with friends count in updateFriendsCount)
        // Initial display from referrals, friends count will combine
        const referralCount = stats.totalReferrals || 0;
        if (document.getElementById('referral-network-count')) {
            // Try to get friends count too for a combined network number
            try {
                const friends = await db.friends.getFriendsWithFallback(window.currentUser.id);
                const friendCount = friends.length;
                const totalNetwork = referralCount + friendCount;
                document.getElementById('referral-network-count').textContent =
                    totalNetwork === 0 ? 'Add your first friend' :
                    totalNetwork === 1 ? '1 connection in your network' :
                    `${totalNetwork} connections in your network`;
            } catch (friendError) {
                // If friends fetch fails, just show referral count
                document.getElementById('referral-network-count').textContent =
                    referralCount === 0 ? 'Invite your first friend' :
                    referralCount === 1 ? '1 friend in your network' :
                    `${referralCount} friends in your network`;
            }
        }

        // Store code for modal
        currentReferralCode = stats.referralCode;
        console.log('✓ Current referral code set to:', currentReferralCode);

    } catch (error) {
        console.error('❌ Error loading referral stats:', error);
        console.error('Error stack:', error.stack);
        // Re-throw to allow caller to handle
        throw error;
    }
}

// Open share modal
async function openShareReferralModal() {
    const modal = document.getElementById('share-referral-modal');
    if (!modal) {
        console.error('Share referral modal not found');
        return;
    }

    // Show modal with flex display
    modal.style.display = 'flex';

    const codeDisplay = document.getElementById('referral-code-display');
    if (!codeDisplay) {
        console.error('Referral code display element not found');
        return;
    }

    // Show loading state
    codeDisplay.textContent = 'Loading...';
    codeDisplay.style.color = 'var(--text-muted)';

    // Wait for authentication if not ready
    if (!window.currentUser) {
        console.log('Waiting for authentication...');
        let attempts = 0;
        const maxAttempts = 30; // 3 seconds max wait

        while (!window.currentUser && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        if (!window.currentUser) {
            console.error('Authentication timeout - user not available');
            codeDisplay.textContent = 'Please log in first';
            codeDisplay.style.color = '#ef4444';

            setTimeout(() => {
                codeDisplay.textContent = 'Tap to retry';
                codeDisplay.style.cursor = 'pointer';
                codeDisplay.onclick = async () => {
                    codeDisplay.onclick = null;
                    codeDisplay.style.cursor = 'default';
                    codeDisplay.textContent = 'Loading...';
                    codeDisplay.style.color = 'var(--text-muted)';
                    await openShareReferralModal();
                };
            }, 2000);
            return;
        }
    }

    // If we don't have a referral code yet, try to load it
    if (!currentReferralCode) {
        try {
            console.log('Loading referral stats...');
            await loadReferralStats();
        } catch (error) {
            console.error('Failed to load referral stats:', error);
            codeDisplay.textContent = 'Failed to load code';
            codeDisplay.style.color = '#ef4444';

            // Show user-friendly error message with details
            const errorMsg = error.message || 'Unknown error';
            console.error('Error details:', errorMsg);

            setTimeout(() => {
                codeDisplay.textContent = 'Tap to retry';
                codeDisplay.style.cursor = 'pointer';
                codeDisplay.onclick = async () => {
                    codeDisplay.onclick = null;
                    codeDisplay.style.cursor = 'default';
                    codeDisplay.textContent = 'Loading...';
                    codeDisplay.style.color = 'var(--text-muted)';
                    await openShareReferralModal();
                };
            }, 2000);
            return;
        }
    }

    // Load and display referral code
    if (currentReferralCode) {
        codeDisplay.textContent = currentReferralCode;
        codeDisplay.style.color = 'var(--primary)';
        codeDisplay.style.cursor = 'default';
        codeDisplay.onclick = null;
        console.log('✓ Referral code displayed:', currentReferralCode);
    } else {
        // Fallback if still no code after successful load
        console.error('No referral code available after loading');
        codeDisplay.textContent = 'Tap to retry';
        codeDisplay.style.color = '#ef4444';
        codeDisplay.style.cursor = 'pointer';
        codeDisplay.onclick = async () => {
            codeDisplay.onclick = null;
            codeDisplay.style.cursor = 'default';
            codeDisplay.textContent = 'Loading...';
            codeDisplay.style.color = 'var(--text-muted)';
            await openShareReferralModal();
        };
    }
}

// Close share modal
function closeShareReferralModal() {
    const modal = document.getElementById('share-referral-modal');
    if (modal) modal.style.display = 'none';
}

// Copy referral code
function copyReferralCode() {
    const codeDisplay = document.getElementById('referral-code-display');
    const code = codeDisplay.textContent;

    navigator.clipboard.writeText(code).then(() => {
        // Show feedback
        const originalText = codeDisplay.textContent;
        codeDisplay.textContent = 'Copied!';
        codeDisplay.style.color = '#22c55e';

        setTimeout(() => {
            codeDisplay.textContent = originalText;
            codeDisplay.style.color = 'var(--primary)';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy code. Please copy manually.');
    });
}

// Get the appropriate app store link based on sender's platform
function getAppStoreLink() {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
        return 'https://play.google.com/store/apps/details?id=com.fitgotchi.app';
    }
    // iOS or unknown — default to App Store
    return 'https://apps.apple.com/us/app/balance-fitness-gamified/id6761238161';
}

// Share via WhatsApp
function shareViaWhatsApp() {
    const code = currentReferralCode;
    const appLink = getAppStoreLink();
    const message = `Hey! Join me on Balance by FITGotchi - gamify your fitness journey! We BOTH get 1 week of double XP when you sign up! 🎮💪\n\nDownload here: ${appLink}\n\nUse my referral code when you sign up: ${code}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

// Share via Facebook
function shareViaFacebook() {
    const code = currentReferralCode;
    const appLink = getAppStoreLink();
    const message = `Hey! Join me on Balance by FITGotchi - gamify your fitness journey! We BOTH get 1 week of double XP when you sign up! Use my referral code: ${code}`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // Try Messenger app on mobile
        window.location.href = `fb-messenger://share?link=${encodeURIComponent(appLink)}&app_id=`;
    } else {
        // Use standard Facebook Sharer on desktop
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(appLink)}&quote=${encodeURIComponent(message)}`;
        window.open(fbUrl, '_blank', 'width=600,height=400');
    }
}

// Share via SMS
function shareViaSMS() {
    const code = currentReferralCode;
    const appLink = getAppStoreLink();
    const message = `Hey! Join me on Balance by FITGotchi - gamify your fitness! We BOTH get 1 week of double XP 🎮💪\n\nDownload: ${appLink}\n\nUse code ${code} when signing up!`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        const smsUrl = `sms:?&body=${encodeURIComponent(message)}`;
        window.location.href = smsUrl;
    } else {
        // Desktop fallback - copy to clipboard and notify
        navigator.clipboard.writeText(message).then(() => {
            showToast('Message copied to clipboard! Paste it into your SMS app.', 'info');
        });
    }
}

// ============================================================
// FRIENDS SYSTEM
// ============================================================

let friendSearchTimeout = null;

// Open Add Friend Modal
function openAddFriendModal() {
    const modal = document.getElementById('add-friend-modal');
    if (modal) {
        modal.style.display = 'flex';
        showFriendTab('search');
        loadPendingFriendRequests();
        loadFriendsList();
    }
}

// Close Add Friend Modal
function closeAddFriendModal() {
    const modal = document.getElementById('add-friend-modal');
    if (modal) modal.style.display = 'none';
}

// Show friend tab
function showFriendTab(tab) {
    // Update tab buttons
    const tabs = ['search', 'requests', 'friends'];
    tabs.forEach(t => {
        const btn = document.getElementById(`friend-tab-${t}`);
        const content = document.getElementById(t === 'search' ? 'friend-search-content' :
                                                  t === 'requests' ? 'friend-requests-content' :
                                                  'friend-list-content');
        if (btn) {
            btn.style.background = t === tab ? 'white' : 'transparent';
            btn.style.color = t === tab ? 'var(--primary)' : '#64748b';
        }
        if (content) {
            content.style.display = t === tab ? 'block' : 'none';
        }
    });
}

// Debounced search
function debouncedFriendSearch() {
    clearTimeout(friendSearchTimeout);
    friendSearchTimeout = setTimeout(() => {
        searchForFriends();
    }, 300);
}

// Search for friends
async function searchForFriends() {
    const input = document.getElementById('friend-search-input');
    const resultsContainer = document.getElementById('friend-search-results');
    const query = input.value.trim();

    if (query.length < 2) {
        resultsContainer.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:#94a3b8;">
                <svg viewBox="0 0 24 24" style="width:48px; height:48px; fill:#cbd5e1; margin-bottom:12px;">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
                <p style="margin:0; font-size:0.95rem;">Enter at least 2 characters to search</p>
            </div>
        `;
        return;
    }

    resultsContainer.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:#94a3b8;">
            <div style="width:32px; height:32px; border:3px solid #e2e8f0; border-top-color:var(--primary); border-radius:50%; animation:spin 1s linear infinite; margin:0 auto 12px;"></div>
            <p style="margin:0; font-size:0.95rem;">Searching...</p>
        </div>
    `;

    try {
        const results = await window.dbHelpers.friends.searchUsers(query, window.currentUser.id);

        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:#94a3b8;">
                    <svg viewBox="0 0 24 24" style="width:48px; height:48px; fill:#cbd5e1; margin-bottom:12px;">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    <p style="margin:0; font-size:0.95rem;">No users found matching "${query}"</p>
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = results.map(user => {
            const initials = (user.user_name || user.user_email || '?').charAt(0).toUpperCase();
            const statusButton = getStatusButton(user.user_id, user.friendship_status);

            return `
                <div style="display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px; background:#f8fafc; margin-bottom:10px;">
                    <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, var(--primary), #10b981); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:1.2rem; flex-shrink:0;">
                        ${user.user_photo ? `<img src="${user.user_photo}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : initials}
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user.user_name || 'Unknown User'}</div>
                        <div style="font-size:0.85rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user.user_email}</div>
                    </div>
                    ${statusButton}
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error searching for friends:', error);
        resultsContainer.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:#ef4444;">
                <p style="margin:0; font-size:0.95rem;">Error searching. Please try again.</p>
            </div>
        `;
    }
}

// Get status button HTML
function getStatusButton(userId, status) {
    switch(status) {
        case 'accepted':
            return `<div style="padding:8px 16px; background:#f0fdf4; color:#22c55e; border-radius:8px; font-weight:600; font-size:0.85rem;">Friends</div>`;
        case 'pending':
            return `<div style="padding:8px 16px; background:#fef3c7; color:#f59e0b; border-radius:8px; font-weight:600; font-size:0.85rem;">Pending</div>`;
        default:
            return `<button onclick="sendFriendRequest('${userId}')" style="padding:8px 16px; background:var(--primary); color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.85rem; transition:all 0.2s;">Add</button>`;
    }
}

// Send friend request
async function sendFriendRequest(friendId) {
    try {
        await window.dbHelpers.friends.sendRequest(window.currentUser.id, friendId);

        // Show success feedback
        showToast('Friend request sent!', 'success');

        // Refresh search results
        searchForFriends();
    } catch (error) {
        console.error('Error sending friend request:', error);
        if (error.message.includes('duplicate')) {
            showToast('Friend request already sent', 'warning');
        } else {
            showToast('Failed to send request. Please try again.', 'error');
        }
    }
}

// Load pending friend requests
async function loadPendingFriendRequests() {
    const container = document.getElementById('friend-requests-list');
    const badge = document.getElementById('friend-request-badge');

    try {
        const requests = await window.dbHelpers.friends.getPendingRequests(window.currentUser.id);

        // Update badge
        if (badge) {
            if (requests.length > 0) {
                badge.style.display = 'inline';
                badge.textContent = requests.length;
            } else {
                badge.style.display = 'none';
            }
        }

        if (requests.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:#94a3b8;">
                    <svg viewBox="0 0 24 24" style="width:48px; height:48px; fill:#cbd5e1; margin-bottom:12px;">
                        <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    <p style="margin:0; font-size:0.95rem;">No pending friend requests</p>
                </div>
            `;
            return;
        }

        container.innerHTML = requests.map(request => {
            const initials = (request.sender_name || request.sender_email || '?').charAt(0).toUpperCase();
            return `
                <div style="display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px; background:#f8fafc; margin-bottom:10px;">
                    <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, var(--primary), #10b981); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:1.2rem; flex-shrink:0;">
                        ${request.sender_photo ? `<img src="${request.sender_photo}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : initials}
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${request.sender_name || 'Unknown User'}</div>
                        <div style="font-size:0.85rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${request.sender_email}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="acceptFriendRequest('${request.request_id}')" style="padding:8px 14px; background:#22c55e; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.85rem; transition:all 0.2s;">Accept</button>
                        <button onclick="declineFriendRequest('${request.request_id}')" style="padding:8px 14px; background:#f1f5f9; color:#64748b; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.85rem; transition:all 0.2s;">Decline</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading friend requests:', error);
        container.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:#ef4444;">
                <p style="margin:0; font-size:0.95rem;">Error loading requests. Please try again.</p>
            </div>
        `;
    }
}

// Accept friend request
async function acceptFriendRequest(requestId) {
    try {
        await window.dbHelpers.friends.acceptRequest(requestId);
        showToast('Friend request accepted!', 'success');
        loadPendingFriendRequests();
        loadFriendsList();
        updateFriendsCount();
    } catch (error) {
        console.error('Error accepting friend request:', error);
        showToast('Failed to accept request. Please try again.', 'error');
    }
}

// Decline friend request
async function declineFriendRequest(requestId) {
    try {
        await window.dbHelpers.friends.declineRequest(requestId);
        showToast('Friend request declined', 'info');
        loadPendingFriendRequests();
    } catch (error) {
        console.error('Error declining friend request:', error);
        showToast('Failed to decline request. Please try again.', 'error');
    }
}

// Load friends list
async function loadFriendsList() {
    const container = document.getElementById('friends-list');

    try {
        const friends = await db.friends.getFriendsWithFallback(window.currentUser.id);

        if (friends.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:#94a3b8;">
                    <svg viewBox="0 0 24 24" style="width:48px; height:48px; fill:#cbd5e1; margin-bottom:12px;">
                        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                    </svg>
                    <p style="margin:0; font-size:0.95rem;">No friends yet. Start by adding some!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = friends.map(friend => {
            const initials = (friend.friend_name || friend.friend_email || '?').charAt(0).toUpperCase();
            return `
                <div style="display:flex; align-items:center; gap:12px; padding:12px; border-radius:12px; background:#f8fafc; margin-bottom:10px;">
                    <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, var(--primary), #10b981); display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:1.2rem; flex-shrink:0;">
                        ${friend.friend_photo ? `<img src="${friend.friend_photo}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">` : initials}
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${friend.friend_name || 'Unknown User'}</div>
                        <div style="font-size:0.85rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${friend.friend_email}</div>
                    </div>
                    <button onclick="removeFriend('${friend.friend_id}')" style="padding:8px 14px; background:#fee2e2; color:#ef4444; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:0.85rem; transition:all 0.2s;">Remove</button>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading friends:', error);
        container.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:#ef4444;">
                <p style="margin:0; font-size:0.95rem;">Error loading friends. Please try again.</p>
            </div>
        `;
    }
}

// Remove friend
async function removeFriend(friendId) {
    if (!confirm('Are you sure you want to remove this friend?')) return;

    try {
        await window.dbHelpers.friends.removeFriend(window.currentUser.id, friendId);
        showToast('Friend removed', 'info');
        loadFriendsList();
        updateFriendsCount();
    } catch (error) {
        console.error('Error removing friend:', error);
        showToast('Failed to remove friend. Please try again.', 'error');
    }
}

// Update network count in header (friends + referrals)
async function updateFriendsCount() {
    try {
        const friends = await db.friends.getFriendsWithFallback(window.currentUser.id);
        const referralStats = await window.dbHelpers.referrals.getStats(window.currentUser.id);
        const friendCount = friends.length;
        const referralCount = referralStats.totalReferrals || 0;
        const totalNetwork = friendCount + referralCount;

        const countEl = document.getElementById('referral-network-count');
        if (countEl) {
            countEl.textContent = totalNetwork === 0 ? 'Add your first friend' :
                                  totalNetwork === 1 ? '1 connection in your network' :
                                  `${totalNetwork} connections in your network`;
        }
    } catch (error) {
        console.error('Error updating network count:', error);
    }
}

// ============================================================
// FRIENDS VIEW FUNCTIONS
// ============================================================

// Initialize Friends View
async function initFriendsView() {
    console.log('Initializing Feed View...');

    // Ensure active-games-container exists at the top of the feed
    let container = document.getElementById('active-games-container');
    if (!container) {
        const feedView = document.getElementById('view-feed') || document.querySelector('[id*="feed"]');
        if (feedView) {
            container = document.createElement('div');
            container.id = 'active-games-container';
            container.style.marginBottom = '15px';
            // Insert at the very top of the feed
            feedView.insertBefore(container, feedView.firstChild);
        }
    }

    // Hide dismissed promo cards
    if (localStorage.getItem('referral_banner_dismissed') === 'true') {
        const banner = document.getElementById('friends-referral-banner');
        if (banner) banner.style.display = 'none';
    }
    if (localStorage.getItem('feed_incentive_dismissed') === 'true') {
        const incentive = document.getElementById('feed-post-incentive');
        if (incentive) incentive.style.display = 'none';
    }
    // Load active games
    if (typeof loadActiveGames === 'function') {
        loadActiveGames();
    }
    // Check for pending game invites and show notifications
    if (typeof window.checkGameInvitesOnLoad === 'function') {
        window.checkGameInvitesOnLoad();
    }
    // Load photo feed on feed page
    if (typeof loadPhotoFeed === 'function') {
        loadPhotoFeed('friends-photo-feed', 'friends-feed-empty');
    }
    // Load group chats and friends in background (for messages panel)
    await loadGroupChats();
    await loadFriendsCards();
}

// Load friend cards for the Instagram DM-style list
async function loadFriendsCards() {
    const container = document.getElementById('friends-cards-list');
    const countLabel = document.getElementById('friends-count-label');

    if (!container || !window.currentUser) return;

    try {
        // Use get_friends_with_status with fallback for resilience
        let friends = await db.friends.getFriendsWithFallback(window.currentUser.id);

        // Pin Coach Shannon to the top of the friends list
        const coachId = window._coachUserId || await getCoachUserId();
        if (coachId) {
            friends.sort((a, b) => {
                if (a.friend_id === coachId) return -1;
                if (b.friend_id === coachId) return 1;
                return 0;
            });
        }

        // Update count label
        if (countLabel) {
            countLabel.textContent = friends.length === 0 ? '0 friends' :
                                     friends.length === 1 ? '1 friend' :
                                     `${friends.length} friends`;
        }

        if (friends.length === 0) {
            container.innerHTML = `
                <div style="padding: 30px 20px; text-align: center; background: #f8fafc;">
                    <div style="font-size: 2rem; margin-bottom: 8px;">👋</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">Add friends to see them here!</div>
                    <button onclick="openAddFriendModal()" style="margin-top: 12px; background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
                        Find Friends
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = friends.map((friend, index) => {
            const initials = (friend.friend_name || '?').charAt(0).toUpperCase();
            const hasActivity = friend.has_workout_today || friend.has_meal_today;
            const streakDisplay = friend.current_streak > 0 ? `🔥 ${friend.current_streak}` : '';
            const isLastItem = index === friends.length - 1;

            // Build status text based on activity
            let statusText = '';
            let statusColor = 'var(--text-muted)';

            if (friend.has_personal_best) {
                statusText = '🏆 New personal best!';
                statusColor = '#d97706';
            } else if (hasActivity) {
                statusText = 'Active today';
                statusColor = '#22c55e';
            } else if (friend.days_inactive > 0) {
                statusText = friend.days_inactive === 1 ? 'Not logged in yesterday' :
                             friend.days_inactive < 7 ? `Inactive ${friend.days_inactive} days` :
                             'Inactive 7+ days';
                statusColor = friend.days_inactive >= 3 ? '#ef4444' : 'var(--text-muted)';
            } else {
                statusText = 'No activity yet';
            }

            return `
                <div style="display: flex; align-items: center; padding: 12px 16px; cursor: pointer; background: white; ${!isLastItem ? 'border-bottom: 1px solid #f1f5f9;' : ''}" onclick="viewUserProfile('${friend.friend_id}', '${(friend.friend_name || '').replace(/'/g, "\\'")}', '${(friend.friend_photo || '').replace(/'/g, "\\'")}')">
                    <div style="position: relative; margin-right: 12px;">
                        <div style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #10b981); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.3rem; overflow: hidden;">
                            ${friend.friend_photo ? `<img src="${friend.friend_photo}" style="width: 100%; height: 100%; object-fit: cover;">` : initials}
                        </div>
                        ${hasActivity ? '<div style="position: absolute; bottom: 2px; right: 2px; width: 14px; height: 14px; background: #22c55e; border-radius: 50%; border: 2px solid white;"></div>' : ''}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                            <span style="font-weight: 600; color: var(--text-main); font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${friend.friend_name || 'Friend'}</span>
                            ${streakDisplay ? `<span style="font-size: 0.75rem; color: #f97316;">${streakDisplay}</span>` : ''}
                        </div>
                        <div style="font-size: 0.8rem; color: ${statusColor}; display: flex; align-items: center; gap: 6px;">
                            ${statusText}
                        </div>
                        <div style="display: flex; gap: 6px; margin-top: 4px;">
                            ${friend.has_workout_today ? '<span style="background: #dcfce7; color: #16a34a; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 500;">💪 Workout</span>' : ''}
                            ${friend.has_meal_today ? '<span style="background: #fef3c7; color: #d97706; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 500;">🥗 Logged</span>' : ''}
                            ${friend.total_calories_today > 0 ? `<span style="background: #f0fdf4; color: #059669; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 500;">🔥 ${friend.total_calories_today} cal</span>` : ''}
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;" onclick="event.stopPropagation();">
                        ${!hasActivity && friend.can_nudge ? `
                            <button onclick="event.stopPropagation(); sendNudgeToFriend('${friend.friend_id}', '${friend.friend_name}')" style="width: 36px; height: 36px; background: #fef2f2; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Send nudge">
                                <span style="font-size: 1rem;">👋</span>
                            </button>
                        ` : ''}
                        <button onclick="event.stopPropagation(); openDirectMessage('${friend.friend_id}', '${friend.friend_name}', '${friend.friend_photo || ''}')" style="width: 36px; height: 36px; background: #f1f5f9; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="Message">
                            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: var(--text-muted);"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading friend cards:', error);
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; background: #fef2f2;">
                <div style="color: #ef4444; font-size: 0.85rem;">Failed to load friends</div>
                <button onclick="loadFriendsCards()" style="margin-top: 10px; padding: 6px 12px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">Retry</button>
            </div>
        `;
    }
}

// Load activity feed
async function loadActivityFeed(filter = 'all') {
    const container = document.getElementById('activity-feed-container');

    if (!container || !window.currentUser) return;

    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="loading-spinner" style="width: 30px; height: 30px; border: 3px solid #f1f5f9; border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <div style="margin-top: 10px; color: var(--text-muted); font-size: 0.85rem;">Loading activity...</div>
        </div>
    `;

    try {
        // Call the activity feed RPC function
        const { data: activities, error } = await window.supabaseClient
            .rpc('get_friend_activity_feed', { user_uuid: window.currentUser.id, days_back: 7 });

        if (error) throw error;

        // Filter if needed
        let filteredActivities = activities || [];
        if (filter !== 'all') {
            const typeMap = {
                'workouts': 'workout',
                'meals': 'meal',
                'stories': 'story',
                'achievements': 'achievement',
                'rewards': ['free_week', 'referral_reward']
            };
            const filterTypes = typeMap[filter];
            if (Array.isArray(filterTypes)) {
                filteredActivities = filteredActivities.filter(a => filterTypes.includes(a.activity_type));
            } else {
                filteredActivities = filteredActivities.filter(a => a.activity_type === filterTypes);
            }
        }

        if (filteredActivities.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <div style="font-size: 3rem; margin-bottom: 10px;">👥</div>
                    <div style="font-size: 0.95rem; margin-bottom: 5px;">No activity yet</div>
                    <div style="font-size: 0.8rem;">Add friends to see what they're up to!</div>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredActivities.map(activity => {
            const initials = (activity.user_name || '?').charAt(0).toUpperCase();
            const timeAgo = getTimeAgo(new Date(activity.activity_time));

            // Different icons/colors based on activity type
            const typeConfig = {
                workout: { icon: '💪', bg: '#dcfce7', color: '#16a34a', label: 'completed' },
                meal: { icon: '🥗', bg: '#fef3c7', color: '#d97706', label: 'logged' },
                story: { icon: '📸', bg: '#e0e7ff', color: '#6366f1', label: 'shared' },
                achievement: { icon: '🏆', bg: '#fef2f2', color: '#ef4444', label: 'earned' },
                free_week: { icon: '🎉', bg: '#f0fdf4', color: '#22c55e', label: 'unlocked' },
                referral_reward: { icon: '🎁', bg: '#fdf4ff', color: '#c026d3', label: 'received' }
            };
            const config = typeConfig[activity.activity_type] || typeConfig.workout;

            return `
                <div style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #f1f5f9;">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <div onclick="viewUserProfile('${activity.user_id}', '${(activity.user_name || '').replace(/'/g, "\\'")}', '${(activity.user_photo || '').replace(/'/g, "\\'")}')" style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #10b981); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; flex-shrink: 0; overflow: hidden; cursor: pointer;">
                            ${activity.user_photo ? `<img src="${activity.user_photo}" style="width: 100%; height: 100%; object-fit: cover;">` : initials}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                                <div>
                                    <span onclick="viewUserProfile('${activity.user_id}', '${(activity.user_name || '').replace(/'/g, "\\'")}', '${(activity.user_photo || '').replace(/'/g, "\\'")}')" style="font-weight: 600; color: var(--text-main); cursor: pointer;">${activity.user_name}</span>
                                    <span style="color: var(--text-muted);"> ${config.label} </span>
                                    <span style="font-weight: 500; color: var(--text-main);">${activity.activity_title}</span>
                                </div>
                                <span style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap;">${timeAgo}</span>
                            </div>
                            ${activity.activity_details ? `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">${activity.activity_details}</div>` : ''}
                            <div style="margin-top: 10px; display: flex; gap: 8px;">
                                <button onclick="openDirectMessage('${activity.user_id}', '${activity.user_name}', '${activity.user_photo || ''}')" style="display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: #f1f5f9; border: none; border-radius: 8px; cursor: pointer; font-size: 0.8rem; color: var(--text-muted);">
                                    💬 Message
                                </button>
                                <button onclick="sendCheers('${activity.user_id}', '${activity.activity_type}')" style="display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: ${config.bg}; border: none; border-radius: 8px; cursor: pointer; font-size: 0.8rem; color: ${config.color};">
                                    ${config.icon} Cheers!
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading activity feed:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #ef4444;">
                <div style="font-size: 0.95rem;">Failed to load activity feed</div>
                <button onclick="loadActivityFeed()" style="margin-top: 10px; padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">Retry</button>
            </div>
        `;
    }
}

// Filter activity feed
function filterActivityFeed(filter) {
    loadActivityFeed(filter);
}

// ============================================================
// GROUP CHAT FUNCTIONS
// ============================================================

let currentGroupChatId = null;
let selectedWinType = 'workout_complete';
let selectedGroupMembers = [];

// Helper to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load group chats list
async function loadGroupChats() {
    const container = document.getElementById('group-chats-container');

    if (!container || !window.currentUser) return;

    // Show loading
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="loading-spinner" style="width: 30px; height: 30px; border: 3px solid #f1f5f9; border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <div style="margin-top: 10px; color: var(--text-muted); font-size: 0.85rem;">Loading chats...</div>
        </div>
    `;

    try {
        const { data: chats, error } = await window.supabaseClient
            .rpc('get_user_group_chats', { user_uuid: window.currentUser.id });

        if (error) throw error;

        if (!chats || chats.length === 0) {
            container.innerHTML = `
                <div id="group-chats-empty" style="text-align: center; padding: 30px 20px; background: white; border-radius: 12px; border: 1px solid #f1f5f9;">
                    <div style="font-size: 2.5rem; margin-bottom: 10px;">💬</div>
                    <div style="font-size: 0.95rem; color: var(--text-main); font-weight: 600; margin-bottom: 5px;">No group chats yet</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 15px;">Start a group chat to share wins with friends!</div>
                    <button onclick="openCreateGroupChatModal()" style="background: linear-gradient(135deg, var(--primary), #10b981); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 0.9rem; font-weight: 600; cursor: pointer;">
                        Create Your First Group
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = chats.map(chat => {
            const timeAgo = chat.last_message_at ? getTimeAgo(new Date(chat.last_message_at)) : '';
            const preview = chat.last_message ? (chat.last_message.length > 40 ? chat.last_message.substring(0, 40) + '...' : chat.last_message) : 'No messages yet';

            return `
                <div onclick="openGroupChat('${chat.chat_id}', '${escapeHtml(chat.chat_name)}', '${escapeHtml(chat.member_names || '')}')" style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #f1f5f9; cursor: pointer; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.01)'" onmouseout="this.style.transform='scale(1)'">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 50px; height: 50px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #10b981); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.3rem; flex-shrink: 0;">
                            💬
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(chat.chat_name)}</div>
                                ${timeAgo ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${timeAgo}</div>` : ''}
                            </div>
                            <div style="font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${chat.last_message_by ? `<span style="font-weight: 500;">${escapeHtml(chat.last_message_by)}:</span> ` : ''}${escapeHtml(preview)}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                                ${chat.member_count} member${chat.member_count > 1 ? 's' : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading group chats:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #ef4444;">
                <div style="font-size: 0.95rem;">Failed to load group chats</div>
                <button onclick="loadGroupChats()" style="margin-top: 10px; padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">Retry</button>
            </div>
        `;
    }
}

// Open group chat modal
async function openGroupChat(chatId, chatName, memberNames) {
    currentGroupChatId = chatId;
    document.getElementById('gc-chat-name').textContent = chatName;
    document.getElementById('gc-chat-members').textContent = memberNames || 'Loading...';
    document.getElementById('group-chat-modal').style.display = 'flex';
    document.getElementById('gc-message-input').value = '';

    await loadGroupChatMessages(chatId);
}

// Close group chat modal
function closeGroupChatModal() {
    document.getElementById('group-chat-modal').style.display = 'none';
    currentGroupChatId = null;
}

// Load messages for a group chat
async function loadGroupChatMessages(chatId) {
    const container = document.getElementById('gc-messages-container');
    container.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="loading-spinner" style="width: 24px; height: 24px; border: 2px solid #f1f5f9; border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
        </div>
    `;

    try {
        const { data: messages, error } = await window.supabaseClient
            .rpc('get_group_chat_messages', { chat_uuid: chatId, messages_limit: 100 });

        if (error) throw error;

        if (!messages || messages.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <div style="font-size: 2rem; margin-bottom: 10px;">💬</div>
                    <div style="font-size: 0.9rem;">No messages yet. Start the conversation!</div>
                </div>
            `;
            return;
        }

        container.innerHTML = messages.map(msg => {
            const isOwn = msg.sender_id === window.currentUser.id;
            const initials = (msg.sender_name || '?').charAt(0).toUpperCase();
            const time = new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

            // Win share message
            if (msg.is_win_share) {
                const winDetails = msg.win_details || {};
                const typeConfig = {
                    'workout_complete': { icon: '💪', bg: 'linear-gradient(135deg, #dcfce7, #f0fdf4)', border: '#86efac', label: 'Workout Complete' },
                    'entire_workout': { icon: '📋', bg: 'linear-gradient(135deg, #dcfce7, #f0fdf4)', border: '#86efac', label: 'Full Workout' },
                    'exercise_all_sets': { icon: '📊', bg: 'linear-gradient(135deg, #dbeafe, #eff6ff)', border: '#93c5fd', label: 'Exercise' },
                    'specific_lift': { icon: '💪', bg: 'linear-gradient(135deg, #dcfce7, #f0fdf4)', border: '#86efac', label: 'Lift' },
                    'multi_sets': { icon: '🏋️', bg: 'linear-gradient(135deg, #dbeafe, #eff6ff)', border: '#93c5fd', label: 'Sets' },
                    'personal_best': { icon: '🏆', bg: 'linear-gradient(135deg, #fef3c7, #fffbeb)', border: '#fcd34d', label: 'Personal Best' },
                    'milestone': { icon: '🌟', bg: 'linear-gradient(135deg, #e0e7ff, #eef2ff)', border: '#a5b4fc', label: 'Milestone' },
                    'custom': { icon: '✨', bg: 'linear-gradient(135deg, #fdf4ff, #faf5ff)', border: '#d8b4fe', label: 'Win' }
                };
                const config = typeConfig[msg.win_type] || typeConfig.custom;

                // Build rich details HTML based on win type
                let detailsHtml = '';

                if (msg.win_type === 'entire_workout' && winDetails.exercises) {
                    // Full workout card: show exercise list with sets
                    const exerciseEntries = typeof winDetails.exercises === 'object' ? Object.entries(winDetails.exercises) : [];
                    if (exerciseEntries.length > 0) {
                        const exerciseRows = exerciseEntries.slice(0, 6).map(([name, sets]) => {
                            const setsArr = Array.isArray(sets) ? sets : [];
                            const setsInfo = setsArr.map(s => {
                                const w = s.kg || s.weight_kg || s.weight || 0;
                                const r = s.reps || 0;
                                return `${w}kg×${r}`;
                            }).join(', ');
                            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
                                <span style="font-weight:600; font-size:0.85rem; color:var(--text-main);">${escapeHtml(name)}</span>
                                <span style="font-size:0.8rem; color:var(--text-muted); font-weight:500;">${setsInfo}</span>
                            </div>`;
                        }).join('');
                        const remaining = exerciseEntries.length - 6;
                        detailsHtml = `<div style="margin-top:10px;">${exerciseRows}${remaining > 0 ? `<div style="font-size:0.8rem; color:var(--text-muted); padding-top:4px;">+${remaining} more</div>` : ''}</div>`;
                    }
                    // Duration / stats row
                    if (winDetails.duration || winDetails.totalSets) {
                        detailsHtml += `<div style="display:flex; gap:12px; margin-top:8px;">
                            ${winDetails.duration ? `<span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">⏱ ${escapeHtml(String(winDetails.duration))}</span>` : ''}
                            ${winDetails.totalSets ? `<span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">${winDetails.totalSets} sets</span>` : ''}
                        </div>`;
                    }
                } else if (msg.win_type === 'exercise_all_sets' && winDetails.sets) {
                    // Exercise card: show all sets in a compact grid
                    const setsArr = Array.isArray(winDetails.sets) ? winDetails.sets : [];
                    if (setsArr.length > 0) {
                        const setRows = setsArr.map((s, i) => {
                            const w = s.weight || s.kg || 0;
                            const r = s.reps || 0;
                            return `<div style="display:flex; align-items:center; gap:8px; padding:5px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
                                <span style="width:24px; height:24px; background:#e2e8f0; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:700; color:var(--text-muted);">${i + 1}</span>
                                <span style="font-size:0.9rem; font-weight:600; color:var(--text-main);">${w}kg × ${r} reps</span>
                            </div>`;
                        }).join('');
                        detailsHtml = `<div style="margin-top:10px;">${setRows}</div>`;
                    }
                } else if ((msg.win_type === 'multi_sets' || msg.win_type === 'specific_lift') && winDetails.exercises) {
                    // Multi-set or specific lift: show selected sets grouped by exercise
                    const exerciseEntries = typeof winDetails.exercises === 'object' ? Object.entries(winDetails.exercises) : [];
                    if (exerciseEntries.length > 0) {
                        const rows = exerciseEntries.map(([name, sets]) => {
                            const setsArr = Array.isArray(sets) ? sets : [];
                            const setsInfo = setsArr.map(s => {
                                const w = s.kg || s.weight_kg || s.weight || 0;
                                const r = s.reps || 0;
                                return `${w}kg×${r}`;
                            }).join(', ');
                            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
                                <span style="font-weight:600; font-size:0.85rem; color:var(--text-main);">${escapeHtml(name)}</span>
                                <span style="font-size:0.8rem; color:var(--text-muted); font-weight:500;">${setsInfo}</span>
                            </div>`;
                        }).join('');
                        detailsHtml = `<div style="margin-top:10px;">${rows}</div>`;
                    }
                } else if (msg.win_type === 'specific_lift' && winDetails.exercise) {
                    // Single lift without exercises object
                    const w = winDetails.weight || 0;
                    const r = winDetails.reps || 0;
                    if (w > 0 || r > 0) {
                        detailsHtml = `<div style="margin-top:10px; background:rgba(0,0,0,0.04); border-radius:10px; padding:12px; text-align:center;">
                            <div style="font-size:1.4rem; font-weight:800; color:var(--text-main);">${w}kg × ${r} reps</div>
                        </div>`;
                    }
                } else if (msg.win_type === 'personal_best') {
                    // PB card: show improvement prominently
                    let pbHtml = '';
                    if (winDetails.currentWeight || winDetails.currentReps) {
                        pbHtml += `<div style="background:rgba(0,0,0,0.04); border-radius:10px; padding:12px; text-align:center; margin-top:10px;">
                            <div style="font-size:1.3rem; font-weight:800; color:var(--text-main);">${winDetails.currentWeight || 0}kg × ${winDetails.currentReps || 0} reps</div>
                            ${winDetails.previousWeight != null ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Previous: ${winDetails.previousWeight}kg × ${winDetails.previousReps || 0} reps</div>` : ''}
                        </div>`;
                    }
                    if (winDetails.improvement) {
                        pbHtml += `<div style="margin-top:8px; text-align:center;"><span style="font-size:0.95rem; font-weight:700; color:#16a34a; background:rgba(22,163,74,0.1); padding:4px 12px; border-radius:20px; display:inline-block;">${escapeHtml(winDetails.improvement)}</span></div>`;
                    }
                    detailsHtml = pbHtml;
                }

                return `
                    <div style="display: flex; flex-direction: column; align-items: ${isOwn ? 'flex-end' : 'flex-start'}; margin-bottom: 15px;">
                        ${!isOwn ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; margin-left: 4px;">${escapeHtml(msg.sender_name)}</div>` : ''}
                        <div id="win-card-${msg.message_id}" style="max-width: 85%; background: ${config.bg}; padding: 16px; border-radius: ${isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; border: 2px solid ${config.border}; position: relative; overflow: hidden;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                <span style="font-size: 1.6rem;">${config.icon}</span>
                                <div>
                                    <div style="font-weight: 700; color: var(--text-main); font-size: 1rem;">${escapeHtml(config.label)}</div>
                                    ${winDetails.workoutName ? `<div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(winDetails.workoutName)}</div>` : ''}
                                </div>
                            </div>
                            <div style="font-size: 0.95rem; color: var(--text-main); line-height: 1.5; font-weight: 500; white-space: pre-line;">${escapeHtml(msg.message)}</div>
                            ${detailsHtml}

                            <!-- Internal logo for share capture -->
                            <div class="share-only" style="display: none; margin-top: 15px; border-top: 1px solid rgba(0,0,0,0.05); padding-top: 10px; font-size: 0.7rem; color: var(--text-muted); font-weight: 600; letter-spacing: 0.5px;">
                                BALANCE
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                            <div style="font-size: 0.7rem; color: #94a3b8;">${time}</div>
                            <button onclick="shareWinCardAsImage('${msg.message_id}')" title="Share card externally" style="background: none; border: none; padding: 4px; cursor: pointer; color: #94a3b8; display: flex; align-items: center; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='#94a3b8'">
                                <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            }

            // Photo message
            const gcPhotoMatch = msg.message && msg.message.match(/^\[PHOTO:(.+)\]$/);
            if (gcPhotoMatch) {
                const photoUrl = gcPhotoMatch[1];
                return `
                    <div style="display: flex; flex-direction: column; align-items: ${isOwn ? 'flex-end' : 'flex-start'}; margin-bottom: 15px;">
                        ${!isOwn ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; margin-left: 4px;">${escapeHtml(msg.sender_name)}</div>` : ''}
                        <img src="${photoUrl}" onclick="window.open('${photoUrl}', '_blank')" style="max-width: 85%; border-radius: ${isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; display: block; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.15);" onerror="this.style.display='none'">
                        <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px;">${time}</div>
                    </div>
                `;
            }

            // Regular message
            return `
                <div style="display: flex; flex-direction: column; align-items: ${isOwn ? 'flex-end' : 'flex-start'}; margin-bottom: 15px;">
                    ${!isOwn ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; margin-left: 4px;">${escapeHtml(msg.sender_name)}</div>` : ''}
                    <div style="max-width: 85%; background: ${isOwn ? 'var(--primary)' : 'white'}; padding: 12px 16px; border-radius: ${isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; ${isOwn ? '' : 'border: 1px solid #e2e8f0;'} color: ${isOwn ? 'white' : 'var(--text-main)'};">
                        ${escapeHtml(msg.message)}
                    </div>
                    <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px;">${time}</div>
                </div>
            `;
        }).join('');

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;

    } catch (error) {
        console.error('Error loading messages:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <div style="font-size: 0.9rem;">Failed to load messages</div>
            </div>
        `;
    }
}

// Send message to group chat
async function sendGroupChatMessage() {
    const input = document.getElementById('gc-message-input');
    const message = input.value.trim();

    if (!message || !currentGroupChatId) return;

    input.value = '';

    try {
        const { error } = await window.supabaseClient
            .from('group_chat_messages')
            .insert({
                group_chat_id: currentGroupChatId,
                user_id: window.currentUser.id,
                message: message
            });

        if (error) throw error;

        await loadGroupChatMessages(currentGroupChatId);

    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
        input.value = message;
    }
}

// Open create group chat modal
async function openCreateGroupChatModal() {
    document.getElementById('create-group-chat-modal').style.display = 'flex';
    document.getElementById('new-group-name').value = '';
    selectedGroupMembers = [];
    document.getElementById('group-selected-count').textContent = '0';

    // Load friends list
    const container = document.getElementById('group-friends-list');
    container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading friends...</div>`;

    try {
        const friends = await db.friends.getFriendsWithFallback(window.currentUser.id);

        if (!friends || friends.length === 0) {
            container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">No friends yet. Add friends first!</div>`;
            return;
        }

        container.innerHTML = friends.map(friend => {
            const initials = (friend.friend_name || '?').charAt(0).toUpperCase();
            return `
                <div onclick="toggleGroupMember('${friend.friend_id}', this)" style="display: flex; align-items: center; gap: 12px; padding: 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" data-friend-id="${friend.friend_id}">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #10b981); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; overflow: hidden; flex-shrink: 0;">
                        ${friend.friend_photo ? `<img src="${friend.friend_photo}" style="width: 100%; height: 100%; object-fit: cover;">` : initials}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(friend.friend_name || 'Friend')}</div>
                    </div>
                    <div class="friend-check" style="width: 24px; height: 24px; border-radius: 50%; border: 2px solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading friends:', error);
        container.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444;">Failed to load friends</div>`;
    }
}

// Close create group chat modal
function closeCreateGroupChatModal() {
    document.getElementById('create-group-chat-modal').style.display = 'none';
}

// Toggle member selection
function toggleGroupMember(friendId, element) {
    const checkDiv = element.querySelector('.friend-check');
    const index = selectedGroupMembers.indexOf(friendId);

    if (index > -1) {
        selectedGroupMembers.splice(index, 1);
        element.style.background = 'white';
        checkDiv.innerHTML = '';
        checkDiv.style.border = '2px solid #e2e8f0';
    } else {
        selectedGroupMembers.push(friendId);
        element.style.background = '#dcfce7';
        checkDiv.innerHTML = '✓';
        checkDiv.style.border = '2px solid var(--primary)';
        checkDiv.style.color = 'var(--primary)';
        checkDiv.style.fontWeight = '700';
    }

    document.getElementById('group-selected-count').textContent = selectedGroupMembers.length;
}

// Create group chat
async function createGroupChat() {
    const name = document.getElementById('new-group-name').value.trim();

    if (!name) {
        showToast('Please enter a group name', 'error');
        return;
    }

    if (selectedGroupMembers.length === 0) {
        showToast('Please select at least one friend', 'error');
        return;
    }

    const btn = document.getElementById('create-group-btn');
    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        const { data: chatId, error } = await window.supabaseClient
            .rpc('create_group_chat', {
                creator_uuid: window.currentUser.id,
                chat_name: name,
                member_ids: selectedGroupMembers
            });

        if (error) throw error;

        showToast('Group chat created! 🎉', 'success');
        closeCreateGroupChatModal();
        await loadGroupChats();

        // Open the new chat
        if (chatId) {
            openGroupChat(chatId, name, '');
        }

    } catch (error) {
        console.error('Error creating group chat:', error);
        showToast('Failed to create group chat', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Group';
    }
}

// Open share win modal (from within group chat)
function openShareWinInChat() {
    if (!currentGroupChatId) {
        showToast('Please open a group chat first', 'error');
        return;
    }
    // Check for pending win share data from workout completion
    if (window.pendingWinShare) {
        openShareWinModal(window.pendingWinShare);
        window.pendingWinShare = null;
    } else {
        openShareWinModal();
    }
}

// Open share win modal
function openShareWinModal(prefillData = null) {
    document.getElementById('share-win-modal').style.display = 'flex';

    // Reset form
    selectedWinType = 'workout_complete';
    document.getElementById('win-message-input').value = '';
    document.getElementById('win-workout-name').value = '';
    document.getElementById('win-improvement').value = '';

    // Reset type buttons
    document.querySelectorAll('.win-type-btn').forEach(btn => {
        btn.style.border = '2px solid transparent';
        btn.style.background = '#f1f5f9';
    });
    document.getElementById('win-type-workout').style.border = '2px solid var(--primary)';
    document.getElementById('win-type-workout').style.background = '#dcfce7';

    // Prefill data if provided
    if (prefillData) {
        selectedWinType = prefillData.type || 'workout_complete';
        selectWinType(selectedWinType);

        if (prefillData.workoutName) {
            document.getElementById('win-workout-name').value = prefillData.workoutName;
        }
        if (prefillData.message) {
            document.getElementById('win-message-input').value = prefillData.message;
        }
        if (prefillData.improvement) {
            document.getElementById('win-improvement').value = prefillData.improvement;
        }
    }
}

// Close share win modal
function closeShareWinModal() {
    document.getElementById('share-win-modal').style.display = 'none';
}

// Select win type
function selectWinType(type) {
    selectedWinType = type;

    document.querySelectorAll('.win-type-btn').forEach(btn => {
        btn.style.border = '2px solid transparent';
        btn.style.background = '#f1f5f9';
    });

    const buttonMap = {
        'workout_complete': 'win-type-workout',
        'personal_best': 'win-type-pb',
        'milestone': 'win-type-milestone',
        'custom': 'win-type-custom'
    };

    const selectedBtn = document.getElementById(buttonMap[type]);
    if (selectedBtn) {
        selectedBtn.style.border = '2px solid var(--primary)';
        selectedBtn.style.background = '#dcfce7';
    }
}

// Set quick message
function setWinMessage(message) {
    document.getElementById('win-message-input').value = message;
}

// Send win to chat
async function sendWinToChat() {
    const message = document.getElementById('win-message-input').value.trim();

    if (!message) {
        showToast('Please enter a message', 'error');
        return;
    }

    if (!currentGroupChatId) {
        showToast('Please open a group chat first', 'error');
        closeShareWinModal();
        return;
    }

    const submitBtn = document.getElementById('submit-win-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner" style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite;"></span>';

    try {
        const winDetails = {
            workoutName: document.getElementById('win-workout-name').value.trim() || null,
            improvement: document.getElementById('win-improvement').value.trim() || null
        };

        const { error } = await window.supabaseClient
            .from('group_chat_messages')
            .insert({
                group_chat_id: currentGroupChatId,
                user_id: window.currentUser.id,
                message: message,
                is_win_share: true,
                win_type: selectedWinType,
                win_details: winDetails
            });

        if (error) throw error;

        showToast('Win shared! 🎉', 'success');
        closeShareWinModal();
        await loadGroupChatMessages(currentGroupChatId);

    } catch (error) {
        console.error('Error sharing win:', error);
        showToast('Failed to share win', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Share to Group</span><span style="font-size: 1.1rem;">🎉</span>';
    }
}

// Share win externally (from modal)
async function shareWinExternally() {
    const message = document.getElementById('win-message-input').value.trim();
    if (!message) {
        showToast('Please enter a message first', 'error');
        return;
    }

    const shareBtn = document.getElementById('external-win-share-btn');
    const originalContent = shareBtn.innerHTML;
    shareBtn.disabled = true;
    shareBtn.innerHTML = '<div class="loading-spinner" style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>';

    try {
        const winDetails = {
            workoutName: document.getElementById('win-workout-name').value.trim() || null,
            improvement: document.getElementById('win-improvement').value.trim() || null
        };

        const configMap = {
            'workout_complete': { icon: '💪', bg: '#dcfce7' },
            'personal_best': { icon: '🏆', bg: '#fef3c7' },
            'milestone': { icon: '🌟', bg: '#e0e7ff' },
            'custom': { icon: '✨', bg: '#fdf4ff' }
        };
        const config = configMap[selectedWinType] || configMap.custom;

        // Create a temporary element for the card capture
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'fixed';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        tempDiv.innerHTML = `
            <div id="temp-share-card" style="width: 320px; background: ${config.bg}; padding: 24px; border-radius: 20px; border: 2px solid var(--primary); font-family: 'Inter', sans-serif;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 15px;">
                    <span style="font-size: 2rem;">${config.icon}</span>
                    <span style="font-weight: 800; color: #1a202c; font-size: 1.2rem; letter-spacing: -0.5px;">Shared a win!</span>
                </div>
                <div style="font-size: 1.1rem; color: #2d3748; line-height: 1.6; font-weight: 500; margin-bottom: 12px;">${escapeHtml(message)}</div>
                ${winDetails.workoutName ? `<div style="font-size: 0.9rem; color: #718096; margin-bottom: 8px;">${escapeHtml(winDetails.workoutName)}</div>` : ''}
                ${winDetails.improvement ? `<div style="font-size: 1rem; font-weight: 800; color: #16a34a; background: rgba(22, 163, 74, 0.1); padding: 6px 12px; border-radius: 8px; display: inline-block;">${escapeHtml(winDetails.improvement)}</div>` : ''}
                
                <div style="margin-top: 20px; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 15px; display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #10b981); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.8rem;">
                        ${window.currentUser?.user_metadata?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <div style="font-size: 0.8rem; font-weight: 700; color: #1a202c;">${window.currentUser?.user_metadata?.name || 'Power User'}</div>
                        <div style="font-size: 0.65rem; color: #a0aec0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">BALANCE</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(tempDiv);

        const card = document.getElementById('temp-share-card');
        const canvas = await html2canvas(card, {
            backgroundColor: null,
            scale: 3,
            logging: false,
            useCORS: true
        });

        const dataUrl = canvas.toDataURL('image/png');
        document.body.removeChild(tempDiv);

        // Share the image
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'my-win-card.png', { type: 'image/png' });

        if (navigator.share) {
            await navigator.share({
                files: [file],
                title: 'My Win on Balance!',
                text: 'Check out my progress! 💪'
            });
        } else {
            // Fallback download
            const link = document.createElement('a');
            link.download = 'my-win-card.png';
            link.href = dataUrl;
            link.click();
            showToast('Card saved! You can now share it to Messenger.', 'success');
        }

    } catch (err) {
        console.error('Error sharing externally:', err);
        showToast('Failed to generate card visual', 'error');
    } finally {
        shareBtn.disabled = false;
        shareBtn.innerHTML = originalContent;
    }
}

// Share an existing card from chat
async function shareWinCardAsImage(messageId) {
    const cardElement = document.getElementById(`win-card-${messageId}`);
    if (!cardElement) return;

    // Temporarily show the logo tag for the capture
    const logoTag = cardElement.querySelector('.share-only');
    if (logoTag) logoTag.style.display = 'block';

    try {
        const canvas = await html2canvas(cardElement, {
            backgroundColor: null,
            scale: 3,
            logging: false,
            useCORS: true,
            onclone: (clonedDoc) => {
                // Ensure the logo tag is visible in the clone
                const clonedCard = clonedDoc.getElementById(`win-card-${messageId}`);
                const clonedLogo = clonedCard.querySelector('.share-only');
                if (clonedLogo) clonedLogo.style.display = 'block';
            }
        });

        const dataUrl = canvas.toDataURL('image/png');
        if (logoTag) logoTag.style.display = 'none';

        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'win-card.png', { type: 'image/png' });

        if (navigator.share) {
            await navigator.share({
                files: [file],
                title: 'Check out my win!',
                text: 'Shared from Balance 💪'
            });
        } else {
            const link = document.createElement('a');
            link.download = 'win-card.png';
            link.href = dataUrl;
            link.click();
            showToast('Card saved to your device!', 'success');
        }
    } catch (err) {
        console.error('Error sharing card:', err);
        showToast('Failed to capture card', 'error');
        if (logoTag) logoTag.style.display = 'none';
    }
}

// ============================================================
// CHALLENGES FUNCTIONS
// ============================================================
// CHALLENGE SYSTEM CONFIGURATION
// ============================================================

const CHALLENGE_UNIT_LABELS = {
    xp: 'XP',
    workouts: 'workouts',
    volume: 'kg',
    calories: 'days',
    steps: 'steps',
    streak: 'days',
    sleep: 'min',
    water: 'days',
    milestone: '%',
    weight_loss: '%'
};

const CHALLENGE_TYPES = {
    xp:       { emoji: '⚡', name: 'Level Up',  desc: 'Most XP earned', subtitle: '30-day XP battle with friends', color: '#c084fc', howStep2: 'Earn <strong style="color: #4ade80;">double XP</strong> on everything for 30 days.', howStep3: 'Most <strong style="color: #c084fc;">XP</strong> at the end wins.' },
    workouts: { emoji: '💪', name: 'Workout',   desc: 'Most workouts logged', subtitle: '30-day workout challenge', color: '#ef4444', howStep2: 'Log your <strong style="color: #4ade80;">workouts</strong> consistently for 30 days.', howStep3: 'Most <strong style="color: #ef4444;">workouts logged</strong> wins.' },
    volume:   { emoji: '🏋️', name: 'Volume',    desc: 'Most total kg lifted', subtitle: '30-day volume challenge', color: '#fb923c', howStep2: 'Track your <strong style="color: #4ade80;">lifting volume</strong> for 30 days.', howStep3: 'Most <strong style="color: #fb923c;">total kg lifted</strong> wins.' },
    calories: { emoji: '🍎', name: 'Calories',  desc: 'Most days with macros & calories on target', subtitle: '30-day nutrition battle', color: '#4ade80', howStep2: 'Log <strong style="color: #4ade80;">every meal with a photo</strong> each day — each photo is verified by AI. Then hit within <strong style="color: #4ade80;">20% of your calorie &amp; macro goals</strong> and tap the daily bonus button to lock in that day.', howStep3: 'Every <strong style="color: #4ade80;">day with all meals photo-verified and macros &amp; calories on target</strong> = 1 point. No photo = day doesn\'t count.' },
    steps:    { emoji: '👟', name: 'Steps',     desc: 'Most total steps', subtitle: '30-day step challenge', color: '#3b82f6', howStep2: 'Track your <strong style="color: #4ade80;">steps</strong> every day for 30 days.', howStep3: 'Most <strong style="color: #3b82f6;">total steps</strong> wins.' },
    sleep:    { emoji: '🌙', name: 'Sleep',     desc: 'Most minutes of deep sleep', subtitle: '30-day sleep challenge', color: '#a855f7', howStep2: 'Track your <strong style="color: #4ade80;">sleep</strong> every night for 30 days.', howStep3: 'Most <strong style="color: #a855f7;">minutes of sleep</strong> wins.' },
    water:    { emoji: '💧', name: 'Hydration', desc: 'Most days hitting water goal', subtitle: '30-day water challenge', color: '#0ea5e9', howStep2: 'Log your <strong style="color: #4ade80;">water intake</strong> consistently for 30 days.', howStep3: 'Most <strong style="color: #0ea5e9;">days hitting goal</strong> wins.' },
    milestone: { emoji: '🏔️', name: 'Milestone', desc: 'First to hit a PR goal', subtitle: 'First to hit target weight/reps', color: '#ec4899', howStep2: 'Set a specific <strong style="color: #4ade80;">fitness milestone</strong> to achieve.', howStep3: 'First to hit <strong style="color: #ec4899;">100%</strong> of the target wins.' },
    quiz:        { emoji: '🧠', name: 'Health IQ',    desc: 'Most quizzes completed',           subtitle: '30-day learning challenge',            color: '#10b981', howStep2: 'Complete <strong style="color: #4ade80;">quizzes</strong> on the Learn page.',                              howStep3: 'Most <strong style="color: #10b981;">quizzes finished</strong> wins — 1 point per quiz.' },
    weight_loss: { emoji: '⚖️', name: 'Weight Loss',  desc: 'Most % body weight lost',          subtitle: '30-day weight loss challenge',          color: '#34d399', howStep2: 'Weigh in <strong style="color: #4ade80;">daily</strong> using the weigh-in card.',                        howStep3: 'Most <strong style="color: #34d399;">% body weight lost</strong> wins — calculated fairly by % so size doesn\'t matter.' }
};

let currentChallengeId = null;

// Stage-based card colors so active challenges stay visually distinct from the
// purple "Start a Challenge" empty-state card and build urgency as the clock
// runs down. Fraction = elapsed / duration. Four stages roughly map to weeks
// of a ~28-day challenge: fresh teal → blue → amber → red final stretch.
function getChallengeStageColors(challenge) {
    let duration = Number(challenge && challenge.duration_days);
    if (!Number.isFinite(duration) || duration <= 0) {
        if (challenge && challenge.start_date && challenge.end_date) {
            const start = new Date(challenge.start_date);
            const end = new Date(challenge.end_date);
            const ms = end - start;
            duration = Math.max(1, Math.round(ms / 86400000));
        } else {
            duration = 28;
        }
    }
    const remaining = Math.max(0, Number(challenge && challenge.days_remaining) || 0);
    const elapsed = Math.max(0, duration - remaining);
    const fraction = Math.min(1, elapsed / duration);

    if (fraction < 0.25) {
        return { gradient: 'linear-gradient(135deg, #14b8a6 0%, #0891b2 100%)', shadow: 'rgba(20,184,166,0.25)', stage: 1 };
    }
    if (fraction < 0.5) {
        return { gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', shadow: 'rgba(59,130,246,0.25)', stage: 2 };
    }
    if (fraction < 0.75) {
        return { gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)', shadow: 'rgba(234,88,12,0.3)', stage: 3 };
    }
    return { gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', shadow: 'rgba(220,38,38,0.32)', stage: 4 };
}
window.getChallengeStageColors = getChallengeStageColors;

// Load user's challenges
// Load challenges for home screen (compact version)
async function loadHomeChallenges() {
    console.log('⚔️ [loadHomeChallenges] START');
    if (!window.currentUser) {
        console.warn('⚔️ [loadHomeChallenges] No currentUser, skipping');
        return;
    }

    const container = document.getElementById('home-challenges-list');
    const emptyState = document.getElementById('home-challenges-empty');
    if (!container) return; // Only return if container is missing, currentUser check is already done

    try {
        console.log('⚔️ [loadHomeChallenges] Fetching from RPC get_user_challenges_v2...');
        let { data: rawChallenges, error: rpcError } = await window.supabaseClient
            .rpc('get_user_challenges_v2', { p_user_id: window.currentUser.id });

        if (rpcError) {
            console.error('⚔️ [loadHomeChallenges] RPC ERROR:', rpcError);
            console.log('⚔️ [loadHomeChallenges] Falling back to get_user_challenges...');
            const { data: fallbackData, error: fallbackError } = await window.supabaseClient
                .rpc('get_user_challenges', { user_uuid: window.currentUser.id });
                
            if (fallbackError) {
                console.error('⚔️ [loadHomeChallenges] FALLBACK ERROR:', fallbackError);
                throw fallbackError;
            }
            rawChallenges = fallbackData;
        }

        const allChallenges = rawChallenges || [];
        console.log('⚔️ [loadHomeChallenges] Records fetched:', allChallenges.length);
        if (allChallenges.length > 0) {
            console.log('⚔️ [loadHomeChallenges] Sample Record:', JSON.stringify(allChallenges[0]));
        }

        // Steps & sleep challenges read their scores from wearable tables via
        // update_challenge_participant_points. If the SQL function in production
        // is stale (e.g. only reads from oura_*), the user sees 0 here even
        // though Activity Insights shows real Fitbit/WHOOP/native data. Patch
        // those rows in-place from the JS side using the same multi-source
        // GREATEST-per-day logic so the home cards stay in sync regardless.
        try {
            await patchWearableChallengeScoresInPlace(allChallenges, 'user_points');
        } catch (e) {
            console.warn('⚔️ [loadHomeChallenges] Wearable score patch failed:', e);
        }

        // Filter challenges by status and user participation
        const activeChallenges = allChallenges.filter(c =>
            c.status === 'active' && (c.user_status === 'accepted' || c.user_status === 'active')
        );
        const pendingChallenges = allChallenges.filter(c =>
            c.status === 'pending' && (c.user_status === 'accepted' || c.user_status === 'active')
        );
        const pendingInvites = allChallenges.filter(c => c.user_status === 'invited');

        console.log('⚔️ [loadHomeChallenges] Counts - Active:', activeChallenges.length, 'Pending:', pendingChallenges.length, 'Invites:', pendingInvites.length);

        const hasChallenges = activeChallenges.length > 0 || pendingInvites.length > 0 || pendingChallenges.length > 0;

        // Toggle visibility of the "Start a Challenge" empty state card
        // USER REQUEST: "Start a challenge should always stay because then it shows you what challenges you have pending..."
        if (emptyState) {
            emptyState.style.display = 'block'; 
            console.log('⚔️ [loadHomeChallenges] Setting emptyState display to block forever per user request.');
        }
        
        if (!hasChallenges) {
            container.innerHTML = '';
            console.log('⚔️ [loadHomeChallenges] No matching challenges found for user.');
            return;
        }

        let html = '';

        // Show pending invites first
        if (pendingInvites.length > 0) {
            html += pendingInvites.map(challenge => {
                const entryFee = challenge.entry_fee || 1000;
                const rareId = challenge.rare_reward_id;
                const rare = rareId && typeof RARE_COLLECTION !== 'undefined' ? RARE_COLLECTION.find(r => r.id === rareId) : null;
                const tierData = rare ? (RARE_TIERS[rare.tier] || RARE_TIERS.COMMON) : null;

                return `
                <div style="border-radius: 20px; overflow: hidden; box-shadow: 0 4px 15px rgba(124,58,237,0.2); background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); margin-bottom: 12px;">
                    <div style="padding: 16px 20px;">
                        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px;">
                            <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1.4rem;">
                                ${rare ? rare.emoji : '🎯'}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                                    <span style="font-weight: 700; color: white; font-size: 0.95rem;">${challenge.challenge_name}</span>
                                    <span style="background: rgba(255,255,255,0.2); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 700;">INVITE</span>
                                </div>
                                <div style="font-size: 0.78rem; color: rgba(255,255,255,0.7);">
                                    from ${challenge.creator_name} · 👥 ${challenge.participant_count} joined
                                </div>
                                <div style="font-size: 0.72rem; color: rgba(255,255,255,0.85); font-weight: 600; margin-top: 3px;">
                                    🪙 ${entryFee.toLocaleString()} entry · 2x XP · ${rare ? rare.emoji + ' Win ' + rare.name : 'Win rare drops'}
                                </div>
                                ${tierData ? `<span style="display: inline-block; margin-top: 3px; padding: 1px 6px; border-radius: 3px; font-size: 0.55rem; font-weight: 800; background: ${tierData.gradient}; color: white;">${tierData.label}</span>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="acceptChallengeInvite('${challenge.challenge_id}')" style="flex: 1; padding: 10px; background: rgba(255,255,255,0.95); color: #7c3aed; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 0.85rem;">🪙 Join (${entryFee.toLocaleString()})</button>
                            <button onclick="declineChallengeInvite('${challenge.challenge_id}')" style="flex: 1; padding: 10px; background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.8); border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">Decline</button>
                        </div>
                    </div>
                </div>
            `}).join('');
        }

        // Show pending challenges (waiting for friends to join)
        html += pendingChallenges.map(challenge => {
            const cType = CHALLENGE_TYPES[challenge.challenge_type] || CHALLENGE_TYPES.xp;
            return `
            <div style="border-radius: 20px; overflow: hidden; box-shadow: 0 4px 15px rgba(245,158,11,0.2); background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%); margin-bottom: 12px; margin-top: 12px; position: relative;">
                <div onclick="openChallengeLeaderboard('${challenge.challenge_id}')" style="cursor: pointer; padding: 18px 20px; padding-bottom: 10px; display: flex; align-items: center; gap: 14px;">
                    <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.25); border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1.3rem;">${cType.emoji}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                            <span style="font-weight: 700; color: white; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${challenge.challenge_name}</span>
                            <span style="background: rgba(255,255,255,0.25); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; font-weight: 700; flex-shrink: 0;">PENDING</span>
                        </div>
                        <div style="font-size: 0.78rem; color: rgba(255,255,255,0.8);">
                            Waiting for friends to join · ${challenge.participant_count} so far
                        </div>
                    </div>
                    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: rgba(255,255,255,0.5); flex-shrink: 0;"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
                </div>
                <div style="padding: 0 20px 14px 20px; text-align: right;">
                     <button onclick="leaveChallengeFromCard(event, '${challenge.challenge_id}')" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 5px 12px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: background 0.2s;">
                         Cancel Challenge
                     </button>
                </div>
            </div>
        `}).join('');

        // Show active challenges — if > 3, tuck ALL of them behind a collapsible dashed toggle
        const buildActiveChallengeCard = challenge => {
            const cType = CHALLENGE_TYPES[challenge.challenge_type] || CHALLENGE_TYPES.xp;
            const stage = getChallengeStageColors(challenge);
            return `
            <div style="border-radius: 20px; overflow: hidden; box-shadow: 0 4px 15px ${stage.shadow}; background: ${stage.gradient}; margin-bottom: 12px; margin-top: 12px; position: relative;">
                <div onclick="openChallengeLeaderboard('${challenge.challenge_id}')" style="cursor: pointer; padding: 18px 20px; padding-bottom: 10px; display: flex; align-items: center; gap: 14px;">
                    <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 1.3rem;">
                        ${cType.emoji}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 700; color: white; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${challenge.challenge_name}</div>
                        <div style="display: flex; gap: 12px; font-size: 0.78rem; color: rgba(255,255,255,0.7);">
                            <span>#${challenge.user_rank}</span>
                            <span>⏱️ ${challenge.days_remaining}d left</span>
                            <span>👥 ${challenge.participant_count}</span>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 1.2rem; font-weight: 800; color: white;">${typeof formatChallengePoints === 'function' ? formatChallengePoints(challenge.user_points, challenge.challenge_type || 'xp', undefined, undefined, challenge.raw_points) : challenge.user_points}</div>
                    </div>
                </div>
                <div style="padding: 0 20px 14px 20px; text-align: right;">
                     <button onclick="leaveChallengeFromCard(event, '${challenge.challenge_id}')" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; padding: 5px 12px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: background 0.2s;">
                         Leave Challenge
                     </button>
                </div>
            </div>`;
        };

        if (activeChallenges.length > 3) {
            // All challenges tucked behind the toggle
            html += `
            <div id="extra-challenges-toggle" onclick="window._toggleExtraChallenges(this)"
                style="cursor: pointer; border-radius: 16px; background: rgba(124,58,237,0.18); border: 1.5px dashed rgba(139,92,246,0.5); padding: 13px 18px; display: flex; align-items: center; justify-content: space-between; margin-top: 8px; margin-bottom: 4px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 32px; height: 32px; background: rgba(124,58,237,0.35); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1rem;">⚔️</div>
                    <span style="color: rgba(196,181,253,0.95); font-weight: 700; font-size: 0.85rem;">${activeChallenges.length} active challenge${activeChallenges.length > 1 ? 's' : ''}</span>
                </div>
                <svg id="extra-challenges-chevron" viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: rgba(139,92,246,0.7); transition: transform 0.25s;"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
            </div>
            <div id="extra-challenges-list" style="display: none;"></div>`;
            window._extraChallengesHtml = activeChallenges.map(buildActiveChallengeCard).join('');
        } else {
            html += activeChallenges.map(buildActiveChallengeCard).join('');
            window._extraChallengesHtml = '';
        }

        container.innerHTML = html;

        // Inject hidden cards now that the DOM is ready
        const extraList = document.getElementById('extra-challenges-list');
        if (extraList && window._extraChallengesHtml) {
            extraList.innerHTML = window._extraChallengesHtml;
        }

        // Auto-poll while waiting for opponents to join pending challenges
        _managePendingChallengePoller(pendingChallenges.length > 0);

    } catch (error) {
        console.error('Error loading home challenges:', error);
    }
}

// Toggle the collapsed "extra challenges" section
window._toggleExtraChallenges = function(toggleEl) {
    const list = document.getElementById('extra-challenges-list');
    const chevron = document.getElementById('extra-challenges-chevron');
    if (!list) return;
    const isOpen = list.style.display !== 'none';
    list.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
};

// Polls every 30s to update cards when opponents join pending challenges
let _pendingChallengePollerTimer = null;
function _managePendingChallengePoller(hasPending) {
    if (hasPending && !_pendingChallengePollerTimer) {
        _pendingChallengePollerTimer = setInterval(() => {
            if (typeof loadHomeChallenges === 'function') loadHomeChallenges();
        }, 30000);
    } else if (!hasPending && _pendingChallengePollerTimer) {
        clearInterval(_pendingChallengePollerTimer);
        _pendingChallengePollerTimer = null;
    }
}

// Refresh challenge cards when user returns to the app/tab
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && typeof loadHomeChallenges === 'function' && window.currentUser) {
            loadHomeChallenges();
        }
    });
}

async function loadChallenges() {
    const container = document.getElementById('challenges-container');
    const emptyState = document.getElementById('challenges-empty');

    if (!container || !window.currentUser) return;

    try {
        const { data: challenges, error } = await window.supabaseClient
            .rpc('get_user_challenges', { user_uuid: window.currentUser.id });

        if (error) throw error;

        if (!challenges || challenges.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        container.innerHTML = challenges.map(challenge => {
            const isInvited = challenge.user_status === 'invited';
            const statusBadge = isInvited
                ? '<span style="background: rgba(124,58,237,0.1); color: #7c3aed; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">INVITED</span>'
                : challenge.status === 'active'
                ? '<span style="background: rgba(124,58,237,0.1); color: #7c3aed; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">ACTIVE</span>'
                : '<span style="background: #e0e7ff; color: #4f46e5; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">PENDING</span>';

            return `
                <div style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #f1f5f9; border-left: 5px solid #7c3aed;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 700; color: var(--text-main); font-size: 1rem;">${challenge.challenge_name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">by ${challenge.creator_name}</div>
                        </div>
                        ${statusBadge}
                    </div>
                    <div style="display: flex; gap: 15px; margin-bottom: 12px; font-size: 0.85rem; color: var(--text-muted);">
                        <div>👥 ${challenge.participant_count} participants</div>
                        <div>⏱️ ${challenge.days_remaining} days left</div>
                    </div>
                    ${!isInvited && challenge.status === 'active' ? `
                    <div style="background: #f8fafc; border-radius: 8px; padding: 10px; margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">Your Position</div>
                                <div style="font-size: 1.2rem; font-weight: 700; color: #7c3aed;">#${challenge.user_rank}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.75rem; color: var(--text-muted);">Your Score</div>
                                <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">${typeof formatChallengePoints === 'function' ? formatChallengePoints(challenge.user_points, challenge.challenge_type || 'xp', undefined, undefined, challenge.raw_points) : challenge.user_points}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.75rem; color: var(--text-muted);">Leader</div>
                                <div style="font-size: 0.9rem; font-weight: 600; color: #7c3aed;">${challenge.leader_name} (${typeof formatChallengePoints === 'function' ? formatChallengePoints(challenge.leader_points, challenge.challenge_type || 'xp') : challenge.leader_points})</div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    <div style="display: flex; gap: 8px;">
                        ${isInvited ? `
                            <button onclick="acceptChallengeInvite('${challenge.challenge_id}')" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">🪙 Join Challenge</button>
                            <button onclick="declineChallengeInvite('${challenge.challenge_id}')" style="flex: 1; padding: 10px; background: #f1f5f9; color: var(--text-muted); border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Decline</button>
                        ` : `
                            <button onclick="openChallengeLeaderboard('${challenge.challenge_id}')" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">View Leaderboard</button>
                        `}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading challenges:', error);
    }
}



let selectedChallengeType = 'xp';

function openChallengeTypePicker() {
    const picker = document.getElementById('challenge-type-picker');
    if (picker) picker.style.display = 'flex';
}

function closeChallengeTypePicker() {
    const picker = document.getElementById('challenge-type-picker');
    if (picker) picker.style.display = 'none';
}

function selectChallengeType(type) {
    selectedChallengeType = type;
    closeChallengeTypePicker();
    openCreateChallengeModal();
}

// Open create challenge modal (optionally with a featured rare)
function openCreateChallengeModal(featuredRareId = null) {
    const modal = document.getElementById('create-challenge-modal');
    if (!modal) return;

    // Store featured rare context
    window._challengeFeaturedRare = featuredRareId;

    const rarePreview = document.getElementById('challenge-rare-preview');
    const randomDropInfo = document.getElementById('challenge-random-drop-info');
    const headerTitle = modal.querySelector('h3');
    const wagerSection = document.getElementById('challenge-wager-section');
    const feeSection = document.getElementById('challenge-fee-section');

    if (featuredRareId) {
        // Featured rare challenge mode
        const rare = RARE_COLLECTION.find(r => r.id === featuredRareId);
        if (rare) {
            const tierData = RARE_TIERS[rare.tier];
            // Show 3D preview
            if (rarePreview) {
                rarePreview.style.display = 'block';
                const viewer = window._pbbSetModelSrc
                    ? window._pbbSetModelSrc('challenge-rare-viewer', rare.model)
                    : document.getElementById('challenge-rare-viewer');
                if (viewer && !window._pbbSetModelSrc) viewer.setAttribute('src', rare.model);
                const nameEl = document.getElementById('challenge-rare-name');
                if (nameEl) nameEl.textContent = rare.name;
                const badgeEl = document.getElementById('challenge-rare-tier-badge');
                if (badgeEl) {
                    badgeEl.textContent = tierData.label;
                    badgeEl.style.background = tierData.gradient;
                }
            }
            // Hide random drop info
            if (randomDropInfo) randomDropInfo.style.display = 'none';
            // Lock wager to tier buy-in
            if (wagerSection) wagerSection.style.display = 'none';
            createChallengeBetAmount = tierData.buyIn;
            // Update fee display
            const feeDisplay = document.getElementById('create-challenge-fee-display');
            if (feeDisplay) feeDisplay.textContent = tierData.buyIn.toLocaleString() + ' Coins entry fee';
            // Update header
            if (headerTitle) {
                headerTitle.innerHTML = `${rare.emoji} Featured Rare Challenge`;
                headerTitle.style.color = tierData.color;
            }
            // Featured rare challenges are always XP-type
            const xpType = CHALLENGE_TYPES.xp;
            const howStep2 = document.getElementById('challenge-how-step2');
            const howStep3 = document.getElementById('challenge-how-step3');
            if (howStep2) howStep2.innerHTML = xpType.howStep2;
            if (howStep3) howStep3.innerHTML = xpType.howStep3;
        }
    } else {
        // Generic challenge mode — use selected challenge type
        const typeInfo = CHALLENGE_TYPES[selectedChallengeType] || CHALLENGE_TYPES.xp;
        if (rarePreview) rarePreview.style.display = 'none';
        if (randomDropInfo) randomDropInfo.style.display = 'block';
        if (wagerSection) wagerSection.style.display = 'block';
        // Reset wager presets for this challenge type (quiz gets smaller bets, wellness gets larger)
        _updateCreateChallengeBetPresets(selectedChallengeType);
        // Update "How It Works" steps based on challenge type
        const howStep2 = document.getElementById('challenge-how-step2');
        const howStep3 = document.getElementById('challenge-how-step3');
        if (howStep2) howStep2.innerHTML = typeInfo.howStep2;
        if (howStep3) howStep3.innerHTML = typeInfo.howStep3;
        // Update header with type info
        if (headerTitle) {
            headerTitle.innerHTML = `${typeInfo.emoji} ${typeInfo.name} Challenge`;
            headerTitle.style.color = typeInfo.color;
        }
        const subtitle = document.getElementById('create-challenge-subtitle');
        if (subtitle) subtitle.textContent = typeInfo.subtitle;
        // Show type badge
        const typeBadge = document.getElementById('create-challenge-type-badge');
        if (typeBadge) {
            typeBadge.style.display = '';
            const badgeSpan = typeBadge.querySelector('span');
            if (badgeSpan) {
                badgeSpan.textContent = typeInfo.desc.toUpperCase();
                badgeSpan.style.background = `${typeInfo.color}33`;
                badgeSpan.style.color = typeInfo.color;
            }
        }
        // Set hidden input
        const typeInput = document.getElementById('challenge-type-input');
        if (typeInput) typeInput.value = selectedChallengeType;
    }

    modal.style.display = 'flex';
    loadFriendsForChallenge();
    // Set default start date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('challenge-start-date').value = getLocalDateString(tomorrow);
}

// Close create challenge modal
function closeCreateChallengeModal() {
    const modal = document.getElementById('create-challenge-modal');
    if (modal) modal.style.display = 'none';
    // Release the challenge rare viewer WebGL context
    if (window._pbbClearModelSrc) window._pbbClearModelSrc('challenge-rare-viewer');
}

// Load friends for challenge selection
async function loadFriendsForChallenge() {
    const container = document.getElementById('challenge-friends-list');
    if (!container || !window.currentUser) return;

    try {
        const friends = await db.friends.getFriendsWithFallback(window.currentUser.id);

        if (!friends || friends.length === 0) {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: rgba(255,255,255,0.5);">No friends yet. Add friends first!</div>';
            return;
        }

        container.innerHTML = friends.map(friend => {
            const initials = (friend.friend_name || '?').charAt(0).toUpperCase();
            return `
                <label style="display: flex; align-items: center; gap: 12px; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">
                    <input type="checkbox" class="challenge-friend-checkbox" value="${friend.friend_id}" style="width: 18px; height: 18px; accent-color: #60a5fa;">
                    <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, rgba(96,165,250,0.4), rgba(59,130,246,0.4)); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.9rem; overflow: hidden;">
                        ${friend.friend_photo ? `<img src="${friend.friend_photo}" style="width: 100%; height: 100%; object-fit: cover;">` : initials}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: white; font-size: 0.9rem;">${friend.friend_name}</div>
                        ${friend.current_streak > 0 ? `<div style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">🔥 ${friend.current_streak}</div>` : ''}
                    </div>
                </label>
            `;
        }).join('');

        // Update selected count on change
        container.querySelectorAll('.challenge-friend-checkbox').forEach(cb => {
            cb.addEventListener('change', updateSelectedCount);
        });

    } catch (error) {
        console.error('Error loading friends for challenge:', error);
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Failed to load friends</div>';
    }
}

// Update selected friends count
function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.challenge-friend-checkbox:checked');
    const countEl = document.getElementById('challenge-selected-count');
    if (countEl) countEl.textContent = checkboxes.length;
}

// Wellness challenges min: 2,500 (≈$25). Quiz/game challenges min: 1,000.
const CHALLENGE_MIN_BET_WELLNESS = 2500;
const CHALLENGE_MIN_BET_QUIZ = 1000;
const CHALLENGE_MIN_BET = CHALLENGE_MIN_BET_WELLNESS; // default

// Create challenge bet amount (for the create modal)
let createChallengeBetAmount = CHALLENGE_MIN_BET_WELLNESS;

// Dynamically update the wager preset buttons based on challenge type.
// Quiz type: smaller bets (1K–10K). Wellness/all others: larger bets (2.5K–50K).
function _updateCreateChallengeBetPresets(type) {
    const isQuiz = (type === 'quiz');
    const presets = isQuiz
        ? [[1000, '1K'], [2000, '2K'], [2500, '2.5K'], [5000, '5K'], [10000, '10K']]
        : [[2500, '2.5K'], [5000, '5K'], [10000, '10K'], [25000, '25K'], [50000, '50K']];
    const minBet = presets[0][0];

    document.querySelectorAll('.create-challenge-bet-btn').forEach((b, i) => {
        if (!presets[i]) return;
        const [amt, label] = presets[i];
        b.textContent = '🪙 ' + label;
        b.onclick = (function(a) { return function() { window._setCreateChallengeBet(a, this); }; })(amt);
        if (i === 0) {
            b.style.background = 'rgba(255,255,255,0.15)';
            b.style.borderColor = 'rgba(255,255,255,0.3)';
            b.classList.add('active');
        } else {
            b.style.background = 'rgba(255,255,255,0.08)';
            b.style.borderColor = 'rgba(255,255,255,0.15)';
            b.classList.remove('active');
        }
    });

    createChallengeBetAmount = minBet;
    const feeDisplay = document.getElementById('create-challenge-fee-display');
    if (feeDisplay) feeDisplay.textContent = minBet.toLocaleString() + ' Coins entry fee';
    const customInput = document.getElementById('create-challenge-custom-bet');
    if (customInput) customInput.min = minBet;
}

window._setCreateChallengeBet = function(amount, btnEl) {
    const minBet = (selectedChallengeType === 'quiz') ? CHALLENGE_MIN_BET_QUIZ : CHALLENGE_MIN_BET_WELLNESS;
    if (amount < minBet && amount !== 0) {
        amount = minBet;
    }
    createChallengeBetAmount = Math.max(amount, minBet);

    // Update active button styling (dark theme)
    if (btnEl) {
        document.querySelectorAll('.create-challenge-bet-btn').forEach(b => {
            b.style.background = 'rgba(255,255,255,0.08)';
            b.style.color = 'white';
            b.style.borderColor = 'rgba(255,255,255,0.15)';
            b.classList.remove('active');
        });
        btnEl.style.background = 'rgba(255,255,255,0.15)';
        btnEl.style.color = 'white';
        btnEl.style.borderColor = 'rgba(255,255,255,0.3)';
        btnEl.classList.add('active');
        // Clear custom input
        const customInput = document.getElementById('create-challenge-custom-bet');
        if (customInput) customInput.value = '';
    } else {
        // Custom input used - deactivate all preset buttons
        document.querySelectorAll('.create-challenge-bet-btn').forEach(b => {
            b.style.background = 'rgba(255,255,255,0.08)';
            b.style.color = 'white';
            b.style.borderColor = 'rgba(255,255,255,0.15)';
            b.classList.remove('active');
        });
    }

    // Update fee display
    const feeDisplay = document.getElementById('create-challenge-fee-display');
    if (feeDisplay) {
        feeDisplay.textContent = createChallengeBetAmount.toLocaleString() + ' Coins entry fee';
    }

    // Update create button
    const createBtn = document.getElementById('create-challenge-btn');
    if (createBtn && !createBtn.disabled) {
        createBtn.textContent = 'Create Challenge';
    }
};

// Create a new challenge (with coin buy-in for creator)
async function createChallenge() {
    console.log('⚔️ [createChallenge] START');
    const nameInput = document.getElementById('challenge-name-input');
    const durationSelect = document.getElementById('challenge-duration-select');
    const startDateInput = document.getElementById('challenge-start-date');
    const selectedFriends = document.querySelectorAll('.challenge-friend-checkbox:checked');

    const name = nameInput?.value.trim();
    const duration = 30; // Fixed 30-day duration
    const startDate = startDateInput?.value;

    console.log('⚔️ [createChallenge] Params:', { name, duration, startDate, friendsCount: selectedFriends.length });

    if (!name) {
        alert('Please enter a challenge name');
        return;
    }

    if (selectedFriends.length === 0) {
        alert('Please select at least one friend to challenge');
        return;
    }

    if (!startDate) {
        alert('Please select a start date');
        return;
    }

    const btn = document.getElementById('create-challenge-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Creating...';
    }

    try {
        const betAmount = createChallengeBetAmount;
        const challengeType = document.getElementById('challenge-type-input')?.value || selectedChallengeType || 'xp';
        
        // Calculate end date
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + duration);
        const endDateStr = getLocalDateString(end);

        // Determine rare reward (featured vs random)
        let rareRewardId = null;
        if (window._challengeFeaturedRare) {
            rareRewardId = window._challengeFeaturedRare;
        } else {
            const randomDrop = getRandomRareDrop();
            if (randomDrop) rareRewardId = randomDrop.id;
        }

        console.log('⚔️ [createChallenge] Calling create_wellness_challenge RPC...');
        const { data: result, error: rpcError } = await window.supabaseClient.rpc('create_wellness_challenge', {
            p_name: name,
            p_creator_id: window.currentUser.id,
            p_start_date: startDate,
            p_end_date: endDateStr,
            p_duration_days: duration,
            p_challenge_type: challengeType,
            p_entry_fee: betAmount,
            p_rare_reward_id: rareRewardId
        });

        if (rpcError) {
            console.error('⚔️ [createChallenge] RPC ERROR:', rpcError);
            throw rpcError;
        }

        if (result.error) {
            console.warn('⚔️ [createChallenge] RPC Error Result:', result.error);
            if (result.error === 'insufficient_coins') {
                alert('Not enough coins! You need ' + betAmount.toLocaleString() + ' coins.');
                if (typeof openCoinShop === 'function') openCoinShop();
            } else {
                alert('Failed to create challenge: ' + result.message);
            }
            if (btn) { btn.disabled = false; btn.textContent = 'Create Challenge'; }
            return;
        }

        const challengeId = result.challenge_id;
        console.log('⚔️ [createChallenge] Challenge Created Successfully. ID:', challengeId);

        if (result.new_balance !== undefined) {
             updateCoinBalanceDisplay(result.new_balance);
        }

        // Invite selected friends
        const friendIds = Array.from(selectedFriends).map(cb => cb.value);
        console.log('⚔️ [createChallenge] Inviting friends:', friendIds);
        
        const invites = friendIds.map(friendId => ({
            challenge_id: challengeId,
            user_id: friendId,
            status: 'invited'
        }));

        const { error: inviteError } = await window.supabaseClient
            .from('challenge_participants')
            .insert(invites);

        if (inviteError) {
            console.error('⚔️ [createChallenge] Invite Error:', inviteError);
            throw inviteError;
        }

        // Send nudge notification to each invited friend
        const creatorName = window.currentUser?.user_metadata?.name || window.currentUser?.email || 'Someone';
        const typeLabel = (CHALLENGE_TYPES[challengeType] || CHALLENGE_TYPES.xp).name;
        const rareInfo = rareRewardId ? RARE_COLLECTION.find(r => r.id === rareRewardId) : null;
        const nudgeMessage = rareInfo
            ? `⚔️ ${typeLabel.toUpperCase()} CHALLENGE! ${creatorName} challenged you to "${name}" — win ${rareInfo.emoji} ${rareInfo.name}! 🪙 ${betAmount.toLocaleString()} entry`
            : `⚔️ ${typeLabel.toUpperCase()} CHALLENGE! ${creatorName} challenged you to "${name}"! 🪙 ${betAmount.toLocaleString()} entry`;

        console.log('⚔️ [createChallenge] Sending nudges...');
        for (const friendId of friendIds) {
            try {
                await window.supabaseClient
                    .from('nudges')
                    .insert({
                        sender_id: window.currentUser.id,
                        receiver_id: friendId,
                        message: nudgeMessage,
                        nudge_type: 'challenge_invite',
                        reference_id: challengeId
                    });
            } catch (nudgeErr) {
                console.warn('⚔️ [createChallenge] Failed to send nudge to', friendId, nudgeErr);
            }
        }
        
        showToast('Challenge created! Invitations sent.', 'success');

        closeCreateChallengeModal();
        
        // Wait 1 second before refreshing home challenges to ensure eventual consistency
        console.log('⚔️ [createChallenge] Success! Scheduling refresh in 1s...');
        setTimeout(() => {
            if (typeof loadHomeChallenges === 'function') {
                console.log('⚔️ [createChallenge] Triggering scheduled refresh now');
                loadHomeChallenges();
            }
        }, 1000);
        
        try { if (typeof checkChallengeBadges === 'function') checkChallengeBadges(); } catch(e) {}

    } catch (error) {
        console.error('⚔️ [createChallenge] CRITICAL ERROR:', error);
        alert('Failed to create challenge: ' + (error.message || 'Unknown error'));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Create Challenge';
        }
    }
}

// Store pending challenge ID for buy-in modal
let pendingChallengeId = null;

// Accept challenge invitation - always requires payment
async function acceptChallengeInvite(challengeId) {
    pendingChallengeId = challengeId;
    window._pendingWeightGoal = 'lose'; // default

    // Fetch the challenge to get the entry_fee, rare_reward_id and challenge_type
    try {
        const { data: challenge } = await window.supabaseClient
            .from('challenges')
            .select('entry_fee, rare_reward_id, name, challenge_type')
            .eq('id', challengeId)
            .single();

        if (challenge) {
            window._pendingChallengeEntryFee = challenge.entry_fee || 1000;
            window._pendingChallengeRareId = challenge.rare_reward_id || null;
            window._pendingChallengeName = challenge.name || 'Challenge';
            window._pendingChallengeType = challenge.challenge_type || 'xp';
        } else {
            window._pendingChallengeEntryFee = 1000;
            window._pendingChallengeRareId = null;
            window._pendingChallengeName = 'Challenge';
            window._pendingChallengeType = 'xp';
        }
    } catch (e) {
        console.warn('Could not fetch challenge details:', e);
        window._pendingChallengeEntryFee = 1000;
        window._pendingChallengeRareId = null;
        window._pendingChallengeName = 'Challenge';
        window._pendingChallengeType = 'xp';
    }

    // For weight_loss challenges, ask the user their goal first
    if (window._pendingChallengeType === 'weight_loss') {
        showWeightGoalPicker();
    } else {
        showChallengePassModal(window._pendingChallengeEntryFee, window._pendingChallengeRareId);
    }
}

function showWeightGoalPicker() {
    const modal = document.getElementById('weight-goal-picker-modal');
    if (modal) modal.style.display = 'flex';
}

function closeWeightGoalPicker() {
    const modal = document.getElementById('weight-goal-picker-modal');
    if (modal) modal.style.display = 'none';
}

function selectWeightGoal(goal) {
    window._pendingWeightGoal = goal;
    closeWeightGoalPicker();
    showChallengePassModal(window._pendingChallengeEntryFee, window._pendingChallengeRareId);
}

// Actually accept the challenge
async function doAcceptChallenge(challengeId) {
    try {
        const { data, error } = await window.supabaseClient
            .rpc('join_wellness_challenge', {
                p_challenge_id: challengeId,
                p_user_id: window.currentUser.id,
                p_weight_goal: window._pendingWeightGoal || 'lose'
            });

        if (error) {
            console.error('⚔️ [doAcceptChallenge] RPC ERROR:', error);
            throw error;
        }

        if (data && data.error) {
            console.error('⚔️ [doAcceptChallenge] DB LOGIC ERROR:', data);
            throw new Error(data.message || data.error);
        }

        if (typeof showToast === 'function') {
            showToast('Challenge accepted! Good luck!', 'success');
        } else {
            alert('Challenge accepted! Good luck!');
        }

        // Refresh challenges on home screen
        if (typeof loadHomeChallenges === 'function') {
            await loadHomeChallenges();
        }
        if (typeof loadCoinBalance === 'function') {
            loadCoinBalance();
        }

        // Pop open the leaderboard automatically now that they joined
        openChallengeLeaderboard(challengeId);

    } catch (error) {
        console.error('Error accepting challenge:', error);
        if (typeof showToast === 'function') {
            showToast(error.message || 'Failed to accept challenge', 'error');
        } else {
            alert(error.message || 'Failed to accept challenge');
        }
    }
}

// Show challenge buy-in modal (locked to the challenge's entry fee)
function showChallengePassModal(lockedEntryFee, rareRewardId) {
    const modal = document.getElementById('challenge-pass-modal');
    if (!modal) return;

    const entryFee = lockedEntryFee || 1000;
    currentChallengeBet = entryFee;

    const joinBtn = document.getElementById('buy-challenge-pass-btn');
    if (joinBtn) {
        joinBtn.disabled = false;
        joinBtn.innerHTML = 'Spend 🪙 ' + entryFee.toLocaleString() + ' Coins &amp; Join';
    }

    // Hide the wager picker entirely — accepter must match creator's entry fee
    const betPicker = modal.querySelector('.challenge-bet-picker');
    if (betPicker) betPicker.style.display = 'none';
    const customInput = document.getElementById('challenge-custom-bet');
    if (customInput) customInput.parentElement.style.display = 'none';

    // Show the locked entry fee info
    const feeInfo = document.getElementById('challenge-pass-fee-info');
    if (feeInfo) {
        feeInfo.textContent = '🪙 ' + entryFee.toLocaleString() + ' Coins entry fee';
    }

    // Show rare reward info if available
    const rareInfoEl = document.getElementById('challenge-pass-rare-info');
    if (rareInfoEl) {
        if (rareRewardId && typeof RARE_COLLECTION !== 'undefined') {
            const rare = RARE_COLLECTION.find(r => r.id === rareRewardId);
            if (rare) {
                const tierData = RARE_TIERS[rare.tier] || RARE_TIERS.COMMON;
                rareInfoEl.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.2); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;">
                        <span style="font-size: 1.5rem;">${rare.emoji}</span>
                        <div>
                            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Win This Rare</div>
                            <div style="font-weight: 700; color: var(--text-main);">${rare.name} <span style="padding: 1px 6px; border-radius: 4px; font-size: 0.55rem; font-weight: 800; background: ${tierData.gradient}; color: white;">${tierData.label}</span></div>
                        </div>
                    </div>
                `;
                rareInfoEl.style.display = 'block';
            } else {
                rareInfoEl.style.display = 'none';
            }
        } else {
            rareInfoEl.style.display = 'none';
        }
    }

    modal.style.display = 'flex';
    loadCoinBalance();
}

// Close challenge pass modal
function closeChallengePassModal() {
    const modal = document.getElementById('challenge-pass-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    pendingChallengeId = null;
}

// Spend coins to join a challenge
let currentChallengeBet = CHALLENGE_MIN_BET;

// Set challenge bet amount from join modal picker
window._setChallengeBet = function(amount, btnEl) {
    if (amount < CHALLENGE_MIN_BET && amount !== 0) {
        amount = CHALLENGE_MIN_BET;
    }
    currentChallengeBet = Math.max(amount, CHALLENGE_MIN_BET);

    // Update active button styling
    if (btnEl) {
        document.querySelectorAll('#challenge-pass-modal .challenge-bet-btn').forEach(b => {
            b.classList.remove('active');
        });
        btnEl.classList.add('active');
        // Clear custom input when a preset button is clicked
        const customInput = document.getElementById('challenge-custom-bet');
        if (customInput) customInput.value = '';
    } else {
        // Custom input was used, deactivate all preset buttons
        document.querySelectorAll('#challenge-pass-modal .challenge-bet-btn').forEach(b => {
            b.classList.remove('active');
        });
    }

    // Update join button text
    const joinBtn = document.getElementById('buy-challenge-pass-btn');
    if (joinBtn) {
        joinBtn.innerHTML = 'Spend 🪙 ' + currentChallengeBet.toLocaleString() + ' Coins &amp; Join';
    }
};

async function spendCoinsToJoinChallenge() {
    console.log('⚔️ [spendCoinsToJoinChallenge] START');
    const challengeId = pendingChallengeId;
    if (!challengeId) {
        console.error('⚔️ [spendCoinsToJoinChallenge] No pendingChallengeId found');
        alert('No challenge selected');
        return;
    }

    const betAmount = currentChallengeBet;
    console.log('⚔️ [spendCoinsToJoinChallenge] Joining:', challengeId, 'Bet:', betAmount);

    const btn = document.getElementById('buy-challenge-pass-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Joining...';
    }

    try {
        // Use atomic join RPC combining coin debit and participant status update
        console.log('⚔️ [spendCoinsToJoinChallenge] Calling join_wellness_challenge RPC...');
        const { data: result, error: rpcError } = await window.supabaseClient.rpc('join_wellness_challenge', {
            p_challenge_id: challengeId,
            p_user_id: window.currentUser.id,
            p_weight_goal: window._pendingWeightGoal || 'lose'
        });

        if (rpcError) {
            console.error('⚔️ [spendCoinsToJoinChallenge] RPC ERROR:', rpcError);
            throw rpcError;
        }

        if (result && result.error) {
            console.warn('⚔️ [spendCoinsToJoinChallenge] RPC Error Result:', result.error);
            if (result.error === 'insufficient_coins') {
                closeChallengePassModal();
                if (typeof openCoinShop === 'function') openCoinShop();
                if (typeof showToast === 'function') {
                    showToast('Not enough coins to join this challenge!', 'error');
                } else {
                    alert('Not enough coins! You need ' + betAmount.toLocaleString() + ' coins to join.');
                }
            } else if (result.error === 'already_joined') {
                closeChallengePassModal();
                if (typeof loadHomeChallenges === 'function') loadHomeChallenges();
                if (typeof showToast === 'function') {
                    showToast('You\'ve already joined this challenge!', 'info');
                } else {
                    alert('You\'ve already joined this challenge!');
                }
            } else if (result.error === 'invalid_status') {
                closeChallengePassModal();
                if (typeof showToast === 'function') {
                    showToast('This challenge is no longer accepting new participants.', 'error');
                } else {
                    alert('This challenge is no longer accepting new participants.');
                }
            } else {
                if (typeof showToast === 'function') {
                    showToast(result.message || 'Failed to join challenge. Please try again.', 'error');
                } else {
                    alert('Failed to join challenge: ' + (result.message || result.error));
                }
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = 'Spend 🪙 ' + betAmount.toLocaleString() + ' Coins &amp; Join';
                }
            }
            return;
        }

        console.log('⚔️ [spendCoinsToJoinChallenge] Success. Balance:', result.new_balance);

        // Update displayed balance
        if (result.new_balance !== undefined) {
             updateCoinBalanceDisplay(result.new_balance);
        }

        // Close modal
        closeChallengePassModal();
        pendingChallengeId = null;

        // Refresh challenges on home screen
        if (typeof loadHomeChallenges === 'function') loadHomeChallenges();

        if (typeof showToast === 'function') {
            showToast('Challenge accepted! Good luck! 🏆', 'success');
        } else {
            alert('Challenge accepted! Good luck!');
        }

    } catch (error) {
        console.error('⚔️ [spendCoinsToJoinChallenge] CRITICAL ERROR:', error);
        // Surface the real Supabase error so PostgREST permission/schema-cache
        // issues (which previously hid behind a generic alert) are diagnosable
        // both for the user and in support reports.
        const detail = (error && (error.message || error.hint || error.code)) || '';
        const userMessage = detail
            ? 'Failed to join challenge: ' + detail
            : 'Failed to join challenge. Please try again.';
        if (typeof showToast === 'function') {
            showToast(userMessage, 'error');
        } else {
            alert(userMessage);
        }
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Spend 🪙 ' + betAmount.toLocaleString() + ' Coins &amp; Join';
        }
    }
}

// Coin balance management
async function loadCoinBalance() {
    console.log('🪙 [loadCoinBalance] START');
    try {
        const { data, error } = await window.supabaseClient
            .rpc('get_coin_balance', { user_uuid: window.currentUser.id });
        if (error) throw error;
        const balance = data || 0;
        updateCoinBalanceDisplay(balance);
        return balance;
    } catch (e) {
        console.error('Error loading coin balance:', e);
        return 0;
    }
}

function updateCoinBalanceDisplay(balance) {
    const displays = ['coin-balance-display', 'coin-shop-balance', 'challenge-modal-coin-balance'];
    displays.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = balance.toLocaleString();
    });
    // Sync all header coin widgets
    document.querySelectorAll('.coin-balance-sync').forEach(el => {
        el.textContent = balance.toLocaleString();
    });
}

// Coin shop functions
function openCoinShop() {
    const modal = document.getElementById('coin-shop-modal');
    if (modal) {
        modal.style.display = 'flex';
        loadCoinBalance();
        // Show "Restore Purchases" button on native platforms (required by Apple)
        const restoreRow = document.getElementById('restore-purchases-row');
        if (restoreRow && window.Platform && window.Platform.isNative()) {
            restoreRow.style.display = 'block';
        }
    }
}

// Restore purchases (Apple requires this)
async function restoreIAPPurchases() {
    if (!window.NativeIAP) return;
    try {
        showToast('Restoring purchases...', 'info');
        const result = await window.NativeIAP.restorePurchases();
        const count = result?.purchases?.length || 0;
        showToast(count > 0 ? count + ' purchase(s) restored!' : 'No purchases to restore.', count > 0 ? 'success' : 'info');
    } catch (err) {
        console.error('Restore failed:', err);
        alert('Failed to restore purchases. Please try again.');
    }
}

// Returns 2 if the current user is in any active challenge, 1 otherwise.
// Non-additive: being in multiple challenges still only gives 2x, never more.
async function getXPMultiplier() {
    try {
        if (!window.currentUser || !window.supabaseClient) return 1;
        const { data } = await window.supabaseClient
            .from('challenge_participants')
            .select('challenge_id, challenges!inner(status)')
            .eq('user_id', window.currentUser.id)
            .eq('status', 'accepted')
            .eq('challenges.status', 'active')
            .limit(1);
        return (data && data.length > 0) ? 2 : 1;
    } catch {
        return 1;
    }
}
window.getXPMultiplier = getXPMultiplier;

function closeCoinShop() {
    const modal = document.getElementById('coin-shop-modal');
    if (modal) modal.style.display = 'none';
}

async function buyCoinPack(packId) {
    try {
        // Native app (App Store / Play Store): use IAP
        if (window.Platform && window.Platform.isNative()) {
            const result = await purchaseCoinPack(packId);
            if (result && result.cancelled) return;
            return;
        }

        // Web (website): use Stripe
        const response = await fetch('/.netlify/functions/create-coin-pack-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: window.currentUser.id,
                email: window.currentUser.email,
                packId: packId
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const { error } = await window.stripe.redirectToCheckout({
            sessionId: data.sessionId
        });
        if (error) throw error;

    } catch (error) {
        console.error('Error buying coin pack:', error);
        alert('Failed to start checkout. Please try again.');
    }
}

// Decline challenge invitation
async function declineChallengeInvite(challengeId) {
    console.log('⚔️ [declineChallengeInvite] called for:', challengeId);
    if (!confirm('Are you sure you want to decline this challenge?')) {
        console.log('⚔️ [declineChallengeInvite] User cancelled confirmation');
        return;
    }

    try {
        console.log('⚔️ [declineChallengeInvite] Updating participant status to declined');
        const { error } = await window.supabaseClient
            .from('challenge_participants')
            .update({ status: 'declined' })
            .eq('challenge_id', challengeId)
            .eq('user_id', window.currentUser.id);

        if (error) {
            console.error('⚔️ [declineChallengeInvite] ERROR:', error);
            throw error;
        }

        console.log('⚔️ [declineChallengeInvite] Success');
        // Refresh challenges on home screen
        setTimeout(() => {
            if (typeof loadHomeChallenges === 'function') loadHomeChallenges();
        }, 1000);

    } catch (error) {
        console.error('⚔️ [declineChallengeInvite] CRITICAL ERROR:', error);
    }
}

// Open challenge leaderboard
async function openChallengeLeaderboard(challengeId) {
    currentChallengeId = challengeId;
    // Also cache on window as a safety net for handlers that can't see the
    // module-scoped `let` (e.g. claimChallengeReward in dashboard-script-15).
    window._currentChallengeIdForClaim = challengeId;
    const modal = document.getElementById('challenge-leaderboard-modal');
    if (!modal) return;

    modal.style.display = 'block';
    pushNavigationState('challenge-leaderboard-modal', closeChallengeLeaderboard);

    try {
        // Get challenge details
        const { data: challenge } = await window.supabaseClient
            .from('challenges')
            .select('*')
            .eq('id', challengeId)
            .single();

        if (challenge) {
            // Store challenge type for chart labels
            window._currentChallengeType = challenge.challenge_type || 'xp';
            // Store rare reward id so the "Claim Reward" button can use it
            window._currentChallengeRareRewardId = challenge.rare_reward_id || null;

            const cType = CHALLENGE_TYPES[challenge.challenge_type] || CHALLENGE_TYPES.xp;
            document.getElementById('challenge-leaderboard-title').textContent = `${cType.emoji} ${challenge.name}`;

            // Show challenge type info banner
            const infoBanner = document.getElementById('challenge-type-info-banner');
            if (infoBanner) {
                infoBanner.innerHTML = `
                    <span style="font-size: 1.3rem;">${cType.emoji}</span>
                    <div>
                        <div style="font-weight: 700; font-size: 0.9rem; color: white;">${cType.name} Challenge</div>
                        <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8);">${cType.desc}</div>
                    </div>
                `;
                infoBanner.style.display = 'flex';
            }

            // Show rare reward preview so participants know what they're competing for
            renderChallengeRarePreview(challenge.rare_reward_id);

            const endDate = new Date(challenge.end_date);
            const now = new Date();
            const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));

            // Completion banner & button toggling
            const completeBanner = document.getElementById('challenge-complete-banner');
            const daysRemainingEl = document.getElementById('challenge-days-remaining');
            const leaveBtnContainer = document.getElementById('challenge-leave-btn-container');
            const exitBtnContainer = document.getElementById('challenge-exit-btn-container');

            const isCompleted = challenge.status === 'completed' || (daysRemaining === 0 && endDate < now);

            if (isCompleted) {
                // Hide days remaining, show exit button instead of leave
                if (daysRemainingEl) daysRemainingEl.style.display = 'none';
                if (leaveBtnContainer) leaveBtnContainer.style.display = 'none';
                if (exitBtnContainer) exitBtnContainer.style.display = 'block';

                // Defer the completion banner until AFTER leaderboard loads,
                // so we can use actual rank data instead of potentially-null winner_id.
                // Store reference for updateCompletionBanner() below.
                window._pendingCompletionBanner = true;
            } else {
                window._pendingCompletionBanner = false;
                // Active challenge — hide banner, show days remaining & leave button
                if (completeBanner) completeBanner.style.display = 'none';
                if (daysRemainingEl) daysRemainingEl.style.display = 'block';
                if (leaveBtnContainer) leaveBtnContainer.style.display = 'block';
                if (exitBtnContainer) exitBtnContainer.style.display = 'none';
            }

            if (challenge.status === 'completed') {
                // Already finalized — no action needed
            } else if (daysRemaining === 0 && endDate < now) {
                if (daysRemainingEl) {
                    daysRemainingEl.textContent = '⏰ Challenge ended — finalizing results...';
                    daysRemainingEl.style.color = '#f59e0b';
                    daysRemainingEl.style.display = 'block';
                }
                // Refresh all participants' points before finalizing so the winner is correct
                if (!challenge.winner_rewarded && typeof completeAndRewardChallenge === 'function') {
                    try {
                        const { data: allParticipants } = await window.supabaseClient
                            .from('challenge_participants')
                            .select('user_id')
                            .eq('challenge_id', challenge.id)
                            .eq('status', 'accepted');
                        if (allParticipants) {
                            for (const p of allParticipants) {
                                await window.supabaseClient.rpc('update_challenge_participant_points', { user_uuid: p.user_id });
                            }
                        }
                    } catch (e) {
                        console.warn('⚔️ Could not refresh participant points:', e);
                    }
                    await completeAndRewardChallenge(challenge.id);
                }
            } else {
                document.getElementById('challenge-days-remaining').textContent = `${daysRemaining} days remaining`;
                document.getElementById('challenge-days-remaining').style.color = '#0369a1';
            }
        }

        // Get leaderboard — try v2 first (includes auto-point update), fall back to v1
        console.log('⚔️ [openChallengeLeaderboard] Fetching leaderboard from RPC get_challenge_leaderboard_v2...');
        let leaderboard;
        const { data: lbV2, error: lbV2Error } = await window.supabaseClient
            .rpc('get_challenge_leaderboard_v2', { p_challenge_id: challengeId, p_user_id: window.currentUser.id });

        if (lbV2Error) {
            // v1 does not return raw_points, which makes weight_loss challenges
            // look like "No weigh-ins yet" for every row. Log the actual v2
            // error loudly so we can tell what's wrong, then fall back to v1
            // only so the rest of the leaderboard still renders.
            console.error('⚔️ [openChallengeLeaderboard] v2 RPC failed — this is why weight_loss challenges show "No weigh-ins yet". Error:', lbV2Error);
            const { data: lbV1, error: lbV1Error } = await window.supabaseClient
                .rpc('get_challenge_leaderboard', { challenge_uuid: challengeId });
            if (lbV1Error) {
                // Both v2 and v1 failed — log and fall through to the direct
                // challenge_participants query below so the modal still
                // renders SOMETHING instead of staying blank.
                console.error('⚔️ [openChallengeLeaderboard] v1 RPC also failed:', lbV1Error);
                leaderboard = null;
            } else {
                // Patch raw_points onto each v1 row by reading current_points
                // directly from challenge_participants, so weight_loss display
                // still works in fallback mode.
                try {
                    const { data: rawRows } = await window.supabaseClient
                        .from('challenge_participants')
                        .select('user_id, current_points, weight_goal')
                        .eq('challenge_id', challengeId)
                        .eq('status', 'accepted');
                    const rawByUser = {};
                    (rawRows || []).forEach(r => { rawByUser[r.user_id] = r; });
                    (lbV1 || []).forEach(row => {
                        const r = rawByUser[row.user_id];
                        if (r) {
                            row.raw_points = r.current_points;
                            row.weight_goal = r.weight_goal;
                        }
                    });
                } catch (patchErr) {
                    console.warn('⚔️ Could not patch raw_points onto v1 fallback:', patchErr);
                }
                leaderboard = lbV1;
            }
        } else {
            leaderboard = lbV2;
        }

        // Last-ditch fallback: if both RPCs failed or returned nothing, build
        // a basic leaderboard directly from challenge_participants. This
        // guarantees the modal never renders completely empty just because
        // the SQL functions aren't deployed or errored. Users rows are
        // fetched via get_friends_with_status (SECURITY DEFINER) so RLS on
        // public.users doesn't strip names/photos for non-self participants.
        if (!leaderboard || leaderboard.length === 0) {
            console.warn('⚔️ [openChallengeLeaderboard] RPCs returned no rows — using direct-query fallback.');
            try {
                const { data: directRows } = await window.supabaseClient
                    .from('challenge_participants')
                    .select('user_id, challenge_points, current_points, milestone_progress, weight_goal')
                    .eq('challenge_id', challengeId)
                    .eq('status', 'accepted')
                    .order('challenge_points', { ascending: false });

                if (directRows && directRows.length > 0) {
                    // Try to resolve participant names/photos via the friends
                    // RPC (SECURITY DEFINER). Worst case, non-friend rows
                    // render as 'Participant' with initials.
                    const nameById = {};
                    const photoById = {};
                    if (window.currentUser?.id) {
                        nameById[window.currentUser.id] = window.currentUser.name || 'You';
                        photoById[window.currentUser.id] = window.currentUser.profile_photo || null;
                    }
                    try {
                        const { data: friends } = await window.supabaseClient
                            .rpc('get_friends_with_status', { user_uuid: window.currentUser.id });
                        (friends || []).forEach(f => {
                            if (f.friend_id || f.id) {
                                const id = f.friend_id || f.id;
                                nameById[id] = f.friend_name || f.name || nameById[id];
                                photoById[id] = f.friend_photo || f.profile_photo || photoById[id] || null;
                            }
                        });
                    } catch (_) { /* friends lookup is best-effort */ }

                    const creatorId = (challenge && challenge.creator_id) || null;
                    const cType = (challenge && challenge.challenge_type) || 'xp';
                    leaderboard = directRows.map((r, i) => ({
                        rank: i + 1,
                        user_id: r.user_id,
                        user_name: nameById[r.user_id] || 'Participant',
                        user_photo: photoById[r.user_id] || null,
                        challenge_points: r.challenge_points || 0,
                        is_creator: r.user_id === creatorId,
                        challenge_type: cType,
                        unit_label: null,
                        milestone_criteria: (challenge && challenge.milestone_criteria) || null,
                        milestone_progress: r.milestone_progress || null,
                        raw_points: r.current_points,
                        weight_goal: r.weight_goal || null,
                    }));
                }
            } catch (directErr) {
                console.warn('⚔️ Direct-query fallback failed:', directErr);
            }
        }

        leaderboard = leaderboard || [];

        // Patch the current user's row for steps/sleep/weight_loss challenges
        // so the leaderboard reflects fresh source data even when the SQL
        // function is stale. We can only fix the calling user's row — RLS
        // prevents reading other participants' wearable / weigh-in tables —
        // but the user's own score is the most visible thing on the
        // leaderboard.
        try {
            if (leaderboard && leaderboard.length > 0 && challenge && window.currentUser?.id) {
                const myRow = leaderboard.find(r => r.user_id === window.currentUser.id);
                let patched = false;

                if (myRow && (challenge.challenge_type === 'steps' || challenge.challenge_type === 'sleep')) {
                    const computed = await computeWearableChallengeScoreFromDB(
                        challenge.challenge_type, challenge.start_date, challenge.end_date
                    );
                    if (computed != null && computed > (Number(myRow.challenge_points) || 0)) {
                        myRow.challenge_points = computed;
                        patched = true;
                    }
                }

                if (myRow && challenge.challenge_type === 'weight_loss') {
                    // Resolve the user's weight_goal from challenge_participants
                    // so the direction-aware recompute is correct.
                    let weightGoal = myRow.weight_goal;
                    if (!weightGoal) {
                        try {
                            const { data: cp } = await window.supabaseClient
                                .from('challenge_participants')
                                .select('weight_goal')
                                .eq('challenge_id', challengeId)
                                .eq('user_id', window.currentUser.id)
                                .maybeSingle();
                            weightGoal = cp?.weight_goal || 'lose';
                        } catch (_) {
                            weightGoal = 'lose';
                        }
                    }
                    const result = await computeWeightLossFromDB(
                        challenge.start_date, challenge.end_date, weightGoal
                    );
                    if (result) {
                        // Replace null / legacy sentinel raw_points with the
                        // real signed grams delta so formatChallengePoints
                        // renders "+/- X kg" instead of "No weigh-ins yet".
                        const rawIsSentinel = myRow.raw_points == null ||
                            myRow.raw_points === -9998 || myRow.raw_points === -9999 ||
                            myRow.raw_points === -99999999;
                        if (rawIsSentinel) {
                            myRow.raw_points = result.rawPointsGrams;
                            patched = true;
                        }
                        if (result.rankingScore > (Number(myRow.challenge_points) || 0)) {
                            myRow.challenge_points = result.rankingScore;
                            patched = true;
                        }
                        if (!myRow.weight_goal) myRow.weight_goal = weightGoal;
                    }
                }

                if (patched) {
                    // Re-sort + re-rank so the podium reflects the patched score.
                    leaderboard.sort((a, b) =>
                        (Number(b.challenge_points) || 0) - (Number(a.challenge_points) || 0)
                    );
                    leaderboard.forEach((row, i) => { row.rank = i + 1; });
                }
            }
        } catch (patchErr) {
            console.warn('⚔️ Leaderboard row patch failed:', patchErr);
        }

        // Update podium
        updatePodium(leaderboard || []);

        // Update full rankings
        updateFullRankings(leaderboard || []);

        // Now that leaderboard is loaded, show completion banner using actual rank data
        if (window._pendingCompletionBanner && leaderboard && leaderboard.length > 0) {
            updateCompletionBanner(leaderboard);
        }

    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

// Render the "Winner's Prize" preview card inside the challenge leaderboard.
// Shows participants which rare skin the winner of the challenge will receive.
function renderChallengeRarePreview(rareRewardId) {
    const preview = document.getElementById('challenge-leaderboard-rare-preview');
    if (!preview) return;

    const collection = window.RARE_COLLECTION || [];
    const tiers = window.RARE_TIERS || {};
    const rare = rareRewardId ? collection.find(r => r.id === rareRewardId) : null;

    if (!rare) {
        preview.style.display = 'none';
        return;
    }

    const tier = tiers[rare.tier] || tiers.COMMON || { label: 'RARE', gradient: 'linear-gradient(135deg, #6b7280, #4b5563)', color: '#6b7280' };

    const emojiEl = document.getElementById('challenge-leaderboard-rare-emoji');
    const nameEl = document.getElementById('challenge-leaderboard-rare-name');
    const tierEl = document.getElementById('challenge-leaderboard-rare-tier');
    const descEl = document.getElementById('challenge-leaderboard-rare-desc');

    if (emojiEl) emojiEl.textContent = rare.emoji || '🏆';
    if (nameEl) nameEl.textContent = rare.name || 'Mystery Rare';
    if (tierEl) {
        tierEl.textContent = tier.label || 'RARE';
        tierEl.style.background = tier.gradient || 'linear-gradient(135deg, #6b7280, #4b5563)';
    }
    if (descEl) descEl.textContent = rare.desc || '';

    // Retint the preview border/glow to match the tier colour
    if (tier.color) {
        preview.style.border = `1px solid ${tier.color}55`;
        preview.style.boxShadow = `0 4px 20px ${tier.color}26`;
    }

    preview.style.display = 'block';
}

// Show the completion banner using leaderboard data to determine winner
function updateCompletionBanner(leaderboard) {
    const completeBanner = document.getElementById('challenge-complete-banner');
    if (!completeBanner) return;

    // Determine if current user won by checking if they're rank 1
    const rank1 = leaderboard.find(p => p.rank === 1);
    const isWinner = rank1 && rank1.user_id === window.currentUser?.id;

    completeBanner.style.display = 'block';
    const iconEl = document.getElementById('challenge-complete-icon');
    const headlineEl = document.getElementById('challenge-complete-headline');
    const subtitleEl = document.getElementById('challenge-complete-subtitle');

    const claimBtn = document.getElementById('challenge-claim-reward-btn');

    if (isWinner) {
        if (iconEl) iconEl.textContent = '🏆';
        if (headlineEl) {
            headlineEl.textContent = 'YOU WON!';
            headlineEl.style.color = '#4ade80';
            headlineEl.style.textShadow = '0 0 20px rgba(74,222,128,0.4)';
        }
        if (subtitleEl) subtitleEl.textContent = 'Congratulations, champion! 🎉';
        // Show the "Claim Reward" button as a fallback in case the user
        // missed the unlock celebration modal earlier. Only show it if the
        // challenge actually has a rare skin attached — otherwise the button
        // would do nothing visible when pressed.
        if (claimBtn) {
            const hasRare = !!window._currentChallengeRareRewardId;
            claimBtn.style.display = hasRare ? 'inline-block' : 'none';
        }
    } else {
        if (claimBtn) claimBtn.style.display = 'none';
        if (iconEl) iconEl.textContent = '⚔️';
        if (headlineEl) {
            headlineEl.textContent = 'CHALLENGE OVER';
            headlineEl.style.color = '#94a3b8';
            headlineEl.style.textShadow = 'none';
        }
        if (subtitleEl) subtitleEl.textContent = 'Better luck next time — get back in there! 💪';
    }

    // Hide the "finalizing" text once banner is shown
    const daysRemainingEl = document.getElementById('challenge-days-remaining');
    if (daysRemainingEl) daysRemainingEl.style.display = 'none';
}

// Refresh leaderboard data and banner after a challenge has been completed
async function refreshLeaderboardAfterCompletion(challengeId) {
    const modal = document.getElementById('challenge-leaderboard-modal');
    if (!modal || modal.style.display !== 'block') return;

    try {
        const { data: lb } = await window.supabaseClient
            .rpc('get_challenge_leaderboard_v2', { p_challenge_id: challengeId, p_user_id: window.currentUser.id });
        if (lb && lb.length > 0) {
            updatePodium(lb);
            updateFullRankings(lb);
            updateCompletionBanner(lb);
        }

        // Update buttons for completed state
        const leaveBtnContainer = document.getElementById('challenge-leave-btn-container');
        const exitBtnContainer = document.getElementById('challenge-exit-btn-container');
        const daysRemainingEl = document.getElementById('challenge-days-remaining');
        if (leaveBtnContainer) leaveBtnContainer.style.display = 'none';
        if (exitBtnContainer) exitBtnContainer.style.display = 'block';
        if (daysRemainingEl) daysRemainingEl.style.display = 'none';
    } catch (e) {
        console.warn('⚔️ Could not refresh leaderboard after completion:', e);
    }
}

// Update podium display
function updatePodium(leaderboard) {
    const positions = [
        { rank: 1, prefix: '1st' },
        { rank: 2, prefix: '2nd' },
        { rank: 3, prefix: '3rd' }
    ];

    // Get challenge type from first leaderboard entry (all share same type)
    const challengeType = leaderboard[0]?.challenge_type || 'xp';

    positions.forEach(pos => {
        const participant = leaderboard.find(p => p.rank === pos.rank);

        // Simpler approach - just use the rank number
        const suffix = pos.rank === 1 ? '1st' : pos.rank === 2 ? '2nd' : '3rd';
        const podiumNameEl = document.getElementById(`podium-${suffix}-name`);
        const podiumPhotoEl = document.getElementById(`podium-${suffix}-photo`);
        const podiumPtsEl = document.getElementById(`podium-${suffix}-pts`);

        if (participant) {
            if (podiumNameEl) podiumNameEl.textContent = participant.user_name;
            if (podiumPtsEl) podiumPtsEl.textContent = formatChallengePoints(participant.challenge_points, challengeType, participant.milestone_progress, participant.milestone_criteria, participant.raw_points);
            if (podiumPhotoEl) {
                const initials = (participant.user_name || '?').charAt(0).toUpperCase();
                podiumPhotoEl.innerHTML = participant.user_photo
                    ? `<img src="${participant.user_photo}" style="width: 100%; height: 100%; object-fit: cover;">`
                    : `<span style="font-size: 1.2rem; color: white; font-weight: 700;">${initials}</span>`;
                podiumPhotoEl.style.background = participant.user_photo ? 'transparent' : 'linear-gradient(135deg, #6366f1, #8b5cf6)';
            }
        } else {
            if (podiumNameEl) podiumNameEl.textContent = '--';
            if (podiumPtsEl) podiumPtsEl.textContent = '--';
        }
    });
}

// Update full rankings list
function updateFullRankings(leaderboard) {
    const container = document.getElementById('challenge-full-rankings');
    if (!container) return;

    if (leaderboard.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.4); padding: 20px; font-size: 0.9rem;">No participants yet</div>';
        return;
    }

    // Get challenge type from first entry
    const challengeType = leaderboard[0]?.challenge_type || 'xp';
    const topPoints = leaderboard[0]?.challenge_points || 1;

    const rankBadge = (rank) => {
        if (rank === 1) return `<span style="font-size: 1.1rem;">🥇</span>`;
        if (rank === 2) return `<span style="font-size: 1.1rem;">🥈</span>`;
        if (rank === 3) return `<span style="font-size: 1.1rem;">🥉</span>`;
        return `<span style="font-size: 0.85rem; font-weight: 700; color: rgba(255,255,255,0.4); width: 24px; text-align: center; display: inline-block;">${rank}</span>`;
    };

    container.innerHTML = leaderboard.map(participant => {
        const initials = (participant.user_name || '?').charAt(0).toUpperCase();
        const isCurrentUser = participant.user_id === window.currentUser?.id;
        const formattedPts = formatChallengePoints(participant.challenge_points, challengeType, participant.milestone_progress, participant.milestone_criteria, participant.raw_points);
        const pct = Math.max(4, Math.round((participant.challenge_points / topPoints) * 100));
        const barColor = participant.rank === 1 ? '#f59e0b' : participant.rank === 2 ? '#94a3b8' : participant.rank === 3 ? '#d97706' : '#6366f1';

        return `
            <div style="display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); ${isCurrentUser ? 'background: rgba(99,102,241,0.12); margin: 0 -16px; padding: 10px 16px; border-radius: 10px; border-bottom: none; margin-bottom: 4px;' : ''}">
                <div style="width: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${rankBadge(participant.rank)}</div>
                <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1rem; overflow: hidden; flex-shrink: 0; ${isCurrentUser ? 'border: 2px solid #818cf8;' : ''}">
                    ${participant.user_photo ? `<img src="${participant.user_photo}" style="width: 100%; height: 100%; object-fit: cover;">` : initials}
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 0.88rem; color: ${isCurrentUser ? 'white' : 'rgba(255,255,255,0.85)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${participant.user_name}${isCurrentUser ? ' <span style="font-size: 0.7rem; background: rgba(99,102,241,0.5); padding: 1px 5px; border-radius: 4px; font-weight: 700;">YOU</span>' : ''}</div>
                    <div style="margin-top: 5px; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;">
                        <div style="height: 100%; width: ${pct}%; background: ${barColor}; border-radius: 2px; transition: width 0.6s ease;"></div>
                    </div>
                </div>
                <div style="font-weight: 700; font-size: 0.88rem; color: ${isCurrentUser ? 'white' : 'rgba(255,255,255,0.8)'}; flex-shrink: 0; margin-left: 6px;">${formattedPts}</div>
            </div>
        `;
    }).join('');
}


// Close challenge leaderboard
function closeChallengeLeaderboard() {
    const modal = document.getElementById('challenge-leaderboard-modal');
    if (modal) modal.style.display = 'none';
    const preview = document.getElementById('challenge-leaderboard-rare-preview');
    if (preview) preview.style.display = 'none';
    currentChallengeId = null;
    window._currentChallengeIdForClaim = null;
    window._currentChallengeRareRewardId = null;
}

// Leave current challenge
async function leaveCurrentChallenge() {
    console.log('⚔️ [leaveCurrentChallenge] called for:', currentChallengeId);
    if (!currentChallengeId) {
        console.error('⚔️ [leaveCurrentChallenge] No currentChallengeId set');
        return;
    }
    
    if (!confirm('Are you sure you want to leave this challenge? If you are still pending start, your entry fee will be refunded. If you\'re the last participant, the challenge will be cancelled.')) {
        console.log('⚔️ [leaveCurrentChallenge] User cancelled confirmation');
        return;
    }

    try {
        console.log('⚔️ [leaveCurrentChallenge] Calling leave_wellness_challenge RPC...');
        const { data, error } = await window.supabaseClient
            .rpc('leave_wellness_challenge', {
                p_challenge_id: currentChallengeId,
                p_user_id: window.currentUser.id
            });

        if (error) {
            console.error('⚔️ [leaveCurrentChallenge] RPC ERROR:', error);
            throw error;
        }
        
        if (data && data.error) {
            console.error('⚔️ [leaveCurrentChallenge] DB LOGIC ERROR:', data);
            throw new Error(data.message || data.error);
        }

        console.log('⚔️ [leaveCurrentChallenge] RPC Success:', data);

        closeChallengeLeaderboard();

        if (data?.status === 'cancelled') {
            if (typeof showToast === 'function') showToast('Challenge cancelled. Entry fees refunded.', 'success');
            else alert('The challenge has been cancelled. Any entry fees have been refunded.');
        } else {
            if (typeof showToast === 'function') showToast('You have left the challenge.', 'success');
            else alert('You have left the challenge.');
        }

        // Refresh challenges on home screen immediately
        if (typeof loadHomeChallenges === 'function') await loadHomeChallenges();
        if (typeof loadCoinBalance === 'function') loadCoinBalance();

    } catch (error) {
        console.error('⚔️ [leaveCurrentChallenge] CRITICAL ERROR:', error);
        
        const errorMsg = error.message || 'Failed to leave challenge';
        
        if (typeof showToast === 'function') {
            showToast(errorMsg, 'error');
        } else {
            alert(errorMsg);
        }
    }
}

// Exit a COMPLETED challenge: marks participant as 'left' server-side so the
// card disappears from the home screen, then closes the leaderboard modal.
// No confirmation prompt — the challenge is already over.
window.exitCompletedChallenge = async function() {
    console.log('⚔️ [exitCompletedChallenge] called for:', currentChallengeId);
    if (!currentChallengeId) { closeChallengeLeaderboard(); return; }
    const challengeIdToExit = currentChallengeId;
    try {
        const { data, error } = await window.supabaseClient
            .rpc('leave_wellness_challenge', {
                p_challenge_id: challengeIdToExit,
                p_user_id: window.currentUser.id
            });
        if (error) throw error;
        if (data && data.error) throw new Error(data.message || data.error);
        console.log('⚔️ [exitCompletedChallenge] RPC Success:', data);
    } catch (err) {
        console.error('⚔️ [exitCompletedChallenge] ERROR:', err);
        // Fall through — still close the modal and refresh so UI doesn't get stuck.
    }
    closeChallengeLeaderboard();
    if (typeof loadHomeChallenges === 'function') await loadHomeChallenges();
};

// Global handler for leaving challenge directly from card
window.leaveChallengeFromCard = async function(event, challengeId) {
    let btn = null;
    if (event) {
        event.stopPropagation(); // prevent opening leaderboard
        btn = event.currentTarget || event.target;
    }
    
    currentChallengeId = challengeId;
    
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = 'Updating...';
        btn.style.opacity = '0.7';
        btn.disabled = true;
    }
    
    await leaveCurrentChallenge();
    
    if (btn && document.body.contains(btn)) {
        btn.innerHTML = originalText;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
};


// ============================================================
// CHALLENGE TYPE PROGRESS TRACKING
// Ensures all 8 challenge types get their scores updated
// when the user performs relevant actions.
// ============================================================

// Unit labels for each challenge type (matches DB get_challenge_unit)

// Format challenge points with appropriate unit for display
// For weight_loss, rawPoints = current_points from DB = weight change in grams:
//   null      = no weigh-ins found at all → "No weigh-ins yet"
//   0         = has a baseline weigh-in, no progress yet
//   negative  = weight lost (e.g. -2400 = lost 2.4 kg)
//   positive  = weight gained (e.g. +1800 = gained 1.8 kg)
function formatChallengePoints(points, challengeType, milestoneProgress, milestoneCriteria, rawPoints) {
    if (challengeType === 'weight_loss') {
        // Show "No weigh-ins yet" only when the user truly has no weigh-ins
        // on file. Exact-match legacy sentinels from older SQL migrations so
        // a legitimate weight loss > ~10 kg (e.g. -10000 grams) is not
        // mistaken for a sentinel.
        //   null       → current SQL, no weigh-ins anywhere
        //   -9998/-9999 → fix_weight_loss_display.sql (tenths-of-percent)
        //   -99999999  → weight_loss_goal_direction.sql (pre-challenge only)
        if (rawPoints == null ||
            rawPoints === -9998 || rawPoints === -9999 ||
            rawPoints === -99999999) {
            return 'No weigh-ins yet';
        }
        const deltaKg = rawPoints / 1000;
        const preferLbs = typeof localStorage !== 'undefined' &&
            localStorage.getItem('weightUnitPreference') === 'lbs';
        if (preferLbs) {
            const deltaLbs = deltaKg * 2.20462;
            const sign = deltaLbs > 0 ? '+' : '';
            return `${sign}${deltaLbs.toFixed(1)} lbs`;
        }
        const sign = deltaKg > 0 ? '+' : '';
        return `${sign}${deltaKg.toFixed(1)} kg`;
    }
    // Milestone challenges: show actual values or achievement status
    if (challengeType === 'milestone') {
        if (points >= 100) return '✅ ACHIEVED';
        if (milestoneProgress && milestoneCriteria) {
            const metric = milestoneCriteria.metric || 'weight_x_reps';
            if (metric === 'reps_at_bodyweight') {
                return `${milestoneProgress.best_reps || 0} / ${milestoneCriteria.target_reps} reps`;
            } else {
                return `${milestoneProgress.best_weight_kg || 0}kg / ${milestoneCriteria.target_weight_kg}kg`;
            }
        }
        return `${points}%`;
    }
    const unit = CHALLENGE_UNIT_LABELS[challengeType] || 'pts';
    if (challengeType === 'volume' && points >= 1000) {
        return `${(points / 1000).toFixed(1)}t`;
    }
    if (challengeType === 'steps' && points >= 10000) {
        return `${(points / 1000).toFixed(1)}k ${unit}`;
    }
    if (challengeType === 'sleep') {
        // Convert minutes to hours display
        const hours = Math.floor(points / 60);
        const mins = points % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }
    return `${points.toLocaleString()} ${unit}`;
}

// Recompute the current user's score for a steps/sleep challenge by reading
// the wearable tables directly. Mirrors the multi-source GREATEST-per-day
// logic used by update_challenge_participant_points so the UI is correct
// even if the SQL function is stale (e.g. an older deployment that only
// reads from oura_*). Returns the total score (steps for 'steps', minutes
// for 'sleep'), or null if the challenge type isn't wearable-backed or
// supabase isn't ready.
async function computeWearableChallengeScoreFromDB(challengeType, startDate, endDate) {
    if (challengeType !== 'steps' && challengeType !== 'sleep') return null;
    if (!startDate) return null;
    if (!window.currentUser?.id || !window.supabaseClient) return null;

    const userId = window.currentUser.id;
    // Clamp to today so future-dated end_dates don't pull empty rows.
    const todayStr = new Date().toISOString().split('T')[0];
    const effectiveEnd = (endDate && endDate < todayStr) ? endDate : todayStr;

    const bestByDate = {};
    const merge = (rows, valueKey) => {
        (rows || []).forEach(r => {
            const v = Number(r[valueKey]) || 0;
            if (v > (bestByDate[r.date] || 0)) bestByDate[r.date] = v;
        });
    };

    try {
        if (challengeType === 'steps') {
            const [oura, fitbit] = await Promise.all([
                window.supabaseClient.from('oura_daily_activity')
                    .select('date, steps').eq('user_id', userId)
                    .gte('date', startDate).lte('date', effectiveEnd),
                window.supabaseClient.from('fitbit_daily_activity')
                    .select('date, steps').eq('user_id', userId)
                    .gte('date', startDate).lte('date', effectiveEnd),
            ]);
            merge(oura.data, 'steps');
            merge(fitbit.data, 'steps');
        } else {
            // sleep — whoop, oura and fitbit all store one row per night
            const [whoop, oura, fitbit] = await Promise.all([
                window.supabaseClient.from('whoop_sleep')
                    .select('date, duration_minutes').eq('user_id', userId)
                    .gte('date', startDate).lte('date', effectiveEnd),
                window.supabaseClient.from('oura_sleep')
                    .select('date, total_sleep_minutes').eq('user_id', userId)
                    .gte('date', startDate).lte('date', effectiveEnd),
                window.supabaseClient.from('fitbit_sleep')
                    .select('date, duration_minutes').eq('user_id', userId)
                    .gte('date', startDate).lte('date', effectiveEnd),
            ]);
            merge(whoop.data, 'duration_minutes');
            merge(oura.data, 'total_sleep_minutes');
            merge(fitbit.data, 'duration_minutes');
        }
    } catch (err) {
        console.warn('[WearableScore] Recompute failed for', challengeType, err);
        return null;
    }

    let total = 0;
    for (const v of Object.values(bestByDate)) total += v;
    return total;
}

// Recompute the current user's score for a weight_loss challenge by reading
// daily_weigh_ins directly. Mirrors the SQL logic in fix_weight_tracking.sql:
//   - starting weight = most recent weigh-in on/before start_date
//     (fallback: first weigh-in during challenge period)
//   - current weight  = most recent weigh-in during the challenge period
//     (fallback: most recent weigh-in overall, so a user with only
//      pre-challenge weigh-ins still sees delta = 0 instead of a sentinel)
// Returns { rawPointsGrams, rankingScore } or null if the user has no
// weigh-ins at all or supabase isn't ready. rawPointsGrams is signed
// (positive = gained, negative = lost) and drives the formatted display.
// rankingScore is % toward goal × 1000 (never negative) and drives rank.
async function computeWeightLossFromDB(startDate, endDate, weightGoal) {
    if (!startDate) return null;
    if (!window.currentUser?.id || !window.supabaseClient) return null;

    const userId = window.currentUser.id;
    const todayStr = new Date().toISOString().split('T')[0];
    const effectiveEnd = (endDate && endDate < todayStr) ? endDate : todayStr;

    try {
        // Starting weight: most recent weigh-in on/before start_date
        const startBeforeRes = await window.supabaseClient
            .from('daily_weigh_ins')
            .select('weigh_in_date, weight_kg')
            .eq('user_id', userId)
            .lte('weigh_in_date', startDate)
            .order('weigh_in_date', { ascending: false })
            .limit(1);
        let startWeight = startBeforeRes.data && startBeforeRes.data[0]
            ? Number(startBeforeRes.data[0].weight_kg) : null;

        if (startWeight == null) {
            // Fallback: first weigh-in logged during the challenge period
            const startInRes = await window.supabaseClient
                .from('daily_weigh_ins')
                .select('weigh_in_date, weight_kg')
                .eq('user_id', userId)
                .gte('weigh_in_date', startDate)
                .lte('weigh_in_date', effectiveEnd)
                .order('weigh_in_date', { ascending: true })
                .limit(1);
            startWeight = startInRes.data && startInRes.data[0]
                ? Number(startInRes.data[0].weight_kg) : null;
        }

        // Current weight: most recent weigh-in during the challenge period
        const currInRes = await window.supabaseClient
            .from('daily_weigh_ins')
            .select('weigh_in_date, weight_kg')
            .eq('user_id', userId)
            .gte('weigh_in_date', startDate)
            .lte('weigh_in_date', effectiveEnd)
            .order('weigh_in_date', { ascending: false })
            .limit(1);
        let currentWeight = currInRes.data && currInRes.data[0]
            ? Number(currInRes.data[0].weight_kg) : null;

        // Fallback: most recent weigh-in overall (pre-challenge only user)
        if (currentWeight == null && startWeight != null) {
            const anyRecentRes = await window.supabaseClient
                .from('daily_weigh_ins')
                .select('weigh_in_date, weight_kg')
                .eq('user_id', userId)
                .order('weigh_in_date', { ascending: false })
                .limit(1);
            currentWeight = anyRecentRes.data && anyRecentRes.data[0]
                ? Number(anyRecentRes.data[0].weight_kg) : null;
        }

        if (startWeight == null || currentWeight == null) return null;
        if (!(startWeight > 0)) return null;

        // Signed delta in grams (positive = gained, negative = lost)
        const rawPointsGrams = Math.round((currentWeight - startWeight) * 1000);

        // Ranking score = % toward goal × 1000 (never negative)
        const goal = weightGoal === 'gain' ? 'gain' : 'lose';
        const pctChange = goal === 'gain'
            ? (currentWeight - startWeight) / startWeight
            : (startWeight - currentWeight) / startWeight;
        const rankingScore = Math.max(0, Math.round(pctChange * 1000));

        return { rawPointsGrams, rankingScore };
    } catch (err) {
        console.warn('[WeightLoss] Recompute failed:', err);
        return null;
    }
}

// Patch a list of challenge rows so that steps/sleep/weight_loss entries
// reflect the freshest data we can read client-side. Used after fetching
// from get_user_challenges_v2 (or its v1 fallback) so the home cards never
// show 0 / "No weigh-ins yet" while the source-of-truth tables already
// contain the data.
//
// Steps/sleep: mutates `pointsField` (e.g. 'user_points' or
// 'challenge_points') to MAX(existing, recomputed) so a correctly-scored
// SQL value is never downgraded.
//
// Weight_loss: mutates both `pointsField` (ranking) and `raw_points`
// (which feeds formatChallengePoints' kg/lbs display). Replaces the
// legacy -9998 / -9999 / -99999999 / null sentinels with a real value
// when the user actually has weigh-ins.
async function patchWearableChallengeScoresInPlace(rows, pointsField) {
    if (!Array.isArray(rows) || rows.length === 0) return;

    const wearableRows = rows.filter(r =>
        r && (r.challenge_type === 'steps' || r.challenge_type === 'sleep') &&
        r.start_date
    );
    const weightLossRows = rows.filter(r =>
        r && r.challenge_type === 'weight_loss' && r.start_date
    );
    if (wearableRows.length === 0 && weightLossRows.length === 0) return;

    const wearablePromises = wearableRows.map(async row => {
        const computed = await computeWearableChallengeScoreFromDB(
            row.challenge_type, row.start_date, row.end_date
        );
        if (computed == null) return;
        const existing = Number(row[pointsField]) || 0;
        if (computed > existing) {
            row[pointsField] = computed;
            // If this user is the leader (or just became the leader after the
            // recompute), bring leader_points along so the home card's "Leader"
            // line stays consistent with the user's own row.
            if (row.leader_points != null && computed > Number(row.leader_points)) {
                row.leader_points = computed;
            }
        }
    });

    const weightLossPromises = weightLossRows.map(async row => {
        const result = await computeWeightLossFromDB(
            row.start_date, row.end_date, row.weight_goal
        );
        if (!result) return;

        // Replace null / legacy sentinel raw_points with the real signed
        // grams delta so formatChallengePoints renders "+/- X kg" instead
        // of "No weigh-ins yet".
        const rawIsSentinel = row.raw_points == null ||
            row.raw_points === -9998 || row.raw_points === -9999 ||
            row.raw_points === -99999999;
        if (rawIsSentinel) {
            row.raw_points = result.rawPointsGrams;
        }

        // Ranking score: bump if the recompute is higher. Don't downgrade.
        const existing = Number(row[pointsField]) || 0;
        if (result.rankingScore > existing) {
            row[pointsField] = result.rankingScore;
            if (row.leader_points != null && result.rankingScore > Number(row.leader_points)) {
                row.leader_points = result.rankingScore;
            }
        }
    });

    await Promise.all([...wearablePromises, ...weightLossPromises]);
}

// Update challenge progress for the current user
// Called after workouts, meals, water logging, wearable sync, etc.
// The DB function handles calculating the correct score per challenge type.
async function refreshChallengeProgress() {
    try {
        if (!window.currentUser?.id || !window.supabaseClient) return;

        await window.supabaseClient.rpc('update_challenge_participant_points', {
            user_uuid: window.currentUser.id
        });

        // Check if any milestone challenge was just achieved (auto-complete)
        try {
            const { data: milestoneWins } = await window.supabaseClient
                .from('challenge_participants')
                .select('challenge_id, challenge_points, challenges!inner(id, status, challenge_type)')
                .eq('user_id', window.currentUser.id)
                .eq('status', 'accepted')
                .gte('challenge_points', 100)
                .eq('challenges.challenge_type', 'milestone')
                .eq('challenges.status', 'active');

            if (milestoneWins && milestoneWins.length > 0) {
                for (const win of milestoneWins) {
                    console.log('Milestone achieved! Auto-completing challenge:', win.challenge_id);
                    if (typeof completeAndRewardChallenge === 'function') {
                        await completeAndRewardChallenge(win.challenge_id);
                    }
                }
            }
        } catch (milestoneErr) {
            console.warn('Error checking milestone completion:', milestoneErr);
        }

        // Refresh the challenge cards on the home screen (awaited so the
        // wearable-score patch inside loadHomeChallenges is complete before
        // any follow-up UI updates run).
        if (typeof loadHomeChallenges === 'function') {
            await loadHomeChallenges();
        }

        // If the leaderboard modal is currently open, refresh its podium /
        // rankings in-place too. This matters for Fitbit "Sync now" and
        // similar wearable-sync triggers: without this, the user would have
        // to close and re-open the leaderboard to see their new score.
        try {
            const lbModal = document.getElementById('challenge-leaderboard-modal');
            const modalOpen = lbModal && lbModal.style.display === 'block';
            if (modalOpen && currentChallengeId) {
                await refreshOpenLeaderboardWithWearablePatch(currentChallengeId);
            }
        } catch (lbErr) {
            console.warn('⚔️ Could not refresh open leaderboard:', lbErr);
        }
    } catch (err) {
        console.error('Error refreshing challenge progress:', err);
    }
}

// Re-fetch an already-open challenge leaderboard and redraw its podium /
// rankings, applying the same wearable + weight_loss patches used by
// openChallengeLeaderboard. Does NOT touch modal state (display, nav stack,
// completion banners) so it's safe to call from refreshChallengeProgress
// while the user is actively viewing the modal.
async function refreshOpenLeaderboardWithWearablePatch(challengeId) {
    if (!challengeId || !window.supabaseClient || !window.currentUser?.id) return;

    // Need challenge metadata (start_date, end_date, challenge_type) to run
    // the recompute.
    const { data: challenge } = await window.supabaseClient
        .from('challenges')
        .select('challenge_type, start_date, end_date')
        .eq('id', challengeId)
        .single();

    const { data: lb, error: lbErr } = await window.supabaseClient
        .rpc('get_challenge_leaderboard_v2', { p_challenge_id: challengeId, p_user_id: window.currentUser.id });
    if (lbErr || !lb) return;

    const myRow = lb.find(r => r.user_id === window.currentUser.id);
    let patched = false;

    if (myRow && challenge && (challenge.challenge_type === 'steps' || challenge.challenge_type === 'sleep')) {
        const computed = await computeWearableChallengeScoreFromDB(
            challenge.challenge_type, challenge.start_date, challenge.end_date
        );
        if (computed != null && computed > (Number(myRow.challenge_points) || 0)) {
            myRow.challenge_points = computed;
            patched = true;
        }
    }

    if (myRow && challenge && challenge.challenge_type === 'weight_loss') {
        let weightGoal = myRow.weight_goal;
        if (!weightGoal) {
            try {
                const { data: cp } = await window.supabaseClient
                    .from('challenge_participants')
                    .select('weight_goal')
                    .eq('challenge_id', challengeId)
                    .eq('user_id', window.currentUser.id)
                    .maybeSingle();
                weightGoal = cp?.weight_goal || 'lose';
            } catch (_) {
                weightGoal = 'lose';
            }
        }
        const result = await computeWeightLossFromDB(
            challenge.start_date, challenge.end_date, weightGoal
        );
        if (result) {
            const rawIsSentinel = myRow.raw_points == null ||
                myRow.raw_points === -9998 || myRow.raw_points === -9999 ||
                myRow.raw_points === -99999999;
            if (rawIsSentinel) {
                myRow.raw_points = result.rawPointsGrams;
                patched = true;
            }
            if (result.rankingScore > (Number(myRow.challenge_points) || 0)) {
                myRow.challenge_points = result.rankingScore;
                patched = true;
            }
            if (!myRow.weight_goal) myRow.weight_goal = weightGoal;
        }
    }

    if (patched) {
        lb.sort((a, b) =>
            (Number(b.challenge_points) || 0) - (Number(a.challenge_points) || 0)
        );
        lb.forEach((row, i) => { row.rank = i + 1; });
    }

    if (typeof updatePodium === 'function') updatePodium(lb);
    if (typeof updateFullRankings === 'function') updateFullRankings(lb);
}

// Sync native HealthKit / Health Connect steps into oura_daily_activity so
// the steps challenge SQL picks them up.  Uses GREATEST so it never overwrites
// better wearable (Oura/Fitbit) data.  Safe to call on users without a native
// health connection — exits silently.
async function syncNativeStepsForChallenges() {
    if (!window.currentUser?.id || !window.supabaseClient) return;

    // If native health isn't ready yet, try a lightweight permission recheck
    // first.  This covers the race condition where this function fires before
    // NativeHealth.init() has resolved (e.g. on the 8s startup timer).
    if (!window._nativeHealthReady && window.NativeHealth?.checkPermission) {
        try { await window.NativeHealth.checkPermission(); } catch (_) { /* ignore */ }
    }
    if (!window._nativeHealthReady || !window._CapacitorHealth) return;

    try {
        // Find active steps challenges to know how far back to read
        const { data: participations } = await window.supabaseClient
            .from('challenge_participants')
            .select('challenges!inner(start_date, end_date, challenge_type, status)')
            .eq('user_id', window.currentUser.id)
            .eq('status', 'accepted')
            .eq('challenges.status', 'active')
            .eq('challenges.challenge_type', 'steps');

        if (!participations || participations.length === 0) return;

        // Work entirely in LOCAL calendar days — using toISOString() here was a
        // timezone bug: for users east of UTC it wrote today's steps into
        // yesterday's row (or skipped today entirely) because the UTC date
        // lagged the user's local date.
        const todayStr = getLocalDateString();              // 'YYYY-MM-DD' in local tz
        const [ty, tm, td] = todayStr.split('-').map(Number);
        const todayLocal = new Date(ty, tm - 1, td);        // local midnight today

        // Earliest challenge start date as a local-midnight Date
        let earliestStartStr = todayStr;
        for (const cp of participations) {
            const s = cp.challenges.start_date;             // 'YYYY-MM-DD' from Postgres
            if (s && s < earliestStartStr) earliestStartStr = s;
        }
        const [sy, sm, sd] = earliestStartStr.split('-').map(Number);
        const startLocal = new Date(sy, sm - 1, sd);        // local midnight of start

        // Iterate day-by-day in local time.  daysBack counts whole calendar
        // days between each iteration date and today so the native plugin reads
        // the correct day.  We compute the diff via Date.UTC() on the local
        // calendar parts, which is DST-safe because UTC has no DST and we only
        // care about the whole-day count.
        const todayUtcMs = Date.UTC(todayLocal.getFullYear(), todayLocal.getMonth(), todayLocal.getDate());
        for (let cur = new Date(startLocal); cur <= todayLocal; cur.setDate(cur.getDate() + 1)) {
            const curUtcMs = Date.UTC(cur.getFullYear(), cur.getMonth(), cur.getDate());
            const daysBack = Math.round((todayUtcMs - curUtcMs) / 86400000);

            const steps = await window.NativeHealth.getSteps(daysBack);
            if (steps != null && steps > 0) {
                const dateStr = getLocalDateString(cur);
                await window.supabaseClient.rpc('upsert_native_daily_steps', {
                    p_user_id: window.currentUser.id,
                    p_date:    dateStr,
                    p_steps:   Math.round(steps),
                });
                // Award 2 XP for hitting 10k steps today
                if (daysBack === 0 && typeof window.checkStepXpReward === 'function') {
                    window.checkStepXpReward(steps);
                }
            }
        }
        console.log('[StepsChallenge] Native steps synced');
    } catch (err) {
        console.warn('[StepsChallenge] Native steps sync error:', err);
    }
}

// Get time ago string
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString();
}

// Open coach chat from friends view
function openCoachChatFromFriends() {
    openCoachChatModal();
}

// Send nudge to friend
async function sendNudgeToFriend(friendId, friendName) {
    if (!confirm(`Send a nudge to ${friendName} to remind them to work out?`)) return;

    try {
        const { error } = await window.supabaseClient
            .from('nudges')
            .insert({
                sender_id: window.currentUser.id,
                receiver_id: friendId,
                message: `Hey! Just checking in - have you worked out today? 💪`
            });

        if (error) throw error;

        showToast(`Nudge sent to ${friendName}!`, 'success');
        loadFriendsCards(); // Refresh to update can_nudge status
    } catch (error) {
        console.error('Error sending nudge:', error);
        showToast('Failed to send nudge. Try again later.', 'error');
    }
}

// Send cheers for an activity
async function sendCheers(userId, activityType) {
    const messages = {
        workout: ['Great workout! 💪', 'Crushing it! 🔥', 'Keep up the great work! ⭐'],
        meal: ['Healthy choices! 🥗', 'Nice meal logging! 📊', 'Staying on track! 🎯'],
        achievement: ['Amazing achievement! 🏆', 'So proud of you! 🌟', 'You\'re on fire! 🔥']
    };

    const randomMessage = messages[activityType][Math.floor(Math.random() * messages[activityType].length)];

    try {
        const { error } = await window.supabaseClient
            .from('nudges')
            .insert({
                sender_id: window.currentUser.id,
                receiver_id: userId,
                message: randomMessage
            });

        if (error) throw error;

        showToast('Cheers sent! 🎉', 'success');
    } catch (error) {
        console.error('Error sending cheers:', error);
        showToast('Failed to send cheers', 'error');
    }
}

// ============================================================
// DIRECT MESSAGING FUNCTIONS
// ============================================================

// Open direct message modal
function openDirectMessage(userId, userName, userPhoto) {
    currentDMRecipient = { id: userId, name: userName, photo: userPhoto };

    // Clear unread state for this specific sender (badge count updated inside clearUnreadSender)
    clearUnreadSender(userId);

    const modal = document.getElementById('direct-message-modal');
    const nameEl = document.getElementById('dm-recipient-name');
    const photoEl = document.getElementById('dm-recipient-photo');
    const statusEl = document.getElementById('dm-recipient-status');

    if (nameEl) nameEl.textContent = userName;
    if (statusEl) statusEl.textContent = 'Friend';

    if (photoEl) {
        const initials = (userName || '?').charAt(0).toUpperCase();
        if (userPhoto) {
            photoEl.innerHTML = `<img src="${userPhoto}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            photoEl.innerHTML = initials;
        }
    }

    if (modal) {
        modal.style.display = 'flex';
        loadDirectMessages(userId);
        // Register Android back button/swipe-back to close the DM modal
        if (typeof pushNavigationState === 'function') {
            pushNavigationState('direct-message-modal', closeDirectMessageModal);
        }
    }
}

// Close direct message modal
function closeDirectMessageModal() {
    const modal = document.getElementById('direct-message-modal');
    if (modal) modal.style.display = 'none';
    currentDMRecipient = null;
}

// Open coach chat — redirects to the real DM with Coach Shannon's account
async function openCoachChatModal() {
    const coachId = window._coachUserId || await getCoachUserId();
    if (coachId && typeof openDirectMessage === 'function') {
        openDirectMessage(coachId, 'Coach Shan', '');
    }
}

// Close coach chat modal
function closeCoachChatModal() {
    const modal = document.getElementById('coach-chat-modal');
    if (modal) modal.style.display = 'none';
}

// Load direct messages between current user and recipient
async function loadDirectMessages(recipientId) {
    const container = document.getElementById('dm-messages-container');
    if (!container) return;

    container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading messages...</div>`;

    // Ensure we have a valid user before querying
    if (!window.currentUser || !window.currentUser.id) {
        console.error('[DM] No currentUser — waiting for auth...');
        // Wait for auth to be ready (e.g. app launched from notification tap)
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 500));
            if (window.currentUser && window.currentUser.id) break;
        }
        if (!window.currentUser || !window.currentUser.id) {
            container.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444;">Please log in to view messages</div>`;
            return;
        }
    }

    try {
        // Refresh the Supabase session to ensure the JWT is valid.
        // A stale JWT causes RLS-protected queries to silently return 0 rows.
        try {
            const { data: sessionData } = await window.supabaseClient.auth.getSession();
            if (!sessionData?.session) {
                console.warn('[DM] No active Supabase session — attempting refresh');
                await window.supabaseClient.auth.refreshSession();
            }
        } catch (authErr) {
            console.warn('[DM] Session refresh failed (non-fatal):', authErr.message);
        }

        const userId = window.currentUser.id;
        console.log('[DM] Loading messages between', userId.substring(0, 8), 'and', String(recipientId).substring(0, 8));

        // Get the 50 MOST RECENT messages from nudges table.
        // We order descending + limit, then reverse for chronological display.
        // (Previously this used ascending + limit, which returned the OLDEST 50
        // and silently hid every new message once a thread passed 50 total.)
        const { data: recentMessages, error } = await window.supabaseClient
            .from('nudges')
            .select('*')
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${userId})`)
            .order('created_at', { ascending: false })
            .limit(50);
        const messages = recentMessages ? recentMessages.slice().reverse() : [];

        if (error) {
            console.error('[DM] Query error:', error.message, error.code, error.hint);
            throw error;
        }

        console.log('[DM] Query returned', messages ? messages.length : 0, 'messages');

        if (!messages || messages.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    <div style="font-size: 2rem; margin-bottom: 10px;">💬</div>
                    <div style="font-size: 0.9rem;">No messages yet. Say hi!</div>
                </div>
            `;
            return;
        }

        container.innerHTML = messages.map(msg => {
            const isSent = msg.sender_id === userId;
            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Check if it's a photo message
            const photoMatch = msg.message.match(/^\[PHOTO:(.+)\]$/);
            if (photoMatch) {
                const photoUrl = photoMatch[1];
                return `
                    <div style="display: flex; justify-content: ${isSent ? 'flex-end' : 'flex-start'}; margin-bottom: 12px;">
                        <div style="max-width: 75%;">
                            <img src="${photoUrl}" onclick="window.open('${photoUrl}', '_blank')" style="max-width: 100%; border-radius: ${isSent ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; display: block; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.15);" onerror="this.style.display='none'">
                            <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 4px; text-align: right;">${time}</div>
                        </div>
                    </div>
                `;
            }

            // Check if it's a game invite or turn notification
            const isGameMessage = msg.nudge_type === 'game_invite' || (msg.message.includes('🎮') && (msg.message.includes('challenged') || msg.message.includes('accepted') || msg.message.includes('turn') || msg.message.includes('won') || msg.message.includes('challenge')));
            const isQuizBattle = msg.nudge_type === 'quiz_battle_invite' || msg.message.includes('⚡ QUIZ BATTLE');
            // Wellness challenge invite (⚔️) — clickable button jumps straight to the accept flow
            const isChallengeInvite = msg.nudge_type === 'challenge_invite' && !!msg.reference_id;
            // Match id is attached to game nudges so the accept button can jump straight to the lobby.
            const gameMatchId = (msg.nudge_type === 'game_invite' && msg.reference_id) ? msg.reference_id : '';

            let clickHandler = '';
            if (!isSent) {
                if (isQuizBattle) {
                    clickHandler = `onclick="window.handleQuizBattleMessageClick('${msg.sender_id}')" style="cursor:pointer;"`;
                } else if (isGameMessage) {
                    clickHandler = `onclick="window.handleGameMessageClick('${msg.sender_id}', '${gameMatchId}')" style="cursor:pointer;"`;
                } else if (isChallengeInvite) {
                    clickHandler = `onclick="window.handleChallengeInviteMessageClick('${msg.reference_id}')" style="cursor:pointer;"`;
                }
            }
            const isSpecialInvite = isGameMessage || isQuizBattle || isChallengeInvite;
            const extraStyle = isSpecialInvite && !isSent ? 'border: 2px solid #7c3aed; background: linear-gradient(to right, #f5f3ff, #ede9fe); color: #5b21b6;' : `background: ${isSent ? 'var(--primary)' : 'white'}; color: ${isSent ? 'white' : 'var(--text-main)'};`;

            let inviteButtonHtml = '';
            if (isSpecialInvite && !isSent) {
                if (isChallengeInvite) {
                    inviteButtonHtml = `
                        <div style="margin-top: 10px;">
                            <button onclick="window.handleChallengeInviteMessageClick('${msg.reference_id}'); event.stopPropagation();" style="width: 100%; padding: 8px 12px; background: linear-gradient(135deg, #7c3aed, #6366f1); color: white; border: none; border-radius: 6px; font-weight: 700; font-size: 0.85rem; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                ⚔️ View &amp; Accept Challenge
                            </button>
                        </div>`;
                } else {
                    const btnBg = isQuizBattle ? '#7c3aed' : '#F59E0B';
                    const btnLabel = isQuizBattle ? '⚡ Accept Battle' : (msg.message.includes('challenge') ? '🎮 Accept Challenge' : (msg.message.includes('turn') ? '🎮 Take Turn' : '🎮 Play Game'));
                    const onClickAttr = isQuizBattle
                        ? `window.handleQuizBattleMessageClick('${msg.sender_id}')`
                        : `window.handleGameMessageClick('${msg.sender_id}', '${gameMatchId}')`;
                    inviteButtonHtml = `
                        <div style="margin-top: 10px;">
                            <button onclick="${onClickAttr}; event.stopPropagation();" style="width: 100%; padding: 8px 12px; background: ${btnBg}; color: white; border: none; border-radius: 6px; font-weight: 700; font-size: 0.85rem; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                ${btnLabel}
                            </button>
                        </div>`;
                }
            }

            const reactionsHtml = window.renderMessageReactions ? window.renderMessageReactions(msg, userId) : '';
            return `
                <div style="display: flex; flex-direction: column; align-items: ${isSent ? 'flex-end' : 'flex-start'}; margin-bottom: 12px;">
                    <div ${clickHandler} data-msg-id="${msg.id}" class="dm-bubble" style="max-width: 75%; padding: 10px 14px; border-radius: ${isSent ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; ${extraStyle} box-shadow: 0 1px 3px rgba(0,0,0,0.1); user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;">
                        <div style="font-size: 0.9rem; line-height: 1.4;">${msg.message}</div>
                        ${inviteButtonHtml}
                        <div style="font-size: 0.7rem; opacity: 0.7; margin-top: 4px; text-align: right;">${time}</div>
                    </div>
                    ${reactionsHtml}
                </div>
            `;
        }).join('');

        // Wire up long-press on each bubble to open the reaction picker
        if (window.attachDmLongPressReactions) window.attachDmLongPressReactions(container);

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;

        // MSN-style: trigger an effect if the newest message text contains a trigger word
        // (only for NEW messages since last render to avoid re-firing on reopen)
        try {
            const newest = messages[messages.length - 1];
            if (newest && window._dmLastEffectMsgId !== newest.id) {
                window._dmLastEffectMsgId = newest.id;
                if (window.triggerMsnEffect) window.triggerMsnEffect(newest.message || '');
            }
        } catch (e) { /* ignore */ }

        // Mark messages as read
        await window.supabaseClient
            .from('nudges')
            .update({ read_at: new Date().toISOString() })
            .eq('receiver_id', userId)
            .eq('sender_id', recipientId)
            .is('read_at', null);

    } catch (error) {
        console.error('[DM] Error loading messages:', error);
        container.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444;">Failed to load messages. Pull down to retry.</div>`;
    }
}

// Expose messaging functions on window so native-push.js can access them
window.openDirectMessage = openDirectMessage;
window.openMessageInbox = openMessageInbox;
window.loadDirectMessages = loadDirectMessages;
window.openAddFriendModal = openAddFriendModal;
window.closeAddFriendModal = closeAddFriendModal;
window.showFriendTab = showFriendTab;
window.searchForFriends = searchForFriends;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.declineFriendRequest = declineFriendRequest;
window.removeFriend = removeFriend;
window.openHomeFriendsModal = openHomeFriendsModal;
window.closeHomeFriendsModal = closeHomeFriendsModal;
window.openFeedMessagesPanel = openFeedMessagesPanel;
window.closeFeedMessagesPanel = closeFeedMessagesPanel;
window.sendDirectMessage = sendDirectMessage;

// Expose so in-DM challenge invite buttons can call the accept flow
if (typeof acceptChallengeInvite === 'function') {
    window.acceptChallengeInvite = acceptChallengeInvite;
}

// Tapping a challenge_invite nudge bubble (or its notification banner) jumps
// the user straight into the challenge accept flow. We close the DM modal
// first so the Challenge Pass modal isn't stacked behind it.
window.handleChallengeInviteMessageClick = async function(challengeId) {
    console.log('⚔️ handleChallengeInviteMessageClick called for challenge:', challengeId);
    if (!challengeId) {
        console.warn('❌ handleChallengeInviteMessageClick: No challengeId provided');
        if (typeof showToast === 'function') {
            showToast('This challenge invite is missing a link. Open the Challenges tab to accept.', 'error');
        }
        return;
    }
    try {
        // Close any open messaging modals so the accept modal isn't hidden behind them
        if (typeof closeDirectMessageModal === 'function') closeDirectMessageModal();
        const inboxModal = document.getElementById('message-selector-modal');
        if (inboxModal) inboxModal.style.display = 'none';

        if (typeof acceptChallengeInvite === 'function') {
            await acceptChallengeInvite(challengeId);
        } else if (typeof window.acceptChallengeInvite === 'function') {
            await window.acceptChallengeInvite(challengeId);
        } else {
            console.warn('❌ acceptChallengeInvite is not available');
            if (typeof openChallengesTab === 'function') openChallengesTab();
        }
    } catch (e) {
        console.error('❌ handleChallengeInviteMessageClick error:', e);
        if (typeof showToast === 'function') {
            showToast('Could not open challenge invite. Try again from the Challenges tab.', 'error');
        }
    }
};

window.handleQuizBattleMessageClick = async function(senderId) {
    console.log('⚡ handleQuizBattleMessageClick called for sender:', senderId);
    if (!senderId) {
        console.warn('❌ handleQuizBattleMessageClick: No senderId provided');
        return;
    }

    try {
        if (!window.supabaseClient || !window.currentUser) {
            console.warn('❌ handleQuizBattleMessageClick: Supabase or User not ready');
            return;
        }

        // Fetch active quiz battles
        const { data: battles, error } = await window.supabaseClient.rpc('get_user_quiz_battles', { p_user_id: window.currentUser.id });
        
        if (error) {
            console.error('❌ Error fetching quiz battles:', error);
            return;
        }

        // Find a pending/active battle with this sender
        const battle = (battles || []).find(b => 
            (b.challenger_id === senderId || b.opponent_id === senderId) && 
            (b.status === 'pending' || b.status === 'active') &&
            (!b.opponent_finished || b.opponent_id !== window.currentUser.id)
        );

        if (battle) {
            console.log('⚡ Found battle match:', battle.id);
            // Close modals
            const dmModal = document.getElementById('direct-message-modal');
            if (dmModal) dmModal.style.display = 'none';

            // Call the acceptance function in learning-inline.js
            if (typeof window.acceptQuizBattle === 'function') {
                window.acceptQuizBattle(battle.id, battle.challenger_name, battle.coin_bet);
            } else {
                 // Fallback: switch to learning tab
                 if (typeof window.switchAppTab === 'function') window.switchAppTab('learning');
            }
        } else {
            console.warn('⚠️ No active quiz battle found with this user.');
            showToast('No active quiz battle found.', 'info');
        }
    } catch (e) {
        console.error('❌ handleQuizBattleMessageClick critical error:', e);
    }
};

window.handleGameMessageClick = async function(senderId, matchId) {
    console.log('🎮 handleGameMessageClick called for sender:', senderId, 'match:', matchId);
    if (!window.currentUser || !window.db || !window.db.games) {
        showToast('Games system not ready. Please wait...', 'error');
        return;
    }

    const closeMessagingModals = () => {
        if (typeof closeDirectMessageModal === 'function') closeDirectMessageModal();
        if (typeof closeMessageSelectorModal === 'function') closeMessageSelectorModal();
    };

    showToast('🎮 Loading game...', 'info');

    // Fast path: the message carries the match_id directly (nudge.reference_id)
    if (matchId && typeof window.openGameBoard === 'function') {
        try {
            const match = await window.db.games.getMatch(matchId);
            if (match && (match.status === 'pending' || match.status === 'active')) {
                closeMessagingModals();
                window.openGameBoard(matchId);
                return;
            }
            if (match && match.status) {
                const finishedLabels = {
                    completed: 'That game has already finished.',
                    draw: 'That game ended in a draw.',
                    declined: 'That challenge was declined.',
                    expired: 'That challenge has expired.',
                    forfeit: 'That game was forfeited.'
                };
                showToast(finishedLabels[match.status] || 'That game is no longer active. Send a new challenge!', 'info');
                return;
            }
        } catch (fetchErr) {
            console.warn('🎮 [handleGameMessageClick] getMatch failed, falling back to sender search:', fetchErr?.message);
        }
    }

    if (!senderId) {
        console.warn('❌ handleGameMessageClick: No senderId and no matchId to look up.');
        showToast('This game invite is missing a link. Open the Games tab to start a new one.', 'info');
        return;
    }

    try {
        const games = await window.db.games.getUserGames(window.currentUser.id);
        console.log('🎮 [handleGameMessageClick] Games found:', games?.length || 0);

        const game = (games || []).find(g =>
            (g.challenger_id === senderId || g.opponent_id === senderId) &&
            (g.status === 'pending' || g.status === 'active')
        );

        if (game) {
            closeMessagingModals();
            if (typeof window.openGameBoard === 'function') {
                window.openGameBoard(game.match_id);
            } else {
                showToast('Game board component missing.', 'error');
            }
            return;
        }

        console.warn('⚠️ [handleGameMessageClick] No active game with sender:', senderId);
        showToast('That game has already ended. Send a new challenge to play again!', 'info');
    } catch (e) {
        console.error('❌ [handleGameMessageClick] critical error:', e);
        showToast(`Error: ${e.message || 'Could not load game'}`, 'error');
    }
};

// Listen for messages from service worker (web push notification clicks)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'dm_message_click') {
            const senderId = event.data.senderId;
            const isGameInvite = event.data.isGameInvite;

            if (isGameInvite && senderId) {
                if (typeof window.handleGameMessageClick === 'function') {
                    window.handleGameMessageClick(senderId);
                }
            } else if (senderId) {
                if (typeof window.openDirectMessage === 'function') {
                    window.openDirectMessage(senderId, 'Message', '');
                }
            }
        }
    });
}

// Check URL parameters for direct navigation from web push
_runWhenDomReady(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    const senderId = urlParams.get('sender_id');

    if (action === 'game_invite' && senderId) {
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        // Wait briefly for app to load auth, then open game
        setTimeout(() => {
            if (typeof window.handleGameMessageClick === 'function') {
                window.handleGameMessageClick(senderId);
            }
        }, 1500);
    } else if (action === 'open_dm' && senderId) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
            if (typeof window.openDirectMessage === 'function') {
                window.openDirectMessage(senderId, 'Message', '');
            }
        }, 1500);
    }
});

// Send direct message
async function sendDirectMessage() {
    const input = document.getElementById('dm-input');
    if (!input || !currentDMRecipient) return;

    const message = input.value.trim();
    if (!message) return;

    input.value = '';

    try {
        const { error } = await window.supabaseClient
            .from('nudges')
            .insert({
                sender_id: window.currentUser.id,
                receiver_id: currentDMRecipient.id,
                message: message
            });

        if (error) throw error;

        // Reload messages
        loadDirectMessages(currentDMRecipient.id);

        // Push notification is sent automatically by the database trigger
        // on the nudges table (nudge_push_trigger.sql)

        // Refresh admin unresponded count after sending a reply
        if (typeof checkAdminUnrespondedMessages === 'function') {
            setTimeout(checkAdminUnrespondedMessages, 500);
        }

    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
    }

    // MSN-style: trigger effect on sender's screen too
    try { if (window.triggerMsnEffect) window.triggerMsnEffect(message); } catch (e) {}
}

/* ============================================================
   MESSAGE REACTIONS + MSN-STYLE TEXT EFFECTS
   ============================================================ */

window.MESSAGE_REACTION_EMOJIS = ['❤️','😂','😮','😢','🙏','🔥'];

window.renderMessageReactions = function(msg, currentUserId) {
    const reactions = msg && msg.reactions ? msg.reactions : null;
    if (!reactions || typeof reactions !== 'object') return '';
    const entries = Object.entries(reactions).filter(([, arr]) => Array.isArray(arr) && arr.length > 0);
    if (entries.length === 0) return '';
    const chips = entries.map(([emoji, users]) => {
        const mine = users.includes(currentUserId);
        const bg = mine ? 'rgba(124,58,237,0.15)' : 'rgba(0,0,0,0.06)';
        const border = mine ? '1px solid #7c3aed' : '1px solid transparent';
        return `<button onclick="event.stopPropagation(); window.toggleMessageReaction && window.toggleMessageReaction('${msg.id}','${emoji}')" style="background:${bg};border:${border};border-radius:12px;padding:2px 8px;font-size:0.75rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;">${emoji} <span style="font-weight:600;color:#475569;">${users.length}</span></button>`;
    }).join('');
    return `<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">${chips}</div>`;
};

window.showMessageReactionPicker = function(messageId, anchorEl) {
    // Remove any existing picker
    const existing = document.getElementById('msg-reaction-picker');
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.id = 'msg-reaction-picker';
    picker.style.cssText = 'position:fixed;z-index:10000;background:white;border-radius:24px;padding:6px 8px;box-shadow:0 6px 24px rgba(0,0,0,0.2);display:flex;gap:4px;animation:reactionPop 0.2s ease-out;';
    picker.innerHTML = window.MESSAGE_REACTION_EMOJIS.map(e =>
        `<button onclick="window.toggleMessageReaction('${messageId}','${e}'); document.getElementById('msg-reaction-picker').remove();" style="background:none;border:none;font-size:1.4rem;cursor:pointer;padding:4px 6px;border-radius:50%;transition:transform 0.15s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${e}</button>`
    ).join('');
    document.body.appendChild(picker);

    // Position above the anchor
    const r = anchorEl.getBoundingClientRect();
    const pw = picker.offsetWidth;
    picker.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.left + r.width / 2 - pw / 2)) + 'px';
    picker.style.top = Math.max(8, r.top - picker.offsetHeight - 8) + 'px';

    // Dismiss on outside click — delayed so the touchend/synthetic click
    // that follows a long-press doesn't instantly close the picker.
    setTimeout(() => {
        const dismiss = (ev) => {
            if (!picker.contains(ev.target)) {
                picker.remove();
                document.removeEventListener('click', dismiss, true);
                document.removeEventListener('touchstart', dismiss, true);
            }
        };
        document.addEventListener('click', dismiss, true);
        document.addEventListener('touchstart', dismiss, true);
    }, 500);
};

window.attachDmLongPressReactions = function(container) {
    if (!container) return;
    const bubbles = container.querySelectorAll('.dm-bubble[data-msg-id]');
    bubbles.forEach(b => {
        if (b._dblBound) return;
        b._dblBound = true;
        let lastTap = 0;
        const onTap = (ev) => {
            const now = Date.now();
            if (now - lastTap < 350) {
                ev.preventDefault();
                ev.stopPropagation();
                const id = b.getAttribute('data-msg-id');
                if (navigator.vibrate) { try { navigator.vibrate(15); } catch(e){} }
                window.toggleMessageReaction(id, '❤️');
                lastTap = 0;
            } else {
                lastTap = now;
            }
        };
        b.addEventListener('click', onTap);
    });
};

window.toggleMessageReaction = async function(messageId, emoji) {
    if (!window.supabaseClient || !window.currentUser) return;
    try {
        // nudges.id is a UUID — pass the id through as a string, not Number().
        const { data, error } = await window.supabaseClient.rpc('toggle_message_reaction', {
            p_message_id: String(messageId),
            p_emoji: emoji
        });
        if (error) throw error;
        // Reload current thread to reflect new state
        if (currentDMRecipient && typeof loadDirectMessages === 'function') {
            // Prevent re-triggering MSN effect on reload
            const prev = window._dmLastEffectMsgId;
            loadDirectMessages(currentDMRecipient.id).finally(() => {
                window._dmLastEffectMsgId = prev;
            });
        }
    } catch (e) {
        console.error('[reactions] toggle failed', e);
        showToast && showToast('Could not react', 'error');
    }
};

/* ---------- MSN-style text triggers ---------- */
window.triggerMsnEffect = function(text) {
    if (!text || typeof text !== 'string') return;
    const t = text.toLowerCase();
    // kk cascade
    if (/\bkk+\b/.test(t)) runMsnCascade('k');
    // lol rain
    if (/\blol\b|\blmao\b|\brofl\b/.test(t)) runMsnEmojiRain('😂');
    // hearts
    if (/<3|❤️|\blove\b/.test(t)) runMsnHearts();
    // omg shake + 😱 burst
    if (/\bomg\b|\bwtf\b/.test(t)) runMsnShake();
    // gg confetti
    if (/\bgg\b/.test(t)) runMsnConfetti();
};

function ensureMsnFxRoot() {
    let root = document.getElementById('msn-fx-root');
    if (!root) {
        root = document.createElement('div');
        root.id = 'msn-fx-root';
        root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden;';
        document.body.appendChild(root);
    }
    if (!document.getElementById('msn-fx-styles')) {
        const style = document.createElement('style');
        style.id = 'msn-fx-styles';
        style.textContent = `
@keyframes msnFallDown { 0%{transform:translateY(-20vh) rotate(0);opacity:0;} 10%{opacity:1;} 100%{transform:translateY(110vh) rotate(360deg);opacity:0;} }
@keyframes msnFloatUp { 0%{transform:translateY(0) scale(0.6);opacity:0;} 15%{opacity:1;} 100%{transform:translateY(-110vh) scale(1.2);opacity:0;} }
@keyframes msnShakeAnim { 0%,100%{transform:translate(0,0);} 20%{transform:translate(-8px,4px);} 40%{transform:translate(8px,-4px);} 60%{transform:translate(-6px,-4px);} 80%{transform:translate(6px,4px);} }
@keyframes msnKPop { 0%{transform:scale(0) rotate(0);opacity:0;} 20%{transform:scale(1.4) rotate(-10deg);opacity:1;} 100%{transform:scale(1) rotate(0);opacity:1;} }
@keyframes msnFadeOut { to { opacity:0; } }
@keyframes reactionPop { 0%{transform:scale(0.6);opacity:0;} 100%{transform:scale(1);opacity:1;} }
.msn-fx-shake { animation: msnShakeAnim 0.5s ease-in-out 2; }
`;
        document.head.appendChild(style);
    }
    return root;
}

function runMsnCascade(char) {
    const root = ensureMsnFxRoot();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;inset:0;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;font-size:3rem;color:#7c3aed;font-weight:900;text-shadow:2px 2px 0 rgba(255,255,255,0.6);animation:msnFadeOut 0.6s ease-out 1.6s forwards;';
    let html = '';
    for (let i = 0; i < 80; i++) {
        const delay = (i * 0.015).toFixed(2);
        html += `<span style="display:inline-block;margin:0 4px;animation:msnKPop 0.4s ease-out ${delay}s backwards;">${char}</span>`;
    }
    wrap.innerHTML = html;
    root.appendChild(wrap);
    setTimeout(() => wrap.remove(), 2400);
}

function runMsnEmojiRain(emoji) {
    const root = ensureMsnFxRoot();
    for (let i = 0; i < 30; i++) {
        const el = document.createElement('div');
        const left = Math.random() * 100;
        const delay = Math.random() * 0.8;
        const duration = 1.8 + Math.random() * 1.2;
        el.textContent = emoji;
        el.style.cssText = `position:absolute;left:${left}%;top:-10vh;font-size:${1.5 + Math.random()*1.5}rem;animation:msnFallDown ${duration}s linear ${delay}s forwards;`;
        root.appendChild(el);
        setTimeout(() => el.remove(), (duration + delay) * 1000 + 200);
    }
}

function runMsnHearts() {
    const root = ensureMsnFxRoot();
    for (let i = 0; i < 24; i++) {
        const el = document.createElement('div');
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 2.2 + Math.random() * 1.3;
        el.textContent = '❤️';
        el.style.cssText = `position:absolute;left:${left}%;bottom:-10vh;font-size:${1.4 + Math.random()*1.8}rem;animation:msnFloatUp ${duration}s ease-in ${delay}s forwards;`;
        root.appendChild(el);
        setTimeout(() => el.remove(), (duration + delay) * 1000 + 200);
    }
}

function runMsnShake() {
    document.body.classList.add('msn-fx-shake');
    setTimeout(() => document.body.classList.remove('msn-fx-shake'), 1100);
    // 😱 burst
    const root = ensureMsnFxRoot();
    for (let i = 0; i < 16; i++) {
        const el = document.createElement('div');
        const left = 40 + Math.random() * 20;
        const top = 40 + Math.random() * 20;
        const dx = (Math.random() - 0.5) * 800;
        const dy = (Math.random() - 0.5) * 800;
        el.textContent = '😱';
        el.style.cssText = `position:absolute;left:${left}%;top:${top}%;font-size:2rem;transition:transform 1s ease-out, opacity 1s ease-out;`;
        root.appendChild(el);
        requestAnimationFrame(() => {
            el.style.transform = `translate(${dx}px, ${dy}px) scale(1.6)`;
            el.style.opacity = '0';
        });
        setTimeout(() => el.remove(), 1100);
    }
}

function runMsnConfetti() {
    const root = ensureMsnFxRoot();
    const colors = ['#ef4444','#f59e0b','#10b981','#3b82f6','#a855f7','#ec4899'];
    for (let i = 0; i < 60; i++) {
        const el = document.createElement('div');
        const left = Math.random() * 100;
        const delay = Math.random() * 0.5;
        const duration = 1.6 + Math.random() * 1.4;
        const color = colors[i % colors.length];
        const size = 6 + Math.random() * 8;
        el.style.cssText = `position:absolute;left:${left}%;top:-10vh;width:${size}px;height:${size * 0.6}px;background:${color};animation:msnFallDown ${duration}s linear ${delay}s forwards;`;
        root.appendChild(el);
        setTimeout(() => el.remove(), (duration + delay) * 1000 + 200);
    }
    // Add 🎉 pops too
    for (let i = 0; i < 8; i++) {
        const el = document.createElement('div');
        el.textContent = '🎉';
        el.style.cssText = `position:absolute;left:${Math.random()*100}%;top:-10vh;font-size:2rem;animation:msnFallDown ${2 + Math.random()}s linear ${Math.random()*0.4}s forwards;`;
        root.appendChild(el);
        setTimeout(() => el.remove(), 3400);
    }
}

// Send a photo attachment in a chat (DM or group)
async function sendChatPhoto(chatType, fileInput) {
    const file = fileInput.files[0];
    if (!file) return;

    // Reset the file input so the same photo can be re-selected if needed
    fileInput.value = '';

    const userId = window.currentUser?.id;
    if (!userId) {
        showToast('Please log in to send photos', 'error');
        return;
    }

    // Show uploading indicator
    const uploadingMsg = `[PHOTO:uploading]`;
    const tempId = 'chat-photo-uploading-' + Date.now();

    if (chatType === 'dm') {
        const container = document.getElementById('dm-messages-container');
        if (container) {
            const div = document.createElement('div');
            div.id = tempId;
            div.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 12px;';
            div.innerHTML = `<div style="max-width: 75%; padding: 10px 14px; border-radius: 16px 16px 4px 16px; background: var(--primary); color: white; font-size: 0.85rem; opacity: 0.7;">Uploading photo...</div>`;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        }
    } else if (chatType === 'gc') {
        const container = document.getElementById('gc-messages-container');
        if (container) {
            const div = document.createElement('div');
            div.id = tempId;
            div.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 12px;';
            div.innerHTML = `<div style="max-width: 75%; padding: 10px 14px; border-radius: 16px 16px 4px 16px; background: var(--primary); color: white; font-size: 0.85rem; opacity: 0.7;">Uploading photo...</div>`;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        }
    }

    try {
        // Upload photo to B2
        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', userId);

        const uploadResponse = await fetch('/api/upload-chat-photo', {
            method: 'POST',
            body: formData
        });

        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || 'Upload failed');
        }

        const uploadData = await uploadResponse.json();
        const photoUrl = uploadData.url;
        const photoMessage = `[PHOTO:${photoUrl}]`;

        // Remove the uploading indicator
        const tempEl = document.getElementById(tempId);
        if (tempEl) tempEl.remove();

        // Send the message with the photo URL
        if (chatType === 'dm') {
            if (!currentDMRecipient) return;
            const { error } = await window.supabaseClient
                .from('nudges')
                .insert({
                    sender_id: userId,
                    receiver_id: currentDMRecipient.id,
                    message: photoMessage
                });
            if (error) throw error;
            loadDirectMessages(currentDMRecipient.id);
        } else if (chatType === 'gc') {
            if (!currentGroupChatId) return;
            const { error } = await window.supabaseClient
                .from('group_chat_messages')
                .insert({
                    group_chat_id: currentGroupChatId,
                    user_id: userId,
                    message: photoMessage
                });
            if (error) throw error;
            loadGroupChatMessages(currentGroupChatId);
        }

    } catch (error) {
        console.error('Error sending photo:', error);
        const tempEl = document.getElementById(tempId);
        if (tempEl) tempEl.remove();
        showToast('Failed to send photo', 'error');
    }
}
window.sendChatPhoto = sendChatPhoto;

// Open message inbox (shows friend selector to choose who to message)
async function openMessageInbox() {
    const modal = document.getElementById('message-selector-modal');
    const listContainer = document.getElementById('message-selector-list');

    // Refresh Supabase session so RLS queries work with a valid JWT
    try {
        const { data: sessionData } = await window.supabaseClient.auth.getSession();
        if (!sessionData?.session) {
            await window.supabaseClient.auth.refreshSession();
        }
    } catch (authErr) {
        console.warn('[Inbox] Session refresh failed (non-fatal):', authErr.message);
    }

    if (!modal || !listContainer) return;

    // Show modal with loading state
    modal.style.display = 'flex';
    listContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted);">Loading contacts...</div>`;

    try {
        let html = '';
        const unreadSenders = getUnreadSenderIds();
        const coachId = window._coachUserId || await getCoachUserId();

        // Get friends list (coach account will appear naturally, pinned to top)
        if (window.currentUser && window.dbHelpers && window.dbHelpers.friends) {
            const friends = await db.friends.getFriendsWithFallback(window.currentUser.id);

            // Pin coach to top
            if (coachId && friends) {
                friends.sort((a, b) => {
                    if (a.friend_id === coachId) return -1;
                    if (b.friend_id === coachId) return 1;
                    return 0;
                });
            }

            if (friends && friends.length > 0) {
                // Fetch last messages for all friends to show previews
                let lastMessages = {};
                try {
                    const friendIds = friends.map(f => f.friend_id);
                    const { data: recentMsgs } = await window.supabaseClient
                        .from('nudges')
                        .select('sender_id, receiver_id, message, created_at')
                        .or(`sender_id.eq.${window.currentUser.id},receiver_id.eq.${window.currentUser.id}`)
                        .order('created_at', { ascending: false })
                        .limit(100);

                    if (recentMsgs) {
                        recentMsgs.forEach(msg => {
                            const otherId = msg.sender_id === window.currentUser.id ? msg.receiver_id : msg.sender_id;
                            if (friendIds.includes(otherId) && !lastMessages[otherId]) {
                                const isSent = msg.sender_id === window.currentUser.id;
                                const preview = msg.message.length > 35 ? msg.message.substring(0, 35) + '...' : msg.message;
                                lastMessages[otherId] = {
                                    text: (isSent ? 'You: ' : '') + preview,
                                    time: msg.created_at
                                };
                            }
                        });
                    }
                } catch (e) { console.warn('Could not load message previews:', e); }

                // Sort friends: unread first, then by last message time, then alphabetically
                friends.sort((a, b) => {
                    const aUnread = unreadSenders.indexOf(a.friend_id) !== -1 ? 1 : 0;
                    const bUnread = unreadSenders.indexOf(b.friend_id) !== -1 ? 1 : 0;
                    if (bUnread !== aUnread) return bUnread - aUnread;
                    const aTime = lastMessages[a.friend_id]?.time || '';
                    const bTime = lastMessages[b.friend_id]?.time || '';
                    if (aTime && bTime) return bTime.localeCompare(aTime);
                    if (aTime) return -1;
                    if (bTime) return 1;
                    return (a.friend_name || '').localeCompare(b.friend_name || '');
                });

                friends.forEach(friend => {
                    const initials = (friend.friend_name || friend.friend_email || '?').charAt(0).toUpperCase();
                    const photoHtml = friend.friend_photo
                        ? `<img src="${friend.friend_photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.parentElement.innerHTML='${initials}'">`
                        : initials;
                    const hasUnread = unreadSenders.indexOf(friend.friend_id) !== -1;
                    const lastMsg = lastMessages[friend.friend_id];
                    const subtitleText = hasUnread ? 'New message' : (lastMsg ? lastMsg.text : 'Tap to message');

                    html += `
                        <div onclick="closeMessageSelectorModal(); openDirectMessage('${friend.friend_id}', '${(friend.friend_name || friend.friend_email || 'Friend').replace(/'/g, "\\'")}', '${friend.friend_photo || ''}');" style="display: flex; align-items: center; gap: 12px; padding: 15px; margin: 5px 0; background: ${hasUnread ? '#fef2f2' : '#f8fafc'}; border-radius: 12px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='${hasUnread ? '#fee2e2' : '#f1f5f9'}'" onmouseout="this.style.background='${hasUnread ? '#fef2f2' : '#f8fafc'}'">
                            <div style="position: relative; flex-shrink: 0;"><div style="width: 50px; height: 50px; border-radius: 50%; background: var(--secondary); display: flex; align-items: center; justify-content: center; color: var(--text-main); font-weight: 600; font-size: 1.2rem; overflow: hidden;">${photoHtml}</div>${hasUnread ? '<div class="dm-unread-dot" data-sender-id="' + friend.friend_id + '" style="display:block;position:absolute;top:-2px;right:-2px;width:14px;height:14px;background:#ef4444;border-radius:50%;border:2.5px solid white;z-index:1;"></div>' : ''}</div>
                            <div style="flex: 1; min-width: 0;">
                                <div style="font-weight: ${hasUnread ? '700' : '600'}; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${friend.friend_name || friend.friend_email || 'Friend'}</div>
                                <div style="font-size: 0.85rem; color: ${hasUnread ? '#ef4444' : 'var(--text-muted)'}; font-weight: ${hasUnread ? '600' : 'normal'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${subtitleText}</div>
                            </div>
                            <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: ${hasUnread ? '#ef4444' : 'var(--text-muted)'}; flex-shrink: 0;"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                        </div>
                    `;
                });
            }
        }

        // If no friends, show helpful message
        if (!html.includes('Friends')) {
            html += `
                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                    <p style="margin: 0 0 10px 0;">Add friends to message them!</p>
                    <button onclick="closeMessageSelectorModal(); openAddFriendModal();" style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; cursor: pointer;">Add Friends</button>
                </div>
            `;
        }

        listContainer.innerHTML = html;

    } catch (error) {
        console.error('Error loading contacts:', error);
        listContainer.innerHTML = `<div style="text-align: center; padding: 30px; color: var(--text-muted);">Failed to load contacts</div>`;
    }
}

// Close message selector modal
function closeMessageSelectorModal() {
    const modal = document.getElementById('message-selector-modal');
    if (modal) modal.style.display = 'none';
}

// Open the Messages panel (slide-over with group chats + friends)
function openFeedMessagesPanel() {
    const panel = document.getElementById('feed-messages-panel');
    if (panel) {
        panel.style.display = 'block';
        // Refresh admin unresponded banner when panel opens
        if (typeof checkAdminUnrespondedMessages === 'function') {
            checkAdminUnrespondedMessages();
        }
        // Close panel when clicking on backdrop (outside panel content)
        panel.onclick = function(e) {
            if (e.target === panel) closeFeedMessagesPanel();
        };
        loadPanelGroupChats();
        loadPanelFriends();
        // Push navigation state so Android back button/gesture closes the panel
        // instead of navigating away from the app
        if (typeof pushNavigationState === 'function') {
            pushNavigationState('feed-messages-panel', closeFeedMessagesPanel);
        }
    }
    // Clear the icon badge count when opening messages, but keep unread sender IDs
    // so the friends list can show which friends have unread messages.
    // Individual sender IDs are cleared when the user opens that specific conversation.
    updateMessageBadges(0);
}

// Close the Messages panel
function closeFeedMessagesPanel() {
    const panel = document.getElementById('feed-messages-panel');
    if (panel) panel.style.display = 'none';
}

// --- Home Friends Pill & Modal ---

// Update the friends pill count on the home page
async function updateHomeFriendsPillCount() {
    try {
        if (!window.currentUser) return;
        const friends = await db.friends.getFriendsWithFallback(window.currentUser.id);
        const count = friends ? friends.length : 0;
        const pillCount = document.getElementById('home-friends-pill-count');
        if (pillCount) pillCount.textContent = count;
    } catch (e) {
        console.error('Error updating friends pill count:', e);
    }
}

function openHomeFriendsModal() {
    const modal = document.getElementById('home-friends-modal');
    if (modal) {
        modal.style.display = 'flex';
        loadHomeFriendsModal();
    }
}

function closeHomeFriendsModal() {
    const modal = document.getElementById('home-friends-modal');
    if (modal) modal.style.display = 'none';
}

async function loadHomeFriendsModal() {
    const container = document.getElementById('home-friends-modal-list');
    const countBadge = document.getElementById('home-friends-modal-count');
    if (!container || !window.currentUser) return;

    container.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-muted); font-size: 0.85rem;">Loading...</div>';

    try {
        const friends = await db.friends.getFriendsWithFallback(window.currentUser.id);
        const count = friends ? friends.length : 0;
        if (countBadge) countBadge.textContent = count;

        // Also update the pill
        const pillCount = document.getElementById('home-friends-pill-count');
        if (pillCount) pillCount.textContent = count;

        if (!friends || friends.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
                    <div style="font-size: 2.5rem; margin-bottom: 10px;">👥</div>
                    <div style="font-size: 0.95rem; margin-bottom: 6px; font-weight: 600; color: var(--text-main);">No friends yet</div>
                    <div style="font-size: 0.8rem; margin-bottom: 16px;">Add friends to see them here!</div>
                    <button onclick="closeHomeFriendsModal(); openAddFriendModal();" style="background: linear-gradient(135deg, var(--primary), #10b981); color: white; border: none; padding: 10px 24px; border-radius: 12px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">Add Friends</button>
                </div>
            `;
            return;
        }

        container.innerHTML = friends.map(friend => {
            const initials = (friend.friend_name || '?').charAt(0).toUpperCase();
            const friendName = (friend.friend_name || 'Friend').replace(/'/g, "\\'");
            const friendPhoto = (friend.friend_photo || '').replace(/'/g, "\\'");
            const photoHtml = friend.friend_photo
                ? `<img src="${friend.friend_photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" onerror="this.parentElement.innerHTML='${initials}'">`
                : initials;

            return `
                <div style="display: flex; align-items: center; padding: 10px 20px; border-bottom: 1px solid #f8fafc;">
                    <div onclick="closeHomeFriendsModal(); viewUserProfile('${friend.friend_id}', '${friendName}', '${friendPhoto}');" style="display: flex; align-items: center; gap: 12px; flex: 1; cursor: pointer; min-width: 0;">
                        <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #10b981); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 1.1rem; overflow: hidden; flex-shrink: 0;">
                            ${photoHtml}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; color: var(--text-main); font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${friend.friend_name || 'Friend'}</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted);">View profile</div>
                        </div>
                    </div>
                    <button onclick="closeHomeFriendsModal(); openDirectMessage('${friend.friend_id}', '${friendName}', '${friendPhoto}');" style="width: 36px; height: 36px; background: #f1f5f9; border: none; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" title="Message">
                        <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: var(--text-muted);"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                    </button>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading home friends modal:', error);
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: #ef4444; font-size: 0.85rem;">Failed to load friends</div>';
    }
}

// Load group chats into the messages panel
async function loadPanelGroupChats() {
    const container = document.getElementById('panel-group-chats');
    if (!container || !window.currentUser) return;

    container.innerHTML = '<div style="text-align: center; padding: 15px; color: var(--text-muted); font-size: 0.85rem;">Loading...</div>';

    try {
        const { data: chats, error } = await window.supabaseClient
            .rpc('get_user_group_chats', { user_uuid: window.currentUser.id });

        if (error) throw error;

        if (!chats || chats.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">
                    <div style="margin-bottom: 8px;">No group chats yet</div>
                    <button onclick="openCreateGroupChatModal(); closeFeedMessagesPanel();" style="background: var(--primary); color: white; border: none; padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">Create One</button>
                </div>
            `;
            return;
        }

        container.innerHTML = chats.map(chat => {
            const timeAgo = chat.last_message_at ? getTimeAgo(new Date(chat.last_message_at)) : '';
            const preview = chat.last_message ? (chat.last_message.length > 40 ? chat.last_message.substring(0, 40) + '...' : chat.last_message) : 'No messages yet';

            return `
                <div onclick="openGroupChat('${chat.chat_id}', '${escapeHtml(chat.chat_name)}', '${escapeHtml(chat.member_names || '')}'); closeFeedMessagesPanel();" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; cursor: pointer; transition: background 0.2s; background: #f8fafc;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
                    <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #10b981); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.1rem; flex-shrink: 0;">💬</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="font-weight: 600; color: var(--text-main); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(chat.chat_name)}</div>
                            ${timeAgo ? `<div style="font-size: 0.7rem; color: var(--text-muted); flex-shrink: 0; margin-left: 8px;">${timeAgo}</div>` : ''}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${chat.last_message_by ? `<span style="font-weight: 500;">${escapeHtml(chat.last_message_by)}:</span> ` : ''}${escapeHtml(preview)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading panel group chats:', error);
        container.innerHTML = '<div style="text-align: center; padding: 15px; color: var(--text-muted); font-size: 0.85rem;">Failed to load chats</div>';
    }
}

// Cache of friend data keyed by friend_id — populated by loadPanelFriends so that
// click handlers can look up name/photo without embedding them in HTML attributes
// (avoids escaping issues with quotes/special chars in inline onclick strings).
window._panelFriendCache = {};

// Load friends into the messages panel
async function loadPanelFriends() {
    const container = document.getElementById('panel-friends-list');
    const countEl = document.getElementById('panel-friends-count');
    if (!container || !window.currentUser) return;

    container.innerHTML = '<div style="text-align: center; padding: 15px; color: var(--text-muted); font-size: 0.85rem;">Loading...</div>';

    try {
        let friends = await db.friends.getFriendsWithFallback(window.currentUser.id) || [];

        // Resolve coach ID for pinning to top later
        const coachId = window._coachUserId || await getCoachUserId();

        // Also pull anyone who has messaged me recently via the `nudges` table,
        // so DM senders who aren't (yet) in the friends list still show up in
        // the inbox. Without this, messages from non-friends are invisible.
        const friendIdSet = new Set(friends.map(f => f.friend_id));
        try {
            const { data: recentMsgs, error: msgErr } = await window.supabaseClient
                .from('nudges')
                .select('sender_id, created_at')
                .eq('receiver_id', window.currentUser.id)
                .order('created_at', { ascending: false })
                .limit(200);

            if (!msgErr && recentMsgs && recentMsgs.length) {
                const extraSenderIds = [];
                const seen = new Set();
                recentMsgs.forEach(m => {
                    if (!m.sender_id) return;
                    if (m.sender_id === window.currentUser.id) return;
                    if (friendIdSet.has(m.sender_id)) return;
                    if (seen.has(m.sender_id)) return;
                    seen.add(m.sender_id);
                    extraSenderIds.push(m.sender_id);
                });

                if (extraSenderIds.length) {
                    const { data: senderProfiles, error: profErr } = await window.supabaseClient
                        .from('users')
                        .select('id, name, profile_photo')
                        .in('id', extraSenderIds);
                    if (!profErr && senderProfiles) {
                        senderProfiles.forEach(u => {
                            friends.push({
                                friend_id: u.id,
                                friend_name: u.name || 'User',
                                friend_photo: u.profile_photo || '',
                                _nonFriendSender: true
                            });
                            friendIdSet.add(u.id);
                        });
                    }
                }
            } else if (msgErr) {
                console.warn('[Inbox] Could not load recent DM senders:', msgErr.message);
            }
        } catch (e) {
            console.warn('[Inbox] Recent DM sender lookup failed:', e.message);
        }

        if (countEl) {
            countEl.textContent = friends.length === 0 ? '0 friends' :
                                  friends.length === 1 ? '1 friend' :
                                  `${friends.length} friends`;
        }

        if (!friends || friends.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">
                    <p style="margin: 0 0 10px 0;">Add friends to message them!</p>
                    <button onclick="closeFeedMessagesPanel(); openAddFriendModal();" style="background: var(--primary); color: white; border: none; padding: 8px 16px; border-radius: 10px; font-size: 0.85rem; font-weight: 600; cursor: pointer;">Add Friends</button>
                </div>
            `;
            return;
        }

        const unreadSenders = getUnreadSenderIds();

        // Sort: coach pinned first, then unread/pending, then the rest.
        friends.sort((a, b) => {
            // Coach always first
            if (coachId) {
                if (a.friend_id === coachId) return -1;
                if (b.friend_id === coachId) return 1;
            }
            const aPending = (unreadSenders.indexOf(a.friend_id) !== -1 || a._nonFriendSender) ? 1 : 0;
            const bPending = (unreadSenders.indexOf(b.friend_id) !== -1 || b._nonFriendSender) ? 1 : 0;
            return bPending - aPending;
        });

        // Store friend data in cache so click handlers don't need to embed it in HTML
        window._panelFriendCache = {};
        friends.forEach(friend => {
            window._panelFriendCache[friend.friend_id] = {
                id: friend.friend_id,
                name: friend.friend_name || 'Friend',
                photo: friend.friend_photo || ''
            };
        });

        container.innerHTML = friends.map(friend => {
            const initials = (friend.friend_name || '?').charAt(0).toUpperCase();
            const photoHtml = friend.friend_photo
                ? `<img src="${friend.friend_photo}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.textContent='${initials}'">`
                : initials;
            const hasUnread = unreadSenders.indexOf(friend.friend_id) !== -1;

            return `
                <div data-friend-id="${friend.friend_id}" class="panel-friend-row" style="display: flex; align-items: center; padding: 10px 0; cursor: pointer; border-bottom: 1px solid #f1f5f9;">
                    <div style="position: relative; margin-right: 12px; flex-shrink: 0;">
                        <div style="width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #10b981); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1rem; overflow: hidden;">
                            ${photoHtml}
                        </div>
                        <div class="dm-unread-dot" data-sender-id="${friend.friend_id}" style="display: ${hasUnread ? 'block' : 'none'}; position: absolute; top: -2px; right: -2px; width: 14px; height: 14px; background: #ef4444; border-radius: 50%; border: 2.5px solid white; z-index: 1;"></div>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: ${hasUnread ? '700' : '600'}; color: var(--text-main); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${friend.friend_name || 'Friend'}</div>
                        <div style="font-size: 0.75rem; color: ${hasUnread ? '#ef4444' : 'var(--text-muted)'}; font-weight: ${hasUnread ? '600' : 'normal'};">${hasUnread ? 'New message' : 'Tap to message'}</div>
                    </div>
                    <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: ${hasUnread ? '#ef4444' : 'var(--text-muted)'}; flex-shrink: 0;"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                </div>
            `;
        }).join('');

        // Attach click listeners via JS (more reliable than inline onclick on Android)
        container.querySelectorAll('.panel-friend-row').forEach(row => {
            row.addEventListener('click', function() {
                const friendId = this.getAttribute('data-friend-id');
                const f = window._panelFriendCache[friendId];
                if (f) {
                    openDirectMessage(f.id, f.name, f.photo);
                    closeFeedMessagesPanel();
                }
            });
        });

        // Highlight unresponded conversations for admin users
        if (typeof applyUnrespondedHighlights === 'function') {
            applyUnrespondedHighlights();
        }

    } catch (error) {
        console.error('Error loading panel friends:', error);
        container.innerHTML = '<div style="text-align: center; padding: 15px; color: #ef4444; font-size: 0.85rem;">Failed to load friends</div>';
    }
}

// Simple toast notification
function showToast(message, type = 'info') {
    // Remove any existing toast
    const existingToast = document.querySelector('.friend-toast');
    if (existingToast) existingToast.remove();

    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };

    const toast = document.createElement('div');
    toast.className = 'friend-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: ${colors[type]};
        color: white;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 10010;
        animation: fadeInUp 0.3s ease-out;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOutDown 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add CSS for toast animations if not already present
if (!document.getElementById('friend-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'friend-toast-styles';
    style.textContent = `
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeOutDown {
            from { opacity: 1; transform: translateX(-50%) translateY(0); }
            to { opacity: 0; transform: translateX(-50%) translateY(20px); }
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

// Load referral stats and friends when community tab is opened
_runWhenDomReady(() => {
    // Attach to tab switching logic
    const originalShowSupportTab = window.showSupportTab;
    if (typeof originalShowSupportTab === 'function') {
        window.showSupportTab = function(tab, element) {
            originalShowSupportTab(tab, element);
            if (tab === 'community') {
                loadReferralStats();
                updateFriendsCount();
                loadPendingFriendRequests(); // Check for new friend requests
            }
        };
    }
});

// --- THEME SYSTEM ---
// --- THEME SYSTEM ---
const APP_THEMES = {
    'default': {
        name: 'Forest (Premium)',
        colors: {
            '--primary': '#7BA883',
            '--primary-light': '#98C9A3',
            '--secondary': '#E8D68E',
            '--secondary-light': '#F2E5B0',
            '--accent-green': '#f2f7f4',
            '--bg': '#f9f9f7',
            '--surface': '#ffffff',
            '--text-main': '#1a202c',
            '--text-muted': '#718096',
            '--chat-bg-user': '#7BA883',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#f2f7f4',
            '--chat-text-coach': '#1a202c',
            '--chat-border-coach': '#e2e8f0'
        }
    },
    'flower-garden': {
        name: 'Flower Garden',
        colors: {
            '--primary': '#D98B9C',
            '--primary-light': '#F4B4C4',
            '--secondary': '#B4A7D6',
            '--secondary-light': '#D0C8E8',
            '--accent-green': '#FFF8F5',
            '--bg': '#FFFBF9',
            '--surface': '#ffffff',
            '--text-main': '#4A3F44',
            '--text-muted': '#8B7D82',
            '--chat-bg-user': '#D98B9C',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#FFF8F5',
            '--chat-text-coach': '#4A3F44',
            '--chat-border-coach': '#F4B4C4'
        }
    },
    'antigravity-light': {
        name: 'Antigravity Light',
        colors: {
            '--primary': '#4f46e5',
            '--primary-light': '#6366f1',
            '--secondary': '#0891b2',
            '--secondary-light': '#22D3EE',
            '--accent-green': '#eff6ff',
            '--bg': '#ffffff',
            '--surface': '#f8fafc',
            '--text-main': '#0f172a',
            '--text-muted': '#64748b',
            '--chat-bg-user': '#4f46e5',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#f1f5f9',
            '--chat-text-coach': '#0f172a',
            '--chat-border-coach': '#e2e8f0'
        }
    },
    'ocean': {
        name: 'Ocean Calm',
        colors: {
            '--primary': '#0369a1',
            '--primary-light': '#0ea5e9',
            '--secondary': '#db2777',
            '--secondary-light': '#F472B6',
            '--accent-green': '#f0f9ff', 
            '--bg': '#f0f9ff', 
            '--surface': '#ffffff', 
            '--text-main': '#082f49', 
            '--text-muted': '#64748b',
            '--chat-bg-user': '#0369a1',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#f1f5f9',
            '--chat-text-coach': '#082f49',
            '--chat-border-coach': '#e0f2fe'
        } 
    },
    'sunset': {
        name: 'Sunset Glow',
        colors: {
            '--primary': '#9d174d',
            '--primary-light': '#be123c',
            '--secondary': '#ea580c',
            '--secondary-light': '#FB923C',
            '--accent-green': '#fff1f2', 
            '--bg': '#fff1f2', 
            '--surface': '#ffffff', 
            '--text-main': '#500724', 
            '--text-muted': '#9d174d',
            '--chat-bg-user': '#9d174d',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#fff5f5',
            '--chat-text-coach': '#500724',
            '--chat-border-coach': '#ffe4e6'
        } 
    },
    'cycle-pink': {
        name: 'Cycle Harmony',
        colors: {
            '--primary': '#D81B60',
            '--primary-light': '#F06292',
            '--secondary': '#AB47BC',
            '--secondary-light': '#CE93D8',
            '--accent-green': '#FCE4EC',
            '--bg': '#FCE4EC',
            '--surface': '#ffffff',
            '--text-main': '#880E4F',
            '--text-muted': '#AD1457',
            '--chat-bg-user': '#D81B60',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#F8BBD0',
            '--chat-text-coach': '#880E4F',
            '--chat-border-coach': '#F48FB1'
        }
    },
    'midnight': {
        name: 'Midnight Luxe',
        colors: {
            '--primary': '#0f172a', // Slate 900
            '--primary-light': '#1e293b', // Slate 800
            '--secondary': '#fbbf24', // Amber 400
            '--secondary-light': '#FDE68A', // Amber 200
            '--accent-green': '#334155', // Slate 700
            '--bg': '#020617', // Slate 950
            '--surface': '#1e293b', // Slate 800
            '--text-main': '#f8fafc', // Slate 50
            '--text-muted': '#94a3b8', // Slate 400
            '--chat-bg-user': '#3b82f6',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#1e293b',
            '--chat-text-coach': '#f8fafc',
            '--chat-border-coach': '#334155'
        }
    },
    'lavender': {
        name: 'Lavender Haze',
        colors: {
            '--primary': '#6b21a8', // Purple 800
            '--primary-light': '#7e22ce', // Purple 700
            '--secondary': '#fcd34d', // Amber 300
            '--secondary-light': '#FEF08A', // Yellow 200
            '--accent-green': '#faf5ff', // Purple 50
            '--bg': '#faf5ff', 
            '--surface': '#ffffff',
            '--text-main': '#4c1d95',
            '--text-muted': '#9333ea',
            '--chat-bg-user': '#6b21a8',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#f3e8ff',
            '--chat-text-coach': '#4c1d95',
            '--chat-border-coach': '#e9d5ff'
        }
    },
    'matcha': {
        name: 'Matcha Latte',
        colors: {
            '--primary': '#3f6212', // Lime 800
            '--primary-light': '#4d7c0f', // Lime 700
            '--secondary': '#a3e635', // Lime 400
            '--secondary-light': '#D9F99D', // Lime 200
            '--accent-green': '#f7fee7', // Lime 50
            '--bg': '#f7fee7',
            '--surface': '#ffffff',
            '--text-main': '#1a2e05',
            '--text-muted': '#4d7c0f',
            '--chat-bg-user': '#3f6212',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#ecfccb',
            '--chat-text-coach': '#1a2e05',
            '--chat-border-coach': '#d9f99d'
        }
    },
    'monochrome': {
        name: 'Monochrome',
        colors: {
            '--primary': '#1a1a1a', // Near black
            '--primary-light': '#333333', // Dark gray
            '--secondary': '#666666', // Medium gray
            '--secondary-light': '#A3A3A3', // Light gray
            '--accent-green': '#f5f5f5', // Light gray
            '--bg': '#ffffff', // White
            '--surface': '#fafafa', // Off-white
            '--text-main': '#1a1a1a', // Near black
            '--text-muted': '#737373', // Gray
            '--chat-bg-user': '#1a1a1a',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#f5f5f5',
            '--chat-text-coach': '#1a1a1a',
            '--chat-border-coach': '#e5e5e5'
        }
    },
    'dbz-warrior': {
        name: 'Blaze',
        maleOnly: true,
        colors: {
            '--primary': '#FF6B00', // Fire orange
            '--primary-light': '#FF8C00', // Lighter orange
            '--secondary': '#FFD700', // Gold
            '--secondary-light': '#FDE68A', // Light gold
            '--accent-green': '#FFF8E7', // Warm light background
            '--bg': '#FFFAF0', // Floral white warm
            '--surface': '#ffffff',
            '--text-main': '#1a1a1a',
            '--text-muted': '#8B4513', // Saddle brown
            '--chat-bg-user': '#FF6B00',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#FFF8E7',
            '--chat-text-coach': '#1a1a1a',
            '--chat-border-coach': '#FFD700'
        }
    },
    'dbz-vegeta': {
        name: 'Prestige',
        maleOnly: true,
        colors: {
            '--primary': '#0047AB', // Royal blue
            '--primary-light': '#1E90FF', // Dodger blue
            '--secondary': '#FFD700', // Gold
            '--secondary-light': '#FDE68A', // Light gold
            '--accent-green': '#F0F8FF', // Alice blue
            '--bg': '#F5F9FF', // Light blue tint
            '--surface': '#ffffff',
            '--text-main': '#0a1628',
            '--text-muted': '#4a5568',
            '--chat-bg-user': '#0047AB',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#F0F8FF',
            '--chat-text-coach': '#0a1628',
            '--chat-border-coach': '#87CEEB'
        }
    },
    'sailor-moon': {
        name: 'Blossom',
        femaleOnly: true,
        colors: {
            '--primary': '#FF69B4', // Hot pink
            '--primary-light': '#FFB6C1', // Light pink
            '--secondary': '#FFD700', // Gold
            '--secondary-light': '#FDE68A', // Light gold
            '--accent-green': '#FFF0F5', // Lavender blush
            '--bg': '#FFF5FA', // Light pink background
            '--surface': '#ffffff',
            '--text-main': '#1a1a1a',
            '--text-muted': '#8B4789', // Purple-ish
            '--chat-bg-user': '#FF69B4',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#FFF0F5',
            '--chat-text-coach': '#1a1a1a',
            '--chat-border-coach': '#FFD700'
        }
    },
    'sailor-venus': {
        name: 'Golden Hour',
        femaleOnly: true,
        colors: {
            '--primary': '#FFA500', // Warm orange
            '--primary-light': '#FFB84D', // Light orange
            '--secondary': '#FFD700', // Gold
            '--secondary-light': '#FDE68A', // Light gold
            '--accent-green': '#FFF8DC', // Cornsilk
            '--bg': '#FFFAF0', // Floral white
            '--surface': '#ffffff',
            '--text-main': '#1a1a1a',
            '--text-muted': '#B8860B', // Dark goldenrod
            '--chat-bg-user': '#FFA500',
            '--chat-text-user': '#ffffff',
            '--chat-bg-coach': '#FFF8DC',
            '--chat-text-coach': '#1a1a1a',
            '--chat-border-coach': '#FFD700'
        }
    }
};

// Function to create falling flower animation for flower-garden theme
function createFallingFlowerAnimation() {
    const flowerAssets = [
        'assets/flower-cherry-blossom.svg',
        'assets/flower-rose.svg',
        'assets/flower-daisy.svg',
        'assets/flower-peony.svg',
        'assets/flower-lavender.svg'
    ];

    const numberOfFlowers = 15; // Number of flowers to fall
    const containerWidth = window.innerWidth;

    for (let i = 0; i < numberOfFlowers; i++) {
        setTimeout(() => {
            const flower = document.createElement('div');
            flower.className = 'falling-flower';

            // Random flower type
            const randomFlower = flowerAssets[Math.floor(Math.random() * flowerAssets.length)];
            flower.style.backgroundImage = `url('${randomFlower}')`;

            // Random horizontal position
            const randomX = Math.random() * containerWidth;
            flower.style.left = randomX + 'px';
            flower.style.top = '-100px';

            // Random size variation (30px to 50px)
            const randomSize = 30 + Math.random() * 20;
            flower.style.width = randomSize + 'px';
            flower.style.height = randomSize + 'px';

            // Random animation duration (4s to 7s for graceful fall)
            const randomDuration = 4 + Math.random() * 3;
            flower.style.animation = `flowerFall ${randomDuration}s ease-in-out forwards`;

            // Random delay for staggered effect
            flower.style.animationDelay = (Math.random() * 0.5) + 's';

            document.body.appendChild(flower);

            // Remove flower element after animation completes
            setTimeout(() => {
                if (flower.parentNode) {
                    flower.parentNode.removeChild(flower);
                }
            }, (randomDuration + 0.5) * 1000);
        }, i * 200); // Stagger the creation of flowers
    }
}

async function _applyAppThemeRealImpl(themeKey) {
    const theme = APP_THEMES[themeKey];
    if(!theme) return;

    // DBZ themes are restricted to male users only, Sailor Moon themes to female users only
    const isMale = (typeof isMaleUser === 'function' && isMaleUser());
    const isFemale = !isMale;
    if ((theme.maleOnly && !isMale) || (theme.femaleOnly && !isFemale)) {
        // User trying to use gender-restricted theme - fall back to default
        themeKey = 'default';
        const defaultTheme = APP_THEMES['default'];
        for (const [key, value] of Object.entries(defaultTheme.colors)) {
            document.documentElement.style.setProperty(key, value);
        }
        // Skip localStorage and DB writes in admin view-as mode
        if (!window.isAdminViewing) {
            localStorage.setItem('userThemePreference', 'default');
            if (window.currentUser?.id && typeof dbHelpers !== 'undefined') {
                try {
                    await dbHelpers.users.update(window.currentUser.id, { theme_preference: 'default' });
                    console.log("Theme preference saved to DB: default");
                } catch (e) {
                    console.warn("Failed to save theme preference to DB:", e);
                }
            }
        }
        const selector = document.getElementById('theme-selector');
        if(selector) selector.value = 'default';
        return;
    }

    for (const [key, value] of Object.entries(theme.colors)) { document.documentElement.style.setProperty(key, value); }

    // Skip localStorage and DB writes in admin view-as mode to prevent theme leakage
    if (!window.isAdminViewing) {
        localStorage.setItem('userThemePreference', themeKey);

        // CRITICAL: Save theme preference to Supabase for persistence across cache clears
        if (window.currentUser?.id && typeof dbHelpers !== 'undefined') {
            try {
                await dbHelpers.users.update(window.currentUser.id, { theme_preference: themeKey });
                console.log("Theme preference saved to DB:", themeKey);
            } catch (e) {
                console.warn("Failed to save theme preference to DB:", e);
            }
        }
    }

    const selector = document.getElementById('theme-selector');
    if(selector) selector.value = themeKey;

    // Update dashboard-welcome background - keep gradient for all themes
    const welcomeSection = document.querySelector('.dashboard-welcome');
    if(welcomeSection) {
        // Always use dynamic theme gradient
        welcomeSection.style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)';
        welcomeSection.style.color = 'white';
        // Ensure all child elements use white text for maximum readability
        const children = welcomeSection.querySelectorAll('*');
        children.forEach(c => {
             c.style.color = 'white';
        });
    }

    // Handle DBZ theme decorations (male users only)
    const isDbzTheme = themeKey.startsWith('dbz-');

    // Handle Sailor Moon theme decorations (female users only)
    const isSailorMoonTheme = themeKey.startsWith('sailor-');

    // Easter egg: Show unlock message on first theme selection (male users only)
    if (isMale && isDbzTheme) {
        const easterEggKey = `theme_easter_egg_${themeKey}`;
        const hasSeenEasterEgg = localStorage.getItem(easterEggKey);

        if (!hasSeenEasterEgg) {
            localStorage.setItem(easterEggKey, 'true');
            const themeName = themeKey === 'dbz-warrior' ? 'Blaze' : 'Prestige';
            setTimeout(() => {
                if (typeof showToast === 'function') {
                    showToast(`🔥 ${themeName} theme unlocked!`, 'success');
                }
            }, 400);
        }
    }

    // Flower Garden theme animation - falling flowers on first selection (female users only)
    const isFlowerTheme = (themeKey === 'flower-garden');
    // isFemale is already defined above

    if (isFemale && isFlowerTheme) {
        const flowerEasterEggKey = 'flower_garden_animation_seen';
        const hasSeenFlowerAnimation = localStorage.getItem(flowerEasterEggKey);

        if (!hasSeenFlowerAnimation) {
            // Mark as seen so it only shows once
            localStorage.setItem(flowerEasterEggKey, 'true');

            // Trigger falling flower animation after a short delay to let theme apply
            setTimeout(() => {
                if (typeof createFallingFlowerAnimation === 'function') {
                    createFallingFlowerAnimation();
                }
            }, 300);
        }
    }

    const dbzDecorations = document.getElementById('dbz-decorations');
    if (dbzDecorations) {
        // Character corner decorations hidden pending replacement with original art
        dbzDecorations.style.display = 'none';
    }

    // Toggle body class for theme-specific styling
    if (isDbzTheme && isMale) {
        document.body.classList.add('dbz-theme-active');
        document.body.classList.remove('dbz-goku-theme', 'dbz-vegeta-theme');
        document.body.classList.add(themeKey === 'dbz-warrior' ? 'dbz-goku-theme' : 'dbz-vegeta-theme');
    } else {
        document.body.classList.remove('dbz-theme-active', 'dbz-goku-theme', 'dbz-vegeta-theme');
    }

    // Theme character decorations hidden pending replacement with original art
    const sailorDecorations = document.getElementById('sailor-decorations');
    if (sailorDecorations) {
        sailorDecorations.style.display = 'none';
    }

    // Toggle Sailor Moon body class for additional styling
    if (isSailorMoonTheme && isFemale) {
        document.body.classList.add('sailor-theme-active');
        // Add specific class for each character's theme
        document.body.classList.remove('sailor-moon-theme', 'sailor-venus-theme');
        document.body.classList.add(themeKey === 'sailor-moon' ? 'sailor-moon-theme' : 'sailor-venus-theme');
    } else {
        document.body.classList.remove('sailor-theme-active', 'sailor-moon-theme', 'sailor-venus-theme');
    }

    // Handle Flower Garden decorations (female users only)
    const flowerDecorations = document.getElementById('flower-decorations');
    if (flowerDecorations) {
        flowerDecorations.style.display = (isFlowerTheme && isFemale) ? 'block' : 'none';
    }

    // Toggle Flower Garden body class for additional styling
    if (isFlowerTheme && isFemale) {
        document.body.classList.add('flower-theme-active');
    } else {
        document.body.classList.remove('flower-theme-active');
    }

    // Trigger icon toggle update
    updateSettingsIcon();
}

// Replace stub with real implementation
_applyAppThemeReal = _applyAppThemeRealImpl;
applyAppTheme = _applyAppThemeRealImpl;

// Reusable function to toggle settings icon and profile icon based on current theme
function updateSettingsIcon() {
    const savedTheme = localStorage.getItem('userThemePreference') || 'default';
    const isDbzTheme = savedTheme.startsWith('dbz-');
    const isSailorMoonTheme = savedTheme.startsWith('sailor-');
    const isMale = (typeof isMaleUser === 'function' && isMaleUser());
    const isFemale = !isMale;

    setTimeout(() => {
        // Update settings icon (gear vs flame for Blaze/Prestige themes)
        const gearIcon = document.getElementById('settings-icon-gear');
        const flameIcon = document.getElementById('settings-icon-dragonball');

        if (gearIcon && flameIcon) {
            if (isDbzTheme && isMale) {
                // Blaze/Prestige theme: show flame icon
                gearIcon.style.setProperty('display', 'none', 'important');
                flameIcon.style.setProperty('display', 'inline-block', 'important');
            } else {
                // Default: show gear
                gearIcon.style.setProperty('display', 'inline-block', 'important');
                flameIcon.style.setProperty('display', 'none', 'important');
            }
        }

        // Update profile icons (all instances with class profile-icon)
        const profileIcons = document.querySelectorAll('.profile-icon');
        profileIcons.forEach(icon => {
            if (isDbzTheme && isMale) {
                // Blaze/Prestige theme: show flame icon background
                icon.style.setProperty('background-image', 'url(assets/flame-icon.svg)', 'important');
                icon.style.setProperty('background-size', 'cover', 'important');
                icon.style.setProperty('background-position', 'center', 'important');
                icon.style.setProperty('color', 'transparent', 'important');
                icon.style.setProperty('font-size', '0', 'important');
            } else {
                // Default: remove dragon ball background, show "S"
                icon.style.removeProperty('background-image');
                icon.style.setProperty('background', 'var(--accent-green)', 'important');
                icon.style.setProperty('color', 'var(--primary)', 'important');
                icon.style.setProperty('font-size', '', 'important');
                console.log('✅ Standard profile icon activated');
            }
        });
    }, 50); // Small delay to ensure DOM is ready
}

// Diagnostic function for debugging Dragon Ball icons
function debugDragonBallIcon() {
    const profileIconElements = document.querySelectorAll('.profile-icon');
    const firstProfileIcon = profileIconElements[0];

    const results = {
        userGender: localStorage.getItem('userGender'),
        isMale: isMaleUser(),
        currentTheme: localStorage.getItem('userThemePreference'),
        bodyClasses: Array.from(document.body.classList),
        hasDbzThemeActive: document.body.classList.contains('dbz-theme-active'),
        settingsGearIcon: {
            exists: !!document.getElementById('settings-icon-gear'),
            display: document.getElementById('settings-icon-gear')?.style.display,
            computedDisplay: window.getComputedStyle(document.getElementById('settings-icon-gear') || document.createElement('div')).display
        },
        settingsDragonBallIcon: {
            exists: !!document.getElementById('settings-icon-dragonball'),
            display: document.getElementById('settings-icon-dragonball')?.style.display,
            computedDisplay: window.getComputedStyle(document.getElementById('settings-icon-dragonball') || document.createElement('div')).display,
            src: document.getElementById('settings-icon-dragonball')?.src
        },
        profileIcons: {
            count: profileIconElements.length,
            firstIcon: firstProfileIcon ? {
                backgroundImage: window.getComputedStyle(firstProfileIcon).backgroundImage,
                color: window.getComputedStyle(firstProfileIcon).color,
                textContent: firstProfileIcon.textContent
            } : null
        }
    };

    console.log('=== Dragon Ball Icon Debug Info ===');
    console.table(results);
    console.log('Full results:', results);

    // Show user-friendly message
    if (results.isMale && results.currentTheme?.startsWith('dbz-')) {
        console.log('✅ DBZ theme active for male user');
        console.log('  → Settings: Dragon Ball should show, Gear should hide');
        console.log('  → Profile icon (top right S): Should show Dragon Ball background');

        if (!results.hasDbzThemeActive) {
            console.log('  ❌ body.dbz-theme-active class is MISSING');
        }
        if (results.profileIcons.firstIcon?.backgroundImage.includes('dragon-ball')) {
            console.log('  ✅ Profile icon has Dragon Ball background');
        } else {
            console.log('  ❌ Profile icon does NOT have Dragon Ball background');
        }
    } else {
        console.log('ℹ️ Dragon Ball icons should NOT be visible because:');
        if (!results.isMale) console.log('  - User is not male (gender: ' + results.userGender + ')');
        if (!results.currentTheme?.startsWith('dbz-')) console.log('  - Current theme is not DBZ (theme: ' + results.currentTheme + ')');
    }

    return results;
}

// Make functions available in console for debugging
window.debugDragonBallIcon = debugDragonBallIcon;
window.updateSettingsIcon = updateSettingsIcon;

// --- INITIALIZATION ---
_runWhenDomReady(() => {
    // Wait for Auth before loading user-specific data
    const waitForAuth = () => new Promise(resolve => {
        if(window.currentUser) return resolve(window.currentUser);
        const check = setInterval(() => {
            if(window.currentUser) { clearInterval(check); resolve(window.currentUser); }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(null); }, 3000);
    });

    waitForAuth().then(() => {
        // Only load user-specific data after auth is confirmed
        if(window.currentUser) {
            loadChatHistory();
            loadCommunityFeed();
            if (typeof loadHomeChallenges === 'function') loadHomeChallenges();

            // Auto-refresh steps challenges throughout the day.
            // Syncs native (HealthKit/Health Connect) steps to DB then recalculates
            // challenge points so the home card stays accurate without manual wearable sync.
            async function _refreshStepChallenges() {
                await syncNativeStepsForChallenges();
                await refreshChallengeProgress();
            }
            window._refreshStepChallenges = _refreshStepChallenges;

            // Run immediately on load, then every 30 minutes
            setTimeout(_refreshStepChallenges, 8000);
            setInterval(_refreshStepChallenges, 30 * 60 * 1000);

            // Also refresh when user returns to the app (tab/screen focus)
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    _refreshStepChallenges();
                }
            });

            // Subscribe to Realtime updates for new coach messages
            subscribeToCoachMessages(window.currentUser.id);
        }
        checkUserRole();
        // Theme is now applied in the main initialization sequence after gender is loaded
    });

    // Event Listeners (Community only - Coach uses form onsubmit)
    document.getElementById('community-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendCommunityMessage(); });
});
