const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('quotaBridge', Object.freeze({
 connect: (kind, id, key, relay) => ipcRenderer.invoke('quota:connect', kind, id, key, relay),
 refresh: (kind, id) => ipcRenderer.invoke('quota:refresh', kind, id),
 disconnect: (kind, id) => ipcRenderer.invoke('quota:disconnect', kind, id),
 connected: () => ipcRenderer.invoke('quota:connected'),
 openExternal: url => ipcRenderer.invoke('quota:openExternal', url),
 updateWidgetAccounts: accounts => ipcRenderer.invoke('quota:updateWidgetAccounts', accounts),
  webOpen: (kind,id) => ipcRenderer.invoke('quota:webOpen',kind,id),
  webRead: (kind,id) => ipcRenderer.invoke('quota:webRead',kind,id),
  webBind: (kind,id,choice) => ipcRenderer.invoke('quota:webBind',kind,id,choice),
  webSample: (kind,id) => ipcRenderer.invoke('quota:webSample',kind,id),
  webUnbind: id => ipcRenderer.invoke('quota:webUnbind',id),
  webBindings: () => ipcRenderer.invoke('quota:webBindings'),
  history: id => ipcRenderer.invoke('quota:history',id),
  historyRecord: point => ipcRenderer.invoke('quota:historyRecord',point),
  identityStatus: () => ipcRenderer.invoke('identity:status'),
  googleConfigure: clientId => ipcRenderer.invoke('identity:configure',clientId),
  googleSignIn: () => ipcRenderer.invoke('identity:signIn'),
  googleSignOut: () => ipcRenderer.invoke('identity:signOut'),
  googleCancel: () => ipcRenderer.invoke('identity:cancel'),
  onIdentity: callback => {
    if(typeof callback!=='function')return ()=>{};
    const listener=(_event,status)=>callback(status);
    ipcRenderer.on('identity:changed',listener);
    return ()=>ipcRenderer.removeListener('identity:changed',listener);
  },
  onSnapshot: callback => {
    if(typeof callback!=='function')return ()=>{};
    const listener=(_event,payload)=>callback(payload);
    ipcRenderer.on('quota:snapshot',listener);
    return ()=>ipcRenderer.removeListener('quota:snapshot',listener);
  }
}));

contextBridge.exposeInMainWorld('quotaWidget', Object.freeze({
  setLayout: layout => ipcRenderer.invoke('widget:setLayout', layout),
  resize: (width,height) => ipcRenderer.invoke('widget:resize',width,height),
  setAppearance: changes => ipcRenderer.invoke('widget:setAppearance', changes),
  toggle: () => ipcRenderer.invoke('widget:toggle'),
  hideToTray: () => ipcRenderer.invoke('widget:hideToTray'),
  setCollapseMode: mode => ipcRenderer.invoke('widget:setCollapseMode', mode),
  getSettings: () => ipcRenderer.invoke('widget:getSettings'),
  getAccounts: () => ipcRenderer.invoke('widget:getAccounts'),
  refreshAccounts: () => ipcRenderer.invoke('widget:refreshAccounts'),
  onAccounts: callback => {
    if(typeof callback!=='function')return ()=>{};
    const fn=(_event,accounts)=>callback(accounts);
    ipcRenderer.on('widget:accounts',fn);
    return ()=>ipcRenderer.removeListener('widget:accounts',fn);
  },
  onSettings: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on('widget:settings',listener);
    return () => ipcRenderer.removeListener('widget:settings',listener);
  },
  openDashboard: () => ipcRenderer.invoke('widget:dashboard')
}));
