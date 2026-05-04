"use client";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";

export default function AuthPage() {
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/emails",
    });
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center text-sm font-semibold text-white mx-auto mb-4">
            o
          </div>
          <h1 className="text-xl font-semibold text-[#F0F0F0]">
            Sign in to Opensend
          </h1>
          <p className="text-[13px] text-[#A1A4A5] mt-1">
            Continue with your Google account
          </p>
        </div>
        <button
          type="button"
          onClick={signIn}
          disabled={loading}
          className="w-full px-4 py-2.5 text-[14px] font-medium text-black bg-white hover:bg-gray-200 disabled:opacity-50 rounded-md transition-colors flex items-center justify-center gap-2"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            role="img"
            aria-label="Google Logo"
          >
            <title>Google Logo</title>
            <path
              fill="#4285F4"
              d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"
            />
            <path
              fill="#34A853"
              d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"
            />
            <path
              fill="#FBBC05"
              d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"
            />
            <path
              fill="#EA4335"
              d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"
            />
          </svg>
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}
