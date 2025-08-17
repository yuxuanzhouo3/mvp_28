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