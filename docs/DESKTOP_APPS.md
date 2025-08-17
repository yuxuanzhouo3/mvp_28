# MornGPT Desktop Applications

This document provides comprehensive information about the MornGPT desktop applications for Windows, macOS, and Linux.

## Overview

The MornGPT desktop applications provide a native, cross-platform experience for users who prefer desktop applications over web browsers. Built with Electron, these applications offer the same functionality as the web version with additional desktop-specific features.

## Features

### Core Features
- 💬 **Full Chat Functionality**: Complete AI chat experience with all models
- 🎨 **Native UI**: Platform-specific design and behavior
- 🔄 **Auto Updates**: Automatic updates for seamless experience
- ⚙️ **Settings Persistence**: Local settings storage
- 🔒 **Security**: Built with security best practices
- 📱 **Responsive Design**: Adapts to different screen sizes

### Desktop-Specific Features
- 🖥️ **System Integration**: Native menus, notifications, and shortcuts
- ⌨️ **Keyboard Shortcuts**: Full keyboard navigation support
- 🎯 **Window Management**: Minimize, maximize, and close controls
- 📋 **Clipboard Integration**: Easy copy/paste functionality
- 🔔 **System Notifications**: Native notification support
- 🚀 **Offline Capability**: Basic offline functionality (when implemented)

## System Requirements

### Windows
- **OS**: Windows 10 or later
- **Architecture**: x64, x86, or ARM64
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 100MB free disk space
- **Additional**: Visual C++ Redistributable (included in installer)

### macOS
- **OS**: macOS 11.0 (Big Sur) or later
- **Architecture**: Intel or Apple Silicon (M1/M2)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 100MB free disk space
- **Additional**: No additional requirements

### Linux
- **OS**: Ubuntu 20.04+ or equivalent
- **Architecture**: x64, ARM64, or ARMv7l
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 100MB free disk space
- **Additional**: 
  - For AppImage: `libfuse2`
  - For Snap: Snap daemon
  - For Flatpak: Flatpak runtime

## Installation

### macOS
1. **Download**: Get the appropriate DMG file for your Mac
   - Intel Mac: `MornGPT-1.0.0-mac-x64.dmg`
   - Apple Silicon: `MornGPT-1.0.0-mac-arm64.dmg`
   - Universal: `MornGPT-1.0.0-mac.dmg`

2. **Install**:
   - Double-click the DMG file to mount it
   - Drag MornGPT to your Applications folder
   - Eject the DMG file

3. **First Launch**: 
   - Right-click the app and select "Open" (bypasses Gatekeeper)
   - Or go to System Preferences > Security & Privacy > General

### Windows
1. **Download**: Get the appropriate EXE file for your Windows version
   - 64-bit: `MornGPT-Setup-1.0.0-x64.exe`
   - 32-bit: `MornGPT-Setup-1.0.0-ia32.exe`
   - ARM64: `MornGPT-Setup-1.0.0-arm64.exe`

2. **Install**:
   - Run the installer as administrator
   - Follow the installation wizard
   - Choose installation directory (optional)

3. **Launch**: 
   - Find MornGPT in the Start menu
   - Or use the desktop shortcut

### Linux
1. **Download**: Choose your preferred package format
   - AppImage: `MornGPT-1.0.0-x86_64.AppImage`
   - DEB: `MornGPT-1.0.0-amd64.deb`
   - Snap: Available in Snap Store
   - Flatpak: Available in Flathub

2. **Install**:
   - **AppImage**: 
     ```bash
     chmod +x MornGPT-*.AppImage
     ./MornGPT-*.AppImage
     ```
   - **DEB**: 
     ```bash
     sudo dpkg -i MornGPT-*.deb
     sudo apt-get install -f  # Fix dependencies if needed
     ```
   - **Snap**: 
     ```bash
     sudo snap install morngpt
     ```
   - **Flatpak**: 
     ```bash
     flatpak install flathub com.morngpt.desktop
     ```

## Development

### Project Structure
```
desktop-apps/
├── main.js              # Main Electron process
├── preload.js           # Preload script for security
├── package.json         # Dependencies and build config
├── assets/              # Icons and resources
│   ├── icon.svg         # Application icon
│   ├── icon.icns        # macOS icon
│   ├── icon.ico         # Windows icon
│   └── icon.png         # Linux icon
├── build.sh             # Build script
└── dist/                # Built applications
```

### Development Setup
1. **Clone and Install**:
   ```bash
   cd desktop-apps
   npm install
   ```

2. **Start Development**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   ./build.sh
   ```

### Build Commands
- `npm start` - Start the application
- `npm run dev` - Start in development mode
- `npm run build:mac` - Build for macOS
- `npm run build:win` - Build for Windows
- `npm run build:linux` - Build for Linux
- `npm run build:all` - Build for all platforms

## Configuration

### Build Configuration
The application is configured through `package.json`:

```json
{
  "build": {
    "appId": "com.morngpt.desktop",
    "productName": "MornGPT",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "renderer/**/*",
      "assets/**/*"
    ]
  }
}
```

### Platform-Specific Settings
- **macOS**: DMG installer, universal binary support
- **Windows**: NSIS installer, portable EXE option
- **Linux**: Multiple package formats (AppImage, DEB, Snap, Flatpak)

## Security Features

### Built-in Security
- **Context Isolation**: Prevents direct access to Node.js APIs
- **Node Integration Disabled**: No direct Node.js access from renderer
- **Remote Module Disabled**: Prevents loading remote content
- **External Links**: Opens in default browser
- **Secure IPC**: Protected inter-process communication

### Code Signing
- **macOS**: Notarization required for distribution
- **Windows**: Code signing recommended
- **Linux**: GPG signing for packages

## Distribution

### macOS Distribution
1. **Build**: `npm run build:mac`
2. **Notarize**: Required for distribution outside App Store
3. **Distribute**: DMG files or App Store

### Windows Distribution
1. **Build**: `npm run build:win`
2. **Code Sign**: Recommended for user trust
3. **Distribute**: EXE installers or Microsoft Store

### Linux Distribution
1. **Build**: `npm run build:linux`
2. **Package**: Multiple formats for different distributions
3. **Distribute**: Package repositories or direct downloads

## Troubleshooting

### Common Issues

#### macOS
- **"App is damaged"**: Right-click > Open to bypass Gatekeeper
- **Build fails**: Install Xcode Command Line Tools
- **Notarization fails**: Check Apple Developer account and certificates

#### Windows
- **Installation fails**: Run as administrator
- **Build fails**: Install Visual Studio Build Tools
- **App doesn't start**: Check Windows Defender settings

#### Linux
- **AppImage doesn't run**: Install `libfuse2`
- **DEB installation fails**: Check dependencies
- **Snap issues**: Check snap daemon status

### Debug Mode
Enable debug mode by running:
```bash
npm run dev
```

This provides:
- Developer tools
- Console logging
- Hot reloading
- Error details

## API Integration

### Backend Connection
The desktop app connects to the same backend as the web version:
- **Development**: `http://localhost:5000`
- **Production**: `https://morngpt.com`

### Authentication
- Uses the same authentication system as web version
- Stores tokens securely using Electron's secure storage
- Supports all user features (chat, models, settings)

## Performance

### Optimization
- **Lazy Loading**: Components loaded on demand
- **Memory Management**: Efficient resource usage
- **Caching**: Local storage for frequently used data
- **Updates**: Delta updates to minimize download size

### Monitoring
- **Memory Usage**: Built-in memory monitoring
- **Performance Metrics**: CPU and memory tracking
- **Error Reporting**: Automatic error reporting (when implemented)

## Future Enhancements

### Planned Features
- 🔄 **Offline Mode**: Basic offline functionality
- 📱 **Mobile Sync**: Sync with mobile apps
- 🎨 **Custom Themes**: User-defined themes
- 🔌 **Plugin System**: Extensible functionality
- 🌐 **Multi-language**: Internationalization support

### Technical Improvements
- **Performance**: Further optimization
- **Security**: Enhanced security features
- **Accessibility**: Better accessibility support
- **Testing**: Comprehensive test suite

## Support

### Getting Help
- **Documentation**: This document and README files
- **Issues**: GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for questions
- **Email**: support@morngpt.com

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on all platforms
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Version History

### v1.0.0 (Current)
- Initial release
- Cross-platform support
- Basic chat functionality
- Auto-update system
- Native UI integration

---

For more information, visit [https://morngpt.com](https://morngpt.com)
