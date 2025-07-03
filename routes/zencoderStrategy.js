const Zencoder = require('zencoder');
const config = require('./config'); // Assuming config file exists

class ZencoderStrategy {
    constructor() {
        this.zClient = new Zencoder(config.zencoder.token);
    }

    process(videoInfo) {
        const { fileName, inFilePath, videoName } = videoInfo;
        return new Promise((resolve, reject) => {
            this.zClient.Job.create({
                test: true,
                input: `s3://nodevideoconverter/${inFilePath}`,
                outputs: [
                    {
                        "label": "mp4",
                        "url": `s3://nodevideoconverter/converted/${fileName}.mp4`,
                        "filename": fileName,
                        "public": true,
                        "thumbnails": [{
                            "label": "first",
                            "number": 1
                        }, {
                            "interval_in_frames": 5000,
                            "label": "second"
                        }]
                    },
                    {
                        "label": "webm",
                        "url": `s3://nodevideoconverter/converted/${fileName}.webm`,
                        "filename": fileName,
                        "public": true,
                        "thumbnails": [{
                            "label": "first",
                            "number": 1
                        }, {
                            "interval_in_frames": 5000,
                            "label": "second"
                        }]
                    },
                    {
                        "label": "ogg",
                        "url": `s3://nodevideoconverter/converted/${fileName}.ogg`,
                        "filename": fileName,
                        "public": true,
                        "thumbnails": [{
                            "label": "first",
                            "number": 1
                        }, {
                            "interval_in_frames": 5000,
                            "label": "second"
                        }]
                    }
                ]
            }, (err, data) => {
                if (err) {
                    console.error("OH NO! There was an error with Zencoder: ", err);
                    return reject(err);
                }
                // Assuming 'list' is accessible or passed differently
                // list.add(data.outputs);
                resolve(data);
            });
        });
    }
}

module.exports = ZencoderStrategy;
