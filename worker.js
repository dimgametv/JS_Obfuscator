importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");

self.onmessage = function(e) {
    let { code, options } = e.data;

    try {
        code = code.replace(/^\uFEFF/, "");

        const isHTML = /<script[\s\S]*?>[\s\S]*?<\/script>/gi.test(code);

        const isLarge = code.length > 500000;

        let config = {
            compact: true,
            target: "browser",
            ignoreImports: true
        };

        if (options.preset === "medium") {
            config.controlFlowFlattening = true;
        }

        if (options.preset === "heavy") {
            config.controlFlowFlattening = true;
            config.deadCodeInjection = true;
        }

        if (options.stringArray)
            config.stringArray = true;

        if (options.controlFlow)
            config.controlFlowFlattening = true;

        if (options.deadCode)
            config.deadCodeInjection = true;

        if (options.selfDefending)
            config.selfDefending = true;

        if (isLarge) {
            config.deadCodeInjection = false;
            config.selfDefending = false;
        }

        // 🔥 If HTML, extract and replace scripts
        if (isHTML) {

            const updatedHTML = code.replace(
                /<script(.*?)>([\s\S]*?)<\/script>/gi,
                function(match, attributes, scriptContent) {

                    // Skip external scripts
                    if (/src\s*=/i.test(attributes)) {
                        return match;
                    }

                    try {
                        const result = JavaScriptObfuscator.obfuscate(scriptContent, config);
                        return `<script${attributes}>${result.getObfuscatedCode()}</script>`;
                    } catch {
                        return match;
                    }
                }
            );

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
