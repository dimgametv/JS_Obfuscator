importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");

self.onmessage = function (e) {
    let { code, options } = e.data;

    try {

        code = code.replace(/^\uFEFF/, "");
        const isLarge = code.length > 500000;

        function getConfig(preset) {
            let config = {
                compact: true,
                target: "browser",
                ignoreImports: true,

                // 🔑 Semantic gap protection
                renameGlobals: true,
                transformObjectKeys: true,
                stringArray: true,
                stringArrayEncoding: ["base64"],
                stringArrayThreshold: 0.75,
                stringArrayRotate: true,
                stringArrayShuffle: true,

                simplify: true,
                numbersToExpressions: true,
                splitStrings: true,
                splitStringsChunkLength: 10
            };

            if (preset === "medium") {
                config.controlFlowFlattening = true;
                config.controlFlowFlatteningThreshold = 0.75;
            }

            if (preset === "heavy") {
                config.controlFlowFlattening = true;
                config.controlFlowFlatteningThreshold = 1;

                config.deadCodeInjection = true;
                config.deadCodeInjectionThreshold = 0.4;

                // 🔐 Full anti-tamper protection
                config.selfDefending = true;
                config.debugProtection = true;
                config.debugProtectionInterval = 4000;
                config.disableConsoleOutput = true;
            }

            if (isLarge) {
                config.deadCodeInjection = false;
                config.selfDefending = false;
                config.debugProtection = false;
            }

            return config;
        }

        const config = getConfig(options.preset);

        const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

        if (scriptRegex.test(code)) {

            const updatedHTML = code.replace(scriptRegex, (match, attributes, content) => {

                if (/src\s*=/i.test(attributes)) return match;
                if (/type\s*=\s*["']?(application\/json|application\/ld\+json)/i.test(attributes))
                    return match;
                if (!content.trim()) return match;

                try {
                    const result = JavaScriptObfuscator.obfuscate(content, config);
                    return `<script${attributes}>${result.getObfuscatedCode()}</script>`;
                } catch {
                    return match;
                }
            });

            self.postMessage(updatedHTML);
        } else {
            const result = JavaScriptObfuscator.obfuscate(code, config);
            self.postMessage(result.getObfuscatedCode());
        }

    } catch (err) {
        self.postMessage("Error: " + err.message);
    }
};
