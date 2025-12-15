import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { logout } from "./simpleAuth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorData: any = null;
    let errorMessage = res.statusText;
    
    try {
      // Clone the response so we can read it without consuming the original
      const clonedRes = res.clone();
      let text = '';
      
      try {
        text = await clonedRes.text();
      } catch (textError) {
        // Try to read from original response as fallback
        try {
          text = await res.text();
        } catch (originalError) {
          // If both fail, use status text
        }
      }
      
      // Try to parse as JSON
      if (text && text.trim().length > 0) {
        try {
          errorData = JSON.parse(text);
          // Extract message from various possible fields
          errorMessage = errorData.message || errorData.error || errorData.detail || errorMessage;
        } catch (parseError) {
          // If JSON parsing fails, use the text as the message
          errorMessage = text || errorMessage;
        }
      }
      
      // Check for unauthorized token error and logout automatically
      if (res.status === 401 && errorMessage === "Unauthorized - Invalid or expired token") {
        console.warn('Token expired or invalid, logging out...');
        await logout();
        throw new Error('Unauthorized - Invalid or expired token');
      }
      
      // Check for suspended account (403) and logout automatically
      if (res.status === 403 && (
        errorMessage.includes("account has been suspended") ||
        errorMessage.includes("company account has been suspended")
      )) {
        console.warn('Account suspended, logging out...');
        // Store suspension message for toast notification
        localStorage.setItem('suspended_account_message', errorMessage);
        // Dispatch custom event for suspended account
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('accountSuspended', { detail: { message: errorMessage } }));
        }
        await logout();
        throw new Error(errorMessage);
      }
      
      const error = new Error(errorMessage);
      // Store the full error data for debugging
      (error as any).errorData = errorData;
      (error as any).status = res.status;
      throw error;
    } catch (error: any) {
      // If error is already an Error object (from above), re-throw it
      if (error instanceof Error && error.message !== res.statusText) {
        throw error;
      }
      // Otherwise, create a new error with the extracted message
      const finalError = new Error(errorMessage);
      (finalError as any).errorData = errorData;
      (finalError as any).status = res.status;
      throw finalError;
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: any = data ? { "Content-Type": "application/json" } : {};
  
  // Include JWT token if available
  const token = localStorage.getItem('auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Include device token if available
  const deviceToken = localStorage.getItem('deviceToken');
  if (deviceToken) {
    headers['X-Device-Token'] = deviceToken;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  
  // Check for new device token in response headers
  const newDeviceToken = res.headers.get('X-Device-Token');
  if (newDeviceToken) {
    localStorage.setItem('deviceToken', newDeviceToken);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const headers: any = {};
      
      // Include JWT token if available
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const res = await fetch(queryKey[0] as string, {
        headers,
      });

      // Check for unauthorized token error
      if (res.status === 401) {
        try {
          const errorData = await res.clone().json();
          if (errorData.message === "Unauthorized - Invalid or expired token") {
            console.warn('Token expired or invalid, logging out...');
            await logout();
            return null;
          }
        } catch {
          // If JSON parsing fails, still handle 401
        }
        
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
      }

      // Check for suspended account (403) and logout automatically
      if (res.status === 403) {
        try {
          const errorData = await res.clone().json();
          const errorMessage = errorData.message || errorData.error || errorData.detail || '';
          if (
            errorMessage.includes("account has been suspended") ||
            errorMessage.includes("company account has been suspended")
          ) {
            console.warn('Account suspended, logging out...');
            // Store suspension message for toast notification
            localStorage.setItem('suspended_account_message', errorMessage);
            // Dispatch custom event for suspended account
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('accountSuspended', { detail: { message: errorMessage } }));
            }
            await logout();
            return null;
          }
        } catch {
          // If JSON parsing fails, continue with normal error handling
        }
      }

      if (!res.ok) {
        console.warn(`API Error: ${res.status} ${res.statusText} for ${queryKey[0]}`);
        return null;
      }

      return await res.json();
    } catch (error) {
      console.warn(`Fetch Error for ${queryKey[0]}:`, error);
      return null;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
