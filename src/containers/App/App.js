import React, {Component} from 'react';
import notie from 'notie';
import {
  AppBar,
  Dialog,
  List,
  ListItem,
  Toggle,
  FlatButton,
  Divider,
  Subheader
} from 'material-ui';

import {
  ActionPowerSettingsNew,
  ImageTransform,
  ContentAdd,
  ActionSettings
} from 'material-ui/svg-icons';

import {ScreenMask, ServerItem} from '../../components';
import {AppSlider, ClientEditor, ServerEditor} from '../../containers';
import './App.css';

const {ipcRenderer} = window.require('electron');

const DEFAULT_CONFIG_STRUCTURE = {
  host: 'localhost',
  port: 1080,
  servers: [{
    enabled: false,
    remarks: 'Default Server',
    transport: 'tcp',
    host: 'example.com',
    port: 23333,
    key: '',
    presets: [{
      name: 'ss-base',
      params: {}
    }]
  }],
  timeout: 600,
  profile: false,
  watch: true,
  log_level: 'info',
  pac: 'http://localhost:1090/blinksocks.pac',
  pac_on: true
};

const BLINKSOCKS_CONFIG_FILE = './blinksocks.client.js';

function loadConfig() {
  const {require, process} = window; // prevent webpack breaking node modules
  const fs = require('fs');
  const path = require('path');

  let json;
  // resolve to absolute path
  const file = path.join(process.cwd(), BLINKSOCKS_CONFIG_FILE);
  try {
    const ext = path.extname(file);
    if (ext === '.js') {
      // require .js directly
      delete require.cache[require.resolve(file)];
      json = require(file);
    } else {
      // others are treated as .json
      const jsonFile = fs.readFileSync(file);
      json = JSON.parse(jsonFile);
    }
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'MODULE_NOT_FOUND') {
      saveConfig(DEFAULT_CONFIG_STRUCTURE);
      return DEFAULT_CONFIG_STRUCTURE;
    }
    throw Error(`fail to load/parse your '${BLINKSOCKS_CONFIG_FILE}': ${err}`);
  }
  return json;
}

function saveConfig(json) {
  const {require, process} = window; // prevent webpack breaking node modules
  const fs = require('fs');
  const path = require('path');
  const file = path.join(process.cwd(), BLINKSOCKS_CONFIG_FILE);
  const data = `module.exports = ${JSON.stringify(json, null, '  ')};`;
  fs.writeFile(file, data, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

function toast(message) {
  notie.alert({text: message, position: 'bottom', stay: false, time: 5});
}

const APP_STATUS_OFF = 0;
const APP_STATUS_RUNNING = 1;
const APP_STATUS_RESTARTING = 2;

export class App extends Component {

  state = {
    config: null,
    appStatus: APP_STATUS_OFF,
    serverIndex: -1,
    isDisplayDrawer: false,
    isDisplayClientEditor: false,
    isDisplayServerEditor: false
  };

  app = null;

  sysProxy = null;

  constructor(props) {
    super(props);
    this.onMenuTouchTap = this.onMenuTouchTap.bind(this);
    this.onBeginAddServer = this.onBeginAddServer.bind(this);
    this.onBeginEditServer = this.onBeginEditServer.bind(this);
    this.onBeginEditClient = this.onBeginEditClient.bind(this);
    this.onCloseServerEditor = this.onCloseServerEditor.bind(this);
    this.onCloseClientEditor = this.onCloseClientEditor.bind(this);
    this.onToggleServerEnabled = this.onToggleServerEnabled.bind(this);
    this.onTogglePACEnabled = this.onTogglePACEnabled.bind(this);
    this.onEditServer = this.onEditServer.bind(this);
    this.onEditClient = this.onEditClient.bind(this);
    this.onDeleteServer = this.onDeleteServer.bind(this);
    this.onStartApp = this.onStartApp.bind(this);
    this.onStopApp = this.onStopApp.bind(this);
    this.onSave = this.onSave.bind(this);
  }

  componentDidMount() {
    // load config.js from disk
    this.setState({config: loadConfig()});

    // initialize ipc
    ipcRenderer.send('renderer-init');
    ipcRenderer.on('main-error', (event, err) => {
      switch (err.code) {
        case 'EADDRINUSE':
          this.setState({appStatus: APP_STATUS_OFF});
          toast(`Error: ${err.code} ${err.address}:${err.port}`);
          break;
        default:
          toast(`Error: ${err.code}`);
          break;
      }
      console.warn(err);
    });
    ipcRenderer.on('main-terminate', () => {
      this.onStopApp();
      ipcRenderer.send('renderer-terminate');
    });

    // initialize SysProxy
    const {createSysProxy} = window.require('electron').remote.require('./src/system');
    try {
      this.sysProxy = createSysProxy();
    } catch (err) {
      console.warn(err);
      toast(err.message);
    }
  }

  componenetWillUnmont() {
    this.onStopApp();
  }

  onMenuTouchTap() {
    this.setState({isDisplayDrawer: !this.state.isDisplayDrawer});
  }

  onBeginAddServer() {
    this.setState({isDisplayServerEditor: true, serverIndex: -1});
  }

  onBeginEditServer(index) {
    this.setState({isDisplayServerEditor: true, serverIndex: index});
  }

  onBeginEditClient() {
    this.setState({isDisplayClientEditor: true});
  }

  onCloseServerEditor() {
    this.setState({isDisplayServerEditor: false}, this.onSave);
  }

  onCloseClientEditor() {
    this.setState({isDisplayClientEditor: false}, this.onSave);
  }

  onToggleServerEnabled(index) {
    const {config} = this.state;
    this.setState({
      config: {
        ...config,
        servers: config.servers.map((s, i) => ({
          ...s,
          enabled: (i === index) ? !s.enabled : s.enabled
        }))
      }
    }, this.onSave);
  }

  onTogglePACEnabled() {
    const {config} = this.state;
    this.setState({
      config: {
        ...config,
        pac_on: !config.pac_on
      }
    }, this.onSave);
  }

  onEditServer(server) {
    const {config, serverIndex} = this.state;
    if (serverIndex === -1) {
      this.setState({
        serverIndex: config.servers.length,
        config: {
          ...config,
          servers: config.servers.concat(server)
        }
      });
    } else {
      this.setState({
        config: {
          ...config,
          servers: config.servers.map((s, i) => (i === serverIndex) ? server : s)
        }
      });
    }
  }

  onEditClient(newConfig) {
    const {config} = this.state;
    this.setState({
      config: {
        ...config,
        ...newConfig
      }
    });
  }

  onDeleteServer(index) {
    const {config} = this.state;
    this.setState({
      config: {
        ...config,
        servers: config.servers.filter((s, i) => i !== index)
      }
    }, this.onSave);
  }

  onSave() {
    const {config} = this.state;
    saveConfig(config);
    this.onRestartApp();
  }

  onStartApp() {
    const {appStatus, config} = this.state;
    if (appStatus === APP_STATUS_OFF || appStatus === APP_STATUS_RESTARTING) {
      // validate config
      if (config.servers.filter((server) => server.enabled).length < 1) {
        toast('You must enable at least one server');
        this.setState({appStatus: APP_STATUS_OFF});
        return;
      }

      try {
        // 1. set system proxy
        if (config.pac_on) {
          this.sysProxy.setPAC(config.pac);
        } else {
          this.sysProxy.setSocksProxy(config.host, config.port);
          this.sysProxy.setHTTPProxy(config.host, config.port);
        }

        // 2. start blinksocks client
        const {Config, Hub} = window.require('electron').remote.require('/home/micooz/Projects/blinksocks');
        Config.init(config);
        this.app = new Hub();
        this.app.run();

        // 3. update ui
        this.setState({appStatus: APP_STATUS_RUNNING});
      } catch (err) {
        console.warn(err);
        toast(err.message);
      }
    }
  }

  onStopApp() {
    if (this.app !== null) {
      const {config} = this.state;
      try {
        // 1. terminate blinksocks client
        this.app.terminate();
        this.app = null;

        // 2. unset system proxy
        if (config.pac_on) {
          this.sysProxy.unsetPAC();
        } else {
          this.sysProxy.unsetSocksProxy();
          this.sysProxy.unsetHTTPProxy();
        }

        // 3. update ui
        this.setState({appStatus: APP_STATUS_OFF});
      } catch (err) {
        console.warn(err);
        toast(err.message);
      }
    }
  }

  onRestartApp() {
    const {appStatus} = this.state;
    if (appStatus === APP_STATUS_RUNNING) {
      this.onStopApp();
      this.setState({appStatus: APP_STATUS_RESTARTING});
      setTimeout(this.onStartApp, 1000);
    }
  }

  render() {
    const {
      appStatus,
      isDisplayDrawer,
      isDisplayClientEditor,
      isDisplayServerEditor,
      config,
      serverIndex
    } = this.state;
    return (
      <div className="app">
        {isDisplayDrawer && <ScreenMask onTouchTap={this.onMenuTouchTap}/>}
        <AppBar title="blinksocks" onLeftIconButtonTouchTap={this.onMenuTouchTap}/>
        <AppSlider isOpen={isDisplayDrawer}/>
        <List>
          <Subheader>General</Subheader>
          <ListItem
            leftIcon={<ActionPowerSettingsNew/>}
            primaryText="Local Service"
            secondaryText={
              <span>
                blinksocks client status:&nbsp;
                <b style={{
                  color: {
                    [APP_STATUS_OFF]: 'inherit',
                    [APP_STATUS_RUNNING]: 'green',
                    [APP_STATUS_RESTARTING]: 'orange'
                  }[appStatus]
                }}>
                  {appStatus === APP_STATUS_OFF && 'off'}
                  {appStatus === APP_STATUS_RUNNING && 'running'}
                  {appStatus === APP_STATUS_RESTARTING && 'restarting'}
                </b>
                <br/>
                ● {config && config.host}:{config && config.port}
              </span>
            }
            rightToggle={
              <Toggle
                disabled={appStatus === APP_STATUS_RESTARTING}
                toggled={appStatus === APP_STATUS_RUNNING}
                onToggle={appStatus === APP_STATUS_RUNNING ? this.onStopApp : this.onStartApp}
              />
            }
          />
          <ListItem
            leftIcon={<ImageTransform/>}
            primaryText="PAC mode(Auto Proxy)"
            secondaryText="Toggle auto/global proxy"
            rightToggle={
              <Toggle
                toggled={config ? config.pac_on : false}
                onToggle={this.onTogglePACEnabled}
              />
            }
            onTouchTap={this.onStartApp}
          />
          <ListItem
            leftIcon={<ActionSettings/>}
            primaryText="SETTINGS"
            secondaryText="Local and PAC settings"
            onTouchTap={this.onBeginEditClient}
          />
          <ListItem
            leftIcon={<ContentAdd/>}
            primaryText="ADD A SERVER"
            secondaryText="Add blinksocks/shadowsocks server"
            onTouchTap={this.onBeginAddServer}
          />
        </List>
        <Divider/>
        {config ? (
          <List>
            <Subheader>
              Servers({config && `total: ${config.servers.length} active: ${config.servers.filter((s) => s.enabled).length}`})
            </Subheader>
            <div className="app__servers">
              {config.servers.map((server, i) => (
                <ServerItem
                  key={i}
                  server={server}
                  onToggleEnabled={this.onToggleServerEnabled.bind(this, i)}
                  onEdit={this.onBeginEditServer.bind(this, i)}
                  onDelete={this.onDeleteServer.bind(this, i)}
                />
              ))}
            </div>
          </List>
        ) : 'Loading Config...'}
        <Dialog
          open={isDisplayClientEditor}
          title="SETTINGS"
          actions={[<FlatButton primary label="OK" onTouchTap={this.onCloseClientEditor}/>]}
          autoScrollBodyContent={true}
        >
          {config && (
            <ClientEditor
              config={config}
              onEdit={this.onEditClient}
            />
          )}
        </Dialog>
        <Dialog
          open={isDisplayServerEditor}
          title={`${serverIndex === -1 ? 'ADD' : 'EDIT'} A SERVER`}
          actions={[<FlatButton primary label="OK" onTouchTap={this.onCloseServerEditor}/>]}
          autoScrollBodyContent={true}
        >
          {config && (
            <ServerEditor
              server={config.servers[serverIndex] || DEFAULT_CONFIG_STRUCTURE.servers[0]}
              onEdit={this.onEditServer}
            />
          )}
        </Dialog>
      </div>
    );
  }

}