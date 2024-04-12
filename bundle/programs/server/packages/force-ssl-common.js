Package["core-runtime"].queue("force-ssl-common", ["meteor", "ecmascript", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

var require = meteorInstall({"node_modules":{"meteor":{"force-ssl-common":{"force_ssl_common.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// packages/force-ssl-common/force_ssl_common.js                                                            //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      isLocalConnection: () => isLocalConnection,
      isSslConnection: () => isSslConnection
    });
    let forwarded;
    module.link("forwarded-http", {
      default(v) {
        forwarded = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // Determine if the connection is only over localhost. Both we
    // received it on localhost, and all proxies involved received on
    // localhost (supports "forwarded" and "x-forwarded-for").
    const isLocalConnection = req => {
      const localhostRegexp = /^\s*(.*127\.0\.0\.1|\[?::1\]?)\s*$/;
      const request = Object.create(req);
      request.connection = Object.assign({}, req.connection, {
        remoteAddress: req.connection.remoteAddress || req.socket.remoteAddress
      });
      const forwardedParams = forwarded(request);
      let isLocal = true;
      Object.keys(forwardedParams.for).forEach(forKey => {
        if (!localhostRegexp.test(forKey)) {
          isLocal = false;
        }
      });
      return isLocal;
    };

    // Determine if the connection was over SSL at any point. Either we
    // received it as SSL, or a proxy did and translated it for us.
    const isSslConnection = req => {
      const forwardedParams = forwarded(req);
      return req.connection.pair || forwardedParams.proto && forwardedParams.proto.indexOf('https') !== -1;
    };
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

},"node_modules":{"forwarded-http":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/force-ssl-common/node_modules/forwarded-http/package.json                            //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.exports = {
  "name": "forwarded-http",
  "version": "0.3.0",
  "main": "lib/index.js"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                          //
// node_modules/meteor/force-ssl-common/node_modules/forwarded-http/lib/index.js                            //
//                                                                                                          //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                            //
module.useNode();
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/force-ssl-common/force_ssl_common.js"
  ],
  mainModulePath: "/node_modules/meteor/force-ssl-common/force_ssl_common.js"
}});

//# sourceURL=meteor://💻app/packages/force-ssl-common.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZm9yY2Utc3NsLWNvbW1vbi9mb3JjZV9zc2xfY29tbW9uLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsImlzTG9jYWxDb25uZWN0aW9uIiwiaXNTc2xDb25uZWN0aW9uIiwiZm9yd2FyZGVkIiwibGluayIsImRlZmF1bHQiLCJ2IiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJyZXEiLCJsb2NhbGhvc3RSZWdleHAiLCJyZXF1ZXN0IiwiT2JqZWN0IiwiY3JlYXRlIiwiY29ubmVjdGlvbiIsImFzc2lnbiIsInJlbW90ZUFkZHJlc3MiLCJzb2NrZXQiLCJmb3J3YXJkZWRQYXJhbXMiLCJpc0xvY2FsIiwia2V5cyIsImZvciIsImZvckVhY2giLCJmb3JLZXkiLCJ0ZXN0IiwicGFpciIsInByb3RvIiwiaW5kZXhPZiIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsInNlbGYiLCJhc3luYyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFBQUEsTUFBTSxDQUFDQyxNQUFNLENBQUM7TUFBQ0MsaUJBQWlCLEVBQUNBLENBQUEsS0FBSUEsaUJBQWlCO01BQUNDLGVBQWUsRUFBQ0EsQ0FBQSxLQUFJQTtJQUFlLENBQUMsQ0FBQztJQUFDLElBQUlDLFNBQVM7SUFBQ0osTUFBTSxDQUFDSyxJQUFJLENBQUMsZ0JBQWdCLEVBQUM7TUFBQ0MsT0FBT0EsQ0FBQ0MsQ0FBQyxFQUFDO1FBQUNILFNBQVMsR0FBQ0csQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlDLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU1BLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDO0lBRWpPO0lBQ0E7SUFDQTtJQUNBLE1BQU1OLGlCQUFpQixHQUFJTyxHQUFHLElBQUs7TUFDakMsTUFBTUMsZUFBZSxHQUFHLG9DQUFvQztNQUM1RCxNQUFNQyxPQUFPLEdBQUdDLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDSixHQUFHLENBQUM7TUFDbENFLE9BQU8sQ0FBQ0csVUFBVSxHQUFHRixNQUFNLENBQUNHLE1BQU0sQ0FDaEMsQ0FBQyxDQUFDLEVBQ0ZOLEdBQUcsQ0FBQ0ssVUFBVSxFQUNkO1FBQUVFLGFBQWEsRUFBRVAsR0FBRyxDQUFDSyxVQUFVLENBQUNFLGFBQWEsSUFBSVAsR0FBRyxDQUFDUSxNQUFNLENBQUNEO01BQWMsQ0FDNUUsQ0FBQztNQUNELE1BQU1FLGVBQWUsR0FBR2QsU0FBUyxDQUFDTyxPQUFPLENBQUM7TUFDMUMsSUFBSVEsT0FBTyxHQUFHLElBQUk7TUFDbEJQLE1BQU0sQ0FBQ1EsSUFBSSxDQUFDRixlQUFlLENBQUNHLEdBQUcsQ0FBQyxDQUFDQyxPQUFPLENBQUVDLE1BQU0sSUFBSztRQUNuRCxJQUFJLENBQUNiLGVBQWUsQ0FBQ2MsSUFBSSxDQUFDRCxNQUFNLENBQUMsRUFBRTtVQUNqQ0osT0FBTyxHQUFHLEtBQUs7UUFDakI7TUFDRixDQUFDLENBQUM7TUFDRixPQUFPQSxPQUFPO0lBQ2hCLENBQUM7O0lBRUQ7SUFDQTtJQUNBLE1BQU1oQixlQUFlLEdBQUlNLEdBQUcsSUFBSztNQUMvQixNQUFNUyxlQUFlLEdBQUdkLFNBQVMsQ0FBQ0ssR0FBRyxDQUFDO01BQ3RDLE9BQU9BLEdBQUcsQ0FBQ0ssVUFBVSxDQUFDVyxJQUFJLElBQ25CUCxlQUFlLENBQUNRLEtBQUssSUFBSVIsZUFBZSxDQUFDUSxLQUFLLENBQUNDLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0UsQ0FBQztJQUFDQyxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9mb3JjZS1zc2wtY29tbW9uLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGZvcndhcmRlZCBmcm9tICdmb3J3YXJkZWQtaHR0cCc7XG5cbi8vIERldGVybWluZSBpZiB0aGUgY29ubmVjdGlvbiBpcyBvbmx5IG92ZXIgbG9jYWxob3N0LiBCb3RoIHdlXG4vLyByZWNlaXZlZCBpdCBvbiBsb2NhbGhvc3QsIGFuZCBhbGwgcHJveGllcyBpbnZvbHZlZCByZWNlaXZlZCBvblxuLy8gbG9jYWxob3N0IChzdXBwb3J0cyBcImZvcndhcmRlZFwiIGFuZCBcIngtZm9yd2FyZGVkLWZvclwiKS5cbmNvbnN0IGlzTG9jYWxDb25uZWN0aW9uID0gKHJlcSkgPT4ge1xuICBjb25zdCBsb2NhbGhvc3RSZWdleHAgPSAvXlxccyooLioxMjdcXC4wXFwuMFxcLjF8XFxbPzo6MVxcXT8pXFxzKiQvO1xuICBjb25zdCByZXF1ZXN0ID0gT2JqZWN0LmNyZWF0ZShyZXEpO1xuICByZXF1ZXN0LmNvbm5lY3Rpb24gPSBPYmplY3QuYXNzaWduKFxuICAgIHt9LFxuICAgIHJlcS5jb25uZWN0aW9uLFxuICAgIHsgcmVtb3RlQWRkcmVzczogcmVxLmNvbm5lY3Rpb24ucmVtb3RlQWRkcmVzcyB8fCByZXEuc29ja2V0LnJlbW90ZUFkZHJlc3MgfVxuICApO1xuICBjb25zdCBmb3J3YXJkZWRQYXJhbXMgPSBmb3J3YXJkZWQocmVxdWVzdCk7XG4gIGxldCBpc0xvY2FsID0gdHJ1ZTtcbiAgT2JqZWN0LmtleXMoZm9yd2FyZGVkUGFyYW1zLmZvcikuZm9yRWFjaCgoZm9yS2V5KSA9PiB7XG4gICAgaWYgKCFsb2NhbGhvc3RSZWdleHAudGVzdChmb3JLZXkpKSB7XG4gICAgICBpc0xvY2FsID0gZmFsc2U7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIGlzTG9jYWw7XG59O1xuXG4vLyBEZXRlcm1pbmUgaWYgdGhlIGNvbm5lY3Rpb24gd2FzIG92ZXIgU1NMIGF0IGFueSBwb2ludC4gRWl0aGVyIHdlXG4vLyByZWNlaXZlZCBpdCBhcyBTU0wsIG9yIGEgcHJveHkgZGlkIGFuZCB0cmFuc2xhdGVkIGl0IGZvciB1cy5cbmNvbnN0IGlzU3NsQ29ubmVjdGlvbiA9IChyZXEpID0+IHtcbiAgY29uc3QgZm9yd2FyZGVkUGFyYW1zID0gZm9yd2FyZGVkKHJlcSk7XG4gIHJldHVybiByZXEuY29ubmVjdGlvbi5wYWlyXG4gICAgICB8fCBmb3J3YXJkZWRQYXJhbXMucHJvdG8gJiYgZm9yd2FyZGVkUGFyYW1zLnByb3RvLmluZGV4T2YoJ2h0dHBzJykgIT09IC0xO1xufTtcblxuZXhwb3J0IHsgaXNMb2NhbENvbm5lY3Rpb24sIGlzU3NsQ29ubmVjdGlvbiB9O1xuIl19
