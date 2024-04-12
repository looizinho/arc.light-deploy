Package["core-runtime"].queue("observe-sequence", ["meteor", "tracker", "mongo-id", "diff-sequence", "random", "ecmascript", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var MongoID = Package['mongo-id'].MongoID;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var Random = Package.random.Random;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var ObserveSequence, seqChangedToEmpty, seqChangedToArray, seqChangedToCursor;

var require = meteorInstall({"node_modules":{"meteor":{"observe-sequence":{"observe_sequence.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                             //
// packages/observe-sequence/observe_sequence.js                                                               //
//                                                                                                             //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                               //
const isObject = function (value) {
  var type = typeof value;
  return value != null && (type == 'object' || type == 'function');
};
const has = function (obj, key) {
  var keyParts = key.split('.');
  return !!obj && (keyParts.length > 1 ? has(obj[key.split('.')[0]], keyParts.slice(1).join('.')) : hasOwnProperty.call(obj, key));
};
const warn = function () {
  if (ObserveSequence._suppressWarnings) {
    ObserveSequence._suppressWarnings--;
  } else {
    if (typeof console !== 'undefined' && console.warn) console.warn.apply(console, arguments);
    ObserveSequence._loggedWarnings++;
  }
};

// isArray returns true for arrays of these types:
// standard arrays: instanceof Array === true, _.isArray(arr) === true
// vm generated arrays: instanceOf Array === false, _.isArray(arr) === true
// subclassed arrays: instanceof Array === true, _.isArray(arr) === false
// see specific tests
function isArray(arr) {
  return arr instanceof Array || Array.isArray(arr);
}

// isIterable returns trues for objects implementing iterable protocol,
// except strings, as {{#each 'string'}} doesn't make much sense.
// Requires ES6+ and does not work in IE (but degrades gracefully).
// Does not support the `length` + index protocol also supported by Array.from
function isIterable(object) {
  const iter = typeof Symbol != 'undefined' && Symbol.iterator;
  return iter && object instanceof Object // note: returns false for strings
  && typeof object[iter] == 'function'; // implements iterable protocol
}
const idStringify = MongoID.idStringify;
const idParse = MongoID.idParse;
ObserveSequence = {
  _suppressWarnings: 0,
  _loggedWarnings: 0,
  // A mechanism similar to cursor.observe which receives a reactive
  // function returning a sequence type and firing appropriate callbacks
  // when the value changes.
  //
  // @param sequenceFunc {Function} a reactive function returning a
  //     sequence type. The currently supported sequence types are:
  //     Array, Cursor, and null.
  //
  // @param callbacks {Object} similar to a specific subset of
  //     callbacks passed to `cursor.observe`
  //     (http://docs.meteor.com/#observe), with minor variations to
  //     support the fact that not all sequences contain objects with
  //     _id fields.  Specifically:
  //
  //     * addedAt(id, item, atIndex, beforeId)
  //     * changedAt(id, newItem, oldItem, atIndex)
  //     * removedAt(id, oldItem, atIndex)
  //     * movedTo(id, item, fromIndex, toIndex, beforeId)
  //
  // @returns {Object(stop: Function)} call 'stop' on the return value
  //     to stop observing this sequence function.
  //
  // We don't make any assumptions about our ability to compare sequence
  // elements (ie, we don't assume EJSON.equals works; maybe there is extra
  // state/random methods on the objects) so unlike cursor.observe, we may
  // sometimes call changedAt() when nothing actually changed.
  // XXX consider if we *can* make the stronger assumption and avoid
  //     no-op changedAt calls (in some cases?)
  //
  // XXX currently only supports the callbacks used by our
  // implementation of {{#each}}, but this can be expanded.
  //
  // XXX #each doesn't use the indices (though we'll eventually need
  // a way to get them when we support `@index`), but calling
  // `cursor.observe` causes the index to be calculated on every
  // callback using a linear scan (unless you turn it off by passing
  // `_no_indices`).  Any way to avoid calculating indices on a pure
  // cursor observe like we used to?
  observe: function (sequenceFunc, callbacks) {
    var lastSeq = null;
    var activeObserveHandle = null;

    // 'lastSeqArray' contains the previous value of the sequence
    // we're observing. It is an array of objects with '_id' and
    // 'item' fields.  'item' is the element in the array, or the
    // document in the cursor.
    //
    // '_id' is whichever of the following is relevant, unless it has
    // already appeared -- in which case it's randomly generated.
    //
    // * if 'item' is an object:
    //   * an '_id' field, if present
    //   * otherwise, the index in the array
    //
    // * if 'item' is a number or string, use that value
    //
    // XXX this can be generalized by allowing {{#each}} to accept a
    // general 'key' argument which could be a function, a dotted
    // field name, or the special @index value.
    var lastSeqArray = []; // elements are objects of form {_id, item}
    var computation = Tracker.autorun(function () {
      var seq = sequenceFunc();
      Tracker.nonreactive(function () {
        var seqArray; // same structure as `lastSeqArray` above.

        if (activeObserveHandle) {
          // If we were previously observing a cursor, replace lastSeqArray with
          // more up-to-date information.  Then stop the old observe.
          lastSeqArray = lastSeq.fetch().map(function (doc) {
            return {
              _id: doc._id,
              item: doc
            };
          });
          activeObserveHandle.stop();
          activeObserveHandle = null;
        }
        if (!seq) {
          seqArray = seqChangedToEmpty(lastSeqArray, callbacks);
        } else if (isArray(seq)) {
          seqArray = seqChangedToArray(lastSeqArray, seq, callbacks);
        } else if (isStoreCursor(seq)) {
          var result /* [seqArray, activeObserveHandle] */ = seqChangedToCursor(lastSeqArray, seq, callbacks);
          seqArray = result[0];
          activeObserveHandle = result[1];
        } else if (isIterable(seq)) {
          const array = Array.from(seq);
          seqArray = seqChangedToArray(lastSeqArray, array, callbacks);
        } else {
          throw badSequenceError(seq);
        }
        diffArray(lastSeqArray, seqArray, callbacks);
        lastSeq = seq;
        lastSeqArray = seqArray;
      });
    });
    return {
      stop: function () {
        computation.stop();
        if (activeObserveHandle) activeObserveHandle.stop();
      }
    };
  },
  // Fetch the items of `seq` into an array, where `seq` is of one of the
  // sequence types accepted by `observe`.  If `seq` is a cursor, a
  // dependency is established.
  fetch: function (seq) {
    if (!seq) {
      return [];
    } else if (isArray(seq)) {
      return seq;
    } else if (isStoreCursor(seq)) {
      return seq.fetch();
    } else if (isIterable(seq)) {
      return Array.from(seq);
    } else {
      throw badSequenceError(seq);
    }
  }
};
function ellipsis(longStr, maxLength) {
  if (!maxLength) maxLength = 100;
  if (longStr.length < maxLength) return longStr;
  return longStr.substr(0, maxLength - 1) + '…';
}
function arrayToDebugStr(value, maxLength) {
  var out = '',
    sep = '';
  for (var i = 0; i < value.length; i++) {
    var item = value[i];
    out += sep + toDebugStr(item, maxLength);
    if (out.length > maxLength) return out;
    sep = ', ';
  }
  return out;
}
function toDebugStr(value, maxLength) {
  if (!maxLength) maxLength = 150;
  const type = typeof value;
  switch (type) {
    case 'undefined':
      return type;
    case 'number':
      return value.toString();
    case 'string':
      return JSON.stringify(value);
    // add quotes
    case 'object':
      if (value === null) {
        return 'null';
      } else if (Array.isArray(value)) {
        return 'Array [' + arrayToDebugStr(value, maxLength) + ']';
      } else if (Symbol.iterator in value) {
        // Map and Set are not handled by JSON.stringify
        return value.constructor.name + ' [' + arrayToDebugStr(Array.from(value), maxLength) + ']'; // Array.from doesn't work in IE, but neither do iterators so it's unreachable
      } else {
        // use JSON.stringify (sometimes toString can be better but we don't know)
        return value.constructor.name + ' ' + ellipsis(JSON.stringify(value), maxLength);
      }
    default:
      return type + ': ' + value.toString();
  }
}
function sequenceGotValue(sequence) {
  try {
    return ' Got ' + toDebugStr(sequence);
  } catch (e) {
    return '';
  }
}
const badSequenceError = function (sequence) {
  return new Error("{{#each}} currently only accepts " + "arrays, cursors, iterables or falsey values." + sequenceGotValue(sequence));
};
const isFunction = func => {
  return typeof func === "function";
};
const isStoreCursor = function (cursor) {
  return cursor && isObject(cursor) && isFunction(cursor.observe) && isFunction(cursor.fetch);
};

// Calculates the differences between `lastSeqArray` and
// `seqArray` and calls appropriate functions from `callbacks`.
// Reuses Minimongo's diff algorithm implementation.
const diffArray = function (lastSeqArray, seqArray, callbacks) {
  var diffFn = Package['diff-sequence'].DiffSequence.diffQueryOrderedChanges;
  var oldIdObjects = [];
  var newIdObjects = [];
  var posOld = {}; // maps from idStringify'd ids
  var posNew = {}; // ditto
  var posCur = {};
  var lengthCur = lastSeqArray.length;
  seqArray.forEach(function (doc, i) {
    newIdObjects.push({
      _id: doc._id
    });
    posNew[idStringify(doc._id)] = i;
  });
  lastSeqArray.forEach(function (doc, i) {
    oldIdObjects.push({
      _id: doc._id
    });
    posOld[idStringify(doc._id)] = i;
    posCur[idStringify(doc._id)] = i;
  });

  // Arrays can contain arbitrary objects. We don't diff the
  // objects. Instead we always fire 'changedAt' callback on every
  // object. The consumer of `observe-sequence` should deal with
  // it appropriately.
  diffFn(oldIdObjects, newIdObjects, {
    addedBefore: function (id, doc, before) {
      var position = before ? posCur[idStringify(before)] : lengthCur;
      if (before) {
        // If not adding at the end, we need to update indexes.
        // XXX this can still be improved greatly!
        Object.entries(posCur).forEach(function (_ref) {
          let [id, pos] = _ref;
          if (pos >= position) posCur[id]++;
        });
      }
      lengthCur++;
      posCur[idStringify(id)] = position;
      callbacks.addedAt(id, seqArray[posNew[idStringify(id)]].item, position, before);
    },
    movedBefore: function (id, before) {
      if (id === before) return;
      var oldPosition = posCur[idStringify(id)];
      var newPosition = before ? posCur[idStringify(before)] : lengthCur;

      // Moving the item forward. The new element is losing one position as it
      // was removed from the old position before being inserted at the new
      // position.
      // Ex.:   0  *1*  2   3   4
      //        0   2   3  *1*  4
      // The original issued callback is "1" before "4".
      // The position of "1" is 1, the position of "4" is 4.
      // The generated move is (1) -> (3)
      if (newPosition > oldPosition) {
        newPosition--;
      }

      // Fix up the positions of elements between the old and the new positions
      // of the moved element.
      //
      // There are two cases:
      //   1. The element is moved forward. Then all the positions in between
      //   are moved back.
      //   2. The element is moved back. Then the positions in between *and* the
      //   element that is currently standing on the moved element's future
      //   position are moved forward.
      Object.entries(posCur).forEach(function (_ref2) {
        let [id, elCurPosition] = _ref2;
        if (oldPosition < elCurPosition && elCurPosition < newPosition) posCur[id]--;else if (newPosition <= elCurPosition && elCurPosition < oldPosition) posCur[id]++;
      });

      // Finally, update the position of the moved element.
      posCur[idStringify(id)] = newPosition;
      callbacks.movedTo(id, seqArray[posNew[idStringify(id)]].item, oldPosition, newPosition, before);
    },
    removed: function (id) {
      var prevPosition = posCur[idStringify(id)];
      Object.entries(posCur).forEach(function (_ref3) {
        let [id, pos] = _ref3;
        if (pos >= prevPosition) posCur[id]--;
      });
      delete posCur[idStringify(id)];
      lengthCur--;
      callbacks.removedAt(id, lastSeqArray[posOld[idStringify(id)]].item, prevPosition);
    }
  });
  Object.entries(posNew).forEach(function (_ref4) {
    let [idString, pos] = _ref4;
    var id = idParse(idString);
    if (has(posOld, idString)) {
      // specifically for primitive types, compare equality before
      // firing the 'changedAt' callback. otherwise, always fire it
      // because doing a deep EJSON comparison is not guaranteed to
      // work (an array can contain arbitrary objects, and 'transform'
      // can be used on cursors). also, deep diffing is not
      // necessarily the most efficient (if only a specific subfield
      // of the object is later accessed).
      var newItem = seqArray[pos].item;
      var oldItem = lastSeqArray[posOld[idString]].item;
      if (typeof newItem === 'object' || newItem !== oldItem) callbacks.changedAt(id, newItem, oldItem, pos);
    }
  });
};
seqChangedToEmpty = function (lastSeqArray, callbacks) {
  return [];
};
seqChangedToArray = function (lastSeqArray, array, callbacks) {
  var idsUsed = {};
  var seqArray = array.map(function (item, index) {
    var id;
    if (typeof item === 'string') {
      // ensure not empty, since other layers (eg DomRange) assume this as well
      id = "-" + item;
    } else if (typeof item === 'number' || typeof item === 'boolean' || item === undefined || item === null) {
      id = item;
    } else if (typeof item === 'object') {
      id = item && '_id' in item ? item._id : index;
    } else {
      throw new Error("{{#each}} doesn't support arrays with " + "elements of type " + typeof item);
    }
    var idString = idStringify(id);
    if (idsUsed[idString]) {
      if (item && typeof item === 'object' && '_id' in item) warn("duplicate id " + id + " in", array);
      id = Random.id();
    } else {
      idsUsed[idString] = true;
    }
    return {
      _id: id,
      item: item
    };
  });
  return seqArray;
};
seqChangedToCursor = function (lastSeqArray, cursor, callbacks) {
  var initial = true; // are we observing initial data from cursor?
  var seqArray = [];
  var observeHandle = cursor.observe({
    addedAt: function (document, atIndex, before) {
      if (initial) {
        // keep track of initial data so that we can diff once
        // we exit `observe`.
        if (before !== null) throw new Error("Expected initial data from observe in order");
        seqArray.push({
          _id: document._id,
          item: document
        });
      } else {
        callbacks.addedAt(document._id, document, atIndex, before);
      }
    },
    changedAt: function (newDocument, oldDocument, atIndex) {
      callbacks.changedAt(newDocument._id, newDocument, oldDocument, atIndex);
    },
    removedAt: function (oldDocument, atIndex) {
      callbacks.removedAt(oldDocument._id, oldDocument, atIndex);
    },
    movedTo: function (document, fromIndex, toIndex, before) {
      callbacks.movedTo(document._id, document, fromIndex, toIndex, before);
    }
  });
  initial = false;
  return [seqArray, observeHandle];
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      ObserveSequence: ObserveSequence
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/observe-sequence/observe_sequence.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/observe-sequence.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvb2JzZXJ2ZS1zZXF1ZW5jZS9vYnNlcnZlX3NlcXVlbmNlLmpzIl0sIm5hbWVzIjpbImlzT2JqZWN0IiwidmFsdWUiLCJ0eXBlIiwiaGFzIiwib2JqIiwia2V5Iiwia2V5UGFydHMiLCJzcGxpdCIsImxlbmd0aCIsInNsaWNlIiwiam9pbiIsImhhc093blByb3BlcnR5IiwiY2FsbCIsIndhcm4iLCJPYnNlcnZlU2VxdWVuY2UiLCJfc3VwcHJlc3NXYXJuaW5ncyIsImNvbnNvbGUiLCJhcHBseSIsImFyZ3VtZW50cyIsIl9sb2dnZWRXYXJuaW5ncyIsImlzQXJyYXkiLCJhcnIiLCJBcnJheSIsImlzSXRlcmFibGUiLCJvYmplY3QiLCJpdGVyIiwiU3ltYm9sIiwiaXRlcmF0b3IiLCJPYmplY3QiLCJpZFN0cmluZ2lmeSIsIk1vbmdvSUQiLCJpZFBhcnNlIiwib2JzZXJ2ZSIsInNlcXVlbmNlRnVuYyIsImNhbGxiYWNrcyIsImxhc3RTZXEiLCJhY3RpdmVPYnNlcnZlSGFuZGxlIiwibGFzdFNlcUFycmF5IiwiY29tcHV0YXRpb24iLCJUcmFja2VyIiwiYXV0b3J1biIsInNlcSIsIm5vbnJlYWN0aXZlIiwic2VxQXJyYXkiLCJmZXRjaCIsIm1hcCIsImRvYyIsIl9pZCIsIml0ZW0iLCJzdG9wIiwic2VxQ2hhbmdlZFRvRW1wdHkiLCJzZXFDaGFuZ2VkVG9BcnJheSIsImlzU3RvcmVDdXJzb3IiLCJyZXN1bHQiLCJzZXFDaGFuZ2VkVG9DdXJzb3IiLCJhcnJheSIsImZyb20iLCJiYWRTZXF1ZW5jZUVycm9yIiwiZGlmZkFycmF5IiwiZWxsaXBzaXMiLCJsb25nU3RyIiwibWF4TGVuZ3RoIiwic3Vic3RyIiwiYXJyYXlUb0RlYnVnU3RyIiwib3V0Iiwic2VwIiwiaSIsInRvRGVidWdTdHIiLCJ0b1N0cmluZyIsIkpTT04iLCJzdHJpbmdpZnkiLCJjb25zdHJ1Y3RvciIsIm5hbWUiLCJzZXF1ZW5jZUdvdFZhbHVlIiwic2VxdWVuY2UiLCJlIiwiRXJyb3IiLCJpc0Z1bmN0aW9uIiwiZnVuYyIsImN1cnNvciIsImRpZmZGbiIsIlBhY2thZ2UiLCJEaWZmU2VxdWVuY2UiLCJkaWZmUXVlcnlPcmRlcmVkQ2hhbmdlcyIsIm9sZElkT2JqZWN0cyIsIm5ld0lkT2JqZWN0cyIsInBvc09sZCIsInBvc05ldyIsInBvc0N1ciIsImxlbmd0aEN1ciIsImZvckVhY2giLCJwdXNoIiwiYWRkZWRCZWZvcmUiLCJpZCIsImJlZm9yZSIsInBvc2l0aW9uIiwiZW50cmllcyIsIl9yZWYiLCJwb3MiLCJhZGRlZEF0IiwibW92ZWRCZWZvcmUiLCJvbGRQb3NpdGlvbiIsIm5ld1Bvc2l0aW9uIiwiX3JlZjIiLCJlbEN1clBvc2l0aW9uIiwibW92ZWRUbyIsInJlbW92ZWQiLCJwcmV2UG9zaXRpb24iLCJfcmVmMyIsInJlbW92ZWRBdCIsIl9yZWY0IiwiaWRTdHJpbmciLCJuZXdJdGVtIiwib2xkSXRlbSIsImNoYW5nZWRBdCIsImlkc1VzZWQiLCJpbmRleCIsInVuZGVmaW5lZCIsIlJhbmRvbSIsImluaXRpYWwiLCJvYnNlcnZlSGFuZGxlIiwiZG9jdW1lbnQiLCJhdEluZGV4IiwibmV3RG9jdW1lbnQiLCJvbGREb2N1bWVudCIsImZyb21JbmRleCIsInRvSW5kZXgiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxNQUFNQSxRQUFRLEdBQUcsU0FBQUEsQ0FBVUMsS0FBSyxFQUFFO0VBQ2hDLElBQUlDLElBQUksR0FBRyxPQUFPRCxLQUFLO0VBQ3ZCLE9BQU9BLEtBQUssSUFBSSxJQUFJLEtBQUtDLElBQUksSUFBSSxRQUFRLElBQUlBLElBQUksSUFBSSxVQUFVLENBQUM7QUFDbEUsQ0FBQztBQUNELE1BQU1DLEdBQUcsR0FBRyxTQUFBQSxDQUFVQyxHQUFHLEVBQUVDLEdBQUcsRUFBRTtFQUM5QixJQUFJQyxRQUFRLEdBQUdELEdBQUcsQ0FBQ0UsS0FBSyxDQUFDLEdBQUcsQ0FBQztFQUU3QixPQUFPLENBQUMs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RUFBRTtNQUN2RDVELFNBQVMsQ0FBQ3VFLE9BQU8sQ0FDZmdCLFFBQVEsQ0FBQzFFLEdBQUcsRUFBRTBFLFFBQVEsRUFBRUksU0FBUyxFQUFFQyxPQUFPLEVBQUVoQyxNQUFNLENBQUM7SUFDdkQ7RUFDRixDQUFDLENBQUM7RUFDRnlCLE9BQU8sR0FBRyxLQUFLO0VBRWYsT0FBTyxDQUFDNUUsUUFBUSxFQUFFNkUsYUFBYSxDQUFDO0FBQ2xDLENBQUMsQyIsImZpbGUiOiIvcGFja2FnZXMvb2JzZXJ2ZS1zZXF1ZW5jZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGlzT2JqZWN0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICByZXR1cm4gdmFsdWUgIT0gbnVsbCAmJiAodHlwZSA9PSAnb2JqZWN0JyB8fCB0eXBlID09ICdmdW5jdGlvbicpO1xufVxuY29uc3QgaGFzID0gZnVuY3Rpb24gKG9iaiwga2V5KSB7XG4gIHZhciBrZXlQYXJ0cyA9IGtleS5zcGxpdCgnLicpO1xuXG4gIHJldHVybiAhIW9iaiAmJiAoXG4gICAga2V5UGFydHMubGVuZ3RoID4gMVxuICAgICAgPyBoYXMob2JqW2tleS5zcGxpdCgnLicpWzBdXSwga2V5UGFydHMuc2xpY2UoMSkuam9pbignLicpKVxuICAgICAgOiBoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KVxuICApO1xufTtcblxuY29uc3Qgd2FybiA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKE9ic2VydmVTZXF1ZW5jZS5fc3VwcHJlc3NXYXJuaW5ncykge1xuICAgIE9ic2VydmVTZXF1ZW5jZS5fc3VwcHJlc3NXYXJuaW5ncy0tO1xuICB9IGVsc2Uge1xuICAgIGlmICh0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY29uc29sZS53YXJuKVxuICAgICAgY29uc29sZS53YXJuLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7XG5cbiAgICBPYnNlcnZlU2VxdWVuY2UuX2xvZ2dlZFdhcm5pbmdzKys7XG4gIH1cbn07XG5cbi8vIGlzQXJyYXkgcmV0dXJucyB0cnVlIGZvciBhcnJheXMgb2YgdGhlc2UgdHlwZXM6XG4vLyBzdGFuZGFyZCBhcnJheXM6IGluc3RhbmNlb2YgQXJyYXkgPT09IHRydWUsIF8uaXNBcnJheShhcnIpID09PSB0cnVlXG4vLyB2bSBnZW5lcmF0ZWQgYXJyYXlzOiBpbnN0YW5jZU9mIEFycmF5ID09PSBmYWxzZSwgXy5pc0FycmF5KGFycikgPT09IHRydWVcbi8vIHN1YmNsYXNzZWQgYXJyYXlzOiBpbnN0YW5jZW9mIEFycmF5ID09PSB0cnVlLCBfLmlzQXJyYXkoYXJyKSA9PT0gZmFsc2Vcbi8vIHNlZSBzcGVjaWZpYyB0ZXN0c1xuZnVuY3Rpb24gaXNBcnJheShhcnIpIHtcbiAgcmV0dXJuIGFyciBpbnN0YW5jZW9mIEFycmF5IHx8IEFycmF5LmlzQXJyYXkoYXJyKTtcbn1cblxuLy8gaXNJdGVyYWJsZSByZXR1cm5zIHRydWVzIGZvciBvYmplY3RzIGltcGxlbWVudGluZyBpdGVyYWJsZSBwcm90b2NvbCxcbi8vIGV4Y2VwdCBzdHJpbmdzLCBhcyB7eyNlYWNoICdzdHJpbmcnfX0gZG9lc24ndCBtYWtlIG11Y2ggc2Vuc2UuXG4vLyBSZXF1aXJlcyBFUzYrIGFuZCBkb2VzIG5vdCB3b3JrIGluIElFIChidXQgZGVncmFkZXMgZ3JhY2VmdWxseSkuXG4vLyBEb2VzIG5vdCBzdXBwb3J0IHRoZSBgbGVuZ3RoYCArIGluZGV4IHByb3RvY29sIGFsc28gc3VwcG9ydGVkIGJ5IEFycmF5LmZyb21cbmZ1bmN0aW9uIGlzSXRlcmFibGUgKG9iamVjdCkge1xuICBjb25zdCBpdGVyID0gdHlwZW9mIFN5bWJvbCAhPSAndW5kZWZpbmVkJyAmJiBTeW1ib2wuaXRlcmF0b3I7XG4gIHJldHVybiBpdGVyXG4gICAgJiYgb2JqZWN0IGluc3RhbmNlb2YgT2JqZWN0IC8vIG5vdGU6IHJldHVybnMgZmFsc2UgZm9yIHN0cmluZ3NcbiAgICAmJiB0eXBlb2Ygb2JqZWN0W2l0ZXJdID09ICdmdW5jdGlvbic7IC8vIGltcGxlbWVudHMgaXRlcmFibGUgcHJvdG9jb2xcbn1cblxuY29uc3QgaWRTdHJpbmdpZnkgPSBNb25nb0lELmlkU3RyaW5naWZ5O1xuY29uc3QgaWRQYXJzZSA9IE1vbmdvSUQuaWRQYXJzZTtcblxuT2JzZXJ2ZVNlcXVlbmNlID0ge1xuICBfc3VwcHJlc3NXYXJuaW5nczogMCxcbiAgX2xvZ2dlZFdhcm5pbmdzOiAwLFxuXG4gIC8vIEEgbWVjaGFuaXNtIHNpbWlsYXIgdG8gY3Vyc29yLm9ic2VydmUgd2hpY2ggcmVjZWl2ZXMgYSByZWFjdGl2ZVxuICAvLyBmdW5jdGlvbiByZXR1cm5pbmcgYSBzZXF1ZW5jZSB0eXBlIGFuZCBmaXJpbmcgYXBwcm9wcmlhdGUgY2FsbGJhY2tzXG4gIC8vIHdoZW4gdGhlIHZhbHVlIGNoYW5nZXMuXG4gIC8vXG4gIC8vIEBwYXJhbSBzZXF1ZW5jZUZ1bmMge0Z1bmN0aW9ufSBhIHJlYWN0aXZlIGZ1bmN0aW9uIHJldHVybmluZyBhXG4gIC8vICAgICBzZXF1ZW5jZSB0eXBlLiBUaGUgY3VycmVudGx5IHN1cHBvcnRlZCBzZXF1ZW5jZSB0eXBlcyBhcmU6XG4gIC8vICAgICBBcnJheSwgQ3Vyc29yLCBhbmQgbnVsbC5cbiAgLy9cbiAgLy8gQHBhcmFtIGNhbGxiYWNrcyB7T2JqZWN0fSBzaW1pbGFyIHRvIGEgc3BlY2lmaWMgc3Vic2V0IG9mXG4gIC8vICAgICBjYWxsYmFja3MgcGFzc2VkIHRvIGBjdXJzb3Iub2JzZXJ2ZWBcbiAgLy8gICAgIChodHRwOi8vZG9jcy5tZXRlb3IuY29tLyNvYnNlcnZlKSwgd2l0aCBtaW5vciB2YXJpYXRpb25zIHRvXG4gIC8vICAgICBzdXBwb3J0IHRoZSBmYWN0IHRoYXQgbm90IGFsbCBzZXF1ZW5jZXMgY29udGFpbiBvYmplY3RzIHdpdGhcbiAgLy8gICAgIF9pZCBmaWVsZHMuICBTcGVjaWZpY2FsbHk6XG4gIC8vXG4gIC8vICAgICAqIGFkZGVkQXQoaWQsIGl0ZW0sIGF0SW5kZXgsIGJlZm9yZUlkKVxuICAvLyAgICAgKiBjaGFuZ2VkQXQoaWQsIG5ld0l0ZW0sIG9sZEl0ZW0sIGF0SW5kZXgpXG4gIC8vICAgICAqIHJlbW92ZWRBdChpZCwgb2xkSXRlbSwgYXRJbmRleClcbiAgLy8gICAgICogbW92ZWRUbyhpZCwgaXRlbSwgZnJvbUluZGV4LCB0b0luZGV4LCBiZWZvcmVJZClcbiAgLy9cbiAgLy8gQHJldHVybnMge09iamVjdChzdG9wOiBGdW5jdGlvbil9IGNhbGwgJ3N0b3AnIG9uIHRoZSByZXR1cm4gdmFsdWVcbiAgLy8gICAgIHRvIHN0b3Agb2JzZXJ2aW5nIHRoaXMgc2VxdWVuY2UgZnVuY3Rpb24uXG4gIC8vXG4gIC8vIFdlIGRvbid0IG1ha2UgYW55IGFzc3VtcHRpb25zIGFib3V0IG91ciBhYmlsaXR5IHRvIGNvbXBhcmUgc2VxdWVuY2VcbiAgLy8gZWxlbWVudHMgKGllLCB3ZSBkb24ndCBhc3N1bWUgRUpTT04uZXF1YWxzIHdvcmtzOyBtYXliZSB0aGVyZSBpcyBleHRyYVxuICAvLyBzdGF0ZS9yYW5kb20gbWV0aG9kcyBvbiB0aGUgb2JqZWN0cykgc28gdW5saWtlIGN1cnNvci5vYnNlcnZlLCB3ZSBtYXlcbiAgLy8gc29tZXRpbWVzIGNhbGwgY2hhbmdlZEF0KCkgd2hlbiBub3RoaW5nIGFjdHVhbGx5IGNoYW5nZWQuXG4gIC8vIFhYWCBjb25zaWRlciBpZiB3ZSAqY2FuKiBtYWtlIHRoZSBzdHJvbmdlciBhc3N1bXB0aW9uIGFuZCBhdm9pZFxuICAvLyAgICAgbm8tb3AgY2hhbmdlZEF0IGNhbGxzIChpbiBzb21lIGNhc2VzPylcbiAgLy9cbiAgLy8gWFhYIGN1cnJlbnRseSBvbmx5IHN1cHBvcnRzIHRoZSBjYWxsYmFja3MgdXNlZCBieSBvdXJcbiAgLy8gaW1wbGVtZW50YXRpb24gb2Yge3sjZWFjaH19LCBidXQgdGhpcyBjYW4gYmUgZXhwYW5kZWQuXG4gIC8vXG4gIC8vIFhYWCAjZWFjaCBkb2Vzbid0IHVzZSB0aGUgaW5kaWNlcyAodGhvdWdoIHdlJ2xsIGV2ZW50dWFsbHkgbmVlZFxuICAvLyBhIHdheSB0byBnZXQgdGhlbSB3aGVuIHdlIHN1cHBvcnQgYEBpbmRleGApLCBidXQgY2FsbGluZ1xuICAvLyBgY3Vyc29yLm9ic2VydmVgIGNhdXNlcyB0aGUgaW5kZXggdG8gYmUgY2FsY3VsYXRlZCBvbiBldmVyeVxuICAvLyBjYWxsYmFjayB1c2luZyBhIGxpbmVhciBzY2FuICh1bmxlc3MgeW91IHR1cm4gaXQgb2ZmIGJ5IHBhc3NpbmdcbiAgLy8gYF9ub19pbmRpY2VzYCkuICBBbnkgd2F5IHRvIGF2b2lkIGNhbGN1bGF0aW5nIGluZGljZXMgb24gYSBwdXJlXG4gIC8vIGN1cnNvciBvYnNlcnZlIGxpa2Ugd2UgdXNlZCB0bz9cbiAgb2JzZXJ2ZTogZnVuY3Rpb24gKHNlcXVlbmNlRnVuYywgY2FsbGJhY2tzKSB7XG4gICAgdmFyIGxhc3RTZXEgPSBudWxsO1xuICAgIHZhciBhY3RpdmVPYnNlcnZlSGFuZGxlID0gbnVsbDtcblxuICAgIC8vICdsYXN0U2VxQXJyYXknIGNvbnRhaW5zIHRoZSBwcmV2aW91cyB2YWx1ZSBvZiB0aGUgc2VxdWVuY2VcbiAgICAvLyB3ZSdyZSBvYnNlcnZpbmcuIEl0IGlzIGFuIGFycmF5IG9mIG9iamVjdHMgd2l0aCAnX2lkJyBhbmRcbiAgICAvLyAnaXRlbScgZmllbGRzLiAgJ2l0ZW0nIGlzIHRoZSBlbGVtZW50IGluIHRoZSBhcnJheSwgb3IgdGhlXG4gICAgLy8gZG9jdW1lbnQgaW4gdGhlIGN1cnNvci5cbiAgICAvL1xuICAgIC8vICdfaWQnIGlzIHdoaWNoZXZlciBvZiB0aGUgZm9sbG93aW5nIGlzIHJlbGV2YW50LCB1bmxlc3MgaXQgaGFzXG4gICAgLy8gYWxyZWFkeSBhcHBlYXJlZCAtLSBpbiB3aGljaCBjYXNlIGl0J3MgcmFuZG9tbHkgZ2VuZXJhdGVkLlxuICAgIC8vXG4gICAgLy8gKiBpZiAnaXRlbScgaXMgYW4gb2JqZWN0OlxuICAgIC8vICAgKiBhbiAnX2lkJyBmaWVsZCwgaWYgcHJlc2VudFxuICAgIC8vICAgKiBvdGhlcndpc2UsIHRoZSBpbmRleCBpbiB0aGUgYXJyYXlcbiAgICAvL1xuICAgIC8vICogaWYgJ2l0ZW0nIGlzIGEgbnVtYmVyIG9yIHN0cmluZywgdXNlIHRoYXQgdmFsdWVcbiAgICAvL1xuICAgIC8vIFhYWCB0aGlzIGNhbiBiZSBnZW5lcmFsaXplZCBieSBhbGxvd2luZyB7eyNlYWNofX0gdG8gYWNjZXB0IGFcbiAgICAvLyBnZW5lcmFsICdrZXknIGFyZ3VtZW50IHdoaWNoIGNvdWxkIGJlIGEgZnVuY3Rpb24sIGEgZG90dGVkXG4gICAgLy8gZmllbGQgbmFtZSwgb3IgdGhlIHNwZWNpYWwgQGluZGV4IHZhbHVlLlxuICAgIHZhciBsYXN0U2VxQXJyYXkgPSBbXTsgLy8gZWxlbWVudHMgYXJlIG9iamVjdHMgb2YgZm9ybSB7X2lkLCBpdGVtfVxuICAgIHZhciBjb21wdXRhdGlvbiA9IFRyYWNrZXIuYXV0b3J1bihmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgc2VxID0gc2VxdWVuY2VGdW5jKCk7XG5cbiAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2VxQXJyYXk7IC8vIHNhbWUgc3RydWN0dXJlIGFzIGBsYXN0U2VxQXJyYXlgIGFib3ZlLlxuXG4gICAgICAgIGlmIChhY3RpdmVPYnNlcnZlSGFuZGxlKSB7XG4gICAgICAgICAgLy8gSWYgd2Ugd2VyZSBwcmV2aW91c2x5IG9ic2VydmluZyBhIGN1cnNvciwgcmVwbGFjZSBsYXN0U2VxQXJyYXkgd2l0aFxuICAgICAgICAgIC8vIG1vcmUgdXAtdG8tZGF0ZSBpbmZvcm1hdGlvbi4gIFRoZW4gc3RvcCB0aGUgb2xkIG9ic2VydmUuXG4gICAgICAgICAgbGFzdFNlcUFycmF5ID0gbGFzdFNlcS5mZXRjaCgpLm1hcChmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgICAgICByZXR1cm4ge19pZDogZG9jLl9pZCwgaXRlbTogZG9jfTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBhY3RpdmVPYnNlcnZlSGFuZGxlLnN0b3AoKTtcbiAgICAgICAgICBhY3RpdmVPYnNlcnZlSGFuZGxlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghc2VxKSB7XG4gICAgICAgICAgc2VxQXJyYXkgPSBzZXFDaGFuZ2VkVG9FbXB0eShsYXN0U2VxQXJyYXksIGNhbGxiYWNrcyk7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNBcnJheShzZXEpKSB7XG4gICAgICAgICAgc2VxQXJyYXkgPSBzZXFDaGFuZ2VkVG9BcnJheShsYXN0U2VxQXJyYXksIHNlcSwgY2FsbGJhY2tzKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc1N0b3JlQ3Vyc29yKHNlcSkpIHtcbiAgICAgICAgICB2YXIgcmVzdWx0IC8qIFtzZXFBcnJheSwgYWN0aXZlT2JzZXJ2ZUhhbmRsZV0gKi8gPVxuICAgICAgICAgICAgICAgIHNlcUNoYW5nZWRUb0N1cnNvcihsYXN0U2VxQXJyYXksIHNlcSwgY2FsbGJhY2tzKTtcbiAgICAgICAgICBzZXFBcnJheSA9IHJlc3VsdFswXTtcbiAgICAgICAgICBhY3RpdmVPYnNlcnZlSGFuZGxlID0gcmVzdWx0WzFdO1xuICAgICAgICB9IGVsc2UgaWYgKGlzSXRlcmFibGUoc2VxKSkge1xuICAgICAgICAgIGNvbnN0IGFycmF5ID0gQXJyYXkuZnJvbShzZXEpO1xuICAgICAgICAgIHNlcUFycmF5ID0gc2VxQ2hhbmdlZFRvQXJyYXkobGFzdFNlcUFycmF5LCBhcnJheSwgY2FsbGJhY2tzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBiYWRTZXF1ZW5jZUVycm9yKHNlcSk7XG4gICAgICAgIH1cblxuICAgICAgICBkaWZmQXJyYXkobGFzdFNlcUFycmF5LCBzZXFBcnJheSwgY2FsbGJhY2tzKTtcbiAgICAgICAgbGFzdFNlcSA9IHNlcTtcbiAgICAgICAgbGFzdFNlcUFycmF5ID0gc2VxQXJyYXk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbXB1dGF0aW9uLnN0b3AoKTtcbiAgICAgICAgaWYgKGFjdGl2ZU9ic2VydmVIYW5kbGUpXG4gICAgICAgICAgYWN0aXZlT2JzZXJ2ZUhhbmRsZS5zdG9wKCk7XG4gICAgICB9XG4gICAgfTtcbiAgfSxcblxuICAvLyBGZXRjaCB0aGUgaXRlbXMgb2YgYHNlcWAgaW50byBhbiBhcnJheSwgd2hlcmUgYHNlcWAgaXMgb2Ygb25lIG9mIHRoZVxuICAvLyBzZXF1ZW5jZSB0eXBlcyBhY2NlcHRlZCBieSBgb2JzZXJ2ZWAuICBJZiBgc2VxYCBpcyBhIGN1cnNvciwgYVxuICAvLyBkZXBlbmRlbmN5IGlzIGVzdGFibGlzaGVkLlxuICBmZXRjaDogZnVuY3Rpb24gKHNlcSkge1xuICAgIGlmICghc2VxKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KHNlcSkpIHtcbiAgICAgIHJldHVybiBzZXE7XG4gICAgfSBlbHNlIGlmIChpc1N0b3JlQ3Vyc29yKHNlcSkpIHtcbiAgICAgIHJldHVybiBzZXEuZmV0Y2goKTtcbiAgICB9IGVsc2UgaWYgKGlzSXRlcmFibGUoc2VxKSkge1xuICAgICAgcmV0dXJuIEFycmF5LmZyb20oc2VxKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgYmFkU2VxdWVuY2VFcnJvcihzZXEpO1xuICAgIH1cbiAgfVxufTtcblxuZnVuY3Rpb24gZWxsaXBzaXMobG9uZ1N0ciwgbWF4TGVuZ3RoKSB7XG4gIGlmKCFtYXhMZW5ndGgpIG1heExlbmd0aCA9IDEwMDtcbiAgaWYobG9uZ1N0ci5sZW5ndGggPCBtYXhMZW5ndGgpIHJldHVybiBsb25nU3RyO1xuICByZXR1cm4gbG9uZ1N0ci5zdWJzdHIoMCwgbWF4TGVuZ3RoLTEpICsgJ+KApic7XG59XG5cbmZ1bmN0aW9uIGFycmF5VG9EZWJ1Z1N0cih2YWx1ZSwgbWF4TGVuZ3RoKSB7XG4gIHZhciBvdXQgPSAnJywgc2VwID0gJyc7XG4gIGZvcih2YXIgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gdmFsdWVbaV07XG4gICAgb3V0ICs9IHNlcCArIHRvRGVidWdTdHIoaXRlbSwgbWF4TGVuZ3RoKTtcbiAgICBpZihvdXQubGVuZ3RoID4gbWF4TGVuZ3RoKSByZXR1cm4gb3V0O1xuICAgIHNlcCA9ICcsICc7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gdG9EZWJ1Z1N0cih2YWx1ZSwgbWF4TGVuZ3RoKSB7XG4gIGlmKCFtYXhMZW5ndGgpIG1heExlbmd0aCA9IDE1MDtcbiAgY29uc3QgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgc3dpdGNoKHR5cGUpIHtcbiAgICBjYXNlICd1bmRlZmluZWQnOlxuICAgICAgcmV0dXJuIHR5cGU7XG4gICAgY2FzZSAnbnVtYmVyJzpcbiAgICAgIHJldHVybiB2YWx1ZS50b1N0cmluZygpO1xuICAgIGNhc2UgJ3N0cmluZyc6XG4gICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUpOyAvLyBhZGQgcXVvdGVzXG4gICAgY2FzZSAnb2JqZWN0JzpcbiAgICAgIGlmKHZhbHVlID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgICB9IGVsc2UgaWYoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuICdBcnJheSBbJyArIGFycmF5VG9EZWJ1Z1N0cih2YWx1ZSwgbWF4TGVuZ3RoKSArICddJztcbiAgICAgIH0gZWxzZSBpZihTeW1ib2wuaXRlcmF0b3IgaW4gdmFsdWUpIHsgLy8gTWFwIGFuZCBTZXQgYXJlIG5vdCBoYW5kbGVkIGJ5IEpTT04uc3RyaW5naWZ5XG4gICAgICAgIHJldHVybiB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lXG4gICAgICAgICAgKyAnIFsnICsgYXJyYXlUb0RlYnVnU3RyKEFycmF5LmZyb20odmFsdWUpLCBtYXhMZW5ndGgpXG4gICAgICAgICAgKyAnXSc7IC8vIEFycmF5LmZyb20gZG9lc24ndCB3b3JrIGluIElFLCBidXQgbmVpdGhlciBkbyBpdGVyYXRvcnMgc28gaXQncyB1bnJlYWNoYWJsZVxuICAgICAgfSBlbHNlIHsgLy8gdXNlIEpTT04uc3RyaW5naWZ5IChzb21ldGltZXMgdG9TdHJpbmcgY2FuIGJlIGJldHRlciBidXQgd2UgZG9uJ3Qga25vdylcbiAgICAgICAgcmV0dXJuIHZhbHVlLmNvbnN0cnVjdG9yLm5hbWUgKyAnICdcbiAgICAgICAgICAgICArIGVsbGlwc2lzKEpTT04uc3RyaW5naWZ5KHZhbHVlKSwgbWF4TGVuZ3RoKTtcbiAgICAgIH1cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIHR5cGUgKyAnOiAnICsgdmFsdWUudG9TdHJpbmcoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBzZXF1ZW5jZUdvdFZhbHVlKHNlcXVlbmNlKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuICcgR290ICcgKyB0b0RlYnVnU3RyKHNlcXVlbmNlKTtcbiAgfSBjYXRjaChlKSB7XG4gICAgcmV0dXJuICcnXG4gIH1cbn1cblxuY29uc3QgYmFkU2VxdWVuY2VFcnJvciA9IGZ1bmN0aW9uIChzZXF1ZW5jZSkge1xuICByZXR1cm4gbmV3IEVycm9yKFwie3sjZWFjaH19IGN1cnJlbnRseSBvbmx5IGFjY2VwdHMgXCIgK1xuICAgICAgICAgICAgICAgICAgIFwiYXJyYXlzLCBjdXJzb3JzLCBpdGVyYWJsZXMgb3IgZmFsc2V5IHZhbHVlcy5cIiArXG4gICAgICAgICAgICAgICAgICAgc2VxdWVuY2VHb3RWYWx1ZShzZXF1ZW5jZSkpO1xufTtcblxuY29uc3QgaXNGdW5jdGlvbiA9IChmdW5jKSA9PiB7XG4gIHJldHVybiB0eXBlb2YgZnVuYyA9PT0gXCJmdW5jdGlvblwiO1xufVxuXG5jb25zdCBpc1N0b3JlQ3Vyc29yID0gZnVuY3Rpb24gKGN1cnNvcikge1xuICByZXR1cm4gY3Vyc29yICYmIGlzT2JqZWN0KGN1cnNvcikgJiZcbiAgICBpc0Z1bmN0aW9uKGN1cnNvci5vYnNlcnZlKSAmJiBpc0Z1bmN0aW9uKGN1cnNvci5mZXRjaCk7XG59O1xuXG4vLyBDYWxjdWxhdGVzIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIGBsYXN0U2VxQXJyYXlgIGFuZFxuLy8gYHNlcUFycmF5YCBhbmQgY2FsbHMgYXBwcm9wcmlhdGUgZnVuY3Rpb25zIGZyb20gYGNhbGxiYWNrc2AuXG4vLyBSZXVzZXMgTWluaW1vbmdvJ3MgZGlmZiBhbGdvcml0aG0gaW1wbGVtZW50YXRpb24uXG5jb25zdCBkaWZmQXJyYXkgPSBmdW5jdGlvbiAobGFzdFNlcUFycmF5LCBzZXFBcnJheSwgY2FsbGJhY2tzKSB7XG4gIHZhciBkaWZmRm4gPSBQYWNrYWdlWydkaWZmLXNlcXVlbmNlJ10uRGlmZlNlcXVlbmNlLmRpZmZRdWVyeU9yZGVyZWRDaGFuZ2VzO1xuICB2YXIgb2xkSWRPYmplY3RzID0gW107XG4gIHZhciBuZXdJZE9iamVjdHMgPSBbXTtcbiAgdmFyIHBvc09sZCA9IHt9OyAvLyBtYXBzIGZyb20gaWRTdHJpbmdpZnknZCBpZHNcbiAgdmFyIHBvc05ldyA9IHt9OyAvLyBkaXR0b1xuICB2YXIgcG9zQ3VyID0ge307XG4gIHZhciBsZW5ndGhDdXIgPSBsYXN0U2VxQXJyYXkubGVuZ3RoO1xuXG4gIHNlcUFycmF5LmZvckVhY2goZnVuY3Rpb24gKGRvYywgaSkge1xuICAgIG5ld0lkT2JqZWN0cy5wdXNoKHtfaWQ6IGRvYy5faWR9KTtcbiAgICBwb3NOZXdbaWRTdHJpbmdpZnkoZG9jLl9pZCldID0gaTtcbiAgfSk7XG4gIGxhc3RTZXFBcnJheS5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGkpIHtcbiAgICBvbGRJZE9iamVjdHMucHVzaCh7X2lkOiBkb2MuX2lkfSk7XG4gICAgcG9zT2xkW2lkU3RyaW5naWZ5KGRvYy5faWQpXSA9IGk7XG4gICAgcG9zQ3VyW2lkU3RyaW5naWZ5KGRvYy5faWQpXSA9IGk7XG4gIH0pO1xuXG4gIC8vIEFycmF5cyBjYW4gY29udGFpbiBhcmJpdHJhcnkgb2JqZWN0cy4gV2UgZG9uJ3QgZGlmZiB0aGVcbiAgLy8gb2JqZWN0cy4gSW5zdGVhZCB3ZSBhbHdheXMgZmlyZSAnY2hhbmdlZEF0JyBjYWxsYmFjayBvbiBldmVyeVxuICAvLyBvYmplY3QuIFRoZSBjb25zdW1lciBvZiBgb2JzZXJ2ZS1zZXF1ZW5jZWAgc2hvdWxkIGRlYWwgd2l0aFxuICAvLyBpdCBhcHByb3ByaWF0ZWx5LlxuICBkaWZmRm4ob2xkSWRPYmplY3RzLCBuZXdJZE9iamVjdHMsIHtcbiAgICBhZGRlZEJlZm9yZTogZnVuY3Rpb24gKGlkLCBkb2MsIGJlZm9yZSkge1xuICAgICAgdmFyIHBvc2l0aW9uID0gYmVmb3JlID8gcG9zQ3VyW2lkU3RyaW5naWZ5KGJlZm9yZSldIDogbGVuZ3RoQ3VyO1xuXG4gICAgICBpZiAoYmVmb3JlKSB7XG4gICAgICAgIC8vIElmIG5vdCBhZGRpbmcgYXQgdGhlIGVuZCwgd2UgbmVlZCB0byB1cGRhdGUgaW5kZXhlcy5cbiAgICAgICAgLy8gWFhYIHRoaXMgY2FuIHN0aWxsIGJlIGltcHJvdmVkIGdyZWF0bHkhXG4gICAgICAgIE9iamVjdC5lbnRyaWVzKHBvc0N1cikuZm9yRWFjaChmdW5jdGlvbiAoW2lkLCBwb3NdKSB7XG4gICAgICAgICAgaWYgKHBvcyA+PSBwb3NpdGlvbilcbiAgICAgICAgICAgIHBvc0N1cltpZF0rKztcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIGxlbmd0aEN1cisrO1xuICAgICAgcG9zQ3VyW2lkU3RyaW5naWZ5KGlkKV0gPSBwb3NpdGlvbjtcblxuICAgICAgY2FsbGJhY2tzLmFkZGVkQXQoXG4gICAgICAgIGlkLFxuICAgICAgICBzZXFBcnJheVtwb3NOZXdbaWRTdHJpbmdpZnkoaWQpXV0uaXRlbSxcbiAgICAgICAgcG9zaXRpb24sXG4gICAgICAgIGJlZm9yZSk7XG4gICAgfSxcbiAgICBtb3ZlZEJlZm9yZTogZnVuY3Rpb24gKGlkLCBiZWZvcmUpIHtcbiAgICAgIGlmIChpZCA9PT0gYmVmb3JlKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIHZhciBvbGRQb3NpdGlvbiA9IHBvc0N1cltpZFN0cmluZ2lmeShpZCldO1xuICAgICAgdmFyIG5ld1Bvc2l0aW9uID0gYmVmb3JlID8gcG9zQ3VyW2lkU3RyaW5naWZ5KGJlZm9yZSldIDogbGVuZ3RoQ3VyO1xuXG4gICAgICAvLyBNb3ZpbmcgdGhlIGl0ZW0gZm9yd2FyZC4gVGhlIG5ldyBlbGVtZW50IGlzIGxvc2luZyBvbmUgcG9zaXRpb24gYXMgaXRcbiAgICAgIC8vIHdhcyByZW1vdmVkIGZyb20gdGhlIG9sZCBwb3NpdGlvbiBiZWZvcmUgYmVpbmcgaW5zZXJ0ZWQgYXQgdGhlIG5ld1xuICAgICAgLy8gcG9zaXRpb24uXG4gICAgICAvLyBFeC46ICAgMCAgKjEqICAyICAgMyAgIDRcbiAgICAgIC8vICAgICAgICAwICAgMiAgIDMgICoxKiAgNFxuICAgICAgLy8gVGhlIG9yaWdpbmFsIGlzc3VlZCBjYWxsYmFjayBpcyBcIjFcIiBiZWZvcmUgXCI0XCIuXG4gICAgICAvLyBUaGUgcG9zaXRpb24gb2YgXCIxXCIgaXMgMSwgdGhlIHBvc2l0aW9uIG9mIFwiNFwiIGlzIDQuXG4gICAgICAvLyBUaGUgZ2VuZXJhdGVkIG1vdmUgaXMgKDEpIC0+ICgzKVxuICAgICAgaWYgKG5ld1Bvc2l0aW9uID4gb2xkUG9zaXRpb24pIHtcbiAgICAgICAgbmV3UG9zaXRpb24tLTtcbiAgICAgIH1cblxuICAgICAgLy8gRml4IHVwIHRoZSBwb3NpdGlvbnMgb2YgZWxlbWVudHMgYmV0d2VlbiB0aGUgb2xkIGFuZCB0aGUgbmV3IHBvc2l0aW9uc1xuICAgICAgLy8gb2YgdGhlIG1vdmVkIGVsZW1lbnQuXG4gICAgICAvL1xuICAgICAgLy8gVGhlcmUgYXJlIHR3byBjYXNlczpcbiAgICAgIC8vICAgMS4gVGhlIGVsZW1lbnQgaXMgbW92ZWQgZm9yd2FyZC4gVGhlbiBhbGwgdGhlIHBvc2l0aW9ucyBpbiBiZXR3ZWVuXG4gICAgICAvLyAgIGFyZSBtb3ZlZCBiYWNrLlxuICAgICAgLy8gICAyLiBUaGUgZWxlbWVudCBpcyBtb3ZlZCBiYWNrLiBUaGVuIHRoZSBwb3NpdGlvbnMgaW4gYmV0d2VlbiAqYW5kKiB0aGVcbiAgICAgIC8vICAgZWxlbWVudCB0aGF0IGlzIGN1cnJlbnRseSBzdGFuZGluZyBvbiB0aGUgbW92ZWQgZWxlbWVudCdzIGZ1dHVyZVxuICAgICAgLy8gICBwb3NpdGlvbiBhcmUgbW92ZWQgZm9yd2FyZC5cbiAgICAgIE9iamVjdC5lbnRyaWVzKHBvc0N1cikuZm9yRWFjaChmdW5jdGlvbiAoW2lkLCBlbEN1clBvc2l0aW9uXSkge1xuICAgICAgICBpZiAob2xkUG9zaXRpb24gPCBlbEN1clBvc2l0aW9uICYmIGVsQ3VyUG9zaXRpb24gPCBuZXdQb3NpdGlvbilcbiAgICAgICAgICBwb3NDdXJbaWRdLS07XG4gICAgICAgIGVsc2UgaWYgKG5ld1Bvc2l0aW9uIDw9IGVsQ3VyUG9zaXRpb24gJiYgZWxDdXJQb3NpdGlvbiA8IG9sZFBvc2l0aW9uKVxuICAgICAgICAgIHBvc0N1cltpZF0rKztcbiAgICAgIH0pO1xuXG4gICAgICAvLyBGaW5hbGx5LCB1cGRhdGUgdGhlIHBvc2l0aW9uIG9mIHRoZSBtb3ZlZCBlbGVtZW50LlxuICAgICAgcG9zQ3VyW2lkU3RyaW5naWZ5KGlkKV0gPSBuZXdQb3NpdGlvbjtcblxuICAgICAgY2FsbGJhY2tzLm1vdmVkVG8oXG4gICAgICAgIGlkLFxuICAgICAgICBzZXFBcnJheVtwb3NOZXdbaWRTdHJpbmdpZnkoaWQpXV0uaXRlbSxcbiAgICAgICAgb2xkUG9zaXRpb24sXG4gICAgICAgIG5ld1Bvc2l0aW9uLFxuICAgICAgICBiZWZvcmUpO1xuICAgIH0sXG4gICAgcmVtb3ZlZDogZnVuY3Rpb24gKGlkKSB7XG4gICAgICB2YXIgcHJldlBvc2l0aW9uID0gcG9zQ3VyW2lkU3RyaW5naWZ5KGlkKV07XG5cbiAgICAgIE9iamVjdC5lbnRyaWVzKHBvc0N1cikuZm9yRWFjaChmdW5jdGlvbiAoW2lkLCBwb3NdKSB7XG4gICAgICAgIGlmIChwb3MgPj0gcHJldlBvc2l0aW9uKVxuICAgICAgICAgIHBvc0N1cltpZF0tLTtcbiAgICAgIH0pO1xuXG4gICAgICBkZWxldGUgcG9zQ3VyW2lkU3RyaW5naWZ5KGlkKV07XG4gICAgICBsZW5ndGhDdXItLTtcblxuICAgICAgY2FsbGJhY2tzLnJlbW92ZWRBdChcbiAgICAgICAgaWQsXG4gICAgICAgIGxhc3RTZXFBcnJheVtwb3NPbGRbaWRTdHJpbmdpZnkoaWQpXV0uaXRlbSxcbiAgICAgICAgcHJldlBvc2l0aW9uKTtcbiAgICB9XG4gIH0pO1xuICBcbiAgT2JqZWN0LmVudHJpZXMocG9zTmV3KS5mb3JFYWNoKGZ1bmN0aW9uIChbaWRTdHJpbmcsIHBvc10pIHtcblxuICAgIHZhciBpZCA9IGlkUGFyc2UoaWRTdHJpbmcpO1xuICAgIFxuICAgIGlmIChoYXMocG9zT2xkLCBpZFN0cmluZykpIHtcbiAgICAgIC8vIHNwZWNpZmljYWxseSBmb3IgcHJpbWl0aXZlIHR5cGVzLCBjb21wYXJlIGVxdWFsaXR5IGJlZm9yZVxuICAgICAgLy8gZmlyaW5nIHRoZSAnY2hhbmdlZEF0JyBjYWxsYmFjay4gb3RoZXJ3aXNlLCBhbHdheXMgZmlyZSBpdFxuICAgICAgLy8gYmVjYXVzZSBkb2luZyBhIGRlZXAgRUpTT04gY29tcGFyaXNvbiBpcyBub3QgZ3VhcmFudGVlZCB0b1xuICAgICAgLy8gd29yayAoYW4gYXJyYXkgY2FuIGNvbnRhaW4gYXJiaXRyYXJ5IG9iamVjdHMsIGFuZCAndHJhbnNmb3JtJ1xuICAgICAgLy8gY2FuIGJlIHVzZWQgb24gY3Vyc29ycykuIGFsc28sIGRlZXAgZGlmZmluZyBpcyBub3RcbiAgICAgIC8vIG5lY2Vzc2FyaWx5IHRoZSBtb3N0IGVmZmljaWVudCAoaWYgb25seSBhIHNwZWNpZmljIHN1YmZpZWxkXG4gICAgICAvLyBvZiB0aGUgb2JqZWN0IGlzIGxhdGVyIGFjY2Vzc2VkKS5cbiAgICAgIHZhciBuZXdJdGVtID0gc2VxQXJyYXlbcG9zXS5pdGVtO1xuICAgICAgdmFyIG9sZEl0ZW0gPSBsYXN0U2VxQXJyYXlbcG9zT2xkW2lkU3RyaW5nXV0uaXRlbTtcblxuICAgICAgaWYgKHR5cGVvZiBuZXdJdGVtID09PSAnb2JqZWN0JyB8fCBuZXdJdGVtICE9PSBvbGRJdGVtKVxuICAgICAgICAgIGNhbGxiYWNrcy5jaGFuZ2VkQXQoaWQsIG5ld0l0ZW0sIG9sZEl0ZW0sIHBvcyk7XG4gICAgICB9XG4gIH0pO1xufTtcblxuc2VxQ2hhbmdlZFRvRW1wdHkgPSBmdW5jdGlvbiAobGFzdFNlcUFycmF5LCBjYWxsYmFja3MpIHtcbiAgcmV0dXJuIFtdO1xufTtcblxuc2VxQ2hhbmdlZFRvQXJyYXkgPSBmdW5jdGlvbiAobGFzdFNlcUFycmF5LCBhcnJheSwgY2FsbGJhY2tzKSB7XG4gIHZhciBpZHNVc2VkID0ge307XG4gIHZhciBzZXFBcnJheSA9IGFycmF5Lm1hcChmdW5jdGlvbiAoaXRlbSwgaW5kZXgpIHtcbiAgICB2YXIgaWQ7XG4gICAgaWYgKHR5cGVvZiBpdGVtID09PSAnc3RyaW5nJykge1xuICAgICAgLy8gZW5zdXJlIG5vdCBlbXB0eSwgc2luY2Ugb3RoZXIgbGF5ZXJzIChlZyBEb21SYW5nZSkgYXNzdW1lIHRoaXMgYXMgd2VsbFxuICAgICAgaWQgPSBcIi1cIiArIGl0ZW07XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgaXRlbSA9PT0gJ251bWJlcicgfHxcbiAgICAgICAgICAgICAgIHR5cGVvZiBpdGVtID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgICAgICAgIGl0ZW0gPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgICAgaXRlbSA9PT0gbnVsbCkge1xuICAgICAgaWQgPSBpdGVtO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnKSB7XG4gICAgICBpZCA9IChpdGVtICYmICgnX2lkJyBpbiBpdGVtKSkgPyBpdGVtLl9pZCA6IGluZGV4O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJ7eyNlYWNofX0gZG9lc24ndCBzdXBwb3J0IGFycmF5cyB3aXRoIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICBcImVsZW1lbnRzIG9mIHR5cGUgXCIgKyB0eXBlb2YgaXRlbSk7XG4gICAgfVxuXG4gICAgdmFyIGlkU3RyaW5nID0gaWRTdHJpbmdpZnkoaWQpO1xuICAgIGlmIChpZHNVc2VkW2lkU3RyaW5nXSkge1xuICAgICAgaWYgKGl0ZW0gJiYgdHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnICYmICdfaWQnIGluIGl0ZW0pXG4gICAgICAgIHdhcm4oXCJkdXBsaWNhdGUgaWQgXCIgKyBpZCArIFwiIGluXCIsIGFycmF5KTtcbiAgICAgIGlkID0gUmFuZG9tLmlkKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlkc1VzZWRbaWRTdHJpbmddID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4geyBfaWQ6IGlkLCBpdGVtOiBpdGVtIH07XG4gIH0pO1xuXG4gIHJldHVybiBzZXFBcnJheTtcbn07XG5cbnNlcUNoYW5nZWRUb0N1cnNvciA9IGZ1bmN0aW9uIChsYXN0U2VxQXJyYXksIGN1cnNvciwgY2FsbGJhY2tzKSB7XG4gIHZhciBpbml0aWFsID0gdHJ1ZTsgLy8gYXJlIHdlIG9ic2VydmluZyBpbml0aWFsIGRhdGEgZnJvbSBjdXJzb3I/XG4gIHZhciBzZXFBcnJheSA9IFtdO1xuXG4gIHZhciBvYnNlcnZlSGFuZGxlID0gY3Vyc29yLm9ic2VydmUoe1xuICAgIGFkZGVkQXQ6IGZ1bmN0aW9uIChkb2N1bWVudCwgYXRJbmRleCwgYmVmb3JlKSB7XG4gICAgICBpZiAoaW5pdGlhbCkge1xuICAgICAgICAvLyBrZWVwIHRyYWNrIG9mIGluaXRpYWwgZGF0YSBzbyB0aGF0IHdlIGNhbiBkaWZmIG9uY2VcbiAgICAgICAgLy8gd2UgZXhpdCBgb2JzZXJ2ZWAuXG4gICAgICAgIGlmIChiZWZvcmUgIT09IG51bGwpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgaW5pdGlhbCBkYXRhIGZyb20gb2JzZXJ2ZSBpbiBvcmRlclwiKTtcbiAgICAgICAgc2VxQXJyYXkucHVzaCh7IF9pZDogZG9jdW1lbnQuX2lkLCBpdGVtOiBkb2N1bWVudCB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrcy5hZGRlZEF0KGRvY3VtZW50Ll9pZCwgZG9jdW1lbnQsIGF0SW5kZXgsIGJlZm9yZSk7XG4gICAgICB9XG4gICAgfSxcbiAgICBjaGFuZ2VkQXQ6IGZ1bmN0aW9uIChuZXdEb2N1bWVudCwgb2xkRG9jdW1lbnQsIGF0SW5kZXgpIHtcbiAgICAgIGNhbGxiYWNrcy5jaGFuZ2VkQXQobmV3RG9jdW1lbnQuX2lkLCBuZXdEb2N1bWVudCwgb2xkRG9jdW1lbnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGF0SW5kZXgpO1xuICAgIH0sXG4gICAgcmVtb3ZlZEF0OiBmdW5jdGlvbiAob2xkRG9jdW1lbnQsIGF0SW5kZXgpIHtcbiAgICAgIGNhbGxiYWNrcy5yZW1vdmVkQXQob2xkRG9jdW1lbnQuX2lkLCBvbGREb2N1bWVudCwgYXRJbmRleCk7XG4gICAgfSxcbiAgICBtb3ZlZFRvOiBmdW5jdGlvbiAoZG9jdW1lbnQsIGZyb21JbmRleCwgdG9JbmRleCwgYmVmb3JlKSB7XG4gICAgICBjYWxsYmFja3MubW92ZWRUbyhcbiAgICAgICAgZG9jdW1lbnQuX2lkLCBkb2N1bWVudCwgZnJvbUluZGV4LCB0b0luZGV4LCBiZWZvcmUpO1xuICAgIH1cbiAgfSk7XG4gIGluaXRpYWwgPSBmYWxzZTtcblxuICByZXR1cm4gW3NlcUFycmF5LCBvYnNlcnZlSGFuZGxlXTtcbn07XG4iXX0=
