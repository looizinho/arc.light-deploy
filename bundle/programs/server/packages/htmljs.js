Package["core-runtime"].queue("htmljs", ["meteor", "ecmascript", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var HTML;

var require = meteorInstall({"node_modules":{"meteor":{"htmljs":{"preamble.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/htmljs/preamble.js                                                                                        //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      HTML: () => HTML
    });
    let HTMLTags, Tag, Attrs, getTag, ensureTag, isTagEnsured, getSymbolName, knownHTMLElementNames, knownSVGElementNames, knownElementNames, voidElementNames, isKnownElement, isKnownSVGElement, isVoidElement, CharRef, Comment, Raw, isArray, isConstructedObject, isNully, isValidAttributeName, flattenAttributes;
    module.link("./html", {
      HTMLTags(v) {
        HTMLTags = v;
      },
      Tag(v) {
        Tag = v;
      },
      Attrs(v) {
        Attrs = v;
      },
      getTag(v) {
        getTag = v;
      },
      ensureTag(v) {
        ensureTag = v;
      },
      isTagEnsured(v) {
        isTagEnsured = v;
      },
      getSymbolName(v) {
        getSymbolName = v;
      },
      knownHTMLElementNames(v) {
        knownHTMLElementNames = v;
      },
      knownSVGElementNames(v) {
        knownSVGElementNames = v;
      },
      knownElementNames(v) {
        knownElementNames = v;
      },
      voidElementNames(v) {
        voidElementNames = v;
      },
      isKnownElement(v) {
        isKnownElement = v;
      },
      isKnownSVGElement(v) {
        isKnownSVGElement = v;
      },
      isVoidElement(v) {
        isVoidElement = v;
      },
      CharRef(v) {
        CharRef = v;
      },
      Comment(v) {
        Comment = v;
      },
      Raw(v) {
        Raw = v;
      },
      isArray(v) {
        isArray = v;
      },
      isConstructedObject(v) {
        isConstructedObject = v;
      },
      isNully(v) {
        isNully = v;
      },
      isValidAttributeName(v) {
        isValidAttributeName = v;
      },
      flattenAttributes(v) {
        flattenAttributes = v;
      }
    }, 0);
    let Visitor, TransformingVisitor, ToHTMLVisitor, ToTextVisitor, toHTML, TEXTMODE, toText;
    module.link("./visitors", {
      Visitor(v) {
        Visitor = v;
      },
      TransformingVisitor(v) {
        TransformingVisitor = v;
      },
      ToHTMLVisitor(v) {
        ToHTMLVisitor = v;
      },
      ToTextVisitor(v) {
        ToTextVisitor = v;
      },
      toHTML(v) {
        toHTML = v;
      },
      TEXTMODE(v) {
        TEXTMODE = v;
      },
      toText(v) {
        toText = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const HTML = Object.assign(HTMLTags, {
      Tag,
      Attrs,
      getTag,
      ensureTag,
      isTagEnsured,
      getSymbolName,
      knownHTMLElementNames,
      knownSVGElementNames,
      knownElementNames,
      voidElementNames,
      isKnownElement,
      isKnownSVGElement,
      isVoidElement,
      CharRef,
      Comment,
      Raw,
      isArray,
      isConstructedObject,
      isNully,
      isValidAttributeName,
      flattenAttributes,
      toHTML,
      TEXTMODE,
      toText,
      Visitor,
      TransformingVisitor,
      ToHTMLVisitor,
      ToTextVisitor
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
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"html.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/htmljs/html.js                                                                                            //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
module.export({
  Tag: () => Tag,
  Attrs: () => Attrs,
  HTMLTags: () => HTMLTags,
  getTag: () => getTag,
  ensureTag: () => ensureTag,
  isTagEnsured: () => isTagEnsured,
  getSymbolName: () => getSymbolName,
  knownHTMLElementNames: () => knownHTMLElementNames,
  knownSVGElementNames: () => knownSVGElementNames,
  knownElementNames: () => knownElementNames,
  voidElementNames: () => voidElementNames,
  isKnownElement: () => isKnownElement,
  isKnownSVGElement: () => isKnownSVGElement,
  isVoidElement: () => isVoidElement,
  CharRef: () => CharRef,
  Comment: () => Comment,
  Raw: () => Raw,
  isArray: () => isArray,
  isConstructedObject: () => isConstructedObject,
  isNully: () => isNully,
  isValidAttributeName: () => isValidAttributeName,
  flattenAttributes: () => flattenAttributes
});
const Tag = function () {};
Tag.prototype.tagName = ''; // this will be set per Tag subclass
Tag.prototype.attrs = null;
Tag.prototype.children = Object.freeze ? Object.freeze([]) : [];
Tag.prototype.htmljsType = Tag.htmljsType = ['Tag'];

// Given "p" create the function `HTML.P`.
var makeTagConstructor = function (tagName) {
  // Tag is the per-tagName constructor of a HTML.Tag subclass
  var HTMLTag = function () {
    // Work with or without `new`.  If not called with `new`,
    // perform instantiation by recursively calling this constructor.
    // We can't pass varargs, so pass no args.
    var instance = this instanceof Tag ? this : new HTMLTag();
    var i = 0;
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    var attrs = args.length && args[0];
    if (attrs && typeof attrs === 'object') {
      // Treat vanilla JS object as an attributes dictionary.
      if (!isConstructedObject(attrs)) {
        instance.attrs = attrs;
        i++;
      } else if (attrs instanceof Attrs) {
        var array = attrs.value;
        if (array.length === 1) {
          instance.attrs = array[0];
        } else if (array.length > 1) {
          instance.attrs = array;
        }
        i++;
      }
    }

    // If no children, don't create an array at all, use the prototype's
    // (frozen, empty) array.  This way we don't create an empty array
    // every time someone creates a tag without `new` and this constructor
    // calls itself with no arguments (above).
    if (i < args.length) instance.children = args.slice(i);
    return instance;
  };
  HTMLTag.prototype = new Tag();
  HTMLTag.prototype.constructor = HTMLTag;
  HTMLTag.prototype.tagName = tagName;
  return HTMLTag;
};

// Not an HTMLjs node, but a wrapper to pass multiple attrs dictionaries
// to a tag (for the purpose of implementing dynamic attributes).
function Attrs() {
  // Work with or without `new`.  If not called with `new`,
  // perform instantiation by recursively calling this constructor.
  // We can't pass varargs, so pass no args.
  var instance = this instanceof Attrs ? this : new Attrs();
  for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }
  instance.value = args;
  return instance;
}
const HTMLTags = {};
function getTag(tagName) {
  var symbolName = getSymbolName(tagName);
  if (symbolName === tagName)
    // all-caps tagName
    throw new Error("Use the lowercase or camelCase form of '" + tagName + "' here");
  if (!HTMLTags[symbolName]) HTMLTags[symbolName] = makeTagConstructor(tagName);
  return HTMLTags[symbolName];
}
function ensureTag(tagName) {
  getTag(tagName); // don't return it
}
function isTagEnsured(tagName) {
  return isKnownElement(tagName);
}
function getSymbolName(tagName) {
  // "foo-bar" -> "FOO_BAR"
  return tagName.toUpperCase().replace(/-/g, '_');
}
const knownHTMLElementNames = 'a abbr acronym address applet area article aside audio b base basefont bdi bdo big blockquote body br button canvas caption center cite code col colgroup command data datagrid datalist dd del details dfn dir div dl dt em embed eventsource fieldset figcaption figure font footer form frame frameset h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins isindex kbd keygen label legend li link main map mark menu meta meter nav noframes noscript object ol optgroup option output p param pre progress q rp rt ruby s samp script section select small source span strike strong style sub summary sup table tbody td textarea tfoot th thead time title tr track tt u ul var video wbr'.split(' ');
const knownSVGElementNames = 'altGlyph altGlyphDef altGlyphItem animate animateColor animateMotion animateTransform circle clipPath color-profile cursor defs desc ellipse feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence filter font font-face font-face-format font-face-name font-face-src font-face-uri foreignObject g glyph glyphRef hkern image line linearGradient marker mask metadata missing-glyph path pattern polygon polyline radialGradient rect set stop style svg switch symbol text textPath title tref tspan use view vkern'.split(' ');
const knownElementNames = knownHTMLElementNames.concat(knownSVGElementNames);
const voidElementNames = 'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');
var voidElementSet = new Set(voidElementNames);
var knownElementSet = new Set(knownElementNames);
var knownSVGElementSet = new Set(knownSVGElementNames);
function isKnownElement(tagName) {
  return knownElementSet.has(tagName);
}
function isKnownSVGElement(tagName) {
  return knownSVGElementSet.has(tagName);
}
function isVoidElement(tagName) {
  return voidElementSet.has(tagName);
}
// Ensure tags for all known elements
knownElementNames.forEach(ensureTag);
function CharRef(attrs) {
  if (!(this instanceof CharRef))
    // called without `new`
    return new CharRef(attrs);
  if (!(attrs && attrs.html && attrs.str)) throw new Error("HTML.CharRef must be constructed with ({html:..., str:...})");
  this.html = attrs.html;
  this.str = attrs.str;
}
CharRef.prototype.htmljsType = CharRef.htmljsType = ['CharRef'];
function Comment(value) {
  if (!(this instanceof Comment))
    // called without `new`
    return new Comment(value);
  if (typeof value !== 'string') throw new Error('HTML.Comment must be constructed with a string');
  this.value = value;
  // Kill illegal hyphens in comment value (no way to escape them in HTML)
  this.sanitizedValue = value.replace(/^-|--+|-$/g, '');
}
Comment.prototype.htmljsType = Comment.htmljsType = ['Comment'];
function Raw(value) {
  if (!(this instanceof Raw))
    // called without `new`
    return new Raw(value);
  if (typeof value !== 'string') throw new Error('HTML.Raw must be constructed with a string');
  this.value = value;
}
Raw.prototype.htmljsType = Raw.htmljsType = ['Raw'];
function isArray(x) {
  return x instanceof Array || Array.isArray(x);
}
function isConstructedObject(x) {
  // Figure out if `x` is "an instance of some class" or just a plain
  // object literal.  It correctly treats an object literal like
  // `{ constructor: ... }` as an object literal.  It won't detect
  // instances of classes that lack a `constructor` property (e.g.
  // if you assign to a prototype when setting up the class as in:
  // `Foo = function () { ... }; Foo.prototype = { ... }`, then
  // `(new Foo).constructor` is `Object`, not `Foo`).
  if (!x || typeof x !== 'object') return false;
  // Is this a plain object?
  let plain = false;
  if (Object.getPrototypeOf(x) === null) {
    plain = true;
  } else {
    let proto = x;
    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto);
    }
    plain = Object.getPrototypeOf(x) === proto;
  }
  return !plain && typeof x.constructor === 'function' && x instanceof x.constructor;
}
function isNully(node) {
  if (node == null)
    // null or undefined
    return true;
  if (isArray(node)) {
    // is it an empty array or an array of all nully items?
    for (var i = 0; i < node.length; i++) if (!isNully(node[i])) return false;
    return true;
  }
  return false;
}
function isValidAttributeName(name) {
  return /^[:_A-Za-z][:_A-Za-z0-9.\-]*/.test(name);
}
function flattenAttributes(attrs) {
  if (!attrs) return attrs;
  var isList = isArray(attrs);
  if (isList && attrs.length === 0) return null;
  var result = {};
  for (var i = 0, N = isList ? attrs.length : 1; i < N; i++) {
    var oneAttrs = isList ? attrs[i] : attrs;
    if (typeof oneAttrs !== 'object' || isConstructedObject(oneAttrs)) throw new Error("Expected plain JS object as attrs, found: " + oneAttrs);
    for (var name in oneAttrs) {
      if (!isValidAttributeName(name)) throw new Error("Illegal HTML attribute name: " + name);
      var value = oneAttrs[name];
      if (!isNully(value)) result[name] = value;
    }
  }
  return result;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"visitors.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/htmljs/visitors.js                                                                                        //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      Visitor: () => Visitor,
      TransformingVisitor: () => TransformingVisitor,
      ToTextVisitor: () => ToTextVisitor,
      ToHTMLVisitor: () => ToHTMLVisitor,
      toHTML: () => toHTML,
      TEXTMODE: () => TEXTMODE,
      toText: () => toText
    });
    let Tag, CharRef, Comment, Raw, isArray, getTag, isConstructedObject, flattenAttributes, isVoidElement;
    module.link("./html", {
      Tag(v) {
        Tag = v;
      },
      CharRef(v) {
        CharRef = v;
      },
      Comment(v) {
        Comment = v;
      },
      Raw(v) {
        Raw = v;
      },
      isArray(v) {
        isArray = v;
      },
      getTag(v) {
        getTag = v;
      },
      isConstructedObject(v) {
        isConstructedObject = v;
      },
      flattenAttributes(v) {
        flattenAttributes = v;
      },
      isVoidElement(v) {
        isVoidElement = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    var IDENTITY = function (x) {
      return x;
    };

    // _assign is like _.extend or the upcoming Object.assign.
    // Copy src's own, enumerable properties onto tgt and return
    // tgt.
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    var _assign = function (tgt, src) {
      for (var k in src) {
        if (_hasOwnProperty.call(src, k)) tgt[k] = src[k];
      }
      return tgt;
    };
    const Visitor = function (props) {
      _assign(this, props);
    };
    Visitor.def = function (options) {
      _assign(this.prototype, options);
    };
    Visitor.extend = function (options) {
      var curType = this;
      var subType = function HTMLVisitorSubtype( /*arguments*/
      ) {
        Visitor.apply(this, arguments);
      };
      subType.prototype = new curType();
      subType.extend = curType.extend;
      subType.def = curType.def;
      if (options) _assign(subType.prototype, options);
      return subType;
    };
    Visitor.def({
      visit: function (content /*, ...*/) {
        if (content == null)
          // null or undefined.
          return this.visitNull.apply(this, arguments);
        if (typeof content === 'object') {
          if (content.htmljsType) {
            switch (content.htmljsType) {
              case Tag.htmljsType:
                return this.visitTag.apply(this, arguments);
              case CharRef.htmljsType:
                return this.visitCharRef.apply(this, arguments);
              case Comment.htmljsType:
                return this.visitComment.apply(this, arguments);
              case Raw.htmljsType:
                return this.visitRaw.apply(this, arguments);
              default:
                throw new Error("Unknown htmljs type: " + content.htmljsType);
            }
          }
          if (isArray(content)) return this.visitArray.apply(this, arguments);
          return this.visitObject.apply(this, arguments);
        } else if (typeof content === 'string' || typeof content === 'boolean' || typeof content === 'number') {
          return this.visitPrimitive.apply(this, arguments);
        } else if (typeof content === 'function') {
          return this.visitFunction.apply(this, arguments);
        }
        throw new Error("Unexpected object in htmljs: " + content);
      },
      visitNull: function (nullOrUndefined /*, ...*/) {},
      visitPrimitive: function (stringBooleanOrNumber /*, ...*/) {},
      visitArray: function (array /*, ...*/) {},
      visitComment: function (comment /*, ...*/) {},
      visitCharRef: function (charRef /*, ...*/) {},
      visitRaw: function (raw /*, ...*/) {},
      visitTag: function (tag /*, ...*/) {},
      visitObject: function (obj /*, ...*/) {
        throw new Error("Unexpected object in htmljs: " + obj);
      },
      visitFunction: function (fn /*, ...*/) {
        throw new Error("Unexpected function in htmljs: " + fn);
      }
    });
    const TransformingVisitor = Visitor.extend();
    TransformingVisitor.def({
      visitNull: IDENTITY,
      visitPrimitive: IDENTITY,
      visitArray: function (array) {
        var result = array;
        for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }
        for (var i = 0; i < array.length; i++) {
          var oldItem = array[i];
          var newItem = this.visit(oldItem, ...args);
          if (newItem !== oldItem) {
            // copy `array` on write
            if (result === array) result = array.slice();
            result[i] = newItem;
          }
        }
        return result;
      },
      visitComment: IDENTITY,
      visitCharRef: IDENTITY,
      visitRaw: IDENTITY,
      visitObject: function (obj) {
        // Don't parse Markdown & RCData as HTML
        if (obj.textMode != null) {
          return obj;
        }
        for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
          args[_key2 - 1] = arguments[_key2];
        }
        if ('content' in obj) {
          obj.content = this.visit(obj.content, ...args);
        }
        if ('elseContent' in obj) {
          obj.elseContent = this.visit(obj.elseContent, ...args);
        }
        return obj;
      },
      visitFunction: IDENTITY,
      visitTag: function (tag) {
        var oldChildren = tag.children;
        for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
          args[_key3 - 1] = arguments[_key3];
        }
        var newChildren = this.visitChildren(oldChildren, ...args);
        var oldAttrs = tag.attrs;
        var newAttrs = this.visitAttributes(oldAttrs, ...args);
        if (newAttrs === oldAttrs && newChildren === oldChildren) return tag;
        var newTag = getTag(tag.tagName).apply(null, newChildren);
        newTag.attrs = newAttrs;
        return newTag;
      },
      visitChildren: function (children) {
        for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
          args[_key4 - 1] = arguments[_key4];
        }
        return this.visitArray(children, ...args);
      },
      // Transform the `.attrs` property of a tag, which may be a dictionary,
      // an array, or in some uses, a foreign object (such as
      // a template tag).
      visitAttributes: function (attrs) {
        for (var _len5 = arguments.length, args = new Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
          args[_key5 - 1] = arguments[_key5];
        }
        if (isArray(attrs)) {
          var result = attrs;
          for (var i = 0; i < attrs.length; i++) {
            var oldItem = attrs[i];
            var newItem = this.visitAttributes(oldItem, ...args);
            if (newItem !== oldItem) {
              // copy on write
              if (result === attrs) result = attrs.slice();
              result[i] = newItem;
            }
          }
          return result;
        }
        if (attrs && isConstructedObject(attrs)) {
          throw new Error("The basic TransformingVisitor does not support " + "foreign objects in attributes.  Define a custom " + "visitAttributes for this case.");
        }
        var oldAttrs = attrs;
        var newAttrs = oldAttrs;
        if (oldAttrs) {
          var attrArgs = [null, null];
          attrArgs.push.apply(attrArgs, arguments);
          for (var k in oldAttrs) {
            var oldValue = oldAttrs[k];
            attrArgs[0] = k;
            attrArgs[1] = oldValue;
            var newValue = this.visitAttribute.apply(this, attrArgs);
            if (newValue !== oldValue) {
              // copy on write
              if (newAttrs === oldAttrs) newAttrs = _assign({}, oldAttrs);
              newAttrs[k] = newValue;
            }
          }
        }
        return newAttrs;
      },
      // Transform the value of one attribute name/value in an
      // attributes dictionary.
      visitAttribute: function (name, value, tag) {
        for (var _len6 = arguments.length, args = new Array(_len6 > 3 ? _len6 - 3 : 0), _key6 = 3; _key6 < _len6; _key6++) {
          args[_key6 - 3] = arguments[_key6];
        }
        return this.visit(value, ...args);
      }
    });
    const ToTextVisitor = Visitor.extend();
    ToTextVisitor.def({
      visitNull: function (nullOrUndefined) {
        return '';
      },
      visitPrimitive: function (stringBooleanOrNumber) {
        var str = String(stringBooleanOrNumber);
        if (this.textMode === TEXTMODE.RCDATA) {
          return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
        } else if (this.textMode === TEXTMODE.ATTRIBUTE) {
          // escape `&` and `"` this time, not `&` and `<`
          return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        } else {
          return str;
        }
      },
      visitArray: function (array) {
        var parts = [];
        for (var i = 0; i < array.length; i++) parts.push(this.visit(array[i]));
        return parts.join('');
      },
      visitComment: function (comment) {
        throw new Error("Can't have a comment here");
      },
      visitCharRef: function (charRef) {
        if (this.textMode === TEXTMODE.RCDATA || this.textMode === TEXTMODE.ATTRIBUTE) {
          return charRef.html;
        } else {
          return charRef.str;
        }
      },
      visitRaw: function (raw) {
        return raw.value;
      },
      visitTag: function (tag) {
        // Really we should just disallow Tags here.  However, at the
        // moment it's useful to stringify any HTML we find.  In
        // particular, when you include a template within `{{#markdown}}`,
        // we render the template as text, and since there's currently
        // no way to make the template be *parsed* as text (e.g. `<template
        // type="text">`), we hackishly support HTML tags in markdown
        // in templates by parsing them and stringifying them.
        return this.visit(this.toHTML(tag));
      },
      visitObject: function (x) {
        throw new Error("Unexpected object in htmljs in toText: " + x);
      },
      toHTML: function (node) {
        return toHTML(node);
      }
    });
    const ToHTMLVisitor = Visitor.extend();
    ToHTMLVisitor.def({
      visitNull: function (nullOrUndefined) {
        return '';
      },
      visitPrimitive: function (stringBooleanOrNumber) {
        var str = String(stringBooleanOrNumber);
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      },
      visitArray: function (array) {
        var parts = [];
        for (var i = 0; i < array.length; i++) parts.push(this.visit(array[i]));
        return parts.join('');
      },
      visitComment: function (comment) {
        return '<!--' + comment.sanitizedValue + '-->';
      },
      visitCharRef: function (charRef) {
        return charRef.html;
      },
      visitRaw: function (raw) {
        return raw.value;
      },
      visitTag: function (tag) {
        var attrStrs = [];
        var tagName = tag.tagName;
        var children = tag.children;
        var attrs = tag.attrs;
        if (attrs) {
          attrs = flattenAttributes(attrs);
          for (var k in attrs) {
            if (k === 'value' && tagName === 'textarea') {
              children = [attrs[k], children];
            } else {
              var v = this.toText(attrs[k], TEXTMODE.ATTRIBUTE);
              attrStrs.push(' ' + k + '="' + v + '"');
            }
          }
        }
        var startTag = '<' + tagName + attrStrs.join('') + '>';
        var childStrs = [];
        var content;
        if (tagName === 'textarea') {
          for (var i = 0; i < children.length; i++) childStrs.push(this.toText(children[i], TEXTMODE.RCDATA));
          content = childStrs.join('');
          if (content.slice(0, 1) === '\n')
            // TEXTAREA will absorb a newline, so if we see one, add
            // another one.
            content = '\n' + content;
        } else {
          for (var i = 0; i < children.length; i++) childStrs.push(this.visit(children[i]));
          content = childStrs.join('');
        }
        var result = startTag + content;
        if (children.length || !isVoidElement(tagName)) {
          // "Void" elements like BR are the only ones that don't get a close
          // tag in HTML5.  They shouldn't have contents, either, so we could
          // throw an error upon seeing contents here.
          result += '</' + tagName + '>';
        }
        return result;
      },
      visitObject: function (x) {
        throw new Error("Unexpected object in htmljs in toHTML: " + x);
      },
      toText: function (node, textMode) {
        return toText(node, textMode);
      }
    });

    ////////////////////////////// TOHTML

    function toHTML(content) {
      return new ToHTMLVisitor().visit(content);
    }
    const TEXTMODE = {
      STRING: 1,
      RCDATA: 2,
      ATTRIBUTE: 3
    };
    function toText(content, textMode) {
      if (!textMode) throw new Error("textMode required for HTML.toText");
      if (!(textMode === TEXTMODE.STRING || textMode === TEXTMODE.RCDATA || textMode === TEXTMODE.ATTRIBUTE)) throw new Error("Unknown textMode: " + textMode);
      var visitor = new ToTextVisitor({
        textMode: textMode
      });
      return visitor.visit(content);
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

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      HTML: HTML
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/htmljs/preamble.js"
  ],
  mainModulePath: "/node_modules/meteor/htmljs/preamble.js"
}});

//# sourceURL=meteor://💻app/packages/htmljs.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvaHRtbGpzL3ByZWFtYmxlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9odG1sanMvaHRtbC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvaHRtbGpzL3Zpc2l0b3JzLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkhUTUwiLCJIVE1MVGFncyIsIlRhZyIsIkF0dHJzIiwiZ2V0VGFnIiwiZW5zdXJlVGFnIiwiaXNUYWdFbnN1cmVkIiwiZ2V0U3ltYm9sTmFtZSIsImtub3duSFRNTEVsZW1lbnROYW1lcyIsImtub3duU1ZHRWxlbWVudE5hbWVzIiwia25vd25FbGVtZW50TmFtZXMiLCJ2b2lkRWxlbWVudE5hbWVzIiwiaXNLbm93bkVsZW1lbnQiLCJpc0tub3duU1ZHRWxlbWVudCIsImlzVm9pZEVsZW1lbnQiLCJDaGFyUmVmIiwiQ29tbWVudCIsIlJhdyIsImlzQXJyYXkiLCJpc0NvbnN0cnVjdGVkT2JqZWN0IiwiaXNOdWxseSIsImlzVmFsaWRBdHRyaWJ1dGVOYW1lIiwiZmxhdHRlbkF0dHJpYnV0ZXMiLCJsaW5rIiwidiIsIlZpc2l0b3IiLCJUcmFuc2Zvcm1pbmdWaXNpdG9yIiwiVG9IVE1MVmlzaXRvciIsIlRvVGV4dFZpc2l0b3IiLCJ0b0hUTUwiLCJURVhUTU9ERSIsInRvVGV4dCIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiT2JqZWN0IiwiYXNzaWduIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwic2VsZiIsImFzeW5jIiwicHJvdG90eXBlIiwidGFnTmFtZSIsImF0dHJzIiwiY2hpbGRyZW4iLCJmcmVlemUiLCJodG1sanNUeXBlIiwibWFrZVRhZ0NvbnN0cnVjdG9yIiwiSFRNTFRhZyIsImluc3RhbmNlIiwiaSIsIl9sZW4iLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJhcmdzIiwiQXJyYXkiLCJfa2V5IiwiYXJyYXkiLCJ2YWx1ZSIsInNsaWNlIiwiY29uc3RydWN0b3IiLCJfbGVuMiIsIl9rZXkyIiwic3ltYm9sTmFtZSIsIkVycm9yIiwidG9VcHBlckNhc2UiLCJyZXBsYWNlIiwic3BsaXQiLCJjb25jYXQiLCJ2b2lkRWxlbWVudFNldCIsIlNldCIsImtub3duRWxlbWVudFNldCIsImtub3duU1ZHRWxlbWVudFNldCIsImhhcyIsImZvckVhY2giLCJodG1sIiwic3RyIiwic2FuaXRpemVkVmFsdWUiLCJ4IiwicGxhaW4iLCJnZXRQcm90b3R5cGVPZiIsInByb3RvIiwibm9kZSIsIm5hbWUiLCJ0ZXN0IiwiaXNMaXN0IiwicmVzdWx0IiwiTiIsIm9uZUF0dHJzIiwiSURFTlRJVFkiLCJfaGFzT3duUHJvcGVydHkiLCJoYXNPd25Qcm9wZXJ0eSIsIl9hc3NpZ24iLCJ0Z3QiLCJzcmMiLCJrIiwiY2FsbCIsInByb3BzIiwiZGVmIiwib3B0aW9ucyIsImV4dGVuZCIsImN1clR5cGUiLCJzdWJUeXBlIiwiSFRNTFZpc2l0b3JTdWJ0eXBlIiwiYXBwbHkiLCJ2aXNpdCIsImNvbnRlbnQiLCJ2aXNpdE51bGwiLCJ2aXNpdFRhZyIsInZpc2l0Q2hhclJlZiIsInZpc2l0Q29tbWVudCIsInZpc2l0UmF3IiwidmlzaXRBcnJheSIsInZpc2l0T2JqZWN0IiwidmlzaXRQcmltaXRpdmUiLCJ2aXNpdEZ1bmN0aW9uIiwibnVsbE9yVW5kZWZpbmVkIiwic3RyaW5nQm9vbGVhbk9yTnVtYmVyIiwiY29tbWVudCIsImNoYXJSZWYiLCJyYXciLCJ0YWciLCJvYmoiLCJmbiIsIm9sZEl0ZW0iLCJuZXdJdGVtIiwidGV4dE1vZGUiLCJlbHNlQ29udGVudCIsIm9sZENoaWxkcmVuIiwiX2xlbjMiLCJfa2V5MyIsIm5ld0NoaWxkcmVuIiwidmlzaXRDaGlsZHJlbiIsIm9sZEF0dHJzIiwibmV3QXR0cnMiLCJ2aXNpdEF0dHJpYnV0ZXMiLCJuZXdUYWciLCJfbGVuNCIsIl9rZXk0IiwiX2xlbjUiLCJfa2V5NSIsImF0dHJBcmdzIiwicHVzaCIsIm9sZFZhbHVlIiwibmV3VmFsdWUiLCJ2aXNpdEF0dHJpYnV0ZSIsIl9sZW42IiwiX2tleTYiLCJTdHJpbmciLCJSQ0RBVEEiLCJBVFRSSUJVVEUiLCJwYXJ0cyIsImpvaW4iLCJhdHRyU3RycyIsInN0YXJ0VGFnIiwiY2hpbGRTdHJzIiwiU1RSSU5HIiwidmlzaXRvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUFBQUEsTUFBTSxDQUFDQyxNQUFNLENBQUM7TUFBQ0MsSUFBSSxFQUFDQSxDQUFBLEtBQUlBO0lBQUksQ0FBQyxDQUFDO0lBQUMsSUFBSUMsUUFBUSxFQUFDQyxHQUFHLEVBQUNDLEtBQUssRUFBQ0MsTUFBTSxFQUFDQyxTQUFTLEVBQUNDLFlBQVksRUFBQ0MsYUFBYSxFQUFDQyxxQkFBcUIsRUFBQ0Msb0JBQW9CLEVBQUNDLGlCQUFpQixFQUFDQyxnQkFBZ0IsRUFBQ0MsY0FBYyxFQUFDQyxpQkFBaUIsRUFBQ0MsYUFBYSxFQUFDQyxPQUFPLEVBQUNDLE9BQU8sRUFBQ0MsR0FBRyxFQUFDQyxPQUFPLEVBQUNDLG1CQUFtQixFQUFDQyxPQUFPLEVBQUNDLG9CQUFvQixFQUFDQyxpQkFBaUI7SUFBQ3hCLE1BQU0sQ0FBQ3lCLElBQUksQ0FBQyxRQUFRLEVBQUM7TUFBQ3RCLFFBQVFBLENBQUN1QixDQUFDLEVBQUM7UUFBQ3ZCLFFBQVEsR0FBQ3VCLENBQUM7TUFBQSxDQUFDO01BQUN0QixHQUFHQSxDQUFDc0IsQ0FBQyxFQUFDO1FBQUN0QixHQUFHLEdBQUNzQixDQUFDO01BQUEsQ0FBQztNQUFDckIsS0FBS0EsQ0FBQ3FCLENBQUMsRUFBQztRQUFDckIsS0FBSyxHQUFDcUIsQ0FBQztNQUFBLENBQUM7TUFBQ3BCLE1BQU1BLENBQUNvQixDQUFDLEVBQUM7UUFBQ3BCLE1BQU0sR0FBQ29CLENBQUM7TUFBQSxDQUFDO01BQUNuQixTQUFTQSxDQUFDbUIsQ0FBQyxFQUFDO1FBQUNuQixTQUFTLEdBQUNtQixDQUFDO01BQUEsQ0FBQztNQUFDbEIsWUFBWUEsQ0FBQ2tCLENBQUMsRUFBQztR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QUFVaUQsSUFBSSxFQUFFNEMsUUFBUSxFQUFFO1FBQ2hDLE9BQU83RixNQUFNLENBQUNpRCxJQUFJLEVBQUU0QyxRQUFRLENBQUM7TUFDL0I7SUFDRixDQUFDLENBQUM7O0lBSUY7O0lBRU8sU0FBUy9GLE1BQU1BLENBQUMyRSxPQUFPLEVBQUU7TUFDOUIsT0FBUSxJQUFJN0UsYUFBYSxDQUFELENBQUMsQ0FBRTRFLEtBQUssQ0FBQ0MsT0FBTyxDQUFDO0lBQzNDO0lBR08sTUFBTTFFLFFBQVEsR0FBRztNQUN0QjRILE1BQU0sRUFBRSxDQUFDO01BQ1RQLE1BQU0sRUFBRSxDQUFDO01BQ1RDLFNBQVMsRUFBRTtJQUNiLENBQUM7SUFHTSxTQUFTckgsTUFBTUEsQ0FBQ3lFLE9BQU8sRUFBRW9CLFFBQVEsRUFBRTtNQUN4QyxJQUFJLENBQUVBLFFBQVEsRUFDWixNQUFNLElBQUk5RCxLQUFLLENBQUMsbUNBQW1DLENBQUM7TUFDdEQsSUFBSSxFQUFHOEQsUUFBUSxLQUFLOUYsUUFBUSxDQUFDNEgsTUFBTSxJQUM1QjlCLFFBQVEsS0FBSzlGLFFBQVEsQ0FBQ3FILE1BQU0sSUFDNUJ2QixRQUFRLEtBQUs5RixRQUFRLENBQUNzSCxTQUFTLENBQUMsRUFDckMsTUFBTSxJQUFJdEYsS0FBSyxDQUFDLG9CQUFvQixHQUFHOEQsUUFBUSxDQUFDO01BRWxELElBQUkrQixPQUFPLEdBQUcsSUFBSS9ILGFBQWEsQ0FBQztRQUFDZ0csUUFBUSxFQUFFQTtNQUFRLENBQUMsQ0FBQztNQUNyRCxPQUFPK0IsT0FBTyxDQUFDcEQsS0FBSyxDQUFDQyxPQUFPLENBQUM7SUFDL0I7SUFBQ3JFLHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUFFLElBQUE7RUFBQUMsS0FBQTtBQUFBLEciLCJmaWxlIjoiL3BhY2thZ2VzL2h0bWxqcy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIEhUTUxUYWdzLFxuICBUYWcsXG4gIEF0dHJzLFxuICBnZXRUYWcsXG4gIGVuc3VyZVRhZyxcbiAgaXNUYWdFbnN1cmVkLFxuICBnZXRTeW1ib2xOYW1lLFxuICBrbm93bkhUTUxFbGVtZW50TmFtZXMsXG4gIGtub3duU1ZHRWxlbWVudE5hbWVzLFxuICBrbm93bkVsZW1lbnROYW1lcyxcbiAgdm9pZEVsZW1lbnROYW1lcyxcbiAgaXNLbm93bkVsZW1lbnQsXG4gIGlzS25vd25TVkdFbGVtZW50LFxuICBpc1ZvaWRFbGVtZW50LFxuICBDaGFyUmVmLFxuICBDb21tZW50LFxuICBSYXcsXG4gIGlzQXJyYXksXG4gIGlzQ29uc3RydWN0ZWRPYmplY3QsXG4gIGlzTnVsbHksXG4gIGlzVmFsaWRBdHRyaWJ1dGVOYW1lLFxuICBmbGF0dGVuQXR0cmlidXRlcyxcbn0gZnJvbSAnLi9odG1sJztcblxuaW1wb3J0IHtcbiAgVmlzaXRvcixcbiAgVHJhbnNmb3JtaW5nVmlzaXRvcixcbiAgVG9IVE1MVmlzaXRvcixcbiAgVG9UZXh0VmlzaXRvcixcbiAgdG9IVE1MLFxuICBURVhUTU9ERSxcbiAgdG9UZXh0XG59IGZyb20gJy4vdmlzaXRvcnMnO1xuXG5cbi8vIHdlJ3JlIGFjdHVhbGx5IGV4cG9ydGluZyB0aGUgSFRNTFRhZ3Mgb2JqZWN0LlxuLy8gIGJlY2F1c2UgaXQgaXMgZHluYW1pY2FsbHkgYWx0ZXJlZCBieSBnZXRUYWcvZW5zdXJlVGFnXG5leHBvcnQgY29uc3QgSFRNTCA9IE9iamVjdC5hc3NpZ24oSFRNTFRhZ3MsIHtcbiAgVGFnLFxuICBBdHRycyxcbiAgZ2V0VGFnLFxuICBlbnN1cmVUYWcsXG4gIGlzVGFnRW5zdXJlZCxcbiAgZ2V0U3ltYm9sTmFtZSxcbiAga25vd25IVE1MRWxlbWVudE5hbWVzLFxuICBrbm93blNWR0VsZW1lbnROYW1lcyxcbiAga25vd25FbGVtZW50TmFtZXMsXG4gIHZvaWRFbGVtZW50TmFtZXMsXG4gIGlzS25vd25FbGVtZW50LFxuICBpc0tub3duU1ZHRWxlbWVudCxcbiAgaXNWb2lkRWxlbWVudCxcbiAgQ2hhclJlZixcbiAgQ29tbWVudCxcbiAgUmF3LFxuICBpc0FycmF5LFxuICBpc0NvbnN0cnVjdGVkT2JqZWN0LFxuICBpc051bGx5LFxuICBpc1ZhbGlkQXR0cmlidXRlTmFtZSxcbiAgZmxhdHRlbkF0dHJpYnV0ZXMsXG4gIHRvSFRNTCxcbiAgVEVYVE1PREUsXG4gIHRvVGV4dCxcbiAgVmlzaXRvcixcbiAgVHJhbnNmb3JtaW5nVmlzaXRvcixcbiAgVG9IVE1MVmlzaXRvcixcbiAgVG9UZXh0VmlzaXRvcixcbn0pO1xuIiwiXG5leHBvcnQgY29uc3QgVGFnID0gZnVuY3Rpb24gKCkge307XG5UYWcucHJvdG90eXBlLnRhZ05hbWUgPSAnJzsgLy8gdGhpcyB3aWxsIGJlIHNldCBwZXIgVGFnIHN1YmNsYXNzXG5UYWcucHJvdG90eXBlLmF0dHJzID0gbnVsbDtcblRhZy5wcm90b3R5cGUuY2hpbGRyZW4gPSBPYmplY3QuZnJlZXplID8gT2JqZWN0LmZyZWV6ZShbXSkgOiBbXTtcblRhZy5wcm90b3R5cGUuaHRtbGpzVHlwZSA9IFRhZy5odG1sanNUeXBlID0gWydUYWcnXTtcblxuLy8gR2l2ZW4gXCJwXCIgY3JlYXRlIHRoZSBmdW5jdGlvbiBgSFRNTC5QYC5cbnZhciBtYWtlVGFnQ29uc3RydWN0b3IgPSBmdW5jdGlvbiAodGFnTmFtZSkge1xuICAvLyBUYWcgaXMgdGhlIHBlci10YWdOYW1lIGNvbnN0cnVjdG9yIG9mIGEgSFRNTC5UYWcgc3ViY2xhc3NcbiAgdmFyIEhUTUxUYWcgPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgIC8vIFdvcmsgd2l0aCBvciB3aXRob3V0IGBuZXdgLiAgSWYgbm90IGNhbGxlZCB3aXRoIGBuZXdgLFxuICAgIC8vIHBlcmZvcm0gaW5zdGFudGlhdGlvbiBieSByZWN1cnNpdmVseSBjYWxsaW5nIHRoaXMgY29uc3RydWN0b3IuXG4gICAgLy8gV2UgY2FuJ3QgcGFzcyB2YXJhcmdzLCBzbyBwYXNzIG5vIGFyZ3MuXG4gICAgdmFyIGluc3RhbmNlID0gKHRoaXMgaW5zdGFuY2VvZiBUYWcpID8gdGhpcyA6IG5ldyBIVE1MVGFnO1xuXG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBhdHRycyA9IGFyZ3MubGVuZ3RoICYmIGFyZ3NbMF07XG4gICAgaWYgKGF0dHJzICYmICh0eXBlb2YgYXR0cnMgPT09ICdvYmplY3QnKSkge1xuICAgICAgLy8gVHJlYXQgdmFuaWxsYSBKUyBvYmplY3QgYXMgYW4gYXR0cmlidXRlcyBkaWN0aW9uYXJ5LlxuICAgICAgaWYgKCEgaXNDb25zdHJ1Y3RlZE9iamVjdChhdHRycykpIHtcbiAgICAgICAgaW5zdGFuY2UuYXR0cnMgPSBhdHRycztcbiAgICAgICAgaSsrO1xuICAgICAgfSBlbHNlIGlmIChhdHRycyBpbnN0YW5jZW9mIEF0dHJzKSB7XG4gICAgICAgIHZhciBhcnJheSA9IGF0dHJzLnZhbHVlO1xuICAgICAgICBpZiAoYXJyYXkubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgaW5zdGFuY2UuYXR0cnMgPSBhcnJheVswXTtcbiAgICAgICAgfSBlbHNlIGlmIChhcnJheS5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgaW5zdGFuY2UuYXR0cnMgPSBhcnJheTtcbiAgICAgICAgfVxuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgfVxuXG5cbiAgICAvLyBJZiBubyBjaGlsZHJlbiwgZG9uJ3QgY3JlYXRlIGFuIGFycmF5IGF0IGFsbCwgdXNlIHRoZSBwcm90b3R5cGUnc1xuICAgIC8vIChmcm96ZW4sIGVtcHR5KSBhcnJheS4gIFRoaXMgd2F5IHdlIGRvbid0IGNyZWF0ZSBhbiBlbXB0eSBhcnJheVxuICAgIC8vIGV2ZXJ5IHRpbWUgc29tZW9uZSBjcmVhdGVzIGEgdGFnIHdpdGhvdXQgYG5ld2AgYW5kIHRoaXMgY29uc3RydWN0b3JcbiAgICAvLyBjYWxscyBpdHNlbGYgd2l0aCBubyBhcmd1bWVudHMgKGFib3ZlKS5cbiAgICBpZiAoaSA8IGFyZ3MubGVuZ3RoKVxuICAgICAgaW5zdGFuY2UuY2hpbGRyZW4gPSBhcmdzLnNsaWNlKGkpO1xuXG4gICAgcmV0dXJuIGluc3RhbmNlO1xuICB9O1xuICBIVE1MVGFnLnByb3RvdHlwZSA9IG5ldyBUYWc7XG4gIEhUTUxUYWcucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gSFRNTFRhZztcbiAgSFRNTFRhZy5wcm90b3R5cGUudGFnTmFtZSA9IHRhZ05hbWU7XG5cbiAgcmV0dXJuIEhUTUxUYWc7XG59O1xuXG4vLyBOb3QgYW4gSFRNTGpzIG5vZGUsIGJ1dCBhIHdyYXBwZXIgdG8gcGFzcyBtdWx0aXBsZSBhdHRycyBkaWN0aW9uYXJpZXNcbi8vIHRvIGEgdGFnIChmb3IgdGhlIHB1cnBvc2Ugb2YgaW1wbGVtZW50aW5nIGR5bmFtaWMgYXR0cmlidXRlcykuXG5leHBvcnQgZnVuY3Rpb24gQXR0cnMoLi4uYXJncykge1xuICAvLyBXb3JrIHdpdGggb3Igd2l0aG91dCBgbmV3YC4gIElmIG5vdCBjYWxsZWQgd2l0aCBgbmV3YCxcbiAgLy8gcGVyZm9ybSBpbnN0YW50aWF0aW9uIGJ5IHJlY3Vyc2l2ZWx5IGNhbGxpbmcgdGhpcyBjb25zdHJ1Y3Rvci5cbiAgLy8gV2UgY2FuJ3QgcGFzcyB2YXJhcmdzLCBzbyBwYXNzIG5vIGFyZ3MuXG4gIHZhciBpbnN0YW5jZSA9ICh0aGlzIGluc3RhbmNlb2YgQXR0cnMpID8gdGhpcyA6IG5ldyBBdHRycztcblxuICBpbnN0YW5jZS52YWx1ZSA9IGFyZ3M7XG5cbiAgcmV0dXJuIGluc3RhbmNlO1xufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8gS05PV04gRUxFTUVOVFNcbmV4cG9ydCBjb25zdCBIVE1MVGFncyA9IHt9O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VGFnICh0YWdOYW1lKSB7XG4gIHZhciBzeW1ib2xOYW1lID0gZ2V0U3ltYm9sTmFtZSh0YWdOYW1lKTtcbiAgaWYgKHN5bWJvbE5hbWUgPT09IHRhZ05hbWUpIC8vIGFsbC1jYXBzIHRhZ05hbWVcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVc2UgdGhlIGxvd2VyY2FzZSBvciBjYW1lbENhc2UgZm9ybSBvZiAnXCIgKyB0YWdOYW1lICsgXCInIGhlcmVcIik7XG5cbiAgaWYgKCEgSFRNTFRhZ3Nbc3ltYm9sTmFtZV0pXG4gICAgSFRNTFRhZ3Nbc3ltYm9sTmFtZV0gPSBtYWtlVGFnQ29uc3RydWN0b3IodGFnTmFtZSk7XG5cbiAgcmV0dXJuIEhUTUxUYWdzW3N5bWJvbE5hbWVdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlVGFnKHRhZ05hbWUpIHtcbiAgZ2V0VGFnKHRhZ05hbWUpOyAvLyBkb24ndCByZXR1cm4gaXRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVGFnRW5zdXJlZCAodGFnTmFtZSkge1xuICByZXR1cm4gaXNLbm93bkVsZW1lbnQodGFnTmFtZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTeW1ib2xOYW1lICh0YWdOYW1lKSB7XG4gIC8vIFwiZm9vLWJhclwiIC0+IFwiRk9PX0JBUlwiXG4gIHJldHVybiB0YWdOYW1lLnRvVXBwZXJDYXNlKCkucmVwbGFjZSgvLS9nLCAnXycpO1xufVxuXG5leHBvcnQgY29uc3Qga25vd25IVE1MRWxlbWVudE5hbWVzID0gJ2EgYWJiciBhY3JvbnltIGFkZHJlc3MgYXBwbGV0IGFyZWEgYXJ0aWNsZSBhc2lkZSBhdWRpbyBiIGJhc2UgYmFzZWZvbnQgYmRpIGJkbyBiaWcgYmxvY2txdW90ZSBib2R5IGJyIGJ1dHRvbiBjYW52YXMgY2FwdGlvbiBjZW50ZXIgY2l0ZSBjb2RlIGNvbCBjb2xncm91cCBjb21tYW5kIGRhdGEgZGF0YWdyaWQgZGF0YWxpc3QgZGQgZGVsIGRldGFpbHMgZGZuIGRpciBkaXYgZGwgZHQgZW0gZW1iZWQgZXZlbnRzb3VyY2UgZmllbGRzZXQgZmlnY2FwdGlvbiBmaWd1cmUgZm9udCBmb290ZXIgZm9ybSBmcmFtZSBmcmFtZXNldCBoMSBoMiBoMyBoNCBoNSBoNiBoZWFkIGhlYWRlciBoZ3JvdXAgaHIgaHRtbCBpIGlmcmFtZSBpbWcgaW5wdXQgaW5zIGlzaW5kZXgga2JkIGtleWdlbiBsYWJlbCBsZWdlbmQgbGkgbGluayBtYWluIG1hcCBtYXJrIG1lbnUgbWV0YSBtZXRlciBuYXYgbm9mcmFtZXMgbm9zY3JpcHQgb2JqZWN0IG9sIG9wdGdyb3VwIG9wdGlvbiBvdXRwdXQgcCBwYXJhbSBwcmUgcHJvZ3Jlc3MgcSBycCBydCBydWJ5IHMgc2FtcCBzY3JpcHQgc2VjdGlvbiBzZWxlY3Qgc21hbGwgc291cmNlIHNwYW4gc3RyaWtlIHN0cm9uZyBzdHlsZSBzdWIgc3VtbWFyeSBzdXAgdGFibGUgdGJvZHkgdGQgdGV4dGFyZWEgdGZvb3QgdGggdGhlYWQgdGltZSB0aXRsZSB0ciB0cmFjayB0dCB1IHVsIHZhciB2aWRlbyB3YnInLnNwbGl0KCcgJyk7XG4vLyAod2UgYWRkIHRoZSBTVkcgb25lcyBiZWxvdylcblxuZXhwb3J0IGNvbnN0IGtub3duU1ZHRWxlbWVudE5hbWVzID0gJ2FsdEdseXBoIGFsdEdseXBoRGVmIGFsdEdseXBoSXRlbSBhbmltYXRlIGFuaW1hdGVDb2xvciBhbmltYXRlTW90aW9uIGFuaW1hdGVUcmFuc2Zvcm0gY2lyY2xlIGNsaXBQYXRoIGNvbG9yLXByb2ZpbGUgY3Vyc29yIGRlZnMgZGVzYyBlbGxpcHNlIGZlQmxlbmQgZmVDb2xvck1hdHJpeCBmZUNvbXBvbmVudFRyYW5zZmVyIGZlQ29tcG9zaXRlIGZlQ29udm9sdmVNYXRyaXggZmVEaWZmdXNlTGlnaHRpbmcgZmVEaXNwbGFjZW1lbnRNYXAgZmVEaXN0YW50TGlnaHQgZmVGbG9vZCBmZUZ1bmNBIGZlRnVuY0IgZmVGdW5jRyBmZUZ1bmNSIGZlR2F1c3NpYW5CbHVyIGZlSW1hZ2UgZmVNZXJnZSBmZU1lcmdlTm9kZSBmZU1vcnBob2xvZ3kgZmVPZmZzZXQgZmVQb2ludExpZ2h0IGZlU3BlY3VsYXJMaWdodGluZyBmZVNwb3RMaWdodCBmZVRpbGUgZmVUdXJidWxlbmNlIGZpbHRlciBmb250IGZvbnQtZmFjZSBmb250LWZhY2UtZm9ybWF0IGZvbnQtZmFjZS1uYW1lIGZvbnQtZmFjZS1zcmMgZm9udC1mYWNlLXVyaSBmb3JlaWduT2JqZWN0IGcgZ2x5cGggZ2x5cGhSZWYgaGtlcm4gaW1hZ2UgbGluZSBsaW5lYXJHcmFkaWVudCBtYXJrZXIgbWFzayBtZXRhZGF0YSBtaXNzaW5nLWdseXBoIHBhdGggcGF0dGVybiBwb2x5Z29uIHBvbHlsaW5lIHJhZGlhbEdyYWRpZW50IHJlY3Qgc2V0IHN0b3Agc3R5bGUgc3ZnIHN3aXRjaCBzeW1ib2wgdGV4dCB0ZXh0UGF0aCB0aXRsZSB0cmVmIHRzcGFuIHVzZSB2aWV3IHZrZXJuJy5zcGxpdCgnICcpO1xuLy8gQXBwZW5kIFNWRyBlbGVtZW50IG5hbWVzIHRvIGxpc3Qgb2Yga25vd24gZWxlbWVudCBuYW1lc1xuZXhwb3J0IGNvbnN0IGtub3duRWxlbWVudE5hbWVzID0ga25vd25IVE1MRWxlbWVudE5hbWVzLmNvbmNhdChrbm93blNWR0VsZW1lbnROYW1lcyk7XG5cbmV4cG9ydCBjb25zdCB2b2lkRWxlbWVudE5hbWVzID0gJ2FyZWEgYmFzZSBiciBjb2wgY29tbWFuZCBlbWJlZCBociBpbWcgaW5wdXQga2V5Z2VuIGxpbmsgbWV0YSBwYXJhbSBzb3VyY2UgdHJhY2sgd2JyJy5zcGxpdCgnICcpO1xuXG5cbnZhciB2b2lkRWxlbWVudFNldCA9IG5ldyBTZXQodm9pZEVsZW1lbnROYW1lcyk7XG52YXIga25vd25FbGVtZW50U2V0ID0gbmV3IFNldChrbm93bkVsZW1lbnROYW1lcyk7XG52YXIga25vd25TVkdFbGVtZW50U2V0ID0gbmV3IFNldChrbm93blNWR0VsZW1lbnROYW1lcyk7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0tub3duRWxlbWVudCh0YWdOYW1lKSB7XG4gIHJldHVybiBrbm93bkVsZW1lbnRTZXQuaGFzKHRhZ05hbWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNLbm93blNWR0VsZW1lbnQodGFnTmFtZSkge1xuICByZXR1cm4ga25vd25TVkdFbGVtZW50U2V0Lmhhcyh0YWdOYW1lKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVm9pZEVsZW1lbnQodGFnTmFtZSkge1xuICByZXR1cm4gdm9pZEVsZW1lbnRTZXQuaGFzKHRhZ05hbWUpO1xufVxuXG5cbi8vIEVuc3VyZSB0YWdzIGZvciBhbGwga25vd24gZWxlbWVudHNcbmtub3duRWxlbWVudE5hbWVzLmZvckVhY2goZW5zdXJlVGFnKTtcblxuXG5leHBvcnQgZnVuY3Rpb24gQ2hhclJlZihhdHRycykge1xuICBpZiAoISAodGhpcyBpbnN0YW5jZW9mIENoYXJSZWYpKVxuICAgIC8vIGNhbGxlZCB3aXRob3V0IGBuZXdgXG4gICAgcmV0dXJuIG5ldyBDaGFyUmVmKGF0dHJzKTtcblxuICBpZiAoISAoYXR0cnMgJiYgYXR0cnMuaHRtbCAmJiBhdHRycy5zdHIpKVxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIFwiSFRNTC5DaGFyUmVmIG11c3QgYmUgY29uc3RydWN0ZWQgd2l0aCAoe2h0bWw6Li4uLCBzdHI6Li4ufSlcIik7XG5cbiAgdGhpcy5odG1sID0gYXR0cnMuaHRtbDtcbiAgdGhpcy5zdHIgPSBhdHRycy5zdHI7XG59XG5DaGFyUmVmLnByb3RvdHlwZS5odG1sanNUeXBlID0gQ2hhclJlZi5odG1sanNUeXBlID0gWydDaGFyUmVmJ107XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21tZW50KHZhbHVlKSB7XG4gIGlmICghICh0aGlzIGluc3RhbmNlb2YgQ29tbWVudCkpXG4gICAgLy8gY2FsbGVkIHdpdGhvdXQgYG5ld2BcbiAgICByZXR1cm4gbmV3IENvbW1lbnQodmFsdWUpO1xuXG4gIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKVxuICAgIHRocm93IG5ldyBFcnJvcignSFRNTC5Db21tZW50IG11c3QgYmUgY29uc3RydWN0ZWQgd2l0aCBhIHN0cmluZycpO1xuXG4gIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgLy8gS2lsbCBpbGxlZ2FsIGh5cGhlbnMgaW4gY29tbWVudCB2YWx1ZSAobm8gd2F5IHRvIGVzY2FwZSB0aGVtIGluIEhUTUwpXG4gIHRoaXMuc2FuaXRpemVkVmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9eLXwtLSt8LSQvZywgJycpO1xufVxuQ29tbWVudC5wcm90b3R5cGUuaHRtbGpzVHlwZSA9IENvbW1lbnQuaHRtbGpzVHlwZSA9IFsnQ29tbWVudCddO1xuXG5leHBvcnQgZnVuY3Rpb24gUmF3KHZhbHVlKSB7XG4gIGlmICghICh0aGlzIGluc3RhbmNlb2YgUmF3KSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgUmF3KHZhbHVlKTtcblxuICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0hUTUwuUmF3IG11c3QgYmUgY29uc3RydWN0ZWQgd2l0aCBhIHN0cmluZycpO1xuXG4gIHRoaXMudmFsdWUgPSB2YWx1ZTtcbn1cblJhdy5wcm90b3R5cGUuaHRtbGpzVHlwZSA9IFJhdy5odG1sanNUeXBlID0gWydSYXcnXTtcblxuXG5leHBvcnQgZnVuY3Rpb24gaXNBcnJheSAoeCkge1xuICByZXR1cm4geCBpbnN0YW5jZW9mIEFycmF5IHx8IEFycmF5LmlzQXJyYXkoeCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0NvbnN0cnVjdGVkT2JqZWN0ICh4KSB7XG4gIC8vIEZpZ3VyZSBvdXQgaWYgYHhgIGlzIFwiYW4gaW5zdGFuY2Ugb2Ygc29tZSBjbGFzc1wiIG9yIGp1c3QgYSBwbGFpblxuICAvLyBvYmplY3QgbGl0ZXJhbC4gIEl0IGNvcnJlY3RseSB0cmVhdHMgYW4gb2JqZWN0IGxpdGVyYWwgbGlrZVxuICAvLyBgeyBjb25zdHJ1Y3RvcjogLi4uIH1gIGFzIGFuIG9iamVjdCBsaXRlcmFsLiAgSXQgd29uJ3QgZGV0ZWN0XG4gIC8vIGluc3RhbmNlcyBvZiBjbGFzc2VzIHRoYXQgbGFjayBhIGBjb25zdHJ1Y3RvcmAgcHJvcGVydHkgKGUuZy5cbiAgLy8gaWYgeW91IGFzc2lnbiB0byBhIHByb3RvdHlwZSB3aGVuIHNldHRpbmcgdXAgdGhlIGNsYXNzIGFzIGluOlxuICAvLyBgRm9vID0gZnVuY3Rpb24gKCkgeyAuLi4gfTsgRm9vLnByb3RvdHlwZSA9IHsgLi4uIH1gLCB0aGVuXG4gIC8vIGAobmV3IEZvbykuY29uc3RydWN0b3JgIGlzIGBPYmplY3RgLCBub3QgYEZvb2ApLlxuICBpZigheCB8fCAodHlwZW9mIHggIT09ICdvYmplY3QnKSkgcmV0dXJuIGZhbHNlO1xuICAvLyBJcyB0aGlzIGEgcGxhaW4gb2JqZWN0P1xuICBsZXQgcGxhaW4gPSBmYWxzZTtcbiAgaWYoT2JqZWN0LmdldFByb3RvdHlwZU9mKHgpID09PSBudWxsKSB7XG4gICAgcGxhaW4gPSB0cnVlO1xuICB9IGVsc2Uge1xuICAgIGxldCBwcm90byA9IHg7XG4gICAgd2hpbGUoT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvKSAhPT0gbnVsbCkge1xuICAgICAgcHJvdG8gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YocHJvdG8pO1xuICAgIH1cbiAgICBwbGFpbiA9IE9iamVjdC5nZXRQcm90b3R5cGVPZih4KSA9PT0gcHJvdG87XG4gIH1cblxuICByZXR1cm4gIXBsYWluICYmXG4gICAgKHR5cGVvZiB4LmNvbnN0cnVjdG9yID09PSAnZnVuY3Rpb24nKSAmJlxuICAgICh4IGluc3RhbmNlb2YgeC5jb25zdHJ1Y3Rvcik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc051bGx5IChub2RlKSB7XG4gIGlmIChub2RlID09IG51bGwpXG4gICAgLy8gbnVsbCBvciB1bmRlZmluZWRcbiAgICByZXR1cm4gdHJ1ZTtcblxuICBpZiAoaXNBcnJheShub2RlKSkge1xuICAgIC8vIGlzIGl0IGFuIGVtcHR5IGFycmF5IG9yIGFuIGFycmF5IG9mIGFsbCBudWxseSBpdGVtcz9cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGUubGVuZ3RoOyBpKyspXG4gICAgICBpZiAoISBpc051bGx5KG5vZGVbaV0pKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkQXR0cmlidXRlTmFtZSAobmFtZSkge1xuICByZXR1cm4gL15bOl9BLVphLXpdWzpfQS1aYS16MC05LlxcLV0qLy50ZXN0KG5hbWUpO1xufVxuXG4vLyBJZiBgYXR0cnNgIGlzIGFuIGFycmF5IG9mIGF0dHJpYnV0ZXMgZGljdGlvbmFyaWVzLCBjb21iaW5lcyB0aGVtXG4vLyBpbnRvIG9uZS4gIFJlbW92ZXMgYXR0cmlidXRlcyB0aGF0IGFyZSBcIm51bGx5LlwiXG5leHBvcnQgZnVuY3Rpb24gZmxhdHRlbkF0dHJpYnV0ZXMgKGF0dHJzKSB7XG4gIGlmICghIGF0dHJzKVxuICAgIHJldHVybiBhdHRycztcblxuICB2YXIgaXNMaXN0ID0gaXNBcnJheShhdHRycyk7XG4gIGlmIChpc0xpc3QgJiYgYXR0cnMubGVuZ3RoID09PSAwKVxuICAgIHJldHVybiBudWxsO1xuXG4gIHZhciByZXN1bHQgPSB7fTtcbiAgZm9yICh2YXIgaSA9IDAsIE4gPSAoaXNMaXN0ID8gYXR0cnMubGVuZ3RoIDogMSk7IGkgPCBOOyBpKyspIHtcbiAgICB2YXIgb25lQXR0cnMgPSAoaXNMaXN0ID8gYXR0cnNbaV0gOiBhdHRycyk7XG4gICAgaWYgKCh0eXBlb2Ygb25lQXR0cnMgIT09ICdvYmplY3QnKSB8fFxuICAgICAgICBpc0NvbnN0cnVjdGVkT2JqZWN0KG9uZUF0dHJzKSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIHBsYWluIEpTIG9iamVjdCBhcyBhdHRycywgZm91bmQ6IFwiICsgb25lQXR0cnMpO1xuICAgIGZvciAodmFyIG5hbWUgaW4gb25lQXR0cnMpIHtcbiAgICAgIGlmICghIGlzVmFsaWRBdHRyaWJ1dGVOYW1lKG5hbWUpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbGxlZ2FsIEhUTUwgYXR0cmlidXRlIG5hbWU6IFwiICsgbmFtZSk7XG4gICAgICB2YXIgdmFsdWUgPSBvbmVBdHRyc1tuYW1lXTtcbiAgICAgIGlmICghIGlzTnVsbHkodmFsdWUpKVxuICAgICAgICByZXN1bHRbbmFtZV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuIiwiaW1wb3J0IHtcbiAgVGFnLFxuICBDaGFyUmVmLFxuICBDb21tZW50LFxuICBSYXcsXG4gIGlzQXJyYXksXG4gIGdldFRhZyxcbiAgaXNDb25zdHJ1Y3RlZE9iamVjdCxcbiAgZmxhdHRlbkF0dHJpYnV0ZXMsXG4gIGlzVm9pZEVsZW1lbnQsXG59IGZyb20gJy4vaHRtbCc7XG5cblxudmFyIElERU5USVRZID0gZnVuY3Rpb24gKHgpIHsgcmV0dXJuIHg7IH07XG5cbi8vIF9hc3NpZ24gaXMgbGlrZSBfLmV4dGVuZCBvciB0aGUgdXBjb21pbmcgT2JqZWN0LmFzc2lnbi5cbi8vIENvcHkgc3JjJ3Mgb3duLCBlbnVtZXJhYmxlIHByb3BlcnRpZXMgb250byB0Z3QgYW5kIHJldHVyblxuLy8gdGd0LlxudmFyIF9oYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG52YXIgX2Fzc2lnbiA9IGZ1bmN0aW9uICh0Z3QsIHNyYykge1xuICBmb3IgKHZhciBrIGluIHNyYykge1xuICAgIGlmIChfaGFzT3duUHJvcGVydHkuY2FsbChzcmMsIGspKVxuICAgICAgdGd0W2tdID0gc3JjW2tdO1xuICB9XG4gIHJldHVybiB0Z3Q7XG59O1xuXG5leHBvcnQgY29uc3QgVmlzaXRvciA9IGZ1bmN0aW9uIChwcm9wcykge1xuICBfYXNzaWduKHRoaXMsIHByb3BzKTtcbn07XG5cblZpc2l0b3IuZGVmID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgX2Fzc2lnbih0aGlzLnByb3RvdHlwZSwgb3B0aW9ucyk7XG59O1xuXG5WaXNpdG9yLmV4dGVuZCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBjdXJUeXBlID0gdGhpcztcbiAgdmFyIHN1YlR5cGUgPSBmdW5jdGlvbiBIVE1MVmlzaXRvclN1YnR5cGUoLyphcmd1bWVudHMqLykge1xuICAgIFZpc2l0b3IuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfTtcbiAgc3ViVHlwZS5wcm90b3R5cGUgPSBuZXcgY3VyVHlwZTtcbiAgc3ViVHlwZS5leHRlbmQgPSBjdXJUeXBlLmV4dGVuZDtcbiAgc3ViVHlwZS5kZWYgPSBjdXJUeXBlLmRlZjtcbiAgaWYgKG9wdGlvbnMpXG4gICAgX2Fzc2lnbihzdWJUeXBlLnByb3RvdHlwZSwgb3B0aW9ucyk7XG4gIHJldHVybiBzdWJUeXBlO1xufTtcblxuVmlzaXRvci5kZWYoe1xuICB2aXNpdDogZnVuY3Rpb24gKGNvbnRlbnQvKiwgLi4uKi8pIHtcbiAgICBpZiAoY29udGVudCA9PSBudWxsKVxuICAgICAgLy8gbnVsbCBvciB1bmRlZmluZWQuXG4gICAgICByZXR1cm4gdGhpcy52aXNpdE51bGwuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgIGlmICh0eXBlb2YgY29udGVudCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGlmIChjb250ZW50Lmh0bWxqc1R5cGUpIHtcbiAgICAgICAgc3dpdGNoIChjb250ZW50Lmh0bWxqc1R5cGUpIHtcbiAgICAgICAgY2FzZSBUYWcuaHRtbGpzVHlwZTpcbiAgICAgICAgICByZXR1cm4gdGhpcy52aXNpdFRhZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICBjYXNlIENoYXJSZWYuaHRtbGpzVHlwZTpcbiAgICAgICAgICByZXR1cm4gdGhpcy52aXNpdENoYXJSZWYuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgY2FzZSBDb21tZW50Lmh0bWxqc1R5cGU6XG4gICAgICAgICAgcmV0dXJuIHRoaXMudmlzaXRDb21tZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGNhc2UgUmF3Lmh0bWxqc1R5cGU6XG4gICAgICAgICAgcmV0dXJuIHRoaXMudmlzaXRSYXcuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIGh0bWxqcyB0eXBlOiBcIiArIGNvbnRlbnQuaHRtbGpzVHlwZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGlzQXJyYXkoY29udGVudCkpXG4gICAgICAgIHJldHVybiB0aGlzLnZpc2l0QXJyYXkuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgICAgcmV0dXJuIHRoaXMudmlzaXRPYmplY3QuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgIH0gZWxzZSBpZiAoKHR5cGVvZiBjb250ZW50ID09PSAnc3RyaW5nJykgfHxcbiAgICAgICAgICAgICAgICh0eXBlb2YgY29udGVudCA9PT0gJ2Jvb2xlYW4nKSB8fFxuICAgICAgICAgICAgICAgKHR5cGVvZiBjb250ZW50ID09PSAnbnVtYmVyJykpIHtcbiAgICAgIHJldHVybiB0aGlzLnZpc2l0UHJpbWl0aXZlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb250ZW50ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gdGhpcy52aXNpdEZ1bmN0aW9uLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBvYmplY3QgaW4gaHRtbGpzOiBcIiArIGNvbnRlbnQpO1xuXG4gIH0sXG4gIHZpc2l0TnVsbDogZnVuY3Rpb24gKG51bGxPclVuZGVmaW5lZC8qLCAuLi4qLykge30sXG4gIHZpc2l0UHJpbWl0aXZlOiBmdW5jdGlvbiAoc3RyaW5nQm9vbGVhbk9yTnVtYmVyLyosIC4uLiovKSB7fSxcbiAgdmlzaXRBcnJheTogZnVuY3Rpb24gKGFycmF5LyosIC4uLiovKSB7fSxcbiAgdmlzaXRDb21tZW50OiBmdW5jdGlvbiAoY29tbWVudC8qLCAuLi4qLykge30sXG4gIHZpc2l0Q2hhclJlZjogZnVuY3Rpb24gKGNoYXJSZWYvKiwgLi4uKi8pIHt9LFxuICB2aXNpdFJhdzogZnVuY3Rpb24gKHJhdy8qLCAuLi4qLykge30sXG4gIHZpc2l0VGFnOiBmdW5jdGlvbiAodGFnLyosIC4uLiovKSB7fSxcbiAgdmlzaXRPYmplY3Q6IGZ1bmN0aW9uIChvYmovKiwgLi4uKi8pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIG9iamVjdCBpbiBodG1sanM6IFwiICsgb2JqKTtcbiAgfSxcbiAgdmlzaXRGdW5jdGlvbjogZnVuY3Rpb24gKGZuLyosIC4uLiovKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBmdW5jdGlvbiBpbiBodG1sanM6IFwiICsgZm4pO1xuICB9XG59KTtcblxuZXhwb3J0IGNvbnN0IFRyYW5zZm9ybWluZ1Zpc2l0b3IgPSBWaXNpdG9yLmV4dGVuZCgpO1xuVHJhbnNmb3JtaW5nVmlzaXRvci5kZWYoe1xuICB2aXNpdE51bGw6IElERU5USVRZLFxuICB2aXNpdFByaW1pdGl2ZTogSURFTlRJVFksXG4gIHZpc2l0QXJyYXk6IGZ1bmN0aW9uIChhcnJheSwgLi4uYXJncykge1xuICAgIHZhciByZXN1bHQgPSBhcnJheTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgb2xkSXRlbSA9IGFycmF5W2ldO1xuICAgICAgdmFyIG5ld0l0ZW0gPSB0aGlzLnZpc2l0KG9sZEl0ZW0sIC4uLmFyZ3MpO1xuICAgICAgaWYgKG5ld0l0ZW0gIT09IG9sZEl0ZW0pIHtcbiAgICAgICAgLy8gY29weSBgYXJyYXlgIG9uIHdyaXRlXG4gICAgICAgIGlmIChyZXN1bHQgPT09IGFycmF5KVxuICAgICAgICAgIHJlc3VsdCA9IGFycmF5LnNsaWNlKCk7XG4gICAgICAgIHJlc3VsdFtpXSA9IG5ld0l0ZW07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG4gIHZpc2l0Q29tbWVudDogSURFTlRJVFksXG4gIHZpc2l0Q2hhclJlZjogSURFTlRJVFksXG4gIHZpc2l0UmF3OiBJREVOVElUWSxcbiAgdmlzaXRPYmplY3Q6IGZ1bmN0aW9uKG9iaiwgLi4uYXJncyl7XG4gICAgLy8gRG9uJ3QgcGFyc2UgTWFya2Rvd24gJiBSQ0RhdGEgYXMgSFRNTFxuICAgIGlmIChvYmoudGV4dE1vZGUgIT0gbnVsbCl7XG4gICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBpZiAoJ2NvbnRlbnQnIGluIG9iaikge1xuICAgICAgb2JqLmNvbnRlbnQgPSB0aGlzLnZpc2l0KG9iai5jb250ZW50LCAuLi5hcmdzKTtcbiAgICB9XG4gICAgaWYgKCdlbHNlQ29udGVudCcgaW4gb2JqKXtcbiAgICAgIG9iai5lbHNlQ29udGVudCA9IHRoaXMudmlzaXQob2JqLmVsc2VDb250ZW50LCAuLi5hcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIG9iajtcbiAgfSxcbiAgdmlzaXRGdW5jdGlvbjogSURFTlRJVFksXG4gIHZpc2l0VGFnOiBmdW5jdGlvbiAodGFnLCAuLi5hcmdzKSB7XG4gICAgdmFyIG9sZENoaWxkcmVuID0gdGFnLmNoaWxkcmVuO1xuICAgIHZhciBuZXdDaGlsZHJlbiA9IHRoaXMudmlzaXRDaGlsZHJlbihvbGRDaGlsZHJlbiwgLi4uYXJncyk7XG5cbiAgICB2YXIgb2xkQXR0cnMgPSB0YWcuYXR0cnM7XG4gICAgdmFyIG5ld0F0dHJzID0gdGhpcy52aXNpdEF0dHJpYnV0ZXMob2xkQXR0cnMsIC4uLmFyZ3MpO1xuXG4gICAgaWYgKG5ld0F0dHJzID09PSBvbGRBdHRycyAmJiBuZXdDaGlsZHJlbiA9PT0gb2xkQ2hpbGRyZW4pXG4gICAgICByZXR1cm4gdGFnO1xuXG4gICAgdmFyIG5ld1RhZyA9IGdldFRhZyh0YWcudGFnTmFtZSkuYXBwbHkobnVsbCwgbmV3Q2hpbGRyZW4pO1xuICAgIG5ld1RhZy5hdHRycyA9IG5ld0F0dHJzO1xuICAgIHJldHVybiBuZXdUYWc7XG4gIH0sXG4gIHZpc2l0Q2hpbGRyZW46IGZ1bmN0aW9uIChjaGlsZHJlbiwgLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLnZpc2l0QXJyYXkoY2hpbGRyZW4sIC4uLmFyZ3MpO1xuICB9LFxuICAvLyBUcmFuc2Zvcm0gdGhlIGAuYXR0cnNgIHByb3BlcnR5IG9mIGEgdGFnLCB3aGljaCBtYXkgYmUgYSBkaWN0aW9uYXJ5LFxuICAvLyBhbiBhcnJheSwgb3IgaW4gc29tZSB1c2VzLCBhIGZvcmVpZ24gb2JqZWN0IChzdWNoIGFzXG4gIC8vIGEgdGVtcGxhdGUgdGFnKS5cbiAgdmlzaXRBdHRyaWJ1dGVzOiBmdW5jdGlvbiAoYXR0cnMsIC4uLmFyZ3MpIHtcbiAgICBpZiAoaXNBcnJheShhdHRycykpIHtcbiAgICAgIHZhciByZXN1bHQgPSBhdHRycztcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXR0cnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIG9sZEl0ZW0gPSBhdHRyc1tpXTtcbiAgICAgICAgdmFyIG5ld0l0ZW0gPSB0aGlzLnZpc2l0QXR0cmlidXRlcyhvbGRJdGVtLCAuLi5hcmdzKTtcbiAgICAgICAgaWYgKG5ld0l0ZW0gIT09IG9sZEl0ZW0pIHtcbiAgICAgICAgICAvLyBjb3B5IG9uIHdyaXRlXG4gICAgICAgICAgaWYgKHJlc3VsdCA9PT0gYXR0cnMpXG4gICAgICAgICAgICByZXN1bHQgPSBhdHRycy5zbGljZSgpO1xuICAgICAgICAgIHJlc3VsdFtpXSA9IG5ld0l0ZW07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgaWYgKGF0dHJzICYmIGlzQ29uc3RydWN0ZWRPYmplY3QoYXR0cnMpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYmFzaWMgVHJhbnNmb3JtaW5nVmlzaXRvciBkb2VzIG5vdCBzdXBwb3J0IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICBcImZvcmVpZ24gb2JqZWN0cyBpbiBhdHRyaWJ1dGVzLiAgRGVmaW5lIGEgY3VzdG9tIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICBcInZpc2l0QXR0cmlidXRlcyBmb3IgdGhpcyBjYXNlLlwiKTtcbiAgICB9XG5cbiAgICB2YXIgb2xkQXR0cnMgPSBhdHRycztcbiAgICB2YXIgbmV3QXR0cnMgPSBvbGRBdHRycztcbiAgICBpZiAob2xkQXR0cnMpIHtcbiAgICAgIHZhciBhdHRyQXJncyA9IFtudWxsLCBudWxsXTtcbiAgICAgIGF0dHJBcmdzLnB1c2guYXBwbHkoYXR0ckFyZ3MsIGFyZ3VtZW50cyk7XG4gICAgICBmb3IgKHZhciBrIGluIG9sZEF0dHJzKSB7XG4gICAgICAgIHZhciBvbGRWYWx1ZSA9IG9sZEF0dHJzW2tdO1xuICAgICAgICBhdHRyQXJnc1swXSA9IGs7XG4gICAgICAgIGF0dHJBcmdzWzFdID0gb2xkVmFsdWU7XG4gICAgICAgIHZhciBuZXdWYWx1ZSA9IHRoaXMudmlzaXRBdHRyaWJ1dGUuYXBwbHkodGhpcywgYXR0ckFyZ3MpO1xuICAgICAgICBpZiAobmV3VmFsdWUgIT09IG9sZFZhbHVlKSB7XG4gICAgICAgICAgLy8gY29weSBvbiB3cml0ZVxuICAgICAgICAgIGlmIChuZXdBdHRycyA9PT0gb2xkQXR0cnMpXG4gICAgICAgICAgICBuZXdBdHRycyA9IF9hc3NpZ24oe30sIG9sZEF0dHJzKTtcbiAgICAgICAgICBuZXdBdHRyc1trXSA9IG5ld1ZhbHVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld0F0dHJzO1xuICB9LFxuICAvLyBUcmFuc2Zvcm0gdGhlIHZhbHVlIG9mIG9uZSBhdHRyaWJ1dGUgbmFtZS92YWx1ZSBpbiBhblxuICAvLyBhdHRyaWJ1dGVzIGRpY3Rpb25hcnkuXG4gIHZpc2l0QXR0cmlidXRlOiBmdW5jdGlvbiAobmFtZSwgdmFsdWUsIHRhZywgLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLnZpc2l0KHZhbHVlLCAuLi5hcmdzKTtcbiAgfVxufSk7XG5cblxuZXhwb3J0IGNvbnN0IFRvVGV4dFZpc2l0b3IgPSBWaXNpdG9yLmV4dGVuZCgpO1xuVG9UZXh0VmlzaXRvci5kZWYoe1xuICB2aXNpdE51bGw6IGZ1bmN0aW9uIChudWxsT3JVbmRlZmluZWQpIHtcbiAgICByZXR1cm4gJyc7XG4gIH0sXG4gIHZpc2l0UHJpbWl0aXZlOiBmdW5jdGlvbiAoc3RyaW5nQm9vbGVhbk9yTnVtYmVyKSB7XG4gICAgdmFyIHN0ciA9IFN0cmluZyhzdHJpbmdCb29sZWFuT3JOdW1iZXIpO1xuICAgIGlmICh0aGlzLnRleHRNb2RlID09PSBURVhUTU9ERS5SQ0RBVEEpIHtcbiAgICAgIHJldHVybiBzdHIucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7Jyk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnRleHRNb2RlID09PSBURVhUTU9ERS5BVFRSSUJVVEUpIHtcbiAgICAgIC8vIGVzY2FwZSBgJmAgYW5kIGBcImAgdGhpcyB0aW1lLCBub3QgYCZgIGFuZCBgPGBcbiAgICAgIHJldHVybiBzdHIucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuICB9LFxuICB2aXNpdEFycmF5OiBmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICB2YXIgcGFydHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKVxuICAgICAgcGFydHMucHVzaCh0aGlzLnZpc2l0KGFycmF5W2ldKSk7XG4gICAgcmV0dXJuIHBhcnRzLmpvaW4oJycpO1xuICB9LFxuICB2aXNpdENvbW1lbnQ6IGZ1bmN0aW9uIChjb21tZW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgaGF2ZSBhIGNvbW1lbnQgaGVyZVwiKTtcbiAgfSxcbiAgdmlzaXRDaGFyUmVmOiBmdW5jdGlvbiAoY2hhclJlZikge1xuICAgIGlmICh0aGlzLnRleHRNb2RlID09PSBURVhUTU9ERS5SQ0RBVEEgfHxcbiAgICAgICAgdGhpcy50ZXh0TW9kZSA9PT0gVEVYVE1PREUuQVRUUklCVVRFKSB7XG4gICAgICByZXR1cm4gY2hhclJlZi5odG1sO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY2hhclJlZi5zdHI7XG4gICAgfVxuICB9LFxuICB2aXNpdFJhdzogZnVuY3Rpb24gKHJhdykge1xuICAgIHJldHVybiByYXcudmFsdWU7XG4gIH0sXG4gIHZpc2l0VGFnOiBmdW5jdGlvbiAodGFnKSB7XG4gICAgLy8gUmVhbGx5IHdlIHNob3VsZCBqdXN0IGRpc2FsbG93IFRhZ3MgaGVyZS4gIEhvd2V2ZXIsIGF0IHRoZVxuICAgIC8vIG1vbWVudCBpdCdzIHVzZWZ1bCB0byBzdHJpbmdpZnkgYW55IEhUTUwgd2UgZmluZC4gIEluXG4gICAgLy8gcGFydGljdWxhciwgd2hlbiB5b3UgaW5jbHVkZSBhIHRlbXBsYXRlIHdpdGhpbiBge3sjbWFya2Rvd259fWAsXG4gICAgLy8gd2UgcmVuZGVyIHRoZSB0ZW1wbGF0ZSBhcyB0ZXh0LCBhbmQgc2luY2UgdGhlcmUncyBjdXJyZW50bHlcbiAgICAvLyBubyB3YXkgdG8gbWFrZSB0aGUgdGVtcGxhdGUgYmUgKnBhcnNlZCogYXMgdGV4dCAoZS5nLiBgPHRlbXBsYXRlXG4gICAgLy8gdHlwZT1cInRleHRcIj5gKSwgd2UgaGFja2lzaGx5IHN1cHBvcnQgSFRNTCB0YWdzIGluIG1hcmtkb3duXG4gICAgLy8gaW4gdGVtcGxhdGVzIGJ5IHBhcnNpbmcgdGhlbSBhbmQgc3RyaW5naWZ5aW5nIHRoZW0uXG4gICAgcmV0dXJuIHRoaXMudmlzaXQodGhpcy50b0hUTUwodGFnKSk7XG4gIH0sXG4gIHZpc2l0T2JqZWN0OiBmdW5jdGlvbiAoeCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgb2JqZWN0IGluIGh0bWxqcyBpbiB0b1RleHQ6IFwiICsgeCk7XG4gIH0sXG4gIHRvSFRNTDogZnVuY3Rpb24gKG5vZGUpIHtcbiAgICByZXR1cm4gdG9IVE1MKG5vZGUpO1xuICB9XG59KTtcblxuXG5cbmV4cG9ydCBjb25zdCBUb0hUTUxWaXNpdG9yID0gVmlzaXRvci5leHRlbmQoKTtcblRvSFRNTFZpc2l0b3IuZGVmKHtcbiAgdmlzaXROdWxsOiBmdW5jdGlvbiAobnVsbE9yVW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuICcnO1xuICB9LFxuICB2aXNpdFByaW1pdGl2ZTogZnVuY3Rpb24gKHN0cmluZ0Jvb2xlYW5Pck51bWJlcikge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoc3RyaW5nQm9vbGVhbk9yTnVtYmVyKTtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpO1xuICB9LFxuICB2aXNpdEFycmF5OiBmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICB2YXIgcGFydHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKVxuICAgICAgcGFydHMucHVzaCh0aGlzLnZpc2l0KGFycmF5W2ldKSk7XG4gICAgcmV0dXJuIHBhcnRzLmpvaW4oJycpO1xuICB9LFxuICB2aXNpdENvbW1lbnQ6IGZ1bmN0aW9uIChjb21tZW50KSB7XG4gICAgcmV0dXJuICc8IS0tJyArIGNvbW1lbnQuc2FuaXRpemVkVmFsdWUgKyAnLS0+JztcbiAgfSxcbiAgdmlzaXRDaGFyUmVmOiBmdW5jdGlvbiAoY2hhclJlZikge1xuICAgIHJldHVybiBjaGFyUmVmLmh0bWw7XG4gIH0sXG4gIHZpc2l0UmF3OiBmdW5jdGlvbiAocmF3KSB7XG4gICAgcmV0dXJuIHJhdy52YWx1ZTtcbiAgfSxcbiAgdmlzaXRUYWc6IGZ1bmN0aW9uICh0YWcpIHtcbiAgICB2YXIgYXR0clN0cnMgPSBbXTtcblxuICAgIHZhciB0YWdOYW1lID0gdGFnLnRhZ05hbWU7XG4gICAgdmFyIGNoaWxkcmVuID0gdGFnLmNoaWxkcmVuO1xuXG4gICAgdmFyIGF0dHJzID0gdGFnLmF0dHJzO1xuICAgIGlmIChhdHRycykge1xuICAgICAgYXR0cnMgPSBmbGF0dGVuQXR0cmlidXRlcyhhdHRycyk7XG4gICAgICBmb3IgKHZhciBrIGluIGF0dHJzKSB7XG4gICAgICAgIGlmIChrID09PSAndmFsdWUnICYmIHRhZ05hbWUgPT09ICd0ZXh0YXJlYScpIHtcbiAgICAgICAgICBjaGlsZHJlbiA9IFthdHRyc1trXSwgY2hpbGRyZW5dO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciB2ID0gdGhpcy50b1RleHQoYXR0cnNba10sIFRFWFRNT0RFLkFUVFJJQlVURSk7XG4gICAgICAgICAgYXR0clN0cnMucHVzaCgnICcgKyBrICsgJz1cIicgKyB2ICsgJ1wiJyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgc3RhcnRUYWcgPSAnPCcgKyB0YWdOYW1lICsgYXR0clN0cnMuam9pbignJykgKyAnPic7XG5cbiAgICB2YXIgY2hpbGRTdHJzID0gW107XG4gICAgdmFyIGNvbnRlbnQ7XG4gICAgaWYgKHRhZ05hbWUgPT09ICd0ZXh0YXJlYScpIHtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKylcbiAgICAgICAgY2hpbGRTdHJzLnB1c2godGhpcy50b1RleHQoY2hpbGRyZW5baV0sIFRFWFRNT0RFLlJDREFUQSkpO1xuXG4gICAgICBjb250ZW50ID0gY2hpbGRTdHJzLmpvaW4oJycpO1xuICAgICAgaWYgKGNvbnRlbnQuc2xpY2UoMCwgMSkgPT09ICdcXG4nKVxuICAgICAgICAvLyBURVhUQVJFQSB3aWxsIGFic29yYiBhIG5ld2xpbmUsIHNvIGlmIHdlIHNlZSBvbmUsIGFkZFxuICAgICAgICAvLyBhbm90aGVyIG9uZS5cbiAgICAgICAgY29udGVudCA9ICdcXG4nICsgY29udGVudDtcblxuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKVxuICAgICAgICBjaGlsZFN0cnMucHVzaCh0aGlzLnZpc2l0KGNoaWxkcmVuW2ldKSk7XG5cbiAgICAgIGNvbnRlbnQgPSBjaGlsZFN0cnMuam9pbignJyk7XG4gICAgfVxuXG4gICAgdmFyIHJlc3VsdCA9IHN0YXJ0VGFnICsgY29udGVudDtcblxuICAgIGlmIChjaGlsZHJlbi5sZW5ndGggfHwgISBpc1ZvaWRFbGVtZW50KHRhZ05hbWUpKSB7XG4gICAgICAvLyBcIlZvaWRcIiBlbGVtZW50cyBsaWtlIEJSIGFyZSB0aGUgb25seSBvbmVzIHRoYXQgZG9uJ3QgZ2V0IGEgY2xvc2VcbiAgICAgIC8vIHRhZyBpbiBIVE1MNS4gIFRoZXkgc2hvdWxkbid0IGhhdmUgY29udGVudHMsIGVpdGhlciwgc28gd2UgY291bGRcbiAgICAgIC8vIHRocm93IGFuIGVycm9yIHVwb24gc2VlaW5nIGNvbnRlbnRzIGhlcmUuXG4gICAgICByZXN1bHQgKz0gJzwvJyArIHRhZ05hbWUgKyAnPic7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcbiAgdmlzaXRPYmplY3Q6IGZ1bmN0aW9uICh4KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBvYmplY3QgaW4gaHRtbGpzIGluIHRvSFRNTDogXCIgKyB4KTtcbiAgfSxcbiAgdG9UZXh0OiBmdW5jdGlvbiAobm9kZSwgdGV4dE1vZGUpIHtcbiAgICByZXR1cm4gdG9UZXh0KG5vZGUsIHRleHRNb2RlKTtcbiAgfVxufSk7XG5cblxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8gVE9IVE1MXG5cbmV4cG9ydCBmdW5jdGlvbiB0b0hUTUwoY29udGVudCkge1xuICByZXR1cm4gKG5ldyBUb0hUTUxWaXNpdG9yKS52aXNpdChjb250ZW50KTtcbn1cblxuLy8gRXNjYXBpbmcgbW9kZXMgZm9yIG91dHB1dHRpbmcgdGV4dCB3aGVuIGdlbmVyYXRpbmcgSFRNTC5cbmV4cG9ydCBjb25zdCBURVhUTU9ERSA9IHtcbiAgU1RSSU5HOiAxLFxuICBSQ0RBVEE6IDIsXG4gIEFUVFJJQlVURTogM1xufTtcblxuXG5leHBvcnQgZnVuY3Rpb24gdG9UZXh0KGNvbnRlbnQsIHRleHRNb2RlKSB7XG4gIGlmICghIHRleHRNb2RlKVxuICAgIHRocm93IG5ldyBFcnJvcihcInRleHRNb2RlIHJlcXVpcmVkIGZvciBIVE1MLnRvVGV4dFwiKTtcbiAgaWYgKCEgKHRleHRNb2RlID09PSBURVhUTU9ERS5TVFJJTkcgfHxcbiAgICAgICAgIHRleHRNb2RlID09PSBURVhUTU9ERS5SQ0RBVEEgfHxcbiAgICAgICAgIHRleHRNb2RlID09PSBURVhUTU9ERS5BVFRSSUJVVEUpKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gdGV4dE1vZGU6IFwiICsgdGV4dE1vZGUpO1xuXG4gIHZhciB2aXNpdG9yID0gbmV3IFRvVGV4dFZpc2l0b3Ioe3RleHRNb2RlOiB0ZXh0TW9kZX0pO1xuICByZXR1cm4gdmlzaXRvci52aXNpdChjb250ZW50KTtcbn1cbiJdfQ==
