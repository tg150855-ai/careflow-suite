import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

import "./styles.css";
import { routeTree } from "./routeTree.gen";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/sbg-arogya-plus-logo.png.asset.json";

// Set favicon at runtime (avoids depending on a public/ folder)
const link = document.createElement("link");
link.rel = "icon";
link.type = "image/png";
link.href = logoAsset.url;
document.head.appendChild(link);

// Performance: sensible cache defaults so navigating between modules is instant
// and we don't refire the same query on every focus/mount.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  // Preload routes on hover/focus so navigation feels instant
  defaultPreload: "intent",
  defaultPreloadStaleTime: 30_000,
  defaultPendingMs: 100,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function AuthInvalidator() {
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Only invalidate on real auth transitions, not on token refresh
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        qc.invalidateQueries();
      }
    });
    return () => subscription.unsubscribe();
  }, [qc]);
  return null;
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthInvalidator />
          <RouterProvider router={router} />
          <Toaster richColors closeButton position="top-right" />
        </AuthProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
