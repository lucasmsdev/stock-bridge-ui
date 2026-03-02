import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthProvider } from "./hooks/useAuth";
import { ThemeProvider } from "./components/layout/ThemeProvider";
import { queryClient } from "./lib/queryClient";
import { LoadingSpinner } from "./components/ui/loading-spinner";

// Lazy-loaded pages
const Login = lazy(() => import("./pages/auth/Login"));
const Signup = lazy(() => import("./pages/auth/Signup"));
const PendingPayment = lazy(() => import("./pages/auth/PendingPayment"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const CreateProduct = lazy(() => import("./pages/CreateProduct"));
const ProductDetails = lazy(() => import("./pages/ProductDetails"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const Finance = lazy(() => import("./pages/Finance"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Integrations = lazy(() => import("./pages/Integrations"));
const MarketAnalysis = lazy(() => import("./pages/MarketAnalysis"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const SupplierDetails = lazy(() => import("./pages/SupplierDetails"));
const Help = lazy(() => import("./pages/Help"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Profile = lazy(() => import("./pages/Profile"));
const Billing = lazy(() => import("./pages/Billing"));
const MercadoLivreCallback = lazy(() => import("./pages/callback/MercadoLivreCallback"));
const MagaluCallback = lazy(() => import("./pages/callback/MagaluCallback"));
const TikTokShopCallback = lazy(() => import("./pages/callback/TikTokShopCallback"));
const GoogleAdsCallback = lazy(() => import("./pages/callback/GoogleAdsCallback"));
const Landing = lazy(() => import("./pages/Landing"));
const Reports = lazy(() => import("./pages/Reports"));
const Checkout = lazy(() => import("./pages/Checkout"));
const AIAssistant = lazy(() => import("./pages/AIAssistant"));
const Contact = lazy(() => import("./pages/Contact"));
const Labels = lazy(() => import("./pages/Labels"));
const Scanner = lazy(() => import("./pages/Scanner"));
const Team = lazy(() => import("./pages/Team"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Tracking = lazy(() => import("./pages/Tracking"));
const Automations = lazy(() => import("./pages/Automations"));
const Invoices = lazy(() => import("./pages/Invoices"));

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/pending-payment" element={<PendingPayment />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/callback/mercadolivre" element={<MercadoLivreCallback />} />
                <Route path="/callback/magalu" element={<MagaluCallback />} />
                <Route path="/callback/tiktokshop" element={<TikTokShopCallback />} />
                <Route path="/callback/google-ads" element={<GoogleAdsCallback />} />
                
                {/* Protected Routes */}
                <Route path="/app" element={<AppLayout />}>
                  <Route index element={<Navigate to="/app/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="products" element={<Products />} />
                  <Route path="products/new" element={<CreateProduct />} />
                  <Route path="products/:id" element={<ProductDetails />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="orders/:id" element={<OrderDetails />} />
                  <Route path="tracking" element={<Tracking />} />
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
                  <Route path="product-roi" element={<Navigate to="/app/dashboard" replace />} />
                  <Route path="automations" element={<Automations />} />
                  <Route path="invoices" element={<Invoices />} />
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
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
