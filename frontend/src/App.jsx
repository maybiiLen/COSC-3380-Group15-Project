import { useEffect, useState } from "react";

function App() {
  const [health, setHealth] = useState("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.database))
      .catch(() => setHealth("error"));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-700">CougarRide</h1>
        <p className="mt-2 text-gray-600">Amusement Park Management</p>
        <p className="mt-4 text-sm">Database: {health}</p>
      </div>
    </div>
  );
}

export default App;
