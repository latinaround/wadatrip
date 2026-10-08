// Test/seed entrypoints must reject remote targets before any network/DB call.
function loopback(url, protocols) {
  if (!protocols.includes(url.protocol) || !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) {
    throw new Error('Synthetic data tools require an explicit local disposable target.');
  }
  if (url.search || url.hash || (url.protocol.startsWith('http') && (url.username || url.password || url.pathname !== '/'))) {
    throw new Error('Synthetic data target must not contain redirects, credentials or an API path.');
  }
  return url;
}
function localTestApi(value = 'http://127.0.0.1:3000') {
  try { return loopback(new URL(value), ['http:','https:']).origin; }
  catch { throw new Error('Synthetic API tests can run only on a loopback API. No hosted target is allowed.'); }
}
function localTestDatabase(value) {
  try {
    const url=loopback(new URL(value), ['postgres:','postgresql:']);
    const name=decodeURIComponent(url.pathname.slice(1));
    if(!/^wadatrip_(?:test|p05|p07|dev)(?:_[a-zA-Z0-9_]+)?$/.test(name))throw Error('Not disposable');
    return value;
  } catch { throw new Error('Synthetic DB tools require a loopback disposable database named wadatrip_test*, wadatrip_p05*, wadatrip_p07* or wadatrip_dev*.'); }
}
module.exports={localTestApi,localTestDatabase};
