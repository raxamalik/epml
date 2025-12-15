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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  Download,
  AlertTriangle,
  Eye,
  EyeOff,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useTranslation } from "@/hooks/useTranslation";

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
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // 2FA States
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [is2FASetupModalOpen, setIs2FASetupModalOpen] = useState(false);
  const [is2FADisableModalOpen, setIs2FADisableModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [manualEntryKey, setManualEntryKey] = useState<string | null>(null);
  const [twoFactorSecret, setTwoFactorSecret] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isLoading2FA, setIsLoading2FA] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisablePassword, setShowDisablePassword] = useState(false);

  // Get current user info
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Check 2FA status from user data and localStorage
  useEffect(() => {
    if (user && (user as any).twoFactorEnabled !== undefined) {
      setIs2FAEnabled((user as any).twoFactorEnabled || false);
    } else {
      // Fallback to localStorage
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
    }
  }, [user]);

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
    } catch (error: any) {
      toast({
        title: t("settings.toasts.error"),
        description: error.message || t("errors.generic"),
        variant: "destructive",
      });
    } finally {
      setIsLoading2FA(false);
    }
  };

  const verify2FASetup = async () => {
    if (!twoFactorSecret || !verificationCode) {
      toast({
        title: t("settings.toasts.error"),
        description: t("settings.toasts.secretTokenRequired"),
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
        
        // Refresh user data
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        
        toast({
          title: t("settings.toasts.verifySuccess"),
          description: data.message || t("settings.toasts.verifySuccess"),
        });
      }
    } catch (error: any) {
      toast({
        title: t("settings.toasts.verifyError"),
        description: error.message || t("errors.generic"),
        variant: "destructive",
      });
    } finally {
      setIsLoading2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!disablePassword) {
      toast({
        title: t("settings.toasts.error"),
        description: t("settings.toasts.passwordRequired"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading2FA(true);
    try {
      const response = await apiRequest("POST", "/api/2fa/disable", {
        password: disablePassword,
      });
      const data = await response.json();

      if (data.success) {
      // Remove from localStorage
      localStorage.removeItem('user2FA');
      
      setIs2FAEnabled(false);
      setTwoFactorSecret(null);
        setIs2FADisableModalOpen(false);
      setIs2FASetupModalOpen(false);
      setIsSetupComplete(false);
      setBackupCodes([]);
      setVerificationCode("");
        setDisablePassword("");
        
        // Refresh user data
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: t("settings.toasts.disableSuccess"),
          description: data.message || t("settings.toasts.disableSuccess"),
      });
      }
    } catch (error: any) {
      toast({
        title: t("settings.toasts.disableError"),
        description: error.message || t("errors.generic"),
        variant: "destructive",
      });
    } finally {
      setIsLoading2FA(false);
    }
  };

  const closeDisableModal = () => {
    setIs2FADisableModalOpen(false);
    setDisablePassword("");
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

  // Get settings from backend
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/settings");
        const data = await response.json();
        
        // Ensure loginAuditTrail is always true for security compliance
        if (data) {
          data.loginAuditTrail = true;
      }
        
        return data || {
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
      } catch (error: any) {
        console.error("Error fetching settings:", error);
        // Return defaults on error
        return {
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
      }
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

  // Update form when settings are loaded, merging with user data for profile fields
  useEffect(() => {
    if (settings || user) {
      const userData = user as any;
      const mergedData = {
        ...settings,
        // Prefill profile fields from user object if not in settings
        firstName: settings?.firstName || userData?.firstName || "",
        lastName: settings?.lastName || userData?.lastName || "",
        phone: settings?.phone || userData?.phone || "",
        profileImageUrl: settings?.profileImageUrl || userData?.profileImageUrl || "",
      };
      form.reset(mergedData);
    }
  }, [settings, user, form]);

  // Determine user type from the user data and set profile image preview
  useEffect(() => {
    if (user) {
      const userData = user as any;
      setUserInfo({
        id: userData.id,
        email: userData.email,
        role: userData.role || 'manager',
        type: userData.type || 'user',
        companyId: userData.companyId,
      });
      
      // Set profile image preview if user has profileImageUrl
      if (userData.profileImageUrl && !profileImagePreview) {
        setProfileImagePreview(userData.profileImageUrl);
      }
    }
  }, [user]);

  // Settings mutation - save to backend
  const settingsMutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      // Force loginAuditTrail to always be true for security compliance
      const safeData = {
        ...data,
        loginAuditTrail: true,
      };
      
      // Save to backend
      const response = await apiRequest("PUT", "/api/settings", safeData);
      const result = await response.json();
      return result;
    },
    onSuccess: () => {
      toast({
        title: t("settings.toasts.updated"),
        description: t("settings.toasts.updatedDesc"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      // Invalidate user query to refresh profile image in header
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || t("errors.generic");
      toast({
        title: t("settings.toasts.error"),
        description: errorMessage,
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
        title: t("settings.invalidFile"),
        description: t("settings.invalidFileDesc"),
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("settings.fileTooLarge"),
        description: t("settings.fileTooLargeDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);

    try {
      // Create a preview URL for immediate display
      const previewUrl = URL.createObjectURL(file);
      setProfileImagePreview(previewUrl);

      // Upload file to backend
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetchWithAuth('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.message || errorData.error || 'Upload failed');
      }

      const data = await response.json();
      const imageUrl = data.imageUrl;

      // Set the image URL in the form (this will be saved when user clicks Save Settings)
      form.setValue('profileImageUrl', imageUrl);
      
        toast({
          title: t("settings.imageUploaded"),
        description: t("settings.imageUploadedDesc"),
        });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: t("settings.uploadFailed"),
        description: error.message || t("errors.generic"),
        variant: "destructive",
      });
      // Reset preview on error
      setProfileImagePreview(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const removeProfileImage = () => {
    form.setValue('profileImageUrl', '');
    setProfileImagePreview(null);
    toast({
      title: t("settings.imageRemoved"),
      description: t("settings.imageRemovedDesc"),
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
      tabs.push({ id: 'profile', label: t("settings.tabs.profile"), icon: User });
    }
    
    // Company info tab only for companies
    if (userInfo.type === 'company') {
      tabs.push({ id: 'company', label: t("settings.tabs.companyInfo"), icon: Building });
    }
    
    // Regional settings for everyone
    tabs.push({ id: 'regional', label: t("settings.tabs.regional"), icon: Globe });
    
    // Notifications for everyone
    tabs.push({ id: 'notifications', label: t("settings.tabs.notifications"), icon: Bell });
    
    // Security settings for everyone
    tabs.push({ id: 'security', label: t("settings.tabs.security"), icon: Shield });
    
    // System settings only for admins and company admins
    if (userInfo.role === 'super_admin' || userInfo.role === 'portal_admin' || userInfo.role === 'company_admin') {
      tabs.push({ id: 'system', label: t("settings.tabs.system"), icon: Database });
    }
    
    return tabs;
  };

  const availableTabs = getAvailableTabs();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("settings.title")}</h1>
        <p className="text-slate-600 mt-2">
          {userInfo.type === 'company' ? 
            t("settings.companyDescription") : 
            t("settings.personalDescription")
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
                      {t("settings.personalInformation")}
                    </CardTitle>
                    <CardDescription>
                      {t("settings.personalInformationDesc")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("settings.firstName")}</FormLabel>
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
                            <FormLabel>{t("settings.lastName")}</FormLabel>
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
                          <FormLabel>{t("settings.phoneNumber")}</FormLabel>
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
                          <FormLabel>{t("settings.profileImage")}</FormLabel>
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
                                    {isUploadingImage ? t("settings.uploading") : t("settings.uploadImage")}
                                  </div>
                                </label>
                                <p className="text-xs text-gray-500">
                                  {t("settings.imageFormatHint")}
                                </p>
                              </div>
                            </div>

                            {/* Alternative URL Input */}
                            <div>
                              <FormLabel className="text-sm text-gray-600">{t("settings.orEnterImageUrl")}</FormLabel>
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
                      {t("settings.companyInformation")}
                    </CardTitle>
                    <CardDescription>
                      {t("settings.companyInformationDesc")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-blue-800">
                        {t("settings.companyAccountNote")}
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
                    {t("settings.regionalSettings")}
                  </CardTitle>
                  <CardDescription>
                    {t("settings.regionalSettingsDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("settings.timezone")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("settings.selectTimezone")} />
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
                        <FormLabel>{t("settings.currency")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("settings.selectCurrency")} />
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
                        <FormLabel>{t("settings.language")}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t("settings.selectLanguage")} />
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
                    {t("settings.notificationPreferences")}
                  </CardTitle>
                  <CardDescription>
                    {t("settings.notificationPreferencesDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="emailNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">{t("settings.emailNotifications")}</FormLabel>
                          <FormDescription>
                            {t("settings.emailNotificationsDesc")}
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
                          <FormLabel className="text-base">{t("settings.smsAlerts")}</FormLabel>
                          <FormDescription>
                            {t("settings.smsAlertsDesc")}
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
                          <FormLabel className="text-base">{t("settings.weeklyReports")}</FormLabel>
                          <FormDescription>
                            {t("settings.weeklyReportsDesc")}
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
                          <FormLabel className="text-base">{t("settings.storeAlerts")}</FormLabel>
                          <FormDescription>
                            {t("settings.storeAlertsDesc")}
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
                      {t("settings.passwordAuthentication")}
                    </CardTitle>
                    <CardDescription>
                      {t("settings.passwordAuthenticationDesc")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="sessionTimeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("settings.sessionTimeout")}</FormLabel>
                          <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("settings.selectTimeout")} />
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
                            <Label className="text-base font-medium">{t("settings.twoFactorAuth")}</Label>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {t("settings.twoFactorAuthDesc")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {is2FAEnabled ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-green-600">{t("settings.enabled")}</span>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setIs2FADisableModalOpen(true)}
                                disabled={isLoading2FA}
                              >
                                {isLoading2FA ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t("settings.disabling")}
                                  </>
                                ) : (
                                  t("settings.disable2FA")
                                )}
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              onClick={setup2FA}
                              disabled={isLoading2FA}
                              size="sm"
                            >
                              {isLoading2FA ? t("settings.settingUp") : t("settings.enable2FA")}
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {is2FAEnabled && (
                        <div className="text-sm text-muted-foreground pt-2 border-t">
                          <p>{t("settings.twoFactorActive")}</p>
                          <p>{t("settings.twoFactorActiveDesc")}</p>
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
                      {t("settings.passwordPolicy")}
                    </CardTitle>
                    <CardDescription>
                      {t("settings.passwordPolicyDesc")}
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
                              {t("settings.requireUppercase")}
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
                              {t("settings.requireNumbers")}
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
                              {t("settings.requireSymbols")}
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
            {(userInfo.role === 'super_admin' || userInfo.role === 'portal_admin' || userInfo.role === 'company_admin') && (
              <TabsContent value="system" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      {t("settings.systemSettings")}
                    </CardTitle>
                    <CardDescription>
                      {t("settings.systemSettingsDesc")}
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
                              {t("settings.loginAuditTrail")}
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                {t("settings.alwaysEnabled")}
                              </span>
                            </FormLabel>
                            <FormDescription>
                              {t("settings.loginAuditTrailDesc")}
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
                          <FormLabel>{t("settings.dataRetention")}</FormLabel>
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
                            {t("settings.dataRetentionDesc")}
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
              {settingsMutation.isPending ? t("settings.saving") : t("settings.saveSettings")}
            </Button>
          </div>
        </form>
      </Form>

      {/* 2FA Setup Modal */}
      <Dialog open={is2FASetupModalOpen} onOpenChange={setIs2FASetupModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-3 text-lg">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-blue-600" />
              </div>
              {t("settings.setup2FATitle")}
            </DialogTitle>
            <DialogDescription className="text-base text-slate-600 mt-2">
              {t("settings.setup2FADesc")}
            </DialogDescription>
          </DialogHeader>

          {!isSetupComplete ? (
            <div className="space-y-6">
              {qrCodeUrl && (
                <div className="space-y-4">
                  <div className="bg-amber-50 p-4 rounded-lg border-l-4 border-amber-400">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-900 mb-1">{t("settings.importantDeleteExisting")}</p>
                        <p className="text-amber-700 text-sm">
                          {t("settings.importantDeleteExistingDesc")}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        1
                      </div>
                      <div>
                        <p className="font-semibold text-blue-900 mb-1">{t("settings.scanQRCode")}</p>
                        <p className="text-blue-700 text-sm">
                          {t("settings.scanQRCodeDesc")}
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
                        {t("settings.cantScan")}
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
                              title: t("settings.copied"),
                              description: t("settings.manualKeyCopied"),
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
                      <p className="font-semibold text-green-900 mb-1">{t("settings.enterVerificationCode")}</p>
                      <p className="text-green-700 text-sm">
                        {t("settings.enterVerificationCodeDesc")}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    {t("settings.verificationCode")}
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
                    {t("settings.verificationCodeHint")}
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
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={verify2FASetup}
                  disabled={isLoading2FA || verificationCode.length !== 6}
                  className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading2FA ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      {t("settings.verifying")}
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      {t("settings.verifyEnable")}
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
                  {t("settings.twoFactorSuccessTitle")}
                </h3>
                <p className="text-slate-600">
                  {t("settings.twoFactorSuccessDesc")}
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
                            {t("settings.saveBackupCodes")}
                          </h4>
                          <p className="text-sm text-amber-700">
                            {t("settings.saveBackupCodesDesc")}
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
                          title: t("settings.copied"),
                          description: t("settings.backupCodesCopied"),
                        });
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      {t("settings.copyAllBackupCodes")}
                    </Button>
                  </div>
                </div>
              )}

              <Button
                onClick={closeSetupModal}
                className="w-full h-11 bg-green-600 hover:bg-green-700"
              >
                <Key className="h-4 w-4 mr-2" />
                {t("settings.completeSetup")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 2FA Disable Modal */}
      <Dialog open={is2FADisableModalOpen} onOpenChange={setIs2FADisableModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {t("settings.disable2FATitle")}
            </DialogTitle>
            <DialogDescription className="text-base text-slate-600 mt-2">
              {t("settings.disable2FADesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>{t("settings.warning")}</strong> {t("settings.disable2FAWarning")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="disable-password">{t("settings.enterPassword")}</Label>
              <div className="relative">
                <Input
                  id="disable-password"
                  type={showDisablePassword ? "text" : "password"}
                  placeholder={t("settings.enterPasswordPlaceholder")}
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowDisablePassword(!showDisablePassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showDisablePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDisableModal}>
              {t("common.cancel")}
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDisable2FA}
              disabled={!disablePassword || isLoading2FA}
            >
              {isLoading2FA ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("settings.disabling")}
                </>
              ) : (
                t("settings.disable2FA")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}