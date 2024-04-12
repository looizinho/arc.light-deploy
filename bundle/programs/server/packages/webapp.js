Package["core-runtime"].queue("webapp", ["meteor", "ecmascript", "logging", "underscore", "routepolicy", "modern-browsers", "boilerplate-generator", "webapp-hashing", "inter-process-messaging", "callback-hook", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Boilerplate = Package['boilerplate-generator'].Boilerplate;
var WebAppHashing = Package['webapp-hashing'].WebAppHashing;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var WebApp, WebAppInternals, main;

var require = meteorInstall({"node_modules":{"meteor":{"webapp":{"webapp_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// packages/webapp/webapp_server.js                                                                        //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
!module.wrapAsync(async function (module1, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module1.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    module1.export({
      WebApp: () => WebApp,
      WebAppInternals: () => WebAppInternals
    });
    let assert;
    module1.link("assert", {
      default(v) {
        assert = v;
      }
    }, 0);
    let readFileSync, chmodSync, chownSync;
    module1.link("fs", {
      readFileSync(v) {
        readFileSync = v;
      },
      chmodSync(v) {
        chmodSync = v;
      },
      chownSync(v) {
        chownSync = v;
      }
    }, 1);
    let createServer;
    module1.link("http", {
      createServer(v) {
        createServer = v;
      }
    }, 2);
    let userInfo;
    module1.link("os", {
      userInfo(v) {
        userInfo = v;
      }
    }, 3);
    let pathJoin, pathDirname;
    module1.link("path", {
      join(v) {
        pathJoin = v;
      },
      dirname(v) {
        pathDirname = v;
      }
    }, 4);
    let parseUrl;
    module1.link("url", {
      parse(v) {
        parseUrl = v;
      }
    }, 5);
    let createHash;
    module1.link("crypto", {
      createHash(v) {
        createHash = v;
      }
    }, 6);
    let express;
    module1.link("express", {
      default(v) {
        express = v;
      }
    }, 7);
    let compress;
    module1.link("compression", {
      default(v) {
        compress = v;
      }
    }, 8);
    let cookieParser;
    module1.link("cookie-parser", {
      default(v) {
        cookieParser = v;
      }
    }, 9);
    let qs;
    module1.link("qs", {
      default(v) {
        qs = v;
      }
    }, 10);
    let parseRequest;
    module1.link("parseurl", {
      default(v) {
        parseRequest = v;
      }
    }, 11);
    let lookupUserAgent;
    module1.link("useragent", {
      lookup(v) {
        lookupUserAgent = v;
      }
    }, 12);
    let isModern;
    module1.link("meteor/modern-browsers", {
      isModern(v) {
        isModern = v;
      }
    }, 13);
    let send;
    module1.link("send", {
      default(v) {
        send = v;
      }
    }, 14);
    let removeExistingSocketFile, registerSocketFileCleanup;
    module1.link("./socket_file.js", {
      removeExistingSocketFile(v) {
        removeExistingSocketFile = v;
      },
      registerSocketFileCleanup(v) {
        registerSocketFileCleanup = v;
      }
    }, 15);
    let cluster;
    module1.link("cluster", {
      default(v) {
        cluster = v;
      }
    }, 16);
    let whomst;
    module1.link("@vlasky/whomst", {
      default(v) {
        whomst = v;
      }
    }, 17);
    let onMessage;
    module1.link("meteor/inter-process-messaging", {
      onMessage(v) {
        onMessage = v;
      }
    }, 18);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    var SHORT_SOCKET_TIMEOUT = 5 * 1000;
    var LONG_SOCKET_TIMEOUT = 120 * 1000;
    const createExpressApp = () => {
      const app = express();
      // Security and performace headers
      // these headers come from these docs: https://expressjs.com/en/api.html#app.settings.table
      app.set('x-powered-by', false);
      app.set('etag', false);
      return app;
    };
    const WebApp = {};
    const WebAppInternals = {};
    const hasOwn = Object.prototype.hasOwnProperty;
    WebAppInternals.NpmModules = {
      express: {
        version: Npm.require('express/package.json').version,
        module: express
      }
    };

    // Though we might prefer to use web.browser (modern) as the default
    // architecture, safety requires a more compatible defaultArch.
    WebApp.defaultArch = 'web.browser.legacy';

    // XXX maps archs to manifests
    WebApp.clientPrograms = {};

    // XXX maps archs to program path on filesystem
    var archPath = {};
    var bundledJsCssUrlRewriteHook = function (url) {
      var bundledPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '';
      return bundledPrefix + url;
    };
    var sha1 = function (contents) {
      var hash = createHash('sha1');
      hash.update(contents);
      return hash.digest('hex');
    };
    function shouldCompress(req, res) {
      if (req.headers['x-no-compression']) {
        // don't compress responses with this request header
        return false;
      }

      // fallback to standard filter function
      return compress.filter(req, res);
    }

    // #BrowserIdentification
    //
    // We have multiple places that want to identify the browser: the
    // unsupported browser page, the appcache package, and, eventually
    // delivering browser polyfills only as needed.
    //
    // To avoid detecting the browser in multiple places ad-hoc, we create a
    // Meteor "browser" object. It uses but does not expose the npm
    // useragent module (we could choose a different mechanism to identify
    // the browser in the future if we wanted to).  The browser object
    // contains
    //
    // * `name`: the name of the browser in camel case
    // * `major`, `minor`, `patch`: integers describing the browser version
    //
    // Also here is an early version of a Meteor `request` object, intended
    // to be a high-level description of the request without exposing
    // details of Express's low-level `req`.  Currently it contains:
    //
    // * `browser`: browser identification object described above
    // * `url`: parsed url, including parsed query params
    //
    // As a temporary hack there is a `categorizeRequest` function on WebApp which
    // converts a Express `req` to a Meteor `request`. This can go away once smart
    // packages such as appcache are being passed a `request` object directly when
    // they serve content.
    //
    // This allows `request` to be used uniformly: it is passed to the html
    // attributes hook, and the appcache package can use it when deciding
    // whether to generate a 404 for the manifest.
    //
    // Real routing / server side rendering will probably refactor this
    // heavily.

    // e.g. "Mobile Safari" => "mobileSafari"
    var camelCase = function (name) {
      var parts = name.split(' ');
      parts[0] = parts[0].toLowerCase();
      for (var i = 1; i < parts.length; ++i) {
        parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substr(1);
      }
      return parts.join('');
    };
    var identifyBrowser = function (userAgentString) {
      var userAgent = lookupUserAgent(userAgentString);
      return {
        name: camelCase(userAgent.family),
        major: +userAgent.major,
        minor: +userAgent.minor,
        patch: +userAgent.patch
      };
    };

    // XXX Refactor as part of implementing real routing.
    WebAppInternals.identifyBrowser = identifyBrowser;
    WebApp.categorizeRequest = function (req) {
      if (req.browser && req.arch && typeof req.modern === 'boolean') {
        // Already categorized.
        return req;
      }
      const browser = identifyBrowser(req.headers['user-agent']);
      const modern = isModern(browser);
      const path = typeof req.pathname === 'string' ? req.pathname : parseRequest(req).pathname;
      const categorized = {
        browser,
        modern,
        path,
        arch: WebApp.defaultArch,
        url: parseUrl(req.url, true),
        dynamicHead: req.dynamicHead,
        dynamicBody: req.dynamicBody,
        headers: req.headers,
        cookies: req.cookies
      };
      const pathParts = path.split('/');
      const archKey = pathParts[1];
      if (archKey.startsWith('__')) {
        const archCleaned = 'web.' + archKey.slice(2);
        if (hasOwn.call(WebApp.clientPrograms, archCleaned)) {
          pathParts.splice(1, 1); // Remove the archKey part.
          return Object.assign(categorized, {
            arch: archCleaned,
            path: pathParts.join('/')
          });
        }
      }

      // TODO Perhaps one day we could infer Cordova clients here, so that we
      // wouldn't have to use prefixed "/__cordova/..." URLs.
      const preferredArchOrder = isModern(browser) ? ['web.browser', 'web.browser.legacy'] : ['web.browser.legacy', 'web.browser'];
      for (const arch of preferredArchOrder) {
        // If our preferred arch is not available, it's better to use another
        // client arch that is available than to guarantee the site won't work
        // by returning an unknown arch. For example, if web.browser.legacy is
        // excluded using the --exclude-archs command-line option, legacy
        // clients are better off receiving web.browser (which might actually
        // work) than receiving an HTTP 404 response. If none of the archs in
        // preferredArchOrder are defined, only then should we send a 404.
        if (hasOwn.call(WebApp.clientPrograms, arch)) {
          return Object.assign(categorized, {
            arch
          });
        }
      }
      return categorized;
    };

    // HTML attribute hooks: functions to be called to determine any attributes to
    // be added to the '<html>' tag. Each function is passed a 'request' object (see
    // #BrowserIdentification) and should return null or object.
    var htmlAttributeHooks = [];
    var getHtmlAttributes = function (request) {
      var combinedAttributes = {};
      _.each(htmlAttributeHooks || [], function (hook) {
        var attributes = hook(request);
        if (attributes === null) return;
        if (typeof attributes !== 'object') throw Error('HTML attribute hook must return null or object');
        _.extend(combinedAttributes, attributes);
      });
      return combinedAttributes;
    };
    WebApp.addHtmlAttributeHook = function (hook) {
      htmlAttributeHooks.push(hook);
    };

    // Serve app HTML for this URL?
    var appUrl = function (url) {
      if (url === '/favicon.ico' || url === '/robots.txt') return false;

      // NOTE: app.manifest is not a web standard like favicon.ico and
      // robots.txt. It is a file name we have chosen to use for HTML5
      // appcache URLs. It is included here to prevent using an appcache
      // then removing it from poisoning an app permanently. Eventually,
      // once we have server side routing, this won't be needed as
      // unknown URLs with return a 404 automatically.
      if (url === '/app.manifest') return false;

      // Avoid serving app HTML for declared routes such as /sockjs/.
      if (RoutePolicy.classify(url)) return false;

      // we currently return app HTML on all URLs by default
      return true;
    };

    // We need to calculate the client hash after all packages have loaded
    // to give them a chance to populate __meteor_runtime_config__.
    //
    // Calculating the hash during startup means that packages can only
    // populate __meteor_runtime_config__ during load, not during startup.
    //
    // Calculating instead it at the beginning of main after all startup
    // hooks had run would allow packages to also populate
    // __meteor_runtime_config__ during startup, but that's too late for
    // autoupdate because it needs to have the client hash at startup to
    // insert the auto update version itself into
    // __meteor_runtime_config__ to get it to the client.
    //
    // An alternative would be to give autoupdate a "post-start,
    // pre-listen" hook to allow it to insert the auto update version at
    // the right moment.

    Meteor.startup(function () {
      function getter(key) {
        return function (arch) {
          arch = arch || WebApp.defaultArch;
          const program = WebApp.clientPrograms[arch];
          const value = program && program[key];
          // If this is the first time we have calculated this hash,
          // program[key] will be a thunk (lazy function with no parameters)
          // that we should call to do the actual computation.
          return typeof value === 'function' ? program[key] = value() : value;
        };
      }
      WebApp.calculateClientHash = WebApp.clientHash = getter('version');
      WebApp.calculateClientHashRefreshable = getter('versionRefreshable');
      WebApp.calculateClientHashNonRefreshable = getter('versionNonRefreshable');
      WebApp.calculateClientHashReplaceable = getter('versionReplaceable');
      WebApp.getRefreshableAssets = getter('refreshableAssets');
    });

    // When we have a request pending, we want the socket timeout to be long, to
    // give ourselves a while to serve it, and to allow sockjs long polls to
    // complete.  On the other hand, we want to close idle sockets relatively
    // quickly, so that we can shut down relatively promptly but cleanly, without
    // cutting off anyone's response.
    WebApp._timeoutAdjustmentRequestCallback = function (req, res) {
      // this is really just req.socket.setTimeout(LONG_SOCKET_TIMEOUT);
      req.setTimeout(LONG_SOCKET_TIMEOUT);
      // Insert our new finish listener to run BEFORE the existing one which removes
      // the response from the socket.
      var finishListeners = res.listeners('finish');
      // XXX Apparently in Node 0.12 this event was called 'prefinish'.
      // https://github.com/joyent/node/commit/7c9b6070
      // But it has switched back to 'finish' in Node v4:
      // https://github.com/nodejs/node/pull/1411
      res.removeAllListeners('finish');
      res.on('finish', function () {
        res.setTimeout(SHORT_SOCKET_TIMEOUT);
      });
      _.each(finishListeners, function (l) {
        res.on('finish', l);
      });
    };

    // Will be updated by main before we listen.
    // Map from client arch to boilerplate object.
    // Boilerplate object has:
    //   - func: XXX
    //   - baseData: XXX
    var boilerplateByArch = {};

    // Register a callback function that can selectively modify boilerplate
    // data given arguments (request, data, arch). The key should be a unique
    // identifier, to prevent accumulating duplicate callbacks from the same
    // call site over time. Callbacks will be called in the order they were
    // registered. A callback should return false if it did not make any
    // changes affecting the boilerplate. Passing null deletes the callback.
    // Any previous callback registered for this key will be returned.
    const boilerplateDataCallbacks = Object.create(null);
    WebAppInternals.registerBoilerplateDataCallback = function (key, callback) {
      const previousCallback = boilerplateDataCallbacks[key];
      if (typeof callback === 'function') {
        boilerplateDataCallbacks[key] = callback;
      } else {
        assert.strictEqual(callback, null);
        delete boilerplateDataCallbacks[key];
      }

      // Return the previous callback in case the new callback needs to call
      // it; for example, when the new callback is a wrapper for the old.
      return previousCallback || null;
    };

    // Given a request (as returned from `categorizeRequest`), return the
    // boilerplate HTML to serve for that request.
    //
    // If a previous Express middleware has rendered content for the head or body,
    // returns the boilerplate with that content patched in otherwise
    // memoizes on HTML attributes (used by, eg, appcache) and whether inline
    // scripts are currently allowed.
    // XXX so far this function is always called with arch === 'web.browser'
    function getBoilerplate(request, arch) {
      return getBoilerplateAsync(request, arch);
    }

    /**
     * @summary Takes a runtime configuration object and
     * returns an encoded runtime string.
     * @locus Server
     * @param {Object} rtimeConfig
     * @returns {String}
     */
    WebApp.encodeRuntimeConfig = function (rtimeConfig) {
      return JSON.stringify(encodeURIComponent(JSON.stringify(rtimeConfig)));
    };

    /**
     * @summary Takes an encoded runtime string and returns
     * a runtime configuration object.
     * @locus Server
     * @param {String} rtimeConfigString
     * @returns {Object}
     */
    WebApp.decodeRuntimeConfig = function (rtimeConfigStr) {
      return JSON.parse(decodeURIComponent(JSON.parse(rtimeConfigStr)));
    };
    const runtimeConfig = {
      // hooks will contain the callback functions
      // set by the caller to addRuntimeConfigHook
      hooks: new Hook(),
      // updateHooks will contain the callback functions
      // set by the caller to addUpdatedNotifyHook
      updateHooks: new Hook(),
      // isUpdatedByArch is an object containing fields for each arch
      // that this server supports.
      // - Each field will be true when the server updates the runtimeConfig for that arch.
      // - When the hook callback is called the update field in the callback object will be
      // set to isUpdatedByArch[arch].
      // = isUpdatedyByArch[arch] is reset to false after the callback.
      // This enables the caller to cache data efficiently so they do not need to
      // decode & update data on every callback when the runtimeConfig is not changing.
      isUpdatedByArch: {}
    };

    /**
     * @name addRuntimeConfigHookCallback(options)
     * @locus Server
     * @isprototype true
     * @summary Callback for `addRuntimeConfigHook`.
     *
     * If the handler returns a _falsy_ value the hook will not
     * modify the runtime configuration.
     *
     * If the handler returns a _String_ the hook will substitute
     * the string for the encoded configuration string.
     *
     * **Warning:** the hook does not check the return value at all it is
     * the responsibility of the caller to get the formatting correct using
     * the helper functions.
     *
     * `addRuntimeConfigHookCallback` takes only one `Object` argument
     * with the following fields:
     * @param {Object} options
     * @param {String} options.arch The architecture of the client
     * requesting a new runtime configuration. This can be one of
     * `web.browser`, `web.browser.legacy` or `web.cordova`.
     * @param {Object} options.request
     * A NodeJs [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
     * https://nodejs.org/api/http.html#http_class_http_incomingmessage
     * `Object` that can be used to get information about the incoming request.
     * @param {String} options.encodedCurrentConfig The current configuration object
     * encoded as a string for inclusion in the root html.
     * @param {Boolean} options.updated `true` if the config for this architecture
     * has been updated since last called, otherwise `false`. This flag can be used
     * to cache the decoding/encoding for each architecture.
     */

    /**
     * @summary Hook that calls back when the meteor runtime configuration,
     * `__meteor_runtime_config__` is being sent to any client.
     *
     * **returns**: <small>_Object_</small> `{ stop: function, callback: function }`
     * - `stop` <small>_Function_</small> Call `stop()` to stop getting callbacks.
     * - `callback` <small>_Function_</small> The passed in `callback`.
     * @locus Server
     * @param {addRuntimeConfigHookCallback} callback
     * See `addRuntimeConfigHookCallback` description.
     * @returns {Object} {{ stop: function, callback: function }}
     * Call the returned `stop()` to stop getting callbacks.
     * The passed in `callback` is returned also.
     */
    WebApp.addRuntimeConfigHook = function (callback) {
      return runtimeConfig.hooks.register(callback);
    };
    function getBoilerplateAsync(request, arch) {
      let boilerplate = boilerplateByArch[arch];
      runtimeConfig.hooks.forEach(hook => {
        const meteorRuntimeConfig = hook({
          arch,
          request,
          encodedCurrentConfig: boilerplate.baseData.meteorRuntimeConfig,
          updated: runtimeConfig.isUpdatedByArch[arch]
        });
        if (!meteorRuntimeConfig) return true;
        boilerplate.baseData = Object.assign({}, boilerplate.baseData, {
          meteorRuntimeConfig
        });
        return true;
      });
      runtimeConfig.isUpdatedByArch[arch] = false;
      const data = Object.assign({}, boilerplate.baseData, {
        htmlAttributes: getHtmlAttributes(request)
      }, _.pick(request, 'dynamicHead', 'dynamicBody'));
      let madeChanges = false;
      let promise = Promise.resolve();
      Object.keys(boilerplateDataCallbacks).forEach(key => {
        promise = promise.then(() => {
          const callback = boilerplateDataCallbacks[key];
          return callback(request, data, arch);
        }).then(result => {
          // Callbacks should return false if they did not make any changes.
          if (result !== false) {
            madeChanges = true;
          }
        });
      });
      return promise.then(() => ({
        stream: boilerplate.toHTMLStream(data),
        statusCode: data.statusCode,
        headers: data.headers
      }));
    }

    /**
     * @name addUpdatedNotifyHookCallback(options)
     * @summary callback handler for `addupdatedNotifyHook`
     * @isprototype true
     * @locus Server
     * @param {Object} options
     * @param {String} options.arch The architecture that is being updated.
     * This can be one of `web.browser`, `web.browser.legacy` or `web.cordova`.
     * @param {Object} options.manifest The new updated manifest object for
     * this `arch`.
     * @param {Object} options.runtimeConfig The new updated configuration
     * object for this `arch`.
     */

    /**
     * @summary Hook that runs when the meteor runtime configuration
     * is updated.  Typically the configuration only changes during development mode.
     * @locus Server
     * @param {addUpdatedNotifyHookCallback} handler
     * The `handler` is called on every change to an `arch` runtime configuration.
     * See `addUpdatedNotifyHookCallback`.
     * @returns {Object} {{ stop: function, callback: function }}
     */
    WebApp.addUpdatedNotifyHook = function (handler) {
      return runtimeConfig.updateHooks.register(handler);
    };
    WebAppInternals.generateBoilerplateInstance = function (arch, manifest, additionalOptions) {
      additionalOptions = additionalOptions || {};
      runtimeConfig.isUpdatedByArch[arch] = true;
      const rtimeConfig = _objectSpread(_objectSpread({}, __meteor_runtime_config__), additionalOptions.runtimeConfigOverrides || {});
      runtimeConfig.updateHooks.forEach(cb => {
        cb({
          arch,
          manifest,
          runtimeConfig: rtimeConfig
        });
        return true;
      });
      const meteorRuntimeConfig = JSON.stringify(encodeURIComponent(JSON.stringify(rtimeConfig)));
      return new Boilerplate(arch, manifest, Object.assign({
        pathMapper(itemPath) {
          return pathJoin(archPath[arch], itemPath);
        },
        baseDataExtension: {
          additionalStaticJs: _.map(additionalStaticJs || [], function (contents, pathname) {
            return {
              pathname: pathname,
              contents: contents
            };
          }),
          // Convert to a JSON string, then get rid of most weird characters, then
          // wrap in double quotes. (The outermost JSON.stringify really ought to
          // just be "wrap in double quotes" but we use it to be safe.) This might
          // end up inside a <script> tag so we need to be careful to not include
          // "</script>", but normal {{spacebars}} escaping escapes too much! See
          // https://github.com/meteor/meteor/issues/3730
          meteorRuntimeConfig,
          meteorRuntimeHash: sha1(meteorRuntimeConfig),
          rootUrlPathPrefix: __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '',
          bundledJsCssUrlRewriteHook: bundledJsCssUrlRewriteHook,
          sriMode: sriMode,
          inlineScriptsAllowed: WebAppInternals.inlineScriptsAllowed(),
          inline: additionalOptions.inline
        }
      }, additionalOptions));
    };

    // A mapping from url path to architecture (e.g. "web.browser") to static
    // file information with the following fields:
    // - type: the type of file to be served
    // - cacheable: optionally, whether the file should be cached or not
    // - sourceMapUrl: optionally, the url of the source map
    //
    // Info also contains one of the following:
    // - content: the stringified content that should be served at this path
    // - absolutePath: the absolute path on disk to the file

    // Serve static files from the manifest or added with
    // `addStaticJs`. Exported for tests.
    WebAppInternals.staticFilesMiddleware = async function (staticFilesByArch, req, res, next) {
      var _Meteor$settings$pack3, _Meteor$settings$pack4;
      var pathname = parseRequest(req).pathname;
      try {
        pathname = decodeURIComponent(pathname);
      } catch (e) {
        next();
        return;
      }
      var serveStaticJs = function (s) {
        var _Meteor$settings$pack, _Meteor$settings$pack2;
        if (req.method === 'GET' || req.method === 'HEAD' || (_Meteor$settings$pack = Meteor.settings.packages) !== null && _Meteor$settings$pack !== void 0 && (_Meteor$settings$pack2 = _Meteor$settings$pack.webapp) !== null && _Meteor$settings$pack2 !== void 0 && _Meteor$settings$pack2.alwaysReturnContent) {
          res.writeHead(200, {
            'Content-type': 'application/javascript; charset=UTF-8',
            'Content-Length': Buffer.byteLength(s)
          });
          res.write(s);
          res.end();
        } else {
          const status = req.method === 'OPTIONS' ? 200 : 405;
          res.writeHead(status, {
            Allow: 'OPTIONS, GET, HEAD',
            'Content-Length': '0'
          });
          res.end();
        }
      };
      if (_.has(additionalStaticJs, pathname) && !WebAppInternals.inlineScriptsAllowed()) {
        serveStaticJs(additionalStaticJs[pathname]);
        return;
      }
      const {
        arch,
        path
      } = WebApp.categorizeRequest(req);
      if (!hasOwn.call(WebApp.clientPrograms, arch)) {
        // We could come here in case we run with some architectures excluded
        next();
        return;
      }

      // If pauseClient(arch) has been called, program.paused will be a
      // Promise that will be resolved when the program is unpaused.
      const program = WebApp.clientPrograms[arch];
      await program.paused;
      if (path === '/meteor_runtime_config.js' && !WebAppInternals.inlineScriptsAllowed()) {
        serveStaticJs("__meteor_runtime_config__ = ".concat(program.meteorRuntimeConfig, ";"));
        return;
      }
      const info = getStaticFileInfo(staticFilesByArch, pathname, path, arch);
      if (!info) {
        next();
        return;
      }
      // "send" will handle HEAD & GET requests
      if (req.method !== 'HEAD' && req.method !== 'GET' && !((_Meteor$settings$pack3 = Meteor.settings.packages) !== null && _Meteor$settings$pack3 !== void 0 && (_Meteor$settings$pack4 = _Meteor$settings$pack3.webapp) !== null && _Meteor$settings$pack4 !== void 0 && _Meteor$settings$pack4.alwaysReturnContent)) {
        const status = req.method === 'OPTIONS' ? 200 : 405;
        res.writeHead(status, {
          Allow: 'OPTIONS, GET, HEAD',
          'Content-Length': '0'
        });
        res.end();
        return;
      }

      // We don't need to call pause because, unlike 'static', once we call into
      // 'send' and yield to the event loop, we never call another handler with
      // 'next'.

      // Cacheable files are files that should never change. Typically
      // named by their hash (eg meteor bundled js and css files).
      // We cache them ~forever (1yr).
      const maxAge = info.cacheable ? 1000 * 60 * 60 * 24 * 365 : 0;
      if (info.cacheable) {
        // Since we use req.headers["user-agent"] to determine whether the
        // client should receive modern or legacy resources, tell the client
        // to invalidate cached resources when/if its user agent string
        // changes in the future.
        res.setHeader('Vary', 'User-Agent');
      }

      // Set the X-SourceMap header, which current Chrome, FireFox, and Safari
      // understand.  (The SourceMap header is slightly more spec-correct but FF
      // doesn't understand it.)
      //
      // You may also need to enable source maps in Chrome: open dev tools, click
      // the gear in the bottom right corner, and select "enable source maps".
      if (info.sourceMapUrl) {
        res.setHeader('X-SourceMap', __meteor_runtime_config__.ROOT_URL_PATH_PREFIX + info.sourceMapUrl);
      }
      if (info.type === 'js' || info.type === 'dynamic js') {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      } else if (info.type === 'css') {
        res.setHeader('Content-Type', 'text/css; charset=UTF-8');
      } else if (info.type === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=UTF-8');
      }
      if (info.hash) {
        res.setHeader('ETag', '"' + info.hash + '"');
      }
      if (info.content) {
        res.setHeader('Content-Length', Buffer.byteLength(info.content));
        res.write(info.content);
        res.end();
      } else {
        send(req, info.absolutePath, {
          maxage: maxAge,
          dotfiles: 'allow',
          // if we specified a dotfile in the manifest, serve it
          lastModified: false // don't set last-modified based on the file date
        }).on('error', function (err) {
          Log.error('Error serving static file ' + err);
          res.writeHead(500);
          res.end();
        }).on('directory', function () {
          Log.error('Unexpected directory ' + info.absolutePath);
          res.writeHead(500);
          res.end();
        }).pipe(res);
      }
    };
    function getStaticFileInfo(staticFilesByArch, originalPath, path, arch) {
      if (!hasOwn.call(WebApp.clientPrograms, arch)) {
        return null;
      }

      // Get a list of all available static file architectures, with arch
      // first in the list if it exists.
      const staticArchList = Object.keys(staticFilesByArch);
      const archIndex = staticArchList.indexOf(arch);
      if (archIndex > 0) {
        staticArchList.unshift(staticArchList.splice(archIndex, 1)[0]);
      }
      let info = null;
      staticArchList.some(arch => {
        const staticFiles = staticFilesByArch[arch];
        function finalize(path) {
          info = staticFiles[path];
          // Sometimes we register a lazy function instead of actual data in
          // the staticFiles manifest.
          if (typeof info === 'function') {
            info = staticFiles[path] = info();
          }
          return info;
        }

        // If staticFiles contains originalPath with the arch inferred above,
        // use that information.
        if (hasOwn.call(staticFiles, originalPath)) {
          return finalize(originalPath);
        }

        // If categorizeRequest returned an alternate path, try that instead.
        if (path !== originalPath && hasOwn.call(staticFiles, path)) {
          return finalize(path);
        }
      });
      return info;
    }

    // Parse the passed in port value. Return the port as-is if it's a String
    // (e.g. a Windows Server style named pipe), otherwise return the port as an
    // integer.
    //
    // DEPRECATED: Direct use of this function is not recommended; it is no
    // longer used internally, and will be removed in a future release.
    WebAppInternals.parsePort = port => {
      let parsedPort = parseInt(port);
      if (Number.isNaN(parsedPort)) {
        parsedPort = port;
      }
      return parsedPort;
    };
    onMessage('webapp-pause-client', async _ref => {
      let {
        arch
      } = _ref;
      await WebAppInternals.pauseClient(arch);
    });
    onMessage('webapp-reload-client', async _ref2 => {
      let {
        arch
      } = _ref2;
      await WebAppInternals.generateClientProgram(arch);
    });
    async function runWebAppServer() {
      var shuttingDown = false;
      var syncQueue = new Meteor._AsynchronousQueue();
      var getItemPathname = function (itemUrl) {
        return decodeURIComponent(parseUrl(itemUrl).pathname);
      };
      WebAppInternals.reloadClientPrograms = async function () {
        await syncQueue.runTask(function () {
          const staticFilesByArch = Object.create(null);
          const {
            configJson
          } = __meteor_bootstrap__;
          const clientArchs = configJson.clientArchs || Object.keys(configJson.clientPaths);
          try {
            clientArchs.forEach(arch => {
              generateClientProgram(arch, staticFilesByArch);
            });
            WebAppInternals.staticFilesByArch = staticFilesByArch;
          } catch (e) {
            Log.error('Error reloading the client program: ' + e.stack);
            process.exit(1);
          }
        });
      };

      // Pause any incoming requests and make them wait for the program to be
      // unpaused the next time generateClientProgram(arch) is called.
      WebAppInternals.pauseClient = async function (arch) {
        await syncQueue.runTask(() => {
          const program = WebApp.clientPrograms[arch];
          const {
            unpause
          } = program;
          program.paused = new Promise(resolve => {
            if (typeof unpause === 'function') {
              // If there happens to be an existing program.unpause function,
              // compose it with the resolve function.
              program.unpause = function () {
                unpause();
                resolve();
              };
            } else {
              program.unpause = resolve;
            }
          });
        });
      };
      WebAppInternals.generateClientProgram = async function (arch) {
        await syncQueue.runTask(() => generateClientProgram(arch));
      };
      function generateClientProgram(arch) {
        let staticFilesByArch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : WebAppInternals.staticFilesByArch;
        const clientDir = pathJoin(pathDirname(__meteor_bootstrap__.serverDir), arch);

        // read the control for the client we'll be serving up
        const programJsonPath = pathJoin(clientDir, 'program.json');
        let programJson;
        try {
          programJson = JSON.parse(readFileSync(programJsonPath));
        } catch (e) {
          if (e.code === 'ENOENT') return;
          throw e;
        }
        if (programJson.format !== 'web-program-pre1') {
          throw new Error('Unsupported format for client assets: ' + JSON.stringify(programJson.format));
        }
        if (!programJsonPath || !clientDir || !programJson) {
          throw new Error('Client config file not parsed.');
        }
        archPath[arch] = clientDir;
        const staticFiles = staticFilesByArch[arch] = Object.create(null);
        const {
          manifest
        } = programJson;
        manifest.forEach(item => {
          if (item.url && item.where === 'client') {
            staticFiles[getItemPathname(item.url)] = {
              absolutePath: pathJoin(clientDir, item.path),
              cacheable: item.cacheable,
              hash: item.hash,
              // Link from source to its map
              sourceMapUrl: item.sourceMapUrl,
              type: item.type
            };
            if (item.sourceMap) {
              // Serve the source map too, under the specified URL. We assume
              // all source maps are cacheable.
              staticFiles[getItemPathname(item.sourceMapUrl)] = {
                absolutePath: pathJoin(clientDir, item.sourceMap),
                cacheable: true
              };
            }
          }
        });
        const {
          PUBLIC_SETTINGS
        } = __meteor_runtime_config__;
        const configOverrides = {
          PUBLIC_SETTINGS
        };
        const oldProgram = WebApp.clientPrograms[arch];
        const newProgram = WebApp.clientPrograms[arch] = {
          format: 'web-program-pre1',
          manifest: manifest,
          // Use arrow functions so that these versions can be lazily
          // calculated later, and so that they will not be included in the
          // staticFiles[manifestUrl].content string below.
          //
          // Note: these version calculations must be kept in agreement with
          // CordovaBuilder#appendVersion in tools/cordova/builder.js, or hot
          // code push will reload Cordova apps unnecessarily.
          version: () => WebAppHashing.calculateClientHash(manifest, null, configOverrides),
          versionRefreshable: () => WebAppHashing.calculateClientHash(manifest, type => type === 'css', configOverrides),
          versionNonRefreshable: () => WebAppHashing.calculateClientHash(manifest, (type, replaceable) => type !== 'css' && !replaceable, configOverrides),
          versionReplaceable: () => WebAppHashing.calculateClientHash(manifest, (_type, replaceable) => replaceable, configOverrides),
          cordovaCompatibilityVersions: programJson.cordovaCompatibilityVersions,
          PUBLIC_SETTINGS,
          hmrVersion: programJson.hmrVersion
        };

        // Expose program details as a string reachable via the following URL.
        const manifestUrlPrefix = '/__' + arch.replace(/^web\./, '');
        const manifestUrl = manifestUrlPrefix + getItemPathname('/manifest.json');
        staticFiles[manifestUrl] = () => {
          if (Package.autoupdate) {
            const {
              AUTOUPDATE_VERSION = Package.autoupdate.Autoupdate.autoupdateVersion
            } = process.env;
            if (AUTOUPDATE_VERSION) {
              newProgram.version = AUTOUPDATE_VERSION;
            }
          }
          if (typeof newProgram.version === 'function') {
            newProgram.version = newProgram.version();
          }
          return {
            content: JSON.stringify(newProgram),
            cacheable: false,
            hash: newProgram.version,
            type: 'json'
          };
        };
        generateBoilerplateForArch(arch);

        // If there are any requests waiting on oldProgram.paused, let them
        // continue now (using the new program).
        if (oldProgram && oldProgram.paused) {
          oldProgram.unpause();
        }
      }
      const defaultOptionsForArch = {
        'web.cordova': {
          runtimeConfigOverrides: {
            // XXX We use absoluteUrl() here so that we serve https://
            // URLs to cordova clients if force-ssl is in use. If we were
            // to use __meteor_runtime_config__.ROOT_URL instead of
            // absoluteUrl(), then Cordova clients would immediately get a
            // HCP setting their DDP_DEFAULT_CONNECTION_URL to
            // http://example.meteor.com. This breaks the app, because
            // force-ssl doesn't serve CORS headers on 302
            // redirects. (Plus it's undesirable to have clients
            // connecting to http://example.meteor.com when force-ssl is
            // in use.)
            DDP_DEFAULT_CONNECTION_URL: process.env.MOBILE_DDP_URL || Meteor.absoluteUrl(),
            ROOT_URL: process.env.MOBILE_ROOT_URL || Meteor.absoluteUrl()
          }
        },
        'web.browser': {
          runtimeConfigOverrides: {
            isModern: true
          }
        },
        'web.browser.legacy': {
          runtimeConfigOverrides: {
            isModern: false
          }
        }
      };
      WebAppInternals.generateBoilerplate = async function () {
        // This boilerplate will be served to the mobile devices when used with
        // Meteor/Cordova for the Hot-Code Push and since the file will be served by
        // the device's server, it is important to set the DDP url to the actual
        // Meteor server accepting DDP connections and not the device's file server.
        await syncQueue.runTask(function () {
          Object.keys(WebApp.clientPrograms).forEach(generateBoilerplateForArch);
        });
      };
      function generateBoilerplateForArch(arch) {
        const program = WebApp.clientPrograms[arch];
        const additionalOptions = defaultOptionsForArch[arch] || {};
        const {
          baseData
        } = boilerplateByArch[arch] = WebAppInternals.generateBoilerplateInstance(arch, program.manifest, additionalOptions);
        // We need the runtime config with overrides for meteor_runtime_config.js:
        program.meteorRuntimeConfig = JSON.stringify(_objectSpread(_objectSpread({}, __meteor_runtime_config__), additionalOptions.runtimeConfigOverrides || null));
        program.refreshableAssets = baseData.css.map(file => ({
          url: bundledJsCssUrlRewriteHook(file.url)
        }));
      }
      await WebAppInternals.reloadClientPrograms();

      // webserver
      var app = createExpressApp();

      // Packages and apps can add handlers that run before any other Meteor
      // handlers via WebApp.rawExpressHandlers.
      var rawExpressHandlers = createExpressApp();
      app.use(rawExpressHandlers);

      // Auto-compress any json, javascript, or text.
      app.use(compress({
        filter: shouldCompress
      }));

      // parse cookies into an object
      app.use(cookieParser());

      // We're not a proxy; reject (without crashing) attempts to treat us like
      // one. (See #1212.)
      app.use(function (req, res, next) {
        if (RoutePolicy.isValidUrl(req.url)) {
          next();
          return;
        }
        res.writeHead(400);
        res.write('Not a proxy');
        res.end();
      });

      // Parse the query string into res.query. Used by oauth_server, but it's
      // generally pretty handy..
      //
      // Do this before the next middleware destroys req.url if a path prefix
      // is set to close #10111.
      app.use(function (request, response, next) {
        request.query = qs.parse(parseUrl(request.url).query);
        next();
      });
      function getPathParts(path) {
        const parts = path.split('/');
        while (parts[0] === '') parts.shift();
        return parts;
      }
      function isPrefixOf(prefix, array) {
        return prefix.length <= array.length && prefix.every((part, i) => part === array[i]);
      }

      // Strip off the path prefix, if it exists.
      app.use(function (request, response, next) {
        const pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX;
        const {
          pathname,
          search
        } = parseUrl(request.url);

        // check if the path in the url starts with the path prefix
        if (pathPrefix) {
          const prefixParts = getPathParts(pathPrefix);
          const pathParts = getPathParts(pathname);
          if (isPrefixOf(prefixParts, pathParts)) {
            request.url = '/' + pathParts.slice(prefixParts.length).join('/');
            if (search) {
              request.url += search;
            }
            return next();
          }
        }
        if (pathname === '/favicon.ico' || pathname === '/robots.txt') {
          return next();
        }
        if (pathPrefix) {
          response.writeHead(404);
          response.write('Unknown path');
          response.end();
          return;
        }
        next();
      });

      // Serve static files from the manifest.
      // This is inspired by the 'static' middleware.
      app.use(function (req, res, next) {
        // console.log(String(arguments.callee));
        WebAppInternals.staticFilesMiddleware(WebAppInternals.staticFilesByArch, req, res, next);
      });

      // Core Meteor packages like dynamic-import can add handlers before
      // other handlers added by package and application code.
      app.use(WebAppInternals.meteorInternalHandlers = createExpressApp());

      /**
       * @name expressHandlersCallback(req, res, next)
       * @locus Server
       * @isprototype true
       * @summary callback handler for `WebApp.expressHandlers`
       * @param {Object} req
       * a Node.js
       * [IncomingMessage](https://nodejs.org/api/http.html#class-httpincomingmessage)
       * object with some extra properties. This argument can be used
       *  to get information about the incoming request.
       * @param {Object} res
       * a Node.js
       * [ServerResponse](https://nodejs.org/api/http.html#class-httpserverresponse)
       * object. Use this to write data that should be sent in response to the
       * request, and call `res.end()` when you are done.
       * @param {Function} next
       * Calling this function will pass on the handling of
       * this request to the next relevant handler.
       *
       */

      /**
       * @method handlers
       * @memberof WebApp
       * @locus Server
       * @summary Register a handler for all HTTP requests.
       * @param {String} [path]
       * This handler will only be called on paths that match
       * this string. The match has to border on a `/` or a `.`.
       *
       * For example, `/hello` will match `/hello/world` and
       * `/hello.world`, but not `/hello_world`.
       * @param {expressHandlersCallback} handler
       * A handler function that will be called on HTTP requests.
       * See `expressHandlersCallback`
       *
       */
      // Packages and apps can add handlers to this via WebApp.expressHandlers.
      // They are inserted before our default handler.
      var packageAndAppHandlers = createExpressApp();
      app.use(packageAndAppHandlers);
      let suppressExpressErrors = false;
      // Express knows it is an error handler because it has 4 arguments instead of
      // 3. go figure.  (It is not smart enough to find such a thing if it's hidden
      // inside packageAndAppHandlers.)
      app.use(function (err, req, res, next) {
        if (!err || !suppressExpressErrors || !req.headers['x-suppress-error']) {
          next(err);
          return;
        }
        res.writeHead(err.status, {
          'Content-Type': 'text/plain'
        });
        res.end('An error message');
      });
      app.use(async function (req, res, next) {
        var _Meteor$settings$pack5, _Meteor$settings$pack6;
        if (!appUrl(req.url)) {
          return next();
        } else if (req.method !== 'HEAD' && req.method !== 'GET' && !((_Meteor$settings$pack5 = Meteor.settings.packages) !== null && _Meteor$settings$pack5 !== void 0 && (_Meteor$settings$pack6 = _Meteor$settings$pack5.webapp) !== null && _Meteor$settings$pack6 !== void 0 && _Meteor$settings$pack6.alwaysReturnContent)) {
          const status = req.method === 'OPTIONS' ? 200 : 405;
          res.writeHead(status, {
            Allow: 'OPTIONS, GET, HEAD',
            'Content-Length': '0'
          });
          res.end();
        } else {
          var headers = {
            'Content-Type': 'text/html; charset=utf-8'
          };
          if (shuttingDown) {
            headers['Connection'] = 'Close';
          }
          var request = WebApp.categorizeRequest(req);
          if (request.url.query && request.url.query['meteor_css_resource']) {
            // In this case, we're requesting a CSS resource in the meteor-specific
            // way, but we don't have it.  Serve a static css file that indicates that
            // we didn't have it, so we can detect that and refresh.  Make sure
            // that any proxies or CDNs don't cache this error!  (Normally proxies
            // or CDNs are smart enough not to cache error pages, but in order to
            // make this hack work, we need to return the CSS file as a 200, which
            // would otherwise be cached.)
            headers['Content-Type'] = 'text/css; charset=utf-8';
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(200, headers);
            res.write('.meteor-css-not-found-error { width: 0px;}');
            res.end();
            return;
          }
          if (request.url.query && request.url.query['meteor_js_resource']) {
            // Similarly, we're requesting a JS resource that we don't have.
            // Serve an uncached 404. (We can't use the same hack we use for CSS,
            // because actually acting on that hack requires us to have the JS
            // already!)
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            res.end('404 Not Found');
            return;
          }
          if (request.url.query && request.url.query['meteor_dont_serve_index']) {
            // When downloading files during a Cordova hot code push, we need
            // to detect if a file is not available instead of inadvertently
            // downloading the default index page.
            // So similar to the situation above, we serve an uncached 404.
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            res.end('404 Not Found');
            return;
          }
          const {
            arch
          } = request;
          assert.strictEqual(typeof arch, 'string', {
            arch
          });
          if (!hasOwn.call(WebApp.clientPrograms, arch)) {
            // We could come here in case we run with some architectures excluded
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            if (Meteor.isDevelopment) {
              res.end("No client program found for the ".concat(arch, " architecture."));
            } else {
              // Safety net, but this branch should not be possible.
              res.end('404 Not Found');
            }
            return;
          }

          // If pauseClient(arch) has been called, program.paused will be a
          // Promise that will be resolved when the program is unpaused.
          await WebApp.clientPrograms[arch].paused;
          return getBoilerplateAsync(request, arch).then(_ref3 => {
            let {
              stream,
              statusCode,
              headers: newHeaders
            } = _ref3;
            if (!statusCode) {
              statusCode = res.statusCode ? res.statusCode : 200;
            }
            if (newHeaders) {
              Object.assign(headers, newHeaders);
            }
            res.writeHead(statusCode, headers);
            stream.pipe(res, {
              // End the response when the stream ends.
              end: true
            });
          }).catch(error => {
            Log.error('Error running template: ' + error.stack);
            res.writeHead(500, headers);
            res.end();
          });
        }
      });

      // Return 404 by default, if no other handlers serve this URL.
      app.use(function (req, res) {
        res.writeHead(404);
        res.end();
      });
      var httpServer = createServer(app);
      var onListeningCallbacks = [];

      // After 5 seconds w/o data on a socket, kill it.  On the other hand, if
      // there's an outstanding request, give it a higher timeout instead (to avoid
      // killing long-polling requests)
      httpServer.setTimeout(SHORT_SOCKET_TIMEOUT);

      // Do this here, and then also in livedata/stream_server.js, because
      // stream_server.js kills all the current request handlers when installing its
      // own.
      httpServer.on('request', WebApp._timeoutAdjustmentRequestCallback);

      // If the client gave us a bad request, tell it instead of just closing the
      // socket. This lets load balancers in front of us differentiate between "a
      // server is randomly closing sockets for no reason" and "client sent a bad
      // request".
      //
      // This will only work on Node 6; Node 4 destroys the socket before calling
      // this event. See https://github.com/nodejs/node/pull/4557/ for details.
      httpServer.on('clientError', (err, socket) => {
        // Pre-Node-6, do nothing.
        if (socket.destroyed) {
          return;
        }
        if (err.message === 'Parse Error') {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        } else {
          // For other errors, use the default behavior as if we had no clientError
          // handler.
          socket.destroy(err);
        }
      });
      const suppressErrors = function () {
        suppressExpressErrors = true;
      };
      let warnedAboutConnectUsage = false;

      // start up app
      _.extend(WebApp, {
        connectHandlers: packageAndAppHandlers,
        handlers: packageAndAppHandlers,
        rawConnectHandlers: rawExpressHandlers,
        rawHandlers: rawExpressHandlers,
        httpServer: httpServer,
        expressApp: app,
        // For testing.
        suppressConnectErrors: () => {
          if (!warnedAboutConnectUsage) {
            Meteor._debug("WebApp.suppressConnectErrors has been renamed to Meteor._suppressExpressErrors and it should be used only in tests.");
            warnedAboutConnectUsage = true;
          }
          suppressErrors();
        },
        _suppressExpressErrors: suppressErrors,
        onListening: function (f) {
          if (onListeningCallbacks) onListeningCallbacks.push(f);else f();
        },
        // This can be overridden by users who want to modify how listening works
        // (eg, to run a proxy like Apollo Engine Proxy in front of the server).
        startListening: function (httpServer, listenOptions, cb) {
          httpServer.listen(listenOptions, cb);
        }
      });

      /**
      * @name main
      * @locus Server
      * @summary Starts the HTTP server.
      *  If `UNIX_SOCKET_PATH` is present Meteor's HTTP server will use that socket file for inter-process communication, instead of TCP.
      * If you choose to not include webapp package in your application this method still must be defined for your Meteor application to work.
      */
      // Let the rest of the packages (and Meteor.startup hooks) insert Express
      // middlewares and update __meteor_runtime_config__, then keep going to set up
      // actually serving HTML.
      exports.main = async argv => {
        await WebAppInternals.generateBoilerplate();
        const startHttpServer = listenOptions => {
          WebApp.startListening(httpServer, listenOptions, Meteor.bindEnvironment(() => {
            if (process.env.METEOR_PRINT_ON_LISTEN) {
              console.log('LISTENING');
            }
            const callbacks = onListeningCallbacks;
            onListeningCallbacks = null;
            callbacks.forEach(callback => {
              callback();
            });
          }, e => {
            console.error('Error listening:', e);
            console.error(e && e.stack);
          }));
        };
        let localPort = process.env.PORT || 0;
        let unixSocketPath = process.env.UNIX_SOCKET_PATH;
        if (unixSocketPath) {
          if (cluster.isWorker) {
            const workerName = cluster.worker.process.env.name || cluster.worker.id;
            unixSocketPath += '.' + workerName + '.sock';
          }
          // Start the HTTP server using a socket file.
          removeExistingSocketFile(unixSocketPath);
          startHttpServer({
            path: unixSocketPath
          });
          const unixSocketPermissions = (process.env.UNIX_SOCKET_PERMISSIONS || '').trim();
          if (unixSocketPermissions) {
            if (/^[0-7]{3}$/.test(unixSocketPermissions)) {
              chmodSync(unixSocketPath, parseInt(unixSocketPermissions, 8));
            } else {
              throw new Error('Invalid UNIX_SOCKET_PERMISSIONS specified');
            }
          }
          const unixSocketGroup = (process.env.UNIX_SOCKET_GROUP || '').trim();
          if (unixSocketGroup) {
            //whomst automatically handles both group names and numerical gids
            const unixSocketGroupInfo = whomst.sync.group(unixSocketGroup);
            if (unixSocketGroupInfo === null) {
              throw new Error('Invalid UNIX_SOCKET_GROUP name specified');
            }
            chownSync(unixSocketPath, userInfo().uid, unixSocketGroupInfo.gid);
          }
          registerSocketFileCleanup(unixSocketPath);
        } else {
          localPort = isNaN(Number(localPort)) ? localPort : Number(localPort);
          if (/\\\\?.+\\pipe\\?.+/.test(localPort)) {
            // Start the HTTP server using Windows Server style named pipe.
            startHttpServer({
              path: localPort
            });
          } else if (typeof localPort === 'number') {
            // Start the HTTP server using TCP.
            startHttpServer({
              port: localPort,
              host: process.env.BIND_IP || '0.0.0.0'
            });
          } else {
            throw new Error('Invalid PORT specified');
          }
        }
        return 'DAEMON';
      };
    }
    var inlineScriptsAllowed = true;
    WebAppInternals.inlineScriptsAllowed = function () {
      return inlineScriptsAllowed;
    };
    WebAppInternals.setInlineScriptsAllowed = async function (value) {
      inlineScriptsAllowed = value;
      await WebAppInternals.generateBoilerplate();
    };
    var sriMode;
    WebAppInternals.enableSubresourceIntegrity = async function () {
      let use_credentials = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      sriMode = use_credentials ? 'use-credentials' : 'anonymous';
      await WebAppInternals.generateBoilerplate();
    };
    WebAppInternals.setBundledJsCssUrlRewriteHook = async function (hookFn) {
      bundledJsCssUrlRewriteHook = hookFn;
      await WebAppInternals.generateBoilerplate();
    };
    WebAppInternals.setBundledJsCssPrefix = async function (prefix) {
      var self = this;
      await self.setBundledJsCssUrlRewriteHook(function (url) {
        return prefix + url;
      });
    };

    // Packages can call `WebAppInternals.addStaticJs` to specify static
    // JavaScript to be included in the app. This static JS will be inlined,
    // unless inline scripts have been disabled, in which case it will be
    // served under `/<sha1 of contents>`.
    var additionalStaticJs = {};
    WebAppInternals.addStaticJs = function (contents) {
      additionalStaticJs['/' + sha1(contents) + '.js'] = contents;
    };

    // Exported for tests
    WebAppInternals.getBoilerplate = getBoilerplate;
    WebAppInternals.additionalStaticJs = additionalStaticJs;
    await runWebAppServer();
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: true
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"socket_file.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// packages/webapp/socket_file.js                                                                          //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      removeExistingSocketFile: () => removeExistingSocketFile,
      registerSocketFileCleanup: () => registerSocketFileCleanup
    });
    let statSync, unlinkSync, existsSync;
    module.link("fs", {
      statSync(v) {
        statSync = v;
      },
      unlinkSync(v) {
        unlinkSync = v;
      },
      existsSync(v) {
        existsSync = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const removeExistingSocketFile = socketPath => {
      try {
        if (statSync(socketPath).isSocket()) {
          // Since a new socket file will be created, remove the existing
          // file.
          unlinkSync(socketPath);
        } else {
          throw new Error("An existing file was found at \"".concat(socketPath, "\" and it is not ") + 'a socket file. Please confirm PORT is pointing to valid and ' + 'un-used socket file path.');
        }
      } catch (error) {
        // If there is no existing socket file to cleanup, great, we'll
        // continue normally. If the caught exception represents any other
        // issue, re-throw.
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    };
    const registerSocketFileCleanup = function (socketPath) {
      let eventEmitter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : process;
      ['exit', 'SIGINT', 'SIGHUP', 'SIGTERM'].forEach(signal => {
        eventEmitter.on(signal, Meteor.bindEnvironment(() => {
          if (existsSync(socketPath)) {
            unlinkSync(socketPath);
          }
        }));
      });
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"express":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/express/package.json                                            //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "express",
  "version": "4.18.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/express/index.js                                                //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"compression":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/compression/package.json                                        //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "compression",
  "version": "1.7.4"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/compression/index.js                                            //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"cookie-parser":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/cookie-parser/package.json                                      //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "cookie-parser",
  "version": "1.4.6"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/cookie-parser/index.js                                          //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"qs":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/qs/package.json                                                 //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "qs",
  "version": "6.11.2",
  "main": "lib/index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/qs/lib/index.js                                                 //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"parseurl":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/parseurl/package.json                                           //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "parseurl",
  "version": "1.3.3"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/parseurl/index.js                                               //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"useragent":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/useragent/package.json                                          //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "useragent",
  "version": "2.3.0",
  "main": "./index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/useragent/index.js                                              //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"send":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/send/package.json                                               //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "send",
  "version": "0.18.0"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/send/index.js                                                   //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"@vlasky":{"whomst":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/@vlasky/whomst/package.json                                     //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "@vlasky/whomst",
  "version": "0.1.7",
  "main": "index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/@vlasky/whomst/index.js                                         //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      WebApp: WebApp,
      WebAppInternals: WebAppInternals,
      main: main
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/webapp/webapp_server.js"
  ],
  mainModulePath: "/node_modules/meteor/webapp/webapp_server.js"
}});

//# sourceURL=meteor://💻app/packages/webapp.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvd2ViYXBwL3dlYmFwcF9zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3dlYmFwcC9zb2NrZXRfZmlsZS5qcyJdLCJuYW1lcyI6WyJfb2JqZWN0U3ByZWFkIiwibW9kdWxlMSIsImxpbmsiLCJkZWZhdWx0IiwidiIsImV4cG9ydCIsIldlYkFwcCIsIldlYkFwcEludGVybmFscyIsImFzc2VydCIsInJlYWRGaWxlU3luYyIsImNobW9kU3luYyIsImNob3duU3luYyIsImNyZWF0ZVNlcnZlciIsInVzZXJJbmZvIiwicGF0aEpvaW4iLCJwYXRoRGlybmFtZSIsImpvaW4iLCJkaXJuYW1lIiwicGFyc2VVcmwiLCJwYXJzZSIsImNyZWF0ZUhhc2giLCJleHByZXNzIiwiY29tcHJlc3MiLCJjb29raWVQYXJzZXIiLCJxcyIsInBhcnNlUmVxdWVzdCIsImxvb2t1cFVzZXJBZ2VudCIsImxvb2t1cCIsImlzTW9kZXJuIiwic2VuZCIsInJlbW92ZUV4aXN0aW5nU29ja2V0RmlsZSIsInJlZ2lzdGVyU29ja2V0RmlsZUNsZWFudXAiLCJjbHVzdGVyIiwid2hvbXN0Iiwib25NZXNzYWdlIiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJTSE9SVF9TT0NLRVRfVElNRU9VVCIsIkxPTkdfU09DS0VUX1RJTUVPVVQiLCJjcmVhdGVFeHByZXNzQXBwIiwiYXBwIiwic2V0IiwiaGFzT3duIiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJOcG1Nb2R1bGVzIiwidmVyc2lvbiIsIk5wbSIsInJlcXVpcmUiLCJtb2R1bGUiLCJkZWZhdWx0QXJjaCIsImNsaWVudFByb2dyYW1zIiwiYXJjaFBhdGgiLCJidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayIsInVybCIsImJ1bmRsZWRQcmVmaXgiLCJfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fIiwiUk9PVF9VUkxfUEFUSF9QUkVGSVgiLCJzaGExIiwiY29udGVudHMiLCJoYXNoIiwidXBkYXRlIiwiZGlnZXN0Iiwic2hvdWxkQ29tcHJlc3MiLCJyZXEiLCJyZXMiLCJoZWFkZXJzIiwiZmlsdGVyIiwiY2FtZWxDYXNlIiwibmFtZSIsInBhcnRzIiwic3BsaXQiLCJ0b0xvd2VyQ2FzZSIsImkiLCJsZW5ndGgiLCJjaGFyQXQiLCJ0b1VwcGVyQ2FzZSIsInN1YnN0ciIsImlkZW50aWZ5QnJvd3NlciIsInVzZXJBZ2VudFN0cmluZyIsInVzZXJBZ2VudCIsImZhbWlseSIsIm1ham9yIiwibWlub3IiLCJwYXRjaCIsImNhdGVnb3JpemVSZXF1ZXN0IiwiYnJvd3NlciIsImFyY2giLCJtb2Rlcm4iLCJwYXRoIiwicGF0aG5hbWUiLCJjYXRlZ29yaXplZCIsImR5bmFtaWNIZWFkIiwiZHluYW1pY0JvZHkiLCJjb29raWVzIiwicGF0aFBhcnRzIiwiYXJjaEtleSIsInN0YXJ0c1dpdGgiLCJhcmNoQ2xlYW5lZCIsInNsaWNlIiwiY2FsbCIsInNwbGljZSIsImFzc2lnbiIsInByZWZlcnJlZEFyY2hPcmRlciIsImh0bWxBdHRyaWJ1dGVIb29rcyIsImdldEh0bWxBdHRyaWJ1dGVzIiwicmVxdWVzdCIsImNvbWJpbmVkQXR0cmlidXRlcyIsIl8iLCJlYWNoIiwiaG9vayIsImF0dHJpYnV0ZXMiLCJFcnJvciIsImV4dGVuZCIsImFkZEh0bWxBdHRyaWJ1dGVIb29rIiwicHVzaCIsImFwcFVybCIsIlJvdXRlUG9saWN5IiwiY2xhc3NpZnkiLCJNZXRlb3IiLCJzdGFydHVwIiwiZ2V0dGVyIiwia2V5IiwicHJvZ3JhbSIsInZhbHVlIiwiY2FsY3VsYXRlQ2xpZW50SGFzaCIsImNsaWVudEhhc2giLCJjYWxjdWxhdGVDbGllbnRIYXNoUmVmcmVzaGFibGUiLCJjYWxjdWxhdGVDbGllbnRIYXNoTm9uUmVmcmVzaGFibGUiLCJjYWxjdWxhdGVDbGllbnRIYXNoUmVwbGFjZWFibGUiLCJnZXRSZWZyZXNoYWJsZUFzc2V0cyIsIl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayIsInNldFRpbWVvdXQiLCJmaW5pc2hMaXN0ZW5lcnMiLCJsaXN0ZW5lcnMiLCJyZW1vdmVBbGxMaXN0ZW5lcnMiLCJvbiIsImwiLCJib2lsZXJwbGF0ZUJ5QXJjaCIsImJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrcyIsImNyZWF0ZSIsInJlZ2lzdGVyQm9pbGVycGxhdGVEYXRhQ2FsbGJhY2siLCJjYWxsYmFjayIsInByZXZpb3VzQ2FsbGJhY2siLCJzdHJpY3RFcXVhbCIsImdldEJvaWxlcnBsYXRlIiwiZ2V0Qm9pbGVycGxhdGVBc3luYyIsImVuY29kZVJ1bnRpbWVDb25maWciLCJydGltZUNvbmZpZyIsIkpTT04iLCJzdHJpbmdpZnkiLCJlbmNvZGVVUklDb21wb25lbnQiLCJkZWNvZGVSdW50aW1lQ29uZmlnIiwicnRpbWVDb25maWdTdHIiLCJkZWNvZGVVUklDb21wb25lbnQiLCJydW50aW1lQ29uZmlnIiwiaG9va3MiLCJIb29rIiwidXBkYXRlSG9va3MiLCJpc1VwZGF0ZWRCeUFyY2giLCJhZGRSdW50aW1lQ29uZmlnSG9vayIsInJlZ2lzdGVyIiwiYm9pbGVycGxhdGUiLCJmb3JFYWNoIiwibWV0ZW9yUnVudGltZUNvbmZpZyIsImVuY29kZWRDdXJyZW50Q29uZmlnIiwiYmFzZURhdGEiLCJ1cGRhdGVkIiwiZGF0YSIsImh0bWxBdHRyaWJ1dGVzIiwicGljayIsIm1hZGVDaGFuZ2VzIiwicHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwia2V5cyIsInRoZW4iLCJyZXN1bHQiLCJzdHJlYW0iLCJ0b0hUTUxTdHJlYW0iLCJzdGF0dXNDb2RlIiwiYWRkVXBkYXRlZE5vdGlmeUhvb2siLCJoYW5kbGVyIiwiZ2VuZXJhdGVCb2lsZXJwbGF0ZUluc3RhbmNlIiwibWFuaWZlc3QiLCJhZGRpdGlvbmFsT3B0aW9ucyIsInJ1bnRpbWVDb25maWdPdmVycmlkZXMiLCJjYiIsIkJvaWxlcnBsYXRlIiwicGF0aE1hcHBlciIsIml0ZW1QYXRoIiwiYmFzZURhdGFFeHRlbnNpb24iLCJhZGRpdGlvbmFsU3RhdGljSnMiLCJtYXAiLCJtZXRlb3JSdW50aW1lSGFzaCIsInJvb3RVcmxQYXRoUHJlZml4Iiwic3JpTW9kZSIsImlubGluZVNjcmlwdHNBbGxvd2VkIiwiaW5saW5lIiwic3RhdGljRmlsZXNNaWRkbGV3YXJlIiwic3RhdGljRmlsZXNCeUFyY2giLCJuZXh0IiwiX01ldGVvciRzZXR0aW5ncyRwYWNrMyIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazQiLCJlIiwic2VydmVTdGF0aWNKcyIsInMiLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2siLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2syIiwibWV0aG9kIiwic2V0dGluZ3MiLCJwYWNrYWdlcyIsIndlYmFwcCIsImFsd2F5c1JldHVybkNvbnRlbnQiLCJ3cml0ZUhlYWQiLCJCdWZmZXIiLCJieXRlTGVuZ3RoIiwid3JpdGUiLCJlbmQiLCJzdGF0dXMiLCJBbGxvdyIsImhhcyIsInBhdXNlZCIsImNvbmNhdCIsImluZm8iLCJnZXRTdGF0aWNGaWxlSW5mbyIsIm1heEFnZSIsImNhY2hlYWJsZSIsInNldEhlYWRlciIsInNvdXJjZU1hcFVybCIsInR5cGUiLCJjb250ZW50IiwiYWJzb2x1dGVQYXRoIiwibWF4YWdlIiwiZG90ZmlsZXMiLCJsYXN0TW9kaWZpZWQiLCJlcnIiLCJMb2ciLCJlcnJvciIsInBpcGUiLCJvcmlnaW5hbFBhdGgiLCJzdGF0aWNBcmNoTGlzdCIsImFyY2hJbmRleCIsImluZGV4T2YiLCJ1bnNoaWZ0Iiwic29tZSIsInN0YXRpY0ZpbGVzIiwiZmluYWxpemUiLCJwYXJzZVBvcnQiLCJwb3J0IiwicGFyc2VkUG9ydCIsInBhcnNlSW50IiwiTnVtYmVyIiwiaXNOYU4iLCJfcmVmIiwicGF1c2VDbGllbnQiLCJfcmVmMiIsImdlbmVyYXRlQ2xpZW50UHJvZ3JhbSIsInJ1bldlYkFwcFNlcnZlciIsInNodXR0aW5nRG93biIsInN5bmNRdWV1ZSIsIl9Bc3luY2hyb25vdXNRdWV1ZSIsImdldEl0ZW1QYXRobmFtZSIsIml0ZW1VcmwiLCJyZWxvYWRDbGllbnRQcm9ncmFtcyIsInJ1blRhc2siLCJjb25maWdKc29uIiwiX19tZXRlb3JfYm9vdHN0cmFwX18iLCJjbGllbnRBcmNocyIsImNsaWVudFBhdGhzIiwic3RhY2siLCJwcm9jZXNzIiwiZXhpdCIsInVucGF1c2UiLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJjbGllbnREaXIiLCJzZXJ2ZXJEaXIiLCJwcm9ncmFtSnNvblBhdGgiLCJwcm9ncmFtSnNvbiIsImNvZGUiLCJmb3JtYXQiLCJpdGVtIiwid2hlcmUiLCJzb3VyY2VNYXAiLCJQVUJMSUNfU0VUVElOR1MiLCJjb25maWdPdmVycmlkZXMiLCJvbGRQcm9ncmFtIiwibmV3UHJvZ3JhbSIsIldlYkFwcEhhc2hpbmciLCJ2ZXJzaW9uUmVmcmVzaGFibGUiLCJ2ZXJzaW9uTm9uUmVmcmVzaGFibGUiLCJyZXBsYWNlYWJsZSIsInZlcnNpb25SZXBsYWNlYWJsZSIsIl90eXBlIiwiY29yZG92YUNvbXBhdGliaWxpdHlWZXJzaW9ucyIsImhtclZlcnNpb24iLCJtYW5pZmVzdFVybFByZWZpeCIsInJlcGxhY2UiLCJtYW5pZmVzdFVybCIsIlBhY2thZ2UiLCJhdXRvdXBkYXRlIiwiQVVUT1VQREFURV9WRVJTSU9OIiwiQXV0b3VwZGF0ZSIsImF1dG91cGRhdGVWZXJzaW9uIiwiZW52IiwiZ2VuZXJhdGVCb2lsZXJwbGF0ZUZvckFyY2giLCJkZWZhdWx0T3B0aW9uc0ZvckFyY2giLCJERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCIsIk1PQklMRV9ERFBfVVJMIiwiYWJzb2x1dGVVcmwiLCJST09UX1VSTCIsIk1PQklMRV9ST09UX1VSTCIsImdlbmVyYXRlQm9pbGVycGxhdGUiLCJyZWZyZXNoYWJsZUFzc2V0cyIsImNzcyIsImZpbGUiLCJyYXdFeHByZXNzSGFuZGxlcnMiLCJ1c2UiLCJpc1ZhbGlkVXJsIiwicmVzcG9uc2UiLCJxdWVyeSIsImdldFBhdGhQYXJ0cyIsInNoaWZ0IiwiaXNQcmVmaXhPZiIsInByZWZpeCIsImFycmF5IiwiZXZlcnkiLCJwYXJ0IiwicGF0aFByZWZpeCIsInNlYXJjaCIsInByZWZpeFBhcnRzIiwibWV0ZW9ySW50ZXJuYWxIYW5kbGVycyIsInBhY2thZ2VBbmRBcHBIYW5kbGVycyIsInN1cHByZXNzRXhwcmVzc0Vycm9ycyIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazUiLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2s2IiwiaXNEZXZlbG9wbWVudCIsIl9yZWYzIiwibmV3SGVhZGVycyIsImNhdGNoIiwiaHR0cFNlcnZlciIsIm9uTGlzdGVuaW5nQ2FsbGJhY2tzIiwic29ja2V0IiwiZGVzdHJveWVkIiwibWVzc2FnZSIsImRlc3Ryb3kiLCJzdXBwcmVzc0Vycm9ycyIsIndhcm5lZEFib3V0Q29ubmVjdFVzYWdlIiwiY29ubmVjdEhhbmRsZXJzIiwiaGFuZGxlcnMiLCJyYXdDb25uZWN0SGFuZGxlcnMiLCJyYXdIYW5kbGVycyIsImV4cHJlc3NBcHAiLCJzdXBwcmVzc0Nvbm5lY3RFcnJvcnMiLCJfZGVidWciLCJfc3VwcHJlc3NFeHByZXNzRXJyb3JzIiwib25MaXN0ZW5pbmciLCJmIiwic3RhcnRMaXN0ZW5pbmciLCJsaXN0ZW5PcHRpb25zIiwibGlzdGVuIiwiZXhwb3J0cyIsIm1haW4iLCJhcmd2Iiwic3RhcnRIdHRwU2VydmVyIiwiYmluZEVudmlyb25tZW50IiwiTUVURU9SX1BSSU5UX09OX0xJU1RFTiIsImNvbnNvbGUiLCJsb2ciLCJjYWxsYmFja3MiLCJsb2NhbFBvcnQiLCJQT1JUIiwidW5peFNvY2tldFBhdGgiLCJVTklYX1NPQ0tFVF9QQVRIIiwiaXNXb3JrZXIiLCJ3b3JrZXJOYW1lIiwid29ya2VyIiwiaWQiLCJ1bml4U29ja2V0UGVybWlzc2lvbnMiLCJVTklYX1NPQ0tFVF9QRVJNSVNTSU9OUyIsInRyaW0iLCJ0ZXN0IiwidW5peFNvY2tldEdyb3VwIiwiVU5JWF9TT0NLRVRfR1JPVVAiLCJ1bml4U29ja2V0R3JvdXBJbmZvIiwic3luYyIsImdyb3VwIiwidWlkIiwiZ2lkIiwiaG9zdCIsIkJJTkRfSVAiLCJzZXRJbmxpbmVTY3JpcHRzQWxsb3dlZCIsImVuYWJsZVN1YnJlc291cmNlSW50ZWdyaXR5IiwidXNlX2NyZWRlbnRpYWxzIiwic2V0QnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2siLCJob29rRm4iLCJzZXRCdW5kbGVkSnNDc3NQcmVmaXgiLCJzZWxmIiwiYWRkU3RhdGljSnMiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJhc3luYyIsInN0YXRTeW5jIiwidW5saW5rU3luYyIsImV4aXN0c1N5bmMiLCJzb2NrZXRQYXRoIiwiaXNTb2NrZXQiLCJldmVudEVtaXR0ZXIiLCJzaWduYWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUEsSUFBSUEsYUFBYTtJQUFDQyxPQUFPLENBQUNDLElBQUksQ0FBQyxzQ0FBc0MsRUFBQztNQUFDQyxPQUFPQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0osYUFBYSxHQUFDSSxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQXRHSCxPQUFPLENBQUNJLE1BQU0sQ0FBQztNQUFDQyxNQUFNLEVBQUNBLENBQUEsS0FBSUEsTUFBTTtNQUFDQyxlQUFlLEVBQUNBLENBQUEsS0FBSUE7SUFBZSxDQUFDLENBQUM7SUFBQyxJQUFJQyxNQUFNO0lBQUNQLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLFFBQVEsRUFBQztNQUFDQyxPQUFPQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0ksTUFBTSxHQUFDSixDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUssWUFBWSxFQUFDQyxTQUFTLEVBQUNDLFNBQVM7SUFBQ1YsT0FBTyxDQUFDQyxJQUFJLENBQUMsSUFBSSxFQUFDO01BQUNPLFlBQVlBLENBQUNMLENBQUMsRUFBQztRQUFDSyxZQUFZLEdBQUNMLENBQUM7TUFBQSxDQUFDO01BQUNNLFNBQVNBLENBQUNOLENBQUMsRUFBQztRQUFDTSxTQUFTLEdBQUNOLENBQUM7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R0FBQXRJLFNBQUEsQ0FBQXhNLE1BQUEsUUFBQXdNLFNBQUEsUUFBQUMsU0FBQSxHQUFBRCxTQUFBLE1BQUdILE9BQU87TUFDakMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQzVHLE9BQU8sQ0FBQ3NQLE1BQU0sSUFBSTtRQUN4REQsWUFBWSxDQUFDaFIsRUFBRSxDQUFDaVIsTUFBTSxFQUFFbFMsTUFBTSxDQUFDdVAsZUFBZSxDQUFDLE1BQU07VUFDbkQsSUFBSXVDLFVBQVUsQ0FBQ0MsVUFBVSxDQUFDLEVBQUU7WUFDMUJGLFVBQVUsQ0FBQ0UsVUFBVSxDQUFDO1VBQ3hCO1FBQ0YsQ0FBQyxDQUFDLENBQUM7TUFDTCxDQUFDLENBQUM7SUFDSixDQUFDO0lBQUNOLHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUFGLElBQUE7RUFBQUksS0FBQTtBQUFBLEciLCJmaWxlIjoiL3BhY2thZ2VzL3dlYmFwcC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IHJlYWRGaWxlU3luYywgY2htb2RTeW5jLCBjaG93blN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBjcmVhdGVTZXJ2ZXIgfSBmcm9tICdodHRwJztcbmltcG9ydCB7IHVzZXJJbmZvIH0gZnJvbSAnb3MnO1xuaW1wb3J0IHsgam9pbiBhcyBwYXRoSm9pbiwgZGlybmFtZSBhcyBwYXRoRGlybmFtZSB9IGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgcGFyc2UgYXMgcGFyc2VVcmwgfSBmcm9tICd1cmwnO1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgZXhwcmVzcyBmcm9tICdleHByZXNzJztcbmltcG9ydCBjb21wcmVzcyBmcm9tICdjb21wcmVzc2lvbic7XG5pbXBvcnQgY29va2llUGFyc2VyIGZyb20gJ2Nvb2tpZS1wYXJzZXInO1xuaW1wb3J0IHFzIGZyb20gJ3FzJztcbmltcG9ydCBwYXJzZVJlcXVlc3QgZnJvbSAncGFyc2V1cmwnO1xuaW1wb3J0IHsgbG9va3VwIGFzIGxvb2t1cFVzZXJBZ2VudCB9IGZyb20gJ3VzZXJhZ2VudCc7XG5pbXBvcnQgeyBpc01vZGVybiB9IGZyb20gJ21ldGVvci9tb2Rlcm4tYnJvd3NlcnMnO1xuaW1wb3J0IHNlbmQgZnJvbSAnc2VuZCc7XG5pbXBvcnQge1xuICByZW1vdmVFeGlzdGluZ1NvY2tldEZpbGUsXG4gIHJlZ2lzdGVyU29ja2V0RmlsZUNsZWFudXAsXG59IGZyb20gJy4vc29ja2V0X2ZpbGUuanMnO1xuaW1wb3J0IGNsdXN0ZXIgZnJvbSAnY2x1c3Rlcic7XG5pbXBvcnQgd2hvbXN0IGZyb20gJ0B2bGFza3kvd2hvbXN0JztcblxudmFyIFNIT1JUX1NPQ0tFVF9USU1FT1VUID0gNSAqIDEwMDA7XG52YXIgTE9OR19TT0NLRVRfVElNRU9VVCA9IDEyMCAqIDEwMDA7XG5cbmNvbnN0IGNyZWF0ZUV4cHJlc3NBcHAgPSAoKSA9PiB7XG4gIGNvbnN0IGFwcCA9IGV4cHJlc3MoKTtcbiAgLy8gU2VjdXJpdHkgYW5kIHBlcmZvcm1hY2UgaGVhZGVyc1xuICAvLyB0aGVzZSBoZWFkZXJzIGNvbWUgZnJvbSB0aGVzZSBkb2NzOiBodHRwczovL2V4cHJlc3Nqcy5jb20vZW4vYXBpLmh0bWwjYXBwLnNldHRpbmdzLnRhYmxlXG4gIGFwcC5zZXQoJ3gtcG93ZXJlZC1ieScsIGZhbHNlKTtcbiAgYXBwLnNldCgnZXRhZycsIGZhbHNlKTtcbiAgcmV0dXJuIGFwcDtcbn1cbmV4cG9ydCBjb25zdCBXZWJBcHAgPSB7fTtcbmV4cG9ydCBjb25zdCBXZWJBcHBJbnRlcm5hbHMgPSB7fTtcblxuY29uc3QgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuXG5XZWJBcHBJbnRlcm5hbHMuTnBtTW9kdWxlcyA9IHtcbiAgZXhwcmVzcyA6IHtcbiAgICB2ZXJzaW9uOiBOcG0ucmVxdWlyZSgnZXhwcmVzcy9wYWNrYWdlLmpzb24nKS52ZXJzaW9uLFxuICAgIG1vZHVsZTogZXhwcmVzcyxcbiAgfVxufTtcblxuLy8gVGhvdWdoIHdlIG1pZ2h0IHByZWZlciB0byB1c2Ugd2ViLmJyb3dzZXIgKG1vZGVybikgYXMgdGhlIGRlZmF1bHRcbi8vIGFyY2hpdGVjdHVyZSwgc2FmZXR5IHJlcXVpcmVzIGEgbW9yZSBjb21wYXRpYmxlIGRlZmF1bHRBcmNoLlxuV2ViQXBwLmRlZmF1bHRBcmNoID0gJ3dlYi5icm93c2VyLmxlZ2FjeSc7XG5cbi8vIFhYWCBtYXBzIGFyY2hzIHRvIG1hbmlmZXN0c1xuV2ViQXBwLmNsaWVudFByb2dyYW1zID0ge307XG5cbi8vIFhYWCBtYXBzIGFyY2hzIHRvIHByb2dyYW0gcGF0aCBvbiBmaWxlc3lzdGVtXG52YXIgYXJjaFBhdGggPSB7fTtcblxudmFyIGJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rID0gZnVuY3Rpb24odXJsKSB7XG4gIHZhciBidW5kbGVkUHJlZml4ID0gX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTF9QQVRIX1BSRUZJWCB8fCAnJztcbiAgcmV0dXJuIGJ1bmRsZWRQcmVmaXggKyB1cmw7XG59O1xuXG52YXIgc2hhMSA9IGZ1bmN0aW9uKGNvbnRlbnRzKSB7XG4gIHZhciBoYXNoID0gY3JlYXRlSGFzaCgnc2hhMScpO1xuICBoYXNoLnVwZGF0ZShjb250ZW50cyk7XG4gIHJldHVybiBoYXNoLmRpZ2VzdCgnaGV4Jyk7XG59O1xuXG5mdW5jdGlvbiBzaG91bGRDb21wcmVzcyhyZXEsIHJlcykge1xuICBpZiAocmVxLmhlYWRlcnNbJ3gtbm8tY29tcHJlc3Npb24nXSkge1xuICAgIC8vIGRvbid0IGNvbXByZXNzIHJlc3BvbnNlcyB3aXRoIHRoaXMgcmVxdWVzdCBoZWFkZXJcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBmYWxsYmFjayB0byBzdGFuZGFyZCBmaWx0ZXIgZnVuY3Rpb25cbiAgcmV0dXJuIGNvbXByZXNzLmZpbHRlcihyZXEsIHJlcyk7XG59XG5cbi8vICNCcm93c2VySWRlbnRpZmljYXRpb25cbi8vXG4vLyBXZSBoYXZlIG11bHRpcGxlIHBsYWNlcyB0aGF0IHdhbnQgdG8gaWRlbnRpZnkgdGhlIGJyb3dzZXI6IHRoZVxuLy8gdW5zdXBwb3J0ZWQgYnJvd3NlciBwYWdlLCB0aGUgYXBwY2FjaGUgcGFja2FnZSwgYW5kLCBldmVudHVhbGx5XG4vLyBkZWxpdmVyaW5nIGJyb3dzZXIgcG9seWZpbGxzIG9ubHkgYXMgbmVlZGVkLlxuLy9cbi8vIFRvIGF2b2lkIGRldGVjdGluZyB0aGUgYnJvd3NlciBpbiBtdWx0aXBsZSBwbGFjZXMgYWQtaG9jLCB3ZSBjcmVhdGUgYVxuLy8gTWV0ZW9yIFwiYnJvd3NlclwiIG9iamVjdC4gSXQgdXNlcyBidXQgZG9lcyBub3QgZXhwb3NlIHRoZSBucG1cbi8vIHVzZXJhZ2VudCBtb2R1bGUgKHdlIGNvdWxkIGNob29zZSBhIGRpZmZlcmVudCBtZWNoYW5pc20gdG8gaWRlbnRpZnlcbi8vIHRoZSBicm93c2VyIGluIHRoZSBmdXR1cmUgaWYgd2Ugd2FudGVkIHRvKS4gIFRoZSBicm93c2VyIG9iamVjdFxuLy8gY29udGFpbnNcbi8vXG4vLyAqIGBuYW1lYDogdGhlIG5hbWUgb2YgdGhlIGJyb3dzZXIgaW4gY2FtZWwgY2FzZVxuLy8gKiBgbWFqb3JgLCBgbWlub3JgLCBgcGF0Y2hgOiBpbnRlZ2VycyBkZXNjcmliaW5nIHRoZSBicm93c2VyIHZlcnNpb25cbi8vXG4vLyBBbHNvIGhlcmUgaXMgYW4gZWFybHkgdmVyc2lvbiBvZiBhIE1ldGVvciBgcmVxdWVzdGAgb2JqZWN0LCBpbnRlbmRlZFxuLy8gdG8gYmUgYSBoaWdoLWxldmVsIGRlc2NyaXB0aW9uIG9mIHRoZSByZXF1ZXN0IHdpdGhvdXQgZXhwb3Npbmdcbi8vIGRldGFpbHMgb2YgRXhwcmVzcydzIGxvdy1sZXZlbCBgcmVxYC4gIEN1cnJlbnRseSBpdCBjb250YWluczpcbi8vXG4vLyAqIGBicm93c2VyYDogYnJvd3NlciBpZGVudGlmaWNhdGlvbiBvYmplY3QgZGVzY3JpYmVkIGFib3ZlXG4vLyAqIGB1cmxgOiBwYXJzZWQgdXJsLCBpbmNsdWRpbmcgcGFyc2VkIHF1ZXJ5IHBhcmFtc1xuLy9cbi8vIEFzIGEgdGVtcG9yYXJ5IGhhY2sgdGhlcmUgaXMgYSBgY2F0ZWdvcml6ZVJlcXVlc3RgIGZ1bmN0aW9uIG9uIFdlYkFwcCB3aGljaFxuLy8gY29udmVydHMgYSBFeHByZXNzIGByZXFgIHRvIGEgTWV0ZW9yIGByZXF1ZXN0YC4gVGhpcyBjYW4gZ28gYXdheSBvbmNlIHNtYXJ0XG4vLyBwYWNrYWdlcyBzdWNoIGFzIGFwcGNhY2hlIGFyZSBiZWluZyBwYXNzZWQgYSBgcmVxdWVzdGAgb2JqZWN0IGRpcmVjdGx5IHdoZW5cbi8vIHRoZXkgc2VydmUgY29udGVudC5cbi8vXG4vLyBUaGlzIGFsbG93cyBgcmVxdWVzdGAgdG8gYmUgdXNlZCB1bmlmb3JtbHk6IGl0IGlzIHBhc3NlZCB0byB0aGUgaHRtbFxuLy8gYXR0cmlidXRlcyBob29rLCBhbmQgdGhlIGFwcGNhY2hlIHBhY2thZ2UgY2FuIHVzZSBpdCB3aGVuIGRlY2lkaW5nXG4vLyB3aGV0aGVyIHRvIGdlbmVyYXRlIGEgNDA0IGZvciB0aGUgbWFuaWZlc3QuXG4vL1xuLy8gUmVhbCByb3V0aW5nIC8gc2VydmVyIHNpZGUgcmVuZGVyaW5nIHdpbGwgcHJvYmFibHkgcmVmYWN0b3IgdGhpc1xuLy8gaGVhdmlseS5cblxuLy8gZS5nLiBcIk1vYmlsZSBTYWZhcmlcIiA9PiBcIm1vYmlsZVNhZmFyaVwiXG52YXIgY2FtZWxDYXNlID0gZnVuY3Rpb24obmFtZSkge1xuICB2YXIgcGFydHMgPSBuYW1lLnNwbGl0KCcgJyk7XG4gIHBhcnRzWzBdID0gcGFydHNbMF0udG9Mb3dlckNhc2UoKTtcbiAgZm9yICh2YXIgaSA9IDE7IGkgPCBwYXJ0cy5sZW5ndGg7ICsraSkge1xuICAgIHBhcnRzW2ldID0gcGFydHNbaV0uY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBwYXJ0c1tpXS5zdWJzdHIoMSk7XG4gIH1cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpO1xufTtcblxudmFyIGlkZW50aWZ5QnJvd3NlciA9IGZ1bmN0aW9uKHVzZXJBZ2VudFN0cmluZykge1xuICB2YXIgdXNlckFnZW50ID0gbG9va3VwVXNlckFnZW50KHVzZXJBZ2VudFN0cmluZyk7XG4gIHJldHVybiB7XG4gICAgbmFtZTogY2FtZWxDYXNlKHVzZXJBZ2VudC5mYW1pbHkpLFxuICAgIG1ham9yOiArdXNlckFnZW50Lm1ham9yLFxuICAgIG1pbm9yOiArdXNlckFnZW50Lm1pbm9yLFxuICAgIHBhdGNoOiArdXNlckFnZW50LnBhdGNoLFxuICB9O1xufTtcblxuLy8gWFhYIFJlZmFjdG9yIGFzIHBhcnQgb2YgaW1wbGVtZW50aW5nIHJlYWwgcm91dGluZy5cbldlYkFwcEludGVybmFscy5pZGVudGlmeUJyb3dzZXIgPSBpZGVudGlmeUJyb3dzZXI7XG5cbldlYkFwcC5jYXRlZ29yaXplUmVxdWVzdCA9IGZ1bmN0aW9uKHJlcSkge1xuICBpZiAocmVxLmJyb3dzZXIgJiYgcmVxLmFyY2ggJiYgdHlwZW9mIHJlcS5tb2Rlcm4gPT09ICdib29sZWFuJykge1xuICAgIC8vIEFscmVhZHkgY2F0ZWdvcml6ZWQuXG4gICAgcmV0dXJuIHJlcTtcbiAgfVxuXG4gIGNvbnN0IGJyb3dzZXIgPSBpZGVudGlmeUJyb3dzZXIocmVxLmhlYWRlcnNbJ3VzZXItYWdlbnQnXSk7XG4gIGNvbnN0IG1vZGVybiA9IGlzTW9kZXJuKGJyb3dzZXIpO1xuICBjb25zdCBwYXRoID1cbiAgICB0eXBlb2YgcmVxLnBhdGhuYW1lID09PSAnc3RyaW5nJ1xuICAgICAgPyByZXEucGF0aG5hbWVcbiAgICAgIDogcGFyc2VSZXF1ZXN0KHJlcSkucGF0aG5hbWU7XG5cbiAgY29uc3QgY2F0ZWdvcml6ZWQgPSB7XG4gICAgYnJvd3NlcixcbiAgICBtb2Rlcm4sXG4gICAgcGF0aCxcbiAgICBhcmNoOiBXZWJBcHAuZGVmYXVsdEFyY2gsXG4gICAgdXJsOiBwYXJzZVVybChyZXEudXJsLCB0cnVlKSxcbiAgICBkeW5hbWljSGVhZDogcmVxLmR5bmFtaWNIZWFkLFxuICAgIGR5bmFtaWNCb2R5OiByZXEuZHluYW1pY0JvZHksXG4gICAgaGVhZGVyczogcmVxLmhlYWRlcnMsXG4gICAgY29va2llczogcmVxLmNvb2tpZXMsXG4gIH07XG5cbiAgY29uc3QgcGF0aFBhcnRzID0gcGF0aC5zcGxpdCgnLycpO1xuICBjb25zdCBhcmNoS2V5ID0gcGF0aFBhcnRzWzFdO1xuXG4gIGlmIChhcmNoS2V5LnN0YXJ0c1dpdGgoJ19fJykpIHtcbiAgICBjb25zdCBhcmNoQ2xlYW5lZCA9ICd3ZWIuJyArIGFyY2hLZXkuc2xpY2UoMik7XG4gICAgaWYgKGhhc093bi5jYWxsKFdlYkFwcC5jbGllbnRQcm9ncmFtcywgYXJjaENsZWFuZWQpKSB7XG4gICAgICBwYXRoUGFydHMuc3BsaWNlKDEsIDEpOyAvLyBSZW1vdmUgdGhlIGFyY2hLZXkgcGFydC5cbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKGNhdGVnb3JpemVkLCB7XG4gICAgICAgIGFyY2g6IGFyY2hDbGVhbmVkLFxuICAgICAgICBwYXRoOiBwYXRoUGFydHMuam9pbignLycpLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLy8gVE9ETyBQZXJoYXBzIG9uZSBkYXkgd2UgY291bGQgaW5mZXIgQ29yZG92YSBjbGllbnRzIGhlcmUsIHNvIHRoYXQgd2VcbiAgLy8gd291bGRuJ3QgaGF2ZSB0byB1c2UgcHJlZml4ZWQgXCIvX19jb3Jkb3ZhLy4uLlwiIFVSTHMuXG4gIGNvbnN0IHByZWZlcnJlZEFyY2hPcmRlciA9IGlzTW9kZXJuKGJyb3dzZXIpXG4gICAgPyBbJ3dlYi5icm93c2VyJywgJ3dlYi5icm93c2VyLmxlZ2FjeSddXG4gICAgOiBbJ3dlYi5icm93c2VyLmxlZ2FjeScsICd3ZWIuYnJvd3NlciddO1xuXG4gIGZvciAoY29uc3QgYXJjaCBvZiBwcmVmZXJyZWRBcmNoT3JkZXIpIHtcbiAgICAvLyBJZiBvdXIgcHJlZmVycmVkIGFyY2ggaXMgbm90IGF2YWlsYWJsZSwgaXQncyBiZXR0ZXIgdG8gdXNlIGFub3RoZXJcbiAgICAvLyBjbGllbnQgYXJjaCB0aGF0IGlzIGF2YWlsYWJsZSB0aGFuIHRvIGd1YXJhbnRlZSB0aGUgc2l0ZSB3b24ndCB3b3JrXG4gICAgLy8gYnkgcmV0dXJuaW5nIGFuIHVua25vd24gYXJjaC4gRm9yIGV4YW1wbGUsIGlmIHdlYi5icm93c2VyLmxlZ2FjeSBpc1xuICAgIC8vIGV4Y2x1ZGVkIHVzaW5nIHRoZSAtLWV4Y2x1ZGUtYXJjaHMgY29tbWFuZC1saW5lIG9wdGlvbiwgbGVnYWN5XG4gICAgLy8gY2xpZW50cyBhcmUgYmV0dGVyIG9mZiByZWNlaXZpbmcgd2ViLmJyb3dzZXIgKHdoaWNoIG1pZ2h0IGFjdHVhbGx5XG4gICAgLy8gd29yaykgdGhhbiByZWNlaXZpbmcgYW4gSFRUUCA0MDQgcmVzcG9uc2UuIElmIG5vbmUgb2YgdGhlIGFyY2hzIGluXG4gICAgLy8gcHJlZmVycmVkQXJjaE9yZGVyIGFyZSBkZWZpbmVkLCBvbmx5IHRoZW4gc2hvdWxkIHdlIHNlbmQgYSA0MDQuXG4gICAgaWYgKGhhc093bi5jYWxsKFdlYkFwcC5jbGllbnRQcm9ncmFtcywgYXJjaCkpIHtcbiAgICAgIHJldHVybiBPYmplY3QuYXNzaWduKGNhdGVnb3JpemVkLCB7IGFyY2ggfSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNhdGVnb3JpemVkO1xufTtcblxuLy8gSFRNTCBhdHRyaWJ1dGUgaG9va3M6IGZ1bmN0aW9ucyB0byBiZSBjYWxsZWQgdG8gZGV0ZXJtaW5lIGFueSBhdHRyaWJ1dGVzIHRvXG4vLyBiZSBhZGRlZCB0byB0aGUgJzxodG1sPicgdGFnLiBFYWNoIGZ1bmN0aW9uIGlzIHBhc3NlZCBhICdyZXF1ZXN0JyBvYmplY3QgKHNlZVxuLy8gI0Jyb3dzZXJJZGVudGlmaWNhdGlvbikgYW5kIHNob3VsZCByZXR1cm4gbnVsbCBvciBvYmplY3QuXG52YXIgaHRtbEF0dHJpYnV0ZUhvb2tzID0gW107XG52YXIgZ2V0SHRtbEF0dHJpYnV0ZXMgPSBmdW5jdGlvbihyZXF1ZXN0KSB7XG4gIHZhciBjb21iaW5lZEF0dHJpYnV0ZXMgPSB7fTtcbiAgXy5lYWNoKGh0bWxBdHRyaWJ1dGVIb29rcyB8fCBbXSwgZnVuY3Rpb24oaG9vaykge1xuICAgIHZhciBhdHRyaWJ1dGVzID0gaG9vayhyZXF1ZXN0KTtcbiAgICBpZiAoYXR0cmlidXRlcyA9PT0gbnVsbCkgcmV0dXJuO1xuICAgIGlmICh0eXBlb2YgYXR0cmlidXRlcyAhPT0gJ29iamVjdCcpXG4gICAgICB0aHJvdyBFcnJvcignSFRNTCBhdHRyaWJ1dGUgaG9vayBtdXN0IHJldHVybiBudWxsIG9yIG9iamVjdCcpO1xuICAgIF8uZXh0ZW5kKGNvbWJpbmVkQXR0cmlidXRlcywgYXR0cmlidXRlcyk7XG4gIH0pO1xuICByZXR1cm4gY29tYmluZWRBdHRyaWJ1dGVzO1xufTtcbldlYkFwcC5hZGRIdG1sQXR0cmlidXRlSG9vayA9IGZ1bmN0aW9uKGhvb2spIHtcbiAgaHRtbEF0dHJpYnV0ZUhvb2tzLnB1c2goaG9vayk7XG59O1xuXG4vLyBTZXJ2ZSBhcHAgSFRNTCBmb3IgdGhpcyBVUkw/XG52YXIgYXBwVXJsID0gZnVuY3Rpb24odXJsKSB7XG4gIGlmICh1cmwgPT09ICcvZmF2aWNvbi5pY28nIHx8IHVybCA9PT0gJy9yb2JvdHMudHh0JykgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIE5PVEU6IGFwcC5tYW5pZmVzdCBpcyBub3QgYSB3ZWIgc3RhbmRhcmQgbGlrZSBmYXZpY29uLmljbyBhbmRcbiAgLy8gcm9ib3RzLnR4dC4gSXQgaXMgYSBmaWxlIG5hbWUgd2UgaGF2ZSBjaG9zZW4gdG8gdXNlIGZvciBIVE1MNVxuICAvLyBhcHBjYWNoZSBVUkxzLiBJdCBpcyBpbmNsdWRlZCBoZXJlIHRvIHByZXZlbnQgdXNpbmcgYW4gYXBwY2FjaGVcbiAgLy8gdGhlbiByZW1vdmluZyBpdCBmcm9tIHBvaXNvbmluZyBhbiBhcHAgcGVybWFuZW50bHkuIEV2ZW50dWFsbHksXG4gIC8vIG9uY2Ugd2UgaGF2ZSBzZXJ2ZXIgc2lkZSByb3V0aW5nLCB0aGlzIHdvbid0IGJlIG5lZWRlZCBhc1xuICAvLyB1bmtub3duIFVSTHMgd2l0aCByZXR1cm4gYSA0MDQgYXV0b21hdGljYWxseS5cbiAgaWYgKHVybCA9PT0gJy9hcHAubWFuaWZlc3QnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gQXZvaWQgc2VydmluZyBhcHAgSFRNTCBmb3IgZGVjbGFyZWQgcm91dGVzIHN1Y2ggYXMgL3NvY2tqcy8uXG4gIGlmIChSb3V0ZVBvbGljeS5jbGFzc2lmeSh1cmwpKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gd2UgY3VycmVudGx5IHJldHVybiBhcHAgSFRNTCBvbiBhbGwgVVJMcyBieSBkZWZhdWx0XG4gIHJldHVybiB0cnVlO1xufTtcblxuLy8gV2UgbmVlZCB0byBjYWxjdWxhdGUgdGhlIGNsaWVudCBoYXNoIGFmdGVyIGFsbCBwYWNrYWdlcyBoYXZlIGxvYWRlZFxuLy8gdG8gZ2l2ZSB0aGVtIGEgY2hhbmNlIHRvIHBvcHVsYXRlIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uXG4vL1xuLy8gQ2FsY3VsYXRpbmcgdGhlIGhhc2ggZHVyaW5nIHN0YXJ0dXAgbWVhbnMgdGhhdCBwYWNrYWdlcyBjYW4gb25seVxuLy8gcG9wdWxhdGUgX19tZXRlb3JfcnVudGltZV9jb25maWdfXyBkdXJpbmcgbG9hZCwgbm90IGR1cmluZyBzdGFydHVwLlxuLy9cbi8vIENhbGN1bGF0aW5nIGluc3RlYWQgaXQgYXQgdGhlIGJlZ2lubmluZyBvZiBtYWluIGFmdGVyIGFsbCBzdGFydHVwXG4vLyBob29rcyBoYWQgcnVuIHdvdWxkIGFsbG93IHBhY2thZ2VzIHRvIGFsc28gcG9wdWxhdGVcbi8vIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18gZHVyaW5nIHN0YXJ0dXAsIGJ1dCB0aGF0J3MgdG9vIGxhdGUgZm9yXG4vLyBhdXRvdXBkYXRlIGJlY2F1c2UgaXQgbmVlZHMgdG8gaGF2ZSB0aGUgY2xpZW50IGhhc2ggYXQgc3RhcnR1cCB0b1xuLy8gaW5zZXJ0IHRoZSBhdXRvIHVwZGF0ZSB2ZXJzaW9uIGl0c2VsZiBpbnRvXG4vLyBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fIHRvIGdldCBpdCB0byB0aGUgY2xpZW50LlxuLy9cbi8vIEFuIGFsdGVybmF0aXZlIHdvdWxkIGJlIHRvIGdpdmUgYXV0b3VwZGF0ZSBhIFwicG9zdC1zdGFydCxcbi8vIHByZS1saXN0ZW5cIiBob29rIHRvIGFsbG93IGl0IHRvIGluc2VydCB0aGUgYXV0byB1cGRhdGUgdmVyc2lvbiBhdFxuLy8gdGhlIHJpZ2h0IG1vbWVudC5cblxuTWV0ZW9yLnN0YXJ0dXAoZnVuY3Rpb24oKSB7XG4gIGZ1bmN0aW9uIGdldHRlcihrZXkpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oYXJjaCkge1xuICAgICAgYXJjaCA9IGFyY2ggfHwgV2ViQXBwLmRlZmF1bHRBcmNoO1xuICAgICAgY29uc3QgcHJvZ3JhbSA9IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXTtcbiAgICAgIGNvbnN0IHZhbHVlID0gcHJvZ3JhbSAmJiBwcm9ncmFtW2tleV07XG4gICAgICAvLyBJZiB0aGlzIGlzIHRoZSBmaXJzdCB0aW1lIHdlIGhhdmUgY2FsY3VsYXRlZCB0aGlzIGhhc2gsXG4gICAgICAvLyBwcm9ncmFtW2tleV0gd2lsbCBiZSBhIHRodW5rIChsYXp5IGZ1bmN0aW9uIHdpdGggbm8gcGFyYW1ldGVycylcbiAgICAgIC8vIHRoYXQgd2Ugc2hvdWxkIGNhbGwgdG8gZG8gdGhlIGFjdHVhbCBjb21wdXRhdGlvbi5cbiAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgPyAocHJvZ3JhbVtrZXldID0gdmFsdWUoKSkgOiB2YWx1ZTtcbiAgICB9O1xuICB9XG5cbiAgV2ViQXBwLmNhbGN1bGF0ZUNsaWVudEhhc2ggPSBXZWJBcHAuY2xpZW50SGFzaCA9IGdldHRlcigndmVyc2lvbicpO1xuICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaFJlZnJlc2hhYmxlID0gZ2V0dGVyKCd2ZXJzaW9uUmVmcmVzaGFibGUnKTtcbiAgV2ViQXBwLmNhbGN1bGF0ZUNsaWVudEhhc2hOb25SZWZyZXNoYWJsZSA9IGdldHRlcigndmVyc2lvbk5vblJlZnJlc2hhYmxlJyk7XG4gIFdlYkFwcC5jYWxjdWxhdGVDbGllbnRIYXNoUmVwbGFjZWFibGUgPSBnZXR0ZXIoJ3ZlcnNpb25SZXBsYWNlYWJsZScpO1xuICBXZWJBcHAuZ2V0UmVmcmVzaGFibGVBc3NldHMgPSBnZXR0ZXIoJ3JlZnJlc2hhYmxlQXNzZXRzJyk7XG59KTtcblxuLy8gV2hlbiB3ZSBoYXZlIGEgcmVxdWVzdCBwZW5kaW5nLCB3ZSB3YW50IHRoZSBzb2NrZXQgdGltZW91dCB0byBiZSBsb25nLCB0b1xuLy8gZ2l2ZSBvdXJzZWx2ZXMgYSB3aGlsZSB0byBzZXJ2ZSBpdCwgYW5kIHRvIGFsbG93IHNvY2tqcyBsb25nIHBvbGxzIHRvXG4vLyBjb21wbGV0ZS4gIE9uIHRoZSBvdGhlciBoYW5kLCB3ZSB3YW50IHRvIGNsb3NlIGlkbGUgc29ja2V0cyByZWxhdGl2ZWx5XG4vLyBxdWlja2x5LCBzbyB0aGF0IHdlIGNhbiBzaHV0IGRvd24gcmVsYXRpdmVseSBwcm9tcHRseSBidXQgY2xlYW5seSwgd2l0aG91dFxuLy8gY3V0dGluZyBvZmYgYW55b25lJ3MgcmVzcG9uc2UuXG5XZWJBcHAuX3RpbWVvdXRBZGp1c3RtZW50UmVxdWVzdENhbGxiYWNrID0gZnVuY3Rpb24ocmVxLCByZXMpIHtcbiAgLy8gdGhpcyBpcyByZWFsbHkganVzdCByZXEuc29ja2V0LnNldFRpbWVvdXQoTE9OR19TT0NLRVRfVElNRU9VVCk7XG4gIHJlcS5zZXRUaW1lb3V0KExPTkdfU09DS0VUX1RJTUVPVVQpO1xuICAvLyBJbnNlcnQgb3VyIG5ldyBmaW5pc2ggbGlzdGVuZXIgdG8gcnVuIEJFRk9SRSB0aGUgZXhpc3Rpbmcgb25lIHdoaWNoIHJlbW92ZXNcbiAgLy8gdGhlIHJlc3BvbnNlIGZyb20gdGhlIHNvY2tldC5cbiAgdmFyIGZpbmlzaExpc3RlbmVycyA9IHJlcy5saXN0ZW5lcnMoJ2ZpbmlzaCcpO1xuICAvLyBYWFggQXBwYXJlbnRseSBpbiBOb2RlIDAuMTIgdGhpcyBldmVudCB3YXMgY2FsbGVkICdwcmVmaW5pc2gnLlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vam95ZW50L25vZGUvY29tbWl0LzdjOWI2MDcwXG4gIC8vIEJ1dCBpdCBoYXMgc3dpdGNoZWQgYmFjayB0byAnZmluaXNoJyBpbiBOb2RlIHY0OlxuICAvLyBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvcHVsbC8xNDExXG4gIHJlcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2ZpbmlzaCcpO1xuICByZXMub24oJ2ZpbmlzaCcsIGZ1bmN0aW9uKCkge1xuICAgIHJlcy5zZXRUaW1lb3V0KFNIT1JUX1NPQ0tFVF9USU1FT1VUKTtcbiAgfSk7XG4gIF8uZWFjaChmaW5pc2hMaXN0ZW5lcnMsIGZ1bmN0aW9uKGwpIHtcbiAgICByZXMub24oJ2ZpbmlzaCcsIGwpO1xuICB9KTtcbn07XG5cbi8vIFdpbGwgYmUgdXBkYXRlZCBieSBtYWluIGJlZm9yZSB3ZSBsaXN0ZW4uXG4vLyBNYXAgZnJvbSBjbGllbnQgYXJjaCB0byBib2lsZXJwbGF0ZSBvYmplY3QuXG4vLyBCb2lsZXJwbGF0ZSBvYmplY3QgaGFzOlxuLy8gICAtIGZ1bmM6IFhYWFxuLy8gICAtIGJhc2VEYXRhOiBYWFhcbnZhciBib2lsZXJwbGF0ZUJ5QXJjaCA9IHt9O1xuXG4vLyBSZWdpc3RlciBhIGNhbGxiYWNrIGZ1bmN0aW9uIHRoYXQgY2FuIHNlbGVjdGl2ZWx5IG1vZGlmeSBib2lsZXJwbGF0ZVxuLy8gZGF0YSBnaXZlbiBhcmd1bWVudHMgKHJlcXVlc3QsIGRhdGEsIGFyY2gpLiBUaGUga2V5IHNob3VsZCBiZSBhIHVuaXF1ZVxuLy8gaWRlbnRpZmllciwgdG8gcHJldmVudCBhY2N1bXVsYXRpbmcgZHVwbGljYXRlIGNhbGxiYWNrcyBmcm9tIHRoZSBzYW1lXG4vLyBjYWxsIHNpdGUgb3ZlciB0aW1lLiBDYWxsYmFja3Mgd2lsbCBiZSBjYWxsZWQgaW4gdGhlIG9yZGVyIHRoZXkgd2VyZVxuLy8gcmVnaXN0ZXJlZC4gQSBjYWxsYmFjayBzaG91bGQgcmV0dXJuIGZhbHNlIGlmIGl0IGRpZCBub3QgbWFrZSBhbnlcbi8vIGNoYW5nZXMgYWZmZWN0aW5nIHRoZSBib2lsZXJwbGF0ZS4gUGFzc2luZyBudWxsIGRlbGV0ZXMgdGhlIGNhbGxiYWNrLlxuLy8gQW55IHByZXZpb3VzIGNhbGxiYWNrIHJlZ2lzdGVyZWQgZm9yIHRoaXMga2V5IHdpbGwgYmUgcmV0dXJuZWQuXG5jb25zdCBib2lsZXJwbGF0ZURhdGFDYWxsYmFja3MgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuV2ViQXBwSW50ZXJuYWxzLnJlZ2lzdGVyQm9pbGVycGxhdGVEYXRhQ2FsbGJhY2sgPSBmdW5jdGlvbihrZXksIGNhbGxiYWNrKSB7XG4gIGNvbnN0IHByZXZpb3VzQ2FsbGJhY2sgPSBib2lsZXJwbGF0ZURhdGFDYWxsYmFja3Nba2V5XTtcblxuICBpZiAodHlwZW9mIGNhbGxiYWNrID09PSAnZnVuY3Rpb24nKSB7XG4gICAgYm9pbGVycGxhdGVEYXRhQ2FsbGJhY2tzW2tleV0gPSBjYWxsYmFjaztcbiAgfSBlbHNlIHtcbiAgICBhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbGJhY2ssIG51bGwpO1xuICAgIGRlbGV0ZSBib2lsZXJwbGF0ZURhdGFDYWxsYmFja3Nba2V5XTtcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgcHJldmlvdXMgY2FsbGJhY2sgaW4gY2FzZSB0aGUgbmV3IGNhbGxiYWNrIG5lZWRzIHRvIGNhbGxcbiAgLy8gaXQ7IGZvciBleGFtcGxlLCB3aGVuIHRoZSBuZXcgY2FsbGJhY2sgaXMgYSB3cmFwcGVyIGZvciB0aGUgb2xkLlxuICByZXR1cm4gcHJldmlvdXNDYWxsYmFjayB8fCBudWxsO1xufTtcblxuLy8gR2l2ZW4gYSByZXF1ZXN0IChhcyByZXR1cm5lZCBmcm9tIGBjYXRlZ29yaXplUmVxdWVzdGApLCByZXR1cm4gdGhlXG4vLyBib2lsZXJwbGF0ZSBIVE1MIHRvIHNlcnZlIGZvciB0aGF0IHJlcXVlc3QuXG4vL1xuLy8gSWYgYSBwcmV2aW91cyBFeHByZXNzIG1pZGRsZXdhcmUgaGFzIHJlbmRlcmVkIGNvbnRlbnQgZm9yIHRoZSBoZWFkIG9yIGJvZHksXG4vLyByZXR1cm5zIHRoZSBib2lsZXJwbGF0ZSB3aXRoIHRoYXQgY29udGVudCBwYXRjaGVkIGluIG90aGVyd2lzZVxuLy8gbWVtb2l6ZXMgb24gSFRNTCBhdHRyaWJ1dGVzICh1c2VkIGJ5LCBlZywgYXBwY2FjaGUpIGFuZCB3aGV0aGVyIGlubGluZVxuLy8gc2NyaXB0cyBhcmUgY3VycmVudGx5IGFsbG93ZWQuXG4vLyBYWFggc28gZmFyIHRoaXMgZnVuY3Rpb24gaXMgYWx3YXlzIGNhbGxlZCB3aXRoIGFyY2ggPT09ICd3ZWIuYnJvd3NlcidcbmZ1bmN0aW9uIGdldEJvaWxlcnBsYXRlKHJlcXVlc3QsIGFyY2gpIHtcbiAgcmV0dXJuIGdldEJvaWxlcnBsYXRlQXN5bmMocmVxdWVzdCwgYXJjaCk7XG59XG5cbi8qKlxuICogQHN1bW1hcnkgVGFrZXMgYSBydW50aW1lIGNvbmZpZ3VyYXRpb24gb2JqZWN0IGFuZFxuICogcmV0dXJucyBhbiBlbmNvZGVkIHJ1bnRpbWUgc3RyaW5nLlxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHtPYmplY3R9IHJ0aW1lQ29uZmlnXG4gKiBAcmV0dXJucyB7U3RyaW5nfVxuICovXG5XZWJBcHAuZW5jb2RlUnVudGltZUNvbmZpZyA9IGZ1bmN0aW9uKHJ0aW1lQ29uZmlnKSB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkocnRpbWVDb25maWcpKSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFRha2VzIGFuIGVuY29kZWQgcnVudGltZSBzdHJpbmcgYW5kIHJldHVybnNcbiAqIGEgcnVudGltZSBjb25maWd1cmF0aW9uIG9iamVjdC5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSBydGltZUNvbmZpZ1N0cmluZ1xuICogQHJldHVybnMge09iamVjdH1cbiAqL1xuV2ViQXBwLmRlY29kZVJ1bnRpbWVDb25maWcgPSBmdW5jdGlvbihydGltZUNvbmZpZ1N0cikge1xuICByZXR1cm4gSlNPTi5wYXJzZShkZWNvZGVVUklDb21wb25lbnQoSlNPTi5wYXJzZShydGltZUNvbmZpZ1N0cikpKTtcbn07XG5cbmNvbnN0IHJ1bnRpbWVDb25maWcgPSB7XG4gIC8vIGhvb2tzIHdpbGwgY29udGFpbiB0aGUgY2FsbGJhY2sgZnVuY3Rpb25zXG4gIC8vIHNldCBieSB0aGUgY2FsbGVyIHRvIGFkZFJ1bnRpbWVDb25maWdIb29rXG4gIGhvb2tzOiBuZXcgSG9vaygpLFxuICAvLyB1cGRhdGVIb29rcyB3aWxsIGNvbnRhaW4gdGhlIGNhbGxiYWNrIGZ1bmN0aW9uc1xuICAvLyBzZXQgYnkgdGhlIGNhbGxlciB0byBhZGRVcGRhdGVkTm90aWZ5SG9va1xuICB1cGRhdGVIb29rczogbmV3IEhvb2soKSxcbiAgLy8gaXNVcGRhdGVkQnlBcmNoIGlzIGFuIG9iamVjdCBjb250YWluaW5nIGZpZWxkcyBmb3IgZWFjaCBhcmNoXG4gIC8vIHRoYXQgdGhpcyBzZXJ2ZXIgc3VwcG9ydHMuXG4gIC8vIC0gRWFjaCBmaWVsZCB3aWxsIGJlIHRydWUgd2hlbiB0aGUgc2VydmVyIHVwZGF0ZXMgdGhlIHJ1bnRpbWVDb25maWcgZm9yIHRoYXQgYXJjaC5cbiAgLy8gLSBXaGVuIHRoZSBob29rIGNhbGxiYWNrIGlzIGNhbGxlZCB0aGUgdXBkYXRlIGZpZWxkIGluIHRoZSBjYWxsYmFjayBvYmplY3Qgd2lsbCBiZVxuICAvLyBzZXQgdG8gaXNVcGRhdGVkQnlBcmNoW2FyY2hdLlxuICAvLyA9IGlzVXBkYXRlZHlCeUFyY2hbYXJjaF0gaXMgcmVzZXQgdG8gZmFsc2UgYWZ0ZXIgdGhlIGNhbGxiYWNrLlxuICAvLyBUaGlzIGVuYWJsZXMgdGhlIGNhbGxlciB0byBjYWNoZSBkYXRhIGVmZmljaWVudGx5IHNvIHRoZXkgZG8gbm90IG5lZWQgdG9cbiAgLy8gZGVjb2RlICYgdXBkYXRlIGRhdGEgb24gZXZlcnkgY2FsbGJhY2sgd2hlbiB0aGUgcnVudGltZUNvbmZpZyBpcyBub3QgY2hhbmdpbmcuXG4gIGlzVXBkYXRlZEJ5QXJjaDoge30sXG59O1xuXG4vKipcbiAqIEBuYW1lIGFkZFJ1bnRpbWVDb25maWdIb29rQ2FsbGJhY2sob3B0aW9ucylcbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBpc3Byb3RvdHlwZSB0cnVlXG4gKiBAc3VtbWFyeSBDYWxsYmFjayBmb3IgYGFkZFJ1bnRpbWVDb25maWdIb29rYC5cbiAqXG4gKiBJZiB0aGUgaGFuZGxlciByZXR1cm5zIGEgX2ZhbHN5XyB2YWx1ZSB0aGUgaG9vayB3aWxsIG5vdFxuICogbW9kaWZ5IHRoZSBydW50aW1lIGNvbmZpZ3VyYXRpb24uXG4gKlxuICogSWYgdGhlIGhhbmRsZXIgcmV0dXJucyBhIF9TdHJpbmdfIHRoZSBob29rIHdpbGwgc3Vic3RpdHV0ZVxuICogdGhlIHN0cmluZyBmb3IgdGhlIGVuY29kZWQgY29uZmlndXJhdGlvbiBzdHJpbmcuXG4gKlxuICogKipXYXJuaW5nOioqIHRoZSBob29rIGRvZXMgbm90IGNoZWNrIHRoZSByZXR1cm4gdmFsdWUgYXQgYWxsIGl0IGlzXG4gKiB0aGUgcmVzcG9uc2liaWxpdHkgb2YgdGhlIGNhbGxlciB0byBnZXQgdGhlIGZvcm1hdHRpbmcgY29ycmVjdCB1c2luZ1xuICogdGhlIGhlbHBlciBmdW5jdGlvbnMuXG4gKlxuICogYGFkZFJ1bnRpbWVDb25maWdIb29rQ2FsbGJhY2tgIHRha2VzIG9ubHkgb25lIGBPYmplY3RgIGFyZ3VtZW50XG4gKiB3aXRoIHRoZSBmb2xsb3dpbmcgZmllbGRzOlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLmFyY2ggVGhlIGFyY2hpdGVjdHVyZSBvZiB0aGUgY2xpZW50XG4gKiByZXF1ZXN0aW5nIGEgbmV3IHJ1bnRpbWUgY29uZmlndXJhdGlvbi4gVGhpcyBjYW4gYmUgb25lIG9mXG4gKiBgd2ViLmJyb3dzZXJgLCBgd2ViLmJyb3dzZXIubGVnYWN5YCBvciBgd2ViLmNvcmRvdmFgLlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMucmVxdWVzdFxuICogQSBOb2RlSnMgW0luY29taW5nTWVzc2FnZV0oaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9odHRwLmh0bWwjaHR0cF9jbGFzc19odHRwX2luY29taW5nbWVzc2FnZSlcbiAqIGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvaHR0cC5odG1sI2h0dHBfY2xhc3NfaHR0cF9pbmNvbWluZ21lc3NhZ2VcbiAqIGBPYmplY3RgIHRoYXQgY2FuIGJlIHVzZWQgdG8gZ2V0IGluZm9ybWF0aW9uIGFib3V0IHRoZSBpbmNvbWluZyByZXF1ZXN0LlxuICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMuZW5jb2RlZEN1cnJlbnRDb25maWcgVGhlIGN1cnJlbnQgY29uZmlndXJhdGlvbiBvYmplY3RcbiAqIGVuY29kZWQgYXMgYSBzdHJpbmcgZm9yIGluY2x1c2lvbiBpbiB0aGUgcm9vdCBodG1sLlxuICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnVwZGF0ZWQgYHRydWVgIGlmIHRoZSBjb25maWcgZm9yIHRoaXMgYXJjaGl0ZWN0dXJlXG4gKiBoYXMgYmVlbiB1cGRhdGVkIHNpbmNlIGxhc3QgY2FsbGVkLCBvdGhlcndpc2UgYGZhbHNlYC4gVGhpcyBmbGFnIGNhbiBiZSB1c2VkXG4gKiB0byBjYWNoZSB0aGUgZGVjb2RpbmcvZW5jb2RpbmcgZm9yIGVhY2ggYXJjaGl0ZWN0dXJlLlxuICovXG5cbi8qKlxuICogQHN1bW1hcnkgSG9vayB0aGF0IGNhbGxzIGJhY2sgd2hlbiB0aGUgbWV0ZW9yIHJ1bnRpbWUgY29uZmlndXJhdGlvbixcbiAqIGBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fYCBpcyBiZWluZyBzZW50IHRvIGFueSBjbGllbnQuXG4gKlxuICogKipyZXR1cm5zKio6IDxzbWFsbD5fT2JqZWN0Xzwvc21hbGw+IGB7IHN0b3A6IGZ1bmN0aW9uLCBjYWxsYmFjazogZnVuY3Rpb24gfWBcbiAqIC0gYHN0b3BgIDxzbWFsbD5fRnVuY3Rpb25fPC9zbWFsbD4gQ2FsbCBgc3RvcCgpYCB0byBzdG9wIGdldHRpbmcgY2FsbGJhY2tzLlxuICogLSBgY2FsbGJhY2tgIDxzbWFsbD5fRnVuY3Rpb25fPC9zbWFsbD4gVGhlIHBhc3NlZCBpbiBgY2FsbGJhY2tgLlxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHthZGRSdW50aW1lQ29uZmlnSG9va0NhbGxiYWNrfSBjYWxsYmFja1xuICogU2VlIGBhZGRSdW50aW1lQ29uZmlnSG9va0NhbGxiYWNrYCBkZXNjcmlwdGlvbi5cbiAqIEByZXR1cm5zIHtPYmplY3R9IHt7IHN0b3A6IGZ1bmN0aW9uLCBjYWxsYmFjazogZnVuY3Rpb24gfX1cbiAqIENhbGwgdGhlIHJldHVybmVkIGBzdG9wKClgIHRvIHN0b3AgZ2V0dGluZyBjYWxsYmFja3MuXG4gKiBUaGUgcGFzc2VkIGluIGBjYWxsYmFja2AgaXMgcmV0dXJuZWQgYWxzby5cbiAqL1xuV2ViQXBwLmFkZFJ1bnRpbWVDb25maWdIb29rID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgcmV0dXJuIHJ1bnRpbWVDb25maWcuaG9va3MucmVnaXN0ZXIoY2FsbGJhY2spO1xufTtcblxuZnVuY3Rpb24gZ2V0Qm9pbGVycGxhdGVBc3luYyhyZXF1ZXN0LCBhcmNoKSB7XG4gIGxldCBib2lsZXJwbGF0ZSA9IGJvaWxlcnBsYXRlQnlBcmNoW2FyY2hdO1xuICBydW50aW1lQ29uZmlnLmhvb2tzLmZvckVhY2goaG9vayA9PiB7XG4gICAgY29uc3QgbWV0ZW9yUnVudGltZUNvbmZpZyA9IGhvb2soe1xuICAgICAgYXJjaCxcbiAgICAgIHJlcXVlc3QsXG4gICAgICBlbmNvZGVkQ3VycmVudENvbmZpZzogYm9pbGVycGxhdGUuYmFzZURhdGEubWV0ZW9yUnVudGltZUNvbmZpZyxcbiAgICAgIHVwZGF0ZWQ6IHJ1bnRpbWVDb25maWcuaXNVcGRhdGVkQnlBcmNoW2FyY2hdLFxuICAgIH0pO1xuICAgIGlmICghbWV0ZW9yUnVudGltZUNvbmZpZykgcmV0dXJuIHRydWU7XG4gICAgYm9pbGVycGxhdGUuYmFzZURhdGEgPSBPYmplY3QuYXNzaWduKHt9LCBib2lsZXJwbGF0ZS5iYXNlRGF0YSwge1xuICAgICAgbWV0ZW9yUnVudGltZUNvbmZpZyxcbiAgICB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG4gIHJ1bnRpbWVDb25maWcuaXNVcGRhdGVkQnlBcmNoW2FyY2hdID0gZmFsc2U7XG4gIGNvbnN0IGRhdGEgPSBPYmplY3QuYXNzaWduKFxuICAgIHt9LFxuICAgIGJvaWxlcnBsYXRlLmJhc2VEYXRhLFxuICAgIHtcbiAgICAgIGh0bWxBdHRyaWJ1dGVzOiBnZXRIdG1sQXR0cmlidXRlcyhyZXF1ZXN0KSxcbiAgICB9LFxuICAgIF8ucGljayhyZXF1ZXN0LCAnZHluYW1pY0hlYWQnLCAnZHluYW1pY0JvZHknKVxuICApO1xuXG4gIGxldCBtYWRlQ2hhbmdlcyA9IGZhbHNlO1xuICBsZXQgcHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuXG4gIE9iamVjdC5rZXlzKGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrcykuZm9yRWFjaChrZXkgPT4ge1xuICAgIHByb21pc2UgPSBwcm9taXNlXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIGNvbnN0IGNhbGxiYWNrID0gYm9pbGVycGxhdGVEYXRhQ2FsbGJhY2tzW2tleV07XG4gICAgICAgIHJldHVybiBjYWxsYmFjayhyZXF1ZXN0LCBkYXRhLCBhcmNoKTtcbiAgICAgIH0pXG4gICAgICAudGhlbihyZXN1bHQgPT4ge1xuICAgICAgICAvLyBDYWxsYmFja3Mgc2hvdWxkIHJldHVybiBmYWxzZSBpZiB0aGV5IGRpZCBub3QgbWFrZSBhbnkgY2hhbmdlcy5cbiAgICAgICAgaWYgKHJlc3VsdCAhPT0gZmFsc2UpIHtcbiAgICAgICAgICBtYWRlQ2hhbmdlcyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9KTtcblxuICByZXR1cm4gcHJvbWlzZS50aGVuKCgpID0+ICh7XG4gICAgc3RyZWFtOiBib2lsZXJwbGF0ZS50b0hUTUxTdHJlYW0oZGF0YSksXG4gICAgc3RhdHVzQ29kZTogZGF0YS5zdGF0dXNDb2RlLFxuICAgIGhlYWRlcnM6IGRhdGEuaGVhZGVycyxcbiAgfSkpO1xufVxuXG4vKipcbiAqIEBuYW1lIGFkZFVwZGF0ZWROb3RpZnlIb29rQ2FsbGJhY2sob3B0aW9ucylcbiAqIEBzdW1tYXJ5IGNhbGxiYWNrIGhhbmRsZXIgZm9yIGBhZGR1cGRhdGVkTm90aWZ5SG9va2BcbiAqIEBpc3Byb3RvdHlwZSB0cnVlXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMuYXJjaCBUaGUgYXJjaGl0ZWN0dXJlIHRoYXQgaXMgYmVpbmcgdXBkYXRlZC5cbiAqIFRoaXMgY2FuIGJlIG9uZSBvZiBgd2ViLmJyb3dzZXJgLCBgd2ViLmJyb3dzZXIubGVnYWN5YCBvciBgd2ViLmNvcmRvdmFgLlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMubWFuaWZlc3QgVGhlIG5ldyB1cGRhdGVkIG1hbmlmZXN0IG9iamVjdCBmb3JcbiAqIHRoaXMgYGFyY2hgLlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMucnVudGltZUNvbmZpZyBUaGUgbmV3IHVwZGF0ZWQgY29uZmlndXJhdGlvblxuICogb2JqZWN0IGZvciB0aGlzIGBhcmNoYC5cbiAqL1xuXG4vKipcbiAqIEBzdW1tYXJ5IEhvb2sgdGhhdCBydW5zIHdoZW4gdGhlIG1ldGVvciBydW50aW1lIGNvbmZpZ3VyYXRpb25cbiAqIGlzIHVwZGF0ZWQuICBUeXBpY2FsbHkgdGhlIGNvbmZpZ3VyYXRpb24gb25seSBjaGFuZ2VzIGR1cmluZyBkZXZlbG9wbWVudCBtb2RlLlxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHthZGRVcGRhdGVkTm90aWZ5SG9va0NhbGxiYWNrfSBoYW5kbGVyXG4gKiBUaGUgYGhhbmRsZXJgIGlzIGNhbGxlZCBvbiBldmVyeSBjaGFuZ2UgdG8gYW4gYGFyY2hgIHJ1bnRpbWUgY29uZmlndXJhdGlvbi5cbiAqIFNlZSBgYWRkVXBkYXRlZE5vdGlmeUhvb2tDYWxsYmFja2AuXG4gKiBAcmV0dXJucyB7T2JqZWN0fSB7eyBzdG9wOiBmdW5jdGlvbiwgY2FsbGJhY2s6IGZ1bmN0aW9uIH19XG4gKi9cbldlYkFwcC5hZGRVcGRhdGVkTm90aWZ5SG9vayA9IGZ1bmN0aW9uKGhhbmRsZXIpIHtcbiAgcmV0dXJuIHJ1bnRpbWVDb25maWcudXBkYXRlSG9va3MucmVnaXN0ZXIoaGFuZGxlcik7XG59O1xuXG5XZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVCb2lsZXJwbGF0ZUluc3RhbmNlID0gZnVuY3Rpb24oXG4gIGFyY2gsXG4gIG1hbmlmZXN0LFxuICBhZGRpdGlvbmFsT3B0aW9uc1xuKSB7XG4gIGFkZGl0aW9uYWxPcHRpb25zID0gYWRkaXRpb25hbE9wdGlvbnMgfHwge307XG5cbiAgcnVudGltZUNvbmZpZy5pc1VwZGF0ZWRCeUFyY2hbYXJjaF0gPSB0cnVlO1xuICBjb25zdCBydGltZUNvbmZpZyA9IHtcbiAgICAuLi5fX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLFxuICAgIC4uLihhZGRpdGlvbmFsT3B0aW9ucy5ydW50aW1lQ29uZmlnT3ZlcnJpZGVzIHx8IHt9KSxcbiAgfTtcbiAgcnVudGltZUNvbmZpZy51cGRhdGVIb29rcy5mb3JFYWNoKGNiID0+IHtcbiAgICBjYih7IGFyY2gsIG1hbmlmZXN0LCBydW50aW1lQ29uZmlnOiBydGltZUNvbmZpZyB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSk7XG5cbiAgY29uc3QgbWV0ZW9yUnVudGltZUNvbmZpZyA9IEpTT04uc3RyaW5naWZ5KFxuICAgIGVuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShydGltZUNvbmZpZykpXG4gICk7XG5cbiAgcmV0dXJuIG5ldyBCb2lsZXJwbGF0ZShcbiAgICBhcmNoLFxuICAgIG1hbmlmZXN0LFxuICAgIE9iamVjdC5hc3NpZ24oXG4gICAgICB7XG4gICAgICAgIHBhdGhNYXBwZXIoaXRlbVBhdGgpIHtcbiAgICAgICAgICByZXR1cm4gcGF0aEpvaW4oYXJjaFBhdGhbYXJjaF0sIGl0ZW1QYXRoKTtcbiAgICAgICAgfSxcbiAgICAgICAgYmFzZURhdGFFeHRlbnNpb246IHtcbiAgICAgICAgICBhZGRpdGlvbmFsU3RhdGljSnM6IF8ubWFwKGFkZGl0aW9uYWxTdGF0aWNKcyB8fCBbXSwgZnVuY3Rpb24oXG4gICAgICAgICAgICBjb250ZW50cyxcbiAgICAgICAgICAgIHBhdGhuYW1lXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBwYXRobmFtZTogcGF0aG5hbWUsXG4gICAgICAgICAgICAgIGNvbnRlbnRzOiBjb250ZW50cyxcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSksXG4gICAgICAgICAgLy8gQ29udmVydCB0byBhIEpTT04gc3RyaW5nLCB0aGVuIGdldCByaWQgb2YgbW9zdCB3ZWlyZCBjaGFyYWN0ZXJzLCB0aGVuXG4gICAgICAgICAgLy8gd3JhcCBpbiBkb3VibGUgcXVvdGVzLiAoVGhlIG91dGVybW9zdCBKU09OLnN0cmluZ2lmeSByZWFsbHkgb3VnaHQgdG9cbiAgICAgICAgICAvLyBqdXN0IGJlIFwid3JhcCBpbiBkb3VibGUgcXVvdGVzXCIgYnV0IHdlIHVzZSBpdCB0byBiZSBzYWZlLikgVGhpcyBtaWdodFxuICAgICAgICAgIC8vIGVuZCB1cCBpbnNpZGUgYSA8c2NyaXB0PiB0YWcgc28gd2UgbmVlZCB0byBiZSBjYXJlZnVsIHRvIG5vdCBpbmNsdWRlXG4gICAgICAgICAgLy8gXCI8L3NjcmlwdD5cIiwgYnV0IG5vcm1hbCB7e3NwYWNlYmFyc319IGVzY2FwaW5nIGVzY2FwZXMgdG9vIG11Y2ghIFNlZVxuICAgICAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy8zNzMwXG4gICAgICAgICAgbWV0ZW9yUnVudGltZUNvbmZpZyxcbiAgICAgICAgICBtZXRlb3JSdW50aW1lSGFzaDogc2hhMShtZXRlb3JSdW50aW1lQ29uZmlnKSxcbiAgICAgICAgICByb290VXJsUGF0aFByZWZpeDpcbiAgICAgICAgICAgIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVggfHwgJycsXG4gICAgICAgICAgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2s6IGJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rLFxuICAgICAgICAgIHNyaU1vZGU6IHNyaU1vZGUsXG4gICAgICAgICAgaW5saW5lU2NyaXB0c0FsbG93ZWQ6IFdlYkFwcEludGVybmFscy5pbmxpbmVTY3JpcHRzQWxsb3dlZCgpLFxuICAgICAgICAgIGlubGluZTogYWRkaXRpb25hbE9wdGlvbnMuaW5saW5lLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGFkZGl0aW9uYWxPcHRpb25zXG4gICAgKVxuICApO1xufTtcblxuLy8gQSBtYXBwaW5nIGZyb20gdXJsIHBhdGggdG8gYXJjaGl0ZWN0dXJlIChlLmcuIFwid2ViLmJyb3dzZXJcIikgdG8gc3RhdGljXG4vLyBmaWxlIGluZm9ybWF0aW9uIHdpdGggdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4vLyAtIHR5cGU6IHRoZSB0eXBlIG9mIGZpbGUgdG8gYmUgc2VydmVkXG4vLyAtIGNhY2hlYWJsZTogb3B0aW9uYWxseSwgd2hldGhlciB0aGUgZmlsZSBzaG91bGQgYmUgY2FjaGVkIG9yIG5vdFxuLy8gLSBzb3VyY2VNYXBVcmw6IG9wdGlvbmFsbHksIHRoZSB1cmwgb2YgdGhlIHNvdXJjZSBtYXBcbi8vXG4vLyBJbmZvIGFsc28gY29udGFpbnMgb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4vLyAtIGNvbnRlbnQ6IHRoZSBzdHJpbmdpZmllZCBjb250ZW50IHRoYXQgc2hvdWxkIGJlIHNlcnZlZCBhdCB0aGlzIHBhdGhcbi8vIC0gYWJzb2x1dGVQYXRoOiB0aGUgYWJzb2x1dGUgcGF0aCBvbiBkaXNrIHRvIHRoZSBmaWxlXG5cbi8vIFNlcnZlIHN0YXRpYyBmaWxlcyBmcm9tIHRoZSBtYW5pZmVzdCBvciBhZGRlZCB3aXRoXG4vLyBgYWRkU3RhdGljSnNgLiBFeHBvcnRlZCBmb3IgdGVzdHMuXG5XZWJBcHBJbnRlcm5hbHMuc3RhdGljRmlsZXNNaWRkbGV3YXJlID0gYXN5bmMgZnVuY3Rpb24oXG4gIHN0YXRpY0ZpbGVzQnlBcmNoLFxuICByZXEsXG4gIHJlcyxcbiAgbmV4dFxuKSB7XG4gIHZhciBwYXRobmFtZSA9IHBhcnNlUmVxdWVzdChyZXEpLnBhdGhuYW1lO1xuICB0cnkge1xuICAgIHBhdGhuYW1lID0gZGVjb2RlVVJJQ29tcG9uZW50KHBhdGhuYW1lKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIG5leHQoKTtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgc2VydmVTdGF0aWNKcyA9IGZ1bmN0aW9uKHMpIHtcbiAgICBpZiAoXG4gICAgICByZXEubWV0aG9kID09PSAnR0VUJyB8fFxuICAgICAgcmVxLm1ldGhvZCA9PT0gJ0hFQUQnIHx8XG4gICAgICBNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXM/LndlYmFwcD8uYWx3YXlzUmV0dXJuQ29udGVudFxuICAgICkge1xuICAgICAgcmVzLndyaXRlSGVhZCgyMDAsIHtcbiAgICAgICAgJ0NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0OyBjaGFyc2V0PVVURi04JyxcbiAgICAgICAgJ0NvbnRlbnQtTGVuZ3RoJzogQnVmZmVyLmJ5dGVMZW5ndGgocyksXG4gICAgICB9KTtcbiAgICAgIHJlcy53cml0ZShzKTtcbiAgICAgIHJlcy5lbmQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3Qgc3RhdHVzID0gcmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnID8gMjAwIDogNDA1O1xuICAgICAgcmVzLndyaXRlSGVhZChzdGF0dXMsIHtcbiAgICAgICAgQWxsb3c6ICdPUFRJT05TLCBHRVQsIEhFQUQnLFxuICAgICAgICAnQ29udGVudC1MZW5ndGgnOiAnMCcsXG4gICAgICB9KTtcbiAgICAgIHJlcy5lbmQoKTtcbiAgICB9XG4gIH07XG5cbiAgaWYgKFxuICAgIF8uaGFzKGFkZGl0aW9uYWxTdGF0aWNKcywgcGF0aG5hbWUpICYmXG4gICAgIVdlYkFwcEludGVybmFscy5pbmxpbmVTY3JpcHRzQWxsb3dlZCgpXG4gICkge1xuICAgIHNlcnZlU3RhdGljSnMoYWRkaXRpb25hbFN0YXRpY0pzW3BhdGhuYW1lXSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgeyBhcmNoLCBwYXRoIH0gPSBXZWJBcHAuY2F0ZWdvcml6ZVJlcXVlc3QocmVxKTtcblxuICBpZiAoIWhhc093bi5jYWxsKFdlYkFwcC5jbGllbnRQcm9ncmFtcywgYXJjaCkpIHtcbiAgICAvLyBXZSBjb3VsZCBjb21lIGhlcmUgaW4gY2FzZSB3ZSBydW4gd2l0aCBzb21lIGFyY2hpdGVjdHVyZXMgZXhjbHVkZWRcbiAgICBuZXh0KCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gSWYgcGF1c2VDbGllbnQoYXJjaCkgaGFzIGJlZW4gY2FsbGVkLCBwcm9ncmFtLnBhdXNlZCB3aWxsIGJlIGFcbiAgLy8gUHJvbWlzZSB0aGF0IHdpbGwgYmUgcmVzb2x2ZWQgd2hlbiB0aGUgcHJvZ3JhbSBpcyB1bnBhdXNlZC5cbiAgY29uc3QgcHJvZ3JhbSA9IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXTtcbiAgYXdhaXQgcHJvZ3JhbS5wYXVzZWQ7XG5cbiAgaWYgKFxuICAgIHBhdGggPT09ICcvbWV0ZW9yX3J1bnRpbWVfY29uZmlnLmpzJyAmJlxuICAgICFXZWJBcHBJbnRlcm5hbHMuaW5saW5lU2NyaXB0c0FsbG93ZWQoKVxuICApIHtcbiAgICBzZXJ2ZVN0YXRpY0pzKFxuICAgICAgYF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18gPSAke3Byb2dyYW0ubWV0ZW9yUnVudGltZUNvbmZpZ307YFxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgaW5mbyA9IGdldFN0YXRpY0ZpbGVJbmZvKHN0YXRpY0ZpbGVzQnlBcmNoLCBwYXRobmFtZSwgcGF0aCwgYXJjaCk7XG4gIGlmICghaW5mbykge1xuICAgIG5leHQoKTtcbiAgICByZXR1cm47XG4gIH1cbiAgLy8gXCJzZW5kXCIgd2lsbCBoYW5kbGUgSEVBRCAmIEdFVCByZXF1ZXN0c1xuICBpZiAoXG4gICAgcmVxLm1ldGhvZCAhPT0gJ0hFQUQnICYmXG4gICAgcmVxLm1ldGhvZCAhPT0gJ0dFVCcgJiZcbiAgICAhTWV0ZW9yLnNldHRpbmdzLnBhY2thZ2VzPy53ZWJhcHA/LmFsd2F5c1JldHVybkNvbnRlbnRcbiAgKSB7XG4gICAgY29uc3Qgc3RhdHVzID0gcmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnID8gMjAwIDogNDA1O1xuICAgIHJlcy53cml0ZUhlYWQoc3RhdHVzLCB7XG4gICAgICBBbGxvdzogJ09QVElPTlMsIEdFVCwgSEVBRCcsXG4gICAgICAnQ29udGVudC1MZW5ndGgnOiAnMCcsXG4gICAgfSk7XG4gICAgcmVzLmVuZCgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIFdlIGRvbid0IG5lZWQgdG8gY2FsbCBwYXVzZSBiZWNhdXNlLCB1bmxpa2UgJ3N0YXRpYycsIG9uY2Ugd2UgY2FsbCBpbnRvXG4gIC8vICdzZW5kJyBhbmQgeWllbGQgdG8gdGhlIGV2ZW50IGxvb3AsIHdlIG5ldmVyIGNhbGwgYW5vdGhlciBoYW5kbGVyIHdpdGhcbiAgLy8gJ25leHQnLlxuXG4gIC8vIENhY2hlYWJsZSBmaWxlcyBhcmUgZmlsZXMgdGhhdCBzaG91bGQgbmV2ZXIgY2hhbmdlLiBUeXBpY2FsbHlcbiAgLy8gbmFtZWQgYnkgdGhlaXIgaGFzaCAoZWcgbWV0ZW9yIGJ1bmRsZWQganMgYW5kIGNzcyBmaWxlcykuXG4gIC8vIFdlIGNhY2hlIHRoZW0gfmZvcmV2ZXIgKDF5cikuXG4gIGNvbnN0IG1heEFnZSA9IGluZm8uY2FjaGVhYmxlID8gMTAwMCAqIDYwICogNjAgKiAyNCAqIDM2NSA6IDA7XG5cbiAgaWYgKGluZm8uY2FjaGVhYmxlKSB7XG4gICAgLy8gU2luY2Ugd2UgdXNlIHJlcS5oZWFkZXJzW1widXNlci1hZ2VudFwiXSB0byBkZXRlcm1pbmUgd2hldGhlciB0aGVcbiAgICAvLyBjbGllbnQgc2hvdWxkIHJlY2VpdmUgbW9kZXJuIG9yIGxlZ2FjeSByZXNvdXJjZXMsIHRlbGwgdGhlIGNsaWVudFxuICAgIC8vIHRvIGludmFsaWRhdGUgY2FjaGVkIHJlc291cmNlcyB3aGVuL2lmIGl0cyB1c2VyIGFnZW50IHN0cmluZ1xuICAgIC8vIGNoYW5nZXMgaW4gdGhlIGZ1dHVyZS5cbiAgICByZXMuc2V0SGVhZGVyKCdWYXJ5JywgJ1VzZXItQWdlbnQnKTtcbiAgfVxuXG4gIC8vIFNldCB0aGUgWC1Tb3VyY2VNYXAgaGVhZGVyLCB3aGljaCBjdXJyZW50IENocm9tZSwgRmlyZUZveCwgYW5kIFNhZmFyaVxuICAvLyB1bmRlcnN0YW5kLiAgKFRoZSBTb3VyY2VNYXAgaGVhZGVyIGlzIHNsaWdodGx5IG1vcmUgc3BlYy1jb3JyZWN0IGJ1dCBGRlxuICAvLyBkb2Vzbid0IHVuZGVyc3RhbmQgaXQuKVxuICAvL1xuICAvLyBZb3UgbWF5IGFsc28gbmVlZCB0byBlbmFibGUgc291cmNlIG1hcHMgaW4gQ2hyb21lOiBvcGVuIGRldiB0b29scywgY2xpY2tcbiAgLy8gdGhlIGdlYXIgaW4gdGhlIGJvdHRvbSByaWdodCBjb3JuZXIsIGFuZCBzZWxlY3QgXCJlbmFibGUgc291cmNlIG1hcHNcIi5cbiAgaWYgKGluZm8uc291cmNlTWFwVXJsKSB7XG4gICAgcmVzLnNldEhlYWRlcihcbiAgICAgICdYLVNvdXJjZU1hcCcsXG4gICAgICBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMX1BBVEhfUFJFRklYICsgaW5mby5zb3VyY2VNYXBVcmxcbiAgICApO1xuICB9XG5cbiAgaWYgKGluZm8udHlwZSA9PT0gJ2pzJyB8fCBpbmZvLnR5cGUgPT09ICdkeW5hbWljIGpzJykge1xuICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0OyBjaGFyc2V0PVVURi04Jyk7XG4gIH0gZWxzZSBpZiAoaW5mby50eXBlID09PSAnY3NzJykge1xuICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICd0ZXh0L2NzczsgY2hhcnNldD1VVEYtOCcpO1xuICB9IGVsc2UgaWYgKGluZm8udHlwZSA9PT0gJ2pzb24nKSB7XG4gICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9VVRGLTgnKTtcbiAgfVxuXG4gIGlmIChpbmZvLmhhc2gpIHtcbiAgICByZXMuc2V0SGVhZGVyKCdFVGFnJywgJ1wiJyArIGluZm8uaGFzaCArICdcIicpO1xuICB9XG5cbiAgaWYgKGluZm8uY29udGVudCkge1xuICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtTGVuZ3RoJywgQnVmZmVyLmJ5dGVMZW5ndGgoaW5mby5jb250ZW50KSk7XG4gICAgcmVzLndyaXRlKGluZm8uY29udGVudCk7XG4gICAgcmVzLmVuZCgpO1xuICB9IGVsc2Uge1xuICAgIHNlbmQocmVxLCBpbmZvLmFic29sdXRlUGF0aCwge1xuICAgICAgbWF4YWdlOiBtYXhBZ2UsXG4gICAgICBkb3RmaWxlczogJ2FsbG93JywgLy8gaWYgd2Ugc3BlY2lmaWVkIGEgZG90ZmlsZSBpbiB0aGUgbWFuaWZlc3QsIHNlcnZlIGl0XG4gICAgICBsYXN0TW9kaWZpZWQ6IGZhbHNlLCAvLyBkb24ndCBzZXQgbGFzdC1tb2RpZmllZCBiYXNlZCBvbiB0aGUgZmlsZSBkYXRlXG4gICAgfSlcbiAgICAgIC5vbignZXJyb3InLCBmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgTG9nLmVycm9yKCdFcnJvciBzZXJ2aW5nIHN0YXRpYyBmaWxlICcgKyBlcnIpO1xuICAgICAgICByZXMud3JpdGVIZWFkKDUwMCk7XG4gICAgICAgIHJlcy5lbmQoKTtcbiAgICAgIH0pXG4gICAgICAub24oJ2RpcmVjdG9yeScsIGZ1bmN0aW9uKCkge1xuICAgICAgICBMb2cuZXJyb3IoJ1VuZXhwZWN0ZWQgZGlyZWN0b3J5ICcgKyBpbmZvLmFic29sdXRlUGF0aCk7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoNTAwKTtcbiAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgfSlcbiAgICAgIC5waXBlKHJlcyk7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGdldFN0YXRpY0ZpbGVJbmZvKHN0YXRpY0ZpbGVzQnlBcmNoLCBvcmlnaW5hbFBhdGgsIHBhdGgsIGFyY2gpIHtcbiAgaWYgKCFoYXNPd24uY2FsbChXZWJBcHAuY2xpZW50UHJvZ3JhbXMsIGFyY2gpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBHZXQgYSBsaXN0IG9mIGFsbCBhdmFpbGFibGUgc3RhdGljIGZpbGUgYXJjaGl0ZWN0dXJlcywgd2l0aCBhcmNoXG4gIC8vIGZpcnN0IGluIHRoZSBsaXN0IGlmIGl0IGV4aXN0cy5cbiAgY29uc3Qgc3RhdGljQXJjaExpc3QgPSBPYmplY3Qua2V5cyhzdGF0aWNGaWxlc0J5QXJjaCk7XG4gIGNvbnN0IGFyY2hJbmRleCA9IHN0YXRpY0FyY2hMaXN0LmluZGV4T2YoYXJjaCk7XG4gIGlmIChhcmNoSW5kZXggPiAwKSB7XG4gICAgc3RhdGljQXJjaExpc3QudW5zaGlmdChzdGF0aWNBcmNoTGlzdC5zcGxpY2UoYXJjaEluZGV4LCAxKVswXSk7XG4gIH1cblxuICBsZXQgaW5mbyA9IG51bGw7XG5cbiAgc3RhdGljQXJjaExpc3Quc29tZShhcmNoID0+IHtcbiAgICBjb25zdCBzdGF0aWNGaWxlcyA9IHN0YXRpY0ZpbGVzQnlBcmNoW2FyY2hdO1xuXG4gICAgZnVuY3Rpb24gZmluYWxpemUocGF0aCkge1xuICAgICAgaW5mbyA9IHN0YXRpY0ZpbGVzW3BhdGhdO1xuICAgICAgLy8gU29tZXRpbWVzIHdlIHJlZ2lzdGVyIGEgbGF6eSBmdW5jdGlvbiBpbnN0ZWFkIG9mIGFjdHVhbCBkYXRhIGluXG4gICAgICAvLyB0aGUgc3RhdGljRmlsZXMgbWFuaWZlc3QuXG4gICAgICBpZiAodHlwZW9mIGluZm8gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgaW5mbyA9IHN0YXRpY0ZpbGVzW3BhdGhdID0gaW5mbygpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGluZm87XG4gICAgfVxuXG4gICAgLy8gSWYgc3RhdGljRmlsZXMgY29udGFpbnMgb3JpZ2luYWxQYXRoIHdpdGggdGhlIGFyY2ggaW5mZXJyZWQgYWJvdmUsXG4gICAgLy8gdXNlIHRoYXQgaW5mb3JtYXRpb24uXG4gICAgaWYgKGhhc093bi5jYWxsKHN0YXRpY0ZpbGVzLCBvcmlnaW5hbFBhdGgpKSB7XG4gICAgICByZXR1cm4gZmluYWxpemUob3JpZ2luYWxQYXRoKTtcbiAgICB9XG5cbiAgICAvLyBJZiBjYXRlZ29yaXplUmVxdWVzdCByZXR1cm5lZCBhbiBhbHRlcm5hdGUgcGF0aCwgdHJ5IHRoYXQgaW5zdGVhZC5cbiAgICBpZiAocGF0aCAhPT0gb3JpZ2luYWxQYXRoICYmIGhhc093bi5jYWxsKHN0YXRpY0ZpbGVzLCBwYXRoKSkge1xuICAgICAgcmV0dXJuIGZpbmFsaXplKHBhdGgpO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGluZm87XG59XG5cbi8vIFBhcnNlIHRoZSBwYXNzZWQgaW4gcG9ydCB2YWx1ZS4gUmV0dXJuIHRoZSBwb3J0IGFzLWlzIGlmIGl0J3MgYSBTdHJpbmdcbi8vIChlLmcuIGEgV2luZG93cyBTZXJ2ZXIgc3R5bGUgbmFtZWQgcGlwZSksIG90aGVyd2lzZSByZXR1cm4gdGhlIHBvcnQgYXMgYW5cbi8vIGludGVnZXIuXG4vL1xuLy8gREVQUkVDQVRFRDogRGlyZWN0IHVzZSBvZiB0aGlzIGZ1bmN0aW9uIGlzIG5vdCByZWNvbW1lbmRlZDsgaXQgaXMgbm9cbi8vIGxvbmdlciB1c2VkIGludGVybmFsbHksIGFuZCB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgcmVsZWFzZS5cbldlYkFwcEludGVybmFscy5wYXJzZVBvcnQgPSBwb3J0ID0+IHtcbiAgbGV0IHBhcnNlZFBvcnQgPSBwYXJzZUludChwb3J0KTtcbiAgaWYgKE51bWJlci5pc05hTihwYXJzZWRQb3J0KSkge1xuICAgIHBhcnNlZFBvcnQgPSBwb3J0O1xuICB9XG4gIHJldHVybiBwYXJzZWRQb3J0O1xufTtcblxuaW1wb3J0IHsgb25NZXNzYWdlIH0gZnJvbSAnbWV0ZW9yL2ludGVyLXByb2Nlc3MtbWVzc2FnaW5nJztcblxub25NZXNzYWdlKCd3ZWJhcHAtcGF1c2UtY2xpZW50JywgYXN5bmMgKHsgYXJjaCB9KSA9PiB7XG4gIGF3YWl0IFdlYkFwcEludGVybmFscy5wYXVzZUNsaWVudChhcmNoKTtcbn0pO1xuXG5vbk1lc3NhZ2UoJ3dlYmFwcC1yZWxvYWQtY2xpZW50JywgYXN5bmMgKHsgYXJjaCB9KSA9PiB7XG4gIGF3YWl0IFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUNsaWVudFByb2dyYW0oYXJjaCk7XG59KTtcblxuYXN5bmMgZnVuY3Rpb24gcnVuV2ViQXBwU2VydmVyKCkge1xuICB2YXIgc2h1dHRpbmdEb3duID0gZmFsc2U7XG4gIHZhciBzeW5jUXVldWUgPSBuZXcgTWV0ZW9yLl9Bc3luY2hyb25vdXNRdWV1ZSgpO1xuXG4gIHZhciBnZXRJdGVtUGF0aG5hbWUgPSBmdW5jdGlvbihpdGVtVXJsKSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChwYXJzZVVybChpdGVtVXJsKS5wYXRobmFtZSk7XG4gIH07XG5cbiAgV2ViQXBwSW50ZXJuYWxzLnJlbG9hZENsaWVudFByb2dyYW1zID0gYXN5bmMgZnVuY3Rpb24oKSB7XG4gICAgYXdhaXQgc3luY1F1ZXVlLnJ1blRhc2soZnVuY3Rpb24oKSB7XG4gICAgICBjb25zdCBzdGF0aWNGaWxlc0J5QXJjaCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAgIGNvbnN0IHsgY29uZmlnSnNvbiB9ID0gX19tZXRlb3JfYm9vdHN0cmFwX187XG4gICAgICBjb25zdCBjbGllbnRBcmNocyA9XG4gICAgICAgIGNvbmZpZ0pzb24uY2xpZW50QXJjaHMgfHwgT2JqZWN0LmtleXMoY29uZmlnSnNvbi5jbGllbnRQYXRocyk7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNsaWVudEFyY2hzLmZvckVhY2goYXJjaCA9PiB7XG4gICAgICAgICAgZ2VuZXJhdGVDbGllbnRQcm9ncmFtKGFyY2gsIHN0YXRpY0ZpbGVzQnlBcmNoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc0J5QXJjaCA9IHN0YXRpY0ZpbGVzQnlBcmNoO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBMb2cuZXJyb3IoJ0Vycm9yIHJlbG9hZGluZyB0aGUgY2xpZW50IHByb2dyYW06ICcgKyBlLnN0YWNrKTtcbiAgICAgICAgcHJvY2Vzcy5leGl0KDEpO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuXG4gIC8vIFBhdXNlIGFueSBpbmNvbWluZyByZXF1ZXN0cyBhbmQgbWFrZSB0aGVtIHdhaXQgZm9yIHRoZSBwcm9ncmFtIHRvIGJlXG4gIC8vIHVucGF1c2VkIHRoZSBuZXh0IHRpbWUgZ2VuZXJhdGVDbGllbnRQcm9ncmFtKGFyY2gpIGlzIGNhbGxlZC5cbiAgV2ViQXBwSW50ZXJuYWxzLnBhdXNlQ2xpZW50ID0gYXN5bmMgZnVuY3Rpb24oYXJjaCkge1xuICAgIGF3YWl0IHN5bmNRdWV1ZS5ydW5UYXNrKCgpID0+IHtcbiAgICAgIGNvbnN0IHByb2dyYW0gPSBXZWJBcHAuY2xpZW50UHJvZ3JhbXNbYXJjaF07XG4gICAgICBjb25zdCB7IHVucGF1c2UgfSA9IHByb2dyYW07XG4gICAgICBwcm9ncmFtLnBhdXNlZCA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIHVucGF1c2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAvLyBJZiB0aGVyZSBoYXBwZW5zIHRvIGJlIGFuIGV4aXN0aW5nIHByb2dyYW0udW5wYXVzZSBmdW5jdGlvbixcbiAgICAgICAgICAvLyBjb21wb3NlIGl0IHdpdGggdGhlIHJlc29sdmUgZnVuY3Rpb24uXG4gICAgICAgICAgcHJvZ3JhbS51bnBhdXNlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB1bnBhdXNlKCk7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwcm9ncmFtLnVucGF1c2UgPSByZXNvbHZlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcblxuICBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVDbGllbnRQcm9ncmFtID0gYXN5bmMgZnVuY3Rpb24oYXJjaCkge1xuICAgIGF3YWl0IHN5bmNRdWV1ZS5ydW5UYXNrKCgpID0+IGdlbmVyYXRlQ2xpZW50UHJvZ3JhbShhcmNoKSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gZ2VuZXJhdGVDbGllbnRQcm9ncmFtKFxuICAgIGFyY2gsXG4gICAgc3RhdGljRmlsZXNCeUFyY2ggPSBXZWJBcHBJbnRlcm5hbHMuc3RhdGljRmlsZXNCeUFyY2hcbiAgKSB7XG4gICAgY29uc3QgY2xpZW50RGlyID0gcGF0aEpvaW4oXG4gICAgICBwYXRoRGlybmFtZShfX21ldGVvcl9ib290c3RyYXBfXy5zZXJ2ZXJEaXIpLFxuICAgICAgYXJjaFxuICAgICk7XG5cbiAgICAvLyByZWFkIHRoZSBjb250cm9sIGZvciB0aGUgY2xpZW50IHdlJ2xsIGJlIHNlcnZpbmcgdXBcbiAgICBjb25zdCBwcm9ncmFtSnNvblBhdGggPSBwYXRoSm9pbihjbGllbnREaXIsICdwcm9ncmFtLmpzb24nKTtcblxuICAgIGxldCBwcm9ncmFtSnNvbjtcbiAgICB0cnkge1xuICAgICAgcHJvZ3JhbUpzb24gPSBKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhwcm9ncmFtSnNvblBhdGgpKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5jb2RlID09PSAnRU5PRU5UJykgcmV0dXJuO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICBpZiAocHJvZ3JhbUpzb24uZm9ybWF0ICE9PSAnd2ViLXByb2dyYW0tcHJlMScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ1Vuc3VwcG9ydGVkIGZvcm1hdCBmb3IgY2xpZW50IGFzc2V0czogJyArXG4gICAgICAgICAgSlNPTi5zdHJpbmdpZnkocHJvZ3JhbUpzb24uZm9ybWF0KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoIXByb2dyYW1Kc29uUGF0aCB8fCAhY2xpZW50RGlyIHx8ICFwcm9ncmFtSnNvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDbGllbnQgY29uZmlnIGZpbGUgbm90IHBhcnNlZC4nKTtcbiAgICB9XG5cbiAgICBhcmNoUGF0aFthcmNoXSA9IGNsaWVudERpcjtcbiAgICBjb25zdCBzdGF0aWNGaWxlcyA9IChzdGF0aWNGaWxlc0J5QXJjaFthcmNoXSA9IE9iamVjdC5jcmVhdGUobnVsbCkpO1xuXG4gICAgY29uc3QgeyBtYW5pZmVzdCB9ID0gcHJvZ3JhbUpzb247XG4gICAgbWFuaWZlc3QuZm9yRWFjaChpdGVtID0+IHtcbiAgICAgIGlmIChpdGVtLnVybCAmJiBpdGVtLndoZXJlID09PSAnY2xpZW50Jykge1xuICAgICAgICBzdGF0aWNGaWxlc1tnZXRJdGVtUGF0aG5hbWUoaXRlbS51cmwpXSA9IHtcbiAgICAgICAgICBhYnNvbHV0ZVBhdGg6IHBhdGhKb2luKGNsaWVudERpciwgaXRlbS5wYXRoKSxcbiAgICAgICAgICBjYWNoZWFibGU6IGl0ZW0uY2FjaGVhYmxlLFxuICAgICAgICAgIGhhc2g6IGl0ZW0uaGFzaCxcbiAgICAgICAgICAvLyBMaW5rIGZyb20gc291cmNlIHRvIGl0cyBtYXBcbiAgICAgICAgICBzb3VyY2VNYXBVcmw6IGl0ZW0uc291cmNlTWFwVXJsLFxuICAgICAgICAgIHR5cGU6IGl0ZW0udHlwZSxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAoaXRlbS5zb3VyY2VNYXApIHtcbiAgICAgICAgICAvLyBTZXJ2ZSB0aGUgc291cmNlIG1hcCB0b28sIHVuZGVyIHRoZSBzcGVjaWZpZWQgVVJMLiBXZSBhc3N1bWVcbiAgICAgICAgICAvLyBhbGwgc291cmNlIG1hcHMgYXJlIGNhY2hlYWJsZS5cbiAgICAgICAgICBzdGF0aWNGaWxlc1tnZXRJdGVtUGF0aG5hbWUoaXRlbS5zb3VyY2VNYXBVcmwpXSA9IHtcbiAgICAgICAgICAgIGFic29sdXRlUGF0aDogcGF0aEpvaW4oY2xpZW50RGlyLCBpdGVtLnNvdXJjZU1hcCksXG4gICAgICAgICAgICBjYWNoZWFibGU6IHRydWUsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgeyBQVUJMSUNfU0VUVElOR1MgfSA9IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX187XG4gICAgY29uc3QgY29uZmlnT3ZlcnJpZGVzID0ge1xuICAgICAgUFVCTElDX1NFVFRJTkdTLFxuICAgIH07XG5cbiAgICBjb25zdCBvbGRQcm9ncmFtID0gV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdO1xuICAgIGNvbnN0IG5ld1Byb2dyYW0gPSAoV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdID0ge1xuICAgICAgZm9ybWF0OiAnd2ViLXByb2dyYW0tcHJlMScsXG4gICAgICBtYW5pZmVzdDogbWFuaWZlc3QsXG4gICAgICAvLyBVc2UgYXJyb3cgZnVuY3Rpb25zIHNvIHRoYXQgdGhlc2UgdmVyc2lvbnMgY2FuIGJlIGxhemlseVxuICAgICAgLy8gY2FsY3VsYXRlZCBsYXRlciwgYW5kIHNvIHRoYXQgdGhleSB3aWxsIG5vdCBiZSBpbmNsdWRlZCBpbiB0aGVcbiAgICAgIC8vIHN0YXRpY0ZpbGVzW21hbmlmZXN0VXJsXS5jb250ZW50IHN0cmluZyBiZWxvdy5cbiAgICAgIC8vXG4gICAgICAvLyBOb3RlOiB0aGVzZSB2ZXJzaW9uIGNhbGN1bGF0aW9ucyBtdXN0IGJlIGtlcHQgaW4gYWdyZWVtZW50IHdpdGhcbiAgICAgIC8vIENvcmRvdmFCdWlsZGVyI2FwcGVuZFZlcnNpb24gaW4gdG9vbHMvY29yZG92YS9idWlsZGVyLmpzLCBvciBob3RcbiAgICAgIC8vIGNvZGUgcHVzaCB3aWxsIHJlbG9hZCBDb3Jkb3ZhIGFwcHMgdW5uZWNlc3NhcmlseS5cbiAgICAgIHZlcnNpb246ICgpID0+XG4gICAgICAgIFdlYkFwcEhhc2hpbmcuY2FsY3VsYXRlQ2xpZW50SGFzaChtYW5pZmVzdCwgbnVsbCwgY29uZmlnT3ZlcnJpZGVzKSxcbiAgICAgIHZlcnNpb25SZWZyZXNoYWJsZTogKCkgPT5cbiAgICAgICAgV2ViQXBwSGFzaGluZy5jYWxjdWxhdGVDbGllbnRIYXNoKFxuICAgICAgICAgIG1hbmlmZXN0LFxuICAgICAgICAgIHR5cGUgPT4gdHlwZSA9PT0gJ2NzcycsXG4gICAgICAgICAgY29uZmlnT3ZlcnJpZGVzXG4gICAgICAgICksXG4gICAgICB2ZXJzaW9uTm9uUmVmcmVzaGFibGU6ICgpID0+XG4gICAgICAgIFdlYkFwcEhhc2hpbmcuY2FsY3VsYXRlQ2xpZW50SGFzaChcbiAgICAgICAgICBtYW5pZmVzdCxcbiAgICAgICAgICAodHlwZSwgcmVwbGFjZWFibGUpID0+IHR5cGUgIT09ICdjc3MnICYmICFyZXBsYWNlYWJsZSxcbiAgICAgICAgICBjb25maWdPdmVycmlkZXNcbiAgICAgICAgKSxcbiAgICAgIHZlcnNpb25SZXBsYWNlYWJsZTogKCkgPT5cbiAgICAgICAgV2ViQXBwSGFzaGluZy5jYWxjdWxhdGVDbGllbnRIYXNoKFxuICAgICAgICAgIG1hbmlmZXN0LFxuICAgICAgICAgIChfdHlwZSwgcmVwbGFjZWFibGUpID0+IHJlcGxhY2VhYmxlLFxuICAgICAgICAgIGNvbmZpZ092ZXJyaWRlc1xuICAgICAgICApLFxuICAgICAgY29yZG92YUNvbXBhdGliaWxpdHlWZXJzaW9uczogcHJvZ3JhbUpzb24uY29yZG92YUNvbXBhdGliaWxpdHlWZXJzaW9ucyxcbiAgICAgIFBVQkxJQ19TRVRUSU5HUyxcbiAgICAgIGhtclZlcnNpb246IHByb2dyYW1Kc29uLmhtclZlcnNpb24sXG4gICAgfSk7XG5cbiAgICAvLyBFeHBvc2UgcHJvZ3JhbSBkZXRhaWxzIGFzIGEgc3RyaW5nIHJlYWNoYWJsZSB2aWEgdGhlIGZvbGxvd2luZyBVUkwuXG4gICAgY29uc3QgbWFuaWZlc3RVcmxQcmVmaXggPSAnL19fJyArIGFyY2gucmVwbGFjZSgvXndlYlxcLi8sICcnKTtcbiAgICBjb25zdCBtYW5pZmVzdFVybCA9IG1hbmlmZXN0VXJsUHJlZml4ICsgZ2V0SXRlbVBhdGhuYW1lKCcvbWFuaWZlc3QuanNvbicpO1xuXG4gICAgc3RhdGljRmlsZXNbbWFuaWZlc3RVcmxdID0gKCkgPT4ge1xuICAgICAgaWYgKFBhY2thZ2UuYXV0b3VwZGF0ZSkge1xuICAgICAgICBjb25zdCB7XG4gICAgICAgICAgQVVUT1VQREFURV9WRVJTSU9OID0gUGFja2FnZS5hdXRvdXBkYXRlLkF1dG91cGRhdGUuYXV0b3VwZGF0ZVZlcnNpb24sXG4gICAgICAgIH0gPSBwcm9jZXNzLmVudjtcblxuICAgICAgICBpZiAoQVVUT1VQREFURV9WRVJTSU9OKSB7XG4gICAgICAgICAgbmV3UHJvZ3JhbS52ZXJzaW9uID0gQVVUT1VQREFURV9WRVJTSU9OO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgbmV3UHJvZ3JhbS52ZXJzaW9uID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIG5ld1Byb2dyYW0udmVyc2lvbiA9IG5ld1Byb2dyYW0udmVyc2lvbigpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBjb250ZW50OiBKU09OLnN0cmluZ2lmeShuZXdQcm9ncmFtKSxcbiAgICAgICAgY2FjaGVhYmxlOiBmYWxzZSxcbiAgICAgICAgaGFzaDogbmV3UHJvZ3JhbS52ZXJzaW9uLFxuICAgICAgICB0eXBlOiAnanNvbicsXG4gICAgICB9O1xuICAgIH07XG5cbiAgICBnZW5lcmF0ZUJvaWxlcnBsYXRlRm9yQXJjaChhcmNoKTtcblxuICAgIC8vIElmIHRoZXJlIGFyZSBhbnkgcmVxdWVzdHMgd2FpdGluZyBvbiBvbGRQcm9ncmFtLnBhdXNlZCwgbGV0IHRoZW1cbiAgICAvLyBjb250aW51ZSBub3cgKHVzaW5nIHRoZSBuZXcgcHJvZ3JhbSkuXG4gICAgaWYgKG9sZFByb2dyYW0gJiYgb2xkUHJvZ3JhbS5wYXVzZWQpIHtcbiAgICAgIG9sZFByb2dyYW0udW5wYXVzZSgpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGRlZmF1bHRPcHRpb25zRm9yQXJjaCA9IHtcbiAgICAnd2ViLmNvcmRvdmEnOiB7XG4gICAgICBydW50aW1lQ29uZmlnT3ZlcnJpZGVzOiB7XG4gICAgICAgIC8vIFhYWCBXZSB1c2UgYWJzb2x1dGVVcmwoKSBoZXJlIHNvIHRoYXQgd2Ugc2VydmUgaHR0cHM6Ly9cbiAgICAgICAgLy8gVVJMcyB0byBjb3Jkb3ZhIGNsaWVudHMgaWYgZm9yY2Utc3NsIGlzIGluIHVzZS4gSWYgd2Ugd2VyZVxuICAgICAgICAvLyB0byB1c2UgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTCBpbnN0ZWFkIG9mXG4gICAgICAgIC8vIGFic29sdXRlVXJsKCksIHRoZW4gQ29yZG92YSBjbGllbnRzIHdvdWxkIGltbWVkaWF0ZWx5IGdldCBhXG4gICAgICAgIC8vIEhDUCBzZXR0aW5nIHRoZWlyIEREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMIHRvXG4gICAgICAgIC8vIGh0dHA6Ly9leGFtcGxlLm1ldGVvci5jb20uIFRoaXMgYnJlYWtzIHRoZSBhcHAsIGJlY2F1c2VcbiAgICAgICAgLy8gZm9yY2Utc3NsIGRvZXNuJ3Qgc2VydmUgQ09SUyBoZWFkZXJzIG9uIDMwMlxuICAgICAgICAvLyByZWRpcmVjdHMuIChQbHVzIGl0J3MgdW5kZXNpcmFibGUgdG8gaGF2ZSBjbGllbnRzXG4gICAgICAgIC8vIGNvbm5lY3RpbmcgdG8gaHR0cDovL2V4YW1wbGUubWV0ZW9yLmNvbSB3aGVuIGZvcmNlLXNzbCBpc1xuICAgICAgICAvLyBpbiB1c2UuKVxuICAgICAgICBERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTDpcbiAgICAgICAgICBwcm9jZXNzLmVudi5NT0JJTEVfRERQX1VSTCB8fCBNZXRlb3IuYWJzb2x1dGVVcmwoKSxcbiAgICAgICAgUk9PVF9VUkw6IHByb2Nlc3MuZW52Lk1PQklMRV9ST09UX1VSTCB8fCBNZXRlb3IuYWJzb2x1dGVVcmwoKSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgICd3ZWIuYnJvd3Nlcic6IHtcbiAgICAgIHJ1bnRpbWVDb25maWdPdmVycmlkZXM6IHtcbiAgICAgICAgaXNNb2Rlcm46IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG5cbiAgICAnd2ViLmJyb3dzZXIubGVnYWN5Jzoge1xuICAgICAgcnVudGltZUNvbmZpZ092ZXJyaWRlczoge1xuICAgICAgICBpc01vZGVybjogZmFsc2UsXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG5cbiAgV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQm9pbGVycGxhdGUgPSBhc3luYyBmdW5jdGlvbigpIHtcbiAgICAvLyBUaGlzIGJvaWxlcnBsYXRlIHdpbGwgYmUgc2VydmVkIHRvIHRoZSBtb2JpbGUgZGV2aWNlcyB3aGVuIHVzZWQgd2l0aFxuICAgIC8vIE1ldGVvci9Db3Jkb3ZhIGZvciB0aGUgSG90LUNvZGUgUHVzaCBhbmQgc2luY2UgdGhlIGZpbGUgd2lsbCBiZSBzZXJ2ZWQgYnlcbiAgICAvLyB0aGUgZGV2aWNlJ3Mgc2VydmVyLCBpdCBpcyBpbXBvcnRhbnQgdG8gc2V0IHRoZSBERFAgdXJsIHRvIHRoZSBhY3R1YWxcbiAgICAvLyBNZXRlb3Igc2VydmVyIGFjY2VwdGluZyBERFAgY29ubmVjdGlvbnMgYW5kIG5vdCB0aGUgZGV2aWNlJ3MgZmlsZSBzZXJ2ZXIuXG4gICAgYXdhaXQgc3luY1F1ZXVlLnJ1blRhc2soZnVuY3Rpb24oKSB7XG4gICAgICBPYmplY3Qua2V5cyhXZWJBcHAuY2xpZW50UHJvZ3JhbXMpLmZvckVhY2goZ2VuZXJhdGVCb2lsZXJwbGF0ZUZvckFyY2gpO1xuICAgIH0pO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGdlbmVyYXRlQm9pbGVycGxhdGVGb3JBcmNoKGFyY2gpIHtcbiAgICBjb25zdCBwcm9ncmFtID0gV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdO1xuICAgIGNvbnN0IGFkZGl0aW9uYWxPcHRpb25zID0gZGVmYXVsdE9wdGlvbnNGb3JBcmNoW2FyY2hdIHx8IHt9O1xuICAgIGNvbnN0IHsgYmFzZURhdGEgfSA9IChib2lsZXJwbGF0ZUJ5QXJjaFtcbiAgICAgIGFyY2hcbiAgICBdID0gV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQm9pbGVycGxhdGVJbnN0YW5jZShcbiAgICAgIGFyY2gsXG4gICAgICBwcm9ncmFtLm1hbmlmZXN0LFxuICAgICAgYWRkaXRpb25hbE9wdGlvbnNcbiAgICApKTtcbiAgICAvLyBXZSBuZWVkIHRoZSBydW50aW1lIGNvbmZpZyB3aXRoIG92ZXJyaWRlcyBmb3IgbWV0ZW9yX3J1bnRpbWVfY29uZmlnLmpzOlxuICAgIHByb2dyYW0ubWV0ZW9yUnVudGltZUNvbmZpZyA9IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgIC4uLl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18sXG4gICAgICAuLi4oYWRkaXRpb25hbE9wdGlvbnMucnVudGltZUNvbmZpZ092ZXJyaWRlcyB8fCBudWxsKSxcbiAgICB9KTtcbiAgICBwcm9ncmFtLnJlZnJlc2hhYmxlQXNzZXRzID0gYmFzZURhdGEuY3NzLm1hcChmaWxlID0+ICh7XG4gICAgICB1cmw6IGJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rKGZpbGUudXJsKSxcbiAgICB9KSk7XG4gIH1cblxuICBhd2FpdCBXZWJBcHBJbnRlcm5hbHMucmVsb2FkQ2xpZW50UHJvZ3JhbXMoKTtcblxuICAvLyB3ZWJzZXJ2ZXJcbiAgdmFyIGFwcCA9IGNyZWF0ZUV4cHJlc3NBcHAoKVxuXG4gIC8vIFBhY2thZ2VzIGFuZCBhcHBzIGNhbiBhZGQgaGFuZGxlcnMgdGhhdCBydW4gYmVmb3JlIGFueSBvdGhlciBNZXRlb3JcbiAgLy8gaGFuZGxlcnMgdmlhIFdlYkFwcC5yYXdFeHByZXNzSGFuZGxlcnMuXG4gIHZhciByYXdFeHByZXNzSGFuZGxlcnMgPSBjcmVhdGVFeHByZXNzQXBwKClcbiAgYXBwLnVzZShyYXdFeHByZXNzSGFuZGxlcnMpO1xuXG4gIC8vIEF1dG8tY29tcHJlc3MgYW55IGpzb24sIGphdmFzY3JpcHQsIG9yIHRleHQuXG4gIGFwcC51c2UoY29tcHJlc3MoeyBmaWx0ZXI6IHNob3VsZENvbXByZXNzIH0pKTtcblxuICAvLyBwYXJzZSBjb29raWVzIGludG8gYW4gb2JqZWN0XG4gIGFwcC51c2UoY29va2llUGFyc2VyKCkpO1xuXG4gIC8vIFdlJ3JlIG5vdCBhIHByb3h5OyByZWplY3QgKHdpdGhvdXQgY3Jhc2hpbmcpIGF0dGVtcHRzIHRvIHRyZWF0IHVzIGxpa2VcbiAgLy8gb25lLiAoU2VlICMxMjEyLilcbiAgYXBwLnVzZShmdW5jdGlvbihyZXEsIHJlcywgbmV4dCkge1xuICAgIGlmIChSb3V0ZVBvbGljeS5pc1ZhbGlkVXJsKHJlcS51cmwpKSB7XG4gICAgICBuZXh0KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJlcy53cml0ZUhlYWQoNDAwKTtcbiAgICByZXMud3JpdGUoJ05vdCBhIHByb3h5Jyk7XG4gICAgcmVzLmVuZCgpO1xuICB9KTtcblxuICAvLyBQYXJzZSB0aGUgcXVlcnkgc3RyaW5nIGludG8gcmVzLnF1ZXJ5LiBVc2VkIGJ5IG9hdXRoX3NlcnZlciwgYnV0IGl0J3NcbiAgLy8gZ2VuZXJhbGx5IHByZXR0eSBoYW5keS4uXG4gIC8vXG4gIC8vIERvIHRoaXMgYmVmb3JlIHRoZSBuZXh0IG1pZGRsZXdhcmUgZGVzdHJveXMgcmVxLnVybCBpZiBhIHBhdGggcHJlZml4XG4gIC8vIGlzIHNldCB0byBjbG9zZSAjMTAxMTEuXG4gIGFwcC51c2UoZnVuY3Rpb24ocmVxdWVzdCwgcmVzcG9uc2UsIG5leHQpIHtcbiAgICByZXF1ZXN0LnF1ZXJ5ID0gcXMucGFyc2UocGFyc2VVcmwocmVxdWVzdC51cmwpLnF1ZXJ5KTtcbiAgICBuZXh0KCk7XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIGdldFBhdGhQYXJ0cyhwYXRoKSB7XG4gICAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcvJyk7XG4gICAgd2hpbGUgKHBhcnRzWzBdID09PSAnJykgcGFydHMuc2hpZnQoKTtcbiAgICByZXR1cm4gcGFydHM7XG4gIH1cblxuICBmdW5jdGlvbiBpc1ByZWZpeE9mKHByZWZpeCwgYXJyYXkpIHtcbiAgICByZXR1cm4gKFxuICAgICAgcHJlZml4Lmxlbmd0aCA8PSBhcnJheS5sZW5ndGggJiZcbiAgICAgIHByZWZpeC5ldmVyeSgocGFydCwgaSkgPT4gcGFydCA9PT0gYXJyYXlbaV0pXG4gICAgKTtcbiAgfVxuXG4gIC8vIFN0cmlwIG9mZiB0aGUgcGF0aCBwcmVmaXgsIGlmIGl0IGV4aXN0cy5cbiAgYXBwLnVzZShmdW5jdGlvbihyZXF1ZXN0LCByZXNwb25zZSwgbmV4dCkge1xuICAgIGNvbnN0IHBhdGhQcmVmaXggPSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMX1BBVEhfUFJFRklYO1xuICAgIGNvbnN0IHsgcGF0aG5hbWUsIHNlYXJjaCB9ID0gcGFyc2VVcmwocmVxdWVzdC51cmwpO1xuXG4gICAgLy8gY2hlY2sgaWYgdGhlIHBhdGggaW4gdGhlIHVybCBzdGFydHMgd2l0aCB0aGUgcGF0aCBwcmVmaXhcbiAgICBpZiAocGF0aFByZWZpeCkge1xuICAgICAgY29uc3QgcHJlZml4UGFydHMgPSBnZXRQYXRoUGFydHMocGF0aFByZWZpeCk7XG4gICAgICBjb25zdCBwYXRoUGFydHMgPSBnZXRQYXRoUGFydHMocGF0aG5hbWUpO1xuICAgICAgaWYgKGlzUHJlZml4T2YocHJlZml4UGFydHMsIHBhdGhQYXJ0cykpIHtcbiAgICAgICAgcmVxdWVzdC51cmwgPSAnLycgKyBwYXRoUGFydHMuc2xpY2UocHJlZml4UGFydHMubGVuZ3RoKS5qb2luKCcvJyk7XG4gICAgICAgIGlmIChzZWFyY2gpIHtcbiAgICAgICAgICByZXF1ZXN0LnVybCArPSBzZWFyY2g7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocGF0aG5hbWUgPT09ICcvZmF2aWNvbi5pY28nIHx8IHBhdGhuYW1lID09PSAnL3JvYm90cy50eHQnKSB7XG4gICAgICByZXR1cm4gbmV4dCgpO1xuICAgIH1cblxuICAgIGlmIChwYXRoUHJlZml4KSB7XG4gICAgICByZXNwb25zZS53cml0ZUhlYWQoNDA0KTtcbiAgICAgIHJlc3BvbnNlLndyaXRlKCdVbmtub3duIHBhdGgnKTtcbiAgICAgIHJlc3BvbnNlLmVuZCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIG5leHQoKTtcbiAgfSk7XG5cbiAgLy8gU2VydmUgc3RhdGljIGZpbGVzIGZyb20gdGhlIG1hbmlmZXN0LlxuICAvLyBUaGlzIGlzIGluc3BpcmVkIGJ5IHRoZSAnc3RhdGljJyBtaWRkbGV3YXJlLlxuICBhcHAudXNlKGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgLy8gY29uc29sZS5sb2coU3RyaW5nKGFyZ3VtZW50cy5jYWxsZWUpKTtcbiAgICBXZWJBcHBJbnRlcm5hbHMuc3RhdGljRmlsZXNNaWRkbGV3YXJlKFxuICAgICAgV2ViQXBwSW50ZXJuYWxzLnN0YXRpY0ZpbGVzQnlBcmNoLFxuICAgICAgcmVxLFxuICAgICAgcmVzLFxuICAgICAgbmV4dFxuICAgICk7XG4gIH0pO1xuXG4gIC8vIENvcmUgTWV0ZW9yIHBhY2thZ2VzIGxpa2UgZHluYW1pYy1pbXBvcnQgY2FuIGFkZCBoYW5kbGVycyBiZWZvcmVcbiAgLy8gb3RoZXIgaGFuZGxlcnMgYWRkZWQgYnkgcGFja2FnZSBhbmQgYXBwbGljYXRpb24gY29kZS5cbiAgYXBwLnVzZSgoV2ViQXBwSW50ZXJuYWxzLm1ldGVvckludGVybmFsSGFuZGxlcnMgPSBjcmVhdGVFeHByZXNzQXBwKCkpKTtcblxuICAvKipcbiAgICogQG5hbWUgZXhwcmVzc0hhbmRsZXJzQ2FsbGJhY2socmVxLCByZXMsIG5leHQpXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQGlzcHJvdG90eXBlIHRydWVcbiAgICogQHN1bW1hcnkgY2FsbGJhY2sgaGFuZGxlciBmb3IgYFdlYkFwcC5leHByZXNzSGFuZGxlcnNgXG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXFcbiAgICogYSBOb2RlLmpzXG4gICAqIFtJbmNvbWluZ01lc3NhZ2VdKGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvaHR0cC5odG1sI2NsYXNzLWh0dHBpbmNvbWluZ21lc3NhZ2UpXG4gICAqIG9iamVjdCB3aXRoIHNvbWUgZXh0cmEgcHJvcGVydGllcy4gVGhpcyBhcmd1bWVudCBjYW4gYmUgdXNlZFxuICAgKiAgdG8gZ2V0IGluZm9ybWF0aW9uIGFib3V0IHRoZSBpbmNvbWluZyByZXF1ZXN0LlxuICAgKiBAcGFyYW0ge09iamVjdH0gcmVzXG4gICAqIGEgTm9kZS5qc1xuICAgKiBbU2VydmVyUmVzcG9uc2VdKGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvaHR0cC5odG1sI2NsYXNzLWh0dHBzZXJ2ZXJyZXNwb25zZSlcbiAgICogb2JqZWN0LiBVc2UgdGhpcyB0byB3cml0ZSBkYXRhIHRoYXQgc2hvdWxkIGJlIHNlbnQgaW4gcmVzcG9uc2UgdG8gdGhlXG4gICAqIHJlcXVlc3QsIGFuZCBjYWxsIGByZXMuZW5kKClgIHdoZW4geW91IGFyZSBkb25lLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBuZXh0XG4gICAqIENhbGxpbmcgdGhpcyBmdW5jdGlvbiB3aWxsIHBhc3Mgb24gdGhlIGhhbmRsaW5nIG9mXG4gICAqIHRoaXMgcmVxdWVzdCB0byB0aGUgbmV4dCByZWxldmFudCBoYW5kbGVyLlxuICAgKlxuICAgKi9cblxuICAvKipcbiAgICogQG1ldGhvZCBoYW5kbGVyc1xuICAgKiBAbWVtYmVyb2YgV2ViQXBwXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBoYW5kbGVyIGZvciBhbGwgSFRUUCByZXF1ZXN0cy5cbiAgICogQHBhcmFtIHtTdHJpbmd9IFtwYXRoXVxuICAgKiBUaGlzIGhhbmRsZXIgd2lsbCBvbmx5IGJlIGNhbGxlZCBvbiBwYXRocyB0aGF0IG1hdGNoXG4gICAqIHRoaXMgc3RyaW5nLiBUaGUgbWF0Y2ggaGFzIHRvIGJvcmRlciBvbiBhIGAvYCBvciBhIGAuYC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsIGAvaGVsbG9gIHdpbGwgbWF0Y2ggYC9oZWxsby93b3JsZGAgYW5kXG4gICAqIGAvaGVsbG8ud29ybGRgLCBidXQgbm90IGAvaGVsbG9fd29ybGRgLlxuICAgKiBAcGFyYW0ge2V4cHJlc3NIYW5kbGVyc0NhbGxiYWNrfSBoYW5kbGVyXG4gICAqIEEgaGFuZGxlciBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgY2FsbGVkIG9uIEhUVFAgcmVxdWVzdHMuXG4gICAqIFNlZSBgZXhwcmVzc0hhbmRsZXJzQ2FsbGJhY2tgXG4gICAqXG4gICAqL1xuICAvLyBQYWNrYWdlcyBhbmQgYXBwcyBjYW4gYWRkIGhhbmRsZXJzIHRvIHRoaXMgdmlhIFdlYkFwcC5leHByZXNzSGFuZGxlcnMuXG4gIC8vIFRoZXkgYXJlIGluc2VydGVkIGJlZm9yZSBvdXIgZGVmYXVsdCBoYW5kbGVyLlxuICB2YXIgcGFja2FnZUFuZEFwcEhhbmRsZXJzID0gY3JlYXRlRXhwcmVzc0FwcCgpXG4gIGFwcC51c2UocGFja2FnZUFuZEFwcEhhbmRsZXJzKTtcblxuICBsZXQgc3VwcHJlc3NFeHByZXNzRXJyb3JzID0gZmFsc2U7XG4gIC8vIEV4cHJlc3Mga25vd3MgaXQgaXMgYW4gZXJyb3IgaGFuZGxlciBiZWNhdXNlIGl0IGhhcyA0IGFyZ3VtZW50cyBpbnN0ZWFkIG9mXG4gIC8vIDMuIGdvIGZpZ3VyZS4gIChJdCBpcyBub3Qgc21hcnQgZW5vdWdoIHRvIGZpbmQgc3VjaCBhIHRoaW5nIGlmIGl0J3MgaGlkZGVuXG4gIC8vIGluc2lkZSBwYWNrYWdlQW5kQXBwSGFuZGxlcnMuKVxuICBhcHAudXNlKGZ1bmN0aW9uKGVyciwgcmVxLCByZXMsIG5leHQpIHtcbiAgICBpZiAoIWVyciB8fCAhc3VwcHJlc3NFeHByZXNzRXJyb3JzIHx8ICFyZXEuaGVhZGVyc1sneC1zdXBwcmVzcy1lcnJvciddKSB7XG4gICAgICBuZXh0KGVycik7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJlcy53cml0ZUhlYWQoZXJyLnN0YXR1cywgeyAnQ29udGVudC1UeXBlJzogJ3RleHQvcGxhaW4nIH0pO1xuICAgIHJlcy5lbmQoJ0FuIGVycm9yIG1lc3NhZ2UnKTtcbiAgfSk7XG5cbiAgYXBwLnVzZShhc3luYyBmdW5jdGlvbihyZXEsIHJlcywgbmV4dCkge1xuICAgIGlmICghYXBwVXJsKHJlcS51cmwpKSB7XG4gICAgICByZXR1cm4gbmV4dCgpO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICByZXEubWV0aG9kICE9PSAnSEVBRCcgJiZcbiAgICAgIHJlcS5tZXRob2QgIT09ICdHRVQnICYmXG4gICAgICAhTWV0ZW9yLnNldHRpbmdzLnBhY2thZ2VzPy53ZWJhcHA/LmFsd2F5c1JldHVybkNvbnRlbnRcbiAgICApIHtcbiAgICAgIGNvbnN0IHN0YXR1cyA9IHJlcS5tZXRob2QgPT09ICdPUFRJT05TJyA/IDIwMCA6IDQwNTtcbiAgICAgIHJlcy53cml0ZUhlYWQoc3RhdHVzLCB7XG4gICAgICAgIEFsbG93OiAnT1BUSU9OUywgR0VULCBIRUFEJyxcbiAgICAgICAgJ0NvbnRlbnQtTGVuZ3RoJzogJzAnLFxuICAgICAgfSk7XG4gICAgICByZXMuZW5kKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBoZWFkZXJzID0ge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ3RleHQvaHRtbDsgY2hhcnNldD11dGYtOCcsXG4gICAgICB9O1xuXG4gICAgICBpZiAoc2h1dHRpbmdEb3duKSB7XG4gICAgICAgIGhlYWRlcnNbJ0Nvbm5lY3Rpb24nXSA9ICdDbG9zZSc7XG4gICAgICB9XG5cbiAgICAgIHZhciByZXF1ZXN0ID0gV2ViQXBwLmNhdGVnb3JpemVSZXF1ZXN0KHJlcSk7XG5cbiAgICAgIGlmIChyZXF1ZXN0LnVybC5xdWVyeSAmJiByZXF1ZXN0LnVybC5xdWVyeVsnbWV0ZW9yX2Nzc19yZXNvdXJjZSddKSB7XG4gICAgICAgIC8vIEluIHRoaXMgY2FzZSwgd2UncmUgcmVxdWVzdGluZyBhIENTUyByZXNvdXJjZSBpbiB0aGUgbWV0ZW9yLXNwZWNpZmljXG4gICAgICAgIC8vIHdheSwgYnV0IHdlIGRvbid0IGhhdmUgaXQuICBTZXJ2ZSBhIHN0YXRpYyBjc3MgZmlsZSB0aGF0IGluZGljYXRlcyB0aGF0XG4gICAgICAgIC8vIHdlIGRpZG4ndCBoYXZlIGl0LCBzbyB3ZSBjYW4gZGV0ZWN0IHRoYXQgYW5kIHJlZnJlc2guICBNYWtlIHN1cmVcbiAgICAgICAgLy8gdGhhdCBhbnkgcHJveGllcyBvciBDRE5zIGRvbid0IGNhY2hlIHRoaXMgZXJyb3IhICAoTm9ybWFsbHkgcHJveGllc1xuICAgICAgICAvLyBvciBDRE5zIGFyZSBzbWFydCBlbm91Z2ggbm90IHRvIGNhY2hlIGVycm9yIHBhZ2VzLCBidXQgaW4gb3JkZXIgdG9cbiAgICAgICAgLy8gbWFrZSB0aGlzIGhhY2sgd29yaywgd2UgbmVlZCB0byByZXR1cm4gdGhlIENTUyBmaWxlIGFzIGEgMjAwLCB3aGljaFxuICAgICAgICAvLyB3b3VsZCBvdGhlcndpc2UgYmUgY2FjaGVkLilcbiAgICAgICAgaGVhZGVyc1snQ29udGVudC1UeXBlJ10gPSAndGV4dC9jc3M7IGNoYXJzZXQ9dXRmLTgnO1xuICAgICAgICBoZWFkZXJzWydDYWNoZS1Db250cm9sJ10gPSAnbm8tY2FjaGUnO1xuICAgICAgICByZXMud3JpdGVIZWFkKDIwMCwgaGVhZGVycyk7XG4gICAgICAgIHJlcy53cml0ZSgnLm1ldGVvci1jc3Mtbm90LWZvdW5kLWVycm9yIHsgd2lkdGg6IDBweDt9Jyk7XG4gICAgICAgIHJlcy5lbmQoKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVxdWVzdC51cmwucXVlcnkgJiYgcmVxdWVzdC51cmwucXVlcnlbJ21ldGVvcl9qc19yZXNvdXJjZSddKSB7XG4gICAgICAgIC8vIFNpbWlsYXJseSwgd2UncmUgcmVxdWVzdGluZyBhIEpTIHJlc291cmNlIHRoYXQgd2UgZG9uJ3QgaGF2ZS5cbiAgICAgICAgLy8gU2VydmUgYW4gdW5jYWNoZWQgNDA0LiAoV2UgY2FuJ3QgdXNlIHRoZSBzYW1lIGhhY2sgd2UgdXNlIGZvciBDU1MsXG4gICAgICAgIC8vIGJlY2F1c2UgYWN0dWFsbHkgYWN0aW5nIG9uIHRoYXQgaGFjayByZXF1aXJlcyB1cyB0byBoYXZlIHRoZSBKU1xuICAgICAgICAvLyBhbHJlYWR5ISlcbiAgICAgICAgaGVhZGVyc1snQ2FjaGUtQ29udHJvbCddID0gJ25vLWNhY2hlJztcbiAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQsIGhlYWRlcnMpO1xuICAgICAgICByZXMuZW5kKCc0MDQgTm90IEZvdW5kJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlcXVlc3QudXJsLnF1ZXJ5ICYmIHJlcXVlc3QudXJsLnF1ZXJ5WydtZXRlb3JfZG9udF9zZXJ2ZV9pbmRleCddKSB7XG4gICAgICAgIC8vIFdoZW4gZG93bmxvYWRpbmcgZmlsZXMgZHVyaW5nIGEgQ29yZG92YSBob3QgY29kZSBwdXNoLCB3ZSBuZWVkXG4gICAgICAgIC8vIHRvIGRldGVjdCBpZiBhIGZpbGUgaXMgbm90IGF2YWlsYWJsZSBpbnN0ZWFkIG9mIGluYWR2ZXJ0ZW50bHlcbiAgICAgICAgLy8gZG93bmxvYWRpbmcgdGhlIGRlZmF1bHQgaW5kZXggcGFnZS5cbiAgICAgICAgLy8gU28gc2ltaWxhciB0byB0aGUgc2l0dWF0aW9uIGFib3ZlLCB3ZSBzZXJ2ZSBhbiB1bmNhY2hlZCA0MDQuXG4gICAgICAgIGhlYWRlcnNbJ0NhY2hlLUNvbnRyb2wnXSA9ICduby1jYWNoZSc7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoNDA0LCBoZWFkZXJzKTtcbiAgICAgICAgcmVzLmVuZCgnNDA0IE5vdCBGb3VuZCcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHsgYXJjaCB9ID0gcmVxdWVzdDtcbiAgICAgIGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlb2YgYXJjaCwgJ3N0cmluZycsIHsgYXJjaCB9KTtcblxuICAgICAgaWYgKCFoYXNPd24uY2FsbChXZWJBcHAuY2xpZW50UHJvZ3JhbXMsIGFyY2gpKSB7XG4gICAgICAgIC8vIFdlIGNvdWxkIGNvbWUgaGVyZSBpbiBjYXNlIHdlIHJ1biB3aXRoIHNvbWUgYXJjaGl0ZWN0dXJlcyBleGNsdWRlZFxuICAgICAgICBoZWFkZXJzWydDYWNoZS1Db250cm9sJ10gPSAnbm8tY2FjaGUnO1xuICAgICAgICByZXMud3JpdGVIZWFkKDQwNCwgaGVhZGVycyk7XG4gICAgICAgIGlmIChNZXRlb3IuaXNEZXZlbG9wbWVudCkge1xuICAgICAgICAgIHJlcy5lbmQoYE5vIGNsaWVudCBwcm9ncmFtIGZvdW5kIGZvciB0aGUgJHthcmNofSBhcmNoaXRlY3R1cmUuYCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gU2FmZXR5IG5ldCwgYnV0IHRoaXMgYnJhbmNoIHNob3VsZCBub3QgYmUgcG9zc2libGUuXG4gICAgICAgICAgcmVzLmVuZCgnNDA0IE5vdCBGb3VuZCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgcGF1c2VDbGllbnQoYXJjaCkgaGFzIGJlZW4gY2FsbGVkLCBwcm9ncmFtLnBhdXNlZCB3aWxsIGJlIGFcbiAgICAgIC8vIFByb21pc2UgdGhhdCB3aWxsIGJlIHJlc29sdmVkIHdoZW4gdGhlIHByb2dyYW0gaXMgdW5wYXVzZWQuXG4gICAgICBhd2FpdCBXZWJBcHAuY2xpZW50UHJvZ3JhbXNbYXJjaF0ucGF1c2VkO1xuXG4gICAgICByZXR1cm4gZ2V0Qm9pbGVycGxhdGVBc3luYyhyZXF1ZXN0LCBhcmNoKVxuICAgICAgICAudGhlbigoeyBzdHJlYW0sIHN0YXR1c0NvZGUsIGhlYWRlcnM6IG5ld0hlYWRlcnMgfSkgPT4ge1xuICAgICAgICAgIGlmICghc3RhdHVzQ29kZSkge1xuICAgICAgICAgICAgc3RhdHVzQ29kZSA9IHJlcy5zdGF0dXNDb2RlID8gcmVzLnN0YXR1c0NvZGUgOiAyMDA7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKG5ld0hlYWRlcnMpIHtcbiAgICAgICAgICAgIE9iamVjdC5hc3NpZ24oaGVhZGVycywgbmV3SGVhZGVycyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmVzLndyaXRlSGVhZChzdGF0dXNDb2RlLCBoZWFkZXJzKTtcblxuICAgICAgICAgIHN0cmVhbS5waXBlKHJlcywge1xuICAgICAgICAgICAgLy8gRW5kIHRoZSByZXNwb25zZSB3aGVuIHRoZSBzdHJlYW0gZW5kcy5cbiAgICAgICAgICAgIGVuZDogdHJ1ZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgICBMb2cuZXJyb3IoJ0Vycm9yIHJ1bm5pbmcgdGVtcGxhdGU6ICcgKyBlcnJvci5zdGFjayk7XG4gICAgICAgICAgcmVzLndyaXRlSGVhZCg1MDAsIGhlYWRlcnMpO1xuICAgICAgICAgIHJlcy5lbmQoKTtcbiAgICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICAvLyBSZXR1cm4gNDA0IGJ5IGRlZmF1bHQsIGlmIG5vIG90aGVyIGhhbmRsZXJzIHNlcnZlIHRoaXMgVVJMLlxuICBhcHAudXNlKGZ1bmN0aW9uKHJlcSwgcmVzKSB7XG4gICAgcmVzLndyaXRlSGVhZCg0MDQpO1xuICAgIHJlcy5lbmQoKTtcbiAgfSk7XG5cbiAgdmFyIGh0dHBTZXJ2ZXIgPSBjcmVhdGVTZXJ2ZXIoYXBwKTtcbiAgdmFyIG9uTGlzdGVuaW5nQ2FsbGJhY2tzID0gW107XG5cbiAgLy8gQWZ0ZXIgNSBzZWNvbmRzIHcvbyBkYXRhIG9uIGEgc29ja2V0LCBraWxsIGl0LiAgT24gdGhlIG90aGVyIGhhbmQsIGlmXG4gIC8vIHRoZXJlJ3MgYW4gb3V0c3RhbmRpbmcgcmVxdWVzdCwgZ2l2ZSBpdCBhIGhpZ2hlciB0aW1lb3V0IGluc3RlYWQgKHRvIGF2b2lkXG4gIC8vIGtpbGxpbmcgbG9uZy1wb2xsaW5nIHJlcXVlc3RzKVxuICBodHRwU2VydmVyLnNldFRpbWVvdXQoU0hPUlRfU09DS0VUX1RJTUVPVVQpO1xuXG4gIC8vIERvIHRoaXMgaGVyZSwgYW5kIHRoZW4gYWxzbyBpbiBsaXZlZGF0YS9zdHJlYW1fc2VydmVyLmpzLCBiZWNhdXNlXG4gIC8vIHN0cmVhbV9zZXJ2ZXIuanMga2lsbHMgYWxsIHRoZSBjdXJyZW50IHJlcXVlc3QgaGFuZGxlcnMgd2hlbiBpbnN0YWxsaW5nIGl0c1xuICAvLyBvd24uXG4gIGh0dHBTZXJ2ZXIub24oJ3JlcXVlc3QnLCBXZWJBcHAuX3RpbWVvdXRBZGp1c3RtZW50UmVxdWVzdENhbGxiYWNrKTtcblxuICAvLyBJZiB0aGUgY2xpZW50IGdhdmUgdXMgYSBiYWQgcmVxdWVzdCwgdGVsbCBpdCBpbnN0ZWFkIG9mIGp1c3QgY2xvc2luZyB0aGVcbiAgLy8gc29ja2V0LiBUaGlzIGxldHMgbG9hZCBiYWxhbmNlcnMgaW4gZnJvbnQgb2YgdXMgZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIFwiYVxuICAvLyBzZXJ2ZXIgaXMgcmFuZG9tbHkgY2xvc2luZyBzb2NrZXRzIGZvciBubyByZWFzb25cIiBhbmQgXCJjbGllbnQgc2VudCBhIGJhZFxuICAvLyByZXF1ZXN0XCIuXG4gIC8vXG4gIC8vIFRoaXMgd2lsbCBvbmx5IHdvcmsgb24gTm9kZSA2OyBOb2RlIDQgZGVzdHJveXMgdGhlIHNvY2tldCBiZWZvcmUgY2FsbGluZ1xuICAvLyB0aGlzIGV2ZW50LiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL3B1bGwvNDU1Ny8gZm9yIGRldGFpbHMuXG4gIGh0dHBTZXJ2ZXIub24oJ2NsaWVudEVycm9yJywgKGVyciwgc29ja2V0KSA9PiB7XG4gICAgLy8gUHJlLU5vZGUtNiwgZG8gbm90aGluZy5cbiAgICBpZiAoc29ja2V0LmRlc3Ryb3llZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChlcnIubWVzc2FnZSA9PT0gJ1BhcnNlIEVycm9yJykge1xuICAgICAgc29ja2V0LmVuZCgnSFRUUC8xLjEgNDAwIEJhZCBSZXF1ZXN0XFxyXFxuXFxyXFxuJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEZvciBvdGhlciBlcnJvcnMsIHVzZSB0aGUgZGVmYXVsdCBiZWhhdmlvciBhcyBpZiB3ZSBoYWQgbm8gY2xpZW50RXJyb3JcbiAgICAgIC8vIGhhbmRsZXIuXG4gICAgICBzb2NrZXQuZGVzdHJveShlcnIpO1xuICAgIH1cbiAgfSk7XG5cbiAgY29uc3Qgc3VwcHJlc3NFcnJvcnMgPSBmdW5jdGlvbigpIHtcbiAgICBzdXBwcmVzc0V4cHJlc3NFcnJvcnMgPSB0cnVlO1xuICB9O1xuXG4gIGxldCB3YXJuZWRBYm91dENvbm5lY3RVc2FnZSA9IGZhbHNlO1xuXG4gIC8vIHN0YXJ0IHVwIGFwcFxuICBfLmV4dGVuZChXZWJBcHAsIHtcbiAgICBjb25uZWN0SGFuZGxlcnM6IHBhY2thZ2VBbmRBcHBIYW5kbGVycyxcbiAgICBoYW5kbGVyczogcGFja2FnZUFuZEFwcEhhbmRsZXJzLFxuICAgIHJhd0Nvbm5lY3RIYW5kbGVyczogcmF3RXhwcmVzc0hhbmRsZXJzLFxuICAgIHJhd0hhbmRsZXJzOiByYXdFeHByZXNzSGFuZGxlcnMsXG4gICAgaHR0cFNlcnZlcjogaHR0cFNlcnZlcixcbiAgICBleHByZXNzQXBwOiBhcHAsXG4gICAgLy8gRm9yIHRlc3RpbmcuXG4gICAgc3VwcHJlc3NDb25uZWN0RXJyb3JzOiAoKSA9PiB7XG4gICAgICBpZiAoISB3YXJuZWRBYm91dENvbm5lY3RVc2FnZSkge1xuICAgICAgICBNZXRlb3IuX2RlYnVnKFwiV2ViQXBwLnN1cHByZXNzQ29ubmVjdEVycm9ycyBoYXMgYmVlbiByZW5hbWVkIHRvIE1ldGVvci5fc3VwcHJlc3NFeHByZXNzRXJyb3JzIGFuZCBpdCBzaG91bGQgYmUgdXNlZCBvbmx5IGluIHRlc3RzLlwiKTtcbiAgICAgICAgd2FybmVkQWJvdXRDb25uZWN0VXNhZ2UgPSB0cnVlO1xuICAgICAgfVxuICAgICAgc3VwcHJlc3NFcnJvcnMoKTtcbiAgICB9LFxuICAgIF9zdXBwcmVzc0V4cHJlc3NFcnJvcnM6IHN1cHByZXNzRXJyb3JzLFxuICAgIG9uTGlzdGVuaW5nOiBmdW5jdGlvbihmKSB7XG4gICAgICBpZiAob25MaXN0ZW5pbmdDYWxsYmFja3MpIG9uTGlzdGVuaW5nQ2FsbGJhY2tzLnB1c2goZik7XG4gICAgICBlbHNlIGYoKTtcbiAgICB9LFxuICAgIC8vIFRoaXMgY2FuIGJlIG92ZXJyaWRkZW4gYnkgdXNlcnMgd2hvIHdhbnQgdG8gbW9kaWZ5IGhvdyBsaXN0ZW5pbmcgd29ya3NcbiAgICAvLyAoZWcsIHRvIHJ1biBhIHByb3h5IGxpa2UgQXBvbGxvIEVuZ2luZSBQcm94eSBpbiBmcm9udCBvZiB0aGUgc2VydmVyKS5cbiAgICBzdGFydExpc3RlbmluZzogZnVuY3Rpb24oaHR0cFNlcnZlciwgbGlzdGVuT3B0aW9ucywgY2IpIHtcbiAgICAgIGh0dHBTZXJ2ZXIubGlzdGVuKGxpc3Rlbk9wdGlvbnMsIGNiKTtcbiAgICB9LFxuICB9KTtcblxuICAgIC8qKlxuICAgKiBAbmFtZSBtYWluXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHN1bW1hcnkgU3RhcnRzIHRoZSBIVFRQIHNlcnZlci5cbiAgICogIElmIGBVTklYX1NPQ0tFVF9QQVRIYCBpcyBwcmVzZW50IE1ldGVvcidzIEhUVFAgc2VydmVyIHdpbGwgdXNlIHRoYXQgc29ja2V0IGZpbGUgZm9yIGludGVyLXByb2Nlc3MgY29tbXVuaWNhdGlvbiwgaW5zdGVhZCBvZiBUQ1AuXG4gICAqIElmIHlvdSBjaG9vc2UgdG8gbm90IGluY2x1ZGUgd2ViYXBwIHBhY2thZ2UgaW4geW91ciBhcHBsaWNhdGlvbiB0aGlzIG1ldGhvZCBzdGlsbCBtdXN0IGJlIGRlZmluZWQgZm9yIHlvdXIgTWV0ZW9yIGFwcGxpY2F0aW9uIHRvIHdvcmsuXG4gICAqL1xuICAvLyBMZXQgdGhlIHJlc3Qgb2YgdGhlIHBhY2thZ2VzIChhbmQgTWV0ZW9yLnN0YXJ0dXAgaG9va3MpIGluc2VydCBFeHByZXNzXG4gIC8vIG1pZGRsZXdhcmVzIGFuZCB1cGRhdGUgX19tZXRlb3JfcnVudGltZV9jb25maWdfXywgdGhlbiBrZWVwIGdvaW5nIHRvIHNldCB1cFxuICAvLyBhY3R1YWxseSBzZXJ2aW5nIEhUTUwuXG4gIGV4cG9ydHMubWFpbiA9IGFzeW5jIGFyZ3YgPT4ge1xuICAgIGF3YWl0IFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG5cbiAgICBjb25zdCBzdGFydEh0dHBTZXJ2ZXIgPSBsaXN0ZW5PcHRpb25zID0+IHtcbiAgICAgIFdlYkFwcC5zdGFydExpc3RlbmluZyhcbiAgICAgICAgaHR0cFNlcnZlcixcbiAgICAgICAgbGlzdGVuT3B0aW9ucyxcbiAgICAgICAgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChcbiAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTUVURU9SX1BSSU5UX09OX0xJU1RFTikge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnTElTVEVOSU5HJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBjYWxsYmFja3MgPSBvbkxpc3RlbmluZ0NhbGxiYWNrcztcbiAgICAgICAgICAgIG9uTGlzdGVuaW5nQ2FsbGJhY2tzID0gbnVsbDtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5mb3JFYWNoKGNhbGxiYWNrID0+IHtcbiAgICAgICAgICAgICAgY2FsbGJhY2soKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgZSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvciBsaXN0ZW5pbmc6JywgZSk7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGUgJiYgZS5zdGFjayk7XG4gICAgICAgICAgfVxuICAgICAgICApXG4gICAgICApO1xuICAgIH07XG5cbiAgICBsZXQgbG9jYWxQb3J0ID0gcHJvY2Vzcy5lbnYuUE9SVCB8fCAwO1xuICAgIGxldCB1bml4U29ja2V0UGF0aCA9IHByb2Nlc3MuZW52LlVOSVhfU09DS0VUX1BBVEg7XG5cbiAgICBpZiAodW5peFNvY2tldFBhdGgpIHtcbiAgICAgIGlmIChjbHVzdGVyLmlzV29ya2VyKSB7XG4gICAgICAgIGNvbnN0IHdvcmtlck5hbWUgPSBjbHVzdGVyLndvcmtlci5wcm9jZXNzLmVudi5uYW1lIHx8IGNsdXN0ZXIud29ya2VyLmlkO1xuICAgICAgICB1bml4U29ja2V0UGF0aCArPSAnLicgKyB3b3JrZXJOYW1lICsgJy5zb2NrJztcbiAgICAgIH1cbiAgICAgIC8vIFN0YXJ0IHRoZSBIVFRQIHNlcnZlciB1c2luZyBhIHNvY2tldCBmaWxlLlxuICAgICAgcmVtb3ZlRXhpc3RpbmdTb2NrZXRGaWxlKHVuaXhTb2NrZXRQYXRoKTtcbiAgICAgIHN0YXJ0SHR0cFNlcnZlcih7IHBhdGg6IHVuaXhTb2NrZXRQYXRoIH0pO1xuXG4gICAgICBjb25zdCB1bml4U29ja2V0UGVybWlzc2lvbnMgPSAoXG4gICAgICAgIHByb2Nlc3MuZW52LlVOSVhfU09DS0VUX1BFUk1JU1NJT05TIHx8ICcnXG4gICAgICApLnRyaW0oKTtcbiAgICAgIGlmICh1bml4U29ja2V0UGVybWlzc2lvbnMpIHtcbiAgICAgICAgaWYgKC9eWzAtN117M30kLy50ZXN0KHVuaXhTb2NrZXRQZXJtaXNzaW9ucykpIHtcbiAgICAgICAgICBjaG1vZFN5bmModW5peFNvY2tldFBhdGgsIHBhcnNlSW50KHVuaXhTb2NrZXRQZXJtaXNzaW9ucywgOCkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBVTklYX1NPQ0tFVF9QRVJNSVNTSU9OUyBzcGVjaWZpZWQnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCB1bml4U29ja2V0R3JvdXAgPSAocHJvY2Vzcy5lbnYuVU5JWF9TT0NLRVRfR1JPVVAgfHwgJycpLnRyaW0oKTtcbiAgICAgIGlmICh1bml4U29ja2V0R3JvdXApIHtcbiAgICAgICAgLy93aG9tc3QgYXV0b21hdGljYWxseSBoYW5kbGVzIGJvdGggZ3JvdXAgbmFtZXMgYW5kIG51bWVyaWNhbCBnaWRzXG4gICAgICAgIGNvbnN0IHVuaXhTb2NrZXRHcm91cEluZm8gPSB3aG9tc3Quc3luYy5ncm91cCh1bml4U29ja2V0R3JvdXApO1xuICAgICAgICBpZiAodW5peFNvY2tldEdyb3VwSW5mbyA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBVTklYX1NPQ0tFVF9HUk9VUCBuYW1lIHNwZWNpZmllZCcpO1xuICAgICAgICB9XG4gICAgICAgIGNob3duU3luYyh1bml4U29ja2V0UGF0aCwgdXNlckluZm8oKS51aWQsIHVuaXhTb2NrZXRHcm91cEluZm8uZ2lkKTtcbiAgICAgIH1cblxuICAgICAgcmVnaXN0ZXJTb2NrZXRGaWxlQ2xlYW51cCh1bml4U29ja2V0UGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvY2FsUG9ydCA9IGlzTmFOKE51bWJlcihsb2NhbFBvcnQpKSA/IGxvY2FsUG9ydCA6IE51bWJlcihsb2NhbFBvcnQpO1xuICAgICAgaWYgKC9cXFxcXFxcXD8uK1xcXFxwaXBlXFxcXD8uKy8udGVzdChsb2NhbFBvcnQpKSB7XG4gICAgICAgIC8vIFN0YXJ0IHRoZSBIVFRQIHNlcnZlciB1c2luZyBXaW5kb3dzIFNlcnZlciBzdHlsZSBuYW1lZCBwaXBlLlxuICAgICAgICBzdGFydEh0dHBTZXJ2ZXIoeyBwYXRoOiBsb2NhbFBvcnQgfSk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBsb2NhbFBvcnQgPT09ICdudW1iZXInKSB7XG4gICAgICAgIC8vIFN0YXJ0IHRoZSBIVFRQIHNlcnZlciB1c2luZyBUQ1AuXG4gICAgICAgIHN0YXJ0SHR0cFNlcnZlcih7XG4gICAgICAgICAgcG9ydDogbG9jYWxQb3J0LFxuICAgICAgICAgIGhvc3Q6IHByb2Nlc3MuZW52LkJJTkRfSVAgfHwgJzAuMC4wLjAnLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBQT1JUIHNwZWNpZmllZCcpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiAnREFFTU9OJztcbiAgfTtcbn1cblxudmFyIGlubGluZVNjcmlwdHNBbGxvd2VkID0gdHJ1ZTtcblxuV2ViQXBwSW50ZXJuYWxzLmlubGluZVNjcmlwdHNBbGxvd2VkID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBpbmxpbmVTY3JpcHRzQWxsb3dlZDtcbn07XG5cbldlYkFwcEludGVybmFscy5zZXRJbmxpbmVTY3JpcHRzQWxsb3dlZCA9IGFzeW5jIGZ1bmN0aW9uKHZhbHVlKSB7XG4gIGlubGluZVNjcmlwdHNBbGxvd2VkID0gdmFsdWU7XG4gIGF3YWl0IFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG59O1xuXG52YXIgc3JpTW9kZTtcblxuV2ViQXBwSW50ZXJuYWxzLmVuYWJsZVN1YnJlc291cmNlSW50ZWdyaXR5ID0gYXN5bmMgZnVuY3Rpb24odXNlX2NyZWRlbnRpYWxzID0gZmFsc2UpIHtcbiAgc3JpTW9kZSA9IHVzZV9jcmVkZW50aWFscyA/ICd1c2UtY3JlZGVudGlhbHMnIDogJ2Fub255bW91cyc7XG4gIGF3YWl0IFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG59O1xuXG5XZWJBcHBJbnRlcm5hbHMuc2V0QnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2sgPSBhc3luYyBmdW5jdGlvbihob29rRm4pIHtcbiAgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2sgPSBob29rRm47XG4gIGF3YWl0IFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlKCk7XG59O1xuXG5XZWJBcHBJbnRlcm5hbHMuc2V0QnVuZGxlZEpzQ3NzUHJlZml4ID0gYXN5bmMgZnVuY3Rpb24ocHJlZml4KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgYXdhaXQgc2VsZi5zZXRCdW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayhmdW5jdGlvbih1cmwpIHtcbiAgICByZXR1cm4gcHJlZml4ICsgdXJsO1xuICB9KTtcbn07XG5cbi8vIFBhY2thZ2VzIGNhbiBjYWxsIGBXZWJBcHBJbnRlcm5hbHMuYWRkU3RhdGljSnNgIHRvIHNwZWNpZnkgc3RhdGljXG4vLyBKYXZhU2NyaXB0IHRvIGJlIGluY2x1ZGVkIGluIHRoZSBhcHAuIFRoaXMgc3RhdGljIEpTIHdpbGwgYmUgaW5saW5lZCxcbi8vIHVubGVzcyBpbmxpbmUgc2NyaXB0cyBoYXZlIGJlZW4gZGlzYWJsZWQsIGluIHdoaWNoIGNhc2UgaXQgd2lsbCBiZVxuLy8gc2VydmVkIHVuZGVyIGAvPHNoYTEgb2YgY29udGVudHM+YC5cbnZhciBhZGRpdGlvbmFsU3RhdGljSnMgPSB7fTtcbldlYkFwcEludGVybmFscy5hZGRTdGF0aWNKcyA9IGZ1bmN0aW9uKGNvbnRlbnRzKSB7XG4gIGFkZGl0aW9uYWxTdGF0aWNKc1snLycgKyBzaGExKGNvbnRlbnRzKSArICcuanMnXSA9IGNvbnRlbnRzO1xufTtcblxuLy8gRXhwb3J0ZWQgZm9yIHRlc3RzXG5XZWJBcHBJbnRlcm5hbHMuZ2V0Qm9pbGVycGxhdGUgPSBnZXRCb2lsZXJwbGF0ZTtcbldlYkFwcEludGVybmFscy5hZGRpdGlvbmFsU3RhdGljSnMgPSBhZGRpdGlvbmFsU3RhdGljSnM7XG5cbmF3YWl0IHJ1bldlYkFwcFNlcnZlcigpO1xuXG4iLCJpbXBvcnQgeyBzdGF0U3luYywgdW5saW5rU3luYywgZXhpc3RzU3luYyB9IGZyb20gJ2ZzJztcblxuLy8gU2luY2UgYSBuZXcgc29ja2V0IGZpbGUgd2lsbCBiZSBjcmVhdGVkIHdoZW4gdGhlIEhUVFAgc2VydmVyXG4vLyBzdGFydHMgdXAsIGlmIGZvdW5kIHJlbW92ZSB0aGUgZXhpc3RpbmcgZmlsZS5cbi8vXG4vLyBXQVJOSU5HOlxuLy8gVGhpcyB3aWxsIHJlbW92ZSB0aGUgY29uZmlndXJlZCBzb2NrZXQgZmlsZSB3aXRob3V0IHdhcm5pbmcuIElmXG4vLyB0aGUgY29uZmlndXJlZCBzb2NrZXQgZmlsZSBpcyBhbHJlYWR5IGluIHVzZSBieSBhbm90aGVyIGFwcGxpY2F0aW9uLFxuLy8gaXQgd2lsbCBzdGlsbCBiZSByZW1vdmVkLiBOb2RlIGRvZXMgbm90IHByb3ZpZGUgYSByZWxpYWJsZSB3YXkgdG9cbi8vIGRpZmZlcmVudGlhdGUgYmV0d2VlbiBhIHNvY2tldCBmaWxlIHRoYXQgaXMgYWxyZWFkeSBpbiB1c2UgYnlcbi8vIGFub3RoZXIgYXBwbGljYXRpb24gb3IgYSBzdGFsZSBzb2NrZXQgZmlsZSB0aGF0IGhhcyBiZWVuXG4vLyBsZWZ0IG92ZXIgYWZ0ZXIgYSBTSUdLSUxMLiBTaW5jZSB3ZSBoYXZlIG5vIHJlbGlhYmxlIHdheSB0b1xuLy8gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIHRoZXNlIHR3byBzY2VuYXJpb3MsIHRoZSBiZXN0IGNvdXJzZSBvZlxuLy8gYWN0aW9uIGR1cmluZyBzdGFydHVwIGlzIHRvIHJlbW92ZSBhbnkgZXhpc3Rpbmcgc29ja2V0IGZpbGUuIFRoaXNcbi8vIGlzIG5vdCB0aGUgc2FmZXN0IGNvdXJzZSBvZiBhY3Rpb24gYXMgcmVtb3ZpbmcgdGhlIGV4aXN0aW5nIHNvY2tldFxuLy8gZmlsZSBjb3VsZCBpbXBhY3QgYW4gYXBwbGljYXRpb24gdXNpbmcgaXQsIGJ1dCB0aGlzIGFwcHJvYWNoIGhlbHBzXG4vLyBlbnN1cmUgdGhlIEhUVFAgc2VydmVyIGNhbiBzdGFydHVwIHdpdGhvdXQgbWFudWFsXG4vLyBpbnRlcnZlbnRpb24gKGUuZy4gYXNraW5nIGZvciB0aGUgdmVyaWZpY2F0aW9uIGFuZCBjbGVhbnVwIG9mIHNvY2tldFxuLy8gZmlsZXMgYmVmb3JlIGFsbG93aW5nIHRoZSBIVFRQIHNlcnZlciB0byBiZSBzdGFydGVkKS5cbi8vXG4vLyBUaGUgYWJvdmUgYmVpbmcgc2FpZCwgYXMgbG9uZyBhcyB0aGUgc29ja2V0IGZpbGUgcGF0aCBpc1xuLy8gY29uZmlndXJlZCBjYXJlZnVsbHkgd2hlbiB0aGUgYXBwbGljYXRpb24gaXMgZGVwbG95ZWQgKGFuZCBleHRyYVxuLy8gY2FyZSBpcyB0YWtlbiB0byBtYWtlIHN1cmUgdGhlIGNvbmZpZ3VyZWQgcGF0aCBpcyB1bmlxdWUgYW5kIGRvZXNuJ3Rcbi8vIGNvbmZsaWN0IHdpdGggYW5vdGhlciBzb2NrZXQgZmlsZSBwYXRoKSwgdGhlbiB0aGVyZSBzaG91bGQgbm90IGJlXG4vLyBhbnkgaXNzdWVzIHdpdGggdGhpcyBhcHByb2FjaC5cbmV4cG9ydCBjb25zdCByZW1vdmVFeGlzdGluZ1NvY2tldEZpbGUgPSAoc29ja2V0UGF0aCkgPT4ge1xuICB0cnkge1xuICAgIGlmIChzdGF0U3luYyhzb2NrZXRQYXRoKS5pc1NvY2tldCgpKSB7XG4gICAgICAvLyBTaW5jZSBhIG5ldyBzb2NrZXQgZmlsZSB3aWxsIGJlIGNyZWF0ZWQsIHJlbW92ZSB0aGUgZXhpc3RpbmdcbiAgICAgIC8vIGZpbGUuXG4gICAgICB1bmxpbmtTeW5jKHNvY2tldFBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBBbiBleGlzdGluZyBmaWxlIHdhcyBmb3VuZCBhdCBcIiR7c29ja2V0UGF0aH1cIiBhbmQgaXQgaXMgbm90IGAgK1xuICAgICAgICAnYSBzb2NrZXQgZmlsZS4gUGxlYXNlIGNvbmZpcm0gUE9SVCBpcyBwb2ludGluZyB0byB2YWxpZCBhbmQgJyArXG4gICAgICAgICd1bi11c2VkIHNvY2tldCBmaWxlIHBhdGguJ1xuICAgICAgKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gZXhpc3Rpbmcgc29ja2V0IGZpbGUgdG8gY2xlYW51cCwgZ3JlYXQsIHdlJ2xsXG4gICAgLy8gY29udGludWUgbm9ybWFsbHkuIElmIHRoZSBjYXVnaHQgZXhjZXB0aW9uIHJlcHJlc2VudHMgYW55IG90aGVyXG4gICAgLy8gaXNzdWUsIHJlLXRocm93LlxuICAgIGlmIChlcnJvci5jb2RlICE9PSAnRU5PRU5UJykge1xuICAgICAgdGhyb3cgZXJyb3I7XG4gICAgfVxuICB9XG59O1xuXG4vLyBSZW1vdmUgdGhlIHNvY2tldCBmaWxlIHdoZW4gZG9uZSB0byBhdm9pZCBsZWF2aW5nIGJlaGluZCBhIHN0YWxlIG9uZS5cbi8vIE5vdGUgLSBhIHN0YWxlIHNvY2tldCBmaWxlIGlzIHN0aWxsIGxlZnQgYmVoaW5kIGlmIHRoZSBydW5uaW5nIG5vZGVcbi8vIHByb2Nlc3MgaXMga2lsbGVkIHZpYSBzaWduYWwgOSAtIFNJR0tJTEwuXG5leHBvcnQgY29uc3QgcmVnaXN0ZXJTb2NrZXRGaWxlQ2xlYW51cCA9XG4gIChzb2NrZXRQYXRoLCBldmVudEVtaXR0ZXIgPSBwcm9jZXNzKSA9PiB7XG4gICAgWydleGl0JywgJ1NJR0lOVCcsICdTSUdIVVAnLCAnU0lHVEVSTSddLmZvckVhY2goc2lnbmFsID0+IHtcbiAgICAgIGV2ZW50RW1pdHRlci5vbihzaWduYWwsIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoKCkgPT4ge1xuICAgICAgICBpZiAoZXhpc3RzU3luYyhzb2NrZXRQYXRoKSkge1xuICAgICAgICAgIHVubGlua1N5bmMoc29ja2V0UGF0aCk7XG4gICAgICAgIH1cbiAgICAgIH0pKTtcbiAgICB9KTtcbiAgfTtcbiJdfQ==
