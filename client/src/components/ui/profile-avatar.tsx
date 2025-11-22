import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface ProfileAvatarProps {
  user?: {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
  };
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showBorder?: boolean;
}

export function ProfileAvatar({ 
  user, 
  size = "md", 
  className = "", 
  showBorder = false 
}: ProfileAvatarProps) {
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  // Get profile image from localStorage settings if not provided in user
  useEffect(() => {
    if (user?.profileImageUrl) {
      setProfileImageUrl(user.profileImageUrl);
    } else {
      // Check localStorage for saved profile image
      const savedSettings = localStorage.getItem('userSettings');
      if (savedSettings) {
        try {
          const settings = JSON.parse(savedSettings);
          if (settings.profileImageUrl) {
            setProfileImageUrl(settings.profileImageUrl);
          }
        } catch (error) {
          console.warn('Failed to parse user settings:', error);
        }
      }
    }
  }, [user?.profileImageUrl]);

  // Size classes
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8", 
    lg: "h-10 w-10",
    xl: "h-12 w-12"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5", 
    xl: "h-6 w-6"
  };

  // Generate initials from name or email
  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    } else if (user?.firstName) {
      return user.firstName.charAt(0).toUpperCase();
    } else if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  // Generate avatar URL as fallback
  const getAvatarUrl = () => {
    const initials = getInitials();
    const name = encodeURIComponent(user?.firstName || user?.email || 'User');
    return `https://ui-avatars.com/api/?name=${name}&background=3b82f6&color=fff&size=128&font-size=0.5`;
  };

  const borderClass = showBorder ? "ring-2 ring-white shadow-sm" : "";

  return (
    <Avatar className={`${sizeClasses[size]} ${borderClass} ${className}`}>
      <AvatarImage
        src={profileImageUrl || getAvatarUrl()}
        alt={`${user?.firstName || user?.email || 'User'} profile`}
        onError={(e) => {
          // If image fails to load, fallback to generated avatar
          const target = e.target as HTMLImageElement;
          if (target.src !== getAvatarUrl()) {
            target.src = getAvatarUrl();
          }
        }}
      />
      <AvatarFallback className="bg-primary text-primary-foreground font-medium">
        {profileImageUrl ? (
          <User className={iconSizes[size]} />
        ) : (
          getInitials()
        )}
      </AvatarFallback>
    </Avatar>
  );
}