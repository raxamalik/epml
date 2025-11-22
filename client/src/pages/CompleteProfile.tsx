import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building2, User, Phone, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const profileSchema = z.object({
  contactPerson: z.string().min(2, "Contact person name is required"),
  phone: z.string().min(9, "Valid phone number is required"),
  address: z.string().min(5, "Full address is required"),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function CompleteProfile() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companyData, setCompanyData] = useState<{
    profileToken: string;
    email: string;
    companyName: string;
  } | null>(null);

  useEffect(() => {
    // Get secure profile token from localStorage (set during login)
    const storedData = localStorage.getItem('pendingProfileCompletion');
    if (!storedData) {
      // No pending profile completion, redirect to login
      setLocation('/login');
      return;
    }

    try {
      const data = JSON.parse(storedData);
      if (!data.profileToken) {
        // Invalid data, redirect to login
        setLocation('/login');
        return;
      }
      setCompanyData(data);
    } catch (error) {
      console.error('Failed to parse profile completion data:', error);
      setLocation('/login');
    }
  }, [setLocation]);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      contactPerson: "",
      phone: "",
      address: "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    if (!companyData) {
      toast({
        title: "Error",
        description: "Company data not found. Please try logging in again.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiRequest("POST", "/api/auth/complete-profile", {
        profileToken: companyData.profileToken,
        contactPerson: data.contactPerson,
        phone: data.phone,
        address: data.address,
      });

      const result = await response.json();

      // Clear pending profile completion data
      localStorage.removeItem('pendingProfileCompletion');

      toast({
        title: "Profile Completed!",
        description: "Your company profile has been successfully completed. Redirecting to dashboard...",
      });

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete profile. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  if (!companyData) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl border-0">
        <CardHeader className="space-y-3 pb-6">
          <div className="flex items-center justify-center">
            <div className="bg-primary rounded-full p-4">
              <Building2 className="h-12 w-12 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-center text-slate-900">
            Complete Your Profile
          </CardTitle>
          <CardDescription className="text-center text-base">
            Welcome <span className="font-semibold text-slate-700">{companyData.companyName}</span>! 
            <br />
            Please provide some additional information to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-600" />
                      Contact Person Full Name *
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="John Doe"
                        className="h-12 text-base"
                        data-testid="input-contact-person"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-600" />
                      Phone Number *
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="+420 123 456 789"
                        type="tel"
                        className="h-12 text-base"
                        data-testid="input-phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-600" />
                      Full Business Address *
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Street, City, Postal Code, Country"
                        className="min-h-[100px] text-base resize-none"
                        data-testid="input-address"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold"
                  disabled={isSubmitting}
                  data-testid="button-complete-profile"
                >
                  {isSubmitting ? "Completing Profile..." : "Complete Profile & Continue"}
                </Button>
              </div>
            </form>
          </Form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-slate-700">
              <strong>Note:</strong> Once you complete your profile, your company account will be activated 
              and you'll have full access to the platform.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
