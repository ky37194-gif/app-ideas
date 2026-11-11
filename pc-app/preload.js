// Lets the App Ideas site know it runs inside the PC app: Google login through your normal browser,
// and "open the main window" from the Alt+I popup.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appIdeasPC', {
  googleLogin: () => ipcRenderer.invoke('google-login'),
  showMain: () => ipcRenderer.send('show-main'),
});
