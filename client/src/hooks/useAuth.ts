import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { login, logout, isAuthenticated } from "@/lib/simpleAuth";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function useAuth() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Check for suspended account message and show toast
  useEffect(() => {
    const suspendedMessage = localStorage.getItem('suspended_account_message');
    if (suspendedMessage) {
      toast({
        title: "Account Suspended",
        description: suspendedMessage,
        variant: "destructive",
      });
      // Clear the message after showing toast
      localStorage.removeItem('suspended_account_message');
    }

    // Listen for account suspended event
    const handleAccountSuspended = (event: CustomEvent) => {
      toast({
        title: "Account Suspended",
        description: event.detail.message || "Your account has been suspended. Please contact support.",
        variant: "destructive",
      });
    };

    window.addEventListener('accountSuspended', handleAccountSuspended as EventListener);
    return () => {
      window.removeEventListener('accountSuspended', handleAccountSuspended as EventListener);
    };
  }, [toast]);

  // Check if we're on a public route
  const isPublicRoute = typeof window !== 'undefined' && (
    window.location.pathname === '/login' ||
    window.location.pathname === '/auth' ||
    window.location.pathname.startsWith('/forgot-password') ||
    window.location.pathname.startsWith('/reset-password') ||
    window.location.pathname.startsWith('/company-activation')
  );

  // Check localStorage first - if no auth data, skip API call on public routes
  const hasStoredAuth = typeof window !== 'undefined' && !!localStorage.getItem('auth_user');
  
  // Get initial user data from localStorage if available (for immediate UI update)
  const getInitialUserData = () => {
    if (typeof window !== 'undefined' && hasStoredAuth) {
      try {
        const stored = localStorage.getItem('auth_user');
        return stored ? JSON.parse(stored) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  // Only fetch from API if:
  // 1. Not on a public route, OR
  // 2. On a public route but we have stored auth (to check if session is still valid)
  const shouldFetchUser = !isPublicRoute || hasStoredAuth;

  // Fetch current user from backend - skip unnecessary calls on public routes
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/auth/user');
        if (!res.ok) {
          // If API call fails, try localStorage as fallback
          const fallback = getInitialUserData();
          if (fallback) {
            return fallback;
          }
          throw new Error('Unauthorized');
        }
        const userData = await res.json();
        // Update localStorage with fresh data
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_user', JSON.stringify(userData));
        }
        return userData;
      } catch (error: any) {
        // Check if error is about suspended account
        // Note: The logout and toast will be handled by queryClient.ts
        // We just need to return null here to clear the user data
        if (error?.message && (
          error.message.includes("account has been suspended") ||
          error.message.includes("company account has been suspended")
        )) {
          // Clear user data immediately
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_user');
            localStorage.removeItem('auth_token');
          }
          return null;
        }
        
        // Silently fail on public routes - user is just not authenticated
        if (!isPublicRoute) {
          console.log("Failed to fetch user:", error);
        }
        // Try localStorage as fallback
        const fallback = getInitialUserData();
        return fallback || null;
      }
    },
    retry: false,
    staleTime: 0, // Always refetch to get latest data including profile image
    enabled: shouldFetchUser, // Only fetch when needed
    refetchOnMount: true, // Always refetch on mount to get latest profile image
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      setIsLoading(true);
      const success = await login(credentials.email, credentials.password);
      if (success) {
        // Get user data from login response (stored in localStorage by login function)
        const storedUser = localStorage.getItem('auth_user');
        if (storedUser) {
          try {
            const userData = JSON.parse(storedUser);
            // Set user data in query cache immediately
            queryClient.setQueryData(['/api/auth/user'], userData);
          } catch (e) {
            console.error("Failed to parse stored user:", e);
          }
        }
        
        // Try to fetch fresh user data, but don't fail if it doesn't work yet
        // The session cookie might need a moment to be available
        try {
          // Wait a bit for session cookie to be set
          await new Promise(resolve => setTimeout(resolve, 200));
          const userResponse = await apiRequest('GET', '/api/auth/user');
          if (userResponse.ok) {
            const userData = await userResponse.json();
            queryClient.setQueryData(['/api/auth/user'], userData);
          }
        } catch (error) {
          // If fetch fails, use stored user data - session will be available on next request
          console.log("Could not fetch user immediately after login, using stored data:", error);
        }
        
        toast({
          title: "Login successful",
          description: "Welcome back to your dashboard!",
        });
        // Redirect after ensuring user data is set
        setTimeout(() => {
          window.location.href = "/";
        }, 300);
        return true;
      } else {
        throw new Error("Invalid credentials");
      }
    },
    onError: (error) => {
      toast({
        title: "Login failed",
        description: error.message || "Please check your email and password",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: { email: string; password: string; firstName: string; lastName: string }) => {
      setIsLoading(true);
      try {
        const response = await apiRequest('POST', '/api/auth/register', {
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Registration failed');
        }
        
        const data = await response.json();
        
        // Registration returns JWT token, so store token and user data
        if (data.token && data.user) {
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('auth_user', JSON.stringify(data.user));
          // Set user data in query cache immediately so isAuthenticated updates
          queryClient.setQueryData(['/api/auth/user'], data.user);
          // Also invalidate to ensure fresh data is fetched
          queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          toast({
            title: "Registration successful",
            description: "Your account has been created! Welcome!",
          });
          // Wait a moment for the query to update, then redirect
          setTimeout(() => {
            window.location.href = "/";
          }, 100);
          return true;
        } else {
          throw new Error("Registration response missing token or user data");
        }
      } catch (error: any) {
        throw error;
      }
    },
    onError: (error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please check your information and try again",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await logout(); // Now logout returns a Promise
      queryClient.setQueryData(['/api/auth/user'], null);
      queryClient.clear();
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account",
      });
    },
    onError: (error) => {
      toast({
        title: "Logout completed",
        description: "You have been logged out",
      });
    },
  });

  return {
    user,
    isLoading: isLoading || userLoading,
    isAuthenticated: !!user, // User is authenticated if we have user data
    loginMutation,
    registerMutation,
    logoutMutation,
  };
}
