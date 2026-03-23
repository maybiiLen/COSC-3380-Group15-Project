import { Link } from "react-router-dom";
import logo from "../assets/cougarride logo.png";

export default function AuthLayout({ title, subtitle, children, footerText, footerLink, footerLinkText }) {
  return (
    <div className="flex min-h-screen">
      {/* Left — form panel */}
      <div className="flex flex-1 flex-col justify-center px-12 py-16 bg-white">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo */}
          <div className="mb-8">
            <img src={logo} alt="CougarRide" className="h-20 w-auto" />
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>

          {/* Form slot */}
          <div className="mt-8">{children}</div>

          {/* Footer link */}
          {footerText && (
            <p className="mt-6 text-center text-sm text-gray-500">
              {footerText}{" "}
              <Link to={footerLink} className="font-semibold text-[#C8102E] hover:underline">
                {footerLinkText}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Right — red branding panel */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-[#C8102E] text-white px-12">
        <div className="text-center">
          <div className="bg-white rounded-2xl p-5 inline-block mb-6 shadow-lg">
            <img src={logo} alt="CougarRide" className="h-20 w-auto" />
          </div>
          <h2 className="text-4xl font-black tracking-tight">CougarRide</h2>
          <p className="mt-3 text-lg text-red-100 font-medium">Your adventure starts here</p>
          <div className="mt-10 flex flex-col gap-3 text-red-100 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-white text-lg">🎢</span> Thrilling rides & attractions
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white text-lg">🎟️</span> Easy ticket & pass purchases
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white text-lg">🍔</span> Food, shops & more
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
