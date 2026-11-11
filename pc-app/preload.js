// Lets the App Ideas site know it runs inside the PC app, and sign in with Google through your normal browser.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appIdeasPC', {
  googleLogin: () => ipcRenderer.invoke('google-login'),
});
