(function(payload) {
  var HOST = 'https://meridian-hlag.com';

  // Open or focus the Meridian tab by name
  var tab = window.open(HOST, 'meridian-app');

  // Post message after short delay to allow tab to load/focus
  setTimeout(function() {
    try {
      tab.postMessage(payload, HOST);
    } catch(e) {
      console.error('[Meridian] postMessage to tab failed:', e);
    }
  }, 800);
})(MERIDIAN_PAYLOAD);
