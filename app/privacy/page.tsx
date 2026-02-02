"use client";

import { PrivacyPolicyContent } from "@/components/legal";
import { useLanguage } from "@/context/LanguageContext";

export default function PrivacyPage() {
  const { isDomesticVersion } = useLanguage();
  const isDomestic = isDomesticVersion;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8">
          <PrivacyPolicyContent isDomestic={isDomestic} />
        </div>
      </div>
    </div>
  );
}
