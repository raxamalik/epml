import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Clone the response since we might need to read it twice
      const responseClone = res.clone();
      const errorData = await responseClone.json();
      // Extract the actual error message from the response
      const message = errorData.message || res.statusText;
      const error = new Error(message);
      console.warn('API Error:', message);
      throw error;
    } catch (parseError) {
      // If JSON parsing fails, fall back to text
      try {
        const text = await res.text();
        const error = new Error(text || res.statusText);
        console.warn('API Error:', error.message);
        throw error;
      } catch (textError) {
        const error = new Error(res.statusText);
        console.warn('API Error:', error.message);
        throw error;
      }
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: any = data ? { "Content-Type": "application/json" } : {};
  
  // Include device token if available
  const deviceToken = localStorage.getItem('deviceToken');
  if (deviceToken) {
    headers['X-Device-Token'] = deviceToken;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
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
      const res = await fetch(queryKey[0] as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
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
