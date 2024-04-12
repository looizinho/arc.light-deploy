Package["core-runtime"].queue("ddp-server", ["meteor", "check", "random", "ejson", "underscore", "retry", "mongo-id", "diff-sequence", "ecmascript", "ddp-common", "ddp-client", "webapp", "routepolicy", "callback-hook", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var _ = Package.underscore._;
var Retry = Package.retry.Retry;
var MongoID = Package['mongo-id'].MongoID;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var ECMAScript = Package.ecmascript.ECMAScript;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DDP = Package['ddp-client'].DDP;
var WebApp = Package.webapp.WebApp;
var WebAppInternals = Package.webapp.WebAppInternals;
var main = Package.webapp.main;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var StreamServer, DDPServer, id, Server;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-server":{"stream_server.js":function module(require){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/stream_server.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// By default, we use the permessage-deflate extension with default
// configuration. If $SERVER_WEBSOCKET_COMPRESSION is set, then it must be valid
// JSON. If it represents a falsey value, then we do not use permessage-deflate
// at all; otherwise, the JSON value is used as an argument to deflate's
// configure method; see
// https://github.com/faye/permessage-deflate-node/blob/master/README.md
//
// (We do this in an _.once instead of at startup, because we don't want to
// crash the tool during isopacket load if your JSON doesn't parse. This is only
// a problem because the tool has to load the DDP server code just in order to
// be a DDP client; see https://github.com/meteor/meteor/issues/3452 .)
var websocketExtensions = _.once(function () {
  var extensions = [];
  var websocketCompressionConfig = process.env.SERVER_WEBSOCKET_COMPRESSION ? JSON.parse(process.env.SERVER_WEBSOCKET_COMPRESSION) : {};
  if (websocketCompressionConfig) {
    extensions.push(Npm.require('permessage-deflate').configure(websocketCompressionConfig));
  }
  return extensions;
});
var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || "";
StreamServer = function () {
  var self = this;
  self.registration_callbacks = [];
  self.open_sockets = [];

  // Because we are installing directly onto WebApp.httpServer instead of using
  // WebApp.app, we have to process the path prefix ourselves.
  self.prefix = pathPrefix + '/sockjs';
  RoutePolicy.declare(self.prefix + '/', 'network');

  // set up sockjs
  var sockjs = Npm.require('sockjs');
  var serverOptions = {
    prefix: self.prefix,
    log: function () {},
    // this is the default, but we code it explicitly because we depend
    // on it in stream_client:HEARTBEAT_TIMEOUT
    heartbeat_delay: 45000,
    // The default disconnect_delay is 5 seconds, but if the server ends up CPU
    // bound for that much time, SockJS might not notice that the user has
    // reconnected because the timer (of disconnect_delay ms) can fire before
    // SockJS processes the new connection. Eventually we'll fix this by not
    // combining CPU-heavy processing with SockJS termination (eg a proxy which
    // converts to Unix sockets) but for now, raise the delay.
    disconnect_delay: 60 * 1000,
    // Allow disabling of CORS requests to address
    // https://github.com/meteor/meteor/issues/8317.
    disable_cors: !!process.env.DISABLE_SOCKJS_CORS,
    // Set the USE_JSESSIONID environment variable to enable setting the
    // JSESSIONID cookie. This is useful for setting up proxies with
    // session affinity.
    jsessionid: !!process.env.USE_JSESSIONID
  };

  // If you know your server environment (eg, proxies) will prevent websockets
  // from ever working, set $DISABLE_WEBSOCKETS and SockJS clients (ie,
  // browsers) will not waste time attempting to use them.
  // (Your server will still have a /websocket endpoint.)
  if (process.env.DISABLE_WEBSOCKETS) {
    serverOptions.websocket = false;
  } else {
    serverOptions.faye_server_options = {
      extensions: websocketExtensions()
    };
  }
  self.server = sockjs.createServer(serverOptions);

  // Install the sockjs handlers, but we want to keep around our own particular
  // request handler that adjusts idle timeouts while we have an outstanding
  // request.  This compensates for the fact that sockjs removes all listeners
  // for "request" to add its own.
  WebApp.httpServer.removeListener('request', WebApp._timeoutAdjustmentRequestCallback);
  self.server.installHandlers(WebApp.httpServer);
  WebApp.httpServer.addListener('request', WebApp._timeoutAdjustmentRequestCallback);

  // Support the /websocket endpoint
  self._redirectWebsocketEndpoint();
  self.server.on('connection', function (socket) {
    // sockjs sometimes passes us null instead of a socket object
    // so we need to guard against that. see:
    // https://github.com/sockjs/sockjs-node/issues/121
    // https://github.com/meteor/meteor/issues/10468
    if (!socket) return;

    // We want to make sure that if a client connects to us and does the initial
    // Websocket handshake but never gets to the DDP handshake, that we
    // eventually kill the socket.  Once the DDP handshake happens, DDP
    // heartbeating will work. And before the Websocket handshake, the timeouts
    // we set at the server level in webapp_server.js will work. But
    // faye-websocket calls setTimeout(0) on any socket it takes over, so there
    // is an "in between" state where this doesn't happen.  We work around this
    // by explicitly setting the socket timeout to a relatively large time here,
    // and setting it back to zero when we set up the heartbeat in
    // livedata_server.js.
    socket.setWebsocketTimeout = function (timeout) {
      if ((socket.protocol === 'websocket' || socket.protocol === 'websocket-raw') && socket._session.recv) {
        socket._session.recv.connection.setTimeout(timeout);
      }
    };
    socket.setWebsocketTimeout(45 * 1000);
    socket.send = function (data) {
      socket.write(data);
    };
    socket.on('close', function () {
      self.open_sockets = _.without(self.open_sockets, socket);
    });
    self.open_sockets.push(socket);

    // only to send a message after connection on tests, useful for
    // socket-stream-client/server-tests.js
    if (process.env.TEST_METADATA && process.env.TEST_METADATA !== "{}") {
      socket.send(JSON.stringify({
        testMessageOnConnect: true
      }));
    }

    // call all our callbacks when we get a new socket. they will do the
    // work of setting up handlers and such for specific messages.
    _.each(self.registration_callbacks, function (callback) {
      callback(socket);
    });
  });
};
Object.assign(StreamServer.prototype, {
  // call my callback when a new socket connects.
  // also call it for all current connections.
  register: function (callback) {
    var self = this;
    self.registration_callbacks.push(callback);
    _.each(self.all_sockets(), function (socket) {
      callback(socket);
    });
  },
  // get a list of all sockets
  all_sockets: function () {
    var self = this;
    return _.values(self.open_sockets);
  },
  // Redirect /websocket to /sockjs/websocket in order to not expose
  // sockjs to clients that want to use raw websockets
  _redirectWebsocketEndpoint: function () {
    var self = this;
    // Unfortunately we can't use a connect middleware here since
    // sockjs installs itself prior to all existing listeners
    // (meaning prior to any connect middlewares) so we need to take
    // an approach similar to overshadowListeners in
    // https://github.com/sockjs/sockjs-node/blob/cf820c55af6a9953e16558555a31decea554f70e/src/utils.coffee
    ['request', 'upgrade'].forEach(event => {
      var httpServer = WebApp.httpServer;
      var oldHttpServerListeners = httpServer.listeners(event).slice(0);
      httpServer.removeAllListeners(event);

      // request and upgrade have different arguments passed but
      // we only care about the first one which is always request
      var newListener = function (request /*, moreArguments */) {
        // Store arguments for use within the closure below
        var args = arguments;

        // TODO replace with url package
        var url = Npm.require('url');

        // Rewrite /websocket and /websocket/ urls to /sockjs/websocket while
        // preserving query string.
        var parsedUrl = url.parse(request.url);
        if (parsedUrl.pathname === pathPrefix + '/websocket' || parsedUrl.pathname === pathPrefix + '/websocket/') {
          parsedUrl.pathname = self.prefix + '/websocket';
          request.url = url.format(parsedUrl);
        }
        _.each(oldHttpServerListeners, function (oldListener) {
          oldListener.apply(httpServer, args);
        });
      };
      httpServer.addListener(event, newListener);
    });
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/livedata_server.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    DDPServer = {};

    // Publication strategies define how we handle data from published cursors at the collection level
    // This allows someone to:
    // - Choose a trade-off between client-server bandwidth and server memory usage
    // - Implement special (non-mongo) collections like volatile message queues
    const publicationStrategies = {
      // SERVER_MERGE is the default strategy.
      // When using this strategy, the server maintains a copy of all data a connection is subscribed to.
      // This allows us to only send deltas over multiple publications.
      SERVER_MERGE: {
        useDummyDocumentView: false,
        useCollectionView: true,
        doAccountingForCollection: true
      },
      // The NO_MERGE_NO_HISTORY strategy results in the server sending all publication data
      // directly to the client. It does not remember what it has previously sent
      // to it will not trigger removed messages when a subscription is stopped.
      // This should only be chosen for special use cases like send-and-forget queues.
      NO_MERGE_NO_HISTORY: {
        useDummyDocumentView: false,
        useCollectionView: false,
        doAccountingForCollection: false
      },
      // NO_MERGE is similar to NO_MERGE_NO_HISTORY but the server will remember the IDs it has
      // sent to the client so it can remove them when a subscription is stopped.
      // This strategy can be used when a collection is only used in a single publication.
      NO_MERGE: {
        useDummyDocumentView: false,
        useCollectionView: false,
        doAccountingForCollection: true
      },
      // NO_MERGE_MULTI is similar to `NO_MERGE`, but it does track whether a document is
      // used by multiple publications. This has some memory overhead, but it still does not do
      // diffing so it's faster and slimmer than SERVER_MERGE.
      NO_MERGE_MULTI: {
        useDummyDocumentView: true,
        useCollectionView: true,
        doAccountingForCollection: true
      }
    };
    DDPServer.publicationStrategies = publicationStrategies;

    // This file contains classes:
    // * Session - The server's connection to a single DDP client
    // * Subscription - A single subscription for a single client
    // * Server - An entire server that may talk to > 1 client. A DDP endpoint.
    //
    // Session and Subscription are file scope. For now, until we freeze
    // the interface, Server is package scope (in the future it should be
    // exported).
    var DummyDocumentView = function () {
      var self = this;
      self.existsIn = new Set(); // set of subscriptionHandle
      self.dataByKey = new Map(); // key-> [ {subscriptionHandle, value} by precedence]
    };
    Object.assign(DummyDocumentView.prototype, {
      getFields: function () {
        return {};
      },
      clearField: function (subscriptionHandle, key, changeCollector) {
        changeCollector[key] = undefined;
      },
      changeField: function (subscriptionHandle, key, value, changeCollector, isAdd) {
        changeCollector[key] = value;
      }
    });

    // Represents a single document in a SessionCollectionView
    var SessionDocumentView = function () {
      var self = this;
      self.existsIn = new Set(); // set of subscriptionHandle
      self.dataByKey = new Map(); // key-> [ {subscriptionHandle, value} by precedence]
    };
    DDPServer._SessionDocumentView = SessionDocumentView;
    DDPServer._getCurrentFence = function () {
      let currentInvocation = this._CurrentWriteFence.get();
      if (currentInvocation) {
        return currentInvocation;
      }
      currentInvocation = DDP._CurrentMethodInvocation.get();
      return currentInvocation ? currentInvocation.fence : undefined;
    };
    _.extend(SessionDocumentView.prototype, {
      getFields: function () {
        var self = this;
        var ret = {};
        self.dataByKey.forEach(function (precedenceList, key) {
          ret[key] = precedenceList[0].value;
        });
        return ret;
      },
      clearField: function (subscriptionHandle, key, changeCollector) {
        var self = this;
        // Publish API ignores _id if present in fields
        if (key === "_id") return;
        var precedenceList = self.dataByKey.get(key);

        // It's okay to clear fields that didn't exist. No need to throw
        // an error.
        if (!precedenceList) return;
        var removedValue = undefined;
        for (var i = 0; i < precedenceList.length; i++) {
          var precedence = precedenceList[i];
          if (precedence.subscriptionHandle === subscriptionHandle) {
            // The view's value can only change if this subscription is the one that
            // used to have precedence.
            if (i === 0) removedValue = precedence.value;
            precedenceList.splice(i, 1);
            break;
          }
        }
        if (precedenceList.length === 0) {
          self.dataByKey.delete(key);
          changeCollector[key] = undefined;
        } else if (removedValue !== undefined && !EJSON.equals(removedValue, precedenceList[0].value)) {
          changeCollector[key] = precedenceList[0].value;
        }
      },
      changeField: function (subscriptionHandle, key, value, changeCollector, isAdd) {
        var self = this;
        // Publish API ignores _id if present in fields
        if (key === "_id") return;

        // Don't share state with the data passed in by the user.
        value = EJSON.clone(value);
        if (!self.dataByKey.has(key)) {
          self.dataByKey.set(key, [{
            subscriptionHandle: subscriptionHandle,
            value: value
          }]);
          changeCollector[key] = value;
          return;
        }
        var precedenceList = self.dataByKey.get(key);
        var elt;
        if (!isAdd) {
          elt = precedenceList.find(function (precedence) {
            return precedence.subscriptionHandle === subscriptionHandle;
          });
        }
        if (elt) {
          if (elt === precedenceList[0] && !EJSON.equals(value, elt.value)) {
            // this subscription is changing the value of this field.
            changeCollector[key] = value;
          }
          elt.value = value;
        } else {
          // this subscription is newly caring about this field
          precedenceList.push({
            subscriptionHandle: subscriptionHandle,
            value: value
          });
        }
      }
    });

    /**
     * Represents a client's view of a single collection
     * @param {String} collectionName Name of the collection it represents
     * @param {Object.<String, Function>} sessionCallbacks The callbacks for added, changed, removed
     * @class SessionCollectionView
     */
    var SessionCollectionView = function (collectionName, sessionCallbacks) {
      var self = this;
      self.collectionName = collectionName;
      self.documents = new Map();
      self.callbacks = sessionCallbacks;
    };
    DDPServer._SessionCollectionView = SessionCollectionView;
    Object.assign(SessionCollectionView.prototype, {
      isEmpty: function () {
        var self = this;
        return self.documents.size === 0;
      },
      diff: function (previous) {
        var self = this;
        DiffSequence.diffMaps(previous.documents, self.documents, {
          both: _.bind(self.diffDocument, self),
          rightOnly: function (id, nowDV) {
            self.callbacks.added(self.collectionName, id, nowDV.getFields());
          },
          leftOnly: function (id, prevDV) {
            self.callbacks.removed(self.collectionName, id);
          }
        });
      },
      diffDocument: function (id, prevDV, nowDV) {
        var self = this;
        var fields = {};
        DiffSequence.diffObjects(prevDV.getFields(), nowDV.getFields(), {
          both: function (key, prev, now) {
            if (!EJSON.equals(prev, now)) fields[key] = now;
          },
          rightOnly: function (key, now) {
            fields[key] = now;
          },
          leftOnly: function (key, prev) {
            fields[key] = undefined;
          }
        });
        self.callbacks.changed(self.collectionName, id, fields);
      },
      added: function (subscriptionHandle, id, fields) {
        var self = this;
        var docView = self.documents.get(id);
        var added = false;
        if (!docView) {
          added = true;
          if (Meteor.server.getPublicationStrategy(this.collectionName).useDummyDocumentView) {
            docView = new DummyDocumentView();
          } else {
            docView = new SessionDocumentView();
          }
          self.documents.set(id, docView);
        }
        docView.existsIn.add(subscriptionHandle);
        var changeCollector = {};
        _.each(fields, function (value, key) {
          docView.changeField(subscriptionHandle, key, value, changeCollector, true);
        });
        if (added) self.callbacks.added(self.collectionName, id, changeCollector);else self.callbacks.changed(self.collectionName, id, changeCollector);
      },
      changed: function (subscriptionHandle, id, changed) {
        var self = this;
        var changedResult = {};
        var docView = self.documents.get(id);
        if (!docView) throw new Error("Could not find element with id " + id + " to change");
        _.each(changed, function (value, key) {
          if (value === undefined) docView.clearField(subscriptionHandle, key, changedResult);else docView.changeField(subscriptionHandle, key, value, changedResult);
        });
        self.callbacks.changed(self.collectionName, id, changedResult);
      },
      removed: function (subscriptionHandle, id) {
        var self = this;
        var docView = self.documents.get(id);
        if (!docView) {
          var err = new Error("Removed nonexistent document " + id);
          throw err;
        }
        docView.existsIn.delete(subscriptionHandle);
        if (docView.existsIn.size === 0) {
          // it is gone from everyone
          self.callbacks.removed(self.collectionName, id);
          self.documents.delete(id);
        } else {
          var changed = {};
          // remove this subscription from every precedence list
          // and record the changes
          docView.dataByKey.forEach(function (precedenceList, key) {
            docView.clearField(subscriptionHandle, key, changed);
          });
          self.callbacks.changed(self.collectionName, id, changed);
        }
      }
    });

    /******************************************************************************/
    /* Session                                                                    */
    /******************************************************************************/

    var Session = function (server, version, socket, options) {
      var self = this;
      self.id = Random.id();
      self.server = server;
      self.version = version;
      self.initialized = false;
      self.socket = socket;

      // Set to null when the session is destroyed. Multiple places below
      // use this to determine if the session is alive or not.
      self.inQueue = new Meteor._DoubleEndedQueue();
      self.blocked = false;
      self.workerRunning = false;
      self.cachedUnblock = null;

      // Sub objects for active subscriptions
      self._namedSubs = new Map();
      self._universalSubs = [];
      self.userId = null;
      self.collectionViews = new Map();

      // Set this to false to not send messages when collectionViews are
      // modified. This is done when rerunning subs in _setUserId and those messages
      // are calculated via a diff instead.
      self._isSending = true;

      // If this is true, don't start a newly-created universal publisher on this
      // session. The session will take care of starting it when appropriate.
      self._dontStartNewUniversalSubs = false;

      // When we are rerunning subscriptions, any ready messages
      // we want to buffer up for when we are done rerunning subscriptions
      self._pendingReady = [];

      // List of callbacks to call when this connection is closed.
      self._closeCallbacks = [];

      // XXX HACK: If a sockjs connection, save off the URL. This is
      // temporary and will go away in the near future.
      self._socketUrl = socket.url;

      // Allow tests to disable responding to pings.
      self._respondToPings = options.respondToPings;

      // This object is the public interface to the session. In the public
      // API, it is called the `connection` object.  Internally we call it
      // a `connectionHandle` to avoid ambiguity.
      self.connectionHandle = {
        id: self.id,
        close: function () {
          self.close();
        },
        onClose: function (fn) {
          var cb = Meteor.bindEnvironment(fn, "connection onClose callback");
          if (self.inQueue) {
            self._closeCallbacks.push(cb);
          } else {
            // if we're already closed, call the callback.
            Meteor.defer(cb);
          }
        },
        clientAddress: self._clientAddress(),
        httpHeaders: self.socket.headers
      };
      self.send({
        msg: 'connected',
        session: self.id
      });

      // On initial connect, spin up all the universal publishers.
      self.startUniversalSubs();
      if (version !== 'pre1' && options.heartbeatInterval !== 0) {
        // We no longer need the low level timeout because we have heartbeats.
        socket.setWebsocketTimeout(0);
        self.heartbeat = new DDPCommon.Heartbeat({
          heartbeatInterval: options.heartbeatInterval,
          heartbeatTimeout: options.heartbeatTimeout,
          onTimeout: function () {
            self.close();
          },
          sendPing: function () {
            self.send({
              msg: 'ping'
            });
          }
        });
        self.heartbeat.start();
      }
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", 1);
    };
    Object.assign(Session.prototype, {
      _checkPublishPromiseBeforeSend(f) {
        if (!this._publishCursorPromise) {
          f();
          return;
        }
        this._publishCursorPromise.finally(() => f());
      },
      sendReady: function (subscriptionIds) {
        var self = this;
        if (self._isSending) {
          self.send({
            msg: "ready",
            subs: subscriptionIds
          });
        } else {
          _.each(subscriptionIds, function (subscriptionId) {
            self._pendingReady.push(subscriptionId);
          });
        }
      },
      _canSend(collectionName) {
        return this._isSending || !this.server.getPublicationStrategy(collectionName).useCollectionView;
      },
      sendAdded(collectionName, id, fields) {
        if (this._canSend(collectionName)) {
          this.send({
            msg: 'added',
            collection: collectionName,
            id,
            fields
          });
        }
      },
      sendChanged(collectionName, id, fields) {
        if (_.isEmpty(fields)) return;
        if (this._canSend(collectionName)) {
          this.send({
            msg: "changed",
            collection: collectionName,
            id,
            fields
          });
        }
      },
      sendRemoved(collectionName, id) {
        if (this._canSend(collectionName)) {
          this.send({
            msg: "removed",
            collection: collectionName,
            id
          });
        }
      },
      getSendCallbacks: function () {
        var self = this;
        return {
          added: _.bind(self.sendAdded, self),
          changed: _.bind(self.sendChanged, self),
          removed: _.bind(self.sendRemoved, self)
        };
      },
      getCollectionView: function (collectionName) {
        var self = this;
        var ret = self.collectionViews.get(collectionName);
        if (!ret) {
          ret = new SessionCollectionView(collectionName, self.getSendCallbacks());
          self.collectionViews.set(collectionName, ret);
        }
        return ret;
      },
      added(subscriptionHandle, collectionName, id, fields) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.added(subscriptionHandle, id, fields);
        } else {
          this.sendAdded(collectionName, id, fields);
        }
      },
      removed(subscriptionHandle, collectionName, id) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.removed(subscriptionHandle, id);
          if (view.isEmpty()) {
            this.collectionViews.delete(collectionName);
          }
        } else {
          this.sendRemoved(collectionName, id);
        }
      },
      changed(subscriptionHandle, collectionName, id, fields) {
        if (this.server.getPublicationStrategy(collectionName).useCollectionView) {
          const view = this.getCollectionView(collectionName);
          view.changed(subscriptionHandle, id, fields);
        } else {
          this.sendChanged(collectionName, id, fields);
        }
      },
      startUniversalSubs: function () {
        var self = this;
        // Make a shallow copy of the set of universal handlers and start them. If
        // additional universal publishers start while we're running them (due to
        // yielding), they will run separately as part of Server.publish.
        var handlers = _.clone(self.server.universal_publish_handlers);
        _.each(handlers, function (handler) {
          self._startSubscription(handler);
        });
      },
      // Destroy this session and unregister it at the server.
      close: function () {
        var self = this;

        // Destroy this session, even if it's not registered at the
        // server. Stop all processing and tear everything down. If a socket
        // was attached, close it.

        // Already destroyed.
        if (!self.inQueue) return;

        // Drop the merge box data immediately.
        self.inQueue = null;
        self.collectionViews = new Map();
        if (self.heartbeat) {
          self.heartbeat.stop();
          self.heartbeat = null;
        }
        if (self.socket) {
          self.socket.close();
          self.socket._meteorSession = null;
        }
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "sessions", -1);
        Meteor.defer(function () {
          // Stop callbacks can yield, so we defer this on close.
          // sub._isDeactivated() detects that we set inQueue to null and
          // treats it as semi-deactivated (it will ignore incoming callbacks, etc).
          self._deactivateAllSubscriptions();

          // Defer calling the close callbacks, so that the caller closing
          // the session isn't waiting for all the callbacks to complete.
          _.each(self._closeCallbacks, function (callback) {
            callback();
          });
        });

        // Unregister the session.
        self.server._removeSession(self);
      },
      // Send a message (doing nothing if no socket is connected right now).
      // It should be a JSON object (it will be stringified).
      send: function (msg) {
        const self = this;
        this._checkPublishPromiseBeforeSend(() => {
          if (self.socket) {
            if (Meteor._printSentDDP) Meteor._debug('Sent DDP', DDPCommon.stringifyDDP(msg));
            self.socket.send(DDPCommon.stringifyDDP(msg));
          }
        });
      },
      // Send a connection error.
      sendError: function (reason, offendingMessage) {
        var self = this;
        var msg = {
          msg: 'error',
          reason: reason
        };
        if (offendingMessage) msg.offendingMessage = offendingMessage;
        self.send(msg);
      },
      // Process 'msg' as an incoming message. As a guard against
      // race conditions during reconnection, ignore the message if
      // 'socket' is not the currently connected socket.
      //
      // We run the messages from the client one at a time, in the order
      // given by the client. The message handler is passed an idempotent
      // function 'unblock' which it may call to allow other messages to
      // begin running in parallel in another fiber (for example, a method
      // that wants to yield). Otherwise, it is automatically unblocked
      // when it returns.
      //
      // Actually, we don't have to 'totally order' the messages in this
      // way, but it's the easiest thing that's correct. (unsub needs to
      // be ordered against sub, methods need to be ordered against each
      // other).
      processMessage: function (msg_in) {
        var self = this;
        if (!self.inQueue)
          // we have been destroyed.
          return;

        // Respond to ping and pong messages immediately without queuing.
        // If the negotiated DDP version is "pre1" which didn't support
        // pings, preserve the "pre1" behavior of responding with a "bad
        // request" for the unknown messages.
        //
        // Fibers are needed because heartbeats use Meteor.setTimeout, which
        // needs a Fiber. We could actually use regular setTimeout and avoid
        // these new fibers, but it is easier to just make everything use
        // Meteor.setTimeout and not think too hard.
        //
        // Any message counts as receiving a pong, as it demonstrates that
        // the client is still alive.
        if (self.heartbeat) {
          self.heartbeat.messageReceived();
        }
        ;
        if (self.version !== 'pre1' && msg_in.msg === 'ping') {
          if (self._respondToPings) self.send({
            msg: "pong",
            id: msg_in.id
          });
          return;
        }
        if (self.version !== 'pre1' && msg_in.msg === 'pong') {
          // Since everything is a pong, there is nothing to do
          return;
        }
        self.inQueue.push(msg_in);
        if (self.workerRunning) return;
        self.workerRunning = true;
        var processNext = function () {
          var msg = self.inQueue && self.inQueue.shift();
          if (!msg) {
            self.workerRunning = false;
            return;
          }
          function runHandlers() {
            var blocked = true;
            var unblock = function () {
              if (!blocked) return; // idempotent
              blocked = false;
              processNext();
            };
            self.server.onMessageHook.each(function (callback) {
              callback(msg, self);
              return true;
            });
            if (_.has(self.protocol_handlers, msg.msg)) {
              const result = self.protocol_handlers[msg.msg].call(self, msg, unblock);
              if (Meteor._isPromise(result)) {
                result.finally(() => unblock());
              } else {
                unblock();
              }
            } else {
              self.sendError('Bad request', msg);
              unblock(); // in case the handler didn't already do it
            }
          }
          runHandlers();
        };
        processNext();
      },
      protocol_handlers: {
        sub: async function (msg, unblock) {
          var self = this;

          // cacheUnblock temporarly, so we can capture it later
          // we will use unblock in current eventLoop, so this is safe
          self.cachedUnblock = unblock;

          // reject malformed messages
          if (typeof msg.id !== "string" || typeof msg.name !== "string" || 'params' in msg && !(msg.params instanceof Array)) {
            self.sendError("Malformed subscription", msg);
            return;
          }
          if (!self.server.publish_handlers[msg.name]) {
            self.send({
              msg: 'nosub',
              id: msg.id,
              error: new Meteor.Error(404, "Subscription '".concat(msg.name, "' not found"))
            });
            return;
          }
          if (self._namedSubs.has(msg.id))
            // subs are idempotent, or rather, they are ignored if a sub
            // with that id already exists. this is important during
            // reconnect.
            return;

          // XXX It'd be much better if we had generic hooks where any package can
          // hook into subscription handling, but in the mean while we special case
          // ddp-rate-limiter package. This is also done for weak requirements to
          // add the ddp-rate-limiter package in case we don't have Accounts. A
          // user trying to use the ddp-rate-limiter must explicitly require it.
          if (Package['ddp-rate-limiter']) {
            var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
            var rateLimiterInput = {
              userId: self.userId,
              clientAddress: self.connectionHandle.clientAddress,
              type: "subscription",
              name: msg.name,
              connectionId: self.id
            };
            DDPRateLimiter._increment(rateLimiterInput);
            var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
            if (!rateLimitResult.allowed) {
              self.send({
                msg: 'nosub',
                id: msg.id,
                error: new Meteor.Error('too-many-requests', DDPRateLimiter.getErrorMessage(rateLimitResult), {
                  timeToReset: rateLimitResult.timeToReset
                })
              });
              return;
            }
          }
          var handler = self.server.publish_handlers[msg.name];
          await self._startSubscription(handler, msg.id, msg.params, msg.name);

          // cleaning cached unblock
          self.cachedUnblock = null;
        },
        unsub: function (msg) {
          var self = this;
          self._stopSubscription(msg.id);
        },
        method: async function (msg, unblock) {
          var self = this;

          // Reject malformed messages.
          // For now, we silently ignore unknown attributes,
          // for forwards compatibility.
          if (typeof msg.id !== "string" || typeof msg.method !== "string" || 'params' in msg && !(msg.params instanceof Array) || 'randomSeed' in msg && typeof msg.randomSeed !== "string") {
            self.sendError("Malformed method invocation", msg);
            return;
          }
          var randomSeed = msg.randomSeed || null;

          // Set up to mark the method as satisfied once all observers
          // (and subscriptions) have reacted to any writes that were
          // done.
          var fence = new DDPServer._WriteFence();
          fence.onAllCommitted(function () {
            // Retire the fence so that future writes are allowed.
            // This means that callbacks like timers are free to use
            // the fence, and if they fire before it's armed (for
            // example, because the method waits for them) their
            // writes will be included in the fence.
            fence.retire();
            self.send({
              msg: 'updated',
              methods: [msg.id]
            });
          });

          // Find the handler
          var handler = self.server.method_handlers[msg.method];
          if (!handler) {
            self.send({
              msg: 'result',
              id: msg.id,
              error: new Meteor.Error(404, "Method '".concat(msg.method, "' not found"))
            });
            await fence.arm();
            return;
          }
          var setUserId = function (userId) {
            self._setUserId(userId);
          };
          var invocation = new DDPCommon.MethodInvocation({
            isSimulation: false,
            userId: self.userId,
            setUserId: setUserId,
            unblock: unblock,
            connection: self.connectionHandle,
            randomSeed: randomSeed,
            fence
          });
          const promise = new Promise((resolve, reject) => {
            // XXX It'd be better if we could hook into method handlers better but
            // for now, we need to check if the ddp-rate-limiter exists since we
            // have a weak requirement for the ddp-rate-limiter package to be added
            // to our application.
            if (Package['ddp-rate-limiter']) {
              var DDPRateLimiter = Package['ddp-rate-limiter'].DDPRateLimiter;
              var rateLimiterInput = {
                userId: self.userId,
                clientAddress: self.connectionHandle.clientAddress,
                type: "method",
                name: msg.method,
                connectionId: self.id
              };
              DDPRateLimiter._increment(rateLimiterInput);
              var rateLimitResult = DDPRateLimiter._check(rateLimiterInput);
              if (!rateLimitResult.allowed) {
                reject(new Meteor.Error("too-many-requests", DDPRateLimiter.getErrorMessage(rateLimitResult), {
                  timeToReset: rateLimitResult.timeToReset
                }));
                return;
              }
            }
            const getCurrentMethodInvocationResult = () => DDP._CurrentMethodInvocation.withValue(invocation, () => maybeAuditArgumentChecks(handler, invocation, msg.params, "call to '" + msg.method + "'"), {
              name: 'getCurrentMethodInvocationResult',
              keyName: 'getCurrentMethodInvocationResult'
            });
            resolve(DDPServer._CurrentWriteFence.withValue(fence, getCurrentMethodInvocationResult, {
              name: 'DDPServer._CurrentWriteFence',
              keyName: '_CurrentWriteFence'
            }));
          });
          async function finish() {
            await fence.arm();
            unblock();
          }
          const payload = {
            msg: "result",
            id: msg.id
          };
          return promise.then(async result => {
            await finish();
            if (result !== undefined) {
              payload.result = result;
            }
            self.send(payload);
          }, async exception => {
            await finish();
            payload.error = wrapInternalException(exception, "while invoking method '".concat(msg.method, "'"));
            self.send(payload);
          });
        }
      },
      _eachSub: function (f) {
        var self = this;
        self._namedSubs.forEach(f);
        self._universalSubs.forEach(f);
      },
      _diffCollectionViews: function (beforeCVs) {
        var self = this;
        DiffSequence.diffMaps(beforeCVs, self.collectionViews, {
          both: function (collectionName, leftValue, rightValue) {
            rightValue.diff(leftValue);
          },
          rightOnly: function (collectionName, rightValue) {
            rightValue.documents.forEach(function (docView, id) {
              self.sendAdded(collectionName, id, docView.getFields());
            });
          },
          leftOnly: function (collectionName, leftValue) {
            leftValue.documents.forEach(function (doc, id) {
              self.sendRemoved(collectionName, id);
            });
          }
        });
      },
      // Sets the current user id in all appropriate contexts and reruns
      // all subscriptions
      _setUserId: function (userId) {
        var self = this;
        if (userId !== null && typeof userId !== "string") throw new Error("setUserId must be called on string or null, not " + typeof userId);

        // Prevent newly-created universal subscriptions from being added to our
        // session. They will be found below when we call startUniversalSubs.
        //
        // (We don't have to worry about named subscriptions, because we only add
        // them when we process a 'sub' message. We are currently processing a
        // 'method' message, and the method did not unblock, because it is illegal
        // to call setUserId after unblock. Thus we cannot be concurrently adding a
        // new named subscription).
        self._dontStartNewUniversalSubs = true;

        // Prevent current subs from updating our collectionViews and call their
        // stop callbacks. This may yield.
        self._eachSub(function (sub) {
          sub._deactivate();
        });

        // All subs should now be deactivated. Stop sending messages to the client,
        // save the state of the published collections, reset to an empty view, and
        // update the userId.
        self._isSending = false;
        var beforeCVs = self.collectionViews;
        self.collectionViews = new Map();
        self.userId = userId;

        // _setUserId is normally called from a Meteor method with
        // DDP._CurrentMethodInvocation set. But DDP._CurrentMethodInvocation is not
        // expected to be set inside a publish function, so we temporary unset it.
        // Inside a publish function DDP._CurrentPublicationInvocation is set.
        DDP._CurrentMethodInvocation.withValue(undefined, function () {
          // Save the old named subs, and reset to having no subscriptions.
          var oldNamedSubs = self._namedSubs;
          self._namedSubs = new Map();
          self._universalSubs = [];
          oldNamedSubs.forEach(function (sub, subscriptionId) {
            var newSub = sub._recreate();
            self._namedSubs.set(subscriptionId, newSub);
            // nb: if the handler throws or calls this.error(), it will in fact
            // immediately send its 'nosub'. This is OK, though.
            newSub._runHandler();
          });

          // Allow newly-created universal subs to be started on our connection in
          // parallel with the ones we're spinning up here, and spin up universal
          // subs.
          self._dontStartNewUniversalSubs = false;
          self.startUniversalSubs();
        }, {
          name: '_setUserId'
        });

        // Start sending messages again, beginning with the diff from the previous
        // state of the world to the current state. No yields are allowed during
        // this diff, so that other changes cannot interleave.
        Meteor._noYieldsAllowed(function () {
          self._isSending = true;
          self._diffCollectionViews(beforeCVs);
          if (!_.isEmpty(self._pendingReady)) {
            self.sendReady(self._pendingReady);
            self._pendingReady = [];
          }
        });
      },
      _startSubscription: function (handler, subId, params, name) {
        var self = this;
        var sub = new Subscription(self, handler, subId, params, name);
        let unblockHander = self.cachedUnblock;
        // _startSubscription may call from a lot places
        // so cachedUnblock might be null in somecases
        // assign the cachedUnblock
        sub.unblock = unblockHander || (() => {});
        if (subId) self._namedSubs.set(subId, sub);else self._universalSubs.push(sub);
        return sub._runHandler();
      },
      // Tear down specified subscription
      _stopSubscription: function (subId, error) {
        var self = this;
        var subName = null;
        if (subId) {
          var maybeSub = self._namedSubs.get(subId);
          if (maybeSub) {
            subName = maybeSub._name;
            maybeSub._removeAllDocuments();
            maybeSub._deactivate();
            self._namedSubs.delete(subId);
          }
        }
        var response = {
          msg: 'nosub',
          id: subId
        };
        if (error) {
          response.error = wrapInternalException(error, subName ? "from sub " + subName + " id " + subId : "from sub id " + subId);
        }
        self.send(response);
      },
      // Tear down all subscriptions. Note that this does NOT send removed or nosub
      // messages, since we assume the client is gone.
      _deactivateAllSubscriptions: function () {
        var self = this;
        self._namedSubs.forEach(function (sub, id) {
          sub._deactivate();
        });
        self._namedSubs = new Map();
        self._universalSubs.forEach(function (sub) {
          sub._deactivate();
        });
        self._universalSubs = [];
      },
      // Determine the remote client's IP address, based on the
      // HTTP_FORWARDED_COUNT environment variable representing how many
      // proxies the server is behind.
      _clientAddress: function () {
        var self = this;

        // For the reported client address for a connection to be correct,
        // the developer must set the HTTP_FORWARDED_COUNT environment
        // variable to an integer representing the number of hops they
        // expect in the `x-forwarded-for` header. E.g., set to "1" if the
        // server is behind one proxy.
        //
        // This could be computed once at startup instead of every time.
        var httpForwardedCount = parseInt(process.env['HTTP_FORWARDED_COUNT']) || 0;
        if (httpForwardedCount === 0) return self.socket.remoteAddress;
        var forwardedFor = self.socket.headers["x-forwarded-for"];
        if (!_.isString(forwardedFor)) return null;
        forwardedFor = forwardedFor.trim().split(/\s*,\s*/);

        // Typically the first value in the `x-forwarded-for` header is
        // the original IP address of the client connecting to the first
        // proxy.  However, the end user can easily spoof the header, in
        // which case the first value(s) will be the fake IP address from
        // the user pretending to be a proxy reporting the original IP
        // address value.  By counting HTTP_FORWARDED_COUNT back from the
        // end of the list, we ensure that we get the IP address being
        // reported by *our* first proxy.

        if (httpForwardedCount < 0 || httpForwardedCount > forwardedFor.length) return null;
        return forwardedFor[forwardedFor.length - httpForwardedCount];
      }
    });

    /******************************************************************************/
    /* Subscription                                                               */
    /******************************************************************************/

    // Ctor for a sub handle: the input to each publish function

    // Instance name is this because it's usually referred to as this inside a
    // publish
    /**
     * @summary The server's side of a subscription
     * @class Subscription
     * @instanceName this
     * @showInstanceName true
     */
    var Subscription = function (session, handler, subscriptionId, params, name) {
      var self = this;
      self._session = session; // type is Session

      /**
       * @summary Access inside the publish function. The incoming [connection](#meteor_onconnection) for this subscription.
       * @locus Server
       * @name  connection
       * @memberOf Subscription
       * @instance
       */
      self.connection = session.connectionHandle; // public API object

      self._handler = handler;

      // My subscription ID (generated by client, undefined for universal subs).
      self._subscriptionId = subscriptionId;
      // Undefined for universal subs
      self._name = name;
      self._params = params || [];

      // Only named subscriptions have IDs, but we need some sort of string
      // internally to keep track of all subscriptions inside
      // SessionDocumentViews. We use this subscriptionHandle for that.
      if (self._subscriptionId) {
        self._subscriptionHandle = 'N' + self._subscriptionId;
      } else {
        self._subscriptionHandle = 'U' + Random.id();
      }

      // Has _deactivate been called?
      self._deactivated = false;

      // Stop callbacks to g/c this sub.  called w/ zero arguments.
      self._stopCallbacks = [];

      // The set of (collection, documentid) that this subscription has
      // an opinion about.
      self._documents = new Map();

      // Remember if we are ready.
      self._ready = false;

      // Part of the public API: the user of this sub.

      /**
       * @summary Access inside the publish function. The id of the logged-in user, or `null` if no user is logged in.
       * @locus Server
       * @memberOf Subscription
       * @name  userId
       * @instance
       */
      self.userId = session.userId;

      // For now, the id filter is going to default to
      // the to/from DDP methods on MongoID, to
      // specifically deal with mongo/minimongo ObjectIds.

      // Later, you will be able to make this be "raw"
      // if you want to publish a collection that you know
      // just has strings for keys and no funny business, to
      // a DDP consumer that isn't minimongo.

      self._idFilter = {
        idStringify: MongoID.idStringify,
        idParse: MongoID.idParse
      };
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", 1);
    };
    Object.assign(Subscription.prototype, {
      _runHandler: async function () {
        // XXX should we unblock() here? Either before running the publish
        // function, or before running _publishCursor.
        //
        // Right now, each publish function blocks all future publishes and
        // methods waiting on data from Mongo (or whatever else the function
        // blocks on). This probably slows page load in common cases.

        if (!this.unblock) {
          this.unblock = () => {};
        }
        const self = this;
        let resultOrThenable = null;
        try {
          resultOrThenable = DDP._CurrentPublicationInvocation.withValue(self, () => maybeAuditArgumentChecks(self._handler, self, EJSON.clone(self._params),
          // It's OK that this would look weird for universal subscriptions,
          // because they have no arguments so there can never be an
          // audit-argument-checks failure.
          "publisher '" + self._name + "'"), {
            name: self._name
          });
        } catch (e) {
          self.error(e);
          return;
        }

        // Did the handler call this.error or this.stop?
        if (self._isDeactivated()) return;

        // Both conventional and async publish handler functions are supported.
        // If an object is returned with a then() function, it is either a promise
        // or thenable and will be resolved asynchronously.
        const isThenable = resultOrThenable && typeof resultOrThenable.then === 'function';
        if (isThenable) {
          try {
            self._publishHandlerResult(await resultOrThenable);
          } catch (e) {
            self.error(e);
          }
        } else {
          self._publishHandlerResult(resultOrThenable);
        }
      },
      _publishHandlerResult: function (res) {
        // SPECIAL CASE: Instead of writing their own callbacks that invoke
        // this.added/changed/ready/etc, the user can just return a collection
        // cursor or array of cursors from the publish function; we call their
        // _publishCursor method which starts observing the cursor and publishes the
        // results. Note that _publishCursor does NOT call ready().
        //
        // XXX This uses an undocumented interface which only the Mongo cursor
        // interface publishes. Should we make this interface public and encourage
        // users to implement it themselves? Arguably, it's unnecessary; users can
        // already write their own functions like
        //   var publishMyReactiveThingy = function (name, handler) {
        //     Meteor.publish(name, function () {
        //       var reactiveThingy = handler();
        //       reactiveThingy.publishMe();
        //     });
        //   };

        var self = this;
        var isCursor = function (c) {
          return c && c._publishCursor;
        };
        if (isCursor(res)) {
          this._publishCursorPromise = res._publishCursor(self).then(() => {
            // _publishCursor only returns after the initial added callbacks have run.
            // mark subscription as ready.
            self.ready();
          }).catch(e => self.error(e));
        } else if (_.isArray(res)) {
          // Check all the elements are cursors
          if (!_.all(res, isCursor)) {
            self.error(new Error("Publish function returned an array of non-Cursors"));
            return;
          }
          // Find duplicate collection names
          // XXX we should support overlapping cursors, but that would require the
          // merge box to allow overlap within a subscription
          var collectionNames = {};
          for (var i = 0; i < res.length; ++i) {
            var collectionName = res[i]._getCollectionName();
            if (_.has(collectionNames, collectionName)) {
              self.error(new Error("Publish function returned multiple cursors for collection " + collectionName));
              return;
            }
            collectionNames[collectionName] = true;
          }
          ;
          this._publishCursorPromise = Promise.all(res.map(c => c._publishCursor(self))).then(() => {
            self.ready();
          }).catch(e => self.error(e));
        } else if (res) {
          // Truthy values other than cursors or arrays are probably a
          // user mistake (possible returning a Mongo document via, say,
          // `coll.findOne()`).
          self.error(new Error("Publish function can only return a Cursor or " + "an array of Cursors"));
        }
      },
      // This calls all stop callbacks and prevents the handler from updating any
      // SessionCollectionViews further. It's used when the user unsubscribes or
      // disconnects, as well as during setUserId re-runs. It does *NOT* send
      // removed messages for the published objects; if that is necessary, call
      // _removeAllDocuments first.
      _deactivate: function () {
        var self = this;
        if (self._deactivated) return;
        self._deactivated = true;
        self._callStopCallbacks();
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("livedata", "subscriptions", -1);
      },
      _callStopCallbacks: function () {
        var self = this;
        // Tell listeners, so they can clean up
        var callbacks = self._stopCallbacks;
        self._stopCallbacks = [];
        _.each(callbacks, function (callback) {
          callback();
        });
      },
      // Send remove messages for every document.
      _removeAllDocuments: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._documents.forEach(function (collectionDocs, collectionName) {
            collectionDocs.forEach(function (strId) {
              self.removed(collectionName, self._idFilter.idParse(strId));
            });
          });
        });
      },
      // Returns a new Subscription for the same session with the same
      // initial creation parameters. This isn't a clone: it doesn't have
      // the same _documents cache, stopped state or callbacks; may have a
      // different _subscriptionHandle, and gets its userId from the
      // session, not from this object.
      _recreate: function () {
        var self = this;
        return new Subscription(self._session, self._handler, self._subscriptionId, self._params, self._name);
      },
      /**
       * @summary Call inside the publish function.  Stops this client's subscription, triggering a call on the client to the `onStop` callback passed to [`Meteor.subscribe`](#meteor_subscribe), if any. If `error` is not a [`Meteor.Error`](#meteor_error), it will be [sanitized](#meteor_error).
       * @locus Server
       * @param {Error} error The error to pass to the client.
       * @instance
       * @memberOf Subscription
       */
      error: function (error) {
        var self = this;
        if (self._isDeactivated()) return;
        self._session._stopSubscription(self._subscriptionId, error);
      },
      // Note that while our DDP client will notice that you've called stop() on the
      // server (and clean up its _subscriptions table) we don't actually provide a
      // mechanism for an app to notice this (the subscribe onError callback only
      // triggers if there is an error).

      /**
       * @summary Call inside the publish function.  Stops this client's subscription and invokes the client's `onStop` callback with no error.
       * @locus Server
       * @instance
       * @memberOf Subscription
       */
      stop: function () {
        var self = this;
        if (self._isDeactivated()) return;
        self._session._stopSubscription(self._subscriptionId);
      },
      /**
       * @summary Call inside the publish function.  Registers a callback function to run when the subscription is stopped.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {Function} func The callback function
       */
      onStop: function (callback) {
        var self = this;
        callback = Meteor.bindEnvironment(callback, 'onStop callback', self);
        if (self._isDeactivated()) callback();else self._stopCallbacks.push(callback);
      },
      // This returns true if the sub has been deactivated, *OR* if the session was
      // destroyed but the deferred call to _deactivateAllSubscriptions hasn't
      // happened yet.
      _isDeactivated: function () {
        var self = this;
        return self._deactivated || self._session.inQueue === null;
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document has been added to the record set.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that contains the new document.
       * @param {String} id The new document's ID.
       * @param {Object} fields The fields in the new document.  If `_id` is present it is ignored.
       */
      added(collectionName, id, fields) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
          let ids = this._documents.get(collectionName);
          if (ids == null) {
            ids = new Set();
            this._documents.set(collectionName, ids);
          }
          ids.add(id);
        }
        this._session._publishCursorPromise = this._publishCursorPromise;
        this._session.added(this._subscriptionHandle, collectionName, id, fields);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document in the record set has been modified.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that contains the changed document.
       * @param {String} id The changed document's ID.
       * @param {Object} fields The fields in the document that have changed, together with their new values.  If a field is not present in `fields` it was left unchanged; if it is present in `fields` and has a value of `undefined` it was removed from the document.  If `_id` is present it is ignored.
       */
      changed(collectionName, id, fields) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        this._session.changed(this._subscriptionHandle, collectionName, id, fields);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that a document has been removed from the record set.
       * @locus Server
       * @memberOf Subscription
       * @instance
       * @param {String} collection The name of the collection that the document has been removed from.
       * @param {String} id The ID of the document that has been removed.
       */
      removed(collectionName, id) {
        if (this._isDeactivated()) return;
        id = this._idFilter.idStringify(id);
        if (this._session.server.getPublicationStrategy(collectionName).doAccountingForCollection) {
          // We don't bother to delete sets of things in a collection if the
          // collection is empty.  It could break _removeAllDocuments.
          this._documents.get(collectionName).delete(id);
        }
        this._session.removed(this._subscriptionHandle, collectionName, id);
      },
      /**
       * @summary Call inside the publish function.  Informs the subscriber that an initial, complete snapshot of the record set has been sent.  This will trigger a call on the client to the `onReady` callback passed to  [`Meteor.subscribe`](#meteor_subscribe), if any.
       * @locus Server
       * @memberOf Subscription
       * @instance
       */
      ready: function () {
        var self = this;
        if (self._isDeactivated()) return;
        if (!self._subscriptionId) return; // Unnecessary but ignored for universal sub
        if (!self._ready) {
          self._session.sendReady([self._subscriptionId]);
          self._ready = true;
        }
      }
    });

    /******************************************************************************/
    /* Server                                                                     */
    /******************************************************************************/

    Server = function () {
      let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var self = this;

      // The default heartbeat interval is 30 seconds on the server and 35
      // seconds on the client.  Since the client doesn't need to send a
      // ping as long as it is receiving pings, this means that pings
      // normally go from the server to the client.
      //
      // Note: Troposphere depends on the ability to mutate
      // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
      self.options = _objectSpread({
        heartbeatInterval: 15000,
        heartbeatTimeout: 15000,
        // For testing, allow responding to pings to be disabled.
        respondToPings: true,
        defaultPublicationStrategy: publicationStrategies.SERVER_MERGE
      }, options);

      // Map of callbacks to call when a new connection comes in to the
      // server and completes DDP version negotiation. Use an object instead
      // of an array so we can safely remove one from the list while
      // iterating over it.
      self.onConnectionHook = new Hook({
        debugPrintExceptions: "onConnection callback"
      });

      // Map of callbacks to call when a new message comes in.
      self.onMessageHook = new Hook({
        debugPrintExceptions: "onMessage callback"
      });
      self.publish_handlers = {};
      self.universal_publish_handlers = [];
      self.method_handlers = {};
      self._publicationStrategies = {};
      self.sessions = new Map(); // map from id to session

      self.stream_server = new StreamServer();
      self.stream_server.register(function (socket) {
        // socket implements the SockJSConnection interface
        socket._meteorSession = null;
        var sendError = function (reason, offendingMessage) {
          var msg = {
            msg: 'error',
            reason: reason
          };
          if (offendingMessage) msg.offendingMessage = offendingMessage;
          socket.send(DDPCommon.stringifyDDP(msg));
        };
        socket.on('data', function (raw_msg) {
          if (Meteor._printReceivedDDP) {
            Meteor._debug("Received DDP", raw_msg);
          }
          try {
            try {
              var msg = DDPCommon.parseDDP(raw_msg);
            } catch (err) {
              sendError('Parse error');
              return;
            }
            if (msg === null || !msg.msg) {
              sendError('Bad request', msg);
              return;
            }
            if (msg.msg === 'connect') {
              if (socket._meteorSession) {
                sendError("Already connected", msg);
                return;
              }
              self._handleConnect(socket, msg);
              return;
            }
            if (!socket._meteorSession) {
              sendError('Must connect first', msg);
              return;
            }
            socket._meteorSession.processMessage(msg);
          } catch (e) {
            // XXX print stack nicely
            Meteor._debug("Internal exception while processing message", msg, e);
          }
        });
        socket.on('close', function () {
          if (socket._meteorSession) {
            socket._meteorSession.close();
          }
        });
      });
    };
    Object.assign(Server.prototype, {
      /**
       * @summary Register a callback to be called when a new DDP connection is made to the server.
       * @locus Server
       * @param {function} callback The function to call when a new DDP connection is established.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      onConnection: function (fn) {
        var self = this;
        return self.onConnectionHook.register(fn);
      },
      /**
       * @summary Set publication strategy for the given collection. Publications strategies are available from `DDPServer.publicationStrategies`. You call this method from `Meteor.server`, like `Meteor.server.setPublicationStrategy()`
       * @locus Server
       * @alias setPublicationStrategy
       * @param collectionName {String}
       * @param strategy {{useCollectionView: boolean, doAccountingForCollection: boolean}}
       * @memberOf Meteor.server
       * @importFromPackage meteor
       */
      setPublicationStrategy(collectionName, strategy) {
        if (!Object.values(publicationStrategies).includes(strategy)) {
          throw new Error("Invalid merge strategy: ".concat(strategy, " \n        for collection ").concat(collectionName));
        }
        this._publicationStrategies[collectionName] = strategy;
      },
      /**
       * @summary Gets the publication strategy for the requested collection. You call this method from `Meteor.server`, like `Meteor.server.getPublicationStrategy()`
       * @locus Server
       * @alias getPublicationStrategy
       * @param collectionName {String}
       * @memberOf Meteor.server
       * @importFromPackage meteor
       * @return {{useCollectionView: boolean, doAccountingForCollection: boolean}}
       */
      getPublicationStrategy(collectionName) {
        return this._publicationStrategies[collectionName] || this.options.defaultPublicationStrategy;
      },
      /**
       * @summary Register a callback to be called when a new DDP message is received.
       * @locus Server
       * @param {function} callback The function to call when a new DDP message is received.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      onMessage: function (fn) {
        var self = this;
        return self.onMessageHook.register(fn);
      },
      _handleConnect: function (socket, msg) {
        var self = this;

        // The connect message must specify a version and an array of supported
        // versions, and it must claim to support what it is proposing.
        if (!(typeof msg.version === 'string' && _.isArray(msg.support) && _.all(msg.support, _.isString) && _.contains(msg.support, msg.version))) {
          socket.send(DDPCommon.stringifyDDP({
            msg: 'failed',
            version: DDPCommon.SUPPORTED_DDP_VERSIONS[0]
          }));
          socket.close();
          return;
        }

        // In the future, handle session resumption: something like:
        //  socket._meteorSession = self.sessions[msg.session]
        var version = calculateVersion(msg.support, DDPCommon.SUPPORTED_DDP_VERSIONS);
        if (msg.version !== version) {
          // The best version to use (according to the client's stated preferences)
          // is not the one the client is trying to use. Inform them about the best
          // version to use.
          socket.send(DDPCommon.stringifyDDP({
            msg: 'failed',
            version: version
          }));
          socket.close();
          return;
        }

        // Yay, version matches! Create a new session.
        // Note: Troposphere depends on the ability to mutate
        // Meteor.server.options.heartbeatTimeout! This is a hack, but it's life.
        socket._meteorSession = new Session(self, version, socket, self.options);
        self.sessions.set(socket._meteorSession.id, socket._meteorSession);
        self.onConnectionHook.each(function (callback) {
          if (socket._meteorSession) callback(socket._meteorSession.connectionHandle);
          return true;
        });
      },
      /**
       * Register a publish handler function.
       *
       * @param name {String} identifier for query
       * @param handler {Function} publish handler
       * @param options {Object}
       *
       * Server will call handler function on each new subscription,
       * either when receiving DDP sub message for a named subscription, or on
       * DDP connect for a universal subscription.
       *
       * If name is null, this will be a subscription that is
       * automatically established and permanently on for all connected
       * client, instead of a subscription that can be turned on and off
       * with subscribe().
       *
       * options to contain:
       *  - (mostly internal) is_auto: true if generated automatically
       *    from an autopublish hook. this is for cosmetic purposes only
       *    (it lets us determine whether to print a warning suggesting
       *    that you turn off autopublish).
       */

      /**
       * @summary Publish a record set.
       * @memberOf Meteor
       * @importFromPackage meteor
       * @locus Server
       * @param {String|Object} name If String, name of the record set.  If Object, publications Dictionary of publish functions by name.  If `null`, the set has no name, and the record set is automatically sent to all connected clients.
       * @param {Function} func Function called on the server each time a client subscribes.  Inside the function, `this` is the publish handler object, described below.  If the client passed arguments to `subscribe`, the function is called with the same arguments.
       */
      publish: function (name, handler, options) {
        var self = this;
        if (!_.isObject(name)) {
          options = options || {};
          if (name && name in self.publish_handlers) {
            Meteor._debug("Ignoring duplicate publish named '" + name + "'");
            return;
          }
          if (Package.autopublish && !options.is_auto) {
            // They have autopublish on, yet they're trying to manually
            // pick stuff to publish. They probably should turn off
            // autopublish. (This check isn't perfect -- if you create a
            // publish before you turn on autopublish, it won't catch
            // it, but this will definitely handle the simple case where
            // you've added the autopublish package to your app, and are
            // calling publish from your app code).
            if (!self.warned_about_autopublish) {
              self.warned_about_autopublish = true;
              Meteor._debug("** You've set up some data subscriptions with Meteor.publish(), but\n" + "** you still have autopublish turned on. Because autopublish is still\n" + "** on, your Meteor.publish() calls won't have much effect. All data\n" + "** will still be sent to all clients.\n" + "**\n" + "** Turn off autopublish by removing the autopublish package:\n" + "**\n" + "**   $ meteor remove autopublish\n" + "**\n" + "** .. and make sure you have Meteor.publish() and Meteor.subscribe() calls\n" + "** for each collection that you want clients to see.\n");
            }
          }
          if (name) self.publish_handlers[name] = handler;else {
            self.universal_publish_handlers.push(handler);
            // Spin up the new publisher on any existing session too. Run each
            // session's subscription in a new Fiber, so that there's no change for
            // self.sessions to change while we're running this loop.
            self.sessions.forEach(function (session) {
              if (!session._dontStartNewUniversalSubs) {
                session._startSubscription(handler);
              }
            });
          }
        } else {
          _.each(name, function (value, key) {
            self.publish(key, value, {});
          });
        }
      },
      _removeSession: function (session) {
        var self = this;
        self.sessions.delete(session.id);
      },
      /**
       * @summary Tells if the method call came from a call or a callAsync.
       * @locus Anywhere
       * @memberOf Meteor
       * @importFromPackage meteor
       * @returns boolean
       */
      isAsyncCall: function () {
        return DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      },
      /**
       * @summary Defines functions that can be invoked over the network by clients.
       * @locus Anywhere
       * @param {Object} methods Dictionary whose keys are method names and values are functions.
       * @memberOf Meteor
       * @importFromPackage meteor
       */
      methods: function (methods) {
        var self = this;
        _.each(methods, function (func, name) {
          if (typeof func !== 'function') throw new Error("Method '" + name + "' must be a function");
          if (self.method_handlers[name]) throw new Error("A method named '" + name + "' is already defined");
          self.method_handlers[name] = func;
        });
      },
      call: function (name) {
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }
        if (args.length && typeof args[args.length - 1] === "function") {
          // If it's a function, the last argument is the result callback, not
          // a parameter to the remote method.
          var callback = args.pop();
        }
        return this.apply(name, args, callback);
      },
      // A version of the call method that always returns a Promise.
      callAsync: function (name) {
        var _args$;
        for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
          args[_key2 - 1] = arguments[_key2];
        }
        const options = (_args$ = args[0]) !== null && _args$ !== void 0 && _args$.hasOwnProperty('returnStubValue') ? args.shift() : {};
        DDP._CurrentMethodInvocation._set();
        DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(true);
        const promise = new Promise((resolve, reject) => {
          DDP._CurrentCallAsyncInvocation._set({
            name,
            hasCallAsyncParent: true
          });
          this.applyAsync(name, args, _objectSpread({
            isFromCallAsync: true
          }, options)).then(resolve).catch(reject).finally(() => {
            DDP._CurrentCallAsyncInvocation._set();
          });
        });
        return promise.finally(() => DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(false));
      },
      apply: function (name, args, options, callback) {
        // We were passed 3 arguments. They may be either (name, args, options)
        // or (name, args, callback)
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        } else {
          options = options || {};
        }
        const promise = this.applyAsync(name, args, options);

        // Return the result in whichever way the caller asked for it. Note that we
        // do NOT block on the write fence in an analogous way to how the client
        // blocks on the relevant data being visible, so you are NOT guaranteed that
        // cursor observe callbacks have fired when your callback is invoked. (We
        // can change this if there's a real use case).
        if (callback) {
          promise.then(result => callback(undefined, result), exception => callback(exception));
        } else {
          return promise;
        }
      },
      // @param options {Optional Object}
      applyAsync: function (name, args, options) {
        // Run the handler
        var handler = this.method_handlers[name];
        if (!handler) {
          return Promise.reject(new Meteor.Error(404, "Method '".concat(name, "' not found")));
        }
        // If this is a method call from within another method or publish function,
        // get the user state from the outer method or publish function, otherwise
        // don't allow setUserId to be called
        var userId = null;
        var setUserId = function () {
          throw new Error("Can't call setUserId on a server initiated method call");
        };
        var connection = null;
        var currentMethodInvocation = DDP._CurrentMethodInvocation.get();
        var currentPublicationInvocation = DDP._CurrentPublicationInvocation.get();
        var randomSeed = null;
        if (currentMethodInvocation) {
          userId = currentMethodInvocation.userId;
          setUserId = function (userId) {
            currentMethodInvocation.setUserId(userId);
          };
          connection = currentMethodInvocation.connection;
          randomSeed = DDPCommon.makeRpcSeed(currentMethodInvocation, name);
        } else if (currentPublicationInvocation) {
          userId = currentPublicationInvocation.userId;
          setUserId = function (userId) {
            currentPublicationInvocation._session._setUserId(userId);
          };
          connection = currentPublicationInvocation.connection;
        }
        var invocation = new DDPCommon.MethodInvocation({
          isSimulation: false,
          userId,
          setUserId,
          connection,
          randomSeed
        });
        return new Promise((resolve, reject) => {
          let result;
          try {
            result = DDP._CurrentMethodInvocation.withValue(invocation, () => maybeAuditArgumentChecks(handler, invocation, EJSON.clone(args), "internal call to '" + name + "'"));
          } catch (e) {
            return reject(e);
          }
          if (!Meteor._isPromise(result)) {
            return resolve(result);
          }
          result.then(r => resolve(r)).catch(reject);
        }).then(EJSON.clone);
      },
      _urlForSession: function (sessionId) {
        var self = this;
        var session = self.sessions.get(sessionId);
        if (session) return session._socketUrl;else return null;
      }
    });
    var calculateVersion = function (clientSupportedVersions, serverSupportedVersions) {
      var correctVersion = _.find(clientSupportedVersions, function (version) {
        return _.contains(serverSupportedVersions, version);
      });
      if (!correctVersion) {
        correctVersion = serverSupportedVersions[0];
      }
      return correctVersion;
    };
    DDPServer._calculateVersion = calculateVersion;

    // "blind" exceptions other than those that were deliberately thrown to signal
    // errors to the client
    var wrapInternalException = function (exception, context) {
      if (!exception) return exception;

      // To allow packages to throw errors intended for the client but not have to
      // depend on the Meteor.Error class, `isClientSafe` can be set to true on any
      // error before it is thrown.
      if (exception.isClientSafe) {
        if (!(exception instanceof Meteor.Error)) {
          const originalMessage = exception.message;
          exception = new Meteor.Error(exception.error, exception.reason, exception.details);
          exception.message = originalMessage;
        }
        return exception;
      }

      // Tests can set the '_expectedByTest' flag on an exception so it won't go to
      // the server log.
      if (!exception._expectedByTest) {
        Meteor._debug("Exception " + context, exception.stack);
        if (exception.sanitizedError) {
          Meteor._debug("Sanitized and reported to the client as:", exception.sanitizedError);
          Meteor._debug();
        }
      }

      // Did the error contain more details that could have been useful if caught in
      // server code (or if thrown from non-client-originated code), but also
      // provided a "sanitized" version with more context than 500 Internal server
      // error? Use that.
      if (exception.sanitizedError) {
        if (exception.sanitizedError.isClientSafe) return exception.sanitizedError;
        Meteor._debug("Exception " + context + " provides a sanitizedError that " + "does not have isClientSafe property set; ignoring");
      }
      return new Meteor.Error(500, "Internal server error");
    };

    // Audit argument checks, if the audit-argument-checks package exists (it is a
    // weak dependency of this package).
    var maybeAuditArgumentChecks = function (f, context, args, description) {
      args = args || [];
      if (Package['audit-argument-checks']) {
        return Match._failIfArgumentsAreNotAllChecked(f, context, args, description);
      }
      return f.apply(context, args);
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"writefence.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/writefence.js                                                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// A write fence collects a group of writes, and provides a callback
// when all of the writes are fully committed and propagated (all
// observers have been notified of the write and acknowledged it.)
//
DDPServer._WriteFence = class {
  constructor() {
    this.armed = false;
    this.fired = false;
    this.retired = false;
    this.outstanding_writes = 0;
    this.before_fire_callbacks = [];
    this.completion_callbacks = [];
  }

  // Start tracking a write, and return an object to represent it. The
  // object has a single method, committed(). This method should be
  // called when the write is fully committed and propagated. You can
  // continue to add writes to the WriteFence up until it is triggered
  // (calls its callbacks because all writes have committed.)
  beginWrite() {
    if (this.retired) return {
      committed: function () {}
    };
    if (this.fired) throw new Error("fence has already activated -- too late to add writes");
    this.outstanding_writes++;
    let committed = false;
    const _committedFn = async () => {
      if (committed) throw new Error("committed called twice on the same write");
      committed = true;
      this.outstanding_writes--;
      await this._maybeFire();
    };
    return {
      committed: _committedFn
    };
  }

  // Arm the fence. Once the fence is armed, and there are no more
  // uncommitted writes, it will activate.
  arm() {
    if (this === DDPServer._getCurrentFence()) throw Error("Can't arm the current fence");
    this.armed = true;
    return this._maybeFire();
  }

  // Register a function to be called once before firing the fence.
  // Callback function can add new writes to the fence, in which case
  // it won't fire until those writes are done as well.
  onBeforeFire(func) {
    if (this.fired) throw new Error("fence has already activated -- too late to " + "add a callback");
    this.before_fire_callbacks.push(func);
  }

  // Register a function to be called when the fence fires.
  onAllCommitted(func) {
    if (this.fired) throw new Error("fence has already activated -- too late to " + "add a callback");
    this.completion_callbacks.push(func);
  }
  async _armAndWait() {
    let resolver;
    const returnValue = new Promise(r => resolver = r);
    this.onAllCommitted(resolver);
    await this.arm();
    return returnValue;
  }
  // Convenience function. Arms the fence, then blocks until it fires.
  async armAndWait() {
    return this._armAndWait();
  }
  async _maybeFire() {
    if (this.fired) throw new Error("write fence already activated?");
    if (this.armed && !this.outstanding_writes) {
      const invokeCallback = async func => {
        try {
          await func(this);
        } catch (err) {
          Meteor._debug("exception in write fence callback:", err);
        }
      };
      this.outstanding_writes++;
      while (this.before_fire_callbacks.length > 0) {
        const cb = this.before_fire_callbacks.shift();
        await invokeCallback(cb);
      }
      this.outstanding_writes--;
      if (!this.outstanding_writes) {
        this.fired = true;
        const callbacks = this.completion_callbacks || [];
        this.completion_callbacks = [];
        while (callbacks.length > 0) {
          const cb = callbacks.shift();
          await invokeCallback(cb);
        }
      }
    }
  }

  // Deactivate this fence so that adding more writes has no effect.
  // The fence must have already fired.
  retire() {
    if (!this.fired) throw new Error("Can't retire a fence that hasn't fired.");
    this.retired = true;
  }
};

// The current write fence. When there is a current write fence, code
// that writes to databases should register their writes with it using
// beginWrite().
//
DDPServer._CurrentWriteFence = new Meteor.EnvironmentVariable();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"crossbar.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/crossbar.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// A "crossbar" is a class that provides structured notification registration.
// See _match for the definition of how a notification matches a trigger.
// All notifications and triggers must have a string key named 'collection'.

DDPServer._Crossbar = function (options) {
  var self = this;
  options = options || {};
  self.nextId = 1;
  // map from collection name (string) -> listener id -> object. each object has
  // keys 'trigger', 'callback'.  As a hack, the empty string means "no
  // collection".
  self.listenersByCollection = {};
  self.listenersByCollectionCount = {};
  self.factPackage = options.factPackage || "livedata";
  self.factName = options.factName || null;
};
_.extend(DDPServer._Crossbar.prototype, {
  // msg is a trigger or a notification
  _collectionForMessage: function (msg) {
    var self = this;
    if (!_.has(msg, 'collection')) {
      return '';
    } else if (typeof msg.collection === 'string') {
      if (msg.collection === '') throw Error("Message has empty collection!");
      return msg.collection;
    } else {
      throw Error("Message has non-string collection!");
    }
  },
  // Listen for notification that match 'trigger'. A notification
  // matches if it has the key-value pairs in trigger as a
  // subset. When a notification matches, call 'callback', passing
  // the actual notification.
  //
  // Returns a listen handle, which is an object with a method
  // stop(). Call stop() to stop listening.
  //
  // XXX It should be legal to call fire() from inside a listen()
  // callback?
  listen: function (trigger, callback) {
    var self = this;
    var id = self.nextId++;
    var collection = self._collectionForMessage(trigger);
    var record = {
      trigger: EJSON.clone(trigger),
      callback: callback
    };
    if (!_.has(self.listenersByCollection, collection)) {
      self.listenersByCollection[collection] = {};
      self.listenersByCollectionCount[collection] = 0;
    }
    self.listenersByCollection[collection][id] = record;
    self.listenersByCollectionCount[collection]++;
    if (self.factName && Package['facts-base']) {
      Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, 1);
    }
    return {
      stop: function () {
        if (self.factName && Package['facts-base']) {
          Package['facts-base'].Facts.incrementServerFact(self.factPackage, self.factName, -1);
        }
        delete self.listenersByCollection[collection][id];
        self.listenersByCollectionCount[collection]--;
        if (self.listenersByCollectionCount[collection] === 0) {
          delete self.listenersByCollection[collection];
          delete self.listenersByCollectionCount[collection];
        }
      }
    };
  },
  // Fire the provided 'notification' (an object whose attribute
  // values are all JSON-compatibile) -- inform all matching listeners
  // (registered with listen()).
  //
  // If fire() is called inside a write fence, then each of the
  // listener callbacks will be called inside the write fence as well.
  //
  // The listeners may be invoked in parallel, rather than serially.
  fire: async function (notification) {
    var self = this;
    var collection = self._collectionForMessage(notification);
    if (!_.has(self.listenersByCollection, collection)) {
      return;
    }
    var listenersForCollection = self.listenersByCollection[collection];
    var callbackIds = [];
    _.each(listenersForCollection, function (l, id) {
      if (self._matches(notification, l.trigger)) {
        callbackIds.push(id);
      }
    });

    // Listener callbacks can yield, so we need to first find all the ones that
    // match in a single iteration over self.listenersByCollection (which can't
    // be mutated during this iteration), and then invoke the matching
    // callbacks, checking before each call to ensure they haven't stopped.
    // Note that we don't have to check that
    // self.listenersByCollection[collection] still === listenersForCollection,
    // because the only way that stops being true is if listenersForCollection
    // first gets reduced down to the empty object (and then never gets
    // increased again).
    for (const id of callbackIds) {
      if (_.has(listenersForCollection, id)) {
        await listenersForCollection[id].callback(notification);
      }
    }
  },
  // A notification matches a trigger if all keys that exist in both are equal.
  //
  // Examples:
  //  N:{collection: "C"} matches T:{collection: "C"}
  //    (a non-targeted write to a collection matches a
  //     non-targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C"}
  //    (a targeted write to a collection matches a non-targeted query)
  //  N:{collection: "C"} matches T:{collection: "C", id: "X"}
  //    (a non-targeted write to a collection matches a
  //     targeted query)
  //  N:{collection: "C", id: "X"} matches T:{collection: "C", id: "X"}
  //    (a targeted write to a collection matches a targeted query targeted
  //     at the same document)
  //  N:{collection: "C", id: "X"} does not match T:{collection: "C", id: "Y"}
  //    (a targeted write to a collection does not match a targeted query
  //     targeted at a different document)
  _matches: function (notification, trigger) {
    // Most notifications that use the crossbar have a string `collection` and
    // maybe an `id` that is a string or ObjectID. We're already dividing up
    // triggers by collection, but let's fast-track "nope, different ID" (and
    // avoid the overly generic EJSON.equals). This makes a noticeable
    // performance difference; see https://github.com/meteor/meteor/pull/3697
    if (typeof notification.id === 'string' && typeof trigger.id === 'string' && notification.id !== trigger.id) {
      return false;
    }
    if (notification.id instanceof MongoID.ObjectID && trigger.id instanceof MongoID.ObjectID && !notification.id.equals(trigger.id)) {
      return false;
    }
    return _.all(trigger, function (triggerValue, key) {
      return !_.has(notification, key) || EJSON.equals(triggerValue, notification[key]);
    });
  }
});

// The "invalidation crossbar" is a specific instance used by the DDP server to
// implement write fence notifications. Listener callbacks on this crossbar
// should call beginWrite on the current write fence before they return, if they
// want to delay the write fence from firing (ie, the DDP method-data-updated
// message from being sent).
DDPServer._InvalidationCrossbar = new DDPServer._Crossbar({
  factName: "invalidation-crossbar-listeners"
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"server_convenience.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/ddp-server/server_convenience.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
if (process.env.DDP_DEFAULT_CONNECTION_URL) {
  __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL = process.env.DDP_DEFAULT_CONNECTION_URL;
}
Meteor.server = new Server();
Meteor.refresh = async function (notification) {
  await DDPServer._InvalidationCrossbar.fire(notification);
};

// Proxy the public methods of Meteor.server so they can
// be called directly on Meteor.
_.each(['publish', 'isAsyncCall', 'methods', 'call', 'callAsync', 'apply', 'applyAsync', 'onConnection', 'onMessage'], function (name) {
  Meteor[name] = _.bind(Meteor.server[name], Meteor.server);
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      DDPServer: DDPServer
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ddp-server/stream_server.js",
    "/node_modules/meteor/ddp-server/livedata_server.js",
    "/node_modules/meteor/ddp-server/writefence.js",
    "/node_modules/meteor/ddp-server/crossbar.js",
    "/node_modules/meteor/ddp-server/server_convenience.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/ddp-server.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci9zdHJlYW1fc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2xpdmVkYXRhX3NlcnZlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLXNlcnZlci93cml0ZWZlbmNlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL2Nyb3NzYmFyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtc2VydmVyL3NlcnZlcl9jb252ZW5pZW5jZS5qcyJdLCJuYW1lcyI6WyJ3ZWJzb2NrZXRFeHRlbnNpb25zIiwiXyIsIm9uY2UiLCJleHRlbnNpb25zIiwid2Vic29ja2V0Q29tcHJlc3Npb25Db25maWciLCJwcm9jZXNzIiwiZW52IiwiU0VSVkVSX1dFQlNPQ0tFVF9DT01QUkVTU0lPTiIsIkpTT04iLCJwYXJzZSIsInB1c2giLCJOcG0iLCJyZXF1aXJlIiwiY29uZmlndXJlIiwicGF0aFByZWZpeCIsIl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18iLCJST09UX1VSTF9QQVRIX1BSRUZJWCIsIlN0cmVhbVNlcnZlciIsInNlbGYiLCJyZWdpc3RyYXRpb25fY2FsbGJhY2tzIiwib3Blbl9zb2NrZXRzIiwicHJlZml4IiwiUm91dGVQb2xpY3kiLCJkZWNsYXJlIiwic29ja2pzIiwic2VydmVyT3B0aW9ucyIsImxvZyIsImhlYXJ0YmVhdF9kZWxheSIsImRpc2Nvbm5lY3RfZGVsYXkiLCJkaXNhYmxlX2NvcnMiLCJESVNBQkxFX1NPQ0tKU19DT1JTIiwianNlc3Npb25pZCIsIlVTRV9KU0VTU0lPTklEIiwiRElTQUJMRV9XRUJTT0NLRVRTIiwid2Vic29ja2V0IiwiZmF5ZV9zZXJ2ZXJfb3B0aW9ucyIsInNlcnZlciIsImNyZWF0ZVNlcnZlciIsIldlYkFwcCIsImh0dHBTZXJ2ZXIiLCJyZW1vdmVMaXN0ZW5lciIsIl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayIsImluc3RhbGxIYW5kbGVycyIsImFkZExpc3RlbmVyIiwiX3JlZGlyZWN0V2Vic29ja2V0RW5kcG9pbnQiLCJvbiIsInNvY2tldCIsInNldFdlYnNvY2tldFRpbWVvdXQiLCJ0aW1lb3V0IiwicHJvdG9jb2wiLCJfc2Vzc2lvbiIsInJlY3YiLCJjb25uZWN0aW9uIiwic2V0VGltZW91dCIsInNlbmQiLCJkYXRhIiwid3JpdGUiLCJ3aXRob3V0IiwiVEVTVF9NRVRBREFUQSIsInN0cmluZ2lmeSIsInRlc3RNZXNzYWdlT25Db25uZWN0IiwiZWFjaCIsImNhbGxiYWNrIiwiT2JqZWN0IiwiYXNzaWduIiwicHJvdG90eXBlIiwicmVnaXN0ZXIiLCJhbGxfc29ja2V0cyIsInZhbHVlcyIsImZvckVhY2giLCJldmVudCIsIm9sZEh0dHBTZXJ2ZXJMaXN0ZW5lcnMiLCJsaXN0ZW5lcnMiLCJzbGljZSIsInJlbW92ZUFsbExpc3RlbmVycyIsIm5ld0xpc3RlbmVyIiwicmVxdWVzdCIsImFyZ3MiLCJhcmd1bWVudHMiLCJ1cmwiLCJwYXJzZWRVcmwiLCJwYXRobmFtZSIsImZvcm1hdCIsIm9sZExpc3RlbmVyIiwiYXBwbHkiLCJfb2JqZWN0U3ByZWFkIiwibW9kdWxlIiwibGluayIsImRlZmF1bHQiLCJ2IiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJERFBTZXJ2ZXIiLCJwdWJsaWNhdGlvblN0cmF0ZWdpZXMiLCJTRVJWRVJfTUVSR0UiLCJ1c2VEdW1teURvY3VtZW50VmlldyIsInVzZUNvbGxlY3Rpb25WaWV3IiwiZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbiIsIk5PX01FUkdFX05PX0hJU1RPUlkiLCJOT19NRVJHRSIsIk5PX01FUkdFX01VTFRJIiwiRHVtbXlEb2N1bWVudFZpZXciLCJleGlzdHNJbiIsIlNldCIsImRhdGFCeUtleSIsIk1hcCIsImdldEZpZWxkcyIsImNsZWFyRmllbGQiLCJzdWJzY3JpcHRpb25IYW5kbGUiLCJrZXkiLCJjaGFuZ2VDb2xsZWN0b3IiLCJ1bmRlZmluZWQiLCJjaGFuZ2VGaWVsZCIsInZhbHVlIiwiaXNBZGQiLCJTZXNzaW9uRG9jdW1lbnRWaWV3IiwiX1Nlc3Npb25Eb2N1bWVudFZpZXciLCJfZ2V0Q3VycmVudEZlbmNlIiwiY3VycmVudEludm9jYXRpb24iLCJfQ3VycmVudFdyaXRlRmVuY2UiLCJnZXQiLCJERFAiLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJmZW5jZSIsImV4dGVuZCIsInJldCIsInByZWNlZGVuY2VMaXN0IiwicmVtb3ZlZFZhbHVlIiwiaSIsImxlbmd0aCIsInByZWNlZGVuY2UiLCJzcGxpY2UiLCJkZWxldGUiLCJFSlNPTiIsImVxdWFscyIsImNsb25lIiwiaGFzIiwic2V0IiwiZWx0IiwiZmluZCIsIlNlc3Npb25Db2xsZWN0aW9uVmlldyIsImNvbGxlY3Rpb25OYW1lIiwic2Vzc2lvbkNhbGxiYWNrcyIsImRvY3VtZW50cyIsImNhbGxiYWNrcyIsIl9TZXNzaW9uQ29sbGVjdGlvblZpZXciLCJpc0VtcHR5Iiwic2l6ZSIsImRpZmYiLCJwcmV2aW91cyIsIkRpZmZTZXF1ZW5jZSIsImRpZmZNYXBzIiwiYm90aCIsImJpbmQiLCJkaWZmRG9jdW1lbnQiLCJyaWdodE9ubHkiLCJpZCIsIm5vd0RWIiwiYWRkZWQiLCJsZWZ0T25seSIsInByZXZEViIsInJlbW92ZWQiLCJmaWVsZHMiLCJkaWZmT2JqZWN0cyIsInByZXYiLCJub3ciLCJjaGFuZ2VkIiwiZG9jVmlldyIsIk1ldGVvciIsImdldFB1YmxpY2F0aW9uU3RyYXRlZ3kiLCJhZGQiLCJjaGFuZ2VkUmVzdWx0IiwiRXJyb3IiLCJlcnIiLCJTZXNzaW9uIiwidmVyc2lvbiIsIm9wdGlvbnMiLCJSYW5kb20iLCJpbml0aWFsaXplZCIsImluUXVldWUiLCJfRG91YmxlRW5kZWRRdWV1ZSIsImJsb2NrZWQiLCJ3b3JrZXJSdW5uaW5nIiwiY2FjaGVkVW5ibG9jayIsIl9uYW1lZFN1YnMiLCJfdW5pdmVyc2FsU3VicyIsInVzZXJJZCIsImNvbGxlY3Rpb25WaWV3cyIsIl9pc1NlbmRpbmciLCJfZG9udFN0YXJ0TmV3VW5pdmVyc2FsU3VicyIsIl9wZW5kaW5nUmVhZHkiLCJfY2xvc2VDYWxsYmFja3MiLCJfc29ja2V0VXJsIiwiX3Jlc3BvbmRUb1BpbmdzIiwicmVzcG9uZFRvUGluZ3MiLCJjb25uZWN0aW9uSGFuZGxlIiwiY2xvc2UiLCJvbkNsb3NlIiwiZm4iLCJjYiIsImJpbmRFbnZpcm9ubWVudCIsImRlZmVyIiwiY2xpZW50QWRkcmVzcyIsIl9jbGllbnRBZGRyZXNzIiwiaHR0cEhlYWRlcnMiLCJoZWFkZXJzIiwibXNnIiwic2Vzc2lvbiIsInN0YXJ0VW5pdmVyc2FsU3VicyIsImhlYXJ0YmVhdEludGVydmFsIiwiaGVhcnRiZWF0IiwiRERQQ29tbW9uIiwiSGVhcnRiZWF0IiwiaGVhcnRiZWF0VGltZW91dCIsIm9uVGltZW91dCIsInNlbmRQaW5nIiwic3RhcnQiLCJQYWNrYWdlIiwiRmFjdHMiLCJpbmNyZW1lbnRTZXJ2ZXJGYWN0IiwiX2NoZWNrUHVibGlzaFByb21pc2VCZWZvcmVTZW5kIiwiZiIsIl9wdWJsaXNoQ3Vyc29yUHJvbWlzZSIsImZpbmFsbHkiLCJzZW5kUmVhZHkiLCJzdWJzY3JpcHRpb25JZHMiLCJzdWJzIiwic3Vic2NyaXB0aW9uSWQiLCJfY2FuU2VuZCIsInNlbmRBZGRlZCIsImNvbGxlY3Rpb24iLCJzZW5kQ2hhbmdlZCIsInNlbmRSZW1vdmVkIiwiZ2V0U2VuZENhbGxiYWNrcyIsImdldENvbGxlY3Rpb25WaWV3IiwidmlldyIsImhhbmRsZXJzIiwidW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnMiLCJoYW5kbGVyIiwiX3N0YXJ0U3Vic2NyaXB0aW9uIiwic3RvcCIsIl9tZXRlb3JTZXNzaW9uIiwiX2RlYWN0aXZhdGVBbGxTdWJzY3JpcHRpb25zIiwiX3JlbW92ZVNlc3Npb24iLCJfcHJpbnRTZW50RERQIiwiX2RlYnVnIiwic3RyaW5naWZ5RERQIiwic2VuZEVycm9yIiwicmVhc29uIiwib2ZmZW5kaW5nTWVzc2FnZSIsInByb2Nlc3NNZXNzYWdlIiwibXNnX2luIiwibWVzc2FnZVJlY2VpdmVkIiwicHJvY2Vzc05leHQiLCJzaGlmdCIsInJ1bkhhbmRsZXJzIiwidW5ibG9jayIsIm9uTWVzc2FnZUhvb2siLCJwcm90b2NvbF9oYW5kbGVycyIsInJlc3VsdCIsImNhbGwiLCJfaXNQcm9taXNlIiwic3ViIiwibmFtZSIsInBhcmFtcyIsIkFycmF5IiwicHVibGlzaF9oYW5kbGVycyIsImVycm9yIiwiY29uY2F0IiwiRERQUmF0ZUxpbWl0ZXIiLCJyYXRlTGltaXRlcklucHV0IiwidHlwZSIsImNvbm5lY3Rpb25JZCIsIl9pbmNyZW1lbnQiLCJyYXRlTGltaXRSZXN1bHQiLCJfY2hlY2siLCJhbGxvd2VkIiwiZ2V0RXJyb3JNZXNzYWdlIiwidGltZVRvUmVzZXQiLCJ1bnN1YiIsIl9zdG9wU3Vic2NyaXB0aW9uIiwibWV0aG9kIiwicmFuZG9tU2VlZCIsIl9Xcml0ZUZlbmNlIiwib25BbGxDb21taXR0ZWQiLCJyZXRpcmUiLCJtZXRob2RzIiwibWV0aG9kX2hhbmRsZXJzIiwiYXJtIiwic2V0VXNlcklkIiwiX3NldFVzZXJJZCIsImludm9jYXRpb24iLCJNZXRob2RJbnZvY2F0aW9uIiwiaXNTaW11bGF0aW9uIiwicHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZ2V0Q3VycmVudE1ldGhvZEludm9jYXRpb25SZXN1bHQiLCJ3aXRoVmFsdWUiLCJtYXliZUF1ZGl0QXJndW1lbnRDaGVja3MiLCJrZXlOYW1lIiwiZmluaXNoIiwicGF5bG9hZCIsInRoZW4iLCJleGNlcHRpb24iLCJ3cmFwSW50ZXJuYWxFeGNlcHRpb24iLCJfZWFjaFN1YiIsIl9kaWZmQ29sbGVjdGlvblZpZXdzIiwiYmVmb3JlQ1ZzIiwibGVmdFZhbHVlIiwicmlnaHRWYWx1ZSIsImRvYyIsIl9kZWFjdGl2YXRlIiwib2xkTmFtZWRTdWJzIiwibmV3U3ViIiwiX3JlY3JlYXRlIiwiX3J1bkhhbmRsZXIiLCJfbm9ZaWVsZHNBbGxvd2VkIiwic3ViSWQiLCJTdWJzY3JpcHRpb24iLCJ1bmJsb2NrSGFuZGVyIiwic3ViTmFtZSIsIm1heWJlU3ViIiwiX25hbWUiLCJfcmVtb3ZlQWxsRG9jdW1lbnRzIiwicmVzcG9uc2UiLCJodHRwRm9yd2FyZGVkQ291bnQiLCJwYXJzZUludCIsInJlbW90ZUFkZHJlc3MiLCJmb3J3YXJkZWRGb3IiLCJpc1N0cmluZyIsInRyaW0iLCJzcGxpdCIsIl9oYW5kbGVyIiwiX3N1YnNjcmlwdGlvbklkIiwiX3BhcmFtcyIsIl9zdWJzY3JpcHRpb25IYW5kbGUiLCJfZGVhY3RpdmF0ZWQiLCJfc3RvcENhbGxiYWNrcyIsIl9kb2N1bWVudHMiLCJfcmVhZHkiLCJfaWRGaWx0ZXIiLCJpZFN0cmluZ2lmeSIsIk1vbmdvSUQiLCJpZFBhcnNlIiwicmVzdWx0T3JUaGVuYWJsZSIsIl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uIiwiZSIsIl9pc0RlYWN0aXZhdGVkIiwiaXNUaGVuYWJsZSIsIl9wdWJsaXNoSGFuZGxlclJlc3VsdCIsInJlcyIsImlzQ3Vyc29yIiwiYyIsIl9wdWJsaXNoQ3Vyc29yIiwicmVhZHkiLCJjYXRjaCIsImlzQXJyYXkiLCJhbGwiLCJjb2xsZWN0aW9uTmFtZXMiLCJfZ2V0Q29sbGVjdGlvbk5hbWUiLCJtYXAiLCJfY2FsbFN0b3BDYWxsYmFja3MiLCJjb2xsZWN0aW9uRG9jcyIsInN0cklkIiwib25TdG9wIiwiaWRzIiwiU2VydmVyIiwiZGVmYXVsdFB1YmxpY2F0aW9uU3RyYXRlZ3kiLCJvbkNvbm5lY3Rpb25Ib29rIiwiSG9vayIsImRlYnVnUHJpbnRFeGNlcHRpb25zIiwiX3B1YmxpY2F0aW9uU3RyYXRlZ2llcyIsInNlc3Npb25zIiwic3RyZWFtX3NlcnZlciIsInJhd19tc2ciLCJfcHJpbnRSZWNlaXZlZEREUCIsInBhcnNlRERQIiwiX2hhbmRsZUNvbm5lY3QiLCJvbkNvbm5lY3Rpb24iLCJzZXRQdWJsaWNhdGlvblN0cmF0ZWd5Iiwic3RyYXRlZ3kiLCJpbmNsdWRlcyIsIm9uTWVzc2FnZSIsInN1cHBvcnQiLCJjb250YWlucyIsIlNVUFBPUlRFRF9ERFBfVkVSU0lPTlMiLCJjYWxjdWxhdGVWZXJzaW9uIiwicHVibGlzaCIsImlzT2JqZWN0IiwiYXV0b3B1Ymxpc2giLCJpc19hdXRvIiwid2FybmVkX2Fib3V0X2F1dG9wdWJsaXNoIiwiaXNBc3luY0NhbGwiLCJfaXNDYWxsQXN5bmNNZXRob2RSdW5uaW5nIiwiZnVuYyIsIl9sZW4iLCJfa2V5IiwicG9wIiwiY2FsbEFzeW5jIiwiX2FyZ3MkIiwiX2xlbjIiLCJfa2V5MiIsImhhc093blByb3BlcnR5IiwiX3NldCIsIl9zZXRDYWxsQXN5bmNNZXRob2RSdW5uaW5nIiwiX0N1cnJlbnRDYWxsQXN5bmNJbnZvY2F0aW9uIiwiaGFzQ2FsbEFzeW5jUGFyZW50IiwiYXBwbHlBc3luYyIsImlzRnJvbUNhbGxBc3luYyIsImN1cnJlbnRNZXRob2RJbnZvY2F0aW9uIiwiY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiIsIm1ha2VScGNTZWVkIiwiciIsIl91cmxGb3JTZXNzaW9uIiwic2Vzc2lvbklkIiwiY2xpZW50U3VwcG9ydGVkVmVyc2lvbnMiLCJzZXJ2ZXJTdXBwb3J0ZWRWZXJzaW9ucyIsImNvcnJlY3RWZXJzaW9uIiwiX2NhbGN1bGF0ZVZlcnNpb24iLCJjb250ZXh0IiwiaXNDbGllbnRTYWZlIiwib3JpZ2luYWxNZXNzYWdlIiwibWVzc2FnZSIsImRldGFpbHMiLCJfZXhwZWN0ZWRCeVRlc3QiLCJzdGFjayIsInNhbml0aXplZEVycm9yIiwiZGVzY3JpcHRpb24iLCJNYXRjaCIsIl9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwiYXN5bmMiLCJjb25zdHJ1Y3RvciIsImFybWVkIiwiZmlyZWQiLCJyZXRpcmVkIiwib3V0c3RhbmRpbmdfd3JpdGVzIiwiYmVmb3JlX2ZpcmVfY2FsbGJhY2tzIiwiY29tcGxldGlvbl9jYWxsYmFja3MiLCJiZWdpbldyaXRlIiwiY29tbWl0dGVkIiwiX2NvbW1pdHRlZEZuIiwiX21heWJlRmlyZSIsIm9uQmVmb3JlRmlyZSIsIl9hcm1BbmRXYWl0IiwicmVzb2x2ZXIiLCJyZXR1cm5WYWx1ZSIsImFybUFuZFdhaXQiLCJpbnZva2VDYWxsYmFjayIsIkVudmlyb25tZW50VmFyaWFibGUiLCJfQ3Jvc3NiYXIiLCJuZXh0SWQiLCJsaXN0ZW5lcnNCeUNvbGxlY3Rpb24iLCJsaXN0ZW5lcnNCeUNvbGxlY3Rpb25Db3VudCIsImZhY3RQYWNrYWdlIiwiZmFjdE5hbWUiLCJfY29sbGVjdGlvbkZvck1lc3NhZ2UiLCJsaXN0ZW4iLCJ0cmlnZ2VyIiwicmVjb3JkIiwiZmlyZSIsIm5vdGlmaWNhdGlvbiIsImxpc3RlbmVyc0ZvckNvbGxlY3Rpb24iLCJjYWxsYmFja0lkcyIsImwiLCJfbWF0Y2hlcyIsIk9iamVjdElEIiwidHJpZ2dlclZhbHVlIiwiX0ludmFsaWRhdGlvbkNyb3NzYmFyIiwiRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkwiLCJyZWZyZXNoIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJQSxtQkFBbUIsR0FBR0MsQ0FBQyxDQUFDQyxJQUFJLENBQUMsWUFBWTtFQUMzQyxJQUFJQyxVQUFVLEdBQUcsRUFBRTtFQUVuQixJQUFJQywwQkFBMEIsR0FBR0MsT0FBTyxDQUFDQyxHQUFHLENBQUNDLDRCQUE0QixHQUNqRUMsSUFBSSxDQUFDQyxLQUFLLENBQUNKLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDQyw0QkFBNEIsQ0FBQyxHQUFHLENBQUMsQ0FBQztFQUNqRSxJQUFJSCwwQkFBMEIsRUFBRTtJQUM5QkQsVUFBVSxDQUFDTyxJQUFJLENBQUNDLEdBQUcsQ0FBQ0MsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUNDLFNBQVMsQ0FDekRU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LENBQUNuVyxHQUFHLENBQUMsQ0FBQztJQUNqRCxDQUFDLENBQUM7RUFDSjtBQUNGLENBQUMsQ0FBQzs7QUFFRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0FqQixTQUFTLENBQUMyWCxxQkFBcUIsR0FBRyxJQUFJM1gsU0FBUyxDQUFDeVcsU0FBUyxDQUFDO0VBQ3hESyxRQUFRLEVBQUU7QUFDWixDQUFDLENBQUMsQzs7Ozs7Ozs7Ozs7QUN0S0YsSUFBSXBjLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDaWQsMEJBQTBCLEVBQUU7RUFDMUN4Yyx5QkFBeUIsQ0FBQ3djLDBCQUEwQixHQUNsRGxkLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDaWQsMEJBQTBCO0FBQzFDO0FBRUFoVCxNQUFNLENBQUNuSSxNQUFNLEdBQUcsSUFBSTJVLE1BQU0sQ0FBQyxDQUFDO0FBRTVCeE0sTUFBTSxDQUFDaVQsT0FBTyxHQUFHLGdCQUFnQlQsWUFBWSxFQUFFO0VBQzdDLE1BQU1wWCxTQUFTLENBQUMyWCxxQkFBcUIsQ0FBQ1IsSUFBSSxDQUFDQyxZQUFZLENBQUM7QUFDMUQsQ0FBQzs7QUFFRDtBQUNBO0FBQ0E5YyxDQUFDLENBQUM0RCxJQUFJLENBQ0osQ0FDRSxTQUFTLEVBQ1QsYUFBYSxFQUNiLFNBQVMsRUFDVCxNQUFNLEVBQ04sV0FBVyxFQUNYLE9BQU8sRUFDUCxZQUFZLEVBQ1osY0FBYyxFQUNkLFdBQVcsQ0FDWixFQUNELFVBQVN5TSxJQUFJLEVBQUU7RUFDYi9GLE1BQU0sQ0FBQytGLElBQUksQ0FBQyxHQUFHclEsQ0FBQyxDQUFDdUosSUFBSSxDQUFDZSxNQUFNLENBQUNuSSxNQUFNLENBQUNrTyxJQUFJLENBQUMsRUFBRS9GLE1BQU0sQ0FBQ25JLE1BQU0sQ0FBQztBQUMzRCxDQUNGLENBQUMsQyIsImZpbGUiOiIvcGFja2FnZXMvZGRwLXNlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEJ5IGRlZmF1bHQsIHdlIHVzZSB0aGUgcGVybWVzc2FnZS1kZWZsYXRlIGV4dGVuc2lvbiB3aXRoIGRlZmF1bHRcbi8vIGNvbmZpZ3VyYXRpb24uIElmICRTRVJWRVJfV0VCU09DS0VUX0NPTVBSRVNTSU9OIGlzIHNldCwgdGhlbiBpdCBtdXN0IGJlIHZhbGlkXG4vLyBKU09OLiBJZiBpdCByZXByZXNlbnRzIGEgZmFsc2V5IHZhbHVlLCB0aGVuIHdlIGRvIG5vdCB1c2UgcGVybWVzc2FnZS1kZWZsYXRlXG4vLyBhdCBhbGw7IG90aGVyd2lzZSwgdGhlIEpTT04gdmFsdWUgaXMgdXNlZCBhcyBhbiBhcmd1bWVudCB0byBkZWZsYXRlJ3Ncbi8vIGNvbmZpZ3VyZSBtZXRob2Q7IHNlZVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2ZheWUvcGVybWVzc2FnZS1kZWZsYXRlLW5vZGUvYmxvYi9tYXN0ZXIvUkVBRE1FLm1kXG4vL1xuLy8gKFdlIGRvIHRoaXMgaW4gYW4gXy5vbmNlIGluc3RlYWQgb2YgYXQgc3RhcnR1cCwgYmVjYXVzZSB3ZSBkb24ndCB3YW50IHRvXG4vLyBjcmFzaCB0aGUgdG9vbCBkdXJpbmcgaXNvcGFja2V0IGxvYWQgaWYgeW91ciBKU09OIGRvZXNuJ3QgcGFyc2UuIFRoaXMgaXMgb25seVxuLy8gYSBwcm9ibGVtIGJlY2F1c2UgdGhlIHRvb2wgaGFzIHRvIGxvYWQgdGhlIEREUCBzZXJ2ZXIgY29kZSBqdXN0IGluIG9yZGVyIHRvXG4vLyBiZSBhIEREUCBjbGllbnQ7IHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvMzQ1MiAuKVxudmFyIHdlYnNvY2tldEV4dGVuc2lvbnMgPSBfLm9uY2UoZnVuY3Rpb24gKCkge1xuICB2YXIgZXh0ZW5zaW9ucyA9IFtdO1xuXG4gIHZhciB3ZWJzb2NrZXRDb21wcmVzc2lvbkNvbmZpZyA9IHByb2Nlc3MuZW52LlNFUlZFUl9XRUJTT0NLRVRfQ09NUFJFU1NJT05cbiAgICAgICAgPyBKU09OLnBhcnNlKHByb2Nlc3MuZW52LlNFUlZFUl9XRUJTT0NLRVRfQ09NUFJFU1NJT04pIDoge307XG4gIGlmICh3ZWJzb2NrZXRDb21wcmVzc2lvbkNvbmZpZykge1xuICAgIGV4dGVuc2lvbnMucHVzaChOcG0ucmVxdWlyZSgncGVybWVzc2FnZS1kZWZsYXRlJykuY29uZmlndXJlKFxuICAgICAgd2Vic29ja2V0Q29tcHJlc3Npb25Db25maWdcbiAgICApKTtcbiAgfVxuXG4gIHJldHVybiBleHRlbnNpb25zO1xufSk7XG5cbnZhciBwYXRoUHJlZml4ID0gX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTF9QQVRIX1BSRUZJWCB8fCAgXCJcIjtcblxuU3RyZWFtU2VydmVyID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYucmVnaXN0cmF0aW9uX2NhbGxiYWNrcyA9IFtdO1xuICBzZWxmLm9wZW5fc29ja2V0cyA9IFtdO1xuXG4gIC8vIEJlY2F1c2Ugd2UgYXJlIGluc3RhbGxpbmcgZGlyZWN0bHkgb250byBXZWJBcHAuaHR0cFNlcnZlciBpbnN0ZWFkIG9mIHVzaW5nXG4gIC8vIFdlYkFwcC5hcHAsIHdlIGhhdmUgdG8gcHJvY2VzcyB0aGUgcGF0aCBwcmVmaXggb3Vyc2VsdmVzLlxuICBzZWxmLnByZWZpeCA9IHBhdGhQcmVmaXggKyAnL3NvY2tqcyc7XG4gIFJvdXRlUG9saWN5LmRlY2xhcmUoc2VsZi5wcmVmaXggKyAnLycsICduZXR3b3JrJyk7XG5cbiAgLy8gc2V0IHVwIHNvY2tqc1xuICB2YXIgc29ja2pzID0gTnBtLnJlcXVpcmUoJ3NvY2tqcycpO1xuICB2YXIgc2VydmVyT3B0aW9ucyA9IHtcbiAgICBwcmVmaXg6IHNlbGYucHJlZml4LFxuICAgIGxvZzogZnVuY3Rpb24oKSB7fSxcbiAgICAvLyB0aGlzIGlzIHRoZSBkZWZhdWx0LCBidXQgd2UgY29kZSBpdCBleHBsaWNpdGx5IGJlY2F1c2Ugd2UgZGVwZW5kXG4gICAgLy8gb24gaXQgaW4gc3RyZWFtX2NsaWVudDpIRUFSVEJFQVRfVElNRU9VVFxuICAgIGhlYXJ0YmVhdF9kZWxheTogNDUwMDAsXG4gICAgLy8gVGhlIGRlZmF1bHQgZGlzY29ubmVjdF9kZWxheSBpcyA1IHNlY29uZHMsIGJ1dCBpZiB0aGUgc2VydmVyIGVuZHMgdXAgQ1BVXG4gICAgLy8gYm91bmQgZm9yIHRoYXQgbXVjaCB0aW1lLCBTb2NrSlMgbWlnaHQgbm90IG5vdGljZSB0aGF0IHRoZSB1c2VyIGhhc1xuICAgIC8vIHJlY29ubmVjdGVkIGJlY2F1c2UgdGhlIHRpbWVyIChvZiBkaXNjb25uZWN0X2RlbGF5IG1zKSBjYW4gZmlyZSBiZWZvcmVcbiAgICAvLyBTb2NrSlMgcHJvY2Vzc2VzIHRoZSBuZXcgY29ubmVjdGlvbi4gRXZlbnR1YWxseSB3ZSdsbCBmaXggdGhpcyBieSBub3RcbiAgICAvLyBjb21iaW5pbmcgQ1BVLWhlYXZ5IHByb2Nlc3Npbmcgd2l0aCBTb2NrSlMgdGVybWluYXRpb24gKGVnIGEgcHJveHkgd2hpY2hcbiAgICAvLyBjb252ZXJ0cyB0byBVbml4IHNvY2tldHMpIGJ1dCBmb3Igbm93LCByYWlzZSB0aGUgZGVsYXkuXG4gICAgZGlzY29ubmVjdF9kZWxheTogNjAgKiAxMDAwLFxuICAgIC8vIEFsbG93IGRpc2FibGluZyBvZiBDT1JTIHJlcXVlc3RzIHRvIGFkZHJlc3NcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvODMxNy5cbiAgICBkaXNhYmxlX2NvcnM6ICEhcHJvY2Vzcy5lbnYuRElTQUJMRV9TT0NLSlNfQ09SUyxcbiAgICAvLyBTZXQgdGhlIFVTRV9KU0VTU0lPTklEIGVudmlyb25tZW50IHZhcmlhYmxlIHRvIGVuYWJsZSBzZXR0aW5nIHRoZVxuICAgIC8vIEpTRVNTSU9OSUQgY29va2llLiBUaGlzIGlzIHVzZWZ1bCBmb3Igc2V0dGluZyB1cCBwcm94aWVzIHdpdGhcbiAgICAvLyBzZXNzaW9uIGFmZmluaXR5LlxuICAgIGpzZXNzaW9uaWQ6ICEhcHJvY2Vzcy5lbnYuVVNFX0pTRVNTSU9OSURcbiAgfTtcblxuICAvLyBJZiB5b3Uga25vdyB5b3VyIHNlcnZlciBlbnZpcm9ubWVudCAoZWcsIHByb3hpZXMpIHdpbGwgcHJldmVudCB3ZWJzb2NrZXRzXG4gIC8vIGZyb20gZXZlciB3b3JraW5nLCBzZXQgJERJU0FCTEVfV0VCU09DS0VUUyBhbmQgU29ja0pTIGNsaWVudHMgKGllLFxuICAvLyBicm93c2Vycykgd2lsbCBub3Qgd2FzdGUgdGltZSBhdHRlbXB0aW5nIHRvIHVzZSB0aGVtLlxuICAvLyAoWW91ciBzZXJ2ZXIgd2lsbCBzdGlsbCBoYXZlIGEgL3dlYnNvY2tldCBlbmRwb2ludC4pXG4gIGlmIChwcm9jZXNzLmVudi5ESVNBQkxFX1dFQlNPQ0tFVFMpIHtcbiAgICBzZXJ2ZXJPcHRpb25zLndlYnNvY2tldCA9IGZhbHNlO1xuICB9IGVsc2Uge1xuICAgIHNlcnZlck9wdGlvbnMuZmF5ZV9zZXJ2ZXJfb3B0aW9ucyA9IHtcbiAgICAgIGV4dGVuc2lvbnM6IHdlYnNvY2tldEV4dGVuc2lvbnMoKVxuICAgIH07XG4gIH1cblxuICBzZWxmLnNlcnZlciA9IHNvY2tqcy5jcmVhdGVTZXJ2ZXIoc2VydmVyT3B0aW9ucyk7XG5cbiAgLy8gSW5zdGFsbCB0aGUgc29ja2pzIGhhbmRsZXJzLCBidXQgd2Ugd2FudCB0byBrZWVwIGFyb3VuZCBvdXIgb3duIHBhcnRpY3VsYXJcbiAgLy8gcmVxdWVzdCBoYW5kbGVyIHRoYXQgYWRqdXN0cyBpZGxlIHRpbWVvdXRzIHdoaWxlIHdlIGhhdmUgYW4gb3V0c3RhbmRpbmdcbiAgLy8gcmVxdWVzdC4gIFRoaXMgY29tcGVuc2F0ZXMgZm9yIHRoZSBmYWN0IHRoYXQgc29ja2pzIHJlbW92ZXMgYWxsIGxpc3RlbmVyc1xuICAvLyBmb3IgXCJyZXF1ZXN0XCIgdG8gYWRkIGl0cyBvd24uXG4gIFdlYkFwcC5odHRwU2VydmVyLnJlbW92ZUxpc3RlbmVyKFxuICAgICdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG4gIHNlbGYuc2VydmVyLmluc3RhbGxIYW5kbGVycyhXZWJBcHAuaHR0cFNlcnZlcik7XG4gIFdlYkFwcC5odHRwU2VydmVyLmFkZExpc3RlbmVyKFxuICAgICdyZXF1ZXN0JywgV2ViQXBwLl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayk7XG5cbiAgLy8gU3VwcG9ydCB0aGUgL3dlYnNvY2tldCBlbmRwb2ludFxuICBzZWxmLl9yZWRpcmVjdFdlYnNvY2tldEVuZHBvaW50KCk7XG5cbiAgc2VsZi5zZXJ2ZXIub24oJ2Nvbm5lY3Rpb24nLCBmdW5jdGlvbiAoc29ja2V0KSB7XG4gICAgLy8gc29ja2pzIHNvbWV0aW1lcyBwYXNzZXMgdXMgbnVsbCBpbnN0ZWFkIG9mIGEgc29ja2V0IG9iamVjdFxuICAgIC8vIHNvIHdlIG5lZWQgdG8gZ3VhcmQgYWdhaW5zdCB0aGF0LiBzZWU6XG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL3NvY2tqcy9zb2NranMtbm9kZS9pc3N1ZXMvMTIxXG4gICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzEwNDY4XG4gICAgaWYgKCFzb2NrZXQpIHJldHVybjtcblxuICAgIC8vIFdlIHdhbnQgdG8gbWFrZSBzdXJlIHRoYXQgaWYgYSBjbGllbnQgY29ubmVjdHMgdG8gdXMgYW5kIGRvZXMgdGhlIGluaXRpYWxcbiAgICAvLyBXZWJzb2NrZXQgaGFuZHNoYWtlIGJ1dCBuZXZlciBnZXRzIHRvIHRoZSBERFAgaGFuZHNoYWtlLCB0aGF0IHdlXG4gICAgLy8gZXZlbnR1YWxseSBraWxsIHRoZSBzb2NrZXQuICBPbmNlIHRoZSBERFAgaGFuZHNoYWtlIGhhcHBlbnMsIEREUFxuICAgIC8vIGhlYXJ0YmVhdGluZyB3aWxsIHdvcmsuIEFuZCBiZWZvcmUgdGhlIFdlYnNvY2tldCBoYW5kc2hha2UsIHRoZSB0aW1lb3V0c1xuICAgIC8vIHdlIHNldCBhdCB0aGUgc2VydmVyIGxldmVsIGluIHdlYmFwcF9zZXJ2ZXIuanMgd2lsbCB3b3JrLiBCdXRcbiAgICAvLyBmYXllLXdlYnNvY2tldCBjYWxscyBzZXRUaW1lb3V0KDApIG9uIGFueSBzb2NrZXQgaXQgdGFrZXMgb3Zlciwgc28gdGhlcmVcbiAgICAvLyBpcyBhbiBcImluIGJldHdlZW5cIiBzdGF0ZSB3aGVyZSB0aGlzIGRvZXNuJ3QgaGFwcGVuLiAgV2Ugd29yayBhcm91bmQgdGhpc1xuICAgIC8vIGJ5IGV4cGxpY2l0bHkgc2V0dGluZyB0aGUgc29ja2V0IHRpbWVvdXQgdG8gYSByZWxhdGl2ZWx5IGxhcmdlIHRpbWUgaGVyZSxcbiAgICAvLyBhbmQgc2V0dGluZyBpdCBiYWNrIHRvIHplcm8gd2hlbiB3ZSBzZXQgdXAgdGhlIGhlYXJ0YmVhdCBpblxuICAgIC8vIGxpdmVkYXRhX3NlcnZlci5qcy5cbiAgICBzb2NrZXQuc2V0V2Vic29ja2V0VGltZW91dCA9IGZ1bmN0aW9uICh0aW1lb3V0KSB7XG4gICAgICBpZiAoKHNvY2tldC5wcm90b2NvbCA9PT0gJ3dlYnNvY2tldCcgfHxcbiAgICAgICAgICAgc29ja2V0LnByb3RvY29sID09PSAnd2Vic29ja2V0LXJhdycpXG4gICAgICAgICAgJiYgc29ja2V0Ll9zZXNzaW9uLnJlY3YpIHtcbiAgICAgICAgc29ja2V0Ll9zZXNzaW9uLnJlY3YuY29ubmVjdGlvbi5zZXRUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgfVxuICAgIH07XG4gICAgc29ja2V0LnNldFdlYnNvY2tldFRpbWVvdXQoNDUgKiAxMDAwKTtcblxuICAgIHNvY2tldC5zZW5kID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgIHNvY2tldC53cml0ZShkYXRhKTtcbiAgICB9O1xuICAgIHNvY2tldC5vbignY2xvc2UnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLm9wZW5fc29ja2V0cyA9IF8ud2l0aG91dChzZWxmLm9wZW5fc29ja2V0cywgc29ja2V0KTtcbiAgICB9KTtcbiAgICBzZWxmLm9wZW5fc29ja2V0cy5wdXNoKHNvY2tldCk7XG5cbiAgICAvLyBvbmx5IHRvIHNlbmQgYSBtZXNzYWdlIGFmdGVyIGNvbm5lY3Rpb24gb24gdGVzdHMsIHVzZWZ1bCBmb3JcbiAgICAvLyBzb2NrZXQtc3RyZWFtLWNsaWVudC9zZXJ2ZXItdGVzdHMuanNcbiAgICBpZiAocHJvY2Vzcy5lbnYuVEVTVF9NRVRBREFUQSAmJiBwcm9jZXNzLmVudi5URVNUX01FVEFEQVRBICE9PSBcInt9XCIpIHtcbiAgICAgIHNvY2tldC5zZW5kKEpTT04uc3RyaW5naWZ5KHsgdGVzdE1lc3NhZ2VPbkNvbm5lY3Q6IHRydWUgfSkpO1xuICAgIH1cblxuICAgIC8vIGNhbGwgYWxsIG91ciBjYWxsYmFja3Mgd2hlbiB3ZSBnZXQgYSBuZXcgc29ja2V0LiB0aGV5IHdpbGwgZG8gdGhlXG4gICAgLy8gd29yayBvZiBzZXR0aW5nIHVwIGhhbmRsZXJzIGFuZCBzdWNoIGZvciBzcGVjaWZpYyBtZXNzYWdlcy5cbiAgICBfLmVhY2goc2VsZi5yZWdpc3RyYXRpb25fY2FsbGJhY2tzLCBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrKHNvY2tldCk7XG4gICAgfSk7XG4gIH0pO1xuXG59O1xuXG5PYmplY3QuYXNzaWduKFN0cmVhbVNlcnZlci5wcm90b3R5cGUsIHtcbiAgLy8gY2FsbCBteSBjYWxsYmFjayB3aGVuIGEgbmV3IHNvY2tldCBjb25uZWN0cy5cbiAgLy8gYWxzbyBjYWxsIGl0IGZvciBhbGwgY3VycmVudCBjb25uZWN0aW9ucy5cbiAgcmVnaXN0ZXI6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnJlZ2lzdHJhdGlvbl9jYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG4gICAgXy5lYWNoKHNlbGYuYWxsX3NvY2tldHMoKSwgZnVuY3Rpb24gKHNvY2tldCkge1xuICAgICAgY2FsbGJhY2soc29ja2V0KTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBnZXQgYSBsaXN0IG9mIGFsbCBzb2NrZXRzXG4gIGFsbF9zb2NrZXRzOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBfLnZhbHVlcyhzZWxmLm9wZW5fc29ja2V0cyk7XG4gIH0sXG5cbiAgLy8gUmVkaXJlY3QgL3dlYnNvY2tldCB0byAvc29ja2pzL3dlYnNvY2tldCBpbiBvcmRlciB0byBub3QgZXhwb3NlXG4gIC8vIHNvY2tqcyB0byBjbGllbnRzIHRoYXQgd2FudCB0byB1c2UgcmF3IHdlYnNvY2tldHNcbiAgX3JlZGlyZWN0V2Vic29ja2V0RW5kcG9pbnQ6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBVbmZvcnR1bmF0ZWx5IHdlIGNhbid0IHVzZSBhIGNvbm5lY3QgbWlkZGxld2FyZSBoZXJlIHNpbmNlXG4gICAgLy8gc29ja2pzIGluc3RhbGxzIGl0c2VsZiBwcmlvciB0byBhbGwgZXhpc3RpbmcgbGlzdGVuZXJzXG4gICAgLy8gKG1lYW5pbmcgcHJpb3IgdG8gYW55IGNvbm5lY3QgbWlkZGxld2FyZXMpIHNvIHdlIG5lZWQgdG8gdGFrZVxuICAgIC8vIGFuIGFwcHJvYWNoIHNpbWlsYXIgdG8gb3ZlcnNoYWRvd0xpc3RlbmVycyBpblxuICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9zb2NranMvc29ja2pzLW5vZGUvYmxvYi9jZjgyMGM1NWFmNmE5OTUzZTE2NTU4NTU1YTMxZGVjZWE1NTRmNzBlL3NyYy91dGlscy5jb2ZmZWVcbiAgICBbJ3JlcXVlc3QnLCAndXBncmFkZSddLmZvckVhY2goKGV2ZW50KSA9PiB7XG4gICAgICB2YXIgaHR0cFNlcnZlciA9IFdlYkFwcC5odHRwU2VydmVyO1xuICAgICAgdmFyIG9sZEh0dHBTZXJ2ZXJMaXN0ZW5lcnMgPSBodHRwU2VydmVyLmxpc3RlbmVycyhldmVudCkuc2xpY2UoMCk7XG4gICAgICBodHRwU2VydmVyLnJlbW92ZUFsbExpc3RlbmVycyhldmVudCk7XG5cbiAgICAgIC8vIHJlcXVlc3QgYW5kIHVwZ3JhZGUgaGF2ZSBkaWZmZXJlbnQgYXJndW1lbnRzIHBhc3NlZCBidXRcbiAgICAgIC8vIHdlIG9ubHkgY2FyZSBhYm91dCB0aGUgZmlyc3Qgb25lIHdoaWNoIGlzIGFsd2F5cyByZXF1ZXN0XG4gICAgICB2YXIgbmV3TGlzdGVuZXIgPSBmdW5jdGlvbihyZXF1ZXN0IC8qLCBtb3JlQXJndW1lbnRzICovKSB7XG4gICAgICAgIC8vIFN0b3JlIGFyZ3VtZW50cyBmb3IgdXNlIHdpdGhpbiB0aGUgY2xvc3VyZSBiZWxvd1xuICAgICAgICB2YXIgYXJncyA9IGFyZ3VtZW50cztcblxuICAgICAgICAvLyBUT0RPIHJlcGxhY2Ugd2l0aCB1cmwgcGFja2FnZVxuICAgICAgICB2YXIgdXJsID0gTnBtLnJlcXVpcmUoJ3VybCcpO1xuXG4gICAgICAgIC8vIFJld3JpdGUgL3dlYnNvY2tldCBhbmQgL3dlYnNvY2tldC8gdXJscyB0byAvc29ja2pzL3dlYnNvY2tldCB3aGlsZVxuICAgICAgICAvLyBwcmVzZXJ2aW5nIHF1ZXJ5IHN0cmluZy5cbiAgICAgICAgdmFyIHBhcnNlZFVybCA9IHVybC5wYXJzZShyZXF1ZXN0LnVybCk7XG4gICAgICAgIGlmIChwYXJzZWRVcmwucGF0aG5hbWUgPT09IHBhdGhQcmVmaXggKyAnL3dlYnNvY2tldCcgfHxcbiAgICAgICAgICAgIHBhcnNlZFVybC5wYXRobmFtZSA9PT0gcGF0aFByZWZpeCArICcvd2Vic29ja2V0LycpIHtcbiAgICAgICAgICBwYXJzZWRVcmwucGF0aG5hbWUgPSBzZWxmLnByZWZpeCArICcvd2Vic29ja2V0JztcbiAgICAgICAgICByZXF1ZXN0LnVybCA9IHVybC5mb3JtYXQocGFyc2VkVXJsKTtcbiAgICAgICAgfVxuICAgICAgICBfLmVhY2gob2xkSHR0cFNlcnZlckxpc3RlbmVycywgZnVuY3Rpb24ob2xkTGlzdGVuZXIpIHtcbiAgICAgICAgICBvbGRMaXN0ZW5lci5hcHBseShodHRwU2VydmVyLCBhcmdzKTtcbiAgICAgICAgfSk7XG4gICAgICB9O1xuICAgICAgaHR0cFNlcnZlci5hZGRMaXN0ZW5lcihldmVudCwgbmV3TGlzdGVuZXIpO1xuICAgIH0pO1xuICB9XG59KTtcbiIsIkREUFNlcnZlciA9IHt9O1xuXG4vLyBQdWJsaWNhdGlvbiBzdHJhdGVnaWVzIGRlZmluZSBob3cgd2UgaGFuZGxlIGRhdGEgZnJvbSBwdWJsaXNoZWQgY3Vyc29ycyBhdCB0aGUgY29sbGVjdGlvbiBsZXZlbFxuLy8gVGhpcyBhbGxvd3Mgc29tZW9uZSB0bzpcbi8vIC0gQ2hvb3NlIGEgdHJhZGUtb2ZmIGJldHdlZW4gY2xpZW50LXNlcnZlciBiYW5kd2lkdGggYW5kIHNlcnZlciBtZW1vcnkgdXNhZ2Vcbi8vIC0gSW1wbGVtZW50IHNwZWNpYWwgKG5vbi1tb25nbykgY29sbGVjdGlvbnMgbGlrZSB2b2xhdGlsZSBtZXNzYWdlIHF1ZXVlc1xuY29uc3QgcHVibGljYXRpb25TdHJhdGVnaWVzID0ge1xuICAvLyBTRVJWRVJfTUVSR0UgaXMgdGhlIGRlZmF1bHQgc3RyYXRlZ3kuXG4gIC8vIFdoZW4gdXNpbmcgdGhpcyBzdHJhdGVneSwgdGhlIHNlcnZlciBtYWludGFpbnMgYSBjb3B5IG9mIGFsbCBkYXRhIGEgY29ubmVjdGlvbiBpcyBzdWJzY3JpYmVkIHRvLlxuICAvLyBUaGlzIGFsbG93cyB1cyB0byBvbmx5IHNlbmQgZGVsdGFzIG92ZXIgbXVsdGlwbGUgcHVibGljYXRpb25zLlxuICBTRVJWRVJfTUVSR0U6IHtcbiAgICB1c2VEdW1teURvY3VtZW50VmlldzogZmFsc2UsXG4gICAgdXNlQ29sbGVjdGlvblZpZXc6IHRydWUsXG4gICAgZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbjogdHJ1ZSxcbiAgfSxcbiAgLy8gVGhlIE5PX01FUkdFX05PX0hJU1RPUlkgc3RyYXRlZ3kgcmVzdWx0cyBpbiB0aGUgc2VydmVyIHNlbmRpbmcgYWxsIHB1YmxpY2F0aW9uIGRhdGFcbiAgLy8gZGlyZWN0bHkgdG8gdGhlIGNsaWVudC4gSXQgZG9lcyBub3QgcmVtZW1iZXIgd2hhdCBpdCBoYXMgcHJldmlvdXNseSBzZW50XG4gIC8vIHRvIGl0IHdpbGwgbm90IHRyaWdnZXIgcmVtb3ZlZCBtZXNzYWdlcyB3aGVuIGEgc3Vic2NyaXB0aW9uIGlzIHN0b3BwZWQuXG4gIC8vIFRoaXMgc2hvdWxkIG9ubHkgYmUgY2hvc2VuIGZvciBzcGVjaWFsIHVzZSBjYXNlcyBsaWtlIHNlbmQtYW5kLWZvcmdldCBxdWV1ZXMuXG4gIE5PX01FUkdFX05PX0hJU1RPUlk6IHtcbiAgICB1c2VEdW1teURvY3VtZW50VmlldzogZmFsc2UsXG4gICAgdXNlQ29sbGVjdGlvblZpZXc6IGZhbHNlLFxuICAgIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IGZhbHNlLFxuICB9LFxuICAvLyBOT19NRVJHRSBpcyBzaW1pbGFyIHRvIE5PX01FUkdFX05PX0hJU1RPUlkgYnV0IHRoZSBzZXJ2ZXIgd2lsbCByZW1lbWJlciB0aGUgSURzIGl0IGhhc1xuICAvLyBzZW50IHRvIHRoZSBjbGllbnQgc28gaXQgY2FuIHJlbW92ZSB0aGVtIHdoZW4gYSBzdWJzY3JpcHRpb24gaXMgc3RvcHBlZC5cbiAgLy8gVGhpcyBzdHJhdGVneSBjYW4gYmUgdXNlZCB3aGVuIGEgY29sbGVjdGlvbiBpcyBvbmx5IHVzZWQgaW4gYSBzaW5nbGUgcHVibGljYXRpb24uXG4gIE5PX01FUkdFOiB7XG4gICAgdXNlRHVtbXlEb2N1bWVudFZpZXc6IGZhbHNlLFxuICAgIHVzZUNvbGxlY3Rpb25WaWV3OiBmYWxzZSxcbiAgICBkb0FjY291bnRpbmdGb3JDb2xsZWN0aW9uOiB0cnVlLFxuICB9LFxuICAvLyBOT19NRVJHRV9NVUxUSSBpcyBzaW1pbGFyIHRvIGBOT19NRVJHRWAsIGJ1dCBpdCBkb2VzIHRyYWNrIHdoZXRoZXIgYSBkb2N1bWVudCBpc1xuICAvLyB1c2VkIGJ5IG11bHRpcGxlIHB1YmxpY2F0aW9ucy4gVGhpcyBoYXMgc29tZSBtZW1vcnkgb3ZlcmhlYWQsIGJ1dCBpdCBzdGlsbCBkb2VzIG5vdCBkb1xuICAvLyBkaWZmaW5nIHNvIGl0J3MgZmFzdGVyIGFuZCBzbGltbWVyIHRoYW4gU0VSVkVSX01FUkdFLlxuICBOT19NRVJHRV9NVUxUSToge1xuICAgIHVzZUR1bW15RG9jdW1lbnRWaWV3OiB0cnVlLFxuICAgIHVzZUNvbGxlY3Rpb25WaWV3OiB0cnVlLFxuICAgIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IHRydWVcbiAgfVxufTtcblxuRERQU2VydmVyLnB1YmxpY2F0aW9uU3RyYXRlZ2llcyA9IHB1YmxpY2F0aW9uU3RyYXRlZ2llcztcblxuLy8gVGhpcyBmaWxlIGNvbnRhaW5zIGNsYXNzZXM6XG4vLyAqIFNlc3Npb24gLSBUaGUgc2VydmVyJ3MgY29ubmVjdGlvbiB0byBhIHNpbmdsZSBERFAgY2xpZW50XG4vLyAqIFN1YnNjcmlwdGlvbiAtIEEgc2luZ2xlIHN1YnNjcmlwdGlvbiBmb3IgYSBzaW5nbGUgY2xpZW50XG4vLyAqIFNlcnZlciAtIEFuIGVudGlyZSBzZXJ2ZXIgdGhhdCBtYXkgdGFsayB0byA+IDEgY2xpZW50LiBBIEREUCBlbmRwb2ludC5cbi8vXG4vLyBTZXNzaW9uIGFuZCBTdWJzY3JpcHRpb24gYXJlIGZpbGUgc2NvcGUuIEZvciBub3csIHVudGlsIHdlIGZyZWV6ZVxuLy8gdGhlIGludGVyZmFjZSwgU2VydmVyIGlzIHBhY2thZ2Ugc2NvcGUgKGluIHRoZSBmdXR1cmUgaXQgc2hvdWxkIGJlXG4vLyBleHBvcnRlZCkuXG52YXIgRHVtbXlEb2N1bWVudFZpZXcgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5leGlzdHNJbiA9IG5ldyBTZXQoKTsgLy8gc2V0IG9mIHN1YnNjcmlwdGlvbkhhbmRsZVxuICBzZWxmLmRhdGFCeUtleSA9IG5ldyBNYXAoKTsgLy8ga2V5LT4gWyB7c3Vic2NyaXB0aW9uSGFuZGxlLCB2YWx1ZX0gYnkgcHJlY2VkZW5jZV1cbn07XG5cbk9iamVjdC5hc3NpZ24oRHVtbXlEb2N1bWVudFZpZXcucHJvdG90eXBlLCB7XG4gIGdldEZpZWxkczogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7fVxuICB9LFxuXG4gIGNsZWFyRmllbGQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlQ29sbGVjdG9yKSB7XG4gICAgY2hhbmdlQ29sbGVjdG9yW2tleV0gPSB1bmRlZmluZWRcbiAgfSxcblxuICBjaGFuZ2VGaWVsZDogZnVuY3Rpb24gKHN1YnNjcmlwdGlvbkhhbmRsZSwga2V5LCB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VDb2xsZWN0b3IsIGlzQWRkKSB7XG4gICAgY2hhbmdlQ29sbGVjdG9yW2tleV0gPSB2YWx1ZVxuICB9XG59KTtcblxuLy8gUmVwcmVzZW50cyBhIHNpbmdsZSBkb2N1bWVudCBpbiBhIFNlc3Npb25Db2xsZWN0aW9uVmlld1xudmFyIFNlc3Npb25Eb2N1bWVudFZpZXcgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5leGlzdHNJbiA9IG5ldyBTZXQoKTsgLy8gc2V0IG9mIHN1YnNjcmlwdGlvbkhhbmRsZVxuICBzZWxmLmRhdGFCeUtleSA9IG5ldyBNYXAoKTsgLy8ga2V5LT4gWyB7c3Vic2NyaXB0aW9uSGFuZGxlLCB2YWx1ZX0gYnkgcHJlY2VkZW5jZV1cbn07XG5cbkREUFNlcnZlci5fU2Vzc2lvbkRvY3VtZW50VmlldyA9IFNlc3Npb25Eb2N1bWVudFZpZXc7XG5cbkREUFNlcnZlci5fZ2V0Q3VycmVudEZlbmNlID0gZnVuY3Rpb24gKCkge1xuICBsZXQgY3VycmVudEludm9jYXRpb24gPSB0aGlzLl9DdXJyZW50V3JpdGVGZW5jZS5nZXQoKTtcbiAgaWYgKGN1cnJlbnRJbnZvY2F0aW9uKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRJbnZvY2F0aW9uO1xuICB9XG4gIGN1cnJlbnRJbnZvY2F0aW9uID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgcmV0dXJuIGN1cnJlbnRJbnZvY2F0aW9uID8gY3VycmVudEludm9jYXRpb24uZmVuY2UgOiB1bmRlZmluZWQ7XG59O1xuXG5fLmV4dGVuZChTZXNzaW9uRG9jdW1lbnRWaWV3LnByb3RvdHlwZSwge1xuXG4gIGdldEZpZWxkczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmV0ID0ge307XG4gICAgc2VsZi5kYXRhQnlLZXkuZm9yRWFjaChmdW5jdGlvbiAocHJlY2VkZW5jZUxpc3QsIGtleSkge1xuICAgICAgcmV0W2tleV0gPSBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIGNsZWFyRmllbGQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlQ29sbGVjdG9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIC8vIFB1Ymxpc2ggQVBJIGlnbm9yZXMgX2lkIGlmIHByZXNlbnQgaW4gZmllbGRzXG4gICAgaWYgKGtleSA9PT0gXCJfaWRcIilcbiAgICAgIHJldHVybjtcbiAgICB2YXIgcHJlY2VkZW5jZUxpc3QgPSBzZWxmLmRhdGFCeUtleS5nZXQoa2V5KTtcblxuICAgIC8vIEl0J3Mgb2theSB0byBjbGVhciBmaWVsZHMgdGhhdCBkaWRuJ3QgZXhpc3QuIE5vIG5lZWQgdG8gdGhyb3dcbiAgICAvLyBhbiBlcnJvci5cbiAgICBpZiAoIXByZWNlZGVuY2VMaXN0KVxuICAgICAgcmV0dXJuO1xuXG4gICAgdmFyIHJlbW92ZWRWYWx1ZSA9IHVuZGVmaW5lZDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHByZWNlZGVuY2VMaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgcHJlY2VkZW5jZSA9IHByZWNlZGVuY2VMaXN0W2ldO1xuICAgICAgaWYgKHByZWNlZGVuY2Uuc3Vic2NyaXB0aW9uSGFuZGxlID09PSBzdWJzY3JpcHRpb25IYW5kbGUpIHtcbiAgICAgICAgLy8gVGhlIHZpZXcncyB2YWx1ZSBjYW4gb25seSBjaGFuZ2UgaWYgdGhpcyBzdWJzY3JpcHRpb24gaXMgdGhlIG9uZSB0aGF0XG4gICAgICAgIC8vIHVzZWQgdG8gaGF2ZSBwcmVjZWRlbmNlLlxuICAgICAgICBpZiAoaSA9PT0gMClcbiAgICAgICAgICByZW1vdmVkVmFsdWUgPSBwcmVjZWRlbmNlLnZhbHVlO1xuICAgICAgICBwcmVjZWRlbmNlTGlzdC5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAocHJlY2VkZW5jZUxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgICBzZWxmLmRhdGFCeUtleS5kZWxldGUoa2V5KTtcbiAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSBpZiAocmVtb3ZlZFZhbHVlICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgICAgICAgICFFSlNPTi5lcXVhbHMocmVtb3ZlZFZhbHVlLCBwcmVjZWRlbmNlTGlzdFswXS52YWx1ZSkpIHtcbiAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gcHJlY2VkZW5jZUxpc3RbMF0udmFsdWU7XG4gICAgfVxuICB9LFxuXG4gIGNoYW5nZUZpZWxkOiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICAgICAgIGNoYW5nZUNvbGxlY3RvciwgaXNBZGQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHVibGlzaCBBUEkgaWdub3JlcyBfaWQgaWYgcHJlc2VudCBpbiBmaWVsZHNcbiAgICBpZiAoa2V5ID09PSBcIl9pZFwiKVxuICAgICAgcmV0dXJuO1xuXG4gICAgLy8gRG9uJ3Qgc2hhcmUgc3RhdGUgd2l0aCB0aGUgZGF0YSBwYXNzZWQgaW4gYnkgdGhlIHVzZXIuXG4gICAgdmFsdWUgPSBFSlNPTi5jbG9uZSh2YWx1ZSk7XG5cbiAgICBpZiAoIXNlbGYuZGF0YUJ5S2V5LmhhcyhrZXkpKSB7XG4gICAgICBzZWxmLmRhdGFCeUtleS5zZXQoa2V5LCBbe3N1YnNjcmlwdGlvbkhhbmRsZTogc3Vic2NyaXB0aW9uSGFuZGxlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWV9XSk7XG4gICAgICBjaGFuZ2VDb2xsZWN0b3Jba2V5XSA9IHZhbHVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgcHJlY2VkZW5jZUxpc3QgPSBzZWxmLmRhdGFCeUtleS5nZXQoa2V5KTtcbiAgICB2YXIgZWx0O1xuICAgIGlmICghaXNBZGQpIHtcbiAgICAgIGVsdCA9IHByZWNlZGVuY2VMaXN0LmZpbmQoZnVuY3Rpb24gKHByZWNlZGVuY2UpIHtcbiAgICAgICAgICByZXR1cm4gcHJlY2VkZW5jZS5zdWJzY3JpcHRpb25IYW5kbGUgPT09IHN1YnNjcmlwdGlvbkhhbmRsZTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChlbHQpIHtcbiAgICAgIGlmIChlbHQgPT09IHByZWNlZGVuY2VMaXN0WzBdICYmICFFSlNPTi5lcXVhbHModmFsdWUsIGVsdC52YWx1ZSkpIHtcbiAgICAgICAgLy8gdGhpcyBzdWJzY3JpcHRpb24gaXMgY2hhbmdpbmcgdGhlIHZhbHVlIG9mIHRoaXMgZmllbGQuXG4gICAgICAgIGNoYW5nZUNvbGxlY3RvcltrZXldID0gdmFsdWU7XG4gICAgICB9XG4gICAgICBlbHQudmFsdWUgPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdGhpcyBzdWJzY3JpcHRpb24gaXMgbmV3bHkgY2FyaW5nIGFib3V0IHRoaXMgZmllbGRcbiAgICAgIHByZWNlZGVuY2VMaXN0LnB1c2goe3N1YnNjcmlwdGlvbkhhbmRsZTogc3Vic2NyaXB0aW9uSGFuZGxlLCB2YWx1ZTogdmFsdWV9KTtcbiAgICB9XG5cbiAgfVxufSk7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIGNsaWVudCdzIHZpZXcgb2YgYSBzaW5nbGUgY29sbGVjdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb25OYW1lIE5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gaXQgcmVwcmVzZW50c1xuICogQHBhcmFtIHtPYmplY3QuPFN0cmluZywgRnVuY3Rpb24+fSBzZXNzaW9uQ2FsbGJhY2tzIFRoZSBjYWxsYmFja3MgZm9yIGFkZGVkLCBjaGFuZ2VkLCByZW1vdmVkXG4gKiBAY2xhc3MgU2Vzc2lvbkNvbGxlY3Rpb25WaWV3XG4gKi9cbnZhciBTZXNzaW9uQ29sbGVjdGlvblZpZXcgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlc3Npb25DYWxsYmFja3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLmNvbGxlY3Rpb25OYW1lID0gY29sbGVjdGlvbk5hbWU7XG4gIHNlbGYuZG9jdW1lbnRzID0gbmV3IE1hcCgpO1xuICBzZWxmLmNhbGxiYWNrcyA9IHNlc3Npb25DYWxsYmFja3M7XG59O1xuXG5ERFBTZXJ2ZXIuX1Nlc3Npb25Db2xsZWN0aW9uVmlldyA9IFNlc3Npb25Db2xsZWN0aW9uVmlldztcblxuXG5PYmplY3QuYXNzaWduKFNlc3Npb25Db2xsZWN0aW9uVmlldy5wcm90b3R5cGUsIHtcblxuICBpc0VtcHR5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLmRvY3VtZW50cy5zaXplID09PSAwO1xuICB9LFxuXG4gIGRpZmY6IGZ1bmN0aW9uIChwcmV2aW91cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBEaWZmU2VxdWVuY2UuZGlmZk1hcHMocHJldmlvdXMuZG9jdW1lbnRzLCBzZWxmLmRvY3VtZW50cywge1xuICAgICAgYm90aDogXy5iaW5kKHNlbGYuZGlmZkRvY3VtZW50LCBzZWxmKSxcblxuICAgICAgcmlnaHRPbmx5OiBmdW5jdGlvbiAoaWQsIG5vd0RWKSB7XG4gICAgICAgIHNlbGYuY2FsbGJhY2tzLmFkZGVkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBub3dEVi5nZXRGaWVsZHMoKSk7XG4gICAgICB9LFxuXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24gKGlkLCBwcmV2RFYpIHtcbiAgICAgICAgc2VsZi5jYWxsYmFja3MucmVtb3ZlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgZGlmZkRvY3VtZW50OiBmdW5jdGlvbiAoaWQsIHByZXZEViwgbm93RFYpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGZpZWxkcyA9IHt9O1xuICAgIERpZmZTZXF1ZW5jZS5kaWZmT2JqZWN0cyhwcmV2RFYuZ2V0RmllbGRzKCksIG5vd0RWLmdldEZpZWxkcygpLCB7XG4gICAgICBib3RoOiBmdW5jdGlvbiAoa2V5LCBwcmV2LCBub3cpIHtcbiAgICAgICAgaWYgKCFFSlNPTi5lcXVhbHMocHJldiwgbm93KSlcbiAgICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgIH0sXG4gICAgICByaWdodE9ubHk6IGZ1bmN0aW9uIChrZXksIG5vdykge1xuICAgICAgICBmaWVsZHNba2V5XSA9IG5vdztcbiAgICAgIH0sXG4gICAgICBsZWZ0T25seTogZnVuY3Rpb24oa2V5LCBwcmV2KSB7XG4gICAgICAgIGZpZWxkc1trZXldID0gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gIH0sXG5cbiAgYWRkZWQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBmaWVsZHMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGRvY1ZpZXcgPSBzZWxmLmRvY3VtZW50cy5nZXQoaWQpO1xuICAgIHZhciBhZGRlZCA9IGZhbHNlO1xuICAgIGlmICghZG9jVmlldykge1xuICAgICAgYWRkZWQgPSB0cnVlO1xuICAgICAgaWYgKE1ldGVvci5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneSh0aGlzLmNvbGxlY3Rpb25OYW1lKS51c2VEdW1teURvY3VtZW50Vmlldykge1xuICAgICAgICBkb2NWaWV3ID0gbmV3IER1bW15RG9jdW1lbnRWaWV3KCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkb2NWaWV3ID0gbmV3IFNlc3Npb25Eb2N1bWVudFZpZXcoKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5kb2N1bWVudHMuc2V0KGlkLCBkb2NWaWV3KTtcbiAgICB9XG4gICAgZG9jVmlldy5leGlzdHNJbi5hZGQoc3Vic2NyaXB0aW9uSGFuZGxlKTtcbiAgICB2YXIgY2hhbmdlQ29sbGVjdG9yID0ge307XG4gICAgXy5lYWNoKGZpZWxkcywgZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcbiAgICAgIGRvY1ZpZXcuY2hhbmdlRmllbGQoXG4gICAgICAgIHN1YnNjcmlwdGlvbkhhbmRsZSwga2V5LCB2YWx1ZSwgY2hhbmdlQ29sbGVjdG9yLCB0cnVlKTtcbiAgICB9KTtcbiAgICBpZiAoYWRkZWQpXG4gICAgICBzZWxmLmNhbGxiYWNrcy5hZGRlZChzZWxmLmNvbGxlY3Rpb25OYW1lLCBpZCwgY2hhbmdlQ29sbGVjdG9yKTtcbiAgICBlbHNlXG4gICAgICBzZWxmLmNhbGxiYWNrcy5jaGFuZ2VkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBjaGFuZ2VDb2xsZWN0b3IpO1xuICB9LFxuXG4gIGNoYW5nZWQ6IGZ1bmN0aW9uIChzdWJzY3JpcHRpb25IYW5kbGUsIGlkLCBjaGFuZ2VkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBjaGFuZ2VkUmVzdWx0ID0ge307XG4gICAgdmFyIGRvY1ZpZXcgPSBzZWxmLmRvY3VtZW50cy5nZXQoaWQpO1xuICAgIGlmICghZG9jVmlldylcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNvdWxkIG5vdCBmaW5kIGVsZW1lbnQgd2l0aCBpZCBcIiArIGlkICsgXCIgdG8gY2hhbmdlXCIpO1xuICAgIF8uZWFjaChjaGFuZ2VkLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQpXG4gICAgICAgIGRvY1ZpZXcuY2xlYXJGaWVsZChzdWJzY3JpcHRpb25IYW5kbGUsIGtleSwgY2hhbmdlZFJlc3VsdCk7XG4gICAgICBlbHNlXG4gICAgICAgIGRvY1ZpZXcuY2hhbmdlRmllbGQoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIHZhbHVlLCBjaGFuZ2VkUmVzdWx0KTtcbiAgICB9KTtcbiAgICBzZWxmLmNhbGxiYWNrcy5jaGFuZ2VkKHNlbGYuY29sbGVjdGlvbk5hbWUsIGlkLCBjaGFuZ2VkUmVzdWx0KTtcbiAgfSxcblxuICByZW1vdmVkOiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSGFuZGxlLCBpZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZG9jVmlldyA9IHNlbGYuZG9jdW1lbnRzLmdldChpZCk7XG4gICAgaWYgKCFkb2NWaWV3KSB7XG4gICAgICB2YXIgZXJyID0gbmV3IEVycm9yKFwiUmVtb3ZlZCBub25leGlzdGVudCBkb2N1bWVudCBcIiArIGlkKTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gICAgZG9jVmlldy5leGlzdHNJbi5kZWxldGUoc3Vic2NyaXB0aW9uSGFuZGxlKTtcbiAgICBpZiAoZG9jVmlldy5leGlzdHNJbi5zaXplID09PSAwKSB7XG4gICAgICAvLyBpdCBpcyBnb25lIGZyb20gZXZlcnlvbmVcbiAgICAgIHNlbGYuY2FsbGJhY2tzLnJlbW92ZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQpO1xuICAgICAgc2VsZi5kb2N1bWVudHMuZGVsZXRlKGlkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGNoYW5nZWQgPSB7fTtcbiAgICAgIC8vIHJlbW92ZSB0aGlzIHN1YnNjcmlwdGlvbiBmcm9tIGV2ZXJ5IHByZWNlZGVuY2UgbGlzdFxuICAgICAgLy8gYW5kIHJlY29yZCB0aGUgY2hhbmdlc1xuICAgICAgZG9jVmlldy5kYXRhQnlLZXkuZm9yRWFjaChmdW5jdGlvbiAocHJlY2VkZW5jZUxpc3QsIGtleSkge1xuICAgICAgICBkb2NWaWV3LmNsZWFyRmllbGQoc3Vic2NyaXB0aW9uSGFuZGxlLCBrZXksIGNoYW5nZWQpO1xuICAgICAgfSk7XG5cbiAgICAgIHNlbGYuY2FsbGJhY2tzLmNoYW5nZWQoc2VsZi5jb2xsZWN0aW9uTmFtZSwgaWQsIGNoYW5nZWQpO1xuICAgIH1cbiAgfVxufSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKiBTZXNzaW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxudmFyIFNlc3Npb24gPSBmdW5jdGlvbiAoc2VydmVyLCB2ZXJzaW9uLCBzb2NrZXQsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLmlkID0gUmFuZG9tLmlkKCk7XG5cbiAgc2VsZi5zZXJ2ZXIgPSBzZXJ2ZXI7XG4gIHNlbGYudmVyc2lvbiA9IHZlcnNpb247XG5cbiAgc2VsZi5pbml0aWFsaXplZCA9IGZhbHNlO1xuICBzZWxmLnNvY2tldCA9IHNvY2tldDtcblxuICAvLyBTZXQgdG8gbnVsbCB3aGVuIHRoZSBzZXNzaW9uIGlzIGRlc3Ryb3llZC4gTXVsdGlwbGUgcGxhY2VzIGJlbG93XG4gIC8vIHVzZSB0aGlzIHRvIGRldGVybWluZSBpZiB0aGUgc2Vzc2lvbiBpcyBhbGl2ZSBvciBub3QuXG4gIHNlbGYuaW5RdWV1ZSA9IG5ldyBNZXRlb3IuX0RvdWJsZUVuZGVkUXVldWUoKTtcblxuICBzZWxmLmJsb2NrZWQgPSBmYWxzZTtcbiAgc2VsZi53b3JrZXJSdW5uaW5nID0gZmFsc2U7XG5cbiAgc2VsZi5jYWNoZWRVbmJsb2NrID0gbnVsbDtcblxuICAvLyBTdWIgb2JqZWN0cyBmb3IgYWN0aXZlIHN1YnNjcmlwdGlvbnNcbiAgc2VsZi5fbmFtZWRTdWJzID0gbmV3IE1hcCgpO1xuICBzZWxmLl91bml2ZXJzYWxTdWJzID0gW107XG5cbiAgc2VsZi51c2VySWQgPSBudWxsO1xuXG4gIHNlbGYuY29sbGVjdGlvblZpZXdzID0gbmV3IE1hcCgpO1xuXG4gIC8vIFNldCB0aGlzIHRvIGZhbHNlIHRvIG5vdCBzZW5kIG1lc3NhZ2VzIHdoZW4gY29sbGVjdGlvblZpZXdzIGFyZVxuICAvLyBtb2RpZmllZC4gVGhpcyBpcyBkb25lIHdoZW4gcmVydW5uaW5nIHN1YnMgaW4gX3NldFVzZXJJZCBhbmQgdGhvc2UgbWVzc2FnZXNcbiAgLy8gYXJlIGNhbGN1bGF0ZWQgdmlhIGEgZGlmZiBpbnN0ZWFkLlxuICBzZWxmLl9pc1NlbmRpbmcgPSB0cnVlO1xuXG4gIC8vIElmIHRoaXMgaXMgdHJ1ZSwgZG9uJ3Qgc3RhcnQgYSBuZXdseS1jcmVhdGVkIHVuaXZlcnNhbCBwdWJsaXNoZXIgb24gdGhpc1xuICAvLyBzZXNzaW9uLiBUaGUgc2Vzc2lvbiB3aWxsIHRha2UgY2FyZSBvZiBzdGFydGluZyBpdCB3aGVuIGFwcHJvcHJpYXRlLlxuICBzZWxmLl9kb250U3RhcnROZXdVbml2ZXJzYWxTdWJzID0gZmFsc2U7XG5cbiAgLy8gV2hlbiB3ZSBhcmUgcmVydW5uaW5nIHN1YnNjcmlwdGlvbnMsIGFueSByZWFkeSBtZXNzYWdlc1xuICAvLyB3ZSB3YW50IHRvIGJ1ZmZlciB1cCBmb3Igd2hlbiB3ZSBhcmUgZG9uZSByZXJ1bm5pbmcgc3Vic2NyaXB0aW9uc1xuICBzZWxmLl9wZW5kaW5nUmVhZHkgPSBbXTtcblxuICAvLyBMaXN0IG9mIGNhbGxiYWNrcyB0byBjYWxsIHdoZW4gdGhpcyBjb25uZWN0aW9uIGlzIGNsb3NlZC5cbiAgc2VsZi5fY2xvc2VDYWxsYmFja3MgPSBbXTtcblxuXG4gIC8vIFhYWCBIQUNLOiBJZiBhIHNvY2tqcyBjb25uZWN0aW9uLCBzYXZlIG9mZiB0aGUgVVJMLiBUaGlzIGlzXG4gIC8vIHRlbXBvcmFyeSBhbmQgd2lsbCBnbyBhd2F5IGluIHRoZSBuZWFyIGZ1dHVyZS5cbiAgc2VsZi5fc29ja2V0VXJsID0gc29ja2V0LnVybDtcblxuICAvLyBBbGxvdyB0ZXN0cyB0byBkaXNhYmxlIHJlc3BvbmRpbmcgdG8gcGluZ3MuXG4gIHNlbGYuX3Jlc3BvbmRUb1BpbmdzID0gb3B0aW9ucy5yZXNwb25kVG9QaW5ncztcblxuICAvLyBUaGlzIG9iamVjdCBpcyB0aGUgcHVibGljIGludGVyZmFjZSB0byB0aGUgc2Vzc2lvbi4gSW4gdGhlIHB1YmxpY1xuICAvLyBBUEksIGl0IGlzIGNhbGxlZCB0aGUgYGNvbm5lY3Rpb25gIG9iamVjdC4gIEludGVybmFsbHkgd2UgY2FsbCBpdFxuICAvLyBhIGBjb25uZWN0aW9uSGFuZGxlYCB0byBhdm9pZCBhbWJpZ3VpdHkuXG4gIHNlbGYuY29ubmVjdGlvbkhhbmRsZSA9IHtcbiAgICBpZDogc2VsZi5pZCxcbiAgICBjbG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5jbG9zZSgpO1xuICAgIH0sXG4gICAgb25DbG9zZTogZnVuY3Rpb24gKGZuKSB7XG4gICAgICB2YXIgY2IgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KGZuLCBcImNvbm5lY3Rpb24gb25DbG9zZSBjYWxsYmFja1wiKTtcbiAgICAgIGlmIChzZWxmLmluUXVldWUpIHtcbiAgICAgICAgc2VsZi5fY2xvc2VDYWxsYmFja3MucHVzaChjYik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBpZiB3ZSdyZSBhbHJlYWR5IGNsb3NlZCwgY2FsbCB0aGUgY2FsbGJhY2suXG4gICAgICAgIE1ldGVvci5kZWZlcihjYik7XG4gICAgICB9XG4gICAgfSxcbiAgICBjbGllbnRBZGRyZXNzOiBzZWxmLl9jbGllbnRBZGRyZXNzKCksXG4gICAgaHR0cEhlYWRlcnM6IHNlbGYuc29ja2V0LmhlYWRlcnNcbiAgfTtcblxuICBzZWxmLnNlbmQoeyBtc2c6ICdjb25uZWN0ZWQnLCBzZXNzaW9uOiBzZWxmLmlkIH0pO1xuXG4gIC8vIE9uIGluaXRpYWwgY29ubmVjdCwgc3BpbiB1cCBhbGwgdGhlIHVuaXZlcnNhbCBwdWJsaXNoZXJzLlxuICBzZWxmLnN0YXJ0VW5pdmVyc2FsU3VicygpO1xuXG4gIGlmICh2ZXJzaW9uICE9PSAncHJlMScgJiYgb3B0aW9ucy5oZWFydGJlYXRJbnRlcnZhbCAhPT0gMCkge1xuICAgIC8vIFdlIG5vIGxvbmdlciBuZWVkIHRoZSBsb3cgbGV2ZWwgdGltZW91dCBiZWNhdXNlIHdlIGhhdmUgaGVhcnRiZWF0cy5cbiAgICBzb2NrZXQuc2V0V2Vic29ja2V0VGltZW91dCgwKTtcblxuICAgIHNlbGYuaGVhcnRiZWF0ID0gbmV3IEREUENvbW1vbi5IZWFydGJlYXQoe1xuICAgICAgaGVhcnRiZWF0SW50ZXJ2YWw6IG9wdGlvbnMuaGVhcnRiZWF0SW50ZXJ2YWwsXG4gICAgICBoZWFydGJlYXRUaW1lb3V0OiBvcHRpb25zLmhlYXJ0YmVhdFRpbWVvdXQsXG4gICAgICBvblRpbWVvdXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5jbG9zZSgpO1xuICAgICAgfSxcbiAgICAgIHNlbmRQaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYuc2VuZCh7bXNnOiAncGluZyd9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBzZWxmLmhlYXJ0YmVhdC5zdGFydCgpO1xuICB9XG5cbiAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgIFwibGl2ZWRhdGFcIiwgXCJzZXNzaW9uc1wiLCAxKTtcbn07XG5cbk9iamVjdC5hc3NpZ24oU2Vzc2lvbi5wcm90b3R5cGUsIHtcbiAgX2NoZWNrUHVibGlzaFByb21pc2VCZWZvcmVTZW5kKGYpIHtcbiAgICBpZiAoIXRoaXMuX3B1Ymxpc2hDdXJzb3JQcm9taXNlKSB7XG4gICAgICBmKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuX3B1Ymxpc2hDdXJzb3JQcm9taXNlLmZpbmFsbHkoKCkgPT4gZigpKTtcbiAgfSxcbiAgc2VuZFJlYWR5OiBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSWRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc1NlbmRpbmcpIHtcbiAgICAgIHNlbGYuc2VuZCh7bXNnOiBcInJlYWR5XCIsIHN1YnM6IHN1YnNjcmlwdGlvbklkc30pO1xuICAgIH0gZWxzZSB7XG4gICAgICBfLmVhY2goc3Vic2NyaXB0aW9uSWRzLCBmdW5jdGlvbiAoc3Vic2NyaXB0aW9uSWQpIHtcbiAgICAgICAgc2VsZi5fcGVuZGluZ1JlYWR5LnB1c2goc3Vic2NyaXB0aW9uSWQpO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIF9jYW5TZW5kKGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuX2lzU2VuZGluZyB8fCAhdGhpcy5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkudXNlQ29sbGVjdGlvblZpZXc7XG4gIH0sXG5cblxuICBzZW5kQWRkZWQoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5fY2FuU2VuZChjb2xsZWN0aW9uTmFtZSkpIHtcbiAgICAgIHRoaXMuc2VuZCh7IG1zZzogJ2FkZGVkJywgY29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMgfSk7XG4gICAgfVxuICB9LFxuXG4gIHNlbmRDaGFuZ2VkKGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKSB7XG4gICAgaWYgKF8uaXNFbXB0eShmaWVsZHMpKVxuICAgICAgcmV0dXJuO1xuXG4gICAgaWYgKHRoaXMuX2NhblNlbmQoY29sbGVjdGlvbk5hbWUpKSB7XG4gICAgICB0aGlzLnNlbmQoe1xuICAgICAgICBtc2c6IFwiY2hhbmdlZFwiLFxuICAgICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgaWQsXG4gICAgICAgIGZpZWxkc1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIHNlbmRSZW1vdmVkKGNvbGxlY3Rpb25OYW1lLCBpZCkge1xuICAgIGlmICh0aGlzLl9jYW5TZW5kKGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgdGhpcy5zZW5kKHttc2c6IFwicmVtb3ZlZFwiLCBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSwgaWR9KTtcbiAgICB9XG4gIH0sXG5cbiAgZ2V0U2VuZENhbGxiYWNrczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4ge1xuICAgICAgYWRkZWQ6IF8uYmluZChzZWxmLnNlbmRBZGRlZCwgc2VsZiksXG4gICAgICBjaGFuZ2VkOiBfLmJpbmQoc2VsZi5zZW5kQ2hhbmdlZCwgc2VsZiksXG4gICAgICByZW1vdmVkOiBfLmJpbmQoc2VsZi5zZW5kUmVtb3ZlZCwgc2VsZilcbiAgICB9O1xuICB9LFxuXG4gIGdldENvbGxlY3Rpb25WaWV3OiBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJldCA9IHNlbGYuY29sbGVjdGlvblZpZXdzLmdldChjb2xsZWN0aW9uTmFtZSk7XG4gICAgaWYgKCFyZXQpIHtcbiAgICAgIHJldCA9IG5ldyBTZXNzaW9uQ29sbGVjdGlvblZpZXcoY29sbGVjdGlvbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5nZXRTZW5kQ2FsbGJhY2tzKCkpO1xuICAgICAgc2VsZi5jb2xsZWN0aW9uVmlld3Muc2V0KGNvbGxlY3Rpb25OYW1lLCByZXQpO1xuICAgIH1cbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIGFkZGVkKHN1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkudXNlQ29sbGVjdGlvblZpZXcpIHtcbiAgICAgIGNvbnN0IHZpZXcgPSB0aGlzLmdldENvbGxlY3Rpb25WaWV3KGNvbGxlY3Rpb25OYW1lKTtcbiAgICAgIHZpZXcuYWRkZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBpZCwgZmllbGRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZW5kQWRkZWQoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpO1xuICAgIH1cbiAgfSxcblxuICByZW1vdmVkKHN1YnNjcmlwdGlvbkhhbmRsZSwgY29sbGVjdGlvbk5hbWUsIGlkKSB7XG4gICAgaWYgKHRoaXMuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLnVzZUNvbGxlY3Rpb25WaWV3KSB7XG4gICAgICBjb25zdCB2aWV3ID0gdGhpcy5nZXRDb2xsZWN0aW9uVmlldyhjb2xsZWN0aW9uTmFtZSk7XG4gICAgICB2aWV3LnJlbW92ZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBpZCk7XG4gICAgICBpZiAodmlldy5pc0VtcHR5KCkpIHtcbiAgICAgICAgIHRoaXMuY29sbGVjdGlvblZpZXdzLmRlbGV0ZShjb2xsZWN0aW9uTmFtZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2VuZFJlbW92ZWQoY29sbGVjdGlvbk5hbWUsIGlkKTtcbiAgICB9XG4gIH0sXG5cbiAgY2hhbmdlZChzdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKSB7XG4gICAgaWYgKHRoaXMuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLnVzZUNvbGxlY3Rpb25WaWV3KSB7XG4gICAgICBjb25zdCB2aWV3ID0gdGhpcy5nZXRDb2xsZWN0aW9uVmlldyhjb2xsZWN0aW9uTmFtZSk7XG4gICAgICB2aWV3LmNoYW5nZWQoc3Vic2NyaXB0aW9uSGFuZGxlLCBpZCwgZmllbGRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zZW5kQ2hhbmdlZChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcyk7XG4gICAgfVxuICB9LFxuXG4gIHN0YXJ0VW5pdmVyc2FsU3ViczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBNYWtlIGEgc2hhbGxvdyBjb3B5IG9mIHRoZSBzZXQgb2YgdW5pdmVyc2FsIGhhbmRsZXJzIGFuZCBzdGFydCB0aGVtLiBJZlxuICAgIC8vIGFkZGl0aW9uYWwgdW5pdmVyc2FsIHB1Ymxpc2hlcnMgc3RhcnQgd2hpbGUgd2UncmUgcnVubmluZyB0aGVtIChkdWUgdG9cbiAgICAvLyB5aWVsZGluZyksIHRoZXkgd2lsbCBydW4gc2VwYXJhdGVseSBhcyBwYXJ0IG9mIFNlcnZlci5wdWJsaXNoLlxuICAgIHZhciBoYW5kbGVycyA9IF8uY2xvbmUoc2VsZi5zZXJ2ZXIudW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnMpO1xuICAgIF8uZWFjaChoYW5kbGVycywgZnVuY3Rpb24gKGhhbmRsZXIpIHtcbiAgICAgIHNlbGYuX3N0YXJ0U3Vic2NyaXB0aW9uKGhhbmRsZXIpO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIERlc3Ryb3kgdGhpcyBzZXNzaW9uIGFuZCB1bnJlZ2lzdGVyIGl0IGF0IHRoZSBzZXJ2ZXIuXG4gIGNsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gRGVzdHJveSB0aGlzIHNlc3Npb24sIGV2ZW4gaWYgaXQncyBub3QgcmVnaXN0ZXJlZCBhdCB0aGVcbiAgICAvLyBzZXJ2ZXIuIFN0b3AgYWxsIHByb2Nlc3NpbmcgYW5kIHRlYXIgZXZlcnl0aGluZyBkb3duLiBJZiBhIHNvY2tldFxuICAgIC8vIHdhcyBhdHRhY2hlZCwgY2xvc2UgaXQuXG5cbiAgICAvLyBBbHJlYWR5IGRlc3Ryb3llZC5cbiAgICBpZiAoISBzZWxmLmluUXVldWUpXG4gICAgICByZXR1cm47XG5cbiAgICAvLyBEcm9wIHRoZSBtZXJnZSBib3ggZGF0YSBpbW1lZGlhdGVseS5cbiAgICBzZWxmLmluUXVldWUgPSBudWxsO1xuICAgIHNlbGYuY29sbGVjdGlvblZpZXdzID0gbmV3IE1hcCgpO1xuXG4gICAgaWYgKHNlbGYuaGVhcnRiZWF0KSB7XG4gICAgICBzZWxmLmhlYXJ0YmVhdC5zdG9wKCk7XG4gICAgICBzZWxmLmhlYXJ0YmVhdCA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuc29ja2V0KSB7XG4gICAgICBzZWxmLnNvY2tldC5jbG9zZSgpO1xuICAgICAgc2VsZi5zb2NrZXQuX21ldGVvclNlc3Npb24gPSBudWxsO1xuICAgIH1cblxuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgIFwibGl2ZWRhdGFcIiwgXCJzZXNzaW9uc1wiLCAtMSk7XG5cbiAgICBNZXRlb3IuZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgLy8gU3RvcCBjYWxsYmFja3MgY2FuIHlpZWxkLCBzbyB3ZSBkZWZlciB0aGlzIG9uIGNsb3NlLlxuICAgICAgLy8gc3ViLl9pc0RlYWN0aXZhdGVkKCkgZGV0ZWN0cyB0aGF0IHdlIHNldCBpblF1ZXVlIHRvIG51bGwgYW5kXG4gICAgICAvLyB0cmVhdHMgaXQgYXMgc2VtaS1kZWFjdGl2YXRlZCAoaXQgd2lsbCBpZ25vcmUgaW5jb21pbmcgY2FsbGJhY2tzLCBldGMpLlxuICAgICAgc2VsZi5fZGVhY3RpdmF0ZUFsbFN1YnNjcmlwdGlvbnMoKTtcblxuICAgICAgLy8gRGVmZXIgY2FsbGluZyB0aGUgY2xvc2UgY2FsbGJhY2tzLCBzbyB0aGF0IHRoZSBjYWxsZXIgY2xvc2luZ1xuICAgICAgLy8gdGhlIHNlc3Npb24gaXNuJ3Qgd2FpdGluZyBmb3IgYWxsIHRoZSBjYWxsYmFja3MgdG8gY29tcGxldGUuXG4gICAgICBfLmVhY2goc2VsZi5fY2xvc2VDYWxsYmFja3MsIGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICAvLyBVbnJlZ2lzdGVyIHRoZSBzZXNzaW9uLlxuICAgIHNlbGYuc2VydmVyLl9yZW1vdmVTZXNzaW9uKHNlbGYpO1xuICB9LFxuXG4gIC8vIFNlbmQgYSBtZXNzYWdlIChkb2luZyBub3RoaW5nIGlmIG5vIHNvY2tldCBpcyBjb25uZWN0ZWQgcmlnaHQgbm93KS5cbiAgLy8gSXQgc2hvdWxkIGJlIGEgSlNPTiBvYmplY3QgKGl0IHdpbGwgYmUgc3RyaW5naWZpZWQpLlxuICBzZW5kOiBmdW5jdGlvbiAobXNnKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5fY2hlY2tQdWJsaXNoUHJvbWlzZUJlZm9yZVNlbmQoKCkgPT4ge1xuICAgICAgaWYgKHNlbGYuc29ja2V0KSB7XG4gICAgICAgIGlmIChNZXRlb3IuX3ByaW50U2VudEREUClcbiAgICAgICAgICBNZXRlb3IuX2RlYnVnKCdTZW50IEREUCcsIEREUENvbW1vbi5zdHJpbmdpZnlERFAobXNnKSk7XG4gICAgICAgIHNlbGYuc29ja2V0LnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUChtc2cpKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICAvLyBTZW5kIGEgY29ubmVjdGlvbiBlcnJvci5cbiAgc2VuZEVycm9yOiBmdW5jdGlvbiAocmVhc29uLCBvZmZlbmRpbmdNZXNzYWdlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBtc2cgPSB7bXNnOiAnZXJyb3InLCByZWFzb246IHJlYXNvbn07XG4gICAgaWYgKG9mZmVuZGluZ01lc3NhZ2UpXG4gICAgICBtc2cub2ZmZW5kaW5nTWVzc2FnZSA9IG9mZmVuZGluZ01lc3NhZ2U7XG4gICAgc2VsZi5zZW5kKG1zZyk7XG4gIH0sXG5cbiAgLy8gUHJvY2VzcyAnbXNnJyBhcyBhbiBpbmNvbWluZyBtZXNzYWdlLiBBcyBhIGd1YXJkIGFnYWluc3RcbiAgLy8gcmFjZSBjb25kaXRpb25zIGR1cmluZyByZWNvbm5lY3Rpb24sIGlnbm9yZSB0aGUgbWVzc2FnZSBpZlxuICAvLyAnc29ja2V0JyBpcyBub3QgdGhlIGN1cnJlbnRseSBjb25uZWN0ZWQgc29ja2V0LlxuICAvL1xuICAvLyBXZSBydW4gdGhlIG1lc3NhZ2VzIGZyb20gdGhlIGNsaWVudCBvbmUgYXQgYSB0aW1lLCBpbiB0aGUgb3JkZXJcbiAgLy8gZ2l2ZW4gYnkgdGhlIGNsaWVudC4gVGhlIG1lc3NhZ2UgaGFuZGxlciBpcyBwYXNzZWQgYW4gaWRlbXBvdGVudFxuICAvLyBmdW5jdGlvbiAndW5ibG9jaycgd2hpY2ggaXQgbWF5IGNhbGwgdG8gYWxsb3cgb3RoZXIgbWVzc2FnZXMgdG9cbiAgLy8gYmVnaW4gcnVubmluZyBpbiBwYXJhbGxlbCBpbiBhbm90aGVyIGZpYmVyIChmb3IgZXhhbXBsZSwgYSBtZXRob2RcbiAgLy8gdGhhdCB3YW50cyB0byB5aWVsZCkuIE90aGVyd2lzZSwgaXQgaXMgYXV0b21hdGljYWxseSB1bmJsb2NrZWRcbiAgLy8gd2hlbiBpdCByZXR1cm5zLlxuICAvL1xuICAvLyBBY3R1YWxseSwgd2UgZG9uJ3QgaGF2ZSB0byAndG90YWxseSBvcmRlcicgdGhlIG1lc3NhZ2VzIGluIHRoaXNcbiAgLy8gd2F5LCBidXQgaXQncyB0aGUgZWFzaWVzdCB0aGluZyB0aGF0J3MgY29ycmVjdC4gKHVuc3ViIG5lZWRzIHRvXG4gIC8vIGJlIG9yZGVyZWQgYWdhaW5zdCBzdWIsIG1ldGhvZHMgbmVlZCB0byBiZSBvcmRlcmVkIGFnYWluc3QgZWFjaFxuICAvLyBvdGhlcikuXG4gIHByb2Nlc3NNZXNzYWdlOiBmdW5jdGlvbiAobXNnX2luKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5pblF1ZXVlKSAvLyB3ZSBoYXZlIGJlZW4gZGVzdHJveWVkLlxuICAgICAgcmV0dXJuO1xuXG4gICAgLy8gUmVzcG9uZCB0byBwaW5nIGFuZCBwb25nIG1lc3NhZ2VzIGltbWVkaWF0ZWx5IHdpdGhvdXQgcXVldWluZy5cbiAgICAvLyBJZiB0aGUgbmVnb3RpYXRlZCBERFAgdmVyc2lvbiBpcyBcInByZTFcIiB3aGljaCBkaWRuJ3Qgc3VwcG9ydFxuICAgIC8vIHBpbmdzLCBwcmVzZXJ2ZSB0aGUgXCJwcmUxXCIgYmVoYXZpb3Igb2YgcmVzcG9uZGluZyB3aXRoIGEgXCJiYWRcbiAgICAvLyByZXF1ZXN0XCIgZm9yIHRoZSB1bmtub3duIG1lc3NhZ2VzLlxuICAgIC8vXG4gICAgLy8gRmliZXJzIGFyZSBuZWVkZWQgYmVjYXVzZSBoZWFydGJlYXRzIHVzZSBNZXRlb3Iuc2V0VGltZW91dCwgd2hpY2hcbiAgICAvLyBuZWVkcyBhIEZpYmVyLiBXZSBjb3VsZCBhY3R1YWxseSB1c2UgcmVndWxhciBzZXRUaW1lb3V0IGFuZCBhdm9pZFxuICAgIC8vIHRoZXNlIG5ldyBmaWJlcnMsIGJ1dCBpdCBpcyBlYXNpZXIgdG8ganVzdCBtYWtlIGV2ZXJ5dGhpbmcgdXNlXG4gICAgLy8gTWV0ZW9yLnNldFRpbWVvdXQgYW5kIG5vdCB0aGluayB0b28gaGFyZC5cbiAgICAvL1xuICAgIC8vIEFueSBtZXNzYWdlIGNvdW50cyBhcyByZWNlaXZpbmcgYSBwb25nLCBhcyBpdCBkZW1vbnN0cmF0ZXMgdGhhdFxuICAgIC8vIHRoZSBjbGllbnQgaXMgc3RpbGwgYWxpdmUuXG4gICAgaWYgKHNlbGYuaGVhcnRiZWF0KSB7XG4gICAgICBzZWxmLmhlYXJ0YmVhdC5tZXNzYWdlUmVjZWl2ZWQoKTtcbiAgICB9O1xuXG4gICAgaWYgKHNlbGYudmVyc2lvbiAhPT0gJ3ByZTEnICYmIG1zZ19pbi5tc2cgPT09ICdwaW5nJykge1xuICAgICAgaWYgKHNlbGYuX3Jlc3BvbmRUb1BpbmdzKVxuICAgICAgICBzZWxmLnNlbmQoe21zZzogXCJwb25nXCIsIGlkOiBtc2dfaW4uaWR9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHNlbGYudmVyc2lvbiAhPT0gJ3ByZTEnICYmIG1zZ19pbi5tc2cgPT09ICdwb25nJykge1xuICAgICAgLy8gU2luY2UgZXZlcnl0aGluZyBpcyBhIHBvbmcsIHRoZXJlIGlzIG5vdGhpbmcgdG8gZG9cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzZWxmLmluUXVldWUucHVzaChtc2dfaW4pO1xuICAgIGlmIChzZWxmLndvcmtlclJ1bm5pbmcpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi53b3JrZXJSdW5uaW5nID0gdHJ1ZTtcblxuICAgIHZhciBwcm9jZXNzTmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBtc2cgPSBzZWxmLmluUXVldWUgJiYgc2VsZi5pblF1ZXVlLnNoaWZ0KCk7XG4gICAgICBpZiAoIW1zZykge1xuICAgICAgICBzZWxmLndvcmtlclJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBydW5IYW5kbGVycygpIHtcbiAgICAgICAgdmFyIGJsb2NrZWQgPSB0cnVlO1xuXG4gICAgICAgIHZhciB1bmJsb2NrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmICghYmxvY2tlZClcbiAgICAgICAgICAgIHJldHVybjsgLy8gaWRlbXBvdGVudFxuICAgICAgICAgIGJsb2NrZWQgPSBmYWxzZTtcbiAgICAgICAgICBwcm9jZXNzTmV4dCgpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHNlbGYuc2VydmVyLm9uTWVzc2FnZUhvb2suZWFjaChmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgICBjYWxsYmFjayhtc2csIHNlbGYpO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoXy5oYXMoc2VsZi5wcm90b2NvbF9oYW5kbGVycywgbXNnLm1zZykpIHtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBzZWxmLnByb3RvY29sX2hhbmRsZXJzW21zZy5tc2ddLmNhbGwoXG4gICAgICAgICAgICBzZWxmLFxuICAgICAgICAgICAgbXNnLFxuICAgICAgICAgICAgdW5ibG9ja1xuICAgICAgICAgICk7XG4gICAgICAgICAgaWYgKE1ldGVvci5faXNQcm9taXNlKHJlc3VsdCkpIHtcbiAgICAgICAgICAgIHJlc3VsdC5maW5hbGx5KCgpID0+IHVuYmxvY2soKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHVuYmxvY2soKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc2VsZi5zZW5kRXJyb3IoJ0JhZCByZXF1ZXN0JywgbXNnKTtcbiAgICAgICAgICB1bmJsb2NrKCk7IC8vIGluIGNhc2UgdGhlIGhhbmRsZXIgZGlkbid0IGFscmVhZHkgZG8gaXRcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBydW5IYW5kbGVycygpO1xuICAgIH07XG5cbiAgICBwcm9jZXNzTmV4dCgpO1xuICB9LFxuXG4gIHByb3RvY29sX2hhbmRsZXJzOiB7XG4gICAgc3ViOiBhc3luYyBmdW5jdGlvbiAobXNnLCB1bmJsb2NrKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgIC8vIGNhY2hlVW5ibG9jayB0ZW1wb3Jhcmx5LCBzbyB3ZSBjYW4gY2FwdHVyZSBpdCBsYXRlclxuICAgICAgLy8gd2Ugd2lsbCB1c2UgdW5ibG9jayBpbiBjdXJyZW50IGV2ZW50TG9vcCwgc28gdGhpcyBpcyBzYWZlXG4gICAgICBzZWxmLmNhY2hlZFVuYmxvY2sgPSB1bmJsb2NrO1xuXG4gICAgICAvLyByZWplY3QgbWFsZm9ybWVkIG1lc3NhZ2VzXG4gICAgICBpZiAodHlwZW9mIChtc2cuaWQpICE9PSBcInN0cmluZ1wiIHx8XG4gICAgICAgICAgdHlwZW9mIChtc2cubmFtZSkgIT09IFwic3RyaW5nXCIgfHxcbiAgICAgICAgICAoKCdwYXJhbXMnIGluIG1zZykgJiYgIShtc2cucGFyYW1zIGluc3RhbmNlb2YgQXJyYXkpKSkge1xuICAgICAgICBzZWxmLnNlbmRFcnJvcihcIk1hbGZvcm1lZCBzdWJzY3JpcHRpb25cIiwgbXNnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXNlbGYuc2VydmVyLnB1Ymxpc2hfaGFuZGxlcnNbbXNnLm5hbWVdKSB7XG4gICAgICAgIHNlbGYuc2VuZCh7XG4gICAgICAgICAgbXNnOiAnbm9zdWInLCBpZDogbXNnLmlkLFxuICAgICAgICAgIGVycm9yOiBuZXcgTWV0ZW9yLkVycm9yKDQwNCwgYFN1YnNjcmlwdGlvbiAnJHttc2cubmFtZX0nIG5vdCBmb3VuZGApfSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHNlbGYuX25hbWVkU3Vicy5oYXMobXNnLmlkKSlcbiAgICAgICAgLy8gc3VicyBhcmUgaWRlbXBvdGVudCwgb3IgcmF0aGVyLCB0aGV5IGFyZSBpZ25vcmVkIGlmIGEgc3ViXG4gICAgICAgIC8vIHdpdGggdGhhdCBpZCBhbHJlYWR5IGV4aXN0cy4gdGhpcyBpcyBpbXBvcnRhbnQgZHVyaW5nXG4gICAgICAgIC8vIHJlY29ubmVjdC5cbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICAvLyBYWFggSXQnZCBiZSBtdWNoIGJldHRlciBpZiB3ZSBoYWQgZ2VuZXJpYyBob29rcyB3aGVyZSBhbnkgcGFja2FnZSBjYW5cbiAgICAgIC8vIGhvb2sgaW50byBzdWJzY3JpcHRpb24gaGFuZGxpbmcsIGJ1dCBpbiB0aGUgbWVhbiB3aGlsZSB3ZSBzcGVjaWFsIGNhc2VcbiAgICAgIC8vIGRkcC1yYXRlLWxpbWl0ZXIgcGFja2FnZS4gVGhpcyBpcyBhbHNvIGRvbmUgZm9yIHdlYWsgcmVxdWlyZW1lbnRzIHRvXG4gICAgICAvLyBhZGQgdGhlIGRkcC1yYXRlLWxpbWl0ZXIgcGFja2FnZSBpbiBjYXNlIHdlIGRvbid0IGhhdmUgQWNjb3VudHMuIEFcbiAgICAgIC8vIHVzZXIgdHJ5aW5nIHRvIHVzZSB0aGUgZGRwLXJhdGUtbGltaXRlciBtdXN0IGV4cGxpY2l0bHkgcmVxdWlyZSBpdC5cbiAgICAgIGlmIChQYWNrYWdlWydkZHAtcmF0ZS1saW1pdGVyJ10pIHtcbiAgICAgICAgdmFyIEREUFJhdGVMaW1pdGVyID0gUGFja2FnZVsnZGRwLXJhdGUtbGltaXRlciddLkREUFJhdGVMaW1pdGVyO1xuICAgICAgICB2YXIgcmF0ZUxpbWl0ZXJJbnB1dCA9IHtcbiAgICAgICAgICB1c2VySWQ6IHNlbGYudXNlcklkLFxuICAgICAgICAgIGNsaWVudEFkZHJlc3M6IHNlbGYuY29ubmVjdGlvbkhhbmRsZS5jbGllbnRBZGRyZXNzLFxuICAgICAgICAgIHR5cGU6IFwic3Vic2NyaXB0aW9uXCIsXG4gICAgICAgICAgbmFtZTogbXNnLm5hbWUsXG4gICAgICAgICAgY29ubmVjdGlvbklkOiBzZWxmLmlkXG4gICAgICAgIH07XG5cbiAgICAgICAgRERQUmF0ZUxpbWl0ZXIuX2luY3JlbWVudChyYXRlTGltaXRlcklucHV0KTtcbiAgICAgICAgdmFyIHJhdGVMaW1pdFJlc3VsdCA9IEREUFJhdGVMaW1pdGVyLl9jaGVjayhyYXRlTGltaXRlcklucHV0KTtcbiAgICAgICAgaWYgKCFyYXRlTGltaXRSZXN1bHQuYWxsb3dlZCkge1xuICAgICAgICAgIHNlbGYuc2VuZCh7XG4gICAgICAgICAgICBtc2c6ICdub3N1YicsIGlkOiBtc2cuaWQsXG4gICAgICAgICAgICBlcnJvcjogbmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgICAgICAgJ3Rvby1tYW55LXJlcXVlc3RzJyxcbiAgICAgICAgICAgICAgRERQUmF0ZUxpbWl0ZXIuZ2V0RXJyb3JNZXNzYWdlKHJhdGVMaW1pdFJlc3VsdCksXG4gICAgICAgICAgICAgIHt0aW1lVG9SZXNldDogcmF0ZUxpbWl0UmVzdWx0LnRpbWVUb1Jlc2V0fSlcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIGhhbmRsZXIgPSBzZWxmLnNlcnZlci5wdWJsaXNoX2hhbmRsZXJzW21zZy5uYW1lXTtcblxuICAgICAgYXdhaXQgc2VsZi5fc3RhcnRTdWJzY3JpcHRpb24oaGFuZGxlciwgbXNnLmlkLCBtc2cucGFyYW1zLCBtc2cubmFtZSk7XG5cbiAgICAgIC8vIGNsZWFuaW5nIGNhY2hlZCB1bmJsb2NrXG4gICAgICBzZWxmLmNhY2hlZFVuYmxvY2sgPSBudWxsO1xuICAgIH0sXG5cbiAgICB1bnN1YjogZnVuY3Rpb24gKG1zZykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICBzZWxmLl9zdG9wU3Vic2NyaXB0aW9uKG1zZy5pZCk7XG4gICAgfSxcblxuICAgIG1ldGhvZDogYXN5bmMgZnVuY3Rpb24gKG1zZywgdW5ibG9jaykge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAvLyBSZWplY3QgbWFsZm9ybWVkIG1lc3NhZ2VzLlxuICAgICAgLy8gRm9yIG5vdywgd2Ugc2lsZW50bHkgaWdub3JlIHVua25vd24gYXR0cmlidXRlcyxcbiAgICAgIC8vIGZvciBmb3J3YXJkcyBjb21wYXRpYmlsaXR5LlxuICAgICAgaWYgKHR5cGVvZiAobXNnLmlkKSAhPT0gXCJzdHJpbmdcIiB8fFxuICAgICAgICAgIHR5cGVvZiAobXNnLm1ldGhvZCkgIT09IFwic3RyaW5nXCIgfHxcbiAgICAgICAgICAoKCdwYXJhbXMnIGluIG1zZykgJiYgIShtc2cucGFyYW1zIGluc3RhbmNlb2YgQXJyYXkpKSB8fFxuICAgICAgICAgICgoJ3JhbmRvbVNlZWQnIGluIG1zZykgJiYgKHR5cGVvZiBtc2cucmFuZG9tU2VlZCAhPT0gXCJzdHJpbmdcIikpKSB7XG4gICAgICAgIHNlbGYuc2VuZEVycm9yKFwiTWFsZm9ybWVkIG1ldGhvZCBpbnZvY2F0aW9uXCIsIG1zZyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIHJhbmRvbVNlZWQgPSBtc2cucmFuZG9tU2VlZCB8fCBudWxsO1xuXG4gICAgICAvLyBTZXQgdXAgdG8gbWFyayB0aGUgbWV0aG9kIGFzIHNhdGlzZmllZCBvbmNlIGFsbCBvYnNlcnZlcnNcbiAgICAgIC8vIChhbmQgc3Vic2NyaXB0aW9ucykgaGF2ZSByZWFjdGVkIHRvIGFueSB3cml0ZXMgdGhhdCB3ZXJlXG4gICAgICAvLyBkb25lLlxuICAgICAgdmFyIGZlbmNlID0gbmV3IEREUFNlcnZlci5fV3JpdGVGZW5jZTtcbiAgICAgIGZlbmNlLm9uQWxsQ29tbWl0dGVkKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gUmV0aXJlIHRoZSBmZW5jZSBzbyB0aGF0IGZ1dHVyZSB3cml0ZXMgYXJlIGFsbG93ZWQuXG4gICAgICAgIC8vIFRoaXMgbWVhbnMgdGhhdCBjYWxsYmFja3MgbGlrZSB0aW1lcnMgYXJlIGZyZWUgdG8gdXNlXG4gICAgICAgIC8vIHRoZSBmZW5jZSwgYW5kIGlmIHRoZXkgZmlyZSBiZWZvcmUgaXQncyBhcm1lZCAoZm9yXG4gICAgICAgIC8vIGV4YW1wbGUsIGJlY2F1c2UgdGhlIG1ldGhvZCB3YWl0cyBmb3IgdGhlbSkgdGhlaXJcbiAgICAgICAgLy8gd3JpdGVzIHdpbGwgYmUgaW5jbHVkZWQgaW4gdGhlIGZlbmNlLlxuICAgICAgICBmZW5jZS5yZXRpcmUoKTtcbiAgICAgICAgc2VsZi5zZW5kKHttc2c6ICd1cGRhdGVkJywgbWV0aG9kczogW21zZy5pZF19KTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBGaW5kIHRoZSBoYW5kbGVyXG4gICAgICB2YXIgaGFuZGxlciA9IHNlbGYuc2VydmVyLm1ldGhvZF9oYW5kbGVyc1ttc2cubWV0aG9kXTtcbiAgICAgIGlmICghaGFuZGxlcikge1xuICAgICAgICBzZWxmLnNlbmQoe1xuICAgICAgICAgIG1zZzogJ3Jlc3VsdCcsIGlkOiBtc2cuaWQsXG4gICAgICAgICAgZXJyb3I6IG5ldyBNZXRlb3IuRXJyb3IoNDA0LCBgTWV0aG9kICcke21zZy5tZXRob2R9JyBub3QgZm91bmRgKX0pO1xuICAgICAgICBhd2FpdCBmZW5jZS5hcm0oKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgc2V0VXNlcklkID0gZnVuY3Rpb24odXNlcklkKSB7XG4gICAgICAgIHNlbGYuX3NldFVzZXJJZCh1c2VySWQpO1xuICAgICAgfTtcblxuICAgICAgdmFyIGludm9jYXRpb24gPSBuZXcgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb24oe1xuICAgICAgICBpc1NpbXVsYXRpb246IGZhbHNlLFxuICAgICAgICB1c2VySWQ6IHNlbGYudXNlcklkLFxuICAgICAgICBzZXRVc2VySWQ6IHNldFVzZXJJZCxcbiAgICAgICAgdW5ibG9jazogdW5ibG9jayxcbiAgICAgICAgY29ubmVjdGlvbjogc2VsZi5jb25uZWN0aW9uSGFuZGxlLFxuICAgICAgICByYW5kb21TZWVkOiByYW5kb21TZWVkLFxuICAgICAgICBmZW5jZSxcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBwcm9taXNlID0gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAvLyBYWFggSXQnZCBiZSBiZXR0ZXIgaWYgd2UgY291bGQgaG9vayBpbnRvIG1ldGhvZCBoYW5kbGVycyBiZXR0ZXIgYnV0XG4gICAgICAgIC8vIGZvciBub3csIHdlIG5lZWQgdG8gY2hlY2sgaWYgdGhlIGRkcC1yYXRlLWxpbWl0ZXIgZXhpc3RzIHNpbmNlIHdlXG4gICAgICAgIC8vIGhhdmUgYSB3ZWFrIHJlcXVpcmVtZW50IGZvciB0aGUgZGRwLXJhdGUtbGltaXRlciBwYWNrYWdlIHRvIGJlIGFkZGVkXG4gICAgICAgIC8vIHRvIG91ciBhcHBsaWNhdGlvbi5cbiAgICAgICAgaWYgKFBhY2thZ2VbJ2RkcC1yYXRlLWxpbWl0ZXInXSkge1xuICAgICAgICAgIHZhciBERFBSYXRlTGltaXRlciA9IFBhY2thZ2VbJ2RkcC1yYXRlLWxpbWl0ZXInXS5ERFBSYXRlTGltaXRlcjtcbiAgICAgICAgICB2YXIgcmF0ZUxpbWl0ZXJJbnB1dCA9IHtcbiAgICAgICAgICAgIHVzZXJJZDogc2VsZi51c2VySWQsXG4gICAgICAgICAgICBjbGllbnRBZGRyZXNzOiBzZWxmLmNvbm5lY3Rpb25IYW5kbGUuY2xpZW50QWRkcmVzcyxcbiAgICAgICAgICAgIHR5cGU6IFwibWV0aG9kXCIsXG4gICAgICAgICAgICBuYW1lOiBtc2cubWV0aG9kLFxuICAgICAgICAgICAgY29ubmVjdGlvbklkOiBzZWxmLmlkXG4gICAgICAgICAgfTtcbiAgICAgICAgICBERFBSYXRlTGltaXRlci5faW5jcmVtZW50KHJhdGVMaW1pdGVySW5wdXQpO1xuICAgICAgICAgIHZhciByYXRlTGltaXRSZXN1bHQgPSBERFBSYXRlTGltaXRlci5fY2hlY2socmF0ZUxpbWl0ZXJJbnB1dClcbiAgICAgICAgICBpZiAoIXJhdGVMaW1pdFJlc3VsdC5hbGxvd2VkKSB7XG4gICAgICAgICAgICByZWplY3QobmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgICAgICAgXCJ0b28tbWFueS1yZXF1ZXN0c1wiLFxuICAgICAgICAgICAgICBERFBSYXRlTGltaXRlci5nZXRFcnJvck1lc3NhZ2UocmF0ZUxpbWl0UmVzdWx0KSxcbiAgICAgICAgICAgICAge3RpbWVUb1Jlc2V0OiByYXRlTGltaXRSZXN1bHQudGltZVRvUmVzZXR9XG4gICAgICAgICAgICApKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBnZXRDdXJyZW50TWV0aG9kSW52b2NhdGlvblJlc3VsdCA9ICgpID0+XG4gICAgICAgICAgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi53aXRoVmFsdWUoXG4gICAgICAgICAgICBpbnZvY2F0aW9uLFxuICAgICAgICAgICAgKCkgPT5cbiAgICAgICAgICAgICAgbWF5YmVBdWRpdEFyZ3VtZW50Q2hlY2tzKFxuICAgICAgICAgICAgICAgIGhhbmRsZXIsXG4gICAgICAgICAgICAgICAgaW52b2NhdGlvbixcbiAgICAgICAgICAgICAgICBtc2cucGFyYW1zLFxuICAgICAgICAgICAgICAgIFwiY2FsbCB0byAnXCIgKyBtc2cubWV0aG9kICsgXCInXCJcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbmFtZTogJ2dldEN1cnJlbnRNZXRob2RJbnZvY2F0aW9uUmVzdWx0JyxcbiAgICAgICAgICAgICAga2V5TmFtZTogJ2dldEN1cnJlbnRNZXRob2RJbnZvY2F0aW9uUmVzdWx0JyxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuICAgICAgICByZXNvbHZlKFxuICAgICAgICAgIEREUFNlcnZlci5fQ3VycmVudFdyaXRlRmVuY2Uud2l0aFZhbHVlKFxuICAgICAgICAgICAgZmVuY2UsXG4gICAgICAgICAgICBnZXRDdXJyZW50TWV0aG9kSW52b2NhdGlvblJlc3VsdCxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgbmFtZTogJ0REUFNlcnZlci5fQ3VycmVudFdyaXRlRmVuY2UnLFxuICAgICAgICAgICAgICBrZXlOYW1lOiAnX0N1cnJlbnRXcml0ZUZlbmNlJyxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgICB9KTtcblxuICAgICAgYXN5bmMgZnVuY3Rpb24gZmluaXNoKCkge1xuICAgICAgICBhd2FpdCBmZW5jZS5hcm0oKTtcbiAgICAgICAgdW5ibG9jaygpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBwYXlsb2FkID0ge1xuICAgICAgICBtc2c6IFwicmVzdWx0XCIsXG4gICAgICAgIGlkOiBtc2cuaWRcbiAgICAgIH07XG4gICAgICByZXR1cm4gcHJvbWlzZS50aGVuKGFzeW5jIHJlc3VsdCA9PiB7XG4gICAgICAgIGF3YWl0IGZpbmlzaCgpO1xuICAgICAgICBpZiAocmVzdWx0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBwYXlsb2FkLnJlc3VsdCA9IHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLnNlbmQocGF5bG9hZCk7XG4gICAgICB9LCBhc3luYyAoZXhjZXB0aW9uKSA9PiB7XG4gICAgICAgIGF3YWl0IGZpbmlzaCgpO1xuICAgICAgICBwYXlsb2FkLmVycm9yID0gd3JhcEludGVybmFsRXhjZXB0aW9uKFxuICAgICAgICAgIGV4Y2VwdGlvbixcbiAgICAgICAgICBgd2hpbGUgaW52b2tpbmcgbWV0aG9kICcke21zZy5tZXRob2R9J2BcbiAgICAgICAgKTtcbiAgICAgICAgc2VsZi5zZW5kKHBheWxvYWQpO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIF9lYWNoU3ViOiBmdW5jdGlvbiAoZikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9uYW1lZFN1YnMuZm9yRWFjaChmKTtcbiAgICBzZWxmLl91bml2ZXJzYWxTdWJzLmZvckVhY2goZik7XG4gIH0sXG5cbiAgX2RpZmZDb2xsZWN0aW9uVmlld3M6IGZ1bmN0aW9uIChiZWZvcmVDVnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgRGlmZlNlcXVlbmNlLmRpZmZNYXBzKGJlZm9yZUNWcywgc2VsZi5jb2xsZWN0aW9uVmlld3MsIHtcbiAgICAgIGJvdGg6IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgbGVmdFZhbHVlLCByaWdodFZhbHVlKSB7XG4gICAgICAgIHJpZ2h0VmFsdWUuZGlmZihsZWZ0VmFsdWUpO1xuICAgICAgfSxcbiAgICAgIHJpZ2h0T25seTogZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCByaWdodFZhbHVlKSB7XG4gICAgICAgIHJpZ2h0VmFsdWUuZG9jdW1lbnRzLmZvckVhY2goZnVuY3Rpb24gKGRvY1ZpZXcsIGlkKSB7XG4gICAgICAgICAgc2VsZi5zZW5kQWRkZWQoY29sbGVjdGlvbk5hbWUsIGlkLCBkb2NWaWV3LmdldEZpZWxkcygpKTtcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgbGVmdE9ubHk6IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgbGVmdFZhbHVlKSB7XG4gICAgICAgIGxlZnRWYWx1ZS5kb2N1bWVudHMuZm9yRWFjaChmdW5jdGlvbiAoZG9jLCBpZCkge1xuICAgICAgICAgIHNlbGYuc2VuZFJlbW92ZWQoY29sbGVjdGlvbk5hbWUsIGlkKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gU2V0cyB0aGUgY3VycmVudCB1c2VyIGlkIGluIGFsbCBhcHByb3ByaWF0ZSBjb250ZXh0cyBhbmQgcmVydW5zXG4gIC8vIGFsbCBzdWJzY3JpcHRpb25zXG4gIF9zZXRVc2VySWQ6IGZ1bmN0aW9uKHVzZXJJZCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmICh1c2VySWQgIT09IG51bGwgJiYgdHlwZW9mIHVzZXJJZCAhPT0gXCJzdHJpbmdcIilcbiAgICAgIHRocm93IG5ldyBFcnJvcihcInNldFVzZXJJZCBtdXN0IGJlIGNhbGxlZCBvbiBzdHJpbmcgb3IgbnVsbCwgbm90IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlb2YgdXNlcklkKTtcblxuICAgIC8vIFByZXZlbnQgbmV3bHktY3JlYXRlZCB1bml2ZXJzYWwgc3Vic2NyaXB0aW9ucyBmcm9tIGJlaW5nIGFkZGVkIHRvIG91clxuICAgIC8vIHNlc3Npb24uIFRoZXkgd2lsbCBiZSBmb3VuZCBiZWxvdyB3aGVuIHdlIGNhbGwgc3RhcnRVbml2ZXJzYWxTdWJzLlxuICAgIC8vXG4gICAgLy8gKFdlIGRvbid0IGhhdmUgdG8gd29ycnkgYWJvdXQgbmFtZWQgc3Vic2NyaXB0aW9ucywgYmVjYXVzZSB3ZSBvbmx5IGFkZFxuICAgIC8vIHRoZW0gd2hlbiB3ZSBwcm9jZXNzIGEgJ3N1YicgbWVzc2FnZS4gV2UgYXJlIGN1cnJlbnRseSBwcm9jZXNzaW5nIGFcbiAgICAvLyAnbWV0aG9kJyBtZXNzYWdlLCBhbmQgdGhlIG1ldGhvZCBkaWQgbm90IHVuYmxvY2ssIGJlY2F1c2UgaXQgaXMgaWxsZWdhbFxuICAgIC8vIHRvIGNhbGwgc2V0VXNlcklkIGFmdGVyIHVuYmxvY2suIFRodXMgd2UgY2Fubm90IGJlIGNvbmN1cnJlbnRseSBhZGRpbmcgYVxuICAgIC8vIG5ldyBuYW1lZCBzdWJzY3JpcHRpb24pLlxuICAgIHNlbGYuX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMgPSB0cnVlO1xuXG4gICAgLy8gUHJldmVudCBjdXJyZW50IHN1YnMgZnJvbSB1cGRhdGluZyBvdXIgY29sbGVjdGlvblZpZXdzIGFuZCBjYWxsIHRoZWlyXG4gICAgLy8gc3RvcCBjYWxsYmFja3MuIFRoaXMgbWF5IHlpZWxkLlxuICAgIHNlbGYuX2VhY2hTdWIoZnVuY3Rpb24gKHN1Yikge1xuICAgICAgc3ViLl9kZWFjdGl2YXRlKCk7XG4gICAgfSk7XG5cbiAgICAvLyBBbGwgc3VicyBzaG91bGQgbm93IGJlIGRlYWN0aXZhdGVkLiBTdG9wIHNlbmRpbmcgbWVzc2FnZXMgdG8gdGhlIGNsaWVudCxcbiAgICAvLyBzYXZlIHRoZSBzdGF0ZSBvZiB0aGUgcHVibGlzaGVkIGNvbGxlY3Rpb25zLCByZXNldCB0byBhbiBlbXB0eSB2aWV3LCBhbmRcbiAgICAvLyB1cGRhdGUgdGhlIHVzZXJJZC5cbiAgICBzZWxmLl9pc1NlbmRpbmcgPSBmYWxzZTtcbiAgICB2YXIgYmVmb3JlQ1ZzID0gc2VsZi5jb2xsZWN0aW9uVmlld3M7XG4gICAgc2VsZi5jb2xsZWN0aW9uVmlld3MgPSBuZXcgTWFwKCk7XG4gICAgc2VsZi51c2VySWQgPSB1c2VySWQ7XG5cbiAgICAvLyBfc2V0VXNlcklkIGlzIG5vcm1hbGx5IGNhbGxlZCBmcm9tIGEgTWV0ZW9yIG1ldGhvZCB3aXRoXG4gICAgLy8gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiBzZXQuIEJ1dCBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uIGlzIG5vdFxuICAgIC8vIGV4cGVjdGVkIHRvIGJlIHNldCBpbnNpZGUgYSBwdWJsaXNoIGZ1bmN0aW9uLCBzbyB3ZSB0ZW1wb3JhcnkgdW5zZXQgaXQuXG4gICAgLy8gSW5zaWRlIGEgcHVibGlzaCBmdW5jdGlvbiBERFAuX0N1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24gaXMgc2V0LlxuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24ud2l0aFZhbHVlKHVuZGVmaW5lZCwgZnVuY3Rpb24gKCkge1xuICAgICAgLy8gU2F2ZSB0aGUgb2xkIG5hbWVkIHN1YnMsIGFuZCByZXNldCB0byBoYXZpbmcgbm8gc3Vic2NyaXB0aW9ucy5cbiAgICAgIHZhciBvbGROYW1lZFN1YnMgPSBzZWxmLl9uYW1lZFN1YnM7XG4gICAgICBzZWxmLl9uYW1lZFN1YnMgPSBuZXcgTWFwKCk7XG4gICAgICBzZWxmLl91bml2ZXJzYWxTdWJzID0gW107XG5cbiAgICAgIG9sZE5hbWVkU3Vicy5mb3JFYWNoKGZ1bmN0aW9uIChzdWIsIHN1YnNjcmlwdGlvbklkKSB7XG4gICAgICAgIHZhciBuZXdTdWIgPSBzdWIuX3JlY3JlYXRlKCk7XG4gICAgICAgIHNlbGYuX25hbWVkU3Vicy5zZXQoc3Vic2NyaXB0aW9uSWQsIG5ld1N1Yik7XG4gICAgICAgIC8vIG5iOiBpZiB0aGUgaGFuZGxlciB0aHJvd3Mgb3IgY2FsbHMgdGhpcy5lcnJvcigpLCBpdCB3aWxsIGluIGZhY3RcbiAgICAgICAgLy8gaW1tZWRpYXRlbHkgc2VuZCBpdHMgJ25vc3ViJy4gVGhpcyBpcyBPSywgdGhvdWdoLlxuICAgICAgICBuZXdTdWIuX3J1bkhhbmRsZXIoKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBBbGxvdyBuZXdseS1jcmVhdGVkIHVuaXZlcnNhbCBzdWJzIHRvIGJlIHN0YXJ0ZWQgb24gb3VyIGNvbm5lY3Rpb24gaW5cbiAgICAgIC8vIHBhcmFsbGVsIHdpdGggdGhlIG9uZXMgd2UncmUgc3Bpbm5pbmcgdXAgaGVyZSwgYW5kIHNwaW4gdXAgdW5pdmVyc2FsXG4gICAgICAvLyBzdWJzLlxuICAgICAgc2VsZi5fZG9udFN0YXJ0TmV3VW5pdmVyc2FsU3VicyA9IGZhbHNlO1xuICAgICAgc2VsZi5zdGFydFVuaXZlcnNhbFN1YnMoKTtcbiAgICB9LCB7IG5hbWU6ICdfc2V0VXNlcklkJyB9KTtcblxuICAgIC8vIFN0YXJ0IHNlbmRpbmcgbWVzc2FnZXMgYWdhaW4sIGJlZ2lubmluZyB3aXRoIHRoZSBkaWZmIGZyb20gdGhlIHByZXZpb3VzXG4gICAgLy8gc3RhdGUgb2YgdGhlIHdvcmxkIHRvIHRoZSBjdXJyZW50IHN0YXRlLiBObyB5aWVsZHMgYXJlIGFsbG93ZWQgZHVyaW5nXG4gICAgLy8gdGhpcyBkaWZmLCBzbyB0aGF0IG90aGVyIGNoYW5nZXMgY2Fubm90IGludGVybGVhdmUuXG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5faXNTZW5kaW5nID0gdHJ1ZTtcbiAgICAgIHNlbGYuX2RpZmZDb2xsZWN0aW9uVmlld3MoYmVmb3JlQ1ZzKTtcbiAgICAgIGlmICghXy5pc0VtcHR5KHNlbGYuX3BlbmRpbmdSZWFkeSkpIHtcbiAgICAgICAgc2VsZi5zZW5kUmVhZHkoc2VsZi5fcGVuZGluZ1JlYWR5KTtcbiAgICAgICAgc2VsZi5fcGVuZGluZ1JlYWR5ID0gW107XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgX3N0YXJ0U3Vic2NyaXB0aW9uOiBmdW5jdGlvbiAoaGFuZGxlciwgc3ViSWQsIHBhcmFtcywgbmFtZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBzdWIgPSBuZXcgU3Vic2NyaXB0aW9uKFxuICAgICAgc2VsZiwgaGFuZGxlciwgc3ViSWQsIHBhcmFtcywgbmFtZSk7XG5cbiAgICBsZXQgdW5ibG9ja0hhbmRlciA9IHNlbGYuY2FjaGVkVW5ibG9jaztcbiAgICAvLyBfc3RhcnRTdWJzY3JpcHRpb24gbWF5IGNhbGwgZnJvbSBhIGxvdCBwbGFjZXNcbiAgICAvLyBzbyBjYWNoZWRVbmJsb2NrIG1pZ2h0IGJlIG51bGwgaW4gc29tZWNhc2VzXG4gICAgLy8gYXNzaWduIHRoZSBjYWNoZWRVbmJsb2NrXG4gICAgc3ViLnVuYmxvY2sgPSB1bmJsb2NrSGFuZGVyIHx8ICgoKSA9PiB7fSk7XG5cbiAgICBpZiAoc3ViSWQpXG4gICAgICBzZWxmLl9uYW1lZFN1YnMuc2V0KHN1YklkLCBzdWIpO1xuICAgIGVsc2VcbiAgICAgIHNlbGYuX3VuaXZlcnNhbFN1YnMucHVzaChzdWIpO1xuXG4gICAgcmV0dXJuIHN1Yi5fcnVuSGFuZGxlcigpO1xuICB9LFxuXG4gIC8vIFRlYXIgZG93biBzcGVjaWZpZWQgc3Vic2NyaXB0aW9uXG4gIF9zdG9wU3Vic2NyaXB0aW9uOiBmdW5jdGlvbiAoc3ViSWQsIGVycm9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIHN1Yk5hbWUgPSBudWxsO1xuICAgIGlmIChzdWJJZCkge1xuICAgICAgdmFyIG1heWJlU3ViID0gc2VsZi5fbmFtZWRTdWJzLmdldChzdWJJZCk7XG4gICAgICBpZiAobWF5YmVTdWIpIHtcbiAgICAgICAgc3ViTmFtZSA9IG1heWJlU3ViLl9uYW1lO1xuICAgICAgICBtYXliZVN1Yi5fcmVtb3ZlQWxsRG9jdW1lbnRzKCk7XG4gICAgICAgIG1heWJlU3ViLl9kZWFjdGl2YXRlKCk7XG4gICAgICAgIHNlbGYuX25hbWVkU3Vicy5kZWxldGUoc3ViSWQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciByZXNwb25zZSA9IHttc2c6ICdub3N1YicsIGlkOiBzdWJJZH07XG5cbiAgICBpZiAoZXJyb3IpIHtcbiAgICAgIHJlc3BvbnNlLmVycm9yID0gd3JhcEludGVybmFsRXhjZXB0aW9uKFxuICAgICAgICBlcnJvcixcbiAgICAgICAgc3ViTmFtZSA/IChcImZyb20gc3ViIFwiICsgc3ViTmFtZSArIFwiIGlkIFwiICsgc3ViSWQpXG4gICAgICAgICAgOiAoXCJmcm9tIHN1YiBpZCBcIiArIHN1YklkKSk7XG4gICAgfVxuXG4gICAgc2VsZi5zZW5kKHJlc3BvbnNlKTtcbiAgfSxcblxuICAvLyBUZWFyIGRvd24gYWxsIHN1YnNjcmlwdGlvbnMuIE5vdGUgdGhhdCB0aGlzIGRvZXMgTk9UIHNlbmQgcmVtb3ZlZCBvciBub3N1YlxuICAvLyBtZXNzYWdlcywgc2luY2Ugd2UgYXNzdW1lIHRoZSBjbGllbnQgaXMgZ29uZS5cbiAgX2RlYWN0aXZhdGVBbGxTdWJzY3JpcHRpb25zOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgc2VsZi5fbmFtZWRTdWJzLmZvckVhY2goZnVuY3Rpb24gKHN1YiwgaWQpIHtcbiAgICAgIHN1Yi5fZGVhY3RpdmF0ZSgpO1xuICAgIH0pO1xuICAgIHNlbGYuX25hbWVkU3VicyA9IG5ldyBNYXAoKTtcblxuICAgIHNlbGYuX3VuaXZlcnNhbFN1YnMuZm9yRWFjaChmdW5jdGlvbiAoc3ViKSB7XG4gICAgICBzdWIuX2RlYWN0aXZhdGUoKTtcbiAgICB9KTtcbiAgICBzZWxmLl91bml2ZXJzYWxTdWJzID0gW107XG4gIH0sXG5cbiAgLy8gRGV0ZXJtaW5lIHRoZSByZW1vdGUgY2xpZW50J3MgSVAgYWRkcmVzcywgYmFzZWQgb24gdGhlXG4gIC8vIEhUVFBfRk9SV0FSREVEX0NPVU5UIGVudmlyb25tZW50IHZhcmlhYmxlIHJlcHJlc2VudGluZyBob3cgbWFueVxuICAvLyBwcm94aWVzIHRoZSBzZXJ2ZXIgaXMgYmVoaW5kLlxuICBfY2xpZW50QWRkcmVzczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIC8vIEZvciB0aGUgcmVwb3J0ZWQgY2xpZW50IGFkZHJlc3MgZm9yIGEgY29ubmVjdGlvbiB0byBiZSBjb3JyZWN0LFxuICAgIC8vIHRoZSBkZXZlbG9wZXIgbXVzdCBzZXQgdGhlIEhUVFBfRk9SV0FSREVEX0NPVU5UIGVudmlyb25tZW50XG4gICAgLy8gdmFyaWFibGUgdG8gYW4gaW50ZWdlciByZXByZXNlbnRpbmcgdGhlIG51bWJlciBvZiBob3BzIHRoZXlcbiAgICAvLyBleHBlY3QgaW4gdGhlIGB4LWZvcndhcmRlZC1mb3JgIGhlYWRlci4gRS5nLiwgc2V0IHRvIFwiMVwiIGlmIHRoZVxuICAgIC8vIHNlcnZlciBpcyBiZWhpbmQgb25lIHByb3h5LlxuICAgIC8vXG4gICAgLy8gVGhpcyBjb3VsZCBiZSBjb21wdXRlZCBvbmNlIGF0IHN0YXJ0dXAgaW5zdGVhZCBvZiBldmVyeSB0aW1lLlxuICAgIHZhciBodHRwRm9yd2FyZGVkQ291bnQgPSBwYXJzZUludChwcm9jZXNzLmVudlsnSFRUUF9GT1JXQVJERURfQ09VTlQnXSkgfHwgMDtcblxuICAgIGlmIChodHRwRm9yd2FyZGVkQ291bnQgPT09IDApXG4gICAgICByZXR1cm4gc2VsZi5zb2NrZXQucmVtb3RlQWRkcmVzcztcblxuICAgIHZhciBmb3J3YXJkZWRGb3IgPSBzZWxmLnNvY2tldC5oZWFkZXJzW1wieC1mb3J3YXJkZWQtZm9yXCJdO1xuICAgIGlmICghIF8uaXNTdHJpbmcoZm9yd2FyZGVkRm9yKSlcbiAgICAgIHJldHVybiBudWxsO1xuICAgIGZvcndhcmRlZEZvciA9IGZvcndhcmRlZEZvci50cmltKCkuc3BsaXQoL1xccyosXFxzKi8pO1xuXG4gICAgLy8gVHlwaWNhbGx5IHRoZSBmaXJzdCB2YWx1ZSBpbiB0aGUgYHgtZm9yd2FyZGVkLWZvcmAgaGVhZGVyIGlzXG4gICAgLy8gdGhlIG9yaWdpbmFsIElQIGFkZHJlc3Mgb2YgdGhlIGNsaWVudCBjb25uZWN0aW5nIHRvIHRoZSBmaXJzdFxuICAgIC8vIHByb3h5LiAgSG93ZXZlciwgdGhlIGVuZCB1c2VyIGNhbiBlYXNpbHkgc3Bvb2YgdGhlIGhlYWRlciwgaW5cbiAgICAvLyB3aGljaCBjYXNlIHRoZSBmaXJzdCB2YWx1ZShzKSB3aWxsIGJlIHRoZSBmYWtlIElQIGFkZHJlc3MgZnJvbVxuICAgIC8vIHRoZSB1c2VyIHByZXRlbmRpbmcgdG8gYmUgYSBwcm94eSByZXBvcnRpbmcgdGhlIG9yaWdpbmFsIElQXG4gICAgLy8gYWRkcmVzcyB2YWx1ZS4gIEJ5IGNvdW50aW5nIEhUVFBfRk9SV0FSREVEX0NPVU5UIGJhY2sgZnJvbSB0aGVcbiAgICAvLyBlbmQgb2YgdGhlIGxpc3QsIHdlIGVuc3VyZSB0aGF0IHdlIGdldCB0aGUgSVAgYWRkcmVzcyBiZWluZ1xuICAgIC8vIHJlcG9ydGVkIGJ5ICpvdXIqIGZpcnN0IHByb3h5LlxuXG4gICAgaWYgKGh0dHBGb3J3YXJkZWRDb3VudCA8IDAgfHwgaHR0cEZvcndhcmRlZENvdW50ID4gZm9yd2FyZGVkRm9yLmxlbmd0aClcbiAgICAgIHJldHVybiBudWxsO1xuXG4gICAgcmV0dXJuIGZvcndhcmRlZEZvcltmb3J3YXJkZWRGb3IubGVuZ3RoIC0gaHR0cEZvcndhcmRlZENvdW50XTtcbiAgfVxufSk7XG5cbi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4vKiBTdWJzY3JpcHRpb24gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqL1xuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuLy8gQ3RvciBmb3IgYSBzdWIgaGFuZGxlOiB0aGUgaW5wdXQgdG8gZWFjaCBwdWJsaXNoIGZ1bmN0aW9uXG5cbi8vIEluc3RhbmNlIG5hbWUgaXMgdGhpcyBiZWNhdXNlIGl0J3MgdXN1YWxseSByZWZlcnJlZCB0byBhcyB0aGlzIGluc2lkZSBhXG4vLyBwdWJsaXNoXG4vKipcbiAqIEBzdW1tYXJ5IFRoZSBzZXJ2ZXIncyBzaWRlIG9mIGEgc3Vic2NyaXB0aW9uXG4gKiBAY2xhc3MgU3Vic2NyaXB0aW9uXG4gKiBAaW5zdGFuY2VOYW1lIHRoaXNcbiAqIEBzaG93SW5zdGFuY2VOYW1lIHRydWVcbiAqL1xudmFyIFN1YnNjcmlwdGlvbiA9IGZ1bmN0aW9uIChcbiAgICBzZXNzaW9uLCBoYW5kbGVyLCBzdWJzY3JpcHRpb25JZCwgcGFyYW1zLCBuYW1lKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5fc2Vzc2lvbiA9IHNlc3Npb247IC8vIHR5cGUgaXMgU2Vzc2lvblxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBY2Nlc3MgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiBUaGUgaW5jb21pbmcgW2Nvbm5lY3Rpb25dKCNtZXRlb3Jfb25jb25uZWN0aW9uKSBmb3IgdGhpcyBzdWJzY3JpcHRpb24uXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG5hbWUgIGNvbm5lY3Rpb25cbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIHNlbGYuY29ubmVjdGlvbiA9IHNlc3Npb24uY29ubmVjdGlvbkhhbmRsZTsgLy8gcHVibGljIEFQSSBvYmplY3RcblxuICBzZWxmLl9oYW5kbGVyID0gaGFuZGxlcjtcblxuICAvLyBNeSBzdWJzY3JpcHRpb24gSUQgKGdlbmVyYXRlZCBieSBjbGllbnQsIHVuZGVmaW5lZCBmb3IgdW5pdmVyc2FsIHN1YnMpLlxuICBzZWxmLl9zdWJzY3JpcHRpb25JZCA9IHN1YnNjcmlwdGlvbklkO1xuICAvLyBVbmRlZmluZWQgZm9yIHVuaXZlcnNhbCBzdWJzXG4gIHNlbGYuX25hbWUgPSBuYW1lO1xuXG4gIHNlbGYuX3BhcmFtcyA9IHBhcmFtcyB8fCBbXTtcblxuICAvLyBPbmx5IG5hbWVkIHN1YnNjcmlwdGlvbnMgaGF2ZSBJRHMsIGJ1dCB3ZSBuZWVkIHNvbWUgc29ydCBvZiBzdHJpbmdcbiAgLy8gaW50ZXJuYWxseSB0byBrZWVwIHRyYWNrIG9mIGFsbCBzdWJzY3JpcHRpb25zIGluc2lkZVxuICAvLyBTZXNzaW9uRG9jdW1lbnRWaWV3cy4gV2UgdXNlIHRoaXMgc3Vic2NyaXB0aW9uSGFuZGxlIGZvciB0aGF0LlxuICBpZiAoc2VsZi5fc3Vic2NyaXB0aW9uSWQpIHtcbiAgICBzZWxmLl9zdWJzY3JpcHRpb25IYW5kbGUgPSAnTicgKyBzZWxmLl9zdWJzY3JpcHRpb25JZDtcbiAgfSBlbHNlIHtcbiAgICBzZWxmLl9zdWJzY3JpcHRpb25IYW5kbGUgPSAnVScgKyBSYW5kb20uaWQoKTtcbiAgfVxuXG4gIC8vIEhhcyBfZGVhY3RpdmF0ZSBiZWVuIGNhbGxlZD9cbiAgc2VsZi5fZGVhY3RpdmF0ZWQgPSBmYWxzZTtcblxuICAvLyBTdG9wIGNhbGxiYWNrcyB0byBnL2MgdGhpcyBzdWIuICBjYWxsZWQgdy8gemVybyBhcmd1bWVudHMuXG4gIHNlbGYuX3N0b3BDYWxsYmFja3MgPSBbXTtcblxuICAvLyBUaGUgc2V0IG9mIChjb2xsZWN0aW9uLCBkb2N1bWVudGlkKSB0aGF0IHRoaXMgc3Vic2NyaXB0aW9uIGhhc1xuICAvLyBhbiBvcGluaW9uIGFib3V0LlxuICBzZWxmLl9kb2N1bWVudHMgPSBuZXcgTWFwKCk7XG5cbiAgLy8gUmVtZW1iZXIgaWYgd2UgYXJlIHJlYWR5LlxuICBzZWxmLl9yZWFkeSA9IGZhbHNlO1xuXG4gIC8vIFBhcnQgb2YgdGhlIHB1YmxpYyBBUEk6IHRoZSB1c2VyIG9mIHRoaXMgc3ViLlxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBY2Nlc3MgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiBUaGUgaWQgb2YgdGhlIGxvZ2dlZC1pbiB1c2VyLCBvciBgbnVsbGAgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4uXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAbmFtZSAgdXNlcklkXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgc2VsZi51c2VySWQgPSBzZXNzaW9uLnVzZXJJZDtcblxuICAvLyBGb3Igbm93LCB0aGUgaWQgZmlsdGVyIGlzIGdvaW5nIHRvIGRlZmF1bHQgdG9cbiAgLy8gdGhlIHRvL2Zyb20gRERQIG1ldGhvZHMgb24gTW9uZ29JRCwgdG9cbiAgLy8gc3BlY2lmaWNhbGx5IGRlYWwgd2l0aCBtb25nby9taW5pbW9uZ28gT2JqZWN0SWRzLlxuXG4gIC8vIExhdGVyLCB5b3Ugd2lsbCBiZSBhYmxlIHRvIG1ha2UgdGhpcyBiZSBcInJhd1wiXG4gIC8vIGlmIHlvdSB3YW50IHRvIHB1Ymxpc2ggYSBjb2xsZWN0aW9uIHRoYXQgeW91IGtub3dcbiAgLy8ganVzdCBoYXMgc3RyaW5ncyBmb3Iga2V5cyBhbmQgbm8gZnVubnkgYnVzaW5lc3MsIHRvXG4gIC8vIGEgRERQIGNvbnN1bWVyIHRoYXQgaXNuJ3QgbWluaW1vbmdvLlxuXG4gIHNlbGYuX2lkRmlsdGVyID0ge1xuICAgIGlkU3RyaW5naWZ5OiBNb25nb0lELmlkU3RyaW5naWZ5LFxuICAgIGlkUGFyc2U6IE1vbmdvSUQuaWRQYXJzZVxuICB9O1xuXG4gIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICBcImxpdmVkYXRhXCIsIFwic3Vic2NyaXB0aW9uc1wiLCAxKTtcbn07XG5cbk9iamVjdC5hc3NpZ24oU3Vic2NyaXB0aW9uLnByb3RvdHlwZSwge1xuICBfcnVuSGFuZGxlcjogYXN5bmMgZnVuY3Rpb24oKSB7XG4gICAgLy8gWFhYIHNob3VsZCB3ZSB1bmJsb2NrKCkgaGVyZT8gRWl0aGVyIGJlZm9yZSBydW5uaW5nIHRoZSBwdWJsaXNoXG4gICAgLy8gZnVuY3Rpb24sIG9yIGJlZm9yZSBydW5uaW5nIF9wdWJsaXNoQ3Vyc29yLlxuICAgIC8vXG4gICAgLy8gUmlnaHQgbm93LCBlYWNoIHB1Ymxpc2ggZnVuY3Rpb24gYmxvY2tzIGFsbCBmdXR1cmUgcHVibGlzaGVzIGFuZFxuICAgIC8vIG1ldGhvZHMgd2FpdGluZyBvbiBkYXRhIGZyb20gTW9uZ28gKG9yIHdoYXRldmVyIGVsc2UgdGhlIGZ1bmN0aW9uXG4gICAgLy8gYmxvY2tzIG9uKS4gVGhpcyBwcm9iYWJseSBzbG93cyBwYWdlIGxvYWQgaW4gY29tbW9uIGNhc2VzLlxuXG4gICAgaWYgKCF0aGlzLnVuYmxvY2spIHtcbiAgICAgIHRoaXMudW5ibG9jayA9ICgpID0+IHt9O1xuICAgIH1cblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGxldCByZXN1bHRPclRoZW5hYmxlID0gbnVsbDtcbiAgICB0cnkge1xuICAgICAgcmVzdWx0T3JUaGVuYWJsZSA9IEREUC5fQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi53aXRoVmFsdWUoXG4gICAgICAgIHNlbGYsXG4gICAgICAgICgpID0+XG4gICAgICAgICAgbWF5YmVBdWRpdEFyZ3VtZW50Q2hlY2tzKFxuICAgICAgICAgICAgc2VsZi5faGFuZGxlcixcbiAgICAgICAgICAgIHNlbGYsXG4gICAgICAgICAgICBFSlNPTi5jbG9uZShzZWxmLl9wYXJhbXMpLFxuICAgICAgICAgICAgLy8gSXQncyBPSyB0aGF0IHRoaXMgd291bGQgbG9vayB3ZWlyZCBmb3IgdW5pdmVyc2FsIHN1YnNjcmlwdGlvbnMsXG4gICAgICAgICAgICAvLyBiZWNhdXNlIHRoZXkgaGF2ZSBubyBhcmd1bWVudHMgc28gdGhlcmUgY2FuIG5ldmVyIGJlIGFuXG4gICAgICAgICAgICAvLyBhdWRpdC1hcmd1bWVudC1jaGVja3MgZmFpbHVyZS5cbiAgICAgICAgICAgIFwicHVibGlzaGVyICdcIiArIHNlbGYuX25hbWUgKyBcIidcIlxuICAgICAgICAgICksXG4gICAgICAgIHsgbmFtZTogc2VsZi5fbmFtZSB9XG4gICAgICApO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHNlbGYuZXJyb3IoZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gRGlkIHRoZSBoYW5kbGVyIGNhbGwgdGhpcy5lcnJvciBvciB0aGlzLnN0b3A/XG4gICAgaWYgKHNlbGYuX2lzRGVhY3RpdmF0ZWQoKSkgcmV0dXJuO1xuXG4gICAgLy8gQm90aCBjb252ZW50aW9uYWwgYW5kIGFzeW5jIHB1Ymxpc2ggaGFuZGxlciBmdW5jdGlvbnMgYXJlIHN1cHBvcnRlZC5cbiAgICAvLyBJZiBhbiBvYmplY3QgaXMgcmV0dXJuZWQgd2l0aCBhIHRoZW4oKSBmdW5jdGlvbiwgaXQgaXMgZWl0aGVyIGEgcHJvbWlzZVxuICAgIC8vIG9yIHRoZW5hYmxlIGFuZCB3aWxsIGJlIHJlc29sdmVkIGFzeW5jaHJvbm91c2x5LlxuICAgIGNvbnN0IGlzVGhlbmFibGUgPSAgXG4gICAgICByZXN1bHRPclRoZW5hYmxlICYmIHR5cGVvZiByZXN1bHRPclRoZW5hYmxlLnRoZW4gPT09ICdmdW5jdGlvbic7XG4gICAgaWYgKGlzVGhlbmFibGUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHNlbGYuX3B1Ymxpc2hIYW5kbGVyUmVzdWx0KGF3YWl0IHJlc3VsdE9yVGhlbmFibGUpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIHNlbGYuZXJyb3IoZSlcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fcHVibGlzaEhhbmRsZXJSZXN1bHQocmVzdWx0T3JUaGVuYWJsZSk7XG4gICAgfVxuICB9LFxuXG4gIF9wdWJsaXNoSGFuZGxlclJlc3VsdDogZnVuY3Rpb24gKHJlcykge1xuICAgIC8vIFNQRUNJQUwgQ0FTRTogSW5zdGVhZCBvZiB3cml0aW5nIHRoZWlyIG93biBjYWxsYmFja3MgdGhhdCBpbnZva2VcbiAgICAvLyB0aGlzLmFkZGVkL2NoYW5nZWQvcmVhZHkvZXRjLCB0aGUgdXNlciBjYW4ganVzdCByZXR1cm4gYSBjb2xsZWN0aW9uXG4gICAgLy8gY3Vyc29yIG9yIGFycmF5IG9mIGN1cnNvcnMgZnJvbSB0aGUgcHVibGlzaCBmdW5jdGlvbjsgd2UgY2FsbCB0aGVpclxuICAgIC8vIF9wdWJsaXNoQ3Vyc29yIG1ldGhvZCB3aGljaCBzdGFydHMgb2JzZXJ2aW5nIHRoZSBjdXJzb3IgYW5kIHB1Ymxpc2hlcyB0aGVcbiAgICAvLyByZXN1bHRzLiBOb3RlIHRoYXQgX3B1Ymxpc2hDdXJzb3IgZG9lcyBOT1QgY2FsbCByZWFkeSgpLlxuICAgIC8vXG4gICAgLy8gWFhYIFRoaXMgdXNlcyBhbiB1bmRvY3VtZW50ZWQgaW50ZXJmYWNlIHdoaWNoIG9ubHkgdGhlIE1vbmdvIGN1cnNvclxuICAgIC8vIGludGVyZmFjZSBwdWJsaXNoZXMuIFNob3VsZCB3ZSBtYWtlIHRoaXMgaW50ZXJmYWNlIHB1YmxpYyBhbmQgZW5jb3VyYWdlXG4gICAgLy8gdXNlcnMgdG8gaW1wbGVtZW50IGl0IHRoZW1zZWx2ZXM/IEFyZ3VhYmx5LCBpdCdzIHVubmVjZXNzYXJ5OyB1c2VycyBjYW5cbiAgICAvLyBhbHJlYWR5IHdyaXRlIHRoZWlyIG93biBmdW5jdGlvbnMgbGlrZVxuICAgIC8vICAgdmFyIHB1Ymxpc2hNeVJlYWN0aXZlVGhpbmd5ID0gZnVuY3Rpb24gKG5hbWUsIGhhbmRsZXIpIHtcbiAgICAvLyAgICAgTWV0ZW9yLnB1Ymxpc2gobmFtZSwgZnVuY3Rpb24gKCkge1xuICAgIC8vICAgICAgIHZhciByZWFjdGl2ZVRoaW5neSA9IGhhbmRsZXIoKTtcbiAgICAvLyAgICAgICByZWFjdGl2ZVRoaW5neS5wdWJsaXNoTWUoKTtcbiAgICAvLyAgICAgfSk7XG4gICAgLy8gICB9O1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBpc0N1cnNvciA9IGZ1bmN0aW9uIChjKSB7XG4gICAgICByZXR1cm4gYyAmJiBjLl9wdWJsaXNoQ3Vyc29yO1xuICAgIH07XG4gICAgaWYgKGlzQ3Vyc29yKHJlcykpIHtcbiAgICAgIHRoaXMuX3B1Ymxpc2hDdXJzb3JQcm9taXNlID0gcmVzLl9wdWJsaXNoQ3Vyc29yKHNlbGYpLnRoZW4oKCkgPT4ge1xuICAgICAgICAvLyBfcHVibGlzaEN1cnNvciBvbmx5IHJldHVybnMgYWZ0ZXIgdGhlIGluaXRpYWwgYWRkZWQgY2FsbGJhY2tzIGhhdmUgcnVuLlxuICAgICAgICAvLyBtYXJrIHN1YnNjcmlwdGlvbiBhcyByZWFkeS5cbiAgICAgICAgc2VsZi5yZWFkeSgpO1xuICAgICAgfSkuY2F0Y2goKGUpID0+IHNlbGYuZXJyb3IoZSkpO1xuICAgIH0gZWxzZSBpZiAoXy5pc0FycmF5KHJlcykpIHtcbiAgICAgIC8vIENoZWNrIGFsbCB0aGUgZWxlbWVudHMgYXJlIGN1cnNvcnNcbiAgICAgIGlmICghIF8uYWxsKHJlcywgaXNDdXJzb3IpKSB7XG4gICAgICAgIHNlbGYuZXJyb3IobmV3IEVycm9yKFwiUHVibGlzaCBmdW5jdGlvbiByZXR1cm5lZCBhbiBhcnJheSBvZiBub24tQ3Vyc29yc1wiKSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIC8vIEZpbmQgZHVwbGljYXRlIGNvbGxlY3Rpb24gbmFtZXNcbiAgICAgIC8vIFhYWCB3ZSBzaG91bGQgc3VwcG9ydCBvdmVybGFwcGluZyBjdXJzb3JzLCBidXQgdGhhdCB3b3VsZCByZXF1aXJlIHRoZVxuICAgICAgLy8gbWVyZ2UgYm94IHRvIGFsbG93IG92ZXJsYXAgd2l0aGluIGEgc3Vic2NyaXB0aW9uXG4gICAgICB2YXIgY29sbGVjdGlvbk5hbWVzID0ge307XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgY29sbGVjdGlvbk5hbWUgPSByZXNbaV0uX2dldENvbGxlY3Rpb25OYW1lKCk7XG4gICAgICAgIGlmIChfLmhhcyhjb2xsZWN0aW9uTmFtZXMsIGNvbGxlY3Rpb25OYW1lKSkge1xuICAgICAgICAgIHNlbGYuZXJyb3IobmV3IEVycm9yKFxuICAgICAgICAgICAgXCJQdWJsaXNoIGZ1bmN0aW9uIHJldHVybmVkIG11bHRpcGxlIGN1cnNvcnMgZm9yIGNvbGxlY3Rpb24gXCIgK1xuICAgICAgICAgICAgICBjb2xsZWN0aW9uTmFtZSkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBjb2xsZWN0aW9uTmFtZXNbY29sbGVjdGlvbk5hbWVdID0gdHJ1ZTtcbiAgICAgIH07XG5cbiAgICAgIHRoaXMuX3B1Ymxpc2hDdXJzb3JQcm9taXNlID0gUHJvbWlzZS5hbGwoXG4gICAgICAgIHJlcy5tYXAoYyA9PiBjLl9wdWJsaXNoQ3Vyc29yKHNlbGYpKVxuICAgICAgKVxuICAgICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgICAgc2VsZi5yZWFkeSgpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGUpID0+IHNlbGYuZXJyb3IoZSkpO1xuICAgIH0gZWxzZSBpZiAocmVzKSB7XG4gICAgICAvLyBUcnV0aHkgdmFsdWVzIG90aGVyIHRoYW4gY3Vyc29ycyBvciBhcnJheXMgYXJlIHByb2JhYmx5IGFcbiAgICAgIC8vIHVzZXIgbWlzdGFrZSAocG9zc2libGUgcmV0dXJuaW5nIGEgTW9uZ28gZG9jdW1lbnQgdmlhLCBzYXksXG4gICAgICAvLyBgY29sbC5maW5kT25lKClgKS5cbiAgICAgIHNlbGYuZXJyb3IobmV3IEVycm9yKFwiUHVibGlzaCBmdW5jdGlvbiBjYW4gb25seSByZXR1cm4gYSBDdXJzb3Igb3IgXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICsgXCJhbiBhcnJheSBvZiBDdXJzb3JzXCIpKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gVGhpcyBjYWxscyBhbGwgc3RvcCBjYWxsYmFja3MgYW5kIHByZXZlbnRzIHRoZSBoYW5kbGVyIGZyb20gdXBkYXRpbmcgYW55XG4gIC8vIFNlc3Npb25Db2xsZWN0aW9uVmlld3MgZnVydGhlci4gSXQncyB1c2VkIHdoZW4gdGhlIHVzZXIgdW5zdWJzY3JpYmVzIG9yXG4gIC8vIGRpc2Nvbm5lY3RzLCBhcyB3ZWxsIGFzIGR1cmluZyBzZXRVc2VySWQgcmUtcnVucy4gSXQgZG9lcyAqTk9UKiBzZW5kXG4gIC8vIHJlbW92ZWQgbWVzc2FnZXMgZm9yIHRoZSBwdWJsaXNoZWQgb2JqZWN0czsgaWYgdGhhdCBpcyBuZWNlc3NhcnksIGNhbGxcbiAgLy8gX3JlbW92ZUFsbERvY3VtZW50cyBmaXJzdC5cbiAgX2RlYWN0aXZhdGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fZGVhY3RpdmF0ZWQpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fZGVhY3RpdmF0ZWQgPSB0cnVlO1xuICAgIHNlbGYuX2NhbGxTdG9wQ2FsbGJhY2tzKCk7XG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgXCJsaXZlZGF0YVwiLCBcInN1YnNjcmlwdGlvbnNcIiwgLTEpO1xuICB9LFxuXG4gIF9jYWxsU3RvcENhbGxiYWNrczogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBUZWxsIGxpc3RlbmVycywgc28gdGhleSBjYW4gY2xlYW4gdXBcbiAgICB2YXIgY2FsbGJhY2tzID0gc2VsZi5fc3RvcENhbGxiYWNrcztcbiAgICBzZWxmLl9zdG9wQ2FsbGJhY2tzID0gW107XG4gICAgXy5lYWNoKGNhbGxiYWNrcywgZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjaygpO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFNlbmQgcmVtb3ZlIG1lc3NhZ2VzIGZvciBldmVyeSBkb2N1bWVudC5cbiAgX3JlbW92ZUFsbERvY3VtZW50czogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLl9kb2N1bWVudHMuZm9yRWFjaChmdW5jdGlvbiAoY29sbGVjdGlvbkRvY3MsIGNvbGxlY3Rpb25OYW1lKSB7XG4gICAgICAgIGNvbGxlY3Rpb25Eb2NzLmZvckVhY2goZnVuY3Rpb24gKHN0cklkKSB7XG4gICAgICAgICAgc2VsZi5yZW1vdmVkKGNvbGxlY3Rpb25OYW1lLCBzZWxmLl9pZEZpbHRlci5pZFBhcnNlKHN0cklkKSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gUmV0dXJucyBhIG5ldyBTdWJzY3JpcHRpb24gZm9yIHRoZSBzYW1lIHNlc3Npb24gd2l0aCB0aGUgc2FtZVxuICAvLyBpbml0aWFsIGNyZWF0aW9uIHBhcmFtZXRlcnMuIFRoaXMgaXNuJ3QgYSBjbG9uZTogaXQgZG9lc24ndCBoYXZlXG4gIC8vIHRoZSBzYW1lIF9kb2N1bWVudHMgY2FjaGUsIHN0b3BwZWQgc3RhdGUgb3IgY2FsbGJhY2tzOyBtYXkgaGF2ZSBhXG4gIC8vIGRpZmZlcmVudCBfc3Vic2NyaXB0aW9uSGFuZGxlLCBhbmQgZ2V0cyBpdHMgdXNlcklkIGZyb20gdGhlXG4gIC8vIHNlc3Npb24sIG5vdCBmcm9tIHRoaXMgb2JqZWN0LlxuICBfcmVjcmVhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIG5ldyBTdWJzY3JpcHRpb24oXG4gICAgICBzZWxmLl9zZXNzaW9uLCBzZWxmLl9oYW5kbGVyLCBzZWxmLl9zdWJzY3JpcHRpb25JZCwgc2VsZi5fcGFyYW1zLFxuICAgICAgc2VsZi5fbmFtZSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgU3RvcHMgdGhpcyBjbGllbnQncyBzdWJzY3JpcHRpb24sIHRyaWdnZXJpbmcgYSBjYWxsIG9uIHRoZSBjbGllbnQgdG8gdGhlIGBvblN0b3BgIGNhbGxiYWNrIHBhc3NlZCB0byBbYE1ldGVvci5zdWJzY3JpYmVgXSgjbWV0ZW9yX3N1YnNjcmliZSksIGlmIGFueS4gSWYgYGVycm9yYCBpcyBub3QgYSBbYE1ldGVvci5FcnJvcmBdKCNtZXRlb3JfZXJyb3IpLCBpdCB3aWxsIGJlIFtzYW5pdGl6ZWRdKCNtZXRlb3JfZXJyb3IpLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBwYXJhbSB7RXJyb3J9IGVycm9yIFRoZSBlcnJvciB0byBwYXNzIHRvIHRoZSBjbGllbnQuXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqL1xuICBlcnJvcjogZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fc2Vzc2lvbi5fc3RvcFN1YnNjcmlwdGlvbihzZWxmLl9zdWJzY3JpcHRpb25JZCwgZXJyb3IpO1xuICB9LFxuXG4gIC8vIE5vdGUgdGhhdCB3aGlsZSBvdXIgRERQIGNsaWVudCB3aWxsIG5vdGljZSB0aGF0IHlvdSd2ZSBjYWxsZWQgc3RvcCgpIG9uIHRoZVxuICAvLyBzZXJ2ZXIgKGFuZCBjbGVhbiB1cCBpdHMgX3N1YnNjcmlwdGlvbnMgdGFibGUpIHdlIGRvbid0IGFjdHVhbGx5IHByb3ZpZGUgYVxuICAvLyBtZWNoYW5pc20gZm9yIGFuIGFwcCB0byBub3RpY2UgdGhpcyAodGhlIHN1YnNjcmliZSBvbkVycm9yIGNhbGxiYWNrIG9ubHlcbiAgLy8gdHJpZ2dlcnMgaWYgdGhlcmUgaXMgYW4gZXJyb3IpLlxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGluc2lkZSB0aGUgcHVibGlzaCBmdW5jdGlvbi4gIFN0b3BzIHRoaXMgY2xpZW50J3Mgc3Vic2NyaXB0aW9uIGFuZCBpbnZva2VzIHRoZSBjbGllbnQncyBgb25TdG9wYCBjYWxsYmFjayB3aXRoIG5vIGVycm9yLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqL1xuICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fc2Vzc2lvbi5fc3RvcFN1YnNjcmlwdGlvbihzZWxmLl9zdWJzY3JpcHRpb25JZCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgUmVnaXN0ZXJzIGEgY2FsbGJhY2sgZnVuY3Rpb24gdG8gcnVuIHdoZW4gdGhlIHN1YnNjcmlwdGlvbiBpcyBzdG9wcGVkLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJPZiBTdWJzY3JpcHRpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgVGhlIGNhbGxiYWNrIGZ1bmN0aW9uXG4gICAqL1xuICBvblN0b3A6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBjYWxsYmFjayA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoY2FsbGJhY2ssICdvblN0b3AgY2FsbGJhY2snLCBzZWxmKTtcbiAgICBpZiAoc2VsZi5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgY2FsbGJhY2soKTtcbiAgICBlbHNlXG4gICAgICBzZWxmLl9zdG9wQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuICB9LFxuXG4gIC8vIFRoaXMgcmV0dXJucyB0cnVlIGlmIHRoZSBzdWIgaGFzIGJlZW4gZGVhY3RpdmF0ZWQsICpPUiogaWYgdGhlIHNlc3Npb24gd2FzXG4gIC8vIGRlc3Ryb3llZCBidXQgdGhlIGRlZmVycmVkIGNhbGwgdG8gX2RlYWN0aXZhdGVBbGxTdWJzY3JpcHRpb25zIGhhc24ndFxuICAvLyBoYXBwZW5lZCB5ZXQuXG4gIF9pc0RlYWN0aXZhdGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLl9kZWFjdGl2YXRlZCB8fCBzZWxmLl9zZXNzaW9uLmluUXVldWUgPT09IG51bGw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgSW5mb3JtcyB0aGUgc3Vic2NyaWJlciB0aGF0IGEgZG9jdW1lbnQgaGFzIGJlZW4gYWRkZWQgdG8gdGhlIHJlY29yZCBzZXQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIG5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gdGhhdCBjb250YWlucyB0aGUgbmV3IGRvY3VtZW50LlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgVGhlIG5ldyBkb2N1bWVudCdzIElELlxuICAgKiBAcGFyYW0ge09iamVjdH0gZmllbGRzIFRoZSBmaWVsZHMgaW4gdGhlIG5ldyBkb2N1bWVudC4gIElmIGBfaWRgIGlzIHByZXNlbnQgaXQgaXMgaWdub3JlZC5cbiAgICovXG4gIGFkZGVkIChjb2xsZWN0aW9uTmFtZSwgaWQsIGZpZWxkcykge1xuICAgIGlmICh0aGlzLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgaWQgPSB0aGlzLl9pZEZpbHRlci5pZFN0cmluZ2lmeShpZCk7XG5cbiAgICBpZiAodGhpcy5fc2Vzc2lvbi5zZXJ2ZXIuZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkuZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbikge1xuICAgICAgbGV0IGlkcyA9IHRoaXMuX2RvY3VtZW50cy5nZXQoY29sbGVjdGlvbk5hbWUpO1xuICAgICAgaWYgKGlkcyA9PSBudWxsKSB7XG4gICAgICAgIGlkcyA9IG5ldyBTZXQoKTtcbiAgICAgICAgdGhpcy5fZG9jdW1lbnRzLnNldChjb2xsZWN0aW9uTmFtZSwgaWRzKTtcbiAgICAgIH1cbiAgICAgIGlkcy5hZGQoaWQpO1xuICAgIH1cblxuICAgIHRoaXMuX3Nlc3Npb24uX3B1Ymxpc2hDdXJzb3JQcm9taXNlID0gdGhpcy5fcHVibGlzaEN1cnNvclByb21pc2U7XG4gICAgdGhpcy5fc2Vzc2lvbi5hZGRlZCh0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBJbmZvcm1zIHRoZSBzdWJzY3JpYmVyIHRoYXQgYSBkb2N1bWVudCBpbiB0aGUgcmVjb3JkIHNldCBoYXMgYmVlbiBtb2RpZmllZC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyT2YgU3Vic2NyaXB0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gY29sbGVjdGlvbiBUaGUgbmFtZSBvZiB0aGUgY29sbGVjdGlvbiB0aGF0IGNvbnRhaW5zIHRoZSBjaGFuZ2VkIGRvY3VtZW50LlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgVGhlIGNoYW5nZWQgZG9jdW1lbnQncyBJRC5cbiAgICogQHBhcmFtIHtPYmplY3R9IGZpZWxkcyBUaGUgZmllbGRzIGluIHRoZSBkb2N1bWVudCB0aGF0IGhhdmUgY2hhbmdlZCwgdG9nZXRoZXIgd2l0aCB0aGVpciBuZXcgdmFsdWVzLiAgSWYgYSBmaWVsZCBpcyBub3QgcHJlc2VudCBpbiBgZmllbGRzYCBpdCB3YXMgbGVmdCB1bmNoYW5nZWQ7IGlmIGl0IGlzIHByZXNlbnQgaW4gYGZpZWxkc2AgYW5kIGhhcyBhIHZhbHVlIG9mIGB1bmRlZmluZWRgIGl0IHdhcyByZW1vdmVkIGZyb20gdGhlIGRvY3VtZW50LiAgSWYgYF9pZGAgaXMgcHJlc2VudCBpdCBpcyBpZ25vcmVkLlxuICAgKi9cbiAgY2hhbmdlZCAoY29sbGVjdGlvbk5hbWUsIGlkLCBmaWVsZHMpIHtcbiAgICBpZiAodGhpcy5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgcmV0dXJuO1xuICAgIGlkID0gdGhpcy5faWRGaWx0ZXIuaWRTdHJpbmdpZnkoaWQpO1xuICAgIHRoaXMuX3Nlc3Npb24uY2hhbmdlZCh0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCwgZmllbGRzKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQ2FsbCBpbnNpZGUgdGhlIHB1Ymxpc2ggZnVuY3Rpb24uICBJbmZvcm1zIHRoZSBzdWJzY3JpYmVyIHRoYXQgYSBkb2N1bWVudCBoYXMgYmVlbiByZW1vdmVkIGZyb20gdGhlIHJlY29yZCBzZXQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtTdHJpbmd9IGNvbGxlY3Rpb24gVGhlIG5hbWUgb2YgdGhlIGNvbGxlY3Rpb24gdGhhdCB0aGUgZG9jdW1lbnQgaGFzIGJlZW4gcmVtb3ZlZCBmcm9tLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWQgVGhlIElEIG9mIHRoZSBkb2N1bWVudCB0aGF0IGhhcyBiZWVuIHJlbW92ZWQuXG4gICAqL1xuICByZW1vdmVkIChjb2xsZWN0aW9uTmFtZSwgaWQpIHtcbiAgICBpZiAodGhpcy5faXNEZWFjdGl2YXRlZCgpKVxuICAgICAgcmV0dXJuO1xuICAgIGlkID0gdGhpcy5faWRGaWx0ZXIuaWRTdHJpbmdpZnkoaWQpO1xuXG4gICAgaWYgKHRoaXMuX3Nlc3Npb24uc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUpLmRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb24pIHtcbiAgICAgIC8vIFdlIGRvbid0IGJvdGhlciB0byBkZWxldGUgc2V0cyBvZiB0aGluZ3MgaW4gYSBjb2xsZWN0aW9uIGlmIHRoZVxuICAgICAgLy8gY29sbGVjdGlvbiBpcyBlbXB0eS4gIEl0IGNvdWxkIGJyZWFrIF9yZW1vdmVBbGxEb2N1bWVudHMuXG4gICAgICB0aGlzLl9kb2N1bWVudHMuZ2V0KGNvbGxlY3Rpb25OYW1lKS5kZWxldGUoaWQpO1xuICAgIH1cblxuICAgIHRoaXMuX3Nlc3Npb24ucmVtb3ZlZCh0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGUsIGNvbGxlY3Rpb25OYW1lLCBpZCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgaW5zaWRlIHRoZSBwdWJsaXNoIGZ1bmN0aW9uLiAgSW5mb3JtcyB0aGUgc3Vic2NyaWJlciB0aGF0IGFuIGluaXRpYWwsIGNvbXBsZXRlIHNuYXBzaG90IG9mIHRoZSByZWNvcmQgc2V0IGhhcyBiZWVuIHNlbnQuICBUaGlzIHdpbGwgdHJpZ2dlciBhIGNhbGwgb24gdGhlIGNsaWVudCB0byB0aGUgYG9uUmVhZHlgIGNhbGxiYWNrIHBhc3NlZCB0byAgW2BNZXRlb3Iuc3Vic2NyaWJlYF0oI21ldGVvcl9zdWJzY3JpYmUpLCBpZiBhbnkuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQG1lbWJlck9mIFN1YnNjcmlwdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIHJlYWR5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9pc0RlYWN0aXZhdGVkKCkpXG4gICAgICByZXR1cm47XG4gICAgaWYgKCFzZWxmLl9zdWJzY3JpcHRpb25JZClcbiAgICAgIHJldHVybjsgIC8vIFVubmVjZXNzYXJ5IGJ1dCBpZ25vcmVkIGZvciB1bml2ZXJzYWwgc3ViXG4gICAgaWYgKCFzZWxmLl9yZWFkeSkge1xuICAgICAgc2VsZi5fc2Vzc2lvbi5zZW5kUmVhZHkoW3NlbGYuX3N1YnNjcmlwdGlvbklkXSk7XG4gICAgICBzZWxmLl9yZWFkeSA9IHRydWU7XG4gICAgfVxuICB9XG59KTtcblxuLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbi8qIFNlcnZlciAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICovXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG5TZXJ2ZXIgPSBmdW5jdGlvbiAob3B0aW9ucyA9IHt9KSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBUaGUgZGVmYXVsdCBoZWFydGJlYXQgaW50ZXJ2YWwgaXMgMzAgc2Vjb25kcyBvbiB0aGUgc2VydmVyIGFuZCAzNVxuICAvLyBzZWNvbmRzIG9uIHRoZSBjbGllbnQuICBTaW5jZSB0aGUgY2xpZW50IGRvZXNuJ3QgbmVlZCB0byBzZW5kIGFcbiAgLy8gcGluZyBhcyBsb25nIGFzIGl0IGlzIHJlY2VpdmluZyBwaW5ncywgdGhpcyBtZWFucyB0aGF0IHBpbmdzXG4gIC8vIG5vcm1hbGx5IGdvIGZyb20gdGhlIHNlcnZlciB0byB0aGUgY2xpZW50LlxuICAvL1xuICAvLyBOb3RlOiBUcm9wb3NwaGVyZSBkZXBlbmRzIG9uIHRoZSBhYmlsaXR5IHRvIG11dGF0ZVxuICAvLyBNZXRlb3Iuc2VydmVyLm9wdGlvbnMuaGVhcnRiZWF0VGltZW91dCEgVGhpcyBpcyBhIGhhY2ssIGJ1dCBpdCdzIGxpZmUuXG4gIHNlbGYub3B0aW9ucyA9IHtcbiAgICBoZWFydGJlYXRJbnRlcnZhbDogMTUwMDAsXG4gICAgaGVhcnRiZWF0VGltZW91dDogMTUwMDAsXG4gICAgLy8gRm9yIHRlc3RpbmcsIGFsbG93IHJlc3BvbmRpbmcgdG8gcGluZ3MgdG8gYmUgZGlzYWJsZWQuXG4gICAgcmVzcG9uZFRvUGluZ3M6IHRydWUsXG4gICAgZGVmYXVsdFB1YmxpY2F0aW9uU3RyYXRlZ3k6IHB1YmxpY2F0aW9uU3RyYXRlZ2llcy5TRVJWRVJfTUVSR0UsXG4gICAgLi4ub3B0aW9ucyxcbiAgfTtcblxuICAvLyBNYXAgb2YgY2FsbGJhY2tzIHRvIGNhbGwgd2hlbiBhIG5ldyBjb25uZWN0aW9uIGNvbWVzIGluIHRvIHRoZVxuICAvLyBzZXJ2ZXIgYW5kIGNvbXBsZXRlcyBERFAgdmVyc2lvbiBuZWdvdGlhdGlvbi4gVXNlIGFuIG9iamVjdCBpbnN0ZWFkXG4gIC8vIG9mIGFuIGFycmF5IHNvIHdlIGNhbiBzYWZlbHkgcmVtb3ZlIG9uZSBmcm9tIHRoZSBsaXN0IHdoaWxlXG4gIC8vIGl0ZXJhdGluZyBvdmVyIGl0LlxuICBzZWxmLm9uQ29ubmVjdGlvbkhvb2sgPSBuZXcgSG9vayh7XG4gICAgZGVidWdQcmludEV4Y2VwdGlvbnM6IFwib25Db25uZWN0aW9uIGNhbGxiYWNrXCJcbiAgfSk7XG5cbiAgLy8gTWFwIG9mIGNhbGxiYWNrcyB0byBjYWxsIHdoZW4gYSBuZXcgbWVzc2FnZSBjb21lcyBpbi5cbiAgc2VsZi5vbk1lc3NhZ2VIb29rID0gbmV3IEhvb2soe1xuICAgIGRlYnVnUHJpbnRFeGNlcHRpb25zOiBcIm9uTWVzc2FnZSBjYWxsYmFja1wiXG4gIH0pO1xuXG4gIHNlbGYucHVibGlzaF9oYW5kbGVycyA9IHt9O1xuICBzZWxmLnVuaXZlcnNhbF9wdWJsaXNoX2hhbmRsZXJzID0gW107XG5cbiAgc2VsZi5tZXRob2RfaGFuZGxlcnMgPSB7fTtcblxuICBzZWxmLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXMgPSB7fTtcblxuICBzZWxmLnNlc3Npb25zID0gbmV3IE1hcCgpOyAvLyBtYXAgZnJvbSBpZCB0byBzZXNzaW9uXG5cbiAgc2VsZi5zdHJlYW1fc2VydmVyID0gbmV3IFN0cmVhbVNlcnZlcigpO1xuXG4gIHNlbGYuc3RyZWFtX3NlcnZlci5yZWdpc3RlcihmdW5jdGlvbiAoc29ja2V0KSB7XG4gICAgLy8gc29ja2V0IGltcGxlbWVudHMgdGhlIFNvY2tKU0Nvbm5lY3Rpb24gaW50ZXJmYWNlXG4gICAgc29ja2V0Ll9tZXRlb3JTZXNzaW9uID0gbnVsbDtcblxuICAgIHZhciBzZW5kRXJyb3IgPSBmdW5jdGlvbiAocmVhc29uLCBvZmZlbmRpbmdNZXNzYWdlKSB7XG4gICAgICB2YXIgbXNnID0ge21zZzogJ2Vycm9yJywgcmVhc29uOiByZWFzb259O1xuICAgICAgaWYgKG9mZmVuZGluZ01lc3NhZ2UpXG4gICAgICAgIG1zZy5vZmZlbmRpbmdNZXNzYWdlID0gb2ZmZW5kaW5nTWVzc2FnZTtcbiAgICAgIHNvY2tldC5zZW5kKEREUENvbW1vbi5zdHJpbmdpZnlERFAobXNnKSk7XG4gICAgfTtcblxuICAgIHNvY2tldC5vbignZGF0YScsIGZ1bmN0aW9uIChyYXdfbXNnKSB7XG4gICAgICBpZiAoTWV0ZW9yLl9wcmludFJlY2VpdmVkRERQKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJSZWNlaXZlZCBERFBcIiwgcmF3X21zZyk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciBtc2cgPSBERFBDb21tb24ucGFyc2VERFAocmF3X21zZyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIHNlbmRFcnJvcignUGFyc2UgZXJyb3InKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1zZyA9PT0gbnVsbCB8fCAhbXNnLm1zZykge1xuICAgICAgICAgIHNlbmRFcnJvcignQmFkIHJlcXVlc3QnLCBtc2cpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtc2cubXNnID09PSAnY29ubmVjdCcpIHtcbiAgICAgICAgICBpZiAoc29ja2V0Ll9tZXRlb3JTZXNzaW9uKSB7XG4gICAgICAgICAgICBzZW5kRXJyb3IoXCJBbHJlYWR5IGNvbm5lY3RlZFwiLCBtc2cpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHNlbGYuX2hhbmRsZUNvbm5lY3Qoc29ja2V0LCBtc2cpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFzb2NrZXQuX21ldGVvclNlc3Npb24pIHtcbiAgICAgICAgICBzZW5kRXJyb3IoJ011c3QgY29ubmVjdCBmaXJzdCcsIG1zZyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbi5wcm9jZXNzTWVzc2FnZShtc2cpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBYWFggcHJpbnQgc3RhY2sgbmljZWx5XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJJbnRlcm5hbCBleGNlcHRpb24gd2hpbGUgcHJvY2Vzc2luZyBtZXNzYWdlXCIsIG1zZywgZSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBzb2NrZXQub24oJ2Nsb3NlJywgZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNvY2tldC5fbWV0ZW9yU2Vzc2lvbikge1xuICAgICAgICBzb2NrZXQuX21ldGVvclNlc3Npb24uY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59O1xuXG5PYmplY3QuYXNzaWduKFNlcnZlci5wcm90b3R5cGUsIHtcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiBhIG5ldyBERFAgY29ubmVjdGlvbiBpcyBtYWRlIHRvIHRoZSBzZXJ2ZXIuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBhIG5ldyBERFAgY29ubmVjdGlvbiBpcyBlc3RhYmxpc2hlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqL1xuICBvbkNvbm5lY3Rpb246IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5vbkNvbm5lY3Rpb25Ib29rLnJlZ2lzdGVyKGZuKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgU2V0IHB1YmxpY2F0aW9uIHN0cmF0ZWd5IGZvciB0aGUgZ2l2ZW4gY29sbGVjdGlvbi4gUHVibGljYXRpb25zIHN0cmF0ZWdpZXMgYXJlIGF2YWlsYWJsZSBmcm9tIGBERFBTZXJ2ZXIucHVibGljYXRpb25TdHJhdGVnaWVzYC4gWW91IGNhbGwgdGhpcyBtZXRob2QgZnJvbSBgTWV0ZW9yLnNlcnZlcmAsIGxpa2UgYE1ldGVvci5zZXJ2ZXIuc2V0UHVibGljYXRpb25TdHJhdGVneSgpYFxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBhbGlhcyBzZXRQdWJsaWNhdGlvblN0cmF0ZWd5XG4gICAqIEBwYXJhbSBjb2xsZWN0aW9uTmFtZSB7U3RyaW5nfVxuICAgKiBAcGFyYW0gc3RyYXRlZ3kge3t1c2VDb2xsZWN0aW9uVmlldzogYm9vbGVhbiwgZG9BY2NvdW50aW5nRm9yQ29sbGVjdGlvbjogYm9vbGVhbn19XG4gICAqIEBtZW1iZXJPZiBNZXRlb3Iuc2VydmVyXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIHNldFB1YmxpY2F0aW9uU3RyYXRlZ3koY29sbGVjdGlvbk5hbWUsIHN0cmF0ZWd5KSB7XG4gICAgaWYgKCFPYmplY3QudmFsdWVzKHB1YmxpY2F0aW9uU3RyYXRlZ2llcykuaW5jbHVkZXMoc3RyYXRlZ3kpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbWVyZ2Ugc3RyYXRlZ3k6ICR7c3RyYXRlZ3l9IFxuICAgICAgICBmb3IgY29sbGVjdGlvbiAke2NvbGxlY3Rpb25OYW1lfWApO1xuICAgIH1cbiAgICB0aGlzLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXNbY29sbGVjdGlvbk5hbWVdID0gc3RyYXRlZ3k7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldHMgdGhlIHB1YmxpY2F0aW9uIHN0cmF0ZWd5IGZvciB0aGUgcmVxdWVzdGVkIGNvbGxlY3Rpb24uIFlvdSBjYWxsIHRoaXMgbWV0aG9kIGZyb20gYE1ldGVvci5zZXJ2ZXJgLCBsaWtlIGBNZXRlb3Iuc2VydmVyLmdldFB1YmxpY2F0aW9uU3RyYXRlZ3koKWBcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAYWxpYXMgZ2V0UHVibGljYXRpb25TdHJhdGVneVxuICAgKiBAcGFyYW0gY29sbGVjdGlvbk5hbWUge1N0cmluZ31cbiAgICogQG1lbWJlck9mIE1ldGVvci5zZXJ2ZXJcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAcmV0dXJuIHt7dXNlQ29sbGVjdGlvblZpZXc6IGJvb2xlYW4sIGRvQWNjb3VudGluZ0ZvckNvbGxlY3Rpb246IGJvb2xlYW59fVxuICAgKi9cbiAgZ2V0UHVibGljYXRpb25TdHJhdGVneShjb2xsZWN0aW9uTmFtZSkge1xuICAgIHJldHVybiB0aGlzLl9wdWJsaWNhdGlvblN0cmF0ZWdpZXNbY29sbGVjdGlvbk5hbWVdXG4gICAgICB8fCB0aGlzLm9wdGlvbnMuZGVmYXVsdFB1YmxpY2F0aW9uU3RyYXRlZ3k7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJlZ2lzdGVyIGEgY2FsbGJhY2sgdG8gYmUgY2FsbGVkIHdoZW4gYSBuZXcgRERQIG1lc3NhZ2UgaXMgcmVjZWl2ZWQuXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBhIG5ldyBERFAgbWVzc2FnZSBpcyByZWNlaXZlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqL1xuICBvbk1lc3NhZ2U6IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gc2VsZi5vbk1lc3NhZ2VIb29rLnJlZ2lzdGVyKGZuKTtcbiAgfSxcblxuICBfaGFuZGxlQ29ubmVjdDogZnVuY3Rpb24gKHNvY2tldCwgbXNnKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8gVGhlIGNvbm5lY3QgbWVzc2FnZSBtdXN0IHNwZWNpZnkgYSB2ZXJzaW9uIGFuZCBhbiBhcnJheSBvZiBzdXBwb3J0ZWRcbiAgICAvLyB2ZXJzaW9ucywgYW5kIGl0IG11c3QgY2xhaW0gdG8gc3VwcG9ydCB3aGF0IGl0IGlzIHByb3Bvc2luZy5cbiAgICBpZiAoISh0eXBlb2YgKG1zZy52ZXJzaW9uKSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICBfLmlzQXJyYXkobXNnLnN1cHBvcnQpICYmXG4gICAgICAgICAgXy5hbGwobXNnLnN1cHBvcnQsIF8uaXNTdHJpbmcpICYmXG4gICAgICAgICAgXy5jb250YWlucyhtc2cuc3VwcG9ydCwgbXNnLnZlcnNpb24pKSkge1xuICAgICAgc29ja2V0LnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUCh7bXNnOiAnZmFpbGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbjogRERQQ29tbW9uLlNVUFBPUlRFRF9ERFBfVkVSU0lPTlNbMF19KSk7XG4gICAgICBzb2NrZXQuY2xvc2UoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBJbiB0aGUgZnV0dXJlLCBoYW5kbGUgc2Vzc2lvbiByZXN1bXB0aW9uOiBzb21ldGhpbmcgbGlrZTpcbiAgICAvLyAgc29ja2V0Ll9tZXRlb3JTZXNzaW9uID0gc2VsZi5zZXNzaW9uc1ttc2cuc2Vzc2lvbl1cbiAgICB2YXIgdmVyc2lvbiA9IGNhbGN1bGF0ZVZlcnNpb24obXNnLnN1cHBvcnQsIEREUENvbW1vbi5TVVBQT1JURURfRERQX1ZFUlNJT05TKTtcblxuICAgIGlmIChtc2cudmVyc2lvbiAhPT0gdmVyc2lvbikge1xuICAgICAgLy8gVGhlIGJlc3QgdmVyc2lvbiB0byB1c2UgKGFjY29yZGluZyB0byB0aGUgY2xpZW50J3Mgc3RhdGVkIHByZWZlcmVuY2VzKVxuICAgICAgLy8gaXMgbm90IHRoZSBvbmUgdGhlIGNsaWVudCBpcyB0cnlpbmcgdG8gdXNlLiBJbmZvcm0gdGhlbSBhYm91dCB0aGUgYmVzdFxuICAgICAgLy8gdmVyc2lvbiB0byB1c2UuXG4gICAgICBzb2NrZXQuc2VuZChERFBDb21tb24uc3RyaW5naWZ5RERQKHttc2c6ICdmYWlsZWQnLCB2ZXJzaW9uOiB2ZXJzaW9ufSkpO1xuICAgICAgc29ja2V0LmNsb3NlKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gWWF5LCB2ZXJzaW9uIG1hdGNoZXMhIENyZWF0ZSBhIG5ldyBzZXNzaW9uLlxuICAgIC8vIE5vdGU6IFRyb3Bvc3BoZXJlIGRlcGVuZHMgb24gdGhlIGFiaWxpdHkgdG8gbXV0YXRlXG4gICAgLy8gTWV0ZW9yLnNlcnZlci5vcHRpb25zLmhlYXJ0YmVhdFRpbWVvdXQhIFRoaXMgaXMgYSBoYWNrLCBidXQgaXQncyBsaWZlLlxuICAgIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbiA9IG5ldyBTZXNzaW9uKHNlbGYsIHZlcnNpb24sIHNvY2tldCwgc2VsZi5vcHRpb25zKTtcbiAgICBzZWxmLnNlc3Npb25zLnNldChzb2NrZXQuX21ldGVvclNlc3Npb24uaWQsIHNvY2tldC5fbWV0ZW9yU2Vzc2lvbik7XG4gICAgc2VsZi5vbkNvbm5lY3Rpb25Ib29rLmVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICBpZiAoc29ja2V0Ll9tZXRlb3JTZXNzaW9uKVxuICAgICAgICBjYWxsYmFjayhzb2NrZXQuX21ldGVvclNlc3Npb24uY29ubmVjdGlvbkhhbmRsZSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfSxcbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGEgcHVibGlzaCBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSB7U3RyaW5nfSBpZGVudGlmaWVyIGZvciBxdWVyeVxuICAgKiBAcGFyYW0gaGFuZGxlciB7RnVuY3Rpb259IHB1Ymxpc2ggaGFuZGxlclxuICAgKiBAcGFyYW0gb3B0aW9ucyB7T2JqZWN0fVxuICAgKlxuICAgKiBTZXJ2ZXIgd2lsbCBjYWxsIGhhbmRsZXIgZnVuY3Rpb24gb24gZWFjaCBuZXcgc3Vic2NyaXB0aW9uLFxuICAgKiBlaXRoZXIgd2hlbiByZWNlaXZpbmcgRERQIHN1YiBtZXNzYWdlIGZvciBhIG5hbWVkIHN1YnNjcmlwdGlvbiwgb3Igb25cbiAgICogRERQIGNvbm5lY3QgZm9yIGEgdW5pdmVyc2FsIHN1YnNjcmlwdGlvbi5cbiAgICpcbiAgICogSWYgbmFtZSBpcyBudWxsLCB0aGlzIHdpbGwgYmUgYSBzdWJzY3JpcHRpb24gdGhhdCBpc1xuICAgKiBhdXRvbWF0aWNhbGx5IGVzdGFibGlzaGVkIGFuZCBwZXJtYW5lbnRseSBvbiBmb3IgYWxsIGNvbm5lY3RlZFxuICAgKiBjbGllbnQsIGluc3RlYWQgb2YgYSBzdWJzY3JpcHRpb24gdGhhdCBjYW4gYmUgdHVybmVkIG9uIGFuZCBvZmZcbiAgICogd2l0aCBzdWJzY3JpYmUoKS5cbiAgICpcbiAgICogb3B0aW9ucyB0byBjb250YWluOlxuICAgKiAgLSAobW9zdGx5IGludGVybmFsKSBpc19hdXRvOiB0cnVlIGlmIGdlbmVyYXRlZCBhdXRvbWF0aWNhbGx5XG4gICAqICAgIGZyb20gYW4gYXV0b3B1Ymxpc2ggaG9vay4gdGhpcyBpcyBmb3IgY29zbWV0aWMgcHVycG9zZXMgb25seVxuICAgKiAgICAoaXQgbGV0cyB1cyBkZXRlcm1pbmUgd2hldGhlciB0byBwcmludCBhIHdhcm5pbmcgc3VnZ2VzdGluZ1xuICAgKiAgICB0aGF0IHlvdSB0dXJuIG9mZiBhdXRvcHVibGlzaCkuXG4gICAqL1xuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBQdWJsaXNoIGEgcmVjb3JkIHNldC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBsb2N1cyBTZXJ2ZXJcbiAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBuYW1lIElmIFN0cmluZywgbmFtZSBvZiB0aGUgcmVjb3JkIHNldC4gIElmIE9iamVjdCwgcHVibGljYXRpb25zIERpY3Rpb25hcnkgb2YgcHVibGlzaCBmdW5jdGlvbnMgYnkgbmFtZS4gIElmIGBudWxsYCwgdGhlIHNldCBoYXMgbm8gbmFtZSwgYW5kIHRoZSByZWNvcmQgc2V0IGlzIGF1dG9tYXRpY2FsbHkgc2VudCB0byBhbGwgY29ubmVjdGVkIGNsaWVudHMuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmMgRnVuY3Rpb24gY2FsbGVkIG9uIHRoZSBzZXJ2ZXIgZWFjaCB0aW1lIGEgY2xpZW50IHN1YnNjcmliZXMuICBJbnNpZGUgdGhlIGZ1bmN0aW9uLCBgdGhpc2AgaXMgdGhlIHB1Ymxpc2ggaGFuZGxlciBvYmplY3QsIGRlc2NyaWJlZCBiZWxvdy4gIElmIHRoZSBjbGllbnQgcGFzc2VkIGFyZ3VtZW50cyB0byBgc3Vic2NyaWJlYCwgdGhlIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aXRoIHRoZSBzYW1lIGFyZ3VtZW50cy5cbiAgICovXG4gIHB1Ymxpc2g6IGZ1bmN0aW9uIChuYW1lLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKCEgXy5pc09iamVjdChuYW1lKSkge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgICAgIGlmIChuYW1lICYmIG5hbWUgaW4gc2VsZi5wdWJsaXNoX2hhbmRsZXJzKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJJZ25vcmluZyBkdXBsaWNhdGUgcHVibGlzaCBuYW1lZCAnXCIgKyBuYW1lICsgXCInXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChQYWNrYWdlLmF1dG9wdWJsaXNoICYmICFvcHRpb25zLmlzX2F1dG8pIHtcbiAgICAgICAgLy8gVGhleSBoYXZlIGF1dG9wdWJsaXNoIG9uLCB5ZXQgdGhleSdyZSB0cnlpbmcgdG8gbWFudWFsbHlcbiAgICAgICAgLy8gcGljayBzdHVmZiB0byBwdWJsaXNoLiBUaGV5IHByb2JhYmx5IHNob3VsZCB0dXJuIG9mZlxuICAgICAgICAvLyBhdXRvcHVibGlzaC4gKFRoaXMgY2hlY2sgaXNuJ3QgcGVyZmVjdCAtLSBpZiB5b3UgY3JlYXRlIGFcbiAgICAgICAgLy8gcHVibGlzaCBiZWZvcmUgeW91IHR1cm4gb24gYXV0b3B1Ymxpc2gsIGl0IHdvbid0IGNhdGNoXG4gICAgICAgIC8vIGl0LCBidXQgdGhpcyB3aWxsIGRlZmluaXRlbHkgaGFuZGxlIHRoZSBzaW1wbGUgY2FzZSB3aGVyZVxuICAgICAgICAvLyB5b3UndmUgYWRkZWQgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2UgdG8geW91ciBhcHAsIGFuZCBhcmVcbiAgICAgICAgLy8gY2FsbGluZyBwdWJsaXNoIGZyb20geW91ciBhcHAgY29kZSkuXG4gICAgICAgIGlmICghc2VsZi53YXJuZWRfYWJvdXRfYXV0b3B1Ymxpc2gpIHtcbiAgICAgICAgICBzZWxmLndhcm5lZF9hYm91dF9hdXRvcHVibGlzaCA9IHRydWU7XG4gICAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICBcIioqIFlvdSd2ZSBzZXQgdXAgc29tZSBkYXRhIHN1YnNjcmlwdGlvbnMgd2l0aCBNZXRlb3IucHVibGlzaCgpLCBidXRcXG5cIiArXG4gICAgXCIqKiB5b3Ugc3RpbGwgaGF2ZSBhdXRvcHVibGlzaCB0dXJuZWQgb24uIEJlY2F1c2UgYXV0b3B1Ymxpc2ggaXMgc3RpbGxcXG5cIiArXG4gICAgXCIqKiBvbiwgeW91ciBNZXRlb3IucHVibGlzaCgpIGNhbGxzIHdvbid0IGhhdmUgbXVjaCBlZmZlY3QuIEFsbCBkYXRhXFxuXCIgK1xuICAgIFwiKiogd2lsbCBzdGlsbCBiZSBzZW50IHRvIGFsbCBjbGllbnRzLlxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogVHVybiBvZmYgYXV0b3B1Ymxpc2ggYnkgcmVtb3ZpbmcgdGhlIGF1dG9wdWJsaXNoIHBhY2thZ2U6XFxuXCIgK1xuICAgIFwiKipcXG5cIiArXG4gICAgXCIqKiAgICQgbWV0ZW9yIHJlbW92ZSBhdXRvcHVibGlzaFxcblwiICtcbiAgICBcIioqXFxuXCIgK1xuICAgIFwiKiogLi4gYW5kIG1ha2Ugc3VyZSB5b3UgaGF2ZSBNZXRlb3IucHVibGlzaCgpIGFuZCBNZXRlb3Iuc3Vic2NyaWJlKCkgY2FsbHNcXG5cIiArXG4gICAgXCIqKiBmb3IgZWFjaCBjb2xsZWN0aW9uIHRoYXQgeW91IHdhbnQgY2xpZW50cyB0byBzZWUuXFxuXCIpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChuYW1lKVxuICAgICAgICBzZWxmLnB1Ymxpc2hfaGFuZGxlcnNbbmFtZV0gPSBoYW5kbGVyO1xuICAgICAgZWxzZSB7XG4gICAgICAgIHNlbGYudW5pdmVyc2FsX3B1Ymxpc2hfaGFuZGxlcnMucHVzaChoYW5kbGVyKTtcbiAgICAgICAgLy8gU3BpbiB1cCB0aGUgbmV3IHB1Ymxpc2hlciBvbiBhbnkgZXhpc3Rpbmcgc2Vzc2lvbiB0b28uIFJ1biBlYWNoXG4gICAgICAgIC8vIHNlc3Npb24ncyBzdWJzY3JpcHRpb24gaW4gYSBuZXcgRmliZXIsIHNvIHRoYXQgdGhlcmUncyBubyBjaGFuZ2UgZm9yXG4gICAgICAgIC8vIHNlbGYuc2Vzc2lvbnMgdG8gY2hhbmdlIHdoaWxlIHdlJ3JlIHJ1bm5pbmcgdGhpcyBsb29wLlxuICAgICAgICBzZWxmLnNlc3Npb25zLmZvckVhY2goZnVuY3Rpb24gKHNlc3Npb24pIHtcbiAgICAgICAgICBpZiAoIXNlc3Npb24uX2RvbnRTdGFydE5ld1VuaXZlcnNhbFN1YnMpIHtcbiAgICAgICAgICAgIHNlc3Npb24uX3N0YXJ0U3Vic2NyaXB0aW9uKGhhbmRsZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2V7XG4gICAgICBfLmVhY2gobmFtZSwgZnVuY3Rpb24odmFsdWUsIGtleSkge1xuICAgICAgICBzZWxmLnB1Ymxpc2goa2V5LCB2YWx1ZSwge30pO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIF9yZW1vdmVTZXNzaW9uOiBmdW5jdGlvbiAoc2Vzc2lvbikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLnNlc3Npb25zLmRlbGV0ZShzZXNzaW9uLmlkKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgVGVsbHMgaWYgdGhlIG1ldGhvZCBjYWxsIGNhbWUgZnJvbSBhIGNhbGwgb3IgYSBjYWxsQXN5bmMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQHJldHVybnMgYm9vbGVhblxuICAgKi9cbiAgaXNBc3luY0NhbGw6IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZygpXG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IERlZmluZXMgZnVuY3Rpb25zIHRoYXQgY2FuIGJlIGludm9rZWQgb3ZlciB0aGUgbmV0d29yayBieSBjbGllbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtPYmplY3R9IG1ldGhvZHMgRGljdGlvbmFyeSB3aG9zZSBrZXlzIGFyZSBtZXRob2QgbmFtZXMgYW5kIHZhbHVlcyBhcmUgZnVuY3Rpb25zLlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICovXG4gIG1ldGhvZHM6IGZ1bmN0aW9uIChtZXRob2RzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIF8uZWFjaChtZXRob2RzLCBmdW5jdGlvbiAoZnVuYywgbmFtZSkge1xuICAgICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNZXRob2QgJ1wiICsgbmFtZSArIFwiJyBtdXN0IGJlIGEgZnVuY3Rpb25cIik7XG4gICAgICBpZiAoc2VsZi5tZXRob2RfaGFuZGxlcnNbbmFtZV0pXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbWV0aG9kIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgYWxyZWFkeSBkZWZpbmVkXCIpO1xuICAgICAgc2VsZi5tZXRob2RfaGFuZGxlcnNbbmFtZV0gPSBmdW5jO1xuICAgIH0pO1xuICB9LFxuXG4gIGNhbGw6IGZ1bmN0aW9uIChuYW1lLCAuLi5hcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICYmIHR5cGVvZiBhcmdzW2FyZ3MubGVuZ3RoIC0gMV0gPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgLy8gSWYgaXQncyBhIGZ1bmN0aW9uLCB0aGUgbGFzdCBhcmd1bWVudCBpcyB0aGUgcmVzdWx0IGNhbGxiYWNrLCBub3RcbiAgICAgIC8vIGEgcGFyYW1ldGVyIHRvIHRoZSByZW1vdGUgbWV0aG9kLlxuICAgICAgdmFyIGNhbGxiYWNrID0gYXJncy5wb3AoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5hcHBseShuYW1lLCBhcmdzLCBjYWxsYmFjayk7XG4gIH0sXG5cbiAgLy8gQSB2ZXJzaW9uIG9mIHRoZSBjYWxsIG1ldGhvZCB0aGF0IGFsd2F5cyByZXR1cm5zIGEgUHJvbWlzZS5cbiAgY2FsbEFzeW5jOiBmdW5jdGlvbiAobmFtZSwgLi4uYXJncykge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBhcmdzWzBdPy5oYXNPd25Qcm9wZXJ0eSgncmV0dXJuU3R1YlZhbHVlJylcbiAgICAgID8gYXJncy5zaGlmdCgpXG4gICAgICA6IHt9O1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldCgpO1xuICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcodHJ1ZSk7XG4gICAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIEREUC5fQ3VycmVudENhbGxBc3luY0ludm9jYXRpb24uX3NldCh7IG5hbWUsIGhhc0NhbGxBc3luY1BhcmVudDogdHJ1ZSB9KTtcbiAgICAgIHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzLCB7IGlzRnJvbUNhbGxBc3luYzogdHJ1ZSwgLi4ub3B0aW9ucyB9KVxuICAgICAgICAudGhlbihyZXNvbHZlKVxuICAgICAgICAuY2F0Y2gocmVqZWN0KVxuICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgRERQLl9DdXJyZW50Q2FsbEFzeW5jSW52b2NhdGlvbi5fc2V0KCk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICAgIHJldHVybiBwcm9taXNlLmZpbmFsbHkoKCkgPT5cbiAgICAgIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX3NldENhbGxBc3luY01ldGhvZFJ1bm5pbmcoZmFsc2UpXG4gICAgKTtcbiAgfSxcblxuICBhcHBseTogZnVuY3Rpb24gKG5hbWUsIGFyZ3MsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgLy8gV2Ugd2VyZSBwYXNzZWQgMyBhcmd1bWVudHMuIFRoZXkgbWF5IGJlIGVpdGhlciAobmFtZSwgYXJncywgb3B0aW9ucylcbiAgICAvLyBvciAobmFtZSwgYXJncywgY2FsbGJhY2spXG4gICAgaWYgKCEgY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgfVxuICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLmFwcGx5QXN5bmMobmFtZSwgYXJncywgb3B0aW9ucyk7XG5cbiAgICAvLyBSZXR1cm4gdGhlIHJlc3VsdCBpbiB3aGljaGV2ZXIgd2F5IHRoZSBjYWxsZXIgYXNrZWQgZm9yIGl0LiBOb3RlIHRoYXQgd2VcbiAgICAvLyBkbyBOT1QgYmxvY2sgb24gdGhlIHdyaXRlIGZlbmNlIGluIGFuIGFuYWxvZ291cyB3YXkgdG8gaG93IHRoZSBjbGllbnRcbiAgICAvLyBibG9ja3Mgb24gdGhlIHJlbGV2YW50IGRhdGEgYmVpbmcgdmlzaWJsZSwgc28geW91IGFyZSBOT1QgZ3VhcmFudGVlZCB0aGF0XG4gICAgLy8gY3Vyc29yIG9ic2VydmUgY2FsbGJhY2tzIGhhdmUgZmlyZWQgd2hlbiB5b3VyIGNhbGxiYWNrIGlzIGludm9rZWQuIChXZVxuICAgIC8vIGNhbiBjaGFuZ2UgdGhpcyBpZiB0aGVyZSdzIGEgcmVhbCB1c2UgY2FzZSkuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBwcm9taXNlLnRoZW4oXG4gICAgICAgIHJlc3VsdCA9PiBjYWxsYmFjayh1bmRlZmluZWQsIHJlc3VsdCksXG4gICAgICAgIGV4Y2VwdGlvbiA9PiBjYWxsYmFjayhleGNlcHRpb24pXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gQHBhcmFtIG9wdGlvbnMge09wdGlvbmFsIE9iamVjdH1cbiAgYXBwbHlBc3luYzogZnVuY3Rpb24gKG5hbWUsIGFyZ3MsIG9wdGlvbnMpIHtcbiAgICAvLyBSdW4gdGhlIGhhbmRsZXJcbiAgICB2YXIgaGFuZGxlciA9IHRoaXMubWV0aG9kX2hhbmRsZXJzW25hbWVdO1xuXG4gICAgaWYgKCEgaGFuZGxlcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KFxuICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKDQwNCwgYE1ldGhvZCAnJHtuYW1lfScgbm90IGZvdW5kYClcbiAgICAgICk7XG4gICAgfVxuICAgIC8vIElmIHRoaXMgaXMgYSBtZXRob2QgY2FsbCBmcm9tIHdpdGhpbiBhbm90aGVyIG1ldGhvZCBvciBwdWJsaXNoIGZ1bmN0aW9uLFxuICAgIC8vIGdldCB0aGUgdXNlciBzdGF0ZSBmcm9tIHRoZSBvdXRlciBtZXRob2Qgb3IgcHVibGlzaCBmdW5jdGlvbiwgb3RoZXJ3aXNlXG4gICAgLy8gZG9uJ3QgYWxsb3cgc2V0VXNlcklkIHRvIGJlIGNhbGxlZFxuICAgIHZhciB1c2VySWQgPSBudWxsO1xuICAgIHZhciBzZXRVc2VySWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGNhbGwgc2V0VXNlcklkIG9uIGEgc2VydmVyIGluaXRpYXRlZCBtZXRob2QgY2FsbFwiKTtcbiAgICB9O1xuICAgIHZhciBjb25uZWN0aW9uID0gbnVsbDtcbiAgICB2YXIgY3VycmVudE1ldGhvZEludm9jYXRpb24gPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICAgIHZhciBjdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uID0gRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uLmdldCgpO1xuICAgIHZhciByYW5kb21TZWVkID0gbnVsbDtcbiAgICBpZiAoY3VycmVudE1ldGhvZEludm9jYXRpb24pIHtcbiAgICAgIHVzZXJJZCA9IGN1cnJlbnRNZXRob2RJbnZvY2F0aW9uLnVzZXJJZDtcbiAgICAgIHNldFVzZXJJZCA9IGZ1bmN0aW9uKHVzZXJJZCkge1xuICAgICAgICBjdXJyZW50TWV0aG9kSW52b2NhdGlvbi5zZXRVc2VySWQodXNlcklkKTtcbiAgICAgIH07XG4gICAgICBjb25uZWN0aW9uID0gY3VycmVudE1ldGhvZEludm9jYXRpb24uY29ubmVjdGlvbjtcbiAgICAgIHJhbmRvbVNlZWQgPSBERFBDb21tb24ubWFrZVJwY1NlZWQoY3VycmVudE1ldGhvZEludm9jYXRpb24sIG5hbWUpO1xuICAgIH0gZWxzZSBpZiAoY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbikge1xuICAgICAgdXNlcklkID0gY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi51c2VySWQ7XG4gICAgICBzZXRVc2VySWQgPSBmdW5jdGlvbih1c2VySWQpIHtcbiAgICAgICAgY3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbi5fc2Vzc2lvbi5fc2V0VXNlcklkKHVzZXJJZCk7XG4gICAgICB9O1xuICAgICAgY29ubmVjdGlvbiA9IGN1cnJlbnRQdWJsaWNhdGlvbkludm9jYXRpb24uY29ubmVjdGlvbjtcbiAgICB9XG5cbiAgICB2YXIgaW52b2NhdGlvbiA9IG5ldyBERFBDb21tb24uTWV0aG9kSW52b2NhdGlvbih7XG4gICAgICBpc1NpbXVsYXRpb246IGZhbHNlLFxuICAgICAgdXNlcklkLFxuICAgICAgc2V0VXNlcklkLFxuICAgICAgY29ubmVjdGlvbixcbiAgICAgIHJhbmRvbVNlZWRcbiAgICB9KTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBsZXQgcmVzdWx0O1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVzdWx0ID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi53aXRoVmFsdWUoaW52b2NhdGlvbiwgKCkgPT5cbiAgICAgICAgICBtYXliZUF1ZGl0QXJndW1lbnRDaGVja3MoXG4gICAgICAgICAgICBoYW5kbGVyLFxuICAgICAgICAgICAgaW52b2NhdGlvbixcbiAgICAgICAgICAgIEVKU09OLmNsb25lKGFyZ3MpLFxuICAgICAgICAgICAgXCJpbnRlcm5hbCBjYWxsIHRvICdcIiArIG5hbWUgKyBcIidcIlxuICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlKTtcbiAgICAgIH1cbiAgICAgIGlmICghTWV0ZW9yLl9pc1Byb21pc2UocmVzdWx0KSkge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgfVxuICAgICAgcmVzdWx0LnRoZW4ociA9PiByZXNvbHZlKHIpKS5jYXRjaChyZWplY3QpO1xuICAgIH0pLnRoZW4oRUpTT04uY2xvbmUpO1xuICB9LFxuXG4gIF91cmxGb3JTZXNzaW9uOiBmdW5jdGlvbiAoc2Vzc2lvbklkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBzZXNzaW9uID0gc2VsZi5zZXNzaW9ucy5nZXQoc2Vzc2lvbklkKTtcbiAgICBpZiAoc2Vzc2lvbilcbiAgICAgIHJldHVybiBzZXNzaW9uLl9zb2NrZXRVcmw7XG4gICAgZWxzZVxuICAgICAgcmV0dXJuIG51bGw7XG4gIH1cbn0pO1xuXG52YXIgY2FsY3VsYXRlVmVyc2lvbiA9IGZ1bmN0aW9uIChjbGllbnRTdXBwb3J0ZWRWZXJzaW9ucyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlcnZlclN1cHBvcnRlZFZlcnNpb25zKSB7XG4gIHZhciBjb3JyZWN0VmVyc2lvbiA9IF8uZmluZChjbGllbnRTdXBwb3J0ZWRWZXJzaW9ucywgZnVuY3Rpb24gKHZlcnNpb24pIHtcbiAgICByZXR1cm4gXy5jb250YWlucyhzZXJ2ZXJTdXBwb3J0ZWRWZXJzaW9ucywgdmVyc2lvbik7XG4gIH0pO1xuICBpZiAoIWNvcnJlY3RWZXJzaW9uKSB7XG4gICAgY29ycmVjdFZlcnNpb24gPSBzZXJ2ZXJTdXBwb3J0ZWRWZXJzaW9uc1swXTtcbiAgfVxuICByZXR1cm4gY29ycmVjdFZlcnNpb247XG59O1xuXG5ERFBTZXJ2ZXIuX2NhbGN1bGF0ZVZlcnNpb24gPSBjYWxjdWxhdGVWZXJzaW9uO1xuXG5cbi8vIFwiYmxpbmRcIiBleGNlcHRpb25zIG90aGVyIHRoYW4gdGhvc2UgdGhhdCB3ZXJlIGRlbGliZXJhdGVseSB0aHJvd24gdG8gc2lnbmFsXG4vLyBlcnJvcnMgdG8gdGhlIGNsaWVudFxudmFyIHdyYXBJbnRlcm5hbEV4Y2VwdGlvbiA9IGZ1bmN0aW9uIChleGNlcHRpb24sIGNvbnRleHQpIHtcbiAgaWYgKCFleGNlcHRpb24pIHJldHVybiBleGNlcHRpb247XG5cbiAgLy8gVG8gYWxsb3cgcGFja2FnZXMgdG8gdGhyb3cgZXJyb3JzIGludGVuZGVkIGZvciB0aGUgY2xpZW50IGJ1dCBub3QgaGF2ZSB0b1xuICAvLyBkZXBlbmQgb24gdGhlIE1ldGVvci5FcnJvciBjbGFzcywgYGlzQ2xpZW50U2FmZWAgY2FuIGJlIHNldCB0byB0cnVlIG9uIGFueVxuICAvLyBlcnJvciBiZWZvcmUgaXQgaXMgdGhyb3duLlxuICBpZiAoZXhjZXB0aW9uLmlzQ2xpZW50U2FmZSkge1xuICAgIGlmICghKGV4Y2VwdGlvbiBpbnN0YW5jZW9mIE1ldGVvci5FcnJvcikpIHtcbiAgICAgIGNvbnN0IG9yaWdpbmFsTWVzc2FnZSA9IGV4Y2VwdGlvbi5tZXNzYWdlO1xuICAgICAgZXhjZXB0aW9uID0gbmV3IE1ldGVvci5FcnJvcihleGNlcHRpb24uZXJyb3IsIGV4Y2VwdGlvbi5yZWFzb24sIGV4Y2VwdGlvbi5kZXRhaWxzKTtcbiAgICAgIGV4Y2VwdGlvbi5tZXNzYWdlID0gb3JpZ2luYWxNZXNzYWdlO1xuICAgIH1cbiAgICByZXR1cm4gZXhjZXB0aW9uO1xuICB9XG5cbiAgLy8gVGVzdHMgY2FuIHNldCB0aGUgJ19leHBlY3RlZEJ5VGVzdCcgZmxhZyBvbiBhbiBleGNlcHRpb24gc28gaXQgd29uJ3QgZ28gdG9cbiAgLy8gdGhlIHNlcnZlciBsb2cuXG4gIGlmICghZXhjZXB0aW9uLl9leHBlY3RlZEJ5VGVzdCkge1xuICAgIE1ldGVvci5fZGVidWcoXCJFeGNlcHRpb24gXCIgKyBjb250ZXh0LCBleGNlcHRpb24uc3RhY2spO1xuICAgIGlmIChleGNlcHRpb24uc2FuaXRpemVkRXJyb3IpIHtcbiAgICAgIE1ldGVvci5fZGVidWcoXCJTYW5pdGl6ZWQgYW5kIHJlcG9ydGVkIHRvIHRoZSBjbGllbnQgYXM6XCIsIGV4Y2VwdGlvbi5zYW5pdGl6ZWRFcnJvcik7XG4gICAgICBNZXRlb3IuX2RlYnVnKCk7XG4gICAgfVxuICB9XG5cbiAgLy8gRGlkIHRoZSBlcnJvciBjb250YWluIG1vcmUgZGV0YWlscyB0aGF0IGNvdWxkIGhhdmUgYmVlbiB1c2VmdWwgaWYgY2F1Z2h0IGluXG4gIC8vIHNlcnZlciBjb2RlIChvciBpZiB0aHJvd24gZnJvbSBub24tY2xpZW50LW9yaWdpbmF0ZWQgY29kZSksIGJ1dCBhbHNvXG4gIC8vIHByb3ZpZGVkIGEgXCJzYW5pdGl6ZWRcIiB2ZXJzaW9uIHdpdGggbW9yZSBjb250ZXh0IHRoYW4gNTAwIEludGVybmFsIHNlcnZlclxuICAvLyBlcnJvcj8gVXNlIHRoYXQuXG4gIGlmIChleGNlcHRpb24uc2FuaXRpemVkRXJyb3IpIHtcbiAgICBpZiAoZXhjZXB0aW9uLnNhbml0aXplZEVycm9yLmlzQ2xpZW50U2FmZSlcbiAgICAgIHJldHVybiBleGNlcHRpb24uc2FuaXRpemVkRXJyb3I7XG4gICAgTWV0ZW9yLl9kZWJ1ZyhcIkV4Y2VwdGlvbiBcIiArIGNvbnRleHQgKyBcIiBwcm92aWRlcyBhIHNhbml0aXplZEVycm9yIHRoYXQgXCIgK1xuICAgICAgICAgICAgICAgICAgXCJkb2VzIG5vdCBoYXZlIGlzQ2xpZW50U2FmZSBwcm9wZXJ0eSBzZXQ7IGlnbm9yaW5nXCIpO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBNZXRlb3IuRXJyb3IoNTAwLCBcIkludGVybmFsIHNlcnZlciBlcnJvclwiKTtcbn07XG5cblxuLy8gQXVkaXQgYXJndW1lbnQgY2hlY2tzLCBpZiB0aGUgYXVkaXQtYXJndW1lbnQtY2hlY2tzIHBhY2thZ2UgZXhpc3RzIChpdCBpcyBhXG4vLyB3ZWFrIGRlcGVuZGVuY3kgb2YgdGhpcyBwYWNrYWdlKS5cbnZhciBtYXliZUF1ZGl0QXJndW1lbnRDaGVja3MgPSBmdW5jdGlvbiAoZiwgY29udGV4dCwgYXJncywgZGVzY3JpcHRpb24pIHtcbiAgYXJncyA9IGFyZ3MgfHwgW107XG4gIGlmIChQYWNrYWdlWydhdWRpdC1hcmd1bWVudC1jaGVja3MnXSkge1xuICAgIHJldHVybiBNYXRjaC5fZmFpbElmQXJndW1lbnRzQXJlTm90QWxsQ2hlY2tlZChcbiAgICAgIGYsIGNvbnRleHQsIGFyZ3MsIGRlc2NyaXB0aW9uKTtcbiAgfVxuICByZXR1cm4gZi5hcHBseShjb250ZXh0LCBhcmdzKTtcbn07XG4iLCIvLyBBIHdyaXRlIGZlbmNlIGNvbGxlY3RzIGEgZ3JvdXAgb2Ygd3JpdGVzLCBhbmQgcHJvdmlkZXMgYSBjYWxsYmFja1xuLy8gd2hlbiBhbGwgb2YgdGhlIHdyaXRlcyBhcmUgZnVsbHkgY29tbWl0dGVkIGFuZCBwcm9wYWdhdGVkIChhbGxcbi8vIG9ic2VydmVycyBoYXZlIGJlZW4gbm90aWZpZWQgb2YgdGhlIHdyaXRlIGFuZCBhY2tub3dsZWRnZWQgaXQuKVxuLy9cbkREUFNlcnZlci5fV3JpdGVGZW5jZSA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5hcm1lZCA9IGZhbHNlO1xuICAgIHRoaXMuZmlyZWQgPSBmYWxzZTtcbiAgICB0aGlzLnJldGlyZWQgPSBmYWxzZTtcbiAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcyA9IDA7XG4gICAgdGhpcy5iZWZvcmVfZmlyZV9jYWxsYmFja3MgPSBbXTtcbiAgICB0aGlzLmNvbXBsZXRpb25fY2FsbGJhY2tzID0gW107XG4gIH1cblxuICAvLyBTdGFydCB0cmFja2luZyBhIHdyaXRlLCBhbmQgcmV0dXJuIGFuIG9iamVjdCB0byByZXByZXNlbnQgaXQuIFRoZVxuICAvLyBvYmplY3QgaGFzIGEgc2luZ2xlIG1ldGhvZCwgY29tbWl0dGVkKCkuIFRoaXMgbWV0aG9kIHNob3VsZCBiZVxuICAvLyBjYWxsZWQgd2hlbiB0aGUgd3JpdGUgaXMgZnVsbHkgY29tbWl0dGVkIGFuZCBwcm9wYWdhdGVkLiBZb3UgY2FuXG4gIC8vIGNvbnRpbnVlIHRvIGFkZCB3cml0ZXMgdG8gdGhlIFdyaXRlRmVuY2UgdXAgdW50aWwgaXQgaXMgdHJpZ2dlcmVkXG4gIC8vIChjYWxscyBpdHMgY2FsbGJhY2tzIGJlY2F1c2UgYWxsIHdyaXRlcyBoYXZlIGNvbW1pdHRlZC4pXG4gIGJlZ2luV3JpdGUoKSB7XG4gICAgaWYgKHRoaXMucmV0aXJlZClcbiAgICAgIHJldHVybiB7IGNvbW1pdHRlZDogZnVuY3Rpb24gKCkge30gfTtcblxuICAgIGlmICh0aGlzLmZpcmVkKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiZmVuY2UgaGFzIGFscmVhZHkgYWN0aXZhdGVkIC0tIHRvbyBsYXRlIHRvIGFkZCB3cml0ZXNcIik7XG5cbiAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcysrO1xuICAgIGxldCBjb21taXR0ZWQgPSBmYWxzZTtcbiAgICBjb25zdCBfY29tbWl0dGVkRm4gPSBhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoY29tbWl0dGVkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjb21taXR0ZWQgY2FsbGVkIHR3aWNlIG9uIHRoZSBzYW1lIHdyaXRlXCIpO1xuICAgICAgY29tbWl0dGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMub3V0c3RhbmRpbmdfd3JpdGVzLS07XG4gICAgICBhd2FpdCB0aGlzLl9tYXliZUZpcmUoKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGNvbW1pdHRlZDogX2NvbW1pdHRlZEZuLFxuICAgIH07XG4gIH1cblxuICAvLyBBcm0gdGhlIGZlbmNlLiBPbmNlIHRoZSBmZW5jZSBpcyBhcm1lZCwgYW5kIHRoZXJlIGFyZSBubyBtb3JlXG4gIC8vIHVuY29tbWl0dGVkIHdyaXRlcywgaXQgd2lsbCBhY3RpdmF0ZS5cbiAgYXJtKCkge1xuXG4gICAgaWYgKHRoaXMgPT09IEREUFNlcnZlci5fZ2V0Q3VycmVudEZlbmNlKCkpXG4gICAgICB0aHJvdyBFcnJvcihcIkNhbid0IGFybSB0aGUgY3VycmVudCBmZW5jZVwiKTtcbiAgICB0aGlzLmFybWVkID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcy5fbWF5YmVGaXJlKCk7XG4gIH1cblxuICAvLyBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBvbmNlIGJlZm9yZSBmaXJpbmcgdGhlIGZlbmNlLlxuICAvLyBDYWxsYmFjayBmdW5jdGlvbiBjYW4gYWRkIG5ldyB3cml0ZXMgdG8gdGhlIGZlbmNlLCBpbiB3aGljaCBjYXNlXG4gIC8vIGl0IHdvbid0IGZpcmUgdW50aWwgdGhvc2Ugd3JpdGVzIGFyZSBkb25lIGFzIHdlbGwuXG4gIG9uQmVmb3JlRmlyZShmdW5jKSB7XG4gICAgaWYgKHRoaXMuZmlyZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJmZW5jZSBoYXMgYWxyZWFkeSBhY3RpdmF0ZWQgLS0gdG9vIGxhdGUgdG8gXCIgK1xuICAgICAgICAgIFwiYWRkIGEgY2FsbGJhY2tcIik7XG4gICAgdGhpcy5iZWZvcmVfZmlyZV9jYWxsYmFja3MucHVzaChmdW5jKTtcbiAgfVxuXG4gIC8vIFJlZ2lzdGVyIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdoZW4gdGhlIGZlbmNlIGZpcmVzLlxuICBvbkFsbENvbW1pdHRlZChmdW5jKSB7XG4gICAgaWYgKHRoaXMuZmlyZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJmZW5jZSBoYXMgYWxyZWFkeSBhY3RpdmF0ZWQgLS0gdG9vIGxhdGUgdG8gXCIgK1xuICAgICAgICAgIFwiYWRkIGEgY2FsbGJhY2tcIik7XG4gICAgdGhpcy5jb21wbGV0aW9uX2NhbGxiYWNrcy5wdXNoKGZ1bmMpO1xuICB9XG5cbiAgYXN5bmMgX2FybUFuZFdhaXQoKSB7XG4gICAgbGV0IHJlc29sdmVyO1xuICAgIGNvbnN0IHJldHVyblZhbHVlID0gbmV3IFByb21pc2UociA9PiByZXNvbHZlciA9IHIpO1xuICAgIHRoaXMub25BbGxDb21taXR0ZWQocmVzb2x2ZXIpO1xuICAgIGF3YWl0IHRoaXMuYXJtKCk7XG5cbiAgICByZXR1cm4gcmV0dXJuVmFsdWU7XG4gIH1cbiAgLy8gQ29udmVuaWVuY2UgZnVuY3Rpb24uIEFybXMgdGhlIGZlbmNlLCB0aGVuIGJsb2NrcyB1bnRpbCBpdCBmaXJlcy5cbiAgYXN5bmMgYXJtQW5kV2FpdCgpIHtcbiAgICByZXR1cm4gdGhpcy5fYXJtQW5kV2FpdCgpO1xuICB9XG5cbiAgYXN5bmMgX21heWJlRmlyZSgpIHtcbiAgICBpZiAodGhpcy5maXJlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIndyaXRlIGZlbmNlIGFscmVhZHkgYWN0aXZhdGVkP1wiKTtcbiAgICBpZiAodGhpcy5hcm1lZCAmJiAhdGhpcy5vdXRzdGFuZGluZ193cml0ZXMpIHtcbiAgICAgIGNvbnN0IGludm9rZUNhbGxiYWNrID0gYXN5bmMgKGZ1bmMpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBmdW5jKHRoaXMpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBNZXRlb3IuX2RlYnVnKFwiZXhjZXB0aW9uIGluIHdyaXRlIGZlbmNlIGNhbGxiYWNrOlwiLCBlcnIpO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcysrO1xuICAgICAgd2hpbGUgKHRoaXMuYmVmb3JlX2ZpcmVfY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY29uc3QgY2IgPSB0aGlzLmJlZm9yZV9maXJlX2NhbGxiYWNrcy5zaGlmdCgpO1xuICAgICAgICBhd2FpdCBpbnZva2VDYWxsYmFjayhjYik7XG4gICAgICB9XG4gICAgICB0aGlzLm91dHN0YW5kaW5nX3dyaXRlcy0tO1xuXG4gICAgICBpZiAoIXRoaXMub3V0c3RhbmRpbmdfd3JpdGVzKSB7XG4gICAgICAgIHRoaXMuZmlyZWQgPSB0cnVlO1xuICAgICAgICBjb25zdCBjYWxsYmFja3MgPSB0aGlzLmNvbXBsZXRpb25fY2FsbGJhY2tzIHx8IFtdO1xuICAgICAgICB0aGlzLmNvbXBsZXRpb25fY2FsbGJhY2tzID0gW107XG4gICAgICAgIHdoaWxlIChjYWxsYmFja3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGNvbnN0IGNiID0gY2FsbGJhY2tzLnNoaWZ0KCk7XG4gICAgICAgICAgYXdhaXQgaW52b2tlQ2FsbGJhY2soY2IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gRGVhY3RpdmF0ZSB0aGlzIGZlbmNlIHNvIHRoYXQgYWRkaW5nIG1vcmUgd3JpdGVzIGhhcyBubyBlZmZlY3QuXG4gIC8vIFRoZSBmZW5jZSBtdXN0IGhhdmUgYWxyZWFkeSBmaXJlZC5cbiAgcmV0aXJlKCkge1xuICAgIGlmICghdGhpcy5maXJlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHJldGlyZSBhIGZlbmNlIHRoYXQgaGFzbid0IGZpcmVkLlwiKTtcbiAgICB0aGlzLnJldGlyZWQgPSB0cnVlO1xuICB9XG59O1xuXG4vLyBUaGUgY3VycmVudCB3cml0ZSBmZW5jZS4gV2hlbiB0aGVyZSBpcyBhIGN1cnJlbnQgd3JpdGUgZmVuY2UsIGNvZGVcbi8vIHRoYXQgd3JpdGVzIHRvIGRhdGFiYXNlcyBzaG91bGQgcmVnaXN0ZXIgdGhlaXIgd3JpdGVzIHdpdGggaXQgdXNpbmdcbi8vIGJlZ2luV3JpdGUoKS5cbi8vXG5ERFBTZXJ2ZXIuX0N1cnJlbnRXcml0ZUZlbmNlID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlO1xuIiwiLy8gQSBcImNyb3NzYmFyXCIgaXMgYSBjbGFzcyB0aGF0IHByb3ZpZGVzIHN0cnVjdHVyZWQgbm90aWZpY2F0aW9uIHJlZ2lzdHJhdGlvbi5cbi8vIFNlZSBfbWF0Y2ggZm9yIHRoZSBkZWZpbml0aW9uIG9mIGhvdyBhIG5vdGlmaWNhdGlvbiBtYXRjaGVzIGEgdHJpZ2dlci5cbi8vIEFsbCBub3RpZmljYXRpb25zIGFuZCB0cmlnZ2VycyBtdXN0IGhhdmUgYSBzdHJpbmcga2V5IG5hbWVkICdjb2xsZWN0aW9uJy5cblxuRERQU2VydmVyLl9Dcm9zc2JhciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgc2VsZi5uZXh0SWQgPSAxO1xuICAvLyBtYXAgZnJvbSBjb2xsZWN0aW9uIG5hbWUgKHN0cmluZykgLT4gbGlzdGVuZXIgaWQgLT4gb2JqZWN0LiBlYWNoIG9iamVjdCBoYXNcbiAgLy8ga2V5cyAndHJpZ2dlcicsICdjYWxsYmFjaycuICBBcyBhIGhhY2ssIHRoZSBlbXB0eSBzdHJpbmcgbWVhbnMgXCJub1xuICAvLyBjb2xsZWN0aW9uXCIuXG4gIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uID0ge307XG4gIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnQgPSB7fTtcbiAgc2VsZi5mYWN0UGFja2FnZSA9IG9wdGlvbnMuZmFjdFBhY2thZ2UgfHwgXCJsaXZlZGF0YVwiO1xuICBzZWxmLmZhY3ROYW1lID0gb3B0aW9ucy5mYWN0TmFtZSB8fCBudWxsO1xufTtcblxuXy5leHRlbmQoRERQU2VydmVyLl9Dcm9zc2Jhci5wcm90b3R5cGUsIHtcbiAgLy8gbXNnIGlzIGEgdHJpZ2dlciBvciBhIG5vdGlmaWNhdGlvblxuICBfY29sbGVjdGlvbkZvck1lc3NhZ2U6IGZ1bmN0aW9uIChtc2cpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCEgXy5oYXMobXNnLCAnY29sbGVjdGlvbicpKSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YobXNnLmNvbGxlY3Rpb24pID09PSAnc3RyaW5nJykge1xuICAgICAgaWYgKG1zZy5jb2xsZWN0aW9uID09PSAnJylcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJNZXNzYWdlIGhhcyBlbXB0eSBjb2xsZWN0aW9uIVwiKTtcbiAgICAgIHJldHVybiBtc2cuY29sbGVjdGlvbjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgRXJyb3IoXCJNZXNzYWdlIGhhcyBub24tc3RyaW5nIGNvbGxlY3Rpb24hXCIpO1xuICAgIH1cbiAgfSxcblxuICAvLyBMaXN0ZW4gZm9yIG5vdGlmaWNhdGlvbiB0aGF0IG1hdGNoICd0cmlnZ2VyJy4gQSBub3RpZmljYXRpb25cbiAgLy8gbWF0Y2hlcyBpZiBpdCBoYXMgdGhlIGtleS12YWx1ZSBwYWlycyBpbiB0cmlnZ2VyIGFzIGFcbiAgLy8gc3Vic2V0LiBXaGVuIGEgbm90aWZpY2F0aW9uIG1hdGNoZXMsIGNhbGwgJ2NhbGxiYWNrJywgcGFzc2luZ1xuICAvLyB0aGUgYWN0dWFsIG5vdGlmaWNhdGlvbi5cbiAgLy9cbiAgLy8gUmV0dXJucyBhIGxpc3RlbiBoYW5kbGUsIHdoaWNoIGlzIGFuIG9iamVjdCB3aXRoIGEgbWV0aG9kXG4gIC8vIHN0b3AoKS4gQ2FsbCBzdG9wKCkgdG8gc3RvcCBsaXN0ZW5pbmcuXG4gIC8vXG4gIC8vIFhYWCBJdCBzaG91bGQgYmUgbGVnYWwgdG8gY2FsbCBmaXJlKCkgZnJvbSBpbnNpZGUgYSBsaXN0ZW4oKVxuICAvLyBjYWxsYmFjaz9cbiAgbGlzdGVuOiBmdW5jdGlvbiAodHJpZ2dlciwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGlkID0gc2VsZi5uZXh0SWQrKztcblxuICAgIHZhciBjb2xsZWN0aW9uID0gc2VsZi5fY29sbGVjdGlvbkZvck1lc3NhZ2UodHJpZ2dlcik7XG4gICAgdmFyIHJlY29yZCA9IHt0cmlnZ2VyOiBFSlNPTi5jbG9uZSh0cmlnZ2VyKSwgY2FsbGJhY2s6IGNhbGxiYWNrfTtcbiAgICBpZiAoISBfLmhhcyhzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbiwgY29sbGVjdGlvbikpIHtcbiAgICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uW2NvbGxlY3Rpb25dID0ge307XG4gICAgICBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbkNvdW50W2NvbGxlY3Rpb25dID0gMDtcbiAgICB9XG4gICAgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbl1baWRdID0gcmVjb3JkO1xuICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl0rKztcblxuICAgIGlmIChzZWxmLmZhY3ROYW1lICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSkge1xuICAgICAgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIHNlbGYuZmFjdFBhY2thZ2UsIHNlbGYuZmFjdE5hbWUsIDEpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmIChzZWxmLmZhY3ROYW1lICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSkge1xuICAgICAgICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgICAgICAgc2VsZi5mYWN0UGFja2FnZSwgc2VsZi5mYWN0TmFtZSwgLTEpO1xuICAgICAgICB9XG4gICAgICAgIGRlbGV0ZSBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXVtpZF07XG4gICAgICAgIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl0tLTtcbiAgICAgICAgaWYgKHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl0gPT09IDApIHtcbiAgICAgICAgICBkZWxldGUgc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb25bY29sbGVjdGlvbl07XG4gICAgICAgICAgZGVsZXRlIHNlbGYubGlzdGVuZXJzQnlDb2xsZWN0aW9uQ291bnRbY29sbGVjdGlvbl07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuICB9LFxuXG4gIC8vIEZpcmUgdGhlIHByb3ZpZGVkICdub3RpZmljYXRpb24nIChhbiBvYmplY3Qgd2hvc2UgYXR0cmlidXRlXG4gIC8vIHZhbHVlcyBhcmUgYWxsIEpTT04tY29tcGF0aWJpbGUpIC0tIGluZm9ybSBhbGwgbWF0Y2hpbmcgbGlzdGVuZXJzXG4gIC8vIChyZWdpc3RlcmVkIHdpdGggbGlzdGVuKCkpLlxuICAvL1xuICAvLyBJZiBmaXJlKCkgaXMgY2FsbGVkIGluc2lkZSBhIHdyaXRlIGZlbmNlLCB0aGVuIGVhY2ggb2YgdGhlXG4gIC8vIGxpc3RlbmVyIGNhbGxiYWNrcyB3aWxsIGJlIGNhbGxlZCBpbnNpZGUgdGhlIHdyaXRlIGZlbmNlIGFzIHdlbGwuXG4gIC8vXG4gIC8vIFRoZSBsaXN0ZW5lcnMgbWF5IGJlIGludm9rZWQgaW4gcGFyYWxsZWwsIHJhdGhlciB0aGFuIHNlcmlhbGx5LlxuICBmaXJlOiBhc3luYyBmdW5jdGlvbiAobm90aWZpY2F0aW9uKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLl9jb2xsZWN0aW9uRm9yTWVzc2FnZShub3RpZmljYXRpb24pO1xuXG4gICAgaWYgKCEgXy5oYXMoc2VsZi5saXN0ZW5lcnNCeUNvbGxlY3Rpb24sIGNvbGxlY3Rpb24pKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGxpc3RlbmVyc0ZvckNvbGxlY3Rpb24gPSBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXTtcbiAgICB2YXIgY2FsbGJhY2tJZHMgPSBbXTtcbiAgICBfLmVhY2gobGlzdGVuZXJzRm9yQ29sbGVjdGlvbiwgZnVuY3Rpb24gKGwsIGlkKSB7XG4gICAgICBpZiAoc2VsZi5fbWF0Y2hlcyhub3RpZmljYXRpb24sIGwudHJpZ2dlcikpIHtcbiAgICAgICAgY2FsbGJhY2tJZHMucHVzaChpZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBMaXN0ZW5lciBjYWxsYmFja3MgY2FuIHlpZWxkLCBzbyB3ZSBuZWVkIHRvIGZpcnN0IGZpbmQgYWxsIHRoZSBvbmVzIHRoYXRcbiAgICAvLyBtYXRjaCBpbiBhIHNpbmdsZSBpdGVyYXRpb24gb3ZlciBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbiAod2hpY2ggY2FuJ3RcbiAgICAvLyBiZSBtdXRhdGVkIGR1cmluZyB0aGlzIGl0ZXJhdGlvbiksIGFuZCB0aGVuIGludm9rZSB0aGUgbWF0Y2hpbmdcbiAgICAvLyBjYWxsYmFja3MsIGNoZWNraW5nIGJlZm9yZSBlYWNoIGNhbGwgdG8gZW5zdXJlIHRoZXkgaGF2ZW4ndCBzdG9wcGVkLlxuICAgIC8vIE5vdGUgdGhhdCB3ZSBkb24ndCBoYXZlIHRvIGNoZWNrIHRoYXRcbiAgICAvLyBzZWxmLmxpc3RlbmVyc0J5Q29sbGVjdGlvbltjb2xsZWN0aW9uXSBzdGlsbCA9PT0gbGlzdGVuZXJzRm9yQ29sbGVjdGlvbixcbiAgICAvLyBiZWNhdXNlIHRoZSBvbmx5IHdheSB0aGF0IHN0b3BzIGJlaW5nIHRydWUgaXMgaWYgbGlzdGVuZXJzRm9yQ29sbGVjdGlvblxuICAgIC8vIGZpcnN0IGdldHMgcmVkdWNlZCBkb3duIHRvIHRoZSBlbXB0eSBvYmplY3QgKGFuZCB0aGVuIG5ldmVyIGdldHNcbiAgICAvLyBpbmNyZWFzZWQgYWdhaW4pLlxuICAgIGZvciAoY29uc3QgaWQgb2YgY2FsbGJhY2tJZHMpIHtcbiAgICAgIGlmIChfLmhhcyhsaXN0ZW5lcnNGb3JDb2xsZWN0aW9uLCBpZCkpIHtcbiAgICAgICAgYXdhaXQgbGlzdGVuZXJzRm9yQ29sbGVjdGlvbltpZF0uY2FsbGJhY2sobm90aWZpY2F0aW9uKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLy8gQSBub3RpZmljYXRpb24gbWF0Y2hlcyBhIHRyaWdnZXIgaWYgYWxsIGtleXMgdGhhdCBleGlzdCBpbiBib3RoIGFyZSBlcXVhbC5cbiAgLy9cbiAgLy8gRXhhbXBsZXM6XG4gIC8vICBOOntjb2xsZWN0aW9uOiBcIkNcIn0gbWF0Y2hlcyBUOntjb2xsZWN0aW9uOiBcIkNcIn1cbiAgLy8gICAgKGEgbm9uLXRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBtYXRjaGVzIGFcbiAgLy8gICAgIG5vbi10YXJnZXRlZCBxdWVyeSlcbiAgLy8gIE46e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJYXCJ9IG1hdGNoZXMgVDp7Y29sbGVjdGlvbjogXCJDXCJ9XG4gIC8vICAgIChhIHRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBtYXRjaGVzIGEgbm9uLXRhcmdldGVkIHF1ZXJ5KVxuICAvLyAgTjp7Y29sbGVjdGlvbjogXCJDXCJ9IG1hdGNoZXMgVDp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIlhcIn1cbiAgLy8gICAgKGEgbm9uLXRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBtYXRjaGVzIGFcbiAgLy8gICAgIHRhcmdldGVkIHF1ZXJ5KVxuICAvLyAgTjp7Y29sbGVjdGlvbjogXCJDXCIsIGlkOiBcIlhcIn0gbWF0Y2hlcyBUOntjb2xsZWN0aW9uOiBcIkNcIiwgaWQ6IFwiWFwifVxuICAvLyAgICAoYSB0YXJnZXRlZCB3cml0ZSB0byBhIGNvbGxlY3Rpb24gbWF0Y2hlcyBhIHRhcmdldGVkIHF1ZXJ5IHRhcmdldGVkXG4gIC8vICAgICBhdCB0aGUgc2FtZSBkb2N1bWVudClcbiAgLy8gIE46e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJYXCJ9IGRvZXMgbm90IG1hdGNoIFQ6e2NvbGxlY3Rpb246IFwiQ1wiLCBpZDogXCJZXCJ9XG4gIC8vICAgIChhIHRhcmdldGVkIHdyaXRlIHRvIGEgY29sbGVjdGlvbiBkb2VzIG5vdCBtYXRjaCBhIHRhcmdldGVkIHF1ZXJ5XG4gIC8vICAgICB0YXJnZXRlZCBhdCBhIGRpZmZlcmVudCBkb2N1bWVudClcbiAgX21hdGNoZXM6IGZ1bmN0aW9uIChub3RpZmljYXRpb24sIHRyaWdnZXIpIHtcbiAgICAvLyBNb3N0IG5vdGlmaWNhdGlvbnMgdGhhdCB1c2UgdGhlIGNyb3NzYmFyIGhhdmUgYSBzdHJpbmcgYGNvbGxlY3Rpb25gIGFuZFxuICAgIC8vIG1heWJlIGFuIGBpZGAgdGhhdCBpcyBhIHN0cmluZyBvciBPYmplY3RJRC4gV2UncmUgYWxyZWFkeSBkaXZpZGluZyB1cFxuICAgIC8vIHRyaWdnZXJzIGJ5IGNvbGxlY3Rpb24sIGJ1dCBsZXQncyBmYXN0LXRyYWNrIFwibm9wZSwgZGlmZmVyZW50IElEXCIgKGFuZFxuICAgIC8vIGF2b2lkIHRoZSBvdmVybHkgZ2VuZXJpYyBFSlNPTi5lcXVhbHMpLiBUaGlzIG1ha2VzIGEgbm90aWNlYWJsZVxuICAgIC8vIHBlcmZvcm1hbmNlIGRpZmZlcmVuY2U7IHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9wdWxsLzM2OTdcbiAgICBpZiAodHlwZW9mKG5vdGlmaWNhdGlvbi5pZCkgPT09ICdzdHJpbmcnICYmXG4gICAgICAgIHR5cGVvZih0cmlnZ2VyLmlkKSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgbm90aWZpY2F0aW9uLmlkICE9PSB0cmlnZ2VyLmlkKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGlmIChub3RpZmljYXRpb24uaWQgaW5zdGFuY2VvZiBNb25nb0lELk9iamVjdElEICYmXG4gICAgICAgIHRyaWdnZXIuaWQgaW5zdGFuY2VvZiBNb25nb0lELk9iamVjdElEICYmXG4gICAgICAgICEgbm90aWZpY2F0aW9uLmlkLmVxdWFscyh0cmlnZ2VyLmlkKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBfLmFsbCh0cmlnZ2VyLCBmdW5jdGlvbiAodHJpZ2dlclZhbHVlLCBrZXkpIHtcbiAgICAgIHJldHVybiAhXy5oYXMobm90aWZpY2F0aW9uLCBrZXkpIHx8XG4gICAgICAgIEVKU09OLmVxdWFscyh0cmlnZ2VyVmFsdWUsIG5vdGlmaWNhdGlvbltrZXldKTtcbiAgICB9KTtcbiAgfVxufSk7XG5cbi8vIFRoZSBcImludmFsaWRhdGlvbiBjcm9zc2JhclwiIGlzIGEgc3BlY2lmaWMgaW5zdGFuY2UgdXNlZCBieSB0aGUgRERQIHNlcnZlciB0b1xuLy8gaW1wbGVtZW50IHdyaXRlIGZlbmNlIG5vdGlmaWNhdGlvbnMuIExpc3RlbmVyIGNhbGxiYWNrcyBvbiB0aGlzIGNyb3NzYmFyXG4vLyBzaG91bGQgY2FsbCBiZWdpbldyaXRlIG9uIHRoZSBjdXJyZW50IHdyaXRlIGZlbmNlIGJlZm9yZSB0aGV5IHJldHVybiwgaWYgdGhleVxuLy8gd2FudCB0byBkZWxheSB0aGUgd3JpdGUgZmVuY2UgZnJvbSBmaXJpbmcgKGllLCB0aGUgRERQIG1ldGhvZC1kYXRhLXVwZGF0ZWRcbi8vIG1lc3NhZ2UgZnJvbSBiZWluZyBzZW50KS5cbkREUFNlcnZlci5fSW52YWxpZGF0aW9uQ3Jvc3NiYXIgPSBuZXcgRERQU2VydmVyLl9Dcm9zc2Jhcih7XG4gIGZhY3ROYW1lOiBcImludmFsaWRhdGlvbi1jcm9zc2Jhci1saXN0ZW5lcnNcIlxufSk7XG4iLCJpZiAocHJvY2Vzcy5lbnYuRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkwpIHtcbiAgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCA9XG4gICAgcHJvY2Vzcy5lbnYuRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkw7XG59XG5cbk1ldGVvci5zZXJ2ZXIgPSBuZXcgU2VydmVyKCk7XG5cbk1ldGVvci5yZWZyZXNoID0gYXN5bmMgZnVuY3Rpb24gKG5vdGlmaWNhdGlvbikge1xuICBhd2FpdCBERFBTZXJ2ZXIuX0ludmFsaWRhdGlvbkNyb3NzYmFyLmZpcmUobm90aWZpY2F0aW9uKTtcbn07XG5cbi8vIFByb3h5IHRoZSBwdWJsaWMgbWV0aG9kcyBvZiBNZXRlb3Iuc2VydmVyIHNvIHRoZXkgY2FuXG4vLyBiZSBjYWxsZWQgZGlyZWN0bHkgb24gTWV0ZW9yLlxuXy5lYWNoKFxuICBbXG4gICAgJ3B1Ymxpc2gnLFxuICAgICdpc0FzeW5jQ2FsbCcsXG4gICAgJ21ldGhvZHMnLFxuICAgICdjYWxsJyxcbiAgICAnY2FsbEFzeW5jJyxcbiAgICAnYXBwbHknLFxuICAgICdhcHBseUFzeW5jJyxcbiAgICAnb25Db25uZWN0aW9uJyxcbiAgICAnb25NZXNzYWdlJyxcbiAgXSxcbiAgZnVuY3Rpb24obmFtZSkge1xuICAgIE1ldGVvcltuYW1lXSA9IF8uYmluZChNZXRlb3Iuc2VydmVyW25hbWVdLCBNZXRlb3Iuc2VydmVyKTtcbiAgfVxuKTtcbiJdfQ==
