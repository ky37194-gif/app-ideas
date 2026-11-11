// Lets the App Ideas site know it runs inside the PC app: copy the login from your browser,
// Google login through your normal browser, and "open the main window" from the Alt+I popup.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appIdeasPC', {
  linkLogin: () => ipcRenderer.invoke('link-login'),
  googleLogin: () => ipcRenderer.invoke('google-login'),
  showMain: () => ipcRenderer.send('show-main'),
});
