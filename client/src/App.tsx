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
import PortalAdminManagement from "@/pages/PortalAdminManagement";
import StoreManagement from "@/pages/StoreManagement";
import StoreOwnerStoreDetail from "@/pages/StoreOwnerStoreDetail";
import StoreOwnerManagers from "@/pages/StoreOwnerManagers";
import StoreOwnerDashboard from "@/pages/StoreOwnerDashboard";
import BranchManagement from "@/pages/BranchManagement";
import ManagerManagement from "@/pages/ManagerManagement";
import CompanyManagement from "@/pages/CompanyManagement";
import CompanyDetails from "@/pages/CompanyDetails";
import BranchDetails from "@/pages/BranchDetails";
import Analytics from "@/pages/Analytics";
import DynamicSettings from "@/pages/DynamicSettings";
import POS from "@/pages/manager/POS";
import Products from "@/pages/manager/Products";
import ProductFormPage from "@/pages/manager/ProductFormPage";
import ProductDetail from "@/pages/manager/ProductDetail";
import Inventory from "@/pages/Inventory";
import SalesHistory from "@/pages/manager/SalesHistory";
import ReturnsHistory from "@/pages/manager/ReturnsHistory";
import StockTransactionsHistory from "@/pages/manager/StockTransactionsHistory";
import Login from "@/pages/Login";
import AuthLanding from "@/pages/AuthLanding";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import CompanyActivation from "@/pages/CompanyActivation";
import CompleteProfile from "@/pages/CompleteProfile";
import NotFound from "@/pages/not-found";
import AuditLogs from "@/pages/AuditLogs";
import CompanyProducts from "@/pages/CompanyProducts";
import CategoryManagement from "@/pages/CategoryManagement";
import ActiveSubstances from "@/pages/ActiveSubstances";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  // Auto-redirect managers to Manager Dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role === 'manager' && window.location.pathname === '/') {
      setLocation('/manager');
    }
  }, [isAuthenticated, user, setLocation]);

  // Auto-redirect store owners to their store detail page
  useEffect(() => {
    if (isAuthenticated && user?.role === 'store_owner' && window.location.pathname === '/stores') {
      setLocation('/store-owner/store');
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
    if (user?.role === 'super_admin' || user?.role === 'portal_admin') {
      return <Dashboard />;
    } else if (user?.role === 'company_admin') {
      return <CompanyDashboard />;
    } else if (user?.role === 'store_owner') {
      return <StoreOwnerDashboard />;
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
        <ProtectedRoute requiredRoles={["manager"]}>
          <MainLayout>
            <POS />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/products">
        <ProtectedRoute requiredRoles={["store_owner", "company_admin"]}>
          <MainLayout>
            <Products />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/products/create">
        <ProtectedRoute requiredRoles={["store_owner", "company_admin"]}>
          <MainLayout>
            <ProductFormPage />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/products/edit/:id">
        <ProtectedRoute requiredRoles={["store_owner", "company_admin"]}>
          <MainLayout>
            <ProductFormPage />
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/products/:id">
        <ProtectedRoute requiredRoles={["store_owner", "company_admin"]}>
          <MainLayout>
            <ProductDetail />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/inventory">
        <ProtectedRoute requiredRoles={["manager", "store_owner", "company_admin"]}>
          <MainLayout>
            <Inventory />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/sales-history">
        <ProtectedRoute requiredRoles={["manager", "super_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <SalesHistory />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/returns-history">
        <ProtectedRoute requiredRoles={["manager", "super_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <ReturnsHistory />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/stock-transactions">
        <ProtectedRoute requiredRoles={["manager", "super_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <StockTransactionsHistory />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/users">
        <ProtectedRoute requiredRoles={["super_admin", "portal_admin"]}>
          <MainLayout>
            <UserManagement />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/portal-admins">
        <ProtectedRoute requiredRoles={["super_admin"]}>
          <MainLayout>
            <PortalAdminManagement />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/companies">
        <ProtectedRoute requiredRoles={["super_admin", "portal_admin"]}>
          <MainLayout>
            <CompanyManagement />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/companies/:id">
        <ProtectedRoute requiredRoles={["super_admin", "portal_admin"]}>
          <MainLayout>
            <CompanyDetails />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/stores">
        <ProtectedRoute requiredRoles={["company_admin"]}>
          <MainLayout>
            <StoreManagement />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/store-owner/store">
        <ProtectedRoute requiredRoles={["store_owner"]}>
          <MainLayout>
            <StoreOwnerStoreDetail />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/categories">
        <ProtectedRoute requiredRoles={["company_admin", "store_owner"]}>
          <MainLayout>
            <CategoryManagement />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/active-substances">
        <ProtectedRoute requiredRoles={["super_admin", "portal_admin"]}>
          <MainLayout>
            <ActiveSubstances />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/store-owner/managers">
        <ProtectedRoute requiredRoles={["store_owner"]}>
          <MainLayout>
            <StoreOwnerManagers />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/stores/:storeId">
        <ProtectedRoute requiredRoles={["company_admin"]}>
          <MainLayout>
            <BranchDetails />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/companies/:companyId/stores">
        <ProtectedRoute requiredRoles={["super_admin", "portal_admin"]}>
          <MainLayout>
            <BranchManagement />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/companies/:companyId/stores/:storeId">
        <ProtectedRoute requiredRoles={["super_admin", "portal_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <BranchDetails />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/managers">
        <ProtectedRoute requiredRoles={["super_admin", "portal_admin", "store_owner", "company_admin"]}>
          <MainLayout>
            <ManagerManagement />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/analytics">
        <ProtectedRoute requiredRoles={["super_admin", "portal_admin", "store_owner", "company_admin", "manager"]}>
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
        <ProtectedRoute requiredRoles={["super_admin", "portal_admin", "store_owner", "company_admin", "manager"]}>
          <MainLayout>
            <DynamicSettings />
          </MainLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/audit-logs">
        <ProtectedRoute requiredRoles={["super_admin", "portal_admin", "company_admin", "store_owner"]}>
          <MainLayout>
            <AuditLogs />
          </MainLayout>
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
