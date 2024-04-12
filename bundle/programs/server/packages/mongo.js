Package["core-runtime"].queue("mongo", ["meteor", "npm-mongo", "allow-deny", "random", "ejson", "minimongo", "ddp", "tracker", "diff-sequence", "mongo-id", "check", "ecmascript", "logging", "mongo-decimal", "underscore", "binary-heap", "callback-hook", "ddp-client", "ddp-server", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var NpmModuleMongodb = Package['npm-mongo'].NpmModuleMongodb;
var NpmModuleMongodbVersion = Package['npm-mongo'].NpmModuleMongodbVersion;
var AllowDeny = Package['allow-deny'].AllowDeny;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var check = Package.check.check;
var Match = Package.check.Match;
var ECMAScript = Package.ecmascript.ECMAScript;
var Log = Package.logging.Log;
var Decimal = Package['mongo-decimal'].Decimal;
var _ = Package.underscore._;
var MaxHeap = Package['binary-heap'].MaxHeap;
var MinHeap = Package['binary-heap'].MinHeap;
var MinMaxHeap = Package['binary-heap'].MinMaxHeap;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var MongoInternals, MongoConnection, CursorDescription, Cursor, listenAll, forEachTrigger, OPLOG_COLLECTION, idForOp, OplogHandle, ObserveMultiplexer, options, ObserveHandle, PollingObserveDriver, OplogObserveDriver, Mongo, selector, callback;

var require = meteorInstall({"node_modules":{"meteor":{"mongo":{"mongo_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_driver.js                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    let normalizeProjection;
    module1.link("./mongo_utils", {
      normalizeProjection(v) {
        normalizeProjection = v;
      }
    }, 0);
    let DocFetcher;
    module1.link("./doc_fetcher.js", {
      DocFetcher(v) {
        DocFetcher = v;
      }
    }, 1);
    let ASYNC_CURSOR_METHODS, CLIENT_ONLY_METHODS, getAsyncMethodName;
    module1.link("meteor/minimongo/constants", {
      ASYNC_CURSOR_METHODS(v) {
        ASYNC_CURSOR_METHODS = v;
      },
      CLIENT_ONLY_METHODS(v) {
        CLIENT_ONLY_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 2);
    let Meteor;
    module1.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /**
     * Provide a synchronous Collection API using fibers, backed by
     * MongoDB.  This is only for use on the server, and mostly identical
     * to the client API.
     *
     * NOTE: the public API methods must be run within a fiber. If you call
     * these outside of a fiber they will explode!
     */

    const path = require("path");
    const util = require("util");

    /** @type {import('mongodb')} */
    var MongoDB = NpmModuleMongodb;
    MongoInternals = {};
    MongoInternals.__packageName = 'mongo';
    MongoInternals.NpmModules = {
      mongodb: {
        version: NpmModuleMongodbVersion,
        module: MongoDB
      }
    };

    // Older version of what is now available via
    // MongoInternals.NpmModules.mongodb.module.  It was never documented, but
    // people do use it.
    // XXX COMPAT WITH 1.0.3.2
    MongoInternals.NpmModule = MongoDB;
    const FILE_ASSET_SUFFIX = 'Asset';
    const ASSETS_FOLDER = 'assets';
    const APP_FOLDER = 'app';

    // This is used to add or remove EJSON from the beginning of everything nested
    // inside an EJSON custom type. It should only be called on pure JSON!
    var replaceNames = function (filter, thing) {
      if (typeof thing === "object" && thing !== null) {
        if (_.isArray(thing)) {
          return _.map(thing, _.bind(replaceNames, null, filter));
        }
        var ret = {};
        _.each(thing, function (value, key) {
          ret[filter(key)] = replaceNames(filter, value);
        });
        return ret;
      }
      return thing;
    };

    // Ensure that EJSON.clone keeps a Timestamp as a Timestamp (instead of just
    // doing a structural clone).
    // XXX how ok is this? what if there are multiple copies of MongoDB loaded?
    MongoDB.Timestamp.prototype.clone = function () {
      // Timestamps should be immutable.
      return this;
    };
    var makeMongoLegal = function (name) {
      return "EJSON" + name;
    };
    var unmakeMongoLegal = function (name) {
      return name.substr(5);
    };
    var replaceMongoAtomWithMeteor = function (document) {
      if (document instanceof MongoDB.Binary) {
        // for backwards compatibility
        if (document.sub_type !== 0) {
          return document;
        }
        var buffer = document.value(true);
        return new Uint8Array(buffer);
      }
      if (document instanceof MongoDB.ObjectID) {
        return new Mongo.ObjectID(document.toHexString());
      }
      if (document instanceof MongoDB.Decimal128) {
        return Decimal(document.toString());
      }
      if (document["EJSON$type"] && document["EJSON$value"] && _.size(document) === 2) {
        return EJSON.fromJSONValue(replaceNames(unmakeMongoLegal, document));
      }
      if (document instanceof MongoDB.Timestamp) {
        // For now, the Meteor representation of a Mongo timestamp type (not a date!
        // this is a weird internal thing used in the oplog!) is the same as the
        // Mongo representation. We need to do this explicitly or else we would do a
        // structural clone and lose the prototype.
        return document;
      }
      return undefined;
    };
    var replaceMeteorAtomWithMongo = function (document) {
      if (EJSON.isBinary(document)) {
        // This does more copies than we'd like, but is necessary because
        // MongoDB.BSON only looks like it takes a Uint8Array (and doesn't actually
        // serialize it correctly).
        return new MongoDB.Binary(Buffer.from(document));
      }
      if (document instanceof MongoDB.Binary) {
        return document;
      }
      if (document instanceof Mongo.ObjectID) {
        return new MongoDB.ObjectID(document.toHexString());
      }
      if (document instanceof MongoDB.Timestamp) {
        // For now, the Meteor representation of a Mongo timestamp type (not a date!
        // this is a weird internal thing used in the oplog!) is the same as the
        // Mongo representation. We need to do this explicitly or else we would do a
        // structural clone and lose the prototype.
        return document;
      }
      if (document instanceof Decimal) {
        return MongoDB.Decimal128.fromString(document.toString());
      }
      if (EJSON._isCustomType(document)) {
        return replaceNames(makeMongoLegal, EJSON.toJSONValue(document));
      }
      // It is not ordinarily possible to stick dollar-sign keys into mongo
      // so we don't bother checking for things that need escaping at this time.
      return undefined;
    };
    var replaceTypes = function (document, atomTransformer) {
      if (typeof document !== 'object' || document === null) return document;
      var replacedTopLevelAtom = atomTransformer(document);
      if (replacedTopLevelAtom !== undefined) return replacedTopLevelAtom;
      var ret = document;
      _.each(document, function (val, key) {
        var valReplaced = replaceTypes(val, atomTransformer);
        if (val !== valReplaced) {
          // Lazy clone. Shallow copy.
          if (ret === document) ret = _.clone(document);
          ret[key] = valReplaced;
        }
      });
      return ret;
    };
    MongoConnection = function (url, options) {
      var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
      var self = this;
      options = options || {};
      self._observeMultiplexers = {};
      self._onFailoverHook = new Hook();
      const userOptions = _objectSpread(_objectSpread({}, Mongo._connectionOptions || {}), ((_Meteor$settings = Meteor.settings) === null || _Meteor$settings === void 0 ? void 0 : (_Meteor$settings$pack = _Meteor$settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2.options) || {});
      var mongoOptions = Object.assign({
        ignoreUndefined: true
      }, userOptions);

      // Internally the oplog connections specify their own maxPoolSize
      // which we don't want to overwrite with any user defined value
      if (_.has(options, 'maxPoolSize')) {
        // If we just set this for "server", replSet will override it. If we just
        // set it for replSet, it will be ignored if we're not using a replSet.
        mongoOptions.maxPoolSize = options.maxPoolSize;
      }

      // Transform options like "tlsCAFileAsset": "filename.pem" into
      // "tlsCAFile": "/<fullpath>/filename.pem"
      Object.entries(mongoOptions || {}).filter(_ref => {
        let [key] = _ref;
        return key && key.endsWith(FILE_ASSET_SUFFIX);
      }).forEach(_ref2 => {
        let [key, value] = _ref2;
        const optionName = key.replace(FILE_ASSET_SUFFIX, '');
        mongoOptions[optionName] = path.join(Assets.getServerDir(), ASSETS_FOLDER, APP_FOLDER, value);
        delete mongoOptions[key];
      });
      self.db = null;
      self._oplogHandle = null;
      self._docFetcher = null;
      self.client = new MongoDB.MongoClient(url, mongoOptions);
      self.db = self.client.db();
      self.client.on('serverDescriptionChanged', Meteor.bindEnvironment(event => {
        // When the connection is no longer against the primary node, execute all
        // failover hooks. This is important for the driver as it has to re-pool the
        // query when it happens.
        if (event.previousDescription.type !== 'RSPrimary' && event.newDescription.type === 'RSPrimary') {
          self._onFailoverHook.each(callback => {
            callback();
            return true;
          });
        }
      }));
      if (options.oplogUrl && !Package['disable-oplog']) {
        self._oplogHandle = new OplogHandle(options.oplogUrl, self.db.databaseName);
        self._docFetcher = new DocFetcher(self);
      }
    };
    MongoConnection.prototype._close = async function () {
      var self = this;
      if (!self.db) throw Error("close called before Connection created?");

      // XXX probably untested
      var oplogHandle = self._oplogHandle;
      self._oplogHandle = null;
      if (oplogHandle) await oplogHandle.stop();

      // Use Future.wrap so that errors get thrown. This happens to
      // work even outside a fiber since the 'close' method is not
      // actually asynchronous.
      await self.client.close();
    };
    MongoConnection.prototype.close = function () {
      return this._close();
    };

    // Returns the Mongo Collection object; may yield.
    MongoConnection.prototype.rawCollection = function (collectionName) {
      var self = this;
      if (!self.db) throw Error("rawCollection called before Connection created?");
      return self.db.collection(collectionName);
    };
    MongoConnection.prototype.createCappedCollectionAsync = async function (collectionName, byteSize, maxDocuments) {
      var self = this;
      if (!self.db) throw Error("createCappedCollectionAsync called before Connection created?");
      await self.db.createCollection(collectionName, {
        capped: true,
        size: byteSize,
        max: maxDocuments
      });
    };

    // This should be called synchronously with a write, to create a
    // transaction on the current write fence, if any. After we can read
    // the write, and after observers have been notified (or at least,
    // after the observer notifiers have added themselves to the write
    // fence), you should call 'committed()' on the object returned.
    MongoConnection.prototype._maybeBeginWrite = function () {
      const fence = DDPServer._getCurrentFence();
      if (fence) {
        return fence.beginWrite();
      } else {
        return {
          committed: function () {}
        };
      }
    };

    // Internal interface: adds a callback which is called when the Mongo primary
    // changes. Returns a stop handle.
    MongoConnection.prototype._onFailover = function (callback) {
      return this._onFailoverHook.register(callback);
    };

    //////////// Public API //////////

    // The write methods block until the database has confirmed the write (it may
    // not be replicated or stable on disk, but one server has confirmed it) if no
    // callback is provided. If a callback is provided, then they call the callback
    // when the write is confirmed. They return nothing on success, and raise an
    // exception on failure.
    //
    // After making a write (with insert, update, remove), observers are
    // notified asynchronously. If you want to receive a callback once all
    // of the observer notifications have landed for your write, do the
    // writes inside a write fence (set DDPServer._CurrentWriteFence to a new
    // _WriteFence, and then set a callback on the write fence.)
    //
    // Since our execution environment is single-threaded, this is
    // well-defined -- a write "has been made" if it's returned, and an
    // observer "has been notified" if its callback has returned.

    var writeCallback = function (write, refresh, callback) {
      return function (err, result) {
        if (!err) {
          // XXX We don't have to run this on error, right?
          try {
            refresh();
          } catch (refreshErr) {
            if (callback) {
              callback(refreshErr);
              return;
            } else {
              throw refreshErr;
            }
          }
        }
        write.committed();
        if (callback) {
          callback(err, result);
        } else if (err) {
          throw err;
        }
      };
    };
    var bindEnvironmentForWrite = function (callback) {
      return Meteor.bindEnvironment(callback, "Mongo write");
    };
    MongoConnection.prototype.insertAsync = async function (collection_name, document) {
      const self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        const e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }
      if (!(LocalCollection._isPlainObject(document) && !EJSON._isCustomType(document))) {
        throw new Error("Only plain objects may be inserted into MongoDB");
      }
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await Meteor.refresh({
          collection: collection_name,
          id: document._id
        });
      };
      return self.rawCollection(collection_name).insertOne(replaceTypes(document, replaceMeteorAtomWithMongo), {
        safe: true
      }).then(async _ref3 => {
        let {
          insertedId
        } = _ref3;
        await refresh();
        await write.committed();
        return insertedId;
      }).catch(async e => {
        await write.committed();
        throw e;
      });
    };

    // Cause queries that may be affected by the selector to poll in this write
    // fence.
    MongoConnection.prototype._refresh = async function (collectionName, selector) {
      var refreshKey = {
        collection: collectionName
      };
      // If we know which documents we're removing, don't poll queries that are
      // specific to other documents. (Note that multiple notifications here should
      // not cause multiple polls, since all our listener is doing is enqueueing a
      // poll.)
      var specificIds = LocalCollection._idsMatchedBySelector(selector);
      if (specificIds) {
        for (const id of specificIds) {
          await Meteor.refresh(_.extend({
            id: id
          }, refreshKey));
        }
      } else {
        await Meteor.refresh(refreshKey);
      }
    };
    MongoConnection.prototype.removeAsync = async function (collection_name, selector) {
      var self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        var e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await self._refresh(collection_name, selector);
      };
      return self.rawCollection(collection_name).deleteMany(replaceTypes(selector, replaceMeteorAtomWithMongo), {
        safe: true
      }).then(async _ref4 => {
        let {
          deletedCount
        } = _ref4;
        await refresh();
        await write.committed();
        return transformResult({
          result: {
            modifiedCount: deletedCount
          }
        }).numberAffected;
      }).catch(async err => {
        await write.committed();
        throw err;
      });
    };
    MongoConnection.prototype.dropCollectionAsync = async function (collectionName) {
      var self = this;
      var write = self._maybeBeginWrite();
      var refresh = function () {
        return Meteor.refresh({
          collection: collectionName,
          id: null,
          dropCollection: true
        });
      };
      return self.rawCollection(collectionName).drop().then(async result => {
        await refresh();
        await write.committed();
        return result;
      }).catch(async e => {
        await write.committed();
        throw e;
      });
    };

    // For testing only.  Slightly better than `c.rawDatabase().dropDatabase()`
    // because it lets the test's fence wait for it to be complete.
    MongoConnection.prototype.dropDatabaseAsync = async function () {
      var self = this;
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await Meteor.refresh({
          dropDatabase: true
        });
      };
      try {
        await self.db._dropDatabase();
        await refresh();
        await write.committed();
      } catch (e) {
        await write.committed();
        throw e;
      }
    };
    MongoConnection.prototype.updateAsync = async function (collection_name, selector, mod, options) {
      var self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        var e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }

      // explicit safety check. null and undefined can crash the mongo
      // driver. Although the node driver and minimongo do 'support'
      // non-object modifier in that they don't crash, they are not
      // meaningful operations and do not do anything. Defensively throw an
      // error here.
      if (!mod || typeof mod !== 'object') {
        const error = new Error("Invalid modifier. Modifier must be an object.");
        throw error;
      }
      if (!(LocalCollection._isPlainObject(mod) && !EJSON._isCustomType(mod))) {
        const error = new Error("Only plain objects may be used as replacement" + " documents in MongoDB");
        throw error;
      }
      if (!options) options = {};
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await self._refresh(collection_name, selector);
      };
      var collection = self.rawCollection(collection_name);
      var mongoOpts = {
        safe: true
      };
      // Add support for filtered positional operator
      if (options.arrayFilters !== undefined) mongoOpts.arrayFilters = options.arrayFilters;
      // explictly enumerate options that minimongo supports
      if (options.upsert) mongoOpts.upsert = true;
      if (options.multi) mongoOpts.multi = true;
      // Lets you get a more more full result from MongoDB. Use with caution:
      // might not work with C.upsert (as opposed to C.update({upsert:true}) or
      // with simulated upsert.
      if (options.fullResult) mongoOpts.fullResult = true;
      var mongoSelector = replaceTypes(selector, replaceMeteorAtomWithMongo);
      var mongoMod = replaceTypes(mod, replaceMeteorAtomWithMongo);
      var isModify = LocalCollection._isModificationMod(mongoMod);
      if (options._forbidReplace && !isModify) {
        var err = new Error("Invalid modifier. Replacements are forbidden.");
        throw err;
      }

      // We've already run replaceTypes/replaceMeteorAtomWithMongo on
      // selector and mod.  We assume it doesn't matter, as far as
      // the behavior of modifiers is concerned, whether `_modify`
      // is run on EJSON or on mongo-converted EJSON.

      // Run this code up front so that it fails fast if someone uses
      // a Mongo update operator we don't support.
      let knownId;
      if (options.upsert) {
        try {
          let newDoc = LocalCollection._createUpsertDocument(selector, mod);
          knownId = newDoc._id;
        } catch (err) {
          throw err;
        }
      }
      if (options.upsert && !isModify && !knownId && options.insertedId && !(options.insertedId instanceof Mongo.ObjectID && options.generatedId)) {
        // In case of an upsert with a replacement, where there is no _id defined
        // in either the query or the replacement doc, mongo will generate an id itself.
        // Therefore we need this special strategy if we want to control the id ourselves.

        // We don't need to do this when:
        // - This is not a replacement, so we can add an _id to $setOnInsert
        // - The id is defined by query or mod we can just add it to the replacement doc
        // - The user did not specify any id preference and the id is a Mongo ObjectId,
        //     then we can just let Mongo generate the id
        return await simulateUpsertWithInsertedId(collection, mongoSelector, mongoMod, options).then(async result => {
          await refresh();
          await write.committed();
          if (result && !options._returnObject) {
            return result.numberAffected;
          } else {
            return result;
          }
        });
      } else {
        if (options.upsert && !knownId && options.insertedId && isModify) {
          if (!mongoMod.hasOwnProperty('$setOnInsert')) {
            mongoMod.$setOnInsert = {};
          }
          knownId = options.insertedId;
          Object.assign(mongoMod.$setOnInsert, replaceTypes({
            _id: options.insertedId
          }, replaceMeteorAtomWithMongo));
        }
        const strings = Object.keys(mongoMod).filter(key => !key.startsWith("$"));
        let updateMethod = strings.length > 0 ? 'replaceOne' : 'updateMany';
        updateMethod = updateMethod === 'updateMany' && !mongoOpts.multi ? 'updateOne' : updateMethod;
        return collection[updateMethod].bind(collection)(mongoSelector, mongoMod, mongoOpts).then(async result => {
          var meteorResult = transformResult({
            result
          });
          if (meteorResult && options._returnObject) {
            // If this was an upsertAsync() call, and we ended up
            // inserting a new doc and we know its id, then
            // return that id as well.
            if (options.upsert && meteorResult.insertedId) {
              if (knownId) {
                meteorResult.insertedId = knownId;
              } else if (meteorResult.insertedId instanceof MongoDB.ObjectID) {
                meteorResult.insertedId = new Mongo.ObjectID(meteorResult.insertedId.toHexString());
              }
            }
            await refresh();
            await write.committed();
            return meteorResult;
          } else {
            await refresh();
            await write.committed();
            return meteorResult.numberAffected;
          }
        }).catch(async err => {
          await write.committed();
          throw err;
        });
      }
    };
    var transformResult = function (driverResult) {
      var meteorResult = {
        numberAffected: 0
      };
      if (driverResult) {
        var mongoResult = driverResult.result;
        // On updates with upsert:true, the inserted values come as a list of
        // upserted values -- even with options.multi, when the upsert does insert,
        // it only inserts one element.
        if (mongoResult.upsertedCount) {
          meteorResult.numberAffected = mongoResult.upsertedCount;
          if (mongoResult.upsertedId) {
            meteorResult.insertedId = mongoResult.upsertedId;
          }
        } else {
          // n was used before Mongo 5.0, in Mongo 5.0 we are not receiving this n
          // field and so we are using modifiedCount instead
          meteorResult.numberAffected = mongoResult.n || mongoResult.matchedCount || mongoResult.modifiedCount;
        }
      }
      return meteorResult;
    };
    var NUM_OPTIMISTIC_TRIES = 3;

    // exposed for testing
    MongoConnection._isCannotChangeIdError = function (err) {
      // Mongo 3.2.* returns error as next Object:
      // {name: String, code: Number, errmsg: String}
      // Older Mongo returns:
      // {name: String, code: Number, err: String}
      var error = err.errmsg || err.err;

      // We don't use the error code here
      // because the error code we observed it producing (16837) appears to be
      // a far more generic error code based on examining the source.
      if (error.indexOf('The _id field cannot be changed') === 0 || error.indexOf("the (immutable) field '_id' was found to have been altered to _id") !== -1) {
        return true;
      }
      return false;
    };
    var simulateUpsertWithInsertedId = async function (collection, selector, mod, options) {
      // STRATEGY: First try doing an upsert with a generated ID.
      // If this throws an error about changing the ID on an existing document
      // then without affecting the database, we know we should probably try
      // an update without the generated ID. If it affected 0 documents,
      // then without affecting the database, we the document that first
      // gave the error is probably removed and we need to try an insert again
      // We go back to step one and repeat.
      // Like all "optimistic write" schemes, we rely on the fact that it's
      // unlikely our writes will continue to be interfered with under normal
      // circumstances (though sufficiently heavy contention with writers
      // disagreeing on the existence of an object will cause writes to fail
      // in theory).

      var insertedId = options.insertedId; // must exist
      var mongoOptsForUpdate = {
        safe: true,
        multi: options.multi
      };
      var mongoOptsForInsert = {
        safe: true,
        upsert: true
      };
      var replacementWithId = Object.assign(replaceTypes({
        _id: insertedId
      }, replaceMeteorAtomWithMongo), mod);
      var tries = NUM_OPTIMISTIC_TRIES;
      var doUpdate = async function () {
        tries--;
        if (!tries) {
          throw new Error("Upsert failed after " + NUM_OPTIMISTIC_TRIES + " tries.");
        } else {
          let method = collection.updateMany;
          if (!Object.keys(mod).some(key => key.startsWith("$"))) {
            method = collection.replaceOne.bind(collection);
          }
          return method(selector, mod, mongoOptsForUpdate).then(result => {
            if (result && (result.modifiedCount || result.upsertedCount)) {
              return {
                numberAffected: result.modifiedCount || result.upsertedCount,
                insertedId: result.upsertedId || undefined
              };
            } else {
              return doConditionalInsert();
            }
          });
        }
      };
      var doConditionalInsert = function () {
        return collection.replaceOne(selector, replacementWithId, mongoOptsForInsert).then(result => ({
          numberAffected: result.upsertedCount,
          insertedId: result.upsertedId
        })).catch(err => {
          if (MongoConnection._isCannotChangeIdError(err)) {
            return doUpdate();
          } else {
            throw err;
          }
        });
      };
      return doUpdate();
    };

    // XXX MongoConnection.upsertAsync() does not return the id of the inserted document
    // unless you set it explicitly in the selector or modifier (as a replacement
    // doc).
    MongoConnection.prototype.upsertAsync = async function (collectionName, selector, mod, options) {
      var self = this;
      return self.updateAsync(collectionName, selector, mod, _.extend({}, options, {
        upsert: true,
        _returnObject: true
      }));
    };
    MongoConnection.prototype.find = function (collectionName, selector, options) {
      var self = this;
      if (arguments.length === 1) selector = {};
      return new Cursor(self, new CursorDescription(collectionName, selector, options));
    };
    MongoConnection.prototype.findOneAsync = async function (collection_name, selector, options) {
      var self = this;
      if (arguments.length === 1) {
        selector = {};
      }
      options = options || {};
      options.limit = 1;
      const results = await self.find(collection_name, selector, options).fetch();
      return results[0];
    };

    // We'll actually design an index API later. For now, we just pass through to
    // Mongo's, but make it synchronous.
    MongoConnection.prototype.createIndexAsync = async function (collectionName, index, options) {
      var self = this;

      // We expect this function to be called at startup, not from within a method,
      // so we don't interact with the write fence.
      var collection = self.rawCollection(collectionName);
      await collection.createIndex(index, options);
    };

    // just to be consistent with the other methods
    MongoConnection.prototype.createIndex = MongoConnection.prototype.createIndexAsync;
    MongoConnection.prototype.countDocuments = function (collectionName) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }
      args = args.map(arg => replaceTypes(arg, replaceMeteorAtomWithMongo));
      const collection = this.rawCollection(collectionName);
      return collection.countDocuments(...args);
    };
    MongoConnection.prototype.estimatedDocumentCount = function (collectionName) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      args = args.map(arg => replaceTypes(arg, replaceMeteorAtomWithMongo));
      const collection = this.rawCollection(collectionName);
      return collection.estimatedDocumentCount(...args);
    };
    MongoConnection.prototype.ensureIndexAsync = MongoConnection.prototype.createIndexAsync;
    MongoConnection.prototype.dropIndexAsync = async function (collectionName, index) {
      var self = this;

      // This function is only used by test code, not within a method, so we don't
      // interact with the write fence.
      var collection = self.rawCollection(collectionName);
      var indexName = await collection.dropIndex(index);
    };
    CLIENT_ONLY_METHODS.forEach(function (m) {
      MongoConnection.prototype[m] = function () {
        throw new Error("".concat(m, " +  is not available on the server. Please use ").concat(getAsyncMethodName(m), "() instead."));
      };
    });

    // CURSORS

    // There are several classes which relate to cursors:
    //
    // CursorDescription represents the arguments used to construct a cursor:
    // collectionName, selector, and (find) options.  Because it is used as a key
    // for cursor de-dup, everything in it should either be JSON-stringifiable or
    // not affect observeChanges output (eg, options.transform functions are not
    // stringifiable but do not affect observeChanges).
    //
    // SynchronousCursor is a wrapper around a MongoDB cursor
    // which includes fully-synchronous versions of forEach, etc.
    //
    // Cursor is the cursor object returned from find(), which implements the
    // documented Mongo.Collection cursor API.  It wraps a CursorDescription and a
    // SynchronousCursor (lazily: it doesn't contact Mongo until you call a method
    // like fetch or forEach on it).
    //
    // ObserveHandle is the "observe handle" returned from observeChanges. It has a
    // reference to an ObserveMultiplexer.
    //
    // ObserveMultiplexer allows multiple identical ObserveHandles to be driven by a
    // single observe driver.
    //
    // There are two "observe drivers" which drive ObserveMultiplexers:
    //   - PollingObserveDriver caches the results of a query and reruns it when
    //     necessary.
    //   - OplogObserveDriver follows the Mongo operation log to directly observe
    //     database changes.
    // Both implementations follow the same simple interface: when you create them,
    // they start sending observeChanges callbacks (and a ready() invocation) to
    // their ObserveMultiplexer, and you stop them by calling their stop() method.

    CursorDescription = function (collectionName, selector, options) {
      var self = this;
      self.collectionName = collectionName;
      self.selector = Mongo.Collection._rewriteSelector(selector);
      self.options = options || {};
    };
    Cursor = function (mongo, cursorDescription) {
      var self = this;
      self._mongo = mongo;
      self._cursorDescription = cursorDescription;
      self._synchronousCursor = null;
    };
    function setupSynchronousCursor(cursor, method) {
      // You can only observe a tailable cursor.
      if (cursor._cursorDescription.options.tailable) throw new Error('Cannot call ' + method + ' on a tailable cursor');
      if (!cursor._synchronousCursor) {
        cursor._synchronousCursor = cursor._mongo._createSynchronousCursor(cursor._cursorDescription, {
          // Make sure that the "cursor" argument to forEach/map callbacks is the
          // Cursor, not the SynchronousCursor.
          selfForIteration: cursor,
          useTransform: true
        });
      }
      return cursor._synchronousCursor;
    }
    Cursor.prototype.countAsync = async function () {
      const collection = this._mongo.rawCollection(this._cursorDescription.collectionName);
      return await collection.countDocuments(replaceTypes(this._cursorDescription.selector, replaceMeteorAtomWithMongo), replaceTypes(this._cursorDescription.options, replaceMeteorAtomWithMongo));
    };
    Cursor.prototype.count = function () {
      throw new Error("count() is not avaible on the server. Please use countAsync() instead.");
    };
    [...ASYNC_CURSOR_METHODS, Symbol.iterator, Symbol.asyncIterator].forEach(methodName => {
      // count is handled specially since we don't want to create a cursor.
      // it is still included in ASYNC_CURSOR_METHODS because we still want an async version of it to exist.
      if (methodName === 'count') {
        return;
      }
      Cursor.prototype[methodName] = function () {
        const cursor = setupSynchronousCursor(this, methodName);
        return cursor[methodName](...arguments);
      };

      // These methods are handled separately.
      if (methodName === Symbol.iterator || methodName === Symbol.asyncIterator) {
        return;
      }
      const methodNameAsync = getAsyncMethodName(methodName);
      Cursor.prototype[methodNameAsync] = function () {
        try {
          return Promise.resolve(this[methodName](...arguments));
        } catch (error) {
          return Promise.reject(error);
        }
      };
    });
    Cursor.prototype.getTransform = function () {
      return this._cursorDescription.options.transform;
    };

    // When you call Meteor.publish() with a function that returns a Cursor, we need
    // to transmute it into the equivalent subscription.  This is the function that
    // does that.

    Cursor.prototype._publishCursor = function (sub) {
      var self = this;
      var collection = self._cursorDescription.collectionName;
      return Mongo.Collection._publishCursor(self, sub, collection);
    };

    // Used to guarantee that publish functions return at most one cursor per
    // collection. Private, because we might later have cursors that include
    // documents from multiple collections somehow.
    Cursor.prototype._getCollectionName = function () {
      var self = this;
      return self._cursorDescription.collectionName;
    };
    Cursor.prototype.observe = function (callbacks) {
      var self = this;
      return LocalCollection._observeFromObserveChanges(self, callbacks);
    };
    Cursor.prototype.observeChanges = function (callbacks) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var self = this;
      var methods = ['addedAt', 'added', 'changedAt', 'changed', 'removedAt', 'removed', 'movedTo'];
      var ordered = LocalCollection._observeChangesCallbacksAreOrdered(callbacks);
      let exceptionName = callbacks._fromObserve ? 'observe' : 'observeChanges';
      exceptionName += ' callback';
      methods.forEach(function (method) {
        if (callbacks[method] && typeof callbacks[method] == "function") {
          callbacks[method] = Meteor.bindEnvironment(callbacks[method], method + exceptionName);
        }
      });
      return self._mongo._observeChanges(self._cursorDescription, ordered, callbacks, options.nonMutatingCallbacks);
    };
    MongoConnection.prototype._createSynchronousCursor = function (cursorDescription, options) {
      var self = this;
      options = _.pick(options || {}, 'selfForIteration', 'useTransform');
      var collection = self.rawCollection(cursorDescription.collectionName);
      var cursorOptions = cursorDescription.options;
      var mongoOptions = {
        sort: cursorOptions.sort,
        limit: cursorOptions.limit,
        skip: cursorOptions.skip,
        projection: cursorOptions.fields || cursorOptions.projection,
        readPreference: cursorOptions.readPreference
      };

      // Do we want a tailable cursor (which only works on capped collections)?
      if (cursorOptions.tailable) {
        mongoOptions.numberOfRetries = -1;
      }
      var dbCursor = collection.find(replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo), mongoOptions);

      // Do we want a tailable cursor (which only works on capped collections)?
      if (cursorOptions.tailable) {
        // We want a tailable cursor...
        dbCursor.addCursorFlag("tailable", true);
        // ... and for the server to wait a bit if any getMore has no data (rather
        // than making us put the relevant sleeps in the client)...
        dbCursor.addCursorFlag("awaitData", true);

        // And if this is on the oplog collection and the cursor specifies a 'ts',
        // then set the undocumented oplog replay flag, which does a special scan to
        // find the first document (instead of creating an index on ts). This is a
        // very hard-coded Mongo flag which only works on the oplog collection and
        // only works with the ts field.
        if (cursorDescription.collectionName === OPLOG_COLLECTION && cursorDescription.selector.ts) {
          dbCursor.addCursorFlag("oplogReplay", true);
        }
      }
      if (typeof cursorOptions.maxTimeMs !== 'undefined') {
        dbCursor = dbCursor.maxTimeMS(cursorOptions.maxTimeMs);
      }
      if (typeof cursorOptions.hint !== 'undefined') {
        dbCursor = dbCursor.hint(cursorOptions.hint);
      }
      return new AsynchronousCursor(dbCursor, cursorDescription, options, collection);
    };

    /**
     * This is just a light wrapper for the cursor. The goal here is to ensure compatibility even if
     * there are breaking changes on the MongoDB driver.
     *
     * @constructor
     */
    class AsynchronousCursor {
      constructor(dbCursor, cursorDescription, options) {
        this._dbCursor = dbCursor;
        this._cursorDescription = cursorDescription;
        this._selfForIteration = options.selfForIteration || this;
        if (options.useTransform && cursorDescription.options.transform) {
          this._transform = LocalCollection.wrapTransform(cursorDescription.options.transform);
        } else {
          this._transform = null;
        }
        this._visitedIds = new LocalCollection._IdMap();
      }
      [Symbol.asyncIterator]() {
        var cursor = this;
        return {
          async next() {
            const value = await cursor._nextObjectPromise();
            return {
              done: !value,
              value
            };
          }
        };
      }

      // Returns a Promise for the next object from the underlying cursor (before
      // the Mongo->Meteor type replacement).
      async _rawNextObjectPromise() {
        try {
          return this._dbCursor.next();
        } catch (e) {
          console.error(e);
        }
      }

      // Returns a Promise for the next object from the cursor, skipping those whose
      // IDs we've already seen and replacing Mongo atoms with Meteor atoms.
      async _nextObjectPromise() {
        while (true) {
          var doc = await this._rawNextObjectPromise();
          if (!doc) return null;
          doc = replaceTypes(doc, replaceMongoAtomWithMeteor);
          if (!this._cursorDescription.options.tailable && _.has(doc, '_id')) {
            // Did Mongo give us duplicate documents in the same cursor? If so,
            // ignore this one. (Do this before the transform, since transform might
            // return some unrelated value.) We don't do this for tailable cursors,
            // because we want to maintain O(1) memory usage. And if there isn't _id
            // for some reason (maybe it's the oplog), then we don't do this either.
            // (Be careful to do this for falsey but existing _id, though.)
            if (this._visitedIds.has(doc._id)) continue;
            this._visitedIds.set(doc._id, true);
          }
          if (this._transform) doc = this._transform(doc);
          return doc;
        }
      }

      // Returns a promise which is resolved with the next object (like with
      // _nextObjectPromise) or rejected if the cursor doesn't return within
      // timeoutMS ms.
      _nextObjectPromiseWithTimeout(timeoutMS) {
        if (!timeoutMS) {
          return this._nextObjectPromise();
        }
        const nextObjectPromise = this._nextObjectPromise();
        const timeoutErr = new Error('Client-side timeout waiting for next object');
        const timeoutPromise = new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(timeoutErr);
          }, timeoutMS);
        });
        return Promise.race([nextObjectPromise, timeoutPromise]).catch(err => {
          if (err === timeoutErr) {
            this.close();
          }
          throw err;
        });
      }
      async forEach(callback, thisArg) {
        // Get back to the beginning.
        this._rewind();
        let idx = 0;
        while (true) {
          const doc = await this._nextObjectPromise();
          if (!doc) return;
          await callback.call(thisArg, doc, idx++, this._selfForIteration);
        }
      }
      async map(callback, thisArg) {
        const results = [];
        await this.forEach(async (doc, index) => {
          results.push(await callback.call(thisArg, doc, index, this._selfForIteration));
        });
        return results;
      }
      _rewind() {
        // known to be synchronous
        this._dbCursor.rewind();
        this._visitedIds = new LocalCollection._IdMap();
      }

      // Mostly usable for tailable cursors.
      close() {
        this._dbCursor.close();
      }
      fetch() {
        return this.map(_.identity);
      }

      /**
       * FIXME: (node:34680) [MONGODB DRIVER] Warning: cursor.count is deprecated and will be
       *  removed in the next major version, please use `collection.estimatedDocumentCount` or
       *  `collection.countDocuments` instead.
       */
      count() {
        return this._dbCursor.count();
      }

      // This method is NOT wrapped in Cursor.
      async getRawObjects(ordered) {
        var self = this;
        if (ordered) {
          return self.fetch();
        } else {
          var results = new LocalCollection._IdMap();
          await self.forEach(function (doc) {
            results.set(doc._id, doc);
          });
          return results;
        }
      }
    }
    var SynchronousCursor = function (dbCursor, cursorDescription, options, collection) {
      var self = this;
      options = _.pick(options || {}, 'selfForIteration', 'useTransform');
      self._dbCursor = dbCursor;
      self._cursorDescription = cursorDescription;
      // The "self" argument passed to forEach/map callbacks. If we're wrapped
      // inside a user-visible Cursor, we want to provide the outer cursor!
      self._selfForIteration = options.selfForIteration || self;
      if (options.useTransform && cursorDescription.options.transform) {
        self._transform = LocalCollection.wrapTransform(cursorDescription.options.transform);
      } else {
        self._transform = null;
      }
      self._synchronousCount = Future.wrap(collection.countDocuments.bind(collection, replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo), replaceTypes(cursorDescription.options, replaceMeteorAtomWithMongo)));
      self._visitedIds = new LocalCollection._IdMap();
    };
    _.extend(SynchronousCursor.prototype, {
      // Returns a Promise for the next object from the underlying cursor (before
      // the Mongo->Meteor type replacement).
      _rawNextObjectPromise: function () {
        const self = this;
        return new Promise((resolve, reject) => {
          self._dbCursor.next((err, doc) => {
            if (err) {
              reject(err);
            } else {
              resolve(doc);
            }
          });
        });
      },
      // Returns a Promise for the next object from the cursor, skipping those whose
      // IDs we've already seen and replacing Mongo atoms with Meteor atoms.
      _nextObjectPromise: async function () {
        var self = this;
        while (true) {
          var doc = await self._rawNextObjectPromise();
          if (!doc) return null;
          doc = replaceTypes(doc, replaceMongoAtomWithMeteor);
          if (!self._cursorDescription.options.tailable && _.has(doc, '_id')) {
            // Did Mongo give us duplicate documents in the same cursor? If so,
            // ignore this one. (Do this before the transform, since transform might
            // return some unrelated value.) We don't do this for tailable cursors,
            // because we want to maintain O(1) memory usage. And if there isn't _id
            // for some reason (maybe it's the oplog), then we don't do this either.
            // (Be careful to do this for falsey but existing _id, though.)
            if (self._visitedIds.has(doc._id)) continue;
            self._visitedIds.set(doc._id, true);
          }
          if (self._transform) doc = self._transform(doc);
          return doc;
        }
      },
      // Returns a promise which is resolved with the next object (like with
      // _nextObjectPromise) or rejected if the cursor doesn't return within
      // timeoutMS ms.
      _nextObjectPromiseWithTimeout: function (timeoutMS) {
        const self = this;
        if (!timeoutMS) {
          return self._nextObjectPromise();
        }
        const nextObjectPromise = self._nextObjectPromise();
        const timeoutErr = new Error('Client-side timeout waiting for next object');
        const timeoutPromise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(timeoutErr);
          }, timeoutMS);
        });
        return Promise.race([nextObjectPromise, timeoutPromise]).catch(err => {
          if (err === timeoutErr) {
            self.close();
          }
          throw err;
        });
      },
      _nextObject: function () {
        var self = this;
        return self._nextObjectPromise().await();
      },
      forEach: function (callback, thisArg) {
        var self = this;
        const wrappedFn = Meteor.wrapFn(callback);

        // Get back to the beginning.
        self._rewind();

        // We implement the loop ourself instead of using self._dbCursor.each,
        // because "each" will call its callback outside of a fiber which makes it
        // much more complex to make this function synchronous.
        var index = 0;
        while (true) {
          var doc = self._nextObject();
          if (!doc) return;
          wrappedFn.call(thisArg, doc, index++, self._selfForIteration);
        }
      },
      // XXX Allow overlapping callback executions if callback yields.
      map: function (callback, thisArg) {
        var self = this;
        const wrappedFn = Meteor.wrapFn(callback);
        var res = [];
        self.forEach(function (doc, index) {
          res.push(wrappedFn.call(thisArg, doc, index, self._selfForIteration));
        });
        return res;
      },
      _rewind: function () {
        var self = this;

        // known to be synchronous
        self._dbCursor.rewind();
        self._visitedIds = new LocalCollection._IdMap();
      },
      // Mostly usable for tailable cursors.
      close: function () {
        var self = this;
        self._dbCursor.close();
      },
      fetch: function () {
        var self = this;
        return self.map(_.identity);
      },
      count: function () {
        var self = this;
        return self._synchronousCount().wait();
      },
      // This method is NOT wrapped in Cursor.
      getRawObjects: function (ordered) {
        var self = this;
        if (ordered) {
          return self.fetch();
        } else {
          var results = new LocalCollection._IdMap();
          self.forEach(function (doc) {
            results.set(doc._id, doc);
          });
          return results;
        }
      }
    });
    SynchronousCursor.prototype[Symbol.iterator] = function () {
      var self = this;

      // Get back to the beginning.
      self._rewind();
      return {
        next() {
          const doc = self._nextObject();
          return doc ? {
            value: doc
          } : {
            done: true
          };
        }
      };
    };
    SynchronousCursor.prototype[Symbol.asyncIterator] = function () {
      const syncResult = this[Symbol.iterator]();
      return {
        async next() {
          return Promise.resolve(syncResult.next());
        }
      };
    };

    // Tails the cursor described by cursorDescription, most likely on the
    // oplog. Calls docCallback with each document found. Ignores errors and just
    // restarts the tail on error.
    //
    // If timeoutMS is set, then if we don't get a new document every timeoutMS,
    // kill and restart the cursor. This is primarily a workaround for #8598.
    MongoConnection.prototype.tail = function (cursorDescription, docCallback, timeoutMS) {
      var self = this;
      if (!cursorDescription.options.tailable) throw new Error("Can only tail a tailable cursor");
      var cursor = self._createSynchronousCursor(cursorDescription);
      var stopped = false;
      var lastTS;
      Meteor.defer(async function loop() {
        var doc = null;
        while (true) {
          if (stopped) return;
          try {
            doc = await cursor._nextObjectPromiseWithTimeout(timeoutMS);
          } catch (err) {
            // There's no good way to figure out if this was actually an error from
            // Mongo, or just client-side (including our own timeout error). Ah
            // well. But either way, we need to retry the cursor (unless the failure
            // was because the observe got stopped).
            doc = null;
          }
          // Since we awaited a promise above, we need to check again to see if
          // we've been stopped before calling the callback.
          if (stopped) return;
          if (doc) {
            // If a tailable cursor contains a "ts" field, use it to recreate the
            // cursor on error. ("ts" is a standard that Mongo uses internally for
            // the oplog, and there's a special flag that lets you do binary search
            // on it instead of needing to use an index.)
            lastTS = doc.ts;
            docCallback(doc);
          } else {
            var newSelector = _.clone(cursorDescription.selector);
            if (lastTS) {
              newSelector.ts = {
                $gt: lastTS
              };
            }
            cursor = self._createSynchronousCursor(new CursorDescription(cursorDescription.collectionName, newSelector, cursorDescription.options));
            // Mongo failover takes many seconds.  Retry in a bit.  (Without this
            // setTimeout, we peg the CPU at 100% and never notice the actual
            // failover.
            setTimeout(loop, 100);
            break;
          }
        }
      });
      return {
        stop: function () {
          stopped = true;
          cursor.close();
        }
      };
    };
    Object.assign(MongoConnection.prototype, {
      _observeChanges: async function (cursorDescription, ordered, callbacks, nonMutatingCallbacks) {
        var self = this;
        if (cursorDescription.options.tailable) {
          return self._observeChangesTailable(cursorDescription, ordered, callbacks);
        }

        // You may not filter out _id when observing changes, because the id is a core
        // part of the observeChanges API.
        const fieldsOptions = cursorDescription.options.projection || cursorDescription.options.fields;
        if (fieldsOptions && (fieldsOptions._id === 0 || fieldsOptions._id === false)) {
          throw Error("You may not observe a cursor with {fields: {_id: 0}}");
        }
        var observeKey = EJSON.stringify(_.extend({
          ordered: ordered
        }, cursorDescription));
        var multiplexer, observeDriver;
        var firstHandle = false;

        // Find a matching ObserveMultiplexer, or create a new one. This next block is
        // guaranteed to not yield (and it doesn't call anything that can observe a
        // new query), so no other calls to this function can interleave with it.
        if (_.has(self._observeMultiplexers, observeKey)) {
          multiplexer = self._observeMultiplexers[observeKey];
        } else {
          firstHandle = true;
          // Create a new ObserveMultiplexer.
          multiplexer = new ObserveMultiplexer({
            ordered: ordered,
            onStop: function () {
              delete self._observeMultiplexers[observeKey];
              return observeDriver.stop();
            }
          });
        }
        var observeHandle = new ObserveHandle(multiplexer, callbacks, nonMutatingCallbacks);
        if (firstHandle) {
          var matcher, sorter;
          var canUseOplog = _.all([function () {
            // At a bare minimum, using the oplog requires us to have an oplog, to
            // want unordered callbacks, and to not want a callback on the polls
            // that won't happen.
            return self._oplogHandle && !ordered && !callbacks._testOnlyPollCallback;
          }, function () {
            // We need to be able to compile the selector. Fall back to polling for
            // some newfangled $selector that minimongo doesn't support yet.
            try {
              matcher = new Minimongo.Matcher(cursorDescription.selector);
              return true;
            } catch (e) {
              // XXX make all compilation errors MinimongoError or something
              //     so that this doesn't ignore unrelated exceptions
              return false;
            }
          }, function () {
            // ... and the selector itself needs to support oplog.
            return OplogObserveDriver.cursorSupported(cursorDescription, matcher);
          }, function () {
            // And we need to be able to compile the sort, if any.  eg, can't be
            // {$natural: 1}.
            if (!cursorDescription.options.sort) return true;
            try {
              sorter = new Minimongo.Sorter(cursorDescription.options.sort);
              return true;
            } catch (e) {
              // XXX make all compilation errors MinimongoError or something
              //     so that this doesn't ignore unrelated exceptions
              return false;
            }
          }], function (f) {
            return f();
          }); // invoke each function

          var driverClass = canUseOplog ? OplogObserveDriver : PollingObserveDriver;
          observeDriver = new driverClass({
            cursorDescription: cursorDescription,
            mongoHandle: self,
            multiplexer: multiplexer,
            ordered: ordered,
            matcher: matcher,
            // ignored by polling
            sorter: sorter,
            // ignored by polling
            _testOnlyPollCallback: callbacks._testOnlyPollCallback
          });
          if (observeDriver._init) {
            await observeDriver._init();
          }

          // This field is only set for use in tests.
          multiplexer._observeDriver = observeDriver;
        }
        self._observeMultiplexers[observeKey] = multiplexer;
        // Blocks until the initial adds have been sent.
        await multiplexer.addHandleAndSendInitialAdds(observeHandle);
        return observeHandle;
      }
    });

    // Listen for the invalidation messages that will trigger us to poll the
    // database for changes. If this selector specifies specific IDs, specify them
    // here, so that updates to different specific IDs don't cause us to poll.
    // listenCallback is the same kind of (notification, complete) callback passed
    // to InvalidationCrossbar.listen.

    listenAll = function (cursorDescription, listenCallback) {
      var listeners = [];
      forEachTrigger(cursorDescription, function (trigger) {
        listeners.push(DDPServer._InvalidationCrossbar.listen(trigger, listenCallback));
      });
      return {
        stop: function () {
          _.each(listeners, function (listener) {
            listener.stop();
          });
        }
      };
    };
    forEachTrigger = function (cursorDescription, triggerCallback) {
      var key = {
        collection: cursorDescription.collectionName
      };
      var specificIds = LocalCollection._idsMatchedBySelector(cursorDescription.selector);
      if (specificIds) {
        _.each(specificIds, function (id) {
          triggerCallback(_.extend({
            id: id
          }, key));
        });
        triggerCallback(_.extend({
          dropCollection: true,
          id: null
        }, key));
      } else {
        triggerCallback(key);
      }
      // Everyone cares about the database being dropped.
      triggerCallback({
        dropDatabase: true
      });
    };

    // observeChanges for tailable cursors on capped collections.
    //
    // Some differences from normal cursors:
    //   - Will never produce anything other than 'added' or 'addedBefore'. If you
    //     do update a document that has already been produced, this will not notice
    //     it.
    //   - If you disconnect and reconnect from Mongo, it will essentially restart
    //     the query, which will lead to duplicate results. This is pretty bad,
    //     but if you include a field called 'ts' which is inserted as
    //     new MongoInternals.MongoTimestamp(0, 0) (which is initialized to the
    //     current Mongo-style timestamp), we'll be able to find the place to
    //     restart properly. (This field is specifically understood by Mongo with an
    //     optimization which allows it to find the right place to start without
    //     an index on ts. It's how the oplog works.)
    //   - No callbacks are triggered synchronously with the call (there's no
    //     differentiation between "initial data" and "later changes"; everything
    //     that matches the query gets sent asynchronously).
    //   - De-duplication is not implemented.
    //   - Does not yet interact with the write fence. Probably, this should work by
    //     ignoring removes (which don't work on capped collections) and updates
    //     (which don't affect tailable cursors), and just keeping track of the ID
    //     of the inserted object, and closing the write fence once you get to that
    //     ID (or timestamp?).  This doesn't work well if the document doesn't match
    //     the query, though.  On the other hand, the write fence can close
    //     immediately if it does not match the query. So if we trust minimongo
    //     enough to accurately evaluate the query against the write fence, we
    //     should be able to do this...  Of course, minimongo doesn't even support
    //     Mongo Timestamps yet.
    MongoConnection.prototype._observeChangesTailable = function (cursorDescription, ordered, callbacks) {
      var self = this;

      // Tailable cursors only ever call added/addedBefore callbacks, so it's an
      // error if you didn't provide them.
      if (ordered && !callbacks.addedBefore || !ordered && !callbacks.added) {
        throw new Error("Can't observe an " + (ordered ? "ordered" : "unordered") + " tailable cursor without a " + (ordered ? "addedBefore" : "added") + " callback");
      }
      return self.tail(cursorDescription, function (doc) {
        var id = doc._id;
        delete doc._id;
        // The ts is an implementation detail. Hide it.
        delete doc.ts;
        if (ordered) {
          callbacks.addedBefore(id, doc, null);
        } else {
          callbacks.added(id, doc);
        }
      });
    };

    // XXX We probably need to find a better way to expose this. Right now
    // it's only used by tests, but in fact you need it in normal
    // operation to interact with capped collections.
    MongoInternals.MongoTimestamp = MongoDB.Timestamp;
    MongoInternals.Connection = MongoConnection;
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

},"oplog_tailing.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_tailing.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let NpmModuleMongodb;
    module.link("meteor/npm-mongo", {
      NpmModuleMongodb(v) {
        NpmModuleMongodb = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const {
      Long
    } = NpmModuleMongodb;
    OPLOG_COLLECTION = 'oplog.rs';
    var TOO_FAR_BEHIND = process.env.METEOR_OPLOG_TOO_FAR_BEHIND || 2000;
    var TAIL_TIMEOUT = +process.env.METEOR_OPLOG_TAIL_TIMEOUT || 30000;
    idForOp = function (op) {
      if (op.op === 'd') return op.o._id;else if (op.op === 'i') return op.o._id;else if (op.op === 'u') return op.o2._id;else if (op.op === 'c') throw Error("Operator 'c' doesn't supply an object with id: " + EJSON.stringify(op));else throw Error("Unknown op: " + EJSON.stringify(op));
    };
    OplogHandle = function (oplogUrl, dbName) {
      var self = this;
      self._oplogUrl = oplogUrl;
      self._dbName = dbName;
      self._oplogLastEntryConnection = null;
      self._oplogTailConnection = null;
      self._stopped = false;
      self._tailHandle = null;
      self._readyPromiseResolver = null;
      self._readyPromise = new Promise(r => self._readyPromiseResolver = r);
      self._crossbar = new DDPServer._Crossbar({
        factPackage: "mongo-livedata",
        factName: "oplog-watchers"
      });
      self._baseOplogSelector = {
        ns: new RegExp("^(?:" + [Meteor._escapeRegExp(self._dbName + "."), Meteor._escapeRegExp("admin.$cmd")].join("|") + ")"),
        $or: [{
          op: {
            $in: ['i', 'u', 'd']
          }
        },
        // drop collection
        {
          op: 'c',
          'o.drop': {
            $exists: true
          }
        }, {
          op: 'c',
          'o.dropDatabase': 1
        }, {
          op: 'c',
          'o.applyOps': {
            $exists: true
          }
        }]
      };

      // Data structures to support waitUntilCaughtUp(). Each oplog entry has a
      // MongoTimestamp object on it (which is not the same as a Date --- it's a
      // combination of time and an incrementing counter; see
      // http://docs.mongodb.org/manual/reference/bson-types/#timestamps).
      //
      // _catchingUpFutures is an array of {ts: MongoTimestamp, future: Future}
      // objects, sorted by ascending timestamp. _lastProcessedTS is the
      // MongoTimestamp of the last oplog entry we've processed.
      //
      // Each time we call waitUntilCaughtUp, we take a peek at the final oplog
      // entry in the db.  If we've already processed it (ie, it is not greater than
      // _lastProcessedTS), waitUntilCaughtUp immediately returns. Otherwise,
      // waitUntilCaughtUp makes a new Future and inserts it along with the final
      // timestamp entry that it read, into _catchingUpFutures. waitUntilCaughtUp
      // then waits on that future, which is resolved once _lastProcessedTS is
      // incremented to be past its timestamp by the worker fiber.
      //
      // XXX use a priority queue or something else that's faster than an array
      self._catchingUpResolvers = [];
      self._lastProcessedTS = null;
      self._onSkippedEntriesHook = new Hook({
        debugPrintExceptions: "onSkippedEntries callback"
      });
      self._entryQueue = new Meteor._DoubleEndedQueue();
      self._workerActive = false;
      const shouldAwait = self._startTailing();
      //TODO[fibers] Why wait?
    };
    Object.assign(OplogHandle.prototype, {
      stop: async function () {
        var self = this;
        if (self._stopped) return;
        self._stopped = true;
        if (self._tailHandle) await self._tailHandle.stop();
        // XXX should close connections too
      },
      _onOplogEntry: async function (trigger, callback) {
        var self = this;
        if (self._stopped) throw new Error("Called onOplogEntry on stopped handle!");

        // Calling onOplogEntry requires us to wait for the tailing to be ready.
        await self._readyPromise;
        var originalCallback = callback;
        callback = Meteor.bindEnvironment(function (notification) {
          originalCallback(notification);
        }, function (err) {
          Meteor._debug("Error in oplog callback", err);
        });
        var listenHandle = self._crossbar.listen(trigger, callback);
        return {
          stop: async function () {
            await listenHandle.stop();
          }
        };
      },
      onOplogEntry: function (trigger, callback) {
        return this._onOplogEntry(trigger, callback);
      },
      // Register a callback to be invoked any time we skip oplog entries (eg,
      // because we are too far behind).
      onSkippedEntries: function (callback) {
        var self = this;
        if (self._stopped) throw new Error("Called onSkippedEntries on stopped handle!");
        return self._onSkippedEntriesHook.register(callback);
      },
      async _waitUntilCaughtUp() {
        var self = this;
        if (self._stopped) throw new Error("Called waitUntilCaughtUp on stopped handle!");

        // Calling waitUntilCaughtUp requries us to wait for the oplog connection to
        // be ready.
        await self._readyPromise;
        var lastEntry;
        while (!self._stopped) {
          // We need to make the selector at least as restrictive as the actual
          // tailing selector (ie, we need to specify the DB name) or else we might
          // find a TS that won't show up in the actual tail stream.
          try {
            lastEntry = await self._oplogLastEntryConnection.findOneAsync(OPLOG_COLLECTION, self._baseOplogSelector, {
              projection: {
                ts: 1
              },
              sort: {
                $natural: -1
              }
            });
            break;
          } catch (e) {
            // During failover (eg) if we get an exception we should log and retry
            // instead of crashing.
            Meteor._debug("Got exception while reading last entry", e);
            await Meteor._sleepForMs(100);
          }
        }
        if (self._stopped) return;
        if (!lastEntry) {
          // Really, nothing in the oplog? Well, we've processed everything.
          return;
        }
        var ts = lastEntry.ts;
        if (!ts) throw Error("oplog entry without ts: " + EJSON.stringify(lastEntry));
        if (self._lastProcessedTS && ts.lessThanOrEqual(self._lastProcessedTS)) {
          // We've already caught up to here.
          return;
        }

        // Insert the future into our list. Almost always, this will be at the end,
        // but it's conceivable that if we fail over from one primary to another,
        // the oplog entries we see will go backwards.
        var insertAfter = self._catchingUpResolvers.length;
        while (insertAfter - 1 > 0 && self._catchingUpResolvers[insertAfter - 1].ts.greaterThan(ts)) {
          insertAfter--;
        }
        let promiseResolver = null;
        const promiseToAwait = new Promise(r => promiseResolver = r);
        self._catchingUpResolvers.splice(insertAfter, 0, {
          ts: ts,
          resolver: promiseResolver
        });
        await promiseToAwait;
      },
      // Calls `callback` once the oplog has been processed up to a point that is
      // roughly "now": specifically, once we've processed all ops that are
      // currently visible.
      // XXX become convinced that this is actually safe even if oplogConnection
      // is some kind of pool
      waitUntilCaughtUp: function () {
        return this._waitUntilCaughtUp();
      },
      _startTailing: async function () {
        var self = this;
        // First, make sure that we're talking to the local database.
        var mongodbUri = Npm.require('mongodb-uri');
        if (mongodbUri.parse(self._oplogUrl).database !== 'local') {
          throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " + "a Mongo replica set");
        }

        // We make two separate connections to Mongo. The Node Mongo driver
        // implements a naive round-robin connection pool: each "connection" is a
        // pool of several (5 by default) TCP connections, and each request is
        // rotated through the pools. Tailable cursor queries block on the server
        // until there is some data to return (or until a few seconds have
        // passed). So if the connection pool used for tailing cursors is the same
        // pool used for other queries, the other queries will be delayed by seconds
        // 1/5 of the time.
        //
        // The tail connection will only ever be running a single tail command, so
        // it only needs to make one underlying TCP connection.
        self._oplogTailConnection = new MongoConnection(self._oplogUrl, {
          maxPoolSize: 1
        });
        // XXX better docs, but: it's to get monotonic results
        // XXX is it safe to say "if there's an in flight query, just use its
        //     results"? I don't think so but should consider that
        self._oplogLastEntryConnection = new MongoConnection(self._oplogUrl, {
          maxPoolSize: 1
        });

        // Now, make sure that there actually is a repl set here. If not, oplog
        // tailing won't ever find anything!
        // More on the isMasterDoc
        // https://docs.mongodb.com/manual/reference/command/isMaster/
        const isMasterDoc = await new Promise(function (resolve, reject) {
          self._oplogLastEntryConnection.db.admin().command({
            ismaster: 1
          }, function (err, result) {
            if (err) reject(err);else resolve(result);
          });
        });
        if (!(isMasterDoc && isMasterDoc.setName)) {
          throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " + "a Mongo replica set");
        }

        // Find the last oplog entry.
        var lastOplogEntry = await self._oplogLastEntryConnection.findOneAsync(OPLOG_COLLECTION, {}, {
          sort: {
            $natural: -1
          },
          projection: {
            ts: 1
          }
        });
        var oplogSelector = Object.assign({}, self._baseOplogSelector);
        if (lastOplogEntry) {
          // Start after the last entry that currently exists.
          oplogSelector.ts = {
            $gt: lastOplogEntry.ts
          };
          // If there are any calls to callWhenProcessedLatest before any other
          // oplog entries show up, allow callWhenProcessedLatest to call its
          // callback immediately.
          self._lastProcessedTS = lastOplogEntry.ts;
        }
        var cursorDescription = new CursorDescription(OPLOG_COLLECTION, oplogSelector, {
          tailable: true
        });

        // Start tailing the oplog.
        //
        // We restart the low-level oplog query every 30 seconds if we didn't get a
        // doc. This is a workaround for #8598: the Node Mongo driver has at least
        // one bug that can lead to query callbacks never getting called (even with
        // an error) when leadership failover occur.
        self._tailHandle = self._oplogTailConnection.tail(cursorDescription, function (doc) {
          self._entryQueue.push(doc);
          self._maybeStartWorker();
        }, TAIL_TIMEOUT);
        self._readyPromiseResolver();
      },
      _maybeStartWorker: function () {
        var self = this;
        if (self._workerActive) return;
        self._workerActive = true;
        Meteor.defer(async function () {
          // May be called recursively in case of transactions.
          async function handleDoc(doc) {
            if (doc.ns === "admin.$cmd") {
              if (doc.o.applyOps) {
                // This was a successful transaction, so we need to apply the
                // operations that were involved.
                let nextTimestamp = doc.ts;
                for (const op of doc.o.applyOps) {
                  // See https://github.com/meteor/meteor/issues/10420.
                  if (!op.ts) {
                    op.ts = nextTimestamp;
                    nextTimestamp = nextTimestamp.add(Long.ONE);
                  }
                  await handleDoc(op);
                }
                return;
              }
              throw new Error("Unknown command " + EJSON.stringify(doc));
            }
            const trigger = {
              dropCollection: false,
              dropDatabase: false,
              op: doc
            };
            if (typeof doc.ns === "string" && doc.ns.startsWith(self._dbName + ".")) {
              trigger.collection = doc.ns.slice(self._dbName.length + 1);
            }

            // Is it a special command and the collection name is hidden
            // somewhere in operator?
            if (trigger.collection === "$cmd") {
              if (doc.o.dropDatabase) {
                delete trigger.collection;
                trigger.dropDatabase = true;
              } else if (_.has(doc.o, "drop")) {
                trigger.collection = doc.o.drop;
                trigger.dropCollection = true;
                trigger.id = null;
              } else if ("create" in doc.o && "idIndex" in doc.o) {
                // A collection got implicitly created within a transaction. There's
                // no need to do anything about it.
              } else {
                throw Error("Unknown command " + EJSON.stringify(doc));
              }
            } else {
              // All other ops have an id.
              trigger.id = idForOp(doc);
            }
            await self._crossbar.fire(trigger);
          }
          try {
            while (!self._stopped && !self._entryQueue.isEmpty()) {
              // Are we too far behind? Just tell our observers that they need to
              // repoll, and drop our queue.
              if (self._entryQueue.length > TOO_FAR_BEHIND) {
                var lastEntry = self._entryQueue.pop();
                self._entryQueue.clear();
                self._onSkippedEntriesHook.each(function (callback) {
                  callback();
                  return true;
                });

                // Free any waitUntilCaughtUp() calls that were waiting for us to
                // pass something that we just skipped.
                self._setLastProcessedTS(lastEntry.ts);
                continue;
              }
              const doc = self._entryQueue.shift();

              // Fire trigger(s) for this doc.
              await handleDoc(doc);

              // Now that we've processed this operation, process pending
              // sequencers.
              if (doc.ts) {
                self._setLastProcessedTS(doc.ts);
              } else {
                throw Error("oplog entry without ts: " + EJSON.stringify(doc));
              }
            }
          } finally {
            self._workerActive = false;
          }
        });
      },
      _setLastProcessedTS: function (ts) {
        var self = this;
        self._lastProcessedTS = ts;
        while (!_.isEmpty(self._catchingUpResolvers) && self._catchingUpResolvers[0].ts.lessThanOrEqual(self._lastProcessedTS)) {
          var sequencer = self._catchingUpResolvers.shift();
          sequencer.resolver();
        }
      },
      //Methods used on tests to dinamically change TOO_FAR_BEHIND
      _defineTooFarBehind: function (value) {
        TOO_FAR_BEHIND = value;
      },
      _resetTooFarBehind: function () {
        TOO_FAR_BEHIND = process.env.METEOR_OPLOG_TOO_FAR_BEHIND || 2000;
      }
    });
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

},"observe_multiplex.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/observe_multiplex.js                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const _excluded = ["_id"];
    let nextObserveHandleId = 1;
    ObserveMultiplexer = class {
      constructor() {
        let {
          ordered,
          onStop = () => {}
        } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        if (ordered === undefined) throw Error("must specify ordered");
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", 1);
        this._ordered = ordered;
        this._onStop = onStop;
        this._queue = new Meteor._AsynchronousQueue();
        this._handles = {};
        this._resolver = null;
        this._readyPromise = new Promise(r => this._resolver = r).then(() => this._isReady = true);
        this._cache = new LocalCollection._CachingChangeObserver({
          ordered
        });
        // Number of addHandleAndSendInitialAdds tasks scheduled but not yet
        // running. removeHandle uses this to know if it's time to call the onStop
        // callback.
        this._addHandleTasksScheduledButNotPerformed = 0;
        const self = this;
        this.callbackNames().forEach(callbackName => {
          this[callbackName] = function /* ... */
          () {
            self._applyCallback(callbackName, _.toArray(arguments));
          };
        });
      }
      addHandleAndSendInitialAdds(handle) {
        return this._addHandleAndSendInitialAdds(handle);
      }
      async _addHandleAndSendInitialAdds(handle) {
        ++this._addHandleTasksScheduledButNotPerformed;
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-handles", 1);
        const self = this;
        await this._queue.runTask(async function () {
          self._handles[handle._id] = handle;
          // Send out whatever adds we have so far (whether the
          // multiplexer is ready).
          await self._sendAdds(handle);
          --self._addHandleTasksScheduledButNotPerformed;
        });
        await this._readyPromise;
      }

      // Remove an observe handle. If it was the last observe handle, call the
      // onStop callback; you cannot add any more observe handles after this.
      //
      // This is not synchronized with polls and handle additions: this means that
      // you can safely call it from within an observe callback, but it also means
      // that we have to be careful when we iterate over _handles.
      async removeHandle(id) {
        // This should not be possible: you can only call removeHandle by having
        // access to the ObserveHandle, which isn't returned to user code until the
        // multiplex is ready.
        if (!this._ready()) throw new Error("Can't remove handles until the multiplex is ready");
        delete this._handles[id];
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-handles", -1);
        if (_.isEmpty(this._handles) && this._addHandleTasksScheduledButNotPerformed === 0) {
          await this._stop();
        }
      }
      async _stop(options) {
        options = options || {};

        // It shouldn't be possible for us to stop when all our handles still
        // haven't been returned from observeChanges!
        if (!this._ready() && !options.fromQueryError) throw Error("surprising _stop: not ready");

        // Call stop callback (which kills the underlying process which sends us
        // callbacks and removes us from the connection's dictionary).
        await this._onStop();
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", -1);

        // Cause future addHandleAndSendInitialAdds calls to throw (but the onStop
        // callback should make our connection forget about us).
        this._handles = null;
      }

      // Allows all addHandleAndSendInitialAdds calls to return, once all preceding
      // adds have been processed. Does not block.
      async ready() {
        const self = this;
        this._queue.queueTask(function () {
          if (self._ready()) throw Error("can't make ObserveMultiplex ready twice!");
          if (!self._resolver) {
            throw new Error("Missing resolver");
          }
          self._resolver();
          self._isReady = true;
        });
      }

      // If trying to execute the query results in an error, call this. This is
      // intended for permanent errors, not transient network errors that could be
      // fixed. It should only be called before ready(), because if you called ready
      // that meant that you managed to run the query once. It will stop this
      // ObserveMultiplex and cause addHandleAndSendInitialAdds calls (and thus
      // observeChanges calls) to throw the error.
      async queryError(err) {
        var self = this;
        await this._queue.runTask(function () {
          if (self._ready()) throw Error("can't claim query has an error after it worked!");
          self._stop({
            fromQueryError: true
          });
          throw err;
        });
      }

      // Calls "cb" once the effects of all "ready", "addHandleAndSendInitialAdds"
      // and observe callbacks which came before this call have been propagated to
      // all handles. "ready" must have already been called on this multiplexer.
      async onFlush(cb) {
        var self = this;
        await this._queue.queueTask(async function () {
          if (!self._ready()) throw Error("only call onFlush on a multiplexer that will be ready");
          await cb();
        });
      }
      callbackNames() {
        if (this._ordered) return ["addedBefore", "changed", "movedBefore", "removed"];else return ["added", "changed", "removed"];
      }
      _ready() {
        return !!this._isReady;
      }
      _applyCallback(callbackName, args) {
        const self = this;
        this._queue.queueTask(async function () {
          // If we stopped in the meantime, do nothing.
          if (!self._handles) return;

          // First, apply the change to the cache.
          await self._cache.applyChange[callbackName].apply(null, args);
          // If we haven't finished the initial adds, then we should only be getting
          // adds.
          if (!self._ready() && callbackName !== 'added' && callbackName !== 'addedBefore') {
            throw new Error("Got " + callbackName + " during initial adds");
          }

          // Now multiplex the callbacks out to all observe handles. It's OK if
          // these calls yield; since we're inside a task, no other use of our queue
          // can continue until these are done. (But we do have to be careful to not
          // use a handle that got removed, because removeHandle does not use the
          // queue; thus, we iterate over an array of keys that we control.)
          for (const handleId of Object.keys(self._handles)) {
            var handle = self._handles && self._handles[handleId];
            if (!handle) return;
            var callback = handle['_' + callbackName];
            // clone arguments so that callbacks can mutate their arguments

            callback && (await callback.apply(null, handle.nonMutatingCallbacks ? args : EJSON.clone(args)));
          }
        });
      }

      // Sends initial adds to a handle. It should only be called from within a task
      // (the task that is processing the addHandleAndSendInitialAdds call). It
      // synchronously invokes the handle's added or addedBefore; there's no need to
      // flush the queue afterwards to ensure that the callbacks get out.
      async _sendAdds(handle) {
        var add = this._ordered ? handle._addedBefore : handle._added;
        if (!add) return;
        // note: docs may be an _IdMap or an OrderedDict
        await this._cache.docs.forEachAsync(async (doc, id) => {
          if (!_.has(this._handles, handle._id)) throw Error("handle got removed before sending initial adds!");
          const _ref = handle.nonMutatingCallbacks ? doc : EJSON.clone(doc),
            {
              _id
            } = _ref,
            fields = _objectWithoutProperties(_ref, _excluded);
          if (this._ordered) await add(id, fields, null); // we're going in order, so add at end
          else await add(id, fields);
        });
      }
    };

    // When the callbacks do not mutate the arguments, we can skip a lot of data clones
    ObserveHandle = class {
      constructor(multiplexer, callbacks) {
        let nonMutatingCallbacks = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
        this._multiplexer = multiplexer;
        multiplexer.callbackNames().forEach(name => {
          if (callbacks[name]) {
            this['_' + name] = callbacks[name];
          } else if (name === "addedBefore" && callbacks.added) {
            // Special case: if you specify "added" and "movedBefore", you get an
            // ordered observe where for some reason you don't get ordering data on
            // the adds.  I dunno, we wrote tests for it, there must have been a
            // reason.
            this._addedBefore = async function (id, fields, before) {
              await callbacks.added(id, fields);
            };
          }
        });
        this._stopped = false;
        this._id = nextObserveHandleId++;
        this.nonMutatingCallbacks = nonMutatingCallbacks;
      }
      async stop() {
        if (this._stopped) return;
        this._stopped = true;
        await this._multiplexer.removeHandle(this._id);
      }
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

},"doc_fetcher.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/doc_fetcher.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  DocFetcher: () => DocFetcher
});
class DocFetcher {
  constructor(mongoConnection) {
    this._mongoConnection = mongoConnection;
    // Map from op -> [callback]
    this._callbacksForOp = new Map();
  }

  // Fetches document "id" from collectionName, returning it or null if not
  // found.
  //
  // If you make multiple calls to fetch() with the same op reference,
  // DocFetcher may assume that they all return the same document. (It does
  // not check to see if collectionName/id match.)
  //
  // You may assume that callback is never called synchronously (and in fact
  // OplogObserveDriver does so).
  async fetch(collectionName, id, op, callback) {
    const self = this;
    check(collectionName, String);
    check(op, Object);

    // If there's already an in-progress fetch for this cache key, yield until
    // it's done and return whatever it returns.
    if (self._callbacksForOp.has(op)) {
      self._callbacksForOp.get(op).push(callback);
      return;
    }
    const callbacks = [callback];
    self._callbacksForOp.set(op, callbacks);
    try {
      var doc = (await self._mongoConnection.findOneAsync(collectionName, {
        _id: id
      })) || null;
      // Return doc to all relevant callbacks. Note that this array can
      // continue to grow during callback excecution.
      while (callbacks.length > 0) {
        // Clone the document so that the various calls to fetch don't return
        // objects that are intertwingled with each other. Clone before
        // popping the future, so that if clone throws, the error gets passed
        // to the next callback.
        callbacks.pop()(null, EJSON.clone(doc));
      }
    } catch (e) {
      while (callbacks.length > 0) {
        callbacks.pop()(e);
      }
    } finally {
      // XXX consider keeping the doc around for a period of time before
      // removing from the cache
      self._callbacksForOp.delete(op);
    }
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"polling_observe_driver.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/polling_observe_driver.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var POLLING_THROTTLE_MS = +process.env.METEOR_POLLING_THROTTLE_MS || 50;
var POLLING_INTERVAL_MS = +process.env.METEOR_POLLING_INTERVAL_MS || 10 * 1000;
PollingObserveDriver = function (options) {
  var self = this;
  self._cursorDescription = options.cursorDescription;
  self._mongoHandle = options.mongoHandle;
  self._ordered = options.ordered;
  self._multiplexer = options.multiplexer;
  self._stopCallbacks = [];
  self._stopped = false;
  self._cursor = self._mongoHandle._createSynchronousCursor(self._cursorDescription);

  // previous results snapshot.  on each poll cycle, diffs against
  // results drives the callbacks.
  self._results = null;

  // The number of _pollMongo calls that have been added to self._taskQueue but
  // have not started running. Used to make sure we never schedule more than one
  // _pollMongo (other than possibly the one that is currently running). It's
  // also used by _suspendPolling to pretend there's a poll scheduled. Usually,
  // it's either 0 (for "no polls scheduled other than maybe one currently
  // running") or 1 (for "a poll scheduled that isn't running yet"), but it can
  // also be 2 if incremented by _suspendPolling.
  self._pollsScheduledButNotStarted = 0;
  self._pendingWrites = []; // people to notify when polling completes

  // Make sure to create a separately throttled function for each
  // PollingObserveDriver object.
  self._ensurePollIsScheduled = _.throttle(self._unthrottledEnsurePollIsScheduled, self._cursorDescription.options.pollingThrottleMs || POLLING_THROTTLE_MS /* ms */);

  // XXX figure out if we still need a queue
  self._taskQueue = new Meteor._AsynchronousQueue();
  var listenersHandle = listenAll(self._cursorDescription, function (notification) {
    // When someone does a transaction that might affect us, schedule a poll
    // of the database. If that transaction happens inside of a write fence,
    // block the fence until we've polled and notified observers.
    var fence = DDPServer._getCurrentFence();
    if (fence) self._pendingWrites.push(fence.beginWrite());
    // Ensure a poll is scheduled... but if we already know that one is,
    // don't hit the throttled _ensurePollIsScheduled function (which might
    // lead to us calling it unnecessarily in <pollingThrottleMs> ms).
    if (self._pollsScheduledButNotStarted === 0) self._ensurePollIsScheduled();
  });
  self._stopCallbacks.push(async function () {
    await listenersHandle.stop();
  });

  // every once and a while, poll even if we don't think we're dirty, for
  // eventual consistency with database writes from outside the Meteor
  // universe.
  //
  // For testing, there's an undocumented callback argument to observeChanges
  // which disables time-based polling and gets called at the beginning of each
  // poll.
  if (options._testOnlyPollCallback) {
    self._testOnlyPollCallback = options._testOnlyPollCallback;
  } else {
    var pollingInterval = self._cursorDescription.options.pollingIntervalMs || self._cursorDescription.options._pollingInterval ||
    // COMPAT with 1.2
    POLLING_INTERVAL_MS;
    var intervalHandle = Meteor.setInterval(_.bind(self._ensurePollIsScheduled, self), pollingInterval);
    self._stopCallbacks.push(function () {
      Meteor.clearInterval(intervalHandle);
    });
  }
};
_.extend(PollingObserveDriver.prototype, {
  _init: async function () {
    // Make sure we actually poll soon!
    await this._unthrottledEnsurePollIsScheduled();
    Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", 1);
  },
  // This is always called through _.throttle (except once at startup).
  _unthrottledEnsurePollIsScheduled: async function () {
    var self = this;
    if (self._pollsScheduledButNotStarted > 0) return;
    ++self._pollsScheduledButNotStarted;
    await self._taskQueue.runTask(async function () {
      await self._pollMongo();
    });
  },
  // test-only interface for controlling polling.
  //
  // _suspendPolling blocks until any currently running and scheduled polls are
  // done, and prevents any further polls from being scheduled. (new
  // ObserveHandles can be added and receive their initial added callbacks,
  // though.)
  //
  // _resumePolling immediately polls, and allows further polls to occur.
  _suspendPolling: function () {
    var self = this;
    // Pretend that there's another poll scheduled (which will prevent
    // _ensurePollIsScheduled from queueing any more polls).
    ++self._pollsScheduledButNotStarted;
    // Now block until all currently running or scheduled polls are done.
    self._taskQueue.runTask(function () {});

    // Confirm that there is only one "poll" (the fake one we're pretending to
    // have) scheduled.
    if (self._pollsScheduledButNotStarted !== 1) throw new Error("_pollsScheduledButNotStarted is " + self._pollsScheduledButNotStarted);
  },
  _resumePolling: async function () {
    var self = this;
    // We should be in the same state as in the end of _suspendPolling.
    if (self._pollsScheduledButNotStarted !== 1) throw new Error("_pollsScheduledButNotStarted is " + self._pollsScheduledButNotStarted);
    // Run a poll synchronously (which will counteract the
    // ++_pollsScheduledButNotStarted from _suspendPolling).
    await self._taskQueue.runTask(async function () {
      await self._pollMongo();
    });
  },
  async _pollMongo() {
    var self = this;
    --self._pollsScheduledButNotStarted;
    if (self._stopped) return;
    var first = false;
    var newResults;
    var oldResults = self._results;
    if (!oldResults) {
      first = true;
      // XXX maybe use OrderedDict instead?
      oldResults = self._ordered ? [] : new LocalCollection._IdMap();
    }
    self._testOnlyPollCallback && self._testOnlyPollCallback();

    // Save the list of pending writes which this round will commit.
    var writesForCycle = self._pendingWrites;
    self._pendingWrites = [];

    // Get the new query results. (This yields.)
    try {
      newResults = await self._cursor.getRawObjects(self._ordered);
    } catch (e) {
      if (first && typeof e.code === 'number') {
        // This is an error document sent to us by mongod, not a connection
        // error generated by the client. And we've never seen this query work
        // successfully. Probably it's a bad selector or something, so we should
        // NOT retry. Instead, we should halt the observe (which ends up calling
        // `stop` on us).
        await self._multiplexer.queryError(new Error("Exception while polling query " + JSON.stringify(self._cursorDescription) + ": " + e.message));
      }

      // getRawObjects can throw if we're having trouble talking to the
      // database.  That's fine --- we will repoll later anyway. But we should
      // make sure not to lose track of this cycle's writes.
      // (It also can throw if there's just something invalid about this query;
      // unfortunately the ObserveDriver API doesn't provide a good way to
      // "cancel" the observe from the inside in this case.
      Array.prototype.push.apply(self._pendingWrites, writesForCycle);
      Meteor._debug("Exception while polling query " + JSON.stringify(self._cursorDescription), e);
      return;
    }

    // Run diffs.
    if (!self._stopped) {
      LocalCollection._diffQueryChanges(self._ordered, oldResults, newResults, self._multiplexer);
    }

    // Signals the multiplexer to allow all observeChanges calls that share this
    // multiplexer to return. (This happens asynchronously, via the
    // multiplexer's queue.)
    if (first) self._multiplexer.ready();

    // Replace self._results atomically.  (This assignment is what makes `first`
    // stay through on the next cycle, so we've waited until after we've
    // committed to ready-ing the multiplexer.)
    self._results = newResults;

    // Once the ObserveMultiplexer has processed everything we've done in this
    // round, mark all the writes which existed before this call as
    // commmitted. (If new writes have shown up in the meantime, there'll
    // already be another _pollMongo task scheduled.)
    await self._multiplexer.onFlush(async function () {
      for (const w of writesForCycle) {
        await w.committed();
      }
    });
  },
  stop: function () {
    var self = this;
    self._stopped = true;
    const stopCallbacksCaller = async function (c) {
      await c();
    };
    _.each(self._stopCallbacks, stopCallbacksCaller);
    // Release any write fences that are waiting on us.
    _.each(self._pendingWrites, async function (w) {
      await w.committed();
    });
    Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", -1);
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"oplog_observe_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_observe_driver.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _asyncIterator;
    module.link("@babel/runtime/helpers/asyncIterator", {
      default(v) {
        _asyncIterator = v;
      }
    }, 0);
    let oplogV2V1Converter;
    module.link("./oplog_v2_converter", {
      oplogV2V1Converter(v) {
        oplogV2V1Converter = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    var PHASE = {
      QUERYING: "QUERYING",
      FETCHING: "FETCHING",
      STEADY: "STEADY"
    };

    // Exception thrown by _needToPollQuery which unrolls the stack up to the
    // enclosing call to finishIfNeedToPollQuery.
    var SwitchedToQuery = function () {};
    var finishIfNeedToPollQuery = function (f) {
      return function () {
        try {
          f.apply(this, arguments);
        } catch (e) {
          if (!(e instanceof SwitchedToQuery)) throw e;
        }
      };
    };
    var currentId = 0;

    // OplogObserveDriver is an alternative to PollingObserveDriver which follows
    // the Mongo operation log instead of just re-polling the query. It obeys the
    // same simple interface: constructing it starts sending observeChanges
    // callbacks (and a ready() invocation) to the ObserveMultiplexer, and you stop
    // it by calling the stop() method.
    OplogObserveDriver = function (options) {
      var self = this;
      self._usesOplog = true; // tests look at this

      self._id = currentId;
      currentId++;
      self._cursorDescription = options.cursorDescription;
      self._mongoHandle = options.mongoHandle;
      self._multiplexer = options.multiplexer;
      if (options.ordered) {
        throw Error("OplogObserveDriver only supports unordered observeChanges");
      }
      var sorter = options.sorter;
      // We don't support $near and other geo-queries so it's OK to initialize the
      // comparator only once in the constructor.
      var comparator = sorter && sorter.getComparator();
      if (options.cursorDescription.options.limit) {
        // There are several properties ordered driver implements:
        // - _limit is a positive number
        // - _comparator is a function-comparator by which the query is ordered
        // - _unpublishedBuffer is non-null Min/Max Heap,
        //                      the empty buffer in STEADY phase implies that the
        //                      everything that matches the queries selector fits
        //                      into published set.
        // - _published - Max Heap (also implements IdMap methods)

        var heapOptions = {
          IdMap: LocalCollection._IdMap
        };
        self._limit = self._cursorDescription.options.limit;
        self._comparator = comparator;
        self._sorter = sorter;
        self._unpublishedBuffer = new MinMaxHeap(comparator, heapOptions);
        // We need something that can find Max value in addition to IdMap interface
        self._published = new MaxHeap(comparator, heapOptions);
      } else {
        self._limit = 0;
        self._comparator = null;
        self._sorter = null;
        self._unpublishedBuffer = null;
        self._published = new LocalCollection._IdMap();
      }

      // Indicates if it is safe to insert a new document at the end of the buffer
      // for this query. i.e. it is known that there are no documents matching the
      // selector those are not in published or buffer.
      self._safeAppendToBuffer = false;
      self._stopped = false;
      self._stopHandles = [];
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", 1);
      self._registerPhaseChange(PHASE.QUERYING);
      self._matcher = options.matcher;
      // we are now using projection, not fields in the cursor description even if you pass {fields}
      // in the cursor construction
      var projection = self._cursorDescription.options.fields || self._cursorDescription.options.projection || {};
      self._projectionFn = LocalCollection._compileProjection(projection);
      // Projection function, result of combining important fields for selector and
      // existing fields projection
      self._sharedProjection = self._matcher.combineIntoProjection(projection);
      if (sorter) self._sharedProjection = sorter.combineIntoProjection(self._sharedProjection);
      self._sharedProjectionFn = LocalCollection._compileProjection(self._sharedProjection);
      self._needToFetch = new LocalCollection._IdMap();
      self._currentlyFetching = null;
      self._fetchGeneration = 0;
      self._requeryWhenDoneThisQuery = false;
      self._writesToCommitWhenWeReachSteady = [];

      // If the oplog handle tells us that it skipped some entries (because it got
      // behind, say), re-poll.
      self._stopHandles.push(self._mongoHandle._oplogHandle.onSkippedEntries(finishIfNeedToPollQuery(function () {
        return self._needToPollQuery();
      })));
      forEachTrigger(self._cursorDescription, function (trigger) {
        self._stopHandles.push(self._mongoHandle._oplogHandle.onOplogEntry(trigger, function (notification) {
          finishIfNeedToPollQuery(function () {
            var op = notification.op;
            if (notification.dropCollection || notification.dropDatabase) {
              // Note: this call is not allowed to block on anything (especially
              // on waiting for oplog entries to catch up) because that will block
              // onOplogEntry!
              return self._needToPollQuery();
            } else {
              // All other operators should be handled depending on phase
              if (self._phase === PHASE.QUERYING) {
                return self._handleOplogEntryQuerying(op);
              } else {
                return self._handleOplogEntrySteadyOrFetching(op);
              }
            }
          })();
        }));
      });

      // XXX ordering w.r.t. everything else?
      self._stopHandles.push(listenAll(self._cursorDescription, function () {
        // If we're not in a pre-fire write fence, we don't have to do anything.
        var fence = DDPServer._getCurrentFence();
        if (!fence || fence.fired) return;
        if (fence._oplogObserveDrivers) {
          fence._oplogObserveDrivers[self._id] = self;
          return;
        }
        fence._oplogObserveDrivers = {};
        fence._oplogObserveDrivers[self._id] = self;
        fence.onBeforeFire(async function () {
          var drivers = fence._oplogObserveDrivers;
          delete fence._oplogObserveDrivers;

          // This fence cannot fire until we've caught up to "this point" in the
          // oplog, and all observers made it back to the steady state.
          await self._mongoHandle._oplogHandle.waitUntilCaughtUp();
          for (const driver of Object.values(drivers)) {
            if (driver._stopped) continue;
            var write = await fence.beginWrite();
            if (driver._phase === PHASE.STEADY) {
              // Make sure that all of the callbacks have made it through the
              // multiplexer and been delivered to ObserveHandles before committing
              // writes.
              await driver._multiplexer.onFlush(write.committed);
            } else {
              driver._writesToCommitWhenWeReachSteady.push(write);
            }
          }
        });
      }));

      // When Mongo fails over, we need to repoll the query, in case we processed an
      // oplog entry that got rolled back.
      self._stopHandles.push(self._mongoHandle._onFailover(finishIfNeedToPollQuery(function () {
        return self._needToPollQuery();
      })));
    };
    _.extend(OplogObserveDriver.prototype, {
      _init: function () {
        const self = this;
        // Give _observeChanges a chance to add the new ObserveHandle to our
        // multiplexer, so that the added calls get streamed.
        return self._runInitialQuery();
      },
      _addPublished: function (id, doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var fields = _.clone(doc);
          delete fields._id;
          self._published.set(id, self._sharedProjectionFn(doc));
          self._multiplexer.added(id, self._projectionFn(fields));

          // After adding this document, the published set might be overflowed
          // (exceeding capacity specified by limit). If so, push the maximum
          // element to the buffer, we might want to save it in memory to reduce the
          // amount of Mongo lookups in the future.
          if (self._limit && self._published.size() > self._limit) {
            // XXX in theory the size of published is no more than limit+1
            if (self._published.size() !== self._limit + 1) {
              throw new Error("After adding to published, " + (self._published.size() - self._limit) + " documents are overflowing the set");
            }
            var overflowingDocId = self._published.maxElementId();
            var overflowingDoc = self._published.get(overflowingDocId);
            if (EJSON.equals(overflowingDocId, id)) {
              throw new Error("The document just added is overflowing the published set");
            }
            self._published.remove(overflowingDocId);
            self._multiplexer.removed(overflowingDocId);
            self._addBuffered(overflowingDocId, overflowingDoc);
          }
        });
      },
      _removePublished: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._published.remove(id);
          self._multiplexer.removed(id);
          if (!self._limit || self._published.size() === self._limit) return;
          if (self._published.size() > self._limit) throw Error("self._published got too big");

          // OK, we are publishing less than the limit. Maybe we should look in the
          // buffer to find the next element past what we were publishing before.

          if (!self._unpublishedBuffer.empty()) {
            // There's something in the buffer; move the first thing in it to
            // _published.
            var newDocId = self._unpublishedBuffer.minElementId();
            var newDoc = self._unpublishedBuffer.get(newDocId);
            self._removeBuffered(newDocId);
            self._addPublished(newDocId, newDoc);
            return;
          }

          // There's nothing in the buffer.  This could mean one of a few things.

          // (a) We could be in the middle of re-running the query (specifically, we
          // could be in _publishNewResults). In that case, _unpublishedBuffer is
          // empty because we clear it at the beginning of _publishNewResults. In
          // this case, our caller already knows the entire answer to the query and
          // we don't need to do anything fancy here.  Just return.
          if (self._phase === PHASE.QUERYING) return;

          // (b) We're pretty confident that the union of _published and
          // _unpublishedBuffer contain all documents that match selector. Because
          // _unpublishedBuffer is empty, that means we're confident that _published
          // contains all documents that match selector. So we have nothing to do.
          if (self._safeAppendToBuffer) return;

          // (c) Maybe there are other documents out there that should be in our
          // buffer. But in that case, when we emptied _unpublishedBuffer in
          // _removeBuffered, we should have called _needToPollQuery, which will
          // either put something in _unpublishedBuffer or set _safeAppendToBuffer
          // (or both), and it will put us in QUERYING for that whole time. So in
          // fact, we shouldn't be able to get here.

          throw new Error("Buffer inexplicably empty");
        });
      },
      _changePublished: function (id, oldDoc, newDoc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._published.set(id, self._sharedProjectionFn(newDoc));
          var projectedNew = self._projectionFn(newDoc);
          var projectedOld = self._projectionFn(oldDoc);
          var changed = DiffSequence.makeChangedFields(projectedNew, projectedOld);
          if (!_.isEmpty(changed)) self._multiplexer.changed(id, changed);
        });
      },
      _addBuffered: function (id, doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._unpublishedBuffer.set(id, self._sharedProjectionFn(doc));

          // If something is overflowing the buffer, we just remove it from cache
          if (self._unpublishedBuffer.size() > self._limit) {
            var maxBufferedId = self._unpublishedBuffer.maxElementId();
            self._unpublishedBuffer.remove(maxBufferedId);

            // Since something matching is removed from cache (both published set and
            // buffer), set flag to false
            self._safeAppendToBuffer = false;
          }
        });
      },
      // Is called either to remove the doc completely from matching set or to move
      // it to the published set later.
      _removeBuffered: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._unpublishedBuffer.remove(id);
          // To keep the contract "buffer is never empty in STEADY phase unless the
          // everything matching fits into published" true, we poll everything as
          // soon as we see the buffer becoming empty.
          if (!self._unpublishedBuffer.size() && !self._safeAppendToBuffer) self._needToPollQuery();
        });
      },
      // Called when a document has joined the "Matching" results set.
      // Takes responsibility of keeping _unpublishedBuffer in sync with _published
      // and the effect of limit enforced.
      _addMatching: function (doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var id = doc._id;
          if (self._published.has(id)) throw Error("tried to add something already published " + id);
          if (self._limit && self._unpublishedBuffer.has(id)) throw Error("tried to add something already existed in buffer " + id);
          var limit = self._limit;
          var comparator = self._comparator;
          var maxPublished = limit && self._published.size() > 0 ? self._published.get(self._published.maxElementId()) : null;
          var maxBuffered = limit && self._unpublishedBuffer.size() > 0 ? self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId()) : null;
          // The query is unlimited or didn't publish enough documents yet or the
          // new document would fit into published set pushing the maximum element
          // out, then we need to publish the doc.
          var toPublish = !limit || self._published.size() < limit || comparator(doc, maxPublished) < 0;

          // Otherwise we might need to buffer it (only in case of limited query).
          // Buffering is allowed if the buffer is not filled up yet and all
          // matching docs are either in the published set or in the buffer.
          var canAppendToBuffer = !toPublish && self._safeAppendToBuffer && self._unpublishedBuffer.size() < limit;

          // Or if it is small enough to be safely inserted to the middle or the
          // beginning of the buffer.
          var canInsertIntoBuffer = !toPublish && maxBuffered && comparator(doc, maxBuffered) <= 0;
          var toBuffer = canAppendToBuffer || canInsertIntoBuffer;
          if (toPublish) {
            self._addPublished(id, doc);
          } else if (toBuffer) {
            self._addBuffered(id, doc);
          } else {
            // dropping it and not saving to the cache
            self._safeAppendToBuffer = false;
          }
        });
      },
      // Called when a document leaves the "Matching" results set.
      // Takes responsibility of keeping _unpublishedBuffer in sync with _published
      // and the effect of limit enforced.
      _removeMatching: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (!self._published.has(id) && !self._limit) throw Error("tried to remove something matching but not cached " + id);
          if (self._published.has(id)) {
            self._removePublished(id);
          } else if (self._unpublishedBuffer.has(id)) {
            self._removeBuffered(id);
          }
        });
      },
      _handleDoc: function (id, newDoc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var matchesNow = newDoc && self._matcher.documentMatches(newDoc).result;
          var publishedBefore = self._published.has(id);
          var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);
          var cachedBefore = publishedBefore || bufferedBefore;
          if (matchesNow && !cachedBefore) {
            self._addMatching(newDoc);
          } else if (cachedBefore && !matchesNow) {
            self._removeMatching(id);
          } else if (cachedBefore && matchesNow) {
            var oldDoc = self._published.get(id);
            var comparator = self._comparator;
            var minBuffered = self._limit && self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.minElementId());
            var maxBuffered;
            if (publishedBefore) {
              // Unlimited case where the document stays in published once it
              // matches or the case when we don't have enough matching docs to
              // publish or the changed but matching doc will stay in published
              // anyways.
              //
              // XXX: We rely on the emptiness of buffer. Be sure to maintain the
              // fact that buffer can't be empty if there are matching documents not
              // published. Notably, we don't want to schedule repoll and continue
              // relying on this property.
              var staysInPublished = !self._limit || self._unpublishedBuffer.size() === 0 || comparator(newDoc, minBuffered) <= 0;
              if (staysInPublished) {
                self._changePublished(id, oldDoc, newDoc);
              } else {
                // after the change doc doesn't stay in the published, remove it
                self._removePublished(id);
                // but it can move into buffered now, check it
                maxBuffered = self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());
                var toBuffer = self._safeAppendToBuffer || maxBuffered && comparator(newDoc, maxBuffered) <= 0;
                if (toBuffer) {
                  self._addBuffered(id, newDoc);
                } else {
                  // Throw away from both published set and buffer
                  self._safeAppendToBuffer = false;
                }
              }
            } else if (bufferedBefore) {
              oldDoc = self._unpublishedBuffer.get(id);
              // remove the old version manually instead of using _removeBuffered so
              // we don't trigger the querying immediately.  if we end this block
              // with the buffer empty, we will need to trigger the query poll
              // manually too.
              self._unpublishedBuffer.remove(id);
              var maxPublished = self._published.get(self._published.maxElementId());
              maxBuffered = self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());

              // the buffered doc was updated, it could move to published
              var toPublish = comparator(newDoc, maxPublished) < 0;

              // or stays in buffer even after the change
              var staysInBuffer = !toPublish && self._safeAppendToBuffer || !toPublish && maxBuffered && comparator(newDoc, maxBuffered) <= 0;
              if (toPublish) {
                self._addPublished(id, newDoc);
              } else if (staysInBuffer) {
                // stays in buffer but changes
                self._unpublishedBuffer.set(id, newDoc);
              } else {
                // Throw away from both published set and buffer
                self._safeAppendToBuffer = false;
                // Normally this check would have been done in _removeBuffered but
                // we didn't use it, so we need to do it ourself now.
                if (!self._unpublishedBuffer.size()) {
                  self._needToPollQuery();
                }
              }
            } else {
              throw new Error("cachedBefore implies either of publishedBefore or bufferedBefore is true.");
            }
          }
        });
      },
      _fetchModifiedDocuments: function () {
        var self = this;
        self._registerPhaseChange(PHASE.FETCHING);
        // Defer, because nothing called from the oplog entry handler may yield,
        // but fetch() yields.
        Meteor.defer(finishIfNeedToPollQuery(async function () {
          while (!self._stopped && !self._needToFetch.empty()) {
            if (self._phase === PHASE.QUERYING) {
              // While fetching, we decided to go into QUERYING mode, and then we
              // saw another oplog entry, so _needToFetch is not empty. But we
              // shouldn't fetch these documents until AFTER the query is done.
              break;
            }

            // Being in steady phase here would be surprising.
            if (self._phase !== PHASE.FETCHING) throw new Error("phase in fetchModifiedDocuments: " + self._phase);
            self._currentlyFetching = self._needToFetch;
            var thisGeneration = ++self._fetchGeneration;
            self._needToFetch = new LocalCollection._IdMap();
            var waiting = 0;
            let promiseResolver = null;
            const awaitablePromise = new Promise(r => promiseResolver = r);
            // This loop is safe, because _currentlyFetching will not be updated
            // during this loop (in fact, it is never mutated).
            await self._currentlyFetching.forEachAsync(async function (op, id) {
              waiting++;
              await self._mongoHandle._docFetcher.fetch(self._cursorDescription.collectionName, id, op, finishIfNeedToPollQuery(function (err, doc) {
                if (err) {
                  Meteor._debug('Got exception while fetching documents', err);
                  // If we get an error from the fetcher (eg, trouble
                  // connecting to Mongo), let's just abandon the fetch phase
                  // altogether and fall back to polling. It's not like we're
                  // getting live updates anyway.
                  if (self._phase !== PHASE.QUERYING) {
                    self._needToPollQuery();
                  }
                  waiting--;
                  // Because fetch() never calls its callback synchronously,
                  // this is safe (ie, we won't call fut.return() before the
                  // forEach is done).
                  if (waiting === 0) promiseResolver();
                  return;
                }
                try {
                  if (!self._stopped && self._phase === PHASE.FETCHING && self._fetchGeneration === thisGeneration) {
                    // We re-check the generation in case we've had an explicit
                    // _pollQuery call (eg, in another fiber) which should
                    // effectively cancel this round of fetches.  (_pollQuery
                    // increments the generation.)

                    self._handleDoc(id, doc);
                  }
                } finally {
                  waiting--;
                  // Because fetch() never calls its callback synchronously,
                  // this is safe (ie, we won't call fut.return() before the
                  // forEach is done).
                  if (waiting === 0) promiseResolver();
                }
              }));
            });
            await awaitablePromise;
            // Exit now if we've had a _pollQuery call (here or in another fiber).
            if (self._phase === PHASE.QUERYING) return;
            self._currentlyFetching = null;
          }
          // We're done fetching, so we can be steady, unless we've had a
          // _pollQuery call (here or in another fiber).
          if (self._phase !== PHASE.QUERYING) await self._beSteady();
        }));
      },
      _beSteady: async function () {
        var self = this;
        self._registerPhaseChange(PHASE.STEADY);
        var writes = self._writesToCommitWhenWeReachSteady || [];
        self._writesToCommitWhenWeReachSteady = [];
        await self._multiplexer.onFlush(async function () {
          try {
            for (const w of writes) {
              await w.committed();
            }
          } catch (e) {
            console.error("_beSteady error", {
              writes
            }, e);
          }
        });
      },
      _handleOplogEntryQuerying: function (op) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._needToFetch.set(idForOp(op), op);
        });
      },
      _handleOplogEntrySteadyOrFetching: function (op) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var id = idForOp(op);
          // If we're already fetching this one, or about to, we can't optimize;
          // make sure that we fetch it again if necessary.

          if (self._phase === PHASE.FETCHING && (self._currentlyFetching && self._currentlyFetching.has(id) || self._needToFetch.has(id))) {
            self._needToFetch.set(id, op);
            return;
          }
          if (op.op === 'd') {
            if (self._published.has(id) || self._limit && self._unpublishedBuffer.has(id)) self._removeMatching(id);
          } else if (op.op === 'i') {
            if (self._published.has(id)) throw new Error("insert found for already-existing ID in published");
            if (self._unpublishedBuffer && self._unpublishedBuffer.has(id)) throw new Error("insert found for already-existing ID in buffer");

            // XXX what if selector yields?  for now it can't but later it could
            // have $where
            if (self._matcher.documentMatches(op.o).result) self._addMatching(op.o);
          } else if (op.op === 'u') {
            // we are mapping the new oplog format on mongo 5
            // to what we know better, $set
            op.o = oplogV2V1Converter(op.o);
            // Is this a modifier ($set/$unset, which may require us to poll the
            // database to figure out if the whole document matches the selector) or
            // a replacement (in which case we can just directly re-evaluate the
            // selector)?
            // oplog format has changed on mongodb 5, we have to support both now
            // diff is the format in Mongo 5+ (oplog v2)
            var isReplace = !_.has(op.o, '$set') && !_.has(op.o, 'diff') && !_.has(op.o, '$unset');
            // If this modifier modifies something inside an EJSON custom type (ie,
            // anything with EJSON$), then we can't try to use
            // LocalCollection._modify, since that just mutates the EJSON encoding,
            // not the actual object.
            var canDirectlyModifyDoc = !isReplace && modifierCanBeDirectlyApplied(op.o);
            var publishedBefore = self._published.has(id);
            var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);
            if (isReplace) {
              self._handleDoc(id, _.extend({
                _id: id
              }, op.o));
            } else if ((publishedBefore || bufferedBefore) && canDirectlyModifyDoc) {
              // Oh great, we actually know what the document is, so we can apply
              // this directly.
              var newDoc = self._published.has(id) ? self._published.get(id) : self._unpublishedBuffer.get(id);
              newDoc = EJSON.clone(newDoc);
              newDoc._id = id;
              try {
                LocalCollection._modify(newDoc, op.o);
              } catch (e) {
                if (e.name !== "MinimongoError") throw e;
                // We didn't understand the modifier.  Re-fetch.
                self._needToFetch.set(id, op);
                if (self._phase === PHASE.STEADY) {
                  self._fetchModifiedDocuments();
                }
                return;
              }
              self._handleDoc(id, self._sharedProjectionFn(newDoc));
            } else if (!canDirectlyModifyDoc || self._matcher.canBecomeTrueByModifier(op.o) || self._sorter && self._sorter.affectedByModifier(op.o)) {
              self._needToFetch.set(id, op);
              if (self._phase === PHASE.STEADY) self._fetchModifiedDocuments();
            }
          } else {
            throw Error("XXX SURPRISING OPERATION: " + op);
          }
        });
      },
      async _runInitialQueryAsync() {
        var self = this;
        if (self._stopped) throw new Error("oplog stopped surprisingly early");
        await self._runQuery({
          initial: true
        }); // yields

        if (self._stopped) return; // can happen on queryError

        // Allow observeChanges calls to return. (After this, it's possible for
        // stop() to be called.)
        await self._multiplexer.ready();
        await self._doneQuerying(); // yields
      },
      // Yields!
      _runInitialQuery: function () {
        return this._runInitialQueryAsync();
      },
      // In various circumstances, we may just want to stop processing the oplog and
      // re-run the initial query, just as if we were a PollingObserveDriver.
      //
      // This function may not block, because it is called from an oplog entry
      // handler.
      //
      // XXX We should call this when we detect that we've been in FETCHING for "too
      // long".
      //
      // XXX We should call this when we detect Mongo failover (since that might
      // mean that some of the oplog entries we have processed have been rolled
      // back). The Node Mongo driver is in the middle of a bunch of huge
      // refactorings, including the way that it notifies you when primary
      // changes. Will put off implementing this until driver 1.4 is out.
      _pollQuery: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (self._stopped) return;

          // Yay, we get to forget about all the things we thought we had to fetch.
          self._needToFetch = new LocalCollection._IdMap();
          self._currentlyFetching = null;
          ++self._fetchGeneration; // ignore any in-flight fetches
          self._registerPhaseChange(PHASE.QUERYING);

          // Defer so that we don't yield.  We don't need finishIfNeedToPollQuery
          // here because SwitchedToQuery is not thrown in QUERYING mode.
          Meteor.defer(async function () {
            await self._runQuery();
            await self._doneQuerying();
          });
        });
      },
      // Yields!
      async _runQueryAsync(options) {
        var self = this;
        options = options || {};
        var newResults, newBuffer;

        // This while loop is just to retry failures.
        while (true) {
          // If we've been stopped, we don't have to run anything any more.
          if (self._stopped) return;
          newResults = new LocalCollection._IdMap();
          newBuffer = new LocalCollection._IdMap();

          // Query 2x documents as the half excluded from the original query will go
          // into unpublished buffer to reduce additional Mongo lookups in cases
          // when documents are removed from the published set and need a
          // replacement.
          // XXX needs more thought on non-zero skip
          // XXX 2 is a "magic number" meaning there is an extra chunk of docs for
          // buffer if such is needed.
          var cursor = self._cursorForQuery({
            limit: self._limit * 2
          });
          try {
            await cursor.forEach(function (doc, i) {
              // yields
              if (!self._limit || i < self._limit) {
                newResults.set(doc._id, doc);
              } else {
                newBuffer.set(doc._id, doc);
              }
            });
            break;
          } catch (e) {
            if (options.initial && typeof e.code === 'number') {
              // This is an error document sent to us by mongod, not a connection
              // error generated by the client. And we've never seen this query work
              // successfully. Probably it's a bad selector or something, so we
              // should NOT retry. Instead, we should halt the observe (which ends
              // up calling `stop` on us).
              await self._multiplexer.queryError(e);
              return;
            }

            // During failover (eg) if we get an exception we should log and retry
            // instead of crashing.
            Meteor._debug("Got exception while polling query", e);
            await Meteor._sleepForMs(100);
          }
        }
        if (self._stopped) return;
        self._publishNewResults(newResults, newBuffer);
      },
      // Yields!
      _runQuery: function (options) {
        return this._runQueryAsync(options);
      },
      // Transitions to QUERYING and runs another query, or (if already in QUERYING)
      // ensures that we will query again later.
      //
      // This function may not block, because it is called from an oplog entry
      // handler. However, if we were not already in the QUERYING phase, it throws
      // an exception that is caught by the closest surrounding
      // finishIfNeedToPollQuery call; this ensures that we don't continue running
      // close that was designed for another phase inside PHASE.QUERYING.
      //
      // (It's also necessary whenever logic in this file yields to check that other
      // phases haven't put us into QUERYING mode, though; eg,
      // _fetchModifiedDocuments does this.)
      _needToPollQuery: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (self._stopped) return;

          // If we're not already in the middle of a query, we can query now
          // (possibly pausing FETCHING).
          if (self._phase !== PHASE.QUERYING) {
            self._pollQuery();
            throw new SwitchedToQuery();
          }

          // We're currently in QUERYING. Set a flag to ensure that we run another
          // query when we're done.
          self._requeryWhenDoneThisQuery = true;
        });
      },
      // Yields!
      _doneQuerying: async function () {
        var self = this;
        if (self._stopped) return;
        await self._mongoHandle._oplogHandle.waitUntilCaughtUp();
        if (self._stopped) return;
        if (self._phase !== PHASE.QUERYING) throw Error("Phase unexpectedly " + self._phase);
        if (self._requeryWhenDoneThisQuery) {
          self._requeryWhenDoneThisQuery = false;
          self._pollQuery();
        } else if (self._needToFetch.empty()) {
          await self._beSteady();
        } else {
          self._fetchModifiedDocuments();
        }
      },
      _cursorForQuery: function (optionsOverwrite) {
        var self = this;
        return Meteor._noYieldsAllowed(function () {
          // The query we run is almost the same as the cursor we are observing,
          // with a few changes. We need to read all the fields that are relevant to
          // the selector, not just the fields we are going to publish (that's the
          // "shared" projection). And we don't want to apply any transform in the
          // cursor, because observeChanges shouldn't use the transform.
          var options = _.clone(self._cursorDescription.options);

          // Allow the caller to modify the options. Useful to specify different
          // skip and limit values.
          _.extend(options, optionsOverwrite);
          options.fields = self._sharedProjection;
          delete options.transform;
          // We are NOT deep cloning fields or selector here, which should be OK.
          var description = new CursorDescription(self._cursorDescription.collectionName, self._cursorDescription.selector, options);
          return new Cursor(self._mongoHandle, description);
        });
      },
      // Replace self._published with newResults (both are IdMaps), invoking observe
      // callbacks on the multiplexer.
      // Replace self._unpublishedBuffer with newBuffer.
      //
      // XXX This is very similar to LocalCollection._diffQueryUnorderedChanges. We
      // should really: (a) Unify IdMap and OrderedDict into Unordered/OrderedDict
      // (b) Rewrite diff.js to use these classes instead of arrays and objects.
      _publishNewResults: function (newResults, newBuffer) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          // If the query is limited and there is a buffer, shut down so it doesn't
          // stay in a way.
          if (self._limit) {
            self._unpublishedBuffer.clear();
          }

          // First remove anything that's gone. Be careful not to modify
          // self._published while iterating over it.
          var idsToRemove = [];
          self._published.forEach(function (doc, id) {
            if (!newResults.has(id)) idsToRemove.push(id);
          });
          _.each(idsToRemove, function (id) {
            self._removePublished(id);
          });

          // Now do adds and changes.
          // If self has a buffer and limit, the new fetched result will be
          // limited correctly as the query has sort specifier.
          newResults.forEach(function (doc, id) {
            self._handleDoc(id, doc);
          });

          // Sanity-check that everything we tried to put into _published ended up
          // there.
          // XXX if this is slow, remove it later
          if (self._published.size() !== newResults.size()) {
            Meteor._debug('The Mongo server and the Meteor query disagree on how ' + 'many documents match your query. Cursor description: ', self._cursorDescription);
          }
          self._published.forEach(function (doc, id) {
            if (!newResults.has(id)) throw Error("_published has a doc that newResults doesn't; " + id);
          });

          // Finally, replace the buffer
          newBuffer.forEach(function (doc, id) {
            self._addBuffered(id, doc);
          });
          self._safeAppendToBuffer = newBuffer.size() < self._limit;
        });
      },
      // This stop function is invoked from the onStop of the ObserveMultiplexer, so
      // it shouldn't actually be possible to call it until the multiplexer is
      // ready.
      //
      // It's important to check self._stopped after every call in this file that
      // can yield!
      _stop: async function () {
        var self = this;
        if (self._stopped) return;
        self._stopped = true;

        // Note: we *don't* use multiplexer.onFlush here because this stop
        // callback is actually invoked by the multiplexer itself when it has
        // determined that there are no handles left. So nothing is actually going
        // to get flushed (and it's probably not valid to call methods on the
        // dying multiplexer).
        for (const w of self._writesToCommitWhenWeReachSteady) {
          await w.committed();
        }
        self._writesToCommitWhenWeReachSteady = null;

        // Proactively drop references to potentially big things.
        self._published = null;
        self._unpublishedBuffer = null;
        self._needToFetch = null;
        self._currentlyFetching = null;
        self._oplogEntryHandle = null;
        self._listenersHandle = null;
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", -1);
        var _iteratorAbruptCompletion = false;
        var _didIteratorError = false;
        var _iteratorError;
        try {
          for (var _iterator = _asyncIterator(self._stopHandles), _step; _iteratorAbruptCompletion = !(_step = await _iterator.next()).done; _iteratorAbruptCompletion = false) {
            const handle = _step.value;
            {
              await handle.stop();
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (_iteratorAbruptCompletion && _iterator.return != null) {
              await _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      },
      stop: async function () {
        const self = this;
        return await self._stop();
      },
      _registerPhaseChange: function (phase) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var now = new Date();
          if (self._phase) {
            var timeDiff = now - self._phaseStartTime;
            Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "time-spent-in-" + self._phase + "-phase", timeDiff);
          }
          self._phase = phase;
          self._phaseStartTime = now;
        });
      }
    });

    // Does our oplog tailing code support this cursor? For now, we are being very
    // conservative and allowing only simple queries with simple options.
    // (This is a "static method".)
    OplogObserveDriver.cursorSupported = function (cursorDescription, matcher) {
      // First, check the options.
      var options = cursorDescription.options;

      // Did the user say no explicitly?
      // underscored version of the option is COMPAT with 1.2
      if (options.disableOplog || options._disableOplog) return false;

      // skip is not supported: to support it we would need to keep track of all
      // "skipped" documents or at least their ids.
      // limit w/o a sort specifier is not supported: current implementation needs a
      // deterministic way to order documents.
      if (options.skip || options.limit && !options.sort) return false;

      // If a fields projection option is given check if it is supported by
      // minimongo (some operators are not supported).
      const fields = options.fields || options.projection;
      if (fields) {
        try {
          LocalCollection._checkSupportedProjection(fields);
        } catch (e) {
          if (e.name === "MinimongoError") {
            return false;
          } else {
            throw e;
          }
        }
      }

      // We don't allow the following selectors:
      //   - $where (not confident that we provide the same JS environment
      //             as Mongo, and can yield!)
      //   - $near (has "interesting" properties in MongoDB, like the possibility
      //            of returning an ID multiple times, though even polling maybe
      //            have a bug there)
      //           XXX: once we support it, we would need to think more on how we
      //           initialize the comparators when we create the driver.
      return !matcher.hasWhere() && !matcher.hasGeoQuery();
    };
    var modifierCanBeDirectlyApplied = function (modifier) {
      return _.all(modifier, function (fields, operation) {
        return _.all(fields, function (value, field) {
          return !/EJSON\$/.test(field);
        });
      });
    };
    MongoInternals.OplogObserveDriver = OplogObserveDriver;
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

},"oplog_v2_converter.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_v2_converter.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  oplogV2V1Converter: () => oplogV2V1Converter
});
// Converter of the new MongoDB Oplog format (>=5.0) to the one that Meteor
// handles well, i.e., `$set` and `$unset`. The new format is completely new,
// and looks as follows:
//
//   { $v: 2, diff: Diff }
//
// where `Diff` is a recursive structure:
//
//   {
//     // Nested updates (sometimes also represented with an s-field).
//     // Example: `{ $set: { 'foo.bar': 1 } }`.
//     i: { <key>: <value>, ... },
//
//     // Top-level updates.
//     // Example: `{ $set: { foo: { bar: 1 } } }`.
//     u: { <key>: <value>, ... },
//
//     // Unsets.
//     // Example: `{ $unset: { foo: '' } }`.
//     d: { <key>: false, ... },
//
//     // Array operations.
//     // Example: `{ $push: { foo: 'bar' } }`.
//     s<key>: { a: true, u<index>: <value>, ... },
//     ...
//
//     // Nested operations (sometimes also represented in the `i` field).
//     // Example: `{ $set: { 'foo.bar': 1 } }`.
//     s<key>: Diff,
//     ...
//   }
//
// (all fields are optional).

function join(prefix, key) {
  return prefix ? "".concat(prefix, ".").concat(key) : key;
}
const arrayOperatorKeyRegex = /^(a|[su]\d+)$/;
function isArrayOperatorKey(field) {
  return arrayOperatorKeyRegex.test(field);
}
function isArrayOperator(operator) {
  return operator.a === true && Object.keys(operator).every(isArrayOperatorKey);
}
function flattenObjectInto(target, source, prefix) {
  if (Array.isArray(source) || typeof source !== 'object' || source === null || source instanceof Mongo.ObjectID) {
    target[prefix] = source;
  } else {
    const entries = Object.entries(source);
    if (entries.length) {
      entries.forEach(_ref => {
        let [key, value] = _ref;
        flattenObjectInto(target, value, join(prefix, key));
      });
    } else {
      target[prefix] = source;
    }
  }
}
const logDebugMessages = !!process.env.OPLOG_CONVERTER_DEBUG;
function convertOplogDiff(oplogEntry, diff, prefix) {
  if (logDebugMessages) {
    console.log("convertOplogDiff(".concat(JSON.stringify(oplogEntry), ", ").concat(JSON.stringify(diff), ", ").concat(JSON.stringify(prefix), ")"));
  }
  Object.entries(diff).forEach(_ref2 => {
    let [diffKey, value] = _ref2;
    if (diffKey === 'd') {
      var _oplogEntry$$unset;
      // Handle `$unset`s.
      (_oplogEntry$$unset = oplogEntry.$unset) !== null && _oplogEntry$$unset !== void 0 ? _oplogEntry$$unset : oplogEntry.$unset = {};
      Object.keys(value).forEach(key => {
        oplogEntry.$unset[join(prefix, key)] = true;
      });
    } else if (diffKey === 'i') {
      var _oplogEntry$$set;
      // Handle (potentially) nested `$set`s.
      (_oplogEntry$$set = oplogEntry.$set) !== null && _oplogEntry$$set !== void 0 ? _oplogEntry$$set : oplogEntry.$set = {};
      flattenObjectInto(oplogEntry.$set, value, prefix);
    } else if (diffKey === 'u') {
      var _oplogEntry$$set2;
      // Handle flat `$set`s.
      (_oplogEntry$$set2 = oplogEntry.$set) !== null && _oplogEntry$$set2 !== void 0 ? _oplogEntry$$set2 : oplogEntry.$set = {};
      Object.entries(value).forEach(_ref3 => {
        let [key, value] = _ref3;
        oplogEntry.$set[join(prefix, key)] = value;
      });
    } else {
      // Handle s-fields.
      const key = diffKey.slice(1);
      if (isArrayOperator(value)) {
        // Array operator.
        Object.entries(value).forEach(_ref4 => {
          let [position, value] = _ref4;
          if (position === 'a') {
            return;
          }
          const positionKey = join(join(prefix, key), position.slice(1));
          if (position[0] === 's') {
            convertOplogDiff(oplogEntry, value, positionKey);
          } else if (value === null) {
            var _oplogEntry$$unset2;
            (_oplogEntry$$unset2 = oplogEntry.$unset) !== null && _oplogEntry$$unset2 !== void 0 ? _oplogEntry$$unset2 : oplogEntry.$unset = {};
            oplogEntry.$unset[positionKey] = true;
          } else {
            var _oplogEntry$$set3;
            (_oplogEntry$$set3 = oplogEntry.$set) !== null && _oplogEntry$$set3 !== void 0 ? _oplogEntry$$set3 : oplogEntry.$set = {};
            oplogEntry.$set[positionKey] = value;
          }
        });
      } else if (key) {
        // Nested object.
        convertOplogDiff(oplogEntry, value, join(prefix, key));
      }
    }
  });
}
function oplogV2V1Converter(oplogEntry) {
  // Pass-through v1 and (probably) invalid entries.
  if (oplogEntry.$v !== 2 || !oplogEntry.diff) {
    return oplogEntry;
  }
  const convertedOplogEntry = {
    $v: 2
  };
  convertOplogDiff(convertedOplogEntry, oplogEntry.diff, '');
  return convertedOplogEntry;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"local_collection_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/local_collection_driver.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  LocalCollectionDriver: () => LocalCollectionDriver
});
const LocalCollectionDriver = new class LocalCollectionDriver {
  constructor() {
    this.noConnCollections = Object.create(null);
  }
  open(name, conn) {
    if (!name) {
      return new LocalCollection();
    }
    if (!conn) {
      return ensureCollection(name, this.noConnCollections);
    }
    if (!conn._mongo_livedata_collections) {
      conn._mongo_livedata_collections = Object.create(null);
    }

    // XXX is there a way to keep track of a connection's collections without
    // dangling it off the connection object?
    return ensureCollection(name, conn._mongo_livedata_collections);
  }
}();
function ensureCollection(name, collections) {
  return name in collections ? collections[name] : collections[name] = new LocalCollection(name);
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"remote_collection_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/remote_collection_driver.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let ASYNC_COLLECTION_METHODS, getAsyncMethodName, CLIENT_ONLY_METHODS;
    module.link("meteor/minimongo/constants", {
      ASYNC_COLLECTION_METHODS(v) {
        ASYNC_COLLECTION_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      },
      CLIENT_ONLY_METHODS(v) {
        CLIENT_ONLY_METHODS = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    MongoInternals.RemoteCollectionDriver = function (mongo_url, options) {
      var self = this;
      self.mongo = new MongoConnection(mongo_url, options);
    };
    const REMOTE_COLLECTION_METHODS = ['createCappedCollectionAsync', 'dropIndexAsync', 'ensureIndexAsync', 'createIndexAsync', 'countDocuments', 'dropCollectionAsync', 'estimatedDocumentCount', 'find', 'findOneAsync', 'insertAsync', 'rawCollection', 'removeAsync', 'updateAsync', 'upsertAsync'];
    Object.assign(MongoInternals.RemoteCollectionDriver.prototype, {
      open: function (name) {
        var self = this;
        var ret = {};
        REMOTE_COLLECTION_METHODS.forEach(function (m) {
          ret[m] = _.bind(self.mongo[m], self.mongo, name);
          if (!ASYNC_COLLECTION_METHODS.includes(m)) return;
          const asyncMethodName = getAsyncMethodName(m);
          ret[asyncMethodName] = function () {
            try {
              return Promise.resolve(ret[m](...arguments));
            } catch (error) {
              return Promise.reject(error);
            }
          };
        });
        CLIENT_ONLY_METHODS.forEach(function (m) {
          ret[m] = _.bind(self.mongo[m], self.mongo, name);
          ret[m] = function () {
            throw new Error("".concat(m, " +  is not available on the server. Please use ").concat(getAsyncMethodName(m), "() instead."));
          };
        });
        return ret;
      }
    });

    // Create the singleton RemoteCollectionDriver only on demand, so we
    // only require Mongo configuration if it's actually used (eg, not if
    // you're only trying to receive data from a remote DDP server.)
    MongoInternals.defaultRemoteCollectionDriver = _.once(function () {
      var connectionOptions = {};
      var mongoUrl = process.env.MONGO_URL;
      if (process.env.MONGO_OPLOG_URL) {
        connectionOptions.oplogUrl = process.env.MONGO_OPLOG_URL;
      }
      if (!mongoUrl) throw new Error("MONGO_URL must be set in environment");
      const driver = new MongoInternals.RemoteCollectionDriver(mongoUrl, connectionOptions);

      // As many deployment tools, including Meteor Up, send requests to the app in
      // order to confirm that the deployment finished successfully, it's required
      // to know about a database connection problem before the app starts. Doing so
      // in a `Meteor.startup` is fine, as the `WebApp` handles requests only after
      // all are finished.
      Meteor.startup(async () => {
        await driver.mongo.client.connect();
      });
      return driver;
    });
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

},"collection.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/collection.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    let ASYNC_COLLECTION_METHODS, getAsyncMethodName;
    module1.link("meteor/minimongo/constants", {
      ASYNC_COLLECTION_METHODS(v) {
        ASYNC_COLLECTION_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 0);
    let normalizeProjection;
    module1.link("./mongo_utils", {
      normalizeProjection(v) {
        normalizeProjection = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /**
     * @summary Namespace for MongoDB-related items
     * @namespace
     */
    Mongo = {};

    /**
     * @summary Constructor for a Collection
     * @locus Anywhere
     * @instancename collection
     * @class
     * @param {String} name The name of the collection.  If null, creates an unmanaged (unsynchronized) local collection.
     * @param {Object} [options]
     * @param {Object} options.connection The server connection that will manage this collection. Uses the default connection if not specified.  Pass the return value of calling [`DDP.connect`](#ddp_connect) to specify a different server. Pass `null` to specify no connection. Unmanaged (`name` is null) collections cannot specify a connection.
     * @param {String} options.idGeneration The method of generating the `_id` fields of new documents in this collection.  Possible values:
    
     - **`'STRING'`**: random strings
     - **`'MONGO'`**:  random [`Mongo.ObjectID`](#mongo_object_id) values
    
    The default id generation technique is `'STRING'`.
     * @param {Function} options.transform An optional transformation function. Documents will be passed through this function before being returned from `fetch` or `findOneAsync`, and before being passed to callbacks of `observe`, `map`, `forEach`, `allow`, and `deny`. Transforms are *not* applied for the callbacks of `observeChanges` or to cursors returned from publish functions.
     * @param {Boolean} options.defineMutationMethods Set to `false` to skip setting up the mutation methods that enable insert/update/remove from client code. Default `true`.
     */
    Mongo.Collection = function Collection(name, options) {
      if (!name && name !== null) {
        Meteor._debug('Warning: creating anonymous collection. It will not be ' + 'saved or synchronized over the network. (Pass null for ' + 'the collection name to turn off this warning.)');
        name = null;
      }
      if (name !== null && typeof name !== 'string') {
        throw new Error('First argument to new Mongo.Collection must be a string or null');
      }
      if (options && options.methods) {
        // Backwards compatibility hack with original signature (which passed
        // "connection" directly instead of in options. (Connections must have a "methods"
        // method.)
        // XXX remove before 1.0
        options = {
          connection: options
        };
      }
      // Backwards compatibility: "connection" used to be called "manager".
      if (options && options.manager && !options.connection) {
        options.connection = options.manager;
      }
      options = _objectSpread({
        connection: undefined,
        idGeneration: 'STRING',
        transform: null,
        _driver: undefined,
        _preventAutopublish: false
      }, options);
      switch (options.idGeneration) {
        case 'MONGO':
          this._makeNewID = function () {
            var src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;
            return new Mongo.ObjectID(src.hexString(24));
          };
          break;
        case 'STRING':
        default:
          this._makeNewID = function () {
            var src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;
            return src.id();
          };
          break;
      }
      this._transform = LocalCollection.wrapTransform(options.transform);
      this.resolverType = options.resolverType;
      if (!name || options.connection === null)
        // note: nameless collections never have a connection
        this._connection = null;else if (options.connection) this._connection = options.connection;else if (Meteor.isClient) this._connection = Meteor.connection;else this._connection = Meteor.server;
      if (!options._driver) {
        // XXX This check assumes that webapp is loaded so that Meteor.server !==
        // null. We should fully support the case of "want to use a Mongo-backed
        // collection from Node code without webapp", but we don't yet.
        // #MeteorServerNull
        if (name && this._connection === Meteor.server && typeof MongoInternals !== 'undefined' && MongoInternals.defaultRemoteCollectionDriver) {
          options._driver = MongoInternals.defaultRemoteCollectionDriver();
        } else {
          const {
            LocalCollectionDriver
          } = require('./local_collection_driver.js');
          options._driver = LocalCollectionDriver;
        }
      }
      this._collection = options._driver.open(name, this._connection);
      this._name = name;
      this._driver = options._driver;

      // TODO[fibers]: _maybeSetUpReplication is now async. Let's watch how not waiting for this function to finish
      // will affect everything
      this._settingUpReplicationPromise = this._maybeSetUpReplication(name, options);

      // XXX don't define these until allow or deny is actually used for this
      // collection. Could be hard if the security rules are only defined on the
      // server.
      if (options.defineMutationMethods !== false) {
        try {
          this._defineMutationMethods({
            useExisting: options._suppressSameNameError === true
          });
        } catch (error) {
          // Throw a more understandable error on the server for same collection name
          if (error.message === "A method named '/".concat(name, "/insertAsync' is already defined")) throw new Error("There is already a collection named \"".concat(name, "\""));
          throw error;
        }
      }

      // autopublish
      if (Package.autopublish && !options._preventAutopublish && this._connection && this._connection.publish) {
        this._connection.publish(null, () => this.find(), {
          is_auto: true
        });
      }
    };
    Object.assign(Mongo.Collection.prototype, {
      async _maybeSetUpReplication(name) {
        var _registerStoreResult, _registerStoreResult$;
        const self = this;
        if (!(self._connection && self._connection.registerStoreClient && self._connection.registerStoreServer)) {
          return;
        }
        const wrappedStoreCommon = {
          // Called around method stub invocations to capture the original versions
          // of modified documents.
          saveOriginals() {
            self._collection.saveOriginals();
          },
          retrieveOriginals() {
            return self._collection.retrieveOriginals();
          },
          // To be able to get back to the collection from the store.
          _getCollection() {
            return self;
          }
        };
        const wrappedStoreClient = _objectSpread({
          // Called at the beginning of a batch of updates. batchSize is the number
          // of update calls to expect.
          //
          // XXX This interface is pretty janky. reset probably ought to go back to
          // being its own function, and callers shouldn't have to calculate
          // batchSize. The optimization of not calling pause/remove should be
          // delayed until later: the first call to update() should buffer its
          // message, and then we can either directly apply it at endUpdate time if
          // it was the only update, or do pauseObservers/apply/apply at the next
          // update() if there's another one.
          async beginUpdate(batchSize, reset) {
            // pause observers so users don't see flicker when updating several
            // objects at once (including the post-reconnect reset-and-reapply
            // stage), and so that a re-sorting of a query can take advantage of the
            // full _diffQuery moved calculation instead of applying change one at a
            // time.
            if (batchSize > 1 || reset) self._collection.pauseObservers();
            if (reset) await self._collection.remove({});
          },
          // Apply an update.
          // XXX better specify this interface (not in terms of a wire message)?
          update(msg) {
            var mongoId = MongoID.idParse(msg.id);
            var doc = self._collection._docs.get(mongoId);

            //When the server's mergebox is disabled for a collection, the client must gracefully handle it when:
            // *We receive an added message for a document that is already there. Instead, it will be changed
            // *We reeive a change message for a document that is not there. Instead, it will be added
            // *We receive a removed messsage for a document that is not there. Instead, noting wil happen.

            //Code is derived from client-side code originally in peerlibrary:control-mergebox
            //https://github.com/peerlibrary/meteor-control-mergebox/blob/master/client.coffee

            //For more information, refer to discussion "Initial support for publication strategies in livedata server":
            //https://github.com/meteor/meteor/pull/11151
            if (Meteor.isClient) {
              if (msg.msg === 'added' && doc) {
                msg.msg = 'changed';
              } else if (msg.msg === 'removed' && !doc) {
                return;
              } else if (msg.msg === 'changed' && !doc) {
                msg.msg = 'added';
                const _ref = msg.fields;
                for (let field in _ref) {
                  const value = _ref[field];
                  if (value === void 0) {
                    delete msg.fields[field];
                  }
                }
              }
            }
            // Is this a "replace the whole doc" message coming from the quiescence
            // of method writes to an object? (Note that 'undefined' is a valid
            // value meaning "remove it".)
            if (msg.msg === 'replace') {
              var replace = msg.replace;
              if (!replace) {
                if (doc) self._collection.remove(mongoId);
              } else if (!doc) {
                self._collection.insert(replace);
              } else {
                // XXX check that replace has no $ ops
                self._collection.update(mongoId, replace);
              }
              return;
            } else if (msg.msg === 'added') {
              if (doc) {
                throw new Error('Expected not to find a document already present for an add');
              }
              self._collection.insert(_objectSpread({
                _id: mongoId
              }, msg.fields));
            } else if (msg.msg === 'removed') {
              if (!doc) throw new Error('Expected to find a document already present for removed');
              self._collection.remove(mongoId);
            } else if (msg.msg === 'changed') {
              if (!doc) throw new Error('Expected to find a document to change');
              const keys = Object.keys(msg.fields);
              if (keys.length > 0) {
                var modifier = {};
                keys.forEach(key => {
                  const value = msg.fields[key];
                  if (EJSON.equals(doc[key], value)) {
                    return;
                  }
                  if (typeof value === 'undefined') {
                    if (!modifier.$unset) {
                      modifier.$unset = {};
                    }
                    modifier.$unset[key] = 1;
                  } else {
                    if (!modifier.$set) {
                      modifier.$set = {};
                    }
                    modifier.$set[key] = value;
                  }
                });
                if (Object.keys(modifier).length > 0) {
                  self._collection.update(mongoId, modifier);
                }
              }
            } else {
              throw new Error("I don't know how to deal with this message");
            }
          },
          // Called at the end of a batch of updates.livedata_connection.js:1287
          endUpdate() {
            self._collection.resumeObserversClient();
          },
          // Used to preserve current versions of documents across a store reset.
          getDoc(id) {
            return self.findOne(id);
          }
        }, wrappedStoreCommon);
        const wrappedStoreServer = _objectSpread({
          async beginUpdate(batchSize, reset) {
            if (batchSize > 1 || reset) self._collection.pauseObservers();
            if (reset) await self._collection.removeAsync({});
          },
          async update(msg) {
            var mongoId = MongoID.idParse(msg.id);
            var doc = self._collection._docs.get(mongoId);

            // Is this a "replace the whole doc" message coming from the quiescence
            // of method writes to an object? (Note that 'undefined' is a valid
            // value meaning "remove it".)
            if (msg.msg === 'replace') {
              var replace = msg.replace;
              if (!replace) {
                if (doc) await self._collection.removeAsync(mongoId);
              } else if (!doc) {
                await self._collection.insertAsync(replace);
              } else {
                // XXX check that replace has no $ ops
                await self._collection.updateAsync(mongoId, replace);
              }
              return;
            } else if (msg.msg === 'added') {
              if (doc) {
                throw new Error('Expected not to find a document already present for an add');
              }
              await self._collection.insertAsync(_objectSpread({
                _id: mongoId
              }, msg.fields));
            } else if (msg.msg === 'removed') {
              if (!doc) throw new Error('Expected to find a document already present for removed');
              await self._collection.removeAsync(mongoId);
            } else if (msg.msg === 'changed') {
              if (!doc) throw new Error('Expected to find a document to change');
              const keys = Object.keys(msg.fields);
              if (keys.length > 0) {
                var modifier = {};
                keys.forEach(key => {
                  const value = msg.fields[key];
                  if (EJSON.equals(doc[key], value)) {
                    return;
                  }
                  if (typeof value === 'undefined') {
                    if (!modifier.$unset) {
                      modifier.$unset = {};
                    }
                    modifier.$unset[key] = 1;
                  } else {
                    if (!modifier.$set) {
                      modifier.$set = {};
                    }
                    modifier.$set[key] = value;
                  }
                });
                if (Object.keys(modifier).length > 0) {
                  await self._collection.updateAsync(mongoId, modifier);
                }
              }
            } else {
              throw new Error("I don't know how to deal with this message");
            }
          },
          // Called at the end of a batch of updates.
          async endUpdate() {
            await self._collection.resumeObserversServer();
          },
          // Used to preserve current versions of documents across a store reset.
          async getDoc(id) {
            return self.findOneAsync(id);
          }
        }, wrappedStoreCommon);

        // OK, we're going to be a slave, replicating some remote
        // database, except possibly with some temporary divergence while
        // we have unacknowledged RPC's.
        let registerStoreResult;
        if (Meteor.isClient) {
          registerStoreResult = self._connection.registerStoreClient(name, wrappedStoreClient);
        } else {
          registerStoreResult = self._connection.registerStoreServer(name, wrappedStoreServer);
        }
        const message = "There is already a collection named \"".concat(name, "\"");
        const logWarn = () => {
          console.warn ? console.warn(message) : console.log(message);
        };
        if (!registerStoreResult) {
          return logWarn();
        }
        return (_registerStoreResult = registerStoreResult) === null || _registerStoreResult === void 0 ? void 0 : (_registerStoreResult$ = _registerStoreResult.then) === null || _registerStoreResult$ === void 0 ? void 0 : _registerStoreResult$.call(_registerStoreResult, ok => {
          if (!ok) {
            logWarn();
          }
        });
      },
      ///
      /// Main collection API
      ///
      /**
       * @summary Gets the number of documents matching the filter. For a fast count of the total documents in a collection see `estimatedDocumentCount`.
       * @locus Anywhere
       * @method countDocuments
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to count
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://mongodb.github.io/node-mongodb-native/4.11/interfaces/CountDocumentsOptions.html). Please note that not all of them are available on the client.
       * @returns {Promise<number>}
       */
      countDocuments() {
        return this._collection.countDocuments(...arguments);
      },
      /**
       * @summary Gets an estimate of the count of documents in a collection using collection metadata. For an exact count of the documents in a collection see `countDocuments`.
       * @locus Anywhere
       * @method estimatedDocumentCount
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://mongodb.github.io/node-mongodb-native/4.11/interfaces/EstimatedDocumentCountOptions.html). Please note that not all of them are available on the client.
       * @returns {Promise<number>}
       */
      estimatedDocumentCount() {
        return this._collection.estimatedDocumentCount(...arguments);
      },
      _getFindSelector(args) {
        if (args.length == 0) return {};else return args[0];
      },
      _getFindOptions(args) {
        const [, options] = args || [];
        const newOptions = normalizeProjection(options);
        var self = this;
        if (args.length < 2) {
          return {
            transform: self._transform
          };
        } else {
          check(newOptions, Match.Optional(Match.ObjectIncluding({
            projection: Match.Optional(Match.OneOf(Object, undefined)),
            sort: Match.Optional(Match.OneOf(Object, Array, Function, undefined)),
            limit: Match.Optional(Match.OneOf(Number, undefined)),
            skip: Match.Optional(Match.OneOf(Number, undefined))
          })));
          return _objectSpread({
            transform: self._transform
          }, newOptions);
        }
      },
      /**
       * @summary Find the documents in a collection that match the selector.
       * @locus Anywhere
       * @method find
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to find
       * @param {Object} [options]
       * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
       * @param {Number} options.skip Number of results to skip at the beginning
       * @param {Number} options.limit Maximum number of results to return
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       * @param {Boolean} options.reactive (Client only) Default `true`; pass `false` to disable reactivity
       * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
       * @param {Boolean} options.disableOplog (Server only) Pass true to disable oplog-tailing on this query. This affects the way server processes calls to `observe` on this query. Disabling the oplog can be useful when working with data that updates in large batches.
       * @param {Number} options.pollingIntervalMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the frequency (in milliseconds) of how often to poll this query when observing on the server. Defaults to 10000ms (10 seconds).
       * @param {Number} options.pollingThrottleMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the minimum time (in milliseconds) to allow between re-polling when observing on the server. Increasing this will save CPU and mongo load at the expense of slower updates to users. Decreasing this is not recommended. Defaults to 50ms.
       * @param {Number} options.maxTimeMs (Server only) If set, instructs MongoDB to set a time limit for this cursor's operations. If the operation reaches the specified time limit (in milliseconds) without the having been completed, an exception will be thrown. Useful to prevent an (accidental or malicious) unoptimized query from causing a full collection scan that would disrupt other database users, at the expense of needing to handle the resulting error.
       * @param {String|Object} options.hint (Server only) Overrides MongoDB's default index selection and query optimization process. Specify an index to force its use, either by its name or index specification. You can also specify `{ $natural : 1 }` to force a forwards collection scan, or `{ $natural : -1 }` for a reverse collection scan. Setting this is only recommended for advanced users.
       * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for this particular cursor. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
       * @returns {Mongo.Cursor}
       */
      find() {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        // Collection.find() (return all docs) behaves differently
        // from Collection.find(undefined) (return 0 docs).  so be
        // careful about the length of arguments.
        return this._collection.find(this._getFindSelector(args), this._getFindOptions(args));
      },
      /**
       * @summary Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
       * @locus Anywhere
       * @method findOneAsync
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to find
       * @param {Object} [options]
       * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
       * @param {Number} options.skip Number of results to skip at the beginning
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity
       * @param {Function} options.transform Overrides `transform` on the [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
       * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for fetching the document. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
       * @returns {Object}
       */
      findOneAsync() {
        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }
        return this._collection.findOneAsync(this._getFindSelector(args), this._getFindOptions(args));
      },
      /**
       * @summary Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
       * @locus Anywhere
       * @method findOne
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to find
       * @param {Object} [options]
       * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
       * @param {Number} options.skip Number of results to skip at the beginning
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity
       * @param {Function} options.transform Overrides `transform` on the [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
       * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for fetching the document. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
       * @returns {Object}
       */
      findOne() {
        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }
        return this._collection.findOne(this._getFindSelector(args), this._getFindOptions(args));
      }
    });
    Object.assign(Mongo.Collection, {
      async _publishCursor(cursor, sub, collection) {
        var observeHandle = await cursor.observeChanges({
          added: function (id, fields) {
            sub.added(collection, id, fields);
          },
          changed: function (id, fields) {
            sub.changed(collection, id, fields);
          },
          removed: function (id) {
            sub.removed(collection, id);
          }
        },
        // Publications don't mutate the documents
        // This is tested by the `livedata - publish callbacks clone` test
        {
          nonMutatingCallbacks: true
        });

        // We don't call sub.ready() here: it gets called in livedata_server, after
        // possibly calling _publishCursor on multiple returned cursors.

        // register stop callback (expects lambda w/ no args).
        sub.onStop(async function () {
          return await observeHandle.stop();
        });

        // return the observeHandle in case it needs to be stopped early
        return observeHandle;
      },
      // protect against dangerous selectors.  falsey and {_id: falsey} are both
      // likely programmer error, and not what you want, particularly for destructive
      // operations. If a falsey _id is sent in, a new string _id will be
      // generated and returned; if a fallbackId is provided, it will be returned
      // instead.
      _rewriteSelector(selector) {
        let {
          fallbackId
        } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        // shorthand -- scalars match _id
        if (LocalCollection._selectorIsId(selector)) selector = {
          _id: selector
        };
        if (Array.isArray(selector)) {
          // This is consistent with the Mongo console itself; if we don't do this
          // check passing an empty array ends up selecting all items
          throw new Error("Mongo selector can't be an array.");
        }
        if (!selector || '_id' in selector && !selector._id) {
          // can't match anything
          return {
            _id: fallbackId || Random.id()
          };
        }
        return selector;
      }
    });
    Object.assign(Mongo.Collection.prototype, {
      // 'insert' immediately returns the inserted document's new _id.
      // The others return values immediately if you are in a stub, an in-memory
      // unmanaged collection, or a mongo-backed collection and you don't pass a
      // callback. 'update' and 'remove' return the number of affected
      // documents. 'upsert' returns an object with keys 'numberAffected' and, if an
      // insert happened, 'insertedId'.
      //
      // Otherwise, the semantics are exactly like other methods: they take
      // a callback as an optional last argument; if no callback is
      // provided, they block until the operation is complete, and throw an
      // exception if it fails; if a callback is provided, then they don't
      // necessarily block, and they call the callback when they finish with error and
      // result arguments.  (The insert method provides the document ID as its result;
      // update and remove provide the number of affected docs as the result; upsert
      // provides an object with numberAffected and maybe insertedId.)
      //
      // On the client, blocking is impossible, so if a callback
      // isn't provided, they just return immediately and any error
      // information is lost.
      //
      // There's one more tweak. On the client, if you don't provide a
      // callback, then if there is an error, a message will be logged with
      // Meteor._debug.
      //
      // The intent (though this is actually determined by the underlying
      // drivers) is that the operations should be done synchronously, not
      // generating their result until the database has acknowledged
      // them. In the future maybe we should provide a flag to turn this
      // off.

      _insert(doc, callback) {
        // Make sure we were passed a document to insert
        if (!doc) {
          throw new Error('insert requires an argument');
        }

        // Make a shallow clone of the document, preserving its prototype.
        doc = Object.create(Object.getPrototypeOf(doc), Object.getOwnPropertyDescriptors(doc));
        if ('_id' in doc) {
          if (!doc._id || !(typeof doc._id === 'string' || doc._id instanceof Mongo.ObjectID)) {
            throw new Error('Meteor requires document _id fields to be non-empty strings or ObjectIDs');
          }
        } else {
          let generateId = true;

          // Don't generate the id if we're the client and the 'outermost' call
          // This optimization saves us passing both the randomSeed and the id
          // Passing both is redundant.
          if (this._isRemoteCollection()) {
            const enclosing = DDP._CurrentMethodInvocation.get();
            if (!enclosing) {
              generateId = false;
            }
          }
          if (generateId) {
            doc._id = this._makeNewID();
          }
        }

        // On inserts, always return the id that we generated; on all other
        // operations, just return the result from the collection.
        var chooseReturnValueFromCollectionResult = function (result) {
          if (Meteor._isPromise(result)) return result;
          if (doc._id) {
            return doc._id;
          }

          // XXX what is this for??
          // It's some iteraction between the callback to _callMutatorMethod and
          // the return value conversion
          doc._id = result;
          return result;
        };
        const wrappedCallback = wrapCallback(callback, chooseReturnValueFromCollectionResult);
        if (this._isRemoteCollection()) {
          const result = this._callMutatorMethod('insert', [doc], wrappedCallback);
          return chooseReturnValueFromCollectionResult(result);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        try {
          // If the user provided a callback and the collection implements this
          // operation asynchronously, then queryRet will be undefined, and the
          // result will be returned through the callback instead.
          let result;
          if (!!wrappedCallback) {
            this._collection.insert(doc, wrappedCallback);
          } else {
            // If we don't have the callback, we assume the user is using the promise.
            // We can't just pass this._collection.insert to the promisify because it would lose the context.
            result = this._collection.insert(doc);
          }
          return chooseReturnValueFromCollectionResult(result);
        } catch (e) {
          if (callback) {
            callback(e);
            return null;
          }
          throw e;
        }
      },
      /**
       * @summary Insert a document in the collection.  Returns its unique _id.
       * @locus Anywhere
       * @method  insert
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the _id as the second.
       */
      insert(doc, callback) {
        return this._insert(doc, callback);
      },
      _insertAsync(doc) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        // Make sure we were passed a document to insert
        if (!doc) {
          throw new Error('insert requires an argument');
        }

        // Make a shallow clone of the document, preserving its prototype.
        doc = Object.create(Object.getPrototypeOf(doc), Object.getOwnPropertyDescriptors(doc));
        if ('_id' in doc) {
          if (!doc._id || !(typeof doc._id === 'string' || doc._id instanceof Mongo.ObjectID)) {
            throw new Error('Meteor requires document _id fields to be non-empty strings or ObjectIDs');
          }
        } else {
          let generateId = true;

          // Don't generate the id if we're the client and the 'outermost' call
          // This optimization saves us passing both the randomSeed and the id
          // Passing both is redundant.
          if (this._isRemoteCollection()) {
            const enclosing = DDP._CurrentMethodInvocation.get();
            if (!enclosing) {
              generateId = false;
            }
          }
          if (generateId) {
            doc._id = this._makeNewID();
          }
        }

        // On inserts, always return the id that we generated; on all other
        // operations, just return the result from the collection.
        var chooseReturnValueFromCollectionResult = function (result) {
          if (Meteor._isPromise(result)) return result;
          if (doc._id) {
            return doc._id;
          }

          // XXX what is this for??
          // It's some iteraction between the callback to _callMutatorMethod and
          // the return value conversion
          doc._id = result;
          return result;
        };
        if (this._isRemoteCollection()) {
          const promise = this._callMutatorMethodAsync('insertAsync', [doc], options);
          promise.then(chooseReturnValueFromCollectionResult);
          promise.stubPromise = promise.stubPromise.then(chooseReturnValueFromCollectionResult);
          promise.serverPromise = promise.serverPromise.then(chooseReturnValueFromCollectionResult);
          return promise;
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        return this._collection.insertAsync(doc).then(chooseReturnValueFromCollectionResult);
      },
      /**
       * @summary Insert a document in the collection.  Returns a promise that will return the document's unique _id when solved.
       * @locus Anywhere
       * @method  insert
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
       */
      insertAsync(doc, options) {
        return this._insertAsync(doc, options);
      },
      /**
       * @summary Modify one or more documents in the collection. Returns the number of matched documents.
       * @locus Anywhere
       * @method update
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
       * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
       */
      updateAsync(selector, modifier) {
        // We've already popped off the callback, so we are left with an array
        // of one or zero items
        const options = _objectSpread({}, (arguments.length <= 2 ? undefined : arguments[2]) || null);
        let insertedId;
        if (options && options.upsert) {
          // set `insertedId` if absent.  `insertedId` is a Meteor extension.
          if (options.insertedId) {
            if (!(typeof options.insertedId === 'string' || options.insertedId instanceof Mongo.ObjectID)) throw new Error('insertedId must be string or ObjectID');
            insertedId = options.insertedId;
          } else if (!selector || !selector._id) {
            insertedId = this._makeNewID();
            options.generatedId = true;
            options.insertedId = insertedId;
          }
        }
        selector = Mongo.Collection._rewriteSelector(selector, {
          fallbackId: insertedId
        });
        if (this._isRemoteCollection()) {
          const args = [selector, modifier, options];
          return this._callMutatorMethodAsync('updateAsync', args, options);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        // If the user provided a callback and the collection implements this
        // operation asynchronously, then queryRet will be undefined, and the
        // result will be returned through the callback instead.

        return this._collection.updateAsync(selector, modifier, options);
      },
      /**
       * @summary Asynchronously modifies one or more documents in the collection. Returns the number of matched documents.
       * @locus Anywhere
       * @method update
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
       * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
       */
      update(selector, modifier) {
        for (var _len4 = arguments.length, optionsAndCallback = new Array(_len4 > 2 ? _len4 - 2 : 0), _key4 = 2; _key4 < _len4; _key4++) {
          optionsAndCallback[_key4 - 2] = arguments[_key4];
        }
        const callback = popCallbackFromArgs(optionsAndCallback);

        // We've already popped off the callback, so we are left with an array
        // of one or zero items
        const options = _objectSpread({}, optionsAndCallback[0] || null);
        let insertedId;
        if (options && options.upsert) {
          // set `insertedId` if absent.  `insertedId` is a Meteor extension.
          if (options.insertedId) {
            if (!(typeof options.insertedId === 'string' || options.insertedId instanceof Mongo.ObjectID)) throw new Error('insertedId must be string or ObjectID');
            insertedId = options.insertedId;
          } else if (!selector || !selector._id) {
            insertedId = this._makeNewID();
            options.generatedId = true;
            options.insertedId = insertedId;
          }
        }
        selector = Mongo.Collection._rewriteSelector(selector, {
          fallbackId: insertedId
        });
        const wrappedCallback = wrapCallback(callback);
        if (this._isRemoteCollection()) {
          const args = [selector, modifier, options];
          return this._callMutatorMethod('update', args);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        // If the user provided a callback and the collection implements this
        // operation asynchronously, then queryRet will be undefined, and the
        // result will be returned through the callback instead.
        //console.log({callback, options, selector, modifier, coll: this._collection});
        try {
          // If the user provided a callback and the collection implements this
          // operation asynchronously, then queryRet will be undefined, and the
          // result will be returned through the callback instead.
          return this._collection.update(selector, modifier, options, wrappedCallback);
        } catch (e) {
          if (callback) {
            callback(e);
            return null;
          }
          throw e;
        }
      },
      /**
       * @summary Asynchronously removes documents from the collection.
       * @locus Anywhere
       * @method remove
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to remove
       */
      removeAsync(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        selector = Mongo.Collection._rewriteSelector(selector);
        if (this._isRemoteCollection()) {
          return this._callMutatorMethodAsync('removeAsync', [selector], options);
        }

        // it's my collection.  descend into the collection1 object
        // and propagate any exception.
        return this._collection.removeAsync(selector);
      },
      /**
       * @summary Remove documents from the collection
       * @locus Anywhere
       * @method remove
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to remove
       */
      remove(selector) {
        selector = Mongo.Collection._rewriteSelector(selector);
        if (this._isRemoteCollection()) {
          return this._callMutatorMethod('remove', [selector]);
        }

        // it's my collection.  descend into the collection1 object
        // and propagate any exception.
        return this._collection.remove(selector);
      },
      // Determine if this collection is simply a minimongo representation of a real
      // database on another server
      _isRemoteCollection() {
        // XXX see #MeteorServerNull
        return this._connection && this._connection !== Meteor.server;
      },
      /**
       * @summary Asynchronously modifies one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
       * @locus Anywhere
       * @method upsert
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       */
      async upsertAsync(selector, modifier, options) {
        return this.updateAsync(selector, modifier, _objectSpread(_objectSpread({}, options), {}, {
          _returnObject: true,
          upsert: true
        }));
      },
      /**
       * @summary Asynchronously modifies one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
       * @locus Anywhere
       * @method upsert
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
       */
      upsert(selector, modifier, options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        return this.update(selector, modifier, _objectSpread(_objectSpread({}, options), {}, {
          _returnObject: true,
          upsert: true
        }));
      },
      // We'll actually design an index API later. For now, we just pass through to
      // Mongo's, but make it synchronous.
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method ensureIndexAsync
       * @deprecated in 3.0
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      async ensureIndexAsync(index, options) {
        var self = this;
        if (!self._collection.ensureIndexAsync || !self._collection.createIndexAsync) throw new Error('Can only call createIndexAsync on server collections');
        if (self._collection.createIndexAsync) {
          await self._collection.createIndexAsync(index, options);
        } else {
          let Log;
          module1.link("meteor/logging", {
            Log(v) {
              Log = v;
            }
          }, 2);
          Log.debug("ensureIndexAsync has been deprecated, please use the new 'createIndexAsync' instead".concat(options !== null && options !== void 0 && options.name ? ", index name: ".concat(options.name) : ", index: ".concat(JSON.stringify(index))));
          await self._collection.ensureIndexAsync(index, options);
        }
      },
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method createIndexAsync
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      async createIndexAsync(index, options) {
        var self = this;
        if (!self._collection.createIndexAsync) throw new Error('Can only call createIndexAsync on server collections');
        try {
          await self._collection.createIndexAsync(index, options);
        } catch (e) {
          var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
          if (e.message.includes('An equivalent index already exists with the same name but different options.') && (_Meteor$settings = Meteor.settings) !== null && _Meteor$settings !== void 0 && (_Meteor$settings$pack = _Meteor$settings.packages) !== null && _Meteor$settings$pack !== void 0 && (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) !== null && _Meteor$settings$pack2 !== void 0 && _Meteor$settings$pack2.reCreateIndexOnOptionMismatch) {
            let Log;
            module1.link("meteor/logging", {
              Log(v) {
                Log = v;
              }
            }, 3);
            Log.info("Re-creating index ".concat(index, " for ").concat(self._name, " due to options mismatch."));
            await self._collection.dropIndexAsync(index);
            await self._collection.createIndexAsync(index, options);
          } else {
            console.error(e);
            throw new Meteor.Error("An error occurred when creating an index for collection \"".concat(self._name, ": ").concat(e.message));
          }
        }
      },
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method createIndex
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      createIndex(index, options) {
        return this.createIndexAsync(index, options);
      },
      async dropIndexAsync(index) {
        var self = this;
        if (!self._collection.dropIndexAsync) throw new Error('Can only call dropIndexAsync on server collections');
        await self._collection.dropIndexAsync(index);
      },
      async dropCollectionAsync() {
        var self = this;
        if (!self._collection.dropCollectionAsync) throw new Error('Can only call dropCollectionAsync on server collections');
        await self._collection.dropCollectionAsync();
      },
      async createCappedCollectionAsync(byteSize, maxDocuments) {
        var self = this;
        if (!(await self._collection.createCappedCollectionAsync)) throw new Error('Can only call createCappedCollectionAsync on server collections');
        await self._collection.createCappedCollectionAsync(byteSize, maxDocuments);
      },
      /**
       * @summary Returns the [`Collection`](http://mongodb.github.io/node-mongodb-native/3.0/api/Collection.html) object corresponding to this collection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
       * @locus Server
       * @memberof Mongo.Collection
       * @instance
       */
      rawCollection() {
        var self = this;
        if (!self._collection.rawCollection) {
          throw new Error('Can only call rawCollection on server collections');
        }
        return self._collection.rawCollection();
      },
      /**
       * @summary Returns the [`Db`](http://mongodb.github.io/node-mongodb-native/3.0/api/Db.html) object corresponding to this collection's database connection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
       * @locus Server
       * @memberof Mongo.Collection
       * @instance
       */
      rawDatabase() {
        var self = this;
        if (!(self._driver.mongo && self._driver.mongo.db)) {
          throw new Error('Can only call rawDatabase on server collections');
        }
        return self._driver.mongo.db;
      }
    });

    // Convert the callback to not return a result if there is an error
    function wrapCallback(callback, convertResult) {
      return callback && function (error, result) {
        if (error) {
          callback(error);
        } else if (typeof convertResult === 'function') {
          callback(error, convertResult(result));
        } else {
          callback(error, result);
        }
      };
    }

    /**
     * @summary Create a Mongo-style `ObjectID`.  If you don't specify a `hexString`, the `ObjectID` will generated randomly (not using MongoDB's ID construction rules).
     * @locus Anywhere
     * @class
     * @param {String} [hexString] Optional.  The 24-character hexadecimal contents of the ObjectID to create
     */
    Mongo.ObjectID = MongoID.ObjectID;

    /**
     * @summary To create a cursor, use find. To access the documents in a cursor, use forEach, map, or fetch.
     * @class
     * @instanceName cursor
     */
    Mongo.Cursor = LocalCollection.Cursor;

    /**
     * @deprecated in 0.9.1
     */
    Mongo.Collection.Cursor = Mongo.Cursor;

    /**
     * @deprecated in 0.9.1
     */
    Mongo.Collection.ObjectID = Mongo.ObjectID;

    /**
     * @deprecated in 0.9.1
     */
    Meteor.Collection = Mongo.Collection;

    // Allow deny stuff is now in the allow-deny package
    Object.assign(Mongo.Collection.prototype, AllowDeny.CollectionPrototype);
    function popCallbackFromArgs(args) {
      // Pull off any callback (or perhaps a 'callback' variable that was passed
      // in undefined, like how 'upsert' does it).
      if (args.length && (args[args.length - 1] === undefined || args[args.length - 1] instanceof Function)) {
        return args.pop();
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"connection_options.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/connection_options.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * @summary Allows for user specified connection options
 * @example http://mongodb.github.io/node-mongodb-native/3.0/reference/connecting/connection-settings/
 * @locus Server
 * @param {Object} options User specified Mongo connection options
 */
Mongo.setConnectionOptions = function setConnectionOptions(options) {
  check(options, Object);
  Mongo._connectionOptions = options;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"mongo_utils.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_utils.js                                                                                       //
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
    let _objectWithoutProperties;
    module.link("@babel/runtime/helpers/objectWithoutProperties", {
      default(v) {
        _objectWithoutProperties = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const _excluded = ["fields", "projection"];
    module.export({
      normalizeProjection: () => normalizeProjection
    });
    const normalizeProjection = options => {
      // transform fields key in projection
      const _ref = options || {},
        {
          fields,
          projection
        } = _ref,
        otherOptions = _objectWithoutProperties(_ref, _excluded);
      // TODO: enable this comment when deprecating the fields option
      // Log.debug(`fields option has been deprecated, please use the new 'projection' instead`)

      return _objectSpread(_objectSpread({}, otherOptions), projection || fields ? {
        projection: fields || projection
      } : {});
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

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      MongoInternals: MongoInternals,
      Mongo: Mongo,
      ObserveMultiplexer: ObserveMultiplexer
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/mongo/mongo_driver.js",
    "/node_modules/meteor/mongo/oplog_tailing.js",
    "/node_modules/meteor/mongo/observe_multiplex.js",
    "/node_modules/meteor/mongo/doc_fetcher.js",
    "/node_modules/meteor/mongo/polling_observe_driver.js",
    "/node_modules/meteor/mongo/oplog_observe_driver.js",
    "/node_modules/meteor/mongo/oplog_v2_converter.js",
    "/node_modules/meteor/mongo/local_collection_driver.js",
    "/node_modules/meteor/mongo/remote_collection_driver.js",
    "/node_modules/meteor/mongo/collection.js",
    "/node_modules/meteor/mongo/connection_options.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/mongo.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vcGxvZ190YWlsaW5nLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vYnNlcnZlX211bHRpcGxleC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vZG9jX2ZldGNoZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL3BvbGxpbmdfb2JzZXJ2ZV9kcml2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL29wbG9nX29ic2VydmVfZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vcGxvZ192Ml9jb252ZXJ0ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2xvY2FsX2NvbGxlY3Rpb25fZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9yZW1vdGVfY29sbGVjdGlvbl9kcml2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2NvbGxlY3Rpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2Nvbm5lY3Rpb25fb3B0aW9ucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fdXRpbHMuanMiXSwibmFtZXMiOlsiX29iamVjdFNwcmVhZCIsIm1vZHVsZTEiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJub3JtYWxpemVQcm9qZWN0aW9uIiwiRG9jRmV0Y2hlciIsIkFTWU5DX0NVUlNPUl9NRVRIT0RTIiwiQ0xJRU5UX09OTFlfTUVUSE9EUyIsImdldEFzeW5jTWV0aG9kTmFtZSIsIk1ldGVvciIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwicGF0aCIsInJlcXVpcmUiLCJ1dGlsIiwiTW9uZ29EQiIsIk5wbU1vZHVsZU1vbmdvZGIiLCJNb25nb0ludGVybmFscyIsIl9fcGFja2FnZU5hbWUiLCJOcG1Nb2R1bGVzIiwibW9uZ29kYiIsInZlcnNpb24iLCJOcG1Nb2R1bGVNb25nb2RiVmVyc2lvbiIsIm1vZHVsZSIsIk5wbU1vZHVsZSIsIkZJTEVfQVNTRVRfU1VGRklYIiwiQVNTRVRTX0ZPTERFUiIsIkFQUF9GT0xERVIiLCJyZXBsYWNlTmFtZXMiLCJmaWx0ZXIiLCJ0aGluZyIsIl8iLCJpc0FycmF5IiwibWFwIiwiYmluZCIsInJldCIsImVhY2giLCJ2YWx1ZSIsImtleSIsIlRpbWVzdGFtcCIsInByb3RvdHlwZSIsImNsb25lIiwibWFrZU1vbmdvTGVnYWwiLCJuYW1lIiwidW5tYWtlTW9uZ29MZWdhbCIsInN1YnN0ciIsInJlcGxhY2VNb25nb0F0b21XaXRoTWV0ZW9yIiwiZG9jdW1lbnQiLCJCaW5hcnkiLCJzdWJfdHlwZSIsImJ1ZmZlciIsIlVpbnQ4QXJyYXkiLCJPYmplY3RJRCIsIk1vbmdvIiwidG9IZXhTdHJpbmciLCJEZWNpbWFsMTI4IiwiRGVjaW1hbCIsInRvU3RyaW5nIiwic2l6ZSIsIkVKU09OIiwiZnJvbUpTT05WYWx1ZSIsInVuZGVmaW5lZCIsInJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvIiwiaXNCaW5hcnkiLCJCdWZmZXIiLCJmcm9tIiwiZnJvbVN0cmluZyIsIl9pc0N1c3RvbVR5cGUiLCJ0b0pTT05WYWx1ZSIsInJlcGxhY2VUeXBlcyIsImF0b21UcmFuc2Zvcm1lciIsInJlcGxhY2VkVG9wTGV2ZWxBdG9tIiwidmFsIiwidmFsUmVwbGFjZWQiLCJNb25nb0Nvbm5lY3Rpb24iLCJ1cmwiLCJvcHRpb25zIiwiX01ldGVvciRzZXR0aW5ncyIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjayIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazIiLCJzZWxmIiwiX29ic2VydmVNdWx0aXBsZXhlcnMiLCJfb25GYWlsb3Zlckhvb2siLCJIb29rIiwidXNlck9wdGlvbnMiLCJfY29ubmVjdGlvbk9wdGlvbnMiLCJzZXR0aW5ncyIsInBhY2thZ2VzIiwibW9uZ28iLCJtb25nb09wdGlvbnMiLCJPYmplY3QiLCJhc3NpZ24iLCJpZ25vcmVVbmRlZmluZWQiLCJoYXMiLCJtYXhQb29sU2l6ZSIsImVudHJpZXMiLCJfcmVmIiwiZW5kc1dpdGgiLCJmb3JFYWNoIiwiX3JlZjIiLCJvcHRpb25OYW1lIiwicmVwbGFjZSIsImpvaW4iLCJBc3NldHMiLCJnZXRTZXJ2ZXJEaXIiLCJkYiIsIl9vcGxvZ0hhbmRsZSIsIl9kb2NGZXRjaGVyIiwiY2xpZW50IiwiTW9uZ29DbGllbnQiLCJvbiIsImJpbmRFbnZpcm9ubWVudCIsImV2ZW50IiwicHJldmlvdXNEZXNjcmlwdGlvbiIsInR5cGUiLCJuZXdEZXNjcmlwdGlvbiIsImNhbGxiYWNrIiwib3Bsb2dVcmwiLCJQYWNrYWdlIiwiT3Bsb2dIYW5kbGUiLCJkYXRhYmFzZU5hbWUiLCJfY2xvc2UiLCJFcnJvciIsIm9wbG9nSGFuZGxlIiwic3RvcCIsImNsb3NlIiwicmF3Q29sbGVjdGlvbiIsImNvbGxlY3Rpb25OYW1lIiwiY29sbGVjdGlvbiIsImNyZWF0ZUNhcHBlZENvbGxlY3Rpb25Bc3luYyIsImJ5dGVTaXplIiwibWF4RG9jdW1lbnRzIiwiY3JlYXRlQ29sbGVjdGlvbiIsImNhcHBlZCIsIm1heCIsIl9tYXliZUJlZ2luV3JpdGUiLCJmZW5jZSIsIkREUFNlcnZlciIsIl9nZXRDdXJyZW50RmVuY2UiLCJiZWdpbldyaXRlIiwiY29tbWl0dGVkIiwiX29uRmFpbG92ZXIiLCJyZWdpc3RlciIsIndyaXRlQ2FsbGJhY2siLCJ3cml0ZSIsInJlZnJlc2giLCJlcnIiLCJyZXN1bHQiLCJyZWZyZXNoRXJyIiwiYmluZEVudmlyb25tZW50Rm9yV3JpdGUiLCJpbnNlcnRBc3luYyIsImNvbGxlY3Rpb25fbmFtZSIsImUiLCJfZXhwZWN0ZWRCeVRlc3QiLCJMb2NhbENvbGxlY3Rpb24iLCJfaXNQbGFpbk9iamVjdCIsImlkIiwiX2lkIiwiaW5zZXJ0T25lIiwic2FmZSIsInRoZW4iLCJfcmVmMyIsImluc2VydGVkSWQiLCJjYXRjaCIsIl9yZWZyZXNoIiwic2VsZWN0b3IiLCJyZWZyZXNoS2V5Iiwic3BlY2lmaWNJZHMiLCJfaWRzTWF0Y2hlZEJ5U2VsZWN0b3IiLCJleHRlbmQiLCJyZW1vdmVBc3luYyIsImRlbGV0ZU1hbnkiLCJfcmVmNCIsImRlbGV0ZWRDb3VudCIsInRyYW5zZm9ybVJlc3VsdCIsIm1vZGlmaWVkQ291bnQiLCJudW1iZXJBZmZlY3RlZCIsImRyb3BDb2xsZWN0aW9uQXN5bmMiLCJkcm9wQ29sbGVjdGlvbiIsImRyb3AiLCJkcm9wRGF0YWJhc2VBc3luYyIsImRyb3BEYXRhYmFzZSIsIl9kcm9wRGF0YWJhc2UiLCJ1cGRhdGVBc3luYyIsIm1vZCIsImVycm9yIiwibW9uZ29PcHRzIiwiYXJyYXlGaWx0ZXJzIiwidXBzZXJ0IiwibXVsdGkiLCJmdWxsUmVzdWx0IiwibW9uZ29TZWxlY3RvciIsIm1vbmdvTW9kIiwiaXNNb2RpZnkiLCJfaXNNb2RpZmljYXRpb25Nb2QiLCJfZm9yYmlkUmVwbGFjZSIsImtub3duSWQiLCJuZXdEb2MiLCJfY3JlYXRlVXBzZXJ0RG9jdW1lbnQiLCJnZW5lcmF0ZWRJZCIsInNpbXVsYXRlVXBzZXJ0V2l0aEluc2VydGVkSWQiLCJfcmV0dXJuT2JqZWN0IiwiaGFzT3duUHJvcGVydHkiLCIkc2V0T25JbnNlcnQiLCJzdHJpbmdzIiwia2V5cyIsInN0YXJ0c1dpdGgiLCJ1cGRhdGVNZXRob2QiLCJsZW5ndGgiLCJtZXRlb3JSZXN1bHQiLCJkcml2ZXJSZXN1bHQiLCJtb25nb1Jlc3VsdCIsInVwc2VydGVkQ291bnQiLCJ1cHNlcnRlZElkIiwibiIsIm1hdGNoZWRDb3VudCIsIk5VTV9PUFRJTUlTVElDX1RSSUVTIiwiX2lzQ2Fubm90Q2hhbmdlSWRFcnJvciIsImVycm1zZyIsImluZGV4T2YiLCJtb25nb09wdHNGb3JVcGRhdGUiLCJtb25nb09wdHNGb3JJbnNlcnQiLCJyZXBsYWNlbWVudFdpdGhJZCIsInRyaWVzIiwiZG9VcGRhdGUiLCJtZXRob2QiLCJ1cGRhdGVNYW55Iiwic29tZSIsInJlcGxhY2VPbmUiLCJkb0NvbmRpdGlvbmFsSW5zZXJ0IiwidXBzZXJ0QXN5bmMiLCJmaW5kIiwiYXJndW1lbnRzIiwiQ3Vyc29yIiwiQ3Vyc29yRGVzY3JpcHRpb24iLCJmaW5kT25lQXN5bmMiLCJsaW1pdCIsInJlc3VsdHMiLCJmZXRjaCIsImNyZWF0ZUluZGV4QXN5bmMiLCJpbmRleCIsImNyZWF0ZUluZGV4IiwiY291bnREb2N1bWVudHMiLCJfbGVuIiwiYXJncyIsIkFycmF5IiwiX2tleSIsImFyZyIsImVzdGltYXRlZERvY3VtZW50Q291bnQiLCJfbGVuMiIsIl9rZXkyIiwiZW5zdXJlSW5kZXhBc3luYyIsImRyb3BJbmRleEFzeW5jIiwiaW5kZXhOYW1lIiwiZHJvcEluZGV4IiwibSIsImNvbmNhdCIsIkNvbGxlY3Rpb24iLCJfcmV3cml0ZVNlbGVjdG9yIiwiY3Vyc29yRGVzY3JpcHRpb24iLCJfbW9uZ28iLCJfY3Vyc29yRGVzY3JpcHRpb24iLCJfc3luY2hyb25vdXNDdXJzb3IiLCJzZXR1cFN5bmNocm9ub3VzQ3Vyc29yIiwiY3Vyc29yIiwidGFpbGFibGUiLCJfY3JlYXRlU3luY2hyb25vdXNDdXJzb3IiLCJzZWxmRm9ySXRlcmF0aW9uIiwidXNlVHJhbnNmb3JtIiwiY291bnRBc3luYyIsImNvdW50IiwiU3ltYm9sIiwiaXRlcmF0b3IiLCJhc3luY0l0ZXJhdG9yIiwibWV0aG9kTmFtZSIsIm1ldGhvZE5hbWVBc3luYyIsIlByb21pc2UiLCJyZXNvbHZlIiwicmVqZWN0IiwiZ2V0VHJhbnNmb3JtIiwidHJhbnNmb3JtIiwiX3B1Ymxpc2hDdXJzb3IiLCJzdWIiLCJfZ2V0Q29sbGVjdGlvbk5hbWUiLCJvYnNlcnZlIiwiY2FsbGJhY2tzIiwiX29ic2VydmVGcm9tT2JzZXJ2ZUNoYW5nZXMiLCJvYnNlcnZlQ2hhbmdlcyIsIm1ldGhvZHMiLCJvcmRlcmVkIiwiX29ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzQXJlT3JkZXJlZCIsImV4Y2VwdGlvbk5hbWUiLCJfZnJvbU9ic2VydmUiLCJfb2JzZXJ2ZUNoYW5nZXMiLCJub25NdXRhdGluZ0NhbGxiYWNrcyIsInBpY2siLCJjdXJzb3JPcHRpb25zIiwic29ydCIsInNraXAiLCJwcm9qZWN0aW9uIiwiZmllbGRzIiwicmVhZFByZWZlcmVuY2UiLCJudW1iZXJPZlJldHJpZXMiLCJkYkN1cnNvciIsImFkZEN1cnNvckZsYWciLCJPUExPR19DT0xMRUNUSU9OIiwidHMiLCJtYXhUaW1lTXMiLCJtYXhUaW1lTVMiLCJoaW50IiwiQXN5bmNocm9ub3VzQ3Vyc29yIiwiY29uc3RydWN0b3IiLCJfZGJDdXJzb3IiLCJfc2VsZkZvckl0ZXJhdGlvbiIsIl90cmFuc2Zvcm0iLCJ3cmFwVHJhbnNmb3JtIiwiX3Zpc2l0ZWRJZHMiLCJfSWRNYXAiLCJuZXh0IiwiX25leHRPYmplY3RQcm9taXNlIiwiZG9uZSIsIl9yYXdOZXh0T2JqZWN0UHJvbWlzZSIsImNvbnNvbGUiLCJkb2MiLCJzZXQiLCJfbmV4dE9iamVjdFByb21pc2VXaXRoVGltZW91dCIsInRpbWVvdXRNUyIsIm5leHRPYmplY3RQcm9taXNlIiwidGltZW91dEVyciIsInRpbWVvdXRQcm9taXNlIiwic2V0VGltZW91dCIsInJhY2UiLCJ0aGlzQXJnIiwiX3Jld2luZCIsImlkeCIsImNhbGwiLCJwdXNoIiwicmV3aW5kIiwiaWRlbnRpdHkiLCJnZXRSYXdPYmplY3RzIiwiU3luY2hyb25vdXNDdXJzb3IiLCJfc3luY2hyb25vdXNDb3VudCIsIkZ1dHVyZSIsIndyYXAiLCJ0aW1lciIsIl9uZXh0T2JqZWN0IiwiYXdhaXQiLCJ3cmFwcGVkRm4iLCJ3cmFwRm4iLCJyZXMiLCJ3YWl0Iiwic3luY1Jlc3VsdCIsInRhaWwiLCJkb2NDYWxsYmFjayIsInN0b3BwZWQiLCJsYXN0VFMiLCJkZWZlciIsImxvb3AiLCJuZXdTZWxlY3RvciIsIiRndCIsIl9vYnNlcnZlQ2hhbmdlc1RhaWxhYmxlIiwiZmllbGRzT3B0aW9ucyIsIm9ic2VydmVLZXkiLCJzdHJpbmdpZnkiLCJtdWx0aXBsZXhlciIsIm9ic2VydmVEcml2ZXIiLCJmaXJzdEhhbmRsZSIsIk9ic2VydmVNdWx0aXBsZXhlciIsIm9uU3RvcCIsIm9ic2VydmVIYW5kbGUiLCJPYnNlcnZlSGFuZGxlIiwibWF0Y2hlciIsInNvcnRlciIsImNhblVzZU9wbG9nIiwiYWxsIiwiX3Rlc3RPbmx5UG9sbENhbGxiYWNrIiwiTWluaW1vbmdvIiwiTWF0Y2hlciIsIk9wbG9nT2JzZXJ2ZURyaXZlciIsImN1cnNvclN1cHBvcnRlZCIsIlNvcnRlciIsImYiLCJkcml2ZXJDbGFzcyIsIlBvbGxpbmdPYnNlcnZlRHJpdmVyIiwibW9uZ29IYW5kbGUiLCJfaW5pdCIsIl9vYnNlcnZlRHJpdmVyIiwiYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIiwibGlzdGVuQWxsIiwibGlzdGVuQ2FsbGJhY2siLCJsaXN0ZW5lcnMiLCJmb3JFYWNoVHJpZ2dlciIsInRyaWdnZXIiLCJfSW52YWxpZGF0aW9uQ3Jvc3NiYXIiLCJsaXN0ZW4iLCJsaXN0ZW5lciIsInRyaWdnZXJDYWxsYmFjayIsImFkZGVkQmVmb3JlIiwiYWRkZWQiLCJNb25nb1RpbWVzdGFtcCIsIkNvbm5lY3Rpb24iLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJhc3luYyIsIkxvbmciLCJUT09fRkFSX0JFSElORCIsInByb2Nlc3MiLCJlbnYiLCJNRVRFT1JfT1BMT0dfVE9PX0ZBUl9CRUhJTkQiLCJUQUlMX1RJTUVPVVQiLCJNRVRFT1JfT1BMT0dfVEFJTF9USU1FT1VUIiwiaWRGb3JPcCIsIm9wIiwibyIsIm8yIiwiZGJOYW1lIiwiX29wbG9nVXJsIiwiX2RiTmFtZSIsIl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24iLCJfb3Bsb2dUYWlsQ29ubmVjdGlvbiIsIl9zdG9wcGVkIiwiX3RhaWxIYW5kbGUiLCJfcmVhZHlQcm9taXNlUmVzb2x2ZXIiLCJfcmVhZHlQcm9taXNlIiwiciIsIl9jcm9zc2JhciIsIl9Dcm9zc2JhciIsImZhY3RQYWNrYWdlIiwiZmFjdE5hbWUiLCJfYmFzZU9wbG9nU2VsZWN0b3IiLCJucyIsIlJlZ0V4cCIsIl9lc2NhcGVSZWdFeHAiLCIkb3IiLCIkaW4iLCIkZXhpc3RzIiwiX2NhdGNoaW5nVXBSZXNvbHZlcnMiLCJfbGFzdFByb2Nlc3NlZFRTIiwiX29uU2tpcHBlZEVudHJpZXNIb29rIiwiZGVidWdQcmludEV4Y2VwdGlvbnMiLCJfZW50cnlRdWV1ZSIsIl9Eb3VibGVFbmRlZFF1ZXVlIiwiX3dvcmtlckFjdGl2ZSIsInNob3VsZEF3YWl0IiwiX3N0YXJ0VGFpbGluZyIsIl9vbk9wbG9nRW50cnkiLCJvcmlnaW5hbENhbGxiYWNrIiwibm90aWZpY2F0aW9uIiwiX2RlYnVnIiwibGlzdGVuSGFuZGxlIiwib25PcGxvZ0VudHJ5Iiwib25Ta2lwcGVkRW50cmllcyIsIl93YWl0VW50aWxDYXVnaHRVcCIsImxhc3RFbnRyeSIsIiRuYXR1cmFsIiwiX3NsZWVwRm9yTXMiLCJsZXNzVGhhbk9yRXF1YWwiLCJpbnNlcnRBZnRlciIsImdyZWF0ZXJUaGFuIiwicHJvbWlzZVJlc29sdmVyIiwicHJvbWlzZVRvQXdhaXQiLCJzcGxpY2UiLCJyZXNvbHZlciIsIndhaXRVbnRpbENhdWdodFVwIiwibW9uZ29kYlVyaSIsIk5wbSIsInBhcnNlIiwiZGF0YWJhc2UiLCJpc01hc3RlckRvYyIsImFkbWluIiwiY29tbWFuZCIsImlzbWFzdGVyIiwic2V0TmFtZSIsImxhc3RPcGxvZ0VudHJ5Iiwib3Bsb2dTZWxlY3RvciIsIl9tYXliZVN0YXJ0V29ya2VyIiwiaGFuZGxlRG9jIiwiYXBwbHlPcHMiLCJuZXh0VGltZXN0YW1wIiwiYWRkIiwiT05FIiwic2xpY2UiLCJmaXJlIiwiaXNFbXB0eSIsInBvcCIsImNsZWFyIiwiX3NldExhc3RQcm9jZXNzZWRUUyIsInNoaWZ0Iiwic2VxdWVuY2VyIiwiX2RlZmluZVRvb0ZhckJlaGluZCIsIl9yZXNldFRvb0ZhckJlaGluZCIsIl9vYmplY3RXaXRob3V0UHJvcGVydGllcyIsIl9leGNsdWRlZCIsIm5leHRPYnNlcnZlSGFuZGxlSWQiLCJGYWN0cyIsImluY3JlbWVudFNlcnZlckZhY3QiLCJfb3JkZXJlZCIsIl9vblN0b3AiLCJfcXVldWUiLCJfQXN5bmNocm9ub3VzUXVldWUiLCJfaGFuZGxlcyIsIl9yZXNvbHZlciIsIl9pc1JlYWR5IiwiX2NhY2hlIiwiX0NhY2hpbmdDaGFuZ2VPYnNlcnZlciIsIl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZCIsImNhbGxiYWNrTmFtZXMiLCJjYWxsYmFja05hbWUiLCJfYXBwbHlDYWxsYmFjayIsInRvQXJyYXkiLCJoYW5kbGUiLCJfYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIiwicnVuVGFzayIsIl9zZW5kQWRkcyIsInJlbW92ZUhhbmRsZSIsIl9yZWFkeSIsIl9zdG9wIiwiZnJvbVF1ZXJ5RXJyb3IiLCJyZWFkeSIsInF1ZXVlVGFzayIsInF1ZXJ5RXJyb3IiLCJvbkZsdXNoIiwiY2IiLCJhcHBseUNoYW5nZSIsImFwcGx5IiwiaGFuZGxlSWQiLCJfYWRkZWRCZWZvcmUiLCJfYWRkZWQiLCJkb2NzIiwiZm9yRWFjaEFzeW5jIiwiX211bHRpcGxleGVyIiwiYmVmb3JlIiwiZXhwb3J0IiwibW9uZ29Db25uZWN0aW9uIiwiX21vbmdvQ29ubmVjdGlvbiIsIl9jYWxsYmFja3NGb3JPcCIsIk1hcCIsImNoZWNrIiwiU3RyaW5nIiwiZ2V0IiwiZGVsZXRlIiwiUE9MTElOR19USFJPVFRMRV9NUyIsIk1FVEVPUl9QT0xMSU5HX1RIUk9UVExFX01TIiwiUE9MTElOR19JTlRFUlZBTF9NUyIsIk1FVEVPUl9QT0xMSU5HX0lOVEVSVkFMX01TIiwiX21vbmdvSGFuZGxlIiwiX3N0b3BDYWxsYmFja3MiLCJfY3Vyc29yIiwiX3Jlc3VsdHMiLCJfcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkIiwiX3BlbmRpbmdXcml0ZXMiLCJfZW5zdXJlUG9sbElzU2NoZWR1bGVkIiwidGhyb3R0bGUiLCJfdW50aHJvdHRsZWRFbnN1cmVQb2xsSXNTY2hlZHVsZWQiLCJwb2xsaW5nVGhyb3R0bGVNcyIsIl90YXNrUXVldWUiLCJsaXN0ZW5lcnNIYW5kbGUiLCJwb2xsaW5nSW50ZXJ2YWwiLCJwb2xsaW5nSW50ZXJ2YWxNcyIsIl9wb2xsaW5nSW50ZXJ2YWwiLCJpbnRlcnZhbEhhbmRsZSIsInNldEludGVydmFsIiwiY2xlYXJJbnRlcnZhbCIsIl9wb2xsTW9uZ28iLCJfc3VzcGVuZFBvbGxpbmciLCJfcmVzdW1lUG9sbGluZyIsImZpcnN0IiwibmV3UmVzdWx0cyIsIm9sZFJlc3VsdHMiLCJ3cml0ZXNGb3JDeWNsZSIsImNvZGUiLCJKU09OIiwibWVzc2FnZSIsIl9kaWZmUXVlcnlDaGFuZ2VzIiwidyIsInN0b3BDYWxsYmFja3NDYWxsZXIiLCJjIiwiX2FzeW5jSXRlcmF0b3IiLCJvcGxvZ1YyVjFDb252ZXJ0ZXIiLCJQSEFTRSIsIlFVRVJZSU5HIiwiRkVUQ0hJTkciLCJTVEVBRFkiLCJTd2l0Y2hlZFRvUXVlcnkiLCJmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeSIsImN1cnJlbnRJZCIsIl91c2VzT3Bsb2ciLCJjb21wYXJhdG9yIiwiZ2V0Q29tcGFyYXRvciIsImhlYXBPcHRpb25zIiwiSWRNYXAiLCJfbGltaXQiLCJfY29tcGFyYXRvciIsIl9zb3J0ZXIiLCJfdW5wdWJsaXNoZWRCdWZmZXIiLCJNaW5NYXhIZWFwIiwiX3B1Ymxpc2hlZCIsIk1heEhlYXAiLCJfc2FmZUFwcGVuZFRvQnVmZmVyIiwiX3N0b3BIYW5kbGVzIiwiX3JlZ2lzdGVyUGhhc2VDaGFuZ2UiLCJfbWF0Y2hlciIsIl9wcm9qZWN0aW9uRm4iLCJfY29tcGlsZVByb2plY3Rpb24iLCJfc2hhcmVkUHJvamVjdGlvbiIsImNvbWJpbmVJbnRvUHJvamVjdGlvbiIsIl9zaGFyZWRQcm9qZWN0aW9uRm4iLCJfbmVlZFRvRmV0Y2giLCJfY3VycmVudGx5RmV0Y2hpbmciLCJfZmV0Y2hHZW5lcmF0aW9uIiwiX3JlcXVlcnlXaGVuRG9uZVRoaXNRdWVyeSIsIl93cml0ZXNUb0NvbW1pdFdoZW5XZVJlYWNoU3RlYWR5IiwiX25lZWRUb1BvbGxRdWVyeSIsIl9waGFzZSIsIl9oYW5kbGVPcGxvZ0VudHJ5UXVlcnlpbmciLCJfaGFuZGxlT3Bsb2dFbnRyeVN0ZWFkeU9yRmV0Y2hpbmciLCJmaXJlZCIsIl9vcGxvZ09ic2VydmVEcml2ZXJzIiwib25CZWZvcmVGaXJlIiwiZHJpdmVycyIsImRyaXZlciIsInZhbHVlcyIsIl9ydW5Jbml0aWFsUXVlcnkiLCJfYWRkUHVibGlzaGVkIiwiX25vWWllbGRzQWxsb3dlZCIsIm92ZXJmbG93aW5nRG9jSWQiLCJtYXhFbGVtZW50SWQiLCJvdmVyZmxvd2luZ0RvYyIsImVxdWFscyIsInJlbW92ZSIsInJlbW92ZWQiLCJfYWRkQnVmZmVyZWQiLCJfcmVtb3ZlUHVibGlzaGVkIiwiZW1wdHkiLCJuZXdEb2NJZCIsIm1pbkVsZW1lbnRJZCIsIl9yZW1vdmVCdWZmZXJlZCIsIl9jaGFuZ2VQdWJsaXNoZWQiLCJvbGREb2MiLCJwcm9qZWN0ZWROZXciLCJwcm9qZWN0ZWRPbGQiLCJjaGFuZ2VkIiwiRGlmZlNlcXVlbmNlIiwibWFrZUNoYW5nZWRGaWVsZHMiLCJtYXhCdWZmZXJlZElkIiwiX2FkZE1hdGNoaW5nIiwibWF4UHVibGlzaGVkIiwibWF4QnVmZmVyZWQiLCJ0b1B1Ymxpc2giLCJjYW5BcHBlbmRUb0J1ZmZlciIsImNhbkluc2VydEludG9CdWZmZXIiLCJ0b0J1ZmZlciIsIl9yZW1vdmVNYXRjaGluZyIsIl9oYW5kbGVEb2MiLCJtYXRjaGVzTm93IiwiZG9jdW1lbnRNYXRjaGVzIiwicHVibGlzaGVkQmVmb3JlIiwiYnVmZmVyZWRCZWZvcmUiLCJjYWNoZWRCZWZvcmUiLCJtaW5CdWZmZXJlZCIsInN0YXlzSW5QdWJsaXNoZWQiLCJzdGF5c0luQnVmZmVyIiwiX2ZldGNoTW9kaWZpZWREb2N1bWVudHMiLCJ0aGlzR2VuZXJhdGlvbiIsIndhaXRpbmciLCJhd2FpdGFibGVQcm9taXNlIiwiX2JlU3RlYWR5Iiwid3JpdGVzIiwiaXNSZXBsYWNlIiwiY2FuRGlyZWN0bHlNb2RpZnlEb2MiLCJtb2RpZmllckNhbkJlRGlyZWN0bHlBcHBsaWVkIiwiX21vZGlmeSIsImNhbkJlY29tZVRydWVCeU1vZGlmaWVyIiwiYWZmZWN0ZWRCeU1vZGlmaWVyIiwiX3J1bkluaXRpYWxRdWVyeUFzeW5jIiwiX3J1blF1ZXJ5IiwiaW5pdGlhbCIsIl9kb25lUXVlcnlpbmciLCJfcG9sbFF1ZXJ5IiwiX3J1blF1ZXJ5QXN5bmMiLCJuZXdCdWZmZXIiLCJfY3Vyc29yRm9yUXVlcnkiLCJpIiwiX3B1Ymxpc2hOZXdSZXN1bHRzIiwib3B0aW9uc092ZXJ3cml0ZSIsImRlc2NyaXB0aW9uIiwiaWRzVG9SZW1vdmUiLCJfb3Bsb2dFbnRyeUhhbmRsZSIsIl9saXN0ZW5lcnNIYW5kbGUiLCJfaXRlcmF0b3JBYnJ1cHRDb21wbGV0aW9uIiwiX2RpZEl0ZXJhdG9yRXJyb3IiLCJfaXRlcmF0b3JFcnJvciIsIl9pdGVyYXRvciIsIl9zdGVwIiwicmV0dXJuIiwicGhhc2UiLCJub3ciLCJEYXRlIiwidGltZURpZmYiLCJfcGhhc2VTdGFydFRpbWUiLCJkaXNhYmxlT3Bsb2ciLCJfZGlzYWJsZU9wbG9nIiwiX2NoZWNrU3VwcG9ydGVkUHJvamVjdGlvbiIsImhhc1doZXJlIiwiaGFzR2VvUXVlcnkiLCJtb2RpZmllciIsIm9wZXJhdGlvbiIsImZpZWxkIiwidGVzdCIsInByZWZpeCIsImFycmF5T3BlcmF0b3JLZXlSZWdleCIsImlzQXJyYXlPcGVyYXRvcktleSIsImlzQXJyYXlPcGVyYXRvciIsIm9wZXJhdG9yIiwiYSIsImV2ZXJ5IiwiZmxhdHRlbk9iamVjdEludG8iLCJ0YXJnZXQiLCJzb3VyY2UiLCJsb2dEZWJ1Z01lc3NhZ2VzIiwiT1BMT0dfQ09OVkVSVEVSX0RFQlVHIiwiY29udmVydE9wbG9nRGlmZiIsIm9wbG9nRW50cnkiLCJkaWZmIiwibG9nIiwiZGlmZktleSIsIl9vcGxvZ0VudHJ5JCR1bnNldCIsIiR1bnNldCIsIl9vcGxvZ0VudHJ5JCRzZXQiLCIkc2V0IiwiX29wbG9nRW50cnkkJHNldDIiLCJwb3NpdGlvbiIsInBvc2l0aW9uS2V5IiwiX29wbG9nRW50cnkkJHVuc2V0MiIsIl9vcGxvZ0VudHJ5JCRzZXQzIiwiJHYiLCJjb252ZXJ0ZWRPcGxvZ0VudHJ5IiwiTG9jYWxDb2xsZWN0aW9uRHJpdmVyIiwibm9Db25uQ29sbGVjdGlvbnMiLCJjcmVhdGUiLCJvcGVuIiwiY29ubiIsImVuc3VyZUNvbGxlY3Rpb24iLCJfbW9uZ29fbGl2ZWRhdGFfY29sbGVjdGlvbnMiLCJjb2xsZWN0aW9ucyIsIkFTWU5DX0NPTExFQ1RJT05fTUVUSE9EUyIsIlJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIiLCJtb25nb191cmwiLCJSRU1PVEVfQ09MTEVDVElPTl9NRVRIT0RTIiwiaW5jbHVkZXMiLCJhc3luY01ldGhvZE5hbWUiLCJkZWZhdWx0UmVtb3RlQ29sbGVjdGlvbkRyaXZlciIsIm9uY2UiLCJjb25uZWN0aW9uT3B0aW9ucyIsIm1vbmdvVXJsIiwiTU9OR09fVVJMIiwiTU9OR09fT1BMT0dfVVJMIiwic3RhcnR1cCIsImNvbm5lY3QiLCJjb25uZWN0aW9uIiwibWFuYWdlciIsImlkR2VuZXJhdGlvbiIsIl9kcml2ZXIiLCJfcHJldmVudEF1dG9wdWJsaXNoIiwiX21ha2VOZXdJRCIsInNyYyIsIkREUCIsInJhbmRvbVN0cmVhbSIsIlJhbmRvbSIsImluc2VjdXJlIiwiaGV4U3RyaW5nIiwicmVzb2x2ZXJUeXBlIiwiX2Nvbm5lY3Rpb24iLCJpc0NsaWVudCIsInNlcnZlciIsIl9jb2xsZWN0aW9uIiwiX25hbWUiLCJfc2V0dGluZ1VwUmVwbGljYXRpb25Qcm9taXNlIiwiX21heWJlU2V0VXBSZXBsaWNhdGlvbiIsImRlZmluZU11dGF0aW9uTWV0aG9kcyIsIl9kZWZpbmVNdXRhdGlvbk1ldGhvZHMiLCJ1c2VFeGlzdGluZyIsIl9zdXBwcmVzc1NhbWVOYW1lRXJyb3IiLCJhdXRvcHVibGlzaCIsInB1Ymxpc2giLCJpc19hdXRvIiwiX3JlZ2lzdGVyU3RvcmVSZXN1bHQiLCJfcmVnaXN0ZXJTdG9yZVJlc3VsdCQiLCJyZWdpc3RlclN0b3JlQ2xpZW50IiwicmVnaXN0ZXJTdG9yZVNlcnZlciIsIndyYXBwZWRTdG9yZUNvbW1vbiIsInNhdmVPcmlnaW5hbHMiLCJyZXRyaWV2ZU9yaWdpbmFscyIsIl9nZXRDb2xsZWN0aW9uIiwid3JhcHBlZFN0b3JlQ2xpZW50IiwiYmVnaW5VcGRhdGUiLCJiYXRjaFNpemUiLCJyZXNldCIsInBhdXNlT2JzZXJ2ZXJzIiwidXBkYXRlIiwibXNnIiwibW9uZ29JZCIsIk1vbmdvSUQiLCJpZFBhcnNlIiwiX2RvY3MiLCJpbnNlcnQiLCJlbmRVcGRhdGUiLCJyZXN1bWVPYnNlcnZlcnNDbGllbnQiLCJnZXREb2MiLCJmaW5kT25lIiwid3JhcHBlZFN0b3JlU2VydmVyIiwicmVzdW1lT2JzZXJ2ZXJzU2VydmVyIiwicmVnaXN0ZXJTdG9yZVJlc3VsdCIsImxvZ1dhcm4iLCJ3YXJuIiwib2siLCJfZ2V0RmluZFNlbGVjdG9yIiwiX2dldEZpbmRPcHRpb25zIiwibmV3T3B0aW9ucyIsIk1hdGNoIiwiT3B0aW9uYWwiLCJPYmplY3RJbmNsdWRpbmciLCJPbmVPZiIsIkZ1bmN0aW9uIiwiTnVtYmVyIiwiX2xlbjMiLCJfa2V5MyIsImZhbGxiYWNrSWQiLCJfc2VsZWN0b3JJc0lkIiwiX2luc2VydCIsImdldFByb3RvdHlwZU9mIiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyIsImdlbmVyYXRlSWQiLCJfaXNSZW1vdGVDb2xsZWN0aW9uIiwiZW5jbG9zaW5nIiwiX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uIiwiY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdCIsIl9pc1Byb21pc2UiLCJ3cmFwcGVkQ2FsbGJhY2siLCJ3cmFwQ2FsbGJhY2siLCJfY2FsbE11dGF0b3JNZXRob2QiLCJfaW5zZXJ0QXN5bmMiLCJwcm9taXNlIiwiX2NhbGxNdXRhdG9yTWV0aG9kQXN5bmMiLCJzdHViUHJvbWlzZSIsInNlcnZlclByb21pc2UiLCJfbGVuNCIsIm9wdGlvbnNBbmRDYWxsYmFjayIsIl9rZXk0IiwicG9wQ2FsbGJhY2tGcm9tQXJncyIsIkxvZyIsImRlYnVnIiwicmVDcmVhdGVJbmRleE9uT3B0aW9uTWlzbWF0Y2giLCJpbmZvIiwicmF3RGF0YWJhc2UiLCJjb252ZXJ0UmVzdWx0IiwiQWxsb3dEZW55IiwiQ29sbGVjdGlvblByb3RvdHlwZSIsInNldENvbm5lY3Rpb25PcHRpb25zIiwib3RoZXJPcHRpb25zIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFBQSxJQUFJQSxhQUFhO0lBQUNDLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLHNDQUFzQyxFQUFDO01BQUNDLE9BQU9BLENBQUNDLENBQUMsRUFBQztRQUFDSixhQUFhLEdBQUNJLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBdEcsSUFBSUMsbUJBQW1CO0lBQUNKLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLGVBQWUsRUFBQztNQUFDRyxtQkFBbUJBLENBQUNELENBQUMsRUFBQztRQUFDQyxtQkFBbUIsR0FBQ0QsQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlFLFVBQVU7SUFBQ0wsT0FBTyxDQUFDQyxJQUFJLENBQUMsa0JBQWtCLEVBQUM7TUFBQ0ksVUFBVUEsQ0FBQ0YsQ0FBQyxFQUFDO1FBQUNFLFVBQVUsR0FBQ0YsQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlHLG9CQUFvQixFQUFDQyxtQkFBbUIsRUFBQ0Msa0JBQWtCO0lBQUNSLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLDRCQUE0QixFQUFDO01BQUNLLG9CQUFvQkEsQ0FBQ0gsQ0FBQyxFQUFDO1FBQUNHLG9CQUFvQixHQUFDSCxDQUFDO01BQUEsQ0FBQztNQUFDSSxtQkFBbUJBLENBQUNKLENBQUMsRUFBQztRQUFDSSxtQkFBbUIsR0FBQ0osQ0FBQztNQUFB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ImltcG9ydCB7IG5vcm1hbGl6ZVByb2plY3Rpb24gfSBmcm9tIFwiLi9tb25nb191dGlsc1wiO1xuXG4vKipcbiAqIFByb3ZpZGUgYSBzeW5jaHJvbm91cyBDb2xsZWN0aW9uIEFQSSB1c2luZyBmaWJlcnMsIGJhY2tlZCBieVxuICogTW9uZ29EQi4gIFRoaXMgaXMgb25seSBmb3IgdXNlIG9uIHRoZSBzZXJ2ZXIsIGFuZCBtb3N0bHkgaWRlbnRpY2FsXG4gKiB0byB0aGUgY2xpZW50IEFQSS5cbiAqXG4gKiBOT1RFOiB0aGUgcHVibGljIEFQSSBtZXRob2RzIG11c3QgYmUgcnVuIHdpdGhpbiBhIGZpYmVyLiBJZiB5b3UgY2FsbFxuICogdGhlc2Ugb3V0c2lkZSBvZiBhIGZpYmVyIHRoZXkgd2lsbCBleHBsb2RlIVxuICovXG5cbmNvbnN0IHBhdGggPSByZXF1aXJlKFwicGF0aFwiKTtcbmNvbnN0IHV0aWwgPSByZXF1aXJlKFwidXRpbFwiKTtcblxuLyoqIEB0eXBlIHtpbXBvcnQoJ21vbmdvZGInKX0gKi9cbnZhciBNb25nb0RCID0gTnBtTW9kdWxlTW9uZ29kYjtcbmltcG9ydCB7IERvY0ZldGNoZXIgfSBmcm9tIFwiLi9kb2NfZmV0Y2hlci5qc1wiO1xuaW1wb3J0IHtcbiAgQVNZTkNfQ1VSU09SX01FVEhPRFMsXG4gIENMSUVOVF9PTkxZX01FVEhPRFMsXG4gIGdldEFzeW5jTWV0aG9kTmFtZVxufSBmcm9tIFwibWV0ZW9yL21pbmltb25nby9jb25zdGFudHNcIjtcbmltcG9ydCB7IE1ldGVvciB9IGZyb20gXCJtZXRlb3IvbWV0ZW9yXCI7XG5cbk1vbmdvSW50ZXJuYWxzID0ge307XG5cbk1vbmdvSW50ZXJuYWxzLl9fcGFja2FnZU5hbWUgPSAnbW9uZ28nO1xuXG5Nb25nb0ludGVybmFscy5OcG1Nb2R1bGVzID0ge1xuICBtb25nb2RiOiB7XG4gICAgdmVyc2lvbjogTnBtTW9kdWxlTW9uZ29kYlZlcnNpb24sXG4gICAgbW9kdWxlOiBNb25nb0RCXG4gIH1cbn07XG5cbi8vIE9sZGVyIHZlcnNpb24gb2Ygd2hhdCBpcyBub3cgYXZhaWxhYmxlIHZpYVxuLy8gTW9uZ29JbnRlcm5hbHMuTnBtTW9kdWxlcy5tb25nb2RiLm1vZHVsZS4gIEl0IHdhcyBuZXZlciBkb2N1bWVudGVkLCBidXRcbi8vIHBlb3BsZSBkbyB1c2UgaXQuXG4vLyBYWFggQ09NUEFUIFdJVEggMS4wLjMuMlxuTW9uZ29JbnRlcm5hbHMuTnBtTW9kdWxlID0gTW9uZ29EQjtcblxuY29uc3QgRklMRV9BU1NFVF9TVUZGSVggPSAnQXNzZXQnO1xuY29uc3QgQVNTRVRTX0ZPTERFUiA9ICdhc3NldHMnO1xuY29uc3QgQVBQX0ZPTERFUiA9ICdhcHAnO1xuXG4vLyBUaGlzIGlzIHVzZWQgdG8gYWRkIG9yIHJlbW92ZSBFSlNPTiBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgZXZlcnl0aGluZyBuZXN0ZWRcbi8vIGluc2lkZSBhbiBFSlNPTiBjdXN0b20gdHlwZS4gSXQgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIG9uIHB1cmUgSlNPTiFcbnZhciByZXBsYWNlTmFtZXMgPSBmdW5jdGlvbiAoZmlsdGVyLCB0aGluZykge1xuICBpZiAodHlwZW9mIHRoaW5nID09PSBcIm9iamVjdFwiICYmIHRoaW5nICE9PSBudWxsKSB7XG4gICAgaWYgKF8uaXNBcnJheSh0aGluZykpIHtcbiAgICAgIHJldHVybiBfLm1hcCh0aGluZywgXy5iaW5kKHJlcGxhY2VOYW1lcywgbnVsbCwgZmlsdGVyKSk7XG4gICAgfVxuICAgIHZhciByZXQgPSB7fTtcbiAgICBfLmVhY2godGhpbmcsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XG4gICAgICByZXRbZmlsdGVyKGtleSldID0gcmVwbGFjZU5hbWVzKGZpbHRlciwgdmFsdWUpO1xuICAgIH0pO1xuICAgIHJldHVybiByZXQ7XG4gIH1cbiAgcmV0dXJuIHRoaW5nO1xufTtcblxuLy8gRW5zdXJlIHRoYXQgRUpTT04uY2xvbmUga2VlcHMgYSBUaW1lc3RhbXAgYXMgYSBUaW1lc3RhbXAgKGluc3RlYWQgb2YganVzdFxuLy8gZG9pbmcgYSBzdHJ1Y3R1cmFsIGNsb25lKS5cbi8vIFhYWCBob3cgb2sgaXMgdGhpcz8gd2hhdCBpZiB0aGVyZSBhcmUgbXVsdGlwbGUgY29waWVzIG9mIE1vbmdvREIgbG9hZGVkP1xuTW9uZ29EQi5UaW1lc3RhbXAucHJvdG90eXBlLmNsb25lID0gZnVuY3Rpb24gKCkge1xuICAvLyBUaW1lc3RhbXBzIHNob3VsZCBiZSBpbW11dGFibGUuXG4gIHJldHVybiB0aGlzO1xufTtcblxudmFyIG1ha2VNb25nb0xlZ2FsID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFwiRUpTT05cIiArIG5hbWU7IH07XG52YXIgdW5tYWtlTW9uZ29MZWdhbCA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBuYW1lLnN1YnN0cig1KTsgfTtcblxudmFyIHJlcGxhY2VNb25nb0F0b21XaXRoTWV0ZW9yID0gZnVuY3Rpb24gKGRvY3VtZW50KSB7XG4gIGlmIChkb2N1bWVudCBpbnN0YW5jZW9mIE1vbmdvREIuQmluYXJ5KSB7XG4gICAgLy8gZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG4gICAgaWYgKGRvY3VtZW50LnN1Yl90eXBlICE9PSAwKSB7XG4gICAgICByZXR1cm4gZG9jdW1lbnQ7XG4gICAgfVxuICAgIHZhciBidWZmZXIgPSBkb2N1bWVudC52YWx1ZSh0cnVlKTtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLk9iamVjdElEKSB7XG4gICAgcmV0dXJuIG5ldyBNb25nby5PYmplY3RJRChkb2N1bWVudC50b0hleFN0cmluZygpKTtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLkRlY2ltYWwxMjgpIHtcbiAgICByZXR1cm4gRGVjaW1hbChkb2N1bWVudC50b1N0cmluZygpKTtcbiAgfVxuICBpZiAoZG9jdW1lbnRbXCJFSlNPTiR0eXBlXCJdICYmIGRvY3VtZW50W1wiRUpTT04kdmFsdWVcIl0gJiYgXy5zaXplKGRvY3VtZW50KSA9PT0gMikge1xuICAgIHJldHVybiBFSlNPTi5mcm9tSlNPTlZhbHVlKHJlcGxhY2VOYW1lcyh1bm1ha2VNb25nb0xlZ2FsLCBkb2N1bWVudCkpO1xuICB9XG4gIGlmIChkb2N1bWVudCBpbnN0YW5jZW9mIE1vbmdvREIuVGltZXN0YW1wKSB7XG4gICAgLy8gRm9yIG5vdywgdGhlIE1ldGVvciByZXByZXNlbnRhdGlvbiBvZiBhIE1vbmdvIHRpbWVzdGFtcCB0eXBlIChub3QgYSBkYXRlIVxuICAgIC8vIHRoaXMgaXMgYSB3ZWlyZCBpbnRlcm5hbCB0aGluZyB1c2VkIGluIHRoZSBvcGxvZyEpIGlzIHRoZSBzYW1lIGFzIHRoZVxuICAgIC8vIE1vbmdvIHJlcHJlc2VudGF0aW9uLiBXZSBuZWVkIHRvIGRvIHRoaXMgZXhwbGljaXRseSBvciBlbHNlIHdlIHdvdWxkIGRvIGFcbiAgICAvLyBzdHJ1Y3R1cmFsIGNsb25lIGFuZCBsb3NlIHRoZSBwcm90b3R5cGUuXG4gICAgcmV0dXJuIGRvY3VtZW50O1xuICB9XG4gIHJldHVybiB1bmRlZmluZWQ7XG59O1xuXG52YXIgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28gPSBmdW5jdGlvbiAoZG9jdW1lbnQpIHtcbiAgaWYgKEVKU09OLmlzQmluYXJ5KGRvY3VtZW50KSkge1xuICAgIC8vIFRoaXMgZG9lcyBtb3JlIGNvcGllcyB0aGFuIHdlJ2QgbGlrZSwgYnV0IGlzIG5lY2Vzc2FyeSBiZWNhdXNlXG4gICAgLy8gTW9uZ29EQi5CU09OIG9ubHkgbG9va3MgbGlrZSBpdCB0YWtlcyBhIFVpbnQ4QXJyYXkgKGFuZCBkb2Vzbid0IGFjdHVhbGx5XG4gICAgLy8gc2VyaWFsaXplIGl0IGNvcnJlY3RseSkuXG4gICAgcmV0dXJuIG5ldyBNb25nb0RCLkJpbmFyeShCdWZmZXIuZnJvbShkb2N1bWVudCkpO1xuICB9XG4gIGlmIChkb2N1bWVudCBpbnN0YW5jZW9mIE1vbmdvREIuQmluYXJ5KSB7XG4gICAgIHJldHVybiBkb2N1bWVudDtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nby5PYmplY3RJRCkge1xuICAgIHJldHVybiBuZXcgTW9uZ29EQi5PYmplY3RJRChkb2N1bWVudC50b0hleFN0cmluZygpKTtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLlRpbWVzdGFtcCkge1xuICAgIC8vIEZvciBub3csIHRoZSBNZXRlb3IgcmVwcmVzZW50YXRpb24gb2YgYSBNb25nbyB0aW1lc3RhbXAgdHlwZSAobm90IGEgZGF0ZSFcbiAgICAvLyB0aGlzIGlzIGEgd2VpcmQgaW50ZXJuYWwgdGhpbmcgdXNlZCBpbiB0aGUgb3Bsb2chKSBpcyB0aGUgc2FtZSBhcyB0aGVcbiAgICAvLyBNb25nbyByZXByZXNlbnRhdGlvbi4gV2UgbmVlZCB0byBkbyB0aGlzIGV4cGxpY2l0bHkgb3IgZWxzZSB3ZSB3b3VsZCBkbyBhXG4gICAgLy8gc3RydWN0dXJhbCBjbG9uZSBhbmQgbG9zZSB0aGUgcHJvdG90eXBlLlxuICAgIHJldHVybiBkb2N1bWVudDtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBEZWNpbWFsKSB7XG4gICAgcmV0dXJuIE1vbmdvREIuRGVjaW1hbDEyOC5mcm9tU3RyaW5nKGRvY3VtZW50LnRvU3RyaW5nKCkpO1xuICB9XG4gIGlmIChFSlNPTi5faXNDdXN0b21UeXBlKGRvY3VtZW50KSkge1xuICAgIHJldHVybiByZXBsYWNlTmFtZXMobWFrZU1vbmdvTGVnYWwsIEVKU09OLnRvSlNPTlZhbHVlKGRvY3VtZW50KSk7XG4gIH1cbiAgLy8gSXQgaXMgbm90IG9yZGluYXJpbHkgcG9zc2libGUgdG8gc3RpY2sgZG9sbGFyLXNpZ24ga2V5cyBpbnRvIG1vbmdvXG4gIC8vIHNvIHdlIGRvbid0IGJvdGhlciBjaGVja2luZyBmb3IgdGhpbmdzIHRoYXQgbmVlZCBlc2NhcGluZyBhdCB0aGlzIHRpbWUuXG4gIHJldHVybiB1bmRlZmluZWQ7XG59O1xuXG52YXIgcmVwbGFjZVR5cGVzID0gZnVuY3Rpb24gKGRvY3VtZW50LCBhdG9tVHJhbnNmb3JtZXIpIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCAhPT0gJ29iamVjdCcgfHwgZG9jdW1lbnQgPT09IG51bGwpXG4gICAgcmV0dXJuIGRvY3VtZW50O1xuXG4gIHZhciByZXBsYWNlZFRvcExldmVsQXRvbSA9IGF0b21UcmFuc2Zvcm1lcihkb2N1bWVudCk7XG4gIGlmIChyZXBsYWNlZFRvcExldmVsQXRvbSAhPT0gdW5kZWZpbmVkKVxuICAgIHJldHVybiByZXBsYWNlZFRvcExldmVsQXRvbTtcblxuICB2YXIgcmV0ID0gZG9jdW1lbnQ7XG4gIF8uZWFjaChkb2N1bWVudCwgZnVuY3Rpb24gKHZhbCwga2V5KSB7XG4gICAgdmFyIHZhbFJlcGxhY2VkID0gcmVwbGFjZVR5cGVzKHZhbCwgYXRvbVRyYW5zZm9ybWVyKTtcbiAgICBpZiAodmFsICE9PSB2YWxSZXBsYWNlZCkge1xuICAgICAgLy8gTGF6eSBjbG9uZS4gU2hhbGxvdyBjb3B5LlxuICAgICAgaWYgKHJldCA9PT0gZG9jdW1lbnQpXG4gICAgICAgIHJldCA9IF8uY2xvbmUoZG9jdW1lbnQpO1xuICAgICAgcmV0W2tleV0gPSB2YWxSZXBsYWNlZDtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gcmV0O1xufTtcblxuXG5Nb25nb0Nvbm5lY3Rpb24gPSBmdW5jdGlvbiAodXJsLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHNlbGYuX29ic2VydmVNdWx0aXBsZXhlcnMgPSB7fTtcbiAgc2VsZi5fb25GYWlsb3Zlckhvb2sgPSBuZXcgSG9vaztcblxuICBjb25zdCB1c2VyT3B0aW9ucyA9IHtcbiAgICAuLi4oTW9uZ28uX2Nvbm5lY3Rpb25PcHRpb25zIHx8IHt9KSxcbiAgICAuLi4oTWV0ZW9yLnNldHRpbmdzPy5wYWNrYWdlcz8ubW9uZ28/Lm9wdGlvbnMgfHwge30pXG4gIH07XG5cbiAgdmFyIG1vbmdvT3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe1xuICAgIGlnbm9yZVVuZGVmaW5lZDogdHJ1ZSxcbiAgfSwgdXNlck9wdGlvbnMpO1xuXG5cblxuICAvLyBJbnRlcm5hbGx5IHRoZSBvcGxvZyBjb25uZWN0aW9ucyBzcGVjaWZ5IHRoZWlyIG93biBtYXhQb29sU2l6ZVxuICAvLyB3aGljaCB3ZSBkb24ndCB3YW50IHRvIG92ZXJ3cml0ZSB3aXRoIGFueSB1c2VyIGRlZmluZWQgdmFsdWVcbiAgaWYgKF8uaGFzKG9wdGlvbnMsICdtYXhQb29sU2l6ZScpKSB7XG4gICAgLy8gSWYgd2UganVzdCBzZXQgdGhpcyBmb3IgXCJzZXJ2ZXJcIiwgcmVwbFNldCB3aWxsIG92ZXJyaWRlIGl0LiBJZiB3ZSBqdXN0XG4gICAgLy8gc2V0IGl0IGZvciByZXBsU2V0LCBpdCB3aWxsIGJlIGlnbm9yZWQgaWYgd2UncmUgbm90IHVzaW5nIGEgcmVwbFNldC5cbiAgICBtb25nb09wdGlvbnMubWF4UG9vbFNpemUgPSBvcHRpb25zLm1heFBvb2xTaXplO1xuICB9XG5cbiAgLy8gVHJhbnNmb3JtIG9wdGlvbnMgbGlrZSBcInRsc0NBRmlsZUFzc2V0XCI6IFwiZmlsZW5hbWUucGVtXCIgaW50b1xuICAvLyBcInRsc0NBRmlsZVwiOiBcIi88ZnVsbHBhdGg+L2ZpbGVuYW1lLnBlbVwiXG4gIE9iamVjdC5lbnRyaWVzKG1vbmdvT3B0aW9ucyB8fCB7fSlcbiAgICAuZmlsdGVyKChba2V5XSkgPT4ga2V5ICYmIGtleS5lbmRzV2l0aChGSUxFX0FTU0VUX1NVRkZJWCkpXG4gICAgLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgY29uc3Qgb3B0aW9uTmFtZSA9IGtleS5yZXBsYWNlKEZJTEVfQVNTRVRfU1VGRklYLCAnJyk7XG4gICAgICBtb25nb09wdGlvbnNbb3B0aW9uTmFtZV0gPSBwYXRoLmpvaW4oQXNzZXRzLmdldFNlcnZlckRpcigpLFxuICAgICAgICBBU1NFVFNfRk9MREVSLCBBUFBfRk9MREVSLCB2YWx1ZSk7XG4gICAgICBkZWxldGUgbW9uZ29PcHRpb25zW2tleV07XG4gICAgfSk7XG5cbiAgc2VsZi5kYiA9IG51bGw7XG4gIHNlbGYuX29wbG9nSGFuZGxlID0gbnVsbDtcbiAgc2VsZi5fZG9jRmV0Y2hlciA9IG51bGw7XG5cbiAgc2VsZi5jbGllbnQgPSBuZXcgTW9uZ29EQi5Nb25nb0NsaWVudCh1cmwsIG1vbmdvT3B0aW9ucyk7XG4gIHNlbGYuZGIgPSBzZWxmLmNsaWVudC5kYigpO1xuXG4gIHNlbGYuY2xpZW50Lm9uKCdzZXJ2ZXJEZXNjcmlwdGlvbkNoYW5nZWQnLCBNZXRlb3IuYmluZEVudmlyb25tZW50KGV2ZW50ID0+IHtcbiAgICAvLyBXaGVuIHRoZSBjb25uZWN0aW9uIGlzIG5vIGxvbmdlciBhZ2FpbnN0IHRoZSBwcmltYXJ5IG5vZGUsIGV4ZWN1dGUgYWxsXG4gICAgLy8gZmFpbG92ZXIgaG9va3MuIFRoaXMgaXMgaW1wb3J0YW50IGZvciB0aGUgZHJpdmVyIGFzIGl0IGhhcyB0byByZS1wb29sIHRoZVxuICAgIC8vIHF1ZXJ5IHdoZW4gaXQgaGFwcGVucy5cbiAgICBpZiAoXG4gICAgICBldmVudC5wcmV2aW91c0Rlc2NyaXB0aW9uLnR5cGUgIT09ICdSU1ByaW1hcnknICYmXG4gICAgICBldmVudC5uZXdEZXNjcmlwdGlvbi50eXBlID09PSAnUlNQcmltYXJ5J1xuICAgICkge1xuICAgICAgc2VsZi5fb25GYWlsb3Zlckhvb2suZWFjaChjYWxsYmFjayA9PiB7XG4gICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSk7XG4gICAgfVxuICB9KSk7XG5cbiAgaWYgKG9wdGlvbnMub3Bsb2dVcmwgJiYgISBQYWNrYWdlWydkaXNhYmxlLW9wbG9nJ10pIHtcbiAgICBzZWxmLl9vcGxvZ0hhbmRsZSA9IG5ldyBPcGxvZ0hhbmRsZShvcHRpb25zLm9wbG9nVXJsLCBzZWxmLmRiLmRhdGFiYXNlTmFtZSk7XG4gICAgc2VsZi5fZG9jRmV0Y2hlciA9IG5ldyBEb2NGZXRjaGVyKHNlbGYpO1xuICB9XG5cbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX2Nsb3NlID0gYXN5bmMgZnVuY3Rpb24oKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoISBzZWxmLmRiKVxuICAgIHRocm93IEVycm9yKFwiY2xvc2UgY2FsbGVkIGJlZm9yZSBDb25uZWN0aW9uIGNyZWF0ZWQ/XCIpO1xuXG4gIC8vIFhYWCBwcm9iYWJseSB1bnRlc3RlZFxuICB2YXIgb3Bsb2dIYW5kbGUgPSBzZWxmLl9vcGxvZ0hhbmRsZTtcbiAgc2VsZi5fb3Bsb2dIYW5kbGUgPSBudWxsO1xuICBpZiAob3Bsb2dIYW5kbGUpXG4gICAgYXdhaXQgb3Bsb2dIYW5kbGUuc3RvcCgpO1xuXG4gIC8vIFVzZSBGdXR1cmUud3JhcCBzbyB0aGF0IGVycm9ycyBnZXQgdGhyb3duLiBUaGlzIGhhcHBlbnMgdG9cbiAgLy8gd29yayBldmVuIG91dHNpZGUgYSBmaWJlciBzaW5jZSB0aGUgJ2Nsb3NlJyBtZXRob2QgaXMgbm90XG4gIC8vIGFjdHVhbGx5IGFzeW5jaHJvbm91cy5cbiAgYXdhaXQgc2VsZi5jbGllbnQuY2xvc2UoKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLl9jbG9zZSgpO1xufTtcblxuLy8gUmV0dXJucyB0aGUgTW9uZ28gQ29sbGVjdGlvbiBvYmplY3Q7IG1heSB5aWVsZC5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUucmF3Q29sbGVjdGlvbiA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKCEgc2VsZi5kYilcbiAgICB0aHJvdyBFcnJvcihcInJhd0NvbGxlY3Rpb24gY2FsbGVkIGJlZm9yZSBDb25uZWN0aW9uIGNyZWF0ZWQ/XCIpO1xuXG4gIHJldHVybiBzZWxmLmRiLmNvbGxlY3Rpb24oY29sbGVjdGlvbk5hbWUpO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoXG4gICAgY29sbGVjdGlvbk5hbWUsIGJ5dGVTaXplLCBtYXhEb2N1bWVudHMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmICghIHNlbGYuZGIpXG4gICAgdGhyb3cgRXJyb3IoXCJjcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMgY2FsbGVkIGJlZm9yZSBDb25uZWN0aW9uIGNyZWF0ZWQ/XCIpO1xuXG5cbiAgYXdhaXQgc2VsZi5kYi5jcmVhdGVDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lLFxuICAgIHsgY2FwcGVkOiB0cnVlLCBzaXplOiBieXRlU2l6ZSwgbWF4OiBtYXhEb2N1bWVudHMgfSk7XG59O1xuXG4vLyBUaGlzIHNob3VsZCBiZSBjYWxsZWQgc3luY2hyb25vdXNseSB3aXRoIGEgd3JpdGUsIHRvIGNyZWF0ZSBhXG4vLyB0cmFuc2FjdGlvbiBvbiB0aGUgY3VycmVudCB3cml0ZSBmZW5jZSwgaWYgYW55LiBBZnRlciB3ZSBjYW4gcmVhZFxuLy8gdGhlIHdyaXRlLCBhbmQgYWZ0ZXIgb2JzZXJ2ZXJzIGhhdmUgYmVlbiBub3RpZmllZCAob3IgYXQgbGVhc3QsXG4vLyBhZnRlciB0aGUgb2JzZXJ2ZXIgbm90aWZpZXJzIGhhdmUgYWRkZWQgdGhlbXNlbHZlcyB0byB0aGUgd3JpdGVcbi8vIGZlbmNlKSwgeW91IHNob3VsZCBjYWxsICdjb21taXR0ZWQoKScgb24gdGhlIG9iamVjdCByZXR1cm5lZC5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX21heWJlQmVnaW5Xcml0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgY29uc3QgZmVuY2UgPSBERFBTZXJ2ZXIuX2dldEN1cnJlbnRGZW5jZSgpO1xuICBpZiAoZmVuY2UpIHtcbiAgICByZXR1cm4gZmVuY2UuYmVnaW5Xcml0ZSgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiB7Y29tbWl0dGVkOiBmdW5jdGlvbiAoKSB7fX07XG4gIH1cbn07XG5cbi8vIEludGVybmFsIGludGVyZmFjZTogYWRkcyBhIGNhbGxiYWNrIHdoaWNoIGlzIGNhbGxlZCB3aGVuIHRoZSBNb25nbyBwcmltYXJ5XG4vLyBjaGFuZ2VzLiBSZXR1cm5zIGEgc3RvcCBoYW5kbGUuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9vbkZhaWxvdmVyID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gIHJldHVybiB0aGlzLl9vbkZhaWxvdmVySG9vay5yZWdpc3RlcihjYWxsYmFjayk7XG59O1xuXG5cbi8vLy8vLy8vLy8vLyBQdWJsaWMgQVBJIC8vLy8vLy8vLy9cblxuLy8gVGhlIHdyaXRlIG1ldGhvZHMgYmxvY2sgdW50aWwgdGhlIGRhdGFiYXNlIGhhcyBjb25maXJtZWQgdGhlIHdyaXRlIChpdCBtYXlcbi8vIG5vdCBiZSByZXBsaWNhdGVkIG9yIHN0YWJsZSBvbiBkaXNrLCBidXQgb25lIHNlcnZlciBoYXMgY29uZmlybWVkIGl0KSBpZiBub1xuLy8gY2FsbGJhY2sgaXMgcHJvdmlkZWQuIElmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWQsIHRoZW4gdGhleSBjYWxsIHRoZSBjYWxsYmFja1xuLy8gd2hlbiB0aGUgd3JpdGUgaXMgY29uZmlybWVkLiBUaGV5IHJldHVybiBub3RoaW5nIG9uIHN1Y2Nlc3MsIGFuZCByYWlzZSBhblxuLy8gZXhjZXB0aW9uIG9uIGZhaWx1cmUuXG4vL1xuLy8gQWZ0ZXIgbWFraW5nIGEgd3JpdGUgKHdpdGggaW5zZXJ0LCB1cGRhdGUsIHJlbW92ZSksIG9ic2VydmVycyBhcmVcbi8vIG5vdGlmaWVkIGFzeW5jaHJvbm91c2x5LiBJZiB5b3Ugd2FudCB0byByZWNlaXZlIGEgY2FsbGJhY2sgb25jZSBhbGxcbi8vIG9mIHRoZSBvYnNlcnZlciBub3RpZmljYXRpb25zIGhhdmUgbGFuZGVkIGZvciB5b3VyIHdyaXRlLCBkbyB0aGVcbi8vIHdyaXRlcyBpbnNpZGUgYSB3cml0ZSBmZW5jZSAoc2V0IEREUFNlcnZlci5fQ3VycmVudFdyaXRlRmVuY2UgdG8gYSBuZXdcbi8vIF9Xcml0ZUZlbmNlLCBhbmQgdGhlbiBzZXQgYSBjYWxsYmFjayBvbiB0aGUgd3JpdGUgZmVuY2UuKVxuLy9cbi8vIFNpbmNlIG91ciBleGVjdXRpb24gZW52aXJvbm1lbnQgaXMgc2luZ2xlLXRocmVhZGVkLCB0aGlzIGlzXG4vLyB3ZWxsLWRlZmluZWQgLS0gYSB3cml0ZSBcImhhcyBiZWVuIG1hZGVcIiBpZiBpdCdzIHJldHVybmVkLCBhbmQgYW5cbi8vIG9ic2VydmVyIFwiaGFzIGJlZW4gbm90aWZpZWRcIiBpZiBpdHMgY2FsbGJhY2sgaGFzIHJldHVybmVkLlxuXG52YXIgd3JpdGVDYWxsYmFjayA9IGZ1bmN0aW9uICh3cml0ZSwgcmVmcmVzaCwgY2FsbGJhY2spIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChlcnIsIHJlc3VsdCkge1xuICAgIGlmICghIGVycikge1xuICAgICAgLy8gWFhYIFdlIGRvbid0IGhhdmUgdG8gcnVuIHRoaXMgb24gZXJyb3IsIHJpZ2h0P1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVmcmVzaCgpO1xuICAgICAgfSBjYXRjaCAocmVmcmVzaEVycikge1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICBjYWxsYmFjayhyZWZyZXNoRXJyKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgcmVmcmVzaEVycjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrKGVyciwgcmVzdWx0KTtcbiAgICB9IGVsc2UgaWYgKGVycikge1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgfTtcbn07XG5cbnZhciBiaW5kRW52aXJvbm1lbnRGb3JXcml0ZSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICByZXR1cm4gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChjYWxsYmFjaywgXCJNb25nbyB3cml0ZVwiKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuaW5zZXJ0QXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbl9uYW1lLCBkb2N1bWVudCkge1xuICBjb25zdCBzZWxmID0gdGhpcztcblxuICBpZiAoY29sbGVjdGlvbl9uYW1lID09PSBcIl9fX21ldGVvcl9mYWlsdXJlX3Rlc3RfY29sbGVjdGlvblwiKSB7XG4gICAgY29uc3QgZSA9IG5ldyBFcnJvcihcIkZhaWx1cmUgdGVzdFwiKTtcbiAgICBlLl9leHBlY3RlZEJ5VGVzdCA9IHRydWU7XG4gICAgdGhyb3cgZTtcbiAgfVxuXG4gIGlmICghKExvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdChkb2N1bWVudCkgJiZcbiAgICAgICAgIUVKU09OLl9pc0N1c3RvbVR5cGUoZG9jdW1lbnQpKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIk9ubHkgcGxhaW4gb2JqZWN0cyBtYXkgYmUgaW5zZXJ0ZWQgaW50byBNb25nb0RCXCIpO1xuICB9XG5cbiAgdmFyIHdyaXRlID0gc2VsZi5fbWF5YmVCZWdpbldyaXRlKCk7XG4gIHZhciByZWZyZXNoID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIGF3YWl0IE1ldGVvci5yZWZyZXNoKHtjb2xsZWN0aW9uOiBjb2xsZWN0aW9uX25hbWUsIGlkOiBkb2N1bWVudC5faWQgfSk7XG4gIH07XG4gIHJldHVybiBzZWxmLnJhd0NvbGxlY3Rpb24oY29sbGVjdGlvbl9uYW1lKS5pbnNlcnRPbmUoXG4gICAgcmVwbGFjZVR5cGVzKGRvY3VtZW50LCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksXG4gICAge1xuICAgICAgc2FmZTogdHJ1ZSxcbiAgICB9XG4gICkudGhlbihhc3luYyAoe2luc2VydGVkSWR9KSA9PiB7XG4gICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgIHJldHVybiBpbnNlcnRlZElkO1xuICB9KS5jYXRjaChhc3luYyBlID0+IHtcbiAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICB0aHJvdyBlO1xuICB9KTtcbn07XG5cblxuLy8gQ2F1c2UgcXVlcmllcyB0aGF0IG1heSBiZSBhZmZlY3RlZCBieSB0aGUgc2VsZWN0b3IgdG8gcG9sbCBpbiB0aGlzIHdyaXRlXG4vLyBmZW5jZS5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuX3JlZnJlc2ggPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yKSB7XG4gIHZhciByZWZyZXNoS2V5ID0ge2NvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lfTtcbiAgLy8gSWYgd2Uga25vdyB3aGljaCBkb2N1bWVudHMgd2UncmUgcmVtb3ZpbmcsIGRvbid0IHBvbGwgcXVlcmllcyB0aGF0IGFyZVxuICAvLyBzcGVjaWZpYyB0byBvdGhlciBkb2N1bWVudHMuIChOb3RlIHRoYXQgbXVsdGlwbGUgbm90aWZpY2F0aW9ucyBoZXJlIHNob3VsZFxuICAvLyBub3QgY2F1c2UgbXVsdGlwbGUgcG9sbHMsIHNpbmNlIGFsbCBvdXIgbGlzdGVuZXIgaXMgZG9pbmcgaXMgZW5xdWV1ZWluZyBhXG4gIC8vIHBvbGwuKVxuICB2YXIgc3BlY2lmaWNJZHMgPSBMb2NhbENvbGxlY3Rpb24uX2lkc01hdGNoZWRCeVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgaWYgKHNwZWNpZmljSWRzKSB7XG4gICAgZm9yIChjb25zdCBpZCBvZiBzcGVjaWZpY0lkcykge1xuICAgICAgYXdhaXQgTWV0ZW9yLnJlZnJlc2goXy5leHRlbmQoe2lkOiBpZH0sIHJlZnJlc2hLZXkpKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgYXdhaXQgTWV0ZW9yLnJlZnJlc2gocmVmcmVzaEtleSk7XG4gIH1cbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUucmVtb3ZlQXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbl9uYW1lLCBzZWxlY3Rvcikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKGNvbGxlY3Rpb25fbmFtZSA9PT0gXCJfX19tZXRlb3JfZmFpbHVyZV90ZXN0X2NvbGxlY3Rpb25cIikge1xuICAgIHZhciBlID0gbmV3IEVycm9yKFwiRmFpbHVyZSB0ZXN0XCIpO1xuICAgIGUuX2V4cGVjdGVkQnlUZXN0ID0gdHJ1ZTtcbiAgICB0aHJvdyBlO1xuICB9XG5cbiAgdmFyIHdyaXRlID0gc2VsZi5fbWF5YmVCZWdpbldyaXRlKCk7XG4gIHZhciByZWZyZXNoID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIGF3YWl0IHNlbGYuX3JlZnJlc2goY29sbGVjdGlvbl9uYW1lLCBzZWxlY3Rvcik7XG4gIH07XG5cbiAgcmV0dXJuIHNlbGYucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uX25hbWUpXG4gICAgLmRlbGV0ZU1hbnkocmVwbGFjZVR5cGVzKHNlbGVjdG9yLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyksIHtcbiAgICAgIHNhZmU6IHRydWUsXG4gICAgfSlcbiAgICAudGhlbihhc3luYyAoeyBkZWxldGVkQ291bnQgfSkgPT4ge1xuICAgICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICByZXR1cm4gdHJhbnNmb3JtUmVzdWx0KHsgcmVzdWx0IDoge21vZGlmaWVkQ291bnQgOiBkZWxldGVkQ291bnR9IH0pLm51bWJlckFmZmVjdGVkO1xuICAgIH0pLmNhdGNoKGFzeW5jIChlcnIpID0+IHtcbiAgICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZHJvcENvbGxlY3Rpb25Bc3luYyA9IGFzeW5jIGZ1bmN0aW9uKGNvbGxlY3Rpb25OYW1lKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuXG4gIHZhciB3cml0ZSA9IHNlbGYuX21heWJlQmVnaW5Xcml0ZSgpO1xuICB2YXIgcmVmcmVzaCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBNZXRlb3IucmVmcmVzaCh7XG4gICAgICBjb2xsZWN0aW9uOiBjb2xsZWN0aW9uTmFtZSxcbiAgICAgIGlkOiBudWxsLFxuICAgICAgZHJvcENvbGxlY3Rpb246IHRydWUsXG4gICAgfSk7XG4gIH07XG5cbiAgcmV0dXJuIHNlbGZcbiAgICAucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZSlcbiAgICAuZHJvcCgpXG4gICAgLnRoZW4oYXN5bmMgcmVzdWx0ID0+IHtcbiAgICAgIGF3YWl0IHJlZnJlc2goKTtcbiAgICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9KVxuICAgIC5jYXRjaChhc3luYyBlID0+IHtcbiAgICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9KTtcbn07XG5cbi8vIEZvciB0ZXN0aW5nIG9ubHkuICBTbGlnaHRseSBiZXR0ZXIgdGhhbiBgYy5yYXdEYXRhYmFzZSgpLmRyb3BEYXRhYmFzZSgpYFxuLy8gYmVjYXVzZSBpdCBsZXRzIHRoZSB0ZXN0J3MgZmVuY2Ugd2FpdCBmb3IgaXQgdG8gYmUgY29tcGxldGUuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmRyb3BEYXRhYmFzZUFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIHdyaXRlID0gc2VsZi5fbWF5YmVCZWdpbldyaXRlKCk7XG4gIHZhciByZWZyZXNoID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIGF3YWl0IE1ldGVvci5yZWZyZXNoKHsgZHJvcERhdGFiYXNlOiB0cnVlIH0pO1xuICB9O1xuXG4gIHRyeSB7XG4gICAgYXdhaXQgc2VsZi5kYi5fZHJvcERhdGFiYXNlKCk7XG4gICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgdGhyb3cgZTtcbiAgfVxufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS51cGRhdGVBc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uX25hbWUsIHNlbGVjdG9yLCBtb2QsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmIChjb2xsZWN0aW9uX25hbWUgPT09IFwiX19fbWV0ZW9yX2ZhaWx1cmVfdGVzdF9jb2xsZWN0aW9uXCIpIHtcbiAgICB2YXIgZSA9IG5ldyBFcnJvcihcIkZhaWx1cmUgdGVzdFwiKTtcbiAgICBlLl9leHBlY3RlZEJ5VGVzdCA9IHRydWU7XG4gICAgdGhyb3cgZTtcbiAgfVxuXG4gIC8vIGV4cGxpY2l0IHNhZmV0eSBjaGVjay4gbnVsbCBhbmQgdW5kZWZpbmVkIGNhbiBjcmFzaCB0aGUgbW9uZ29cbiAgLy8gZHJpdmVyLiBBbHRob3VnaCB0aGUgbm9kZSBkcml2ZXIgYW5kIG1pbmltb25nbyBkbyAnc3VwcG9ydCdcbiAgLy8gbm9uLW9iamVjdCBtb2RpZmllciBpbiB0aGF0IHRoZXkgZG9uJ3QgY3Jhc2gsIHRoZXkgYXJlIG5vdFxuICAvLyBtZWFuaW5nZnVsIG9wZXJhdGlvbnMgYW5kIGRvIG5vdCBkbyBhbnl0aGluZy4gRGVmZW5zaXZlbHkgdGhyb3cgYW5cbiAgLy8gZXJyb3IgaGVyZS5cbiAgaWYgKCFtb2QgfHwgdHlwZW9mIG1vZCAhPT0gJ29iamVjdCcpIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihcIkludmFsaWQgbW9kaWZpZXIuIE1vZGlmaWVyIG11c3QgYmUgYW4gb2JqZWN0LlwiKTtcblxuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgaWYgKCEoTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KG1vZCkgJiYgIUVKU09OLl9pc0N1c3RvbVR5cGUobW9kKSkpIHtcbiAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihcbiAgICAgICAgXCJPbmx5IHBsYWluIG9iamVjdHMgbWF5IGJlIHVzZWQgYXMgcmVwbGFjZW1lbnRcIiArXG4gICAgICAgIFwiIGRvY3VtZW50cyBpbiBNb25nb0RCXCIpO1xuXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBpZiAoIW9wdGlvbnMpIG9wdGlvbnMgPSB7fTtcblxuICB2YXIgd3JpdGUgPSBzZWxmLl9tYXliZUJlZ2luV3JpdGUoKTtcbiAgdmFyIHJlZnJlc2ggPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgYXdhaXQgc2VsZi5fcmVmcmVzaChjb2xsZWN0aW9uX25hbWUsIHNlbGVjdG9yKTtcbiAgfTtcblxuICB2YXIgY29sbGVjdGlvbiA9IHNlbGYucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uX25hbWUpO1xuICB2YXIgbW9uZ29PcHRzID0ge3NhZmU6IHRydWV9O1xuICAvLyBBZGQgc3VwcG9ydCBmb3IgZmlsdGVyZWQgcG9zaXRpb25hbCBvcGVyYXRvclxuICBpZiAob3B0aW9ucy5hcnJheUZpbHRlcnMgIT09IHVuZGVmaW5lZCkgbW9uZ29PcHRzLmFycmF5RmlsdGVycyA9IG9wdGlvbnMuYXJyYXlGaWx0ZXJzO1xuICAvLyBleHBsaWN0bHkgZW51bWVyYXRlIG9wdGlvbnMgdGhhdCBtaW5pbW9uZ28gc3VwcG9ydHNcbiAgaWYgKG9wdGlvbnMudXBzZXJ0KSBtb25nb09wdHMudXBzZXJ0ID0gdHJ1ZTtcbiAgaWYgKG9wdGlvbnMubXVsdGkpIG1vbmdvT3B0cy5tdWx0aSA9IHRydWU7XG4gIC8vIExldHMgeW91IGdldCBhIG1vcmUgbW9yZSBmdWxsIHJlc3VsdCBmcm9tIE1vbmdvREIuIFVzZSB3aXRoIGNhdXRpb246XG4gIC8vIG1pZ2h0IG5vdCB3b3JrIHdpdGggQy51cHNlcnQgKGFzIG9wcG9zZWQgdG8gQy51cGRhdGUoe3Vwc2VydDp0cnVlfSkgb3JcbiAgLy8gd2l0aCBzaW11bGF0ZWQgdXBzZXJ0LlxuICBpZiAob3B0aW9ucy5mdWxsUmVzdWx0KSBtb25nb09wdHMuZnVsbFJlc3VsdCA9IHRydWU7XG5cbiAgdmFyIG1vbmdvU2VsZWN0b3IgPSByZXBsYWNlVHlwZXMoc2VsZWN0b3IsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKTtcbiAgdmFyIG1vbmdvTW9kID0gcmVwbGFjZVR5cGVzKG1vZCwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pO1xuXG4gIHZhciBpc01vZGlmeSA9IExvY2FsQ29sbGVjdGlvbi5faXNNb2RpZmljYXRpb25Nb2QobW9uZ29Nb2QpO1xuXG4gIGlmIChvcHRpb25zLl9mb3JiaWRSZXBsYWNlICYmICFpc01vZGlmeSkge1xuICAgIHZhciBlcnIgPSBuZXcgRXJyb3IoXCJJbnZhbGlkIG1vZGlmaWVyLiBSZXBsYWNlbWVudHMgYXJlIGZvcmJpZGRlbi5cIik7XG4gICAgdGhyb3cgZXJyO1xuICB9XG5cbiAgLy8gV2UndmUgYWxyZWFkeSBydW4gcmVwbGFjZVR5cGVzL3JlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvIG9uXG4gIC8vIHNlbGVjdG9yIGFuZCBtb2QuICBXZSBhc3N1bWUgaXQgZG9lc24ndCBtYXR0ZXIsIGFzIGZhciBhc1xuICAvLyB0aGUgYmVoYXZpb3Igb2YgbW9kaWZpZXJzIGlzIGNvbmNlcm5lZCwgd2hldGhlciBgX21vZGlmeWBcbiAgLy8gaXMgcnVuIG9uIEVKU09OIG9yIG9uIG1vbmdvLWNvbnZlcnRlZCBFSlNPTi5cblxuICAvLyBSdW4gdGhpcyBjb2RlIHVwIGZyb250IHNvIHRoYXQgaXQgZmFpbHMgZmFzdCBpZiBzb21lb25lIHVzZXNcbiAgLy8gYSBNb25nbyB1cGRhdGUgb3BlcmF0b3Igd2UgZG9uJ3Qgc3VwcG9ydC5cbiAgbGV0IGtub3duSWQ7XG4gIGlmIChvcHRpb25zLnVwc2VydCkge1xuICAgIHRyeSB7XG4gICAgICBsZXQgbmV3RG9jID0gTG9jYWxDb2xsZWN0aW9uLl9jcmVhdGVVcHNlcnREb2N1bWVudChzZWxlY3RvciwgbW9kKTtcbiAgICAgIGtub3duSWQgPSBuZXdEb2MuX2lkO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgfVxuICBpZiAob3B0aW9ucy51cHNlcnQgJiZcbiAgICAgICEgaXNNb2RpZnkgJiZcbiAgICAgICEga25vd25JZCAmJlxuICAgICAgb3B0aW9ucy5pbnNlcnRlZElkICYmXG4gICAgICAhIChvcHRpb25zLmluc2VydGVkSWQgaW5zdGFuY2VvZiBNb25nby5PYmplY3RJRCAmJlxuICAgICAgICAgb3B0aW9ucy5nZW5lcmF0ZWRJZCkpIHtcbiAgICAvLyBJbiBjYXNlIG9mIGFuIHVwc2VydCB3aXRoIGEgcmVwbGFjZW1lbnQsIHdoZXJlIHRoZXJlIGlzIG5vIF9pZCBkZWZpbmVkXG4gICAgLy8gaW4gZWl0aGVyIHRoZSBxdWVyeSBvciB0aGUgcmVwbGFjZW1lbnQgZG9jLCBtb25nbyB3aWxsIGdlbmVyYXRlIGFuIGlkIGl0c2VsZi5cbiAgICAvLyBUaGVyZWZvcmUgd2UgbmVlZCB0aGlzIHNwZWNpYWwgc3RyYXRlZ3kgaWYgd2Ugd2FudCB0byBjb250cm9sIHRoZSBpZCBvdXJzZWx2ZXMuXG5cbiAgICAvLyBXZSBkb24ndCBuZWVkIHRvIGRvIHRoaXMgd2hlbjpcbiAgICAvLyAtIFRoaXMgaXMgbm90IGEgcmVwbGFjZW1lbnQsIHNvIHdlIGNhbiBhZGQgYW4gX2lkIHRvICRzZXRPbkluc2VydFxuICAgIC8vIC0gVGhlIGlkIGlzIGRlZmluZWQgYnkgcXVlcnkgb3IgbW9kIHdlIGNhbiBqdXN0IGFkZCBpdCB0byB0aGUgcmVwbGFjZW1lbnQgZG9jXG4gICAgLy8gLSBUaGUgdXNlciBkaWQgbm90IHNwZWNpZnkgYW55IGlkIHByZWZlcmVuY2UgYW5kIHRoZSBpZCBpcyBhIE1vbmdvIE9iamVjdElkLFxuICAgIC8vICAgICB0aGVuIHdlIGNhbiBqdXN0IGxldCBNb25nbyBnZW5lcmF0ZSB0aGUgaWRcbiAgICByZXR1cm4gYXdhaXQgc2ltdWxhdGVVcHNlcnRXaXRoSW5zZXJ0ZWRJZChjb2xsZWN0aW9uLCBtb25nb1NlbGVjdG9yLCBtb25nb01vZCwgb3B0aW9ucylcbiAgICAgICAgLnRoZW4oYXN5bmMgcmVzdWx0ID0+IHtcbiAgICAgICAgICBhd2FpdCByZWZyZXNoKCk7XG4gICAgICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICAgICAgaWYgKHJlc3VsdCAmJiAhIG9wdGlvbnMuX3JldHVybk9iamVjdCkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5udW1iZXJBZmZlY3RlZDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGlmIChvcHRpb25zLnVwc2VydCAmJiAha25vd25JZCAmJiBvcHRpb25zLmluc2VydGVkSWQgJiYgaXNNb2RpZnkpIHtcbiAgICAgIGlmICghbW9uZ29Nb2QuaGFzT3duUHJvcGVydHkoJyRzZXRPbkluc2VydCcpKSB7XG4gICAgICAgIG1vbmdvTW9kLiRzZXRPbkluc2VydCA9IHt9O1xuICAgICAgfVxuICAgICAga25vd25JZCA9IG9wdGlvbnMuaW5zZXJ0ZWRJZDtcbiAgICAgIE9iamVjdC5hc3NpZ24obW9uZ29Nb2QuJHNldE9uSW5zZXJ0LCByZXBsYWNlVHlwZXMoe19pZDogb3B0aW9ucy5pbnNlcnRlZElkfSwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pKTtcbiAgICB9XG5cbiAgICBjb25zdCBzdHJpbmdzID0gT2JqZWN0LmtleXMobW9uZ29Nb2QpLmZpbHRlcigoa2V5KSA9PiAha2V5LnN0YXJ0c1dpdGgoXCIkXCIpKTtcbiAgICBsZXQgdXBkYXRlTWV0aG9kID0gc3RyaW5ncy5sZW5ndGggPiAwID8gJ3JlcGxhY2VPbmUnIDogJ3VwZGF0ZU1hbnknO1xuICAgIHVwZGF0ZU1ldGhvZCA9XG4gICAgICAgIHVwZGF0ZU1ldGhvZCA9PT0gJ3VwZGF0ZU1hbnknICYmICFtb25nb09wdHMubXVsdGlcbiAgICAgICAgICAgID8gJ3VwZGF0ZU9uZSdcbiAgICAgICAgICAgIDogdXBkYXRlTWV0aG9kO1xuICAgIHJldHVybiBjb2xsZWN0aW9uW3VwZGF0ZU1ldGhvZF1cbiAgICAgICAgLmJpbmQoY29sbGVjdGlvbikobW9uZ29TZWxlY3RvciwgbW9uZ29Nb2QsIG1vbmdvT3B0cylcbiAgICAgICAgLnRoZW4oYXN5bmMgcmVzdWx0ID0+IHtcbiAgICAgICAgICB2YXIgbWV0ZW9yUmVzdWx0ID0gdHJhbnNmb3JtUmVzdWx0KHtyZXN1bHR9KTtcbiAgICAgICAgICBpZiAobWV0ZW9yUmVzdWx0ICYmIG9wdGlvbnMuX3JldHVybk9iamVjdCkge1xuICAgICAgICAgICAgLy8gSWYgdGhpcyB3YXMgYW4gdXBzZXJ0QXN5bmMoKSBjYWxsLCBhbmQgd2UgZW5kZWQgdXBcbiAgICAgICAgICAgIC8vIGluc2VydGluZyBhIG5ldyBkb2MgYW5kIHdlIGtub3cgaXRzIGlkLCB0aGVuXG4gICAgICAgICAgICAvLyByZXR1cm4gdGhhdCBpZCBhcyB3ZWxsLlxuICAgICAgICAgICAgaWYgKG9wdGlvbnMudXBzZXJ0ICYmIG1ldGVvclJlc3VsdC5pbnNlcnRlZElkKSB7XG4gICAgICAgICAgICAgIGlmIChrbm93bklkKSB7XG4gICAgICAgICAgICAgICAgbWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQgPSBrbm93bklkO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1ldGVvclJlc3VsdC5pbnNlcnRlZElkIGluc3RhbmNlb2YgTW9uZ29EQi5PYmplY3RJRCkge1xuICAgICAgICAgICAgICAgIG1ldGVvclJlc3VsdC5pbnNlcnRlZElkID0gbmV3IE1vbmdvLk9iamVjdElEKG1ldGVvclJlc3VsdC5pbnNlcnRlZElkLnRvSGV4U3RyaW5nKCkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhd2FpdCByZWZyZXNoKCk7XG4gICAgICAgICAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICAgICAgICAgIHJldHVybiBtZXRlb3JSZXN1bHQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGF3YWl0IHJlZnJlc2goKTtcbiAgICAgICAgICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgICAgICAgICAgcmV0dXJuIG1ldGVvclJlc3VsdC5udW1iZXJBZmZlY3RlZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLmNhdGNoKGFzeW5jIChlcnIpID0+IHtcbiAgICAgICAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0pO1xuICB9XG59O1xuXG52YXIgdHJhbnNmb3JtUmVzdWx0ID0gZnVuY3Rpb24gKGRyaXZlclJlc3VsdCkge1xuICB2YXIgbWV0ZW9yUmVzdWx0ID0geyBudW1iZXJBZmZlY3RlZDogMCB9O1xuICBpZiAoZHJpdmVyUmVzdWx0KSB7XG4gICAgdmFyIG1vbmdvUmVzdWx0ID0gZHJpdmVyUmVzdWx0LnJlc3VsdDtcbiAgICAvLyBPbiB1cGRhdGVzIHdpdGggdXBzZXJ0OnRydWUsIHRoZSBpbnNlcnRlZCB2YWx1ZXMgY29tZSBhcyBhIGxpc3Qgb2ZcbiAgICAvLyB1cHNlcnRlZCB2YWx1ZXMgLS0gZXZlbiB3aXRoIG9wdGlvbnMubXVsdGksIHdoZW4gdGhlIHVwc2VydCBkb2VzIGluc2VydCxcbiAgICAvLyBpdCBvbmx5IGluc2VydHMgb25lIGVsZW1lbnQuXG4gICAgaWYgKG1vbmdvUmVzdWx0LnVwc2VydGVkQ291bnQpIHtcbiAgICAgIG1ldGVvclJlc3VsdC5udW1iZXJBZmZlY3RlZCA9IG1vbmdvUmVzdWx0LnVwc2VydGVkQ291bnQ7XG5cbiAgICAgIGlmIChtb25nb1Jlc3VsdC51cHNlcnRlZElkKSB7XG4gICAgICAgIG1ldGVvclJlc3VsdC5pbnNlcnRlZElkID0gbW9uZ29SZXN1bHQudXBzZXJ0ZWRJZDtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbiB3YXMgdXNlZCBiZWZvcmUgTW9uZ28gNS4wLCBpbiBNb25nbyA1LjAgd2UgYXJlIG5vdCByZWNlaXZpbmcgdGhpcyBuXG4gICAgICAvLyBmaWVsZCBhbmQgc28gd2UgYXJlIHVzaW5nIG1vZGlmaWVkQ291bnQgaW5zdGVhZFxuICAgICAgbWV0ZW9yUmVzdWx0Lm51bWJlckFmZmVjdGVkID0gbW9uZ29SZXN1bHQubiB8fCBtb25nb1Jlc3VsdC5tYXRjaGVkQ291bnQgfHwgbW9uZ29SZXN1bHQubW9kaWZpZWRDb3VudDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWV0ZW9yUmVzdWx0O1xufTtcblxuXG52YXIgTlVNX09QVElNSVNUSUNfVFJJRVMgPSAzO1xuXG4vLyBleHBvc2VkIGZvciB0ZXN0aW5nXG5Nb25nb0Nvbm5lY3Rpb24uX2lzQ2Fubm90Q2hhbmdlSWRFcnJvciA9IGZ1bmN0aW9uIChlcnIpIHtcblxuICAvLyBNb25nbyAzLjIuKiByZXR1cm5zIGVycm9yIGFzIG5leHQgT2JqZWN0OlxuICAvLyB7bmFtZTogU3RyaW5nLCBjb2RlOiBOdW1iZXIsIGVycm1zZzogU3RyaW5nfVxuICAvLyBPbGRlciBNb25nbyByZXR1cm5zOlxuICAvLyB7bmFtZTogU3RyaW5nLCBjb2RlOiBOdW1iZXIsIGVycjogU3RyaW5nfVxuICB2YXIgZXJyb3IgPSBlcnIuZXJybXNnIHx8IGVyci5lcnI7XG5cbiAgLy8gV2UgZG9uJ3QgdXNlIHRoZSBlcnJvciBjb2RlIGhlcmVcbiAgLy8gYmVjYXVzZSB0aGUgZXJyb3IgY29kZSB3ZSBvYnNlcnZlZCBpdCBwcm9kdWNpbmcgKDE2ODM3KSBhcHBlYXJzIHRvIGJlXG4gIC8vIGEgZmFyIG1vcmUgZ2VuZXJpYyBlcnJvciBjb2RlIGJhc2VkIG9uIGV4YW1pbmluZyB0aGUgc291cmNlLlxuICBpZiAoZXJyb3IuaW5kZXhPZignVGhlIF9pZCBmaWVsZCBjYW5ub3QgYmUgY2hhbmdlZCcpID09PSAwXG4gICAgfHwgZXJyb3IuaW5kZXhPZihcInRoZSAoaW1tdXRhYmxlKSBmaWVsZCAnX2lkJyB3YXMgZm91bmQgdG8gaGF2ZSBiZWVuIGFsdGVyZWQgdG8gX2lkXCIpICE9PSAtMSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufTtcblxudmFyIHNpbXVsYXRlVXBzZXJ0V2l0aEluc2VydGVkSWQgPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbiwgc2VsZWN0b3IsIG1vZCwgb3B0aW9ucykge1xuICAvLyBTVFJBVEVHWTogRmlyc3QgdHJ5IGRvaW5nIGFuIHVwc2VydCB3aXRoIGEgZ2VuZXJhdGVkIElELlxuICAvLyBJZiB0aGlzIHRocm93cyBhbiBlcnJvciBhYm91dCBjaGFuZ2luZyB0aGUgSUQgb24gYW4gZXhpc3RpbmcgZG9jdW1lbnRcbiAgLy8gdGhlbiB3aXRob3V0IGFmZmVjdGluZyB0aGUgZGF0YWJhc2UsIHdlIGtub3cgd2Ugc2hvdWxkIHByb2JhYmx5IHRyeVxuICAvLyBhbiB1cGRhdGUgd2l0aG91dCB0aGUgZ2VuZXJhdGVkIElELiBJZiBpdCBhZmZlY3RlZCAwIGRvY3VtZW50cyxcbiAgLy8gdGhlbiB3aXRob3V0IGFmZmVjdGluZyB0aGUgZGF0YWJhc2UsIHdlIHRoZSBkb2N1bWVudCB0aGF0IGZpcnN0XG4gIC8vIGdhdmUgdGhlIGVycm9yIGlzIHByb2JhYmx5IHJlbW92ZWQgYW5kIHdlIG5lZWQgdG8gdHJ5IGFuIGluc2VydCBhZ2FpblxuICAvLyBXZSBnbyBiYWNrIHRvIHN0ZXAgb25lIGFuZCByZXBlYXQuXG4gIC8vIExpa2UgYWxsIFwib3B0aW1pc3RpYyB3cml0ZVwiIHNjaGVtZXMsIHdlIHJlbHkgb24gdGhlIGZhY3QgdGhhdCBpdCdzXG4gIC8vIHVubGlrZWx5IG91ciB3cml0ZXMgd2lsbCBjb250aW51ZSB0byBiZSBpbnRlcmZlcmVkIHdpdGggdW5kZXIgbm9ybWFsXG4gIC8vIGNpcmN1bXN0YW5jZXMgKHRob3VnaCBzdWZmaWNpZW50bHkgaGVhdnkgY29udGVudGlvbiB3aXRoIHdyaXRlcnNcbiAgLy8gZGlzYWdyZWVpbmcgb24gdGhlIGV4aXN0ZW5jZSBvZiBhbiBvYmplY3Qgd2lsbCBjYXVzZSB3cml0ZXMgdG8gZmFpbFxuICAvLyBpbiB0aGVvcnkpLlxuXG4gIHZhciBpbnNlcnRlZElkID0gb3B0aW9ucy5pbnNlcnRlZElkOyAvLyBtdXN0IGV4aXN0XG4gIHZhciBtb25nb09wdHNGb3JVcGRhdGUgPSB7XG4gICAgc2FmZTogdHJ1ZSxcbiAgICBtdWx0aTogb3B0aW9ucy5tdWx0aVxuICB9O1xuICB2YXIgbW9uZ29PcHRzRm9ySW5zZXJ0ID0ge1xuICAgIHNhZmU6IHRydWUsXG4gICAgdXBzZXJ0OiB0cnVlXG4gIH07XG5cbiAgdmFyIHJlcGxhY2VtZW50V2l0aElkID0gT2JqZWN0LmFzc2lnbihcbiAgICByZXBsYWNlVHlwZXMoe19pZDogaW5zZXJ0ZWRJZH0sIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICBtb2QpO1xuXG4gIHZhciB0cmllcyA9IE5VTV9PUFRJTUlTVElDX1RSSUVTO1xuXG4gIHZhciBkb1VwZGF0ZSA9IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICB0cmllcy0tO1xuICAgIGlmICghIHRyaWVzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVcHNlcnQgZmFpbGVkIGFmdGVyIFwiICsgTlVNX09QVElNSVNUSUNfVFJJRVMgKyBcIiB0cmllcy5cIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBtZXRob2QgPSBjb2xsZWN0aW9uLnVwZGF0ZU1hbnk7XG4gICAgICBpZighT2JqZWN0LmtleXMobW9kKS5zb21lKGtleSA9PiBrZXkuc3RhcnRzV2l0aChcIiRcIikpKXtcbiAgICAgICAgbWV0aG9kID0gY29sbGVjdGlvbi5yZXBsYWNlT25lLmJpbmQoY29sbGVjdGlvbik7XG4gICAgICB9XG4gICAgICByZXR1cm4gbWV0aG9kKFxuICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgbW9kLFxuICAgICAgICBtb25nb09wdHNGb3JVcGRhdGUpLnRoZW4ocmVzdWx0ID0+IHtcbiAgICAgICAgaWYgKHJlc3VsdCAmJiAocmVzdWx0Lm1vZGlmaWVkQ291bnQgfHwgcmVzdWx0LnVwc2VydGVkQ291bnQpKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG51bWJlckFmZmVjdGVkOiByZXN1bHQubW9kaWZpZWRDb3VudCB8fCByZXN1bHQudXBzZXJ0ZWRDb3VudCxcbiAgICAgICAgICAgIGluc2VydGVkSWQ6IHJlc3VsdC51cHNlcnRlZElkIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBkb0NvbmRpdGlvbmFsSW5zZXJ0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcblxuICB2YXIgZG9Db25kaXRpb25hbEluc2VydCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBjb2xsZWN0aW9uLnJlcGxhY2VPbmUoc2VsZWN0b3IsIHJlcGxhY2VtZW50V2l0aElkLCBtb25nb09wdHNGb3JJbnNlcnQpXG4gICAgICAgIC50aGVuKHJlc3VsdCA9PiAoe1xuICAgICAgICAgICAgbnVtYmVyQWZmZWN0ZWQ6IHJlc3VsdC51cHNlcnRlZENvdW50LFxuICAgICAgICAgICAgaW5zZXJ0ZWRJZDogcmVzdWx0LnVwc2VydGVkSWQsXG4gICAgICAgICAgfSkpLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIGlmIChNb25nb0Nvbm5lY3Rpb24uX2lzQ2Fubm90Q2hhbmdlSWRFcnJvcihlcnIpKSB7XG4gICAgICAgICAgcmV0dXJuIGRvVXBkYXRlKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICB9O1xuICByZXR1cm4gZG9VcGRhdGUoKTtcbn07XG5cblxuLy8gWFhYIE1vbmdvQ29ubmVjdGlvbi51cHNlcnRBc3luYygpIGRvZXMgbm90IHJldHVybiB0aGUgaWQgb2YgdGhlIGluc2VydGVkIGRvY3VtZW50XG4vLyB1bmxlc3MgeW91IHNldCBpdCBleHBsaWNpdGx5IGluIHRoZSBzZWxlY3RvciBvciBtb2RpZmllciAoYXMgYSByZXBsYWNlbWVudFxuLy8gZG9jKS5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUudXBzZXJ0QXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yLCBtb2QsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHJldHVybiBzZWxmLnVwZGF0ZUFzeW5jKGNvbGxlY3Rpb25OYW1lLCBzZWxlY3RvciwgbW9kLFxuICAgICAgICAgICAgICAgICAgICAgXy5leHRlbmQoe30sIG9wdGlvbnMsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgdXBzZXJ0OiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICAgICBfcmV0dXJuT2JqZWN0OiB0cnVlXG4gICAgICAgICAgICAgICAgICAgICB9KSk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSlcbiAgICBzZWxlY3RvciA9IHt9O1xuXG4gIHJldHVybiBuZXcgQ3Vyc29yKFxuICAgIHNlbGYsIG5ldyBDdXJzb3JEZXNjcmlwdGlvbihjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IsIG9wdGlvbnMpKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZmluZE9uZUFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKGNvbGxlY3Rpb25fbmFtZSwgc2VsZWN0b3IsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgIHNlbGVjdG9yID0ge307XG4gIH1cblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgb3B0aW9ucy5saW1pdCA9IDE7XG5cbiAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IHNlbGYuZmluZChjb2xsZWN0aW9uX25hbWUsIHNlbGVjdG9yLCBvcHRpb25zKS5mZXRjaCgpO1xuXG4gIHJldHVybiByZXN1bHRzWzBdO1xufTtcblxuLy8gV2UnbGwgYWN0dWFsbHkgZGVzaWduIGFuIGluZGV4IEFQSSBsYXRlci4gRm9yIG5vdywgd2UganVzdCBwYXNzIHRocm91Z2ggdG9cbi8vIE1vbmdvJ3MsIGJ1dCBtYWtlIGl0IHN5bmNocm9ub3VzLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVJbmRleEFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBpbmRleCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIFdlIGV4cGVjdCB0aGlzIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBhdCBzdGFydHVwLCBub3QgZnJvbSB3aXRoaW4gYSBtZXRob2QsXG4gIC8vIHNvIHdlIGRvbid0IGludGVyYWN0IHdpdGggdGhlIHdyaXRlIGZlbmNlLlxuICB2YXIgY29sbGVjdGlvbiA9IHNlbGYucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZSk7XG4gIGF3YWl0IGNvbGxlY3Rpb24uY3JlYXRlSW5kZXgoaW5kZXgsIG9wdGlvbnMpO1xufTtcblxuLy8ganVzdCB0byBiZSBjb25zaXN0ZW50IHdpdGggdGhlIG90aGVyIG1ldGhvZHNcbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuY3JlYXRlSW5kZXggPVxuICBNb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNyZWF0ZUluZGV4QXN5bmM7XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuY291bnREb2N1bWVudHMgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIC4uLmFyZ3MpIHtcbiAgYXJncyA9IGFyZ3MubWFwKGFyZyA9PiByZXBsYWNlVHlwZXMoYXJnLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbykpO1xuICBjb25zdCBjb2xsZWN0aW9uID0gdGhpcy5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKTtcbiAgcmV0dXJuIGNvbGxlY3Rpb24uY291bnREb2N1bWVudHMoLi4uYXJncyk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmVzdGltYXRlZERvY3VtZW50Q291bnQgPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIC4uLmFyZ3MpIHtcbiAgYXJncyA9IGFyZ3MubWFwKGFyZyA9PiByZXBsYWNlVHlwZXMoYXJnLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbykpO1xuICBjb25zdCBjb2xsZWN0aW9uID0gdGhpcy5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKTtcbiAgcmV0dXJuIGNvbGxlY3Rpb24uZXN0aW1hdGVkRG9jdW1lbnRDb3VudCguLi5hcmdzKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZW5zdXJlSW5kZXhBc3luYyA9IE1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuY3JlYXRlSW5kZXhBc3luYztcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5kcm9wSW5kZXhBc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgaW5kZXgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cbiAgLy8gVGhpcyBmdW5jdGlvbiBpcyBvbmx5IHVzZWQgYnkgdGVzdCBjb2RlLCBub3Qgd2l0aGluIGEgbWV0aG9kLCBzbyB3ZSBkb24ndFxuICAvLyBpbnRlcmFjdCB3aXRoIHRoZSB3cml0ZSBmZW5jZS5cbiAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLnJhd0NvbGxlY3Rpb24oY29sbGVjdGlvbk5hbWUpO1xuICB2YXIgaW5kZXhOYW1lID0gIGF3YWl0IGNvbGxlY3Rpb24uZHJvcEluZGV4KGluZGV4KTtcbn07XG5cblxuQ0xJRU5UX09OTFlfTUVUSE9EUy5mb3JFYWNoKGZ1bmN0aW9uIChtKSB7XG4gIE1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGVbbV0gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYCR7bX0gKyAgaXMgbm90IGF2YWlsYWJsZSBvbiB0aGUgc2VydmVyLiBQbGVhc2UgdXNlICR7Z2V0QXN5bmNNZXRob2ROYW1lKFxuICAgICAgICBtXG4gICAgICApfSgpIGluc3RlYWQuYFxuICAgICk7XG4gIH07XG59KTtcblxuLy8gQ1VSU09SU1xuXG4vLyBUaGVyZSBhcmUgc2V2ZXJhbCBjbGFzc2VzIHdoaWNoIHJlbGF0ZSB0byBjdXJzb3JzOlxuLy9cbi8vIEN1cnNvckRlc2NyaXB0aW9uIHJlcHJlc2VudHMgdGhlIGFyZ3VtZW50cyB1c2VkIHRvIGNvbnN0cnVjdCBhIGN1cnNvcjpcbi8vIGNvbGxlY3Rpb25OYW1lLCBzZWxlY3RvciwgYW5kIChmaW5kKSBvcHRpb25zLiAgQmVjYXVzZSBpdCBpcyB1c2VkIGFzIGEga2V5XG4vLyBmb3IgY3Vyc29yIGRlLWR1cCwgZXZlcnl0aGluZyBpbiBpdCBzaG91bGQgZWl0aGVyIGJlIEpTT04tc3RyaW5naWZpYWJsZSBvclxuLy8gbm90IGFmZmVjdCBvYnNlcnZlQ2hhbmdlcyBvdXRwdXQgKGVnLCBvcHRpb25zLnRyYW5zZm9ybSBmdW5jdGlvbnMgYXJlIG5vdFxuLy8gc3RyaW5naWZpYWJsZSBidXQgZG8gbm90IGFmZmVjdCBvYnNlcnZlQ2hhbmdlcykuXG4vL1xuLy8gU3luY2hyb25vdXNDdXJzb3IgaXMgYSB3cmFwcGVyIGFyb3VuZCBhIE1vbmdvREIgY3Vyc29yXG4vLyB3aGljaCBpbmNsdWRlcyBmdWxseS1zeW5jaHJvbm91cyB2ZXJzaW9ucyBvZiBmb3JFYWNoLCBldGMuXG4vL1xuLy8gQ3Vyc29yIGlzIHRoZSBjdXJzb3Igb2JqZWN0IHJldHVybmVkIGZyb20gZmluZCgpLCB3aGljaCBpbXBsZW1lbnRzIHRoZVxuLy8gZG9jdW1lbnRlZCBNb25nby5Db2xsZWN0aW9uIGN1cnNvciBBUEkuICBJdCB3cmFwcyBhIEN1cnNvckRlc2NyaXB0aW9uIGFuZCBhXG4vLyBTeW5jaHJvbm91c0N1cnNvciAobGF6aWx5OiBpdCBkb2Vzbid0IGNvbnRhY3QgTW9uZ28gdW50aWwgeW91IGNhbGwgYSBtZXRob2Rcbi8vIGxpa2UgZmV0Y2ggb3IgZm9yRWFjaCBvbiBpdCkuXG4vL1xuLy8gT2JzZXJ2ZUhhbmRsZSBpcyB0aGUgXCJvYnNlcnZlIGhhbmRsZVwiIHJldHVybmVkIGZyb20gb2JzZXJ2ZUNoYW5nZXMuIEl0IGhhcyBhXG4vLyByZWZlcmVuY2UgdG8gYW4gT2JzZXJ2ZU11bHRpcGxleGVyLlxuLy9cbi8vIE9ic2VydmVNdWx0aXBsZXhlciBhbGxvd3MgbXVsdGlwbGUgaWRlbnRpY2FsIE9ic2VydmVIYW5kbGVzIHRvIGJlIGRyaXZlbiBieSBhXG4vLyBzaW5nbGUgb2JzZXJ2ZSBkcml2ZXIuXG4vL1xuLy8gVGhlcmUgYXJlIHR3byBcIm9ic2VydmUgZHJpdmVyc1wiIHdoaWNoIGRyaXZlIE9ic2VydmVNdWx0aXBsZXhlcnM6XG4vLyAgIC0gUG9sbGluZ09ic2VydmVEcml2ZXIgY2FjaGVzIHRoZSByZXN1bHRzIG9mIGEgcXVlcnkgYW5kIHJlcnVucyBpdCB3aGVuXG4vLyAgICAgbmVjZXNzYXJ5LlxuLy8gICAtIE9wbG9nT2JzZXJ2ZURyaXZlciBmb2xsb3dzIHRoZSBNb25nbyBvcGVyYXRpb24gbG9nIHRvIGRpcmVjdGx5IG9ic2VydmVcbi8vICAgICBkYXRhYmFzZSBjaGFuZ2VzLlxuLy8gQm90aCBpbXBsZW1lbnRhdGlvbnMgZm9sbG93IHRoZSBzYW1lIHNpbXBsZSBpbnRlcmZhY2U6IHdoZW4geW91IGNyZWF0ZSB0aGVtLFxuLy8gdGhleSBzdGFydCBzZW5kaW5nIG9ic2VydmVDaGFuZ2VzIGNhbGxiYWNrcyAoYW5kIGEgcmVhZHkoKSBpbnZvY2F0aW9uKSB0b1xuLy8gdGhlaXIgT2JzZXJ2ZU11bHRpcGxleGVyLCBhbmQgeW91IHN0b3AgdGhlbSBieSBjYWxsaW5nIHRoZWlyIHN0b3AoKSBtZXRob2QuXG5cbkN1cnNvckRlc2NyaXB0aW9uID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBzZWxlY3Rvciwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuY29sbGVjdGlvbk5hbWUgPSBjb2xsZWN0aW9uTmFtZTtcbiAgc2VsZi5zZWxlY3RvciA9IE1vbmdvLkNvbGxlY3Rpb24uX3Jld3JpdGVTZWxlY3RvcihzZWxlY3Rvcik7XG4gIHNlbGYub3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG59O1xuXG5DdXJzb3IgPSBmdW5jdGlvbiAobW9uZ28sIGN1cnNvckRlc2NyaXB0aW9uKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBzZWxmLl9tb25nbyA9IG1vbmdvO1xuICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiA9IGN1cnNvckRlc2NyaXB0aW9uO1xuICBzZWxmLl9zeW5jaHJvbm91c0N1cnNvciA9IG51bGw7XG59O1xuXG5mdW5jdGlvbiBzZXR1cFN5bmNocm9ub3VzQ3Vyc29yKGN1cnNvciwgbWV0aG9kKSB7XG4gIC8vIFlvdSBjYW4gb25seSBvYnNlcnZlIGEgdGFpbGFibGUgY3Vyc29yLlxuICBpZiAoY3Vyc29yLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRhaWxhYmxlKVxuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGNhbGwgJyArIG1ldGhvZCArICcgb24gYSB0YWlsYWJsZSBjdXJzb3InKTtcblxuICBpZiAoIWN1cnNvci5fc3luY2hyb25vdXNDdXJzb3IpIHtcbiAgICBjdXJzb3IuX3N5bmNocm9ub3VzQ3Vyc29yID0gY3Vyc29yLl9tb25nby5fY3JlYXRlU3luY2hyb25vdXNDdXJzb3IoXG4gICAgICBjdXJzb3IuX2N1cnNvckRlc2NyaXB0aW9uLFxuICAgICAge1xuICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgXCJjdXJzb3JcIiBhcmd1bWVudCB0byBmb3JFYWNoL21hcCBjYWxsYmFja3MgaXMgdGhlXG4gICAgICAgIC8vIEN1cnNvciwgbm90IHRoZSBTeW5jaHJvbm91c0N1cnNvci5cbiAgICAgICAgc2VsZkZvckl0ZXJhdGlvbjogY3Vyc29yLFxuICAgICAgICB1c2VUcmFuc2Zvcm06IHRydWUsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBjdXJzb3IuX3N5bmNocm9ub3VzQ3Vyc29yO1xufVxuXG5cbkN1cnNvci5wcm90b3R5cGUuY291bnRBc3luYyA9IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgY29uc3QgY29sbGVjdGlvbiA9IHRoaXMuX21vbmdvLnJhd0NvbGxlY3Rpb24odGhpcy5fY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWUpO1xuICByZXR1cm4gYXdhaXQgY29sbGVjdGlvbi5jb3VudERvY3VtZW50cyhcbiAgICByZXBsYWNlVHlwZXModGhpcy5fY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICByZXBsYWNlVHlwZXModGhpcy5fY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucywgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pLFxuICApO1xufTtcblxuQ3Vyc29yLnByb3RvdHlwZS5jb3VudCA9IGZ1bmN0aW9uICgpIHtcbiAgdGhyb3cgbmV3IEVycm9yKFxuICAgIFwiY291bnQoKSBpcyBub3QgYXZhaWJsZSBvbiB0aGUgc2VydmVyLiBQbGVhc2UgdXNlIGNvdW50QXN5bmMoKSBpbnN0ZWFkLlwiXG4gICk7XG59O1xuXG5bLi4uQVNZTkNfQ1VSU09SX01FVEhPRFMsIFN5bWJvbC5pdGVyYXRvciwgU3ltYm9sLmFzeW5jSXRlcmF0b3JdLmZvckVhY2gobWV0aG9kTmFtZSA9PiB7XG4gIC8vIGNvdW50IGlzIGhhbmRsZWQgc3BlY2lhbGx5IHNpbmNlIHdlIGRvbid0IHdhbnQgdG8gY3JlYXRlIGEgY3Vyc29yLlxuICAvLyBpdCBpcyBzdGlsbCBpbmNsdWRlZCBpbiBBU1lOQ19DVVJTT1JfTUVUSE9EUyBiZWNhdXNlIHdlIHN0aWxsIHdhbnQgYW4gYXN5bmMgdmVyc2lvbiBvZiBpdCB0byBleGlzdC5cbiAgaWYgKG1ldGhvZE5hbWUgPT09ICdjb3VudCcpIHtcbiAgICByZXR1cm5cbiAgfVxuICBDdXJzb3IucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICBjb25zdCBjdXJzb3IgPSBzZXR1cFN5bmNocm9ub3VzQ3Vyc29yKHRoaXMsIG1ldGhvZE5hbWUpO1xuICAgIHJldHVybiBjdXJzb3JbbWV0aG9kTmFtZV0oLi4uYXJncyk7XG4gIH07XG5cbiAgLy8gVGhlc2UgbWV0aG9kcyBhcmUgaGFuZGxlZCBzZXBhcmF0ZWx5LlxuICBpZiAobWV0aG9kTmFtZSA9PT0gU3ltYm9sLml0ZXJhdG9yIHx8IG1ldGhvZE5hbWUgPT09IFN5bWJvbC5hc3luY0l0ZXJhdG9yKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgbWV0aG9kTmFtZUFzeW5jID0gZ2V0QXN5bmNNZXRob2ROYW1lKG1ldGhvZE5hbWUpO1xuICBDdXJzb3IucHJvdG90eXBlW21ldGhvZE5hbWVBc3luY10gPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXNbbWV0aG9kTmFtZV0oLi4uYXJncykpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgIH1cbiAgfTtcbn0pO1xuXG5DdXJzb3IucHJvdG90eXBlLmdldFRyYW5zZm9ybSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudHJhbnNmb3JtO1xufTtcblxuLy8gV2hlbiB5b3UgY2FsbCBNZXRlb3IucHVibGlzaCgpIHdpdGggYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBDdXJzb3IsIHdlIG5lZWRcbi8vIHRvIHRyYW5zbXV0ZSBpdCBpbnRvIHRoZSBlcXVpdmFsZW50IHN1YnNjcmlwdGlvbi4gIFRoaXMgaXMgdGhlIGZ1bmN0aW9uIHRoYXRcbi8vIGRvZXMgdGhhdC5cblxuQ3Vyc29yLnByb3RvdHlwZS5fcHVibGlzaEN1cnNvciA9IGZ1bmN0aW9uIChzdWIpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY29sbGVjdGlvbiA9IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lO1xuICByZXR1cm4gTW9uZ28uQ29sbGVjdGlvbi5fcHVibGlzaEN1cnNvcihzZWxmLCBzdWIsIGNvbGxlY3Rpb24pO1xufTtcblxuLy8gVXNlZCB0byBndWFyYW50ZWUgdGhhdCBwdWJsaXNoIGZ1bmN0aW9ucyByZXR1cm4gYXQgbW9zdCBvbmUgY3Vyc29yIHBlclxuLy8gY29sbGVjdGlvbi4gUHJpdmF0ZSwgYmVjYXVzZSB3ZSBtaWdodCBsYXRlciBoYXZlIGN1cnNvcnMgdGhhdCBpbmNsdWRlXG4vLyBkb2N1bWVudHMgZnJvbSBtdWx0aXBsZSBjb2xsZWN0aW9ucyBzb21laG93LlxuQ3Vyc29yLnByb3RvdHlwZS5fZ2V0Q29sbGVjdGlvbk5hbWUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgcmV0dXJuIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lO1xufTtcblxuQ3Vyc29yLnByb3RvdHlwZS5vYnNlcnZlID0gZnVuY3Rpb24gKGNhbGxiYWNrcykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHJldHVybiBMb2NhbENvbGxlY3Rpb24uX29ic2VydmVGcm9tT2JzZXJ2ZUNoYW5nZXMoc2VsZiwgY2FsbGJhY2tzKTtcbn07XG5cbkN1cnNvci5wcm90b3R5cGUub2JzZXJ2ZUNoYW5nZXMgPSBmdW5jdGlvbiAoY2FsbGJhY2tzLCBvcHRpb25zID0ge30pIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgbWV0aG9kcyA9IFtcbiAgICAnYWRkZWRBdCcsXG4gICAgJ2FkZGVkJyxcbiAgICAnY2hhbmdlZEF0JyxcbiAgICAnY2hhbmdlZCcsXG4gICAgJ3JlbW92ZWRBdCcsXG4gICAgJ3JlbW92ZWQnLFxuICAgICdtb3ZlZFRvJ1xuICBdO1xuICB2YXIgb3JkZXJlZCA9IExvY2FsQ29sbGVjdGlvbi5fb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3NBcmVPcmRlcmVkKGNhbGxiYWNrcyk7XG5cbiAgbGV0IGV4Y2VwdGlvbk5hbWUgPSBjYWxsYmFja3MuX2Zyb21PYnNlcnZlID8gJ29ic2VydmUnIDogJ29ic2VydmVDaGFuZ2VzJztcbiAgZXhjZXB0aW9uTmFtZSArPSAnIGNhbGxiYWNrJztcbiAgbWV0aG9kcy5mb3JFYWNoKGZ1bmN0aW9uIChtZXRob2QpIHtcbiAgICBpZiAoY2FsbGJhY2tzW21ldGhvZF0gJiYgdHlwZW9mIGNhbGxiYWNrc1ttZXRob2RdID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgY2FsbGJhY2tzW21ldGhvZF0gPSBNZXRlb3IuYmluZEVudmlyb25tZW50KGNhbGxiYWNrc1ttZXRob2RdLCBtZXRob2QgKyBleGNlcHRpb25OYW1lKTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBzZWxmLl9tb25nby5fb2JzZXJ2ZUNoYW5nZXMoXG4gICAgc2VsZi5fY3Vyc29yRGVzY3JpcHRpb24sIG9yZGVyZWQsIGNhbGxiYWNrcywgb3B0aW9ucy5ub25NdXRhdGluZ0NhbGxiYWNrcyk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9jcmVhdGVTeW5jaHJvbm91c0N1cnNvciA9IGZ1bmN0aW9uKFxuICAgIGN1cnNvckRlc2NyaXB0aW9uLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgb3B0aW9ucyA9IF8ucGljayhvcHRpb25zIHx8IHt9LCAnc2VsZkZvckl0ZXJhdGlvbicsICd1c2VUcmFuc2Zvcm0nKTtcblxuICB2YXIgY29sbGVjdGlvbiA9IHNlbGYucmF3Q29sbGVjdGlvbihjdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZSk7XG4gIHZhciBjdXJzb3JPcHRpb25zID0gY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucztcbiAgdmFyIG1vbmdvT3B0aW9ucyA9IHtcbiAgICBzb3J0OiBjdXJzb3JPcHRpb25zLnNvcnQsXG4gICAgbGltaXQ6IGN1cnNvck9wdGlvbnMubGltaXQsXG4gICAgc2tpcDogY3Vyc29yT3B0aW9ucy5za2lwLFxuICAgIHByb2plY3Rpb246IGN1cnNvck9wdGlvbnMuZmllbGRzIHx8IGN1cnNvck9wdGlvbnMucHJvamVjdGlvbixcbiAgICByZWFkUHJlZmVyZW5jZTogY3Vyc29yT3B0aW9ucy5yZWFkUHJlZmVyZW5jZSxcbiAgfTtcblxuICAvLyBEbyB3ZSB3YW50IGEgdGFpbGFibGUgY3Vyc29yICh3aGljaCBvbmx5IHdvcmtzIG9uIGNhcHBlZCBjb2xsZWN0aW9ucyk/XG4gIGlmIChjdXJzb3JPcHRpb25zLnRhaWxhYmxlKSB7XG4gICAgbW9uZ29PcHRpb25zLm51bWJlck9mUmV0cmllcyA9IC0xO1xuICB9XG5cbiAgdmFyIGRiQ3Vyc29yID0gY29sbGVjdGlvbi5maW5kKFxuICAgIHJlcGxhY2VUeXBlcyhjdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3RvciwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pLFxuICAgIG1vbmdvT3B0aW9ucyk7XG5cbiAgLy8gRG8gd2Ugd2FudCBhIHRhaWxhYmxlIGN1cnNvciAod2hpY2ggb25seSB3b3JrcyBvbiBjYXBwZWQgY29sbGVjdGlvbnMpP1xuICBpZiAoY3Vyc29yT3B0aW9ucy50YWlsYWJsZSkge1xuICAgIC8vIFdlIHdhbnQgYSB0YWlsYWJsZSBjdXJzb3IuLi5cbiAgICBkYkN1cnNvci5hZGRDdXJzb3JGbGFnKFwidGFpbGFibGVcIiwgdHJ1ZSlcbiAgICAvLyAuLi4gYW5kIGZvciB0aGUgc2VydmVyIHRvIHdhaXQgYSBiaXQgaWYgYW55IGdldE1vcmUgaGFzIG5vIGRhdGEgKHJhdGhlclxuICAgIC8vIHRoYW4gbWFraW5nIHVzIHB1dCB0aGUgcmVsZXZhbnQgc2xlZXBzIGluIHRoZSBjbGllbnQpLi4uXG4gICAgZGJDdXJzb3IuYWRkQ3Vyc29yRmxhZyhcImF3YWl0RGF0YVwiLCB0cnVlKVxuXG4gICAgLy8gQW5kIGlmIHRoaXMgaXMgb24gdGhlIG9wbG9nIGNvbGxlY3Rpb24gYW5kIHRoZSBjdXJzb3Igc3BlY2lmaWVzIGEgJ3RzJyxcbiAgICAvLyB0aGVuIHNldCB0aGUgdW5kb2N1bWVudGVkIG9wbG9nIHJlcGxheSBmbGFnLCB3aGljaCBkb2VzIGEgc3BlY2lhbCBzY2FuIHRvXG4gICAgLy8gZmluZCB0aGUgZmlyc3QgZG9jdW1lbnQgKGluc3RlYWQgb2YgY3JlYXRpbmcgYW4gaW5kZXggb24gdHMpLiBUaGlzIGlzIGFcbiAgICAvLyB2ZXJ5IGhhcmQtY29kZWQgTW9uZ28gZmxhZyB3aGljaCBvbmx5IHdvcmtzIG9uIHRoZSBvcGxvZyBjb2xsZWN0aW9uIGFuZFxuICAgIC8vIG9ubHkgd29ya3Mgd2l0aCB0aGUgdHMgZmllbGQuXG4gICAgaWYgKGN1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lID09PSBPUExPR19DT0xMRUNUSU9OICYmXG4gICAgICAgIGN1cnNvckRlc2NyaXB0aW9uLnNlbGVjdG9yLnRzKSB7XG4gICAgICBkYkN1cnNvci5hZGRDdXJzb3JGbGFnKFwib3Bsb2dSZXBsYXlcIiwgdHJ1ZSlcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZW9mIGN1cnNvck9wdGlvbnMubWF4VGltZU1zICE9PSAndW5kZWZpbmVkJykge1xuICAgIGRiQ3Vyc29yID0gZGJDdXJzb3IubWF4VGltZU1TKGN1cnNvck9wdGlvbnMubWF4VGltZU1zKTtcbiAgfVxuICBpZiAodHlwZW9mIGN1cnNvck9wdGlvbnMuaGludCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBkYkN1cnNvciA9IGRiQ3Vyc29yLmhpbnQoY3Vyc29yT3B0aW9ucy5oaW50KTtcbiAgfVxuXG4gIHJldHVybiBuZXcgQXN5bmNocm9ub3VzQ3Vyc29yKGRiQ3Vyc29yLCBjdXJzb3JEZXNjcmlwdGlvbiwgb3B0aW9ucywgY29sbGVjdGlvbik7XG59O1xuXG4vKipcbiAqIFRoaXMgaXMganVzdCBhIGxpZ2h0IHdyYXBwZXIgZm9yIHRoZSBjdXJzb3IuIFRoZSBnb2FsIGhlcmUgaXMgdG8gZW5zdXJlIGNvbXBhdGliaWxpdHkgZXZlbiBpZlxuICogdGhlcmUgYXJlIGJyZWFraW5nIGNoYW5nZXMgb24gdGhlIE1vbmdvREIgZHJpdmVyLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5jbGFzcyBBc3luY2hyb25vdXNDdXJzb3Ige1xuICBjb25zdHJ1Y3RvcihkYkN1cnNvciwgY3Vyc29yRGVzY3JpcHRpb24sIG9wdGlvbnMpIHtcbiAgICB0aGlzLl9kYkN1cnNvciA9IGRiQ3Vyc29yO1xuICAgIHRoaXMuX2N1cnNvckRlc2NyaXB0aW9uID0gY3Vyc29yRGVzY3JpcHRpb247XG5cbiAgICB0aGlzLl9zZWxmRm9ySXRlcmF0aW9uID0gb3B0aW9ucy5zZWxmRm9ySXRlcmF0aW9uIHx8IHRoaXM7XG4gICAgaWYgKG9wdGlvbnMudXNlVHJhbnNmb3JtICYmIGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudHJhbnNmb3JtKSB7XG4gICAgICB0aGlzLl90cmFuc2Zvcm0gPSBMb2NhbENvbGxlY3Rpb24ud3JhcFRyYW5zZm9ybShcbiAgICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRyYW5zZm9ybSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3RyYW5zZm9ybSA9IG51bGw7XG4gICAgfVxuXG4gICAgdGhpcy5fdmlzaXRlZElkcyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICB9XG4gIFxuICBbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCkge1xuICAgIHZhciBjdXJzb3IgPSB0aGlzO1xuICAgIHJldHVybiB7XG4gICAgICBhc3luYyBuZXh0KCkge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IGN1cnNvci5fbmV4dE9iamVjdFByb21pc2UoKTtcbiAgICAgICAgcmV0dXJuIHsgZG9uZTogIXZhbHVlLCB2YWx1ZSB9O1xuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIFByb21pc2UgZm9yIHRoZSBuZXh0IG9iamVjdCBmcm9tIHRoZSB1bmRlcmx5aW5nIGN1cnNvciAoYmVmb3JlXG4gIC8vIHRoZSBNb25nby0+TWV0ZW9yIHR5cGUgcmVwbGFjZW1lbnQpLlxuICBhc3luYyBfcmF3TmV4dE9iamVjdFByb21pc2UoKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLl9kYkN1cnNvci5uZXh0KCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICB9XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgUHJvbWlzZSBmb3IgdGhlIG5leHQgb2JqZWN0IGZyb20gdGhlIGN1cnNvciwgc2tpcHBpbmcgdGhvc2Ugd2hvc2VcbiAgLy8gSURzIHdlJ3ZlIGFscmVhZHkgc2VlbiBhbmQgcmVwbGFjaW5nIE1vbmdvIGF0b21zIHdpdGggTWV0ZW9yIGF0b21zLlxuICBhc3luYyBfbmV4dE9iamVjdFByb21pc2UgKCkge1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICB2YXIgZG9jID0gYXdhaXQgdGhpcy5fcmF3TmV4dE9iamVjdFByb21pc2UoKTtcblxuICAgICAgaWYgKCFkb2MpIHJldHVybiBudWxsO1xuICAgICAgZG9jID0gcmVwbGFjZVR5cGVzKGRvYywgcmVwbGFjZU1vbmdvQXRvbVdpdGhNZXRlb3IpO1xuXG4gICAgICBpZiAoIXRoaXMuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudGFpbGFibGUgJiYgXy5oYXMoZG9jLCAnX2lkJykpIHtcbiAgICAgICAgLy8gRGlkIE1vbmdvIGdpdmUgdXMgZHVwbGljYXRlIGRvY3VtZW50cyBpbiB0aGUgc2FtZSBjdXJzb3I/IElmIHNvLFxuICAgICAgICAvLyBpZ25vcmUgdGhpcyBvbmUuIChEbyB0aGlzIGJlZm9yZSB0aGUgdHJhbnNmb3JtLCBzaW5jZSB0cmFuc2Zvcm0gbWlnaHRcbiAgICAgICAgLy8gcmV0dXJuIHNvbWUgdW5yZWxhdGVkIHZhbHVlLikgV2UgZG9uJ3QgZG8gdGhpcyBmb3IgdGFpbGFibGUgY3Vyc29ycyxcbiAgICAgICAgLy8gYmVjYXVzZSB3ZSB3YW50IHRvIG1haW50YWluIE8oMSkgbWVtb3J5IHVzYWdlLiBBbmQgaWYgdGhlcmUgaXNuJ3QgX2lkXG4gICAgICAgIC8vIGZvciBzb21lIHJlYXNvbiAobWF5YmUgaXQncyB0aGUgb3Bsb2cpLCB0aGVuIHdlIGRvbid0IGRvIHRoaXMgZWl0aGVyLlxuICAgICAgICAvLyAoQmUgY2FyZWZ1bCB0byBkbyB0aGlzIGZvciBmYWxzZXkgYnV0IGV4aXN0aW5nIF9pZCwgdGhvdWdoLilcbiAgICAgICAgaWYgKHRoaXMuX3Zpc2l0ZWRJZHMuaGFzKGRvYy5faWQpKSBjb250aW51ZTtcbiAgICAgICAgdGhpcy5fdmlzaXRlZElkcy5zZXQoZG9jLl9pZCwgdHJ1ZSk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl90cmFuc2Zvcm0pXG4gICAgICAgIGRvYyA9IHRoaXMuX3RyYW5zZm9ybShkb2MpO1xuXG4gICAgICByZXR1cm4gZG9jO1xuICAgIH1cbiAgfVxuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdpdGggdGhlIG5leHQgb2JqZWN0IChsaWtlIHdpdGhcbiAgLy8gX25leHRPYmplY3RQcm9taXNlKSBvciByZWplY3RlZCBpZiB0aGUgY3Vyc29yIGRvZXNuJ3QgcmV0dXJuIHdpdGhpblxuICAvLyB0aW1lb3V0TVMgbXMuXG4gIF9uZXh0T2JqZWN0UHJvbWlzZVdpdGhUaW1lb3V0KHRpbWVvdXRNUykge1xuICAgIGlmICghdGltZW91dE1TKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbmV4dE9iamVjdFByb21pc2UoKTtcbiAgICB9XG4gICAgY29uc3QgbmV4dE9iamVjdFByb21pc2UgPSB0aGlzLl9uZXh0T2JqZWN0UHJvbWlzZSgpO1xuICAgIGNvbnN0IHRpbWVvdXRFcnIgPSBuZXcgRXJyb3IoJ0NsaWVudC1zaWRlIHRpbWVvdXQgd2FpdGluZyBmb3IgbmV4dCBvYmplY3QnKTtcbiAgICBjb25zdCB0aW1lb3V0UHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICByZWplY3QodGltZW91dEVycik7XG4gICAgICB9LCB0aW1lb3V0TVMpO1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLnJhY2UoW25leHRPYmplY3RQcm9taXNlLCB0aW1lb3V0UHJvbWlzZV0pXG4gICAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgaWYgKGVyciA9PT0gdGltZW91dEVycikge1xuICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIC8vIEdldCBiYWNrIHRvIHRoZSBiZWdpbm5pbmcuXG4gICAgdGhpcy5fcmV3aW5kKCk7XG5cbiAgICBsZXQgaWR4ID0gMDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgZG9jID0gYXdhaXQgdGhpcy5fbmV4dE9iamVjdFByb21pc2UoKTtcbiAgICAgIGlmICghZG9jKSByZXR1cm47XG4gICAgICBhd2FpdCBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGRvYywgaWR4KyssIHRoaXMuX3NlbGZGb3JJdGVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG1hcChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICBhd2FpdCB0aGlzLmZvckVhY2goYXN5bmMgKGRvYywgaW5kZXgpID0+IHtcbiAgICAgIHJlc3VsdHMucHVzaChhd2FpdCBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGRvYywgaW5kZXgsIHRoaXMuX3NlbGZGb3JJdGVyYXRpb24pKTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgX3Jld2luZCgpIHtcbiAgICAvLyBrbm93biB0byBiZSBzeW5jaHJvbm91c1xuICAgIHRoaXMuX2RiQ3Vyc29yLnJld2luZCgpO1xuXG4gICAgdGhpcy5fdmlzaXRlZElkcyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICB9XG5cbiAgLy8gTW9zdGx5IHVzYWJsZSBmb3IgdGFpbGFibGUgY3Vyc29ycy5cbiAgY2xvc2UoKSB7XG4gICAgdGhpcy5fZGJDdXJzb3IuY2xvc2UoKTtcbiAgfVxuXG4gIGZldGNoKCkge1xuICAgIHJldHVybiB0aGlzLm1hcChfLmlkZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGSVhNRTogKG5vZGU6MzQ2ODApIFtNT05HT0RCIERSSVZFUl0gV2FybmluZzogY3Vyc29yLmNvdW50IGlzIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmVcbiAgICogIHJlbW92ZWQgaW4gdGhlIG5leHQgbWFqb3IgdmVyc2lvbiwgcGxlYXNlIHVzZSBgY29sbGVjdGlvbi5lc3RpbWF0ZWREb2N1bWVudENvdW50YCBvclxuICAgKiAgYGNvbGxlY3Rpb24uY291bnREb2N1bWVudHNgIGluc3RlYWQuXG4gICAqL1xuICBjb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGJDdXJzb3IuY291bnQoKTtcbiAgfVxuXG4gIC8vIFRoaXMgbWV0aG9kIGlzIE5PVCB3cmFwcGVkIGluIEN1cnNvci5cbiAgYXN5bmMgZ2V0UmF3T2JqZWN0cyhvcmRlcmVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChvcmRlcmVkKSB7XG4gICAgICByZXR1cm4gc2VsZi5mZXRjaCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcmVzdWx0cyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICAgICAgYXdhaXQgc2VsZi5mb3JFYWNoKGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgcmVzdWx0cy5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuICB9XG59XG5cbnZhciBTeW5jaHJvbm91c0N1cnNvciA9IGZ1bmN0aW9uIChkYkN1cnNvciwgY3Vyc29yRGVzY3JpcHRpb24sIG9wdGlvbnMsIGNvbGxlY3Rpb24pIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBvcHRpb25zID0gXy5waWNrKG9wdGlvbnMgfHwge30sICdzZWxmRm9ySXRlcmF0aW9uJywgJ3VzZVRyYW5zZm9ybScpO1xuXG4gIHNlbGYuX2RiQ3Vyc29yID0gZGJDdXJzb3I7XG4gIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uID0gY3Vyc29yRGVzY3JpcHRpb247XG4gIC8vIFRoZSBcInNlbGZcIiBhcmd1bWVudCBwYXNzZWQgdG8gZm9yRWFjaC9tYXAgY2FsbGJhY2tzLiBJZiB3ZSdyZSB3cmFwcGVkXG4gIC8vIGluc2lkZSBhIHVzZXItdmlzaWJsZSBDdXJzb3IsIHdlIHdhbnQgdG8gcHJvdmlkZSB0aGUgb3V0ZXIgY3Vyc29yIVxuICBzZWxmLl9zZWxmRm9ySXRlcmF0aW9uID0gb3B0aW9ucy5zZWxmRm9ySXRlcmF0aW9uIHx8IHNlbGY7XG4gIGlmIChvcHRpb25zLnVzZVRyYW5zZm9ybSAmJiBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRyYW5zZm9ybSkge1xuICAgIHNlbGYuX3RyYW5zZm9ybSA9IExvY2FsQ29sbGVjdGlvbi53cmFwVHJhbnNmb3JtKFxuICAgICAgY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy50cmFuc2Zvcm0pO1xuICB9IGVsc2Uge1xuICAgIHNlbGYuX3RyYW5zZm9ybSA9IG51bGw7XG4gIH1cblxuICBzZWxmLl9zeW5jaHJvbm91c0NvdW50ID0gRnV0dXJlLndyYXAoXG4gICAgY29sbGVjdGlvbi5jb3VudERvY3VtZW50cy5iaW5kKFxuICAgICAgY29sbGVjdGlvbixcbiAgICAgIHJlcGxhY2VUeXBlcyhjdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3RvciwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pLFxuICAgICAgcmVwbGFjZVR5cGVzKGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICApXG4gICk7XG4gIHNlbGYuX3Zpc2l0ZWRJZHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbn07XG5cbl8uZXh0ZW5kKFN5bmNocm9ub3VzQ3Vyc29yLnByb3RvdHlwZSwge1xuICAvLyBSZXR1cm5zIGEgUHJvbWlzZSBmb3IgdGhlIG5leHQgb2JqZWN0IGZyb20gdGhlIHVuZGVybHlpbmcgY3Vyc29yIChiZWZvcmVcbiAgLy8gdGhlIE1vbmdvLT5NZXRlb3IgdHlwZSByZXBsYWNlbWVudCkuXG4gIF9yYXdOZXh0T2JqZWN0UHJvbWlzZTogZnVuY3Rpb24gKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBzZWxmLl9kYkN1cnNvci5uZXh0KChlcnIsIGRvYykgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZShkb2MpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBSZXR1cm5zIGEgUHJvbWlzZSBmb3IgdGhlIG5leHQgb2JqZWN0IGZyb20gdGhlIGN1cnNvciwgc2tpcHBpbmcgdGhvc2Ugd2hvc2VcbiAgLy8gSURzIHdlJ3ZlIGFscmVhZHkgc2VlbiBhbmQgcmVwbGFjaW5nIE1vbmdvIGF0b21zIHdpdGggTWV0ZW9yIGF0b21zLlxuICBfbmV4dE9iamVjdFByb21pc2U6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgdmFyIGRvYyA9IGF3YWl0IHNlbGYuX3Jhd05leHRPYmplY3RQcm9taXNlKCk7XG5cbiAgICAgIGlmICghZG9jKSByZXR1cm4gbnVsbDtcbiAgICAgIGRvYyA9IHJlcGxhY2VUeXBlcyhkb2MsIHJlcGxhY2VNb25nb0F0b21XaXRoTWV0ZW9yKTtcblxuICAgICAgaWYgKCFzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRhaWxhYmxlICYmIF8uaGFzKGRvYywgJ19pZCcpKSB7XG4gICAgICAgIC8vIERpZCBNb25nbyBnaXZlIHVzIGR1cGxpY2F0ZSBkb2N1bWVudHMgaW4gdGhlIHNhbWUgY3Vyc29yPyBJZiBzbyxcbiAgICAgICAgLy8gaWdub3JlIHRoaXMgb25lLiAoRG8gdGhpcyBiZWZvcmUgdGhlIHRyYW5zZm9ybSwgc2luY2UgdHJhbnNmb3JtIG1pZ2h0XG4gICAgICAgIC8vIHJldHVybiBzb21lIHVucmVsYXRlZCB2YWx1ZS4pIFdlIGRvbid0IGRvIHRoaXMgZm9yIHRhaWxhYmxlIGN1cnNvcnMsXG4gICAgICAgIC8vIGJlY2F1c2Ugd2Ugd2FudCB0byBtYWludGFpbiBPKDEpIG1lbW9yeSB1c2FnZS4gQW5kIGlmIHRoZXJlIGlzbid0IF9pZFxuICAgICAgICAvLyBmb3Igc29tZSByZWFzb24gKG1heWJlIGl0J3MgdGhlIG9wbG9nKSwgdGhlbiB3ZSBkb24ndCBkbyB0aGlzIGVpdGhlci5cbiAgICAgICAgLy8gKEJlIGNhcmVmdWwgdG8gZG8gdGhpcyBmb3IgZmFsc2V5IGJ1dCBleGlzdGluZyBfaWQsIHRob3VnaC4pXG4gICAgICAgIGlmIChzZWxmLl92aXNpdGVkSWRzLmhhcyhkb2MuX2lkKSkgY29udGludWU7XG4gICAgICAgIHNlbGYuX3Zpc2l0ZWRJZHMuc2V0KGRvYy5faWQsIHRydWUpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZi5fdHJhbnNmb3JtKVxuICAgICAgICBkb2MgPSBzZWxmLl90cmFuc2Zvcm0oZG9jKTtcblxuICAgICAgcmV0dXJuIGRvYztcbiAgICB9XG4gIH0sXG5cbiAgLy8gUmV0dXJucyBhIHByb21pc2Ugd2hpY2ggaXMgcmVzb2x2ZWQgd2l0aCB0aGUgbmV4dCBvYmplY3QgKGxpa2Ugd2l0aFxuICAvLyBfbmV4dE9iamVjdFByb21pc2UpIG9yIHJlamVjdGVkIGlmIHRoZSBjdXJzb3IgZG9lc24ndCByZXR1cm4gd2l0aGluXG4gIC8vIHRpbWVvdXRNUyBtcy5cbiAgX25leHRPYmplY3RQcm9taXNlV2l0aFRpbWVvdXQ6IGZ1bmN0aW9uICh0aW1lb3V0TVMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoIXRpbWVvdXRNUykge1xuICAgICAgcmV0dXJuIHNlbGYuX25leHRPYmplY3RQcm9taXNlKCk7XG4gICAgfVxuICAgIGNvbnN0IG5leHRPYmplY3RQcm9taXNlID0gc2VsZi5fbmV4dE9iamVjdFByb21pc2UoKTtcbiAgICBjb25zdCB0aW1lb3V0RXJyID0gbmV3IEVycm9yKCdDbGllbnQtc2lkZSB0aW1lb3V0IHdhaXRpbmcgZm9yIG5leHQgb2JqZWN0Jyk7XG4gICAgY29uc3QgdGltZW91dFByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICByZWplY3QodGltZW91dEVycik7XG4gICAgICB9LCB0aW1lb3V0TVMpO1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLnJhY2UoW25leHRPYmplY3RQcm9taXNlLCB0aW1lb3V0UHJvbWlzZV0pXG4gICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICBpZiAoZXJyID09PSB0aW1lb3V0RXJyKSB7XG4gICAgICAgICAgc2VsZi5jbG9zZSgpO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH0pO1xuICB9LFxuXG4gIF9uZXh0T2JqZWN0OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLl9uZXh0T2JqZWN0UHJvbWlzZSgpLmF3YWl0KCk7XG4gIH0sXG5cbiAgZm9yRWFjaDogZnVuY3Rpb24gKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHdyYXBwZWRGbiA9IE1ldGVvci53cmFwRm4oY2FsbGJhY2spO1xuXG4gICAgLy8gR2V0IGJhY2sgdG8gdGhlIGJlZ2lubmluZy5cbiAgICBzZWxmLl9yZXdpbmQoKTtcblxuICAgIC8vIFdlIGltcGxlbWVudCB0aGUgbG9vcCBvdXJzZWxmIGluc3RlYWQgb2YgdXNpbmcgc2VsZi5fZGJDdXJzb3IuZWFjaCxcbiAgICAvLyBiZWNhdXNlIFwiZWFjaFwiIHdpbGwgY2FsbCBpdHMgY2FsbGJhY2sgb3V0c2lkZSBvZiBhIGZpYmVyIHdoaWNoIG1ha2VzIGl0XG4gICAgLy8gbXVjaCBtb3JlIGNvbXBsZXggdG8gbWFrZSB0aGlzIGZ1bmN0aW9uIHN5bmNocm9ub3VzLlxuICAgIHZhciBpbmRleCA9IDA7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIHZhciBkb2MgPSBzZWxmLl9uZXh0T2JqZWN0KCk7XG4gICAgICBpZiAoIWRvYykgcmV0dXJuO1xuICAgICAgd3JhcHBlZEZuLmNhbGwodGhpc0FyZywgZG9jLCBpbmRleCsrLCBzZWxmLl9zZWxmRm9ySXRlcmF0aW9uKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gWFhYIEFsbG93IG92ZXJsYXBwaW5nIGNhbGxiYWNrIGV4ZWN1dGlvbnMgaWYgY2FsbGJhY2sgeWllbGRzLlxuICBtYXA6IGZ1bmN0aW9uIChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBjb25zdCB3cmFwcGVkRm4gPSBNZXRlb3Iud3JhcEZuKGNhbGxiYWNrKTtcbiAgICB2YXIgcmVzID0gW107XG4gICAgc2VsZi5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGluZGV4KSB7XG4gICAgICByZXMucHVzaCh3cmFwcGVkRm4uY2FsbCh0aGlzQXJnLCBkb2MsIGluZGV4LCBzZWxmLl9zZWxmRm9ySXRlcmF0aW9uKSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSxcblxuICBfcmV3aW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8ga25vd24gdG8gYmUgc3luY2hyb25vdXNcbiAgICBzZWxmLl9kYkN1cnNvci5yZXdpbmQoKTtcblxuICAgIHNlbGYuX3Zpc2l0ZWRJZHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgfSxcblxuICAvLyBNb3N0bHkgdXNhYmxlIGZvciB0YWlsYWJsZSBjdXJzb3JzLlxuICBjbG9zZTogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHNlbGYuX2RiQ3Vyc29yLmNsb3NlKCk7XG4gIH0sXG5cbiAgZmV0Y2g6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIHNlbGYubWFwKF8uaWRlbnRpdHkpO1xuICB9LFxuXG4gIGNvdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLl9zeW5jaHJvbm91c0NvdW50KCkud2FpdCgpO1xuICB9LFxuXG4gIC8vIFRoaXMgbWV0aG9kIGlzIE5PVCB3cmFwcGVkIGluIEN1cnNvci5cbiAgZ2V0UmF3T2JqZWN0czogZnVuY3Rpb24gKG9yZGVyZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKG9yZGVyZWQpIHtcbiAgICAgIHJldHVybiBzZWxmLmZldGNoKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciByZXN1bHRzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgICBzZWxmLmZvckVhY2goZnVuY3Rpb24gKGRvYykge1xuICAgICAgICByZXN1bHRzLnNldChkb2MuX2lkLCBkb2MpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG4gIH1cbn0pO1xuXG5TeW5jaHJvbm91c0N1cnNvci5wcm90b3R5cGVbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIEdldCBiYWNrIHRvIHRoZSBiZWdpbm5pbmcuXG4gIHNlbGYuX3Jld2luZCgpO1xuXG4gIHJldHVybiB7XG4gICAgbmV4dCgpIHtcbiAgICAgIGNvbnN0IGRvYyA9IHNlbGYuX25leHRPYmplY3QoKTtcbiAgICAgIHJldHVybiBkb2MgPyB7XG4gICAgICAgIHZhbHVlOiBkb2NcbiAgICAgIH0gOiB7XG4gICAgICAgIGRvbmU6IHRydWVcbiAgICAgIH07XG4gICAgfVxuICB9O1xufTtcblxuU3luY2hyb25vdXNDdXJzb3IucHJvdG90eXBlW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHtcbiAgY29uc3Qgc3luY1Jlc3VsdCA9IHRoaXNbU3ltYm9sLml0ZXJhdG9yXSgpO1xuICByZXR1cm4ge1xuICAgIGFzeW5jIG5leHQoKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHN5bmNSZXN1bHQubmV4dCgpKTtcbiAgICB9XG4gIH07XG59XG5cbi8vIFRhaWxzIHRoZSBjdXJzb3IgZGVzY3JpYmVkIGJ5IGN1cnNvckRlc2NyaXB0aW9uLCBtb3N0IGxpa2VseSBvbiB0aGVcbi8vIG9wbG9nLiBDYWxscyBkb2NDYWxsYmFjayB3aXRoIGVhY2ggZG9jdW1lbnQgZm91bmQuIElnbm9yZXMgZXJyb3JzIGFuZCBqdXN0XG4vLyByZXN0YXJ0cyB0aGUgdGFpbCBvbiBlcnJvci5cbi8vXG4vLyBJZiB0aW1lb3V0TVMgaXMgc2V0LCB0aGVuIGlmIHdlIGRvbid0IGdldCBhIG5ldyBkb2N1bWVudCBldmVyeSB0aW1lb3V0TVMsXG4vLyBraWxsIGFuZCByZXN0YXJ0IHRoZSBjdXJzb3IuIFRoaXMgaXMgcHJpbWFyaWx5IGEgd29ya2Fyb3VuZCBmb3IgIzg1OTguXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLnRhaWwgPSBmdW5jdGlvbiAoY3Vyc29yRGVzY3JpcHRpb24sIGRvY0NhbGxiYWNrLCB0aW1lb3V0TVMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoIWN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudGFpbGFibGUpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuIG9ubHkgdGFpbCBhIHRhaWxhYmxlIGN1cnNvclwiKTtcblxuICB2YXIgY3Vyc29yID0gc2VsZi5fY3JlYXRlU3luY2hyb25vdXNDdXJzb3IoY3Vyc29yRGVzY3JpcHRpb24pO1xuXG4gIHZhciBzdG9wcGVkID0gZmFsc2U7XG4gIHZhciBsYXN0VFM7XG5cbiAgTWV0ZW9yLmRlZmVyKGFzeW5jIGZ1bmN0aW9uIGxvb3AoKSB7XG4gICAgdmFyIGRvYyA9IG51bGw7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmIChzdG9wcGVkKVxuICAgICAgICByZXR1cm47XG4gICAgICB0cnkge1xuICAgICAgICBkb2MgPSBhd2FpdCBjdXJzb3IuX25leHRPYmplY3RQcm9taXNlV2l0aFRpbWVvdXQodGltZW91dE1TKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBUaGVyZSdzIG5vIGdvb2Qgd2F5IHRvIGZpZ3VyZSBvdXQgaWYgdGhpcyB3YXMgYWN0dWFsbHkgYW4gZXJyb3IgZnJvbVxuICAgICAgICAvLyBNb25nbywgb3IganVzdCBjbGllbnQtc2lkZSAoaW5jbHVkaW5nIG91ciBvd24gdGltZW91dCBlcnJvcikuIEFoXG4gICAgICAgIC8vIHdlbGwuIEJ1dCBlaXRoZXIgd2F5LCB3ZSBuZWVkIHRvIHJldHJ5IHRoZSBjdXJzb3IgKHVubGVzcyB0aGUgZmFpbHVyZVxuICAgICAgICAvLyB3YXMgYmVjYXVzZSB0aGUgb2JzZXJ2ZSBnb3Qgc3RvcHBlZCkuXG4gICAgICAgIGRvYyA9IG51bGw7XG4gICAgICB9XG4gICAgICAvLyBTaW5jZSB3ZSBhd2FpdGVkIGEgcHJvbWlzZSBhYm92ZSwgd2UgbmVlZCB0byBjaGVjayBhZ2FpbiB0byBzZWUgaWZcbiAgICAgIC8vIHdlJ3ZlIGJlZW4gc3RvcHBlZCBiZWZvcmUgY2FsbGluZyB0aGUgY2FsbGJhY2suXG4gICAgICBpZiAoc3RvcHBlZClcbiAgICAgICAgcmV0dXJuO1xuICAgICAgaWYgKGRvYykge1xuICAgICAgICAvLyBJZiBhIHRhaWxhYmxlIGN1cnNvciBjb250YWlucyBhIFwidHNcIiBmaWVsZCwgdXNlIGl0IHRvIHJlY3JlYXRlIHRoZVxuICAgICAgICAvLyBjdXJzb3Igb24gZXJyb3IuIChcInRzXCIgaXMgYSBzdGFuZGFyZCB0aGF0IE1vbmdvIHVzZXMgaW50ZXJuYWxseSBmb3JcbiAgICAgICAgLy8gdGhlIG9wbG9nLCBhbmQgdGhlcmUncyBhIHNwZWNpYWwgZmxhZyB0aGF0IGxldHMgeW91IGRvIGJpbmFyeSBzZWFyY2hcbiAgICAgICAgLy8gb24gaXQgaW5zdGVhZCBvZiBuZWVkaW5nIHRvIHVzZSBhbiBpbmRleC4pXG4gICAgICAgIGxhc3RUUyA9IGRvYy50cztcbiAgICAgICAgZG9jQ2FsbGJhY2soZG9jKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBuZXdTZWxlY3RvciA9IF8uY2xvbmUoY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IpO1xuICAgICAgICBpZiAobGFzdFRTKSB7XG4gICAgICAgICAgbmV3U2VsZWN0b3IudHMgPSB7JGd0OiBsYXN0VFN9O1xuICAgICAgICB9XG4gICAgICAgIGN1cnNvciA9IHNlbGYuX2NyZWF0ZVN5bmNocm9ub3VzQ3Vyc29yKG5ldyBDdXJzb3JEZXNjcmlwdGlvbihcbiAgICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICBuZXdTZWxlY3RvcixcbiAgICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zKSk7XG4gICAgICAgIC8vIE1vbmdvIGZhaWxvdmVyIHRha2VzIG1hbnkgc2Vjb25kcy4gIFJldHJ5IGluIGEgYml0LiAgKFdpdGhvdXQgdGhpc1xuICAgICAgICAvLyBzZXRUaW1lb3V0LCB3ZSBwZWcgdGhlIENQVSBhdCAxMDAlIGFuZCBuZXZlciBub3RpY2UgdGhlIGFjdHVhbFxuICAgICAgICAvLyBmYWlsb3Zlci5cbiAgICAgICAgc2V0VGltZW91dChsb29wLCAxMDApO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgc3RvcHBlZCA9IHRydWU7XG4gICAgICBjdXJzb3IuY2xvc2UoKTtcbiAgICB9XG4gIH07XG59O1xuXG5PYmplY3QuYXNzaWduKE1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUsIHtcbiAgX29ic2VydmVDaGFuZ2VzOiBhc3luYyBmdW5jdGlvbiAoXG4gICAgICBjdXJzb3JEZXNjcmlwdGlvbiwgb3JkZXJlZCwgY2FsbGJhY2tzLCBub25NdXRhdGluZ0NhbGxiYWNrcykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmIChjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRhaWxhYmxlKSB7XG4gICAgICByZXR1cm4gc2VsZi5fb2JzZXJ2ZUNoYW5nZXNUYWlsYWJsZShjdXJzb3JEZXNjcmlwdGlvbiwgb3JkZXJlZCwgY2FsbGJhY2tzKTtcbiAgICB9XG5cbiAgICAvLyBZb3UgbWF5IG5vdCBmaWx0ZXIgb3V0IF9pZCB3aGVuIG9ic2VydmluZyBjaGFuZ2VzLCBiZWNhdXNlIHRoZSBpZCBpcyBhIGNvcmVcbiAgICAvLyBwYXJ0IG9mIHRoZSBvYnNlcnZlQ2hhbmdlcyBBUEkuXG4gICAgY29uc3QgZmllbGRzT3B0aW9ucyA9IGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucHJvamVjdGlvbiB8fCBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLmZpZWxkcztcbiAgICBpZiAoZmllbGRzT3B0aW9ucyAmJlxuICAgICAgICAoZmllbGRzT3B0aW9ucy5faWQgPT09IDAgfHxcbiAgICAgICAgICAgIGZpZWxkc09wdGlvbnMuX2lkID09PSBmYWxzZSkpIHtcbiAgICAgIHRocm93IEVycm9yKFwiWW91IG1heSBub3Qgb2JzZXJ2ZSBhIGN1cnNvciB3aXRoIHtmaWVsZHM6IHtfaWQ6IDB9fVwiKTtcbiAgICB9XG5cbiAgICB2YXIgb2JzZXJ2ZUtleSA9IEVKU09OLnN0cmluZ2lmeShcbiAgICAgICAgXy5leHRlbmQoe29yZGVyZWQ6IG9yZGVyZWR9LCBjdXJzb3JEZXNjcmlwdGlvbikpO1xuXG4gICAgdmFyIG11bHRpcGxleGVyLCBvYnNlcnZlRHJpdmVyO1xuICAgIHZhciBmaXJzdEhhbmRsZSA9IGZhbHNlO1xuXG4gICAgLy8gRmluZCBhIG1hdGNoaW5nIE9ic2VydmVNdWx0aXBsZXhlciwgb3IgY3JlYXRlIGEgbmV3IG9uZS4gVGhpcyBuZXh0IGJsb2NrIGlzXG4gICAgLy8gZ3VhcmFudGVlZCB0byBub3QgeWllbGQgKGFuZCBpdCBkb2Vzbid0IGNhbGwgYW55dGhpbmcgdGhhdCBjYW4gb2JzZXJ2ZSBhXG4gICAgLy8gbmV3IHF1ZXJ5KSwgc28gbm8gb3RoZXIgY2FsbHMgdG8gdGhpcyBmdW5jdGlvbiBjYW4gaW50ZXJsZWF2ZSB3aXRoIGl0LlxuICAgIGlmIChfLmhhcyhzZWxmLl9vYnNlcnZlTXVsdGlwbGV4ZXJzLCBvYnNlcnZlS2V5KSkge1xuICAgICAgbXVsdGlwbGV4ZXIgPSBzZWxmLl9vYnNlcnZlTXVsdGlwbGV4ZXJzW29ic2VydmVLZXldO1xuICAgIH0gZWxzZSB7XG4gICAgICBmaXJzdEhhbmRsZSA9IHRydWU7XG4gICAgICAvLyBDcmVhdGUgYSBuZXcgT2JzZXJ2ZU11bHRpcGxleGVyLlxuICAgICAgbXVsdGlwbGV4ZXIgPSBuZXcgT2JzZXJ2ZU11bHRpcGxleGVyKHtcbiAgICAgICAgb3JkZXJlZDogb3JkZXJlZCxcbiAgICAgICAgb25TdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgZGVsZXRlIHNlbGYuX29ic2VydmVNdWx0aXBsZXhlcnNbb2JzZXJ2ZUtleV07XG4gICAgICAgICAgcmV0dXJuIG9ic2VydmVEcml2ZXIuc3RvcCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB2YXIgb2JzZXJ2ZUhhbmRsZSA9IG5ldyBPYnNlcnZlSGFuZGxlKG11bHRpcGxleGVyLFxuICAgICAgICBjYWxsYmFja3MsXG4gICAgICAgIG5vbk11dGF0aW5nQ2FsbGJhY2tzLFxuICAgICk7XG5cbiAgICBpZiAoZmlyc3RIYW5kbGUpIHtcbiAgICAgIHZhciBtYXRjaGVyLCBzb3J0ZXI7XG4gICAgICB2YXIgY2FuVXNlT3Bsb2cgPSBfLmFsbChbXG4gICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAvLyBBdCBhIGJhcmUgbWluaW11bSwgdXNpbmcgdGhlIG9wbG9nIHJlcXVpcmVzIHVzIHRvIGhhdmUgYW4gb3Bsb2csIHRvXG4gICAgICAgICAgLy8gd2FudCB1bm9yZGVyZWQgY2FsbGJhY2tzLCBhbmQgdG8gbm90IHdhbnQgYSBjYWxsYmFjayBvbiB0aGUgcG9sbHNcbiAgICAgICAgICAvLyB0aGF0IHdvbid0IGhhcHBlbi5cbiAgICAgICAgICByZXR1cm4gc2VsZi5fb3Bsb2dIYW5kbGUgJiYgIW9yZGVyZWQgJiZcbiAgICAgICAgICAgICAgIWNhbGxiYWNrcy5fdGVzdE9ubHlQb2xsQ2FsbGJhY2s7XG4gICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAvLyBXZSBuZWVkIHRvIGJlIGFibGUgdG8gY29tcGlsZSB0aGUgc2VsZWN0b3IuIEZhbGwgYmFjayB0byBwb2xsaW5nIGZvclxuICAgICAgICAgIC8vIHNvbWUgbmV3ZmFuZ2xlZCAkc2VsZWN0b3IgdGhhdCBtaW5pbW9uZ28gZG9lc24ndCBzdXBwb3J0IHlldC5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgbWF0Y2hlciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcihjdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3Rvcik7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBYWFggbWFrZSBhbGwgY29tcGlsYXRpb24gZXJyb3JzIE1pbmltb25nb0Vycm9yIG9yIHNvbWV0aGluZ1xuICAgICAgICAgICAgLy8gICAgIHNvIHRoYXQgdGhpcyBkb2Vzbid0IGlnbm9yZSB1bnJlbGF0ZWQgZXhjZXB0aW9uc1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIC8vIC4uLiBhbmQgdGhlIHNlbGVjdG9yIGl0c2VsZiBuZWVkcyB0byBzdXBwb3J0IG9wbG9nLlxuICAgICAgICAgIHJldHVybiBPcGxvZ09ic2VydmVEcml2ZXIuY3Vyc29yU3VwcG9ydGVkKGN1cnNvckRlc2NyaXB0aW9uLCBtYXRjaGVyKTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIC8vIEFuZCB3ZSBuZWVkIHRvIGJlIGFibGUgdG8gY29tcGlsZSB0aGUgc29ydCwgaWYgYW55LiAgZWcsIGNhbid0IGJlXG4gICAgICAgICAgLy8geyRuYXR1cmFsOiAxfS5cbiAgICAgICAgICBpZiAoIWN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMuc29ydClcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzb3J0ZXIgPSBuZXcgTWluaW1vbmdvLlNvcnRlcihjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnNvcnQpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gWFhYIG1ha2UgYWxsIGNvbXBpbGF0aW9uIGVycm9ycyBNaW5pbW9uZ29FcnJvciBvciBzb21ldGhpbmdcbiAgICAgICAgICAgIC8vICAgICBzbyB0aGF0IHRoaXMgZG9lc24ndCBpZ25vcmUgdW5yZWxhdGVkIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1dLCBmdW5jdGlvbiAoZikgeyByZXR1cm4gZigpOyB9KTsgIC8vIGludm9rZSBlYWNoIGZ1bmN0aW9uXG5cbiAgICAgIHZhciBkcml2ZXJDbGFzcyA9IGNhblVzZU9wbG9nID8gT3Bsb2dPYnNlcnZlRHJpdmVyIDogUG9sbGluZ09ic2VydmVEcml2ZXI7XG4gICAgICBvYnNlcnZlRHJpdmVyID0gbmV3IGRyaXZlckNsYXNzKHtcbiAgICAgICAgY3Vyc29yRGVzY3JpcHRpb246IGN1cnNvckRlc2NyaXB0aW9uLFxuICAgICAgICBtb25nb0hhbmRsZTogc2VsZixcbiAgICAgICAgbXVsdGlwbGV4ZXI6IG11bHRpcGxleGVyLFxuICAgICAgICBvcmRlcmVkOiBvcmRlcmVkLFxuICAgICAgICBtYXRjaGVyOiBtYXRjaGVyLCAgLy8gaWdub3JlZCBieSBwb2xsaW5nXG4gICAgICAgIHNvcnRlcjogc29ydGVyLCAgLy8gaWdub3JlZCBieSBwb2xsaW5nXG4gICAgICAgIF90ZXN0T25seVBvbGxDYWxsYmFjazogY2FsbGJhY2tzLl90ZXN0T25seVBvbGxDYWxsYmFja1xuICAgICAgfSk7XG5cbiAgICAgIGlmIChvYnNlcnZlRHJpdmVyLl9pbml0KSB7XG4gICAgICAgIGF3YWl0IG9ic2VydmVEcml2ZXIuX2luaXQoKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhpcyBmaWVsZCBpcyBvbmx5IHNldCBmb3IgdXNlIGluIHRlc3RzLlxuICAgICAgbXVsdGlwbGV4ZXIuX29ic2VydmVEcml2ZXIgPSBvYnNlcnZlRHJpdmVyO1xuICAgIH1cbiAgICBzZWxmLl9vYnNlcnZlTXVsdGlwbGV4ZXJzW29ic2VydmVLZXldID0gbXVsdGlwbGV4ZXI7XG4gICAgLy8gQmxvY2tzIHVudGlsIHRoZSBpbml0aWFsIGFkZHMgaGF2ZSBiZWVuIHNlbnQuXG4gICAgYXdhaXQgbXVsdGlwbGV4ZXIuYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzKG9ic2VydmVIYW5kbGUpO1xuXG4gICAgcmV0dXJuIG9ic2VydmVIYW5kbGU7XG4gIH0sXG5cbn0pO1xuXG5cbi8vIExpc3RlbiBmb3IgdGhlIGludmFsaWRhdGlvbiBtZXNzYWdlcyB0aGF0IHdpbGwgdHJpZ2dlciB1cyB0byBwb2xsIHRoZVxuLy8gZGF0YWJhc2UgZm9yIGNoYW5nZXMuIElmIHRoaXMgc2VsZWN0b3Igc3BlY2lmaWVzIHNwZWNpZmljIElEcywgc3BlY2lmeSB0aGVtXG4vLyBoZXJlLCBzbyB0aGF0IHVwZGF0ZXMgdG8gZGlmZmVyZW50IHNwZWNpZmljIElEcyBkb24ndCBjYXVzZSB1cyB0byBwb2xsLlxuLy8gbGlzdGVuQ2FsbGJhY2sgaXMgdGhlIHNhbWUga2luZCBvZiAobm90aWZpY2F0aW9uLCBjb21wbGV0ZSkgY2FsbGJhY2sgcGFzc2VkXG4vLyB0byBJbnZhbGlkYXRpb25Dcm9zc2Jhci5saXN0ZW4uXG5cbmxpc3RlbkFsbCA9IGZ1bmN0aW9uIChjdXJzb3JEZXNjcmlwdGlvbiwgbGlzdGVuQ2FsbGJhY2spIHtcbiAgdmFyIGxpc3RlbmVycyA9IFtdO1xuICBmb3JFYWNoVHJpZ2dlcihjdXJzb3JEZXNjcmlwdGlvbiwgZnVuY3Rpb24gKHRyaWdnZXIpIHtcbiAgICBsaXN0ZW5lcnMucHVzaChERFBTZXJ2ZXIuX0ludmFsaWRhdGlvbkNyb3NzYmFyLmxpc3RlbihcbiAgICAgIHRyaWdnZXIsIGxpc3RlbkNhbGxiYWNrKSk7XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgXy5lYWNoKGxpc3RlbmVycywgZnVuY3Rpb24gKGxpc3RlbmVyKSB7XG4gICAgICAgIGxpc3RlbmVyLnN0b3AoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbn07XG5cbmZvckVhY2hUcmlnZ2VyID0gZnVuY3Rpb24gKGN1cnNvckRlc2NyaXB0aW9uLCB0cmlnZ2VyQ2FsbGJhY2spIHtcbiAgdmFyIGtleSA9IHtjb2xsZWN0aW9uOiBjdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZX07XG4gIHZhciBzcGVjaWZpY0lkcyA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3IoXG4gICAgY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IpO1xuICBpZiAoc3BlY2lmaWNJZHMpIHtcbiAgICBfLmVhY2goc3BlY2lmaWNJZHMsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgdHJpZ2dlckNhbGxiYWNrKF8uZXh0ZW5kKHtpZDogaWR9LCBrZXkpKTtcbiAgICB9KTtcbiAgICB0cmlnZ2VyQ2FsbGJhY2soXy5leHRlbmQoe2Ryb3BDb2xsZWN0aW9uOiB0cnVlLCBpZDogbnVsbH0sIGtleSkpO1xuICB9IGVsc2Uge1xuICAgIHRyaWdnZXJDYWxsYmFjayhrZXkpO1xuICB9XG4gIC8vIEV2ZXJ5b25lIGNhcmVzIGFib3V0IHRoZSBkYXRhYmFzZSBiZWluZyBkcm9wcGVkLlxuICB0cmlnZ2VyQ2FsbGJhY2soeyBkcm9wRGF0YWJhc2U6IHRydWUgfSk7XG59O1xuXG4vLyBvYnNlcnZlQ2hhbmdlcyBmb3IgdGFpbGFibGUgY3Vyc29ycyBvbiBjYXBwZWQgY29sbGVjdGlvbnMuXG4vL1xuLy8gU29tZSBkaWZmZXJlbmNlcyBmcm9tIG5vcm1hbCBjdXJzb3JzOlxuLy8gICAtIFdpbGwgbmV2ZXIgcHJvZHVjZSBhbnl0aGluZyBvdGhlciB0aGFuICdhZGRlZCcgb3IgJ2FkZGVkQmVmb3JlJy4gSWYgeW91XG4vLyAgICAgZG8gdXBkYXRlIGEgZG9jdW1lbnQgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHByb2R1Y2VkLCB0aGlzIHdpbGwgbm90IG5vdGljZVxuLy8gICAgIGl0LlxuLy8gICAtIElmIHlvdSBkaXNjb25uZWN0IGFuZCByZWNvbm5lY3QgZnJvbSBNb25nbywgaXQgd2lsbCBlc3NlbnRpYWxseSByZXN0YXJ0XG4vLyAgICAgdGhlIHF1ZXJ5LCB3aGljaCB3aWxsIGxlYWQgdG8gZHVwbGljYXRlIHJlc3VsdHMuIFRoaXMgaXMgcHJldHR5IGJhZCxcbi8vICAgICBidXQgaWYgeW91IGluY2x1ZGUgYSBmaWVsZCBjYWxsZWQgJ3RzJyB3aGljaCBpcyBpbnNlcnRlZCBhc1xuLy8gICAgIG5ldyBNb25nb0ludGVybmFscy5Nb25nb1RpbWVzdGFtcCgwLCAwKSAod2hpY2ggaXMgaW5pdGlhbGl6ZWQgdG8gdGhlXG4vLyAgICAgY3VycmVudCBNb25nby1zdHlsZSB0aW1lc3RhbXApLCB3ZSdsbCBiZSBhYmxlIHRvIGZpbmQgdGhlIHBsYWNlIHRvXG4vLyAgICAgcmVzdGFydCBwcm9wZXJseS4gKFRoaXMgZmllbGQgaXMgc3BlY2lmaWNhbGx5IHVuZGVyc3Rvb2QgYnkgTW9uZ28gd2l0aCBhblxuLy8gICAgIG9wdGltaXphdGlvbiB3aGljaCBhbGxvd3MgaXQgdG8gZmluZCB0aGUgcmlnaHQgcGxhY2UgdG8gc3RhcnQgd2l0aG91dFxuLy8gICAgIGFuIGluZGV4IG9uIHRzLiBJdCdzIGhvdyB0aGUgb3Bsb2cgd29ya3MuKVxuLy8gICAtIE5vIGNhbGxiYWNrcyBhcmUgdHJpZ2dlcmVkIHN5bmNocm9ub3VzbHkgd2l0aCB0aGUgY2FsbCAodGhlcmUncyBub1xuLy8gICAgIGRpZmZlcmVudGlhdGlvbiBiZXR3ZWVuIFwiaW5pdGlhbCBkYXRhXCIgYW5kIFwibGF0ZXIgY2hhbmdlc1wiOyBldmVyeXRoaW5nXG4vLyAgICAgdGhhdCBtYXRjaGVzIHRoZSBxdWVyeSBnZXRzIHNlbnQgYXN5bmNocm9ub3VzbHkpLlxuLy8gICAtIERlLWR1cGxpY2F0aW9uIGlzIG5vdCBpbXBsZW1lbnRlZC5cbi8vICAgLSBEb2VzIG5vdCB5ZXQgaW50ZXJhY3Qgd2l0aCB0aGUgd3JpdGUgZmVuY2UuIFByb2JhYmx5LCB0aGlzIHNob3VsZCB3b3JrIGJ5XG4vLyAgICAgaWdub3JpbmcgcmVtb3ZlcyAod2hpY2ggZG9uJ3Qgd29yayBvbiBjYXBwZWQgY29sbGVjdGlvbnMpIGFuZCB1cGRhdGVzXG4vLyAgICAgKHdoaWNoIGRvbid0IGFmZmVjdCB0YWlsYWJsZSBjdXJzb3JzKSwgYW5kIGp1c3Qga2VlcGluZyB0cmFjayBvZiB0aGUgSURcbi8vICAgICBvZiB0aGUgaW5zZXJ0ZWQgb2JqZWN0LCBhbmQgY2xvc2luZyB0aGUgd3JpdGUgZmVuY2Ugb25jZSB5b3UgZ2V0IHRvIHRoYXRcbi8vICAgICBJRCAob3IgdGltZXN0YW1wPykuICBUaGlzIGRvZXNuJ3Qgd29yayB3ZWxsIGlmIHRoZSBkb2N1bWVudCBkb2Vzbid0IG1hdGNoXG4vLyAgICAgdGhlIHF1ZXJ5LCB0aG91Z2guICBPbiB0aGUgb3RoZXIgaGFuZCwgdGhlIHdyaXRlIGZlbmNlIGNhbiBjbG9zZVxuLy8gICAgIGltbWVkaWF0ZWx5IGlmIGl0IGRvZXMgbm90IG1hdGNoIHRoZSBxdWVyeS4gU28gaWYgd2UgdHJ1c3QgbWluaW1vbmdvXG4vLyAgICAgZW5vdWdoIHRvIGFjY3VyYXRlbHkgZXZhbHVhdGUgdGhlIHF1ZXJ5IGFnYWluc3QgdGhlIHdyaXRlIGZlbmNlLCB3ZVxuLy8gICAgIHNob3VsZCBiZSBhYmxlIHRvIGRvIHRoaXMuLi4gIE9mIGNvdXJzZSwgbWluaW1vbmdvIGRvZXNuJ3QgZXZlbiBzdXBwb3J0XG4vLyAgICAgTW9uZ28gVGltZXN0YW1wcyB5ZXQuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9vYnNlcnZlQ2hhbmdlc1RhaWxhYmxlID0gZnVuY3Rpb24gKFxuICAgIGN1cnNvckRlc2NyaXB0aW9uLCBvcmRlcmVkLCBjYWxsYmFja3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIFRhaWxhYmxlIGN1cnNvcnMgb25seSBldmVyIGNhbGwgYWRkZWQvYWRkZWRCZWZvcmUgY2FsbGJhY2tzLCBzbyBpdCdzIGFuXG4gIC8vIGVycm9yIGlmIHlvdSBkaWRuJ3QgcHJvdmlkZSB0aGVtLlxuICBpZiAoKG9yZGVyZWQgJiYgIWNhbGxiYWNrcy5hZGRlZEJlZm9yZSkgfHxcbiAgICAgICghb3JkZXJlZCAmJiAhY2FsbGJhY2tzLmFkZGVkKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IG9ic2VydmUgYW4gXCIgKyAob3JkZXJlZCA/IFwib3JkZXJlZFwiIDogXCJ1bm9yZGVyZWRcIilcbiAgICAgICAgICAgICAgICAgICAgKyBcIiB0YWlsYWJsZSBjdXJzb3Igd2l0aG91dCBhIFwiXG4gICAgICAgICAgICAgICAgICAgICsgKG9yZGVyZWQgPyBcImFkZGVkQmVmb3JlXCIgOiBcImFkZGVkXCIpICsgXCIgY2FsbGJhY2tcIik7XG4gIH1cblxuICByZXR1cm4gc2VsZi50YWlsKGN1cnNvckRlc2NyaXB0aW9uLCBmdW5jdGlvbiAoZG9jKSB7XG4gICAgdmFyIGlkID0gZG9jLl9pZDtcbiAgICBkZWxldGUgZG9jLl9pZDtcbiAgICAvLyBUaGUgdHMgaXMgYW4gaW1wbGVtZW50YXRpb24gZGV0YWlsLiBIaWRlIGl0LlxuICAgIGRlbGV0ZSBkb2MudHM7XG4gICAgaWYgKG9yZGVyZWQpIHtcbiAgICAgIGNhbGxiYWNrcy5hZGRlZEJlZm9yZShpZCwgZG9jLCBudWxsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2tzLmFkZGVkKGlkLCBkb2MpO1xuICAgIH1cbiAgfSk7XG59O1xuXG4vLyBYWFggV2UgcHJvYmFibHkgbmVlZCB0byBmaW5kIGEgYmV0dGVyIHdheSB0byBleHBvc2UgdGhpcy4gUmlnaHQgbm93XG4vLyBpdCdzIG9ubHkgdXNlZCBieSB0ZXN0cywgYnV0IGluIGZhY3QgeW91IG5lZWQgaXQgaW4gbm9ybWFsXG4vLyBvcGVyYXRpb24gdG8gaW50ZXJhY3Qgd2l0aCBjYXBwZWQgY29sbGVjdGlvbnMuXG5Nb25nb0ludGVybmFscy5Nb25nb1RpbWVzdGFtcCA9IE1vbmdvREIuVGltZXN0YW1wO1xuXG5Nb25nb0ludGVybmFscy5Db25uZWN0aW9uID0gTW9uZ29Db25uZWN0aW9uO1xuIiwiaW1wb3J0IHsgTnBtTW9kdWxlTW9uZ29kYiB9IGZyb20gXCJtZXRlb3IvbnBtLW1vbmdvXCI7XG5jb25zdCB7IExvbmcgfSA9IE5wbU1vZHVsZU1vbmdvZGI7XG5cbk9QTE9HX0NPTExFQ1RJT04gPSAnb3Bsb2cucnMnO1xuXG52YXIgVE9PX0ZBUl9CRUhJTkQgPSBwcm9jZXNzLmVudi5NRVRFT1JfT1BMT0dfVE9PX0ZBUl9CRUhJTkQgfHwgMjAwMDtcbnZhciBUQUlMX1RJTUVPVVQgPSArcHJvY2Vzcy5lbnYuTUVURU9SX09QTE9HX1RBSUxfVElNRU9VVCB8fCAzMDAwMDtcblxuaWRGb3JPcCA9IGZ1bmN0aW9uIChvcCkge1xuICBpZiAob3Aub3AgPT09ICdkJylcbiAgICByZXR1cm4gb3Auby5faWQ7XG4gIGVsc2UgaWYgKG9wLm9wID09PSAnaScpXG4gICAgcmV0dXJuIG9wLm8uX2lkO1xuICBlbHNlIGlmIChvcC5vcCA9PT0gJ3UnKVxuICAgIHJldHVybiBvcC5vMi5faWQ7XG4gIGVsc2UgaWYgKG9wLm9wID09PSAnYycpXG4gICAgdGhyb3cgRXJyb3IoXCJPcGVyYXRvciAnYycgZG9lc24ndCBzdXBwbHkgYW4gb2JqZWN0IHdpdGggaWQ6IFwiICtcbiAgICAgICAgICAgICAgICBFSlNPTi5zdHJpbmdpZnkob3ApKTtcbiAgZWxzZVxuICAgIHRocm93IEVycm9yKFwiVW5rbm93biBvcDogXCIgKyBFSlNPTi5zdHJpbmdpZnkob3ApKTtcbn07XG5cbk9wbG9nSGFuZGxlID0gZnVuY3Rpb24gKG9wbG9nVXJsLCBkYk5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLl9vcGxvZ1VybCA9IG9wbG9nVXJsO1xuICBzZWxmLl9kYk5hbWUgPSBkYk5hbWU7XG5cbiAgc2VsZi5fb3Bsb2dMYXN0RW50cnlDb25uZWN0aW9uID0gbnVsbDtcbiAgc2VsZi5fb3Bsb2dUYWlsQ29ubmVjdGlvbiA9IG51bGw7XG4gIHNlbGYuX3N0b3BwZWQgPSBmYWxzZTtcbiAgc2VsZi5fdGFpbEhhbmRsZSA9IG51bGw7XG4gIHNlbGYuX3JlYWR5UHJvbWlzZVJlc29sdmVyID0gbnVsbDtcbiAgc2VsZi5fcmVhZHlQcm9taXNlID0gbmV3IFByb21pc2UociA9PiBzZWxmLl9yZWFkeVByb21pc2VSZXNvbHZlciA9IHIpO1xuICBzZWxmLl9jcm9zc2JhciA9IG5ldyBERFBTZXJ2ZXIuX0Nyb3NzYmFyKHtcbiAgICBmYWN0UGFja2FnZTogXCJtb25nby1saXZlZGF0YVwiLCBmYWN0TmFtZTogXCJvcGxvZy13YXRjaGVyc1wiXG4gIH0pO1xuICBzZWxmLl9iYXNlT3Bsb2dTZWxlY3RvciA9IHtcbiAgICBuczogbmV3IFJlZ0V4cChcIl4oPzpcIiArIFtcbiAgICAgIE1ldGVvci5fZXNjYXBlUmVnRXhwKHNlbGYuX2RiTmFtZSArIFwiLlwiKSxcbiAgICAgIE1ldGVvci5fZXNjYXBlUmVnRXhwKFwiYWRtaW4uJGNtZFwiKSxcbiAgICBdLmpvaW4oXCJ8XCIpICsgXCIpXCIpLFxuXG4gICAgJG9yOiBbXG4gICAgICB7IG9wOiB7ICRpbjogWydpJywgJ3UnLCAnZCddIH0gfSxcbiAgICAgIC8vIGRyb3AgY29sbGVjdGlvblxuICAgICAgeyBvcDogJ2MnLCAnby5kcm9wJzogeyAkZXhpc3RzOiB0cnVlIH0gfSxcbiAgICAgIHsgb3A6ICdjJywgJ28uZHJvcERhdGFiYXNlJzogMSB9LFxuICAgICAgeyBvcDogJ2MnLCAnby5hcHBseU9wcyc6IHsgJGV4aXN0czogdHJ1ZSB9IH0sXG4gICAgXVxuICB9O1xuXG4gIC8vIERhdGEgc3RydWN0dXJlcyB0byBzdXBwb3J0IHdhaXRVbnRpbENhdWdodFVwKCkuIEVhY2ggb3Bsb2cgZW50cnkgaGFzIGFcbiAgLy8gTW9uZ29UaW1lc3RhbXAgb2JqZWN0IG9uIGl0ICh3aGljaCBpcyBub3QgdGhlIHNhbWUgYXMgYSBEYXRlIC0tLSBpdCdzIGFcbiAgLy8gY29tYmluYXRpb24gb2YgdGltZSBhbmQgYW4gaW5jcmVtZW50aW5nIGNvdW50ZXI7IHNlZVxuICAvLyBodHRwOi8vZG9jcy5tb25nb2RiLm9yZy9tYW51YWwvcmVmZXJlbmNlL2Jzb24tdHlwZXMvI3RpbWVzdGFtcHMpLlxuICAvL1xuICAvLyBfY2F0Y2hpbmdVcEZ1dHVyZXMgaXMgYW4gYXJyYXkgb2Yge3RzOiBNb25nb1RpbWVzdGFtcCwgZnV0dXJlOiBGdXR1cmV9XG4gIC8vIG9iamVjdHMsIHNvcnRlZCBieSBhc2NlbmRpbmcgdGltZXN0YW1wLiBfbGFzdFByb2Nlc3NlZFRTIGlzIHRoZVxuICAvLyBNb25nb1RpbWVzdGFtcCBvZiB0aGUgbGFzdCBvcGxvZyBlbnRyeSB3ZSd2ZSBwcm9jZXNzZWQuXG4gIC8vXG4gIC8vIEVhY2ggdGltZSB3ZSBjYWxsIHdhaXRVbnRpbENhdWdodFVwLCB3ZSB0YWtlIGEgcGVlayBhdCB0aGUgZmluYWwgb3Bsb2dcbiAgLy8gZW50cnkgaW4gdGhlIGRiLiAgSWYgd2UndmUgYWxyZWFkeSBwcm9jZXNzZWQgaXQgKGllLCBpdCBpcyBub3QgZ3JlYXRlciB0aGFuXG4gIC8vIF9sYXN0UHJvY2Vzc2VkVFMpLCB3YWl0VW50aWxDYXVnaHRVcCBpbW1lZGlhdGVseSByZXR1cm5zLiBPdGhlcndpc2UsXG4gIC8vIHdhaXRVbnRpbENhdWdodFVwIG1ha2VzIGEgbmV3IEZ1dHVyZSBhbmQgaW5zZXJ0cyBpdCBhbG9uZyB3aXRoIHRoZSBmaW5hbFxuICAvLyB0aW1lc3RhbXAgZW50cnkgdGhhdCBpdCByZWFkLCBpbnRvIF9jYXRjaGluZ1VwRnV0dXJlcy4gd2FpdFVudGlsQ2F1Z2h0VXBcbiAgLy8gdGhlbiB3YWl0cyBvbiB0aGF0IGZ1dHVyZSwgd2hpY2ggaXMgcmVzb2x2ZWQgb25jZSBfbGFzdFByb2Nlc3NlZFRTIGlzXG4gIC8vIGluY3JlbWVudGVkIHRvIGJlIHBhc3QgaXRzIHRpbWVzdGFtcCBieSB0aGUgd29ya2VyIGZpYmVyLlxuICAvL1xuICAvLyBYWFggdXNlIGEgcHJpb3JpdHkgcXVldWUgb3Igc29tZXRoaW5nIGVsc2UgdGhhdCdzIGZhc3RlciB0aGFuIGFuIGFycmF5XG4gIHNlbGYuX2NhdGNoaW5nVXBSZXNvbHZlcnMgPSBbXTtcbiAgc2VsZi5fbGFzdFByb2Nlc3NlZFRTID0gbnVsbDtcblxuICBzZWxmLl9vblNraXBwZWRFbnRyaWVzSG9vayA9IG5ldyBIb29rKHtcbiAgICBkZWJ1Z1ByaW50RXhjZXB0aW9uczogXCJvblNraXBwZWRFbnRyaWVzIGNhbGxiYWNrXCJcbiAgfSk7XG5cbiAgc2VsZi5fZW50cnlRdWV1ZSA9IG5ldyBNZXRlb3IuX0RvdWJsZUVuZGVkUXVldWUoKTtcbiAgc2VsZi5fd29ya2VyQWN0aXZlID0gZmFsc2U7XG5cbiAgY29uc3Qgc2hvdWxkQXdhaXQgPSBzZWxmLl9zdGFydFRhaWxpbmcoKTtcbiAgLy9UT0RPW2ZpYmVyc10gV2h5IHdhaXQ/XG59O1xuXG5PYmplY3QuYXNzaWduKE9wbG9nSGFuZGxlLnByb3RvdHlwZSwge1xuICBzdG9wOiBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuO1xuICAgIHNlbGYuX3N0b3BwZWQgPSB0cnVlO1xuICAgIGlmIChzZWxmLl90YWlsSGFuZGxlKVxuICAgICAgYXdhaXQgc2VsZi5fdGFpbEhhbmRsZS5zdG9wKCk7XG4gICAgLy8gWFhYIHNob3VsZCBjbG9zZSBjb25uZWN0aW9ucyB0b29cbiAgfSxcbiAgX29uT3Bsb2dFbnRyeTogYXN5bmMgZnVuY3Rpb24odHJpZ2dlciwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsZWQgb25PcGxvZ0VudHJ5IG9uIHN0b3BwZWQgaGFuZGxlIVwiKTtcblxuICAgIC8vIENhbGxpbmcgb25PcGxvZ0VudHJ5IHJlcXVpcmVzIHVzIHRvIHdhaXQgZm9yIHRoZSB0YWlsaW5nIHRvIGJlIHJlYWR5LlxuICAgIGF3YWl0IHNlbGYuX3JlYWR5UHJvbWlzZTtcblxuICAgIHZhciBvcmlnaW5hbENhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgY2FsbGJhY2sgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KGZ1bmN0aW9uIChub3RpZmljYXRpb24pIHtcbiAgICAgIG9yaWdpbmFsQ2FsbGJhY2sobm90aWZpY2F0aW9uKTtcbiAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKFwiRXJyb3IgaW4gb3Bsb2cgY2FsbGJhY2tcIiwgZXJyKTtcbiAgICB9KTtcbiAgICB2YXIgbGlzdGVuSGFuZGxlID0gc2VsZi5fY3Jvc3NiYXIubGlzdGVuKHRyaWdnZXIsIGNhbGxiYWNrKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3RvcDogYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBhd2FpdCBsaXN0ZW5IYW5kbGUuc3RvcCgpO1xuICAgICAgfVxuICAgIH07XG4gIH0sXG4gIG9uT3Bsb2dFbnRyeTogZnVuY3Rpb24gKHRyaWdnZXIsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMuX29uT3Bsb2dFbnRyeSh0cmlnZ2VyLCBjYWxsYmFjayk7XG4gIH0sXG4gIC8vIFJlZ2lzdGVyIGEgY2FsbGJhY2sgdG8gYmUgaW52b2tlZCBhbnkgdGltZSB3ZSBza2lwIG9wbG9nIGVudHJpZXMgKGVnLFxuICAvLyBiZWNhdXNlIHdlIGFyZSB0b28gZmFyIGJlaGluZCkuXG4gIG9uU2tpcHBlZEVudHJpZXM6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbGxlZCBvblNraXBwZWRFbnRyaWVzIG9uIHN0b3BwZWQgaGFuZGxlIVwiKTtcbiAgICByZXR1cm4gc2VsZi5fb25Ta2lwcGVkRW50cmllc0hvb2sucmVnaXN0ZXIoY2FsbGJhY2spO1xuICB9LFxuXG4gIGFzeW5jIF93YWl0VW50aWxDYXVnaHRVcCgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsZWQgd2FpdFVudGlsQ2F1Z2h0VXAgb24gc3RvcHBlZCBoYW5kbGUhXCIpO1xuXG4gICAgLy8gQ2FsbGluZyB3YWl0VW50aWxDYXVnaHRVcCByZXF1cmllcyB1cyB0byB3YWl0IGZvciB0aGUgb3Bsb2cgY29ubmVjdGlvbiB0b1xuICAgIC8vIGJlIHJlYWR5LlxuICAgIGF3YWl0IHNlbGYuX3JlYWR5UHJvbWlzZTtcbiAgICB2YXIgbGFzdEVudHJ5O1xuXG4gICAgd2hpbGUgKCFzZWxmLl9zdG9wcGVkKSB7XG4gICAgICAvLyBXZSBuZWVkIHRvIG1ha2UgdGhlIHNlbGVjdG9yIGF0IGxlYXN0IGFzIHJlc3RyaWN0aXZlIGFzIHRoZSBhY3R1YWxcbiAgICAgIC8vIHRhaWxpbmcgc2VsZWN0b3IgKGllLCB3ZSBuZWVkIHRvIHNwZWNpZnkgdGhlIERCIG5hbWUpIG9yIGVsc2Ugd2UgbWlnaHRcbiAgICAgIC8vIGZpbmQgYSBUUyB0aGF0IHdvbid0IHNob3cgdXAgaW4gdGhlIGFjdHVhbCB0YWlsIHN0cmVhbS5cbiAgICAgIHRyeSB7XG4gICAgICAgIGxhc3RFbnRyeSA9IGF3YWl0IHNlbGYuX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbi5maW5kT25lQXN5bmMoXG4gICAgICAgICAgT1BMT0dfQ09MTEVDVElPTixcbiAgICAgICAgICBzZWxmLl9iYXNlT3Bsb2dTZWxlY3RvcixcbiAgICAgICAgICB7IHByb2plY3Rpb246IHsgdHM6IDEgfSwgc29ydDogeyAkbmF0dXJhbDogLTEgfSB9XG4gICAgICAgICk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBEdXJpbmcgZmFpbG92ZXIgKGVnKSBpZiB3ZSBnZXQgYW4gZXhjZXB0aW9uIHdlIHNob3VsZCBsb2cgYW5kIHJldHJ5XG4gICAgICAgIC8vIGluc3RlYWQgb2YgY3Jhc2hpbmcuXG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJHb3QgZXhjZXB0aW9uIHdoaWxlIHJlYWRpbmcgbGFzdCBlbnRyeVwiLCBlKTtcbiAgICAgICAgYXdhaXQgTWV0ZW9yLl9zbGVlcEZvck1zKDEwMCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoIWxhc3RFbnRyeSkge1xuICAgICAgLy8gUmVhbGx5LCBub3RoaW5nIGluIHRoZSBvcGxvZz8gV2VsbCwgd2UndmUgcHJvY2Vzc2VkIGV2ZXJ5dGhpbmcuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHRzID0gbGFzdEVudHJ5LnRzO1xuICAgIGlmICghdHMpXG4gICAgICB0aHJvdyBFcnJvcihcIm9wbG9nIGVudHJ5IHdpdGhvdXQgdHM6IFwiICsgRUpTT04uc3RyaW5naWZ5KGxhc3RFbnRyeSkpO1xuXG4gICAgaWYgKHNlbGYuX2xhc3RQcm9jZXNzZWRUUyAmJiB0cy5sZXNzVGhhbk9yRXF1YWwoc2VsZi5fbGFzdFByb2Nlc3NlZFRTKSkge1xuICAgICAgLy8gV2UndmUgYWxyZWFkeSBjYXVnaHQgdXAgdG8gaGVyZS5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cblxuICAgIC8vIEluc2VydCB0aGUgZnV0dXJlIGludG8gb3VyIGxpc3QuIEFsbW9zdCBhbHdheXMsIHRoaXMgd2lsbCBiZSBhdCB0aGUgZW5kLFxuICAgIC8vIGJ1dCBpdCdzIGNvbmNlaXZhYmxlIHRoYXQgaWYgd2UgZmFpbCBvdmVyIGZyb20gb25lIHByaW1hcnkgdG8gYW5vdGhlcixcbiAgICAvLyB0aGUgb3Bsb2cgZW50cmllcyB3ZSBzZWUgd2lsbCBnbyBiYWNrd2FyZHMuXG4gICAgdmFyIGluc2VydEFmdGVyID0gc2VsZi5fY2F0Y2hpbmdVcFJlc29sdmVycy5sZW5ndGg7XG4gICAgd2hpbGUgKGluc2VydEFmdGVyIC0gMSA+IDAgJiYgc2VsZi5fY2F0Y2hpbmdVcFJlc29sdmVyc1tpbnNlcnRBZnRlciAtIDFdLnRzLmdyZWF0ZXJUaGFuKHRzKSkge1xuICAgICAgaW5zZXJ0QWZ0ZXItLTtcbiAgICB9XG4gICAgbGV0IHByb21pc2VSZXNvbHZlciA9IG51bGw7XG4gICAgY29uc3QgcHJvbWlzZVRvQXdhaXQgPSBuZXcgUHJvbWlzZShyID0+IHByb21pc2VSZXNvbHZlciA9IHIpO1xuICAgIHNlbGYuX2NhdGNoaW5nVXBSZXNvbHZlcnMuc3BsaWNlKGluc2VydEFmdGVyLCAwLCB7dHM6IHRzLCByZXNvbHZlcjogcHJvbWlzZVJlc29sdmVyfSk7XG4gICAgYXdhaXQgcHJvbWlzZVRvQXdhaXQ7XG4gIH0sXG5cbiAgLy8gQ2FsbHMgYGNhbGxiYWNrYCBvbmNlIHRoZSBvcGxvZyBoYXMgYmVlbiBwcm9jZXNzZWQgdXAgdG8gYSBwb2ludCB0aGF0IGlzXG4gIC8vIHJvdWdobHkgXCJub3dcIjogc3BlY2lmaWNhbGx5LCBvbmNlIHdlJ3ZlIHByb2Nlc3NlZCBhbGwgb3BzIHRoYXQgYXJlXG4gIC8vIGN1cnJlbnRseSB2aXNpYmxlLlxuICAvLyBYWFggYmVjb21lIGNvbnZpbmNlZCB0aGF0IHRoaXMgaXMgYWN0dWFsbHkgc2FmZSBldmVuIGlmIG9wbG9nQ29ubmVjdGlvblxuICAvLyBpcyBzb21lIGtpbmQgb2YgcG9vbFxuICB3YWl0VW50aWxDYXVnaHRVcDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl93YWl0VW50aWxDYXVnaHRVcCgpO1xuICB9LFxuXG4gIF9zdGFydFRhaWxpbmc6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gRmlyc3QsIG1ha2Ugc3VyZSB0aGF0IHdlJ3JlIHRhbGtpbmcgdG8gdGhlIGxvY2FsIGRhdGFiYXNlLlxuICAgIHZhciBtb25nb2RiVXJpID0gTnBtLnJlcXVpcmUoJ21vbmdvZGItdXJpJyk7XG4gICAgaWYgKG1vbmdvZGJVcmkucGFyc2Uoc2VsZi5fb3Bsb2dVcmwpLmRhdGFiYXNlICE9PSAnbG9jYWwnKSB7XG4gICAgICB0aHJvdyBFcnJvcihcIiRNT05HT19PUExPR19VUkwgbXVzdCBiZSBzZXQgdG8gdGhlICdsb2NhbCcgZGF0YWJhc2Ugb2YgXCIgK1xuICAgICAgICAgIFwiYSBNb25nbyByZXBsaWNhIHNldFwiKTtcbiAgICB9XG5cbiAgICAvLyBXZSBtYWtlIHR3byBzZXBhcmF0ZSBjb25uZWN0aW9ucyB0byBNb25nby4gVGhlIE5vZGUgTW9uZ28gZHJpdmVyXG4gICAgLy8gaW1wbGVtZW50cyBhIG5haXZlIHJvdW5kLXJvYmluIGNvbm5lY3Rpb24gcG9vbDogZWFjaCBcImNvbm5lY3Rpb25cIiBpcyBhXG4gICAgLy8gcG9vbCBvZiBzZXZlcmFsICg1IGJ5IGRlZmF1bHQpIFRDUCBjb25uZWN0aW9ucywgYW5kIGVhY2ggcmVxdWVzdCBpc1xuICAgIC8vIHJvdGF0ZWQgdGhyb3VnaCB0aGUgcG9vbHMuIFRhaWxhYmxlIGN1cnNvciBxdWVyaWVzIGJsb2NrIG9uIHRoZSBzZXJ2ZXJcbiAgICAvLyB1bnRpbCB0aGVyZSBpcyBzb21lIGRhdGEgdG8gcmV0dXJuIChvciB1bnRpbCBhIGZldyBzZWNvbmRzIGhhdmVcbiAgICAvLyBwYXNzZWQpLiBTbyBpZiB0aGUgY29ubmVjdGlvbiBwb29sIHVzZWQgZm9yIHRhaWxpbmcgY3Vyc29ycyBpcyB0aGUgc2FtZVxuICAgIC8vIHBvb2wgdXNlZCBmb3Igb3RoZXIgcXVlcmllcywgdGhlIG90aGVyIHF1ZXJpZXMgd2lsbCBiZSBkZWxheWVkIGJ5IHNlY29uZHNcbiAgICAvLyAxLzUgb2YgdGhlIHRpbWUuXG4gICAgLy9cbiAgICAvLyBUaGUgdGFpbCBjb25uZWN0aW9uIHdpbGwgb25seSBldmVyIGJlIHJ1bm5pbmcgYSBzaW5nbGUgdGFpbCBjb21tYW5kLCBzb1xuICAgIC8vIGl0IG9ubHkgbmVlZHMgdG8gbWFrZSBvbmUgdW5kZXJseWluZyBUQ1AgY29ubmVjdGlvbi5cbiAgICBzZWxmLl9vcGxvZ1RhaWxDb25uZWN0aW9uID0gbmV3IE1vbmdvQ29ubmVjdGlvbihcbiAgICAgICAgc2VsZi5fb3Bsb2dVcmwsIHttYXhQb29sU2l6ZTogMX0pO1xuICAgIC8vIFhYWCBiZXR0ZXIgZG9jcywgYnV0OiBpdCdzIHRvIGdldCBtb25vdG9uaWMgcmVzdWx0c1xuICAgIC8vIFhYWCBpcyBpdCBzYWZlIHRvIHNheSBcImlmIHRoZXJlJ3MgYW4gaW4gZmxpZ2h0IHF1ZXJ5LCBqdXN0IHVzZSBpdHNcbiAgICAvLyAgICAgcmVzdWx0c1wiPyBJIGRvbid0IHRoaW5rIHNvIGJ1dCBzaG91bGQgY29uc2lkZXIgdGhhdFxuICAgIHNlbGYuX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbiA9IG5ldyBNb25nb0Nvbm5lY3Rpb24oXG4gICAgICAgIHNlbGYuX29wbG9nVXJsLCB7bWF4UG9vbFNpemU6IDF9KTtcblxuXG4gICAgLy8gTm93LCBtYWtlIHN1cmUgdGhhdCB0aGVyZSBhY3R1YWxseSBpcyBhIHJlcGwgc2V0IGhlcmUuIElmIG5vdCwgb3Bsb2dcbiAgICAvLyB0YWlsaW5nIHdvbid0IGV2ZXIgZmluZCBhbnl0aGluZyFcbiAgICAvLyBNb3JlIG9uIHRoZSBpc01hc3RlckRvY1xuICAgIC8vIGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL2NvbW1hbmQvaXNNYXN0ZXIvXG4gICAgY29uc3QgaXNNYXN0ZXJEb2MgPSBhd2FpdCBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBzZWxmLl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24uZGJcbiAgICAgICAgLmFkbWluKClcbiAgICAgICAgLmNvbW1hbmQoeyBpc21hc3RlcjogMSB9LCBmdW5jdGlvbiAoZXJyLCByZXN1bHQpIHtcbiAgICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcbiAgICAgICAgICBlbHNlIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpZiAoIShpc01hc3RlckRvYyAmJiBpc01hc3RlckRvYy5zZXROYW1lKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXCIkTU9OR09fT1BMT0dfVVJMIG11c3QgYmUgc2V0IHRvIHRoZSAnbG9jYWwnIGRhdGFiYXNlIG9mIFwiICtcbiAgICAgICAgICBcImEgTW9uZ28gcmVwbGljYSBzZXRcIik7XG4gICAgfVxuXG4gICAgLy8gRmluZCB0aGUgbGFzdCBvcGxvZyBlbnRyeS5cbiAgICB2YXIgbGFzdE9wbG9nRW50cnkgPSBhd2FpdCBzZWxmLl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24uZmluZE9uZUFzeW5jKFxuICAgICAgT1BMT0dfQ09MTEVDVElPTixcbiAgICAgIHt9LFxuICAgICAgeyBzb3J0OiB7ICRuYXR1cmFsOiAtMSB9LCBwcm9qZWN0aW9uOiB7IHRzOiAxIH0gfVxuICAgICk7XG5cbiAgICB2YXIgb3Bsb2dTZWxlY3RvciA9IE9iamVjdC5hc3NpZ24oe30sIHNlbGYuX2Jhc2VPcGxvZ1NlbGVjdG9yKTtcbiAgICBpZiAobGFzdE9wbG9nRW50cnkpIHtcbiAgICAgIC8vIFN0YXJ0IGFmdGVyIHRoZSBsYXN0IGVudHJ5IHRoYXQgY3VycmVudGx5IGV4aXN0cy5cbiAgICAgIG9wbG9nU2VsZWN0b3IudHMgPSB7JGd0OiBsYXN0T3Bsb2dFbnRyeS50c307XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgYW55IGNhbGxzIHRvIGNhbGxXaGVuUHJvY2Vzc2VkTGF0ZXN0IGJlZm9yZSBhbnkgb3RoZXJcbiAgICAgIC8vIG9wbG9nIGVudHJpZXMgc2hvdyB1cCwgYWxsb3cgY2FsbFdoZW5Qcm9jZXNzZWRMYXRlc3QgdG8gY2FsbCBpdHNcbiAgICAgIC8vIGNhbGxiYWNrIGltbWVkaWF0ZWx5LlxuICAgICAgc2VsZi5fbGFzdFByb2Nlc3NlZFRTID0gbGFzdE9wbG9nRW50cnkudHM7XG4gICAgfVxuXG4gICAgdmFyIGN1cnNvckRlc2NyaXB0aW9uID0gbmV3IEN1cnNvckRlc2NyaXB0aW9uKFxuICAgICAgICBPUExPR19DT0xMRUNUSU9OLCBvcGxvZ1NlbGVjdG9yLCB7dGFpbGFibGU6IHRydWV9KTtcblxuICAgIC8vIFN0YXJ0IHRhaWxpbmcgdGhlIG9wbG9nLlxuICAgIC8vXG4gICAgLy8gV2UgcmVzdGFydCB0aGUgbG93LWxldmVsIG9wbG9nIHF1ZXJ5IGV2ZXJ5IDMwIHNlY29uZHMgaWYgd2UgZGlkbid0IGdldCBhXG4gICAgLy8gZG9jLiBUaGlzIGlzIGEgd29ya2Fyb3VuZCBmb3IgIzg1OTg6IHRoZSBOb2RlIE1vbmdvIGRyaXZlciBoYXMgYXQgbGVhc3RcbiAgICAvLyBvbmUgYnVnIHRoYXQgY2FuIGxlYWQgdG8gcXVlcnkgY2FsbGJhY2tzIG5ldmVyIGdldHRpbmcgY2FsbGVkIChldmVuIHdpdGhcbiAgICAvLyBhbiBlcnJvcikgd2hlbiBsZWFkZXJzaGlwIGZhaWxvdmVyIG9jY3VyLlxuICAgIHNlbGYuX3RhaWxIYW5kbGUgPSBzZWxmLl9vcGxvZ1RhaWxDb25uZWN0aW9uLnRhaWwoXG4gICAgICAgIGN1cnNvckRlc2NyaXB0aW9uLFxuICAgICAgICBmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgICAgc2VsZi5fZW50cnlRdWV1ZS5wdXNoKGRvYyk7XG4gICAgICAgICAgc2VsZi5fbWF5YmVTdGFydFdvcmtlcigpO1xuICAgICAgICB9LFxuICAgICAgICBUQUlMX1RJTUVPVVRcbiAgICApO1xuXG4gICAgc2VsZi5fcmVhZHlQcm9taXNlUmVzb2x2ZXIoKTtcbiAgfSxcblxuICBfbWF5YmVTdGFydFdvcmtlcjogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fd29ya2VyQWN0aXZlKSByZXR1cm47XG4gICAgc2VsZi5fd29ya2VyQWN0aXZlID0gdHJ1ZTtcblxuICAgIE1ldGVvci5kZWZlcihhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBNYXkgYmUgY2FsbGVkIHJlY3Vyc2l2ZWx5IGluIGNhc2Ugb2YgdHJhbnNhY3Rpb25zLlxuICAgICAgYXN5bmMgZnVuY3Rpb24gaGFuZGxlRG9jKGRvYykge1xuICAgICAgICBpZiAoZG9jLm5zID09PSBcImFkbWluLiRjbWRcIikge1xuICAgICAgICAgIGlmIChkb2Muby5hcHBseU9wcykge1xuICAgICAgICAgICAgLy8gVGhpcyB3YXMgYSBzdWNjZXNzZnVsIHRyYW5zYWN0aW9uLCBzbyB3ZSBuZWVkIHRvIGFwcGx5IHRoZVxuICAgICAgICAgICAgLy8gb3BlcmF0aW9ucyB0aGF0IHdlcmUgaW52b2x2ZWQuXG4gICAgICAgICAgICBsZXQgbmV4dFRpbWVzdGFtcCA9IGRvYy50cztcbiAgICAgICAgICAgIGZvciAoY29uc3Qgb3Agb2YgZG9jLm8uYXBwbHlPcHMpIHtcbiAgICAgICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy8xMDQyMC5cbiAgICAgICAgICAgICAgaWYgKCFvcC50cykge1xuICAgICAgICAgICAgICAgIG9wLnRzID0gbmV4dFRpbWVzdGFtcDtcbiAgICAgICAgICAgICAgICBuZXh0VGltZXN0YW1wID0gbmV4dFRpbWVzdGFtcC5hZGQoTG9uZy5PTkUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGF3YWl0IGhhbmRsZURvYyhvcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gY29tbWFuZCBcIiArIEVKU09OLnN0cmluZ2lmeShkb2MpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRyaWdnZXIgPSB7XG4gICAgICAgICAgZHJvcENvbGxlY3Rpb246IGZhbHNlLFxuICAgICAgICAgIGRyb3BEYXRhYmFzZTogZmFsc2UsXG4gICAgICAgICAgb3A6IGRvYyxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAodHlwZW9mIGRvYy5ucyA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgICAgICAgZG9jLm5zLnN0YXJ0c1dpdGgoc2VsZi5fZGJOYW1lICsgXCIuXCIpKSB7XG4gICAgICAgICAgdHJpZ2dlci5jb2xsZWN0aW9uID0gZG9jLm5zLnNsaWNlKHNlbGYuX2RiTmFtZS5sZW5ndGggKyAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElzIGl0IGEgc3BlY2lhbCBjb21tYW5kIGFuZCB0aGUgY29sbGVjdGlvbiBuYW1lIGlzIGhpZGRlblxuICAgICAgICAvLyBzb21ld2hlcmUgaW4gb3BlcmF0b3I/XG4gICAgICAgIGlmICh0cmlnZ2VyLmNvbGxlY3Rpb24gPT09IFwiJGNtZFwiKSB7XG4gICAgICAgICAgaWYgKGRvYy5vLmRyb3BEYXRhYmFzZSkge1xuICAgICAgICAgICAgZGVsZXRlIHRyaWdnZXIuY29sbGVjdGlvbjtcbiAgICAgICAgICAgIHRyaWdnZXIuZHJvcERhdGFiYXNlID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKF8uaGFzKGRvYy5vLCBcImRyb3BcIikpIHtcbiAgICAgICAgICAgIHRyaWdnZXIuY29sbGVjdGlvbiA9IGRvYy5vLmRyb3A7XG4gICAgICAgICAgICB0cmlnZ2VyLmRyb3BDb2xsZWN0aW9uID0gdHJ1ZTtcbiAgICAgICAgICAgIHRyaWdnZXIuaWQgPSBudWxsO1xuICAgICAgICAgIH0gZWxzZSBpZiAoXCJjcmVhdGVcIiBpbiBkb2MubyAmJiBcImlkSW5kZXhcIiBpbiBkb2Mubykge1xuICAgICAgICAgICAgLy8gQSBjb2xsZWN0aW9uIGdvdCBpbXBsaWNpdGx5IGNyZWF0ZWQgd2l0aGluIGEgdHJhbnNhY3Rpb24uIFRoZXJlJ3NcbiAgICAgICAgICAgIC8vIG5vIG5lZWQgdG8gZG8gYW55dGhpbmcgYWJvdXQgaXQuXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKFwiVW5rbm93biBjb21tYW5kIFwiICsgRUpTT04uc3RyaW5naWZ5KGRvYykpO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEFsbCBvdGhlciBvcHMgaGF2ZSBhbiBpZC5cbiAgICAgICAgICB0cmlnZ2VyLmlkID0gaWRGb3JPcChkb2MpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgc2VsZi5fY3Jvc3NiYXIuZmlyZSh0cmlnZ2VyKTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgd2hpbGUgKCEgc2VsZi5fc3RvcHBlZCAmJlxuICAgICAgICAgICAgICAgISBzZWxmLl9lbnRyeVF1ZXVlLmlzRW1wdHkoKSkge1xuICAgICAgICAgIC8vIEFyZSB3ZSB0b28gZmFyIGJlaGluZD8gSnVzdCB0ZWxsIG91ciBvYnNlcnZlcnMgdGhhdCB0aGV5IG5lZWQgdG9cbiAgICAgICAgICAvLyByZXBvbGwsIGFuZCBkcm9wIG91ciBxdWV1ZS5cbiAgICAgICAgICBpZiAoc2VsZi5fZW50cnlRdWV1ZS5sZW5ndGggPiBUT09fRkFSX0JFSElORCkge1xuICAgICAgICAgICAgdmFyIGxhc3RFbnRyeSA9IHNlbGYuX2VudHJ5UXVldWUucG9wKCk7XG4gICAgICAgICAgICBzZWxmLl9lbnRyeVF1ZXVlLmNsZWFyKCk7XG5cbiAgICAgICAgICAgIHNlbGYuX29uU2tpcHBlZEVudHJpZXNIb29rLmVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIEZyZWUgYW55IHdhaXRVbnRpbENhdWdodFVwKCkgY2FsbHMgdGhhdCB3ZXJlIHdhaXRpbmcgZm9yIHVzIHRvXG4gICAgICAgICAgICAvLyBwYXNzIHNvbWV0aGluZyB0aGF0IHdlIGp1c3Qgc2tpcHBlZC5cbiAgICAgICAgICAgIHNlbGYuX3NldExhc3RQcm9jZXNzZWRUUyhsYXN0RW50cnkudHMpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZG9jID0gc2VsZi5fZW50cnlRdWV1ZS5zaGlmdCgpO1xuXG4gICAgICAgICAgLy8gRmlyZSB0cmlnZ2VyKHMpIGZvciB0aGlzIGRvYy5cbiAgICAgICAgICBhd2FpdCBoYW5kbGVEb2MoZG9jKTtcblxuICAgICAgICAgIC8vIE5vdyB0aGF0IHdlJ3ZlIHByb2Nlc3NlZCB0aGlzIG9wZXJhdGlvbiwgcHJvY2VzcyBwZW5kaW5nXG4gICAgICAgICAgLy8gc2VxdWVuY2Vycy5cbiAgICAgICAgICBpZiAoZG9jLnRzKSB7XG4gICAgICAgICAgICBzZWxmLl9zZXRMYXN0UHJvY2Vzc2VkVFMoZG9jLnRzKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoXCJvcGxvZyBlbnRyeSB3aXRob3V0IHRzOiBcIiArIEVKU09OLnN0cmluZ2lmeShkb2MpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNlbGYuX3dvcmtlckFjdGl2ZSA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIF9zZXRMYXN0UHJvY2Vzc2VkVFM6IGZ1bmN0aW9uICh0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9sYXN0UHJvY2Vzc2VkVFMgPSB0cztcbiAgICB3aGlsZSAoIV8uaXNFbXB0eShzZWxmLl9jYXRjaGluZ1VwUmVzb2x2ZXJzKSAmJiBzZWxmLl9jYXRjaGluZ1VwUmVzb2x2ZXJzWzBdLnRzLmxlc3NUaGFuT3JFcXVhbChzZWxmLl9sYXN0UHJvY2Vzc2VkVFMpKSB7XG4gICAgICB2YXIgc2VxdWVuY2VyID0gc2VsZi5fY2F0Y2hpbmdVcFJlc29sdmVycy5zaGlmdCgpO1xuICAgICAgc2VxdWVuY2VyLnJlc29sdmVyKCk7XG4gICAgfVxuICB9LFxuXG4gIC8vTWV0aG9kcyB1c2VkIG9uIHRlc3RzIHRvIGRpbmFtaWNhbGx5IGNoYW5nZSBUT09fRkFSX0JFSElORFxuICBfZGVmaW5lVG9vRmFyQmVoaW5kOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIFRPT19GQVJfQkVISU5EID0gdmFsdWU7XG4gIH0sXG4gIF9yZXNldFRvb0ZhckJlaGluZDogZnVuY3Rpb24oKSB7XG4gICAgVE9PX0ZBUl9CRUhJTkQgPSBwcm9jZXNzLmVudi5NRVRFT1JfT1BMT0dfVE9PX0ZBUl9CRUhJTkQgfHwgMjAwMDtcbiAgfVxufSk7XG4iLCJsZXQgbmV4dE9ic2VydmVIYW5kbGVJZCA9IDE7XG5cbk9ic2VydmVNdWx0aXBsZXhlciA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IoeyBvcmRlcmVkLCBvblN0b3AgPSAoKSA9PiB7fSB9ID0ge30pIHtcbiAgICBpZiAob3JkZXJlZCA9PT0gdW5kZWZpbmVkKSB0aHJvdyBFcnJvcihcIm11c3Qgc3BlY2lmeSBvcmRlcmVkXCIpO1xuXG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwib2JzZXJ2ZS1tdWx0aXBsZXhlcnNcIiwgMSk7XG5cbiAgICB0aGlzLl9vcmRlcmVkID0gb3JkZXJlZDtcbiAgICB0aGlzLl9vblN0b3AgPSBvblN0b3A7XG4gICAgdGhpcy5fcXVldWUgPSBuZXcgTWV0ZW9yLl9Bc3luY2hyb25vdXNRdWV1ZSgpO1xuICAgIHRoaXMuX2hhbmRsZXMgPSB7fTtcbiAgICB0aGlzLl9yZXNvbHZlciA9IG51bGw7XG4gICAgdGhpcy5fcmVhZHlQcm9taXNlID0gbmV3IFByb21pc2UociA9PiB0aGlzLl9yZXNvbHZlciA9IHIpLnRoZW4oKCkgPT4gdGhpcy5faXNSZWFkeSA9IHRydWUpO1xuICAgIHRoaXMuX2NhY2hlID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fQ2FjaGluZ0NoYW5nZU9ic2VydmVyKHtcbiAgICAgIG9yZGVyZWR9KTtcbiAgICAvLyBOdW1iZXIgb2YgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIHRhc2tzIHNjaGVkdWxlZCBidXQgbm90IHlldFxuICAgIC8vIHJ1bm5pbmcuIHJlbW92ZUhhbmRsZSB1c2VzIHRoaXMgdG8ga25vdyBpZiBpdCdzIHRpbWUgdG8gY2FsbCB0aGUgb25TdG9wXG4gICAgLy8gY2FsbGJhY2suXG4gICAgdGhpcy5fYWRkSGFuZGxlVGFza3NTY2hlZHVsZWRCdXROb3RQZXJmb3JtZWQgPSAwO1xuXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5jYWxsYmFja05hbWVzKCkuZm9yRWFjaChjYWxsYmFja05hbWUgPT4ge1xuICAgICAgdGhpc1tjYWxsYmFja05hbWVdID0gZnVuY3Rpb24oLyogLi4uICovKSB7XG4gICAgICAgIHNlbGYuX2FwcGx5Q2FsbGJhY2soY2FsbGJhY2tOYW1lLCBfLnRvQXJyYXkoYXJndW1lbnRzKSk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzKGhhbmRsZSkge1xuICAgIHJldHVybiB0aGlzLl9hZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMoaGFuZGxlKTtcbiAgfVxuXG4gIGFzeW5jIF9hZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMoaGFuZGxlKSB7XG4gICAgKyt0aGlzLl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZDtcblxuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcIm9ic2VydmUtaGFuZGxlc1wiLCAxKTtcblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGF3YWl0IHRoaXMuX3F1ZXVlLnJ1blRhc2soYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5faGFuZGxlc1toYW5kbGUuX2lkXSA9IGhhbmRsZTtcbiAgICAgIC8vIFNlbmQgb3V0IHdoYXRldmVyIGFkZHMgd2UgaGF2ZSBzbyBmYXIgKHdoZXRoZXIgdGhlXG4gICAgICAvLyBtdWx0aXBsZXhlciBpcyByZWFkeSkuXG4gICAgICBhd2FpdCBzZWxmLl9zZW5kQWRkcyhoYW5kbGUpO1xuICAgICAgLS1zZWxmLl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZDtcbiAgICB9KTtcbiAgICBhd2FpdCB0aGlzLl9yZWFkeVByb21pc2U7XG4gIH1cblxuICAvLyBSZW1vdmUgYW4gb2JzZXJ2ZSBoYW5kbGUuIElmIGl0IHdhcyB0aGUgbGFzdCBvYnNlcnZlIGhhbmRsZSwgY2FsbCB0aGVcbiAgLy8gb25TdG9wIGNhbGxiYWNrOyB5b3UgY2Fubm90IGFkZCBhbnkgbW9yZSBvYnNlcnZlIGhhbmRsZXMgYWZ0ZXIgdGhpcy5cbiAgLy9cbiAgLy8gVGhpcyBpcyBub3Qgc3luY2hyb25pemVkIHdpdGggcG9sbHMgYW5kIGhhbmRsZSBhZGRpdGlvbnM6IHRoaXMgbWVhbnMgdGhhdFxuICAvLyB5b3UgY2FuIHNhZmVseSBjYWxsIGl0IGZyb20gd2l0aGluIGFuIG9ic2VydmUgY2FsbGJhY2ssIGJ1dCBpdCBhbHNvIG1lYW5zXG4gIC8vIHRoYXQgd2UgaGF2ZSB0byBiZSBjYXJlZnVsIHdoZW4gd2UgaXRlcmF0ZSBvdmVyIF9oYW5kbGVzLlxuICBhc3luYyByZW1vdmVIYW5kbGUoaWQpIHtcbiAgICAvLyBUaGlzIHNob3VsZCBub3QgYmUgcG9zc2libGU6IHlvdSBjYW4gb25seSBjYWxsIHJlbW92ZUhhbmRsZSBieSBoYXZpbmdcbiAgICAvLyBhY2Nlc3MgdG8gdGhlIE9ic2VydmVIYW5kbGUsIHdoaWNoIGlzbid0IHJldHVybmVkIHRvIHVzZXIgY29kZSB1bnRpbCB0aGVcbiAgICAvLyBtdWx0aXBsZXggaXMgcmVhZHkuXG4gICAgaWYgKCF0aGlzLl9yZWFkeSgpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgcmVtb3ZlIGhhbmRsZXMgdW50aWwgdGhlIG11bHRpcGxleCBpcyByZWFkeVwiKTtcblxuICAgIGRlbGV0ZSB0aGlzLl9oYW5kbGVzW2lkXTtcblxuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcIm9ic2VydmUtaGFuZGxlc1wiLCAtMSk7XG5cbiAgICBpZiAoXy5pc0VtcHR5KHRoaXMuX2hhbmRsZXMpICYmXG4gICAgICAgIHRoaXMuX2FkZEhhbmRsZVRhc2tzU2NoZWR1bGVkQnV0Tm90UGVyZm9ybWVkID09PSAwKSB7XG4gICAgICBhd2FpdCB0aGlzLl9zdG9wKCk7XG4gICAgfVxuICB9XG4gIGFzeW5jIF9zdG9wKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIC8vIEl0IHNob3VsZG4ndCBiZSBwb3NzaWJsZSBmb3IgdXMgdG8gc3RvcCB3aGVuIGFsbCBvdXIgaGFuZGxlcyBzdGlsbFxuICAgIC8vIGhhdmVuJ3QgYmVlbiByZXR1cm5lZCBmcm9tIG9ic2VydmVDaGFuZ2VzIVxuICAgIGlmICghIHRoaXMuX3JlYWR5KCkgJiYgISBvcHRpb25zLmZyb21RdWVyeUVycm9yKVxuICAgICAgdGhyb3cgRXJyb3IoXCJzdXJwcmlzaW5nIF9zdG9wOiBub3QgcmVhZHlcIik7XG5cbiAgICAvLyBDYWxsIHN0b3AgY2FsbGJhY2sgKHdoaWNoIGtpbGxzIHRoZSB1bmRlcmx5aW5nIHByb2Nlc3Mgd2hpY2ggc2VuZHMgdXNcbiAgICAvLyBjYWxsYmFja3MgYW5kIHJlbW92ZXMgdXMgZnJvbSB0aGUgY29ubmVjdGlvbidzIGRpY3Rpb25hcnkpLlxuICAgIGF3YWl0IHRoaXMuX29uU3RvcCgpO1xuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcIm9ic2VydmUtbXVsdGlwbGV4ZXJzXCIsIC0xKTtcblxuICAgIC8vIENhdXNlIGZ1dHVyZSBhZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMgY2FsbHMgdG8gdGhyb3cgKGJ1dCB0aGUgb25TdG9wXG4gICAgLy8gY2FsbGJhY2sgc2hvdWxkIG1ha2Ugb3VyIGNvbm5lY3Rpb24gZm9yZ2V0IGFib3V0IHVzKS5cbiAgICB0aGlzLl9oYW5kbGVzID0gbnVsbDtcbiAgfVxuXG4gIC8vIEFsbG93cyBhbGwgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIGNhbGxzIHRvIHJldHVybiwgb25jZSBhbGwgcHJlY2VkaW5nXG4gIC8vIGFkZHMgaGF2ZSBiZWVuIHByb2Nlc3NlZC4gRG9lcyBub3QgYmxvY2suXG4gIGFzeW5jIHJlYWR5KCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuX3F1ZXVlLnF1ZXVlVGFzayhmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5fcmVhZHkoKSlcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJjYW4ndCBtYWtlIE9ic2VydmVNdWx0aXBsZXggcmVhZHkgdHdpY2UhXCIpO1xuXG4gICAgICBpZiAoIXNlbGYuX3Jlc29sdmVyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk1pc3NpbmcgcmVzb2x2ZXJcIik7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX3Jlc29sdmVyKCk7XG4gICAgICBzZWxmLl9pc1JlYWR5ID0gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIElmIHRyeWluZyB0byBleGVjdXRlIHRoZSBxdWVyeSByZXN1bHRzIGluIGFuIGVycm9yLCBjYWxsIHRoaXMuIFRoaXMgaXNcbiAgLy8gaW50ZW5kZWQgZm9yIHBlcm1hbmVudCBlcnJvcnMsIG5vdCB0cmFuc2llbnQgbmV0d29yayBlcnJvcnMgdGhhdCBjb3VsZCBiZVxuICAvLyBmaXhlZC4gSXQgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGJlZm9yZSByZWFkeSgpLCBiZWNhdXNlIGlmIHlvdSBjYWxsZWQgcmVhZHlcbiAgLy8gdGhhdCBtZWFudCB0aGF0IHlvdSBtYW5hZ2VkIHRvIHJ1biB0aGUgcXVlcnkgb25jZS4gSXQgd2lsbCBzdG9wIHRoaXNcbiAgLy8gT2JzZXJ2ZU11bHRpcGxleCBhbmQgY2F1c2UgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIGNhbGxzIChhbmQgdGh1c1xuICAvLyBvYnNlcnZlQ2hhbmdlcyBjYWxscykgdG8gdGhyb3cgdGhlIGVycm9yLlxuICBhc3luYyBxdWVyeUVycm9yKGVycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhd2FpdCB0aGlzLl9xdWV1ZS5ydW5UYXNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChzZWxmLl9yZWFkeSgpKVxuICAgICAgICB0aHJvdyBFcnJvcihcImNhbid0IGNsYWltIHF1ZXJ5IGhhcyBhbiBlcnJvciBhZnRlciBpdCB3b3JrZWQhXCIpO1xuICAgICAgc2VsZi5fc3RvcCh7ZnJvbVF1ZXJ5RXJyb3I6IHRydWV9KTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIENhbGxzIFwiY2JcIiBvbmNlIHRoZSBlZmZlY3RzIG9mIGFsbCBcInJlYWR5XCIsIFwiYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzXCJcbiAgLy8gYW5kIG9ic2VydmUgY2FsbGJhY2tzIHdoaWNoIGNhbWUgYmVmb3JlIHRoaXMgY2FsbCBoYXZlIGJlZW4gcHJvcGFnYXRlZCB0b1xuICAvLyBhbGwgaGFuZGxlcy4gXCJyZWFkeVwiIG11c3QgaGF2ZSBhbHJlYWR5IGJlZW4gY2FsbGVkIG9uIHRoaXMgbXVsdGlwbGV4ZXIuXG4gIGFzeW5jIG9uRmx1c2goY2IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYXdhaXQgdGhpcy5fcXVldWUucXVldWVUYXNrKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghc2VsZi5fcmVhZHkoKSlcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJvbmx5IGNhbGwgb25GbHVzaCBvbiBhIG11bHRpcGxleGVyIHRoYXQgd2lsbCBiZSByZWFkeVwiKTtcbiAgICAgIGF3YWl0IGNiKCk7XG4gICAgfSk7XG4gIH1cbiAgY2FsbGJhY2tOYW1lcygpIHtcbiAgICBpZiAodGhpcy5fb3JkZXJlZClcbiAgICAgIHJldHVybiBbXCJhZGRlZEJlZm9yZVwiLCBcImNoYW5nZWRcIiwgXCJtb3ZlZEJlZm9yZVwiLCBcInJlbW92ZWRcIl07XG4gICAgZWxzZVxuICAgICAgcmV0dXJuIFtcImFkZGVkXCIsIFwiY2hhbmdlZFwiLCBcInJlbW92ZWRcIl07XG4gIH1cbiAgX3JlYWR5KCkge1xuICAgIHJldHVybiAhIXRoaXMuX2lzUmVhZHk7XG4gIH1cbiAgX2FwcGx5Q2FsbGJhY2soY2FsbGJhY2tOYW1lLCBhcmdzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5fcXVldWUucXVldWVUYXNrKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIElmIHdlIHN0b3BwZWQgaW4gdGhlIG1lYW50aW1lLCBkbyBub3RoaW5nLlxuICAgICAgaWYgKCFzZWxmLl9oYW5kbGVzKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIC8vIEZpcnN0LCBhcHBseSB0aGUgY2hhbmdlIHRvIHRoZSBjYWNoZS5cbiAgICAgIGF3YWl0IHNlbGYuX2NhY2hlLmFwcGx5Q2hhbmdlW2NhbGxiYWNrTmFtZV0uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAvLyBJZiB3ZSBoYXZlbid0IGZpbmlzaGVkIHRoZSBpbml0aWFsIGFkZHMsIHRoZW4gd2Ugc2hvdWxkIG9ubHkgYmUgZ2V0dGluZ1xuICAgICAgLy8gYWRkcy5cbiAgICAgIGlmICghc2VsZi5fcmVhZHkoKSAmJlxuICAgICAgICAgIChjYWxsYmFja05hbWUgIT09ICdhZGRlZCcgJiYgY2FsbGJhY2tOYW1lICE9PSAnYWRkZWRCZWZvcmUnKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJHb3QgXCIgKyBjYWxsYmFja05hbWUgKyBcIiBkdXJpbmcgaW5pdGlhbCBhZGRzXCIpO1xuICAgICAgfVxuXG4gICAgICAvLyBOb3cgbXVsdGlwbGV4IHRoZSBjYWxsYmFja3Mgb3V0IHRvIGFsbCBvYnNlcnZlIGhhbmRsZXMuIEl0J3MgT0sgaWZcbiAgICAgIC8vIHRoZXNlIGNhbGxzIHlpZWxkOyBzaW5jZSB3ZSdyZSBpbnNpZGUgYSB0YXNrLCBubyBvdGhlciB1c2Ugb2Ygb3VyIHF1ZXVlXG4gICAgICAvLyBjYW4gY29udGludWUgdW50aWwgdGhlc2UgYXJlIGRvbmUuIChCdXQgd2UgZG8gaGF2ZSB0byBiZSBjYXJlZnVsIHRvIG5vdFxuICAgICAgLy8gdXNlIGEgaGFuZGxlIHRoYXQgZ290IHJlbW92ZWQsIGJlY2F1c2UgcmVtb3ZlSGFuZGxlIGRvZXMgbm90IHVzZSB0aGVcbiAgICAgIC8vIHF1ZXVlOyB0aHVzLCB3ZSBpdGVyYXRlIG92ZXIgYW4gYXJyYXkgb2Yga2V5cyB0aGF0IHdlIGNvbnRyb2wuKVxuICAgICAgZm9yIChjb25zdCBoYW5kbGVJZCBvZiBPYmplY3Qua2V5cyhzZWxmLl9oYW5kbGVzKSkge1xuICAgICAgICB2YXIgaGFuZGxlID0gc2VsZi5faGFuZGxlcyAmJiBzZWxmLl9oYW5kbGVzW2hhbmRsZUlkXTtcbiAgICAgICAgaWYgKCFoYW5kbGUpIHJldHVybjtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gaGFuZGxlWydfJyArIGNhbGxiYWNrTmFtZV07XG4gICAgICAgIC8vIGNsb25lIGFyZ3VtZW50cyBzbyB0aGF0IGNhbGxiYWNrcyBjYW4gbXV0YXRlIHRoZWlyIGFyZ3VtZW50c1xuXG4gICAgICAgIGNhbGxiYWNrICYmXG4gICAgICAgICAgKGF3YWl0IGNhbGxiYWNrLmFwcGx5KFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIGhhbmRsZS5ub25NdXRhdGluZ0NhbGxiYWNrcyA/IGFyZ3MgOiBFSlNPTi5jbG9uZShhcmdzKVxuICAgICAgICAgICkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gU2VuZHMgaW5pdGlhbCBhZGRzIHRvIGEgaGFuZGxlLiBJdCBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSB3aXRoaW4gYSB0YXNrXG4gIC8vICh0aGUgdGFzayB0aGF0IGlzIHByb2Nlc3NpbmcgdGhlIGFkZEhhbmRsZUFuZFNlbmRJbml0aWFsQWRkcyBjYWxsKS4gSXRcbiAgLy8gc3luY2hyb25vdXNseSBpbnZva2VzIHRoZSBoYW5kbGUncyBhZGRlZCBvciBhZGRlZEJlZm9yZTsgdGhlcmUncyBubyBuZWVkIHRvXG4gIC8vIGZsdXNoIHRoZSBxdWV1ZSBhZnRlcndhcmRzIHRvIGVuc3VyZSB0aGF0IHRoZSBjYWxsYmFja3MgZ2V0IG91dC5cbiAgYXN5bmMgX3NlbmRBZGRzKGhhbmRsZSkge1xuICAgIHZhciBhZGQgPSB0aGlzLl9vcmRlcmVkID8gaGFuZGxlLl9hZGRlZEJlZm9yZSA6IGhhbmRsZS5fYWRkZWQ7XG4gICAgaWYgKCFhZGQpXG4gICAgICByZXR1cm47XG4gICAgLy8gbm90ZTogZG9jcyBtYXkgYmUgYW4gX0lkTWFwIG9yIGFuIE9yZGVyZWREaWN0XG4gICAgYXdhaXQgdGhpcy5fY2FjaGUuZG9jcy5mb3JFYWNoQXN5bmMoYXN5bmMgKGRvYywgaWQpID0+IHtcbiAgICAgIGlmICghXy5oYXModGhpcy5faGFuZGxlcywgaGFuZGxlLl9pZCkpXG4gICAgICAgIHRocm93IEVycm9yKFwiaGFuZGxlIGdvdCByZW1vdmVkIGJlZm9yZSBzZW5kaW5nIGluaXRpYWwgYWRkcyFcIik7XG4gICAgICBjb25zdCB7IF9pZCwgLi4uZmllbGRzIH0gPSBoYW5kbGUubm9uTXV0YXRpbmdDYWxsYmFja3MgPyBkb2NcbiAgICAgICAgICA6IEVKU09OLmNsb25lKGRvYyk7XG4gICAgICBpZiAodGhpcy5fb3JkZXJlZClcbiAgICAgICAgYXdhaXQgYWRkKGlkLCBmaWVsZHMsIG51bGwpOyAvLyB3ZSdyZSBnb2luZyBpbiBvcmRlciwgc28gYWRkIGF0IGVuZFxuICAgICAgZWxzZVxuICAgICAgICBhd2FpdCBhZGQoaWQsIGZpZWxkcyk7XG4gICAgfSk7XG4gIH1cbn07XG5cbi8vIFdoZW4gdGhlIGNhbGxiYWNrcyBkbyBub3QgbXV0YXRlIHRoZSBhcmd1bWVudHMsIHdlIGNhbiBza2lwIGEgbG90IG9mIGRhdGEgY2xvbmVzXG5PYnNlcnZlSGFuZGxlID0gY2xhc3Mge1xuICBjb25zdHJ1Y3RvcihtdWx0aXBsZXhlciwgY2FsbGJhY2tzLCBub25NdXRhdGluZ0NhbGxiYWNrcyA9IGZhbHNlKSB7XG4gICAgdGhpcy5fbXVsdGlwbGV4ZXIgPSBtdWx0aXBsZXhlcjtcbiAgICBtdWx0aXBsZXhlci5jYWxsYmFja05hbWVzKCkuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgICAgaWYgKGNhbGxiYWNrc1tuYW1lXSkge1xuICAgICAgICB0aGlzWydfJyArIG5hbWVdID0gY2FsbGJhY2tzW25hbWVdO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSBcImFkZGVkQmVmb3JlXCIgJiYgY2FsbGJhY2tzLmFkZGVkKSB7XG4gICAgICAgIC8vIFNwZWNpYWwgY2FzZTogaWYgeW91IHNwZWNpZnkgXCJhZGRlZFwiIGFuZCBcIm1vdmVkQmVmb3JlXCIsIHlvdSBnZXQgYW5cbiAgICAgICAgLy8gb3JkZXJlZCBvYnNlcnZlIHdoZXJlIGZvciBzb21lIHJlYXNvbiB5b3UgZG9uJ3QgZ2V0IG9yZGVyaW5nIGRhdGEgb25cbiAgICAgICAgLy8gdGhlIGFkZHMuICBJIGR1bm5vLCB3ZSB3cm90ZSB0ZXN0cyBmb3IgaXQsIHRoZXJlIG11c3QgaGF2ZSBiZWVuIGFcbiAgICAgICAgLy8gcmVhc29uLlxuICAgICAgICB0aGlzLl9hZGRlZEJlZm9yZSA9IGFzeW5jIGZ1bmN0aW9uIChpZCwgZmllbGRzLCBiZWZvcmUpIHtcbiAgICAgICAgICBhd2FpdCBjYWxsYmFja3MuYWRkZWQoaWQsIGZpZWxkcyk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5fc3RvcHBlZCA9IGZhbHNlO1xuICAgIHRoaXMuX2lkID0gbmV4dE9ic2VydmVIYW5kbGVJZCsrO1xuICAgIHRoaXMubm9uTXV0YXRpbmdDYWxsYmFja3MgPSBub25NdXRhdGluZ0NhbGxiYWNrcztcbiAgfVxuXG4gIGFzeW5jIHN0b3AoKSB7XG4gICAgaWYgKHRoaXMuX3N0b3BwZWQpIHJldHVybjtcbiAgICB0aGlzLl9zdG9wcGVkID0gdHJ1ZTtcbiAgICBhd2FpdCB0aGlzLl9tdWx0aXBsZXhlci5yZW1vdmVIYW5kbGUodGhpcy5faWQpO1xuICB9XG59O1xuIiwiZXhwb3J0IGNsYXNzIERvY0ZldGNoZXIge1xuICBjb25zdHJ1Y3Rvcihtb25nb0Nvbm5lY3Rpb24pIHtcbiAgICB0aGlzLl9tb25nb0Nvbm5lY3Rpb24gPSBtb25nb0Nvbm5lY3Rpb247XG4gICAgLy8gTWFwIGZyb20gb3AgLT4gW2NhbGxiYWNrXVxuICAgIHRoaXMuX2NhbGxiYWNrc0Zvck9wID0gbmV3IE1hcCgpO1xuICB9XG5cbiAgLy8gRmV0Y2hlcyBkb2N1bWVudCBcImlkXCIgZnJvbSBjb2xsZWN0aW9uTmFtZSwgcmV0dXJuaW5nIGl0IG9yIG51bGwgaWYgbm90XG4gIC8vIGZvdW5kLlxuICAvL1xuICAvLyBJZiB5b3UgbWFrZSBtdWx0aXBsZSBjYWxscyB0byBmZXRjaCgpIHdpdGggdGhlIHNhbWUgb3AgcmVmZXJlbmNlLFxuICAvLyBEb2NGZXRjaGVyIG1heSBhc3N1bWUgdGhhdCB0aGV5IGFsbCByZXR1cm4gdGhlIHNhbWUgZG9jdW1lbnQuIChJdCBkb2VzXG4gIC8vIG5vdCBjaGVjayB0byBzZWUgaWYgY29sbGVjdGlvbk5hbWUvaWQgbWF0Y2guKVxuICAvL1xuICAvLyBZb3UgbWF5IGFzc3VtZSB0aGF0IGNhbGxiYWNrIGlzIG5ldmVyIGNhbGxlZCBzeW5jaHJvbm91c2x5IChhbmQgaW4gZmFjdFxuICAvLyBPcGxvZ09ic2VydmVEcml2ZXIgZG9lcyBzbykuXG4gIGFzeW5jIGZldGNoKGNvbGxlY3Rpb25OYW1lLCBpZCwgb3AsIGNhbGxiYWNrKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBcbiAgICBjaGVjayhjb2xsZWN0aW9uTmFtZSwgU3RyaW5nKTtcbiAgICBjaGVjayhvcCwgT2JqZWN0KTtcblxuXG4gICAgLy8gSWYgdGhlcmUncyBhbHJlYWR5IGFuIGluLXByb2dyZXNzIGZldGNoIGZvciB0aGlzIGNhY2hlIGtleSwgeWllbGQgdW50aWxcbiAgICAvLyBpdCdzIGRvbmUgYW5kIHJldHVybiB3aGF0ZXZlciBpdCByZXR1cm5zLlxuICAgIGlmIChzZWxmLl9jYWxsYmFja3NGb3JPcC5oYXMob3ApKSB7XG4gICAgICBzZWxmLl9jYWxsYmFja3NGb3JPcC5nZXQob3ApLnB1c2goY2FsbGJhY2spO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGNhbGxiYWNrcyA9IFtjYWxsYmFja107XG4gICAgc2VsZi5fY2FsbGJhY2tzRm9yT3Auc2V0KG9wLCBjYWxsYmFja3MpO1xuXG4gICAgdHJ5IHtcbiAgICAgIHZhciBkb2MgPVxuICAgICAgICAoYXdhaXQgc2VsZi5fbW9uZ29Db25uZWN0aW9uLmZpbmRPbmVBc3luYyhjb2xsZWN0aW9uTmFtZSwge1xuICAgICAgICAgIF9pZDogaWQsXG4gICAgICAgIH0pKSB8fCBudWxsO1xuICAgICAgLy8gUmV0dXJuIGRvYyB0byBhbGwgcmVsZXZhbnQgY2FsbGJhY2tzLiBOb3RlIHRoYXQgdGhpcyBhcnJheSBjYW5cbiAgICAgIC8vIGNvbnRpbnVlIHRvIGdyb3cgZHVyaW5nIGNhbGxiYWNrIGV4Y2VjdXRpb24uXG4gICAgICB3aGlsZSAoY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8gQ2xvbmUgdGhlIGRvY3VtZW50IHNvIHRoYXQgdGhlIHZhcmlvdXMgY2FsbHMgdG8gZmV0Y2ggZG9uJ3QgcmV0dXJuXG4gICAgICAgIC8vIG9iamVjdHMgdGhhdCBhcmUgaW50ZXJ0d2luZ2xlZCB3aXRoIGVhY2ggb3RoZXIuIENsb25lIGJlZm9yZVxuICAgICAgICAvLyBwb3BwaW5nIHRoZSBmdXR1cmUsIHNvIHRoYXQgaWYgY2xvbmUgdGhyb3dzLCB0aGUgZXJyb3IgZ2V0cyBwYXNzZWRcbiAgICAgICAgLy8gdG8gdGhlIG5leHQgY2FsbGJhY2suXG4gICAgICAgIGNhbGxiYWNrcy5wb3AoKShudWxsLCBFSlNPTi5jbG9uZShkb2MpKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB3aGlsZSAoY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY2FsbGJhY2tzLnBvcCgpKGUpO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICAvLyBYWFggY29uc2lkZXIga2VlcGluZyB0aGUgZG9jIGFyb3VuZCBmb3IgYSBwZXJpb2Qgb2YgdGltZSBiZWZvcmVcbiAgICAgIC8vIHJlbW92aW5nIGZyb20gdGhlIGNhY2hlXG4gICAgICBzZWxmLl9jYWxsYmFja3NGb3JPcC5kZWxldGUob3ApO1xuICAgIH1cbiAgfVxufVxuIiwidmFyIFBPTExJTkdfVEhST1RUTEVfTVMgPSArcHJvY2Vzcy5lbnYuTUVURU9SX1BPTExJTkdfVEhST1RUTEVfTVMgfHwgNTA7XG52YXIgUE9MTElOR19JTlRFUlZBTF9NUyA9ICtwcm9jZXNzLmVudi5NRVRFT1JfUE9MTElOR19JTlRFUlZBTF9NUyB8fCAxMCAqIDEwMDA7XG5cblBvbGxpbmdPYnNlcnZlRHJpdmVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uID0gb3B0aW9ucy5jdXJzb3JEZXNjcmlwdGlvbjtcbiAgc2VsZi5fbW9uZ29IYW5kbGUgPSBvcHRpb25zLm1vbmdvSGFuZGxlO1xuICBzZWxmLl9vcmRlcmVkID0gb3B0aW9ucy5vcmRlcmVkO1xuICBzZWxmLl9tdWx0aXBsZXhlciA9IG9wdGlvbnMubXVsdGlwbGV4ZXI7XG4gIHNlbGYuX3N0b3BDYWxsYmFja3MgPSBbXTtcbiAgc2VsZi5fc3RvcHBlZCA9IGZhbHNlO1xuXG4gIHNlbGYuX2N1cnNvciA9IHNlbGYuX21vbmdvSGFuZGxlLl9jcmVhdGVTeW5jaHJvbm91c0N1cnNvcihcbiAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbik7XG5cbiAgLy8gcHJldmlvdXMgcmVzdWx0cyBzbmFwc2hvdC4gIG9uIGVhY2ggcG9sbCBjeWNsZSwgZGlmZnMgYWdhaW5zdFxuICAvLyByZXN1bHRzIGRyaXZlcyB0aGUgY2FsbGJhY2tzLlxuICBzZWxmLl9yZXN1bHRzID0gbnVsbDtcblxuICAvLyBUaGUgbnVtYmVyIG9mIF9wb2xsTW9uZ28gY2FsbHMgdGhhdCBoYXZlIGJlZW4gYWRkZWQgdG8gc2VsZi5fdGFza1F1ZXVlIGJ1dFxuICAvLyBoYXZlIG5vdCBzdGFydGVkIHJ1bm5pbmcuIFVzZWQgdG8gbWFrZSBzdXJlIHdlIG5ldmVyIHNjaGVkdWxlIG1vcmUgdGhhbiBvbmVcbiAgLy8gX3BvbGxNb25nbyAob3RoZXIgdGhhbiBwb3NzaWJseSB0aGUgb25lIHRoYXQgaXMgY3VycmVudGx5IHJ1bm5pbmcpLiBJdCdzXG4gIC8vIGFsc28gdXNlZCBieSBfc3VzcGVuZFBvbGxpbmcgdG8gcHJldGVuZCB0aGVyZSdzIGEgcG9sbCBzY2hlZHVsZWQuIFVzdWFsbHksXG4gIC8vIGl0J3MgZWl0aGVyIDAgKGZvciBcIm5vIHBvbGxzIHNjaGVkdWxlZCBvdGhlciB0aGFuIG1heWJlIG9uZSBjdXJyZW50bHlcbiAgLy8gcnVubmluZ1wiKSBvciAxIChmb3IgXCJhIHBvbGwgc2NoZWR1bGVkIHRoYXQgaXNuJ3QgcnVubmluZyB5ZXRcIiksIGJ1dCBpdCBjYW5cbiAgLy8gYWxzbyBiZSAyIGlmIGluY3JlbWVudGVkIGJ5IF9zdXNwZW5kUG9sbGluZy5cbiAgc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkID0gMDtcbiAgc2VsZi5fcGVuZGluZ1dyaXRlcyA9IFtdOyAvLyBwZW9wbGUgdG8gbm90aWZ5IHdoZW4gcG9sbGluZyBjb21wbGV0ZXNcblxuICAvLyBNYWtlIHN1cmUgdG8gY3JlYXRlIGEgc2VwYXJhdGVseSB0aHJvdHRsZWQgZnVuY3Rpb24gZm9yIGVhY2hcbiAgLy8gUG9sbGluZ09ic2VydmVEcml2ZXIgb2JqZWN0LlxuICBzZWxmLl9lbnN1cmVQb2xsSXNTY2hlZHVsZWQgPSBfLnRocm90dGxlKFxuICAgIHNlbGYuX3VudGhyb3R0bGVkRW5zdXJlUG9sbElzU2NoZWR1bGVkLFxuICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucG9sbGluZ1Rocm90dGxlTXMgfHwgUE9MTElOR19USFJPVFRMRV9NUyAvKiBtcyAqLyk7XG5cbiAgLy8gWFhYIGZpZ3VyZSBvdXQgaWYgd2Ugc3RpbGwgbmVlZCBhIHF1ZXVlXG4gIHNlbGYuX3Rhc2tRdWV1ZSA9IG5ldyBNZXRlb3IuX0FzeW5jaHJvbm91c1F1ZXVlKCk7XG5cbiAgdmFyIGxpc3RlbmVyc0hhbmRsZSA9IGxpc3RlbkFsbChcbiAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiwgZnVuY3Rpb24gKG5vdGlmaWNhdGlvbikge1xuICAgICAgLy8gV2hlbiBzb21lb25lIGRvZXMgYSB0cmFuc2FjdGlvbiB0aGF0IG1pZ2h0IGFmZmVjdCB1cywgc2NoZWR1bGUgYSBwb2xsXG4gICAgICAvLyBvZiB0aGUgZGF0YWJhc2UuIElmIHRoYXQgdHJhbnNhY3Rpb24gaGFwcGVucyBpbnNpZGUgb2YgYSB3cml0ZSBmZW5jZSxcbiAgICAgIC8vIGJsb2NrIHRoZSBmZW5jZSB1bnRpbCB3ZSd2ZSBwb2xsZWQgYW5kIG5vdGlmaWVkIG9ic2VydmVycy5cbiAgICAgIHZhciBmZW5jZSA9IEREUFNlcnZlci5fZ2V0Q3VycmVudEZlbmNlKCk7XG4gICAgICBpZiAoZmVuY2UpXG4gICAgICAgIHNlbGYuX3BlbmRpbmdXcml0ZXMucHVzaChmZW5jZS5iZWdpbldyaXRlKCkpO1xuICAgICAgLy8gRW5zdXJlIGEgcG9sbCBpcyBzY2hlZHVsZWQuLi4gYnV0IGlmIHdlIGFscmVhZHkga25vdyB0aGF0IG9uZSBpcyxcbiAgICAgIC8vIGRvbid0IGhpdCB0aGUgdGhyb3R0bGVkIF9lbnN1cmVQb2xsSXNTY2hlZHVsZWQgZnVuY3Rpb24gKHdoaWNoIG1pZ2h0XG4gICAgICAvLyBsZWFkIHRvIHVzIGNhbGxpbmcgaXQgdW5uZWNlc3NhcmlseSBpbiA8cG9sbGluZ1Rocm90dGxlTXM+IG1zKS5cbiAgICAgIGlmIChzZWxmLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgPT09IDApXG4gICAgICAgIHNlbGYuX2Vuc3VyZVBvbGxJc1NjaGVkdWxlZCgpO1xuICAgIH1cbiAgKTtcbiAgc2VsZi5fc3RvcENhbGxiYWNrcy5wdXNoKGFzeW5jIGZ1bmN0aW9uICgpIHsgYXdhaXQgbGlzdGVuZXJzSGFuZGxlLnN0b3AoKTsgfSk7XG5cbiAgLy8gZXZlcnkgb25jZSBhbmQgYSB3aGlsZSwgcG9sbCBldmVuIGlmIHdlIGRvbid0IHRoaW5rIHdlJ3JlIGRpcnR5LCBmb3JcbiAgLy8gZXZlbnR1YWwgY29uc2lzdGVuY3kgd2l0aCBkYXRhYmFzZSB3cml0ZXMgZnJvbSBvdXRzaWRlIHRoZSBNZXRlb3JcbiAgLy8gdW5pdmVyc2UuXG4gIC8vXG4gIC8vIEZvciB0ZXN0aW5nLCB0aGVyZSdzIGFuIHVuZG9jdW1lbnRlZCBjYWxsYmFjayBhcmd1bWVudCB0byBvYnNlcnZlQ2hhbmdlc1xuICAvLyB3aGljaCBkaXNhYmxlcyB0aW1lLWJhc2VkIHBvbGxpbmcgYW5kIGdldHMgY2FsbGVkIGF0IHRoZSBiZWdpbm5pbmcgb2YgZWFjaFxuICAvLyBwb2xsLlxuICBpZiAob3B0aW9ucy5fdGVzdE9ubHlQb2xsQ2FsbGJhY2spIHtcbiAgICBzZWxmLl90ZXN0T25seVBvbGxDYWxsYmFjayA9IG9wdGlvbnMuX3Rlc3RPbmx5UG9sbENhbGxiYWNrO1xuICB9IGVsc2Uge1xuICAgIHZhciBwb2xsaW5nSW50ZXJ2YWwgPVxuICAgICAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucG9sbGluZ0ludGVydmFsTXMgfHxcbiAgICAgICAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLl9wb2xsaW5nSW50ZXJ2YWwgfHwgLy8gQ09NUEFUIHdpdGggMS4yXG4gICAgICAgICAgUE9MTElOR19JTlRFUlZBTF9NUztcbiAgICB2YXIgaW50ZXJ2YWxIYW5kbGUgPSBNZXRlb3Iuc2V0SW50ZXJ2YWwoXG4gICAgICBfLmJpbmQoc2VsZi5fZW5zdXJlUG9sbElzU2NoZWR1bGVkLCBzZWxmKSwgcG9sbGluZ0ludGVydmFsKTtcbiAgICBzZWxmLl9zdG9wQ2FsbGJhY2tzLnB1c2goZnVuY3Rpb24gKCkge1xuICAgICAgTWV0ZW9yLmNsZWFySW50ZXJ2YWwoaW50ZXJ2YWxIYW5kbGUpO1xuICAgIH0pO1xuICB9XG59O1xuXG5fLmV4dGVuZChQb2xsaW5nT2JzZXJ2ZURyaXZlci5wcm90b3R5cGUsIHtcbiAgX2luaXQ6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAvLyBNYWtlIHN1cmUgd2UgYWN0dWFsbHkgcG9sbCBzb29uIVxuICAgIGF3YWl0IHRoaXMuX3VudGhyb3R0bGVkRW5zdXJlUG9sbElzU2NoZWR1bGVkKCk7XG5cbiAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtcG9sbGluZ1wiLCAxKTtcbiAgfSxcbiAgLy8gVGhpcyBpcyBhbHdheXMgY2FsbGVkIHRocm91Z2ggXy50aHJvdHRsZSAoZXhjZXB0IG9uY2UgYXQgc3RhcnR1cCkuXG4gIF91bnRocm90dGxlZEVuc3VyZVBvbGxJc1NjaGVkdWxlZDogYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkID4gMClcbiAgICAgIHJldHVybjtcbiAgICArK3NlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZDtcbiAgICBhd2FpdCBzZWxmLl90YXNrUXVldWUucnVuVGFzayhhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICBhd2FpdCBzZWxmLl9wb2xsTW9uZ28oKTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyB0ZXN0LW9ubHkgaW50ZXJmYWNlIGZvciBjb250cm9sbGluZyBwb2xsaW5nLlxuICAvL1xuICAvLyBfc3VzcGVuZFBvbGxpbmcgYmxvY2tzIHVudGlsIGFueSBjdXJyZW50bHkgcnVubmluZyBhbmQgc2NoZWR1bGVkIHBvbGxzIGFyZVxuICAvLyBkb25lLCBhbmQgcHJldmVudHMgYW55IGZ1cnRoZXIgcG9sbHMgZnJvbSBiZWluZyBzY2hlZHVsZWQuIChuZXdcbiAgLy8gT2JzZXJ2ZUhhbmRsZXMgY2FuIGJlIGFkZGVkIGFuZCByZWNlaXZlIHRoZWlyIGluaXRpYWwgYWRkZWQgY2FsbGJhY2tzLFxuICAvLyB0aG91Z2guKVxuICAvL1xuICAvLyBfcmVzdW1lUG9sbGluZyBpbW1lZGlhdGVseSBwb2xscywgYW5kIGFsbG93cyBmdXJ0aGVyIHBvbGxzIHRvIG9jY3VyLlxuICBfc3VzcGVuZFBvbGxpbmc6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBQcmV0ZW5kIHRoYXQgdGhlcmUncyBhbm90aGVyIHBvbGwgc2NoZWR1bGVkICh3aGljaCB3aWxsIHByZXZlbnRcbiAgICAvLyBfZW5zdXJlUG9sbElzU2NoZWR1bGVkIGZyb20gcXVldWVpbmcgYW55IG1vcmUgcG9sbHMpLlxuICAgICsrc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkO1xuICAgIC8vIE5vdyBibG9jayB1bnRpbCBhbGwgY3VycmVudGx5IHJ1bm5pbmcgb3Igc2NoZWR1bGVkIHBvbGxzIGFyZSBkb25lLlxuICAgIHNlbGYuX3Rhc2tRdWV1ZS5ydW5UYXNrKGZ1bmN0aW9uKCkge30pO1xuXG4gICAgLy8gQ29uZmlybSB0aGF0IHRoZXJlIGlzIG9ubHkgb25lIFwicG9sbFwiICh0aGUgZmFrZSBvbmUgd2UncmUgcHJldGVuZGluZyB0b1xuICAgIC8vIGhhdmUpIHNjaGVkdWxlZC5cbiAgICBpZiAoc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkICE9PSAxKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCBpcyBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkKTtcbiAgfSxcbiAgX3Jlc3VtZVBvbGxpbmc6IGFzeW5jIGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBXZSBzaG91bGQgYmUgaW4gdGhlIHNhbWUgc3RhdGUgYXMgaW4gdGhlIGVuZCBvZiBfc3VzcGVuZFBvbGxpbmcuXG4gICAgaWYgKHNlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCAhPT0gMSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgaXMgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCk7XG4gICAgLy8gUnVuIGEgcG9sbCBzeW5jaHJvbm91c2x5ICh3aGljaCB3aWxsIGNvdW50ZXJhY3QgdGhlXG4gICAgLy8gKytfcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkIGZyb20gX3N1c3BlbmRQb2xsaW5nKS5cbiAgICBhd2FpdCBzZWxmLl90YXNrUXVldWUucnVuVGFzayhhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICBhd2FpdCBzZWxmLl9wb2xsTW9uZ28oKTtcbiAgICB9KTtcbiAgfSxcblxuICBhc3luYyBfcG9sbE1vbmdvKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAtLXNlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZDtcblxuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuO1xuXG4gICAgdmFyIGZpcnN0ID0gZmFsc2U7XG4gICAgdmFyIG5ld1Jlc3VsdHM7XG4gICAgdmFyIG9sZFJlc3VsdHMgPSBzZWxmLl9yZXN1bHRzO1xuICAgIGlmICghb2xkUmVzdWx0cykge1xuICAgICAgZmlyc3QgPSB0cnVlO1xuICAgICAgLy8gWFhYIG1heWJlIHVzZSBPcmRlcmVkRGljdCBpbnN0ZWFkP1xuICAgICAgb2xkUmVzdWx0cyA9IHNlbGYuX29yZGVyZWQgPyBbXSA6IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICAgIH1cblxuICAgIHNlbGYuX3Rlc3RPbmx5UG9sbENhbGxiYWNrICYmIHNlbGYuX3Rlc3RPbmx5UG9sbENhbGxiYWNrKCk7XG5cbiAgICAvLyBTYXZlIHRoZSBsaXN0IG9mIHBlbmRpbmcgd3JpdGVzIHdoaWNoIHRoaXMgcm91bmQgd2lsbCBjb21taXQuXG4gICAgdmFyIHdyaXRlc0ZvckN5Y2xlID0gc2VsZi5fcGVuZGluZ1dyaXRlcztcbiAgICBzZWxmLl9wZW5kaW5nV3JpdGVzID0gW107XG5cbiAgICAvLyBHZXQgdGhlIG5ldyBxdWVyeSByZXN1bHRzLiAoVGhpcyB5aWVsZHMuKVxuICAgIHRyeSB7XG4gICAgICBuZXdSZXN1bHRzID0gYXdhaXQgc2VsZi5fY3Vyc29yLmdldFJhd09iamVjdHMoc2VsZi5fb3JkZXJlZCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGZpcnN0ICYmIHR5cGVvZihlLmNvZGUpID09PSAnbnVtYmVyJykge1xuICAgICAgICAvLyBUaGlzIGlzIGFuIGVycm9yIGRvY3VtZW50IHNlbnQgdG8gdXMgYnkgbW9uZ29kLCBub3QgYSBjb25uZWN0aW9uXG4gICAgICAgIC8vIGVycm9yIGdlbmVyYXRlZCBieSB0aGUgY2xpZW50LiBBbmQgd2UndmUgbmV2ZXIgc2VlbiB0aGlzIHF1ZXJ5IHdvcmtcbiAgICAgICAgLy8gc3VjY2Vzc2Z1bGx5LiBQcm9iYWJseSBpdCdzIGEgYmFkIHNlbGVjdG9yIG9yIHNvbWV0aGluZywgc28gd2Ugc2hvdWxkXG4gICAgICAgIC8vIE5PVCByZXRyeS4gSW5zdGVhZCwgd2Ugc2hvdWxkIGhhbHQgdGhlIG9ic2VydmUgKHdoaWNoIGVuZHMgdXAgY2FsbGluZ1xuICAgICAgICAvLyBgc3RvcGAgb24gdXMpLlxuICAgICAgICBhd2FpdCBzZWxmLl9tdWx0aXBsZXhlci5xdWVyeUVycm9yKFxuICAgICAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIFwiRXhjZXB0aW9uIHdoaWxlIHBvbGxpbmcgcXVlcnkgXCIgK1xuICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uKSArIFwiOiBcIiArIGUubWVzc2FnZSkpO1xuICAgICAgfVxuXG4gICAgICAvLyBnZXRSYXdPYmplY3RzIGNhbiB0aHJvdyBpZiB3ZSdyZSBoYXZpbmcgdHJvdWJsZSB0YWxraW5nIHRvIHRoZVxuICAgICAgLy8gZGF0YWJhc2UuICBUaGF0J3MgZmluZSAtLS0gd2Ugd2lsbCByZXBvbGwgbGF0ZXIgYW55d2F5LiBCdXQgd2Ugc2hvdWxkXG4gICAgICAvLyBtYWtlIHN1cmUgbm90IHRvIGxvc2UgdHJhY2sgb2YgdGhpcyBjeWNsZSdzIHdyaXRlcy5cbiAgICAgIC8vIChJdCBhbHNvIGNhbiB0aHJvdyBpZiB0aGVyZSdzIGp1c3Qgc29tZXRoaW5nIGludmFsaWQgYWJvdXQgdGhpcyBxdWVyeTtcbiAgICAgIC8vIHVuZm9ydHVuYXRlbHkgdGhlIE9ic2VydmVEcml2ZXIgQVBJIGRvZXNuJ3QgcHJvdmlkZSBhIGdvb2Qgd2F5IHRvXG4gICAgICAvLyBcImNhbmNlbFwiIHRoZSBvYnNlcnZlIGZyb20gdGhlIGluc2lkZSBpbiB0aGlzIGNhc2UuXG4gICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShzZWxmLl9wZW5kaW5nV3JpdGVzLCB3cml0ZXNGb3JDeWNsZSk7XG4gICAgICBNZXRlb3IuX2RlYnVnKFwiRXhjZXB0aW9uIHdoaWxlIHBvbGxpbmcgcXVlcnkgXCIgK1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uKSwgZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUnVuIGRpZmZzLlxuICAgIGlmICghc2VsZi5fc3RvcHBlZCkge1xuICAgICAgTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlDaGFuZ2VzKFxuICAgICAgICAgIHNlbGYuX29yZGVyZWQsIG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIHNlbGYuX211bHRpcGxleGVyKTtcbiAgICB9XG5cbiAgICAvLyBTaWduYWxzIHRoZSBtdWx0aXBsZXhlciB0byBhbGxvdyBhbGwgb2JzZXJ2ZUNoYW5nZXMgY2FsbHMgdGhhdCBzaGFyZSB0aGlzXG4gICAgLy8gbXVsdGlwbGV4ZXIgdG8gcmV0dXJuLiAoVGhpcyBoYXBwZW5zIGFzeW5jaHJvbm91c2x5LCB2aWEgdGhlXG4gICAgLy8gbXVsdGlwbGV4ZXIncyBxdWV1ZS4pXG4gICAgaWYgKGZpcnN0KVxuICAgICAgc2VsZi5fbXVsdGlwbGV4ZXIucmVhZHkoKTtcblxuICAgIC8vIFJlcGxhY2Ugc2VsZi5fcmVzdWx0cyBhdG9taWNhbGx5LiAgKFRoaXMgYXNzaWdubWVudCBpcyB3aGF0IG1ha2VzIGBmaXJzdGBcbiAgICAvLyBzdGF5IHRocm91Z2ggb24gdGhlIG5leHQgY3ljbGUsIHNvIHdlJ3ZlIHdhaXRlZCB1bnRpbCBhZnRlciB3ZSd2ZVxuICAgIC8vIGNvbW1pdHRlZCB0byByZWFkeS1pbmcgdGhlIG11bHRpcGxleGVyLilcbiAgICBzZWxmLl9yZXN1bHRzID0gbmV3UmVzdWx0cztcblxuICAgIC8vIE9uY2UgdGhlIE9ic2VydmVNdWx0aXBsZXhlciBoYXMgcHJvY2Vzc2VkIGV2ZXJ5dGhpbmcgd2UndmUgZG9uZSBpbiB0aGlzXG4gICAgLy8gcm91bmQsIG1hcmsgYWxsIHRoZSB3cml0ZXMgd2hpY2ggZXhpc3RlZCBiZWZvcmUgdGhpcyBjYWxsIGFzXG4gICAgLy8gY29tbW1pdHRlZC4gKElmIG5ldyB3cml0ZXMgaGF2ZSBzaG93biB1cCBpbiB0aGUgbWVhbnRpbWUsIHRoZXJlJ2xsXG4gICAgLy8gYWxyZWFkeSBiZSBhbm90aGVyIF9wb2xsTW9uZ28gdGFzayBzY2hlZHVsZWQuKVxuICAgIGF3YWl0IHNlbGYuX211bHRpcGxleGVyLm9uRmx1c2goYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgZm9yIChjb25zdCB3IG9mIHdyaXRlc0ZvckN5Y2xlKSB7XG4gICAgICAgIGF3YWl0IHcuY29tbWl0dGVkKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9zdG9wcGVkID0gdHJ1ZTtcbiAgICBjb25zdCBzdG9wQ2FsbGJhY2tzQ2FsbGVyID0gYXN5bmMgZnVuY3Rpb24oYykge1xuICAgICAgYXdhaXQgYygpO1xuICAgIH07XG5cbiAgICBfLmVhY2goc2VsZi5fc3RvcENhbGxiYWNrcywgc3RvcENhbGxiYWNrc0NhbGxlcik7XG4gICAgLy8gUmVsZWFzZSBhbnkgd3JpdGUgZmVuY2VzIHRoYXQgYXJlIHdhaXRpbmcgb24gdXMuXG4gICAgXy5lYWNoKHNlbGYuX3BlbmRpbmdXcml0ZXMsIGFzeW5jIGZ1bmN0aW9uICh3KSB7XG4gICAgICBhd2FpdCB3LmNvbW1pdHRlZCgpO1xuICAgIH0pO1xuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtcG9sbGluZ1wiLCAtMSk7XG4gIH1cbn0pO1xuIiwiaW1wb3J0IHsgb3Bsb2dWMlYxQ29udmVydGVyIH0gZnJvbSBcIi4vb3Bsb2dfdjJfY29udmVydGVyXCI7XG5cbnZhciBQSEFTRSA9IHtcbiAgUVVFUllJTkc6IFwiUVVFUllJTkdcIixcbiAgRkVUQ0hJTkc6IFwiRkVUQ0hJTkdcIixcbiAgU1RFQURZOiBcIlNURUFEWVwiXG59O1xuXG4vLyBFeGNlcHRpb24gdGhyb3duIGJ5IF9uZWVkVG9Qb2xsUXVlcnkgd2hpY2ggdW5yb2xscyB0aGUgc3RhY2sgdXAgdG8gdGhlXG4vLyBlbmNsb3NpbmcgY2FsbCB0byBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeS5cbnZhciBTd2l0Y2hlZFRvUXVlcnkgPSBmdW5jdGlvbiAoKSB7fTtcbnZhciBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeSA9IGZ1bmN0aW9uIChmKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGYuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoIShlIGluc3RhbmNlb2YgU3dpdGNoZWRUb1F1ZXJ5KSlcbiAgICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH07XG59O1xuXG52YXIgY3VycmVudElkID0gMDtcblxuLy8gT3Bsb2dPYnNlcnZlRHJpdmVyIGlzIGFuIGFsdGVybmF0aXZlIHRvIFBvbGxpbmdPYnNlcnZlRHJpdmVyIHdoaWNoIGZvbGxvd3Ncbi8vIHRoZSBNb25nbyBvcGVyYXRpb24gbG9nIGluc3RlYWQgb2YganVzdCByZS1wb2xsaW5nIHRoZSBxdWVyeS4gSXQgb2JleXMgdGhlXG4vLyBzYW1lIHNpbXBsZSBpbnRlcmZhY2U6IGNvbnN0cnVjdGluZyBpdCBzdGFydHMgc2VuZGluZyBvYnNlcnZlQ2hhbmdlc1xuLy8gY2FsbGJhY2tzIChhbmQgYSByZWFkeSgpIGludm9jYXRpb24pIHRvIHRoZSBPYnNlcnZlTXVsdGlwbGV4ZXIsIGFuZCB5b3Ugc3RvcFxuLy8gaXQgYnkgY2FsbGluZyB0aGUgc3RvcCgpIG1ldGhvZC5cbk9wbG9nT2JzZXJ2ZURyaXZlciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5fdXNlc09wbG9nID0gdHJ1ZTsgIC8vIHRlc3RzIGxvb2sgYXQgdGhpc1xuXG4gIHNlbGYuX2lkID0gY3VycmVudElkO1xuICBjdXJyZW50SWQrKztcblxuICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiA9IG9wdGlvbnMuY3Vyc29yRGVzY3JpcHRpb247XG4gIHNlbGYuX21vbmdvSGFuZGxlID0gb3B0aW9ucy5tb25nb0hhbmRsZTtcbiAgc2VsZi5fbXVsdGlwbGV4ZXIgPSBvcHRpb25zLm11bHRpcGxleGVyO1xuXG4gIGlmIChvcHRpb25zLm9yZGVyZWQpIHtcbiAgICB0aHJvdyBFcnJvcihcIk9wbG9nT2JzZXJ2ZURyaXZlciBvbmx5IHN1cHBvcnRzIHVub3JkZXJlZCBvYnNlcnZlQ2hhbmdlc1wiKTtcbiAgfVxuXG4gIHZhciBzb3J0ZXIgPSBvcHRpb25zLnNvcnRlcjtcbiAgLy8gV2UgZG9uJ3Qgc3VwcG9ydCAkbmVhciBhbmQgb3RoZXIgZ2VvLXF1ZXJpZXMgc28gaXQncyBPSyB0byBpbml0aWFsaXplIHRoZVxuICAvLyBjb21wYXJhdG9yIG9ubHkgb25jZSBpbiB0aGUgY29uc3RydWN0b3IuXG4gIHZhciBjb21wYXJhdG9yID0gc29ydGVyICYmIHNvcnRlci5nZXRDb21wYXJhdG9yKCk7XG5cbiAgaWYgKG9wdGlvbnMuY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy5saW1pdCkge1xuICAgIC8vIFRoZXJlIGFyZSBzZXZlcmFsIHByb3BlcnRpZXMgb3JkZXJlZCBkcml2ZXIgaW1wbGVtZW50czpcbiAgICAvLyAtIF9saW1pdCBpcyBhIHBvc2l0aXZlIG51bWJlclxuICAgIC8vIC0gX2NvbXBhcmF0b3IgaXMgYSBmdW5jdGlvbi1jb21wYXJhdG9yIGJ5IHdoaWNoIHRoZSBxdWVyeSBpcyBvcmRlcmVkXG4gICAgLy8gLSBfdW5wdWJsaXNoZWRCdWZmZXIgaXMgbm9uLW51bGwgTWluL01heCBIZWFwLFxuICAgIC8vICAgICAgICAgICAgICAgICAgICAgIHRoZSBlbXB0eSBidWZmZXIgaW4gU1RFQURZIHBoYXNlIGltcGxpZXMgdGhhdCB0aGVcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgICBldmVyeXRoaW5nIHRoYXQgbWF0Y2hlcyB0aGUgcXVlcmllcyBzZWxlY3RvciBmaXRzXG4gICAgLy8gICAgICAgICAgICAgICAgICAgICAgaW50byBwdWJsaXNoZWQgc2V0LlxuICAgIC8vIC0gX3B1Ymxpc2hlZCAtIE1heCBIZWFwIChhbHNvIGltcGxlbWVudHMgSWRNYXAgbWV0aG9kcylcblxuICAgIHZhciBoZWFwT3B0aW9ucyA9IHsgSWRNYXA6IExvY2FsQ29sbGVjdGlvbi5fSWRNYXAgfTtcbiAgICBzZWxmLl9saW1pdCA9IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMubGltaXQ7XG4gICAgc2VsZi5fY29tcGFyYXRvciA9IGNvbXBhcmF0b3I7XG4gICAgc2VsZi5fc29ydGVyID0gc29ydGVyO1xuICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyID0gbmV3IE1pbk1heEhlYXAoY29tcGFyYXRvciwgaGVhcE9wdGlvbnMpO1xuICAgIC8vIFdlIG5lZWQgc29tZXRoaW5nIHRoYXQgY2FuIGZpbmQgTWF4IHZhbHVlIGluIGFkZGl0aW9uIHRvIElkTWFwIGludGVyZmFjZVxuICAgIHNlbGYuX3B1Ymxpc2hlZCA9IG5ldyBNYXhIZWFwKGNvbXBhcmF0b3IsIGhlYXBPcHRpb25zKTtcbiAgfSBlbHNlIHtcbiAgICBzZWxmLl9saW1pdCA9IDA7XG4gICAgc2VsZi5fY29tcGFyYXRvciA9IG51bGw7XG4gICAgc2VsZi5fc29ydGVyID0gbnVsbDtcbiAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlciA9IG51bGw7XG4gICAgc2VsZi5fcHVibGlzaGVkID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gIH1cblxuICAvLyBJbmRpY2F0ZXMgaWYgaXQgaXMgc2FmZSB0byBpbnNlcnQgYSBuZXcgZG9jdW1lbnQgYXQgdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIC8vIGZvciB0aGlzIHF1ZXJ5LiBpLmUuIGl0IGlzIGtub3duIHRoYXQgdGhlcmUgYXJlIG5vIGRvY3VtZW50cyBtYXRjaGluZyB0aGVcbiAgLy8gc2VsZWN0b3IgdGhvc2UgYXJlIG5vdCBpbiBwdWJsaXNoZWQgb3IgYnVmZmVyLlxuICBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgPSBmYWxzZTtcblxuICBzZWxmLl9zdG9wcGVkID0gZmFsc2U7XG4gIHNlbGYuX3N0b3BIYW5kbGVzID0gW107XG5cbiAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtb3Bsb2dcIiwgMSk7XG5cbiAgc2VsZi5fcmVnaXN0ZXJQaGFzZUNoYW5nZShQSEFTRS5RVUVSWUlORyk7XG5cbiAgc2VsZi5fbWF0Y2hlciA9IG9wdGlvbnMubWF0Y2hlcjtcbiAgLy8gd2UgYXJlIG5vdyB1c2luZyBwcm9qZWN0aW9uLCBub3QgZmllbGRzIGluIHRoZSBjdXJzb3IgZGVzY3JpcHRpb24gZXZlbiBpZiB5b3UgcGFzcyB7ZmllbGRzfVxuICAvLyBpbiB0aGUgY3Vyc29yIGNvbnN0cnVjdGlvblxuICB2YXIgcHJvamVjdGlvbiA9IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMuZmllbGRzIHx8IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucHJvamVjdGlvbiB8fCB7fTtcbiAgc2VsZi5fcHJvamVjdGlvbkZuID0gTG9jYWxDb2xsZWN0aW9uLl9jb21waWxlUHJvamVjdGlvbihwcm9qZWN0aW9uKTtcbiAgLy8gUHJvamVjdGlvbiBmdW5jdGlvbiwgcmVzdWx0IG9mIGNvbWJpbmluZyBpbXBvcnRhbnQgZmllbGRzIGZvciBzZWxlY3RvciBhbmRcbiAgLy8gZXhpc3RpbmcgZmllbGRzIHByb2plY3Rpb25cbiAgc2VsZi5fc2hhcmVkUHJvamVjdGlvbiA9IHNlbGYuX21hdGNoZXIuY29tYmluZUludG9Qcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuICBpZiAoc29ydGVyKVxuICAgIHNlbGYuX3NoYXJlZFByb2plY3Rpb24gPSBzb3J0ZXIuY29tYmluZUludG9Qcm9qZWN0aW9uKHNlbGYuX3NoYXJlZFByb2plY3Rpb24pO1xuICBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4gPSBMb2NhbENvbGxlY3Rpb24uX2NvbXBpbGVQcm9qZWN0aW9uKFxuICAgIHNlbGYuX3NoYXJlZFByb2plY3Rpb24pO1xuXG4gIHNlbGYuX25lZWRUb0ZldGNoID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nID0gbnVsbDtcbiAgc2VsZi5fZmV0Y2hHZW5lcmF0aW9uID0gMDtcblxuICBzZWxmLl9yZXF1ZXJ5V2hlbkRvbmVUaGlzUXVlcnkgPSBmYWxzZTtcbiAgc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSA9IFtdO1xuXG4gIC8vIElmIHRoZSBvcGxvZyBoYW5kbGUgdGVsbHMgdXMgdGhhdCBpdCBza2lwcGVkIHNvbWUgZW50cmllcyAoYmVjYXVzZSBpdCBnb3RcbiAgLy8gYmVoaW5kLCBzYXkpLCByZS1wb2xsLlxuICBzZWxmLl9zdG9wSGFuZGxlcy5wdXNoKHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS5vblNraXBwZWRFbnRyaWVzKFxuICAgIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICB9KVxuICApKTtcblxuICBmb3JFYWNoVHJpZ2dlcihzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiwgZnVuY3Rpb24gKHRyaWdnZXIpIHtcbiAgICBzZWxmLl9zdG9wSGFuZGxlcy5wdXNoKHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS5vbk9wbG9nRW50cnkoXG4gICAgICB0cmlnZ2VyLCBmdW5jdGlvbiAobm90aWZpY2F0aW9uKSB7XG4gICAgICAgIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgb3AgPSBub3RpZmljYXRpb24ub3A7XG4gICAgICAgICAgaWYgKG5vdGlmaWNhdGlvbi5kcm9wQ29sbGVjdGlvbiB8fCBub3RpZmljYXRpb24uZHJvcERhdGFiYXNlKSB7XG4gICAgICAgICAgICAvLyBOb3RlOiB0aGlzIGNhbGwgaXMgbm90IGFsbG93ZWQgdG8gYmxvY2sgb24gYW55dGhpbmcgKGVzcGVjaWFsbHlcbiAgICAgICAgICAgIC8vIG9uIHdhaXRpbmcgZm9yIG9wbG9nIGVudHJpZXMgdG8gY2F0Y2ggdXApIGJlY2F1c2UgdGhhdCB3aWxsIGJsb2NrXG4gICAgICAgICAgICAvLyBvbk9wbG9nRW50cnkhXG4gICAgICAgICAgICByZXR1cm4gc2VsZi5fbmVlZFRvUG9sbFF1ZXJ5KCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEFsbCBvdGhlciBvcGVyYXRvcnMgc2hvdWxkIGJlIGhhbmRsZWQgZGVwZW5kaW5nIG9uIHBoYXNlXG4gICAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlFVRVJZSU5HKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzZWxmLl9oYW5kbGVPcGxvZ0VudHJ5UXVlcnlpbmcob3ApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2hhbmRsZU9wbG9nRW50cnlTdGVhZHlPckZldGNoaW5nKG9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG4gICAgKSk7XG4gIH0pO1xuXG4gIC8vIFhYWCBvcmRlcmluZyB3LnIudC4gZXZlcnl0aGluZyBlbHNlP1xuICBzZWxmLl9zdG9wSGFuZGxlcy5wdXNoKGxpc3RlbkFsbChcbiAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiwgZnVuY3Rpb24gKCkge1xuICAgICAgLy8gSWYgd2UncmUgbm90IGluIGEgcHJlLWZpcmUgd3JpdGUgZmVuY2UsIHdlIGRvbid0IGhhdmUgdG8gZG8gYW55dGhpbmcuXG4gICAgICB2YXIgZmVuY2UgPSBERFBTZXJ2ZXIuX2dldEN1cnJlbnRGZW5jZSgpO1xuICAgICAgaWYgKCFmZW5jZSB8fCBmZW5jZS5maXJlZClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAoZmVuY2UuX29wbG9nT2JzZXJ2ZURyaXZlcnMpIHtcbiAgICAgICAgZmVuY2UuX29wbG9nT2JzZXJ2ZURyaXZlcnNbc2VsZi5faWRdID0gc2VsZjtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBmZW5jZS5fb3Bsb2dPYnNlcnZlRHJpdmVycyA9IHt9O1xuICAgICAgZmVuY2UuX29wbG9nT2JzZXJ2ZURyaXZlcnNbc2VsZi5faWRdID0gc2VsZjtcblxuICAgICAgZmVuY2Uub25CZWZvcmVGaXJlKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGRyaXZlcnMgPSBmZW5jZS5fb3Bsb2dPYnNlcnZlRHJpdmVycztcbiAgICAgICAgZGVsZXRlIGZlbmNlLl9vcGxvZ09ic2VydmVEcml2ZXJzO1xuXG4gICAgICAgIC8vIFRoaXMgZmVuY2UgY2Fubm90IGZpcmUgdW50aWwgd2UndmUgY2F1Z2h0IHVwIHRvIFwidGhpcyBwb2ludFwiIGluIHRoZVxuICAgICAgICAvLyBvcGxvZywgYW5kIGFsbCBvYnNlcnZlcnMgbWFkZSBpdCBiYWNrIHRvIHRoZSBzdGVhZHkgc3RhdGUuXG4gICAgICAgIGF3YWl0IHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS53YWl0VW50aWxDYXVnaHRVcCgpO1xuXG4gICAgICAgIGZvciAoY29uc3QgZHJpdmVyIG9mIE9iamVjdC52YWx1ZXMoZHJpdmVycykpIHtcbiAgICAgICAgICBpZiAoZHJpdmVyLl9zdG9wcGVkKVxuICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICB2YXIgd3JpdGUgPSBhd2FpdCBmZW5jZS5iZWdpbldyaXRlKCk7XG4gICAgICAgICAgaWYgKGRyaXZlci5fcGhhc2UgPT09IFBIQVNFLlNURUFEWSkge1xuICAgICAgICAgICAgLy8gTWFrZSBzdXJlIHRoYXQgYWxsIG9mIHRoZSBjYWxsYmFja3MgaGF2ZSBtYWRlIGl0IHRocm91Z2ggdGhlXG4gICAgICAgICAgICAvLyBtdWx0aXBsZXhlciBhbmQgYmVlbiBkZWxpdmVyZWQgdG8gT2JzZXJ2ZUhhbmRsZXMgYmVmb3JlIGNvbW1pdHRpbmdcbiAgICAgICAgICAgIC8vIHdyaXRlcy5cbiAgICAgICAgICAgIGF3YWl0IGRyaXZlci5fbXVsdGlwbGV4ZXIub25GbHVzaCh3cml0ZS5jb21taXR0ZWQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkcml2ZXIuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkucHVzaCh3cml0ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICkpO1xuXG4gIC8vIFdoZW4gTW9uZ28gZmFpbHMgb3Zlciwgd2UgbmVlZCB0byByZXBvbGwgdGhlIHF1ZXJ5LCBpbiBjYXNlIHdlIHByb2Nlc3NlZCBhblxuICAvLyBvcGxvZyBlbnRyeSB0aGF0IGdvdCByb2xsZWQgYmFjay5cbiAgc2VsZi5fc3RvcEhhbmRsZXMucHVzaChzZWxmLl9tb25nb0hhbmRsZS5fb25GYWlsb3ZlcihmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeShcbiAgICBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gc2VsZi5fbmVlZFRvUG9sbFF1ZXJ5KCk7XG4gICAgfSkpKTtcbn07XG5cbl8uZXh0ZW5kKE9wbG9nT2JzZXJ2ZURyaXZlci5wcm90b3R5cGUsIHtcbiAgX2luaXQ6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIC8vIEdpdmUgX29ic2VydmVDaGFuZ2VzIGEgY2hhbmNlIHRvIGFkZCB0aGUgbmV3IE9ic2VydmVIYW5kbGUgdG8gb3VyXG4gICAgLy8gbXVsdGlwbGV4ZXIsIHNvIHRoYXQgdGhlIGFkZGVkIGNhbGxzIGdldCBzdHJlYW1lZC5cbiAgICByZXR1cm4gc2VsZi5fcnVuSW5pdGlhbFF1ZXJ5KCk7XG4gIH0sXG4gIF9hZGRQdWJsaXNoZWQ6IGZ1bmN0aW9uIChpZCwgZG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBmaWVsZHMgPSBfLmNsb25lKGRvYyk7XG4gICAgICBkZWxldGUgZmllbGRzLl9pZDtcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5zZXQoaWQsIHNlbGYuX3NoYXJlZFByb2plY3Rpb25Gbihkb2MpKTtcbiAgICAgIHNlbGYuX211bHRpcGxleGVyLmFkZGVkKGlkLCBzZWxmLl9wcm9qZWN0aW9uRm4oZmllbGRzKSk7XG5cbiAgICAgIC8vIEFmdGVyIGFkZGluZyB0aGlzIGRvY3VtZW50LCB0aGUgcHVibGlzaGVkIHNldCBtaWdodCBiZSBvdmVyZmxvd2VkXG4gICAgICAvLyAoZXhjZWVkaW5nIGNhcGFjaXR5IHNwZWNpZmllZCBieSBsaW1pdCkuIElmIHNvLCBwdXNoIHRoZSBtYXhpbXVtXG4gICAgICAvLyBlbGVtZW50IHRvIHRoZSBidWZmZXIsIHdlIG1pZ2h0IHdhbnQgdG8gc2F2ZSBpdCBpbiBtZW1vcnkgdG8gcmVkdWNlIHRoZVxuICAgICAgLy8gYW1vdW50IG9mIE1vbmdvIGxvb2t1cHMgaW4gdGhlIGZ1dHVyZS5cbiAgICAgIGlmIChzZWxmLl9saW1pdCAmJiBzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpID4gc2VsZi5fbGltaXQpIHtcbiAgICAgICAgLy8gWFhYIGluIHRoZW9yeSB0aGUgc2l6ZSBvZiBwdWJsaXNoZWQgaXMgbm8gbW9yZSB0aGFuIGxpbWl0KzFcbiAgICAgICAgaWYgKHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgIT09IHNlbGYuX2xpbWl0ICsgMSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkFmdGVyIGFkZGluZyB0byBwdWJsaXNoZWQsIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgLSBzZWxmLl9saW1pdCkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcIiBkb2N1bWVudHMgYXJlIG92ZXJmbG93aW5nIHRoZSBzZXRcIik7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb3ZlcmZsb3dpbmdEb2NJZCA9IHNlbGYuX3B1Ymxpc2hlZC5tYXhFbGVtZW50SWQoKTtcbiAgICAgICAgdmFyIG92ZXJmbG93aW5nRG9jID0gc2VsZi5fcHVibGlzaGVkLmdldChvdmVyZmxvd2luZ0RvY0lkKTtcblxuICAgICAgICBpZiAoRUpTT04uZXF1YWxzKG92ZXJmbG93aW5nRG9jSWQsIGlkKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBkb2N1bWVudCBqdXN0IGFkZGVkIGlzIG92ZXJmbG93aW5nIHRoZSBwdWJsaXNoZWQgc2V0XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5fcHVibGlzaGVkLnJlbW92ZShvdmVyZmxvd2luZ0RvY0lkKTtcbiAgICAgICAgc2VsZi5fbXVsdGlwbGV4ZXIucmVtb3ZlZChvdmVyZmxvd2luZ0RvY0lkKTtcbiAgICAgICAgc2VsZi5fYWRkQnVmZmVyZWQob3ZlcmZsb3dpbmdEb2NJZCwgb3ZlcmZsb3dpbmdEb2MpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBfcmVtb3ZlUHVibGlzaGVkOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fcHVibGlzaGVkLnJlbW92ZShpZCk7XG4gICAgICBzZWxmLl9tdWx0aXBsZXhlci5yZW1vdmVkKGlkKTtcbiAgICAgIGlmICghIHNlbGYuX2xpbWl0IHx8IHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgPT09IHNlbGYuX2xpbWl0KVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpID4gc2VsZi5fbGltaXQpXG4gICAgICAgIHRocm93IEVycm9yKFwic2VsZi5fcHVibGlzaGVkIGdvdCB0b28gYmlnXCIpO1xuXG4gICAgICAvLyBPSywgd2UgYXJlIHB1Ymxpc2hpbmcgbGVzcyB0aGFuIHRoZSBsaW1pdC4gTWF5YmUgd2Ugc2hvdWxkIGxvb2sgaW4gdGhlXG4gICAgICAvLyBidWZmZXIgdG8gZmluZCB0aGUgbmV4dCBlbGVtZW50IHBhc3Qgd2hhdCB3ZSB3ZXJlIHB1Ymxpc2hpbmcgYmVmb3JlLlxuXG4gICAgICBpZiAoIXNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmVtcHR5KCkpIHtcbiAgICAgICAgLy8gVGhlcmUncyBzb21ldGhpbmcgaW4gdGhlIGJ1ZmZlcjsgbW92ZSB0aGUgZmlyc3QgdGhpbmcgaW4gaXQgdG9cbiAgICAgICAgLy8gX3B1Ymxpc2hlZC5cbiAgICAgICAgdmFyIG5ld0RvY0lkID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWluRWxlbWVudElkKCk7XG4gICAgICAgIHZhciBuZXdEb2MgPSBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQobmV3RG9jSWQpO1xuICAgICAgICBzZWxmLl9yZW1vdmVCdWZmZXJlZChuZXdEb2NJZCk7XG4gICAgICAgIHNlbGYuX2FkZFB1Ymxpc2hlZChuZXdEb2NJZCwgbmV3RG9jKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGVyZSdzIG5vdGhpbmcgaW4gdGhlIGJ1ZmZlci4gIFRoaXMgY291bGQgbWVhbiBvbmUgb2YgYSBmZXcgdGhpbmdzLlxuXG4gICAgICAvLyAoYSkgV2UgY291bGQgYmUgaW4gdGhlIG1pZGRsZSBvZiByZS1ydW5uaW5nIHRoZSBxdWVyeSAoc3BlY2lmaWNhbGx5LCB3ZVxuICAgICAgLy8gY291bGQgYmUgaW4gX3B1Ymxpc2hOZXdSZXN1bHRzKS4gSW4gdGhhdCBjYXNlLCBfdW5wdWJsaXNoZWRCdWZmZXIgaXNcbiAgICAgIC8vIGVtcHR5IGJlY2F1c2Ugd2UgY2xlYXIgaXQgYXQgdGhlIGJlZ2lubmluZyBvZiBfcHVibGlzaE5ld1Jlc3VsdHMuIEluXG4gICAgICAvLyB0aGlzIGNhc2UsIG91ciBjYWxsZXIgYWxyZWFkeSBrbm93cyB0aGUgZW50aXJlIGFuc3dlciB0byB0aGUgcXVlcnkgYW5kXG4gICAgICAvLyB3ZSBkb24ndCBuZWVkIHRvIGRvIGFueXRoaW5nIGZhbmN5IGhlcmUuICBKdXN0IHJldHVybi5cbiAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuUVVFUllJTkcpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gKGIpIFdlJ3JlIHByZXR0eSBjb25maWRlbnQgdGhhdCB0aGUgdW5pb24gb2YgX3B1Ymxpc2hlZCBhbmRcbiAgICAgIC8vIF91bnB1Ymxpc2hlZEJ1ZmZlciBjb250YWluIGFsbCBkb2N1bWVudHMgdGhhdCBtYXRjaCBzZWxlY3Rvci4gQmVjYXVzZVxuICAgICAgLy8gX3VucHVibGlzaGVkQnVmZmVyIGlzIGVtcHR5LCB0aGF0IG1lYW5zIHdlJ3JlIGNvbmZpZGVudCB0aGF0IF9wdWJsaXNoZWRcbiAgICAgIC8vIGNvbnRhaW5zIGFsbCBkb2N1bWVudHMgdGhhdCBtYXRjaCBzZWxlY3Rvci4gU28gd2UgaGF2ZSBub3RoaW5nIHRvIGRvLlxuICAgICAgaWYgKHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlcilcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICAvLyAoYykgTWF5YmUgdGhlcmUgYXJlIG90aGVyIGRvY3VtZW50cyBvdXQgdGhlcmUgdGhhdCBzaG91bGQgYmUgaW4gb3VyXG4gICAgICAvLyBidWZmZXIuIEJ1dCBpbiB0aGF0IGNhc2UsIHdoZW4gd2UgZW1wdGllZCBfdW5wdWJsaXNoZWRCdWZmZXIgaW5cbiAgICAgIC8vIF9yZW1vdmVCdWZmZXJlZCwgd2Ugc2hvdWxkIGhhdmUgY2FsbGVkIF9uZWVkVG9Qb2xsUXVlcnksIHdoaWNoIHdpbGxcbiAgICAgIC8vIGVpdGhlciBwdXQgc29tZXRoaW5nIGluIF91bnB1Ymxpc2hlZEJ1ZmZlciBvciBzZXQgX3NhZmVBcHBlbmRUb0J1ZmZlclxuICAgICAgLy8gKG9yIGJvdGgpLCBhbmQgaXQgd2lsbCBwdXQgdXMgaW4gUVVFUllJTkcgZm9yIHRoYXQgd2hvbGUgdGltZS4gU28gaW5cbiAgICAgIC8vIGZhY3QsIHdlIHNob3VsZG4ndCBiZSBhYmxlIHRvIGdldCBoZXJlLlxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJCdWZmZXIgaW5leHBsaWNhYmx5IGVtcHR5XCIpO1xuICAgIH0pO1xuICB9LFxuICBfY2hhbmdlUHVibGlzaGVkOiBmdW5jdGlvbiAoaWQsIG9sZERvYywgbmV3RG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5zZXQoaWQsIHNlbGYuX3NoYXJlZFByb2plY3Rpb25GbihuZXdEb2MpKTtcbiAgICAgIHZhciBwcm9qZWN0ZWROZXcgPSBzZWxmLl9wcm9qZWN0aW9uRm4obmV3RG9jKTtcbiAgICAgIHZhciBwcm9qZWN0ZWRPbGQgPSBzZWxmLl9wcm9qZWN0aW9uRm4ob2xkRG9jKTtcbiAgICAgIHZhciBjaGFuZ2VkID0gRGlmZlNlcXVlbmNlLm1ha2VDaGFuZ2VkRmllbGRzKFxuICAgICAgICBwcm9qZWN0ZWROZXcsIHByb2plY3RlZE9sZCk7XG4gICAgICBpZiAoIV8uaXNFbXB0eShjaGFuZ2VkKSlcbiAgICAgICAgc2VsZi5fbXVsdGlwbGV4ZXIuY2hhbmdlZChpZCwgY2hhbmdlZCk7XG4gICAgfSk7XG4gIH0sXG4gIF9hZGRCdWZmZXJlZDogZnVuY3Rpb24gKGlkLCBkb2MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2V0KGlkLCBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4oZG9jKSk7XG5cbiAgICAgIC8vIElmIHNvbWV0aGluZyBpcyBvdmVyZmxvd2luZyB0aGUgYnVmZmVyLCB3ZSBqdXN0IHJlbW92ZSBpdCBmcm9tIGNhY2hlXG4gICAgICBpZiAoc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpID4gc2VsZi5fbGltaXQpIHtcbiAgICAgICAgdmFyIG1heEJ1ZmZlcmVkSWQgPSBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5tYXhFbGVtZW50SWQoKTtcblxuICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5yZW1vdmUobWF4QnVmZmVyZWRJZCk7XG5cbiAgICAgICAgLy8gU2luY2Ugc29tZXRoaW5nIG1hdGNoaW5nIGlzIHJlbW92ZWQgZnJvbSBjYWNoZSAoYm90aCBwdWJsaXNoZWQgc2V0IGFuZFxuICAgICAgICAvLyBidWZmZXIpLCBzZXQgZmxhZyB0byBmYWxzZVxuICAgICAgICBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgLy8gSXMgY2FsbGVkIGVpdGhlciB0byByZW1vdmUgdGhlIGRvYyBjb21wbGV0ZWx5IGZyb20gbWF0Y2hpbmcgc2V0IG9yIHRvIG1vdmVcbiAgLy8gaXQgdG8gdGhlIHB1Ymxpc2hlZCBzZXQgbGF0ZXIuXG4gIF9yZW1vdmVCdWZmZXJlZDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnJlbW92ZShpZCk7XG4gICAgICAvLyBUbyBrZWVwIHRoZSBjb250cmFjdCBcImJ1ZmZlciBpcyBuZXZlciBlbXB0eSBpbiBTVEVBRFkgcGhhc2UgdW5sZXNzIHRoZVxuICAgICAgLy8gZXZlcnl0aGluZyBtYXRjaGluZyBmaXRzIGludG8gcHVibGlzaGVkXCIgdHJ1ZSwgd2UgcG9sbCBldmVyeXRoaW5nIGFzXG4gICAgICAvLyBzb29uIGFzIHdlIHNlZSB0aGUgYnVmZmVyIGJlY29taW5nIGVtcHR5LlxuICAgICAgaWYgKCEgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpICYmICEgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyKVxuICAgICAgICBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICB9KTtcbiAgfSxcbiAgLy8gQ2FsbGVkIHdoZW4gYSBkb2N1bWVudCBoYXMgam9pbmVkIHRoZSBcIk1hdGNoaW5nXCIgcmVzdWx0cyBzZXQuXG4gIC8vIFRha2VzIHJlc3BvbnNpYmlsaXR5IG9mIGtlZXBpbmcgX3VucHVibGlzaGVkQnVmZmVyIGluIHN5bmMgd2l0aCBfcHVibGlzaGVkXG4gIC8vIGFuZCB0aGUgZWZmZWN0IG9mIGxpbWl0IGVuZm9yY2VkLlxuICBfYWRkTWF0Y2hpbmc6IGZ1bmN0aW9uIChkb2MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGlkID0gZG9jLl9pZDtcbiAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuaGFzKGlkKSlcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJ0cmllZCB0byBhZGQgc29tZXRoaW5nIGFscmVhZHkgcHVibGlzaGVkIFwiICsgaWQpO1xuICAgICAgaWYgKHNlbGYuX2xpbWl0ICYmIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmhhcyhpZCkpXG4gICAgICAgIHRocm93IEVycm9yKFwidHJpZWQgdG8gYWRkIHNvbWV0aGluZyBhbHJlYWR5IGV4aXN0ZWQgaW4gYnVmZmVyIFwiICsgaWQpO1xuXG4gICAgICB2YXIgbGltaXQgPSBzZWxmLl9saW1pdDtcbiAgICAgIHZhciBjb21wYXJhdG9yID0gc2VsZi5fY29tcGFyYXRvcjtcbiAgICAgIHZhciBtYXhQdWJsaXNoZWQgPSAobGltaXQgJiYgc2VsZi5fcHVibGlzaGVkLnNpemUoKSA+IDApID9cbiAgICAgICAgc2VsZi5fcHVibGlzaGVkLmdldChzZWxmLl9wdWJsaXNoZWQubWF4RWxlbWVudElkKCkpIDogbnVsbDtcbiAgICAgIHZhciBtYXhCdWZmZXJlZCA9IChsaW1pdCAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zaXplKCkgPiAwKVxuICAgICAgICA/IHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmdldChzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5tYXhFbGVtZW50SWQoKSlcbiAgICAgICAgOiBudWxsO1xuICAgICAgLy8gVGhlIHF1ZXJ5IGlzIHVubGltaXRlZCBvciBkaWRuJ3QgcHVibGlzaCBlbm91Z2ggZG9jdW1lbnRzIHlldCBvciB0aGVcbiAgICAgIC8vIG5ldyBkb2N1bWVudCB3b3VsZCBmaXQgaW50byBwdWJsaXNoZWQgc2V0IHB1c2hpbmcgdGhlIG1heGltdW0gZWxlbWVudFxuICAgICAgLy8gb3V0LCB0aGVuIHdlIG5lZWQgdG8gcHVibGlzaCB0aGUgZG9jLlxuICAgICAgdmFyIHRvUHVibGlzaCA9ICEgbGltaXQgfHwgc2VsZi5fcHVibGlzaGVkLnNpemUoKSA8IGxpbWl0IHx8XG4gICAgICAgIGNvbXBhcmF0b3IoZG9jLCBtYXhQdWJsaXNoZWQpIDwgMDtcblxuICAgICAgLy8gT3RoZXJ3aXNlIHdlIG1pZ2h0IG5lZWQgdG8gYnVmZmVyIGl0IChvbmx5IGluIGNhc2Ugb2YgbGltaXRlZCBxdWVyeSkuXG4gICAgICAvLyBCdWZmZXJpbmcgaXMgYWxsb3dlZCBpZiB0aGUgYnVmZmVyIGlzIG5vdCBmaWxsZWQgdXAgeWV0IGFuZCBhbGxcbiAgICAgIC8vIG1hdGNoaW5nIGRvY3MgYXJlIGVpdGhlciBpbiB0aGUgcHVibGlzaGVkIHNldCBvciBpbiB0aGUgYnVmZmVyLlxuICAgICAgdmFyIGNhbkFwcGVuZFRvQnVmZmVyID0gIXRvUHVibGlzaCAmJiBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgJiZcbiAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpIDwgbGltaXQ7XG5cbiAgICAgIC8vIE9yIGlmIGl0IGlzIHNtYWxsIGVub3VnaCB0byBiZSBzYWZlbHkgaW5zZXJ0ZWQgdG8gdGhlIG1pZGRsZSBvciB0aGVcbiAgICAgIC8vIGJlZ2lubmluZyBvZiB0aGUgYnVmZmVyLlxuICAgICAgdmFyIGNhbkluc2VydEludG9CdWZmZXIgPSAhdG9QdWJsaXNoICYmIG1heEJ1ZmZlcmVkICYmXG4gICAgICAgIGNvbXBhcmF0b3IoZG9jLCBtYXhCdWZmZXJlZCkgPD0gMDtcblxuICAgICAgdmFyIHRvQnVmZmVyID0gY2FuQXBwZW5kVG9CdWZmZXIgfHwgY2FuSW5zZXJ0SW50b0J1ZmZlcjtcblxuICAgICAgaWYgKHRvUHVibGlzaCkge1xuICAgICAgICBzZWxmLl9hZGRQdWJsaXNoZWQoaWQsIGRvYyk7XG4gICAgICB9IGVsc2UgaWYgKHRvQnVmZmVyKSB7XG4gICAgICAgIHNlbGYuX2FkZEJ1ZmZlcmVkKGlkLCBkb2MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZHJvcHBpbmcgaXQgYW5kIG5vdCBzYXZpbmcgdG8gdGhlIGNhY2hlXG4gICAgICAgIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlciA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICAvLyBDYWxsZWQgd2hlbiBhIGRvY3VtZW50IGxlYXZlcyB0aGUgXCJNYXRjaGluZ1wiIHJlc3VsdHMgc2V0LlxuICAvLyBUYWtlcyByZXNwb25zaWJpbGl0eSBvZiBrZWVwaW5nIF91bnB1Ymxpc2hlZEJ1ZmZlciBpbiBzeW5jIHdpdGggX3B1Ymxpc2hlZFxuICAvLyBhbmQgdGhlIGVmZmVjdCBvZiBsaW1pdCBlbmZvcmNlZC5cbiAgX3JlbW92ZU1hdGNoaW5nOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKCEgc2VsZi5fcHVibGlzaGVkLmhhcyhpZCkgJiYgISBzZWxmLl9saW1pdClcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJ0cmllZCB0byByZW1vdmUgc29tZXRoaW5nIG1hdGNoaW5nIGJ1dCBub3QgY2FjaGVkIFwiICsgaWQpO1xuXG4gICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLmhhcyhpZCkpIHtcbiAgICAgICAgc2VsZi5fcmVtb3ZlUHVibGlzaGVkKGlkKTtcbiAgICAgIH0gZWxzZSBpZiAoc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuaGFzKGlkKSkge1xuICAgICAgICBzZWxmLl9yZW1vdmVCdWZmZXJlZChpZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIF9oYW5kbGVEb2M6IGZ1bmN0aW9uIChpZCwgbmV3RG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBtYXRjaGVzTm93ID0gbmV3RG9jICYmIHNlbGYuX21hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKG5ld0RvYykucmVzdWx0O1xuXG4gICAgICB2YXIgcHVibGlzaGVkQmVmb3JlID0gc2VsZi5fcHVibGlzaGVkLmhhcyhpZCk7XG4gICAgICB2YXIgYnVmZmVyZWRCZWZvcmUgPSBzZWxmLl9saW1pdCAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5oYXMoaWQpO1xuICAgICAgdmFyIGNhY2hlZEJlZm9yZSA9IHB1Ymxpc2hlZEJlZm9yZSB8fCBidWZmZXJlZEJlZm9yZTtcblxuICAgICAgaWYgKG1hdGNoZXNOb3cgJiYgIWNhY2hlZEJlZm9yZSkge1xuICAgICAgICBzZWxmLl9hZGRNYXRjaGluZyhuZXdEb2MpO1xuICAgICAgfSBlbHNlIGlmIChjYWNoZWRCZWZvcmUgJiYgIW1hdGNoZXNOb3cpIHtcbiAgICAgICAgc2VsZi5fcmVtb3ZlTWF0Y2hpbmcoaWQpO1xuICAgICAgfSBlbHNlIGlmIChjYWNoZWRCZWZvcmUgJiYgbWF0Y2hlc05vdykge1xuICAgICAgICB2YXIgb2xkRG9jID0gc2VsZi5fcHVibGlzaGVkLmdldChpZCk7XG4gICAgICAgIHZhciBjb21wYXJhdG9yID0gc2VsZi5fY29tcGFyYXRvcjtcbiAgICAgICAgdmFyIG1pbkJ1ZmZlcmVkID0gc2VsZi5fbGltaXQgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpICYmXG4gICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLm1pbkVsZW1lbnRJZCgpKTtcbiAgICAgICAgdmFyIG1heEJ1ZmZlcmVkO1xuXG4gICAgICAgIGlmIChwdWJsaXNoZWRCZWZvcmUpIHtcbiAgICAgICAgICAvLyBVbmxpbWl0ZWQgY2FzZSB3aGVyZSB0aGUgZG9jdW1lbnQgc3RheXMgaW4gcHVibGlzaGVkIG9uY2UgaXRcbiAgICAgICAgICAvLyBtYXRjaGVzIG9yIHRoZSBjYXNlIHdoZW4gd2UgZG9uJ3QgaGF2ZSBlbm91Z2ggbWF0Y2hpbmcgZG9jcyB0b1xuICAgICAgICAgIC8vIHB1Ymxpc2ggb3IgdGhlIGNoYW5nZWQgYnV0IG1hdGNoaW5nIGRvYyB3aWxsIHN0YXkgaW4gcHVibGlzaGVkXG4gICAgICAgICAgLy8gYW55d2F5cy5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIFhYWDogV2UgcmVseSBvbiB0aGUgZW1wdGluZXNzIG9mIGJ1ZmZlci4gQmUgc3VyZSB0byBtYWludGFpbiB0aGVcbiAgICAgICAgICAvLyBmYWN0IHRoYXQgYnVmZmVyIGNhbid0IGJlIGVtcHR5IGlmIHRoZXJlIGFyZSBtYXRjaGluZyBkb2N1bWVudHMgbm90XG4gICAgICAgICAgLy8gcHVibGlzaGVkLiBOb3RhYmx5LCB3ZSBkb24ndCB3YW50IHRvIHNjaGVkdWxlIHJlcG9sbCBhbmQgY29udGludWVcbiAgICAgICAgICAvLyByZWx5aW5nIG9uIHRoaXMgcHJvcGVydHkuXG4gICAgICAgICAgdmFyIHN0YXlzSW5QdWJsaXNoZWQgPSAhIHNlbGYuX2xpbWl0IHx8XG4gICAgICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zaXplKCkgPT09IDAgfHxcbiAgICAgICAgICAgIGNvbXBhcmF0b3IobmV3RG9jLCBtaW5CdWZmZXJlZCkgPD0gMDtcblxuICAgICAgICAgIGlmIChzdGF5c0luUHVibGlzaGVkKSB7XG4gICAgICAgICAgICBzZWxmLl9jaGFuZ2VQdWJsaXNoZWQoaWQsIG9sZERvYywgbmV3RG9jKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gYWZ0ZXIgdGhlIGNoYW5nZSBkb2MgZG9lc24ndCBzdGF5IGluIHRoZSBwdWJsaXNoZWQsIHJlbW92ZSBpdFxuICAgICAgICAgICAgc2VsZi5fcmVtb3ZlUHVibGlzaGVkKGlkKTtcbiAgICAgICAgICAgIC8vIGJ1dCBpdCBjYW4gbW92ZSBpbnRvIGJ1ZmZlcmVkIG5vdywgY2hlY2sgaXRcbiAgICAgICAgICAgIG1heEJ1ZmZlcmVkID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KFxuICAgICAgICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5tYXhFbGVtZW50SWQoKSk7XG5cbiAgICAgICAgICAgIHZhciB0b0J1ZmZlciA9IHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlciB8fFxuICAgICAgICAgICAgICAgICAgKG1heEJ1ZmZlcmVkICYmIGNvbXBhcmF0b3IobmV3RG9jLCBtYXhCdWZmZXJlZCkgPD0gMCk7XG5cbiAgICAgICAgICAgIGlmICh0b0J1ZmZlcikge1xuICAgICAgICAgICAgICBzZWxmLl9hZGRCdWZmZXJlZChpZCwgbmV3RG9jKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIFRocm93IGF3YXkgZnJvbSBib3RoIHB1Ymxpc2hlZCBzZXQgYW5kIGJ1ZmZlclxuICAgICAgICAgICAgICBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoYnVmZmVyZWRCZWZvcmUpIHtcbiAgICAgICAgICBvbGREb2MgPSBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQoaWQpO1xuICAgICAgICAgIC8vIHJlbW92ZSB0aGUgb2xkIHZlcnNpb24gbWFudWFsbHkgaW5zdGVhZCBvZiB1c2luZyBfcmVtb3ZlQnVmZmVyZWQgc29cbiAgICAgICAgICAvLyB3ZSBkb24ndCB0cmlnZ2VyIHRoZSBxdWVyeWluZyBpbW1lZGlhdGVseS4gIGlmIHdlIGVuZCB0aGlzIGJsb2NrXG4gICAgICAgICAgLy8gd2l0aCB0aGUgYnVmZmVyIGVtcHR5LCB3ZSB3aWxsIG5lZWQgdG8gdHJpZ2dlciB0aGUgcXVlcnkgcG9sbFxuICAgICAgICAgIC8vIG1hbnVhbGx5IHRvby5cbiAgICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5yZW1vdmUoaWQpO1xuXG4gICAgICAgICAgdmFyIG1heFB1Ymxpc2hlZCA9IHNlbGYuX3B1Ymxpc2hlZC5nZXQoXG4gICAgICAgICAgICBzZWxmLl9wdWJsaXNoZWQubWF4RWxlbWVudElkKCkpO1xuICAgICAgICAgIG1heEJ1ZmZlcmVkID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpICYmXG4gICAgICAgICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KFxuICAgICAgICAgICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWF4RWxlbWVudElkKCkpO1xuXG4gICAgICAgICAgLy8gdGhlIGJ1ZmZlcmVkIGRvYyB3YXMgdXBkYXRlZCwgaXQgY291bGQgbW92ZSB0byBwdWJsaXNoZWRcbiAgICAgICAgICB2YXIgdG9QdWJsaXNoID0gY29tcGFyYXRvcihuZXdEb2MsIG1heFB1Ymxpc2hlZCkgPCAwO1xuXG4gICAgICAgICAgLy8gb3Igc3RheXMgaW4gYnVmZmVyIGV2ZW4gYWZ0ZXIgdGhlIGNoYW5nZVxuICAgICAgICAgIHZhciBzdGF5c0luQnVmZmVyID0gKCEgdG9QdWJsaXNoICYmIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlcikgfHxcbiAgICAgICAgICAgICAgICAoIXRvUHVibGlzaCAmJiBtYXhCdWZmZXJlZCAmJlxuICAgICAgICAgICAgICAgICBjb21wYXJhdG9yKG5ld0RvYywgbWF4QnVmZmVyZWQpIDw9IDApO1xuXG4gICAgICAgICAgaWYgKHRvUHVibGlzaCkge1xuICAgICAgICAgICAgc2VsZi5fYWRkUHVibGlzaGVkKGlkLCBuZXdEb2MpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoc3RheXNJbkJ1ZmZlcikge1xuICAgICAgICAgICAgLy8gc3RheXMgaW4gYnVmZmVyIGJ1dCBjaGFuZ2VzXG4gICAgICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zZXQoaWQsIG5ld0RvYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRocm93IGF3YXkgZnJvbSBib3RoIHB1Ymxpc2hlZCBzZXQgYW5kIGJ1ZmZlclxuICAgICAgICAgICAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gZmFsc2U7XG4gICAgICAgICAgICAvLyBOb3JtYWxseSB0aGlzIGNoZWNrIHdvdWxkIGhhdmUgYmVlbiBkb25lIGluIF9yZW1vdmVCdWZmZXJlZCBidXRcbiAgICAgICAgICAgIC8vIHdlIGRpZG4ndCB1c2UgaXQsIHNvIHdlIG5lZWQgdG8gZG8gaXQgb3Vyc2VsZiBub3cuXG4gICAgICAgICAgICBpZiAoISBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zaXplKCkpIHtcbiAgICAgICAgICAgICAgc2VsZi5fbmVlZFRvUG9sbFF1ZXJ5KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhY2hlZEJlZm9yZSBpbXBsaWVzIGVpdGhlciBvZiBwdWJsaXNoZWRCZWZvcmUgb3IgYnVmZmVyZWRCZWZvcmUgaXMgdHJ1ZS5cIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgX2ZldGNoTW9kaWZpZWREb2N1bWVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5fcmVnaXN0ZXJQaGFzZUNoYW5nZShQSEFTRS5GRVRDSElORyk7XG4gICAgLy8gRGVmZXIsIGJlY2F1c2Ugbm90aGluZyBjYWxsZWQgZnJvbSB0aGUgb3Bsb2cgZW50cnkgaGFuZGxlciBtYXkgeWllbGQsXG4gICAgLy8gYnV0IGZldGNoKCkgeWllbGRzLlxuICAgIE1ldGVvci5kZWZlcihmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeShhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICB3aGlsZSAoIXNlbGYuX3N0b3BwZWQgJiYgIXNlbGYuX25lZWRUb0ZldGNoLmVtcHR5KCkpIHtcbiAgICAgICAgaWYgKHNlbGYuX3BoYXNlID09PSBQSEFTRS5RVUVSWUlORykge1xuICAgICAgICAgIC8vIFdoaWxlIGZldGNoaW5nLCB3ZSBkZWNpZGVkIHRvIGdvIGludG8gUVVFUllJTkcgbW9kZSwgYW5kIHRoZW4gd2VcbiAgICAgICAgICAvLyBzYXcgYW5vdGhlciBvcGxvZyBlbnRyeSwgc28gX25lZWRUb0ZldGNoIGlzIG5vdCBlbXB0eS4gQnV0IHdlXG4gICAgICAgICAgLy8gc2hvdWxkbid0IGZldGNoIHRoZXNlIGRvY3VtZW50cyB1bnRpbCBBRlRFUiB0aGUgcXVlcnkgaXMgZG9uZS5cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJlaW5nIGluIHN0ZWFkeSBwaGFzZSBoZXJlIHdvdWxkIGJlIHN1cnByaXNpbmcuXG4gICAgICAgIGlmIChzZWxmLl9waGFzZSAhPT0gUEhBU0UuRkVUQ0hJTkcpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwicGhhc2UgaW4gZmV0Y2hNb2RpZmllZERvY3VtZW50czogXCIgKyBzZWxmLl9waGFzZSk7XG5cbiAgICAgICAgc2VsZi5fY3VycmVudGx5RmV0Y2hpbmcgPSBzZWxmLl9uZWVkVG9GZXRjaDtcbiAgICAgICAgdmFyIHRoaXNHZW5lcmF0aW9uID0gKytzZWxmLl9mZXRjaEdlbmVyYXRpb247XG4gICAgICAgIHNlbGYuX25lZWRUb0ZldGNoID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgICAgIHZhciB3YWl0aW5nID0gMDtcblxuICAgICAgICBsZXQgcHJvbWlzZVJlc29sdmVyID0gbnVsbDtcbiAgICAgICAgY29uc3QgYXdhaXRhYmxlUHJvbWlzZSA9IG5ldyBQcm9taXNlKHIgPT4gcHJvbWlzZVJlc29sdmVyID0gcik7XG4gICAgICAgIC8vIFRoaXMgbG9vcCBpcyBzYWZlLCBiZWNhdXNlIF9jdXJyZW50bHlGZXRjaGluZyB3aWxsIG5vdCBiZSB1cGRhdGVkXG4gICAgICAgIC8vIGR1cmluZyB0aGlzIGxvb3AgKGluIGZhY3QsIGl0IGlzIG5ldmVyIG11dGF0ZWQpLlxuICAgICAgICBhd2FpdCBzZWxmLl9jdXJyZW50bHlGZXRjaGluZy5mb3JFYWNoQXN5bmMoYXN5bmMgZnVuY3Rpb24gKG9wLCBpZCkge1xuICAgICAgICAgIHdhaXRpbmcrKztcbiAgICAgICAgICBhd2FpdCBzZWxmLl9tb25nb0hhbmRsZS5fZG9jRmV0Y2hlci5mZXRjaChcbiAgICAgICAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KGZ1bmN0aW9uKGVyciwgZG9jKSB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBNZXRlb3IuX2RlYnVnKCdHb3QgZXhjZXB0aW9uIHdoaWxlIGZldGNoaW5nIGRvY3VtZW50cycsIGVycik7XG4gICAgICAgICAgICAgICAgLy8gSWYgd2UgZ2V0IGFuIGVycm9yIGZyb20gdGhlIGZldGNoZXIgKGVnLCB0cm91YmxlXG4gICAgICAgICAgICAgICAgLy8gY29ubmVjdGluZyB0byBNb25nbyksIGxldCdzIGp1c3QgYWJhbmRvbiB0aGUgZmV0Y2ggcGhhc2VcbiAgICAgICAgICAgICAgICAvLyBhbHRvZ2V0aGVyIGFuZCBmYWxsIGJhY2sgdG8gcG9sbGluZy4gSXQncyBub3QgbGlrZSB3ZSdyZVxuICAgICAgICAgICAgICAgIC8vIGdldHRpbmcgbGl2ZSB1cGRhdGVzIGFueXdheS5cbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgIT09IFBIQVNFLlFVRVJZSU5HKSB7XG4gICAgICAgICAgICAgICAgICBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgd2FpdGluZy0tO1xuICAgICAgICAgICAgICAgIC8vIEJlY2F1c2UgZmV0Y2goKSBuZXZlciBjYWxscyBpdHMgY2FsbGJhY2sgc3luY2hyb25vdXNseSxcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGlzIHNhZmUgKGllLCB3ZSB3b24ndCBjYWxsIGZ1dC5yZXR1cm4oKSBiZWZvcmUgdGhlXG4gICAgICAgICAgICAgICAgLy8gZm9yRWFjaCBpcyBkb25lKS5cbiAgICAgICAgICAgICAgICBpZiAod2FpdGluZyA9PT0gMCkgcHJvbWlzZVJlc29sdmVyKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAhc2VsZi5fc3RvcHBlZCAmJlxuICAgICAgICAgICAgICAgICAgc2VsZi5fcGhhc2UgPT09IFBIQVNFLkZFVENISU5HICYmXG4gICAgICAgICAgICAgICAgICBzZWxmLl9mZXRjaEdlbmVyYXRpb24gPT09IHRoaXNHZW5lcmF0aW9uXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAvLyBXZSByZS1jaGVjayB0aGUgZ2VuZXJhdGlvbiBpbiBjYXNlIHdlJ3ZlIGhhZCBhbiBleHBsaWNpdFxuICAgICAgICAgICAgICAgICAgLy8gX3BvbGxRdWVyeSBjYWxsIChlZywgaW4gYW5vdGhlciBmaWJlcikgd2hpY2ggc2hvdWxkXG4gICAgICAgICAgICAgICAgICAvLyBlZmZlY3RpdmVseSBjYW5jZWwgdGhpcyByb3VuZCBvZiBmZXRjaGVzLiAgKF9wb2xsUXVlcnlcbiAgICAgICAgICAgICAgICAgIC8vIGluY3JlbWVudHMgdGhlIGdlbmVyYXRpb24uKVxuXG4gICAgICAgICAgICAgICAgICBzZWxmLl9oYW5kbGVEb2MoaWQsIGRvYyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgICAgIHdhaXRpbmctLTtcbiAgICAgICAgICAgICAgICAvLyBCZWNhdXNlIGZldGNoKCkgbmV2ZXIgY2FsbHMgaXRzIGNhbGxiYWNrIHN5bmNocm9ub3VzbHksXG4gICAgICAgICAgICAgICAgLy8gdGhpcyBpcyBzYWZlIChpZSwgd2Ugd29uJ3QgY2FsbCBmdXQucmV0dXJuKCkgYmVmb3JlIHRoZVxuICAgICAgICAgICAgICAgIC8vIGZvckVhY2ggaXMgZG9uZSkuXG4gICAgICAgICAgICAgICAgaWYgKHdhaXRpbmcgPT09IDApIHByb21pc2VSZXNvbHZlcigpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBhd2FpdGFibGVQcm9taXNlO1xuICAgICAgICAvLyBFeGl0IG5vdyBpZiB3ZSd2ZSBoYWQgYSBfcG9sbFF1ZXJ5IGNhbGwgKGhlcmUgb3IgaW4gYW5vdGhlciBmaWJlcikuXG4gICAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuUVVFUllJTkcpXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICBzZWxmLl9jdXJyZW50bHlGZXRjaGluZyA9IG51bGw7XG4gICAgICB9XG4gICAgICAvLyBXZSdyZSBkb25lIGZldGNoaW5nLCBzbyB3ZSBjYW4gYmUgc3RlYWR5LCB1bmxlc3Mgd2UndmUgaGFkIGFcbiAgICAgIC8vIF9wb2xsUXVlcnkgY2FsbCAoaGVyZSBvciBpbiBhbm90aGVyIGZpYmVyKS5cbiAgICAgIGlmIChzZWxmLl9waGFzZSAhPT0gUEhBU0UuUVVFUllJTkcpXG4gICAgICAgIGF3YWl0IHNlbGYuX2JlU3RlYWR5KCk7XG4gICAgfSkpO1xuICB9LFxuICBfYmVTdGVhZHk6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5fcmVnaXN0ZXJQaGFzZUNoYW5nZShQSEFTRS5TVEVBRFkpO1xuICAgIHZhciB3cml0ZXMgPSBzZWxmLl93cml0ZXNUb0NvbW1pdFdoZW5XZVJlYWNoU3RlYWR5IHx8IFtdO1xuICAgIHNlbGYuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkgPSBbXTtcbiAgICBhd2FpdCBzZWxmLl9tdWx0aXBsZXhlci5vbkZsdXNoKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGZvciAoY29uc3QgdyBvZiB3cml0ZXMpIHtcbiAgICAgICAgICBhd2FpdCB3LmNvbW1pdHRlZCgpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJfYmVTdGVhZHkgZXJyb3JcIiwge3dyaXRlc30sIGUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBfaGFuZGxlT3Bsb2dFbnRyeVF1ZXJ5aW5nOiBmdW5jdGlvbiAob3ApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fbmVlZFRvRmV0Y2guc2V0KGlkRm9yT3Aob3ApLCBvcCk7XG4gICAgfSk7XG4gIH0sXG4gIF9oYW5kbGVPcGxvZ0VudHJ5U3RlYWR5T3JGZXRjaGluZzogZnVuY3Rpb24gKG9wKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBpZCA9IGlkRm9yT3Aob3ApO1xuICAgICAgLy8gSWYgd2UncmUgYWxyZWFkeSBmZXRjaGluZyB0aGlzIG9uZSwgb3IgYWJvdXQgdG8sIHdlIGNhbid0IG9wdGltaXplO1xuICAgICAgLy8gbWFrZSBzdXJlIHRoYXQgd2UgZmV0Y2ggaXQgYWdhaW4gaWYgbmVjZXNzYXJ5LlxuXG4gICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLkZFVENISU5HICYmXG4gICAgICAgICAgKChzZWxmLl9jdXJyZW50bHlGZXRjaGluZyAmJiBzZWxmLl9jdXJyZW50bHlGZXRjaGluZy5oYXMoaWQpKSB8fFxuICAgICAgICAgICBzZWxmLl9uZWVkVG9GZXRjaC5oYXMoaWQpKSkge1xuICAgICAgICBzZWxmLl9uZWVkVG9GZXRjaC5zZXQoaWQsIG9wKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAob3Aub3AgPT09ICdkJykge1xuICAgICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLmhhcyhpZCkgfHxcbiAgICAgICAgICAgIChzZWxmLl9saW1pdCAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5oYXMoaWQpKSlcbiAgICAgICAgICBzZWxmLl9yZW1vdmVNYXRjaGluZyhpZCk7XG4gICAgICB9IGVsc2UgaWYgKG9wLm9wID09PSAnaScpIHtcbiAgICAgICAgaWYgKHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImluc2VydCBmb3VuZCBmb3IgYWxyZWFkeS1leGlzdGluZyBJRCBpbiBwdWJsaXNoZWRcIik7XG4gICAgICAgIGlmIChzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlciAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5oYXMoaWQpKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImluc2VydCBmb3VuZCBmb3IgYWxyZWFkeS1leGlzdGluZyBJRCBpbiBidWZmZXJcIik7XG5cbiAgICAgICAgLy8gWFhYIHdoYXQgaWYgc2VsZWN0b3IgeWllbGRzPyAgZm9yIG5vdyBpdCBjYW4ndCBidXQgbGF0ZXIgaXQgY291bGRcbiAgICAgICAgLy8gaGF2ZSAkd2hlcmVcbiAgICAgICAgaWYgKHNlbGYuX21hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKG9wLm8pLnJlc3VsdClcbiAgICAgICAgICBzZWxmLl9hZGRNYXRjaGluZyhvcC5vKTtcbiAgICAgIH0gZWxzZSBpZiAob3Aub3AgPT09ICd1Jykge1xuICAgICAgICAvLyB3ZSBhcmUgbWFwcGluZyB0aGUgbmV3IG9wbG9nIGZvcm1hdCBvbiBtb25nbyA1XG4gICAgICAgIC8vIHRvIHdoYXQgd2Uga25vdyBiZXR0ZXIsICRzZXRcbiAgICAgICAgb3AubyA9IG9wbG9nVjJWMUNvbnZlcnRlcihvcC5vKVxuICAgICAgICAvLyBJcyB0aGlzIGEgbW9kaWZpZXIgKCRzZXQvJHVuc2V0LCB3aGljaCBtYXkgcmVxdWlyZSB1cyB0byBwb2xsIHRoZVxuICAgICAgICAvLyBkYXRhYmFzZSB0byBmaWd1cmUgb3V0IGlmIHRoZSB3aG9sZSBkb2N1bWVudCBtYXRjaGVzIHRoZSBzZWxlY3Rvcikgb3JcbiAgICAgICAgLy8gYSByZXBsYWNlbWVudCAoaW4gd2hpY2ggY2FzZSB3ZSBjYW4ganVzdCBkaXJlY3RseSByZS1ldmFsdWF0ZSB0aGVcbiAgICAgICAgLy8gc2VsZWN0b3IpP1xuICAgICAgICAvLyBvcGxvZyBmb3JtYXQgaGFzIGNoYW5nZWQgb24gbW9uZ29kYiA1LCB3ZSBoYXZlIHRvIHN1cHBvcnQgYm90aCBub3dcbiAgICAgICAgLy8gZGlmZiBpcyB0aGUgZm9ybWF0IGluIE1vbmdvIDUrIChvcGxvZyB2MilcbiAgICAgICAgdmFyIGlzUmVwbGFjZSA9ICFfLmhhcyhvcC5vLCAnJHNldCcpICYmICFfLmhhcyhvcC5vLCAnZGlmZicpICYmICFfLmhhcyhvcC5vLCAnJHVuc2V0Jyk7XG4gICAgICAgIC8vIElmIHRoaXMgbW9kaWZpZXIgbW9kaWZpZXMgc29tZXRoaW5nIGluc2lkZSBhbiBFSlNPTiBjdXN0b20gdHlwZSAoaWUsXG4gICAgICAgIC8vIGFueXRoaW5nIHdpdGggRUpTT04kKSwgdGhlbiB3ZSBjYW4ndCB0cnkgdG8gdXNlXG4gICAgICAgIC8vIExvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5LCBzaW5jZSB0aGF0IGp1c3QgbXV0YXRlcyB0aGUgRUpTT04gZW5jb2RpbmcsXG4gICAgICAgIC8vIG5vdCB0aGUgYWN0dWFsIG9iamVjdC5cbiAgICAgICAgdmFyIGNhbkRpcmVjdGx5TW9kaWZ5RG9jID1cbiAgICAgICAgICAhaXNSZXBsYWNlICYmIG1vZGlmaWVyQ2FuQmVEaXJlY3RseUFwcGxpZWQob3Aubyk7XG5cbiAgICAgICAgdmFyIHB1Ymxpc2hlZEJlZm9yZSA9IHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpO1xuICAgICAgICB2YXIgYnVmZmVyZWRCZWZvcmUgPSBzZWxmLl9saW1pdCAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5oYXMoaWQpO1xuXG4gICAgICAgIGlmIChpc1JlcGxhY2UpIHtcbiAgICAgICAgICBzZWxmLl9oYW5kbGVEb2MoaWQsIF8uZXh0ZW5kKHtfaWQ6IGlkfSwgb3AubykpO1xuICAgICAgICB9IGVsc2UgaWYgKChwdWJsaXNoZWRCZWZvcmUgfHwgYnVmZmVyZWRCZWZvcmUpICYmXG4gICAgICAgICAgICAgICAgICAgY2FuRGlyZWN0bHlNb2RpZnlEb2MpIHtcbiAgICAgICAgICAvLyBPaCBncmVhdCwgd2UgYWN0dWFsbHkga25vdyB3aGF0IHRoZSBkb2N1bWVudCBpcywgc28gd2UgY2FuIGFwcGx5XG4gICAgICAgICAgLy8gdGhpcyBkaXJlY3RseS5cbiAgICAgICAgICB2YXIgbmV3RG9jID0gc2VsZi5fcHVibGlzaGVkLmhhcyhpZClcbiAgICAgICAgICAgID8gc2VsZi5fcHVibGlzaGVkLmdldChpZCkgOiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQoaWQpO1xuICAgICAgICAgIG5ld0RvYyA9IEVKU09OLmNsb25lKG5ld0RvYyk7XG5cbiAgICAgICAgICBuZXdEb2MuX2lkID0gaWQ7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIExvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5KG5ld0RvYywgb3Aubyk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgaWYgKGUubmFtZSAhPT0gXCJNaW5pbW9uZ29FcnJvclwiKVxuICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgLy8gV2UgZGlkbid0IHVuZGVyc3RhbmQgdGhlIG1vZGlmaWVyLiAgUmUtZmV0Y2guXG4gICAgICAgICAgICBzZWxmLl9uZWVkVG9GZXRjaC5zZXQoaWQsIG9wKTtcbiAgICAgICAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuU1RFQURZKSB7XG4gICAgICAgICAgICAgIHNlbGYuX2ZldGNoTW9kaWZpZWREb2N1bWVudHMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2VsZi5faGFuZGxlRG9jKGlkLCBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4obmV3RG9jKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIWNhbkRpcmVjdGx5TW9kaWZ5RG9jIHx8XG4gICAgICAgICAgICAgICAgICAgc2VsZi5fbWF0Y2hlci5jYW5CZWNvbWVUcnVlQnlNb2RpZmllcihvcC5vKSB8fFxuICAgICAgICAgICAgICAgICAgIChzZWxmLl9zb3J0ZXIgJiYgc2VsZi5fc29ydGVyLmFmZmVjdGVkQnlNb2RpZmllcihvcC5vKSkpIHtcbiAgICAgICAgICBzZWxmLl9uZWVkVG9GZXRjaC5zZXQoaWQsIG9wKTtcbiAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlNURUFEWSlcbiAgICAgICAgICAgIHNlbGYuX2ZldGNoTW9kaWZpZWREb2N1bWVudHMoKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJYWFggU1VSUFJJU0lORyBPUEVSQVRJT046IFwiICsgb3ApO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIGFzeW5jIF9ydW5Jbml0aWFsUXVlcnlBc3luYygpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJvcGxvZyBzdG9wcGVkIHN1cnByaXNpbmdseSBlYXJseVwiKTtcblxuICAgIGF3YWl0IHNlbGYuX3J1blF1ZXJ5KHtpbml0aWFsOiB0cnVlfSk7ICAvLyB5aWVsZHNcblxuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuOyAgLy8gY2FuIGhhcHBlbiBvbiBxdWVyeUVycm9yXG5cbiAgICAvLyBBbGxvdyBvYnNlcnZlQ2hhbmdlcyBjYWxscyB0byByZXR1cm4uIChBZnRlciB0aGlzLCBpdCdzIHBvc3NpYmxlIGZvclxuICAgIC8vIHN0b3AoKSB0byBiZSBjYWxsZWQuKVxuICAgIGF3YWl0IHNlbGYuX211bHRpcGxleGVyLnJlYWR5KCk7XG5cbiAgICBhd2FpdCBzZWxmLl9kb25lUXVlcnlpbmcoKTsgIC8vIHlpZWxkc1xuICB9LFxuXG4gIC8vIFlpZWxkcyFcbiAgX3J1bkluaXRpYWxRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9ydW5Jbml0aWFsUXVlcnlBc3luYygpO1xuICB9LFxuXG4gIC8vIEluIHZhcmlvdXMgY2lyY3Vtc3RhbmNlcywgd2UgbWF5IGp1c3Qgd2FudCB0byBzdG9wIHByb2Nlc3NpbmcgdGhlIG9wbG9nIGFuZFxuICAvLyByZS1ydW4gdGhlIGluaXRpYWwgcXVlcnksIGp1c3QgYXMgaWYgd2Ugd2VyZSBhIFBvbGxpbmdPYnNlcnZlRHJpdmVyLlxuICAvL1xuICAvLyBUaGlzIGZ1bmN0aW9uIG1heSBub3QgYmxvY2ssIGJlY2F1c2UgaXQgaXMgY2FsbGVkIGZyb20gYW4gb3Bsb2cgZW50cnlcbiAgLy8gaGFuZGxlci5cbiAgLy9cbiAgLy8gWFhYIFdlIHNob3VsZCBjYWxsIHRoaXMgd2hlbiB3ZSBkZXRlY3QgdGhhdCB3ZSd2ZSBiZWVuIGluIEZFVENISU5HIGZvciBcInRvb1xuICAvLyBsb25nXCIuXG4gIC8vXG4gIC8vIFhYWCBXZSBzaG91bGQgY2FsbCB0aGlzIHdoZW4gd2UgZGV0ZWN0IE1vbmdvIGZhaWxvdmVyIChzaW5jZSB0aGF0IG1pZ2h0XG4gIC8vIG1lYW4gdGhhdCBzb21lIG9mIHRoZSBvcGxvZyBlbnRyaWVzIHdlIGhhdmUgcHJvY2Vzc2VkIGhhdmUgYmVlbiByb2xsZWRcbiAgLy8gYmFjaykuIFRoZSBOb2RlIE1vbmdvIGRyaXZlciBpcyBpbiB0aGUgbWlkZGxlIG9mIGEgYnVuY2ggb2YgaHVnZVxuICAvLyByZWZhY3RvcmluZ3MsIGluY2x1ZGluZyB0aGUgd2F5IHRoYXQgaXQgbm90aWZpZXMgeW91IHdoZW4gcHJpbWFyeVxuICAvLyBjaGFuZ2VzLiBXaWxsIHB1dCBvZmYgaW1wbGVtZW50aW5nIHRoaXMgdW50aWwgZHJpdmVyIDEuNCBpcyBvdXQuXG4gIF9wb2xsUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gWWF5LCB3ZSBnZXQgdG8gZm9yZ2V0IGFib3V0IGFsbCB0aGUgdGhpbmdzIHdlIHRob3VnaHQgd2UgaGFkIHRvIGZldGNoLlxuICAgICAgc2VsZi5fbmVlZFRvRmV0Y2ggPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nID0gbnVsbDtcbiAgICAgICsrc2VsZi5fZmV0Y2hHZW5lcmF0aW9uOyAgLy8gaWdub3JlIGFueSBpbi1mbGlnaHQgZmV0Y2hlc1xuICAgICAgc2VsZi5fcmVnaXN0ZXJQaGFzZUNoYW5nZShQSEFTRS5RVUVSWUlORyk7XG5cbiAgICAgIC8vIERlZmVyIHNvIHRoYXQgd2UgZG9uJ3QgeWllbGQuICBXZSBkb24ndCBuZWVkIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5XG4gICAgICAvLyBoZXJlIGJlY2F1c2UgU3dpdGNoZWRUb1F1ZXJ5IGlzIG5vdCB0aHJvd24gaW4gUVVFUllJTkcgbW9kZS5cbiAgICAgIE1ldGVvci5kZWZlcihhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGF3YWl0IHNlbGYuX3J1blF1ZXJ5KCk7XG4gICAgICAgIGF3YWl0IHNlbGYuX2RvbmVRdWVyeWluZygpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gWWllbGRzIVxuICBhc3luYyBfcnVuUXVlcnlBc3luYyhvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBuZXdSZXN1bHRzLCBuZXdCdWZmZXI7XG5cbiAgICAvLyBUaGlzIHdoaWxlIGxvb3AgaXMganVzdCB0byByZXRyeSBmYWlsdXJlcy5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgLy8gSWYgd2UndmUgYmVlbiBzdG9wcGVkLCB3ZSBkb24ndCBoYXZlIHRvIHJ1biBhbnl0aGluZyBhbnkgbW9yZS5cbiAgICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIG5ld1Jlc3VsdHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgIG5ld0J1ZmZlciA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuXG4gICAgICAvLyBRdWVyeSAyeCBkb2N1bWVudHMgYXMgdGhlIGhhbGYgZXhjbHVkZWQgZnJvbSB0aGUgb3JpZ2luYWwgcXVlcnkgd2lsbCBnb1xuICAgICAgLy8gaW50byB1bnB1Ymxpc2hlZCBidWZmZXIgdG8gcmVkdWNlIGFkZGl0aW9uYWwgTW9uZ28gbG9va3VwcyBpbiBjYXNlc1xuICAgICAgLy8gd2hlbiBkb2N1bWVudHMgYXJlIHJlbW92ZWQgZnJvbSB0aGUgcHVibGlzaGVkIHNldCBhbmQgbmVlZCBhXG4gICAgICAvLyByZXBsYWNlbWVudC5cbiAgICAgIC8vIFhYWCBuZWVkcyBtb3JlIHRob3VnaHQgb24gbm9uLXplcm8gc2tpcFxuICAgICAgLy8gWFhYIDIgaXMgYSBcIm1hZ2ljIG51bWJlclwiIG1lYW5pbmcgdGhlcmUgaXMgYW4gZXh0cmEgY2h1bmsgb2YgZG9jcyBmb3JcbiAgICAgIC8vIGJ1ZmZlciBpZiBzdWNoIGlzIG5lZWRlZC5cbiAgICAgIHZhciBjdXJzb3IgPSBzZWxmLl9jdXJzb3JGb3JRdWVyeSh7IGxpbWl0OiBzZWxmLl9saW1pdCAqIDIgfSk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBjdXJzb3IuZm9yRWFjaChmdW5jdGlvbiAoZG9jLCBpKSB7ICAvLyB5aWVsZHNcbiAgICAgICAgICBpZiAoIXNlbGYuX2xpbWl0IHx8IGkgPCBzZWxmLl9saW1pdCkge1xuICAgICAgICAgICAgbmV3UmVzdWx0cy5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV3QnVmZmVyLnNldChkb2MuX2lkLCBkb2MpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAob3B0aW9ucy5pbml0aWFsICYmIHR5cGVvZihlLmNvZGUpID09PSAnbnVtYmVyJykge1xuICAgICAgICAgIC8vIFRoaXMgaXMgYW4gZXJyb3IgZG9jdW1lbnQgc2VudCB0byB1cyBieSBtb25nb2QsIG5vdCBhIGNvbm5lY3Rpb25cbiAgICAgICAgICAvLyBlcnJvciBnZW5lcmF0ZWQgYnkgdGhlIGNsaWVudC4gQW5kIHdlJ3ZlIG5ldmVyIHNlZW4gdGhpcyBxdWVyeSB3b3JrXG4gICAgICAgICAgLy8gc3VjY2Vzc2Z1bGx5LiBQcm9iYWJseSBpdCdzIGEgYmFkIHNlbGVjdG9yIG9yIHNvbWV0aGluZywgc28gd2VcbiAgICAgICAgICAvLyBzaG91bGQgTk9UIHJldHJ5LiBJbnN0ZWFkLCB3ZSBzaG91bGQgaGFsdCB0aGUgb2JzZXJ2ZSAod2hpY2ggZW5kc1xuICAgICAgICAgIC8vIHVwIGNhbGxpbmcgYHN0b3BgIG9uIHVzKS5cbiAgICAgICAgICBhd2FpdCBzZWxmLl9tdWx0aXBsZXhlci5xdWVyeUVycm9yKGUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIER1cmluZyBmYWlsb3ZlciAoZWcpIGlmIHdlIGdldCBhbiBleGNlcHRpb24gd2Ugc2hvdWxkIGxvZyBhbmQgcmV0cnlcbiAgICAgICAgLy8gaW5zdGVhZCBvZiBjcmFzaGluZy5cbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIkdvdCBleGNlcHRpb24gd2hpbGUgcG9sbGluZyBxdWVyeVwiLCBlKTtcbiAgICAgICAgYXdhaXQgTWV0ZW9yLl9zbGVlcEZvck1zKDEwMCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG5cbiAgICBzZWxmLl9wdWJsaXNoTmV3UmVzdWx0cyhuZXdSZXN1bHRzLCBuZXdCdWZmZXIpO1xuICB9LFxuXG4gIC8vIFlpZWxkcyFcbiAgX3J1blF1ZXJ5OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLl9ydW5RdWVyeUFzeW5jKG9wdGlvbnMpO1xuICB9LFxuXG4gIC8vIFRyYW5zaXRpb25zIHRvIFFVRVJZSU5HIGFuZCBydW5zIGFub3RoZXIgcXVlcnksIG9yIChpZiBhbHJlYWR5IGluIFFVRVJZSU5HKVxuICAvLyBlbnN1cmVzIHRoYXQgd2Ugd2lsbCBxdWVyeSBhZ2FpbiBsYXRlci5cbiAgLy9cbiAgLy8gVGhpcyBmdW5jdGlvbiBtYXkgbm90IGJsb2NrLCBiZWNhdXNlIGl0IGlzIGNhbGxlZCBmcm9tIGFuIG9wbG9nIGVudHJ5XG4gIC8vIGhhbmRsZXIuIEhvd2V2ZXIsIGlmIHdlIHdlcmUgbm90IGFscmVhZHkgaW4gdGhlIFFVRVJZSU5HIHBoYXNlLCBpdCB0aHJvd3NcbiAgLy8gYW4gZXhjZXB0aW9uIHRoYXQgaXMgY2F1Z2h0IGJ5IHRoZSBjbG9zZXN0IHN1cnJvdW5kaW5nXG4gIC8vIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5IGNhbGw7IHRoaXMgZW5zdXJlcyB0aGF0IHdlIGRvbid0IGNvbnRpbnVlIHJ1bm5pbmdcbiAgLy8gY2xvc2UgdGhhdCB3YXMgZGVzaWduZWQgZm9yIGFub3RoZXIgcGhhc2UgaW5zaWRlIFBIQVNFLlFVRVJZSU5HLlxuICAvL1xuICAvLyAoSXQncyBhbHNvIG5lY2Vzc2FyeSB3aGVuZXZlciBsb2dpYyBpbiB0aGlzIGZpbGUgeWllbGRzIHRvIGNoZWNrIHRoYXQgb3RoZXJcbiAgLy8gcGhhc2VzIGhhdmVuJ3QgcHV0IHVzIGludG8gUVVFUllJTkcgbW9kZSwgdGhvdWdoOyBlZyxcbiAgLy8gX2ZldGNoTW9kaWZpZWREb2N1bWVudHMgZG9lcyB0aGlzLilcbiAgX25lZWRUb1BvbGxRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICAvLyBJZiB3ZSdyZSBub3QgYWxyZWFkeSBpbiB0aGUgbWlkZGxlIG9mIGEgcXVlcnksIHdlIGNhbiBxdWVyeSBub3dcbiAgICAgIC8vIChwb3NzaWJseSBwYXVzaW5nIEZFVENISU5HKS5cbiAgICAgIGlmIChzZWxmLl9waGFzZSAhPT0gUEhBU0UuUVVFUllJTkcpIHtcbiAgICAgICAgc2VsZi5fcG9sbFF1ZXJ5KCk7XG4gICAgICAgIHRocm93IG5ldyBTd2l0Y2hlZFRvUXVlcnk7XG4gICAgICB9XG5cbiAgICAgIC8vIFdlJ3JlIGN1cnJlbnRseSBpbiBRVUVSWUlORy4gU2V0IGEgZmxhZyB0byBlbnN1cmUgdGhhdCB3ZSBydW4gYW5vdGhlclxuICAgICAgLy8gcXVlcnkgd2hlbiB3ZSdyZSBkb25lLlxuICAgICAgc2VsZi5fcmVxdWVyeVdoZW5Eb25lVGhpc1F1ZXJ5ID0gdHJ1ZTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBZaWVsZHMhXG4gIF9kb25lUXVlcnlpbmc6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgIHJldHVybjtcblxuICAgIGF3YWl0IHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS53YWl0VW50aWxDYXVnaHRVcCgpO1xuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoc2VsZi5fcGhhc2UgIT09IFBIQVNFLlFVRVJZSU5HKVxuICAgICAgdGhyb3cgRXJyb3IoXCJQaGFzZSB1bmV4cGVjdGVkbHkgXCIgKyBzZWxmLl9waGFzZSk7XG5cbiAgICBpZiAoc2VsZi5fcmVxdWVyeVdoZW5Eb25lVGhpc1F1ZXJ5KSB7XG4gICAgICBzZWxmLl9yZXF1ZXJ5V2hlbkRvbmVUaGlzUXVlcnkgPSBmYWxzZTtcbiAgICAgIHNlbGYuX3BvbGxRdWVyeSgpO1xuICAgIH0gZWxzZSBpZiAoc2VsZi5fbmVlZFRvRmV0Y2guZW1wdHkoKSkge1xuICAgICAgYXdhaXQgc2VsZi5fYmVTdGVhZHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fZmV0Y2hNb2RpZmllZERvY3VtZW50cygpO1xuICAgIH1cbiAgfSxcblxuICBfY3Vyc29yRm9yUXVlcnk6IGZ1bmN0aW9uIChvcHRpb25zT3ZlcndyaXRlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBUaGUgcXVlcnkgd2UgcnVuIGlzIGFsbW9zdCB0aGUgc2FtZSBhcyB0aGUgY3Vyc29yIHdlIGFyZSBvYnNlcnZpbmcsXG4gICAgICAvLyB3aXRoIGEgZmV3IGNoYW5nZXMuIFdlIG5lZWQgdG8gcmVhZCBhbGwgdGhlIGZpZWxkcyB0aGF0IGFyZSByZWxldmFudCB0b1xuICAgICAgLy8gdGhlIHNlbGVjdG9yLCBub3QganVzdCB0aGUgZmllbGRzIHdlIGFyZSBnb2luZyB0byBwdWJsaXNoICh0aGF0J3MgdGhlXG4gICAgICAvLyBcInNoYXJlZFwiIHByb2plY3Rpb24pLiBBbmQgd2UgZG9uJ3Qgd2FudCB0byBhcHBseSBhbnkgdHJhbnNmb3JtIGluIHRoZVxuICAgICAgLy8gY3Vyc29yLCBiZWNhdXNlIG9ic2VydmVDaGFuZ2VzIHNob3VsZG4ndCB1c2UgdGhlIHRyYW5zZm9ybS5cbiAgICAgIHZhciBvcHRpb25zID0gXy5jbG9uZShzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zKTtcblxuICAgICAgLy8gQWxsb3cgdGhlIGNhbGxlciB0byBtb2RpZnkgdGhlIG9wdGlvbnMuIFVzZWZ1bCB0byBzcGVjaWZ5IGRpZmZlcmVudFxuICAgICAgLy8gc2tpcCBhbmQgbGltaXQgdmFsdWVzLlxuICAgICAgXy5leHRlbmQob3B0aW9ucywgb3B0aW9uc092ZXJ3cml0ZSk7XG5cbiAgICAgIG9wdGlvbnMuZmllbGRzID0gc2VsZi5fc2hhcmVkUHJvamVjdGlvbjtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLnRyYW5zZm9ybTtcbiAgICAgIC8vIFdlIGFyZSBOT1QgZGVlcCBjbG9uaW5nIGZpZWxkcyBvciBzZWxlY3RvciBoZXJlLCB3aGljaCBzaG91bGQgYmUgT0suXG4gICAgICB2YXIgZGVzY3JpcHRpb24gPSBuZXcgQ3Vyc29yRGVzY3JpcHRpb24oXG4gICAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3RvcixcbiAgICAgICAgb3B0aW9ucyk7XG4gICAgICByZXR1cm4gbmV3IEN1cnNvcihzZWxmLl9tb25nb0hhbmRsZSwgZGVzY3JpcHRpb24pO1xuICAgIH0pO1xuICB9LFxuXG5cbiAgLy8gUmVwbGFjZSBzZWxmLl9wdWJsaXNoZWQgd2l0aCBuZXdSZXN1bHRzIChib3RoIGFyZSBJZE1hcHMpLCBpbnZva2luZyBvYnNlcnZlXG4gIC8vIGNhbGxiYWNrcyBvbiB0aGUgbXVsdGlwbGV4ZXIuXG4gIC8vIFJlcGxhY2Ugc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIgd2l0aCBuZXdCdWZmZXIuXG4gIC8vXG4gIC8vIFhYWCBUaGlzIGlzIHZlcnkgc2ltaWxhciB0byBMb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeVVub3JkZXJlZENoYW5nZXMuIFdlXG4gIC8vIHNob3VsZCByZWFsbHk6IChhKSBVbmlmeSBJZE1hcCBhbmQgT3JkZXJlZERpY3QgaW50byBVbm9yZGVyZWQvT3JkZXJlZERpY3RcbiAgLy8gKGIpIFJld3JpdGUgZGlmZi5qcyB0byB1c2UgdGhlc2UgY2xhc3NlcyBpbnN0ZWFkIG9mIGFycmF5cyBhbmQgb2JqZWN0cy5cbiAgX3B1Ymxpc2hOZXdSZXN1bHRzOiBmdW5jdGlvbiAobmV3UmVzdWx0cywgbmV3QnVmZmVyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcblxuICAgICAgLy8gSWYgdGhlIHF1ZXJ5IGlzIGxpbWl0ZWQgYW5kIHRoZXJlIGlzIGEgYnVmZmVyLCBzaHV0IGRvd24gc28gaXQgZG9lc24ndFxuICAgICAgLy8gc3RheSBpbiBhIHdheS5cbiAgICAgIGlmIChzZWxmLl9saW1pdCkge1xuICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5jbGVhcigpO1xuICAgICAgfVxuXG4gICAgICAvLyBGaXJzdCByZW1vdmUgYW55dGhpbmcgdGhhdCdzIGdvbmUuIEJlIGNhcmVmdWwgbm90IHRvIG1vZGlmeVxuICAgICAgLy8gc2VsZi5fcHVibGlzaGVkIHdoaWxlIGl0ZXJhdGluZyBvdmVyIGl0LlxuICAgICAgdmFyIGlkc1RvUmVtb3ZlID0gW107XG4gICAgICBzZWxmLl9wdWJsaXNoZWQuZm9yRWFjaChmdW5jdGlvbiAoZG9jLCBpZCkge1xuICAgICAgICBpZiAoIW5ld1Jlc3VsdHMuaGFzKGlkKSlcbiAgICAgICAgICBpZHNUb1JlbW92ZS5wdXNoKGlkKTtcbiAgICAgIH0pO1xuICAgICAgXy5lYWNoKGlkc1RvUmVtb3ZlLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgc2VsZi5fcmVtb3ZlUHVibGlzaGVkKGlkKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBOb3cgZG8gYWRkcyBhbmQgY2hhbmdlcy5cbiAgICAgIC8vIElmIHNlbGYgaGFzIGEgYnVmZmVyIGFuZCBsaW1pdCwgdGhlIG5ldyBmZXRjaGVkIHJlc3VsdCB3aWxsIGJlXG4gICAgICAvLyBsaW1pdGVkIGNvcnJlY3RseSBhcyB0aGUgcXVlcnkgaGFzIHNvcnQgc3BlY2lmaWVyLlxuICAgICAgbmV3UmVzdWx0cy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgIHNlbGYuX2hhbmRsZURvYyhpZCwgZG9jKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBTYW5pdHktY2hlY2sgdGhhdCBldmVyeXRoaW5nIHdlIHRyaWVkIHRvIHB1dCBpbnRvIF9wdWJsaXNoZWQgZW5kZWQgdXBcbiAgICAgIC8vIHRoZXJlLlxuICAgICAgLy8gWFhYIGlmIHRoaXMgaXMgc2xvdywgcmVtb3ZlIGl0IGxhdGVyXG4gICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLnNpemUoKSAhPT0gbmV3UmVzdWx0cy5zaXplKCkpIHtcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZygnVGhlIE1vbmdvIHNlcnZlciBhbmQgdGhlIE1ldGVvciBxdWVyeSBkaXNhZ3JlZSBvbiBob3cgJyArXG4gICAgICAgICAgJ21hbnkgZG9jdW1lbnRzIG1hdGNoIHlvdXIgcXVlcnkuIEN1cnNvciBkZXNjcmlwdGlvbjogJyxcbiAgICAgICAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbik7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgIGlmICghbmV3UmVzdWx0cy5oYXMoaWQpKVxuICAgICAgICAgIHRocm93IEVycm9yKFwiX3B1Ymxpc2hlZCBoYXMgYSBkb2MgdGhhdCBuZXdSZXN1bHRzIGRvZXNuJ3Q7IFwiICsgaWQpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEZpbmFsbHksIHJlcGxhY2UgdGhlIGJ1ZmZlclxuICAgICAgbmV3QnVmZmVyLmZvckVhY2goZnVuY3Rpb24gKGRvYywgaWQpIHtcbiAgICAgICAgc2VsZi5fYWRkQnVmZmVyZWQoaWQsIGRvYyk7XG4gICAgICB9KTtcblxuICAgICAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gbmV3QnVmZmVyLnNpemUoKSA8IHNlbGYuX2xpbWl0O1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFRoaXMgc3RvcCBmdW5jdGlvbiBpcyBpbnZva2VkIGZyb20gdGhlIG9uU3RvcCBvZiB0aGUgT2JzZXJ2ZU11bHRpcGxleGVyLCBzb1xuICAvLyBpdCBzaG91bGRuJ3QgYWN0dWFsbHkgYmUgcG9zc2libGUgdG8gY2FsbCBpdCB1bnRpbCB0aGUgbXVsdGlwbGV4ZXIgaXNcbiAgLy8gcmVhZHkuXG4gIC8vXG4gIC8vIEl0J3MgaW1wb3J0YW50IHRvIGNoZWNrIHNlbGYuX3N0b3BwZWQgYWZ0ZXIgZXZlcnkgY2FsbCBpbiB0aGlzIGZpbGUgdGhhdFxuICAvLyBjYW4geWllbGQhXG4gIF9zdG9wOiBhc3luYyBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fc3RvcHBlZCA9IHRydWU7XG5cbiAgICAvLyBOb3RlOiB3ZSAqZG9uJ3QqIHVzZSBtdWx0aXBsZXhlci5vbkZsdXNoIGhlcmUgYmVjYXVzZSB0aGlzIHN0b3BcbiAgICAvLyBjYWxsYmFjayBpcyBhY3R1YWxseSBpbnZva2VkIGJ5IHRoZSBtdWx0aXBsZXhlciBpdHNlbGYgd2hlbiBpdCBoYXNcbiAgICAvLyBkZXRlcm1pbmVkIHRoYXQgdGhlcmUgYXJlIG5vIGhhbmRsZXMgbGVmdC4gU28gbm90aGluZyBpcyBhY3R1YWxseSBnb2luZ1xuICAgIC8vIHRvIGdldCBmbHVzaGVkIChhbmQgaXQncyBwcm9iYWJseSBub3QgdmFsaWQgdG8gY2FsbCBtZXRob2RzIG9uIHRoZVxuICAgIC8vIGR5aW5nIG11bHRpcGxleGVyKS5cbiAgICBmb3IgKGNvbnN0IHcgb2Ygc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSkge1xuICAgICAgYXdhaXQgdy5jb21taXR0ZWQoKTtcbiAgICB9XG4gICAgc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSA9IG51bGw7XG5cbiAgICAvLyBQcm9hY3RpdmVseSBkcm9wIHJlZmVyZW5jZXMgdG8gcG90ZW50aWFsbHkgYmlnIHRoaW5ncy5cbiAgICBzZWxmLl9wdWJsaXNoZWQgPSBudWxsO1xuICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyID0gbnVsbDtcbiAgICBzZWxmLl9uZWVkVG9GZXRjaCA9IG51bGw7XG4gICAgc2VsZi5fY3VycmVudGx5RmV0Y2hpbmcgPSBudWxsO1xuICAgIHNlbGYuX29wbG9nRW50cnlIYW5kbGUgPSBudWxsO1xuICAgIHNlbGYuX2xpc3RlbmVyc0hhbmRsZSA9IG51bGw7XG5cbiAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtb3Bsb2dcIiwgLTEpO1xuXG4gICAgZm9yIGF3YWl0IChjb25zdCBoYW5kbGUgb2Ygc2VsZi5fc3RvcEhhbmRsZXMpIHtcbiAgICAgIGF3YWl0IGhhbmRsZS5zdG9wKCk7XG4gICAgfVxuICB9LFxuICBzdG9wOiBhc3luYyBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gYXdhaXQgc2VsZi5fc3RvcCgpO1xuICB9LFxuXG4gIF9yZWdpc3RlclBoYXNlQ2hhbmdlOiBmdW5jdGlvbiAocGhhc2UpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG5vdyA9IG5ldyBEYXRlO1xuXG4gICAgICBpZiAoc2VsZi5fcGhhc2UpIHtcbiAgICAgICAgdmFyIHRpbWVEaWZmID0gbm93IC0gc2VsZi5fcGhhc2VTdGFydFRpbWU7XG4gICAgICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwidGltZS1zcGVudC1pbi1cIiArIHNlbGYuX3BoYXNlICsgXCItcGhhc2VcIiwgdGltZURpZmYpO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9waGFzZSA9IHBoYXNlO1xuICAgICAgc2VsZi5fcGhhc2VTdGFydFRpbWUgPSBub3c7XG4gICAgfSk7XG4gIH1cbn0pO1xuXG4vLyBEb2VzIG91ciBvcGxvZyB0YWlsaW5nIGNvZGUgc3VwcG9ydCB0aGlzIGN1cnNvcj8gRm9yIG5vdywgd2UgYXJlIGJlaW5nIHZlcnlcbi8vIGNvbnNlcnZhdGl2ZSBhbmQgYWxsb3dpbmcgb25seSBzaW1wbGUgcXVlcmllcyB3aXRoIHNpbXBsZSBvcHRpb25zLlxuLy8gKFRoaXMgaXMgYSBcInN0YXRpYyBtZXRob2RcIi4pXG5PcGxvZ09ic2VydmVEcml2ZXIuY3Vyc29yU3VwcG9ydGVkID0gZnVuY3Rpb24gKGN1cnNvckRlc2NyaXB0aW9uLCBtYXRjaGVyKSB7XG4gIC8vIEZpcnN0LCBjaGVjayB0aGUgb3B0aW9ucy5cbiAgdmFyIG9wdGlvbnMgPSBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zO1xuXG4gIC8vIERpZCB0aGUgdXNlciBzYXkgbm8gZXhwbGljaXRseT9cbiAgLy8gdW5kZXJzY29yZWQgdmVyc2lvbiBvZiB0aGUgb3B0aW9uIGlzIENPTVBBVCB3aXRoIDEuMlxuICBpZiAob3B0aW9ucy5kaXNhYmxlT3Bsb2cgfHwgb3B0aW9ucy5fZGlzYWJsZU9wbG9nKVxuICAgIHJldHVybiBmYWxzZTtcblxuICAvLyBza2lwIGlzIG5vdCBzdXBwb3J0ZWQ6IHRvIHN1cHBvcnQgaXQgd2Ugd291bGQgbmVlZCB0byBrZWVwIHRyYWNrIG9mIGFsbFxuICAvLyBcInNraXBwZWRcIiBkb2N1bWVudHMgb3IgYXQgbGVhc3QgdGhlaXIgaWRzLlxuICAvLyBsaW1pdCB3L28gYSBzb3J0IHNwZWNpZmllciBpcyBub3Qgc3VwcG9ydGVkOiBjdXJyZW50IGltcGxlbWVudGF0aW9uIG5lZWRzIGFcbiAgLy8gZGV0ZXJtaW5pc3RpYyB3YXkgdG8gb3JkZXIgZG9jdW1lbnRzLlxuICBpZiAob3B0aW9ucy5za2lwIHx8IChvcHRpb25zLmxpbWl0ICYmICFvcHRpb25zLnNvcnQpKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gSWYgYSBmaWVsZHMgcHJvamVjdGlvbiBvcHRpb24gaXMgZ2l2ZW4gY2hlY2sgaWYgaXQgaXMgc3VwcG9ydGVkIGJ5XG4gIC8vIG1pbmltb25nbyAoc29tZSBvcGVyYXRvcnMgYXJlIG5vdCBzdXBwb3J0ZWQpLlxuICBjb25zdCBmaWVsZHMgPSBvcHRpb25zLmZpZWxkcyB8fCBvcHRpb25zLnByb2plY3Rpb247XG4gIGlmIChmaWVsZHMpIHtcbiAgICB0cnkge1xuICAgICAgTG9jYWxDb2xsZWN0aW9uLl9jaGVja1N1cHBvcnRlZFByb2plY3Rpb24oZmllbGRzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5uYW1lID09PSBcIk1pbmltb25nb0Vycm9yXCIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBXZSBkb24ndCBhbGxvdyB0aGUgZm9sbG93aW5nIHNlbGVjdG9yczpcbiAgLy8gICAtICR3aGVyZSAobm90IGNvbmZpZGVudCB0aGF0IHdlIHByb3ZpZGUgdGhlIHNhbWUgSlMgZW52aXJvbm1lbnRcbiAgLy8gICAgICAgICAgICAgYXMgTW9uZ28sIGFuZCBjYW4geWllbGQhKVxuICAvLyAgIC0gJG5lYXIgKGhhcyBcImludGVyZXN0aW5nXCIgcHJvcGVydGllcyBpbiBNb25nb0RCLCBsaWtlIHRoZSBwb3NzaWJpbGl0eVxuICAvLyAgICAgICAgICAgIG9mIHJldHVybmluZyBhbiBJRCBtdWx0aXBsZSB0aW1lcywgdGhvdWdoIGV2ZW4gcG9sbGluZyBtYXliZVxuICAvLyAgICAgICAgICAgIGhhdmUgYSBidWcgdGhlcmUpXG4gIC8vICAgICAgICAgICBYWFg6IG9uY2Ugd2Ugc3VwcG9ydCBpdCwgd2Ugd291bGQgbmVlZCB0byB0aGluayBtb3JlIG9uIGhvdyB3ZVxuICAvLyAgICAgICAgICAgaW5pdGlhbGl6ZSB0aGUgY29tcGFyYXRvcnMgd2hlbiB3ZSBjcmVhdGUgdGhlIGRyaXZlci5cbiAgcmV0dXJuICFtYXRjaGVyLmhhc1doZXJlKCkgJiYgIW1hdGNoZXIuaGFzR2VvUXVlcnkoKTtcbn07XG5cbnZhciBtb2RpZmllckNhbkJlRGlyZWN0bHlBcHBsaWVkID0gZnVuY3Rpb24gKG1vZGlmaWVyKSB7XG4gIHJldHVybiBfLmFsbChtb2RpZmllciwgZnVuY3Rpb24gKGZpZWxkcywgb3BlcmF0aW9uKSB7XG4gICAgcmV0dXJuIF8uYWxsKGZpZWxkcywgZnVuY3Rpb24gKHZhbHVlLCBmaWVsZCkge1xuICAgICAgcmV0dXJuICEvRUpTT05cXCQvLnRlc3QoZmllbGQpO1xuICAgIH0pO1xuICB9KTtcbn07XG5cbk1vbmdvSW50ZXJuYWxzLk9wbG9nT2JzZXJ2ZURyaXZlciA9IE9wbG9nT2JzZXJ2ZURyaXZlcjtcbiIsIi8vIENvbnZlcnRlciBvZiB0aGUgbmV3IE1vbmdvREIgT3Bsb2cgZm9ybWF0ICg+PTUuMCkgdG8gdGhlIG9uZSB0aGF0IE1ldGVvclxuLy8gaGFuZGxlcyB3ZWxsLCBpLmUuLCBgJHNldGAgYW5kIGAkdW5zZXRgLiBUaGUgbmV3IGZvcm1hdCBpcyBjb21wbGV0ZWx5IG5ldyxcbi8vIGFuZCBsb29rcyBhcyBmb2xsb3dzOlxuLy9cbi8vICAgeyAkdjogMiwgZGlmZjogRGlmZiB9XG4vL1xuLy8gd2hlcmUgYERpZmZgIGlzIGEgcmVjdXJzaXZlIHN0cnVjdHVyZTpcbi8vXG4vLyAgIHtcbi8vICAgICAvLyBOZXN0ZWQgdXBkYXRlcyAoc29tZXRpbWVzIGFsc28gcmVwcmVzZW50ZWQgd2l0aCBhbiBzLWZpZWxkKS5cbi8vICAgICAvLyBFeGFtcGxlOiBgeyAkc2V0OiB7ICdmb28uYmFyJzogMSB9IH1gLlxuLy8gICAgIGk6IHsgPGtleT46IDx2YWx1ZT4sIC4uLiB9LFxuLy9cbi8vICAgICAvLyBUb3AtbGV2ZWwgdXBkYXRlcy5cbi8vICAgICAvLyBFeGFtcGxlOiBgeyAkc2V0OiB7IGZvbzogeyBiYXI6IDEgfSB9IH1gLlxuLy8gICAgIHU6IHsgPGtleT46IDx2YWx1ZT4sIC4uLiB9LFxuLy9cbi8vICAgICAvLyBVbnNldHMuXG4vLyAgICAgLy8gRXhhbXBsZTogYHsgJHVuc2V0OiB7IGZvbzogJycgfSB9YC5cbi8vICAgICBkOiB7IDxrZXk+OiBmYWxzZSwgLi4uIH0sXG4vL1xuLy8gICAgIC8vIEFycmF5IG9wZXJhdGlvbnMuXG4vLyAgICAgLy8gRXhhbXBsZTogYHsgJHB1c2g6IHsgZm9vOiAnYmFyJyB9IH1gLlxuLy8gICAgIHM8a2V5PjogeyBhOiB0cnVlLCB1PGluZGV4PjogPHZhbHVlPiwgLi4uIH0sXG4vLyAgICAgLi4uXG4vL1xuLy8gICAgIC8vIE5lc3RlZCBvcGVyYXRpb25zIChzb21ldGltZXMgYWxzbyByZXByZXNlbnRlZCBpbiB0aGUgYGlgIGZpZWxkKS5cbi8vICAgICAvLyBFeGFtcGxlOiBgeyAkc2V0OiB7ICdmb28uYmFyJzogMSB9IH1gLlxuLy8gICAgIHM8a2V5PjogRGlmZixcbi8vICAgICAuLi5cbi8vICAgfVxuLy9cbi8vIChhbGwgZmllbGRzIGFyZSBvcHRpb25hbCkuXG5cbmZ1bmN0aW9uIGpvaW4ocHJlZml4LCBrZXkpIHtcbiAgcmV0dXJuIHByZWZpeCA/IGAke3ByZWZpeH0uJHtrZXl9YCA6IGtleTtcbn1cblxuY29uc3QgYXJyYXlPcGVyYXRvcktleVJlZ2V4ID0gL14oYXxbc3VdXFxkKykkLztcblxuZnVuY3Rpb24gaXNBcnJheU9wZXJhdG9yS2V5KGZpZWxkKSB7XG4gIHJldHVybiBhcnJheU9wZXJhdG9yS2V5UmVnZXgudGVzdChmaWVsZCk7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlPcGVyYXRvcihvcGVyYXRvcikge1xuICByZXR1cm4gb3BlcmF0b3IuYSA9PT0gdHJ1ZSAmJiBPYmplY3Qua2V5cyhvcGVyYXRvcikuZXZlcnkoaXNBcnJheU9wZXJhdG9yS2V5KTtcbn1cblxuZnVuY3Rpb24gZmxhdHRlbk9iamVjdEludG8odGFyZ2V0LCBzb3VyY2UsIHByZWZpeCkge1xuICBpZiAoQXJyYXkuaXNBcnJheShzb3VyY2UpIHx8IHR5cGVvZiBzb3VyY2UgIT09ICdvYmplY3QnIHx8IHNvdXJjZSA9PT0gbnVsbCB8fFxuICAgICAgc291cmNlIGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SUQpIHtcbiAgICB0YXJnZXRbcHJlZml4XSA9IHNvdXJjZTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoc291cmNlKTtcbiAgICBpZiAoZW50cmllcy5sZW5ndGgpIHtcbiAgICAgIGVudHJpZXMuZm9yRWFjaCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIGZsYXR0ZW5PYmplY3RJbnRvKHRhcmdldCwgdmFsdWUsIGpvaW4ocHJlZml4LCBrZXkpKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRbcHJlZml4XSA9IHNvdXJjZTtcbiAgICB9XG4gIH1cbn1cblxuY29uc3QgbG9nRGVidWdNZXNzYWdlcyA9ICEhcHJvY2Vzcy5lbnYuT1BMT0dfQ09OVkVSVEVSX0RFQlVHO1xuXG5mdW5jdGlvbiBjb252ZXJ0T3Bsb2dEaWZmKG9wbG9nRW50cnksIGRpZmYsIHByZWZpeCkge1xuICBpZiAobG9nRGVidWdNZXNzYWdlcykge1xuICAgIGNvbnNvbGUubG9nKGBjb252ZXJ0T3Bsb2dEaWZmKCR7SlNPTi5zdHJpbmdpZnkob3Bsb2dFbnRyeSl9LCAke0pTT04uc3RyaW5naWZ5KGRpZmYpfSwgJHtKU09OLnN0cmluZ2lmeShwcmVmaXgpfSlgKTtcbiAgfVxuXG4gIE9iamVjdC5lbnRyaWVzKGRpZmYpLmZvckVhY2goKFtkaWZmS2V5LCB2YWx1ZV0pID0+IHtcbiAgICBpZiAoZGlmZktleSA9PT0gJ2QnKSB7XG4gICAgICAvLyBIYW5kbGUgYCR1bnNldGBzLlxuICAgICAgb3Bsb2dFbnRyeS4kdW5zZXQgPz89IHt9O1xuICAgICAgT2JqZWN0LmtleXModmFsdWUpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgb3Bsb2dFbnRyeS4kdW5zZXRbam9pbihwcmVmaXgsIGtleSldID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAoZGlmZktleSA9PT0gJ2knKSB7XG4gICAgICAvLyBIYW5kbGUgKHBvdGVudGlhbGx5KSBuZXN0ZWQgYCRzZXRgcy5cbiAgICAgIG9wbG9nRW50cnkuJHNldCA/Pz0ge307XG4gICAgICBmbGF0dGVuT2JqZWN0SW50byhvcGxvZ0VudHJ5LiRzZXQsIHZhbHVlLCBwcmVmaXgpO1xuICAgIH0gZWxzZSBpZiAoZGlmZktleSA9PT0gJ3UnKSB7XG4gICAgICAvLyBIYW5kbGUgZmxhdCBgJHNldGBzLlxuICAgICAgb3Bsb2dFbnRyeS4kc2V0ID8/PSB7fTtcbiAgICAgIE9iamVjdC5lbnRyaWVzKHZhbHVlKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgb3Bsb2dFbnRyeS4kc2V0W2pvaW4ocHJlZml4LCBrZXkpXSA9IHZhbHVlO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEhhbmRsZSBzLWZpZWxkcy5cbiAgICAgIGNvbnN0IGtleSA9IGRpZmZLZXkuc2xpY2UoMSk7XG4gICAgICBpZiAoaXNBcnJheU9wZXJhdG9yKHZhbHVlKSkge1xuICAgICAgICAvLyBBcnJheSBvcGVyYXRvci5cbiAgICAgICAgT2JqZWN0LmVudHJpZXModmFsdWUpLmZvckVhY2goKFtwb3NpdGlvbiwgdmFsdWVdKSA9PiB7XG4gICAgICAgICAgaWYgKHBvc2l0aW9uID09PSAnYScpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBwb3NpdGlvbktleSA9IGpvaW4oam9pbihwcmVmaXgsIGtleSksIHBvc2l0aW9uLnNsaWNlKDEpKTtcbiAgICAgICAgICBpZiAocG9zaXRpb25bMF0gPT09ICdzJykge1xuICAgICAgICAgICAgY29udmVydE9wbG9nRGlmZihvcGxvZ0VudHJ5LCB2YWx1ZSwgcG9zaXRpb25LZXkpO1xuICAgICAgICAgIH0gZWxzZSBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgIG9wbG9nRW50cnkuJHVuc2V0ID8/PSB7fTtcbiAgICAgICAgICAgIG9wbG9nRW50cnkuJHVuc2V0W3Bvc2l0aW9uS2V5XSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9wbG9nRW50cnkuJHNldCA/Pz0ge307XG4gICAgICAgICAgICBvcGxvZ0VudHJ5LiRzZXRbcG9zaXRpb25LZXldID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5KSB7XG4gICAgICAgIC8vIE5lc3RlZCBvYmplY3QuXG4gICAgICAgIGNvbnZlcnRPcGxvZ0RpZmYob3Bsb2dFbnRyeSwgdmFsdWUsIGpvaW4ocHJlZml4LCBrZXkpKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gb3Bsb2dWMlYxQ29udmVydGVyKG9wbG9nRW50cnkpIHtcbiAgLy8gUGFzcy10aHJvdWdoIHYxIGFuZCAocHJvYmFibHkpIGludmFsaWQgZW50cmllcy5cbiAgaWYgKG9wbG9nRW50cnkuJHYgIT09IDIgfHwgIW9wbG9nRW50cnkuZGlmZikge1xuICAgIHJldHVybiBvcGxvZ0VudHJ5O1xuICB9XG5cbiAgY29uc3QgY29udmVydGVkT3Bsb2dFbnRyeSA9IHsgJHY6IDIgfTtcbiAgY29udmVydE9wbG9nRGlmZihjb252ZXJ0ZWRPcGxvZ0VudHJ5LCBvcGxvZ0VudHJ5LmRpZmYsICcnKTtcbiAgcmV0dXJuIGNvbnZlcnRlZE9wbG9nRW50cnk7XG59XG4iLCIvLyBzaW5nbGV0b25cbmV4cG9ydCBjb25zdCBMb2NhbENvbGxlY3Rpb25Ecml2ZXIgPSBuZXcgKGNsYXNzIExvY2FsQ29sbGVjdGlvbkRyaXZlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMubm9Db25uQ29sbGVjdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB9XG5cbiAgb3BlbihuYW1lLCBjb25uKSB7XG4gICAgaWYgKCEgbmFtZSkge1xuICAgICAgcmV0dXJuIG5ldyBMb2NhbENvbGxlY3Rpb247XG4gICAgfVxuXG4gICAgaWYgKCEgY29ubikge1xuICAgICAgcmV0dXJuIGVuc3VyZUNvbGxlY3Rpb24obmFtZSwgdGhpcy5ub0Nvbm5Db2xsZWN0aW9ucyk7XG4gICAgfVxuXG4gICAgaWYgKCEgY29ubi5fbW9uZ29fbGl2ZWRhdGFfY29sbGVjdGlvbnMpIHtcbiAgICAgIGNvbm4uX21vbmdvX2xpdmVkYXRhX2NvbGxlY3Rpb25zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgICB9XG5cbiAgICAvLyBYWFggaXMgdGhlcmUgYSB3YXkgdG8ga2VlcCB0cmFjayBvZiBhIGNvbm5lY3Rpb24ncyBjb2xsZWN0aW9ucyB3aXRob3V0XG4gICAgLy8gZGFuZ2xpbmcgaXQgb2ZmIHRoZSBjb25uZWN0aW9uIG9iamVjdD9cbiAgICByZXR1cm4gZW5zdXJlQ29sbGVjdGlvbihuYW1lLCBjb25uLl9tb25nb19saXZlZGF0YV9jb2xsZWN0aW9ucyk7XG4gIH1cbn0pO1xuXG5mdW5jdGlvbiBlbnN1cmVDb2xsZWN0aW9uKG5hbWUsIGNvbGxlY3Rpb25zKSB7XG4gIHJldHVybiAobmFtZSBpbiBjb2xsZWN0aW9ucylcbiAgICA/IGNvbGxlY3Rpb25zW25hbWVdXG4gICAgOiBjb2xsZWN0aW9uc1tuYW1lXSA9IG5ldyBMb2NhbENvbGxlY3Rpb24obmFtZSk7XG59XG4iLCJpbXBvcnQge1xuICBBU1lOQ19DT0xMRUNUSU9OX01FVEhPRFMsXG4gIGdldEFzeW5jTWV0aG9kTmFtZSxcbiAgQ0xJRU5UX09OTFlfTUVUSE9EU1xufSBmcm9tIFwibWV0ZW9yL21pbmltb25nby9jb25zdGFudHNcIjtcblxuTW9uZ29JbnRlcm5hbHMuUmVtb3RlQ29sbGVjdGlvbkRyaXZlciA9IGZ1bmN0aW9uIChcbiAgbW9uZ29fdXJsLCBvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5tb25nbyA9IG5ldyBNb25nb0Nvbm5lY3Rpb24obW9uZ29fdXJsLCBvcHRpb25zKTtcbn07XG5cbmNvbnN0IFJFTU9URV9DT0xMRUNUSU9OX01FVEhPRFMgPSBbXG4gICdjcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMnLFxuICAnZHJvcEluZGV4QXN5bmMnLFxuICAnZW5zdXJlSW5kZXhBc3luYycsXG4gICdjcmVhdGVJbmRleEFzeW5jJyxcbiAgJ2NvdW50RG9jdW1lbnRzJyxcbiAgJ2Ryb3BDb2xsZWN0aW9uQXN5bmMnLFxuICAnZXN0aW1hdGVkRG9jdW1lbnRDb3VudCcsXG4gICdmaW5kJyxcbiAgJ2ZpbmRPbmVBc3luYycsXG4gICdpbnNlcnRBc3luYycsXG4gICdyYXdDb2xsZWN0aW9uJyxcbiAgJ3JlbW92ZUFzeW5jJyxcbiAgJ3VwZGF0ZUFzeW5jJyxcbiAgJ3Vwc2VydEFzeW5jJyxcbl07XG5cbk9iamVjdC5hc3NpZ24oTW9uZ29JbnRlcm5hbHMuUmVtb3RlQ29sbGVjdGlvbkRyaXZlci5wcm90b3R5cGUsIHtcbiAgb3BlbjogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHJldCA9IHt9O1xuICAgIFJFTU9URV9DT0xMRUNUSU9OX01FVEhPRFMuZm9yRWFjaChmdW5jdGlvbiAobSkge1xuICAgICAgcmV0W21dID0gXy5iaW5kKHNlbGYubW9uZ29bbV0sIHNlbGYubW9uZ28sIG5hbWUpO1xuXG4gICAgICBpZiAoIUFTWU5DX0NPTExFQ1RJT05fTUVUSE9EUy5pbmNsdWRlcyhtKSkgcmV0dXJuO1xuICAgICAgY29uc3QgYXN5bmNNZXRob2ROYW1lID0gZ2V0QXN5bmNNZXRob2ROYW1lKG0pO1xuICAgICAgcmV0W2FzeW5jTWV0aG9kTmFtZV0gPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmV0W21dKC4uLmFyZ3MpKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgQ0xJRU5UX09OTFlfTUVUSE9EUy5mb3JFYWNoKGZ1bmN0aW9uIChtKSB7XG4gICAgICByZXRbbV0gPSBfLmJpbmQoc2VsZi5tb25nb1ttXSwgc2VsZi5tb25nbywgbmFtZSk7XG5cbiAgICAgIHJldFttXSA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgJHttfSArICBpcyBub3QgYXZhaWxhYmxlIG9uIHRoZSBzZXJ2ZXIuIFBsZWFzZSB1c2UgJHtnZXRBc3luY01ldGhvZE5hbWUoXG4gICAgICAgICAgICBtXG4gICAgICAgICAgKX0oKSBpbnN0ZWFkLmBcbiAgICAgICAgKTtcbiAgICAgIH07XG4gICAgfSk7XG4gICAgcmV0dXJuIHJldDtcbiAgfSxcbn0pO1xuXG4vLyBDcmVhdGUgdGhlIHNpbmdsZXRvbiBSZW1vdGVDb2xsZWN0aW9uRHJpdmVyIG9ubHkgb24gZGVtYW5kLCBzbyB3ZVxuLy8gb25seSByZXF1aXJlIE1vbmdvIGNvbmZpZ3VyYXRpb24gaWYgaXQncyBhY3R1YWxseSB1c2VkIChlZywgbm90IGlmXG4vLyB5b3UncmUgb25seSB0cnlpbmcgdG8gcmVjZWl2ZSBkYXRhIGZyb20gYSByZW1vdGUgRERQIHNlcnZlci4pXG5Nb25nb0ludGVybmFscy5kZWZhdWx0UmVtb3RlQ29sbGVjdGlvbkRyaXZlciA9IF8ub25jZShmdW5jdGlvbiAoKSB7XG4gIHZhciBjb25uZWN0aW9uT3B0aW9ucyA9IHt9O1xuXG4gIHZhciBtb25nb1VybCA9IHByb2Nlc3MuZW52Lk1PTkdPX1VSTDtcblxuICBpZiAocHJvY2Vzcy5lbnYuTU9OR09fT1BMT0dfVVJMKSB7XG4gICAgY29ubmVjdGlvbk9wdGlvbnMub3Bsb2dVcmwgPSBwcm9jZXNzLmVudi5NT05HT19PUExPR19VUkw7XG4gIH1cblxuICBpZiAoISBtb25nb1VybClcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJNT05HT19VUkwgbXVzdCBiZSBzZXQgaW4gZW52aXJvbm1lbnRcIik7XG5cbiAgY29uc3QgZHJpdmVyID0gbmV3IE1vbmdvSW50ZXJuYWxzLlJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIobW9uZ29VcmwsIGNvbm5lY3Rpb25PcHRpb25zKTtcblxuICAvLyBBcyBtYW55IGRlcGxveW1lbnQgdG9vbHMsIGluY2x1ZGluZyBNZXRlb3IgVXAsIHNlbmQgcmVxdWVzdHMgdG8gdGhlIGFwcCBpblxuICAvLyBvcmRlciB0byBjb25maXJtIHRoYXQgdGhlIGRlcGxveW1lbnQgZmluaXNoZWQgc3VjY2Vzc2Z1bGx5LCBpdCdzIHJlcXVpcmVkXG4gIC8vIHRvIGtub3cgYWJvdXQgYSBkYXRhYmFzZSBjb25uZWN0aW9uIHByb2JsZW0gYmVmb3JlIHRoZSBhcHAgc3RhcnRzLiBEb2luZyBzb1xuICAvLyBpbiBhIGBNZXRlb3Iuc3RhcnR1cGAgaXMgZmluZSwgYXMgdGhlIGBXZWJBcHBgIGhhbmRsZXMgcmVxdWVzdHMgb25seSBhZnRlclxuICAvLyBhbGwgYXJlIGZpbmlzaGVkLlxuICBNZXRlb3Iuc3RhcnR1cChhc3luYyAoKSA9PiB7XG4gICAgYXdhaXQgZHJpdmVyLm1vbmdvLmNsaWVudC5jb25uZWN0KCk7XG4gIH0pO1xuXG4gIHJldHVybiBkcml2ZXI7XG59KTtcbiIsIi8vIG9wdGlvbnMuY29ubmVjdGlvbiwgaWYgZ2l2ZW4sIGlzIGEgTGl2ZWRhdGFDbGllbnQgb3IgTGl2ZWRhdGFTZXJ2ZXJcbi8vIFhYWCBwcmVzZW50bHkgdGhlcmUgaXMgbm8gd2F5IHRvIGRlc3Ryb3kvY2xlYW4gdXAgYSBDb2xsZWN0aW9uXG5pbXBvcnQge1xuICBBU1lOQ19DT0xMRUNUSU9OX01FVEhPRFMsXG4gIGdldEFzeW5jTWV0aG9kTmFtZSxcbn0gZnJvbSAnbWV0ZW9yL21pbmltb25nby9jb25zdGFudHMnO1xuXG5pbXBvcnQgeyBub3JtYWxpemVQcm9qZWN0aW9uIH0gZnJvbSBcIi4vbW9uZ29fdXRpbHNcIjtcblxuLyoqXG4gKiBAc3VtbWFyeSBOYW1lc3BhY2UgZm9yIE1vbmdvREItcmVsYXRlZCBpdGVtc1xuICogQG5hbWVzcGFjZVxuICovXG5Nb25nbyA9IHt9O1xuXG4vKipcbiAqIEBzdW1tYXJ5IENvbnN0cnVjdG9yIGZvciBhIENvbGxlY3Rpb25cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQGluc3RhbmNlbmFtZSBjb2xsZWN0aW9uXG4gKiBAY2xhc3NcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBjb2xsZWN0aW9uLiAgSWYgbnVsbCwgY3JlYXRlcyBhbiB1bm1hbmFnZWQgKHVuc3luY2hyb25pemVkKSBsb2NhbCBjb2xsZWN0aW9uLlxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnMuY29ubmVjdGlvbiBUaGUgc2VydmVyIGNvbm5lY3Rpb24gdGhhdCB3aWxsIG1hbmFnZSB0aGlzIGNvbGxlY3Rpb24uIFVzZXMgdGhlIGRlZmF1bHQgY29ubmVjdGlvbiBpZiBub3Qgc3BlY2lmaWVkLiAgUGFzcyB0aGUgcmV0dXJuIHZhbHVlIG9mIGNhbGxpbmcgW2BERFAuY29ubmVjdGBdKCNkZHBfY29ubmVjdCkgdG8gc3BlY2lmeSBhIGRpZmZlcmVudCBzZXJ2ZXIuIFBhc3MgYG51bGxgIHRvIHNwZWNpZnkgbm8gY29ubmVjdGlvbi4gVW5tYW5hZ2VkIChgbmFtZWAgaXMgbnVsbCkgY29sbGVjdGlvbnMgY2Fubm90IHNwZWNpZnkgYSBjb25uZWN0aW9uLlxuICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMuaWRHZW5lcmF0aW9uIFRoZSBtZXRob2Qgb2YgZ2VuZXJhdGluZyB0aGUgYF9pZGAgZmllbGRzIG9mIG5ldyBkb2N1bWVudHMgaW4gdGhpcyBjb2xsZWN0aW9uLiAgUG9zc2libGUgdmFsdWVzOlxuXG4gLSAqKmAnU1RSSU5HJ2AqKjogcmFuZG9tIHN0cmluZ3NcbiAtICoqYCdNT05HTydgKio6ICByYW5kb20gW2BNb25nby5PYmplY3RJRGBdKCNtb25nb19vYmplY3RfaWQpIHZhbHVlc1xuXG5UaGUgZGVmYXVsdCBpZCBnZW5lcmF0aW9uIHRlY2huaXF1ZSBpcyBgJ1NUUklORydgLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy50cmFuc2Zvcm0gQW4gb3B0aW9uYWwgdHJhbnNmb3JtYXRpb24gZnVuY3Rpb24uIERvY3VtZW50cyB3aWxsIGJlIHBhc3NlZCB0aHJvdWdoIHRoaXMgZnVuY3Rpb24gYmVmb3JlIGJlaW5nIHJldHVybmVkIGZyb20gYGZldGNoYCBvciBgZmluZE9uZUFzeW5jYCwgYW5kIGJlZm9yZSBiZWluZyBwYXNzZWQgdG8gY2FsbGJhY2tzIG9mIGBvYnNlcnZlYCwgYG1hcGAsIGBmb3JFYWNoYCwgYGFsbG93YCwgYW5kIGBkZW55YC4gVHJhbnNmb3JtcyBhcmUgKm5vdCogYXBwbGllZCBmb3IgdGhlIGNhbGxiYWNrcyBvZiBgb2JzZXJ2ZUNoYW5nZXNgIG9yIHRvIGN1cnNvcnMgcmV0dXJuZWQgZnJvbSBwdWJsaXNoIGZ1bmN0aW9ucy5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5kZWZpbmVNdXRhdGlvbk1ldGhvZHMgU2V0IHRvIGBmYWxzZWAgdG8gc2tpcCBzZXR0aW5nIHVwIHRoZSBtdXRhdGlvbiBtZXRob2RzIHRoYXQgZW5hYmxlIGluc2VydC91cGRhdGUvcmVtb3ZlIGZyb20gY2xpZW50IGNvZGUuIERlZmF1bHQgYHRydWVgLlxuICovXG5Nb25nby5Db2xsZWN0aW9uID0gZnVuY3Rpb24gQ29sbGVjdGlvbihuYW1lLCBvcHRpb25zKSB7XG4gIGlmICghbmFtZSAmJiBuYW1lICE9PSBudWxsKSB7XG4gICAgTWV0ZW9yLl9kZWJ1ZyhcbiAgICAgICdXYXJuaW5nOiBjcmVhdGluZyBhbm9ueW1vdXMgY29sbGVjdGlvbi4gSXQgd2lsbCBub3QgYmUgJyArXG4gICAgICAgICdzYXZlZCBvciBzeW5jaHJvbml6ZWQgb3ZlciB0aGUgbmV0d29yay4gKFBhc3MgbnVsbCBmb3IgJyArXG4gICAgICAgICd0aGUgY29sbGVjdGlvbiBuYW1lIHRvIHR1cm4gb2ZmIHRoaXMgd2FybmluZy4pJ1xuICAgICk7XG4gICAgbmFtZSA9IG51bGw7XG4gIH1cblxuICBpZiAobmFtZSAhPT0gbnVsbCAmJiB0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnRmlyc3QgYXJndW1lbnQgdG8gbmV3IE1vbmdvLkNvbGxlY3Rpb24gbXVzdCBiZSBhIHN0cmluZyBvciBudWxsJ1xuICAgICk7XG4gIH1cblxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm1ldGhvZHMpIHtcbiAgICAvLyBCYWNrd2FyZHMgY29tcGF0aWJpbGl0eSBoYWNrIHdpdGggb3JpZ2luYWwgc2lnbmF0dXJlICh3aGljaCBwYXNzZWRcbiAgICAvLyBcImNvbm5lY3Rpb25cIiBkaXJlY3RseSBpbnN0ZWFkIG9mIGluIG9wdGlvbnMuIChDb25uZWN0aW9ucyBtdXN0IGhhdmUgYSBcIm1ldGhvZHNcIlxuICAgIC8vIG1ldGhvZC4pXG4gICAgLy8gWFhYIHJlbW92ZSBiZWZvcmUgMS4wXG4gICAgb3B0aW9ucyA9IHsgY29ubmVjdGlvbjogb3B0aW9ucyB9O1xuICB9XG4gIC8vIEJhY2t3YXJkcyBjb21wYXRpYmlsaXR5OiBcImNvbm5lY3Rpb25cIiB1c2VkIHRvIGJlIGNhbGxlZCBcIm1hbmFnZXJcIi5cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5tYW5hZ2VyICYmICFvcHRpb25zLmNvbm5lY3Rpb24pIHtcbiAgICBvcHRpb25zLmNvbm5lY3Rpb24gPSBvcHRpb25zLm1hbmFnZXI7XG4gIH1cblxuICBvcHRpb25zID0ge1xuICAgIGNvbm5lY3Rpb246IHVuZGVmaW5lZCxcbiAgICBpZEdlbmVyYXRpb246ICdTVFJJTkcnLFxuICAgIHRyYW5zZm9ybTogbnVsbCxcbiAgICBfZHJpdmVyOiB1bmRlZmluZWQsXG4gICAgX3ByZXZlbnRBdXRvcHVibGlzaDogZmFsc2UsXG4gICAgLi4ub3B0aW9ucyxcbiAgfTtcblxuICBzd2l0Y2ggKG9wdGlvbnMuaWRHZW5lcmF0aW9uKSB7XG4gICAgY2FzZSAnTU9OR08nOlxuICAgICAgdGhpcy5fbWFrZU5ld0lEID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzcmMgPSBuYW1lXG4gICAgICAgICAgPyBERFAucmFuZG9tU3RyZWFtKCcvY29sbGVjdGlvbi8nICsgbmFtZSlcbiAgICAgICAgICA6IFJhbmRvbS5pbnNlY3VyZTtcbiAgICAgICAgcmV0dXJuIG5ldyBNb25nby5PYmplY3RJRChzcmMuaGV4U3RyaW5nKDI0KSk7XG4gICAgICB9O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnU1RSSU5HJzpcbiAgICBkZWZhdWx0OlxuICAgICAgdGhpcy5fbWFrZU5ld0lEID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBzcmMgPSBuYW1lXG4gICAgICAgICAgPyBERFAucmFuZG9tU3RyZWFtKCcvY29sbGVjdGlvbi8nICsgbmFtZSlcbiAgICAgICAgICA6IFJhbmRvbS5pbnNlY3VyZTtcbiAgICAgICAgcmV0dXJuIHNyYy5pZCgpO1xuICAgICAgfTtcbiAgICAgIGJyZWFrO1xuICB9XG5cbiAgdGhpcy5fdHJhbnNmb3JtID0gTG9jYWxDb2xsZWN0aW9uLndyYXBUcmFuc2Zvcm0ob3B0aW9ucy50cmFuc2Zvcm0pO1xuXG4gIHRoaXMucmVzb2x2ZXJUeXBlID0gb3B0aW9ucy5yZXNvbHZlclR5cGU7XG5cbiAgaWYgKCFuYW1lIHx8IG9wdGlvbnMuY29ubmVjdGlvbiA9PT0gbnVsbClcbiAgICAvLyBub3RlOiBuYW1lbGVzcyBjb2xsZWN0aW9ucyBuZXZlciBoYXZlIGEgY29ubmVjdGlvblxuICAgIHRoaXMuX2Nvbm5lY3Rpb24gPSBudWxsO1xuICBlbHNlIGlmIChvcHRpb25zLmNvbm5lY3Rpb24pIHRoaXMuX2Nvbm5lY3Rpb24gPSBvcHRpb25zLmNvbm5lY3Rpb247XG4gIGVsc2UgaWYgKE1ldGVvci5pc0NsaWVudCkgdGhpcy5fY29ubmVjdGlvbiA9IE1ldGVvci5jb25uZWN0aW9uO1xuICBlbHNlIHRoaXMuX2Nvbm5lY3Rpb24gPSBNZXRlb3Iuc2VydmVyO1xuXG4gIGlmICghb3B0aW9ucy5fZHJpdmVyKSB7XG4gICAgLy8gWFhYIFRoaXMgY2hlY2sgYXNzdW1lcyB0aGF0IHdlYmFwcCBpcyBsb2FkZWQgc28gdGhhdCBNZXRlb3Iuc2VydmVyICE9PVxuICAgIC8vIG51bGwuIFdlIHNob3VsZCBmdWxseSBzdXBwb3J0IHRoZSBjYXNlIG9mIFwid2FudCB0byB1c2UgYSBNb25nby1iYWNrZWRcbiAgICAvLyBjb2xsZWN0aW9uIGZyb20gTm9kZSBjb2RlIHdpdGhvdXQgd2ViYXBwXCIsIGJ1dCB3ZSBkb24ndCB5ZXQuXG4gICAgLy8gI01ldGVvclNlcnZlck51bGxcbiAgICBpZiAoXG4gICAgICBuYW1lICYmXG4gICAgICB0aGlzLl9jb25uZWN0aW9uID09PSBNZXRlb3Iuc2VydmVyICYmXG4gICAgICB0eXBlb2YgTW9uZ29JbnRlcm5hbHMgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICBNb25nb0ludGVybmFscy5kZWZhdWx0UmVtb3RlQ29sbGVjdGlvbkRyaXZlclxuICAgICkge1xuICAgICAgb3B0aW9ucy5fZHJpdmVyID0gTW9uZ29JbnRlcm5hbHMuZGVmYXVsdFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgeyBMb2NhbENvbGxlY3Rpb25Ecml2ZXIgfSA9IHJlcXVpcmUoJy4vbG9jYWxfY29sbGVjdGlvbl9kcml2ZXIuanMnKTtcbiAgICAgIG9wdGlvbnMuX2RyaXZlciA9IExvY2FsQ29sbGVjdGlvbkRyaXZlcjtcbiAgICB9XG4gIH1cblxuICB0aGlzLl9jb2xsZWN0aW9uID0gb3B0aW9ucy5fZHJpdmVyLm9wZW4obmFtZSwgdGhpcy5fY29ubmVjdGlvbik7XG4gIHRoaXMuX25hbWUgPSBuYW1lO1xuICB0aGlzLl9kcml2ZXIgPSBvcHRpb25zLl9kcml2ZXI7XG5cbiAgLy8gVE9ET1tmaWJlcnNdOiBfbWF5YmVTZXRVcFJlcGxpY2F0aW9uIGlzIG5vdyBhc3luYy4gTGV0J3Mgd2F0Y2ggaG93IG5vdCB3YWl0aW5nIGZvciB0aGlzIGZ1bmN0aW9uIHRvIGZpbmlzaFxuICAgIC8vIHdpbGwgYWZmZWN0IGV2ZXJ5dGhpbmdcbiAgdGhpcy5fc2V0dGluZ1VwUmVwbGljYXRpb25Qcm9taXNlID0gdGhpcy5fbWF5YmVTZXRVcFJlcGxpY2F0aW9uKG5hbWUsIG9wdGlvbnMpO1xuXG4gIC8vIFhYWCBkb24ndCBkZWZpbmUgdGhlc2UgdW50aWwgYWxsb3cgb3IgZGVueSBpcyBhY3R1YWxseSB1c2VkIGZvciB0aGlzXG4gIC8vIGNvbGxlY3Rpb24uIENvdWxkIGJlIGhhcmQgaWYgdGhlIHNlY3VyaXR5IHJ1bGVzIGFyZSBvbmx5IGRlZmluZWQgb24gdGhlXG4gIC8vIHNlcnZlci5cbiAgaWYgKG9wdGlvbnMuZGVmaW5lTXV0YXRpb25NZXRob2RzICE9PSBmYWxzZSkge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLl9kZWZpbmVNdXRhdGlvbk1ldGhvZHMoe1xuICAgICAgICB1c2VFeGlzdGluZzogb3B0aW9ucy5fc3VwcHJlc3NTYW1lTmFtZUVycm9yID09PSB0cnVlLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIFRocm93IGEgbW9yZSB1bmRlcnN0YW5kYWJsZSBlcnJvciBvbiB0aGUgc2VydmVyIGZvciBzYW1lIGNvbGxlY3Rpb24gbmFtZVxuICAgICAgaWYgKFxuICAgICAgICBlcnJvci5tZXNzYWdlID09PSBgQSBtZXRob2QgbmFtZWQgJy8ke25hbWV9L2luc2VydEFzeW5jJyBpcyBhbHJlYWR5IGRlZmluZWRgXG4gICAgICApXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlcmUgaXMgYWxyZWFkeSBhIGNvbGxlY3Rpb24gbmFtZWQgXCIke25hbWV9XCJgKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8vIGF1dG9wdWJsaXNoXG4gIGlmIChcbiAgICBQYWNrYWdlLmF1dG9wdWJsaXNoICYmXG4gICAgIW9wdGlvbnMuX3ByZXZlbnRBdXRvcHVibGlzaCAmJlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24gJiZcbiAgICB0aGlzLl9jb25uZWN0aW9uLnB1Ymxpc2hcbiAgKSB7XG4gICAgdGhpcy5fY29ubmVjdGlvbi5wdWJsaXNoKG51bGwsICgpID0+IHRoaXMuZmluZCgpLCB7XG4gICAgICBpc19hdXRvOiB0cnVlLFxuICAgIH0pO1xuICB9XG59O1xuXG5PYmplY3QuYXNzaWduKE1vbmdvLkNvbGxlY3Rpb24ucHJvdG90eXBlLCB7XG4gIGFzeW5jIF9tYXliZVNldFVwUmVwbGljYXRpb24obmFtZSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChcbiAgICAgICEoXG4gICAgICAgIHNlbGYuX2Nvbm5lY3Rpb24gJiZcbiAgICAgICAgc2VsZi5fY29ubmVjdGlvbi5yZWdpc3RlclN0b3JlQ2xpZW50ICYmXG4gICAgICAgIHNlbGYuX2Nvbm5lY3Rpb24ucmVnaXN0ZXJTdG9yZVNlcnZlclxuICAgICAgKVxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuXG4gICAgY29uc3Qgd3JhcHBlZFN0b3JlQ29tbW9uID0ge1xuICAgICAgLy8gQ2FsbGVkIGFyb3VuZCBtZXRob2Qgc3R1YiBpbnZvY2F0aW9ucyB0byBjYXB0dXJlIHRoZSBvcmlnaW5hbCB2ZXJzaW9uc1xuICAgICAgLy8gb2YgbW9kaWZpZWQgZG9jdW1lbnRzLlxuICAgICAgc2F2ZU9yaWdpbmFscygpIHtcbiAgICAgICAgc2VsZi5fY29sbGVjdGlvbi5zYXZlT3JpZ2luYWxzKCk7XG4gICAgICB9LFxuICAgICAgcmV0cmlldmVPcmlnaW5hbHMoKSB7XG4gICAgICAgIHJldHVybiBzZWxmLl9jb2xsZWN0aW9uLnJldHJpZXZlT3JpZ2luYWxzKCk7XG4gICAgICB9LFxuICAgICAgLy8gVG8gYmUgYWJsZSB0byBnZXQgYmFjayB0byB0aGUgY29sbGVjdGlvbiBmcm9tIHRoZSBzdG9yZS5cbiAgICAgIF9nZXRDb2xsZWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZjtcbiAgICAgIH0sXG4gICAgfTtcbiAgICBjb25zdCB3cmFwcGVkU3RvcmVDbGllbnQgPSB7XG4gICAgICAvLyBDYWxsZWQgYXQgdGhlIGJlZ2lubmluZyBvZiBhIGJhdGNoIG9mIHVwZGF0ZXMuIGJhdGNoU2l6ZSBpcyB0aGUgbnVtYmVyXG4gICAgICAvLyBvZiB1cGRhdGUgY2FsbHMgdG8gZXhwZWN0LlxuICAgICAgLy9cbiAgICAgIC8vIFhYWCBUaGlzIGludGVyZmFjZSBpcyBwcmV0dHkgamFua3kuIHJlc2V0IHByb2JhYmx5IG91Z2h0IHRvIGdvIGJhY2sgdG9cbiAgICAgIC8vIGJlaW5nIGl0cyBvd24gZnVuY3Rpb24sIGFuZCBjYWxsZXJzIHNob3VsZG4ndCBoYXZlIHRvIGNhbGN1bGF0ZVxuICAgICAgLy8gYmF0Y2hTaXplLiBUaGUgb3B0aW1pemF0aW9uIG9mIG5vdCBjYWxsaW5nIHBhdXNlL3JlbW92ZSBzaG91bGQgYmVcbiAgICAgIC8vIGRlbGF5ZWQgdW50aWwgbGF0ZXI6IHRoZSBmaXJzdCBjYWxsIHRvIHVwZGF0ZSgpIHNob3VsZCBidWZmZXIgaXRzXG4gICAgICAvLyBtZXNzYWdlLCBhbmQgdGhlbiB3ZSBjYW4gZWl0aGVyIGRpcmVjdGx5IGFwcGx5IGl0IGF0IGVuZFVwZGF0ZSB0aW1lIGlmXG4gICAgICAvLyBpdCB3YXMgdGhlIG9ubHkgdXBkYXRlLCBvciBkbyBwYXVzZU9ic2VydmVycy9hcHBseS9hcHBseSBhdCB0aGUgbmV4dFxuICAgICAgLy8gdXBkYXRlKCkgaWYgdGhlcmUncyBhbm90aGVyIG9uZS5cbiAgICAgIGFzeW5jIGJlZ2luVXBkYXRlKGJhdGNoU2l6ZSwgcmVzZXQpIHtcbiAgICAgICAgLy8gcGF1c2Ugb2JzZXJ2ZXJzIHNvIHVzZXJzIGRvbid0IHNlZSBmbGlja2VyIHdoZW4gdXBkYXRpbmcgc2V2ZXJhbFxuICAgICAgICAvLyBvYmplY3RzIGF0IG9uY2UgKGluY2x1ZGluZyB0aGUgcG9zdC1yZWNvbm5lY3QgcmVzZXQtYW5kLXJlYXBwbHlcbiAgICAgICAgLy8gc3RhZ2UpLCBhbmQgc28gdGhhdCBhIHJlLXNvcnRpbmcgb2YgYSBxdWVyeSBjYW4gdGFrZSBhZHZhbnRhZ2Ugb2YgdGhlXG4gICAgICAgIC8vIGZ1bGwgX2RpZmZRdWVyeSBtb3ZlZCBjYWxjdWxhdGlvbiBpbnN0ZWFkIG9mIGFwcGx5aW5nIGNoYW5nZSBvbmUgYXQgYVxuICAgICAgICAvLyB0aW1lLlxuICAgICAgICBpZiAoYmF0Y2hTaXplID4gMSB8fCByZXNldCkgc2VsZi5fY29sbGVjdGlvbi5wYXVzZU9ic2VydmVycygpO1xuXG4gICAgICAgIGlmIChyZXNldCkgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5yZW1vdmUoe30pO1xuICAgICAgfSxcblxuICAgICAgLy8gQXBwbHkgYW4gdXBkYXRlLlxuICAgICAgLy8gWFhYIGJldHRlciBzcGVjaWZ5IHRoaXMgaW50ZXJmYWNlIChub3QgaW4gdGVybXMgb2YgYSB3aXJlIG1lc3NhZ2UpP1xuICAgICAgdXBkYXRlKG1zZykge1xuICAgICAgICB2YXIgbW9uZ29JZCA9IE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpO1xuICAgICAgICB2YXIgZG9jID0gc2VsZi5fY29sbGVjdGlvbi5fZG9jcy5nZXQobW9uZ29JZCk7XG5cbiAgICAgICAgLy9XaGVuIHRoZSBzZXJ2ZXIncyBtZXJnZWJveCBpcyBkaXNhYmxlZCBmb3IgYSBjb2xsZWN0aW9uLCB0aGUgY2xpZW50IG11c3QgZ3JhY2VmdWxseSBoYW5kbGUgaXQgd2hlbjpcbiAgICAgICAgLy8gKldlIHJlY2VpdmUgYW4gYWRkZWQgbWVzc2FnZSBmb3IgYSBkb2N1bWVudCB0aGF0IGlzIGFscmVhZHkgdGhlcmUuIEluc3RlYWQsIGl0IHdpbGwgYmUgY2hhbmdlZFxuICAgICAgICAvLyAqV2UgcmVlaXZlIGEgY2hhbmdlIG1lc3NhZ2UgZm9yIGEgZG9jdW1lbnQgdGhhdCBpcyBub3QgdGhlcmUuIEluc3RlYWQsIGl0IHdpbGwgYmUgYWRkZWRcbiAgICAgICAgLy8gKldlIHJlY2VpdmUgYSByZW1vdmVkIG1lc3NzYWdlIGZvciBhIGRvY3VtZW50IHRoYXQgaXMgbm90IHRoZXJlLiBJbnN0ZWFkLCBub3Rpbmcgd2lsIGhhcHBlbi5cblxuICAgICAgICAvL0NvZGUgaXMgZGVyaXZlZCBmcm9tIGNsaWVudC1zaWRlIGNvZGUgb3JpZ2luYWxseSBpbiBwZWVybGlicmFyeTpjb250cm9sLW1lcmdlYm94XG4gICAgICAgIC8vaHR0cHM6Ly9naXRodWIuY29tL3BlZXJsaWJyYXJ5L21ldGVvci1jb250cm9sLW1lcmdlYm94L2Jsb2IvbWFzdGVyL2NsaWVudC5jb2ZmZWVcblxuICAgICAgICAvL0ZvciBtb3JlIGluZm9ybWF0aW9uLCByZWZlciB0byBkaXNjdXNzaW9uIFwiSW5pdGlhbCBzdXBwb3J0IGZvciBwdWJsaWNhdGlvbiBzdHJhdGVnaWVzIGluIGxpdmVkYXRhIHNlcnZlclwiOlxuICAgICAgICAvL2h0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL3B1bGwvMTExNTFcbiAgICAgICAgaWYgKE1ldGVvci5pc0NsaWVudCkge1xuICAgICAgICAgIGlmIChtc2cubXNnID09PSAnYWRkZWQnICYmIGRvYykge1xuICAgICAgICAgICAgbXNnLm1zZyA9ICdjaGFuZ2VkJztcbiAgICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdyZW1vdmVkJyAmJiAhZG9jKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnY2hhbmdlZCcgJiYgIWRvYykge1xuICAgICAgICAgICAgbXNnLm1zZyA9ICdhZGRlZCc7XG4gICAgICAgICAgICBjb25zdCBfcmVmID0gbXNnLmZpZWxkcztcbiAgICAgICAgICAgIGZvciAobGV0IGZpZWxkIGluIF9yZWYpIHtcbiAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBfcmVmW2ZpZWxkXTtcbiAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSB2b2lkIDApIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgbXNnLmZpZWxkc1tmaWVsZF07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gSXMgdGhpcyBhIFwicmVwbGFjZSB0aGUgd2hvbGUgZG9jXCIgbWVzc2FnZSBjb21pbmcgZnJvbSB0aGUgcXVpZXNjZW5jZVxuICAgICAgICAvLyBvZiBtZXRob2Qgd3JpdGVzIHRvIGFuIG9iamVjdD8gKE5vdGUgdGhhdCAndW5kZWZpbmVkJyBpcyBhIHZhbGlkXG4gICAgICAgIC8vIHZhbHVlIG1lYW5pbmcgXCJyZW1vdmUgaXRcIi4pXG4gICAgICAgIGlmIChtc2cubXNnID09PSAncmVwbGFjZScpIHtcbiAgICAgICAgICB2YXIgcmVwbGFjZSA9IG1zZy5yZXBsYWNlO1xuICAgICAgICAgIGlmICghcmVwbGFjZSkge1xuICAgICAgICAgICAgaWYgKGRvYykgc2VsZi5fY29sbGVjdGlvbi5yZW1vdmUobW9uZ29JZCk7XG4gICAgICAgICAgfSBlbHNlIGlmICghZG9jKSB7XG4gICAgICAgICAgICBzZWxmLl9jb2xsZWN0aW9uLmluc2VydChyZXBsYWNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gWFhYIGNoZWNrIHRoYXQgcmVwbGFjZSBoYXMgbm8gJCBvcHNcbiAgICAgICAgICAgIHNlbGYuX2NvbGxlY3Rpb24udXBkYXRlKG1vbmdvSWQsIHJlcGxhY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2FkZGVkJykge1xuICAgICAgICAgIGlmIChkb2MpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0V4cGVjdGVkIG5vdCB0byBmaW5kIGEgZG9jdW1lbnQgYWxyZWFkeSBwcmVzZW50IGZvciBhbiBhZGQnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZWxmLl9jb2xsZWN0aW9uLmluc2VydCh7IF9pZDogbW9uZ29JZCwgLi4ubXNnLmZpZWxkcyB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncmVtb3ZlZCcpIHtcbiAgICAgICAgICBpZiAoIWRvYylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCBhbHJlYWR5IHByZXNlbnQgZm9yIHJlbW92ZWQnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlKG1vbmdvSWQpO1xuICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdjaGFuZ2VkJykge1xuICAgICAgICAgIGlmICghZG9jKSB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCB0byBjaGFuZ2UnKTtcbiAgICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMobXNnLmZpZWxkcyk7XG4gICAgICAgICAgaWYgKGtleXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdmFyIG1vZGlmaWVyID0ge307XG4gICAgICAgICAgICBrZXlzLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBtc2cuZmllbGRzW2tleV07XG4gICAgICAgICAgICAgIGlmIChFSlNPTi5lcXVhbHMoZG9jW2tleV0sIHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGlmICghbW9kaWZpZXIuJHVuc2V0KSB7XG4gICAgICAgICAgICAgICAgICBtb2RpZmllci4kdW5zZXQgPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbW9kaWZpZXIuJHVuc2V0W2tleV0gPSAxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghbW9kaWZpZXIuJHNldCkge1xuICAgICAgICAgICAgICAgICAgbW9kaWZpZXIuJHNldCA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtb2RpZmllci4kc2V0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMobW9kaWZpZXIpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgc2VsZi5fY29sbGVjdGlvbi51cGRhdGUobW9uZ29JZCwgbW9kaWZpZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJIGRvbid0IGtub3cgaG93IHRvIGRlYWwgd2l0aCB0aGlzIG1lc3NhZ2VcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8vIENhbGxlZCBhdCB0aGUgZW5kIG9mIGEgYmF0Y2ggb2YgdXBkYXRlcy5saXZlZGF0YV9jb25uZWN0aW9uLmpzOjEyODdcbiAgICAgIGVuZFVwZGF0ZSgpIHtcbiAgICAgICAgc2VsZi5fY29sbGVjdGlvbi5yZXN1bWVPYnNlcnZlcnNDbGllbnQoKTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIFVzZWQgdG8gcHJlc2VydmUgY3VycmVudCB2ZXJzaW9ucyBvZiBkb2N1bWVudHMgYWNyb3NzIGEgc3RvcmUgcmVzZXQuXG4gICAgICBnZXREb2MoaWQpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuZmluZE9uZShpZCk7XG4gICAgICB9LFxuXG4gICAgICAuLi53cmFwcGVkU3RvcmVDb21tb24sXG4gICAgfTtcbiAgICBjb25zdCB3cmFwcGVkU3RvcmVTZXJ2ZXIgPSB7XG4gICAgICBhc3luYyBiZWdpblVwZGF0ZShiYXRjaFNpemUsIHJlc2V0KSB7XG4gICAgICAgIGlmIChiYXRjaFNpemUgPiAxIHx8IHJlc2V0KSBzZWxmLl9jb2xsZWN0aW9uLnBhdXNlT2JzZXJ2ZXJzKCk7XG5cbiAgICAgICAgaWYgKHJlc2V0KSBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLnJlbW92ZUFzeW5jKHt9KTtcbiAgICAgIH0sXG5cbiAgICAgIGFzeW5jIHVwZGF0ZShtc2cpIHtcbiAgICAgICAgdmFyIG1vbmdvSWQgPSBNb25nb0lELmlkUGFyc2UobXNnLmlkKTtcbiAgICAgICAgdmFyIGRvYyA9IHNlbGYuX2NvbGxlY3Rpb24uX2RvY3MuZ2V0KG1vbmdvSWQpO1xuXG4gICAgICAgIC8vIElzIHRoaXMgYSBcInJlcGxhY2UgdGhlIHdob2xlIGRvY1wiIG1lc3NhZ2UgY29taW5nIGZyb20gdGhlIHF1aWVzY2VuY2VcbiAgICAgICAgLy8gb2YgbWV0aG9kIHdyaXRlcyB0byBhbiBvYmplY3Q/IChOb3RlIHRoYXQgJ3VuZGVmaW5lZCcgaXMgYSB2YWxpZFxuICAgICAgICAvLyB2YWx1ZSBtZWFuaW5nIFwicmVtb3ZlIGl0XCIuKVxuICAgICAgICBpZiAobXNnLm1zZyA9PT0gJ3JlcGxhY2UnKSB7XG4gICAgICAgICAgdmFyIHJlcGxhY2UgPSBtc2cucmVwbGFjZTtcbiAgICAgICAgICBpZiAoIXJlcGxhY2UpIHtcbiAgICAgICAgICAgIGlmIChkb2MpIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlQXN5bmMobW9uZ29JZCk7XG4gICAgICAgICAgfSBlbHNlIGlmICghZG9jKSB7XG4gICAgICAgICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmluc2VydEFzeW5jKHJlcGxhY2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBYWFggY2hlY2sgdGhhdCByZXBsYWNlIGhhcyBubyAkIG9wc1xuICAgICAgICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi51cGRhdGVBc3luYyhtb25nb0lkLCByZXBsYWNlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdhZGRlZCcpIHtcbiAgICAgICAgICBpZiAoZG9jKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICdFeHBlY3RlZCBub3QgdG8gZmluZCBhIGRvY3VtZW50IGFscmVhZHkgcHJlc2VudCBmb3IgYW4gYWRkJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5pbnNlcnRBc3luYyh7IF9pZDogbW9uZ29JZCwgLi4ubXNnLmZpZWxkcyB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncmVtb3ZlZCcpIHtcbiAgICAgICAgICBpZiAoIWRvYylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCBhbHJlYWR5IHByZXNlbnQgZm9yIHJlbW92ZWQnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlQXN5bmMobW9uZ29JZCk7XG4gICAgICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2NoYW5nZWQnKSB7XG4gICAgICAgICAgaWYgKCFkb2MpIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgdG8gZmluZCBhIGRvY3VtZW50IHRvIGNoYW5nZScpO1xuICAgICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhtc2cuZmllbGRzKTtcbiAgICAgICAgICBpZiAoa2V5cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB2YXIgbW9kaWZpZXIgPSB7fTtcbiAgICAgICAgICAgIGtleXMuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IG1zZy5maWVsZHNba2V5XTtcbiAgICAgICAgICAgICAgaWYgKEVKU09OLmVxdWFscyhkb2Nba2V5XSwgdmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtb2RpZmllci4kdW5zZXQpIHtcbiAgICAgICAgICAgICAgICAgIG1vZGlmaWVyLiR1bnNldCA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtb2RpZmllci4kdW5zZXRba2V5XSA9IDE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtb2RpZmllci4kc2V0KSB7XG4gICAgICAgICAgICAgICAgICBtb2RpZmllci4kc2V0ID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1vZGlmaWVyLiRzZXRba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhtb2RpZmllcikubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLnVwZGF0ZUFzeW5jKG1vbmdvSWQsIG1vZGlmaWVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSSBkb24ndCBrbm93IGhvdyB0byBkZWFsIHdpdGggdGhpcyBtZXNzYWdlXCIpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvLyBDYWxsZWQgYXQgdGhlIGVuZCBvZiBhIGJhdGNoIG9mIHVwZGF0ZXMuXG4gICAgICBhc3luYyBlbmRVcGRhdGUoKSB7XG4gICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24ucmVzdW1lT2JzZXJ2ZXJzU2VydmVyKCk7XG4gICAgICB9LFxuXG4gICAgICAvLyBVc2VkIHRvIHByZXNlcnZlIGN1cnJlbnQgdmVyc2lvbnMgb2YgZG9jdW1lbnRzIGFjcm9zcyBhIHN0b3JlIHJlc2V0LlxuICAgICAgYXN5bmMgZ2V0RG9jKGlkKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmZpbmRPbmVBc3luYyhpZCk7XG4gICAgICB9LFxuICAgICAgLi4ud3JhcHBlZFN0b3JlQ29tbW9uLFxuICAgIH07XG5cblxuICAgIC8vIE9LLCB3ZSdyZSBnb2luZyB0byBiZSBhIHNsYXZlLCByZXBsaWNhdGluZyBzb21lIHJlbW90ZVxuICAgIC8vIGRhdGFiYXNlLCBleGNlcHQgcG9zc2libHkgd2l0aCBzb21lIHRlbXBvcmFyeSBkaXZlcmdlbmNlIHdoaWxlXG4gICAgLy8gd2UgaGF2ZSB1bmFja25vd2xlZGdlZCBSUEMncy5cbiAgICBsZXQgcmVnaXN0ZXJTdG9yZVJlc3VsdDtcbiAgICBpZiAoTWV0ZW9yLmlzQ2xpZW50KSB7XG4gICAgICByZWdpc3RlclN0b3JlUmVzdWx0ID0gc2VsZi5fY29ubmVjdGlvbi5yZWdpc3RlclN0b3JlQ2xpZW50KFxuICAgICAgICBuYW1lLFxuICAgICAgICB3cmFwcGVkU3RvcmVDbGllbnRcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZ2lzdGVyU3RvcmVSZXN1bHQgPSBzZWxmLl9jb25uZWN0aW9uLnJlZ2lzdGVyU3RvcmVTZXJ2ZXIoXG4gICAgICAgIG5hbWUsXG4gICAgICAgIHdyYXBwZWRTdG9yZVNlcnZlclxuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlID0gYFRoZXJlIGlzIGFscmVhZHkgYSBjb2xsZWN0aW9uIG5hbWVkIFwiJHtuYW1lfVwiYDtcbiAgICBjb25zdCBsb2dXYXJuID0gKCkgPT4ge1xuICAgICAgY29uc29sZS53YXJuID8gY29uc29sZS53YXJuKG1lc3NhZ2UpIDogY29uc29sZS5sb2cobWVzc2FnZSk7XG4gICAgfTtcblxuICAgIGlmICghcmVnaXN0ZXJTdG9yZVJlc3VsdCkge1xuICAgICAgcmV0dXJuIGxvZ1dhcm4oKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVnaXN0ZXJTdG9yZVJlc3VsdD8udGhlbj8uKG9rID0+IHtcbiAgICAgIGlmICghb2spIHtcbiAgICAgICAgbG9nV2FybigpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIC8vL1xuICAvLy8gTWFpbiBjb2xsZWN0aW9uIEFQSVxuICAvLy9cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldHMgdGhlIG51bWJlciBvZiBkb2N1bWVudHMgbWF0Y2hpbmcgdGhlIGZpbHRlci4gRm9yIGEgZmFzdCBjb3VudCBvZiB0aGUgdG90YWwgZG9jdW1lbnRzIGluIGEgY29sbGVjdGlvbiBzZWUgYGVzdGltYXRlZERvY3VtZW50Q291bnRgLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCBjb3VudERvY3VtZW50c1xuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBbc2VsZWN0b3JdIEEgcXVlcnkgZGVzY3JpYmluZyB0aGUgZG9jdW1lbnRzIHRvIGNvdW50XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gQWxsIG9wdGlvbnMgYXJlIGxpc3RlZCBpbiBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL21vbmdvZGIuZ2l0aHViLmlvL25vZGUtbW9uZ29kYi1uYXRpdmUvNC4xMS9pbnRlcmZhY2VzL0NvdW50RG9jdW1lbnRzT3B0aW9ucy5odG1sKS4gUGxlYXNlIG5vdGUgdGhhdCBub3QgYWxsIG9mIHRoZW0gYXJlIGF2YWlsYWJsZSBvbiB0aGUgY2xpZW50LlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxudW1iZXI+fVxuICAgKi9cbiAgY291bnREb2N1bWVudHMoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLmNvdW50RG9jdW1lbnRzKC4uLmFyZ3MpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBHZXRzIGFuIGVzdGltYXRlIG9mIHRoZSBjb3VudCBvZiBkb2N1bWVudHMgaW4gYSBjb2xsZWN0aW9uIHVzaW5nIGNvbGxlY3Rpb24gbWV0YWRhdGEuIEZvciBhbiBleGFjdCBjb3VudCBvZiB0aGUgZG9jdW1lbnRzIGluIGEgY29sbGVjdGlvbiBzZWUgYGNvdW50RG9jdW1lbnRzYC5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgZXN0aW1hdGVkRG9jdW1lbnRDb3VudFxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vbW9uZ29kYi5naXRodWIuaW8vbm9kZS1tb25nb2RiLW5hdGl2ZS80LjExL2ludGVyZmFjZXMvRXN0aW1hdGVkRG9jdW1lbnRDb3VudE9wdGlvbnMuaHRtbCkuIFBsZWFzZSBub3RlIHRoYXQgbm90IGFsbCBvZiB0aGVtIGFyZSBhdmFpbGFibGUgb24gdGhlIGNsaWVudC5cbiAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn1cbiAgICovXG4gIGVzdGltYXRlZERvY3VtZW50Q291bnQoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLmVzdGltYXRlZERvY3VtZW50Q291bnQoLi4uYXJncyk7XG4gIH0sXG5cbiAgX2dldEZpbmRTZWxlY3RvcihhcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoID09IDApIHJldHVybiB7fTtcbiAgICBlbHNlIHJldHVybiBhcmdzWzBdO1xuICB9LFxuXG4gIF9nZXRGaW5kT3B0aW9ucyhhcmdzKSB7XG4gICAgY29uc3QgWywgb3B0aW9uc10gPSBhcmdzIHx8IFtdO1xuICAgIGNvbnN0IG5ld09wdGlvbnMgPSBub3JtYWxpemVQcm9qZWN0aW9uKG9wdGlvbnMpO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChhcmdzLmxlbmd0aCA8IDIpIHtcbiAgICAgIHJldHVybiB7IHRyYW5zZm9ybTogc2VsZi5fdHJhbnNmb3JtIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNoZWNrKFxuICAgICAgICBuZXdPcHRpb25zLFxuICAgICAgICBNYXRjaC5PcHRpb25hbChcbiAgICAgICAgICBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe1xuICAgICAgICAgICAgcHJvamVjdGlvbjogTWF0Y2guT3B0aW9uYWwoTWF0Y2guT25lT2YoT2JqZWN0LCB1bmRlZmluZWQpKSxcbiAgICAgICAgICAgIHNvcnQ6IE1hdGNoLk9wdGlvbmFsKFxuICAgICAgICAgICAgICBNYXRjaC5PbmVPZihPYmplY3QsIEFycmF5LCBGdW5jdGlvbiwgdW5kZWZpbmVkKVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGxpbWl0OiBNYXRjaC5PcHRpb25hbChNYXRjaC5PbmVPZihOdW1iZXIsIHVuZGVmaW5lZCkpLFxuICAgICAgICAgICAgc2tpcDogTWF0Y2guT3B0aW9uYWwoTWF0Y2guT25lT2YoTnVtYmVyLCB1bmRlZmluZWQpKSxcbiAgICAgICAgICB9KVxuICAgICAgICApXG4gICAgICApO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICB0cmFuc2Zvcm06IHNlbGYuX3RyYW5zZm9ybSxcbiAgICAgICAgLi4ubmV3T3B0aW9ucyxcbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGaW5kIHRoZSBkb2N1bWVudHMgaW4gYSBjb2xsZWN0aW9uIHRoYXQgbWF0Y2ggdGhlIHNlbGVjdG9yLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCBmaW5kXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IFtzZWxlY3Rvcl0gQSBxdWVyeSBkZXNjcmliaW5nIHRoZSBkb2N1bWVudHMgdG8gZmluZFxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7TW9uZ29Tb3J0U3BlY2lmaWVyfSBvcHRpb25zLnNvcnQgU29ydCBvcmRlciAoZGVmYXVsdDogbmF0dXJhbCBvcmRlcilcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMuc2tpcCBOdW1iZXIgb2YgcmVzdWx0cyB0byBza2lwIGF0IHRoZSBiZWdpbm5pbmdcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMubGltaXQgTWF4aW11bSBudW1iZXIgb2YgcmVzdWx0cyB0byByZXR1cm5cbiAgICogQHBhcmFtIHtNb25nb0ZpZWxkU3BlY2lmaWVyfSBvcHRpb25zLmZpZWxkcyBEaWN0aW9uYXJ5IG9mIGZpZWxkcyB0byByZXR1cm4gb3IgZXhjbHVkZS5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnJlYWN0aXZlIChDbGllbnQgb25seSkgRGVmYXVsdCBgdHJ1ZWA7IHBhc3MgYGZhbHNlYCB0byBkaXNhYmxlIHJlYWN0aXZpdHlcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy50cmFuc2Zvcm0gT3ZlcnJpZGVzIGB0cmFuc2Zvcm1gIG9uIHRoZSAgW2BDb2xsZWN0aW9uYF0oI2NvbGxlY3Rpb25zKSBmb3IgdGhpcyBjdXJzb3IuICBQYXNzIGBudWxsYCB0byBkaXNhYmxlIHRyYW5zZm9ybWF0aW9uLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMuZGlzYWJsZU9wbG9nIChTZXJ2ZXIgb25seSkgUGFzcyB0cnVlIHRvIGRpc2FibGUgb3Bsb2ctdGFpbGluZyBvbiB0aGlzIHF1ZXJ5LiBUaGlzIGFmZmVjdHMgdGhlIHdheSBzZXJ2ZXIgcHJvY2Vzc2VzIGNhbGxzIHRvIGBvYnNlcnZlYCBvbiB0aGlzIHF1ZXJ5LiBEaXNhYmxpbmcgdGhlIG9wbG9nIGNhbiBiZSB1c2VmdWwgd2hlbiB3b3JraW5nIHdpdGggZGF0YSB0aGF0IHVwZGF0ZXMgaW4gbGFyZ2UgYmF0Y2hlcy5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMucG9sbGluZ0ludGVydmFsTXMgKFNlcnZlciBvbmx5KSBXaGVuIG9wbG9nIGlzIGRpc2FibGVkICh0aHJvdWdoIHRoZSB1c2Ugb2YgYGRpc2FibGVPcGxvZ2Agb3Igd2hlbiBvdGhlcndpc2Ugbm90IGF2YWlsYWJsZSksIHRoZSBmcmVxdWVuY3kgKGluIG1pbGxpc2Vjb25kcykgb2YgaG93IG9mdGVuIHRvIHBvbGwgdGhpcyBxdWVyeSB3aGVuIG9ic2VydmluZyBvbiB0aGUgc2VydmVyLiBEZWZhdWx0cyB0byAxMDAwMG1zICgxMCBzZWNvbmRzKS5cbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMucG9sbGluZ1Rocm90dGxlTXMgKFNlcnZlciBvbmx5KSBXaGVuIG9wbG9nIGlzIGRpc2FibGVkICh0aHJvdWdoIHRoZSB1c2Ugb2YgYGRpc2FibGVPcGxvZ2Agb3Igd2hlbiBvdGhlcndpc2Ugbm90IGF2YWlsYWJsZSksIHRoZSBtaW5pbXVtIHRpbWUgKGluIG1pbGxpc2Vjb25kcykgdG8gYWxsb3cgYmV0d2VlbiByZS1wb2xsaW5nIHdoZW4gb2JzZXJ2aW5nIG9uIHRoZSBzZXJ2ZXIuIEluY3JlYXNpbmcgdGhpcyB3aWxsIHNhdmUgQ1BVIGFuZCBtb25nbyBsb2FkIGF0IHRoZSBleHBlbnNlIG9mIHNsb3dlciB1cGRhdGVzIHRvIHVzZXJzLiBEZWNyZWFzaW5nIHRoaXMgaXMgbm90IHJlY29tbWVuZGVkLiBEZWZhdWx0cyB0byA1MG1zLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5tYXhUaW1lTXMgKFNlcnZlciBvbmx5KSBJZiBzZXQsIGluc3RydWN0cyBNb25nb0RCIHRvIHNldCBhIHRpbWUgbGltaXQgZm9yIHRoaXMgY3Vyc29yJ3Mgb3BlcmF0aW9ucy4gSWYgdGhlIG9wZXJhdGlvbiByZWFjaGVzIHRoZSBzcGVjaWZpZWQgdGltZSBsaW1pdCAoaW4gbWlsbGlzZWNvbmRzKSB3aXRob3V0IHRoZSBoYXZpbmcgYmVlbiBjb21wbGV0ZWQsIGFuIGV4Y2VwdGlvbiB3aWxsIGJlIHRocm93bi4gVXNlZnVsIHRvIHByZXZlbnQgYW4gKGFjY2lkZW50YWwgb3IgbWFsaWNpb3VzKSB1bm9wdGltaXplZCBxdWVyeSBmcm9tIGNhdXNpbmcgYSBmdWxsIGNvbGxlY3Rpb24gc2NhbiB0aGF0IHdvdWxkIGRpc3J1cHQgb3RoZXIgZGF0YWJhc2UgdXNlcnMsIGF0IHRoZSBleHBlbnNlIG9mIG5lZWRpbmcgdG8gaGFuZGxlIHRoZSByZXN1bHRpbmcgZXJyb3IuXG4gICAqIEBwYXJhbSB7U3RyaW5nfE9iamVjdH0gb3B0aW9ucy5oaW50IChTZXJ2ZXIgb25seSkgT3ZlcnJpZGVzIE1vbmdvREIncyBkZWZhdWx0IGluZGV4IHNlbGVjdGlvbiBhbmQgcXVlcnkgb3B0aW1pemF0aW9uIHByb2Nlc3MuIFNwZWNpZnkgYW4gaW5kZXggdG8gZm9yY2UgaXRzIHVzZSwgZWl0aGVyIGJ5IGl0cyBuYW1lIG9yIGluZGV4IHNwZWNpZmljYXRpb24uIFlvdSBjYW4gYWxzbyBzcGVjaWZ5IGB7ICRuYXR1cmFsIDogMSB9YCB0byBmb3JjZSBhIGZvcndhcmRzIGNvbGxlY3Rpb24gc2Nhbiwgb3IgYHsgJG5hdHVyYWwgOiAtMSB9YCBmb3IgYSByZXZlcnNlIGNvbGxlY3Rpb24gc2Nhbi4gU2V0dGluZyB0aGlzIGlzIG9ubHkgcmVjb21tZW5kZWQgZm9yIGFkdmFuY2VkIHVzZXJzLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5yZWFkUHJlZmVyZW5jZSAoU2VydmVyIG9ubHkpIFNwZWNpZmllcyBhIGN1c3RvbSBNb25nb0RCIFtgcmVhZFByZWZlcmVuY2VgXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvcmVhZC1wcmVmZXJlbmNlKSBmb3IgdGhpcyBwYXJ0aWN1bGFyIGN1cnNvci4gUG9zc2libGUgdmFsdWVzIGFyZSBgcHJpbWFyeWAsIGBwcmltYXJ5UHJlZmVycmVkYCwgYHNlY29uZGFyeWAsIGBzZWNvbmRhcnlQcmVmZXJyZWRgIGFuZCBgbmVhcmVzdGAuXG4gICAqIEByZXR1cm5zIHtNb25nby5DdXJzb3J9XG4gICAqL1xuICBmaW5kKC4uLmFyZ3MpIHtcbiAgICAvLyBDb2xsZWN0aW9uLmZpbmQoKSAocmV0dXJuIGFsbCBkb2NzKSBiZWhhdmVzIGRpZmZlcmVudGx5XG4gICAgLy8gZnJvbSBDb2xsZWN0aW9uLmZpbmQodW5kZWZpbmVkKSAocmV0dXJuIDAgZG9jcykuICBzbyBiZVxuICAgIC8vIGNhcmVmdWwgYWJvdXQgdGhlIGxlbmd0aCBvZiBhcmd1bWVudHMuXG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24uZmluZChcbiAgICAgIHRoaXMuX2dldEZpbmRTZWxlY3RvcihhcmdzKSxcbiAgICAgIHRoaXMuX2dldEZpbmRPcHRpb25zKGFyZ3MpXG4gICAgKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgRmluZHMgdGhlIGZpcnN0IGRvY3VtZW50IHRoYXQgbWF0Y2hlcyB0aGUgc2VsZWN0b3IsIGFzIG9yZGVyZWQgYnkgc29ydCBhbmQgc2tpcCBvcHRpb25zLiBSZXR1cm5zIGB1bmRlZmluZWRgIGlmIG5vIG1hdGNoaW5nIGRvY3VtZW50IGlzIGZvdW5kLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCBmaW5kT25lQXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gW3NlbGVjdG9yXSBBIHF1ZXJ5IGRlc2NyaWJpbmcgdGhlIGRvY3VtZW50cyB0byBmaW5kXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtNb25nb1NvcnRTcGVjaWZpZXJ9IG9wdGlvbnMuc29ydCBTb3J0IG9yZGVyIChkZWZhdWx0OiBuYXR1cmFsIG9yZGVyKVxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5za2lwIE51bWJlciBvZiByZXN1bHRzIHRvIHNraXAgYXQgdGhlIGJlZ2lubmluZ1xuICAgKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmVhY3RpdmUgKENsaWVudCBvbmx5KSBEZWZhdWx0IHRydWU7IHBhc3MgZmFsc2UgdG8gZGlzYWJsZSByZWFjdGl2aXR5XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMudHJhbnNmb3JtIE92ZXJyaWRlcyBgdHJhbnNmb3JtYCBvbiB0aGUgW2BDb2xsZWN0aW9uYF0oI2NvbGxlY3Rpb25zKSBmb3IgdGhpcyBjdXJzb3IuICBQYXNzIGBudWxsYCB0byBkaXNhYmxlIHRyYW5zZm9ybWF0aW9uLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5yZWFkUHJlZmVyZW5jZSAoU2VydmVyIG9ubHkpIFNwZWNpZmllcyBhIGN1c3RvbSBNb25nb0RCIFtgcmVhZFByZWZlcmVuY2VgXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvcmVhZC1wcmVmZXJlbmNlKSBmb3IgZmV0Y2hpbmcgdGhlIGRvY3VtZW50LiBQb3NzaWJsZSB2YWx1ZXMgYXJlIGBwcmltYXJ5YCwgYHByaW1hcnlQcmVmZXJyZWRgLCBgc2Vjb25kYXJ5YCwgYHNlY29uZGFyeVByZWZlcnJlZGAgYW5kIGBuZWFyZXN0YC5cbiAgICogQHJldHVybnMge09iamVjdH1cbiAgICovXG4gIGZpbmRPbmVBc3luYyguLi5hcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24uZmluZE9uZUFzeW5jKFxuICAgICAgdGhpcy5fZ2V0RmluZFNlbGVjdG9yKGFyZ3MpLFxuICAgICAgdGhpcy5fZ2V0RmluZE9wdGlvbnMoYXJncylcbiAgICApO1xuICB9LFxuICAvKipcbiAgICogQHN1bW1hcnkgRmluZHMgdGhlIGZpcnN0IGRvY3VtZW50IHRoYXQgbWF0Y2hlcyB0aGUgc2VsZWN0b3IsIGFzIG9yZGVyZWQgYnkgc29ydCBhbmQgc2tpcCBvcHRpb25zLiBSZXR1cm5zIGB1bmRlZmluZWRgIGlmIG5vIG1hdGNoaW5nIGRvY3VtZW50IGlzIGZvdW5kLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCBmaW5kT25lXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IFtzZWxlY3Rvcl0gQSBxdWVyeSBkZXNjcmliaW5nIHRoZSBkb2N1bWVudHMgdG8gZmluZFxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7TW9uZ29Tb3J0U3BlY2lmaWVyfSBvcHRpb25zLnNvcnQgU29ydCBvcmRlciAoZGVmYXVsdDogbmF0dXJhbCBvcmRlcilcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbnMuc2tpcCBOdW1iZXIgb2YgcmVzdWx0cyB0byBza2lwIGF0IHRoZSBiZWdpbm5pbmdcbiAgICogQHBhcmFtIHtNb25nb0ZpZWxkU3BlY2lmaWVyfSBvcHRpb25zLmZpZWxkcyBEaWN0aW9uYXJ5IG9mIGZpZWxkcyB0byByZXR1cm4gb3IgZXhjbHVkZS5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnJlYWN0aXZlIChDbGllbnQgb25seSkgRGVmYXVsdCB0cnVlOyBwYXNzIGZhbHNlIHRvIGRpc2FibGUgcmVhY3Rpdml0eVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLnRyYW5zZm9ybSBPdmVycmlkZXMgYHRyYW5zZm9ybWAgb24gdGhlIFtgQ29sbGVjdGlvbmBdKCNjb2xsZWN0aW9ucykgZm9yIHRoaXMgY3Vyc29yLiAgUGFzcyBgbnVsbGAgdG8gZGlzYWJsZSB0cmFuc2Zvcm1hdGlvbi5cbiAgICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMucmVhZFByZWZlcmVuY2UgKFNlcnZlciBvbmx5KSBTcGVjaWZpZXMgYSBjdXN0b20gTW9uZ29EQiBbYHJlYWRQcmVmZXJlbmNlYF0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9jb3JlL3JlYWQtcHJlZmVyZW5jZSkgZm9yIGZldGNoaW5nIHRoZSBkb2N1bWVudC4gUG9zc2libGUgdmFsdWVzIGFyZSBgcHJpbWFyeWAsIGBwcmltYXJ5UHJlZmVycmVkYCwgYHNlY29uZGFyeWAsIGBzZWNvbmRhcnlQcmVmZXJyZWRgIGFuZCBgbmVhcmVzdGAuXG4gICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAqL1xuICBmaW5kT25lKC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi5maW5kT25lKFxuICAgICAgdGhpcy5fZ2V0RmluZFNlbGVjdG9yKGFyZ3MpLFxuICAgICAgdGhpcy5fZ2V0RmluZE9wdGlvbnMoYXJncylcbiAgICApO1xuICB9LFxufSk7XG5cbk9iamVjdC5hc3NpZ24oTW9uZ28uQ29sbGVjdGlvbiwge1xuICBhc3luYyBfcHVibGlzaEN1cnNvcihjdXJzb3IsIHN1YiwgY29sbGVjdGlvbikge1xuICAgIHZhciBvYnNlcnZlSGFuZGxlID0gYXdhaXQgY3Vyc29yLm9ic2VydmVDaGFuZ2VzKFxuICAgICAgICB7XG4gICAgICAgICAgYWRkZWQ6IGZ1bmN0aW9uKGlkLCBmaWVsZHMpIHtcbiAgICAgICAgICAgIHN1Yi5hZGRlZChjb2xsZWN0aW9uLCBpZCwgZmllbGRzKTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNoYW5nZWQ6IGZ1bmN0aW9uKGlkLCBmaWVsZHMpIHtcbiAgICAgICAgICAgIHN1Yi5jaGFuZ2VkKGNvbGxlY3Rpb24sIGlkLCBmaWVsZHMpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgcmVtb3ZlZDogZnVuY3Rpb24oaWQpIHtcbiAgICAgICAgICAgIHN1Yi5yZW1vdmVkKGNvbGxlY3Rpb24sIGlkKTtcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAvLyBQdWJsaWNhdGlvbnMgZG9uJ3QgbXV0YXRlIHRoZSBkb2N1bWVudHNcbiAgICAgICAgLy8gVGhpcyBpcyB0ZXN0ZWQgYnkgdGhlIGBsaXZlZGF0YSAtIHB1Ymxpc2ggY2FsbGJhY2tzIGNsb25lYCB0ZXN0XG4gICAgICAgIHsgbm9uTXV0YXRpbmdDYWxsYmFja3M6IHRydWUgfVxuICAgICk7XG5cbiAgICAvLyBXZSBkb24ndCBjYWxsIHN1Yi5yZWFkeSgpIGhlcmU6IGl0IGdldHMgY2FsbGVkIGluIGxpdmVkYXRhX3NlcnZlciwgYWZ0ZXJcbiAgICAvLyBwb3NzaWJseSBjYWxsaW5nIF9wdWJsaXNoQ3Vyc29yIG9uIG11bHRpcGxlIHJldHVybmVkIGN1cnNvcnMuXG5cbiAgICAvLyByZWdpc3RlciBzdG9wIGNhbGxiYWNrIChleHBlY3RzIGxhbWJkYSB3LyBubyBhcmdzKS5cbiAgICBzdWIub25TdG9wKGFzeW5jIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGF3YWl0IG9ic2VydmVIYW5kbGUuc3RvcCgpO1xuICAgIH0pO1xuXG4gICAgLy8gcmV0dXJuIHRoZSBvYnNlcnZlSGFuZGxlIGluIGNhc2UgaXQgbmVlZHMgdG8gYmUgc3RvcHBlZCBlYXJseVxuICAgIHJldHVybiBvYnNlcnZlSGFuZGxlO1xuICB9LFxuXG4gIC8vIHByb3RlY3QgYWdhaW5zdCBkYW5nZXJvdXMgc2VsZWN0b3JzLiAgZmFsc2V5IGFuZCB7X2lkOiBmYWxzZXl9IGFyZSBib3RoXG4gIC8vIGxpa2VseSBwcm9ncmFtbWVyIGVycm9yLCBhbmQgbm90IHdoYXQgeW91IHdhbnQsIHBhcnRpY3VsYXJseSBmb3IgZGVzdHJ1Y3RpdmVcbiAgLy8gb3BlcmF0aW9ucy4gSWYgYSBmYWxzZXkgX2lkIGlzIHNlbnQgaW4sIGEgbmV3IHN0cmluZyBfaWQgd2lsbCBiZVxuICAvLyBnZW5lcmF0ZWQgYW5kIHJldHVybmVkOyBpZiBhIGZhbGxiYWNrSWQgaXMgcHJvdmlkZWQsIGl0IHdpbGwgYmUgcmV0dXJuZWRcbiAgLy8gaW5zdGVhZC5cbiAgX3Jld3JpdGVTZWxlY3RvcihzZWxlY3RvciwgeyBmYWxsYmFja0lkIH0gPSB7fSkge1xuICAgIC8vIHNob3J0aGFuZCAtLSBzY2FsYXJzIG1hdGNoIF9pZFxuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChzZWxlY3RvcikpIHNlbGVjdG9yID0geyBfaWQ6IHNlbGVjdG9yIH07XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShzZWxlY3RvcikpIHtcbiAgICAgIC8vIFRoaXMgaXMgY29uc2lzdGVudCB3aXRoIHRoZSBNb25nbyBjb25zb2xlIGl0c2VsZjsgaWYgd2UgZG9uJ3QgZG8gdGhpc1xuICAgICAgLy8gY2hlY2sgcGFzc2luZyBhbiBlbXB0eSBhcnJheSBlbmRzIHVwIHNlbGVjdGluZyBhbGwgaXRlbXNcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk1vbmdvIHNlbGVjdG9yIGNhbid0IGJlIGFuIGFycmF5LlwiKTtcbiAgICB9XG5cbiAgICBpZiAoIXNlbGVjdG9yIHx8ICgnX2lkJyBpbiBzZWxlY3RvciAmJiAhc2VsZWN0b3IuX2lkKSkge1xuICAgICAgLy8gY2FuJ3QgbWF0Y2ggYW55dGhpbmdcbiAgICAgIHJldHVybiB7IF9pZDogZmFsbGJhY2tJZCB8fCBSYW5kb20uaWQoKSB9O1xuICAgIH1cblxuICAgIHJldHVybiBzZWxlY3RvcjtcbiAgfSxcbn0pO1xuXG5PYmplY3QuYXNzaWduKE1vbmdvLkNvbGxlY3Rpb24ucHJvdG90eXBlLCB7XG4gIC8vICdpbnNlcnQnIGltbWVkaWF0ZWx5IHJldHVybnMgdGhlIGluc2VydGVkIGRvY3VtZW50J3MgbmV3IF9pZC5cbiAgLy8gVGhlIG90aGVycyByZXR1cm4gdmFsdWVzIGltbWVkaWF0ZWx5IGlmIHlvdSBhcmUgaW4gYSBzdHViLCBhbiBpbi1tZW1vcnlcbiAgLy8gdW5tYW5hZ2VkIGNvbGxlY3Rpb24sIG9yIGEgbW9uZ28tYmFja2VkIGNvbGxlY3Rpb24gYW5kIHlvdSBkb24ndCBwYXNzIGFcbiAgLy8gY2FsbGJhY2suICd1cGRhdGUnIGFuZCAncmVtb3ZlJyByZXR1cm4gdGhlIG51bWJlciBvZiBhZmZlY3RlZFxuICAvLyBkb2N1bWVudHMuICd1cHNlcnQnIHJldHVybnMgYW4gb2JqZWN0IHdpdGgga2V5cyAnbnVtYmVyQWZmZWN0ZWQnIGFuZCwgaWYgYW5cbiAgLy8gaW5zZXJ0IGhhcHBlbmVkLCAnaW5zZXJ0ZWRJZCcuXG4gIC8vXG4gIC8vIE90aGVyd2lzZSwgdGhlIHNlbWFudGljcyBhcmUgZXhhY3RseSBsaWtlIG90aGVyIG1ldGhvZHM6IHRoZXkgdGFrZVxuICAvLyBhIGNhbGxiYWNrIGFzIGFuIG9wdGlvbmFsIGxhc3QgYXJndW1lbnQ7IGlmIG5vIGNhbGxiYWNrIGlzXG4gIC8vIHByb3ZpZGVkLCB0aGV5IGJsb2NrIHVudGlsIHRoZSBvcGVyYXRpb24gaXMgY29tcGxldGUsIGFuZCB0aHJvdyBhblxuICAvLyBleGNlcHRpb24gaWYgaXQgZmFpbHM7IGlmIGEgY2FsbGJhY2sgaXMgcHJvdmlkZWQsIHRoZW4gdGhleSBkb24ndFxuICAvLyBuZWNlc3NhcmlseSBibG9jaywgYW5kIHRoZXkgY2FsbCB0aGUgY2FsbGJhY2sgd2hlbiB0aGV5IGZpbmlzaCB3aXRoIGVycm9yIGFuZFxuICAvLyByZXN1bHQgYXJndW1lbnRzLiAgKFRoZSBpbnNlcnQgbWV0aG9kIHByb3ZpZGVzIHRoZSBkb2N1bWVudCBJRCBhcyBpdHMgcmVzdWx0O1xuICAvLyB1cGRhdGUgYW5kIHJlbW92ZSBwcm92aWRlIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWQgZG9jcyBhcyB0aGUgcmVzdWx0OyB1cHNlcnRcbiAgLy8gcHJvdmlkZXMgYW4gb2JqZWN0IHdpdGggbnVtYmVyQWZmZWN0ZWQgYW5kIG1heWJlIGluc2VydGVkSWQuKVxuICAvL1xuICAvLyBPbiB0aGUgY2xpZW50LCBibG9ja2luZyBpcyBpbXBvc3NpYmxlLCBzbyBpZiBhIGNhbGxiYWNrXG4gIC8vIGlzbid0IHByb3ZpZGVkLCB0aGV5IGp1c3QgcmV0dXJuIGltbWVkaWF0ZWx5IGFuZCBhbnkgZXJyb3JcbiAgLy8gaW5mb3JtYXRpb24gaXMgbG9zdC5cbiAgLy9cbiAgLy8gVGhlcmUncyBvbmUgbW9yZSB0d2Vhay4gT24gdGhlIGNsaWVudCwgaWYgeW91IGRvbid0IHByb3ZpZGUgYVxuICAvLyBjYWxsYmFjaywgdGhlbiBpZiB0aGVyZSBpcyBhbiBlcnJvciwgYSBtZXNzYWdlIHdpbGwgYmUgbG9nZ2VkIHdpdGhcbiAgLy8gTWV0ZW9yLl9kZWJ1Zy5cbiAgLy9cbiAgLy8gVGhlIGludGVudCAodGhvdWdoIHRoaXMgaXMgYWN0dWFsbHkgZGV0ZXJtaW5lZCBieSB0aGUgdW5kZXJseWluZ1xuICAvLyBkcml2ZXJzKSBpcyB0aGF0IHRoZSBvcGVyYXRpb25zIHNob3VsZCBiZSBkb25lIHN5bmNocm9ub3VzbHksIG5vdFxuICAvLyBnZW5lcmF0aW5nIHRoZWlyIHJlc3VsdCB1bnRpbCB0aGUgZGF0YWJhc2UgaGFzIGFja25vd2xlZGdlZFxuICAvLyB0aGVtLiBJbiB0aGUgZnV0dXJlIG1heWJlIHdlIHNob3VsZCBwcm92aWRlIGEgZmxhZyB0byB0dXJuIHRoaXNcbiAgLy8gb2ZmLlxuXG4gIF9pbnNlcnQoZG9jLCBjYWxsYmFjaykge1xuICAgIC8vIE1ha2Ugc3VyZSB3ZSB3ZXJlIHBhc3NlZCBhIGRvY3VtZW50IHRvIGluc2VydFxuICAgIGlmICghZG9jKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2luc2VydCByZXF1aXJlcyBhbiBhcmd1bWVudCcpO1xuICAgIH1cblxuXG4gICAgLy8gTWFrZSBhIHNoYWxsb3cgY2xvbmUgb2YgdGhlIGRvY3VtZW50LCBwcmVzZXJ2aW5nIGl0cyBwcm90b3R5cGUuXG4gICAgZG9jID0gT2JqZWN0LmNyZWF0ZShcbiAgICAgIE9iamVjdC5nZXRQcm90b3R5cGVPZihkb2MpLFxuICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcnMoZG9jKVxuICAgICk7XG5cbiAgICBpZiAoJ19pZCcgaW4gZG9jKSB7XG4gICAgICBpZiAoXG4gICAgICAgICFkb2MuX2lkIHx8XG4gICAgICAgICEodHlwZW9mIGRvYy5faWQgPT09ICdzdHJpbmcnIHx8IGRvYy5faWQgaW5zdGFuY2VvZiBNb25nby5PYmplY3RJRClcbiAgICAgICkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgJ01ldGVvciByZXF1aXJlcyBkb2N1bWVudCBfaWQgZmllbGRzIHRvIGJlIG5vbi1lbXB0eSBzdHJpbmdzIG9yIE9iamVjdElEcydcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGdlbmVyYXRlSWQgPSB0cnVlO1xuXG4gICAgICAvLyBEb24ndCBnZW5lcmF0ZSB0aGUgaWQgaWYgd2UncmUgdGhlIGNsaWVudCBhbmQgdGhlICdvdXRlcm1vc3QnIGNhbGxcbiAgICAgIC8vIFRoaXMgb3B0aW1pemF0aW9uIHNhdmVzIHVzIHBhc3NpbmcgYm90aCB0aGUgcmFuZG9tU2VlZCBhbmQgdGhlIGlkXG4gICAgICAvLyBQYXNzaW5nIGJvdGggaXMgcmVkdW5kYW50LlxuICAgICAgaWYgKHRoaXMuX2lzUmVtb3RlQ29sbGVjdGlvbigpKSB7XG4gICAgICAgIGNvbnN0IGVuY2xvc2luZyA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCk7XG4gICAgICAgIGlmICghZW5jbG9zaW5nKSB7XG4gICAgICAgICAgZ2VuZXJhdGVJZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChnZW5lcmF0ZUlkKSB7XG4gICAgICAgIGRvYy5faWQgPSB0aGlzLl9tYWtlTmV3SUQoKTtcbiAgICAgIH1cbiAgICB9XG5cblxuICAgIC8vIE9uIGluc2VydHMsIGFsd2F5cyByZXR1cm4gdGhlIGlkIHRoYXQgd2UgZ2VuZXJhdGVkOyBvbiBhbGwgb3RoZXJcbiAgICAvLyBvcGVyYXRpb25zLCBqdXN0IHJldHVybiB0aGUgcmVzdWx0IGZyb20gdGhlIGNvbGxlY3Rpb24uXG4gICAgdmFyIGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQgPSBmdW5jdGlvbihyZXN1bHQpIHtcbiAgICAgIGlmIChNZXRlb3IuX2lzUHJvbWlzZShyZXN1bHQpKSByZXR1cm4gcmVzdWx0O1xuXG4gICAgICBpZiAoZG9jLl9pZCkge1xuICAgICAgICByZXR1cm4gZG9jLl9pZDtcbiAgICAgIH1cblxuICAgICAgLy8gWFhYIHdoYXQgaXMgdGhpcyBmb3I/P1xuICAgICAgLy8gSXQncyBzb21lIGl0ZXJhY3Rpb24gYmV0d2VlbiB0aGUgY2FsbGJhY2sgdG8gX2NhbGxNdXRhdG9yTWV0aG9kIGFuZFxuICAgICAgLy8gdGhlIHJldHVybiB2YWx1ZSBjb252ZXJzaW9uXG4gICAgICBkb2MuX2lkID0gcmVzdWx0O1xuXG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH07XG5cbiAgICBjb25zdCB3cmFwcGVkQ2FsbGJhY2sgPSB3cmFwQ2FsbGJhY2soXG4gICAgICBjYWxsYmFjayxcbiAgICAgIGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHRcbiAgICApO1xuXG4gICAgaWYgKHRoaXMuX2lzUmVtb3RlQ29sbGVjdGlvbigpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZCgnaW5zZXJ0JywgW2RvY10sIHdyYXBwZWRDYWxsYmFjayk7XG4gICAgICByZXR1cm4gY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdChyZXN1bHQpO1xuICAgIH1cblxuICAgIC8vIGl0J3MgbXkgY29sbGVjdGlvbi4gIGRlc2NlbmQgaW50byB0aGUgY29sbGVjdGlvbiBvYmplY3RcbiAgICAvLyBhbmQgcHJvcGFnYXRlIGFueSBleGNlcHRpb24uXG4gICAgdHJ5IHtcbiAgICAgIC8vIElmIHRoZSB1c2VyIHByb3ZpZGVkIGEgY2FsbGJhY2sgYW5kIHRoZSBjb2xsZWN0aW9uIGltcGxlbWVudHMgdGhpc1xuICAgICAgLy8gb3BlcmF0aW9uIGFzeW5jaHJvbm91c2x5LCB0aGVuIHF1ZXJ5UmV0IHdpbGwgYmUgdW5kZWZpbmVkLCBhbmQgdGhlXG4gICAgICAvLyByZXN1bHQgd2lsbCBiZSByZXR1cm5lZCB0aHJvdWdoIHRoZSBjYWxsYmFjayBpbnN0ZWFkLlxuICAgICAgbGV0IHJlc3VsdDtcbiAgICAgIGlmICghIXdyYXBwZWRDYWxsYmFjaykge1xuICAgICAgICB0aGlzLl9jb2xsZWN0aW9uLmluc2VydChkb2MsIHdyYXBwZWRDYWxsYmFjayk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJZiB3ZSBkb24ndCBoYXZlIHRoZSBjYWxsYmFjaywgd2UgYXNzdW1lIHRoZSB1c2VyIGlzIHVzaW5nIHRoZSBwcm9taXNlLlxuICAgICAgICAvLyBXZSBjYW4ndCBqdXN0IHBhc3MgdGhpcy5fY29sbGVjdGlvbi5pbnNlcnQgdG8gdGhlIHByb21pc2lmeSBiZWNhdXNlIGl0IHdvdWxkIGxvc2UgdGhlIGNvbnRleHQuXG4gICAgICAgIHJlc3VsdCA9IHRoaXMuX2NvbGxlY3Rpb24uaW5zZXJ0KGRvYyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0KHJlc3VsdCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBJbnNlcnQgYSBkb2N1bWVudCBpbiB0aGUgY29sbGVjdGlvbi4gIFJldHVybnMgaXRzIHVuaXF1ZSBfaWQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kICBpbnNlcnRcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBkb2MgVGhlIGRvY3VtZW50IHRvIGluc2VydC4gTWF5IG5vdCB5ZXQgaGF2ZSBhbiBfaWQgYXR0cmlidXRlLCBpbiB3aGljaCBjYXNlIE1ldGVvciB3aWxsIGdlbmVyYXRlIG9uZSBmb3IgeW91LlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIE9wdGlvbmFsLiAgSWYgcHJlc2VudCwgY2FsbGVkIHdpdGggYW4gZXJyb3Igb2JqZWN0IGFzIHRoZSBmaXJzdCBhcmd1bWVudCBhbmQsIGlmIG5vIGVycm9yLCB0aGUgX2lkIGFzIHRoZSBzZWNvbmQuXG4gICAqL1xuICBpbnNlcnQoZG9jLCBjYWxsYmFjaykge1xuICAgIHJldHVybiB0aGlzLl9pbnNlcnQoZG9jLCBjYWxsYmFjayk7XG4gIH0sXG5cbiAgX2luc2VydEFzeW5jKGRvYywgb3B0aW9ucyA9IHt9KSB7XG4gICAgLy8gTWFrZSBzdXJlIHdlIHdlcmUgcGFzc2VkIGEgZG9jdW1lbnQgdG8gaW5zZXJ0XG4gICAgaWYgKCFkb2MpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW5zZXJ0IHJlcXVpcmVzIGFuIGFyZ3VtZW50Jyk7XG4gICAgfVxuXG4gICAgLy8gTWFrZSBhIHNoYWxsb3cgY2xvbmUgb2YgdGhlIGRvY3VtZW50LCBwcmVzZXJ2aW5nIGl0cyBwcm90b3R5cGUuXG4gICAgZG9jID0gT2JqZWN0LmNyZWF0ZShcbiAgICAgICAgT2JqZWN0LmdldFByb3RvdHlwZU9mKGRvYyksXG4gICAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzKGRvYylcbiAgICApO1xuXG4gICAgaWYgKCdfaWQnIGluIGRvYykge1xuICAgICAgaWYgKFxuICAgICAgICAgICFkb2MuX2lkIHx8XG4gICAgICAgICAgISh0eXBlb2YgZG9jLl9pZCA9PT0gJ3N0cmluZycgfHwgZG9jLl9pZCBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICdNZXRlb3IgcmVxdWlyZXMgZG9jdW1lbnQgX2lkIGZpZWxkcyB0byBiZSBub24tZW1wdHkgc3RyaW5ncyBvciBPYmplY3RJRHMnXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBnZW5lcmF0ZUlkID0gdHJ1ZTtcblxuICAgICAgLy8gRG9uJ3QgZ2VuZXJhdGUgdGhlIGlkIGlmIHdlJ3JlIHRoZSBjbGllbnQgYW5kIHRoZSAnb3V0ZXJtb3N0JyBjYWxsXG4gICAgICAvLyBUaGlzIG9wdGltaXphdGlvbiBzYXZlcyB1cyBwYXNzaW5nIGJvdGggdGhlIHJhbmRvbVNlZWQgYW5kIHRoZSBpZFxuICAgICAgLy8gUGFzc2luZyBib3RoIGlzIHJlZHVuZGFudC5cbiAgICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgICBjb25zdCBlbmNsb3NpbmcgPSBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uLmdldCgpO1xuICAgICAgICBpZiAoIWVuY2xvc2luZykge1xuICAgICAgICAgIGdlbmVyYXRlSWQgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZ2VuZXJhdGVJZCkge1xuICAgICAgICBkb2MuX2lkID0gdGhpcy5fbWFrZU5ld0lEKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gT24gaW5zZXJ0cywgYWx3YXlzIHJldHVybiB0aGUgaWQgdGhhdCB3ZSBnZW5lcmF0ZWQ7IG9uIGFsbCBvdGhlclxuICAgIC8vIG9wZXJhdGlvbnMsIGp1c3QgcmV0dXJuIHRoZSByZXN1bHQgZnJvbSB0aGUgY29sbGVjdGlvbi5cbiAgICB2YXIgY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdCA9IGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgaWYgKE1ldGVvci5faXNQcm9taXNlKHJlc3VsdCkpIHJldHVybiByZXN1bHQ7XG5cbiAgICAgIGlmIChkb2MuX2lkKSB7XG4gICAgICAgIHJldHVybiBkb2MuX2lkO1xuICAgICAgfVxuXG4gICAgICAvLyBYWFggd2hhdCBpcyB0aGlzIGZvcj8/XG4gICAgICAvLyBJdCdzIHNvbWUgaXRlcmFjdGlvbiBiZXR3ZWVuIHRoZSBjYWxsYmFjayB0byBfY2FsbE11dGF0b3JNZXRob2QgYW5kXG4gICAgICAvLyB0aGUgcmV0dXJuIHZhbHVlIGNvbnZlcnNpb25cbiAgICAgIGRvYy5faWQgPSByZXN1bHQ7XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIGlmICh0aGlzLl9pc1JlbW90ZUNvbGxlY3Rpb24oKSkge1xuICAgICAgY29uc3QgcHJvbWlzZSA9IHRoaXMuX2NhbGxNdXRhdG9yTWV0aG9kQXN5bmMoJ2luc2VydEFzeW5jJywgW2RvY10sIG9wdGlvbnMpO1xuICAgICAgcHJvbWlzZS50aGVuKGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQpO1xuICAgICAgcHJvbWlzZS5zdHViUHJvbWlzZSA9IHByb21pc2Uuc3R1YlByb21pc2UudGhlbihjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0KTtcbiAgICAgIHByb21pc2Uuc2VydmVyUHJvbWlzZSA9IHByb21pc2Uuc2VydmVyUHJvbWlzZS50aGVuKGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQpO1xuICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgfVxuXG4gICAgLy8gaXQncyBteSBjb2xsZWN0aW9uLiAgZGVzY2VuZCBpbnRvIHRoZSBjb2xsZWN0aW9uIG9iamVjdFxuICAgIC8vIGFuZCBwcm9wYWdhdGUgYW55IGV4Y2VwdGlvbi5cbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi5pbnNlcnRBc3luYyhkb2MpXG4gICAgICAudGhlbihjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0KTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgSW5zZXJ0IGEgZG9jdW1lbnQgaW4gdGhlIGNvbGxlY3Rpb24uICBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHdpbGwgcmV0dXJuIHRoZSBkb2N1bWVudCdzIHVuaXF1ZSBfaWQgd2hlbiBzb2x2ZWQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kICBpbnNlcnRcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBkb2MgVGhlIGRvY3VtZW50IHRvIGluc2VydC4gTWF5IG5vdCB5ZXQgaGF2ZSBhbiBfaWQgYXR0cmlidXRlLCBpbiB3aGljaCBjYXNlIE1ldGVvciB3aWxsIGdlbmVyYXRlIG9uZSBmb3IgeW91LlxuICAgKi9cbiAgaW5zZXJ0QXN5bmMoZG9jLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMuX2luc2VydEFzeW5jKGRvYywgb3B0aW9ucyk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IE1vZGlmeSBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24uIFJldHVybnMgdGhlIG51bWJlciBvZiBtYXRjaGVkIGRvY3VtZW50cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBkYXRlXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IHNlbGVjdG9yIFNwZWNpZmllcyB3aGljaCBkb2N1bWVudHMgdG8gbW9kaWZ5XG4gICAqIEBwYXJhbSB7TW9uZ29Nb2RpZmllcn0gbW9kaWZpZXIgU3BlY2lmaWVzIGhvdyB0byBtb2RpZnkgdGhlIGRvY3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5tdWx0aSBUcnVlIHRvIG1vZGlmeSBhbGwgbWF0Y2hpbmcgZG9jdW1lbnRzOyBmYWxzZSB0byBvbmx5IG1vZGlmeSBvbmUgb2YgdGhlIG1hdGNoaW5nIGRvY3VtZW50cyAodGhlIGRlZmF1bHQpLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMudXBzZXJ0IFRydWUgdG8gaW5zZXJ0IGEgZG9jdW1lbnQgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnRzIGFyZSBmb3VuZC5cbiAgICogQHBhcmFtIHtBcnJheX0gb3B0aW9ucy5hcnJheUZpbHRlcnMgT3B0aW9uYWwuIFVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBNb25nb0RCIFtmaWx0ZXJlZCBwb3NpdGlvbmFsIG9wZXJhdG9yXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9vcGVyYXRvci91cGRhdGUvcG9zaXRpb25hbC1maWx0ZXJlZC8pIHRvIHNwZWNpZnkgd2hpY2ggZWxlbWVudHMgdG8gbW9kaWZ5IGluIGFuIGFycmF5IGZpZWxkLlxuICAgKi9cbiAgdXBkYXRlQXN5bmMoc2VsZWN0b3IsIG1vZGlmaWVyLCAuLi5vcHRpb25zQW5kQ2FsbGJhY2spIHtcblxuICAgIC8vIFdlJ3ZlIGFscmVhZHkgcG9wcGVkIG9mZiB0aGUgY2FsbGJhY2ssIHNvIHdlIGFyZSBsZWZ0IHdpdGggYW4gYXJyYXlcbiAgICAvLyBvZiBvbmUgb3IgemVybyBpdGVtc1xuICAgIGNvbnN0IG9wdGlvbnMgPSB7IC4uLihvcHRpb25zQW5kQ2FsbGJhY2tbMF0gfHwgbnVsbCkgfTtcbiAgICBsZXQgaW5zZXJ0ZWRJZDtcbiAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnVwc2VydCkge1xuICAgICAgLy8gc2V0IGBpbnNlcnRlZElkYCBpZiBhYnNlbnQuICBgaW5zZXJ0ZWRJZGAgaXMgYSBNZXRlb3IgZXh0ZW5zaW9uLlxuICAgICAgaWYgKG9wdGlvbnMuaW5zZXJ0ZWRJZCkge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgIShcbiAgICAgICAgICAgIHR5cGVvZiBvcHRpb25zLmluc2VydGVkSWQgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgICAgICBvcHRpb25zLmluc2VydGVkSWQgaW5zdGFuY2VvZiBNb25nby5PYmplY3RJRFxuICAgICAgICAgIClcbiAgICAgICAgKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaW5zZXJ0ZWRJZCBtdXN0IGJlIHN0cmluZyBvciBPYmplY3RJRCcpO1xuICAgICAgICBpbnNlcnRlZElkID0gb3B0aW9ucy5pbnNlcnRlZElkO1xuICAgICAgfSBlbHNlIGlmICghc2VsZWN0b3IgfHwgIXNlbGVjdG9yLl9pZCkge1xuICAgICAgICBpbnNlcnRlZElkID0gdGhpcy5fbWFrZU5ld0lEKCk7XG4gICAgICAgIG9wdGlvbnMuZ2VuZXJhdGVkSWQgPSB0cnVlO1xuICAgICAgICBvcHRpb25zLmluc2VydGVkSWQgPSBpbnNlcnRlZElkO1xuICAgICAgfVxuICAgIH1cblxuICAgIHNlbGVjdG9yID0gTW9uZ28uQ29sbGVjdGlvbi5fcmV3cml0ZVNlbGVjdG9yKHNlbGVjdG9yLCB7XG4gICAgICBmYWxsYmFja0lkOiBpbnNlcnRlZElkLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMuX2lzUmVtb3RlQ29sbGVjdGlvbigpKSB7XG4gICAgICBjb25zdCBhcmdzID0gW3NlbGVjdG9yLCBtb2RpZmllciwgb3B0aW9uc107XG5cbiAgICAgIHJldHVybiB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZEFzeW5jKCd1cGRhdGVBc3luYycsIGFyZ3MsIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIGl0J3MgbXkgY29sbGVjdGlvbi4gIGRlc2NlbmQgaW50byB0aGUgY29sbGVjdGlvbiBvYmplY3RcbiAgICAvLyBhbmQgcHJvcGFnYXRlIGFueSBleGNlcHRpb24uXG4gICAgICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhIGNhbGxiYWNrIGFuZCB0aGUgY29sbGVjdGlvbiBpbXBsZW1lbnRzIHRoaXNcbiAgICAgIC8vIG9wZXJhdGlvbiBhc3luY2hyb25vdXNseSwgdGhlbiBxdWVyeVJldCB3aWxsIGJlIHVuZGVmaW5lZCwgYW5kIHRoZVxuICAgICAgLy8gcmVzdWx0IHdpbGwgYmUgcmV0dXJuZWQgdGhyb3VnaCB0aGUgY2FsbGJhY2sgaW5zdGVhZC5cblxuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLnVwZGF0ZUFzeW5jKFxuICAgICAgc2VsZWN0b3IsXG4gICAgICBtb2RpZmllcixcbiAgICAgIG9wdGlvbnNcbiAgICApO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBc3luY2hyb25vdXNseSBtb2RpZmllcyBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24uIFJldHVybnMgdGhlIG51bWJlciBvZiBtYXRjaGVkIGRvY3VtZW50cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBkYXRlXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IHNlbGVjdG9yIFNwZWNpZmllcyB3aGljaCBkb2N1bWVudHMgdG8gbW9kaWZ5XG4gICAqIEBwYXJhbSB7TW9uZ29Nb2RpZmllcn0gbW9kaWZpZXIgU3BlY2lmaWVzIGhvdyB0byBtb2RpZnkgdGhlIGRvY3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5tdWx0aSBUcnVlIHRvIG1vZGlmeSBhbGwgbWF0Y2hpbmcgZG9jdW1lbnRzOyBmYWxzZSB0byBvbmx5IG1vZGlmeSBvbmUgb2YgdGhlIG1hdGNoaW5nIGRvY3VtZW50cyAodGhlIGRlZmF1bHQpLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMudXBzZXJ0IFRydWUgdG8gaW5zZXJ0IGEgZG9jdW1lbnQgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnRzIGFyZSBmb3VuZC5cbiAgICogQHBhcmFtIHtBcnJheX0gb3B0aW9ucy5hcnJheUZpbHRlcnMgT3B0aW9uYWwuIFVzZWQgaW4gY29tYmluYXRpb24gd2l0aCBNb25nb0RCIFtmaWx0ZXJlZCBwb3NpdGlvbmFsIG9wZXJhdG9yXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9vcGVyYXRvci91cGRhdGUvcG9zaXRpb25hbC1maWx0ZXJlZC8pIHRvIHNwZWNpZnkgd2hpY2ggZWxlbWVudHMgdG8gbW9kaWZ5IGluIGFuIGFycmF5IGZpZWxkLlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdIE9wdGlvbmFsLiAgSWYgcHJlc2VudCwgY2FsbGVkIHdpdGggYW4gZXJyb3Igb2JqZWN0IGFzIHRoZSBmaXJzdCBhcmd1bWVudCBhbmQsIGlmIG5vIGVycm9yLCB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIGRvY3VtZW50cyBhcyB0aGUgc2Vjb25kLlxuICAgKi9cbiAgdXBkYXRlKHNlbGVjdG9yLCBtb2RpZmllciwgLi4ub3B0aW9uc0FuZENhbGxiYWNrKSB7XG4gICAgY29uc3QgY2FsbGJhY2sgPSBwb3BDYWxsYmFja0Zyb21BcmdzKG9wdGlvbnNBbmRDYWxsYmFjayk7XG5cbiAgICAvLyBXZSd2ZSBhbHJlYWR5IHBvcHBlZCBvZmYgdGhlIGNhbGxiYWNrLCBzbyB3ZSBhcmUgbGVmdCB3aXRoIGFuIGFycmF5XG4gICAgLy8gb2Ygb25lIG9yIHplcm8gaXRlbXNcbiAgICBjb25zdCBvcHRpb25zID0geyAuLi4ob3B0aW9uc0FuZENhbGxiYWNrWzBdIHx8IG51bGwpIH07XG4gICAgbGV0IGluc2VydGVkSWQ7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy51cHNlcnQpIHtcbiAgICAgIC8vIHNldCBgaW5zZXJ0ZWRJZGAgaWYgYWJzZW50LiAgYGluc2VydGVkSWRgIGlzIGEgTWV0ZW9yIGV4dGVuc2lvbi5cbiAgICAgIGlmIChvcHRpb25zLmluc2VydGVkSWQpIHtcbiAgICAgICAgaWYgKFxuICAgICAgICAgICEoXG4gICAgICAgICAgICB0eXBlb2Ygb3B0aW9ucy5pbnNlcnRlZElkID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgICAgb3B0aW9ucy5pbnNlcnRlZElkIGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SURcbiAgICAgICAgICApXG4gICAgICAgIClcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2luc2VydGVkSWQgbXVzdCBiZSBzdHJpbmcgb3IgT2JqZWN0SUQnKTtcbiAgICAgICAgaW5zZXJ0ZWRJZCA9IG9wdGlvbnMuaW5zZXJ0ZWRJZDtcbiAgICAgIH0gZWxzZSBpZiAoIXNlbGVjdG9yIHx8ICFzZWxlY3Rvci5faWQpIHtcbiAgICAgICAgaW5zZXJ0ZWRJZCA9IHRoaXMuX21ha2VOZXdJRCgpO1xuICAgICAgICBvcHRpb25zLmdlbmVyYXRlZElkID0gdHJ1ZTtcbiAgICAgICAgb3B0aW9ucy5pbnNlcnRlZElkID0gaW5zZXJ0ZWRJZDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBzZWxlY3RvciA9IE1vbmdvLkNvbGxlY3Rpb24uX3Jld3JpdGVTZWxlY3RvcihzZWxlY3Rvciwge1xuICAgICAgZmFsbGJhY2tJZDogaW5zZXJ0ZWRJZCxcbiAgICB9KTtcblxuICAgIGNvbnN0IHdyYXBwZWRDYWxsYmFjayA9IHdyYXBDYWxsYmFjayhjYWxsYmFjayk7XG5cbiAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgIGNvbnN0IGFyZ3MgPSBbc2VsZWN0b3IsIG1vZGlmaWVyLCBvcHRpb25zXTtcblxuICAgICAgcmV0dXJuIHRoaXMuX2NhbGxNdXRhdG9yTWV0aG9kKCd1cGRhdGUnLCBhcmdzKTtcbiAgICB9XG5cbiAgICAvLyBpdCdzIG15IGNvbGxlY3Rpb24uICBkZXNjZW5kIGludG8gdGhlIGNvbGxlY3Rpb24gb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgIC8vIElmIHRoZSB1c2VyIHByb3ZpZGVkIGEgY2FsbGJhY2sgYW5kIHRoZSBjb2xsZWN0aW9uIGltcGxlbWVudHMgdGhpc1xuICAgIC8vIG9wZXJhdGlvbiBhc3luY2hyb25vdXNseSwgdGhlbiBxdWVyeVJldCB3aWxsIGJlIHVuZGVmaW5lZCwgYW5kIHRoZVxuICAgIC8vIHJlc3VsdCB3aWxsIGJlIHJldHVybmVkIHRocm91Z2ggdGhlIGNhbGxiYWNrIGluc3RlYWQuXG4gICAgLy9jb25zb2xlLmxvZyh7Y2FsbGJhY2ssIG9wdGlvbnMsIHNlbGVjdG9yLCBtb2RpZmllciwgY29sbDogdGhpcy5fY29sbGVjdGlvbn0pO1xuICAgIHRyeSB7XG4gICAgICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhIGNhbGxiYWNrIGFuZCB0aGUgY29sbGVjdGlvbiBpbXBsZW1lbnRzIHRoaXNcbiAgICAgIC8vIG9wZXJhdGlvbiBhc3luY2hyb25vdXNseSwgdGhlbiBxdWVyeVJldCB3aWxsIGJlIHVuZGVmaW5lZCwgYW5kIHRoZVxuICAgICAgLy8gcmVzdWx0IHdpbGwgYmUgcmV0dXJuZWQgdGhyb3VnaCB0aGUgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLnVwZGF0ZShcbiAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgIG1vZGlmaWVyLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICB3cmFwcGVkQ2FsbGJhY2tcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBc3luY2hyb25vdXNseSByZW1vdmVzIGRvY3VtZW50cyBmcm9tIHRoZSBjb2xsZWN0aW9uLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCByZW1vdmVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byByZW1vdmVcbiAgICovXG4gIHJlbW92ZUFzeW5jKHNlbGVjdG9yLCBvcHRpb25zID0ge30pIHtcbiAgICBzZWxlY3RvciA9IE1vbmdvLkNvbGxlY3Rpb24uX3Jld3JpdGVTZWxlY3RvcihzZWxlY3Rvcik7XG5cbiAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZEFzeW5jKCdyZW1vdmVBc3luYycsIFtzZWxlY3Rvcl0sIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIGl0J3MgbXkgY29sbGVjdGlvbi4gIGRlc2NlbmQgaW50byB0aGUgY29sbGVjdGlvbjEgb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLnJlbW92ZUFzeW5jKHNlbGVjdG9yKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVtb3ZlIGRvY3VtZW50cyBmcm9tIHRoZSBjb2xsZWN0aW9uXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHJlbW92ZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBzZWxlY3RvciBTcGVjaWZpZXMgd2hpY2ggZG9jdW1lbnRzIHRvIHJlbW92ZVxuICAgKi9cbiAgcmVtb3ZlKHNlbGVjdG9yKSB7XG4gICAgc2VsZWN0b3IgPSBNb25nby5Db2xsZWN0aW9uLl9yZXdyaXRlU2VsZWN0b3Ioc2VsZWN0b3IpO1xuXG4gICAgaWYgKHRoaXMuX2lzUmVtb3RlQ29sbGVjdGlvbigpKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FsbE11dGF0b3JNZXRob2QoJ3JlbW92ZScsIFtzZWxlY3Rvcl0pO1xuICAgIH1cblxuXG4gICAgLy8gaXQncyBteSBjb2xsZWN0aW9uLiAgZGVzY2VuZCBpbnRvIHRoZSBjb2xsZWN0aW9uMSBvYmplY3RcbiAgICAvLyBhbmQgcHJvcGFnYXRlIGFueSBleGNlcHRpb24uXG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24ucmVtb3ZlKHNlbGVjdG9yKTtcbiAgfSxcblxuXG4gIC8vIERldGVybWluZSBpZiB0aGlzIGNvbGxlY3Rpb24gaXMgc2ltcGx5IGEgbWluaW1vbmdvIHJlcHJlc2VudGF0aW9uIG9mIGEgcmVhbFxuICAvLyBkYXRhYmFzZSBvbiBhbm90aGVyIHNlcnZlclxuICBfaXNSZW1vdGVDb2xsZWN0aW9uKCkge1xuICAgIC8vIFhYWCBzZWUgI01ldGVvclNlcnZlck51bGxcbiAgICByZXR1cm4gdGhpcy5fY29ubmVjdGlvbiAmJiB0aGlzLl9jb25uZWN0aW9uICE9PSBNZXRlb3Iuc2VydmVyO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBc3luY2hyb25vdXNseSBtb2RpZmllcyBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24sIG9yIGluc2VydCBvbmUgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnRzIHdlcmUgZm91bmQuIFJldHVybnMgYW4gb2JqZWN0IHdpdGgga2V5cyBgbnVtYmVyQWZmZWN0ZWRgICh0aGUgbnVtYmVyIG9mIGRvY3VtZW50cyBtb2RpZmllZCkgIGFuZCBgaW5zZXJ0ZWRJZGAgKHRoZSB1bmlxdWUgX2lkIG9mIHRoZSBkb2N1bWVudCB0aGF0IHdhcyBpbnNlcnRlZCwgaWYgYW55KS5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBzZXJ0XG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IHNlbGVjdG9yIFNwZWNpZmllcyB3aGljaCBkb2N1bWVudHMgdG8gbW9kaWZ5XG4gICAqIEBwYXJhbSB7TW9uZ29Nb2RpZmllcn0gbW9kaWZpZXIgU3BlY2lmaWVzIGhvdyB0byBtb2RpZnkgdGhlIGRvY3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5tdWx0aSBUcnVlIHRvIG1vZGlmeSBhbGwgbWF0Y2hpbmcgZG9jdW1lbnRzOyBmYWxzZSB0byBvbmx5IG1vZGlmeSBvbmUgb2YgdGhlIG1hdGNoaW5nIGRvY3VtZW50cyAodGhlIGRlZmF1bHQpLlxuICAgKi9cbiAgICBhc3luYyB1cHNlcnRBc3luYyhzZWxlY3RvciwgbW9kaWZpZXIsIG9wdGlvbnMpIHtcbiAgICAgIHJldHVybiB0aGlzLnVwZGF0ZUFzeW5jKFxuICAgICAgICBzZWxlY3RvcixcbiAgICAgICAgbW9kaWZpZXIsXG4gICAgICAgIHtcbiAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgIF9yZXR1cm5PYmplY3Q6IHRydWUsXG4gICAgICAgICAgdXBzZXJ0OiB0cnVlLFxuICAgICAgICB9KTtcbiAgICB9LFxuXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFzeW5jaHJvbm91c2x5IG1vZGlmaWVzIG9uZSBvciBtb3JlIGRvY3VtZW50cyBpbiB0aGUgY29sbGVjdGlvbiwgb3IgaW5zZXJ0IG9uZSBpZiBubyBtYXRjaGluZyBkb2N1bWVudHMgd2VyZSBmb3VuZC4gUmV0dXJucyBhbiBvYmplY3Qgd2l0aCBrZXlzIGBudW1iZXJBZmZlY3RlZGAgKHRoZSBudW1iZXIgb2YgZG9jdW1lbnRzIG1vZGlmaWVkKSAgYW5kIGBpbnNlcnRlZElkYCAodGhlIHVuaXF1ZSBfaWQgb2YgdGhlIGRvY3VtZW50IHRoYXQgd2FzIGluc2VydGVkLCBpZiBhbnkpLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCB1cHNlcnRcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byBtb2RpZnlcbiAgICogQHBhcmFtIHtNb25nb01vZGlmaWVyfSBtb2RpZmllciBTcGVjaWZpZXMgaG93IHRvIG1vZGlmeSB0aGUgZG9jdW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm11bHRpIFRydWUgdG8gbW9kaWZ5IGFsbCBtYXRjaGluZyBkb2N1bWVudHM7IGZhbHNlIHRvIG9ubHkgbW9kaWZ5IG9uZSBvZiB0aGUgbWF0Y2hpbmcgZG9jdW1lbnRzICh0aGUgZGVmYXVsdCkuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gT3B0aW9uYWwuICBJZiBwcmVzZW50LCBjYWxsZWQgd2l0aCBhbiBlcnJvciBvYmplY3QgYXMgdGhlIGZpcnN0IGFyZ3VtZW50IGFuZCwgaWYgbm8gZXJyb3IsIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWQgZG9jdW1lbnRzIGFzIHRoZSBzZWNvbmQuXG4gICAqL1xuICB1cHNlcnQoc2VsZWN0b3IsIG1vZGlmaWVyLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGlmICghY2FsbGJhY2sgJiYgdHlwZW9mIG9wdGlvbnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy51cGRhdGUoXG4gICAgICBzZWxlY3RvcixcbiAgICAgIG1vZGlmaWVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBfcmV0dXJuT2JqZWN0OiB0cnVlLFxuICAgICAgICB1cHNlcnQ6IHRydWUsXG4gICAgICB9KTtcbiAgfSxcblxuICAvLyBXZSdsbCBhY3R1YWxseSBkZXNpZ24gYW4gaW5kZXggQVBJIGxhdGVyLiBGb3Igbm93LCB3ZSBqdXN0IHBhc3MgdGhyb3VnaCB0b1xuICAvLyBNb25nbydzLCBidXQgbWFrZSBpdCBzeW5jaHJvbm91cy5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFzeW5jaHJvbm91c2x5IGNyZWF0ZXMgdGhlIHNwZWNpZmllZCBpbmRleCBvbiB0aGUgY29sbGVjdGlvbi5cbiAgICogQGxvY3VzIHNlcnZlclxuICAgKiBAbWV0aG9kIGVuc3VyZUluZGV4QXN5bmNcbiAgICogQGRlcHJlY2F0ZWQgaW4gMy4wXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gaW5kZXggQSBkb2N1bWVudCB0aGF0IGNvbnRhaW5zIHRoZSBmaWVsZCBhbmQgdmFsdWUgcGFpcnMgd2hlcmUgdGhlIGZpZWxkIGlzIHRoZSBpbmRleCBrZXkgYW5kIHRoZSB2YWx1ZSBkZXNjcmliZXMgdGhlIHR5cGUgb2YgaW5kZXggZm9yIHRoYXQgZmllbGQuIEZvciBhbiBhc2NlbmRpbmcgaW5kZXggb24gYSBmaWVsZCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAxYDsgZm9yIGRlc2NlbmRpbmcgaW5kZXgsIHNwZWNpZnkgYSB2YWx1ZSBvZiBgLTFgLiBVc2UgYHRleHRgIGZvciB0ZXh0IGluZGV4ZXMuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gQWxsIG9wdGlvbnMgYXJlIGxpc3RlZCBpbiBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9tZXRob2QvZGIuY29sbGVjdGlvbi5jcmVhdGVJbmRleC8jb3B0aW9ucylcbiAgICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMubmFtZSBOYW1lIG9mIHRoZSBpbmRleFxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMudW5pcXVlIERlZmluZSB0aGF0IHRoZSBpbmRleCB2YWx1ZXMgbXVzdCBiZSB1bmlxdWUsIG1vcmUgYXQgW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9jb3JlL2luZGV4LXVuaXF1ZS8pXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5zcGFyc2UgRGVmaW5lIHRoYXQgdGhlIGluZGV4IGlzIHNwYXJzZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtc3BhcnNlLylcbiAgICovXG4gIGFzeW5jIGVuc3VyZUluZGV4QXN5bmMoaW5kZXgsIG9wdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLl9jb2xsZWN0aW9uLmVuc3VyZUluZGV4QXN5bmMgfHwgIXNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXhBc3luYylcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgY2FsbCBjcmVhdGVJbmRleEFzeW5jIG9uIHNlcnZlciBjb2xsZWN0aW9ucycpO1xuICAgIGlmIChzZWxmLl9jb2xsZWN0aW9uLmNyZWF0ZUluZGV4QXN5bmMpIHtcbiAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXhBc3luYyhpbmRleCwgb3B0aW9ucyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGltcG9ydCB7IExvZyB9IGZyb20gJ21ldGVvci9sb2dnaW5nJztcblxuICAgICAgTG9nLmRlYnVnKGBlbnN1cmVJbmRleEFzeW5jIGhhcyBiZWVuIGRlcHJlY2F0ZWQsIHBsZWFzZSB1c2UgdGhlIG5ldyAnY3JlYXRlSW5kZXhBc3luYycgaW5zdGVhZCR7IG9wdGlvbnM/Lm5hbWUgPyBgLCBpbmRleCBuYW1lOiAkeyBvcHRpb25zLm5hbWUgfWAgOiBgLCBpbmRleDogJHsgSlNPTi5zdHJpbmdpZnkoaW5kZXgpIH1gIH1gKVxuICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5lbnN1cmVJbmRleEFzeW5jKGluZGV4LCBvcHRpb25zKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFzeW5jaHJvbm91c2x5IGNyZWF0ZXMgdGhlIHNwZWNpZmllZCBpbmRleCBvbiB0aGUgY29sbGVjdGlvbi5cbiAgICogQGxvY3VzIHNlcnZlclxuICAgKiBAbWV0aG9kIGNyZWF0ZUluZGV4QXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbmRleCBBIGRvY3VtZW50IHRoYXQgY29udGFpbnMgdGhlIGZpZWxkIGFuZCB2YWx1ZSBwYWlycyB3aGVyZSB0aGUgZmllbGQgaXMgdGhlIGluZGV4IGtleSBhbmQgdGhlIHZhbHVlIGRlc2NyaWJlcyB0aGUgdHlwZSBvZiBpbmRleCBmb3IgdGhhdCBmaWVsZC4gRm9yIGFuIGFzY2VuZGluZyBpbmRleCBvbiBhIGZpZWxkLCBzcGVjaWZ5IGEgdmFsdWUgb2YgYDFgOyBmb3IgZGVzY2VuZGluZyBpbmRleCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAtMWAuIFVzZSBgdGV4dGAgZm9yIHRleHQgaW5kZXhlcy5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL21ldGhvZC9kYi5jb2xsZWN0aW9uLmNyZWF0ZUluZGV4LyNvcHRpb25zKVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5uYW1lIE5hbWUgb2YgdGhlIGluZGV4XG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51bmlxdWUgRGVmaW5lIHRoYXQgdGhlIGluZGV4IHZhbHVlcyBtdXN0IGJlIHVuaXF1ZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtdW5pcXVlLylcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnNwYXJzZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggaXMgc3BhcnNlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC1zcGFyc2UvKVxuICAgKi9cbiAgYXN5bmMgY3JlYXRlSW5kZXhBc3luYyhpbmRleCwgb3B0aW9ucykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXhBc3luYylcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2FuIG9ubHkgY2FsbCBjcmVhdGVJbmRleEFzeW5jIG9uIHNlcnZlciBjb2xsZWN0aW9ucycpO1xuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlSW5kZXhBc3luYyhpbmRleCwgb3B0aW9ucyk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKFxuICAgICAgICBlLm1lc3NhZ2UuaW5jbHVkZXMoXG4gICAgICAgICAgJ0FuIGVxdWl2YWxlbnQgaW5kZXggYWxyZWFkeSBleGlzdHMgd2l0aCB0aGUgc2FtZSBuYW1lIGJ1dCBkaWZmZXJlbnQgb3B0aW9ucy4nXG4gICAgICAgICkgJiZcbiAgICAgICAgTWV0ZW9yLnNldHRpbmdzPy5wYWNrYWdlcz8ubW9uZ28/LnJlQ3JlYXRlSW5kZXhPbk9wdGlvbk1pc21hdGNoXG4gICAgICApIHtcbiAgICAgICAgaW1wb3J0IHsgTG9nIH0gZnJvbSAnbWV0ZW9yL2xvZ2dpbmcnO1xuXG4gICAgICAgIExvZy5pbmZvKGBSZS1jcmVhdGluZyBpbmRleCAkeyBpbmRleCB9IGZvciAkeyBzZWxmLl9uYW1lIH0gZHVlIHRvIG9wdGlvbnMgbWlzbWF0Y2guYCk7XG4gICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uZHJvcEluZGV4QXN5bmMoaW5kZXgpO1xuICAgICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmNyZWF0ZUluZGV4QXN5bmMoaW5kZXgsIG9wdGlvbnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihgQW4gZXJyb3Igb2NjdXJyZWQgd2hlbiBjcmVhdGluZyBhbiBpbmRleCBmb3IgY29sbGVjdGlvbiBcIiR7IHNlbGYuX25hbWUgfTogJHsgZS5tZXNzYWdlIH1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFzeW5jaHJvbm91c2x5IGNyZWF0ZXMgdGhlIHNwZWNpZmllZCBpbmRleCBvbiB0aGUgY29sbGVjdGlvbi5cbiAgICogQGxvY3VzIHNlcnZlclxuICAgKiBAbWV0aG9kIGNyZWF0ZUluZGV4XG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gaW5kZXggQSBkb2N1bWVudCB0aGF0IGNvbnRhaW5zIHRoZSBmaWVsZCBhbmQgdmFsdWUgcGFpcnMgd2hlcmUgdGhlIGZpZWxkIGlzIHRoZSBpbmRleCBrZXkgYW5kIHRoZSB2YWx1ZSBkZXNjcmliZXMgdGhlIHR5cGUgb2YgaW5kZXggZm9yIHRoYXQgZmllbGQuIEZvciBhbiBhc2NlbmRpbmcgaW5kZXggb24gYSBmaWVsZCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAxYDsgZm9yIGRlc2NlbmRpbmcgaW5kZXgsIHNwZWNpZnkgYSB2YWx1ZSBvZiBgLTFgLiBVc2UgYHRleHRgIGZvciB0ZXh0IGluZGV4ZXMuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gQWxsIG9wdGlvbnMgYXJlIGxpc3RlZCBpbiBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9tZXRob2QvZGIuY29sbGVjdGlvbi5jcmVhdGVJbmRleC8jb3B0aW9ucylcbiAgICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMubmFtZSBOYW1lIG9mIHRoZSBpbmRleFxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMudW5pcXVlIERlZmluZSB0aGF0IHRoZSBpbmRleCB2YWx1ZXMgbXVzdCBiZSB1bmlxdWUsIG1vcmUgYXQgW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9jb3JlL2luZGV4LXVuaXF1ZS8pXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5zcGFyc2UgRGVmaW5lIHRoYXQgdGhlIGluZGV4IGlzIHNwYXJzZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtc3BhcnNlLylcbiAgICovXG4gIGNyZWF0ZUluZGV4KGluZGV4LCBvcHRpb25zKXtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVJbmRleEFzeW5jKGluZGV4LCBvcHRpb25zKTtcbiAgfSxcblxuICBhc3luYyBkcm9wSW5kZXhBc3luYyhpbmRleCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuX2NvbGxlY3Rpb24uZHJvcEluZGV4QXN5bmMpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgZHJvcEluZGV4QXN5bmMgb24gc2VydmVyIGNvbGxlY3Rpb25zJyk7XG4gICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5kcm9wSW5kZXhBc3luYyhpbmRleCk7XG4gIH0sXG5cbiAgYXN5bmMgZHJvcENvbGxlY3Rpb25Bc3luYygpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLl9jb2xsZWN0aW9uLmRyb3BDb2xsZWN0aW9uQXN5bmMpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgZHJvcENvbGxlY3Rpb25Bc3luYyBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uZHJvcENvbGxlY3Rpb25Bc3luYygpO1xuICB9LFxuXG4gIGFzeW5jIGNyZWF0ZUNhcHBlZENvbGxlY3Rpb25Bc3luYyhieXRlU2l6ZSwgbWF4RG9jdW1lbnRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbkFzeW5jKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnQ2FuIG9ubHkgY2FsbCBjcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMgb24gc2VydmVyIGNvbGxlY3Rpb25zJ1xuICAgICAgKTtcbiAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmNyZWF0ZUNhcHBlZENvbGxlY3Rpb25Bc3luYyhieXRlU2l6ZSwgbWF4RG9jdW1lbnRzKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmV0dXJucyB0aGUgW2BDb2xsZWN0aW9uYF0oaHR0cDovL21vbmdvZGIuZ2l0aHViLmlvL25vZGUtbW9uZ29kYi1uYXRpdmUvMy4wL2FwaS9Db2xsZWN0aW9uLmh0bWwpIG9iamVjdCBjb3JyZXNwb25kaW5nIHRvIHRoaXMgY29sbGVjdGlvbiBmcm9tIHRoZSBbbnBtIGBtb25nb2RiYCBkcml2ZXIgbW9kdWxlXShodHRwczovL3d3dy5ucG1qcy5jb20vcGFja2FnZS9tb25nb2RiKSB3aGljaCBpcyB3cmFwcGVkIGJ5IGBNb25nby5Db2xsZWN0aW9uYC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIHJhd0NvbGxlY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5fY29sbGVjdGlvbi5yYXdDb2xsZWN0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgcmF3Q29sbGVjdGlvbiBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgICB9XG4gICAgcmV0dXJuIHNlbGYuX2NvbGxlY3Rpb24ucmF3Q29sbGVjdGlvbigpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZXR1cm5zIHRoZSBbYERiYF0oaHR0cDovL21vbmdvZGIuZ2l0aHViLmlvL25vZGUtbW9uZ29kYi1uYXRpdmUvMy4wL2FwaS9EYi5odG1sKSBvYmplY3QgY29ycmVzcG9uZGluZyB0byB0aGlzIGNvbGxlY3Rpb24ncyBkYXRhYmFzZSBjb25uZWN0aW9uIGZyb20gdGhlIFtucG0gYG1vbmdvZGJgIGRyaXZlciBtb2R1bGVdKGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL21vbmdvZGIpIHdoaWNoIGlzIHdyYXBwZWQgYnkgYE1vbmdvLkNvbGxlY3Rpb25gLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgcmF3RGF0YWJhc2UoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghKHNlbGYuX2RyaXZlci5tb25nbyAmJiBzZWxmLl9kcml2ZXIubW9uZ28uZGIpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgcmF3RGF0YWJhc2Ugb24gc2VydmVyIGNvbGxlY3Rpb25zJyk7XG4gICAgfVxuICAgIHJldHVybiBzZWxmLl9kcml2ZXIubW9uZ28uZGI7XG4gIH0sXG59KTtcblxuLy8gQ29udmVydCB0aGUgY2FsbGJhY2sgdG8gbm90IHJldHVybiBhIHJlc3VsdCBpZiB0aGVyZSBpcyBhbiBlcnJvclxuZnVuY3Rpb24gd3JhcENhbGxiYWNrKGNhbGxiYWNrLCBjb252ZXJ0UmVzdWx0KSB7XG4gIHJldHVybiAoXG4gICAgY2FsbGJhY2sgJiZcbiAgICBmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyb3IpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29udmVydFJlc3VsdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayhlcnJvciwgY29udmVydFJlc3VsdChyZXN1bHQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgKTtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBDcmVhdGUgYSBNb25nby1zdHlsZSBgT2JqZWN0SURgLiAgSWYgeW91IGRvbid0IHNwZWNpZnkgYSBgaGV4U3RyaW5nYCwgdGhlIGBPYmplY3RJRGAgd2lsbCBnZW5lcmF0ZWQgcmFuZG9tbHkgKG5vdCB1c2luZyBNb25nb0RCJ3MgSUQgY29uc3RydWN0aW9uIHJ1bGVzKS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQGNsYXNzXG4gKiBAcGFyYW0ge1N0cmluZ30gW2hleFN0cmluZ10gT3B0aW9uYWwuICBUaGUgMjQtY2hhcmFjdGVyIGhleGFkZWNpbWFsIGNvbnRlbnRzIG9mIHRoZSBPYmplY3RJRCB0byBjcmVhdGVcbiAqL1xuTW9uZ28uT2JqZWN0SUQgPSBNb25nb0lELk9iamVjdElEO1xuXG4vKipcbiAqIEBzdW1tYXJ5IFRvIGNyZWF0ZSBhIGN1cnNvciwgdXNlIGZpbmQuIFRvIGFjY2VzcyB0aGUgZG9jdW1lbnRzIGluIGEgY3Vyc29yLCB1c2UgZm9yRWFjaCwgbWFwLCBvciBmZXRjaC5cbiAqIEBjbGFzc1xuICogQGluc3RhbmNlTmFtZSBjdXJzb3JcbiAqL1xuTW9uZ28uQ3Vyc29yID0gTG9jYWxDb2xsZWN0aW9uLkN1cnNvcjtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZCBpbiAwLjkuMVxuICovXG5Nb25nby5Db2xsZWN0aW9uLkN1cnNvciA9IE1vbmdvLkN1cnNvcjtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZCBpbiAwLjkuMVxuICovXG5Nb25nby5Db2xsZWN0aW9uLk9iamVjdElEID0gTW9uZ28uT2JqZWN0SUQ7XG5cbi8qKlxuICogQGRlcHJlY2F0ZWQgaW4gMC45LjFcbiAqL1xuTWV0ZW9yLkNvbGxlY3Rpb24gPSBNb25nby5Db2xsZWN0aW9uO1xuXG4vLyBBbGxvdyBkZW55IHN0dWZmIGlzIG5vdyBpbiB0aGUgYWxsb3ctZGVueSBwYWNrYWdlXG5PYmplY3QuYXNzaWduKE1vbmdvLkNvbGxlY3Rpb24ucHJvdG90eXBlLCBBbGxvd0RlbnkuQ29sbGVjdGlvblByb3RvdHlwZSk7XG5cbmZ1bmN0aW9uIHBvcENhbGxiYWNrRnJvbUFyZ3MoYXJncykge1xuICAvLyBQdWxsIG9mZiBhbnkgY2FsbGJhY2sgKG9yIHBlcmhhcHMgYSAnY2FsbGJhY2snIHZhcmlhYmxlIHRoYXQgd2FzIHBhc3NlZFxuICAvLyBpbiB1bmRlZmluZWQsIGxpa2UgaG93ICd1cHNlcnQnIGRvZXMgaXQpLlxuICBpZiAoXG4gICAgYXJncy5sZW5ndGggJiZcbiAgICAoYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSB1bmRlZmluZWQgfHxcbiAgICAgIGFyZ3NbYXJncy5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKVxuICApIHtcbiAgICByZXR1cm4gYXJncy5wb3AoKTtcbiAgfVxufVxuIiwiLyoqXG4gKiBAc3VtbWFyeSBBbGxvd3MgZm9yIHVzZXIgc3BlY2lmaWVkIGNvbm5lY3Rpb24gb3B0aW9uc1xuICogQGV4YW1wbGUgaHR0cDovL21vbmdvZGIuZ2l0aHViLmlvL25vZGUtbW9uZ29kYi1uYXRpdmUvMy4wL3JlZmVyZW5jZS9jb25uZWN0aW5nL2Nvbm5lY3Rpb24tc2V0dGluZ3MvXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBVc2VyIHNwZWNpZmllZCBNb25nbyBjb25uZWN0aW9uIG9wdGlvbnNcbiAqL1xuTW9uZ28uc2V0Q29ubmVjdGlvbk9wdGlvbnMgPSBmdW5jdGlvbiBzZXRDb25uZWN0aW9uT3B0aW9ucyAob3B0aW9ucykge1xuICBjaGVjayhvcHRpb25zLCBPYmplY3QpO1xuICBNb25nby5fY29ubmVjdGlvbk9wdGlvbnMgPSBvcHRpb25zO1xufTsiLCJleHBvcnQgY29uc3Qgbm9ybWFsaXplUHJvamVjdGlvbiA9IG9wdGlvbnMgPT4ge1xuICAvLyB0cmFuc2Zvcm0gZmllbGRzIGtleSBpbiBwcm9qZWN0aW9uXG4gIGNvbnN0IHsgZmllbGRzLCBwcm9qZWN0aW9uLCAuLi5vdGhlck9wdGlvbnMgfSA9IG9wdGlvbnMgfHwge307XG4gIC8vIFRPRE86IGVuYWJsZSB0aGlzIGNvbW1lbnQgd2hlbiBkZXByZWNhdGluZyB0aGUgZmllbGRzIG9wdGlvblxuICAvLyBMb2cuZGVidWcoYGZpZWxkcyBvcHRpb24gaGFzIGJlZW4gZGVwcmVjYXRlZCwgcGxlYXNlIHVzZSB0aGUgbmV3ICdwcm9qZWN0aW9uJyBpbnN0ZWFkYClcblxuICByZXR1cm4ge1xuICAgIC4uLm90aGVyT3B0aW9ucyxcbiAgICAuLi4ocHJvamVjdGlvbiB8fCBmaWVsZHMgPyB7IHByb2plY3Rpb246IGZpZWxkcyB8fCBwcm9qZWN0aW9uIH0gOiB7fSksXG4gIH07XG59O1xuIl19
