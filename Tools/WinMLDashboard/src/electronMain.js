const {app, ipcMain, protocol, BrowserWindow} = require('electron');
const fs = require('fs');
const path = require('path');
const url = require('url');
const log = require('electron-log');

let mainWindow;
let aboutWindow;

log.transports.file.level = 'info';
log.transports.console.level = 'info';

//
// Squirrel is used to handle installation.  
// Process Squirrel events
//
if (handleSquirrelEvent()) {
    // squirrel event handled and app will exit in 1000ms, so don't do anything else
    return;
  }
  
  function handleSquirrelEvent() {
    if (process.argv.length === 1) {
      return false;
    }
  
    const ChildProcess = require('child_process');
    
    const appFolder = path.resolve(process.execPath, '..');
    const rootAtomFolder = path.resolve(appFolder, '..');
    const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
    const exeName = path.basename(process.execPath);
  
    const spawn = function(command, args) {
      let spawnedProcess;
      let error;
  
      try {
        spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
      } catch (error) {app.quit();}
  
      return spawnedProcess;
    };
  
    const spawnUpdate = function(args) {
      return spawn(updateDotExe, args);
    };
  
    const squirrelEvent = process.argv[1];
    log.info('received process.argv[1]: ' + squirrelEvent);
    switch (squirrelEvent) {
      case '--squirrel-install':
      case '--squirrel-updated':
        // Optionally do things such as:
        // - Add your .exe to the PATH
        // - Write to the registry for things like file associations and
        //   explorer context menus
  
        // Install desktop and start menu shortcuts
        log.info('creating shortcut: --createShortcut ' + exeName)
        spawnUpdate(['--createShortcut', exeName]);
    
        setTimeout(app.quit, 1000);
        return true;
  
      case '--squirrel-uninstall':
        // Undo anything you did in the --squirrel-install and
        // --squirrel-updated handlers
  
        // Remove desktop and start menu shortcuts
        spawnUpdate(['--removeShortcut', exeName]);
  
        setTimeout(app.quit, 1000);
        return true;
  
      case '--squirrel-obsolete':
        // This is called on the outgoing version of your app before
        // we update to the new version - it's the opposite of
        // --squirrel-updated
  
        app.quit();
        return true;
    }
};

function interceptFileProtocol() {
    // Intercept the file protocol so that references to folders return its index.html file
    const fileProtocol = 'file';
    const cwd = process.cwd();
    protocol.interceptFileProtocol(fileProtocol, (request, callback) => {
        const fileUrl = new url.URL(request.url);
        const hostname = decodeURI(fileUrl.hostname);
        const filePath = decodeURI(fileUrl.pathname);
        let resolvedPath = path.normalize(filePath);
        if (resolvedPath[0] === '\\') {
            // Remove URL host to pathname separator
            resolvedPath = resolvedPath.substr(1);
        }
        if (hostname) {
            resolvedPath = path.join(hostname, resolvedPath);
            if (process.platform === 'win32') {  // File is on a share
                resolvedPath = `\\\\${resolvedPath}`;
            }
        }
        resolvedPath = path.relative(cwd, resolvedPath);
        try {
            if (fs.statSync(resolvedPath).isDirectory) {
                let index = path.posix.join(resolvedPath, 'index.html');
                if (fs.existsSync(index)) {
                    resolvedPath = index;
                }
            }
        } catch(_) {
            // Use path as is if it can't be accessed
        }
        callback({
            path: resolvedPath,
        });
    });
}

function createWindow() {
    interceptFileProtocol();

    mainWindow = new BrowserWindow({
        height: 600,
        icon: path.join(__dirname, '../public/winml_icon.ico'),
        width: 800,
    });
    global.mainWindow = mainWindow;

    let pageUrl;
    for (const arg of process.argv.slice(1)) {
        if (arg.includes('://')) {
            pageUrl = arg;
            break;
        }
    }
    if (pageUrl === undefined) {
        pageUrl = url.format({
            pathname: path.join(__dirname, '../build/'),
            protocol: 'file',
        });
    }
    mainWindow.loadURL(pageUrl);

    if (process.argv.includes('--dev-tools')) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

ipcMain.on('show-about-window', () => {
    
    openAboutWindow()
})

function openAboutWindow() {
  if (aboutWindow) {
    aboutWindow.focus()
    return
  }

  aboutWindow = new BrowserWindow({
    height: 420,
    icon: path.join(__dirname, '../public/winml_icon.ico'),
    title: "About",
    width: 420,
  })

  aboutWindow.setFullScreenable(false);
  aboutWindow.setMinimizable(false);
  aboutWindow.setResizable(false);
  aboutWindow.setMenu(null);
  aboutWindow.loadURL('file://' + __dirname + '/../public/about.html');

  aboutWindow.on('closed', () => {
    aboutWindow = null
  })
}