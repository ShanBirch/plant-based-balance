/**
 * Authentication Guard
 * Include this file on pages that require authentication
 * Add <script src="/lib/auth-guard.js"></script> to protected pages
 */

(async function() {
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

  // Make user profile data available globally
  window.getUserProfile = async function() {
    if (window.userProfile) return window.userProfile;

    try {
      window.userProfile = await dbHelpers.users.get(user.id);
      return window.userProfile;
    } catch (error) {
      console.error('Failed to load user profile:', error);
      return null;
    }
  };

  // Make user facts available globally
  window.getUserFacts = async function() {
    if (window.userFacts) return window.userFacts;

    try {
      window.userFacts = await dbHelpers.userFacts.get(user.id);
      return window.userFacts;
    } catch (error) {
      console.error('Failed to load user facts:', error);
      return null;
    }
  };

  console.log('✅ Authentication verified:', user.email);
})();
