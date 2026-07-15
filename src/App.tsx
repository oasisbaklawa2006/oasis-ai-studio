import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { CapabilityUnavailable } from "@/components/CapabilityUnavailable";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleGate } from "@/components/RoleGate";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AIStudio from "./pages/AIStudio";
import ApprovalInbox from "./pages/ApprovalInbox";
import Auth from "./pages/Auth";
import CatalogueProductStudio from "./pages/CatalogueProductStudio";
import Category1ImportStaging from "./pages/Category1ImportStaging";
import Dashboard from "./pages/Dashboard";
import DataCorrection from "./pages/DataCorrection";
import FastCreateProduct from "./pages/FastCreateProduct";
import Media from "./pages/Media";
import NotFound from "./pages/NotFound";
import OperatorInbox from "./pages/OperatorInbox";
import PilotAliasReview from "./pages/PilotAliasReview";
import PilotReadinessDashboard from "./pages/PilotReadinessDashboard";
import ProductEdit from "./pages/ProductEdit";
import Products from "./pages/Products";
import ResolverPreview from "./pages/ResolverPreview";
import Settings from "./pages/Settings";
import Testing from "./pages/Testing";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 60_000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/c/:slug"
              element={
                <CapabilityUnavailable
                  title="Public Catalogue"
                  capability="the governed catalogues table"
                />
              }
            />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route
                  path="/"
                  element={
                    <RoleGate page="dashboard">
                      <Dashboard />
                    </RoleGate>
                  }
                />
                <Route
                  path="/products"
                  element={
                    <RoleGate page="products">
                      <Products />
                    </RoleGate>
                  }
                />
                <Route
                  path="/products/new/fast"
                  element={
                    <RoleGate page="products">
                      <FastCreateProduct />
                    </RoleGate>
                  }
                />
                <Route
                  path="/products/:id"
                  element={
                    <RoleGate page="products">
                      <ProductEdit />
                    </RoleGate>
                  }
                />
                <Route
                  path="/media"
                  element={
                    <RoleGate page="media">
                      <Media />
                    </RoleGate>
                  }
                />
                <Route
                  path="/tags"
                  element={
                    <RoleGate page="tags">
                      <CapabilityUnavailable title="Tags" capability="the tags master table" />
                    </RoleGate>
                  }
                />
                <Route
                  path="/catalogues"
                  element={
                    <RoleGate page="catalogues">
                      <CapabilityUnavailable
                        title="Catalogues"
                        capability="the governed catalogues table"
                      />
                    </RoleGate>
                  }
                />
                <Route
                  path="/admin/catalogue-builder"
                  element={
                    <RoleGate page="catalogues">
                      <CapabilityUnavailable
                        title="Catalogue Builder"
                        capability="the catalogue collections persistence tables"
                        retained="The builder implementation and product data remain retained."
                      />
                    </RoleGate>
                  }
                />
                <Route
                  path="/admin/catalogue-product-studio"
                  element={
                    <RoleGate page="catalogues">
                      <CatalogueProductStudio />
                    </RoleGate>
                  }
                />
                <Route
                  path="/catalogues/:id"
                  element={
                    <RoleGate page="catalogues">
                      <CapabilityUnavailable
                        title="Catalogue Detail"
                        capability="the governed catalogues table"
                      />
                    </RoleGate>
                  }
                />
                <Route
                  path="/catalogues/:id/proposal"
                  element={
                    <RoleGate page="catalogues">
                      <CapabilityUnavailable
                        title="Catalogue Proposal"
                        capability="the governed catalogues table"
                      />
                    </RoleGate>
                  }
                />
                <Route
                  path="/hampers"
                  element={
                    <RoleGate page="hampers">
                      <CapabilityUnavailable
                        title="Hampers & BOM"
                        capability="the hampers persistence tables"
                      />
                    </RoleGate>
                  }
                />
                <Route
                  path="/ingredients"
                  element={
                    <RoleGate page="ingredients">
                      <CapabilityUnavailable
                        title="Ingredients & Nutrition"
                        capability="the ingredients and nutrition tables"
                      />
                    </RoleGate>
                  }
                />
                <Route
                  path="/labels"
                  element={
                    <RoleGate page="labels">
                      <CapabilityUnavailable
                        title="Labels"
                        capability="the labels and nutrition tables"
                      />
                    </RoleGate>
                  }
                />
                <Route
                  path="/label-queue"
                  element={
                    <RoleGate page="labels">
                      <CapabilityUnavailable
                        title="Label Queue"
                        capability="the labels workflow tables"
                      />
                    </RoleGate>
                  }
                />
                <Route
                  path="/ai-studio"
                  element={
                    <RoleGate page="ai_studio">
                      <AIStudio />
                    </RoleGate>
                  }
                />
                <Route
                  path="/testing"
                  element={
                    <RoleGate page="testing">
                      <Testing />
                    </RoleGate>
                  }
                />
                <Route
                  path="/testing/pilot-readiness"
                  element={
                    <RoleGate page="testing">
                      <PilotReadinessDashboard />
                    </RoleGate>
                  }
                />
                <Route
                  path="/testing/pilot-aliases"
                  element={
                    <RoleGate page="testing">
                      <PilotAliasReview />
                    </RoleGate>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RoleGate page="settings">
                      <Settings />
                    </RoleGate>
                  }
                />
                <Route
                  path="/audit-log"
                  element={
                    <RoleGate page="audit_log">
                      <CapabilityUnavailable
                        title="Activation Audit Log"
                        capability="the feature activation audit table"
                      />
                    </RoleGate>
                  }
                />
                <Route path="/approvals" element={<ApprovalInbox />} />
                <Route
                  path="/data-correction"
                  element={
                    <RoleGate page="data_correction">
                      <DataCorrection />
                    </RoleGate>
                  }
                />
                <Route
                  path="/admin/resolver-preview"
                  element={
                    <RoleGate page="testing">
                      <ResolverPreview />
                    </RoleGate>
                  }
                />
                <Route
                  path="/admin/operator-inbox"
                  element={
                    <RoleGate page="testing">
                      <OperatorInbox />
                    </RoleGate>
                  }
                />
                <Route
                  path="/admin/import/category-1"
                  element={
                    <RoleGate page="category1_import">
                      <Category1ImportStaging />
                    </RoleGate>
                  }
                />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
