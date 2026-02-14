importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");

self.onmessage = function(e) {
    let { code, options } = e.data;

    try {
        code = code.replace(/^\uFEFF/, "");

        const isLarge = code.length > 500000;

        let config = {
            compact: true,
            target: "browser",
            ignoreImports: true
        };

        // Apply preset
        if (options.preset === "medium") {
            config.controlFlowFlattening = true;
        }

        if (options.preset === "heavy") {
            config.controlFlowFlattening = true;
            config.deadCodeInjection = true;
        }

        // Apply manual toggles
        if (options.stringArray)
            config.stringArray = true;

        if (options.controlFlow)
            config.controlFlowFlattening = true;

        if (options.deadCode)
            config.deadCodeInjection = true;

        if (options.selfDefending)
            config.selfDefending = true;

        // Safety for large files
        if (isLarge) {
            config.deadCodeInjection = false;
            config.selfDefending = false;
        }

        const result = JavaScriptObfuscator.obfuscate(code, config);

        self.postMessage(result.getObfuscatedCode());

    } catch (err) {
        self.postMessage("Error: " + err.message);
    }
};
