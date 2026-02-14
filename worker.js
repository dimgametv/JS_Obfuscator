importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");

self.onmessage = function(e) {
    let code = e.data;

    try {
        // Remove BOM
        code = code.replace(/^\uFEFF/, "");

        const isLarge = code.length > 500000;

        const options = isLarge
            ? {
                compact: true,
                stringArray: true,
                rotateStringArray: true,
                target: 'browser',
                ignoreImports: true
            }
            : {
                compact: true,
                controlFlowFlattening: true,
                deadCodeInjection: false,
                stringArray: true,
                stringArrayEncoding: ['base64'],
                rotateStringArray: true,
                selfDefending: false,
                target: 'browser',
                ignoreImports: true
            };

        const result = JavaScriptObfuscator.obfuscate(code, options);

        self.postMessage(result.getObfuscatedCode());

    } catch (err) {
        self.postMessage("Error during obfuscation: " + err.message);
    }
};
