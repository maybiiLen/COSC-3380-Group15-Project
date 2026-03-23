export default function Home() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">Welcome to CougarRide Theme Park Management</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Rides", value: "24", icon: "🎢" },
          { label: "Tickets Sold", value: "1,284", icon: "🎟️" },
          { label: "Staff On Duty", value: "56", icon: "👥" },
          { label: "Park Status", value: "Open", icon: "✅" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-3xl">{stat.icon}</div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
