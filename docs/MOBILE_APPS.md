# MornGPT Mobile Apps Documentation

## Overview

MornGPT mobile apps provide a native experience for iOS and Android users, offering the same powerful AI capabilities as the web version with mobile-optimized features.

## Features

### Core Features
- 🤖 **AI Chat Interface** - Full conversation capabilities with all supported models
- 🌙 **Dark/Light Mode** - Automatic theme switching based on system preferences
- 📱 **Cross-platform** - Native iOS and Android apps
- ⚡ **Real-time Messaging** - Instant responses with streaming support
- 🔧 **Customizable Settings** - User preferences and app configuration
- 📤 **Data Export/Import** - Backup and restore chat history
- 🔔 **Push Notifications** - Stay updated with new features and responses

### Mobile-Specific Features
- **Offline Support** - View previous conversations without internet
- **Voice Input** - Speech-to-text for hands-free interaction
- **Share Integration** - Share conversations and responses
- **Haptic Feedback** - Tactile responses for better UX
- **Biometric Authentication** - Secure access with Face ID/Touch ID
- **Widget Support** - Quick access from home screen

## Technical Architecture

### Technology Stack
- **Framework**: React Native with Expo
- **Language**: TypeScript
- **UI Library**: React Native Paper
- **Navigation**: Expo Router
- **State Management**: React Hooks
- **API Communication**: Fetch API with streaming support

### Project Structure
```
mobile-apps/
├── android/                 # Android app
│   ├── app/
│   │   ├── _layout.tsx     # Root layout
│   │   ├── index.tsx       # Home screen
│   │   └── settings.tsx    # Settings screen
│   ├── app.json           # Expo configuration
│   ├── package.json       # Dependencies
│   └── eas.json          # Build configuration
├── ios/                   # iOS app
│   ├── app.json          # Expo configuration
│   └── package.json      # Dependencies
├── build.sh              # Production build script
├── build-local.sh        # Development build script
└── README.md             # Build instructions
```

## Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Development Setup
1. **Install Expo CLI**:
   ```bash
   npm install -g @expo/cli
   ```

2. **Install Dependencies**:
   ```bash
   cd mobile-apps/android
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm start
   ```

4. **Run on Device/Simulator**:
   ```bash
   # Android
   npm run android
   
   # iOS
   npm run ios
   ```

## Building for Production

### Android APK
```bash
# Using EAS Build (recommended)
cd mobile-apps
./build.sh

# Using local build
cd mobile-apps
./build-local.sh
```

### iOS IPA
```bash
# Using EAS Build (recommended)
cd mobile-apps
./build.sh

# Using local build (requires Xcode)
cd mobile-apps
./build-local.sh
```

## API Integration

### Backend Connection
The mobile apps connect to the MornGPT backend API:

```typescript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

// Chat endpoint
const response = await fetch(`${API_BASE_URL}/api/chat/stream-guest`, {
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
```

### Supported Models
- GPT-3.5 Turbo
- GPT-4o
- Claude 3 Haiku
- Claude 3.5 Sonnet
- Llama 3.1 8B
- Mistral 7B
- And more...

## User Interface

### Home Screen
- **Model Selection** - Choose from available AI models
- **Quick Prompts** - Pre-defined prompts for common tasks
- **Chat Interface** - Real-time conversation with AI
- **Settings Access** - Quick access to app settings

### Settings Screen
- **Preferences** - Notifications, theme, auto-save
- **Data Management** - Export/import, clear data
- **Support** - Help, contact, ratings
- **About** - App information and legal

### Design System
- **Material Design 3** - Modern, accessible design
- **Responsive Layout** - Adapts to different screen sizes
- **Accessibility** - Screen reader support, high contrast
- **Internationalization** - Multi-language support

## Security & Privacy

### Data Protection
- **Local Storage** - Chat history stored locally
- **Secure Communication** - HTTPS API calls
- **No Data Collection** - Minimal analytics
- **User Control** - Full control over data export/deletion

### Authentication
- **Optional Login** - Use without account creation
- **Biometric Auth** - Secure access with Face ID/Touch ID
- **Session Management** - Automatic session handling

## Performance Optimization

### Loading Times
- **Lazy Loading** - Load components on demand
- **Image Optimization** - Compressed assets
- **Caching** - Local storage for faster access
- **Background Processing** - Non-blocking operations

### Memory Management
- **Efficient Rendering** - Optimized list rendering
- **Memory Cleanup** - Automatic garbage collection
- **Resource Management** - Proper cleanup of resources

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

## Deployment

### Android
1. **Build APK**:
   ```bash
   eas build --platform android --profile production
   ```

2. **Download APK**:
   - From EAS dashboard
   - Or use the build script

3. **Distribute**:
   - Direct download from website
   - Google Play Store (optional)

### iOS
1. **Build IPA**:
   ```bash
   eas build --platform ios --profile production
   ```

2. **Download IPA**:
   - From EAS dashboard
   - Or use the build script

3. **Distribute**:
   - Direct download from website
   - App Store (optional)

## Troubleshooting

### Common Issues

#### Build Failures
- **Dependencies**: Ensure all dependencies are installed
- **Environment**: Check Node.js and Expo CLI versions
- **Permissions**: Verify file permissions on build scripts

#### Runtime Errors
- **API Connection**: Check backend server status
- **Network**: Verify internet connectivity
- **Storage**: Ensure sufficient device storage

#### Performance Issues
- **Memory**: Close other apps to free memory
- **Cache**: Clear app cache in settings
- **Updates**: Keep app updated to latest version

### Debug Commands
```bash
# Clear Expo cache
npx expo start --clear

# Reset Metro bundler
npx expo start --reset-cache

# Check device logs
npx expo logs

# Run on specific device
npx expo run:android --device
```

## Support & Maintenance

### Updates
- **Automatic Updates** - Via app stores
- **Manual Updates** - Direct download from website
- **Version Control** - Git-based development workflow

### Support Channels
- **In-app Support** - Built-in help system
- **Email Support** - support@morngpt.com
- **Documentation** - Comprehensive guides
- **Community** - User forums and discussions

### Monitoring
- **Crash Reporting** - Automatic error tracking
- **Analytics** - Usage statistics (optional)
- **Performance** - App performance monitoring
- **User Feedback** - In-app feedback system

## Future Enhancements

### Planned Features
- **Offline AI** - Local model support
- **Voice Chat** - Real-time voice conversations
- **Image Recognition** - Visual AI capabilities
- **Multi-language** - Enhanced language support
- **Widgets** - Home screen widgets
- **Shortcuts** - Siri/Google Assistant integration

### Technical Improvements
- **PWA Support** - Progressive Web App features
- **Cross-platform** - Desktop app support
- **Cloud Sync** - Multi-device synchronization
- **Advanced Security** - End-to-end encryption
- **Performance** - Further optimization

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Contributing

We welcome contributions! Please see CONTRIBUTING.md for guidelines.

---

For more information, visit [morngpt.com](https://morngpt.com) or contact support@morngpt.com
