import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { login, logout, isAuthenticated } from "@/lib/simpleAuth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function useAuth() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Fetch current user from backend - always try to get user, let backend handle auth
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      try {
        const res = await apiRequest('GET', '/api/auth/user');
        return await res.json();
      } catch (error) {
        console.log("Failed to fetch user:", error);
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      setIsLoading(true);
      const success = await login(credentials.email, credentials.password);
      if (success) {
        // Refetch user data to get complete info including storeId
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        toast({
          title: "Login successful",
          description: "Welcome back to your dashboard!",
        });
        // Redirect to dashboard on successful login
        window.location.href = "/";
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
      // For demo, just use same login logic
      const success = await login(userData.email, userData.password);
      if (success) {
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        return true;
      } else {
        throw new Error("Registration failed");
      }
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
