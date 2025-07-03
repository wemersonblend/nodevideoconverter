const fs = require('fs');
const path = require('path');

// Define the path to the JSON file. Consider making this configurable.
const videoListFilePath = path.resolve('./models/videolist.json');
// Ensure the directory exists (important if models/ doesn't exist initially or in some environments)
const modelsDir = path.dirname(videoListFilePath);
if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
}


/**
 * Adds new video item(s) to the beginning of the list.
 * @param {object|Array<object>} newItems - A single item or an array of items to add.
 * @returns {Promise<void>} - A promise that resolves when the list is saved.
 */
async function addItems(newItems) {
    return new Promise(async (resolve, reject) => {
        try {
            let currentList = await getList(); // Get current list (which is already an array)

            const itemsToAdd = Array.isArray(newItems) ? newItems : (newItems ? [newItems] : []);

            itemsToAdd.reverse().forEach(item => { // Reverse to maintain order when unshifting multiple
                if (item) {
                    currentList.unshift(item);
                }
            });

            fs.writeFile(videoListFilePath, JSON.stringify(currentList, null, 2), (err) => {
                if (err) {
                    console.error("VideoListService: Error saving video list:", err);
                    return reject(new Error("Failed to save video list."));
                }
                console.log("VideoListService: Video list saved to " + videoListFilePath);
                resolve();
            });
        } catch (error) {
            // getList might throw an error if parsing fails badly or file is unreadable beyond ENOENT
            reject(error);
        }
    });
}

/**
 * Retrieves the list of videos.
 * @returns {Promise<Array<object>>} - A promise that resolves with an array of video items.
 */
async function getList() {
    return new Promise((resolve, reject) => {
        fs.readFile(videoListFilePath, 'utf8', (err, fileData) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    console.log("VideoListService: Video list file not found, returning empty list.");
                    resolve([]); // Return empty list if file doesn't exist
                    return;
                }
                console.error("VideoListService: Error reading video list:", err);
                reject(new Error("Failed to read video list."));
                return;
            }
            try {
                if (!fileData.trim()) { // Handle empty file
                    resolve([]);
                    return;
                }
                const parsedData = JSON.parse(fileData);
                resolve(Array.isArray(parsedData) ? parsedData : []); // Ensure it's an array
            } catch (parseErr) {
                console.error("VideoListService: Error parsing video list JSON:", parseErr);
                // If JSON is corrupt, perhaps return empty or reject, depending on desired behavior
                // For robustness, returning empty list might be safer for some use cases.
                resolve([]);
                // reject(new Error("Failed to parse video list JSON."));
            }
        });
    });
}

module.exports = {
    addItems,
    getList
};
