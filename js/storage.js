// SafeStorage - localStorage wrapper with fallback to in-memory storage
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
    return {
        isAvailable: () => ok,
        get: (k) => {
            if (ok) {
                try {
                    return JSON.parse(localStorage.getItem(k)) || null;
                } catch (e) {
                    return null;
                }
            } else {
                return memory.find(m => m.k === k)?.v || null;
            }
        },
        set: (k, v) => {
            if (ok) {
                try {
                    localStorage.setItem(k, JSON.stringify(v));
                    return true;
                } catch (e) {
                    return false;
                }
            } else {
                const idx = memory.findIndex(m => m.k === k);
                if (idx >= 0) memory[idx].v = v;
                else memory.push({ k, v });
                return true;
            }
        },
        remove: (k) => {
            if (ok) {
                try {
                    localStorage.removeItem(k);
                } catch (e) { }
            } else {
                memory = memory.filter(m => m.k !== k);
            }
        }
    };
})();
