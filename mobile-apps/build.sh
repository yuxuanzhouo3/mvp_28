#!/bin/bash

# MornGPT Mobile App Build Script
# This script builds both Android APK and iOS IPA files

set -e

echo "🚀 Starting MornGPT Mobile App Build Process..."

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

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
    print_error "EAS CLI is not installed. Please install it first:"
    echo "npm install -g @expo/cli"
    exit 1
fi

# Check if logged in to Expo
if ! eas whoami &> /dev/null; then
    print_warning "Not logged in to Expo. Please login first:"
    echo "eas login"
    exit 1
fi

# Create downloads directory
mkdir -p ../downloads

# Build Android APK
print_status "Building Android APK..."
cd android

if eas build --platform android --profile production --non-interactive; then
    print_success "Android APK build completed successfully!"
    
    # Download the APK
    print_status "Downloading APK file..."
    eas build:list --platform android --limit 1 --json | jq -r '.[0].artifacts.buildUrl' | xargs curl -L -o ../downloads/morngpt-android.apk
    
    if [ -f "../downloads/morngpt-android.apk" ]; then
        print_success "Android APK downloaded to ../downloads/morngpt-android.apk"
    else
        print_warning "Could not download APK automatically. Please download manually from EAS dashboard."
    fi
else
    print_error "Android APK build failed!"
    exit 1
fi

cd ..

# Build iOS IPA
print_status "Building iOS IPA..."
cd ios

if eas build --platform ios --profile production --non-interactive; then
    print_success "iOS IPA build completed successfully!"
    
    # Download the IPA
    print_status "Downloading IPA file..."
    eas build:list --platform ios --limit 1 --json | jq -r '.[0].artifacts.buildUrl' | xargs curl -L -o ../downloads/morngpt-ios.ipa
    
    if [ -f "../downloads/morngpt-ios.ipa" ]; then
        print_success "iOS IPA downloaded to ../downloads/morngpt-ios.ipa"
    else
        print_warning "Could not download IPA automatically. Please download manually from EAS dashboard."
    fi
else
    print_error "iOS IPA build failed!"
    exit 1
fi

cd ..

print_success "🎉 Build process completed!"
print_status "Files available in ../downloads/ directory:"
ls -la ../downloads/

echo ""
print_status "Next steps:"
echo "1. Test the APK on Android devices"
echo "2. Test the IPA on iOS devices (requires TestFlight or device installation)"
echo "3. Update the download URLs in the frontend to point to these files"
echo "4. Deploy the files to your web server for direct downloads"
