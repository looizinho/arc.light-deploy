Package["core-runtime"].queue("reactive-dict", ["meteor", "tracker", "ejson", "ecmascript", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var EJSON = Package.ejson.EJSON;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var value, ReactiveDict;

var require = meteorInstall({"node_modules":{"meteor":{"reactive-dict":{"migration.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/reactive-dict/migration.js                                                                               //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      ReactiveDict: () => ReactiveDict
    });
    let ReactiveDict;
    module.link("./reactive-dict", {
      ReactiveDict(v) {
        ReactiveDict = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const hasOwn = Object.prototype.hasOwnProperty;
    ReactiveDict._migratedDictData = {}; // name -> data
    ReactiveDict._dictsToMigrate = {}; // name -> ReactiveDict

    ReactiveDict._loadMigratedDict = function (dictName) {
      if (hasOwn.call(ReactiveDict._migratedDictData, dictName)) {
        const data = ReactiveDict._migratedDictData[dictName];
        delete ReactiveDict._migratedDictData[dictName];
        return data;
      }
      return null;
    };
    ReactiveDict._registerDictForMigrate = function (dictName, dict) {
      if (hasOwn.call(ReactiveDict._dictsToMigrate, dictName)) throw new Error("Duplicate ReactiveDict name: " + dictName);
      ReactiveDict._dictsToMigrate[dictName] = dict;
    };
    if (Meteor.isClient && Package.reload) {
      // Put old migrated data into ReactiveDict._migratedDictData,
      // where it can be accessed by ReactiveDict._loadMigratedDict.
      var migrationData = Package.reload.Reload._migrationData('reactive-dict');
      if (migrationData && migrationData.dicts) ReactiveDict._migratedDictData = migrationData.dicts;

      // On migration, assemble the data from all the dicts that have been
      // registered.
      Package.reload.Reload._onMigrate('reactive-dict', function () {
        var dictsToMigrate = ReactiveDict._dictsToMigrate;
        var dataToMigrate = {};
        for (var dictName in dictsToMigrate) dataToMigrate[dictName] = dictsToMigrate[dictName]._getMigrationData();
        return [true, {
          dicts: dataToMigrate
        }];
      });
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
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"reactive-dict.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/reactive-dict/reactive-dict.js                                                                           //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
module.export({
  ReactiveDict: () => ReactiveDict
});
const hasOwn = Object.prototype.hasOwnProperty;

// XXX come up with a serialization method which canonicalizes object key
// order, which would allow us to use objects as values for equals.
function stringify(value) {
  if (value === undefined) {
    return 'undefined';
  }
  return EJSON.stringify(value);
}
function parse(serialized) {
  if (serialized === undefined || serialized === 'undefined') {
    return undefined;
  }
  return EJSON.parse(serialized);
}
function changed(v) {
  v && v.changed();
}

// XXX COMPAT WITH 0.9.1 : accept migrationData instead of dictName
/**
 * @class
 * @instanceName ReactiveDict
 * @summary Constructor for a ReactiveDict, which represents a reactive dictionary of key/value pairs.
 * @locus Client
 * @param {String} [name] Optional.  When a name is passed, preserves contents across Hot Code Pushes
 * @param {Object} [initialValue] Optional.  The default values for the dictionary
 */
class ReactiveDict {
  constructor(dictName, dictData) {
    // this.keys: key -> value
    this.keys = {};
    if (dictName) {
      // name given; migration will be performed
      if (typeof dictName === 'string') {
        // the normal case, argument is a string name.

        // Only run migration logic on client, it will cause
        // duplicate name errors on server during reloads.
        // _registerDictForMigrate will throw an error on duplicate name.
        Meteor.isClient && ReactiveDict._registerDictForMigrate(dictName, this);
        const migratedData = Meteor.isClient && ReactiveDict._loadMigratedDict(dictName);
        if (migratedData) {
          // Don't stringify migrated data
          this.keys = migratedData;
        } else {
          // Use _setObject to make sure values are stringified
          this._setObject(dictData || {});
        }
        this.name = dictName;
      } else if (typeof dictName === 'object') {
        // back-compat case: dictName is actually migrationData
        // Use _setObject to make sure values are stringified
        this._setObject(dictName);
      } else {
        throw new Error("Invalid ReactiveDict argument: " + dictName);
      }
    } else if (typeof dictData === 'object') {
      this._setObject(dictData);
    }
    this.allDeps = new Tracker.Dependency();
    this.keyDeps = {}; // key -> Dependency
    this.keyValueDeps = {}; // key -> Dependency
  }

  // set() began as a key/value method, but we are now overloading it
  // to take an object of key/value pairs, similar to backbone
  // http://backbonejs.org/#Model-set
  /**
   * @summary Set a value for a key in the ReactiveDict. Notify any listeners
   * that the value has changed (eg: redraw templates, and rerun any
   * [`Tracker.autorun`](#tracker_autorun) computations, that called
   * [`ReactiveDict.get`](#ReactiveDict_get) on this `key`.)
   * @locus Client
   * @param {String} key The key to set, eg, `selectedItem`
   * @param {EJSONable | undefined} value The new value for `key`
   */
  set(keyOrObject, value) {
    if (typeof keyOrObject === 'object' && value === undefined) {
      // Called as `dict.set({...})`
      this._setObject(keyOrObject);
      return;
    }
    // the input isn't an object, so it must be a key
    // and we resume with the rest of the function
    const key = keyOrObject;
    value = stringify(value);
    const keyExisted = hasOwn.call(this.keys, key);
    const oldSerializedValue = keyExisted ? this.keys[key] : 'undefined';
    const isNewValue = value !== oldSerializedValue;
    this.keys[key] = value;
    if (isNewValue || !keyExisted) {
      // Using the changed utility function here because this.allDeps might not exist yet,
      // when setting initial data from constructor
      changed(this.allDeps);
    }

    // Don't trigger changes when setting initial data from constructor,
    // this.KeyDeps is undefined in this case
    if (isNewValue && this.keyDeps) {
      changed(this.keyDeps[key]);
      if (this.keyValueDeps[key]) {
        changed(this.keyValueDeps[key][oldSerializedValue]);
        changed(this.keyValueDeps[key][value]);
      }
    }
  }

  /**
   * @summary Set a value for a key if it hasn't been set before.
   * Otherwise works exactly the same as [`ReactiveDict.set`](#ReactiveDict-set).
   * @locus Client
   * @param {String} key The key to set, eg, `selectedItem`
   * @param {EJSONable | undefined} value The new value for `key`
   */
  setDefault(keyOrObject, value) {
    if (typeof keyOrObject === 'object' && value === undefined) {
      // Called as `dict.setDefault({...})`
      this._setDefaultObject(keyOrObject);
      return;
    }
    // the input isn't an object, so it must be a key
    // and we resume with the rest of the function
    const key = keyOrObject;
    if (!hasOwn.call(this.keys, key)) {
      this.set(key, value);
    }
  }

  /**
   * @summary Get the value assiciated with a key. If inside a [reactive
   * computation](#reactivity), invalidate the computation the next time the
   * value associated with this key is changed by
   * [`ReactiveDict.set`](#ReactiveDict-set).
   * This returns a clone of the value, so if it's an object or an array,
   * mutating the returned value has no effect on the value stored in the
   * ReactiveDict.
   * @locus Client
   * @param {String} key The key of the element to return
   */
  get(key) {
    this._ensureKey(key);
    this.keyDeps[key].depend();
    return parse(this.keys[key]);
  }

  /**
   * @summary Test if the stored entry for a key is equal to a value. If inside a
   * [reactive computation](#reactivity), invalidate the computation the next
   * time the variable changes to or from the value.
   * @locus Client
   * @param {String} key The name of the session variable to test
   * @param {String | Number | Boolean | null | undefined} value The value to
   * test against
   */
  equals(key, value) {
    // Mongo.ObjectID is in the 'mongo' package
    let ObjectID = null;
    if (Package.mongo) {
      ObjectID = Package.mongo.Mongo.ObjectID;
    }
    // We don't allow objects (or arrays that might include objects) for
    // .equals, because JSON.stringify doesn't canonicalize object key
    // order. (We can make equals have the right return value by parsing the
    // current value and using EJSON.equals, but we won't have a canonical
    // element of keyValueDeps[key] to store the dependency.) You can still use
    // "EJSON.equals(reactiveDict.get(key), value)".
    //
    // XXX we could allow arrays as long as we recursively check that there
    // are no objects
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean' && typeof value !== 'undefined' && !(value instanceof Date) && !(ObjectID && value instanceof ObjectID) && value !== null) {
      throw new Error("ReactiveDict.equals: value must be scalar");
    }
    const serializedValue = stringify(value);
    if (Tracker.active) {
      this._ensureKey(key);
      if (!hasOwn.call(this.keyValueDeps[key], serializedValue)) {
        this.keyValueDeps[key][serializedValue] = new Tracker.Dependency();
      }
      var isNew = this.keyValueDeps[key][serializedValue].depend();
      if (isNew) {
        Tracker.onInvalidate(() => {
          // clean up [key][serializedValue] if it's now empty, so we don't
          // use O(n) memory for n = values seen ever
          if (!this.keyValueDeps[key][serializedValue].hasDependents()) {
            delete this.keyValueDeps[key][serializedValue];
          }
        });
      }
    }
    let oldValue = undefined;
    if (hasOwn.call(this.keys, key)) {
      oldValue = parse(this.keys[key]);
    }
    return EJSON.equals(oldValue, value);
  }

  /**
   * @summary Get all key-value pairs as a plain object. If inside a [reactive
   * computation](#reactivity), invalidate the computation the next time the
   * value associated with any key is changed by
   * [`ReactiveDict.set`](#ReactiveDict-set).
   * This returns a clone of each value, so if it's an object or an array,
   * mutating the returned value has no effect on the value stored in the
   * ReactiveDict.
   * @locus Client
   */
  all() {
    this.allDeps.depend();
    let ret = {};
    Object.keys(this.keys).forEach(key => {
      ret[key] = parse(this.keys[key]);
    });
    return ret;
  }

  /**
   * @summary remove all key-value pairs from the ReactiveDict. Notify any
   * listeners that the value has changed (eg: redraw templates, and rerun any
   * [`Tracker.autorun`](#tracker_autorun) computations, that called
   * [`ReactiveDict.get`](#ReactiveDict_get) on this `key`.)
   * @locus Client
   */
  clear() {
    const oldKeys = this.keys;
    this.keys = {};
    this.allDeps.changed();
    Object.keys(oldKeys).forEach(key => {
      changed(this.keyDeps[key]);
      if (this.keyValueDeps[key]) {
        changed(this.keyValueDeps[key][oldKeys[key]]);
        changed(this.keyValueDeps[key]['undefined']);
      }
    });
  }

  /**
   * @summary remove a key-value pair from the ReactiveDict. Notify any listeners
   * that the value has changed (eg: redraw templates, and rerun any
   * [`Tracker.autorun`](#tracker_autorun) computations, that called
   * [`ReactiveDict.get`](#ReactiveDict_get) on this `key`.)
   * @locus Client
   * @param {String} key The key to delete, eg, `selectedItem`
   */
  delete(key) {
    let didRemove = false;
    if (hasOwn.call(this.keys, key)) {
      const oldValue = this.keys[key];
      delete this.keys[key];
      changed(this.keyDeps[key]);
      if (this.keyValueDeps[key]) {
        changed(this.keyValueDeps[key][oldValue]);
        changed(this.keyValueDeps[key]['undefined']);
      }
      this.allDeps.changed();
      didRemove = true;
    }
    return didRemove;
  }

  /**
   * @summary Clear all values from the reactiveDict and prevent it from being
   * migrated on a Hot Code Pushes. Notify any listeners
   * that the value has changed (eg: redraw templates, and rerun any
   * [`Tracker.autorun`](#tracker_autorun) computations, that called
   * [`ReactiveDict.get`](#ReactiveDict_get) on this `key`.)
   * @locus Client
   */
  destroy() {
    this.clear();
    if (this.name && hasOwn.call(ReactiveDict._dictsToMigrate, this.name)) {
      delete ReactiveDict._dictsToMigrate[this.name];
    }
  }
  _setObject(object) {
    Object.keys(object).forEach(key => {
      this.set(key, object[key]);
    });
  }
  _setDefaultObject(object) {
    Object.keys(object).forEach(key => {
      this.setDefault(key, object[key]);
    });
  }
  _ensureKey(key) {
    if (!(key in this.keyDeps)) {
      this.keyDeps[key] = new Tracker.Dependency();
      this.keyValueDeps[key] = {};
    }
  }

  // Get a JSON value that can be passed to the constructor to
  // create a new ReactiveDict with the same contents as this one
  _getMigrationData() {
    // XXX sanitize and make sure it's JSONible?
    return this.keys;
  }
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      ReactiveDict: ReactiveDict
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/reactive-dict/migration.js"
  ],
  mainModulePath: "/node_modules/meteor/reactive-dict/migration.js"
}});

//# sourceURL=meteor://💻app/packages/reactive-dict.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvcmVhY3RpdmUtZGljdC9taWdyYXRpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3JlYWN0aXZlLWRpY3QvcmVhY3RpdmUtZGljdC5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnQiLCJSZWFjdGl2ZURpY3QiLCJsaW5rIiwidiIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiaGFzT3duIiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJfbWlncmF0ZWREaWN0RGF0YSIsIl9kaWN0c1RvTWlncmF0ZSIsIl9sb2FkTWlncmF0ZWREaWN0IiwiZGljdE5hbWUiLCJjYWxsIiwiZGF0YSIsIl9yZWdpc3RlckRpY3RGb3JNaWdyYXRlIiwiZGljdCIsIkVycm9yIiwiTWV0ZW9yIiwiaXNDbGllbnQiLCJQYWNrYWdlIiwicmVsb2FkIiwibWlncmF0aW9uRGF0YSIsIlJlbG9hZCIsIl9taWdyYXRpb25EYXRhIiwiZGljdHMiLCJfb25NaWdyYXRlIiwiZGljdHNUb01pZ3JhdGUiLCJkYXRhVG9NaWdyYXRlIiwiX2dldE1pZ3JhdGlvbkRhdGEiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiLCJzdHJpbmdpZnkiLCJ2YWx1ZSIsInVuZGVmaW5lZCIsIkVKU09OIiwicGFyc2UiLCJzZXJpYWxpemVkIiwiY2hhbmdlZCIsImNvbnN0cnVjdG9yIiwiZGljdERhdGEiLCJrZXlzIiwibWlncmF0ZWREYXRhIiwiX3NldE9iamVjdCIsIm5hbWUiLCJhbGxEZXBzIiwiVHJhY2tlciIsIkRlcGVuZGVuY3kiLCJrZXlEZXBzIiwia2V5VmFsdWVEZXBzIiwic2V0Iiwia2V5T3JPYmplY3QiLCJrZXkiLCJrZXlFeGlzdGVkIiwib2xkU2VyaWFsaXplZFZhbHVlIiwiaXNOZXdWYWx1ZSIsInNldERlZmF1bHQiLCJfc2V0RGVmYXVsdE9iamVjdCIsImdldCIsIl9lbnN1cmVLZXkiLCJkZXBlbmQiLCJlcXVhbHMiLCJPYmplY3RJRCIsIm1vbmdvIiwiTW9uZ28iLCJEYXRlIiwic2VyaWFsaXplZFZhbHVlIiwiYWN0aXZlIiwiaXNOZXciLCJvbkludmFsaWRhdGUiLCJoYXNEZXBlbmRlbnRzIiwib2xkVmFsdWUiLCJhbGwiLCJyZXQiLCJmb3JFYWNoIiwiY2xlYXIiLCJvbGRLZXlzIiwiZGVsZXRlIiwiZGlkUmVtb3ZlIiwiZGVzdHJveSIsIm9iamVjdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFBQUEsTUFBTSxDQUFDQyxNQUFNLENBQUM7TUFBQ0MsWUFBWSxFQUFDQSxDQUFBLEtBQUlBO0lBQVksQ0FBQyxDQUFDO0lBQUMsSUFBSUEsWUFBWTtJQUFDRixNQUFNLENBQUNHLElBQUksQ0FBQyxpQkFBaUIsRUFBQztNQUFDRCxZQUFZQSxDQUFDRSxDQUFDLEVBQUM7UUFBQ0YsWUFBWSxHQUFDRSxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTUEsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFFL0wsTUFBTUMsTUFBTSxHQUFHQyxNQUFNLENBQUNDLFNBQVMsQ0FBQ0MsY0FBYztJQUU5Q1AsWUFBWSxDQUFDUSxpQkFBaUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3JDUixZQUFZLENBQUNTLGVBQWUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDOztJQUVuQ1QsWUFBWSxDQUFDVSxpQkFBaUIsR0FBRyxVQUFVQyxRQUFRLEVBQUU7TUFDbkQsSUFBSVAsTUFBTSxDQUFDUSxJQUFJLENBQUNaLFlBQVksQ0FBQ1EsaUJBQWlCLEVBQUVHLFFBQVEsQ0FBQyxFQUFFO1FBQ3pELE1BQU1FLElBQUksR0FBR2IsWUFBWSxDQUFDUSxpQkFBaUIsQ0FBQ0csUUFBUSxDQUFDO1FBQ3JELE9BQU9YLFlBQVksQ0FBQ1EsaUJBQWlCLENBQUNH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QUM7SUFDaEQ7RUFDRjtFQUVBRCxVQUFVQSxDQUFDcUMsTUFBTSxFQUFFO0lBQ2pCNUUsTUFBTSxDQUFDcUMsSUFBSSxDQUFDdUMsTUFBTSxDQUFDLENBQUNOLE9BQU8sQ0FBQ3RCLEdBQUcsSUFBSTtNQUNqQyxJQUFJLENBQUNGLEdBQUcsQ0FBQ0UsR0FBRyxFQUFFNEIsTUFBTSxDQUFDNUIsR0FBRyxDQUFDLENBQUM7SUFDNUIsQ0FBQyxDQUFDO0VBQ0o7RUFFQUssaUJBQWlCQSxDQUFDdUIsTUFBTSxFQUFFO0lBQ3hCNUUsTUFBTSxDQUFDcUMsSUFBSSxDQUFDdUMsTUFBTSxDQUFDLENBQUNOLE9BQU8sQ0FBQ3RCLEdBQUcsSUFBSTtNQUNqQyxJQUFJLENBQUNJLFVBQVUsQ0FBQ0osR0FBRyxFQUFFNEIsTUFBTSxDQUFDNUIsR0FBRyxDQUFDLENBQUM7SUFDbkMsQ0FBQyxDQUFDO0VBQ0o7RUFFQU8sVUFBVUEsQ0FBQ1AsR0FBRyxFQUFFO0lBQ2QsSUFBSSxFQUFFQSxHQUFHLElBQUksSUFBSSxDQUFDSixPQUFPLENBQUMsRUFBRTtNQUMxQixJQUFJLENBQUNBLE9BQU8sQ0FBQ0ksR0FBRyxDQUFDLEdBQUcsSUFBSU4sT0FBTyxDQUFDQyxVQUFVLENBQUQsQ0FBQztNQUMxQyxJQUFJLENBQUNFLFlBQVksQ0FBQ0csR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzdCO0VBQ0Y7O0VBRUE7RUFDQTtFQUNBekIsaUJBQWlCQSxDQUFBLEVBQUc7SUFDbEI7SUFDQSxPQUFPLElBQUksQ0FBQ2MsSUFBSTtFQUNsQjtBQUNGLEMiLCJmaWxlIjoiL3BhY2thZ2VzL3JlYWN0aXZlLWRpY3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSZWFjdGl2ZURpY3QgfSBmcm9tICcuL3JlYWN0aXZlLWRpY3QnO1xuXG5jb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5SZWFjdGl2ZURpY3QuX21pZ3JhdGVkRGljdERhdGEgPSB7fTsgLy8gbmFtZSAtPiBkYXRhXG5SZWFjdGl2ZURpY3QuX2RpY3RzVG9NaWdyYXRlID0ge307IC8vIG5hbWUgLT4gUmVhY3RpdmVEaWN0XG5cblJlYWN0aXZlRGljdC5fbG9hZE1pZ3JhdGVkRGljdCA9IGZ1bmN0aW9uIChkaWN0TmFtZSkge1xuICBpZiAoaGFzT3duLmNhbGwoUmVhY3RpdmVEaWN0Ll9taWdyYXRlZERpY3REYXRhLCBkaWN0TmFtZSkpIHtcbiAgICBjb25zdCBkYXRhID0gUmVhY3RpdmVEaWN0Ll9taWdyYXRlZERpY3REYXRhW2RpY3ROYW1lXTtcbiAgICBkZWxldGUgUmVhY3RpdmVEaWN0Ll9taWdyYXRlZERpY3REYXRhW2RpY3ROYW1lXTtcbiAgICByZXR1cm4gZGF0YTtcbiAgfVxuXG4gIHJldHVybiBudWxsO1xufTtcblxuUmVhY3RpdmVEaWN0Ll9yZWdpc3RlckRpY3RGb3JNaWdyYXRlID0gZnVuY3Rpb24gKGRpY3ROYW1lLCBkaWN0KSB7XG4gIGlmIChoYXNPd24uY2FsbChSZWFjdGl2ZURpY3QuX2RpY3RzVG9NaWdyYXRlLCBkaWN0TmFtZSkpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRHVwbGljYXRlIFJlYWN0aXZlRGljdCBuYW1lOiBcIiArIGRpY3ROYW1lKTtcblxuICBSZWFjdGl2ZURpY3QuX2RpY3RzVG9NaWdyYXRlW2RpY3ROYW1lXSA9IGRpY3Q7XG59O1xuXG5pZiAoTWV0ZW9yLmlzQ2xpZW50ICYmIFBhY2thZ2UucmVsb2FkKSB7XG4gIC8vIFB1dCBvbGQgbWlncmF0ZWQgZGF0YSBpbnRvIFJlYWN0aXZlRGljdC5fbWlncmF0ZWREaWN0RGF0YSxcbiAgLy8gd2hlcmUgaXQgY2FuIGJlIGFjY2Vzc2VkIGJ5IFJlYWN0aXZlRGljdC5fbG9hZE1pZ3JhdGVkRGljdC5cbiAgdmFyIG1pZ3JhdGlvbkRhdGEgPSBQYWNrYWdlLnJlbG9hZC5SZWxvYWQuX21pZ3JhdGlvbkRhdGEoJ3JlYWN0aXZlLWRpY3QnKTtcbiAgaWYgKG1pZ3JhdGlvbkRhdGEgJiYgbWlncmF0aW9uRGF0YS5kaWN0cylcbiAgICBSZWFjdGl2ZURpY3QuX21pZ3JhdGVkRGljdERhdGEgPSBtaWdyYXRpb25EYXRhLmRpY3RzO1xuXG4gIC8vIE9uIG1pZ3JhdGlvbiwgYXNzZW1ibGUgdGhlIGRhdGEgZnJvbSBhbGwgdGhlIGRpY3RzIHRoYXQgaGF2ZSBiZWVuXG4gIC8vIHJlZ2lzdGVyZWQuXG4gIFBhY2thZ2UucmVsb2FkLlJlbG9hZC5fb25NaWdyYXRlKCdyZWFjdGl2ZS1kaWN0JywgZnVuY3Rpb24gKCkge1xuICAgIHZhciBkaWN0c1RvTWlncmF0ZSA9IFJlYWN0aXZlRGljdC5fZGljdHNUb01pZ3JhdGU7XG4gICAgdmFyIGRhdGFUb01pZ3JhdGUgPSB7fTtcblxuICAgIGZvciAodmFyIGRpY3ROYW1lIGluIGRpY3RzVG9NaWdyYXRlKVxuICAgICAgZGF0YVRvTWlncmF0ZVtkaWN0TmFtZV0gPSBkaWN0c1RvTWlncmF0ZVtkaWN0TmFtZV0uX2dldE1pZ3JhdGlvbkRhdGEoKTtcblxuICAgIHJldHVybiBbdHJ1ZSwge2RpY3RzOiBkYXRhVG9NaWdyYXRlfV07XG4gIH0pO1xufVxuXG5leHBvcnQgeyBSZWFjdGl2ZURpY3QgfTtcbiIsImNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8vIFhYWCBjb21lIHVwIHdpdGggYSBzZXJpYWxpemF0aW9uIG1ldGhvZCB3aGljaCBjYW5vbmljYWxpemVzIG9iamVjdCBrZXlcbi8vIG9yZGVyLCB3aGljaCB3b3VsZCBhbGxvdyB1cyB0byB1c2Ugb2JqZWN0cyBhcyB2YWx1ZXMgZm9yIGVxdWFscy5cbmZ1bmN0aW9uIHN0cmluZ2lmeSh2YWx1ZSkge1xuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiAndW5kZWZpbmVkJztcbiAgfVxuICByZXR1cm4gRUpTT04uc3RyaW5naWZ5KHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gcGFyc2Uoc2VyaWFsaXplZCkge1xuICBpZiAoc2VyaWFsaXplZCA9PT0gdW5kZWZpbmVkIHx8IHNlcmlhbGl6ZWQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuICByZXR1cm4gRUpTT04ucGFyc2Uoc2VyaWFsaXplZCk7XG59XG5cbmZ1bmN0aW9uIGNoYW5nZWQodikge1xuICB2ICYmIHYuY2hhbmdlZCgpO1xufVxuXG4vLyBYWFggQ09NUEFUIFdJVEggMC45LjEgOiBhY2NlcHQgbWlncmF0aW9uRGF0YSBpbnN0ZWFkIG9mIGRpY3ROYW1lXG4vKipcbiAqIEBjbGFzc1xuICogQGluc3RhbmNlTmFtZSBSZWFjdGl2ZURpY3RcbiAqIEBzdW1tYXJ5IENvbnN0cnVjdG9yIGZvciBhIFJlYWN0aXZlRGljdCwgd2hpY2ggcmVwcmVzZW50cyBhIHJlYWN0aXZlIGRpY3Rpb25hcnkgb2Yga2V5L3ZhbHVlIHBhaXJzLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IFtuYW1lXSBPcHRpb25hbC4gIFdoZW4gYSBuYW1lIGlzIHBhc3NlZCwgcHJlc2VydmVzIGNvbnRlbnRzIGFjcm9zcyBIb3QgQ29kZSBQdXNoZXNcbiAqIEBwYXJhbSB7T2JqZWN0fSBbaW5pdGlhbFZhbHVlXSBPcHRpb25hbC4gIFRoZSBkZWZhdWx0IHZhbHVlcyBmb3IgdGhlIGRpY3Rpb25hcnlcbiAqL1xuZXhwb3J0IGNsYXNzIFJlYWN0aXZlRGljdCB7XG4gIGNvbnN0cnVjdG9yKGRpY3ROYW1lLCBkaWN0RGF0YSkge1xuICAgIC8vIHRoaXMua2V5czoga2V5IC0+IHZhbHVlXG4gICAgdGhpcy5rZXlzID0ge307XG5cbiAgICBpZiAoZGljdE5hbWUpIHtcbiAgICAgIC8vIG5hbWUgZ2l2ZW47IG1pZ3JhdGlvbiB3aWxsIGJlIHBlcmZvcm1lZFxuICAgICAgaWYgKHR5cGVvZiBkaWN0TmFtZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gdGhlIG5vcm1hbCBjYXNlLCBhcmd1bWVudCBpcyBhIHN0cmluZyBuYW1lLlxuXG4gICAgICAgIC8vIE9ubHkgcnVuIG1pZ3JhdGlvbiBsb2dpYyBvbiBjbGllbnQsIGl0IHdpbGwgY2F1c2VcbiAgICAgICAgLy8gZHVwbGljYXRlIG5hbWUgZXJyb3JzIG9uIHNlcnZlciBkdXJpbmcgcmVsb2Fkcy5cbiAgICAgICAgLy8gX3JlZ2lzdGVyRGljdEZvck1pZ3JhdGUgd2lsbCB0aHJvdyBhbiBlcnJvciBvbiBkdXBsaWNhdGUgbmFtZS5cbiAgICAgICAgTWV0ZW9yLmlzQ2xpZW50ICYmIFJlYWN0aXZlRGljdC5fcmVnaXN0ZXJEaWN0Rm9yTWlncmF0ZShkaWN0TmFtZSwgdGhpcyk7XG4gICAgICAgIGNvbnN0IG1pZ3JhdGVkRGF0YSA9IE1ldGVvci5pc0NsaWVudCAmJiBSZWFjdGl2ZURpY3QuX2xvYWRNaWdyYXRlZERpY3QoZGljdE5hbWUpO1xuXG4gICAgICAgIGlmIChtaWdyYXRlZERhdGEpIHtcbiAgICAgICAgICAvLyBEb24ndCBzdHJpbmdpZnkgbWlncmF0ZWQgZGF0YVxuICAgICAgICAgIHRoaXMua2V5cyA9IG1pZ3JhdGVkRGF0YTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBVc2UgX3NldE9iamVjdCB0byBtYWtlIHN1cmUgdmFsdWVzIGFyZSBzdHJpbmdpZmllZFxuICAgICAgICAgIHRoaXMuX3NldE9iamVjdChkaWN0RGF0YSB8fCB7fSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5uYW1lID0gZGljdE5hbWU7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkaWN0TmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgLy8gYmFjay1jb21wYXQgY2FzZTogZGljdE5hbWUgaXMgYWN0dWFsbHkgbWlncmF0aW9uRGF0YVxuICAgICAgICAvLyBVc2UgX3NldE9iamVjdCB0byBtYWtlIHN1cmUgdmFsdWVzIGFyZSBzdHJpbmdpZmllZFxuICAgICAgICB0aGlzLl9zZXRPYmplY3QoZGljdE5hbWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBSZWFjdGl2ZURpY3QgYXJndW1lbnQ6IFwiICsgZGljdE5hbWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRpY3REYXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgdGhpcy5fc2V0T2JqZWN0KGRpY3REYXRhKTtcbiAgICB9XG5cbiAgICB0aGlzLmFsbERlcHMgPSBuZXcgVHJhY2tlci5EZXBlbmRlbmN5O1xuICAgIHRoaXMua2V5RGVwcyA9IHt9OyAvLyBrZXkgLT4gRGVwZW5kZW5jeVxuICAgIHRoaXMua2V5VmFsdWVEZXBzID0ge307IC8vIGtleSAtPiBEZXBlbmRlbmN5XG4gIH1cblxuICAvLyBzZXQoKSBiZWdhbiBhcyBhIGtleS92YWx1ZSBtZXRob2QsIGJ1dCB3ZSBhcmUgbm93IG92ZXJsb2FkaW5nIGl0XG4gIC8vIHRvIHRha2UgYW4gb2JqZWN0IG9mIGtleS92YWx1ZSBwYWlycywgc2ltaWxhciB0byBiYWNrYm9uZVxuICAvLyBodHRwOi8vYmFja2JvbmVqcy5vcmcvI01vZGVsLXNldFxuICAvKipcbiAgICogQHN1bW1hcnkgU2V0IGEgdmFsdWUgZm9yIGEga2V5IGluIHRoZSBSZWFjdGl2ZURpY3QuIE5vdGlmeSBhbnkgbGlzdGVuZXJzXG4gICAqIHRoYXQgdGhlIHZhbHVlIGhhcyBjaGFuZ2VkIChlZzogcmVkcmF3IHRlbXBsYXRlcywgYW5kIHJlcnVuIGFueVxuICAgKiBbYFRyYWNrZXIuYXV0b3J1bmBdKCN0cmFja2VyX2F1dG9ydW4pIGNvbXB1dGF0aW9ucywgdGhhdCBjYWxsZWRcbiAgICogW2BSZWFjdGl2ZURpY3QuZ2V0YF0oI1JlYWN0aXZlRGljdF9nZXQpIG9uIHRoaXMgYGtleWAuKVxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGtleSB0byBzZXQsIGVnLCBgc2VsZWN0ZWRJdGVtYFxuICAgKiBAcGFyYW0ge0VKU09OYWJsZSB8IHVuZGVmaW5lZH0gdmFsdWUgVGhlIG5ldyB2YWx1ZSBmb3IgYGtleWBcbiAgICovXG4gIHNldChrZXlPck9iamVjdCwgdmFsdWUpIHtcbiAgICBpZiAoKHR5cGVvZiBrZXlPck9iamVjdCA9PT0gJ29iamVjdCcpICYmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSkge1xuICAgICAgLy8gQ2FsbGVkIGFzIGBkaWN0LnNldCh7Li4ufSlgXG4gICAgICB0aGlzLl9zZXRPYmplY3Qoa2V5T3JPYmplY3QpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyB0aGUgaW5wdXQgaXNuJ3QgYW4gb2JqZWN0LCBzbyBpdCBtdXN0IGJlIGEga2V5XG4gICAgLy8gYW5kIHdlIHJlc3VtZSB3aXRoIHRoZSByZXN0IG9mIHRoZSBmdW5jdGlvblxuICAgIGNvbnN0IGtleSA9IGtleU9yT2JqZWN0O1xuXG4gICAgdmFsdWUgPSBzdHJpbmdpZnkodmFsdWUpO1xuXG4gICAgY29uc3Qga2V5RXhpc3RlZCA9IGhhc093bi5jYWxsKHRoaXMua2V5cywga2V5KTtcbiAgICBjb25zdCBvbGRTZXJpYWxpemVkVmFsdWUgPSBrZXlFeGlzdGVkID8gdGhpcy5rZXlzW2tleV0gOiAndW5kZWZpbmVkJztcbiAgICBjb25zdCBpc05ld1ZhbHVlID0gKHZhbHVlICE9PSBvbGRTZXJpYWxpemVkVmFsdWUpO1xuXG4gICAgdGhpcy5rZXlzW2tleV0gPSB2YWx1ZTtcblxuICAgIGlmIChpc05ld1ZhbHVlIHx8ICFrZXlFeGlzdGVkKSB7XG4gICAgICAvLyBVc2luZyB0aGUgY2hhbmdlZCB1dGlsaXR5IGZ1bmN0aW9uIGhlcmUgYmVjYXVzZSB0aGlzLmFsbERlcHMgbWlnaHQgbm90IGV4aXN0IHlldCxcbiAgICAgIC8vIHdoZW4gc2V0dGluZyBpbml0aWFsIGRhdGEgZnJvbSBjb25zdHJ1Y3RvclxuICAgICAgY2hhbmdlZCh0aGlzLmFsbERlcHMpO1xuICAgIH1cblxuICAgIC8vIERvbid0IHRyaWdnZXIgY2hhbmdlcyB3aGVuIHNldHRpbmcgaW5pdGlhbCBkYXRhIGZyb20gY29uc3RydWN0b3IsXG4gICAgLy8gdGhpcy5LZXlEZXBzIGlzIHVuZGVmaW5lZCBpbiB0aGlzIGNhc2VcbiAgICBpZiAoaXNOZXdWYWx1ZSAmJiB0aGlzLmtleURlcHMpIHtcbiAgICAgIGNoYW5nZWQodGhpcy5rZXlEZXBzW2tleV0pO1xuICAgICAgaWYgKHRoaXMua2V5VmFsdWVEZXBzW2tleV0pIHtcbiAgICAgICAgY2hhbmdlZCh0aGlzLmtleVZhbHVlRGVwc1trZXldW29sZFNlcmlhbGl6ZWRWYWx1ZV0pO1xuICAgICAgICBjaGFuZ2VkKHRoaXMua2V5VmFsdWVEZXBzW2tleV1bdmFsdWVdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgU2V0IGEgdmFsdWUgZm9yIGEga2V5IGlmIGl0IGhhc24ndCBiZWVuIHNldCBiZWZvcmUuXG4gICAqIE90aGVyd2lzZSB3b3JrcyBleGFjdGx5IHRoZSBzYW1lIGFzIFtgUmVhY3RpdmVEaWN0LnNldGBdKCNSZWFjdGl2ZURpY3Qtc2V0KS5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IFRoZSBrZXkgdG8gc2V0LCBlZywgYHNlbGVjdGVkSXRlbWBcbiAgICogQHBhcmFtIHtFSlNPTmFibGUgfCB1bmRlZmluZWR9IHZhbHVlIFRoZSBuZXcgdmFsdWUgZm9yIGBrZXlgXG4gICAqL1xuICBzZXREZWZhdWx0KGtleU9yT2JqZWN0LCB2YWx1ZSkge1xuICAgIGlmICgodHlwZW9mIGtleU9yT2JqZWN0ID09PSAnb2JqZWN0JykgJiYgKHZhbHVlID09PSB1bmRlZmluZWQpKSB7XG4gICAgICAvLyBDYWxsZWQgYXMgYGRpY3Quc2V0RGVmYXVsdCh7Li4ufSlgXG4gICAgICB0aGlzLl9zZXREZWZhdWx0T2JqZWN0KGtleU9yT2JqZWN0KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gdGhlIGlucHV0IGlzbid0IGFuIG9iamVjdCwgc28gaXQgbXVzdCBiZSBhIGtleVxuICAgIC8vIGFuZCB3ZSByZXN1bWUgd2l0aCB0aGUgcmVzdCBvZiB0aGUgZnVuY3Rpb25cbiAgICBjb25zdCBrZXkgPSBrZXlPck9iamVjdDtcblxuICAgIGlmICghIGhhc093bi5jYWxsKHRoaXMua2V5cywga2V5KSkge1xuICAgICAgdGhpcy5zZXQoa2V5LCB2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldCB0aGUgdmFsdWUgYXNzaWNpYXRlZCB3aXRoIGEga2V5LiBJZiBpbnNpZGUgYSBbcmVhY3RpdmVcbiAgICogY29tcHV0YXRpb25dKCNyZWFjdGl2aXR5KSwgaW52YWxpZGF0ZSB0aGUgY29tcHV0YXRpb24gdGhlIG5leHQgdGltZSB0aGVcbiAgICogdmFsdWUgYXNzb2NpYXRlZCB3aXRoIHRoaXMga2V5IGlzIGNoYW5nZWQgYnlcbiAgICogW2BSZWFjdGl2ZURpY3Quc2V0YF0oI1JlYWN0aXZlRGljdC1zZXQpLlxuICAgKiBUaGlzIHJldHVybnMgYSBjbG9uZSBvZiB0aGUgdmFsdWUsIHNvIGlmIGl0J3MgYW4gb2JqZWN0IG9yIGFuIGFycmF5LFxuICAgKiBtdXRhdGluZyB0aGUgcmV0dXJuZWQgdmFsdWUgaGFzIG5vIGVmZmVjdCBvbiB0aGUgdmFsdWUgc3RvcmVkIGluIHRoZVxuICAgKiBSZWFjdGl2ZURpY3QuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBUaGUga2V5IG9mIHRoZSBlbGVtZW50IHRvIHJldHVyblxuICAgKi9cbiAgZ2V0KGtleSkge1xuICAgIHRoaXMuX2Vuc3VyZUtleShrZXkpO1xuICAgIHRoaXMua2V5RGVwc1trZXldLmRlcGVuZCgpO1xuICAgIHJldHVybiBwYXJzZSh0aGlzLmtleXNba2V5XSk7XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgVGVzdCBpZiB0aGUgc3RvcmVkIGVudHJ5IGZvciBhIGtleSBpcyBlcXVhbCB0byBhIHZhbHVlLiBJZiBpbnNpZGUgYVxuICAgKiBbcmVhY3RpdmUgY29tcHV0YXRpb25dKCNyZWFjdGl2aXR5KSwgaW52YWxpZGF0ZSB0aGUgY29tcHV0YXRpb24gdGhlIG5leHRcbiAgICogdGltZSB0aGUgdmFyaWFibGUgY2hhbmdlcyB0byBvciBmcm9tIHRoZSB2YWx1ZS5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IFRoZSBuYW1lIG9mIHRoZSBzZXNzaW9uIHZhcmlhYmxlIHRvIHRlc3RcbiAgICogQHBhcmFtIHtTdHJpbmcgfCBOdW1iZXIgfCBCb29sZWFuIHwgbnVsbCB8IHVuZGVmaW5lZH0gdmFsdWUgVGhlIHZhbHVlIHRvXG4gICAqIHRlc3QgYWdhaW5zdFxuICAgKi9cbiAgZXF1YWxzKGtleSwgdmFsdWUpIHtcbiAgICAvLyBNb25nby5PYmplY3RJRCBpcyBpbiB0aGUgJ21vbmdvJyBwYWNrYWdlXG4gICAgbGV0IE9iamVjdElEID0gbnVsbDtcbiAgICBpZiAoUGFja2FnZS5tb25nbykge1xuICAgICAgT2JqZWN0SUQgPSBQYWNrYWdlLm1vbmdvLk1vbmdvLk9iamVjdElEO1xuICAgIH1cbiAgICAvLyBXZSBkb24ndCBhbGxvdyBvYmplY3RzIChvciBhcnJheXMgdGhhdCBtaWdodCBpbmNsdWRlIG9iamVjdHMpIGZvclxuICAgIC8vIC5lcXVhbHMsIGJlY2F1c2UgSlNPTi5zdHJpbmdpZnkgZG9lc24ndCBjYW5vbmljYWxpemUgb2JqZWN0IGtleVxuICAgIC8vIG9yZGVyLiAoV2UgY2FuIG1ha2UgZXF1YWxzIGhhdmUgdGhlIHJpZ2h0IHJldHVybiB2YWx1ZSBieSBwYXJzaW5nIHRoZVxuICAgIC8vIGN1cnJlbnQgdmFsdWUgYW5kIHVzaW5nIEVKU09OLmVxdWFscywgYnV0IHdlIHdvbid0IGhhdmUgYSBjYW5vbmljYWxcbiAgICAvLyBlbGVtZW50IG9mIGtleVZhbHVlRGVwc1trZXldIHRvIHN0b3JlIHRoZSBkZXBlbmRlbmN5LikgWW91IGNhbiBzdGlsbCB1c2VcbiAgICAvLyBcIkVKU09OLmVxdWFscyhyZWFjdGl2ZURpY3QuZ2V0KGtleSksIHZhbHVlKVwiLlxuICAgIC8vXG4gICAgLy8gWFhYIHdlIGNvdWxkIGFsbG93IGFycmF5cyBhcyBsb25nIGFzIHdlIHJlY3Vyc2l2ZWx5IGNoZWNrIHRoYXQgdGhlcmVcbiAgICAvLyBhcmUgbm8gb2JqZWN0c1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnICYmXG4gICAgICAgIHR5cGVvZiB2YWx1ZSAhPT0gJ251bWJlcicgJiZcbiAgICAgICAgdHlwZW9mIHZhbHVlICE9PSAnYm9vbGVhbicgJiZcbiAgICAgICAgdHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICAhKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSkgJiZcbiAgICAgICAgIShPYmplY3RJRCAmJiB2YWx1ZSBpbnN0YW5jZW9mIE9iamVjdElEKSAmJlxuICAgICAgICB2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUmVhY3RpdmVEaWN0LmVxdWFsczogdmFsdWUgbXVzdCBiZSBzY2FsYXJcIik7XG4gICAgfVxuICAgIGNvbnN0IHNlcmlhbGl6ZWRWYWx1ZSA9IHN0cmluZ2lmeSh2YWx1ZSk7XG5cbiAgICBpZiAoVHJhY2tlci5hY3RpdmUpIHtcbiAgICAgIHRoaXMuX2Vuc3VyZUtleShrZXkpO1xuXG4gICAgICBpZiAoISBoYXNPd24uY2FsbCh0aGlzLmtleVZhbHVlRGVwc1trZXldLCBzZXJpYWxpemVkVmFsdWUpKSB7XG4gICAgICAgIHRoaXMua2V5VmFsdWVEZXBzW2tleV1bc2VyaWFsaXplZFZhbHVlXSA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3k7XG4gICAgICB9XG5cbiAgICAgIHZhciBpc05ldyA9IHRoaXMua2V5VmFsdWVEZXBzW2tleV1bc2VyaWFsaXplZFZhbHVlXS5kZXBlbmQoKTtcbiAgICAgIGlmIChpc05ldykge1xuICAgICAgICBUcmFja2VyLm9uSW52YWxpZGF0ZSgoKSA9PiB7XG4gICAgICAgICAgLy8gY2xlYW4gdXAgW2tleV1bc2VyaWFsaXplZFZhbHVlXSBpZiBpdCdzIG5vdyBlbXB0eSwgc28gd2UgZG9uJ3RcbiAgICAgICAgICAvLyB1c2UgTyhuKSBtZW1vcnkgZm9yIG4gPSB2YWx1ZXMgc2VlbiBldmVyXG4gICAgICAgICAgaWYgKCEgdGhpcy5rZXlWYWx1ZURlcHNba2V5XVtzZXJpYWxpemVkVmFsdWVdLmhhc0RlcGVuZGVudHMoKSkge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMua2V5VmFsdWVEZXBzW2tleV1bc2VyaWFsaXplZFZhbHVlXTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBvbGRWYWx1ZSA9IHVuZGVmaW5lZDtcbiAgICBpZiAoaGFzT3duLmNhbGwodGhpcy5rZXlzLCBrZXkpKSB7XG4gICAgICBvbGRWYWx1ZSA9IHBhcnNlKHRoaXMua2V5c1trZXldKTtcbiAgICB9XG4gICAgcmV0dXJuIEVKU09OLmVxdWFscyhvbGRWYWx1ZSwgdmFsdWUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldCBhbGwga2V5LXZhbHVlIHBhaXJzIGFzIGEgcGxhaW4gb2JqZWN0LiBJZiBpbnNpZGUgYSBbcmVhY3RpdmVcbiAgICogY29tcHV0YXRpb25dKCNyZWFjdGl2aXR5KSwgaW52YWxpZGF0ZSB0aGUgY29tcHV0YXRpb24gdGhlIG5leHQgdGltZSB0aGVcbiAgICogdmFsdWUgYXNzb2NpYXRlZCB3aXRoIGFueSBrZXkgaXMgY2hhbmdlZCBieVxuICAgKiBbYFJlYWN0aXZlRGljdC5zZXRgXSgjUmVhY3RpdmVEaWN0LXNldCkuXG4gICAqIFRoaXMgcmV0dXJucyBhIGNsb25lIG9mIGVhY2ggdmFsdWUsIHNvIGlmIGl0J3MgYW4gb2JqZWN0IG9yIGFuIGFycmF5LFxuICAgKiBtdXRhdGluZyB0aGUgcmV0dXJuZWQgdmFsdWUgaGFzIG5vIGVmZmVjdCBvbiB0aGUgdmFsdWUgc3RvcmVkIGluIHRoZVxuICAgKiBSZWFjdGl2ZURpY3QuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICovXG4gIGFsbCgpIHtcbiAgICB0aGlzLmFsbERlcHMuZGVwZW5kKCk7XG4gICAgbGV0IHJldCA9IHt9O1xuICAgIE9iamVjdC5rZXlzKHRoaXMua2V5cykuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgcmV0W2tleV0gPSBwYXJzZSh0aGlzLmtleXNba2V5XSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSByZW1vdmUgYWxsIGtleS12YWx1ZSBwYWlycyBmcm9tIHRoZSBSZWFjdGl2ZURpY3QuIE5vdGlmeSBhbnlcbiAgICogbGlzdGVuZXJzIHRoYXQgdGhlIHZhbHVlIGhhcyBjaGFuZ2VkIChlZzogcmVkcmF3IHRlbXBsYXRlcywgYW5kIHJlcnVuIGFueVxuICAgKiBbYFRyYWNrZXIuYXV0b3J1bmBdKCN0cmFja2VyX2F1dG9ydW4pIGNvbXB1dGF0aW9ucywgdGhhdCBjYWxsZWRcbiAgICogW2BSZWFjdGl2ZURpY3QuZ2V0YF0oI1JlYWN0aXZlRGljdF9nZXQpIG9uIHRoaXMgYGtleWAuKVxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICBjbGVhcigpIHtcbiAgICBjb25zdCBvbGRLZXlzID0gdGhpcy5rZXlzO1xuICAgIHRoaXMua2V5cyA9IHt9O1xuXG4gICAgdGhpcy5hbGxEZXBzLmNoYW5nZWQoKTtcblxuICAgIE9iamVjdC5rZXlzKG9sZEtleXMpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNoYW5nZWQodGhpcy5rZXlEZXBzW2tleV0pO1xuICAgICAgaWYgKHRoaXMua2V5VmFsdWVEZXBzW2tleV0pIHtcbiAgICAgICAgY2hhbmdlZCh0aGlzLmtleVZhbHVlRGVwc1trZXldW29sZEtleXNba2V5XV0pO1xuICAgICAgICBjaGFuZ2VkKHRoaXMua2V5VmFsdWVEZXBzW2tleV1bJ3VuZGVmaW5lZCddKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSByZW1vdmUgYSBrZXktdmFsdWUgcGFpciBmcm9tIHRoZSBSZWFjdGl2ZURpY3QuIE5vdGlmeSBhbnkgbGlzdGVuZXJzXG4gICAqIHRoYXQgdGhlIHZhbHVlIGhhcyBjaGFuZ2VkIChlZzogcmVkcmF3IHRlbXBsYXRlcywgYW5kIHJlcnVuIGFueVxuICAgKiBbYFRyYWNrZXIuYXV0b3J1bmBdKCN0cmFja2VyX2F1dG9ydW4pIGNvbXB1dGF0aW9ucywgdGhhdCBjYWxsZWRcbiAgICogW2BSZWFjdGl2ZURpY3QuZ2V0YF0oI1JlYWN0aXZlRGljdF9nZXQpIG9uIHRoaXMgYGtleWAuKVxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGtleSB0byBkZWxldGUsIGVnLCBgc2VsZWN0ZWRJdGVtYFxuICAgKi9cbiAgZGVsZXRlKGtleSkge1xuICAgIGxldCBkaWRSZW1vdmUgPSBmYWxzZTtcblxuICAgIGlmIChoYXNPd24uY2FsbCh0aGlzLmtleXMsIGtleSkpIHtcbiAgICAgIGNvbnN0IG9sZFZhbHVlID0gdGhpcy5rZXlzW2tleV07XG4gICAgICBkZWxldGUgdGhpcy5rZXlzW2tleV07XG4gICAgICBjaGFuZ2VkKHRoaXMua2V5RGVwc1trZXldKTtcbiAgICAgIGlmICh0aGlzLmtleVZhbHVlRGVwc1trZXldKSB7XG4gICAgICAgIGNoYW5nZWQodGhpcy5rZXlWYWx1ZURlcHNba2V5XVtvbGRWYWx1ZV0pO1xuICAgICAgICBjaGFuZ2VkKHRoaXMua2V5VmFsdWVEZXBzW2tleV1bJ3VuZGVmaW5lZCddKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYWxsRGVwcy5jaGFuZ2VkKCk7XG4gICAgICBkaWRSZW1vdmUgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gZGlkUmVtb3ZlO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENsZWFyIGFsbCB2YWx1ZXMgZnJvbSB0aGUgcmVhY3RpdmVEaWN0IGFuZCBwcmV2ZW50IGl0IGZyb20gYmVpbmdcbiAgICogbWlncmF0ZWQgb24gYSBIb3QgQ29kZSBQdXNoZXMuIE5vdGlmeSBhbnkgbGlzdGVuZXJzXG4gICAqIHRoYXQgdGhlIHZhbHVlIGhhcyBjaGFuZ2VkIChlZzogcmVkcmF3IHRlbXBsYXRlcywgYW5kIHJlcnVuIGFueVxuICAgKiBbYFRyYWNrZXIuYXV0b3J1bmBdKCN0cmFja2VyX2F1dG9ydW4pIGNvbXB1dGF0aW9ucywgdGhhdCBjYWxsZWRcbiAgICogW2BSZWFjdGl2ZURpY3QuZ2V0YF0oI1JlYWN0aXZlRGljdF9nZXQpIG9uIHRoaXMgYGtleWAuKVxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqL1xuICBkZXN0cm95KCkge1xuICAgIHRoaXMuY2xlYXIoKTtcbiAgICBpZiAodGhpcy5uYW1lICYmIGhhc093bi5jYWxsKFJlYWN0aXZlRGljdC5fZGljdHNUb01pZ3JhdGUsIHRoaXMubmFtZSkpIHtcbiAgICAgIGRlbGV0ZSBSZWFjdGl2ZURpY3QuX2RpY3RzVG9NaWdyYXRlW3RoaXMubmFtZV07XG4gICAgfVxuICB9XG5cbiAgX3NldE9iamVjdChvYmplY3QpIHtcbiAgICBPYmplY3Qua2V5cyhvYmplY3QpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIHRoaXMuc2V0KGtleSwgb2JqZWN0W2tleV0pO1xuICAgIH0pO1xuICB9XG5cbiAgX3NldERlZmF1bHRPYmplY3Qob2JqZWN0KSB7XG4gICAgT2JqZWN0LmtleXMob2JqZWN0KS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICB0aGlzLnNldERlZmF1bHQoa2V5LCBvYmplY3Rba2V5XSk7XG4gICAgfSk7XG4gIH1cblxuICBfZW5zdXJlS2V5KGtleSkge1xuICAgIGlmICghKGtleSBpbiB0aGlzLmtleURlcHMpKSB7XG4gICAgICB0aGlzLmtleURlcHNba2V5XSA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3k7XG4gICAgICB0aGlzLmtleVZhbHVlRGVwc1trZXldID0ge307XG4gICAgfVxuICB9XG5cbiAgLy8gR2V0IGEgSlNPTiB2YWx1ZSB0aGF0IGNhbiBiZSBwYXNzZWQgdG8gdGhlIGNvbnN0cnVjdG9yIHRvXG4gIC8vIGNyZWF0ZSBhIG5ldyBSZWFjdGl2ZURpY3Qgd2l0aCB0aGUgc2FtZSBjb250ZW50cyBhcyB0aGlzIG9uZVxuICBfZ2V0TWlncmF0aW9uRGF0YSgpIHtcbiAgICAvLyBYWFggc2FuaXRpemUgYW5kIG1ha2Ugc3VyZSBpdCdzIEpTT05pYmxlP1xuICAgIHJldHVybiB0aGlzLmtleXM7XG4gIH1cbn1cbiJdfQ==
