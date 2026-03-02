# AI Coach Response Approval System

## Overview

The AI Coach Approval System allows you to review and approve AI-generated responses from Coach Shannon before they are sent to users. You'll receive push notifications on your phone with the ability to quickly approve, edit, or reject responses.

## Features

- **Push Notifications**: Get notified immediately when an AI response needs approval
- **Quick Actions**: Approve or edit responses directly from the notification
- **Edit Capability**: Modify AI responses before sending them to users
- **Approval Modal**: Clean, easy-to-use interface for reviewing responses
- **Rejection Tracking**: Reject inappropriate responses with optional reason

## Setup Instructions

### 1. Database Migration

First, run the database migration to create the `pending_coach_responses` table:

```sql
-- Run this in your Supabase SQL Editor
-- File: database/migration_pending_responses.sql
```

Copy and paste the entire contents of `database/migration_pending_responses.sql` into your Supabase SQL Editor and execute it.

### 2. Set Up Admin User

To receive approval notifications, your user account needs to be added to the `admin_users` table:

```sql
-- Replace 'YOUR_USER_ID' with your actual Supabase user ID
-- You can find this in the Supabase Auth dashboard

INSERT INTO public.admin_users (user_id, role, permissions)
VALUES (
  'YOUR_USER_ID',
  'admin',
  '["view_users", "view_conversations", "view_analytics", "approve_responses"]'
);
```

### 3. Enable Push Notifications

On your device:

1. Open the Plant Based Balance app
2. When prompted, allow notifications
3. Make sure notifications are enabled in your device settings

## How It Works

### Workflow

1. **User sends message** to Coach Shannon
2. **AI generates response** using Gemini API
3. **Response saved as pending** in `pending_coach_responses` table
4. **You get notified** via push notification on your phone
5. **You review and approve/edit/reject** the response
6. **Response sent to user** (if approved)

### Notification Actions

When you receive a notification about a pending response:

- **Click notification**: Opens the approval modal
- **Approve action** (if available): Quick approve without editing
- **Edit action** (if available): Opens modal to edit before sending

### Approval Modal

The approval modal shows:

- **User name**: Who sent the message
- **User message**: What the user asked
- **AI response**: Editable text area with the AI-generated response
- **Actions**:
  - **Approve & Send**: Sends the response (with any edits) to the user
  - **Reject**: Discards the response

### Editing Responses

1. Click on the notification or manually open the approval modal
2. Edit the text in the "AI Response" text area
3. Click "Approve & Send" to send the edited response
4. The original AI response is preserved for audit purposes

## Technical Details

### Database Schema

**pending_coach_responses table:**
- `id`: UUID primary key
- `user_id`: Reference to the user who will receive the response
- `message_text`: The AI-generated response (editable)
- `original_message_text`: Original AI response for audit trail
- `status`: 'pending', 'approved', or 'rejected'
- `user_message_text`: The user's original message
- `context_snapshot`: Captured context at time of generation
- `approved_by`: Admin user ID who approved
- `approved_at`: Timestamp of approval
- `rejection_reason`: Reason for rejection (if applicable)

### API Functions

**Supabase Helper Functions** (`lib/supabase.js`):

```javascript
db.pendingResponses.create(userId, messageText, userMessageText, contextSnapshot)
db.pendingResponses.getPending(limit)
db.pendingResponses.getById(id)
db.pendingResponses.approve(id, approvedBy, editedMessage)
db.pendingResponses.reject(id, rejectionReason)
db.pendingResponses.getPendingCount()
```

**Dashboard Functions** (`dashboard.html`):

```javascript
window.openApprovalModal(pendingId)  // Open the approval modal
window.closeApprovalModal()          // Close the approval modal
window.approveResponse()             // Approve and send the response
window.rejectResponse()              // Reject the response
notifyAdminOfPendingResponse()       // Send notification to admin
```

### Notification System

The system uses the Web Push API and Service Worker for notifications:

- **Service Worker** (`sw.js`): Handles notification clicks and routes to approval modal
- **Push Notifications**: Sent when new pending response is created
- **App Badge**: Shows count of pending responses

## Manual Approval Check

If you miss a notification, you can manually check for pending responses:

```javascript
// Open the approval modal from browser console
window.openApprovalModal()
```

Or add a button to your admin dashboard:

```html
<button onclick="openApprovalModal()">
  Check Pending Approvals
</button>
```

## Security

- **Row Level Security (RLS)**: Only admins can view and update pending responses
- **Admin Policies**: Enforced at database level
- **Audit Trail**: Original AI responses are preserved
- **User Privacy**: Users only see approved responses

## Troubleshooting

### Notifications Not Working

1. Check browser notification permissions
2. Verify service worker is registered: `navigator.serviceWorker.ready`
3. Check admin_users table to ensure you're set up as admin
4. Test notification permission: `Notification.permission` should be "granted"

### Modal Not Opening

1. Check browser console for errors
2. Verify modal HTML exists: `document.getElementById('approval-modal')`
3. Check that openApprovalModal function is defined: `typeof window.openApprovalModal`

### Database Errors

1. Verify migration was run successfully
2. Check RLS policies are enabled
3. Ensure admin_users table has your user ID
4. Check Supabase logs for detailed error messages

## Future Enhancements

Potential improvements to consider:

- Batch approval for multiple responses
- Response templates for common scenarios
- Analytics on approval/rejection rates
- Automated approval for certain types of responses
- Email notifications as backup to push notifications
- Approval history and statistics dashboard
- Multi-admin support with role-based permissions

## Support

If you encounter any issues with the approval system:

1. Check the browser console for error messages
2. Verify database tables and policies are set up correctly
3. Test with a simple user message to Coach Shannon
4. Review Supabase logs for server-side errors
