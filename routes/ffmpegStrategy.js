const ffmpeg = require('fluent-ffmpeg');
// s3 require removed from here if client is injected
const fs = require('fs');
const path = require('path');
const config = require('./config'); // Still needed for bucket name if not passed with client

// s3Client will be passed in constructor
// const s3 = require('s3');
// const s3Client = s3.createClient({
//     key: config.s3.key,
//     secret: config.s3.secret,
//     bucket: config.s3.bucket
// });

class FfmpegStrategy {
    constructor(s3ClientInstance) {
        if (!s3ClientInstance) {
            throw new Error("FfmpegStrategy requires an S3 client instance.");
        }
        this.s3Client = s3ClientInstance;
        // FFmpeg path can be configured if not in system PATH
        // ffmpeg.setFfmpegPath(config.ffmpegPath || '/path/to/ffmpeg');
    }

    process(videoInfo) {
        const { fileName, inFilePath } = videoInfo;
        const baseFileName = path.basename(fileName, path.extname(fileName));
        const tmpDir = 'tmp_ffmpeg_processing';
        const localInputPath = path.join(tmpDir, fileName);

        return new Promise(async (resolve, reject) => {
            try {
                // 0. Ensure temp directory exists
                if (!fs.existsSync(tmpDir)) {
                    fs.mkdirSync(tmpDir, { recursive: true });
                }

                // 1. Download the file from S3 to a temporary local path
                console.log(`FFMPEG: Downloading s3://${config.s3.bucket}/${inFilePath} to ${localInputPath}`);
                const downloader = this.s3Client.download(inFilePath, localInputPath); // Use this.s3Client
                await new Promise((resolveDownload, rejectDownload) => {
                    downloader.on('error', (err) => {
                        console.error("FFMPEG: S3 download error:", err.stack);
                        rejectDownload(err);
                    });
                    downloader.on('end', () => {
                        console.log(`FFMPEG: Downloaded ${localInputPath}`);
                        resolveDownload();
                    });
                });

                const outputPromises = [];
                const outputFormats = [
                    { format: 'mp4', ext: 'mp4' },
                    { format: 'webm', ext: 'webm' },
                    { format: 'ogg', ext: 'ogv' } // .ogg for video is typically .ogv
                ];

                const outputsData = [];

                for (const fmt of outputFormats) {
                    const outputFileName = `${baseFileName}.${fmt.ext}`;
                    const localOutputPath = path.join(tmpDir, outputFileName);
                    const s3OutputPath = `converted/${outputFileName}`;

                    outputPromises.push(
                        new Promise((resolveFormat, rejectFormat) => {
                            console.log(`FFMPEG: Starting conversion for ${fmt.format}`);
                            ffmpeg(localInputPath)
                                .output(localOutputPath)
                                .toFormat(fmt.format)
                                .on('error', (err) => {
                                    console.error(`FFMPEG: Error converting to ${fmt.format}:`, err.message);
                                    rejectFormat(err);
                                })
                                .on('end', async () => {
                                    console.log(`FFMPEG: Finished converting to ${fmt.format}: ${localOutputPath}`);

                                    // Upload converted file to S3
                                    const uploader = this.s3Client.upload(localOutputPath, s3OutputPath, { ACL: 'public-read' }); // Use this.s3Client
                                    await new Promise((resolveUpload, rejectUpload) => {
                                        uploader.on('error', (err) => {
                                            console.error(`FFMPEG: S3 upload error for ${s3OutputPath}:`, err.stack);
                                            rejectUpload(err);
                                        });
                                        uploader.on('end', () => {
                                            console.log(`FFMPEG: Uploaded ${s3OutputPath} to S3.`);
                                            outputsData.push({
                                                label: fmt.format,
                                                url: `s3://${config.s3.bucket}/${s3OutputPath}`, // Construct S3 URL
                                                filename: outputFileName,
                                                public: true,
                                                // Thumbnails are more complex with ffmpeg, doing a single one for now
                                            });
                                            resolveUpload();
                                        });
                                    });
                                    resolveFormat();
                                })
                                .run();
                        })
                    );
                }

                // Generate thumbnails (example: one thumbnail from the middle)
                const thumbnailFileName = `${baseFileName}_thumb.png`;
                const localThumbnailPath = path.join(tmpDir, thumbnailFileName);
                const s3ThumbnailPath = `converted/thumbnails/${thumbnailFileName}`;

                outputPromises.push(
                    new Promise((resolveThumb, rejectThumb) => {
                        console.log(`FFMPEG: Starting thumbnail generation for ${fileName}`);
                        ffmpeg(localInputPath)
                            .screenshots({
                                count: 1,
                                timemarks: ['50%'], // take a screenshot at 50%
                                filename: thumbnailFileName,
                                folder: tmpDir,
                                size: '320x240'
                            })
                            .on('error', (err) => {
                                console.error('FFMPEG: Error generating thumbnail:', err.message);
                                rejectThumb(err);
                            })
                            .on('end', async () => {
                                console.log(`FFMPEG: Finished generating thumbnail: ${localThumbnailPath}`);
                                // Upload thumbnail to S3
                                const thumbUploader = this.s3Client.upload(localThumbnailPath, s3ThumbnailPath, { ACL: 'public-read' }); // Use this.s3Client
                                await new Promise((resolveUpload, rejectUpload) => {
                                    thumbUploader.on('error', (err) => {
                                        console.error(`FFMPEG: S3 thumbnail upload error for ${s3ThumbnailPath}:`, err.stack);
                                        rejectUpload(err);
                                    });
                                    thumbUploader.on('end', () => {
                                        console.log(`FFMPEG: Uploaded ${s3ThumbnailPath} to S3.`);
                                        // Add thumbnail info to outputs if needed, or handle separately
                                        // For simplicity, Zencoder structure has thumbnails per output,
                                        // FFmpeg might be one set of thumbs per job.
                                        // We'll add a generic thumbnail entry to the first output for now.
                                        if (outputsData.length > 0) {
                                            outputsData[0].thumbnails = [{
                                                label: "thumb_mid",
                                                url: `s3://${config.s3.bucket}/${s3ThumbnailPath}`
                                            }];
                                        }
                                        resolveUpload();
                                    });
                                });
                                resolveThumb();
                            });
                    })
                );

                await Promise.all(outputPromises);
                console.log("FFMPEG: All conversions and uploads complete.");
                resolve({ id: `ffmpeg_${Date.now()}`, outputs: outputsData });

            } catch (error) {
                console.error("FFMPEG: Error in processing pipeline:", error);
                reject(error);
            } finally {
                // Clean up temporary files
                fs.rm(tmpDir, { recursive: true, force: true }, (err) => {
                    if (err) console.error(`FFMPEG: Error deleting temp directory ${tmpDir}:`, err);
                    else console.log(`FFMPEG: Deleted temp directory ${tmpDir}`);
                });
            }
        });
    }
}

module.exports = FfmpegStrategy;
