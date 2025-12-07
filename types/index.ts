// Speech Recognition types
export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any)
    | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

export interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string;
  isMultiGPT?: boolean;
  isStreaming?: boolean;
  subTasks?: Array<{
    task: string;
    model: string;
    response: string;
  }>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  modelType: string;
  category: string;
  lastUpdated: Date;
  isModelLocked: boolean;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  bio?: string;
  isPro: boolean;
  isPaid: boolean;
   plan?: "Basic" | "Pro" | "Enterprise";
   planExp?: string;
  avatar?: string;
  settings?: {
    theme: "light" | "dark" | "auto";
    language: string;
    notifications: boolean;
    soundEnabled: boolean;
    autoSave: boolean;
    sendHotkey?: "enter" | "shift+enter" | "ctrl+enter" | "cmd+enter";
    shortcutsEnabled?: boolean;
    adsEnabled?: boolean;
  };
}

export interface BookmarkedMessage {
  id: string;
  messageId: string;
  chatId: string;
  title: string;
  content: string;
  timestamp: Date;
  customName?: string;
  folder?: string;
}

export interface BookmarkFolder {
  id: string;
  name: string;
  color?: string;
  createdAt: Date;
}

export interface ExternalModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  category: string;
  type: "free" | "premium" | "popular" | "paid";
  price: string;
}

export interface UserSettings {
  theme: "light" | "dark" | "auto";
  language: string;
  notifications: boolean;
  soundEnabled: boolean;
  autoSave: boolean;
  sendHotkey?: "enter" | "shift+enter" | "ctrl+enter" | "cmd+enter";
  shortcutsEnabled?: boolean;
  adsEnabled?: boolean;
}
