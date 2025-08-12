'use client';

import { useState, useEffect } from 'react';
import { apiService, Model } from '../lib/api';

export default function ModelTest() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setLoading(true);
      const result = await apiService.getModels();
      
      if (result.success && result.data) {
        setModels(result.data);
        if (result.data.length > 0) {
          setSelectedModel(result.data[0].id);
        }
      } else {
        setError(result.error || 'Failed to load models');
      }
    } catch (err) {
      setError('Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedModel || !message.trim()) return;

    try {
      setSending(true);
      const result = await apiService.sendMessage(selectedModel, message);
      
      if (result.success && result.data) {
        setResponse(result.data.response);
      } else {
        setError(result.error || 'Failed to get response');
      }
    } catch (err) {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading models...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-semibold">Error</h3>
        <p className="text-red-600">{error}</p>
        <button 
          onClick={loadModels}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Test Chat with Free Models</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Select Model:</label>
        <select 
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} - {model.description}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Your Message:</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..."
          className="w-full p-3 border border-gray-300 rounded-md h-24"
        />
      </div>

      <button
        onClick={sendMessage}
        disabled={sending || !message.trim()}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
      >
        {sending ? 'Sending...' : 'Send Message'}
      </button>

      {response && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h3 className="font-semibold mb-2">AI Response:</h3>
          <p className="whitespace-pre-wrap">{response}</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="text-green-800 font-semibold">✅ Connected Models:</h3>
        <ul className="text-green-700 mt-2">
          {models.map((model) => (
            <li key={model.id}>• {model.name} ({model.provider})</li>
          ))}
        </ul>
      </div>
    </div>
  );
} 