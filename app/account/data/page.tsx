"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Database,
  MessageSquare,
  Bookmark,
  Settings,
  ArrowLeft,
  LogIn,
  Check,
  AlertTriangle,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/context/LanguageContext";
import Link from "next/link";

interface DataOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  key: "conversations" | "messages" | "bookmarks" | "settings";
}

const dataOptions: DataOption[] = [
  {
    id: "conversations",
    label: "Chat Conversations",
    description: "All your chat sessions and conversation history",
    icon: <MessageSquare className="w-5 h-5" />,
    key: "conversations",
  },
  {
    id: "messages",
    label: "Messages",
    description: "Individual messages within conversations",
    icon: <MessageSquare className="w-5 h-5" />,
    key: "messages",
  },
  {
    id: "bookmarks",
    label: "Bookmarks & Saved Items",
    description: "Your saved conversations and bookmarked content",
    icon: <Bookmark className="w-5 h-5" />,
    key: "bookmarks",
  },
  {
    id: "settings",
    label: "Preferences & Settings",
    description: "Your personalized app settings and preferences",
    icon: <Settings className="w-5 h-5" />,
    key: "settings",
  },
];

export default function ManageDataPage() {
  const router = useRouter();
  const { isDomesticVersion } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string[] | null>(null);

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

  const toggleOption = (id: string) => {
    const newSelected = new Set(selectedOptions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedOptions(newSelected);
    setError(null);
    setSuccess(null);
  };

  const handleDeleteData = async () => {
    if (selectedOptions.size === 0) {
      setError("Please select at least one data type to delete.");
      return;
    }

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const body: Record<string, boolean> = {};
      selectedOptions.forEach((id) => {
        const option = dataOptions.find((o) => o.id === id);
        if (option) {
          body[option.key] = true;
        }
      });

      const response = await fetch("/api/account/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok || response.status === 207) {
        setSuccess(data.deleted || []);
        setSelectedOptions(new Set());
        if (data.errors?.length > 0) {
          setError(`Some data could not be deleted: ${data.errors.join(", ")}`);
        }
      } else {
        setError(data.error || "Failed to delete data. Please try again.");
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
            Please sign in to your account to manage your data.
          </p>
          <Link href="/auth/login?next=/account/data">
            <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
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
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-8 text-white">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Database className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Manage Your Data</h1>
                <p className="text-blue-100 mt-1">Delete specific data without removing your account</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* User Info */}
            <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Signed in as</p>
              <p className="font-medium text-gray-900 dark:text-white">{user.email}</p>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Select the data you want to delete. Your account will remain active,
                and you can continue using MornGPT with a fresh start.
              </p>
            </div>

            {/* Data Options */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Select data to delete:
              </h3>
              {dataOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => toggleOption(option.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    selectedOptions.has(option.id)
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${
                    selectedOptions.has(option.id)
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}>
                    {option.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`font-medium ${
                      selectedOptions.has(option.id)
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-900 dark:text-white"
                    }`}>
                      {option.label}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {option.description}
                    </p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedOptions.has(option.id)
                      ? "border-blue-500 bg-blue-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}>
                    {selectedOptions.has(option.id) && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Warning */}
            {selectedOptions.size > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    This action cannot be undone. The selected data will be permanently deleted.
                  </p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && success.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Successfully deleted: {success.join(", ")}
                  </p>
                </div>
              </div>
            )}

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
                onClick={handleDeleteData}
                disabled={deleting || selectedOptions.size === 0}
                className="flex-1 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected Data
                  </>
                )}
              </Button>
            </div>

            {/* Link to full account deletion */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Want to delete your entire account?{" "}
                <Link href="/account/delete" className="text-red-600 dark:text-red-400 hover:underline">
                  Delete Account
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            If you have any questions about data management, please contact us at{" "}
            <a href="mailto:support@morngpt.com" className="text-blue-600 dark:text-blue-400 hover:underline">
              support@morngpt.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
