import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building, Eye, EyeOff, Mail, Lock, User, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function AuthLanding() {
  const { isAuthenticated, loginMutation, registerMutation } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    confirmPassword: ""
  });

  // If already authenticated, redirect to main app
  if (isAuthenticated) {
    window.location.href = "/";
    return null;
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = () => {
    loginMutation.mutate({
      email: formData.email,
      password: formData.password
    });
  };

  const handleRegister = () => {
    registerMutation.mutate({
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName
    });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        
        {/* Left Side - Branding & Features */}
        <div className="hidden lg:block space-y-8">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start mb-6">
              <div className="bg-primary rounded-xl p-4 shadow-lg">
                <Building className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Enterprise Platform Management
            </h1>
            <p className="text-xl text-slate-600 mb-8">
              Streamline your business operations with our comprehensive admin panel
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4 text-slate-700">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Multi-role user management system</span>
            </div>
            <div className="flex items-center space-x-4 text-slate-700">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <span>Real-time analytics and reporting</span>
            </div>
            <div className="flex items-center space-x-4 text-slate-700">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span>Store and inventory management</span>
            </div>
            <div className="flex items-center space-x-4 text-slate-700">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Secure authentication and authorization</span>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Forms */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <div className="lg:hidden flex items-center justify-center mb-4">
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
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                    Sign In
                  </TabsTrigger>
                  <TabsTrigger value="register" className="data-[state=active]:bg-primary data-[state=active]:text-white">
                    Sign Up
                  </TabsTrigger>
                </TabsList>
                
                {/* Login Tab */}
                <TabsContent value="login" className="space-y-4">
                  <div className="space-y-4">
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
                    
                    <div className="flex items-center justify-between text-sm">
                      <label className="flex items-center space-x-2 text-slate-600">
                        <input type="checkbox" className="rounded border-slate-300" />
                        <span>Remember me</span>
                      </label>
                      <Link href="/forgot-password">
                        <button className="text-primary hover:text-blue-700 font-medium">
                          Forgot password?
                        </button>
                      </Link>
                    </div>
                    
                    <Button 
                      onClick={handleLogin}
                      className="w-full bg-primary hover:bg-blue-700 text-white font-medium py-2.5"
                    >
                      Sign In to Dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
                
                {/* Register Tab */}
                <TabsContent value="register" className="space-y-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-slate-700">First Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            id="firstName"
                            placeholder="First name"
                            value={formData.firstName}
                            onChange={(e) => handleInputChange('firstName', e.target.value)}
                            className="pl-10 border-slate-200 focus:border-primary focus:ring-primary"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-slate-700">Last Name</Label>
                        <Input
                          id="lastName"
                          placeholder="Last name"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          className="border-slate-200 focus:border-primary focus:ring-primary"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="text-slate-700">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="register-email"
                          type="email"
                          placeholder="Enter your email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="pl-10 border-slate-200 focus:border-primary focus:ring-primary"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-slate-700">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a password"
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
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-slate-700">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          id="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          placeholder="Confirm your password"
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                          className="pl-10 border-slate-200 focus:border-primary focus:ring-primary"
                        />
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-600">
                      By signing up, you agree to our{" "}
                      <button className="text-primary hover:text-blue-700 font-medium">
                        Terms of Service
                      </button>{" "}
                      and{" "}
                      <button className="text-primary hover:text-blue-700 font-medium">
                        Privacy Policy
                      </button>
                    </div>
                    
                    <Button 
                      onClick={handleRegister}
                      className="w-full bg-accent hover:bg-green-600 text-white font-medium py-2.5"
                    >
                      Create Account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
              
              {/* Enterprise Login Options */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <p className="text-center text-sm text-slate-500 mb-4">
                  Or continue with Enterprise Authentication
                </p>
                <Button 
                  onClick={() => setActiveTab("login")}
                  variant="outline" 
                  className="w-full border-slate-200 hover:bg-slate-50"
                >
                  <div className="w-5 h-5 bg-primary rounded mr-2"></div>
                  Access Admin Panel
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Demo Credentials */}
          <div className="mt-4 p-4 bg-slate-100/60 rounded-lg text-center">
            <p className="text-xs text-slate-600 mb-2">Enterprise Access:</p>
            <p className="text-xs text-slate-500">
              Click "Continue with SSO" to access the admin panel
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}