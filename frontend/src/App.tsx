import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { WalletContextProvider } from "./components/WalletProvider";
import { AuthProvider, useAuth } from "./components/AuthProvider";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import SurveyFill from "./pages/SurveyFill";
import FormBuilder from "./pages/FormBuilder";
import HowItWorks from "./pages/HowItWorks";
import Explore from "./pages/Explore";
import Pricing from "./pages/Pricing";
import { Loader2 } from "lucide-react";

// Clean up old UUID-based drafts on app load
function useCleanupOldDrafts() {
  useEffect(() => {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith("okaform_draft_")) {
        localStorage.removeItem(key);
      }
    });
  }, []);
}

function IndexRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0D1117]">
        <Loader2 className="h-6 w-6 animate-spin text-[#656C76]" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout>
      <Home />
    </Layout>
  );
}

export default function App() {
  useCleanupOldDrafts();

  return (
    <WalletContextProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<IndexRoute />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/how-it-works"
            element={<HowItWorks />}
          />
          <Route
            path="/pricing"
            element={
              <Layout>
                <Pricing />
              </Layout>
            }
          />
          <Route
            path="/explore"
            element={<Explore />}
          />
          <Route
            path="/form/:formId"
            element={
              <Layout>
                <SurveyFill />
              </Layout>
            }
          />
          <Route
            path="/create"
            element={
              <Layout>
                <FormBuilder />
              </Layout>
            }
          />
          <Route
            path="/create/:draftId"
            element={
              <Layout>
                <FormBuilder />
              </Layout>
            }
          />
        </Routes>
      </AuthProvider>
    </WalletContextProvider>
  );
}
