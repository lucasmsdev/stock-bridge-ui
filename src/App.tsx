import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider } from "./hooks/useAuth";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductDetails from "./pages/ProductDetails";
import Orders from "./pages/Orders";
import Finance from "./pages/Finance";
import Integrations from "./pages/Integrations";
import Help from "./pages/Help";
import Profile from "./pages/Profile";
import MercadoLivreCallback from "./pages/callback/MercadoLivreCallback";
import ShopifyCallback from "./pages/callback/ShopifyCallback";
import ShopifySetup from "./pages/ShopifySetup";
import Landing from "./pages/Landing";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/callback/mercadolivre" element={<MercadoLivreCallback />} />
            <Route path="/callback/shopify" element={<ShopifyCallback />} />
            <Route path="/shopify-setup" element={<ShopifySetup />} />
            
            {/* Protected Routes */}
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="/app/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:id" element={<ProductDetails />} />
              <Route path="orders" element={<Orders />} />
              <Route path="finance" element={<Finance />} />
              <Route path="integrations" element={<Integrations />} />
              <Route path="help" element={<Help />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Landing page as root */}
            <Route path="/" element={<Landing />} />
            
            {/* Catch all route - redirect to landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;