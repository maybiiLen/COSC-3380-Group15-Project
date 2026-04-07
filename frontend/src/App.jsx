import AuthPage from "./pages/AuthPage";
import Sidebar from "./Sidebar";
import ProtectedRoute from "./pages/ProtectedRoute";
import CustomerLanding from "./pages/CustomerLanding";
import TicketShop from "./pages/TicketShop";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import Home from "./pages/Home";
import Rides from "./pages/Rides";
import Staff from "./pages/Staff";
import Tickets from "./pages/Tickets";
import Restaurant from "./pages/Restaurant";
import GiftShop from "./pages/GiftShop";
import Merchandise from "./pages/Merchandise";
import Maintenance from "./pages/Maintenance";
import Analytics from "./pages/Analytics";

function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rides" element={<Rides />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/restaurant" element={<Restaurant />} />
          <Route path="/gift-shop" element={<GiftShop />} />
          <Route path="/merchandise" element={<Merchandise />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<CustomerLanding />} />
          <Route path="/tickets" element={<TicketShop />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="/register" element={<Navigate to="/auth" replace />} />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}