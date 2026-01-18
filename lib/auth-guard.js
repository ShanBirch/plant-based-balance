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
      window.userProfile = await dbHelpers.users.get(window.currentUser.id);
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

  // Log activity
  try {
    await dbHelpers.activity.log(user.id, 'page_view', {
      path: window.location.pathname,
      referrer: document.referrer
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }

  // Set up auth state listener
  authHelpers.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      window.location.href = '/login.html';
    }
  });

  console.log('✅ Authentication verified:', user.email);
})();
