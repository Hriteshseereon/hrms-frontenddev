
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function MasterAdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleLogin(e) {
    e.preventDefault();
    setError("");

    // Temporary demo credentials for frontend testing
    if (
      email.trim().toLowerCase() === "admin@seereon.com" &&
      password === "Admin@123"
    ) {
      sessionStorage.setItem("masterAdminLoggedIn", "true");

      navigate("/master-admin/dashboard", {
        replace: true,
      });
    } else {
      setError("Invalid email or password. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-green-50 px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-green-100 bg-white p-8 shadow-xl">

        {/* Logo and heading */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-green-600 text-2xl font-bold text-white shadow-md">
            S
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Seereon HRMS
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Master Administrator Portal
          </p>
        </div>

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-5">

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Email address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter admin email"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-black placeholder:text-slate-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-800"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-black placeholder:text-slate-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
          </div>

          {/* Error message */}
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            Sign in as Master Admin
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-slate-500">
          This portal is for authorized administrators only.
        </p>

        <div className="mt-4 text-center">
          <Link
            to="/login"
            className="text-sm font-medium text-green-700 hover:text-green-800 hover:underline"
          >
            Back to regular login
          </Link>
        </div>
      </div>
    </div>
  );
}
