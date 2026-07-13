import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { RoleGate } from "@/components/RoleGate";
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const FastCreateProduct = lazy(() => import("./pages/FastCreateProduct"));
const ProductEdit = lazy(() => import("./pages/ProductEdit"));
const Media = lazy(() => import("./pages/Media"));
const Tags = lazy(() => import("./pages/Tags"));
const Catalogues = lazy(() => import("./pages/Catalogues"));
const CatalogueBuilder = lazy(() => import("./pages/CatalogueBuilder"));
const CatalogueProductStudio = lazy(() => import("./pages/CatalogueProductStudio"));
const CatalogueDetail = lazy(() => import("./pages/CatalogueDetail"));
const CatalogueProposal = lazy(() => import("./pages/CatalogueProposal"));
const PublicCatalogue = lazy(() => import("./pages/PublicCatalogue"));
const Hampers = lazy(() => import("./pages/Hampers"));
const Ingredients = lazy(() => import("./pages/Ingredients"));
const Labels = lazy(() => import("./pages/Labels"));
const LabelQueue = lazy(() => import("./pages/LabelQueue"));
const AIStudio = lazy(() => import("./pages/AIStudio"));
const Settings = lazy(() => import("./pages/Settings"));
const Testing = lazy(() => import("./pages/Testing"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const DataCorrection = lazy(() => import("./pages/DataCorrection"));
const Category1ImportStaging = lazy(() => import("./pages/Category1ImportStaging"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ApprovalInbox = lazy(() => import("./pages/ApprovalInbox"));
const PilotReadinessDashboard = lazy(() => import("./pages/PilotReadinessDashboard"));
const PilotAliasReview = lazy(() => import("./pages/PilotAliasReview"));
const ResolverPreview = lazy(() => import("./pages/ResolverPreview"));
const OperatorInbox = lazy(() => import("./pages/OperatorInbox"));

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
          <Suspense fallback={<main className="min-h-screen grid place-items-center" aria-busy="true">Loading workspace…</main>}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/c/:slug" element={<PublicCatalogue />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<RoleGate page="dashboard"><Dashboard /></RoleGate>} />
                <Route path="/products" element={<RoleGate page="products"><Products /></RoleGate>} />
                <Route path="/products/new/fast" element={<RoleGate page="products"><FastCreateProduct /></RoleGate>} />
                <Route path="/products/:id" element={<RoleGate page="products"><ProductEdit /></RoleGate>} />
                <Route path="/media" element={<RoleGate page="media"><Media /></RoleGate>} />
                <Route path="/tags" element={<RoleGate page="tags"><Tags /></RoleGate>} />
                <Route path="/catalogues" element={<RoleGate page="catalogues"><Catalogues /></RoleGate>} />
                <Route path="/admin/catalogue-builder" element={<RoleGate page="catalogues"><CatalogueBuilder /></RoleGate>} />
                <Route path="/admin/catalogue-product-studio" element={<RoleGate page="catalogues"><CatalogueProductStudio /></RoleGate>} />
                <Route path="/catalogues/:id" element={<RoleGate page="catalogues"><CatalogueDetail /></RoleGate>} />
                <Route path="/catalogues/:id/proposal" element={<RoleGate page="catalogues"><CatalogueProposal /></RoleGate>} />
                <Route path="/hampers" element={<RoleGate page="hampers"><Hampers /></RoleGate>} />
                <Route path="/ingredients" element={<RoleGate page="ingredients"><Ingredients /></RoleGate>} />
                <Route path="/labels" element={<RoleGate page="labels"><Labels /></RoleGate>} />
                <Route path="/label-queue" element={<RoleGate page="labels"><LabelQueue /></RoleGate>} />
                <Route path="/ai-studio" element={<RoleGate page="ai_studio"><AIStudio /></RoleGate>} />
                <Route path="/testing" element={<RoleGate page="testing"><Testing /></RoleGate>} />
                <Route path="/testing/pilot-readiness" element={<RoleGate page="testing"><PilotReadinessDashboard /></RoleGate>} />
                <Route path="/testing/pilot-aliases" element={<RoleGate page="testing"><PilotAliasReview /></RoleGate>} />
                <Route path="/settings" element={<RoleGate page="settings"><Settings /></RoleGate>} />
                <Route path="/audit-log" element={<RoleGate page="audit_log"><AuditLog /></RoleGate>} />
                <Route path="/approvals" element={<ApprovalInbox />} />
                <Route path="/data-correction" element={<RoleGate page="data_correction"><DataCorrection /></RoleGate>} />
                <Route path="/admin/resolver-preview" element={<RoleGate page="testing"><ResolverPreview /></RoleGate>} />
                <Route path="/admin/operator-inbox" element={<RoleGate page="testing"><OperatorInbox /></RoleGate>} />
                <Route path="/admin/import/category-1" element={<RoleGate page="category1_import"><Category1ImportStaging /></RoleGate>} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
