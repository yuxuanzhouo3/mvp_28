'use client';

import { useState } from 'react';
import { apiService } from '../../lib/api';

export default function TestConnection() {
  const [status, setStatus] = useState<string>('');
  const [response, setResponse] = useState<string>('');

  const testBackendConnection = async () => {
    setStatus('Testing connection...');
    try {
      const result = await apiService.sendMessage('Hello, test message!', 'llama3.1-8b');
      setStatus('Success!');
      setResponse(JSON.stringify(result, null, 2));
    } catch (error) {
      setStatus('Error!');
      setResponse(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testStreamingConnection = async () => {
    setStatus('Testing streaming...');
    setResponse('');
    
    try {
      let streamedContent = '';
      await apiService.sendMessageStream(
        'Hello, streaming test!',
        'llama3.1-8b',
        undefined,
        undefined,
        'en',
        (chunk) => {
          streamedContent += chunk;
          setResponse(streamedContent);
        },
        () => {
          setStatus('Streaming completed!');
        },
        (error) => {
          setStatus('Streaming error!');
          setResponse(error);
        }
      );
    } catch (error) {
      setStatus('Error!');
      setResponse(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Backend Connection Test</h1>
      
      <div className="space-y-4">
        <button
          onClick={testBackendConnection}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Test Regular Connection
        </button>
        
        <button
          onClick={testStreamingConnection}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ml-4"
        >
          Test Streaming Connection
        </button>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Status: {status}</h2>
        <div className="bg-gray-100 p-4 rounded">
          <pre className="whitespace-pre-wrap">{response}</pre>
        </div>
      </div>
    </div>
  );
}
