#!/bin/bash

# MornGPT Mobile App Local Build Script
# This script creates development builds for testing

set -e

echo "🚀 Starting MornGPT Mobile App Local Build Process..."

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

# Create downloads directory
mkdir -p ../downloads

# Check if Expo CLI is installed
if ! command -v expo &> /dev/null; then
    print_error "Expo CLI is not installed. Please install it first:"
    echo "npm install -g @expo/cli"
    exit 1
fi

# Build Android APK (Development)
print_status "Building Android APK (Development)..."
cd android

# Install dependencies
print_status "Installing dependencies..."
npm install

# Create development build
print_status "Creating development build..."
npx expo run:android --variant release

# Copy APK to downloads directory
if [ -f "android/app/build/outputs/apk/release/app-release.apk" ]; then
    cp android/app/build/outputs/apk/release/app-release.apk ../downloads/morngpt-android-dev.apk
    print_success "Android APK (Development) created: ../downloads/morngpt-android-dev.apk"
else
    print_warning "APK not found. Please check the build output."
fi

cd ..

# Build iOS IPA (Development)
print_status "Building iOS IPA (Development)..."
cd ios

# Install dependencies
print_status "Installing dependencies..."
npm install

# Create development build
print_status "Creating development build..."
npx expo run:ios --configuration Release

# Copy IPA to downloads directory (if available)
if [ -f "ios/build/Build/Products/Release-iphoneos/morngpt.app" ]; then
    # Create IPA manually
    mkdir -p Payload
    cp -r ios/build/Build/Products/Release-iphoneos/morngpt.app Payload/
    zip -r ../downloads/morngpt-ios-dev.ipa Payload/
    rm -rf Payload
    print_success "iOS IPA (Development) created: ../downloads/morngpt-ios-dev.ipa"
else
    print_warning "iOS app not found. Please check the build output."
fi

cd ..

print_success "🎉 Local build process completed!"
print_status "Files available in ../downloads/ directory:"
ls -la ../downloads/

echo ""
print_status "Next steps:"
echo "1. Test the APK on Android devices"
echo "2. Test the IPA on iOS devices (requires device installation)"
echo "3. For production builds, use the EAS build script: ./build.sh"
echo "4. Update the download URLs in the frontend to point to these files"
