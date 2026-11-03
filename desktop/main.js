// «Слово короля» для Windows: браузерная игра (dist/index.html) в окне Electron.
// Сохранения — в localStorage окна (папка %APPDATA%/Slovo korolya). F11 или Alt+Enter — во весь экран.
const { app, BrowserWindow, Menu, shell, screen } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
function open() {
  // Игра рисует 640×360 и увеличивает картинку в целое число раз: окно 1280×720 даёт ровное ×2.
  // Если экран меньше (ноутбук 1366×768), сразу открываемся во весь экран — там ×2 помещается.
  const wa = screen.getPrimaryDisplay().workAreaSize, big = wa.width >= 1300 && wa.height >= 760;
  const w = new BrowserWindow({ width: big ? 1280 : 960, height: big ? 720 : 540, fullscreen: !big && !process.env.SLOVO_SHOT, minWidth: 960, minHeight: 540, useContentSize: true, backgroundColor: '#1a1410', title: 'Слово короля', icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false } });
  Menu.setApplicationMenu(null);
  w.once('ready-to-show', () => w.show());
  w.loadFile(path.join(__dirname, 'index.html'));
  if (process.env.SLOVO_SHOT) w.webContents.once('did-finish-load', () => setTimeout(async () => { const img = await w.webContents.capturePage(); require('fs').writeFileSync(process.env.SLOVO_SHOT, img.toPNG()); app.quit(); }, +(process.env.SLOVO_WAIT || 8000)));
  w.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && (i.key === 'F11' || (i.key === 'Enter' && i.alt))) { w.setFullScreen(!w.isFullScreen()); e.preventDefault(); } });
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
}
app.whenReady().then(open);
app.on('window-all-closed', () => app.quit());
