importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");

self.onmessage = function(e) {
    const code = e.data;

    try {

        const isLarge = code.length > 500000; // ~500KB

        const options = isLarge
            ? {
                compact: true,
                stringArray: true,
                rotateStringArray: true
            }
            : {
                compact: true,
                controlFlowFlattening: true,
                deadCodeInjection: true,
                stringArray: true,
                stringArrayEncoding: ['base64'],
                rotateStringArray: true,
                selfDefending: true
            };

        const result = JavaScriptObfuscator.obfuscate(code, options);

        self.postMessage(result.getObfuscatedCode());

    } catch (err) {
        self.postMessage("Error during obfuscation: " + err.message);
    }
};
