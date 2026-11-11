// App Ideas for Windows: the live site in its own window + Alt+I quick Inbox popup.
// The site itself lives on Vercel, so every push shows up here with no rebuild.
const { app, BrowserWindow, globalShortcut, Tray, Menu, shell, nativeImage, screen } = require('electron');
const path = require('path');

const SITE = 'https://app-ideas-beta.vercel.app/';
const ORIGIN = new URL(SITE).origin;
const ICON = path.join(__dirname, 'icon.png');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}
app.setAppUserModelId('com.ky.appideas.pc');
// Google refuses sign-in inside apps that say "Electron" — present as normal Chrome instead.
app.userAgentFallback = app.userAgentFallback.replace(/\s?Electron\/\S+/, '').replace(/\s?app-ideas-pc\/\S+/i, '');

let win = null;
let pop = null;
let tray = null;
let hotkey = '';
let quitting = false;

// Links to other sites open in the normal browser; Google sign-in pop-ups stay inside.
function handleLinks(contents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(ORIGIN) || /^https:\/\/accounts\.google\.com\//.test(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN) && !/^https:\/\/accounts\.google\.com\//.test(url)) { e.preventDefault(); shell.openExternal(url); }
  });
}

// No internet → a small retry page instead of a blank window.
function offlinePage(target) {
  const html = `<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0b0f19;color:#e5e7eb;font:15px 'Segoe UI',sans-serif">
    <div style="text-align:center"><div style="font-size:42px">📡</div><h2 style="margin:8px 0">Internet nahi mila</h2>
    <p style="color:#9ca3af">App Ideas online chalta hai. Internet aate hi dobara try karo.</p>
    <button onclick="location.href='${target}'" style="margin-top:8px;padding:10px 20px;border:0;border-radius:10px;background:#6366f1;color:#fff;font:600 14px 'Segoe UI';cursor:pointer">🔄 Dobara try karo</button></div></body>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function load(w, url) {
  w.webContents.on('did-fail-load', (_e, code, _desc, failedUrl, isMain) => {
    if (isMain && code !== -3) w.loadURL(offlinePage(failedUrl || url)); // -3 = navigation replaced, not an error
  });
  w.loadURL(url);
}

function createWindow() {
  const area = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(1360, area.width - 80),
    height: Math.min(880, area.height - 60),
    minWidth: 380,
    minHeight: 500,
    title: 'App Ideas',
    icon: ICON,
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, spellcheck: true },
  });
  win.removeMenu();
  handleLinks(win.webContents);
  load(win, SITE);
  // Started with Windows (--hidden) → stay in the tray until you need it.
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  // Closing the window keeps the app in the tray, so Alt+I still works.
  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });
}

function showMain(hash) {
  if (!win || win.isDestroyed()) createWindow();
  if (hash) win.webContents.executeJavaScript(`location.hash = ${JSON.stringify(hash)}`).catch(() => {});
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// Alt+I: small window → type → Enter → it goes to 📥 Inbox and the window closes itself.
function openPop() {
  if (pop && !pop.isDestroyed()) {
    if (pop.isVisible() && pop.isFocused()) { pop.close(); return; }
    pop.show(); pop.focus(); return;
  }
  const area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const W = 600, H = 250;
  pop = new BrowserWindow({
    width: W,
    height: H,
    x: Math.round(area.x + (area.width - W) / 2),
    y: Math.round(area.y + area.height / 4),
    title: '⚡ Inbox me likho',
    icon: ICON,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, spellcheck: true },
  });
  pop.removeMenu();
  handleLinks(pop.webContents);
  load(pop, SITE + '#/pop');
  pop.once('ready-to-show', () => { pop.show(); pop.focus(); });
  pop.on('closed', () => {
    pop = null;
    // The main window reads the new note from shared storage; nudge it to sync too.
    if (win && !win.isDestroyed()) win.webContents.executeJavaScript('typeof syncNow === "function" && syncNow()').catch(() => {});
  });
}

function registerHotkey() {
  for (const [accel, label] of [['Alt+I', 'Alt+I'], ['Control+Shift+I', 'Ctrl+Shift+I']]) {
    try { if (globalShortcut.register(accel, openPop)) { hotkey = label; return; } } catch {}
  }
}

function trayMenu() {
  const login = app.getLoginItemSettings().openAtLogin;
  return Menu.buildFromTemplate([
    { label: 'App Ideas kholo', click: () => showMain() },
    { label: `⚡ Inbox me likho${hotkey ? `   (${hotkey})` : ''}`, click: openPop },
    { label: '📥 Inbox', click: () => showMain('#/inbox') },
    { label: '🎯 Current Project', click: () => showMain('#/current') },
    { type: 'separator' },
    { label: 'PC on hote hi chalu karo (Alt+I hamesha chale)', type: 'checkbox', checked: login,
      click: (m) => { app.setLoginItemSettings({ openAtLogin: m.checked, args: ['--hidden'] }); tray.setContextMenu(trayMenu()); } },
    { type: 'separator' },
    { label: 'Band karo (Quit)', click: () => { quitting = true; app.quit(); } },
  ]);
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip(`App Ideas${hotkey ? ` — ${hotkey} = Inbox me likho` : ''}`);
  tray.setContextMenu(trayMenu());
  tray.on('click', () => showMain());
}

app.on('second-instance', () => showMain());

app.whenReady().then(() => {
  registerHotkey();
  createTray();
  createWindow();
});

app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', (e) => e.preventDefault());
