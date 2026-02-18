/**
 * Authentication Guard
 * Include this file on pages that require authentication
 * Add <script src="/lib/auth-guard.js"></script> to protected pages
 */

(async function() {
  // Make user functions available globally immediately
  window.getUserProfile = async function() {
    if (window.userProfile) return window.userProfile;
    if (!window.currentUser) return null;
    try {
      const [user, facts] = await Promise.all([
        dbHelpers.users.get(window.currentUser.id),
        dbHelpers.userFacts.get(window.currentUser.id).catch(e => ({}))
      ]);
      
      // Merge facts.personal_details into the main profile object for easy access
      const factsData = facts?.personal_details || {};
      window.userProfile = { ...user, ...factsData };
      
      return window.userProfile;
    } catch (error) {
      console.error('Failed to load user profile:', error);
      return null;
    }
  };

  window.getUserFacts = async function() {
    if (window.userFacts) return window.userFacts;
    if (!window.currentUser) return null;
    try {
      window.userFacts = await dbHelpers.userFacts.get(window.currentUser.id);
      return window.userFacts;
    } catch (error) {
      console.error('Failed to load user facts:', error);
      return null;
    }
  };

  // Check if user is authenticated
  const session = await authHelpers.getSession();

  if (!session) {
    // User is not logged in - redirect to login page
    const currentPath = window.location.pathname;
    const loginUrl = `/login.html?redirect=${encodeURIComponent(currentPath)}`;
    window.location.href = loginUrl;
    return;
  }

  // User is authenticated - get user data
  const user = await authHelpers.getUser();

  if (!user) {
    window.location.href = '/login.html';
    return;
  }

  // Store current user in global scope for easy access
  window.currentUser = user;

  // Check for admin "view as user" mode
  const _viewAsParams = new URLSearchParams(window.location.search);
  const _viewAsUserId = _viewAsParams.get('view_as');

  if (_viewAsUserId) {
    try {
      // Verify the current user is an admin
      const { data: adminCheck } = await window.supabaseClient
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (adminCheck) {
        // Admin verified — override currentUser to view as the target user
        window.adminUser = user;
        window.isAdminViewing = true;
        window.adminViewUserId = _viewAsUserId;

        // Fetch the target user's basic info
        const { data: targetUser } = await window.supabaseClient
          .from('users')
          .select('*')
          .eq('id', _viewAsUserId)
          .maybeSingle();

        if (targetUser) {
          // Override currentUser with the target user's ID so all data queries load their data
          window.currentUser = { ...user, id: _viewAsUserId, email: targetUser.email };
          window.adminViewUserName = targetUser.name || targetUser.email;
          console.log('👁️ Admin viewing account:', targetUser.name || targetUser.email);
        } else {
          console.warn('view_as user not found, loading own account');
          window.isAdminViewing = false;
        }
      } else {
        console.warn('Non-admin attempted view_as, ignoring');
      }
    } catch (e) {
      console.warn('view_as check failed:', e);
    }
  }

  // Update last_login and log activity (skip when admin is viewing another user)
  if (!window.isAdminViewing) {
    try {
      await dbHelpers.users.updateLastLogin(user.id);
    } catch (e) {
      console.warn('Failed to update last_login:', e);
    }

    try {
      await dbHelpers.activity.log(user.id, 'page_view', {
        path: window.location.pathname,
        referrer: document.referrer
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }

  // Set up auth state listener
  authHelpers.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = '/login.html';
    }
  });

  console.log('✅ Authentication verified:', user.email);
})();
