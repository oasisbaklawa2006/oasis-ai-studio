import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { RoleGate } from "@/components/RoleGate";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductEdit from "./pages/ProductEdit";
import Media from "./pages/Media";
import Tags from "./pages/Tags";
import Catalogues from "./pages/Catalogues";
import CatalogueDetail from "./pages/CatalogueDetail";
import CatalogueProposal from "./pages/CatalogueProposal";
import PublicCatalogue from "./pages/PublicCatalogue";
import Hampers from "./pages/Hampers";
import Ingredients from "./pages/Ingredients";
import Labels from "./pages/Labels";
import LabelQueue from "./pages/LabelQueue";
import AIStudio from "./pages/AIStudio";
import Settings from "./pages/Settings";
import Testing from "./pages/Testing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/c/:slug" element={<PublicCatalogue />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<RoleGate page="dashboard"><Dashboard /></RoleGate>} />
                <Route path="/products" element={<RoleGate page="products"><Products /></RoleGate>} />
                <Route path="/products/:id" element={<RoleGate page="products"><ProductEdit /></RoleGate>} />
                <Route path="/media" element={<RoleGate page="media"><Media /></RoleGate>} />
                <Route path="/tags" element={<RoleGate page="tags"><Tags /></RoleGate>} />
                <Route path="/catalogues" element={<RoleGate page="catalogues"><Catalogues /></RoleGate>} />
                <Route path="/catalogues/:id" element={<RoleGate page="catalogues"><CatalogueDetail /></RoleGate>} />
                <Route path="/hampers" element={<RoleGate page="hampers"><Hampers /></RoleGate>} />
                <Route path="/ingredients" element={<RoleGate page="ingredients"><Ingredients /></RoleGate>} />
                <Route path="/labels" element={<RoleGate page="labels"><Labels /></RoleGate>} />
                <Route path="/label-queue" element={<RoleGate page="labels"><LabelQueue /></RoleGate>} />
                <Route path="/ai-studio" element={<RoleGate page="ai_studio"><AIStudio /></RoleGate>} />
                <Route path="/testing" element={<RoleGate page="testing"><Testing /></RoleGate>} />
                <Route path="/settings" element={<RoleGate page="settings"><Settings /></RoleGate>} />
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
