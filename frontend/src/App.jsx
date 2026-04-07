import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TrainingForEngineers from "./pages/TrainingForEngineers";
import Predictions from "./pages/Predictions";
import Settings from "./pages/Settings";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Contact from "./pages/Contact";
import Header from "./components/Header";
import Footer from "./components/Footer";

export default function App() {
  return (
    <BrowserRouter>
      {/* Flex container to ensure footer sticks to the bottom */}
      <div className="d-flex flex-column min-vh-100">
        {/* Header */}
        <Header />

        {/* Main content area */}
        <div className="flex-grow-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route
              path="/training-for-engineers"
              element={<TrainingForEngineers />}
            />
            <Route
              path="/Training-for-engineers"
              element={<Navigate to="/training-for-engineers" replace />}
            />
            <Route path="/:fileName" element={<Predictions />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </BrowserRouter>
  );
}
