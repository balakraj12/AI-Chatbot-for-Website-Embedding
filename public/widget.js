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

   // 2. Inject CSS Styles directly into host head
  const css = `

   /* Floating Launcher Button */
    #varta-launcher {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
       #varta-launcher:hover {
      transform: scale(1.08) rotate(5deg);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    }
    #varta-launcher:active {
      transform: scale(0.95);
    }
