import { useEffect, useState } from "react";
import Login from "./pages/Login"
import Sidebar from "./Sidebar";
import ProtectedRoute from "./pages/ProtectedRoute"
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home"
import Rides from "./pages/Rides"
import Staff from "./pages/Staff"
import Tickets from "./pages/Tickets"
import Restaurant from "./pages/Restaurant"
import GiftShop from "./pages/GiftShop"
import Merchandise from "./pages/Merchandise"
import Maintenance from "./pages/Maintenance"
import Analytics from "./pages/Analytics"

function Layout() {
  return (
      <div className="flex min-h-screen bg-white">
        <Sidebar />
        <main>
          <Routes>
            <Route path="/" element={<Home/>} />
            <Route path="/rides" element={<Rides/>} />
            <Route path="/staff" element={<Staff/>} />
            <Route path="/tickets" element={<Tickets/>} />
            <Route path="/restaurant" element={<Restaurant/>} />
            <Route path="/gift-shop" element={<GiftShop/>} />
            <Route path="/merchandise" element={<Merchandise/>} />
            <Route path="/maintenance" element={<Maintenance/>} />
            <Route path="/analytics" element={<Analytics/>} />
          </Routes>
        </main>
        
      </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route path="/*"
        element={<ProtectedRoute>
          <Layout />
        </ProtectedRoute>}
        />
      </Routes>
    </BrowserRouter>
  )
}
