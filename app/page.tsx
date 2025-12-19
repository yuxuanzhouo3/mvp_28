"use client";

/**
 * Copyright © 2025 Yuxuan Zhou. All rights reserved.
 *
 * This file is part of the MornGPT Homepage application.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 */

import React from "react";
import dynamic from "next/dynamic";

// Dynamically import the main component with SSR disabled
const MornGPTHomepage = dynamic(() => import("../components/MornGPTHomepage"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading MornGPT...</p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <MornGPTHomepage />;
}
