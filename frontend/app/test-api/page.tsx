'use client'

import { useState, useEffect } from 'react'
import { apiService } from '../../lib/api'

export default function TestApiPage() {
  const [models, setModels] = useState<any[]>([])
  const [testMessage, setTestMessage] = useState('Hello, are you working?')
  const [testResponse, setTestResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      const result = await apiService.getModels()
      console.log('Models result:', result)
      if (result.success && result.data) {
        setModels(result.data)
      } else {
        setError('Failed to load models: ' + result.error)
      }
    } catch (err) {
      setError('Error loading models: ' + err)
    }
  }

  const testChat = async () => {
    setLoading(true)
    setError('')
    try {
      console.log('Testing chat with message:', testMessage)
      const result = await apiService.sendMessage('mistral-7b', testMessage)
      console.log('Chat result:', result)
      if (result.success && result.data) {
        setTestResponse(result.data.response)
      } else {
        setError('Chat failed: ' + result.error)
      }
    } catch (err) {
      setError('Error testing chat: ' + err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">API Connection Test</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Available Models</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((model, index) => (
            <div key={index} className="border p-4 rounded-lg">
              <h3 className="font-semibold">{model.name}</h3>
              <p className="text-sm text-gray-600">{model.description}</p>
              <p className="text-xs text-gray-500">Provider: {model.provider}</p>
              <p className="text-xs text-gray-500">ID: {model.id}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Chat</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Message:</label>
            <input
              type="text"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <button
            onClick={testChat}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Chat'}
          </button>
          {testResponse && (
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <h3 className="font-semibold mb-2">Response:</h3>
              <p>{testResponse}</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h3 className="font-semibold">Error:</h3>
          <p>{error}</p>
        </div>
      )}
    </div>
  )
} 