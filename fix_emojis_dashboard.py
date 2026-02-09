
import os

filepath = r"C:\Users\shann\.gemini\antigravity\plant_based_balance\dashboard.html"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replacements (Carefully ordered)

replacements = [
    # Coach Sidebar
    ('<span>??</span> Overview', '<span>🏠</span> Overview'),
    ('<span>??</span> Clients', '<span>👥</span> Clients'),
    ('<span>??</span> Messages', '<span>💬</span> Messages'),
    ('<span>??</span> User Calendar', '<span>📅</span> User Calendar'),
    ('<span>??</span> Exit Coach Mode', '<span>🚪</span> Exit Coach Mode'),

    # PWA
    ('?? Install Our App', '📲 Install Our App'),
    ('>?? Install Our App', '>📲 Install Our App'), # Variation

    # Headers / Dashboard
    ('font-size: 1.8rem;">??</div>', 'font-size: 1.8rem;">🌿</div>'), # Current Phase
    ('font-size: 2rem;">?????</div>', 'font-size: 2rem;">🧘‍♀️</div>'), # Today's Movement (Guessing context)
    ('?? Shopping List', '🛒 Shopping List'),

    # Daily Check-in Modal
    # High Energy (??)
    ('onclick="selectEnergy(\'high\')"', 'onclick="selectEnergy(\'high\')"'), # Anchor
    ('<div style="font-size:1.5rem;">??</div>', '<div style="font-size:1.5rem;">⚡</div>'),
    
    # Low Energy (?????)
    ('<div style="font-size:1.5rem;">?????</div>', '<div style="font-size:1.5rem;">🪫</div>'),

    # Equipment
    ('<span style="font-size:1.2rem;">??</span><br><span style="font-size:0.8rem; font-weight:600;">None</span>', '<span style="font-size:1.2rem;">🧘</span><br><span style="font-size:0.8rem; font-weight:600;">None</span>'),
    ('<span style="font-size:1.2rem;">??</span><br><span style="font-size:0.8rem; font-weight:600;">Dumbbells</span>', '<span style="font-size:1.2rem;">🏋️</span><br><span style="font-size:0.8rem; font-weight:600;">Dumbbells</span>'),
    ('<span style="font-size:1.2rem;">??????</span><br><span style="font-size:0.8rem; font-weight:600;">Gym</span>', '<span style="font-size:1.2rem;">🏢</span><br><span style="font-size:0.8rem; font-weight:600;">Gym</span>'),

    # Onboarding Steps (Contextual)
    # Use context blocks to be safe
    ('div class="step-icon">??</div>\n                <div class="step-text">\n                    <h4>Community Support</h4>', 'div class="step-icon">👥</div>\n                <div class="step-text">\n                    <h4>Community Support</h4>'),
    
    ('div class="step-icon">?????</div>\n                <div class="step-text">\n                    <h4>Message Your Coach</h4>', 'div class="step-icon">💬</div>\n                <div class="step-text">\n                    <h4>Message Your Coach</h4>'),
    
    ('div class="step-icon">??</div>\n                <div class="step-text">\n                    <h4>Track Your Meals</h4>', 'div class="step-icon">📸</div>\n                <div class="step-text">\n                    <h4>Track Your Meals</h4>'),

    ('div class="step-icon">??</div>\n                <div class="step-text">\n                    <h4>Daily Reflections</h4>', 'div class="step-icon">📝</div>\n                <div class="step-text">\n                    <h4>Daily Reflections</h4>'),

    ('div class="step-icon">??</div>\n                <div class="step-text">\n                    <h4>Shopping List</h4>', 'div class="step-icon">🛒</div>\n                <div class="step-text">\n                    <h4>Shopping List</h4>'),
    
    # Coach Activity Feed Icons (Mock data)
    ("icon: '??????'", "icon: '🦵'"), # Leg Day
    ("icon: '??'", "icon: '🥗'"), # Logged Lunch/Generic
    ("icon: '??'", "icon: '📸'"), # Progress Photo

    # Generic Fallback for Meal Icons (Do this LAST)
    ('class="meal-icon">??</div>', 'class="meal-icon">🍽️</div>'),
]

new_content = content
for target, replacement in replacements:
    new_content = new_content.replace(target, replacement)

# Check specifically for the movement card "Today's Movement"
# It might have a specific ID or class
if 'Today\'s Movement' in new_content:
    # Try to find the ????? before it
    pass

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Fixed emojis in dashboard.html")
