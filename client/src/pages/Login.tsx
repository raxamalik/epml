import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Building, Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// Remove unused auth hook import
import { apiRequest } from "@/lib/queryClient";

export default function Login() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  // Direct API request for login - no need for auth hook
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    twoFactorToken: '',
    rememberDevice: false
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempUserId, setTempUserId] = useState(null);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }

    if (requires2FA && !formData.twoFactorToken) {
      toast({
        title: "Error",
        description: "Please enter your 2FA verification code",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const requestData: any = {
        email: formData.email,
        password: formData.password
      };

      if (requires2FA && formData.twoFactorToken) {
        requestData.twoFactorToken = formData.twoFactorToken;
        requestData.rememberDevice = formData.rememberDevice;
      }

      const response = await apiRequest("POST", "/api/auth/login", requestData);
      const data = await response.json();
      
      if (data.requiresProfileCompletion) {
        // Company profile needs to be completed
        // Store secure profile token in localStorage
        localStorage.setItem('pendingProfileCompletion', JSON.stringify({
          profileToken: data.profileToken,
          email: data.email,
          companyName: data.companyName
        }));
        // Redirect to profile completion page
        window.location.href = "/complete-profile";
        toast({
          title: "Profile Completion Required",
          description: "Please complete your company profile to continue",
        });
      } else if (data.requires2FA) {
        // 2FA is required
        setRequires2FA(true);
        setTempUserId(data.tempUserId);
        toast({
          title: "2FA Required",
          description: "Please enter your Google Authenticator code",
        });
      } else if (data.message === "Login successful") {
        // Successful login
        window.location.href = "/";
        toast({
          title: "Welcome back!",
          description: "Successfully logged in to your account",
        });
      }
    } catch (error: any) {
      const errorData = error.message ? JSON.parse(error.message.split(': ')[1] || '{}') : {};
      toast({
        title: "Login Failed",
        description: errorData.message || "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md mx-4 shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-primary rounded-lg p-3">
              <Building className="h-8 w-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            Welcome to EPML
          </CardTitle>
          <p className="text-slate-600 text-sm">
            Access your enterprise management dashboard
          </p>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4" onKeyPress={handleKeyPress}>
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-slate-700">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="pl-10 border-slate-200 focus:border-primary focus:ring-primary"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-slate-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="pl-10 pr-10 border-slate-200 focus:border-primary focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            {requires2FA && (
              <div className="space-y-2">
                <Label htmlFor="login-2fa" className="text-slate-700">
                  Two-Factor Authentication Code
                </Label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="login-2fa"
                    type="text"
                    placeholder="Enter 6-digit code from your authenticator app"
                    value={formData.twoFactorToken}
                    onChange={(e) => handleInputChange('twoFactorToken', e.target.value)}
                    className="pl-10 border-slate-200 focus:border-primary focus:ring-primary text-center tracking-wider"
                    maxLength={6}
                  />
                </div>
                <p className="text-xs text-slate-500 text-center">
                  Open your Google Authenticator app and enter the 6-digit code
                </p>
                <div className="flex items-center space-x-2 text-sm">
                  <label className="flex items-center space-x-2 text-slate-600">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300" 
                      checked={formData.rememberDevice}
                      onChange={(e) => handleInputChange('rememberDevice', e.target.checked)}
                    />
                    <span>Remember this device for 30 days</span>
                  </label>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between text-sm">
              {!requires2FA && (
                <label className="flex items-center space-x-2 text-slate-600">
                  <input type="checkbox" className="rounded border-slate-300" />
                  <span>Remember me</span>
                </label>
              )}
              <Link href="/forgot-password">
                <button className="text-primary hover:text-blue-700 font-medium">
                  Forgot password?
                </button>
              </Link>
            </div>
            
            <Button 
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full bg-primary hover:bg-blue-700 text-white font-medium py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  Login
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}