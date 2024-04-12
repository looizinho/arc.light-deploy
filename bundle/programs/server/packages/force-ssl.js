Package["core-runtime"].queue("force-ssl", ["meteor", "ecmascript", "webapp", "ddp", "force-ssl-common", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ddp-client", "ddp-server", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"force-ssl":{"force_ssl_server.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/force-ssl/force_ssl_server.js                                                                   //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let isLocalConnection, isSslConnection;
    module.link("meteor/force-ssl-common", {
      isLocalConnection(v) {
        isLocalConnection = v;
      },
      isSslConnection(v) {
        isSslConnection = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    var url = Npm.require("url");
    // Unfortunately we can't use a connect middleware here since
    // sockjs installs itself prior to all existing listeners
    // (meaning prior to any connect middlewares) so we need to take
    // an approach similar to overshadowListeners in
    // https://github.com/sockjs/sockjs-node/blob/cf820c55af6a9953e16558555a31decea554f70e/src/utils.coffee

    var httpServer = WebApp.httpServer;
    var oldHttpServerListeners = httpServer.listeners('request').slice(0);
    httpServer.removeAllListeners('request');
    httpServer.addListener('request', function (req, res) {
      // allow connections if they have been handled w/ ssl already
      // (either by us or by a proxy) OR the connection is entirely over
      // localhost (development mode).
      //
      // Note: someone could trick us into serving over non-ssl by setting
      // x-forwarded-for, x-forwarded-proto, forwarded, etc. Not much we can do
      // there if we still want to operate behind proxies.

      if (!isLocalConnection(req) && !isSslConnection(req)) {
        // connection is not cool. send a 302 redirect!

        var host = url.parse(Meteor.absoluteUrl()).hostname;

        // strip off the port number. If we went to a URL with a custom
        // port, we don't know what the custom SSL port is anyway.
        host = host.replace(/:\d+$/, '');
        res.writeHead(302, {
          'Location': 'https://' + host + req.url,
          'Access-Control-Allow-Origin': '*'
        });
        res.end();
        return;
      }

      // connection is OK. Proceed normally.
      var args = arguments;
      oldHttpServerListeners.forEach(oldListener => {
        oldListener.apply(httpServer, args);
      });
    });

    // NOTE: this doesn't handle websockets!
    //
    // Websockets come in via the 'upgrade' request. We can override this,
    // however the problem is we're not sure if the websocket is actually
    // encrypted. We don't get x-forwarded-for, x-forwarded-proto, forwarded, etc.
    // on websockets. It's possible the 'sec-websocket-origin' header does
    // what we want, but that's not clear.
    //
    // For now, this package allows raw unencrypted DDP connections over
    // websockets.
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/force-ssl/force_ssl_server.js"
  ],
  mainModulePath: "/node_modules/meteor/force-ssl/force_ssl_server.js"
}});

//# sourceURL=meteor://💻app/packages/force-ssl.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZm9yY2Utc3NsL2ZvcmNlX3NzbF9zZXJ2ZXIuanMiXSwibmFtZXMiOlsiaXNMb2NhbENvbm5lY3Rpb24iLCJpc1NzbENvbm5lY3Rpb24iLCJtb2R1bGUiLCJsaW5rIiwidiIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwidXJsIiwiTnBtIiwicmVxdWlyZSIsImh0dHBTZXJ2ZXIiLCJXZWJBcHAiLCJvbGRIdHRwU2VydmVyTGlzdGVuZXJzIiwibGlzdGVuZXJzIiwic2xpY2UiLCJyZW1vdmVBbGxMaXN0ZW5lcnMiLCJhZGRMaXN0ZW5lciIsInJlcSIsInJlcyIsImhvc3QiLCJwYXJzZSIsIk1ldGVvciIsImFic29sdXRlVXJsIiwiaG9zdG5hbWUiLCJyZXBsYWNlIiwid3JpdGVIZWFkIiwiZW5kIiwiYXJncyIsImFyZ3VtZW50cyIsImZvckVhY2giLCJvbGRMaXN0ZW5lciIsImFwcGx5IiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUEsSUFBSUEsaUJBQWlCLEVBQUNDLGVBQWU7SUFBQ0MsTUFBTSxDQUFDQyxJQUFJLENBQUMseUJBQXlCLEVBQUM7TUFBQ0gsaUJBQWlCQSxDQUFDSSxDQUFDLEVBQUM7UUFBQ0osaUJBQWlCLEdBQUNJLENBQUM7TUFBQSxDQUFDO01BQUNILGVBQWVBLENBQUNHLENBQUMsRUFBQztRQUFDSCxlQUFlLEdBQUNHLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJQyxvQkFBb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxNQUFNQSxvQkFBb0IsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUE3TixJQUFJQyxHQUFHLEdBQUdDLEdBQUcsQ0FBQ0MsT0FBTyxDQUFDLEtBQUssQ0FBQztJQUc1QjtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBLElBQUlDLFVBQVUsR0FBR0MsTUFBTSxDQUFDRCxVQUFVO0lBQ2xDLElBQUlFLHNCQUFzQixHQUFHRixVQUFVLENBQUNHLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQ0MsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNyRUosVUFBVSxDQUFDSyxrQkFBa0IsQ0FBQyxTQUFTLENBQUM7SUFDeENMLFVBQVUsQ0FBQ00sV0FBVyxDQUFDLFNBQVMsRUFBRSxVQUFVQyxHQUFHLEVBQUVDLEdBQUcsRUFBRTtNQUVwRDtNQUNBO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQTs7TUFFQSxJQUFJLENBQUNqQixpQkFBaUIsQ0FBQ2dCLEdBQUcsQ0FBQyxJQUFJLENBQUNmLGVBQWUsQ0FBQ2UsR0FBRyxDQUFDLEVBQUU7UUFDcEQ7O1FBRUEsSUFBSUUsSUFBSSxHQUFHWixHQUFHLENBQUNhLEtBQUssQ0FBQ0MsTUFBTSxDQUFDQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUNDLFFBQVE7O1FBRW5EO1FBQ0E7UUFDQUosSUFBSSxHQUFHQSxJQUFJLENBQUNLLE9BQU8sQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO1FBRWhDTixHQUFHLENBQUNPLFNBQVMsQ0FBQyxHQUFHLEVBQUU7VUFDakIsVUFBVSxFQUFFLFVBQVUsR0FBR04sSUFBSSxHQUFHRixHQUFHLENBQUNWLEdBQUc7VUFDdkMsNkJBQTZCLEVBQUU7UUFDakMsQ0FBQyxDQUFDO1FBQ0ZXLEdBQUcsQ0FBQ1EsR0FBRyxDQUFDLENBQUM7UUFDVDtNQUNGOztNQUVBO01BQ0EsSUFBSUMsSUFBSSxHQUFHQyxTQUFTO01BQ3BCaEIsc0JBQXNCLENBQUNpQixPQUFPLENBQUVDLFdBQVcsSUFBSztRQUM5Q0EsV0FBVyxDQUFDQyxLQUFLLENBQUNyQixVQUFVLEVBQUVpQixJQUFJLENBQUM7TUFDckMsQ0FBQyxDQUFDO0lBQ0osQ0FBQyxDQUFDOztJQUdGO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQUFLLHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUFFLElBQUE7RUFBQUMsS0FBQTtBQUFBLEciLCJmaWxlIjoiL3BhY2thZ2VzL2ZvcmNlLXNzbC5qcyIsInNvdXJjZXNDb250ZW50IjpbInZhciB1cmwgPSBOcG0ucmVxdWlyZShcInVybFwiKTtcbmltcG9ydCB7IGlzTG9jYWxDb25uZWN0aW9uLCBpc1NzbENvbm5lY3Rpb24gfSBmcm9tICdtZXRlb3IvZm9yY2Utc3NsLWNvbW1vbic7XG5cbi8vIFVuZm9ydHVuYXRlbHkgd2UgY2FuJ3QgdXNlIGEgY29ubmVjdCBtaWRkbGV3YXJlIGhlcmUgc2luY2Vcbi8vIHNvY2tqcyBpbnN0YWxscyBpdHNlbGYgcHJpb3IgdG8gYWxsIGV4aXN0aW5nIGxpc3RlbmVyc1xuLy8gKG1lYW5pbmcgcHJpb3IgdG8gYW55IGNvbm5lY3QgbWlkZGxld2FyZXMpIHNvIHdlIG5lZWQgdG8gdGFrZVxuLy8gYW4gYXBwcm9hY2ggc2ltaWxhciB0byBvdmVyc2hhZG93TGlzdGVuZXJzIGluXG4vLyBodHRwczovL2dpdGh1Yi5jb20vc29ja2pzL3NvY2tqcy1ub2RlL2Jsb2IvY2Y4MjBjNTVhZjZhOTk1M2UxNjU1ODU1NWEzMWRlY2VhNTU0ZjcwZS9zcmMvdXRpbHMuY29mZmVlXG5cbnZhciBodHRwU2VydmVyID0gV2ViQXBwLmh0dHBTZXJ2ZXI7XG52YXIgb2xkSHR0cFNlcnZlckxpc3RlbmVycyA9IGh0dHBTZXJ2ZXIubGlzdGVuZXJzKCdyZXF1ZXN0Jykuc2xpY2UoMCk7XG5odHRwU2VydmVyLnJlbW92ZUFsbExpc3RlbmVycygncmVxdWVzdCcpO1xuaHR0cFNlcnZlci5hZGRMaXN0ZW5lcigncmVxdWVzdCcsIGZ1bmN0aW9uIChyZXEsIHJlcykge1xuXG4gIC8vIGFsbG93IGNvbm5lY3Rpb25zIGlmIHRoZXkgaGF2ZSBiZWVuIGhhbmRsZWQgdy8gc3NsIGFscmVhZHlcbiAgLy8gKGVpdGhlciBieSB1cyBvciBieSBhIHByb3h5KSBPUiB0aGUgY29ubmVjdGlvbiBpcyBlbnRpcmVseSBvdmVyXG4gIC8vIGxvY2FsaG9zdCAoZGV2ZWxvcG1lbnQgbW9kZSkuXG4gIC8vXG4gIC8vIE5vdGU6IHNvbWVvbmUgY291bGQgdHJpY2sgdXMgaW50byBzZXJ2aW5nIG92ZXIgbm9uLXNzbCBieSBzZXR0aW5nXG4gIC8vIHgtZm9yd2FyZGVkLWZvciwgeC1mb3J3YXJkZWQtcHJvdG8sIGZvcndhcmRlZCwgZXRjLiBOb3QgbXVjaCB3ZSBjYW4gZG9cbiAgLy8gdGhlcmUgaWYgd2Ugc3RpbGwgd2FudCB0byBvcGVyYXRlIGJlaGluZCBwcm94aWVzLlxuXG4gIGlmICghaXNMb2NhbENvbm5lY3Rpb24ocmVxKSAmJiAhaXNTc2xDb25uZWN0aW9uKHJlcSkpIHtcbiAgICAvLyBjb25uZWN0aW9uIGlzIG5vdCBjb29sLiBzZW5kIGEgMzAyIHJlZGlyZWN0IVxuXG4gICAgdmFyIGhvc3QgPSB1cmwucGFyc2UoTWV0ZW9yLmFic29sdXRlVXJsKCkpLmhvc3RuYW1lO1xuXG4gICAgLy8gc3RyaXAgb2ZmIHRoZSBwb3J0IG51bWJlci4gSWYgd2Ugd2VudCB0byBhIFVSTCB3aXRoIGEgY3VzdG9tXG4gICAgLy8gcG9ydCwgd2UgZG9uJ3Qga25vdyB3aGF0IHRoZSBjdXN0b20gU1NMIHBvcnQgaXMgYW55d2F5LlxuICAgIGhvc3QgPSBob3N0LnJlcGxhY2UoLzpcXGQrJC8sICcnKTtcblxuICAgIHJlcy53cml0ZUhlYWQoMzAyLCB7XG4gICAgICAnTG9jYXRpb24nOiAnaHR0cHM6Ly8nICsgaG9zdCArIHJlcS51cmwsXG4gICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonXG4gICAgfSk7XG4gICAgcmVzLmVuZCgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIGNvbm5lY3Rpb24gaXMgT0suIFByb2NlZWQgbm9ybWFsbHkuXG4gIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICBvbGRIdHRwU2VydmVyTGlzdGVuZXJzLmZvckVhY2goKG9sZExpc3RlbmVyKSA9PiB7XG4gICAgb2xkTGlzdGVuZXIuYXBwbHkoaHR0cFNlcnZlciwgYXJncyk7XG4gIH0pO1xufSk7XG5cblxuLy8gTk9URTogdGhpcyBkb2Vzbid0IGhhbmRsZSB3ZWJzb2NrZXRzIVxuLy9cbi8vIFdlYnNvY2tldHMgY29tZSBpbiB2aWEgdGhlICd1cGdyYWRlJyByZXF1ZXN0LiBXZSBjYW4gb3ZlcnJpZGUgdGhpcyxcbi8vIGhvd2V2ZXIgdGhlIHByb2JsZW0gaXMgd2UncmUgbm90IHN1cmUgaWYgdGhlIHdlYnNvY2tldCBpcyBhY3R1YWxseVxuLy8gZW5jcnlwdGVkLiBXZSBkb24ndCBnZXQgeC1mb3J3YXJkZWQtZm9yLCB4LWZvcndhcmRlZC1wcm90bywgZm9yd2FyZGVkLCBldGMuXG4vLyBvbiB3ZWJzb2NrZXRzLiBJdCdzIHBvc3NpYmxlIHRoZSAnc2VjLXdlYnNvY2tldC1vcmlnaW4nIGhlYWRlciBkb2VzXG4vLyB3aGF0IHdlIHdhbnQsIGJ1dCB0aGF0J3Mgbm90IGNsZWFyLlxuLy9cbi8vIEZvciBub3csIHRoaXMgcGFja2FnZSBhbGxvd3MgcmF3IHVuZW5jcnlwdGVkIEREUCBjb25uZWN0aW9ucyBvdmVyXG4vLyB3ZWJzb2NrZXRzLlxuIl19
