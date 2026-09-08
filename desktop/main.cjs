const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");

let mainWindow = null;

function loadSetup(edit = false) {
  if (!mainWindow) return;
  mainWindow.loadFile(path.join(__dirname, "setup.html"), {
    query: edit ? { edit: "1" } : {},
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1450,
    height: 930,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: "#07080b",
    title: "NEXORA Control",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const forcedUrl = String(process.env.NEXORA_APP_URL || "").trim();
  if (forcedUrl) {
    mainWindow.loadURL(forcedUrl);
  } else {
    loadSetup(false);
  }

  const menu = Menu.buildFromTemplate([
    {
      label: "NEXORA",
      submenu: [
        {
          label: "Control URLを変更",
          click: () => loadSetup(true),
        },
        {
          label: "再読み込み",
          accelerator: "Ctrl+R",
          click: () => mainWindow?.webContents.reload(),
        },
        { type: "separator" },
        { role: "quit", label: "終了" },
      ],
    },
    {
      label: "表示",
      submenu: [
        { role: "zoomIn", label: "拡大" },
        { role: "zoomOut", label: "縮小" },
        { role: "resetZoom", label: "100%" },
        { type: "separator" },
        { role: "togglefullscreen", label: "全画面" },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
