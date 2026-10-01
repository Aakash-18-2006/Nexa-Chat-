const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');

router.post('/upload', protect, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[Upload Error]:', err.message);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file was uploaded or file field name was invalid (expected "file").'
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      file: {
        url: fileUrl,
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      }
    });
  });
});

module.exports = router;
