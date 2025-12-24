"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, ArrowLeft, Shield, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";

export default function DeleteAccountPage() {
  const router = useRouter();
  const { isDomesticVersion } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Redirect to home if domestic version
    if (isDomesticVersion) {
      router.push("/");
      return;
    }

    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    checkUser();
  }, [isDomesticVersion, router, supabase.auth]);

  const handleDeleteAccount = async () => {
    if (!confirmed) {
      setError("Please confirm that you understand this action is irreversible.");
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        credentials: "include",
      });

      if (response.status === 204) {
        setSuccess(true);
        // Sign out and redirect after a delay
        await supabase.auth.signOut();
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete account. Please try again.");
      }
    } catch (err) {
      setError("An error occurred. Please try again later.");
    } finally {
      setDeleting(false);
    }
  };

  // Redirect domestic version users
  if (isDomesticVersion) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Account Deleted Successfully
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your account and all associated data have been permanently deleted.
            You will be redirected to the home page shortly.
          </p>
          <Link href="/">
            <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white">
              Return to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Sign In Required
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please sign in to your account to request account deletion.
          </p>
          <Link href="/auth/login?next=/account/delete">
            <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-red-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to MornGPT</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Title Section */}
          <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-8 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Trash2 className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Delete Your Account</h1>
                <p className="text-red-100 mt-1">Request permanent account deletion</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* User Info */}
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Signed in as</p>
              <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
            </div>

            {/* Warning */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-semibold text-red-800 dark:text-red-300 mb-2">
                    Warning: This action cannot be undone
                  </h2>
                  <ul className="text-sm text-red-700 dark:text-red-400 space-y-2">
                    <li>All your chat history and conversations will be permanently deleted</li>
                    <li>All your bookmarks and saved content will be removed</li>
                    <li>Your account settings and preferences will be erased</li>
                    <li>Any active subscriptions will be cancelled</li>
                    <li>You will not be able to recover your account or data</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Data that will be deleted */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                The following data will be permanently deleted:
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  "Account information",
                  "Chat conversations",
                  "Messages history",
                  "Bookmarks",
                  "User preferences",
                  "Subscription data",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg"
                  >
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
              <input
                type="checkbox"
                id="confirm-delete"
                checked={confirmed}
                onChange={(e) => {
                  setConfirmed(e.target.checked);
                  setError(null);
                }}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="confirm-delete" className="text-sm text-gray-700 dark:text-gray-300">
                I understand that this action is <strong>permanent and irreversible</strong>.
                All my data will be deleted and cannot be recovered.
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link href="/" className="flex-1">
                <Button
                  variant="outline"
                  className="w-full h-12 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                  disabled={deleting}
                >
                  Cancel
                </Button>
              </Link>
              <Button
                onClick={handleDeleteAccount}
                disabled={deleting || !confirmed}
                className="flex-1 h-12 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Deleting Account...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete My Account
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            If you have any questions about account deletion, please contact us at{" "}
            <a href="mailto:support@morngpt.com" className="text-blue-600 dark:text-blue-400 hover:underline">
              support@morngpt.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
