importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");

self.onmessage = function (e) {
    const { code, options } = e.data;

    try {
        const cleanCode = code.replace(/^\uFEFF/, ""); // Remove BOM
        const isLarge = cleanCode.length > 500000;

        // --- THE FORTRESS CONFIGURATION ---
        let config = {
            compact: true,
            target: "browser",
            
            // 1. Variable Renaming (Hexadecimal is harder to read than 'a', 'b', 'c')
            identifierNamesGenerator: options.renameVars ? 'hexadecimal' : 'mangled',
            renameGlobals: false,

            // 2. String Encryption (Strong RC4)
            stringArray: options.stringArray,
            stringArrayEncoding: options.stringArray ? ['rc4'] : [], // RC4 is stronger than Base64
            stringArrayThreshold: options.stringArray ? 1 : 0, // Encrypt 100% of strings
            stringArrayWrappersChainedCalls: true, // Chain calls to confuse de-obfuscators
            splitStrings: true, // Break "https://google.com" into "ht" + "tps" + ...
            splitStringsChunkLength: 5,

            // 3. Control Flow (The Maze)
            controlFlowFlattening: options.controlFlow,
            controlFlowFlatteningThreshold: options.controlFlow ? 1 : 0, // 1 = Flatten everything

            // 4. Dead Code (Decoys)
            deadCodeInjection: options.deadCode && !isLarge, // Disabled on large files to prevent crashing
            deadCodeInjectionThreshold: 0.2,

            // 5. Number Hiding (Math Expressions)
            numbersToExpressions: options.mathHiding, // Turns 123 into 0x1a + 0x5...

            // 6. Anti-Tamper & Security
            selfDefending: options.selfDefending && !isLarge, // Code breaks if formatted
            debugProtection: options.debugProtection, // Freezes DevTools
            debugProtectionInterval: 4000, // Check every 4 seconds
            disableConsoleOutput: options.disableConsole, // console.log becomes void
            
            // 7. Domain Lock (The Kill Switch)
            domainLock: options.domainLock ? options.domainLock.split(',').map(d => d.trim()) : [],
            domainLockRedirectUrl: 'about:blank', // Redirects attacker to blank page
            
            // 8. Object Key Transformation
            transformObjectKeys: true, // Obj.data becomes Obj['\x64\x61\x74\x61']
        };

        // --- PRESET OVERRIDES ---
        // If the user selects "Extreme", we force settings to maximum regardless of toggles
        if (options.preset === 'extreme') {
            config.controlFlowFlatteningThreshold = 1;
            config.deadCodeInjectionThreshold = 0.5;
            config.stringArrayThreshold = 1;
            config.stringArrayEncoding = ['rc4'];
            config.transformObjectKeys = true;
            config.numbersToExpressions = true;
        }

        // --- EXECUTION ---
        
        // Check if HTML or JS
        const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

        if (scriptRegex.test(cleanCode)) {
            // Processing HTML
            const obfuscatedHTML = cleanCode.replace(scriptRegex, (match, attrs, content) => {
                // Ignore src links or JSON
                if (/src\s*=/i.test(attrs) || /type\s*=\s*["']?application\//i.test(attrs)) return match;
                if (!content.trim()) return match;

                try {
                    const res = JavaScriptObfuscator.obfuscate(content, config);
                    return `<script${attrs}>${res.getObfuscatedCode()}</script>`;
                } catch (err) {
                    return match; // Fail safe
                }
            });
            self.postMessage({ result: obfuscatedHTML });

        } else {
            // Processing Pure JS
            const res = JavaScriptObfuscator.obfuscate(cleanCode, config);
            self.postMessage({ result: res.getObfuscatedCode() });
        }

    } catch (err) {
        self.postMessage({ error: err.message });
    }
};
