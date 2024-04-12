(function() {

(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/core-runtime/package-registry.js                                                                   //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
function PackageRegistry() {
  this._promiseInfoMap = Object.create(null);
}

var PRp = PackageRegistry.prototype;

// Set global.Package[name] = pkg || {}. If additional arguments are
// supplied, their keys will be copied into pkg if not already present.
// This method is defined on the prototype of global.Package so that it
// will not be included in Object.keys(Package).
PRp._define = function definePackage(name, pkg) {
  pkg = pkg || {};

  var argc = arguments.length;
  for (var i = 2; i < argc; ++i) {
    var arg = arguments[i];
    for (var s in arg) {
      if (! (s in pkg)) {
        pkg[s] = arg[s];
      }
    }
  }

  this[name] = pkg;

  var info = this._promiseInfoMap[name];
  if (info) {
    info.resolve(pkg);
  }

  return pkg;
};

PRp._has = function has(name) {
  return Object.prototype.hasOwnProperty.call(this, name);
};

// Returns a Promise that will resolve to the exports of the named
// package, or be rejected if the package is not installed.
PRp._promise = function promise(name) {
  var self = this;
  var info = self._promiseInfoMap[name];

  if (! info) {
    info = self._promiseInfoMap[name] = {};
    info.promise = new Promise(function (resolve, reject) {
      info.resolve = resolve;
      if (self._has(name)) {
        resolve(self[name]);
      } else {
        Meteor.startup(function () {
          if (! self._has(name)) {
            reject(new Error("Package " + name + " not installed"));
          }
        });
      }
    });
  }

  return info.promise;
};

// Initialize the Package namespace used by all Meteor packages.
var global = this;
global.Package = new PackageRegistry();

if (typeof exports === "object") {
  // This code is also used by meteor/tools/isobuild/bundler.js.
  exports.PackageRegistry = PackageRegistry;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/core-runtime/load-js-image.js                                                                      //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
// This file needs to work in old web browsers and old node versions
// It should not use js features newer than EcmaScript 5.
//
// Handles loading linked code for packages and apps
// Ensures packages and eager requires run in the correct order
// when there is code that uses top level await

var pending = Object.create(null);
var hasOwn = Object.prototype.hasOwnProperty;

function queue(name, deps, runImage) {
  pending[name] = [];

  var pendingDepsCount = 0;

  function onDepLoaded() {
    pendingDepsCount -= 1;

    if (pendingDepsCount === 0) {
      load(name, runImage);
    }
  }

  deps.forEach(function (dep) {
    if (hasOwn.call(pending, dep)) {
      pendingDepsCount += 1;
      pending[dep].push(onDepLoaded);
    } else {
      // load must always be called for a package's dependencies first.
      // If the package is not pending, then it must have already loaded
      // or is a weak dependency, and the dependency is not being used.
    }
  });

  if (pendingDepsCount === 0) {
    load(name, runImage);
  }
}

function load(name, runImage) {
  var config = runImage();

  runEagerModules(config, function (mainModuleExports) {
    // Get the exports after the eager code has been run
    var exports = config.export ? config.export() : {};
    if (config.mainModulePath) {
      Package._define(name, mainModuleExports, exports);
    } else {
      Package._define(name, exports);
    }

    var pendingCallbacks = pending[name] || [];
    delete pending[name];
    pendingCallbacks.forEach(function (callback) {
      callback();
    });
  });
}

function runEagerModules(config, callback) {
  if (!config.eagerModulePaths) {
    return callback();
  }

  var index = -1;
  var mainExports = {};
  var mainModuleAsync = false;

  function evaluateNextModule() {
    index += 1;
    if (index === config.eagerModulePaths.length) {
      if (mainModuleAsync) {
        // Now that the package has loaded, mark the main module as sync
        // This allows other packages and the app to `require` the package
        // and for it to work the same, regardless of if it uses TLA or not
        // XXX: this is a temporary hack until we find a better way to do this
        const reify = config.require('/node_modules/meteor/modules/node_modules/@meteorjs/reify/lib/runtime');
        reify._requireAsSync(config.mainModulePath);
      }

      return callback(mainExports);
    }

    var path = config.eagerModulePaths[index];
    var exports = config.require(path);
    if (checkAsyncModule(exports)) {
      if (path === config.mainModulePath) {
        mainModuleAsync = true;
      }

      // Is an async module
      exports.then(function (exports) {
        if (path === config.mainModulePath) {
          mainExports = exports;
        }
        evaluateNextModule();
      })
      // This also handles errors in modules and packages loaded sync
      // afterwards since they are run within the .then.
      .catch(function (error) {
        if (
          typeof process === 'object' &&
          typeof process.nextTick === 'function'
        ) {
          // Is node.js
          process.nextTick(function () {
            throw error;
          });
        } else {
          // TODO: is there a faster way to throw the error?
          setTimeout(function () {
            throw error;
          }, 0);
        }
      });
    } else {
      if (path === config.mainModulePath) {
        mainExports = exports;
      }
      evaluateNextModule();
    }
  }

  evaluateNextModule();
}

function checkAsyncModule (exports) {
  var potentiallyAsync = exports && typeof exports === 'object' &&
    hasOwn.call(exports, '__reifyAsyncModule');

  if (!potentiallyAsync) {
    return;
  }

  return typeof exports.then === 'function';
}

// For this to be accurate, all linked files must be queued before calling this
// If all are loaded, returns null. Otherwise, returns a promise
function waitUntilAllLoaded() {
  var pendingNames = Object.keys(pending);

  if (pendingNames.length === 0) {
    // All packages are loaded
    // If there were no async packages, then there might not be a promise
    // polyfill loaded either, so we don't create a promise to return
    return null;
  }

  return new Promise(function (resolve) {
    var pendingCount = pendingNames.length;
    pendingNames.forEach(function (name) {
      pending[name].push(function () {
        pendingCount -= 1;
        if (pendingCount === 0) {
          resolve();
        }
      });
    });
  })
}

// Since the package.js doesn't export load or waitUntilReady
// these will never be globals in packages or apps that depend on core-runtime
Package['core-runtime'] = {
  queue: queue,
  waitUntilAllLoaded: waitUntilAllLoaded
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);

})();
