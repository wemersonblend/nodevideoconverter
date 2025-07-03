const videoService = require('../services/videoService');
const videoListService = require('../services/videoListService'); // Using the new service
// const config = require('../routes/config'); // No longer needed here for defaultProcessor

exports.uploadVideo = async function(req, res) {
    if (!req.files || !req.files.file) {
        return res.status(400).json({ error: "No file uploaded." });
    }
    const videoFile = req.files.file;
    const processorTypeQuery = req.query.processor;

    try {
        const processingResult = await videoService.uploadAndProcessVideo(videoFile, processorTypeQuery);
        console.log("Controller: Video processing successful via service:", processingResult);

        if (processingResult && processingResult.outputs && processingResult.outputs.length > 0) {
            await videoListService.addItems(processingResult.outputs);
            console.log("Controller: Video metadata added to list by videoListService.");
        } else {
            console.warn("Controller: Processing result or outputs are not in the expected format or are empty. Not adding to list.", processingResult);
        }

        if (!res.headersSent) {
            res.json({ message: "Video processing and metadata storage successful.", data: processingResult });
        }

    } catch (error) {
        console.error("Controller: Error during video upload/processing or list update:", error);
        if (!res.headersSent) {
            // Give a more generic error to the client unless it's a specific client error
            const clientErrorMessage = error.isClientError ? error.message : "Video operation failed.";
            res.status(error.statusCode || 500).json({ "error": clientErrorMessage });
        }
    }
};

exports.listVideos = async function(req, res) {
    try {
        const data = await videoListService.getList();
        if (!res.headersSent) {
            res.json(data);
        }
    } catch (error) {
        console.error("Controller: Error listing videos via videoListService:", error);
        if (!res.headersSent) {
            res.status(500).json({ "error": "Failed to list videos: " + (error.message || error) });
        }
    }
};
