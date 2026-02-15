importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");

self.onmessage = function (e) {
    // 1. Get the data
    let { code, options } = e.data;

    try {
        // Remove BOM if present
        code = code.replace(/^\uFEFF/, "");
        const isLarge = code.length > 500000;

        // --- HELPER FUNCTIONS ---

        function extractHTMLEventFunctions(htmlCode) {
            const funcNames = new Set();
            // Match onclick="funcName()", etc.
            const eventPattern = /\bon\w+\s*=\s*["']?\s*([a-zA-Z_$][\w$]*)\s*\(/gi;
            let match;
            while ((match = eventPattern.exec(htmlCode)) !== null) funcNames.add(match[1]);
            
            // Match href="javascript:funcName()"
            const hrefPattern = /href\s*=\s*["']javascript:\s*([a-zA-Z_$][\w$]*)\s*\(/gi;
            while ((match = hrefPattern.exec(htmlCode)) !== null) funcNames.add(match[1]);
            
            return Array.from(funcNames);
        }

        function extractElementIds(jsCode) {
            const ids = new Set();
            const patterns = [
                /getElementById\s*\(\s*["']([^"']+)["']\s*\)/gi,
                /querySelector\s*\(\s*["']#([^"'\s\[>]+)["']\s*\)/gi,
                /getElementsByClassName\s*\(\s*["']([^"']+)["']\s*\)/gi,
                /querySelector(?:All)?\s*\(\s*["']\.([^"'\s\[>]+)["']\s*\)/gi,
            ];
            for (const pattern of patterns) {
                let match;
                while ((match = pattern.exec(jsCode)) !== null) ids.add(match[1]);
            }
            return Array.from(ids);
        }

        function escapeRegex(str) {
            return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        }

        function getConfig(preset, fullCode, isHTML) {
            const htmlFunctions = isHTML ? extractHTMLEventFunctions(fullCode) : [];
            const elementIds = extractElementIds(fullCode);
            
            let config = {
                compact: true,
                target: "browser",
                ignoreImports: true,
                renameGlobals: false,
                transformObjectKeys: false,
                splitStrings: false,
                
                // Obfuscation Settings
                stringArray: true,
                stringArrayEncoding: ['base64'], // Correct format
                stringArrayThreshold: 0.75,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayIndexShift: true,
                simplify: true,
                numbersToExpressions: true,
                identifierNamesGenerator: "hexadecimal",

                // Protection (Preserve Names)
                reservedNames: [
                    ...htmlFunctions,
                    "^on.*", "^handle.*", "^init.*", "^render.*", 
                    "^update.*", "^toggle.*", "^show.*", "^hide.*", 
                    "^set.*", "^get.*"
                ],
                reservedStrings: elementIds.map(id => escapeRegex(id)),
            };

            if (preset === "medium") {
                config.controlFlowFlattening = true;
                config.controlFlowFlatteningThreshold = 0.5;
            }

            if (preset === "heavy") {
                config.controlFlowFlattening = true;
                config.controlFlowFlatteningThreshold = 0.75;
                config.deadCodeInjection = true;
                config.deadCodeInjectionThreshold = 0.3;
                
                if (options.selfDefending) config.selfDefending = true;
                // Note: debugProtection can cause loops in some browsers, use with caution
                if (options.debugProtection) config.debugProtection = false; 
            }

            if (isLarge) {
                config.deadCodeInjection = false;
                config.selfDefending = false;
                config.controlFlowFlatteningThreshold = 0.3;
            }

            return config;
        }

        // --- MAIN LOGIC ---

        const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
        const isHTML = scriptRegex.test(code);
        scriptRegex.lastIndex = 0; // Reset regex

        if (isHTML) {
            // HTML MODE
            const config = getConfig(options.preset, code, true);
            
            const updatedHTML = code.replace(scriptRegex, (match, attributes, content) => {
                if (/src\s*=/i.test(attributes)) return match;
                if (/type\s*=\s*["']?(application\/json|text\/template)/i.test(attributes)) return match;
                if (!content.trim()) return match;

                try {
                    // Extract local function names to prevent renaming them if they are used in HTML
                    // (Simplified logic for performance)
                    const scriptConfig = { ...config };
                    
                    const result = JavaScriptObfuscator.obfuscate(content, scriptConfig);
                    return `<script${attributes}>${result.getObfuscatedCode()}</script>`;
                } catch (err) {
                    // THROW error so the main catch block handles it
                    throw new Error("Failed to obfuscate script tag: " + err.message);
                }
            });

            // FIXED: Send JUST the code string
            self.postMessage(updatedHTML);

        } else {
            // JS MODE
            const config = getConfig(options.preset, code, false);
            const result = JavaScriptObfuscator.obfuscate(code, config);
            
            // FIXED: Send JUST the code string
            self.postMessage(result.getObfuscatedCode());
        }

    } catch (err) {
        // FIXED: Send error as a string starting with "Error:"
        self.postMessage("Error: " + err.message);
    }
};
