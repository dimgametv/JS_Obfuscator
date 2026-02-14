importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");

self.onmessage = function (e) {
    let { code, options } = e.data;

    try {
        code = code.replace(/^\uFEFF/, "");

        const isLarge = code.length > 500000;

        let config = {
            compact: true,
            target: "browser",
            ignoreImports: true
        };

        // Presets
        if (options.preset === "medium") {
            config.controlFlowFlattening = true;
        }

        if (options.preset === "heavy") {
            config.controlFlowFlattening = true;
            config.deadCodeInjection = true;
        }

        // Manual toggles
        if (options.stringArray) config.stringArray = true;
        if (options.controlFlow) config.controlFlowFlattening = true;
        if (options.deadCode) config.deadCodeInjection = true;
        if (options.selfDefending) config.selfDefending = true;

        // Large file safety
        if (isLarge) {
            config.deadCodeInjection = false;
            config.selfDefending = false;
        }

        // Detect script blocks
        const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

        if (scriptRegex.test(code)) {

            const updatedHTML = code.replace(scriptRegex, function (match, attributes, content) {

                // Skip external scripts
                if (/src\s*=/i.test(attributes)) {
                    return match;
                }

                // Skip JSON or non-JS types
                if (/type\s*=\s*["']?(application\/json|application\/ld\+json)/i.test(attributes)) {
                    return match;
                }

                // Skip empty scripts
                if (!content.trim()) {
                    return match;
                }

                try {
                    const result = JavaScriptObfuscator.obfuscate(content, config);
                    return `<script${attributes}>${result.getObfuscatedCode()}</script>`;
                } catch {
                    return match;
                }
            });

            self.postMessage(updatedHTML);
            return;
        }

        // If pure JS
        const result = JavaScriptObfuscator.obfuscate(code, config);
        self.postMessage(result.getObfuscatedCode());

    } catch (err) {
        self.postMessage("Error: " + err.message);
    }
};
