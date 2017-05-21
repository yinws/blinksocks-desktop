/**
 * create platform-related SysProxy
 */
function createSysProxy() {
  const platform = process.platform;
  const ProxyClass = require(`./platforms/${platform}`);

  if (typeof ProxyClass !== 'function') {
    throw Error(`ProxyClass not found or invalid on "${platform}"`);
  }

  return new Promise((resolve) => {
    const instance = new ProxyClass();
    if (instance === null) {
      throw Error('fail to create system proxy instance');
    }
    if (instance.on) {
      // this is a hack for darwin
      instance.on('ready', () => resolve(instance.getSysProxyInstance()));
    } else {
      resolve(instance);
    }
  });
}

module.exports = {
  createSysProxy
};
