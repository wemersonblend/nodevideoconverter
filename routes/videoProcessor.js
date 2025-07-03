class VideoProcessor {
    constructor(strategy) {
        this.strategy = strategy;
    }

    process(videoInfo) {
        return this.strategy.process(videoInfo);
    }
}

module.exports = VideoProcessor;
