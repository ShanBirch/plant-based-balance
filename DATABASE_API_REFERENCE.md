# Database API Quick Reference

Quick reference guide for all database helper functions.

---

## 🔐 Authentication (`authHelpers`)

```javascript
// Sign up new user
await authHelpers.signUp(email, password, { name: 'User Name' })

// Sign in
await authHelpers.signIn(email, password)

// Sign out
await authHelpers.signOut()

// Get current session
const session = await authHelpers.getSession()

// Get current user
const user = await authHelpers.getUser()

// Reset password (sends email)
await authHelpers.resetPassword(email)

// Update password
await authHelpers.updatePassword(newPassword)

// Listen for auth changes
authHelpers.onAuthStateChange((event, session) => {
  console.log('Auth event:', event)
})
```

---

## 👤 Users (`dbHelpers.users`)

```javascript
// Create user profile (done automatically on signup)
await dbHelpers.users.create({
  id: userId,
  email: 'user@example.com',
  name: 'User Name'
})

// Get user profile
const user = await dbHelpers.users.get(userId)

// Update user profile
await dbHelpers.users.update(userId, {
  name: 'New Name',
  profile_photo: 'base64...',
  theme_preference: 'dark'
})

// Update last login (done automatically on signin)
await dbHelpers.users.updateLastLogin(userId)

// Get all users (admin only)
const users = await dbHelpers.users.getAll()
```

---

## 📝 User Facts (`dbHelpers.userFacts`)

```javascript
// Get user facts
const facts = await dbHelpers.userFacts.get(userId)

// Create or update user facts
await dbHelpers.userFacts.upsert(userId, {
  struggles: ['sugar cravings', 'low energy'],
  preferences: ['yoga', 'plant-based'],
  health_notes: ['lactose intolerant'],
  personal_details: ['busy schedule'],
  goals: ['lose 10kg', 'better sleep'],
  sleep_quality: 'poor',
  energy_level: 'low'
})
```

---

## 💬 Conversations (`dbHelpers.conversations`)

```javascript
// Create message
await dbHelpers.conversations.create(
  userId,
  'shannon',  // or 'community'
  'user',     // or 'bot', 'member', 'coach'
  'Hello Shannon!',
  'User Name' // optional, for community chat
)

// Get chat history
const messages = await dbHelpers.conversations.getHistory(
  userId,
  'shannon',  // or 'community'
  100         // limit (optional, default 100)
)

// Bulk create messages (for migration)
await dbHelpers.conversations.bulkCreate(userId, [
  { chat_type: 'shannon', role: 'user', message_text: 'Hi', timestamp: Date.now() },
  { chat_type: 'shannon', role: 'bot', message_text: 'Hello!', timestamp: Date.now() }
])
```

---

## 💪 Workouts (`dbHelpers.workouts`)

### Workout History
```javascript
// Create workout entry
await dbHelpers.workouts.createHistory(userId, {
  date: '2024-01-15',
  exercise: 'Squats',
  set: 1,
  time: '45s',
  reps: '12',
  kg: '60'
})

// Get workout history
const history = await dbHelpers.workouts.getHistory(
  userId,
  100  // limit (optional)
)
```

### Custom Workouts
```javascript
// Save custom workout template
await dbHelpers.workouts.saveCustomWorkout(
  userId,
  'My HIIT Workout',
  { exercises: [...], duration: 30, ... }
)

// Get all custom workouts
const customWorkouts = await dbHelpers.workouts.getCustomWorkouts(userId)
```

### Current Workout
```javascript
// Set current active workout
await dbHelpers.workouts.setCurrentWorkout(userId, workoutData)

// Get current workout
const current = await dbHelpers.workouts.getCurrentWorkout(userId)
```

---

## ✅ Daily Check-ins (`dbHelpers.checkins`)

```javascript
// Save or update check-in for a specific date
await dbHelpers.checkins.upsert(userId, '2024-01-15', {
  energy: 'high',
  equipment: 'gym',
  sleep: 'good',
  water: 8,
  additional: { mood: 'great' }  // optional extra data
})

// Get check-in for specific date
const checkin = await dbHelpers.checkins.get(userId, '2024-01-15')

// Get recent check-ins
const recent = await dbHelpers.checkins.getRecent(
  userId,
  30  // number of days (default 30)
)
```

---

## 📔 Reflections (`dbHelpers.reflections`)

```javascript
// Create reflection
await dbHelpers.reflections.create(
  userId,
  'Today I realized...',
  'standalone',  // or 'saturday_checkin'
  null           // story_key (for saturday checkins)
)

// Create Saturday check-in story
await dbHelpers.reflections.create(
  userId,
  'This week was amazing...',
  'saturday_checkin',
  'week_1'
)

// Get all reflections
const reflections = await dbHelpers.reflections.getAll(userId)
```

---

## 📝 Quiz Results (`dbHelpers.quizResults`)

```javascript
// Save quiz results
await dbHelpers.quizResults.create(userId, {
  menopause_status: 'perimenopause',
  cycle_description: 'irregular',
  activity_level: 'moderate',
  weight_storage_location: 'belly',
  goal_body_type: 'athletic',
  sleep_hours: '6-7',
  sleep_quality: 'poor',
  energy_level: 'low',
  energy_crashes: 'afternoon',
  caffeine_relationship: 'dependent',
  hormone_profile: 'CORTISOL',
  age: 35,
  weight: 150
})

// Get latest quiz result
const latestQuiz = await dbHelpers.quizResults.getLatest(userId)
```

---

## 📊 Activity Logging (`dbHelpers.activity`)

```javascript
// Log activity
await dbHelpers.activity.log(userId, 'workout_completed', {
  workout_type: 'strength',
  duration: 45
})

await dbHelpers.activity.log(userId, 'chat', {
  chat_type: 'shannon',
  message_length: 120
})

// Get recent activity
const activities = await dbHelpers.activity.getRecent(
  userId,
  50  // limit (default 50)
)
```

---

## 👑 Admin Operations (`dbHelpers.admin`)

```javascript
// Get all users with their facts and quiz results
const allUsers = await dbHelpers.admin.getAllUsers()

// Get specific user's conversations
const conversations = await dbHelpers.admin.getUserConversations(userId)

// Get analytics
const analytics = await dbHelpers.admin.getAnalytics()
// Returns: { totalUsers, activeUsers, totalMessages, inactiveUsers }
```

---

## 📁 Storage (`storageHelpers`)

```javascript
// Upload profile photo (file upload)
const photoUrl = await storageHelpers.uploadProfilePhoto(userId, fileObject)

// Upload reflection image
const imageUrl = await storageHelpers.uploadReflectionImage(
  userId,
  fileObject,
  reflectionId
)
```

---

## 🌐 Global Helpers (from auth-guard.js)

```javascript
// Available after auth-guard.js loads:

// Current user object
window.currentUser  // { id, email, ... }

// Get user profile
const profile = await getUserProfile()

// Get user facts
const facts = await getUserFacts()
```

---

## 📌 Common Patterns

### Check if user is logged in
```javascript
const session = await authHelpers.getSession()
if (!session) {
  window.location.href = '/login.html'
}
```

### Get current user ID
```javascript
const user = await authHelpers.getUser()
const userId = user.id
```

### Load user data on page load
```javascript
async function loadUserData() {
  const user = window.currentUser  // Set by auth-guard.js

  const profile = await getUserProfile()
  const facts = await getUserFacts()
  const chatHistory = await dbHelpers.conversations.getHistory(user.id, 'shannon')

  // Update UI with data
}
```

### Save data with error handling
```javascript
async function saveData() {
  try {
    await dbHelpers.users.update(window.currentUser.id, {
      name: newName
    })
    alert('Saved successfully!')
  } catch (error) {
    console.error('Save failed:', error)
    alert('Failed to save. Please try again.')
  }
}
```

### Real-time updates (listen for changes)
```javascript
// Subscribe to changes on a table
const channel = supabaseClient
  .channel('public:conversations')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'conversations',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    console.log('New message:', payload.new)
    // Update UI
  })
  .subscribe()
```

---

## ⚠️ Important Notes

1. **All database functions are async** - always use `await`
2. **Always handle errors** - wrap in try/catch
3. **User must be authenticated** - check session first
4. **Timestamps are automatic** - created_at/updated_at set by database
5. **Data is protected by RLS** - users can only access their own data

---

## 🔍 Debugging

### Check if data was saved
```javascript
const data = await dbHelpers.conversations.getHistory(userId, 'shannon')
console.log('Chat history:', data)
```

### View in Supabase dashboard
1. Go to Supabase dashboard
2. Click "Table Editor"
3. Select table to view
4. See all data

### Check for errors
```javascript
try {
  await dbHelpers.users.update(userId, { name: 'Test' })
} catch (error) {
  console.error('Error details:', error)
  console.error('Error message:', error.message)
  console.error('Error code:', error.code)
}
```

---

## 🎯 Migration Workflow

1. Find localStorage call
2. Find equivalent database helper above
3. Replace with database call
4. Add error handling
5. Test that it works
6. Remove old localStorage code

Example:
```javascript
// BEFORE
const name = localStorage.getItem('userName')

// AFTER
const profile = await getUserProfile()
const name = profile.name
```

---

## 📞 Need Help?

- Check browser console for errors
- Verify user is authenticated
- Check Supabase dashboard for data
- Review RLS policies if permission errors
- See MIGRATION_EXAMPLES.md for detailed examples

---

**Happy coding! 🚀**
