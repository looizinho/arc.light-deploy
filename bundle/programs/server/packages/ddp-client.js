Package["core-runtime"].queue("ddp-client", ["meteor", "check", "random", "ejson", "tracker", "retry", "id-map", "ecmascript", "callback-hook", "ddp-common", "reload", "socket-stream-client", "diff-sequence", "mongo-id", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Retry = Package.retry.Retry;
var IdMap = Package['id-map'].IdMap;
var ECMAScript = Package.ecmascript.ECMAScript;
var Hook = Package['callback-hook'].Hook;
var DDPCommon = Package['ddp-common'].DDPCommon;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var options, callback, args, DDP;

var require = meteorInstall({"node_modules":{"meteor":{"ddp-client":{"server":{"server.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/server/server.js                                                                               //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("../common/namespace.js", {
      DDP: "DDP"
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"common":{"MethodInvoker.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/MethodInvoker.js                                                                        //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
  default: () => MethodInvoker
});
class MethodInvoker {
  constructor(options) {
    // Public (within this file) fields.
    this.methodId = options.methodId;
    this.sentMessage = false;
    this._callback = options.callback;
    this._connection = options.connection;
    this._message = options.message;
    this._onResultReceived = options.onResultReceived || (() => {});
    this._wait = options.wait;
    this.noRetry = options.noRetry;
    this._methodResult = null;
    this._dataVisible = false;

    // Register with the connection.
    this._connection._methodInvokers[this.methodId] = this;
  }
  // Sends the method message to the server. May be called additional times if
  // we lose the connection and reconnect before receiving a result.
  sendMessage() {
    // This function is called before sending a method (including resending on
    // reconnect). We should only (re)send methods where we don't already have a
    // result!
    if (this.gotResult()) throw new Error('sendingMethod is called on method with result');

    // If we're re-sending it, it doesn't matter if data was written the first
    // time.
    this._dataVisible = false;
    this.sentMessage = true;

    // If this is a wait method, make all data messages be buffered until it is
    // done.
    if (this._wait) this._connection._methodsBlockingQuiescence[this.methodId] = true;

    // Actually send the message.
    this._connection._send(this._message);
  }
  // Invoke the callback, if we have both a result and know that all data has
  // been written to the local cache.
  _maybeInvokeCallback() {
    if (this._methodResult && this._dataVisible) {
      // Call the callback. (This won't throw: the callback was wrapped with
      // bindEnvironment.)
      this._callback(this._methodResult[0], this._methodResult[1]);

      // Forget about this method.
      delete this._connection._methodInvokers[this.methodId];

      // Let the connection know that this method is finished, so it can try to
      // move on to the next block of methods.
      this._connection._outstandingMethodFinished();
    }
  }
  // Call with the result of the method from the server. Only may be called
  // once; once it is called, you should not call sendMessage again.
  // If the user provided an onResultReceived callback, call it immediately.
  // Then invoke the main callback if data is also visible.
  receiveResult(err, result) {
    if (this.gotResult()) throw new Error('Methods should only receive results once');
    this._methodResult = [err, result];
    this._onResultReceived(err, result);
    this._maybeInvokeCallback();
  }
  // Call this when all data written by the method is visible. This means that
  // the method has returns its "data is done" message *AND* all server
  // documents that are buffered at that time have been written to the local
  // cache. Invokes the main callback if the result has been received.
  dataVisible() {
    this._dataVisible = true;
    this._maybeInvokeCallback();
  }
  // True if receiveResult has been called.
  gotResult() {
    return !!this._methodResult;
  }
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"livedata_connection.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/livedata_connection.js                                                                  //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectWithoutProperties;
    module.link("@babel/runtime/helpers/objectWithoutProperties", {
      default(v) {
        _objectWithoutProperties = v;
      }
    }, 0);
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 1);
    const _excluded = ["stubInvocation", "invocation"],
      _excluded2 = ["stubInvocation", "invocation"];
    module.export({
      Connection: () => Connection
    });
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 1);
    let Tracker;
    module.link("meteor/tracker", {
      Tracker(v) {
        Tracker = v;
      }
    }, 2);
    let EJSON;
    module.link("meteor/ejson", {
      EJSON(v) {
        EJSON = v;
      }
    }, 3);
    let Random;
    module.link("meteor/random", {
      Random(v) {
        Random = v;
      }
    }, 4);
    let Hook;
    module.link("meteor/callback-hook", {
      Hook(v) {
        Hook = v;
      }
    }, 5);
    let MongoID;
    module.link("meteor/mongo-id", {
      MongoID(v) {
        MongoID = v;
      }
    }, 6);
    let DDP;
    module.link("./namespace.js", {
      DDP(v) {
        DDP = v;
      }
    }, 7);
    let MethodInvoker;
    module.link("./MethodInvoker.js", {
      default(v) {
        MethodInvoker = v;
      }
    }, 8);
    let hasOwn, slice, keys, isEmpty, last;
    module.link("meteor/ddp-common/utils.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      slice(v) {
        slice = v;
      },
      keys(v) {
        keys = v;
      },
      isEmpty(v) {
        isEmpty = v;
      },
      last(v) {
        last = v;
      }
    }, 9);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class MongoIDMap extends IdMap {
      constructor() {
        super(MongoID.idStringify, MongoID.idParse);
      }
    }

    // @param url {String|Object} URL to Meteor app,
    //   or an object as a test hook (see code)
    // Options:
    //   reloadWithOutstanding: is it OK to reload if there are outstanding methods?
    //   headers: extra headers to send on the websockets connection, for
    //     server-to-server DDP only
    //   _sockjsOptions: Specifies options to pass through to the sockjs client
    //   onDDPNegotiationVersionFailure: callback when version negotiation fails.
    //
    // XXX There should be a way to destroy a DDP connection, causing all
    // outstanding method calls to fail.
    //
    // XXX Our current way of handling failure and reconnection is great
    // for an app (where we want to tolerate being disconnected as an
    // expect state, and keep trying forever to reconnect) but cumbersome
    // for something like a command line tool that wants to make a
    // connection, call a method, and print an error if connection
    // fails. We should have better usability in the latter case (while
    // still transparently reconnecting if it's just a transient failure
    // or the server migrating us).
    class Connection {
      constructor(url, options) {
        const self = this;
        this.options = options = _objectSpread({
          onConnected() {},
          onDDPVersionNegotiationFailure(description) {
            Meteor._debug(description);
          },
          heartbeatInterval: 17500,
          heartbeatTimeout: 15000,
          npmFayeOptions: Object.create(null),
          // These options are only for testing.
          reloadWithOutstanding: false,
          supportedDDPVersions: DDPCommon.SUPPORTED_DDP_VERSIONS,
          retry: true,
          respondToPings: true,
          // When updates are coming within this ms interval, batch them together.
          bufferedWritesInterval: 5,
          // Flush buffers immediately if writes are happening continuously for more than this many ms.
          bufferedWritesMaxAge: 500
        }, options);

        // If set, called when we reconnect, queuing method calls _before_ the
        // existing outstanding ones.
        // NOTE: This feature has been preserved for backwards compatibility. The
        // preferred method of setting a callback on reconnect is to use
        // DDP.onReconnect.
        self.onReconnect = null;

        // as a test hook, allow passing a stream instead of a url.
        if (typeof url === 'object') {
          self._stream = url;
        } else {
          const {
            ClientStream
          } = require("meteor/socket-stream-client");
          self._stream = new ClientStream(url, {
            retry: options.retry,
            ConnectionError: DDP.ConnectionError,
            headers: options.headers,
            _sockjsOptions: options._sockjsOptions,
            // Used to keep some tests quiet, or for other cases in which
            // the right thing to do with connection errors is to silently
            // fail (e.g. sending package usage stats). At some point we
            // should have a real API for handling client-stream-level
            // errors.
            _dontPrintErrors: options._dontPrintErrors,
            connectTimeoutMs: options.connectTimeoutMs,
            npmFayeOptions: options.npmFayeOptions
          });
        }
        self._lastSessionId = null;
        self._versionSuggestion = null; // The last proposed DDP version.
        self._version = null; // The DDP version agreed on by client and server.
        self._stores = Object.create(null); // name -> object with methods
        self._methodHandlers = Object.create(null); // name -> func
        self._nextMethodId = 1;
        self._supportedDDPVersions = options.supportedDDPVersions;
        self._heartbeatInterval = options.heartbeatInterval;
        self._heartbeatTimeout = options.heartbeatTimeout;

        // Tracks methods which the user has tried to call but which have not yet
        // called their user callback (ie, they are waiting on their result or for all
        // of their writes to be written to the local cache). Map from method ID to
        // MethodInvoker object.
        self._methodInvokers = Object.create(null);

        // Tracks methods which the user has called but whose result messages have not
        // arrived yet.
        //
        // _outstandingMethodBlocks is an array of blocks of methods. Each block
        // represents a set of methods that can run at the same time. The first block
        // represents the methods which are currently in flight; subsequent blocks
        // must wait for previous blocks to be fully finished before they can be sent
        // to the server.
        //
        // Each block is an object with the following fields:
        // - methods: a list of MethodInvoker objects
        // - wait: a boolean; if true, this block had a single method invoked with
        //         the "wait" option
        //
        // There will never be adjacent blocks with wait=false, because the only thing
        // that makes methods need to be serialized is a wait method.
        //
        // Methods are removed from the first block when their "result" is
        // received. The entire first block is only removed when all of the in-flight
        // methods have received their results (so the "methods" list is empty) *AND*
        // all of the data written by those methods are visible in the local cache. So
        // it is possible for the first block's methods list to be empty, if we are
        // still waiting for some objects to quiesce.
        //
        // Example:
        //  _outstandingMethodBlocks = [
        //    {wait: false, methods: []},
        //    {wait: true, methods: [<MethodInvoker for 'login'>]},
        //    {wait: false, methods: [<MethodInvoker for 'foo'>,
        //                            <MethodInvoker for 'bar'>]}]
        // This means that there were some methods which were sent to the server and
        // which have returned their results, but some of the data written by
        // the methods may not be visible in the local cache. Once all that data is
        // visible, we will send a 'login' method. Once the login method has returned
        // and all the data is visible (including re-running subs if userId changes),
        // we will send the 'foo' and 'bar' methods in parallel.
        self._outstandingMethodBlocks = [];

        // method ID -> array of objects with keys 'collection' and 'id', listing
        // documents written by a given method's stub. keys are associated with
        // methods whose stub wrote at least one document, and whose data-done message
        // has not yet been received.
        self._documentsWrittenByStub = {};
        // collection -> IdMap of "server document" object. A "server document" has:
        // - "document": the version of the document according the
        //   server (ie, the snapshot before a stub wrote it, amended by any changes
        //   received from the server)
        //   It is undefined if we think the document does not exist
        // - "writtenByStubs": a set of method IDs whose stubs wrote to the document
        //   whose "data done" messages have not yet been processed
        self._serverDocuments = {};

        // Array of callbacks to be called after the next update of the local
        // cache. Used for:
        //  - Calling methodInvoker.dataVisible and sub ready callbacks after
        //    the relevant data is flushed.
        //  - Invoking the callbacks of "half-finished" methods after reconnect
        //    quiescence. Specifically, methods whose result was received over the old
        //    connection (so we don't re-send it) but whose data had not been made
        //    visible.
        self._afterUpdateCallbacks = [];

        // In two contexts, we buffer all incoming data messages and then process them
        // all at once in a single update:
        //   - During reconnect, we buffer all data messages until all subs that had
        //     been ready before reconnect are ready again, and all methods that are
        //     active have returned their "data done message"; then
        //   - During the execution of a "wait" method, we buffer all data messages
        //     until the wait method gets its "data done" message. (If the wait method
        //     occurs during reconnect, it doesn't get any special handling.)
        // all data messages are processed in one update.
        //
        // The following fields are used for this "quiescence" process.

        // This buffers the messages that aren't being processed yet.
        self._messagesBufferedUntilQuiescence = [];
        // Map from method ID -> true. Methods are removed from this when their
        // "data done" message is received, and we will not quiesce until it is
        // empty.
        self._methodsBlockingQuiescence = {};
        // map from sub ID -> true for subs that were ready (ie, called the sub
        // ready callback) before reconnect but haven't become ready again yet
        self._subsBeingRevived = {}; // map from sub._id -> true
        // if true, the next data update should reset all stores. (set during
        // reconnect.)
        self._resetStores = false;

        // name -> array of updates for (yet to be created) collections
        self._updatesForUnknownStores = {};
        // if we're blocking a migration, the retry func
        self._retryMigrate = null;
        self.__flushBufferedWrites = Meteor.bindEnvironment(self._flushBufferedWrites, 'flushing DDP buffered writes', self);
        // Collection name -> array of messages.
        self._bufferedWrites = {};
        // When current buffer of updates must be flushed at, in ms timestamp.
        self._bufferedWritesFlushAt = null;
        // Timeout handle for the next processing of all pending writes
        self._bufferedWritesFlushHandle = null;
        self._bufferedWritesInterval = options.bufferedWritesInterval;
        self._bufferedWritesMaxAge = options.bufferedWritesMaxAge;

        // metadata for subscriptions.  Map from sub ID to object with keys:
        //   - id
        //   - name
        //   - params
        //   - inactive (if true, will be cleaned up if not reused in re-run)
        //   - ready (has the 'ready' message been received?)
        //   - readyCallback (an optional callback to call when ready)
        //   - errorCallback (an optional callback to call if the sub terminates with
        //                    an error, XXX COMPAT WITH 1.0.3.1)
        //   - stopCallback (an optional callback to call when the sub terminates
        //     for any reason, with an error argument if an error triggered the stop)
        self._subscriptions = {};

        // Reactive userId.
        self._userId = null;
        self._userIdDeps = new Tracker.Dependency();

        // Block auto-reload while we're waiting for method responses.
        if (Meteor.isClient && Package.reload && !options.reloadWithOutstanding) {
          Package.reload.Reload._onMigrate(retry => {
            if (!self._readyToMigrate()) {
              self._retryMigrate = retry;
              return [false];
            } else {
              return [true];
            }
          });
        }
        const onDisconnect = () => {
          if (self._heartbeat) {
            self._heartbeat.stop();
            self._heartbeat = null;
          }
        };
        if (Meteor.isServer) {
          self._stream.on('message', Meteor.bindEnvironment(this.onMessage.bind(this), 'handling DDP message'));
          self._stream.on('reset', Meteor.bindEnvironment(this.onReset.bind(this), 'handling DDP reset'));
          self._stream.on('disconnect', Meteor.bindEnvironment(onDisconnect, 'handling DDP disconnect'));
        } else {
          self._stream.on('message', this.onMessage.bind(this));
          self._stream.on('reset', this.onReset.bind(this));
          self._stream.on('disconnect', onDisconnect);
        }
      }

      // 'name' is the name of the data on the wire that should go in the
      // store. 'wrappedStore' should be an object with methods beginUpdate, update,
      // endUpdate, saveOriginals, retrieveOriginals. see Collection for an example.
      createStoreMethods(name, wrappedStore) {
        const self = this;
        if (name in self._stores) return false;

        // Wrap the input object in an object which makes any store method not
        // implemented by 'store' into a no-op.
        const store = Object.create(null);
        const keysOfStore = ['update', 'beginUpdate', 'endUpdate', 'saveOriginals', 'retrieveOriginals', 'getDoc', '_getCollection'];
        keysOfStore.forEach(method => {
          store[method] = function () {
            if (wrappedStore[method]) {
              return wrappedStore[method](...arguments);
            }
          };
        });
        self._stores[name] = store;
        return store;
      }
      registerStoreClient(name, wrappedStore) {
        const self = this;
        const store = self.createStoreMethods(name, wrappedStore);
        const queued = self._updatesForUnknownStores[name];
        if (Array.isArray(queued)) {
          store.beginUpdate(queued.length, false);
          queued.forEach(msg => {
            store.update(msg);
          });
          store.endUpdate();
          delete self._updatesForUnknownStores[name];
        }
        return true;
      }
      async registerStoreServer(name, wrappedStore) {
        const self = this;
        const store = self.createStoreMethods(name, wrappedStore);
        const queued = self._updatesForUnknownStores[name];
        if (Array.isArray(queued)) {
          await store.beginUpdate(queued.length, false);
          for (const msg of queued) {
            await store.update(msg);
          }
          await store.endUpdate();
          delete self._updatesForUnknownStores[name];
        }
        return true;
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.subscribe
       * @summary Subscribe to a record set.  Returns a handle that provides
       * `stop()` and `ready()` methods.
       * @locus Client
       * @param {String} name Name of the subscription.  Matches the name of the
       * server's `publish()` call.
       * @param {EJSONable} [arg1,arg2...] Optional arguments passed to publisher
       * function on server.
       * @param {Function|Object} [callbacks] Optional. May include `onStop`
       * and `onReady` callbacks. If there is an error, it is passed as an
       * argument to `onStop`. If a function is passed instead of an object, it
       * is interpreted as an `onReady` callback.
       */
      subscribe(name /* .. [arguments] .. (callback|callbacks) */) {
        const self = this;
        const params = slice.call(arguments, 1);
        let callbacks = Object.create(null);
        if (params.length) {
          const lastParam = params[params.length - 1];
          if (typeof lastParam === 'function') {
            callbacks.onReady = params.pop();
          } else if (lastParam && [lastParam.onReady,
          // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
          // onStop with an error callback instead.
          lastParam.onError, lastParam.onStop].some(f => typeof f === "function")) {
            callbacks = params.pop();
          }
        }

        // Is there an existing sub with the same name and param, run in an
        // invalidated Computation? This will happen if we are rerunning an
        // existing computation.
        //
        // For example, consider a rerun of:
        //
        //     Tracker.autorun(function () {
        //       Meteor.subscribe("foo", Session.get("foo"));
        //       Meteor.subscribe("bar", Session.get("bar"));
        //     });
        //
        // If "foo" has changed but "bar" has not, we will match the "bar"
        // subcribe to an existing inactive subscription in order to not
        // unsub and resub the subscription unnecessarily.
        //
        // We only look for one such sub; if there are N apparently-identical subs
        // being invalidated, we will require N matching subscribe calls to keep
        // them all active.
        const existing = Object.values(self._subscriptions).find(sub => sub.inactive && sub.name === name && EJSON.equals(sub.params, params));
        let id;
        if (existing) {
          id = existing.id;
          existing.inactive = false; // reactivate

          if (callbacks.onReady) {
            // If the sub is not already ready, replace any ready callback with the
            // one provided now. (It's not really clear what users would expect for
            // an onReady callback inside an autorun; the semantics we provide is
            // that at the time the sub first becomes ready, we call the last
            // onReady callback provided, if any.)
            // If the sub is already ready, run the ready callback right away.
            // It seems that users would expect an onReady callback inside an
            // autorun to trigger once the the sub first becomes ready and also
            // when re-subs happens.
            if (existing.ready) {
              callbacks.onReady();
            } else {
              existing.readyCallback = callbacks.onReady;
            }
          }

          // XXX COMPAT WITH 1.0.3.1 we used to have onError but now we call
          // onStop with an optional error argument
          if (callbacks.onError) {
            // Replace existing callback if any, so that errors aren't
            // double-reported.
            existing.errorCallback = callbacks.onError;
          }
          if (callbacks.onStop) {
            existing.stopCallback = callbacks.onStop;
          }
        } else {
          // New sub! Generate an id, save it locally, and send message.
          id = Random.id();
          self._subscriptions[id] = {
            id: id,
            name: name,
            params: EJSON.clone(params),
            inactive: false,
            ready: false,
            readyDeps: new Tracker.Dependency(),
            readyCallback: callbacks.onReady,
            // XXX COMPAT WITH 1.0.3.1 #errorCallback
            errorCallback: callbacks.onError,
            stopCallback: callbacks.onStop,
            connection: self,
            remove() {
              delete this.connection._subscriptions[this.id];
              this.ready && this.readyDeps.changed();
            },
            stop() {
              this.connection._send({
                msg: 'unsub',
                id: id
              });
              this.remove();
              if (callbacks.onStop) {
                callbacks.onStop();
              }
            }
          };
          self._send({
            msg: 'sub',
            id: id,
            name: name,
            params: params
          });
        }

        // return a handle to the application.
        const handle = {
          stop() {
            if (!hasOwn.call(self._subscriptions, id)) {
              return;
            }
            self._subscriptions[id].stop();
          },
          ready() {
            // return false if we've unsubscribed.
            if (!hasOwn.call(self._subscriptions, id)) {
              return false;
            }
            const record = self._subscriptions[id];
            record.readyDeps.depend();
            return record.ready;
          },
          subscriptionId: id
        };
        if (Tracker.active) {
          // We're in a reactive computation, so we'd like to unsubscribe when the
          // computation is invalidated... but not if the rerun just re-subscribes
          // to the same subscription!  When a rerun happens, we use onInvalidate
          // as a change to mark the subscription "inactive" so that it can
          // be reused from the rerun.  If it isn't reused, it's killed from
          // an afterFlush.
          Tracker.onInvalidate(c => {
            if (hasOwn.call(self._subscriptions, id)) {
              self._subscriptions[id].inactive = true;
            }
            Tracker.afterFlush(() => {
              if (hasOwn.call(self._subscriptions, id) && self._subscriptions[id].inactive) {
                handle.stop();
              }
            });
          });
        }
        return handle;
      }

      /**
       * @summary Tells if the method call came from a call or a callAsync.
       * @alias Meteor.isAsyncCall
       * @locus Anywhere
       * @memberOf Meteor
       * @importFromPackage meteor
       * @returns boolean
       */
      isAsyncCall() {
        return DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      }
      methods(methods) {
        Object.entries(methods).forEach(_ref => {
          let [name, func] = _ref;
          if (typeof func !== 'function') {
            throw new Error("Method '" + name + "' must be a function");
          }
          if (this._methodHandlers[name]) {
            throw new Error("A method named '" + name + "' is already defined");
          }
          this._methodHandlers[name] = func;
        });
      }
      _getIsSimulation(_ref2) {
        let {
          isFromCallAsync,
          alreadyInSimulation
        } = _ref2;
        if (!isFromCallAsync) {
          return alreadyInSimulation;
        }
        return alreadyInSimulation && DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.call
       * @summary Invokes a method with a sync stub, passing any number of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable} [arg1,arg2...] Optional method arguments
       * @param {Function} [asyncCallback] Optional callback, which is called asynchronously with the error or result after the method is complete. If not provided, the method runs synchronously if possible (see below).
       */
      call(name /* .. [arguments] .. callback */) {
        // if it's a function, the last argument is the result callback,
        // not a parameter to the remote method.
        const args = slice.call(arguments, 1);
        let callback;
        if (args.length && typeof args[args.length - 1] === 'function') {
          callback = args.pop();
        }
        return this.apply(name, args, callback);
      }
      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.callAsync
       * @summary Invokes a method with an async stub, passing any number of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable} [arg1,arg2...] Optional method arguments
       * @returns {Promise}
       */
      callAsync(name /* .. [arguments] .. */) {
        const args = slice.call(arguments, 1);
        if (args.length && typeof args[args.length - 1] === 'function') {
          throw new Error("Meteor.callAsync() does not accept a callback. You should 'await' the result, or use .then().");
        }
        return this.applyAsync(name, args, {
          returnServerResultPromise: true
        });
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.apply
       * @summary Invoke a method passing an array of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable[]} args Method arguments
       * @param {Object} [options]
       * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
       * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
       * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
       * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
       * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
       * @param {Function} [asyncCallback] Optional callback; same semantics as in [`Meteor.call`](#meteor_call).
       */
      apply(name, args, options, callback) {
        const _this$_stubCall = this._stubCall(name, EJSON.clone(args)),
          {
            stubInvocation,
            invocation
          } = _this$_stubCall,
          stubOptions = _objectWithoutProperties(_this$_stubCall, _excluded);
        if (stubOptions.hasStub) {
          if (!this._getIsSimulation({
            alreadyInSimulation: stubOptions.alreadyInSimulation,
            isFromCallAsync: stubOptions.isFromCallAsync
          })) {
            this._saveOriginals();
          }
          try {
            stubOptions.stubReturnValue = DDP._CurrentMethodInvocation.withValue(invocation, stubInvocation);
          } catch (e) {
            stubOptions.exception = e;
          }
        }
        return this._apply(name, stubOptions, args, options, callback);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.applyAsync
       * @summary Invoke a method passing an array of arguments.
       * @locus Anywhere
       * @param {String} name Name of method to invoke
       * @param {EJSONable[]} args Method arguments
       * @param {Object} [options]
       * @param {Boolean} options.wait (Client only) If true, don't send this method until all previous method calls have completed, and don't send any subsequent method calls until this one is completed.
       * @param {Function} options.onResultReceived (Client only) This callback is invoked with the error or result of the method (just like `asyncCallback`) as soon as the error or result is available. The local cache may not yet reflect the writes performed by the method.
       * @param {Boolean} options.noRetry (Client only) if true, don't send this method again on reload, simply call the callback an error with the error code 'invocation-failed'.
       * @param {Boolean} options.throwStubExceptions (Client only) If true, exceptions thrown by method stubs will be thrown instead of logged, and the method will not be invoked on the server.
       * @param {Boolean} options.returnStubValue (Client only) If true then in cases where we would have otherwise discarded the stub's return value and returned undefined, instead we go ahead and return it. Specifically, this is any time other than when (a) we are already inside a stub or (b) we are in Node and no callback was provided. Currently we require this flag to be explicitly passed to reduce the likelihood that stub return values will be confused with server return values; we may improve this in future.
       */
      applyAsync(name, args, options) {
        let callback = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
        const stubPromise = this._applyAsyncStubInvocation(name, args, options);
        const promise = this._applyAsync({
          name,
          args,
          options,
          callback,
          stubPromise
        });
        if (Meteor.isClient) {
          // only return the stubReturnValue
          promise.stubPromise = stubPromise.then(o => o.stubReturnValue);
          // this avoids attribute recursion
          promise.serverPromise = new Promise((resolve, reject) => promise.then(resolve).catch(reject));
        }
        return promise;
      }
      async _applyAsyncStubInvocation(name, args, options) {
        const _this$_stubCall2 = this._stubCall(name, EJSON.clone(args), options),
          {
            stubInvocation,
            invocation
          } = _this$_stubCall2,
          stubOptions = _objectWithoutProperties(_this$_stubCall2, _excluded2);
        if (stubOptions.hasStub) {
          if (!this._getIsSimulation({
            alreadyInSimulation: stubOptions.alreadyInSimulation,
            isFromCallAsync: stubOptions.isFromCallAsync
          })) {
            this._saveOriginals();
          }
          try {
            /*
             * The code below follows the same logic as the function withValues().
             *
             * But as the Meteor package is not compiled by ecmascript, it is unable to use newer syntax in the browser,
             * such as, the async/await.
             *
             * So, to keep supporting old browsers, like IE 11, we're creating the logic one level above.
             */
            const currentContext = DDP._CurrentMethodInvocation._setNewContextAndGetCurrent(invocation);
            try {
              stubOptions.stubReturnValue = await stubInvocation();
            } catch (e) {
              stubOptions.exception = e;
            } finally {
              DDP._CurrentMethodInvocation._set(currentContext);
            }
          } catch (e) {
            stubOptions.exception = e;
          }
        }
        return stubOptions;
      }
      async _applyAsync(_ref3) {
        let {
          name,
          args,
          options,
          callback,
          stubPromise
        } = _ref3;
        const stubOptions = await stubPromise;
        return this._apply(name, stubOptions, args, options, callback);
      }
      _apply(name, stubCallValue, args, options, callback) {
        const self = this;
        // We were passed 3 arguments. They may be either (name, args, options)
        // or (name, args, callback)
        if (!callback && typeof options === 'function') {
          callback = options;
          options = Object.create(null);
        }
        options = options || Object.create(null);
        if (callback) {
          // XXX would it be better form to do the binding in stream.on,
          // or caller, instead of here?
          // XXX improve error message (and how we report it)
          callback = Meteor.bindEnvironment(callback, "delivering result of invoking '" + name + "'");
        }
        const {
          hasStub,
          exception,
          stubReturnValue,
          alreadyInSimulation,
          randomSeed
        } = stubCallValue;

        // Keep our args safe from mutation (eg if we don't send the message for a
        // while because of a wait method).
        args = EJSON.clone(args);
        // If we're in a simulation, stop and return the result we have,
        // rather than going on to do an RPC. If there was no stub,
        // we'll end up returning undefined.
        if (this._getIsSimulation({
          alreadyInSimulation,
          isFromCallAsync: stubCallValue.isFromCallAsync
        })) {
          if (callback) {
            callback(exception, stubReturnValue);
            return undefined;
          }
          if (exception) throw exception;
          return stubReturnValue;
        }

        // We only create the methodId here because we don't actually need one if
        // we're already in a simulation
        const methodId = '' + self._nextMethodId++;
        if (hasStub) {
          self._retrieveAndStoreOriginals(methodId);
        }

        // Generate the DDP message for the method call. Note that on the client,
        // it is important that the stub have finished before we send the RPC, so
        // that we know we have a complete list of which local documents the stub
        // wrote.
        const message = {
          msg: 'method',
          id: methodId,
          method: name,
          params: args
        };

        // If an exception occurred in a stub, and we're ignoring it
        // because we're doing an RPC and want to use what the server
        // returns instead, log it so the developer knows
        // (unless they explicitly ask to see the error).
        //
        // Tests can set the '_expectedByTest' flag on an exception so it won't
        // go to log.
        if (exception) {
          if (options.throwStubExceptions) {
            throw exception;
          } else if (!exception._expectedByTest) {
            Meteor._debug("Exception while simulating the effect of invoking '" + name + "'", exception);
          }
        }

        // At this point we're definitely doing an RPC, and we're going to
        // return the value of the RPC to the caller.

        // If the caller didn't give a callback, decide what to do.
        let future;
        if (!callback) {
          if (Meteor.isClient && !options.returnServerResultPromise && (!options.isFromCallAsync || options.returnStubValue)) {
            // On the client, we don't have fibers, so we can't block. The
            // only thing we can do is to return undefined and discard the
            // result of the RPC. If an error occurred then print the error
            // to the console.
            callback = err => {
              err && Meteor._debug("Error invoking Method '" + name + "'", err);
            };
          } else {
            // On the server, make the function synchronous. Throw on
            // errors, return on success.
            future = new Promise((resolve, reject) => {
              callback = function () {
                for (var _len = arguments.length, allArgs = new Array(_len), _key = 0; _key < _len; _key++) {
                  allArgs[_key] = arguments[_key];
                }
                let args = Array.from(allArgs);
                let err = args.shift();
                if (err) {
                  reject(err);
                  return;
                }
                resolve(...args);
              };
            });
          }
        }

        // Send the randomSeed only if we used it
        if (randomSeed.value !== null) {
          message.randomSeed = randomSeed.value;
        }
        const methodInvoker = new MethodInvoker({
          methodId,
          callback: callback,
          connection: self,
          onResultReceived: options.onResultReceived,
          wait: !!options.wait,
          message: message,
          noRetry: !!options.noRetry
        });
        if (options.wait) {
          // It's a wait method! Wait methods go in their own block.
          self._outstandingMethodBlocks.push({
            wait: true,
            methods: [methodInvoker]
          });
        } else {
          // Not a wait method. Start a new block if the previous block was a wait
          // block, and add it to the last block of methods.
          if (isEmpty(self._outstandingMethodBlocks) || last(self._outstandingMethodBlocks).wait) {
            self._outstandingMethodBlocks.push({
              wait: false,
              methods: []
            });
          }
          last(self._outstandingMethodBlocks).methods.push(methodInvoker);
        }

        // If we added it to the first block, send it out now.
        if (self._outstandingMethodBlocks.length === 1) methodInvoker.sendMessage();

        // If we're using the default callback on the server,
        // block waiting for the result.
        if (future) {
          // This is the result of the method ran in the client.
          // You can opt-in in getting the local result by running:
          // const { stubPromise, serverPromise } = Meteor.callAsync(...);
          // const whatServerDid = await serverPromise;
          if (options.returnStubValue) {
            return future.then(() => stubReturnValue);
          }
          return future;
        }
        return options.returnStubValue ? stubReturnValue : undefined;
      }
      _stubCall(name, args, options) {
        // Run the stub, if we have one. The stub is supposed to make some
        // temporary writes to the database to give the user a smooth experience
        // until the actual result of executing the method comes back from the
        // server (whereupon the temporary writes to the database will be reversed
        // during the beginUpdate/endUpdate process.)
        //
        // Normally, we ignore the return value of the stub (even if it is an
        // exception), in favor of the real return value from the server. The
        // exception is if the *caller* is a stub. In that case, we're not going
        // to do a RPC, so we use the return value of the stub as our return
        // value.
        const self = this;
        const enclosing = DDP._CurrentMethodInvocation.get();
        const stub = self._methodHandlers[name];
        const alreadyInSimulation = enclosing === null || enclosing === void 0 ? void 0 : enclosing.isSimulation;
        const isFromCallAsync = enclosing === null || enclosing === void 0 ? void 0 : enclosing._isFromCallAsync;
        const randomSeed = {
          value: null
        };
        const defaultReturn = {
          alreadyInSimulation,
          randomSeed,
          isFromCallAsync
        };
        if (!stub) {
          return _objectSpread(_objectSpread({}, defaultReturn), {}, {
            hasStub: false
          });
        }

        // Lazily generate a randomSeed, only if it is requested by the stub.
        // The random streams only have utility if they're used on both the client
        // and the server; if the client doesn't generate any 'random' values
        // then we don't expect the server to generate any either.
        // Less commonly, the server may perform different actions from the client,
        // and may in fact generate values where the client did not, but we don't
        // have any client-side values to match, so even here we may as well just
        // use a random seed on the server.  In that case, we don't pass the
        // randomSeed to save bandwidth, and we don't even generate it to save a
        // bit of CPU and to avoid consuming entropy.

        const randomSeedGenerator = () => {
          if (randomSeed.value === null) {
            randomSeed.value = DDPCommon.makeRpcSeed(enclosing, name);
          }
          return randomSeed.value;
        };
        const setUserId = userId => {
          self.setUserId(userId);
        };
        const invocation = new DDPCommon.MethodInvocation({
          isSimulation: true,
          userId: self.userId(),
          isFromCallAsync: options === null || options === void 0 ? void 0 : options.isFromCallAsync,
          setUserId: setUserId,
          randomSeed() {
            return randomSeedGenerator();
          }
        });

        // Note that unlike in the corresponding server code, we never audit
        // that stubs check() their arguments.
        const stubInvocation = () => {
          if (Meteor.isServer) {
            // Because saveOriginals and retrieveOriginals aren't reentrant,
            // don't allow stubs to yield.
            return Meteor._noYieldsAllowed(() => {
              // re-clone, so that the stub can't affect our caller's values
              return stub.apply(invocation, EJSON.clone(args));
            });
          } else {
            return stub.apply(invocation, EJSON.clone(args));
          }
        };
        return _objectSpread(_objectSpread({}, defaultReturn), {}, {
          hasStub: true,
          stubInvocation,
          invocation
        });
      }

      // Before calling a method stub, prepare all stores to track changes and allow
      // _retrieveAndStoreOriginals to get the original versions of changed
      // documents.
      _saveOriginals() {
        if (!this._waitingForQuiescence()) {
          this._flushBufferedWritesClient();
        }
        Object.values(this._stores).forEach(store => {
          store.saveOriginals();
        });
      }

      // Retrieves the original versions of all documents modified by the stub for
      // method 'methodId' from all stores and saves them to _serverDocuments (keyed
      // by document) and _documentsWrittenByStub (keyed by method ID).
      _retrieveAndStoreOriginals(methodId) {
        const self = this;
        if (self._documentsWrittenByStub[methodId]) throw new Error('Duplicate methodId in _retrieveAndStoreOriginals');
        const docsWritten = [];
        Object.entries(self._stores).forEach(_ref4 => {
          let [collection, store] = _ref4;
          const originals = store.retrieveOriginals();
          // not all stores define retrieveOriginals
          if (!originals) return;
          originals.forEach((doc, id) => {
            docsWritten.push({
              collection,
              id
            });
            if (!hasOwn.call(self._serverDocuments, collection)) {
              self._serverDocuments[collection] = new MongoIDMap();
            }
            const serverDoc = self._serverDocuments[collection].setDefault(id, Object.create(null));
            if (serverDoc.writtenByStubs) {
              // We're not the first stub to write this doc. Just add our method ID
              // to the record.
              serverDoc.writtenByStubs[methodId] = true;
            } else {
              // First stub! Save the original value and our method ID.
              serverDoc.document = doc;
              serverDoc.flushCallbacks = [];
              serverDoc.writtenByStubs = Object.create(null);
              serverDoc.writtenByStubs[methodId] = true;
            }
          });
        });
        if (!isEmpty(docsWritten)) {
          self._documentsWrittenByStub[methodId] = docsWritten;
        }
      }

      // This is very much a private function we use to make the tests
      // take up fewer server resources after they complete.
      _unsubscribeAll() {
        Object.values(this._subscriptions).forEach(sub => {
          // Avoid killing the autoupdate subscription so that developers
          // still get hot code pushes when writing tests.
          //
          // XXX it's a hack to encode knowledge about autoupdate here,
          // but it doesn't seem worth it yet to have a special API for
          // subscriptions to preserve after unit tests.
          if (sub.name !== 'meteor_autoupdate_clientVersions') {
            sub.stop();
          }
        });
      }

      // Sends the DDP stringification of the given message object
      _send(obj) {
        this._stream.send(DDPCommon.stringifyDDP(obj));
      }

      // We detected via DDP-level heartbeats that we've lost the
      // connection.  Unlike `disconnect` or `close`, a lost connection
      // will be automatically retried.
      _lostConnection(error) {
        this._stream._lostConnection(error);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.status
       * @summary Get the current connection status. A reactive data source.
       * @locus Client
       */
      status() {
        return this._stream.status(...arguments);
      }

      /**
       * @summary Force an immediate reconnection attempt if the client is not connected to the server.
       This method does nothing if the client is already connected.
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.reconnect
       * @locus Client
       */
      reconnect() {
        return this._stream.reconnect(...arguments);
      }

      /**
       * @memberOf Meteor
       * @importFromPackage meteor
       * @alias Meteor.disconnect
       * @summary Disconnect the client from the server.
       * @locus Client
       */
      disconnect() {
        return this._stream.disconnect(...arguments);
      }
      close() {
        return this._stream.disconnect({
          _permanent: true
        });
      }

      ///
      /// Reactive user system
      ///
      userId() {
        if (this._userIdDeps) this._userIdDeps.depend();
        return this._userId;
      }
      setUserId(userId) {
        // Avoid invalidating dependents if setUserId is called with current value.
        if (this._userId === userId) return;
        this._userId = userId;
        if (this._userIdDeps) this._userIdDeps.changed();
      }

      // Returns true if we are in a state after reconnect of waiting for subs to be
      // revived or early methods to finish their data, or we are waiting for a
      // "wait" method to finish.
      _waitingForQuiescence() {
        return !isEmpty(this._subsBeingRevived) || !isEmpty(this._methodsBlockingQuiescence);
      }

      // Returns true if any method whose message has been sent to the server has
      // not yet invoked its user callback.
      _anyMethodsAreOutstanding() {
        const invokers = this._methodInvokers;
        return Object.values(invokers).some(invoker => !!invoker.sentMessage);
      }
      async _livedata_connected(msg) {
        const self = this;
        if (self._version !== 'pre1' && self._heartbeatInterval !== 0) {
          self._heartbeat = new DDPCommon.Heartbeat({
            heartbeatInterval: self._heartbeatInterval,
            heartbeatTimeout: self._heartbeatTimeout,
            onTimeout() {
              self._lostConnection(new DDP.ConnectionError('DDP heartbeat timed out'));
            },
            sendPing() {
              self._send({
                msg: 'ping'
              });
            }
          });
          self._heartbeat.start();
        }

        // If this is a reconnect, we'll have to reset all stores.
        if (self._lastSessionId) self._resetStores = true;
        let reconnectedToPreviousSession;
        if (typeof msg.session === 'string') {
          reconnectedToPreviousSession = self._lastSessionId === msg.session;
          self._lastSessionId = msg.session;
        }
        if (reconnectedToPreviousSession) {
          // Successful reconnection -- pick up where we left off.  Note that right
          // now, this never happens: the server never connects us to a previous
          // session, because DDP doesn't provide enough data for the server to know
          // what messages the client has processed. We need to improve DDP to make
          // this possible, at which point we'll probably need more code here.
          return;
        }

        // Server doesn't have our data any more. Re-sync a new session.

        // Forget about messages we were buffering for unknown collections. They'll
        // be resent if still relevant.
        self._updatesForUnknownStores = Object.create(null);
        if (self._resetStores) {
          // Forget about the effects of stubs. We'll be resetting all collections
          // anyway.
          self._documentsWrittenByStub = Object.create(null);
          self._serverDocuments = Object.create(null);
        }

        // Clear _afterUpdateCallbacks.
        self._afterUpdateCallbacks = [];

        // Mark all named subscriptions which are ready (ie, we already called the
        // ready callback) as needing to be revived.
        // XXX We should also block reconnect quiescence until unnamed subscriptions
        //     (eg, autopublish) are done re-publishing to avoid flicker!
        self._subsBeingRevived = Object.create(null);
        Object.entries(self._subscriptions).forEach(_ref5 => {
          let [id, sub] = _ref5;
          if (sub.ready) {
            self._subsBeingRevived[id] = true;
          }
        });

        // Arrange for "half-finished" methods to have their callbacks run, and
        // track methods that were sent on this connection so that we don't
        // quiesce until they are all done.
        //
        // Start by clearing _methodsBlockingQuiescence: methods sent before
        // reconnect don't matter, and any "wait" methods sent on the new connection
        // that we drop here will be restored by the loop below.
        self._methodsBlockingQuiescence = Object.create(null);
        if (self._resetStores) {
          const invokers = self._methodInvokers;
          keys(invokers).forEach(id => {
            const invoker = invokers[id];
            if (invoker.gotResult()) {
              // This method already got its result, but it didn't call its callback
              // because its data didn't become visible. We did not resend the
              // method RPC. We'll call its callback when we get a full quiesce,
              // since that's as close as we'll get to "data must be visible".
              self._afterUpdateCallbacks.push(function () {
                return invoker.dataVisible(...arguments);
              });
            } else if (invoker.sentMessage) {
              // This method has been sent on this connection (maybe as a resend
              // from the last connection, maybe from onReconnect, maybe just very
              // quickly before processing the connected message).
              //
              // We don't need to do anything special to ensure its callbacks get
              // called, but we'll count it as a method which is preventing
              // reconnect quiescence. (eg, it might be a login method that was run
              // from onReconnect, and we don't want to see flicker by seeing a
              // logged-out state.)
              self._methodsBlockingQuiescence[invoker.methodId] = true;
            }
          });
        }
        self._messagesBufferedUntilQuiescence = [];

        // If we're not waiting on any methods or subs, we can reset the stores and
        // call the callbacks immediately.
        if (!self._waitingForQuiescence()) {
          if (self._resetStores) {
            for (const store of Object.values(self._stores)) {
              await store.beginUpdate(0, true);
              await store.endUpdate();
            }
            self._resetStores = false;
          }
          self._runAfterUpdateCallbacks();
        }
      }
      async _processOneDataMessage(msg, updates) {
        const messageType = msg.msg;

        // msg is one of ['added', 'changed', 'removed', 'ready', 'updated']
        if (messageType === 'added') {
          await this._process_added(msg, updates);
        } else if (messageType === 'changed') {
          this._process_changed(msg, updates);
        } else if (messageType === 'removed') {
          this._process_removed(msg, updates);
        } else if (messageType === 'ready') {
          this._process_ready(msg, updates);
        } else if (messageType === 'updated') {
          this._process_updated(msg, updates);
        } else if (messageType === 'nosub') {
          // ignore this
        } else {
          Meteor._debug('discarding unknown livedata data message type', msg);
        }
      }
      async _livedata_data(msg) {
        const self = this;
        if (self._waitingForQuiescence()) {
          self._messagesBufferedUntilQuiescence.push(msg);
          if (msg.msg === 'nosub') {
            delete self._subsBeingRevived[msg.id];
          }
          if (msg.subs) {
            msg.subs.forEach(subId => {
              delete self._subsBeingRevived[subId];
            });
          }
          if (msg.methods) {
            msg.methods.forEach(methodId => {
              delete self._methodsBlockingQuiescence[methodId];
            });
          }
          if (self._waitingForQuiescence()) {
            return;
          }

          // No methods or subs are blocking quiescence!
          // We'll now process and all of our buffered messages, reset all stores,
          // and apply them all at once.

          const bufferedMessages = self._messagesBufferedUntilQuiescence;
          for (const bufferedMessage of Object.values(bufferedMessages)) {
            await self._processOneDataMessage(bufferedMessage, self._bufferedWrites);
          }
          self._messagesBufferedUntilQuiescence = [];
        } else {
          await self._processOneDataMessage(msg, self._bufferedWrites);
        }

        // Immediately flush writes when:
        //  1. Buffering is disabled. Or;
        //  2. any non-(added/changed/removed) message arrives.
        const standardWrite = msg.msg === "added" || msg.msg === "changed" || msg.msg === "removed";
        if (self._bufferedWritesInterval === 0 || !standardWrite) {
          await self._flushBufferedWrites();
          return;
        }
        if (self._bufferedWritesFlushAt === null) {
          self._bufferedWritesFlushAt = new Date().valueOf() + self._bufferedWritesMaxAge;
        } else if (self._bufferedWritesFlushAt < new Date().valueOf()) {
          await self._flushBufferedWrites();
          return;
        }
        if (self._bufferedWritesFlushHandle) {
          clearTimeout(self._bufferedWritesFlushHandle);
        }
        self._bufferedWritesFlushHandle = setTimeout(() => {
          // __flushBufferedWrites is a promise, so with this we can wait the promise to finish
          // before doing something
          self._liveDataWritesPromise = self.__flushBufferedWrites();
          if (Meteor._isPromise(self._liveDataWritesPromise)) {
            self._liveDataWritesPromise.finally(() => self._liveDataWritesPromise = undefined);
          }
        }, self._bufferedWritesInterval);
      }
      _prepareBuffersToFlush() {
        const self = this;
        if (self._bufferedWritesFlushHandle) {
          clearTimeout(self._bufferedWritesFlushHandle);
          self._bufferedWritesFlushHandle = null;
        }
        self._bufferedWritesFlushAt = null;
        // We need to clear the buffer before passing it to
        //  performWrites. As there's no guarantee that it
        //  will exit cleanly.
        const writes = self._bufferedWrites;
        self._bufferedWrites = Object.create(null);
        return writes;
      }
      async _flushBufferedWritesServer() {
        const self = this;
        const writes = self._prepareBuffersToFlush();
        await self._performWritesServer(writes);
      }
      _flushBufferedWritesClient() {
        const self = this;
        const writes = self._prepareBuffersToFlush();
        self._performWritesClient(writes);
      }
      _flushBufferedWrites() {
        const self = this;
        return Meteor.isClient ? self._flushBufferedWritesClient() : self._flushBufferedWritesServer();
      }
      async _performWritesServer(updates) {
        const self = this;
        if (self._resetStores || !isEmpty(updates)) {
          // Begin a transactional update of each store.

          for (const [storeName, store] of Object.entries(self._stores)) {
            await store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
          }
          self._resetStores = false;
          for (const [storeName, updateMessages] of Object.entries(updates)) {
            const store = self._stores[storeName];
            if (store) {
              for (const updateMessage of updateMessages) {
                await store.update(updateMessage);
              }
            } else {
              // Nobody's listening for this data. Queue it up until
              // someone wants it.
              // XXX memory use will grow without bound if you forget to
              // create a collection or just don't care about it... going
              // to have to do something about that.
              const updates = self._updatesForUnknownStores;
              if (!hasOwn.call(updates, storeName)) {
                updates[storeName] = [];
              }
              updates[storeName].push(...updateMessages);
            }
          }
          // End update transaction.
          for (const store of Object.values(self._stores)) {
            await store.endUpdate();
          }
        }
        self._runAfterUpdateCallbacks();
      }
      _performWritesClient(updates) {
        const self = this;
        if (self._resetStores || !isEmpty(updates)) {
          // Begin a transactional update of each store.

          for (const [storeName, store] of Object.entries(self._stores)) {
            store.beginUpdate(hasOwn.call(updates, storeName) ? updates[storeName].length : 0, self._resetStores);
          }
          self._resetStores = false;
          for (const [storeName, updateMessages] of Object.entries(updates)) {
            const store = self._stores[storeName];
            if (store) {
              for (const updateMessage of updateMessages) {
                store.update(updateMessage);
              }
            } else {
              // Nobody's listening for this data. Queue it up until
              // someone wants it.
              // XXX memory use will grow without bound if you forget to
              // create a collection or just don't care about it... going
              // to have to do something about that.
              const updates = self._updatesForUnknownStores;
              if (!hasOwn.call(updates, storeName)) {
                updates[storeName] = [];
              }
              updates[storeName].push(...updateMessages);
            }
          }
          // End update transaction.
          for (const store of Object.values(self._stores)) {
            store.endUpdate();
          }
        }
        self._runAfterUpdateCallbacks();
      }

      // Call any callbacks deferred with _runWhenAllServerDocsAreFlushed whose
      // relevant docs have been flushed, as well as dataVisible callbacks at
      // reconnect-quiescence time.
      _runAfterUpdateCallbacks() {
        const self = this;
        const callbacks = self._afterUpdateCallbacks;
        self._afterUpdateCallbacks = [];
        callbacks.forEach(c => {
          c();
        });
      }
      _pushUpdate(updates, collection, msg) {
        if (!hasOwn.call(updates, collection)) {
          updates[collection] = [];
        }
        updates[collection].push(msg);
      }
      _getServerDoc(collection, id) {
        const self = this;
        if (!hasOwn.call(self._serverDocuments, collection)) {
          return null;
        }
        const serverDocsForCollection = self._serverDocuments[collection];
        return serverDocsForCollection.get(id) || null;
      }
      async _process_added(msg, updates) {
        const self = this;
        const id = MongoID.idParse(msg.id);
        const serverDoc = self._getServerDoc(msg.collection, id);
        if (serverDoc) {
          // Some outstanding stub wrote here.
          const isExisting = serverDoc.document !== undefined;
          serverDoc.document = msg.fields || Object.create(null);
          serverDoc.document._id = id;
          if (self._resetStores) {
            // During reconnect the server is sending adds for existing ids.
            // Always push an update so that document stays in the store after
            // reset. Use current version of the document for this update, so
            // that stub-written values are preserved.
            const currentDoc = await self._stores[msg.collection].getDoc(msg.id);
            if (currentDoc !== undefined) msg.fields = currentDoc;
            self._pushUpdate(updates, msg.collection, msg);
          } else if (isExisting) {
            throw new Error('Server sent add for existing id: ' + msg.id);
          }
        } else {
          self._pushUpdate(updates, msg.collection, msg);
        }
      }
      _process_changed(msg, updates) {
        const self = this;
        const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
        if (serverDoc) {
          if (serverDoc.document === undefined) throw new Error('Server sent changed for nonexisting id: ' + msg.id);
          DiffSequence.applyChanges(serverDoc.document, msg.fields);
        } else {
          self._pushUpdate(updates, msg.collection, msg);
        }
      }
      _process_removed(msg, updates) {
        const self = this;
        const serverDoc = self._getServerDoc(msg.collection, MongoID.idParse(msg.id));
        if (serverDoc) {
          // Some outstanding stub wrote here.
          if (serverDoc.document === undefined) throw new Error('Server sent removed for nonexisting id:' + msg.id);
          serverDoc.document = undefined;
        } else {
          self._pushUpdate(updates, msg.collection, {
            msg: 'removed',
            collection: msg.collection,
            id: msg.id
          });
        }
      }
      _process_updated(msg, updates) {
        const self = this;
        // Process "method done" messages.

        msg.methods.forEach(methodId => {
          const docs = self._documentsWrittenByStub[methodId] || {};
          Object.values(docs).forEach(written => {
            const serverDoc = self._getServerDoc(written.collection, written.id);
            if (!serverDoc) {
              throw new Error('Lost serverDoc for ' + JSON.stringify(written));
            }
            if (!serverDoc.writtenByStubs[methodId]) {
              throw new Error('Doc ' + JSON.stringify(written) + ' not written by  method ' + methodId);
            }
            delete serverDoc.writtenByStubs[methodId];
            if (isEmpty(serverDoc.writtenByStubs)) {
              // All methods whose stubs wrote this method have completed! We can
              // now copy the saved document to the database (reverting the stub's
              // change if the server did not write to this object, or applying the
              // server's writes if it did).

              // This is a fake ddp 'replace' message.  It's just for talking
              // between livedata connections and minimongo.  (We have to stringify
              // the ID because it's supposed to look like a wire message.)
              self._pushUpdate(updates, written.collection, {
                msg: 'replace',
                id: MongoID.idStringify(written.id),
                replace: serverDoc.document
              });
              // Call all flush callbacks.

              serverDoc.flushCallbacks.forEach(c => {
                c();
              });

              // Delete this completed serverDocument. Don't bother to GC empty
              // IdMaps inside self._serverDocuments, since there probably aren't
              // many collections and they'll be written repeatedly.
              self._serverDocuments[written.collection].remove(written.id);
            }
          });
          delete self._documentsWrittenByStub[methodId];

          // We want to call the data-written callback, but we can't do so until all
          // currently buffered messages are flushed.
          const callbackInvoker = self._methodInvokers[methodId];
          if (!callbackInvoker) {
            throw new Error('No callback invoker for method ' + methodId);
          }
          self._runWhenAllServerDocsAreFlushed(function () {
            return callbackInvoker.dataVisible(...arguments);
          });
        });
      }
      _process_ready(msg, updates) {
        const self = this;
        // Process "sub ready" messages. "sub ready" messages don't take effect
        // until all current server documents have been flushed to the local
        // database. We can use a write fence to implement this.

        msg.subs.forEach(subId => {
          self._runWhenAllServerDocsAreFlushed(() => {
            const subRecord = self._subscriptions[subId];
            // Did we already unsubscribe?
            if (!subRecord) return;
            // Did we already receive a ready message? (Oops!)
            if (subRecord.ready) return;
            subRecord.ready = true;
            subRecord.readyCallback && subRecord.readyCallback();
            subRecord.readyDeps.changed();
          });
        });
      }

      // Ensures that "f" will be called after all documents currently in
      // _serverDocuments have been written to the local cache. f will not be called
      // if the connection is lost before then!
      _runWhenAllServerDocsAreFlushed(f) {
        const self = this;
        const runFAfterUpdates = () => {
          self._afterUpdateCallbacks.push(f);
        };
        let unflushedServerDocCount = 0;
        const onServerDocFlush = () => {
          --unflushedServerDocCount;
          if (unflushedServerDocCount === 0) {
            // This was the last doc to flush! Arrange to run f after the updates
            // have been applied.
            runFAfterUpdates();
          }
        };
        Object.values(self._serverDocuments).forEach(serverDocuments => {
          serverDocuments.forEach(serverDoc => {
            const writtenByStubForAMethodWithSentMessage = keys(serverDoc.writtenByStubs).some(methodId => {
              const invoker = self._methodInvokers[methodId];
              return invoker && invoker.sentMessage;
            });
            if (writtenByStubForAMethodWithSentMessage) {
              ++unflushedServerDocCount;
              serverDoc.flushCallbacks.push(onServerDocFlush);
            }
          });
        });
        if (unflushedServerDocCount === 0) {
          // There aren't any buffered docs --- we can call f as soon as the current
          // round of updates is applied!
          runFAfterUpdates();
        }
      }
      async _livedata_nosub(msg) {
        const self = this;

        // First pass it through _livedata_data, which only uses it to help get
        // towards quiescence.
        await self._livedata_data(msg);

        // Do the rest of our processing immediately, with no
        // buffering-until-quiescence.

        // we weren't subbed anyway, or we initiated the unsub.
        if (!hasOwn.call(self._subscriptions, msg.id)) {
          return;
        }

        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        const errorCallback = self._subscriptions[msg.id].errorCallback;
        const stopCallback = self._subscriptions[msg.id].stopCallback;
        self._subscriptions[msg.id].remove();
        const meteorErrorFromMsg = msgArg => {
          return msgArg && msgArg.error && new Meteor.Error(msgArg.error.error, msgArg.error.reason, msgArg.error.details);
        };

        // XXX COMPAT WITH 1.0.3.1 #errorCallback
        if (errorCallback && msg.error) {
          errorCallback(meteorErrorFromMsg(msg));
        }
        if (stopCallback) {
          stopCallback(meteorErrorFromMsg(msg));
        }
      }
      async _livedata_result(msg) {
        // id, result or error. error has error (code), reason, details

        const self = this;

        // Lets make sure there are no buffered writes before returning result.
        if (!isEmpty(self._bufferedWrites)) {
          await self._flushBufferedWrites();
        }

        // find the outstanding request
        // should be O(1) in nearly all realistic use cases
        if (isEmpty(self._outstandingMethodBlocks)) {
          Meteor._debug('Received method result but no methods outstanding');
          return;
        }
        const currentMethodBlock = self._outstandingMethodBlocks[0].methods;
        let i;
        const m = currentMethodBlock.find((method, idx) => {
          const found = method.methodId === msg.id;
          if (found) i = idx;
          return found;
        });
        if (!m) {
          Meteor._debug("Can't match method response to original method call", msg);
          return;
        }

        // Remove from current method block. This may leave the block empty, but we
        // don't move on to the next block until the callback has been delivered, in
        // _outstandingMethodFinished.
        currentMethodBlock.splice(i, 1);
        if (hasOwn.call(msg, 'error')) {
          m.receiveResult(new Meteor.Error(msg.error.error, msg.error.reason, msg.error.details));
        } else {
          // msg.result may be undefined if the method didn't return a
          // value
          m.receiveResult(undefined, msg.result);
        }
      }

      // Called by MethodInvoker after a method's callback is invoked.  If this was
      // the last outstanding method in the current block, runs the next block. If
      // there are no more methods, consider accepting a hot code push.
      _outstandingMethodFinished() {
        const self = this;
        if (self._anyMethodsAreOutstanding()) return;

        // No methods are outstanding. This should mean that the first block of
        // methods is empty. (Or it might not exist, if this was a method that
        // half-finished before disconnect/reconnect.)
        if (!isEmpty(self._outstandingMethodBlocks)) {
          const firstBlock = self._outstandingMethodBlocks.shift();
          if (!isEmpty(firstBlock.methods)) throw new Error('No methods outstanding but nonempty block: ' + JSON.stringify(firstBlock));

          // Send the outstanding methods now in the first block.
          if (!isEmpty(self._outstandingMethodBlocks)) self._sendOutstandingMethods();
        }

        // Maybe accept a hot code push.
        self._maybeMigrate();
      }

      // Sends messages for all the methods in the first block in
      // _outstandingMethodBlocks.
      _sendOutstandingMethods() {
        const self = this;
        if (isEmpty(self._outstandingMethodBlocks)) {
          return;
        }
        self._outstandingMethodBlocks[0].methods.forEach(m => {
          m.sendMessage();
        });
      }
      _livedata_error(msg) {
        Meteor._debug('Received error from server: ', msg.reason);
        if (msg.offendingMessage) Meteor._debug('For: ', msg.offendingMessage);
      }
      _callOnReconnectAndSendAppropriateOutstandingMethods() {
        const self = this;
        const oldOutstandingMethodBlocks = self._outstandingMethodBlocks;
        self._outstandingMethodBlocks = [];
        self.onReconnect && self.onReconnect();
        DDP._reconnectHook.each(callback => {
          callback(self);
          return true;
        });
        if (isEmpty(oldOutstandingMethodBlocks)) return;

        // We have at least one block worth of old outstanding methods to try
        // again. First: did onReconnect actually send anything? If not, we just
        // restore all outstanding methods and run the first block.
        if (isEmpty(self._outstandingMethodBlocks)) {
          self._outstandingMethodBlocks = oldOutstandingMethodBlocks;
          self._sendOutstandingMethods();
          return;
        }

        // OK, there are blocks on both sides. Special case: merge the last block of
        // the reconnect methods with the first block of the original methods, if
        // neither of them are "wait" blocks.
        if (!last(self._outstandingMethodBlocks).wait && !oldOutstandingMethodBlocks[0].wait) {
          oldOutstandingMethodBlocks[0].methods.forEach(m => {
            last(self._outstandingMethodBlocks).methods.push(m);

            // If this "last block" is also the first block, send the message.
            if (self._outstandingMethodBlocks.length === 1) {
              m.sendMessage();
            }
          });
          oldOutstandingMethodBlocks.shift();
        }

        // Now add the rest of the original blocks on.
        self._outstandingMethodBlocks.push(...oldOutstandingMethodBlocks);
      }

      // We can accept a hot code push if there are no methods in flight.
      _readyToMigrate() {
        return isEmpty(this._methodInvokers);
      }

      // If we were blocking a migration, see if it's now possible to continue.
      // Call whenever the set of outstanding/blocked methods shrinks.
      _maybeMigrate() {
        const self = this;
        if (self._retryMigrate && self._readyToMigrate()) {
          self._retryMigrate();
          self._retryMigrate = null;
        }
      }
      async onMessage(raw_msg) {
        let msg;
        try {
          msg = DDPCommon.parseDDP(raw_msg);
        } catch (e) {
          Meteor._debug('Exception while parsing DDP', e);
          return;
        }

        // Any message counts as receiving a pong, as it demonstrates that
        // the server is still alive.
        if (this._heartbeat) {
          this._heartbeat.messageReceived();
        }
        if (msg === null || !msg.msg) {
          if (!msg || !msg.testMessageOnConnect) {
            if (Object.keys(msg).length === 1 && msg.server_id) return;
            Meteor._debug('discarding invalid livedata message', msg);
          }
          return;
        }
        if (msg.msg === 'connected') {
          this._version = this._versionSuggestion;
          await this._livedata_connected(msg);
          this.options.onConnected();
        } else if (msg.msg === 'failed') {
          if (this._supportedDDPVersions.indexOf(msg.version) >= 0) {
            this._versionSuggestion = msg.version;
            this._stream.reconnect({
              _force: true
            });
          } else {
            const description = 'DDP version negotiation failed; server requested version ' + msg.version;
            this._stream.disconnect({
              _permanent: true,
              _error: description
            });
            this.options.onDDPVersionNegotiationFailure(description);
          }
        } else if (msg.msg === 'ping' && this.options.respondToPings) {
          this._send({
            msg: 'pong',
            id: msg.id
          });
        } else if (msg.msg === 'pong') {
          // noop, as we assume everything's a pong
        } else if (['added', 'changed', 'removed', 'ready', 'updated'].includes(msg.msg)) {
          await this._livedata_data(msg);
        } else if (msg.msg === 'nosub') {
          await this._livedata_nosub(msg);
        } else if (msg.msg === 'result') {
          await this._livedata_result(msg);
        } else if (msg.msg === 'error') {
          this._livedata_error(msg);
        } else {
          Meteor._debug('discarding unknown livedata message type', msg);
        }
      }
      onReset() {
        // Send a connect message at the beginning of the stream.
        // NOTE: reset is called even on the first connection, so this is
        // the only place we send this message.
        const msg = {
          msg: 'connect'
        };
        if (this._lastSessionId) msg.session = this._lastSessionId;
        msg.version = this._versionSuggestion || this._supportedDDPVersions[0];
        this._versionSuggestion = msg.version;
        msg.support = this._supportedDDPVersions;
        this._send(msg);

        // Mark non-retry calls as failed. This has to be done early as getting these methods out of the
        // current block is pretty important to making sure that quiescence is properly calculated, as
        // well as possibly moving on to another useful block.

        // Only bother testing if there is an outstandingMethodBlock (there might not be, especially if
        // we are connecting for the first time.
        if (this._outstandingMethodBlocks.length > 0) {
          // If there is an outstanding method block, we only care about the first one as that is the
          // one that could have already sent messages with no response, that are not allowed to retry.
          const currentMethodBlock = this._outstandingMethodBlocks[0].methods;
          this._outstandingMethodBlocks[0].methods = currentMethodBlock.filter(methodInvoker => {
            // Methods with 'noRetry' option set are not allowed to re-send after
            // recovering dropped connection.
            if (methodInvoker.sentMessage && methodInvoker.noRetry) {
              // Make sure that the method is told that it failed.
              methodInvoker.receiveResult(new Meteor.Error('invocation-failed', 'Method invocation might have failed due to dropped connection. ' + 'Failing because `noRetry` option was passed to Meteor.apply.'));
            }

            // Only keep a method if it wasn't sent or it's allowed to retry.
            // This may leave the block empty, but we don't move on to the next
            // block until the callback has been delivered, in _outstandingMethodFinished.
            return !(methodInvoker.sentMessage && methodInvoker.noRetry);
          });
        }

        // Now, to minimize setup latency, go ahead and blast out all of
        // our pending methods ands subscriptions before we've even taken
        // the necessary RTT to know if we successfully reconnected. (1)
        // They're supposed to be idempotent, and where they are not,
        // they can block retry in apply; (2) even if we did reconnect,
        // we're not sure what messages might have gotten lost
        // (in either direction) since we were disconnected (TCP being
        // sloppy about that.)

        // If the current block of methods all got their results (but didn't all get
        // their data visible), discard the empty block now.
        if (this._outstandingMethodBlocks.length > 0 && this._outstandingMethodBlocks[0].methods.length === 0) {
          this._outstandingMethodBlocks.shift();
        }

        // Mark all messages as unsent, they have not yet been sent on this
        // connection.
        keys(this._methodInvokers).forEach(id => {
          this._methodInvokers[id].sentMessage = false;
        });

        // If an `onReconnect` handler is set, call it first. Go through
        // some hoops to ensure that methods that are called from within
        // `onReconnect` get executed _before_ ones that were originally
        // outstanding (since `onReconnect` is used to re-establish auth
        // certificates)
        this._callOnReconnectAndSendAppropriateOutstandingMethods();

        // add new subscriptions at the end. this way they take effect after
        // the handlers and we don't see flicker.
        Object.entries(this._subscriptions).forEach(_ref6 => {
          let [id, sub] = _ref6;
          this._send({
            msg: 'sub',
            id: id,
            name: sub.name,
            params: sub.params
          });
        });
      }
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"namespace.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/ddp-client/common/namespace.js                                                                            //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      DDP: () => DDP
    });
    let DDPCommon;
    module.link("meteor/ddp-common", {
      DDPCommon(v) {
        DDPCommon = v;
      }
    }, 0);
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 1);
    let Connection;
    module.link("./livedata_connection.js", {
      Connection(v) {
        Connection = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // This array allows the `_allSubscriptionsReady` method below, which
    // is used by the `spiderable` package, to keep track of whether all
    // data is ready.
    const allConnections = [];

    /**
     * @namespace DDP
     * @summary Namespace for DDP-related methods/classes.
     */
    const DDP = {};
    // This is private but it's used in a few places. accounts-base uses
    // it to get the current user. Meteor.setTimeout and friends clear
    // it. We can probably find a better way to factor this.
    DDP._CurrentMethodInvocation = new Meteor.EnvironmentVariable();
    DDP._CurrentPublicationInvocation = new Meteor.EnvironmentVariable();

    // XXX: Keep DDP._CurrentInvocation for backwards-compatibility.
    DDP._CurrentInvocation = DDP._CurrentMethodInvocation;
    DDP._CurrentCallAsyncInvocation = new Meteor.EnvironmentVariable();

    // This is passed into a weird `makeErrorType` function that expects its thing
    // to be a constructor
    function connectionErrorConstructor(message) {
      this.message = message;
    }
    DDP.ConnectionError = Meteor.makeErrorType('DDP.ConnectionError', connectionErrorConstructor);
    DDP.ForcedReconnectError = Meteor.makeErrorType('DDP.ForcedReconnectError', () => {});

    // Returns the named sequence of pseudo-random values.
    // The scope will be DDP._CurrentMethodInvocation.get(), so the stream will produce
    // consistent values for method calls on the client and server.
    DDP.randomStream = name => {
      const scope = DDP._CurrentMethodInvocation.get();
      return DDPCommon.RandomStream.get(scope, name);
    };

    // @param url {String} URL to Meteor app,
    //     e.g.:
    //     "subdomain.meteor.com",
    //     "http://subdomain.meteor.com",
    //     "/",
    //     "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"

    /**
     * @summary Connect to the server of a different Meteor application to subscribe to its document sets and invoke its remote methods.
     * @locus Anywhere
     * @param {String} url The URL of another Meteor application.
     * @param {Object} [options]
     * @param {Boolean} options.reloadWithOutstanding is it OK to reload if there are outstanding methods?
     * @param {Object} options.headers extra headers to send on the websockets connection, for server-to-server DDP only
     * @param {Object} options._sockjsOptions Specifies options to pass through to the sockjs client
     * @param {Function} options.onDDPNegotiationVersionFailure callback when version negotiation fails.
     */
    DDP.connect = (url, options) => {
      const ret = new Connection(url, options);
      allConnections.push(ret); // hack. see below.
      return ret;
    };
    DDP._reconnectHook = new Hook({
      bindEnvironment: false
    });

    /**
     * @summary Register a function to call as the first step of
     * reconnecting. This function can call methods which will be executed before
     * any other outstanding methods. For example, this can be used to re-establish
     * the appropriate authentication context on the connection.
     * @locus Anywhere
     * @param {Function} callback The function to call. It will be called with a
     * single argument, the [connection object](#ddp_connect) that is reconnecting.
     */
    DDP.onReconnect = callback => DDP._reconnectHook.register(callback);

    // Hack for `spiderable` package: a way to see if the page is done
    // loading all the data it needs.
    //
    DDP._allSubscriptionsReady = () => allConnections.every(conn => Object.values(conn._subscriptions).every(sub => sub.ready));
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      DDP: DDP
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/ddp-client/server/server.js"
  ],
  mainModulePath: "/node_modules/meteor/ddp-client/server/server.js"
}});

//# sourceURL=meteor://💻app/packages/ddp-client.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvZGRwLWNsaWVudC9zZXJ2ZXIvc2VydmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9NZXRob2RJbnZva2VyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9saXZlZGF0YV9jb25uZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9kZHAtY2xpZW50L2NvbW1vbi9uYW1lc3BhY2UuanMiXSwibmFtZXMiOlsibW9kdWxlIiwibGluayIsIkREUCIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiZXhwb3J0IiwiZGVmYXVsdCIsIk1ldGhvZEludm9rZXIiLCJjb25zdHJ1Y3RvciIsIm9wdGlvbnMiLCJtZXRob2RJZCIsInNlbnRNZXNzYWdlIiwiX2NhbGxiYWNrIiwiY2FsbGJhY2siLCJfY29ubmVjdGlvbiIsImNvbm5lY3Rpb24iLCJfbWVzc2FnZSIsIm1lc3NhZ2UiLCJfb25SZXN1bHRSZWNlaXZlZCIsIm9uUmVzdWx0UmVjZWl2ZWQiLCJfd2FpdCIsIndhaXQiLCJub1JldHJ5IiwiX21ldGhvZFJlc3VsdCIsIl9kYXRhVmlzaWJsZSIsIl9tZXRob2RJbnZva2VycyIsInNlbmRNZXNzYWdlIiwiZ290UmVzdWx0IiwiRXJyb3IiLCJfbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSIsIl9zZW5kIiwiX21heWJlSW52b2tlQ2FsbGJhY2siLCJfb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCIsInJlY2VpdmVSZXN1bHQiLCJlcnIiLCJyZXN1bHQiLCJkYXRhVmlzaWJsZSIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllcyIsInYiLCJfb2JqZWN0U3ByZWFkIiwiX2V4Y2x1ZGVkIiwiX2V4Y2x1ZGVkMiIsIkNvbm5lY3Rpb24iLCJNZXRlb3IiLCJERFBDb21tb24iLCJUcmFja2VyIiwiRUpTT04iLCJSYW5kb20iLCJIb29rIiwiTW9uZ29JRCIsImhhc093biIsInNsaWNlIiwia2V5cyIsImlzRW1wdHkiLCJsYXN0IiwiTW9uZ29JRE1hcCIsIklkTWFwIiwiaWRTdHJpbmdpZnkiLCJpZFBhcnNlIiwidXJsIiwib25Db25uZWN0ZWQiLCJvbkREUFZlcnNpb25OZWdvdGlhdGlvbkZhaWx1cmUiLCJkZXNjcmlwdGlvbiIsIl9kZWJ1ZyIsImhlYXJ0YmVhdEludGVydmFsIiwiaGVhcnRiZWF0VGltZW91dCIsIm5wbUZheWVPcHRpb25zIiwiT2JqZWN0IiwiY3JlYXRlIiwicmVsb2FkV2l0aE91dHN0YW5kaW5nIiwic3VwcG9ydGVkRERQVmVyc2lvbnMiLCJTVVBQT1JURURfRERQX1ZFUlNJT05TIiwicmV0cnkiLCJyZXNwb25kVG9QaW5ncyIsImJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwiLCJidWZmZXJlZFdyaXRlc01heEFnZSIsIm9uUmVjb25uZWN0IiwiX3N0cmVhbSIsIkNsaWVudFN0cmVhbSIsInJlcXVpcmUiLCJDb25uZWN0aW9uRXJyb3IiLCJoZWFkZXJzIiwiX3NvY2tqc09wdGlvbnMiLCJfZG9udFByaW50RXJyb3JzIiwiY29ubmVjdFRpbWVvdXRNcyIsIl9sYXN0U2Vzc2lvbklkIiwiX3ZlcnNpb25TdWdnZXN0aW9uIiwiX3ZlcnNpb24iLCJfc3RvcmVzIiwiX21ldGhvZEhhbmRsZXJzIiwiX25leHRNZXRob2RJZCIsIl9zdXBwb3J0ZWRERFBWZXJzaW9ucyIsIl9oZWFydGJlYXRJbnRlcnZhbCIsIl9oZWFydGJlYXRUaW1lb3V0IiwiX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzIiwiX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIiLCJfc2VydmVyRG9jdW1lbnRzIiwiX2FmdGVyVXBkYXRlQ2FsbGJhY2tzIiwiX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2UiLCJfc3Vic0JlaW5nUmV2aXZlZCIsIl9yZXNldFN0b3JlcyIsIl91cGRhdGVzRm9yVW5rbm93blN0b3JlcyIsIl9yZXRyeU1pZ3JhdGUiLCJfX2ZsdXNoQnVmZmVyZWRXcml0ZXMiLCJiaW5kRW52aXJvbm1lbnQiLCJfZmx1c2hCdWZmZXJlZFdyaXRlcyIsIl9idWZmZXJlZFdyaXRlcyIsIl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQiLCJfYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSIsIl9idWZmZXJlZFdyaXRlc0ludGVydmFsIiwiX2J1ZmZlcmVkV3JpdGVzTWF4QWdlIiwiX3N1YnNjcmlwdGlvbnMiLCJfdXNlcklkIiwiX3VzZXJJZERlcHMiLCJEZXBlbmRlbmN5IiwiaXNDbGllbnQiLCJQYWNrYWdlIiwicmVsb2FkIiwiUmVsb2FkIiwiX29uTWlncmF0ZSIsIl9yZWFkeVRvTWlncmF0ZSIsIm9uRGlzY29ubmVjdCIsIl9oZWFydGJlYXQiLCJzdG9wIiwiaXNTZXJ2ZXIiLCJvbiIsIm9uTWVzc2FnZSIsImJpbmQiLCJvblJlc2V0IiwiY3JlYXRlU3RvcmVNZXRob2RzIiwibmFtZSIsIndyYXBwZWRTdG9yZSIsInN0b3JlIiwia2V5c09mU3RvcmUiLCJmb3JFYWNoIiwibWV0aG9kIiwiYXJndW1lbnRzIiwicmVnaXN0ZXJTdG9yZUNsaWVudCIsInF1ZXVlZCIsIkFycmF5IiwiaXNBcnJheSIsImJlZ2luVXBkYXRlIiwibGVuZ3RoIiwibXNnIiwidXBkYXRlIiwiZW5kVXBkYXRlIiwicmVnaXN0ZXJTdG9yZVNlcnZlciIsInN1YnNjcmliZSIsInBhcmFtcyIsImNhbGwiLCJjYWxsYmFja3MiLCJsYXN0UGFyYW0iLCJvblJlYWR5IiwicG9wIiwib25FcnJvciIsIm9uU3RvcCIsInNvbWUiLCJmIiwiZXhpc3RpbmciLCJ2YWx1ZXMiLCJmaW5kIiwic3ViIiwiaW5hY3RpdmUiLCJlcXVhbHMiLCJpZCIsInJlYWR5IiwicmVhZHlDYWxsYmFjayIsImVycm9yQ2FsbGJhY2siLCJzdG9wQ2FsbGJhY2siLCJjbG9uZSIsInJlYWR5RGVwcyIsInJlbW92ZSIsImNoYW5nZWQiLCJoYW5kbGUiLCJyZWNvcmQiLCJkZXBlbmQiLCJzdWJzY3JpcHRpb25JZCIsImFjdGl2ZSIsIm9uSW52YWxpZGF0ZSIsImMiLCJhZnRlckZsdXNoIiwiaXNBc3luY0NhbGwiLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJfaXNDYWxsQXN5bmNNZXRob2RSdW5uaW5nIiwibWV0aG9kcyIsImVudHJpZXMiLCJfcmVmIiwiZnVuYyIsIl9nZXRJc1NpbXVsYXRpb24iLCJfcmVmMiIsImlzRnJvbUNhbGxBc3luYyIsImFscmVhZHlJblNpbXVsYXRpb24iLCJhcmdzIiwiYXBwbHkiLCJjYWxsQXN5bmMiLCJhcHBseUFzeW5jIiwicmV0dXJuU2VydmVyUmVzdWx0UHJvbWlzZSIsIl90aGlzJF9zdHViQ2FsbCIsIl9zdHViQ2FsbCIsInN0dWJJbnZvY2F0aW9uIiwiaW52b2NhdGlvbiIsInN0dWJPcHRpb25zIiwiaGFzU3R1YiIsIl9zYXZlT3JpZ2luYWxzIiwic3R1YlJldHVyblZhbHVlIiwid2l0aFZhbHVlIiwiZSIsImV4Y2VwdGlvbiIsIl9hcHBseSIsInVuZGVmaW5lZCIsInN0dWJQcm9taXNlIiwiX2FwcGx5QXN5bmNTdHViSW52b2NhdGlvbiIsInByb21pc2UiLCJfYXBwbHlBc3luYyIsInRoZW4iLCJvIiwic2VydmVyUHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiY2F0Y2giLCJfdGhpcyRfc3R1YkNhbGwyIiwiY3VycmVudENvbnRleHQiLCJfc2V0TmV3Q29udGV4dEFuZEdldEN1cnJlbnQiLCJfc2V0IiwiX3JlZjMiLCJzdHViQ2FsbFZhbHVlIiwicmFuZG9tU2VlZCIsIl9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIiwidGhyb3dTdHViRXhjZXB0aW9ucyIsIl9leHBlY3RlZEJ5VGVzdCIsImZ1dHVyZSIsInJldHVyblN0dWJWYWx1ZSIsIl9sZW4iLCJhbGxBcmdzIiwiX2tleSIsImZyb20iLCJzaGlmdCIsInZhbHVlIiwibWV0aG9kSW52b2tlciIsInB1c2giLCJlbmNsb3NpbmciLCJnZXQiLCJzdHViIiwiaXNTaW11bGF0aW9uIiwiX2lzRnJvbUNhbGxBc3luYyIsImRlZmF1bHRSZXR1cm4iLCJyYW5kb21TZWVkR2VuZXJhdG9yIiwibWFrZVJwY1NlZWQiLCJzZXRVc2VySWQiLCJ1c2VySWQiLCJNZXRob2RJbnZvY2F0aW9uIiwiX25vWWllbGRzQWxsb3dlZCIsIl93YWl0aW5nRm9yUXVpZXNjZW5jZSIsIl9mbHVzaEJ1ZmZlcmVkV3JpdGVzQ2xpZW50Iiwic2F2ZU9yaWdpbmFscyIsImRvY3NXcml0dGVuIiwiX3JlZjQiLCJjb2xsZWN0aW9uIiwib3JpZ2luYWxzIiwicmV0cmlldmVPcmlnaW5hbHMiLCJkb2MiLCJzZXJ2ZXJEb2MiLCJzZXREZWZhdWx0Iiwid3JpdHRlbkJ5U3R1YnMiLCJkb2N1bWVudCIsImZsdXNoQ2FsbGJhY2tzIiwiX3Vuc3Vic2NyaWJlQWxsIiwib2JqIiwic2VuZCIsInN0cmluZ2lmeUREUCIsIl9sb3N0Q29ubmVjdGlvbiIsImVycm9yIiwic3RhdHVzIiwicmVjb25uZWN0IiwiZGlzY29ubmVjdCIsImNsb3NlIiwiX3Blcm1hbmVudCIsIl9hbnlNZXRob2RzQXJlT3V0c3RhbmRpbmciLCJpbnZva2VycyIsImludm9rZXIiLCJfbGl2ZWRhdGFfY29ubmVjdGVkIiwiSGVhcnRiZWF0Iiwib25UaW1lb3V0Iiwic2VuZFBpbmciLCJzdGFydCIsInJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb24iLCJzZXNzaW9uIiwiX3JlZjUiLCJfcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MiLCJfcHJvY2Vzc09uZURhdGFNZXNzYWdlIiwidXBkYXRlcyIsIm1lc3NhZ2VUeXBlIiwiX3Byb2Nlc3NfYWRkZWQiLCJfcHJvY2Vzc19jaGFuZ2VkIiwiX3Byb2Nlc3NfcmVtb3ZlZCIsIl9wcm9jZXNzX3JlYWR5IiwiX3Byb2Nlc3NfdXBkYXRlZCIsIl9saXZlZGF0YV9kYXRhIiwic3VicyIsInN1YklkIiwiYnVmZmVyZWRNZXNzYWdlcyIsImJ1ZmZlcmVkTWVzc2FnZSIsInN0YW5kYXJkV3JpdGUiLCJEYXRlIiwidmFsdWVPZiIsImNsZWFyVGltZW91dCIsInNldFRpbWVvdXQiLCJfbGl2ZURhdGFXcml0ZXNQcm9taXNlIiwiX2lzUHJvbWlzZSIsImZpbmFsbHkiLCJfcHJlcGFyZUJ1ZmZlcnNUb0ZsdXNoIiwid3JpdGVzIiwiX2ZsdXNoQnVmZmVyZWRXcml0ZXNTZXJ2ZXIiLCJfcGVyZm9ybVdyaXRlc1NlcnZlciIsIl9wZXJmb3JtV3JpdGVzQ2xpZW50Iiwic3RvcmVOYW1lIiwidXBkYXRlTWVzc2FnZXMiLCJ1cGRhdGVNZXNzYWdlIiwiX3B1c2hVcGRhdGUiLCJfZ2V0U2VydmVyRG9jIiwic2VydmVyRG9jc0ZvckNvbGxlY3Rpb24iLCJpc0V4aXN0aW5nIiwiZmllbGRzIiwiX2lkIiwiY3VycmVudERvYyIsImdldERvYyIsIkRpZmZTZXF1ZW5jZSIsImFwcGx5Q2hhbmdlcyIsImRvY3MiLCJ3cml0dGVuIiwiSlNPTiIsInN0cmluZ2lmeSIsInJlcGxhY2UiLCJjYWxsYmFja0ludm9rZXIiLCJfcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkIiwic3ViUmVjb3JkIiwicnVuRkFmdGVyVXBkYXRlcyIsInVuZmx1c2hlZFNlcnZlckRvY0NvdW50Iiwib25TZXJ2ZXJEb2NGbHVzaCIsInNlcnZlckRvY3VtZW50cyIsIndyaXR0ZW5CeVN0dWJGb3JBTWV0aG9kV2l0aFNlbnRNZXNzYWdlIiwiX2xpdmVkYXRhX25vc3ViIiwibWV0ZW9yRXJyb3JGcm9tTXNnIiwibXNnQXJnIiwicmVhc29uIiwiZGV0YWlscyIsIl9saXZlZGF0YV9yZXN1bHQiLCJjdXJyZW50TWV0aG9kQmxvY2siLCJpIiwibSIsImlkeCIsImZvdW5kIiwic3BsaWNlIiwiZmlyc3RCbG9jayIsIl9zZW5kT3V0c3RhbmRpbmdNZXRob2RzIiwiX21heWJlTWlncmF0ZSIsIl9saXZlZGF0YV9lcnJvciIsIm9mZmVuZGluZ01lc3NhZ2UiLCJfY2FsbE9uUmVjb25uZWN0QW5kU2VuZEFwcHJvcHJpYXRlT3V0c3RhbmRpbmdNZXRob2RzIiwib2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MiLCJfcmVjb25uZWN0SG9vayIsImVhY2giLCJyYXdfbXNnIiwicGFyc2VERFAiLCJtZXNzYWdlUmVjZWl2ZWQiLCJ0ZXN0TWVzc2FnZU9uQ29ubmVjdCIsInNlcnZlcl9pZCIsImluZGV4T2YiLCJ2ZXJzaW9uIiwiX2ZvcmNlIiwiX2Vycm9yIiwiaW5jbHVkZXMiLCJzdXBwb3J0IiwiZmlsdGVyIiwiX3JlZjYiLCJhbGxDb25uZWN0aW9ucyIsIkVudmlyb25tZW50VmFyaWFibGUiLCJfQ3VycmVudFB1YmxpY2F0aW9uSW52b2NhdGlvbiIsIl9DdXJyZW50SW52b2NhdGlvbiIsIl9DdXJyZW50Q2FsbEFzeW5jSW52b2NhdGlvbiIsImNvbm5lY3Rpb25FcnJvckNvbnN0cnVjdG9yIiwibWFrZUVycm9yVHlwZSIsIkZvcmNlZFJlY29ubmVjdEVycm9yIiwicmFuZG9tU3RyZWFtIiwic2NvcGUiLCJSYW5kb21TdHJlYW0iLCJjb25uZWN0IiwicmV0IiwicmVnaXN0ZXIiLCJfYWxsU3Vic2NyaXB0aW9uc1JlYWR5IiwiZXZlcnkiLCJjb25uIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBQSxNQUFNLENBQUNDLElBQUksQ0FBQyx3QkFBd0IsRUFBQztNQUFDQyxHQUFHLEVBQUM7SUFBSyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTUEsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFBQ0Msc0JBQUE7RUFBQSxTQUFBQyxXQUFBO0lBQUEsT0FBQUQsc0JBQUEsQ0FBQUMsV0FBQTtFQUFBO0VBQUFELHNCQUFBO0FBQUE7RUFBQUUsSUFBQTtFQUFBQyxLQUFBO0FBQUEsRzs7Ozs7Ozs7Ozs7QUNBakhQLE1BQU0sQ0FBQ1EsTUFBTSxDQUFDO0VBQUNDLE9BQU8sRUFBQ0EsQ0FBQSxLQUFJQztBQUFhLENBQUMsQ0FBQztBQUszQixNQUFNQSxhQUFhLENBQUM7RUFDakNDLFdBQVdBLENBQUNDLE9BQU8sRUFBRTtJQUNuQjtJQUNBLElBQUksQ0FBQ0MsUUFBUSxHQUFHRCxPQUFPLENBQUNDLFFBQVE7SUFDaEMsSUFBSSxDQUFDQyxXQUFXLEdBQUcsS0FBSztJQUV4QixJQUFJLENBQUNDLFNBQVMsR0FBR0gsT0FBTyxDQUFDSSxRQUFRO0lBQ2pDLElBQUksQ0FBQ0MsV0FBVyxHQUFHTCxPQUFPLENBQUNNLFVBQVU7SUFDckMsSUFBSSxDQUFDQyxRQUFRLEdBQUdQLE9BQU8sQ0FBQ1EsT0FBTztJQUMvQixJQUFJLENBQUNDLGlCQUFpQixHQUFHVCxPQUFPLENBQUNVLGdCQUFnQixLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDL0QsSUFBSSxDQUFDQyxLQUFLLEdBQUdYLE9BQU8sQ0FBQ1ksSUFBSTtJQUN6QixJQUFJLENBQUNDLE9BQU8sR0FBR2IsT0FBTyxDQUFDYSxPQUFPO0lBQzlCLElBQUksQ0FBQ0MsYUFBYSxHQUFHLElBQUk7SUFDekIsSUFBSSxDQUFDQyxZQUFZLEdBQUcsS0FBSzs7SUFFekI7SUFDQSxJQUFJLENBQUNWLFdBQVcsQ0FBQ1csZUFBZSxDQUFDLElBQUksQ0FBQ2YsUUFBUSxDQUFDLEdBQUcsSUFBSTtFQUN4RDtFQUNBO0VBQ0E7RUFDQWdCLFdBQVdBLENBQUEsRUFBRztJQUNaO0lBQ0E7SUFDQTtJQUNBLElBQUksSUFBSSxDQUFDQyxTQUFTLENBQUMsQ0FBQyxFQUNsQixNQUFNLElBQUlDLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQzs7SUFFbEU7SUFDQTtJQUNBLElBQUksQ0FBQ0osWUFBWSxHQUFHLEtBQUs7SUFDekIsSUFBSSxDQUFDYixXQUFXLEdBQUcsSUFBSTs7SUFFdkI7SUFDQTtJQUNBLElBQUksSUFBSSxDQUFDUyxLQUFLLEVBQ1osSUFBSSxDQUFDTixXQUFXLENBQUNlLDBCQUEwQixDQUFDLElBQUksQ0FBQ25CLFFBQVEsQ0FBQyxHQUFHLElBQUk7O0lBRW5FO0lBQ0EsSUFBSSxDQUFDSSxXQUFXLENBQUNnQixLQUFLLENBQUMsSUFBSSxDQUFDZCxRQUFRLENBQUM7RUFDdkM7RUFDQTtFQUNBO0VBQ0FlLG9CQUFvQkEsQ0FBQSxFQUFHO0lBQ3JCLElBQUksSUFBSSxDQUFDUixhQUFhLElBQUksSUFBSSxDQUFDQyxZQUFZLEVBQUU7TUFDM0M7TUFDQTtNQUNBLElBQUksQ0FBQ1osU0FBUyxDQUFDLElBQUksQ0FBQ1csYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQ0EsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDOztNQUU1RDtNQUNBLE9BQU8sSUFBSSxDQUFDVCxXQUFXLENBQUNXLGVBQWUsQ0FBQyxJQUFJLENBQUNmLFFBQVEsQ0FBQzs7TUFFdEQ7TUFDQTtNQUNBLElBQUksQ0FBQ0ksV0FBVyxDQUFDa0IsMEJBQTBCLENBQUMsQ0FBQztJQUMvQztFQUNGO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQUMsYUFBYUEsQ0FBQ0MsR0FBRyxFQUFFQyxNQUFNLEVBQUU7SUFDekIsSUFBSSxJQUFJLENBQUNSLFNBQVMsQ0FBQyxDQUFDLEVBQ2xCLE1BQU0sSUFBSUMsS0FBSyxDQUFDLDBDQUEwQyxDQUFDO0lBQzdELElBQUksQ0FBQ0wsYUFBYSxHQUFHLENBQUNXLEdBQUcsRUFBRUMsTUFBTSxDQUFDO0lBQ2xDLElBQUksQ0FBQ2pCLGlCQUFpQixDQUFDZ0IsR0FBRyxFQUFFQyxNQUFNLENBQUM7SUFDbkMsSUFBSSxDQUFDSixvQkFBb0IsQ0FBQyxDQUFDO0VBQzdCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQUssV0FBV0EsQ0FBQSxFQUFHO0lBQ1osSUFBSSxDQUFDWixZQUFZLEdBQUcsSUFBSTtJQUN4QixJQUFJLENBQUNPLG9CQUFvQixDQUFDLENBQUM7RUFDN0I7RUFDQTtFQUNBSixTQUFTQSxDQUFBLEVBQUc7SUFDVixPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUNKLGFBQWE7RUFDN0I7QUFDRixDOzs7Ozs7Ozs7Ozs7OztJQ3BGQSxJQUFJYyx3QkFBd0I7SUFBQ3hDLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLGdEQUFnRCxFQUFDO01BQUNRLE9BQU9BLENBQUNnQyxDQUFDLEVBQUM7UUFBQ0Qsd0JBQXdCLEdBQUNDLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJQyxhQUFhO0lBQUMxQyxNQUFNLENBQUNDLElBQUksQ0FBQyxzQ0FBc0MsRUFBQztNQUFDUSxPQUFPQSxDQUFDZ0MsQ0FBQyxFQUFDO1FBQUNDLGFBQWEsR0FBQ0QsQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLE1BQUFFLFNBQUE7TUFBQUMsVUFBQTtJQUE1TzVDLE1BQU0sQ0FBQ1EsTUFBTSxDQUFDO01BQUNxQyxVQUFVLEVBQUNBLENBQUEsS0FBSUE7SUFBVSxDQUFDLENBQUM7SUFBQyxJQUFJQyxNQUFNO0lBQUM5QyxNQUFNLENBQUNDLElBQUksQ0FBQyxlQUFlLEVBQUM7TUFBQzZDLE1BQU1BLENBQUNMLENBQUMsRUFBQztRQUFDSyxNQUFNLEdBQUNMLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJTSxTQUFTO0lBQUMvQyxNQUFNLENBQUNDLElBQUksQ0FBQyxtQkFBbUIsRUFBQztNQUFDOEMsU0FBU0EsQ0FBQ04sQ0FBQyxFQUFDO1FBQUNNLFNBQVMsR0FBQ04sQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlPLE9BQU87SUFBQ2hELE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLGdCQUFnQixFQUFDO01BQUMrQyxPQUFPQSxDQUFDUCxDQUFDLEVBQUM7UUFBQ08sT0FBTyxHQUFDUCxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSVEsS0FBSztJQUFDakQsTUFBTSxDQUFDQyxJQUFJLENBQUMsY0FBYyxFQUFDO01BQUNnRCxLQUFLQSxDQUFDUixDQUFDLEVBQUM7UUFBQ1EsS0FBSyxHQUFDUixDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSVMsTUFBTTtJQUFDbEQsTUFBTSxDQUFDQyxJQUFJLENBQUMsZUFBZSxFQUFDO01BQUNpRCxNQUFNQSxDQUFDVCxDQUFDLEVBQUM7UUFBQ1MsTUFBTSxHQUFDVCxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSVUsSUFBSTtJQUFDbkQsTUFBTSxDQUFDQyxJQUFJLENBQUMsc0JBQXNCLEVBQUM7TUFBQ2tELElBQUlBLENBQUNWLENBQUMsRUFBQztRQUFDVSxJQUFJLEdBQUNWLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJVyxPQUFPO0lBQUNwRCxNQUFNLENBQUNDLElBQUksQ0FBQyxpQkFBaUIsRUFBQztNQUFDbUQsT0FBT0EsQ0FBQ1gsQ0FBQyxFQUFDO1FBQUNXLE9BQU8sR0FBQ1gsQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUl2QyxHQUFHO0lBQUNGLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLGdCQUFnQixFQUFDO01BQUNDLEdBQUdBLENBQUN1QyxDQUFDLEVBQUM7UUFBQ3ZDLEdBQUcsR0FBQ3VDLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJL0IsYUFBYTtJQUFDVixNQUFNLENBQUNDLElBQUksQ0FBQyxvQkFBb0IsRUFBQztNQUFDUSxPQUFPQSxDQUFDZ0MsQ0FBQyxFQUFDO1FBQUMvQixhQUFhLEdBQUMrQixDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSVksTUFBTSxFQUFDQyxLQUFLLEVBQUNDLElBQUksRUFBQ0MsT0FBTyxFQUFDQyxJQUFJO0lBQUN6RCxNQUFNLENBQUNDLElBQUksQ0FBQyw0QkFBNEIsRUFBQztNQUFDb0QsTUFBTUEsQ0FBQ1osQ0FBQyxFQUFDO1FBQUNZLE1BQU0sR0FBQ1osQ0FBQztNQUFBLENBQUM7TUFBQ2EsS0FBS0EsQ0FBQ2IsQ0FBQyxFQUFDO1FBQUNhLEtBQUssR0FBQ2IsQ0FBQztNQUFBLENBQUM7TUFBQ2MsSUFBSUEsQ0FBQ2QsQ0FBQyxFQUFDO1FBQUNjLElBQUksR0FBQ2QsQ0FBQztNQUFBLENBQUM7TUFBQ2UsT0FBT0EsQ0FBQ2YsQ0FBQyxFQUFDO1FBQUNlLE9BQU8sR0FBQ2YsQ0FBQztNQUFBLENBQUM7TUFBQ2dCLElBQUlBLENBQUNoQixDQUFDLEVBQUM7UUFBQ2dCLElBQUksR0FBQ2hCLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJdEMsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTUEsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFpQm4zQixNQUFNdUQsVUFBVSxTQUFTQyxLQUFLLENBQUM7TUFDN0JoRCxXQUFXQSxDQUFBLEVBQUc7UUFDWixLQUFLLENBQUN5QyxPQUFPLENBQUNRLFdBQVcsRUFBRVIsT0FBTyxDQUFDUyxPQUFPLENBQUM7TUFDN0M7SUFDRjs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ08sTUFBTWhCLFVBQVUsQ0FBQztNQUN0QmxDLFdBQVdBLENBQUNtRCxHQUFHLEVBQUVsRCxPQUFPLEVBQUU7UUFDeEIsTUFBTU4sSUFBSSxHQUFHLElBQUk7UUFFakIsSUFBSSxDQUFDTSxPQUFPLEdBQUdBLE9BQU8sR0FBQThCLGFBQUE7VUFDcEJxQixXQUFXQSxDQUFBLEVBQUcsQ0FBQyxDQUFDO1VBQ2hCQyw4QkFBOEJBLENBQUNDLFdBQVcsRUFBRTtZQUMxQ25CLE1BQU0sQ0FBQ29CLE1BQU0sQ0FBQ0QsV0FBVyxDQUFDO1VBQzVCLENBQUM7VUFDREUsaUJBQWlCLEVBQUUsS0FBSztVQUN4QkMsZ0JBQWdCLEVBQUUsS0FBSztVQUN2QkMsY0FBYyxFQUFFQyxNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUM7VUFDbkM7VUFDQUMscUJBQXFCLEVBQUUsS0FBSztVQUM1QkMsb0JBQW9CLEVBQUUxQixTQUFTLENBQUMyQixzQkFBc0I7VUFDdERDLEtBQUssRUFBRSxJQUFJO1VBQ1hDLGNBQWMsRUFBRSxJQUFJO1VBQ3BCO1VBQ0FDLHNCQUFzQixFQUFFLENBQUM7VUFDekI7VUFDQUMsb0JBQW9CLEVBQUU7UUFBRyxHQUV0QmxFLE9BQU8sQ0FDWDs7UUFFRDtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0FOLElBQUksQ0FBQ3lFLFdBQVcsR0FBRyxJQUFJOztRQUV2QjtRQUNBLElBQUksT0FBT2pCLEdBQUcsS0FBSyxRQUFRLEVBQUU7VUFDM0J4RCxJQUFJLENBQUMwRSxPQUFPLEdBQUdsQixHQUFHO1FBQ3BCLENBQUMsTUFBTTtVQUNMLE1BQU07WUFBRW1CO1VBQWEsQ0FBQyxHQUFHQyxPQUFPLENBQUMsNkJBQTZCLENBQUM7VUFDL0Q1RSxJQUFJLENBQUMwRSxPQUFPLEdBQUcsSUFBSUMsWUFBWSxDQUFDbkIsR0FBRyxFQUFFO1lBQ25DYSxLQUFLLEVBQUUvRCxPQUFPLENBQUMrRCxLQUFLO1lBQ3BCUSxlQUFlLEVBQUVqRixHQUFHLENBQUNpRixlQUFlO1lBQ3BDQyxPQUFPLEVBQUV4RSxPQUFPLENBQUN3RSxPQUFPO1lBQ3hCQyxjQUFjLEVBQUV6RSxPQUFPLENBQUN5RSxjQUFjO1lBQ3RDO1lBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQUMsZ0JBQWdCLEVBQUUxRSxPQUFPLENBQUMwRSxnQkFBZ0I7WUFDMUNDLGdCQUFnQixFQUFFM0UsT0FBTyxDQUFDMkUsZ0JBQWdCO1lBQzFDbEIsY0FBYyxFQUFFekQsT0FBTyxDQUFDeUQ7VUFDMUIsQ0FBQyxDQUFDO1FBQ0o7UUFFQS9ELElBQUksQ0FBQ2tGLGNBQWMsR0FBRyxJQUFJO1FBQzFCbEYsSUFBSSxDQUFDbUYsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDaENuRixJQUFJLENBQUNvRixRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDdEJwRixJQUFJLENBQUNxRixPQUFPLEdBQUdyQixNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3BDakUsSUFBSSxDQUFDc0YsZUFBZSxHQUFHdEIsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUM1Q2pFLElBQUksQ0FBQ3VGLGFBQWEsR0FBRyxDQUFDO1FBQ3RCdkYsSUFBSSxDQUFDd0YscUJBQXFCLEdBQUdsRixPQUFPLENBQUM2RCxvQkFBb0I7UUFFekRuRSxJQUFJLENBQUN5RixrQkFBa0IsR0FBR25GLE9BQU8sQ0FBQ3VELGlCQUFpQjtRQUNuRDdELElBQUksQ0FBQzBGLGlCQUFpQixHQUFHcEYsT0FBTyxDQUFDd0QsZ0JBQWdCOztRQUVqRDtRQUNBO1FBQ0E7UUFDQTtRQUNBOUQsSUFBSSxDQUFDc0IsZUFBZSxHQUFHMEMsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDOztRQUUxQztRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQWpFLElBQUksQ0FBQzJGLHdCQUF3QixHQUFHLEVBQUU7O1FBRWxDO1FBQ0E7UUFDQTtRQUNBO1FBQ0EzRixJQUFJLENBQUM0Rix1QkFBdUIsR0FBRyxDQUFDLENBQUM7UUFDakM7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTVGLElBQUksQ0FBQzZGLGdCQUFnQixHQUFHLENBQUMsQ0FBQzs7UUFFMUI7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBN0YsSUFBSSxDQUFDOEYscUJBQXFCLEdBQUcsRUFBRTs7UUFFL0I7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBOUYsSUFBSSxDQUFDK0YsZ0NBQWdDLEdBQUcsRUFBRTtRQUMxQztRQUNBO1FBQ0E7UUFDQS9GLElBQUksQ0FBQzBCLDBCQUEwQixHQUFHLENBQUMsQ0FBQztRQUNwQztRQUNBO1FBQ0ExQixJQUFJLENBQUNnRyxpQkFBaUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdCO1FBQ0E7UUFDQWhHLElBQUksQ0FBQ2lHLFlBQVksR0FBRyxLQUFLOztRQUV6QjtRQUNBakcsSUFBSSxDQUFDa0csd0JBQXdCLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDO1FBQ0FsRyxJQUFJLENBQUNtRyxhQUFhLEdBQUcsSUFBSTtRQUV6Qm5HLElBQUksQ0FBQ29HLHFCQUFxQixHQUFHNUQsTUFBTSxDQUFDNkQsZUFBZSxDQUNqRHJHLElBQUksQ0FBQ3NHLG9CQUFvQixFQUN6Qiw4QkFBOEIsRUFDOUJ0RyxJQUNGLENBQUM7UUFDRDtRQUNBQSxJQUFJLENBQUN1RyxlQUFlLEdBQUcsQ0FBQyxDQUFDO1FBQ3pCO1FBQ0F2RyxJQUFJLENBQUN3RyxzQkFBc0IsR0FBRyxJQUFJO1FBQ2xDO1FBQ0F4RyxJQUFJLENBQUN5RywwQkFBMEIsR0FBRyxJQUFJO1FBRXRDekcsSUFBSSxDQUFDMEcsdUJBQXVCLEdBQUdwRyxPQUFPLENBQUNpRSxzQkFBc0I7UUFDN0R2RSxJQUFJLENBQUMyRyxxQkFBcUIsR0FBR3JHLE9BQU8sQ0FBQ2tFLG9CQUFvQjs7UUFFekQ7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBeEUsSUFBSSxDQUFDNEcsY0FBYyxHQUFHLENBQUMsQ0FBQzs7UUFFeEI7UUFDQTVHLElBQUksQ0FBQzZHLE9BQU8sR0FBRyxJQUFJO1FBQ25CN0csSUFBSSxDQUFDOEcsV0FBVyxHQUFHLElBQUlwRSxPQUFPLENBQUNxRSxVQUFVLENBQUMsQ0FBQzs7UUFFM0M7UUFDQSxJQUFJdkUsTUFBTSxDQUFDd0UsUUFBUSxJQUNqQkMsT0FBTyxDQUFDQyxNQUFNLElBQ2QsQ0FBRTVHLE9BQU8sQ0FBQzRELHFCQUFxQixFQUFFO1VBQ2pDK0MsT0FBTyxDQUFDQyxNQUFNLENBQUNDLE1BQU0sQ0FBQ0MsVUFBVSxDQUFDL0MsS0FBSyxJQUFJO1lBQ3hDLElBQUksQ0FBRXJFLElBQUksQ0FBQ3FILGVBQWUsQ0FBQyxDQUFDLEVBQUU7Y0FDNUJySCxJQUFJLENBQUNtRyxhQUFhLEdBQUc5QixLQUFLO2NBQzFCLE9BQU8sQ0FBQyxLQUFLLENBQUM7WUFDaEIsQ0FBQyxNQUFNO2NBQ0wsT0FBTyxDQUFDLElBQUksQ0FBQztZQUNmO1VBQ0YsQ0FBQyxDQUFDO1FBQ0o7UUFFQSxNQUFNaUQsWUFBWSxHQUFHQSxDQUFBLEtBQU07VUFDekIsSUFBSXRILElBQUksQ0FBQ3VILFVBQVUsRUFBRTtZQUNuQnZILElBQUksQ0FBQ3VILFVBQVUsQ0FBQ0MsSUFBSSxDQUFDLENBQUM7WUFDdEJ4SCxJQUFJLENBQUN1SCxVQUFVLEdBQUcsSUFBSTtVQUN4QjtRQUNGLENBQUM7UUFFRCxJQUFJL0UsTUFBTSxDQUFDaUYsUUFBUSxFQUFFO1VBQ25CekgsSUFBSSxDQUFDMEUsT0FBTyxDQUFDZ0QsRUFBRSxDQUNiLFNBQVMsRUFDVGxGLE1BQU0sQ0FBQzZELGVBQWUsQ0FDcEIsSUFBSSxDQUFDc0IsU0FBUyxDQUFDQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQ3pCLHNCQUNGLENBQ0YsQ0FBQztVQUNENUgsSUFBSSxDQUFDMEUsT0FBTyxDQUFDZ0QsRUFBRSxDQUNiLE9BQU8sRUFDUGxGLE1BQU0sQ0FBQzZELGVBQWUsQ0FBQyxJQUFJLENBQUN3QixPQUFPLENBQUNELElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxvQkFBb0IsQ0FDdEUsQ0FBQztVQUNENUgsSUFBSSxDQUFDMEUsT0FBTyxDQUFDZ0QsRUFBRSxDQUNiLFlBQVksRUFDWmxGLE1BQU0sQ0FBQzZELGVBQWUsQ0FBQ2lCLFlBQVksRUFBRSx5QkFBeUIsQ0FDaEUsQ0FBQztRQUNILENBQUMsTUFBTTtVQUNMdEgsSUFBSSxDQUFDMEUsT0FBTyxDQUFDZ0QsRUFBRSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUNDLFNBQVMsQ0FBQ0MsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1VBQ3JENUgsSUFBSSxDQUFDMEUsT0FBTyxDQUFDZ0QsRUFBRSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUNHLE9BQU8sQ0FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1VBQ2pENUgsSUFBSSxDQUFDMEUsT0FBTyxDQUFDZ0QsRUFBRSxDQUFDLFlBQVksRUFBRUosWUFBWSxDQUFDO1FBQzdDO01BQ0Y7O01BRUE7TUFDQTtNQUNBO01BQ0FRLGtCQUFrQkEsQ0FBQ0MsSUFBSSxFQUFFQyxZQUFZLEVBQUU7UUFDckMsTUFBTWhJLElBQUksR0FBRyxJQUFJO1FBRWpCLElBQUkrSCxJQUFJLElBQUkvSCxJQUFJLENBQUNxRixPQUFPLEVBQUUsT0FBTyxLQUFLOztRQUV0QztRQUNBO1FBQ0EsTUFBTTRDLEtBQUssR0FBR2pFLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNqQyxNQUFNaUUsV0FBVyxHQUFHLENBQ2xCLFFBQVEsRUFDUixhQUFhLEVBQ2IsV0FBVyxFQUNYLGVBQWUsRUFDZixtQkFBbUIsRUFDbkIsUUFBUSxFQUNSLGdCQUFnQixDQUNqQjtRQUNEQSxXQUFXLENBQUNDLE9BQU8sQ0FBRUMsTUFBTSxJQUFLO1VBQzlCSCxLQUFLLENBQUNHLE1BQU0sQ0FBQyxHQUFHLFlBQWE7WUFDM0IsSUFBSUosWUFBWSxDQUFDSSxNQUFNLENBQUMsRUFBRTtjQUN4QixPQUFPSixZQUFZLENBQUNJLE1BQU0sQ0FBQyxDQUFDLEdBQUFDLFNBQU8sQ0FBQztZQUN0QztVQUNGLENBQUM7UUFDSCxDQUFDLENBQUM7UUFDRnJJLElBQUksQ0FBQ3FGLE9BQU8sQ0FBQzBDLElBQUksQ0FBQyxHQUFHRSxLQUFLO1FBQzFCLE9BQU9BLEtBQUs7TUFDZDtNQUVBSyxtQkFBbUJBLENBQUNQLElBQUksRUFBRUMsWUFBWSxFQUFFO1FBQ3RDLE1BQU1oSSxJQUFJLEdBQUcsSUFBSTtRQUVqQixNQUFNaUksS0FBSyxHQUFHakksSUFBSSxDQUFDOEgsa0JBQWtCLENBQUNDLElBQUksRUFBRUMsWUFBWSxDQUFDO1FBRXpELE1BQU1PLE1BQU0sR0FBR3ZJLElBQUksQ0FBQ2tHLHdCQUF3QixDQUFDNkIsSUFBSSxDQUFDO1FBQ2xELElBQUlTLEtBQUssQ0FBQ0MsT0FBTyxDQUFDRixNQUFNLENBQUMsRUFBRTtVQUN6Qk4sS0FBSyxDQUFDUyxXQUFXLENBQUNILE1BQU0sQ0FBQ0ksTUFBTSxFQUFFLEtBQUssQ0FBQztVQUN2Q0osTUFBTSxDQUFDSixPQUFPLENBQUNTLEdBQUcsSUFBSTtZQUNwQlgsS0FBSyxDQUFDWSxNQUFNLENBQUNELEdBQUcsQ0FBQztVQUNuQixDQUFDLENBQUM7VUFDRlgsS0FBSyxDQUFDYSxTQUFTLENBQUMsQ0FBQztVQUNqQixPQUFPOUksSUFBSSxDQUFDa0csd0JBQXdCLENBQUM2QixJQUFJLENBQUM7UUFDNUM7UUFFQSxPQUFPLElBQUk7TUFDYjtNQUNBLE1BQU1nQixtQkFBbUJBLENBQUNoQixJQUFJLEVBQUVDLFlBQVksRUFBRTtRQUM1QyxNQUFNaEksSUFBSSxHQUFHLElBQUk7UUFFakIsTUFBTWlJLEtBQUssR0FBR2pJLElBQUksQ0FBQzhILGtCQUFrQixDQUFDQyxJQUFJLEVBQUVDLFlBQVksQ0FBQztRQUV6RCxNQUFNTyxNQUFNLEdBQUd2SSxJQUFJLENBQUNrRyx3QkFBd0IsQ0FBQzZCLElBQUksQ0FBQztRQUNsRCxJQUFJUyxLQUFLLENBQUNDLE9BQU8sQ0FBQ0YsTUFBTSxDQUFDLEVBQUU7VUFDekIsTUFBTU4sS0FBSyxDQUFDUyxXQUFXLENBQUNILE1BQU0sQ0FBQ0ksTUFBTSxFQUFFLEtBQUssQ0FBQztVQUM3QyxLQUFLLE1BQU1DLEdBQUcsSUFBSUwsTUFBTSxFQUFFO1lBQ3hCLE1BQU1OLEtBQUssQ0FBQ1ksTUFBTSxDQUFDRCxHQUFHLENBQUM7VUFDekI7VUFDQSxNQUFNWCxLQUFLLENBQUNhLFNBQVMsQ0FBQyxDQUFDO1VBQ3ZCLE9BQU85SSxJQUFJLENBQUNrRyx3QkFBd0IsQ0FBQzZCLElBQUksQ0FBQztRQUM1QztRQUVBLE9BQU8sSUFBSTtNQUNiOztNQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0VpQixTQUFTQSxDQUFDakIsSUFBSSxDQUFDLDhDQUE4QztRQUMzRCxNQUFNL0gsSUFBSSxHQUFHLElBQUk7UUFFakIsTUFBTWlKLE1BQU0sR0FBR2pHLEtBQUssQ0FBQ2tHLElBQUksQ0FBQ2IsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUN2QyxJQUFJYyxTQUFTLEdBQUduRixNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDbkMsSUFBSWdGLE1BQU0sQ0FBQ04sTUFBTSxFQUFFO1VBQ2pCLE1BQU1TLFNBQVMsR0FBR0gsTUFBTSxDQUFDQSxNQUFNLENBQUNOLE1BQU0sR0FBRyxDQUFDLENBQUM7VUFDM0MsSUFBSSxPQUFPUyxTQUFTLEtBQUssVUFBVSxFQUFFO1lBQ25DRCxTQUFTLENBQUNFLE9BQU8sR0FBR0osTUFBTSxDQUFDSyxHQUFHLENBQUMsQ0FBQztVQUNsQyxDQUFDLE1BQU0sSUFBSUYsU0FBUyxJQUFJLENBQ3RCQSxTQUFTLENBQUNDLE9BQU87VUFDakI7VUFDQTtVQUNBRCxTQUFTLENBQUNHLE9BQU8sRUFDakJILFNBQVMsQ0FBQ0ksTUFBTSxDQUNqQixDQUFDQyxJQUFJLENBQUNDLENBQUMsSUFBSSxPQUFPQSxDQUFDLEtBQUssVUFBVSxDQUFDLEVBQUU7WUFDcENQLFNBQVMsR0FBR0YsTUFBTSxDQUFDSyxHQUFHLENBQUMsQ0FBQztVQUMxQjtRQUNGOztRQUVBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBLE1BQU1LLFFBQVEsR0FBRzNGLE1BQU0sQ0FBQzRGLE1BQU0sQ0FBQzVKLElBQUksQ0FBQzRHLGNBQWMsQ0FBQyxDQUFDaUQsSUFBSSxDQUN0REMsR0FBRyxJQUFLQSxHQUFHLENBQUNDLFFBQVEsSUFBSUQsR0FBRyxDQUFDL0IsSUFBSSxLQUFLQSxJQUFJLElBQUlwRixLQUFLLENBQUNxSCxNQUFNLENBQUNGLEdBQUcsQ0FBQ2IsTUFBTSxFQUFFQSxNQUFNLENBQzlFLENBQUM7UUFFRCxJQUFJZ0IsRUFBRTtRQUNOLElBQUlOLFFBQVEsRUFBRTtVQUNaTSxFQUFFLEdBQUdOLFFBQVEsQ0FBQ00sRUFBRTtVQUNoQk4sUUFBUSxDQUFDSSxRQUFRLEdBQUcsS0FBSyxDQUFDLENBQUM7O1VBRTNCLElBQUlaLFNBQVMsQ0FBQ0UsT0FBTyxFQUFFO1lBQ3JCO1lBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBLElBQUlNLFFBQVEsQ0FBQ08sS0FBSyxFQUFFO2NBQ2xCZixTQUFTLENBQUNFLE9BQU8sQ0FBQyxDQUFDO1lBQ3JCLENBQUMsTUFBTTtjQUNMTSxRQUFRLENBQUNRLGFBQWEsR0FBR2hCLFNBQVMsQ0FBQ0UsT0FBTztZQUM1QztVQUNGOztVQUVBO1VBQ0E7VUFDQSxJQUFJRixTQUFTLENBQUNJLE9BQU8sRUFBRTtZQUNyQjtZQUNBO1lBQ0FJLFFBQVEsQ0FBQ1MsYUFBYSxHQUFHakIsU0FBUyxDQUFDSSxPQUFPO1VBQzVDO1VBRUEsSUFBSUosU0FBUyxDQUFDSyxNQUFNLEVBQUU7WUFDcEJHLFFBQVEsQ0FBQ1UsWUFBWSxHQUFHbEIsU0FBUyxDQUFDSyxNQUFNO1VBQzFDO1FBQ0YsQ0FBQyxNQUFNO1VBQ0w7VUFDQVMsRUFBRSxHQUFHckgsTUFBTSxDQUFDcUgsRUFBRSxDQUFDLENBQUM7VUFDaEJqSyxJQUFJLENBQUM0RyxjQUFjLENBQUNxRCxFQUFFLENBQUMsR0FBRztZQUN4QkEsRUFBRSxFQUFFQSxFQUFFO1lBQ05sQyxJQUFJLEVBQUVBLElBQUk7WUFDVmtCLE1BQU0sRUFBRXRHLEtBQUssQ0FBQzJILEtBQUssQ0FBQ3JCLE1BQU0sQ0FBQztZQUMzQmMsUUFBUSxFQUFFLEtBQUs7WUFDZkcsS0FBSyxFQUFFLEtBQUs7WUFDWkssU0FBUyxFQUFFLElBQUk3SCxPQUFPLENBQUNxRSxVQUFVLENBQUMsQ0FBQztZQUNuQ29ELGFBQWEsRUFBRWhCLFNBQVMsQ0FBQ0UsT0FBTztZQUNoQztZQUNBZSxhQUFhLEVBQUVqQixTQUFTLENBQUNJLE9BQU87WUFDaENjLFlBQVksRUFBRWxCLFNBQVMsQ0FBQ0ssTUFBTTtZQUM5QjVJLFVBQVUsRUFBRVosSUFBSTtZQUNoQndLLE1BQU1BLENBQUEsRUFBRztjQUNQLE9BQU8sSUFBSSxDQUFDNUosVUFBVSxDQUFDZ0csY0FBYyxDQUFDLElBQUksQ0FBQ3FELEVBQUUsQ0FBQztjQUM5QyxJQUFJLENBQUNDLEtBQUssSUFBSSxJQUFJLENBQUNLLFNBQVMsQ0FBQ0UsT0FBTyxDQUFDLENBQUM7WUFDeEMsQ0FBQztZQUNEakQsSUFBSUEsQ0FBQSxFQUFHO2NBQ0wsSUFBSSxDQUFDNUcsVUFBVSxDQUFDZSxLQUFLLENBQUM7Z0JBQUVpSCxHQUFHLEVBQUUsT0FBTztnQkFBRXFCLEVBQUUsRUFBRUE7Y0FBRyxDQUFDLENBQUM7Y0FDL0MsSUFBSSxDQUFDTyxNQUFNLENBQUMsQ0FBQztjQUViLElBQUlyQixTQUFTLENBQUNLLE1BQU0sRUFBRTtnQkFDcEJMLFNBQVMsQ0FBQ0ssTUFBTSxDQUFDLENBQUM7Y0FDcEI7WUFDRjtVQUNGLENBQUM7VUFDRHhKLElBQUksQ0FBQzJCLEtBQUssQ0FBQztZQUFFaUgsR0FBRyxFQUFFLEtBQUs7WUFBRXFCLEVBQUUsRUFBRUEsRUFBRTtZQUFFbEMsSUFBSSxFQUFFQSxJQUFJO1lBQUVrQixNQUFNLEVBQUVBO1VBQU8sQ0FBQyxDQUFDO1FBQ2hFOztRQUVBO1FBQ0EsTUFBTXlCLE1BQU0sR0FBRztVQUNibEQsSUFBSUEsQ0FBQSxFQUFHO1lBQ0wsSUFBSSxDQUFFekUsTUFBTSxDQUFDbUcsSUFBSSxDQUFDbEosSUFBSSxDQUFDNEcsY0FBYyxFQUFFcUQsRUFBRSxDQUFDLEVBQUU7Y0FDMUM7WUFDRjtZQUNBakssSUFBSSxDQUFDNEcsY0FBYyxDQUFDcUQsRUFBRSxDQUFDLENBQUN6QyxJQUFJLENBQUMsQ0FBQztVQUNoQyxDQUFDO1VBQ0QwQyxLQUFLQSxDQUFBLEVBQUc7WUFDTjtZQUNBLElBQUksQ0FBQ25ILE1BQU0sQ0FBQ21HLElBQUksQ0FBQ2xKLElBQUksQ0FBQzRHLGNBQWMsRUFBRXFELEVBQUUsQ0FBQyxFQUFFO2NBQ3pDLE9BQU8sS0FBSztZQUNkO1lBQ0EsTUFBTVUsTUFBTSxHQUFHM0ssSUFBSSxDQUFDNEcsY0FBYyxDQUFDcUQsRUFBRSxDQUFDO1lBQ3RDVSxNQUFNLENBQUNKLFNBQVMsQ0FBQ0ssTUFBTSxDQUFDLENBQUM7WUFDekIsT0FBT0QsTUFBTSxDQUFDVCxLQUFLO1VBQ3JCLENBQUM7VUFDRFcsY0FBYyxFQUFFWjtRQUNsQixDQUFDO1FBRUQsSUFBSXZILE9BQU8sQ0FBQ29JLE1BQU0sRUFBRTtVQUNsQjtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQXBJLE9BQU8sQ0FBQ3FJLFlBQVksQ0FBRUMsQ0FBQyxJQUFLO1lBQzFCLElBQUlqSSxNQUFNLENBQUNtRyxJQUFJLENBQUNsSixJQUFJLENBQUM0RyxjQUFjLEVBQUVxRCxFQUFFLENBQUMsRUFBRTtjQUN4Q2pLLElBQUksQ0FBQzRHLGNBQWMsQ0FBQ3FELEVBQUUsQ0FBQyxDQUFDRixRQUFRLEdBQUcsSUFBSTtZQUN6QztZQUVBckgsT0FBTyxDQUFDdUksVUFBVSxDQUFDLE1BQU07Y0FDdkIsSUFBSWxJLE1BQU0sQ0FBQ21HLElBQUksQ0FBQ2xKLElBQUksQ0FBQzRHLGNBQWMsRUFBRXFELEVBQUUsQ0FBQyxJQUNwQ2pLLElBQUksQ0FBQzRHLGNBQWMsQ0FBQ3FELEVBQUUsQ0FBQyxDQUFDRixRQUFRLEVBQUU7Z0JBQ3BDVyxNQUFNLENBQUNsRCxJQUFJLENBQUMsQ0FBQztjQUNmO1lBQ0YsQ0FBQyxDQUFDO1VBQ0osQ0FBQyxDQUFDO1FBQ0o7UUFFQSxPQUFPa0QsTUFBTTtNQUNmOztNQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7TUFDRVEsV0FBV0EsQ0FBQSxFQUFFO1FBQ1gsT0FBT3RMLEdBQUcsQ0FBQ3VMLHdCQUF3QixDQUFDQyx5QkFBeUIsQ0FBQyxDQUFDO01BQ2pFO01BQ0FDLE9BQU9BLENBQUNBLE9BQU8sRUFBRTtRQUNmckgsTUFBTSxDQUFDc0gsT0FBTyxDQUFDRCxPQUFPLENBQUMsQ0FBQ2xELE9BQU8sQ0FBQ29ELElBQUEsSUFBa0I7VUFBQSxJQUFqQixDQUFDeEQsSUFBSSxFQUFFeUQsSUFBSSxDQUFDLEdBQUFELElBQUE7VUFDM0MsSUFBSSxPQUFPQyxJQUFJLEtBQUssVUFBVSxFQUFFO1lBQzlCLE1BQU0sSUFBSS9KLEtBQUssQ0FBQyxVQUFVLEdBQUdzRyxJQUFJLEdBQUcsc0JBQXNCLENBQUM7VUFDN0Q7VUFDQSxJQUFJLElBQUksQ0FBQ3pDLGVBQWUsQ0FBQ3lDLElBQUksQ0FBQyxFQUFFO1lBQzlCLE1BQU0sSUFBSXRHLEtBQUssQ0FBQyxrQkFBa0IsR0FBR3NHLElBQUksR0FBRyxzQkFBc0IsQ0FBQztVQUNyRTtVQUNBLElBQUksQ0FBQ3pDLGVBQWUsQ0FBQ3lDLElBQUksQ0FBQyxHQUFHeUQsSUFBSTtRQUNuQyxDQUFDLENBQUM7TUFDSjtNQUVBQyxnQkFBZ0JBLENBQUFDLEtBQUEsRUFBeUM7UUFBQSxJQUF4QztVQUFDQyxlQUFlO1VBQUVDO1FBQW1CLENBQUMsR0FBQUYsS0FBQTtRQUNyRCxJQUFJLENBQUNDLGVBQWUsRUFBRTtVQUNwQixPQUFPQyxtQkFBbUI7UUFDNUI7UUFDQSxPQUFPQSxtQkFBbUIsSUFBSWhNLEdBQUcsQ0FBQ3VMLHdCQUF3QixDQUFDQyx5QkFBeUIsQ0FBQyxDQUFDO01BQ3hGOztNQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0VsQyxJQUFJQSxDQUFDbkIsSUFBSSxDQUFDLGtDQUFrQztRQUMxQztRQUNBO1FBQ0EsTUFBTThELElBQUksR0FBRzdJLEtBQUssQ0FBQ2tHLElBQUksQ0FBQ2IsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUNyQyxJQUFJM0gsUUFBUTtRQUNaLElBQUltTCxJQUFJLENBQUNsRCxNQUFNLElBQUksT0FBT2tELElBQUksQ0FBQ0EsSUFBSSxDQUFDbEQsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLFVBQVUsRUFBRTtVQUM5RGpJLFFBQVEsR0FBR21MLElBQUksQ0FBQ3ZDLEdBQUcsQ0FBQyxDQUFDO1FBQ3ZCO1FBQ0EsT0FBTyxJQUFJLENBQUN3QyxLQUFLLENBQUMvRCxJQUFJLEVBQUU4RCxJQUFJLEVBQUVuTCxRQUFRLENBQUM7TUFDekM7TUFDQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtNQUNFcUwsU0FBU0EsQ0FBQ2hFLElBQUksQ0FBQyx5QkFBeUI7UUFDdEMsTUFBTThELElBQUksR0FBRzdJLEtBQUssQ0FBQ2tHLElBQUksQ0FBQ2IsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUNyQyxJQUFJd0QsSUFBSSxDQUFDbEQsTUFBTSxJQUFJLE9BQU9rRCxJQUFJLENBQUNBLElBQUksQ0FBQ2xELE1BQU0sR0FBRyxDQUFDLENBQUMsS0FBSyxVQUFVLEVBQUU7VUFDOUQsTUFBTSxJQUFJbEgsS0FBSyxDQUNiLCtGQUNGLENBQUM7UUFDSDtRQUVBLE9BQU8sSUFBSSxDQUFDdUssVUFBVSxDQUFDakUsSUFBSSxFQUFFOEQsSUFBSSxFQUFFO1VBQUVJLHlCQUF5QixFQUFFO1FBQUssQ0FBQyxDQUFDO01BQ3pFOztNQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0VILEtBQUtBLENBQUMvRCxJQUFJLEVBQUU4RCxJQUFJLEVBQUV2TCxPQUFPLEVBQUVJLFFBQVEsRUFBRTtRQUNuQyxNQUFBd0wsZUFBQSxHQUF1RCxJQUFJLENBQUNDLFNBQVMsQ0FBQ3BFLElBQUksRUFBRXBGLEtBQUssQ0FBQzJILEtBQUssQ0FBQ3VCLElBQUksQ0FBQyxDQUFDO1VBQXhGO1lBQUVPLGNBQWM7WUFBRUM7VUFBMkIsQ0FBQyxHQUFBSCxlQUFBO1VBQWJJLFdBQVcsR0FBQXBLLHdCQUFBLENBQUFnSyxlQUFBLEVBQUE3SixTQUFBO1FBRWxELElBQUlpSyxXQUFXLENBQUNDLE9BQU8sRUFBRTtVQUN2QixJQUNFLENBQUMsSUFBSSxDQUFDZCxnQkFBZ0IsQ0FBQztZQUNyQkcsbUJBQW1CLEVBQUVVLFdBQVcsQ0FBQ1YsbUJBQW1CO1lBQ3BERCxlQUFlLEVBQUVXLFdBQVcsQ0FBQ1g7VUFDL0IsQ0FBQyxDQUFDLEVBQ0Y7WUFDQSxJQUFJLENBQUNhLGNBQWMsQ0FBQyxDQUFDO1VBQ3ZCO1VBQ0EsSUFBSTtZQUNGRixXQUFXLENBQUNHLGVBQWUsR0FBRzdNLEdBQUcsQ0FBQ3VMLHdCQUF3QixDQUN2RHVCLFNBQVMsQ0FBQ0wsVUFBVSxFQUFFRCxjQUFjLENBQUM7VUFDMUMsQ0FBQyxDQUFDLE9BQU9PLENBQUMsRUFBRTtZQUNWTCxXQUFXLENBQUNNLFNBQVMsR0FBR0QsQ0FBQztVQUMzQjtRQUNGO1FBQ0EsT0FBTyxJQUFJLENBQUNFLE1BQU0sQ0FBQzlFLElBQUksRUFBRXVFLFdBQVcsRUFBRVQsSUFBSSxFQUFFdkwsT0FBTyxFQUFFSSxRQUFRLENBQUM7TUFDaEU7O01BRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0VzTCxVQUFVQSxDQUFDakUsSUFBSSxFQUFFOEQsSUFBSSxFQUFFdkwsT0FBTyxFQUFtQjtRQUFBLElBQWpCSSxRQUFRLEdBQUEySCxTQUFBLENBQUFNLE1BQUEsUUFBQU4sU0FBQSxRQUFBeUUsU0FBQSxHQUFBekUsU0FBQSxNQUFHLElBQUk7UUFDN0MsTUFBTTBFLFdBQVcsR0FBRyxJQUFJLENBQUNDLHlCQUF5QixDQUFDakYsSUFBSSxFQUFFOEQsSUFBSSxFQUFFdkwsT0FBTyxDQUFDO1FBRXZFLE1BQU0yTSxPQUFPLEdBQUcsSUFBSSxDQUFDQyxXQUFXLENBQUM7VUFDL0JuRixJQUFJO1VBQ0o4RCxJQUFJO1VBQ0p2TCxPQUFPO1VBQ1BJLFFBQVE7VUFDUnFNO1FBQ0YsQ0FBQyxDQUFDO1FBQ0YsSUFBSXZLLE1BQU0sQ0FBQ3dFLFFBQVEsRUFBRTtVQUNuQjtVQUNBaUcsT0FBTyxDQUFDRixXQUFXLEdBQUdBLFdBQVcsQ0FBQ0ksSUFBSSxDQUFDQyxDQUFDLElBQUlBLENBQUMsQ0FBQ1gsZUFBZSxDQUFDO1VBQzlEO1VBQ0FRLE9BQU8sQ0FBQ0ksYUFBYSxHQUFHLElBQUlDLE9BQU8sQ0FBQyxDQUFDQyxPQUFPLEVBQUVDLE1BQU0sS0FDbERQLE9BQU8sQ0FBQ0UsSUFBSSxDQUFDSSxPQUFPLENBQUMsQ0FBQ0UsS0FBSyxDQUFDRCxNQUFNLENBQ3BDLENBQUM7UUFDSDtRQUNBLE9BQU9QLE9BQU87TUFDaEI7TUFDQSxNQUFNRCx5QkFBeUJBLENBQUNqRixJQUFJLEVBQUU4RCxJQUFJLEVBQUV2TCxPQUFPLEVBQUU7UUFDbkQsTUFBQW9OLGdCQUFBLEdBQXVELElBQUksQ0FBQ3ZCLFNBQVMsQ0FBQ3BFLElBQUksRUFBRXBGLEtBQUssQ0FBQzJILEtBQUssQ0FBQ3VCLElBQUksQ0FBQyxFQUFFdkwsT0FBTyxDQUFDO1VBQWpHO1lBQUU4TCxjQUFjO1lBQUVDO1VBQTJCLENBQUMsR0FBQXFCLGdCQUFBO1VBQWJwQixXQUFXLEdBQUFwSyx3QkFBQSxDQUFBd0wsZ0JBQUEsRUFBQXBMLFVBQUE7UUFDbEQsSUFBSWdLLFdBQVcsQ0FBQ0MsT0FBTyxFQUFFO1VBQ3ZCLElBQ0UsQ0FBQyxJQUFJLENBQUNkLGdCQUFnQixDQUFDO1lBQ3JCRyxtQkFBbUIsRUFBRVUsV0FBVyxDQUFDVixtQkFBbUI7WUFDcERELGVBQWUsRUFBRVcsV0FBVyxDQUFDWDtVQUMvQixDQUFDLENBQUMsRUFDRjtZQUNBLElBQUksQ0FBQ2EsY0FBYyxDQUFDLENBQUM7VUFDdkI7VUFDQSxJQUFJO1lBQ0Y7QUFDUjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtZQUNRLE1BQU1tQixjQUFjLEdBQUcvTixHQUFHLENBQUN1TCx3QkFBd0IsQ0FBQ3lDLDJCQUEyQixDQUM3RXZCLFVBQ0YsQ0FBQztZQUNELElBQUk7Y0FDRkMsV0FBVyxDQUFDRyxlQUFlLEdBQUcsTUFBTUwsY0FBYyxDQUFDLENBQUM7WUFDdEQsQ0FBQyxDQUFDLE9BQU9PLENBQUMsRUFBRTtjQUNWTCxXQUFXLENBQUNNLFNBQVMsR0FBR0QsQ0FBQztZQUMzQixDQUFDLFNBQVM7Y0FDUi9NLEdBQUcsQ0FBQ3VMLHdCQUF3QixDQUFDMEMsSUFBSSxDQUFDRixjQUFjLENBQUM7WUFDbkQ7VUFDRixDQUFDLENBQUMsT0FBT2hCLENBQUMsRUFBRTtZQUNWTCxXQUFXLENBQUNNLFNBQVMsR0FBR0QsQ0FBQztVQUMzQjtRQUNGO1FBQ0EsT0FBT0wsV0FBVztNQUNwQjtNQUNBLE1BQU1ZLFdBQVdBLENBQUFZLEtBQUEsRUFBaUQ7UUFBQSxJQUFoRDtVQUFFL0YsSUFBSTtVQUFFOEQsSUFBSTtVQUFFdkwsT0FBTztVQUFFSSxRQUFRO1VBQUVxTTtRQUFZLENBQUMsR0FBQWUsS0FBQTtRQUM5RCxNQUFNeEIsV0FBVyxHQUFHLE1BQU1TLFdBQVc7UUFDckMsT0FBTyxJQUFJLENBQUNGLE1BQU0sQ0FBQzlFLElBQUksRUFBRXVFLFdBQVcsRUFBRVQsSUFBSSxFQUFFdkwsT0FBTyxFQUFFSSxRQUFRLENBQUM7TUFDaEU7TUFFQW1NLE1BQU1BLENBQUM5RSxJQUFJLEVBQUVnRyxhQUFhLEVBQUVsQyxJQUFJLEVBQUV2TCxPQUFPLEVBQUVJLFFBQVEsRUFBRTtRQUNuRCxNQUFNVixJQUFJLEdBQUcsSUFBSTtRQUNqQjtRQUNBO1FBQ0EsSUFBSSxDQUFDVSxRQUFRLElBQUksT0FBT0osT0FBTyxLQUFLLFVBQVUsRUFBRTtVQUM5Q0ksUUFBUSxHQUFHSixPQUFPO1VBQ2xCQSxPQUFPLEdBQUcwRCxNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDL0I7UUFDQTNELE9BQU8sR0FBR0EsT0FBTyxJQUFJMEQsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDO1FBRXhDLElBQUl2RCxRQUFRLEVBQUU7VUFDWjtVQUNBO1VBQ0E7VUFDQUEsUUFBUSxHQUFHOEIsTUFBTSxDQUFDNkQsZUFBZSxDQUMvQjNGLFFBQVEsRUFDUixpQ0FBaUMsR0FBR3FILElBQUksR0FBRyxHQUM3QyxDQUFDO1FBQ0g7UUFDQSxNQUFNO1VBQ0p3RSxPQUFPO1VBQ1BLLFNBQVM7VUFDVEgsZUFBZTtVQUNmYixtQkFBbUI7VUFDbkJvQztRQUNGLENBQUMsR0FBR0QsYUFBYTs7UUFFakI7UUFDQTtRQUNBbEMsSUFBSSxHQUFHbEosS0FBSyxDQUFDMkgsS0FBSyxDQUFDdUIsSUFBSSxDQUFDO1FBQ3hCO1FBQ0E7UUFDQTtRQUNBLElBQ0UsSUFBSSxDQUFDSixnQkFBZ0IsQ0FBQztVQUNwQkcsbUJBQW1CO1VBQ25CRCxlQUFlLEVBQUVvQyxhQUFhLENBQUNwQztRQUNqQyxDQUFDLENBQUMsRUFDRjtVQUNBLElBQUlqTCxRQUFRLEVBQUU7WUFDWkEsUUFBUSxDQUFDa00sU0FBUyxFQUFFSCxlQUFlLENBQUM7WUFDcEMsT0FBT0ssU0FBUztVQUNsQjtVQUNBLElBQUlGLFNBQVMsRUFBRSxNQUFNQSxTQUFTO1VBQzlCLE9BQU9ILGVBQWU7UUFDeEI7O1FBRUE7UUFDQTtRQUNBLE1BQU1sTSxRQUFRLEdBQUcsRUFBRSxHQUFHUCxJQUFJLENBQUN1RixhQUFhLEVBQUU7UUFDMUMsSUFBSWdILE9BQU8sRUFBRTtVQUNYdk0sSUFBSSxDQUFDaU8sMEJBQTBCLENBQUMxTixRQUFRLENBQUM7UUFDM0M7O1FBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQSxNQUFNTyxPQUFPLEdBQUc7VUFDZDhILEdBQUcsRUFBRSxRQUFRO1VBQ2JxQixFQUFFLEVBQUUxSixRQUFRO1VBQ1o2SCxNQUFNLEVBQUVMLElBQUk7VUFDWmtCLE1BQU0sRUFBRTRDO1FBQ1YsQ0FBQzs7UUFFRDtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBLElBQUllLFNBQVMsRUFBRTtVQUNiLElBQUl0TSxPQUFPLENBQUM0TixtQkFBbUIsRUFBRTtZQUMvQixNQUFNdEIsU0FBUztVQUNqQixDQUFDLE1BQU0sSUFBSSxDQUFDQSxTQUFTLENBQUN1QixlQUFlLEVBQUU7WUFDckMzTCxNQUFNLENBQUNvQixNQUFNLENBQ1gscURBQXFELEdBQUdtRSxJQUFJLEdBQUcsR0FBRyxFQUNsRTZFLFNBQ0YsQ0FBQztVQUNIO1FBQ0Y7O1FBRUE7UUFDQTs7UUFFQTtRQUNBLElBQUl3QixNQUFNO1FBQ1YsSUFBSSxDQUFDMU4sUUFBUSxFQUFFO1VBQ2IsSUFDRThCLE1BQU0sQ0FBQ3dFLFFBQVEsSUFDZixDQUFDMUcsT0FBTyxDQUFDMkwseUJBQXlCLEtBQ2pDLENBQUMzTCxPQUFPLENBQUNxTCxlQUFlLElBQUlyTCxPQUFPLENBQUMrTixlQUFlLENBQUMsRUFDckQ7WUFDQTtZQUNBO1lBQ0E7WUFDQTtZQUNBM04sUUFBUSxHQUFJcUIsR0FBRyxJQUFLO2NBQ2xCQSxHQUFHLElBQUlTLE1BQU0sQ0FBQ29CLE1BQU0sQ0FBQyx5QkFBeUIsR0FBR21FLElBQUksR0FBRyxHQUFHLEVBQUVoRyxHQUFHLENBQUM7WUFDbkUsQ0FBQztVQUNILENBQUMsTUFBTTtZQUNMO1lBQ0E7WUFDQXFNLE1BQU0sR0FBRyxJQUFJZCxPQUFPLENBQUMsQ0FBQ0MsT0FBTyxFQUFFQyxNQUFNLEtBQUs7Y0FDeEM5TSxRQUFRLEdBQUcsU0FBQUEsQ0FBQSxFQUFnQjtnQkFBQSxTQUFBNE4sSUFBQSxHQUFBakcsU0FBQSxDQUFBTSxNQUFBLEVBQVo0RixPQUFPLE9BQUEvRixLQUFBLENBQUE4RixJQUFBLEdBQUFFLElBQUEsTUFBQUEsSUFBQSxHQUFBRixJQUFBLEVBQUFFLElBQUE7a0JBQVBELE9BQU8sQ0FBQUMsSUFBQSxJQUFBbkcsU0FBQSxDQUFBbUcsSUFBQTtnQkFBQTtnQkFDcEIsSUFBSTNDLElBQUksR0FBR3JELEtBQUssQ0FBQ2lHLElBQUksQ0FBQ0YsT0FBTyxDQUFDO2dCQUM5QixJQUFJeE0sR0FBRyxHQUFHOEosSUFBSSxDQUFDNkMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RCLElBQUkzTSxHQUFHLEVBQUU7a0JBQ1B5TCxNQUFNLENBQUN6TCxHQUFHLENBQUM7a0JBQ1g7Z0JBQ0Y7Z0JBQ0F3TCxPQUFPLENBQUMsR0FBRzFCLElBQUksQ0FBQztjQUNsQixDQUFDO1lBQ0gsQ0FBQyxDQUFDO1VBQ0o7UUFDRjs7UUFFQTtRQUNBLElBQUltQyxVQUFVLENBQUNXLEtBQUssS0FBSyxJQUFJLEVBQUU7VUFDN0I3TixPQUFPLENBQUNrTixVQUFVLEdBQUdBLFVBQVUsQ0FBQ1csS0FBSztRQUN2QztRQUVBLE1BQU1DLGFBQWEsR0FBRyxJQUFJeE8sYUFBYSxDQUFDO1VBQ3RDRyxRQUFRO1VBQ1JHLFFBQVEsRUFBRUEsUUFBUTtVQUNsQkUsVUFBVSxFQUFFWixJQUFJO1VBQ2hCZ0IsZ0JBQWdCLEVBQUVWLE9BQU8sQ0FBQ1UsZ0JBQWdCO1VBQzFDRSxJQUFJLEVBQUUsQ0FBQyxDQUFDWixPQUFPLENBQUNZLElBQUk7VUFDcEJKLE9BQU8sRUFBRUEsT0FBTztVQUNoQkssT0FBTyxFQUFFLENBQUMsQ0FBQ2IsT0FBTyxDQUFDYTtRQUNyQixDQUFDLENBQUM7UUFFRixJQUFJYixPQUFPLENBQUNZLElBQUksRUFBRTtVQUNoQjtVQUNBbEIsSUFBSSxDQUFDMkYsd0JBQXdCLENBQUNrSixJQUFJLENBQUM7WUFDakMzTixJQUFJLEVBQUUsSUFBSTtZQUNWbUssT0FBTyxFQUFFLENBQUN1RCxhQUFhO1VBQ3pCLENBQUMsQ0FBQztRQUNKLENBQUMsTUFBTTtVQUNMO1VBQ0E7VUFDQSxJQUFJMUwsT0FBTyxDQUFDbEQsSUFBSSxDQUFDMkYsd0JBQXdCLENBQUMsSUFDdEN4QyxJQUFJLENBQUNuRCxJQUFJLENBQUMyRix3QkFBd0IsQ0FBQyxDQUFDekUsSUFBSSxFQUFFO1lBQzVDbEIsSUFBSSxDQUFDMkYsd0JBQXdCLENBQUNrSixJQUFJLENBQUM7Y0FDakMzTixJQUFJLEVBQUUsS0FBSztjQUNYbUssT0FBTyxFQUFFO1lBQ1gsQ0FBQyxDQUFDO1VBQ0o7VUFFQWxJLElBQUksQ0FBQ25ELElBQUksQ0FBQzJGLHdCQUF3QixDQUFDLENBQUMwRixPQUFPLENBQUN3RCxJQUFJLENBQUNELGFBQWEsQ0FBQztRQUNqRTs7UUFFQTtRQUNBLElBQUk1TyxJQUFJLENBQUMyRix3QkFBd0IsQ0FBQ2dELE1BQU0sS0FBSyxDQUFDLEVBQUVpRyxhQUFhLENBQUNyTixXQUFXLENBQUMsQ0FBQzs7UUFFM0U7UUFDQTtRQUNBLElBQUk2TSxNQUFNLEVBQUU7VUFDVjtVQUNBO1VBQ0E7VUFDQTtVQUNBLElBQUk5TixPQUFPLENBQUMrTixlQUFlLEVBQUU7WUFDM0IsT0FBT0QsTUFBTSxDQUFDakIsSUFBSSxDQUFDLE1BQU1WLGVBQWUsQ0FBQztVQUMzQztVQUNBLE9BQU8yQixNQUFNO1FBQ2Y7UUFDQSxPQUFPOU4sT0FBTyxDQUFDK04sZUFBZSxHQUFHNUIsZUFBZSxHQUFHSyxTQUFTO01BQzlEO01BR0FYLFNBQVNBLENBQUNwRSxJQUFJLEVBQUU4RCxJQUFJLEVBQUV2TCxPQUFPLEVBQUU7UUFDN0I7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBLE1BQU1OLElBQUksR0FBRyxJQUFJO1FBQ2pCLE1BQU04TyxTQUFTLEdBQUdsUCxHQUFHLENBQUN1TCx3QkFBd0IsQ0FBQzRELEdBQUcsQ0FBQyxDQUFDO1FBQ3BELE1BQU1DLElBQUksR0FBR2hQLElBQUksQ0FBQ3NGLGVBQWUsQ0FBQ3lDLElBQUksQ0FBQztRQUN2QyxNQUFNNkQsbUJBQW1CLEdBQUdrRCxTQUFTLGFBQVRBLFNBQVMsdUJBQVRBLFNBQVMsQ0FBRUcsWUFBWTtRQUNuRCxNQUFNdEQsZUFBZSxHQUFHbUQsU0FBUyxhQUFUQSxTQUFTLHVCQUFUQSxTQUFTLENBQUVJLGdCQUFnQjtRQUNuRCxNQUFNbEIsVUFBVSxHQUFHO1VBQUVXLEtBQUssRUFBRTtRQUFJLENBQUM7UUFFakMsTUFBTVEsYUFBYSxHQUFHO1VBQ3BCdkQsbUJBQW1CO1VBQ25Cb0MsVUFBVTtVQUNWckM7UUFDRixDQUFDO1FBQ0QsSUFBSSxDQUFDcUQsSUFBSSxFQUFFO1VBQ1QsT0FBQTVNLGFBQUEsQ0FBQUEsYUFBQSxLQUFZK00sYUFBYTtZQUFFNUMsT0FBTyxFQUFFO1VBQUs7UUFDM0M7O1FBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7O1FBRUEsTUFBTTZDLG1CQUFtQixHQUFHQSxDQUFBLEtBQU07VUFDaEMsSUFBSXBCLFVBQVUsQ0FBQ1csS0FBSyxLQUFLLElBQUksRUFBRTtZQUM3QlgsVUFBVSxDQUFDVyxLQUFLLEdBQUdsTSxTQUFTLENBQUM0TSxXQUFXLENBQUNQLFNBQVMsRUFBRS9HLElBQUksQ0FBQztVQUMzRDtVQUNBLE9BQU9pRyxVQUFVLENBQUNXLEtBQUs7UUFDekIsQ0FBQztRQUVELE1BQU1XLFNBQVMsR0FBR0MsTUFBTSxJQUFJO1VBQzFCdlAsSUFBSSxDQUFDc1AsU0FBUyxDQUFDQyxNQUFNLENBQUM7UUFDeEIsQ0FBQztRQUVELE1BQU1sRCxVQUFVLEdBQUcsSUFBSTVKLFNBQVMsQ0FBQytNLGdCQUFnQixDQUFDO1VBQ2hEUCxZQUFZLEVBQUUsSUFBSTtVQUNsQk0sTUFBTSxFQUFFdlAsSUFBSSxDQUFDdVAsTUFBTSxDQUFDLENBQUM7VUFDckI1RCxlQUFlLEVBQUVyTCxPQUFPLGFBQVBBLE9BQU8sdUJBQVBBLE9BQU8sQ0FBRXFMLGVBQWU7VUFDekMyRCxTQUFTLEVBQUVBLFNBQVM7VUFDcEJ0QixVQUFVQSxDQUFBLEVBQUc7WUFDWCxPQUFPb0IsbUJBQW1CLENBQUMsQ0FBQztVQUM5QjtRQUNGLENBQUMsQ0FBQzs7UUFFRjtRQUNBO1FBQ0EsTUFBTWhELGNBQWMsR0FBR0EsQ0FBQSxLQUFNO1VBQ3pCLElBQUk1SixNQUFNLENBQUNpRixRQUFRLEVBQUU7WUFDbkI7WUFDQTtZQUNBLE9BQU9qRixNQUFNLENBQUNpTixnQkFBZ0IsQ0FBQyxNQUFNO2NBQ25DO2NBQ0EsT0FBT1QsSUFBSSxDQUFDbEQsS0FBSyxDQUFDTyxVQUFVLEVBQUUxSixLQUFLLENBQUMySCxLQUFLLENBQUN1QixJQUFJLENBQUMsQ0FBQztZQUNsRCxDQUFDLENBQUM7VUFDSixDQUFDLE1BQU07WUFDTCxPQUFPbUQsSUFBSSxDQUFDbEQsS0FBSyxDQUFDTyxVQUFVLEVBQUUxSixLQUFLLENBQUMySCxLQUFLLENBQUN1QixJQUFJLENBQUMsQ0FBQztVQUNsRDtRQUNKLENBQUM7UUFDRCxPQUFBekosYUFBQSxDQUFBQSxhQUFBLEtBQVkrTSxhQUFhO1VBQUU1QyxPQUFPLEVBQUUsSUFBSTtVQUFFSCxjQUFjO1VBQUVDO1FBQVU7TUFDdEU7O01BRUE7TUFDQTtNQUNBO01BQ0FHLGNBQWNBLENBQUEsRUFBRztRQUNmLElBQUksQ0FBRSxJQUFJLENBQUNrRCxxQkFBcUIsQ0FBQyxDQUFDLEVBQUU7VUFDbEMsSUFBSSxDQUFDQywwQkFBMEIsQ0FBQyxDQUFDO1FBQ25DO1FBRUEzTCxNQUFNLENBQUM0RixNQUFNLENBQUMsSUFBSSxDQUFDdkUsT0FBTyxDQUFDLENBQUM4QyxPQUFPLENBQUVGLEtBQUssSUFBSztVQUM3Q0EsS0FBSyxDQUFDMkgsYUFBYSxDQUFDLENBQUM7UUFDdkIsQ0FBQyxDQUFDO01BQ0o7O01BRUE7TUFDQTtNQUNBO01BQ0EzQiwwQkFBMEJBLENBQUMxTixRQUFRLEVBQUU7UUFDbkMsTUFBTVAsSUFBSSxHQUFHLElBQUk7UUFDakIsSUFBSUEsSUFBSSxDQUFDNEYsdUJBQXVCLENBQUNyRixRQUFRLENBQUMsRUFDeEMsTUFBTSxJQUFJa0IsS0FBSyxDQUFDLGtEQUFrRCxDQUFDO1FBRXJFLE1BQU1vTyxXQUFXLEdBQUcsRUFBRTtRQUV0QjdMLE1BQU0sQ0FBQ3NILE9BQU8sQ0FBQ3RMLElBQUksQ0FBQ3FGLE9BQU8sQ0FBQyxDQUFDOEMsT0FBTyxDQUFDMkgsS0FBQSxJQUF5QjtVQUFBLElBQXhCLENBQUNDLFVBQVUsRUFBRTlILEtBQUssQ0FBQyxHQUFBNkgsS0FBQTtVQUN2RCxNQUFNRSxTQUFTLEdBQUcvSCxLQUFLLENBQUNnSSxpQkFBaUIsQ0FBQyxDQUFDO1VBQzNDO1VBQ0EsSUFBSSxDQUFFRCxTQUFTLEVBQUU7VUFDakJBLFNBQVMsQ0FBQzdILE9BQU8sQ0FBQyxDQUFDK0gsR0FBRyxFQUFFakcsRUFBRSxLQUFLO1lBQzdCNEYsV0FBVyxDQUFDaEIsSUFBSSxDQUFDO2NBQUVrQixVQUFVO2NBQUU5RjtZQUFHLENBQUMsQ0FBQztZQUNwQyxJQUFJLENBQUVsSCxNQUFNLENBQUNtRyxJQUFJLENBQUNsSixJQUFJLENBQUM2RixnQkFBZ0IsRUFBRWtLLFVBQVUsQ0FBQyxFQUFFO2NBQ3BEL1AsSUFBSSxDQUFDNkYsZ0JBQWdCLENBQUNrSyxVQUFVLENBQUMsR0FBRyxJQUFJM00sVUFBVSxDQUFDLENBQUM7WUFDdEQ7WUFDQSxNQUFNK00sU0FBUyxHQUFHblEsSUFBSSxDQUFDNkYsZ0JBQWdCLENBQUNrSyxVQUFVLENBQUMsQ0FBQ0ssVUFBVSxDQUM1RG5HLEVBQUUsRUFDRmpHLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FDcEIsQ0FBQztZQUNELElBQUlrTSxTQUFTLENBQUNFLGNBQWMsRUFBRTtjQUM1QjtjQUNBO2NBQ0FGLFNBQVMsQ0FBQ0UsY0FBYyxDQUFDOVAsUUFBUSxDQUFDLEdBQUcsSUFBSTtZQUMzQyxDQUFDLE1BQU07Y0FDTDtjQUNBNFAsU0FBUyxDQUFDRyxRQUFRLEdBQUdKLEdBQUc7Y0FDeEJDLFNBQVMsQ0FBQ0ksY0FBYyxHQUFHLEVBQUU7Y0FDN0JKLFNBQVMsQ0FBQ0UsY0FBYyxHQUFHck0sTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDO2NBQzlDa00sU0FBUyxDQUFDRSxjQUFjLENBQUM5UCxRQUFRLENBQUMsR0FBRyxJQUFJO1lBQzNDO1VBQ0YsQ0FBQyxDQUFDO1FBQ0osQ0FBQyxDQUFDO1FBQ0YsSUFBSSxDQUFFMkMsT0FBTyxDQUFDMk0sV0FBVyxDQUFDLEVBQUU7VUFDMUI3UCxJQUFJLENBQUM0Rix1QkFBdUIsQ0FBQ3JGLFFBQVEsQ0FBQyxHQUFHc1AsV0FBVztRQUN0RDtNQUNGOztNQUVBO01BQ0E7TUFDQVcsZUFBZUEsQ0FBQSxFQUFHO1FBQ2hCeE0sTUFBTSxDQUFDNEYsTUFBTSxDQUFDLElBQUksQ0FBQ2hELGNBQWMsQ0FBQyxDQUFDdUIsT0FBTyxDQUFFMkIsR0FBRyxJQUFLO1VBQ2xEO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBLElBQUlBLEdBQUcsQ0FBQy9CLElBQUksS0FBSyxrQ0FBa0MsRUFBRTtZQUNuRCtCLEdBQUcsQ0FBQ3RDLElBQUksQ0FBQyxDQUFDO1VBQ1o7UUFDRixDQUFDLENBQUM7TUFDSjs7TUFFQTtNQUNBN0YsS0FBS0EsQ0FBQzhPLEdBQUcsRUFBRTtRQUNULElBQUksQ0FBQy9MLE9BQU8sQ0FBQ2dNLElBQUksQ0FBQ2pPLFNBQVMsQ0FBQ2tPLFlBQVksQ0FBQ0YsR0FBRyxDQUFDLENBQUM7TUFDaEQ7O01BRUE7TUFDQTtNQUNBO01BQ0FHLGVBQWVBLENBQUNDLEtBQUssRUFBRTtRQUNyQixJQUFJLENBQUNuTSxPQUFPLENBQUNrTSxlQUFlLENBQUNDLEtBQUssQ0FBQztNQUNyQzs7TUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtNQUNFQyxNQUFNQSxDQUFBLEVBQVU7UUFDZCxPQUFPLElBQUksQ0FBQ3BNLE9BQU8sQ0FBQ29NLE1BQU0sQ0FBQyxHQUFBekksU0FBTyxDQUFDO01BQ3JDOztNQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7TUFFRTBJLFNBQVNBLENBQUEsRUFBVTtRQUNqQixPQUFPLElBQUksQ0FBQ3JNLE9BQU8sQ0FBQ3FNLFNBQVMsQ0FBQyxHQUFBMUksU0FBTyxDQUFDO01BQ3hDOztNQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO01BQ0UySSxVQUFVQSxDQUFBLEVBQVU7UUFDbEIsT0FBTyxJQUFJLENBQUN0TSxPQUFPLENBQUNzTSxVQUFVLENBQUMsR0FBQTNJLFNBQU8sQ0FBQztNQUN6QztNQUVBNEksS0FBS0EsQ0FBQSxFQUFHO1FBQ04sT0FBTyxJQUFJLENBQUN2TSxPQUFPLENBQUNzTSxVQUFVLENBQUM7VUFBRUUsVUFBVSxFQUFFO1FBQUssQ0FBQyxDQUFDO01BQ3REOztNQUVBO01BQ0E7TUFDQTtNQUNBM0IsTUFBTUEsQ0FBQSxFQUFHO1FBQ1AsSUFBSSxJQUFJLENBQUN6SSxXQUFXLEVBQUUsSUFBSSxDQUFDQSxXQUFXLENBQUM4RCxNQUFNLENBQUMsQ0FBQztRQUMvQyxPQUFPLElBQUksQ0FBQy9ELE9BQU87TUFDckI7TUFFQXlJLFNBQVNBLENBQUNDLE1BQU0sRUFBRTtRQUNoQjtRQUNBLElBQUksSUFBSSxDQUFDMUksT0FBTyxLQUFLMEksTUFBTSxFQUFFO1FBQzdCLElBQUksQ0FBQzFJLE9BQU8sR0FBRzBJLE1BQU07UUFDckIsSUFBSSxJQUFJLENBQUN6SSxXQUFXLEVBQUUsSUFBSSxDQUFDQSxXQUFXLENBQUMyRCxPQUFPLENBQUMsQ0FBQztNQUNsRDs7TUFFQTtNQUNBO01BQ0E7TUFDQWlGLHFCQUFxQkEsQ0FBQSxFQUFHO1FBQ3RCLE9BQ0UsQ0FBRXhNLE9BQU8sQ0FBQyxJQUFJLENBQUM4QyxpQkFBaUIsQ0FBQyxJQUNqQyxDQUFFOUMsT0FBTyxDQUFDLElBQUksQ0FBQ3hCLDBCQUEwQixDQUFDO01BRTlDOztNQUVBO01BQ0E7TUFDQXlQLHlCQUF5QkEsQ0FBQSxFQUFHO1FBQzFCLE1BQU1DLFFBQVEsR0FBRyxJQUFJLENBQUM5UCxlQUFlO1FBQ3JDLE9BQU8wQyxNQUFNLENBQUM0RixNQUFNLENBQUN3SCxRQUFRLENBQUMsQ0FBQzNILElBQUksQ0FBRTRILE9BQU8sSUFBSyxDQUFDLENBQUNBLE9BQU8sQ0FBQzdRLFdBQVcsQ0FBQztNQUN6RTtNQUVBLE1BQU04USxtQkFBbUJBLENBQUMxSSxHQUFHLEVBQUU7UUFDN0IsTUFBTTVJLElBQUksR0FBRyxJQUFJO1FBRWpCLElBQUlBLElBQUksQ0FBQ29GLFFBQVEsS0FBSyxNQUFNLElBQUlwRixJQUFJLENBQUN5RixrQkFBa0IsS0FBSyxDQUFDLEVBQUU7VUFDN0R6RixJQUFJLENBQUN1SCxVQUFVLEdBQUcsSUFBSTlFLFNBQVMsQ0FBQzhPLFNBQVMsQ0FBQztZQUN4QzFOLGlCQUFpQixFQUFFN0QsSUFBSSxDQUFDeUYsa0JBQWtCO1lBQzFDM0IsZ0JBQWdCLEVBQUU5RCxJQUFJLENBQUMwRixpQkFBaUI7WUFDeEM4TCxTQUFTQSxDQUFBLEVBQUc7Y0FDVnhSLElBQUksQ0FBQzRRLGVBQWUsQ0FDbEIsSUFBSWhSLEdBQUcsQ0FBQ2lGLGVBQWUsQ0FBQyx5QkFBeUIsQ0FDbkQsQ0FBQztZQUNILENBQUM7WUFDRDRNLFFBQVFBLENBQUEsRUFBRztjQUNUelIsSUFBSSxDQUFDMkIsS0FBSyxDQUFDO2dCQUFFaUgsR0FBRyxFQUFFO2NBQU8sQ0FBQyxDQUFDO1lBQzdCO1VBQ0YsQ0FBQyxDQUFDO1VBQ0Y1SSxJQUFJLENBQUN1SCxVQUFVLENBQUNtSyxLQUFLLENBQUMsQ0FBQztRQUN6Qjs7UUFFQTtRQUNBLElBQUkxUixJQUFJLENBQUNrRixjQUFjLEVBQUVsRixJQUFJLENBQUNpRyxZQUFZLEdBQUcsSUFBSTtRQUVqRCxJQUFJMEwsNEJBQTRCO1FBQ2hDLElBQUksT0FBTy9JLEdBQUcsQ0FBQ2dKLE9BQU8sS0FBSyxRQUFRLEVBQUU7VUFDbkNELDRCQUE0QixHQUFHM1IsSUFBSSxDQUFDa0YsY0FBYyxLQUFLMEQsR0FBRyxDQUFDZ0osT0FBTztVQUNsRTVSLElBQUksQ0FBQ2tGLGNBQWMsR0FBRzBELEdBQUcsQ0FBQ2dKLE9BQU87UUFDbkM7UUFFQSxJQUFJRCw0QkFBNEIsRUFBRTtVQUNoQztVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7UUFDRjs7UUFFQTs7UUFFQTtRQUNBO1FBQ0EzUixJQUFJLENBQUNrRyx3QkFBd0IsR0FBR2xDLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQztRQUVuRCxJQUFJakUsSUFBSSxDQUFDaUcsWUFBWSxFQUFFO1VBQ3JCO1VBQ0E7VUFDQWpHLElBQUksQ0FBQzRGLHVCQUF1QixHQUFHNUIsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDO1VBQ2xEakUsSUFBSSxDQUFDNkYsZ0JBQWdCLEdBQUc3QixNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDN0M7O1FBRUE7UUFDQWpFLElBQUksQ0FBQzhGLHFCQUFxQixHQUFHLEVBQUU7O1FBRS9CO1FBQ0E7UUFDQTtRQUNBO1FBQ0E5RixJQUFJLENBQUNnRyxpQkFBaUIsR0FBR2hDLE1BQU0sQ0FBQ0MsTUFBTSxDQUFDLElBQUksQ0FBQztRQUM1Q0QsTUFBTSxDQUFDc0gsT0FBTyxDQUFDdEwsSUFBSSxDQUFDNEcsY0FBYyxDQUFDLENBQUN1QixPQUFPLENBQUMwSixLQUFBLElBQWU7VUFBQSxJQUFkLENBQUM1SCxFQUFFLEVBQUVILEdBQUcsQ0FBQyxHQUFBK0gsS0FBQTtVQUNwRCxJQUFJL0gsR0FBRyxDQUFDSSxLQUFLLEVBQUU7WUFDYmxLLElBQUksQ0FBQ2dHLGlCQUFpQixDQUFDaUUsRUFBRSxDQUFDLEdBQUcsSUFBSTtVQUNuQztRQUNGLENBQUMsQ0FBQzs7UUFFRjtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBakssSUFBSSxDQUFDMEIsMEJBQTBCLEdBQUdzQyxNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDckQsSUFBSWpFLElBQUksQ0FBQ2lHLFlBQVksRUFBRTtVQUNyQixNQUFNbUwsUUFBUSxHQUFHcFIsSUFBSSxDQUFDc0IsZUFBZTtVQUNyQzJCLElBQUksQ0FBQ21PLFFBQVEsQ0FBQyxDQUFDakosT0FBTyxDQUFDOEIsRUFBRSxJQUFJO1lBQzNCLE1BQU1vSCxPQUFPLEdBQUdELFFBQVEsQ0FBQ25ILEVBQUUsQ0FBQztZQUM1QixJQUFJb0gsT0FBTyxDQUFDN1AsU0FBUyxDQUFDLENBQUMsRUFBRTtjQUN2QjtjQUNBO2NBQ0E7Y0FDQTtjQUNBeEIsSUFBSSxDQUFDOEYscUJBQXFCLENBQUMrSSxJQUFJLENBQzdCO2dCQUFBLE9BQWF3QyxPQUFPLENBQUNwUCxXQUFXLENBQUMsR0FBQW9HLFNBQU8sQ0FBQztjQUFBLENBQzNDLENBQUM7WUFDSCxDQUFDLE1BQU0sSUFBSWdKLE9BQU8sQ0FBQzdRLFdBQVcsRUFBRTtjQUM5QjtjQUNBO2NBQ0E7Y0FDQTtjQUNBO2NBQ0E7Y0FDQTtjQUNBO2NBQ0E7Y0FDQVIsSUFBSSxDQUFDMEIsMEJBQTBCLENBQUMyUCxPQUFPLENBQUM5USxRQUFRLENBQUMsR0FBRyxJQUFJO1lBQzFEO1VBQ0YsQ0FBQyxDQUFDO1FBQ0o7UUFFQVAsSUFBSSxDQUFDK0YsZ0NBQWdDLEdBQUcsRUFBRTs7UUFFMUM7UUFDQTtRQUNBLElBQUksQ0FBRS9GLElBQUksQ0FBQzBQLHFCQUFxQixDQUFDLENBQUMsRUFBRTtVQUNsQyxJQUFJMVAsSUFBSSxDQUFDaUcsWUFBWSxFQUFFO1lBQ3JCLEtBQUssTUFBTWdDLEtBQUssSUFBSWpFLE1BQU0sQ0FBQzRGLE1BQU0sQ0FBQzVKLElBQUksQ0FBQ3FGLE9BQU8sQ0FBQyxFQUFFO2NBQy9DLE1BQU00QyxLQUFLLENBQUNTLFdBQVcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDO2NBQ2hDLE1BQU1ULEtBQUssQ0FBQ2EsU0FBUyxDQUFDLENBQUM7WUFDekI7WUFDQTlJLElBQUksQ0FBQ2lHLFlBQVksR0FBRyxLQUFLO1VBQzNCO1VBQ0FqRyxJQUFJLENBQUM4Uix3QkFBd0IsQ0FBQyxDQUFDO1FBQ2pDO01BQ0Y7TUFFQSxNQUFNQyxzQkFBc0JBLENBQUNuSixHQUFHLEVBQUVvSixPQUFPLEVBQUU7UUFDekMsTUFBTUMsV0FBVyxHQUFHckosR0FBRyxDQUFDQSxHQUFHOztRQUUzQjtRQUNBLElBQUlxSixXQUFXLEtBQUssT0FBTyxFQUFFO1VBQzNCLE1BQU0sSUFBSSxDQUFDQyxjQUFjLENBQUN0SixHQUFHLEVBQUVvSixPQUFPLENBQUM7UUFDekMsQ0FBQyxNQUFNLElBQUlDLFdBQVcsS0FBSyxTQUFTLEVBQUU7VUFDcEMsSUFBSSxDQUFDRSxnQkFBZ0IsQ0FBQ3ZKLEdBQUcsRUFBRW9KLE9BQU8sQ0FBQztRQUNyQyxDQUFDLE1BQU0sSUFBSUMsV0FBVyxLQUFLLFNBQVMsRUFBRTtVQUNwQyxJQUFJLENBQUNHLGdCQUFnQixDQUFDeEosR0FBRyxFQUFFb0osT0FBTyxDQUFDO1FBQ3JDLENBQUMsTUFBTSxJQUFJQyxXQUFXLEtBQUssT0FBTyxFQUFFO1VBQ2xDLElBQUksQ0FBQ0ksY0FBYyxDQUFDekosR0FBRyxFQUFFb0osT0FBTyxDQUFDO1FBQ25DLENBQUMsTUFBTSxJQUFJQyxXQUFXLEtBQUssU0FBUyxFQUFFO1VBQ3BDLElBQUksQ0FBQ0ssZ0JBQWdCLENBQUMxSixHQUFHLEVBQUVvSixPQUFPLENBQUM7UUFDckMsQ0FBQyxNQUFNLElBQUlDLFdBQVcsS0FBSyxPQUFPLEVBQUU7VUFDbEM7UUFBQSxDQUNELE1BQU07VUFDTHpQLE1BQU0sQ0FBQ29CLE1BQU0sQ0FBQywrQ0FBK0MsRUFBRWdGLEdBQUcsQ0FBQztRQUNyRTtNQUNGO01BRUEsTUFBTTJKLGNBQWNBLENBQUMzSixHQUFHLEVBQUU7UUFDeEIsTUFBTTVJLElBQUksR0FBRyxJQUFJO1FBRWpCLElBQUlBLElBQUksQ0FBQzBQLHFCQUFxQixDQUFDLENBQUMsRUFBRTtVQUNoQzFQLElBQUksQ0FBQytGLGdDQUFnQyxDQUFDOEksSUFBSSxDQUFDakcsR0FBRyxDQUFDO1VBRS9DLElBQUlBLEdBQUcsQ0FBQ0EsR0FBRyxLQUFLLE9BQU8sRUFBRTtZQUN2QixPQUFPNUksSUFBSSxDQUFDZ0csaUJBQWlCLENBQUM0QyxHQUFHLENBQUNxQixFQUFFLENBQUM7VUFDdkM7VUFFQSxJQUFJckIsR0FBRyxDQUFDNEosSUFBSSxFQUFFO1lBQ1o1SixHQUFHLENBQUM0SixJQUFJLENBQUNySyxPQUFPLENBQUNzSyxLQUFLLElBQUk7Y0FDeEIsT0FBT3pTLElBQUksQ0FBQ2dHLGlCQUFpQixDQUFDeU0sS0FBSyxDQUFDO1lBQ3RDLENBQUMsQ0FBQztVQUNKO1VBRUEsSUFBSTdKLEdBQUcsQ0FBQ3lDLE9BQU8sRUFBRTtZQUNmekMsR0FBRyxDQUFDeUMsT0FBTyxDQUFDbEQsT0FBTyxDQUFDNUgsUUFBUSxJQUFJO2NBQzlCLE9BQU9QLElBQUksQ0FBQzBCLDBCQUEwQixDQUFDbkIsUUFBUSxDQUFDO1lBQ2xELENBQUMsQ0FBQztVQUNKO1VBRUEsSUFBSVAsSUFBSSxDQUFDMFAscUJBQXFCLENBQUMsQ0FBQyxFQUFFO1lBQ2hDO1VBQ0Y7O1VBRUE7VUFDQTtVQUNBOztVQUVBLE1BQU1nRCxnQkFBZ0IsR0FBRzFTLElBQUksQ0FBQytGLGdDQUFnQztVQUM5RCxLQUFLLE1BQU00TSxlQUFlLElBQUkzTyxNQUFNLENBQUM0RixNQUFNLENBQUM4SSxnQkFBZ0IsQ0FBQyxFQUFFO1lBQzdELE1BQU0xUyxJQUFJLENBQUMrUixzQkFBc0IsQ0FDL0JZLGVBQWUsRUFDZjNTLElBQUksQ0FBQ3VHLGVBQ1AsQ0FBQztVQUNIO1VBRUF2RyxJQUFJLENBQUMrRixnQ0FBZ0MsR0FBRyxFQUFFO1FBRTVDLENBQUMsTUFBTTtVQUNMLE1BQU0vRixJQUFJLENBQUMrUixzQkFBc0IsQ0FBQ25KLEdBQUcsRUFBRTVJLElBQUksQ0FBQ3VHLGVBQWUsQ0FBQztRQUM5RDs7UUFFQTtRQUNBO1FBQ0E7UUFDQSxNQUFNcU0sYUFBYSxHQUNqQmhLLEdBQUcsQ0FBQ0EsR0FBRyxLQUFLLE9BQU8sSUFDbkJBLEdBQUcsQ0FBQ0EsR0FBRyxLQUFLLFNBQVMsSUFDckJBLEdBQUcsQ0FBQ0EsR0FBRyxLQUFLLFNBQVM7UUFFdkIsSUFBSTVJLElBQUksQ0FBQzBHLHVCQUF1QixLQUFLLENBQUMsSUFBSSxDQUFFa00sYUFBYSxFQUFFO1VBQ3pELE1BQU01UyxJQUFJLENBQUNzRyxvQkFBb0IsQ0FBQyxDQUFDO1VBQ2pDO1FBQ0Y7UUFFQSxJQUFJdEcsSUFBSSxDQUFDd0csc0JBQXNCLEtBQUssSUFBSSxFQUFFO1VBQ3hDeEcsSUFBSSxDQUFDd0csc0JBQXNCLEdBQ3pCLElBQUlxTSxJQUFJLENBQUMsQ0FBQyxDQUFDQyxPQUFPLENBQUMsQ0FBQyxHQUFHOVMsSUFBSSxDQUFDMkcscUJBQXFCO1FBQ3JELENBQUMsTUFBTSxJQUFJM0csSUFBSSxDQUFDd0csc0JBQXNCLEdBQUcsSUFBSXFNLElBQUksQ0FBQyxDQUFDLENBQUNDLE9BQU8sQ0FBQyxDQUFDLEVBQUU7VUFDN0QsTUFBTTlTLElBQUksQ0FBQ3NHLG9CQUFvQixDQUFDLENBQUM7VUFDakM7UUFDRjtRQUVBLElBQUl0RyxJQUFJLENBQUN5RywwQkFBMEIsRUFBRTtVQUNuQ3NNLFlBQVksQ0FBQy9TLElBQUksQ0FBQ3lHLDBCQUEwQixDQUFDO1FBQy9DO1FBQ0F6RyxJQUFJLENBQUN5RywwQkFBMEIsR0FBR3VNLFVBQVUsQ0FBQyxNQUFNO1VBQ2pEO1VBQ0E7VUFDQWhULElBQUksQ0FBQ2lULHNCQUFzQixHQUFHalQsSUFBSSxDQUFDb0cscUJBQXFCLENBQUMsQ0FBQztVQUUxRCxJQUFJNUQsTUFBTSxDQUFDMFEsVUFBVSxDQUFDbFQsSUFBSSxDQUFDaVQsc0JBQXNCLENBQUMsRUFBRTtZQUNsRGpULElBQUksQ0FBQ2lULHNCQUFzQixDQUFDRSxPQUFPLENBQ2pDLE1BQU9uVCxJQUFJLENBQUNpVCxzQkFBc0IsR0FBR25HLFNBQ3ZDLENBQUM7VUFDSDtRQUNGLENBQUMsRUFBRTlNLElBQUksQ0FBQzBHLHVCQUF1QixDQUFDO01BQ2xDO01BRUEwTSxzQkFBc0JBLENBQUEsRUFBRztRQUN2QixNQUFNcFQsSUFBSSxHQUFHLElBQUk7UUFDakIsSUFBSUEsSUFBSSxDQUFDeUcsMEJBQTBCLEVBQUU7VUFDbkNzTSxZQUFZLENBQUMvUyxJQUFJLENBQUN5RywwQkFBMEIsQ0FBQztVQUM3Q3pHLElBQUksQ0FBQ3lHLDBCQUEwQixHQUFHLElBQUk7UUFDeEM7UUFFQXpHLElBQUksQ0FBQ3dHLHNCQUFzQixHQUFHLElBQUk7UUFDbEM7UUFDQTtRQUNBO1FBQ0EsTUFBTTZNLE1BQU0sR0FBR3JULElBQUksQ0FBQ3VHLGVBQWU7UUFDbkN2RyxJQUFJLENBQUN1RyxlQUFlLEdBQUd2QyxNQUFNLENBQUNDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDMUMsT0FBT29QLE1BQU07TUFDZjtNQUVBLE1BQU1DLDBCQUEwQkEsQ0FBQSxFQUFHO1FBQ2pDLE1BQU10VCxJQUFJLEdBQUcsSUFBSTtRQUNqQixNQUFNcVQsTUFBTSxHQUFHclQsSUFBSSxDQUFDb1Qsc0JBQXNCLENBQUMsQ0FBQztRQUM1QyxNQUFNcFQsSUFBSSxDQUFDdVQsb0JBQW9CLENBQUNGLE1BQU0sQ0FBQztNQUN6QztNQUNBMUQsMEJBQTBCQSxDQUFBLEVBQUc7UUFDM0IsTUFBTTNQLElBQUksR0FBRyxJQUFJO1FBQ2pCLE1BQU1xVCxNQUFNLEdBQUdyVCxJQUFJLENBQUNvVCxzQkFBc0IsQ0FBQyxDQUFDO1FBQzVDcFQsSUFBSSxDQUFDd1Qsb0JBQW9CLENBQUNILE1BQU0sQ0FBQztNQUNuQztNQUNBL00sb0JBQW9CQSxDQUFBLEVBQUc7UUFDckIsTUFBTXRHLElBQUksR0FBRyxJQUFJO1FBQ2pCLE9BQU93QyxNQUFNLENBQUN3RSxRQUFRLEdBQ2xCaEgsSUFBSSxDQUFDMlAsMEJBQTBCLENBQUMsQ0FBQyxHQUNqQzNQLElBQUksQ0FBQ3NULDBCQUEwQixDQUFDLENBQUM7TUFDdkM7TUFDQSxNQUFNQyxvQkFBb0JBLENBQUN2QixPQUFPLEVBQUU7UUFDbEMsTUFBTWhTLElBQUksR0FBRyxJQUFJO1FBRWpCLElBQUlBLElBQUksQ0FBQ2lHLFlBQVksSUFBSSxDQUFFL0MsT0FBTyxDQUFDOE8sT0FBTyxDQUFDLEVBQUU7VUFDM0M7O1VBRUEsS0FBSyxNQUFNLENBQUN5QixTQUFTLEVBQUV4TCxLQUFLLENBQUMsSUFBSWpFLE1BQU0sQ0FBQ3NILE9BQU8sQ0FBQ3RMLElBQUksQ0FBQ3FGLE9BQU8sQ0FBQyxFQUFFO1lBQzdELE1BQU00QyxLQUFLLENBQUNTLFdBQVcsQ0FDckIzRixNQUFNLENBQUNtRyxJQUFJLENBQUM4SSxPQUFPLEVBQUV5QixTQUFTLENBQUMsR0FDM0J6QixPQUFPLENBQUN5QixTQUFTLENBQUMsQ0FBQzlLLE1BQU0sR0FDekIsQ0FBQyxFQUNMM0ksSUFBSSxDQUFDaUcsWUFDUCxDQUFDO1VBQ0g7VUFFQWpHLElBQUksQ0FBQ2lHLFlBQVksR0FBRyxLQUFLO1VBRXpCLEtBQUssTUFBTSxDQUFDd04sU0FBUyxFQUFFQyxjQUFjLENBQUMsSUFBSTFQLE1BQU0sQ0FBQ3NILE9BQU8sQ0FBQzBHLE9BQU8sQ0FBQyxFQUFFO1lBQ2pFLE1BQU0vSixLQUFLLEdBQUdqSSxJQUFJLENBQUNxRixPQUFPLENBQUNvTyxTQUFTLENBQUM7WUFDckMsSUFBSXhMLEtBQUssRUFBRTtjQUNULEtBQUssTUFBTTBMLGFBQWEsSUFBSUQsY0FBYyxFQUFFO2dCQUMxQyxNQUFNekwsS0FBSyxDQUFDWSxNQUFNLENBQUM4SyxhQUFhLENBQUM7Y0FDbkM7WUFDRixDQUFDLE1BQU07Y0FDTDtjQUNBO2NBQ0E7Y0FDQTtjQUNBO2NBQ0EsTUFBTTNCLE9BQU8sR0FBR2hTLElBQUksQ0FBQ2tHLHdCQUF3QjtjQUU3QyxJQUFJLENBQUVuRCxNQUFNLENBQUNtRyxJQUFJLENBQUM4SSxPQUFPLEVBQUV5QixTQUFTLENBQUMsRUFBRTtnQkFDckN6QixPQUFPLENBQUN5QixTQUFTLENBQUMsR0FBRyxFQUFFO2NBQ3pCO2NBRUF6QixPQUFPLENBQUN5QixTQUFTLENBQUMsQ0FBQzVFLElBQUksQ0FBQyxHQUFHNkUsY0FBYyxDQUFDO1lBQzVDO1VBQ0Y7VUFDQTtVQUNBLEtBQUssTUFBTXpMLEtBQUssSUFBSWpFLE1BQU0sQ0FBQzRGLE1BQU0sQ0FBQzVKLElBQUksQ0FBQ3FGLE9BQU8sQ0FBQyxFQUFFO1lBQy9DLE1BQU00QyxLQUFLLENBQUNhLFNBQVMsQ0FBQyxDQUFDO1VBQ3pCO1FBQ0Y7UUFFQTlJLElBQUksQ0FBQzhSLHdCQUF3QixDQUFDLENBQUM7TUFDakM7TUFDQTBCLG9CQUFvQkEsQ0FBQ3hCLE9BQU8sRUFBRTtRQUM1QixNQUFNaFMsSUFBSSxHQUFHLElBQUk7UUFFakIsSUFBSUEsSUFBSSxDQUFDaUcsWUFBWSxJQUFJLENBQUUvQyxPQUFPLENBQUM4TyxPQUFPLENBQUMsRUFBRTtVQUMzQzs7VUFFQSxLQUFLLE1BQU0sQ0FBQ3lCLFNBQVMsRUFBRXhMLEtBQUssQ0FBQyxJQUFJakUsTUFBTSxDQUFDc0gsT0FBTyxDQUFDdEwsSUFBSSxDQUFDcUYsT0FBTyxDQUFDLEVBQUU7WUFDN0Q0QyxLQUFLLENBQUNTLFdBQVcsQ0FDZjNGLE1BQU0sQ0FBQ21HLElBQUksQ0FBQzhJLE9BQU8sRUFBRXlCLFNBQVMsQ0FBQyxHQUMzQnpCLE9BQU8sQ0FBQ3lCLFNBQVMsQ0FBQyxDQUFDOUssTUFBTSxHQUN6QixDQUFDLEVBQ0wzSSxJQUFJLENBQUNpRyxZQUNQLENBQUM7VUFDSDtVQUVBakcsSUFBSSxDQUFDaUcsWUFBWSxHQUFHLEtBQUs7VUFFekIsS0FBSyxNQUFNLENBQUN3TixTQUFTLEVBQUVDLGNBQWMsQ0FBQyxJQUFJMVAsTUFBTSxDQUFDc0gsT0FBTyxDQUFDMEcsT0FBTyxDQUFDLEVBQUU7WUFDakUsTUFBTS9KLEtBQUssR0FBR2pJLElBQUksQ0FBQ3FGLE9BQU8sQ0FBQ29PLFNBQVMsQ0FBQztZQUNyQyxJQUFJeEwsS0FBSyxFQUFFO2NBQ1QsS0FBSyxNQUFNMEwsYUFBYSxJQUFJRCxjQUFjLEVBQUU7Z0JBQzFDekwsS0FBSyxDQUFDWSxNQUFNLENBQUM4SyxhQUFhLENBQUM7Y0FDN0I7WUFDRixDQUFDLE1BQU07Y0FDTDtjQUNBO2NBQ0E7Y0FDQTtjQUNBO2NBQ0EsTUFBTTNCLE9BQU8sR0FBR2hTLElBQUksQ0FBQ2tHLHdCQUF3QjtjQUU3QyxJQUFJLENBQUVuRCxNQUFNLENBQUNtRyxJQUFJLENBQUM4SSxPQUFPLEVBQUV5QixTQUFTLENBQUMsRUFBRTtnQkFDckN6QixPQUFPLENBQUN5QixTQUFTLENBQUMsR0FBRyxFQUFFO2NBQ3pCO2NBRUF6QixPQUFPLENBQUN5QixTQUFTLENBQUMsQ0FBQzVFLElBQUksQ0FBQyxHQUFHNkUsY0FBYyxDQUFDO1lBQzVDO1VBQ0Y7VUFDQTtVQUNBLEtBQUssTUFBTXpMLEtBQUssSUFBSWpFLE1BQU0sQ0FBQzRGLE1BQU0sQ0FBQzVKLElBQUksQ0FBQ3FGLE9BQU8sQ0FBQyxFQUFFO1lBQy9DNEMsS0FBSyxDQUFDYSxTQUFTLENBQUMsQ0FBQztVQUNuQjtRQUNGO1FBRUE5SSxJQUFJLENBQUM4Uix3QkFBd0IsQ0FBQyxDQUFDO01BQ2pDOztNQUVBO01BQ0E7TUFDQTtNQUNBQSx3QkFBd0JBLENBQUEsRUFBRztRQUN6QixNQUFNOVIsSUFBSSxHQUFHLElBQUk7UUFDakIsTUFBTW1KLFNBQVMsR0FBR25KLElBQUksQ0FBQzhGLHFCQUFxQjtRQUM1QzlGLElBQUksQ0FBQzhGLHFCQUFxQixHQUFHLEVBQUU7UUFDL0JxRCxTQUFTLENBQUNoQixPQUFPLENBQUU2QyxDQUFDLElBQUs7VUFDdkJBLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDO01BQ0o7TUFFQTRJLFdBQVdBLENBQUM1QixPQUFPLEVBQUVqQyxVQUFVLEVBQUVuSCxHQUFHLEVBQUU7UUFDcEMsSUFBSSxDQUFFN0YsTUFBTSxDQUFDbUcsSUFBSSxDQUFDOEksT0FBTyxFQUFFakMsVUFBVSxDQUFDLEVBQUU7VUFDdENpQyxPQUFPLENBQUNqQyxVQUFVLENBQUMsR0FBRyxFQUFFO1FBQzFCO1FBQ0FpQyxPQUFPLENBQUNqQyxVQUFVLENBQUMsQ0FBQ2xCLElBQUksQ0FBQ2pHLEdBQUcsQ0FBQztNQUMvQjtNQUVBaUwsYUFBYUEsQ0FBQzlELFVBQVUsRUFBRTlGLEVBQUUsRUFBRTtRQUM1QixNQUFNakssSUFBSSxHQUFHLElBQUk7UUFDakIsSUFBSSxDQUFFK0MsTUFBTSxDQUFDbUcsSUFBSSxDQUFDbEosSUFBSSxDQUFDNkYsZ0JBQWdCLEVBQUVrSyxVQUFVLENBQUMsRUFBRTtVQUNwRCxPQUFPLElBQUk7UUFDYjtRQUNBLE1BQU0rRCx1QkFBdUIsR0FBRzlULElBQUksQ0FBQzZGLGdCQUFnQixDQUFDa0ssVUFBVSxDQUFDO1FBQ2pFLE9BQU8rRCx1QkFBdUIsQ0FBQy9FLEdBQUcsQ0FBQzlFLEVBQUUsQ0FBQyxJQUFJLElBQUk7TUFDaEQ7TUFFQSxNQUFNaUksY0FBY0EsQ0FBQ3RKLEdBQUcsRUFBRW9KLE9BQU8sRUFBRTtRQUNqQyxNQUFNaFMsSUFBSSxHQUFHLElBQUk7UUFDakIsTUFBTWlLLEVBQUUsR0FBR25ILE9BQU8sQ0FBQ1MsT0FBTyxDQUFDcUYsR0FBRyxDQUFDcUIsRUFBRSxDQUFDO1FBQ2xDLE1BQU1rRyxTQUFTLEdBQUduUSxJQUFJLENBQUM2VCxhQUFhLENBQUNqTCxHQUFHLENBQUNtSCxVQUFVLEVBQUU5RixFQUFFLENBQUM7UUFDeEQsSUFBSWtHLFNBQVMsRUFBRTtVQUNiO1VBQ0EsTUFBTTRELFVBQVUsR0FBRzVELFNBQVMsQ0FBQ0csUUFBUSxLQUFLeEQsU0FBUztVQUVuRHFELFNBQVMsQ0FBQ0csUUFBUSxHQUFHMUgsR0FBRyxDQUFDb0wsTUFBTSxJQUFJaFEsTUFBTSxDQUFDQyxNQUFNLENBQUMsSUFBSSxDQUFDO1VBQ3REa00sU0FBUyxDQUFDRyxRQUFRLENBQUMyRCxHQUFHLEdBQUdoSyxFQUFFO1VBRTNCLElBQUlqSyxJQUFJLENBQUNpRyxZQUFZLEVBQUU7WUFDckI7WUFDQTtZQUNBO1lBQ0E7WUFDQSxNQUFNaU8sVUFBVSxHQUFHLE1BQU1sVSxJQUFJLENBQUNxRixPQUFPLENBQUN1RCxHQUFHLENBQUNtSCxVQUFVLENBQUMsQ0FBQ29FLE1BQU0sQ0FBQ3ZMLEdBQUcsQ0FBQ3FCLEVBQUUsQ0FBQztZQUNwRSxJQUFJaUssVUFBVSxLQUFLcEgsU0FBUyxFQUFFbEUsR0FBRyxDQUFDb0wsTUFBTSxHQUFHRSxVQUFVO1lBRXJEbFUsSUFBSSxDQUFDNFQsV0FBVyxDQUFDNUIsT0FBTyxFQUFFcEosR0FBRyxDQUFDbUgsVUFBVSxFQUFFbkgsR0FBRyxDQUFDO1VBQ2hELENBQUMsTUFBTSxJQUFJbUwsVUFBVSxFQUFFO1lBQ3JCLE1BQU0sSUFBSXRTLEtBQUssQ0FBQyxtQ0FBbUMsR0FBR21ILEdBQUcsQ0FBQ3FCLEVBQUUsQ0FBQztVQUMvRDtRQUNGLENBQUMsTUFBTTtVQUNMakssSUFBSSxDQUFDNFQsV0FBVyxDQUFDNUIsT0FBTyxFQUFFcEosR0FBRyxDQUFDbUgsVUFBVSxFQUFFbkgsR0FBRyxDQUFDO1FBQ2hEO01BQ0Y7TUFFQXVKLGdCQUFnQkEsQ0FBQ3ZKLEdBQUcsRUFBRW9KLE9BQU8sRUFBRTtRQUM3QixNQUFNaFMsSUFBSSxHQUFHLElBQUk7UUFDakIsTUFBTW1RLFNBQVMsR0FBR25RLElBQUksQ0FBQzZULGFBQWEsQ0FBQ2pMLEdBQUcsQ0FBQ21ILFVBQVUsRUFBRWpOLE9BQU8sQ0FBQ1MsT0FBTyxDQUFDcUYsR0FBRyxDQUFDcUIsRUFBRSxDQUFDLENBQUM7UUFDN0UsSUFBSWtHLFNBQVMsRUFBRTtVQUNiLElBQUlBLFNBQVMsQ0FBQ0csUUFBUSxLQUFLeEQsU0FBUyxFQUNsQyxNQUFNLElBQUlyTCxLQUFLLENBQUMsMENBQTBDLEdBQUdtSCxHQUFHLENBQUNxQixFQUFFLENBQUM7VUFDdEVtSyxZQUFZLENBQUNDLFlBQVksQ0FBQ2xFLFNBQVMsQ0FBQ0csUUFBUSxFQUFFMUgsR0FBRyxDQUFDb0wsTUFBTSxDQUFDO1FBQzNELENBQUMsTUFBTTtVQUNMaFUsSUFBSSxDQUFDNFQsV0FBVyxDQUFDNUIsT0FBTyxFQUFFcEosR0FBRyxDQUFDbUgsVUFBVSxFQUFFbkgsR0FBRyxDQUFDO1FBQ2hEO01BQ0Y7TUFFQXdKLGdCQUFnQkEsQ0FBQ3hKLEdBQUcsRUFBRW9KLE9BQU8sRUFBRTtRQUM3QixNQUFNaFMsSUFBSSxHQUFHLElBQUk7UUFDakIsTUFBTW1RLFNBQVMsR0FBR25RLElBQUksQ0FBQzZULGFBQWEsQ0FBQ2pMLEdBQUcsQ0FBQ21ILFVBQVUsRUFBRWpOLE9BQU8sQ0FBQ1MsT0FBTyxDQUFDcUYsR0FBRyxDQUFDcUIsRUFBRSxDQUFDLENBQUM7UUFDN0UsSUFBSWtHLFNBQVMsRUFBRTtVQUNiO1VBQ0EsSUFBSUEsU0FBUyxDQUFDRyxRQUFRLEtBQUt4RCxTQUFTLEVBQ2xDLE1BQU0sSUFBSXJMLEtBQUssQ0FBQyx5Q0FBeUMsR0FBR21ILEdBQUcsQ0FBQ3FCLEVBQUUsQ0FBQztVQUNyRWtHLFNBQVMsQ0FBQ0csUUFBUSxHQUFHeEQsU0FBUztRQUNoQyxDQUFDLE1BQU07VUFDTDlNLElBQUksQ0FBQzRULFdBQVcsQ0FBQzVCLE9BQU8sRUFBRXBKLEdBQUcsQ0FBQ21ILFVBQVUsRUFBRTtZQUN4Q25ILEdBQUcsRUFBRSxTQUFTO1lBQ2RtSCxVQUFVLEVBQUVuSCxHQUFHLENBQUNtSCxVQUFVO1lBQzFCOUYsRUFBRSxFQUFFckIsR0FBRyxDQUFDcUI7VUFDVixDQUFDLENBQUM7UUFDSjtNQUNGO01BRUFxSSxnQkFBZ0JBLENBQUMxSixHQUFHLEVBQUVvSixPQUFPLEVBQUU7UUFDN0IsTUFBTWhTLElBQUksR0FBRyxJQUFJO1FBQ2pCOztRQUVBNEksR0FBRyxDQUFDeUMsT0FBTyxDQUFDbEQsT0FBTyxDQUFFNUgsUUFBUSxJQUFLO1VBQ2hDLE1BQU0rVCxJQUFJLEdBQUd0VSxJQUFJLENBQUM0Rix1QkFBdUIsQ0FBQ3JGLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztVQUN6RHlELE1BQU0sQ0FBQzRGLE1BQU0sQ0FBQzBLLElBQUksQ0FBQyxDQUFDbk0sT0FBTyxDQUFFb00sT0FBTyxJQUFLO1lBQ3ZDLE1BQU1wRSxTQUFTLEdBQUduUSxJQUFJLENBQUM2VCxhQUFhLENBQUNVLE9BQU8sQ0FBQ3hFLFVBQVUsRUFBRXdFLE9BQU8sQ0FBQ3RLLEVBQUUsQ0FBQztZQUNwRSxJQUFJLENBQUVrRyxTQUFTLEVBQUU7Y0FDZixNQUFNLElBQUkxTyxLQUFLLENBQUMscUJBQXFCLEdBQUcrUyxJQUFJLENBQUNDLFNBQVMsQ0FBQ0YsT0FBTyxDQUFDLENBQUM7WUFDbEU7WUFDQSxJQUFJLENBQUVwRSxTQUFTLENBQUNFLGNBQWMsQ0FBQzlQLFFBQVEsQ0FBQyxFQUFFO2NBQ3hDLE1BQU0sSUFBSWtCLEtBQUssQ0FDYixNQUFNLEdBQ0orUyxJQUFJLENBQUNDLFNBQVMsQ0FBQ0YsT0FBTyxDQUFDLEdBQ3ZCLDBCQUEwQixHQUMxQmhVLFFBQ0osQ0FBQztZQUNIO1lBQ0EsT0FBTzRQLFNBQVMsQ0FBQ0UsY0FBYyxDQUFDOVAsUUFBUSxDQUFDO1lBQ3pDLElBQUkyQyxPQUFPLENBQUNpTixTQUFTLENBQUNFLGNBQWMsQ0FBQyxFQUFFO2NBQ3JDO2NBQ0E7Y0FDQTtjQUNBOztjQUVBO2NBQ0E7Y0FDQTtjQUNBclEsSUFBSSxDQUFDNFQsV0FBVyxDQUFDNUIsT0FBTyxFQUFFdUMsT0FBTyxDQUFDeEUsVUFBVSxFQUFFO2dCQUM1Q25ILEdBQUcsRUFBRSxTQUFTO2dCQUNkcUIsRUFBRSxFQUFFbkgsT0FBTyxDQUFDUSxXQUFXLENBQUNpUixPQUFPLENBQUN0SyxFQUFFLENBQUM7Z0JBQ25DeUssT0FBTyxFQUFFdkUsU0FBUyxDQUFDRztjQUNyQixDQUFDLENBQUM7Y0FDRjs7Y0FFQUgsU0FBUyxDQUFDSSxjQUFjLENBQUNwSSxPQUFPLENBQUU2QyxDQUFDLElBQUs7Z0JBQ3RDQSxDQUFDLENBQUMsQ0FBQztjQUNMLENBQUMsQ0FBQzs7Y0FFRjtjQUNBO2NBQ0E7Y0FDQWhMLElBQUksQ0FBQzZGLGdCQUFnQixDQUFDME8sT0FBTyxDQUFDeEUsVUFBVSxDQUFDLENBQUN2RixNQUFNLENBQUMrSixPQUFPLENBQUN0SyxFQUFFLENBQUM7WUFDOUQ7VUFDRixDQUFDLENBQUM7VUFDRixPQUFPakssSUFBSSxDQUFDNEYsdUJBQXVCLENBQUNyRixRQUFRLENBQUM7O1VBRTdDO1VBQ0E7VUFDQSxNQUFNb1UsZUFBZSxHQUFHM1UsSUFBSSxDQUFDc0IsZUFBZSxDQUFDZixRQUFRLENBQUM7VUFDdEQsSUFBSSxDQUFFb1UsZUFBZSxFQUFFO1lBQ3JCLE1BQU0sSUFBSWxULEtBQUssQ0FBQyxpQ0FBaUMsR0FBR2xCLFFBQVEsQ0FBQztVQUMvRDtVQUVBUCxJQUFJLENBQUM0VSwrQkFBK0IsQ0FDbEM7WUFBQSxPQUFhRCxlQUFlLENBQUMxUyxXQUFXLENBQUMsR0FBQW9HLFNBQU8sQ0FBQztVQUFBLENBQ25ELENBQUM7UUFDSCxDQUFDLENBQUM7TUFDSjtNQUVBZ0ssY0FBY0EsQ0FBQ3pKLEdBQUcsRUFBRW9KLE9BQU8sRUFBRTtRQUMzQixNQUFNaFMsSUFBSSxHQUFHLElBQUk7UUFDakI7UUFDQTtRQUNBOztRQUVBNEksR0FBRyxDQUFDNEosSUFBSSxDQUFDckssT0FBTyxDQUFFc0ssS0FBSyxJQUFLO1VBQzFCelMsSUFBSSxDQUFDNFUsK0JBQStCLENBQUMsTUFBTTtZQUN6QyxNQUFNQyxTQUFTLEdBQUc3VSxJQUFJLENBQUM0RyxjQUFjLENBQUM2TCxLQUFLLENBQUM7WUFDNUM7WUFDQSxJQUFJLENBQUNvQyxTQUFTLEVBQUU7WUFDaEI7WUFDQSxJQUFJQSxTQUFTLENBQUMzSyxLQUFLLEVBQUU7WUFDckIySyxTQUFTLENBQUMzSyxLQUFLLEdBQUcsSUFBSTtZQUN0QjJLLFNBQVMsQ0FBQzFLLGFBQWEsSUFBSTBLLFNBQVMsQ0FBQzFLLGFBQWEsQ0FBQyxDQUFDO1lBQ3BEMEssU0FBUyxDQUFDdEssU0FBUyxDQUFDRSxPQUFPLENBQUMsQ0FBQztVQUMvQixDQUFDLENBQUM7UUFDSixDQUFDLENBQUM7TUFDSjs7TUFFQTtNQUNBO01BQ0E7TUFDQW1LLCtCQUErQkEsQ0FBQ2xMLENBQUMsRUFBRTtRQUNqQyxNQUFNMUosSUFBSSxHQUFHLElBQUk7UUFDakIsTUFBTThVLGdCQUFnQixHQUFHQSxDQUFBLEtBQU07VUFDN0I5VSxJQUFJLENBQUM4RixxQkFBcUIsQ0FBQytJLElBQUksQ0FBQ25GLENBQUMsQ0FBQztRQUNwQyxDQUFDO1FBQ0QsSUFBSXFMLHVCQUF1QixHQUFHLENBQUM7UUFDL0IsTUFBTUMsZ0JBQWdCLEdBQUdBLENBQUEsS0FBTTtVQUM3QixFQUFFRCx1QkFBdUI7VUFDekIsSUFBSUEsdUJBQXVCLEtBQUssQ0FBQyxFQUFFO1lBQ2pDO1lBQ0E7WUFDQUQsZ0JBQWdCLENBQUMsQ0FBQztVQUNwQjtRQUNGLENBQUM7UUFFRDlRLE1BQU0sQ0FBQzRGLE1BQU0sQ0FBQzVKLElBQUksQ0FBQzZGLGdCQUFnQixDQUFDLENBQUNzQyxPQUFPLENBQUU4TSxlQUFlLElBQUs7VUFDaEVBLGVBQWUsQ0FBQzlNLE9BQU8sQ0FBRWdJLFNBQVMsSUFBSztZQUNyQyxNQUFNK0Usc0NBQXNDLEdBQzFDalMsSUFBSSxDQUFDa04sU0FBUyxDQUFDRSxjQUFjLENBQUMsQ0FBQzVHLElBQUksQ0FBQ2xKLFFBQVEsSUFBSTtjQUM5QyxNQUFNOFEsT0FBTyxHQUFHclIsSUFBSSxDQUFDc0IsZUFBZSxDQUFDZixRQUFRLENBQUM7Y0FDOUMsT0FBTzhRLE9BQU8sSUFBSUEsT0FBTyxDQUFDN1EsV0FBVztZQUN2QyxDQUFDLENBQUM7WUFFSixJQUFJMFUsc0NBQXNDLEVBQUU7Y0FDMUMsRUFBRUgsdUJBQXVCO2NBQ3pCNUUsU0FBUyxDQUFDSSxjQUFjLENBQUMxQixJQUFJLENBQUNtRyxnQkFBZ0IsQ0FBQztZQUNqRDtVQUNGLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQztRQUNGLElBQUlELHVCQUF1QixLQUFLLENBQUMsRUFBRTtVQUNqQztVQUNBO1VBQ0FELGdCQUFnQixDQUFDLENBQUM7UUFDcEI7TUFDRjtNQUVBLE1BQU1LLGVBQWVBLENBQUN2TSxHQUFHLEVBQUU7UUFDekIsTUFBTTVJLElBQUksR0FBRyxJQUFJOztRQUVqQjtRQUNBO1FBQ0EsTUFBTUEsSUFBSSxDQUFDdVMsY0FBYyxDQUFDM0osR0FBRyxDQUFDOztRQUU5QjtRQUNBOztRQUVBO1FBQ0EsSUFBSSxDQUFFN0YsTUFBTSxDQUFDbUcsSUFBSSxDQUFDbEosSUFBSSxDQUFDNEcsY0FBYyxFQUFFZ0MsR0FBRyxDQUFDcUIsRUFBRSxDQUFDLEVBQUU7VUFDOUM7UUFDRjs7UUFFQTtRQUNBLE1BQU1HLGFBQWEsR0FBR3BLLElBQUksQ0FBQzRHLGNBQWMsQ0FBQ2dDLEdBQUcsQ0FBQ3FCLEVBQUUsQ0FBQyxDQUFDRyxhQUFhO1FBQy9ELE1BQU1DLFlBQVksR0FBR3JLLElBQUksQ0FBQzRHLGNBQWMsQ0FBQ2dDLEdBQUcsQ0FBQ3FCLEVBQUUsQ0FBQyxDQUFDSSxZQUFZO1FBRTdEckssSUFBSSxDQUFDNEcsY0FBYyxDQUFDZ0MsR0FBRyxDQUFDcUIsRUFBRSxDQUFDLENBQUNPLE1BQU0sQ0FBQyxDQUFDO1FBRXBDLE1BQU00SyxrQkFBa0IsR0FBR0MsTUFBTSxJQUFJO1VBQ25DLE9BQ0VBLE1BQU0sSUFDTkEsTUFBTSxDQUFDeEUsS0FBSyxJQUNaLElBQUlyTyxNQUFNLENBQUNmLEtBQUssQ0FDZDRULE1BQU0sQ0FBQ3hFLEtBQUssQ0FBQ0EsS0FBSyxFQUNsQndFLE1BQU0sQ0FBQ3hFLEtBQUssQ0FBQ3lFLE1BQU0sRUFDbkJELE1BQU0sQ0FBQ3hFLEtBQUssQ0FBQzBFLE9BQ2YsQ0FBQztRQUVMLENBQUM7O1FBRUQ7UUFDQSxJQUFJbkwsYUFBYSxJQUFJeEIsR0FBRyxDQUFDaUksS0FBSyxFQUFFO1VBQzlCekcsYUFBYSxDQUFDZ0wsa0JBQWtCLENBQUN4TSxHQUFHLENBQUMsQ0FBQztRQUN4QztRQUVBLElBQUl5QixZQUFZLEVBQUU7VUFDaEJBLFlBQVksQ0FBQytLLGtCQUFrQixDQUFDeE0sR0FBRyxDQUFDLENBQUM7UUFDdkM7TUFDRjtNQUVBLE1BQU00TSxnQkFBZ0JBLENBQUM1TSxHQUFHLEVBQUU7UUFDMUI7O1FBRUEsTUFBTTVJLElBQUksR0FBRyxJQUFJOztRQUVqQjtRQUNBLElBQUksQ0FBRWtELE9BQU8sQ0FBQ2xELElBQUksQ0FBQ3VHLGVBQWUsQ0FBQyxFQUFFO1VBQ25DLE1BQU12RyxJQUFJLENBQUNzRyxvQkFBb0IsQ0FBQyxDQUFDO1FBQ25DOztRQUVBO1FBQ0E7UUFDQSxJQUFJcEQsT0FBTyxDQUFDbEQsSUFBSSxDQUFDMkYsd0JBQXdCLENBQUMsRUFBRTtVQUMxQ25ELE1BQU0sQ0FBQ29CLE1BQU0sQ0FBQyxtREFBbUQsQ0FBQztVQUNsRTtRQUNGO1FBQ0EsTUFBTTZSLGtCQUFrQixHQUFHelYsSUFBSSxDQUFDMkYsd0JBQXdCLENBQUMsQ0FBQyxDQUFDLENBQUMwRixPQUFPO1FBQ25FLElBQUlxSyxDQUFDO1FBQ0wsTUFBTUMsQ0FBQyxHQUFHRixrQkFBa0IsQ0FBQzVMLElBQUksQ0FBQyxDQUFDekIsTUFBTSxFQUFFd04sR0FBRyxLQUFLO1VBQ2pELE1BQU1DLEtBQUssR0FBR3pOLE1BQU0sQ0FBQzdILFFBQVEsS0FBS3FJLEdBQUcsQ0FBQ3FCLEVBQUU7VUFDeEMsSUFBSTRMLEtBQUssRUFBRUgsQ0FBQyxHQUFHRSxHQUFHO1VBQ2xCLE9BQU9DLEtBQUs7UUFDZCxDQUFDLENBQUM7UUFDRixJQUFJLENBQUNGLENBQUMsRUFBRTtVQUNOblQsTUFBTSxDQUFDb0IsTUFBTSxDQUFDLHFEQUFxRCxFQUFFZ0YsR0FBRyxDQUFDO1VBQ3pFO1FBQ0Y7O1FBRUE7UUFDQTtRQUNBO1FBQ0E2TSxrQkFBa0IsQ0FBQ0ssTUFBTSxDQUFDSixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRS9CLElBQUkzUyxNQUFNLENBQUNtRyxJQUFJLENBQUNOLEdBQUcsRUFBRSxPQUFPLENBQUMsRUFBRTtVQUM3QitNLENBQUMsQ0FBQzdULGFBQWEsQ0FDYixJQUFJVSxNQUFNLENBQUNmLEtBQUssQ0FBQ21ILEdBQUcsQ0FBQ2lJLEtBQUssQ0FBQ0EsS0FBSyxFQUFFakksR0FBRyxDQUFDaUksS0FBSyxDQUFDeUUsTUFBTSxFQUFFMU0sR0FBRyxDQUFDaUksS0FBSyxDQUFDMEUsT0FBTyxDQUN2RSxDQUFDO1FBQ0gsQ0FBQyxNQUFNO1VBQ0w7VUFDQTtVQUNBSSxDQUFDLENBQUM3VCxhQUFhLENBQUNnTCxTQUFTLEVBQUVsRSxHQUFHLENBQUM1RyxNQUFNLENBQUM7UUFDeEM7TUFDRjs7TUFFQTtNQUNBO01BQ0E7TUFDQUgsMEJBQTBCQSxDQUFBLEVBQUc7UUFDM0IsTUFBTTdCLElBQUksR0FBRyxJQUFJO1FBQ2pCLElBQUlBLElBQUksQ0FBQ21SLHlCQUF5QixDQUFDLENBQUMsRUFBRTs7UUFFdEM7UUFDQTtRQUNBO1FBQ0EsSUFBSSxDQUFFak8sT0FBTyxDQUFDbEQsSUFBSSxDQUFDMkYsd0JBQXdCLENBQUMsRUFBRTtVQUM1QyxNQUFNb1EsVUFBVSxHQUFHL1YsSUFBSSxDQUFDMkYsd0JBQXdCLENBQUMrSSxLQUFLLENBQUMsQ0FBQztVQUN4RCxJQUFJLENBQUV4TCxPQUFPLENBQUM2UyxVQUFVLENBQUMxSyxPQUFPLENBQUMsRUFDL0IsTUFBTSxJQUFJNUosS0FBSyxDQUNiLDZDQUE2QyxHQUMzQytTLElBQUksQ0FBQ0MsU0FBUyxDQUFDc0IsVUFBVSxDQUM3QixDQUFDOztVQUVIO1VBQ0EsSUFBSSxDQUFFN1MsT0FBTyxDQUFDbEQsSUFBSSxDQUFDMkYsd0JBQXdCLENBQUMsRUFDMUMzRixJQUFJLENBQUNnVyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ2xDOztRQUVBO1FBQ0FoVyxJQUFJLENBQUNpVyxhQUFhLENBQUMsQ0FBQztNQUN0Qjs7TUFFQTtNQUNBO01BQ0FELHVCQUF1QkEsQ0FBQSxFQUFHO1FBQ3hCLE1BQU1oVyxJQUFJLEdBQUcsSUFBSTtRQUVqQixJQUFJa0QsT0FBTyxDQUFDbEQsSUFBSSxDQUFDMkYsd0JBQXdCLENBQUMsRUFBRTtVQUMxQztRQUNGO1FBRUEzRixJQUFJLENBQUMyRix3QkFBd0IsQ0FBQyxDQUFDLENBQUMsQ0FBQzBGLE9BQU8sQ0FBQ2xELE9BQU8sQ0FBQ3dOLENBQUMsSUFBSTtVQUNwREEsQ0FBQyxDQUFDcFUsV0FBVyxDQUFDLENBQUM7UUFDakIsQ0FBQyxDQUFDO01BQ0o7TUFFQTJVLGVBQWVBLENBQUN0TixHQUFHLEVBQUU7UUFDbkJwRyxNQUFNLENBQUNvQixNQUFNLENBQUMsOEJBQThCLEVBQUVnRixHQUFHLENBQUMwTSxNQUFNLENBQUM7UUFDekQsSUFBSTFNLEdBQUcsQ0FBQ3VOLGdCQUFnQixFQUFFM1QsTUFBTSxDQUFDb0IsTUFBTSxDQUFDLE9BQU8sRUFBRWdGLEdBQUcsQ0FBQ3VOLGdCQUFnQixDQUFDO01BQ3hFO01BRUFDLG9EQUFvREEsQ0FBQSxFQUFHO1FBQ3JELE1BQU1wVyxJQUFJLEdBQUcsSUFBSTtRQUNqQixNQUFNcVcsMEJBQTBCLEdBQUdyVyxJQUFJLENBQUMyRix3QkFBd0I7UUFDaEUzRixJQUFJLENBQUMyRix3QkFBd0IsR0FBRyxFQUFFO1FBRWxDM0YsSUFBSSxDQUFDeUUsV0FBVyxJQUFJekUsSUFBSSxDQUFDeUUsV0FBVyxDQUFDLENBQUM7UUFDdEM3RSxHQUFHLENBQUMwVyxjQUFjLENBQUNDLElBQUksQ0FBQzdWLFFBQVEsSUFBSTtVQUNsQ0EsUUFBUSxDQUFDVixJQUFJLENBQUM7VUFDZCxPQUFPLElBQUk7UUFDYixDQUFDLENBQUM7UUFFRixJQUFJa0QsT0FBTyxDQUFDbVQsMEJBQTBCLENBQUMsRUFBRTs7UUFFekM7UUFDQTtRQUNBO1FBQ0EsSUFBSW5ULE9BQU8sQ0FBQ2xELElBQUksQ0FBQzJGLHdCQUF3QixDQUFDLEVBQUU7VUFDMUMzRixJQUFJLENBQUMyRix3QkFBd0IsR0FBRzBRLDBCQUEwQjtVQUMxRHJXLElBQUksQ0FBQ2dXLHVCQUF1QixDQUFDLENBQUM7VUFDOUI7UUFDRjs7UUFFQTtRQUNBO1FBQ0E7UUFDQSxJQUFJLENBQUU3UyxJQUFJLENBQUNuRCxJQUFJLENBQUMyRix3QkFBd0IsQ0FBQyxDQUFDekUsSUFBSSxJQUMxQyxDQUFFbVYsMEJBQTBCLENBQUMsQ0FBQyxDQUFDLENBQUNuVixJQUFJLEVBQUU7VUFDeENtViwwQkFBMEIsQ0FBQyxDQUFDLENBQUMsQ0FBQ2hMLE9BQU8sQ0FBQ2xELE9BQU8sQ0FBQ3dOLENBQUMsSUFBSTtZQUNqRHhTLElBQUksQ0FBQ25ELElBQUksQ0FBQzJGLHdCQUF3QixDQUFDLENBQUMwRixPQUFPLENBQUN3RCxJQUFJLENBQUM4RyxDQUFDLENBQUM7O1lBRW5EO1lBQ0EsSUFBSTNWLElBQUksQ0FBQzJGLHdCQUF3QixDQUFDZ0QsTUFBTSxLQUFLLENBQUMsRUFBRTtjQUM5Q2dOLENBQUMsQ0FBQ3BVLFdBQVcsQ0FBQyxDQUFDO1lBQ2pCO1VBQ0YsQ0FBQyxDQUFDO1VBRUY4VSwwQkFBMEIsQ0FBQzNILEtBQUssQ0FBQyxDQUFDO1FBQ3BDOztRQUVBO1FBQ0ExTyxJQUFJLENBQUMyRix3QkFBd0IsQ0FBQ2tKLElBQUksQ0FBQyxHQUFHd0gsMEJBQTBCLENBQUM7TUFDbkU7O01BRUE7TUFDQWhQLGVBQWVBLENBQUEsRUFBRztRQUNoQixPQUFPbkUsT0FBTyxDQUFDLElBQUksQ0FBQzVCLGVBQWUsQ0FBQztNQUN0Qzs7TUFFQTtNQUNBO01BQ0EyVSxhQUFhQSxDQUFBLEVBQUc7UUFDZCxNQUFNalcsSUFBSSxHQUFHLElBQUk7UUFDakIsSUFBSUEsSUFBSSxDQUFDbUcsYUFBYSxJQUFJbkcsSUFBSSxDQUFDcUgsZUFBZSxDQUFDLENBQUMsRUFBRTtVQUNoRHJILElBQUksQ0FBQ21HLGFBQWEsQ0FBQyxDQUFDO1VBQ3BCbkcsSUFBSSxDQUFDbUcsYUFBYSxHQUFHLElBQUk7UUFDM0I7TUFDRjtNQUVBLE1BQU13QixTQUFTQSxDQUFDNk8sT0FBTyxFQUFFO1FBQ3ZCLElBQUk1TixHQUFHO1FBQ1AsSUFBSTtVQUNGQSxHQUFHLEdBQUduRyxTQUFTLENBQUNnVSxRQUFRLENBQUNELE9BQU8sQ0FBQztRQUNuQyxDQUFDLENBQUMsT0FBTzdKLENBQUMsRUFBRTtVQUNWbkssTUFBTSxDQUFDb0IsTUFBTSxDQUFDLDZCQUE2QixFQUFFK0ksQ0FBQyxDQUFDO1VBQy9DO1FBQ0Y7O1FBRUE7UUFDQTtRQUNBLElBQUksSUFBSSxDQUFDcEYsVUFBVSxFQUFFO1VBQ25CLElBQUksQ0FBQ0EsVUFBVSxDQUFDbVAsZUFBZSxDQUFDLENBQUM7UUFDbkM7UUFFQSxJQUFJOU4sR0FBRyxLQUFLLElBQUksSUFBSSxDQUFDQSxHQUFHLENBQUNBLEdBQUcsRUFBRTtVQUM1QixJQUFHLENBQUNBLEdBQUcsSUFBSSxDQUFDQSxHQUFHLENBQUMrTixvQkFBb0IsRUFBRTtZQUNwQyxJQUFJM1MsTUFBTSxDQUFDZixJQUFJLENBQUMyRixHQUFHLENBQUMsQ0FBQ0QsTUFBTSxLQUFLLENBQUMsSUFBSUMsR0FBRyxDQUFDZ08sU0FBUyxFQUFFO1lBQ3BEcFUsTUFBTSxDQUFDb0IsTUFBTSxDQUFDLHFDQUFxQyxFQUFFZ0YsR0FBRyxDQUFDO1VBQzNEO1VBQ0E7UUFDRjtRQUVBLElBQUlBLEdBQUcsQ0FBQ0EsR0FBRyxLQUFLLFdBQVcsRUFBRTtVQUMzQixJQUFJLENBQUN4RCxRQUFRLEdBQUcsSUFBSSxDQUFDRCxrQkFBa0I7VUFDdkMsTUFBTSxJQUFJLENBQUNtTSxtQkFBbUIsQ0FBQzFJLEdBQUcsQ0FBQztVQUNuQyxJQUFJLENBQUN0SSxPQUFPLENBQUNtRCxXQUFXLENBQUMsQ0FBQztRQUM1QixDQUFDLE1BQU0sSUFBSW1GLEdBQUcsQ0FBQ0EsR0FBRyxLQUFLLFFBQVEsRUFBRTtVQUMvQixJQUFJLElBQUksQ0FBQ3BELHFCQUFxQixDQUFDcVIsT0FBTyxDQUFDak8sR0FBRyxDQUFDa08sT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3hELElBQUksQ0FBQzNSLGtCQUFrQixHQUFHeUQsR0FBRyxDQUFDa08sT0FBTztZQUNyQyxJQUFJLENBQUNwUyxPQUFPLENBQUNxTSxTQUFTLENBQUM7Y0FBRWdHLE1BQU0sRUFBRTtZQUFLLENBQUMsQ0FBQztVQUMxQyxDQUFDLE1BQU07WUFDTCxNQUFNcFQsV0FBVyxHQUNmLDJEQUEyRCxHQUMzRGlGLEdBQUcsQ0FBQ2tPLE9BQU87WUFDYixJQUFJLENBQUNwUyxPQUFPLENBQUNzTSxVQUFVLENBQUM7Y0FBRUUsVUFBVSxFQUFFLElBQUk7Y0FBRThGLE1BQU0sRUFBRXJUO1lBQVksQ0FBQyxDQUFDO1lBQ2xFLElBQUksQ0FBQ3JELE9BQU8sQ0FBQ29ELDhCQUE4QixDQUFDQyxXQUFXLENBQUM7VUFDMUQ7UUFDRixDQUFDLE1BQU0sSUFBSWlGLEdBQUcsQ0FBQ0EsR0FBRyxLQUFLLE1BQU0sSUFBSSxJQUFJLENBQUN0SSxPQUFPLENBQUNnRSxjQUFjLEVBQUU7VUFDNUQsSUFBSSxDQUFDM0MsS0FBSyxDQUFDO1lBQUVpSCxHQUFHLEVBQUUsTUFBTTtZQUFFcUIsRUFBRSxFQUFFckIsR0FBRyxDQUFDcUI7VUFBRyxDQUFDLENBQUM7UUFDekMsQ0FBQyxNQUFNLElBQUlyQixHQUFHLENBQUNBLEdBQUcsS0FBSyxNQUFNLEVBQUU7VUFDN0I7UUFBQSxDQUNELE1BQU0sSUFDTCxDQUFDLE9BQU8sRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQ3FPLFFBQVEsQ0FBQ3JPLEdBQUcsQ0FBQ0EsR0FBRyxDQUFDLEVBQ3JFO1VBQ0EsTUFBTSxJQUFJLENBQUMySixjQUFjLENBQUMzSixHQUFHLENBQUM7UUFDaEMsQ0FBQyxNQUFNLElBQUlBLEdBQUcsQ0FBQ0EsR0FBRyxLQUFLLE9BQU8sRUFBRTtVQUM5QixNQUFNLElBQUksQ0FBQ3VNLGVBQWUsQ0FBQ3ZNLEdBQUcsQ0FBQztRQUNqQyxDQUFDLE1BQU0sSUFBSUEsR0FBRyxDQUFDQSxHQUFHLEtBQUssUUFBUSxFQUFFO1VBQy9CLE1BQU0sSUFBSSxDQUFDNE0sZ0JBQWdCLENBQUM1TSxHQUFHLENBQUM7UUFDbEMsQ0FBQyxNQUFNLElBQUlBLEdBQUcsQ0FBQ0EsR0FBRyxLQUFLLE9BQU8sRUFBRTtVQUM5QixJQUFJLENBQUNzTixlQUFlLENBQUN0TixHQUFHLENBQUM7UUFDM0IsQ0FBQyxNQUFNO1VBQ0xwRyxNQUFNLENBQUNvQixNQUFNLENBQUMsMENBQTBDLEVBQUVnRixHQUFHLENBQUM7UUFDaEU7TUFDRjtNQUVBZixPQUFPQSxDQUFBLEVBQUc7UUFDUjtRQUNBO1FBQ0E7UUFDQSxNQUFNZSxHQUFHLEdBQUc7VUFBRUEsR0FBRyxFQUFFO1FBQVUsQ0FBQztRQUM5QixJQUFJLElBQUksQ0FBQzFELGNBQWMsRUFBRTBELEdBQUcsQ0FBQ2dKLE9BQU8sR0FBRyxJQUFJLENBQUMxTSxjQUFjO1FBQzFEMEQsR0FBRyxDQUFDa08sT0FBTyxHQUFHLElBQUksQ0FBQzNSLGtCQUFrQixJQUFJLElBQUksQ0FBQ0sscUJBQXFCLENBQUMsQ0FBQyxDQUFDO1FBQ3RFLElBQUksQ0FBQ0wsa0JBQWtCLEdBQUd5RCxHQUFHLENBQUNrTyxPQUFPO1FBQ3JDbE8sR0FBRyxDQUFDc08sT0FBTyxHQUFHLElBQUksQ0FBQzFSLHFCQUFxQjtRQUN4QyxJQUFJLENBQUM3RCxLQUFLLENBQUNpSCxHQUFHLENBQUM7O1FBRWY7UUFDQTtRQUNBOztRQUVBO1FBQ0E7UUFDQSxJQUFJLElBQUksQ0FBQ2pELHdCQUF3QixDQUFDZ0QsTUFBTSxHQUFHLENBQUMsRUFBRTtVQUM1QztVQUNBO1VBQ0EsTUFBTThNLGtCQUFrQixHQUFHLElBQUksQ0FBQzlQLHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUFDMEYsT0FBTztVQUNuRSxJQUFJLENBQUMxRix3QkFBd0IsQ0FBQyxDQUFDLENBQUMsQ0FBQzBGLE9BQU8sR0FBR29LLGtCQUFrQixDQUFDMEIsTUFBTSxDQUNsRXZJLGFBQWEsSUFBSTtZQUNmO1lBQ0E7WUFDQSxJQUFJQSxhQUFhLENBQUNwTyxXQUFXLElBQUlvTyxhQUFhLENBQUN6TixPQUFPLEVBQUU7Y0FDdEQ7Y0FDQXlOLGFBQWEsQ0FBQzlNLGFBQWEsQ0FDekIsSUFBSVUsTUFBTSxDQUFDZixLQUFLLENBQ2QsbUJBQW1CLEVBQ25CLGlFQUFpRSxHQUMvRCw4REFDSixDQUNGLENBQUM7WUFDSDs7WUFFQTtZQUNBO1lBQ0E7WUFDQSxPQUFPLEVBQUVtTixhQUFhLENBQUNwTyxXQUFXLElBQUlvTyxhQUFhLENBQUN6TixPQUFPLENBQUM7VUFDOUQsQ0FDRixDQUFDO1FBQ0g7O1FBRUE7UUFDQTtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0E7UUFDQTs7UUFFQTtRQUNBO1FBQ0EsSUFDRSxJQUFJLENBQUN3RSx3QkFBd0IsQ0FBQ2dELE1BQU0sR0FBRyxDQUFDLElBQ3hDLElBQUksQ0FBQ2hELHdCQUF3QixDQUFDLENBQUMsQ0FBQyxDQUFDMEYsT0FBTyxDQUFDMUMsTUFBTSxLQUFLLENBQUMsRUFDckQ7VUFDQSxJQUFJLENBQUNoRCx3QkFBd0IsQ0FBQytJLEtBQUssQ0FBQyxDQUFDO1FBQ3ZDOztRQUVBO1FBQ0E7UUFDQXpMLElBQUksQ0FBQyxJQUFJLENBQUMzQixlQUFlLENBQUMsQ0FBQzZHLE9BQU8sQ0FBQzhCLEVBQUUsSUFBSTtVQUN2QyxJQUFJLENBQUMzSSxlQUFlLENBQUMySSxFQUFFLENBQUMsQ0FBQ3pKLFdBQVcsR0FBRyxLQUFLO1FBQzlDLENBQUMsQ0FBQzs7UUFFRjtRQUNBO1FBQ0E7UUFDQTtRQUNBO1FBQ0EsSUFBSSxDQUFDNFYsb0RBQW9ELENBQUMsQ0FBQzs7UUFFM0Q7UUFDQTtRQUNBcFMsTUFBTSxDQUFDc0gsT0FBTyxDQUFDLElBQUksQ0FBQzFFLGNBQWMsQ0FBQyxDQUFDdUIsT0FBTyxDQUFDaVAsS0FBQSxJQUFlO1VBQUEsSUFBZCxDQUFDbk4sRUFBRSxFQUFFSCxHQUFHLENBQUMsR0FBQXNOLEtBQUE7VUFDcEQsSUFBSSxDQUFDelYsS0FBSyxDQUFDO1lBQ1RpSCxHQUFHLEVBQUUsS0FBSztZQUNWcUIsRUFBRSxFQUFFQSxFQUFFO1lBQ05sQyxJQUFJLEVBQUUrQixHQUFHLENBQUMvQixJQUFJO1lBQ2RrQixNQUFNLEVBQUVhLEdBQUcsQ0FBQ2I7VUFDZCxDQUFDLENBQUM7UUFDSixDQUFDLENBQUM7TUFDSjtJQUNGO0lBQUNuSixzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHOzs7Ozs7Ozs7Ozs7OztJQzc3RERQLE1BQU0sQ0FBQ1EsTUFBTSxDQUFDO01BQUNOLEdBQUcsRUFBQ0EsQ0FBQSxLQUFJQTtJQUFHLENBQUMsQ0FBQztJQUFDLElBQUk2QyxTQUFTO0lBQUMvQyxNQUFNLENBQUNDLElBQUksQ0FBQyxtQkFBbUIsRUFBQztNQUFDOEMsU0FBU0EsQ0FBQ04sQ0FBQyxFQUFDO1FBQUNNLFNBQVMsR0FBQ04sQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlLLE1BQU07SUFBQzlDLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLGVBQWUsRUFBQztNQUFDNkMsTUFBTUEsQ0FBQ0wsQ0FBQyxFQUFDO1FBQUNLLE1BQU0sR0FBQ0wsQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlJLFVBQVU7SUFBQzdDLE1BQU0sQ0FBQ0MsSUFBSSxDQUFDLDBCQUEwQixFQUFDO01BQUM0QyxVQUFVQSxDQUFDSixDQUFDLEVBQUM7UUFBQ0ksVUFBVSxHQUFDSixDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSXRDLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU1BLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDO0lBSzdUO0lBQ0E7SUFDQTtJQUNBLE1BQU13WCxjQUFjLEdBQUcsRUFBRTs7SUFFekI7QUFDQTtBQUNBO0FBQ0E7SUFDTyxNQUFNelgsR0FBRyxHQUFHLENBQUMsQ0FBQztJQUVyQjtJQUNBO0lBQ0E7SUFDQUEsR0FBRyxDQUFDdUwsd0JBQXdCLEdBQUcsSUFBSTNJLE1BQU0sQ0FBQzhVLG1CQUFtQixDQUFDLENBQUM7SUFDL0QxWCxHQUFHLENBQUMyWCw2QkFBNkIsR0FBRyxJQUFJL1UsTUFBTSxDQUFDOFUsbUJBQW1CLENBQUMsQ0FBQzs7SUFFcEU7SUFDQTFYLEdBQUcsQ0FBQzRYLGtCQUFrQixHQUFHNVgsR0FBRyxDQUFDdUwsd0JBQXdCO0lBRXJEdkwsR0FBRyxDQUFDNlgsMkJBQTJCLEdBQUcsSUFBSWpWLE1BQU0sQ0FBQzhVLG1CQUFtQixDQUFDLENBQUM7O0lBRWxFO0lBQ0E7SUFDQSxTQUFTSSwwQkFBMEJBLENBQUM1VyxPQUFPLEVBQUU7TUFDM0MsSUFBSSxDQUFDQSxPQUFPLEdBQUdBLE9BQU87SUFDeEI7SUFFQWxCLEdBQUcsQ0FBQ2lGLGVBQWUsR0FBR3JDLE1BQU0sQ0FBQ21WLGFBQWEsQ0FDeEMscUJBQXFCLEVBQ3JCRCwwQkFDRixDQUFDO0lBRUQ5WCxHQUFHLENBQUNnWSxvQkFBb0IsR0FBR3BWLE1BQU0sQ0FBQ21WLGFBQWEsQ0FDN0MsMEJBQTBCLEVBQzFCLE1BQU0sQ0FBQyxDQUNULENBQUM7O0lBRUQ7SUFDQTtJQUNBO0lBQ0EvWCxHQUFHLENBQUNpWSxZQUFZLEdBQUc5UCxJQUFJLElBQUk7TUFDekIsTUFBTStQLEtBQUssR0FBR2xZLEdBQUcsQ0FBQ3VMLHdCQUF3QixDQUFDNEQsR0FBRyxDQUFDLENBQUM7TUFDaEQsT0FBT3RNLFNBQVMsQ0FBQ3NWLFlBQVksQ0FBQ2hKLEdBQUcsQ0FBQytJLEtBQUssRUFBRS9QLElBQUksQ0FBQztJQUNoRCxDQUFDOztJQUVEO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTs7SUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNBbkksR0FBRyxDQUFDb1ksT0FBTyxHQUFHLENBQUN4VSxHQUFHLEVBQUVsRCxPQUFPLEtBQUs7TUFDOUIsTUFBTTJYLEdBQUcsR0FBRyxJQUFJMVYsVUFBVSxDQUFDaUIsR0FBRyxFQUFFbEQsT0FBTyxDQUFDO01BQ3hDK1csY0FBYyxDQUFDeEksSUFBSSxDQUFDb0osR0FBRyxDQUFDLENBQUMsQ0FBQztNQUMxQixPQUFPQSxHQUFHO0lBQ1osQ0FBQztJQUVEclksR0FBRyxDQUFDMFcsY0FBYyxHQUFHLElBQUl6VCxJQUFJLENBQUM7TUFBRXdELGVBQWUsRUFBRTtJQUFNLENBQUMsQ0FBQzs7SUFFekQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0F6RyxHQUFHLENBQUM2RSxXQUFXLEdBQUcvRCxRQUFRLElBQUlkLEdBQUcsQ0FBQzBXLGNBQWMsQ0FBQzRCLFFBQVEsQ0FBQ3hYLFFBQVEsQ0FBQzs7SUFFbkU7SUFDQTtJQUNBO0lBQ0FkLEdBQUcsQ0FBQ3VZLHNCQUFzQixHQUFHLE1BQU1kLGNBQWMsQ0FBQ2UsS0FBSyxDQUNyREMsSUFBSSxJQUFJclUsTUFBTSxDQUFDNEYsTUFBTSxDQUFDeU8sSUFBSSxDQUFDelIsY0FBYyxDQUFDLENBQUN3UixLQUFLLENBQUN0TyxHQUFHLElBQUlBLEdBQUcsQ0FBQ0ksS0FBSyxDQUNuRSxDQUFDO0lBQUNwSyxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9kZHAtY2xpZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IHsgRERQIH0gZnJvbSAnLi4vY29tbW9uL25hbWVzcGFjZS5qcyc7XG4iLCIvLyBBIE1ldGhvZEludm9rZXIgbWFuYWdlcyBzZW5kaW5nIGEgbWV0aG9kIHRvIHRoZSBzZXJ2ZXIgYW5kIGNhbGxpbmcgdGhlIHVzZXInc1xuLy8gY2FsbGJhY2tzLiBPbiBjb25zdHJ1Y3Rpb24sIGl0IHJlZ2lzdGVycyBpdHNlbGYgaW4gdGhlIGNvbm5lY3Rpb24nc1xuLy8gX21ldGhvZEludm9rZXJzIG1hcDsgaXQgcmVtb3ZlcyBpdHNlbGYgb25jZSB0aGUgbWV0aG9kIGlzIGZ1bGx5IGZpbmlzaGVkIGFuZFxuLy8gdGhlIGNhbGxiYWNrIGlzIGludm9rZWQuIFRoaXMgb2NjdXJzIHdoZW4gaXQgaGFzIGJvdGggcmVjZWl2ZWQgYSByZXN1bHQsXG4vLyBhbmQgdGhlIGRhdGEgd3JpdHRlbiBieSBpdCBpcyBmdWxseSB2aXNpYmxlLlxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgTWV0aG9kSW52b2tlciB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICAvLyBQdWJsaWMgKHdpdGhpbiB0aGlzIGZpbGUpIGZpZWxkcy5cbiAgICB0aGlzLm1ldGhvZElkID0gb3B0aW9ucy5tZXRob2RJZDtcbiAgICB0aGlzLnNlbnRNZXNzYWdlID0gZmFsc2U7XG5cbiAgICB0aGlzLl9jYWxsYmFjayA9IG9wdGlvbnMuY2FsbGJhY2s7XG4gICAgdGhpcy5fY29ubmVjdGlvbiA9IG9wdGlvbnMuY29ubmVjdGlvbjtcbiAgICB0aGlzLl9tZXNzYWdlID0gb3B0aW9ucy5tZXNzYWdlO1xuICAgIHRoaXMuX29uUmVzdWx0UmVjZWl2ZWQgPSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgfHwgKCgpID0+IHt9KTtcbiAgICB0aGlzLl93YWl0ID0gb3B0aW9ucy53YWl0O1xuICAgIHRoaXMubm9SZXRyeSA9IG9wdGlvbnMubm9SZXRyeTtcbiAgICB0aGlzLl9tZXRob2RSZXN1bHQgPSBudWxsO1xuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gZmFsc2U7XG5cbiAgICAvLyBSZWdpc3RlciB3aXRoIHRoZSBjb25uZWN0aW9uLlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24uX21ldGhvZEludm9rZXJzW3RoaXMubWV0aG9kSWRdID0gdGhpcztcbiAgfVxuICAvLyBTZW5kcyB0aGUgbWV0aG9kIG1lc3NhZ2UgdG8gdGhlIHNlcnZlci4gTWF5IGJlIGNhbGxlZCBhZGRpdGlvbmFsIHRpbWVzIGlmXG4gIC8vIHdlIGxvc2UgdGhlIGNvbm5lY3Rpb24gYW5kIHJlY29ubmVjdCBiZWZvcmUgcmVjZWl2aW5nIGEgcmVzdWx0LlxuICBzZW5kTWVzc2FnZSgpIHtcbiAgICAvLyBUaGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCBiZWZvcmUgc2VuZGluZyBhIG1ldGhvZCAoaW5jbHVkaW5nIHJlc2VuZGluZyBvblxuICAgIC8vIHJlY29ubmVjdCkuIFdlIHNob3VsZCBvbmx5IChyZSlzZW5kIG1ldGhvZHMgd2hlcmUgd2UgZG9uJ3QgYWxyZWFkeSBoYXZlIGFcbiAgICAvLyByZXN1bHQhXG4gICAgaWYgKHRoaXMuZ290UmVzdWx0KCkpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3NlbmRpbmdNZXRob2QgaXMgY2FsbGVkIG9uIG1ldGhvZCB3aXRoIHJlc3VsdCcpO1xuXG4gICAgLy8gSWYgd2UncmUgcmUtc2VuZGluZyBpdCwgaXQgZG9lc24ndCBtYXR0ZXIgaWYgZGF0YSB3YXMgd3JpdHRlbiB0aGUgZmlyc3RcbiAgICAvLyB0aW1lLlxuICAgIHRoaXMuX2RhdGFWaXNpYmxlID0gZmFsc2U7XG4gICAgdGhpcy5zZW50TWVzc2FnZSA9IHRydWU7XG5cbiAgICAvLyBJZiB0aGlzIGlzIGEgd2FpdCBtZXRob2QsIG1ha2UgYWxsIGRhdGEgbWVzc2FnZXMgYmUgYnVmZmVyZWQgdW50aWwgaXQgaXNcbiAgICAvLyBkb25lLlxuICAgIGlmICh0aGlzLl93YWl0KVxuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVt0aGlzLm1ldGhvZElkXSA9IHRydWU7XG5cbiAgICAvLyBBY3R1YWxseSBzZW5kIHRoZSBtZXNzYWdlLlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24uX3NlbmQodGhpcy5fbWVzc2FnZSk7XG4gIH1cbiAgLy8gSW52b2tlIHRoZSBjYWxsYmFjaywgaWYgd2UgaGF2ZSBib3RoIGEgcmVzdWx0IGFuZCBrbm93IHRoYXQgYWxsIGRhdGEgaGFzXG4gIC8vIGJlZW4gd3JpdHRlbiB0byB0aGUgbG9jYWwgY2FjaGUuXG4gIF9tYXliZUludm9rZUNhbGxiYWNrKCkge1xuICAgIGlmICh0aGlzLl9tZXRob2RSZXN1bHQgJiYgdGhpcy5fZGF0YVZpc2libGUpIHtcbiAgICAgIC8vIENhbGwgdGhlIGNhbGxiYWNrLiAoVGhpcyB3b24ndCB0aHJvdzogdGhlIGNhbGxiYWNrIHdhcyB3cmFwcGVkIHdpdGhcbiAgICAgIC8vIGJpbmRFbnZpcm9ubWVudC4pXG4gICAgICB0aGlzLl9jYWxsYmFjayh0aGlzLl9tZXRob2RSZXN1bHRbMF0sIHRoaXMuX21ldGhvZFJlc3VsdFsxXSk7XG5cbiAgICAgIC8vIEZvcmdldCBhYm91dCB0aGlzIG1ldGhvZC5cbiAgICAgIGRlbGV0ZSB0aGlzLl9jb25uZWN0aW9uLl9tZXRob2RJbnZva2Vyc1t0aGlzLm1ldGhvZElkXTtcblxuICAgICAgLy8gTGV0IHRoZSBjb25uZWN0aW9uIGtub3cgdGhhdCB0aGlzIG1ldGhvZCBpcyBmaW5pc2hlZCwgc28gaXQgY2FuIHRyeSB0b1xuICAgICAgLy8gbW92ZSBvbiB0byB0aGUgbmV4dCBibG9jayBvZiBtZXRob2RzLlxuICAgICAgdGhpcy5fY29ubmVjdGlvbi5fb3V0c3RhbmRpbmdNZXRob2RGaW5pc2hlZCgpO1xuICAgIH1cbiAgfVxuICAvLyBDYWxsIHdpdGggdGhlIHJlc3VsdCBvZiB0aGUgbWV0aG9kIGZyb20gdGhlIHNlcnZlci4gT25seSBtYXkgYmUgY2FsbGVkXG4gIC8vIG9uY2U7IG9uY2UgaXQgaXMgY2FsbGVkLCB5b3Ugc2hvdWxkIG5vdCBjYWxsIHNlbmRNZXNzYWdlIGFnYWluLlxuICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhbiBvblJlc3VsdFJlY2VpdmVkIGNhbGxiYWNrLCBjYWxsIGl0IGltbWVkaWF0ZWx5LlxuICAvLyBUaGVuIGludm9rZSB0aGUgbWFpbiBjYWxsYmFjayBpZiBkYXRhIGlzIGFsc28gdmlzaWJsZS5cbiAgcmVjZWl2ZVJlc3VsdChlcnIsIHJlc3VsdCkge1xuICAgIGlmICh0aGlzLmdvdFJlc3VsdCgpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2RzIHNob3VsZCBvbmx5IHJlY2VpdmUgcmVzdWx0cyBvbmNlJyk7XG4gICAgdGhpcy5fbWV0aG9kUmVzdWx0ID0gW2VyciwgcmVzdWx0XTtcbiAgICB0aGlzLl9vblJlc3VsdFJlY2VpdmVkKGVyciwgcmVzdWx0KTtcbiAgICB0aGlzLl9tYXliZUludm9rZUNhbGxiYWNrKCk7XG4gIH1cbiAgLy8gQ2FsbCB0aGlzIHdoZW4gYWxsIGRhdGEgd3JpdHRlbiBieSB0aGUgbWV0aG9kIGlzIHZpc2libGUuIFRoaXMgbWVhbnMgdGhhdFxuICAvLyB0aGUgbWV0aG9kIGhhcyByZXR1cm5zIGl0cyBcImRhdGEgaXMgZG9uZVwiIG1lc3NhZ2UgKkFORCogYWxsIHNlcnZlclxuICAvLyBkb2N1bWVudHMgdGhhdCBhcmUgYnVmZmVyZWQgYXQgdGhhdCB0aW1lIGhhdmUgYmVlbiB3cml0dGVuIHRvIHRoZSBsb2NhbFxuICAvLyBjYWNoZS4gSW52b2tlcyB0aGUgbWFpbiBjYWxsYmFjayBpZiB0aGUgcmVzdWx0IGhhcyBiZWVuIHJlY2VpdmVkLlxuICBkYXRhVmlzaWJsZSgpIHtcbiAgICB0aGlzLl9kYXRhVmlzaWJsZSA9IHRydWU7XG4gICAgdGhpcy5fbWF5YmVJbnZva2VDYWxsYmFjaygpO1xuICB9XG4gIC8vIFRydWUgaWYgcmVjZWl2ZVJlc3VsdCBoYXMgYmVlbiBjYWxsZWQuXG4gIGdvdFJlc3VsdCgpIHtcbiAgICByZXR1cm4gISF0aGlzLl9tZXRob2RSZXN1bHQ7XG4gIH1cbn1cbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgRERQQ29tbW9uIH0gZnJvbSAnbWV0ZW9yL2RkcC1jb21tb24nO1xuaW1wb3J0IHsgVHJhY2tlciB9IGZyb20gJ21ldGVvci90cmFja2VyJztcbmltcG9ydCB7IEVKU09OIH0gZnJvbSAnbWV0ZW9yL2Vqc29uJztcbmltcG9ydCB7IFJhbmRvbSB9IGZyb20gJ21ldGVvci9yYW5kb20nO1xuaW1wb3J0IHsgSG9vayB9IGZyb20gJ21ldGVvci9jYWxsYmFjay1ob29rJztcbmltcG9ydCB7IE1vbmdvSUQgfSBmcm9tICdtZXRlb3IvbW9uZ28taWQnO1xuaW1wb3J0IHsgRERQIH0gZnJvbSAnLi9uYW1lc3BhY2UuanMnO1xuaW1wb3J0IE1ldGhvZEludm9rZXIgZnJvbSAnLi9NZXRob2RJbnZva2VyLmpzJztcbmltcG9ydCB7XG4gIGhhc093bixcbiAgc2xpY2UsXG4gIGtleXMsXG4gIGlzRW1wdHksXG4gIGxhc3QsXG59IGZyb20gXCJtZXRlb3IvZGRwLWNvbW1vbi91dGlscy5qc1wiO1xuXG5jbGFzcyBNb25nb0lETWFwIGV4dGVuZHMgSWRNYXAge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihNb25nb0lELmlkU3RyaW5naWZ5LCBNb25nb0lELmlkUGFyc2UpO1xuICB9XG59XG5cbi8vIEBwYXJhbSB1cmwge1N0cmluZ3xPYmplY3R9IFVSTCB0byBNZXRlb3IgYXBwLFxuLy8gICBvciBhbiBvYmplY3QgYXMgYSB0ZXN0IGhvb2sgKHNlZSBjb2RlKVxuLy8gT3B0aW9uczpcbi8vICAgcmVsb2FkV2l0aE91dHN0YW5kaW5nOiBpcyBpdCBPSyB0byByZWxvYWQgaWYgdGhlcmUgYXJlIG91dHN0YW5kaW5nIG1ldGhvZHM/XG4vLyAgIGhlYWRlcnM6IGV4dHJhIGhlYWRlcnMgdG8gc2VuZCBvbiB0aGUgd2Vic29ja2V0cyBjb25uZWN0aW9uLCBmb3Jcbi8vICAgICBzZXJ2ZXItdG8tc2VydmVyIEREUCBvbmx5XG4vLyAgIF9zb2NranNPcHRpb25zOiBTcGVjaWZpZXMgb3B0aW9ucyB0byBwYXNzIHRocm91Z2ggdG8gdGhlIHNvY2tqcyBjbGllbnRcbi8vICAgb25ERFBOZWdvdGlhdGlvblZlcnNpb25GYWlsdXJlOiBjYWxsYmFjayB3aGVuIHZlcnNpb24gbmVnb3RpYXRpb24gZmFpbHMuXG4vL1xuLy8gWFhYIFRoZXJlIHNob3VsZCBiZSBhIHdheSB0byBkZXN0cm95IGEgRERQIGNvbm5lY3Rpb24sIGNhdXNpbmcgYWxsXG4vLyBvdXRzdGFuZGluZyBtZXRob2QgY2FsbHMgdG8gZmFpbC5cbi8vXG4vLyBYWFggT3VyIGN1cnJlbnQgd2F5IG9mIGhhbmRsaW5nIGZhaWx1cmUgYW5kIHJlY29ubmVjdGlvbiBpcyBncmVhdFxuLy8gZm9yIGFuIGFwcCAod2hlcmUgd2Ugd2FudCB0byB0b2xlcmF0ZSBiZWluZyBkaXNjb25uZWN0ZWQgYXMgYW5cbi8vIGV4cGVjdCBzdGF0ZSwgYW5kIGtlZXAgdHJ5aW5nIGZvcmV2ZXIgdG8gcmVjb25uZWN0KSBidXQgY3VtYmVyc29tZVxuLy8gZm9yIHNvbWV0aGluZyBsaWtlIGEgY29tbWFuZCBsaW5lIHRvb2wgdGhhdCB3YW50cyB0byBtYWtlIGFcbi8vIGNvbm5lY3Rpb24sIGNhbGwgYSBtZXRob2QsIGFuZCBwcmludCBhbiBlcnJvciBpZiBjb25uZWN0aW9uXG4vLyBmYWlscy4gV2Ugc2hvdWxkIGhhdmUgYmV0dGVyIHVzYWJpbGl0eSBpbiB0aGUgbGF0dGVyIGNhc2UgKHdoaWxlXG4vLyBzdGlsbCB0cmFuc3BhcmVudGx5IHJlY29ubmVjdGluZyBpZiBpdCdzIGp1c3QgYSB0cmFuc2llbnQgZmFpbHVyZVxuLy8gb3IgdGhlIHNlcnZlciBtaWdyYXRpbmcgdXMpLlxuZXhwb3J0IGNsYXNzIENvbm5lY3Rpb24ge1xuICBjb25zdHJ1Y3Rvcih1cmwsIG9wdGlvbnMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgPSB7XG4gICAgICBvbkNvbm5lY3RlZCgpIHt9LFxuICAgICAgb25ERFBWZXJzaW9uTmVnb3RpYXRpb25GYWlsdXJlKGRlc2NyaXB0aW9uKSB7XG4gICAgICAgIE1ldGVvci5fZGVidWcoZGVzY3JpcHRpb24pO1xuICAgICAgfSxcbiAgICAgIGhlYXJ0YmVhdEludGVydmFsOiAxNzUwMCxcbiAgICAgIGhlYXJ0YmVhdFRpbWVvdXQ6IDE1MDAwLFxuICAgICAgbnBtRmF5ZU9wdGlvbnM6IE9iamVjdC5jcmVhdGUobnVsbCksXG4gICAgICAvLyBUaGVzZSBvcHRpb25zIGFyZSBvbmx5IGZvciB0ZXN0aW5nLlxuICAgICAgcmVsb2FkV2l0aE91dHN0YW5kaW5nOiBmYWxzZSxcbiAgICAgIHN1cHBvcnRlZEREUFZlcnNpb25zOiBERFBDb21tb24uU1VQUE9SVEVEX0REUF9WRVJTSU9OUyxcbiAgICAgIHJldHJ5OiB0cnVlLFxuICAgICAgcmVzcG9uZFRvUGluZ3M6IHRydWUsXG4gICAgICAvLyBXaGVuIHVwZGF0ZXMgYXJlIGNvbWluZyB3aXRoaW4gdGhpcyBtcyBpbnRlcnZhbCwgYmF0Y2ggdGhlbSB0b2dldGhlci5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzSW50ZXJ2YWw6IDUsXG4gICAgICAvLyBGbHVzaCBidWZmZXJzIGltbWVkaWF0ZWx5IGlmIHdyaXRlcyBhcmUgaGFwcGVuaW5nIGNvbnRpbnVvdXNseSBmb3IgbW9yZSB0aGFuIHRoaXMgbWFueSBtcy5cbiAgICAgIGJ1ZmZlcmVkV3JpdGVzTWF4QWdlOiA1MDAsXG5cbiAgICAgIC4uLm9wdGlvbnNcbiAgICB9O1xuXG4gICAgLy8gSWYgc2V0LCBjYWxsZWQgd2hlbiB3ZSByZWNvbm5lY3QsIHF1ZXVpbmcgbWV0aG9kIGNhbGxzIF9iZWZvcmVfIHRoZVxuICAgIC8vIGV4aXN0aW5nIG91dHN0YW5kaW5nIG9uZXMuXG4gICAgLy8gTk9URTogVGhpcyBmZWF0dXJlIGhhcyBiZWVuIHByZXNlcnZlZCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuIFRoZVxuICAgIC8vIHByZWZlcnJlZCBtZXRob2Qgb2Ygc2V0dGluZyBhIGNhbGxiYWNrIG9uIHJlY29ubmVjdCBpcyB0byB1c2VcbiAgICAvLyBERFAub25SZWNvbm5lY3QuXG4gICAgc2VsZi5vblJlY29ubmVjdCA9IG51bGw7XG5cbiAgICAvLyBhcyBhIHRlc3QgaG9vaywgYWxsb3cgcGFzc2luZyBhIHN0cmVhbSBpbnN0ZWFkIG9mIGEgdXJsLlxuICAgIGlmICh0eXBlb2YgdXJsID09PSAnb2JqZWN0Jykge1xuICAgICAgc2VsZi5fc3RyZWFtID0gdXJsO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IENsaWVudFN0cmVhbSB9ID0gcmVxdWlyZShcIm1ldGVvci9zb2NrZXQtc3RyZWFtLWNsaWVudFwiKTtcbiAgICAgIHNlbGYuX3N0cmVhbSA9IG5ldyBDbGllbnRTdHJlYW0odXJsLCB7XG4gICAgICAgIHJldHJ5OiBvcHRpb25zLnJldHJ5LFxuICAgICAgICBDb25uZWN0aW9uRXJyb3I6IEREUC5Db25uZWN0aW9uRXJyb3IsXG4gICAgICAgIGhlYWRlcnM6IG9wdGlvbnMuaGVhZGVycyxcbiAgICAgICAgX3NvY2tqc09wdGlvbnM6IG9wdGlvbnMuX3NvY2tqc09wdGlvbnMsXG4gICAgICAgIC8vIFVzZWQgdG8ga2VlcCBzb21lIHRlc3RzIHF1aWV0LCBvciBmb3Igb3RoZXIgY2FzZXMgaW4gd2hpY2hcbiAgICAgICAgLy8gdGhlIHJpZ2h0IHRoaW5nIHRvIGRvIHdpdGggY29ubmVjdGlvbiBlcnJvcnMgaXMgdG8gc2lsZW50bHlcbiAgICAgICAgLy8gZmFpbCAoZS5nLiBzZW5kaW5nIHBhY2thZ2UgdXNhZ2Ugc3RhdHMpLiBBdCBzb21lIHBvaW50IHdlXG4gICAgICAgIC8vIHNob3VsZCBoYXZlIGEgcmVhbCBBUEkgZm9yIGhhbmRsaW5nIGNsaWVudC1zdHJlYW0tbGV2ZWxcbiAgICAgICAgLy8gZXJyb3JzLlxuICAgICAgICBfZG9udFByaW50RXJyb3JzOiBvcHRpb25zLl9kb250UHJpbnRFcnJvcnMsXG4gICAgICAgIGNvbm5lY3RUaW1lb3V0TXM6IG9wdGlvbnMuY29ubmVjdFRpbWVvdXRNcyxcbiAgICAgICAgbnBtRmF5ZU9wdGlvbnM6IG9wdGlvbnMubnBtRmF5ZU9wdGlvbnNcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHNlbGYuX2xhc3RTZXNzaW9uSWQgPSBudWxsO1xuICAgIHNlbGYuX3ZlcnNpb25TdWdnZXN0aW9uID0gbnVsbDsgLy8gVGhlIGxhc3QgcHJvcG9zZWQgRERQIHZlcnNpb24uXG4gICAgc2VsZi5fdmVyc2lvbiA9IG51bGw7IC8vIFRoZSBERFAgdmVyc2lvbiBhZ3JlZWQgb24gYnkgY2xpZW50IGFuZCBzZXJ2ZXIuXG4gICAgc2VsZi5fc3RvcmVzID0gT2JqZWN0LmNyZWF0ZShudWxsKTsgLy8gbmFtZSAtPiBvYmplY3Qgd2l0aCBtZXRob2RzXG4gICAgc2VsZi5fbWV0aG9kSGFuZGxlcnMgPSBPYmplY3QuY3JlYXRlKG51bGwpOyAvLyBuYW1lIC0+IGZ1bmNcbiAgICBzZWxmLl9uZXh0TWV0aG9kSWQgPSAxO1xuICAgIHNlbGYuX3N1cHBvcnRlZEREUFZlcnNpb25zID0gb3B0aW9ucy5zdXBwb3J0ZWRERFBWZXJzaW9ucztcblxuICAgIHNlbGYuX2hlYXJ0YmVhdEludGVydmFsID0gb3B0aW9ucy5oZWFydGJlYXRJbnRlcnZhbDtcbiAgICBzZWxmLl9oZWFydGJlYXRUaW1lb3V0ID0gb3B0aW9ucy5oZWFydGJlYXRUaW1lb3V0O1xuXG4gICAgLy8gVHJhY2tzIG1ldGhvZHMgd2hpY2ggdGhlIHVzZXIgaGFzIHRyaWVkIHRvIGNhbGwgYnV0IHdoaWNoIGhhdmUgbm90IHlldFxuICAgIC8vIGNhbGxlZCB0aGVpciB1c2VyIGNhbGxiYWNrIChpZSwgdGhleSBhcmUgd2FpdGluZyBvbiB0aGVpciByZXN1bHQgb3IgZm9yIGFsbFxuICAgIC8vIG9mIHRoZWlyIHdyaXRlcyB0byBiZSB3cml0dGVuIHRvIHRoZSBsb2NhbCBjYWNoZSkuIE1hcCBmcm9tIG1ldGhvZCBJRCB0b1xuICAgIC8vIE1ldGhvZEludm9rZXIgb2JqZWN0LlxuICAgIHNlbGYuX21ldGhvZEludm9rZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIC8vIFRyYWNrcyBtZXRob2RzIHdoaWNoIHRoZSB1c2VyIGhhcyBjYWxsZWQgYnV0IHdob3NlIHJlc3VsdCBtZXNzYWdlcyBoYXZlIG5vdFxuICAgIC8vIGFycml2ZWQgeWV0LlxuICAgIC8vXG4gICAgLy8gX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzIGlzIGFuIGFycmF5IG9mIGJsb2NrcyBvZiBtZXRob2RzLiBFYWNoIGJsb2NrXG4gICAgLy8gcmVwcmVzZW50cyBhIHNldCBvZiBtZXRob2RzIHRoYXQgY2FuIHJ1biBhdCB0aGUgc2FtZSB0aW1lLiBUaGUgZmlyc3QgYmxvY2tcbiAgICAvLyByZXByZXNlbnRzIHRoZSBtZXRob2RzIHdoaWNoIGFyZSBjdXJyZW50bHkgaW4gZmxpZ2h0OyBzdWJzZXF1ZW50IGJsb2Nrc1xuICAgIC8vIG11c3Qgd2FpdCBmb3IgcHJldmlvdXMgYmxvY2tzIHRvIGJlIGZ1bGx5IGZpbmlzaGVkIGJlZm9yZSB0aGV5IGNhbiBiZSBzZW50XG4gICAgLy8gdG8gdGhlIHNlcnZlci5cbiAgICAvL1xuICAgIC8vIEVhY2ggYmxvY2sgaXMgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4gICAgLy8gLSBtZXRob2RzOiBhIGxpc3Qgb2YgTWV0aG9kSW52b2tlciBvYmplY3RzXG4gICAgLy8gLSB3YWl0OiBhIGJvb2xlYW47IGlmIHRydWUsIHRoaXMgYmxvY2sgaGFkIGEgc2luZ2xlIG1ldGhvZCBpbnZva2VkIHdpdGhcbiAgICAvLyAgICAgICAgIHRoZSBcIndhaXRcIiBvcHRpb25cbiAgICAvL1xuICAgIC8vIFRoZXJlIHdpbGwgbmV2ZXIgYmUgYWRqYWNlbnQgYmxvY2tzIHdpdGggd2FpdD1mYWxzZSwgYmVjYXVzZSB0aGUgb25seSB0aGluZ1xuICAgIC8vIHRoYXQgbWFrZXMgbWV0aG9kcyBuZWVkIHRvIGJlIHNlcmlhbGl6ZWQgaXMgYSB3YWl0IG1ldGhvZC5cbiAgICAvL1xuICAgIC8vIE1ldGhvZHMgYXJlIHJlbW92ZWQgZnJvbSB0aGUgZmlyc3QgYmxvY2sgd2hlbiB0aGVpciBcInJlc3VsdFwiIGlzXG4gICAgLy8gcmVjZWl2ZWQuIFRoZSBlbnRpcmUgZmlyc3QgYmxvY2sgaXMgb25seSByZW1vdmVkIHdoZW4gYWxsIG9mIHRoZSBpbi1mbGlnaHRcbiAgICAvLyBtZXRob2RzIGhhdmUgcmVjZWl2ZWQgdGhlaXIgcmVzdWx0cyAoc28gdGhlIFwibWV0aG9kc1wiIGxpc3QgaXMgZW1wdHkpICpBTkQqXG4gICAgLy8gYWxsIG9mIHRoZSBkYXRhIHdyaXR0ZW4gYnkgdGhvc2UgbWV0aG9kcyBhcmUgdmlzaWJsZSBpbiB0aGUgbG9jYWwgY2FjaGUuIFNvXG4gICAgLy8gaXQgaXMgcG9zc2libGUgZm9yIHRoZSBmaXJzdCBibG9jaydzIG1ldGhvZHMgbGlzdCB0byBiZSBlbXB0eSwgaWYgd2UgYXJlXG4gICAgLy8gc3RpbGwgd2FpdGluZyBmb3Igc29tZSBvYmplY3RzIHRvIHF1aWVzY2UuXG4gICAgLy9cbiAgICAvLyBFeGFtcGxlOlxuICAgIC8vICBfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXG4gICAgLy8gICAge3dhaXQ6IGZhbHNlLCBtZXRob2RzOiBbXX0sXG4gICAgLy8gICAge3dhaXQ6IHRydWUsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2xvZ2luJz5dfSxcbiAgICAvLyAgICB7d2FpdDogZmFsc2UsIG1ldGhvZHM6IFs8TWV0aG9kSW52b2tlciBmb3IgJ2Zvbyc+LFxuICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxNZXRob2RJbnZva2VyIGZvciAnYmFyJz5dfV1cbiAgICAvLyBUaGlzIG1lYW5zIHRoYXQgdGhlcmUgd2VyZSBzb21lIG1ldGhvZHMgd2hpY2ggd2VyZSBzZW50IHRvIHRoZSBzZXJ2ZXIgYW5kXG4gICAgLy8gd2hpY2ggaGF2ZSByZXR1cm5lZCB0aGVpciByZXN1bHRzLCBidXQgc29tZSBvZiB0aGUgZGF0YSB3cml0dGVuIGJ5XG4gICAgLy8gdGhlIG1ldGhvZHMgbWF5IG5vdCBiZSB2aXNpYmxlIGluIHRoZSBsb2NhbCBjYWNoZS4gT25jZSBhbGwgdGhhdCBkYXRhIGlzXG4gICAgLy8gdmlzaWJsZSwgd2Ugd2lsbCBzZW5kIGEgJ2xvZ2luJyBtZXRob2QuIE9uY2UgdGhlIGxvZ2luIG1ldGhvZCBoYXMgcmV0dXJuZWRcbiAgICAvLyBhbmQgYWxsIHRoZSBkYXRhIGlzIHZpc2libGUgKGluY2x1ZGluZyByZS1ydW5uaW5nIHN1YnMgaWYgdXNlcklkIGNoYW5nZXMpLFxuICAgIC8vIHdlIHdpbGwgc2VuZCB0aGUgJ2ZvbycgYW5kICdiYXInIG1ldGhvZHMgaW4gcGFyYWxsZWwuXG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBbXTtcblxuICAgIC8vIG1ldGhvZCBJRCAtPiBhcnJheSBvZiBvYmplY3RzIHdpdGgga2V5cyAnY29sbGVjdGlvbicgYW5kICdpZCcsIGxpc3RpbmdcbiAgICAvLyBkb2N1bWVudHMgd3JpdHRlbiBieSBhIGdpdmVuIG1ldGhvZCdzIHN0dWIuIGtleXMgYXJlIGFzc29jaWF0ZWQgd2l0aFxuICAgIC8vIG1ldGhvZHMgd2hvc2Ugc3R1YiB3cm90ZSBhdCBsZWFzdCBvbmUgZG9jdW1lbnQsIGFuZCB3aG9zZSBkYXRhLWRvbmUgbWVzc2FnZVxuICAgIC8vIGhhcyBub3QgeWV0IGJlZW4gcmVjZWl2ZWQuXG4gICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiA9IHt9O1xuICAgIC8vIGNvbGxlY3Rpb24gLT4gSWRNYXAgb2YgXCJzZXJ2ZXIgZG9jdW1lbnRcIiBvYmplY3QuIEEgXCJzZXJ2ZXIgZG9jdW1lbnRcIiBoYXM6XG4gICAgLy8gLSBcImRvY3VtZW50XCI6IHRoZSB2ZXJzaW9uIG9mIHRoZSBkb2N1bWVudCBhY2NvcmRpbmcgdGhlXG4gICAgLy8gICBzZXJ2ZXIgKGllLCB0aGUgc25hcHNob3QgYmVmb3JlIGEgc3R1YiB3cm90ZSBpdCwgYW1lbmRlZCBieSBhbnkgY2hhbmdlc1xuICAgIC8vICAgcmVjZWl2ZWQgZnJvbSB0aGUgc2VydmVyKVxuICAgIC8vICAgSXQgaXMgdW5kZWZpbmVkIGlmIHdlIHRoaW5rIHRoZSBkb2N1bWVudCBkb2VzIG5vdCBleGlzdFxuICAgIC8vIC0gXCJ3cml0dGVuQnlTdHVic1wiOiBhIHNldCBvZiBtZXRob2QgSURzIHdob3NlIHN0dWJzIHdyb3RlIHRvIHRoZSBkb2N1bWVudFxuICAgIC8vICAgd2hvc2UgXCJkYXRhIGRvbmVcIiBtZXNzYWdlcyBoYXZlIG5vdCB5ZXQgYmVlbiBwcm9jZXNzZWRcbiAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHMgPSB7fTtcblxuICAgIC8vIEFycmF5IG9mIGNhbGxiYWNrcyB0byBiZSBjYWxsZWQgYWZ0ZXIgdGhlIG5leHQgdXBkYXRlIG9mIHRoZSBsb2NhbFxuICAgIC8vIGNhY2hlLiBVc2VkIGZvcjpcbiAgICAvLyAgLSBDYWxsaW5nIG1ldGhvZEludm9rZXIuZGF0YVZpc2libGUgYW5kIHN1YiByZWFkeSBjYWxsYmFja3MgYWZ0ZXJcbiAgICAvLyAgICB0aGUgcmVsZXZhbnQgZGF0YSBpcyBmbHVzaGVkLlxuICAgIC8vICAtIEludm9raW5nIHRoZSBjYWxsYmFja3Mgb2YgXCJoYWxmLWZpbmlzaGVkXCIgbWV0aG9kcyBhZnRlciByZWNvbm5lY3RcbiAgICAvLyAgICBxdWllc2NlbmNlLiBTcGVjaWZpY2FsbHksIG1ldGhvZHMgd2hvc2UgcmVzdWx0IHdhcyByZWNlaXZlZCBvdmVyIHRoZSBvbGRcbiAgICAvLyAgICBjb25uZWN0aW9uIChzbyB3ZSBkb24ndCByZS1zZW5kIGl0KSBidXQgd2hvc2UgZGF0YSBoYWQgbm90IGJlZW4gbWFkZVxuICAgIC8vICAgIHZpc2libGUuXG4gICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MgPSBbXTtcblxuICAgIC8vIEluIHR3byBjb250ZXh0cywgd2UgYnVmZmVyIGFsbCBpbmNvbWluZyBkYXRhIG1lc3NhZ2VzIGFuZCB0aGVuIHByb2Nlc3MgdGhlbVxuICAgIC8vIGFsbCBhdCBvbmNlIGluIGEgc2luZ2xlIHVwZGF0ZTpcbiAgICAvLyAgIC0gRHVyaW5nIHJlY29ubmVjdCwgd2UgYnVmZmVyIGFsbCBkYXRhIG1lc3NhZ2VzIHVudGlsIGFsbCBzdWJzIHRoYXQgaGFkXG4gICAgLy8gICAgIGJlZW4gcmVhZHkgYmVmb3JlIHJlY29ubmVjdCBhcmUgcmVhZHkgYWdhaW4sIGFuZCBhbGwgbWV0aG9kcyB0aGF0IGFyZVxuICAgIC8vICAgICBhY3RpdmUgaGF2ZSByZXR1cm5lZCB0aGVpciBcImRhdGEgZG9uZSBtZXNzYWdlXCI7IHRoZW5cbiAgICAvLyAgIC0gRHVyaW5nIHRoZSBleGVjdXRpb24gb2YgYSBcIndhaXRcIiBtZXRob2QsIHdlIGJ1ZmZlciBhbGwgZGF0YSBtZXNzYWdlc1xuICAgIC8vICAgICB1bnRpbCB0aGUgd2FpdCBtZXRob2QgZ2V0cyBpdHMgXCJkYXRhIGRvbmVcIiBtZXNzYWdlLiAoSWYgdGhlIHdhaXQgbWV0aG9kXG4gICAgLy8gICAgIG9jY3VycyBkdXJpbmcgcmVjb25uZWN0LCBpdCBkb2Vzbid0IGdldCBhbnkgc3BlY2lhbCBoYW5kbGluZy4pXG4gICAgLy8gYWxsIGRhdGEgbWVzc2FnZXMgYXJlIHByb2Nlc3NlZCBpbiBvbmUgdXBkYXRlLlxuICAgIC8vXG4gICAgLy8gVGhlIGZvbGxvd2luZyBmaWVsZHMgYXJlIHVzZWQgZm9yIHRoaXMgXCJxdWllc2NlbmNlXCIgcHJvY2Vzcy5cblxuICAgIC8vIFRoaXMgYnVmZmVycyB0aGUgbWVzc2FnZXMgdGhhdCBhcmVuJ3QgYmVpbmcgcHJvY2Vzc2VkIHlldC5cbiAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlID0gW107XG4gICAgLy8gTWFwIGZyb20gbWV0aG9kIElEIC0+IHRydWUuIE1ldGhvZHMgYXJlIHJlbW92ZWQgZnJvbSB0aGlzIHdoZW4gdGhlaXJcbiAgICAvLyBcImRhdGEgZG9uZVwiIG1lc3NhZ2UgaXMgcmVjZWl2ZWQsIGFuZCB3ZSB3aWxsIG5vdCBxdWllc2NlIHVudGlsIGl0IGlzXG4gICAgLy8gZW1wdHkuXG4gICAgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSA9IHt9O1xuICAgIC8vIG1hcCBmcm9tIHN1YiBJRCAtPiB0cnVlIGZvciBzdWJzIHRoYXQgd2VyZSByZWFkeSAoaWUsIGNhbGxlZCB0aGUgc3ViXG4gICAgLy8gcmVhZHkgY2FsbGJhY2spIGJlZm9yZSByZWNvbm5lY3QgYnV0IGhhdmVuJ3QgYmVjb21lIHJlYWR5IGFnYWluIHlldFxuICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWQgPSB7fTsgLy8gbWFwIGZyb20gc3ViLl9pZCAtPiB0cnVlXG4gICAgLy8gaWYgdHJ1ZSwgdGhlIG5leHQgZGF0YSB1cGRhdGUgc2hvdWxkIHJlc2V0IGFsbCBzdG9yZXMuIChzZXQgZHVyaW5nXG4gICAgLy8gcmVjb25uZWN0LilcbiAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgLy8gbmFtZSAtPiBhcnJheSBvZiB1cGRhdGVzIGZvciAoeWV0IHRvIGJlIGNyZWF0ZWQpIGNvbGxlY3Rpb25zXG4gICAgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXMgPSB7fTtcbiAgICAvLyBpZiB3ZSdyZSBibG9ja2luZyBhIG1pZ3JhdGlvbiwgdGhlIHJldHJ5IGZ1bmNcbiAgICBzZWxmLl9yZXRyeU1pZ3JhdGUgPSBudWxsO1xuXG4gICAgc2VsZi5fX2ZsdXNoQnVmZmVyZWRXcml0ZXMgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlcyxcbiAgICAgICdmbHVzaGluZyBERFAgYnVmZmVyZWQgd3JpdGVzJyxcbiAgICAgIHNlbGZcbiAgICApO1xuICAgIC8vIENvbGxlY3Rpb24gbmFtZSAtPiBhcnJheSBvZiBtZXNzYWdlcy5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlcyA9IHt9O1xuICAgIC8vIFdoZW4gY3VycmVudCBidWZmZXIgb2YgdXBkYXRlcyBtdXN0IGJlIGZsdXNoZWQgYXQsIGluIG1zIHRpbWVzdGFtcC5cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPSBudWxsO1xuICAgIC8vIFRpbWVvdXQgaGFuZGxlIGZvciB0aGUgbmV4dCBwcm9jZXNzaW5nIG9mIGFsbCBwZW5kaW5nIHdyaXRlc1xuICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUgPSBudWxsO1xuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNJbnRlcnZhbDtcbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc01heEFnZSA9IG9wdGlvbnMuYnVmZmVyZWRXcml0ZXNNYXhBZ2U7XG5cbiAgICAvLyBtZXRhZGF0YSBmb3Igc3Vic2NyaXB0aW9ucy4gIE1hcCBmcm9tIHN1YiBJRCB0byBvYmplY3Qgd2l0aCBrZXlzOlxuICAgIC8vICAgLSBpZFxuICAgIC8vICAgLSBuYW1lXG4gICAgLy8gICAtIHBhcmFtc1xuICAgIC8vICAgLSBpbmFjdGl2ZSAoaWYgdHJ1ZSwgd2lsbCBiZSBjbGVhbmVkIHVwIGlmIG5vdCByZXVzZWQgaW4gcmUtcnVuKVxuICAgIC8vICAgLSByZWFkeSAoaGFzIHRoZSAncmVhZHknIG1lc3NhZ2UgYmVlbiByZWNlaXZlZD8pXG4gICAgLy8gICAtIHJlYWR5Q2FsbGJhY2sgKGFuIG9wdGlvbmFsIGNhbGxiYWNrIHRvIGNhbGwgd2hlbiByZWFkeSlcbiAgICAvLyAgIC0gZXJyb3JDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCBpZiB0aGUgc3ViIHRlcm1pbmF0ZXMgd2l0aFxuICAgIC8vICAgICAgICAgICAgICAgICAgICBhbiBlcnJvciwgWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEpXG4gICAgLy8gICAtIHN0b3BDYWxsYmFjayAoYW4gb3B0aW9uYWwgY2FsbGJhY2sgdG8gY2FsbCB3aGVuIHRoZSBzdWIgdGVybWluYXRlc1xuICAgIC8vICAgICBmb3IgYW55IHJlYXNvbiwgd2l0aCBhbiBlcnJvciBhcmd1bWVudCBpZiBhbiBlcnJvciB0cmlnZ2VyZWQgdGhlIHN0b3ApXG4gICAgc2VsZi5fc3Vic2NyaXB0aW9ucyA9IHt9O1xuXG4gICAgLy8gUmVhY3RpdmUgdXNlcklkLlxuICAgIHNlbGYuX3VzZXJJZCA9IG51bGw7XG4gICAgc2VsZi5fdXNlcklkRGVwcyA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKTtcblxuICAgIC8vIEJsb2NrIGF1dG8tcmVsb2FkIHdoaWxlIHdlJ3JlIHdhaXRpbmcgZm9yIG1ldGhvZCByZXNwb25zZXMuXG4gICAgaWYgKE1ldGVvci5pc0NsaWVudCAmJlxuICAgICAgUGFja2FnZS5yZWxvYWQgJiZcbiAgICAgICEgb3B0aW9ucy5yZWxvYWRXaXRoT3V0c3RhbmRpbmcpIHtcbiAgICAgIFBhY2thZ2UucmVsb2FkLlJlbG9hZC5fb25NaWdyYXRlKHJldHJ5ID0+IHtcbiAgICAgICAgaWYgKCEgc2VsZi5fcmVhZHlUb01pZ3JhdGUoKSkge1xuICAgICAgICAgIHNlbGYuX3JldHJ5TWlncmF0ZSA9IHJldHJ5O1xuICAgICAgICAgIHJldHVybiBbZmFsc2VdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBbdHJ1ZV07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IG9uRGlzY29ubmVjdCA9ICgpID0+IHtcbiAgICAgIGlmIChzZWxmLl9oZWFydGJlYXQpIHtcbiAgICAgICAgc2VsZi5faGVhcnRiZWF0LnN0b3AoKTtcbiAgICAgICAgc2VsZi5faGVhcnRiZWF0ID0gbnVsbDtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKE1ldGVvci5pc1NlcnZlcikge1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKFxuICAgICAgICAnbWVzc2FnZScsXG4gICAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoXG4gICAgICAgICAgdGhpcy5vbk1lc3NhZ2UuYmluZCh0aGlzKSxcbiAgICAgICAgICAnaGFuZGxpbmcgRERQIG1lc3NhZ2UnXG4gICAgICAgIClcbiAgICAgICk7XG4gICAgICBzZWxmLl9zdHJlYW0ub24oXG4gICAgICAgICdyZXNldCcsXG4gICAgICAgIE1ldGVvci5iaW5kRW52aXJvbm1lbnQodGhpcy5vblJlc2V0LmJpbmQodGhpcyksICdoYW5kbGluZyBERFAgcmVzZXQnKVxuICAgICAgKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbihcbiAgICAgICAgJ2Rpc2Nvbm5lY3QnLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KG9uRGlzY29ubmVjdCwgJ2hhbmRsaW5nIEREUCBkaXNjb25uZWN0JylcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbignbWVzc2FnZScsIHRoaXMub25NZXNzYWdlLmJpbmQodGhpcykpO1xuICAgICAgc2VsZi5fc3RyZWFtLm9uKCdyZXNldCcsIHRoaXMub25SZXNldC5iaW5kKHRoaXMpKTtcbiAgICAgIHNlbGYuX3N0cmVhbS5vbignZGlzY29ubmVjdCcsIG9uRGlzY29ubmVjdCk7XG4gICAgfVxuICB9XG5cbiAgLy8gJ25hbWUnIGlzIHRoZSBuYW1lIG9mIHRoZSBkYXRhIG9uIHRoZSB3aXJlIHRoYXQgc2hvdWxkIGdvIGluIHRoZVxuICAvLyBzdG9yZS4gJ3dyYXBwZWRTdG9yZScgc2hvdWxkIGJlIGFuIG9iamVjdCB3aXRoIG1ldGhvZHMgYmVnaW5VcGRhdGUsIHVwZGF0ZSxcbiAgLy8gZW5kVXBkYXRlLCBzYXZlT3JpZ2luYWxzLCByZXRyaWV2ZU9yaWdpbmFscy4gc2VlIENvbGxlY3Rpb24gZm9yIGFuIGV4YW1wbGUuXG4gIGNyZWF0ZVN0b3JlTWV0aG9kcyhuYW1lLCB3cmFwcGVkU3RvcmUpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChuYW1lIGluIHNlbGYuX3N0b3JlcykgcmV0dXJuIGZhbHNlO1xuXG4gICAgLy8gV3JhcCB0aGUgaW5wdXQgb2JqZWN0IGluIGFuIG9iamVjdCB3aGljaCBtYWtlcyBhbnkgc3RvcmUgbWV0aG9kIG5vdFxuICAgIC8vIGltcGxlbWVudGVkIGJ5ICdzdG9yZScgaW50byBhIG5vLW9wLlxuICAgIGNvbnN0IHN0b3JlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBjb25zdCBrZXlzT2ZTdG9yZSA9IFtcbiAgICAgICd1cGRhdGUnLFxuICAgICAgJ2JlZ2luVXBkYXRlJyxcbiAgICAgICdlbmRVcGRhdGUnLFxuICAgICAgJ3NhdmVPcmlnaW5hbHMnLFxuICAgICAgJ3JldHJpZXZlT3JpZ2luYWxzJyxcbiAgICAgICdnZXREb2MnLFxuICAgICAgJ19nZXRDb2xsZWN0aW9uJ1xuICAgIF07XG4gICAga2V5c09mU3RvcmUuZm9yRWFjaCgobWV0aG9kKSA9PiB7XG4gICAgICBzdG9yZVttZXRob2RdID0gKC4uLmFyZ3MpID0+IHtcbiAgICAgICAgaWYgKHdyYXBwZWRTdG9yZVttZXRob2RdKSB7XG4gICAgICAgICAgcmV0dXJuIHdyYXBwZWRTdG9yZVttZXRob2RdKC4uLmFyZ3MpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuICAgIHNlbGYuX3N0b3Jlc1tuYW1lXSA9IHN0b3JlO1xuICAgIHJldHVybiBzdG9yZTtcbiAgfVxuXG4gIHJlZ2lzdGVyU3RvcmVDbGllbnQobmFtZSwgd3JhcHBlZFN0b3JlKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBjb25zdCBzdG9yZSA9IHNlbGYuY3JlYXRlU3RvcmVNZXRob2RzKG5hbWUsIHdyYXBwZWRTdG9yZSk7XG5cbiAgICBjb25zdCBxdWV1ZWQgPSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3Jlc1tuYW1lXTtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShxdWV1ZWQpKSB7XG4gICAgICBzdG9yZS5iZWdpblVwZGF0ZShxdWV1ZWQubGVuZ3RoLCBmYWxzZSk7XG4gICAgICBxdWV1ZWQuZm9yRWFjaChtc2cgPT4ge1xuICAgICAgICBzdG9yZS51cGRhdGUobXNnKTtcbiAgICAgIH0pO1xuICAgICAgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICBkZWxldGUgc2VsZi5fdXBkYXRlc0ZvclVua25vd25TdG9yZXNbbmFtZV07XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgYXN5bmMgcmVnaXN0ZXJTdG9yZVNlcnZlcihuYW1lLCB3cmFwcGVkU3RvcmUpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGNvbnN0IHN0b3JlID0gc2VsZi5jcmVhdGVTdG9yZU1ldGhvZHMobmFtZSwgd3JhcHBlZFN0b3JlKTtcblxuICAgIGNvbnN0IHF1ZXVlZCA9IHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW25hbWVdO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHF1ZXVlZCkpIHtcbiAgICAgIGF3YWl0IHN0b3JlLmJlZ2luVXBkYXRlKHF1ZXVlZC5sZW5ndGgsIGZhbHNlKTtcbiAgICAgIGZvciAoY29uc3QgbXNnIG9mIHF1ZXVlZCkge1xuICAgICAgICBhd2FpdCBzdG9yZS51cGRhdGUobXNnKTtcbiAgICAgIH1cbiAgICAgIGF3YWl0IHN0b3JlLmVuZFVwZGF0ZSgpO1xuICAgICAgZGVsZXRlIHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzW25hbWVdO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLnN1YnNjcmliZVxuICAgKiBAc3VtbWFyeSBTdWJzY3JpYmUgdG8gYSByZWNvcmQgc2V0LiAgUmV0dXJucyBhIGhhbmRsZSB0aGF0IHByb3ZpZGVzXG4gICAqIGBzdG9wKClgIGFuZCBgcmVhZHkoKWAgbWV0aG9kcy5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIHRoZSBzdWJzY3JpcHRpb24uICBNYXRjaGVzIHRoZSBuYW1lIG9mIHRoZVxuICAgKiBzZXJ2ZXIncyBgcHVibGlzaCgpYCBjYWxsLlxuICAgKiBAcGFyYW0ge0VKU09OYWJsZX0gW2FyZzEsYXJnMi4uLl0gT3B0aW9uYWwgYXJndW1lbnRzIHBhc3NlZCB0byBwdWJsaXNoZXJcbiAgICogZnVuY3Rpb24gb24gc2VydmVyLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufE9iamVjdH0gW2NhbGxiYWNrc10gT3B0aW9uYWwuIE1heSBpbmNsdWRlIGBvblN0b3BgXG4gICAqIGFuZCBgb25SZWFkeWAgY2FsbGJhY2tzLiBJZiB0aGVyZSBpcyBhbiBlcnJvciwgaXQgaXMgcGFzc2VkIGFzIGFuXG4gICAqIGFyZ3VtZW50IHRvIGBvblN0b3BgLiBJZiBhIGZ1bmN0aW9uIGlzIHBhc3NlZCBpbnN0ZWFkIG9mIGFuIG9iamVjdCwgaXRcbiAgICogaXMgaW50ZXJwcmV0ZWQgYXMgYW4gYG9uUmVhZHlgIGNhbGxiYWNrLlxuICAgKi9cbiAgc3Vic2NyaWJlKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gKGNhbGxiYWNrfGNhbGxiYWNrcykgKi8pIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGNvbnN0IHBhcmFtcyA9IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsZXQgY2FsbGJhY2tzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICBpZiAocGFyYW1zLmxlbmd0aCkge1xuICAgICAgY29uc3QgbGFzdFBhcmFtID0gcGFyYW1zW3BhcmFtcy5sZW5ndGggLSAxXTtcbiAgICAgIGlmICh0eXBlb2YgbGFzdFBhcmFtID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNhbGxiYWNrcy5vblJlYWR5ID0gcGFyYW1zLnBvcCgpO1xuICAgICAgfSBlbHNlIGlmIChsYXN0UGFyYW0gJiYgW1xuICAgICAgICBsYXN0UGFyYW0ub25SZWFkeSxcbiAgICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgb25FcnJvciB1c2VkIHRvIGV4aXN0LCBidXQgbm93IHdlIHVzZVxuICAgICAgICAvLyBvblN0b3Agd2l0aCBhbiBlcnJvciBjYWxsYmFjayBpbnN0ZWFkLlxuICAgICAgICBsYXN0UGFyYW0ub25FcnJvcixcbiAgICAgICAgbGFzdFBhcmFtLm9uU3RvcFxuICAgICAgXS5zb21lKGYgPT4gdHlwZW9mIGYgPT09IFwiZnVuY3Rpb25cIikpIHtcbiAgICAgICAgY2FsbGJhY2tzID0gcGFyYW1zLnBvcCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElzIHRoZXJlIGFuIGV4aXN0aW5nIHN1YiB3aXRoIHRoZSBzYW1lIG5hbWUgYW5kIHBhcmFtLCBydW4gaW4gYW5cbiAgICAvLyBpbnZhbGlkYXRlZCBDb21wdXRhdGlvbj8gVGhpcyB3aWxsIGhhcHBlbiBpZiB3ZSBhcmUgcmVydW5uaW5nIGFuXG4gICAgLy8gZXhpc3RpbmcgY29tcHV0YXRpb24uXG4gICAgLy9cbiAgICAvLyBGb3IgZXhhbXBsZSwgY29uc2lkZXIgYSByZXJ1biBvZjpcbiAgICAvL1xuICAgIC8vICAgICBUcmFja2VyLmF1dG9ydW4oZnVuY3Rpb24gKCkge1xuICAgIC8vICAgICAgIE1ldGVvci5zdWJzY3JpYmUoXCJmb29cIiwgU2Vzc2lvbi5nZXQoXCJmb29cIikpO1xuICAgIC8vICAgICAgIE1ldGVvci5zdWJzY3JpYmUoXCJiYXJcIiwgU2Vzc2lvbi5nZXQoXCJiYXJcIikpO1xuICAgIC8vICAgICB9KTtcbiAgICAvL1xuICAgIC8vIElmIFwiZm9vXCIgaGFzIGNoYW5nZWQgYnV0IFwiYmFyXCIgaGFzIG5vdCwgd2Ugd2lsbCBtYXRjaCB0aGUgXCJiYXJcIlxuICAgIC8vIHN1YmNyaWJlIHRvIGFuIGV4aXN0aW5nIGluYWN0aXZlIHN1YnNjcmlwdGlvbiBpbiBvcmRlciB0byBub3RcbiAgICAvLyB1bnN1YiBhbmQgcmVzdWIgdGhlIHN1YnNjcmlwdGlvbiB1bm5lY2Vzc2FyaWx5LlxuICAgIC8vXG4gICAgLy8gV2Ugb25seSBsb29rIGZvciBvbmUgc3VjaCBzdWI7IGlmIHRoZXJlIGFyZSBOIGFwcGFyZW50bHktaWRlbnRpY2FsIHN1YnNcbiAgICAvLyBiZWluZyBpbnZhbGlkYXRlZCwgd2Ugd2lsbCByZXF1aXJlIE4gbWF0Y2hpbmcgc3Vic2NyaWJlIGNhbGxzIHRvIGtlZXBcbiAgICAvLyB0aGVtIGFsbCBhY3RpdmUuXG4gICAgY29uc3QgZXhpc3RpbmcgPSBPYmplY3QudmFsdWVzKHNlbGYuX3N1YnNjcmlwdGlvbnMpLmZpbmQoXG4gICAgICBzdWIgPT4gKHN1Yi5pbmFjdGl2ZSAmJiBzdWIubmFtZSA9PT0gbmFtZSAmJiBFSlNPTi5lcXVhbHMoc3ViLnBhcmFtcywgcGFyYW1zKSlcbiAgICApO1xuXG4gICAgbGV0IGlkO1xuICAgIGlmIChleGlzdGluZykge1xuICAgICAgaWQgPSBleGlzdGluZy5pZDtcbiAgICAgIGV4aXN0aW5nLmluYWN0aXZlID0gZmFsc2U7IC8vIHJlYWN0aXZhdGVcblxuICAgICAgaWYgKGNhbGxiYWNrcy5vblJlYWR5KSB7XG4gICAgICAgIC8vIElmIHRoZSBzdWIgaXMgbm90IGFscmVhZHkgcmVhZHksIHJlcGxhY2UgYW55IHJlYWR5IGNhbGxiYWNrIHdpdGggdGhlXG4gICAgICAgIC8vIG9uZSBwcm92aWRlZCBub3cuIChJdCdzIG5vdCByZWFsbHkgY2xlYXIgd2hhdCB1c2VycyB3b3VsZCBleHBlY3QgZm9yXG4gICAgICAgIC8vIGFuIG9uUmVhZHkgY2FsbGJhY2sgaW5zaWRlIGFuIGF1dG9ydW47IHRoZSBzZW1hbnRpY3Mgd2UgcHJvdmlkZSBpc1xuICAgICAgICAvLyB0aGF0IGF0IHRoZSB0aW1lIHRoZSBzdWIgZmlyc3QgYmVjb21lcyByZWFkeSwgd2UgY2FsbCB0aGUgbGFzdFxuICAgICAgICAvLyBvblJlYWR5IGNhbGxiYWNrIHByb3ZpZGVkLCBpZiBhbnkuKVxuICAgICAgICAvLyBJZiB0aGUgc3ViIGlzIGFscmVhZHkgcmVhZHksIHJ1biB0aGUgcmVhZHkgY2FsbGJhY2sgcmlnaHQgYXdheS5cbiAgICAgICAgLy8gSXQgc2VlbXMgdGhhdCB1c2VycyB3b3VsZCBleHBlY3QgYW4gb25SZWFkeSBjYWxsYmFjayBpbnNpZGUgYW5cbiAgICAgICAgLy8gYXV0b3J1biB0byB0cmlnZ2VyIG9uY2UgdGhlIHRoZSBzdWIgZmlyc3QgYmVjb21lcyByZWFkeSBhbmQgYWxzb1xuICAgICAgICAvLyB3aGVuIHJlLXN1YnMgaGFwcGVucy5cbiAgICAgICAgaWYgKGV4aXN0aW5nLnJlYWR5KSB7XG4gICAgICAgICAgY2FsbGJhY2tzLm9uUmVhZHkoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBleGlzdGluZy5yZWFkeUNhbGxiYWNrID0gY2FsbGJhY2tzLm9uUmVhZHk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgd2UgdXNlZCB0byBoYXZlIG9uRXJyb3IgYnV0IG5vdyB3ZSBjYWxsXG4gICAgICAvLyBvblN0b3Agd2l0aCBhbiBvcHRpb25hbCBlcnJvciBhcmd1bWVudFxuICAgICAgaWYgKGNhbGxiYWNrcy5vbkVycm9yKSB7XG4gICAgICAgIC8vIFJlcGxhY2UgZXhpc3RpbmcgY2FsbGJhY2sgaWYgYW55LCBzbyB0aGF0IGVycm9ycyBhcmVuJ3RcbiAgICAgICAgLy8gZG91YmxlLXJlcG9ydGVkLlxuICAgICAgICBleGlzdGluZy5lcnJvckNhbGxiYWNrID0gY2FsbGJhY2tzLm9uRXJyb3I7XG4gICAgICB9XG5cbiAgICAgIGlmIChjYWxsYmFja3Mub25TdG9wKSB7XG4gICAgICAgIGV4aXN0aW5nLnN0b3BDYWxsYmFjayA9IGNhbGxiYWNrcy5vblN0b3A7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5ldyBzdWIhIEdlbmVyYXRlIGFuIGlkLCBzYXZlIGl0IGxvY2FsbHksIGFuZCBzZW5kIG1lc3NhZ2UuXG4gICAgICBpZCA9IFJhbmRvbS5pZCgpO1xuICAgICAgc2VsZi5fc3Vic2NyaXB0aW9uc1tpZF0gPSB7XG4gICAgICAgIGlkOiBpZCxcbiAgICAgICAgbmFtZTogbmFtZSxcbiAgICAgICAgcGFyYW1zOiBFSlNPTi5jbG9uZShwYXJhbXMpLFxuICAgICAgICBpbmFjdGl2ZTogZmFsc2UsXG4gICAgICAgIHJlYWR5OiBmYWxzZSxcbiAgICAgICAgcmVhZHlEZXBzOiBuZXcgVHJhY2tlci5EZXBlbmRlbmN5KCksXG4gICAgICAgIHJlYWR5Q2FsbGJhY2s6IGNhbGxiYWNrcy5vblJlYWR5LFxuICAgICAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSAjZXJyb3JDYWxsYmFja1xuICAgICAgICBlcnJvckNhbGxiYWNrOiBjYWxsYmFja3Mub25FcnJvcixcbiAgICAgICAgc3RvcENhbGxiYWNrOiBjYWxsYmFja3Mub25TdG9wLFxuICAgICAgICBjb25uZWN0aW9uOiBzZWxmLFxuICAgICAgICByZW1vdmUoKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuY29ubmVjdGlvbi5fc3Vic2NyaXB0aW9uc1t0aGlzLmlkXTtcbiAgICAgICAgICB0aGlzLnJlYWR5ICYmIHRoaXMucmVhZHlEZXBzLmNoYW5nZWQoKTtcbiAgICAgICAgfSxcbiAgICAgICAgc3RvcCgpIHtcbiAgICAgICAgICB0aGlzLmNvbm5lY3Rpb24uX3NlbmQoeyBtc2c6ICd1bnN1YicsIGlkOiBpZCB9KTtcbiAgICAgICAgICB0aGlzLnJlbW92ZSgpO1xuXG4gICAgICAgICAgaWYgKGNhbGxiYWNrcy5vblN0b3ApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrcy5vblN0b3AoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBzZWxmLl9zZW5kKHsgbXNnOiAnc3ViJywgaWQ6IGlkLCBuYW1lOiBuYW1lLCBwYXJhbXM6IHBhcmFtcyB9KTtcbiAgICB9XG5cbiAgICAvLyByZXR1cm4gYSBoYW5kbGUgdG8gdGhlIGFwcGxpY2F0aW9uLlxuICAgIGNvbnN0IGhhbmRsZSA9IHtcbiAgICAgIHN0b3AoKSB7XG4gICAgICAgIGlmICghIGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXS5zdG9wKCk7XG4gICAgICB9LFxuICAgICAgcmVhZHkoKSB7XG4gICAgICAgIC8vIHJldHVybiBmYWxzZSBpZiB3ZSd2ZSB1bnN1YnNjcmliZWQuXG4gICAgICAgIGlmICghaGFzT3duLmNhbGwoc2VsZi5fc3Vic2NyaXB0aW9ucywgaWQpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHJlY29yZCA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdO1xuICAgICAgICByZWNvcmQucmVhZHlEZXBzLmRlcGVuZCgpO1xuICAgICAgICByZXR1cm4gcmVjb3JkLnJlYWR5O1xuICAgICAgfSxcbiAgICAgIHN1YnNjcmlwdGlvbklkOiBpZFxuICAgIH07XG5cbiAgICBpZiAoVHJhY2tlci5hY3RpdmUpIHtcbiAgICAgIC8vIFdlJ3JlIGluIGEgcmVhY3RpdmUgY29tcHV0YXRpb24sIHNvIHdlJ2QgbGlrZSB0byB1bnN1YnNjcmliZSB3aGVuIHRoZVxuICAgICAgLy8gY29tcHV0YXRpb24gaXMgaW52YWxpZGF0ZWQuLi4gYnV0IG5vdCBpZiB0aGUgcmVydW4ganVzdCByZS1zdWJzY3JpYmVzXG4gICAgICAvLyB0byB0aGUgc2FtZSBzdWJzY3JpcHRpb24hICBXaGVuIGEgcmVydW4gaGFwcGVucywgd2UgdXNlIG9uSW52YWxpZGF0ZVxuICAgICAgLy8gYXMgYSBjaGFuZ2UgdG8gbWFyayB0aGUgc3Vic2NyaXB0aW9uIFwiaW5hY3RpdmVcIiBzbyB0aGF0IGl0IGNhblxuICAgICAgLy8gYmUgcmV1c2VkIGZyb20gdGhlIHJlcnVuLiAgSWYgaXQgaXNuJ3QgcmV1c2VkLCBpdCdzIGtpbGxlZCBmcm9tXG4gICAgICAvLyBhbiBhZnRlckZsdXNoLlxuICAgICAgVHJhY2tlci5vbkludmFsaWRhdGUoKGMpID0+IHtcbiAgICAgICAgaWYgKGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSkge1xuICAgICAgICAgIHNlbGYuX3N1YnNjcmlwdGlvbnNbaWRdLmluYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIFRyYWNrZXIuYWZ0ZXJGbHVzaCgoKSA9PiB7XG4gICAgICAgICAgaWYgKGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIGlkKSAmJlxuICAgICAgICAgICAgICBzZWxmLl9zdWJzY3JpcHRpb25zW2lkXS5pbmFjdGl2ZSkge1xuICAgICAgICAgICAgaGFuZGxlLnN0b3AoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhhbmRsZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBUZWxscyBpZiB0aGUgbWV0aG9kIGNhbGwgY2FtZSBmcm9tIGEgY2FsbCBvciBhIGNhbGxBc3luYy5cbiAgICogQGFsaWFzIE1ldGVvci5pc0FzeW5jQ2FsbFxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEByZXR1cm5zIGJvb2xlYW5cbiAgICovXG4gIGlzQXN5bmNDYWxsKCl7XG4gICAgcmV0dXJuIEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uX2lzQ2FsbEFzeW5jTWV0aG9kUnVubmluZygpXG4gIH1cbiAgbWV0aG9kcyhtZXRob2RzKSB7XG4gICAgT2JqZWN0LmVudHJpZXMobWV0aG9kcykuZm9yRWFjaCgoW25hbWUsIGZ1bmNdKSA9PiB7XG4gICAgICBpZiAodHlwZW9mIGZ1bmMgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWV0aG9kICdcIiArIG5hbWUgKyBcIicgbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX21ldGhvZEhhbmRsZXJzW25hbWVdKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkEgbWV0aG9kIG5hbWVkICdcIiArIG5hbWUgKyBcIicgaXMgYWxyZWFkeSBkZWZpbmVkXCIpO1xuICAgICAgfVxuICAgICAgdGhpcy5fbWV0aG9kSGFuZGxlcnNbbmFtZV0gPSBmdW5jO1xuICAgIH0pO1xuICB9XG5cbiAgX2dldElzU2ltdWxhdGlvbih7aXNGcm9tQ2FsbEFzeW5jLCBhbHJlYWR5SW5TaW11bGF0aW9ufSkge1xuICAgIGlmICghaXNGcm9tQ2FsbEFzeW5jKSB7XG4gICAgICByZXR1cm4gYWxyZWFkeUluU2ltdWxhdGlvbjtcbiAgICB9XG4gICAgcmV0dXJuIGFscmVhZHlJblNpbXVsYXRpb24gJiYgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5faXNDYWxsQXN5bmNNZXRob2RSdW5uaW5nKCk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuY2FsbFxuICAgKiBAc3VtbWFyeSBJbnZva2VzIGEgbWV0aG9kIHdpdGggYSBzeW5jIHN0dWIsIHBhc3NpbmcgYW55IG51bWJlciBvZiBhcmd1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBOYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAgICogQHBhcmFtIHtFSlNPTmFibGV9IFthcmcxLGFyZzIuLi5dIE9wdGlvbmFsIG1ldGhvZCBhcmd1bWVudHNcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2FzeW5jQ2FsbGJhY2tdIE9wdGlvbmFsIGNhbGxiYWNrLCB3aGljaCBpcyBjYWxsZWQgYXN5bmNocm9ub3VzbHkgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IGFmdGVyIHRoZSBtZXRob2QgaXMgY29tcGxldGUuIElmIG5vdCBwcm92aWRlZCwgdGhlIG1ldGhvZCBydW5zIHN5bmNocm9ub3VzbHkgaWYgcG9zc2libGUgKHNlZSBiZWxvdykuXG4gICAqL1xuICBjYWxsKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gY2FsbGJhY2sgKi8pIHtcbiAgICAvLyBpZiBpdCdzIGEgZnVuY3Rpb24sIHRoZSBsYXN0IGFyZ3VtZW50IGlzIHRoZSByZXN1bHQgY2FsbGJhY2ssXG4gICAgLy8gbm90IGEgcGFyYW1ldGVyIHRvIHRoZSByZW1vdGUgbWV0aG9kLlxuICAgIGNvbnN0IGFyZ3MgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGV0IGNhbGxiYWNrO1xuICAgIGlmIChhcmdzLmxlbmd0aCAmJiB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IGFyZ3MucG9wKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFwcGx5KG5hbWUsIGFyZ3MsIGNhbGxiYWNrKTtcbiAgfVxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuY2FsbEFzeW5jXG4gICAqIEBzdW1tYXJ5IEludm9rZXMgYSBtZXRob2Qgd2l0aCBhbiBhc3luYyBzdHViLCBwYXNzaW5nIGFueSBudW1iZXIgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlfSBbYXJnMSxhcmcyLi4uXSBPcHRpb25hbCBtZXRob2QgYXJndW1lbnRzXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgY2FsbEFzeW5jKG5hbWUgLyogLi4gW2FyZ3VtZW50c10gLi4gKi8pIHtcbiAgICBjb25zdCBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGlmIChhcmdzLmxlbmd0aCAmJiB0eXBlb2YgYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiTWV0ZW9yLmNhbGxBc3luYygpIGRvZXMgbm90IGFjY2VwdCBhIGNhbGxiYWNrLiBZb3Ugc2hvdWxkICdhd2FpdCcgdGhlIHJlc3VsdCwgb3IgdXNlIC50aGVuKCkuXCJcbiAgICAgICk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuYXBwbHlBc3luYyhuYW1lLCBhcmdzLCB7IHJldHVyblNlcnZlclJlc3VsdFByb21pc2U6IHRydWUgfSk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuYXBwbHlcbiAgICogQHN1bW1hcnkgSW52b2tlIGEgbWV0aG9kIHBhc3NpbmcgYW4gYXJyYXkgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlW119IGFyZ3MgTWV0aG9kIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy53YWl0IChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCB1bnRpbCBhbGwgcHJldmlvdXMgbWV0aG9kIGNhbGxzIGhhdmUgY29tcGxldGVkLCBhbmQgZG9uJ3Qgc2VuZCBhbnkgc3Vic2VxdWVudCBtZXRob2QgY2FsbHMgdW50aWwgdGhpcyBvbmUgaXMgY29tcGxldGVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgKENsaWVudCBvbmx5KSBUaGlzIGNhbGxiYWNrIGlzIGludm9rZWQgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IG9mIHRoZSBtZXRob2QgKGp1c3QgbGlrZSBgYXN5bmNDYWxsYmFja2ApIGFzIHNvb24gYXMgdGhlIGVycm9yIG9yIHJlc3VsdCBpcyBhdmFpbGFibGUuIFRoZSBsb2NhbCBjYWNoZSBtYXkgbm90IHlldCByZWZsZWN0IHRoZSB3cml0ZXMgcGVyZm9ybWVkIGJ5IHRoZSBtZXRob2QuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5ub1JldHJ5IChDbGllbnQgb25seSkgaWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCBhZ2FpbiBvbiByZWxvYWQsIHNpbXBseSBjYWxsIHRoZSBjYWxsYmFjayBhbiBlcnJvciB3aXRoIHRoZSBlcnJvciBjb2RlICdpbnZvY2F0aW9uLWZhaWxlZCcuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy50aHJvd1N0dWJFeGNlcHRpb25zIChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZXhjZXB0aW9ucyB0aHJvd24gYnkgbWV0aG9kIHN0dWJzIHdpbGwgYmUgdGhyb3duIGluc3RlYWQgb2YgbG9nZ2VkLCBhbmQgdGhlIG1ldGhvZCB3aWxsIG5vdCBiZSBpbnZva2VkIG9uIHRoZSBzZXJ2ZXIuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZXR1cm5TdHViVmFsdWUgKENsaWVudCBvbmx5KSBJZiB0cnVlIHRoZW4gaW4gY2FzZXMgd2hlcmUgd2Ugd291bGQgaGF2ZSBvdGhlcndpc2UgZGlzY2FyZGVkIHRoZSBzdHViJ3MgcmV0dXJuIHZhbHVlIGFuZCByZXR1cm5lZCB1bmRlZmluZWQsIGluc3RlYWQgd2UgZ28gYWhlYWQgYW5kIHJldHVybiBpdC4gU3BlY2lmaWNhbGx5LCB0aGlzIGlzIGFueSB0aW1lIG90aGVyIHRoYW4gd2hlbiAoYSkgd2UgYXJlIGFscmVhZHkgaW5zaWRlIGEgc3R1YiBvciAoYikgd2UgYXJlIGluIE5vZGUgYW5kIG5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZC4gQ3VycmVudGx5IHdlIHJlcXVpcmUgdGhpcyBmbGFnIHRvIGJlIGV4cGxpY2l0bHkgcGFzc2VkIHRvIHJlZHVjZSB0aGUgbGlrZWxpaG9vZCB0aGF0IHN0dWIgcmV0dXJuIHZhbHVlcyB3aWxsIGJlIGNvbmZ1c2VkIHdpdGggc2VydmVyIHJldHVybiB2YWx1ZXM7IHdlIG1heSBpbXByb3ZlIHRoaXMgaW4gZnV0dXJlLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbYXN5bmNDYWxsYmFja10gT3B0aW9uYWwgY2FsbGJhY2s7IHNhbWUgc2VtYW50aWNzIGFzIGluIFtgTWV0ZW9yLmNhbGxgXSgjbWV0ZW9yX2NhbGwpLlxuICAgKi9cbiAgYXBwbHkobmFtZSwgYXJncywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCB7IHN0dWJJbnZvY2F0aW9uLCBpbnZvY2F0aW9uLCAuLi5zdHViT3B0aW9ucyB9ID0gdGhpcy5fc3R1YkNhbGwobmFtZSwgRUpTT04uY2xvbmUoYXJncykpO1xuXG4gICAgaWYgKHN0dWJPcHRpb25zLmhhc1N0dWIpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbjogc3R1Yk9wdGlvbnMuYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgICAgICBpc0Zyb21DYWxsQXN5bmM6IHN0dWJPcHRpb25zLmlzRnJvbUNhbGxBc3luYyxcbiAgICAgICAgfSlcbiAgICAgICkge1xuICAgICAgICB0aGlzLl9zYXZlT3JpZ2luYWxzKCk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBzdHViT3B0aW9ucy5zdHViUmV0dXJuVmFsdWUgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uXG4gICAgICAgICAgLndpdGhWYWx1ZShpbnZvY2F0aW9uLCBzdHViSW52b2NhdGlvbik7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHN0dWJPcHRpb25zLmV4Y2VwdGlvbiA9IGU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLl9hcHBseShuYW1lLCBzdHViT3B0aW9ucywgYXJncywgb3B0aW9ucywgY2FsbGJhY2spO1xuICB9XG5cbiAgLyoqXG4gICAqIEBtZW1iZXJPZiBNZXRlb3JcbiAgICogQGltcG9ydEZyb21QYWNrYWdlIG1ldGVvclxuICAgKiBAYWxpYXMgTWV0ZW9yLmFwcGx5QXN5bmNcbiAgICogQHN1bW1hcnkgSW52b2tlIGEgbWV0aG9kIHBhc3NpbmcgYW4gYXJyYXkgb2YgYXJndW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiBtZXRob2QgdG8gaW52b2tlXG4gICAqIEBwYXJhbSB7RUpTT05hYmxlW119IGFyZ3MgTWV0aG9kIGFyZ3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy53YWl0IChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCB1bnRpbCBhbGwgcHJldmlvdXMgbWV0aG9kIGNhbGxzIGhhdmUgY29tcGxldGVkLCBhbmQgZG9uJ3Qgc2VuZCBhbnkgc3Vic2VxdWVudCBtZXRob2QgY2FsbHMgdW50aWwgdGhpcyBvbmUgaXMgY29tcGxldGVkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLm9uUmVzdWx0UmVjZWl2ZWQgKENsaWVudCBvbmx5KSBUaGlzIGNhbGxiYWNrIGlzIGludm9rZWQgd2l0aCB0aGUgZXJyb3Igb3IgcmVzdWx0IG9mIHRoZSBtZXRob2QgKGp1c3QgbGlrZSBgYXN5bmNDYWxsYmFja2ApIGFzIHNvb24gYXMgdGhlIGVycm9yIG9yIHJlc3VsdCBpcyBhdmFpbGFibGUuIFRoZSBsb2NhbCBjYWNoZSBtYXkgbm90IHlldCByZWZsZWN0IHRoZSB3cml0ZXMgcGVyZm9ybWVkIGJ5IHRoZSBtZXRob2QuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5ub1JldHJ5IChDbGllbnQgb25seSkgaWYgdHJ1ZSwgZG9uJ3Qgc2VuZCB0aGlzIG1ldGhvZCBhZ2FpbiBvbiByZWxvYWQsIHNpbXBseSBjYWxsIHRoZSBjYWxsYmFjayBhbiBlcnJvciB3aXRoIHRoZSBlcnJvciBjb2RlICdpbnZvY2F0aW9uLWZhaWxlZCcuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy50aHJvd1N0dWJFeGNlcHRpb25zIChDbGllbnQgb25seSkgSWYgdHJ1ZSwgZXhjZXB0aW9ucyB0aHJvd24gYnkgbWV0aG9kIHN0dWJzIHdpbGwgYmUgdGhyb3duIGluc3RlYWQgb2YgbG9nZ2VkLCBhbmQgdGhlIG1ldGhvZCB3aWxsIG5vdCBiZSBpbnZva2VkIG9uIHRoZSBzZXJ2ZXIuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZXR1cm5TdHViVmFsdWUgKENsaWVudCBvbmx5KSBJZiB0cnVlIHRoZW4gaW4gY2FzZXMgd2hlcmUgd2Ugd291bGQgaGF2ZSBvdGhlcndpc2UgZGlzY2FyZGVkIHRoZSBzdHViJ3MgcmV0dXJuIHZhbHVlIGFuZCByZXR1cm5lZCB1bmRlZmluZWQsIGluc3RlYWQgd2UgZ28gYWhlYWQgYW5kIHJldHVybiBpdC4gU3BlY2lmaWNhbGx5LCB0aGlzIGlzIGFueSB0aW1lIG90aGVyIHRoYW4gd2hlbiAoYSkgd2UgYXJlIGFscmVhZHkgaW5zaWRlIGEgc3R1YiBvciAoYikgd2UgYXJlIGluIE5vZGUgYW5kIG5vIGNhbGxiYWNrIHdhcyBwcm92aWRlZC4gQ3VycmVudGx5IHdlIHJlcXVpcmUgdGhpcyBmbGFnIHRvIGJlIGV4cGxpY2l0bHkgcGFzc2VkIHRvIHJlZHVjZSB0aGUgbGlrZWxpaG9vZCB0aGF0IHN0dWIgcmV0dXJuIHZhbHVlcyB3aWxsIGJlIGNvbmZ1c2VkIHdpdGggc2VydmVyIHJldHVybiB2YWx1ZXM7IHdlIG1heSBpbXByb3ZlIHRoaXMgaW4gZnV0dXJlLlxuICAgKi9cbiAgYXBwbHlBc3luYyhuYW1lLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjayA9IG51bGwpIHtcbiAgICBjb25zdCBzdHViUHJvbWlzZSA9IHRoaXMuX2FwcGx5QXN5bmNTdHViSW52b2NhdGlvbihuYW1lLCBhcmdzLCBvcHRpb25zKTtcblxuICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLl9hcHBseUFzeW5jKHtcbiAgICAgIG5hbWUsXG4gICAgICBhcmdzLFxuICAgICAgb3B0aW9ucyxcbiAgICAgIGNhbGxiYWNrLFxuICAgICAgc3R1YlByb21pc2UsXG4gICAgfSk7XG4gICAgaWYgKE1ldGVvci5pc0NsaWVudCkge1xuICAgICAgLy8gb25seSByZXR1cm4gdGhlIHN0dWJSZXR1cm5WYWx1ZVxuICAgICAgcHJvbWlzZS5zdHViUHJvbWlzZSA9IHN0dWJQcm9taXNlLnRoZW4obyA9PiBvLnN0dWJSZXR1cm5WYWx1ZSk7XG4gICAgICAvLyB0aGlzIGF2b2lkcyBhdHRyaWJ1dGUgcmVjdXJzaW9uXG4gICAgICBwcm9taXNlLnNlcnZlclByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PlxuICAgICAgICBwcm9taXNlLnRoZW4ocmVzb2x2ZSkuY2F0Y2gocmVqZWN0KSxcbiAgICAgICk7XG4gICAgfVxuICAgIHJldHVybiBwcm9taXNlO1xuICB9XG4gIGFzeW5jIF9hcHBseUFzeW5jU3R1Ykludm9jYXRpb24obmFtZSwgYXJncywgb3B0aW9ucykge1xuICAgIGNvbnN0IHsgc3R1Ykludm9jYXRpb24sIGludm9jYXRpb24sIC4uLnN0dWJPcHRpb25zIH0gPSB0aGlzLl9zdHViQ2FsbChuYW1lLCBFSlNPTi5jbG9uZShhcmdzKSwgb3B0aW9ucyk7XG4gICAgaWYgKHN0dWJPcHRpb25zLmhhc1N0dWIpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuX2dldElzU2ltdWxhdGlvbih7XG4gICAgICAgICAgYWxyZWFkeUluU2ltdWxhdGlvbjogc3R1Yk9wdGlvbnMuYWxyZWFkeUluU2ltdWxhdGlvbixcbiAgICAgICAgICBpc0Zyb21DYWxsQXN5bmM6IHN0dWJPcHRpb25zLmlzRnJvbUNhbGxBc3luYyxcbiAgICAgICAgfSlcbiAgICAgICkge1xuICAgICAgICB0aGlzLl9zYXZlT3JpZ2luYWxzKCk7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICAvKlxuICAgICAgICAgKiBUaGUgY29kZSBiZWxvdyBmb2xsb3dzIHRoZSBzYW1lIGxvZ2ljIGFzIHRoZSBmdW5jdGlvbiB3aXRoVmFsdWVzKCkuXG4gICAgICAgICAqXG4gICAgICAgICAqIEJ1dCBhcyB0aGUgTWV0ZW9yIHBhY2thZ2UgaXMgbm90IGNvbXBpbGVkIGJ5IGVjbWFzY3JpcHQsIGl0IGlzIHVuYWJsZSB0byB1c2UgbmV3ZXIgc3ludGF4IGluIHRoZSBicm93c2VyLFxuICAgICAgICAgKiBzdWNoIGFzLCB0aGUgYXN5bmMvYXdhaXQuXG4gICAgICAgICAqXG4gICAgICAgICAqIFNvLCB0byBrZWVwIHN1cHBvcnRpbmcgb2xkIGJyb3dzZXJzLCBsaWtlIElFIDExLCB3ZSdyZSBjcmVhdGluZyB0aGUgbG9naWMgb25lIGxldmVsIGFib3ZlLlxuICAgICAgICAgKi9cbiAgICAgICAgY29uc3QgY3VycmVudENvbnRleHQgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLl9zZXROZXdDb250ZXh0QW5kR2V0Q3VycmVudChcbiAgICAgICAgICBpbnZvY2F0aW9uXG4gICAgICAgICk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgc3R1Yk9wdGlvbnMuc3R1YlJldHVyblZhbHVlID0gYXdhaXQgc3R1Ykludm9jYXRpb24oKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIHN0dWJPcHRpb25zLmV4Y2VwdGlvbiA9IGU7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5fc2V0KGN1cnJlbnRDb250ZXh0KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBzdHViT3B0aW9ucy5leGNlcHRpb24gPSBlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gc3R1Yk9wdGlvbnM7XG4gIH1cbiAgYXN5bmMgX2FwcGx5QXN5bmMoeyBuYW1lLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjaywgc3R1YlByb21pc2UgfSkge1xuICAgIGNvbnN0IHN0dWJPcHRpb25zID0gYXdhaXQgc3R1YlByb21pc2U7XG4gICAgcmV0dXJuIHRoaXMuX2FwcGx5KG5hbWUsIHN0dWJPcHRpb25zLCBhcmdzLCBvcHRpb25zLCBjYWxsYmFjayk7XG4gIH1cblxuICBfYXBwbHkobmFtZSwgc3R1YkNhbGxWYWx1ZSwgYXJncywgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICAvLyBXZSB3ZXJlIHBhc3NlZCAzIGFyZ3VtZW50cy4gVGhleSBtYXkgYmUgZWl0aGVyIChuYW1lLCBhcmdzLCBvcHRpb25zKVxuICAgIC8vIG9yIChuYW1lLCBhcmdzLCBjYWxsYmFjaylcbiAgICBpZiAoIWNhbGxiYWNrICYmIHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICBvcHRpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICB9XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwgT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgLy8gWFhYIHdvdWxkIGl0IGJlIGJldHRlciBmb3JtIHRvIGRvIHRoZSBiaW5kaW5nIGluIHN0cmVhbS5vbixcbiAgICAgIC8vIG9yIGNhbGxlciwgaW5zdGVhZCBvZiBoZXJlP1xuICAgICAgLy8gWFhYIGltcHJvdmUgZXJyb3IgbWVzc2FnZSAoYW5kIGhvdyB3ZSByZXBvcnQgaXQpXG4gICAgICBjYWxsYmFjayA9IE1ldGVvci5iaW5kRW52aXJvbm1lbnQoXG4gICAgICAgIGNhbGxiYWNrLFxuICAgICAgICBcImRlbGl2ZXJpbmcgcmVzdWx0IG9mIGludm9raW5nICdcIiArIG5hbWUgKyBcIidcIlxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3Qge1xuICAgICAgaGFzU3R1YixcbiAgICAgIGV4Y2VwdGlvbixcbiAgICAgIHN0dWJSZXR1cm5WYWx1ZSxcbiAgICAgIGFscmVhZHlJblNpbXVsYXRpb24sXG4gICAgICByYW5kb21TZWVkLFxuICAgIH0gPSBzdHViQ2FsbFZhbHVlO1xuXG4gICAgLy8gS2VlcCBvdXIgYXJncyBzYWZlIGZyb20gbXV0YXRpb24gKGVnIGlmIHdlIGRvbid0IHNlbmQgdGhlIG1lc3NhZ2UgZm9yIGFcbiAgICAvLyB3aGlsZSBiZWNhdXNlIG9mIGEgd2FpdCBtZXRob2QpLlxuICAgIGFyZ3MgPSBFSlNPTi5jbG9uZShhcmdzKTtcbiAgICAvLyBJZiB3ZSdyZSBpbiBhIHNpbXVsYXRpb24sIHN0b3AgYW5kIHJldHVybiB0aGUgcmVzdWx0IHdlIGhhdmUsXG4gICAgLy8gcmF0aGVyIHRoYW4gZ29pbmcgb24gdG8gZG8gYW4gUlBDLiBJZiB0aGVyZSB3YXMgbm8gc3R1YixcbiAgICAvLyB3ZSdsbCBlbmQgdXAgcmV0dXJuaW5nIHVuZGVmaW5lZC5cbiAgICBpZiAoXG4gICAgICB0aGlzLl9nZXRJc1NpbXVsYXRpb24oe1xuICAgICAgICBhbHJlYWR5SW5TaW11bGF0aW9uLFxuICAgICAgICBpc0Zyb21DYWxsQXN5bmM6IHN0dWJDYWxsVmFsdWUuaXNGcm9tQ2FsbEFzeW5jLFxuICAgICAgfSlcbiAgICApIHtcbiAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICBjYWxsYmFjayhleGNlcHRpb24sIHN0dWJSZXR1cm5WYWx1ZSk7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICBpZiAoZXhjZXB0aW9uKSB0aHJvdyBleGNlcHRpb247XG4gICAgICByZXR1cm4gc3R1YlJldHVyblZhbHVlO1xuICAgIH1cblxuICAgIC8vIFdlIG9ubHkgY3JlYXRlIHRoZSBtZXRob2RJZCBoZXJlIGJlY2F1c2Ugd2UgZG9uJ3QgYWN0dWFsbHkgbmVlZCBvbmUgaWZcbiAgICAvLyB3ZSdyZSBhbHJlYWR5IGluIGEgc2ltdWxhdGlvblxuICAgIGNvbnN0IG1ldGhvZElkID0gJycgKyBzZWxmLl9uZXh0TWV0aG9kSWQrKztcbiAgICBpZiAoaGFzU3R1Yikge1xuICAgICAgc2VsZi5fcmV0cmlldmVBbmRTdG9yZU9yaWdpbmFscyhtZXRob2RJZCk7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgdGhlIEREUCBtZXNzYWdlIGZvciB0aGUgbWV0aG9kIGNhbGwuIE5vdGUgdGhhdCBvbiB0aGUgY2xpZW50LFxuICAgIC8vIGl0IGlzIGltcG9ydGFudCB0aGF0IHRoZSBzdHViIGhhdmUgZmluaXNoZWQgYmVmb3JlIHdlIHNlbmQgdGhlIFJQQywgc29cbiAgICAvLyB0aGF0IHdlIGtub3cgd2UgaGF2ZSBhIGNvbXBsZXRlIGxpc3Qgb2Ygd2hpY2ggbG9jYWwgZG9jdW1lbnRzIHRoZSBzdHViXG4gICAgLy8gd3JvdGUuXG4gICAgY29uc3QgbWVzc2FnZSA9IHtcbiAgICAgIG1zZzogJ21ldGhvZCcsXG4gICAgICBpZDogbWV0aG9kSWQsXG4gICAgICBtZXRob2Q6IG5hbWUsXG4gICAgICBwYXJhbXM6IGFyZ3NcbiAgICB9O1xuXG4gICAgLy8gSWYgYW4gZXhjZXB0aW9uIG9jY3VycmVkIGluIGEgc3R1YiwgYW5kIHdlJ3JlIGlnbm9yaW5nIGl0XG4gICAgLy8gYmVjYXVzZSB3ZSdyZSBkb2luZyBhbiBSUEMgYW5kIHdhbnQgdG8gdXNlIHdoYXQgdGhlIHNlcnZlclxuICAgIC8vIHJldHVybnMgaW5zdGVhZCwgbG9nIGl0IHNvIHRoZSBkZXZlbG9wZXIga25vd3NcbiAgICAvLyAodW5sZXNzIHRoZXkgZXhwbGljaXRseSBhc2sgdG8gc2VlIHRoZSBlcnJvcikuXG4gICAgLy9cbiAgICAvLyBUZXN0cyBjYW4gc2V0IHRoZSAnX2V4cGVjdGVkQnlUZXN0JyBmbGFnIG9uIGFuIGV4Y2VwdGlvbiBzbyBpdCB3b24ndFxuICAgIC8vIGdvIHRvIGxvZy5cbiAgICBpZiAoZXhjZXB0aW9uKSB7XG4gICAgICBpZiAob3B0aW9ucy50aHJvd1N0dWJFeGNlcHRpb25zKSB7XG4gICAgICAgIHRocm93IGV4Y2VwdGlvbjtcbiAgICAgIH0gZWxzZSBpZiAoIWV4Y2VwdGlvbi5fZXhwZWN0ZWRCeVRlc3QpIHtcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICAgICAgICBcIkV4Y2VwdGlvbiB3aGlsZSBzaW11bGF0aW5nIHRoZSBlZmZlY3Qgb2YgaW52b2tpbmcgJ1wiICsgbmFtZSArIFwiJ1wiLFxuICAgICAgICAgIGV4Y2VwdGlvblxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEF0IHRoaXMgcG9pbnQgd2UncmUgZGVmaW5pdGVseSBkb2luZyBhbiBSUEMsIGFuZCB3ZSdyZSBnb2luZyB0b1xuICAgIC8vIHJldHVybiB0aGUgdmFsdWUgb2YgdGhlIFJQQyB0byB0aGUgY2FsbGVyLlxuXG4gICAgLy8gSWYgdGhlIGNhbGxlciBkaWRuJ3QgZ2l2ZSBhIGNhbGxiYWNrLCBkZWNpZGUgd2hhdCB0byBkby5cbiAgICBsZXQgZnV0dXJlO1xuICAgIGlmICghY2FsbGJhY2spIHtcbiAgICAgIGlmIChcbiAgICAgICAgTWV0ZW9yLmlzQ2xpZW50ICYmXG4gICAgICAgICFvcHRpb25zLnJldHVyblNlcnZlclJlc3VsdFByb21pc2UgJiZcbiAgICAgICAgKCFvcHRpb25zLmlzRnJvbUNhbGxBc3luYyB8fCBvcHRpb25zLnJldHVyblN0dWJWYWx1ZSlcbiAgICAgICkge1xuICAgICAgICAvLyBPbiB0aGUgY2xpZW50LCB3ZSBkb24ndCBoYXZlIGZpYmVycywgc28gd2UgY2FuJ3QgYmxvY2suIFRoZVxuICAgICAgICAvLyBvbmx5IHRoaW5nIHdlIGNhbiBkbyBpcyB0byByZXR1cm4gdW5kZWZpbmVkIGFuZCBkaXNjYXJkIHRoZVxuICAgICAgICAvLyByZXN1bHQgb2YgdGhlIFJQQy4gSWYgYW4gZXJyb3Igb2NjdXJyZWQgdGhlbiBwcmludCB0aGUgZXJyb3JcbiAgICAgICAgLy8gdG8gdGhlIGNvbnNvbGUuXG4gICAgICAgIGNhbGxiYWNrID0gKGVycikgPT4ge1xuICAgICAgICAgIGVyciAmJiBNZXRlb3IuX2RlYnVnKFwiRXJyb3IgaW52b2tpbmcgTWV0aG9kICdcIiArIG5hbWUgKyBcIidcIiwgZXJyKTtcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIE9uIHRoZSBzZXJ2ZXIsIG1ha2UgdGhlIGZ1bmN0aW9uIHN5bmNocm9ub3VzLiBUaHJvdyBvblxuICAgICAgICAvLyBlcnJvcnMsIHJldHVybiBvbiBzdWNjZXNzLlxuICAgICAgICBmdXR1cmUgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgY2FsbGJhY2sgPSAoLi4uYWxsQXJncykgPT4ge1xuICAgICAgICAgICAgbGV0IGFyZ3MgPSBBcnJheS5mcm9tKGFsbEFyZ3MpO1xuICAgICAgICAgICAgbGV0IGVyciA9IGFyZ3Muc2hpZnQoKTtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc29sdmUoLi4uYXJncyk7XG4gICAgICAgICAgfTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gU2VuZCB0aGUgcmFuZG9tU2VlZCBvbmx5IGlmIHdlIHVzZWQgaXRcbiAgICBpZiAocmFuZG9tU2VlZC52YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgbWVzc2FnZS5yYW5kb21TZWVkID0gcmFuZG9tU2VlZC52YWx1ZTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXRob2RJbnZva2VyID0gbmV3IE1ldGhvZEludm9rZXIoe1xuICAgICAgbWV0aG9kSWQsXG4gICAgICBjYWxsYmFjazogY2FsbGJhY2ssXG4gICAgICBjb25uZWN0aW9uOiBzZWxmLFxuICAgICAgb25SZXN1bHRSZWNlaXZlZDogb3B0aW9ucy5vblJlc3VsdFJlY2VpdmVkLFxuICAgICAgd2FpdDogISFvcHRpb25zLndhaXQsXG4gICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgbm9SZXRyeTogISFvcHRpb25zLm5vUmV0cnlcbiAgICB9KTtcblxuICAgIGlmIChvcHRpb25zLndhaXQpIHtcbiAgICAgIC8vIEl0J3MgYSB3YWl0IG1ldGhvZCEgV2FpdCBtZXRob2RzIGdvIGluIHRoZWlyIG93biBibG9jay5cbiAgICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goe1xuICAgICAgICB3YWl0OiB0cnVlLFxuICAgICAgICBtZXRob2RzOiBbbWV0aG9kSW52b2tlcl1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBOb3QgYSB3YWl0IG1ldGhvZC4gU3RhcnQgYSBuZXcgYmxvY2sgaWYgdGhlIHByZXZpb3VzIGJsb2NrIHdhcyBhIHdhaXRcbiAgICAgIC8vIGJsb2NrLCBhbmQgYWRkIGl0IHRvIHRoZSBsYXN0IGJsb2NrIG9mIG1ldGhvZHMuXG4gICAgICBpZiAoaXNFbXB0eShzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykgfHxcbiAgICAgICAgICBsYXN0KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKS53YWl0KSB7XG4gICAgICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzLnB1c2goe1xuICAgICAgICAgIHdhaXQ6IGZhbHNlLFxuICAgICAgICAgIG1ldGhvZHM6IFtdLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgbGFzdChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2NrcykubWV0aG9kcy5wdXNoKG1ldGhvZEludm9rZXIpO1xuICAgIH1cblxuICAgIC8vIElmIHdlIGFkZGVkIGl0IHRvIHRoZSBmaXJzdCBibG9jaywgc2VuZCBpdCBvdXQgbm93LlxuICAgIGlmIChzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPT09IDEpIG1ldGhvZEludm9rZXIuc2VuZE1lc3NhZ2UoKTtcblxuICAgIC8vIElmIHdlJ3JlIHVzaW5nIHRoZSBkZWZhdWx0IGNhbGxiYWNrIG9uIHRoZSBzZXJ2ZXIsXG4gICAgLy8gYmxvY2sgd2FpdGluZyBmb3IgdGhlIHJlc3VsdC5cbiAgICBpZiAoZnV0dXJlKSB7XG4gICAgICAvLyBUaGlzIGlzIHRoZSByZXN1bHQgb2YgdGhlIG1ldGhvZCByYW4gaW4gdGhlIGNsaWVudC5cbiAgICAgIC8vIFlvdSBjYW4gb3B0LWluIGluIGdldHRpbmcgdGhlIGxvY2FsIHJlc3VsdCBieSBydW5uaW5nOlxuICAgICAgLy8gY29uc3QgeyBzdHViUHJvbWlzZSwgc2VydmVyUHJvbWlzZSB9ID0gTWV0ZW9yLmNhbGxBc3luYyguLi4pO1xuICAgICAgLy8gY29uc3Qgd2hhdFNlcnZlckRpZCA9IGF3YWl0IHNlcnZlclByb21pc2U7XG4gICAgICBpZiAob3B0aW9ucy5yZXR1cm5TdHViVmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGZ1dHVyZS50aGVuKCgpID0+IHN0dWJSZXR1cm5WYWx1ZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZnV0dXJlO1xuICAgIH1cbiAgICByZXR1cm4gb3B0aW9ucy5yZXR1cm5TdHViVmFsdWUgPyBzdHViUmV0dXJuVmFsdWUgOiB1bmRlZmluZWQ7XG4gIH1cblxuXG4gIF9zdHViQ2FsbChuYW1lLCBhcmdzLCBvcHRpb25zKSB7XG4gICAgLy8gUnVuIHRoZSBzdHViLCBpZiB3ZSBoYXZlIG9uZS4gVGhlIHN0dWIgaXMgc3VwcG9zZWQgdG8gbWFrZSBzb21lXG4gICAgLy8gdGVtcG9yYXJ5IHdyaXRlcyB0byB0aGUgZGF0YWJhc2UgdG8gZ2l2ZSB0aGUgdXNlciBhIHNtb290aCBleHBlcmllbmNlXG4gICAgLy8gdW50aWwgdGhlIGFjdHVhbCByZXN1bHQgb2YgZXhlY3V0aW5nIHRoZSBtZXRob2QgY29tZXMgYmFjayBmcm9tIHRoZVxuICAgIC8vIHNlcnZlciAod2hlcmV1cG9uIHRoZSB0ZW1wb3Jhcnkgd3JpdGVzIHRvIHRoZSBkYXRhYmFzZSB3aWxsIGJlIHJldmVyc2VkXG4gICAgLy8gZHVyaW5nIHRoZSBiZWdpblVwZGF0ZS9lbmRVcGRhdGUgcHJvY2Vzcy4pXG4gICAgLy9cbiAgICAvLyBOb3JtYWxseSwgd2UgaWdub3JlIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIHN0dWIgKGV2ZW4gaWYgaXQgaXMgYW5cbiAgICAvLyBleGNlcHRpb24pLCBpbiBmYXZvciBvZiB0aGUgcmVhbCByZXR1cm4gdmFsdWUgZnJvbSB0aGUgc2VydmVyLiBUaGVcbiAgICAvLyBleGNlcHRpb24gaXMgaWYgdGhlICpjYWxsZXIqIGlzIGEgc3R1Yi4gSW4gdGhhdCBjYXNlLCB3ZSdyZSBub3QgZ29pbmdcbiAgICAvLyB0byBkbyBhIFJQQywgc28gd2UgdXNlIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIHN0dWIgYXMgb3VyIHJldHVyblxuICAgIC8vIHZhbHVlLlxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IGVuY2xvc2luZyA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCk7XG4gICAgY29uc3Qgc3R1YiA9IHNlbGYuX21ldGhvZEhhbmRsZXJzW25hbWVdO1xuICAgIGNvbnN0IGFscmVhZHlJblNpbXVsYXRpb24gPSBlbmNsb3Npbmc/LmlzU2ltdWxhdGlvbjtcbiAgICBjb25zdCBpc0Zyb21DYWxsQXN5bmMgPSBlbmNsb3Npbmc/Ll9pc0Zyb21DYWxsQXN5bmM7XG4gICAgY29uc3QgcmFuZG9tU2VlZCA9IHsgdmFsdWU6IG51bGx9O1xuXG4gICAgY29uc3QgZGVmYXVsdFJldHVybiA9IHtcbiAgICAgIGFscmVhZHlJblNpbXVsYXRpb24sXG4gICAgICByYW5kb21TZWVkLFxuICAgICAgaXNGcm9tQ2FsbEFzeW5jLFxuICAgIH07XG4gICAgaWYgKCFzdHViKSB7XG4gICAgICByZXR1cm4geyAuLi5kZWZhdWx0UmV0dXJuLCBoYXNTdHViOiBmYWxzZSB9O1xuICAgIH1cblxuICAgIC8vIExhemlseSBnZW5lcmF0ZSBhIHJhbmRvbVNlZWQsIG9ubHkgaWYgaXQgaXMgcmVxdWVzdGVkIGJ5IHRoZSBzdHViLlxuICAgIC8vIFRoZSByYW5kb20gc3RyZWFtcyBvbmx5IGhhdmUgdXRpbGl0eSBpZiB0aGV5J3JlIHVzZWQgb24gYm90aCB0aGUgY2xpZW50XG4gICAgLy8gYW5kIHRoZSBzZXJ2ZXI7IGlmIHRoZSBjbGllbnQgZG9lc24ndCBnZW5lcmF0ZSBhbnkgJ3JhbmRvbScgdmFsdWVzXG4gICAgLy8gdGhlbiB3ZSBkb24ndCBleHBlY3QgdGhlIHNlcnZlciB0byBnZW5lcmF0ZSBhbnkgZWl0aGVyLlxuICAgIC8vIExlc3MgY29tbW9ubHksIHRoZSBzZXJ2ZXIgbWF5IHBlcmZvcm0gZGlmZmVyZW50IGFjdGlvbnMgZnJvbSB0aGUgY2xpZW50LFxuICAgIC8vIGFuZCBtYXkgaW4gZmFjdCBnZW5lcmF0ZSB2YWx1ZXMgd2hlcmUgdGhlIGNsaWVudCBkaWQgbm90LCBidXQgd2UgZG9uJ3RcbiAgICAvLyBoYXZlIGFueSBjbGllbnQtc2lkZSB2YWx1ZXMgdG8gbWF0Y2gsIHNvIGV2ZW4gaGVyZSB3ZSBtYXkgYXMgd2VsbCBqdXN0XG4gICAgLy8gdXNlIGEgcmFuZG9tIHNlZWQgb24gdGhlIHNlcnZlci4gIEluIHRoYXQgY2FzZSwgd2UgZG9uJ3QgcGFzcyB0aGVcbiAgICAvLyByYW5kb21TZWVkIHRvIHNhdmUgYmFuZHdpZHRoLCBhbmQgd2UgZG9uJ3QgZXZlbiBnZW5lcmF0ZSBpdCB0byBzYXZlIGFcbiAgICAvLyBiaXQgb2YgQ1BVIGFuZCB0byBhdm9pZCBjb25zdW1pbmcgZW50cm9weS5cblxuICAgIGNvbnN0IHJhbmRvbVNlZWRHZW5lcmF0b3IgPSAoKSA9PiB7XG4gICAgICBpZiAocmFuZG9tU2VlZC52YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICByYW5kb21TZWVkLnZhbHVlID0gRERQQ29tbW9uLm1ha2VScGNTZWVkKGVuY2xvc2luZywgbmFtZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmFuZG9tU2VlZC52YWx1ZTtcbiAgICB9O1xuXG4gICAgY29uc3Qgc2V0VXNlcklkID0gdXNlcklkID0+IHtcbiAgICAgIHNlbGYuc2V0VXNlcklkKHVzZXJJZCk7XG4gICAgfTtcblxuICAgIGNvbnN0IGludm9jYXRpb24gPSBuZXcgRERQQ29tbW9uLk1ldGhvZEludm9jYXRpb24oe1xuICAgICAgaXNTaW11bGF0aW9uOiB0cnVlLFxuICAgICAgdXNlcklkOiBzZWxmLnVzZXJJZCgpLFxuICAgICAgaXNGcm9tQ2FsbEFzeW5jOiBvcHRpb25zPy5pc0Zyb21DYWxsQXN5bmMsXG4gICAgICBzZXRVc2VySWQ6IHNldFVzZXJJZCxcbiAgICAgIHJhbmRvbVNlZWQoKSB7XG4gICAgICAgIHJldHVybiByYW5kb21TZWVkR2VuZXJhdG9yKCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBOb3RlIHRoYXQgdW5saWtlIGluIHRoZSBjb3JyZXNwb25kaW5nIHNlcnZlciBjb2RlLCB3ZSBuZXZlciBhdWRpdFxuICAgIC8vIHRoYXQgc3R1YnMgY2hlY2soKSB0aGVpciBhcmd1bWVudHMuXG4gICAgY29uc3Qgc3R1Ykludm9jYXRpb24gPSAoKSA9PiB7XG4gICAgICAgIGlmIChNZXRlb3IuaXNTZXJ2ZXIpIHtcbiAgICAgICAgICAvLyBCZWNhdXNlIHNhdmVPcmlnaW5hbHMgYW5kIHJldHJpZXZlT3JpZ2luYWxzIGFyZW4ndCByZWVudHJhbnQsXG4gICAgICAgICAgLy8gZG9uJ3QgYWxsb3cgc3R1YnMgdG8geWllbGQuXG4gICAgICAgICAgcmV0dXJuIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKCgpID0+IHtcbiAgICAgICAgICAgIC8vIHJlLWNsb25lLCBzbyB0aGF0IHRoZSBzdHViIGNhbid0IGFmZmVjdCBvdXIgY2FsbGVyJ3MgdmFsdWVzXG4gICAgICAgICAgICByZXR1cm4gc3R1Yi5hcHBseShpbnZvY2F0aW9uLCBFSlNPTi5jbG9uZShhcmdzKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHN0dWIuYXBwbHkoaW52b2NhdGlvbiwgRUpTT04uY2xvbmUoYXJncykpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICByZXR1cm4geyAuLi5kZWZhdWx0UmV0dXJuLCBoYXNTdHViOiB0cnVlLCBzdHViSW52b2NhdGlvbiwgaW52b2NhdGlvbiB9O1xuICB9XG5cbiAgLy8gQmVmb3JlIGNhbGxpbmcgYSBtZXRob2Qgc3R1YiwgcHJlcGFyZSBhbGwgc3RvcmVzIHRvIHRyYWNrIGNoYW5nZXMgYW5kIGFsbG93XG4gIC8vIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzIHRvIGdldCB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgY2hhbmdlZFxuICAvLyBkb2N1bWVudHMuXG4gIF9zYXZlT3JpZ2luYWxzKCkge1xuICAgIGlmICghIHRoaXMuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIHRoaXMuX2ZsdXNoQnVmZmVyZWRXcml0ZXNDbGllbnQoKTtcbiAgICB9XG5cbiAgICBPYmplY3QudmFsdWVzKHRoaXMuX3N0b3JlcykuZm9yRWFjaCgoc3RvcmUpID0+IHtcbiAgICAgIHN0b3JlLnNhdmVPcmlnaW5hbHMoKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIFJldHJpZXZlcyB0aGUgb3JpZ2luYWwgdmVyc2lvbnMgb2YgYWxsIGRvY3VtZW50cyBtb2RpZmllZCBieSB0aGUgc3R1YiBmb3JcbiAgLy8gbWV0aG9kICdtZXRob2RJZCcgZnJvbSBhbGwgc3RvcmVzIGFuZCBzYXZlcyB0aGVtIHRvIF9zZXJ2ZXJEb2N1bWVudHMgKGtleWVkXG4gIC8vIGJ5IGRvY3VtZW50KSBhbmQgX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWIgKGtleWVkIGJ5IG1ldGhvZCBJRCkuXG4gIF9yZXRyaWV2ZUFuZFN0b3JlT3JpZ2luYWxzKG1ldGhvZElkKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX2RvY3VtZW50c1dyaXR0ZW5CeVN0dWJbbWV0aG9kSWRdKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdEdXBsaWNhdGUgbWV0aG9kSWQgaW4gX3JldHJpZXZlQW5kU3RvcmVPcmlnaW5hbHMnKTtcblxuICAgIGNvbnN0IGRvY3NXcml0dGVuID0gW107XG5cbiAgICBPYmplY3QuZW50cmllcyhzZWxmLl9zdG9yZXMpLmZvckVhY2goKFtjb2xsZWN0aW9uLCBzdG9yZV0pID0+IHtcbiAgICAgIGNvbnN0IG9yaWdpbmFscyA9IHN0b3JlLnJldHJpZXZlT3JpZ2luYWxzKCk7XG4gICAgICAvLyBub3QgYWxsIHN0b3JlcyBkZWZpbmUgcmV0cmlldmVPcmlnaW5hbHNcbiAgICAgIGlmICghIG9yaWdpbmFscykgcmV0dXJuO1xuICAgICAgb3JpZ2luYWxzLmZvckVhY2goKGRvYywgaWQpID0+IHtcbiAgICAgICAgZG9jc1dyaXR0ZW4ucHVzaCh7IGNvbGxlY3Rpb24sIGlkIH0pO1xuICAgICAgICBpZiAoISBoYXNPd24uY2FsbChzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICAgICAgc2VsZi5fc2VydmVyRG9jdW1lbnRzW2NvbGxlY3Rpb25dID0gbmV3IE1vbmdvSURNYXAoKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHNbY29sbGVjdGlvbl0uc2V0RGVmYXVsdChcbiAgICAgICAgICBpZCxcbiAgICAgICAgICBPYmplY3QuY3JlYXRlKG51bGwpXG4gICAgICAgICk7XG4gICAgICAgIGlmIChzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMpIHtcbiAgICAgICAgICAvLyBXZSdyZSBub3QgdGhlIGZpcnN0IHN0dWIgdG8gd3JpdGUgdGhpcyBkb2MuIEp1c3QgYWRkIG91ciBtZXRob2QgSURcbiAgICAgICAgICAvLyB0byB0aGUgcmVjb3JkLlxuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEZpcnN0IHN0dWIhIFNhdmUgdGhlIG9yaWdpbmFsIHZhbHVlIGFuZCBvdXIgbWV0aG9kIElELlxuICAgICAgICAgIHNlcnZlckRvYy5kb2N1bWVudCA9IGRvYztcbiAgICAgICAgICBzZXJ2ZXJEb2MuZmx1c2hDYWxsYmFja3MgPSBbXTtcbiAgICAgICAgICBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgICAgIHNlcnZlckRvYy53cml0dGVuQnlTdHVic1ttZXRob2RJZF0gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBpZiAoISBpc0VtcHR5KGRvY3NXcml0dGVuKSkge1xuICAgICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YlttZXRob2RJZF0gPSBkb2NzV3JpdHRlbjtcbiAgICB9XG4gIH1cblxuICAvLyBUaGlzIGlzIHZlcnkgbXVjaCBhIHByaXZhdGUgZnVuY3Rpb24gd2UgdXNlIHRvIG1ha2UgdGhlIHRlc3RzXG4gIC8vIHRha2UgdXAgZmV3ZXIgc2VydmVyIHJlc291cmNlcyBhZnRlciB0aGV5IGNvbXBsZXRlLlxuICBfdW5zdWJzY3JpYmVBbGwoKSB7XG4gICAgT2JqZWN0LnZhbHVlcyh0aGlzLl9zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChzdWIpID0+IHtcbiAgICAgIC8vIEF2b2lkIGtpbGxpbmcgdGhlIGF1dG91cGRhdGUgc3Vic2NyaXB0aW9uIHNvIHRoYXQgZGV2ZWxvcGVyc1xuICAgICAgLy8gc3RpbGwgZ2V0IGhvdCBjb2RlIHB1c2hlcyB3aGVuIHdyaXRpbmcgdGVzdHMuXG4gICAgICAvL1xuICAgICAgLy8gWFhYIGl0J3MgYSBoYWNrIHRvIGVuY29kZSBrbm93bGVkZ2UgYWJvdXQgYXV0b3VwZGF0ZSBoZXJlLFxuICAgICAgLy8gYnV0IGl0IGRvZXNuJ3Qgc2VlbSB3b3J0aCBpdCB5ZXQgdG8gaGF2ZSBhIHNwZWNpYWwgQVBJIGZvclxuICAgICAgLy8gc3Vic2NyaXB0aW9ucyB0byBwcmVzZXJ2ZSBhZnRlciB1bml0IHRlc3RzLlxuICAgICAgaWYgKHN1Yi5uYW1lICE9PSAnbWV0ZW9yX2F1dG91cGRhdGVfY2xpZW50VmVyc2lvbnMnKSB7XG4gICAgICAgIHN1Yi5zdG9wKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBTZW5kcyB0aGUgRERQIHN0cmluZ2lmaWNhdGlvbiBvZiB0aGUgZ2l2ZW4gbWVzc2FnZSBvYmplY3RcbiAgX3NlbmQob2JqKSB7XG4gICAgdGhpcy5fc3RyZWFtLnNlbmQoRERQQ29tbW9uLnN0cmluZ2lmeUREUChvYmopKTtcbiAgfVxuXG4gIC8vIFdlIGRldGVjdGVkIHZpYSBERFAtbGV2ZWwgaGVhcnRiZWF0cyB0aGF0IHdlJ3ZlIGxvc3QgdGhlXG4gIC8vIGNvbm5lY3Rpb24uICBVbmxpa2UgYGRpc2Nvbm5lY3RgIG9yIGBjbG9zZWAsIGEgbG9zdCBjb25uZWN0aW9uXG4gIC8vIHdpbGwgYmUgYXV0b21hdGljYWxseSByZXRyaWVkLlxuICBfbG9zdENvbm5lY3Rpb24oZXJyb3IpIHtcbiAgICB0aGlzLl9zdHJlYW0uX2xvc3RDb25uZWN0aW9uKGVycm9yKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAbWVtYmVyT2YgTWV0ZW9yXG4gICAqIEBpbXBvcnRGcm9tUGFja2FnZSBtZXRlb3JcbiAgICogQGFsaWFzIE1ldGVvci5zdGF0dXNcbiAgICogQHN1bW1hcnkgR2V0IHRoZSBjdXJyZW50IGNvbm5lY3Rpb24gc3RhdHVzLiBBIHJlYWN0aXZlIGRhdGEgc291cmNlLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICBzdGF0dXMoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9zdHJlYW0uc3RhdHVzKC4uLmFyZ3MpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEZvcmNlIGFuIGltbWVkaWF0ZSByZWNvbm5lY3Rpb24gYXR0ZW1wdCBpZiB0aGUgY2xpZW50IGlzIG5vdCBjb25uZWN0ZWQgdG8gdGhlIHNlcnZlci5cblxuICBUaGlzIG1ldGhvZCBkb2VzIG5vdGhpbmcgaWYgdGhlIGNsaWVudCBpcyBhbHJlYWR5IGNvbm5lY3RlZC5cbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IucmVjb25uZWN0XG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIHJlY29ubmVjdCguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N0cmVhbS5yZWNvbm5lY3QoLi4uYXJncyk7XG4gIH1cblxuICAvKipcbiAgICogQG1lbWJlck9mIE1ldGVvclxuICAgKiBAaW1wb3J0RnJvbVBhY2thZ2UgbWV0ZW9yXG4gICAqIEBhbGlhcyBNZXRlb3IuZGlzY29ubmVjdFxuICAgKiBAc3VtbWFyeSBEaXNjb25uZWN0IHRoZSBjbGllbnQgZnJvbSB0aGUgc2VydmVyLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICBkaXNjb25uZWN0KC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLmRpc2Nvbm5lY3QoLi4uYXJncyk7XG4gIH1cblxuICBjbG9zZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyZWFtLmRpc2Nvbm5lY3QoeyBfcGVybWFuZW50OiB0cnVlIH0pO1xuICB9XG5cbiAgLy8vXG4gIC8vLyBSZWFjdGl2ZSB1c2VyIHN5c3RlbVxuICAvLy9cbiAgdXNlcklkKCkge1xuICAgIGlmICh0aGlzLl91c2VySWREZXBzKSB0aGlzLl91c2VySWREZXBzLmRlcGVuZCgpO1xuICAgIHJldHVybiB0aGlzLl91c2VySWQ7XG4gIH1cblxuICBzZXRVc2VySWQodXNlcklkKSB7XG4gICAgLy8gQXZvaWQgaW52YWxpZGF0aW5nIGRlcGVuZGVudHMgaWYgc2V0VXNlcklkIGlzIGNhbGxlZCB3aXRoIGN1cnJlbnQgdmFsdWUuXG4gICAgaWYgKHRoaXMuX3VzZXJJZCA9PT0gdXNlcklkKSByZXR1cm47XG4gICAgdGhpcy5fdXNlcklkID0gdXNlcklkO1xuICAgIGlmICh0aGlzLl91c2VySWREZXBzKSB0aGlzLl91c2VySWREZXBzLmNoYW5nZWQoKTtcbiAgfVxuXG4gIC8vIFJldHVybnMgdHJ1ZSBpZiB3ZSBhcmUgaW4gYSBzdGF0ZSBhZnRlciByZWNvbm5lY3Qgb2Ygd2FpdGluZyBmb3Igc3VicyB0byBiZVxuICAvLyByZXZpdmVkIG9yIGVhcmx5IG1ldGhvZHMgdG8gZmluaXNoIHRoZWlyIGRhdGEsIG9yIHdlIGFyZSB3YWl0aW5nIGZvciBhXG4gIC8vIFwid2FpdFwiIG1ldGhvZCB0byBmaW5pc2guXG4gIF93YWl0aW5nRm9yUXVpZXNjZW5jZSgpIHtcbiAgICByZXR1cm4gKFxuICAgICAgISBpc0VtcHR5KHRoaXMuX3N1YnNCZWluZ1Jldml2ZWQpIHx8XG4gICAgICAhIGlzRW1wdHkodGhpcy5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSlcbiAgICApO1xuICB9XG5cbiAgLy8gUmV0dXJucyB0cnVlIGlmIGFueSBtZXRob2Qgd2hvc2UgbWVzc2FnZSBoYXMgYmVlbiBzZW50IHRvIHRoZSBzZXJ2ZXIgaGFzXG4gIC8vIG5vdCB5ZXQgaW52b2tlZCBpdHMgdXNlciBjYWxsYmFjay5cbiAgX2FueU1ldGhvZHNBcmVPdXRzdGFuZGluZygpIHtcbiAgICBjb25zdCBpbnZva2VycyA9IHRoaXMuX21ldGhvZEludm9rZXJzO1xuICAgIHJldHVybiBPYmplY3QudmFsdWVzKGludm9rZXJzKS5zb21lKChpbnZva2VyKSA9PiAhIWludm9rZXIuc2VudE1lc3NhZ2UpO1xuICB9XG5cbiAgYXN5bmMgX2xpdmVkYXRhX2Nvbm5lY3RlZChtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl92ZXJzaW9uICE9PSAncHJlMScgJiYgc2VsZi5faGVhcnRiZWF0SW50ZXJ2YWwgIT09IDApIHtcbiAgICAgIHNlbGYuX2hlYXJ0YmVhdCA9IG5ldyBERFBDb21tb24uSGVhcnRiZWF0KHtcbiAgICAgICAgaGVhcnRiZWF0SW50ZXJ2YWw6IHNlbGYuX2hlYXJ0YmVhdEludGVydmFsLFxuICAgICAgICBoZWFydGJlYXRUaW1lb3V0OiBzZWxmLl9oZWFydGJlYXRUaW1lb3V0LFxuICAgICAgICBvblRpbWVvdXQoKSB7XG4gICAgICAgICAgc2VsZi5fbG9zdENvbm5lY3Rpb24oXG4gICAgICAgICAgICBuZXcgRERQLkNvbm5lY3Rpb25FcnJvcignRERQIGhlYXJ0YmVhdCB0aW1lZCBvdXQnKVxuICAgICAgICAgICk7XG4gICAgICAgIH0sXG4gICAgICAgIHNlbmRQaW5nKCkge1xuICAgICAgICAgIHNlbGYuX3NlbmQoeyBtc2c6ICdwaW5nJyB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBzZWxmLl9oZWFydGJlYXQuc3RhcnQoKTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGlzIGlzIGEgcmVjb25uZWN0LCB3ZSdsbCBoYXZlIHRvIHJlc2V0IGFsbCBzdG9yZXMuXG4gICAgaWYgKHNlbGYuX2xhc3RTZXNzaW9uSWQpIHNlbGYuX3Jlc2V0U3RvcmVzID0gdHJ1ZTtcblxuICAgIGxldCByZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uO1xuICAgIGlmICh0eXBlb2YgbXNnLnNlc3Npb24gPT09ICdzdHJpbmcnKSB7XG4gICAgICByZWNvbm5lY3RlZFRvUHJldmlvdXNTZXNzaW9uID0gc2VsZi5fbGFzdFNlc3Npb25JZCA9PT0gbXNnLnNlc3Npb247XG4gICAgICBzZWxmLl9sYXN0U2Vzc2lvbklkID0gbXNnLnNlc3Npb247XG4gICAgfVxuXG4gICAgaWYgKHJlY29ubmVjdGVkVG9QcmV2aW91c1Nlc3Npb24pIHtcbiAgICAgIC8vIFN1Y2Nlc3NmdWwgcmVjb25uZWN0aW9uIC0tIHBpY2sgdXAgd2hlcmUgd2UgbGVmdCBvZmYuICBOb3RlIHRoYXQgcmlnaHRcbiAgICAgIC8vIG5vdywgdGhpcyBuZXZlciBoYXBwZW5zOiB0aGUgc2VydmVyIG5ldmVyIGNvbm5lY3RzIHVzIHRvIGEgcHJldmlvdXNcbiAgICAgIC8vIHNlc3Npb24sIGJlY2F1c2UgRERQIGRvZXNuJ3QgcHJvdmlkZSBlbm91Z2ggZGF0YSBmb3IgdGhlIHNlcnZlciB0byBrbm93XG4gICAgICAvLyB3aGF0IG1lc3NhZ2VzIHRoZSBjbGllbnQgaGFzIHByb2Nlc3NlZC4gV2UgbmVlZCB0byBpbXByb3ZlIEREUCB0byBtYWtlXG4gICAgICAvLyB0aGlzIHBvc3NpYmxlLCBhdCB3aGljaCBwb2ludCB3ZSdsbCBwcm9iYWJseSBuZWVkIG1vcmUgY29kZSBoZXJlLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFNlcnZlciBkb2Vzbid0IGhhdmUgb3VyIGRhdGEgYW55IG1vcmUuIFJlLXN5bmMgYSBuZXcgc2Vzc2lvbi5cblxuICAgIC8vIEZvcmdldCBhYm91dCBtZXNzYWdlcyB3ZSB3ZXJlIGJ1ZmZlcmluZyBmb3IgdW5rbm93biBjb2xsZWN0aW9ucy4gVGhleSdsbFxuICAgIC8vIGJlIHJlc2VudCBpZiBzdGlsbCByZWxldmFudC5cbiAgICBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3JlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMpIHtcbiAgICAgIC8vIEZvcmdldCBhYm91dCB0aGUgZWZmZWN0cyBvZiBzdHVicy4gV2UnbGwgYmUgcmVzZXR0aW5nIGFsbCBjb2xsZWN0aW9uc1xuICAgICAgLy8gYW55d2F5LlxuICAgICAgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBzZWxmLl9zZXJ2ZXJEb2N1bWVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIH1cblxuICAgIC8vIENsZWFyIF9hZnRlclVwZGF0ZUNhbGxiYWNrcy5cbiAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcyA9IFtdO1xuXG4gICAgLy8gTWFyayBhbGwgbmFtZWQgc3Vic2NyaXB0aW9ucyB3aGljaCBhcmUgcmVhZHkgKGllLCB3ZSBhbHJlYWR5IGNhbGxlZCB0aGVcbiAgICAvLyByZWFkeSBjYWxsYmFjaykgYXMgbmVlZGluZyB0byBiZSByZXZpdmVkLlxuICAgIC8vIFhYWCBXZSBzaG91bGQgYWxzbyBibG9jayByZWNvbm5lY3QgcXVpZXNjZW5jZSB1bnRpbCB1bm5hbWVkIHN1YnNjcmlwdGlvbnNcbiAgICAvLyAgICAgKGVnLCBhdXRvcHVibGlzaCkgYXJlIGRvbmUgcmUtcHVibGlzaGluZyB0byBhdm9pZCBmbGlja2VyIVxuICAgIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIE9iamVjdC5lbnRyaWVzKHNlbGYuX3N1YnNjcmlwdGlvbnMpLmZvckVhY2goKFtpZCwgc3ViXSkgPT4ge1xuICAgICAgaWYgKHN1Yi5yZWFkeSkge1xuICAgICAgICBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkW2lkXSA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBcnJhbmdlIGZvciBcImhhbGYtZmluaXNoZWRcIiBtZXRob2RzIHRvIGhhdmUgdGhlaXIgY2FsbGJhY2tzIHJ1biwgYW5kXG4gICAgLy8gdHJhY2sgbWV0aG9kcyB0aGF0IHdlcmUgc2VudCBvbiB0aGlzIGNvbm5lY3Rpb24gc28gdGhhdCB3ZSBkb24ndFxuICAgIC8vIHF1aWVzY2UgdW50aWwgdGhleSBhcmUgYWxsIGRvbmUuXG4gICAgLy9cbiAgICAvLyBTdGFydCBieSBjbGVhcmluZyBfbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZTogbWV0aG9kcyBzZW50IGJlZm9yZVxuICAgIC8vIHJlY29ubmVjdCBkb24ndCBtYXR0ZXIsIGFuZCBhbnkgXCJ3YWl0XCIgbWV0aG9kcyBzZW50IG9uIHRoZSBuZXcgY29ubmVjdGlvblxuICAgIC8vIHRoYXQgd2UgZHJvcCBoZXJlIHdpbGwgYmUgcmVzdG9yZWQgYnkgdGhlIGxvb3AgYmVsb3cuXG4gICAgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzKSB7XG4gICAgICBjb25zdCBpbnZva2VycyA9IHNlbGYuX21ldGhvZEludm9rZXJzO1xuICAgICAga2V5cyhpbnZva2VycykuZm9yRWFjaChpZCA9PiB7XG4gICAgICAgIGNvbnN0IGludm9rZXIgPSBpbnZva2Vyc1tpZF07XG4gICAgICAgIGlmIChpbnZva2VyLmdvdFJlc3VsdCgpKSB7XG4gICAgICAgICAgLy8gVGhpcyBtZXRob2QgYWxyZWFkeSBnb3QgaXRzIHJlc3VsdCwgYnV0IGl0IGRpZG4ndCBjYWxsIGl0cyBjYWxsYmFja1xuICAgICAgICAgIC8vIGJlY2F1c2UgaXRzIGRhdGEgZGlkbid0IGJlY29tZSB2aXNpYmxlLiBXZSBkaWQgbm90IHJlc2VuZCB0aGVcbiAgICAgICAgICAvLyBtZXRob2QgUlBDLiBXZSdsbCBjYWxsIGl0cyBjYWxsYmFjayB3aGVuIHdlIGdldCBhIGZ1bGwgcXVpZXNjZSxcbiAgICAgICAgICAvLyBzaW5jZSB0aGF0J3MgYXMgY2xvc2UgYXMgd2UnbGwgZ2V0IHRvIFwiZGF0YSBtdXN0IGJlIHZpc2libGVcIi5cbiAgICAgICAgICBzZWxmLl9hZnRlclVwZGF0ZUNhbGxiYWNrcy5wdXNoKFxuICAgICAgICAgICAgKC4uLmFyZ3MpID0+IGludm9rZXIuZGF0YVZpc2libGUoLi4uYXJncylcbiAgICAgICAgICApO1xuICAgICAgICB9IGVsc2UgaWYgKGludm9rZXIuc2VudE1lc3NhZ2UpIHtcbiAgICAgICAgICAvLyBUaGlzIG1ldGhvZCBoYXMgYmVlbiBzZW50IG9uIHRoaXMgY29ubmVjdGlvbiAobWF5YmUgYXMgYSByZXNlbmRcbiAgICAgICAgICAvLyBmcm9tIHRoZSBsYXN0IGNvbm5lY3Rpb24sIG1heWJlIGZyb20gb25SZWNvbm5lY3QsIG1heWJlIGp1c3QgdmVyeVxuICAgICAgICAgIC8vIHF1aWNrbHkgYmVmb3JlIHByb2Nlc3NpbmcgdGhlIGNvbm5lY3RlZCBtZXNzYWdlKS5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIFdlIGRvbid0IG5lZWQgdG8gZG8gYW55dGhpbmcgc3BlY2lhbCB0byBlbnN1cmUgaXRzIGNhbGxiYWNrcyBnZXRcbiAgICAgICAgICAvLyBjYWxsZWQsIGJ1dCB3ZSdsbCBjb3VudCBpdCBhcyBhIG1ldGhvZCB3aGljaCBpcyBwcmV2ZW50aW5nXG4gICAgICAgICAgLy8gcmVjb25uZWN0IHF1aWVzY2VuY2UuIChlZywgaXQgbWlnaHQgYmUgYSBsb2dpbiBtZXRob2QgdGhhdCB3YXMgcnVuXG4gICAgICAgICAgLy8gZnJvbSBvblJlY29ubmVjdCwgYW5kIHdlIGRvbid0IHdhbnQgdG8gc2VlIGZsaWNrZXIgYnkgc2VlaW5nIGFcbiAgICAgICAgICAvLyBsb2dnZWQtb3V0IHN0YXRlLilcbiAgICAgICAgICBzZWxmLl9tZXRob2RzQmxvY2tpbmdRdWllc2NlbmNlW2ludm9rZXIubWV0aG9kSWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2VsZi5fbWVzc2FnZXNCdWZmZXJlZFVudGlsUXVpZXNjZW5jZSA9IFtdO1xuXG4gICAgLy8gSWYgd2UncmUgbm90IHdhaXRpbmcgb24gYW55IG1ldGhvZHMgb3Igc3Vicywgd2UgY2FuIHJlc2V0IHRoZSBzdG9yZXMgYW5kXG4gICAgLy8gY2FsbCB0aGUgY2FsbGJhY2tzIGltbWVkaWF0ZWx5LlxuICAgIGlmICghIHNlbGYuX3dhaXRpbmdGb3JRdWllc2NlbmNlKCkpIHtcbiAgICAgIGlmIChzZWxmLl9yZXNldFN0b3Jlcykge1xuICAgICAgICBmb3IgKGNvbnN0IHN0b3JlIG9mIE9iamVjdC52YWx1ZXMoc2VsZi5fc3RvcmVzKSkge1xuICAgICAgICAgIGF3YWl0IHN0b3JlLmJlZ2luVXBkYXRlKDAsIHRydWUpO1xuICAgICAgICAgIGF3YWl0IHN0b3JlLmVuZFVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBzZWxmLl9ydW5BZnRlclVwZGF0ZUNhbGxiYWNrcygpO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIF9wcm9jZXNzT25lRGF0YU1lc3NhZ2UobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3QgbWVzc2FnZVR5cGUgPSBtc2cubXNnO1xuXG4gICAgLy8gbXNnIGlzIG9uZSBvZiBbJ2FkZGVkJywgJ2NoYW5nZWQnLCAncmVtb3ZlZCcsICdyZWFkeScsICd1cGRhdGVkJ11cbiAgICBpZiAobWVzc2FnZVR5cGUgPT09ICdhZGRlZCcpIHtcbiAgICAgIGF3YWl0IHRoaXMuX3Byb2Nlc3NfYWRkZWQobXNnLCB1cGRhdGVzKTtcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VUeXBlID09PSAnY2hhbmdlZCcpIHtcbiAgICAgIHRoaXMuX3Byb2Nlc3NfY2hhbmdlZChtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICdyZW1vdmVkJykge1xuICAgICAgdGhpcy5fcHJvY2Vzc19yZW1vdmVkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ3JlYWR5Jykge1xuICAgICAgdGhpcy5fcHJvY2Vzc19yZWFkeShtc2csIHVwZGF0ZXMpO1xuICAgIH0gZWxzZSBpZiAobWVzc2FnZVR5cGUgPT09ICd1cGRhdGVkJykge1xuICAgICAgdGhpcy5fcHJvY2Vzc191cGRhdGVkKG1zZywgdXBkYXRlcyk7XG4gICAgfSBlbHNlIGlmIChtZXNzYWdlVHlwZSA9PT0gJ25vc3ViJykge1xuICAgICAgLy8gaWdub3JlIHRoaXNcbiAgICB9IGVsc2Uge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnZGlzY2FyZGluZyB1bmtub3duIGxpdmVkYXRhIGRhdGEgbWVzc2FnZSB0eXBlJywgbXNnKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBfbGl2ZWRhdGFfZGF0YShtc2cpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl93YWl0aW5nRm9yUXVpZXNjZW5jZSgpKSB7XG4gICAgICBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlLnB1c2gobXNnKTtcblxuICAgICAgaWYgKG1zZy5tc2cgPT09ICdub3N1YicpIHtcbiAgICAgICAgZGVsZXRlIHNlbGYuX3N1YnNCZWluZ1Jldml2ZWRbbXNnLmlkXTtcbiAgICAgIH1cblxuICAgICAgaWYgKG1zZy5zdWJzKSB7XG4gICAgICAgIG1zZy5zdWJzLmZvckVhY2goc3ViSWQgPT4ge1xuICAgICAgICAgIGRlbGV0ZSBzZWxmLl9zdWJzQmVpbmdSZXZpdmVkW3N1YklkXTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChtc2cubWV0aG9kcykge1xuICAgICAgICBtc2cubWV0aG9kcy5mb3JFYWNoKG1ldGhvZElkID0+IHtcbiAgICAgICAgICBkZWxldGUgc2VsZi5fbWV0aG9kc0Jsb2NraW5nUXVpZXNjZW5jZVttZXRob2RJZF07XG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZi5fd2FpdGluZ0ZvclF1aWVzY2VuY2UoKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIE5vIG1ldGhvZHMgb3Igc3VicyBhcmUgYmxvY2tpbmcgcXVpZXNjZW5jZSFcbiAgICAgIC8vIFdlJ2xsIG5vdyBwcm9jZXNzIGFuZCBhbGwgb2Ygb3VyIGJ1ZmZlcmVkIG1lc3NhZ2VzLCByZXNldCBhbGwgc3RvcmVzLFxuICAgICAgLy8gYW5kIGFwcGx5IHRoZW0gYWxsIGF0IG9uY2UuXG5cbiAgICAgIGNvbnN0IGJ1ZmZlcmVkTWVzc2FnZXMgPSBzZWxmLl9tZXNzYWdlc0J1ZmZlcmVkVW50aWxRdWllc2NlbmNlO1xuICAgICAgZm9yIChjb25zdCBidWZmZXJlZE1lc3NhZ2Ugb2YgT2JqZWN0LnZhbHVlcyhidWZmZXJlZE1lc3NhZ2VzKSkge1xuICAgICAgICBhd2FpdCBzZWxmLl9wcm9jZXNzT25lRGF0YU1lc3NhZ2UoXG4gICAgICAgICAgYnVmZmVyZWRNZXNzYWdlLFxuICAgICAgICAgIHNlbGYuX2J1ZmZlcmVkV3JpdGVzXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX21lc3NhZ2VzQnVmZmVyZWRVbnRpbFF1aWVzY2VuY2UgPSBbXTtcblxuICAgIH0gZWxzZSB7XG4gICAgICBhd2FpdCBzZWxmLl9wcm9jZXNzT25lRGF0YU1lc3NhZ2UobXNnLCBzZWxmLl9idWZmZXJlZFdyaXRlcyk7XG4gICAgfVxuXG4gICAgLy8gSW1tZWRpYXRlbHkgZmx1c2ggd3JpdGVzIHdoZW46XG4gICAgLy8gIDEuIEJ1ZmZlcmluZyBpcyBkaXNhYmxlZC4gT3I7XG4gICAgLy8gIDIuIGFueSBub24tKGFkZGVkL2NoYW5nZWQvcmVtb3ZlZCkgbWVzc2FnZSBhcnJpdmVzLlxuICAgIGNvbnN0IHN0YW5kYXJkV3JpdGUgPVxuICAgICAgbXNnLm1zZyA9PT0gXCJhZGRlZFwiIHx8XG4gICAgICBtc2cubXNnID09PSBcImNoYW5nZWRcIiB8fFxuICAgICAgbXNnLm1zZyA9PT0gXCJyZW1vdmVkXCI7XG5cbiAgICBpZiAoc2VsZi5fYnVmZmVyZWRXcml0ZXNJbnRlcnZhbCA9PT0gMCB8fCAhIHN0YW5kYXJkV3JpdGUpIHtcbiAgICAgIGF3YWl0IHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEF0ID09PSBudWxsKSB7XG4gICAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoQXQgPVxuICAgICAgICBuZXcgRGF0ZSgpLnZhbHVlT2YoKSArIHNlbGYuX2J1ZmZlcmVkV3JpdGVzTWF4QWdlO1xuICAgIH0gZWxzZSBpZiAoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEF0IDwgbmV3IERhdGUoKS52YWx1ZU9mKCkpIHtcbiAgICAgIGF3YWl0IHNlbGYuX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSkge1xuICAgICAgY2xlYXJUaW1lb3V0KHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUpO1xuICAgIH1cbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlc0ZsdXNoSGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAvLyBfX2ZsdXNoQnVmZmVyZWRXcml0ZXMgaXMgYSBwcm9taXNlLCBzbyB3aXRoIHRoaXMgd2UgY2FuIHdhaXQgdGhlIHByb21pc2UgdG8gZmluaXNoXG4gICAgICAvLyBiZWZvcmUgZG9pbmcgc29tZXRoaW5nXG4gICAgICBzZWxmLl9saXZlRGF0YVdyaXRlc1Byb21pc2UgPSBzZWxmLl9fZmx1c2hCdWZmZXJlZFdyaXRlcygpO1xuXG4gICAgICBpZiAoTWV0ZW9yLl9pc1Byb21pc2Uoc2VsZi5fbGl2ZURhdGFXcml0ZXNQcm9taXNlKSkge1xuICAgICAgICBzZWxmLl9saXZlRGF0YVdyaXRlc1Byb21pc2UuZmluYWxseShcbiAgICAgICAgICAoKSA9PiAoc2VsZi5fbGl2ZURhdGFXcml0ZXNQcm9taXNlID0gdW5kZWZpbmVkKVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0sIHNlbGYuX2J1ZmZlcmVkV3JpdGVzSW50ZXJ2YWwpO1xuICB9XG5cbiAgX3ByZXBhcmVCdWZmZXJzVG9GbHVzaCgpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSkge1xuICAgICAgY2xlYXJUaW1lb3V0KHNlbGYuX2J1ZmZlcmVkV3JpdGVzRmx1c2hIYW5kbGUpO1xuICAgICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEhhbmRsZSA9IG51bGw7XG4gICAgfVxuXG4gICAgc2VsZi5fYnVmZmVyZWRXcml0ZXNGbHVzaEF0ID0gbnVsbDtcbiAgICAvLyBXZSBuZWVkIHRvIGNsZWFyIHRoZSBidWZmZXIgYmVmb3JlIHBhc3NpbmcgaXQgdG9cbiAgICAvLyAgcGVyZm9ybVdyaXRlcy4gQXMgdGhlcmUncyBubyBndWFyYW50ZWUgdGhhdCBpdFxuICAgIC8vICB3aWxsIGV4aXQgY2xlYW5seS5cbiAgICBjb25zdCB3cml0ZXMgPSBzZWxmLl9idWZmZXJlZFdyaXRlcztcbiAgICBzZWxmLl9idWZmZXJlZFdyaXRlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgcmV0dXJuIHdyaXRlcztcbiAgfVxuXG4gIGFzeW5jIF9mbHVzaEJ1ZmZlcmVkV3JpdGVzU2VydmVyKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHdyaXRlcyA9IHNlbGYuX3ByZXBhcmVCdWZmZXJzVG9GbHVzaCgpO1xuICAgIGF3YWl0IHNlbGYuX3BlcmZvcm1Xcml0ZXNTZXJ2ZXIod3JpdGVzKTtcbiAgfVxuICBfZmx1c2hCdWZmZXJlZFdyaXRlc0NsaWVudCgpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCB3cml0ZXMgPSBzZWxmLl9wcmVwYXJlQnVmZmVyc1RvRmx1c2goKTtcbiAgICBzZWxmLl9wZXJmb3JtV3JpdGVzQ2xpZW50KHdyaXRlcyk7XG4gIH1cbiAgX2ZsdXNoQnVmZmVyZWRXcml0ZXMoKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIE1ldGVvci5pc0NsaWVudFxuICAgICAgPyBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzQ2xpZW50KClcbiAgICAgIDogc2VsZi5fZmx1c2hCdWZmZXJlZFdyaXRlc1NlcnZlcigpO1xuICB9XG4gIGFzeW5jIF9wZXJmb3JtV3JpdGVzU2VydmVyKHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgIGlmIChzZWxmLl9yZXNldFN0b3JlcyB8fCAhIGlzRW1wdHkodXBkYXRlcykpIHtcbiAgICAgIC8vIEJlZ2luIGEgdHJhbnNhY3Rpb25hbCB1cGRhdGUgb2YgZWFjaCBzdG9yZS5cblxuICAgICAgZm9yIChjb25zdCBbc3RvcmVOYW1lLCBzdG9yZV0gb2YgT2JqZWN0LmVudHJpZXMoc2VsZi5fc3RvcmVzKSkge1xuICAgICAgICBhd2FpdCBzdG9yZS5iZWdpblVwZGF0ZShcbiAgICAgICAgICBoYXNPd24uY2FsbCh1cGRhdGVzLCBzdG9yZU5hbWUpXG4gICAgICAgICAgICA/IHVwZGF0ZXNbc3RvcmVOYW1lXS5sZW5ndGhcbiAgICAgICAgICAgIDogMCxcbiAgICAgICAgICBzZWxmLl9yZXNldFN0b3Jlc1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9yZXNldFN0b3JlcyA9IGZhbHNlO1xuXG4gICAgICBmb3IgKGNvbnN0IFtzdG9yZU5hbWUsIHVwZGF0ZU1lc3NhZ2VzXSBvZiBPYmplY3QuZW50cmllcyh1cGRhdGVzKSkge1xuICAgICAgICBjb25zdCBzdG9yZSA9IHNlbGYuX3N0b3Jlc1tzdG9yZU5hbWVdO1xuICAgICAgICBpZiAoc3RvcmUpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IHVwZGF0ZU1lc3NhZ2Ugb2YgdXBkYXRlTWVzc2FnZXMpIHtcbiAgICAgICAgICAgIGF3YWl0IHN0b3JlLnVwZGF0ZSh1cGRhdGVNZXNzYWdlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgLy8gTm9ib2R5J3MgbGlzdGVuaW5nIGZvciB0aGlzIGRhdGEuIFF1ZXVlIGl0IHVwIHVudGlsXG4gICAgICAgICAgLy8gc29tZW9uZSB3YW50cyBpdC5cbiAgICAgICAgICAvLyBYWFggbWVtb3J5IHVzZSB3aWxsIGdyb3cgd2l0aG91dCBib3VuZCBpZiB5b3UgZm9yZ2V0IHRvXG4gICAgICAgICAgLy8gY3JlYXRlIGEgY29sbGVjdGlvbiBvciBqdXN0IGRvbid0IGNhcmUgYWJvdXQgaXQuLi4gZ29pbmdcbiAgICAgICAgICAvLyB0byBoYXZlIHRvIGRvIHNvbWV0aGluZyBhYm91dCB0aGF0LlxuICAgICAgICAgIGNvbnN0IHVwZGF0ZXMgPSBzZWxmLl91cGRhdGVzRm9yVW5rbm93blN0b3JlcztcblxuICAgICAgICAgIGlmICghIGhhc093bi5jYWxsKHVwZGF0ZXMsIHN0b3JlTmFtZSkpIHtcbiAgICAgICAgICAgIHVwZGF0ZXNbc3RvcmVOYW1lXSA9IFtdO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHVwZGF0ZXNbc3RvcmVOYW1lXS5wdXNoKC4uLnVwZGF0ZU1lc3NhZ2VzKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgLy8gRW5kIHVwZGF0ZSB0cmFuc2FjdGlvbi5cbiAgICAgIGZvciAoY29uc3Qgc3RvcmUgb2YgT2JqZWN0LnZhbHVlcyhzZWxmLl9zdG9yZXMpKSB7XG4gICAgICAgIGF3YWl0IHN0b3JlLmVuZFVwZGF0ZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHNlbGYuX3J1bkFmdGVyVXBkYXRlQ2FsbGJhY2tzKCk7XG4gIH1cbiAgX3BlcmZvcm1Xcml0ZXNDbGllbnQodXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKHNlbGYuX3Jlc2V0U3RvcmVzIHx8ICEgaXNFbXB0eSh1cGRhdGVzKSkge1xuICAgICAgLy8gQmVnaW4gYSB0cmFuc2FjdGlvbmFsIHVwZGF0ZSBvZiBlYWNoIHN0b3JlLlxuXG4gICAgICBmb3IgKGNvbnN0IFtzdG9yZU5hbWUsIHN0b3JlXSBvZiBPYmplY3QuZW50cmllcyhzZWxmLl9zdG9yZXMpKSB7XG4gICAgICAgIHN0b3JlLmJlZ2luVXBkYXRlKFxuICAgICAgICAgIGhhc093bi5jYWxsKHVwZGF0ZXMsIHN0b3JlTmFtZSlcbiAgICAgICAgICAgID8gdXBkYXRlc1tzdG9yZU5hbWVdLmxlbmd0aFxuICAgICAgICAgICAgOiAwLFxuICAgICAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX3Jlc2V0U3RvcmVzID0gZmFsc2U7XG5cbiAgICAgIGZvciAoY29uc3QgW3N0b3JlTmFtZSwgdXBkYXRlTWVzc2FnZXNdIG9mIE9iamVjdC5lbnRyaWVzKHVwZGF0ZXMpKSB7XG4gICAgICAgIGNvbnN0IHN0b3JlID0gc2VsZi5fc3RvcmVzW3N0b3JlTmFtZV07XG4gICAgICAgIGlmIChzdG9yZSkge1xuICAgICAgICAgIGZvciAoY29uc3QgdXBkYXRlTWVzc2FnZSBvZiB1cGRhdGVNZXNzYWdlcykge1xuICAgICAgICAgICAgc3RvcmUudXBkYXRlKHVwZGF0ZU1lc3NhZ2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBOb2JvZHkncyBsaXN0ZW5pbmcgZm9yIHRoaXMgZGF0YS4gUXVldWUgaXQgdXAgdW50aWxcbiAgICAgICAgICAvLyBzb21lb25lIHdhbnRzIGl0LlxuICAgICAgICAgIC8vIFhYWCBtZW1vcnkgdXNlIHdpbGwgZ3JvdyB3aXRob3V0IGJvdW5kIGlmIHlvdSBmb3JnZXQgdG9cbiAgICAgICAgICAvLyBjcmVhdGUgYSBjb2xsZWN0aW9uIG9yIGp1c3QgZG9uJ3QgY2FyZSBhYm91dCBpdC4uLiBnb2luZ1xuICAgICAgICAgIC8vIHRvIGhhdmUgdG8gZG8gc29tZXRoaW5nIGFib3V0IHRoYXQuXG4gICAgICAgICAgY29uc3QgdXBkYXRlcyA9IHNlbGYuX3VwZGF0ZXNGb3JVbmtub3duU3RvcmVzO1xuXG4gICAgICAgICAgaWYgKCEgaGFzT3duLmNhbGwodXBkYXRlcywgc3RvcmVOYW1lKSkge1xuICAgICAgICAgICAgdXBkYXRlc1tzdG9yZU5hbWVdID0gW107XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdXBkYXRlc1tzdG9yZU5hbWVdLnB1c2goLi4udXBkYXRlTWVzc2FnZXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBFbmQgdXBkYXRlIHRyYW5zYWN0aW9uLlxuICAgICAgZm9yIChjb25zdCBzdG9yZSBvZiBPYmplY3QudmFsdWVzKHNlbGYuX3N0b3JlcykpIHtcbiAgICAgICAgc3RvcmUuZW5kVXBkYXRlKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VsZi5fcnVuQWZ0ZXJVcGRhdGVDYWxsYmFja3MoKTtcbiAgfVxuXG4gIC8vIENhbGwgYW55IGNhbGxiYWNrcyBkZWZlcnJlZCB3aXRoIF9ydW5XaGVuQWxsU2VydmVyRG9jc0FyZUZsdXNoZWQgd2hvc2VcbiAgLy8gcmVsZXZhbnQgZG9jcyBoYXZlIGJlZW4gZmx1c2hlZCwgYXMgd2VsbCBhcyBkYXRhVmlzaWJsZSBjYWxsYmFja3MgYXRcbiAgLy8gcmVjb25uZWN0LXF1aWVzY2VuY2UgdGltZS5cbiAgX3J1bkFmdGVyVXBkYXRlQ2FsbGJhY2tzKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IGNhbGxiYWNrcyA9IHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzO1xuICAgIHNlbGYuX2FmdGVyVXBkYXRlQ2FsbGJhY2tzID0gW107XG4gICAgY2FsbGJhY2tzLmZvckVhY2goKGMpID0+IHtcbiAgICAgIGMoKTtcbiAgICB9KTtcbiAgfVxuXG4gIF9wdXNoVXBkYXRlKHVwZGF0ZXMsIGNvbGxlY3Rpb24sIG1zZykge1xuICAgIGlmICghIGhhc093bi5jYWxsKHVwZGF0ZXMsIGNvbGxlY3Rpb24pKSB7XG4gICAgICB1cGRhdGVzW2NvbGxlY3Rpb25dID0gW107XG4gICAgfVxuICAgIHVwZGF0ZXNbY29sbGVjdGlvbl0ucHVzaChtc2cpO1xuICB9XG5cbiAgX2dldFNlcnZlckRvYyhjb2xsZWN0aW9uLCBpZCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmICghIGhhc093bi5jYWxsKHNlbGYuX3NlcnZlckRvY3VtZW50cywgY29sbGVjdGlvbikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBzZXJ2ZXJEb2NzRm9yQ29sbGVjdGlvbiA9IHNlbGYuX3NlcnZlckRvY3VtZW50c1tjb2xsZWN0aW9uXTtcbiAgICByZXR1cm4gc2VydmVyRG9jc0ZvckNvbGxlY3Rpb24uZ2V0KGlkKSB8fCBudWxsO1xuICB9XG5cbiAgYXN5bmMgX3Byb2Nlc3NfYWRkZWQobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3QgaWQgPSBNb25nb0lELmlkUGFyc2UobXNnLmlkKTtcbiAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9nZXRTZXJ2ZXJEb2MobXNnLmNvbGxlY3Rpb24sIGlkKTtcbiAgICBpZiAoc2VydmVyRG9jKSB7XG4gICAgICAvLyBTb21lIG91dHN0YW5kaW5nIHN0dWIgd3JvdGUgaGVyZS5cbiAgICAgIGNvbnN0IGlzRXhpc3RpbmcgPSBzZXJ2ZXJEb2MuZG9jdW1lbnQgIT09IHVuZGVmaW5lZDtcblxuICAgICAgc2VydmVyRG9jLmRvY3VtZW50ID0gbXNnLmZpZWxkcyB8fCBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgc2VydmVyRG9jLmRvY3VtZW50Ll9pZCA9IGlkO1xuXG4gICAgICBpZiAoc2VsZi5fcmVzZXRTdG9yZXMpIHtcbiAgICAgICAgLy8gRHVyaW5nIHJlY29ubmVjdCB0aGUgc2VydmVyIGlzIHNlbmRpbmcgYWRkcyBmb3IgZXhpc3RpbmcgaWRzLlxuICAgICAgICAvLyBBbHdheXMgcHVzaCBhbiB1cGRhdGUgc28gdGhhdCBkb2N1bWVudCBzdGF5cyBpbiB0aGUgc3RvcmUgYWZ0ZXJcbiAgICAgICAgLy8gcmVzZXQuIFVzZSBjdXJyZW50IHZlcnNpb24gb2YgdGhlIGRvY3VtZW50IGZvciB0aGlzIHVwZGF0ZSwgc29cbiAgICAgICAgLy8gdGhhdCBzdHViLXdyaXR0ZW4gdmFsdWVzIGFyZSBwcmVzZXJ2ZWQuXG4gICAgICAgIGNvbnN0IGN1cnJlbnREb2MgPSBhd2FpdCBzZWxmLl9zdG9yZXNbbXNnLmNvbGxlY3Rpb25dLmdldERvYyhtc2cuaWQpO1xuICAgICAgICBpZiAoY3VycmVudERvYyAhPT0gdW5kZWZpbmVkKSBtc2cuZmllbGRzID0gY3VycmVudERvYztcblxuICAgICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCBtc2cpO1xuICAgICAgfSBlbHNlIGlmIChpc0V4aXN0aW5nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU2VydmVyIHNlbnQgYWRkIGZvciBleGlzdGluZyBpZDogJyArIG1zZy5pZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgbXNnLmNvbGxlY3Rpb24sIG1zZyk7XG4gICAgfVxuICB9XG5cbiAgX3Byb2Nlc3NfY2hhbmdlZChtc2csIHVwZGF0ZXMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9nZXRTZXJ2ZXJEb2MobXNnLmNvbGxlY3Rpb24sIE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpKTtcbiAgICBpZiAoc2VydmVyRG9jKSB7XG4gICAgICBpZiAoc2VydmVyRG9jLmRvY3VtZW50ID09PSB1bmRlZmluZWQpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU2VydmVyIHNlbnQgY2hhbmdlZCBmb3Igbm9uZXhpc3RpbmcgaWQ6ICcgKyBtc2cuaWQpO1xuICAgICAgRGlmZlNlcXVlbmNlLmFwcGx5Q2hhbmdlcyhzZXJ2ZXJEb2MuZG9jdW1lbnQsIG1zZy5maWVsZHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZWxmLl9wdXNoVXBkYXRlKHVwZGF0ZXMsIG1zZy5jb2xsZWN0aW9uLCBtc2cpO1xuICAgIH1cbiAgfVxuXG4gIF9wcm9jZXNzX3JlbW92ZWQobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgY29uc3Qgc2VydmVyRG9jID0gc2VsZi5fZ2V0U2VydmVyRG9jKG1zZy5jb2xsZWN0aW9uLCBNb25nb0lELmlkUGFyc2UobXNnLmlkKSk7XG4gICAgaWYgKHNlcnZlckRvYykge1xuICAgICAgLy8gU29tZSBvdXRzdGFuZGluZyBzdHViIHdyb3RlIGhlcmUuXG4gICAgICBpZiAoc2VydmVyRG9jLmRvY3VtZW50ID09PSB1bmRlZmluZWQpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU2VydmVyIHNlbnQgcmVtb3ZlZCBmb3Igbm9uZXhpc3RpbmcgaWQ6JyArIG1zZy5pZCk7XG4gICAgICBzZXJ2ZXJEb2MuZG9jdW1lbnQgPSB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgbXNnLmNvbGxlY3Rpb24sIHtcbiAgICAgICAgbXNnOiAncmVtb3ZlZCcsXG4gICAgICAgIGNvbGxlY3Rpb246IG1zZy5jb2xsZWN0aW9uLFxuICAgICAgICBpZDogbXNnLmlkXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBfcHJvY2Vzc191cGRhdGVkKG1zZywgdXBkYXRlcykge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIC8vIFByb2Nlc3MgXCJtZXRob2QgZG9uZVwiIG1lc3NhZ2VzLlxuXG4gICAgbXNnLm1ldGhvZHMuZm9yRWFjaCgobWV0aG9kSWQpID0+IHtcbiAgICAgIGNvbnN0IGRvY3MgPSBzZWxmLl9kb2N1bWVudHNXcml0dGVuQnlTdHViW21ldGhvZElkXSB8fCB7fTtcbiAgICAgIE9iamVjdC52YWx1ZXMoZG9jcykuZm9yRWFjaCgod3JpdHRlbikgPT4ge1xuICAgICAgICBjb25zdCBzZXJ2ZXJEb2MgPSBzZWxmLl9nZXRTZXJ2ZXJEb2Mod3JpdHRlbi5jb2xsZWN0aW9uLCB3cml0dGVuLmlkKTtcbiAgICAgICAgaWYgKCEgc2VydmVyRG9jKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdMb3N0IHNlcnZlckRvYyBmb3IgJyArIEpTT04uc3RyaW5naWZ5KHdyaXR0ZW4pKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoISBzZXJ2ZXJEb2Mud3JpdHRlbkJ5U3R1YnNbbWV0aG9kSWRdKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgJ0RvYyAnICtcbiAgICAgICAgICAgICAgSlNPTi5zdHJpbmdpZnkod3JpdHRlbikgK1xuICAgICAgICAgICAgICAnIG5vdCB3cml0dGVuIGJ5ICBtZXRob2QgJyArXG4gICAgICAgICAgICAgIG1ldGhvZElkXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBkZWxldGUgc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzW21ldGhvZElkXTtcbiAgICAgICAgaWYgKGlzRW1wdHkoc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzKSkge1xuICAgICAgICAgIC8vIEFsbCBtZXRob2RzIHdob3NlIHN0dWJzIHdyb3RlIHRoaXMgbWV0aG9kIGhhdmUgY29tcGxldGVkISBXZSBjYW5cbiAgICAgICAgICAvLyBub3cgY29weSB0aGUgc2F2ZWQgZG9jdW1lbnQgdG8gdGhlIGRhdGFiYXNlIChyZXZlcnRpbmcgdGhlIHN0dWInc1xuICAgICAgICAgIC8vIGNoYW5nZSBpZiB0aGUgc2VydmVyIGRpZCBub3Qgd3JpdGUgdG8gdGhpcyBvYmplY3QsIG9yIGFwcGx5aW5nIHRoZVxuICAgICAgICAgIC8vIHNlcnZlcidzIHdyaXRlcyBpZiBpdCBkaWQpLlxuXG4gICAgICAgICAgLy8gVGhpcyBpcyBhIGZha2UgZGRwICdyZXBsYWNlJyBtZXNzYWdlLiAgSXQncyBqdXN0IGZvciB0YWxraW5nXG4gICAgICAgICAgLy8gYmV0d2VlbiBsaXZlZGF0YSBjb25uZWN0aW9ucyBhbmQgbWluaW1vbmdvLiAgKFdlIGhhdmUgdG8gc3RyaW5naWZ5XG4gICAgICAgICAgLy8gdGhlIElEIGJlY2F1c2UgaXQncyBzdXBwb3NlZCB0byBsb29rIGxpa2UgYSB3aXJlIG1lc3NhZ2UuKVxuICAgICAgICAgIHNlbGYuX3B1c2hVcGRhdGUodXBkYXRlcywgd3JpdHRlbi5jb2xsZWN0aW9uLCB7XG4gICAgICAgICAgICBtc2c6ICdyZXBsYWNlJyxcbiAgICAgICAgICAgIGlkOiBNb25nb0lELmlkU3RyaW5naWZ5KHdyaXR0ZW4uaWQpLFxuICAgICAgICAgICAgcmVwbGFjZTogc2VydmVyRG9jLmRvY3VtZW50XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgLy8gQ2FsbCBhbGwgZmx1c2ggY2FsbGJhY2tzLlxuXG4gICAgICAgICAgc2VydmVyRG9jLmZsdXNoQ2FsbGJhY2tzLmZvckVhY2goKGMpID0+IHtcbiAgICAgICAgICAgIGMoKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIERlbGV0ZSB0aGlzIGNvbXBsZXRlZCBzZXJ2ZXJEb2N1bWVudC4gRG9uJ3QgYm90aGVyIHRvIEdDIGVtcHR5XG4gICAgICAgICAgLy8gSWRNYXBzIGluc2lkZSBzZWxmLl9zZXJ2ZXJEb2N1bWVudHMsIHNpbmNlIHRoZXJlIHByb2JhYmx5IGFyZW4ndFxuICAgICAgICAgIC8vIG1hbnkgY29sbGVjdGlvbnMgYW5kIHRoZXknbGwgYmUgd3JpdHRlbiByZXBlYXRlZGx5LlxuICAgICAgICAgIHNlbGYuX3NlcnZlckRvY3VtZW50c1t3cml0dGVuLmNvbGxlY3Rpb25dLnJlbW92ZSh3cml0dGVuLmlkKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBkZWxldGUgc2VsZi5fZG9jdW1lbnRzV3JpdHRlbkJ5U3R1YlttZXRob2RJZF07XG5cbiAgICAgIC8vIFdlIHdhbnQgdG8gY2FsbCB0aGUgZGF0YS13cml0dGVuIGNhbGxiYWNrLCBidXQgd2UgY2FuJ3QgZG8gc28gdW50aWwgYWxsXG4gICAgICAvLyBjdXJyZW50bHkgYnVmZmVyZWQgbWVzc2FnZXMgYXJlIGZsdXNoZWQuXG4gICAgICBjb25zdCBjYWxsYmFja0ludm9rZXIgPSBzZWxmLl9tZXRob2RJbnZva2Vyc1ttZXRob2RJZF07XG4gICAgICBpZiAoISBjYWxsYmFja0ludm9rZXIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBjYWxsYmFjayBpbnZva2VyIGZvciBtZXRob2QgJyArIG1ldGhvZElkKTtcbiAgICAgIH1cblxuICAgICAgc2VsZi5fcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkKFxuICAgICAgICAoLi4uYXJncykgPT4gY2FsbGJhY2tJbnZva2VyLmRhdGFWaXNpYmxlKC4uLmFyZ3MpXG4gICAgICApO1xuICAgIH0pO1xuICB9XG5cbiAgX3Byb2Nlc3NfcmVhZHkobXNnLCB1cGRhdGVzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgLy8gUHJvY2VzcyBcInN1YiByZWFkeVwiIG1lc3NhZ2VzLiBcInN1YiByZWFkeVwiIG1lc3NhZ2VzIGRvbid0IHRha2UgZWZmZWN0XG4gICAgLy8gdW50aWwgYWxsIGN1cnJlbnQgc2VydmVyIGRvY3VtZW50cyBoYXZlIGJlZW4gZmx1c2hlZCB0byB0aGUgbG9jYWxcbiAgICAvLyBkYXRhYmFzZS4gV2UgY2FuIHVzZSBhIHdyaXRlIGZlbmNlIHRvIGltcGxlbWVudCB0aGlzLlxuXG4gICAgbXNnLnN1YnMuZm9yRWFjaCgoc3ViSWQpID0+IHtcbiAgICAgIHNlbGYuX3J1bldoZW5BbGxTZXJ2ZXJEb2NzQXJlRmx1c2hlZCgoKSA9PiB7XG4gICAgICAgIGNvbnN0IHN1YlJlY29yZCA9IHNlbGYuX3N1YnNjcmlwdGlvbnNbc3ViSWRdO1xuICAgICAgICAvLyBEaWQgd2UgYWxyZWFkeSB1bnN1YnNjcmliZT9cbiAgICAgICAgaWYgKCFzdWJSZWNvcmQpIHJldHVybjtcbiAgICAgICAgLy8gRGlkIHdlIGFscmVhZHkgcmVjZWl2ZSBhIHJlYWR5IG1lc3NhZ2U/IChPb3BzISlcbiAgICAgICAgaWYgKHN1YlJlY29yZC5yZWFkeSkgcmV0dXJuO1xuICAgICAgICBzdWJSZWNvcmQucmVhZHkgPSB0cnVlO1xuICAgICAgICBzdWJSZWNvcmQucmVhZHlDYWxsYmFjayAmJiBzdWJSZWNvcmQucmVhZHlDYWxsYmFjaygpO1xuICAgICAgICBzdWJSZWNvcmQucmVhZHlEZXBzLmNoYW5nZWQoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLy8gRW5zdXJlcyB0aGF0IFwiZlwiIHdpbGwgYmUgY2FsbGVkIGFmdGVyIGFsbCBkb2N1bWVudHMgY3VycmVudGx5IGluXG4gIC8vIF9zZXJ2ZXJEb2N1bWVudHMgaGF2ZSBiZWVuIHdyaXR0ZW4gdG8gdGhlIGxvY2FsIGNhY2hlLiBmIHdpbGwgbm90IGJlIGNhbGxlZFxuICAvLyBpZiB0aGUgY29ubmVjdGlvbiBpcyBsb3N0IGJlZm9yZSB0aGVuIVxuICBfcnVuV2hlbkFsbFNlcnZlckRvY3NBcmVGbHVzaGVkKGYpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBydW5GQWZ0ZXJVcGRhdGVzID0gKCkgPT4ge1xuICAgICAgc2VsZi5fYWZ0ZXJVcGRhdGVDYWxsYmFja3MucHVzaChmKTtcbiAgICB9O1xuICAgIGxldCB1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudCA9IDA7XG4gICAgY29uc3Qgb25TZXJ2ZXJEb2NGbHVzaCA9ICgpID0+IHtcbiAgICAgIC0tdW5mbHVzaGVkU2VydmVyRG9jQ291bnQ7XG4gICAgICBpZiAodW5mbHVzaGVkU2VydmVyRG9jQ291bnQgPT09IDApIHtcbiAgICAgICAgLy8gVGhpcyB3YXMgdGhlIGxhc3QgZG9jIHRvIGZsdXNoISBBcnJhbmdlIHRvIHJ1biBmIGFmdGVyIHRoZSB1cGRhdGVzXG4gICAgICAgIC8vIGhhdmUgYmVlbiBhcHBsaWVkLlxuICAgICAgICBydW5GQWZ0ZXJVcGRhdGVzKCk7XG4gICAgICB9XG4gICAgfTtcblxuICAgIE9iamVjdC52YWx1ZXMoc2VsZi5fc2VydmVyRG9jdW1lbnRzKS5mb3JFYWNoKChzZXJ2ZXJEb2N1bWVudHMpID0+IHtcbiAgICAgIHNlcnZlckRvY3VtZW50cy5mb3JFYWNoKChzZXJ2ZXJEb2MpID0+IHtcbiAgICAgICAgY29uc3Qgd3JpdHRlbkJ5U3R1YkZvckFNZXRob2RXaXRoU2VudE1lc3NhZ2UgPVxuICAgICAgICAgIGtleXMoc2VydmVyRG9jLndyaXR0ZW5CeVN0dWJzKS5zb21lKG1ldGhvZElkID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGludm9rZXIgPSBzZWxmLl9tZXRob2RJbnZva2Vyc1ttZXRob2RJZF07XG4gICAgICAgICAgICByZXR1cm4gaW52b2tlciAmJiBpbnZva2VyLnNlbnRNZXNzYWdlO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIGlmICh3cml0dGVuQnlTdHViRm9yQU1ldGhvZFdpdGhTZW50TWVzc2FnZSkge1xuICAgICAgICAgICsrdW5mbHVzaGVkU2VydmVyRG9jQ291bnQ7XG4gICAgICAgICAgc2VydmVyRG9jLmZsdXNoQ2FsbGJhY2tzLnB1c2gob25TZXJ2ZXJEb2NGbHVzaCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIGlmICh1bmZsdXNoZWRTZXJ2ZXJEb2NDb3VudCA9PT0gMCkge1xuICAgICAgLy8gVGhlcmUgYXJlbid0IGFueSBidWZmZXJlZCBkb2NzIC0tLSB3ZSBjYW4gY2FsbCBmIGFzIHNvb24gYXMgdGhlIGN1cnJlbnRcbiAgICAgIC8vIHJvdW5kIG9mIHVwZGF0ZXMgaXMgYXBwbGllZCFcbiAgICAgIHJ1bkZBZnRlclVwZGF0ZXMoKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBfbGl2ZWRhdGFfbm9zdWIobXNnKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBGaXJzdCBwYXNzIGl0IHRocm91Z2ggX2xpdmVkYXRhX2RhdGEsIHdoaWNoIG9ubHkgdXNlcyBpdCB0byBoZWxwIGdldFxuICAgIC8vIHRvd2FyZHMgcXVpZXNjZW5jZS5cbiAgICBhd2FpdCBzZWxmLl9saXZlZGF0YV9kYXRhKG1zZyk7XG5cbiAgICAvLyBEbyB0aGUgcmVzdCBvZiBvdXIgcHJvY2Vzc2luZyBpbW1lZGlhdGVseSwgd2l0aCBub1xuICAgIC8vIGJ1ZmZlcmluZy11bnRpbC1xdWllc2NlbmNlLlxuXG4gICAgLy8gd2Ugd2VyZW4ndCBzdWJiZWQgYW55d2F5LCBvciB3ZSBpbml0aWF0ZWQgdGhlIHVuc3ViLlxuICAgIGlmICghIGhhc093bi5jYWxsKHNlbGYuX3N1YnNjcmlwdGlvbnMsIG1zZy5pZCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSAjZXJyb3JDYWxsYmFja1xuICAgIGNvbnN0IGVycm9yQ2FsbGJhY2sgPSBzZWxmLl9zdWJzY3JpcHRpb25zW21zZy5pZF0uZXJyb3JDYWxsYmFjaztcbiAgICBjb25zdCBzdG9wQ2FsbGJhY2sgPSBzZWxmLl9zdWJzY3JpcHRpb25zW21zZy5pZF0uc3RvcENhbGxiYWNrO1xuXG4gICAgc2VsZi5fc3Vic2NyaXB0aW9uc1ttc2cuaWRdLnJlbW92ZSgpO1xuXG4gICAgY29uc3QgbWV0ZW9yRXJyb3JGcm9tTXNnID0gbXNnQXJnID0+IHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIG1zZ0FyZyAmJlxuICAgICAgICBtc2dBcmcuZXJyb3IgJiZcbiAgICAgICAgbmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgICBtc2dBcmcuZXJyb3IuZXJyb3IsXG4gICAgICAgICAgbXNnQXJnLmVycm9yLnJlYXNvbixcbiAgICAgICAgICBtc2dBcmcuZXJyb3IuZGV0YWlsc1xuICAgICAgICApXG4gICAgICApO1xuICAgIH07XG5cbiAgICAvLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMSAjZXJyb3JDYWxsYmFja1xuICAgIGlmIChlcnJvckNhbGxiYWNrICYmIG1zZy5lcnJvcikge1xuICAgICAgZXJyb3JDYWxsYmFjayhtZXRlb3JFcnJvckZyb21Nc2cobXNnKSk7XG4gICAgfVxuXG4gICAgaWYgKHN0b3BDYWxsYmFjaykge1xuICAgICAgc3RvcENhbGxiYWNrKG1ldGVvckVycm9yRnJvbU1zZyhtc2cpKTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBfbGl2ZWRhdGFfcmVzdWx0KG1zZykge1xuICAgIC8vIGlkLCByZXN1bHQgb3IgZXJyb3IuIGVycm9yIGhhcyBlcnJvciAoY29kZSksIHJlYXNvbiwgZGV0YWlsc1xuXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICAvLyBMZXRzIG1ha2Ugc3VyZSB0aGVyZSBhcmUgbm8gYnVmZmVyZWQgd3JpdGVzIGJlZm9yZSByZXR1cm5pbmcgcmVzdWx0LlxuICAgIGlmICghIGlzRW1wdHkoc2VsZi5fYnVmZmVyZWRXcml0ZXMpKSB7XG4gICAgICBhd2FpdCBzZWxmLl9mbHVzaEJ1ZmZlcmVkV3JpdGVzKCk7XG4gICAgfVxuXG4gICAgLy8gZmluZCB0aGUgb3V0c3RhbmRpbmcgcmVxdWVzdFxuICAgIC8vIHNob3VsZCBiZSBPKDEpIGluIG5lYXJseSBhbGwgcmVhbGlzdGljIHVzZSBjYXNlc1xuICAgIGlmIChpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnUmVjZWl2ZWQgbWV0aG9kIHJlc3VsdCBidXQgbm8gbWV0aG9kcyBvdXRzdGFuZGluZycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBjdXJyZW50TWV0aG9kQmxvY2sgPSBzZWxmLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzO1xuICAgIGxldCBpO1xuICAgIGNvbnN0IG0gPSBjdXJyZW50TWV0aG9kQmxvY2suZmluZCgobWV0aG9kLCBpZHgpID0+IHtcbiAgICAgIGNvbnN0IGZvdW5kID0gbWV0aG9kLm1ldGhvZElkID09PSBtc2cuaWQ7XG4gICAgICBpZiAoZm91bmQpIGkgPSBpZHg7XG4gICAgICByZXR1cm4gZm91bmQ7XG4gICAgfSk7XG4gICAgaWYgKCFtKSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKFwiQ2FuJ3QgbWF0Y2ggbWV0aG9kIHJlc3BvbnNlIHRvIG9yaWdpbmFsIG1ldGhvZCBjYWxsXCIsIG1zZyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUmVtb3ZlIGZyb20gY3VycmVudCBtZXRob2QgYmxvY2suIFRoaXMgbWF5IGxlYXZlIHRoZSBibG9jayBlbXB0eSwgYnV0IHdlXG4gICAgLy8gZG9uJ3QgbW92ZSBvbiB0byB0aGUgbmV4dCBibG9jayB1bnRpbCB0aGUgY2FsbGJhY2sgaGFzIGJlZW4gZGVsaXZlcmVkLCBpblxuICAgIC8vIF9vdXRzdGFuZGluZ01ldGhvZEZpbmlzaGVkLlxuICAgIGN1cnJlbnRNZXRob2RCbG9jay5zcGxpY2UoaSwgMSk7XG5cbiAgICBpZiAoaGFzT3duLmNhbGwobXNnLCAnZXJyb3InKSkge1xuICAgICAgbS5yZWNlaXZlUmVzdWx0KFxuICAgICAgICBuZXcgTWV0ZW9yLkVycm9yKG1zZy5lcnJvci5lcnJvciwgbXNnLmVycm9yLnJlYXNvbiwgbXNnLmVycm9yLmRldGFpbHMpXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBtc2cucmVzdWx0IG1heSBiZSB1bmRlZmluZWQgaWYgdGhlIG1ldGhvZCBkaWRuJ3QgcmV0dXJuIGFcbiAgICAgIC8vIHZhbHVlXG4gICAgICBtLnJlY2VpdmVSZXN1bHQodW5kZWZpbmVkLCBtc2cucmVzdWx0KTtcbiAgICB9XG4gIH1cblxuICAvLyBDYWxsZWQgYnkgTWV0aG9kSW52b2tlciBhZnRlciBhIG1ldGhvZCdzIGNhbGxiYWNrIGlzIGludm9rZWQuICBJZiB0aGlzIHdhc1xuICAvLyB0aGUgbGFzdCBvdXRzdGFuZGluZyBtZXRob2QgaW4gdGhlIGN1cnJlbnQgYmxvY2ssIHJ1bnMgdGhlIG5leHQgYmxvY2suIElmXG4gIC8vIHRoZXJlIGFyZSBubyBtb3JlIG1ldGhvZHMsIGNvbnNpZGVyIGFjY2VwdGluZyBhIGhvdCBjb2RlIHB1c2guXG4gIF9vdXRzdGFuZGluZ01ldGhvZEZpbmlzaGVkKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9hbnlNZXRob2RzQXJlT3V0c3RhbmRpbmcoKSkgcmV0dXJuO1xuXG4gICAgLy8gTm8gbWV0aG9kcyBhcmUgb3V0c3RhbmRpbmcuIFRoaXMgc2hvdWxkIG1lYW4gdGhhdCB0aGUgZmlyc3QgYmxvY2sgb2ZcbiAgICAvLyBtZXRob2RzIGlzIGVtcHR5LiAoT3IgaXQgbWlnaHQgbm90IGV4aXN0LCBpZiB0aGlzIHdhcyBhIG1ldGhvZCB0aGF0XG4gICAgLy8gaGFsZi1maW5pc2hlZCBiZWZvcmUgZGlzY29ubmVjdC9yZWNvbm5lY3QuKVxuICAgIGlmICghIGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICBjb25zdCBmaXJzdEJsb2NrID0gc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3Muc2hpZnQoKTtcbiAgICAgIGlmICghIGlzRW1wdHkoZmlyc3RCbG9jay5tZXRob2RzKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdObyBtZXRob2RzIG91dHN0YW5kaW5nIGJ1dCBub25lbXB0eSBibG9jazogJyArXG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeShmaXJzdEJsb2NrKVxuICAgICAgICApO1xuXG4gICAgICAvLyBTZW5kIHRoZSBvdXRzdGFuZGluZyBtZXRob2RzIG5vdyBpbiB0aGUgZmlyc3QgYmxvY2suXG4gICAgICBpZiAoISBpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSlcbiAgICAgICAgc2VsZi5fc2VuZE91dHN0YW5kaW5nTWV0aG9kcygpO1xuICAgIH1cblxuICAgIC8vIE1heWJlIGFjY2VwdCBhIGhvdCBjb2RlIHB1c2guXG4gICAgc2VsZi5fbWF5YmVNaWdyYXRlKCk7XG4gIH1cblxuICAvLyBTZW5kcyBtZXNzYWdlcyBmb3IgYWxsIHRoZSBtZXRob2RzIGluIHRoZSBmaXJzdCBibG9jayBpblxuICAvLyBfb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MuXG4gIF9zZW5kT3V0c3RhbmRpbmdNZXRob2RzKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gICAgaWYgKGlzRW1wdHkoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3NbMF0ubWV0aG9kcy5mb3JFYWNoKG0gPT4ge1xuICAgICAgbS5zZW5kTWVzc2FnZSgpO1xuICAgIH0pO1xuICB9XG5cbiAgX2xpdmVkYXRhX2Vycm9yKG1zZykge1xuICAgIE1ldGVvci5fZGVidWcoJ1JlY2VpdmVkIGVycm9yIGZyb20gc2VydmVyOiAnLCBtc2cucmVhc29uKTtcbiAgICBpZiAobXNnLm9mZmVuZGluZ01lc3NhZ2UpIE1ldGVvci5fZGVidWcoJ0ZvcjogJywgbXNnLm9mZmVuZGluZ01lc3NhZ2UpO1xuICB9XG5cbiAgX2NhbGxPblJlY29ubmVjdEFuZFNlbmRBcHByb3ByaWF0ZU91dHN0YW5kaW5nTWV0aG9kcygpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBjb25zdCBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2NrcyA9IHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzO1xuICAgIHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzID0gW107XG5cbiAgICBzZWxmLm9uUmVjb25uZWN0ICYmIHNlbGYub25SZWNvbm5lY3QoKTtcbiAgICBERFAuX3JlY29ubmVjdEhvb2suZWFjaChjYWxsYmFjayA9PiB7XG4gICAgICBjYWxsYmFjayhzZWxmKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuXG4gICAgaWYgKGlzRW1wdHkob2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpKSByZXR1cm47XG5cbiAgICAvLyBXZSBoYXZlIGF0IGxlYXN0IG9uZSBibG9jayB3b3J0aCBvZiBvbGQgb3V0c3RhbmRpbmcgbWV0aG9kcyB0byB0cnlcbiAgICAvLyBhZ2Fpbi4gRmlyc3Q6IGRpZCBvblJlY29ubmVjdCBhY3R1YWxseSBzZW5kIGFueXRoaW5nPyBJZiBub3QsIHdlIGp1c3RcbiAgICAvLyByZXN0b3JlIGFsbCBvdXRzdGFuZGluZyBtZXRob2RzIGFuZCBydW4gdGhlIGZpcnN0IGJsb2NrLlxuICAgIGlmIChpc0VtcHR5KHNlbGYuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzKSkge1xuICAgICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MgPSBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2NrcztcbiAgICAgIHNlbGYuX3NlbmRPdXRzdGFuZGluZ01ldGhvZHMoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBPSywgdGhlcmUgYXJlIGJsb2NrcyBvbiBib3RoIHNpZGVzLiBTcGVjaWFsIGNhc2U6IG1lcmdlIHRoZSBsYXN0IGJsb2NrIG9mXG4gICAgLy8gdGhlIHJlY29ubmVjdCBtZXRob2RzIHdpdGggdGhlIGZpcnN0IGJsb2NrIG9mIHRoZSBvcmlnaW5hbCBtZXRob2RzLCBpZlxuICAgIC8vIG5laXRoZXIgb2YgdGhlbSBhcmUgXCJ3YWl0XCIgYmxvY2tzLlxuICAgIGlmICghIGxhc3Qoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpLndhaXQgJiZcbiAgICAgICAgISBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS53YWl0KSB7XG4gICAgICBvbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzLmZvckVhY2gobSA9PiB7XG4gICAgICAgIGxhc3Qoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MpLm1ldGhvZHMucHVzaChtKTtcblxuICAgICAgICAvLyBJZiB0aGlzIFwibGFzdCBibG9ja1wiIGlzIGFsc28gdGhlIGZpcnN0IGJsb2NrLCBzZW5kIHRoZSBtZXNzYWdlLlxuICAgICAgICBpZiAoc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgbS5zZW5kTWVzc2FnZSgpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgb2xkT3V0c3RhbmRpbmdNZXRob2RCbG9ja3Muc2hpZnQoKTtcbiAgICB9XG5cbiAgICAvLyBOb3cgYWRkIHRoZSByZXN0IG9mIHRoZSBvcmlnaW5hbCBibG9ja3Mgb24uXG4gICAgc2VsZi5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3MucHVzaCguLi5vbGRPdXRzdGFuZGluZ01ldGhvZEJsb2Nrcyk7XG4gIH1cblxuICAvLyBXZSBjYW4gYWNjZXB0IGEgaG90IGNvZGUgcHVzaCBpZiB0aGVyZSBhcmUgbm8gbWV0aG9kcyBpbiBmbGlnaHQuXG4gIF9yZWFkeVRvTWlncmF0ZSgpIHtcbiAgICByZXR1cm4gaXNFbXB0eSh0aGlzLl9tZXRob2RJbnZva2Vycyk7XG4gIH1cblxuICAvLyBJZiB3ZSB3ZXJlIGJsb2NraW5nIGEgbWlncmF0aW9uLCBzZWUgaWYgaXQncyBub3cgcG9zc2libGUgdG8gY29udGludWUuXG4gIC8vIENhbGwgd2hlbmV2ZXIgdGhlIHNldCBvZiBvdXRzdGFuZGluZy9ibG9ja2VkIG1ldGhvZHMgc2hyaW5rcy5cbiAgX21heWJlTWlncmF0ZSgpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fcmV0cnlNaWdyYXRlICYmIHNlbGYuX3JlYWR5VG9NaWdyYXRlKCkpIHtcbiAgICAgIHNlbGYuX3JldHJ5TWlncmF0ZSgpO1xuICAgICAgc2VsZi5fcmV0cnlNaWdyYXRlID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBhc3luYyBvbk1lc3NhZ2UocmF3X21zZykge1xuICAgIGxldCBtc2c7XG4gICAgdHJ5IHtcbiAgICAgIG1zZyA9IEREUENvbW1vbi5wYXJzZUREUChyYXdfbXNnKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKCdFeGNlcHRpb24gd2hpbGUgcGFyc2luZyBERFAnLCBlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBBbnkgbWVzc2FnZSBjb3VudHMgYXMgcmVjZWl2aW5nIGEgcG9uZywgYXMgaXQgZGVtb25zdHJhdGVzIHRoYXRcbiAgICAvLyB0aGUgc2VydmVyIGlzIHN0aWxsIGFsaXZlLlxuICAgIGlmICh0aGlzLl9oZWFydGJlYXQpIHtcbiAgICAgIHRoaXMuX2hlYXJ0YmVhdC5tZXNzYWdlUmVjZWl2ZWQoKTtcbiAgICB9XG5cbiAgICBpZiAobXNnID09PSBudWxsIHx8ICFtc2cubXNnKSB7XG4gICAgICBpZighbXNnIHx8ICFtc2cudGVzdE1lc3NhZ2VPbkNvbm5lY3QpIHtcbiAgICAgICAgaWYgKE9iamVjdC5rZXlzKG1zZykubGVuZ3RoID09PSAxICYmIG1zZy5zZXJ2ZXJfaWQpIHJldHVybjtcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZygnZGlzY2FyZGluZyBpbnZhbGlkIGxpdmVkYXRhIG1lc3NhZ2UnLCBtc2cpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChtc2cubXNnID09PSAnY29ubmVjdGVkJykge1xuICAgICAgdGhpcy5fdmVyc2lvbiA9IHRoaXMuX3ZlcnNpb25TdWdnZXN0aW9uO1xuICAgICAgYXdhaXQgdGhpcy5fbGl2ZWRhdGFfY29ubmVjdGVkKG1zZyk7XG4gICAgICB0aGlzLm9wdGlvbnMub25Db25uZWN0ZWQoKTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdmYWlsZWQnKSB7XG4gICAgICBpZiAodGhpcy5fc3VwcG9ydGVkRERQVmVyc2lvbnMuaW5kZXhPZihtc2cudmVyc2lvbikgPj0gMCkge1xuICAgICAgICB0aGlzLl92ZXJzaW9uU3VnZ2VzdGlvbiA9IG1zZy52ZXJzaW9uO1xuICAgICAgICB0aGlzLl9zdHJlYW0ucmVjb25uZWN0KHsgX2ZvcmNlOiB0cnVlIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZGVzY3JpcHRpb24gPVxuICAgICAgICAgICdERFAgdmVyc2lvbiBuZWdvdGlhdGlvbiBmYWlsZWQ7IHNlcnZlciByZXF1ZXN0ZWQgdmVyc2lvbiAnICtcbiAgICAgICAgICBtc2cudmVyc2lvbjtcbiAgICAgICAgdGhpcy5fc3RyZWFtLmRpc2Nvbm5lY3QoeyBfcGVybWFuZW50OiB0cnVlLCBfZXJyb3I6IGRlc2NyaXB0aW9uIH0pO1xuICAgICAgICB0aGlzLm9wdGlvbnMub25ERFBWZXJzaW9uTmVnb3RpYXRpb25GYWlsdXJlKGRlc2NyaXB0aW9uKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdwaW5nJyAmJiB0aGlzLm9wdGlvbnMucmVzcG9uZFRvUGluZ3MpIHtcbiAgICAgIHRoaXMuX3NlbmQoeyBtc2c6ICdwb25nJywgaWQ6IG1zZy5pZCB9KTtcbiAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdwb25nJykge1xuICAgICAgLy8gbm9vcCwgYXMgd2UgYXNzdW1lIGV2ZXJ5dGhpbmcncyBhIHBvbmdcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgWydhZGRlZCcsICdjaGFuZ2VkJywgJ3JlbW92ZWQnLCAncmVhZHknLCAndXBkYXRlZCddLmluY2x1ZGVzKG1zZy5tc2cpXG4gICAgKSB7XG4gICAgICBhd2FpdCB0aGlzLl9saXZlZGF0YV9kYXRhKG1zZyk7XG4gICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnbm9zdWInKSB7XG4gICAgICBhd2FpdCB0aGlzLl9saXZlZGF0YV9ub3N1Yihtc2cpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ3Jlc3VsdCcpIHtcbiAgICAgIGF3YWl0IHRoaXMuX2xpdmVkYXRhX3Jlc3VsdChtc2cpO1xuICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2Vycm9yJykge1xuICAgICAgdGhpcy5fbGl2ZWRhdGFfZXJyb3IobXNnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgTWV0ZW9yLl9kZWJ1ZygnZGlzY2FyZGluZyB1bmtub3duIGxpdmVkYXRhIG1lc3NhZ2UgdHlwZScsIG1zZyk7XG4gICAgfVxuICB9XG5cbiAgb25SZXNldCgpIHtcbiAgICAvLyBTZW5kIGEgY29ubmVjdCBtZXNzYWdlIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIHN0cmVhbS5cbiAgICAvLyBOT1RFOiByZXNldCBpcyBjYWxsZWQgZXZlbiBvbiB0aGUgZmlyc3QgY29ubmVjdGlvbiwgc28gdGhpcyBpc1xuICAgIC8vIHRoZSBvbmx5IHBsYWNlIHdlIHNlbmQgdGhpcyBtZXNzYWdlLlxuICAgIGNvbnN0IG1zZyA9IHsgbXNnOiAnY29ubmVjdCcgfTtcbiAgICBpZiAodGhpcy5fbGFzdFNlc3Npb25JZCkgbXNnLnNlc3Npb24gPSB0aGlzLl9sYXN0U2Vzc2lvbklkO1xuICAgIG1zZy52ZXJzaW9uID0gdGhpcy5fdmVyc2lvblN1Z2dlc3Rpb24gfHwgdGhpcy5fc3VwcG9ydGVkRERQVmVyc2lvbnNbMF07XG4gICAgdGhpcy5fdmVyc2lvblN1Z2dlc3Rpb24gPSBtc2cudmVyc2lvbjtcbiAgICBtc2cuc3VwcG9ydCA9IHRoaXMuX3N1cHBvcnRlZEREUFZlcnNpb25zO1xuICAgIHRoaXMuX3NlbmQobXNnKTtcblxuICAgIC8vIE1hcmsgbm9uLXJldHJ5IGNhbGxzIGFzIGZhaWxlZC4gVGhpcyBoYXMgdG8gYmUgZG9uZSBlYXJseSBhcyBnZXR0aW5nIHRoZXNlIG1ldGhvZHMgb3V0IG9mIHRoZVxuICAgIC8vIGN1cnJlbnQgYmxvY2sgaXMgcHJldHR5IGltcG9ydGFudCB0byBtYWtpbmcgc3VyZSB0aGF0IHF1aWVzY2VuY2UgaXMgcHJvcGVybHkgY2FsY3VsYXRlZCwgYXNcbiAgICAvLyB3ZWxsIGFzIHBvc3NpYmx5IG1vdmluZyBvbiB0byBhbm90aGVyIHVzZWZ1bCBibG9jay5cblxuICAgIC8vIE9ubHkgYm90aGVyIHRlc3RpbmcgaWYgdGhlcmUgaXMgYW4gb3V0c3RhbmRpbmdNZXRob2RCbG9jayAodGhlcmUgbWlnaHQgbm90IGJlLCBlc3BlY2lhbGx5IGlmXG4gICAgLy8gd2UgYXJlIGNvbm5lY3RpbmcgZm9yIHRoZSBmaXJzdCB0aW1lLlxuICAgIGlmICh0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBJZiB0aGVyZSBpcyBhbiBvdXRzdGFuZGluZyBtZXRob2QgYmxvY2ssIHdlIG9ubHkgY2FyZSBhYm91dCB0aGUgZmlyc3Qgb25lIGFzIHRoYXQgaXMgdGhlXG4gICAgICAvLyBvbmUgdGhhdCBjb3VsZCBoYXZlIGFscmVhZHkgc2VudCBtZXNzYWdlcyB3aXRoIG5vIHJlc3BvbnNlLCB0aGF0IGFyZSBub3QgYWxsb3dlZCB0byByZXRyeS5cbiAgICAgIGNvbnN0IGN1cnJlbnRNZXRob2RCbG9jayA9IHRoaXMuX291dHN0YW5kaW5nTWV0aG9kQmxvY2tzWzBdLm1ldGhvZHM7XG4gICAgICB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzID0gY3VycmVudE1ldGhvZEJsb2NrLmZpbHRlcihcbiAgICAgICAgbWV0aG9kSW52b2tlciA9PiB7XG4gICAgICAgICAgLy8gTWV0aG9kcyB3aXRoICdub1JldHJ5JyBvcHRpb24gc2V0IGFyZSBub3QgYWxsb3dlZCB0byByZS1zZW5kIGFmdGVyXG4gICAgICAgICAgLy8gcmVjb3ZlcmluZyBkcm9wcGVkIGNvbm5lY3Rpb24uXG4gICAgICAgICAgaWYgKG1ldGhvZEludm9rZXIuc2VudE1lc3NhZ2UgJiYgbWV0aG9kSW52b2tlci5ub1JldHJ5KSB7XG4gICAgICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgbWV0aG9kIGlzIHRvbGQgdGhhdCBpdCBmYWlsZWQuXG4gICAgICAgICAgICBtZXRob2RJbnZva2VyLnJlY2VpdmVSZXN1bHQoXG4gICAgICAgICAgICAgIG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICAgICAgICAgICAgJ2ludm9jYXRpb24tZmFpbGVkJyxcbiAgICAgICAgICAgICAgICAnTWV0aG9kIGludm9jYXRpb24gbWlnaHQgaGF2ZSBmYWlsZWQgZHVlIHRvIGRyb3BwZWQgY29ubmVjdGlvbi4gJyArXG4gICAgICAgICAgICAgICAgICAnRmFpbGluZyBiZWNhdXNlIGBub1JldHJ5YCBvcHRpb24gd2FzIHBhc3NlZCB0byBNZXRlb3IuYXBwbHkuJ1xuICAgICAgICAgICAgICApXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE9ubHkga2VlcCBhIG1ldGhvZCBpZiBpdCB3YXNuJ3Qgc2VudCBvciBpdCdzIGFsbG93ZWQgdG8gcmV0cnkuXG4gICAgICAgICAgLy8gVGhpcyBtYXkgbGVhdmUgdGhlIGJsb2NrIGVtcHR5LCBidXQgd2UgZG9uJ3QgbW92ZSBvbiB0byB0aGUgbmV4dFxuICAgICAgICAgIC8vIGJsb2NrIHVudGlsIHRoZSBjYWxsYmFjayBoYXMgYmVlbiBkZWxpdmVyZWQsIGluIF9vdXRzdGFuZGluZ01ldGhvZEZpbmlzaGVkLlxuICAgICAgICAgIHJldHVybiAhKG1ldGhvZEludm9rZXIuc2VudE1lc3NhZ2UgJiYgbWV0aG9kSW52b2tlci5ub1JldHJ5KTtcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBOb3csIHRvIG1pbmltaXplIHNldHVwIGxhdGVuY3ksIGdvIGFoZWFkIGFuZCBibGFzdCBvdXQgYWxsIG9mXG4gICAgLy8gb3VyIHBlbmRpbmcgbWV0aG9kcyBhbmRzIHN1YnNjcmlwdGlvbnMgYmVmb3JlIHdlJ3ZlIGV2ZW4gdGFrZW5cbiAgICAvLyB0aGUgbmVjZXNzYXJ5IFJUVCB0byBrbm93IGlmIHdlIHN1Y2Nlc3NmdWxseSByZWNvbm5lY3RlZC4gKDEpXG4gICAgLy8gVGhleSdyZSBzdXBwb3NlZCB0byBiZSBpZGVtcG90ZW50LCBhbmQgd2hlcmUgdGhleSBhcmUgbm90LFxuICAgIC8vIHRoZXkgY2FuIGJsb2NrIHJldHJ5IGluIGFwcGx5OyAoMikgZXZlbiBpZiB3ZSBkaWQgcmVjb25uZWN0LFxuICAgIC8vIHdlJ3JlIG5vdCBzdXJlIHdoYXQgbWVzc2FnZXMgbWlnaHQgaGF2ZSBnb3R0ZW4gbG9zdFxuICAgIC8vIChpbiBlaXRoZXIgZGlyZWN0aW9uKSBzaW5jZSB3ZSB3ZXJlIGRpc2Nvbm5lY3RlZCAoVENQIGJlaW5nXG4gICAgLy8gc2xvcHB5IGFib3V0IHRoYXQuKVxuXG4gICAgLy8gSWYgdGhlIGN1cnJlbnQgYmxvY2sgb2YgbWV0aG9kcyBhbGwgZ290IHRoZWlyIHJlc3VsdHMgKGJ1dCBkaWRuJ3QgYWxsIGdldFxuICAgIC8vIHRoZWlyIGRhdGEgdmlzaWJsZSksIGRpc2NhcmQgdGhlIGVtcHR5IGJsb2NrIG5vdy5cbiAgICBpZiAoXG4gICAgICB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrcy5sZW5ndGggPiAwICYmXG4gICAgICB0aGlzLl9vdXRzdGFuZGluZ01ldGhvZEJsb2Nrc1swXS5tZXRob2RzLmxlbmd0aCA9PT0gMFxuICAgICkge1xuICAgICAgdGhpcy5fb3V0c3RhbmRpbmdNZXRob2RCbG9ja3Muc2hpZnQoKTtcbiAgICB9XG5cbiAgICAvLyBNYXJrIGFsbCBtZXNzYWdlcyBhcyB1bnNlbnQsIHRoZXkgaGF2ZSBub3QgeWV0IGJlZW4gc2VudCBvbiB0aGlzXG4gICAgLy8gY29ubmVjdGlvbi5cbiAgICBrZXlzKHRoaXMuX21ldGhvZEludm9rZXJzKS5mb3JFYWNoKGlkID0+IHtcbiAgICAgIHRoaXMuX21ldGhvZEludm9rZXJzW2lkXS5zZW50TWVzc2FnZSA9IGZhbHNlO1xuICAgIH0pO1xuXG4gICAgLy8gSWYgYW4gYG9uUmVjb25uZWN0YCBoYW5kbGVyIGlzIHNldCwgY2FsbCBpdCBmaXJzdC4gR28gdGhyb3VnaFxuICAgIC8vIHNvbWUgaG9vcHMgdG8gZW5zdXJlIHRoYXQgbWV0aG9kcyB0aGF0IGFyZSBjYWxsZWQgZnJvbSB3aXRoaW5cbiAgICAvLyBgb25SZWNvbm5lY3RgIGdldCBleGVjdXRlZCBfYmVmb3JlXyBvbmVzIHRoYXQgd2VyZSBvcmlnaW5hbGx5XG4gICAgLy8gb3V0c3RhbmRpbmcgKHNpbmNlIGBvblJlY29ubmVjdGAgaXMgdXNlZCB0byByZS1lc3RhYmxpc2ggYXV0aFxuICAgIC8vIGNlcnRpZmljYXRlcylcbiAgICB0aGlzLl9jYWxsT25SZWNvbm5lY3RBbmRTZW5kQXBwcm9wcmlhdGVPdXRzdGFuZGluZ01ldGhvZHMoKTtcblxuICAgIC8vIGFkZCBuZXcgc3Vic2NyaXB0aW9ucyBhdCB0aGUgZW5kLiB0aGlzIHdheSB0aGV5IHRha2UgZWZmZWN0IGFmdGVyXG4gICAgLy8gdGhlIGhhbmRsZXJzIGFuZCB3ZSBkb24ndCBzZWUgZmxpY2tlci5cbiAgICBPYmplY3QuZW50cmllcyh0aGlzLl9zdWJzY3JpcHRpb25zKS5mb3JFYWNoKChbaWQsIHN1Yl0pID0+IHtcbiAgICAgIHRoaXMuX3NlbmQoe1xuICAgICAgICBtc2c6ICdzdWInLFxuICAgICAgICBpZDogaWQsXG4gICAgICAgIG5hbWU6IHN1Yi5uYW1lLFxuICAgICAgICBwYXJhbXM6IHN1Yi5wYXJhbXNcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG4iLCJpbXBvcnQgeyBERFBDb21tb24gfSBmcm9tICdtZXRlb3IvZGRwLWNvbW1vbic7XG5pbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcblxuaW1wb3J0IHsgQ29ubmVjdGlvbiB9IGZyb20gJy4vbGl2ZWRhdGFfY29ubmVjdGlvbi5qcyc7XG5cbi8vIFRoaXMgYXJyYXkgYWxsb3dzIHRoZSBgX2FsbFN1YnNjcmlwdGlvbnNSZWFkeWAgbWV0aG9kIGJlbG93LCB3aGljaFxuLy8gaXMgdXNlZCBieSB0aGUgYHNwaWRlcmFibGVgIHBhY2thZ2UsIHRvIGtlZXAgdHJhY2sgb2Ygd2hldGhlciBhbGxcbi8vIGRhdGEgaXMgcmVhZHkuXG5jb25zdCBhbGxDb25uZWN0aW9ucyA9IFtdO1xuXG4vKipcbiAqIEBuYW1lc3BhY2UgRERQXG4gKiBAc3VtbWFyeSBOYW1lc3BhY2UgZm9yIEREUC1yZWxhdGVkIG1ldGhvZHMvY2xhc3Nlcy5cbiAqL1xuZXhwb3J0IGNvbnN0IEREUCA9IHt9O1xuXG4vLyBUaGlzIGlzIHByaXZhdGUgYnV0IGl0J3MgdXNlZCBpbiBhIGZldyBwbGFjZXMuIGFjY291bnRzLWJhc2UgdXNlc1xuLy8gaXQgdG8gZ2V0IHRoZSBjdXJyZW50IHVzZXIuIE1ldGVvci5zZXRUaW1lb3V0IGFuZCBmcmllbmRzIGNsZWFyXG4vLyBpdC4gV2UgY2FuIHByb2JhYmx5IGZpbmQgYSBiZXR0ZXIgd2F5IHRvIGZhY3RvciB0aGlzLlxuRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbiA9IG5ldyBNZXRlb3IuRW52aXJvbm1lbnRWYXJpYWJsZSgpO1xuRERQLl9DdXJyZW50UHVibGljYXRpb25JbnZvY2F0aW9uID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlKCk7XG5cbi8vIFhYWDogS2VlcCBERFAuX0N1cnJlbnRJbnZvY2F0aW9uIGZvciBiYWNrd2FyZHMtY29tcGF0aWJpbGl0eS5cbkREUC5fQ3VycmVudEludm9jYXRpb24gPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uO1xuXG5ERFAuX0N1cnJlbnRDYWxsQXN5bmNJbnZvY2F0aW9uID0gbmV3IE1ldGVvci5FbnZpcm9ubWVudFZhcmlhYmxlKCk7XG5cbi8vIFRoaXMgaXMgcGFzc2VkIGludG8gYSB3ZWlyZCBgbWFrZUVycm9yVHlwZWAgZnVuY3Rpb24gdGhhdCBleHBlY3RzIGl0cyB0aGluZ1xuLy8gdG8gYmUgYSBjb25zdHJ1Y3RvclxuZnVuY3Rpb24gY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3IobWVzc2FnZSkge1xuICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuXG5ERFAuQ29ubmVjdGlvbkVycm9yID0gTWV0ZW9yLm1ha2VFcnJvclR5cGUoXG4gICdERFAuQ29ubmVjdGlvbkVycm9yJyxcbiAgY29ubmVjdGlvbkVycm9yQ29uc3RydWN0b3Jcbik7XG5cbkREUC5Gb3JjZWRSZWNvbm5lY3RFcnJvciA9IE1ldGVvci5tYWtlRXJyb3JUeXBlKFxuICAnRERQLkZvcmNlZFJlY29ubmVjdEVycm9yJyxcbiAgKCkgPT4ge31cbik7XG5cbi8vIFJldHVybnMgdGhlIG5hbWVkIHNlcXVlbmNlIG9mIHBzZXVkby1yYW5kb20gdmFsdWVzLlxuLy8gVGhlIHNjb3BlIHdpbGwgYmUgRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKSwgc28gdGhlIHN0cmVhbSB3aWxsIHByb2R1Y2Vcbi8vIGNvbnNpc3RlbnQgdmFsdWVzIGZvciBtZXRob2QgY2FsbHMgb24gdGhlIGNsaWVudCBhbmQgc2VydmVyLlxuRERQLnJhbmRvbVN0cmVhbSA9IG5hbWUgPT4ge1xuICBjb25zdCBzY29wZSA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCk7XG4gIHJldHVybiBERFBDb21tb24uUmFuZG9tU3RyZWFtLmdldChzY29wZSwgbmFtZSk7XG59O1xuXG4vLyBAcGFyYW0gdXJsIHtTdHJpbmd9IFVSTCB0byBNZXRlb3IgYXBwLFxuLy8gICAgIGUuZy46XG4vLyAgICAgXCJzdWJkb21haW4ubWV0ZW9yLmNvbVwiLFxuLy8gICAgIFwiaHR0cDovL3N1YmRvbWFpbi5tZXRlb3IuY29tXCIsXG4vLyAgICAgXCIvXCIsXG4vLyAgICAgXCJkZHArc29ja2pzOi8vZGRwLS0qKioqLWZvby5tZXRlb3IuY29tL3NvY2tqc1wiXG5cbi8qKlxuICogQHN1bW1hcnkgQ29ubmVjdCB0byB0aGUgc2VydmVyIG9mIGEgZGlmZmVyZW50IE1ldGVvciBhcHBsaWNhdGlvbiB0byBzdWJzY3JpYmUgdG8gaXRzIGRvY3VtZW50IHNldHMgYW5kIGludm9rZSBpdHMgcmVtb3RlIG1ldGhvZHMuXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7U3RyaW5nfSB1cmwgVGhlIFVSTCBvZiBhbm90aGVyIE1ldGVvciBhcHBsaWNhdGlvbi5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZWxvYWRXaXRoT3V0c3RhbmRpbmcgaXMgaXQgT0sgdG8gcmVsb2FkIGlmIHRoZXJlIGFyZSBvdXRzdGFuZGluZyBtZXRob2RzP1xuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuaGVhZGVycyBleHRyYSBoZWFkZXJzIHRvIHNlbmQgb24gdGhlIHdlYnNvY2tldHMgY29ubmVjdGlvbiwgZm9yIHNlcnZlci10by1zZXJ2ZXIgRERQIG9ubHlcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zLl9zb2NranNPcHRpb25zIFNwZWNpZmllcyBvcHRpb25zIHRvIHBhc3MgdGhyb3VnaCB0byB0aGUgc29ja2pzIGNsaWVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy5vbkREUE5lZ290aWF0aW9uVmVyc2lvbkZhaWx1cmUgY2FsbGJhY2sgd2hlbiB2ZXJzaW9uIG5lZ290aWF0aW9uIGZhaWxzLlxuICovXG5ERFAuY29ubmVjdCA9ICh1cmwsIG9wdGlvbnMpID0+IHtcbiAgY29uc3QgcmV0ID0gbmV3IENvbm5lY3Rpb24odXJsLCBvcHRpb25zKTtcbiAgYWxsQ29ubmVjdGlvbnMucHVzaChyZXQpOyAvLyBoYWNrLiBzZWUgYmVsb3cuXG4gIHJldHVybiByZXQ7XG59O1xuXG5ERFAuX3JlY29ubmVjdEhvb2sgPSBuZXcgSG9vayh7IGJpbmRFbnZpcm9ubWVudDogZmFsc2UgfSk7XG5cbi8qKlxuICogQHN1bW1hcnkgUmVnaXN0ZXIgYSBmdW5jdGlvbiB0byBjYWxsIGFzIHRoZSBmaXJzdCBzdGVwIG9mXG4gKiByZWNvbm5lY3RpbmcuIFRoaXMgZnVuY3Rpb24gY2FuIGNhbGwgbWV0aG9kcyB3aGljaCB3aWxsIGJlIGV4ZWN1dGVkIGJlZm9yZVxuICogYW55IG90aGVyIG91dHN0YW5kaW5nIG1ldGhvZHMuIEZvciBleGFtcGxlLCB0aGlzIGNhbiBiZSB1c2VkIHRvIHJlLWVzdGFibGlzaFxuICogdGhlIGFwcHJvcHJpYXRlIGF1dGhlbnRpY2F0aW9uIGNvbnRleHQgb24gdGhlIGNvbm5lY3Rpb24uXG4gKiBAbG9jdXMgQW55d2hlcmVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIFRoZSBmdW5jdGlvbiB0byBjYWxsLiBJdCB3aWxsIGJlIGNhbGxlZCB3aXRoIGFcbiAqIHNpbmdsZSBhcmd1bWVudCwgdGhlIFtjb25uZWN0aW9uIG9iamVjdF0oI2RkcF9jb25uZWN0KSB0aGF0IGlzIHJlY29ubmVjdGluZy5cbiAqL1xuRERQLm9uUmVjb25uZWN0ID0gY2FsbGJhY2sgPT4gRERQLl9yZWNvbm5lY3RIb29rLnJlZ2lzdGVyKGNhbGxiYWNrKTtcblxuLy8gSGFjayBmb3IgYHNwaWRlcmFibGVgIHBhY2thZ2U6IGEgd2F5IHRvIHNlZSBpZiB0aGUgcGFnZSBpcyBkb25lXG4vLyBsb2FkaW5nIGFsbCB0aGUgZGF0YSBpdCBuZWVkcy5cbi8vXG5ERFAuX2FsbFN1YnNjcmlwdGlvbnNSZWFkeSA9ICgpID0+IGFsbENvbm5lY3Rpb25zLmV2ZXJ5KFxuICBjb25uID0+IE9iamVjdC52YWx1ZXMoY29ubi5fc3Vic2NyaXB0aW9ucykuZXZlcnkoc3ViID0+IHN1Yi5yZWFkeSlcbik7XG4iXX0=
