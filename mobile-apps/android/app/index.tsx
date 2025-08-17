import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { Card, Button, Chip, FAB } from 'react-native-paper';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo');

  const models = [
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model' },
    { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast and accurate' },
    { id: 'llama3.1-8b', name: 'Llama 3.1 8B', description: 'Open source' },
  ];

  const quickPrompts = [
    'Write a professional email',
    'Explain quantum computing',
    'Create a workout plan',
    'Help me learn a new language',
    'Write a creative story',
    'Analyze this data',
  ];

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Simulate API call to your backend
      const response = await fetch('http://localhost:5000/api/chat/stream-guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: selectedModel,
          message: inputText,
          language: 'en',
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response || 'Sorry, I couldn\'t process your request.',
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputText(prompt);
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#121212' : '#f5f5f5',
    },
    header: {
      padding: 20,
      paddingTop: 40,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: isDark ? '#ffffff' : '#000000',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: isDark ? '#b0b0b0' : '#666666',
      marginBottom: 20,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    modelSection: {
      marginBottom: 24,
    },
    modelTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#000000',
      marginBottom: 12,
    },
    modelChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    quickPromptsSection: {
      marginBottom: 24,
    },
    quickPromptsTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#ffffff' : '#000000',
      marginBottom: 12,
    },
    quickPromptsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
      borderRadius: 25,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: isDark ? '#404040' : '#e0e0e0',
    },
    textInput: {
      flex: 1,
      fontSize: 16,
      color: isDark ? '#ffffff' : '#000000',
      paddingVertical: 12,
    },
    sendButton: {
      marginLeft: 8,
      backgroundColor: '#007AFF',
      borderRadius: 20,
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    messagesContainer: {
      flex: 1,
      marginBottom: 20,
    },
    messageCard: {
      marginBottom: 12,
      backgroundColor: isDark ? '#2a2a2a' : '#ffffff',
    },
    userMessage: {
      backgroundColor: isDark ? '#007AFF' : '#007AFF',
      alignSelf: 'flex-end',
      marginLeft: 50,
    },
    assistantMessage: {
      backgroundColor: isDark ? '#404040' : '#f0f0f0',
      alignSelf: 'flex-start',
      marginRight: 50,
    },
    messageText: {
      color: isDark ? '#ffffff' : '#000000',
      fontSize: 16,
      lineHeight: 24,
    },
    userMessageText: {
      color: '#ffffff',
    },
    assistantMessageText: {
      color: isDark ? '#ffffff' : '#000000',
    },
    timestamp: {
      fontSize: 12,
      color: isDark ? '#888888' : '#666666',
      marginTop: 4,
    },
    fab: {
      position: 'absolute',
      margin: 16,
      right: 0,
      bottom: 0,
      backgroundColor: '#007AFF',
    },
  });

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>MornGPT</Text>
          <Text style={styles.subtitle}>Your AI assistant on mobile</Text>
        </View>

        {/* Model Selection */}
        <View style={styles.modelSection}>
          <Text style={styles.modelTitle}>Select Model</Text>
          <View style={styles.modelChips}>
            {models.map((model) => (
              <Chip
                key={model.id}
                selected={selectedModel === model.id}
                onPress={() => setSelectedModel(model.id)}
                style={{ marginBottom: 8 }}
              >
                {model.name}
              </Chip>
            ))}
          </View>
        </View>

        {/* Quick Prompts */}
        <View style={styles.quickPromptsSection}>
          <Text style={styles.quickPromptsTitle}>Quick Prompts</Text>
          <View style={styles.quickPromptsGrid}>
            {quickPrompts.map((prompt, index) => (
              <Chip
                key={index}
                onPress={() => handleQuickPrompt(prompt)}
                style={{ marginBottom: 8 }}
              >
                {prompt}
              </Chip>
            ))}
          </View>
        </View>

        {/* Messages */}
        <View style={styles.messagesContainer}>
          {messages.map((message) => (
            <Card
              key={message.id}
              style={[
                styles.messageCard,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage,
              ]}
            >
              <Card.Content>
                <Text
                  style={[
                    styles.messageText,
                    message.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
                  ]}
                >
                  {message.content}
                </Text>
                <Text style={styles.timestamp}>
                  {message.timestamp.toLocaleTimeString()}
                </Text>
              </Card.Content>
            </Card>
          ))}
          {isLoading && (
            <Card style={[styles.messageCard, styles.assistantMessage]}>
              <Card.Content>
                <Text style={styles.assistantMessageText}>Thinking...</Text>
              </Card.Content>
            </Card>
          )}
        </View>
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask me anything..."
          placeholderTextColor={isDark ? '#888888' : '#666666'}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendMessage}
          disabled={isLoading || !inputText.trim()}
        >
          <MaterialIcons
            name="send"
            size={20}
            color="#ffffff"
          />
        </TouchableOpacity>
      </View>

      {/* FAB for settings */}
      <FAB
        icon="settings"
        style={styles.fab}
        onPress={() => router.push('/settings')}
      />
    </KeyboardAvoidingView>
  );
}
