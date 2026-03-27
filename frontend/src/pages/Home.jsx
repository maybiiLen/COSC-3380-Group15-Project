import { useAuth } from '../context/AuthContext'

export default function Home() {
  const { user } = useAuth()

  // Define different stats based on user role
  const getStatsForRole = (role) => {
    switch (role) {
      case 'customer':
        return [
          { label: "My Tickets", value: "2", icon: "🎟️" },
          { label: "Rides Available", value: "18", icon: "🎢" },
          { label: "Park Status", value: "Open", icon: "✅" },
          { label: "Wait Time Avg", value: "15 min", icon: "⏰" }
        ]

      case 'staff':
        return [
          { label: "Rides Operational", value: "18", icon: "🎢" },
          { label: "Maintenance Pending", value: "3", icon: "🔧" },
          { label: "Park Status", value: "Open", icon: "✅" },
          { label: "My Shift", value: "8 hrs", icon: "👤" }
        ]

      case 'manager':
      case 'admin':
        return [
          { label: "Tickets Sold", value: "1,284", icon: "🎟️" },
          { label: "Revenue Today", value: "$45,230", icon: "💰" },
          { label: "Staff On Duty", value: "56", icon: "👥" },
          { label: "Maintenance Pending", value: "3", icon: "🔧" }
        ]

      default:
        return [
          { label: "Park Status", value: "Open", icon: "✅" }
        ]
    }
  }

  const stats = getStatsForRole(user?.role)
  const welcomeMessage = user?.role === 'customer'
    ? 'Welcome to CougarRide Theme Park!'
    : 'Welcome to CougarRide Theme Park Management'

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">{welcomeMessage}</p>
      {user?.role && (
        <p className="mt-2 text-xs text-gray-400">
          Logged in as: {user.role.charAt(0).toUpperCase() + user.role.slice(1)} ({user.email})
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-3xl">{stat.icon}</div>
            <p className="mt-2 text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Role-specific additional content */}
      {user?.role === 'customer' && (
        <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm">
          <h3 className="text-lg font-medium text-blue-900">🎊 Special Offers</h3>
          <p className="mt-2 text-sm text-blue-700">
            Show your student ID at the gift shop for 15% off merchandise!
          </p>
        </div>
      )}

      {['staff'].includes(user?.role) && (
        <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <h3 className="text-lg font-medium text-green-900">📝 Today's Tasks</h3>
          <ul className="mt-2 text-sm text-green-700">
            <li>• Complete safety inspection for Roller Coaster #3</li>
            <li>• Update maintenance logs for completed repairs</li>
            <li>• Attend 2 PM staff briefing</li>
          </ul>
        </div>
      )}

      {['manager', 'admin'].includes(user?.role) && (
        <div className="mt-8 rounded-xl border border-purple-200 bg-purple-50 p-6 shadow-sm">
          <h3 className="text-lg font-medium text-purple-900">📊 Quick Analytics</h3>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-purple-700">
            <div>
              <p><strong>Today vs Yesterday:</strong></p>
              <p>• Visitors: +12%</p>
              <p>• Revenue: +8%</p>
            </div>
            <div>
              <p><strong>This Week:</strong></p>
              <p>• Peak day: Saturday</p>
              <p>• Top ride: Thunder Mountain</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
