// This file defines routes and delegates request handling to controllers.
const videoController = require('../controllers/videoController');

// The listManager object is no longer needed here as its functionality
// has been moved to services/videoListService.js

// Define route handlers that call controller methods.
// These exported functions will be used by app.js for routing.
exports.upload = videoController.uploadVideo;
exports.list = videoController.listVideos;


