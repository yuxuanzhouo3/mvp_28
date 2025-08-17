'use client';

import { useState } from 'react';
import { ApiService } from '../../lib/api';

export default function TestMobilePage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testApi = async () => {
    setLoading(true);
    setResult('Testing...');
    
    try {
      const apiService = new ApiService();
      console.log('API Base URL:', apiService['baseUrl']);
      
      const response = await apiService.sendMessageStream(
        'Hello from mobile test',
        'mistral-small',
        undefined,
        undefined,
        (chunk: string) => {
          setResult(prev => prev + chunk);
        },
        () => {
          setResult(prev => prev + '\n\n✅ Test completed!');
          setLoading(false);
        },
        (error: string) => {
          setResult(prev => prev + `\n\n❌ Error: ${error}`);
          setLoading(false);
        }
      );
      
      console.log('API Response:', response);
    } catch (error) {
      console.error('Test failed:', error);
      setResult(`❌ Test failed: ${error}`);
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Mobile API Test</h1>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">User Agent: {navigator.userAgent}</p>
        <p className="text-sm text-gray-600 mb-2">Is Mobile: {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'Yes' : 'No'}</p>
      </div>
      
      <button 
        onClick={testApi}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test API'}
      </button>
      
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">Result:</h3>
        <pre className="whitespace-pre-wrap text-sm">{result || 'No result yet'}</pre>
      </div>
    </div>
  );
}
