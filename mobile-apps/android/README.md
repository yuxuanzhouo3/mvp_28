# MornGPT Mobile App

A React Native mobile application for MornGPT, built with Expo.

## Features

- 🤖 AI Chat Interface
- 🌙 Dark/Light Mode
- 📱 Cross-platform (iOS & Android)
- ⚡ Real-time messaging
- 🔧 Customizable settings
- 📤 Data export/import
- 🔔 Push notifications

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Expo CLI globally:
```bash
npm install -g @expo/cli
```

## Development

### Start Development Server
```bash
npm start
```

### Run on Android
```bash
npm run android
```

### Run on iOS
```bash
npm run ios
```

### Run on Web
```bash
npm run web
```

## Building

### Android APK
```bash
npm run build:android
```

### iOS IPA
```bash
npm run build:ios
```

## Configuration

### Environment Variables
Create a `.env` file in the root directory:
```
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_APP_NAME=MornGPT
```

### API Configuration
Update the API endpoint in `app/index.tsx`:
```javascript
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
```

## Project Structure

```
mobile-apps/android/
├── app/
│   ├── _layout.tsx      # Root layout
│   ├── index.tsx        # Home screen
│   └── settings.tsx     # Settings screen
├── assets/              # Images and icons
├── app.json            # Expo configuration
├── package.json        # Dependencies
├── eas.json           # Build configuration
└── README.md          # This file
```

## Deployment

### Android
1. Build APK:
```bash
eas build --platform android --profile production
```

2. Download and distribute the APK file.

### iOS
1. Build for App Store:
```bash
eas build --platform ios --profile production
```

2. Submit to App Store:
```bash
eas submit --platform ios
```

## Troubleshooting

### Common Issues

1. **Metro bundler issues**: Clear cache with `npx expo start --clear`
2. **Build failures**: Check EAS build logs for specific errors
3. **API connection**: Ensure backend server is running and accessible

### Support

For issues and questions, please refer to:
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

## License

This project is licensed under the MIT License.
