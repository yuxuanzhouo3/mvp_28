'use client';

import { useState } from 'react';
import { apiService } from '../../lib/api';

export default function TestStreaming() {
  const [status, setStatus] = useState<string>('');
  const [response, setResponse] = useState<string>('');
  const [chunks, setChunks] = useState<string[]>([]);

  const testStreaming = async () => {
    setStatus('Testing streaming...');
    setResponse('');
    setChunks([]);
    
    try {
      let streamedContent = '';
      let chunkCount = 0;
      
      await apiService.sendMessageStream(
        'Hello, test streaming!',
        'llama3.1-8b',
        undefined,
        undefined,
        'en',
        (chunk: string) => {
          chunkCount++;
          console.log(`Received chunk ${chunkCount}:`, chunk);
          setChunks(prev => [...prev, chunk]);
          streamedContent += chunk;
          setResponse(streamedContent);
          setStatus(`Streaming... (${chunkCount} chunks)`);
        },
        () => {
          setStatus(`Streaming completed! (${chunkCount} total chunks)`);
          console.log('Final content:', streamedContent);
        },
        (error) => {
          setStatus(`Streaming error: ${error}`);
          console.error('Streaming error:', error);
        }
      );
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Test error:', error);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Streaming Test</h1>
      
      <button
        onClick={testStreaming}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
      >
        Test Streaming
      </button>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Status: {status}</h2>
      </div>
      
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Response:</h3>
        <div className="bg-gray-100 p-4 rounded min-h-[100px]">
          <pre className="whitespace-pre-wrap">{response}</pre>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-2">Individual Chunks ({chunks.length}):</h3>
        <div className="bg-gray-100 p-4 rounded max-h-[300px] overflow-y-auto">
          {chunks.map((chunk, index) => (
            <div key={index} className="mb-1 p-1 bg-white rounded">
              <span className="text-sm text-gray-500">Chunk {index + 1}:</span> "{chunk}"
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
