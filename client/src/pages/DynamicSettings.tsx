import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  User,
  Building,
  Globe,
  Bell,
  Shield,
  Lock,
  Settings as SettingsIcon,
  Save,
  Timer,
  Database,
  Palette,
  Upload,
  Camera,
  X,
  Smartphone,
  Key,
  Copy,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProfileAvatar } from "@/components/ui/profile-avatar";

// Settings form schema
const settingsSchema = z.object({
  // Profile settings (only for individual users)
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  profileImageUrl: z.string().optional(),
  
  // Regional settings
  timezone: z.string(),
  language: z.string(),
  currency: z.string(),
  
  // Notifications
  emailNotifications: z.boolean(),
  smsAlerts: z.boolean(),
  weeklyReports: z.boolean(),
  storeAlerts: z.boolean(),
  
  // Security
  sessionTimeout: z.number(),
  requireUppercase: z.boolean(),
  requireNumbers: z.boolean(),
  requireSymbols: z.boolean(),
  twoFactorEnabled: z.boolean(),
  
  // System
  loginAuditTrail: z.boolean(),
  dataRetention: z.number(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface UserInfo {
  id: string;
  email: string;
  role: string;
  type: 'user' | 'company';
  companyId?: number;
}

export default function DynamicSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // 2FA States
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [is2FASetupModalOpen, setIs2FASetupModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [manualEntryKey, setManualEntryKey] = useState<string | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isLoading2FA, setIsLoading2FA] = useState(false);

  // Get current user info
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Check 2FA status from localStorage
  useEffect(() => {
    const stored2FA = localStorage.getItem('user2FA');
    if (stored2FA) {
      try {
        const data = JSON.parse(stored2FA);
        setIs2FAEnabled(data.enabled || false);
        setTwoFactorSecret(data.secret || null);
      } catch (error) {
        console.warn('Failed to parse 2FA settings:', error);
      }
    }
  }, []);

  // 2FA Setup Functions
  const setup2FA = async () => {
    setIsLoading2FA(true);
    try {
      const response = await apiRequest("POST", "/api/2fa/setup");
      const data = await response.json();
      
      setQrCodeUrl(data.qrCodeUrl);
      setManualEntryKey(data.manualEntryKey);
      setTwoFactorSecret(data.secret);
      setIs2FASetupModalOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to setup 2FA. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading2FA(false);
    }
  };

  const verify2FASetup = async () => {
    if (!twoFactorSecret || !verificationCode) {
      toast({
        title: "Error",
        description: "Please enter the verification code.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading2FA(true);
    try {
      const response = await apiRequest("POST", "/api/2fa/verify-setup", {
        secret: twoFactorSecret,
        token: verificationCode,
      });
      const data = await response.json();

      if (data.success) {
        // Save 2FA settings to localStorage
        localStorage.setItem('user2FA', JSON.stringify({
          enabled: true,
          secret: twoFactorSecret,
          setupDate: new Date().toISOString()
        }));

        setIs2FAEnabled(true);
        setBackupCodes(data.backupCodes);
        setIsSetupComplete(true);
        
        toast({
          title: "Success",
          description: "Two-Factor Authentication has been enabled successfully!",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid verification code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading2FA(false);
    }
  };

  const disable2FA = async () => {
    setIsLoading2FA(true);
    try {
      // Remove from localStorage
      localStorage.removeItem('user2FA');
      
      setIs2FAEnabled(false);
      setTwoFactorSecret(null);
      setIs2FASetupModalOpen(false);
      setIsSetupComplete(false);
      setBackupCodes([]);
      setVerificationCode("");
      
      toast({
        title: "Success",
        description: "Two-Factor Authentication has been disabled.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disable 2FA. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading2FA(false);
    }
  };

  const closeSetupModal = () => {
    setIs2FASetupModalOpen(false);
    setIsSetupComplete(false);
    setQrCodeUrl(null);
    setManualEntryKey(null);
    setTwoFactorSecret(null);
    setVerificationCode("");
    setBackupCodes([]);
  };

  // Get settings (temporarily use localStorage until backend is ready)
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      // For now, return default settings from localStorage or defaults
      const stored = localStorage.getItem('userSettings');
      let parsedSettings = null;
      if (stored) {
        parsedSettings = JSON.parse(stored);
        // Force loginAuditTrail to always be true for security compliance
        parsedSettings.loginAuditTrail = true;
      }
      return parsedSettings || {
        timezone: "Europe/Prague",
        language: "en",
        currency: "EUR",
        emailNotifications: true,
        smsAlerts: false,
        weeklyReports: true,
        storeAlerts: true,
        sessionTimeout: 30,
        requireUppercase: true,
        requireNumbers: true,
        requireSymbols: false,
        twoFactorEnabled: false,
        loginAuditTrail: true,
        dataRetention: 365,
      };
    },
    retry: false,
  });

  // Form setup
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      timezone: "Europe/Prague",
      language: "en",
      currency: "EUR",
      emailNotifications: true,
      smsAlerts: false,
      weeklyReports: true,
      storeAlerts: true,
      sessionTimeout: 30,
      requireUppercase: true,
      requireNumbers: true,
      requireSymbols: false,
      twoFactorEnabled: false,
      loginAuditTrail: true,
      dataRetention: 365,
    },
  });

  // Update form when settings are loaded
  useEffect(() => {
    if (settings) {
      form.reset(settings);
    }
  }, [settings, form]);

  // Determine user type from the user data
  useEffect(() => {
    if (user) {
      setUserInfo({
        id: user.id,
        email: user.email,
        role: user.role || 'manager',
        type: user.type || 'user',
        companyId: user.companyId,
      });
    }
  }, [user]);

  // Settings mutation (temporarily use localStorage)
  const settingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      // Force loginAuditTrail to always be true for security compliance
      const safeData = {
        ...data,
        loginAuditTrail: true,
      };
      // Store in localStorage for now
      localStorage.setItem('userSettings', JSON.stringify(safeData));
      return safeData;
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your settings have been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    settingsMutation.mutate(data);
  };

  // Handle profile image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file (JPG, PNG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);

    try {
      // Create a preview URL
      const previewUrl = URL.createObjectURL(file);
      setProfileImagePreview(previewUrl);

      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        form.setValue('profileImageUrl', base64String);
        toast({
          title: "Image Uploaded",
          description: "Profile image has been updated. Remember to save your settings.",
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeProfileImage = () => {
    form.setValue('profileImageUrl', '');
    setProfileImagePreview(null);
    toast({
      title: "Image Removed",
      description: "Profile image has been removed. Remember to save your settings.",
    });
  };

  if (settingsLoading || !userInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Define which tabs are available for each user type
  const getAvailableTabs = () => {
    const tabs = [];
    
    // Profile tab only for individual users, not companies
    if (userInfo.type === 'user') {
      tabs.push({ id: 'profile', label: 'Profile', icon: User });
    }
    
    // Company info tab only for companies
    if (userInfo.type === 'company') {
      tabs.push({ id: 'company', label: 'Company Info', icon: Building });
    }
    
    // Regional settings for everyone
    tabs.push({ id: 'regional', label: 'Regional', icon: Globe });
    
    // Notifications for everyone
    tabs.push({ id: 'notifications', label: 'Notifications', icon: Bell });
    
    // Security settings for everyone
    tabs.push({ id: 'security', label: 'Security', icon: Shield });
    
    // System settings only for admins and company admins
    if (userInfo.role === 'super_admin' || userInfo.role === 'company_admin') {
      tabs.push({ id: 'system', label: 'System', icon: Database });
    }
    
    return tabs;
  };

  const availableTabs = getAvailableTabs();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-2">
          {userInfo.type === 'company' ? 
            `Manage your company settings and preferences` : 
            `Manage your personal settings and preferences`
          }
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue={availableTabs[0]?.id} className="space-y-6">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)` }}>
              {availableTabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Profile Tab (Individual Users Only) */}
            {userInfo.type === 'user' && (
              <TabsContent value="profile" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Personal Information
                    </CardTitle>
                    <CardDescription>
                      Update your personal details and contact information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="profileImageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profile Image</FormLabel>
                          <div className="space-y-4">
                            {/* Current Image Preview */}
                            <div className="flex items-center space-x-4">
                              <div className="relative">
                                {(profileImagePreview || field.value) ? (
                                  <div className="relative">
                                    <ProfileAvatar
                                      user={{
                                        ...userInfo,
                                        profileImageUrl: profileImagePreview || field.value
                                      }}
                                      size="xl"
                                      className="w-20 h-20"
                                      showBorder={true}
                                    />
                                    <button
                                      type="button"
                                      onClick={removeProfileImage}
                                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <ProfileAvatar
                                    user={userInfo}
                                    size="xl"
                                    className="w-20 h-20 border-2 border-dashed border-gray-300"
                                  />
                                )}
                              </div>
                              
                              {/* Upload Button */}
                              <div className="space-y-2">
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    disabled={isUploadingImage}
                                  />
                                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md border border-blue-200 transition-colors">
                                    {isUploadingImage ? (
                                      <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                                    ) : (
                                      <Camera className="h-4 w-4" />
                                    )}
                                    {isUploadingImage ? "Uploading..." : "Upload Image"}
                                  </div>
                                </label>
                                <p className="text-xs text-gray-500">
                                  JPG, PNG, GIF up to 5MB
                                </p>
                              </div>
                            </div>

                            {/* Alternative URL Input */}
                            <div>
                              <FormLabel className="text-sm text-gray-600">Or enter image URL:</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  value={field.value || ""} 
                                  placeholder="https://example.com/image.jpg"
                                  className="mt-1"
                                  onChange={(e) => {
                                    field.onChange(e);
                                    if (e.target.value && e.target.value.startsWith('http')) {
                                      setProfileImagePreview(e.target.value);
                                    }
                                  }}
                                />
                              </FormControl>
                            </div>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Company Info Tab (Companies Only) */}
            {userInfo.type === 'company' && (
              <TabsContent value="company" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      Company Information
                    </CardTitle>
                    <CardDescription>
                      Company-wide settings and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Company Account:</strong> These settings apply to all users in your company.
                        Individual users can override some preferences in their personal settings.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Regional Settings Tab */}
            <TabsContent value="regional" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Regional Settings
                  </CardTitle>
                  <CardDescription>
                    Configure timezone, currency, and language preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Timezone</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Europe/Prague">Prague (UTC+1)</SelectItem>
                            <SelectItem value="Europe/London">London (UTC+0)</SelectItem>
                            <SelectItem value="Europe/Berlin">Berlin (UTC+1)</SelectItem>
                            <SelectItem value="Europe/Vienna">Vienna (UTC+1)</SelectItem>
                            <SelectItem value="America/New_York">New York (UTC-5)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Currency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="EUR">Euro (EUR)</SelectItem>
                            <SelectItem value="CZK">Czech Koruna (CZK)</SelectItem>
                            <SelectItem value="USD">US Dollar (USD)</SelectItem>
                            <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Language</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="cs">Czech</SelectItem>
                            <SelectItem value="sk">Slovak</SelectItem>
                            <SelectItem value="de">German</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>
                    Choose how you want to receive alerts and notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="emailNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Email Notifications</FormLabel>
                          <FormDescription>
                            Receive email alerts for important events and updates
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="smsAlerts"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">SMS Alerts</FormLabel>
                          <FormDescription>
                            Get SMS notifications for critical issues
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="weeklyReports"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Weekly Reports</FormLabel>
                          <FormDescription>
                            Automatically generate and send weekly analytics reports
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="storeAlerts"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Store Alerts</FormLabel>
                          <FormDescription>
                            Notifications when stores go offline or have issues
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Password & Authentication */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Password & Authentication
                    </CardTitle>
                    <CardDescription>
                      Manage security settings and authentication methods
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="sessionTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Session Timeout (minutes)</FormLabel>
                          <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select timeout" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="15">15 minutes</SelectItem>
                              <SelectItem value="30">30 minutes</SelectItem>
                              <SelectItem value="60">1 hour</SelectItem>
                              <SelectItem value="240">4 hours</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Two-Factor Authentication Section */}
                    <div className="rounded-lg border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Smartphone className="h-4 w-4" />
                            <Label className="text-base font-medium">Two-Factor Authentication</Label>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Add an extra layer of security using Google Authenticator
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {is2FAEnabled ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-green-600">Enabled</span>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={disable2FA}
                                disabled={isLoading2FA}
                              >
                                {isLoading2FA ? "Disabling..." : "Disable"}
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              onClick={setup2FA}
                              disabled={isLoading2FA}
                              size="sm"
                            >
                              {isLoading2FA ? "Setting up..." : "Enable 2FA"}
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {is2FAEnabled && (
                        <div className="text-sm text-muted-foreground pt-2 border-t">
                          <p>✓ Two-factor authentication is active on your account</p>
                          <p>Use your authenticator app to generate codes when logging in</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Password Policy */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Password Policy
                    </CardTitle>
                    <CardDescription>
                      Configure password requirements
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="requireUppercase"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm">
                              Require uppercase letters
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requireNumbers"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm">
                              Require numbers
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requireSymbols"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="text-sm">
                              Require special characters
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* System Settings Tab (Admin Only) */}
            {(userInfo.role === 'super_admin' || userInfo.role === 'company_admin') && (
              <TabsContent value="system" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      System Settings
                    </CardTitle>
                    <CardDescription>
                      Advanced system configuration and audit settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="loginAuditTrail"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-slate-50/50">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base flex items-center gap-2">
                              Login Audit Trail
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                Always Enabled
                              </span>
                            </FormLabel>
                            <FormDescription>
                              Track all user login activities and maintain logs (cannot be disabled for security compliance)
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={true}
                              disabled
                              className="opacity-60"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dataRetention"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Retention Period (days)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              value={field.value}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                              min={30}
                              max={3650}
                            />
                          </FormControl>
                          <FormDescription>
                            How long to keep user activity logs and system data
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>

          {/* Save Button */}
          <div className="flex justify-end pt-6">
            <Button 
              type="submit" 
              disabled={settingsMutation.isPending}
              className="min-w-[120px]"
            >
              <Save className="h-4 w-4 mr-2" />
              {settingsMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>

      {/* 2FA Setup Modal */}
      <Dialog open={is2FASetupModalOpen} onOpenChange={setIs2FASetupModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-blue-600" />
              </div>
              Set Up Two-Factor Authentication
            </DialogTitle>
            <DialogDescription className="text-base text-slate-600 mt-2">
              Secure your account with Google Authenticator for enhanced protection
            </DialogDescription>
          </DialogHeader>

          {!isSetupComplete ? (
            <div className="space-y-6">
              {qrCodeUrl && (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        1
                      </div>
                      <div>
                        <p className="font-semibold text-blue-900 mb-1">Scan QR Code</p>
                        <p className="text-blue-700 text-sm">
                          Open Google Authenticator and scan the QR code below
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center py-6">
                    <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-sm">
                      <img 
                        src={qrCodeUrl} 
                        alt="2FA QR Code" 
                        className="w-48 h-48 block"
                      />
                    </div>
                  </div>

                  {manualEntryKey && (
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <p className="font-medium text-gray-800 mb-2 text-sm">
                        Can't scan? Enter this key manually:
                      </p>
                      <div className="flex items-center gap-3 p-3 bg-white rounded border">
                        <code className="font-mono text-sm flex-1 text-gray-800 break-all">
                          {manualEntryKey}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-gray-100"
                          onClick={() => {
                            navigator.clipboard.writeText(manualEntryKey);
                            toast({
                              title: "Copied!",
                              description: "Manual entry key copied to clipboard",
                            });
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-400">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-green-900 mb-1">Enter Verification Code</p>
                      <p className="text-green-700 text-sm">
                        Type the 6-digit code from your authenticator app
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Verification Code
                  </Label>
                  <Input
                    type="text"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="text-center text-xl tracking-[0.5em] font-mono h-12 border-2 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 text-center">
                    Enter the 6-digit code that appears in your Google Authenticator app
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={closeSetupModal}
                  disabled={isLoading2FA}
                  className="flex-1 h-11"
                >
                  Cancel
                </Button>
                <Button
                  onClick={verify2FASetup}
                  disabled={isLoading2FA || verificationCode.length !== 6}
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading2FA ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      Verify & Enable
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Key className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-green-600 mb-2">
                  2FA Successfully Enabled!
                </h3>
                <p className="text-slate-600">
                  Two-factor authentication is now protecting your account
                </p>
              </div>

              {backupCodes.length > 0 && (
                <div className="space-y-4">
                  <div className="border-t pt-6">
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-4">
                      <div className="flex items-start gap-3">
                        <Download className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-amber-800 mb-1">
                            Important: Save Your Backup Codes
                          </h4>
                          <p className="text-sm text-amber-700">
                            Store these codes in a safe place. Use them to access your account if you lose your phone.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <div className="grid grid-cols-2 gap-2">
                        {backupCodes.map((code, index) => (
                          <div key={index} className="bg-white p-2 rounded border text-center">
                            <code className="font-mono text-sm text-gray-800">
                              {code}
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      className="w-full mt-3 h-10"
                      onClick={() => {
                        const codesText = backupCodes.join('\n');
                        navigator.clipboard.writeText(codesText);
                        toast({
                          title: "Copied!",
                          description: "Backup codes copied to clipboard",
                        });
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy All Backup Codes
                    </Button>
                  </div>
                </div>
              )}

              <Button
                onClick={closeSetupModal}
                className="w-full h-11 bg-green-600 hover:bg-green-700"
              >
                <Key className="h-4 w-4 mr-2" />
                Complete Setup
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}