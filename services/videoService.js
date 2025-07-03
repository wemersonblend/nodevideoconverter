const s3 = require('s3');
const config = require('../routes/config'); // Adjust path as needed
const VideoProcessor = require('../routes/videoProcessor'); // Adjust path
const ZencoderStrategy = require('../routes/zencoderStrategy'); // Adjust path
const FfmpegStrategy = require('../routes/ffmpegStrategy'); // Adjust path
// listManager will be injected or required from its new location later
// For now, this service will focus on upload and processing logic

// S3 client setup - This could also be a shared S3 service
const s3Client = s3.createClient({
    key: config.s3.key,
    secret: config.s3.secret,
    bucket: config.s3.bucket
});

/**
 * Handles the video upload to S3 and initiates video processing.
 * @param {object} videoFile - The file object from the request (e.g., req.files.file).
 * @param {string} processorTypeQuery - The processor type from the request query.
 * @returns {Promise<object>} - A promise that resolves with the processing result.
 */
async function uploadAndProcessVideo(videoFile, processorTypeQuery) {
    return new Promise((resolve, reject) => {
        if (!videoFile) {
            return reject(new Error("No video file provided to service."));
        }

        const s3TmpFileName = `${Date.now()}_${videoFile.name}`;
        const s3TmpPath = `tmp/${s3TmpFileName}`;

        console.log(`VideoService: Uploading ${videoFile.name} to S3 path ${s3TmpPath}`);
        const uploader = s3Client.upload(videoFile.path, s3TmpPath);

        uploader.on('error', function(err) {
            console.error("VideoService: S3 Upload Error: ", err.stack);
            reject(new Error("Unable to upload to S3: " + err.message));
        });

        uploader.on('progress', function(amountDone, amountTotal) {
            console.log("VideoService: S3 upload progress", amountDone, amountTotal);
            // In a real app, this might emit an event or use a callback for progress.
        });

        uploader.on('end', async function() {
            console.log(`VideoService: File ${videoFile.name} uploaded to S3 at ${s3TmpPath}`);

            const processorType = processorTypeQuery || config.defaultProcessor || 'zencoder';
            let strategy;

            const videoInfo = {
                fileName: videoFile.name,
                inFilePath: s3TmpPath,
            };

            console.log(`VideoService: Processing with: ${processorType}`);

            if (processorType.toLowerCase() === 'ffmpeg') {
                strategy = new FfmpegStrategy(s3Client); // Pass s3Client instance
            } else {
                strategy = new ZencoderStrategy(); // Default - ZencoderStrategy manages its own client from config
            }

            const videoProcessor = new VideoProcessor(strategy);

            try {
                const processingResult = await videoProcessor.process(videoInfo);
                console.log("VideoService: Video processing successful:", processingResult);
                resolve(processingResult);
            } catch (error) {
                console.error("VideoService: Video processing failed:", error);
                reject(new Error("Video processing failed in service: " + (error.message || error)));
            }
        });
    });
}

module.exports = {
    uploadAndProcessVideo
};
