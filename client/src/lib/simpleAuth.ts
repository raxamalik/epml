// Session-based auth (server uses express-session with cookies)
export async function login(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: 'include', // Important: Include cookies for session
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const data = await response.json();
      
      // Handle 2FA requirement
      if (data.requires2FA) {
        throw new Error("2FA_REQUIRED");
      }
      
      // Handle profile completion requirement
      if (data.requiresProfileCompletion) {
        throw new Error("PROFILE_COMPLETION_REQUIRED");
      }
      
      // Server uses sessions, so we just store user data in localStorage for client-side access
      if (data.user) {
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        return true;
      }
      
      throw new Error('Login response missing user data');
    } else {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Login failed');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Network error occurred');
  }
}

export async function logout(): Promise<void> {
  try {
    // Call server logout endpoint to destroy session
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // Clear any localStorage data as well (for cleanup)
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('user2FA');
    
    // Force redirect to login page
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout error:', error);
    // Even if server call fails, clear local data and redirect
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('user2FA');
    window.location.href = '/login';
  }
}

export function getUser() {
  const user = localStorage.getItem('auth_user');
  if (user) {
    try {
      return JSON.parse(user);
    } catch {
      return null;
    }
  }
  return null;
}

export function isAuthenticated(): boolean {
  // Check if we have user data in localStorage
  // Note: Actual auth is handled by server sessions, this is just for client-side state
  return !!localStorage.getItem('auth_user');
}