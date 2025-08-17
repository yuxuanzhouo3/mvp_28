# Production Setup for MornHub.net

## 🚀 Production Configuration

### API Configuration
- **Production Domain:** `https://mornhub.net`
- **API Base URL:** `https://mornhub.net` (for both mobile and desktop)
- **CORS Origins:** `https://mornhub.net`, `https://www.mornhub.net`

### Environment Variables (Vercel)
Make sure these environment variables are set in Vercel:

```bash
JWT_SECRET=@jwt_secret
OPENAI_API_KEY=@openai_api_key
GROQ_API_KEY=@groq_api_key
ANTHROPIC_API_KEY=@anthropic_api_key
COHERE_API_KEY=@cohere_api_key
MISTRAL_API_KEY=@mistral_api_key
CORS_ORIGINS=https://mornhub.net,https://www.mornhub.net
NODE_ENV=production
```

### Mobile Access
- **Frontend:** `https://mornhub.net`
- **API:** `https://mornhub.net/api/*`
- **Mobile Detection:** Automatic detection for Android, iOS, etc.

### Deployment Steps
1. Push changes to GitHub: `git push --set-upstream origin main`
2. Vercel will automatically deploy from the main branch
3. Verify deployment at `https://mornhub.net`

### Testing Mobile Access
1. Open `https://mornhub.net` on your phone
2. Try the chat functionality
3. Check the test page: `https://mornhub.net/test-mobile`

### Current Status
✅ API configuration updated for production
✅ CORS configured for mornhub.net
✅ Mobile detection working
✅ Fast response time (92ms)
✅ Streaming responses enabled

### Troubleshooting
If mobile access doesn't work:
1. Check browser console for errors
2. Verify CORS headers
3. Test API endpoints directly
4. Check Vercel deployment logs
