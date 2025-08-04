const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { requireAuth, requireAdminAuth } = require('../middlewares/adminAuth');
const db = require('../config/database');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// Route to check if user is authenticated
router.get('/check', requireAuth, (req, res) => {
  res.json({
    success: true,
    message: 'User is authenticated',
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
});

// Route to check if user is admin
router.get('/admin-check', requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    message: 'User is admin',
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
});

// Route to get current user info
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      role: req.user.role
    }
  });
});

// Route to get admin profile information
router.get('/admin-profile', requireAdminAuth, (req, res) => {
  const userId = req.user.id;
  
  const sql = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.role,
      u.status,
      u.created_at,
      a.title,
      a.fname,
      a.lname,
      a.addressline,
      a.town,
      a.phone,
      a.profile_image
    FROM users u
    LEFT JOIN admin a ON u.id = a.user_id
    WHERE u.id = ? AND u.deleted_at IS NULL
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.log('Database error:', err);
      return res.status(500).json({ 
        success: false,
        message: 'Failed to fetch admin profile' 
      });
    }

    if (results.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Admin profile not found' 
      });
    }

    const profile = results[0];
    
    // Format the response
    const adminProfile = {
      id: profile.id,
      name: profile.name || `${profile.fname || ''} ${profile.lname || ''}`.trim() || 'Admin User',
      email: profile.email,
      role: profile.role,
      status: profile.status,
      created_at: profile.created_at,
      title: profile.title,
      fname: profile.fname,
      lname: profile.lname,
      addressline: profile.addressline,
      town: profile.town,
      phone: profile.phone,
      image_path: profile.profile_image,
      // Generate initials for avatar
      initials: profile.fname && profile.lname 
        ? `${profile.fname.charAt(0)}${profile.lname.charAt(0)}`.toUpperCase()
        : profile.name 
        ? profile.name.charAt(0).toUpperCase()
        : 'A'
    };

    return res.status(200).json({ 
      success: true, 
      profile: adminProfile 
    });
  });
});

 // Route to update admin profile
router.put('/admin-profile', requireAdminAuth, upload.single('image'), (req, res) => {
  const userId = req.user.id;
  const { name, email, fname, lname, phone, addressline, town, title } = req.body;
  const image = req.file ? req.file.path.replace(/\\/g, "/").replace("public/", "") : null;

  console.log('Admin profile update request:', {
    userId,
    name,
    email,
    fname,
    lname,
    phone,
    addressline,
    town,
    title,
    image
  });

  // Validate required fields for admin profile
  if (!fname || !lname) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: fname, lname'
    });
  }

  // Use INSERT ... ON DUPLICATE KEY UPDATE since table now has id column
  let sql, params;
  
  if (image) {
    sql = `
      INSERT INTO admin (user_id, title, fname, lname, phone, addressline, town, profile_image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        fname = VALUES(fname),
        lname = VALUES(lname),
        phone = VALUES(phone),
        addressline = VALUES(addressline),
        town = VALUES(town),
        profile_image = VALUES(profile_image)
    `;
    params = [userId, title, fname, lname, phone, addressline, town, image];
  } else {
    sql = `
      INSERT INTO admin (user_id, title, fname, lname, phone, addressline, town)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        fname = VALUES(fname),
        lname = VALUES(lname),
        phone = VALUES(phone),
        addressline = VALUES(addressline),
        town = VALUES(town)
    `;
    params = [userId, title, fname, lname, phone, addressline, town];
  }

  console.log('Executing UPSERT SQL:', sql);
  console.log('With params:', params);

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error('Admin upsert error details:', {
        error: err,
        code: err.code,
        errno: err.errno,
        sqlMessage: err.sqlMessage,
        sql: err.sql
      });
      return res.status(500).json({ 
        success: false,
        message: 'Database error: ' + (err.sqlMessage || err.message)
      });
    }

    console.log('Upsert result:', result);
    console.log('Affected rows:', result.affectedRows);
    console.log('Insert ID:', result.insertId);
    
    res.json({ 
      success: true,
      message: 'Admin profile saved successfully' 
    });
  });
});

module.exports = router; 