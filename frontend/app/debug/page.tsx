'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DebugPage() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (log: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${log}`]);
  };

  const testApiConnection = async () => {
    setLoading(true);
    setResponse('');
    setLogs([]);
    
    try {
      addLog('Starting API test...');
      
      // Test 1: Check if we can reach the API
      addLog('Testing API endpoint...');
      const testResponse = await fetch('/api/chat/stream-guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: 'mistral-small',
          message: message || 'Hello from debug test'
        })
      });

      addLog(`Response status: ${testResponse.status}`);
      addLog(`Response headers: ${JSON.stringify(Object.fromEntries(testResponse.headers.entries()))}`);

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        addLog(`Error response: ${errorText}`);
        throw new Error(`HTTP error! status: ${testResponse.status}`);
      }

      addLog('Response OK, starting to read stream...');

      const reader = testResponse.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          addLog('Stream completed');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            addLog(`Received data: ${data}`);
            
            if (data === '[DONE]') {
              addLog('Stream ended with [DONE]');
              setResponse(fullResponse);
              setLoading(false);
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.chunk) {
                fullResponse += parsed.chunk;
                setResponse(fullResponse);
                addLog(`Added chunk: "${parsed.chunk}"`);
              }
            } catch (e) {
              addLog(`Failed to parse data: ${data}`);
            }
          }
        }
      }

      setResponse(fullResponse);
      addLog('Test completed successfully');
    } catch (error) {
      console.error('API test failed:', error);
      addLog(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>API Debug Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Test Message:</label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter a test message"
            />
          </div>

          <Button 
            onClick={testApiConnection} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Testing...' : 'Test API Connection'}
          </Button>

          {response && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Response:</label>
              <div className="p-3 bg-gray-100 rounded-md text-sm">
                {response}
              </div>
            </div>
          )}

          {logs.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Debug Logs:</label>
              <div className="p-3 bg-gray-100 rounded-md text-sm max-h-60 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
