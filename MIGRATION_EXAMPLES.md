# Converting localStorage to Database - Code Examples

This guide shows you how to update your dashboard.html code to use the Supabase database instead of localStorage.

---

## 🎯 General Pattern

**OLD (localStorage):**
```javascript
// Get data
const data = JSON.parse(localStorage.getItem('key') || 'default');

// Save data
localStorage.setItem('key', JSON.stringify(data));
```

**NEW (database):**
```javascript
// Get current user (available after auth-guard.js loads)
const user = window.currentUser;

// Get data
const data = await dbHelpers.tableName.get(user.id);

// Save data
await dbHelpers.tableName.create(user.id, data);
```

---

## 📋 Common Conversions

### 1. User Profile

#### Get User Name
**OLD:**
```javascript
const userName = localStorage.getItem('userName');
```

**NEW:**
```javascript
const profile = await getUserProfile(); // Helper from auth-guard.js
const userName = profile.name;
```

#### Update User Name
**OLD:**
```javascript
localStorage.setItem('userName', newName);
```

**NEW:**
```javascript
await dbHelpers.users.update(window.currentUser.id, { name: newName });
```

#### Get Profile Photo
**OLD:**
```javascript
const photo = localStorage.getItem('profile_photo');
```

**NEW:**
```javascript
const profile = await getUserProfile();
const photo = profile.profile_photo;
```

#### Update Profile Photo
**OLD:**
```javascript
localStorage.setItem('profile_photo', base64Image);
```

**NEW:**
```javascript
await dbHelpers.users.update(window.currentUser.id, { profile_photo: base64Image });
```

---

### 2. Shannon Chat History

#### Load Chat History
**OLD:**
```javascript
const chatHistory = JSON.parse(localStorage.getItem('shannon_chat_history') || '[]');
```

**NEW:**
```javascript
const chatHistory = await dbHelpers.conversations.getHistory(
  window.currentUser.id,
  'shannon',
  100 // limit to last 100 messages
);
```

#### Save User Message
**OLD:**
```javascript
const chatHistory = JSON.parse(localStorage.getItem('shannon_chat_history') || '[]');
chatHistory.push({
  role: 'user',
  text: userMessage,
  timestamp: Date.now(),
  brisbaneTime: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })
});
localStorage.setItem('shannon_chat_history', JSON.stringify(chatHistory));
```

**NEW:**
```javascript
await dbHelpers.conversations.create(
  window.currentUser.id,
  'shannon',
  'user',
  userMessage
);
```

#### Save Bot Response
**OLD:**
```javascript
chatHistory.push({
  role: 'bot',
  text: botResponse,
  timestamp: Date.now(),
  brisbaneTime: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })
});
localStorage.setItem('shannon_chat_history', JSON.stringify(chatHistory));
```

**NEW:**
```javascript
await dbHelpers.conversations.create(
  window.currentUser.id,
  'shannon',
  'bot',
  botResponse
);
```

---

### 3. Community Chat

#### Load Community Chat
**OLD:**
```javascript
const communityChat = JSON.parse(localStorage.getItem('community_chat_history') || '[]');
```

**NEW:**
```javascript
const communityChat = await dbHelpers.conversations.getHistory(
  window.currentUser.id,
  'community',
  100
);
```

#### Post Community Message
**OLD:**
```javascript
communityChat.push({
  role: 'user',
  text: message,
  authorName: userName,
  timestamp: Date.now()
});
localStorage.setItem('community_chat_history', JSON.stringify(communityChat));
```

**NEW:**
```javascript
const profile = await getUserProfile();
await dbHelpers.conversations.create(
  window.currentUser.id,
  'community',
  'user',
  message,
  profile.name
);
```

---

### 4. Workout History

#### Load Workout History
**OLD:**
```javascript
const workoutHistory = JSON.parse(localStorage.getItem('workout_history') || '[]');
```

**NEW:**
```javascript
const workoutHistory = await dbHelpers.workouts.getHistory(window.currentUser.id);
```

#### Save Workout Entry
**OLD:**
```javascript
const workoutHistory = JSON.parse(localStorage.getItem('workout_history') || '[]');
workoutHistory.push({
  date: '2024-01-15',
  exercise: 'Squats',
  set: 1,
  time: '45s',
  reps: '12',
  kg: '60'
});
localStorage.setItem('workout_history', JSON.stringify(workoutHistory));
```

**NEW:**
```javascript
await dbHelpers.workouts.createHistory(window.currentUser.id, {
  date: '2024-01-15',
  exercise: 'Squats',
  set: 1,
  time: '45s',
  reps: '12',
  kg: '60'
});
```

#### Get Current Workout
**OLD:**
```javascript
const currentWorkout = JSON.parse(localStorage.getItem('myCurrentWorkout') || 'null');
```

**NEW:**
```javascript
const currentWorkout = await dbHelpers.workouts.getCurrentWorkout(window.currentUser.id);
```

#### Set Current Workout
**OLD:**
```javascript
localStorage.setItem('myCurrentWorkout', JSON.stringify(workoutData));
```

**NEW:**
```javascript
await dbHelpers.workouts.setCurrentWorkout(window.currentUser.id, workoutData);
```

#### Save Custom Workout
**OLD:**
```javascript
const customWorkouts = JSON.parse(localStorage.getItem('saved_custom_workouts') || '[]');
customWorkouts.push(newWorkout);
localStorage.setItem('saved_custom_workouts', JSON.stringify(customWorkouts));
```

**NEW:**
```javascript
await dbHelpers.workouts.saveCustomWorkout(
  window.currentUser.id,
  'My Custom Workout',
  newWorkout
);
```

---

### 5. Daily Check-ins

#### Get Today's Check-in
**OLD:**
```javascript
const today = new Date().toISOString().split('T')[0];
const checkin = JSON.parse(localStorage.getItem(`daily_checkin_${today}`) || 'null');
```

**NEW:**
```javascript
const today = new Date().toISOString().split('T')[0];
const checkin = await dbHelpers.checkins.get(window.currentUser.id, today);
```

#### Save Check-in
**OLD:**
```javascript
const checkinData = {
  energy: 'high',
  equipment: 'gym',
  sleep: 'good',
  water: 8
};
localStorage.setItem(`daily_checkin_${today}`, JSON.stringify(checkinData));
```

**NEW:**
```javascript
const checkinData = {
  energy: 'high',
  equipment: 'gym',
  sleep: 'good',
  water: 8
};
await dbHelpers.checkins.upsert(window.currentUser.id, today, checkinData);
```

#### Get Recent Check-ins (last 30 days)
**NEW (no localStorage equivalent):**
```javascript
const recentCheckins = await dbHelpers.checkins.getRecent(window.currentUser.id, 30);
```

---

### 6. User Facts (Struggles, Preferences, Goals)

#### Load User Facts
**OLD:**
```javascript
const userFacts = JSON.parse(localStorage.getItem('user_facts') || '{}');
const struggles = userFacts.struggles || [];
const preferences = userFacts.preferences || [];
```

**NEW:**
```javascript
const userFacts = await getUserFacts(); // Helper from auth-guard.js
const struggles = userFacts.struggles || [];
const preferences = userFacts.preferences || [];
```

#### Update User Facts
**OLD:**
```javascript
const userFacts = JSON.parse(localStorage.getItem('user_facts') || '{}');
userFacts.struggles = ['sugar cravings', 'low energy'];
userFacts.goals = ['lose weight', 'better sleep'];
localStorage.setItem('user_facts', JSON.stringify(userFacts));
```

**NEW:**
```javascript
await dbHelpers.userFacts.upsert(window.currentUser.id, {
  struggles: ['sugar cravings', 'low energy'],
  goals: ['lose weight', 'better sleep']
});
```

#### Add to User Facts Array
**OLD:**
```javascript
const userFacts = JSON.parse(localStorage.getItem('user_facts') || '{}');
if (!userFacts.struggles) userFacts.struggles = [];
userFacts.struggles.push('new struggle');
localStorage.setItem('user_facts', JSON.stringify(userFacts));
```

**NEW:**
```javascript
const userFacts = await dbHelpers.userFacts.get(window.currentUser.id);
const struggles = userFacts.struggles || [];
struggles.push('new struggle');
await dbHelpers.userFacts.upsert(window.currentUser.id, {
  ...userFacts,
  struggles: struggles
});
```

---

### 7. Reflections / Journal Entries

#### Load All Reflections
**OLD:**
```javascript
const reflections = [];
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key && key.startsWith('reflection_')) {
    reflections.push(localStorage.getItem(key));
  }
}
```

**NEW:**
```javascript
const reflections = await dbHelpers.reflections.getAll(window.currentUser.id);
```

#### Save Reflection
**OLD:**
```javascript
const timestamp = Date.now();
const reflection = {
  text: reflectionText,
  timestamp: timestamp
};
localStorage.setItem(`standalone_reflection_${timestamp}`, JSON.stringify(reflection));
```

**NEW:**
```javascript
await dbHelpers.reflections.create(
  window.currentUser.id,
  reflectionText,
  'standalone'
);
```

#### Save Saturday Check-in Story
**OLD:**
```javascript
const stories = JSON.parse(localStorage.getItem('saturday_checkin_stories') || '{}');
stories['week_1'] = storyText;
localStorage.setItem('saturday_checkin_stories', JSON.stringify(stories));
```

**NEW:**
```javascript
await dbHelpers.reflections.create(
  window.currentUser.id,
  storyText,
  'saturday_checkin',
  'week_1' // story key
);
```

---

### 8. Sleep & Energy Tracking

#### Get/Set Sleep Quality
**OLD:**
```javascript
const sleepQuality = localStorage.getItem('sleep_quality');
localStorage.setItem('sleep_quality', 'good');
```

**NEW:**
```javascript
const userFacts = await dbHelpers.userFacts.get(window.currentUser.id);
const sleepQuality = userFacts.sleep_quality;

await dbHelpers.userFacts.upsert(window.currentUser.id, {
  sleep_quality: 'good'
});
```

#### Get/Set Energy Level
**OLD:**
```javascript
const energyLevel = localStorage.getItem('energy_level');
localStorage.setItem('energy_level', 'high');
```

**NEW:**
```javascript
const userFacts = await dbHelpers.userFacts.get(window.currentUser.id);
const energyLevel = userFacts.energy_level;

await dbHelpers.userFacts.upsert(window.currentUser.id, {
  energy_level: 'high'
});
```

---

### 9. Quiz Results

#### Save Quiz Results
**NEW (no localStorage equivalent):**
```javascript
await dbHelpers.quizResults.create(window.currentUser.id, {
  menopause_status: 'perimenopause',
  activity_level: 'moderate',
  hormone_profile: 'CORTISOL',
  age: 35,
  weight: 150
  // ... other quiz fields
});
```

#### Get Latest Quiz Results
**NEW:**
```javascript
const latestQuiz = await dbHelpers.quizResults.getLatest(window.currentUser.id);
```

---

### 10. Activity Logging (NEW - for analytics)

#### Log User Activity
**NEW:**
```javascript
// This is already done automatically by auth-guard.js for page views
// But you can log custom activities:

await dbHelpers.activity.log(window.currentUser.id, 'workout_completed', {
  workout_type: 'strength',
  duration_minutes: 45
});

await dbHelpers.activity.log(window.currentUser.id, 'chat_message_sent', {
  chat_type: 'shannon',
  message_length: 120
});
```

---

## 🔄 Full Example: Chat Interface

Here's a complete before/after example for the Shannon chat interface:

### BEFORE (localStorage):
```javascript
function loadChatHistory() {
  const chatHistory = JSON.parse(localStorage.getItem('shannon_chat_history') || '[]');

  chatHistory.forEach(msg => {
    displayMessage(msg.role, msg.text);
  });
}

async function sendMessage() {
  const userMessage = document.getElementById('user-input').value;

  // Save user message
  const chatHistory = JSON.parse(localStorage.getItem('shannon_chat_history') || '[]');
  chatHistory.push({
    role: 'user',
    text: userMessage,
    timestamp: Date.now(),
    brisbaneTime: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })
  });
  localStorage.setItem('shannon_chat_history', JSON.stringify(chatHistory));

  // Display user message
  displayMessage('user', userMessage);

  // Get AI response
  const response = await fetchAIResponse(userMessage);

  // Save bot response
  chatHistory.push({
    role: 'bot',
    text: response,
    timestamp: Date.now(),
    brisbaneTime: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })
  });
  localStorage.setItem('shannon_chat_history', JSON.stringify(chatHistory));

  // Display bot response
  displayMessage('bot', response);
}
```

### AFTER (database):
```javascript
async function loadChatHistory() {
  const chatHistory = await dbHelpers.conversations.getHistory(
    window.currentUser.id,
    'shannon',
    100
  );

  chatHistory.forEach(msg => {
    displayMessage(msg.role, msg.message_text);
  });
}

async function sendMessage() {
  const userMessage = document.getElementById('user-input').value;

  // Save and display user message
  await dbHelpers.conversations.create(
    window.currentUser.id,
    'shannon',
    'user',
    userMessage
  );
  displayMessage('user', userMessage);

  // Get AI response
  const response = await fetchAIResponse(userMessage);

  // Save and display bot response
  await dbHelpers.conversations.create(
    window.currentUser.id,
    'shannon',
    'bot',
    response
  );
  displayMessage('bot', response);

  // Log activity for analytics
  await dbHelpers.activity.log(window.currentUser.id, 'chat', {
    chat_type: 'shannon',
    message_count: 2 // user + bot
  });
}
```

---

## 🎯 Step-by-Step Migration Process

1. **Find all localStorage.getItem() calls** in dashboard.html
2. **Replace with appropriate dbHelpers call** (see examples above)
3. **Find all localStorage.setItem() calls**
4. **Replace with appropriate database save** (create/update/upsert)
5. **Test each section** as you convert it
6. **Remove localStorage calls** once database version works

---

## ⚠️ Important Notes

### Async/Await
All database calls are **asynchronous** and return Promises. You must use `await`:

```javascript
// ❌ WRONG
const data = dbHelpers.users.get(userId); // Returns a Promise, not the data!

// ✅ CORRECT
const data = await dbHelpers.users.get(userId);
```

If you're not in an async function, wrap it:
```javascript
(async function() {
  const data = await dbHelpers.users.get(userId);
  // Use data here
})();
```

### Error Handling
Always wrap database calls in try/catch:

```javascript
try {
  await dbHelpers.conversations.create(userId, 'shannon', 'user', message);
} catch (error) {
  console.error('Failed to save message:', error);
  alert('Failed to save message. Please try again.');
}
```

### Fallback During Migration
During testing, you might want to fallback to localStorage if database fails:

```javascript
try {
  const data = await dbHelpers.users.get(window.currentUser.id);
  return data;
} catch (error) {
  console.error('Database error, falling back to localStorage:', error);
  return JSON.parse(localStorage.getItem('userData') || '{}');
}
```

---

## 🧪 Testing Checklist

After converting each section:

- [ ] Data loads correctly on page load
- [ ] New data saves to database
- [ ] Data persists after page reload
- [ ] Data syncs across different browsers/devices
- [ ] Errors are handled gracefully
- [ ] No console errors
- [ ] Old localStorage code is removed

---

## 🎉 You're Done!

Once you've converted all localStorage calls to database calls:
1. Your users' data will be safe and persistent
2. They can access from any device
3. You can view all data in the admin dashboard
4. Your app is ready to scale!

Need help? Check the browser console for errors and refer back to this guide.
