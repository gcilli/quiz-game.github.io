// SafeStorage - localStorage wrapper with fallback to in-memory storage
// Now supports dataset-specific keys
const SafeStorage = (function () {
    let ok = true;
    try {
        const testKey = "__storage_test__";
        window.localStorage.setItem(testKey, "1");
        window.localStorage.removeItem(testKey);
    } catch (e) {
        ok = false;
    }
    let memory = [];

    // Helper to get dataset-specific key
    function getDatasetKey(key) {
        // Check if currentDataset is defined in the global scope
        const dataset = window.currentDataset || 'questions.json';
        // Create a shorter identifier for the dataset
        const datasetId = dataset.replace('questions', 'q').replace('.json', '').replace('_', '');
        return `${datasetId}_${key}`;
    }

    return {
        isAvailable: () => ok,
        get: (k) => {
            const key = getDatasetKey(k);
            if (ok) {
                try {
                    return JSON.parse(localStorage.getItem(key)) || null;
                } catch (e) {
                    return null;
                }
            } else {
                return memory.find(m => m.k === key)?.v || null;
            }
        },
        set: (k, v) => {
            const key = getDatasetKey(k);
            if (ok) {
                try {
                    localStorage.setItem(key, JSON.stringify(v));
                    return true;
                } catch (e) {
                    return false;
                }
            } else {
                const idx = memory.findIndex(m => m.k === key);
                if (idx >= 0) memory[idx].v = v;
                else memory.push({ k: key, v });
                return true;
            }
        },
        remove: (k) => {
            const key = getDatasetKey(k);
            if (ok) {
                try {
                    localStorage.removeItem(key);
                } catch (e) { }
            } else {
                memory = memory.filter(m => m.k !== key);
            }
        }
    };
})();
