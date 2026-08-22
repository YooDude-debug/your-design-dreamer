/**
 * Statisch im HTML ausgeliefertes Registrierungs-Snippet.
 *
 * Zweck: Analyse-Tools (z. B. PWABuilder) erkennen die Service-Worker-
 * Registrierung direkt im gelieferten HTML, ohne auf React-Hydration zu warten.
 *
 * Regeln (identisch zur Laufzeit-Logik in pwa.ts):
 * - nur Production-Host y-dude.com (inkl. www / Subdomains)
 * - niemals Preview-/Dev-Hosts
 * - respektiert ?sw=off
 * - setzt ein Flag, damit pwa.ts nicht ein zweites Mal registriert
 * - registriert ausschließlich den bestehenden /sw.js mit Scope "/"
 */
export const PWA_INLINE_REGISTER_SCRIPT = `(function(){try{
var h=location.hostname;
if(!(h==="y-dude.com"||h==="www.y-dude.com"||h.endsWith(".y-dude.com")))return;
if(new URLSearchParams(location.search).get("sw")==="off")return;
if(!("serviceWorker" in navigator))return;
window.__ydudeSwRegistered=true;
navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(function(){});
}catch(e){}})();`;
