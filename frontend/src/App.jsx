import AuthPage from "./pages/AuthPage";
import Sidebar from "./Sidebar";
import ProtectedRoute from "./pages/ProtectedRoute";
import CustomerLanding from "./pages/CustomerLanding";
import TicketShop from "./pages/TicketShop";
import DiningPage from "./pages/DiningPage";
import GamesPage from "./pages/GamesPage";
import ShoppingPage from "./pages/ShoppingPage";
import CustomerRidesPage from "./pages/CustomerRidesPage";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import Home from "./pages/Home";
import Rides from "./pages/Rides";
import Staff from "./pages/Staff";
import Tickets from "./pages/Tickets";
import ParkOperations from "./pages/ParkOperations";
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
          <Route path="/dining-shops" element={<ParkOperations />} />
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
          <Route path="/dining" element={<DiningPage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/shopping" element={<ShoppingPage />} />
          <Route path="/rides" element={<CustomerRidesPage />} />
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