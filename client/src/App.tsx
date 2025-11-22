import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import Dashboard from "@/pages/Dashboard";
import CompanyDashboard from "@/pages/CompanyDashboard";
import ManagerDashboard from "@/pages/ManagerDashboard";
import UserManagement from "@/pages/UserManagement";
import StoreManagement from "@/pages/StoreManagement";
import ManagerManagement from "@/pages/ManagerManagement";
import CompanyManagement from "@/pages/CompanyManagement";
import Analytics from "@/pages/Analytics";
import DynamicSettings from "@/pages/DynamicSettings";
import POS from "@/pages/manager/POS";
import Products from "@/pages/manager/Products";
import Inventory from "@/pages/manager/Inventory";
import SalesHistory from "@/pages/manager/SalesHistory";
import Login from "@/pages/Login";
import AuthLanding from "@/pages/AuthLanding";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import CompanyActivation from "@/pages/CompanyActivation";
import CompleteProfile from "@/pages/CompleteProfile";
import NotFound from "@/pages/not-found";
import AuditLogs from "@/pages/AuditLogs";
import CompanyProducts from "@/pages/CompanyProducts";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  // Auto-redirect managers to Manager Dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role === 'manager' && window.location.pathname === '/') {
      setLocation('/manager');
    }
  }, [isAuthenticated, user, setLocation]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated || !user) {
    return (
      <Switch>
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/company-activation" component={CompanyActivation} />
        <Route path="/complete-profile" component={CompleteProfile} />
        <Route path="/login" component={Login} />
        <Route component={AuthLanding} />
      </Switch>
    );
  }

  // Determine which dashboard to show based on user role
  const getDashboardComponent = () => {
    if (user?.role === 'super_admin') {
      return <Dashboard />;
    } else if (user?.role === 'company_admin' || user?.role === 'store_owner') {
      return <CompanyDashboard />;
    } else if (user?.role === 'manager') {
      // Managers are automatically redirected to /manager via useEffect above
      // This fallback is for edge cases
      return <ManagerDashboard />;
    } else {
      return <Dashboard />;
    }
  };

  return (
    <Switch>
      {/* Protected Dashboard Routes */}
      <Route path="/">
        <MainLayout>
          {getDashboardComponent()}
        </MainLayout>
      </Route>
      
      <Route path="/manager">
        <ProtectedRoute requiredRoles={["manager", "super_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <ManagerDashboard />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/manager/pos">
        <ProtectedRoute requiredRoles={["manager", "super_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <POS />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/manager/products">
        <ProtectedRoute requiredRoles={["manager", "super_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <Products />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/manager/inventory">
        <ProtectedRoute requiredRoles={["manager", "super_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <Inventory />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/manager/sales-history">
        <ProtectedRoute requiredRoles={["manager", "super_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <SalesHistory />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/users">
        <ProtectedRoute requiredRoles={["super_admin"]}>
          <MainLayout>
            <UserManagement />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/companies">
        <ProtectedRoute requiredRoles={["super_admin"]}>
          <MainLayout>
            <CompanyManagement />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/stores">
        <ProtectedRoute requiredRoles={["super_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <StoreManagement />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/managers">
        <ProtectedRoute requiredRoles={["super_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <ManagerManagement />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/analytics">
        <ProtectedRoute requiredRoles={["super_admin", "store_owner", "company_admin", "manager"]}>
          <MainLayout>
            <Analytics />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/company-products">
        <ProtectedRoute requiredRoles={["company_admin", "store_owner"]}>
          <MainLayout>
            <CompanyProducts />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings">
        <ProtectedRoute requiredRoles={["super_admin", "store_owner", "company_admin", "manager"]}>
          <MainLayout>
            <DynamicSettings />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/audit-logs">
        <ProtectedRoute requiredRoles={["super_admin", "company_admin", "store_owner"]}>
          <MainLayout>
            <AuditLogs />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/pos/:storeSlug">
        <ProtectedRoute requiredRoles={["super_admin", "store_owner", "company_admin", "manager"]}>
          <POS />
        </ProtectedRoute>
      </Route>
      
      {/* Company activation can be accessed by anyone */}
      <Route path="/company-activation" component={CompanyActivation} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
