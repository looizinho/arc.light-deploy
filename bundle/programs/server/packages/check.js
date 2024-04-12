Package["core-runtime"].queue("check", ["meteor", "ecmascript", "ejson", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var check, Match;

var require = meteorInstall({"node_modules":{"meteor":{"check":{"match.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/check/match.js                                                                                           //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      check: () => check,
      Match: () => Match
    });
    let isPlainObject;
    module.link("./isPlainObject", {
      isPlainObject(v) {
        isPlainObject = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // Things we explicitly do NOT support:
    //    - heterogenous arrays

    const currentArgumentChecker = new Meteor.EnvironmentVariable();
    const hasOwn = Object.prototype.hasOwnProperty;

    /**
     * @summary Check that a value matches a [pattern](#matchpatterns).
     * If the value does not match the pattern, throw a `Match.Error`.
     *
     * Particularly useful to assert that arguments to a function have the right
     * types and structure.
     * @locus Anywhere
     * @param {Any} value The value to check
     * @param {MatchPattern} pattern The pattern to match `value` against
     */
    function check(value, pattern) {
      // Record that check got called, if somebody cared.
      //
      // We use getOrNullIfOutsideFiber so that it's OK to call check()
      // from non-Fiber server contexts; the downside is that if you forget to
      // bindEnvironment on some random callback in your method/publisher,
      // it might not find the argumentChecker and you'll get an error about
      // not checking an argument that it looks like you're checking (instead
      // of just getting a "Node code must run in a Fiber" error).
      const argChecker = currentArgumentChecker.getOrNullIfOutsideFiber();
      if (argChecker) {
        argChecker.checking(value);
      }
      const result = testSubtree(value, pattern);
      if (result) {
        const err = new Match.Error(result.message);
        if (result.path) {
          err.message += " in field ".concat(result.path);
          err.path = result.path;
        }
        throw err;
      }
    }
    ;

    /**
     * @namespace Match
     * @summary The namespace for all Match types and methods.
     */
    const Match = {
      Optional: function (pattern) {
        return new Optional(pattern);
      },
      Maybe: function (pattern) {
        return new Maybe(pattern);
      },
      OneOf: function () {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        return new OneOf(args);
      },
      Any: ['__any__'],
      Where: function (condition) {
        return new Where(condition);
      },
      ObjectIncluding: function (pattern) {
        return new ObjectIncluding(pattern);
      },
      ObjectWithValues: function (pattern) {
        return new ObjectWithValues(pattern);
      },
      // Matches only signed 32-bit integers
      Integer: ['__integer__'],
      // XXX matchers should know how to describe themselves for errors
      Error: Meteor.makeErrorType('Match.Error', function (msg) {
        this.message = "Match error: ".concat(msg);

        // The path of the value that failed to match. Initially empty, this gets
        // populated by catching and rethrowing the exception as it goes back up the
        // stack.
        // E.g.: "vals[3].entity.created"
        this.path = '';

        // If this gets sent over DDP, don't give full internal details but at least
        // provide something better than 500 Internal server error.
        this.sanitizedError = new Meteor.Error(400, 'Match failed');
      }),
      // Tests to see if value matches pattern. Unlike check, it merely returns true
      // or false (unless an error other than Match.Error was thrown). It does not
      // interact with _failIfArgumentsAreNotAllChecked.
      // XXX maybe also implement a Match.match which returns more information about
      //     failures but without using exception handling or doing what check()
      //     does with _failIfArgumentsAreNotAllChecked and Meteor.Error conversion

      /**
       * @summary Returns true if the value matches the pattern.
       * @locus Anywhere
       * @param {Any} value The value to check
       * @param {MatchPattern} pattern The pattern to match `value` against
       */
      test(value, pattern) {
        return !testSubtree(value, pattern);
      },
      // Runs `f.apply(context, args)`. If check() is not called on every element of
      // `args` (either directly or in the first level of an array), throws an error
      // (using `description` in the message).
      _failIfArgumentsAreNotAllChecked(f, context, args, description) {
        const argChecker = new ArgumentChecker(args, description);
        const result = currentArgumentChecker.withValue(argChecker, () => f.apply(context, args));

        // If f didn't itself throw, make sure it checked all of its arguments.
        argChecker.throwUnlessAllArgumentsHaveBeenChecked();
        return result;
      }
    };
    class Optional {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class Maybe {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class OneOf {
      constructor(choices) {
        if (!choices || choices.length === 0) {
          throw new Error('Must provide at least one choice to Match.OneOf');
        }
        this.choices = choices;
      }
    }
    class Where {
      constructor(condition) {
        this.condition = condition;
      }
    }
    class ObjectIncluding {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    class ObjectWithValues {
      constructor(pattern) {
        this.pattern = pattern;
      }
    }
    const stringForErrorMessage = function (value) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (value === null) {
        return 'null';
      }
      if (options.onlyShowType) {
        return typeof value;
      }

      // Your average non-object things.  Saves from doing the try/catch below for.
      if (typeof value !== 'object') {
        return EJSON.stringify(value);
      }
      try {
        // Find objects with circular references since EJSON doesn't support them yet (Issue #4778 + Unaccepted PR)
        // If the native stringify is going to choke, EJSON.stringify is going to choke too.
        JSON.stringify(value);
      } catch (stringifyError) {
        if (stringifyError.name === 'TypeError') {
          return typeof value;
        }
      }
      return EJSON.stringify(value);
    };
    const typeofChecks = [[String, 'string'], [Number, 'number'], [Boolean, 'boolean'],
    // While we don't allow undefined/function in EJSON, this is good for optional
    // arguments with OneOf.
    [Function, 'function'], [undefined, 'undefined']];

    // Return `false` if it matches. Otherwise, return an object with a `message` and a `path` field.
    const testSubtree = (value, pattern) => {
      // Match anything!
      if (pattern === Match.Any) {
        return false;
      }

      // Basic atomic types.
      // Do not match boxed objects (e.g. String, Boolean)
      for (let i = 0; i < typeofChecks.length; ++i) {
        if (pattern === typeofChecks[i][0]) {
          if (typeof value === typeofChecks[i][1]) {
            return false;
          }
          return {
            message: "Expected ".concat(typeofChecks[i][1], ", got ").concat(stringForErrorMessage(value, {
              onlyShowType: true
            })),
            path: ''
          };
        }
      }
      if (pattern === null) {
        if (value === null) {
          return false;
        }
        return {
          message: "Expected null, got ".concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // Strings, numbers, and booleans match literally. Goes well with Match.OneOf.
      if (typeof pattern === 'string' || typeof pattern === 'number' || typeof pattern === 'boolean') {
        if (value === pattern) {
          return false;
        }
        return {
          message: "Expected ".concat(pattern, ", got ").concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // Match.Integer is special type encoded with array
      if (pattern === Match.Integer) {
        // There is no consistent and reliable way to check if variable is a 64-bit
        // integer. One of the popular solutions is to get reminder of division by 1
        // but this method fails on really large floats with big precision.
        // E.g.: 1.348192308491824e+23 % 1 === 0 in V8
        // Bitwise operators work consistantly but always cast variable to 32-bit
        // signed integer according to JavaScript specs.
        if (typeof value === 'number' && (value | 0) === value) {
          return false;
        }
        return {
          message: "Expected Integer, got ".concat(stringForErrorMessage(value)),
          path: ''
        };
      }

      // 'Object' is shorthand for Match.ObjectIncluding({});
      if (pattern === Object) {
        pattern = Match.ObjectIncluding({});
      }

      // Array (checked AFTER Any, which is implemented as an Array).
      if (pattern instanceof Array) {
        if (pattern.length !== 1) {
          return {
            message: "Bad pattern: arrays must have one type element ".concat(stringForErrorMessage(pattern)),
            path: ''
          };
        }
        if (!Array.isArray(value) && !isArguments(value)) {
          return {
            message: "Expected array, got ".concat(stringForErrorMessage(value)),
            path: ''
          };
        }
        for (let i = 0, length = value.length; i < length; i++) {
          const result = testSubtree(value[i], pattern[0]);
          if (result) {
            result.path = _prependPath(i, result.path);
            return result;
          }
        }
        return false;
      }

      // Arbitrary validation checks. The condition can return false or throw a
      // Match.Error (ie, it can internally use check()) to fail.
      if (pattern instanceof Where) {
        let result;
        try {
          result = pattern.condition(value);
        } catch (err) {
          if (!(err instanceof Match.Error)) {
            throw err;
          }
          return {
            message: err.message,
            path: err.path
          };
        }
        if (result) {
          return false;
        }

        // XXX this error is terrible
        return {
          message: 'Failed Match.Where validation',
          path: ''
        };
      }
      if (pattern instanceof Maybe) {
        pattern = Match.OneOf(undefined, null, pattern.pattern);
      } else if (pattern instanceof Optional) {
        pattern = Match.OneOf(undefined, pattern.pattern);
      }
      if (pattern instanceof OneOf) {
        for (let i = 0; i < pattern.choices.length; ++i) {
          const result = testSubtree(value, pattern.choices[i]);
          if (!result) {
            // No error? Yay, return.
            return false;
          }

          // Match errors just mean try another choice.
        }

        // XXX this error is terrible
        return {
          message: 'Failed Match.OneOf, Match.Maybe or Match.Optional validation',
          path: ''
        };
      }

      // A function that isn't something we special-case is assumed to be a
      // constructor.
      if (pattern instanceof Function) {
        if (value instanceof pattern) {
          return false;
        }
        return {
          message: "Expected ".concat(pattern.name || 'particular constructor'),
          path: ''
        };
      }
      let unknownKeysAllowed = false;
      let unknownKeyPattern;
      if (pattern instanceof ObjectIncluding) {
        unknownKeysAllowed = true;
        pattern = pattern.pattern;
      }
      if (pattern instanceof ObjectWithValues) {
        unknownKeysAllowed = true;
        unknownKeyPattern = [pattern.pattern];
        pattern = {}; // no required keys
      }
      if (typeof pattern !== 'object') {
        return {
          message: 'Bad pattern: unknown pattern type',
          path: ''
        };
      }

      // An object, with required and optional keys. Note that this does NOT do
      // structural matches against objects of special types that happen to match
      // the pattern: this really needs to be a plain old {Object}!
      if (typeof value !== 'object') {
        return {
          message: "Expected object, got ".concat(typeof value),
          path: ''
        };
      }
      if (value === null) {
        return {
          message: "Expected object, got null",
          path: ''
        };
      }
      if (!isPlainObject(value)) {
        return {
          message: "Expected plain object",
          path: ''
        };
      }
      const requiredPatterns = Object.create(null);
      const optionalPatterns = Object.create(null);
      Object.keys(pattern).forEach(key => {
        const subPattern = pattern[key];
        if (subPattern instanceof Optional || subPattern instanceof Maybe) {
          optionalPatterns[key] = subPattern.pattern;
        } else {
          requiredPatterns[key] = subPattern;
        }
      });
      for (let key in Object(value)) {
        const subValue = value[key];
        if (hasOwn.call(requiredPatterns, key)) {
          const result = testSubtree(subValue, requiredPatterns[key]);
          if (result) {
            result.path = _prependPath(key, result.path);
            return result;
          }
          delete requiredPatterns[key];
        } else if (hasOwn.call(optionalPatterns, key)) {
          const result = testSubtree(subValue, optionalPatterns[key]);
          if (result) {
            result.path = _prependPath(key, result.path);
            return result;
          }
        } else {
          if (!unknownKeysAllowed) {
            return {
              message: 'Unknown key',
              path: key
            };
          }
          if (unknownKeyPattern) {
            const result = testSubtree(subValue, unknownKeyPattern[0]);
            if (result) {
              result.path = _prependPath(key, result.path);
              return result;
            }
          }
        }
      }
      const keys = Object.keys(requiredPatterns);
      if (keys.length) {
        return {
          message: "Missing key '".concat(keys[0], "'"),
          path: ''
        };
      }
    };
    class ArgumentChecker {
      constructor(args, description) {
        // Make a SHALLOW copy of the arguments. (We'll be doing identity checks
        // against its contents.)
        this.args = [...args];

        // Since the common case will be to check arguments in order, and we splice
        // out arguments when we check them, make it so we splice out from the end
        // rather than the beginning.
        this.args.reverse();
        this.description = description;
      }
      checking(value) {
        if (this._checkingOneValue(value)) {
          return;
        }

        // Allow check(arguments, [String]) or check(arguments.slice(1), [String])
        // or check([foo, bar], [String]) to count... but only if value wasn't
        // itself an argument.
        if (Array.isArray(value) || isArguments(value)) {
          Array.prototype.forEach.call(value, this._checkingOneValue.bind(this));
        }
      }
      _checkingOneValue(value) {
        for (let i = 0; i < this.args.length; ++i) {
          // Is this value one of the arguments? (This can have a false positive if
          // the argument is an interned primitive, but it's still a good enough
          // check.)
          // (NaN is not === to itself, so we have to check specially.)
          if (value === this.args[i] || Number.isNaN(value) && Number.isNaN(this.args[i])) {
            this.args.splice(i, 1);
            return true;
          }
        }
        return false;
      }
      throwUnlessAllArgumentsHaveBeenChecked() {
        if (this.args.length > 0) throw new Error("Did not check() all arguments during ".concat(this.description));
      }
    }
    const _jsKeywords = ['do', 'if', 'in', 'for', 'let', 'new', 'try', 'var', 'case', 'else', 'enum', 'eval', 'false', 'null', 'this', 'true', 'void', 'with', 'break', 'catch', 'class', 'const', 'super', 'throw', 'while', 'yield', 'delete', 'export', 'import', 'public', 'return', 'static', 'switch', 'typeof', 'default', 'extends', 'finally', 'package', 'private', 'continue', 'debugger', 'function', 'arguments', 'interface', 'protected', 'implements', 'instanceof'];

    // Assumes the base of path is already escaped properly
    // returns key + base
    const _prependPath = (key, base) => {
      if (typeof key === 'number' || key.match(/^[0-9]+$/)) {
        key = "[".concat(key, "]");
      } else if (!key.match(/^[a-z_$][0-9a-z_$]*$/i) || _jsKeywords.indexOf(key) >= 0) {
        key = JSON.stringify([key]);
      }
      if (base && base[0] !== '[') {
        return "".concat(key, ".").concat(base);
      }
      return key + base;
    };
    const isObject = value => typeof value === 'object' && value !== null;
    const baseIsArguments = item => isObject(item) && Object.prototype.toString.call(item) === '[object Arguments]';
    const isArguments = baseIsArguments(function () {
      return arguments;
    }()) ? baseIsArguments : value => isObject(value) && typeof value.callee === 'function';
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

},"isPlainObject.js":function module(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                   //
// packages/check/isPlainObject.js                                                                                   //
//                                                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                     //
module.export({
  isPlainObject: () => isPlainObject
});
// Copy of jQuery.isPlainObject for the server side from jQuery v3.1.1.

const class2type = {};
const toString = class2type.toString;
const hasOwn = Object.prototype.hasOwnProperty;
const fnToString = hasOwn.toString;
const ObjectFunctionString = fnToString.call(Object);
const getProto = Object.getPrototypeOf;
const isPlainObject = obj => {
  let proto;
  let Ctor;

  // Detect obvious negatives
  // Use toString instead of jQuery.type to catch host objects
  if (!obj || toString.call(obj) !== '[object Object]') {
    return false;
  }
  proto = getProto(obj);

  // Objects with no prototype (e.g., `Object.create( null )`) are plain
  if (!proto) {
    return true;
  }

  // Objects with prototype are plain iff they were constructed by a global Object function
  Ctor = hasOwn.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor === 'function' && fnToString.call(Ctor) === ObjectFunctionString;
};
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
      check: check,
      Match: Match
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/check/match.js"
  ],
  mainModulePath: "/node_modules/meteor/check/match.js"
}});

//# sourceURL=meteor://💻app/packages/check.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvY2hlY2svbWF0Y2guanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2NoZWNrL2lzUGxhaW5PYmplY3QuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiY2hlY2siLCJNYXRjaCIsImlzUGxhaW5PYmplY3QiLCJsaW5rIiwidiIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiY3VycmVudEFyZ3VtZW50Q2hlY2tlciIsIk1ldGVvciIsIkVudmlyb25tZW50VmFyaWFibGUiLCJoYXNPd24iLCJPYmplY3QiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsInZhbHVlIiwicGF0dGVybiIsImFyZ0NoZWNrZXIiLCJnZXRPck51bGxJZk91dHNpZGVGaWJlciIsImNoZWNraW5nIiwicmVzdWx0IiwidGVzdFN1YnRyZWUiLCJlcnIiLCJFcnJvciIsIm1lc3NhZ2UiLCJwYXRoIiwiY29uY2F0IiwiT3B0aW9uYWwiLCJNYXliZSIsIk9uZU9mIiwiX2xlbiIsImFyZ3VtZW50cyIsImxlbmd0aCIsImFyZ3MiLCJBcnJheSIsIl9rZXkiLCJBbnkiLCJXaGVyZSIsImNvbmRpdGlvbiIsIk9iamVjdEluY2x1ZGluZyIsIk9iamVjdFdpdGhWYWx1ZXMiLCJJbnRlZ2VyIiwibWFrZUVycm9yVHlwZSIsIm1zZyIsInNhbml0aXplZEVycm9yIiwidGVzdCIsIl9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkIiwiZiIsImNvbnRleHQiLCJkZXNjcmlwdGlvbiIsIkFyZ3VtZW50Q2hlY2tlciIsIndpdGhWYWx1ZSIsImFwcGx5IiwidGhyb3dVbmxlc3NBbGxBcmd1bWVudHNIYXZlQmVlbkNoZWNrZWQiLCJjb25zdHJ1Y3RvciIsImNob2ljZXMiLCJzdHJpbmdGb3JFcnJvck1lc3NhZ2UiLCJvcHRpb25zIiwidW5kZWZpbmVkIiwib25seVNob3dUeXBlIiwiRUpTT04iLCJzdHJpbmdpZnkiLCJKU09OIiwic3RyaW5naWZ5RXJyb3IiLCJuYW1lIiwidHlwZW9mQ2hlY2tzIiwiU3RyaW5nIiwiTnVtYmVyIiwiQm9vbGVhbiIsIkZ1bmN0aW9uIiwiaSIsImlzQXJyYXkiLCJpc0FyZ3VtZW50cyIsIl9wcmVwZW5kUGF0aCIsInVua25vd25LZXlzQWxsb3dlZCIsInVua25vd25LZXlQYXR0ZXJuIiwicmVxdWlyZWRQYXR0ZXJucyIsImNyZWF0ZSIsIm9wdGlvbmFsUGF0dGVybnMiLCJrZXlzIiwiZm9yRWFjaCIsImtleSIsInN1YlBhdHRlcm4iLCJzdWJWYWx1ZSIsImNhbGwiLCJyZXZlcnNlIiwiX2NoZWNraW5nT25lVmFsdWUiLCJiaW5kIiwiaXNOYU4iLCJzcGxpY2UiLCJfanNLZXl3b3JkcyIsImJhc2UiLCJtYXRjaCIsImluZGV4T2YiLCJpc09iamVjdCIsImJhc2VJc0FyZ3VtZW50cyIsIml0ZW0iLCJ0b1N0cmluZyIsImNhbGxlZSIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsInNlbGYiLCJhc3luYyIsImNsYXNzMnR5cGUiLCJmblRvU3RyaW5nIiwiT2JqZWN0RnVuY3Rpb25TdHJpbmciLCJnZXRQcm90byIsImdldFByb3RvdHlwZU9mIiwib2JqIiwicHJvdG8iLCJDdG9yIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFBQUEsTUFBTSxDQUFDQyxNQUFNLENBQUM7TUFBQ0MsS0FBSyxFQUFDQSxDQUFBLEtBQUlBLEtBQUs7TUFBQ0MsS0FBSyxFQUFDQSxDQUFBLEtBQUlBO0lBQUssQ0FBQyxDQUFDO0lBQUMsSUFBSUMsYUFBYTtJQUFDSixNQUFNLENBQUNLLElBQUksQ0FBQyxpQkFBaUIsRUFBQztNQUFDRCxhQUFhQSxDQUFDRSxDQUFDLEVBQUM7UUFBQ0YsYUFBYSxHQUFDRSxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUMsb0JBQW9CLENBQUMsQ0FBQyxFQUFFLENBQUMsTUFBTUEsb0JBQW9CLENBQUMsQ0FBQyxFQUFF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O0lBQ3BELE9BQU8sS0FBSztFQUNkO0VBRUFDLEtBQUssR0FBR0gsUUFBUSxDQUFDRSxHQUFHLENBQUM7O0VBRXJCO0VBQ0EsSUFBSSxDQUFDQyxLQUFLLEVBQUU7SUFDVixPQUFPLElBQUk7RUFDYjs7RUFFQTtFQUNBQyxJQUFJLEdBQUduRyxNQUFNLENBQUN5RSxJQUFJLENBQUN5QixLQUFLLEVBQUUsYUFBYSxDQUFDLElBQUlBLEtBQUssQ0FBQ3ZELFdBQVc7RUFDN0QsT0FBTyxPQUFPd0QsSUFBSSxLQUFLLFVBQVUsSUFDL0JOLFVBQVUsQ0FBQ3BCLElBQUksQ0FBQzBCLElBQUksQ0FBQyxLQUFLTCxvQkFBb0I7QUFDbEQsQ0FBQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9jaGVjay5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8vIFhYWCBkb2NzXG5pbXBvcnQgeyBpc1BsYWluT2JqZWN0IH0gZnJvbSAnLi9pc1BsYWluT2JqZWN0JztcblxuLy8gVGhpbmdzIHdlIGV4cGxpY2l0bHkgZG8gTk9UIHN1cHBvcnQ6XG4vLyAgICAtIGhldGVyb2dlbm91cyBhcnJheXNcblxuY29uc3QgY3VycmVudEFyZ3VtZW50Q2hlY2tlciA9IG5ldyBNZXRlb3IuRW52aXJvbm1lbnRWYXJpYWJsZTtcbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbi8qKlxuICogQHN1bW1hcnkgQ2hlY2sgdGhhdCBhIHZhbHVlIG1hdGNoZXMgYSBbcGF0dGVybl0oI21hdGNocGF0dGVybnMpLlxuICogSWYgdGhlIHZhbHVlIGRvZXMgbm90IG1hdGNoIHRoZSBwYXR0ZXJuLCB0aHJvdyBhIGBNYXRjaC5FcnJvcmAuXG4gKlxuICogUGFydGljdWxhcmx5IHVzZWZ1bCB0byBhc3NlcnQgdGhhdCBhcmd1bWVudHMgdG8gYSBmdW5jdGlvbiBoYXZlIHRoZSByaWdodFxuICogdHlwZXMgYW5kIHN0cnVjdHVyZS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQHBhcmFtIHtBbnl9IHZhbHVlIFRoZSB2YWx1ZSB0byBjaGVja1xuICogQHBhcmFtIHtNYXRjaFBhdHRlcm59IHBhdHRlcm4gVGhlIHBhdHRlcm4gdG8gbWF0Y2ggYHZhbHVlYCBhZ2FpbnN0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjaGVjayh2YWx1ZSwgcGF0dGVybikge1xuICAvLyBSZWNvcmQgdGhhdCBjaGVjayBnb3QgY2FsbGVkLCBpZiBzb21lYm9keSBjYXJlZC5cbiAgLy9cbiAgLy8gV2UgdXNlIGdldE9yTnVsbElmT3V0c2lkZUZpYmVyIHNvIHRoYXQgaXQncyBPSyB0byBjYWxsIGNoZWNrKClcbiAgLy8gZnJvbSBub24tRmliZXIgc2VydmVyIGNvbnRleHRzOyB0aGUgZG93bnNpZGUgaXMgdGhhdCBpZiB5b3UgZm9yZ2V0IHRvXG4gIC8vIGJpbmRFbnZpcm9ubWVudCBvbiBzb21lIHJhbmRvbSBjYWxsYmFjayBpbiB5b3VyIG1ldGhvZC9wdWJsaXNoZXIsXG4gIC8vIGl0IG1pZ2h0IG5vdCBmaW5kIHRoZSBhcmd1bWVudENoZWNrZXIgYW5kIHlvdSdsbCBnZXQgYW4gZXJyb3IgYWJvdXRcbiAgLy8gbm90IGNoZWNraW5nIGFuIGFyZ3VtZW50IHRoYXQgaXQgbG9va3MgbGlrZSB5b3UncmUgY2hlY2tpbmcgKGluc3RlYWRcbiAgLy8gb2YganVzdCBnZXR0aW5nIGEgXCJOb2RlIGNvZGUgbXVzdCBydW4gaW4gYSBGaWJlclwiIGVycm9yKS5cbiAgY29uc3QgYXJnQ2hlY2tlciA9IGN1cnJlbnRBcmd1bWVudENoZWNrZXIuZ2V0T3JOdWxsSWZPdXRzaWRlRmliZXIoKTtcbiAgaWYgKGFyZ0NoZWNrZXIpIHtcbiAgICBhcmdDaGVja2VyLmNoZWNraW5nKHZhbHVlKTtcbiAgfVxuXG4gIGNvbnN0IHJlc3VsdCA9IHRlc3RTdWJ0cmVlKHZhbHVlLCBwYXR0ZXJuKTtcbiAgaWYgKHJlc3VsdCkge1xuICAgIGNvbnN0IGVyciA9IG5ldyBNYXRjaC5FcnJvcihyZXN1bHQubWVzc2FnZSk7XG4gICAgaWYgKHJlc3VsdC5wYXRoKSB7XG4gICAgICBlcnIubWVzc2FnZSArPSBgIGluIGZpZWxkICR7cmVzdWx0LnBhdGh9YDtcbiAgICAgIGVyci5wYXRoID0gcmVzdWx0LnBhdGg7XG4gICAgfVxuXG4gICAgdGhyb3cgZXJyO1xuICB9XG59O1xuXG4vKipcbiAqIEBuYW1lc3BhY2UgTWF0Y2hcbiAqIEBzdW1tYXJ5IFRoZSBuYW1lc3BhY2UgZm9yIGFsbCBNYXRjaCB0eXBlcyBhbmQgbWV0aG9kcy5cbiAqL1xuZXhwb3J0IGNvbnN0IE1hdGNoID0ge1xuICBPcHRpb25hbDogZnVuY3Rpb24ocGF0dGVybikge1xuICAgIHJldHVybiBuZXcgT3B0aW9uYWwocGF0dGVybik7XG4gIH0sXG5cbiAgTWF5YmU6IGZ1bmN0aW9uKHBhdHRlcm4pIHtcbiAgICByZXR1cm4gbmV3IE1heWJlKHBhdHRlcm4pO1xuICB9LFxuXG4gIE9uZU9mOiBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgcmV0dXJuIG5ldyBPbmVPZihhcmdzKTtcbiAgfSxcblxuICBBbnk6IFsnX19hbnlfXyddLFxuICBXaGVyZTogZnVuY3Rpb24oY29uZGl0aW9uKSB7XG4gICAgcmV0dXJuIG5ldyBXaGVyZShjb25kaXRpb24pO1xuICB9LFxuXG4gIE9iamVjdEluY2x1ZGluZzogZnVuY3Rpb24ocGF0dGVybikge1xuICAgIHJldHVybiBuZXcgT2JqZWN0SW5jbHVkaW5nKHBhdHRlcm4pXG4gIH0sXG5cbiAgT2JqZWN0V2l0aFZhbHVlczogZnVuY3Rpb24ocGF0dGVybikge1xuICAgIHJldHVybiBuZXcgT2JqZWN0V2l0aFZhbHVlcyhwYXR0ZXJuKTtcbiAgfSxcblxuICAvLyBNYXRjaGVzIG9ubHkgc2lnbmVkIDMyLWJpdCBpbnRlZ2Vyc1xuICBJbnRlZ2VyOiBbJ19faW50ZWdlcl9fJ10sXG5cbiAgLy8gWFhYIG1hdGNoZXJzIHNob3VsZCBrbm93IGhvdyB0byBkZXNjcmliZSB0aGVtc2VsdmVzIGZvciBlcnJvcnNcbiAgRXJyb3I6IE1ldGVvci5tYWtlRXJyb3JUeXBlKCdNYXRjaC5FcnJvcicsIGZ1bmN0aW9uIChtc2cpIHtcbiAgICB0aGlzLm1lc3NhZ2UgPSBgTWF0Y2ggZXJyb3I6ICR7bXNnfWA7XG5cbiAgICAvLyBUaGUgcGF0aCBvZiB0aGUgdmFsdWUgdGhhdCBmYWlsZWQgdG8gbWF0Y2guIEluaXRpYWxseSBlbXB0eSwgdGhpcyBnZXRzXG4gICAgLy8gcG9wdWxhdGVkIGJ5IGNhdGNoaW5nIGFuZCByZXRocm93aW5nIHRoZSBleGNlcHRpb24gYXMgaXQgZ29lcyBiYWNrIHVwIHRoZVxuICAgIC8vIHN0YWNrLlxuICAgIC8vIEUuZy46IFwidmFsc1szXS5lbnRpdHkuY3JlYXRlZFwiXG4gICAgdGhpcy5wYXRoID0gJyc7XG5cbiAgICAvLyBJZiB0aGlzIGdldHMgc2VudCBvdmVyIEREUCwgZG9uJ3QgZ2l2ZSBmdWxsIGludGVybmFsIGRldGFpbHMgYnV0IGF0IGxlYXN0XG4gICAgLy8gcHJvdmlkZSBzb21ldGhpbmcgYmV0dGVyIHRoYW4gNTAwIEludGVybmFsIHNlcnZlciBlcnJvci5cbiAgICB0aGlzLnNhbml0aXplZEVycm9yID0gbmV3IE1ldGVvci5FcnJvcig0MDAsICdNYXRjaCBmYWlsZWQnKTtcbiAgfSksXG5cbiAgLy8gVGVzdHMgdG8gc2VlIGlmIHZhbHVlIG1hdGNoZXMgcGF0dGVybi4gVW5saWtlIGNoZWNrLCBpdCBtZXJlbHkgcmV0dXJucyB0cnVlXG4gIC8vIG9yIGZhbHNlICh1bmxlc3MgYW4gZXJyb3Igb3RoZXIgdGhhbiBNYXRjaC5FcnJvciB3YXMgdGhyb3duKS4gSXQgZG9lcyBub3RcbiAgLy8gaW50ZXJhY3Qgd2l0aCBfZmFpbElmQXJndW1lbnRzQXJlTm90QWxsQ2hlY2tlZC5cbiAgLy8gWFhYIG1heWJlIGFsc28gaW1wbGVtZW50IGEgTWF0Y2gubWF0Y2ggd2hpY2ggcmV0dXJucyBtb3JlIGluZm9ybWF0aW9uIGFib3V0XG4gIC8vICAgICBmYWlsdXJlcyBidXQgd2l0aG91dCB1c2luZyBleGNlcHRpb24gaGFuZGxpbmcgb3IgZG9pbmcgd2hhdCBjaGVjaygpXG4gIC8vICAgICBkb2VzIHdpdGggX2ZhaWxJZkFyZ3VtZW50c0FyZU5vdEFsbENoZWNrZWQgYW5kIE1ldGVvci5FcnJvciBjb252ZXJzaW9uXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IFJldHVybnMgdHJ1ZSBpZiB0aGUgdmFsdWUgbWF0Y2hlcyB0aGUgcGF0dGVybi5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBwYXJhbSB7QW55fSB2YWx1ZSBUaGUgdmFsdWUgdG8gY2hlY2tcbiAgICogQHBhcmFtIHtNYXRjaFBhdHRlcm59IHBhdHRlcm4gVGhlIHBhdHRlcm4gdG8gbWF0Y2ggYHZhbHVlYCBhZ2FpbnN0XG4gICAqL1xuICB0ZXN0KHZhbHVlLCBwYXR0ZXJuKSB7XG4gICAgcmV0dXJuICF0ZXN0U3VidHJlZSh2YWx1ZSwgcGF0dGVybik7XG4gIH0sXG5cbiAgLy8gUnVucyBgZi5hcHBseShjb250ZXh0LCBhcmdzKWAuIElmIGNoZWNrKCkgaXMgbm90IGNhbGxlZCBvbiBldmVyeSBlbGVtZW50IG9mXG4gIC8vIGBhcmdzYCAoZWl0aGVyIGRpcmVjdGx5IG9yIGluIHRoZSBmaXJzdCBsZXZlbCBvZiBhbiBhcnJheSksIHRocm93cyBhbiBlcnJvclxuICAvLyAodXNpbmcgYGRlc2NyaXB0aW9uYCBpbiB0aGUgbWVzc2FnZSkuXG4gIF9mYWlsSWZBcmd1bWVudHNBcmVOb3RBbGxDaGVja2VkKGYsIGNvbnRleHQsIGFyZ3MsIGRlc2NyaXB0aW9uKSB7XG4gICAgY29uc3QgYXJnQ2hlY2tlciA9IG5ldyBBcmd1bWVudENoZWNrZXIoYXJncywgZGVzY3JpcHRpb24pO1xuICAgIGNvbnN0IHJlc3VsdCA9IGN1cnJlbnRBcmd1bWVudENoZWNrZXIud2l0aFZhbHVlKFxuICAgICAgYXJnQ2hlY2tlcixcbiAgICAgICgpID0+IGYuYXBwbHkoY29udGV4dCwgYXJncylcbiAgICApO1xuXG4gICAgLy8gSWYgZiBkaWRuJ3QgaXRzZWxmIHRocm93LCBtYWtlIHN1cmUgaXQgY2hlY2tlZCBhbGwgb2YgaXRzIGFyZ3VtZW50cy5cbiAgICBhcmdDaGVja2VyLnRocm93VW5sZXNzQWxsQXJndW1lbnRzSGF2ZUJlZW5DaGVja2VkKCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufTtcblxuY2xhc3MgT3B0aW9uYWwge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gcGF0dGVybjtcbiAgfVxufVxuXG5jbGFzcyBNYXliZSB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4pIHtcbiAgICB0aGlzLnBhdHRlcm4gPSBwYXR0ZXJuO1xuICB9XG59XG5cbmNsYXNzIE9uZU9mIHtcbiAgY29uc3RydWN0b3IoY2hvaWNlcykge1xuICAgIGlmICghY2hvaWNlcyB8fCBjaG9pY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdNdXN0IHByb3ZpZGUgYXQgbGVhc3Qgb25lIGNob2ljZSB0byBNYXRjaC5PbmVPZicpO1xuICAgIH1cblxuICAgIHRoaXMuY2hvaWNlcyA9IGNob2ljZXM7XG4gIH1cbn1cblxuY2xhc3MgV2hlcmUge1xuICBjb25zdHJ1Y3Rvcihjb25kaXRpb24pIHtcbiAgICB0aGlzLmNvbmRpdGlvbiA9IGNvbmRpdGlvbjtcbiAgfVxufVxuXG5jbGFzcyBPYmplY3RJbmNsdWRpbmcge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuKSB7XG4gICAgdGhpcy5wYXR0ZXJuID0gcGF0dGVybjtcbiAgfVxufVxuXG5jbGFzcyBPYmplY3RXaXRoVmFsdWVzIHtcbiAgY29uc3RydWN0b3IocGF0dGVybikge1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm47XG4gIH1cbn1cblxuY29uc3Qgc3RyaW5nRm9yRXJyb3JNZXNzYWdlID0gKHZhbHVlLCBvcHRpb25zID0ge30pID0+IHtcbiAgaWYgKCB2YWx1ZSA9PT0gbnVsbCApIHtcbiAgICByZXR1cm4gJ251bGwnO1xuICB9XG5cbiAgaWYgKCBvcHRpb25zLm9ubHlTaG93VHlwZSApIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlO1xuICB9XG5cbiAgLy8gWW91ciBhdmVyYWdlIG5vbi1vYmplY3QgdGhpbmdzLiAgU2F2ZXMgZnJvbSBkb2luZyB0aGUgdHJ5L2NhdGNoIGJlbG93IGZvci5cbiAgaWYgKCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnICkge1xuICAgIHJldHVybiBFSlNPTi5zdHJpbmdpZnkodmFsdWUpXG4gIH1cblxuICB0cnkge1xuXG4gICAgLy8gRmluZCBvYmplY3RzIHdpdGggY2lyY3VsYXIgcmVmZXJlbmNlcyBzaW5jZSBFSlNPTiBkb2Vzbid0IHN1cHBvcnQgdGhlbSB5ZXQgKElzc3VlICM0Nzc4ICsgVW5hY2NlcHRlZCBQUilcbiAgICAvLyBJZiB0aGUgbmF0aXZlIHN0cmluZ2lmeSBpcyBnb2luZyB0byBjaG9rZSwgRUpTT04uc3RyaW5naWZ5IGlzIGdvaW5nIHRvIGNob2tlIHRvby5cbiAgICBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG4gIH0gY2F0Y2ggKHN0cmluZ2lmeUVycm9yKSB7XG4gICAgaWYgKCBzdHJpbmdpZnlFcnJvci5uYW1lID09PSAnVHlwZUVycm9yJyApIHtcbiAgICAgIHJldHVybiB0eXBlb2YgdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIEVKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG59O1xuXG5jb25zdCB0eXBlb2ZDaGVja3MgPSBbXG4gIFtTdHJpbmcsICdzdHJpbmcnXSxcbiAgW051bWJlciwgJ251bWJlciddLFxuICBbQm9vbGVhbiwgJ2Jvb2xlYW4nXSxcblxuICAvLyBXaGlsZSB3ZSBkb24ndCBhbGxvdyB1bmRlZmluZWQvZnVuY3Rpb24gaW4gRUpTT04sIHRoaXMgaXMgZ29vZCBmb3Igb3B0aW9uYWxcbiAgLy8gYXJndW1lbnRzIHdpdGggT25lT2YuXG4gIFtGdW5jdGlvbiwgJ2Z1bmN0aW9uJ10sXG4gIFt1bmRlZmluZWQsICd1bmRlZmluZWQnXSxcbl07XG5cbi8vIFJldHVybiBgZmFsc2VgIGlmIGl0IG1hdGNoZXMuIE90aGVyd2lzZSwgcmV0dXJuIGFuIG9iamVjdCB3aXRoIGEgYG1lc3NhZ2VgIGFuZCBhIGBwYXRoYCBmaWVsZC5cbmNvbnN0IHRlc3RTdWJ0cmVlID0gKHZhbHVlLCBwYXR0ZXJuKSA9PiB7XG5cbiAgLy8gTWF0Y2ggYW55dGhpbmchXG4gIGlmIChwYXR0ZXJuID09PSBNYXRjaC5BbnkpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBCYXNpYyBhdG9taWMgdHlwZXMuXG4gIC8vIERvIG5vdCBtYXRjaCBib3hlZCBvYmplY3RzIChlLmcuIFN0cmluZywgQm9vbGVhbilcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0eXBlb2ZDaGVja3MubGVuZ3RoOyArK2kpIHtcbiAgICBpZiAocGF0dGVybiA9PT0gdHlwZW9mQ2hlY2tzW2ldWzBdKSB7XG4gICAgICBpZiAodHlwZW9mIHZhbHVlID09PSB0eXBlb2ZDaGVja3NbaV1bMV0pIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgJHt0eXBlb2ZDaGVja3NbaV1bMV19LCBnb3QgJHtzdHJpbmdGb3JFcnJvck1lc3NhZ2UodmFsdWUsIHsgb25seVNob3dUeXBlOiB0cnVlIH0pfWAsXG4gICAgICAgIHBhdGg6ICcnLFxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICBpZiAocGF0dGVybiA9PT0gbnVsbCkge1xuICAgIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgbnVsbCwgZ290ICR7c3RyaW5nRm9yRXJyb3JNZXNzYWdlKHZhbHVlKX1gLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIC8vIFN0cmluZ3MsIG51bWJlcnMsIGFuZCBib29sZWFucyBtYXRjaCBsaXRlcmFsbHkuIEdvZXMgd2VsbCB3aXRoIE1hdGNoLk9uZU9mLlxuICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBwYXR0ZXJuID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgcGF0dGVybiA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgaWYgKHZhbHVlID09PSBwYXR0ZXJuKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCAke3BhdHRlcm59LCBnb3QgJHtzdHJpbmdGb3JFcnJvck1lc3NhZ2UodmFsdWUpfWAsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gTWF0Y2guSW50ZWdlciBpcyBzcGVjaWFsIHR5cGUgZW5jb2RlZCB3aXRoIGFycmF5XG4gIGlmIChwYXR0ZXJuID09PSBNYXRjaC5JbnRlZ2VyKSB7XG5cbiAgICAvLyBUaGVyZSBpcyBubyBjb25zaXN0ZW50IGFuZCByZWxpYWJsZSB3YXkgdG8gY2hlY2sgaWYgdmFyaWFibGUgaXMgYSA2NC1iaXRcbiAgICAvLyBpbnRlZ2VyLiBPbmUgb2YgdGhlIHBvcHVsYXIgc29sdXRpb25zIGlzIHRvIGdldCByZW1pbmRlciBvZiBkaXZpc2lvbiBieSAxXG4gICAgLy8gYnV0IHRoaXMgbWV0aG9kIGZhaWxzIG9uIHJlYWxseSBsYXJnZSBmbG9hdHMgd2l0aCBiaWcgcHJlY2lzaW9uLlxuICAgIC8vIEUuZy46IDEuMzQ4MTkyMzA4NDkxODI0ZSsyMyAlIDEgPT09IDAgaW4gVjhcbiAgICAvLyBCaXR3aXNlIG9wZXJhdG9ycyB3b3JrIGNvbnNpc3RhbnRseSBidXQgYWx3YXlzIGNhc3QgdmFyaWFibGUgdG8gMzItYml0XG4gICAgLy8gc2lnbmVkIGludGVnZXIgYWNjb3JkaW5nIHRvIEphdmFTY3JpcHQgc3BlY3MuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgKHZhbHVlIHwgMCkgPT09IHZhbHVlKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCBJbnRlZ2VyLCBnb3QgJHtzdHJpbmdGb3JFcnJvck1lc3NhZ2UodmFsdWUpfWAsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgLy8gJ09iamVjdCcgaXMgc2hvcnRoYW5kIGZvciBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe30pO1xuICBpZiAocGF0dGVybiA9PT0gT2JqZWN0KSB7XG4gICAgcGF0dGVybiA9IE1hdGNoLk9iamVjdEluY2x1ZGluZyh7fSk7XG4gIH1cblxuICAvLyBBcnJheSAoY2hlY2tlZCBBRlRFUiBBbnksIHdoaWNoIGlzIGltcGxlbWVudGVkIGFzIGFuIEFycmF5KS5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBBcnJheSkge1xuICAgIGlmIChwYXR0ZXJuLmxlbmd0aCAhPT0gMSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWVzc2FnZTogYEJhZCBwYXR0ZXJuOiBhcnJheXMgbXVzdCBoYXZlIG9uZSB0eXBlIGVsZW1lbnQgJHtzdHJpbmdGb3JFcnJvck1lc3NhZ2UocGF0dGVybil9YCxcbiAgICAgICAgcGF0aDogJycsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgIWlzQXJndW1lbnRzKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWVzc2FnZTogYEV4cGVjdGVkIGFycmF5LCBnb3QgJHtzdHJpbmdGb3JFcnJvck1lc3NhZ2UodmFsdWUpfWAsXG4gICAgICAgIHBhdGg6ICcnLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMCwgbGVuZ3RoID0gdmFsdWUubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRlc3RTdWJ0cmVlKHZhbHVlW2ldLCBwYXR0ZXJuWzBdKTtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgcmVzdWx0LnBhdGggPSBfcHJlcGVuZFBhdGgoaSwgcmVzdWx0LnBhdGgpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIEFyYml0cmFyeSB2YWxpZGF0aW9uIGNoZWNrcy4gVGhlIGNvbmRpdGlvbiBjYW4gcmV0dXJuIGZhbHNlIG9yIHRocm93IGFcbiAgLy8gTWF0Y2guRXJyb3IgKGllLCBpdCBjYW4gaW50ZXJuYWxseSB1c2UgY2hlY2soKSkgdG8gZmFpbC5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBXaGVyZSkge1xuICAgIGxldCByZXN1bHQ7XG4gICAgdHJ5IHtcbiAgICAgIHJlc3VsdCA9IHBhdHRlcm4uY29uZGl0aW9uKHZhbHVlKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGlmICghKGVyciBpbnN0YW5jZW9mIE1hdGNoLkVycm9yKSkge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2U6IGVyci5tZXNzYWdlLFxuICAgICAgICBwYXRoOiBlcnIucGF0aFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBpZiAocmVzdWx0KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gWFhYIHRoaXMgZXJyb3IgaXMgdGVycmlibGVcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogJ0ZhaWxlZCBNYXRjaC5XaGVyZSB2YWxpZGF0aW9uJyxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICBpZiAocGF0dGVybiBpbnN0YW5jZW9mIE1heWJlKSB7XG4gICAgcGF0dGVybiA9IE1hdGNoLk9uZU9mKHVuZGVmaW5lZCwgbnVsbCwgcGF0dGVybi5wYXR0ZXJuKTtcbiAgfSBlbHNlIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgT3B0aW9uYWwpIHtcbiAgICBwYXR0ZXJuID0gTWF0Y2guT25lT2YodW5kZWZpbmVkLCBwYXR0ZXJuLnBhdHRlcm4pO1xuICB9XG5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBPbmVPZikge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0dGVybi5jaG9pY2VzLmxlbmd0aDsgKytpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZSh2YWx1ZSwgcGF0dGVybi5jaG9pY2VzW2ldKTtcbiAgICAgIGlmICghcmVzdWx0KSB7XG5cbiAgICAgICAgLy8gTm8gZXJyb3I/IFlheSwgcmV0dXJuLlxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIC8vIE1hdGNoIGVycm9ycyBqdXN0IG1lYW4gdHJ5IGFub3RoZXIgY2hvaWNlLlxuICAgIH1cblxuICAgIC8vIFhYWCB0aGlzIGVycm9yIGlzIHRlcnJpYmxlXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6ICdGYWlsZWQgTWF0Y2guT25lT2YsIE1hdGNoLk1heWJlIG9yIE1hdGNoLk9wdGlvbmFsIHZhbGlkYXRpb24nLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIC8vIEEgZnVuY3Rpb24gdGhhdCBpc24ndCBzb21ldGhpbmcgd2Ugc3BlY2lhbC1jYXNlIGlzIGFzc3VtZWQgdG8gYmUgYVxuICAvLyBjb25zdHJ1Y3Rvci5cbiAgaWYgKHBhdHRlcm4gaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIHBhdHRlcm4pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYEV4cGVjdGVkICR7cGF0dGVybi5uYW1lIHx8ICdwYXJ0aWN1bGFyIGNvbnN0cnVjdG9yJ31gLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIGxldCB1bmtub3duS2V5c0FsbG93ZWQgPSBmYWxzZTtcbiAgbGV0IHVua25vd25LZXlQYXR0ZXJuO1xuICBpZiAocGF0dGVybiBpbnN0YW5jZW9mIE9iamVjdEluY2x1ZGluZykge1xuICAgIHVua25vd25LZXlzQWxsb3dlZCA9IHRydWU7XG4gICAgcGF0dGVybiA9IHBhdHRlcm4ucGF0dGVybjtcbiAgfVxuXG4gIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgT2JqZWN0V2l0aFZhbHVlcykge1xuICAgIHVua25vd25LZXlzQWxsb3dlZCA9IHRydWU7XG4gICAgdW5rbm93bktleVBhdHRlcm4gPSBbcGF0dGVybi5wYXR0ZXJuXTtcbiAgICBwYXR0ZXJuID0ge307ICAvLyBubyByZXF1aXJlZCBrZXlzXG4gIH1cblxuICBpZiAodHlwZW9mIHBhdHRlcm4gIT09ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6ICdCYWQgcGF0dGVybjogdW5rbm93biBwYXR0ZXJuIHR5cGUnLFxuICAgICAgcGF0aDogJycsXG4gICAgfTtcbiAgfVxuXG4gIC8vIEFuIG9iamVjdCwgd2l0aCByZXF1aXJlZCBhbmQgb3B0aW9uYWwga2V5cy4gTm90ZSB0aGF0IHRoaXMgZG9lcyBOT1QgZG9cbiAgLy8gc3RydWN0dXJhbCBtYXRjaGVzIGFnYWluc3Qgb2JqZWN0cyBvZiBzcGVjaWFsIHR5cGVzIHRoYXQgaGFwcGVuIHRvIG1hdGNoXG4gIC8vIHRoZSBwYXR0ZXJuOiB0aGlzIHJlYWxseSBuZWVkcyB0byBiZSBhIHBsYWluIG9sZCB7T2JqZWN0fSFcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYEV4cGVjdGVkIG9iamVjdCwgZ290ICR7dHlwZW9mIHZhbHVlfWAsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG5cbiAgaWYgKHZhbHVlID09PSBudWxsKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2U6IGBFeHBlY3RlZCBvYmplY3QsIGdvdCBudWxsYCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICBpZiAoISBpc1BsYWluT2JqZWN0KHZhbHVlKSkge1xuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlOiBgRXhwZWN0ZWQgcGxhaW4gb2JqZWN0YCxcbiAgICAgIHBhdGg6ICcnLFxuICAgIH07XG4gIH1cblxuICBjb25zdCByZXF1aXJlZFBhdHRlcm5zID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgY29uc3Qgb3B0aW9uYWxQYXR0ZXJucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgT2JqZWN0LmtleXMocGF0dGVybikuZm9yRWFjaChrZXkgPT4ge1xuICAgIGNvbnN0IHN1YlBhdHRlcm4gPSBwYXR0ZXJuW2tleV07XG4gICAgaWYgKHN1YlBhdHRlcm4gaW5zdGFuY2VvZiBPcHRpb25hbCB8fFxuICAgICAgICBzdWJQYXR0ZXJuIGluc3RhbmNlb2YgTWF5YmUpIHtcbiAgICAgIG9wdGlvbmFsUGF0dGVybnNba2V5XSA9IHN1YlBhdHRlcm4ucGF0dGVybjtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVxdWlyZWRQYXR0ZXJuc1trZXldID0gc3ViUGF0dGVybjtcbiAgICB9XG4gIH0pO1xuXG4gIGZvciAobGV0IGtleSBpbiBPYmplY3QodmFsdWUpKSB7XG4gICAgY29uc3Qgc3ViVmFsdWUgPSB2YWx1ZVtrZXldO1xuICAgIGlmIChoYXNPd24uY2FsbChyZXF1aXJlZFBhdHRlcm5zLCBrZXkpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZShzdWJWYWx1ZSwgcmVxdWlyZWRQYXR0ZXJuc1trZXldKTtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgcmVzdWx0LnBhdGggPSBfcHJlcGVuZFBhdGgoa2V5LCByZXN1bHQucGF0aCk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG5cbiAgICAgIGRlbGV0ZSByZXF1aXJlZFBhdHRlcm5zW2tleV07XG4gICAgfSBlbHNlIGlmIChoYXNPd24uY2FsbChvcHRpb25hbFBhdHRlcm5zLCBrZXkpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSB0ZXN0U3VidHJlZShzdWJWYWx1ZSwgb3B0aW9uYWxQYXR0ZXJuc1trZXldKTtcbiAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgcmVzdWx0LnBhdGggPSBfcHJlcGVuZFBhdGgoa2V5LCByZXN1bHQucGF0aCk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG5cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF1bmtub3duS2V5c0FsbG93ZWQpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBtZXNzYWdlOiAnVW5rbm93biBrZXknLFxuICAgICAgICAgIHBhdGg6IGtleSxcbiAgICAgICAgfTtcbiAgICAgIH1cblxuICAgICAgaWYgKHVua25vd25LZXlQYXR0ZXJuKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRlc3RTdWJ0cmVlKHN1YlZhbHVlLCB1bmtub3duS2V5UGF0dGVyblswXSk7XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICByZXN1bHQucGF0aCA9IF9wcmVwZW5kUGF0aChrZXksIHJlc3VsdC5wYXRoKTtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHJlcXVpcmVkUGF0dGVybnMpO1xuICBpZiAoa2V5cy5sZW5ndGgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZTogYE1pc3Npbmcga2V5ICcke2tleXNbMF19J2AsXG4gICAgICBwYXRoOiAnJyxcbiAgICB9O1xuICB9XG59O1xuXG5jbGFzcyBBcmd1bWVudENoZWNrZXIge1xuICBjb25zdHJ1Y3RvciAoYXJncywgZGVzY3JpcHRpb24pIHtcblxuICAgIC8vIE1ha2UgYSBTSEFMTE9XIGNvcHkgb2YgdGhlIGFyZ3VtZW50cy4gKFdlJ2xsIGJlIGRvaW5nIGlkZW50aXR5IGNoZWNrc1xuICAgIC8vIGFnYWluc3QgaXRzIGNvbnRlbnRzLilcbiAgICB0aGlzLmFyZ3MgPSBbLi4uYXJnc107XG5cbiAgICAvLyBTaW5jZSB0aGUgY29tbW9uIGNhc2Ugd2lsbCBiZSB0byBjaGVjayBhcmd1bWVudHMgaW4gb3JkZXIsIGFuZCB3ZSBzcGxpY2VcbiAgICAvLyBvdXQgYXJndW1lbnRzIHdoZW4gd2UgY2hlY2sgdGhlbSwgbWFrZSBpdCBzbyB3ZSBzcGxpY2Ugb3V0IGZyb20gdGhlIGVuZFxuICAgIC8vIHJhdGhlciB0aGFuIHRoZSBiZWdpbm5pbmcuXG4gICAgdGhpcy5hcmdzLnJldmVyc2UoKTtcbiAgICB0aGlzLmRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XG4gIH1cblxuICBjaGVja2luZyh2YWx1ZSkge1xuICAgIGlmICh0aGlzLl9jaGVja2luZ09uZVZhbHVlKHZhbHVlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEFsbG93IGNoZWNrKGFyZ3VtZW50cywgW1N0cmluZ10pIG9yIGNoZWNrKGFyZ3VtZW50cy5zbGljZSgxKSwgW1N0cmluZ10pXG4gICAgLy8gb3IgY2hlY2soW2ZvbywgYmFyXSwgW1N0cmluZ10pIHRvIGNvdW50Li4uIGJ1dCBvbmx5IGlmIHZhbHVlIHdhc24ndFxuICAgIC8vIGl0c2VsZiBhbiBhcmd1bWVudC5cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgfHwgaXNBcmd1bWVudHModmFsdWUpKSB7XG4gICAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHZhbHVlLCB0aGlzLl9jaGVja2luZ09uZVZhbHVlLmJpbmQodGhpcykpO1xuICAgIH1cbiAgfVxuXG4gIF9jaGVja2luZ09uZVZhbHVlKHZhbHVlKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmFyZ3MubGVuZ3RoOyArK2kpIHtcblxuICAgICAgLy8gSXMgdGhpcyB2YWx1ZSBvbmUgb2YgdGhlIGFyZ3VtZW50cz8gKFRoaXMgY2FuIGhhdmUgYSBmYWxzZSBwb3NpdGl2ZSBpZlxuICAgICAgLy8gdGhlIGFyZ3VtZW50IGlzIGFuIGludGVybmVkIHByaW1pdGl2ZSwgYnV0IGl0J3Mgc3RpbGwgYSBnb29kIGVub3VnaFxuICAgICAgLy8gY2hlY2suKVxuICAgICAgLy8gKE5hTiBpcyBub3QgPT09IHRvIGl0c2VsZiwgc28gd2UgaGF2ZSB0byBjaGVjayBzcGVjaWFsbHkuKVxuICAgICAgaWYgKHZhbHVlID09PSB0aGlzLmFyZ3NbaV0gfHxcbiAgICAgICAgICAoTnVtYmVyLmlzTmFOKHZhbHVlKSAmJiBOdW1iZXIuaXNOYU4odGhpcy5hcmdzW2ldKSkpIHtcbiAgICAgICAgdGhpcy5hcmdzLnNwbGljZShpLCAxKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHRocm93VW5sZXNzQWxsQXJndW1lbnRzSGF2ZUJlZW5DaGVja2VkKCkge1xuICAgIGlmICh0aGlzLmFyZ3MubGVuZ3RoID4gMClcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRGlkIG5vdCBjaGVjaygpIGFsbCBhcmd1bWVudHMgZHVyaW5nICR7dGhpcy5kZXNjcmlwdGlvbn1gKTtcbiAgfVxufVxuXG5jb25zdCBfanNLZXl3b3JkcyA9IFsnZG8nLCAnaWYnLCAnaW4nLCAnZm9yJywgJ2xldCcsICduZXcnLCAndHJ5JywgJ3ZhcicsICdjYXNlJyxcbiAgJ2Vsc2UnLCAnZW51bScsICdldmFsJywgJ2ZhbHNlJywgJ251bGwnLCAndGhpcycsICd0cnVlJywgJ3ZvaWQnLCAnd2l0aCcsXG4gICdicmVhaycsICdjYXRjaCcsICdjbGFzcycsICdjb25zdCcsICdzdXBlcicsICd0aHJvdycsICd3aGlsZScsICd5aWVsZCcsXG4gICdkZWxldGUnLCAnZXhwb3J0JywgJ2ltcG9ydCcsICdwdWJsaWMnLCAncmV0dXJuJywgJ3N0YXRpYycsICdzd2l0Y2gnLFxuICAndHlwZW9mJywgJ2RlZmF1bHQnLCAnZXh0ZW5kcycsICdmaW5hbGx5JywgJ3BhY2thZ2UnLCAncHJpdmF0ZScsICdjb250aW51ZScsXG4gICdkZWJ1Z2dlcicsICdmdW5jdGlvbicsICdhcmd1bWVudHMnLCAnaW50ZXJmYWNlJywgJ3Byb3RlY3RlZCcsICdpbXBsZW1lbnRzJyxcbiAgJ2luc3RhbmNlb2YnXTtcblxuLy8gQXNzdW1lcyB0aGUgYmFzZSBvZiBwYXRoIGlzIGFscmVhZHkgZXNjYXBlZCBwcm9wZXJseVxuLy8gcmV0dXJucyBrZXkgKyBiYXNlXG5jb25zdCBfcHJlcGVuZFBhdGggPSAoa2V5LCBiYXNlKSA9PiB7XG4gIGlmICgodHlwZW9mIGtleSkgPT09ICdudW1iZXInIHx8IGtleS5tYXRjaCgvXlswLTldKyQvKSkge1xuICAgIGtleSA9IGBbJHtrZXl9XWA7XG4gIH0gZWxzZSBpZiAoIWtleS5tYXRjaCgvXlthLXpfJF1bMC05YS16XyRdKiQvaSkgfHxcbiAgICAgICAgICAgICBfanNLZXl3b3Jkcy5pbmRleE9mKGtleSkgPj0gMCkge1xuICAgIGtleSA9IEpTT04uc3RyaW5naWZ5KFtrZXldKTtcbiAgfVxuXG4gIGlmIChiYXNlICYmIGJhc2VbMF0gIT09ICdbJykge1xuICAgIHJldHVybiBgJHtrZXl9LiR7YmFzZX1gO1xuICB9XG5cbiAgcmV0dXJuIGtleSArIGJhc2U7XG59XG5cbmNvbnN0IGlzT2JqZWN0ID0gdmFsdWUgPT4gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZSAhPT0gbnVsbDtcblxuY29uc3QgYmFzZUlzQXJndW1lbnRzID0gaXRlbSA9PlxuICBpc09iamVjdChpdGVtKSAmJlxuICBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoaXRlbSkgPT09ICdbb2JqZWN0IEFyZ3VtZW50c10nO1xuXG5jb25zdCBpc0FyZ3VtZW50cyA9IGJhc2VJc0FyZ3VtZW50cyhmdW5jdGlvbigpIHsgcmV0dXJuIGFyZ3VtZW50czsgfSgpKSA/XG4gIGJhc2VJc0FyZ3VtZW50cyA6XG4gIHZhbHVlID0+IGlzT2JqZWN0KHZhbHVlKSAmJiB0eXBlb2YgdmFsdWUuY2FsbGVlID09PSAnZnVuY3Rpb24nO1xuIiwiLy8gQ29weSBvZiBqUXVlcnkuaXNQbGFpbk9iamVjdCBmb3IgdGhlIHNlcnZlciBzaWRlIGZyb20galF1ZXJ5IHYzLjEuMS5cblxuY29uc3QgY2xhc3MydHlwZSA9IHt9O1xuXG5jb25zdCB0b1N0cmluZyA9IGNsYXNzMnR5cGUudG9TdHJpbmc7XG5cbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmNvbnN0IGZuVG9TdHJpbmcgPSBoYXNPd24udG9TdHJpbmc7XG5cbmNvbnN0IE9iamVjdEZ1bmN0aW9uU3RyaW5nID0gZm5Ub1N0cmluZy5jYWxsKE9iamVjdCk7XG5cbmNvbnN0IGdldFByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mO1xuXG5leHBvcnQgY29uc3QgaXNQbGFpbk9iamVjdCA9IG9iaiA9PiB7XG4gIGxldCBwcm90bztcbiAgbGV0IEN0b3I7XG5cbiAgLy8gRGV0ZWN0IG9idmlvdXMgbmVnYXRpdmVzXG4gIC8vIFVzZSB0b1N0cmluZyBpbnN0ZWFkIG9mIGpRdWVyeS50eXBlIHRvIGNhdGNoIGhvc3Qgb2JqZWN0c1xuICBpZiAoIW9iaiB8fCB0b1N0cmluZy5jYWxsKG9iaikgIT09ICdbb2JqZWN0IE9iamVjdF0nKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcHJvdG8gPSBnZXRQcm90byhvYmopO1xuXG4gIC8vIE9iamVjdHMgd2l0aCBubyBwcm90b3R5cGUgKGUuZy4sIGBPYmplY3QuY3JlYXRlKCBudWxsIClgKSBhcmUgcGxhaW5cbiAgaWYgKCFwcm90bykge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgLy8gT2JqZWN0cyB3aXRoIHByb3RvdHlwZSBhcmUgcGxhaW4gaWZmIHRoZXkgd2VyZSBjb25zdHJ1Y3RlZCBieSBhIGdsb2JhbCBPYmplY3QgZnVuY3Rpb25cbiAgQ3RvciA9IGhhc093bi5jYWxsKHByb3RvLCAnY29uc3RydWN0b3InKSAmJiBwcm90by5jb25zdHJ1Y3RvcjtcbiAgcmV0dXJuIHR5cGVvZiBDdG9yID09PSAnZnVuY3Rpb24nICYmIFxuICAgIGZuVG9TdHJpbmcuY2FsbChDdG9yKSA9PT0gT2JqZWN0RnVuY3Rpb25TdHJpbmc7XG59O1xuIl19
