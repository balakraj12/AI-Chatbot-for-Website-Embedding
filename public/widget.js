(function() {
  // Prevent duplicate script loads
  if (window.VartaWidgetInitialized) return;
  window.VartaWidgetInitialized = true;

   // 1. Proactively determine the backend host server based on this script's loaded location
  // This allows the widget to be embedded anywhere (production or local) without hardcoding domains.
  const scriptTag = document.currentScript || (() => {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

   const scriptSrc = scriptTag ? scriptTag.src : 'http://localhost:5000/widget.js';
  const backendUrl = new URL(scriptSrc).origin;
  const iframeUrl = `${backendUrl}/widget-frame`;

  
