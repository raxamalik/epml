import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Lock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CompanyData {
  id: number;
  name: string;
  email: string;
  registrationNumber: string;
  vatNumber: string;
  address: string;
  phone: string;
  contactPerson: string;
}

interface InvitationData {
  token: string;
  expiresAt: string;
}

export default function CompanyActivation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
    address: "",
    phone: "",
    contactPerson: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get token from URL
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  useEffect(() => {
    if (!token) {
      toast({
        title: "Invalid Link",
        description: "No activation token found in the URL.",
        variant: "destructive",
      });
      setLocation('/');
      return;
    }

    validateInvitation();
  }, [token]);

  const validateInvitation = async () => {
    try {
      setLoading(true);
      const response = await apiRequest("GET", `/api/company-invitation/${token}`);
      const data = await response.json();
      
      setCompany(data.company);
      setInvitation(data.invitation);
      
      // Pre-fill form with existing company data
      setFormData(prev => ({
        ...prev,
        address: data.company.address || "",
        phone: data.company.phone || "",
        contactPerson: data.company.contactPerson || "",
      }));
      
      setLoading(false);
    } catch (error) {
      console.error("Error validating invitation:", error);
      toast({
        title: "Invalid Invitation",
        description: "This invitation link is invalid, expired, or has already been used.",
        variant: "destructive",
      });
      setLocation('/');
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.password) {
        newErrors.password = "Password is required";
      } else if (formData.password.length < 8) {
        newErrors.password = "Password must be at least 8 characters long";
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    if (step === 2) {
      if (!formData.address) {
        newErrors.address = "Business address is required";
      }
      if (!formData.phone) {
        newErrors.phone = "Phone number is required";
      }
      if (!formData.contactPerson) {
        newErrors.contactPerson = "Contact person is required";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      setStep(2);
    }
  };

  const handleBack = () => {
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      
      await apiRequest("POST", `/api/company-activation/${token}`, {
        password: formData.password,
        businessInfo: {
          address: formData.address,
          phone: formData.phone,
          contactPerson: formData.contactPerson,
        }
      });

      setStep(3); // Success step
      
      toast({
        title: "Account Activated!",
        description: "Your company account has been successfully activated. You can now login.",
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        setLocation('/login');
      }, 3000);

    } catch (error) {
      console.error("Error activating account:", error);
      toast({
        title: "Activation Failed",
        description: "Failed to activate your account. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Validating invitation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to EPML</h1>
          <p className="text-gray-600">Activate your company account</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              1
            </div>
            <div className={`h-1 w-16 ${step >= 2 ? 'bg-blue-500' : 'bg-gray-200'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
            <div className={`h-1 w-16 ${step >= 3 ? 'bg-blue-500' : 'bg-gray-200'}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 3 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">
              {step === 1 && "Set Up Your Password"}
              {step === 2 && "Business Information"}
              {step === 3 && "Account Activated!"}
            </CardTitle>
            {company && step < 3 && (
              <p className="text-sm text-gray-600 mt-2">
                Setting up account for <strong>{company.name}</strong>
              </p>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className={errors.password ? "border-red-500" : ""}
                      placeholder="Create a secure password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-500 mt-1">{errors.password}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Password must be at least 8 characters long
                  </p>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    className={errors.confirmPassword ? "border-red-500" : ""}
                    placeholder="Confirm your password"
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button 
                  onClick={handleNext} 
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  disabled={!formData.password || !formData.confirmPassword}
                >
                  Continue
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="address">Business Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className={errors.address ? "border-red-500" : ""}
                    placeholder="Enter your complete business address"
                    rows={3}
                  />
                  {errors.address && (
                    <p className="text-sm text-red-500 mt-1">{errors.address}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={errors.phone ? "border-red-500" : ""}
                    placeholder="Business phone number"
                  />
                  {errors.phone && (
                    <p className="text-sm text-red-500 mt-1">{errors.phone}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                    className={errors.contactPerson ? "border-red-500" : ""}
                    placeholder="Primary contact person name"
                  />
                  {errors.contactPerson && (
                    <p className="text-sm text-red-500 mt-1">{errors.contactPerson}</p>
                  )}
                </div>

                <div className="flex space-x-3">
                  <Button 
                    variant="outline" 
                    onClick={handleBack}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    {submitting ? "Activating..." : "Activate Account"}
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Account Activated!</h3>
                <p className="text-gray-600">
                  Your company account has been successfully activated. 
                  You will be redirected to the login page shortly.
                </p>
                <Button 
                  onClick={() => setLocation('/login')}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  Go to Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Info Display */}
        {company && step < 3 && (
          <Card className="mt-6 bg-gray-50 border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-700">Company Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Registration:</span>
                  <p className="font-medium">{company.registrationNumber}</p>
                </div>
                <div>
                  <span className="text-gray-500">VAT:</span>
                  <p className="font-medium">{company.vatNumber}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Email:</span>
                  <p className="font-medium">{company.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}