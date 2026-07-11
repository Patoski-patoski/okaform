import { Routes, Route } from "react-router-dom";
import { WalletContextProvider } from "./components/WalletProvider";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import SurveyFill from "./pages/SurveyFill";
import FormBuilder from "./pages/FormBuilder";

export default function App() {
  return (
    <WalletContextProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/form/:formId" element={<SurveyFill />} />
        <Route path="/create" element={<FormBuilder />} />
      </Routes>
    </WalletContextProvider>
  );
}
