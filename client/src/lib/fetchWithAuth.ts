import { logout } from "./simpleAuth";

/**
 * Helper function to make authenticated API requests with JWT token
 * Use this instead of direct fetch() calls for API requests
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers || {});
  
  // Add JWT token if available
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Add device token if available
  const deviceToken = localStorage.getItem('deviceToken');
  if (deviceToken) {
    headers.set('X-Device-Token', deviceToken);
  }
  
  // Set Content-Type if not already set and body is provided
  if (options.body && !headers.has('Content-Type')) {
    // Only set Content-Type for JSON, not for FormData
    if (!(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
  }
  
  const res = await fetch(url, {
    ...options,
    headers,
  });
  
  // Check for unauthorized token error and logout automatically
  if (res.status === 401) {
    try {
      const errorData = await res.clone().json();
      if (errorData.message === "Unauthorized - Invalid or expired token") {
        console.warn('Token expired or invalid, logging out...');
        await logout();
      }
    } catch {
      // If JSON parsing fails, ignore
    }
  }
  
  return res;
}

