import os
with open('js/dashboard/dashboard-script-3-1_get_user_data.js', 'r', encoding='utf-8') as f:
    if 'signOut' in f.read(): print('found in 3-1')
with open('js/dashboard/dashboard-script-6-ai_coach_draft_mode_logic_auth.js', 'r', encoding='utf-8') as f:
    if 'signOut' in f.read(): print('found in 6')
