# README.md

## Overview

This is an Enterprise Platform Management system (EPML) built as a full-stack web application for managing stores, users, and analytics. The application provides role-based access control with three user types: super admins, store owners, and managers. It uses a modern React frontend with a Node.js/Express backend, PostgreSQL database, and implements standalone authentication for security.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The application follows a full-stack architecture with clear separation between frontend, backend, and database layers:

- **Frontend**: React SPA with TypeScript using Vite as the build tool
- **Backend**: Express.js REST API server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for schema management
- **Authentication**: Standalone authentication with session management
- **Deployment**: Configured for production deployment

## Key Components

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with hot module replacement
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state
- **UI Components**: Radix UI primitives with Tailwind CSS styling
- **Component Library**: Shadcn/ui components for consistent design

### Backend Architecture
- **Server**: Express.js with TypeScript
- **Database Access**: Drizzle ORM with Neon PostgreSQL driver
- **Authentication**: OpenID Connect (OIDC) with Passport.js
- **Session Management**: PostgreSQL-backed sessions using connect-pg-simple
- **API Design**: RESTful endpoints with role-based authorization

### Database Schema
- **Users Table**: Stores user profiles with role-based access (super_admin, store_owner, manager)
- **Stores Table**: Store management with owner relationships
- **Activities Table**: Audit trail for system activities
- **Sessions Table**: Required for authentication session management

### Role-Based Access Control
- **Super Admin**: Full system access including user management
- **Store Owner**: Can manage stores and view analytics
- **Manager**: Limited access to dashboard and assigned store data

## Data Flow

1. **Authentication Flow**: Users authenticate via standalone auth system, creating sessions stored in PostgreSQL
2. **Authorization**: Role-based middleware checks user permissions for protected routes
3. **API Communication**: Frontend uses TanStack Query for server state management
4. **Database Operations**: Drizzle ORM handles type-safe database queries
5. **Real-time Updates**: Optimistic updates with query invalidation for data consistency

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL connection via Neon
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **@radix-ui/***: Headless UI components
- **passport**: Authentication middleware
- **express-session**: Session management

### Development Tools
- **Vite**: Frontend build tool with HMR
- **TypeScript**: Type safety across the stack
- **Tailwind CSS**: Utility-first styling
- **ESBuild**: Backend bundling for production

## Deployment Strategy

### Development Environment
- Uses Vite dev server for frontend with proxy to Express backend
- Hot module replacement for rapid development
- TypeScript compilation with strict mode enabled

### Production Build
- Frontend built to static assets served by Express
- Backend bundled with ESBuild for Node.js deployment
- Environment variables for database and session configuration

### Production Configuration
- Scalable deployment target for production scaling
- PostgreSQL database configuration
- Session secret and database URL managed via environment variables

### Key Architectural Decisions

1. **Monorepo Structure**: Single repository with shared types between frontend and backend for type safety
2. **Drizzle ORM**: Chosen for type safety and PostgreSQL compatibility over heavier ORMs
3. **Standalone Auth**: Custom authentication solution that handles user login flow and session management
4. **Role-Based Authorization**: Implemented at both route and UI levels for security
5. **TanStack Query**: Provides caching, synchronization, and optimistic updates for better UX
6. **Radix UI + Tailwind**: Combination provides accessible components with flexible styling# epml
