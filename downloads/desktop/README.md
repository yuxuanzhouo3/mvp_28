# Desktop App Downloads

This directory contains the built desktop applications for MornGPT.

## File Structure

### macOS
- `MornGPT-1.0.0-mac-x64.dmg` - Intel Mac installer
- `MornGPT-1.0.0-mac-arm64.dmg` - Apple Silicon Mac installer
- `MornGPT-1.0.0-mac.dmg` - Universal Mac installer

### Windows
- `MornGPT-Setup-1.0.0-x64.exe` - 64-bit Windows installer
- `MornGPT-Setup-1.0.0-ia32.exe` - 32-bit Windows installer
- `MornGPT-Setup-1.0.0-arm64.exe` - ARM64 Windows installer

### Linux
- `MornGPT-1.0.0-x86_64.AppImage` - x64 Linux AppImage
- `MornGPT-1.0.0-aarch64.AppImage` - ARM64 Linux AppImage
- `MornGPT-1.0.0-armv7l.AppImage` - ARMv7 Linux AppImage
- `MornGPT-1.0.0-amd64.deb` - Debian/Ubuntu package
- `MornGPT-1.0.0.snap` - Snap package
- `MornGPT-1.0.0.flatpak` - Flatpak package

## Building Instructions

To build the desktop applications:

1. Navigate to the `desktop-apps` directory
2. Install dependencies: `npm install`
3. Build for all platforms: `./build.sh`
4. Copy the built files from `desktop-apps/dist/` to this directory

## System Requirements

### macOS
- macOS 11.0 (Big Sur) or later
- Intel or Apple Silicon processor
- 4GB RAM minimum, 8GB recommended

### Windows
- Windows 10 or later
- x64, x86, or ARM64 architecture
- 4GB RAM minimum, 8GB recommended

### Linux
- Ubuntu 20.04+ or equivalent
- x64, ARM64, or ARMv7l architecture
- 4GB RAM minimum, 8GB recommended

## Installation Instructions

### macOS
1. Download the appropriate DMG file for your Mac
2. Double-click the DMG file to mount it
3. Drag MornGPT to your Applications folder
4. Eject the DMG file

### Windows
1. Download the appropriate EXE file for your Windows version
2. Run the installer as administrator
3. Follow the installation wizard
4. Launch MornGPT from the Start menu

### Linux
1. Download the appropriate package for your distribution
2. For AppImage: Make executable and run: `chmod +x MornGPT-*.AppImage && ./MornGPT-*.AppImage`
3. For DEB: Install with: `sudo dpkg -i MornGPT-*.deb`
4. For Snap: Install with: `sudo snap install MornGPT-*.snap`
5. For Flatpak: Install with: `flatpak install MornGPT-*.flatpak`

## Notes

- These are placeholder files until the actual builds are created
- Replace with actual built applications before distribution
- Ensure all files are properly signed and notarized for production use
