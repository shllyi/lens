const express = require('express');
const router = express.Router();
const itemController = require('../controllers/item');
const upload = require('../middlewares/upload');
const { requireAdminAuth } = require('../middlewares/adminAuth');

// ADMIN ROUTES - require admin authentication (place BEFORE other routes to avoid conflicts)
router.get('/admin/all', requireAdminAuth, itemController.getAllItemsIncludingDeleted);
router.get('/admin/restore/:id', requireAdminAuth, itemController.restoreItem); // GET version for restore
router.get('/admin/:id', requireAdminAuth, itemController.getSingleItem);

// CREATE (multiple images)
router.post('/admin', requireAdminAuth, upload.array('images', 5), itemController.createItem);

// UPDATE (multiple images)
router.put('/admin/:id', requireAdminAuth, upload.array('images', 5), itemController.updateItem);

// DELETE
router.delete('/admin/:id', requireAdminAuth, itemController.deleteItem);

// RESTORE
router.patch('/admin/restore/:id', requireAdminAuth, itemController.restoreItem);

// PUBLIC ROUTES (place after admin routes)
router.get('/search/:term', itemController.searchItems);
router.get('/autocomplete', itemController.getAutocompleteSuggestions);
router.get('/category/:categoryId', itemController.getItemsByCategory);
router.get('/:id', itemController.getSingleItem); // This should be last among GET routes
router.get('/', itemController.getAllItems);

module.exports = router;