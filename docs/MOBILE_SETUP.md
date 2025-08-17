# 📱 Mobile Setup Guide

## 🚀 Quick Start

### Access URLs
- **Main Chat:** `http://192.168.31.9:3000`
- **Mobile Test:** `http://192.168.31.9:3000/test-mobile`
- **Status Check:** `http://192.168.31.9:3000/mobile-status`

## 📋 Requirements

### Network Requirements
- Both devices (computer and phone) must be on the same WiFi network
- Computer IP: `192.168.31.9`
- Backend Port: `5000`
- Frontend Port: `3000`

### Browser Requirements
- Modern mobile browser (Chrome, Safari, Firefox)
- JavaScript enabled
- Network access allowed

## 🔧 Troubleshooting

### If you can't access the website:
1. **Check network connection** - Both devices must be on same WiFi
2. **Try the status page** - Visit `http://192.168.31.9:3000/mobile-status`
3. **Check computer firewall** - Ensure ports 3000 and 5000 are open
4. **Restart services** - Contact administrator to restart backend/frontend

### If chat doesn't work:
1. **Check API status** - Visit the mobile status page
2. **Try test page** - Visit `http://192.168.31.9:3000/test-mobile`
3. **Clear browser cache** - Hard refresh the page
4. **Check console errors** - Open browser developer tools

### If response is slow:
1. **Check network speed** - Use the status page to see connection info
2. **Try different model** - Some models may be faster than others
3. **Check server load** - Contact administrator

## 📱 Mobile Optimizations

### PWA Features
- **Add to Home Screen** - Install as app for better experience
- **Offline support** - Basic functionality works offline
- **App-like experience** - Full-screen mode when installed

### Performance Tips
- **Use WiFi** - Better performance than mobile data
- **Close other apps** - Free up memory for better performance
- **Keep browser updated** - Latest versions have better performance

## 🛠️ Technical Details

### API Endpoints
- **Stream Chat:** `POST http://192.168.31.9:5000/api/chat/stream-guest`
- **Health Check:** `GET http://192.168.31.9:5000/api/health`

### Response Times
- **Target:** < 100ms initial response
- **Streaming:** 10-20ms between words
- **Fallback:** < 500ms if API unavailable

### Supported Models
- **Mistral:** mistral-small, mistral-7b
- **OpenAI:** gpt-3.5-turbo, gpt-4
- **Anthropic:** claude-3-sonnet
- **And more...**

## 📞 Support

If you encounter issues:
1. Check the mobile status page first
2. Try the test mobile page
3. Contact the system administrator
4. Check the main README for more details

## 🔄 Updates

The mobile version is automatically updated when you refresh the page. No app store updates required!
