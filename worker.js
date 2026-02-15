importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");

self.onmessage = function (e) {
    let { code, options } = e.data;

    try {
        code = code.replace(/^\uFEFF/, "");
        const isLarge = code.length > 500000;

        // 🔧 Extract function names used in HTML onclick/event handlers
        function extractHTMLFunctionNames(htmlCode) {
            const patterns = [
                /\bon\w+\s*=\s*["']?\s*(\w+)\s*\(/gi,  // onclick="funcName("
                /\bon\w+\s*=\s*["']([^"']+)["']/gi,    // onclick="funcName()"
            ];
            
            const names = new Set();
            for (const pattern of patterns) {
                let match;
                while ((match = pattern.exec(htmlCode)) !== null) {
                    const funcName = match[1].split(/[^a-zA-Z0-9_$]/).filter(Boolean)[0];
                    if (funcName && funcName.length > 1) {
                        names.add(funcName);
                    }
                }
            }
            return Array.from(names);
        }

        // 🔧 Extract element IDs and class names from code
        function extractDOMIdentifiers(jsCode) {
            const patterns = [
                /getElementById\s*\(\s*["']([^"']+)["']\s*\)/gi,
                /getElementsByClassName\s*\(\s*["']([^"']+)["']\s*\)/gi,
                /querySelector(?:All)?\s*\(\s*["']([^"']+)["']\s*\)/gi,
                /\.classList\.(?:add|remove|toggle|contains)\s*\(\s*["']([^"']+)["']\s*\)/gi,
            ];
            
            const identifiers = new Set();
            for (const pattern of patterns) {
                let match;
                while ((match = pattern.exec(jsCode)) !== null) {
                    identifiers.add(match[1]);
                }
            }
            return Array.from(identifiers);
        }

        function getConfig(preset, codeContent, isHTML) {
            // Extract identifiers that should NOT be obfuscated
            const htmlFunctions = isHTML ? extractHTMLFunctionNames(codeContent) : [];
            const domIdentifiers = extractDOMIdentifiers(codeContent);
            
            let config = {
                compact: true,
                target: "browser",
                ignoreImports: true,

                // ✅ SAFE: Basic obfuscation
                renameGlobals: false,  // 🔧 FIXED: Don't rename globals (breaks onclick handlers)
                transformObjectKeys: false,  // 🔧 FIXED: Don't transform object keys (breaks DOM)
                
                // ✅ String protection (with reservations)
                stringArray: true,
                stringArrayEncoding: ["base64"],
                stringArrayThreshold: 0.75,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                
                // 🔧 FIXED: Reserve DOM-related strings
                reservedStrings: [
                    ...domIdentifiers,
                    "\\#.*",      // CSS ID selectors
                    "\\..*",      // CSS class selectors
                    "click",
                    "change", 
                    "submit",
                    "load",
                    "DOMContentLoaded"
                ],

                // 🔧 FIXED: Reserve function names used in HTML
                reservedNames: [
                    ...htmlFunctions,
                    "^on.*",      // Event handlers
                    "^handle.*",  // Common handler naming
                    "^init.*",    // Initialization functions
                ],

                // ✅ Safe transformations
                simplify: true,
                numbersToExpressions: true,
                splitStrings: false,  // 🔧 FIXED: Disabled - breaks selectors
                splitStringsChunkLength: 10,
                
                // Variable renaming
                identifierNamesGenerator: "hexadecimal",
                
                // Unicode escape (safer than string splitting)
                unicodeEscapeSequence: false,
            };

            if (preset === "medium") {
                config.controlFlowFlattening = true;
                config.controlFlowFlatteningThreshold = 0.5;  // 🔧 Reduced from 0.75
            }

            if (preset === "heavy") {
                config.controlFlowFlattening = true;
                config.controlFlowFlatteningThreshold = 0.75;  // 🔧 Reduced from 1

                config.deadCodeInjection = true;
                config.deadCodeInjectionThreshold = 0.3;  // 🔧 Reduced from 0.4

                // ⚠️ Anti-tamper (can cause issues)
                config.selfDefending = options.selfDefending || false;
                config.debugProtection = options.debugProtection || false;
                config.debugProtectionInterval = 4000;
                config.disableConsoleOutput = options.disableConsole || false;
            }

            // Apply individual options
            if (options.stringArray === false) {
                config.stringArray = false;
            }
            if (options.controlFlow) {
                config.controlFlowFlattening = true;
                config.controlFlowFlatteningThreshold = 0.5;
            }
            if (options.deadCode) {
                config.deadCodeInjection = true;
                config.deadCodeInjectionThreshold = 0.3;
            }

            if (isLarge) {
                config.deadCodeInjection = false;
                config.selfDefending = false;
                config.debugProtection = false;
                config.controlFlowFlatteningThreshold = 0.3;
            }

            return config;
        }

        const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
        const isHTML = scriptRegex.test(code);
        
        // Reset regex
        scriptRegex.lastIndex = 0;

        if (isHTML) {
            const config = getConfig(options.preset, code, true);
            
            const updatedHTML = code.replace(scriptRegex, (match, attributes, content) => {
                // Skip external scripts
                if (/src\s*=/i.test(attributes)) return match;
                // Skip JSON
                if (/type\s*=\s*["']?(application\/json|application\/ld\+json|text\/template)/i.test(attributes)) {
                    return match;
                }
                // Skip empty
                if (!content.trim()) return match;

                try {
                    // 🔧 Create script-specific config with HTML context
                    const scriptConfig = { ...config };
                    
                    // Extract functions from THIS script that are used in HTML
                    const funcPattern = /function\s+(\w+)/g;
                    let funcMatch;
                    const scriptFunctions = [];
                    while ((funcMatch = funcPattern.exec(content)) !== null) {
                        scriptFunctions.push(funcMatch[1]);
                    }
                    
                    // Also catch arrow functions assigned to variables
                    const arrowPattern = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/g;
                    while ((funcMatch = arrowPattern.exec(content)) !== null) {
                        scriptFunctions.push(funcMatch[1]);
                    }
                    
                    // Check which functions are referenced in HTML
                    const htmlPart = code.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
                    const usedInHTML = scriptFunctions.filter(fn => {
                        const regex = new RegExp(`\\b${fn}\\s*\\(`, 'g');
                        return regex.test(htmlPart);
                    });
                    
                    scriptConfig.reservedNames = [
                        ...(config.reservedNames || []),
                        ...usedInHTML
                    ];
                    
                    const result = JavaScriptObfuscator.obfuscate(content, scriptConfig);
                    return `<script${attributes}>${result.getObfuscatedCode()}</script>`;
                } catch (err) {
                    console.error("Script obfuscation error:", err);
                    return match;
                }
            });

            self.postMessage({ success: true, code: updatedHTML });
        } else {
            const config = getConfig(options.preset, code, false);
            const result = JavaScriptObfuscator.obfuscate(code, config);
            self.postMessage({ success: true, code: result.getObfuscatedCode() });
        }

    } catch (err) {
        self.postMessage({ success: false, error: "Error: " + err.message });
    }
};
