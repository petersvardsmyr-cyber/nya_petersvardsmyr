import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import BlogTagFilter from "./pages/BlogTagFilter";
import Shop from "./pages/Shop";
import Newsletter from "./pages/Newsletter";
import Success from "./pages/Success";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminBlogPosts from "./pages/AdminBlogPosts";
import AdminProductsPage from "./pages/AdminProductsPage";
import AdminNewsletterPage from "./pages/AdminNewsletterPage";
import AdminSentNewslettersPage from "./pages/AdminSentNewslettersPage";
import AdminNewsletterSubscribersPage from "./pages/AdminNewsletterSubscribersPage";
import AdminOrders from "./pages/AdminOrders";
import AdminAccounting from "./pages/AdminAccounting";
import AdminEmailTemplatesPage from "./pages/AdminEmailTemplatesPage";
import AdminOrderNotifications from "./pages/AdminOrderNotifications";
import AdminNewsletterNotifications from "./pages/AdminNewsletterNotifications";
import AdminEmailSettings from "./pages/AdminEmailSettings";
import AdminPostEditor from "./pages/AdminPostEditor";
import AdminChangePassword from "./pages/AdminChangePassword";
import AdminBlogSubscribersPage from "./pages/AdminBlogSubscribersPage";
import AdminBlogCommentsPage from "./pages/AdminBlogCommentsPage";
import NotFound from "./pages/NotFound";
import NewsletterUnsubscribe from "./pages/NewsletterUnsubscribe";
import NewsletterConfirm from "./pages/NewsletterConfirm";

const queryClient = new QueryClient();

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Analytics />
          <SpeedInsights />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="blogg" element={<Blog />} />
              <Route path="blogg/tag/:tag" element={<BlogTagFilter />} />
              <Route path="blogg/:slug" element={<BlogPost />} />
              <Route path="butik" element={<Shop />} />
              <Route path="nyhetsbrev" element={<Newsletter />} />
              <Route path="nyhetsbrev/avregistrera" element={<NewsletterUnsubscribe />} />
              <Route path="nyhetsbrev/bekrafta" element={<NewsletterConfirm />} />
              <Route path="success" element={<Success />} />
            </Route>
            
            {/* Admin routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="posts" element={<AdminBlogPosts />} />
              <Route path="blog/subscribers" element={<AdminBlogSubscribersPage />} />
              <Route path="blog/comments" element={<AdminBlogCommentsPage />} />
              <Route path="products" element={<AdminProductsPage />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="accounting" element={<AdminAccounting />} />
              <Route path="newsletter" element={<AdminNewsletterPage />} />
              <Route path="newsletter/sent" element={<AdminSentNewslettersPage />} />
              <Route path="newsletter/subscribers" element={<AdminNewsletterSubscribersPage />} />
              <Route path="order-notifications" element={<AdminOrderNotifications />} />
              <Route path="newsletter-notifications" element={<AdminNewsletterNotifications />} />
              <Route path="email-settings" element={<AdminEmailSettings />} />
              <Route path="email-templates" element={<AdminEmailTemplatesPage />} />
              <Route path="posts/new" element={<AdminPostEditor />} />
              <Route path="posts/edit/:id" element={<AdminPostEditor />} />
              <Route path="change-password" element={<AdminChangePassword />} />
            </Route>
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
