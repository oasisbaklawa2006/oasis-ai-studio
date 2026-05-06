import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import ProductEdit from "./pages/ProductEdit";
import Media from "./pages/Media";
import Tags from "./pages/Tags";
import Catalogues from "./pages/Catalogues";
import CatalogueDetail from "./pages/CatalogueDetail";
import PublicCatalogue from "./pages/PublicCatalogue";
import Hampers from "./pages/Hampers";
import Ingredients from "./pages/Ingredients";
import Labels from "./pages/Labels";
import AIStudio from "./pages/AIStudio";
import Settings from "./pages/Settings";
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
                <Route path="/" element={<Dashboard />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductEdit />} />
                <Route path="/media" element={<Media />} />
                <Route path="/tags" element={<Tags />} />
                <Route path="/catalogues" element={<Catalogues />} />
                <Route path="/catalogues/:id" element={<CatalogueDetail />} />
                <Route path="/hampers" element={<Hampers />} />
                <Route path="/ingredients" element={<Ingredients />} />
                <Route path="/labels" element={<Labels />} />
                <Route path="/ai-studio" element={<AIStudio />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
