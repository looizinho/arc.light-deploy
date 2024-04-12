Package["core-runtime"].queue("minimongo", ["meteor", "diff-sequence", "ecmascript", "ejson", "geojson-utils", "id-map", "mongo-id", "ordered-dict", "random", "tracker", "mongo-decimal", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var GeoJSON = Package['geojson-utils'].GeoJSON;
var IdMap = Package['id-map'].IdMap;
var MongoID = Package['mongo-id'].MongoID;
var OrderedDict = Package['ordered-dict'].OrderedDict;
var Random = Package.random.Random;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var Decimal = Package['mongo-decimal'].Decimal;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var operand, selectorValue, MinimongoTest, MinimongoError, selector, doc, callback, options, oldResults, a, b, LocalCollection, Minimongo;

var require = meteorInstall({"node_modules":{"meteor":{"minimongo":{"minimongo_server.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/minimongo_server.js                                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("./minimongo_common.js");
    let hasOwn, isNumericKey, isOperatorObject, pathsToTree, projectionDetails;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      isNumericKey(v) {
        isNumericKey = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      pathsToTree(v) {
        pathsToTree = v;
      },
      projectionDetails(v) {
        projectionDetails = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    Minimongo._pathsElidingNumericKeys = paths => paths.map(path => path.split('.').filter(part => !isNumericKey(part)).join('.'));

    // Returns true if the modifier applied to some document may change the result
    // of matching the document by selector
    // The modifier is always in a form of Object:
    //  - $set
    //    - 'a.b.22.z': value
    //    - 'foo.bar': 42
    //  - $unset
    //    - 'abc.d': 1
    Minimongo.Matcher.prototype.affectedByModifier = function (modifier) {
      // safe check for $set/$unset being objects
      modifier = Object.assign({
        $set: {},
        $unset: {}
      }, modifier);
      const meaningfulPaths = this._getPaths();
      const modifiedPaths = [].concat(Object.keys(modifier.$set), Object.keys(modifier.$unset));
      return modifiedPaths.some(path => {
        const mod = path.split('.');
        return meaningfulPaths.some(meaningfulPath => {
          const sel = meaningfulPath.split('.');
          let i = 0,
            j = 0;
          while (i < sel.length && j < mod.length) {
            if (isNumericKey(sel[i]) && isNumericKey(mod[j])) {
              // foo.4.bar selector affected by foo.4 modifier
              // foo.3.bar selector unaffected by foo.4 modifier
              if (sel[i] === mod[j]) {
                i++;
                j++;
              } else {
                return false;
              }
            } else if (isNumericKey(sel[i])) {
              // foo.4.bar selector unaffected by foo.bar modifier
              return false;
            } else if (isNumericKey(mod[j])) {
              j++;
            } else if (sel[i] === mod[j]) {
              i++;
              j++;
            } else {
              return false;
            }
          }

          // One is a prefix of another, taking numeric fields into account
          return true;
        });
      });
    };

    // @param modifier - Object: MongoDB-styled modifier with `$set`s and `$unsets`
    //                           only. (assumed to come from oplog)
    // @returns - Boolean: if after applying the modifier, selector can start
    //                     accepting the modified value.
    // NOTE: assumes that document affected by modifier didn't match this Matcher
    // before, so if modifier can't convince selector in a positive change it would
    // stay 'false'.
    // Currently doesn't support $-operators and numeric indices precisely.
    Minimongo.Matcher.prototype.canBecomeTrueByModifier = function (modifier) {
      if (!this.affectedByModifier(modifier)) {
        return false;
      }
      if (!this.isSimple()) {
        return true;
      }
      modifier = Object.assign({
        $set: {},
        $unset: {}
      }, modifier);
      const modifierPaths = [].concat(Object.keys(modifier.$set), Object.keys(modifier.$unset));
      if (this._getPaths().some(pathHasNumericKeys) || modifierPaths.some(pathHasNumericKeys)) {
        return true;
      }

      // check if there is a $set or $unset that indicates something is an
      // object rather than a scalar in the actual object where we saw $-operator
      // NOTE: it is correct since we allow only scalars in $-operators
      // Example: for selector {'a.b': {$gt: 5}} the modifier {'a.b.c':7} would
      // definitely set the result to false as 'a.b' appears to be an object.
      const expectedScalarIsObject = Object.keys(this._selector).some(path => {
        if (!isOperatorObject(this._selector[path])) {
          return false;
        }
        return modifierPaths.some(modifierPath => modifierPath.startsWith("".concat(path, ".")));
      });
      if (expectedScalarIsObject) {
        return false;
      }

      // See if we can apply the modifier on the ideally matching object. If it
      // still matches the selector, then the modifier could have turned the real
      // object in the database into something matching.
      const matchingDocument = EJSON.clone(this.matchingDocument());

      // The selector is too complex, anything can happen.
      if (matchingDocument === null) {
        return true;
      }
      try {
        LocalCollection._modify(matchingDocument, modifier);
      } catch (error) {
        // Couldn't set a property on a field which is a scalar or null in the
        // selector.
        // Example:
        // real document: { 'a.b': 3 }
        // selector: { 'a': 12 }
        // converted selector (ideal document): { 'a': 12 }
        // modifier: { $set: { 'a.b': 4 } }
        // We don't know what real document was like but from the error raised by
        // $set on a scalar field we can reason that the structure of real document
        // is completely different.
        if (error.name === 'MinimongoError' && error.setPropertyError) {
          return false;
        }
        throw error;
      }
      return this.documentMatches(matchingDocument).result;
    };

    // Knows how to combine a mongo selector and a fields projection to a new fields
    // projection taking into account active fields from the passed selector.
    // @returns Object - projection object (same as fields option of mongo cursor)
    Minimongo.Matcher.prototype.combineIntoProjection = function (projection) {
      const selectorPaths = Minimongo._pathsElidingNumericKeys(this._getPaths());

      // Special case for $where operator in the selector - projection should depend
      // on all fields of the document. getSelectorPaths returns a list of paths
      // selector depends on. If one of the paths is '' (empty string) representing
      // the root or the whole document, complete projection should be returned.
      if (selectorPaths.includes('')) {
        return {};
      }
      return combineImportantPathsIntoProjection(selectorPaths, projection);
    };

    // Returns an object that would match the selector if possible or null if the
    // selector is too complex for us to analyze
    // { 'a.b': { ans: 42 }, 'foo.bar': null, 'foo.baz': "something" }
    // => { a: { b: { ans: 42 } }, foo: { bar: null, baz: "something" } }
    Minimongo.Matcher.prototype.matchingDocument = function () {
      // check if it was computed before
      if (this._matchingDocument !== undefined) {
        return this._matchingDocument;
      }

      // If the analysis of this selector is too hard for our implementation
      // fallback to "YES"
      let fallback = false;
      this._matchingDocument = pathsToTree(this._getPaths(), path => {
        const valueSelector = this._selector[path];
        if (isOperatorObject(valueSelector)) {
          // if there is a strict equality, there is a good
          // chance we can use one of those as "matching"
          // dummy value
          if (valueSelector.$eq) {
            return valueSelector.$eq;
          }
          if (valueSelector.$in) {
            const matcher = new Minimongo.Matcher({
              placeholder: valueSelector
            });

            // Return anything from $in that matches the whole selector for this
            // path. If nothing matches, returns `undefined` as nothing can make
            // this selector into `true`.
            return valueSelector.$in.find(placeholder => matcher.documentMatches({
              placeholder
            }).result);
          }
          if (onlyContainsKeys(valueSelector, ['$gt', '$gte', '$lt', '$lte'])) {
            let lowerBound = -Infinity;
            let upperBound = Infinity;
            ['$lte', '$lt'].forEach(op => {
              if (hasOwn.call(valueSelector, op) && valueSelector[op] < upperBound) {
                upperBound = valueSelector[op];
              }
            });
            ['$gte', '$gt'].forEach(op => {
              if (hasOwn.call(valueSelector, op) && valueSelector[op] > lowerBound) {
                lowerBound = valueSelector[op];
              }
            });
            const middle = (lowerBound + upperBound) / 2;
            const matcher = new Minimongo.Matcher({
              placeholder: valueSelector
            });
            if (!matcher.documentMatches({
              placeholder: middle
            }).result && (middle === lowerBound || middle === upperBound)) {
              fallback = true;
            }
            return middle;
          }
          if (onlyContainsKeys(valueSelector, ['$nin', '$ne'])) {
            // Since this._isSimple makes sure $nin and $ne are not combined with
            // objects or arrays, we can confidently return an empty object as it
            // never matches any scalar.
            return {};
          }
          fallback = true;
        }
        return this._selector[path];
      }, x => x);
      if (fallback) {
        this._matchingDocument = null;
      }
      return this._matchingDocument;
    };

    // Minimongo.Sorter gets a similar method, which delegates to a Matcher it made
    // for this exact purpose.
    Minimongo.Sorter.prototype.affectedByModifier = function (modifier) {
      return this._selectorForAffectedByModifier.affectedByModifier(modifier);
    };
    Minimongo.Sorter.prototype.combineIntoProjection = function (projection) {
      return combineImportantPathsIntoProjection(Minimongo._pathsElidingNumericKeys(this._getPaths()), projection);
    };
    function combineImportantPathsIntoProjection(paths, projection) {
      const details = projectionDetails(projection);

      // merge the paths to include
      const tree = pathsToTree(paths, path => true, (node, path, fullPath) => true, details.tree);
      const mergedProjection = treeToPaths(tree);
      if (details.including) {
        // both selector and projection are pointing on fields to include
        // so we can just return the merged tree
        return mergedProjection;
      }

      // selector is pointing at fields to include
      // projection is pointing at fields to exclude
      // make sure we don't exclude important paths
      const mergedExclProjection = {};
      Object.keys(mergedProjection).forEach(path => {
        if (!mergedProjection[path]) {
          mergedExclProjection[path] = false;
        }
      });
      return mergedExclProjection;
    }
    function getPaths(selector) {
      return Object.keys(new Minimongo.Matcher(selector)._paths);

      // XXX remove it?
      // return Object.keys(selector).map(k => {
      //   // we don't know how to handle $where because it can be anything
      //   if (k === '$where') {
      //     return ''; // matches everything
      //   }

      //   // we branch from $or/$and/$nor operator
      //   if (['$or', '$and', '$nor'].includes(k)) {
      //     return selector[k].map(getPaths);
      //   }

      //   // the value is a literal or some comparison operator
      //   return k;
      // })
      //   .reduce((a, b) => a.concat(b), [])
      //   .filter((a, b, c) => c.indexOf(a) === b);
    }

    // A helper to ensure object has only certain keys
    function onlyContainsKeys(obj, keys) {
      return Object.keys(obj).every(k => keys.includes(k));
    }
    function pathHasNumericKeys(path) {
      return path.split('.').some(isNumericKey);
    }

    // Returns a set of key paths similar to
    // { 'foo.bar': 1, 'a.b.c': 1 }
    function treeToPaths(tree) {
      let prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
      const result = {};
      Object.keys(tree).forEach(key => {
        const value = tree[key];
        if (value === Object(value)) {
          Object.assign(result, treeToPaths(value, "".concat(prefix + key, ".")));
        } else {
          result[prefix + key] = value;
        }
      });
      return result;
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

},"common.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/common.js                                                                                      //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      hasOwn: () => hasOwn,
      ELEMENT_OPERATORS: () => ELEMENT_OPERATORS,
      compileDocumentSelector: () => compileDocumentSelector,
      equalityElementMatcher: () => equalityElementMatcher,
      expandArraysInBranches: () => expandArraysInBranches,
      isIndexable: () => isIndexable,
      isNumericKey: () => isNumericKey,
      isOperatorObject: () => isOperatorObject,
      makeLookupFunction: () => makeLookupFunction,
      nothingMatcher: () => nothingMatcher,
      pathsToTree: () => pathsToTree,
      populateDocumentWithQueryFields: () => populateDocumentWithQueryFields,
      projectionDetails: () => projectionDetails,
      regexpElementMatcher: () => regexpElementMatcher
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const hasOwn = Object.prototype.hasOwnProperty;
    const ELEMENT_OPERATORS = {
      $lt: makeInequality(cmpValue => cmpValue < 0),
      $gt: makeInequality(cmpValue => cmpValue > 0),
      $lte: makeInequality(cmpValue => cmpValue <= 0),
      $gte: makeInequality(cmpValue => cmpValue >= 0),
      $mod: {
        compileElementSelector(operand) {
          if (!(Array.isArray(operand) && operand.length === 2 && typeof operand[0] === 'number' && typeof operand[1] === 'number')) {
            throw Error('argument to $mod must be an array of two numbers');
          }

          // XXX could require to be ints or round or something
          const divisor = operand[0];
          const remainder = operand[1];
          return value => typeof value === 'number' && value % divisor === remainder;
        }
      },
      $in: {
        compileElementSelector(operand) {
          if (!Array.isArray(operand)) {
            throw Error('$in needs an array');
          }
          const elementMatchers = operand.map(option => {
            if (option instanceof RegExp) {
              return regexpElementMatcher(option);
            }
            if (isOperatorObject(option)) {
              throw Error('cannot nest $ under $in');
            }
            return equalityElementMatcher(option);
          });
          return value => {
            // Allow {a: {$in: [null]}} to match when 'a' does not exist.
            if (value === undefined) {
              value = null;
            }
            return elementMatchers.some(matcher => matcher(value));
          };
        }
      },
      $size: {
        // {a: [[5, 5]]} must match {a: {$size: 1}} but not {a: {$size: 2}}, so we
        // don't want to consider the element [5,5] in the leaf array [[5,5]] as a
        // possible value.
        dontExpandLeafArrays: true,
        compileElementSelector(operand) {
          if (typeof operand === 'string') {
            // Don't ask me why, but by experimentation, this seems to be what Mongo
            // does.
            operand = 0;
          } else if (typeof operand !== 'number') {
            throw Error('$size needs a number');
          }
          return value => Array.isArray(value) && value.length === operand;
        }
      },
      $type: {
        // {a: [5]} must not match {a: {$type: 4}} (4 means array), but it should
        // match {a: {$type: 1}} (1 means number), and {a: [[5]]} must match {$a:
        // {$type: 4}}. Thus, when we see a leaf array, we *should* expand it but
        // should *not* include it itself.
        dontIncludeLeafArrays: true,
        compileElementSelector(operand) {
          if (typeof operand === 'string') {
            const operandAliasMap = {
              'double': 1,
              'string': 2,
              'object': 3,
              'array': 4,
              'binData': 5,
              'undefined': 6,
              'objectId': 7,
              'bool': 8,
              'date': 9,
              'null': 10,
              'regex': 11,
              'dbPointer': 12,
              'javascript': 13,
              'symbol': 14,
              'javascriptWithScope': 15,
              'int': 16,
              'timestamp': 17,
              'long': 18,
              'decimal': 19,
              'minKey': -1,
              'maxKey': 127
            };
            if (!hasOwn.call(operandAliasMap, operand)) {
              throw Error("unknown string alias for $type: ".concat(operand));
            }
            operand = operandAliasMap[operand];
          } else if (typeof operand === 'number') {
            if (operand === 0 || operand < -1 || operand > 19 && operand !== 127) {
              throw Error("Invalid numerical $type code: ".concat(operand));
            }
          } else {
            throw Error('argument to $type is not a number or a string');
          }
          return value => value !== undefined && LocalCollection._f._type(value) === operand;
        }
      },
      $bitsAllSet: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAllSet');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.every((byte, i) => (bitmask[i] & byte) === byte);
          };
        }
      },
      $bitsAnySet: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAnySet');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.some((byte, i) => (~bitmask[i] & byte) !== byte);
          };
        }
      },
      $bitsAllClear: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAllClear');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.every((byte, i) => !(bitmask[i] & byte));
          };
        }
      },
      $bitsAnyClear: {
        compileElementSelector(operand) {
          const mask = getOperandBitmask(operand, '$bitsAnyClear');
          return value => {
            const bitmask = getValueBitmask(value, mask.length);
            return bitmask && mask.some((byte, i) => (bitmask[i] & byte) !== byte);
          };
        }
      },
      $regex: {
        compileElementSelector(operand, valueSelector) {
          if (!(typeof operand === 'string' || operand instanceof RegExp)) {
            throw Error('$regex has to be a string or RegExp');
          }
          let regexp;
          if (valueSelector.$options !== undefined) {
            // Options passed in $options (even the empty string) always overrides
            // options in the RegExp object itself.

            // Be clear that we only support the JS-supported options, not extended
            // ones (eg, Mongo supports x and s). Ideally we would implement x and s
            // by transforming the regexp, but not today...
            if (/[^gim]/.test(valueSelector.$options)) {
              throw new Error('Only the i, m, and g regexp options are supported');
            }
            const source = operand instanceof RegExp ? operand.source : operand;
            regexp = new RegExp(source, valueSelector.$options);
          } else if (operand instanceof RegExp) {
            regexp = operand;
          } else {
            regexp = new RegExp(operand);
          }
          return regexpElementMatcher(regexp);
        }
      },
      $elemMatch: {
        dontExpandLeafArrays: true,
        compileElementSelector(operand, valueSelector, matcher) {
          if (!LocalCollection._isPlainObject(operand)) {
            throw Error('$elemMatch need an object');
          }
          const isDocMatcher = !isOperatorObject(Object.keys(operand).filter(key => !hasOwn.call(LOGICAL_OPERATORS, key)).reduce((a, b) => Object.assign(a, {
            [b]: operand[b]
          }), {}), true);
          let subMatcher;
          if (isDocMatcher) {
            // This is NOT the same as compileValueSelector(operand), and not just
            // because of the slightly different calling convention.
            // {$elemMatch: {x: 3}} means "an element has a field x:3", not
            // "consists only of a field x:3". Also, regexps and sub-$ are allowed.
            subMatcher = compileDocumentSelector(operand, matcher, {
              inElemMatch: true
            });
          } else {
            subMatcher = compileValueSelector(operand, matcher);
          }
          return value => {
            if (!Array.isArray(value)) {
              return false;
            }
            for (let i = 0; i < value.length; ++i) {
              const arrayElement = value[i];
              let arg;
              if (isDocMatcher) {
                // We can only match {$elemMatch: {b: 3}} against objects.
                // (We can also match against arrays, if there's numeric indices,
                // eg {$elemMatch: {'0.b': 3}} or {$elemMatch: {0: 3}}.)
                if (!isIndexable(arrayElement)) {
                  return false;
                }
                arg = arrayElement;
              } else {
                // dontIterate ensures that {a: {$elemMatch: {$gt: 5}}} matches
                // {a: [8]} but not {a: [[8]]}
                arg = [{
                  value: arrayElement,
                  dontIterate: true
                }];
              }
              // XXX support $near in $elemMatch by propagating $distance?
              if (subMatcher(arg).result) {
                return i; // specially understood to mean "use as arrayIndices"
              }
            }
            return false;
          };
        }
      }
    };
    // Operators that appear at the top level of a document selector.
    const LOGICAL_OPERATORS = {
      $and(subSelector, matcher, inElemMatch) {
        return andDocumentMatchers(compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch));
      },
      $or(subSelector, matcher, inElemMatch) {
        const matchers = compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch);

        // Special case: if there is only one matcher, use it directly, *preserving*
        // any arrayIndices it returns.
        if (matchers.length === 1) {
          return matchers[0];
        }
        return doc => {
          const result = matchers.some(fn => fn(doc).result);
          // $or does NOT set arrayIndices when it has multiple
          // sub-expressions. (Tested against MongoDB.)
          return {
            result
          };
        };
      },
      $nor(subSelector, matcher, inElemMatch) {
        const matchers = compileArrayOfDocumentSelectors(subSelector, matcher, inElemMatch);
        return doc => {
          const result = matchers.every(fn => !fn(doc).result);
          // Never set arrayIndices, because we only match if nothing in particular
          // 'matched' (and because this is consistent with MongoDB).
          return {
            result
          };
        };
      },
      $where(selectorValue, matcher) {
        // Record that *any* path may be used.
        matcher._recordPathUsed('');
        matcher._hasWhere = true;
        if (!(selectorValue instanceof Function)) {
          // XXX MongoDB seems to have more complex logic to decide where or or not
          // to add 'return'; not sure exactly what it is.
          selectorValue = Function('obj', "return ".concat(selectorValue));
        }

        // We make the document available as both `this` and `obj`.
        // // XXX not sure what we should do if this throws
        return doc => ({
          result: selectorValue.call(doc, doc)
        });
      },
      // This is just used as a comment in the query (in MongoDB, it also ends up in
      // query logs); it has no effect on the actual selection.
      $comment() {
        return () => ({
          result: true
        });
      }
    };

    // Operators that (unlike LOGICAL_OPERATORS) pertain to individual paths in a
    // document, but (unlike ELEMENT_OPERATORS) do not have a simple definition as
    // "match each branched value independently and combine with
    // convertElementMatcherToBranchedMatcher".
    const VALUE_OPERATORS = {
      $eq(operand) {
        return convertElementMatcherToBranchedMatcher(equalityElementMatcher(operand));
      },
      $not(operand, valueSelector, matcher) {
        return invertBranchedMatcher(compileValueSelector(operand, matcher));
      },
      $ne(operand) {
        return invertBranchedMatcher(convertElementMatcherToBranchedMatcher(equalityElementMatcher(operand)));
      },
      $nin(operand) {
        return invertBranchedMatcher(convertElementMatcherToBranchedMatcher(ELEMENT_OPERATORS.$in.compileElementSelector(operand)));
      },
      $exists(operand) {
        const exists = convertElementMatcherToBranchedMatcher(value => value !== undefined);
        return operand ? exists : invertBranchedMatcher(exists);
      },
      // $options just provides options for $regex; its logic is inside $regex
      $options(operand, valueSelector) {
        if (!hasOwn.call(valueSelector, '$regex')) {
          throw Error('$options needs a $regex');
        }
        return everythingMatcher;
      },
      // $maxDistance is basically an argument to $near
      $maxDistance(operand, valueSelector) {
        if (!valueSelector.$near) {
          throw Error('$maxDistance needs a $near');
        }
        return everythingMatcher;
      },
      $all(operand, valueSelector, matcher) {
        if (!Array.isArray(operand)) {
          throw Error('$all requires array');
        }

        // Not sure why, but this seems to be what MongoDB does.
        if (operand.length === 0) {
          return nothingMatcher;
        }
        const branchedMatchers = operand.map(criterion => {
          // XXX handle $all/$elemMatch combination
          if (isOperatorObject(criterion)) {
            throw Error('no $ expressions in $all');
          }

          // This is always a regexp or equality selector.
          return compileValueSelector(criterion, matcher);
        });

        // andBranchedMatchers does NOT require all selectors to return true on the
        // SAME branch.
        return andBranchedMatchers(branchedMatchers);
      },
      $near(operand, valueSelector, matcher, isRoot) {
        if (!isRoot) {
          throw Error('$near can\'t be inside another $ operator');
        }
        matcher._hasGeoQuery = true;

        // There are two kinds of geodata in MongoDB: legacy coordinate pairs and
        // GeoJSON. They use different distance metrics, too. GeoJSON queries are
        // marked with a $geometry property, though legacy coordinates can be
        // matched using $geometry.
        let maxDistance, point, distance;
        if (LocalCollection._isPlainObject(operand) && hasOwn.call(operand, '$geometry')) {
          // GeoJSON "2dsphere" mode.
          maxDistance = operand.$maxDistance;
          point = operand.$geometry;
          distance = value => {
            // XXX: for now, we don't calculate the actual distance between, say,
            // polygon and circle. If people care about this use-case it will get
            // a priority.
            if (!value) {
              return null;
            }
            if (!value.type) {
              return GeoJSON.pointDistance(point, {
                type: 'Point',
                coordinates: pointToArray(value)
              });
            }
            if (value.type === 'Point') {
              return GeoJSON.pointDistance(point, value);
            }
            return GeoJSON.geometryWithinRadius(value, point, maxDistance) ? 0 : maxDistance + 1;
          };
        } else {
          maxDistance = valueSelector.$maxDistance;
          if (!isIndexable(operand)) {
            throw Error('$near argument must be coordinate pair or GeoJSON');
          }
          point = pointToArray(operand);
          distance = value => {
            if (!isIndexable(value)) {
              return null;
            }
            return distanceCoordinatePairs(point, value);
          };
        }
        return branchedValues => {
          // There might be multiple points in the document that match the given
          // field. Only one of them needs to be within $maxDistance, but we need to
          // evaluate all of them and use the nearest one for the implicit sort
          // specifier. (That's why we can't just use ELEMENT_OPERATORS here.)
          //
          // Note: This differs from MongoDB's implementation, where a document will
          // actually show up *multiple times* in the result set, with one entry for
          // each within-$maxDistance branching point.
          const result = {
            result: false
          };
          expandArraysInBranches(branchedValues).every(branch => {
            // if operation is an update, don't skip branches, just return the first
            // one (#3599)
            let curDistance;
            if (!matcher._isUpdate) {
              if (!(typeof branch.value === 'object')) {
                return true;
              }
              curDistance = distance(branch.value);

              // Skip branches that aren't real points or are too far away.
              if (curDistance === null || curDistance > maxDistance) {
                return true;
              }

              // Skip anything that's a tie.
              if (result.distance !== undefined && result.distance <= curDistance) {
                return true;
              }
            }
            result.result = true;
            result.distance = curDistance;
            if (branch.arrayIndices) {
              result.arrayIndices = branch.arrayIndices;
            } else {
              delete result.arrayIndices;
            }
            return !matcher._isUpdate;
          });
          return result;
        };
      }
    };

    // NB: We are cheating and using this function to implement 'AND' for both
    // 'document matchers' and 'branched matchers'. They both return result objects
    // but the argument is different: for the former it's a whole doc, whereas for
    // the latter it's an array of 'branched values'.
    function andSomeMatchers(subMatchers) {
      if (subMatchers.length === 0) {
        return everythingMatcher;
      }
      if (subMatchers.length === 1) {
        return subMatchers[0];
      }
      return docOrBranches => {
        const match = {};
        match.result = subMatchers.every(fn => {
          const subResult = fn(docOrBranches);

          // Copy a 'distance' number out of the first sub-matcher that has
          // one. Yes, this means that if there are multiple $near fields in a
          // query, something arbitrary happens; this appears to be consistent with
          // Mongo.
          if (subResult.result && subResult.distance !== undefined && match.distance === undefined) {
            match.distance = subResult.distance;
          }

          // Similarly, propagate arrayIndices from sub-matchers... but to match
          // MongoDB behavior, this time the *last* sub-matcher with arrayIndices
          // wins.
          if (subResult.result && subResult.arrayIndices) {
            match.arrayIndices = subResult.arrayIndices;
          }
          return subResult.result;
        });

        // If we didn't actually match, forget any extra metadata we came up with.
        if (!match.result) {
          delete match.distance;
          delete match.arrayIndices;
        }
        return match;
      };
    }
    const andDocumentMatchers = andSomeMatchers;
    const andBranchedMatchers = andSomeMatchers;
    function compileArrayOfDocumentSelectors(selectors, matcher, inElemMatch) {
      if (!Array.isArray(selectors) || selectors.length === 0) {
        throw Error('$and/$or/$nor must be nonempty array');
      }
      return selectors.map(subSelector => {
        if (!LocalCollection._isPlainObject(subSelector)) {
          throw Error('$or/$and/$nor entries need to be full objects');
        }
        return compileDocumentSelector(subSelector, matcher, {
          inElemMatch
        });
      });
    }

    // Takes in a selector that could match a full document (eg, the original
    // selector). Returns a function mapping document->result object.
    //
    // matcher is the Matcher object we are compiling.
    //
    // If this is the root document selector (ie, not wrapped in $and or the like),
    // then isRoot is true. (This is used by $near.)
    function compileDocumentSelector(docSelector, matcher) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      const docMatchers = Object.keys(docSelector).map(key => {
        const subSelector = docSelector[key];
        if (key.substr(0, 1) === '$') {
          // Outer operators are either logical operators (they recurse back into
          // this function), or $where.
          if (!hasOwn.call(LOGICAL_OPERATORS, key)) {
            throw new Error("Unrecognized logical operator: ".concat(key));
          }
          matcher._isSimple = false;
          return LOGICAL_OPERATORS[key](subSelector, matcher, options.inElemMatch);
        }

        // Record this path, but only if we aren't in an elemMatcher, since in an
        // elemMatch this is a path inside an object in an array, not in the doc
        // root.
        if (!options.inElemMatch) {
          matcher._recordPathUsed(key);
        }

        // Don't add a matcher if subSelector is a function -- this is to match
        // the behavior of Meteor on the server (inherited from the node mongodb
        // driver), which is to ignore any part of a selector which is a function.
        if (typeof subSelector === 'function') {
          return undefined;
        }
        const lookUpByIndex = makeLookupFunction(key);
        const valueMatcher = compileValueSelector(subSelector, matcher, options.isRoot);
        return doc => valueMatcher(lookUpByIndex(doc));
      }).filter(Boolean);
      return andDocumentMatchers(docMatchers);
    }
    // Takes in a selector that could match a key-indexed value in a document; eg,
    // {$gt: 5, $lt: 9}, or a regular expression, or any non-expression object (to
    // indicate equality).  Returns a branched matcher: a function mapping
    // [branched value]->result object.
    function compileValueSelector(valueSelector, matcher, isRoot) {
      if (valueSelector instanceof RegExp) {
        matcher._isSimple = false;
        return convertElementMatcherToBranchedMatcher(regexpElementMatcher(valueSelector));
      }
      if (isOperatorObject(valueSelector)) {
        return operatorBranchedMatcher(valueSelector, matcher, isRoot);
      }
      return convertElementMatcherToBranchedMatcher(equalityElementMatcher(valueSelector));
    }

    // Given an element matcher (which evaluates a single value), returns a branched
    // value (which evaluates the element matcher on all the branches and returns a
    // more structured return value possibly including arrayIndices).
    function convertElementMatcherToBranchedMatcher(elementMatcher) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      return branches => {
        const expanded = options.dontExpandLeafArrays ? branches : expandArraysInBranches(branches, options.dontIncludeLeafArrays);
        const match = {};
        match.result = expanded.some(element => {
          let matched = elementMatcher(element.value);

          // Special case for $elemMatch: it means "true, and use this as an array
          // index if I didn't already have one".
          if (typeof matched === 'number') {
            // XXX This code dates from when we only stored a single array index
            // (for the outermost array). Should we be also including deeper array
            // indices from the $elemMatch match?
            if (!element.arrayIndices) {
              element.arrayIndices = [matched];
            }
            matched = true;
          }

          // If some element matched, and it's tagged with array indices, include
          // those indices in our result object.
          if (matched && element.arrayIndices) {
            match.arrayIndices = element.arrayIndices;
          }
          return matched;
        });
        return match;
      };
    }

    // Helpers for $near.
    function distanceCoordinatePairs(a, b) {
      const pointA = pointToArray(a);
      const pointB = pointToArray(b);
      return Math.hypot(pointA[0] - pointB[0], pointA[1] - pointB[1]);
    }

    // Takes something that is not an operator object and returns an element matcher
    // for equality with that thing.
    function equalityElementMatcher(elementSelector) {
      if (isOperatorObject(elementSelector)) {
        throw Error('Can\'t create equalityValueSelector for operator object');
      }

      // Special-case: null and undefined are equal (if you got undefined in there
      // somewhere, or if you got it due to some branch being non-existent in the
      // weird special case), even though they aren't with EJSON.equals.
      // undefined or null
      if (elementSelector == null) {
        return value => value == null;
      }
      return value => LocalCollection._f._equal(elementSelector, value);
    }
    function everythingMatcher(docOrBranchedValues) {
      return {
        result: true
      };
    }
    function expandArraysInBranches(branches, skipTheArrays) {
      const branchesOut = [];
      branches.forEach(branch => {
        const thisIsArray = Array.isArray(branch.value);

        // We include the branch itself, *UNLESS* we it's an array that we're going
        // to iterate and we're told to skip arrays.  (That's right, we include some
        // arrays even skipTheArrays is true: these are arrays that were found via
        // explicit numerical indices.)
        if (!(skipTheArrays && thisIsArray && !branch.dontIterate)) {
          branchesOut.push({
            arrayIndices: branch.arrayIndices,
            value: branch.value
          });
        }
        if (thisIsArray && !branch.dontIterate) {
          branch.value.forEach((value, i) => {
            branchesOut.push({
              arrayIndices: (branch.arrayIndices || []).concat(i),
              value
            });
          });
        }
      });
      return branchesOut;
    }
    // Helpers for $bitsAllSet/$bitsAnySet/$bitsAllClear/$bitsAnyClear.
    function getOperandBitmask(operand, selector) {
      // numeric bitmask
      // You can provide a numeric bitmask to be matched against the operand field.
      // It must be representable as a non-negative 32-bit signed integer.
      // Otherwise, $bitsAllSet will return an error.
      if (Number.isInteger(operand) && operand >= 0) {
        return new Uint8Array(new Int32Array([operand]).buffer);
      }

      // bindata bitmask
      // You can also use an arbitrarily large BinData instance as a bitmask.
      if (EJSON.isBinary(operand)) {
        return new Uint8Array(operand.buffer);
      }

      // position list
      // If querying a list of bit positions, each <position> must be a non-negative
      // integer. Bit positions start at 0 from the least significant bit.
      if (Array.isArray(operand) && operand.every(x => Number.isInteger(x) && x >= 0)) {
        const buffer = new ArrayBuffer((Math.max(...operand) >> 3) + 1);
        const view = new Uint8Array(buffer);
        operand.forEach(x => {
          view[x >> 3] |= 1 << (x & 0x7);
        });
        return view;
      }

      // bad operand
      throw Error("operand to ".concat(selector, " must be a numeric bitmask (representable as a ") + 'non-negative 32-bit signed integer), a bindata bitmask or an array with ' + 'bit positions (non-negative integers)');
    }
    function getValueBitmask(value, length) {
      // The field value must be either numerical or a BinData instance. Otherwise,
      // $bits... will not match the current document.

      // numerical
      if (Number.isSafeInteger(value)) {
        // $bits... will not match numerical values that cannot be represented as a
        // signed 64-bit integer. This can be the case if a value is either too
        // large or small to fit in a signed 64-bit integer, or if it has a
        // fractional component.
        const buffer = new ArrayBuffer(Math.max(length, 2 * Uint32Array.BYTES_PER_ELEMENT));
        let view = new Uint32Array(buffer, 0, 2);
        view[0] = value % ((1 << 16) * (1 << 16)) | 0;
        view[1] = value / ((1 << 16) * (1 << 16)) | 0;

        // sign extension
        if (value < 0) {
          view = new Uint8Array(buffer, 2);
          view.forEach((byte, i) => {
            view[i] = 0xff;
          });
        }
        return new Uint8Array(buffer);
      }

      // bindata
      if (EJSON.isBinary(value)) {
        return new Uint8Array(value.buffer);
      }

      // no match
      return false;
    }

    // Actually inserts a key value into the selector document
    // However, this checks there is no ambiguity in setting
    // the value for the given key, throws otherwise
    function insertIntoDocument(document, key, value) {
      Object.keys(document).forEach(existingKey => {
        if (existingKey.length > key.length && existingKey.indexOf("".concat(key, ".")) === 0 || key.length > existingKey.length && key.indexOf("".concat(existingKey, ".")) === 0) {
          throw new Error("cannot infer query fields to set, both paths '".concat(existingKey, "' and ") + "'".concat(key, "' are matched"));
        } else if (existingKey === key) {
          throw new Error("cannot infer query fields to set, path '".concat(key, "' is matched twice"));
        }
      });
      document[key] = value;
    }

    // Returns a branched matcher that matches iff the given matcher does not.
    // Note that this implicitly "deMorganizes" the wrapped function.  ie, it
    // means that ALL branch values need to fail to match innerBranchedMatcher.
    function invertBranchedMatcher(branchedMatcher) {
      return branchValues => {
        // We explicitly choose to strip arrayIndices here: it doesn't make sense to
        // say "update the array element that does not match something", at least
        // in mongo-land.
        return {
          result: !branchedMatcher(branchValues).result
        };
      };
    }
    function isIndexable(obj) {
      return Array.isArray(obj) || LocalCollection._isPlainObject(obj);
    }
    function isNumericKey(s) {
      return /^[0-9]+$/.test(s);
    }
    function isOperatorObject(valueSelector, inconsistentOK) {
      if (!LocalCollection._isPlainObject(valueSelector)) {
        return false;
      }
      let theseAreOperators = undefined;
      Object.keys(valueSelector).forEach(selKey => {
        const thisIsOperator = selKey.substr(0, 1) === '$' || selKey === 'diff';
        if (theseAreOperators === undefined) {
          theseAreOperators = thisIsOperator;
        } else if (theseAreOperators !== thisIsOperator) {
          if (!inconsistentOK) {
            throw new Error("Inconsistent operator: ".concat(JSON.stringify(valueSelector)));
          }
          theseAreOperators = false;
        }
      });
      return !!theseAreOperators; // {} has no operators
    }
    // Helper for $lt/$gt/$lte/$gte.
    function makeInequality(cmpValueComparator) {
      return {
        compileElementSelector(operand) {
          // Arrays never compare false with non-arrays for any inequality.
          // XXX This was behavior we observed in pre-release MongoDB 2.5, but
          //     it seems to have been reverted.
          //     See https://jira.mongodb.org/browse/SERVER-11444
          if (Array.isArray(operand)) {
            return () => false;
          }

          // Special case: consider undefined and null the same (so true with
          // $gte/$lte).
          if (operand === undefined) {
            operand = null;
          }
          const operandType = LocalCollection._f._type(operand);
          return value => {
            if (value === undefined) {
              value = null;
            }

            // Comparisons are never true among things of different type (except
            // null vs undefined).
            if (LocalCollection._f._type(value) !== operandType) {
              return false;
            }
            return cmpValueComparator(LocalCollection._f._cmp(value, operand));
          };
        }
      };
    }

    // makeLookupFunction(key) returns a lookup function.
    //
    // A lookup function takes in a document and returns an array of matching
    // branches.  If no arrays are found while looking up the key, this array will
    // have exactly one branches (possibly 'undefined', if some segment of the key
    // was not found).
    //
    // If arrays are found in the middle, this can have more than one element, since
    // we 'branch'. When we 'branch', if there are more key segments to look up,
    // then we only pursue branches that are plain objects (not arrays or scalars).
    // This means we can actually end up with no branches!
    //
    // We do *NOT* branch on arrays that are found at the end (ie, at the last
    // dotted member of the key). We just return that array; if you want to
    // effectively 'branch' over the array's values, post-process the lookup
    // function with expandArraysInBranches.
    //
    // Each branch is an object with keys:
    //  - value: the value at the branch
    //  - dontIterate: an optional bool; if true, it means that 'value' is an array
    //    that expandArraysInBranches should NOT expand. This specifically happens
    //    when there is a numeric index in the key, and ensures the
    //    perhaps-surprising MongoDB behavior where {'a.0': 5} does NOT
    //    match {a: [[5]]}.
    //  - arrayIndices: if any array indexing was done during lookup (either due to
    //    explicit numeric indices or implicit branching), this will be an array of
    //    the array indices used, from outermost to innermost; it is falsey or
    //    absent if no array index is used. If an explicit numeric index is used,
    //    the index will be followed in arrayIndices by the string 'x'.
    //
    //    Note: arrayIndices is used for two purposes. First, it is used to
    //    implement the '$' modifier feature, which only ever looks at its first
    //    element.
    //
    //    Second, it is used for sort key generation, which needs to be able to tell
    //    the difference between different paths. Moreover, it needs to
    //    differentiate between explicit and implicit branching, which is why
    //    there's the somewhat hacky 'x' entry: this means that explicit and
    //    implicit array lookups will have different full arrayIndices paths. (That
    //    code only requires that different paths have different arrayIndices; it
    //    doesn't actually 'parse' arrayIndices. As an alternative, arrayIndices
    //    could contain objects with flags like 'implicit', but I think that only
    //    makes the code surrounding them more complex.)
    //
    //    (By the way, this field ends up getting passed around a lot without
    //    cloning, so never mutate any arrayIndices field/var in this package!)
    //
    //
    // At the top level, you may only pass in a plain object or array.
    //
    // See the test 'minimongo - lookup' for some examples of what lookup functions
    // return.
    function makeLookupFunction(key) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      const parts = key.split('.');
      const firstPart = parts.length ? parts[0] : '';
      const lookupRest = parts.length > 1 && makeLookupFunction(parts.slice(1).join('.'), options);
      function buildResult(arrayIndices, dontIterate, value) {
        return arrayIndices && arrayIndices.length ? dontIterate ? [{
          arrayIndices,
          dontIterate,
          value
        }] : [{
          arrayIndices,
          value
        }] : dontIterate ? [{
          dontIterate,
          value
        }] : [{
          value
        }];
      }

      // Doc will always be a plain object or an array.
      // apply an explicit numeric index, an array.
      return (doc, arrayIndices) => {
        if (Array.isArray(doc)) {
          // If we're being asked to do an invalid lookup into an array (non-integer
          // or out-of-bounds), return no results (which is different from returning
          // a single undefined result, in that `null` equality checks won't match).
          if (!(isNumericKey(firstPart) && firstPart < doc.length)) {
            return [];
          }

          // Remember that we used this array index. Include an 'x' to indicate that
          // the previous index came from being considered as an explicit array
          // index (not branching).
          arrayIndices = arrayIndices ? arrayIndices.concat(+firstPart, 'x') : [+firstPart, 'x'];
        }

        // Do our first lookup.
        const firstLevel = doc[firstPart];

        // If there is no deeper to dig, return what we found.
        //
        // If what we found is an array, most value selectors will choose to treat
        // the elements of the array as matchable values in their own right, but
        // that's done outside of the lookup function. (Exceptions to this are $size
        // and stuff relating to $elemMatch.  eg, {a: {$size: 2}} does not match {a:
        // [[1, 2]]}.)
        //
        // That said, if we just did an *explicit* array lookup (on doc) to find
        // firstLevel, and firstLevel is an array too, we do NOT want value
        // selectors to iterate over it.  eg, {'a.0': 5} does not match {a: [[5]]}.
        // So in that case, we mark the return value as 'don't iterate'.
        if (!lookupRest) {
          return buildResult(arrayIndices, Array.isArray(doc) && Array.isArray(firstLevel), firstLevel);
        }

        // We need to dig deeper.  But if we can't, because what we've found is not
        // an array or plain object, we're done. If we just did a numeric index into
        // an array, we return nothing here (this is a change in Mongo 2.5 from
        // Mongo 2.4, where {'a.0.b': null} stopped matching {a: [5]}). Otherwise,
        // return a single `undefined` (which can, for example, match via equality
        // with `null`).
        if (!isIndexable(firstLevel)) {
          if (Array.isArray(doc)) {
            return [];
          }
          return buildResult(arrayIndices, false, undefined);
        }
        const result = [];
        const appendToResult = more => {
          result.push(...more);
        };

        // Dig deeper: look up the rest of the parts on whatever we've found.
        // (lookupRest is smart enough to not try to do invalid lookups into
        // firstLevel if it's an array.)
        appendToResult(lookupRest(firstLevel, arrayIndices));

        // If we found an array, then in *addition* to potentially treating the next
        // part as a literal integer lookup, we should also 'branch': try to look up
        // the rest of the parts on each array element in parallel.
        //
        // In this case, we *only* dig deeper into array elements that are plain
        // objects. (Recall that we only got this far if we have further to dig.)
        // This makes sense: we certainly don't dig deeper into non-indexable
        // objects. And it would be weird to dig into an array: it's simpler to have
        // a rule that explicit integer indexes only apply to an outer array, not to
        // an array you find after a branching search.
        //
        // In the special case of a numeric part in a *sort selector* (not a query
        // selector), we skip the branching: we ONLY allow the numeric part to mean
        // 'look up this index' in that case, not 'also look up this index in all
        // the elements of the array'.
        if (Array.isArray(firstLevel) && !(isNumericKey(parts[1]) && options.forSort)) {
          firstLevel.forEach((branch, arrayIndex) => {
            if (LocalCollection._isPlainObject(branch)) {
              appendToResult(lookupRest(branch, arrayIndices ? arrayIndices.concat(arrayIndex) : [arrayIndex]));
            }
          });
        }
        return result;
      };
    }
    // Object exported only for unit testing.
    // Use it to export private functions to test in Tinytest.
    MinimongoTest = {
      makeLookupFunction
    };
    MinimongoError = function (message) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (typeof message === 'string' && options.field) {
        message += " for field '".concat(options.field, "'");
      }
      const error = new Error(message);
      error.name = 'MinimongoError';
      return error;
    };
    function nothingMatcher(docOrBranchedValues) {
      return {
        result: false
      };
    }
    // Takes an operator object (an object with $ keys) and returns a branched
    // matcher for it.
    function operatorBranchedMatcher(valueSelector, matcher, isRoot) {
      // Each valueSelector works separately on the various branches.  So one
      // operator can match one branch and another can match another branch.  This
      // is OK.
      const operatorMatchers = Object.keys(valueSelector).map(operator => {
        const operand = valueSelector[operator];
        const simpleRange = ['$lt', '$lte', '$gt', '$gte'].includes(operator) && typeof operand === 'number';
        const simpleEquality = ['$ne', '$eq'].includes(operator) && operand !== Object(operand);
        const simpleInclusion = ['$in', '$nin'].includes(operator) && Array.isArray(operand) && !operand.some(x => x === Object(x));
        if (!(simpleRange || simpleInclusion || simpleEquality)) {
          matcher._isSimple = false;
        }
        if (hasOwn.call(VALUE_OPERATORS, operator)) {
          return VALUE_OPERATORS[operator](operand, valueSelector, matcher, isRoot);
        }
        if (hasOwn.call(ELEMENT_OPERATORS, operator)) {
          const options = ELEMENT_OPERATORS[operator];
          return convertElementMatcherToBranchedMatcher(options.compileElementSelector(operand, valueSelector, matcher), options);
        }
        throw new Error("Unrecognized operator: ".concat(operator));
      });
      return andBranchedMatchers(operatorMatchers);
    }

    // paths - Array: list of mongo style paths
    // newLeafFn - Function: of form function(path) should return a scalar value to
    //                       put into list created for that path
    // conflictFn - Function: of form function(node, path, fullPath) is called
    //                        when building a tree path for 'fullPath' node on
    //                        'path' was already a leaf with a value. Must return a
    //                        conflict resolution.
    // initial tree - Optional Object: starting tree.
    // @returns - Object: tree represented as a set of nested objects
    function pathsToTree(paths, newLeafFn, conflictFn) {
      let root = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      paths.forEach(path => {
        const pathArray = path.split('.');
        let tree = root;

        // use .every just for iteration with break
        const success = pathArray.slice(0, -1).every((key, i) => {
          if (!hasOwn.call(tree, key)) {
            tree[key] = {};
          } else if (tree[key] !== Object(tree[key])) {
            tree[key] = conflictFn(tree[key], pathArray.slice(0, i + 1).join('.'), path);

            // break out of loop if we are failing for this path
            if (tree[key] !== Object(tree[key])) {
              return false;
            }
          }
          tree = tree[key];
          return true;
        });
        if (success) {
          const lastKey = pathArray[pathArray.length - 1];
          if (hasOwn.call(tree, lastKey)) {
            tree[lastKey] = conflictFn(tree[lastKey], path, path);
          } else {
            tree[lastKey] = newLeafFn(path);
          }
        }
      });
      return root;
    }
    // Makes sure we get 2 elements array and assume the first one to be x and
    // the second one to y no matter what user passes.
    // In case user passes { lon: x, lat: y } returns [x, y]
    function pointToArray(point) {
      return Array.isArray(point) ? point.slice() : [point.x, point.y];
    }

    // Creating a document from an upsert is quite tricky.
    // E.g. this selector: {"$or": [{"b.foo": {"$all": ["bar"]}}]}, should result
    // in: {"b.foo": "bar"}
    // But this selector: {"$or": [{"b": {"foo": {"$all": ["bar"]}}}]} should throw
    // an error

    // Some rules (found mainly with trial & error, so there might be more):
    // - handle all childs of $and (or implicit $and)
    // - handle $or nodes with exactly 1 child
    // - ignore $or nodes with more than 1 child
    // - ignore $nor and $not nodes
    // - throw when a value can not be set unambiguously
    // - every value for $all should be dealt with as separate $eq-s
    // - threat all children of $all as $eq setters (=> set if $all.length === 1,
    //   otherwise throw error)
    // - you can not mix '$'-prefixed keys and non-'$'-prefixed keys
    // - you can only have dotted keys on a root-level
    // - you can not have '$'-prefixed keys more than one-level deep in an object

    // Handles one key/value pair to put in the selector document
    function populateDocumentWithKeyValue(document, key, value) {
      if (value && Object.getPrototypeOf(value) === Object.prototype) {
        populateDocumentWithObject(document, key, value);
      } else if (!(value instanceof RegExp)) {
        insertIntoDocument(document, key, value);
      }
    }

    // Handles a key, value pair to put in the selector document
    // if the value is an object
    function populateDocumentWithObject(document, key, value) {
      const keys = Object.keys(value);
      const unprefixedKeys = keys.filter(op => op[0] !== '$');
      if (unprefixedKeys.length > 0 || !keys.length) {
        // Literal (possibly empty) object ( or empty object )
        // Don't allow mixing '$'-prefixed with non-'$'-prefixed fields
        if (keys.length !== unprefixedKeys.length) {
          throw new Error("unknown operator: ".concat(unprefixedKeys[0]));
        }
        validateObject(value, key);
        insertIntoDocument(document, key, value);
      } else {
        Object.keys(value).forEach(op => {
          const object = value[op];
          if (op === '$eq') {
            populateDocumentWithKeyValue(document, key, object);
          } else if (op === '$all') {
            // every value for $all should be dealt with as separate $eq-s
            object.forEach(element => populateDocumentWithKeyValue(document, key, element));
          }
        });
      }
    }

    // Fills a document with certain fields from an upsert selector
    function populateDocumentWithQueryFields(query) {
      let document = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (Object.getPrototypeOf(query) === Object.prototype) {
        // handle implicit $and
        Object.keys(query).forEach(key => {
          const value = query[key];
          if (key === '$and') {
            // handle explicit $and
            value.forEach(element => populateDocumentWithQueryFields(element, document));
          } else if (key === '$or') {
            // handle $or nodes with exactly 1 child
            if (value.length === 1) {
              populateDocumentWithQueryFields(value[0], document);
            }
          } else if (key[0] !== '$') {
            // Ignore other '$'-prefixed logical selectors
            populateDocumentWithKeyValue(document, key, value);
          }
        });
      } else {
        // Handle meteor-specific shortcut for selecting _id
        if (LocalCollection._selectorIsId(query)) {
          insertIntoDocument(document, '_id', query);
        }
      }
      return document;
    }
    function projectionDetails(fields) {
      // Find the non-_id keys (_id is handled specially because it is included
      // unless explicitly excluded). Sort the keys, so that our code to detect
      // overlaps like 'foo' and 'foo.bar' can assume that 'foo' comes first.
      let fieldsKeys = Object.keys(fields).sort();

      // If _id is the only field in the projection, do not remove it, since it is
      // required to determine if this is an exclusion or exclusion. Also keep an
      // inclusive _id, since inclusive _id follows the normal rules about mixing
      // inclusive and exclusive fields. If _id is not the only field in the
      // projection and is exclusive, remove it so it can be handled later by a
      // special case, since exclusive _id is always allowed.
      if (!(fieldsKeys.length === 1 && fieldsKeys[0] === '_id') && !(fieldsKeys.includes('_id') && fields._id)) {
        fieldsKeys = fieldsKeys.filter(key => key !== '_id');
      }
      let including = null; // Unknown

      fieldsKeys.forEach(keyPath => {
        const rule = !!fields[keyPath];
        if (including === null) {
          including = rule;
        }

        // This error message is copied from MongoDB shell
        if (including !== rule) {
          throw MinimongoError('You cannot currently mix including and excluding fields.');
        }
      });
      const projectionRulesTree = pathsToTree(fieldsKeys, path => including, (node, path, fullPath) => {
        // Check passed projection fields' keys: If you have two rules such as
        // 'foo.bar' and 'foo.bar.baz', then the result becomes ambiguous. If
        // that happens, there is a probability you are doing something wrong,
        // framework should notify you about such mistake earlier on cursor
        // compilation step than later during runtime.  Note, that real mongo
        // doesn't do anything about it and the later rule appears in projection
        // project, more priority it takes.
        //
        // Example, assume following in mongo shell:
        // > db.coll.insert({ a: { b: 23, c: 44 } })
        // > db.coll.find({}, { 'a': 1, 'a.b': 1 })
        // {"_id": ObjectId("520bfe456024608e8ef24af3"), "a": {"b": 23}}
        // > db.coll.find({}, { 'a.b': 1, 'a': 1 })
        // {"_id": ObjectId("520bfe456024608e8ef24af3"), "a": {"b": 23, "c": 44}}
        //
        // Note, how second time the return set of keys is different.
        const currentPath = fullPath;
        const anotherPath = path;
        throw MinimongoError("both ".concat(currentPath, " and ").concat(anotherPath, " found in fields option, ") + 'using both of them may trigger unexpected behavior. Did you mean to ' + 'use only one of them?');
      });
      return {
        including,
        tree: projectionRulesTree
      };
    }
    function regexpElementMatcher(regexp) {
      return value => {
        if (value instanceof RegExp) {
          return value.toString() === regexp.toString();
        }

        // Regexps only work against strings.
        if (typeof value !== 'string') {
          return false;
        }

        // Reset regexp's state to avoid inconsistent matching for objects with the
        // same value on consecutive calls of regexp.test. This happens only if the
        // regexp has the 'g' flag. Also note that ES6 introduces a new flag 'y' for
        // which we should *not* change the lastIndex but MongoDB doesn't support
        // either of these flags.
        regexp.lastIndex = 0;
        return regexp.test(value);
      };
    }
    // Validates the key in a path.
    // Objects that are nested more then 1 level cannot have dotted fields
    // or fields starting with '$'
    function validateKeyInPath(key, path) {
      if (key.includes('.')) {
        throw new Error("The dotted field '".concat(key, "' in '").concat(path, ".").concat(key, " is not valid for storage."));
      }
      if (key[0] === '$') {
        throw new Error("The dollar ($) prefixed field  '".concat(path, ".").concat(key, " is not valid for storage."));
      }
    }

    // Recursively validates an object that is nested more than one level deep
    function validateObject(object, path) {
      if (object && Object.getPrototypeOf(object) === Object.prototype) {
        Object.keys(object).forEach(key => {
          validateKeyInPath(key, path);
          validateObject(object[key], path + '.' + key);
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
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"constants.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/constants.js                                                                                   //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
module.export({
  getAsyncMethodName: () => getAsyncMethodName,
  ASYNC_COLLECTION_METHODS: () => ASYNC_COLLECTION_METHODS,
  ASYNC_CURSOR_METHODS: () => ASYNC_CURSOR_METHODS,
  CLIENT_ONLY_METHODS: () => CLIENT_ONLY_METHODS
});
function getAsyncMethodName(method) {
  return "".concat(method.replace('_', ''), "Async");
}
const ASYNC_COLLECTION_METHODS = ['_createCappedCollection', 'dropCollection', 'dropIndex',
/**
 * @summary Creates the specified index on the collection.
 * @locus server
 * @method createIndexAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
 * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
 * @param {String} options.name Name of the index
 * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
 * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
 * @returns {Promise}
 */
'createIndex',
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
 * @returns {Promise}
 */
'findOne',
/**
 * @summary Insert a document in the collection.  Returns its unique _id.
 * @locus Anywhere
 * @method  insertAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
 * @return {Promise}
 */
'insert',
/**
 * @summary Remove documents from the collection
 * @locus Anywhere
 * @method removeAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {MongoSelector} selector Specifies which documents to remove
 * @return {Promise}
 */
'remove',
/**
 * @summary Modify one or more documents in the collection. Returns the number of matched documents.
 * @locus Anywhere
 * @method updateAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {MongoSelector} selector Specifies which documents to modify
 * @param {MongoModifier} modifier Specifies how to modify the documents
 * @param {Object} [options]
 * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
 * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
 * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
 * @return {Promise}
 */
'update',
/**
 * @summary Modify one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
 * @locus Anywhere
 * @method upsertAsync
 * @memberof Mongo.Collection
 * @instance
 * @param {MongoSelector} selector Specifies which documents to modify
 * @param {MongoModifier} modifier Specifies how to modify the documents
 * @param {Object} [options]
 * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
 * @return {Promise}
 */
'upsert'];
const ASYNC_CURSOR_METHODS = [
/**
 * @deprecated in 2.9
 * @summary Returns the number of documents that match a query. This method is
 *          [deprecated since MongoDB 4.0](https://www.mongodb.com/docs/v4.4/reference/command/count/);
 *          see `Collection.countDocuments` and
 *          `Collection.estimatedDocumentCount` for a replacement.
 * @memberOf Mongo.Cursor
 * @method  countAsync
 * @instance
 * @locus Anywhere
 * @returns {Promise}
 */
'count',
/**
 * @summary Return all matching documents as an Array.
 * @memberOf Mongo.Cursor
 * @method  fetchAsync
 * @instance
 * @locus Anywhere
 * @returns {Promise}
 */
'fetch',
/**
 * @summary Call `callback` once for each matching document, sequentially and
 *          synchronously.
 * @locus Anywhere
 * @method  forEachAsync
 * @instance
 * @memberOf Mongo.Cursor
 * @param {IterationCallback} callback Function to call. It will be called
 *                                     with three arguments: the document, a
 *                                     0-based index, and <em>cursor</em>
 *                                     itself.
 * @param {Any} [thisArg] An object which will be the value of `this` inside
 *                        `callback`.
 * @returns {Promise}
 */
'forEach',
/**
 * @summary Map callback over all matching documents.  Returns an Array.
 * @locus Anywhere
 * @method mapAsync
 * @instance
 * @memberOf Mongo.Cursor
 * @param {IterationCallback} callback Function to call. It will be called
 *                                     with three arguments: the document, a
 *                                     0-based index, and <em>cursor</em>
 *                                     itself.
 * @param {Any} [thisArg] An object which will be the value of `this` inside
 *                        `callback`.
 * @returns {Promise}
 */
'map'];
const CLIENT_ONLY_METHODS = ["findOne", "insert", "remove", "update", "upsert"];
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"cursor.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/cursor.js                                                                                      //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      default: () => Cursor
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    let hasOwn;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      }
    }, 1);
    let ASYNC_CURSOR_METHODS, getAsyncMethodName;
    module.link("./constants", {
      ASYNC_CURSOR_METHODS(v) {
        ASYNC_CURSOR_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class Cursor {
      // don't call this ctor directly.  use LocalCollection.find().
      constructor(collection, selector) {
        let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
        this.collection = collection;
        this.sorter = null;
        this.matcher = new Minimongo.Matcher(selector);
        if (LocalCollection._selectorIsIdPerhapsAsObject(selector)) {
          // stash for fast _id and { _id }
          this._selectorId = hasOwn.call(selector, '_id') ? selector._id : selector;
        } else {
          this._selectorId = undefined;
          if (this.matcher.hasGeoQuery() || options.sort) {
            this.sorter = new Minimongo.Sorter(options.sort || []);
          }
        }
        this.skip = options.skip || 0;
        this.limit = options.limit;
        this.fields = options.projection || options.fields;
        this._projectionFn = LocalCollection._compileProjection(this.fields || {});
        this._transform = LocalCollection.wrapTransform(options.transform);

        // by default, queries register w/ Tracker when it is available.
        if (typeof Tracker !== 'undefined') {
          this.reactive = options.reactive === undefined ? true : options.reactive;
        }
      }

      /**
       * @deprecated in 2.9
       * @summary Returns the number of documents that match a query. This method is
       *          [deprecated since MongoDB 4.0](https://www.mongodb.com/docs/v4.4/reference/command/count/);
       *          see `Collection.countDocuments` and
       *          `Collection.estimatedDocumentCount` for a replacement.
       * @memberOf Mongo.Cursor
       * @method  count
       * @instance
       * @locus Anywhere
       * @returns {Number}
       */
      count() {
        if (this.reactive) {
          // allow the observe to be unordered
          this._depend({
            added: true,
            removed: true
          }, true);
        }
        return this._getRawObjects({
          ordered: true
        }).length;
      }

      /**
       * @summary Return all matching documents as an Array.
       * @memberOf Mongo.Cursor
       * @method  fetch
       * @instance
       * @locus Anywhere
       * @returns {Object[]}
       */
      fetch() {
        const result = [];
        this.forEach(doc => {
          result.push(doc);
        });
        return result;
      }
      [Symbol.iterator]() {
        if (this.reactive) {
          this._depend({
            addedBefore: true,
            removed: true,
            changed: true,
            movedBefore: true
          });
        }
        let index = 0;
        const objects = this._getRawObjects({
          ordered: true
        });
        return {
          next: () => {
            if (index < objects.length) {
              // This doubles as a clone operation.
              let element = this._projectionFn(objects[index++]);
              if (this._transform) element = this._transform(element);
              return {
                value: element
              };
            }
            return {
              done: true
            };
          }
        };
      }
      [Symbol.asyncIterator]() {
        const syncResult = this[Symbol.iterator]();
        return {
          async next() {
            return Promise.resolve(syncResult.next());
          }
        };
      }

      /**
       * @callback IterationCallback
       * @param {Object} doc
       * @param {Number} index
       */
      /**
       * @summary Call `callback` once for each matching document, sequentially and
       *          synchronously.
       * @locus Anywhere
       * @method  forEach
       * @instance
       * @memberOf Mongo.Cursor
       * @param {IterationCallback} callback Function to call. It will be called
       *                                     with three arguments: the document, a
       *                                     0-based index, and <em>cursor</em>
       *                                     itself.
       * @param {Any} [thisArg] An object which will be the value of `this` inside
       *                        `callback`.
       */
      forEach(callback, thisArg) {
        if (this.reactive) {
          this._depend({
            addedBefore: true,
            removed: true,
            changed: true,
            movedBefore: true
          });
        }
        this._getRawObjects({
          ordered: true
        }).forEach((element, i) => {
          // This doubles as a clone operation.
          element = this._projectionFn(element);
          if (this._transform) {
            element = this._transform(element);
          }
          callback.call(thisArg, element, i, this);
        });
      }
      getTransform() {
        return this._transform;
      }

      /**
       * @summary Map callback over all matching documents.  Returns an Array.
       * @locus Anywhere
       * @method map
       * @instance
       * @memberOf Mongo.Cursor
       * @param {IterationCallback} callback Function to call. It will be called
       *                                     with three arguments: the document, a
       *                                     0-based index, and <em>cursor</em>
       *                                     itself.
       * @param {Any} [thisArg] An object which will be the value of `this` inside
       *                        `callback`.
       */
      map(callback, thisArg) {
        const result = [];
        this.forEach((doc, i) => {
          result.push(callback.call(thisArg, doc, i, this));
        });
        return result;
      }

      // options to contain:
      //  * callbacks for observe():
      //    - addedAt (document, atIndex)
      //    - added (document)
      //    - changedAt (newDocument, oldDocument, atIndex)
      //    - changed (newDocument, oldDocument)
      //    - removedAt (document, atIndex)
      //    - removed (document)
      //    - movedTo (document, oldIndex, newIndex)
      //
      // attributes available on returned query handle:
      //  * stop(): end updates
      //  * collection: the collection this query is querying
      //
      // iff x is a returned query handle, (x instanceof
      // LocalCollection.ObserveHandle) is true
      //
      // initial results delivered through added callback
      // XXX maybe callbacks should take a list of objects, to expose transactions?
      // XXX maybe support field limiting (to limit what you're notified on)

      /**
       * @summary Watch a query.  Receive callbacks as the result set changes.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       * @param {Object} callbacks Functions to call to deliver the result set as it
       *                           changes
       */
      observe(options) {
        return LocalCollection._observeFromObserveChanges(this, options);
      }

      /**
       * @summary Watch a query. Receive callbacks as the result set changes. Only
       *          the differences between the old and new documents are passed to
       *          the callbacks.
       * @locus Anywhere
       * @memberOf Mongo.Cursor
       * @instance
       * @param {Object} callbacks Functions to call to deliver the result set as it
       *                           changes
       */
      observeChanges(options) {
        const ordered = LocalCollection._observeChangesCallbacksAreOrdered(options);

        // there are several places that assume you aren't combining skip/limit with
        // unordered observe.  eg, update's EJSON.clone, and the "there are several"
        // comment in _modifyAndNotify
        // XXX allow skip/limit with unordered observe
        if (!options._allow_unordered && !ordered && (this.skip || this.limit)) {
          throw new Error("Must use an ordered observe with skip or limit (i.e. 'addedBefore' " + "for observeChanges or 'addedAt' for observe, instead of 'added').");
        }
        if (this.fields && (this.fields._id === 0 || this.fields._id === false)) {
          throw Error("You may not observe a cursor with {fields: {_id: 0}}");
        }
        const distances = this.matcher.hasGeoQuery() && ordered && new LocalCollection._IdMap();
        const query = {
          cursor: this,
          dirty: false,
          distances,
          matcher: this.matcher,
          // not fast pathed
          ordered,
          projectionFn: this._projectionFn,
          resultsSnapshot: null,
          sorter: ordered && this.sorter
        };
        let qid;

        // Non-reactive queries call added[Before] and then never call anything
        // else.
        if (this.reactive) {
          qid = this.collection.next_qid++;
          this.collection.queries[qid] = query;
        }
        query.results = this._getRawObjects({
          ordered,
          distances: query.distances
        });
        if (this.collection.paused) {
          query.resultsSnapshot = ordered ? [] : new LocalCollection._IdMap();
        }

        // wrap callbacks we were passed. callbacks only fire when not paused and
        // are never undefined
        // Filters out blacklisted fields according to cursor's projection.
        // XXX wrong place for this?

        // furthermore, callbacks enqueue until the operation we're working on is
        // done.
        const wrapCallback = fn => {
          if (!fn) {
            return () => {};
          }
          const self = this;
          return function /* args*/
          () {
            if (self.collection.paused) {
              return;
            }
            const args = arguments;
            self.collection._observeQueue.queueTask(() => {
              fn.apply(this, args);
            });
          };
        };
        query.added = wrapCallback(options.added);
        query.changed = wrapCallback(options.changed);
        query.removed = wrapCallback(options.removed);
        if (ordered) {
          query.addedBefore = wrapCallback(options.addedBefore);
          query.movedBefore = wrapCallback(options.movedBefore);
        }
        if (!options._suppress_initial && !this.collection.paused) {
          var _query$results, _query$results$size;
          const handler = doc => {
            const fields = EJSON.clone(doc);
            delete fields._id;
            if (ordered) {
              query.addedBefore(doc._id, this._projectionFn(fields), null);
            }
            query.added(doc._id, this._projectionFn(fields));
          };
          // it means it's just an array
          if (query.results.length) {
            for (const doc of query.results) {
              handler(doc);
            }
          }
          // it means it's an id map
          if ((_query$results = query.results) !== null && _query$results !== void 0 && (_query$results$size = _query$results.size) !== null && _query$results$size !== void 0 && _query$results$size.call(_query$results)) {
            query.results.forEach(handler);
          }
        }
        const handle = Object.assign(new LocalCollection.ObserveHandle(), {
          collection: this.collection,
          stop: () => {
            if (this.reactive) {
              delete this.collection.queries[qid];
            }
          },
          isReady: false,
          isReadyPromise: null
        });
        if (this.reactive && Tracker.active) {
          // XXX in many cases, the same observe will be recreated when
          // the current autorun is rerun.  we could save work by
          // letting it linger across rerun and potentially get
          // repurposed if the same observe is performed, using logic
          // similar to that of Meteor.subscribe.
          Tracker.onInvalidate(() => {
            handle.stop();
          });
        }

        // run the observe callbacks resulting from the initial contents
        // before we leave the observe.
        const drainResult = this.collection._observeQueue.drain();
        if (drainResult instanceof Promise) {
          handle.isReadyPromise = drainResult;
          drainResult.then(() => handle.isReady = true);
        } else {
          handle.isReady = true;
          handle.isReadyPromise = Promise.resolve();
        }
        return handle;
      }

      // XXX Maybe we need a version of observe that just calls a callback if
      // anything changed.
      _depend(changers, _allow_unordered) {
        if (Tracker.active) {
          const dependency = new Tracker.Dependency();
          const notify = dependency.changed.bind(dependency);
          dependency.depend();
          const options = {
            _allow_unordered,
            _suppress_initial: true
          };
          ['added', 'addedBefore', 'changed', 'movedBefore', 'removed'].forEach(fn => {
            if (changers[fn]) {
              options[fn] = notify;
            }
          });

          // observeChanges will stop() when this computation is invalidated
          this.observeChanges(options);
        }
      }
      _getCollectionName() {
        return this.collection.name;
      }

      // Returns a collection of matching objects, but doesn't deep copy them.
      //
      // If ordered is set, returns a sorted array, respecting sorter, skip, and
      // limit properties of the query provided that options.applySkipLimit is
      // not set to false (#1201). If sorter is falsey, no sort -- you get the
      // natural order.
      //
      // If ordered is not set, returns an object mapping from ID to doc (sorter,
      // skip and limit should not be set).
      //
      // If ordered is set and this cursor is a $near geoquery, then this function
      // will use an _IdMap to track each distance from the $near argument point in
      // order to use it as a sort key. If an _IdMap is passed in the 'distances'
      // argument, this function will clear it and use it for this purpose
      // (otherwise it will just create its own _IdMap). The observeChanges
      // implementation uses this to remember the distances after this function
      // returns.
      _getRawObjects() {
        let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        // By default this method will respect skip and limit because .fetch(),
        // .forEach() etc... expect this behaviour. It can be forced to ignore
        // skip and limit by setting applySkipLimit to false (.count() does this,
        // for example)
        const applySkipLimit = options.applySkipLimit !== false;

        // XXX use OrderedDict instead of array, and make IdMap and OrderedDict
        // compatible
        const results = options.ordered ? [] : new LocalCollection._IdMap();

        // fast path for single ID value
        if (this._selectorId !== undefined) {
          // If you have non-zero skip and ask for a single id, you get nothing.
          // This is so it matches the behavior of the '{_id: foo}' path.
          if (applySkipLimit && this.skip) {
            return results;
          }
          const selectedDoc = this.collection._docs.get(this._selectorId);
          if (selectedDoc) {
            if (options.ordered) {
              results.push(selectedDoc);
            } else {
              results.set(this._selectorId, selectedDoc);
            }
          }
          return results;
        }

        // slow path for arbitrary selector, sort, skip, limit

        // in the observeChanges case, distances is actually part of the "query"
        // (ie, live results set) object.  in other cases, distances is only used
        // inside this function.
        let distances;
        if (this.matcher.hasGeoQuery() && options.ordered) {
          if (options.distances) {
            distances = options.distances;
            distances.clear();
          } else {
            distances = new LocalCollection._IdMap();
          }
        }
        this.collection._docs.forEach((doc, id) => {
          const matchResult = this.matcher.documentMatches(doc);
          if (matchResult.result) {
            if (options.ordered) {
              results.push(doc);
              if (distances && matchResult.distance !== undefined) {
                distances.set(id, matchResult.distance);
              }
            } else {
              results.set(id, doc);
            }
          }

          // Override to ensure all docs are matched if ignoring skip & limit
          if (!applySkipLimit) {
            return true;
          }

          // Fast path for limited unsorted queries.
          // XXX 'length' check here seems wrong for ordered
          return !this.limit || this.skip || this.sorter || results.length !== this.limit;
        });
        if (!options.ordered) {
          return results;
        }
        if (this.sorter) {
          results.sort(this.sorter.getComparator({
            distances
          }));
        }

        // Return the full set of results if there is no skip or limit or if we're
        // ignoring them
        if (!applySkipLimit || !this.limit && !this.skip) {
          return results;
        }
        return results.slice(this.skip, this.limit ? this.limit + this.skip : results.length);
      }
      _publishCursor(subscription) {
        // XXX minimongo should not depend on mongo-livedata!
        if (!Package.mongo) {
          throw new Error("Can't publish from Minimongo without the `mongo` package.");
        }
        if (!this.collection.name) {
          throw new Error("Can't publish a cursor from a collection without a name.");
        }
        return Package.mongo.Mongo.Collection._publishCursor(this, subscription, this.collection.name);
      }
    }
    // Implements async version of cursor methods to keep collections isomorphic
    ASYNC_CURSOR_METHODS.forEach(method => {
      const asyncName = getAsyncMethodName(method);
      Cursor.prototype[asyncName] = function () {
        try {
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          return Promise.resolve(this[method].apply(this, args));
        } catch (error) {
          return Promise.reject(error);
        }
      };
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
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"local_collection.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/local_collection.js                                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    module.export({
      default: () => LocalCollection
    });
    let Cursor;
    module.link("./cursor.js", {
      default(v) {
        Cursor = v;
      }
    }, 0);
    let ObserveHandle;
    module.link("./observe_handle.js", {
      default(v) {
        ObserveHandle = v;
      }
    }, 1);
    let hasOwn, isIndexable, isNumericKey, isOperatorObject, populateDocumentWithQueryFields, projectionDetails;
    module.link("./common.js", {
      hasOwn(v) {
        hasOwn = v;
      },
      isIndexable(v) {
        isIndexable = v;
      },
      isNumericKey(v) {
        isNumericKey = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      populateDocumentWithQueryFields(v) {
        populateDocumentWithQueryFields = v;
      },
      projectionDetails(v) {
        projectionDetails = v;
      }
    }, 2);
    let getAsyncMethodName;
    module.link("./constants", {
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class LocalCollection {
      constructor(name) {
        this.name = name;
        // _id -> document (also containing id)
        this._docs = new LocalCollection._IdMap();
        this._observeQueue = Meteor.isClient ? new Meteor._SynchronousQueue() : new Meteor._AsynchronousQueue();
        this.next_qid = 1; // live query id generator

        // qid -> live query object. keys:
        //  ordered: bool. ordered queries have addedBefore/movedBefore callbacks.
        //  results: array (ordered) or object (unordered) of current results
        //    (aliased with this._docs!)
        //  resultsSnapshot: snapshot of results. null if not paused.
        //  cursor: Cursor object for the query.
        //  selector, sorter, (callbacks): functions
        this.queries = Object.create(null);

        // null if not saving originals; an IdMap from id to original document value
        // if saving originals. See comments before saveOriginals().
        this._savedOriginals = null;

        // True when observers are paused and we should not send callbacks.
        this.paused = false;
      }
      countDocuments(selector, options) {
        return this.find(selector !== null && selector !== void 0 ? selector : {}, options).countAsync();
      }
      estimatedDocumentCount(options) {
        return this.find({}, options).countAsync();
      }

      // options may include sort, skip, limit, reactive
      // sort may be any of these forms:
      //     {a: 1, b: -1}
      //     [["a", "asc"], ["b", "desc"]]
      //     ["a", ["b", "desc"]]
      //   (in the first form you're beholden to key enumeration order in
      //   your javascript VM)
      //
      // reactive: if given, and false, don't register with Tracker (default
      // is true)
      //
      // XXX possibly should support retrieving a subset of fields? and
      // have it be a hint (ignored on the client, when not copying the
      // doc?)
      //
      // XXX sort does not yet support subkeys ('a.b') .. fix that!
      // XXX add one more sort form: "key"
      // XXX tests
      find(selector, options) {
        // default syntax for everything is to omit the selector argument.
        // but if selector is explicitly passed in as false or undefined, we
        // want a selector that matches nothing.
        if (arguments.length === 0) {
          selector = {};
        }
        return new LocalCollection.Cursor(this, selector, options);
      }
      findOne(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (arguments.length === 0) {
          selector = {};
        }

        // NOTE: by setting limit 1 here, we end up using very inefficient
        // code that recomputes the whole query on each update. The upside is
        // that when you reactively depend on a findOne you only get
        // invalidated when the found object changes, not any object in the
        // collection. Most findOne will be by id, which has a fast path, so
        // this might not be a big deal. In most cases, invalidation causes
        // the called to re-query anyway, so this should be a net performance
        // improvement.
        options.limit = 1;
        return this.find(selector, options).fetch()[0];
      }
      async findOneAsync(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        if (arguments.length === 0) {
          selector = {};
        }
        options.limit = 1;
        return (await this.find(selector, options).fetchAsync())[0];
      }
      prepareInsert(doc) {
        assertHasValidFieldNames(doc);

        // if you really want to use ObjectIDs, set this global.
        // Mongo.Collection specifies its own ids and does not use this code.
        if (!hasOwn.call(doc, '_id')) {
          doc._id = LocalCollection._useOID ? new MongoID.ObjectID() : Random.id();
        }
        const id = doc._id;
        if (this._docs.has(id)) {
          throw MinimongoError("Duplicate _id '".concat(id, "'"));
        }
        this._saveOriginal(id, undefined);
        this._docs.set(id, doc);
        return id;
      }

      // XXX possibly enforce that 'undefined' does not appear (we assume
      // this in our handling of null and $exists)
      insert(doc, callback) {
        doc = EJSON.clone(doc);
        const id = this.prepareInsert(doc);
        const queriesToRecompute = [];

        // trigger live queries that match
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const matchResult = query.matcher.documentMatches(doc);
          if (matchResult.result) {
            if (query.distances && matchResult.distance !== undefined) {
              query.distances.set(id, matchResult.distance);
            }
            if (query.cursor.skip || query.cursor.limit) {
              queriesToRecompute.push(qid);
            } else {
              LocalCollection._insertInResultsSync(query, doc);
            }
          }
        }
        queriesToRecompute.forEach(qid => {
          if (this.queries[qid]) {
            this._recomputeResults(this.queries[qid]);
          }
        });
        this._observeQueue.drain();
        if (callback) {
          Meteor.defer(() => {
            callback(null, id);
          });
        }
        return id;
      }
      async insertAsync(doc, callback) {
        doc = EJSON.clone(doc);
        const id = this.prepareInsert(doc);
        const queriesToRecompute = [];

        // trigger live queries that match
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const matchResult = query.matcher.documentMatches(doc);
          if (matchResult.result) {
            if (query.distances && matchResult.distance !== undefined) {
              query.distances.set(id, matchResult.distance);
            }
            if (query.cursor.skip || query.cursor.limit) {
              queriesToRecompute.push(qid);
            } else {
              await LocalCollection._insertInResultsAsync(query, doc);
            }
          }
        }
        queriesToRecompute.forEach(qid => {
          if (this.queries[qid]) {
            this._recomputeResults(this.queries[qid]);
          }
        });
        await this._observeQueue.drain();
        if (callback) {
          Meteor.defer(() => {
            callback(null, id);
          });
        }
        return id;
      }

      // Pause the observers. No callbacks from observers will fire until
      // 'resumeObservers' is called.
      pauseObservers() {
        // No-op if already paused.
        if (this.paused) {
          return;
        }

        // Set the 'paused' flag such that new observer messages don't fire.
        this.paused = true;

        // Take a snapshot of the query results for each query.
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          query.resultsSnapshot = EJSON.clone(query.results);
        });
      }
      clearResultQueries(callback) {
        const result = this._docs.size();
        this._docs.clear();
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.ordered) {
            query.results = [];
          } else {
            query.results.clear();
          }
        });
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }
      prepareRemove(selector) {
        const matcher = new Minimongo.Matcher(selector);
        const remove = [];
        this._eachPossiblyMatchingDocSync(selector, (doc, id) => {
          if (matcher.documentMatches(doc).result) {
            remove.push(id);
          }
        });
        const queriesToRecompute = [];
        const queryRemove = [];
        for (let i = 0; i < remove.length; i++) {
          const removeId = remove[i];
          const removeDoc = this._docs.get(removeId);
          Object.keys(this.queries).forEach(qid => {
            const query = this.queries[qid];
            if (query.dirty) {
              return;
            }
            if (query.matcher.documentMatches(removeDoc).result) {
              if (query.cursor.skip || query.cursor.limit) {
                queriesToRecompute.push(qid);
              } else {
                queryRemove.push({
                  qid,
                  doc: removeDoc
                });
              }
            }
          });
          this._saveOriginal(removeId, removeDoc);
          this._docs.remove(removeId);
        }
        return {
          queriesToRecompute,
          queryRemove,
          remove
        };
      }
      remove(selector, callback) {
        // Easy special case: if we're not calling observeChanges callbacks and
        // we're not saving originals and we got asked to remove everything, then
        // just empty everything directly.
        if (this.paused && !this._savedOriginals && EJSON.equals(selector, {})) {
          return this.clearResultQueries(callback);
        }
        const {
          queriesToRecompute,
          queryRemove,
          remove
        } = this.prepareRemove(selector);

        // run live query callbacks _after_ we've removed the documents.
        queryRemove.forEach(remove => {
          const query = this.queries[remove.qid];
          if (query) {
            query.distances && query.distances.remove(remove.doc._id);
            LocalCollection._removeFromResultsSync(query, remove.doc);
          }
        });
        queriesToRecompute.forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query);
          }
        });
        this._observeQueue.drain();
        const result = remove.length;
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }
      async removeAsync(selector, callback) {
        // Easy special case: if we're not calling observeChanges callbacks and
        // we're not saving originals and we got asked to remove everything, then
        // just empty everything directly.
        if (this.paused && !this._savedOriginals && EJSON.equals(selector, {})) {
          return this.clearResultQueries(callback);
        }
        const {
          queriesToRecompute,
          queryRemove,
          remove
        } = this.prepareRemove(selector);

        // run live query callbacks _after_ we've removed the documents.
        for (const remove of queryRemove) {
          const query = this.queries[remove.qid];
          if (query) {
            query.distances && query.distances.remove(remove.doc._id);
            await LocalCollection._removeFromResultsAsync(query, remove.doc);
          }
        }
        queriesToRecompute.forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query);
          }
        });
        await this._observeQueue.drain();
        const result = remove.length;
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }

      // Resume the observers. Observers immediately receive change
      // notifications to bring them to the current state of the
      // database. Note that this is not just replaying all the changes that
      // happened during the pause, it is a smarter 'coalesced' diff.
      _resumeObservers() {
        // No-op if not paused.
        if (!this.paused) {
          return;
        }

        // Unset the 'paused' flag. Make sure to do this first, otherwise
        // observer methods won't actually fire when we trigger them.
        this.paused = false;
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.dirty) {
            query.dirty = false;

            // re-compute results will perform `LocalCollection._diffQueryChanges`
            // automatically.
            this._recomputeResults(query, query.resultsSnapshot);
          } else {
            // Diff the current results against the snapshot and send to observers.
            // pass the query object for its observer callbacks.
            LocalCollection._diffQueryChanges(query.ordered, query.resultsSnapshot, query.results, query, {
              projectionFn: query.projectionFn
            });
          }
          query.resultsSnapshot = null;
        });
      }
      async resumeObserversServer() {
        this._resumeObservers();
        await this._observeQueue.drain();
      }
      resumeObserversClient() {
        this._resumeObservers();
        this._observeQueue.drain();
      }
      retrieveOriginals() {
        if (!this._savedOriginals) {
          throw new Error('Called retrieveOriginals without saveOriginals');
        }
        const originals = this._savedOriginals;
        this._savedOriginals = null;
        return originals;
      }

      // To track what documents are affected by a piece of code, call
      // saveOriginals() before it and retrieveOriginals() after it.
      // retrieveOriginals returns an object whose keys are the ids of the documents
      // that were affected since the call to saveOriginals(), and the values are
      // equal to the document's contents at the time of saveOriginals. (In the case
      // of an inserted document, undefined is the value.) You must alternate
      // between calls to saveOriginals() and retrieveOriginals().
      saveOriginals() {
        if (this._savedOriginals) {
          throw new Error('Called saveOriginals twice without retrieveOriginals');
        }
        this._savedOriginals = new LocalCollection._IdMap();
      }
      prepareUpdate(selector) {
        // Save the original results of any query that we might need to
        // _recomputeResults on, because _modifyAndNotify will mutate the objects in
        // it. (We don't need to save the original results of paused queries because
        // they already have a resultsSnapshot and we won't be diffing in
        // _recomputeResults.)
        const qidToOriginalResults = {};

        // We should only clone each document once, even if it appears in multiple
        // queries
        const docMap = new LocalCollection._IdMap();
        const idsMatched = LocalCollection._idsMatchedBySelector(selector);
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if ((query.cursor.skip || query.cursor.limit) && !this.paused) {
            // Catch the case of a reactive `count()` on a cursor with skip
            // or limit, which registers an unordered observe. This is a
            // pretty rare case, so we just clone the entire result set with
            // no optimizations for documents that appear in these result
            // sets and other queries.
            if (query.results instanceof LocalCollection._IdMap) {
              qidToOriginalResults[qid] = query.results.clone();
              return;
            }
            if (!(query.results instanceof Array)) {
              throw new Error('Assertion failed: query.results not an array');
            }

            // Clones a document to be stored in `qidToOriginalResults`
            // because it may be modified before the new and old result sets
            // are diffed. But if we know exactly which document IDs we're
            // going to modify, then we only need to clone those.
            const memoizedCloneIfNeeded = doc => {
              if (docMap.has(doc._id)) {
                return docMap.get(doc._id);
              }
              const docToMemoize = idsMatched && !idsMatched.some(id => EJSON.equals(id, doc._id)) ? doc : EJSON.clone(doc);
              docMap.set(doc._id, docToMemoize);
              return docToMemoize;
            };
            qidToOriginalResults[qid] = query.results.map(memoizedCloneIfNeeded);
          }
        });
        return qidToOriginalResults;
      }
      finishUpdate(_ref) {
        let {
          options,
          updateCount,
          callback,
          insertedId
        } = _ref;
        // Return the number of affected documents, or in the upsert case, an object
        // containing the number of affected docs and the id of the doc that was
        // inserted, if any.
        let result;
        if (options._returnObject) {
          result = {
            numberAffected: updateCount
          };
          if (insertedId !== undefined) {
            result.insertedId = insertedId;
          }
        } else {
          result = updateCount;
        }
        if (callback) {
          Meteor.defer(() => {
            callback(null, result);
          });
        }
        return result;
      }

      // XXX atomicity: if multi is true, and one modification fails, do
      // we rollback the whole operation, or what?
      async updateAsync(selector, mod, options, callback) {
        if (!callback && options instanceof Function) {
          callback = options;
          options = null;
        }
        if (!options) {
          options = {};
        }
        const matcher = new Minimongo.Matcher(selector, true);
        const qidToOriginalResults = this.prepareUpdate(selector);
        let recomputeQids = {};
        let updateCount = 0;
        await this._eachPossiblyMatchingDocAsync(selector, async (doc, id) => {
          const queryResult = matcher.documentMatches(doc);
          if (queryResult.result) {
            // XXX Should we save the original even if mod ends up being a no-op?
            this._saveOriginal(id, doc);
            recomputeQids = await this._modifyAndNotifyAsync(doc, mod, queryResult.arrayIndices);
            ++updateCount;
            if (!options.multi) {
              return false; // break
            }
          }
          return true;
        });
        Object.keys(recomputeQids).forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query, qidToOriginalResults[qid]);
          }
        });
        await this._observeQueue.drain();

        // If we are doing an upsert, and we didn't modify any documents yet, then
        // it's time to do an insert. Figure out what document we are inserting, and
        // generate an id for it.
        let insertedId;
        if (updateCount === 0 && options.upsert) {
          const doc = LocalCollection._createUpsertDocument(selector, mod);
          if (!doc._id && options.insertedId) {
            doc._id = options.insertedId;
          }
          insertedId = await this.insertAsync(doc);
          updateCount = 1;
        }
        return this.finishUpdate({
          options,
          insertedId,
          updateCount,
          callback
        });
      }
      // XXX atomicity: if multi is true, and one modification fails, do
      // we rollback the whole operation, or what?
      update(selector, mod, options, callback) {
        if (!callback && options instanceof Function) {
          callback = options;
          options = null;
        }
        if (!options) {
          options = {};
        }
        const matcher = new Minimongo.Matcher(selector, true);
        const qidToOriginalResults = this.prepareUpdate(selector);
        let recomputeQids = {};
        let updateCount = 0;
        this._eachPossiblyMatchingDocSync(selector, (doc, id) => {
          const queryResult = matcher.documentMatches(doc);
          if (queryResult.result) {
            // XXX Should we save the original even if mod ends up being a no-op?
            this._saveOriginal(id, doc);
            recomputeQids = this._modifyAndNotifySync(doc, mod, queryResult.arrayIndices);
            ++updateCount;
            if (!options.multi) {
              return false; // break
            }
          }
          return true;
        });
        Object.keys(recomputeQids).forEach(qid => {
          const query = this.queries[qid];
          if (query) {
            this._recomputeResults(query, qidToOriginalResults[qid]);
          }
        });
        this._observeQueue.drain();
        return this.finishUpdate({
          options,
          updateCount,
          callback,
          selector,
          mod
        });
      }

      // A convenience wrapper on update. LocalCollection.upsert(sel, mod) is
      // equivalent to LocalCollection.update(sel, mod, {upsert: true,
      // _returnObject: true}).
      upsert(selector, mod, options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        return this.update(selector, mod, Object.assign({}, options, {
          upsert: true,
          _returnObject: true
        }), callback);
      }
      upsertAsync(selector, mod, options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        return this.updateAsync(selector, mod, Object.assign({}, options, {
          upsert: true,
          _returnObject: true
        }), callback);
      }

      // Iterates over a subset of documents that could match selector; calls
      // fn(doc, id) on each of them.  Specifically, if selector specifies
      // specific _id's, it only looks at those.  doc is *not* cloned: it is the
      // same object that is in _docs.
      async _eachPossiblyMatchingDocAsync(selector, fn) {
        const specificIds = LocalCollection._idsMatchedBySelector(selector);
        if (specificIds) {
          for (const id of specificIds) {
            const doc = this._docs.get(id);
            if (doc && !(await fn(doc, id))) {
              break;
            }
          }
        } else {
          await this._docs.forEachAsync(fn);
        }
      }
      _eachPossiblyMatchingDocSync(selector, fn) {
        const specificIds = LocalCollection._idsMatchedBySelector(selector);
        if (specificIds) {
          for (const id of specificIds) {
            const doc = this._docs.get(id);
            if (doc && !fn(doc, id)) {
              break;
            }
          }
        } else {
          this._docs.forEach(fn);
        }
      }
      _getMatchedDocAndModify(doc, mod, arrayIndices) {
        const matched_before = {};
        Object.keys(this.queries).forEach(qid => {
          const query = this.queries[qid];
          if (query.dirty) {
            return;
          }
          if (query.ordered) {
            matched_before[qid] = query.matcher.documentMatches(doc).result;
          } else {
            // Because we don't support skip or limit (yet) in unordered queries, we
            // can just do a direct lookup.
            matched_before[qid] = query.results.has(doc._id);
          }
        });
        return matched_before;
      }
      _modifyAndNotifySync(doc, mod, arrayIndices) {
        const matched_before = this._getMatchedDocAndModify(doc, mod, arrayIndices);
        const old_doc = EJSON.clone(doc);
        LocalCollection._modify(doc, mod, {
          arrayIndices
        });
        const recomputeQids = {};
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const afterMatch = query.matcher.documentMatches(doc);
          const after = afterMatch.result;
          const before = matched_before[qid];
          if (after && query.distances && afterMatch.distance !== undefined) {
            query.distances.set(doc._id, afterMatch.distance);
          }
          if (query.cursor.skip || query.cursor.limit) {
            // We need to recompute any query where the doc may have been in the
            // cursor's window either before or after the update. (Note that if skip
            // or limit is set, "before" and "after" being true do not necessarily
            // mean that the document is in the cursor's output after skip/limit is
            // applied... but if they are false, then the document definitely is NOT
            // in the output. So it's safe to skip recompute if neither before or
            // after are true.)
            if (before || after) {
              recomputeQids[qid] = true;
            }
          } else if (before && !after) {
            LocalCollection._removeFromResultsSync(query, doc);
          } else if (!before && after) {
            LocalCollection._insertInResultsSync(query, doc);
          } else if (before && after) {
            LocalCollection._updateInResultsSync(query, doc, old_doc);
          }
        }
        return recomputeQids;
      }
      async _modifyAndNotifyAsync(doc, mod, arrayIndices) {
        const matched_before = this._getMatchedDocAndModify(doc, mod, arrayIndices);
        const old_doc = EJSON.clone(doc);
        LocalCollection._modify(doc, mod, {
          arrayIndices
        });
        const recomputeQids = {};
        for (const qid of Object.keys(this.queries)) {
          const query = this.queries[qid];
          if (query.dirty) {
            continue;
          }
          const afterMatch = query.matcher.documentMatches(doc);
          const after = afterMatch.result;
          const before = matched_before[qid];
          if (after && query.distances && afterMatch.distance !== undefined) {
            query.distances.set(doc._id, afterMatch.distance);
          }
          if (query.cursor.skip || query.cursor.limit) {
            // We need to recompute any query where the doc may have been in the
            // cursor's window either before or after the update. (Note that if skip
            // or limit is set, "before" and "after" being true do not necessarily
            // mean that the document is in the cursor's output after skip/limit is
            // applied... but if they are false, then the document definitely is NOT
            // in the output. So it's safe to skip recompute if neither before or
            // after are true.)
            if (before || after) {
              recomputeQids[qid] = true;
            }
          } else if (before && !after) {
            await LocalCollection._removeFromResultsAsync(query, doc);
          } else if (!before && after) {
            await LocalCollection._insertInResultsAsync(query, doc);
          } else if (before && after) {
            await LocalCollection._updateInResultsAsync(query, doc, old_doc);
          }
        }
        return recomputeQids;
      }

      // Recomputes the results of a query and runs observe callbacks for the
      // difference between the previous results and the current results (unless
      // paused). Used for skip/limit queries.
      //
      // When this is used by insert or remove, it can just use query.results for
      // the old results (and there's no need to pass in oldResults), because these
      // operations don't mutate the documents in the collection. Update needs to
      // pass in an oldResults which was deep-copied before the modifier was
      // applied.
      //
      // oldResults is guaranteed to be ignored if the query is not paused.
      _recomputeResults(query, oldResults) {
        if (this.paused) {
          // There's no reason to recompute the results now as we're still paused.
          // By flagging the query as "dirty", the recompute will be performed
          // when resumeObservers is called.
          query.dirty = true;
          return;
        }
        if (!this.paused && !oldResults) {
          oldResults = query.results;
        }
        if (query.distances) {
          query.distances.clear();
        }
        query.results = query.cursor._getRawObjects({
          distances: query.distances,
          ordered: query.ordered
        });
        if (!this.paused) {
          LocalCollection._diffQueryChanges(query.ordered, oldResults, query.results, query, {
            projectionFn: query.projectionFn
          });
        }
      }
      _saveOriginal(id, doc) {
        // Are we even trying to save originals?
        if (!this._savedOriginals) {
          return;
        }

        // Have we previously mutated the original (and so 'doc' is not actually
        // original)?  (Note the 'has' check rather than truth: we store undefined
        // here for inserted docs!)
        if (this._savedOriginals.has(id)) {
          return;
        }
        this._savedOriginals.set(id, EJSON.clone(doc));
      }
    }
    LocalCollection.Cursor = Cursor;
    LocalCollection.ObserveHandle = ObserveHandle;

    // XXX maybe move these into another ObserveHelpers package or something

    // _CachingChangeObserver is an object which receives observeChanges callbacks
    // and keeps a cache of the current cursor state up to date in this.docs. Users
    // of this class should read the docs field but not modify it. You should pass
    // the "applyChange" field as the callbacks to the underlying observeChanges
    // call. Optionally, you can specify your own observeChanges callbacks which are
    // invoked immediately before the docs field is updated; this object is made
    // available as `this` to those callbacks.
    LocalCollection._CachingChangeObserver = class _CachingChangeObserver {
      constructor() {
        let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        const orderedFromCallbacks = options.callbacks && LocalCollection._observeChangesCallbacksAreOrdered(options.callbacks);
        if (hasOwn.call(options, 'ordered')) {
          this.ordered = options.ordered;
          if (options.callbacks && options.ordered !== orderedFromCallbacks) {
            throw Error('ordered option doesn\'t match callbacks');
          }
        } else if (options.callbacks) {
          this.ordered = orderedFromCallbacks;
        } else {
          throw Error('must provide ordered or callbacks');
        }
        const callbacks = options.callbacks || {};
        if (this.ordered) {
          this.docs = new OrderedDict(MongoID.idStringify);
          this.applyChange = {
            addedBefore: (id, fields, before) => {
              // Take a shallow copy since the top-level properties can be changed
              const doc = _objectSpread({}, fields);
              doc._id = id;
              if (callbacks.addedBefore) {
                callbacks.addedBefore.call(this, id, EJSON.clone(fields), before);
              }

              // This line triggers if we provide added with movedBefore.
              if (callbacks.added) {
                callbacks.added.call(this, id, EJSON.clone(fields));
              }

              // XXX could `before` be a falsy ID?  Technically
              // idStringify seems to allow for them -- though
              // OrderedDict won't call stringify on a falsy arg.
              this.docs.putBefore(id, doc, before || null);
            },
            movedBefore: (id, before) => {
              if (callbacks.movedBefore) {
                callbacks.movedBefore.call(this, id, before);
              }
              this.docs.moveBefore(id, before || null);
            }
          };
        } else {
          this.docs = new LocalCollection._IdMap();
          this.applyChange = {
            added: (id, fields) => {
              // Take a shallow copy since the top-level properties can be changed
              const doc = _objectSpread({}, fields);
              if (callbacks.added) {
                callbacks.added.call(this, id, EJSON.clone(fields));
              }
              doc._id = id;
              this.docs.set(id, doc);
            }
          };
        }

        // The methods in _IdMap and OrderedDict used by these callbacks are
        // identical.
        this.applyChange.changed = (id, fields) => {
          const doc = this.docs.get(id);
          if (!doc) {
            throw new Error("Unknown id for changed: ".concat(id));
          }
          if (callbacks.changed) {
            callbacks.changed.call(this, id, EJSON.clone(fields));
          }
          DiffSequence.applyChanges(doc, fields);
        };
        this.applyChange.removed = id => {
          if (callbacks.removed) {
            callbacks.removed.call(this, id);
          }
          this.docs.remove(id);
        };
      }
    };
    LocalCollection._IdMap = class _IdMap extends IdMap {
      constructor() {
        super(MongoID.idStringify, MongoID.idParse);
      }
    };

    // Wrap a transform function to return objects that have the _id field
    // of the untransformed document. This ensures that subsystems such as
    // the observe-sequence package that call `observe` can keep track of
    // the documents identities.
    //
    // - Require that it returns objects
    // - If the return value has an _id field, verify that it matches the
    //   original _id field
    // - If the return value doesn't have an _id field, add it back.
    LocalCollection.wrapTransform = transform => {
      if (!transform) {
        return null;
      }

      // No need to doubly-wrap transforms.
      if (transform.__wrappedTransform__) {
        return transform;
      }
      const wrapped = doc => {
        if (!hasOwn.call(doc, '_id')) {
          // XXX do we ever have a transform on the oplog's collection? because that
          // collection has no _id.
          throw new Error('can only transform documents with _id');
        }
        const id = doc._id;

        // XXX consider making tracker a weak dependency and checking
        // Package.tracker here
        const transformed = Tracker.nonreactive(() => transform(doc));
        if (!LocalCollection._isPlainObject(transformed)) {
          throw new Error('transform must return object');
        }
        if (hasOwn.call(transformed, '_id')) {
          if (!EJSON.equals(transformed._id, id)) {
            throw new Error('transformed document can\'t have different _id');
          }
        } else {
          transformed._id = id;
        }
        return transformed;
      };
      wrapped.__wrappedTransform__ = true;
      return wrapped;
    };

    // XXX the sorted-query logic below is laughably inefficient. we'll
    // need to come up with a better datastructure for this.
    //
    // XXX the logic for observing with a skip or a limit is even more
    // laughably inefficient. we recompute the whole results every time!

    // This binary search puts a value between any equal values, and the first
    // lesser value.
    LocalCollection._binarySearch = (cmp, array, value) => {
      let first = 0;
      let range = array.length;
      while (range > 0) {
        const halfRange = Math.floor(range / 2);
        if (cmp(value, array[first + halfRange]) >= 0) {
          first += halfRange + 1;
          range -= halfRange + 1;
        } else {
          range = halfRange;
        }
      }
      return first;
    };
    LocalCollection._checkSupportedProjection = fields => {
      if (fields !== Object(fields) || Array.isArray(fields)) {
        throw MinimongoError('fields option must be an object');
      }
      Object.keys(fields).forEach(keyPath => {
        if (keyPath.split('.').includes('$')) {
          throw MinimongoError('Minimongo doesn\'t support $ operator in projections yet.');
        }
        const value = fields[keyPath];
        if (typeof value === 'object' && ['$elemMatch', '$meta', '$slice'].some(key => hasOwn.call(value, key))) {
          throw MinimongoError('Minimongo doesn\'t support operators in projections yet.');
        }
        if (![1, 0, true, false].includes(value)) {
          throw MinimongoError('Projection values should be one of 1, 0, true, or false');
        }
      });
    };

    // Knows how to compile a fields projection to a predicate function.
    // @returns - Function: a closure that filters out an object according to the
    //            fields projection rules:
    //            @param obj - Object: MongoDB-styled document
    //            @returns - Object: a document with the fields filtered out
    //                       according to projection rules. Doesn't retain subfields
    //                       of passed argument.
    LocalCollection._compileProjection = fields => {
      LocalCollection._checkSupportedProjection(fields);
      const _idProjection = fields._id === undefined ? true : fields._id;
      const details = projectionDetails(fields);

      // returns transformed doc according to ruleTree
      const transform = (doc, ruleTree) => {
        // Special case for "sets"
        if (Array.isArray(doc)) {
          return doc.map(subdoc => transform(subdoc, ruleTree));
        }
        const result = details.including ? {} : EJSON.clone(doc);
        Object.keys(ruleTree).forEach(key => {
          if (doc == null || !hasOwn.call(doc, key)) {
            return;
          }
          const rule = ruleTree[key];
          if (rule === Object(rule)) {
            // For sub-objects/subsets we branch
            if (doc[key] === Object(doc[key])) {
              result[key] = transform(doc[key], rule);
            }
          } else if (details.including) {
            // Otherwise we don't even touch this subfield
            result[key] = EJSON.clone(doc[key]);
          } else {
            delete result[key];
          }
        });
        return doc != null ? result : doc;
      };
      return doc => {
        const result = transform(doc, details.tree);
        if (_idProjection && hasOwn.call(doc, '_id')) {
          result._id = doc._id;
        }
        if (!_idProjection && hasOwn.call(result, '_id')) {
          delete result._id;
        }
        return result;
      };
    };

    // Calculates the document to insert in case we're doing an upsert and the
    // selector does not match any elements
    LocalCollection._createUpsertDocument = (selector, modifier) => {
      const selectorDocument = populateDocumentWithQueryFields(selector);
      const isModify = LocalCollection._isModificationMod(modifier);
      const newDoc = {};
      if (selectorDocument._id) {
        newDoc._id = selectorDocument._id;
        delete selectorDocument._id;
      }

      // This double _modify call is made to help with nested properties (see issue
      // #8631). We do this even if it's a replacement for validation purposes (e.g.
      // ambiguous id's)
      LocalCollection._modify(newDoc, {
        $set: selectorDocument
      });
      LocalCollection._modify(newDoc, modifier, {
        isInsert: true
      });
      if (isModify) {
        return newDoc;
      }

      // Replacement can take _id from query document
      const replacement = Object.assign({}, modifier);
      if (newDoc._id) {
        replacement._id = newDoc._id;
      }
      return replacement;
    };
    LocalCollection._diffObjects = (left, right, callbacks) => {
      return DiffSequence.diffObjects(left, right, callbacks);
    };

    // ordered: bool.
    // old_results and new_results: collections of documents.
    //    if ordered, they are arrays.
    //    if unordered, they are IdMaps
    LocalCollection._diffQueryChanges = (ordered, oldResults, newResults, observer, options) => DiffSequence.diffQueryChanges(ordered, oldResults, newResults, observer, options);
    LocalCollection._diffQueryOrderedChanges = (oldResults, newResults, observer, options) => DiffSequence.diffQueryOrderedChanges(oldResults, newResults, observer, options);
    LocalCollection._diffQueryUnorderedChanges = (oldResults, newResults, observer, options) => DiffSequence.diffQueryUnorderedChanges(oldResults, newResults, observer, options);
    LocalCollection._findInOrderedResults = (query, doc) => {
      if (!query.ordered) {
        throw new Error('Can\'t call _findInOrderedResults on unordered query');
      }
      for (let i = 0; i < query.results.length; i++) {
        if (query.results[i] === doc) {
          return i;
        }
      }
      throw Error('object missing from query');
    };

    // If this is a selector which explicitly constrains the match by ID to a finite
    // number of documents, returns a list of their IDs.  Otherwise returns
    // null. Note that the selector may have other restrictions so it may not even
    // match those document!  We care about $in and $and since those are generated
    // access-controlled update and remove.
    LocalCollection._idsMatchedBySelector = selector => {
      // Is the selector just an ID?
      if (LocalCollection._selectorIsId(selector)) {
        return [selector];
      }
      if (!selector) {
        return null;
      }

      // Do we have an _id clause?
      if (hasOwn.call(selector, '_id')) {
        // Is the _id clause just an ID?
        if (LocalCollection._selectorIsId(selector._id)) {
          return [selector._id];
        }

        // Is the _id clause {_id: {$in: ["x", "y", "z"]}}?
        if (selector._id && Array.isArray(selector._id.$in) && selector._id.$in.length && selector._id.$in.every(LocalCollection._selectorIsId)) {
          return selector._id.$in;
        }
        return null;
      }

      // If this is a top-level $and, and any of the clauses constrain their
      // documents, then the whole selector is constrained by any one clause's
      // constraint. (Well, by their intersection, but that seems unlikely.)
      if (Array.isArray(selector.$and)) {
        for (let i = 0; i < selector.$and.length; ++i) {
          const subIds = LocalCollection._idsMatchedBySelector(selector.$and[i]);
          if (subIds) {
            return subIds;
          }
        }
      }
      return null;
    };
    LocalCollection._insertInResultsSync = (query, doc) => {
      const fields = EJSON.clone(doc);
      delete fields._id;
      if (query.ordered) {
        if (!query.sorter) {
          query.addedBefore(doc._id, query.projectionFn(fields), null);
          query.results.push(doc);
        } else {
          const i = LocalCollection._insertInSortedList(query.sorter.getComparator({
            distances: query.distances
          }), query.results, doc);
          let next = query.results[i + 1];
          if (next) {
            next = next._id;
          } else {
            next = null;
          }
          query.addedBefore(doc._id, query.projectionFn(fields), next);
        }
        query.added(doc._id, query.projectionFn(fields));
      } else {
        query.added(doc._id, query.projectionFn(fields));
        query.results.set(doc._id, doc);
      }
    };
    LocalCollection._insertInResultsAsync = async (query, doc) => {
      const fields = EJSON.clone(doc);
      delete fields._id;
      if (query.ordered) {
        if (!query.sorter) {
          await query.addedBefore(doc._id, query.projectionFn(fields), null);
          query.results.push(doc);
        } else {
          const i = LocalCollection._insertInSortedList(query.sorter.getComparator({
            distances: query.distances
          }), query.results, doc);
          let next = query.results[i + 1];
          if (next) {
            next = next._id;
          } else {
            next = null;
          }
          await query.addedBefore(doc._id, query.projectionFn(fields), next);
        }
        await query.added(doc._id, query.projectionFn(fields));
      } else {
        await query.added(doc._id, query.projectionFn(fields));
        query.results.set(doc._id, doc);
      }
    };
    LocalCollection._insertInSortedList = (cmp, array, value) => {
      if (array.length === 0) {
        array.push(value);
        return 0;
      }
      const i = LocalCollection._binarySearch(cmp, array, value);
      array.splice(i, 0, value);
      return i;
    };
    LocalCollection._isModificationMod = mod => {
      let isModify = false;
      let isReplace = false;
      Object.keys(mod).forEach(key => {
        if (key.substr(0, 1) === '$') {
          isModify = true;
        } else {
          isReplace = true;
        }
      });
      if (isModify && isReplace) {
        throw new Error('Update parameter cannot have both modifier and non-modifier fields.');
      }
      return isModify;
    };

    // XXX maybe this should be EJSON.isObject, though EJSON doesn't know about
    // RegExp
    // XXX note that _type(undefined) === 3!!!!
    LocalCollection._isPlainObject = x => {
      return x && LocalCollection._f._type(x) === 3;
    };

    // XXX need a strategy for passing the binding of $ into this
    // function, from the compiled selector
    //
    // maybe just {key.up.to.just.before.dollarsign: array_index}
    //
    // XXX atomicity: if one modification fails, do we roll back the whole
    // change?
    //
    // options:
    //   - isInsert is set when _modify is being called to compute the document to
    //     insert as part of an upsert operation. We use this primarily to figure
    //     out when to set the fields in $setOnInsert, if present.
    LocalCollection._modify = function (doc, modifier) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      if (!LocalCollection._isPlainObject(modifier)) {
        throw MinimongoError('Modifier must be an object');
      }

      // Make sure the caller can't mutate our data structures.
      modifier = EJSON.clone(modifier);
      const isModifier = isOperatorObject(modifier);
      const newDoc = isModifier ? EJSON.clone(doc) : modifier;
      if (isModifier) {
        // apply modifiers to the doc.
        Object.keys(modifier).forEach(operator => {
          // Treat $setOnInsert as $set if this is an insert.
          const setOnInsert = options.isInsert && operator === '$setOnInsert';
          const modFunc = MODIFIERS[setOnInsert ? '$set' : operator];
          const operand = modifier[operator];
          if (!modFunc) {
            throw MinimongoError("Invalid modifier specified ".concat(operator));
          }
          Object.keys(operand).forEach(keypath => {
            const arg = operand[keypath];
            if (keypath === '') {
              throw MinimongoError('An empty update path is not valid.');
            }
            const keyparts = keypath.split('.');
            if (!keyparts.every(Boolean)) {
              throw MinimongoError("The update path '".concat(keypath, "' contains an empty field name, ") + 'which is not allowed.');
            }
            const target = findModTarget(newDoc, keyparts, {
              arrayIndices: options.arrayIndices,
              forbidArray: operator === '$rename',
              noCreate: NO_CREATE_MODIFIERS[operator]
            });
            modFunc(target, keyparts.pop(), arg, keypath, newDoc);
          });
        });
        if (doc._id && !EJSON.equals(doc._id, newDoc._id)) {
          throw MinimongoError("After applying the update to the document {_id: \"".concat(doc._id, "\", ...},") + ' the (immutable) field \'_id\' was found to have been altered to ' + "_id: \"".concat(newDoc._id, "\""));
        }
      } else {
        if (doc._id && modifier._id && !EJSON.equals(doc._id, modifier._id)) {
          throw MinimongoError("The _id field cannot be changed from {_id: \"".concat(doc._id, "\"} to ") + "{_id: \"".concat(modifier._id, "\"}"));
        }

        // replace the whole document
        assertHasValidFieldNames(modifier);
      }

      // move new document into place.
      Object.keys(doc).forEach(key => {
        // Note: this used to be for (var key in doc) however, this does not
        // work right in Opera. Deleting from a doc while iterating over it
        // would sometimes cause opera to skip some keys.
        if (key !== '_id') {
          delete doc[key];
        }
      });
      Object.keys(newDoc).forEach(key => {
        doc[key] = newDoc[key];
      });
    };
    LocalCollection._observeFromObserveChanges = (cursor, observeCallbacks) => {
      const transform = cursor.getTransform() || (doc => doc);
      let suppressed = !!observeCallbacks._suppress_initial;
      let observeChangesCallbacks;
      if (LocalCollection._observeCallbacksAreOrdered(observeCallbacks)) {
        // The "_no_indices" option sets all index arguments to -1 and skips the
        // linear scans required to generate them.  This lets observers that don't
        // need absolute indices benefit from the other features of this API --
        // relative order, transforms, and applyChanges -- without the speed hit.
        const indices = !observeCallbacks._no_indices;
        observeChangesCallbacks = {
          addedBefore(id, fields, before) {
            const check = suppressed || !(observeCallbacks.addedAt || observeCallbacks.added);
            if (check) {
              return;
            }
            const doc = transform(Object.assign(fields, {
              _id: id
            }));
            if (observeCallbacks.addedAt) {
              observeCallbacks.addedAt(doc, indices ? before ? this.docs.indexOf(before) : this.docs.size() : -1, before);
            } else {
              observeCallbacks.added(doc);
            }
          },
          changed(id, fields) {
            if (!(observeCallbacks.changedAt || observeCallbacks.changed)) {
              return;
            }
            let doc = EJSON.clone(this.docs.get(id));
            if (!doc) {
              throw new Error("Unknown id for changed: ".concat(id));
            }
            const oldDoc = transform(EJSON.clone(doc));
            DiffSequence.applyChanges(doc, fields);
            if (observeCallbacks.changedAt) {
              observeCallbacks.changedAt(transform(doc), oldDoc, indices ? this.docs.indexOf(id) : -1);
            } else {
              observeCallbacks.changed(transform(doc), oldDoc);
            }
          },
          movedBefore(id, before) {
            if (!observeCallbacks.movedTo) {
              return;
            }
            const from = indices ? this.docs.indexOf(id) : -1;
            let to = indices ? before ? this.docs.indexOf(before) : this.docs.size() : -1;

            // When not moving backwards, adjust for the fact that removing the
            // document slides everything back one slot.
            if (to > from) {
              --to;
            }
            observeCallbacks.movedTo(transform(EJSON.clone(this.docs.get(id))), from, to, before || null);
          },
          removed(id) {
            if (!(observeCallbacks.removedAt || observeCallbacks.removed)) {
              return;
            }

            // technically maybe there should be an EJSON.clone here, but it's about
            // to be removed from this.docs!
            const doc = transform(this.docs.get(id));
            if (observeCallbacks.removedAt) {
              observeCallbacks.removedAt(doc, indices ? this.docs.indexOf(id) : -1);
            } else {
              observeCallbacks.removed(doc);
            }
          }
        };
      } else {
        observeChangesCallbacks = {
          added(id, fields) {
            if (!suppressed && observeCallbacks.added) {
              observeCallbacks.added(transform(Object.assign(fields, {
                _id: id
              })));
            }
          },
          changed(id, fields) {
            if (observeCallbacks.changed) {
              const oldDoc = this.docs.get(id);
              const doc = EJSON.clone(oldDoc);
              DiffSequence.applyChanges(doc, fields);
              observeCallbacks.changed(transform(doc), transform(EJSON.clone(oldDoc)));
            }
          },
          removed(id) {
            if (observeCallbacks.removed) {
              observeCallbacks.removed(transform(this.docs.get(id)));
            }
          }
        };
      }
      const changeObserver = new LocalCollection._CachingChangeObserver({
        callbacks: observeChangesCallbacks
      });

      // CachingChangeObserver clones all received input on its callbacks
      // So we can mark it as safe to reduce the ejson clones.
      // This is tested by the `mongo-livedata - (extended) scribbling` tests
      changeObserver.applyChange._fromObserve = true;
      const handle = cursor.observeChanges(changeObserver.applyChange, {
        nonMutatingCallbacks: true
      });

      // If needed, re-enable callbacks as soon as the initial batch is ready.
      const setSuppressed = h => {
        var _h$isReadyPromise;
        if (h.isReady) suppressed = false;else (_h$isReadyPromise = h.isReadyPromise) === null || _h$isReadyPromise === void 0 ? void 0 : _h$isReadyPromise.then(() => suppressed = false);
      };
      // When we call cursor.observeChanges() it can be the on from
      // the mongo package (instead of the minimongo one) and it doesn't have isReady and isReadyPromise
      if (Meteor._isPromise(handle)) {
        handle.then(setSuppressed);
      } else {
        setSuppressed(handle);
      }
      return handle;
    };
    LocalCollection._observeCallbacksAreOrdered = callbacks => {
      if (callbacks.added && callbacks.addedAt) {
        throw new Error('Please specify only one of added() and addedAt()');
      }
      if (callbacks.changed && callbacks.changedAt) {
        throw new Error('Please specify only one of changed() and changedAt()');
      }
      if (callbacks.removed && callbacks.removedAt) {
        throw new Error('Please specify only one of removed() and removedAt()');
      }
      return !!(callbacks.addedAt || callbacks.changedAt || callbacks.movedTo || callbacks.removedAt);
    };
    LocalCollection._observeChangesCallbacksAreOrdered = callbacks => {
      if (callbacks.added && callbacks.addedBefore) {
        throw new Error('Please specify only one of added() and addedBefore()');
      }
      return !!(callbacks.addedBefore || callbacks.movedBefore);
    };
    LocalCollection._removeFromResultsSync = (query, doc) => {
      if (query.ordered) {
        const i = LocalCollection._findInOrderedResults(query, doc);
        query.removed(doc._id);
        query.results.splice(i, 1);
      } else {
        const id = doc._id; // in case callback mutates doc

        query.removed(doc._id);
        query.results.remove(id);
      }
    };
    LocalCollection._removeFromResultsAsync = async (query, doc) => {
      if (query.ordered) {
        const i = LocalCollection._findInOrderedResults(query, doc);
        await query.removed(doc._id);
        query.results.splice(i, 1);
      } else {
        const id = doc._id; // in case callback mutates doc

        await query.removed(doc._id);
        query.results.remove(id);
      }
    };

    // Is this selector just shorthand for lookup by _id?
    LocalCollection._selectorIsId = selector => typeof selector === 'number' || typeof selector === 'string' || selector instanceof MongoID.ObjectID;

    // Is the selector just lookup by _id (shorthand or not)?
    LocalCollection._selectorIsIdPerhapsAsObject = selector => LocalCollection._selectorIsId(selector) || LocalCollection._selectorIsId(selector && selector._id) && Object.keys(selector).length === 1;
    LocalCollection._updateInResultsSync = (query, doc, old_doc) => {
      if (!EJSON.equals(doc._id, old_doc._id)) {
        throw new Error('Can\'t change a doc\'s _id while updating');
      }
      const projectionFn = query.projectionFn;
      const changedFields = DiffSequence.makeChangedFields(projectionFn(doc), projectionFn(old_doc));
      if (!query.ordered) {
        if (Object.keys(changedFields).length) {
          query.changed(doc._id, changedFields);
          query.results.set(doc._id, doc);
        }
        return;
      }
      const old_idx = LocalCollection._findInOrderedResults(query, doc);
      if (Object.keys(changedFields).length) {
        query.changed(doc._id, changedFields);
      }
      if (!query.sorter) {
        return;
      }

      // just take it out and put it back in again, and see if the index changes
      query.results.splice(old_idx, 1);
      const new_idx = LocalCollection._insertInSortedList(query.sorter.getComparator({
        distances: query.distances
      }), query.results, doc);
      if (old_idx !== new_idx) {
        let next = query.results[new_idx + 1];
        if (next) {
          next = next._id;
        } else {
          next = null;
        }
        query.movedBefore && query.movedBefore(doc._id, next);
      }
    };
    LocalCollection._updateInResultsAsync = async (query, doc, old_doc) => {
      if (!EJSON.equals(doc._id, old_doc._id)) {
        throw new Error('Can\'t change a doc\'s _id while updating');
      }
      const projectionFn = query.projectionFn;
      const changedFields = DiffSequence.makeChangedFields(projectionFn(doc), projectionFn(old_doc));
      if (!query.ordered) {
        if (Object.keys(changedFields).length) {
          await query.changed(doc._id, changedFields);
          query.results.set(doc._id, doc);
        }
        return;
      }
      const old_idx = LocalCollection._findInOrderedResults(query, doc);
      if (Object.keys(changedFields).length) {
        await query.changed(doc._id, changedFields);
      }
      if (!query.sorter) {
        return;
      }

      // just take it out and put it back in again, and see if the index changes
      query.results.splice(old_idx, 1);
      const new_idx = LocalCollection._insertInSortedList(query.sorter.getComparator({
        distances: query.distances
      }), query.results, doc);
      if (old_idx !== new_idx) {
        let next = query.results[new_idx + 1];
        if (next) {
          next = next._id;
        } else {
          next = null;
        }
        query.movedBefore && (await query.movedBefore(doc._id, next));
      }
    };
    const MODIFIERS = {
      $currentDate(target, field, arg) {
        if (typeof arg === 'object' && hasOwn.call(arg, '$type')) {
          if (arg.$type !== 'date') {
            throw MinimongoError('Minimongo does currently only support the date type in ' + '$currentDate modifiers', {
              field
            });
          }
        } else if (arg !== true) {
          throw MinimongoError('Invalid $currentDate modifier', {
            field
          });
        }
        target[field] = new Date();
      },
      $inc(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $inc allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $inc modifier to non-number', {
              field
            });
          }
          target[field] += arg;
        } else {
          target[field] = arg;
        }
      },
      $min(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $min allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $min modifier to non-number', {
              field
            });
          }
          if (target[field] > arg) {
            target[field] = arg;
          }
        } else {
          target[field] = arg;
        }
      },
      $max(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $max allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $max modifier to non-number', {
              field
            });
          }
          if (target[field] < arg) {
            target[field] = arg;
          }
        } else {
          target[field] = arg;
        }
      },
      $mul(target, field, arg) {
        if (typeof arg !== 'number') {
          throw MinimongoError('Modifier $mul allowed for numbers only', {
            field
          });
        }
        if (field in target) {
          if (typeof target[field] !== 'number') {
            throw MinimongoError('Cannot apply $mul modifier to non-number', {
              field
            });
          }
          target[field] *= arg;
        } else {
          target[field] = 0;
        }
      },
      $rename(target, field, arg, keypath, doc) {
        // no idea why mongo has this restriction..
        if (keypath === arg) {
          throw MinimongoError('$rename source must differ from target', {
            field
          });
        }
        if (target === null) {
          throw MinimongoError('$rename source field invalid', {
            field
          });
        }
        if (typeof arg !== 'string') {
          throw MinimongoError('$rename target must be a string', {
            field
          });
        }
        if (arg.includes('\0')) {
          // Null bytes are not allowed in Mongo field names
          // https://docs.mongodb.com/manual/reference/limits/#Restrictions-on-Field-Names
          throw MinimongoError('The \'to\' field for $rename cannot contain an embedded null byte', {
            field
          });
        }
        if (target === undefined) {
          return;
        }
        const object = target[field];
        delete target[field];
        const keyparts = arg.split('.');
        const target2 = findModTarget(doc, keyparts, {
          forbidArray: true
        });
        if (target2 === null) {
          throw MinimongoError('$rename target field invalid', {
            field
          });
        }
        target2[keyparts.pop()] = object;
      },
      $set(target, field, arg) {
        if (target !== Object(target)) {
          // not an array or an object
          const error = MinimongoError('Cannot set property on non-object field', {
            field
          });
          error.setPropertyError = true;
          throw error;
        }
        if (target === null) {
          const error = MinimongoError('Cannot set property on null', {
            field
          });
          error.setPropertyError = true;
          throw error;
        }
        assertHasValidFieldNames(arg);
        target[field] = arg;
      },
      $setOnInsert(target, field, arg) {
        // converted to `$set` in `_modify`
      },
      $unset(target, field, arg) {
        if (target !== undefined) {
          if (target instanceof Array) {
            if (field in target) {
              target[field] = null;
            }
          } else {
            delete target[field];
          }
        }
      },
      $push(target, field, arg) {
        if (target[field] === undefined) {
          target[field] = [];
        }
        if (!(target[field] instanceof Array)) {
          throw MinimongoError('Cannot apply $push modifier to non-array', {
            field
          });
        }
        if (!(arg && arg.$each)) {
          // Simple mode: not $each
          assertHasValidFieldNames(arg);
          target[field].push(arg);
          return;
        }

        // Fancy mode: $each (and maybe $slice and $sort and $position)
        const toPush = arg.$each;
        if (!(toPush instanceof Array)) {
          throw MinimongoError('$each must be an array', {
            field
          });
        }
        assertHasValidFieldNames(toPush);

        // Parse $position
        let position = undefined;
        if ('$position' in arg) {
          if (typeof arg.$position !== 'number') {
            throw MinimongoError('$position must be a numeric value', {
              field
            });
          }

          // XXX should check to make sure integer
          if (arg.$position < 0) {
            throw MinimongoError('$position in $push must be zero or positive', {
              field
            });
          }
          position = arg.$position;
        }

        // Parse $slice.
        let slice = undefined;
        if ('$slice' in arg) {
          if (typeof arg.$slice !== 'number') {
            throw MinimongoError('$slice must be a numeric value', {
              field
            });
          }

          // XXX should check to make sure integer
          slice = arg.$slice;
        }

        // Parse $sort.
        let sortFunction = undefined;
        if (arg.$sort) {
          if (slice === undefined) {
            throw MinimongoError('$sort requires $slice to be present', {
              field
            });
          }

          // XXX this allows us to use a $sort whose value is an array, but that's
          // actually an extension of the Node driver, so it won't work
          // server-side. Could be confusing!
          // XXX is it correct that we don't do geo-stuff here?
          sortFunction = new Minimongo.Sorter(arg.$sort).getComparator();
          toPush.forEach(element => {
            if (LocalCollection._f._type(element) !== 3) {
              throw MinimongoError('$push like modifiers using $sort require all elements to be ' + 'objects', {
                field
              });
            }
          });
        }

        // Actually push.
        if (position === undefined) {
          toPush.forEach(element => {
            target[field].push(element);
          });
        } else {
          const spliceArguments = [position, 0];
          toPush.forEach(element => {
            spliceArguments.push(element);
          });
          target[field].splice(...spliceArguments);
        }

        // Actually sort.
        if (sortFunction) {
          target[field].sort(sortFunction);
        }

        // Actually slice.
        if (slice !== undefined) {
          if (slice === 0) {
            target[field] = []; // differs from Array.slice!
          } else if (slice < 0) {
            target[field] = target[field].slice(slice);
          } else {
            target[field] = target[field].slice(0, slice);
          }
        }
      },
      $pushAll(target, field, arg) {
        if (!(typeof arg === 'object' && arg instanceof Array)) {
          throw MinimongoError('Modifier $pushAll/pullAll allowed for arrays only');
        }
        assertHasValidFieldNames(arg);
        const toPush = target[field];
        if (toPush === undefined) {
          target[field] = arg;
        } else if (!(toPush instanceof Array)) {
          throw MinimongoError('Cannot apply $pushAll modifier to non-array', {
            field
          });
        } else {
          toPush.push(...arg);
        }
      },
      $addToSet(target, field, arg) {
        let isEach = false;
        if (typeof arg === 'object') {
          // check if first key is '$each'
          const keys = Object.keys(arg);
          if (keys[0] === '$each') {
            isEach = true;
          }
        }
        const values = isEach ? arg.$each : [arg];
        assertHasValidFieldNames(values);
        const toAdd = target[field];
        if (toAdd === undefined) {
          target[field] = values;
        } else if (!(toAdd instanceof Array)) {
          throw MinimongoError('Cannot apply $addToSet modifier to non-array', {
            field
          });
        } else {
          values.forEach(value => {
            if (toAdd.some(element => LocalCollection._f._equal(value, element))) {
              return;
            }
            toAdd.push(value);
          });
        }
      },
      $pop(target, field, arg) {
        if (target === undefined) {
          return;
        }
        const toPop = target[field];
        if (toPop === undefined) {
          return;
        }
        if (!(toPop instanceof Array)) {
          throw MinimongoError('Cannot apply $pop modifier to non-array', {
            field
          });
        }
        if (typeof arg === 'number' && arg < 0) {
          toPop.splice(0, 1);
        } else {
          toPop.pop();
        }
      },
      $pull(target, field, arg) {
        if (target === undefined) {
          return;
        }
        const toPull = target[field];
        if (toPull === undefined) {
          return;
        }
        if (!(toPull instanceof Array)) {
          throw MinimongoError('Cannot apply $pull/pullAll modifier to non-array', {
            field
          });
        }
        let out;
        if (arg != null && typeof arg === 'object' && !(arg instanceof Array)) {
          // XXX would be much nicer to compile this once, rather than
          // for each document we modify.. but usually we're not
          // modifying that many documents, so we'll let it slide for
          // now

          // XXX Minimongo.Matcher isn't up for the job, because we need
          // to permit stuff like {$pull: {a: {$gt: 4}}}.. something
          // like {$gt: 4} is not normally a complete selector.
          // same issue as $elemMatch possibly?
          const matcher = new Minimongo.Matcher(arg);
          out = toPull.filter(element => !matcher.documentMatches(element).result);
        } else {
          out = toPull.filter(element => !LocalCollection._f._equal(element, arg));
        }
        target[field] = out;
      },
      $pullAll(target, field, arg) {
        if (!(typeof arg === 'object' && arg instanceof Array)) {
          throw MinimongoError('Modifier $pushAll/pullAll allowed for arrays only', {
            field
          });
        }
        if (target === undefined) {
          return;
        }
        const toPull = target[field];
        if (toPull === undefined) {
          return;
        }
        if (!(toPull instanceof Array)) {
          throw MinimongoError('Cannot apply $pull/pullAll modifier to non-array', {
            field
          });
        }
        target[field] = toPull.filter(object => !arg.some(element => LocalCollection._f._equal(object, element)));
      },
      $bit(target, field, arg) {
        // XXX mongo only supports $bit on integers, and we only support
        // native javascript numbers (doubles) so far, so we can't support $bit
        throw MinimongoError('$bit is not supported', {
          field
        });
      },
      $v() {
        // As discussed in https://github.com/meteor/meteor/issues/9623,
        // the `$v` operator is not needed by Meteor, but problems can occur if
        // it's not at least callable (as of Mongo >= 3.6). It's defined here as
        // a no-op to work around these problems.
      }
    };
    const NO_CREATE_MODIFIERS = {
      $pop: true,
      $pull: true,
      $pullAll: true,
      $rename: true,
      $unset: true
    };

    // Make sure field names do not contain Mongo restricted
    // characters ('.', '$', '\0').
    // https://docs.mongodb.com/manual/reference/limits/#Restrictions-on-Field-Names
    const invalidCharMsg = {
      $: 'start with \'$\'',
      '.': 'contain \'.\'',
      '\0': 'contain null bytes'
    };

    // checks if all field names in an object are valid
    function assertHasValidFieldNames(doc) {
      if (doc && typeof doc === 'object') {
        JSON.stringify(doc, (key, value) => {
          assertIsValidFieldName(key);
          return value;
        });
      }
    }
    function assertIsValidFieldName(key) {
      let match;
      if (typeof key === 'string' && (match = key.match(/^\$|\.|\0/))) {
        throw MinimongoError("Key ".concat(key, " must not ").concat(invalidCharMsg[match[0]]));
      }
    }

    // for a.b.c.2.d.e, keyparts should be ['a', 'b', 'c', '2', 'd', 'e'],
    // and then you would operate on the 'e' property of the returned
    // object.
    //
    // if options.noCreate is falsey, creates intermediate levels of
    // structure as necessary, like mkdir -p (and raises an exception if
    // that would mean giving a non-numeric property to an array.) if
    // options.noCreate is true, return undefined instead.
    //
    // may modify the last element of keyparts to signal to the caller that it needs
    // to use a different value to index into the returned object (for example,
    // ['a', '01'] -> ['a', 1]).
    //
    // if forbidArray is true, return null if the keypath goes through an array.
    //
    // if options.arrayIndices is set, use its first element for the (first) '$' in
    // the path.
    function findModTarget(doc, keyparts) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      let usedArrayIndex = false;
      for (let i = 0; i < keyparts.length; i++) {
        const last = i === keyparts.length - 1;
        let keypart = keyparts[i];
        if (!isIndexable(doc)) {
          if (options.noCreate) {
            return undefined;
          }
          const error = MinimongoError("cannot use the part '".concat(keypart, "' to traverse ").concat(doc));
          error.setPropertyError = true;
          throw error;
        }
        if (doc instanceof Array) {
          if (options.forbidArray) {
            return null;
          }
          if (keypart === '$') {
            if (usedArrayIndex) {
              throw MinimongoError('Too many positional (i.e. \'$\') elements');
            }
            if (!options.arrayIndices || !options.arrayIndices.length) {
              throw MinimongoError('The positional operator did not find the match needed from the ' + 'query');
            }
            keypart = options.arrayIndices[0];
            usedArrayIndex = true;
          } else if (isNumericKey(keypart)) {
            keypart = parseInt(keypart);
          } else {
            if (options.noCreate) {
              return undefined;
            }
            throw MinimongoError("can't append to array using string field name [".concat(keypart, "]"));
          }
          if (last) {
            keyparts[i] = keypart; // handle 'a.01'
          }
          if (options.noCreate && keypart >= doc.length) {
            return undefined;
          }
          while (doc.length < keypart) {
            doc.push(null);
          }
          if (!last) {
            if (doc.length === keypart) {
              doc.push({});
            } else if (typeof doc[keypart] !== 'object') {
              throw MinimongoError("can't modify field '".concat(keyparts[i + 1], "' of list value ") + JSON.stringify(doc[keypart]));
            }
          }
        } else {
          assertIsValidFieldName(keypart);
          if (!(keypart in doc)) {
            if (options.noCreate) {
              return undefined;
            }
            if (!last) {
              doc[keypart] = {};
            }
          }
        }
        if (last) {
          return doc;
        }
        doc = doc[keypart];
      }

      // notreached
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

},"matcher.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/matcher.js                                                                                     //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    var _Package$mongoDecima;
    module.export({
      default: () => Matcher
    });
    let LocalCollection;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection = v;
      }
    }, 0);
    let compileDocumentSelector, hasOwn, nothingMatcher;
    module.link("./common.js", {
      compileDocumentSelector(v) {
        compileDocumentSelector = v;
      },
      hasOwn(v) {
        hasOwn = v;
      },
      nothingMatcher(v) {
        nothingMatcher = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const Decimal = ((_Package$mongoDecima = Package['mongo-decimal']) === null || _Package$mongoDecima === void 0 ? void 0 : _Package$mongoDecima.Decimal) || class DecimalStub {};

    // The minimongo selector compiler!

    // Terminology:
    //  - a 'selector' is the EJSON object representing a selector
    //  - a 'matcher' is its compiled form (whether a full Minimongo.Matcher
    //    object or one of the component lambdas that matches parts of it)
    //  - a 'result object' is an object with a 'result' field and maybe
    //    distance and arrayIndices.
    //  - a 'branched value' is an object with a 'value' field and maybe
    //    'dontIterate' and 'arrayIndices'.
    //  - a 'document' is a top-level object that can be stored in a collection.
    //  - a 'lookup function' is a function that takes in a document and returns
    //    an array of 'branched values'.
    //  - a 'branched matcher' maps from an array of branched values to a result
    //    object.
    //  - an 'element matcher' maps from a single value to a bool.

    // Main entry point.
    //   var matcher = new Minimongo.Matcher({a: {$gt: 5}});
    //   if (matcher.documentMatches({a: 7})) ...
    class Matcher {
      constructor(selector, isUpdate) {
        // A set (object mapping string -> *) of all of the document paths looked
        // at by the selector. Also includes the empty string if it may look at any
        // path (eg, $where).
        this._paths = {};
        // Set to true if compilation finds a $near.
        this._hasGeoQuery = false;
        // Set to true if compilation finds a $where.
        this._hasWhere = false;
        // Set to false if compilation finds anything other than a simple equality
        // or one or more of '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin' used
        // with scalars as operands.
        this._isSimple = true;
        // Set to a dummy document which always matches this Matcher. Or set to null
        // if such document is too hard to find.
        this._matchingDocument = undefined;
        // A clone of the original selector. It may just be a function if the user
        // passed in a function; otherwise is definitely an object (eg, IDs are
        // translated into {_id: ID} first. Used by canBecomeTrueByModifier and
        // Sorter._useWithMatcher.
        this._selector = null;
        this._docMatcher = this._compileSelector(selector);
        // Set to true if selection is done for an update operation
        // Default is false
        // Used for $near array update (issue #3599)
        this._isUpdate = isUpdate;
      }
      documentMatches(doc) {
        if (doc !== Object(doc)) {
          throw Error('documentMatches needs a document');
        }
        return this._docMatcher(doc);
      }
      hasGeoQuery() {
        return this._hasGeoQuery;
      }
      hasWhere() {
        return this._hasWhere;
      }
      isSimple() {
        return this._isSimple;
      }

      // Given a selector, return a function that takes one argument, a
      // document. It returns a result object.
      _compileSelector(selector) {
        // you can pass a literal function instead of a selector
        if (selector instanceof Function) {
          this._isSimple = false;
          this._selector = selector;
          this._recordPathUsed('');
          return doc => ({
            result: !!selector.call(doc)
          });
        }

        // shorthand -- scalar _id
        if (LocalCollection._selectorIsId(selector)) {
          this._selector = {
            _id: selector
          };
          this._recordPathUsed('_id');
          return doc => ({
            result: EJSON.equals(doc._id, selector)
          });
        }

        // protect against dangerous selectors.  falsey and {_id: falsey} are both
        // likely programmer error, and not what you want, particularly for
        // destructive operations.
        if (!selector || hasOwn.call(selector, '_id') && !selector._id) {
          this._isSimple = false;
          return nothingMatcher;
        }

        // Top level can't be an array or true or binary.
        if (Array.isArray(selector) || EJSON.isBinary(selector) || typeof selector === 'boolean') {
          throw new Error("Invalid selector: ".concat(selector));
        }
        this._selector = EJSON.clone(selector);
        return compileDocumentSelector(selector, this, {
          isRoot: true
        });
      }

      // Returns a list of key paths the given selector is looking for. It includes
      // the empty string if there is a $where.
      _getPaths() {
        return Object.keys(this._paths);
      }
      _recordPathUsed(path) {
        this._paths[path] = true;
      }
    }
    // helpers used by compiled selector code
    LocalCollection._f = {
      // XXX for _all and _in, consider building 'inquery' at compile time..
      _type(v) {
        if (typeof v === 'number') {
          return 1;
        }
        if (typeof v === 'string') {
          return 2;
        }
        if (typeof v === 'boolean') {
          return 8;
        }
        if (Array.isArray(v)) {
          return 4;
        }
        if (v === null) {
          return 10;
        }

        // note that typeof(/x/) === "object"
        if (v instanceof RegExp) {
          return 11;
        }
        if (typeof v === 'function') {
          return 13;
        }
        if (v instanceof Date) {
          return 9;
        }
        if (EJSON.isBinary(v)) {
          return 5;
        }
        if (v instanceof MongoID.ObjectID) {
          return 7;
        }
        if (v instanceof Decimal) {
          return 1;
        }

        // object
        return 3;

        // XXX support some/all of these:
        // 14, symbol
        // 15, javascript code with scope
        // 16, 18: 32-bit/64-bit integer
        // 17, timestamp
        // 255, minkey
        // 127, maxkey
      },
      // deep equality test: use for literal document and array matches
      _equal(a, b) {
        return EJSON.equals(a, b, {
          keyOrderSensitive: true
        });
      },
      // maps a type code to a value that can be used to sort values of different
      // types
      _typeorder(t) {
        // http://www.mongodb.org/display/DOCS/What+is+the+Compare+Order+for+BSON+Types
        // XXX what is the correct sort position for Javascript code?
        // ('100' in the matrix below)
        // XXX minkey/maxkey
        return [-1,
        // (not a type)
        1,
        // number
        2,
        // string
        3,
        // object
        4,
        // array
        5,
        // binary
        -1,
        // deprecated
        6,
        // ObjectID
        7,
        // bool
        8,
        // Date
        0,
        // null
        9,
        // RegExp
        -1,
        // deprecated
        100,
        // JS code
        2,
        // deprecated (symbol)
        100,
        // JS code
        1,
        // 32-bit int
        8,
        // Mongo timestamp
        1 // 64-bit int
        ][t];
      },
      // compare two values of unknown type according to BSON ordering
      // semantics. (as an extension, consider 'undefined' to be less than
      // any other value.) return negative if a is less, positive if b is
      // less, or 0 if equal
      _cmp(a, b) {
        if (a === undefined) {
          return b === undefined ? 0 : -1;
        }
        if (b === undefined) {
          return 1;
        }
        let ta = LocalCollection._f._type(a);
        let tb = LocalCollection._f._type(b);
        const oa = LocalCollection._f._typeorder(ta);
        const ob = LocalCollection._f._typeorder(tb);
        if (oa !== ob) {
          return oa < ob ? -1 : 1;
        }

        // XXX need to implement this if we implement Symbol or integers, or
        // Timestamp
        if (ta !== tb) {
          throw Error('Missing type coercion logic in _cmp');
        }
        if (ta === 7) {
          // ObjectID
          // Convert to string.
          ta = tb = 2;
          a = a.toHexString();
          b = b.toHexString();
        }
        if (ta === 9) {
          // Date
          // Convert to millis.
          ta = tb = 1;
          a = isNaN(a) ? 0 : a.getTime();
          b = isNaN(b) ? 0 : b.getTime();
        }
        if (ta === 1) {
          // double
          if (a instanceof Decimal) {
            return a.minus(b).toNumber();
          } else {
            return a - b;
          }
        }
        if (tb === 2)
          // string
          return a < b ? -1 : a === b ? 0 : 1;
        if (ta === 3) {
          // Object
          // this could be much more efficient in the expected case ...
          const toArray = object => {
            const result = [];
            Object.keys(object).forEach(key => {
              result.push(key, object[key]);
            });
            return result;
          };
          return LocalCollection._f._cmp(toArray(a), toArray(b));
        }
        if (ta === 4) {
          // Array
          for (let i = 0;; i++) {
            if (i === a.length) {
              return i === b.length ? 0 : -1;
            }
            if (i === b.length) {
              return 1;
            }
            const s = LocalCollection._f._cmp(a[i], b[i]);
            if (s !== 0) {
              return s;
            }
          }
        }
        if (ta === 5) {
          // binary
          // Surprisingly, a small binary blob is always less than a large one in
          // Mongo.
          if (a.length !== b.length) {
            return a.length - b.length;
          }
          for (let i = 0; i < a.length; i++) {
            if (a[i] < b[i]) {
              return -1;
            }
            if (a[i] > b[i]) {
              return 1;
            }
          }
          return 0;
        }
        if (ta === 8) {
          // boolean
          if (a) {
            return b ? 0 : 1;
          }
          return b ? -1 : 0;
        }
        if (ta === 10)
          // null
          return 0;
        if (ta === 11)
          // regexp
          throw Error('Sorting not supported on regular expression'); // XXX

        // 13: javascript code
        // 14: symbol
        // 15: javascript code with scope
        // 16: 32-bit integer
        // 17: timestamp
        // 18: 64-bit integer
        // 255: minkey
        // 127: maxkey
        if (ta === 13)
          // javascript code
          throw Error('Sorting not supported on Javascript code'); // XXX

        throw Error('Unknown type to sort');
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
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"minimongo_common.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/minimongo_common.js                                                                            //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let LocalCollection_;
    module.link("./local_collection.js", {
      default(v) {
        LocalCollection_ = v;
      }
    }, 0);
    let Matcher;
    module.link("./matcher.js", {
      default(v) {
        Matcher = v;
      }
    }, 1);
    let Sorter;
    module.link("./sorter.js", {
      default(v) {
        Sorter = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    LocalCollection = LocalCollection_;
    Minimongo = {
      LocalCollection: LocalCollection_,
      Matcher,
      Sorter
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
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"observe_handle.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/observe_handle.js                                                                              //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
module.export({
  default: () => ObserveHandle
});
class ObserveHandle {}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"sorter.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/minimongo/sorter.js                                                                                      //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      default: () => Sorter
    });
    let ELEMENT_OPERATORS, equalityElementMatcher, expandArraysInBranches, hasOwn, isOperatorObject, makeLookupFunction, regexpElementMatcher;
    module.link("./common.js", {
      ELEMENT_OPERATORS(v) {
        ELEMENT_OPERATORS = v;
      },
      equalityElementMatcher(v) {
        equalityElementMatcher = v;
      },
      expandArraysInBranches(v) {
        expandArraysInBranches = v;
      },
      hasOwn(v) {
        hasOwn = v;
      },
      isOperatorObject(v) {
        isOperatorObject = v;
      },
      makeLookupFunction(v) {
        makeLookupFunction = v;
      },
      regexpElementMatcher(v) {
        regexpElementMatcher = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    class Sorter {
      constructor(spec) {
        this._sortSpecParts = [];
        this._sortFunction = null;
        const addSpecPart = (path, ascending) => {
          if (!path) {
            throw Error('sort keys must be non-empty');
          }
          if (path.charAt(0) === '$') {
            throw Error("unsupported sort key: ".concat(path));
          }
          this._sortSpecParts.push({
            ascending,
            lookup: makeLookupFunction(path, {
              forSort: true
            }),
            path
          });
        };
        if (spec instanceof Array) {
          spec.forEach(element => {
            if (typeof element === 'string') {
              addSpecPart(element, true);
            } else {
              addSpecPart(element[0], element[1] !== 'desc');
            }
          });
        } else if (typeof spec === 'object') {
          Object.keys(spec).forEach(key => {
            addSpecPart(key, spec[key] >= 0);
          });
        } else if (typeof spec === 'function') {
          this._sortFunction = spec;
        } else {
          throw Error("Bad sort specification: ".concat(JSON.stringify(spec)));
        }

        // If a function is specified for sorting, we skip the rest.
        if (this._sortFunction) {
          return;
        }

        // To implement affectedByModifier, we piggy-back on top of Matcher's
        // affectedByModifier code; we create a selector that is affected by the
        // same modifiers as this sort order. This is only implemented on the
        // server.
        if (this.affectedByModifier) {
          const selector = {};
          this._sortSpecParts.forEach(spec => {
            selector[spec.path] = 1;
          });
          this._selectorForAffectedByModifier = new Minimongo.Matcher(selector);
        }
        this._keyComparator = composeComparators(this._sortSpecParts.map((spec, i) => this._keyFieldComparator(i)));
      }
      getComparator(options) {
        // If sort is specified or have no distances, just use the comparator from
        // the source specification (which defaults to "everything is equal".
        // issue #3599
        // https://docs.mongodb.com/manual/reference/operator/query/near/#sort-operation
        // sort effectively overrides $near
        if (this._sortSpecParts.length || !options || !options.distances) {
          return this._getBaseComparator();
        }
        const distances = options.distances;

        // Return a comparator which compares using $near distances.
        return (a, b) => {
          if (!distances.has(a._id)) {
            throw Error("Missing distance for ".concat(a._id));
          }
          if (!distances.has(b._id)) {
            throw Error("Missing distance for ".concat(b._id));
          }
          return distances.get(a._id) - distances.get(b._id);
        };
      }

      // Takes in two keys: arrays whose lengths match the number of spec
      // parts. Returns negative, 0, or positive based on using the sort spec to
      // compare fields.
      _compareKeys(key1, key2) {
        if (key1.length !== this._sortSpecParts.length || key2.length !== this._sortSpecParts.length) {
          throw Error('Key has wrong length');
        }
        return this._keyComparator(key1, key2);
      }

      // Iterates over each possible "key" from doc (ie, over each branch), calling
      // 'cb' with the key.
      _generateKeysFromDoc(doc, cb) {
        if (this._sortSpecParts.length === 0) {
          throw new Error('can\'t generate keys without a spec');
        }
        const pathFromIndices = indices => "".concat(indices.join(','), ",");
        let knownPaths = null;

        // maps index -> ({'' -> value} or {path -> value})
        const valuesByIndexAndPath = this._sortSpecParts.map(spec => {
          // Expand any leaf arrays that we find, and ignore those arrays
          // themselves.  (We never sort based on an array itself.)
          let branches = expandArraysInBranches(spec.lookup(doc), true);

          // If there are no values for a key (eg, key goes to an empty array),
          // pretend we found one undefined value.
          if (!branches.length) {
            branches = [{
              value: void 0
            }];
          }
          const element = Object.create(null);
          let usedPaths = false;
          branches.forEach(branch => {
            if (!branch.arrayIndices) {
              // If there are no array indices for a branch, then it must be the
              // only branch, because the only thing that produces multiple branches
              // is the use of arrays.
              if (branches.length > 1) {
                throw Error('multiple branches but no array used?');
              }
              element[''] = branch.value;
              return;
            }
            usedPaths = true;
            const path = pathFromIndices(branch.arrayIndices);
            if (hasOwn.call(element, path)) {
              throw Error("duplicate path: ".concat(path));
            }
            element[path] = branch.value;

            // If two sort fields both go into arrays, they have to go into the
            // exact same arrays and we have to find the same paths.  This is
            // roughly the same condition that makes MongoDB throw this strange
            // error message.  eg, the main thing is that if sort spec is {a: 1,
            // b:1} then a and b cannot both be arrays.
            //
            // (In MongoDB it seems to be OK to have {a: 1, 'a.x.y': 1} where 'a'
            // and 'a.x.y' are both arrays, but we don't allow this for now.
            // #NestedArraySort
            // XXX achieve full compatibility here
            if (knownPaths && !hasOwn.call(knownPaths, path)) {
              throw Error('cannot index parallel arrays');
            }
          });
          if (knownPaths) {
            // Similarly to above, paths must match everywhere, unless this is a
            // non-array field.
            if (!hasOwn.call(element, '') && Object.keys(knownPaths).length !== Object.keys(element).length) {
              throw Error('cannot index parallel arrays!');
            }
          } else if (usedPaths) {
            knownPaths = {};
            Object.keys(element).forEach(path => {
              knownPaths[path] = true;
            });
          }
          return element;
        });
        if (!knownPaths) {
          // Easy case: no use of arrays.
          const soleKey = valuesByIndexAndPath.map(values => {
            if (!hasOwn.call(values, '')) {
              throw Error('no value in sole key case?');
            }
            return values[''];
          });
          cb(soleKey);
          return;
        }
        Object.keys(knownPaths).forEach(path => {
          const key = valuesByIndexAndPath.map(values => {
            if (hasOwn.call(values, '')) {
              return values[''];
            }
            if (!hasOwn.call(values, path)) {
              throw Error('missing path?');
            }
            return values[path];
          });
          cb(key);
        });
      }

      // Returns a comparator that represents the sort specification (but not
      // including a possible geoquery distance tie-breaker).
      _getBaseComparator() {
        if (this._sortFunction) {
          return this._sortFunction;
        }

        // If we're only sorting on geoquery distance and no specs, just say
        // everything is equal.
        if (!this._sortSpecParts.length) {
          return (doc1, doc2) => 0;
        }
        return (doc1, doc2) => {
          const key1 = this._getMinKeyFromDoc(doc1);
          const key2 = this._getMinKeyFromDoc(doc2);
          return this._compareKeys(key1, key2);
        };
      }

      // Finds the minimum key from the doc, according to the sort specs.  (We say
      // "minimum" here but this is with respect to the sort spec, so "descending"
      // sort fields mean we're finding the max for that field.)
      //
      // Note that this is NOT "find the minimum value of the first field, the
      // minimum value of the second field, etc"... it's "choose the
      // lexicographically minimum value of the key vector, allowing only keys which
      // you can find along the same paths".  ie, for a doc {a: [{x: 0, y: 5}, {x:
      // 1, y: 3}]} with sort spec {'a.x': 1, 'a.y': 1}, the only keys are [0,5] and
      // [1,3], and the minimum key is [0,5]; notably, [0,3] is NOT a key.
      _getMinKeyFromDoc(doc) {
        let minKey = null;
        this._generateKeysFromDoc(doc, key => {
          if (minKey === null) {
            minKey = key;
            return;
          }
          if (this._compareKeys(key, minKey) < 0) {
            minKey = key;
          }
        });
        return minKey;
      }
      _getPaths() {
        return this._sortSpecParts.map(part => part.path);
      }

      // Given an index 'i', returns a comparator that compares two key arrays based
      // on field 'i'.
      _keyFieldComparator(i) {
        const invert = !this._sortSpecParts[i].ascending;
        return (key1, key2) => {
          const compare = LocalCollection._f._cmp(key1[i], key2[i]);
          return invert ? -compare : compare;
        };
      }
    }
    // Given an array of comparators
    // (functions (a,b)->(negative or positive or zero)), returns a single
    // comparator which uses each comparator in order and returns the first
    // non-zero value.
    function composeComparators(comparatorArray) {
      return (a, b) => {
        for (let i = 0; i < comparatorArray.length; ++i) {
          const compare = comparatorArray[i](a, b);
          if (compare !== 0) {
            return compare;
          }
        }
        return 0;
      };
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

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      LocalCollection: LocalCollection,
      Minimongo: Minimongo,
      MinimongoTest: MinimongoTest,
      MinimongoError: MinimongoError
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/minimongo/minimongo_server.js"
  ],
  mainModulePath: "/node_modules/meteor/minimongo/minimongo_server.js"
}});

//# sourceURL=meteor://💻app/packages/minimongo.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL21pbmltb25nb19zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jb25zdGFudHMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9jdXJzb3IuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9sb2NhbF9jb2xsZWN0aW9uLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9taW5pbW9uZ28vbWF0Y2hlci5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL21pbmltb25nb19jb21tb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21pbmltb25nby9vYnNlcnZlX2hhbmRsZS5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbWluaW1vbmdvL3NvcnRlci5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJsaW5rIiwiaGFzT3duIiwiaXNOdW1lcmljS2V5IiwiaXNPcGVyYXRvck9iamVjdCIsInBhdGhzVG9UcmVlIiwicHJvamVjdGlvbkRldGFpbHMiLCJ2IiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJNaW5pbW9uZ28iLCJfcGF0aHNFbGlkaW5nTnVtZXJpY0tleXMiLCJwYXRocyIsIm1hcCIsInBhdGgiLCJzcGxpdCIsImZpbHRlciIsInBhcnQiLCJqb2luIiwiTWF0Y2hlciIsInByb3RvdHlwZSIsImFmZmVjdGVkQnlNb2RpZmllciIsIm1vZGlmaWVyIiwiT2JqZWN0IiwiYXNzaWduIiwiJHNldCIsIiR1bnNldCIsIm1lYW5pbmdmdWxQYXRocyIsIl9nZXRQYXRocyIsIm1vZGlmaWVkUGF0aHMiLCJjb25jYXQiLCJrZXlzIiwic29tZSIsIm1vZCIsIm1lYW5pbmdmdWxQYXRoIiwic2VsIiwiaSIsImoiLCJsZW5ndGgiLCJjYW5CZWNvbWVUcnVlQnlNb2RpZmllciIsImlzU2ltcGxlIiwibW9kaWZpZXJQYXRocyIsInBhdGhIYXNOdW1lcmljS2V5cyIsImV4cGVjdGVkU2NhbGFySXNPYmplY3QiLCJfc2VsZWN0b3IiLCJtb2RpZmllclBhdGgiLCJzdGFydHNXaXRoIiwibWF0Y2hpbmdEb2N1bWVudCIsIkVKU09OIiwiY2xvbmUiLCJMb2NhbENvbGxlY3Rpb24iLCJfbW9kaWZ5IiwiZXJyb3IiLCJuYW1lIiwic2V0UHJvcGVydHlFcnJvciIsImRvY3VtZW50TWF0Y2hlcyIsInJlc3VsdCIsImNvbWJpbmVJbnRvUHJvamVjdGlvbiIsInByb2plY3Rpb24iLCJzZWxlY3RvclBhdGhzIiwiaW5jbHVkZXMiLCJjb21iaW5lSW1wb3J0YW50UGF0aHNJbnRvUHJvamVjdGlvbiIsIl9tYXRjaGluZ0RvY3VtZW50IiwidW5kZWZpbmVkIiwiZmFsbGJhY2siLCJ2YWx1ZVNlbGVjdG9yIiwiJGVxIiwiJGluIiwibWF0Y2hlciIsInBsYWNlaG9sZGVyIiwiZmluZCIsIm9ubHlDb250YWluc0tleXMiLCJsb3dlckJvdW5kIiwiSW5maW5pdHkiLCJ1cHBlckJvdW5kIiwiZm9yRWFjaCIsIm9wIiwiY2FsbCIsIm1pZGRsZSIsIngiLCJTb3J0ZXIiLCJfc2VsZWN0b3JGb3JBZmZlY3RlZEJ5TW9kaWZpZXIiLCJkZXRhaWxzIiwidHJlZSIsIm5vZGUiLCJmdWxsUGF0aCIsIm1lcmdlZFByb2plY3Rpb24iLCJ0cmVlVG9QYXRocyIsImluY2x1ZGluZyIsIm1lcmdlZEV4Y2xQcm9qZWN0aW9uIiwiZ2V0UGF0aHMiLCJzZWxlY3RvciIsIl9wYXRocyIsIm9iaiIsImV2ZXJ5IiwiayIsInByZWZpeCIsImFyZ3VtZW50cyIsImtleSIsInZhbHVlIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwiZXhwb3J0IiwiRUxFTUVOVF9PUEVSQVRPUlMiLCJjb21waWxlRG9jdW1lbnRTZWxlY3RvciIsImVxdWFsaXR5RWxlbWVudE1hdGNoZXIiLCJleHBhbmRBcnJheXNJbkJyYW5jaGVzIiwiaXNJbmRleGFibGUiLCJtYWtlTG9va3VwRnVuY3Rpb24iLCJub3RoaW5nTWF0Y2hlciIsInBvcHVsYXRlRG9jdW1lbnRXaXRoUXVlcnlGaWVsZHMiLCJyZWdleHBFbGVtZW50TWF0Y2hlciIsImRlZmF1bHQiLCJoYXNPd25Qcm9wZXJ0eSIsIiRsdCIsIm1ha2VJbmVxdWFsaXR5IiwiY21wVmFsdWUiLCIkZ3QiLCIkbHRlIiwiJGd0ZSIsIiRtb2QiLCJjb21waWxlRWxlbWVudFNlbGVjdG9yIiwib3BlcmFuZCIsIkFycmF5IiwiaXNBcnJheSIsIkVycm9yIiwiZGl2aXNvciIsInJlbWFpbmRlciIsImVsZW1lbnRNYXRjaGVycyIsIm9wdGlvbiIsIlJlZ0V4cCIsIiRzaXplIiwiZG9udEV4cGFuZExlYWZBcnJheXMiLCIkdHlwZSIsImRvbnRJbmNsdWRlTGVhZkFycmF5cyIsIm9wZXJhbmRBbGlhc01hcCIsIl9mIiwiX3R5cGUiLCIkYml0c0FsbFNldCIsIm1hc2siLCJnZXRPcGVyYW5kQml0bWFzayIsImJpdG1hc2siLCJnZXRWYWx1ZUJpdG1hc2siLCJieXRlIiwiJGJpdHNBbnlTZXQiLCIkYml0c0FsbENsZWFyIiwiJGJpdHNBbnlDbGVhciIsIiRyZWdleCIsInJlZ2V4cCIsIiRvcHRpb25zIiwidGVzdCIsInNvdXJjZSIsIiRlbGVtTWF0Y2giLCJfaXNQbGFpbk9iamVjdCIsImlzRG9jTWF0Y2hlciIsIkxPR0lDQUxfT1BFUkFUT1JTIiwicmVkdWNlIiwiYSIsImIiLCJzdWJNYXRjaGVyIiwiaW5FbGVtTWF0Y2giLCJjb21waWxlVmFsdWVTZWxlY3RvciIsImFycmF5RWxlbWVudCIsImFyZyIsImRvbnRJdGVyYXRlIiwiJGFuZCIsInN1YlNlbGVjdG9yIiwiYW5kRG9jdW1lbnRNYXRjaGVycyIsImNvbXBpbGVBcnJheU9mRG9jdW1lbnRTZWxlY3RvcnMiLCIkb3IiLCJtYXRjaGVycyIsImRvYyIsImZuIiwiJG5vciIsIiR3aGVyZSIsInNlbGVjdG9yVmFsdWUiLCJfcmVjb3JkUGF0aFVzZWQiLCJfaGFzV2hlcmUiLCJGdW5jdGlvbiIsIiRjb21tZW50IiwiVkFMVUVfT1BFUkFUT1JTIiwiY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIiLCIkbm90IiwiaW52ZXJ0QnJhbmNoZWRNYXRjaGVyIiwiJG5lIiwiJG5pbiIsIiRleGlzdHMiLCJleGlzdHMiLCJldmVyeXRoaW5nTWF0Y2hlciIsIiRtYXhEaXN0YW5jZSIsIiRuZWFyIiwiJGFsbCIsImJyYW5jaGVkTWF0Y2hlcnMiLCJjcml0ZXJpb24iLCJhbmRCcmFuY2hlZE1hdGNoZXJzIiwiaXNSb290IiwiX2hhc0dlb1F1ZXJ5IiwibWF4RGlzdGFuY2UiLCJwb2ludCIsImRpc3RhbmNlIiwiJGdlb21ldHJ5IiwidHlwZSIsIkdlb0pTT04iLCJwb2ludERpc3RhbmNlIiwiY29vcmRpbmF0ZXMiLCJwb2ludFRvQXJyYXkiLCJnZW9tZXRyeVdpdGhpblJhZGl1cyIsImRpc3RhbmNlQ29vcmRpbmF0ZVBhaXJzIiwiYnJhbmNoZWRWYWx1ZXMiLCJicmFuY2giLCJjdXJEaXN0YW5jZSIsIl9pc1VwZGF0ZSIsImFycmF5SW5kaWNlcyIsImFuZFNvbWVNYXRjaGVycyIsInN1Yk1hdGNoZXJzIiwiZG9jT3JCcmFuY2hlcyIsIm1hdGNoIiwic3ViUmVzdWx0Iiwic2VsZWN0b3JzIiwiZG9jU2VsZWN0b3IiLCJvcHRpb25zIiwiZG9jTWF0Y2hlcnMiLCJzdWJzdHIiLCJfaXNTaW1wbGUiLCJsb29rVXBCeUluZGV4IiwidmFsdWVNYXRjaGVyIiwiQm9vbGVhbiIsIm9wZXJhdG9yQnJhbmNoZWRNYXRjaGVyIiwiZWxlbWVudE1hdGNoZXIiLCJicmFuY2hlcyIsImV4cGFuZGVkIiwiZWxlbWVudCIsIm1hdGNoZWQiLCJwb2ludEEiLCJwb2ludEIiLCJNYXRoIiwiaHlwb3QiLCJlbGVtZW50U2VsZWN0b3IiLCJfZXF1YWwiLCJkb2NPckJyYW5jaGVkVmFsdWVzIiwic2tpcFRoZUFycmF5cyIsImJyYW5jaGVzT3V0IiwidGhpc0lzQXJyYXkiLCJwdXNoIiwiTnVtYmVyIiwiaXNJbnRlZ2VyIiwiVWludDhBcnJheSIsIkludDMyQXJyYXkiLCJidWZmZXIiLCJpc0JpbmFyeSIsIkFycmF5QnVmZmVyIiwibWF4IiwidmlldyIsImlzU2FmZUludGVnZXIiLCJVaW50MzJBcnJheSIsIkJZVEVTX1BFUl9FTEVNRU5UIiwiaW5zZXJ0SW50b0RvY3VtZW50IiwiZG9jdW1lbnQiLCJleGlzdGluZ0tleSIsImluZGV4T2YiLCJicmFuY2hlZE1hdGNoZXIiLCJicmFuY2hWYWx1ZXMiLCJzIiwiaW5jb25zaXN0ZW50T0siLCJ0aGVzZUFyZU9wZXJhdG9ycyIsInNlbEtleSIsInRoaXNJc09wZXJhdG9yIiwiSlNPTiIsInN0cmluZ2lmeSIsImNtcFZhbHVlQ29tcGFyYXRvciIsIm9wZXJhbmRUeXBlIiwiX2NtcCIsInBhcnRzIiwiZmlyc3RQYXJ0IiwibG9va3VwUmVzdCIsInNsaWNlIiwiYnVpbGRSZXN1bHQiLCJmaXJzdExldmVsIiwiYXBwZW5kVG9SZXN1bHQiLCJtb3JlIiwiZm9yU29ydCIsImFycmF5SW5kZXgiLCJNaW5pbW9uZ29UZXN0IiwiTWluaW1vbmdvRXJyb3IiLCJtZXNzYWdlIiwiZmllbGQiLCJvcGVyYXRvck1hdGNoZXJzIiwib3BlcmF0b3IiLCJzaW1wbGVSYW5nZSIsInNpbXBsZUVxdWFsaXR5Iiwic2ltcGxlSW5jbHVzaW9uIiwibmV3TGVhZkZuIiwiY29uZmxpY3RGbiIsInJvb3QiLCJwYXRoQXJyYXkiLCJzdWNjZXNzIiwibGFzdEtleSIsInkiLCJwb3B1bGF0ZURvY3VtZW50V2l0aEtleVZhbHVlIiwiZ2V0UHJvdG90eXBlT2YiLCJwb3B1bGF0ZURvY3VtZW50V2l0aE9iamVjdCIsInVucHJlZml4ZWRLZXlzIiwidmFsaWRhdGVPYmplY3QiLCJvYmplY3QiLCJxdWVyeSIsIl9zZWxlY3RvcklzSWQiLCJmaWVsZHMiLCJmaWVsZHNLZXlzIiwic29ydCIsIl9pZCIsImtleVBhdGgiLCJydWxlIiwicHJvamVjdGlvblJ1bGVzVHJlZSIsImN1cnJlbnRQYXRoIiwiYW5vdGhlclBhdGgiLCJ0b1N0cmluZyIsImxhc3RJbmRleCIsInZhbGlkYXRlS2V5SW5QYXRoIiwiZ2V0QXN5bmNNZXRob2ROYW1lIiwiQVNZTkNfQ09MTEVDVElPTl9NRVRIT0RTIiwiQVNZTkNfQ1VSU09SX01FVEhPRFMiLCJDTElFTlRfT05MWV9NRVRIT0RTIiwibWV0aG9kIiwicmVwbGFjZSIsIkN1cnNvciIsImNvbnN0cnVjdG9yIiwiY29sbGVjdGlvbiIsInNvcnRlciIsIl9zZWxlY3RvcklzSWRQZXJoYXBzQXNPYmplY3QiLCJfc2VsZWN0b3JJZCIsImhhc0dlb1F1ZXJ5Iiwic2tpcCIsImxpbWl0IiwiX3Byb2plY3Rpb25GbiIsIl9jb21waWxlUHJvamVjdGlvbiIsIl90cmFuc2Zvcm0iLCJ3cmFwVHJhbnNmb3JtIiwidHJhbnNmb3JtIiwiVHJhY2tlciIsInJlYWN0aXZlIiwiY291bnQiLCJfZGVwZW5kIiwiYWRkZWQiLCJyZW1vdmVkIiwiX2dldFJhd09iamVjdHMiLCJvcmRlcmVkIiwiZmV0Y2giLCJTeW1ib2wiLCJpdGVyYXRvciIsImFkZGVkQmVmb3JlIiwiY2hhbmdlZCIsIm1vdmVkQmVmb3JlIiwiaW5kZXgiLCJvYmplY3RzIiwibmV4dCIsImRvbmUiLCJhc3luY0l0ZXJhdG9yIiwic3luY1Jlc3VsdCIsIlByb21pc2UiLCJyZXNvbHZlIiwiY2FsbGJhY2siLCJ0aGlzQXJnIiwiZ2V0VHJhbnNmb3JtIiwib2JzZXJ2ZSIsIl9vYnNlcnZlRnJvbU9ic2VydmVDaGFuZ2VzIiwib2JzZXJ2ZUNoYW5nZXMiLCJfb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3NBcmVPcmRlcmVkIiwiX2FsbG93X3Vub3JkZXJlZCIsImRpc3RhbmNlcyIsIl9JZE1hcCIsImN1cnNvciIsImRpcnR5IiwicHJvamVjdGlvbkZuIiwicmVzdWx0c1NuYXBzaG90IiwicWlkIiwibmV4dF9xaWQiLCJxdWVyaWVzIiwicmVzdWx0cyIsInBhdXNlZCIsIndyYXBDYWxsYmFjayIsImFyZ3MiLCJfb2JzZXJ2ZVF1ZXVlIiwicXVldWVUYXNrIiwiYXBwbHkiLCJfc3VwcHJlc3NfaW5pdGlhbCIsIl9xdWVyeSRyZXN1bHRzIiwiX3F1ZXJ5JHJlc3VsdHMkc2l6ZSIsImhhbmRsZXIiLCJzaXplIiwiaGFuZGxlIiwiT2JzZXJ2ZUhhbmRsZSIsInN0b3AiLCJpc1JlYWR5IiwiaXNSZWFkeVByb21pc2UiLCJhY3RpdmUiLCJvbkludmFsaWRhdGUiLCJkcmFpblJlc3VsdCIsImRyYWluIiwidGhlbiIsImNoYW5nZXJzIiwiZGVwZW5kZW5jeSIsIkRlcGVuZGVuY3kiLCJub3RpZnkiLCJiaW5kIiwiZGVwZW5kIiwiX2dldENvbGxlY3Rpb25OYW1lIiwiYXBwbHlTa2lwTGltaXQiLCJzZWxlY3RlZERvYyIsIl9kb2NzIiwiZ2V0Iiwic2V0IiwiY2xlYXIiLCJpZCIsIm1hdGNoUmVzdWx0IiwiZ2V0Q29tcGFyYXRvciIsIl9wdWJsaXNoQ3Vyc29yIiwic3Vic2NyaXB0aW9uIiwiUGFja2FnZSIsIm1vbmdvIiwiTW9uZ28iLCJDb2xsZWN0aW9uIiwiYXN5bmNOYW1lIiwiX2xlbiIsIl9rZXkiLCJyZWplY3QiLCJfb2JqZWN0U3ByZWFkIiwiTWV0ZW9yIiwiaXNDbGllbnQiLCJfU3luY2hyb25vdXNRdWV1ZSIsIl9Bc3luY2hyb25vdXNRdWV1ZSIsImNyZWF0ZSIsIl9zYXZlZE9yaWdpbmFscyIsImNvdW50RG9jdW1lbnRzIiwiY291bnRBc3luYyIsImVzdGltYXRlZERvY3VtZW50Q291bnQiLCJmaW5kT25lIiwiZmluZE9uZUFzeW5jIiwiZmV0Y2hBc3luYyIsInByZXBhcmVJbnNlcnQiLCJhc3NlcnRIYXNWYWxpZEZpZWxkTmFtZXMiLCJfdXNlT0lEIiwiTW9uZ29JRCIsIk9iamVjdElEIiwiUmFuZG9tIiwiaGFzIiwiX3NhdmVPcmlnaW5hbCIsImluc2VydCIsInF1ZXJpZXNUb1JlY29tcHV0ZSIsIl9pbnNlcnRJblJlc3VsdHNTeW5jIiwiX3JlY29tcHV0ZVJlc3VsdHMiLCJkZWZlciIsImluc2VydEFzeW5jIiwiX2luc2VydEluUmVzdWx0c0FzeW5jIiwicGF1c2VPYnNlcnZlcnMiLCJjbGVhclJlc3VsdFF1ZXJpZXMiLCJwcmVwYXJlUmVtb3ZlIiwicmVtb3ZlIiwiX2VhY2hQb3NzaWJseU1hdGNoaW5nRG9jU3luYyIsInF1ZXJ5UmVtb3ZlIiwicmVtb3ZlSWQiLCJyZW1vdmVEb2MiLCJlcXVhbHMiLCJfcmVtb3ZlRnJvbVJlc3VsdHNTeW5jIiwicmVtb3ZlQXN5bmMiLCJfcmVtb3ZlRnJvbVJlc3VsdHNBc3luYyIsIl9yZXN1bWVPYnNlcnZlcnMiLCJfZGlmZlF1ZXJ5Q2hhbmdlcyIsInJlc3VtZU9ic2VydmVyc1NlcnZlciIsInJlc3VtZU9ic2VydmVyc0NsaWVudCIsInJldHJpZXZlT3JpZ2luYWxzIiwib3JpZ2luYWxzIiwic2F2ZU9yaWdpbmFscyIsInByZXBhcmVVcGRhdGUiLCJxaWRUb09yaWdpbmFsUmVzdWx0cyIsImRvY01hcCIsImlkc01hdGNoZWQiLCJfaWRzTWF0Y2hlZEJ5U2VsZWN0b3IiLCJtZW1vaXplZENsb25lSWZOZWVkZWQiLCJkb2NUb01lbW9pemUiLCJmaW5pc2hVcGRhdGUiLCJfcmVmIiwidXBkYXRlQ291bnQiLCJpbnNlcnRlZElkIiwiX3JldHVybk9iamVjdCIsIm51bWJlckFmZmVjdGVkIiwidXBkYXRlQXN5bmMiLCJyZWNvbXB1dGVRaWRzIiwiX2VhY2hQb3NzaWJseU1hdGNoaW5nRG9jQXN5bmMiLCJxdWVyeVJlc3VsdCIsIl9tb2RpZnlBbmROb3RpZnlBc3luYyIsIm11bHRpIiwidXBzZXJ0IiwiX2NyZWF0ZVVwc2VydERvY3VtZW50IiwidXBkYXRlIiwiX21vZGlmeUFuZE5vdGlmeVN5bmMiLCJ1cHNlcnRBc3luYyIsInNwZWNpZmljSWRzIiwiZm9yRWFjaEFzeW5jIiwiX2dldE1hdGNoZWREb2NBbmRNb2RpZnkiLCJtYXRjaGVkX2JlZm9yZSIsIm9sZF9kb2MiLCJhZnRlck1hdGNoIiwiYWZ0ZXIiLCJiZWZvcmUiLCJfdXBkYXRlSW5SZXN1bHRzU3luYyIsIl91cGRhdGVJblJlc3VsdHNBc3luYyIsIm9sZFJlc3VsdHMiLCJfQ2FjaGluZ0NoYW5nZU9ic2VydmVyIiwib3JkZXJlZEZyb21DYWxsYmFja3MiLCJjYWxsYmFja3MiLCJkb2NzIiwiT3JkZXJlZERpY3QiLCJpZFN0cmluZ2lmeSIsImFwcGx5Q2hhbmdlIiwicHV0QmVmb3JlIiwibW92ZUJlZm9yZSIsIkRpZmZTZXF1ZW5jZSIsImFwcGx5Q2hhbmdlcyIsIklkTWFwIiwiaWRQYXJzZSIsIl9fd3JhcHBlZFRyYW5zZm9ybV9fIiwid3JhcHBlZCIsInRyYW5zZm9ybWVkIiwibm9ucmVhY3RpdmUiLCJfYmluYXJ5U2VhcmNoIiwiY21wIiwiYXJyYXkiLCJmaXJzdCIsInJhbmdlIiwiaGFsZlJhbmdlIiwiZmxvb3IiLCJfY2hlY2tTdXBwb3J0ZWRQcm9qZWN0aW9uIiwiX2lkUHJvamVjdGlvbiIsInJ1bGVUcmVlIiwic3ViZG9jIiwic2VsZWN0b3JEb2N1bWVudCIsImlzTW9kaWZ5IiwiX2lzTW9kaWZpY2F0aW9uTW9kIiwibmV3RG9jIiwiaXNJbnNlcnQiLCJyZXBsYWNlbWVudCIsIl9kaWZmT2JqZWN0cyIsImxlZnQiLCJyaWdodCIsImRpZmZPYmplY3RzIiwibmV3UmVzdWx0cyIsIm9ic2VydmVyIiwiZGlmZlF1ZXJ5Q2hhbmdlcyIsIl9kaWZmUXVlcnlPcmRlcmVkQ2hhbmdlcyIsImRpZmZRdWVyeU9yZGVyZWRDaGFuZ2VzIiwiX2RpZmZRdWVyeVVub3JkZXJlZENoYW5nZXMiLCJkaWZmUXVlcnlVbm9yZGVyZWRDaGFuZ2VzIiwiX2ZpbmRJbk9yZGVyZWRSZXN1bHRzIiwic3ViSWRzIiwiX2luc2VydEluU29ydGVkTGlzdCIsInNwbGljZSIsImlzUmVwbGFjZSIsImlzTW9kaWZpZXIiLCJzZXRPbkluc2VydCIsIm1vZEZ1bmMiLCJNT0RJRklFUlMiLCJrZXlwYXRoIiwia2V5cGFydHMiLCJ0YXJnZXQiLCJmaW5kTW9kVGFyZ2V0IiwiZm9yYmlkQXJyYXkiLCJub0NyZWF0ZSIsIk5PX0NSRUFURV9NT0RJRklFUlMiLCJwb3AiLCJvYnNlcnZlQ2FsbGJhY2tzIiwic3VwcHJlc3NlZCIsIm9ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzIiwiX29ic2VydmVDYWxsYmFja3NBcmVPcmRlcmVkIiwiaW5kaWNlcyIsIl9ub19pbmRpY2VzIiwiY2hlY2siLCJhZGRlZEF0IiwiY2hhbmdlZEF0Iiwib2xkRG9jIiwibW92ZWRUbyIsImZyb20iLCJ0byIsInJlbW92ZWRBdCIsImNoYW5nZU9ic2VydmVyIiwiX2Zyb21PYnNlcnZlIiwibm9uTXV0YXRpbmdDYWxsYmFja3MiLCJzZXRTdXBwcmVzc2VkIiwiaCIsIl9oJGlzUmVhZHlQcm9taXNlIiwiX2lzUHJvbWlzZSIsImNoYW5nZWRGaWVsZHMiLCJtYWtlQ2hhbmdlZEZpZWxkcyIsIm9sZF9pZHgiLCJuZXdfaWR4IiwiJGN1cnJlbnREYXRlIiwiRGF0ZSIsIiRpbmMiLCIkbWluIiwiJG1heCIsIiRtdWwiLCIkcmVuYW1lIiwidGFyZ2V0MiIsIiRzZXRPbkluc2VydCIsIiRwdXNoIiwiJGVhY2giLCJ0b1B1c2giLCJwb3NpdGlvbiIsIiRwb3NpdGlvbiIsIiRzbGljZSIsInNvcnRGdW5jdGlvbiIsIiRzb3J0Iiwic3BsaWNlQXJndW1lbnRzIiwiJHB1c2hBbGwiLCIkYWRkVG9TZXQiLCJpc0VhY2giLCJ2YWx1ZXMiLCJ0b0FkZCIsIiRwb3AiLCJ0b1BvcCIsIiRwdWxsIiwidG9QdWxsIiwib3V0IiwiJHB1bGxBbGwiLCIkYml0IiwiJHYiLCJpbnZhbGlkQ2hhck1zZyIsIiQiLCJhc3NlcnRJc1ZhbGlkRmllbGROYW1lIiwidXNlZEFycmF5SW5kZXgiLCJsYXN0Iiwia2V5cGFydCIsInBhcnNlSW50IiwiRGVjaW1hbCIsIl9QYWNrYWdlJG1vbmdvRGVjaW1hIiwiRGVjaW1hbFN0dWIiLCJpc1VwZGF0ZSIsIl9kb2NNYXRjaGVyIiwiX2NvbXBpbGVTZWxlY3RvciIsImhhc1doZXJlIiwia2V5T3JkZXJTZW5zaXRpdmUiLCJfdHlwZW9yZGVyIiwidCIsInRhIiwidGIiLCJvYSIsIm9iIiwidG9IZXhTdHJpbmciLCJpc05hTiIsImdldFRpbWUiLCJtaW51cyIsInRvTnVtYmVyIiwidG9BcnJheSIsIkxvY2FsQ29sbGVjdGlvbl8iLCJzcGVjIiwiX3NvcnRTcGVjUGFydHMiLCJfc29ydEZ1bmN0aW9uIiwiYWRkU3BlY1BhcnQiLCJhc2NlbmRpbmciLCJjaGFyQXQiLCJsb29rdXAiLCJfa2V5Q29tcGFyYXRvciIsImNvbXBvc2VDb21wYXJhdG9ycyIsIl9rZXlGaWVsZENvbXBhcmF0b3IiLCJfZ2V0QmFzZUNvbXBhcmF0b3IiLCJfY29tcGFyZUtleXMiLCJrZXkxIiwia2V5MiIsIl9nZW5lcmF0ZUtleXNGcm9tRG9jIiwiY2IiLCJwYXRoRnJvbUluZGljZXMiLCJrbm93blBhdGhzIiwidmFsdWVzQnlJbmRleEFuZFBhdGgiLCJ1c2VkUGF0aHMiLCJzb2xlS2V5IiwiZG9jMSIsImRvYzIiLCJfZ2V0TWluS2V5RnJvbURvYyIsIm1pbktleSIsImludmVydCIsImNvbXBhcmUiLCJjb21wYXJhdG9yQXJyYXkiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBQSxNQUFNLENBQUNDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQztJQUFDLElBQUlDLE1BQU0sRUFBQ0MsWUFBWSxFQUFDQyxnQkFBZ0IsRUFBQ0MsV0FBVyxFQUFDQyxpQkFBaUI7SUFBQ04sTUFBTSxDQUFDQyxJQUFJLENBQUMsYUFBYSxFQUFDO01BQUNDLE1BQU1BLENBQUNLLENBQUMsRUFBQztRQUFDTCxNQUFNLEdBQUNLLENBQUM7TUFBQSxDQUFDO01BQUNKLFlBQVlBLENBQUNJLENBQUMsRUFBQztRQUFDSixZQUFZLEdBQUNJLENBQUM7TUFBQSxDQUFDO01BQUNILGdCQUFnQkEsQ0FBQ0csQ0FBQyxFQUFDO1FBQUNILGdCQUFnQixHQUFDRyxDQUFDO01BQUEsQ0FBQztNQUFDRixX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QUMsQ0FBQyxDQUFDO1VBQ3pELE9BQU9vb0IsTUFBTSxHQUFHLENBQUNDLE9BQU8sR0FBR0EsT0FBTztRQUNwQyxDQUFDO01BQ0g7SUFDRjtJQUVBO0lBQ0E7SUFDQTtJQUNBO0lBQ0EsU0FBU2xCLGtCQUFrQkEsQ0FBQ21CLGVBQWUsRUFBRTtNQUMzQyxPQUFPLENBQUMzZ0IsQ0FBQyxFQUFFQyxDQUFDLEtBQUs7UUFDZixLQUFLLElBQUk1SCxDQUFDLEdBQUcsQ0FBQyxFQUFFQSxDQUFDLEdBQUdzb0IsZUFBZSxDQUFDcG9CLE1BQU0sRUFBRSxFQUFFRixDQUFDLEVBQUU7VUFDL0MsTUFBTXFvQixPQUFPLEdBQUdDLGVBQWUsQ0FBQ3RvQixDQUFDLENBQUMsQ0FBQzJILENBQUMsRUFBRUMsQ0FBQyxDQUFDO1VBQ3hDLElBQUl5Z0IsT0FBTyxLQUFLLENBQUMsRUFBRTtZQUNqQixPQUFPQSxPQUFPO1VBQ2hCO1FBQ0Y7UUFFQSxPQUFPLENBQUM7TUFDVixDQUFDO0lBQ0g7SUFBQ3JrQixzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBRSxJQUFBO0VBQUFDLEtBQUE7QUFBQSxHIiwiZmlsZSI6Ii9wYWNrYWdlcy9taW5pbW9uZ28uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgJy4vbWluaW1vbmdvX2NvbW1vbi5qcyc7XG5pbXBvcnQge1xuICBoYXNPd24sXG4gIGlzTnVtZXJpY0tleSxcbiAgaXNPcGVyYXRvck9iamVjdCxcbiAgcGF0aHNUb1RyZWUsXG4gIHByb2plY3Rpb25EZXRhaWxzLFxufSBmcm9tICcuL2NvbW1vbi5qcyc7XG5cbk1pbmltb25nby5fcGF0aHNFbGlkaW5nTnVtZXJpY0tleXMgPSBwYXRocyA9PiBwYXRocy5tYXAocGF0aCA9PlxuICBwYXRoLnNwbGl0KCcuJykuZmlsdGVyKHBhcnQgPT4gIWlzTnVtZXJpY0tleShwYXJ0KSkuam9pbignLicpXG4pO1xuXG4vLyBSZXR1cm5zIHRydWUgaWYgdGhlIG1vZGlmaWVyIGFwcGxpZWQgdG8gc29tZSBkb2N1bWVudCBtYXkgY2hhbmdlIHRoZSByZXN1bHRcbi8vIG9mIG1hdGNoaW5nIHRoZSBkb2N1bWVudCBieSBzZWxlY3RvclxuLy8gVGhlIG1vZGlmaWVyIGlzIGFsd2F5cyBpbiBhIGZvcm0gb2YgT2JqZWN0OlxuLy8gIC0gJHNldFxuLy8gICAgLSAnYS5iLjIyLnonOiB2YWx1ZVxuLy8gICAgLSAnZm9vLmJhcic6IDQyXG4vLyAgLSAkdW5zZXRcbi8vICAgIC0gJ2FiYy5kJzogMVxuTWluaW1vbmdvLk1hdGNoZXIucHJvdG90eXBlLmFmZmVjdGVkQnlNb2RpZmllciA9IGZ1bmN0aW9uKG1vZGlmaWVyKSB7XG4gIC8vIHNhZmUgY2hlY2sgZm9yICRzZXQvJHVuc2V0IGJlaW5nIG9iamVjdHNcbiAgbW9kaWZpZXIgPSBPYmplY3QuYXNzaWduKHskc2V0OiB7fSwgJHVuc2V0OiB7fX0sIG1vZGlmaWVyKTtcblxuICBjb25zdCBtZWFuaW5nZnVsUGF0aHMgPSB0aGlzLl9nZXRQYXRocygpO1xuICBjb25zdCBtb2RpZmllZFBhdGhzID0gW10uY29uY2F0KFxuICAgIE9iamVjdC5rZXlzKG1vZGlmaWVyLiRzZXQpLFxuICAgIE9iamVjdC5rZXlzKG1vZGlmaWVyLiR1bnNldClcbiAgKTtcblxuICByZXR1cm4gbW9kaWZpZWRQYXRocy5zb21lKHBhdGggPT4ge1xuICAgIGNvbnN0IG1vZCA9IHBhdGguc3BsaXQoJy4nKTtcblxuICAgIHJldHVybiBtZWFuaW5nZnVsUGF0aHMuc29tZShtZWFuaW5nZnVsUGF0aCA9PiB7XG4gICAgICBjb25zdCBzZWwgPSBtZWFuaW5nZnVsUGF0aC5zcGxpdCgnLicpO1xuXG4gICAgICBsZXQgaSA9IDAsIGogPSAwO1xuXG4gICAgICB3aGlsZSAoaSA8IHNlbC5sZW5ndGggJiYgaiA8IG1vZC5sZW5ndGgpIHtcbiAgICAgICAgaWYgKGlzTnVtZXJpY0tleShzZWxbaV0pICYmIGlzTnVtZXJpY0tleShtb2Rbal0pKSB7XG4gICAgICAgICAgLy8gZm9vLjQuYmFyIHNlbGVjdG9yIGFmZmVjdGVkIGJ5IGZvby40IG1vZGlmaWVyXG4gICAgICAgICAgLy8gZm9vLjMuYmFyIHNlbGVjdG9yIHVuYWZmZWN0ZWQgYnkgZm9vLjQgbW9kaWZpZXJcbiAgICAgICAgICBpZiAoc2VsW2ldID09PSBtb2Rbal0pIHtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICAgIGorKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChpc051bWVyaWNLZXkoc2VsW2ldKSkge1xuICAgICAgICAgIC8vIGZvby40LmJhciBzZWxlY3RvciB1bmFmZmVjdGVkIGJ5IGZvby5iYXIgbW9kaWZpZXJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSBpZiAoaXNOdW1lcmljS2V5KG1vZFtqXSkpIHtcbiAgICAgICAgICBqKys7XG4gICAgICAgIH0gZWxzZSBpZiAoc2VsW2ldID09PSBtb2Rbal0pIHtcbiAgICAgICAgICBpKys7XG4gICAgICAgICAgaisrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBPbmUgaXMgYSBwcmVmaXggb2YgYW5vdGhlciwgdGFraW5nIG51bWVyaWMgZmllbGRzIGludG8gYWNjb3VudFxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSk7XG4gIH0pO1xufTtcblxuLy8gQHBhcmFtIG1vZGlmaWVyIC0gT2JqZWN0OiBNb25nb0RCLXN0eWxlZCBtb2RpZmllciB3aXRoIGAkc2V0YHMgYW5kIGAkdW5zZXRzYFxuLy8gICAgICAgICAgICAgICAgICAgICAgICAgICBvbmx5LiAoYXNzdW1lZCB0byBjb21lIGZyb20gb3Bsb2cpXG4vLyBAcmV0dXJucyAtIEJvb2xlYW46IGlmIGFmdGVyIGFwcGx5aW5nIHRoZSBtb2RpZmllciwgc2VsZWN0b3IgY2FuIHN0YXJ0XG4vLyAgICAgICAgICAgICAgICAgICAgIGFjY2VwdGluZyB0aGUgbW9kaWZpZWQgdmFsdWUuXG4vLyBOT1RFOiBhc3N1bWVzIHRoYXQgZG9jdW1lbnQgYWZmZWN0ZWQgYnkgbW9kaWZpZXIgZGlkbid0IG1hdGNoIHRoaXMgTWF0Y2hlclxuLy8gYmVmb3JlLCBzbyBpZiBtb2RpZmllciBjYW4ndCBjb252aW5jZSBzZWxlY3RvciBpbiBhIHBvc2l0aXZlIGNoYW5nZSBpdCB3b3VsZFxuLy8gc3RheSAnZmFsc2UnLlxuLy8gQ3VycmVudGx5IGRvZXNuJ3Qgc3VwcG9ydCAkLW9wZXJhdG9ycyBhbmQgbnVtZXJpYyBpbmRpY2VzIHByZWNpc2VseS5cbk1pbmltb25nby5NYXRjaGVyLnByb3RvdHlwZS5jYW5CZWNvbWVUcnVlQnlNb2RpZmllciA9IGZ1bmN0aW9uKG1vZGlmaWVyKSB7XG4gIGlmICghdGhpcy5hZmZlY3RlZEJ5TW9kaWZpZXIobW9kaWZpZXIpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYgKCF0aGlzLmlzU2ltcGxlKCkpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIG1vZGlmaWVyID0gT2JqZWN0LmFzc2lnbih7JHNldDoge30sICR1bnNldDoge319LCBtb2RpZmllcik7XG5cbiAgY29uc3QgbW9kaWZpZXJQYXRocyA9IFtdLmNvbmNhdChcbiAgICBPYmplY3Qua2V5cyhtb2RpZmllci4kc2V0KSxcbiAgICBPYmplY3Qua2V5cyhtb2RpZmllci4kdW5zZXQpXG4gICk7XG5cbiAgaWYgKHRoaXMuX2dldFBhdGhzKCkuc29tZShwYXRoSGFzTnVtZXJpY0tleXMpIHx8XG4gICAgICBtb2RpZmllclBhdGhzLnNvbWUocGF0aEhhc051bWVyaWNLZXlzKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gY2hlY2sgaWYgdGhlcmUgaXMgYSAkc2V0IG9yICR1bnNldCB0aGF0IGluZGljYXRlcyBzb21ldGhpbmcgaXMgYW5cbiAgLy8gb2JqZWN0IHJhdGhlciB0aGFuIGEgc2NhbGFyIGluIHRoZSBhY3R1YWwgb2JqZWN0IHdoZXJlIHdlIHNhdyAkLW9wZXJhdG9yXG4gIC8vIE5PVEU6IGl0IGlzIGNvcnJlY3Qgc2luY2Ugd2UgYWxsb3cgb25seSBzY2FsYXJzIGluICQtb3BlcmF0b3JzXG4gIC8vIEV4YW1wbGU6IGZvciBzZWxlY3RvciB7J2EuYic6IHskZ3Q6IDV9fSB0aGUgbW9kaWZpZXIgeydhLmIuYyc6N30gd291bGRcbiAgLy8gZGVmaW5pdGVseSBzZXQgdGhlIHJlc3VsdCB0byBmYWxzZSBhcyAnYS5iJyBhcHBlYXJzIHRvIGJlIGFuIG9iamVjdC5cbiAgY29uc3QgZXhwZWN0ZWRTY2FsYXJJc09iamVjdCA9IE9iamVjdC5rZXlzKHRoaXMuX3NlbGVjdG9yKS5zb21lKHBhdGggPT4ge1xuICAgIGlmICghaXNPcGVyYXRvck9iamVjdCh0aGlzLl9zZWxlY3RvcltwYXRoXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gbW9kaWZpZXJQYXRocy5zb21lKG1vZGlmaWVyUGF0aCA9PlxuICAgICAgbW9kaWZpZXJQYXRoLnN0YXJ0c1dpdGgoYCR7cGF0aH0uYClcbiAgICApO1xuICB9KTtcblxuICBpZiAoZXhwZWN0ZWRTY2FsYXJJc09iamVjdCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIFNlZSBpZiB3ZSBjYW4gYXBwbHkgdGhlIG1vZGlmaWVyIG9uIHRoZSBpZGVhbGx5IG1hdGNoaW5nIG9iamVjdC4gSWYgaXRcbiAgLy8gc3RpbGwgbWF0Y2hlcyB0aGUgc2VsZWN0b3IsIHRoZW4gdGhlIG1vZGlmaWVyIGNvdWxkIGhhdmUgdHVybmVkIHRoZSByZWFsXG4gIC8vIG9iamVjdCBpbiB0aGUgZGF0YWJhc2UgaW50byBzb21ldGhpbmcgbWF0Y2hpbmcuXG4gIGNvbnN0IG1hdGNoaW5nRG9jdW1lbnQgPSBFSlNPTi5jbG9uZSh0aGlzLm1hdGNoaW5nRG9jdW1lbnQoKSk7XG5cbiAgLy8gVGhlIHNlbGVjdG9yIGlzIHRvbyBjb21wbGV4LCBhbnl0aGluZyBjYW4gaGFwcGVuLlxuICBpZiAobWF0Y2hpbmdEb2N1bWVudCA9PT0gbnVsbCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBMb2NhbENvbGxlY3Rpb24uX21vZGlmeShtYXRjaGluZ0RvY3VtZW50LCBtb2RpZmllcik7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgLy8gQ291bGRuJ3Qgc2V0IGEgcHJvcGVydHkgb24gYSBmaWVsZCB3aGljaCBpcyBhIHNjYWxhciBvciBudWxsIGluIHRoZVxuICAgIC8vIHNlbGVjdG9yLlxuICAgIC8vIEV4YW1wbGU6XG4gICAgLy8gcmVhbCBkb2N1bWVudDogeyAnYS5iJzogMyB9XG4gICAgLy8gc2VsZWN0b3I6IHsgJ2EnOiAxMiB9XG4gICAgLy8gY29udmVydGVkIHNlbGVjdG9yIChpZGVhbCBkb2N1bWVudCk6IHsgJ2EnOiAxMiB9XG4gICAgLy8gbW9kaWZpZXI6IHsgJHNldDogeyAnYS5iJzogNCB9IH1cbiAgICAvLyBXZSBkb24ndCBrbm93IHdoYXQgcmVhbCBkb2N1bWVudCB3YXMgbGlrZSBidXQgZnJvbSB0aGUgZXJyb3IgcmFpc2VkIGJ5XG4gICAgLy8gJHNldCBvbiBhIHNjYWxhciBmaWVsZCB3ZSBjYW4gcmVhc29uIHRoYXQgdGhlIHN0cnVjdHVyZSBvZiByZWFsIGRvY3VtZW50XG4gICAgLy8gaXMgY29tcGxldGVseSBkaWZmZXJlbnQuXG4gICAgaWYgKGVycm9yLm5hbWUgPT09ICdNaW5pbW9uZ29FcnJvcicgJiYgZXJyb3Iuc2V0UHJvcGVydHlFcnJvcikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHRocm93IGVycm9yO1xuICB9XG5cbiAgcmV0dXJuIHRoaXMuZG9jdW1lbnRNYXRjaGVzKG1hdGNoaW5nRG9jdW1lbnQpLnJlc3VsdDtcbn07XG5cbi8vIEtub3dzIGhvdyB0byBjb21iaW5lIGEgbW9uZ28gc2VsZWN0b3IgYW5kIGEgZmllbGRzIHByb2plY3Rpb24gdG8gYSBuZXcgZmllbGRzXG4vLyBwcm9qZWN0aW9uIHRha2luZyBpbnRvIGFjY291bnQgYWN0aXZlIGZpZWxkcyBmcm9tIHRoZSBwYXNzZWQgc2VsZWN0b3IuXG4vLyBAcmV0dXJucyBPYmplY3QgLSBwcm9qZWN0aW9uIG9iamVjdCAoc2FtZSBhcyBmaWVsZHMgb3B0aW9uIG9mIG1vbmdvIGN1cnNvcilcbk1pbmltb25nby5NYXRjaGVyLnByb3RvdHlwZS5jb21iaW5lSW50b1Byb2plY3Rpb24gPSBmdW5jdGlvbihwcm9qZWN0aW9uKSB7XG4gIGNvbnN0IHNlbGVjdG9yUGF0aHMgPSBNaW5pbW9uZ28uX3BhdGhzRWxpZGluZ051bWVyaWNLZXlzKHRoaXMuX2dldFBhdGhzKCkpO1xuXG4gIC8vIFNwZWNpYWwgY2FzZSBmb3IgJHdoZXJlIG9wZXJhdG9yIGluIHRoZSBzZWxlY3RvciAtIHByb2plY3Rpb24gc2hvdWxkIGRlcGVuZFxuICAvLyBvbiBhbGwgZmllbGRzIG9mIHRoZSBkb2N1bWVudC4gZ2V0U2VsZWN0b3JQYXRocyByZXR1cm5zIGEgbGlzdCBvZiBwYXRoc1xuICAvLyBzZWxlY3RvciBkZXBlbmRzIG9uLiBJZiBvbmUgb2YgdGhlIHBhdGhzIGlzICcnIChlbXB0eSBzdHJpbmcpIHJlcHJlc2VudGluZ1xuICAvLyB0aGUgcm9vdCBvciB0aGUgd2hvbGUgZG9jdW1lbnQsIGNvbXBsZXRlIHByb2plY3Rpb24gc2hvdWxkIGJlIHJldHVybmVkLlxuICBpZiAoc2VsZWN0b3JQYXRocy5pbmNsdWRlcygnJykpIHtcbiAgICByZXR1cm4ge307XG4gIH1cblxuICByZXR1cm4gY29tYmluZUltcG9ydGFudFBhdGhzSW50b1Byb2plY3Rpb24oc2VsZWN0b3JQYXRocywgcHJvamVjdGlvbik7XG59O1xuXG4vLyBSZXR1cm5zIGFuIG9iamVjdCB0aGF0IHdvdWxkIG1hdGNoIHRoZSBzZWxlY3RvciBpZiBwb3NzaWJsZSBvciBudWxsIGlmIHRoZVxuLy8gc2VsZWN0b3IgaXMgdG9vIGNvbXBsZXggZm9yIHVzIHRvIGFuYWx5emVcbi8vIHsgJ2EuYic6IHsgYW5zOiA0MiB9LCAnZm9vLmJhcic6IG51bGwsICdmb28uYmF6JzogXCJzb21ldGhpbmdcIiB9XG4vLyA9PiB7IGE6IHsgYjogeyBhbnM6IDQyIH0gfSwgZm9vOiB7IGJhcjogbnVsbCwgYmF6OiBcInNvbWV0aGluZ1wiIH0gfVxuTWluaW1vbmdvLk1hdGNoZXIucHJvdG90eXBlLm1hdGNoaW5nRG9jdW1lbnQgPSBmdW5jdGlvbigpIHtcbiAgLy8gY2hlY2sgaWYgaXQgd2FzIGNvbXB1dGVkIGJlZm9yZVxuICBpZiAodGhpcy5fbWF0Y2hpbmdEb2N1bWVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHRoaXMuX21hdGNoaW5nRG9jdW1lbnQ7XG4gIH1cblxuICAvLyBJZiB0aGUgYW5hbHlzaXMgb2YgdGhpcyBzZWxlY3RvciBpcyB0b28gaGFyZCBmb3Igb3VyIGltcGxlbWVudGF0aW9uXG4gIC8vIGZhbGxiYWNrIHRvIFwiWUVTXCJcbiAgbGV0IGZhbGxiYWNrID0gZmFsc2U7XG5cbiAgdGhpcy5fbWF0Y2hpbmdEb2N1bWVudCA9IHBhdGhzVG9UcmVlKFxuICAgIHRoaXMuX2dldFBhdGhzKCksXG4gICAgcGF0aCA9PiB7XG4gICAgICBjb25zdCB2YWx1ZVNlbGVjdG9yID0gdGhpcy5fc2VsZWN0b3JbcGF0aF07XG5cbiAgICAgIGlmIChpc09wZXJhdG9yT2JqZWN0KHZhbHVlU2VsZWN0b3IpKSB7XG4gICAgICAgIC8vIGlmIHRoZXJlIGlzIGEgc3RyaWN0IGVxdWFsaXR5LCB0aGVyZSBpcyBhIGdvb2RcbiAgICAgICAgLy8gY2hhbmNlIHdlIGNhbiB1c2Ugb25lIG9mIHRob3NlIGFzIFwibWF0Y2hpbmdcIlxuICAgICAgICAvLyBkdW1teSB2YWx1ZVxuICAgICAgICBpZiAodmFsdWVTZWxlY3Rvci4kZXEpIHtcbiAgICAgICAgICByZXR1cm4gdmFsdWVTZWxlY3Rvci4kZXE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodmFsdWVTZWxlY3Rvci4kaW4pIHtcbiAgICAgICAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHtwbGFjZWhvbGRlcjogdmFsdWVTZWxlY3Rvcn0pO1xuXG4gICAgICAgICAgLy8gUmV0dXJuIGFueXRoaW5nIGZyb20gJGluIHRoYXQgbWF0Y2hlcyB0aGUgd2hvbGUgc2VsZWN0b3IgZm9yIHRoaXNcbiAgICAgICAgICAvLyBwYXRoLiBJZiBub3RoaW5nIG1hdGNoZXMsIHJldHVybnMgYHVuZGVmaW5lZGAgYXMgbm90aGluZyBjYW4gbWFrZVxuICAgICAgICAgIC8vIHRoaXMgc2VsZWN0b3IgaW50byBgdHJ1ZWAuXG4gICAgICAgICAgcmV0dXJuIHZhbHVlU2VsZWN0b3IuJGluLmZpbmQocGxhY2Vob2xkZXIgPT5cbiAgICAgICAgICAgIG1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKHtwbGFjZWhvbGRlcn0pLnJlc3VsdFxuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob25seUNvbnRhaW5zS2V5cyh2YWx1ZVNlbGVjdG9yLCBbJyRndCcsICckZ3RlJywgJyRsdCcsICckbHRlJ10pKSB7XG4gICAgICAgICAgbGV0IGxvd2VyQm91bmQgPSAtSW5maW5pdHk7XG4gICAgICAgICAgbGV0IHVwcGVyQm91bmQgPSBJbmZpbml0eTtcblxuICAgICAgICAgIFsnJGx0ZScsICckbHQnXS5mb3JFYWNoKG9wID0+IHtcbiAgICAgICAgICAgIGlmIChoYXNPd24uY2FsbCh2YWx1ZVNlbGVjdG9yLCBvcCkgJiZcbiAgICAgICAgICAgICAgICB2YWx1ZVNlbGVjdG9yW29wXSA8IHVwcGVyQm91bmQpIHtcbiAgICAgICAgICAgICAgdXBwZXJCb3VuZCA9IHZhbHVlU2VsZWN0b3Jbb3BdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgWyckZ3RlJywgJyRndCddLmZvckVhY2gob3AgPT4ge1xuICAgICAgICAgICAgaWYgKGhhc093bi5jYWxsKHZhbHVlU2VsZWN0b3IsIG9wKSAmJlxuICAgICAgICAgICAgICAgIHZhbHVlU2VsZWN0b3Jbb3BdID4gbG93ZXJCb3VuZCkge1xuICAgICAgICAgICAgICBsb3dlckJvdW5kID0gdmFsdWVTZWxlY3RvcltvcF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBjb25zdCBtaWRkbGUgPSAobG93ZXJCb3VuZCArIHVwcGVyQm91bmQpIC8gMjtcbiAgICAgICAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHtwbGFjZWhvbGRlcjogdmFsdWVTZWxlY3Rvcn0pO1xuXG4gICAgICAgICAgaWYgKCFtYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyh7cGxhY2Vob2xkZXI6IG1pZGRsZX0pLnJlc3VsdCAmJlxuICAgICAgICAgICAgICAobWlkZGxlID09PSBsb3dlckJvdW5kIHx8IG1pZGRsZSA9PT0gdXBwZXJCb3VuZCkpIHtcbiAgICAgICAgICAgIGZhbGxiYWNrID0gdHJ1ZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gbWlkZGxlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9ubHlDb250YWluc0tleXModmFsdWVTZWxlY3RvciwgWyckbmluJywgJyRuZSddKSkge1xuICAgICAgICAgIC8vIFNpbmNlIHRoaXMuX2lzU2ltcGxlIG1ha2VzIHN1cmUgJG5pbiBhbmQgJG5lIGFyZSBub3QgY29tYmluZWQgd2l0aFxuICAgICAgICAgIC8vIG9iamVjdHMgb3IgYXJyYXlzLCB3ZSBjYW4gY29uZmlkZW50bHkgcmV0dXJuIGFuIGVtcHR5IG9iamVjdCBhcyBpdFxuICAgICAgICAgIC8vIG5ldmVyIG1hdGNoZXMgYW55IHNjYWxhci5cbiAgICAgICAgICByZXR1cm4ge307XG4gICAgICAgIH1cblxuICAgICAgICBmYWxsYmFjayA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLl9zZWxlY3RvcltwYXRoXTtcbiAgICB9LFxuICAgIHggPT4geCk7XG5cbiAgaWYgKGZhbGxiYWNrKSB7XG4gICAgdGhpcy5fbWF0Y2hpbmdEb2N1bWVudCA9IG51bGw7XG4gIH1cblxuICByZXR1cm4gdGhpcy5fbWF0Y2hpbmdEb2N1bWVudDtcbn07XG5cbi8vIE1pbmltb25nby5Tb3J0ZXIgZ2V0cyBhIHNpbWlsYXIgbWV0aG9kLCB3aGljaCBkZWxlZ2F0ZXMgdG8gYSBNYXRjaGVyIGl0IG1hZGVcbi8vIGZvciB0aGlzIGV4YWN0IHB1cnBvc2UuXG5NaW5pbW9uZ28uU29ydGVyLnByb3RvdHlwZS5hZmZlY3RlZEJ5TW9kaWZpZXIgPSBmdW5jdGlvbihtb2RpZmllcikge1xuICByZXR1cm4gdGhpcy5fc2VsZWN0b3JGb3JBZmZlY3RlZEJ5TW9kaWZpZXIuYWZmZWN0ZWRCeU1vZGlmaWVyKG1vZGlmaWVyKTtcbn07XG5cbk1pbmltb25nby5Tb3J0ZXIucHJvdG90eXBlLmNvbWJpbmVJbnRvUHJvamVjdGlvbiA9IGZ1bmN0aW9uKHByb2plY3Rpb24pIHtcbiAgcmV0dXJuIGNvbWJpbmVJbXBvcnRhbnRQYXRoc0ludG9Qcm9qZWN0aW9uKFxuICAgIE1pbmltb25nby5fcGF0aHNFbGlkaW5nTnVtZXJpY0tleXModGhpcy5fZ2V0UGF0aHMoKSksXG4gICAgcHJvamVjdGlvblxuICApO1xufTtcblxuZnVuY3Rpb24gY29tYmluZUltcG9ydGFudFBhdGhzSW50b1Byb2plY3Rpb24ocGF0aHMsIHByb2plY3Rpb24pIHtcbiAgY29uc3QgZGV0YWlscyA9IHByb2plY3Rpb25EZXRhaWxzKHByb2plY3Rpb24pO1xuXG4gIC8vIG1lcmdlIHRoZSBwYXRocyB0byBpbmNsdWRlXG4gIGNvbnN0IHRyZWUgPSBwYXRoc1RvVHJlZShcbiAgICBwYXRocyxcbiAgICBwYXRoID0+IHRydWUsXG4gICAgKG5vZGUsIHBhdGgsIGZ1bGxQYXRoKSA9PiB0cnVlLFxuICAgIGRldGFpbHMudHJlZVxuICApO1xuICBjb25zdCBtZXJnZWRQcm9qZWN0aW9uID0gdHJlZVRvUGF0aHModHJlZSk7XG5cbiAgaWYgKGRldGFpbHMuaW5jbHVkaW5nKSB7XG4gICAgLy8gYm90aCBzZWxlY3RvciBhbmQgcHJvamVjdGlvbiBhcmUgcG9pbnRpbmcgb24gZmllbGRzIHRvIGluY2x1ZGVcbiAgICAvLyBzbyB3ZSBjYW4ganVzdCByZXR1cm4gdGhlIG1lcmdlZCB0cmVlXG4gICAgcmV0dXJuIG1lcmdlZFByb2plY3Rpb247XG4gIH1cblxuICAvLyBzZWxlY3RvciBpcyBwb2ludGluZyBhdCBmaWVsZHMgdG8gaW5jbHVkZVxuICAvLyBwcm9qZWN0aW9uIGlzIHBvaW50aW5nIGF0IGZpZWxkcyB0byBleGNsdWRlXG4gIC8vIG1ha2Ugc3VyZSB3ZSBkb24ndCBleGNsdWRlIGltcG9ydGFudCBwYXRoc1xuICBjb25zdCBtZXJnZWRFeGNsUHJvamVjdGlvbiA9IHt9O1xuXG4gIE9iamVjdC5rZXlzKG1lcmdlZFByb2plY3Rpb24pLmZvckVhY2gocGF0aCA9PiB7XG4gICAgaWYgKCFtZXJnZWRQcm9qZWN0aW9uW3BhdGhdKSB7XG4gICAgICBtZXJnZWRFeGNsUHJvamVjdGlvbltwYXRoXSA9IGZhbHNlO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIG1lcmdlZEV4Y2xQcm9qZWN0aW9uO1xufVxuXG5mdW5jdGlvbiBnZXRQYXRocyhzZWxlY3Rvcikge1xuICByZXR1cm4gT2JqZWN0LmtleXMobmV3IE1pbmltb25nby5NYXRjaGVyKHNlbGVjdG9yKS5fcGF0aHMpO1xuXG4gIC8vIFhYWCByZW1vdmUgaXQ/XG4gIC8vIHJldHVybiBPYmplY3Qua2V5cyhzZWxlY3RvcikubWFwKGsgPT4ge1xuICAvLyAgIC8vIHdlIGRvbid0IGtub3cgaG93IHRvIGhhbmRsZSAkd2hlcmUgYmVjYXVzZSBpdCBjYW4gYmUgYW55dGhpbmdcbiAgLy8gICBpZiAoayA9PT0gJyR3aGVyZScpIHtcbiAgLy8gICAgIHJldHVybiAnJzsgLy8gbWF0Y2hlcyBldmVyeXRoaW5nXG4gIC8vICAgfVxuXG4gIC8vICAgLy8gd2UgYnJhbmNoIGZyb20gJG9yLyRhbmQvJG5vciBvcGVyYXRvclxuICAvLyAgIGlmIChbJyRvcicsICckYW5kJywgJyRub3InXS5pbmNsdWRlcyhrKSkge1xuICAvLyAgICAgcmV0dXJuIHNlbGVjdG9yW2tdLm1hcChnZXRQYXRocyk7XG4gIC8vICAgfVxuXG4gIC8vICAgLy8gdGhlIHZhbHVlIGlzIGEgbGl0ZXJhbCBvciBzb21lIGNvbXBhcmlzb24gb3BlcmF0b3JcbiAgLy8gICByZXR1cm4gaztcbiAgLy8gfSlcbiAgLy8gICAucmVkdWNlKChhLCBiKSA9PiBhLmNvbmNhdChiKSwgW10pXG4gIC8vICAgLmZpbHRlcigoYSwgYiwgYykgPT4gYy5pbmRleE9mKGEpID09PSBiKTtcbn1cblxuLy8gQSBoZWxwZXIgdG8gZW5zdXJlIG9iamVjdCBoYXMgb25seSBjZXJ0YWluIGtleXNcbmZ1bmN0aW9uIG9ubHlDb250YWluc0tleXMob2JqLCBrZXlzKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhvYmopLmV2ZXJ5KGsgPT4ga2V5cy5pbmNsdWRlcyhrKSk7XG59XG5cbmZ1bmN0aW9uIHBhdGhIYXNOdW1lcmljS2V5cyhwYXRoKSB7XG4gIHJldHVybiBwYXRoLnNwbGl0KCcuJykuc29tZShpc051bWVyaWNLZXkpO1xufVxuXG4vLyBSZXR1cm5zIGEgc2V0IG9mIGtleSBwYXRocyBzaW1pbGFyIHRvXG4vLyB7ICdmb28uYmFyJzogMSwgJ2EuYi5jJzogMSB9XG5mdW5jdGlvbiB0cmVlVG9QYXRocyh0cmVlLCBwcmVmaXggPSAnJykge1xuICBjb25zdCByZXN1bHQgPSB7fTtcblxuICBPYmplY3Qua2V5cyh0cmVlKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSB0cmVlW2tleV07XG4gICAgaWYgKHZhbHVlID09PSBPYmplY3QodmFsdWUpKSB7XG4gICAgICBPYmplY3QuYXNzaWduKHJlc3VsdCwgdHJlZVRvUGF0aHModmFsdWUsIGAke3ByZWZpeCArIGtleX0uYCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHRbcHJlZml4ICsga2V5XSA9IHZhbHVlO1xuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsImltcG9ydCBMb2NhbENvbGxlY3Rpb24gZnJvbSAnLi9sb2NhbF9jb2xsZWN0aW9uLmpzJztcblxuZXhwb3J0IGNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8vIEVhY2ggZWxlbWVudCBzZWxlY3RvciBjb250YWluczpcbi8vICAtIGNvbXBpbGVFbGVtZW50U2VsZWN0b3IsIGEgZnVuY3Rpb24gd2l0aCBhcmdzOlxuLy8gICAgLSBvcGVyYW5kIC0gdGhlIFwicmlnaHQgaGFuZCBzaWRlXCIgb2YgdGhlIG9wZXJhdG9yXG4vLyAgICAtIHZhbHVlU2VsZWN0b3IgLSB0aGUgXCJjb250ZXh0XCIgZm9yIHRoZSBvcGVyYXRvciAoc28gdGhhdCAkcmVnZXggY2FuIGZpbmRcbi8vICAgICAgJG9wdGlvbnMpXG4vLyAgICAtIG1hdGNoZXIgLSB0aGUgTWF0Y2hlciB0aGlzIGlzIGdvaW5nIGludG8gKHNvIHRoYXQgJGVsZW1NYXRjaCBjYW4gY29tcGlsZVxuLy8gICAgICBtb3JlIHRoaW5ncylcbi8vICAgIHJldHVybmluZyBhIGZ1bmN0aW9uIG1hcHBpbmcgYSBzaW5nbGUgdmFsdWUgdG8gYm9vbC5cbi8vICAtIGRvbnRFeHBhbmRMZWFmQXJyYXlzLCBhIGJvb2wgd2hpY2ggcHJldmVudHMgZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyBmcm9tXG4vLyAgICBiZWluZyBjYWxsZWRcbi8vICAtIGRvbnRJbmNsdWRlTGVhZkFycmF5cywgYSBib29sIHdoaWNoIGNhdXNlcyBhbiBhcmd1bWVudCB0byBiZSBwYXNzZWQgdG9cbi8vICAgIGV4cGFuZEFycmF5c0luQnJhbmNoZXMgaWYgaXQgaXMgY2FsbGVkXG5leHBvcnQgY29uc3QgRUxFTUVOVF9PUEVSQVRPUlMgPSB7XG4gICRsdDogbWFrZUluZXF1YWxpdHkoY21wVmFsdWUgPT4gY21wVmFsdWUgPCAwKSxcbiAgJGd0OiBtYWtlSW5lcXVhbGl0eShjbXBWYWx1ZSA9PiBjbXBWYWx1ZSA+IDApLFxuICAkbHRlOiBtYWtlSW5lcXVhbGl0eShjbXBWYWx1ZSA9PiBjbXBWYWx1ZSA8PSAwKSxcbiAgJGd0ZTogbWFrZUluZXF1YWxpdHkoY21wVmFsdWUgPT4gY21wVmFsdWUgPj0gMCksXG4gICRtb2Q6IHtcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIGlmICghKEFycmF5LmlzQXJyYXkob3BlcmFuZCkgJiYgb3BlcmFuZC5sZW5ndGggPT09IDJcbiAgICAgICAgICAgICYmIHR5cGVvZiBvcGVyYW5kWzBdID09PSAnbnVtYmVyJ1xuICAgICAgICAgICAgJiYgdHlwZW9mIG9wZXJhbmRbMV0gPT09ICdudW1iZXInKSkge1xuICAgICAgICB0aHJvdyBFcnJvcignYXJndW1lbnQgdG8gJG1vZCBtdXN0IGJlIGFuIGFycmF5IG9mIHR3byBudW1iZXJzJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCBjb3VsZCByZXF1aXJlIHRvIGJlIGludHMgb3Igcm91bmQgb3Igc29tZXRoaW5nXG4gICAgICBjb25zdCBkaXZpc29yID0gb3BlcmFuZFswXTtcbiAgICAgIGNvbnN0IHJlbWFpbmRlciA9IG9wZXJhbmRbMV07XG4gICAgICByZXR1cm4gdmFsdWUgPT4gKFxuICAgICAgICB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInICYmIHZhbHVlICUgZGl2aXNvciA9PT0gcmVtYWluZGVyXG4gICAgICApO1xuICAgIH0sXG4gIH0sXG4gICRpbjoge1xuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCkge1xuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KG9wZXJhbmQpKSB7XG4gICAgICAgIHRocm93IEVycm9yKCckaW4gbmVlZHMgYW4gYXJyYXknKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZWxlbWVudE1hdGNoZXJzID0gb3BlcmFuZC5tYXAob3B0aW9uID0+IHtcbiAgICAgICAgaWYgKG9wdGlvbiBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgIHJldHVybiByZWdleHBFbGVtZW50TWF0Y2hlcihvcHRpb24pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzT3BlcmF0b3JPYmplY3Qob3B0aW9uKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdjYW5ub3QgbmVzdCAkIHVuZGVyICRpbicpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVxdWFsaXR5RWxlbWVudE1hdGNoZXIob3B0aW9uKTtcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICAvLyBBbGxvdyB7YTogeyRpbjogW251bGxdfX0gdG8gbWF0Y2ggd2hlbiAnYScgZG9lcyBub3QgZXhpc3QuXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGVsZW1lbnRNYXRjaGVycy5zb21lKG1hdGNoZXIgPT4gbWF0Y2hlcih2YWx1ZSkpO1xuICAgICAgfTtcbiAgICB9LFxuICB9LFxuICAkc2l6ZToge1xuICAgIC8vIHthOiBbWzUsIDVdXX0gbXVzdCBtYXRjaCB7YTogeyRzaXplOiAxfX0gYnV0IG5vdCB7YTogeyRzaXplOiAyfX0sIHNvIHdlXG4gICAgLy8gZG9uJ3Qgd2FudCB0byBjb25zaWRlciB0aGUgZWxlbWVudCBbNSw1XSBpbiB0aGUgbGVhZiBhcnJheSBbWzUsNV1dIGFzIGFcbiAgICAvLyBwb3NzaWJsZSB2YWx1ZS5cbiAgICBkb250RXhwYW5kTGVhZkFycmF5czogdHJ1ZSxcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIGlmICh0eXBlb2Ygb3BlcmFuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgLy8gRG9uJ3QgYXNrIG1lIHdoeSwgYnV0IGJ5IGV4cGVyaW1lbnRhdGlvbiwgdGhpcyBzZWVtcyB0byBiZSB3aGF0IE1vbmdvXG4gICAgICAgIC8vIGRvZXMuXG4gICAgICAgIG9wZXJhbmQgPSAwO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb3BlcmFuZCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJyRzaXplIG5lZWRzIGEgbnVtYmVyJyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB2YWx1ZSA9PiBBcnJheS5pc0FycmF5KHZhbHVlKSAmJiB2YWx1ZS5sZW5ndGggPT09IG9wZXJhbmQ7XG4gICAgfSxcbiAgfSxcbiAgJHR5cGU6IHtcbiAgICAvLyB7YTogWzVdfSBtdXN0IG5vdCBtYXRjaCB7YTogeyR0eXBlOiA0fX0gKDQgbWVhbnMgYXJyYXkpLCBidXQgaXQgc2hvdWxkXG4gICAgLy8gbWF0Y2gge2E6IHskdHlwZTogMX19ICgxIG1lYW5zIG51bWJlciksIGFuZCB7YTogW1s1XV19IG11c3QgbWF0Y2ggeyRhOlxuICAgIC8vIHskdHlwZTogNH19LiBUaHVzLCB3aGVuIHdlIHNlZSBhIGxlYWYgYXJyYXksIHdlICpzaG91bGQqIGV4cGFuZCBpdCBidXRcbiAgICAvLyBzaG91bGQgKm5vdCogaW5jbHVkZSBpdCBpdHNlbGYuXG4gICAgZG9udEluY2x1ZGVMZWFmQXJyYXlzOiB0cnVlLFxuICAgIGNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCkge1xuICAgICAgaWYgKHR5cGVvZiBvcGVyYW5kID09PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCBvcGVyYW5kQWxpYXNNYXAgPSB7XG4gICAgICAgICAgJ2RvdWJsZSc6IDEsXG4gICAgICAgICAgJ3N0cmluZyc6IDIsXG4gICAgICAgICAgJ29iamVjdCc6IDMsXG4gICAgICAgICAgJ2FycmF5JzogNCxcbiAgICAgICAgICAnYmluRGF0YSc6IDUsXG4gICAgICAgICAgJ3VuZGVmaW5lZCc6IDYsXG4gICAgICAgICAgJ29iamVjdElkJzogNyxcbiAgICAgICAgICAnYm9vbCc6IDgsXG4gICAgICAgICAgJ2RhdGUnOiA5LFxuICAgICAgICAgICdudWxsJzogMTAsXG4gICAgICAgICAgJ3JlZ2V4JzogMTEsXG4gICAgICAgICAgJ2RiUG9pbnRlcic6IDEyLFxuICAgICAgICAgICdqYXZhc2NyaXB0JzogMTMsXG4gICAgICAgICAgJ3N5bWJvbCc6IDE0LFxuICAgICAgICAgICdqYXZhc2NyaXB0V2l0aFNjb3BlJzogMTUsXG4gICAgICAgICAgJ2ludCc6IDE2LFxuICAgICAgICAgICd0aW1lc3RhbXAnOiAxNyxcbiAgICAgICAgICAnbG9uZyc6IDE4LFxuICAgICAgICAgICdkZWNpbWFsJzogMTksXG4gICAgICAgICAgJ21pbktleSc6IC0xLFxuICAgICAgICAgICdtYXhLZXknOiAxMjcsXG4gICAgICAgIH07XG4gICAgICAgIGlmICghaGFzT3duLmNhbGwob3BlcmFuZEFsaWFzTWFwLCBvcGVyYW5kKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKGB1bmtub3duIHN0cmluZyBhbGlhcyBmb3IgJHR5cGU6ICR7b3BlcmFuZH1gKTtcbiAgICAgICAgfVxuICAgICAgICBvcGVyYW5kID0gb3BlcmFuZEFsaWFzTWFwW29wZXJhbmRdO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb3BlcmFuZCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgaWYgKG9wZXJhbmQgPT09IDAgfHwgb3BlcmFuZCA8IC0xXG4gICAgICAgICAgfHwgKG9wZXJhbmQgPiAxOSAmJiBvcGVyYW5kICE9PSAxMjcpKSB7XG4gICAgICAgICAgdGhyb3cgRXJyb3IoYEludmFsaWQgbnVtZXJpY2FsICR0eXBlIGNvZGU6ICR7b3BlcmFuZH1gKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ2FyZ3VtZW50IHRvICR0eXBlIGlzIG5vdCBhIG51bWJlciBvciBhIHN0cmluZycpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdmFsdWUgPT4gKFxuICAgICAgICB2YWx1ZSAhPT0gdW5kZWZpbmVkICYmIExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZSh2YWx1ZSkgPT09IG9wZXJhbmRcbiAgICAgICk7XG4gICAgfSxcbiAgfSxcbiAgJGJpdHNBbGxTZXQ6IHtcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIGNvbnN0IG1hc2sgPSBnZXRPcGVyYW5kQml0bWFzayhvcGVyYW5kLCAnJGJpdHNBbGxTZXQnKTtcbiAgICAgIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgICAgIGNvbnN0IGJpdG1hc2sgPSBnZXRWYWx1ZUJpdG1hc2sodmFsdWUsIG1hc2subGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIGJpdG1hc2sgJiYgbWFzay5ldmVyeSgoYnl0ZSwgaSkgPT4gKGJpdG1hc2tbaV0gJiBieXRlKSA9PT0gYnl0ZSk7XG4gICAgICB9O1xuICAgIH0sXG4gIH0sXG4gICRiaXRzQW55U2V0OiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBjb25zdCBtYXNrID0gZ2V0T3BlcmFuZEJpdG1hc2sob3BlcmFuZCwgJyRiaXRzQW55U2V0Jyk7XG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICBjb25zdCBiaXRtYXNrID0gZ2V0VmFsdWVCaXRtYXNrKHZhbHVlLCBtYXNrLmxlbmd0aCk7XG4gICAgICAgIHJldHVybiBiaXRtYXNrICYmIG1hc2suc29tZSgoYnl0ZSwgaSkgPT4gKH5iaXRtYXNrW2ldICYgYnl0ZSkgIT09IGJ5dGUpO1xuICAgICAgfTtcbiAgICB9LFxuICB9LFxuICAkYml0c0FsbENsZWFyOiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBjb25zdCBtYXNrID0gZ2V0T3BlcmFuZEJpdG1hc2sob3BlcmFuZCwgJyRiaXRzQWxsQ2xlYXInKTtcbiAgICAgIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgICAgIGNvbnN0IGJpdG1hc2sgPSBnZXRWYWx1ZUJpdG1hc2sodmFsdWUsIG1hc2subGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIGJpdG1hc2sgJiYgbWFzay5ldmVyeSgoYnl0ZSwgaSkgPT4gIShiaXRtYXNrW2ldICYgYnl0ZSkpO1xuICAgICAgfTtcbiAgICB9LFxuICB9LFxuICAkYml0c0FueUNsZWFyOiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kKSB7XG4gICAgICBjb25zdCBtYXNrID0gZ2V0T3BlcmFuZEJpdG1hc2sob3BlcmFuZCwgJyRiaXRzQW55Q2xlYXInKTtcbiAgICAgIHJldHVybiB2YWx1ZSA9PiB7XG4gICAgICAgIGNvbnN0IGJpdG1hc2sgPSBnZXRWYWx1ZUJpdG1hc2sodmFsdWUsIG1hc2subGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIGJpdG1hc2sgJiYgbWFzay5zb21lKChieXRlLCBpKSA9PiAoYml0bWFza1tpXSAmIGJ5dGUpICE9PSBieXRlKTtcbiAgICAgIH07XG4gICAgfSxcbiAgfSxcbiAgJHJlZ2V4OiB7XG4gICAgY29tcGlsZUVsZW1lbnRTZWxlY3RvcihvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yKSB7XG4gICAgICBpZiAoISh0eXBlb2Ygb3BlcmFuZCA9PT0gJ3N0cmluZycgfHwgb3BlcmFuZCBpbnN0YW5jZW9mIFJlZ0V4cCkpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJyRyZWdleCBoYXMgdG8gYmUgYSBzdHJpbmcgb3IgUmVnRXhwJyk7XG4gICAgICB9XG5cbiAgICAgIGxldCByZWdleHA7XG4gICAgICBpZiAodmFsdWVTZWxlY3Rvci4kb3B0aW9ucyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vIE9wdGlvbnMgcGFzc2VkIGluICRvcHRpb25zIChldmVuIHRoZSBlbXB0eSBzdHJpbmcpIGFsd2F5cyBvdmVycmlkZXNcbiAgICAgICAgLy8gb3B0aW9ucyBpbiB0aGUgUmVnRXhwIG9iamVjdCBpdHNlbGYuXG5cbiAgICAgICAgLy8gQmUgY2xlYXIgdGhhdCB3ZSBvbmx5IHN1cHBvcnQgdGhlIEpTLXN1cHBvcnRlZCBvcHRpb25zLCBub3QgZXh0ZW5kZWRcbiAgICAgICAgLy8gb25lcyAoZWcsIE1vbmdvIHN1cHBvcnRzIHggYW5kIHMpLiBJZGVhbGx5IHdlIHdvdWxkIGltcGxlbWVudCB4IGFuZCBzXG4gICAgICAgIC8vIGJ5IHRyYW5zZm9ybWluZyB0aGUgcmVnZXhwLCBidXQgbm90IHRvZGF5Li4uXG4gICAgICAgIGlmICgvW15naW1dLy50ZXN0KHZhbHVlU2VsZWN0b3IuJG9wdGlvbnMpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdPbmx5IHRoZSBpLCBtLCBhbmQgZyByZWdleHAgb3B0aW9ucyBhcmUgc3VwcG9ydGVkJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzb3VyY2UgPSBvcGVyYW5kIGluc3RhbmNlb2YgUmVnRXhwID8gb3BlcmFuZC5zb3VyY2UgOiBvcGVyYW5kO1xuICAgICAgICByZWdleHAgPSBuZXcgUmVnRXhwKHNvdXJjZSwgdmFsdWVTZWxlY3Rvci4kb3B0aW9ucyk7XG4gICAgICB9IGVsc2UgaWYgKG9wZXJhbmQgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgcmVnZXhwID0gb3BlcmFuZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlZ2V4cCA9IG5ldyBSZWdFeHAob3BlcmFuZCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZWdleHBFbGVtZW50TWF0Y2hlcihyZWdleHApO1xuICAgIH0sXG4gIH0sXG4gICRlbGVtTWF0Y2g6IHtcbiAgICBkb250RXhwYW5kTGVhZkFycmF5czogdHJ1ZSxcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQsIHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIpIHtcbiAgICAgIGlmICghTG9jYWxDb2xsZWN0aW9uLl9pc1BsYWluT2JqZWN0KG9wZXJhbmQpKSB7XG4gICAgICAgIHRocm93IEVycm9yKCckZWxlbU1hdGNoIG5lZWQgYW4gb2JqZWN0Jyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGlzRG9jTWF0Y2hlciA9ICFpc09wZXJhdG9yT2JqZWN0KFxuICAgICAgICBPYmplY3Qua2V5cyhvcGVyYW5kKVxuICAgICAgICAgIC5maWx0ZXIoa2V5ID0+ICFoYXNPd24uY2FsbChMT0dJQ0FMX09QRVJBVE9SUywga2V5KSlcbiAgICAgICAgICAucmVkdWNlKChhLCBiKSA9PiBPYmplY3QuYXNzaWduKGEsIHtbYl06IG9wZXJhbmRbYl19KSwge30pLFxuICAgICAgICB0cnVlKTtcblxuICAgICAgbGV0IHN1Yk1hdGNoZXI7XG4gICAgICBpZiAoaXNEb2NNYXRjaGVyKSB7XG4gICAgICAgIC8vIFRoaXMgaXMgTk9UIHRoZSBzYW1lIGFzIGNvbXBpbGVWYWx1ZVNlbGVjdG9yKG9wZXJhbmQpLCBhbmQgbm90IGp1c3RcbiAgICAgICAgLy8gYmVjYXVzZSBvZiB0aGUgc2xpZ2h0bHkgZGlmZmVyZW50IGNhbGxpbmcgY29udmVudGlvbi5cbiAgICAgICAgLy8geyRlbGVtTWF0Y2g6IHt4OiAzfX0gbWVhbnMgXCJhbiBlbGVtZW50IGhhcyBhIGZpZWxkIHg6M1wiLCBub3RcbiAgICAgICAgLy8gXCJjb25zaXN0cyBvbmx5IG9mIGEgZmllbGQgeDozXCIuIEFsc28sIHJlZ2V4cHMgYW5kIHN1Yi0kIGFyZSBhbGxvd2VkLlxuICAgICAgICBzdWJNYXRjaGVyID1cbiAgICAgICAgICBjb21waWxlRG9jdW1lbnRTZWxlY3RvcihvcGVyYW5kLCBtYXRjaGVyLCB7aW5FbGVtTWF0Y2g6IHRydWV9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN1Yk1hdGNoZXIgPSBjb21waWxlVmFsdWVTZWxlY3RvcihvcGVyYW5kLCBtYXRjaGVyKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHZhbHVlID0+IHtcbiAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICBjb25zdCBhcnJheUVsZW1lbnQgPSB2YWx1ZVtpXTtcbiAgICAgICAgICBsZXQgYXJnO1xuICAgICAgICAgIGlmIChpc0RvY01hdGNoZXIpIHtcbiAgICAgICAgICAgIC8vIFdlIGNhbiBvbmx5IG1hdGNoIHskZWxlbU1hdGNoOiB7YjogM319IGFnYWluc3Qgb2JqZWN0cy5cbiAgICAgICAgICAgIC8vIChXZSBjYW4gYWxzbyBtYXRjaCBhZ2FpbnN0IGFycmF5cywgaWYgdGhlcmUncyBudW1lcmljIGluZGljZXMsXG4gICAgICAgICAgICAvLyBlZyB7JGVsZW1NYXRjaDogeycwLmInOiAzfX0gb3IgeyRlbGVtTWF0Y2g6IHswOiAzfX0uKVxuICAgICAgICAgICAgaWYgKCFpc0luZGV4YWJsZShhcnJheUVsZW1lbnQpKSB7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYXJnID0gYXJyYXlFbGVtZW50O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBkb250SXRlcmF0ZSBlbnN1cmVzIHRoYXQge2E6IHskZWxlbU1hdGNoOiB7JGd0OiA1fX19IG1hdGNoZXNcbiAgICAgICAgICAgIC8vIHthOiBbOF19IGJ1dCBub3Qge2E6IFtbOF1dfVxuICAgICAgICAgICAgYXJnID0gW3t2YWx1ZTogYXJyYXlFbGVtZW50LCBkb250SXRlcmF0ZTogdHJ1ZX1dO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBYWFggc3VwcG9ydCAkbmVhciBpbiAkZWxlbU1hdGNoIGJ5IHByb3BhZ2F0aW5nICRkaXN0YW5jZT9cbiAgICAgICAgICBpZiAoc3ViTWF0Y2hlcihhcmcpLnJlc3VsdCkge1xuICAgICAgICAgICAgcmV0dXJuIGk7IC8vIHNwZWNpYWxseSB1bmRlcnN0b29kIHRvIG1lYW4gXCJ1c2UgYXMgYXJyYXlJbmRpY2VzXCJcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9O1xuICAgIH0sXG4gIH0sXG59O1xuXG4vLyBPcGVyYXRvcnMgdGhhdCBhcHBlYXIgYXQgdGhlIHRvcCBsZXZlbCBvZiBhIGRvY3VtZW50IHNlbGVjdG9yLlxuY29uc3QgTE9HSUNBTF9PUEVSQVRPUlMgPSB7XG4gICRhbmQoc3ViU2VsZWN0b3IsIG1hdGNoZXIsIGluRWxlbU1hdGNoKSB7XG4gICAgcmV0dXJuIGFuZERvY3VtZW50TWF0Y2hlcnMoXG4gICAgICBjb21waWxlQXJyYXlPZkRvY3VtZW50U2VsZWN0b3JzKHN1YlNlbGVjdG9yLCBtYXRjaGVyLCBpbkVsZW1NYXRjaClcbiAgICApO1xuICB9LFxuXG4gICRvcihzdWJTZWxlY3RvciwgbWF0Y2hlciwgaW5FbGVtTWF0Y2gpIHtcbiAgICBjb25zdCBtYXRjaGVycyA9IGNvbXBpbGVBcnJheU9mRG9jdW1lbnRTZWxlY3RvcnMoXG4gICAgICBzdWJTZWxlY3RvcixcbiAgICAgIG1hdGNoZXIsXG4gICAgICBpbkVsZW1NYXRjaFxuICAgICk7XG5cbiAgICAvLyBTcGVjaWFsIGNhc2U6IGlmIHRoZXJlIGlzIG9ubHkgb25lIG1hdGNoZXIsIHVzZSBpdCBkaXJlY3RseSwgKnByZXNlcnZpbmcqXG4gICAgLy8gYW55IGFycmF5SW5kaWNlcyBpdCByZXR1cm5zLlxuICAgIGlmIChtYXRjaGVycy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHJldHVybiBtYXRjaGVyc1swXTtcbiAgICB9XG5cbiAgICByZXR1cm4gZG9jID0+IHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IG1hdGNoZXJzLnNvbWUoZm4gPT4gZm4oZG9jKS5yZXN1bHQpO1xuICAgICAgLy8gJG9yIGRvZXMgTk9UIHNldCBhcnJheUluZGljZXMgd2hlbiBpdCBoYXMgbXVsdGlwbGVcbiAgICAgIC8vIHN1Yi1leHByZXNzaW9ucy4gKFRlc3RlZCBhZ2FpbnN0IE1vbmdvREIuKVxuICAgICAgcmV0dXJuIHtyZXN1bHR9O1xuICAgIH07XG4gIH0sXG5cbiAgJG5vcihzdWJTZWxlY3RvciwgbWF0Y2hlciwgaW5FbGVtTWF0Y2gpIHtcbiAgICBjb25zdCBtYXRjaGVycyA9IGNvbXBpbGVBcnJheU9mRG9jdW1lbnRTZWxlY3RvcnMoXG4gICAgICBzdWJTZWxlY3RvcixcbiAgICAgIG1hdGNoZXIsXG4gICAgICBpbkVsZW1NYXRjaFxuICAgICk7XG4gICAgcmV0dXJuIGRvYyA9PiB7XG4gICAgICBjb25zdCByZXN1bHQgPSBtYXRjaGVycy5ldmVyeShmbiA9PiAhZm4oZG9jKS5yZXN1bHQpO1xuICAgICAgLy8gTmV2ZXIgc2V0IGFycmF5SW5kaWNlcywgYmVjYXVzZSB3ZSBvbmx5IG1hdGNoIGlmIG5vdGhpbmcgaW4gcGFydGljdWxhclxuICAgICAgLy8gJ21hdGNoZWQnIChhbmQgYmVjYXVzZSB0aGlzIGlzIGNvbnNpc3RlbnQgd2l0aCBNb25nb0RCKS5cbiAgICAgIHJldHVybiB7cmVzdWx0fTtcbiAgICB9O1xuICB9LFxuXG4gICR3aGVyZShzZWxlY3RvclZhbHVlLCBtYXRjaGVyKSB7XG4gICAgLy8gUmVjb3JkIHRoYXQgKmFueSogcGF0aCBtYXkgYmUgdXNlZC5cbiAgICBtYXRjaGVyLl9yZWNvcmRQYXRoVXNlZCgnJyk7XG4gICAgbWF0Y2hlci5faGFzV2hlcmUgPSB0cnVlO1xuXG4gICAgaWYgKCEoc2VsZWN0b3JWYWx1ZSBpbnN0YW5jZW9mIEZ1bmN0aW9uKSkge1xuICAgICAgLy8gWFhYIE1vbmdvREIgc2VlbXMgdG8gaGF2ZSBtb3JlIGNvbXBsZXggbG9naWMgdG8gZGVjaWRlIHdoZXJlIG9yIG9yIG5vdFxuICAgICAgLy8gdG8gYWRkICdyZXR1cm4nOyBub3Qgc3VyZSBleGFjdGx5IHdoYXQgaXQgaXMuXG4gICAgICBzZWxlY3RvclZhbHVlID0gRnVuY3Rpb24oJ29iaicsIGByZXR1cm4gJHtzZWxlY3RvclZhbHVlfWApO1xuICAgIH1cblxuICAgIC8vIFdlIG1ha2UgdGhlIGRvY3VtZW50IGF2YWlsYWJsZSBhcyBib3RoIGB0aGlzYCBhbmQgYG9iamAuXG4gICAgLy8gLy8gWFhYIG5vdCBzdXJlIHdoYXQgd2Ugc2hvdWxkIGRvIGlmIHRoaXMgdGhyb3dzXG4gICAgcmV0dXJuIGRvYyA9PiAoe3Jlc3VsdDogc2VsZWN0b3JWYWx1ZS5jYWxsKGRvYywgZG9jKX0pO1xuICB9LFxuXG4gIC8vIFRoaXMgaXMganVzdCB1c2VkIGFzIGEgY29tbWVudCBpbiB0aGUgcXVlcnkgKGluIE1vbmdvREIsIGl0IGFsc28gZW5kcyB1cCBpblxuICAvLyBxdWVyeSBsb2dzKTsgaXQgaGFzIG5vIGVmZmVjdCBvbiB0aGUgYWN0dWFsIHNlbGVjdGlvbi5cbiAgJGNvbW1lbnQoKSB7XG4gICAgcmV0dXJuICgpID0+ICh7cmVzdWx0OiB0cnVlfSk7XG4gIH0sXG59O1xuXG4vLyBPcGVyYXRvcnMgdGhhdCAodW5saWtlIExPR0lDQUxfT1BFUkFUT1JTKSBwZXJ0YWluIHRvIGluZGl2aWR1YWwgcGF0aHMgaW4gYVxuLy8gZG9jdW1lbnQsIGJ1dCAodW5saWtlIEVMRU1FTlRfT1BFUkFUT1JTKSBkbyBub3QgaGF2ZSBhIHNpbXBsZSBkZWZpbml0aW9uIGFzXG4vLyBcIm1hdGNoIGVhY2ggYnJhbmNoZWQgdmFsdWUgaW5kZXBlbmRlbnRseSBhbmQgY29tYmluZSB3aXRoXG4vLyBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlclwiLlxuY29uc3QgVkFMVUVfT1BFUkFUT1JTID0ge1xuICAkZXEob3BlcmFuZCkge1xuICAgIHJldHVybiBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlcihcbiAgICAgIGVxdWFsaXR5RWxlbWVudE1hdGNoZXIob3BlcmFuZClcbiAgICApO1xuICB9LFxuICAkbm90KG9wZXJhbmQsIHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIpIHtcbiAgICByZXR1cm4gaW52ZXJ0QnJhbmNoZWRNYXRjaGVyKGNvbXBpbGVWYWx1ZVNlbGVjdG9yKG9wZXJhbmQsIG1hdGNoZXIpKTtcbiAgfSxcbiAgJG5lKG9wZXJhbmQpIHtcbiAgICByZXR1cm4gaW52ZXJ0QnJhbmNoZWRNYXRjaGVyKFxuICAgICAgY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoZXF1YWxpdHlFbGVtZW50TWF0Y2hlcihvcGVyYW5kKSlcbiAgICApO1xuICB9LFxuICAkbmluKG9wZXJhbmQpIHtcbiAgICByZXR1cm4gaW52ZXJ0QnJhbmNoZWRNYXRjaGVyKFxuICAgICAgY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoXG4gICAgICAgIEVMRU1FTlRfT1BFUkFUT1JTLiRpbi5jb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpXG4gICAgICApXG4gICAgKTtcbiAgfSxcbiAgJGV4aXN0cyhvcGVyYW5kKSB7XG4gICAgY29uc3QgZXhpc3RzID0gY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoXG4gICAgICB2YWx1ZSA9PiB2YWx1ZSAhPT0gdW5kZWZpbmVkXG4gICAgKTtcbiAgICByZXR1cm4gb3BlcmFuZCA/IGV4aXN0cyA6IGludmVydEJyYW5jaGVkTWF0Y2hlcihleGlzdHMpO1xuICB9LFxuICAvLyAkb3B0aW9ucyBqdXN0IHByb3ZpZGVzIG9wdGlvbnMgZm9yICRyZWdleDsgaXRzIGxvZ2ljIGlzIGluc2lkZSAkcmVnZXhcbiAgJG9wdGlvbnMob3BlcmFuZCwgdmFsdWVTZWxlY3Rvcikge1xuICAgIGlmICghaGFzT3duLmNhbGwodmFsdWVTZWxlY3RvciwgJyRyZWdleCcpKSB7XG4gICAgICB0aHJvdyBFcnJvcignJG9wdGlvbnMgbmVlZHMgYSAkcmVnZXgnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZXZlcnl0aGluZ01hdGNoZXI7XG4gIH0sXG4gIC8vICRtYXhEaXN0YW5jZSBpcyBiYXNpY2FsbHkgYW4gYXJndW1lbnQgdG8gJG5lYXJcbiAgJG1heERpc3RhbmNlKG9wZXJhbmQsIHZhbHVlU2VsZWN0b3IpIHtcbiAgICBpZiAoIXZhbHVlU2VsZWN0b3IuJG5lYXIpIHtcbiAgICAgIHRocm93IEVycm9yKCckbWF4RGlzdGFuY2UgbmVlZHMgYSAkbmVhcicpO1xuICAgIH1cblxuICAgIHJldHVybiBldmVyeXRoaW5nTWF0Y2hlcjtcbiAgfSxcbiAgJGFsbChvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyKSB7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KG9wZXJhbmQpKSB7XG4gICAgICB0aHJvdyBFcnJvcignJGFsbCByZXF1aXJlcyBhcnJheScpO1xuICAgIH1cblxuICAgIC8vIE5vdCBzdXJlIHdoeSwgYnV0IHRoaXMgc2VlbXMgdG8gYmUgd2hhdCBNb25nb0RCIGRvZXMuXG4gICAgaWYgKG9wZXJhbmQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbm90aGluZ01hdGNoZXI7XG4gICAgfVxuXG4gICAgY29uc3QgYnJhbmNoZWRNYXRjaGVycyA9IG9wZXJhbmQubWFwKGNyaXRlcmlvbiA9PiB7XG4gICAgICAvLyBYWFggaGFuZGxlICRhbGwvJGVsZW1NYXRjaCBjb21iaW5hdGlvblxuICAgICAgaWYgKGlzT3BlcmF0b3JPYmplY3QoY3JpdGVyaW9uKSkge1xuICAgICAgICB0aHJvdyBFcnJvcignbm8gJCBleHByZXNzaW9ucyBpbiAkYWxsJyk7XG4gICAgICB9XG5cbiAgICAgIC8vIFRoaXMgaXMgYWx3YXlzIGEgcmVnZXhwIG9yIGVxdWFsaXR5IHNlbGVjdG9yLlxuICAgICAgcmV0dXJuIGNvbXBpbGVWYWx1ZVNlbGVjdG9yKGNyaXRlcmlvbiwgbWF0Y2hlcik7XG4gICAgfSk7XG5cbiAgICAvLyBhbmRCcmFuY2hlZE1hdGNoZXJzIGRvZXMgTk9UIHJlcXVpcmUgYWxsIHNlbGVjdG9ycyB0byByZXR1cm4gdHJ1ZSBvbiB0aGVcbiAgICAvLyBTQU1FIGJyYW5jaC5cbiAgICByZXR1cm4gYW5kQnJhbmNoZWRNYXRjaGVycyhicmFuY2hlZE1hdGNoZXJzKTtcbiAgfSxcbiAgJG5lYXIob3BlcmFuZCwgdmFsdWVTZWxlY3RvciwgbWF0Y2hlciwgaXNSb290KSB7XG4gICAgaWYgKCFpc1Jvb3QpIHtcbiAgICAgIHRocm93IEVycm9yKCckbmVhciBjYW5cXCd0IGJlIGluc2lkZSBhbm90aGVyICQgb3BlcmF0b3InKTtcbiAgICB9XG5cbiAgICBtYXRjaGVyLl9oYXNHZW9RdWVyeSA9IHRydWU7XG5cbiAgICAvLyBUaGVyZSBhcmUgdHdvIGtpbmRzIG9mIGdlb2RhdGEgaW4gTW9uZ29EQjogbGVnYWN5IGNvb3JkaW5hdGUgcGFpcnMgYW5kXG4gICAgLy8gR2VvSlNPTi4gVGhleSB1c2UgZGlmZmVyZW50IGRpc3RhbmNlIG1ldHJpY3MsIHRvby4gR2VvSlNPTiBxdWVyaWVzIGFyZVxuICAgIC8vIG1hcmtlZCB3aXRoIGEgJGdlb21ldHJ5IHByb3BlcnR5LCB0aG91Z2ggbGVnYWN5IGNvb3JkaW5hdGVzIGNhbiBiZVxuICAgIC8vIG1hdGNoZWQgdXNpbmcgJGdlb21ldHJ5LlxuICAgIGxldCBtYXhEaXN0YW5jZSwgcG9pbnQsIGRpc3RhbmNlO1xuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3Qob3BlcmFuZCkgJiYgaGFzT3duLmNhbGwob3BlcmFuZCwgJyRnZW9tZXRyeScpKSB7XG4gICAgICAvLyBHZW9KU09OIFwiMmRzcGhlcmVcIiBtb2RlLlxuICAgICAgbWF4RGlzdGFuY2UgPSBvcGVyYW5kLiRtYXhEaXN0YW5jZTtcbiAgICAgIHBvaW50ID0gb3BlcmFuZC4kZ2VvbWV0cnk7XG4gICAgICBkaXN0YW5jZSA9IHZhbHVlID0+IHtcbiAgICAgICAgLy8gWFhYOiBmb3Igbm93LCB3ZSBkb24ndCBjYWxjdWxhdGUgdGhlIGFjdHVhbCBkaXN0YW5jZSBiZXR3ZWVuLCBzYXksXG4gICAgICAgIC8vIHBvbHlnb24gYW5kIGNpcmNsZS4gSWYgcGVvcGxlIGNhcmUgYWJvdXQgdGhpcyB1c2UtY2FzZSBpdCB3aWxsIGdldFxuICAgICAgICAvLyBhIHByaW9yaXR5LlxuICAgICAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXZhbHVlLnR5cGUpIHtcbiAgICAgICAgICByZXR1cm4gR2VvSlNPTi5wb2ludERpc3RhbmNlKFxuICAgICAgICAgICAgcG9pbnQsXG4gICAgICAgICAgICB7dHlwZTogJ1BvaW50JywgY29vcmRpbmF0ZXM6IHBvaW50VG9BcnJheSh2YWx1ZSl9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh2YWx1ZS50eXBlID09PSAnUG9pbnQnKSB7XG4gICAgICAgICAgcmV0dXJuIEdlb0pTT04ucG9pbnREaXN0YW5jZShwb2ludCwgdmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIEdlb0pTT04uZ2VvbWV0cnlXaXRoaW5SYWRpdXModmFsdWUsIHBvaW50LCBtYXhEaXN0YW5jZSlcbiAgICAgICAgICA/IDBcbiAgICAgICAgICA6IG1heERpc3RhbmNlICsgMTtcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIG1heERpc3RhbmNlID0gdmFsdWVTZWxlY3Rvci4kbWF4RGlzdGFuY2U7XG5cbiAgICAgIGlmICghaXNJbmRleGFibGUob3BlcmFuZCkpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJyRuZWFyIGFyZ3VtZW50IG11c3QgYmUgY29vcmRpbmF0ZSBwYWlyIG9yIEdlb0pTT04nKTtcbiAgICAgIH1cblxuICAgICAgcG9pbnQgPSBwb2ludFRvQXJyYXkob3BlcmFuZCk7XG5cbiAgICAgIGRpc3RhbmNlID0gdmFsdWUgPT4ge1xuICAgICAgICBpZiAoIWlzSW5kZXhhYmxlKHZhbHVlKSkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGRpc3RhbmNlQ29vcmRpbmF0ZVBhaXJzKHBvaW50LCB2YWx1ZSk7XG4gICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBicmFuY2hlZFZhbHVlcyA9PiB7XG4gICAgICAvLyBUaGVyZSBtaWdodCBiZSBtdWx0aXBsZSBwb2ludHMgaW4gdGhlIGRvY3VtZW50IHRoYXQgbWF0Y2ggdGhlIGdpdmVuXG4gICAgICAvLyBmaWVsZC4gT25seSBvbmUgb2YgdGhlbSBuZWVkcyB0byBiZSB3aXRoaW4gJG1heERpc3RhbmNlLCBidXQgd2UgbmVlZCB0b1xuICAgICAgLy8gZXZhbHVhdGUgYWxsIG9mIHRoZW0gYW5kIHVzZSB0aGUgbmVhcmVzdCBvbmUgZm9yIHRoZSBpbXBsaWNpdCBzb3J0XG4gICAgICAvLyBzcGVjaWZpZXIuIChUaGF0J3Mgd2h5IHdlIGNhbid0IGp1c3QgdXNlIEVMRU1FTlRfT1BFUkFUT1JTIGhlcmUuKVxuICAgICAgLy9cbiAgICAgIC8vIE5vdGU6IFRoaXMgZGlmZmVycyBmcm9tIE1vbmdvREIncyBpbXBsZW1lbnRhdGlvbiwgd2hlcmUgYSBkb2N1bWVudCB3aWxsXG4gICAgICAvLyBhY3R1YWxseSBzaG93IHVwICptdWx0aXBsZSB0aW1lcyogaW4gdGhlIHJlc3VsdCBzZXQsIHdpdGggb25lIGVudHJ5IGZvclxuICAgICAgLy8gZWFjaCB3aXRoaW4tJG1heERpc3RhbmNlIGJyYW5jaGluZyBwb2ludC5cbiAgICAgIGNvbnN0IHJlc3VsdCA9IHtyZXN1bHQ6IGZhbHNlfTtcbiAgICAgIGV4cGFuZEFycmF5c0luQnJhbmNoZXMoYnJhbmNoZWRWYWx1ZXMpLmV2ZXJ5KGJyYW5jaCA9PiB7XG4gICAgICAgIC8vIGlmIG9wZXJhdGlvbiBpcyBhbiB1cGRhdGUsIGRvbid0IHNraXAgYnJhbmNoZXMsIGp1c3QgcmV0dXJuIHRoZSBmaXJzdFxuICAgICAgICAvLyBvbmUgKCMzNTk5KVxuICAgICAgICBsZXQgY3VyRGlzdGFuY2U7XG4gICAgICAgIGlmICghbWF0Y2hlci5faXNVcGRhdGUpIHtcbiAgICAgICAgICBpZiAoISh0eXBlb2YgYnJhbmNoLnZhbHVlID09PSAnb2JqZWN0JykpIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGN1ckRpc3RhbmNlID0gZGlzdGFuY2UoYnJhbmNoLnZhbHVlKTtcblxuICAgICAgICAgIC8vIFNraXAgYnJhbmNoZXMgdGhhdCBhcmVuJ3QgcmVhbCBwb2ludHMgb3IgYXJlIHRvbyBmYXIgYXdheS5cbiAgICAgICAgICBpZiAoY3VyRGlzdGFuY2UgPT09IG51bGwgfHwgY3VyRGlzdGFuY2UgPiBtYXhEaXN0YW5jZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gU2tpcCBhbnl0aGluZyB0aGF0J3MgYSB0aWUuXG4gICAgICAgICAgaWYgKHJlc3VsdC5kaXN0YW5jZSAhPT0gdW5kZWZpbmVkICYmIHJlc3VsdC5kaXN0YW5jZSA8PSBjdXJEaXN0YW5jZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmVzdWx0LnJlc3VsdCA9IHRydWU7XG4gICAgICAgIHJlc3VsdC5kaXN0YW5jZSA9IGN1ckRpc3RhbmNlO1xuXG4gICAgICAgIGlmIChicmFuY2guYXJyYXlJbmRpY2VzKSB7XG4gICAgICAgICAgcmVzdWx0LmFycmF5SW5kaWNlcyA9IGJyYW5jaC5hcnJheUluZGljZXM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVsZXRlIHJlc3VsdC5hcnJheUluZGljZXM7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gIW1hdGNoZXIuX2lzVXBkYXRlO1xuICAgICAgfSk7XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcbiAgfSxcbn07XG5cbi8vIE5COiBXZSBhcmUgY2hlYXRpbmcgYW5kIHVzaW5nIHRoaXMgZnVuY3Rpb24gdG8gaW1wbGVtZW50ICdBTkQnIGZvciBib3RoXG4vLyAnZG9jdW1lbnQgbWF0Y2hlcnMnIGFuZCAnYnJhbmNoZWQgbWF0Y2hlcnMnLiBUaGV5IGJvdGggcmV0dXJuIHJlc3VsdCBvYmplY3RzXG4vLyBidXQgdGhlIGFyZ3VtZW50IGlzIGRpZmZlcmVudDogZm9yIHRoZSBmb3JtZXIgaXQncyBhIHdob2xlIGRvYywgd2hlcmVhcyBmb3Jcbi8vIHRoZSBsYXR0ZXIgaXQncyBhbiBhcnJheSBvZiAnYnJhbmNoZWQgdmFsdWVzJy5cbmZ1bmN0aW9uIGFuZFNvbWVNYXRjaGVycyhzdWJNYXRjaGVycykge1xuICBpZiAoc3ViTWF0Y2hlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGV2ZXJ5dGhpbmdNYXRjaGVyO1xuICB9XG5cbiAgaWYgKHN1Yk1hdGNoZXJzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBzdWJNYXRjaGVyc1swXTtcbiAgfVxuXG4gIHJldHVybiBkb2NPckJyYW5jaGVzID0+IHtcbiAgICBjb25zdCBtYXRjaCA9IHt9O1xuICAgIG1hdGNoLnJlc3VsdCA9IHN1Yk1hdGNoZXJzLmV2ZXJ5KGZuID0+IHtcbiAgICAgIGNvbnN0IHN1YlJlc3VsdCA9IGZuKGRvY09yQnJhbmNoZXMpO1xuXG4gICAgICAvLyBDb3B5IGEgJ2Rpc3RhbmNlJyBudW1iZXIgb3V0IG9mIHRoZSBmaXJzdCBzdWItbWF0Y2hlciB0aGF0IGhhc1xuICAgICAgLy8gb25lLiBZZXMsIHRoaXMgbWVhbnMgdGhhdCBpZiB0aGVyZSBhcmUgbXVsdGlwbGUgJG5lYXIgZmllbGRzIGluIGFcbiAgICAgIC8vIHF1ZXJ5LCBzb21ldGhpbmcgYXJiaXRyYXJ5IGhhcHBlbnM7IHRoaXMgYXBwZWFycyB0byBiZSBjb25zaXN0ZW50IHdpdGhcbiAgICAgIC8vIE1vbmdvLlxuICAgICAgaWYgKHN1YlJlc3VsdC5yZXN1bHQgJiZcbiAgICAgICAgICBzdWJSZXN1bHQuZGlzdGFuY2UgIT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgIG1hdGNoLmRpc3RhbmNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgbWF0Y2guZGlzdGFuY2UgPSBzdWJSZXN1bHQuZGlzdGFuY2U7XG4gICAgICB9XG5cbiAgICAgIC8vIFNpbWlsYXJseSwgcHJvcGFnYXRlIGFycmF5SW5kaWNlcyBmcm9tIHN1Yi1tYXRjaGVycy4uLiBidXQgdG8gbWF0Y2hcbiAgICAgIC8vIE1vbmdvREIgYmVoYXZpb3IsIHRoaXMgdGltZSB0aGUgKmxhc3QqIHN1Yi1tYXRjaGVyIHdpdGggYXJyYXlJbmRpY2VzXG4gICAgICAvLyB3aW5zLlxuICAgICAgaWYgKHN1YlJlc3VsdC5yZXN1bHQgJiYgc3ViUmVzdWx0LmFycmF5SW5kaWNlcykge1xuICAgICAgICBtYXRjaC5hcnJheUluZGljZXMgPSBzdWJSZXN1bHQuYXJyYXlJbmRpY2VzO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gc3ViUmVzdWx0LnJlc3VsdDtcbiAgICB9KTtcblxuICAgIC8vIElmIHdlIGRpZG4ndCBhY3R1YWxseSBtYXRjaCwgZm9yZ2V0IGFueSBleHRyYSBtZXRhZGF0YSB3ZSBjYW1lIHVwIHdpdGguXG4gICAgaWYgKCFtYXRjaC5yZXN1bHQpIHtcbiAgICAgIGRlbGV0ZSBtYXRjaC5kaXN0YW5jZTtcbiAgICAgIGRlbGV0ZSBtYXRjaC5hcnJheUluZGljZXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hdGNoO1xuICB9O1xufVxuXG5jb25zdCBhbmREb2N1bWVudE1hdGNoZXJzID0gYW5kU29tZU1hdGNoZXJzO1xuY29uc3QgYW5kQnJhbmNoZWRNYXRjaGVycyA9IGFuZFNvbWVNYXRjaGVycztcblxuZnVuY3Rpb24gY29tcGlsZUFycmF5T2ZEb2N1bWVudFNlbGVjdG9ycyhzZWxlY3RvcnMsIG1hdGNoZXIsIGluRWxlbU1hdGNoKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShzZWxlY3RvcnMpIHx8IHNlbGVjdG9ycy5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBFcnJvcignJGFuZC8kb3IvJG5vciBtdXN0IGJlIG5vbmVtcHR5IGFycmF5Jyk7XG4gIH1cblxuICByZXR1cm4gc2VsZWN0b3JzLm1hcChzdWJTZWxlY3RvciA9PiB7XG4gICAgaWYgKCFMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3Qoc3ViU2VsZWN0b3IpKSB7XG4gICAgICB0aHJvdyBFcnJvcignJG9yLyRhbmQvJG5vciBlbnRyaWVzIG5lZWQgdG8gYmUgZnVsbCBvYmplY3RzJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbXBpbGVEb2N1bWVudFNlbGVjdG9yKHN1YlNlbGVjdG9yLCBtYXRjaGVyLCB7aW5FbGVtTWF0Y2h9KTtcbiAgfSk7XG59XG5cbi8vIFRha2VzIGluIGEgc2VsZWN0b3IgdGhhdCBjb3VsZCBtYXRjaCBhIGZ1bGwgZG9jdW1lbnQgKGVnLCB0aGUgb3JpZ2luYWxcbi8vIHNlbGVjdG9yKS4gUmV0dXJucyBhIGZ1bmN0aW9uIG1hcHBpbmcgZG9jdW1lbnQtPnJlc3VsdCBvYmplY3QuXG4vL1xuLy8gbWF0Y2hlciBpcyB0aGUgTWF0Y2hlciBvYmplY3Qgd2UgYXJlIGNvbXBpbGluZy5cbi8vXG4vLyBJZiB0aGlzIGlzIHRoZSByb290IGRvY3VtZW50IHNlbGVjdG9yIChpZSwgbm90IHdyYXBwZWQgaW4gJGFuZCBvciB0aGUgbGlrZSksXG4vLyB0aGVuIGlzUm9vdCBpcyB0cnVlLiAoVGhpcyBpcyB1c2VkIGJ5ICRuZWFyLilcbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlRG9jdW1lbnRTZWxlY3Rvcihkb2NTZWxlY3RvciwgbWF0Y2hlciwgb3B0aW9ucyA9IHt9KSB7XG4gIGNvbnN0IGRvY01hdGNoZXJzID0gT2JqZWN0LmtleXMoZG9jU2VsZWN0b3IpLm1hcChrZXkgPT4ge1xuICAgIGNvbnN0IHN1YlNlbGVjdG9yID0gZG9jU2VsZWN0b3Jba2V5XTtcblxuICAgIGlmIChrZXkuc3Vic3RyKDAsIDEpID09PSAnJCcpIHtcbiAgICAgIC8vIE91dGVyIG9wZXJhdG9ycyBhcmUgZWl0aGVyIGxvZ2ljYWwgb3BlcmF0b3JzICh0aGV5IHJlY3Vyc2UgYmFjayBpbnRvXG4gICAgICAvLyB0aGlzIGZ1bmN0aW9uKSwgb3IgJHdoZXJlLlxuICAgICAgaWYgKCFoYXNPd24uY2FsbChMT0dJQ0FMX09QRVJBVE9SUywga2V5KSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVjb2duaXplZCBsb2dpY2FsIG9wZXJhdG9yOiAke2tleX1gKTtcbiAgICAgIH1cblxuICAgICAgbWF0Y2hlci5faXNTaW1wbGUgPSBmYWxzZTtcbiAgICAgIHJldHVybiBMT0dJQ0FMX09QRVJBVE9SU1trZXldKHN1YlNlbGVjdG9yLCBtYXRjaGVyLCBvcHRpb25zLmluRWxlbU1hdGNoKTtcbiAgICB9XG5cbiAgICAvLyBSZWNvcmQgdGhpcyBwYXRoLCBidXQgb25seSBpZiB3ZSBhcmVuJ3QgaW4gYW4gZWxlbU1hdGNoZXIsIHNpbmNlIGluIGFuXG4gICAgLy8gZWxlbU1hdGNoIHRoaXMgaXMgYSBwYXRoIGluc2lkZSBhbiBvYmplY3QgaW4gYW4gYXJyYXksIG5vdCBpbiB0aGUgZG9jXG4gICAgLy8gcm9vdC5cbiAgICBpZiAoIW9wdGlvbnMuaW5FbGVtTWF0Y2gpIHtcbiAgICAgIG1hdGNoZXIuX3JlY29yZFBhdGhVc2VkKGtleSk7XG4gICAgfVxuXG4gICAgLy8gRG9uJ3QgYWRkIGEgbWF0Y2hlciBpZiBzdWJTZWxlY3RvciBpcyBhIGZ1bmN0aW9uIC0tIHRoaXMgaXMgdG8gbWF0Y2hcbiAgICAvLyB0aGUgYmVoYXZpb3Igb2YgTWV0ZW9yIG9uIHRoZSBzZXJ2ZXIgKGluaGVyaXRlZCBmcm9tIHRoZSBub2RlIG1vbmdvZGJcbiAgICAvLyBkcml2ZXIpLCB3aGljaCBpcyB0byBpZ25vcmUgYW55IHBhcnQgb2YgYSBzZWxlY3RvciB3aGljaCBpcyBhIGZ1bmN0aW9uLlxuICAgIGlmICh0eXBlb2Ygc3ViU2VsZWN0b3IgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgY29uc3QgbG9va1VwQnlJbmRleCA9IG1ha2VMb29rdXBGdW5jdGlvbihrZXkpO1xuICAgIGNvbnN0IHZhbHVlTWF0Y2hlciA9IGNvbXBpbGVWYWx1ZVNlbGVjdG9yKFxuICAgICAgc3ViU2VsZWN0b3IsXG4gICAgICBtYXRjaGVyLFxuICAgICAgb3B0aW9ucy5pc1Jvb3RcbiAgICApO1xuXG4gICAgcmV0dXJuIGRvYyA9PiB2YWx1ZU1hdGNoZXIobG9va1VwQnlJbmRleChkb2MpKTtcbiAgfSkuZmlsdGVyKEJvb2xlYW4pO1xuXG4gIHJldHVybiBhbmREb2N1bWVudE1hdGNoZXJzKGRvY01hdGNoZXJzKTtcbn1cblxuLy8gVGFrZXMgaW4gYSBzZWxlY3RvciB0aGF0IGNvdWxkIG1hdGNoIGEga2V5LWluZGV4ZWQgdmFsdWUgaW4gYSBkb2N1bWVudDsgZWcsXG4vLyB7JGd0OiA1LCAkbHQ6IDl9LCBvciBhIHJlZ3VsYXIgZXhwcmVzc2lvbiwgb3IgYW55IG5vbi1leHByZXNzaW9uIG9iamVjdCAodG9cbi8vIGluZGljYXRlIGVxdWFsaXR5KS4gIFJldHVybnMgYSBicmFuY2hlZCBtYXRjaGVyOiBhIGZ1bmN0aW9uIG1hcHBpbmdcbi8vIFticmFuY2hlZCB2YWx1ZV0tPnJlc3VsdCBvYmplY3QuXG5mdW5jdGlvbiBjb21waWxlVmFsdWVTZWxlY3Rvcih2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyLCBpc1Jvb3QpIHtcbiAgaWYgKHZhbHVlU2VsZWN0b3IgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICBtYXRjaGVyLl9pc1NpbXBsZSA9IGZhbHNlO1xuICAgIHJldHVybiBjb252ZXJ0RWxlbWVudE1hdGNoZXJUb0JyYW5jaGVkTWF0Y2hlcihcbiAgICAgIHJlZ2V4cEVsZW1lbnRNYXRjaGVyKHZhbHVlU2VsZWN0b3IpXG4gICAgKTtcbiAgfVxuXG4gIGlmIChpc09wZXJhdG9yT2JqZWN0KHZhbHVlU2VsZWN0b3IpKSB7XG4gICAgcmV0dXJuIG9wZXJhdG9yQnJhbmNoZWRNYXRjaGVyKHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIsIGlzUm9vdCk7XG4gIH1cblxuICByZXR1cm4gY29udmVydEVsZW1lbnRNYXRjaGVyVG9CcmFuY2hlZE1hdGNoZXIoXG4gICAgZXF1YWxpdHlFbGVtZW50TWF0Y2hlcih2YWx1ZVNlbGVjdG9yKVxuICApO1xufVxuXG4vLyBHaXZlbiBhbiBlbGVtZW50IG1hdGNoZXIgKHdoaWNoIGV2YWx1YXRlcyBhIHNpbmdsZSB2YWx1ZSksIHJldHVybnMgYSBicmFuY2hlZFxuLy8gdmFsdWUgKHdoaWNoIGV2YWx1YXRlcyB0aGUgZWxlbWVudCBtYXRjaGVyIG9uIGFsbCB0aGUgYnJhbmNoZXMgYW5kIHJldHVybnMgYVxuLy8gbW9yZSBzdHJ1Y3R1cmVkIHJldHVybiB2YWx1ZSBwb3NzaWJseSBpbmNsdWRpbmcgYXJyYXlJbmRpY2VzKS5cbmZ1bmN0aW9uIGNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyKGVsZW1lbnRNYXRjaGVyLCBvcHRpb25zID0ge30pIHtcbiAgcmV0dXJuIGJyYW5jaGVzID0+IHtcbiAgICBjb25zdCBleHBhbmRlZCA9IG9wdGlvbnMuZG9udEV4cGFuZExlYWZBcnJheXNcbiAgICAgID8gYnJhbmNoZXNcbiAgICAgIDogZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyhicmFuY2hlcywgb3B0aW9ucy5kb250SW5jbHVkZUxlYWZBcnJheXMpO1xuXG4gICAgY29uc3QgbWF0Y2ggPSB7fTtcbiAgICBtYXRjaC5yZXN1bHQgPSBleHBhbmRlZC5zb21lKGVsZW1lbnQgPT4ge1xuICAgICAgbGV0IG1hdGNoZWQgPSBlbGVtZW50TWF0Y2hlcihlbGVtZW50LnZhbHVlKTtcblxuICAgICAgLy8gU3BlY2lhbCBjYXNlIGZvciAkZWxlbU1hdGNoOiBpdCBtZWFucyBcInRydWUsIGFuZCB1c2UgdGhpcyBhcyBhbiBhcnJheVxuICAgICAgLy8gaW5kZXggaWYgSSBkaWRuJ3QgYWxyZWFkeSBoYXZlIG9uZVwiLlxuICAgICAgaWYgKHR5cGVvZiBtYXRjaGVkID09PSAnbnVtYmVyJykge1xuICAgICAgICAvLyBYWFggVGhpcyBjb2RlIGRhdGVzIGZyb20gd2hlbiB3ZSBvbmx5IHN0b3JlZCBhIHNpbmdsZSBhcnJheSBpbmRleFxuICAgICAgICAvLyAoZm9yIHRoZSBvdXRlcm1vc3QgYXJyYXkpLiBTaG91bGQgd2UgYmUgYWxzbyBpbmNsdWRpbmcgZGVlcGVyIGFycmF5XG4gICAgICAgIC8vIGluZGljZXMgZnJvbSB0aGUgJGVsZW1NYXRjaCBtYXRjaD9cbiAgICAgICAgaWYgKCFlbGVtZW50LmFycmF5SW5kaWNlcykge1xuICAgICAgICAgIGVsZW1lbnQuYXJyYXlJbmRpY2VzID0gW21hdGNoZWRdO1xuICAgICAgICB9XG5cbiAgICAgICAgbWF0Y2hlZCA9IHRydWU7XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHNvbWUgZWxlbWVudCBtYXRjaGVkLCBhbmQgaXQncyB0YWdnZWQgd2l0aCBhcnJheSBpbmRpY2VzLCBpbmNsdWRlXG4gICAgICAvLyB0aG9zZSBpbmRpY2VzIGluIG91ciByZXN1bHQgb2JqZWN0LlxuICAgICAgaWYgKG1hdGNoZWQgJiYgZWxlbWVudC5hcnJheUluZGljZXMpIHtcbiAgICAgICAgbWF0Y2guYXJyYXlJbmRpY2VzID0gZWxlbWVudC5hcnJheUluZGljZXM7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBtYXRjaGVkO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG1hdGNoO1xuICB9O1xufVxuXG4vLyBIZWxwZXJzIGZvciAkbmVhci5cbmZ1bmN0aW9uIGRpc3RhbmNlQ29vcmRpbmF0ZVBhaXJzKGEsIGIpIHtcbiAgY29uc3QgcG9pbnRBID0gcG9pbnRUb0FycmF5KGEpO1xuICBjb25zdCBwb2ludEIgPSBwb2ludFRvQXJyYXkoYik7XG5cbiAgcmV0dXJuIE1hdGguaHlwb3QocG9pbnRBWzBdIC0gcG9pbnRCWzBdLCBwb2ludEFbMV0gLSBwb2ludEJbMV0pO1xufVxuXG4vLyBUYWtlcyBzb21ldGhpbmcgdGhhdCBpcyBub3QgYW4gb3BlcmF0b3Igb2JqZWN0IGFuZCByZXR1cm5zIGFuIGVsZW1lbnQgbWF0Y2hlclxuLy8gZm9yIGVxdWFsaXR5IHdpdGggdGhhdCB0aGluZy5cbmV4cG9ydCBmdW5jdGlvbiBlcXVhbGl0eUVsZW1lbnRNYXRjaGVyKGVsZW1lbnRTZWxlY3Rvcikge1xuICBpZiAoaXNPcGVyYXRvck9iamVjdChlbGVtZW50U2VsZWN0b3IpKSB7XG4gICAgdGhyb3cgRXJyb3IoJ0NhblxcJ3QgY3JlYXRlIGVxdWFsaXR5VmFsdWVTZWxlY3RvciBmb3Igb3BlcmF0b3Igb2JqZWN0Jyk7XG4gIH1cblxuICAvLyBTcGVjaWFsLWNhc2U6IG51bGwgYW5kIHVuZGVmaW5lZCBhcmUgZXF1YWwgKGlmIHlvdSBnb3QgdW5kZWZpbmVkIGluIHRoZXJlXG4gIC8vIHNvbWV3aGVyZSwgb3IgaWYgeW91IGdvdCBpdCBkdWUgdG8gc29tZSBicmFuY2ggYmVpbmcgbm9uLWV4aXN0ZW50IGluIHRoZVxuICAvLyB3ZWlyZCBzcGVjaWFsIGNhc2UpLCBldmVuIHRob3VnaCB0aGV5IGFyZW4ndCB3aXRoIEVKU09OLmVxdWFscy5cbiAgLy8gdW5kZWZpbmVkIG9yIG51bGxcbiAgaWYgKGVsZW1lbnRTZWxlY3RvciA9PSBudWxsKSB7XG4gICAgcmV0dXJuIHZhbHVlID0+IHZhbHVlID09IG51bGw7XG4gIH1cblxuICByZXR1cm4gdmFsdWUgPT4gTG9jYWxDb2xsZWN0aW9uLl9mLl9lcXVhbChlbGVtZW50U2VsZWN0b3IsIHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gZXZlcnl0aGluZ01hdGNoZXIoZG9jT3JCcmFuY2hlZFZhbHVlcykge1xuICByZXR1cm4ge3Jlc3VsdDogdHJ1ZX07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHBhbmRBcnJheXNJbkJyYW5jaGVzKGJyYW5jaGVzLCBza2lwVGhlQXJyYXlzKSB7XG4gIGNvbnN0IGJyYW5jaGVzT3V0ID0gW107XG5cbiAgYnJhbmNoZXMuZm9yRWFjaChicmFuY2ggPT4ge1xuICAgIGNvbnN0IHRoaXNJc0FycmF5ID0gQXJyYXkuaXNBcnJheShicmFuY2gudmFsdWUpO1xuXG4gICAgLy8gV2UgaW5jbHVkZSB0aGUgYnJhbmNoIGl0c2VsZiwgKlVOTEVTUyogd2UgaXQncyBhbiBhcnJheSB0aGF0IHdlJ3JlIGdvaW5nXG4gICAgLy8gdG8gaXRlcmF0ZSBhbmQgd2UncmUgdG9sZCB0byBza2lwIGFycmF5cy4gIChUaGF0J3MgcmlnaHQsIHdlIGluY2x1ZGUgc29tZVxuICAgIC8vIGFycmF5cyBldmVuIHNraXBUaGVBcnJheXMgaXMgdHJ1ZTogdGhlc2UgYXJlIGFycmF5cyB0aGF0IHdlcmUgZm91bmQgdmlhXG4gICAgLy8gZXhwbGljaXQgbnVtZXJpY2FsIGluZGljZXMuKVxuICAgIGlmICghKHNraXBUaGVBcnJheXMgJiYgdGhpc0lzQXJyYXkgJiYgIWJyYW5jaC5kb250SXRlcmF0ZSkpIHtcbiAgICAgIGJyYW5jaGVzT3V0LnB1c2goe2FycmF5SW5kaWNlczogYnJhbmNoLmFycmF5SW5kaWNlcywgdmFsdWU6IGJyYW5jaC52YWx1ZX0pO1xuICAgIH1cblxuICAgIGlmICh0aGlzSXNBcnJheSAmJiAhYnJhbmNoLmRvbnRJdGVyYXRlKSB7XG4gICAgICBicmFuY2gudmFsdWUuZm9yRWFjaCgodmFsdWUsIGkpID0+IHtcbiAgICAgICAgYnJhbmNoZXNPdXQucHVzaCh7XG4gICAgICAgICAgYXJyYXlJbmRpY2VzOiAoYnJhbmNoLmFycmF5SW5kaWNlcyB8fCBbXSkuY29uY2F0KGkpLFxuICAgICAgICAgIHZhbHVlXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gYnJhbmNoZXNPdXQ7XG59XG5cbi8vIEhlbHBlcnMgZm9yICRiaXRzQWxsU2V0LyRiaXRzQW55U2V0LyRiaXRzQWxsQ2xlYXIvJGJpdHNBbnlDbGVhci5cbmZ1bmN0aW9uIGdldE9wZXJhbmRCaXRtYXNrKG9wZXJhbmQsIHNlbGVjdG9yKSB7XG4gIC8vIG51bWVyaWMgYml0bWFza1xuICAvLyBZb3UgY2FuIHByb3ZpZGUgYSBudW1lcmljIGJpdG1hc2sgdG8gYmUgbWF0Y2hlZCBhZ2FpbnN0IHRoZSBvcGVyYW5kIGZpZWxkLlxuICAvLyBJdCBtdXN0IGJlIHJlcHJlc2VudGFibGUgYXMgYSBub24tbmVnYXRpdmUgMzItYml0IHNpZ25lZCBpbnRlZ2VyLlxuICAvLyBPdGhlcndpc2UsICRiaXRzQWxsU2V0IHdpbGwgcmV0dXJuIGFuIGVycm9yLlxuICBpZiAoTnVtYmVyLmlzSW50ZWdlcihvcGVyYW5kKSAmJiBvcGVyYW5kID49IDApIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkobmV3IEludDMyQXJyYXkoW29wZXJhbmRdKS5idWZmZXIpO1xuICB9XG5cbiAgLy8gYmluZGF0YSBiaXRtYXNrXG4gIC8vIFlvdSBjYW4gYWxzbyB1c2UgYW4gYXJiaXRyYXJpbHkgbGFyZ2UgQmluRGF0YSBpbnN0YW5jZSBhcyBhIGJpdG1hc2suXG4gIGlmIChFSlNPTi5pc0JpbmFyeShvcGVyYW5kKSkge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheShvcGVyYW5kLmJ1ZmZlcik7XG4gIH1cblxuICAvLyBwb3NpdGlvbiBsaXN0XG4gIC8vIElmIHF1ZXJ5aW5nIGEgbGlzdCBvZiBiaXQgcG9zaXRpb25zLCBlYWNoIDxwb3NpdGlvbj4gbXVzdCBiZSBhIG5vbi1uZWdhdGl2ZVxuICAvLyBpbnRlZ2VyLiBCaXQgcG9zaXRpb25zIHN0YXJ0IGF0IDAgZnJvbSB0aGUgbGVhc3Qgc2lnbmlmaWNhbnQgYml0LlxuICBpZiAoQXJyYXkuaXNBcnJheShvcGVyYW5kKSAmJlxuICAgICAgb3BlcmFuZC5ldmVyeSh4ID0+IE51bWJlci5pc0ludGVnZXIoeCkgJiYgeCA+PSAwKSkge1xuICAgIGNvbnN0IGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcigoTWF0aC5tYXgoLi4ub3BlcmFuZCkgPj4gMykgKyAxKTtcbiAgICBjb25zdCB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyKTtcblxuICAgIG9wZXJhbmQuZm9yRWFjaCh4ID0+IHtcbiAgICAgIHZpZXdbeCA+PiAzXSB8PSAxIDw8ICh4ICYgMHg3KTtcbiAgICB9KTtcblxuICAgIHJldHVybiB2aWV3O1xuICB9XG5cbiAgLy8gYmFkIG9wZXJhbmRcbiAgdGhyb3cgRXJyb3IoXG4gICAgYG9wZXJhbmQgdG8gJHtzZWxlY3Rvcn0gbXVzdCBiZSBhIG51bWVyaWMgYml0bWFzayAocmVwcmVzZW50YWJsZSBhcyBhIGAgK1xuICAgICdub24tbmVnYXRpdmUgMzItYml0IHNpZ25lZCBpbnRlZ2VyKSwgYSBiaW5kYXRhIGJpdG1hc2sgb3IgYW4gYXJyYXkgd2l0aCAnICtcbiAgICAnYml0IHBvc2l0aW9ucyAobm9uLW5lZ2F0aXZlIGludGVnZXJzKSdcbiAgKTtcbn1cblxuZnVuY3Rpb24gZ2V0VmFsdWVCaXRtYXNrKHZhbHVlLCBsZW5ndGgpIHtcbiAgLy8gVGhlIGZpZWxkIHZhbHVlIG11c3QgYmUgZWl0aGVyIG51bWVyaWNhbCBvciBhIEJpbkRhdGEgaW5zdGFuY2UuIE90aGVyd2lzZSxcbiAgLy8gJGJpdHMuLi4gd2lsbCBub3QgbWF0Y2ggdGhlIGN1cnJlbnQgZG9jdW1lbnQuXG5cbiAgLy8gbnVtZXJpY2FsXG4gIGlmIChOdW1iZXIuaXNTYWZlSW50ZWdlcih2YWx1ZSkpIHtcbiAgICAvLyAkYml0cy4uLiB3aWxsIG5vdCBtYXRjaCBudW1lcmljYWwgdmFsdWVzIHRoYXQgY2Fubm90IGJlIHJlcHJlc2VudGVkIGFzIGFcbiAgICAvLyBzaWduZWQgNjQtYml0IGludGVnZXIuIFRoaXMgY2FuIGJlIHRoZSBjYXNlIGlmIGEgdmFsdWUgaXMgZWl0aGVyIHRvb1xuICAgIC8vIGxhcmdlIG9yIHNtYWxsIHRvIGZpdCBpbiBhIHNpZ25lZCA2NC1iaXQgaW50ZWdlciwgb3IgaWYgaXQgaGFzIGFcbiAgICAvLyBmcmFjdGlvbmFsIGNvbXBvbmVudC5cbiAgICBjb25zdCBidWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoXG4gICAgICBNYXRoLm1heChsZW5ndGgsIDIgKiBVaW50MzJBcnJheS5CWVRFU19QRVJfRUxFTUVOVClcbiAgICApO1xuXG4gICAgbGV0IHZpZXcgPSBuZXcgVWludDMyQXJyYXkoYnVmZmVyLCAwLCAyKTtcbiAgICB2aWV3WzBdID0gdmFsdWUgJSAoKDEgPDwgMTYpICogKDEgPDwgMTYpKSB8IDA7XG4gICAgdmlld1sxXSA9IHZhbHVlIC8gKCgxIDw8IDE2KSAqICgxIDw8IDE2KSkgfCAwO1xuXG4gICAgLy8gc2lnbiBleHRlbnNpb25cbiAgICBpZiAodmFsdWUgPCAwKSB7XG4gICAgICB2aWV3ID0gbmV3IFVpbnQ4QXJyYXkoYnVmZmVyLCAyKTtcbiAgICAgIHZpZXcuZm9yRWFjaCgoYnl0ZSwgaSkgPT4ge1xuICAgICAgICB2aWV3W2ldID0gMHhmZjtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVWludDhBcnJheShidWZmZXIpO1xuICB9XG5cbiAgLy8gYmluZGF0YVxuICBpZiAoRUpTT04uaXNCaW5hcnkodmFsdWUpKSB7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KHZhbHVlLmJ1ZmZlcik7XG4gIH1cblxuICAvLyBubyBtYXRjaFxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8vIEFjdHVhbGx5IGluc2VydHMgYSBrZXkgdmFsdWUgaW50byB0aGUgc2VsZWN0b3IgZG9jdW1lbnRcbi8vIEhvd2V2ZXIsIHRoaXMgY2hlY2tzIHRoZXJlIGlzIG5vIGFtYmlndWl0eSBpbiBzZXR0aW5nXG4vLyB0aGUgdmFsdWUgZm9yIHRoZSBnaXZlbiBrZXksIHRocm93cyBvdGhlcndpc2VcbmZ1bmN0aW9uIGluc2VydEludG9Eb2N1bWVudChkb2N1bWVudCwga2V5LCB2YWx1ZSkge1xuICBPYmplY3Qua2V5cyhkb2N1bWVudCkuZm9yRWFjaChleGlzdGluZ0tleSA9PiB7XG4gICAgaWYgKFxuICAgICAgKGV4aXN0aW5nS2V5Lmxlbmd0aCA+IGtleS5sZW5ndGggJiYgZXhpc3RpbmdLZXkuaW5kZXhPZihgJHtrZXl9LmApID09PSAwKSB8fFxuICAgICAgKGtleS5sZW5ndGggPiBleGlzdGluZ0tleS5sZW5ndGggJiYga2V5LmluZGV4T2YoYCR7ZXhpc3RpbmdLZXl9LmApID09PSAwKVxuICAgICkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgY2Fubm90IGluZmVyIHF1ZXJ5IGZpZWxkcyB0byBzZXQsIGJvdGggcGF0aHMgJyR7ZXhpc3RpbmdLZXl9JyBhbmQgYCArXG4gICAgICAgIGAnJHtrZXl9JyBhcmUgbWF0Y2hlZGBcbiAgICAgICk7XG4gICAgfSBlbHNlIGlmIChleGlzdGluZ0tleSA9PT0ga2V5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBjYW5ub3QgaW5mZXIgcXVlcnkgZmllbGRzIHRvIHNldCwgcGF0aCAnJHtrZXl9JyBpcyBtYXRjaGVkIHR3aWNlYFxuICAgICAgKTtcbiAgICB9XG4gIH0pO1xuXG4gIGRvY3VtZW50W2tleV0gPSB2YWx1ZTtcbn1cblxuLy8gUmV0dXJucyBhIGJyYW5jaGVkIG1hdGNoZXIgdGhhdCBtYXRjaGVzIGlmZiB0aGUgZ2l2ZW4gbWF0Y2hlciBkb2VzIG5vdC5cbi8vIE5vdGUgdGhhdCB0aGlzIGltcGxpY2l0bHkgXCJkZU1vcmdhbml6ZXNcIiB0aGUgd3JhcHBlZCBmdW5jdGlvbi4gIGllLCBpdFxuLy8gbWVhbnMgdGhhdCBBTEwgYnJhbmNoIHZhbHVlcyBuZWVkIHRvIGZhaWwgdG8gbWF0Y2ggaW5uZXJCcmFuY2hlZE1hdGNoZXIuXG5mdW5jdGlvbiBpbnZlcnRCcmFuY2hlZE1hdGNoZXIoYnJhbmNoZWRNYXRjaGVyKSB7XG4gIHJldHVybiBicmFuY2hWYWx1ZXMgPT4ge1xuICAgIC8vIFdlIGV4cGxpY2l0bHkgY2hvb3NlIHRvIHN0cmlwIGFycmF5SW5kaWNlcyBoZXJlOiBpdCBkb2Vzbid0IG1ha2Ugc2Vuc2UgdG9cbiAgICAvLyBzYXkgXCJ1cGRhdGUgdGhlIGFycmF5IGVsZW1lbnQgdGhhdCBkb2VzIG5vdCBtYXRjaCBzb21ldGhpbmdcIiwgYXQgbGVhc3RcbiAgICAvLyBpbiBtb25nby1sYW5kLlxuICAgIHJldHVybiB7cmVzdWx0OiAhYnJhbmNoZWRNYXRjaGVyKGJyYW5jaFZhbHVlcykucmVzdWx0fTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzSW5kZXhhYmxlKG9iaikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShvYmopIHx8IExvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdChvYmopO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNOdW1lcmljS2V5KHMpIHtcbiAgcmV0dXJuIC9eWzAtOV0rJC8udGVzdChzKTtcbn1cblxuLy8gUmV0dXJucyB0cnVlIGlmIHRoaXMgaXMgYW4gb2JqZWN0IHdpdGggYXQgbGVhc3Qgb25lIGtleSBhbmQgYWxsIGtleXMgYmVnaW5cbi8vIHdpdGggJC4gIFVubGVzcyBpbmNvbnNpc3RlbnRPSyBpcyBzZXQsIHRocm93cyBpZiBzb21lIGtleXMgYmVnaW4gd2l0aCAkIGFuZFxuLy8gb3RoZXJzIGRvbid0LlxuZXhwb3J0IGZ1bmN0aW9uIGlzT3BlcmF0b3JPYmplY3QodmFsdWVTZWxlY3RvciwgaW5jb25zaXN0ZW50T0spIHtcbiAgaWYgKCFMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QodmFsdWVTZWxlY3RvcikpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBsZXQgdGhlc2VBcmVPcGVyYXRvcnMgPSB1bmRlZmluZWQ7XG4gIE9iamVjdC5rZXlzKHZhbHVlU2VsZWN0b3IpLmZvckVhY2goc2VsS2V5ID0+IHtcbiAgICBjb25zdCB0aGlzSXNPcGVyYXRvciA9IHNlbEtleS5zdWJzdHIoMCwgMSkgPT09ICckJyB8fCBzZWxLZXkgPT09ICdkaWZmJztcblxuICAgIGlmICh0aGVzZUFyZU9wZXJhdG9ycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGVzZUFyZU9wZXJhdG9ycyA9IHRoaXNJc09wZXJhdG9yO1xuICAgIH0gZWxzZSBpZiAodGhlc2VBcmVPcGVyYXRvcnMgIT09IHRoaXNJc09wZXJhdG9yKSB7XG4gICAgICBpZiAoIWluY29uc2lzdGVudE9LKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgSW5jb25zaXN0ZW50IG9wZXJhdG9yOiAke0pTT04uc3RyaW5naWZ5KHZhbHVlU2VsZWN0b3IpfWBcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgdGhlc2VBcmVPcGVyYXRvcnMgPSBmYWxzZTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiAhIXRoZXNlQXJlT3BlcmF0b3JzOyAvLyB7fSBoYXMgbm8gb3BlcmF0b3JzXG59XG5cbi8vIEhlbHBlciBmb3IgJGx0LyRndC8kbHRlLyRndGUuXG5mdW5jdGlvbiBtYWtlSW5lcXVhbGl0eShjbXBWYWx1ZUNvbXBhcmF0b3IpIHtcbiAgcmV0dXJuIHtcbiAgICBjb21waWxlRWxlbWVudFNlbGVjdG9yKG9wZXJhbmQpIHtcbiAgICAgIC8vIEFycmF5cyBuZXZlciBjb21wYXJlIGZhbHNlIHdpdGggbm9uLWFycmF5cyBmb3IgYW55IGluZXF1YWxpdHkuXG4gICAgICAvLyBYWFggVGhpcyB3YXMgYmVoYXZpb3Igd2Ugb2JzZXJ2ZWQgaW4gcHJlLXJlbGVhc2UgTW9uZ29EQiAyLjUsIGJ1dFxuICAgICAgLy8gICAgIGl0IHNlZW1zIHRvIGhhdmUgYmVlbiByZXZlcnRlZC5cbiAgICAgIC8vICAgICBTZWUgaHR0cHM6Ly9qaXJhLm1vbmdvZGIub3JnL2Jyb3dzZS9TRVJWRVItMTE0NDRcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG9wZXJhbmQpKSB7XG4gICAgICAgIHJldHVybiAoKSA9PiBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gU3BlY2lhbCBjYXNlOiBjb25zaWRlciB1bmRlZmluZWQgYW5kIG51bGwgdGhlIHNhbWUgKHNvIHRydWUgd2l0aFxuICAgICAgLy8gJGd0ZS8kbHRlKS5cbiAgICAgIGlmIChvcGVyYW5kID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgb3BlcmFuZCA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9wZXJhbmRUeXBlID0gTG9jYWxDb2xsZWN0aW9uLl9mLl90eXBlKG9wZXJhbmQpO1xuXG4gICAgICByZXR1cm4gdmFsdWUgPT4ge1xuICAgICAgICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENvbXBhcmlzb25zIGFyZSBuZXZlciB0cnVlIGFtb25nIHRoaW5ncyBvZiBkaWZmZXJlbnQgdHlwZSAoZXhjZXB0XG4gICAgICAgIC8vIG51bGwgdnMgdW5kZWZpbmVkKS5cbiAgICAgICAgaWYgKExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZSh2YWx1ZSkgIT09IG9wZXJhbmRUeXBlKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNtcFZhbHVlQ29tcGFyYXRvcihMb2NhbENvbGxlY3Rpb24uX2YuX2NtcCh2YWx1ZSwgb3BlcmFuZCkpO1xuICAgICAgfTtcbiAgICB9LFxuICB9O1xufVxuXG4vLyBtYWtlTG9va3VwRnVuY3Rpb24oa2V5KSByZXR1cm5zIGEgbG9va3VwIGZ1bmN0aW9uLlxuLy9cbi8vIEEgbG9va3VwIGZ1bmN0aW9uIHRha2VzIGluIGEgZG9jdW1lbnQgYW5kIHJldHVybnMgYW4gYXJyYXkgb2YgbWF0Y2hpbmdcbi8vIGJyYW5jaGVzLiAgSWYgbm8gYXJyYXlzIGFyZSBmb3VuZCB3aGlsZSBsb29raW5nIHVwIHRoZSBrZXksIHRoaXMgYXJyYXkgd2lsbFxuLy8gaGF2ZSBleGFjdGx5IG9uZSBicmFuY2hlcyAocG9zc2libHkgJ3VuZGVmaW5lZCcsIGlmIHNvbWUgc2VnbWVudCBvZiB0aGUga2V5XG4vLyB3YXMgbm90IGZvdW5kKS5cbi8vXG4vLyBJZiBhcnJheXMgYXJlIGZvdW5kIGluIHRoZSBtaWRkbGUsIHRoaXMgY2FuIGhhdmUgbW9yZSB0aGFuIG9uZSBlbGVtZW50LCBzaW5jZVxuLy8gd2UgJ2JyYW5jaCcuIFdoZW4gd2UgJ2JyYW5jaCcsIGlmIHRoZXJlIGFyZSBtb3JlIGtleSBzZWdtZW50cyB0byBsb29rIHVwLFxuLy8gdGhlbiB3ZSBvbmx5IHB1cnN1ZSBicmFuY2hlcyB0aGF0IGFyZSBwbGFpbiBvYmplY3RzIChub3QgYXJyYXlzIG9yIHNjYWxhcnMpLlxuLy8gVGhpcyBtZWFucyB3ZSBjYW4gYWN0dWFsbHkgZW5kIHVwIHdpdGggbm8gYnJhbmNoZXMhXG4vL1xuLy8gV2UgZG8gKk5PVCogYnJhbmNoIG9uIGFycmF5cyB0aGF0IGFyZSBmb3VuZCBhdCB0aGUgZW5kIChpZSwgYXQgdGhlIGxhc3Rcbi8vIGRvdHRlZCBtZW1iZXIgb2YgdGhlIGtleSkuIFdlIGp1c3QgcmV0dXJuIHRoYXQgYXJyYXk7IGlmIHlvdSB3YW50IHRvXG4vLyBlZmZlY3RpdmVseSAnYnJhbmNoJyBvdmVyIHRoZSBhcnJheSdzIHZhbHVlcywgcG9zdC1wcm9jZXNzIHRoZSBsb29rdXBcbi8vIGZ1bmN0aW9uIHdpdGggZXhwYW5kQXJyYXlzSW5CcmFuY2hlcy5cbi8vXG4vLyBFYWNoIGJyYW5jaCBpcyBhbiBvYmplY3Qgd2l0aCBrZXlzOlxuLy8gIC0gdmFsdWU6IHRoZSB2YWx1ZSBhdCB0aGUgYnJhbmNoXG4vLyAgLSBkb250SXRlcmF0ZTogYW4gb3B0aW9uYWwgYm9vbDsgaWYgdHJ1ZSwgaXQgbWVhbnMgdGhhdCAndmFsdWUnIGlzIGFuIGFycmF5XG4vLyAgICB0aGF0IGV4cGFuZEFycmF5c0luQnJhbmNoZXMgc2hvdWxkIE5PVCBleHBhbmQuIFRoaXMgc3BlY2lmaWNhbGx5IGhhcHBlbnNcbi8vICAgIHdoZW4gdGhlcmUgaXMgYSBudW1lcmljIGluZGV4IGluIHRoZSBrZXksIGFuZCBlbnN1cmVzIHRoZVxuLy8gICAgcGVyaGFwcy1zdXJwcmlzaW5nIE1vbmdvREIgYmVoYXZpb3Igd2hlcmUgeydhLjAnOiA1fSBkb2VzIE5PVFxuLy8gICAgbWF0Y2gge2E6IFtbNV1dfS5cbi8vICAtIGFycmF5SW5kaWNlczogaWYgYW55IGFycmF5IGluZGV4aW5nIHdhcyBkb25lIGR1cmluZyBsb29rdXAgKGVpdGhlciBkdWUgdG9cbi8vICAgIGV4cGxpY2l0IG51bWVyaWMgaW5kaWNlcyBvciBpbXBsaWNpdCBicmFuY2hpbmcpLCB0aGlzIHdpbGwgYmUgYW4gYXJyYXkgb2Zcbi8vICAgIHRoZSBhcnJheSBpbmRpY2VzIHVzZWQsIGZyb20gb3V0ZXJtb3N0IHRvIGlubmVybW9zdDsgaXQgaXMgZmFsc2V5IG9yXG4vLyAgICBhYnNlbnQgaWYgbm8gYXJyYXkgaW5kZXggaXMgdXNlZC4gSWYgYW4gZXhwbGljaXQgbnVtZXJpYyBpbmRleCBpcyB1c2VkLFxuLy8gICAgdGhlIGluZGV4IHdpbGwgYmUgZm9sbG93ZWQgaW4gYXJyYXlJbmRpY2VzIGJ5IHRoZSBzdHJpbmcgJ3gnLlxuLy9cbi8vICAgIE5vdGU6IGFycmF5SW5kaWNlcyBpcyB1c2VkIGZvciB0d28gcHVycG9zZXMuIEZpcnN0LCBpdCBpcyB1c2VkIHRvXG4vLyAgICBpbXBsZW1lbnQgdGhlICckJyBtb2RpZmllciBmZWF0dXJlLCB3aGljaCBvbmx5IGV2ZXIgbG9va3MgYXQgaXRzIGZpcnN0XG4vLyAgICBlbGVtZW50LlxuLy9cbi8vICAgIFNlY29uZCwgaXQgaXMgdXNlZCBmb3Igc29ydCBrZXkgZ2VuZXJhdGlvbiwgd2hpY2ggbmVlZHMgdG8gYmUgYWJsZSB0byB0ZWxsXG4vLyAgICB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIGRpZmZlcmVudCBwYXRocy4gTW9yZW92ZXIsIGl0IG5lZWRzIHRvXG4vLyAgICBkaWZmZXJlbnRpYXRlIGJldHdlZW4gZXhwbGljaXQgYW5kIGltcGxpY2l0IGJyYW5jaGluZywgd2hpY2ggaXMgd2h5XG4vLyAgICB0aGVyZSdzIHRoZSBzb21ld2hhdCBoYWNreSAneCcgZW50cnk6IHRoaXMgbWVhbnMgdGhhdCBleHBsaWNpdCBhbmRcbi8vICAgIGltcGxpY2l0IGFycmF5IGxvb2t1cHMgd2lsbCBoYXZlIGRpZmZlcmVudCBmdWxsIGFycmF5SW5kaWNlcyBwYXRocy4gKFRoYXRcbi8vICAgIGNvZGUgb25seSByZXF1aXJlcyB0aGF0IGRpZmZlcmVudCBwYXRocyBoYXZlIGRpZmZlcmVudCBhcnJheUluZGljZXM7IGl0XG4vLyAgICBkb2Vzbid0IGFjdHVhbGx5ICdwYXJzZScgYXJyYXlJbmRpY2VzLiBBcyBhbiBhbHRlcm5hdGl2ZSwgYXJyYXlJbmRpY2VzXG4vLyAgICBjb3VsZCBjb250YWluIG9iamVjdHMgd2l0aCBmbGFncyBsaWtlICdpbXBsaWNpdCcsIGJ1dCBJIHRoaW5rIHRoYXQgb25seVxuLy8gICAgbWFrZXMgdGhlIGNvZGUgc3Vycm91bmRpbmcgdGhlbSBtb3JlIGNvbXBsZXguKVxuLy9cbi8vICAgIChCeSB0aGUgd2F5LCB0aGlzIGZpZWxkIGVuZHMgdXAgZ2V0dGluZyBwYXNzZWQgYXJvdW5kIGEgbG90IHdpdGhvdXRcbi8vICAgIGNsb25pbmcsIHNvIG5ldmVyIG11dGF0ZSBhbnkgYXJyYXlJbmRpY2VzIGZpZWxkL3ZhciBpbiB0aGlzIHBhY2thZ2UhKVxuLy9cbi8vXG4vLyBBdCB0aGUgdG9wIGxldmVsLCB5b3UgbWF5IG9ubHkgcGFzcyBpbiBhIHBsYWluIG9iamVjdCBvciBhcnJheS5cbi8vXG4vLyBTZWUgdGhlIHRlc3QgJ21pbmltb25nbyAtIGxvb2t1cCcgZm9yIHNvbWUgZXhhbXBsZXMgb2Ygd2hhdCBsb29rdXAgZnVuY3Rpb25zXG4vLyByZXR1cm4uXG5leHBvcnQgZnVuY3Rpb24gbWFrZUxvb2t1cEZ1bmN0aW9uKGtleSwgb3B0aW9ucyA9IHt9KSB7XG4gIGNvbnN0IHBhcnRzID0ga2V5LnNwbGl0KCcuJyk7XG4gIGNvbnN0IGZpcnN0UGFydCA9IHBhcnRzLmxlbmd0aCA/IHBhcnRzWzBdIDogJyc7XG4gIGNvbnN0IGxvb2t1cFJlc3QgPSAoXG4gICAgcGFydHMubGVuZ3RoID4gMSAmJlxuICAgIG1ha2VMb29rdXBGdW5jdGlvbihwYXJ0cy5zbGljZSgxKS5qb2luKCcuJyksIG9wdGlvbnMpXG4gICk7XG5cbiAgZnVuY3Rpb24gYnVpbGRSZXN1bHQoYXJyYXlJbmRpY2VzLCBkb250SXRlcmF0ZSwgdmFsdWUpIHtcbiAgICByZXR1cm4gYXJyYXlJbmRpY2VzICYmIGFycmF5SW5kaWNlcy5sZW5ndGhcbiAgICAgID8gZG9udEl0ZXJhdGVcbiAgICAgICAgPyBbeyBhcnJheUluZGljZXMsIGRvbnRJdGVyYXRlLCB2YWx1ZSB9XVxuICAgICAgICA6IFt7IGFycmF5SW5kaWNlcywgdmFsdWUgfV1cbiAgICAgIDogZG9udEl0ZXJhdGVcbiAgICAgICAgPyBbeyBkb250SXRlcmF0ZSwgdmFsdWUgfV1cbiAgICAgICAgOiBbeyB2YWx1ZSB9XTtcbiAgfVxuXG4gIC8vIERvYyB3aWxsIGFsd2F5cyBiZSBhIHBsYWluIG9iamVjdCBvciBhbiBhcnJheS5cbiAgLy8gYXBwbHkgYW4gZXhwbGljaXQgbnVtZXJpYyBpbmRleCwgYW4gYXJyYXkuXG4gIHJldHVybiAoZG9jLCBhcnJheUluZGljZXMpID0+IHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShkb2MpKSB7XG4gICAgICAvLyBJZiB3ZSdyZSBiZWluZyBhc2tlZCB0byBkbyBhbiBpbnZhbGlkIGxvb2t1cCBpbnRvIGFuIGFycmF5IChub24taW50ZWdlclxuICAgICAgLy8gb3Igb3V0LW9mLWJvdW5kcyksIHJldHVybiBubyByZXN1bHRzICh3aGljaCBpcyBkaWZmZXJlbnQgZnJvbSByZXR1cm5pbmdcbiAgICAgIC8vIGEgc2luZ2xlIHVuZGVmaW5lZCByZXN1bHQsIGluIHRoYXQgYG51bGxgIGVxdWFsaXR5IGNoZWNrcyB3b24ndCBtYXRjaCkuXG4gICAgICBpZiAoIShpc051bWVyaWNLZXkoZmlyc3RQYXJ0KSAmJiBmaXJzdFBhcnQgPCBkb2MubGVuZ3RoKSkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG5cbiAgICAgIC8vIFJlbWVtYmVyIHRoYXQgd2UgdXNlZCB0aGlzIGFycmF5IGluZGV4LiBJbmNsdWRlIGFuICd4JyB0byBpbmRpY2F0ZSB0aGF0XG4gICAgICAvLyB0aGUgcHJldmlvdXMgaW5kZXggY2FtZSBmcm9tIGJlaW5nIGNvbnNpZGVyZWQgYXMgYW4gZXhwbGljaXQgYXJyYXlcbiAgICAgIC8vIGluZGV4IChub3QgYnJhbmNoaW5nKS5cbiAgICAgIGFycmF5SW5kaWNlcyA9IGFycmF5SW5kaWNlcyA/IGFycmF5SW5kaWNlcy5jb25jYXQoK2ZpcnN0UGFydCwgJ3gnKSA6IFsrZmlyc3RQYXJ0LCAneCddO1xuICAgIH1cblxuICAgIC8vIERvIG91ciBmaXJzdCBsb29rdXAuXG4gICAgY29uc3QgZmlyc3RMZXZlbCA9IGRvY1tmaXJzdFBhcnRdO1xuXG4gICAgLy8gSWYgdGhlcmUgaXMgbm8gZGVlcGVyIHRvIGRpZywgcmV0dXJuIHdoYXQgd2UgZm91bmQuXG4gICAgLy9cbiAgICAvLyBJZiB3aGF0IHdlIGZvdW5kIGlzIGFuIGFycmF5LCBtb3N0IHZhbHVlIHNlbGVjdG9ycyB3aWxsIGNob29zZSB0byB0cmVhdFxuICAgIC8vIHRoZSBlbGVtZW50cyBvZiB0aGUgYXJyYXkgYXMgbWF0Y2hhYmxlIHZhbHVlcyBpbiB0aGVpciBvd24gcmlnaHQsIGJ1dFxuICAgIC8vIHRoYXQncyBkb25lIG91dHNpZGUgb2YgdGhlIGxvb2t1cCBmdW5jdGlvbi4gKEV4Y2VwdGlvbnMgdG8gdGhpcyBhcmUgJHNpemVcbiAgICAvLyBhbmQgc3R1ZmYgcmVsYXRpbmcgdG8gJGVsZW1NYXRjaC4gIGVnLCB7YTogeyRzaXplOiAyfX0gZG9lcyBub3QgbWF0Y2gge2E6XG4gICAgLy8gW1sxLCAyXV19LilcbiAgICAvL1xuICAgIC8vIFRoYXQgc2FpZCwgaWYgd2UganVzdCBkaWQgYW4gKmV4cGxpY2l0KiBhcnJheSBsb29rdXAgKG9uIGRvYykgdG8gZmluZFxuICAgIC8vIGZpcnN0TGV2ZWwsIGFuZCBmaXJzdExldmVsIGlzIGFuIGFycmF5IHRvbywgd2UgZG8gTk9UIHdhbnQgdmFsdWVcbiAgICAvLyBzZWxlY3RvcnMgdG8gaXRlcmF0ZSBvdmVyIGl0LiAgZWcsIHsnYS4wJzogNX0gZG9lcyBub3QgbWF0Y2gge2E6IFtbNV1dfS5cbiAgICAvLyBTbyBpbiB0aGF0IGNhc2UsIHdlIG1hcmsgdGhlIHJldHVybiB2YWx1ZSBhcyAnZG9uJ3QgaXRlcmF0ZScuXG4gICAgaWYgKCFsb29rdXBSZXN0KSB7XG4gICAgICByZXR1cm4gYnVpbGRSZXN1bHQoXG4gICAgICAgIGFycmF5SW5kaWNlcyxcbiAgICAgICAgQXJyYXkuaXNBcnJheShkb2MpICYmIEFycmF5LmlzQXJyYXkoZmlyc3RMZXZlbCksXG4gICAgICAgIGZpcnN0TGV2ZWwsXG4gICAgICApO1xuICAgIH1cblxuICAgIC8vIFdlIG5lZWQgdG8gZGlnIGRlZXBlci4gIEJ1dCBpZiB3ZSBjYW4ndCwgYmVjYXVzZSB3aGF0IHdlJ3ZlIGZvdW5kIGlzIG5vdFxuICAgIC8vIGFuIGFycmF5IG9yIHBsYWluIG9iamVjdCwgd2UncmUgZG9uZS4gSWYgd2UganVzdCBkaWQgYSBudW1lcmljIGluZGV4IGludG9cbiAgICAvLyBhbiBhcnJheSwgd2UgcmV0dXJuIG5vdGhpbmcgaGVyZSAodGhpcyBpcyBhIGNoYW5nZSBpbiBNb25nbyAyLjUgZnJvbVxuICAgIC8vIE1vbmdvIDIuNCwgd2hlcmUgeydhLjAuYic6IG51bGx9IHN0b3BwZWQgbWF0Y2hpbmcge2E6IFs1XX0pLiBPdGhlcndpc2UsXG4gICAgLy8gcmV0dXJuIGEgc2luZ2xlIGB1bmRlZmluZWRgICh3aGljaCBjYW4sIGZvciBleGFtcGxlLCBtYXRjaCB2aWEgZXF1YWxpdHlcbiAgICAvLyB3aXRoIGBudWxsYCkuXG4gICAgaWYgKCFpc0luZGV4YWJsZShmaXJzdExldmVsKSkge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZG9jKSkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBidWlsZFJlc3VsdChhcnJheUluZGljZXMsIGZhbHNlLCB1bmRlZmluZWQpO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuICAgIGNvbnN0IGFwcGVuZFRvUmVzdWx0ID0gbW9yZSA9PiB7XG4gICAgICByZXN1bHQucHVzaCguLi5tb3JlKTtcbiAgICB9O1xuXG4gICAgLy8gRGlnIGRlZXBlcjogbG9vayB1cCB0aGUgcmVzdCBvZiB0aGUgcGFydHMgb24gd2hhdGV2ZXIgd2UndmUgZm91bmQuXG4gICAgLy8gKGxvb2t1cFJlc3QgaXMgc21hcnQgZW5vdWdoIHRvIG5vdCB0cnkgdG8gZG8gaW52YWxpZCBsb29rdXBzIGludG9cbiAgICAvLyBmaXJzdExldmVsIGlmIGl0J3MgYW4gYXJyYXkuKVxuICAgIGFwcGVuZFRvUmVzdWx0KGxvb2t1cFJlc3QoZmlyc3RMZXZlbCwgYXJyYXlJbmRpY2VzKSk7XG5cbiAgICAvLyBJZiB3ZSBmb3VuZCBhbiBhcnJheSwgdGhlbiBpbiAqYWRkaXRpb24qIHRvIHBvdGVudGlhbGx5IHRyZWF0aW5nIHRoZSBuZXh0XG4gICAgLy8gcGFydCBhcyBhIGxpdGVyYWwgaW50ZWdlciBsb29rdXAsIHdlIHNob3VsZCBhbHNvICdicmFuY2gnOiB0cnkgdG8gbG9vayB1cFxuICAgIC8vIHRoZSByZXN0IG9mIHRoZSBwYXJ0cyBvbiBlYWNoIGFycmF5IGVsZW1lbnQgaW4gcGFyYWxsZWwuXG4gICAgLy9cbiAgICAvLyBJbiB0aGlzIGNhc2UsIHdlICpvbmx5KiBkaWcgZGVlcGVyIGludG8gYXJyYXkgZWxlbWVudHMgdGhhdCBhcmUgcGxhaW5cbiAgICAvLyBvYmplY3RzLiAoUmVjYWxsIHRoYXQgd2Ugb25seSBnb3QgdGhpcyBmYXIgaWYgd2UgaGF2ZSBmdXJ0aGVyIHRvIGRpZy4pXG4gICAgLy8gVGhpcyBtYWtlcyBzZW5zZTogd2UgY2VydGFpbmx5IGRvbid0IGRpZyBkZWVwZXIgaW50byBub24taW5kZXhhYmxlXG4gICAgLy8gb2JqZWN0cy4gQW5kIGl0IHdvdWxkIGJlIHdlaXJkIHRvIGRpZyBpbnRvIGFuIGFycmF5OiBpdCdzIHNpbXBsZXIgdG8gaGF2ZVxuICAgIC8vIGEgcnVsZSB0aGF0IGV4cGxpY2l0IGludGVnZXIgaW5kZXhlcyBvbmx5IGFwcGx5IHRvIGFuIG91dGVyIGFycmF5LCBub3QgdG9cbiAgICAvLyBhbiBhcnJheSB5b3UgZmluZCBhZnRlciBhIGJyYW5jaGluZyBzZWFyY2guXG4gICAgLy9cbiAgICAvLyBJbiB0aGUgc3BlY2lhbCBjYXNlIG9mIGEgbnVtZXJpYyBwYXJ0IGluIGEgKnNvcnQgc2VsZWN0b3IqIChub3QgYSBxdWVyeVxuICAgIC8vIHNlbGVjdG9yKSwgd2Ugc2tpcCB0aGUgYnJhbmNoaW5nOiB3ZSBPTkxZIGFsbG93IHRoZSBudW1lcmljIHBhcnQgdG8gbWVhblxuICAgIC8vICdsb29rIHVwIHRoaXMgaW5kZXgnIGluIHRoYXQgY2FzZSwgbm90ICdhbHNvIGxvb2sgdXAgdGhpcyBpbmRleCBpbiBhbGxcbiAgICAvLyB0aGUgZWxlbWVudHMgb2YgdGhlIGFycmF5Jy5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShmaXJzdExldmVsKSAmJlxuICAgICAgICAhKGlzTnVtZXJpY0tleShwYXJ0c1sxXSkgJiYgb3B0aW9ucy5mb3JTb3J0KSkge1xuICAgICAgZmlyc3RMZXZlbC5mb3JFYWNoKChicmFuY2gsIGFycmF5SW5kZXgpID0+IHtcbiAgICAgICAgaWYgKExvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdChicmFuY2gpKSB7XG4gICAgICAgICAgYXBwZW5kVG9SZXN1bHQobG9va3VwUmVzdChicmFuY2gsIGFycmF5SW5kaWNlcyA/IGFycmF5SW5kaWNlcy5jb25jYXQoYXJyYXlJbmRleCkgOiBbYXJyYXlJbmRleF0pKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbn1cblxuLy8gT2JqZWN0IGV4cG9ydGVkIG9ubHkgZm9yIHVuaXQgdGVzdGluZy5cbi8vIFVzZSBpdCB0byBleHBvcnQgcHJpdmF0ZSBmdW5jdGlvbnMgdG8gdGVzdCBpbiBUaW55dGVzdC5cbk1pbmltb25nb1Rlc3QgPSB7bWFrZUxvb2t1cEZ1bmN0aW9ufTtcbk1pbmltb25nb0Vycm9yID0gKG1lc3NhZ2UsIG9wdGlvbnMgPSB7fSkgPT4ge1xuICBpZiAodHlwZW9mIG1lc3NhZ2UgPT09ICdzdHJpbmcnICYmIG9wdGlvbnMuZmllbGQpIHtcbiAgICBtZXNzYWdlICs9IGAgZm9yIGZpZWxkICcke29wdGlvbnMuZmllbGR9J2A7XG4gIH1cblxuICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgZXJyb3IubmFtZSA9ICdNaW5pbW9uZ29FcnJvcic7XG4gIHJldHVybiBlcnJvcjtcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiBub3RoaW5nTWF0Y2hlcihkb2NPckJyYW5jaGVkVmFsdWVzKSB7XG4gIHJldHVybiB7cmVzdWx0OiBmYWxzZX07XG59XG5cbi8vIFRha2VzIGFuIG9wZXJhdG9yIG9iamVjdCAoYW4gb2JqZWN0IHdpdGggJCBrZXlzKSBhbmQgcmV0dXJucyBhIGJyYW5jaGVkXG4vLyBtYXRjaGVyIGZvciBpdC5cbmZ1bmN0aW9uIG9wZXJhdG9yQnJhbmNoZWRNYXRjaGVyKHZhbHVlU2VsZWN0b3IsIG1hdGNoZXIsIGlzUm9vdCkge1xuICAvLyBFYWNoIHZhbHVlU2VsZWN0b3Igd29ya3Mgc2VwYXJhdGVseSBvbiB0aGUgdmFyaW91cyBicmFuY2hlcy4gIFNvIG9uZVxuICAvLyBvcGVyYXRvciBjYW4gbWF0Y2ggb25lIGJyYW5jaCBhbmQgYW5vdGhlciBjYW4gbWF0Y2ggYW5vdGhlciBicmFuY2guICBUaGlzXG4gIC8vIGlzIE9LLlxuICBjb25zdCBvcGVyYXRvck1hdGNoZXJzID0gT2JqZWN0LmtleXModmFsdWVTZWxlY3RvcikubWFwKG9wZXJhdG9yID0+IHtcbiAgICBjb25zdCBvcGVyYW5kID0gdmFsdWVTZWxlY3RvcltvcGVyYXRvcl07XG5cbiAgICBjb25zdCBzaW1wbGVSYW5nZSA9IChcbiAgICAgIFsnJGx0JywgJyRsdGUnLCAnJGd0JywgJyRndGUnXS5pbmNsdWRlcyhvcGVyYXRvcikgJiZcbiAgICAgIHR5cGVvZiBvcGVyYW5kID09PSAnbnVtYmVyJ1xuICAgICk7XG5cbiAgICBjb25zdCBzaW1wbGVFcXVhbGl0eSA9IChcbiAgICAgIFsnJG5lJywgJyRlcSddLmluY2x1ZGVzKG9wZXJhdG9yKSAmJlxuICAgICAgb3BlcmFuZCAhPT0gT2JqZWN0KG9wZXJhbmQpXG4gICAgKTtcblxuICAgIGNvbnN0IHNpbXBsZUluY2x1c2lvbiA9IChcbiAgICAgIFsnJGluJywgJyRuaW4nXS5pbmNsdWRlcyhvcGVyYXRvcilcbiAgICAgICYmIEFycmF5LmlzQXJyYXkob3BlcmFuZClcbiAgICAgICYmICFvcGVyYW5kLnNvbWUoeCA9PiB4ID09PSBPYmplY3QoeCkpXG4gICAgKTtcblxuICAgIGlmICghKHNpbXBsZVJhbmdlIHx8IHNpbXBsZUluY2x1c2lvbiB8fCBzaW1wbGVFcXVhbGl0eSkpIHtcbiAgICAgIG1hdGNoZXIuX2lzU2ltcGxlID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKGhhc093bi5jYWxsKFZBTFVFX09QRVJBVE9SUywgb3BlcmF0b3IpKSB7XG4gICAgICByZXR1cm4gVkFMVUVfT1BFUkFUT1JTW29wZXJhdG9yXShvcGVyYW5kLCB2YWx1ZVNlbGVjdG9yLCBtYXRjaGVyLCBpc1Jvb3QpO1xuICAgIH1cblxuICAgIGlmIChoYXNPd24uY2FsbChFTEVNRU5UX09QRVJBVE9SUywgb3BlcmF0b3IpKSB7XG4gICAgICBjb25zdCBvcHRpb25zID0gRUxFTUVOVF9PUEVSQVRPUlNbb3BlcmF0b3JdO1xuICAgICAgcmV0dXJuIGNvbnZlcnRFbGVtZW50TWF0Y2hlclRvQnJhbmNoZWRNYXRjaGVyKFxuICAgICAgICBvcHRpb25zLmNvbXBpbGVFbGVtZW50U2VsZWN0b3Iob3BlcmFuZCwgdmFsdWVTZWxlY3RvciwgbWF0Y2hlciksXG4gICAgICAgIG9wdGlvbnNcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGBVbnJlY29nbml6ZWQgb3BlcmF0b3I6ICR7b3BlcmF0b3J9YCk7XG4gIH0pO1xuXG4gIHJldHVybiBhbmRCcmFuY2hlZE1hdGNoZXJzKG9wZXJhdG9yTWF0Y2hlcnMpO1xufVxuXG4vLyBwYXRocyAtIEFycmF5OiBsaXN0IG9mIG1vbmdvIHN0eWxlIHBhdGhzXG4vLyBuZXdMZWFmRm4gLSBGdW5jdGlvbjogb2YgZm9ybSBmdW5jdGlvbihwYXRoKSBzaG91bGQgcmV0dXJuIGEgc2NhbGFyIHZhbHVlIHRvXG4vLyAgICAgICAgICAgICAgICAgICAgICAgcHV0IGludG8gbGlzdCBjcmVhdGVkIGZvciB0aGF0IHBhdGhcbi8vIGNvbmZsaWN0Rm4gLSBGdW5jdGlvbjogb2YgZm9ybSBmdW5jdGlvbihub2RlLCBwYXRoLCBmdWxsUGF0aCkgaXMgY2FsbGVkXG4vLyAgICAgICAgICAgICAgICAgICAgICAgIHdoZW4gYnVpbGRpbmcgYSB0cmVlIHBhdGggZm9yICdmdWxsUGF0aCcgbm9kZSBvblxuLy8gICAgICAgICAgICAgICAgICAgICAgICAncGF0aCcgd2FzIGFscmVhZHkgYSBsZWFmIHdpdGggYSB2YWx1ZS4gTXVzdCByZXR1cm4gYVxuLy8gICAgICAgICAgICAgICAgICAgICAgICBjb25mbGljdCByZXNvbHV0aW9uLlxuLy8gaW5pdGlhbCB0cmVlIC0gT3B0aW9uYWwgT2JqZWN0OiBzdGFydGluZyB0cmVlLlxuLy8gQHJldHVybnMgLSBPYmplY3Q6IHRyZWUgcmVwcmVzZW50ZWQgYXMgYSBzZXQgb2YgbmVzdGVkIG9iamVjdHNcbmV4cG9ydCBmdW5jdGlvbiBwYXRoc1RvVHJlZShwYXRocywgbmV3TGVhZkZuLCBjb25mbGljdEZuLCByb290ID0ge30pIHtcbiAgcGF0aHMuZm9yRWFjaChwYXRoID0+IHtcbiAgICBjb25zdCBwYXRoQXJyYXkgPSBwYXRoLnNwbGl0KCcuJyk7XG4gICAgbGV0IHRyZWUgPSByb290O1xuXG4gICAgLy8gdXNlIC5ldmVyeSBqdXN0IGZvciBpdGVyYXRpb24gd2l0aCBicmVha1xuICAgIGNvbnN0IHN1Y2Nlc3MgPSBwYXRoQXJyYXkuc2xpY2UoMCwgLTEpLmV2ZXJ5KChrZXksIGkpID0+IHtcbiAgICAgIGlmICghaGFzT3duLmNhbGwodHJlZSwga2V5KSkge1xuICAgICAgICB0cmVlW2tleV0gPSB7fTtcbiAgICAgIH0gZWxzZSBpZiAodHJlZVtrZXldICE9PSBPYmplY3QodHJlZVtrZXldKSkge1xuICAgICAgICB0cmVlW2tleV0gPSBjb25mbGljdEZuKFxuICAgICAgICAgIHRyZWVba2V5XSxcbiAgICAgICAgICBwYXRoQXJyYXkuc2xpY2UoMCwgaSArIDEpLmpvaW4oJy4nKSxcbiAgICAgICAgICBwYXRoXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gYnJlYWsgb3V0IG9mIGxvb3AgaWYgd2UgYXJlIGZhaWxpbmcgZm9yIHRoaXMgcGF0aFxuICAgICAgICBpZiAodHJlZVtrZXldICE9PSBPYmplY3QodHJlZVtrZXldKSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0cmVlID0gdHJlZVtrZXldO1xuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcblxuICAgIGlmIChzdWNjZXNzKSB7XG4gICAgICBjb25zdCBsYXN0S2V5ID0gcGF0aEFycmF5W3BhdGhBcnJheS5sZW5ndGggLSAxXTtcbiAgICAgIGlmIChoYXNPd24uY2FsbCh0cmVlLCBsYXN0S2V5KSkge1xuICAgICAgICB0cmVlW2xhc3RLZXldID0gY29uZmxpY3RGbih0cmVlW2xhc3RLZXldLCBwYXRoLCBwYXRoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRyZWVbbGFzdEtleV0gPSBuZXdMZWFmRm4ocGF0aCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcm9vdDtcbn1cblxuLy8gTWFrZXMgc3VyZSB3ZSBnZXQgMiBlbGVtZW50cyBhcnJheSBhbmQgYXNzdW1lIHRoZSBmaXJzdCBvbmUgdG8gYmUgeCBhbmRcbi8vIHRoZSBzZWNvbmQgb25lIHRvIHkgbm8gbWF0dGVyIHdoYXQgdXNlciBwYXNzZXMuXG4vLyBJbiBjYXNlIHVzZXIgcGFzc2VzIHsgbG9uOiB4LCBsYXQ6IHkgfSByZXR1cm5zIFt4LCB5XVxuZnVuY3Rpb24gcG9pbnRUb0FycmF5KHBvaW50KSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KHBvaW50KSA/IHBvaW50LnNsaWNlKCkgOiBbcG9pbnQueCwgcG9pbnQueV07XG59XG5cbi8vIENyZWF0aW5nIGEgZG9jdW1lbnQgZnJvbSBhbiB1cHNlcnQgaXMgcXVpdGUgdHJpY2t5LlxuLy8gRS5nLiB0aGlzIHNlbGVjdG9yOiB7XCIkb3JcIjogW3tcImIuZm9vXCI6IHtcIiRhbGxcIjogW1wiYmFyXCJdfX1dfSwgc2hvdWxkIHJlc3VsdFxuLy8gaW46IHtcImIuZm9vXCI6IFwiYmFyXCJ9XG4vLyBCdXQgdGhpcyBzZWxlY3Rvcjoge1wiJG9yXCI6IFt7XCJiXCI6IHtcImZvb1wiOiB7XCIkYWxsXCI6IFtcImJhclwiXX19fV19IHNob3VsZCB0aHJvd1xuLy8gYW4gZXJyb3JcblxuLy8gU29tZSBydWxlcyAoZm91bmQgbWFpbmx5IHdpdGggdHJpYWwgJiBlcnJvciwgc28gdGhlcmUgbWlnaHQgYmUgbW9yZSk6XG4vLyAtIGhhbmRsZSBhbGwgY2hpbGRzIG9mICRhbmQgKG9yIGltcGxpY2l0ICRhbmQpXG4vLyAtIGhhbmRsZSAkb3Igbm9kZXMgd2l0aCBleGFjdGx5IDEgY2hpbGRcbi8vIC0gaWdub3JlICRvciBub2RlcyB3aXRoIG1vcmUgdGhhbiAxIGNoaWxkXG4vLyAtIGlnbm9yZSAkbm9yIGFuZCAkbm90IG5vZGVzXG4vLyAtIHRocm93IHdoZW4gYSB2YWx1ZSBjYW4gbm90IGJlIHNldCB1bmFtYmlndW91c2x5XG4vLyAtIGV2ZXJ5IHZhbHVlIGZvciAkYWxsIHNob3VsZCBiZSBkZWFsdCB3aXRoIGFzIHNlcGFyYXRlICRlcS1zXG4vLyAtIHRocmVhdCBhbGwgY2hpbGRyZW4gb2YgJGFsbCBhcyAkZXEgc2V0dGVycyAoPT4gc2V0IGlmICRhbGwubGVuZ3RoID09PSAxLFxuLy8gICBvdGhlcndpc2UgdGhyb3cgZXJyb3IpXG4vLyAtIHlvdSBjYW4gbm90IG1peCAnJCctcHJlZml4ZWQga2V5cyBhbmQgbm9uLSckJy1wcmVmaXhlZCBrZXlzXG4vLyAtIHlvdSBjYW4gb25seSBoYXZlIGRvdHRlZCBrZXlzIG9uIGEgcm9vdC1sZXZlbFxuLy8gLSB5b3UgY2FuIG5vdCBoYXZlICckJy1wcmVmaXhlZCBrZXlzIG1vcmUgdGhhbiBvbmUtbGV2ZWwgZGVlcCBpbiBhbiBvYmplY3RcblxuLy8gSGFuZGxlcyBvbmUga2V5L3ZhbHVlIHBhaXIgdG8gcHV0IGluIHRoZSBzZWxlY3RvciBkb2N1bWVudFxuZnVuY3Rpb24gcG9wdWxhdGVEb2N1bWVudFdpdGhLZXlWYWx1ZShkb2N1bWVudCwga2V5LCB2YWx1ZSkge1xuICBpZiAodmFsdWUgJiYgT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKSA9PT0gT2JqZWN0LnByb3RvdHlwZSkge1xuICAgIHBvcHVsYXRlRG9jdW1lbnRXaXRoT2JqZWN0KGRvY3VtZW50LCBrZXksIHZhbHVlKTtcbiAgfSBlbHNlIGlmICghKHZhbHVlIGluc3RhbmNlb2YgUmVnRXhwKSkge1xuICAgIGluc2VydEludG9Eb2N1bWVudChkb2N1bWVudCwga2V5LCB2YWx1ZSk7XG4gIH1cbn1cblxuLy8gSGFuZGxlcyBhIGtleSwgdmFsdWUgcGFpciB0byBwdXQgaW4gdGhlIHNlbGVjdG9yIGRvY3VtZW50XG4vLyBpZiB0aGUgdmFsdWUgaXMgYW4gb2JqZWN0XG5mdW5jdGlvbiBwb3B1bGF0ZURvY3VtZW50V2l0aE9iamVjdChkb2N1bWVudCwga2V5LCB2YWx1ZSkge1xuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICBjb25zdCB1bnByZWZpeGVkS2V5cyA9IGtleXMuZmlsdGVyKG9wID0+IG9wWzBdICE9PSAnJCcpO1xuXG4gIGlmICh1bnByZWZpeGVkS2V5cy5sZW5ndGggPiAwIHx8ICFrZXlzLmxlbmd0aCkge1xuICAgIC8vIExpdGVyYWwgKHBvc3NpYmx5IGVtcHR5KSBvYmplY3QgKCBvciBlbXB0eSBvYmplY3QgKVxuICAgIC8vIERvbid0IGFsbG93IG1peGluZyAnJCctcHJlZml4ZWQgd2l0aCBub24tJyQnLXByZWZpeGVkIGZpZWxkc1xuICAgIGlmIChrZXlzLmxlbmd0aCAhPT0gdW5wcmVmaXhlZEtleXMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYHVua25vd24gb3BlcmF0b3I6ICR7dW5wcmVmaXhlZEtleXNbMF19YCk7XG4gICAgfVxuXG4gICAgdmFsaWRhdGVPYmplY3QodmFsdWUsIGtleSk7XG4gICAgaW5zZXJ0SW50b0RvY3VtZW50KGRvY3VtZW50LCBrZXksIHZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICBPYmplY3Qua2V5cyh2YWx1ZSkuZm9yRWFjaChvcCA9PiB7XG4gICAgICBjb25zdCBvYmplY3QgPSB2YWx1ZVtvcF07XG5cbiAgICAgIGlmIChvcCA9PT0gJyRlcScpIHtcbiAgICAgICAgcG9wdWxhdGVEb2N1bWVudFdpdGhLZXlWYWx1ZShkb2N1bWVudCwga2V5LCBvYmplY3QpO1xuICAgICAgfSBlbHNlIGlmIChvcCA9PT0gJyRhbGwnKSB7XG4gICAgICAgIC8vIGV2ZXJ5IHZhbHVlIGZvciAkYWxsIHNob3VsZCBiZSBkZWFsdCB3aXRoIGFzIHNlcGFyYXRlICRlcS1zXG4gICAgICAgIG9iamVjdC5mb3JFYWNoKGVsZW1lbnQgPT5cbiAgICAgICAgICBwb3B1bGF0ZURvY3VtZW50V2l0aEtleVZhbHVlKGRvY3VtZW50LCBrZXksIGVsZW1lbnQpXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuLy8gRmlsbHMgYSBkb2N1bWVudCB3aXRoIGNlcnRhaW4gZmllbGRzIGZyb20gYW4gdXBzZXJ0IHNlbGVjdG9yXG5leHBvcnQgZnVuY3Rpb24gcG9wdWxhdGVEb2N1bWVudFdpdGhRdWVyeUZpZWxkcyhxdWVyeSwgZG9jdW1lbnQgPSB7fSkge1xuICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKHF1ZXJ5KSA9PT0gT2JqZWN0LnByb3RvdHlwZSkge1xuICAgIC8vIGhhbmRsZSBpbXBsaWNpdCAkYW5kXG4gICAgT2JqZWN0LmtleXMocXVlcnkpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gcXVlcnlba2V5XTtcblxuICAgICAgaWYgKGtleSA9PT0gJyRhbmQnKSB7XG4gICAgICAgIC8vIGhhbmRsZSBleHBsaWNpdCAkYW5kXG4gICAgICAgIHZhbHVlLmZvckVhY2goZWxlbWVudCA9PlxuICAgICAgICAgIHBvcHVsYXRlRG9jdW1lbnRXaXRoUXVlcnlGaWVsZHMoZWxlbWVudCwgZG9jdW1lbnQpXG4gICAgICAgICk7XG4gICAgICB9IGVsc2UgaWYgKGtleSA9PT0gJyRvcicpIHtcbiAgICAgICAgLy8gaGFuZGxlICRvciBub2RlcyB3aXRoIGV4YWN0bHkgMSBjaGlsZFxuICAgICAgICBpZiAodmFsdWUubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgcG9wdWxhdGVEb2N1bWVudFdpdGhRdWVyeUZpZWxkcyh2YWx1ZVswXSwgZG9jdW1lbnQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGtleVswXSAhPT0gJyQnKSB7XG4gICAgICAgIC8vIElnbm9yZSBvdGhlciAnJCctcHJlZml4ZWQgbG9naWNhbCBzZWxlY3RvcnNcbiAgICAgICAgcG9wdWxhdGVEb2N1bWVudFdpdGhLZXlWYWx1ZShkb2N1bWVudCwga2V5LCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgLy8gSGFuZGxlIG1ldGVvci1zcGVjaWZpYyBzaG9ydGN1dCBmb3Igc2VsZWN0aW5nIF9pZFxuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChxdWVyeSkpIHtcbiAgICAgIGluc2VydEludG9Eb2N1bWVudChkb2N1bWVudCwgJ19pZCcsIHF1ZXJ5KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZG9jdW1lbnQ7XG59XG5cbi8vIFRyYXZlcnNlcyB0aGUga2V5cyBvZiBwYXNzZWQgcHJvamVjdGlvbiBhbmQgY29uc3RydWN0cyBhIHRyZWUgd2hlcmUgYWxsXG4vLyBsZWF2ZXMgYXJlIGVpdGhlciBhbGwgVHJ1ZSBvciBhbGwgRmFsc2Vcbi8vIEByZXR1cm5zIE9iamVjdDpcbi8vICAtIHRyZWUgLSBPYmplY3QgLSB0cmVlIHJlcHJlc2VudGF0aW9uIG9mIGtleXMgaW52b2x2ZWQgaW4gcHJvamVjdGlvblxuLy8gIChleGNlcHRpb24gZm9yICdfaWQnIGFzIGl0IGlzIGEgc3BlY2lhbCBjYXNlIGhhbmRsZWQgc2VwYXJhdGVseSlcbi8vICAtIGluY2x1ZGluZyAtIEJvb2xlYW4gLSBcInRha2Ugb25seSBjZXJ0YWluIGZpZWxkc1wiIHR5cGUgb2YgcHJvamVjdGlvblxuZXhwb3J0IGZ1bmN0aW9uIHByb2plY3Rpb25EZXRhaWxzKGZpZWxkcykge1xuICAvLyBGaW5kIHRoZSBub24tX2lkIGtleXMgKF9pZCBpcyBoYW5kbGVkIHNwZWNpYWxseSBiZWNhdXNlIGl0IGlzIGluY2x1ZGVkXG4gIC8vIHVubGVzcyBleHBsaWNpdGx5IGV4Y2x1ZGVkKS4gU29ydCB0aGUga2V5cywgc28gdGhhdCBvdXIgY29kZSB0byBkZXRlY3RcbiAgLy8gb3ZlcmxhcHMgbGlrZSAnZm9vJyBhbmQgJ2Zvby5iYXInIGNhbiBhc3N1bWUgdGhhdCAnZm9vJyBjb21lcyBmaXJzdC5cbiAgbGV0IGZpZWxkc0tleXMgPSBPYmplY3Qua2V5cyhmaWVsZHMpLnNvcnQoKTtcblxuICAvLyBJZiBfaWQgaXMgdGhlIG9ubHkgZmllbGQgaW4gdGhlIHByb2plY3Rpb24sIGRvIG5vdCByZW1vdmUgaXQsIHNpbmNlIGl0IGlzXG4gIC8vIHJlcXVpcmVkIHRvIGRldGVybWluZSBpZiB0aGlzIGlzIGFuIGV4Y2x1c2lvbiBvciBleGNsdXNpb24uIEFsc28ga2VlcCBhblxuICAvLyBpbmNsdXNpdmUgX2lkLCBzaW5jZSBpbmNsdXNpdmUgX2lkIGZvbGxvd3MgdGhlIG5vcm1hbCBydWxlcyBhYm91dCBtaXhpbmdcbiAgLy8gaW5jbHVzaXZlIGFuZCBleGNsdXNpdmUgZmllbGRzLiBJZiBfaWQgaXMgbm90IHRoZSBvbmx5IGZpZWxkIGluIHRoZVxuICAvLyBwcm9qZWN0aW9uIGFuZCBpcyBleGNsdXNpdmUsIHJlbW92ZSBpdCBzbyBpdCBjYW4gYmUgaGFuZGxlZCBsYXRlciBieSBhXG4gIC8vIHNwZWNpYWwgY2FzZSwgc2luY2UgZXhjbHVzaXZlIF9pZCBpcyBhbHdheXMgYWxsb3dlZC5cbiAgaWYgKCEoZmllbGRzS2V5cy5sZW5ndGggPT09IDEgJiYgZmllbGRzS2V5c1swXSA9PT0gJ19pZCcpICYmXG4gICAgICAhKGZpZWxkc0tleXMuaW5jbHVkZXMoJ19pZCcpICYmIGZpZWxkcy5faWQpKSB7XG4gICAgZmllbGRzS2V5cyA9IGZpZWxkc0tleXMuZmlsdGVyKGtleSA9PiBrZXkgIT09ICdfaWQnKTtcbiAgfVxuXG4gIGxldCBpbmNsdWRpbmcgPSBudWxsOyAvLyBVbmtub3duXG5cbiAgZmllbGRzS2V5cy5mb3JFYWNoKGtleVBhdGggPT4ge1xuICAgIGNvbnN0IHJ1bGUgPSAhIWZpZWxkc1trZXlQYXRoXTtcblxuICAgIGlmIChpbmNsdWRpbmcgPT09IG51bGwpIHtcbiAgICAgIGluY2x1ZGluZyA9IHJ1bGU7XG4gICAgfVxuXG4gICAgLy8gVGhpcyBlcnJvciBtZXNzYWdlIGlzIGNvcGllZCBmcm9tIE1vbmdvREIgc2hlbGxcbiAgICBpZiAoaW5jbHVkaW5nICE9PSBydWxlKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ1lvdSBjYW5ub3QgY3VycmVudGx5IG1peCBpbmNsdWRpbmcgYW5kIGV4Y2x1ZGluZyBmaWVsZHMuJ1xuICAgICAgKTtcbiAgICB9XG4gIH0pO1xuXG4gIGNvbnN0IHByb2plY3Rpb25SdWxlc1RyZWUgPSBwYXRoc1RvVHJlZShcbiAgICBmaWVsZHNLZXlzLFxuICAgIHBhdGggPT4gaW5jbHVkaW5nLFxuICAgIChub2RlLCBwYXRoLCBmdWxsUGF0aCkgPT4ge1xuICAgICAgLy8gQ2hlY2sgcGFzc2VkIHByb2plY3Rpb24gZmllbGRzJyBrZXlzOiBJZiB5b3UgaGF2ZSB0d28gcnVsZXMgc3VjaCBhc1xuICAgICAgLy8gJ2Zvby5iYXInIGFuZCAnZm9vLmJhci5iYXonLCB0aGVuIHRoZSByZXN1bHQgYmVjb21lcyBhbWJpZ3VvdXMuIElmXG4gICAgICAvLyB0aGF0IGhhcHBlbnMsIHRoZXJlIGlzIGEgcHJvYmFiaWxpdHkgeW91IGFyZSBkb2luZyBzb21ldGhpbmcgd3JvbmcsXG4gICAgICAvLyBmcmFtZXdvcmsgc2hvdWxkIG5vdGlmeSB5b3UgYWJvdXQgc3VjaCBtaXN0YWtlIGVhcmxpZXIgb24gY3Vyc29yXG4gICAgICAvLyBjb21waWxhdGlvbiBzdGVwIHRoYW4gbGF0ZXIgZHVyaW5nIHJ1bnRpbWUuICBOb3RlLCB0aGF0IHJlYWwgbW9uZ29cbiAgICAgIC8vIGRvZXNuJ3QgZG8gYW55dGhpbmcgYWJvdXQgaXQgYW5kIHRoZSBsYXRlciBydWxlIGFwcGVhcnMgaW4gcHJvamVjdGlvblxuICAgICAgLy8gcHJvamVjdCwgbW9yZSBwcmlvcml0eSBpdCB0YWtlcy5cbiAgICAgIC8vXG4gICAgICAvLyBFeGFtcGxlLCBhc3N1bWUgZm9sbG93aW5nIGluIG1vbmdvIHNoZWxsOlxuICAgICAgLy8gPiBkYi5jb2xsLmluc2VydCh7IGE6IHsgYjogMjMsIGM6IDQ0IH0gfSlcbiAgICAgIC8vID4gZGIuY29sbC5maW5kKHt9LCB7ICdhJzogMSwgJ2EuYic6IDEgfSlcbiAgICAgIC8vIHtcIl9pZFwiOiBPYmplY3RJZChcIjUyMGJmZTQ1NjAyNDYwOGU4ZWYyNGFmM1wiKSwgXCJhXCI6IHtcImJcIjogMjN9fVxuICAgICAgLy8gPiBkYi5jb2xsLmZpbmQoe30sIHsgJ2EuYic6IDEsICdhJzogMSB9KVxuICAgICAgLy8ge1wiX2lkXCI6IE9iamVjdElkKFwiNTIwYmZlNDU2MDI0NjA4ZThlZjI0YWYzXCIpLCBcImFcIjoge1wiYlwiOiAyMywgXCJjXCI6IDQ0fX1cbiAgICAgIC8vXG4gICAgICAvLyBOb3RlLCBob3cgc2Vjb25kIHRpbWUgdGhlIHJldHVybiBzZXQgb2Yga2V5cyBpcyBkaWZmZXJlbnQuXG4gICAgICBjb25zdCBjdXJyZW50UGF0aCA9IGZ1bGxQYXRoO1xuICAgICAgY29uc3QgYW5vdGhlclBhdGggPSBwYXRoO1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgIGBib3RoICR7Y3VycmVudFBhdGh9IGFuZCAke2Fub3RoZXJQYXRofSBmb3VuZCBpbiBmaWVsZHMgb3B0aW9uLCBgICtcbiAgICAgICAgJ3VzaW5nIGJvdGggb2YgdGhlbSBtYXkgdHJpZ2dlciB1bmV4cGVjdGVkIGJlaGF2aW9yLiBEaWQgeW91IG1lYW4gdG8gJyArXG4gICAgICAgICd1c2Ugb25seSBvbmUgb2YgdGhlbT8nXG4gICAgICApO1xuICAgIH0pO1xuXG4gIHJldHVybiB7aW5jbHVkaW5nLCB0cmVlOiBwcm9qZWN0aW9uUnVsZXNUcmVlfTtcbn1cblxuLy8gVGFrZXMgYSBSZWdFeHAgb2JqZWN0IGFuZCByZXR1cm5zIGFuIGVsZW1lbnQgbWF0Y2hlci5cbmV4cG9ydCBmdW5jdGlvbiByZWdleHBFbGVtZW50TWF0Y2hlcihyZWdleHApIHtcbiAgcmV0dXJuIHZhbHVlID0+IHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgIHJldHVybiB2YWx1ZS50b1N0cmluZygpID09PSByZWdleHAudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICAvLyBSZWdleHBzIG9ubHkgd29yayBhZ2FpbnN0IHN0cmluZ3MuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBSZXNldCByZWdleHAncyBzdGF0ZSB0byBhdm9pZCBpbmNvbnNpc3RlbnQgbWF0Y2hpbmcgZm9yIG9iamVjdHMgd2l0aCB0aGVcbiAgICAvLyBzYW1lIHZhbHVlIG9uIGNvbnNlY3V0aXZlIGNhbGxzIG9mIHJlZ2V4cC50ZXN0LiBUaGlzIGhhcHBlbnMgb25seSBpZiB0aGVcbiAgICAvLyByZWdleHAgaGFzIHRoZSAnZycgZmxhZy4gQWxzbyBub3RlIHRoYXQgRVM2IGludHJvZHVjZXMgYSBuZXcgZmxhZyAneScgZm9yXG4gICAgLy8gd2hpY2ggd2Ugc2hvdWxkICpub3QqIGNoYW5nZSB0aGUgbGFzdEluZGV4IGJ1dCBNb25nb0RCIGRvZXNuJ3Qgc3VwcG9ydFxuICAgIC8vIGVpdGhlciBvZiB0aGVzZSBmbGFncy5cbiAgICByZWdleHAubGFzdEluZGV4ID0gMDtcblxuICAgIHJldHVybiByZWdleHAudGVzdCh2YWx1ZSk7XG4gIH07XG59XG5cbi8vIFZhbGlkYXRlcyB0aGUga2V5IGluIGEgcGF0aC5cbi8vIE9iamVjdHMgdGhhdCBhcmUgbmVzdGVkIG1vcmUgdGhlbiAxIGxldmVsIGNhbm5vdCBoYXZlIGRvdHRlZCBmaWVsZHNcbi8vIG9yIGZpZWxkcyBzdGFydGluZyB3aXRoICckJ1xuZnVuY3Rpb24gdmFsaWRhdGVLZXlJblBhdGgoa2V5LCBwYXRoKSB7XG4gIGlmIChrZXkuaW5jbHVkZXMoJy4nKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBUaGUgZG90dGVkIGZpZWxkICcke2tleX0nIGluICcke3BhdGh9LiR7a2V5fSBpcyBub3QgdmFsaWQgZm9yIHN0b3JhZ2UuYFxuICAgICk7XG4gIH1cblxuICBpZiAoa2V5WzBdID09PSAnJCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgVGhlIGRvbGxhciAoJCkgcHJlZml4ZWQgZmllbGQgICcke3BhdGh9LiR7a2V5fSBpcyBub3QgdmFsaWQgZm9yIHN0b3JhZ2UuYFxuICAgICk7XG4gIH1cbn1cblxuLy8gUmVjdXJzaXZlbHkgdmFsaWRhdGVzIGFuIG9iamVjdCB0aGF0IGlzIG5lc3RlZCBtb3JlIHRoYW4gb25lIGxldmVsIGRlZXBcbmZ1bmN0aW9uIHZhbGlkYXRlT2JqZWN0KG9iamVjdCwgcGF0aCkge1xuICBpZiAob2JqZWN0ICYmIE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmplY3QpID09PSBPYmplY3QucHJvdG90eXBlKSB7XG4gICAgT2JqZWN0LmtleXMob2JqZWN0KS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICB2YWxpZGF0ZUtleUluUGF0aChrZXksIHBhdGgpO1xuICAgICAgdmFsaWRhdGVPYmplY3Qob2JqZWN0W2tleV0sIHBhdGggKyAnLicgKyBrZXkpO1xuICAgIH0pO1xuICB9XG59XG4iLCIvKiogRXhwb3J0ZWQgdmFsdWVzIGFyZSBhbHNvIHVzZWQgaW4gdGhlIG1vbmdvIHBhY2thZ2UuICovXG5cbi8qKiBAcGFyYW0ge3N0cmluZ30gbWV0aG9kICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXN5bmNNZXRob2ROYW1lKG1ldGhvZCkge1xuICByZXR1cm4gYCR7bWV0aG9kLnJlcGxhY2UoJ18nLCAnJyl9QXN5bmNgO1xufVxuXG5leHBvcnQgY29uc3QgQVNZTkNfQ09MTEVDVElPTl9NRVRIT0RTID0gW1xuICAnX2NyZWF0ZUNhcHBlZENvbGxlY3Rpb24nLFxuICAnZHJvcENvbGxlY3Rpb24nLFxuICAnZHJvcEluZGV4JyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENyZWF0ZXMgdGhlIHNwZWNpZmllZCBpbmRleCBvbiB0aGUgY29sbGVjdGlvbi5cbiAgICogQGxvY3VzIHNlcnZlclxuICAgKiBAbWV0aG9kIGNyZWF0ZUluZGV4QXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBpbmRleCBBIGRvY3VtZW50IHRoYXQgY29udGFpbnMgdGhlIGZpZWxkIGFuZCB2YWx1ZSBwYWlycyB3aGVyZSB0aGUgZmllbGQgaXMgdGhlIGluZGV4IGtleSBhbmQgdGhlIHZhbHVlIGRlc2NyaWJlcyB0aGUgdHlwZSBvZiBpbmRleCBmb3IgdGhhdCBmaWVsZC4gRm9yIGFuIGFzY2VuZGluZyBpbmRleCBvbiBhIGZpZWxkLCBzcGVjaWZ5IGEgdmFsdWUgb2YgYDFgOyBmb3IgZGVzY2VuZGluZyBpbmRleCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAtMWAuIFVzZSBgdGV4dGAgZm9yIHRleHQgaW5kZXhlcy5cbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL21ldGhvZC9kYi5jb2xsZWN0aW9uLmNyZWF0ZUluZGV4LyNvcHRpb25zKVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5uYW1lIE5hbWUgb2YgdGhlIGluZGV4XG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51bmlxdWUgRGVmaW5lIHRoYXQgdGhlIGluZGV4IHZhbHVlcyBtdXN0IGJlIHVuaXF1ZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtdW5pcXVlLylcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnNwYXJzZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggaXMgc3BhcnNlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC1zcGFyc2UvKVxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gICdjcmVhdGVJbmRleCcsXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGaW5kcyB0aGUgZmlyc3QgZG9jdW1lbnQgdGhhdCBtYXRjaGVzIHRoZSBzZWxlY3RvciwgYXMgb3JkZXJlZCBieSBzb3J0IGFuZCBza2lwIG9wdGlvbnMuIFJldHVybnMgYHVuZGVmaW5lZGAgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnQgaXMgZm91bmQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGZpbmRPbmVBc3luY1xuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBbc2VsZWN0b3JdIEEgcXVlcnkgZGVzY3JpYmluZyB0aGUgZG9jdW1lbnRzIHRvIGZpbmRcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge01vbmdvU29ydFNwZWNpZmllcn0gb3B0aW9ucy5zb3J0IFNvcnQgb3JkZXIgKGRlZmF1bHQ6IG5hdHVyYWwgb3JkZXIpXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnNraXAgTnVtYmVyIG9mIHJlc3VsdHMgdG8gc2tpcCBhdCB0aGUgYmVnaW5uaW5nXG4gICAqIEBwYXJhbSB7TW9uZ29GaWVsZFNwZWNpZmllcn0gb3B0aW9ucy5maWVsZHMgRGljdGlvbmFyeSBvZiBmaWVsZHMgdG8gcmV0dXJuIG9yIGV4Y2x1ZGUuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZWFjdGl2ZSAoQ2xpZW50IG9ubHkpIERlZmF1bHQgdHJ1ZTsgcGFzcyBmYWxzZSB0byBkaXNhYmxlIHJlYWN0aXZpdHlcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy50cmFuc2Zvcm0gT3ZlcnJpZGVzIGB0cmFuc2Zvcm1gIG9uIHRoZSBbYENvbGxlY3Rpb25gXSgjY29sbGVjdGlvbnMpIGZvciB0aGlzIGN1cnNvci4gIFBhc3MgYG51bGxgIHRvIGRpc2FibGUgdHJhbnNmb3JtYXRpb24uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLnJlYWRQcmVmZXJlbmNlIChTZXJ2ZXIgb25seSkgU3BlY2lmaWVzIGEgY3VzdG9tIE1vbmdvREIgW2ByZWFkUHJlZmVyZW5jZWBdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9yZWFkLXByZWZlcmVuY2UpIGZvciBmZXRjaGluZyB0aGUgZG9jdW1lbnQuIFBvc3NpYmxlIHZhbHVlcyBhcmUgYHByaW1hcnlgLCBgcHJpbWFyeVByZWZlcnJlZGAsIGBzZWNvbmRhcnlgLCBgc2Vjb25kYXJ5UHJlZmVycmVkYCBhbmQgYG5lYXJlc3RgLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gICdmaW5kT25lJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEluc2VydCBhIGRvY3VtZW50IGluIHRoZSBjb2xsZWN0aW9uLiAgUmV0dXJucyBpdHMgdW5pcXVlIF9pZC5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgIGluc2VydEFzeW5jXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gZG9jIFRoZSBkb2N1bWVudCB0byBpbnNlcnQuIE1heSBub3QgeWV0IGhhdmUgYW4gX2lkIGF0dHJpYnV0ZSwgaW4gd2hpY2ggY2FzZSBNZXRlb3Igd2lsbCBnZW5lcmF0ZSBvbmUgZm9yIHlvdS5cbiAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICovXG4gICdpbnNlcnQnLFxuICAvKipcbiAgICogQHN1bW1hcnkgUmVtb3ZlIGRvY3VtZW50cyBmcm9tIHRoZSBjb2xsZWN0aW9uXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHJlbW92ZUFzeW5jXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IHNlbGVjdG9yIFNwZWNpZmllcyB3aGljaCBkb2N1bWVudHMgdG8gcmVtb3ZlXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICAncmVtb3ZlJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IE1vZGlmeSBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24uIFJldHVybnMgdGhlIG51bWJlciBvZiBtYXRjaGVkIGRvY3VtZW50cy5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBkYXRlQXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byBtb2RpZnlcbiAgICogQHBhcmFtIHtNb25nb01vZGlmaWVyfSBtb2RpZmllciBTcGVjaWZpZXMgaG93IHRvIG1vZGlmeSB0aGUgZG9jdW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm11bHRpIFRydWUgdG8gbW9kaWZ5IGFsbCBtYXRjaGluZyBkb2N1bWVudHM7IGZhbHNlIHRvIG9ubHkgbW9kaWZ5IG9uZSBvZiB0aGUgbWF0Y2hpbmcgZG9jdW1lbnRzICh0aGUgZGVmYXVsdCkuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51cHNlcnQgVHJ1ZSB0byBpbnNlcnQgYSBkb2N1bWVudCBpZiBubyBtYXRjaGluZyBkb2N1bWVudHMgYXJlIGZvdW5kLlxuICAgKiBAcGFyYW0ge0FycmF5fSBvcHRpb25zLmFycmF5RmlsdGVycyBPcHRpb25hbC4gVXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIE1vbmdvREIgW2ZpbHRlcmVkIHBvc2l0aW9uYWwgb3BlcmF0b3JdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL29wZXJhdG9yL3VwZGF0ZS9wb3NpdGlvbmFsLWZpbHRlcmVkLykgdG8gc3BlY2lmeSB3aGljaCBlbGVtZW50cyB0byBtb2RpZnkgaW4gYW4gYXJyYXkgZmllbGQuXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICAndXBkYXRlJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IE1vZGlmeSBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24sIG9yIGluc2VydCBvbmUgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnRzIHdlcmUgZm91bmQuIFJldHVybnMgYW4gb2JqZWN0IHdpdGgga2V5cyBgbnVtYmVyQWZmZWN0ZWRgICh0aGUgbnVtYmVyIG9mIGRvY3VtZW50cyBtb2RpZmllZCkgIGFuZCBgaW5zZXJ0ZWRJZGAgKHRoZSB1bmlxdWUgX2lkIG9mIHRoZSBkb2N1bWVudCB0aGF0IHdhcyBpbnNlcnRlZCwgaWYgYW55KS5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBzZXJ0QXN5bmNcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byBtb2RpZnlcbiAgICogQHBhcmFtIHtNb25nb01vZGlmaWVyfSBtb2RpZmllciBTcGVjaWZpZXMgaG93IHRvIG1vZGlmeSB0aGUgZG9jdW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm11bHRpIFRydWUgdG8gbW9kaWZ5IGFsbCBtYXRjaGluZyBkb2N1bWVudHM7IGZhbHNlIHRvIG9ubHkgbW9kaWZ5IG9uZSBvZiB0aGUgbWF0Y2hpbmcgZG9jdW1lbnRzICh0aGUgZGVmYXVsdCkuXG4gICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAqL1xuICAndXBzZXJ0Jyxcbl07XG5cbmV4cG9ydCBjb25zdCBBU1lOQ19DVVJTT1JfTUVUSE9EUyA9IFtcbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIGluIDIuOVxuICAgKiBAc3VtbWFyeSBSZXR1cm5zIHRoZSBudW1iZXIgb2YgZG9jdW1lbnRzIHRoYXQgbWF0Y2ggYSBxdWVyeS4gVGhpcyBtZXRob2QgaXNcbiAgICogICAgICAgICAgW2RlcHJlY2F0ZWQgc2luY2UgTW9uZ29EQiA0LjBdKGh0dHBzOi8vd3d3Lm1vbmdvZGIuY29tL2RvY3MvdjQuNC9yZWZlcmVuY2UvY29tbWFuZC9jb3VudC8pO1xuICAgKiAgICAgICAgICBzZWUgYENvbGxlY3Rpb24uY291bnREb2N1bWVudHNgIGFuZFxuICAgKiAgICAgICAgICBgQ29sbGVjdGlvbi5lc3RpbWF0ZWREb2N1bWVudENvdW50YCBmb3IgYSByZXBsYWNlbWVudC5cbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAbWV0aG9kICBjb3VudEFzeW5jXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHJldHVybnMge1Byb21pc2V9XG4gICAqL1xuICAnY291bnQnLFxuICAvKipcbiAgICogQHN1bW1hcnkgUmV0dXJuIGFsbCBtYXRjaGluZyBkb2N1bWVudHMgYXMgYW4gQXJyYXkuXG4gICAqIEBtZW1iZXJPZiBNb25nby5DdXJzb3JcbiAgICogQG1ldGhvZCAgZmV0Y2hBc3luY1xuICAgKiBAaW5zdGFuY2VcbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgJ2ZldGNoJyxcbiAgLyoqXG4gICAqIEBzdW1tYXJ5IENhbGwgYGNhbGxiYWNrYCBvbmNlIGZvciBlYWNoIG1hdGNoaW5nIGRvY3VtZW50LCBzZXF1ZW50aWFsbHkgYW5kXG4gICAqICAgICAgICAgIHN5bmNocm9ub3VzbHkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kICBmb3JFYWNoQXN5bmNcbiAgICogQGluc3RhbmNlXG4gICAqIEBtZW1iZXJPZiBNb25nby5DdXJzb3JcbiAgICogQHBhcmFtIHtJdGVyYXRpb25DYWxsYmFja30gY2FsbGJhY2sgRnVuY3Rpb24gdG8gY2FsbC4gSXQgd2lsbCBiZSBjYWxsZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgd2l0aCB0aHJlZSBhcmd1bWVudHM6IHRoZSBkb2N1bWVudCwgYVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwLWJhc2VkIGluZGV4LCBhbmQgPGVtPmN1cnNvcjwvZW0+XG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0c2VsZi5cbiAgICogQHBhcmFtIHtBbnl9IFt0aGlzQXJnXSBBbiBvYmplY3Qgd2hpY2ggd2lsbCBiZSB0aGUgdmFsdWUgb2YgYHRoaXNgIGluc2lkZVxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgIGBjYWxsYmFja2AuXG4gICAqIEByZXR1cm5zIHtQcm9taXNlfVxuICAgKi9cbiAgJ2ZvckVhY2gnLFxuICAvKipcbiAgICogQHN1bW1hcnkgTWFwIGNhbGxiYWNrIG92ZXIgYWxsIG1hdGNoaW5nIGRvY3VtZW50cy4gIFJldHVybnMgYW4gQXJyYXkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIG1hcEFzeW5jXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBwYXJhbSB7SXRlcmF0aW9uQ2FsbGJhY2t9IGNhbGxiYWNrIEZ1bmN0aW9uIHRvIGNhbGwuIEl0IHdpbGwgYmUgY2FsbGVkXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpdGggdGhyZWUgYXJndW1lbnRzOiB0aGUgZG9jdW1lbnQsIGFcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMC1iYXNlZCBpbmRleCwgYW5kIDxlbT5jdXJzb3I8L2VtPlxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdHNlbGYuXG4gICAqIEBwYXJhbSB7QW55fSBbdGhpc0FyZ10gQW4gb2JqZWN0IHdoaWNoIHdpbGwgYmUgdGhlIHZhbHVlIG9mIGB0aGlzYCBpbnNpZGVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICBgY2FsbGJhY2tgLlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZX1cbiAgICovXG4gICdtYXAnLFxuXTtcblxuZXhwb3J0IGNvbnN0IENMSUVOVF9PTkxZX01FVEhPRFMgPSBbXCJmaW5kT25lXCIsIFwiaW5zZXJ0XCIsIFwicmVtb3ZlXCIsIFwidXBkYXRlXCIsIFwidXBzZXJ0XCJdO1xuIiwiaW1wb3J0IExvY2FsQ29sbGVjdGlvbiBmcm9tICcuL2xvY2FsX2NvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgaGFzT3duIH0gZnJvbSAnLi9jb21tb24uanMnO1xuaW1wb3J0IHsgQVNZTkNfQ1VSU09SX01FVEhPRFMsIGdldEFzeW5jTWV0aG9kTmFtZSB9IGZyb20gJy4vY29uc3RhbnRzJztcblxuLy8gQ3Vyc29yOiBhIHNwZWNpZmljYXRpb24gZm9yIGEgcGFydGljdWxhciBzdWJzZXQgb2YgZG9jdW1lbnRzLCB3LyBhIGRlZmluZWRcbi8vIG9yZGVyLCBsaW1pdCwgYW5kIG9mZnNldC4gIGNyZWF0aW5nIGEgQ3Vyc29yIHdpdGggTG9jYWxDb2xsZWN0aW9uLmZpbmQoKSxcbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEN1cnNvciB7XG4gIC8vIGRvbid0IGNhbGwgdGhpcyBjdG9yIGRpcmVjdGx5LiAgdXNlIExvY2FsQ29sbGVjdGlvbi5maW5kKCkuXG4gIGNvbnN0cnVjdG9yKGNvbGxlY3Rpb24sIHNlbGVjdG9yLCBvcHRpb25zID0ge30pIHtcbiAgICB0aGlzLmNvbGxlY3Rpb24gPSBjb2xsZWN0aW9uO1xuICAgIHRoaXMuc29ydGVyID0gbnVsbDtcbiAgICB0aGlzLm1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoc2VsZWN0b3IpO1xuXG4gICAgaWYgKExvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkUGVyaGFwc0FzT2JqZWN0KHNlbGVjdG9yKSkge1xuICAgICAgLy8gc3Rhc2ggZm9yIGZhc3QgX2lkIGFuZCB7IF9pZCB9XG4gICAgICB0aGlzLl9zZWxlY3RvcklkID0gaGFzT3duLmNhbGwoc2VsZWN0b3IsICdfaWQnKSA/IHNlbGVjdG9yLl9pZCA6IHNlbGVjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zZWxlY3RvcklkID0gdW5kZWZpbmVkO1xuXG4gICAgICBpZiAodGhpcy5tYXRjaGVyLmhhc0dlb1F1ZXJ5KCkgfHwgb3B0aW9ucy5zb3J0KSB7XG4gICAgICAgIHRoaXMuc29ydGVyID0gbmV3IE1pbmltb25nby5Tb3J0ZXIob3B0aW9ucy5zb3J0IHx8IFtdKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnNraXAgPSBvcHRpb25zLnNraXAgfHwgMDtcbiAgICB0aGlzLmxpbWl0ID0gb3B0aW9ucy5saW1pdDtcbiAgICB0aGlzLmZpZWxkcyA9IG9wdGlvbnMucHJvamVjdGlvbiB8fCBvcHRpb25zLmZpZWxkcztcblxuICAgIHRoaXMuX3Byb2plY3Rpb25GbiA9IExvY2FsQ29sbGVjdGlvbi5fY29tcGlsZVByb2plY3Rpb24odGhpcy5maWVsZHMgfHwge30pO1xuXG4gICAgdGhpcy5fdHJhbnNmb3JtID0gTG9jYWxDb2xsZWN0aW9uLndyYXBUcmFuc2Zvcm0ob3B0aW9ucy50cmFuc2Zvcm0pO1xuXG4gICAgLy8gYnkgZGVmYXVsdCwgcXVlcmllcyByZWdpc3RlciB3LyBUcmFja2VyIHdoZW4gaXQgaXMgYXZhaWxhYmxlLlxuICAgIGlmICh0eXBlb2YgVHJhY2tlciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMucmVhY3RpdmUgPSBvcHRpb25zLnJlYWN0aXZlID09PSB1bmRlZmluZWQgPyB0cnVlIDogb3B0aW9ucy5yZWFjdGl2ZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgaW4gMi45XG4gICAqIEBzdW1tYXJ5IFJldHVybnMgdGhlIG51bWJlciBvZiBkb2N1bWVudHMgdGhhdCBtYXRjaCBhIHF1ZXJ5LiBUaGlzIG1ldGhvZCBpc1xuICAgKiAgICAgICAgICBbZGVwcmVjYXRlZCBzaW5jZSBNb25nb0RCIDQuMF0oaHR0cHM6Ly93d3cubW9uZ29kYi5jb20vZG9jcy92NC40L3JlZmVyZW5jZS9jb21tYW5kL2NvdW50Lyk7XG4gICAqICAgICAgICAgIHNlZSBgQ29sbGVjdGlvbi5jb3VudERvY3VtZW50c2AgYW5kXG4gICAqICAgICAgICAgIGBDb2xsZWN0aW9uLmVzdGltYXRlZERvY3VtZW50Q291bnRgIGZvciBhIHJlcGxhY2VtZW50LlxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBtZXRob2QgIGNvdW50XG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHJldHVybnMge051bWJlcn1cbiAgICovXG4gIGNvdW50KCkge1xuICAgIGlmICh0aGlzLnJlYWN0aXZlKSB7XG4gICAgICAvLyBhbGxvdyB0aGUgb2JzZXJ2ZSB0byBiZSB1bm9yZGVyZWRcbiAgICAgIHRoaXMuX2RlcGVuZCh7IGFkZGVkOiB0cnVlLCByZW1vdmVkOiB0cnVlIH0sIHRydWUpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9nZXRSYXdPYmplY3RzKHtcbiAgICAgIG9yZGVyZWQ6IHRydWUsXG4gICAgfSkubGVuZ3RoO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJldHVybiBhbGwgbWF0Y2hpbmcgZG9jdW1lbnRzIGFzIGFuIEFycmF5LlxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBtZXRob2QgIGZldGNoXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQHJldHVybnMge09iamVjdFtdfVxuICAgKi9cbiAgZmV0Y2goKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gW107XG5cbiAgICB0aGlzLmZvckVhY2goZG9jID0+IHtcbiAgICAgIHJlc3VsdC5wdXNoKGRvYyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgW1N5bWJvbC5pdGVyYXRvcl0oKSB7XG4gICAgaWYgKHRoaXMucmVhY3RpdmUpIHtcbiAgICAgIHRoaXMuX2RlcGVuZCh7XG4gICAgICAgIGFkZGVkQmVmb3JlOiB0cnVlLFxuICAgICAgICByZW1vdmVkOiB0cnVlLFxuICAgICAgICBjaGFuZ2VkOiB0cnVlLFxuICAgICAgICBtb3ZlZEJlZm9yZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGxldCBpbmRleCA9IDA7XG4gICAgY29uc3Qgb2JqZWN0cyA9IHRoaXMuX2dldFJhd09iamVjdHMoeyBvcmRlcmVkOiB0cnVlIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG5leHQ6ICgpID0+IHtcbiAgICAgICAgaWYgKGluZGV4IDwgb2JqZWN0cy5sZW5ndGgpIHtcbiAgICAgICAgICAvLyBUaGlzIGRvdWJsZXMgYXMgYSBjbG9uZSBvcGVyYXRpb24uXG4gICAgICAgICAgbGV0IGVsZW1lbnQgPSB0aGlzLl9wcm9qZWN0aW9uRm4ob2JqZWN0c1tpbmRleCsrXSk7XG5cbiAgICAgICAgICBpZiAodGhpcy5fdHJhbnNmb3JtKSBlbGVtZW50ID0gdGhpcy5fdHJhbnNmb3JtKGVsZW1lbnQpO1xuXG4gICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IGVsZW1lbnQgfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7IGRvbmU6IHRydWUgfTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIFtTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKSB7XG4gICAgY29uc3Qgc3luY1Jlc3VsdCA9IHRoaXNbU3ltYm9sLml0ZXJhdG9yXSgpO1xuICAgIHJldHVybiB7XG4gICAgICBhc3luYyBuZXh0KCkge1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHN5bmNSZXN1bHQubmV4dCgpKTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBAY2FsbGJhY2sgSXRlcmF0aW9uQ2FsbGJhY2tcbiAgICogQHBhcmFtIHtPYmplY3R9IGRvY1xuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICovXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBDYWxsIGBjYWxsYmFja2Agb25jZSBmb3IgZWFjaCBtYXRjaGluZyBkb2N1bWVudCwgc2VxdWVudGlhbGx5IGFuZFxuICAgKiAgICAgICAgICBzeW5jaHJvbm91c2x5LlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCAgZm9yRWFjaFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAcGFyYW0ge0l0ZXJhdGlvbkNhbGxiYWNrfSBjYWxsYmFjayBGdW5jdGlvbiB0byBjYWxsLiBJdCB3aWxsIGJlIGNhbGxlZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aXRoIHRocmVlIGFyZ3VtZW50czogdGhlIGRvY3VtZW50LCBhXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAtYmFzZWQgaW5kZXgsIGFuZCA8ZW0+Y3Vyc29yPC9lbT5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRzZWxmLlxuICAgKiBAcGFyYW0ge0FueX0gW3RoaXNBcmddIEFuIG9iamVjdCB3aGljaCB3aWxsIGJlIHRoZSB2YWx1ZSBvZiBgdGhpc2AgaW5zaWRlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgYGNhbGxiYWNrYC5cbiAgICovXG4gIGZvckVhY2goY2FsbGJhY2ssIHRoaXNBcmcpIHtcbiAgICBpZiAodGhpcy5yZWFjdGl2ZSkge1xuICAgICAgdGhpcy5fZGVwZW5kKHtcbiAgICAgICAgYWRkZWRCZWZvcmU6IHRydWUsXG4gICAgICAgIHJlbW92ZWQ6IHRydWUsXG4gICAgICAgIGNoYW5nZWQ6IHRydWUsXG4gICAgICAgIG1vdmVkQmVmb3JlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5fZ2V0UmF3T2JqZWN0cyh7IG9yZGVyZWQ6IHRydWUgfSkuZm9yRWFjaCgoZWxlbWVudCwgaSkgPT4ge1xuICAgICAgLy8gVGhpcyBkb3VibGVzIGFzIGEgY2xvbmUgb3BlcmF0aW9uLlxuICAgICAgZWxlbWVudCA9IHRoaXMuX3Byb2plY3Rpb25GbihlbGVtZW50KTtcblxuICAgICAgaWYgKHRoaXMuX3RyYW5zZm9ybSkge1xuICAgICAgICBlbGVtZW50ID0gdGhpcy5fdHJhbnNmb3JtKGVsZW1lbnQpO1xuICAgICAgfVxuXG4gICAgICBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGVsZW1lbnQsIGksIHRoaXMpO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0VHJhbnNmb3JtKCkge1xuICAgIHJldHVybiB0aGlzLl90cmFuc2Zvcm07XG4gIH1cblxuICAvKipcbiAgICogQHN1bW1hcnkgTWFwIGNhbGxiYWNrIG92ZXIgYWxsIG1hdGNoaW5nIGRvY3VtZW50cy4gIFJldHVybnMgYW4gQXJyYXkuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIG1hcFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIE1vbmdvLkN1cnNvclxuICAgKiBAcGFyYW0ge0l0ZXJhdGlvbkNhbGxiYWNrfSBjYWxsYmFjayBGdW5jdGlvbiB0byBjYWxsLiBJdCB3aWxsIGJlIGNhbGxlZFxuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aXRoIHRocmVlIGFyZ3VtZW50czogdGhlIGRvY3VtZW50LCBhXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDAtYmFzZWQgaW5kZXgsIGFuZCA8ZW0+Y3Vyc29yPC9lbT5cbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXRzZWxmLlxuICAgKiBAcGFyYW0ge0FueX0gW3RoaXNBcmddIEFuIG9iamVjdCB3aGljaCB3aWxsIGJlIHRoZSB2YWx1ZSBvZiBgdGhpc2AgaW5zaWRlXG4gICAqICAgICAgICAgICAgICAgICAgICAgICAgYGNhbGxiYWNrYC5cbiAgICovXG4gIG1hcChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgdGhpcy5mb3JFYWNoKChkb2MsIGkpID0+IHtcbiAgICAgIHJlc3VsdC5wdXNoKGNhbGxiYWNrLmNhbGwodGhpc0FyZywgZG9jLCBpLCB0aGlzKSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gb3B0aW9ucyB0byBjb250YWluOlxuICAvLyAgKiBjYWxsYmFja3MgZm9yIG9ic2VydmUoKTpcbiAgLy8gICAgLSBhZGRlZEF0IChkb2N1bWVudCwgYXRJbmRleClcbiAgLy8gICAgLSBhZGRlZCAoZG9jdW1lbnQpXG4gIC8vICAgIC0gY2hhbmdlZEF0IChuZXdEb2N1bWVudCwgb2xkRG9jdW1lbnQsIGF0SW5kZXgpXG4gIC8vICAgIC0gY2hhbmdlZCAobmV3RG9jdW1lbnQsIG9sZERvY3VtZW50KVxuICAvLyAgICAtIHJlbW92ZWRBdCAoZG9jdW1lbnQsIGF0SW5kZXgpXG4gIC8vICAgIC0gcmVtb3ZlZCAoZG9jdW1lbnQpXG4gIC8vICAgIC0gbW92ZWRUbyAoZG9jdW1lbnQsIG9sZEluZGV4LCBuZXdJbmRleClcbiAgLy9cbiAgLy8gYXR0cmlidXRlcyBhdmFpbGFibGUgb24gcmV0dXJuZWQgcXVlcnkgaGFuZGxlOlxuICAvLyAgKiBzdG9wKCk6IGVuZCB1cGRhdGVzXG4gIC8vICAqIGNvbGxlY3Rpb246IHRoZSBjb2xsZWN0aW9uIHRoaXMgcXVlcnkgaXMgcXVlcnlpbmdcbiAgLy9cbiAgLy8gaWZmIHggaXMgYSByZXR1cm5lZCBxdWVyeSBoYW5kbGUsICh4IGluc3RhbmNlb2ZcbiAgLy8gTG9jYWxDb2xsZWN0aW9uLk9ic2VydmVIYW5kbGUpIGlzIHRydWVcbiAgLy9cbiAgLy8gaW5pdGlhbCByZXN1bHRzIGRlbGl2ZXJlZCB0aHJvdWdoIGFkZGVkIGNhbGxiYWNrXG4gIC8vIFhYWCBtYXliZSBjYWxsYmFja3Mgc2hvdWxkIHRha2UgYSBsaXN0IG9mIG9iamVjdHMsIHRvIGV4cG9zZSB0cmFuc2FjdGlvbnM/XG4gIC8vIFhYWCBtYXliZSBzdXBwb3J0IGZpZWxkIGxpbWl0aW5nICh0byBsaW1pdCB3aGF0IHlvdSdyZSBub3RpZmllZCBvbilcblxuICAvKipcbiAgICogQHN1bW1hcnkgV2F0Y2ggYSBxdWVyeS4gIFJlY2VpdmUgY2FsbGJhY2tzIGFzIHRoZSByZXN1bHQgc2V0IGNoYW5nZXMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gY2FsbGJhY2tzIEZ1bmN0aW9ucyB0byBjYWxsIHRvIGRlbGl2ZXIgdGhlIHJlc3VsdCBzZXQgYXMgaXRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzXG4gICAqL1xuICBvYnNlcnZlKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlRnJvbU9ic2VydmVDaGFuZ2VzKHRoaXMsIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFdhdGNoIGEgcXVlcnkuIFJlY2VpdmUgY2FsbGJhY2tzIGFzIHRoZSByZXN1bHQgc2V0IGNoYW5nZXMuIE9ubHlcbiAgICogICAgICAgICAgdGhlIGRpZmZlcmVuY2VzIGJldHdlZW4gdGhlIG9sZCBhbmQgbmV3IGRvY3VtZW50cyBhcmUgcGFzc2VkIHRvXG4gICAqICAgICAgICAgIHRoZSBjYWxsYmFja3MuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWVtYmVyT2YgTW9uZ28uQ3Vyc29yXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gY2FsbGJhY2tzIEZ1bmN0aW9ucyB0byBjYWxsIHRvIGRlbGl2ZXIgdGhlIHJlc3VsdCBzZXQgYXMgaXRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFuZ2VzXG4gICAqL1xuICBvYnNlcnZlQ2hhbmdlcyhvcHRpb25zKSB7XG4gICAgY29uc3Qgb3JkZXJlZCA9IExvY2FsQ29sbGVjdGlvbi5fb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3NBcmVPcmRlcmVkKG9wdGlvbnMpO1xuXG4gICAgLy8gdGhlcmUgYXJlIHNldmVyYWwgcGxhY2VzIHRoYXQgYXNzdW1lIHlvdSBhcmVuJ3QgY29tYmluaW5nIHNraXAvbGltaXQgd2l0aFxuICAgIC8vIHVub3JkZXJlZCBvYnNlcnZlLiAgZWcsIHVwZGF0ZSdzIEVKU09OLmNsb25lLCBhbmQgdGhlIFwidGhlcmUgYXJlIHNldmVyYWxcIlxuICAgIC8vIGNvbW1lbnQgaW4gX21vZGlmeUFuZE5vdGlmeVxuICAgIC8vIFhYWCBhbGxvdyBza2lwL2xpbWl0IHdpdGggdW5vcmRlcmVkIG9ic2VydmVcbiAgICBpZiAoIW9wdGlvbnMuX2FsbG93X3Vub3JkZXJlZCAmJiAhb3JkZXJlZCAmJiAodGhpcy5za2lwIHx8IHRoaXMubGltaXQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIFwiTXVzdCB1c2UgYW4gb3JkZXJlZCBvYnNlcnZlIHdpdGggc2tpcCBvciBsaW1pdCAoaS5lLiAnYWRkZWRCZWZvcmUnIFwiICtcbiAgICAgICAgICBcImZvciBvYnNlcnZlQ2hhbmdlcyBvciAnYWRkZWRBdCcgZm9yIG9ic2VydmUsIGluc3RlYWQgb2YgJ2FkZGVkJykuXCJcbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZmllbGRzICYmICh0aGlzLmZpZWxkcy5faWQgPT09IDAgfHwgdGhpcy5maWVsZHMuX2lkID09PSBmYWxzZSkpIHtcbiAgICAgIHRocm93IEVycm9yKFwiWW91IG1heSBub3Qgb2JzZXJ2ZSBhIGN1cnNvciB3aXRoIHtmaWVsZHM6IHtfaWQ6IDB9fVwiKTtcbiAgICB9XG5cbiAgICBjb25zdCBkaXN0YW5jZXMgPVxuICAgICAgdGhpcy5tYXRjaGVyLmhhc0dlb1F1ZXJ5KCkgJiYgb3JkZXJlZCAmJiBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcCgpO1xuXG4gICAgY29uc3QgcXVlcnkgPSB7XG4gICAgICBjdXJzb3I6IHRoaXMsXG4gICAgICBkaXJ0eTogZmFsc2UsXG4gICAgICBkaXN0YW5jZXMsXG4gICAgICBtYXRjaGVyOiB0aGlzLm1hdGNoZXIsIC8vIG5vdCBmYXN0IHBhdGhlZFxuICAgICAgb3JkZXJlZCxcbiAgICAgIHByb2plY3Rpb25GbjogdGhpcy5fcHJvamVjdGlvbkZuLFxuICAgICAgcmVzdWx0c1NuYXBzaG90OiBudWxsLFxuICAgICAgc29ydGVyOiBvcmRlcmVkICYmIHRoaXMuc29ydGVyLFxuICAgIH07XG5cbiAgICBsZXQgcWlkO1xuXG4gICAgLy8gTm9uLXJlYWN0aXZlIHF1ZXJpZXMgY2FsbCBhZGRlZFtCZWZvcmVdIGFuZCB0aGVuIG5ldmVyIGNhbGwgYW55dGhpbmdcbiAgICAvLyBlbHNlLlxuICAgIGlmICh0aGlzLnJlYWN0aXZlKSB7XG4gICAgICBxaWQgPSB0aGlzLmNvbGxlY3Rpb24ubmV4dF9xaWQrKztcbiAgICAgIHRoaXMuY29sbGVjdGlvbi5xdWVyaWVzW3FpZF0gPSBxdWVyeTtcbiAgICB9XG5cbiAgICBxdWVyeS5yZXN1bHRzID0gdGhpcy5fZ2V0UmF3T2JqZWN0cyh7XG4gICAgICBvcmRlcmVkLFxuICAgICAgZGlzdGFuY2VzOiBxdWVyeS5kaXN0YW5jZXMsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5jb2xsZWN0aW9uLnBhdXNlZCkge1xuICAgICAgcXVlcnkucmVzdWx0c1NuYXBzaG90ID0gb3JkZXJlZCA/IFtdIDogbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXAoKTtcbiAgICB9XG5cbiAgICAvLyB3cmFwIGNhbGxiYWNrcyB3ZSB3ZXJlIHBhc3NlZC4gY2FsbGJhY2tzIG9ubHkgZmlyZSB3aGVuIG5vdCBwYXVzZWQgYW5kXG4gICAgLy8gYXJlIG5ldmVyIHVuZGVmaW5lZFxuICAgIC8vIEZpbHRlcnMgb3V0IGJsYWNrbGlzdGVkIGZpZWxkcyBhY2NvcmRpbmcgdG8gY3Vyc29yJ3MgcHJvamVjdGlvbi5cbiAgICAvLyBYWFggd3JvbmcgcGxhY2UgZm9yIHRoaXM/XG5cbiAgICAvLyBmdXJ0aGVybW9yZSwgY2FsbGJhY2tzIGVucXVldWUgdW50aWwgdGhlIG9wZXJhdGlvbiB3ZSdyZSB3b3JraW5nIG9uIGlzXG4gICAgLy8gZG9uZS5cbiAgICBjb25zdCB3cmFwQ2FsbGJhY2sgPSAoZm4pID0+IHtcbiAgICAgIGlmICghZm4pIHtcbiAgICAgICAgcmV0dXJuICgpID0+IHt9O1xuICAgICAgfVxuXG4gICAgICBjb25zdCBzZWxmID0gdGhpcztcblxuICAgICAgcmV0dXJuIGZ1bmN0aW9uICgvKiBhcmdzKi8pIHtcbiAgICAgICAgaWYgKHNlbGYuY29sbGVjdGlvbi5wYXVzZWQpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBhcmdzID0gYXJndW1lbnRzO1xuXG4gICAgICAgIHNlbGYuY29sbGVjdGlvbi5fb2JzZXJ2ZVF1ZXVlLnF1ZXVlVGFzaygoKSA9PiB7XG4gICAgICAgICAgZm4uYXBwbHkodGhpcywgYXJncyk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICB9O1xuXG4gICAgcXVlcnkuYWRkZWQgPSB3cmFwQ2FsbGJhY2sob3B0aW9ucy5hZGRlZCk7XG4gICAgcXVlcnkuY2hhbmdlZCA9IHdyYXBDYWxsYmFjayhvcHRpb25zLmNoYW5nZWQpO1xuICAgIHF1ZXJ5LnJlbW92ZWQgPSB3cmFwQ2FsbGJhY2sob3B0aW9ucy5yZW1vdmVkKTtcblxuICAgIGlmIChvcmRlcmVkKSB7XG4gICAgICBxdWVyeS5hZGRlZEJlZm9yZSA9IHdyYXBDYWxsYmFjayhvcHRpb25zLmFkZGVkQmVmb3JlKTtcbiAgICAgIHF1ZXJ5Lm1vdmVkQmVmb3JlID0gd3JhcENhbGxiYWNrKG9wdGlvbnMubW92ZWRCZWZvcmUpO1xuICAgIH1cblxuICAgIGlmICghb3B0aW9ucy5fc3VwcHJlc3NfaW5pdGlhbCAmJiAhdGhpcy5jb2xsZWN0aW9uLnBhdXNlZCkge1xuICAgICAgY29uc3QgaGFuZGxlciA9IChkb2MpID0+IHtcbiAgICAgICAgY29uc3QgZmllbGRzID0gRUpTT04uY2xvbmUoZG9jKTtcblxuICAgICAgICBkZWxldGUgZmllbGRzLl9pZDtcblxuICAgICAgICBpZiAob3JkZXJlZCkge1xuICAgICAgICAgIHF1ZXJ5LmFkZGVkQmVmb3JlKGRvYy5faWQsIHRoaXMuX3Byb2plY3Rpb25GbihmaWVsZHMpLCBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHF1ZXJ5LmFkZGVkKGRvYy5faWQsIHRoaXMuX3Byb2plY3Rpb25GbihmaWVsZHMpKTtcbiAgICAgIH07XG4gICAgICAvLyBpdCBtZWFucyBpdCdzIGp1c3QgYW4gYXJyYXlcbiAgICAgIGlmIChxdWVyeS5yZXN1bHRzLmxlbmd0aCkge1xuICAgICAgICBmb3IgKGNvbnN0IGRvYyBvZiBxdWVyeS5yZXN1bHRzKSB7XG4gICAgICAgICAgaGFuZGxlcihkb2MpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBpdCBtZWFucyBpdCdzIGFuIGlkIG1hcFxuICAgICAgaWYgKHF1ZXJ5LnJlc3VsdHM/LnNpemU/LigpKSB7XG4gICAgICAgIHF1ZXJ5LnJlc3VsdHMuZm9yRWFjaChoYW5kbGVyKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBoYW5kbGUgPSBPYmplY3QuYXNzaWduKG5ldyBMb2NhbENvbGxlY3Rpb24uT2JzZXJ2ZUhhbmRsZSgpLCB7XG4gICAgICBjb2xsZWN0aW9uOiB0aGlzLmNvbGxlY3Rpb24sXG4gICAgICBzdG9wOiAoKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLnJlYWN0aXZlKSB7XG4gICAgICAgICAgZGVsZXRlIHRoaXMuY29sbGVjdGlvbi5xdWVyaWVzW3FpZF07XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBpc1JlYWR5OiBmYWxzZSxcbiAgICAgIGlzUmVhZHlQcm9taXNlOiBudWxsLFxuICAgIH0pO1xuXG4gICAgaWYgKHRoaXMucmVhY3RpdmUgJiYgVHJhY2tlci5hY3RpdmUpIHtcbiAgICAgIC8vIFhYWCBpbiBtYW55IGNhc2VzLCB0aGUgc2FtZSBvYnNlcnZlIHdpbGwgYmUgcmVjcmVhdGVkIHdoZW5cbiAgICAgIC8vIHRoZSBjdXJyZW50IGF1dG9ydW4gaXMgcmVydW4uICB3ZSBjb3VsZCBzYXZlIHdvcmsgYnlcbiAgICAgIC8vIGxldHRpbmcgaXQgbGluZ2VyIGFjcm9zcyByZXJ1biBhbmQgcG90ZW50aWFsbHkgZ2V0XG4gICAgICAvLyByZXB1cnBvc2VkIGlmIHRoZSBzYW1lIG9ic2VydmUgaXMgcGVyZm9ybWVkLCB1c2luZyBsb2dpY1xuICAgICAgLy8gc2ltaWxhciB0byB0aGF0IG9mIE1ldGVvci5zdWJzY3JpYmUuXG4gICAgICBUcmFja2VyLm9uSW52YWxpZGF0ZSgoKSA9PiB7XG4gICAgICAgIGhhbmRsZS5zdG9wKCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBydW4gdGhlIG9ic2VydmUgY2FsbGJhY2tzIHJlc3VsdGluZyBmcm9tIHRoZSBpbml0aWFsIGNvbnRlbnRzXG4gICAgLy8gYmVmb3JlIHdlIGxlYXZlIHRoZSBvYnNlcnZlLlxuICAgIGNvbnN0IGRyYWluUmVzdWx0ID0gdGhpcy5jb2xsZWN0aW9uLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcblxuICAgIGlmIChkcmFpblJlc3VsdCBpbnN0YW5jZW9mIFByb21pc2UpIHtcbiAgICAgIGhhbmRsZS5pc1JlYWR5UHJvbWlzZSA9IGRyYWluUmVzdWx0O1xuICAgICAgZHJhaW5SZXN1bHQudGhlbigoKSA9PiAoaGFuZGxlLmlzUmVhZHkgPSB0cnVlKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhbmRsZS5pc1JlYWR5ID0gdHJ1ZTtcbiAgICAgIGhhbmRsZS5pc1JlYWR5UHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIHJldHVybiBoYW5kbGU7XG4gIH1cblxuICAvLyBYWFggTWF5YmUgd2UgbmVlZCBhIHZlcnNpb24gb2Ygb2JzZXJ2ZSB0aGF0IGp1c3QgY2FsbHMgYSBjYWxsYmFjayBpZlxuICAvLyBhbnl0aGluZyBjaGFuZ2VkLlxuICBfZGVwZW5kKGNoYW5nZXJzLCBfYWxsb3dfdW5vcmRlcmVkKSB7XG4gICAgaWYgKFRyYWNrZXIuYWN0aXZlKSB7XG4gICAgICBjb25zdCBkZXBlbmRlbmN5ID0gbmV3IFRyYWNrZXIuRGVwZW5kZW5jeSgpO1xuICAgICAgY29uc3Qgbm90aWZ5ID0gZGVwZW5kZW5jeS5jaGFuZ2VkLmJpbmQoZGVwZW5kZW5jeSk7XG5cbiAgICAgIGRlcGVuZGVuY3kuZGVwZW5kKCk7XG5cbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB7IF9hbGxvd191bm9yZGVyZWQsIF9zdXBwcmVzc19pbml0aWFsOiB0cnVlIH07XG5cbiAgICAgIFsnYWRkZWQnLCAnYWRkZWRCZWZvcmUnLCAnY2hhbmdlZCcsICdtb3ZlZEJlZm9yZScsICdyZW1vdmVkJ10uZm9yRWFjaChcbiAgICAgICAgZm4gPT4ge1xuICAgICAgICAgIGlmIChjaGFuZ2Vyc1tmbl0pIHtcbiAgICAgICAgICAgIG9wdGlvbnNbZm5dID0gbm90aWZ5O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgLy8gb2JzZXJ2ZUNoYW5nZXMgd2lsbCBzdG9wKCkgd2hlbiB0aGlzIGNvbXB1dGF0aW9uIGlzIGludmFsaWRhdGVkXG4gICAgICB0aGlzLm9ic2VydmVDaGFuZ2VzKG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRDb2xsZWN0aW9uTmFtZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb2xsZWN0aW9uLm5hbWU7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgY29sbGVjdGlvbiBvZiBtYXRjaGluZyBvYmplY3RzLCBidXQgZG9lc24ndCBkZWVwIGNvcHkgdGhlbS5cbiAgLy9cbiAgLy8gSWYgb3JkZXJlZCBpcyBzZXQsIHJldHVybnMgYSBzb3J0ZWQgYXJyYXksIHJlc3BlY3Rpbmcgc29ydGVyLCBza2lwLCBhbmRcbiAgLy8gbGltaXQgcHJvcGVydGllcyBvZiB0aGUgcXVlcnkgcHJvdmlkZWQgdGhhdCBvcHRpb25zLmFwcGx5U2tpcExpbWl0IGlzXG4gIC8vIG5vdCBzZXQgdG8gZmFsc2UgKCMxMjAxKS4gSWYgc29ydGVyIGlzIGZhbHNleSwgbm8gc29ydCAtLSB5b3UgZ2V0IHRoZVxuICAvLyBuYXR1cmFsIG9yZGVyLlxuICAvL1xuICAvLyBJZiBvcmRlcmVkIGlzIG5vdCBzZXQsIHJldHVybnMgYW4gb2JqZWN0IG1hcHBpbmcgZnJvbSBJRCB0byBkb2MgKHNvcnRlcixcbiAgLy8gc2tpcCBhbmQgbGltaXQgc2hvdWxkIG5vdCBiZSBzZXQpLlxuICAvL1xuICAvLyBJZiBvcmRlcmVkIGlzIHNldCBhbmQgdGhpcyBjdXJzb3IgaXMgYSAkbmVhciBnZW9xdWVyeSwgdGhlbiB0aGlzIGZ1bmN0aW9uXG4gIC8vIHdpbGwgdXNlIGFuIF9JZE1hcCB0byB0cmFjayBlYWNoIGRpc3RhbmNlIGZyb20gdGhlICRuZWFyIGFyZ3VtZW50IHBvaW50IGluXG4gIC8vIG9yZGVyIHRvIHVzZSBpdCBhcyBhIHNvcnQga2V5LiBJZiBhbiBfSWRNYXAgaXMgcGFzc2VkIGluIHRoZSAnZGlzdGFuY2VzJ1xuICAvLyBhcmd1bWVudCwgdGhpcyBmdW5jdGlvbiB3aWxsIGNsZWFyIGl0IGFuZCB1c2UgaXQgZm9yIHRoaXMgcHVycG9zZVxuICAvLyAob3RoZXJ3aXNlIGl0IHdpbGwganVzdCBjcmVhdGUgaXRzIG93biBfSWRNYXApLiBUaGUgb2JzZXJ2ZUNoYW5nZXNcbiAgLy8gaW1wbGVtZW50YXRpb24gdXNlcyB0aGlzIHRvIHJlbWVtYmVyIHRoZSBkaXN0YW5jZXMgYWZ0ZXIgdGhpcyBmdW5jdGlvblxuICAvLyByZXR1cm5zLlxuICBfZ2V0UmF3T2JqZWN0cyhvcHRpb25zID0ge30pIHtcbiAgICAvLyBCeSBkZWZhdWx0IHRoaXMgbWV0aG9kIHdpbGwgcmVzcGVjdCBza2lwIGFuZCBsaW1pdCBiZWNhdXNlIC5mZXRjaCgpLFxuICAgIC8vIC5mb3JFYWNoKCkgZXRjLi4uIGV4cGVjdCB0aGlzIGJlaGF2aW91ci4gSXQgY2FuIGJlIGZvcmNlZCB0byBpZ25vcmVcbiAgICAvLyBza2lwIGFuZCBsaW1pdCBieSBzZXR0aW5nIGFwcGx5U2tpcExpbWl0IHRvIGZhbHNlICguY291bnQoKSBkb2VzIHRoaXMsXG4gICAgLy8gZm9yIGV4YW1wbGUpXG4gICAgY29uc3QgYXBwbHlTa2lwTGltaXQgPSBvcHRpb25zLmFwcGx5U2tpcExpbWl0ICE9PSBmYWxzZTtcblxuICAgIC8vIFhYWCB1c2UgT3JkZXJlZERpY3QgaW5zdGVhZCBvZiBhcnJheSwgYW5kIG1ha2UgSWRNYXAgYW5kIE9yZGVyZWREaWN0XG4gICAgLy8gY29tcGF0aWJsZVxuICAgIGNvbnN0IHJlc3VsdHMgPSBvcHRpb25zLm9yZGVyZWQgPyBbXSA6IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwKCk7XG5cbiAgICAvLyBmYXN0IHBhdGggZm9yIHNpbmdsZSBJRCB2YWx1ZVxuICAgIGlmICh0aGlzLl9zZWxlY3RvcklkICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIElmIHlvdSBoYXZlIG5vbi16ZXJvIHNraXAgYW5kIGFzayBmb3IgYSBzaW5nbGUgaWQsIHlvdSBnZXQgbm90aGluZy5cbiAgICAgIC8vIFRoaXMgaXMgc28gaXQgbWF0Y2hlcyB0aGUgYmVoYXZpb3Igb2YgdGhlICd7X2lkOiBmb299JyBwYXRoLlxuICAgICAgaWYgKGFwcGx5U2tpcExpbWl0ICYmIHRoaXMuc2tpcCkge1xuICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgIH1cblxuICAgICAgY29uc3Qgc2VsZWN0ZWREb2MgPSB0aGlzLmNvbGxlY3Rpb24uX2RvY3MuZ2V0KHRoaXMuX3NlbGVjdG9ySWQpO1xuICAgICAgaWYgKHNlbGVjdGVkRG9jKSB7XG4gICAgICAgIGlmIChvcHRpb25zLm9yZGVyZWQpIHtcbiAgICAgICAgICByZXN1bHRzLnB1c2goc2VsZWN0ZWREb2MpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3VsdHMuc2V0KHRoaXMuX3NlbGVjdG9ySWQsIHNlbGVjdGVkRG9jKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgLy8gc2xvdyBwYXRoIGZvciBhcmJpdHJhcnkgc2VsZWN0b3IsIHNvcnQsIHNraXAsIGxpbWl0XG5cbiAgICAvLyBpbiB0aGUgb2JzZXJ2ZUNoYW5nZXMgY2FzZSwgZGlzdGFuY2VzIGlzIGFjdHVhbGx5IHBhcnQgb2YgdGhlIFwicXVlcnlcIlxuICAgIC8vIChpZSwgbGl2ZSByZXN1bHRzIHNldCkgb2JqZWN0LiAgaW4gb3RoZXIgY2FzZXMsIGRpc3RhbmNlcyBpcyBvbmx5IHVzZWRcbiAgICAvLyBpbnNpZGUgdGhpcyBmdW5jdGlvbi5cbiAgICBsZXQgZGlzdGFuY2VzO1xuICAgIGlmICh0aGlzLm1hdGNoZXIuaGFzR2VvUXVlcnkoKSAmJiBvcHRpb25zLm9yZGVyZWQpIHtcbiAgICAgIGlmIChvcHRpb25zLmRpc3RhbmNlcykge1xuICAgICAgICBkaXN0YW5jZXMgPSBvcHRpb25zLmRpc3RhbmNlcztcbiAgICAgICAgZGlzdGFuY2VzLmNsZWFyKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkaXN0YW5jZXMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcCgpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNvbGxlY3Rpb24uX2RvY3MuZm9yRWFjaCgoZG9jLCBpZCkgPT4ge1xuICAgICAgY29uc3QgbWF0Y2hSZXN1bHQgPSB0aGlzLm1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGRvYyk7XG4gICAgICBpZiAobWF0Y2hSZXN1bHQucmVzdWx0KSB7XG4gICAgICAgIGlmIChvcHRpb25zLm9yZGVyZWQpIHtcbiAgICAgICAgICByZXN1bHRzLnB1c2goZG9jKTtcblxuICAgICAgICAgIGlmIChkaXN0YW5jZXMgJiYgbWF0Y2hSZXN1bHQuZGlzdGFuY2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZGlzdGFuY2VzLnNldChpZCwgbWF0Y2hSZXN1bHQuZGlzdGFuY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHRzLnNldChpZCwgZG9jKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBPdmVycmlkZSB0byBlbnN1cmUgYWxsIGRvY3MgYXJlIG1hdGNoZWQgaWYgaWdub3Jpbmcgc2tpcCAmIGxpbWl0XG4gICAgICBpZiAoIWFwcGx5U2tpcExpbWl0KSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBGYXN0IHBhdGggZm9yIGxpbWl0ZWQgdW5zb3J0ZWQgcXVlcmllcy5cbiAgICAgIC8vIFhYWCAnbGVuZ3RoJyBjaGVjayBoZXJlIHNlZW1zIHdyb25nIGZvciBvcmRlcmVkXG4gICAgICByZXR1cm4gKFxuICAgICAgICAhdGhpcy5saW1pdCB8fCB0aGlzLnNraXAgfHwgdGhpcy5zb3J0ZXIgfHwgcmVzdWx0cy5sZW5ndGggIT09IHRoaXMubGltaXRcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICBpZiAoIW9wdGlvbnMub3JkZXJlZCkge1xuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc29ydGVyKSB7XG4gICAgICByZXN1bHRzLnNvcnQodGhpcy5zb3J0ZXIuZ2V0Q29tcGFyYXRvcih7IGRpc3RhbmNlcyB9KSk7XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBmdWxsIHNldCBvZiByZXN1bHRzIGlmIHRoZXJlIGlzIG5vIHNraXAgb3IgbGltaXQgb3IgaWYgd2UncmVcbiAgICAvLyBpZ25vcmluZyB0aGVtXG4gICAgaWYgKCFhcHBseVNraXBMaW1pdCB8fCAoIXRoaXMubGltaXQgJiYgIXRoaXMuc2tpcCkpIHtcbiAgICAgIHJldHVybiByZXN1bHRzO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHRzLnNsaWNlKFxuICAgICAgdGhpcy5za2lwLFxuICAgICAgdGhpcy5saW1pdCA/IHRoaXMubGltaXQgKyB0aGlzLnNraXAgOiByZXN1bHRzLmxlbmd0aFxuICAgICk7XG4gIH1cblxuICBfcHVibGlzaEN1cnNvcihzdWJzY3JpcHRpb24pIHtcbiAgICAvLyBYWFggbWluaW1vbmdvIHNob3VsZCBub3QgZGVwZW5kIG9uIG1vbmdvLWxpdmVkYXRhIVxuICAgIGlmICghUGFja2FnZS5tb25nbykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBcIkNhbid0IHB1Ymxpc2ggZnJvbSBNaW5pbW9uZ28gd2l0aG91dCB0aGUgYG1vbmdvYCBwYWNrYWdlLlwiXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5jb2xsZWN0aW9uLm5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgXCJDYW4ndCBwdWJsaXNoIGEgY3Vyc29yIGZyb20gYSBjb2xsZWN0aW9uIHdpdGhvdXQgYSBuYW1lLlwiXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiBQYWNrYWdlLm1vbmdvLk1vbmdvLkNvbGxlY3Rpb24uX3B1Ymxpc2hDdXJzb3IoXG4gICAgICB0aGlzLFxuICAgICAgc3Vic2NyaXB0aW9uLFxuICAgICAgdGhpcy5jb2xsZWN0aW9uLm5hbWVcbiAgICApO1xuICB9XG59XG5cbi8vIEltcGxlbWVudHMgYXN5bmMgdmVyc2lvbiBvZiBjdXJzb3IgbWV0aG9kcyB0byBrZWVwIGNvbGxlY3Rpb25zIGlzb21vcnBoaWNcbkFTWU5DX0NVUlNPUl9NRVRIT0RTLmZvckVhY2gobWV0aG9kID0+IHtcbiAgY29uc3QgYXN5bmNOYW1lID0gZ2V0QXN5bmNNZXRob2ROYW1lKG1ldGhvZCk7XG4gIEN1cnNvci5wcm90b3R5cGVbYXN5bmNOYW1lXSA9IGZ1bmN0aW9uKC4uLmFyZ3MpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzW21ldGhvZF0uYXBwbHkodGhpcywgYXJncykpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyb3IpO1xuICAgIH1cbiAgfTtcbn0pO1xuIiwiaW1wb3J0IEN1cnNvciBmcm9tICcuL2N1cnNvci5qcyc7XG5pbXBvcnQgT2JzZXJ2ZUhhbmRsZSBmcm9tICcuL29ic2VydmVfaGFuZGxlLmpzJztcbmltcG9ydCB7XG4gIGhhc093bixcbiAgaXNJbmRleGFibGUsXG4gIGlzTnVtZXJpY0tleSxcbiAgaXNPcGVyYXRvck9iamVjdCxcbiAgcG9wdWxhdGVEb2N1bWVudFdpdGhRdWVyeUZpZWxkcyxcbiAgcHJvamVjdGlvbkRldGFpbHMsXG59IGZyb20gJy4vY29tbW9uLmpzJztcblxuaW1wb3J0IHsgZ2V0QXN5bmNNZXRob2ROYW1lIH0gZnJvbSAnLi9jb25zdGFudHMnO1xuXG4vLyBYWFggdHlwZSBjaGVja2luZyBvbiBzZWxlY3RvcnMgKGdyYWNlZnVsIGVycm9yIGlmIG1hbGZvcm1lZClcblxuLy8gTG9jYWxDb2xsZWN0aW9uOiBhIHNldCBvZiBkb2N1bWVudHMgdGhhdCBzdXBwb3J0cyBxdWVyaWVzIGFuZCBtb2RpZmllcnMuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBMb2NhbENvbGxlY3Rpb24ge1xuICBjb25zdHJ1Y3RvcihuYW1lKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAvLyBfaWQgLT4gZG9jdW1lbnQgKGFsc28gY29udGFpbmluZyBpZClcbiAgICB0aGlzLl9kb2NzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG5cbiAgICB0aGlzLl9vYnNlcnZlUXVldWUgPSBNZXRlb3IuaXNDbGllbnRcbiAgICAgID8gbmV3IE1ldGVvci5fU3luY2hyb25vdXNRdWV1ZSgpXG4gICAgICA6IG5ldyBNZXRlb3IuX0FzeW5jaHJvbm91c1F1ZXVlKCk7XG5cbiAgICB0aGlzLm5leHRfcWlkID0gMTsgLy8gbGl2ZSBxdWVyeSBpZCBnZW5lcmF0b3JcblxuICAgIC8vIHFpZCAtPiBsaXZlIHF1ZXJ5IG9iamVjdC4ga2V5czpcbiAgICAvLyAgb3JkZXJlZDogYm9vbC4gb3JkZXJlZCBxdWVyaWVzIGhhdmUgYWRkZWRCZWZvcmUvbW92ZWRCZWZvcmUgY2FsbGJhY2tzLlxuICAgIC8vICByZXN1bHRzOiBhcnJheSAob3JkZXJlZCkgb3Igb2JqZWN0ICh1bm9yZGVyZWQpIG9mIGN1cnJlbnQgcmVzdWx0c1xuICAgIC8vICAgIChhbGlhc2VkIHdpdGggdGhpcy5fZG9jcyEpXG4gICAgLy8gIHJlc3VsdHNTbmFwc2hvdDogc25hcHNob3Qgb2YgcmVzdWx0cy4gbnVsbCBpZiBub3QgcGF1c2VkLlxuICAgIC8vICBjdXJzb3I6IEN1cnNvciBvYmplY3QgZm9yIHRoZSBxdWVyeS5cbiAgICAvLyAgc2VsZWN0b3IsIHNvcnRlciwgKGNhbGxiYWNrcyk6IGZ1bmN0aW9uc1xuICAgIHRoaXMucXVlcmllcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICAvLyBudWxsIGlmIG5vdCBzYXZpbmcgb3JpZ2luYWxzOyBhbiBJZE1hcCBmcm9tIGlkIHRvIG9yaWdpbmFsIGRvY3VtZW50IHZhbHVlXG4gICAgLy8gaWYgc2F2aW5nIG9yaWdpbmFscy4gU2VlIGNvbW1lbnRzIGJlZm9yZSBzYXZlT3JpZ2luYWxzKCkuXG4gICAgdGhpcy5fc2F2ZWRPcmlnaW5hbHMgPSBudWxsO1xuXG4gICAgLy8gVHJ1ZSB3aGVuIG9ic2VydmVycyBhcmUgcGF1c2VkIGFuZCB3ZSBzaG91bGQgbm90IHNlbmQgY2FsbGJhY2tzLlxuICAgIHRoaXMucGF1c2VkID0gZmFsc2U7XG4gIH1cblxuICBjb3VudERvY3VtZW50cyhzZWxlY3Rvciwgb3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLmZpbmQoc2VsZWN0b3IgPz8ge30sIG9wdGlvbnMpLmNvdW50QXN5bmMoKTtcbiAgfVxuXG4gIGVzdGltYXRlZERvY3VtZW50Q291bnQob3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLmZpbmQoe30sIG9wdGlvbnMpLmNvdW50QXN5bmMoKTtcbiAgfVxuXG4gIC8vIG9wdGlvbnMgbWF5IGluY2x1ZGUgc29ydCwgc2tpcCwgbGltaXQsIHJlYWN0aXZlXG4gIC8vIHNvcnQgbWF5IGJlIGFueSBvZiB0aGVzZSBmb3JtczpcbiAgLy8gICAgIHthOiAxLCBiOiAtMX1cbiAgLy8gICAgIFtbXCJhXCIsIFwiYXNjXCJdLCBbXCJiXCIsIFwiZGVzY1wiXV1cbiAgLy8gICAgIFtcImFcIiwgW1wiYlwiLCBcImRlc2NcIl1dXG4gIC8vICAgKGluIHRoZSBmaXJzdCBmb3JtIHlvdSdyZSBiZWhvbGRlbiB0byBrZXkgZW51bWVyYXRpb24gb3JkZXIgaW5cbiAgLy8gICB5b3VyIGphdmFzY3JpcHQgVk0pXG4gIC8vXG4gIC8vIHJlYWN0aXZlOiBpZiBnaXZlbiwgYW5kIGZhbHNlLCBkb24ndCByZWdpc3RlciB3aXRoIFRyYWNrZXIgKGRlZmF1bHRcbiAgLy8gaXMgdHJ1ZSlcbiAgLy9cbiAgLy8gWFhYIHBvc3NpYmx5IHNob3VsZCBzdXBwb3J0IHJldHJpZXZpbmcgYSBzdWJzZXQgb2YgZmllbGRzPyBhbmRcbiAgLy8gaGF2ZSBpdCBiZSBhIGhpbnQgKGlnbm9yZWQgb24gdGhlIGNsaWVudCwgd2hlbiBub3QgY29weWluZyB0aGVcbiAgLy8gZG9jPylcbiAgLy9cbiAgLy8gWFhYIHNvcnQgZG9lcyBub3QgeWV0IHN1cHBvcnQgc3Via2V5cyAoJ2EuYicpIC4uIGZpeCB0aGF0IVxuICAvLyBYWFggYWRkIG9uZSBtb3JlIHNvcnQgZm9ybTogXCJrZXlcIlxuICAvLyBYWFggdGVzdHNcbiAgZmluZChzZWxlY3Rvciwgb3B0aW9ucykge1xuICAgIC8vIGRlZmF1bHQgc3ludGF4IGZvciBldmVyeXRoaW5nIGlzIHRvIG9taXQgdGhlIHNlbGVjdG9yIGFyZ3VtZW50LlxuICAgIC8vIGJ1dCBpZiBzZWxlY3RvciBpcyBleHBsaWNpdGx5IHBhc3NlZCBpbiBhcyBmYWxzZSBvciB1bmRlZmluZWQsIHdlXG4gICAgLy8gd2FudCBhIHNlbGVjdG9yIHRoYXQgbWF0Y2hlcyBub3RoaW5nLlxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBzZWxlY3RvciA9IHt9O1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgTG9jYWxDb2xsZWN0aW9uLkN1cnNvcih0aGlzLCBzZWxlY3Rvciwgb3B0aW9ucyk7XG4gIH1cblxuICBmaW5kT25lKHNlbGVjdG9yLCBvcHRpb25zID0ge30pIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgc2VsZWN0b3IgPSB7fTtcbiAgICB9XG5cbiAgICAvLyBOT1RFOiBieSBzZXR0aW5nIGxpbWl0IDEgaGVyZSwgd2UgZW5kIHVwIHVzaW5nIHZlcnkgaW5lZmZpY2llbnRcbiAgICAvLyBjb2RlIHRoYXQgcmVjb21wdXRlcyB0aGUgd2hvbGUgcXVlcnkgb24gZWFjaCB1cGRhdGUuIFRoZSB1cHNpZGUgaXNcbiAgICAvLyB0aGF0IHdoZW4geW91IHJlYWN0aXZlbHkgZGVwZW5kIG9uIGEgZmluZE9uZSB5b3Ugb25seSBnZXRcbiAgICAvLyBpbnZhbGlkYXRlZCB3aGVuIHRoZSBmb3VuZCBvYmplY3QgY2hhbmdlcywgbm90IGFueSBvYmplY3QgaW4gdGhlXG4gICAgLy8gY29sbGVjdGlvbi4gTW9zdCBmaW5kT25lIHdpbGwgYmUgYnkgaWQsIHdoaWNoIGhhcyBhIGZhc3QgcGF0aCwgc29cbiAgICAvLyB0aGlzIG1pZ2h0IG5vdCBiZSBhIGJpZyBkZWFsLiBJbiBtb3N0IGNhc2VzLCBpbnZhbGlkYXRpb24gY2F1c2VzXG4gICAgLy8gdGhlIGNhbGxlZCB0byByZS1xdWVyeSBhbnl3YXksIHNvIHRoaXMgc2hvdWxkIGJlIGEgbmV0IHBlcmZvcm1hbmNlXG4gICAgLy8gaW1wcm92ZW1lbnQuXG4gICAgb3B0aW9ucy5saW1pdCA9IDE7XG5cbiAgICByZXR1cm4gdGhpcy5maW5kKHNlbGVjdG9yLCBvcHRpb25zKS5mZXRjaCgpWzBdO1xuICB9XG4gIGFzeW5jIGZpbmRPbmVBc3luYyhzZWxlY3Rvciwgb3B0aW9ucyA9IHt9KSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIHNlbGVjdG9yID0ge307XG4gICAgfVxuICAgIG9wdGlvbnMubGltaXQgPSAxO1xuICAgIHJldHVybiAoYXdhaXQgdGhpcy5maW5kKHNlbGVjdG9yLCBvcHRpb25zKS5mZXRjaEFzeW5jKCkpWzBdO1xuICB9XG4gIHByZXBhcmVJbnNlcnQoZG9jKSB7XG4gICAgYXNzZXJ0SGFzVmFsaWRGaWVsZE5hbWVzKGRvYyk7XG5cbiAgICAvLyBpZiB5b3UgcmVhbGx5IHdhbnQgdG8gdXNlIE9iamVjdElEcywgc2V0IHRoaXMgZ2xvYmFsLlxuICAgIC8vIE1vbmdvLkNvbGxlY3Rpb24gc3BlY2lmaWVzIGl0cyBvd24gaWRzIGFuZCBkb2VzIG5vdCB1c2UgdGhpcyBjb2RlLlxuICAgIGlmICghaGFzT3duLmNhbGwoZG9jLCAnX2lkJykpIHtcbiAgICAgIGRvYy5faWQgPSBMb2NhbENvbGxlY3Rpb24uX3VzZU9JRCA/IG5ldyBNb25nb0lELk9iamVjdElEKCkgOiBSYW5kb20uaWQoKTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IGRvYy5faWQ7XG5cbiAgICBpZiAodGhpcy5fZG9jcy5oYXMoaWQpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihgRHVwbGljYXRlIF9pZCAnJHtpZH0nYCk7XG4gICAgfVxuXG4gICAgdGhpcy5fc2F2ZU9yaWdpbmFsKGlkLCB1bmRlZmluZWQpO1xuICAgIHRoaXMuX2RvY3Muc2V0KGlkLCBkb2MpO1xuXG4gICAgcmV0dXJuIGlkO1xuICB9XG5cbiAgLy8gWFhYIHBvc3NpYmx5IGVuZm9yY2UgdGhhdCAndW5kZWZpbmVkJyBkb2VzIG5vdCBhcHBlYXIgKHdlIGFzc3VtZVxuICAvLyB0aGlzIGluIG91ciBoYW5kbGluZyBvZiBudWxsIGFuZCAkZXhpc3RzKVxuICBpbnNlcnQoZG9jLCBjYWxsYmFjaykge1xuICAgIGRvYyA9IEVKU09OLmNsb25lKGRvYyk7XG4gICAgY29uc3QgaWQgPSB0aGlzLnByZXBhcmVJbnNlcnQoZG9jKTtcbiAgICBjb25zdCBxdWVyaWVzVG9SZWNvbXB1dGUgPSBbXTtcblxuICAgIC8vIHRyaWdnZXIgbGl2ZSBxdWVyaWVzIHRoYXQgbWF0Y2hcbiAgICBmb3IgKGNvbnN0IHFpZCBvZiBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkuZGlydHkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1hdGNoUmVzdWx0ID0gcXVlcnkubWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKTtcblxuICAgICAgaWYgKG1hdGNoUmVzdWx0LnJlc3VsdCkge1xuICAgICAgICBpZiAocXVlcnkuZGlzdGFuY2VzICYmIG1hdGNoUmVzdWx0LmRpc3RhbmNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBxdWVyeS5kaXN0YW5jZXMuc2V0KGlkLCBtYXRjaFJlc3VsdC5kaXN0YW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocXVlcnkuY3Vyc29yLnNraXAgfHwgcXVlcnkuY3Vyc29yLmxpbWl0KSB7XG4gICAgICAgICAgcXVlcmllc1RvUmVjb21wdXRlLnB1c2gocWlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBMb2NhbENvbGxlY3Rpb24uX2luc2VydEluUmVzdWx0c1N5bmMocXVlcnksIGRvYyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBxdWVyaWVzVG9SZWNvbXB1dGUuZm9yRWFjaChxaWQgPT4ge1xuICAgICAgaWYgKHRoaXMucXVlcmllc1txaWRdKSB7XG4gICAgICAgIHRoaXMuX3JlY29tcHV0ZVJlc3VsdHModGhpcy5xdWVyaWVzW3FpZF0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5fb2JzZXJ2ZVF1ZXVlLmRyYWluKCk7XG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBNZXRlb3IuZGVmZXIoKCkgPT4ge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBpZCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgYXN5bmMgaW5zZXJ0QXN5bmMoZG9jLCBjYWxsYmFjaykge1xuICAgIGRvYyA9IEVKU09OLmNsb25lKGRvYyk7XG4gICAgY29uc3QgaWQgPSB0aGlzLnByZXBhcmVJbnNlcnQoZG9jKTtcbiAgICBjb25zdCBxdWVyaWVzVG9SZWNvbXB1dGUgPSBbXTtcblxuICAgIC8vIHRyaWdnZXIgbGl2ZSBxdWVyaWVzIHRoYXQgbWF0Y2hcbiAgICBmb3IgKGNvbnN0IHFpZCBvZiBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkuZGlydHkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1hdGNoUmVzdWx0ID0gcXVlcnkubWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKTtcblxuICAgICAgaWYgKG1hdGNoUmVzdWx0LnJlc3VsdCkge1xuICAgICAgICBpZiAocXVlcnkuZGlzdGFuY2VzICYmIG1hdGNoUmVzdWx0LmRpc3RhbmNlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBxdWVyeS5kaXN0YW5jZXMuc2V0KGlkLCBtYXRjaFJlc3VsdC5kaXN0YW5jZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocXVlcnkuY3Vyc29yLnNraXAgfHwgcXVlcnkuY3Vyc29yLmxpbWl0KSB7XG4gICAgICAgICAgcXVlcmllc1RvUmVjb21wdXRlLnB1c2gocWlkKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBhd2FpdCBMb2NhbENvbGxlY3Rpb24uX2luc2VydEluUmVzdWx0c0FzeW5jKHF1ZXJ5LCBkb2MpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcXVlcmllc1RvUmVjb21wdXRlLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGlmICh0aGlzLnF1ZXJpZXNbcWlkXSkge1xuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHRoaXMucXVlcmllc1txaWRdKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgTWV0ZW9yLmRlZmVyKCgpID0+IHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgaWQpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGlkO1xuICB9XG5cbiAgLy8gUGF1c2UgdGhlIG9ic2VydmVycy4gTm8gY2FsbGJhY2tzIGZyb20gb2JzZXJ2ZXJzIHdpbGwgZmlyZSB1bnRpbFxuICAvLyAncmVzdW1lT2JzZXJ2ZXJzJyBpcyBjYWxsZWQuXG4gIHBhdXNlT2JzZXJ2ZXJzKCkge1xuICAgIC8vIE5vLW9wIGlmIGFscmVhZHkgcGF1c2VkLlxuICAgIGlmICh0aGlzLnBhdXNlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFNldCB0aGUgJ3BhdXNlZCcgZmxhZyBzdWNoIHRoYXQgbmV3IG9ic2VydmVyIG1lc3NhZ2VzIGRvbid0IGZpcmUuXG4gICAgdGhpcy5wYXVzZWQgPSB0cnVlO1xuXG4gICAgLy8gVGFrZSBhIHNuYXBzaG90IG9mIHRoZSBxdWVyeSByZXN1bHRzIGZvciBlYWNoIHF1ZXJ5LlxuICAgIE9iamVjdC5rZXlzKHRoaXMucXVlcmllcykuZm9yRWFjaChxaWQgPT4ge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcbiAgICAgIHF1ZXJ5LnJlc3VsdHNTbmFwc2hvdCA9IEVKU09OLmNsb25lKHF1ZXJ5LnJlc3VsdHMpO1xuICAgIH0pO1xuICB9XG5cbiAgY2xlYXJSZXN1bHRRdWVyaWVzKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5fZG9jcy5zaXplKCk7XG5cbiAgICB0aGlzLl9kb2NzLmNsZWFyKCk7XG5cbiAgICBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeS5vcmRlcmVkKSB7XG4gICAgICAgIHF1ZXJ5LnJlc3VsdHMgPSBbXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXJ5LnJlc3VsdHMuY2xlYXIoKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgTWV0ZW9yLmRlZmVyKCgpID0+IHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuXG4gIHByZXBhcmVSZW1vdmUoc2VsZWN0b3IpIHtcbiAgICBjb25zdCBtYXRjaGVyID0gbmV3IE1pbmltb25nby5NYXRjaGVyKHNlbGVjdG9yKTtcbiAgICBjb25zdCByZW1vdmUgPSBbXTtcblxuICAgIHRoaXMuX2VhY2hQb3NzaWJseU1hdGNoaW5nRG9jU3luYyhzZWxlY3RvciwgKGRvYywgaWQpID0+IHtcbiAgICAgIGlmIChtYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhkb2MpLnJlc3VsdCkge1xuICAgICAgICByZW1vdmUucHVzaChpZCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCBxdWVyaWVzVG9SZWNvbXB1dGUgPSBbXTtcbiAgICBjb25zdCBxdWVyeVJlbW92ZSA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCByZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHJlbW92ZUlkID0gcmVtb3ZlW2ldO1xuICAgICAgY29uc3QgcmVtb3ZlRG9jID0gdGhpcy5fZG9jcy5nZXQocmVtb3ZlSWQpO1xuXG4gICAgICBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgICBpZiAocXVlcnkuZGlydHkpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocXVlcnkubWF0Y2hlci5kb2N1bWVudE1hdGNoZXMocmVtb3ZlRG9jKS5yZXN1bHQpIHtcbiAgICAgICAgICBpZiAocXVlcnkuY3Vyc29yLnNraXAgfHwgcXVlcnkuY3Vyc29yLmxpbWl0KSB7XG4gICAgICAgICAgICBxdWVyaWVzVG9SZWNvbXB1dGUucHVzaChxaWQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBxdWVyeVJlbW92ZS5wdXNoKHtxaWQsIGRvYzogcmVtb3ZlRG9jfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5fc2F2ZU9yaWdpbmFsKHJlbW92ZUlkLCByZW1vdmVEb2MpO1xuICAgICAgdGhpcy5fZG9jcy5yZW1vdmUocmVtb3ZlSWQpO1xuICAgIH1cblxuICAgIHJldHVybiB7IHF1ZXJpZXNUb1JlY29tcHV0ZSwgcXVlcnlSZW1vdmUsIHJlbW92ZSB9O1xuICB9XG5cbiAgcmVtb3ZlKHNlbGVjdG9yLCBjYWxsYmFjaykge1xuICAgIC8vIEVhc3kgc3BlY2lhbCBjYXNlOiBpZiB3ZSdyZSBub3QgY2FsbGluZyBvYnNlcnZlQ2hhbmdlcyBjYWxsYmFja3MgYW5kXG4gICAgLy8gd2UncmUgbm90IHNhdmluZyBvcmlnaW5hbHMgYW5kIHdlIGdvdCBhc2tlZCB0byByZW1vdmUgZXZlcnl0aGluZywgdGhlblxuICAgIC8vIGp1c3QgZW1wdHkgZXZlcnl0aGluZyBkaXJlY3RseS5cbiAgICBpZiAodGhpcy5wYXVzZWQgJiYgIXRoaXMuX3NhdmVkT3JpZ2luYWxzICYmIEVKU09OLmVxdWFscyhzZWxlY3Rvciwge30pKSB7XG4gICAgICByZXR1cm4gdGhpcy5jbGVhclJlc3VsdFF1ZXJpZXMoY2FsbGJhY2spO1xuICAgIH1cblxuICAgIGNvbnN0IHsgcXVlcmllc1RvUmVjb21wdXRlLCBxdWVyeVJlbW92ZSwgcmVtb3ZlIH0gPSB0aGlzLnByZXBhcmVSZW1vdmUoc2VsZWN0b3IpO1xuXG4gICAgLy8gcnVuIGxpdmUgcXVlcnkgY2FsbGJhY2tzIF9hZnRlcl8gd2UndmUgcmVtb3ZlZCB0aGUgZG9jdW1lbnRzLlxuICAgIHF1ZXJ5UmVtb3ZlLmZvckVhY2gocmVtb3ZlID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3JlbW92ZS5xaWRdO1xuXG4gICAgICBpZiAocXVlcnkpIHtcbiAgICAgICAgcXVlcnkuZGlzdGFuY2VzICYmIHF1ZXJ5LmRpc3RhbmNlcy5yZW1vdmUocmVtb3ZlLmRvYy5faWQpO1xuICAgICAgICBMb2NhbENvbGxlY3Rpb24uX3JlbW92ZUZyb21SZXN1bHRzU3luYyhxdWVyeSwgcmVtb3ZlLmRvYyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBxdWVyaWVzVG9SZWNvbXB1dGUuZm9yRWFjaChxaWQgPT4ge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgIHRoaXMuX3JlY29tcHV0ZVJlc3VsdHMocXVlcnkpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5fb2JzZXJ2ZVF1ZXVlLmRyYWluKCk7XG5cbiAgICBjb25zdCByZXN1bHQgPSByZW1vdmUubGVuZ3RoO1xuXG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBNZXRlb3IuZGVmZXIoKCkgPT4ge1xuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGFzeW5jIHJlbW92ZUFzeW5jKHNlbGVjdG9yLCBjYWxsYmFjaykge1xuICAgIC8vIEVhc3kgc3BlY2lhbCBjYXNlOiBpZiB3ZSdyZSBub3QgY2FsbGluZyBvYnNlcnZlQ2hhbmdlcyBjYWxsYmFja3MgYW5kXG4gICAgLy8gd2UncmUgbm90IHNhdmluZyBvcmlnaW5hbHMgYW5kIHdlIGdvdCBhc2tlZCB0byByZW1vdmUgZXZlcnl0aGluZywgdGhlblxuICAgIC8vIGp1c3QgZW1wdHkgZXZlcnl0aGluZyBkaXJlY3RseS5cbiAgICBpZiAodGhpcy5wYXVzZWQgJiYgIXRoaXMuX3NhdmVkT3JpZ2luYWxzICYmIEVKU09OLmVxdWFscyhzZWxlY3Rvciwge30pKSB7XG4gICAgICByZXR1cm4gdGhpcy5jbGVhclJlc3VsdFF1ZXJpZXMoY2FsbGJhY2spO1xuICAgIH1cblxuICAgIGNvbnN0IHsgcXVlcmllc1RvUmVjb21wdXRlLCBxdWVyeVJlbW92ZSwgcmVtb3ZlIH0gPSB0aGlzLnByZXBhcmVSZW1vdmUoc2VsZWN0b3IpO1xuXG4gICAgLy8gcnVuIGxpdmUgcXVlcnkgY2FsbGJhY2tzIF9hZnRlcl8gd2UndmUgcmVtb3ZlZCB0aGUgZG9jdW1lbnRzLlxuICAgIGZvciAoY29uc3QgcmVtb3ZlIG9mIHF1ZXJ5UmVtb3ZlKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1tyZW1vdmUucWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgIHF1ZXJ5LmRpc3RhbmNlcyAmJiBxdWVyeS5kaXN0YW5jZXMucmVtb3ZlKHJlbW92ZS5kb2MuX2lkKTtcbiAgICAgICAgYXdhaXQgTG9jYWxDb2xsZWN0aW9uLl9yZW1vdmVGcm9tUmVzdWx0c0FzeW5jKHF1ZXJ5LCByZW1vdmUuZG9jKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcXVlcmllc1RvUmVjb21wdXRlLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGF3YWl0IHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuXG4gICAgY29uc3QgcmVzdWx0ID0gcmVtb3ZlLmxlbmd0aDtcblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgTWV0ZW9yLmRlZmVyKCgpID0+IHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBSZXN1bWUgdGhlIG9ic2VydmVycy4gT2JzZXJ2ZXJzIGltbWVkaWF0ZWx5IHJlY2VpdmUgY2hhbmdlXG4gIC8vIG5vdGlmaWNhdGlvbnMgdG8gYnJpbmcgdGhlbSB0byB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGVcbiAgLy8gZGF0YWJhc2UuIE5vdGUgdGhhdCB0aGlzIGlzIG5vdCBqdXN0IHJlcGxheWluZyBhbGwgdGhlIGNoYW5nZXMgdGhhdFxuICAvLyBoYXBwZW5lZCBkdXJpbmcgdGhlIHBhdXNlLCBpdCBpcyBhIHNtYXJ0ZXIgJ2NvYWxlc2NlZCcgZGlmZi5cbiAgX3Jlc3VtZU9ic2VydmVycygpIHtcbiAgICAvLyBOby1vcCBpZiBub3QgcGF1c2VkLlxuICAgIGlmICghdGhpcy5wYXVzZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBVbnNldCB0aGUgJ3BhdXNlZCcgZmxhZy4gTWFrZSBzdXJlIHRvIGRvIHRoaXMgZmlyc3QsIG90aGVyd2lzZVxuICAgIC8vIG9ic2VydmVyIG1ldGhvZHMgd29uJ3QgYWN0dWFsbHkgZmlyZSB3aGVuIHdlIHRyaWdnZXIgdGhlbS5cbiAgICB0aGlzLnBhdXNlZCA9IGZhbHNlO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5xdWVyaWVzKS5mb3JFYWNoKHFpZCA9PiB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkuZGlydHkpIHtcbiAgICAgICAgcXVlcnkuZGlydHkgPSBmYWxzZTtcblxuICAgICAgICAvLyByZS1jb21wdXRlIHJlc3VsdHMgd2lsbCBwZXJmb3JtIGBMb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeUNoYW5nZXNgXG4gICAgICAgIC8vIGF1dG9tYXRpY2FsbHkuXG4gICAgICAgIHRoaXMuX3JlY29tcHV0ZVJlc3VsdHMocXVlcnksIHF1ZXJ5LnJlc3VsdHNTbmFwc2hvdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBEaWZmIHRoZSBjdXJyZW50IHJlc3VsdHMgYWdhaW5zdCB0aGUgc25hcHNob3QgYW5kIHNlbmQgdG8gb2JzZXJ2ZXJzLlxuICAgICAgICAvLyBwYXNzIHRoZSBxdWVyeSBvYmplY3QgZm9yIGl0cyBvYnNlcnZlciBjYWxsYmFja3MuXG4gICAgICAgIExvY2FsQ29sbGVjdGlvbi5fZGlmZlF1ZXJ5Q2hhbmdlcyhcbiAgICAgICAgICBxdWVyeS5vcmRlcmVkLFxuICAgICAgICAgIHF1ZXJ5LnJlc3VsdHNTbmFwc2hvdCxcbiAgICAgICAgICBxdWVyeS5yZXN1bHRzLFxuICAgICAgICAgIHF1ZXJ5LFxuICAgICAgICAgIHtwcm9qZWN0aW9uRm46IHF1ZXJ5LnByb2plY3Rpb25Gbn1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcXVlcnkucmVzdWx0c1NuYXBzaG90ID0gbnVsbDtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIHJlc3VtZU9ic2VydmVyc1NlcnZlcigpIHtcbiAgICB0aGlzLl9yZXN1bWVPYnNlcnZlcnMoKTtcbiAgICBhd2FpdCB0aGlzLl9vYnNlcnZlUXVldWUuZHJhaW4oKTtcbiAgfVxuICByZXN1bWVPYnNlcnZlcnNDbGllbnQoKSB7XG4gICAgdGhpcy5fcmVzdW1lT2JzZXJ2ZXJzKCk7XG4gICAgdGhpcy5fb2JzZXJ2ZVF1ZXVlLmRyYWluKCk7XG4gIH1cblxuICByZXRyaWV2ZU9yaWdpbmFscygpIHtcbiAgICBpZiAoIXRoaXMuX3NhdmVkT3JpZ2luYWxzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbGxlZCByZXRyaWV2ZU9yaWdpbmFscyB3aXRob3V0IHNhdmVPcmlnaW5hbHMnKTtcbiAgICB9XG5cbiAgICBjb25zdCBvcmlnaW5hbHMgPSB0aGlzLl9zYXZlZE9yaWdpbmFscztcblxuICAgIHRoaXMuX3NhdmVkT3JpZ2luYWxzID0gbnVsbDtcblxuICAgIHJldHVybiBvcmlnaW5hbHM7XG4gIH1cblxuICAvLyBUbyB0cmFjayB3aGF0IGRvY3VtZW50cyBhcmUgYWZmZWN0ZWQgYnkgYSBwaWVjZSBvZiBjb2RlLCBjYWxsXG4gIC8vIHNhdmVPcmlnaW5hbHMoKSBiZWZvcmUgaXQgYW5kIHJldHJpZXZlT3JpZ2luYWxzKCkgYWZ0ZXIgaXQuXG4gIC8vIHJldHJpZXZlT3JpZ2luYWxzIHJldHVybnMgYW4gb2JqZWN0IHdob3NlIGtleXMgYXJlIHRoZSBpZHMgb2YgdGhlIGRvY3VtZW50c1xuICAvLyB0aGF0IHdlcmUgYWZmZWN0ZWQgc2luY2UgdGhlIGNhbGwgdG8gc2F2ZU9yaWdpbmFscygpLCBhbmQgdGhlIHZhbHVlcyBhcmVcbiAgLy8gZXF1YWwgdG8gdGhlIGRvY3VtZW50J3MgY29udGVudHMgYXQgdGhlIHRpbWUgb2Ygc2F2ZU9yaWdpbmFscy4gKEluIHRoZSBjYXNlXG4gIC8vIG9mIGFuIGluc2VydGVkIGRvY3VtZW50LCB1bmRlZmluZWQgaXMgdGhlIHZhbHVlLikgWW91IG11c3QgYWx0ZXJuYXRlXG4gIC8vIGJldHdlZW4gY2FsbHMgdG8gc2F2ZU9yaWdpbmFscygpIGFuZCByZXRyaWV2ZU9yaWdpbmFscygpLlxuICBzYXZlT3JpZ2luYWxzKCkge1xuICAgIGlmICh0aGlzLl9zYXZlZE9yaWdpbmFscykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYWxsZWQgc2F2ZU9yaWdpbmFscyB0d2ljZSB3aXRob3V0IHJldHJpZXZlT3JpZ2luYWxzJyk7XG4gICAgfVxuXG4gICAgdGhpcy5fc2F2ZWRPcmlnaW5hbHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgfVxuXG4gIHByZXBhcmVVcGRhdGUoc2VsZWN0b3IpIHtcbiAgICAvLyBTYXZlIHRoZSBvcmlnaW5hbCByZXN1bHRzIG9mIGFueSBxdWVyeSB0aGF0IHdlIG1pZ2h0IG5lZWQgdG9cbiAgICAvLyBfcmVjb21wdXRlUmVzdWx0cyBvbiwgYmVjYXVzZSBfbW9kaWZ5QW5kTm90aWZ5IHdpbGwgbXV0YXRlIHRoZSBvYmplY3RzIGluXG4gICAgLy8gaXQuIChXZSBkb24ndCBuZWVkIHRvIHNhdmUgdGhlIG9yaWdpbmFsIHJlc3VsdHMgb2YgcGF1c2VkIHF1ZXJpZXMgYmVjYXVzZVxuICAgIC8vIHRoZXkgYWxyZWFkeSBoYXZlIGEgcmVzdWx0c1NuYXBzaG90IGFuZCB3ZSB3b24ndCBiZSBkaWZmaW5nIGluXG4gICAgLy8gX3JlY29tcHV0ZVJlc3VsdHMuKVxuICAgIGNvbnN0IHFpZFRvT3JpZ2luYWxSZXN1bHRzID0ge307XG5cbiAgICAvLyBXZSBzaG91bGQgb25seSBjbG9uZSBlYWNoIGRvY3VtZW50IG9uY2UsIGV2ZW4gaWYgaXQgYXBwZWFycyBpbiBtdWx0aXBsZVxuICAgIC8vIHF1ZXJpZXNcbiAgICBjb25zdCBkb2NNYXAgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICBjb25zdCBpZHNNYXRjaGVkID0gTG9jYWxDb2xsZWN0aW9uLl9pZHNNYXRjaGVkQnlTZWxlY3RvcihzZWxlY3Rvcik7XG5cbiAgICBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmICgocXVlcnkuY3Vyc29yLnNraXAgfHwgcXVlcnkuY3Vyc29yLmxpbWl0KSAmJiAhIHRoaXMucGF1c2VkKSB7XG4gICAgICAgIC8vIENhdGNoIHRoZSBjYXNlIG9mIGEgcmVhY3RpdmUgYGNvdW50KClgIG9uIGEgY3Vyc29yIHdpdGggc2tpcFxuICAgICAgICAvLyBvciBsaW1pdCwgd2hpY2ggcmVnaXN0ZXJzIGFuIHVub3JkZXJlZCBvYnNlcnZlLiBUaGlzIGlzIGFcbiAgICAgICAgLy8gcHJldHR5IHJhcmUgY2FzZSwgc28gd2UganVzdCBjbG9uZSB0aGUgZW50aXJlIHJlc3VsdCBzZXQgd2l0aFxuICAgICAgICAvLyBubyBvcHRpbWl6YXRpb25zIGZvciBkb2N1bWVudHMgdGhhdCBhcHBlYXIgaW4gdGhlc2UgcmVzdWx0XG4gICAgICAgIC8vIHNldHMgYW5kIG90aGVyIHF1ZXJpZXMuXG4gICAgICAgIGlmIChxdWVyeS5yZXN1bHRzIGluc3RhbmNlb2YgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcCkge1xuICAgICAgICAgIHFpZFRvT3JpZ2luYWxSZXN1bHRzW3FpZF0gPSBxdWVyeS5yZXN1bHRzLmNsb25lKCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCEocXVlcnkucmVzdWx0cyBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQXNzZXJ0aW9uIGZhaWxlZDogcXVlcnkucmVzdWx0cyBub3QgYW4gYXJyYXknKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENsb25lcyBhIGRvY3VtZW50IHRvIGJlIHN0b3JlZCBpbiBgcWlkVG9PcmlnaW5hbFJlc3VsdHNgXG4gICAgICAgIC8vIGJlY2F1c2UgaXQgbWF5IGJlIG1vZGlmaWVkIGJlZm9yZSB0aGUgbmV3IGFuZCBvbGQgcmVzdWx0IHNldHNcbiAgICAgICAgLy8gYXJlIGRpZmZlZC4gQnV0IGlmIHdlIGtub3cgZXhhY3RseSB3aGljaCBkb2N1bWVudCBJRHMgd2UncmVcbiAgICAgICAgLy8gZ29pbmcgdG8gbW9kaWZ5LCB0aGVuIHdlIG9ubHkgbmVlZCB0byBjbG9uZSB0aG9zZS5cbiAgICAgICAgY29uc3QgbWVtb2l6ZWRDbG9uZUlmTmVlZGVkID0gZG9jID0+IHtcbiAgICAgICAgICBpZiAoZG9jTWFwLmhhcyhkb2MuX2lkKSkge1xuICAgICAgICAgICAgcmV0dXJuIGRvY01hcC5nZXQoZG9jLl9pZCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZG9jVG9NZW1vaXplID0gKFxuICAgICAgICAgICAgaWRzTWF0Y2hlZCAmJlxuICAgICAgICAgICAgIWlkc01hdGNoZWQuc29tZShpZCA9PiBFSlNPTi5lcXVhbHMoaWQsIGRvYy5faWQpKVxuICAgICAgICAgICkgPyBkb2MgOiBFSlNPTi5jbG9uZShkb2MpO1xuXG4gICAgICAgICAgZG9jTWFwLnNldChkb2MuX2lkLCBkb2NUb01lbW9pemUpO1xuXG4gICAgICAgICAgcmV0dXJuIGRvY1RvTWVtb2l6ZTtcbiAgICAgICAgfTtcblxuICAgICAgICBxaWRUb09yaWdpbmFsUmVzdWx0c1txaWRdID0gcXVlcnkucmVzdWx0cy5tYXAobWVtb2l6ZWRDbG9uZUlmTmVlZGVkKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBxaWRUb09yaWdpbmFsUmVzdWx0cztcbiAgfVxuXG4gIGZpbmlzaFVwZGF0ZSh7IG9wdGlvbnMsIHVwZGF0ZUNvdW50LCBjYWxsYmFjaywgaW5zZXJ0ZWRJZCB9KSB7XG5cblxuICAgIC8vIFJldHVybiB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkIGRvY3VtZW50cywgb3IgaW4gdGhlIHVwc2VydCBjYXNlLCBhbiBvYmplY3RcbiAgICAvLyBjb250YWluaW5nIHRoZSBudW1iZXIgb2YgYWZmZWN0ZWQgZG9jcyBhbmQgdGhlIGlkIG9mIHRoZSBkb2MgdGhhdCB3YXNcbiAgICAvLyBpbnNlcnRlZCwgaWYgYW55LlxuICAgIGxldCByZXN1bHQ7XG4gICAgaWYgKG9wdGlvbnMuX3JldHVybk9iamVjdCkge1xuICAgICAgcmVzdWx0ID0geyBudW1iZXJBZmZlY3RlZDogdXBkYXRlQ291bnQgfTtcblxuICAgICAgaWYgKGluc2VydGVkSWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXN1bHQuaW5zZXJ0ZWRJZCA9IGluc2VydGVkSWQ7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IHVwZGF0ZUNvdW50O1xuICAgIH1cblxuICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgTWV0ZW9yLmRlZmVyKCgpID0+IHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBYWFggYXRvbWljaXR5OiBpZiBtdWx0aSBpcyB0cnVlLCBhbmQgb25lIG1vZGlmaWNhdGlvbiBmYWlscywgZG9cbiAgLy8gd2Ugcm9sbGJhY2sgdGhlIHdob2xlIG9wZXJhdGlvbiwgb3Igd2hhdD9cbiAgYXN5bmMgdXBkYXRlQXN5bmMoc2VsZWN0b3IsIG1vZCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoISBjYWxsYmFjayAmJiBvcHRpb25zIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIGNhbGxiYWNrID0gb3B0aW9ucztcbiAgICAgIG9wdGlvbnMgPSBudWxsO1xuICAgIH1cblxuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoc2VsZWN0b3IsIHRydWUpO1xuXG4gICAgY29uc3QgcWlkVG9PcmlnaW5hbFJlc3VsdHMgPSB0aGlzLnByZXBhcmVVcGRhdGUoc2VsZWN0b3IpO1xuXG4gICAgbGV0IHJlY29tcHV0ZVFpZHMgPSB7fTtcblxuICAgIGxldCB1cGRhdGVDb3VudCA9IDA7XG5cbiAgICBhd2FpdCB0aGlzLl9lYWNoUG9zc2libHlNYXRjaGluZ0RvY0FzeW5jKHNlbGVjdG9yLCBhc3luYyAoZG9jLCBpZCkgPT4ge1xuICAgICAgY29uc3QgcXVlcnlSZXN1bHQgPSBtYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhkb2MpO1xuXG4gICAgICBpZiAocXVlcnlSZXN1bHQucmVzdWx0KSB7XG4gICAgICAgIC8vIFhYWCBTaG91bGQgd2Ugc2F2ZSB0aGUgb3JpZ2luYWwgZXZlbiBpZiBtb2QgZW5kcyB1cCBiZWluZyBhIG5vLW9wP1xuICAgICAgICB0aGlzLl9zYXZlT3JpZ2luYWwoaWQsIGRvYyk7XG4gICAgICAgIHJlY29tcHV0ZVFpZHMgPSBhd2FpdCB0aGlzLl9tb2RpZnlBbmROb3RpZnlBc3luYyhcbiAgICAgICAgICBkb2MsXG4gICAgICAgICAgbW9kLFxuICAgICAgICAgIHF1ZXJ5UmVzdWx0LmFycmF5SW5kaWNlc1xuICAgICAgICApO1xuXG4gICAgICAgICsrdXBkYXRlQ291bnQ7XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLm11bHRpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBicmVha1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuXG4gICAgT2JqZWN0LmtleXMocmVjb21wdXRlUWlkcykuZm9yRWFjaChxaWQgPT4ge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcblxuICAgICAgaWYgKHF1ZXJ5KSB7XG4gICAgICAgIHRoaXMuX3JlY29tcHV0ZVJlc3VsdHMocXVlcnksIHFpZFRvT3JpZ2luYWxSZXN1bHRzW3FpZF0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYXdhaXQgdGhpcy5fb2JzZXJ2ZVF1ZXVlLmRyYWluKCk7XG5cbiAgICAvLyBJZiB3ZSBhcmUgZG9pbmcgYW4gdXBzZXJ0LCBhbmQgd2UgZGlkbid0IG1vZGlmeSBhbnkgZG9jdW1lbnRzIHlldCwgdGhlblxuICAgIC8vIGl0J3MgdGltZSB0byBkbyBhbiBpbnNlcnQuIEZpZ3VyZSBvdXQgd2hhdCBkb2N1bWVudCB3ZSBhcmUgaW5zZXJ0aW5nLCBhbmRcbiAgICAvLyBnZW5lcmF0ZSBhbiBpZCBmb3IgaXQuXG4gICAgbGV0IGluc2VydGVkSWQ7XG4gICAgaWYgKHVwZGF0ZUNvdW50ID09PSAwICYmIG9wdGlvbnMudXBzZXJ0KSB7XG4gICAgICBjb25zdCBkb2MgPSBMb2NhbENvbGxlY3Rpb24uX2NyZWF0ZVVwc2VydERvY3VtZW50KHNlbGVjdG9yLCBtb2QpO1xuICAgICAgaWYgKCFkb2MuX2lkICYmIG9wdGlvbnMuaW5zZXJ0ZWRJZCkge1xuICAgICAgICBkb2MuX2lkID0gb3B0aW9ucy5pbnNlcnRlZElkO1xuICAgICAgfVxuXG4gICAgICBpbnNlcnRlZElkID0gYXdhaXQgdGhpcy5pbnNlcnRBc3luYyhkb2MpO1xuICAgICAgdXBkYXRlQ291bnQgPSAxO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmZpbmlzaFVwZGF0ZSh7XG4gICAgICBvcHRpb25zLFxuICAgICAgaW5zZXJ0ZWRJZCxcbiAgICAgIHVwZGF0ZUNvdW50LFxuICAgICAgY2FsbGJhY2ssXG4gICAgfSk7XG4gIH1cbiAgLy8gWFhYIGF0b21pY2l0eTogaWYgbXVsdGkgaXMgdHJ1ZSwgYW5kIG9uZSBtb2RpZmljYXRpb24gZmFpbHMsIGRvXG4gIC8vIHdlIHJvbGxiYWNrIHRoZSB3aG9sZSBvcGVyYXRpb24sIG9yIHdoYXQ/XG4gIHVwZGF0ZShzZWxlY3RvciwgbW9kLCBvcHRpb25zLCBjYWxsYmFjaykge1xuICAgIGlmICghIGNhbGxiYWNrICYmIG9wdGlvbnMgaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgb3B0aW9ucyA9IG51bGw7XG4gICAgfVxuXG4gICAgaWYgKCFvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0ge307XG4gICAgfVxuXG4gICAgY29uc3QgbWF0Y2hlciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcihzZWxlY3RvciwgdHJ1ZSk7XG5cbiAgICBjb25zdCBxaWRUb09yaWdpbmFsUmVzdWx0cyA9IHRoaXMucHJlcGFyZVVwZGF0ZShzZWxlY3Rvcik7XG5cbiAgICBsZXQgcmVjb21wdXRlUWlkcyA9IHt9O1xuXG4gICAgbGV0IHVwZGF0ZUNvdW50ID0gMDtcblxuICAgIHRoaXMuX2VhY2hQb3NzaWJseU1hdGNoaW5nRG9jU3luYyhzZWxlY3RvciwgKGRvYywgaWQpID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5UmVzdWx0ID0gbWF0Y2hlci5kb2N1bWVudE1hdGNoZXMoZG9jKTtcblxuICAgICAgaWYgKHF1ZXJ5UmVzdWx0LnJlc3VsdCkge1xuICAgICAgICAvLyBYWFggU2hvdWxkIHdlIHNhdmUgdGhlIG9yaWdpbmFsIGV2ZW4gaWYgbW9kIGVuZHMgdXAgYmVpbmcgYSBuby1vcD9cbiAgICAgICAgdGhpcy5fc2F2ZU9yaWdpbmFsKGlkLCBkb2MpO1xuICAgICAgICByZWNvbXB1dGVRaWRzID0gdGhpcy5fbW9kaWZ5QW5kTm90aWZ5U3luYyhcbiAgICAgICAgICBkb2MsXG4gICAgICAgICAgbW9kLFxuICAgICAgICAgIHF1ZXJ5UmVzdWx0LmFycmF5SW5kaWNlc1xuICAgICAgICApO1xuXG4gICAgICAgICsrdXBkYXRlQ291bnQ7XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLm11bHRpKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlOyAvLyBicmVha1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuXG4gICAgT2JqZWN0LmtleXMocmVjb21wdXRlUWlkcykuZm9yRWFjaChxaWQgPT4ge1xuICAgICAgY29uc3QgcXVlcnkgPSB0aGlzLnF1ZXJpZXNbcWlkXTtcbiAgICAgIGlmIChxdWVyeSkge1xuICAgICAgICB0aGlzLl9yZWNvbXB1dGVSZXN1bHRzKHF1ZXJ5LCBxaWRUb09yaWdpbmFsUmVzdWx0c1txaWRdKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMuX29ic2VydmVRdWV1ZS5kcmFpbigpO1xuXG4gICAgcmV0dXJuIHRoaXMuZmluaXNoVXBkYXRlKHtcbiAgICAgIG9wdGlvbnMsXG4gICAgICB1cGRhdGVDb3VudCxcbiAgICAgIGNhbGxiYWNrLFxuICAgICAgc2VsZWN0b3IsXG4gICAgICBtb2QsXG4gICAgfSk7XG4gIH1cblxuICAvLyBBIGNvbnZlbmllbmNlIHdyYXBwZXIgb24gdXBkYXRlLiBMb2NhbENvbGxlY3Rpb24udXBzZXJ0KHNlbCwgbW9kKSBpc1xuICAvLyBlcXVpdmFsZW50IHRvIExvY2FsQ29sbGVjdGlvbi51cGRhdGUoc2VsLCBtb2QsIHt1cHNlcnQ6IHRydWUsXG4gIC8vIF9yZXR1cm5PYmplY3Q6IHRydWV9KS5cbiAgdXBzZXJ0KHNlbGVjdG9yLCBtb2QsIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCFjYWxsYmFjayAmJiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbGJhY2sgPSBvcHRpb25zO1xuICAgICAgb3B0aW9ucyA9IHt9O1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnVwZGF0ZShcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgbW9kLFxuICAgICAgT2JqZWN0LmFzc2lnbih7fSwgb3B0aW9ucywge3Vwc2VydDogdHJ1ZSwgX3JldHVybk9iamVjdDogdHJ1ZX0pLFxuICAgICAgY2FsbGJhY2tcbiAgICApO1xuICB9XG5cbiAgdXBzZXJ0QXN5bmMoc2VsZWN0b3IsIG1vZCwgb3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBpZiAoIWNhbGxiYWNrICYmIHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsYmFjayA9IG9wdGlvbnM7XG4gICAgICBvcHRpb25zID0ge307XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMudXBkYXRlQXN5bmMoXG4gICAgICBzZWxlY3RvcixcbiAgICAgIG1vZCxcbiAgICAgIE9iamVjdC5hc3NpZ24oe30sIG9wdGlvbnMsIHt1cHNlcnQ6IHRydWUsIF9yZXR1cm5PYmplY3Q6IHRydWV9KSxcbiAgICAgIGNhbGxiYWNrXG4gICAgKTtcbiAgfVxuXG4gIC8vIEl0ZXJhdGVzIG92ZXIgYSBzdWJzZXQgb2YgZG9jdW1lbnRzIHRoYXQgY291bGQgbWF0Y2ggc2VsZWN0b3I7IGNhbGxzXG4gIC8vIGZuKGRvYywgaWQpIG9uIGVhY2ggb2YgdGhlbS4gIFNwZWNpZmljYWxseSwgaWYgc2VsZWN0b3Igc3BlY2lmaWVzXG4gIC8vIHNwZWNpZmljIF9pZCdzLCBpdCBvbmx5IGxvb2tzIGF0IHRob3NlLiAgZG9jIGlzICpub3QqIGNsb25lZDogaXQgaXMgdGhlXG4gIC8vIHNhbWUgb2JqZWN0IHRoYXQgaXMgaW4gX2RvY3MuXG4gIGFzeW5jIF9lYWNoUG9zc2libHlNYXRjaGluZ0RvY0FzeW5jKHNlbGVjdG9yLCBmbikge1xuICAgIGNvbnN0IHNwZWNpZmljSWRzID0gTG9jYWxDb2xsZWN0aW9uLl9pZHNNYXRjaGVkQnlTZWxlY3RvcihzZWxlY3Rvcik7XG5cbiAgICBpZiAoc3BlY2lmaWNJZHMpIHtcbiAgICAgIGZvciAoY29uc3QgaWQgb2Ygc3BlY2lmaWNJZHMpIHtcbiAgICAgICAgY29uc3QgZG9jID0gdGhpcy5fZG9jcy5nZXQoaWQpO1xuXG4gICAgICAgIGlmIChkb2MgJiYgISAoYXdhaXQgZm4oZG9jLCBpZCkpKSB7XG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhd2FpdCB0aGlzLl9kb2NzLmZvckVhY2hBc3luYyhmbik7XG4gICAgfVxuICB9XG4gIF9lYWNoUG9zc2libHlNYXRjaGluZ0RvY1N5bmMoc2VsZWN0b3IsIGZuKSB7XG4gICAgY29uc3Qgc3BlY2lmaWNJZHMgPSBMb2NhbENvbGxlY3Rpb24uX2lkc01hdGNoZWRCeVNlbGVjdG9yKHNlbGVjdG9yKTtcblxuICAgIGlmIChzcGVjaWZpY0lkcykge1xuICAgICAgZm9yIChjb25zdCBpZCBvZiBzcGVjaWZpY0lkcykge1xuICAgICAgICBjb25zdCBkb2MgPSB0aGlzLl9kb2NzLmdldChpZCk7XG5cbiAgICAgICAgaWYgKGRvYyAmJiAhZm4oZG9jLCBpZCkpIHtcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2RvY3MuZm9yRWFjaChmbik7XG4gICAgfVxuICB9XG5cbiAgX2dldE1hdGNoZWREb2NBbmRNb2RpZnkoZG9jLCBtb2QsIGFycmF5SW5kaWNlcykge1xuICAgIGNvbnN0IG1hdGNoZWRfYmVmb3JlID0ge307XG5cbiAgICBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpLmZvckVhY2gocWlkID0+IHtcbiAgICAgIGNvbnN0IHF1ZXJ5ID0gdGhpcy5xdWVyaWVzW3FpZF07XG5cbiAgICAgIGlmIChxdWVyeS5kaXJ0eSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChxdWVyeS5vcmRlcmVkKSB7XG4gICAgICAgIG1hdGNoZWRfYmVmb3JlW3FpZF0gPSBxdWVyeS5tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhkb2MpLnJlc3VsdDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEJlY2F1c2Ugd2UgZG9uJ3Qgc3VwcG9ydCBza2lwIG9yIGxpbWl0ICh5ZXQpIGluIHVub3JkZXJlZCBxdWVyaWVzLCB3ZVxuICAgICAgICAvLyBjYW4ganVzdCBkbyBhIGRpcmVjdCBsb29rdXAuXG4gICAgICAgIG1hdGNoZWRfYmVmb3JlW3FpZF0gPSBxdWVyeS5yZXN1bHRzLmhhcyhkb2MuX2lkKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBtYXRjaGVkX2JlZm9yZTtcbiAgfVxuXG4gIF9tb2RpZnlBbmROb3RpZnlTeW5jKGRvYywgbW9kLCBhcnJheUluZGljZXMpIHtcblxuICAgIGNvbnN0IG1hdGNoZWRfYmVmb3JlID0gdGhpcy5fZ2V0TWF0Y2hlZERvY0FuZE1vZGlmeShkb2MsIG1vZCwgYXJyYXlJbmRpY2VzKTtcblxuICAgIGNvbnN0IG9sZF9kb2MgPSBFSlNPTi5jbG9uZShkb2MpO1xuICAgIExvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5KGRvYywgbW9kLCB7YXJyYXlJbmRpY2VzfSk7XG5cbiAgICBjb25zdCByZWNvbXB1dGVRaWRzID0ge307XG5cbiAgICBmb3IgKGNvbnN0IHFpZCBvZiBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkuZGlydHkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGFmdGVyTWF0Y2ggPSBxdWVyeS5tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhkb2MpO1xuICAgICAgY29uc3QgYWZ0ZXIgPSBhZnRlck1hdGNoLnJlc3VsdDtcbiAgICAgIGNvbnN0IGJlZm9yZSA9IG1hdGNoZWRfYmVmb3JlW3FpZF07XG5cbiAgICAgIGlmIChhZnRlciAmJiBxdWVyeS5kaXN0YW5jZXMgJiYgYWZ0ZXJNYXRjaC5kaXN0YW5jZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHF1ZXJ5LmRpc3RhbmNlcy5zZXQoZG9jLl9pZCwgYWZ0ZXJNYXRjaC5kaXN0YW5jZSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChxdWVyeS5jdXJzb3Iuc2tpcCB8fCBxdWVyeS5jdXJzb3IubGltaXQpIHtcbiAgICAgICAgLy8gV2UgbmVlZCB0byByZWNvbXB1dGUgYW55IHF1ZXJ5IHdoZXJlIHRoZSBkb2MgbWF5IGhhdmUgYmVlbiBpbiB0aGVcbiAgICAgICAgLy8gY3Vyc29yJ3Mgd2luZG93IGVpdGhlciBiZWZvcmUgb3IgYWZ0ZXIgdGhlIHVwZGF0ZS4gKE5vdGUgdGhhdCBpZiBza2lwXG4gICAgICAgIC8vIG9yIGxpbWl0IGlzIHNldCwgXCJiZWZvcmVcIiBhbmQgXCJhZnRlclwiIGJlaW5nIHRydWUgZG8gbm90IG5lY2Vzc2FyaWx5XG4gICAgICAgIC8vIG1lYW4gdGhhdCB0aGUgZG9jdW1lbnQgaXMgaW4gdGhlIGN1cnNvcidzIG91dHB1dCBhZnRlciBza2lwL2xpbWl0IGlzXG4gICAgICAgIC8vIGFwcGxpZWQuLi4gYnV0IGlmIHRoZXkgYXJlIGZhbHNlLCB0aGVuIHRoZSBkb2N1bWVudCBkZWZpbml0ZWx5IGlzIE5PVFxuICAgICAgICAvLyBpbiB0aGUgb3V0cHV0LiBTbyBpdCdzIHNhZmUgdG8gc2tpcCByZWNvbXB1dGUgaWYgbmVpdGhlciBiZWZvcmUgb3JcbiAgICAgICAgLy8gYWZ0ZXIgYXJlIHRydWUuKVxuICAgICAgICBpZiAoYmVmb3JlIHx8IGFmdGVyKSB7XG4gICAgICAgICAgcmVjb21wdXRlUWlkc1txaWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChiZWZvcmUgJiYgIWFmdGVyKSB7XG4gICAgICAgIExvY2FsQ29sbGVjdGlvbi5fcmVtb3ZlRnJvbVJlc3VsdHNTeW5jKHF1ZXJ5LCBkb2MpO1xuICAgICAgfSBlbHNlIGlmICghYmVmb3JlICYmIGFmdGVyKSB7XG4gICAgICAgIExvY2FsQ29sbGVjdGlvbi5faW5zZXJ0SW5SZXN1bHRzU3luYyhxdWVyeSwgZG9jKTtcbiAgICAgIH0gZWxzZSBpZiAoYmVmb3JlICYmIGFmdGVyKSB7XG4gICAgICAgIExvY2FsQ29sbGVjdGlvbi5fdXBkYXRlSW5SZXN1bHRzU3luYyhxdWVyeSwgZG9jLCBvbGRfZG9jKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlY29tcHV0ZVFpZHM7XG4gIH1cblxuICBhc3luYyBfbW9kaWZ5QW5kTm90aWZ5QXN5bmMoZG9jLCBtb2QsIGFycmF5SW5kaWNlcykge1xuXG4gICAgY29uc3QgbWF0Y2hlZF9iZWZvcmUgPSB0aGlzLl9nZXRNYXRjaGVkRG9jQW5kTW9kaWZ5KGRvYywgbW9kLCBhcnJheUluZGljZXMpO1xuXG4gICAgY29uc3Qgb2xkX2RvYyA9IEVKU09OLmNsb25lKGRvYyk7XG4gICAgTG9jYWxDb2xsZWN0aW9uLl9tb2RpZnkoZG9jLCBtb2QsIHthcnJheUluZGljZXN9KTtcblxuICAgIGNvbnN0IHJlY29tcHV0ZVFpZHMgPSB7fTtcbiAgICBmb3IgKGNvbnN0IHFpZCBvZiBPYmplY3Qua2V5cyh0aGlzLnF1ZXJpZXMpKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcmllc1txaWRdO1xuXG4gICAgICBpZiAocXVlcnkuZGlydHkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGFmdGVyTWF0Y2ggPSBxdWVyeS5tYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyhkb2MpO1xuICAgICAgY29uc3QgYWZ0ZXIgPSBhZnRlck1hdGNoLnJlc3VsdDtcbiAgICAgIGNvbnN0IGJlZm9yZSA9IG1hdGNoZWRfYmVmb3JlW3FpZF07XG5cbiAgICAgIGlmIChhZnRlciAmJiBxdWVyeS5kaXN0YW5jZXMgJiYgYWZ0ZXJNYXRjaC5kaXN0YW5jZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHF1ZXJ5LmRpc3RhbmNlcy5zZXQoZG9jLl9pZCwgYWZ0ZXJNYXRjaC5kaXN0YW5jZSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChxdWVyeS5jdXJzb3Iuc2tpcCB8fCBxdWVyeS5jdXJzb3IubGltaXQpIHtcbiAgICAgICAgLy8gV2UgbmVlZCB0byByZWNvbXB1dGUgYW55IHF1ZXJ5IHdoZXJlIHRoZSBkb2MgbWF5IGhhdmUgYmVlbiBpbiB0aGVcbiAgICAgICAgLy8gY3Vyc29yJ3Mgd2luZG93IGVpdGhlciBiZWZvcmUgb3IgYWZ0ZXIgdGhlIHVwZGF0ZS4gKE5vdGUgdGhhdCBpZiBza2lwXG4gICAgICAgIC8vIG9yIGxpbWl0IGlzIHNldCwgXCJiZWZvcmVcIiBhbmQgXCJhZnRlclwiIGJlaW5nIHRydWUgZG8gbm90IG5lY2Vzc2FyaWx5XG4gICAgICAgIC8vIG1lYW4gdGhhdCB0aGUgZG9jdW1lbnQgaXMgaW4gdGhlIGN1cnNvcidzIG91dHB1dCBhZnRlciBza2lwL2xpbWl0IGlzXG4gICAgICAgIC8vIGFwcGxpZWQuLi4gYnV0IGlmIHRoZXkgYXJlIGZhbHNlLCB0aGVuIHRoZSBkb2N1bWVudCBkZWZpbml0ZWx5IGlzIE5PVFxuICAgICAgICAvLyBpbiB0aGUgb3V0cHV0LiBTbyBpdCdzIHNhZmUgdG8gc2tpcCByZWNvbXB1dGUgaWYgbmVpdGhlciBiZWZvcmUgb3JcbiAgICAgICAgLy8gYWZ0ZXIgYXJlIHRydWUuKVxuICAgICAgICBpZiAoYmVmb3JlIHx8IGFmdGVyKSB7XG4gICAgICAgICAgcmVjb21wdXRlUWlkc1txaWRdID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChiZWZvcmUgJiYgIWFmdGVyKSB7XG4gICAgICAgIGF3YWl0IExvY2FsQ29sbGVjdGlvbi5fcmVtb3ZlRnJvbVJlc3VsdHNBc3luYyhxdWVyeSwgZG9jKTtcbiAgICAgIH0gZWxzZSBpZiAoIWJlZm9yZSAmJiBhZnRlcikge1xuICAgICAgICBhd2FpdCBMb2NhbENvbGxlY3Rpb24uX2luc2VydEluUmVzdWx0c0FzeW5jKHF1ZXJ5LCBkb2MpO1xuICAgICAgfSBlbHNlIGlmIChiZWZvcmUgJiYgYWZ0ZXIpIHtcbiAgICAgICAgYXdhaXQgTG9jYWxDb2xsZWN0aW9uLl91cGRhdGVJblJlc3VsdHNBc3luYyhxdWVyeSwgZG9jLCBvbGRfZG9jKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlY29tcHV0ZVFpZHM7XG4gIH1cblxuICAvLyBSZWNvbXB1dGVzIHRoZSByZXN1bHRzIG9mIGEgcXVlcnkgYW5kIHJ1bnMgb2JzZXJ2ZSBjYWxsYmFja3MgZm9yIHRoZVxuICAvLyBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIHByZXZpb3VzIHJlc3VsdHMgYW5kIHRoZSBjdXJyZW50IHJlc3VsdHMgKHVubGVzc1xuICAvLyBwYXVzZWQpLiBVc2VkIGZvciBza2lwL2xpbWl0IHF1ZXJpZXMuXG4gIC8vXG4gIC8vIFdoZW4gdGhpcyBpcyB1c2VkIGJ5IGluc2VydCBvciByZW1vdmUsIGl0IGNhbiBqdXN0IHVzZSBxdWVyeS5yZXN1bHRzIGZvclxuICAvLyB0aGUgb2xkIHJlc3VsdHMgKGFuZCB0aGVyZSdzIG5vIG5lZWQgdG8gcGFzcyBpbiBvbGRSZXN1bHRzKSwgYmVjYXVzZSB0aGVzZVxuICAvLyBvcGVyYXRpb25zIGRvbid0IG11dGF0ZSB0aGUgZG9jdW1lbnRzIGluIHRoZSBjb2xsZWN0aW9uLiBVcGRhdGUgbmVlZHMgdG9cbiAgLy8gcGFzcyBpbiBhbiBvbGRSZXN1bHRzIHdoaWNoIHdhcyBkZWVwLWNvcGllZCBiZWZvcmUgdGhlIG1vZGlmaWVyIHdhc1xuICAvLyBhcHBsaWVkLlxuICAvL1xuICAvLyBvbGRSZXN1bHRzIGlzIGd1YXJhbnRlZWQgdG8gYmUgaWdub3JlZCBpZiB0aGUgcXVlcnkgaXMgbm90IHBhdXNlZC5cbiAgX3JlY29tcHV0ZVJlc3VsdHMocXVlcnksIG9sZFJlc3VsdHMpIHtcbiAgICBpZiAodGhpcy5wYXVzZWQpIHtcbiAgICAgIC8vIFRoZXJlJ3Mgbm8gcmVhc29uIHRvIHJlY29tcHV0ZSB0aGUgcmVzdWx0cyBub3cgYXMgd2UncmUgc3RpbGwgcGF1c2VkLlxuICAgICAgLy8gQnkgZmxhZ2dpbmcgdGhlIHF1ZXJ5IGFzIFwiZGlydHlcIiwgdGhlIHJlY29tcHV0ZSB3aWxsIGJlIHBlcmZvcm1lZFxuICAgICAgLy8gd2hlbiByZXN1bWVPYnNlcnZlcnMgaXMgY2FsbGVkLlxuICAgICAgcXVlcnkuZGlydHkgPSB0cnVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5wYXVzZWQgJiYgIW9sZFJlc3VsdHMpIHtcbiAgICAgIG9sZFJlc3VsdHMgPSBxdWVyeS5yZXN1bHRzO1xuICAgIH1cblxuICAgIGlmIChxdWVyeS5kaXN0YW5jZXMpIHtcbiAgICAgIHF1ZXJ5LmRpc3RhbmNlcy5jbGVhcigpO1xuICAgIH1cblxuICAgIHF1ZXJ5LnJlc3VsdHMgPSBxdWVyeS5jdXJzb3IuX2dldFJhd09iamVjdHMoe1xuICAgICAgZGlzdGFuY2VzOiBxdWVyeS5kaXN0YW5jZXMsXG4gICAgICBvcmRlcmVkOiBxdWVyeS5vcmRlcmVkXG4gICAgfSk7XG5cbiAgICBpZiAoIXRoaXMucGF1c2VkKSB7XG4gICAgICBMb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeUNoYW5nZXMoXG4gICAgICAgIHF1ZXJ5Lm9yZGVyZWQsXG4gICAgICAgIG9sZFJlc3VsdHMsXG4gICAgICAgIHF1ZXJ5LnJlc3VsdHMsXG4gICAgICAgIHF1ZXJ5LFxuICAgICAgICB7cHJvamVjdGlvbkZuOiBxdWVyeS5wcm9qZWN0aW9uRm59XG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIF9zYXZlT3JpZ2luYWwoaWQsIGRvYykge1xuICAgIC8vIEFyZSB3ZSBldmVuIHRyeWluZyB0byBzYXZlIG9yaWdpbmFscz9cbiAgICBpZiAoIXRoaXMuX3NhdmVkT3JpZ2luYWxzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gSGF2ZSB3ZSBwcmV2aW91c2x5IG11dGF0ZWQgdGhlIG9yaWdpbmFsIChhbmQgc28gJ2RvYycgaXMgbm90IGFjdHVhbGx5XG4gICAgLy8gb3JpZ2luYWwpPyAgKE5vdGUgdGhlICdoYXMnIGNoZWNrIHJhdGhlciB0aGFuIHRydXRoOiB3ZSBzdG9yZSB1bmRlZmluZWRcbiAgICAvLyBoZXJlIGZvciBpbnNlcnRlZCBkb2NzISlcbiAgICBpZiAodGhpcy5fc2F2ZWRPcmlnaW5hbHMuaGFzKGlkKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX3NhdmVkT3JpZ2luYWxzLnNldChpZCwgRUpTT04uY2xvbmUoZG9jKSk7XG4gIH1cbn1cblxuTG9jYWxDb2xsZWN0aW9uLkN1cnNvciA9IEN1cnNvcjtcblxuTG9jYWxDb2xsZWN0aW9uLk9ic2VydmVIYW5kbGUgPSBPYnNlcnZlSGFuZGxlO1xuXG4vLyBYWFggbWF5YmUgbW92ZSB0aGVzZSBpbnRvIGFub3RoZXIgT2JzZXJ2ZUhlbHBlcnMgcGFja2FnZSBvciBzb21ldGhpbmdcblxuLy8gX0NhY2hpbmdDaGFuZ2VPYnNlcnZlciBpcyBhbiBvYmplY3Qgd2hpY2ggcmVjZWl2ZXMgb2JzZXJ2ZUNoYW5nZXMgY2FsbGJhY2tzXG4vLyBhbmQga2VlcHMgYSBjYWNoZSBvZiB0aGUgY3VycmVudCBjdXJzb3Igc3RhdGUgdXAgdG8gZGF0ZSBpbiB0aGlzLmRvY3MuIFVzZXJzXG4vLyBvZiB0aGlzIGNsYXNzIHNob3VsZCByZWFkIHRoZSBkb2NzIGZpZWxkIGJ1dCBub3QgbW9kaWZ5IGl0LiBZb3Ugc2hvdWxkIHBhc3Ncbi8vIHRoZSBcImFwcGx5Q2hhbmdlXCIgZmllbGQgYXMgdGhlIGNhbGxiYWNrcyB0byB0aGUgdW5kZXJseWluZyBvYnNlcnZlQ2hhbmdlc1xuLy8gY2FsbC4gT3B0aW9uYWxseSwgeW91IGNhbiBzcGVjaWZ5IHlvdXIgb3duIG9ic2VydmVDaGFuZ2VzIGNhbGxiYWNrcyB3aGljaCBhcmVcbi8vIGludm9rZWQgaW1tZWRpYXRlbHkgYmVmb3JlIHRoZSBkb2NzIGZpZWxkIGlzIHVwZGF0ZWQ7IHRoaXMgb2JqZWN0IGlzIG1hZGVcbi8vIGF2YWlsYWJsZSBhcyBgdGhpc2AgdG8gdGhvc2UgY2FsbGJhY2tzLlxuTG9jYWxDb2xsZWN0aW9uLl9DYWNoaW5nQ2hhbmdlT2JzZXJ2ZXIgPSBjbGFzcyBfQ2FjaGluZ0NoYW5nZU9ic2VydmVyIHtcbiAgY29uc3RydWN0b3Iob3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3Qgb3JkZXJlZEZyb21DYWxsYmFja3MgPSAoXG4gICAgICBvcHRpb25zLmNhbGxiYWNrcyAmJlxuICAgICAgTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlQ2hhbmdlc0NhbGxiYWNrc0FyZU9yZGVyZWQob3B0aW9ucy5jYWxsYmFja3MpXG4gICAgKTtcblxuICAgIGlmIChoYXNPd24uY2FsbChvcHRpb25zLCAnb3JkZXJlZCcpKSB7XG4gICAgICB0aGlzLm9yZGVyZWQgPSBvcHRpb25zLm9yZGVyZWQ7XG5cbiAgICAgIGlmIChvcHRpb25zLmNhbGxiYWNrcyAmJiBvcHRpb25zLm9yZGVyZWQgIT09IG9yZGVyZWRGcm9tQ2FsbGJhY2tzKSB7XG4gICAgICAgIHRocm93IEVycm9yKCdvcmRlcmVkIG9wdGlvbiBkb2VzblxcJ3QgbWF0Y2ggY2FsbGJhY2tzJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmNhbGxiYWNrcykge1xuICAgICAgdGhpcy5vcmRlcmVkID0gb3JkZXJlZEZyb21DYWxsYmFja3M7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IEVycm9yKCdtdXN0IHByb3ZpZGUgb3JkZXJlZCBvciBjYWxsYmFja3MnKTtcbiAgICB9XG5cbiAgICBjb25zdCBjYWxsYmFja3MgPSBvcHRpb25zLmNhbGxiYWNrcyB8fCB7fTtcblxuICAgIGlmICh0aGlzLm9yZGVyZWQpIHtcbiAgICAgIHRoaXMuZG9jcyA9IG5ldyBPcmRlcmVkRGljdChNb25nb0lELmlkU3RyaW5naWZ5KTtcbiAgICAgIHRoaXMuYXBwbHlDaGFuZ2UgPSB7XG4gICAgICAgIGFkZGVkQmVmb3JlOiAoaWQsIGZpZWxkcywgYmVmb3JlKSA9PiB7XG4gICAgICAgICAgLy8gVGFrZSBhIHNoYWxsb3cgY29weSBzaW5jZSB0aGUgdG9wLWxldmVsIHByb3BlcnRpZXMgY2FuIGJlIGNoYW5nZWRcbiAgICAgICAgICBjb25zdCBkb2MgPSB7IC4uLmZpZWxkcyB9O1xuXG4gICAgICAgICAgZG9jLl9pZCA9IGlkO1xuXG4gICAgICAgICAgaWYgKGNhbGxiYWNrcy5hZGRlZEJlZm9yZSkge1xuICAgICAgICAgICAgY2FsbGJhY2tzLmFkZGVkQmVmb3JlLmNhbGwodGhpcywgaWQsIEVKU09OLmNsb25lKGZpZWxkcyksIGJlZm9yZSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVGhpcyBsaW5lIHRyaWdnZXJzIGlmIHdlIHByb3ZpZGUgYWRkZWQgd2l0aCBtb3ZlZEJlZm9yZS5cbiAgICAgICAgICBpZiAoY2FsbGJhY2tzLmFkZGVkKSB7XG4gICAgICAgICAgICBjYWxsYmFja3MuYWRkZWQuY2FsbCh0aGlzLCBpZCwgRUpTT04uY2xvbmUoZmllbGRzKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gWFhYIGNvdWxkIGBiZWZvcmVgIGJlIGEgZmFsc3kgSUQ/ICBUZWNobmljYWxseVxuICAgICAgICAgIC8vIGlkU3RyaW5naWZ5IHNlZW1zIHRvIGFsbG93IGZvciB0aGVtIC0tIHRob3VnaFxuICAgICAgICAgIC8vIE9yZGVyZWREaWN0IHdvbid0IGNhbGwgc3RyaW5naWZ5IG9uIGEgZmFsc3kgYXJnLlxuICAgICAgICAgIHRoaXMuZG9jcy5wdXRCZWZvcmUoaWQsIGRvYywgYmVmb3JlIHx8IG51bGwpO1xuICAgICAgICB9LFxuICAgICAgICBtb3ZlZEJlZm9yZTogKGlkLCBiZWZvcmUpID0+IHtcbiAgICAgICAgICBpZiAoY2FsbGJhY2tzLm1vdmVkQmVmb3JlKSB7XG4gICAgICAgICAgICBjYWxsYmFja3MubW92ZWRCZWZvcmUuY2FsbCh0aGlzLCBpZCwgYmVmb3JlKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmRvY3MubW92ZUJlZm9yZShpZCwgYmVmb3JlIHx8IG51bGwpO1xuICAgICAgICB9LFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kb2NzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgICB0aGlzLmFwcGx5Q2hhbmdlID0ge1xuICAgICAgICBhZGRlZDogKGlkLCBmaWVsZHMpID0+IHtcbiAgICAgICAgICAvLyBUYWtlIGEgc2hhbGxvdyBjb3B5IHNpbmNlIHRoZSB0b3AtbGV2ZWwgcHJvcGVydGllcyBjYW4gYmUgY2hhbmdlZFxuICAgICAgICAgIGNvbnN0IGRvYyA9IHsgLi4uZmllbGRzIH07XG5cbiAgICAgICAgICBpZiAoY2FsbGJhY2tzLmFkZGVkKSB7XG4gICAgICAgICAgICBjYWxsYmFja3MuYWRkZWQuY2FsbCh0aGlzLCBpZCwgRUpTT04uY2xvbmUoZmllbGRzKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZG9jLl9pZCA9IGlkO1xuXG4gICAgICAgICAgdGhpcy5kb2NzLnNldChpZCwgIGRvYyk7XG4gICAgICAgIH0sXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIFRoZSBtZXRob2RzIGluIF9JZE1hcCBhbmQgT3JkZXJlZERpY3QgdXNlZCBieSB0aGVzZSBjYWxsYmFja3MgYXJlXG4gICAgLy8gaWRlbnRpY2FsLlxuICAgIHRoaXMuYXBwbHlDaGFuZ2UuY2hhbmdlZCA9IChpZCwgZmllbGRzKSA9PiB7XG4gICAgICBjb25zdCBkb2MgPSB0aGlzLmRvY3MuZ2V0KGlkKTtcblxuICAgICAgaWYgKCFkb2MpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGlkIGZvciBjaGFuZ2VkOiAke2lkfWApO1xuICAgICAgfVxuXG4gICAgICBpZiAoY2FsbGJhY2tzLmNoYW5nZWQpIHtcbiAgICAgICAgY2FsbGJhY2tzLmNoYW5nZWQuY2FsbCh0aGlzLCBpZCwgRUpTT04uY2xvbmUoZmllbGRzKSk7XG4gICAgICB9XG5cbiAgICAgIERpZmZTZXF1ZW5jZS5hcHBseUNoYW5nZXMoZG9jLCBmaWVsZHMpO1xuICAgIH07XG5cbiAgICB0aGlzLmFwcGx5Q2hhbmdlLnJlbW92ZWQgPSBpZCA9PiB7XG4gICAgICBpZiAoY2FsbGJhY2tzLnJlbW92ZWQpIHtcbiAgICAgICAgY2FsbGJhY2tzLnJlbW92ZWQuY2FsbCh0aGlzLCBpZCk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuZG9jcy5yZW1vdmUoaWQpO1xuICAgIH07XG4gIH1cbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5fSWRNYXAgPSBjbGFzcyBfSWRNYXAgZXh0ZW5kcyBJZE1hcCB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKE1vbmdvSUQuaWRTdHJpbmdpZnksIE1vbmdvSUQuaWRQYXJzZSk7XG4gIH1cbn07XG5cbi8vIFdyYXAgYSB0cmFuc2Zvcm0gZnVuY3Rpb24gdG8gcmV0dXJuIG9iamVjdHMgdGhhdCBoYXZlIHRoZSBfaWQgZmllbGRcbi8vIG9mIHRoZSB1bnRyYW5zZm9ybWVkIGRvY3VtZW50LiBUaGlzIGVuc3VyZXMgdGhhdCBzdWJzeXN0ZW1zIHN1Y2ggYXNcbi8vIHRoZSBvYnNlcnZlLXNlcXVlbmNlIHBhY2thZ2UgdGhhdCBjYWxsIGBvYnNlcnZlYCBjYW4ga2VlcCB0cmFjayBvZlxuLy8gdGhlIGRvY3VtZW50cyBpZGVudGl0aWVzLlxuLy9cbi8vIC0gUmVxdWlyZSB0aGF0IGl0IHJldHVybnMgb2JqZWN0c1xuLy8gLSBJZiB0aGUgcmV0dXJuIHZhbHVlIGhhcyBhbiBfaWQgZmllbGQsIHZlcmlmeSB0aGF0IGl0IG1hdGNoZXMgdGhlXG4vLyAgIG9yaWdpbmFsIF9pZCBmaWVsZFxuLy8gLSBJZiB0aGUgcmV0dXJuIHZhbHVlIGRvZXNuJ3QgaGF2ZSBhbiBfaWQgZmllbGQsIGFkZCBpdCBiYWNrLlxuTG9jYWxDb2xsZWN0aW9uLndyYXBUcmFuc2Zvcm0gPSB0cmFuc2Zvcm0gPT4ge1xuICBpZiAoIXRyYW5zZm9ybSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gTm8gbmVlZCB0byBkb3VibHktd3JhcCB0cmFuc2Zvcm1zLlxuICBpZiAodHJhbnNmb3JtLl9fd3JhcHBlZFRyYW5zZm9ybV9fKSB7XG4gICAgcmV0dXJuIHRyYW5zZm9ybTtcbiAgfVxuXG4gIGNvbnN0IHdyYXBwZWQgPSBkb2MgPT4ge1xuICAgIGlmICghaGFzT3duLmNhbGwoZG9jLCAnX2lkJykpIHtcbiAgICAgIC8vIFhYWCBkbyB3ZSBldmVyIGhhdmUgYSB0cmFuc2Zvcm0gb24gdGhlIG9wbG9nJ3MgY29sbGVjdGlvbj8gYmVjYXVzZSB0aGF0XG4gICAgICAvLyBjb2xsZWN0aW9uIGhhcyBubyBfaWQuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NhbiBvbmx5IHRyYW5zZm9ybSBkb2N1bWVudHMgd2l0aCBfaWQnKTtcbiAgICB9XG5cbiAgICBjb25zdCBpZCA9IGRvYy5faWQ7XG5cbiAgICAvLyBYWFggY29uc2lkZXIgbWFraW5nIHRyYWNrZXIgYSB3ZWFrIGRlcGVuZGVuY3kgYW5kIGNoZWNraW5nXG4gICAgLy8gUGFja2FnZS50cmFja2VyIGhlcmVcbiAgICBjb25zdCB0cmFuc2Zvcm1lZCA9IFRyYWNrZXIubm9ucmVhY3RpdmUoKCkgPT4gdHJhbnNmb3JtKGRvYykpO1xuXG4gICAgaWYgKCFMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QodHJhbnNmb3JtZWQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ3RyYW5zZm9ybSBtdXN0IHJldHVybiBvYmplY3QnKTtcbiAgICB9XG5cbiAgICBpZiAoaGFzT3duLmNhbGwodHJhbnNmb3JtZWQsICdfaWQnKSkge1xuICAgICAgaWYgKCFFSlNPTi5lcXVhbHModHJhbnNmb3JtZWQuX2lkLCBpZCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd0cmFuc2Zvcm1lZCBkb2N1bWVudCBjYW5cXCd0IGhhdmUgZGlmZmVyZW50IF9pZCcpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0cmFuc2Zvcm1lZC5faWQgPSBpZDtcbiAgICB9XG5cbiAgICByZXR1cm4gdHJhbnNmb3JtZWQ7XG4gIH07XG5cbiAgd3JhcHBlZC5fX3dyYXBwZWRUcmFuc2Zvcm1fXyA9IHRydWU7XG5cbiAgcmV0dXJuIHdyYXBwZWQ7XG59O1xuXG4vLyBYWFggdGhlIHNvcnRlZC1xdWVyeSBsb2dpYyBiZWxvdyBpcyBsYXVnaGFibHkgaW5lZmZpY2llbnQuIHdlJ2xsXG4vLyBuZWVkIHRvIGNvbWUgdXAgd2l0aCBhIGJldHRlciBkYXRhc3RydWN0dXJlIGZvciB0aGlzLlxuLy9cbi8vIFhYWCB0aGUgbG9naWMgZm9yIG9ic2VydmluZyB3aXRoIGEgc2tpcCBvciBhIGxpbWl0IGlzIGV2ZW4gbW9yZVxuLy8gbGF1Z2hhYmx5IGluZWZmaWNpZW50LiB3ZSByZWNvbXB1dGUgdGhlIHdob2xlIHJlc3VsdHMgZXZlcnkgdGltZSFcblxuLy8gVGhpcyBiaW5hcnkgc2VhcmNoIHB1dHMgYSB2YWx1ZSBiZXR3ZWVuIGFueSBlcXVhbCB2YWx1ZXMsIGFuZCB0aGUgZmlyc3Rcbi8vIGxlc3NlciB2YWx1ZS5cbkxvY2FsQ29sbGVjdGlvbi5fYmluYXJ5U2VhcmNoID0gKGNtcCwgYXJyYXksIHZhbHVlKSA9PiB7XG4gIGxldCBmaXJzdCA9IDA7XG4gIGxldCByYW5nZSA9IGFycmF5Lmxlbmd0aDtcblxuICB3aGlsZSAocmFuZ2UgPiAwKSB7XG4gICAgY29uc3QgaGFsZlJhbmdlID0gTWF0aC5mbG9vcihyYW5nZSAvIDIpO1xuXG4gICAgaWYgKGNtcCh2YWx1ZSwgYXJyYXlbZmlyc3QgKyBoYWxmUmFuZ2VdKSA+PSAwKSB7XG4gICAgICBmaXJzdCArPSBoYWxmUmFuZ2UgKyAxO1xuICAgICAgcmFuZ2UgLT0gaGFsZlJhbmdlICsgMTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmFuZ2UgPSBoYWxmUmFuZ2U7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZpcnN0O1xufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9jaGVja1N1cHBvcnRlZFByb2plY3Rpb24gPSBmaWVsZHMgPT4ge1xuICBpZiAoZmllbGRzICE9PSBPYmplY3QoZmllbGRzKSB8fCBBcnJheS5pc0FycmF5KGZpZWxkcykpIHtcbiAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignZmllbGRzIG9wdGlvbiBtdXN0IGJlIGFuIG9iamVjdCcpO1xuICB9XG5cbiAgT2JqZWN0LmtleXMoZmllbGRzKS5mb3JFYWNoKGtleVBhdGggPT4ge1xuICAgIGlmIChrZXlQYXRoLnNwbGl0KCcuJykuaW5jbHVkZXMoJyQnKSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdNaW5pbW9uZ28gZG9lc25cXCd0IHN1cHBvcnQgJCBvcGVyYXRvciBpbiBwcm9qZWN0aW9ucyB5ZXQuJ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCB2YWx1ZSA9IGZpZWxkc1trZXlQYXRoXTtcblxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmXG4gICAgICAgIFsnJGVsZW1NYXRjaCcsICckbWV0YScsICckc2xpY2UnXS5zb21lKGtleSA9PlxuICAgICAgICAgIGhhc093bi5jYWxsKHZhbHVlLCBrZXkpXG4gICAgICAgICkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnTWluaW1vbmdvIGRvZXNuXFwndCBzdXBwb3J0IG9wZXJhdG9ycyBpbiBwcm9qZWN0aW9ucyB5ZXQuJ1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAoIVsxLCAwLCB0cnVlLCBmYWxzZV0uaW5jbHVkZXModmFsdWUpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ1Byb2plY3Rpb24gdmFsdWVzIHNob3VsZCBiZSBvbmUgb2YgMSwgMCwgdHJ1ZSwgb3IgZmFsc2UnXG4gICAgICApO1xuICAgIH1cbiAgfSk7XG59O1xuXG4vLyBLbm93cyBob3cgdG8gY29tcGlsZSBhIGZpZWxkcyBwcm9qZWN0aW9uIHRvIGEgcHJlZGljYXRlIGZ1bmN0aW9uLlxuLy8gQHJldHVybnMgLSBGdW5jdGlvbjogYSBjbG9zdXJlIHRoYXQgZmlsdGVycyBvdXQgYW4gb2JqZWN0IGFjY29yZGluZyB0byB0aGVcbi8vICAgICAgICAgICAgZmllbGRzIHByb2plY3Rpb24gcnVsZXM6XG4vLyAgICAgICAgICAgIEBwYXJhbSBvYmogLSBPYmplY3Q6IE1vbmdvREItc3R5bGVkIGRvY3VtZW50XG4vLyAgICAgICAgICAgIEByZXR1cm5zIC0gT2JqZWN0OiBhIGRvY3VtZW50IHdpdGggdGhlIGZpZWxkcyBmaWx0ZXJlZCBvdXRcbi8vICAgICAgICAgICAgICAgICAgICAgICBhY2NvcmRpbmcgdG8gcHJvamVjdGlvbiBydWxlcy4gRG9lc24ndCByZXRhaW4gc3ViZmllbGRzXG4vLyAgICAgICAgICAgICAgICAgICAgICAgb2YgcGFzc2VkIGFyZ3VtZW50LlxuTG9jYWxDb2xsZWN0aW9uLl9jb21waWxlUHJvamVjdGlvbiA9IGZpZWxkcyA9PiB7XG4gIExvY2FsQ29sbGVjdGlvbi5fY2hlY2tTdXBwb3J0ZWRQcm9qZWN0aW9uKGZpZWxkcyk7XG5cbiAgY29uc3QgX2lkUHJvamVjdGlvbiA9IGZpZWxkcy5faWQgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBmaWVsZHMuX2lkO1xuICBjb25zdCBkZXRhaWxzID0gcHJvamVjdGlvbkRldGFpbHMoZmllbGRzKTtcblxuICAvLyByZXR1cm5zIHRyYW5zZm9ybWVkIGRvYyBhY2NvcmRpbmcgdG8gcnVsZVRyZWVcbiAgY29uc3QgdHJhbnNmb3JtID0gKGRvYywgcnVsZVRyZWUpID0+IHtcbiAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIFwic2V0c1wiXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZG9jKSkge1xuICAgICAgcmV0dXJuIGRvYy5tYXAoc3ViZG9jID0+IHRyYW5zZm9ybShzdWJkb2MsIHJ1bGVUcmVlKSk7XG4gICAgfVxuXG4gICAgY29uc3QgcmVzdWx0ID0gZGV0YWlscy5pbmNsdWRpbmcgPyB7fSA6IEVKU09OLmNsb25lKGRvYyk7XG5cbiAgICBPYmplY3Qua2V5cyhydWxlVHJlZSkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgaWYgKGRvYyA9PSBudWxsIHx8ICFoYXNPd24uY2FsbChkb2MsIGtleSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBydWxlID0gcnVsZVRyZWVba2V5XTtcblxuICAgICAgaWYgKHJ1bGUgPT09IE9iamVjdChydWxlKSkge1xuICAgICAgICAvLyBGb3Igc3ViLW9iamVjdHMvc3Vic2V0cyB3ZSBicmFuY2hcbiAgICAgICAgaWYgKGRvY1trZXldID09PSBPYmplY3QoZG9jW2tleV0pKSB7XG4gICAgICAgICAgcmVzdWx0W2tleV0gPSB0cmFuc2Zvcm0oZG9jW2tleV0sIHJ1bGUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGRldGFpbHMuaW5jbHVkaW5nKSB7XG4gICAgICAgIC8vIE90aGVyd2lzZSB3ZSBkb24ndCBldmVuIHRvdWNoIHRoaXMgc3ViZmllbGRcbiAgICAgICAgcmVzdWx0W2tleV0gPSBFSlNPTi5jbG9uZShkb2Nba2V5XSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWxldGUgcmVzdWx0W2tleV07XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gZG9jICE9IG51bGwgPyByZXN1bHQgOiBkb2M7XG4gIH07XG5cbiAgcmV0dXJuIGRvYyA9PiB7XG4gICAgY29uc3QgcmVzdWx0ID0gdHJhbnNmb3JtKGRvYywgZGV0YWlscy50cmVlKTtcblxuICAgIGlmIChfaWRQcm9qZWN0aW9uICYmIGhhc093bi5jYWxsKGRvYywgJ19pZCcpKSB7XG4gICAgICByZXN1bHQuX2lkID0gZG9jLl9pZDtcbiAgICB9XG5cbiAgICBpZiAoIV9pZFByb2plY3Rpb24gJiYgaGFzT3duLmNhbGwocmVzdWx0LCAnX2lkJykpIHtcbiAgICAgIGRlbGV0ZSByZXN1bHQuX2lkO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59O1xuXG4vLyBDYWxjdWxhdGVzIHRoZSBkb2N1bWVudCB0byBpbnNlcnQgaW4gY2FzZSB3ZSdyZSBkb2luZyBhbiB1cHNlcnQgYW5kIHRoZVxuLy8gc2VsZWN0b3IgZG9lcyBub3QgbWF0Y2ggYW55IGVsZW1lbnRzXG5Mb2NhbENvbGxlY3Rpb24uX2NyZWF0ZVVwc2VydERvY3VtZW50ID0gKHNlbGVjdG9yLCBtb2RpZmllcikgPT4ge1xuICBjb25zdCBzZWxlY3RvckRvY3VtZW50ID0gcG9wdWxhdGVEb2N1bWVudFdpdGhRdWVyeUZpZWxkcyhzZWxlY3Rvcik7XG4gIGNvbnN0IGlzTW9kaWZ5ID0gTG9jYWxDb2xsZWN0aW9uLl9pc01vZGlmaWNhdGlvbk1vZChtb2RpZmllcik7XG5cbiAgY29uc3QgbmV3RG9jID0ge307XG5cbiAgaWYgKHNlbGVjdG9yRG9jdW1lbnQuX2lkKSB7XG4gICAgbmV3RG9jLl9pZCA9IHNlbGVjdG9yRG9jdW1lbnQuX2lkO1xuICAgIGRlbGV0ZSBzZWxlY3RvckRvY3VtZW50Ll9pZDtcbiAgfVxuXG4gIC8vIFRoaXMgZG91YmxlIF9tb2RpZnkgY2FsbCBpcyBtYWRlIHRvIGhlbHAgd2l0aCBuZXN0ZWQgcHJvcGVydGllcyAoc2VlIGlzc3VlXG4gIC8vICM4NjMxKS4gV2UgZG8gdGhpcyBldmVuIGlmIGl0J3MgYSByZXBsYWNlbWVudCBmb3IgdmFsaWRhdGlvbiBwdXJwb3NlcyAoZS5nLlxuICAvLyBhbWJpZ3VvdXMgaWQncylcbiAgTG9jYWxDb2xsZWN0aW9uLl9tb2RpZnkobmV3RG9jLCB7JHNldDogc2VsZWN0b3JEb2N1bWVudH0pO1xuICBMb2NhbENvbGxlY3Rpb24uX21vZGlmeShuZXdEb2MsIG1vZGlmaWVyLCB7aXNJbnNlcnQ6IHRydWV9KTtcblxuICBpZiAoaXNNb2RpZnkpIHtcbiAgICByZXR1cm4gbmV3RG9jO1xuICB9XG5cbiAgLy8gUmVwbGFjZW1lbnQgY2FuIHRha2UgX2lkIGZyb20gcXVlcnkgZG9jdW1lbnRcbiAgY29uc3QgcmVwbGFjZW1lbnQgPSBPYmplY3QuYXNzaWduKHt9LCBtb2RpZmllcik7XG4gIGlmIChuZXdEb2MuX2lkKSB7XG4gICAgcmVwbGFjZW1lbnQuX2lkID0gbmV3RG9jLl9pZDtcbiAgfVxuXG4gIHJldHVybiByZXBsYWNlbWVudDtcbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5fZGlmZk9iamVjdHMgPSAobGVmdCwgcmlnaHQsIGNhbGxiYWNrcykgPT4ge1xuICByZXR1cm4gRGlmZlNlcXVlbmNlLmRpZmZPYmplY3RzKGxlZnQsIHJpZ2h0LCBjYWxsYmFja3MpO1xufTtcblxuLy8gb3JkZXJlZDogYm9vbC5cbi8vIG9sZF9yZXN1bHRzIGFuZCBuZXdfcmVzdWx0czogY29sbGVjdGlvbnMgb2YgZG9jdW1lbnRzLlxuLy8gICAgaWYgb3JkZXJlZCwgdGhleSBhcmUgYXJyYXlzLlxuLy8gICAgaWYgdW5vcmRlcmVkLCB0aGV5IGFyZSBJZE1hcHNcbkxvY2FsQ29sbGVjdGlvbi5fZGlmZlF1ZXJ5Q2hhbmdlcyA9IChvcmRlcmVkLCBvbGRSZXN1bHRzLCBuZXdSZXN1bHRzLCBvYnNlcnZlciwgb3B0aW9ucykgPT5cbiAgRGlmZlNlcXVlbmNlLmRpZmZRdWVyeUNoYW5nZXMob3JkZXJlZCwgb2xkUmVzdWx0cywgbmV3UmVzdWx0cywgb2JzZXJ2ZXIsIG9wdGlvbnMpXG47XG5cbkxvY2FsQ29sbGVjdGlvbi5fZGlmZlF1ZXJ5T3JkZXJlZENoYW5nZXMgPSAob2xkUmVzdWx0cywgbmV3UmVzdWx0cywgb2JzZXJ2ZXIsIG9wdGlvbnMpID0+XG4gIERpZmZTZXF1ZW5jZS5kaWZmUXVlcnlPcmRlcmVkQ2hhbmdlcyhvbGRSZXN1bHRzLCBuZXdSZXN1bHRzLCBvYnNlcnZlciwgb3B0aW9ucylcbjtcblxuTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlVbm9yZGVyZWRDaGFuZ2VzID0gKG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIG9ic2VydmVyLCBvcHRpb25zKSA9PlxuICBEaWZmU2VxdWVuY2UuZGlmZlF1ZXJ5VW5vcmRlcmVkQ2hhbmdlcyhvbGRSZXN1bHRzLCBuZXdSZXN1bHRzLCBvYnNlcnZlciwgb3B0aW9ucylcbjtcblxuTG9jYWxDb2xsZWN0aW9uLl9maW5kSW5PcmRlcmVkUmVzdWx0cyA9IChxdWVyeSwgZG9jKSA9PiB7XG4gIGlmICghcXVlcnkub3JkZXJlZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2FuXFwndCBjYWxsIF9maW5kSW5PcmRlcmVkUmVzdWx0cyBvbiB1bm9yZGVyZWQgcXVlcnknKTtcbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcXVlcnkucmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgIGlmIChxdWVyeS5yZXN1bHRzW2ldID09PSBkb2MpIHtcbiAgICAgIHJldHVybiBpO1xuICAgIH1cbiAgfVxuXG4gIHRocm93IEVycm9yKCdvYmplY3QgbWlzc2luZyBmcm9tIHF1ZXJ5Jyk7XG59O1xuXG4vLyBJZiB0aGlzIGlzIGEgc2VsZWN0b3Igd2hpY2ggZXhwbGljaXRseSBjb25zdHJhaW5zIHRoZSBtYXRjaCBieSBJRCB0byBhIGZpbml0ZVxuLy8gbnVtYmVyIG9mIGRvY3VtZW50cywgcmV0dXJucyBhIGxpc3Qgb2YgdGhlaXIgSURzLiAgT3RoZXJ3aXNlIHJldHVybnNcbi8vIG51bGwuIE5vdGUgdGhhdCB0aGUgc2VsZWN0b3IgbWF5IGhhdmUgb3RoZXIgcmVzdHJpY3Rpb25zIHNvIGl0IG1heSBub3QgZXZlblxuLy8gbWF0Y2ggdGhvc2UgZG9jdW1lbnQhICBXZSBjYXJlIGFib3V0ICRpbiBhbmQgJGFuZCBzaW5jZSB0aG9zZSBhcmUgZ2VuZXJhdGVkXG4vLyBhY2Nlc3MtY29udHJvbGxlZCB1cGRhdGUgYW5kIHJlbW92ZS5cbkxvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3IgPSBzZWxlY3RvciA9PiB7XG4gIC8vIElzIHRoZSBzZWxlY3RvciBqdXN0IGFuIElEP1xuICBpZiAoTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQoc2VsZWN0b3IpKSB7XG4gICAgcmV0dXJuIFtzZWxlY3Rvcl07XG4gIH1cblxuICBpZiAoIXNlbGVjdG9yKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBEbyB3ZSBoYXZlIGFuIF9pZCBjbGF1c2U/XG4gIGlmIChoYXNPd24uY2FsbChzZWxlY3RvciwgJ19pZCcpKSB7XG4gICAgLy8gSXMgdGhlIF9pZCBjbGF1c2UganVzdCBhbiBJRD9cbiAgICBpZiAoTG9jYWxDb2xsZWN0aW9uLl9zZWxlY3RvcklzSWQoc2VsZWN0b3IuX2lkKSkge1xuICAgICAgcmV0dXJuIFtzZWxlY3Rvci5faWRdO1xuICAgIH1cblxuICAgIC8vIElzIHRoZSBfaWQgY2xhdXNlIHtfaWQ6IHskaW46IFtcInhcIiwgXCJ5XCIsIFwielwiXX19P1xuICAgIGlmIChzZWxlY3Rvci5faWRcbiAgICAgICAgJiYgQXJyYXkuaXNBcnJheShzZWxlY3Rvci5faWQuJGluKVxuICAgICAgICAmJiBzZWxlY3Rvci5faWQuJGluLmxlbmd0aFxuICAgICAgICAmJiBzZWxlY3Rvci5faWQuJGluLmV2ZXJ5KExvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkKSkge1xuICAgICAgcmV0dXJuIHNlbGVjdG9yLl9pZC4kaW47XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBJZiB0aGlzIGlzIGEgdG9wLWxldmVsICRhbmQsIGFuZCBhbnkgb2YgdGhlIGNsYXVzZXMgY29uc3RyYWluIHRoZWlyXG4gIC8vIGRvY3VtZW50cywgdGhlbiB0aGUgd2hvbGUgc2VsZWN0b3IgaXMgY29uc3RyYWluZWQgYnkgYW55IG9uZSBjbGF1c2Unc1xuICAvLyBjb25zdHJhaW50LiAoV2VsbCwgYnkgdGhlaXIgaW50ZXJzZWN0aW9uLCBidXQgdGhhdCBzZWVtcyB1bmxpa2VseS4pXG4gIGlmIChBcnJheS5pc0FycmF5KHNlbGVjdG9yLiRhbmQpKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzZWxlY3Rvci4kYW5kLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBzdWJJZHMgPSBMb2NhbENvbGxlY3Rpb24uX2lkc01hdGNoZWRCeVNlbGVjdG9yKHNlbGVjdG9yLiRhbmRbaV0pO1xuXG4gICAgICBpZiAoc3ViSWRzKSB7XG4gICAgICAgIHJldHVybiBzdWJJZHM7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX2luc2VydEluUmVzdWx0c1N5bmMgPSAocXVlcnksIGRvYykgPT4ge1xuICBjb25zdCBmaWVsZHMgPSBFSlNPTi5jbG9uZShkb2MpO1xuXG4gIGRlbGV0ZSBmaWVsZHMuX2lkO1xuXG4gIGlmIChxdWVyeS5vcmRlcmVkKSB7XG4gICAgaWYgKCFxdWVyeS5zb3J0ZXIpIHtcbiAgICAgIHF1ZXJ5LmFkZGVkQmVmb3JlKGRvYy5faWQsIHF1ZXJ5LnByb2plY3Rpb25GbihmaWVsZHMpLCBudWxsKTtcbiAgICAgIHF1ZXJ5LnJlc3VsdHMucHVzaChkb2MpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBpID0gTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblNvcnRlZExpc3QoXG4gICAgICAgIHF1ZXJ5LnNvcnRlci5nZXRDb21wYXJhdG9yKHtkaXN0YW5jZXM6IHF1ZXJ5LmRpc3RhbmNlc30pLFxuICAgICAgICBxdWVyeS5yZXN1bHRzLFxuICAgICAgICBkb2NcbiAgICAgICk7XG5cbiAgICAgIGxldCBuZXh0ID0gcXVlcnkucmVzdWx0c1tpICsgMV07XG4gICAgICBpZiAobmV4dCkge1xuICAgICAgICBuZXh0ID0gbmV4dC5faWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXh0ID0gbnVsbDtcbiAgICAgIH1cblxuICAgICAgcXVlcnkuYWRkZWRCZWZvcmUoZG9jLl9pZCwgcXVlcnkucHJvamVjdGlvbkZuKGZpZWxkcyksIG5leHQpO1xuICAgIH1cblxuICAgIHF1ZXJ5LmFkZGVkKGRvYy5faWQsIHF1ZXJ5LnByb2plY3Rpb25GbihmaWVsZHMpKTtcbiAgfSBlbHNlIHtcbiAgICBxdWVyeS5hZGRlZChkb2MuX2lkLCBxdWVyeS5wcm9qZWN0aW9uRm4oZmllbGRzKSk7XG4gICAgcXVlcnkucmVzdWx0cy5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgfVxufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblJlc3VsdHNBc3luYyA9IGFzeW5jIChxdWVyeSwgZG9jKSA9PiB7XG4gIGNvbnN0IGZpZWxkcyA9IEVKU09OLmNsb25lKGRvYyk7XG5cbiAgZGVsZXRlIGZpZWxkcy5faWQ7XG5cbiAgaWYgKHF1ZXJ5Lm9yZGVyZWQpIHtcbiAgICBpZiAoIXF1ZXJ5LnNvcnRlcikge1xuICAgICAgYXdhaXQgcXVlcnkuYWRkZWRCZWZvcmUoZG9jLl9pZCwgcXVlcnkucHJvamVjdGlvbkZuKGZpZWxkcyksIG51bGwpO1xuICAgICAgcXVlcnkucmVzdWx0cy5wdXNoKGRvYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGkgPSBMb2NhbENvbGxlY3Rpb24uX2luc2VydEluU29ydGVkTGlzdChcbiAgICAgICAgcXVlcnkuc29ydGVyLmdldENvbXBhcmF0b3Ioe2Rpc3RhbmNlczogcXVlcnkuZGlzdGFuY2VzfSksXG4gICAgICAgIHF1ZXJ5LnJlc3VsdHMsXG4gICAgICAgIGRvY1xuICAgICAgKTtcblxuICAgICAgbGV0IG5leHQgPSBxdWVyeS5yZXN1bHRzW2kgKyAxXTtcbiAgICAgIGlmIChuZXh0KSB7XG4gICAgICAgIG5leHQgPSBuZXh0Ll9pZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5leHQgPSBudWxsO1xuICAgICAgfVxuXG4gICAgICBhd2FpdCBxdWVyeS5hZGRlZEJlZm9yZShkb2MuX2lkLCBxdWVyeS5wcm9qZWN0aW9uRm4oZmllbGRzKSwgbmV4dCk7XG4gICAgfVxuXG4gICAgYXdhaXQgcXVlcnkuYWRkZWQoZG9jLl9pZCwgcXVlcnkucHJvamVjdGlvbkZuKGZpZWxkcykpO1xuICB9IGVsc2Uge1xuICAgIGF3YWl0IHF1ZXJ5LmFkZGVkKGRvYy5faWQsIHF1ZXJ5LnByb2plY3Rpb25GbihmaWVsZHMpKTtcbiAgICBxdWVyeS5yZXN1bHRzLnNldChkb2MuX2lkLCBkb2MpO1xuICB9XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX2luc2VydEluU29ydGVkTGlzdCA9IChjbXAsIGFycmF5LCB2YWx1ZSkgPT4ge1xuICBpZiAoYXJyYXkubGVuZ3RoID09PSAwKSB7XG4gICAgYXJyYXkucHVzaCh2YWx1ZSk7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICBjb25zdCBpID0gTG9jYWxDb2xsZWN0aW9uLl9iaW5hcnlTZWFyY2goY21wLCBhcnJheSwgdmFsdWUpO1xuXG4gIGFycmF5LnNwbGljZShpLCAwLCB2YWx1ZSk7XG5cbiAgcmV0dXJuIGk7XG59O1xuXG5Mb2NhbENvbGxlY3Rpb24uX2lzTW9kaWZpY2F0aW9uTW9kID0gbW9kID0+IHtcbiAgbGV0IGlzTW9kaWZ5ID0gZmFsc2U7XG4gIGxldCBpc1JlcGxhY2UgPSBmYWxzZTtcblxuICBPYmplY3Qua2V5cyhtb2QpLmZvckVhY2goa2V5ID0+IHtcbiAgICBpZiAoa2V5LnN1YnN0cigwLCAxKSA9PT0gJyQnKSB7XG4gICAgICBpc01vZGlmeSA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlzUmVwbGFjZSA9IHRydWU7XG4gICAgfVxuICB9KTtcblxuICBpZiAoaXNNb2RpZnkgJiYgaXNSZXBsYWNlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgJ1VwZGF0ZSBwYXJhbWV0ZXIgY2Fubm90IGhhdmUgYm90aCBtb2RpZmllciBhbmQgbm9uLW1vZGlmaWVyIGZpZWxkcy4nXG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBpc01vZGlmeTtcbn07XG5cbi8vIFhYWCBtYXliZSB0aGlzIHNob3VsZCBiZSBFSlNPTi5pc09iamVjdCwgdGhvdWdoIEVKU09OIGRvZXNuJ3Qga25vdyBhYm91dFxuLy8gUmVnRXhwXG4vLyBYWFggbm90ZSB0aGF0IF90eXBlKHVuZGVmaW5lZCkgPT09IDMhISEhXG5Mb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QgPSB4ID0+IHtcbiAgcmV0dXJuIHggJiYgTG9jYWxDb2xsZWN0aW9uLl9mLl90eXBlKHgpID09PSAzO1xufTtcblxuLy8gWFhYIG5lZWQgYSBzdHJhdGVneSBmb3IgcGFzc2luZyB0aGUgYmluZGluZyBvZiAkIGludG8gdGhpc1xuLy8gZnVuY3Rpb24sIGZyb20gdGhlIGNvbXBpbGVkIHNlbGVjdG9yXG4vL1xuLy8gbWF5YmUganVzdCB7a2V5LnVwLnRvLmp1c3QuYmVmb3JlLmRvbGxhcnNpZ246IGFycmF5X2luZGV4fVxuLy9cbi8vIFhYWCBhdG9taWNpdHk6IGlmIG9uZSBtb2RpZmljYXRpb24gZmFpbHMsIGRvIHdlIHJvbGwgYmFjayB0aGUgd2hvbGVcbi8vIGNoYW5nZT9cbi8vXG4vLyBvcHRpb25zOlxuLy8gICAtIGlzSW5zZXJ0IGlzIHNldCB3aGVuIF9tb2RpZnkgaXMgYmVpbmcgY2FsbGVkIHRvIGNvbXB1dGUgdGhlIGRvY3VtZW50IHRvXG4vLyAgICAgaW5zZXJ0IGFzIHBhcnQgb2YgYW4gdXBzZXJ0IG9wZXJhdGlvbi4gV2UgdXNlIHRoaXMgcHJpbWFyaWx5IHRvIGZpZ3VyZVxuLy8gICAgIG91dCB3aGVuIHRvIHNldCB0aGUgZmllbGRzIGluICRzZXRPbkluc2VydCwgaWYgcHJlc2VudC5cbkxvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5ID0gKGRvYywgbW9kaWZpZXIsIG9wdGlvbnMgPSB7fSkgPT4ge1xuICBpZiAoIUxvY2FsQ29sbGVjdGlvbi5faXNQbGFpbk9iamVjdChtb2RpZmllcikpIHtcbiAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignTW9kaWZpZXIgbXVzdCBiZSBhbiBvYmplY3QnKTtcbiAgfVxuXG4gIC8vIE1ha2Ugc3VyZSB0aGUgY2FsbGVyIGNhbid0IG11dGF0ZSBvdXIgZGF0YSBzdHJ1Y3R1cmVzLlxuICBtb2RpZmllciA9IEVKU09OLmNsb25lKG1vZGlmaWVyKTtcblxuICBjb25zdCBpc01vZGlmaWVyID0gaXNPcGVyYXRvck9iamVjdChtb2RpZmllcik7XG4gIGNvbnN0IG5ld0RvYyA9IGlzTW9kaWZpZXIgPyBFSlNPTi5jbG9uZShkb2MpIDogbW9kaWZpZXI7XG5cbiAgaWYgKGlzTW9kaWZpZXIpIHtcbiAgICAvLyBhcHBseSBtb2RpZmllcnMgdG8gdGhlIGRvYy5cbiAgICBPYmplY3Qua2V5cyhtb2RpZmllcikuZm9yRWFjaChvcGVyYXRvciA9PiB7XG4gICAgICAvLyBUcmVhdCAkc2V0T25JbnNlcnQgYXMgJHNldCBpZiB0aGlzIGlzIGFuIGluc2VydC5cbiAgICAgIGNvbnN0IHNldE9uSW5zZXJ0ID0gb3B0aW9ucy5pc0luc2VydCAmJiBvcGVyYXRvciA9PT0gJyRzZXRPbkluc2VydCc7XG4gICAgICBjb25zdCBtb2RGdW5jID0gTU9ESUZJRVJTW3NldE9uSW5zZXJ0ID8gJyRzZXQnIDogb3BlcmF0b3JdO1xuICAgICAgY29uc3Qgb3BlcmFuZCA9IG1vZGlmaWVyW29wZXJhdG9yXTtcblxuICAgICAgaWYgKCFtb2RGdW5jKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKGBJbnZhbGlkIG1vZGlmaWVyIHNwZWNpZmllZCAke29wZXJhdG9yfWApO1xuICAgICAgfVxuXG4gICAgICBPYmplY3Qua2V5cyhvcGVyYW5kKS5mb3JFYWNoKGtleXBhdGggPT4ge1xuICAgICAgICBjb25zdCBhcmcgPSBvcGVyYW5kW2tleXBhdGhdO1xuXG4gICAgICAgIGlmIChrZXlwYXRoID09PSAnJykge1xuICAgICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdBbiBlbXB0eSB1cGRhdGUgcGF0aCBpcyBub3QgdmFsaWQuJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBrZXlwYXJ0cyA9IGtleXBhdGguc3BsaXQoJy4nKTtcblxuICAgICAgICBpZiAoIWtleXBhcnRzLmV2ZXJ5KEJvb2xlYW4pKSB7XG4gICAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgICBgVGhlIHVwZGF0ZSBwYXRoICcke2tleXBhdGh9JyBjb250YWlucyBhbiBlbXB0eSBmaWVsZCBuYW1lLCBgICtcbiAgICAgICAgICAgICd3aGljaCBpcyBub3QgYWxsb3dlZC4nXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRhcmdldCA9IGZpbmRNb2RUYXJnZXQobmV3RG9jLCBrZXlwYXJ0cywge1xuICAgICAgICAgIGFycmF5SW5kaWNlczogb3B0aW9ucy5hcnJheUluZGljZXMsXG4gICAgICAgICAgZm9yYmlkQXJyYXk6IG9wZXJhdG9yID09PSAnJHJlbmFtZScsXG4gICAgICAgICAgbm9DcmVhdGU6IE5PX0NSRUFURV9NT0RJRklFUlNbb3BlcmF0b3JdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIG1vZEZ1bmModGFyZ2V0LCBrZXlwYXJ0cy5wb3AoKSwgYXJnLCBrZXlwYXRoLCBuZXdEb2MpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpZiAoZG9jLl9pZCAmJiAhRUpTT04uZXF1YWxzKGRvYy5faWQsIG5ld0RvYy5faWQpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgYEFmdGVyIGFwcGx5aW5nIHRoZSB1cGRhdGUgdG8gdGhlIGRvY3VtZW50IHtfaWQ6IFwiJHtkb2MuX2lkfVwiLCAuLi59LGAgK1xuICAgICAgICAnIHRoZSAoaW1tdXRhYmxlKSBmaWVsZCBcXCdfaWRcXCcgd2FzIGZvdW5kIHRvIGhhdmUgYmVlbiBhbHRlcmVkIHRvICcgK1xuICAgICAgICBgX2lkOiBcIiR7bmV3RG9jLl9pZH1cImBcbiAgICAgICk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChkb2MuX2lkICYmIG1vZGlmaWVyLl9pZCAmJiAhRUpTT04uZXF1YWxzKGRvYy5faWQsIG1vZGlmaWVyLl9pZCkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICBgVGhlIF9pZCBmaWVsZCBjYW5ub3QgYmUgY2hhbmdlZCBmcm9tIHtfaWQ6IFwiJHtkb2MuX2lkfVwifSB0byBgICtcbiAgICAgICAgYHtfaWQ6IFwiJHttb2RpZmllci5faWR9XCJ9YFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyByZXBsYWNlIHRoZSB3aG9sZSBkb2N1bWVudFxuICAgIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyhtb2RpZmllcik7XG4gIH1cblxuICAvLyBtb3ZlIG5ldyBkb2N1bWVudCBpbnRvIHBsYWNlLlxuICBPYmplY3Qua2V5cyhkb2MpLmZvckVhY2goa2V5ID0+IHtcbiAgICAvLyBOb3RlOiB0aGlzIHVzZWQgdG8gYmUgZm9yICh2YXIga2V5IGluIGRvYykgaG93ZXZlciwgdGhpcyBkb2VzIG5vdFxuICAgIC8vIHdvcmsgcmlnaHQgaW4gT3BlcmEuIERlbGV0aW5nIGZyb20gYSBkb2Mgd2hpbGUgaXRlcmF0aW5nIG92ZXIgaXRcbiAgICAvLyB3b3VsZCBzb21ldGltZXMgY2F1c2Ugb3BlcmEgdG8gc2tpcCBzb21lIGtleXMuXG4gICAgaWYgKGtleSAhPT0gJ19pZCcpIHtcbiAgICAgIGRlbGV0ZSBkb2Nba2V5XTtcbiAgICB9XG4gIH0pO1xuXG4gIE9iamVjdC5rZXlzKG5ld0RvYykuZm9yRWFjaChrZXkgPT4ge1xuICAgIGRvY1trZXldID0gbmV3RG9jW2tleV07XG4gIH0pO1xufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlRnJvbU9ic2VydmVDaGFuZ2VzID0gKGN1cnNvciwgb2JzZXJ2ZUNhbGxiYWNrcykgPT4ge1xuICBjb25zdCB0cmFuc2Zvcm0gPSBjdXJzb3IuZ2V0VHJhbnNmb3JtKCkgfHwgKGRvYyA9PiBkb2MpO1xuICBsZXQgc3VwcHJlc3NlZCA9ICEhb2JzZXJ2ZUNhbGxiYWNrcy5fc3VwcHJlc3NfaW5pdGlhbDtcblxuICBsZXQgb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3M7XG4gIGlmIChMb2NhbENvbGxlY3Rpb24uX29ic2VydmVDYWxsYmFja3NBcmVPcmRlcmVkKG9ic2VydmVDYWxsYmFja3MpKSB7XG4gICAgLy8gVGhlIFwiX25vX2luZGljZXNcIiBvcHRpb24gc2V0cyBhbGwgaW5kZXggYXJndW1lbnRzIHRvIC0xIGFuZCBza2lwcyB0aGVcbiAgICAvLyBsaW5lYXIgc2NhbnMgcmVxdWlyZWQgdG8gZ2VuZXJhdGUgdGhlbS4gIFRoaXMgbGV0cyBvYnNlcnZlcnMgdGhhdCBkb24ndFxuICAgIC8vIG5lZWQgYWJzb2x1dGUgaW5kaWNlcyBiZW5lZml0IGZyb20gdGhlIG90aGVyIGZlYXR1cmVzIG9mIHRoaXMgQVBJIC0tXG4gICAgLy8gcmVsYXRpdmUgb3JkZXIsIHRyYW5zZm9ybXMsIGFuZCBhcHBseUNoYW5nZXMgLS0gd2l0aG91dCB0aGUgc3BlZWQgaGl0LlxuICAgIGNvbnN0IGluZGljZXMgPSAhb2JzZXJ2ZUNhbGxiYWNrcy5fbm9faW5kaWNlcztcblxuICAgIG9ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzID0ge1xuICAgICAgYWRkZWRCZWZvcmUoaWQsIGZpZWxkcywgYmVmb3JlKSB7XG4gICAgICAgIGNvbnN0IGNoZWNrID0gc3VwcHJlc3NlZCB8fCAhKG9ic2VydmVDYWxsYmFja3MuYWRkZWRBdCB8fCBvYnNlcnZlQ2FsbGJhY2tzLmFkZGVkKVxuICAgICAgICBpZiAoY2hlY2spIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkb2MgPSB0cmFuc2Zvcm0oT2JqZWN0LmFzc2lnbihmaWVsZHMsIHtfaWQ6IGlkfSkpO1xuXG4gICAgICAgIGlmIChvYnNlcnZlQ2FsbGJhY2tzLmFkZGVkQXQpIHtcbiAgICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLmFkZGVkQXQoXG4gICAgICAgICAgICAgIGRvYyxcbiAgICAgICAgICAgICAgaW5kaWNlc1xuICAgICAgICAgICAgICAgICAgPyBiZWZvcmVcbiAgICAgICAgICAgICAgICAgICAgICA/IHRoaXMuZG9jcy5pbmRleE9mKGJlZm9yZSlcbiAgICAgICAgICAgICAgICAgICAgICA6IHRoaXMuZG9jcy5zaXplKClcbiAgICAgICAgICAgICAgICAgIDogLTEsXG4gICAgICAgICAgICAgIGJlZm9yZVxuICAgICAgICAgICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5hZGRlZChkb2MpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgY2hhbmdlZChpZCwgZmllbGRzKSB7XG5cbiAgICAgICAgaWYgKCEob2JzZXJ2ZUNhbGxiYWNrcy5jaGFuZ2VkQXQgfHwgb2JzZXJ2ZUNhbGxiYWNrcy5jaGFuZ2VkKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBkb2MgPSBFSlNPTi5jbG9uZSh0aGlzLmRvY3MuZ2V0KGlkKSk7XG4gICAgICAgIGlmICghZG9jKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGlkIGZvciBjaGFuZ2VkOiAke2lkfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb2xkRG9jID0gdHJhbnNmb3JtKEVKU09OLmNsb25lKGRvYykpO1xuXG4gICAgICAgIERpZmZTZXF1ZW5jZS5hcHBseUNoYW5nZXMoZG9jLCBmaWVsZHMpO1xuXG4gICAgICAgIGlmIChvYnNlcnZlQ2FsbGJhY2tzLmNoYW5nZWRBdCkge1xuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MuY2hhbmdlZEF0KFxuICAgICAgICAgICAgICB0cmFuc2Zvcm0oZG9jKSxcbiAgICAgICAgICAgICAgb2xkRG9jLFxuICAgICAgICAgICAgICBpbmRpY2VzID8gdGhpcy5kb2NzLmluZGV4T2YoaWQpIDogLTFcbiAgICAgICAgICApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MuY2hhbmdlZCh0cmFuc2Zvcm0oZG9jKSwgb2xkRG9jKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIG1vdmVkQmVmb3JlKGlkLCBiZWZvcmUpIHtcbiAgICAgICAgaWYgKCFvYnNlcnZlQ2FsbGJhY2tzLm1vdmVkVG8pIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmcm9tID0gaW5kaWNlcyA/IHRoaXMuZG9jcy5pbmRleE9mKGlkKSA6IC0xO1xuICAgICAgICBsZXQgdG8gPSBpbmRpY2VzXG4gICAgICAgICAgICA/IGJlZm9yZVxuICAgICAgICAgICAgICAgID8gdGhpcy5kb2NzLmluZGV4T2YoYmVmb3JlKVxuICAgICAgICAgICAgICAgIDogdGhpcy5kb2NzLnNpemUoKVxuICAgICAgICAgICAgOiAtMTtcblxuICAgICAgICAvLyBXaGVuIG5vdCBtb3ZpbmcgYmFja3dhcmRzLCBhZGp1c3QgZm9yIHRoZSBmYWN0IHRoYXQgcmVtb3ZpbmcgdGhlXG4gICAgICAgIC8vIGRvY3VtZW50IHNsaWRlcyBldmVyeXRoaW5nIGJhY2sgb25lIHNsb3QuXG4gICAgICAgIGlmICh0byA+IGZyb20pIHtcbiAgICAgICAgICAtLXRvO1xuICAgICAgICB9XG5cbiAgICAgICAgb2JzZXJ2ZUNhbGxiYWNrcy5tb3ZlZFRvKFxuICAgICAgICAgICAgdHJhbnNmb3JtKEVKU09OLmNsb25lKHRoaXMuZG9jcy5nZXQoaWQpKSksXG4gICAgICAgICAgICBmcm9tLFxuICAgICAgICAgICAgdG8sXG4gICAgICAgICAgICBiZWZvcmUgfHwgbnVsbFxuICAgICAgICApO1xuICAgICAgfSxcbiAgICAgIHJlbW92ZWQoaWQpIHtcbiAgICAgICAgaWYgKCEob2JzZXJ2ZUNhbGxiYWNrcy5yZW1vdmVkQXQgfHwgb2JzZXJ2ZUNhbGxiYWNrcy5yZW1vdmVkKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRlY2huaWNhbGx5IG1heWJlIHRoZXJlIHNob3VsZCBiZSBhbiBFSlNPTi5jbG9uZSBoZXJlLCBidXQgaXQncyBhYm91dFxuICAgICAgICAvLyB0byBiZSByZW1vdmVkIGZyb20gdGhpcy5kb2NzIVxuICAgICAgICBjb25zdCBkb2MgPSB0cmFuc2Zvcm0odGhpcy5kb2NzLmdldChpZCkpO1xuXG4gICAgICAgIGlmIChvYnNlcnZlQ2FsbGJhY2tzLnJlbW92ZWRBdCkge1xuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MucmVtb3ZlZEF0KGRvYywgaW5kaWNlcyA/IHRoaXMuZG9jcy5pbmRleE9mKGlkKSA6IC0xKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLnJlbW92ZWQoZG9jKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIG9ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzID0ge1xuICAgICAgYWRkZWQoaWQsIGZpZWxkcykge1xuICAgICAgICBpZiAoIXN1cHByZXNzZWQgJiYgb2JzZXJ2ZUNhbGxiYWNrcy5hZGRlZCkge1xuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MuYWRkZWQodHJhbnNmb3JtKE9iamVjdC5hc3NpZ24oZmllbGRzLCB7X2lkOiBpZH0pKSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBjaGFuZ2VkKGlkLCBmaWVsZHMpIHtcbiAgICAgICAgaWYgKG9ic2VydmVDYWxsYmFja3MuY2hhbmdlZCkge1xuICAgICAgICAgIGNvbnN0IG9sZERvYyA9IHRoaXMuZG9jcy5nZXQoaWQpO1xuICAgICAgICAgIGNvbnN0IGRvYyA9IEVKU09OLmNsb25lKG9sZERvYyk7XG5cbiAgICAgICAgICBEaWZmU2VxdWVuY2UuYXBwbHlDaGFuZ2VzKGRvYywgZmllbGRzKTtcblxuICAgICAgICAgIG9ic2VydmVDYWxsYmFja3MuY2hhbmdlZChcbiAgICAgICAgICAgICAgdHJhbnNmb3JtKGRvYyksXG4gICAgICAgICAgICAgIHRyYW5zZm9ybShFSlNPTi5jbG9uZShvbGREb2MpKVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICByZW1vdmVkKGlkKSB7XG4gICAgICAgIGlmIChvYnNlcnZlQ2FsbGJhY2tzLnJlbW92ZWQpIHtcbiAgICAgICAgICBvYnNlcnZlQ2FsbGJhY2tzLnJlbW92ZWQodHJhbnNmb3JtKHRoaXMuZG9jcy5nZXQoaWQpKSk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGNoYW5nZU9ic2VydmVyID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fQ2FjaGluZ0NoYW5nZU9ic2VydmVyKHtcbiAgICBjYWxsYmFja3M6IG9ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzXG4gIH0pO1xuXG4gIC8vIENhY2hpbmdDaGFuZ2VPYnNlcnZlciBjbG9uZXMgYWxsIHJlY2VpdmVkIGlucHV0IG9uIGl0cyBjYWxsYmFja3NcbiAgLy8gU28gd2UgY2FuIG1hcmsgaXQgYXMgc2FmZSB0byByZWR1Y2UgdGhlIGVqc29uIGNsb25lcy5cbiAgLy8gVGhpcyBpcyB0ZXN0ZWQgYnkgdGhlIGBtb25nby1saXZlZGF0YSAtIChleHRlbmRlZCkgc2NyaWJibGluZ2AgdGVzdHNcbiAgY2hhbmdlT2JzZXJ2ZXIuYXBwbHlDaGFuZ2UuX2Zyb21PYnNlcnZlID0gdHJ1ZTtcbiAgY29uc3QgaGFuZGxlID0gY3Vyc29yLm9ic2VydmVDaGFuZ2VzKGNoYW5nZU9ic2VydmVyLmFwcGx5Q2hhbmdlLFxuICAgICAgeyBub25NdXRhdGluZ0NhbGxiYWNrczogdHJ1ZSB9KTtcblxuICAvLyBJZiBuZWVkZWQsIHJlLWVuYWJsZSBjYWxsYmFja3MgYXMgc29vbiBhcyB0aGUgaW5pdGlhbCBiYXRjaCBpcyByZWFkeS5cbiAgY29uc3Qgc2V0U3VwcHJlc3NlZCA9IChoKSA9PiB7XG4gICAgaWYgKGguaXNSZWFkeSkgc3VwcHJlc3NlZCA9IGZhbHNlO1xuICAgIGVsc2UgaC5pc1JlYWR5UHJvbWlzZT8udGhlbigoKSA9PiAoc3VwcHJlc3NlZCA9IGZhbHNlKSk7XG4gIH07XG4gIC8vIFdoZW4gd2UgY2FsbCBjdXJzb3Iub2JzZXJ2ZUNoYW5nZXMoKSBpdCBjYW4gYmUgdGhlIG9uIGZyb21cbiAgLy8gdGhlIG1vbmdvIHBhY2thZ2UgKGluc3RlYWQgb2YgdGhlIG1pbmltb25nbyBvbmUpIGFuZCBpdCBkb2Vzbid0IGhhdmUgaXNSZWFkeSBhbmQgaXNSZWFkeVByb21pc2VcbiAgaWYgKE1ldGVvci5faXNQcm9taXNlKGhhbmRsZSkpIHtcbiAgICBoYW5kbGUudGhlbihzZXRTdXBwcmVzc2VkKTtcbiAgfSBlbHNlIHtcbiAgICBzZXRTdXBwcmVzc2VkKGhhbmRsZSk7XG4gIH1cbiAgcmV0dXJuIGhhbmRsZTtcbn07XG5cbkxvY2FsQ29sbGVjdGlvbi5fb2JzZXJ2ZUNhbGxiYWNrc0FyZU9yZGVyZWQgPSBjYWxsYmFja3MgPT4ge1xuICBpZiAoY2FsbGJhY2tzLmFkZGVkICYmIGNhbGxiYWNrcy5hZGRlZEF0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2Ugc3BlY2lmeSBvbmx5IG9uZSBvZiBhZGRlZCgpIGFuZCBhZGRlZEF0KCknKTtcbiAgfVxuXG4gIGlmIChjYWxsYmFja3MuY2hhbmdlZCAmJiBjYWxsYmFja3MuY2hhbmdlZEF0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2Ugc3BlY2lmeSBvbmx5IG9uZSBvZiBjaGFuZ2VkKCkgYW5kIGNoYW5nZWRBdCgpJyk7XG4gIH1cblxuICBpZiAoY2FsbGJhY2tzLnJlbW92ZWQgJiYgY2FsbGJhY2tzLnJlbW92ZWRBdCkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHNwZWNpZnkgb25seSBvbmUgb2YgcmVtb3ZlZCgpIGFuZCByZW1vdmVkQXQoKScpO1xuICB9XG5cbiAgcmV0dXJuICEhKFxuICAgIGNhbGxiYWNrcy5hZGRlZEF0IHx8XG4gICAgY2FsbGJhY2tzLmNoYW5nZWRBdCB8fFxuICAgIGNhbGxiYWNrcy5tb3ZlZFRvIHx8XG4gICAgY2FsbGJhY2tzLnJlbW92ZWRBdFxuICApO1xufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlQ2hhbmdlc0NhbGxiYWNrc0FyZU9yZGVyZWQgPSBjYWxsYmFja3MgPT4ge1xuICBpZiAoY2FsbGJhY2tzLmFkZGVkICYmIGNhbGxiYWNrcy5hZGRlZEJlZm9yZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHNwZWNpZnkgb25seSBvbmUgb2YgYWRkZWQoKSBhbmQgYWRkZWRCZWZvcmUoKScpO1xuICB9XG5cbiAgcmV0dXJuICEhKGNhbGxiYWNrcy5hZGRlZEJlZm9yZSB8fCBjYWxsYmFja3MubW92ZWRCZWZvcmUpO1xufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9yZW1vdmVGcm9tUmVzdWx0c1N5bmMgPSAocXVlcnksIGRvYykgPT4ge1xuICBpZiAocXVlcnkub3JkZXJlZCkge1xuICAgIGNvbnN0IGkgPSBMb2NhbENvbGxlY3Rpb24uX2ZpbmRJbk9yZGVyZWRSZXN1bHRzKHF1ZXJ5LCBkb2MpO1xuXG4gICAgcXVlcnkucmVtb3ZlZChkb2MuX2lkKTtcbiAgICBxdWVyeS5yZXN1bHRzLnNwbGljZShpLCAxKTtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBpZCA9IGRvYy5faWQ7ICAvLyBpbiBjYXNlIGNhbGxiYWNrIG11dGF0ZXMgZG9jXG5cbiAgICBxdWVyeS5yZW1vdmVkKGRvYy5faWQpO1xuICAgIHF1ZXJ5LnJlc3VsdHMucmVtb3ZlKGlkKTtcbiAgfVxufTtcblxuTG9jYWxDb2xsZWN0aW9uLl9yZW1vdmVGcm9tUmVzdWx0c0FzeW5jID0gYXN5bmMgKHF1ZXJ5LCBkb2MpID0+IHtcbiAgaWYgKHF1ZXJ5Lm9yZGVyZWQpIHtcbiAgICBjb25zdCBpID0gTG9jYWxDb2xsZWN0aW9uLl9maW5kSW5PcmRlcmVkUmVzdWx0cyhxdWVyeSwgZG9jKTtcblxuICAgIGF3YWl0IHF1ZXJ5LnJlbW92ZWQoZG9jLl9pZCk7XG4gICAgcXVlcnkucmVzdWx0cy5zcGxpY2UoaSwgMSk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgaWQgPSBkb2MuX2lkOyAgLy8gaW4gY2FzZSBjYWxsYmFjayBtdXRhdGVzIGRvY1xuXG4gICAgYXdhaXQgcXVlcnkucmVtb3ZlZChkb2MuX2lkKTtcbiAgICBxdWVyeS5yZXN1bHRzLnJlbW92ZShpZCk7XG4gIH1cbn07XG5cbi8vIElzIHRoaXMgc2VsZWN0b3IganVzdCBzaG9ydGhhbmQgZm9yIGxvb2t1cCBieSBfaWQ/XG5Mb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZCA9IHNlbGVjdG9yID0+XG4gIHR5cGVvZiBzZWxlY3RvciA9PT0gJ251bWJlcicgfHxcbiAgdHlwZW9mIHNlbGVjdG9yID09PSAnc3RyaW5nJyB8fFxuICBzZWxlY3RvciBpbnN0YW5jZW9mIE1vbmdvSUQuT2JqZWN0SURcbjtcblxuLy8gSXMgdGhlIHNlbGVjdG9yIGp1c3QgbG9va3VwIGJ5IF9pZCAoc2hvcnRoYW5kIG9yIG5vdCk/XG5Mb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZFBlcmhhcHNBc09iamVjdCA9IHNlbGVjdG9yID0+XG4gIExvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkKHNlbGVjdG9yKSB8fFxuICBMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChzZWxlY3RvciAmJiBzZWxlY3Rvci5faWQpICYmXG4gIE9iamVjdC5rZXlzKHNlbGVjdG9yKS5sZW5ndGggPT09IDFcbjtcblxuTG9jYWxDb2xsZWN0aW9uLl91cGRhdGVJblJlc3VsdHNTeW5jID0gKHF1ZXJ5LCBkb2MsIG9sZF9kb2MpID0+IHtcbiAgaWYgKCFFSlNPTi5lcXVhbHMoZG9jLl9pZCwgb2xkX2RvYy5faWQpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IGNoYW5nZSBhIGRvY1xcJ3MgX2lkIHdoaWxlIHVwZGF0aW5nJyk7XG4gIH1cblxuICBjb25zdCBwcm9qZWN0aW9uRm4gPSBxdWVyeS5wcm9qZWN0aW9uRm47XG4gIGNvbnN0IGNoYW5nZWRGaWVsZHMgPSBEaWZmU2VxdWVuY2UubWFrZUNoYW5nZWRGaWVsZHMoXG4gICAgcHJvamVjdGlvbkZuKGRvYyksXG4gICAgcHJvamVjdGlvbkZuKG9sZF9kb2MpXG4gICk7XG5cbiAgaWYgKCFxdWVyeS5vcmRlcmVkKSB7XG4gICAgaWYgKE9iamVjdC5rZXlzKGNoYW5nZWRGaWVsZHMpLmxlbmd0aCkge1xuICAgICAgcXVlcnkuY2hhbmdlZChkb2MuX2lkLCBjaGFuZ2VkRmllbGRzKTtcbiAgICAgIHF1ZXJ5LnJlc3VsdHMuc2V0KGRvYy5faWQsIGRvYyk7XG4gICAgfVxuXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3Qgb2xkX2lkeCA9IExvY2FsQ29sbGVjdGlvbi5fZmluZEluT3JkZXJlZFJlc3VsdHMocXVlcnksIGRvYyk7XG5cbiAgaWYgKE9iamVjdC5rZXlzKGNoYW5nZWRGaWVsZHMpLmxlbmd0aCkge1xuICAgIHF1ZXJ5LmNoYW5nZWQoZG9jLl9pZCwgY2hhbmdlZEZpZWxkcyk7XG4gIH1cblxuICBpZiAoIXF1ZXJ5LnNvcnRlcikge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8vIGp1c3QgdGFrZSBpdCBvdXQgYW5kIHB1dCBpdCBiYWNrIGluIGFnYWluLCBhbmQgc2VlIGlmIHRoZSBpbmRleCBjaGFuZ2VzXG4gIHF1ZXJ5LnJlc3VsdHMuc3BsaWNlKG9sZF9pZHgsIDEpO1xuXG4gIGNvbnN0IG5ld19pZHggPSBMb2NhbENvbGxlY3Rpb24uX2luc2VydEluU29ydGVkTGlzdChcbiAgICBxdWVyeS5zb3J0ZXIuZ2V0Q29tcGFyYXRvcih7ZGlzdGFuY2VzOiBxdWVyeS5kaXN0YW5jZXN9KSxcbiAgICBxdWVyeS5yZXN1bHRzLFxuICAgIGRvY1xuICApO1xuXG4gIGlmIChvbGRfaWR4ICE9PSBuZXdfaWR4KSB7XG4gICAgbGV0IG5leHQgPSBxdWVyeS5yZXN1bHRzW25ld19pZHggKyAxXTtcbiAgICBpZiAobmV4dCkge1xuICAgICAgbmV4dCA9IG5leHQuX2lkO1xuICAgIH0gZWxzZSB7XG4gICAgICBuZXh0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBxdWVyeS5tb3ZlZEJlZm9yZSAmJiBxdWVyeS5tb3ZlZEJlZm9yZShkb2MuX2lkLCBuZXh0KTtcbiAgfVxufTtcblxuTG9jYWxDb2xsZWN0aW9uLl91cGRhdGVJblJlc3VsdHNBc3luYyA9IGFzeW5jIChxdWVyeSwgZG9jLCBvbGRfZG9jKSA9PiB7XG4gIGlmICghRUpTT04uZXF1YWxzKGRvYy5faWQsIG9sZF9kb2MuX2lkKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignQ2FuXFwndCBjaGFuZ2UgYSBkb2NcXCdzIF9pZCB3aGlsZSB1cGRhdGluZycpO1xuICB9XG5cbiAgY29uc3QgcHJvamVjdGlvbkZuID0gcXVlcnkucHJvamVjdGlvbkZuO1xuICBjb25zdCBjaGFuZ2VkRmllbGRzID0gRGlmZlNlcXVlbmNlLm1ha2VDaGFuZ2VkRmllbGRzKFxuICAgIHByb2plY3Rpb25Gbihkb2MpLFxuICAgIHByb2plY3Rpb25GbihvbGRfZG9jKVxuICApO1xuXG4gIGlmICghcXVlcnkub3JkZXJlZCkge1xuICAgIGlmIChPYmplY3Qua2V5cyhjaGFuZ2VkRmllbGRzKS5sZW5ndGgpIHtcbiAgICAgIGF3YWl0IHF1ZXJ5LmNoYW5nZWQoZG9jLl9pZCwgY2hhbmdlZEZpZWxkcyk7XG4gICAgICBxdWVyeS5yZXN1bHRzLnNldChkb2MuX2lkLCBkb2MpO1xuICAgIH1cblxuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IG9sZF9pZHggPSBMb2NhbENvbGxlY3Rpb24uX2ZpbmRJbk9yZGVyZWRSZXN1bHRzKHF1ZXJ5LCBkb2MpO1xuXG4gIGlmIChPYmplY3Qua2V5cyhjaGFuZ2VkRmllbGRzKS5sZW5ndGgpIHtcbiAgICBhd2FpdCBxdWVyeS5jaGFuZ2VkKGRvYy5faWQsIGNoYW5nZWRGaWVsZHMpO1xuICB9XG5cbiAgaWYgKCFxdWVyeS5zb3J0ZXIpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBqdXN0IHRha2UgaXQgb3V0IGFuZCBwdXQgaXQgYmFjayBpbiBhZ2FpbiwgYW5kIHNlZSBpZiB0aGUgaW5kZXggY2hhbmdlc1xuICBxdWVyeS5yZXN1bHRzLnNwbGljZShvbGRfaWR4LCAxKTtcblxuICBjb25zdCBuZXdfaWR4ID0gTG9jYWxDb2xsZWN0aW9uLl9pbnNlcnRJblNvcnRlZExpc3QoXG4gICAgcXVlcnkuc29ydGVyLmdldENvbXBhcmF0b3Ioe2Rpc3RhbmNlczogcXVlcnkuZGlzdGFuY2VzfSksXG4gICAgcXVlcnkucmVzdWx0cyxcbiAgICBkb2NcbiAgKTtcblxuICBpZiAob2xkX2lkeCAhPT0gbmV3X2lkeCkge1xuICAgIGxldCBuZXh0ID0gcXVlcnkucmVzdWx0c1tuZXdfaWR4ICsgMV07XG4gICAgaWYgKG5leHQpIHtcbiAgICAgIG5leHQgPSBuZXh0Ll9pZDtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dCA9IG51bGw7XG4gICAgfVxuXG4gICAgcXVlcnkubW92ZWRCZWZvcmUgJiYgYXdhaXQgcXVlcnkubW92ZWRCZWZvcmUoZG9jLl9pZCwgbmV4dCk7XG4gIH1cbn07XG5cbmNvbnN0IE1PRElGSUVSUyA9IHtcbiAgJGN1cnJlbnREYXRlKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBoYXNPd24uY2FsbChhcmcsICckdHlwZScpKSB7XG4gICAgICBpZiAoYXJnLiR0eXBlICE9PSAnZGF0ZScpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgJ01pbmltb25nbyBkb2VzIGN1cnJlbnRseSBvbmx5IHN1cHBvcnQgdGhlIGRhdGUgdHlwZSBpbiAnICtcbiAgICAgICAgICAnJGN1cnJlbnREYXRlIG1vZGlmaWVycycsXG4gICAgICAgICAge2ZpZWxkfVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoYXJnICE9PSB0cnVlKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignSW52YWxpZCAkY3VycmVudERhdGUgbW9kaWZpZXInLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICB0YXJnZXRbZmllbGRdID0gbmV3IERhdGUoKTtcbiAgfSxcbiAgJGluYyh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodHlwZW9mIGFyZyAhPT0gJ251bWJlcicpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdNb2RpZmllciAkaW5jIGFsbG93ZWQgZm9yIG51bWJlcnMgb25seScsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmIChmaWVsZCBpbiB0YXJnZXQpIHtcbiAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2ZpZWxkXSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgJ0Nhbm5vdCBhcHBseSAkaW5jIG1vZGlmaWVyIHRvIG5vbi1udW1iZXInLFxuICAgICAgICAgIHtmaWVsZH1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgdGFyZ2V0W2ZpZWxkXSArPSBhcmc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldFtmaWVsZF0gPSBhcmc7XG4gICAgfVxuICB9LFxuICAkbWluKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0eXBlb2YgYXJnICE9PSAnbnVtYmVyJykge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ01vZGlmaWVyICRtaW4gYWxsb3dlZCBmb3IgbnVtYmVycyBvbmx5Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKGZpZWxkIGluIHRhcmdldCkge1xuICAgICAgaWYgKHR5cGVvZiB0YXJnZXRbZmllbGRdICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgICAnQ2Fubm90IGFwcGx5ICRtaW4gbW9kaWZpZXIgdG8gbm9uLW51bWJlcicsXG4gICAgICAgICAge2ZpZWxkfVxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAodGFyZ2V0W2ZpZWxkXSA+IGFyZykge1xuICAgICAgICB0YXJnZXRbZmllbGRdID0gYXJnO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRbZmllbGRdID0gYXJnO1xuICAgIH1cbiAgfSxcbiAgJG1heCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAodHlwZW9mIGFyZyAhPT0gJ251bWJlcicpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdNb2RpZmllciAkbWF4IGFsbG93ZWQgZm9yIG51bWJlcnMgb25seScsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmIChmaWVsZCBpbiB0YXJnZXQpIHtcbiAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2ZpZWxkXSAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgJ0Nhbm5vdCBhcHBseSAkbWF4IG1vZGlmaWVyIHRvIG5vbi1udW1iZXInLFxuICAgICAgICAgIHtmaWVsZH1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRhcmdldFtmaWVsZF0gPCBhcmcpIHtcbiAgICAgICAgdGFyZ2V0W2ZpZWxkXSA9IGFyZztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0W2ZpZWxkXSA9IGFyZztcbiAgICB9XG4gIH0sXG4gICRtdWwodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHR5cGVvZiBhcmcgIT09ICdudW1iZXInKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignTW9kaWZpZXIgJG11bCBhbGxvd2VkIGZvciBudW1iZXJzIG9ubHknLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAoZmllbGQgaW4gdGFyZ2V0KSB7XG4gICAgICBpZiAodHlwZW9mIHRhcmdldFtmaWVsZF0gIT09ICdudW1iZXInKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgICdDYW5ub3QgYXBwbHkgJG11bCBtb2RpZmllciB0byBub24tbnVtYmVyJyxcbiAgICAgICAgICB7ZmllbGR9XG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHRhcmdldFtmaWVsZF0gKj0gYXJnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRbZmllbGRdID0gMDtcbiAgICB9XG4gIH0sXG4gICRyZW5hbWUodGFyZ2V0LCBmaWVsZCwgYXJnLCBrZXlwYXRoLCBkb2MpIHtcbiAgICAvLyBubyBpZGVhIHdoeSBtb25nbyBoYXMgdGhpcyByZXN0cmljdGlvbi4uXG4gICAgaWYgKGtleXBhdGggPT09IGFyZykge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRyZW5hbWUgc291cmNlIG11c3QgZGlmZmVyIGZyb20gdGFyZ2V0Jywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKHRhcmdldCA9PT0gbnVsbCkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRyZW5hbWUgc291cmNlIGZpZWxkIGludmFsaWQnLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGFyZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCckcmVuYW1lIHRhcmdldCBtdXN0IGJlIGEgc3RyaW5nJywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgaWYgKGFyZy5pbmNsdWRlcygnXFwwJykpIHtcbiAgICAgIC8vIE51bGwgYnl0ZXMgYXJlIG5vdCBhbGxvd2VkIGluIE1vbmdvIGZpZWxkIG5hbWVzXG4gICAgICAvLyBodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9saW1pdHMvI1Jlc3RyaWN0aW9ucy1vbi1GaWVsZC1OYW1lc1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdUaGUgXFwndG9cXCcgZmllbGQgZm9yICRyZW5hbWUgY2Fubm90IGNvbnRhaW4gYW4gZW1iZWRkZWQgbnVsbCBieXRlJyxcbiAgICAgICAge2ZpZWxkfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBvYmplY3QgPSB0YXJnZXRbZmllbGRdO1xuXG4gICAgZGVsZXRlIHRhcmdldFtmaWVsZF07XG5cbiAgICBjb25zdCBrZXlwYXJ0cyA9IGFyZy5zcGxpdCgnLicpO1xuICAgIGNvbnN0IHRhcmdldDIgPSBmaW5kTW9kVGFyZ2V0KGRvYywga2V5cGFydHMsIHtmb3JiaWRBcnJheTogdHJ1ZX0pO1xuXG4gICAgaWYgKHRhcmdldDIgPT09IG51bGwpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCckcmVuYW1lIHRhcmdldCBmaWVsZCBpbnZhbGlkJywge2ZpZWxkfSk7XG4gICAgfVxuXG4gICAgdGFyZ2V0MltrZXlwYXJ0cy5wb3AoKV0gPSBvYmplY3Q7XG4gIH0sXG4gICRzZXQodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHRhcmdldCAhPT0gT2JqZWN0KHRhcmdldCkpIHsgLy8gbm90IGFuIGFycmF5IG9yIGFuIG9iamVjdFxuICAgICAgY29uc3QgZXJyb3IgPSBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ0Nhbm5vdCBzZXQgcHJvcGVydHkgb24gbm9uLW9iamVjdCBmaWVsZCcsXG4gICAgICAgIHtmaWVsZH1cbiAgICAgICk7XG4gICAgICBlcnJvci5zZXRQcm9wZXJ0eUVycm9yID0gdHJ1ZTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cblxuICAgIGlmICh0YXJnZXQgPT09IG51bGwpIHtcbiAgICAgIGNvbnN0IGVycm9yID0gTWluaW1vbmdvRXJyb3IoJ0Nhbm5vdCBzZXQgcHJvcGVydHkgb24gbnVsbCcsIHtmaWVsZH0pO1xuICAgICAgZXJyb3Iuc2V0UHJvcGVydHlFcnJvciA9IHRydWU7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG5cbiAgICBhc3NlcnRIYXNWYWxpZEZpZWxkTmFtZXMoYXJnKTtcblxuICAgIHRhcmdldFtmaWVsZF0gPSBhcmc7XG4gIH0sXG4gICRzZXRPbkluc2VydCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICAvLyBjb252ZXJ0ZWQgdG8gYCRzZXRgIGluIGBfbW9kaWZ5YFxuICB9LFxuICAkdW5zZXQodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgaWYgKHRhcmdldCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgaWYgKGZpZWxkIGluIHRhcmdldCkge1xuICAgICAgICAgIHRhcmdldFtmaWVsZF0gPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWxldGUgdGFyZ2V0W2ZpZWxkXTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gICRwdXNoKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0YXJnZXRbZmllbGRdID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRhcmdldFtmaWVsZF0gPSBbXTtcbiAgICB9XG5cbiAgICBpZiAoISh0YXJnZXRbZmllbGRdIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignQ2Fubm90IGFwcGx5ICRwdXNoIG1vZGlmaWVyIHRvIG5vbi1hcnJheScsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGlmICghKGFyZyAmJiBhcmcuJGVhY2gpKSB7XG4gICAgICAvLyBTaW1wbGUgbW9kZTogbm90ICRlYWNoXG4gICAgICBhc3NlcnRIYXNWYWxpZEZpZWxkTmFtZXMoYXJnKTtcblxuICAgICAgdGFyZ2V0W2ZpZWxkXS5wdXNoKGFyZyk7XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBGYW5jeSBtb2RlOiAkZWFjaCAoYW5kIG1heWJlICRzbGljZSBhbmQgJHNvcnQgYW5kICRwb3NpdGlvbilcbiAgICBjb25zdCB0b1B1c2ggPSBhcmcuJGVhY2g7XG4gICAgaWYgKCEodG9QdXNoIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJGVhY2ggbXVzdCBiZSBhbiBhcnJheScsIHtmaWVsZH0pO1xuICAgIH1cblxuICAgIGFzc2VydEhhc1ZhbGlkRmllbGROYW1lcyh0b1B1c2gpO1xuXG4gICAgLy8gUGFyc2UgJHBvc2l0aW9uXG4gICAgbGV0IHBvc2l0aW9uID0gdW5kZWZpbmVkO1xuICAgIGlmICgnJHBvc2l0aW9uJyBpbiBhcmcpIHtcbiAgICAgIGlmICh0eXBlb2YgYXJnLiRwb3NpdGlvbiAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRwb3NpdGlvbiBtdXN0IGJlIGEgbnVtZXJpYyB2YWx1ZScsIHtmaWVsZH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBYWFggc2hvdWxkIGNoZWNrIHRvIG1ha2Ugc3VyZSBpbnRlZ2VyXG4gICAgICBpZiAoYXJnLiRwb3NpdGlvbiA8IDApIHtcbiAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgJyRwb3NpdGlvbiBpbiAkcHVzaCBtdXN0IGJlIHplcm8gb3IgcG9zaXRpdmUnLFxuICAgICAgICAgIHtmaWVsZH1cbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgcG9zaXRpb24gPSBhcmcuJHBvc2l0aW9uO1xuICAgIH1cblxuICAgIC8vIFBhcnNlICRzbGljZS5cbiAgICBsZXQgc2xpY2UgPSB1bmRlZmluZWQ7XG4gICAgaWYgKCckc2xpY2UnIGluIGFyZykge1xuICAgICAgaWYgKHR5cGVvZiBhcmcuJHNsaWNlICE9PSAnbnVtYmVyJykge1xuICAgICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcignJHNsaWNlIG11c3QgYmUgYSBudW1lcmljIHZhbHVlJywge2ZpZWxkfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCBzaG91bGQgY2hlY2sgdG8gbWFrZSBzdXJlIGludGVnZXJcbiAgICAgIHNsaWNlID0gYXJnLiRzbGljZTtcbiAgICB9XG5cbiAgICAvLyBQYXJzZSAkc29ydC5cbiAgICBsZXQgc29ydEZ1bmN0aW9uID0gdW5kZWZpbmVkO1xuICAgIGlmIChhcmcuJHNvcnQpIHtcbiAgICAgIGlmIChzbGljZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCckc29ydCByZXF1aXJlcyAkc2xpY2UgdG8gYmUgcHJlc2VudCcsIHtmaWVsZH0pO1xuICAgICAgfVxuXG4gICAgICAvLyBYWFggdGhpcyBhbGxvd3MgdXMgdG8gdXNlIGEgJHNvcnQgd2hvc2UgdmFsdWUgaXMgYW4gYXJyYXksIGJ1dCB0aGF0J3NcbiAgICAgIC8vIGFjdHVhbGx5IGFuIGV4dGVuc2lvbiBvZiB0aGUgTm9kZSBkcml2ZXIsIHNvIGl0IHdvbid0IHdvcmtcbiAgICAgIC8vIHNlcnZlci1zaWRlLiBDb3VsZCBiZSBjb25mdXNpbmchXG4gICAgICAvLyBYWFggaXMgaXQgY29ycmVjdCB0aGF0IHdlIGRvbid0IGRvIGdlby1zdHVmZiBoZXJlP1xuICAgICAgc29ydEZ1bmN0aW9uID0gbmV3IE1pbmltb25nby5Tb3J0ZXIoYXJnLiRzb3J0KS5nZXRDb21wYXJhdG9yKCk7XG5cbiAgICAgIHRvUHVzaC5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgICAgICBpZiAoTG9jYWxDb2xsZWN0aW9uLl9mLl90eXBlKGVsZW1lbnQpICE9PSAzKSB7XG4gICAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgICAnJHB1c2ggbGlrZSBtb2RpZmllcnMgdXNpbmcgJHNvcnQgcmVxdWlyZSBhbGwgZWxlbWVudHMgdG8gYmUgJyArXG4gICAgICAgICAgICAnb2JqZWN0cycsXG4gICAgICAgICAgICB7ZmllbGR9XG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQWN0dWFsbHkgcHVzaC5cbiAgICBpZiAocG9zaXRpb24gPT09IHVuZGVmaW5lZCkge1xuICAgICAgdG9QdXNoLmZvckVhY2goZWxlbWVudCA9PiB7XG4gICAgICAgIHRhcmdldFtmaWVsZF0ucHVzaChlbGVtZW50KTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBzcGxpY2VBcmd1bWVudHMgPSBbcG9zaXRpb24sIDBdO1xuXG4gICAgICB0b1B1c2guZm9yRWFjaChlbGVtZW50ID0+IHtcbiAgICAgICAgc3BsaWNlQXJndW1lbnRzLnB1c2goZWxlbWVudCk7XG4gICAgICB9KTtcblxuICAgICAgdGFyZ2V0W2ZpZWxkXS5zcGxpY2UoLi4uc3BsaWNlQXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICAvLyBBY3R1YWxseSBzb3J0LlxuICAgIGlmIChzb3J0RnVuY3Rpb24pIHtcbiAgICAgIHRhcmdldFtmaWVsZF0uc29ydChzb3J0RnVuY3Rpb24pO1xuICAgIH1cblxuICAgIC8vIEFjdHVhbGx5IHNsaWNlLlxuICAgIGlmIChzbGljZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoc2xpY2UgPT09IDApIHtcbiAgICAgICAgdGFyZ2V0W2ZpZWxkXSA9IFtdOyAvLyBkaWZmZXJzIGZyb20gQXJyYXkuc2xpY2UhXG4gICAgICB9IGVsc2UgaWYgKHNsaWNlIDwgMCkge1xuICAgICAgICB0YXJnZXRbZmllbGRdID0gdGFyZ2V0W2ZpZWxkXS5zbGljZShzbGljZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0YXJnZXRbZmllbGRdID0gdGFyZ2V0W2ZpZWxkXS5zbGljZSgwLCBzbGljZSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuICAkcHVzaEFsbCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAoISh0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdNb2RpZmllciAkcHVzaEFsbC9wdWxsQWxsIGFsbG93ZWQgZm9yIGFycmF5cyBvbmx5Jyk7XG4gICAgfVxuXG4gICAgYXNzZXJ0SGFzVmFsaWRGaWVsZE5hbWVzKGFyZyk7XG5cbiAgICBjb25zdCB0b1B1c2ggPSB0YXJnZXRbZmllbGRdO1xuXG4gICAgaWYgKHRvUHVzaCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0YXJnZXRbZmllbGRdID0gYXJnO1xuICAgIH0gZWxzZSBpZiAoISh0b1B1c2ggaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnQ2Fubm90IGFwcGx5ICRwdXNoQWxsIG1vZGlmaWVyIHRvIG5vbi1hcnJheScsXG4gICAgICAgIHtmaWVsZH1cbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRvUHVzaC5wdXNoKC4uLmFyZyk7XG4gICAgfVxuICB9LFxuICAkYWRkVG9TZXQodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgbGV0IGlzRWFjaCA9IGZhbHNlO1xuXG4gICAgaWYgKHR5cGVvZiBhcmcgPT09ICdvYmplY3QnKSB7XG4gICAgICAvLyBjaGVjayBpZiBmaXJzdCBrZXkgaXMgJyRlYWNoJ1xuICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGFyZyk7XG4gICAgICBpZiAoa2V5c1swXSA9PT0gJyRlYWNoJykge1xuICAgICAgICBpc0VhY2ggPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHZhbHVlcyA9IGlzRWFjaCA/IGFyZy4kZWFjaCA6IFthcmddO1xuXG4gICAgYXNzZXJ0SGFzVmFsaWRGaWVsZE5hbWVzKHZhbHVlcyk7XG5cbiAgICBjb25zdCB0b0FkZCA9IHRhcmdldFtmaWVsZF07XG4gICAgaWYgKHRvQWRkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRhcmdldFtmaWVsZF0gPSB2YWx1ZXM7XG4gICAgfSBlbHNlIGlmICghKHRvQWRkIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ0Nhbm5vdCBhcHBseSAkYWRkVG9TZXQgbW9kaWZpZXIgdG8gbm9uLWFycmF5JyxcbiAgICAgICAge2ZpZWxkfVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWVzLmZvckVhY2godmFsdWUgPT4ge1xuICAgICAgICBpZiAodG9BZGQuc29tZShlbGVtZW50ID0+IExvY2FsQ29sbGVjdGlvbi5fZi5fZXF1YWwodmFsdWUsIGVsZW1lbnQpKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRvQWRkLnB1c2godmFsdWUpO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuICAkcG9wKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0YXJnZXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRvUG9wID0gdGFyZ2V0W2ZpZWxkXTtcblxuICAgIGlmICh0b1BvcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCEodG9Qb3AgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKCdDYW5ub3QgYXBwbHkgJHBvcCBtb2RpZmllciB0byBub24tYXJyYXknLCB7ZmllbGR9KTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicgJiYgYXJnIDwgMCkge1xuICAgICAgdG9Qb3Auc3BsaWNlKDAsIDEpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0b1BvcC5wb3AoKTtcbiAgICB9XG4gIH0sXG4gICRwdWxsKHRhcmdldCwgZmllbGQsIGFyZykge1xuICAgIGlmICh0YXJnZXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRvUHVsbCA9IHRhcmdldFtmaWVsZF07XG4gICAgaWYgKHRvUHVsbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKCEodG9QdWxsIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgJ0Nhbm5vdCBhcHBseSAkcHVsbC9wdWxsQWxsIG1vZGlmaWVyIHRvIG5vbi1hcnJheScsXG4gICAgICAgIHtmaWVsZH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgbGV0IG91dDtcbiAgICBpZiAoYXJnICE9IG51bGwgJiYgdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgIShhcmcgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIC8vIFhYWCB3b3VsZCBiZSBtdWNoIG5pY2VyIHRvIGNvbXBpbGUgdGhpcyBvbmNlLCByYXRoZXIgdGhhblxuICAgICAgLy8gZm9yIGVhY2ggZG9jdW1lbnQgd2UgbW9kaWZ5Li4gYnV0IHVzdWFsbHkgd2UncmUgbm90XG4gICAgICAvLyBtb2RpZnlpbmcgdGhhdCBtYW55IGRvY3VtZW50cywgc28gd2UnbGwgbGV0IGl0IHNsaWRlIGZvclxuICAgICAgLy8gbm93XG5cbiAgICAgIC8vIFhYWCBNaW5pbW9uZ28uTWF0Y2hlciBpc24ndCB1cCBmb3IgdGhlIGpvYiwgYmVjYXVzZSB3ZSBuZWVkXG4gICAgICAvLyB0byBwZXJtaXQgc3R1ZmYgbGlrZSB7JHB1bGw6IHthOiB7JGd0OiA0fX19Li4gc29tZXRoaW5nXG4gICAgICAvLyBsaWtlIHskZ3Q6IDR9IGlzIG5vdCBub3JtYWxseSBhIGNvbXBsZXRlIHNlbGVjdG9yLlxuICAgICAgLy8gc2FtZSBpc3N1ZSBhcyAkZWxlbU1hdGNoIHBvc3NpYmx5P1xuICAgICAgY29uc3QgbWF0Y2hlciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcihhcmcpO1xuXG4gICAgICBvdXQgPSB0b1B1bGwuZmlsdGVyKGVsZW1lbnQgPT4gIW1hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKGVsZW1lbnQpLnJlc3VsdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG91dCA9IHRvUHVsbC5maWx0ZXIoZWxlbWVudCA9PiAhTG9jYWxDb2xsZWN0aW9uLl9mLl9lcXVhbChlbGVtZW50LCBhcmcpKTtcbiAgICB9XG5cbiAgICB0YXJnZXRbZmllbGRdID0gb3V0O1xuICB9LFxuICAkcHVsbEFsbCh0YXJnZXQsIGZpZWxkLCBhcmcpIHtcbiAgICBpZiAoISh0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgaW5zdGFuY2VvZiBBcnJheSkpIHtcbiAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAnTW9kaWZpZXIgJHB1c2hBbGwvcHVsbEFsbCBhbGxvd2VkIGZvciBhcnJheXMgb25seScsXG4gICAgICAgIHtmaWVsZH1cbiAgICAgICk7XG4gICAgfVxuXG4gICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdG9QdWxsID0gdGFyZ2V0W2ZpZWxkXTtcblxuICAgIGlmICh0b1B1bGwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghKHRvUHVsbCBpbnN0YW5jZW9mIEFycmF5KSkge1xuICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICdDYW5ub3QgYXBwbHkgJHB1bGwvcHVsbEFsbCBtb2RpZmllciB0byBub24tYXJyYXknLFxuICAgICAgICB7ZmllbGR9XG4gICAgICApO1xuICAgIH1cblxuICAgIHRhcmdldFtmaWVsZF0gPSB0b1B1bGwuZmlsdGVyKG9iamVjdCA9PlxuICAgICAgIWFyZy5zb21lKGVsZW1lbnQgPT4gTG9jYWxDb2xsZWN0aW9uLl9mLl9lcXVhbChvYmplY3QsIGVsZW1lbnQpKVxuICAgICk7XG4gIH0sXG4gICRiaXQodGFyZ2V0LCBmaWVsZCwgYXJnKSB7XG4gICAgLy8gWFhYIG1vbmdvIG9ubHkgc3VwcG9ydHMgJGJpdCBvbiBpbnRlZ2VycywgYW5kIHdlIG9ubHkgc3VwcG9ydFxuICAgIC8vIG5hdGl2ZSBqYXZhc2NyaXB0IG51bWJlcnMgKGRvdWJsZXMpIHNvIGZhciwgc28gd2UgY2FuJ3Qgc3VwcG9ydCAkYml0XG4gICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJyRiaXQgaXMgbm90IHN1cHBvcnRlZCcsIHtmaWVsZH0pO1xuICB9LFxuICAkdigpIHtcbiAgICAvLyBBcyBkaXNjdXNzZWQgaW4gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzk2MjMsXG4gICAgLy8gdGhlIGAkdmAgb3BlcmF0b3IgaXMgbm90IG5lZWRlZCBieSBNZXRlb3IsIGJ1dCBwcm9ibGVtcyBjYW4gb2NjdXIgaWZcbiAgICAvLyBpdCdzIG5vdCBhdCBsZWFzdCBjYWxsYWJsZSAoYXMgb2YgTW9uZ28gPj0gMy42KS4gSXQncyBkZWZpbmVkIGhlcmUgYXNcbiAgICAvLyBhIG5vLW9wIHRvIHdvcmsgYXJvdW5kIHRoZXNlIHByb2JsZW1zLlxuICB9XG59O1xuXG5jb25zdCBOT19DUkVBVEVfTU9ESUZJRVJTID0ge1xuICAkcG9wOiB0cnVlLFxuICAkcHVsbDogdHJ1ZSxcbiAgJHB1bGxBbGw6IHRydWUsXG4gICRyZW5hbWU6IHRydWUsXG4gICR1bnNldDogdHJ1ZVxufTtcblxuLy8gTWFrZSBzdXJlIGZpZWxkIG5hbWVzIGRvIG5vdCBjb250YWluIE1vbmdvIHJlc3RyaWN0ZWRcbi8vIGNoYXJhY3RlcnMgKCcuJywgJyQnLCAnXFwwJykuXG4vLyBodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9saW1pdHMvI1Jlc3RyaWN0aW9ucy1vbi1GaWVsZC1OYW1lc1xuY29uc3QgaW52YWxpZENoYXJNc2cgPSB7XG4gICQ6ICdzdGFydCB3aXRoIFxcJyRcXCcnLFxuICAnLic6ICdjb250YWluIFxcJy5cXCcnLFxuICAnXFwwJzogJ2NvbnRhaW4gbnVsbCBieXRlcydcbn07XG5cbi8vIGNoZWNrcyBpZiBhbGwgZmllbGQgbmFtZXMgaW4gYW4gb2JqZWN0IGFyZSB2YWxpZFxuZnVuY3Rpb24gYXNzZXJ0SGFzVmFsaWRGaWVsZE5hbWVzKGRvYykge1xuICBpZiAoZG9jICYmIHR5cGVvZiBkb2MgPT09ICdvYmplY3QnKSB7XG4gICAgSlNPTi5zdHJpbmdpZnkoZG9jLCAoa2V5LCB2YWx1ZSkgPT4ge1xuICAgICAgYXNzZXJ0SXNWYWxpZEZpZWxkTmFtZShrZXkpO1xuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFzc2VydElzVmFsaWRGaWVsZE5hbWUoa2V5KSB7XG4gIGxldCBtYXRjaDtcbiAgaWYgKHR5cGVvZiBrZXkgPT09ICdzdHJpbmcnICYmIChtYXRjaCA9IGtleS5tYXRjaCgvXlxcJHxcXC58XFwwLykpKSB7XG4gICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoYEtleSAke2tleX0gbXVzdCBub3QgJHtpbnZhbGlkQ2hhck1zZ1ttYXRjaFswXV19YCk7XG4gIH1cbn1cblxuLy8gZm9yIGEuYi5jLjIuZC5lLCBrZXlwYXJ0cyBzaG91bGQgYmUgWydhJywgJ2InLCAnYycsICcyJywgJ2QnLCAnZSddLFxuLy8gYW5kIHRoZW4geW91IHdvdWxkIG9wZXJhdGUgb24gdGhlICdlJyBwcm9wZXJ0eSBvZiB0aGUgcmV0dXJuZWRcbi8vIG9iamVjdC5cbi8vXG4vLyBpZiBvcHRpb25zLm5vQ3JlYXRlIGlzIGZhbHNleSwgY3JlYXRlcyBpbnRlcm1lZGlhdGUgbGV2ZWxzIG9mXG4vLyBzdHJ1Y3R1cmUgYXMgbmVjZXNzYXJ5LCBsaWtlIG1rZGlyIC1wIChhbmQgcmFpc2VzIGFuIGV4Y2VwdGlvbiBpZlxuLy8gdGhhdCB3b3VsZCBtZWFuIGdpdmluZyBhIG5vbi1udW1lcmljIHByb3BlcnR5IHRvIGFuIGFycmF5LikgaWZcbi8vIG9wdGlvbnMubm9DcmVhdGUgaXMgdHJ1ZSwgcmV0dXJuIHVuZGVmaW5lZCBpbnN0ZWFkLlxuLy9cbi8vIG1heSBtb2RpZnkgdGhlIGxhc3QgZWxlbWVudCBvZiBrZXlwYXJ0cyB0byBzaWduYWwgdG8gdGhlIGNhbGxlciB0aGF0IGl0IG5lZWRzXG4vLyB0byB1c2UgYSBkaWZmZXJlbnQgdmFsdWUgdG8gaW5kZXggaW50byB0aGUgcmV0dXJuZWQgb2JqZWN0IChmb3IgZXhhbXBsZSxcbi8vIFsnYScsICcwMSddIC0+IFsnYScsIDFdKS5cbi8vXG4vLyBpZiBmb3JiaWRBcnJheSBpcyB0cnVlLCByZXR1cm4gbnVsbCBpZiB0aGUga2V5cGF0aCBnb2VzIHRocm91Z2ggYW4gYXJyYXkuXG4vL1xuLy8gaWYgb3B0aW9ucy5hcnJheUluZGljZXMgaXMgc2V0LCB1c2UgaXRzIGZpcnN0IGVsZW1lbnQgZm9yIHRoZSAoZmlyc3QpICckJyBpblxuLy8gdGhlIHBhdGguXG5mdW5jdGlvbiBmaW5kTW9kVGFyZ2V0KGRvYywga2V5cGFydHMsIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgdXNlZEFycmF5SW5kZXggPSBmYWxzZTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgbGFzdCA9IGkgPT09IGtleXBhcnRzLmxlbmd0aCAtIDE7XG4gICAgbGV0IGtleXBhcnQgPSBrZXlwYXJ0c1tpXTtcblxuICAgIGlmICghaXNJbmRleGFibGUoZG9jKSkge1xuICAgICAgaWYgKG9wdGlvbnMubm9DcmVhdGUpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZXJyb3IgPSBNaW5pbW9uZ29FcnJvcihcbiAgICAgICAgYGNhbm5vdCB1c2UgdGhlIHBhcnQgJyR7a2V5cGFydH0nIHRvIHRyYXZlcnNlICR7ZG9jfWBcbiAgICAgICk7XG4gICAgICBlcnJvci5zZXRQcm9wZXJ0eUVycm9yID0gdHJ1ZTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cblxuICAgIGlmIChkb2MgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgaWYgKG9wdGlvbnMuZm9yYmlkQXJyYXkpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGlmIChrZXlwYXJ0ID09PSAnJCcpIHtcbiAgICAgICAgaWYgKHVzZWRBcnJheUluZGV4KSB7XG4gICAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoJ1RvbyBtYW55IHBvc2l0aW9uYWwgKGkuZS4gXFwnJFxcJykgZWxlbWVudHMnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghb3B0aW9ucy5hcnJheUluZGljZXMgfHwgIW9wdGlvbnMuYXJyYXlJbmRpY2VzLmxlbmd0aCkge1xuICAgICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgICAgJ1RoZSBwb3NpdGlvbmFsIG9wZXJhdG9yIGRpZCBub3QgZmluZCB0aGUgbWF0Y2ggbmVlZGVkIGZyb20gdGhlICcgK1xuICAgICAgICAgICAgJ3F1ZXJ5J1xuICAgICAgICAgICk7XG4gICAgICAgIH1cblxuICAgICAgICBrZXlwYXJ0ID0gb3B0aW9ucy5hcnJheUluZGljZXNbMF07XG4gICAgICAgIHVzZWRBcnJheUluZGV4ID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSBpZiAoaXNOdW1lcmljS2V5KGtleXBhcnQpKSB7XG4gICAgICAgIGtleXBhcnQgPSBwYXJzZUludChrZXlwYXJ0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChvcHRpb25zLm5vQ3JlYXRlKSB7XG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRocm93IE1pbmltb25nb0Vycm9yKFxuICAgICAgICAgIGBjYW4ndCBhcHBlbmQgdG8gYXJyYXkgdXNpbmcgc3RyaW5nIGZpZWxkIG5hbWUgWyR7a2V5cGFydH1dYFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAobGFzdCkge1xuICAgICAgICBrZXlwYXJ0c1tpXSA9IGtleXBhcnQ7IC8vIGhhbmRsZSAnYS4wMSdcbiAgICAgIH1cblxuICAgICAgaWYgKG9wdGlvbnMubm9DcmVhdGUgJiYga2V5cGFydCA+PSBkb2MubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG5cbiAgICAgIHdoaWxlIChkb2MubGVuZ3RoIDwga2V5cGFydCkge1xuICAgICAgICBkb2MucHVzaChudWxsKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFsYXN0KSB7XG4gICAgICAgIGlmIChkb2MubGVuZ3RoID09PSBrZXlwYXJ0KSB7XG4gICAgICAgICAgZG9jLnB1c2goe30pO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBkb2Nba2V5cGFydF0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgdGhyb3cgTWluaW1vbmdvRXJyb3IoXG4gICAgICAgICAgICBgY2FuJ3QgbW9kaWZ5IGZpZWxkICcke2tleXBhcnRzW2kgKyAxXX0nIG9mIGxpc3QgdmFsdWUgYCArXG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeShkb2Nba2V5cGFydF0pXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBhc3NlcnRJc1ZhbGlkRmllbGROYW1lKGtleXBhcnQpO1xuXG4gICAgICBpZiAoIShrZXlwYXJ0IGluIGRvYykpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMubm9DcmVhdGUpIHtcbiAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFsYXN0KSB7XG4gICAgICAgICAgZG9jW2tleXBhcnRdID0ge307XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobGFzdCkge1xuICAgICAgcmV0dXJuIGRvYztcbiAgICB9XG5cbiAgICBkb2MgPSBkb2Nba2V5cGFydF07XG4gIH1cblxuICAvLyBub3RyZWFjaGVkXG59XG5cbiIsImltcG9ydCBMb2NhbENvbGxlY3Rpb24gZnJvbSAnLi9sb2NhbF9jb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7XG4gIGNvbXBpbGVEb2N1bWVudFNlbGVjdG9yLFxuICBoYXNPd24sXG4gIG5vdGhpbmdNYXRjaGVyLFxufSBmcm9tICcuL2NvbW1vbi5qcyc7XG5cbmNvbnN0IERlY2ltYWwgPSBQYWNrYWdlWydtb25nby1kZWNpbWFsJ10/LkRlY2ltYWwgfHwgY2xhc3MgRGVjaW1hbFN0dWIge31cblxuLy8gVGhlIG1pbmltb25nbyBzZWxlY3RvciBjb21waWxlciFcblxuLy8gVGVybWlub2xvZ3k6XG4vLyAgLSBhICdzZWxlY3RvcicgaXMgdGhlIEVKU09OIG9iamVjdCByZXByZXNlbnRpbmcgYSBzZWxlY3RvclxuLy8gIC0gYSAnbWF0Y2hlcicgaXMgaXRzIGNvbXBpbGVkIGZvcm0gKHdoZXRoZXIgYSBmdWxsIE1pbmltb25nby5NYXRjaGVyXG4vLyAgICBvYmplY3Qgb3Igb25lIG9mIHRoZSBjb21wb25lbnQgbGFtYmRhcyB0aGF0IG1hdGNoZXMgcGFydHMgb2YgaXQpXG4vLyAgLSBhICdyZXN1bHQgb2JqZWN0JyBpcyBhbiBvYmplY3Qgd2l0aCBhICdyZXN1bHQnIGZpZWxkIGFuZCBtYXliZVxuLy8gICAgZGlzdGFuY2UgYW5kIGFycmF5SW5kaWNlcy5cbi8vICAtIGEgJ2JyYW5jaGVkIHZhbHVlJyBpcyBhbiBvYmplY3Qgd2l0aCBhICd2YWx1ZScgZmllbGQgYW5kIG1heWJlXG4vLyAgICAnZG9udEl0ZXJhdGUnIGFuZCAnYXJyYXlJbmRpY2VzJy5cbi8vICAtIGEgJ2RvY3VtZW50JyBpcyBhIHRvcC1sZXZlbCBvYmplY3QgdGhhdCBjYW4gYmUgc3RvcmVkIGluIGEgY29sbGVjdGlvbi5cbi8vICAtIGEgJ2xvb2t1cCBmdW5jdGlvbicgaXMgYSBmdW5jdGlvbiB0aGF0IHRha2VzIGluIGEgZG9jdW1lbnQgYW5kIHJldHVybnNcbi8vICAgIGFuIGFycmF5IG9mICdicmFuY2hlZCB2YWx1ZXMnLlxuLy8gIC0gYSAnYnJhbmNoZWQgbWF0Y2hlcicgbWFwcyBmcm9tIGFuIGFycmF5IG9mIGJyYW5jaGVkIHZhbHVlcyB0byBhIHJlc3VsdFxuLy8gICAgb2JqZWN0LlxuLy8gIC0gYW4gJ2VsZW1lbnQgbWF0Y2hlcicgbWFwcyBmcm9tIGEgc2luZ2xlIHZhbHVlIHRvIGEgYm9vbC5cblxuLy8gTWFpbiBlbnRyeSBwb2ludC5cbi8vICAgdmFyIG1hdGNoZXIgPSBuZXcgTWluaW1vbmdvLk1hdGNoZXIoe2E6IHskZ3Q6IDV9fSk7XG4vLyAgIGlmIChtYXRjaGVyLmRvY3VtZW50TWF0Y2hlcyh7YTogN30pKSAuLi5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIE1hdGNoZXIge1xuICBjb25zdHJ1Y3RvcihzZWxlY3RvciwgaXNVcGRhdGUpIHtcbiAgICAvLyBBIHNldCAob2JqZWN0IG1hcHBpbmcgc3RyaW5nIC0+ICopIG9mIGFsbCBvZiB0aGUgZG9jdW1lbnQgcGF0aHMgbG9va2VkXG4gICAgLy8gYXQgYnkgdGhlIHNlbGVjdG9yLiBBbHNvIGluY2x1ZGVzIHRoZSBlbXB0eSBzdHJpbmcgaWYgaXQgbWF5IGxvb2sgYXQgYW55XG4gICAgLy8gcGF0aCAoZWcsICR3aGVyZSkuXG4gICAgdGhpcy5fcGF0aHMgPSB7fTtcbiAgICAvLyBTZXQgdG8gdHJ1ZSBpZiBjb21waWxhdGlvbiBmaW5kcyBhICRuZWFyLlxuICAgIHRoaXMuX2hhc0dlb1F1ZXJ5ID0gZmFsc2U7XG4gICAgLy8gU2V0IHRvIHRydWUgaWYgY29tcGlsYXRpb24gZmluZHMgYSAkd2hlcmUuXG4gICAgdGhpcy5faGFzV2hlcmUgPSBmYWxzZTtcbiAgICAvLyBTZXQgdG8gZmFsc2UgaWYgY29tcGlsYXRpb24gZmluZHMgYW55dGhpbmcgb3RoZXIgdGhhbiBhIHNpbXBsZSBlcXVhbGl0eVxuICAgIC8vIG9yIG9uZSBvciBtb3JlIG9mICckZ3QnLCAnJGd0ZScsICckbHQnLCAnJGx0ZScsICckbmUnLCAnJGluJywgJyRuaW4nIHVzZWRcbiAgICAvLyB3aXRoIHNjYWxhcnMgYXMgb3BlcmFuZHMuXG4gICAgdGhpcy5faXNTaW1wbGUgPSB0cnVlO1xuICAgIC8vIFNldCB0byBhIGR1bW15IGRvY3VtZW50IHdoaWNoIGFsd2F5cyBtYXRjaGVzIHRoaXMgTWF0Y2hlci4gT3Igc2V0IHRvIG51bGxcbiAgICAvLyBpZiBzdWNoIGRvY3VtZW50IGlzIHRvbyBoYXJkIHRvIGZpbmQuXG4gICAgdGhpcy5fbWF0Y2hpbmdEb2N1bWVudCA9IHVuZGVmaW5lZDtcbiAgICAvLyBBIGNsb25lIG9mIHRoZSBvcmlnaW5hbCBzZWxlY3Rvci4gSXQgbWF5IGp1c3QgYmUgYSBmdW5jdGlvbiBpZiB0aGUgdXNlclxuICAgIC8vIHBhc3NlZCBpbiBhIGZ1bmN0aW9uOyBvdGhlcndpc2UgaXMgZGVmaW5pdGVseSBhbiBvYmplY3QgKGVnLCBJRHMgYXJlXG4gICAgLy8gdHJhbnNsYXRlZCBpbnRvIHtfaWQ6IElEfSBmaXJzdC4gVXNlZCBieSBjYW5CZWNvbWVUcnVlQnlNb2RpZmllciBhbmRcbiAgICAvLyBTb3J0ZXIuX3VzZVdpdGhNYXRjaGVyLlxuICAgIHRoaXMuX3NlbGVjdG9yID0gbnVsbDtcbiAgICB0aGlzLl9kb2NNYXRjaGVyID0gdGhpcy5fY29tcGlsZVNlbGVjdG9yKHNlbGVjdG9yKTtcbiAgICAvLyBTZXQgdG8gdHJ1ZSBpZiBzZWxlY3Rpb24gaXMgZG9uZSBmb3IgYW4gdXBkYXRlIG9wZXJhdGlvblxuICAgIC8vIERlZmF1bHQgaXMgZmFsc2VcbiAgICAvLyBVc2VkIGZvciAkbmVhciBhcnJheSB1cGRhdGUgKGlzc3VlICMzNTk5KVxuICAgIHRoaXMuX2lzVXBkYXRlID0gaXNVcGRhdGU7XG4gIH1cblxuICBkb2N1bWVudE1hdGNoZXMoZG9jKSB7XG4gICAgaWYgKGRvYyAhPT0gT2JqZWN0KGRvYykpIHtcbiAgICAgIHRocm93IEVycm9yKCdkb2N1bWVudE1hdGNoZXMgbmVlZHMgYSBkb2N1bWVudCcpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9kb2NNYXRjaGVyKGRvYyk7XG4gIH1cblxuICBoYXNHZW9RdWVyeSgpIHtcbiAgICByZXR1cm4gdGhpcy5faGFzR2VvUXVlcnk7XG4gIH1cblxuICBoYXNXaGVyZSgpIHtcbiAgICByZXR1cm4gdGhpcy5faGFzV2hlcmU7XG4gIH1cblxuICBpc1NpbXBsZSgpIHtcbiAgICByZXR1cm4gdGhpcy5faXNTaW1wbGU7XG4gIH1cblxuICAvLyBHaXZlbiBhIHNlbGVjdG9yLCByZXR1cm4gYSBmdW5jdGlvbiB0aGF0IHRha2VzIG9uZSBhcmd1bWVudCwgYVxuICAvLyBkb2N1bWVudC4gSXQgcmV0dXJucyBhIHJlc3VsdCBvYmplY3QuXG4gIF9jb21waWxlU2VsZWN0b3Ioc2VsZWN0b3IpIHtcbiAgICAvLyB5b3UgY2FuIHBhc3MgYSBsaXRlcmFsIGZ1bmN0aW9uIGluc3RlYWQgb2YgYSBzZWxlY3RvclxuICAgIGlmIChzZWxlY3RvciBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICB0aGlzLl9pc1NpbXBsZSA9IGZhbHNlO1xuICAgICAgdGhpcy5fc2VsZWN0b3IgPSBzZWxlY3RvcjtcbiAgICAgIHRoaXMuX3JlY29yZFBhdGhVc2VkKCcnKTtcblxuICAgICAgcmV0dXJuIGRvYyA9PiAoe3Jlc3VsdDogISFzZWxlY3Rvci5jYWxsKGRvYyl9KTtcbiAgICB9XG5cbiAgICAvLyBzaG9ydGhhbmQgLS0gc2NhbGFyIF9pZFxuICAgIGlmIChMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZChzZWxlY3RvcikpIHtcbiAgICAgIHRoaXMuX3NlbGVjdG9yID0ge19pZDogc2VsZWN0b3J9O1xuICAgICAgdGhpcy5fcmVjb3JkUGF0aFVzZWQoJ19pZCcpO1xuXG4gICAgICByZXR1cm4gZG9jID0+ICh7cmVzdWx0OiBFSlNPTi5lcXVhbHMoZG9jLl9pZCwgc2VsZWN0b3IpfSk7XG4gICAgfVxuXG4gICAgLy8gcHJvdGVjdCBhZ2FpbnN0IGRhbmdlcm91cyBzZWxlY3RvcnMuICBmYWxzZXkgYW5kIHtfaWQ6IGZhbHNleX0gYXJlIGJvdGhcbiAgICAvLyBsaWtlbHkgcHJvZ3JhbW1lciBlcnJvciwgYW5kIG5vdCB3aGF0IHlvdSB3YW50LCBwYXJ0aWN1bGFybHkgZm9yXG4gICAgLy8gZGVzdHJ1Y3RpdmUgb3BlcmF0aW9ucy5cbiAgICBpZiAoIXNlbGVjdG9yIHx8IGhhc093bi5jYWxsKHNlbGVjdG9yLCAnX2lkJykgJiYgIXNlbGVjdG9yLl9pZCkge1xuICAgICAgdGhpcy5faXNTaW1wbGUgPSBmYWxzZTtcbiAgICAgIHJldHVybiBub3RoaW5nTWF0Y2hlcjtcbiAgICB9XG5cbiAgICAvLyBUb3AgbGV2ZWwgY2FuJ3QgYmUgYW4gYXJyYXkgb3IgdHJ1ZSBvciBiaW5hcnkuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoc2VsZWN0b3IpIHx8XG4gICAgICAgIEVKU09OLmlzQmluYXJ5KHNlbGVjdG9yKSB8fFxuICAgICAgICB0eXBlb2Ygc2VsZWN0b3IgPT09ICdib29sZWFuJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHNlbGVjdG9yOiAke3NlbGVjdG9yfWApO1xuICAgIH1cblxuICAgIHRoaXMuX3NlbGVjdG9yID0gRUpTT04uY2xvbmUoc2VsZWN0b3IpO1xuXG4gICAgcmV0dXJuIGNvbXBpbGVEb2N1bWVudFNlbGVjdG9yKHNlbGVjdG9yLCB0aGlzLCB7aXNSb290OiB0cnVlfSk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgbGlzdCBvZiBrZXkgcGF0aHMgdGhlIGdpdmVuIHNlbGVjdG9yIGlzIGxvb2tpbmcgZm9yLiBJdCBpbmNsdWRlc1xuICAvLyB0aGUgZW1wdHkgc3RyaW5nIGlmIHRoZXJlIGlzIGEgJHdoZXJlLlxuICBfZ2V0UGF0aHMoKSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX3BhdGhzKTtcbiAgfVxuXG4gIF9yZWNvcmRQYXRoVXNlZChwYXRoKSB7XG4gICAgdGhpcy5fcGF0aHNbcGF0aF0gPSB0cnVlO1xuICB9XG59XG5cbi8vIGhlbHBlcnMgdXNlZCBieSBjb21waWxlZCBzZWxlY3RvciBjb2RlXG5Mb2NhbENvbGxlY3Rpb24uX2YgPSB7XG4gIC8vIFhYWCBmb3IgX2FsbCBhbmQgX2luLCBjb25zaWRlciBidWlsZGluZyAnaW5xdWVyeScgYXQgY29tcGlsZSB0aW1lLi5cbiAgX3R5cGUodikge1xuICAgIGlmICh0eXBlb2YgdiA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdiA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiAyO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdiA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICByZXR1cm4gODtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2KSkge1xuICAgICAgcmV0dXJuIDQ7XG4gICAgfVxuXG4gICAgaWYgKHYgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiAxMDtcbiAgICB9XG5cbiAgICAvLyBub3RlIHRoYXQgdHlwZW9mKC94LykgPT09IFwib2JqZWN0XCJcbiAgICBpZiAodiBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgcmV0dXJuIDExO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgdiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIDEzO1xuICAgIH1cblxuICAgIGlmICh2IGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgcmV0dXJuIDk7XG4gICAgfVxuXG4gICAgaWYgKEVKU09OLmlzQmluYXJ5KHYpKSB7XG4gICAgICByZXR1cm4gNTtcbiAgICB9XG5cbiAgICBpZiAodiBpbnN0YW5jZW9mIE1vbmdvSUQuT2JqZWN0SUQpIHtcbiAgICAgIHJldHVybiA3O1xuICAgIH1cblxuICAgIGlmICh2IGluc3RhbmNlb2YgRGVjaW1hbCkge1xuICAgICAgcmV0dXJuIDE7XG4gICAgfVxuXG4gICAgLy8gb2JqZWN0XG4gICAgcmV0dXJuIDM7XG5cbiAgICAvLyBYWFggc3VwcG9ydCBzb21lL2FsbCBvZiB0aGVzZTpcbiAgICAvLyAxNCwgc3ltYm9sXG4gICAgLy8gMTUsIGphdmFzY3JpcHQgY29kZSB3aXRoIHNjb3BlXG4gICAgLy8gMTYsIDE4OiAzMi1iaXQvNjQtYml0IGludGVnZXJcbiAgICAvLyAxNywgdGltZXN0YW1wXG4gICAgLy8gMjU1LCBtaW5rZXlcbiAgICAvLyAxMjcsIG1heGtleVxuICB9LFxuXG4gIC8vIGRlZXAgZXF1YWxpdHkgdGVzdDogdXNlIGZvciBsaXRlcmFsIGRvY3VtZW50IGFuZCBhcnJheSBtYXRjaGVzXG4gIF9lcXVhbChhLCBiKSB7XG4gICAgcmV0dXJuIEVKU09OLmVxdWFscyhhLCBiLCB7a2V5T3JkZXJTZW5zaXRpdmU6IHRydWV9KTtcbiAgfSxcblxuICAvLyBtYXBzIGEgdHlwZSBjb2RlIHRvIGEgdmFsdWUgdGhhdCBjYW4gYmUgdXNlZCB0byBzb3J0IHZhbHVlcyBvZiBkaWZmZXJlbnRcbiAgLy8gdHlwZXNcbiAgX3R5cGVvcmRlcih0KSB7XG4gICAgLy8gaHR0cDovL3d3dy5tb25nb2RiLm9yZy9kaXNwbGF5L0RPQ1MvV2hhdCtpcyt0aGUrQ29tcGFyZStPcmRlcitmb3IrQlNPTitUeXBlc1xuICAgIC8vIFhYWCB3aGF0IGlzIHRoZSBjb3JyZWN0IHNvcnQgcG9zaXRpb24gZm9yIEphdmFzY3JpcHQgY29kZT9cbiAgICAvLyAoJzEwMCcgaW4gdGhlIG1hdHJpeCBiZWxvdylcbiAgICAvLyBYWFggbWlua2V5L21heGtleVxuICAgIHJldHVybiBbXG4gICAgICAtMSwgIC8vIChub3QgYSB0eXBlKVxuICAgICAgMSwgICAvLyBudW1iZXJcbiAgICAgIDIsICAgLy8gc3RyaW5nXG4gICAgICAzLCAgIC8vIG9iamVjdFxuICAgICAgNCwgICAvLyBhcnJheVxuICAgICAgNSwgICAvLyBiaW5hcnlcbiAgICAgIC0xLCAgLy8gZGVwcmVjYXRlZFxuICAgICAgNiwgICAvLyBPYmplY3RJRFxuICAgICAgNywgICAvLyBib29sXG4gICAgICA4LCAgIC8vIERhdGVcbiAgICAgIDAsICAgLy8gbnVsbFxuICAgICAgOSwgICAvLyBSZWdFeHBcbiAgICAgIC0xLCAgLy8gZGVwcmVjYXRlZFxuICAgICAgMTAwLCAvLyBKUyBjb2RlXG4gICAgICAyLCAgIC8vIGRlcHJlY2F0ZWQgKHN5bWJvbClcbiAgICAgIDEwMCwgLy8gSlMgY29kZVxuICAgICAgMSwgICAvLyAzMi1iaXQgaW50XG4gICAgICA4LCAgIC8vIE1vbmdvIHRpbWVzdGFtcFxuICAgICAgMSAgICAvLyA2NC1iaXQgaW50XG4gICAgXVt0XTtcbiAgfSxcblxuICAvLyBjb21wYXJlIHR3byB2YWx1ZXMgb2YgdW5rbm93biB0eXBlIGFjY29yZGluZyB0byBCU09OIG9yZGVyaW5nXG4gIC8vIHNlbWFudGljcy4gKGFzIGFuIGV4dGVuc2lvbiwgY29uc2lkZXIgJ3VuZGVmaW5lZCcgdG8gYmUgbGVzcyB0aGFuXG4gIC8vIGFueSBvdGhlciB2YWx1ZS4pIHJldHVybiBuZWdhdGl2ZSBpZiBhIGlzIGxlc3MsIHBvc2l0aXZlIGlmIGIgaXNcbiAgLy8gbGVzcywgb3IgMCBpZiBlcXVhbFxuICBfY21wKGEsIGIpIHtcbiAgICBpZiAoYSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gYiA9PT0gdW5kZWZpbmVkID8gMCA6IC0xO1xuICAgIH1cblxuICAgIGlmIChiID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiAxO1xuICAgIH1cblxuICAgIGxldCB0YSA9IExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZShhKTtcbiAgICBsZXQgdGIgPSBMb2NhbENvbGxlY3Rpb24uX2YuX3R5cGUoYik7XG5cbiAgICBjb25zdCBvYSA9IExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZW9yZGVyKHRhKTtcbiAgICBjb25zdCBvYiA9IExvY2FsQ29sbGVjdGlvbi5fZi5fdHlwZW9yZGVyKHRiKTtcblxuICAgIGlmIChvYSAhPT0gb2IpIHtcbiAgICAgIHJldHVybiBvYSA8IG9iID8gLTEgOiAxO1xuICAgIH1cblxuICAgIC8vIFhYWCBuZWVkIHRvIGltcGxlbWVudCB0aGlzIGlmIHdlIGltcGxlbWVudCBTeW1ib2wgb3IgaW50ZWdlcnMsIG9yXG4gICAgLy8gVGltZXN0YW1wXG4gICAgaWYgKHRhICE9PSB0Yikge1xuICAgICAgdGhyb3cgRXJyb3IoJ01pc3NpbmcgdHlwZSBjb2VyY2lvbiBsb2dpYyBpbiBfY21wJyk7XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSA3KSB7IC8vIE9iamVjdElEXG4gICAgICAvLyBDb252ZXJ0IHRvIHN0cmluZy5cbiAgICAgIHRhID0gdGIgPSAyO1xuICAgICAgYSA9IGEudG9IZXhTdHJpbmcoKTtcbiAgICAgIGIgPSBiLnRvSGV4U3RyaW5nKCk7XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSA5KSB7IC8vIERhdGVcbiAgICAgIC8vIENvbnZlcnQgdG8gbWlsbGlzLlxuICAgICAgdGEgPSB0YiA9IDE7XG4gICAgICBhID0gaXNOYU4oYSkgPyAwIDogYS5nZXRUaW1lKCk7XG4gICAgICBiID0gaXNOYU4oYikgPyAwIDogYi5nZXRUaW1lKCk7XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSAxKSB7IC8vIGRvdWJsZVxuICAgICAgaWYgKGEgaW5zdGFuY2VvZiBEZWNpbWFsKSB7XG4gICAgICAgIHJldHVybiBhLm1pbnVzKGIpLnRvTnVtYmVyKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYSAtIGI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRiID09PSAyKSAvLyBzdHJpbmdcbiAgICAgIHJldHVybiBhIDwgYiA/IC0xIDogYSA9PT0gYiA/IDAgOiAxO1xuXG4gICAgaWYgKHRhID09PSAzKSB7IC8vIE9iamVjdFxuICAgICAgLy8gdGhpcyBjb3VsZCBiZSBtdWNoIG1vcmUgZWZmaWNpZW50IGluIHRoZSBleHBlY3RlZCBjYXNlIC4uLlxuICAgICAgY29uc3QgdG9BcnJheSA9IG9iamVjdCA9PiB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IFtdO1xuXG4gICAgICAgIE9iamVjdC5rZXlzKG9iamVjdCkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICAgIHJlc3VsdC5wdXNoKGtleSwgb2JqZWN0W2tleV0pO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIExvY2FsQ29sbGVjdGlvbi5fZi5fY21wKHRvQXJyYXkoYSksIHRvQXJyYXkoYikpO1xuICAgIH1cblxuICAgIGlmICh0YSA9PT0gNCkgeyAvLyBBcnJheVxuICAgICAgZm9yIChsZXQgaSA9IDA7IDsgaSsrKSB7XG4gICAgICAgIGlmIChpID09PSBhLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiBpID09PSBiLmxlbmd0aCA/IDAgOiAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpID09PSBiLmxlbmd0aCkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcyA9IExvY2FsQ29sbGVjdGlvbi5fZi5fY21wKGFbaV0sIGJbaV0pO1xuICAgICAgICBpZiAocyAhPT0gMCkge1xuICAgICAgICAgIHJldHVybiBzO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRhID09PSA1KSB7IC8vIGJpbmFyeVxuICAgICAgLy8gU3VycHJpc2luZ2x5LCBhIHNtYWxsIGJpbmFyeSBibG9iIGlzIGFsd2F5cyBsZXNzIHRoYW4gYSBsYXJnZSBvbmUgaW5cbiAgICAgIC8vIE1vbmdvLlxuICAgICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gYS5sZW5ndGggLSBiLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChhW2ldIDwgYltpXSkge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhW2ldID4gYltpXSkge1xuICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiAwO1xuICAgIH1cblxuICAgIGlmICh0YSA9PT0gOCkgeyAvLyBib29sZWFuXG4gICAgICBpZiAoYSkge1xuICAgICAgICByZXR1cm4gYiA/IDAgOiAxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYiA/IC0xIDogMDtcbiAgICB9XG5cbiAgICBpZiAodGEgPT09IDEwKSAvLyBudWxsXG4gICAgICByZXR1cm4gMDtcblxuICAgIGlmICh0YSA9PT0gMTEpIC8vIHJlZ2V4cFxuICAgICAgdGhyb3cgRXJyb3IoJ1NvcnRpbmcgbm90IHN1cHBvcnRlZCBvbiByZWd1bGFyIGV4cHJlc3Npb24nKTsgLy8gWFhYXG5cbiAgICAvLyAxMzogamF2YXNjcmlwdCBjb2RlXG4gICAgLy8gMTQ6IHN5bWJvbFxuICAgIC8vIDE1OiBqYXZhc2NyaXB0IGNvZGUgd2l0aCBzY29wZVxuICAgIC8vIDE2OiAzMi1iaXQgaW50ZWdlclxuICAgIC8vIDE3OiB0aW1lc3RhbXBcbiAgICAvLyAxODogNjQtYml0IGludGVnZXJcbiAgICAvLyAyNTU6IG1pbmtleVxuICAgIC8vIDEyNzogbWF4a2V5XG4gICAgaWYgKHRhID09PSAxMykgLy8gamF2YXNjcmlwdCBjb2RlXG4gICAgICB0aHJvdyBFcnJvcignU29ydGluZyBub3Qgc3VwcG9ydGVkIG9uIEphdmFzY3JpcHQgY29kZScpOyAvLyBYWFhcblxuICAgIHRocm93IEVycm9yKCdVbmtub3duIHR5cGUgdG8gc29ydCcpO1xuICB9LFxufTtcbiIsImltcG9ydCBMb2NhbENvbGxlY3Rpb25fIGZyb20gJy4vbG9jYWxfY29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgTWF0Y2hlciBmcm9tICcuL21hdGNoZXIuanMnO1xuaW1wb3J0IFNvcnRlciBmcm9tICcuL3NvcnRlci5qcyc7XG5cbkxvY2FsQ29sbGVjdGlvbiA9IExvY2FsQ29sbGVjdGlvbl87XG5NaW5pbW9uZ28gPSB7XG4gICAgTG9jYWxDb2xsZWN0aW9uOiBMb2NhbENvbGxlY3Rpb25fLFxuICAgIE1hdGNoZXIsXG4gICAgU29ydGVyXG59O1xuIiwiLy8gT2JzZXJ2ZUhhbmRsZTogdGhlIHJldHVybiB2YWx1ZSBvZiBhIGxpdmUgcXVlcnkuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBPYnNlcnZlSGFuZGxlIHt9XG4iLCJpbXBvcnQge1xuICBFTEVNRU5UX09QRVJBVE9SUyxcbiAgZXF1YWxpdHlFbGVtZW50TWF0Y2hlcixcbiAgZXhwYW5kQXJyYXlzSW5CcmFuY2hlcyxcbiAgaGFzT3duLFxuICBpc09wZXJhdG9yT2JqZWN0LFxuICBtYWtlTG9va3VwRnVuY3Rpb24sXG4gIHJlZ2V4cEVsZW1lbnRNYXRjaGVyLFxufSBmcm9tICcuL2NvbW1vbi5qcyc7XG5cbi8vIEdpdmUgYSBzb3J0IHNwZWMsIHdoaWNoIGNhbiBiZSBpbiBhbnkgb2YgdGhlc2UgZm9ybXM6XG4vLyAgIHtcImtleTFcIjogMSwgXCJrZXkyXCI6IC0xfVxuLy8gICBbW1wia2V5MVwiLCBcImFzY1wiXSwgW1wia2V5MlwiLCBcImRlc2NcIl1dXG4vLyAgIFtcImtleTFcIiwgW1wia2V5MlwiLCBcImRlc2NcIl1dXG4vL1xuLy8gKC4uIHdpdGggdGhlIGZpcnN0IGZvcm0gYmVpbmcgZGVwZW5kZW50IG9uIHRoZSBrZXkgZW51bWVyYXRpb25cbi8vIGJlaGF2aW9yIG9mIHlvdXIgamF2YXNjcmlwdCBWTSwgd2hpY2ggdXN1YWxseSBkb2VzIHdoYXQgeW91IG1lYW4gaW5cbi8vIHRoaXMgY2FzZSBpZiB0aGUga2V5IG5hbWVzIGRvbid0IGxvb2sgbGlrZSBpbnRlZ2VycyAuLilcbi8vXG4vLyByZXR1cm4gYSBmdW5jdGlvbiB0aGF0IHRha2VzIHR3byBvYmplY3RzLCBhbmQgcmV0dXJucyAtMSBpZiB0aGVcbi8vIGZpcnN0IG9iamVjdCBjb21lcyBmaXJzdCBpbiBvcmRlciwgMSBpZiB0aGUgc2Vjb25kIG9iamVjdCBjb21lc1xuLy8gZmlyc3QsIG9yIDAgaWYgbmVpdGhlciBvYmplY3QgY29tZXMgYmVmb3JlIHRoZSBvdGhlci5cblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgU29ydGVyIHtcbiAgY29uc3RydWN0b3Ioc3BlYykge1xuICAgIHRoaXMuX3NvcnRTcGVjUGFydHMgPSBbXTtcbiAgICB0aGlzLl9zb3J0RnVuY3Rpb24gPSBudWxsO1xuXG4gICAgY29uc3QgYWRkU3BlY1BhcnQgPSAocGF0aCwgYXNjZW5kaW5nKSA9PiB7XG4gICAgICBpZiAoIXBhdGgpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ3NvcnQga2V5cyBtdXN0IGJlIG5vbi1lbXB0eScpO1xuICAgICAgfVxuXG4gICAgICBpZiAocGF0aC5jaGFyQXQoMCkgPT09ICckJykge1xuICAgICAgICB0aHJvdyBFcnJvcihgdW5zdXBwb3J0ZWQgc29ydCBrZXk6ICR7cGF0aH1gKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fc29ydFNwZWNQYXJ0cy5wdXNoKHtcbiAgICAgICAgYXNjZW5kaW5nLFxuICAgICAgICBsb29rdXA6IG1ha2VMb29rdXBGdW5jdGlvbihwYXRoLCB7Zm9yU29ydDogdHJ1ZX0pLFxuICAgICAgICBwYXRoXG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgaWYgKHNwZWMgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgc3BlYy5mb3JFYWNoKGVsZW1lbnQgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGVsZW1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgYWRkU3BlY1BhcnQoZWxlbWVudCwgdHJ1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYWRkU3BlY1BhcnQoZWxlbWVudFswXSwgZWxlbWVudFsxXSAhPT0gJ2Rlc2MnKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc3BlYyA9PT0gJ29iamVjdCcpIHtcbiAgICAgIE9iamVjdC5rZXlzKHNwZWMpLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgYWRkU3BlY1BhcnQoa2V5LCBzcGVjW2tleV0gPj0gMCk7XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzcGVjID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLl9zb3J0RnVuY3Rpb24gPSBzcGVjO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBFcnJvcihgQmFkIHNvcnQgc3BlY2lmaWNhdGlvbjogJHtKU09OLnN0cmluZ2lmeShzcGVjKX1gKTtcbiAgICB9XG5cbiAgICAvLyBJZiBhIGZ1bmN0aW9uIGlzIHNwZWNpZmllZCBmb3Igc29ydGluZywgd2Ugc2tpcCB0aGUgcmVzdC5cbiAgICBpZiAodGhpcy5fc29ydEZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gVG8gaW1wbGVtZW50IGFmZmVjdGVkQnlNb2RpZmllciwgd2UgcGlnZ3ktYmFjayBvbiB0b3Agb2YgTWF0Y2hlcidzXG4gICAgLy8gYWZmZWN0ZWRCeU1vZGlmaWVyIGNvZGU7IHdlIGNyZWF0ZSBhIHNlbGVjdG9yIHRoYXQgaXMgYWZmZWN0ZWQgYnkgdGhlXG4gICAgLy8gc2FtZSBtb2RpZmllcnMgYXMgdGhpcyBzb3J0IG9yZGVyLiBUaGlzIGlzIG9ubHkgaW1wbGVtZW50ZWQgb24gdGhlXG4gICAgLy8gc2VydmVyLlxuICAgIGlmICh0aGlzLmFmZmVjdGVkQnlNb2RpZmllcikge1xuICAgICAgY29uc3Qgc2VsZWN0b3IgPSB7fTtcblxuICAgICAgdGhpcy5fc29ydFNwZWNQYXJ0cy5mb3JFYWNoKHNwZWMgPT4ge1xuICAgICAgICBzZWxlY3RvcltzcGVjLnBhdGhdID0gMTtcbiAgICAgIH0pO1xuXG4gICAgICB0aGlzLl9zZWxlY3RvckZvckFmZmVjdGVkQnlNb2RpZmllciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcihzZWxlY3Rvcik7XG4gICAgfVxuXG4gICAgdGhpcy5fa2V5Q29tcGFyYXRvciA9IGNvbXBvc2VDb21wYXJhdG9ycyhcbiAgICAgIHRoaXMuX3NvcnRTcGVjUGFydHMubWFwKChzcGVjLCBpKSA9PiB0aGlzLl9rZXlGaWVsZENvbXBhcmF0b3IoaSkpXG4gICAgKTtcbiAgfVxuXG4gIGdldENvbXBhcmF0b3Iob3B0aW9ucykge1xuICAgIC8vIElmIHNvcnQgaXMgc3BlY2lmaWVkIG9yIGhhdmUgbm8gZGlzdGFuY2VzLCBqdXN0IHVzZSB0aGUgY29tcGFyYXRvciBmcm9tXG4gICAgLy8gdGhlIHNvdXJjZSBzcGVjaWZpY2F0aW9uICh3aGljaCBkZWZhdWx0cyB0byBcImV2ZXJ5dGhpbmcgaXMgZXF1YWxcIi5cbiAgICAvLyBpc3N1ZSAjMzU5OVxuICAgIC8vIGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL29wZXJhdG9yL3F1ZXJ5L25lYXIvI3NvcnQtb3BlcmF0aW9uXG4gICAgLy8gc29ydCBlZmZlY3RpdmVseSBvdmVycmlkZXMgJG5lYXJcbiAgICBpZiAodGhpcy5fc29ydFNwZWNQYXJ0cy5sZW5ndGggfHwgIW9wdGlvbnMgfHwgIW9wdGlvbnMuZGlzdGFuY2VzKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0QmFzZUNvbXBhcmF0b3IoKTtcbiAgICB9XG5cbiAgICBjb25zdCBkaXN0YW5jZXMgPSBvcHRpb25zLmRpc3RhbmNlcztcblxuICAgIC8vIFJldHVybiBhIGNvbXBhcmF0b3Igd2hpY2ggY29tcGFyZXMgdXNpbmcgJG5lYXIgZGlzdGFuY2VzLlxuICAgIHJldHVybiAoYSwgYikgPT4ge1xuICAgICAgaWYgKCFkaXN0YW5jZXMuaGFzKGEuX2lkKSkge1xuICAgICAgICB0aHJvdyBFcnJvcihgTWlzc2luZyBkaXN0YW5jZSBmb3IgJHthLl9pZH1gKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFkaXN0YW5jZXMuaGFzKGIuX2lkKSkge1xuICAgICAgICB0aHJvdyBFcnJvcihgTWlzc2luZyBkaXN0YW5jZSBmb3IgJHtiLl9pZH1gKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGRpc3RhbmNlcy5nZXQoYS5faWQpIC0gZGlzdGFuY2VzLmdldChiLl9pZCk7XG4gICAgfTtcbiAgfVxuXG4gIC8vIFRha2VzIGluIHR3byBrZXlzOiBhcnJheXMgd2hvc2UgbGVuZ3RocyBtYXRjaCB0aGUgbnVtYmVyIG9mIHNwZWNcbiAgLy8gcGFydHMuIFJldHVybnMgbmVnYXRpdmUsIDAsIG9yIHBvc2l0aXZlIGJhc2VkIG9uIHVzaW5nIHRoZSBzb3J0IHNwZWMgdG9cbiAgLy8gY29tcGFyZSBmaWVsZHMuXG4gIF9jb21wYXJlS2V5cyhrZXkxLCBrZXkyKSB7XG4gICAgaWYgKGtleTEubGVuZ3RoICE9PSB0aGlzLl9zb3J0U3BlY1BhcnRzLmxlbmd0aCB8fFxuICAgICAgICBrZXkyLmxlbmd0aCAhPT0gdGhpcy5fc29ydFNwZWNQYXJ0cy5sZW5ndGgpIHtcbiAgICAgIHRocm93IEVycm9yKCdLZXkgaGFzIHdyb25nIGxlbmd0aCcpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9rZXlDb21wYXJhdG9yKGtleTEsIGtleTIpO1xuICB9XG5cbiAgLy8gSXRlcmF0ZXMgb3ZlciBlYWNoIHBvc3NpYmxlIFwia2V5XCIgZnJvbSBkb2MgKGllLCBvdmVyIGVhY2ggYnJhbmNoKSwgY2FsbGluZ1xuICAvLyAnY2InIHdpdGggdGhlIGtleS5cbiAgX2dlbmVyYXRlS2V5c0Zyb21Eb2MoZG9jLCBjYikge1xuICAgIGlmICh0aGlzLl9zb3J0U3BlY1BhcnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjYW5cXCd0IGdlbmVyYXRlIGtleXMgd2l0aG91dCBhIHNwZWMnKTtcbiAgICB9XG5cbiAgICBjb25zdCBwYXRoRnJvbUluZGljZXMgPSBpbmRpY2VzID0+IGAke2luZGljZXMuam9pbignLCcpfSxgO1xuXG4gICAgbGV0IGtub3duUGF0aHMgPSBudWxsO1xuXG4gICAgLy8gbWFwcyBpbmRleCAtPiAoeycnIC0+IHZhbHVlfSBvciB7cGF0aCAtPiB2YWx1ZX0pXG4gICAgY29uc3QgdmFsdWVzQnlJbmRleEFuZFBhdGggPSB0aGlzLl9zb3J0U3BlY1BhcnRzLm1hcChzcGVjID0+IHtcbiAgICAgIC8vIEV4cGFuZCBhbnkgbGVhZiBhcnJheXMgdGhhdCB3ZSBmaW5kLCBhbmQgaWdub3JlIHRob3NlIGFycmF5c1xuICAgICAgLy8gdGhlbXNlbHZlcy4gIChXZSBuZXZlciBzb3J0IGJhc2VkIG9uIGFuIGFycmF5IGl0c2VsZi4pXG4gICAgICBsZXQgYnJhbmNoZXMgPSBleHBhbmRBcnJheXNJbkJyYW5jaGVzKHNwZWMubG9va3VwKGRvYyksIHRydWUpO1xuXG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbm8gdmFsdWVzIGZvciBhIGtleSAoZWcsIGtleSBnb2VzIHRvIGFuIGVtcHR5IGFycmF5KSxcbiAgICAgIC8vIHByZXRlbmQgd2UgZm91bmQgb25lIHVuZGVmaW5lZCB2YWx1ZS5cbiAgICAgIGlmICghYnJhbmNoZXMubGVuZ3RoKSB7XG4gICAgICAgIGJyYW5jaGVzID0gW3sgdmFsdWU6IHZvaWQgMCB9XTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZWxlbWVudCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBsZXQgdXNlZFBhdGhzID0gZmFsc2U7XG5cbiAgICAgIGJyYW5jaGVzLmZvckVhY2goYnJhbmNoID0+IHtcbiAgICAgICAgaWYgKCFicmFuY2guYXJyYXlJbmRpY2VzKSB7XG4gICAgICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIGFycmF5IGluZGljZXMgZm9yIGEgYnJhbmNoLCB0aGVuIGl0IG11c3QgYmUgdGhlXG4gICAgICAgICAgLy8gb25seSBicmFuY2gsIGJlY2F1c2UgdGhlIG9ubHkgdGhpbmcgdGhhdCBwcm9kdWNlcyBtdWx0aXBsZSBicmFuY2hlc1xuICAgICAgICAgIC8vIGlzIHRoZSB1c2Ugb2YgYXJyYXlzLlxuICAgICAgICAgIGlmIChicmFuY2hlcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICB0aHJvdyBFcnJvcignbXVsdGlwbGUgYnJhbmNoZXMgYnV0IG5vIGFycmF5IHVzZWQ/Jyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZWxlbWVudFsnJ10gPSBicmFuY2gudmFsdWU7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdXNlZFBhdGhzID0gdHJ1ZTtcblxuICAgICAgICBjb25zdCBwYXRoID0gcGF0aEZyb21JbmRpY2VzKGJyYW5jaC5hcnJheUluZGljZXMpO1xuXG4gICAgICAgIGlmIChoYXNPd24uY2FsbChlbGVtZW50LCBwYXRoKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKGBkdXBsaWNhdGUgcGF0aDogJHtwYXRofWApO1xuICAgICAgICB9XG5cbiAgICAgICAgZWxlbWVudFtwYXRoXSA9IGJyYW5jaC52YWx1ZTtcblxuICAgICAgICAvLyBJZiB0d28gc29ydCBmaWVsZHMgYm90aCBnbyBpbnRvIGFycmF5cywgdGhleSBoYXZlIHRvIGdvIGludG8gdGhlXG4gICAgICAgIC8vIGV4YWN0IHNhbWUgYXJyYXlzIGFuZCB3ZSBoYXZlIHRvIGZpbmQgdGhlIHNhbWUgcGF0aHMuICBUaGlzIGlzXG4gICAgICAgIC8vIHJvdWdobHkgdGhlIHNhbWUgY29uZGl0aW9uIHRoYXQgbWFrZXMgTW9uZ29EQiB0aHJvdyB0aGlzIHN0cmFuZ2VcbiAgICAgICAgLy8gZXJyb3IgbWVzc2FnZS4gIGVnLCB0aGUgbWFpbiB0aGluZyBpcyB0aGF0IGlmIHNvcnQgc3BlYyBpcyB7YTogMSxcbiAgICAgICAgLy8gYjoxfSB0aGVuIGEgYW5kIGIgY2Fubm90IGJvdGggYmUgYXJyYXlzLlxuICAgICAgICAvL1xuICAgICAgICAvLyAoSW4gTW9uZ29EQiBpdCBzZWVtcyB0byBiZSBPSyB0byBoYXZlIHthOiAxLCAnYS54LnknOiAxfSB3aGVyZSAnYSdcbiAgICAgICAgLy8gYW5kICdhLngueScgYXJlIGJvdGggYXJyYXlzLCBidXQgd2UgZG9uJ3QgYWxsb3cgdGhpcyBmb3Igbm93LlxuICAgICAgICAvLyAjTmVzdGVkQXJyYXlTb3J0XG4gICAgICAgIC8vIFhYWCBhY2hpZXZlIGZ1bGwgY29tcGF0aWJpbGl0eSBoZXJlXG4gICAgICAgIGlmIChrbm93blBhdGhzICYmICFoYXNPd24uY2FsbChrbm93blBhdGhzLCBwYXRoKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdjYW5ub3QgaW5kZXggcGFyYWxsZWwgYXJyYXlzJyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoa25vd25QYXRocykge1xuICAgICAgICAvLyBTaW1pbGFybHkgdG8gYWJvdmUsIHBhdGhzIG11c3QgbWF0Y2ggZXZlcnl3aGVyZSwgdW5sZXNzIHRoaXMgaXMgYVxuICAgICAgICAvLyBub24tYXJyYXkgZmllbGQuXG4gICAgICAgIGlmICghaGFzT3duLmNhbGwoZWxlbWVudCwgJycpICYmXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhrbm93blBhdGhzKS5sZW5ndGggIT09IE9iamVjdC5rZXlzKGVsZW1lbnQpLmxlbmd0aCkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdjYW5ub3QgaW5kZXggcGFyYWxsZWwgYXJyYXlzIScpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHVzZWRQYXRocykge1xuICAgICAgICBrbm93blBhdGhzID0ge307XG5cbiAgICAgICAgT2JqZWN0LmtleXMoZWxlbWVudCkuZm9yRWFjaChwYXRoID0+IHtcbiAgICAgICAgICBrbm93blBhdGhzW3BhdGhdID0gdHJ1ZTtcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBlbGVtZW50O1xuICAgIH0pO1xuXG4gICAgaWYgKCFrbm93blBhdGhzKSB7XG4gICAgICAvLyBFYXN5IGNhc2U6IG5vIHVzZSBvZiBhcnJheXMuXG4gICAgICBjb25zdCBzb2xlS2V5ID0gdmFsdWVzQnlJbmRleEFuZFBhdGgubWFwKHZhbHVlcyA9PiB7XG4gICAgICAgIGlmICghaGFzT3duLmNhbGwodmFsdWVzLCAnJykpIHtcbiAgICAgICAgICB0aHJvdyBFcnJvcignbm8gdmFsdWUgaW4gc29sZSBrZXkgY2FzZT8nKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2YWx1ZXNbJyddO1xuICAgICAgfSk7XG5cbiAgICAgIGNiKHNvbGVLZXkpO1xuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoa25vd25QYXRocykuZm9yRWFjaChwYXRoID0+IHtcbiAgICAgIGNvbnN0IGtleSA9IHZhbHVlc0J5SW5kZXhBbmRQYXRoLm1hcCh2YWx1ZXMgPT4ge1xuICAgICAgICBpZiAoaGFzT3duLmNhbGwodmFsdWVzLCAnJykpIHtcbiAgICAgICAgICByZXR1cm4gdmFsdWVzWycnXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaGFzT3duLmNhbGwodmFsdWVzLCBwYXRoKSkge1xuICAgICAgICAgIHRocm93IEVycm9yKCdtaXNzaW5nIHBhdGg/Jyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsdWVzW3BhdGhdO1xuICAgICAgfSk7XG5cbiAgICAgIGNiKGtleSk7XG4gICAgfSk7XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgY29tcGFyYXRvciB0aGF0IHJlcHJlc2VudHMgdGhlIHNvcnQgc3BlY2lmaWNhdGlvbiAoYnV0IG5vdFxuICAvLyBpbmNsdWRpbmcgYSBwb3NzaWJsZSBnZW9xdWVyeSBkaXN0YW5jZSB0aWUtYnJlYWtlcikuXG4gIF9nZXRCYXNlQ29tcGFyYXRvcigpIHtcbiAgICBpZiAodGhpcy5fc29ydEZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm4gdGhpcy5fc29ydEZ1bmN0aW9uO1xuICAgIH1cblxuICAgIC8vIElmIHdlJ3JlIG9ubHkgc29ydGluZyBvbiBnZW9xdWVyeSBkaXN0YW5jZSBhbmQgbm8gc3BlY3MsIGp1c3Qgc2F5XG4gICAgLy8gZXZlcnl0aGluZyBpcyBlcXVhbC5cbiAgICBpZiAoIXRoaXMuX3NvcnRTcGVjUGFydHMubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gKGRvYzEsIGRvYzIpID0+IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIChkb2MxLCBkb2MyKSA9PiB7XG4gICAgICBjb25zdCBrZXkxID0gdGhpcy5fZ2V0TWluS2V5RnJvbURvYyhkb2MxKTtcbiAgICAgIGNvbnN0IGtleTIgPSB0aGlzLl9nZXRNaW5LZXlGcm9tRG9jKGRvYzIpO1xuICAgICAgcmV0dXJuIHRoaXMuX2NvbXBhcmVLZXlzKGtleTEsIGtleTIpO1xuICAgIH07XG4gIH1cblxuICAvLyBGaW5kcyB0aGUgbWluaW11bSBrZXkgZnJvbSB0aGUgZG9jLCBhY2NvcmRpbmcgdG8gdGhlIHNvcnQgc3BlY3MuICAoV2Ugc2F5XG4gIC8vIFwibWluaW11bVwiIGhlcmUgYnV0IHRoaXMgaXMgd2l0aCByZXNwZWN0IHRvIHRoZSBzb3J0IHNwZWMsIHNvIFwiZGVzY2VuZGluZ1wiXG4gIC8vIHNvcnQgZmllbGRzIG1lYW4gd2UncmUgZmluZGluZyB0aGUgbWF4IGZvciB0aGF0IGZpZWxkLilcbiAgLy9cbiAgLy8gTm90ZSB0aGF0IHRoaXMgaXMgTk9UIFwiZmluZCB0aGUgbWluaW11bSB2YWx1ZSBvZiB0aGUgZmlyc3QgZmllbGQsIHRoZVxuICAvLyBtaW5pbXVtIHZhbHVlIG9mIHRoZSBzZWNvbmQgZmllbGQsIGV0Y1wiLi4uIGl0J3MgXCJjaG9vc2UgdGhlXG4gIC8vIGxleGljb2dyYXBoaWNhbGx5IG1pbmltdW0gdmFsdWUgb2YgdGhlIGtleSB2ZWN0b3IsIGFsbG93aW5nIG9ubHkga2V5cyB3aGljaFxuICAvLyB5b3UgY2FuIGZpbmQgYWxvbmcgdGhlIHNhbWUgcGF0aHNcIi4gIGllLCBmb3IgYSBkb2Mge2E6IFt7eDogMCwgeTogNX0sIHt4OlxuICAvLyAxLCB5OiAzfV19IHdpdGggc29ydCBzcGVjIHsnYS54JzogMSwgJ2EueSc6IDF9LCB0aGUgb25seSBrZXlzIGFyZSBbMCw1XSBhbmRcbiAgLy8gWzEsM10sIGFuZCB0aGUgbWluaW11bSBrZXkgaXMgWzAsNV07IG5vdGFibHksIFswLDNdIGlzIE5PVCBhIGtleS5cbiAgX2dldE1pbktleUZyb21Eb2MoZG9jKSB7XG4gICAgbGV0IG1pbktleSA9IG51bGw7XG5cbiAgICB0aGlzLl9nZW5lcmF0ZUtleXNGcm9tRG9jKGRvYywga2V5ID0+IHtcbiAgICAgIGlmIChtaW5LZXkgPT09IG51bGwpIHtcbiAgICAgICAgbWluS2V5ID0ga2V5O1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9jb21wYXJlS2V5cyhrZXksIG1pbktleSkgPCAwKSB7XG4gICAgICAgIG1pbktleSA9IGtleTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiBtaW5LZXk7XG4gIH1cblxuICBfZ2V0UGF0aHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3NvcnRTcGVjUGFydHMubWFwKHBhcnQgPT4gcGFydC5wYXRoKTtcbiAgfVxuXG4gIC8vIEdpdmVuIGFuIGluZGV4ICdpJywgcmV0dXJucyBhIGNvbXBhcmF0b3IgdGhhdCBjb21wYXJlcyB0d28ga2V5IGFycmF5cyBiYXNlZFxuICAvLyBvbiBmaWVsZCAnaScuXG4gIF9rZXlGaWVsZENvbXBhcmF0b3IoaSkge1xuICAgIGNvbnN0IGludmVydCA9ICF0aGlzLl9zb3J0U3BlY1BhcnRzW2ldLmFzY2VuZGluZztcblxuICAgIHJldHVybiAoa2V5MSwga2V5MikgPT4ge1xuICAgICAgY29uc3QgY29tcGFyZSA9IExvY2FsQ29sbGVjdGlvbi5fZi5fY21wKGtleTFbaV0sIGtleTJbaV0pO1xuICAgICAgcmV0dXJuIGludmVydCA/IC1jb21wYXJlIDogY29tcGFyZTtcbiAgICB9O1xuICB9XG59XG5cbi8vIEdpdmVuIGFuIGFycmF5IG9mIGNvbXBhcmF0b3JzXG4vLyAoZnVuY3Rpb25zIChhLGIpLT4obmVnYXRpdmUgb3IgcG9zaXRpdmUgb3IgemVybykpLCByZXR1cm5zIGEgc2luZ2xlXG4vLyBjb21wYXJhdG9yIHdoaWNoIHVzZXMgZWFjaCBjb21wYXJhdG9yIGluIG9yZGVyIGFuZCByZXR1cm5zIHRoZSBmaXJzdFxuLy8gbm9uLXplcm8gdmFsdWUuXG5mdW5jdGlvbiBjb21wb3NlQ29tcGFyYXRvcnMoY29tcGFyYXRvckFycmF5KSB7XG4gIHJldHVybiAoYSwgYikgPT4ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29tcGFyYXRvckFycmF5Lmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCBjb21wYXJlID0gY29tcGFyYXRvckFycmF5W2ldKGEsIGIpO1xuICAgICAgaWYgKGNvbXBhcmUgIT09IDApIHtcbiAgICAgICAgcmV0dXJuIGNvbXBhcmU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIDA7XG4gIH07XG59XG4iXX0=
