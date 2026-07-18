import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { WalletContextProvider } from "./components/WalletProvider";
import { AuthProvider } from "./components/AuthProvider";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import SurveyFill from "./pages/SurveyFill";
import FormBuilder from "./pages/FormBuilder";
import HowItWorks from "./pages/HowItWorks";
import Explore from "./pages/Explore";
import Pricing from "./pages/Pricing";

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

export default function App() {
  useCleanupOldDrafts();

  return (
    <WalletContextProvider>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <Layout>
                <Home />
              </Layout>
            }
          />
          <Route
            path="/dashboard"
            element={<Dashboard />}
          />
          <Route
            path="/how-it-works"
            element={<HowItWorks />}
          />
          <Route
            path="/pricing"
            element={<Pricing />}
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
