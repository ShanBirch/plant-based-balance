// COACH MODE LOGIC

// Real clients loaded from Supabase
let REAL_CLIENTS = [];

// Primary toggleCoachMode defined below in AI section

async function initCoachDashboard() {
    console.log('🎛️ Initializing Coach Dashboard...');
    await loadRealClients();
    renderComplianceGrid();
    renderActivityFeed();
    renderClientList();
}

async function loadRealClients() {
    try {
        // Fetch all users from Supabase
        const users = await dbHelpers.users.getAll();
        
        REAL_CLIENTS = await Promise.all(users.map(async (user) => {
            // Get last check-in to determine status
            let status = 'good';
            let lastAct = 'No recent activity';
            
            try {
                // Get their most recent conversation
                const history = await dbHelpers.conversations.getHistory(user.id, 'coach', 1);
                if (history && history.length > 0) {
                    const lastMsg = history[history.length - 1];
                    const msgDate = new Date(lastMsg.timestamp);
                    const daysDiff = Math.floor((Date.now() - msgDate) / (1000 * 60 * 60 * 24));
                    
                    if (daysDiff === 0) lastAct = 'Messaged today';
                    else if (daysDiff === 1) lastAct = 'Messaged yesterday';
                    else if (daysDiff < 7) lastAct = `Messaged ${daysDiff} days ago`;
                    else lastAct = `Inactive ${daysDiff} days`;
                    
                    // Set status based on activity
                    if (daysDiff > 7) status = 'danger';
                    else if (daysDiff > 3) status = 'warning';
                }
            } catch (e) { console.warn('Could not get activity for user', user.id); }
            
            // Calculate program day
            let programDay = 0;
            if (user.program_start_date) {
                const start = new Date(user.program_start_date);
                programDay = Math.ceil((Date.now() - start) / (1000 * 60 * 60 * 24));
            }
            
            // Get initials for avatar
            const name = user.name || user.email?.split('@')[0] || 'User';
            const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            
            return {
                id: user.id,
                name: name,
                email: user.email,
                status: status,
                avatar: initials,
                lastAct: lastAct,
                programDay: programDay,
                startDate: user.program_start_date,
                profile: user.profile || 'Standard',
                lastLogin: user.last_login
            };
        }));
        
        console.log(`✅ Loaded ${REAL_CLIENTS.length} clients from database`);
    } catch (error) {
        console.error('Failed to load clients:', error);
        REAL_CLIENTS = [];
    }
}

function renderComplianceGrid() {
    const container = document.getElementById('compliance-container');
    if (REAL_CLIENTS.length === 0) {
        container.innerHTML = '<div style="color:#64748b; font-style:italic;">No clients found</div>';
        return;
    }
    container.innerHTML = REAL_CLIENTS.map(c => `
        <div class="compliance-dot status-${c.status}" onclick="openClientProfile('${c.id}')" title="${c.name} - ${c.lastAct}">
            ${c.avatar}
        </div>
    `).join('');
}

function renderActivityFeed() {
    const container = document.getElementById('activity-feed-container');
    
    // Build activity from real clients
    const activities = REAL_CLIENTS
        .filter(c => c.lastAct && c.lastAct !== 'No recent activity')
        .slice(0, 5)
        .map(c => ({
            name: c.name,
            action: c.lastAct,
            icon: c.status === 'good' ? '✅' : c.status === 'warning' ? '⚠️' : '🔴'
        }));
    
    if (activities.length === 0) {
        container.innerHTML = '<div style="color:#64748b; font-style:italic;">No recent activity</div>';
        return;
    }
    
    container.innerHTML = activities.map(a => `
        <div class="activity-item">
            <div class="activity-icon">${a.icon}</div>
            <div>
                <div style="font-weight:600;">${a.name}</div>
                <div style="font-size:0.85rem; color:#64748b;">${a.action}</div>
            </div>
        </div>
    `).join('');
}

function showCoachSection(secId) {
    // Hide all
    ['overview', 'clients', 'messages'].forEach(id => {
        const el = document.getElementById('coach-sec-' + id);
        if(el) el.style.display = 'none';
    });
    
    // Show selected
    document.getElementById('coach-sec-' + secId).style.display = 'block';
}

function renderClientList() {
    const container = document.getElementById('coach-client-list');
    
    if (REAL_CLIENTS.length === 0) {
        container.innerHTML = '<div style="padding:20px; color:#64748b; font-style:italic;">No clients registered yet.</div>';
        return;
    }
    
    container.innerHTML = REAL_CLIENTS.map(c => `
        <div class="activity-item" style="cursor:pointer;" onclick="openClientProfile('${c.id}')">
            <div class="activity-icon" style="background:${c.status === 'danger' ? '#FEE2E2' : c.status === 'warning' ? '#FEF3C7' : '#F1F5F9'}">${c.avatar}</div>
            <div style="flex:1;">
                <div style="font-weight:600;">${c.name}</div>
                <div style="font-size:0.85rem; color:#64748b;">${c.email || ''}</div>
                <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">Day ${c.programDay || '?'} • ${c.lastAct}</div>
            </div>
            <div style="color:var(--primary);">→</div>
        </div>
    `).join('');
}

async function openClientProfile(clientId) {
    document.getElementById('client-list-view').style.display = 'none';
    document.getElementById('single-client-view').style.display = 'block';
    
    const client = REAL_CLIENTS.find(c => c.id === clientId);
    if (!client) {
        console.error('Client not found:', clientId);
        return;
    }
    
    // Update header
    document.getElementById('sc-name').innerText = client.name;
    document.getElementById('sc-avatar').innerText = client.avatar;
    document.getElementById('sc-status').innerHTML = `
        <span style="color:${client.status === 'good' ? 'green' : client.status === 'warning' ? 'orange' : 'red'};">●</span>
        Day ${client.programDay || '?'} • ${client.profile} • ${client.email}
    `;
    
    // Try to get more detailed stats
    try {
        // Get their full chat history
        const chatHistory = await dbHelpers.conversations.getHistory(clientId, 'coach', 50);
        
        // Update the stats grid
        const statsGrid = document.querySelector('#single-client-view .dashboard-grid > div:first-child');
        if (statsGrid) {
            statsGrid.innerHTML = `
                <div class="d-card" style="margin:0; text-align:center;">
                    <div style="font-size:0.8rem; color:#64748b;">PROGRAM DAY</div>
                    <div style="font-size:1.5rem; font-weight:bold;">${client.programDay || '-'}</div>
                    <div style="color:var(--primary); font-size:0.8rem;">of 28</div>
                </div>
                <div class="d-card" style="margin:0; text-align:center;">
                    <div style="font-size:0.8rem; color:#64748b;">MESSAGES</div>
                    <div style="font-size:1.5rem; font-weight:bold;">${chatHistory.length}</div>
                    <div style="color:#64748b; font-size:0.8rem;">Total</div>
                </div>
                <div class="d-card" style="margin:0; text-align:center;">
                    <div style="font-size:0.8rem; color:#64748b;">LAST ACTIVE</div>
                    <div style="font-size:1rem; font-weight:bold;">${client.lastAct}</div>
                </div>
                <div class="d-card" style="margin:0; text-align:center;">
                    <div style="font-size:0.8rem; color:#64748b;">PROFILE</div>
                    <div style="font-size:1rem; font-weight:bold;">${client.profile}</div>
                </div>
            `;
        }
        
        // Add chat history viewer
        renderClientChatHistory(chatHistory);
        
    } catch (error) {
        console.error('Failed to load client details:', error);
    }
}

function renderClientChatHistory(history) {
    // Find or create chat history container
    let container = document.getElementById('client-chat-history');
    if (!container) {
        // Create container if it doesn't exist
        const singleView = document.getElementById('single-client-view');
        const existingGrid = singleView.querySelector('.dashboard-grid');
        
        const chatCard = document.createElement('div');
        chatCard.className = 'd-card';
        chatCard.style.gridColumn = '1 / -1';
        chatCard.innerHTML = `
            <h3>💬 Conversation History</h3>
            <div id="client-chat-history" style="max-height:400px; overflow-y:auto; padding:10px; background:#f8fafc; border-radius:12px;"></div>
        `;
        existingGrid.appendChild(chatCard);
        container = document.getElementById('client-chat-history');
    }
    
    if (history.length === 0) {
        container.innerHTML = '<div style="color:#64748b; font-style:italic; padding:10px;">No messages yet.</div>';
        return;
    }
    
    container.innerHTML = history.map(msg => {
        const isUser = msg.role === 'user';
        const time = msg.brisbane_time || new Date(msg.timestamp).toLocaleString();
        return `
            <div style="display:flex; gap:10px; margin-bottom:12px; ${isUser ? 'justify-content:flex-end;' : ''}">
                ${!isUser ? '<div style="width:32px; height:32px; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem; flex-shrink:0;">🤖</div>' : ''}
                <div style="max-width:70%; ${isUser ? 'background:#064e3b; color:white;' : 'background:white; border:1px solid #e2e8f0;'} padding:10px 14px; border-radius:16px;">
                    <div style="font-size:0.9rem; white-space:pre-wrap;">${msg.message_text}</div>
                    <div style="font-size:0.7rem; ${isUser ? 'color:rgba(255,255,255,0.7);' : 'color:#94a3b8;'} margin-top:5px;">${time}</div>
                </div>
                ${isUser ? '<div style="width:32px; height:32px; background:#f1f5f9; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem; flex-shrink:0;">👤</div>' : ''}
            </div>
        `;
    }).join('');
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

function closeClientProfile() {
    document.getElementById('single-client-view').style.display = 'none';
    document.getElementById('client-list-view').style.display = 'block';
}

function openAsClient() {
    // Switch to normal dashboard view
    toggleCoachMode(false);
    // Ideally we would load the specific client's data into the view
    // For "Current User", it's already there.
    // For others, we'd need to mock swap the data, but for this task we'll just close the coach view
    // and show the "Current" view as a demo of the "Open" functionality.
}