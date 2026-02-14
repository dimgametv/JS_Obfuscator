importScripts("https://cdn.jsdelivr.net/npm/javascript-obfuscator/dist/index.browser.js");

self.onmessage = function(e){

    let {code, preset} = e.data;

    let config = {
        compact:true,
        target:"browser"
    };

    if(preset==="medium"){
        config.controlFlowFlattening = true;
    }

    if(preset==="heavy"){
        config.controlFlowFlattening = true;
        config.deadCodeInjection = true;
        config.selfDefending = true;
        config.stringArray = true;
    }

    const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

    if(scriptRegex.test(code)){
        const resultHTML = code.replace(scriptRegex,(match,attrs,content)=>{
            if(/src\s*=/i.test(attrs)) return match;
            if(!content.trim()) return match;

            try{
                const obf = JavaScriptObfuscator.obfuscate(content,config);
                return `<script${attrs}>${obf.getObfuscatedCode()}</script>`;
            }catch{
                return match;
            }
        });

        self.postMessage(resultHTML);
        return;
    }

    const result = JavaScriptObfuscator.obfuscate(code,config);
    self.postMessage(result.getObfuscatedCode());
};
