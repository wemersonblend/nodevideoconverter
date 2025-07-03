//Rename this file to config.js

exports.s3 = {
	key: "your_s3_key",
	secret: "your_s3_SecretKey",
	bucket: "your_s3_bucketName"
}

exports.zencoder = {
	token : 'your_Zencoder_Token'
}

// Default video processor ('zencoder' or 'ffmpeg')
// This can be overridden by a query parameter in the upload request
exports.defaultProcessor = 'zencoder';

// FFmpeg specific configurations (if any needed in the future)
// exports.ffmpeg = {
//     binaryPath: '/usr/bin/ffmpeg' // Example if not in PATH
// };
