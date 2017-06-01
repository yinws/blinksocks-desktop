const fs = require('fs');
const stream = require('stream');
const readline = require('readline');
const liburl = require('url');

const {
  DEFAULT_GFWLIST_PATH
} = require('../constants');

const {
  MAIN_START_PAC,
  MAIN_STOP_PAC,
  RENDERER_START_PAC,
  RENDERER_STOP_PAC
} = require('../../defs/events');

const {createPacService} = require('../system/pac');

function parseRules(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        const sr = new stream.PassThrough();
        sr.end(Buffer.from(data, 'base64').toString('ascii'));
        const rl = readline.createInterface({input: sr});
        let index = 0;
        const domains = [];
        rl.on('line', (line) => {
          if (!(line.startsWith('!')) && line.length > 0 && index !== 0) {
            domains.push(line);
          }
          index += 1;
        });
        rl.on('close', () => resolve(domains));
      }
    });
  });
}

module.exports = function pacModule() {

  let pacService = createPacService();

  /**
   * start local pac service
   * @param e
   * @param url
   * @param proxyHost
   * @param proxyPort
   * @returns {Promise.<void>}
   */
  async function start(e, {url, proxyHost, proxyPort}) {
    const {host, port} = liburl.parse(url);
    if (pacService) {
      const rules = await parseRules(DEFAULT_GFWLIST_PATH);
      pacService.start({host, port, proxyHost, proxyPort, rules});
      e.sender.send(MAIN_START_PAC);
    }
  }

  /**
   * stop local pac service
   */
  function stop(e) {
    if (pacService) {
      pacService.stop();
    }
    e.sender.send(MAIN_STOP_PAC);
  }

  return {
    [RENDERER_START_PAC]: start,
    [RENDERER_STOP_PAC]: stop,
  };
};