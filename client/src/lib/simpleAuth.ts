// JWT-based auth
export async function login(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    // Parse response
    let data: any;
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      console.error('Failed to parse login response:', parseError);
      throw new Error('Invalid response from server');
    }

    if (response.ok) {
      // Handle 2FA requirement
      if (data.requires2FA) {
        throw new Error("2FA_REQUIRED");
      }
      
      // Handle profile completion requirement
      if (data.requiresProfileCompletion) {
        throw new Error("PROFILE_COMPLETION_REQUIRED");
      }
      
      // Store JWT token and user data
      if (data.token && data.user) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        return true;
      }
      
      // Log the actual response for debugging
      console.error('Login response missing token or user data. Response:', {
        hasToken: !!data.token,
        hasUser: !!data.user,
        message: data.message,
        fullResponse: data
      });
      throw new Error('Login response missing token or user data');
    } else {
      throw new Error(data.message || `Login failed with status ${response.status}`);
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