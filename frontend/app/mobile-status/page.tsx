'use client';

import { useState, useEffect } from 'react';

export default function MobileStatusPage() {
  const [status, setStatus] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      const statusData: any = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        screenSize: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        connection: (navigator as any).connection ? {
          effectiveType: (navigator as any).connection.effectiveType,
          downlink: (navigator as any).connection.downlink,
          rtt: (navigator as any).connection.rtt,
        } : 'Not available',
        location: window.location.href,
      };

      // Test API connectivity
      try {
        const startTime = Date.now();
        const response = await fetch('http://192.168.31.9:5000/api/chat/stream-guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId: 'mistral-small', message: 'Status test' }),
        });
        const endTime = Date.now();
        
        statusData.apiTest = {
          success: response.ok,
          status: response.status,
          responseTime: `${endTime - startTime}ms`,
          headers: Object.fromEntries(response.headers.entries()),
        };
      } catch (error: any) {
        statusData.apiTest = {
          success: false,
          error: error.message,
        };
      }

      setStatus(statusData);
      setLoading(false);
    };

    checkStatus();
  }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Mobile Status Check</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mobile Status Check</h1>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">Device Info</h3>
          <p><strong>Is Mobile:</strong> {status.isMobile ? '✅ Yes' : '❌ No'}</p>
          <p><strong>Screen Size:</strong> {status.screenSize}</p>
          <p><strong>Viewport:</strong> {status.viewport}</p>
          <p><strong>User Agent:</strong> <code className="text-xs">{status.userAgent}</code></p>
        </div>

        <div className="p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">Network Info</h3>
          <p><strong>Connection:</strong> {typeof status.connection === 'object' ? 
            `${status.connection.effectiveType} (${status.connection.downlink}Mbps, ${status.connection.rtt}ms RTT)` : 
            status.connection}</p>
          <p><strong>Current URL:</strong> {status.location}</p>
        </div>

        <div className="p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">API Test</h3>
          <p><strong>Status:</strong> {status.apiTest?.success ? '✅ Success' : '❌ Failed'}</p>
          <p><strong>Response Time:</strong> {status.apiTest?.responseTime || 'N/A'}</p>
          <p><strong>HTTP Status:</strong> {status.apiTest?.status || 'N/A'}</p>
          {status.apiTest?.error && (
            <p><strong>Error:</strong> <code className="text-red-600">{status.apiTest.error}</code></p>
          )}
        </div>

        <div className="p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">Quick Actions</h3>
          <div className="space-y-2">
            <a href="/" className="block bg-blue-500 text-white p-2 rounded text-center">
              Go to Main Chat
            </a>
            <a href="/test-mobile" className="block bg-green-500 text-white p-2 rounded text-center">
              Test Mobile API
            </a>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full bg-gray-500 text-white p-2 rounded"
            >
              Refresh Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
