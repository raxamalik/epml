# EPML - Enterprise Platform Management System

## Overview

This is an Enterprise Platform Management system (EPML) built as a full-stack web application for managing stores, users, and analytics. The application provides role-based access control with three user types: super_admin, store_owner, manager, and company_admin. It supports both direct user management and multi-tenant company management.

## System Architecture

The application follows a full-stack architecture with clear separation between frontend, backend, and database layers:

- **Frontend**: React SPA with TypeScript using Vite as the build tool
- **Backend**: Express.js REST API server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for schema management
- **Authentication**: Token-based authentication with session management
- **Deployment**: Configured for production deployment with build scripts

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with hot module replacement for development
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: Radix UI primitives with Tailwind CSS styling
- **Component Library**: Shadcn/ui components for consistent design system
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Server**: Express.js with TypeScript for type safety
- **Database Access**: Drizzle ORM with Neon PostgreSQL driver
- **Authentication**: Multiple auth strategies including token-based and session-based
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple
- **API Design**: RESTful endpoints with role-based authorization middleware
- **Password Security**: Bcrypt for password hashing

### Database Schema
- **Users Table**: Stores user profiles with role-based access (super_admin, store_owner, manager)
- **Companies Table**: Multi-tenant company management with registration details
- **Stores Table**: Store management with owner/company relationships
- **Activities Table**: Audit trail for system activities and user actions
- **Sessions Table**: Required for authentication session persistence

### Role-Based Access Control
- **Super Admin**: Full system access including user and company management
- **Company Admin**: Can manage their company's stores and employees
- **Store Owner**: Can manage assigned stores and view analytics
- **Manager**: Limited access to dashboard and assigned store data

## Data Flow

1. **Authentication Flow**: Users login via email/password, system validates credentials and creates session/token
2. **Role-Based Routing**: Frontend checks user roles to determine accessible routes and features
3. **API Authorization**: Backend middleware validates requests based on user roles
4. **Data Fetching**: TanStack Query manages server state with automatic caching and refetching
5. **Real-time Updates**: Optimistic updates with query invalidation for immediate UI feedback

## External Dependencies

- **Database**: Neon PostgreSQL for cloud database hosting
- **UI Library**: Radix UI for accessible component primitives
- **Styling**: Tailwind CSS for utility-first styling
- **Charts**: Recharts for data visualization components
- **Date Handling**: date-fns for date formatting and manipulation
- **Validation**: Zod for runtime type validation

## Deployment Strategy

- **Development**: `npm run dev` starts both frontend and backend in development mode
- **Build**: `npm run build` creates production builds for both client and server
- **Production**: `npm start` runs the production server serving static files
- **Database**: Drizzle Kit handles schema migrations with `npm run db:push`

## Changelog

- July 04, 2025: Initial setup
- July 04, 2025: Fixed Manager Dashboard price formatting issues and completed product management functionality. Added working POS system with cart, payment processing, and sales tracking. All navigation tabs (Analytics, POS, Products, Inventory, Sales History) now fully functional.
- July 25, 2025: Implemented complete forgot password functionality with AWS SES email integration. Added password reset system supporting both user and company accounts. Created forgot password and reset password pages with proper token validation and security measures.
- July 25, 2025: Fixed critical security bug where company users could see all stores instead of just their own. Updated store filtering logic to properly check both user.type === 'company' and user.role === 'company_admin' for data access control.
- July 25, 2025: Created comprehensive dynamic settings system that adapts to all user roles. Added profile image upload functionality with file validation, preview, and base64 storage. Settings tabs automatically adjust based on user type (individual vs company) and role permissions. Implemented ProfileAvatar component that displays user profile images throughout the application with automatic fallbacks and localStorage integration.
- July 25, 2025: Successfully implemented complete Two-Factor Authentication system using Google Authenticator integration. Added QR code generation, TOTP token verification, backup codes, and 2FA management interface in Security settings. Fixed authentication system bug where password hashes were corrupted in database - regenerated proper bcrypt hashes for company accounts. Login system now fully functional for both user and company accounts.
- July 25, 2025: Integrated 2FA verification into login flow. Login now requires 2FA token when user has 2FA enabled. Created two-step login process: first validates credentials, then prompts for 2FA token with dedicated UI. Updated frontend Login component with conditional 2FA input form and backend authentication to verify TOTP tokens during login.
- July 25, 2025: Fixed critical 2FA authentication issues: Updated service name to "Enterprise Platform Management" for clear authenticator app identification, fixed database storage for 2FA secrets, re-enabled proper 2FA verification in login flow, and resolved database column mapping issues (camelCase vs snake_case). 2FA system now fully functional with proper setup, storage, and login verification.
- July 25, 2025: Fixed 2FA setup modal design and layout issues. Enhanced the popup with improved visual hierarchy, better spacing, step-by-step guidance with colored indicators, larger QR code display area, improved backup codes grid layout, and more professional styling. Modal now provides clear visual feedback and better user experience for 2FA setup process.
- January 02, 2025: Migrated email service from AWS SES to SendGrid for improved reliability and easier configuration. Updated email service configuration to use SendGrid API key and noreply@epml.cz as sender address. All password reset and system emails now use SendGrid for delivery.
- August 10, 2025: Successfully implemented and tested complete company invitation system. Added company_invitations database table, comprehensive API endpoints for invitation flow, modern CompanyActivation page with 3-step onboarding process, and integrated professional email templates. System tested end-to-end with working email delivery and token-based activation. Super admins can now invite companies from Company Management page, companies receive professional invitation emails, and can complete guided account activation with business information setup.
- August 10, 2025: Fixed company creation workflow to automatically send invitation emails. Integrated invitation system directly into company creation process - when super admin creates a company, invitation email with activation link is automatically sent. Added proper error handling for database unique constraint violations with specific user-friendly messages for duplicate registration numbers and email addresses.

## User Preferences

Preferred communication style: Simple, everyday language.