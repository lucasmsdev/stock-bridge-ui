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
import Expenses from "./pages/Expenses";
import Integrations from "./pages/Integrations";
import MarketAnalysis from "./pages/MarketAnalysis";
import Suppliers from "./pages/Suppliers";
import SupplierDetails from "./pages/SupplierDetails";
import Help from "./pages/Help";
import FAQ from "./pages/FAQ";
import Profile from "./pages/Profile";
import Billing from "./pages/Billing";
import MercadoLivreCallback from "./pages/callback/MercadoLivreCallback";
import Landing from "./pages/Landing";
import Reports from "./pages/Reports";
import Checkout from "./pages/Checkout";
import AIAssistant from "./pages/AIAssistant";
import Contact from "./pages/Contact";
import Labels from "./pages/Labels";
import Scanner from "./pages/Scanner";
import Team from "./pages/Team";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import ProductROI from "./pages/ProductROI";

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
                <Route path="expenses" element={<Expenses />} />
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="suppliers/:id" element={<SupplierDetails />} />
                <Route path="integrations" element={<Integrations />} />
                <Route path="market-analysis" element={<MarketAnalysis />} />
                <Route path="help" element={<Help />} />
                <Route path="faq" element={<FAQ />} />
                <Route path="profile" element={<Profile />} />
                <Route path="billing" element={<Billing />} />
                <Route path="reports" element={<Reports />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="labels" element={<Labels />} />
                <Route path="scanner" element={<Scanner />} />
                <Route path="team" element={<Team />} />
                <Route path="product-roi" element={<ProductROI />} />
                {/* Redirect old stock-forecast route to products tab */}
                <Route path="stock-forecast" element={<Navigate to="/app/products?tab=forecast" replace />} />
              </Route>

              {/* Landing page as root */}
              <Route path="/" element={<Landing />} />
              <Route path="/contato" element={<Contact />} />
              <Route path="/termos" element={<TermsOfService />} />
              <Route path="/privacidade" element={<PrivacyPolicy />} />
              
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