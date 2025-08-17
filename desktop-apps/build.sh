#!/bin/bash

# MornGPT Desktop App Build Script
# This script builds the desktop application for all platforms

set -e

echo "🚀 Starting MornGPT Desktop App Build Process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the desktop-apps directory."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

print_status "Installing dependencies..."
npm install

# Create dist directory if it doesn't exist
mkdir -p dist

# Build for all platforms
print_status "Building for all platforms..."

# Build macOS
print_status "Building for macOS..."
if npm run build:mac; then
    print_success "macOS build completed"
else
    print_warning "macOS build failed (this is normal if not on macOS)"
fi

# Build Windows
print_status "Building for Windows..."
if npm run build:win; then
    print_success "Windows build completed"
else
    print_warning "Windows build failed (this is normal if not on Windows)"
fi

# Build Linux
print_status "Building for Linux..."
if npm run build:linux; then
    print_success "Linux build completed"
else
    print_warning "Linux build failed (this is normal if not on Linux)"
fi

# List built files
print_status "Built files:"
if [ -d "dist" ]; then
    ls -la dist/
else
    print_warning "No dist directory found"
fi

print_success "Build process completed!"
print_status "Check the dist/ directory for built applications."

# Platform-specific notes
echo ""
print_status "Platform-specific notes:"
echo "  • macOS: DMG and ZIP files for Intel and Apple Silicon"
echo "  • Windows: NSIS installer and portable EXE for x64, x86, ARM64"
echo "  • Linux: AppImage, DEB, Snap, and Flatpak packages"
echo ""
print_status "For production distribution:"
echo "  • macOS: Notarize the app for distribution outside App Store"
echo "  • Windows: Code sign the executables"
echo "  • Linux: Test packages on target distributions"
