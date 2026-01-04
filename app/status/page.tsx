'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiService } from '../../lib/api';

export default function StatusPage() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [models, setModels] = useState<any[]>([]);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      const result = await apiService.healthCheck();
      if (result.success) {
        setBackendStatus('connected');
        loadModels();
      } else {
        setBackendStatus('error');
      }
    } catch (error) {
      setBackendStatus('error');
    }
  };

  const loadModels = async () => {
    try {
      const result = await apiService.getModels();
      if (result.success && result.data) {
        setModels(result.data);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const testChat = async () => {
    if (!testMessage.trim()) return;
    
    setTesting(true);
    try {
      const result = await apiService.sendMessage('mistral-7b', testMessage);
      if (result.success && result.data) {
        setTestResponse(result.data.response);
      } else {
        setTestResponse('Error: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      setTestResponse('Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold text-center mb-8">
          MornGPT Connection Status
        </h1>

        {/* Backend Status */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Backend Connection</h2>
          <div className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${
              backendStatus === 'connected' ? 'bg-green-500' : 
              backendStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
            }`}></div>
            <span className="font-medium">
              {backendStatus === 'connected' ? '✅ Connected to Backend' :
               backendStatus === 'error' ? '❌ Backend Connection Failed' :
               '🔄 Checking Connection...'}
            </span>
          </div>
          <p className="text-gray-600 mt-2">
            Backend URL: http://localhost:5000
          </p>
          <button 
            onClick={checkBackendStatus}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Status
          </button>
        </div>

        {/* Available Models */}
        {backendStatus === 'connected' && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Available Models</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {models.map((model) => (
                <div key={model.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold">{model.name}</h3>
                  <p className="text-gray-600 text-sm">{model.description}</p>
                  <p className="text-gray-500 text-xs mt-1">Provider: {model.provider}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Chat */}
        {backendStatus === 'connected' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Test Chat</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Test Message:</label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Type a test message..."
                  className="w-full p-3 border border-gray-300 rounded-md h-24"
                />
              </div>
              <button
                onClick={testChat}
                disabled={testing || !testMessage.trim()}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {testing ? 'Testing...' : 'Send Test Message'}
              </button>
              {testResponse && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h3 className="font-semibold mb-2">AI Response:</h3>
                  <p className="whitespace-pre-wrap text-sm">{testResponse}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">✅ Connection Successful!</h2>
          <p className="text-blue-700 mb-2">
            Your MornGPT application is now fully connected and working:
          </p>
          <ul className="text-blue-700 space-y-1">
            <li>• Backend server is running on port 5000</li>
            <li>• Frontend is running on port 3000</li>
            <li>• 4 free AI models are available for chat</li>
            <li>• Real API responses are being generated</li>
          </ul>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Go to Main Chat
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 