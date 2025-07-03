var s3 = require('s3');
var config = require('./config');
var VideoProcessor = require('./videoProcessor');
var ZencoderStrategy = require('./zencoderStrategy');
var FfmpegStrategy = require('./ffmpegStrategy'); // Added FFmpegStrategy

var s3Client = s3.createClient({
    key: config.s3.key,
    secret: config.s3.secret,
    bucket: config.s3.bucket
});

exports.upload = function(req, res) {
    var videoFile = req.files.file;
    // Use a unique name for the uploaded file in S3 tmp to avoid conflicts
    const s3TmpFileName = `${Date.now()}_${videoFile.name}`;
    const s3TmpPath = `tmp/${s3TmpFileName}`;
    var uploader = s3Client.upload(videoFile.path, s3TmpPath);

    uploader.on('error', function(err) {
        console.error("Unable to upload to S3: ", err.stack);
        res.status(500).json({ "error": "Unable to upload to S3: " + err.message });
    });

    uploader.on('progress', function(amountDone, amountTotal) {
        console.log("S3 upload progress", amountDone, amountTotal);
    });

    uploader.on('end', async function() {
        console.log(`File ${videoFile.name} uploaded to S3 at ${s3TmpPath}`);

        // Determine which strategy to use (e.g., from request body, query param, or config)
        // For this example, let's default to Zencoder and allow override via a query parameter `processor=ffmpeg`
        const processorType = req.query.processor || config.defaultProcessor || 'zencoder'; // config.defaultProcessor will be added in next step
        let strategy;

        const videoInfo = {
            fileName: videoFile.name, // Original file name for naming outputs
            inFilePath: s3TmpPath,    // Path on S3 for the processor to use
            // videoName: videoFile.name // This was redundant
        };

        console.log(`Processing with: ${processorType}`);

        if (processorType.toLowerCase() === 'ffmpeg') {
            strategy = new FfmpegStrategy();
        } else {
            strategy = new ZencoderStrategy(); // Default to Zencoder
        }

        const videoProcessor = new VideoProcessor(strategy);

        try {
            const processingResult = await videoProcessor.process(videoInfo);
            console.log("Video processing successful:", processingResult);
            if (processingResult && processingResult.outputs) {
                 list.add(processingResult.outputs); // Save processed video info
            } else if (processorType.toLowerCase() === 'ffmpeg' && processingResult && processingResult.id) {
                // FFmpeg strategy returns a slightly different structure, adapt if necessary
                // For now, let's assume ffmpegStrategy's output can be directly used or adapted for list.add
                list.add(processingResult.outputs || [processingResult]); // Adjust if list.add expects a specific structure
            }
            res.json({ message: "Video processing initiated/completed successfully.", data: processingResult });
        } catch (error) {
            console.error("Video processing failed:", error);
            res.status(500).json({ "error": "Video processing failed: " + error.message });
        }
    });
};

// LISTING SAVED VIDEOS
exports.list = function(req, res) {
    list.get(function(data) {
        res.json(data);
    });
};

var list = {
    fs: require('fs'),
    filepath: './models/videolist.json',

    add: function(newItems, callback) { // Changed listItem to newItems to reflect it can be an array
        this.get(function(data) {
            // Ensure data is an array
            if (!Array.isArray(data)) {
                data = [];
            }
            // Ensure newItems is an array before trying to unshift/concat
            const itemsToAdd = Array.isArray(newItems) ? newItems : (newItems ? [newItems] : []);

            itemsToAdd.forEach(item => {
                // Zencoder outputs is an array of objects, ffmpeg output is an object with an outputs array
                // We need to ensure we are adding the correct structure to the list.
                // The 'list.add' was originally expecting the 'outputs' array from Zencoder.
                // Let's make sure to pass that or an equivalent.
                // The current ffmpegStrategy resolves with { id: ..., outputs: [...] }
                // So processingResult.outputs should be correct for both.
                if (item) { // Check if item is not null/undefined
                    data.unshift(item); // Add new items to the beginning of the list
                }
            });

            list.fs.writeFile(list.filepath, JSON.stringify(data, null, 2), function(err) { // Added null, 2 for pretty print
                if (err) {
                    console.log("Error saving video list:", err);
                    if (typeof callback === 'function') callback(err);
                    return;
                }
                console.log("Video list saved to " + list.filepath);
                if (typeof callback === 'function') callback();
            });
        });
    },

    get: function(callback) {
        this.fs.readFile(this.filepath, 'utf8', function(err, fileData) {
            if (err) {
                // If file doesn't exist or other read error, return empty array
                if (err.code === 'ENOENT') {
                    console.log("Video list file not found, returning empty list.");
                    callback([]);
                    return;
                }
                console.log("Error reading video list:", err);
                callback([]); // Return empty list on other errors too
                return;
            }
            try {
                const parsedData = JSON.parse(fileData);
                callback(parsedData);
            } catch (parseErr) {
                console.log("Error parsing video list JSON, returning empty list:", parseErr);
                callback([]); // Return empty list if JSON is corrupt
            }
        });
    }
};


