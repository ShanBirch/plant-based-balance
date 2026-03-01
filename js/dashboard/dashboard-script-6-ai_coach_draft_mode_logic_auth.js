// --- AI COACH DRAFT MODE LOGIC & AUTHENTICATION ---
// Overrides and Extensions for the Coach Command Center

let isCoachMode = false;


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
document.addEventListener('DOMContentLoaded', () => {
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
                                const msgs = JSON.parse(localStorage.getItem('community_chat_history') || '[]');
                                msgs.push({
                                    authorId: responder.id,
                                    authorName: responder.name,
                                    authorAvatar: responder.id.replace('m', ''),
                                    text: part,
                                    timestamp: Date.now()
                                });
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
window.showDMNotificationBanner = function showDMNotificationBanner(senderName, senderPhoto, messageText, senderId) {
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

            if (isQuizBattle) {
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
        dot.style.display = senders.indexOf(sid) !== -1 ? 'block' : 'none';
    });
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
 * Subscribe to Supabase Realtime for new DMs (nudges) to this user
 * Messages appear instantly when coach (or anyone) sends a nudge
 */
window.subscribeToCoachMessages = function(userId) {
    if (!userId || !window.supabaseClient) return;

    // Track message IDs we've already shown to avoid duplicates
    window._shownMessageIds = window._shownMessageIds || new Set();

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
                    showDMNotificationBanner(senderName, senderPhoto, newMessage.message, newMessage.sender_id);

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
                .select('id, sender_id, receiver_id, message, created_at')
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

            // Ensure dedup set exists
            window._shownMessageIds = window._shownMessageIds || new Set();

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

                    showDMNotificationBanner(senderName, senderPhoto, msg.message, msg.sender_id);
                    playNotificationSound();
                    updateMessageBadges((window._unreadDMCount || 0) + 1);
                    addUnreadSender(msg.sender_id);
                }
            }
        } catch (e) {
            console.warn('[DMPoll] Error:', e);
        }
    }, 5000); // Poll every 5 seconds for responsive notifications
}

window.openCoachChat = function() {
    openCoachChatModal();

    // Clear unread flag
    localStorage.removeItem('coach_unread_messages');

    // Clear coach from unread senders
    if (window._coachUserId) clearUnreadSender(window._coachUserId);

    // Clear all message badges
    clearMessageBadges();
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

// Share via WhatsApp
function shareViaWhatsApp() {
    const code = currentReferralCode;
    const link = `${window.location.origin}/login.html?ref=${code}`;
    const message = `Hey! Join me on FITGotchi. Gamify your fitness - I'm really loving it! We BOTH get 1 week double XP! Use my code ${code} or click here: ${link}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

// Share via Facebook
function shareViaFacebook() {
    const code = currentReferralCode;
    const link = `${window.location.origin}/login.html?ref=${code}`;
    const message = `Hey! Join me on FITGotchi. Gamify your fitness - I'm really loving it! We BOTH get 1 week double XP! Use my code ${code}`;

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // Try Messenger app on mobile
        window.location.href = `fb-messenger://share?link=${encodeURIComponent(link)}&app_id=`;
    } else {
        // Use standard Facebook Sharer on desktop (allows sharing to Feed, Groups, or Messenger)
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(message)}`;
        window.open(fbUrl, '_blank', 'width=600,height=400');
    }
}

// Share via SMS
function shareViaSMS() {
    const code = currentReferralCode;
    const link = `${window.location.origin}/login.html?ref=${code}`;
    const message = `Hey! Join me on FITGotchi. Gamify your fitness - I'm really loving it! We BOTH get 1 week double XP! Use code ${code} or click: ${link}`;

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
        const friends = await db.friends.getFriendsWithFallback(window.currentUser.id);

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

let currentChallengeId = null;
let challengeChart = null;

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
        console.log('⚔️ [loadHomeChallenges] Fetching from RPC get_user_challenges...');
        const { data: challenges, error } = await window.supabaseClient
            .rpc('get_user_challenges', { user_uuid: window.currentUser.id });

        if (error) {
            console.error('⚔️ [loadHomeChallenges] RPC ERROR:', error);
            throw error;
        }

        console.log('⚔️ [loadHomeChallenges] Records fetched:', challenges?.length || 0);

        // Filter active challenges, pending challenges (waiting for friends), and pending invites
        const activeChallenges = (challenges || []).filter(c =>
            c.status === 'active' && c.user_status === 'accepted'
        );
        const pendingChallenges = (challenges || []).filter(c =>
            c.status === 'pending' && c.user_status === 'accepted'
        );
        const pendingInvites = (challenges || []).filter(c => c.user_status === 'invited');

        console.log('⚔️ [loadHomeChallenges] Counts - Active:', activeChallenges.length, 'Pending:', pendingChallenges.length, 'Invites:', pendingInvites.length);

        const hasChallenges = activeChallenges.length > 0 || pendingInvites.length > 0 || pendingChallenges.length > 0;

        // Hide the "Start" card when there are challenges
        if (emptyState) emptyState.style.display = 'none';

        let html = '';

        // Show pending invites first — fetch extra details (entry_fee, rare_reward_id) per challenge
        if (pendingInvites.length > 0) {
            // Batch fetch challenge details for invite cards
            const challengeIds = pendingInvites.map(c => c.challenge_id);
            let challengeDetails = {};
            try {
                const { data: details } = await window.supabaseClient
                    .from('challenges')
                    .select('id, entry_fee, rare_reward_id')
                    .in('id', challengeIds);
                if (details) {
                    details.forEach(d => challengeDetails[d.id] = d);
                }
            } catch (e) { console.warn('Could not fetch challenge details for invites:', e); }

            html += pendingInvites.map(challenge => {
                const detail = challengeDetails[challenge.challenge_id] || {};
                const entryFee = detail.entry_fee || 1000;
                const rareId = detail.rare_reward_id;
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
        html += pendingChallenges.slice(0, 3).map(challenge => {
            const cType = CHALLENGE_TYPES[challenge.challenge_type] || CHALLENGE_TYPES.xp;
            return `
            <div onclick="openChallengeLeaderboard('${challenge.challenge_id}')" style="cursor: pointer; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 15px rgba(245,158,11,0.2); background: linear-gradient(135deg, #f59e0b 0%, #eab308 100%); margin-bottom: 12px;">
                <div style="padding: 18px 20px; display: flex; align-items: center; gap: 14px;">
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
            </div>
        `}).join('');

        // Show active challenges
        html += activeChallenges.slice(0, 3).map(challenge => {
            const cType = CHALLENGE_TYPES[challenge.challenge_type] || CHALLENGE_TYPES.xp;
            return `
            <div onclick="openChallengeLeaderboard('${challenge.challenge_id}')" style="cursor: pointer; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 15px rgba(124,58,237,0.2); background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); margin-bottom: 12px;">
                <div style="padding: 18px 20px; display: flex; align-items: center; gap: 14px;">
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
                        <div style="font-size: 1.2rem; font-weight: 800; color: white;">${typeof formatChallengePoints === 'function' ? formatChallengePoints(challenge.user_points, challenge.challenge_type || 'xp') : challenge.user_points}</div>
                    </div>
                </div>
            </div>
        `}).join('');

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading home challenges:', error);
    }
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
                                <div style="font-size: 1.2rem; font-weight: 700; color: var(--text-main);">${typeof formatChallengePoints === 'function' ? formatChallengePoints(challenge.user_points, challenge.challenge_type || 'xp') : challenge.user_points}</div>
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

// Challenge type definitions
const CHALLENGE_TYPES = {
    xp:       { emoji: '⚡', name: 'Level Up',  desc: 'Most XP earned', subtitle: '30-day XP battle with friends', color: '#c084fc', howStep2: 'Earn <strong style="color: #4ade80;">double XP</strong> on everything for 30 days.', howStep3: 'Most <strong style="color: #c084fc;">XP</strong> at the end wins.' },
    workouts: { emoji: '💪', name: 'Workout',   desc: 'Most workouts logged', subtitle: '30-day workout challenge', color: '#ef4444', howStep2: 'Log your <strong style="color: #4ade80;">workouts</strong> consistently for 30 days.', howStep3: 'Most <strong style="color: #ef4444;">workouts logged</strong> wins.' },
    volume:   { emoji: '🏋️', name: 'Volume',    desc: 'Most total kg lifted', subtitle: '30-day volume challenge', color: '#fb923c', howStep2: 'Track your <strong style="color: #4ade80;">lifting volume</strong> for 30 days.', howStep3: 'Most <strong style="color: #fb923c;">total kg lifted</strong> wins.' },
    calories: { emoji: '🍎', name: 'Calories',  desc: 'Most days hitting calorie goal', subtitle: '30-day calorie challenge', color: '#4ade80', howStep2: 'Hit your <strong style="color: #4ade80;">calorie goals</strong> consistently for 30 days.', howStep3: 'Most <strong style="color: #4ade80;">days hitting goal</strong> wins.' },
    steps:    { emoji: '👟', name: 'Steps',     desc: 'Most total steps', subtitle: '30-day step challenge', color: '#3b82f6', howStep2: 'Track your <strong style="color: #4ade80;">steps</strong> every day for 30 days.', howStep3: 'Most <strong style="color: #3b82f6;">total steps</strong> wins.' },
    streak:   { emoji: '🔥', name: 'Streak',    desc: 'Longest streak kept', subtitle: '30-day streak challenge', color: '#fbbf24', howStep2: 'Keep your <strong style="color: #4ade80;">streak alive</strong> for 30 days.', howStep3: 'Longest <strong style="color: #fbbf24;">streak kept</strong> wins.' },
    sleep:    { emoji: '😴', name: 'Sleep',     desc: 'Most hours slept', subtitle: '30-day sleep challenge', color: '#818cf8', howStep2: 'Track your <strong style="color: #4ade80;">sleep</strong> consistently for 30 days.', howStep3: 'Most <strong style="color: #818cf8;">hours slept</strong> wins.' },
    water:    { emoji: '💧', name: 'Water',     desc: 'Most days hitting water goal', subtitle: '30-day hydration challenge', color: '#0ea5e9', howStep2: 'Hit your <strong style="color: #4ade80;">water goals</strong> consistently for 30 days.', howStep3: 'Most <strong style="color: #0ea5e9;">days hitting goal</strong> wins.' },
    milestone:{ emoji: '🎯', name: 'Milestone', desc: 'First to hit the target', subtitle: 'Race to a goal', color: '#f97316', howStep2: 'Work toward the <strong style="color: #4ade80;">target</strong> in your workouts.', howStep3: '<strong style="color: #f97316;">First to hit the milestone</strong> wins the race.' }
};

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
                const viewer = document.getElementById('challenge-rare-viewer');
                if (viewer) viewer.setAttribute('src', rare.model);
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
        // Reset wager to default
        createChallengeBetAmount = 1000;
        const feeDisplay = document.getElementById('create-challenge-fee-display');
        if (feeDisplay) feeDisplay.textContent = '1,000 Coins entry fee';
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
        // Reset wager buttons
        document.querySelectorAll('.create-challenge-bet-btn').forEach((b, i) => {
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

// Create challenge bet amount (for the create modal)
let createChallengeBetAmount = 1000;

window._setCreateChallengeBet = function(amount, btnEl) {
    if (amount < CHALLENGE_MIN_BET && amount !== 0) {
        amount = CHALLENGE_MIN_BET;
    }
    createChallengeBetAmount = Math.max(amount, CHALLENGE_MIN_BET);

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

        closeCreateChallengeModal();
        if (typeof loadHomeChallenges === 'function') loadHomeChallenges();
        showToast('Challenge created! Invitations sent.', 'success');
        try { if (typeof checkChallengeBadges === 'function') checkChallengeBadges(); } catch(e) {}

    } catch (error) {
        console.error('⚔️ [createChallenge] CRITICAL ERROR:', error);
        alert('Failed to create challenge: ' + (error.message || 'Please try again'));
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

    // Fetch the challenge to get the entry_fee and rare_reward_id
    try {
        const { data: challenge } = await window.supabaseClient
            .from('challenges')
            .select('entry_fee, rare_reward_id, name')
            .eq('id', challengeId)
            .single();

        if (challenge) {
            window._pendingChallengeEntryFee = challenge.entry_fee || 1000;
            window._pendingChallengeRareId = challenge.rare_reward_id || null;
            window._pendingChallengeName = challenge.name || 'Challenge';
        } else {
            window._pendingChallengeEntryFee = 1000;
            window._pendingChallengeRareId = null;
            window._pendingChallengeName = 'Challenge';
        }
    } catch (e) {
        console.warn('Could not fetch challenge details:', e);
        window._pendingChallengeEntryFee = 1000;
        window._pendingChallengeRareId = null;
        window._pendingChallengeName = 'Challenge';
    }

    // Show the buy-in payment modal locked to the creator's entry fee
    showChallengePassModal(window._pendingChallengeEntryFee, window._pendingChallengeRareId);
}

// Actually accept the challenge
async function doAcceptChallenge(challengeId) {
    try {
        const { data, error } = await window.supabaseClient
            .rpc('accept_challenge_invitation', {
                challenge_uuid: challengeId,
                user_uuid: window.currentUser.id
            });

        if (error) throw error;

        // Refresh challenges on home screen
        if (typeof loadHomeChallenges === 'function') loadHomeChallenges();
        alert('Challenge accepted! Good luck!');

    } catch (error) {
        console.error('Error accepting challenge:', error);
        alert('Failed to accept challenge');
    }
}

// Show challenge buy-in modal (locked to the challenge's entry fee)
function showChallengePassModal(lockedEntryFee, rareRewardId) {
    const modal = document.getElementById('challenge-pass-modal');
    if (!modal) return;

    const entryFee = lockedEntryFee || 1000;
    currentChallengeBet = entryFee;

    const joinBtn = document.getElementById('buy-challenge-pass-btn');
    if (joinBtn) joinBtn.innerHTML = 'Spend 🪙 ' + entryFee.toLocaleString() + ' Coins &amp; Join';

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

// Spend coins to join a challenge (minimum 1,000 coins)
const CHALLENGE_MIN_BET = 1000;
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
            p_user_id: window.currentUser.id
        });

        if (rpcError) {
            console.error('⚔️ [spendCoinsToJoinChallenge] RPC ERROR:', rpcError);
            throw rpcError;
        }

        if (result.error) {
            console.warn('⚔️ [spendCoinsToJoinChallenge] RPC Error Result:', result.error);
            if (result.error === 'insufficient_coins') {
                alert('Not enough coins! You need ' + betAmount.toLocaleString() + ' coins.');
                closeChallengePassModal();
                if (typeof openCoinShop === 'function') openCoinShop();
            } else {
                alert('Failed to join challenge: ' + result.message);
            }
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = 'Spend 🪙 ' + betAmount.toLocaleString() + ' Coins &amp; Join';
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
        
        // Refresh challenges on home screen
        if (typeof loadHomeChallenges === 'function') loadHomeChallenges();
        alert('Challenge accepted! Good luck!');

        pendingChallengeId = null;

    } catch (error) {
        console.error('⚔️ [spendCoinsToJoinChallenge] CRITICAL ERROR:', error);
        alert('Failed to join challenge. Please try again.');
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
        if (typeof loadHomeChallenges === 'function') loadHomeChallenges();

    } catch (error) {
        console.error('⚔️ [declineChallengeInvite] CRITICAL ERROR:', error);
    }
}

// Open challenge leaderboard
async function openChallengeLeaderboard(challengeId) {
    currentChallengeId = challengeId;
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

            const cType = CHALLENGE_TYPES[challenge.challenge_type] || CHALLENGE_TYPES.xp;
            document.getElementById('challenge-leaderboard-title').textContent = `${cType.emoji} ${challenge.name}`;
            const endDate = new Date(challenge.end_date);
            const now = new Date();
            const daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));

            if (challenge.status === 'completed') {
                document.getElementById('challenge-days-remaining').textContent = '✅ Challenge Complete!';
                document.getElementById('challenge-days-remaining').style.color = '#16a34a';
            } else if (daysRemaining === 0 && endDate < now) {
                document.getElementById('challenge-days-remaining').textContent = '⏰ Challenge ended — finalizing results...';
                document.getElementById('challenge-days-remaining').style.color = '#f59e0b';
                // Trigger completion if not already done
                if (!challenge.winner_rewarded && typeof completeAndRewardChallenge === 'function') {
                    completeAndRewardChallenge(challenge.id);
                }
            } else {
                document.getElementById('challenge-days-remaining').textContent = `${daysRemaining} days remaining`;
                document.getElementById('challenge-days-remaining').style.color = '#0369a1';
            }
        }

        // Get leaderboard
        const { data: leaderboard, error } = await window.supabaseClient
            .rpc('get_challenge_leaderboard', { challenge_uuid: challengeId });

        if (error) throw error;

        // Update podium
        updatePodium(leaderboard);

        // Update full rankings
        updateFullRankings(leaderboard);

        // Load and render graph
        await loadChallengeGraph(challengeId);

    } catch (error) {
        console.error('Error loading leaderboard:', error);
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
            if (podiumPtsEl) podiumPtsEl.textContent = formatChallengePoints(participant.challenge_points, challengeType, participant.milestone_progress, participant.milestone_criteria);
            if (podiumPhotoEl) {
                const initials = (participant.user_name || '?').charAt(0).toUpperCase();
                podiumPhotoEl.innerHTML = participant.user_photo
                    ? `<img src="${participant.user_photo}" style="width: 100%; height: 100%; object-fit: cover;">`
                    : `<span style="font-size: 1.2rem; color: white; font-weight: 700;">${initials}</span>`;
                podiumPhotoEl.style.background = participant.user_photo ? 'transparent' : 'linear-gradient(135deg, var(--primary), #10b981)';
            }
        } else {
            if (podiumNameEl) podiumNameEl.textContent = '--';
            if (podiumPtsEl) podiumPtsEl.textContent = challengeType === 'sleep' ? '0m' : '0';
        }
    });
}

// Update full rankings list
function updateFullRankings(leaderboard) {
    const container = document.getElementById('challenge-full-rankings');
    if (!container) return;

    if (leaderboard.length === 0) {
        container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">No participants yet</div>';
        return;
    }

    // Get challenge type from first entry
    const challengeType = leaderboard[0]?.challenge_type || 'xp';

    container.innerHTML = leaderboard.map(participant => {
        const initials = (participant.user_name || '?').charAt(0).toUpperCase();
        const isCurrentUser = participant.user_id === window.currentUser?.id;
        const rankColor = participant.rank === 1 ? '#fbbf24' : participant.rank === 2 ? '#94a3b8' : participant.rank === 3 ? '#d97706' : '#6b7280';
        const formattedPts = formatChallengePoints(participant.challenge_points, challengeType, participant.milestone_progress, participant.milestone_criteria);

        return `
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f1f5f9; ${isCurrentUser ? 'background: #f0fdf4; margin: 0 -15px; padding: 12px 15px;' : ''}">
                <div style="font-size: 1.1rem; font-weight: 700; color: ${rankColor}; width: 30px;">${participant.rank}</div>
                <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #10b981); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; overflow: hidden;">
                    ${participant.user_photo ? `<img src="${participant.user_photo}" style="width: 100%; height: 100%; object-fit: cover;">` : initials}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-main);">${participant.user_name}${isCurrentUser ? ' (You)' : ''}</div>
                </div>
                <div style="font-weight: 700; color: var(--text-main);">${formattedPts}</div>
            </div>
        `;
    }).join('');
}

// Load and render challenge progress graph
async function loadChallengeGraph(challengeId) {
    try {
        const { data: history, error } = await window.supabaseClient
            .rpc('get_challenge_point_history', { challenge_uuid: challengeId });

        if (error) throw error;

        renderChallengeChart(history);

    } catch (error) {
        console.error('Error loading challenge graph:', error);
    }
}

// Render challenge progress chart
function renderChallengeChart(history) {
    const canvas = document.getElementById('challenge-progress-chart');
    if (!canvas) return;

    // Destroy existing chart
    if (challengeChart) {
        challengeChart.destroy();
    }

    if (!history || history.length === 0) {
        canvas.parentElement.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px;">Progress data will appear as the challenge progresses</div>';
        return;
    }

    // Group data by user
    const userColors = ['#7ba883', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
    const users = [...new Set(history.map(h => h.user_id))];
    const dates = [...new Set(history.map(h => h.snapshot_date))].sort();

    const datasets = users.map((userId, idx) => {
        const userData = history.filter(h => h.user_id === userId);
        const userName = userData[0]?.user_name || 'Unknown';

        return {
            label: userName,
            data: dates.map(date => {
                const point = userData.find(d => d.snapshot_date === date);
                return point ? point.challenge_points : null;
            }),
            borderColor: userColors[idx % userColors.length],
            backgroundColor: userColors[idx % userColors.length] + '20',
            tension: 0.3,
            fill: false,
            pointRadius: 4
        };
    });

    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        canvas.parentElement.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px;">Chart library not loaded</div>';
        return;
    }

    challengeChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: dates.map(d => {
                const date = new Date(d);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, padding: 15 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: CHALLENGE_UNIT_LABELS[window._currentChallengeType] || 'Points' }
                }
            }
        }
    });
}

// Close challenge leaderboard
function closeChallengeLeaderboard() {
    const modal = document.getElementById('challenge-leaderboard-modal');
    if (modal) modal.style.display = 'none';
    currentChallengeId = null;
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

        console.log('⚔️ [leaveCurrentChallenge] RPC Success:', data);

        closeChallengeLeaderboard();
        // Refresh challenges on home screen
        if (typeof loadHomeChallenges === 'function') loadHomeChallenges();
        if (typeof loadCoinBalance === 'function') loadCoinBalance();

        if (data?.status === 'cancelled') {
            alert('The challenge has been cancelled. Any entry fees have been refunded.');
        } else {
            alert('You have left the challenge.');
        }

    } catch (error) {
        console.error('⚔️ [leaveCurrentChallenge] CRITICAL ERROR:', error);
        alert('Failed to leave challenge');
    }
}

// ============================================================
// CHALLENGE TYPE PROGRESS TRACKING
// Ensures all 8 challenge types get their scores updated
// when the user performs relevant actions.
// ============================================================

// Unit labels for each challenge type (matches DB get_challenge_unit)
const CHALLENGE_UNIT_LABELS = {
    xp: 'XP',
    workouts: 'workouts',
    volume: 'kg',
    calories: 'days',
    steps: 'steps',
    streak: 'days',
    sleep: 'min',
    water: 'days',
    milestone: '%'
};

// Format challenge points with appropriate unit for display
function formatChallengePoints(points, challengeType, milestoneProgress, milestoneCriteria) {
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

        // Refresh the challenge cards on the home screen
        if (typeof loadHomeChallenges === 'function') {
            loadHomeChallenges();
        }
    } catch (err) {
        console.error('Error refreshing challenge progress:', err);
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

let currentDMRecipient = null;

// Open direct message modal
function openDirectMessage(userId, userName, userPhoto) {
    currentDMRecipient = { id: userId, name: userName, photo: userPhoto };

    // Clear unread state for this specific sender
    clearUnreadSender(userId);

    // Clear message badges when opening a conversation
    clearMessageBadges();

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
    }
}

// Close direct message modal
function closeDirectMessageModal() {
    const modal = document.getElementById('direct-message-modal');
    if (modal) modal.style.display = 'none';
    currentDMRecipient = null;
}

// Open coach chat modal
function openCoachChatModal() {
    const modal = document.getElementById('coach-chat-modal');
    if (modal) {
        modal.style.display = 'flex';
        // Load chat history when opening
        if (typeof window.loadChatHistory === 'function') {
            window.loadChatHistory();
        }
        // Focus the input
        setTimeout(() => {
            const input = document.getElementById('coach-chat-input');
            if (input) input.focus();
        }, 100);
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

        // Get messages from nudges table
        const { data: messages, error } = await window.supabaseClient
            .from('nudges')
            .select('*')
            .or(`and(sender_id.eq.${userId},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${userId})`)
            .order('created_at', { ascending: true })
            .limit(50);

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

            // Check if it's a game invite or turn notification
            const isGameMessage = msg.message.includes('🎮') && (msg.message.includes('challenged') || msg.message.includes('accepted') || msg.message.includes('turn') || msg.message.includes('won') || msg.message.includes('challenge'));
            const isQuizBattle = msg.nudge_type === 'quiz_battle_invite' || msg.message.includes('⚡ QUIZ BATTLE');
            
            const clickHandler = (isGameMessage || isQuizBattle) && !isSent ? `onclick="window.${isQuizBattle ? 'handleQuizBattleMessageClick' : 'handleGameMessageClick'}('${msg.sender_id}')" style="cursor:pointer;"` : '';
            const extraStyle = (isGameMessage || isQuizBattle) && !isSent ? 'border: 2px solid #7c3aed; background: linear-gradient(to right, #f5f3ff, #ede9fe); color: #5b21b6;' : `background: ${isSent ? 'var(--primary)' : 'white'}; color: ${isSent ? 'white' : 'var(--text-main)'};`;

            return `
                <div style="display: flex; justify-content: ${isSent ? 'flex-end' : 'flex-start'}; margin-bottom: 12px;">
                    <div ${clickHandler} style="max-width: 75%; padding: 10px 14px; border-radius: ${isSent ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; ${extraStyle} box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div style="font-size: 0.9rem; line-height: 1.4;">${msg.message}</div>
                        ${(isGameMessage || isQuizBattle) && !isSent ? `
                        <div style="margin-top: 10px;">
                            <button onclick="window.${isQuizBattle ? 'handleQuizBattleMessageClick' : 'handleGameMessageClick'}('${msg.sender_id}'); event.stopPropagation();" style="width: 100%; padding: 8px 12px; background: ${isQuizBattle ? '#7c3aed' : '#F59E0B'}; color: white; border: none; border-radius: 6px; font-weight: 700; font-size: 0.85rem; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                ${isQuizBattle ? '⚡ Accept Battle' : (msg.message.includes('challenge') ? '🎮 Accept Challenge' : (msg.message.includes('turn') ? '🎮 Take Turn' : '🎮 Play Game'))}
                            </button>
                        </div>` : ''}
                        <div style="font-size: 0.7rem; opacity: 0.7; margin-top: 4px; text-align: right;">${time}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;

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

window.handleGameMessageClick = async function(senderId) {
    console.log('🎮 handleGameMessageClick called for sender:', senderId);
    if (!senderId) {
        console.warn('❌ handleGameMessageClick: No senderId provided');
        return;
    }
    if (!window.currentUser || !window.db || !window.db.games) {
        showToast('Games system not ready. Please wait...', 'error');
        return;
    }
    
    // Show loading state
    const originalText = '🎮 Loading game...';
    showToast(originalText, 'info');
    
    try {
        console.log('🎮 [handleGameMessageClick] Fetching games for user:', window.currentUser.id);
        const games = await window.db.games.getUserGames(window.currentUser.id);
        console.log('🎮 [handleGameMessageClick] Games found:', games);
        
        if (!games || games.length === 0) {
            console.warn('⚠️ [handleGameMessageClick] No active or pending games found in DB.');
            showToast('No active games found with this friend.');
            return;
        }
        
        // Find the most relevant game with this sender (pending or active)
        const game = games.find(g => 
            (g.challenger_id === senderId || g.opponent_id === senderId) &&
            (g.status === 'pending' || g.status === 'active')
        );
        
        console.log('🎮 [handleGameMessageClick] Targeted game match:', game);
        
        if (game) {
            // Close any modals that might be in the way
            if (typeof closeDirectMessageModal === 'function') {
                console.log('🎮 [handleGameMessageClick] Closing DM modal');
                closeDirectMessageModal();
            }
            if (typeof closeMessageSelectorModal === 'function') {
                console.log('🎮 [handleGameMessageClick] Closing message selector modal');
                closeMessageSelectorModal();
            }
            
            if (typeof window.openGameBoard === 'function') {
                console.log('🎮 [handleGameMessageClick] Opening game board for match:', game.match_id);
                window.openGameBoard(game.match_id);
            } else {
                console.error('❌ [handleGameMessageClick] openGameBoard function not found on window!');
                showToast('Game board component missing.', 'error');
            }
        } else {
            console.warn('⚠️ [handleGameMessageClick] No game match specifically with sender:', senderId);
            showToast('Game not found or already finished.');
        }
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
document.addEventListener('DOMContentLoaded', function() {
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

    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Failed to send message', 'error');
    }
}

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
        // Build list with Coach Shannon first, then friends
        let html = '';
        const unreadSenders = getUnreadSenderIds();

        // Check if coach has unread messages
        const coachId = window._coachUserId || await getCoachUserId();
        const coachHasUnread = (coachId && unreadSenders.indexOf(coachId) !== -1) || localStorage.getItem('coach_unread_messages') === 'true';

        // Add Coach Shannon as first option
        html += `
            <div onclick="closeMessageSelectorModal(); openCoachChatModal();" style="display: flex; align-items: center; gap: 12px; padding: 15px; margin: 5px 0; background: ${coachHasUnread ? '#fef2f2' : '#f8fafc'}; border-radius: 12px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='${coachHasUnread ? '#fee2e2' : '#f1f5f9'}'" onmouseout="this.style.background='${coachHasUnread ? '#fef2f2' : '#f8fafc'}'">
                <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1.2rem; flex-shrink: 0; position: relative;">S${coachHasUnread ? '<div style="position:absolute;top:-1px;right:-1px;width:12px;height:12px;background:#ef4444;border-radius:50%;border:2px solid white;"></div>' : ''}</div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: ${coachHasUnread ? '700' : '600'}; color: var(--text-main);">Coach Shannon</div>
                    <div style="font-size: 0.85rem; color: ${coachHasUnread ? '#ef4444' : 'var(--primary)'}; font-weight: ${coachHasUnread ? '600' : '500'};">${coachHasUnread ? 'New message' : 'Your Coach'}</div>
                </div>
                <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: ${coachHasUnread ? '#ef4444' : 'var(--text-muted)'}; flex-shrink: 0;"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
        `;

        // Get friends list
        if (window.currentUser && window.dbHelpers && window.dbHelpers.friends) {
            const friends = await db.friends.getFriendsWithFallback(window.currentUser.id);

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

                // Add divider
                html += `<div style="padding: 10px 15px; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Friends</div>`;

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
        // Close panel when clicking on backdrop (outside panel content)
        panel.onclick = function(e) {
            if (e.target === panel) closeFeedMessagesPanel();
        };
        loadPanelGroupChats();
        loadPanelFriends();
    }
    // Clear message badges when opening messages
    clearMessageBadges();
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

// Load friends into the messages panel
async function loadPanelFriends() {
    const container = document.getElementById('panel-friends-list');
    const countEl = document.getElementById('panel-friends-count');
    if (!container || !window.currentUser) return;

    container.innerHTML = '<div style="text-align: center; padding: 15px; color: var(--text-muted); font-size: 0.85rem;">Loading...</div>';

    try {
        const friends = await db.friends.getFriendsWithFallback(window.currentUser.id);

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
        container.innerHTML = friends.map(friend => {
            const initials = (friend.friend_name || '?').charAt(0).toUpperCase();
            const photoHtml = friend.friend_photo
                ? `<img src="${friend.friend_photo}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='${initials}'">`
                : initials;
            const hasUnread = unreadSenders.indexOf(friend.friend_id) !== -1;

            return `
                <div onclick="closeFeedMessagesPanel(); openDirectMessage('${friend.friend_id}', '${(friend.friend_name || 'Friend').replace(/'/g, "\\'")}', '${friend.friend_photo || ''}');" style="display: flex; align-items: center; padding: 10px 0; cursor: pointer; border-bottom: 1px solid #f1f5f9;">
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
window.addEventListener('DOMContentLoaded', () => {
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
        name: 'Super Saiyan',
        maleOnly: true,
        colors: {
            '--primary': '#FF6B00', // Goku's gi orange
            '--primary-light': '#FF8C00', // Lighter orange
            '--secondary': '#FFD700', // Super Saiyan gold
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
        name: 'Saiyan Prince',
        maleOnly: true,
        colors: {
            '--primary': '#0047AB', // Royal blue (Vegeta's suit)
            '--primary-light': '#1E90FF', // Dodger blue
            '--secondary': '#FFD700', // Super Saiyan gold
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
        name: 'Moon Princess',
        femaleOnly: true,
        colors: {
            '--primary': '#FF69B4', // Hot pink (Sailor Moon's theme)
            '--primary-light': '#FFB6C1', // Light pink
            '--secondary': '#FFD700', // Gold (tiara and accents)
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
        name: 'Goddess of Love',
        femaleOnly: true,
        colors: {
            '--primary': '#FFA500', // Orange (Sailor Venus's theme)
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

    // Easter egg: Show video on first theme selection (male users only)
    if (isMale && isDbzTheme) {
        const easterEggKey = `dbz_easter_egg_${themeKey}`;
        const hasSeenEasterEgg = localStorage.getItem(easterEggKey);

        if (!hasSeenEasterEgg) {
            // Show the appropriate Easter egg video
            let videoUrl, videoTitle;

            if (themeKey === 'dbz-warrior') {
                // Super Saiyan theme - bigger video
                videoUrl = 'https://f005.backblazeb2.com/file/shannonsvideos/download_20260120_225718_0000.mp4';
                videoTitle = 'Super Saiyan Unlocked!';
            } else if (themeKey === 'dbz-vegeta') {
                // Saiyan Prince theme - smaller video
                videoUrl = 'https://f005.backblazeb2.com/file/shannonsvideos/download_20260120_231525_0000.mp4';
                videoTitle = 'Saiyan Prince Unlocked!';
            }

            if (videoUrl) {
                // Mark as seen so it only shows once
                localStorage.setItem(easterEggKey, 'true');

                // Show the Easter egg video after a short delay to let theme apply
                setTimeout(() => {
                    if (typeof openExerciseVideo === 'function') {
                        openExerciseVideo(videoUrl, videoTitle, true); // autoplay = true
                    }
                }, 300);
            }
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
    const gokuImg = document.getElementById('dbz-goku');
    const vegetaImg = document.getElementById('dbz-vegeta');

    if (dbzDecorations) {
        dbzDecorations.style.display = (isDbzTheme && isMale) ? 'block' : 'none';

        // Show the correct character based on theme
        if (gokuImg && vegetaImg) {
            if (themeKey === 'dbz-warrior') {
                // Super Saiyan theme - show Goku
                gokuImg.style.display = 'block';
                vegetaImg.style.display = 'none';
            } else if (themeKey === 'dbz-vegeta') {
                // Saiyan Prince theme - show Vegeta
                gokuImg.style.display = 'none';
                vegetaImg.style.display = 'block';
            }
        }
    }

    // Toggle DBZ body class for additional styling
    if (isDbzTheme && isMale) {
        document.body.classList.add('dbz-theme-active');
        // Add specific class for each character's theme
        document.body.classList.remove('dbz-goku-theme', 'dbz-vegeta-theme');
        document.body.classList.add(themeKey === 'dbz-warrior' ? 'dbz-goku-theme' : 'dbz-vegeta-theme');
    } else {
        document.body.classList.remove('dbz-theme-active', 'dbz-goku-theme', 'dbz-vegeta-theme');
    }

    // Handle Sailor Moon decorations (female users only)
    const sailorDecorations = document.getElementById('sailor-decorations');
    const sailorMoonImg = document.getElementById('sailor-moon-character');
    const sailorVenusImg = document.getElementById('sailor-venus-character');

    if (sailorDecorations) {
        sailorDecorations.style.display = (isSailorMoonTheme && isFemale) ? 'block' : 'none';

        // Show the correct character based on theme
        if (sailorMoonImg && sailorVenusImg) {
            if (themeKey === 'sailor-moon') {
                // Moon Princess theme - show Sailor Moon
                sailorMoonImg.style.display = 'block';
                sailorVenusImg.style.display = 'none';
            } else if (themeKey === 'sailor-venus') {
                // Goddess of Love theme - show Sailor Venus
                sailorMoonImg.style.display = 'none';
                sailorVenusImg.style.display = 'block';
            }
        }
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
        // Update settings icon (gear vs dragon ball vs sailor moon)
        const gearIcon = document.getElementById('settings-icon-gear');
        const dragonBallIcon = document.getElementById('settings-icon-dragonball');
        const sailorMoonIcon = document.getElementById('settings-icon-sailormoon');

        if (gearIcon && dragonBallIcon && sailorMoonIcon) {
            if (isDbzTheme && isMale) {
                // DBZ theme: show dragon ball, hide others
                gearIcon.style.setProperty('display', 'none', 'important');
                dragonBallIcon.style.setProperty('display', 'inline-block', 'important');
                sailorMoonIcon.style.setProperty('display', 'none', 'important');
                console.log('✅ Dragon Ball settings icon activated');
            } else if (isSailorMoonTheme && isFemale) {
                // Sailor Moon theme: show moon, hide others
                gearIcon.style.setProperty('display', 'none', 'important');
                dragonBallIcon.style.setProperty('display', 'none', 'important');
                sailorMoonIcon.style.setProperty('display', 'inline-block', 'important');
                console.log('✅ Sailor Moon settings icon activated');
            } else {
                // Default: show gear, hide themed icons
                gearIcon.style.setProperty('display', 'inline-block', 'important');
                dragonBallIcon.style.setProperty('display', 'none', 'important');
                sailorMoonIcon.style.setProperty('display', 'none', 'important');
                console.log('✅ Gear settings icon activated (theme: ' + savedTheme + ')');
            }
        } else {
            console.warn('⚠️ Settings icons not found in DOM yet');
        }

        // Update profile icons (all instances with class profile-icon)
        const profileIcons = document.querySelectorAll('.profile-icon');
        profileIcons.forEach(icon => {
            if (isDbzTheme && isMale) {
                // DBZ theme: show dragon ball background
                icon.style.setProperty('background-image', 'url(assets/dragon-ball.svg)', 'important');
                icon.style.setProperty('background-size', 'cover', 'important');
                icon.style.setProperty('background-position', 'center', 'important');
                icon.style.setProperty('color', 'transparent', 'important');
                icon.style.setProperty('font-size', '0', 'important');
                console.log('✅ Dragon Ball profile icon activated');
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
document.addEventListener('DOMContentLoaded', () => {
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

            // Subscribe to Realtime updates for new coach messages
            subscribeToCoachMessages(window.currentUser.id);
        }
        checkUserRole();
        // Theme is now applied in the main initialization sequence after gender is loaded
    });

    // Event Listeners (Community only - Coach uses form onsubmit)
    document.getElementById('community-chat-input')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendCommunityMessage(); });
});
