import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
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

function DraftRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/create/${crypto.randomUUID()}`, { replace: true });
  }, [navigate]);
  return null;
}

export default function App() {
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
                <DraftRedirect />
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
