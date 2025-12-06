// VoiceInputPanel component - handles voice input UI
import React from "react";

interface VoiceInputPanelProps {
  isListening: boolean;
  transcript: string;
  onStartListening: () => void;
  onStopListening: () => void;
  onUseTranscript: () => void;
  onClose: () => void;
}

export const VoiceInputPanel: React.FC<VoiceInputPanelProps> = ({
  isListening,
  transcript,
  onStartListening,
  onStopListening,
  onUseTranscript,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Voice Input</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="text-center space-y-6">
            {/* Microphone Visual */}
            <div className="flex justify-center">
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl transition-all ${
                  isListening
                    ? "bg-red-100 text-red-600 animate-pulse"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                🎤
              </div>
            </div>

            {/* Status Text */}
            <div>
              <p className="text-lg font-medium">
                {isListening ? "Listening..." : "Click to start speaking"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {isListening
                  ? "Speak clearly and we'll transcribe your words"
                  : "We'll convert your speech to text"}
              </p>
            </div>

            {/* Transcript Display */}
            {transcript && (
              <div className="bg-gray-50 rounded-lg p-4 text-left">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Transcript:
                </p>
                <p className="text-gray-800">{transcript}</p>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex justify-center space-x-4">
              {!isListening ? (
                <button
                  onClick={onStartListening}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start Listening
                </button>
              ) : (
                <button
                  onClick={onStopListening}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Stop Listening
                </button>
              )}
            </div>

            {/* Action Buttons */}
            {transcript && (
              <div className="flex justify-center space-x-3">
                <button
                  onClick={onUseTranscript}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Use This Text
                </button>
                <button
                  onClick={() =>
                    window.speechSynthesis.speak(
                      new SpeechSynthesisUtterance(transcript)
                    )
                  }
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Listen Back
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
