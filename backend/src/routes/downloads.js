/**
 * Downloads Routes
 * Handles mobile app downloads and model download management
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Serve mobile app downloads
router.get('/mobile/:platform', (req, res) => {
  const { platform } = req.params;
  const downloadsDir = path.join(__dirname, '../../../downloads');
  
  let fileName;
  let contentType;
  
  switch (platform) {
    case 'android':
      fileName = 'morngpt-android.apk';
      contentType = 'application/vnd.android.package-archive';
      break;
    case 'ios':
      fileName = 'morngpt-ios.ipa';
      contentType = 'application/octet-stream';
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid platform. Supported: android, ios'
      });
  }
  
  const filePath = path.join(downloadsDir, fileName);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: `File not found: ${fileName}`
    });
  }
  
  // Get file stats
  const stats = fs.statSync(filePath);
  
  // Set headers for download
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'no-cache');
  
  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// Serve desktop app downloads
router.get('/desktop/:platform/:arch', (req, res) => {
  const { platform, arch } = req.params;
  const downloadsDir = path.join(__dirname, '../../../downloads/desktop');
  
  let fileName;
  let contentType;
  
  switch (platform) {
    case 'macos':
      if (arch === 'intel') {
        fileName = 'MornGPT-1.0.0-mac-x64.dmg';
        contentType = 'application/x-apple-diskimage';
      } else if (arch === 'arm64') {
        fileName = 'MornGPT-1.0.0-mac-arm64.dmg';
        contentType = 'application/x-apple-diskimage';
      } else {
        fileName = 'MornGPT-1.0.0-mac.dmg';
        contentType = 'application/x-apple-diskimage';
      }
      break;
    case 'windows':
      if (arch === 'x64') {
        fileName = 'MornGPT-Setup-1.0.0-x64.exe';
        contentType = 'application/x-msdownload';
      } else if (arch === 'x86') {
        fileName = 'MornGPT-Setup-1.0.0-ia32.exe';
        contentType = 'application/x-msdownload';
      } else if (arch === 'arm64') {
        fileName = 'MornGPT-Setup-1.0.0-arm64.exe';
        contentType = 'application/x-msdownload';
      } else {
        fileName = 'MornGPT-Setup-1.0.0.exe';
        contentType = 'application/x-msdownload';
      }
      break;
    case 'linux':
      if (arch === 'x64') {
        fileName = 'MornGPT-1.0.0-x86_64.AppImage';
        contentType = 'application/x-executable';
      } else if (arch === 'arm64') {
        fileName = 'MornGPT-1.0.0-aarch64.AppImage';
        contentType = 'application/x-executable';
      } else if (arch === 'armv7l') {
        fileName = 'MornGPT-1.0.0-armv7l.AppImage';
        contentType = 'application/x-executable';
      } else {
        fileName = 'MornGPT-1.0.0.AppImage';
        contentType = 'application/x-executable';
      }
      break;
    default:
      return res.status(400).json({
        success: false,
        message: 'Invalid platform. Supported: macos, windows, linux'
      });
  }
  
  const filePath = path.join(downloadsDir, fileName);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: `File not found: ${fileName}`
    });
  }
  
  // Get file stats
  const stats = fs.statSync(filePath);
  
  // Set headers for download
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'no-cache');
  
  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  fileStream.pipe(res);
});

// Get available downloads
router.get('/mobile', (req, res) => {
  const downloadsDir = path.join(__dirname, '../../../downloads');
  
  try {
    const files = fs.readdirSync(downloadsDir);
    const mobileFiles = files.filter(file => 
      file.includes('morngpt') && (file.endsWith('.apk') || file.endsWith('.ipa'))
    );
    
    const downloads = mobileFiles.map(file => {
      const stats = fs.statSync(path.join(downloadsDir, file));
      return {
        name: file,
        platform: file.includes('android') ? 'android' : 'ios',
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        url: `/api/downloads/mobile/${file.includes('android') ? 'android' : 'ios'}`,
        lastModified: stats.mtime
      };
    });
    
    res.status(200).json({
      success: true,
      downloads
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to read downloads directory',
      error: error.message
    });
  }
});

// Get available desktop downloads
router.get('/desktop', (req, res) => {
  const downloadsDir = path.join(__dirname, '../../../downloads/desktop');
  
  try {
    if (!fs.existsSync(downloadsDir)) {
      return res.status(200).json({
        success: true,
        downloads: []
      });
    }
    
    const files = fs.readdirSync(downloadsDir);
    const desktopFiles = files.filter(file => 
      file.includes('MornGPT') && (
        file.endsWith('.dmg') || 
        file.endsWith('.exe') || 
        file.endsWith('.AppImage') ||
        file.endsWith('.deb') ||
        file.endsWith('.snap') ||
        file.endsWith('.flatpak')
      )
    );
    
    const downloads = desktopFiles.map(file => {
      const stats = fs.statSync(path.join(downloadsDir, file));
      let platform = 'unknown';
      let arch = 'unknown';
      
      if (file.includes('mac')) {
        platform = 'macos';
        if (file.includes('arm64')) arch = 'arm64';
        else if (file.includes('x64')) arch = 'intel';
        else arch = 'universal';
      } else if (file.includes('win') || file.includes('Setup')) {
        platform = 'windows';
        if (file.includes('arm64')) arch = 'arm64';
        else if (file.includes('ia32')) arch = 'x86';
        else if (file.includes('x64')) arch = 'x64';
        else arch = 'x64';
      } else if (file.includes('linux') || file.endsWith('.AppImage') || file.endsWith('.deb')) {
        platform = 'linux';
        if (file.includes('aarch64')) arch = 'arm64';
        else if (file.includes('armv7l')) arch = 'armv7l';
        else if (file.includes('x86_64')) arch = 'x64';
        else arch = 'x64';
      }
      
      return {
        name: file,
        platform,
        arch,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        url: `/api/downloads/desktop/${platform}/${arch}`,
        lastModified: stats.mtime
      };
    });
    
    res.status(200).json({
      success: true,
      downloads
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to read desktop downloads directory',
      error: error.message
    });
  }
});

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get user downloads (for model downloads)
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    downloads: []
  });
});

// Start model download
router.post('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Start download endpoint - implement as needed'
  });
});

// Get download status
router.get('/:downloadId', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Get download status endpoint - implement as needed'
  });
});

// Cancel download
router.delete('/:downloadId', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cancel download endpoint - implement as needed'
  });
});

module.exports = router; 