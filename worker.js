importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");
self.onmessage = function(e) {
    let { code, options } = e.data;
    try {
        code = code.replace(/^\uFEFF/, "");
        const isLarge = code.length > 500000;
        function extractHTMLEventFunctions(htmlCode) {
            const funcNames = new Set();
            const eventPattern = /\bon\w+\s*=\s*["']?\s*([a-zA-Z_$][\w$]*)\s*\(/gi;
            let match;
            while ((match = eventPattern.exec(htmlCode)) !== null) {
                funcNames.add(match[1]);
            }
            const hrefPattern = /href\s*=\s*["']javascript:\s*([a-zA-Z_$][\w$]*)\s*\(/gi;
            while ((match = hrefPattern.exec(htmlCode)) !== null) {
                funcNames.add(match[1]);
            }
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
                while ((match = pattern.exec(jsCode)) !== null) {
                    ids.add(match[1]);
                }
            }
            return Array.from(ids);
        }
        function escapeRegex(str) {
            return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        }
        function getConfig(opts, fullCode, isHTML) {
            const htmlFunctions = isHTML ? extractHTMLEventFunctions(fullCode) : [];
            const elementIds = extractElementIds(fullCode);
            let config = {
                compact: true,
                target: "browser",
                ignoreImports: true,
                renameGlobals: false,
                transformObjectKeys: false,
                splitStrings: false,
                stringArray: opts.stringArray !== false,
                stringArrayEncoding: opts.stringArray ? ["base64"] : [],
                stringArrayThreshold: opts.stringArray ? 0.75 : 0,
                stringArrayRotate: opts.stringArray,
                stringArrayShuffle: opts.stringArray,
                stringArrayIndexShift: opts.stringArray,
                simplify: true,
                numbersToExpressions: true,
                identifierNamesGenerator: "hexadecimal",
                reservedNames: [
                    ...htmlFunctions,
                    "^on.*",
                    "^handle.*",
                    "^init.*",
                    "^render.*",
                    "^update.*",
                    "^toggle.*",
                    "^show.*",
                    "^hide.*",
                    "^set.*",
                    "^get.*",
                ],
                reservedStrings: elementIds.map(id => escapeRegex(id)),
            };
            if (opts.controlFlow) {
                config.controlFlowFlattening = true;
                config.controlFlowFlatteningThreshold = 0.5;
            }
            if (opts.deadCode) {
                config.deadCodeInjection = true;
                config.deadCodeInjectionThreshold = 0.3;
            }
            if (opts.selfDefending) {
                config.selfDefending = true;
            }
            if (isLarge) {
                config.deadCodeInjection = false;
                config.selfDefending = false;
                config.controlFlowFlatteningThreshold = 0.3;
            }
            return config;
        }
        const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
        const isHTML = scriptRegex.test(code);
        scriptRegex.lastIndex = 0;
        if (isHTML) {
            const config = getConfig(options, code, true);
            const updatedHTML = code.replace(scriptRegex, (match, attributes, content) => {
                if (/src\s*=/i.test(attributes)) return match;
                if (/type\s*=\s*["']?(application\/json|application\/ld\+json|text\/template|text\/html)/i.test(attributes)) {
                    return match;
                }
                if (!content.trim()) return match;
                try {
                    const definedFunctions = [];
                    const funcDeclare = /function\s+([a-zA-Z_$][\w$]*)\s*\(/g;
                    let m;
                    while ((m = funcDeclare.exec(content)) !== null) {
                        definedFunctions.push(m[1]);
                    }
                    const funcExpr = /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[a-zA-Z_$][\w$]*\s*=>)/g;
                    while ((m = funcExpr.exec(content)) !== null) {
                        definedFunctions.push(m[1]);
                    }
                    const htmlWithoutScripts = code.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
                    const usedInHTML = definedFunctions.filter(fn => {
                        const pattern = new RegExp('\\b' + fn + '\\s*\\(', 'g');
                        return pattern.test(htmlWithoutScripts);
                    });
                    const scriptConfig = { ...config };
                    scriptConfig.reservedNames = [
                        ...(config.reservedNames || []),
                        ...usedInHTML
                    ];
                    const result = JavaScriptObfuscator.obfuscate(content, scriptConfig);
                    return `<script${attributes}>${result.getObfuscatedCode()}</script>`;
                } catch (err) {
                    return match;
                }
            });
            self.postMessage({ success: true, code: updatedHTML });
        } else {
            const config = getConfig(options, code, false);
            const result = JavaScriptObfuscator.obfuscate(code, config);
            self.postMessage({ success: true, code: result.getObfuscatedCode() });
        }
    } catch (err) {
        self.postMessage({ success: false, error: "Error: " + err.message });
    }
};
