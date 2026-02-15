importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");

self.onmessage = function (e) {
    let { code, options } = e.data;

    try {
        code = code.replace(/^\uFEFF/, "");
        const isLarge = code.length > 500000;

        // 🔧 Extract function names used in HTML event handlers
        function extractHTMLEventFunctions(htmlCode) {
            const funcNames = new Set();
            
            // Match onclick="funcName()", onchange="funcName()", etc.
            const eventPattern = /\bon\w+\s*=\s*["']?\s*([a-zA-Z_$][\w$]*)\s*\(/gi;
            let match;
            while ((match = eventPattern.exec(htmlCode)) !== null) {
                funcNames.add(match[1]);
            }
            
            // Match href="javascript:funcName()"
            const hrefPattern = /href\s*=\s*["']javascript:\s*([a-zA-Z_$][\w$]*)\s*\(/gi;
            while ((match = hrefPattern.exec(htmlCode)) !== null) {
                funcNames.add(match[1]);
            }
            
            return Array.from(funcNames);
        }

        // 🔧 Extract element IDs used in JavaScript
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
                while ((match = pattern.exec(jsCode)) !== null) {
                    ids.add(match[1]);
                }
            }
            
            return Array.from(ids);
        }

        function getConfig(preset, fullCode, isHTML) {
            // Extract identifiers to preserve
            const htmlFunctions = isHTML ? extractHTMLEventFunctions(fullCode) : [];
            const elementIds = extractElementIds(fullCode);
            
            let config = {
                compact: true,
                target: "browser",
                ignoreImports: true,

                // 🔧 FIXED: Disable dangerous options
                renameGlobals: false,        // ❌ Was breaking onclick handlers
                transformObjectKeys: false,  // ❌ Was breaking DOM properties
                splitStrings: false,         // ❌ Was breaking selectors

                // ✅ Safe string obfuscation
                stringArray: true,
                stringArrayEncoding: ["base64"],
                stringArrayThreshold: 0.75,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayIndexShift: true,

                // ✅ Safe transformations
                simplify: true,
                numbersToExpressions: true,
                identifierNamesGenerator: "hexadecimal",

                // 🔧 Preserve HTML-referenced functions
                reservedNames: [
                    ...htmlFunctions,
                    "^on.*",           // Event handler naming convention
                    "^handle.*",       // Common handler prefix
                    "^init.*",         // Initialization functions
                    "^render.*",       // Render functions
                    "^update.*",       // Update functions
                    "^toggle.*",       // Toggle functions
                    "^show.*",         // Show functions
                    "^hide.*",         // Hide functions
                    "^set.*",          // Setter functions
                    "^get.*",          // Getter functions
                ],

                // 🔧 Preserve DOM selectors
                reservedStrings: elementIds.map(id => escapeRegex(id)),
            };

            if (preset === "medium") {
                config.controlFlowFlattening = true;
                config.controlFlowFlatteningThreshold = 0.5; // 🔧 Reduced
            }

            if (preset === "heavy") {
                config.controlFlowFlattening = true;
                config.controlFlowFlatteningThreshold = 0.75; // 🔧 Reduced from 1

                config.deadCodeInjection = true;
                config.deadCodeInjectionThreshold = 0.3; // 🔧 Reduced

                // ⚠️ Only enable if explicitly requested
                if (options.selfDefending) {
                    config.selfDefending = true;
                }
                if (options.debugProtection) {
                    config.debugProtection = true;
                    config.debugProtectionInterval = 4000;
                }
                if (options.disableConsole) {
                    config.disableConsoleOutput = true;
                }
            }

            if (isLarge) {
                config.deadCodeInjection = false;
                config.selfDefending = false;
                config.debugProtection = false;
                config.controlFlowFlatteningThreshold = 0.3;
            }

            return config;
        }

        // Helper to escape regex special characters
        function escapeRegex(str) {
            return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        }

        const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
        const isHTML = scriptRegex.test(code);
        scriptRegex.lastIndex = 0; // Reset regex

        if (isHTML) {
            // Get HTML part (without script contents) for function extraction
            const config = getConfig(options.preset, code, true);

            const updatedHTML = code.replace(scriptRegex, (match, attributes, content) => {
                // Skip external scripts
                if (/src\s*=/i.test(attributes)) return match;
                
                // Skip JSON/template scripts
                if (/type\s*=\s*["']?(application\/json|application\/ld\+json|text\/template|text\/html)/i.test(attributes)) {
                    return match;
                }
                
                // Skip empty scripts
                if (!content.trim()) return match;

                try {
                    // 🔧 Find functions defined in this script
                    const definedFunctions = [];
                    
                    // function declarations
                    const funcDeclare = /function\s+([a-zA-Z_$][\w$]*)\s*\(/g;
                    let m;
                    while ((m = funcDeclare.exec(content)) !== null) {
                        definedFunctions.push(m[1]);
                    }
                    
                    // const/let/var function expressions
                    const funcExpr = /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[a-zA-Z_$][\w$]*\s*=>)/g;
                    while ((m = funcExpr.exec(content)) !== null) {
                        definedFunctions.push(m[1]);
                    }

                    // Check which functions are used in HTML attributes
                    const htmlWithoutScripts = code.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
                    const usedInHTML = definedFunctions.filter(fn => {
                        const pattern = new RegExp('\\b' + fn + '\\s*\\(', 'g');
                        return pattern.test(htmlWithoutScripts);
                    });

                    // Create script-specific config
                    const scriptConfig = { ...config };
                    scriptConfig.reservedNames = [
                        ...(config.reservedNames || []),
                        ...usedInHTML
                    ];

                    const result = JavaScriptObfuscator.obfuscate(content, scriptConfig);
                    return `<script${attributes}>${result.getObfuscatedCode()}</script>`;
                } catch (err) {
                    console.error("Obfuscation error:", err);
                    return match; // Return original on error
                }
            });

            self.postMessage({ success: true, code: updatedHTML });
        } else {
            // Pure JavaScript
            const config = getConfig(options.preset, code, false);
            const result = JavaScriptObfuscator.obfuscate(code, config);
            self.postMessage({ success: true, code: result.getObfuscatedCode() });
        }

    } catch (err) {
        self.postMessage({ success: false, error: "Error: " + err.message });
    }
};
