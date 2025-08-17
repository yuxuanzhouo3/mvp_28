# MornGPT Desktop Application

A cross-platform desktop application for MornGPT, built with Electron.

## Features

- 🚀 **Cross-platform**: Windows, macOS, and Linux support
- 💬 **Real-time Chat**: Full chat functionality with AI models
- 🎨 **Native UI**: Native desktop experience with system integration
- 🔄 **Auto Updates**: Automatic updates for seamless experience
- ⚙️ **Settings**: Persistent settings and preferences
- 📱 **Responsive**: Adapts to different screen sizes
- 🔒 **Secure**: Built with security best practices

## System Requirements

### Windows
- Windows 10 or later
- x64, x86, or ARM64 architecture
- 4GB RAM minimum, 8GB recommended
- 100MB free disk space

### macOS
- macOS 11.0 (Big Sur) or later
- Intel or Apple Silicon (M1/M2) processors
- 4GB RAM minimum, 8GB recommended
- 100MB free disk space

### Linux
- Ubuntu 20.04+ or equivalent
- x64, ARM64, or ARMv7l architecture
- 4GB RAM minimum, 8GB recommended
- 100MB free disk space

## Installation

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd desktop-apps
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

### Building for Production

#### Build All Platforms
```bash
npm run build:all
```

#### Build Specific Platform
```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

#### Build Options
- **macOS**: DMG installer and ZIP archive
- **Windows**: NSIS installer and portable EXE
- **Linux**: AppImage, DEB, Snap, and Flatpak packages

## Project Structure

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
└── dist/                # Built applications
```

## Development

### Scripts

- `npm start` - Start the application
- `npm run dev` - Start in development mode
- `npm run build` - Build for current platform
- `npm run pack` - Package without building installers

### Configuration

The application can be configured through the `package.json` build section:

- **App ID**: `com.morngpt.desktop`
- **Product Name**: `MornGPT`
- **Version**: `1.0.0`

### Security Features

- Context isolation enabled
- Node integration disabled
- Remote module disabled
- External links opened in default browser
- Secure IPC communication

## Distribution

### macOS
- **DMG**: Standard macOS installer
- **ZIP**: Portable archive
- **Notarization**: Required for distribution outside App Store

### Windows
- **NSIS**: Standard Windows installer
- **Portable**: Standalone executable
- **Code Signing**: Recommended for distribution

### Linux
- **AppImage**: Universal Linux package
- **DEB**: Debian/Ubuntu package
- **Snap**: Snapcraft package
- **Flatpak**: Flatpak package

## Troubleshooting

### Common Issues

1. **Build fails on macOS**
   - Ensure Xcode Command Line Tools are installed
   - Run `xcode-select --install`

2. **Build fails on Windows**
   - Install Visual Studio Build Tools
   - Ensure Python is available in PATH

3. **Build fails on Linux**
   - Install required packages: `sudo apt-get install fakeroot rpm`
   - For AppImage: `sudo apt-get install libfuse2`

### Debug Mode

Enable debug mode by running:
```bash
npm run dev
```

This will show developer tools and enable hot reloading.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on all platforms
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- GitHub Issues: [Repository Issues]
- Email: support@morngpt.com
- Website: https://morngpt.com
