import AuthPage from "./pages/AuthPage";
import Sidebar from "./Sidebar";
import ProtectedRoute from "./pages/ProtectedRoute";
import CustomerLanding from "./pages/CustomerLanding";
import TicketShop from "./pages/TicketShop";
import DiningPage from "./pages/DiningPage";
import GamesPage from "./pages/GamesPage";
import ShoppingPage from "./pages/ShoppingPage";
import CustomerRidesPage from "./pages/CustomerRidesPage";
import MyPurchases from "./pages/MyPurchases";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import Rides from "./pages/Rides";
import Staff from "./pages/Staff";
import ParkOperations from "./pages/ParkOperations";
import Maintenance from "./pages/Maintenance";
import MyTasks from "./pages/MyTasks";
import Analytics from "./pages/Analytics";
import Notifications from "./pages/Notifications";

function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard/rides" replace />} />
          <Route path="/rides" element={<Rides />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/dining-shops" element={<ParkOperations />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/my-tasks" element={<MyTasks />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/notifications" element={<Notifications />} />
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
          <Route path="/my-purchases" element={<MyPurchases />} />
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