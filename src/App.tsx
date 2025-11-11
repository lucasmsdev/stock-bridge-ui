import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider } from "./hooks/useAuth";
import { ThemeProvider } from "./components/layout/ThemeProvider";
import { queryClient } from "./lib/queryClient";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import PendingPayment from "./pages/auth/PendingPayment";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import CreateProduct from "./pages/CreateProduct";
import ProductDetails from "./pages/ProductDetails";
import Orders from "./pages/Orders";
import Finance from "./pages/Finance";
import Integrations from "./pages/Integrations";
import MarketAnalysis from "./pages/MarketAnalysis";
import Help from "./pages/Help";
import FAQ from "./pages/FAQ";
import Profile from "./pages/Profile";
import Billing from "./pages/Billing";
import MercadoLivreCallback from "./pages/callback/MercadoLivreCallback";
import Landing from "./pages/Landing";
import Reports from "./pages/Reports";
import Checkout from "./pages/Checkout";
import AIAssistant from "./pages/AIAssistant";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/pending-payment" element={<PendingPayment />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/callback/mercadolivre" element={<MercadoLivreCallback />} />
              
              {/* Protected Routes */}
              <Route path="/app" element={<AppLayout />}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="products/new" element={<CreateProduct />} />
                <Route path="products/:id" element={<ProductDetails />} />
                <Route path="orders" element={<Orders />} />
                <Route path="finance" element={<Finance />} />
                <Route path="integrations" element={<Integrations />} />
                <Route path="market-analysis" element={<MarketAnalysis />} />
                <Route path="help" element={<Help />} />
                <Route path="faq" element={<FAQ />} />
                <Route path="profile" element={<Profile />} />
                <Route path="billing" element={<Billing />} />
                <Route path="reports" element={<Reports />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
              </Route>

              {/* Landing page as root */}
              <Route path="/" element={<Landing />} />
              
              {/* Catch all route - redirect to landing */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;