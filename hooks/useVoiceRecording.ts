import { useState, useRef, useCallback } from "react";

export const useVoiceRecording = (selectedLanguage: string) => {
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string>("");
  const recognition = useRef<any>(null);

  const initializeSpeechRecognition = useCallback(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang =
          selectedLanguage === "zh" ? "zh-CN" : "en-US";
        recognitionInstance.maxAlternatives = 1;

        recognitionInstance.onresult = (event) => {
          console.log("Speech recognition result received:", event.results);
          let finalTranscript = "";
          let interimTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(
              `Result ${i}: ${transcript} (final: ${event.results[i].isFinal})`
            );
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Show interim results in real-time
          if (interimTranscript) {
            // This will be handled by the parent component
          }

          // Add final results to the prompt
          if (finalTranscript) {
            console.log("Adding final transcript:", finalTranscript);
            // This will be handled by the parent component
          }
        };

        recognitionInstance.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          let errorMessage = `Speech recognition error: ${event.error}`;

          // Provide more helpful error messages
          switch (event.error) {
            case "network":
              errorMessage =
                "Network error. Speech recognition service may not be available in your region. Please try again later.";
              break;
            case "not-allowed":
              errorMessage =
                "Microphone access denied. Please allow microphone permissions in your browser settings.";
              break;
            case "no-speech":
              errorMessage = "No speech detected. Please try speaking again.";
              break;
            case "audio-capture":
              errorMessage =
                "Audio capture error. Please check your microphone and try again.";
              break;
            case "service-not-allowed":
              errorMessage =
                "Speech recognition service not allowed. Please check your browser settings.";
              break;
            case "bad-grammar":
              errorMessage =
                "Speech recognition grammar error. Please try again.";
              break;
            case "language-not-supported":
              errorMessage =
                "Language not supported. Please try with English or Chinese.";
              break;
            default:
              errorMessage = `Speech recognition error: ${event.error}. Please try again.`;
          }

          setVoiceError(errorMessage);
          setIsRecording(false);

          // Clear any existing recognition instance on error
          if (recognitionInstance) {
            try {
              recognitionInstance.stop();
            } catch (stopError) {
              console.error("Error stopping recognition on error:", stopError);
            }
          }

          setTimeout(() => setVoiceError(""), 8000); // Show error longer for network issues
        };

        recognitionInstance.onend = () => {
          console.log("Speech recognition ended");
          setIsRecording(false);
        };

        (recognitionInstance as any).onstart = () => {
          console.log("Speech recognition started successfully");
          setIsRecording(true);
          setVoiceError(""); // Clear any previous errors
        };

        (recognitionInstance as any).onaudiostart = () => {
          console.log("Audio capture started");
        };

        (recognitionInstance as any).onaudioend = () => {
          console.log("Audio capture ended");
        };

        (recognitionInstance as any).onsoundstart = () => {
          console.log("Sound detected");
        };

        (recognitionInstance as any).onsoundend = () => {
          console.log("Sound ended");
        };

        (recognitionInstance as any).onspeechstart = () => {
          console.log("Speech started");
        };

        (recognitionInstance as any).onspeechend = () => {
          console.log("Speech ended");
        };

        recognition.current = recognitionInstance;
        return recognitionInstance;
      } else {
        setVoiceError(
          "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari."
        );
        setTimeout(() => setVoiceError(""), 5000);
        return null;
      }
    }
    return null;
  }, [selectedLanguage]);

  const startVoiceRecording = useCallback(() => {
    setVoiceError("");

    // Check if we're on HTTPS (required for speech recognition)
    if (
      typeof window !== "undefined" &&
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost"
    ) {
      setVoiceError(
        "Speech recognition requires HTTPS. Please use the secure version of this site."
      );
      setTimeout(() => setVoiceError(""), 5000);
      return;
    }

    // Check if speech recognition is supported
    if (
      typeof window !== "undefined" &&
      !window.SpeechRecognition &&
      !window.webkitSpeechRecognition
    ) {
      setVoiceError(
        "Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari."
      );
      setTimeout(() => setVoiceError(""), 5000);
      return;
    }

    // Set a timeout to handle network issues
    const networkTimeout = setTimeout(() => {
      if (isRecording) {
        setVoiceError(
          "Network timeout. Speech recognition may not be available in your region."
        );
        setIsRecording(false);

        // Clear any existing recognition instance
        if (recognition.current) {
          try {
            recognition.current.stop();
          } catch (error) {
            console.error("Error stopping recognition on timeout:", error);
          }
        }

        setTimeout(() => setVoiceError(""), 5000);
      }
    }, 5000);

    if (!recognition.current) {
      const newRecognition = initializeSpeechRecognition();
      if (newRecognition) {
        try {
          newRecognition.start();
          // Don't set isRecording here - wait for onstart event
          clearTimeout(networkTimeout); // Clear timeout on success
        } catch (error) {
          console.error("Error starting speech recognition:", error);
          setVoiceError("Failed to start voice recording. Please try again.");
          setTimeout(() => setVoiceError(""), 5000);
          clearTimeout(networkTimeout);
        }
      }
    } else {
      try {
        recognition.current.start();
        // Don't set isRecording here - wait for onstart event
        clearTimeout(networkTimeout); // Clear timeout on success
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        setVoiceError("Failed to start voice recording. Please try again.");
        setTimeout(() => setVoiceError(""), 5000);
        clearTimeout(networkTimeout);
      }
    }
  }, [isRecording, initializeSpeechRecognition]);

  const stopVoiceRecording = useCallback(() => {
    if (recognition.current) {
      try {
        recognition.current.stop();
        setIsRecording(false);
      } catch (error) {
        console.error("Error stopping speech recognition:", error);
        setVoiceError("Failed to stop voice recording");
        setTimeout(() => setVoiceError(""), 5000);
      }
    }
  }, []);

  const toggleVoiceRecording = useCallback(() => {
    if (isRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  }, [isRecording, startVoiceRecording, stopVoiceRecording]);

  // Manual reset function for stuck recording state
  const resetVoiceRecording = useCallback(() => {
    console.log("Manually resetting voice recording state");
    setIsRecording(false);
    setVoiceError("");
    if (recognition.current) {
      try {
        recognition.current.stop();
      } catch (error) {
        console.error("Error stopping recognition during reset:", error);
      }
    }
  }, []);

  return {
    isRecording,
    voiceError,
    startVoiceRecording,
    stopVoiceRecording,
    toggleVoiceRecording,
    resetVoiceRecording,
  };
};
