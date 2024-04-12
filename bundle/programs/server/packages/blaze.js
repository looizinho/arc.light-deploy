Package["core-runtime"].queue("blaze", ["meteor", "tracker", "check", "observe-sequence", "reactive-var", "ordered-dict", "ecmascript", "htmljs", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var check = Package.check.check;
var Match = Package.check.Match;
var ObserveSequence = Package['observe-sequence'].ObserveSequence;
var ReactiveVar = Package['reactive-var'].ReactiveVar;
var OrderedDict = Package['ordered-dict'].OrderedDict;
var ECMAScript = Package.ecmascript.ECMAScript;
var HTML = Package.htmljs.HTML;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var Blaze, UI, Handlebars;

var require = meteorInstall({"node_modules":{"meteor":{"blaze":{"preamble.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/preamble.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * @namespace Blaze
 * @summary The namespace for all Blaze-related methods and classes.
 */
Blaze = {};

// Utility to HTML-escape a string.  Included for legacy reasons.
// TODO: Should be replaced with _.escape once underscore is upgraded to a newer
//       version which escapes ` (backtick) as well. Underscore 1.5.2 does not.
Blaze._escape = function () {
  var escape_map = {
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
    /* IE allows backtick-delimited attributes?? */
    "&": "&amp;"
  };
  var escape_one = function (c) {
    return escape_map[c];
  };
  return function (x) {
    return x.replace(/[&<>"'`]/g, escape_one);
  };
}();
Blaze._warn = function (msg) {
  msg = 'Warning: ' + msg;
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(msg);
  }
};
var nativeBind = Function.prototype.bind;

// An implementation of _.bind which allows better optimization.
// See: https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
if (nativeBind) {
  Blaze._bind = function (func, obj) {
    if (arguments.length === 2) {
      return nativeBind.call(func, obj);
    }

    // Copy the arguments so this function can be optimized.
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return nativeBind.apply(func, args.slice(1));
  };
} else {
  // A slower but backwards compatible version.
  Blaze._bind = function (objA, objB) {
    objA.bind(objB);
  };
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"exceptions.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/exceptions.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var debugFunc;

// We call into user code in many places, and it's nice to catch exceptions
// propagated from user code immediately so that the whole system doesn't just
// break.  Catching exceptions is easy; reporting them is hard.  This helper
// reports exceptions.
//
// Usage:
//
// ```
// try {
//   // ... someStuff ...
// } catch (e) {
//   reportUIException(e);
// }
// ```
//
// An optional second argument overrides the default message.

// Set this to `true` to cause `reportException` to throw
// the next exception rather than reporting it.  This is
// useful in unit tests that test error messages.
Blaze._throwNextException = false;
Blaze._reportException = function (e, msg) {
  if (Blaze._throwNextException) {
    Blaze._throwNextException = false;
    throw e;
  }
  if (!debugFunc)
    // adapted from Tracker
    debugFunc = function () {
      return typeof Meteor !== "undefined" ? Meteor._debug : typeof console !== "undefined" && console.log ? console.log : function () {};
    };

  // In Chrome, `e.stack` is a multiline string that starts with the message
  // and contains a stack trace.  Furthermore, `console.log` makes it clickable.
  // `console.log` supplies the space between the two arguments.
  debugFunc()(msg || 'Exception caught in template:', e.stack || e.message || e);
};
Blaze._wrapCatchingExceptions = function (f, where) {
  if (typeof f !== 'function') return f;
  return function () {
    try {
      return f.apply(this, arguments);
    } catch (e) {
      Blaze._reportException(e, 'Exception in ' + where + ':');
    }
  };
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"view.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/view.js                                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/// [new] Blaze.View([name], renderMethod)
///
/// Blaze.View is the building block of reactive DOM.  Views have
/// the following features:
///
/// * lifecycle callbacks - Views are created, rendered, and destroyed,
///   and callbacks can be registered to fire when these things happen.
///
/// * parent pointer - A View points to its parentView, which is the
///   View that caused it to be rendered.  These pointers form a
///   hierarchy or tree of Views.
///
/// * render() method - A View's render() method specifies the DOM
///   (or HTML) content of the View.  If the method establishes
///   reactive dependencies, it may be re-run.
///
/// * a DOMRange - If a View is rendered to DOM, its position and
///   extent in the DOM are tracked using a DOMRange object.
///
/// When a View is constructed by calling Blaze.View, the View is
/// not yet considered "created."  It doesn't have a parentView yet,
/// and no logic has been run to initialize the View.  All real
/// work is deferred until at least creation time, when the onViewCreated
/// callbacks are fired, which happens when the View is "used" in
/// some way that requires it to be rendered.
///
/// ...more lifecycle stuff
///
/// `name` is an optional string tag identifying the View.  The only
/// time it's used is when looking in the View tree for a View of a
/// particular name; for example, data contexts are stored on Views
/// of name "with".  Names are also useful when debugging, so in
/// general it's good for functions that create Views to set the name.
/// Views associated with templates have names of the form "Template.foo".

/**
 * A binding is either `undefined` (pending), `{ error }` (rejected), or
 * `{ value }` (resolved). Synchronous values are immediately resolved (i.e.,
 * `{ value }` is used). The other states are reserved for asynchronous bindings
 * (i.e., values wrapped with `Promise`s).
 * @typedef {{ error: unknown } | { value: unknown } | undefined} Binding
 */

/**
 * @class
 * @summary Constructor for a View, which represents a reactive region of DOM.
 * @locus Client
 * @param {String} [name] Optional.  A name for this type of View.  See [`view.name`](#view_name).
 * @param {Function} renderFunction A function that returns [*renderable content*](#Renderable-Content).  In this function, `this` is bound to the View.
 */
Blaze.View = function (name, render) {
  if (!(this instanceof Blaze.View))
    // called without `new`
    return new Blaze.View(name, render);
  if (typeof name === 'function') {
    // omitted "name" argument
    render = name;
    name = '';
  }
  this.name = name;
  this._render = render;
  this._callbacks = {
    created: null,
    rendered: null,
    destroyed: null
  };

  // Setting all properties here is good for readability,
  // and also may help Chrome optimize the code by keeping
  // the View object from changing shape too much.
  this.isCreated = false;
  this._isCreatedForExpansion = false;
  this.isRendered = false;
  this._isAttached = false;
  this.isDestroyed = false;
  this._isInRender = false;
  this.parentView = null;
  this._domrange = null;
  // This flag is normally set to false except for the cases when view's parent
  // was generated as part of expanding some syntactic sugar expressions or
  // methods.
  // Ex.: Blaze.renderWithData is an equivalent to creating a view with regular
  // Blaze.render and wrapping it into {{#with data}}{{/with}} view. Since the
  // users don't know anything about these generated parent views, Blaze needs
  // this information to be available on views to make smarter decisions. For
  // example: removing the generated parent view with the view on Blaze.remove.
  this._hasGeneratedParent = false;
  // Bindings accessible to children views (via view.lookup('name')) within the
  // closest template view.
  /** @type {Record<string, ReactiveVar<Binding>>} */
  this._scopeBindings = {};
  this.renderCount = 0;
};
Blaze.View.prototype._render = function () {
  return null;
};
Blaze.View.prototype.onViewCreated = function (cb) {
  this._callbacks.created = this._callbacks.created || [];
  this._callbacks.created.push(cb);
};
Blaze.View.prototype._onViewRendered = function (cb) {
  this._callbacks.rendered = this._callbacks.rendered || [];
  this._callbacks.rendered.push(cb);
};
Blaze.View.prototype.onViewReady = function (cb) {
  var self = this;
  var fire = function () {
    Tracker.afterFlush(function () {
      if (!self.isDestroyed) {
        Blaze._withCurrentView(self, function () {
          cb.call(self);
        });
      }
    });
  };
  self._onViewRendered(function onViewRendered() {
    if (self.isDestroyed) return;
    if (!self._domrange.attached) self._domrange.onAttached(fire);else fire();
  });
};
Blaze.View.prototype.onViewDestroyed = function (cb) {
  this._callbacks.destroyed = this._callbacks.destroyed || [];
  this._callbacks.destroyed.push(cb);
};
Blaze.View.prototype.removeViewDestroyedListener = function (cb) {
  var destroyed = this._callbacks.destroyed;
  if (!destroyed) return;
  var index = destroyed.lastIndexOf(cb);
  if (index !== -1) {
    // XXX You'd think the right thing to do would be splice, but _fireCallbacks
    // gets sad if you remove callbacks while iterating over the list.  Should
    // change this to use callback-hook or EventEmitter or something else that
    // properly supports removal.
    destroyed[index] = null;
  }
};

/// View#autorun(func)
///
/// Sets up a Tracker autorun that is "scoped" to this View in two
/// important ways: 1) Blaze.currentView is automatically set
/// on every re-run, and 2) the autorun is stopped when the
/// View is destroyed.  As with Tracker.autorun, the first run of
/// the function is immediate, and a Computation object that can
/// be used to stop the autorun is returned.
///
/// View#autorun is meant to be called from View callbacks like
/// onViewCreated, or from outside the rendering process.  It may not
/// be called before the onViewCreated callbacks are fired (too early),
/// or from a render() method (too confusing).
///
/// Typically, autoruns that update the state
/// of the View (as in Blaze.With) should be started from an onViewCreated
/// callback.  Autoruns that update the DOM should be started
/// from either onViewCreated (guarded against the absence of
/// view._domrange), or onViewReady.
Blaze.View.prototype.autorun = function (f, _inViewScope, displayName) {
  var self = this;

  // The restrictions on when View#autorun can be called are in order
  // to avoid bad patterns, like creating a Blaze.View and immediately
  // calling autorun on it.  A freshly created View is not ready to
  // have logic run on it; it doesn't have a parentView, for example.
  // It's when the View is materialized or expanded that the onViewCreated
  // handlers are fired and the View starts up.
  //
  // Letting the render() method call `this.autorun()` is problematic
  // because of re-render.  The best we can do is to stop the old
  // autorun and start a new one for each render, but that's a pattern
  // we try to avoid internally because it leads to helpers being
  // called extra times, in the case where the autorun causes the
  // view to re-render (and thus the autorun to be torn down and a
  // new one established).
  //
  // We could lift these restrictions in various ways.  One interesting
  // idea is to allow you to call `view.autorun` after instantiating
  // `view`, and automatically wrap it in `view.onViewCreated`, deferring
  // the autorun so that it starts at an appropriate time.  However,
  // then we can't return the Computation object to the caller, because
  // it doesn't exist yet.
  if (!self.isCreated) {
    throw new Error("View#autorun must be called from the created callback at the earliest");
  }
  if (this._isInRender) {
    throw new Error("Can't call View#autorun from inside render(); try calling it from the created or rendered callback");
  }
  var templateInstanceFunc = Blaze.Template._currentTemplateInstanceFunc;
  var func = function viewAutorun(c) {
    return Blaze._withCurrentView(_inViewScope || self, function () {
      return Blaze.Template._withTemplateInstanceFunc(templateInstanceFunc, function () {
        return f.call(self, c);
      });
    });
  };

  // Give the autorun function a better name for debugging and profiling.
  // The `displayName` property is not part of the spec but browsers like Chrome
  // and Firefox prefer it in debuggers over the name function was declared by.
  func.displayName = (self.name || 'anonymous') + ':' + (displayName || 'anonymous');
  var comp = Tracker.autorun(func);
  var stopComputation = function () {
    comp.stop();
  };
  self.onViewDestroyed(stopComputation);
  comp.onStop(function () {
    self.removeViewDestroyedListener(stopComputation);
  });
  return comp;
};
Blaze.View.prototype._errorIfShouldntCallSubscribe = function () {
  var self = this;
  if (!self.isCreated) {
    throw new Error("View#subscribe must be called from the created callback at the earliest");
  }
  if (self._isInRender) {
    throw new Error("Can't call View#subscribe from inside render(); try calling it from the created or rendered callback");
  }
  if (self.isDestroyed) {
    throw new Error("Can't call View#subscribe from inside the destroyed callback, try calling it inside created or rendered.");
  }
};

/**
 * Just like Blaze.View#autorun, but with Meteor.subscribe instead of
 * Tracker.autorun. Stop the subscription when the view is destroyed.
 * @return {SubscriptionHandle} A handle to the subscription so that you can
 * see if it is ready, or stop it manually
 */
Blaze.View.prototype.subscribe = function (args, options) {
  var self = this;
  options = options || {};
  self._errorIfShouldntCallSubscribe();
  var subHandle;
  if (options.connection) {
    subHandle = options.connection.subscribe.apply(options.connection, args);
  } else {
    subHandle = Meteor.subscribe.apply(Meteor, args);
  }
  self.onViewDestroyed(function () {
    subHandle.stop();
  });
  return subHandle;
};
Blaze.View.prototype.firstNode = function () {
  if (!this._isAttached) throw new Error("View must be attached before accessing its DOM");
  return this._domrange.firstNode();
};
Blaze.View.prototype.lastNode = function () {
  if (!this._isAttached) throw new Error("View must be attached before accessing its DOM");
  return this._domrange.lastNode();
};
Blaze._fireCallbacks = function (view, which) {
  Blaze._withCurrentView(view, function () {
    Tracker.nonreactive(function fireCallbacks() {
      var cbs = view._callbacks[which];
      for (var i = 0, N = cbs && cbs.length; i < N; i++) cbs[i] && cbs[i].call(view);
    });
  });
};
Blaze._createView = function (view, parentView, forExpansion) {
  if (view.isCreated) throw new Error("Can't render the same View twice");
  view.parentView = parentView || null;
  view.isCreated = true;
  if (forExpansion) view._isCreatedForExpansion = true;
  Blaze._fireCallbacks(view, 'created');
};
var doFirstRender = function (view, initialContent) {
  var domrange = new Blaze._DOMRange(initialContent);
  view._domrange = domrange;
  domrange.view = view;
  view.isRendered = true;
  Blaze._fireCallbacks(view, 'rendered');
  var teardownHook = null;
  domrange.onAttached(function attached(range, element) {
    view._isAttached = true;
    teardownHook = Blaze._DOMBackend.Teardown.onElementTeardown(element, function teardown() {
      Blaze._destroyView(view, true /* _skipNodes */);
    });
  });

  // tear down the teardown hook
  view.onViewDestroyed(function () {
    teardownHook && teardownHook.stop();
    teardownHook = null;
  });
  return domrange;
};

// Take an uncreated View `view` and create and render it to DOM,
// setting up the autorun that updates the View.  Returns a new
// DOMRange, which has been associated with the View.
//
// The private arguments `_workStack` and `_intoArray` are passed in
// by Blaze._materializeDOM and are only present for recursive calls
// (when there is some other _materializeView on the stack).  If
// provided, then we avoid the mutual recursion of calling back into
// Blaze._materializeDOM so that deep View hierarchies don't blow the
// stack.  Instead, we push tasks onto workStack for the initial
// rendering and subsequent setup of the View, and they are done after
// we return.  When there is a _workStack, we do not return the new
// DOMRange, but instead push it into _intoArray from a _workStack
// task.
Blaze._materializeView = function (view, parentView, _workStack, _intoArray) {
  Blaze._createView(view, parentView);
  var domrange;
  var lastHtmljs;
  // We don't expect to be called in a Computation, but just in case,
  // wrap in Tracker.nonreactive.
  Tracker.nonreactive(function () {
    view.autorun(function doRender(c) {
      // `view.autorun` sets the current view.
      view.renderCount++;
      view._isInRender = true;
      // Any dependencies that should invalidate this Computation come
      // from this line:
      var htmljs = view._render();
      view._isInRender = false;
      if (!c.firstRun && !Blaze._isContentEqual(lastHtmljs, htmljs)) {
        Tracker.nonreactive(function doMaterialize() {
          // re-render
          var rangesAndNodes = Blaze._materializeDOM(htmljs, [], view);
          domrange.setMembers(rangesAndNodes);
          Blaze._fireCallbacks(view, 'rendered');
        });
      }
      lastHtmljs = htmljs;

      // Causes any nested views to stop immediately, not when we call
      // `setMembers` the next time around the autorun.  Otherwise,
      // helpers in the DOM tree to be replaced might be scheduled
      // to re-run before we have a chance to stop them.
      Tracker.onInvalidate(function () {
        if (domrange) {
          domrange.destroyMembers();
        }
      });
    }, undefined, 'materialize');

    // first render.  lastHtmljs is the first htmljs.
    var initialContents;
    if (!_workStack) {
      initialContents = Blaze._materializeDOM(lastHtmljs, [], view);
      domrange = doFirstRender(view, initialContents);
      initialContents = null; // help GC because we close over this scope a lot
    } else {
      // We're being called from Blaze._materializeDOM, so to avoid
      // recursion and save stack space, provide a description of the
      // work to be done instead of doing it.  Tasks pushed onto
      // _workStack will be done in LIFO order after we return.
      // The work will still be done within a Tracker.nonreactive,
      // because it will be done by some call to Blaze._materializeDOM
      // (which is always called in a Tracker.nonreactive).
      initialContents = [];
      // push this function first so that it happens last
      _workStack.push(function () {
        domrange = doFirstRender(view, initialContents);
        initialContents = null; // help GC because of all the closures here
        _intoArray.push(domrange);
      });
      // now push the task that calculates initialContents
      _workStack.push(Blaze._bind(Blaze._materializeDOM, null, lastHtmljs, initialContents, view, _workStack));
    }
  });
  if (!_workStack) {
    return domrange;
  } else {
    return null;
  }
};

// Expands a View to HTMLjs, calling `render` recursively on all
// Views and evaluating any dynamic attributes.  Calls the `created`
// callback, but not the `materialized` or `rendered` callbacks.
// Destroys the view immediately, unless called in a Tracker Computation,
// in which case the view will be destroyed when the Computation is
// invalidated.  If called in a Tracker Computation, the result is a
// reactive string; that is, the Computation will be invalidated
// if any changes are made to the view or subviews that might affect
// the HTML.
Blaze._expandView = function (view, parentView) {
  Blaze._createView(view, parentView, true /*forExpansion*/);
  view._isInRender = true;
  var htmljs = Blaze._withCurrentView(view, function () {
    return view._render();
  });
  view._isInRender = false;
  var result = Blaze._expand(htmljs, view);
  if (Tracker.active) {
    Tracker.onInvalidate(function () {
      Blaze._destroyView(view);
    });
  } else {
    Blaze._destroyView(view);
  }
  return result;
};

// Options: `parentView`
Blaze._HTMLJSExpander = HTML.TransformingVisitor.extend();
Blaze._HTMLJSExpander.def({
  visitObject: function (x) {
    if (x instanceof Blaze.Template) x = x.constructView();
    if (x instanceof Blaze.View) return Blaze._expandView(x, this.parentView);

    // this will throw an error; other objects are not allowed!
    return HTML.TransformingVisitor.prototype.visitObject.call(this, x);
  },
  visitAttributes: function (attrs) {
    // expand dynamic attributes
    if (typeof attrs === 'function') attrs = Blaze._withCurrentView(this.parentView, attrs);

    // call super (e.g. for case where `attrs` is an array)
    return HTML.TransformingVisitor.prototype.visitAttributes.call(this, attrs);
  },
  visitAttribute: function (name, value, tag) {
    // expand attribute values that are functions.  Any attribute value
    // that contains Views must be wrapped in a function.
    if (typeof value === 'function') value = Blaze._withCurrentView(this.parentView, value);
    return HTML.TransformingVisitor.prototype.visitAttribute.call(this, name, value, tag);
  }
});

// Return Blaze.currentView, but only if it is being rendered
// (i.e. we are in its render() method).
var currentViewIfRendering = function () {
  var view = Blaze.currentView;
  return view && view._isInRender ? view : null;
};
Blaze._expand = function (htmljs, parentView) {
  parentView = parentView || currentViewIfRendering();
  return new Blaze._HTMLJSExpander({
    parentView: parentView
  }).visit(htmljs);
};
Blaze._expandAttributes = function (attrs, parentView) {
  parentView = parentView || currentViewIfRendering();
  return new Blaze._HTMLJSExpander({
    parentView: parentView
  }).visitAttributes(attrs);
};
Blaze._destroyView = function (view, _skipNodes) {
  if (view.isDestroyed) return;
  view.isDestroyed = true;

  // Destroy views and elements recursively.  If _skipNodes,
  // only recurse up to views, not elements, for the case where
  // the backend (jQuery) is recursing over the elements already.

  if (view._domrange) view._domrange.destroyMembers(_skipNodes);

  // XXX: fire callbacks after potential members are destroyed
  // otherwise it's tracker.flush will cause the above line will
  // not be called and their views won't be destroyed
  // Involved issues: DOMRange "Must be attached" error, mem leak

  Blaze._fireCallbacks(view, 'destroyed');
};
Blaze._destroyNode = function (node) {
  if (node.nodeType === 1) Blaze._DOMBackend.Teardown.tearDownElement(node);
};

// Are the HTMLjs entities `a` and `b` the same?  We could be
// more elaborate here but the point is to catch the most basic
// cases.
Blaze._isContentEqual = function (a, b) {
  if (a instanceof HTML.Raw) {
    return b instanceof HTML.Raw && a.value === b.value;
  } else if (a == null) {
    return b == null;
  } else {
    return a === b && (typeof a === 'number' || typeof a === 'boolean' || typeof a === 'string');
  }
};

/**
 * @summary The View corresponding to the current template helper, event handler, callback, or autorun.  If there isn't one, `null`.
 * @locus Client
 * @type {Blaze.View}
 */
Blaze.currentView = null;

/**
 * @template T
 * @param {Blaze.View} view
 * @param {() => T} func
 * @returns {T}
 */
Blaze._withCurrentView = function (view, func) {
  var oldView = Blaze.currentView;
  try {
    Blaze.currentView = view;
    return func();
  } finally {
    Blaze.currentView = oldView;
  }
};

// Blaze.render publicly takes a View or a Template.
// Privately, it takes any HTMLJS (extended with Views and Templates)
// except null or undefined, or a function that returns any extended
// HTMLJS.
var checkRenderContent = function (content) {
  if (content === null) throw new Error("Can't render null");
  if (typeof content === 'undefined') throw new Error("Can't render undefined");
  if (content instanceof Blaze.View || content instanceof Blaze.Template || typeof content === 'function') return;
  try {
    // Throw if content doesn't look like HTMLJS at the top level
    // (i.e. verify that this is an HTML.Tag, or an array,
    // or a primitive, etc.)
    new HTML.Visitor().visit(content);
  } catch (e) {
    // Make error message suitable for public API
    throw new Error("Expected Template or View");
  }
};

// For Blaze.render and Blaze.toHTML, take content and
// wrap it in a View, unless it's a single View or
// Template already.
var contentAsView = function (content) {
  checkRenderContent(content);
  if (content instanceof Blaze.Template) {
    return content.constructView();
  } else if (content instanceof Blaze.View) {
    return content;
  } else {
    var func = content;
    if (typeof func !== 'function') {
      func = function () {
        return content;
      };
    }
    return Blaze.View('render', func);
  }
};

// For Blaze.renderWithData and Blaze.toHTMLWithData, wrap content
// in a function, if necessary, so it can be a content arg to
// a Blaze.With.
var contentAsFunc = function (content) {
  checkRenderContent(content);
  if (typeof content !== 'function') {
    return function () {
      return content;
    };
  } else {
    return content;
  }
};
Blaze.__rootViews = [];

/**
 * @summary Renders a template or View to DOM nodes and inserts it into the DOM, returning a rendered [View](#Blaze-View) which can be passed to [`Blaze.remove`](#Blaze-remove).
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object to render.  If a template, a View object is [constructed](#template_constructview).  If a View, it must be an unrendered View, which becomes a rendered View and is returned.
 * @param {DOMNode} parentNode The node that will be the parent of the rendered template.  It must be an Element node.
 * @param {DOMNode} [nextNode] Optional. If provided, must be a child of <em>parentNode</em>; the template will be inserted before this node. If not provided, the template will be inserted as the last child of parentNode.
 * @param {Blaze.View} [parentView] Optional. If provided, it will be set as the rendered View's [`parentView`](#view_parentview).
 */
Blaze.render = function (content, parentElement, nextNode, parentView) {
  if (!parentElement) {
    Blaze._warn("Blaze.render without a parent element is deprecated. " + "You must specify where to insert the rendered content.");
  }
  if (nextNode instanceof Blaze.View) {
    // handle omitted nextNode
    parentView = nextNode;
    nextNode = null;
  }

  // parentElement must be a DOM node. in particular, can't be the
  // result of a call to `$`. Can't check if `parentElement instanceof
  // Node` since 'Node' is undefined in IE8.
  if (parentElement && typeof parentElement.nodeType !== 'number') throw new Error("'parentElement' must be a DOM node");
  if (nextNode && typeof nextNode.nodeType !== 'number')
    // 'nextNode' is optional
    throw new Error("'nextNode' must be a DOM node");
  parentView = parentView || currentViewIfRendering();
  var view = contentAsView(content);

  // TODO: this is only needed in development
  if (!parentView) {
    view.onViewCreated(function () {
      Blaze.__rootViews.push(view);
    });
    view.onViewDestroyed(function () {
      var index = Blaze.__rootViews.indexOf(view);
      if (index > -1) {
        Blaze.__rootViews.splice(index, 1);
      }
    });
  }
  Blaze._materializeView(view, parentView);
  if (parentElement) {
    view._domrange.attach(parentElement, nextNode);
  }
  return view;
};
Blaze.insert = function (view, parentElement, nextNode) {
  Blaze._warn("Blaze.insert has been deprecated.  Specify where to insert the " + "rendered content in the call to Blaze.render.");
  if (!(view && view._domrange instanceof Blaze._DOMRange)) throw new Error("Expected template rendered with Blaze.render");
  view._domrange.attach(parentElement, nextNode);
};

/**
 * @summary Renders a template or View to DOM nodes with a data context.  Otherwise identical to `Blaze.render`.
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object to render.
 * @param {Object|Function} data The data context to use, or a function returning a data context.  If a function is provided, it will be reactively re-run.
 * @param {DOMNode} parentNode The node that will be the parent of the rendered template.  It must be an Element node.
 * @param {DOMNode} [nextNode] Optional. If provided, must be a child of <em>parentNode</em>; the template will be inserted before this node. If not provided, the template will be inserted as the last child of parentNode.
 * @param {Blaze.View} [parentView] Optional. If provided, it will be set as the rendered View's [`parentView`](#view_parentview).
 */
Blaze.renderWithData = function (content, data, parentElement, nextNode, parentView) {
  // We defer the handling of optional arguments to Blaze.render.  At this point,
  // `nextNode` may actually be `parentView`.
  return Blaze.render(Blaze._TemplateWith(data, contentAsFunc(content)), parentElement, nextNode, parentView);
};

/**
 * @summary Removes a rendered View from the DOM, stopping all reactive updates and event listeners on it. Also destroys the Blaze.Template instance associated with the view.
 * @locus Client
 * @param {Blaze.View} renderedView The return value from `Blaze.render` or `Blaze.renderWithData`, or the `view` property of a Blaze.Template instance. Calling `Blaze.remove(Template.instance().view)` from within a template event handler will destroy the view as well as that template and trigger the template's `onDestroyed` handlers.
 */
Blaze.remove = function (view) {
  if (!(view && view._domrange instanceof Blaze._DOMRange)) throw new Error("Expected template rendered with Blaze.render");
  while (view) {
    if (!view.isDestroyed) {
      var range = view._domrange;
      range.destroy();
      if (range.attached && !range.parentRange) {
        range.detach();
      }
    }
    view = view._hasGeneratedParent && view.parentView;
  }
};

/**
 * @summary Renders a template or View to a string of HTML.
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object from which to generate HTML.
 */
Blaze.toHTML = function (content, parentView) {
  parentView = parentView || currentViewIfRendering();
  return HTML.toHTML(Blaze._expandView(contentAsView(content), parentView));
};

/**
 * @summary Renders a template or View to HTML with a data context.  Otherwise identical to `Blaze.toHTML`.
 * @locus Client
 * @param {Template|Blaze.View} templateOrView The template (e.g. `Template.myTemplate`) or View object from which to generate HTML.
 * @param {Object|Function} data The data context to use, or a function returning a data context.
 */
Blaze.toHTMLWithData = function (content, data, parentView) {
  parentView = parentView || currentViewIfRendering();
  return HTML.toHTML(Blaze._expandView(Blaze._TemplateWith(data, contentAsFunc(content)), parentView));
};
Blaze._toText = function (htmljs, parentView, textMode) {
  if (typeof htmljs === 'function') throw new Error("Blaze._toText doesn't take a function, just HTMLjs");
  if (parentView != null && !(parentView instanceof Blaze.View)) {
    // omitted parentView argument
    textMode = parentView;
    parentView = null;
  }
  parentView = parentView || currentViewIfRendering();
  if (!textMode) throw new Error("textMode required");
  if (!(textMode === HTML.TEXTMODE.STRING || textMode === HTML.TEXTMODE.RCDATA || textMode === HTML.TEXTMODE.ATTRIBUTE)) throw new Error("Unknown textMode: " + textMode);
  return HTML.toText(Blaze._expand(htmljs, parentView), textMode);
};

/**
 * @summary Returns the current data context, or the data context that was used when rendering a particular DOM element or View from a Meteor template.
 * @locus Client
 * @param {DOMElement|Blaze.View} [elementOrView] Optional.  An element that was rendered by a Meteor, or a View.
 */
Blaze.getData = function (elementOrView) {
  var theWith;
  if (!elementOrView) {
    theWith = Blaze.getView('with');
  } else if (elementOrView instanceof Blaze.View) {
    var view = elementOrView;
    theWith = view.name === 'with' ? view : Blaze.getView(view, 'with');
  } else if (typeof elementOrView.nodeType === 'number') {
    if (elementOrView.nodeType !== 1) throw new Error("Expected DOM element");
    theWith = Blaze.getView(elementOrView, 'with');
  } else {
    throw new Error("Expected DOM element or View");
  }
  return theWith ? theWith.dataVar.get() : null;
};

// For back-compat
Blaze.getElementData = function (element) {
  Blaze._warn("Blaze.getElementData has been deprecated.  Use " + "Blaze.getData(element) instead.");
  if (element.nodeType !== 1) throw new Error("Expected DOM element");
  return Blaze.getData(element);
};

// Both arguments are optional.

/**
 * @summary Gets either the current View, or the View enclosing the given DOM element.
 * @locus Client
 * @param {DOMElement} [element] Optional.  If specified, the View enclosing `element` is returned.
 */
Blaze.getView = function (elementOrView, _viewName) {
  var viewName = _viewName;
  if (typeof elementOrView === 'string') {
    // omitted elementOrView; viewName present
    viewName = elementOrView;
    elementOrView = null;
  }

  // We could eventually shorten the code by folding the logic
  // from the other methods into this method.
  if (!elementOrView) {
    return Blaze._getCurrentView(viewName);
  } else if (elementOrView instanceof Blaze.View) {
    return Blaze._getParentView(elementOrView, viewName);
  } else if (typeof elementOrView.nodeType === 'number') {
    return Blaze._getElementView(elementOrView, viewName);
  } else {
    throw new Error("Expected DOM element or View");
  }
};

// Gets the current view or its nearest ancestor of name
// `name`.
Blaze._getCurrentView = function (name) {
  var view = Blaze.currentView;
  // Better to fail in cases where it doesn't make sense
  // to use Blaze._getCurrentView().  There will be a current
  // view anywhere it does.  You can check Blaze.currentView
  // if you want to know whether there is one or not.
  if (!view) throw new Error("There is no current view");
  if (name) {
    while (view && view.name !== name) view = view.parentView;
    return view || null;
  } else {
    // Blaze._getCurrentView() with no arguments just returns
    // Blaze.currentView.
    return view;
  }
};
Blaze._getParentView = function (view, name) {
  var v = view.parentView;
  if (name) {
    while (v && v.name !== name) v = v.parentView;
  }
  return v || null;
};
Blaze._getElementView = function (elem, name) {
  var range = Blaze._DOMRange.forElement(elem);
  var view = null;
  while (range && !view) {
    view = range.view || null;
    if (!view) {
      if (range.parentRange) range = range.parentRange;else range = Blaze._DOMRange.forElement(range.parentElement);
    }
  }
  if (name) {
    while (view && view.name !== name) view = view.parentView;
    return view || null;
  } else {
    return view;
  }
};
Blaze._addEventMap = function (view, eventMap, thisInHandler) {
  thisInHandler = thisInHandler || null;
  var handles = [];
  if (!view._domrange) throw new Error("View must have a DOMRange");
  view._domrange.onAttached(function attached_eventMaps(range, element) {
    Object.keys(eventMap).forEach(function (spec) {
      let handler = eventMap[spec];
      var clauses = spec.split(/,\s+/);
      // iterate over clauses of spec, e.g. ['click .foo', 'click .bar']
      clauses.forEach(function (clause) {
        var parts = clause.split(/\s+/);
        if (parts.length === 0) return;
        var newEvents = parts.shift();
        var selector = parts.join(' ');
        handles.push(Blaze._EventSupport.listen(element, newEvents, selector, function (evt) {
          if (!range.containsElement(evt.currentTarget, selector, newEvents)) return null;
          var handlerThis = thisInHandler || this;
          var handlerArgs = arguments;
          return Blaze._withCurrentView(view, function () {
            return handler.apply(handlerThis, handlerArgs);
          });
        }, range, function (r) {
          return r.parentRange;
        }));
      });
    });
  });
  view.onViewDestroyed(function () {
    handles.forEach(function (h) {
      h.stop();
    });
    handles.length = 0;
  });
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"builtins.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/builtins.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let has;
    module.link("lodash.has", {
      default(v) {
        has = v;
      }
    }, 0);
    let isObject;
    module.link("lodash.isobject", {
      default(v) {
        isObject = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    Blaze._calculateCondition = function (cond) {
      if (HTML.isArray(cond) && cond.length === 0) cond = false;
      return !!cond;
    };

    /**
     * @summary Constructs a View that renders content with a data context.
     * @locus Client
     * @param {Object|Function} data An object to use as the data context, or a function returning such an object.  If a
     *   function is provided, it will be reactively re-run.
     * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
     */
    Blaze.With = function (data, contentFunc) {
      var view = Blaze.View('with', contentFunc);
      view.dataVar = new ReactiveVar();
      view.onViewCreated(function () {
        if (typeof data === 'function') {
          // `data` is a reactive function
          view.autorun(function () {
            view.dataVar.set(data());
          }, view.parentView, 'setData');
        } else {
          view.dataVar.set(data);
        }
      });
      return view;
    };

    /**
     * @summary Shallow compare of two bindings.
     * @param {Binding} x
     * @param {Binding} y
     */
    function _isEqualBinding(x, y) {
      if (typeof x === 'object' && typeof y === 'object') {
        return x.error === y.error && ReactiveVar._isEqual(x.value, y.value);
      } else {
        return ReactiveVar._isEqual(x, y);
      }
    }

    /**
     * Attaches bindings to the instantiated view.
     * @param {Object} bindings A dictionary of bindings, each binding name
     * corresponds to a value or a function that will be reactively re-run.
     * @param {Blaze.View} view The target.
     */
    Blaze._attachBindingsToView = function (bindings, view) {
      function setBindingValue(name, value) {
        if (value && typeof value.then === 'function') {
          value.then(value => view._scopeBindings[name].set({
            value
          }), error => view._scopeBindings[name].set({
            error
          }));
        } else {
          view._scopeBindings[name].set({
            value
          });
        }
      }
      view.onViewCreated(function () {
        Object.entries(bindings).forEach(function (_ref) {
          let [name, binding] = _ref;
          view._scopeBindings[name] = new ReactiveVar(undefined, _isEqualBinding);
          if (typeof binding === 'function') {
            view.autorun(() => setBindingValue(name, binding()), view.parentView);
          } else {
            setBindingValue(name, binding);
          }
        });
      });
    };

    /**
     * @summary Constructs a View setting the local lexical scope in the block.
     * @param {Function} bindings Dictionary mapping names of bindings to
     * values or computations to reactively re-run.
     * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
     */
    Blaze.Let = function (bindings, contentFunc) {
      var view = Blaze.View('let', contentFunc);
      Blaze._attachBindingsToView(bindings, view);
      return view;
    };

    /**
     * @summary Constructs a View that renders content conditionally.
     * @locus Client
     * @param {Function} conditionFunc A function to reactively re-run.  Whether the result is truthy or falsy determines
     *   whether `contentFunc` or `elseFunc` is shown.  An empty array is considered falsy.
     * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
     * @param {Function} [elseFunc] Optional.  A Function that returns [*renderable content*](#Renderable-Content).  If no
     *   `elseFunc` is supplied, no content is shown in the "else" case.
     */
    Blaze.If = function (conditionFunc, contentFunc, elseFunc, _not) {
      var conditionVar = new ReactiveVar();
      var view = Blaze.View(_not ? 'unless' : 'if', function () {
        return conditionVar.get() ? contentFunc() : elseFunc ? elseFunc() : null;
      });
      view.__conditionVar = conditionVar;
      view.onViewCreated(function () {
        this.autorun(function () {
          var cond = Blaze._calculateCondition(conditionFunc());
          conditionVar.set(_not ? !cond : cond);
        }, this.parentView, 'condition');
      });
      return view;
    };

    /**
     * @summary An inverted [`Blaze.If`](#Blaze-If).
     * @locus Client
     * @param {Function} conditionFunc A function to reactively re-run.  If the result is falsy, `contentFunc` is shown,
     *   otherwise `elseFunc` is shown.  An empty array is considered falsy.
     * @param {Function} contentFunc A Function that returns [*renderable content*](#Renderable-Content).
     * @param {Function} [elseFunc] Optional.  A Function that returns [*renderable content*](#Renderable-Content).  If no
     *   `elseFunc` is supplied, no content is shown in the "else" case.
     */
    Blaze.Unless = function (conditionFunc, contentFunc, elseFunc) {
      return Blaze.If(conditionFunc, contentFunc, elseFunc, true /*_not*/);
    };

    /**
     * @summary Constructs a View that renders `contentFunc` for each item in a sequence.
     * @locus Client
     * @param {Function} argFunc A function to reactively re-run. The function can
     * return one of two options:
     *
     * 1. An object with two fields: '_variable' and '_sequence'. Each iterates over
     *   '_sequence', it may be a Cursor, an array, null, or undefined. Inside the
     *   Each body you will be able to get the current item from the sequence using
     *   the name specified in the '_variable' field.
     *
     * 2. Just a sequence (Cursor, array, null, or undefined) not wrapped into an
     *   object. Inside the Each body, the current item will be set as the data
     *   context.
     * @param {Function} contentFunc A Function that returns  [*renderable
     * content*](#Renderable-Content).
     * @param {Function} [elseFunc] A Function that returns [*renderable
     * content*](#Renderable-Content) to display in the case when there are no items
     * in the sequence.
     */
    Blaze.Each = function (argFunc, contentFunc, elseFunc) {
      var eachView = Blaze.View('each', function () {
        var subviews = this.initialSubviews;
        this.initialSubviews = null;
        if (this._isCreatedForExpansion) {
          this.expandedValueDep = new Tracker.Dependency();
          this.expandedValueDep.depend();
        }
        return subviews;
      });
      eachView.initialSubviews = [];
      eachView.numItems = 0;
      eachView.inElseMode = false;
      eachView.stopHandle = null;
      eachView.contentFunc = contentFunc;
      eachView.elseFunc = elseFunc;
      eachView.argVar = new ReactiveVar();
      eachView.variableName = null;

      // update the @index value in the scope of all subviews in the range
      var updateIndices = function (from, to) {
        if (to === undefined) {
          to = eachView.numItems - 1;
        }
        for (var i = from; i <= to; i++) {
          var view = eachView._domrange.members[i].view;
          view._scopeBindings['@index'].set({
            value: i
          });
        }
      };
      eachView.onViewCreated(function () {
        // We evaluate argFunc in an autorun to make sure
        // Blaze.currentView is always set when it runs (rather than
        // passing argFunc straight to ObserveSequence).
        eachView.autorun(function () {
          // argFunc can return either a sequence as is or a wrapper object with a
          // _sequence and _variable fields set.
          var arg = argFunc();
          if (isObject(arg) && has(arg, '_sequence')) {
            eachView.variableName = arg._variable || null;
            arg = arg._sequence;
          }
          eachView.argVar.set(arg);
        }, eachView.parentView, 'collection');
        eachView.stopHandle = ObserveSequence.observe(function () {
          return eachView.argVar.get();
        }, {
          addedAt: function (id, item, index) {
            Tracker.nonreactive(function () {
              var newItemView;
              if (eachView.variableName) {
                // new-style #each (as in {{#each item in items}})
                // doesn't create a new data context
                newItemView = Blaze.View('item', eachView.contentFunc);
              } else {
                newItemView = Blaze.With(item, eachView.contentFunc);
              }
              eachView.numItems++;
              var bindings = {};
              bindings['@index'] = index;
              if (eachView.variableName) {
                bindings[eachView.variableName] = item;
              }
              Blaze._attachBindingsToView(bindings, newItemView);
              if (eachView.expandedValueDep) {
                eachView.expandedValueDep.changed();
              } else if (eachView._domrange) {
                if (eachView.inElseMode) {
                  eachView._domrange.removeMember(0);
                  eachView.inElseMode = false;
                }
                var range = Blaze._materializeView(newItemView, eachView);
                eachView._domrange.addMember(range, index);
                updateIndices(index);
              } else {
                eachView.initialSubviews.splice(index, 0, newItemView);
              }
            });
          },
          removedAt: function (id, item, index) {
            Tracker.nonreactive(function () {
              eachView.numItems--;
              if (eachView.expandedValueDep) {
                eachView.expandedValueDep.changed();
              } else if (eachView._domrange) {
                eachView._domrange.removeMember(index);
                updateIndices(index);
                if (eachView.elseFunc && eachView.numItems === 0) {
                  eachView.inElseMode = true;
                  eachView._domrange.addMember(Blaze._materializeView(Blaze.View('each_else', eachView.elseFunc), eachView), 0);
                }
              } else {
                eachView.initialSubviews.splice(index, 1);
              }
            });
          },
          changedAt: function (id, newItem, oldItem, index) {
            Tracker.nonreactive(function () {
              if (eachView.expandedValueDep) {
                eachView.expandedValueDep.changed();
              } else {
                var itemView;
                if (eachView._domrange) {
                  itemView = eachView._domrange.getMember(index).view;
                } else {
                  itemView = eachView.initialSubviews[index];
                }
                if (eachView.variableName) {
                  itemView._scopeBindings[eachView.variableName].set({
                    value: newItem
                  });
                } else {
                  itemView.dataVar.set(newItem);
                }
              }
            });
          },
          movedTo: function (id, item, fromIndex, toIndex) {
            Tracker.nonreactive(function () {
              if (eachView.expandedValueDep) {
                eachView.expandedValueDep.changed();
              } else if (eachView._domrange) {
                eachView._domrange.moveMember(fromIndex, toIndex);
                updateIndices(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex));
              } else {
                var subviews = eachView.initialSubviews;
                var itemView = subviews[fromIndex];
                subviews.splice(fromIndex, 1);
                subviews.splice(toIndex, 0, itemView);
              }
            });
          }
        });
        if (eachView.elseFunc && eachView.numItems === 0) {
          eachView.inElseMode = true;
          eachView.initialSubviews[0] = Blaze.View('each_else', eachView.elseFunc);
        }
      });
      eachView.onViewDestroyed(function () {
        if (eachView.stopHandle) eachView.stopHandle.stop();
      });
      return eachView;
    };
    Blaze._TemplateWith = function (arg, contentFunc) {
      var w;
      var argFunc = arg;
      if (typeof arg !== 'function') {
        argFunc = function () {
          return arg;
        };
      }

      // This is a little messy.  When we compile `{{> Template.contentBlock}}`, we
      // wrap it in Blaze._InOuterTemplateScope in order to skip the intermediate
      // parent Views in the current template.  However, when there's an argument
      // (`{{> Template.contentBlock arg}}`), the argument needs to be evaluated
      // in the original scope.  There's no good order to nest
      // Blaze._InOuterTemplateScope and Blaze._TemplateWith to achieve this,
      // so we wrap argFunc to run it in the "original parentView" of the
      // Blaze._InOuterTemplateScope.
      //
      // To make this better, reconsider _InOuterTemplateScope as a primitive.
      // Longer term, evaluate expressions in the proper lexical scope.
      var wrappedArgFunc = function () {
        var viewToEvaluateArg = null;
        if (w.parentView && w.parentView.name === 'InOuterTemplateScope') {
          viewToEvaluateArg = w.parentView.originalParentView;
        }
        if (viewToEvaluateArg) {
          return Blaze._withCurrentView(viewToEvaluateArg, argFunc);
        } else {
          return argFunc();
        }
      };
      var wrappedContentFunc = function () {
        var content = contentFunc.call(this);

        // Since we are generating the Blaze._TemplateWith view for the
        // user, set the flag on the child view.  If `content` is a template,
        // construct the View so that we can set the flag.
        if (content instanceof Blaze.Template) {
          content = content.constructView();
        }
        if (content instanceof Blaze.View) {
          content._hasGeneratedParent = true;
        }
        return content;
      };
      w = Blaze.With(wrappedArgFunc, wrappedContentFunc);
      w.__isTemplateWith = true;
      return w;
    };
    Blaze._InOuterTemplateScope = function (templateView, contentFunc) {
      var view = Blaze.View('InOuterTemplateScope', contentFunc);
      var parentView = templateView.parentView;

      // Hack so that if you call `{{> foo bar}}` and it expands into
      // `{{#with bar}}{{> foo}}{{/with}}`, and then `foo` is a template
      // that inserts `{{> Template.contentBlock}}`, the data context for
      // `Template.contentBlock` is not `bar` but the one enclosing that.
      if (parentView.__isTemplateWith) parentView = parentView.parentView;
      view.onViewCreated(function () {
        this.originalParentView = this.parentView;
        this.parentView = parentView;
        this.__childDoesntStartNewLexicalScope = true;
      });
      return view;
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

},"lookup.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/lookup.js                                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let has;
    module.link("lodash.has", {
      default(v) {
        has = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /** @param {(binding: Binding) => boolean} fn */
    function _createBindingsHelper(fn) {
      /** @param {string[]} names */
      return function () {
        for (var _len = arguments.length, names = new Array(_len), _key = 0; _key < _len; _key++) {
          names[_key] = arguments[_key];
        }
        const view = Blaze.currentView;

        // There's either zero arguments (i.e., check all bindings) or an additional
        // "hash" argument that we have to ignore.
        names = names.length === 0
        // TODO: Should we walk up the bindings here?
        ? Object.keys(view._scopeBindings) : names.slice(0, -1);
        return names.some(name => {
          const binding = _lexicalBindingLookup(view, name);
          if (!binding) {
            throw new Error("Binding for \"".concat(name, "\" was not found."));
          }
          return fn(binding.get());
        });
      };
    }
    Blaze._globalHelpers = {
      /** @summary Check whether any of the given bindings (or all if none given) is still pending. */
      '@pending': _createBindingsHelper(binding => binding === undefined),
      /** @summary Check whether any of the given bindings (or all if none given) has rejected. */
      '@rejected': _createBindingsHelper(binding => !!binding && 'error' in binding),
      /** @summary Check whether any of the given bindings (or all if none given) has resolved. */
      '@resolved': _createBindingsHelper(binding => !!binding && 'value' in binding)
    };

    // Documented as Template.registerHelper.
    // This definition also provides back-compat for `UI.registerHelper`.
    Blaze.registerHelper = function (name, func) {
      Blaze._globalHelpers[name] = func;
    };

    // Also documented as Template.deregisterHelper
    Blaze.deregisterHelper = function (name) {
      delete Blaze._globalHelpers[name];
    };
    var bindIfIsFunction = function (x, target) {
      if (typeof x !== 'function') return x;
      return Blaze._bind(x, target);
    };

    // If `x` is a function, binds the value of `this` for that function
    // to the current data context.
    var bindDataContext = function (x) {
      if (typeof x === 'function') {
        return function () {
          var data = Blaze.getData();
          if (data == null) data = {};
          return x.apply(data, arguments);
        };
      }
      return x;
    };
    Blaze._OLDSTYLE_HELPER = {};
    Blaze._getTemplateHelper = function (template, name, tmplInstanceFunc) {
      // XXX COMPAT WITH 0.9.3
      var isKnownOldStyleHelper = false;
      if (template.__helpers.has(name)) {
        var helper = template.__helpers.get(name);
        if (helper === Blaze._OLDSTYLE_HELPER) {
          isKnownOldStyleHelper = true;
        } else if (helper != null) {
          return wrapHelper(bindDataContext(helper), tmplInstanceFunc);
        } else {
          return null;
        }
      }

      // old-style helper
      if (name in template) {
        // Only warn once per helper
        if (!isKnownOldStyleHelper) {
          template.__helpers.set(name, Blaze._OLDSTYLE_HELPER);
          if (!template._NOWARN_OLDSTYLE_HELPERS) {
            Blaze._warn('Assigning helper with `' + template.viewName + '.' + name + ' = ...` is deprecated.  Use `' + template.viewName + '.helpers(...)` instead.');
          }
        }
        if (template[name] != null) {
          return wrapHelper(bindDataContext(template[name]), tmplInstanceFunc);
        }
      }
      return null;
    };
    var wrapHelper = function (f, templateFunc) {
      if (typeof f !== "function") {
        return f;
      }
      return function () {
        var self = this;
        var args = arguments;
        return Blaze.Template._withTemplateInstanceFunc(templateFunc, function () {
          return Blaze._wrapCatchingExceptions(f, 'template helper').apply(self, args);
        });
      };
    };
    function _lexicalKeepGoing(currentView) {
      if (!currentView.parentView) {
        return undefined;
      }
      if (!currentView.__startsNewLexicalScope) {
        return currentView.parentView;
      }
      if (currentView.parentView.__childDoesntStartNewLexicalScope) {
        return currentView.parentView;
      }

      // in the case of {{> Template.contentBlock data}} the contentBlock loses the lexical scope of it's parent, wheras {{> Template.contentBlock}} it does not
      // this is because a #with sits between the include InOuterTemplateScope
      if (currentView.parentView.name === "with" && currentView.parentView.parentView && currentView.parentView.parentView.__childDoesntStartNewLexicalScope) {
        return currentView.parentView;
      }
      return undefined;
    }
    function _lexicalBindingLookup(view, name) {
      var currentView = view;

      // walk up the views stopping at a Spacebars.include or Template view that
      // doesn't have an InOuterTemplateScope view as a parent
      do {
        // skip block helpers views
        // if we found the binding on the scope, return it
        if (has(currentView._scopeBindings, name)) {
          return currentView._scopeBindings[name];
        }
      } while (currentView = _lexicalKeepGoing(currentView));
      return null;
    }
    Blaze._lexicalBindingLookup = function (view, name) {
      const binding = _lexicalBindingLookup(view, name);
      return binding && (() => {
        var _binding$get;
        return (_binding$get = binding.get()) === null || _binding$get === void 0 ? void 0 : _binding$get.value;
      });
    };

    // templateInstance argument is provided to be available for possible
    // alternative implementations of this function by 3rd party packages.
    Blaze._getTemplate = function (name, templateInstance) {
      if (name in Blaze.Template && Blaze.Template[name] instanceof Blaze.Template) {
        return Blaze.Template[name];
      }
      return null;
    };
    Blaze._getGlobalHelper = function (name, templateInstance) {
      if (Blaze._globalHelpers[name] != null) {
        return wrapHelper(bindDataContext(Blaze._globalHelpers[name]), templateInstance);
      }
      return null;
    };

    // Looks up a name, like "foo" or "..", as a helper of the
    // current template; the name of a template; a global helper;
    // or a property of the data context.  Called on the View of
    // a template (i.e. a View with a `.template` property,
    // where the helpers are).  Used for the first name in a
    // "path" in a template tag, like "foo" in `{{foo.bar}}` or
    // ".." in `{{frobulate ../blah}}`.
    //
    // Returns a function, a non-function value, or null.  If
    // a function is found, it is bound appropriately.
    //
    // NOTE: This function must not establish any reactive
    // dependencies itself.  If there is any reactivity in the
    // value, lookup should return a function.
    Blaze.View.prototype.lookup = function (name, _options) {
      var template = this.template;
      var lookupTemplate = _options && _options.template;
      var helper;
      var binding;
      var boundTmplInstance;
      var foundTemplate;
      if (this.templateInstance) {
        boundTmplInstance = Blaze._bind(this.templateInstance, this);
      }

      // 0. looking up the parent data context with the special "../" syntax
      if (/^\./.test(name)) {
        // starts with a dot. must be a series of dots which maps to an
        // ancestor of the appropriate height.
        if (!/^(\.)+$/.test(name)) throw new Error("id starting with dot must be a series of dots");
        return Blaze._parentData(name.length - 1, true /*_functionWrapped*/);
      }

      // 1. look up a helper on the current template
      if (template && (helper = Blaze._getTemplateHelper(template, name, boundTmplInstance)) != null) {
        return helper;
      }

      // 2. look up a binding by traversing the lexical view hierarchy inside the
      // current template
      if (template && (binding = Blaze._lexicalBindingLookup(Blaze.currentView, name)) != null) {
        return binding;
      }

      // 3. look up a template by name
      if (lookupTemplate && (foundTemplate = Blaze._getTemplate(name, boundTmplInstance)) != null) {
        return foundTemplate;
      }

      // 4. look up a global helper
      if ((helper = Blaze._getGlobalHelper(name, boundTmplInstance)) != null) {
        return helper;
      }

      // 5. look up in a data context
      return function () {
        var isCalledAsFunction = arguments.length > 0;
        var data = Blaze.getData();
        var x = data && data[name];
        if (!x) {
          if (lookupTemplate) {
            throw new Error("No such template: " + name);
          } else if (isCalledAsFunction) {
            throw new Error("No such function: " + name);
          } else if (name.charAt(0) === '@' && (x === null || x === undefined)) {
            // Throw an error if the user tries to use a `@directive`
            // that doesn't exist.  We don't implement all directives
            // from Handlebars, so there's a potential for confusion
            // if we fail silently.  On the other hand, we want to
            // throw late in case some app or package wants to provide
            // a missing directive.
            throw new Error("Unsupported directive: " + name);
          }
        }
        if (!data) {
          return null;
        }
        if (typeof x !== 'function') {
          if (isCalledAsFunction) {
            throw new Error("Can't call non-function: " + x);
          }
          return x;
        }
        return x.apply(data, arguments);
      };
    };

    // Implement Spacebars' {{../..}}.
    // @param height {Number} The number of '..'s
    Blaze._parentData = function (height, _functionWrapped) {
      // If height is null or undefined, we default to 1, the first parent.
      if (height == null) {
        height = 1;
      }
      var theWith = Blaze.getView('with');
      for (var i = 0; i < height && theWith; i++) {
        theWith = Blaze.getView(theWith, 'with');
      }
      if (!theWith) return null;
      if (_functionWrapped) return function () {
        return theWith.dataVar.get();
      };
      return theWith.dataVar.get();
    };
    Blaze.View.prototype.lookupTemplate = function (name) {
      return this.lookup(name, {
        template: true
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"template.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/template.js                                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let isObject;
    module.link("lodash.isobject", {
      default(v) {
        isObject = v;
      }
    }, 0);
    let isFunction;
    module.link("lodash.isfunction", {
      default(v) {
        isFunction = v;
      }
    }, 1);
    let has;
    module.link("lodash.has", {
      default(v) {
        has = v;
      }
    }, 2);
    let isEmpty;
    module.link("lodash.isempty", {
      default(v) {
        isEmpty = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    // [new] Blaze.Template([viewName], renderFunction)
    //
    // `Blaze.Template` is the class of templates, like `Template.foo` in
    // Meteor, which is `instanceof Template`.
    //
    // `viewKind` is a string that looks like "Template.foo" for templates
    // defined by the compiler.

    /**
     * @class
     * @summary Constructor for a Template, which is used to construct Views with particular name and content.
     * @locus Client
     * @param {String} [viewName] Optional.  A name for Views constructed by this Template.  See [`view.name`](#view_name).
     * @param {Function} renderFunction A function that returns [*renderable content*](#Renderable-Content).  This function is used as the `renderFunction` for Views constructed by this Template.
     */
    Blaze.Template = function (viewName, renderFunction) {
      if (!(this instanceof Blaze.Template))
        // called without `new`
        return new Blaze.Template(viewName, renderFunction);
      if (typeof viewName === 'function') {
        // omitted "viewName" argument
        renderFunction = viewName;
        viewName = '';
      }
      if (typeof viewName !== 'string') throw new Error("viewName must be a String (or omitted)");
      if (typeof renderFunction !== 'function') throw new Error("renderFunction must be a function");
      this.viewName = viewName;
      this.renderFunction = renderFunction;
      this.__helpers = new HelperMap();
      this.__eventMaps = [];
      this._callbacks = {
        created: [],
        rendered: [],
        destroyed: []
      };
    };
    var Template = Blaze.Template;
    var HelperMap = function () {};
    HelperMap.prototype.get = function (name) {
      return this[' ' + name];
    };
    HelperMap.prototype.set = function (name, helper) {
      this[' ' + name] = helper;
    };
    HelperMap.prototype.has = function (name) {
      return typeof this[' ' + name] !== 'undefined';
    };

    /**
     * @summary Returns true if `value` is a template object like `Template.myTemplate`.
     * @locus Client
     * @param {Any} value The value to test.
     */
    Blaze.isTemplate = function (t) {
      return t instanceof Blaze.Template;
    };

    /**
     * @name  onCreated
     * @instance
     * @memberOf Template
     * @summary Register a function to be called when an instance of this template is created.
     * @param {Function} callback A function to be added as a callback.
     * @locus Client
     * @importFromPackage templating
     */
    Template.prototype.onCreated = function (cb) {
      this._callbacks.created.push(cb);
    };

    /**
     * @name  onRendered
     * @instance
     * @memberOf Template
     * @summary Register a function to be called when an instance of this template is inserted into the DOM.
     * @param {Function} callback A function to be added as a callback.
     * @locus Client
     * @importFromPackage templating
     */
    Template.prototype.onRendered = function (cb) {
      this._callbacks.rendered.push(cb);
    };

    /**
     * @name  onDestroyed
     * @instance
     * @memberOf Template
     * @summary Register a function to be called when an instance of this template is removed from the DOM and destroyed.
     * @param {Function} callback A function to be added as a callback.
     * @locus Client
     * @importFromPackage templating
     */
    Template.prototype.onDestroyed = function (cb) {
      this._callbacks.destroyed.push(cb);
    };
    Template.prototype._getCallbacks = function (which) {
      var self = this;
      var callbacks = self[which] ? [self[which]] : [];
      // Fire all callbacks added with the new API (Template.onRendered())
      // as well as the old-style callback (e.g. Template.rendered) for
      // backwards-compatibility.
      callbacks = callbacks.concat(self._callbacks[which]);
      return callbacks;
    };
    var fireCallbacks = function (callbacks, template) {
      Template._withTemplateInstanceFunc(function () {
        return template;
      }, function () {
        for (var i = 0, N = callbacks.length; i < N; i++) {
          callbacks[i].call(template);
        }
      });
    };
    Template.prototype.constructView = function (contentFunc, elseFunc) {
      var self = this;
      var view = Blaze.View(self.viewName, self.renderFunction);
      view.template = self;
      view.templateContentBlock = contentFunc ? new Template('(contentBlock)', contentFunc) : null;
      view.templateElseBlock = elseFunc ? new Template('(elseBlock)', elseFunc) : null;
      if (self.__eventMaps || typeof self.events === 'object') {
        view._onViewRendered(function () {
          if (view.renderCount !== 1) return;
          if (!self.__eventMaps.length && typeof self.events === "object") {
            // Provide limited back-compat support for `.events = {...}`
            // syntax.  Pass `template.events` to the original `.events(...)`
            // function.  This code must run only once per template, in
            // order to not bind the handlers more than once, which is
            // ensured by the fact that we only do this when `__eventMaps`
            // is falsy, and we cause it to be set now.
            Template.prototype.events.call(self, self.events);
          }
          self.__eventMaps.forEach(function (m) {
            Blaze._addEventMap(view, m, view);
          });
        });
      }
      view._templateInstance = new Blaze.TemplateInstance(view);
      view.templateInstance = function () {
        // Update data, firstNode, and lastNode, and return the TemplateInstance
        // object.
        var inst = view._templateInstance;

        /**
         * @instance
         * @memberOf Blaze.TemplateInstance
         * @name  data
         * @summary The data context of this instance's latest invocation.
         * @locus Client
         */
        inst.data = Blaze.getData(view);
        if (view._domrange && !view.isDestroyed) {
          inst.firstNode = view._domrange.firstNode();
          inst.lastNode = view._domrange.lastNode();
        } else {
          // on 'created' or 'destroyed' callbacks we don't have a DomRange
          inst.firstNode = null;
          inst.lastNode = null;
        }
        return inst;
      };

      /**
       * @name  created
       * @instance
       * @memberOf Template
       * @summary Provide a callback when an instance of a template is created.
       * @locus Client
       * @deprecated in 1.1
       */
      // To avoid situations when new callbacks are added in between view
      // instantiation and event being fired, decide on all callbacks to fire
      // immediately and then fire them on the event.
      var createdCallbacks = self._getCallbacks('created');
      view.onViewCreated(function () {
        fireCallbacks(createdCallbacks, view.templateInstance());
      });

      /**
       * @name  rendered
       * @instance
       * @memberOf Template
       * @summary Provide a callback when an instance of a template is rendered.
       * @locus Client
       * @deprecated in 1.1
       */
      var renderedCallbacks = self._getCallbacks('rendered');
      view.onViewReady(function () {
        fireCallbacks(renderedCallbacks, view.templateInstance());
      });

      /**
       * @name  destroyed
       * @instance
       * @memberOf Template
       * @summary Provide a callback when an instance of a template is destroyed.
       * @locus Client
       * @deprecated in 1.1
       */
      var destroyedCallbacks = self._getCallbacks('destroyed');
      view.onViewDestroyed(function () {
        fireCallbacks(destroyedCallbacks, view.templateInstance());
      });
      return view;
    };

    /**
     * @class
     * @summary The class for template instances
     * @param {Blaze.View} view
     * @instanceName template
     */
    Blaze.TemplateInstance = function (view) {
      if (!(this instanceof Blaze.TemplateInstance))
        // called without `new`
        return new Blaze.TemplateInstance(view);
      if (!(view instanceof Blaze.View)) throw new Error("View required");
      view._templateInstance = this;

      /**
       * @name view
       * @memberOf Blaze.TemplateInstance
       * @instance
       * @summary The [View](../api/blaze.html#Blaze-View) object for this invocation of the template.
       * @locus Client
       * @type {Blaze.View}
       */
      this.view = view;
      this.data = null;

      /**
       * @name firstNode
       * @memberOf Blaze.TemplateInstance
       * @instance
       * @summary The first top-level DOM node in this template instance.
       * @locus Client
       * @type {DOMNode}
       */
      this.firstNode = null;

      /**
       * @name lastNode
       * @memberOf Blaze.TemplateInstance
       * @instance
       * @summary The last top-level DOM node in this template instance.
       * @locus Client
       * @type {DOMNode}
       */
      this.lastNode = null;

      // This dependency is used to identify state transitions in
      // _subscriptionHandles which could cause the result of
      // TemplateInstance#subscriptionsReady to change. Basically this is triggered
      // whenever a new subscription handle is added or when a subscription handle
      // is removed and they are not ready.
      this._allSubsReadyDep = new Tracker.Dependency();
      this._allSubsReady = false;
      this._subscriptionHandles = {};
    };

    /**
     * @summary Find all elements matching `selector` in this template instance, and return them as a JQuery object.
     * @locus Client
     * @param {String} selector The CSS selector to match, scoped to the template contents.
     * @returns {DOMNode[]}
     */
    Blaze.TemplateInstance.prototype.$ = function (selector) {
      var view = this.view;
      if (!view._domrange) throw new Error("Can't use $ on template instance with no DOM");
      return view._domrange.$(selector);
    };

    /**
     * @summary Find all elements matching `selector` in this template instance.
     * @locus Client
     * @param {String} selector The CSS selector to match, scoped to the template contents.
     * @returns {DOMElement[]}
     */
    Blaze.TemplateInstance.prototype.findAll = function (selector) {
      return Array.prototype.slice.call(this.$(selector));
    };

    /**
     * @summary Find one element matching `selector` in this template instance.
     * @locus Client
     * @param {String} selector The CSS selector to match, scoped to the template contents.
     * @returns {DOMElement}
     */
    Blaze.TemplateInstance.prototype.find = function (selector) {
      var result = this.$(selector);
      return result[0] || null;
    };

    /**
     * @summary A version of [Tracker.autorun](https://docs.meteor.com/api/tracker.html#Tracker-autorun) that is stopped when the template is destroyed.
     * @locus Client
     * @param {Function} runFunc The function to run. It receives one argument: a Tracker.Computation object.
     */
    Blaze.TemplateInstance.prototype.autorun = function (f) {
      return this.view.autorun(f);
    };

    /**
     * @summary A version of [Meteor.subscribe](https://docs.meteor.com/api/pubsub.html#Meteor-subscribe) that is stopped
     * when the template is destroyed.
     * @return {SubscriptionHandle} The subscription handle to the newly made
     * subscription. Call `handle.stop()` to manually stop the subscription, or
     * `handle.ready()` to find out if this particular subscription has loaded all
     * of its inital data.
     * @locus Client
     * @param {String} name Name of the subscription.  Matches the name of the
     * server's `publish()` call.
     * @param {Any} [arg1,arg2...] Optional arguments passed to publisher function
     * on server.
     * @param {Function|Object} [options] If a function is passed instead of an
     * object, it is interpreted as an `onReady` callback.
     * @param {Function} [options.onReady] Passed to [`Meteor.subscribe`](https://docs.meteor.com/api/pubsub.html#Meteor-subscribe).
     * @param {Function} [options.onStop] Passed to [`Meteor.subscribe`](https://docs.meteor.com/api/pubsub.html#Meteor-subscribe).
     * @param {DDP.Connection} [options.connection] The connection on which to make the
     * subscription.
     */
    Blaze.TemplateInstance.prototype.subscribe = function () {
      var self = this;
      var subHandles = self._subscriptionHandles;

      // Duplicate logic from Meteor.subscribe
      var options = {};
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      if (args.length) {
        var lastParam = args[args.length - 1];

        // Match pattern to check if the last arg is an options argument
        var lastParamOptionsPattern = {
          onReady: Match.Optional(Function),
          // XXX COMPAT WITH 1.0.3.1 onError used to exist, but now we use
          // onStop with an error callback instead.
          onError: Match.Optional(Function),
          onStop: Match.Optional(Function),
          connection: Match.Optional(Match.Any)
        };
        if (isFunction(lastParam)) {
          options.onReady = args.pop();
        } else if (lastParam && !isEmpty(lastParam) && Match.test(lastParam, lastParamOptionsPattern)) {
          options = args.pop();
        }
      }
      var subHandle;
      var oldStopped = options.onStop;
      options.onStop = function (error) {
        // When the subscription is stopped, remove it from the set of tracked
        // subscriptions to avoid this list growing without bound
        delete subHandles[subHandle.subscriptionId];

        // Removing a subscription can only change the result of subscriptionsReady
        // if we are not ready (that subscription could be the one blocking us being
        // ready).
        if (!self._allSubsReady) {
          self._allSubsReadyDep.changed();
        }
        if (oldStopped) {
          oldStopped(error);
        }
      };
      var connection = options.connection;
      const {
        onReady,
        onError,
        onStop
      } = options;
      var callbacks = {
        onReady,
        onError,
        onStop
      };

      // The callbacks are passed as the last item in the arguments array passed to
      // View#subscribe
      args.push(callbacks);

      // View#subscribe takes the connection as one of the options in the last
      // argument
      subHandle = self.view.subscribe.call(self.view, args, {
        connection: connection
      });
      if (!has(subHandles, subHandle.subscriptionId)) {
        subHandles[subHandle.subscriptionId] = subHandle;

        // Adding a new subscription will always cause us to transition from ready
        // to not ready, but if we are already not ready then this can't make us
        // ready.
        if (self._allSubsReady) {
          self._allSubsReadyDep.changed();
        }
      }
      return subHandle;
    };

    /**
     * @summary A reactive function that returns true when all of the subscriptions
     * called with [this.subscribe](#TemplateInstance-subscribe) are ready.
     * @return {Boolean} True if all subscriptions on this template instance are
     * ready.
     */
    Blaze.TemplateInstance.prototype.subscriptionsReady = function () {
      this._allSubsReadyDep.depend();
      this._allSubsReady = Object.values(this._subscriptionHandles).every(handle => {
        return handle.ready();
      });
      return this._allSubsReady;
    };

    /**
     * @summary Specify template helpers available to this template.
     * @locus Client
     * @param {Object} helpers Dictionary of helper functions by name.
     * @importFromPackage templating
     */
    Template.prototype.helpers = function (dict) {
      if (!isObject(dict)) {
        throw new Error("Helpers dictionary has to be an object");
      }
      for (var k in dict) this.__helpers.set(k, dict[k]);
    };
    var canUseGetters = function () {
      if (Object.defineProperty) {
        var obj = {};
        try {
          Object.defineProperty(obj, "self", {
            get: function () {
              return obj;
            }
          });
        } catch (e) {
          return false;
        }
        return obj.self === obj;
      }
      return false;
    }();
    if (canUseGetters) {
      // Like Blaze.currentView but for the template instance. A function
      // rather than a value so that not all helpers are implicitly dependent
      // on the current template instance's `data` property, which would make
      // them dependent on the data context of the template inclusion.
      var currentTemplateInstanceFunc = null;

      // If getters are supported, define this property with a getter function
      // to make it effectively read-only, and to work around this bizarre JSC
      // bug: https://github.com/meteor/meteor/issues/9926
      Object.defineProperty(Template, "_currentTemplateInstanceFunc", {
        get: function () {
          return currentTemplateInstanceFunc;
        }
      });
      Template._withTemplateInstanceFunc = function (templateInstanceFunc, func) {
        if (typeof func !== 'function') {
          throw new Error("Expected function, got: " + func);
        }
        var oldTmplInstanceFunc = currentTemplateInstanceFunc;
        try {
          currentTemplateInstanceFunc = templateInstanceFunc;
          return func();
        } finally {
          currentTemplateInstanceFunc = oldTmplInstanceFunc;
        }
      };
    } else {
      // If getters are not supported, just use a normal property.
      Template._currentTemplateInstanceFunc = null;
      Template._withTemplateInstanceFunc = function (templateInstanceFunc, func) {
        if (typeof func !== 'function') {
          throw new Error("Expected function, got: " + func);
        }
        var oldTmplInstanceFunc = Template._currentTemplateInstanceFunc;
        try {
          Template._currentTemplateInstanceFunc = templateInstanceFunc;
          return func();
        } finally {
          Template._currentTemplateInstanceFunc = oldTmplInstanceFunc;
        }
      };
    }

    /**
     * @summary Specify event handlers for this template.
     * @locus Client
     * @param {EventMap} eventMap Event handlers to associate with this template.
     * @importFromPackage templating
     */
    Template.prototype.events = function (eventMap) {
      if (!isObject(eventMap)) {
        throw new Error("Event map has to be an object");
      }
      var template = this;
      var eventMap2 = {};
      for (var k in eventMap) {
        eventMap2[k] = function (k, v) {
          return function (event /*, ...*/) {
            var view = this; // passed by EventAugmenter
            var args = Array.prototype.slice.call(arguments);
            // Exiting the current computation to avoid creating unnecessary
            // and unexpected reactive dependencies with Templates data
            // or any other reactive dependencies defined in event handlers
            return Tracker.nonreactive(function () {
              var data = Blaze.getData(event.currentTarget);
              if (data == null) data = {};
              var tmplInstanceFunc = Blaze._bind(view.templateInstance, view);
              args.splice(1, 0, tmplInstanceFunc());
              return Template._withTemplateInstanceFunc(tmplInstanceFunc, function () {
                return v.apply(data, args);
              });
            });
          };
        }(k, eventMap[k]);
      }
      template.__eventMaps.push(eventMap2);
    };

    /**
     * @function
     * @name instance
     * @memberOf Template
     * @summary The [template instance](#Template-instances) corresponding to the current template helper, event handler, callback, or autorun.  If there isn't one, `null`.
     * @locus Client
     * @returns {Blaze.TemplateInstance}
     * @importFromPackage templating
     */
    Template.instance = function () {
      return Template._currentTemplateInstanceFunc && Template._currentTemplateInstanceFunc();
    };

    // Note: Template.currentData() is documented to take zero arguments,
    // while Blaze.getData takes up to one.

    /**
     * @summary
     *
     * - Inside an `onCreated`, `onRendered`, or `onDestroyed` callback, returns
     * the data context of the template.
     * - Inside an event handler, returns the data context of the template on which
     * this event handler was defined.
     * - Inside a helper, returns the data context of the DOM node where the helper
     * was used.
     *
     * Establishes a reactive dependency on the result.
     * @locus Client
     * @function
     * @importFromPackage templating
     */
    Template.currentData = Blaze.getData;

    /**
     * @summary Accesses other data contexts that enclose the current data context.
     * @locus Client
     * @function
     * @param {Integer} [numLevels] The number of levels beyond the current data context to look. Defaults to 1.
     * @importFromPackage templating
     */
    Template.parentData = Blaze._parentData;

    /**
     * @summary Defines a [helper function](#Template-helpers) which can be used from all templates.
     * @locus Client
     * @function
     * @param {String} name The name of the helper function you are defining.
     * @param {Function} function The helper function itself.
     * @importFromPackage templating
     */
    Template.registerHelper = Blaze.registerHelper;

    /**
     * @summary Removes a global [helper function](#Template-helpers).
     * @locus Client
     * @function
     * @param {String} name The name of the helper function you are defining.
     * @importFromPackage templating
     */
    Template.deregisterHelper = Blaze.deregisterHelper;
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

},"backcompat.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/blaze/backcompat.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
UI = Blaze;
Blaze.ReactiveVar = ReactiveVar;
UI._templateInstance = Blaze.Template.instance;
Handlebars = {};
Handlebars.registerHelper = Blaze.registerHelper;
Handlebars._escape = Blaze._escape;

// Return these from {{...}} helpers to achieve the same as returning
// strings from {{{...}}} helpers
Handlebars.SafeString = function (string) {
  this.string = string;
};
Handlebars.SafeString.prototype.toString = function () {
  return this.string.toString();
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"lodash.has":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.has/package.json                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.has",
  "version": "4.5.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.has/index.js                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isobject":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isobject/package.json                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isobject",
  "version": "3.0.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isobject/index.js                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isfunction":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isfunction/package.json                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isfunction",
  "version": "3.0.9"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isfunction/index.js                                                   //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"lodash.isempty":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isempty/package.json                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.exports = {
  "name": "lodash.isempty",
  "version": "4.4.0"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// node_modules/meteor/blaze/node_modules/lodash.isempty/index.js                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      Blaze: Blaze,
      UI: UI,
      Handlebars: Handlebars
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/blaze/preamble.js",
    "/node_modules/meteor/blaze/exceptions.js",
    "/node_modules/meteor/blaze/view.js",
    "/node_modules/meteor/blaze/builtins.js",
    "/node_modules/meteor/blaze/lookup.js",
    "/node_modules/meteor/blaze/template.js",
    "/node_modules/meteor/blaze/backcompat.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/blaze.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYmxhemUvcHJlYW1ibGUuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL2V4Y2VwdGlvbnMuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL3ZpZXcuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL2J1aWx0aW5zLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9ibGF6ZS9sb29rdXAuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL2JsYXplL3RlbXBsYXRlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9ibGF6ZS9iYWNrY29tcGF0LmpzIl0sIm5hbWVzIjpbIkJsYXplIiwiX2VzY2FwZSIsImVzY2FwZV9tYXAiLCJlc2NhcGVfb25lIiwiYyIsIngiLCJyZXBsYWNlIiwiX3dhcm4iLCJtc2ciLCJjb25zb2xlIiwid2FybiIsIm5hdGl2ZUJpbmQiLCJGdW5jdGlvbiIsInByb3RvdHlwZSIsImJpbmQiLCJfYmluZCIsImZ1bmMiLCJvYmoiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJjYWxsIiwiYXJncyIsIkFycmF5IiwiaSIsImFwcGx5Iiwic2xpY2UiLCJvYmpBIiwib2JqQiIsImRlYnVnRnVuYyIsIl90aHJvd05leHRFeGNlcHRpb24iLCJfcmVwb3J0RXhjZXB0aW9uIiwiZSIsIk1ldGVvciIsIl9kZWJ1ZyIsImxvZyIsInN0YWNrIiwibWVzc2FnZSIsIl93cmFwQ2F0Y2hpbmdFeGNlcHRpb25zIiwiZiIsIndoZXJlIiwiVmlldyIsIm5hbWUiLCJyZW5kZXIiLCJfcmVuZGVyIiwiX2NhbGxiYWNrcyIsImNyZWF0ZWQiLCJyZW5kZXJlZCIsImRlc3Ryb3llZCIsImlzQ3JlYXRlZCIsIl9pc0NyZWF0ZWRGb3JFeHBhbnNpb24iLCJpc1JlbmRlcmVkIiwiX2lzQXR0YWNoZWQiLCJpc0Rlc3Ryb3llZCIsIl9pc0luUmVuZGVyIiwicGFyZW50VmlldyIsIl9kb21yYW5nZSIsIl9oYXNHZW5lcmF0ZWRQYXJlbnQiLCJfc2NvcGVCaW5kaW5ncyIsInJlbmRlckNvdW50Iiwib25WaWV3Q3JlYXRlZCIsImNiIiwicHVzaCIsIl9vblZpZXdSZW5kZXJlZCIsIm9uVmlld1JlYWR5Iiwic2VsZiIsImZpcmUiLCJUcmFja2VyIiwiYWZ0ZXJGbHVzaCIsIl93aXRoQ3VycmVudFZpZXciLCJvblZpZXdSZW5kZXJlZCIsImF0dGFjaGVkIiwib25BdHRhY2hlZCIsIm9uVmlld0Rlc3Ryb3llZCIsInJlbW92ZVZpZXdEZXN0cm95ZWRMaXN0ZW5lciIsImluZGV4IiwibGFzdEluZGV4T2YiLCJhdXRvcnVuIiwiX2luVmlld1Njb3BlIiwiZGlzcGxheU5hbWUiLCJFcnJvciIsInRlbXBsYXRlSW5zdGFuY2VGdW5jIiwiVGVtcGxhdGUiLCJfY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jIiwidmlld0F1dG9ydW4iLCJfd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jIiwiY29tcCIsInN0b3BDb21wdXRhdGlvbiIsInN0b3AiLCJvblN0b3AiLCJfZXJyb3JJZlNob3VsZG50Q2FsbFN1YnNjcmliZSIsInN1YnNjcmliZSIsIm9wdGlvbnMiLCJzdWJIYW5kbGUiLCJjb25uZWN0aW9uIiwiZmlyc3ROb2RlIiwibGFzdE5vZGUiLCJfZmlyZUNhbGxiYWNrcyIsInZpZXciLCJ3aGljaCIsIm5vbnJlYWN0aXZlIiwiZmlyZUNhbGxiYWNrcyIsImNicyIsIk4iLCJfY3JlYXRlVmlldyIsImZvckV4cGFuc2lvbiIsImRvRmlyc3RSZW5kZXIiLCJpbml0aWFsQ29udGVudCIsImRvbXJhbmdlIiwiX0RPTVJhbmdlIiwidGVhcmRvd25Ib29rIiwicmFuZ2UiLCJlbGVtZW50IiwiX0RPTUJhY2tlbmQiLCJUZWFyZG93biIsIm9uRWxlbWVudFRlYXJkb3duIiwidGVhcmRvd24iLCJfZGVzdHJveVZpZXciLCJfbWF0ZXJpYWxpemVWaWV3IiwiX3dvcmtTdGFjayIsIl9pbnRvQXJyYXkiLCJsYXN0SHRtbGpzIiwiZG9SZW5kZXIiLCJodG1sanMiLCJmaXJzdFJ1biIsIl9pc0NvbnRlbnRFcXVhbCIsImRvTWF0ZXJpYWxpemUiLCJyYW5nZXNBbmROb2RlcyIsIl9tYXRlcmlhbGl6ZURPTSIsInNldE1lbWJlcnMiLCJvbkludmFsaWRhdGUiLCJkZXN0cm95TWVtYmVycyIsInVuZGVmaW5lZCIsImluaXRpYWxDb250ZW50cyIsIl9leHBhbmRWaWV3IiwicmVzdWx0IiwiX2V4cGFuZCIsImFjdGl2ZSIsIl9IVE1MSlNFeHBhbmRlciIsIkhUTUwiLCJUcmFuc2Zvcm1pbmdWaXNpdG9yIiwiZXh0ZW5kIiwiZGVmIiwidmlzaXRPYmplY3QiLCJjb25zdHJ1Y3RWaWV3IiwidmlzaXRBdHRyaWJ1dGVzIiwiYXR0cnMiLCJ2aXNpdEF0dHJpYnV0ZSIsInZhbHVlIiwidGFnIiwiY3VycmVudFZpZXdJZlJlbmRlcmluZyIsImN1cnJlbnRWaWV3IiwidmlzaXQiLCJfZXhwYW5kQXR0cmlidXRlcyIsIl9za2lwTm9kZXMiLCJfZGVzdHJveU5vZGUiLCJub2RlIiwibm9kZVR5cGUiLCJ0ZWFyRG93bkVsZW1lbnQiLCJhIiwiYiIsIlJhdyIsIm9sZFZpZXciLCJjaGVja1JlbmRlckNvbnRlbnQiLCJjb250ZW50IiwiVmlzaXRvciIsImNvbnRlbnRBc1ZpZXciLCJjb250ZW50QXNGdW5jIiwiX19yb290Vmlld3MiLCJwYXJlbnRFbGVtZW50IiwibmV4dE5vZGUiLCJpbmRleE9mIiwic3BsaWNlIiwiYXR0YWNoIiwiaW5zZXJ0IiwicmVuZGVyV2l0aERhdGEiLCJkYXRhIiwiX1RlbXBsYXRlV2l0aCIsInJlbW92ZSIsImRlc3Ryb3kiLCJwYXJlbnRSYW5nZSIsImRldGFjaCIsInRvSFRNTCIsInRvSFRNTFdpdGhEYXRhIiwiX3RvVGV4dCIsInRleHRNb2RlIiwiVEVYVE1PREUiLCJTVFJJTkciLCJSQ0RBVEEiLCJBVFRSSUJVVEUiLCJ0b1RleHQiLCJnZXREYXRhIiwiZWxlbWVudE9yVmlldyIsInRoZVdpdGgiLCJnZXRWaWV3IiwiZGF0YVZhciIsImdldCIsImdldEVsZW1lbnREYXRhIiwiX3ZpZXdOYW1lIiwidmlld05hbWUiLCJfZ2V0Q3VycmVudFZpZXciLCJfZ2V0UGFyZW50VmlldyIsIl9nZXRFbGVtZW50VmlldyIsInYiLCJlbGVtIiwiZm9yRWxlbWVudCIsIl9hZGRFdmVudE1hcCIsImV2ZW50TWFwIiwidGhpc0luSGFuZGxlciIsImhhbmRsZXMiLCJhdHRhY2hlZF9ldmVudE1hcHMiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsInNwZWMiLCJoYW5kbGVyIiwiY2xhdXNlcyIsInNwbGl0IiwiY2xhdXNlIiwicGFydHMiLCJuZXdFdmVudHMiLCJzaGlmdCIsInNlbGVjdG9yIiwiam9pbiIsIl9FdmVudFN1cHBvcnQiLCJsaXN0ZW4iLCJldnQiLCJjb250YWluc0VsZW1lbnQiLCJjdXJyZW50VGFyZ2V0IiwiaGFuZGxlclRoaXMiLCJoYW5kbGVyQXJncyIsInIiLCJoIiwiaGFzIiwibW9kdWxlIiwibGluayIsImRlZmF1bHQiLCJpc09iamVjdCIsIl9fcmVpZnlXYWl0Rm9yRGVwc19fIiwiX2NhbGN1bGF0ZUNvbmRpdGlvbiIsImNvbmQiLCJpc0FycmF5IiwiV2l0aCIsImNvbnRlbnRGdW5jIiwiUmVhY3RpdmVWYXIiLCJzZXQiLCJfaXNFcXVhbEJpbmRpbmciLCJ5IiwiZXJyb3IiLCJfaXNFcXVhbCIsIl9hdHRhY2hCaW5kaW5nc1RvVmlldyIsImJpbmRpbmdzIiwic2V0QmluZGluZ1ZhbHVlIiwidGhlbiIsImVudHJpZXMiLCJfcmVmIiwiYmluZGluZyIsIkxldCIsIklmIiwiY29uZGl0aW9uRnVuYyIsImVsc2VGdW5jIiwiX25vdCIsImNvbmRpdGlvblZhciIsIl9fY29uZGl0aW9uVmFyIiwiVW5sZXNzIiwiRWFjaCIsImFyZ0Z1bmMiLCJlYWNoVmlldyIsInN1YnZpZXdzIiwiaW5pdGlhbFN1YnZpZXdzIiwiZXhwYW5kZWRWYWx1ZURlcCIsIkRlcGVuZGVuY3kiLCJkZXBlbmQiLCJudW1JdGVtcyIsImluRWxzZU1vZGUiLCJzdG9wSGFuZGxlIiwiYXJnVmFyIiwidmFyaWFibGVOYW1lIiwidXBkYXRlSW5kaWNlcyIsImZyb20iLCJ0byIsIm1lbWJlcnMiLCJhcmciLCJfdmFyaWFibGUiLCJfc2VxdWVuY2UiLCJPYnNlcnZlU2VxdWVuY2UiLCJvYnNlcnZlIiwiYWRkZWRBdCIsImlkIiwiaXRlbSIsIm5ld0l0ZW1WaWV3IiwiY2hhbmdlZCIsInJlbW92ZU1lbWJlciIsImFkZE1lbWJlciIsInJlbW92ZWRBdCIsImNoYW5nZWRBdCIsIm5ld0l0ZW0iLCJvbGRJdGVtIiwiaXRlbVZpZXciLCJnZXRNZW1iZXIiLCJtb3ZlZFRvIiwiZnJvbUluZGV4IiwidG9JbmRleCIsIm1vdmVNZW1iZXIiLCJNYXRoIiwibWluIiwibWF4IiwidyIsIndyYXBwZWRBcmdGdW5jIiwidmlld1RvRXZhbHVhdGVBcmciLCJvcmlnaW5hbFBhcmVudFZpZXciLCJ3cmFwcGVkQ29udGVudEZ1bmMiLCJfX2lzVGVtcGxhdGVXaXRoIiwiX0luT3V0ZXJUZW1wbGF0ZVNjb3BlIiwidGVtcGxhdGVWaWV3IiwiX19jaGlsZERvZXNudFN0YXJ0TmV3TGV4aWNhbFNjb3BlIiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwiYXN5bmMiLCJfY3JlYXRlQmluZGluZ3NIZWxwZXIiLCJmbiIsIl9sZW4iLCJuYW1lcyIsIl9rZXkiLCJzb21lIiwiX2xleGljYWxCaW5kaW5nTG9va3VwIiwiY29uY2F0IiwiX2dsb2JhbEhlbHBlcnMiLCJyZWdpc3RlckhlbHBlciIsImRlcmVnaXN0ZXJIZWxwZXIiLCJiaW5kSWZJc0Z1bmN0aW9uIiwidGFyZ2V0IiwiYmluZERhdGFDb250ZXh0IiwiX09MRFNUWUxFX0hFTFBFUiIsIl9nZXRUZW1wbGF0ZUhlbHBlciIsInRlbXBsYXRlIiwidG1wbEluc3RhbmNlRnVuYyIsImlzS25vd25PbGRTdHlsZUhlbHBlciIsIl9faGVscGVycyIsImhlbHBlciIsIndyYXBIZWxwZXIiLCJfTk9XQVJOX09MRFNUWUxFX0hFTFBFUlMiLCJ0ZW1wbGF0ZUZ1bmMiLCJfbGV4aWNhbEtlZXBHb2luZyIsIl9fc3RhcnRzTmV3TGV4aWNhbFNjb3BlIiwiX2JpbmRpbmckZ2V0IiwiX2dldFRlbXBsYXRlIiwidGVtcGxhdGVJbnN0YW5jZSIsIl9nZXRHbG9iYWxIZWxwZXIiLCJsb29rdXAiLCJfb3B0aW9ucyIsImxvb2t1cFRlbXBsYXRlIiwiYm91bmRUbXBsSW5zdGFuY2UiLCJmb3VuZFRlbXBsYXRlIiwidGVzdCIsIl9wYXJlbnREYXRhIiwiaXNDYWxsZWRBc0Z1bmN0aW9uIiwiY2hhckF0IiwiaGVpZ2h0IiwiX2Z1bmN0aW9uV3JhcHBlZCIsImlzRnVuY3Rpb24iLCJpc0VtcHR5IiwicmVuZGVyRnVuY3Rpb24iLCJIZWxwZXJNYXAiLCJfX2V2ZW50TWFwcyIsImlzVGVtcGxhdGUiLCJ0Iiwib25DcmVhdGVkIiwib25SZW5kZXJlZCIsIm9uRGVzdHJveWVkIiwiX2dldENhbGxiYWNrcyIsImNhbGxiYWNrcyIsInRlbXBsYXRlQ29udGVudEJsb2NrIiwidGVtcGxhdGVFbHNlQmxvY2siLCJldmVudHMiLCJtIiwiX3RlbXBsYXRlSW5zdGFuY2UiLCJUZW1wbGF0ZUluc3RhbmNlIiwiaW5zdCIsImNyZWF0ZWRDYWxsYmFja3MiLCJyZW5kZXJlZENhbGxiYWNrcyIsImRlc3Ryb3llZENhbGxiYWNrcyIsIl9hbGxTdWJzUmVhZHlEZXAiLCJfYWxsU3Vic1JlYWR5IiwiX3N1YnNjcmlwdGlvbkhhbmRsZXMiLCIkIiwiZmluZEFsbCIsImZpbmQiLCJzdWJIYW5kbGVzIiwibGFzdFBhcmFtIiwibGFzdFBhcmFtT3B0aW9uc1BhdHRlcm4iLCJvblJlYWR5IiwiTWF0Y2giLCJPcHRpb25hbCIsIm9uRXJyb3IiLCJBbnkiLCJwb3AiLCJvbGRTdG9wcGVkIiwic3Vic2NyaXB0aW9uSWQiLCJzdWJzY3JpcHRpb25zUmVhZHkiLCJ2YWx1ZXMiLCJldmVyeSIsImhhbmRsZSIsInJlYWR5IiwiaGVscGVycyIsImRpY3QiLCJrIiwiY2FuVXNlR2V0dGVycyIsImRlZmluZVByb3BlcnR5IiwiY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jIiwib2xkVG1wbEluc3RhbmNlRnVuYyIsImV2ZW50TWFwMiIsImV2ZW50IiwiaW5zdGFuY2UiLCJjdXJyZW50RGF0YSIsInBhcmVudERhdGEiLCJVSSIsIkhhbmRsZWJhcnMiLCJTYWZlU3RyaW5nIiwic3RyaW5nIiwidG9TdHJpbmciXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBQSxLQUFLLEdBQUcsQ0FBQyxDQUFDOztBQUVWO0FBQ0E7QUFDQTtBQUNBQSxLQUFLLENBQUNDLE9BQU8sR0FBSSxZQUFXO0VBQzFCLElBQUlDLFVBQVUsR0FBRztJQUNmLEdBQUcsRUFBRSxNQUFNO0lBQ1gsR0FBRyxFQUFFLE1BQU07SUFDWCxHQUFHLEVBQUUsUUFBUTtJQUNiLEdBQUcsRUFBRSxRQUFRO0lBQ2IsR0FBRyxFQUFFLFFBQVE7SUFDYixHQUFHLEVBQUUsUUFBUTtJQUFFO0lBQ2YsR0FBRyxFQUFFO0VBQ1AsQ0FBQztFQUNELElBQUlDLFVBQVUsR0FBRyxTQUFBQSxDQUFTQyxDQUFDLEVBQUU7SUFDM0IsT0FBT0YsVUFBVSxDQUFDRSxDQUFDLENBQUM7RUFDdEIsQ0FBQztFQUVELE9BQU8sVUFBVUMsQ0FBQyxFQUFFO0lBQ2xCLE9BQU9BLENBQUMsQ0FBQ0MsT0FBTyxDQUFDLFdBQVcsRUFBRUgsVUFBVSxDQUFDO0VBQzNDLENBQUM7QUFDSCxDQUFDLENBQUUsQ0FBQztBQUVKSCxLQUFLLENBQUNPLEtBQUssR0FBRyxVQUFVQyxHQUFHLEVBQUU7RUFDM0JBLEdBQUcsR0FBRyxXQUFXLEdBQUdBLEdBQUc7RUFFdkIsSUFBSyxPQUFPQyxPQUFPLEtBQUssV0FBVyxJQUFLQSxPQUFPLENBQUNDLElBQUksRUFBRTtJQUNwREQsT0FBTyxDQUFDQyxJQUFJLENBQUNGLEdBQUcsQ0FBQztFQUNuQjtBQUNGLENBQUM7QUFFRCxJ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RWhEeUYsVUFBVSxDQUFDL1osT0FBTyxHQUFHRCxLQUFLLENBQUNDLE9BQU87O0FBRWxDO0FBQ0E7QUFDQStaLFVBQVUsQ0FBQ0MsVUFBVSxHQUFHLFVBQVNDLE1BQU0sRUFBRTtFQUN2QyxJQUFJLENBQUNBLE1BQU0sR0FBR0EsTUFBTTtBQUN0QixDQUFDO0FBQ0RGLFVBQVUsQ0FBQ0MsVUFBVSxDQUFDcFosU0FBUyxDQUFDc1osUUFBUSxHQUFHLFlBQVc7RUFDcEQsT0FBTyxJQUFJLENBQUNELE1BQU0sQ0FBQ0MsUUFBUSxDQUFDLENBQUM7QUFDL0IsQ0FBQyxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9ibGF6ZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQG5hbWVzcGFjZSBCbGF6ZVxuICogQHN1bW1hcnkgVGhlIG5hbWVzcGFjZSBmb3IgYWxsIEJsYXplLXJlbGF0ZWQgbWV0aG9kcyBhbmQgY2xhc3Nlcy5cbiAqL1xuQmxhemUgPSB7fTtcblxuLy8gVXRpbGl0eSB0byBIVE1MLWVzY2FwZSBhIHN0cmluZy4gIEluY2x1ZGVkIGZvciBsZWdhY3kgcmVhc29ucy5cbi8vIFRPRE86IFNob3VsZCBiZSByZXBsYWNlZCB3aXRoIF8uZXNjYXBlIG9uY2UgdW5kZXJzY29yZSBpcyB1cGdyYWRlZCB0byBhIG5ld2VyXG4vLyAgICAgICB2ZXJzaW9uIHdoaWNoIGVzY2FwZXMgYCAoYmFja3RpY2spIGFzIHdlbGwuIFVuZGVyc2NvcmUgMS41LjIgZG9lcyBub3QuXG5CbGF6ZS5fZXNjYXBlID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgZXNjYXBlX21hcCA9IHtcbiAgICBcIjxcIjogXCImbHQ7XCIsXG4gICAgXCI+XCI6IFwiJmd0O1wiLFxuICAgICdcIic6IFwiJnF1b3Q7XCIsXG4gICAgXCInXCI6IFwiJiN4Mjc7XCIsXG4gICAgXCIvXCI6IFwiJiN4MkY7XCIsXG4gICAgXCJgXCI6IFwiJiN4NjA7XCIsIC8qIElFIGFsbG93cyBiYWNrdGljay1kZWxpbWl0ZWQgYXR0cmlidXRlcz8/ICovXG4gICAgXCImXCI6IFwiJmFtcDtcIlxuICB9O1xuICB2YXIgZXNjYXBlX29uZSA9IGZ1bmN0aW9uKGMpIHtcbiAgICByZXR1cm4gZXNjYXBlX21hcFtjXTtcbiAgfTtcblxuICByZXR1cm4gZnVuY3Rpb24gKHgpIHtcbiAgICByZXR1cm4geC5yZXBsYWNlKC9bJjw+XCInYF0vZywgZXNjYXBlX29uZSk7XG4gIH07XG59KSgpO1xuXG5CbGF6ZS5fd2FybiA9IGZ1bmN0aW9uIChtc2cpIHtcbiAgbXNnID0gJ1dhcm5pbmc6ICcgKyBtc2c7XG5cbiAgaWYgKCh0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcpICYmIGNvbnNvbGUud2Fybikge1xuICAgIGNvbnNvbGUud2Fybihtc2cpO1xuICB9XG59O1xuXG52YXIgbmF0aXZlQmluZCA9IEZ1bmN0aW9uLnByb3RvdHlwZS5iaW5kO1xuXG4vLyBBbiBpbXBsZW1lbnRhdGlvbiBvZiBfLmJpbmQgd2hpY2ggYWxsb3dzIGJldHRlciBvcHRpbWl6YXRpb24uXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9wZXRrYWFudG9ub3YvYmx1ZWJpcmQvd2lraS9PcHRpbWl6YXRpb24ta2lsbGVycyMzLW1hbmFnaW5nLWFyZ3VtZW50c1xuaWYgKG5hdGl2ZUJpbmQpIHtcbiAgQmxhemUuX2JpbmQgPSBmdW5jdGlvbiAoZnVuYywgb2JqKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICAgIHJldHVybiBuYXRpdmVCaW5kLmNhbGwoZnVuYywgb2JqKTtcbiAgICB9XG5cbiAgICAvLyBDb3B5IHRoZSBhcmd1bWVudHMgc28gdGhpcyBmdW5jdGlvbiBjYW4gYmUgb3B0aW1pemVkLlxuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGgpO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgYXJnc1tpXSA9IGFyZ3VtZW50c1tpXTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmF0aXZlQmluZC5hcHBseShmdW5jLCBhcmdzLnNsaWNlKDEpKTtcbiAgfTtcbn1cbmVsc2Uge1xuICAvLyBBIHNsb3dlciBidXQgYmFja3dhcmRzIGNvbXBhdGlibGUgdmVyc2lvbi5cbiAgQmxhemUuX2JpbmQgPSBmdW5jdGlvbihvYmpBLCBvYmpCKSB7XG4gICAgb2JqQS5iaW5kKG9iakIpO1xuICB9O1xufVxuIiwidmFyIGRlYnVnRnVuYztcblxuLy8gV2UgY2FsbCBpbnRvIHVzZXIgY29kZSBpbiBtYW55IHBsYWNlcywgYW5kIGl0J3MgbmljZSB0byBjYXRjaCBleGNlcHRpb25zXG4vLyBwcm9wYWdhdGVkIGZyb20gdXNlciBjb2RlIGltbWVkaWF0ZWx5IHNvIHRoYXQgdGhlIHdob2xlIHN5c3RlbSBkb2Vzbid0IGp1c3Rcbi8vIGJyZWFrLiAgQ2F0Y2hpbmcgZXhjZXB0aW9ucyBpcyBlYXN5OyByZXBvcnRpbmcgdGhlbSBpcyBoYXJkLiAgVGhpcyBoZWxwZXJcbi8vIHJlcG9ydHMgZXhjZXB0aW9ucy5cbi8vXG4vLyBVc2FnZTpcbi8vXG4vLyBgYGBcbi8vIHRyeSB7XG4vLyAgIC8vIC4uLiBzb21lU3R1ZmYgLi4uXG4vLyB9IGNhdGNoIChlKSB7XG4vLyAgIHJlcG9ydFVJRXhjZXB0aW9uKGUpO1xuLy8gfVxuLy8gYGBgXG4vL1xuLy8gQW4gb3B0aW9uYWwgc2Vjb25kIGFyZ3VtZW50IG92ZXJyaWRlcyB0aGUgZGVmYXVsdCBtZXNzYWdlLlxuXG4vLyBTZXQgdGhpcyB0byBgdHJ1ZWAgdG8gY2F1c2UgYHJlcG9ydEV4Y2VwdGlvbmAgdG8gdGhyb3dcbi8vIHRoZSBuZXh0IGV4Y2VwdGlvbiByYXRoZXIgdGhhbiByZXBvcnRpbmcgaXQuICBUaGlzIGlzXG4vLyB1c2VmdWwgaW4gdW5pdCB0ZXN0cyB0aGF0IHRlc3QgZXJyb3IgbWVzc2FnZXMuXG5CbGF6ZS5fdGhyb3dOZXh0RXhjZXB0aW9uID0gZmFsc2U7XG5cbkJsYXplLl9yZXBvcnRFeGNlcHRpb24gPSBmdW5jdGlvbiAoZSwgbXNnKSB7XG4gIGlmIChCbGF6ZS5fdGhyb3dOZXh0RXhjZXB0aW9uKSB7XG4gICAgQmxhemUuX3Rocm93TmV4dEV4Y2VwdGlvbiA9IGZhbHNlO1xuICAgIHRocm93IGU7XG4gIH1cblxuICBpZiAoISBkZWJ1Z0Z1bmMpXG4gICAgLy8gYWRhcHRlZCBmcm9tIFRyYWNrZXJcbiAgICBkZWJ1Z0Z1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gKHR5cGVvZiBNZXRlb3IgIT09IFwidW5kZWZpbmVkXCIgPyBNZXRlb3IuX2RlYnVnIDpcbiAgICAgICAgICAgICAgKCh0eXBlb2YgY29uc29sZSAhPT0gXCJ1bmRlZmluZWRcIikgJiYgY29uc29sZS5sb2cgPyBjb25zb2xlLmxvZyA6XG4gICAgICAgICAgICAgICBmdW5jdGlvbiAoKSB7fSkpO1xuICAgIH07XG5cbiAgLy8gSW4gQ2hyb21lLCBgZS5zdGFja2AgaXMgYSBtdWx0aWxpbmUgc3RyaW5nIHRoYXQgc3RhcnRzIHdpdGggdGhlIG1lc3NhZ2VcbiAgLy8gYW5kIGNvbnRhaW5zIGEgc3RhY2sgdHJhY2UuICBGdXJ0aGVybW9yZSwgYGNvbnNvbGUubG9nYCBtYWtlcyBpdCBjbGlja2FibGUuXG4gIC8vIGBjb25zb2xlLmxvZ2Agc3VwcGxpZXMgdGhlIHNwYWNlIGJldHdlZW4gdGhlIHR3byBhcmd1bWVudHMuXG4gIGRlYnVnRnVuYygpKG1zZyB8fCAnRXhjZXB0aW9uIGNhdWdodCBpbiB0ZW1wbGF0ZTonLCBlLnN0YWNrIHx8IGUubWVzc2FnZSB8fCBlKTtcbn07XG5cbkJsYXplLl93cmFwQ2F0Y2hpbmdFeGNlcHRpb25zID0gZnVuY3Rpb24gKGYsIHdoZXJlKSB7XG4gIGlmICh0eXBlb2YgZiAhPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4gZjtcblxuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIEJsYXplLl9yZXBvcnRFeGNlcHRpb24oZSwgJ0V4Y2VwdGlvbiBpbiAnICsgd2hlcmUgKyAnOicpO1xuICAgIH1cbiAgfTtcbn07XG4iLCIvLy8gW25ld10gQmxhemUuVmlldyhbbmFtZV0sIHJlbmRlck1ldGhvZClcbi8vL1xuLy8vIEJsYXplLlZpZXcgaXMgdGhlIGJ1aWxkaW5nIGJsb2NrIG9mIHJlYWN0aXZlIERPTS4gIFZpZXdzIGhhdmVcbi8vLyB0aGUgZm9sbG93aW5nIGZlYXR1cmVzOlxuLy8vXG4vLy8gKiBsaWZlY3ljbGUgY2FsbGJhY2tzIC0gVmlld3MgYXJlIGNyZWF0ZWQsIHJlbmRlcmVkLCBhbmQgZGVzdHJveWVkLFxuLy8vICAgYW5kIGNhbGxiYWNrcyBjYW4gYmUgcmVnaXN0ZXJlZCB0byBmaXJlIHdoZW4gdGhlc2UgdGhpbmdzIGhhcHBlbi5cbi8vL1xuLy8vICogcGFyZW50IHBvaW50ZXIgLSBBIFZpZXcgcG9pbnRzIHRvIGl0cyBwYXJlbnRWaWV3LCB3aGljaCBpcyB0aGVcbi8vLyAgIFZpZXcgdGhhdCBjYXVzZWQgaXQgdG8gYmUgcmVuZGVyZWQuICBUaGVzZSBwb2ludGVycyBmb3JtIGFcbi8vLyAgIGhpZXJhcmNoeSBvciB0cmVlIG9mIFZpZXdzLlxuLy8vXG4vLy8gKiByZW5kZXIoKSBtZXRob2QgLSBBIFZpZXcncyByZW5kZXIoKSBtZXRob2Qgc3BlY2lmaWVzIHRoZSBET01cbi8vLyAgIChvciBIVE1MKSBjb250ZW50IG9mIHRoZSBWaWV3LiAgSWYgdGhlIG1ldGhvZCBlc3RhYmxpc2hlc1xuLy8vICAgcmVhY3RpdmUgZGVwZW5kZW5jaWVzLCBpdCBtYXkgYmUgcmUtcnVuLlxuLy8vXG4vLy8gKiBhIERPTVJhbmdlIC0gSWYgYSBWaWV3IGlzIHJlbmRlcmVkIHRvIERPTSwgaXRzIHBvc2l0aW9uIGFuZFxuLy8vICAgZXh0ZW50IGluIHRoZSBET00gYXJlIHRyYWNrZWQgdXNpbmcgYSBET01SYW5nZSBvYmplY3QuXG4vLy9cbi8vLyBXaGVuIGEgVmlldyBpcyBjb25zdHJ1Y3RlZCBieSBjYWxsaW5nIEJsYXplLlZpZXcsIHRoZSBWaWV3IGlzXG4vLy8gbm90IHlldCBjb25zaWRlcmVkIFwiY3JlYXRlZC5cIiAgSXQgZG9lc24ndCBoYXZlIGEgcGFyZW50VmlldyB5ZXQsXG4vLy8gYW5kIG5vIGxvZ2ljIGhhcyBiZWVuIHJ1biB0byBpbml0aWFsaXplIHRoZSBWaWV3LiAgQWxsIHJlYWxcbi8vLyB3b3JrIGlzIGRlZmVycmVkIHVudGlsIGF0IGxlYXN0IGNyZWF0aW9uIHRpbWUsIHdoZW4gdGhlIG9uVmlld0NyZWF0ZWRcbi8vLyBjYWxsYmFja3MgYXJlIGZpcmVkLCB3aGljaCBoYXBwZW5zIHdoZW4gdGhlIFZpZXcgaXMgXCJ1c2VkXCIgaW5cbi8vLyBzb21lIHdheSB0aGF0IHJlcXVpcmVzIGl0IHRvIGJlIHJlbmRlcmVkLlxuLy8vXG4vLy8gLi4ubW9yZSBsaWZlY3ljbGUgc3R1ZmZcbi8vL1xuLy8vIGBuYW1lYCBpcyBhbiBvcHRpb25hbCBzdHJpbmcgdGFnIGlkZW50aWZ5aW5nIHRoZSBWaWV3LiAgVGhlIG9ubHlcbi8vLyB0aW1lIGl0J3MgdXNlZCBpcyB3aGVuIGxvb2tpbmcgaW4gdGhlIFZpZXcgdHJlZSBmb3IgYSBWaWV3IG9mIGFcbi8vLyBwYXJ0aWN1bGFyIG5hbWU7IGZvciBleGFtcGxlLCBkYXRhIGNvbnRleHRzIGFyZSBzdG9yZWQgb24gVmlld3Ncbi8vLyBvZiBuYW1lIFwid2l0aFwiLiAgTmFtZXMgYXJlIGFsc28gdXNlZnVsIHdoZW4gZGVidWdnaW5nLCBzbyBpblxuLy8vIGdlbmVyYWwgaXQncyBnb29kIGZvciBmdW5jdGlvbnMgdGhhdCBjcmVhdGUgVmlld3MgdG8gc2V0IHRoZSBuYW1lLlxuLy8vIFZpZXdzIGFzc29jaWF0ZWQgd2l0aCB0ZW1wbGF0ZXMgaGF2ZSBuYW1lcyBvZiB0aGUgZm9ybSBcIlRlbXBsYXRlLmZvb1wiLlxuXG4vKipcbiAqIEEgYmluZGluZyBpcyBlaXRoZXIgYHVuZGVmaW5lZGAgKHBlbmRpbmcpLCBgeyBlcnJvciB9YCAocmVqZWN0ZWQpLCBvclxuICogYHsgdmFsdWUgfWAgKHJlc29sdmVkKS4gU3luY2hyb25vdXMgdmFsdWVzIGFyZSBpbW1lZGlhdGVseSByZXNvbHZlZCAoaS5lLixcbiAqIGB7IHZhbHVlIH1gIGlzIHVzZWQpLiBUaGUgb3RoZXIgc3RhdGVzIGFyZSByZXNlcnZlZCBmb3IgYXN5bmNocm9ub3VzIGJpbmRpbmdzXG4gKiAoaS5lLiwgdmFsdWVzIHdyYXBwZWQgd2l0aCBgUHJvbWlzZWBzKS5cbiAqIEB0eXBlZGVmIHt7IGVycm9yOiB1bmtub3duIH0gfCB7IHZhbHVlOiB1bmtub3duIH0gfCB1bmRlZmluZWR9IEJpbmRpbmdcbiAqL1xuXG4vKipcbiAqIEBjbGFzc1xuICogQHN1bW1hcnkgQ29uc3RydWN0b3IgZm9yIGEgVmlldywgd2hpY2ggcmVwcmVzZW50cyBhIHJlYWN0aXZlIHJlZ2lvbiBvZiBET00uXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1N0cmluZ30gW25hbWVdIE9wdGlvbmFsLiAgQSBuYW1lIGZvciB0aGlzIHR5cGUgb2YgVmlldy4gIFNlZSBbYHZpZXcubmFtZWBdKCN2aWV3X25hbWUpLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gcmVuZGVyRnVuY3Rpb24gQSBmdW5jdGlvbiB0aGF0IHJldHVybnMgWypyZW5kZXJhYmxlIGNvbnRlbnQqXSgjUmVuZGVyYWJsZS1Db250ZW50KS4gIEluIHRoaXMgZnVuY3Rpb24sIGB0aGlzYCBpcyBib3VuZCB0byB0aGUgVmlldy5cbiAqL1xuQmxhemUuVmlldyA9IGZ1bmN0aW9uIChuYW1lLCByZW5kZXIpIHtcbiAgaWYgKCEgKHRoaXMgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgQmxhemUuVmlldyhuYW1lLCByZW5kZXIpO1xuXG4gIGlmICh0eXBlb2YgbmFtZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIC8vIG9taXR0ZWQgXCJuYW1lXCIgYXJndW1lbnRcbiAgICByZW5kZXIgPSBuYW1lO1xuICAgIG5hbWUgPSAnJztcbiAgfVxuICB0aGlzLm5hbWUgPSBuYW1lO1xuICB0aGlzLl9yZW5kZXIgPSByZW5kZXI7XG5cbiAgdGhpcy5fY2FsbGJhY2tzID0ge1xuICAgIGNyZWF0ZWQ6IG51bGwsXG4gICAgcmVuZGVyZWQ6IG51bGwsXG4gICAgZGVzdHJveWVkOiBudWxsXG4gIH07XG5cbiAgLy8gU2V0dGluZyBhbGwgcHJvcGVydGllcyBoZXJlIGlzIGdvb2QgZm9yIHJlYWRhYmlsaXR5LFxuICAvLyBhbmQgYWxzbyBtYXkgaGVscCBDaHJvbWUgb3B0aW1pemUgdGhlIGNvZGUgYnkga2VlcGluZ1xuICAvLyB0aGUgVmlldyBvYmplY3QgZnJvbSBjaGFuZ2luZyBzaGFwZSB0b28gbXVjaC5cbiAgdGhpcy5pc0NyZWF0ZWQgPSBmYWxzZTtcbiAgdGhpcy5faXNDcmVhdGVkRm9yRXhwYW5zaW9uID0gZmFsc2U7XG4gIHRoaXMuaXNSZW5kZXJlZCA9IGZhbHNlO1xuICB0aGlzLl9pc0F0dGFjaGVkID0gZmFsc2U7XG4gIHRoaXMuaXNEZXN0cm95ZWQgPSBmYWxzZTtcbiAgdGhpcy5faXNJblJlbmRlciA9IGZhbHNlO1xuICB0aGlzLnBhcmVudFZpZXcgPSBudWxsO1xuICB0aGlzLl9kb21yYW5nZSA9IG51bGw7XG4gIC8vIFRoaXMgZmxhZyBpcyBub3JtYWxseSBzZXQgdG8gZmFsc2UgZXhjZXB0IGZvciB0aGUgY2FzZXMgd2hlbiB2aWV3J3MgcGFyZW50XG4gIC8vIHdhcyBnZW5lcmF0ZWQgYXMgcGFydCBvZiBleHBhbmRpbmcgc29tZSBzeW50YWN0aWMgc3VnYXIgZXhwcmVzc2lvbnMgb3JcbiAgLy8gbWV0aG9kcy5cbiAgLy8gRXguOiBCbGF6ZS5yZW5kZXJXaXRoRGF0YSBpcyBhbiBlcXVpdmFsZW50IHRvIGNyZWF0aW5nIGEgdmlldyB3aXRoIHJlZ3VsYXJcbiAgLy8gQmxhemUucmVuZGVyIGFuZCB3cmFwcGluZyBpdCBpbnRvIHt7I3dpdGggZGF0YX19e3svd2l0aH19IHZpZXcuIFNpbmNlIHRoZVxuICAvLyB1c2VycyBkb24ndCBrbm93IGFueXRoaW5nIGFib3V0IHRoZXNlIGdlbmVyYXRlZCBwYXJlbnQgdmlld3MsIEJsYXplIG5lZWRzXG4gIC8vIHRoaXMgaW5mb3JtYXRpb24gdG8gYmUgYXZhaWxhYmxlIG9uIHZpZXdzIHRvIG1ha2Ugc21hcnRlciBkZWNpc2lvbnMuIEZvclxuICAvLyBleGFtcGxlOiByZW1vdmluZyB0aGUgZ2VuZXJhdGVkIHBhcmVudCB2aWV3IHdpdGggdGhlIHZpZXcgb24gQmxhemUucmVtb3ZlLlxuICB0aGlzLl9oYXNHZW5lcmF0ZWRQYXJlbnQgPSBmYWxzZTtcbiAgLy8gQmluZGluZ3MgYWNjZXNzaWJsZSB0byBjaGlsZHJlbiB2aWV3cyAodmlhIHZpZXcubG9va3VwKCduYW1lJykpIHdpdGhpbiB0aGVcbiAgLy8gY2xvc2VzdCB0ZW1wbGF0ZSB2aWV3LlxuICAvKiogQHR5cGUge1JlY29yZDxzdHJpbmcsIFJlYWN0aXZlVmFyPEJpbmRpbmc+Pn0gKi9cbiAgdGhpcy5fc2NvcGVCaW5kaW5ncyA9IHt9O1xuXG4gIHRoaXMucmVuZGVyQ291bnQgPSAwO1xufTtcblxuQmxhemUuVmlldy5wcm90b3R5cGUuX3JlbmRlciA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIG51bGw7IH07XG5cbkJsYXplLlZpZXcucHJvdG90eXBlLm9uVmlld0NyZWF0ZWQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdGhpcy5fY2FsbGJhY2tzLmNyZWF0ZWQgPSB0aGlzLl9jYWxsYmFja3MuY3JlYXRlZCB8fCBbXTtcbiAgdGhpcy5fY2FsbGJhY2tzLmNyZWF0ZWQucHVzaChjYik7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5fb25WaWV3UmVuZGVyZWQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdGhpcy5fY2FsbGJhY2tzLnJlbmRlcmVkID0gdGhpcy5fY2FsbGJhY2tzLnJlbmRlcmVkIHx8IFtdO1xuICB0aGlzLl9jYWxsYmFja3MucmVuZGVyZWQucHVzaChjYik7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5vblZpZXdSZWFkeSA9IGZ1bmN0aW9uIChjYikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBmaXJlID0gZnVuY3Rpb24gKCkge1xuICAgIFRyYWNrZXIuYWZ0ZXJGbHVzaChmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoISBzZWxmLmlzRGVzdHJveWVkKSB7XG4gICAgICAgIEJsYXplLl93aXRoQ3VycmVudFZpZXcoc2VsZiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNiLmNhbGwoc2VsZik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9O1xuICBzZWxmLl9vblZpZXdSZW5kZXJlZChmdW5jdGlvbiBvblZpZXdSZW5kZXJlZCgpIHtcbiAgICBpZiAoc2VsZi5pc0Rlc3Ryb3llZClcbiAgICAgIHJldHVybjtcbiAgICBpZiAoISBzZWxmLl9kb21yYW5nZS5hdHRhY2hlZClcbiAgICAgIHNlbGYuX2RvbXJhbmdlLm9uQXR0YWNoZWQoZmlyZSk7XG4gICAgZWxzZVxuICAgICAgZmlyZSgpO1xuICB9KTtcbn07XG5cbkJsYXplLlZpZXcucHJvdG90eXBlLm9uVmlld0Rlc3Ryb3llZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MuZGVzdHJveWVkID0gdGhpcy5fY2FsbGJhY2tzLmRlc3Ryb3llZCB8fCBbXTtcbiAgdGhpcy5fY2FsbGJhY2tzLmRlc3Ryb3llZC5wdXNoKGNiKTtcbn07XG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5yZW1vdmVWaWV3RGVzdHJveWVkTGlzdGVuZXIgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdmFyIGRlc3Ryb3llZCA9IHRoaXMuX2NhbGxiYWNrcy5kZXN0cm95ZWQ7XG4gIGlmICghIGRlc3Ryb3llZClcbiAgICByZXR1cm47XG4gIHZhciBpbmRleCA9IGRlc3Ryb3llZC5sYXN0SW5kZXhPZihjYik7XG4gIGlmIChpbmRleCAhPT0gLTEpIHtcbiAgICAvLyBYWFggWW91J2QgdGhpbmsgdGhlIHJpZ2h0IHRoaW5nIHRvIGRvIHdvdWxkIGJlIHNwbGljZSwgYnV0IF9maXJlQ2FsbGJhY2tzXG4gICAgLy8gZ2V0cyBzYWQgaWYgeW91IHJlbW92ZSBjYWxsYmFja3Mgd2hpbGUgaXRlcmF0aW5nIG92ZXIgdGhlIGxpc3QuICBTaG91bGRcbiAgICAvLyBjaGFuZ2UgdGhpcyB0byB1c2UgY2FsbGJhY2staG9vayBvciBFdmVudEVtaXR0ZXIgb3Igc29tZXRoaW5nIGVsc2UgdGhhdFxuICAgIC8vIHByb3Blcmx5IHN1cHBvcnRzIHJlbW92YWwuXG4gICAgZGVzdHJveWVkW2luZGV4XSA9IG51bGw7XG4gIH1cbn07XG5cbi8vLyBWaWV3I2F1dG9ydW4oZnVuYylcbi8vL1xuLy8vIFNldHMgdXAgYSBUcmFja2VyIGF1dG9ydW4gdGhhdCBpcyBcInNjb3BlZFwiIHRvIHRoaXMgVmlldyBpbiB0d29cbi8vLyBpbXBvcnRhbnQgd2F5czogMSkgQmxhemUuY3VycmVudFZpZXcgaXMgYXV0b21hdGljYWxseSBzZXRcbi8vLyBvbiBldmVyeSByZS1ydW4sIGFuZCAyKSB0aGUgYXV0b3J1biBpcyBzdG9wcGVkIHdoZW4gdGhlXG4vLy8gVmlldyBpcyBkZXN0cm95ZWQuICBBcyB3aXRoIFRyYWNrZXIuYXV0b3J1biwgdGhlIGZpcnN0IHJ1biBvZlxuLy8vIHRoZSBmdW5jdGlvbiBpcyBpbW1lZGlhdGUsIGFuZCBhIENvbXB1dGF0aW9uIG9iamVjdCB0aGF0IGNhblxuLy8vIGJlIHVzZWQgdG8gc3RvcCB0aGUgYXV0b3J1biBpcyByZXR1cm5lZC5cbi8vL1xuLy8vIFZpZXcjYXV0b3J1biBpcyBtZWFudCB0byBiZSBjYWxsZWQgZnJvbSBWaWV3IGNhbGxiYWNrcyBsaWtlXG4vLy8gb25WaWV3Q3JlYXRlZCwgb3IgZnJvbSBvdXRzaWRlIHRoZSByZW5kZXJpbmcgcHJvY2Vzcy4gIEl0IG1heSBub3Rcbi8vLyBiZSBjYWxsZWQgYmVmb3JlIHRoZSBvblZpZXdDcmVhdGVkIGNhbGxiYWNrcyBhcmUgZmlyZWQgKHRvbyBlYXJseSksXG4vLy8gb3IgZnJvbSBhIHJlbmRlcigpIG1ldGhvZCAodG9vIGNvbmZ1c2luZykuXG4vLy9cbi8vLyBUeXBpY2FsbHksIGF1dG9ydW5zIHRoYXQgdXBkYXRlIHRoZSBzdGF0ZVxuLy8vIG9mIHRoZSBWaWV3IChhcyBpbiBCbGF6ZS5XaXRoKSBzaG91bGQgYmUgc3RhcnRlZCBmcm9tIGFuIG9uVmlld0NyZWF0ZWRcbi8vLyBjYWxsYmFjay4gIEF1dG9ydW5zIHRoYXQgdXBkYXRlIHRoZSBET00gc2hvdWxkIGJlIHN0YXJ0ZWRcbi8vLyBmcm9tIGVpdGhlciBvblZpZXdDcmVhdGVkIChndWFyZGVkIGFnYWluc3QgdGhlIGFic2VuY2Ugb2Zcbi8vLyB2aWV3Ll9kb21yYW5nZSksIG9yIG9uVmlld1JlYWR5LlxuQmxhemUuVmlldy5wcm90b3R5cGUuYXV0b3J1biA9IGZ1bmN0aW9uIChmLCBfaW5WaWV3U2NvcGUsIGRpc3BsYXlOYW1lKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBUaGUgcmVzdHJpY3Rpb25zIG9uIHdoZW4gVmlldyNhdXRvcnVuIGNhbiBiZSBjYWxsZWQgYXJlIGluIG9yZGVyXG4gIC8vIHRvIGF2b2lkIGJhZCBwYXR0ZXJucywgbGlrZSBjcmVhdGluZyBhIEJsYXplLlZpZXcgYW5kIGltbWVkaWF0ZWx5XG4gIC8vIGNhbGxpbmcgYXV0b3J1biBvbiBpdC4gIEEgZnJlc2hseSBjcmVhdGVkIFZpZXcgaXMgbm90IHJlYWR5IHRvXG4gIC8vIGhhdmUgbG9naWMgcnVuIG9uIGl0OyBpdCBkb2Vzbid0IGhhdmUgYSBwYXJlbnRWaWV3LCBmb3IgZXhhbXBsZS5cbiAgLy8gSXQncyB3aGVuIHRoZSBWaWV3IGlzIG1hdGVyaWFsaXplZCBvciBleHBhbmRlZCB0aGF0IHRoZSBvblZpZXdDcmVhdGVkXG4gIC8vIGhhbmRsZXJzIGFyZSBmaXJlZCBhbmQgdGhlIFZpZXcgc3RhcnRzIHVwLlxuICAvL1xuICAvLyBMZXR0aW5nIHRoZSByZW5kZXIoKSBtZXRob2QgY2FsbCBgdGhpcy5hdXRvcnVuKClgIGlzIHByb2JsZW1hdGljXG4gIC8vIGJlY2F1c2Ugb2YgcmUtcmVuZGVyLiAgVGhlIGJlc3Qgd2UgY2FuIGRvIGlzIHRvIHN0b3AgdGhlIG9sZFxuICAvLyBhdXRvcnVuIGFuZCBzdGFydCBhIG5ldyBvbmUgZm9yIGVhY2ggcmVuZGVyLCBidXQgdGhhdCdzIGEgcGF0dGVyblxuICAvLyB3ZSB0cnkgdG8gYXZvaWQgaW50ZXJuYWxseSBiZWNhdXNlIGl0IGxlYWRzIHRvIGhlbHBlcnMgYmVpbmdcbiAgLy8gY2FsbGVkIGV4dHJhIHRpbWVzLCBpbiB0aGUgY2FzZSB3aGVyZSB0aGUgYXV0b3J1biBjYXVzZXMgdGhlXG4gIC8vIHZpZXcgdG8gcmUtcmVuZGVyIChhbmQgdGh1cyB0aGUgYXV0b3J1biB0byBiZSB0b3JuIGRvd24gYW5kIGFcbiAgLy8gbmV3IG9uZSBlc3RhYmxpc2hlZCkuXG4gIC8vXG4gIC8vIFdlIGNvdWxkIGxpZnQgdGhlc2UgcmVzdHJpY3Rpb25zIGluIHZhcmlvdXMgd2F5cy4gIE9uZSBpbnRlcmVzdGluZ1xuICAvLyBpZGVhIGlzIHRvIGFsbG93IHlvdSB0byBjYWxsIGB2aWV3LmF1dG9ydW5gIGFmdGVyIGluc3RhbnRpYXRpbmdcbiAgLy8gYHZpZXdgLCBhbmQgYXV0b21hdGljYWxseSB3cmFwIGl0IGluIGB2aWV3Lm9uVmlld0NyZWF0ZWRgLCBkZWZlcnJpbmdcbiAgLy8gdGhlIGF1dG9ydW4gc28gdGhhdCBpdCBzdGFydHMgYXQgYW4gYXBwcm9wcmlhdGUgdGltZS4gIEhvd2V2ZXIsXG4gIC8vIHRoZW4gd2UgY2FuJ3QgcmV0dXJuIHRoZSBDb21wdXRhdGlvbiBvYmplY3QgdG8gdGhlIGNhbGxlciwgYmVjYXVzZVxuICAvLyBpdCBkb2Vzbid0IGV4aXN0IHlldC5cbiAgaWYgKCEgc2VsZi5pc0NyZWF0ZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJWaWV3I2F1dG9ydW4gbXVzdCBiZSBjYWxsZWQgZnJvbSB0aGUgY3JlYXRlZCBjYWxsYmFjayBhdCB0aGUgZWFybGllc3RcIik7XG4gIH1cbiAgaWYgKHRoaXMuX2lzSW5SZW5kZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIFZpZXcjYXV0b3J1biBmcm9tIGluc2lkZSByZW5kZXIoKTsgdHJ5IGNhbGxpbmcgaXQgZnJvbSB0aGUgY3JlYXRlZCBvciByZW5kZXJlZCBjYWxsYmFja1wiKTtcbiAgfVxuXG4gIHZhciB0ZW1wbGF0ZUluc3RhbmNlRnVuYyA9IEJsYXplLlRlbXBsYXRlLl9jdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG5cbiAgdmFyIGZ1bmMgPSBmdW5jdGlvbiB2aWV3QXV0b3J1bihjKSB7XG4gICAgcmV0dXJuIEJsYXplLl93aXRoQ3VycmVudFZpZXcoX2luVmlld1Njb3BlIHx8IHNlbGYsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBCbGF6ZS5UZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jKFxuICAgICAgICB0ZW1wbGF0ZUluc3RhbmNlRnVuYywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiBmLmNhbGwoc2VsZiwgYyk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIC8vIEdpdmUgdGhlIGF1dG9ydW4gZnVuY3Rpb24gYSBiZXR0ZXIgbmFtZSBmb3IgZGVidWdnaW5nIGFuZCBwcm9maWxpbmcuXG4gIC8vIFRoZSBgZGlzcGxheU5hbWVgIHByb3BlcnR5IGlzIG5vdCBwYXJ0IG9mIHRoZSBzcGVjIGJ1dCBicm93c2VycyBsaWtlIENocm9tZVxuICAvLyBhbmQgRmlyZWZveCBwcmVmZXIgaXQgaW4gZGVidWdnZXJzIG92ZXIgdGhlIG5hbWUgZnVuY3Rpb24gd2FzIGRlY2xhcmVkIGJ5LlxuICBmdW5jLmRpc3BsYXlOYW1lID1cbiAgICAoc2VsZi5uYW1lIHx8ICdhbm9ueW1vdXMnKSArICc6JyArIChkaXNwbGF5TmFtZSB8fCAnYW5vbnltb3VzJyk7XG4gIHZhciBjb21wID0gVHJhY2tlci5hdXRvcnVuKGZ1bmMpO1xuXG4gIHZhciBzdG9wQ29tcHV0YXRpb24gPSBmdW5jdGlvbiAoKSB7IGNvbXAuc3RvcCgpOyB9O1xuICBzZWxmLm9uVmlld0Rlc3Ryb3llZChzdG9wQ29tcHV0YXRpb24pO1xuICBjb21wLm9uU3RvcChmdW5jdGlvbiAoKSB7XG4gICAgc2VsZi5yZW1vdmVWaWV3RGVzdHJveWVkTGlzdGVuZXIoc3RvcENvbXB1dGF0aW9uKTtcbiAgfSk7XG5cbiAgcmV0dXJuIGNvbXA7XG59O1xuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5fZXJyb3JJZlNob3VsZG50Q2FsbFN1YnNjcmliZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmICghIHNlbGYuaXNDcmVhdGVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyNzdWJzY3JpYmUgbXVzdCBiZSBjYWxsZWQgZnJvbSB0aGUgY3JlYXRlZCBjYWxsYmFjayBhdCB0aGUgZWFybGllc3RcIik7XG4gIH1cbiAgaWYgKHNlbGYuX2lzSW5SZW5kZXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBjYWxsIFZpZXcjc3Vic2NyaWJlIGZyb20gaW5zaWRlIHJlbmRlcigpOyB0cnkgY2FsbGluZyBpdCBmcm9tIHRoZSBjcmVhdGVkIG9yIHJlbmRlcmVkIGNhbGxiYWNrXCIpO1xuICB9XG4gIGlmIChzZWxmLmlzRGVzdHJveWVkKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgY2FsbCBWaWV3I3N1YnNjcmliZSBmcm9tIGluc2lkZSB0aGUgZGVzdHJveWVkIGNhbGxiYWNrLCB0cnkgY2FsbGluZyBpdCBpbnNpZGUgY3JlYXRlZCBvciByZW5kZXJlZC5cIik7XG4gIH1cbn07XG5cbi8qKlxuICogSnVzdCBsaWtlIEJsYXplLlZpZXcjYXV0b3J1biwgYnV0IHdpdGggTWV0ZW9yLnN1YnNjcmliZSBpbnN0ZWFkIG9mXG4gKiBUcmFja2VyLmF1dG9ydW4uIFN0b3AgdGhlIHN1YnNjcmlwdGlvbiB3aGVuIHRoZSB2aWV3IGlzIGRlc3Ryb3llZC5cbiAqIEByZXR1cm4ge1N1YnNjcmlwdGlvbkhhbmRsZX0gQSBoYW5kbGUgdG8gdGhlIHN1YnNjcmlwdGlvbiBzbyB0aGF0IHlvdSBjYW5cbiAqIHNlZSBpZiBpdCBpcyByZWFkeSwgb3Igc3RvcCBpdCBtYW51YWxseVxuICovXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5zdWJzY3JpYmUgPSBmdW5jdGlvbiAoYXJncywgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIHNlbGYuX2Vycm9ySWZTaG91bGRudENhbGxTdWJzY3JpYmUoKTtcblxuICB2YXIgc3ViSGFuZGxlO1xuICBpZiAob3B0aW9ucy5jb25uZWN0aW9uKSB7XG4gICAgc3ViSGFuZGxlID0gb3B0aW9ucy5jb25uZWN0aW9uLnN1YnNjcmliZS5hcHBseShvcHRpb25zLmNvbm5lY3Rpb24sIGFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIHN1YkhhbmRsZSA9IE1ldGVvci5zdWJzY3JpYmUuYXBwbHkoTWV0ZW9yLCBhcmdzKTtcbiAgfVxuXG4gIHNlbGYub25WaWV3RGVzdHJveWVkKGZ1bmN0aW9uICgpIHtcbiAgICBzdWJIYW5kbGUuc3RvcCgpO1xuICB9KTtcblxuICByZXR1cm4gc3ViSGFuZGxlO1xufTtcblxuQmxhemUuVmlldy5wcm90b3R5cGUuZmlyc3ROb2RlID0gZnVuY3Rpb24gKCkge1xuICBpZiAoISB0aGlzLl9pc0F0dGFjaGVkKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlZpZXcgbXVzdCBiZSBhdHRhY2hlZCBiZWZvcmUgYWNjZXNzaW5nIGl0cyBET01cIik7XG5cbiAgcmV0dXJuIHRoaXMuX2RvbXJhbmdlLmZpcnN0Tm9kZSgpO1xufTtcblxuQmxhemUuVmlldy5wcm90b3R5cGUubGFzdE5vZGUgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghIHRoaXMuX2lzQXR0YWNoZWQpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyBtdXN0IGJlIGF0dGFjaGVkIGJlZm9yZSBhY2Nlc3NpbmcgaXRzIERPTVwiKTtcblxuICByZXR1cm4gdGhpcy5fZG9tcmFuZ2UubGFzdE5vZGUoKTtcbn07XG5cbkJsYXplLl9maXJlQ2FsbGJhY2tzID0gZnVuY3Rpb24gKHZpZXcsIHdoaWNoKSB7XG4gIEJsYXplLl93aXRoQ3VycmVudFZpZXcodmlldywgZnVuY3Rpb24gKCkge1xuICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gZmlyZUNhbGxiYWNrcygpIHtcbiAgICAgIHZhciBjYnMgPSB2aWV3Ll9jYWxsYmFja3Nbd2hpY2hdO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIE4gPSAoY2JzICYmIGNicy5sZW5ndGgpOyBpIDwgTjsgaSsrKVxuICAgICAgICBjYnNbaV0gJiYgY2JzW2ldLmNhbGwodmlldyk7XG4gICAgfSk7XG4gIH0pO1xufTtcblxuQmxhemUuX2NyZWF0ZVZpZXcgPSBmdW5jdGlvbiAodmlldywgcGFyZW50VmlldywgZm9yRXhwYW5zaW9uKSB7XG4gIGlmICh2aWV3LmlzQ3JlYXRlZClcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCByZW5kZXIgdGhlIHNhbWUgVmlldyB0d2ljZVwiKTtcblxuICB2aWV3LnBhcmVudFZpZXcgPSAocGFyZW50VmlldyB8fCBudWxsKTtcbiAgdmlldy5pc0NyZWF0ZWQgPSB0cnVlO1xuICBpZiAoZm9yRXhwYW5zaW9uKVxuICAgIHZpZXcuX2lzQ3JlYXRlZEZvckV4cGFuc2lvbiA9IHRydWU7XG5cbiAgQmxhemUuX2ZpcmVDYWxsYmFja3ModmlldywgJ2NyZWF0ZWQnKTtcbn07XG5cbnZhciBkb0ZpcnN0UmVuZGVyID0gZnVuY3Rpb24gKHZpZXcsIGluaXRpYWxDb250ZW50KSB7XG4gIHZhciBkb21yYW5nZSA9IG5ldyBCbGF6ZS5fRE9NUmFuZ2UoaW5pdGlhbENvbnRlbnQpO1xuICB2aWV3Ll9kb21yYW5nZSA9IGRvbXJhbmdlO1xuICBkb21yYW5nZS52aWV3ID0gdmlldztcbiAgdmlldy5pc1JlbmRlcmVkID0gdHJ1ZTtcbiAgQmxhemUuX2ZpcmVDYWxsYmFja3ModmlldywgJ3JlbmRlcmVkJyk7XG5cbiAgdmFyIHRlYXJkb3duSG9vayA9IG51bGw7XG5cbiAgZG9tcmFuZ2Uub25BdHRhY2hlZChmdW5jdGlvbiBhdHRhY2hlZChyYW5nZSwgZWxlbWVudCkge1xuICAgIHZpZXcuX2lzQXR0YWNoZWQgPSB0cnVlO1xuXG4gICAgdGVhcmRvd25Ib29rID0gQmxhemUuX0RPTUJhY2tlbmQuVGVhcmRvd24ub25FbGVtZW50VGVhcmRvd24oXG4gICAgICBlbGVtZW50LCBmdW5jdGlvbiB0ZWFyZG93bigpIHtcbiAgICAgICAgQmxhemUuX2Rlc3Ryb3lWaWV3KHZpZXcsIHRydWUgLyogX3NraXBOb2RlcyAqLyk7XG4gICAgICB9KTtcbiAgfSk7XG5cbiAgLy8gdGVhciBkb3duIHRoZSB0ZWFyZG93biBob29rXG4gIHZpZXcub25WaWV3RGVzdHJveWVkKGZ1bmN0aW9uICgpIHtcbiAgICB0ZWFyZG93bkhvb2sgJiYgdGVhcmRvd25Ib29rLnN0b3AoKTtcbiAgICB0ZWFyZG93bkhvb2sgPSBudWxsO1xuICB9KTtcblxuICByZXR1cm4gZG9tcmFuZ2U7XG59O1xuXG4vLyBUYWtlIGFuIHVuY3JlYXRlZCBWaWV3IGB2aWV3YCBhbmQgY3JlYXRlIGFuZCByZW5kZXIgaXQgdG8gRE9NLFxuLy8gc2V0dGluZyB1cCB0aGUgYXV0b3J1biB0aGF0IHVwZGF0ZXMgdGhlIFZpZXcuICBSZXR1cm5zIGEgbmV3XG4vLyBET01SYW5nZSwgd2hpY2ggaGFzIGJlZW4gYXNzb2NpYXRlZCB3aXRoIHRoZSBWaWV3LlxuLy9cbi8vIFRoZSBwcml2YXRlIGFyZ3VtZW50cyBgX3dvcmtTdGFja2AgYW5kIGBfaW50b0FycmF5YCBhcmUgcGFzc2VkIGluXG4vLyBieSBCbGF6ZS5fbWF0ZXJpYWxpemVET00gYW5kIGFyZSBvbmx5IHByZXNlbnQgZm9yIHJlY3Vyc2l2ZSBjYWxsc1xuLy8gKHdoZW4gdGhlcmUgaXMgc29tZSBvdGhlciBfbWF0ZXJpYWxpemVWaWV3IG9uIHRoZSBzdGFjaykuICBJZlxuLy8gcHJvdmlkZWQsIHRoZW4gd2UgYXZvaWQgdGhlIG11dHVhbCByZWN1cnNpb24gb2YgY2FsbGluZyBiYWNrIGludG9cbi8vIEJsYXplLl9tYXRlcmlhbGl6ZURPTSBzbyB0aGF0IGRlZXAgVmlldyBoaWVyYXJjaGllcyBkb24ndCBibG93IHRoZVxuLy8gc3RhY2suICBJbnN0ZWFkLCB3ZSBwdXNoIHRhc2tzIG9udG8gd29ya1N0YWNrIGZvciB0aGUgaW5pdGlhbFxuLy8gcmVuZGVyaW5nIGFuZCBzdWJzZXF1ZW50IHNldHVwIG9mIHRoZSBWaWV3LCBhbmQgdGhleSBhcmUgZG9uZSBhZnRlclxuLy8gd2UgcmV0dXJuLiAgV2hlbiB0aGVyZSBpcyBhIF93b3JrU3RhY2ssIHdlIGRvIG5vdCByZXR1cm4gdGhlIG5ld1xuLy8gRE9NUmFuZ2UsIGJ1dCBpbnN0ZWFkIHB1c2ggaXQgaW50byBfaW50b0FycmF5IGZyb20gYSBfd29ya1N0YWNrXG4vLyB0YXNrLlxuQmxhemUuX21hdGVyaWFsaXplVmlldyA9IGZ1bmN0aW9uICh2aWV3LCBwYXJlbnRWaWV3LCBfd29ya1N0YWNrLCBfaW50b0FycmF5KSB7XG4gIEJsYXplLl9jcmVhdGVWaWV3KHZpZXcsIHBhcmVudFZpZXcpO1xuXG4gIHZhciBkb21yYW5nZTtcbiAgdmFyIGxhc3RIdG1sanM7XG4gIC8vIFdlIGRvbid0IGV4cGVjdCB0byBiZSBjYWxsZWQgaW4gYSBDb21wdXRhdGlvbiwgYnV0IGp1c3QgaW4gY2FzZSxcbiAgLy8gd3JhcCBpbiBUcmFja2VyLm5vbnJlYWN0aXZlLlxuICBUcmFja2VyLm5vbnJlYWN0aXZlKGZ1bmN0aW9uICgpIHtcbiAgICB2aWV3LmF1dG9ydW4oZnVuY3Rpb24gZG9SZW5kZXIoYykge1xuICAgICAgLy8gYHZpZXcuYXV0b3J1bmAgc2V0cyB0aGUgY3VycmVudCB2aWV3LlxuICAgICAgdmlldy5yZW5kZXJDb3VudCsrO1xuICAgICAgdmlldy5faXNJblJlbmRlciA9IHRydWU7XG4gICAgICAvLyBBbnkgZGVwZW5kZW5jaWVzIHRoYXQgc2hvdWxkIGludmFsaWRhdGUgdGhpcyBDb21wdXRhdGlvbiBjb21lXG4gICAgICAvLyBmcm9tIHRoaXMgbGluZTpcbiAgICAgIHZhciBodG1sanMgPSB2aWV3Ll9yZW5kZXIoKTtcbiAgICAgIHZpZXcuX2lzSW5SZW5kZXIgPSBmYWxzZTtcblxuICAgICAgaWYgKCEgYy5maXJzdFJ1biAmJiAhIEJsYXplLl9pc0NvbnRlbnRFcXVhbChsYXN0SHRtbGpzLCBodG1sanMpKSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gZG9NYXRlcmlhbGl6ZSgpIHtcbiAgICAgICAgICAvLyByZS1yZW5kZXJcbiAgICAgICAgICB2YXIgcmFuZ2VzQW5kTm9kZXMgPSBCbGF6ZS5fbWF0ZXJpYWxpemVET00oaHRtbGpzLCBbXSwgdmlldyk7XG4gICAgICAgICAgZG9tcmFuZ2Uuc2V0TWVtYmVycyhyYW5nZXNBbmROb2Rlcyk7XG4gICAgICAgICAgQmxhemUuX2ZpcmVDYWxsYmFja3ModmlldywgJ3JlbmRlcmVkJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgbGFzdEh0bWxqcyA9IGh0bWxqcztcblxuICAgICAgLy8gQ2F1c2VzIGFueSBuZXN0ZWQgdmlld3MgdG8gc3RvcCBpbW1lZGlhdGVseSwgbm90IHdoZW4gd2UgY2FsbFxuICAgICAgLy8gYHNldE1lbWJlcnNgIHRoZSBuZXh0IHRpbWUgYXJvdW5kIHRoZSBhdXRvcnVuLiAgT3RoZXJ3aXNlLFxuICAgICAgLy8gaGVscGVycyBpbiB0aGUgRE9NIHRyZWUgdG8gYmUgcmVwbGFjZWQgbWlnaHQgYmUgc2NoZWR1bGVkXG4gICAgICAvLyB0byByZS1ydW4gYmVmb3JlIHdlIGhhdmUgYSBjaGFuY2UgdG8gc3RvcCB0aGVtLlxuICAgICAgVHJhY2tlci5vbkludmFsaWRhdGUoZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoZG9tcmFuZ2UpIHtcbiAgICAgICAgICBkb21yYW5nZS5kZXN0cm95TWVtYmVycygpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9LCB1bmRlZmluZWQsICdtYXRlcmlhbGl6ZScpO1xuXG4gICAgLy8gZmlyc3QgcmVuZGVyLiAgbGFzdEh0bWxqcyBpcyB0aGUgZmlyc3QgaHRtbGpzLlxuICAgIHZhciBpbml0aWFsQ29udGVudHM7XG4gICAgaWYgKCEgX3dvcmtTdGFjaykge1xuICAgICAgaW5pdGlhbENvbnRlbnRzID0gQmxhemUuX21hdGVyaWFsaXplRE9NKGxhc3RIdG1sanMsIFtdLCB2aWV3KTtcbiAgICAgIGRvbXJhbmdlID0gZG9GaXJzdFJlbmRlcih2aWV3LCBpbml0aWFsQ29udGVudHMpO1xuICAgICAgaW5pdGlhbENvbnRlbnRzID0gbnVsbDsgLy8gaGVscCBHQyBiZWNhdXNlIHdlIGNsb3NlIG92ZXIgdGhpcyBzY29wZSBhIGxvdFxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXZSdyZSBiZWluZyBjYWxsZWQgZnJvbSBCbGF6ZS5fbWF0ZXJpYWxpemVET00sIHNvIHRvIGF2b2lkXG4gICAgICAvLyByZWN1cnNpb24gYW5kIHNhdmUgc3RhY2sgc3BhY2UsIHByb3ZpZGUgYSBkZXNjcmlwdGlvbiBvZiB0aGVcbiAgICAgIC8vIHdvcmsgdG8gYmUgZG9uZSBpbnN0ZWFkIG9mIGRvaW5nIGl0LiAgVGFza3MgcHVzaGVkIG9udG9cbiAgICAgIC8vIF93b3JrU3RhY2sgd2lsbCBiZSBkb25lIGluIExJRk8gb3JkZXIgYWZ0ZXIgd2UgcmV0dXJuLlxuICAgICAgLy8gVGhlIHdvcmsgd2lsbCBzdGlsbCBiZSBkb25lIHdpdGhpbiBhIFRyYWNrZXIubm9ucmVhY3RpdmUsXG4gICAgICAvLyBiZWNhdXNlIGl0IHdpbGwgYmUgZG9uZSBieSBzb21lIGNhbGwgdG8gQmxhemUuX21hdGVyaWFsaXplRE9NXG4gICAgICAvLyAod2hpY2ggaXMgYWx3YXlzIGNhbGxlZCBpbiBhIFRyYWNrZXIubm9ucmVhY3RpdmUpLlxuICAgICAgaW5pdGlhbENvbnRlbnRzID0gW107XG4gICAgICAvLyBwdXNoIHRoaXMgZnVuY3Rpb24gZmlyc3Qgc28gdGhhdCBpdCBoYXBwZW5zIGxhc3RcbiAgICAgIF93b3JrU3RhY2sucHVzaChmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRvbXJhbmdlID0gZG9GaXJzdFJlbmRlcih2aWV3LCBpbml0aWFsQ29udGVudHMpO1xuICAgICAgICBpbml0aWFsQ29udGVudHMgPSBudWxsOyAvLyBoZWxwIEdDIGJlY2F1c2Ugb2YgYWxsIHRoZSBjbG9zdXJlcyBoZXJlXG4gICAgICAgIF9pbnRvQXJyYXkucHVzaChkb21yYW5nZSk7XG4gICAgICB9KTtcbiAgICAgIC8vIG5vdyBwdXNoIHRoZSB0YXNrIHRoYXQgY2FsY3VsYXRlcyBpbml0aWFsQ29udGVudHNcbiAgICAgIF93b3JrU3RhY2sucHVzaChCbGF6ZS5fYmluZChCbGF6ZS5fbWF0ZXJpYWxpemVET00sIG51bGwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RIdG1sanMsIGluaXRpYWxDb250ZW50cywgdmlldywgX3dvcmtTdGFjaykpO1xuICAgIH1cbiAgfSk7XG5cbiAgaWYgKCEgX3dvcmtTdGFjaykge1xuICAgIHJldHVybiBkb21yYW5nZTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufTtcblxuLy8gRXhwYW5kcyBhIFZpZXcgdG8gSFRNTGpzLCBjYWxsaW5nIGByZW5kZXJgIHJlY3Vyc2l2ZWx5IG9uIGFsbFxuLy8gVmlld3MgYW5kIGV2YWx1YXRpbmcgYW55IGR5bmFtaWMgYXR0cmlidXRlcy4gIENhbGxzIHRoZSBgY3JlYXRlZGBcbi8vIGNhbGxiYWNrLCBidXQgbm90IHRoZSBgbWF0ZXJpYWxpemVkYCBvciBgcmVuZGVyZWRgIGNhbGxiYWNrcy5cbi8vIERlc3Ryb3lzIHRoZSB2aWV3IGltbWVkaWF0ZWx5LCB1bmxlc3MgY2FsbGVkIGluIGEgVHJhY2tlciBDb21wdXRhdGlvbixcbi8vIGluIHdoaWNoIGNhc2UgdGhlIHZpZXcgd2lsbCBiZSBkZXN0cm95ZWQgd2hlbiB0aGUgQ29tcHV0YXRpb24gaXNcbi8vIGludmFsaWRhdGVkLiAgSWYgY2FsbGVkIGluIGEgVHJhY2tlciBDb21wdXRhdGlvbiwgdGhlIHJlc3VsdCBpcyBhXG4vLyByZWFjdGl2ZSBzdHJpbmc7IHRoYXQgaXMsIHRoZSBDb21wdXRhdGlvbiB3aWxsIGJlIGludmFsaWRhdGVkXG4vLyBpZiBhbnkgY2hhbmdlcyBhcmUgbWFkZSB0byB0aGUgdmlldyBvciBzdWJ2aWV3cyB0aGF0IG1pZ2h0IGFmZmVjdFxuLy8gdGhlIEhUTUwuXG5CbGF6ZS5fZXhwYW5kVmlldyA9IGZ1bmN0aW9uICh2aWV3LCBwYXJlbnRWaWV3KSB7XG4gIEJsYXplLl9jcmVhdGVWaWV3KHZpZXcsIHBhcmVudFZpZXcsIHRydWUgLypmb3JFeHBhbnNpb24qLyk7XG5cbiAgdmlldy5faXNJblJlbmRlciA9IHRydWU7XG4gIHZhciBodG1sanMgPSBCbGF6ZS5fd2l0aEN1cnJlbnRWaWV3KHZpZXcsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdmlldy5fcmVuZGVyKCk7XG4gIH0pO1xuICB2aWV3Ll9pc0luUmVuZGVyID0gZmFsc2U7XG5cbiAgdmFyIHJlc3VsdCA9IEJsYXplLl9leHBhbmQoaHRtbGpzLCB2aWV3KTtcblxuICBpZiAoVHJhY2tlci5hY3RpdmUpIHtcbiAgICBUcmFja2VyLm9uSW52YWxpZGF0ZShmdW5jdGlvbiAoKSB7XG4gICAgICBCbGF6ZS5fZGVzdHJveVZpZXcodmlldyk7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgQmxhemUuX2Rlc3Ryb3lWaWV3KHZpZXcpO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbi8vIE9wdGlvbnM6IGBwYXJlbnRWaWV3YFxuQmxhemUuX0hUTUxKU0V4cGFuZGVyID0gSFRNTC5UcmFuc2Zvcm1pbmdWaXNpdG9yLmV4dGVuZCgpO1xuQmxhemUuX0hUTUxKU0V4cGFuZGVyLmRlZih7XG4gIHZpc2l0T2JqZWN0OiBmdW5jdGlvbiAoeCkge1xuICAgIGlmICh4IGluc3RhbmNlb2YgQmxhemUuVGVtcGxhdGUpXG4gICAgICB4ID0geC5jb25zdHJ1Y3RWaWV3KCk7XG4gICAgaWYgKHggaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KVxuICAgICAgcmV0dXJuIEJsYXplLl9leHBhbmRWaWV3KHgsIHRoaXMucGFyZW50Vmlldyk7XG5cbiAgICAvLyB0aGlzIHdpbGwgdGhyb3cgYW4gZXJyb3I7IG90aGVyIG9iamVjdHMgYXJlIG5vdCBhbGxvd2VkIVxuICAgIHJldHVybiBIVE1MLlRyYW5zZm9ybWluZ1Zpc2l0b3IucHJvdG90eXBlLnZpc2l0T2JqZWN0LmNhbGwodGhpcywgeCk7XG4gIH0sXG4gIHZpc2l0QXR0cmlidXRlczogZnVuY3Rpb24gKGF0dHJzKSB7XG4gICAgLy8gZXhwYW5kIGR5bmFtaWMgYXR0cmlidXRlc1xuICAgIGlmICh0eXBlb2YgYXR0cnMgPT09ICdmdW5jdGlvbicpXG4gICAgICBhdHRycyA9IEJsYXplLl93aXRoQ3VycmVudFZpZXcodGhpcy5wYXJlbnRWaWV3LCBhdHRycyk7XG5cbiAgICAvLyBjYWxsIHN1cGVyIChlLmcuIGZvciBjYXNlIHdoZXJlIGBhdHRyc2AgaXMgYW4gYXJyYXkpXG4gICAgcmV0dXJuIEhUTUwuVHJhbnNmb3JtaW5nVmlzaXRvci5wcm90b3R5cGUudmlzaXRBdHRyaWJ1dGVzLmNhbGwodGhpcywgYXR0cnMpO1xuICB9LFxuICB2aXNpdEF0dHJpYnV0ZTogZnVuY3Rpb24gKG5hbWUsIHZhbHVlLCB0YWcpIHtcbiAgICAvLyBleHBhbmQgYXR0cmlidXRlIHZhbHVlcyB0aGF0IGFyZSBmdW5jdGlvbnMuICBBbnkgYXR0cmlidXRlIHZhbHVlXG4gICAgLy8gdGhhdCBjb250YWlucyBWaWV3cyBtdXN0IGJlIHdyYXBwZWQgaW4gYSBmdW5jdGlvbi5cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKVxuICAgICAgdmFsdWUgPSBCbGF6ZS5fd2l0aEN1cnJlbnRWaWV3KHRoaXMucGFyZW50VmlldywgdmFsdWUpO1xuXG4gICAgcmV0dXJuIEhUTUwuVHJhbnNmb3JtaW5nVmlzaXRvci5wcm90b3R5cGUudmlzaXRBdHRyaWJ1dGUuY2FsbChcbiAgICAgIHRoaXMsIG5hbWUsIHZhbHVlLCB0YWcpO1xuICB9XG59KTtcblxuLy8gUmV0dXJuIEJsYXplLmN1cnJlbnRWaWV3LCBidXQgb25seSBpZiBpdCBpcyBiZWluZyByZW5kZXJlZFxuLy8gKGkuZS4gd2UgYXJlIGluIGl0cyByZW5kZXIoKSBtZXRob2QpLlxudmFyIGN1cnJlbnRWaWV3SWZSZW5kZXJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuY3VycmVudFZpZXc7XG4gIHJldHVybiAodmlldyAmJiB2aWV3Ll9pc0luUmVuZGVyKSA/IHZpZXcgOiBudWxsO1xufTtcblxuQmxhemUuX2V4cGFuZCA9IGZ1bmN0aW9uIChodG1sanMsIHBhcmVudFZpZXcpIHtcbiAgcGFyZW50VmlldyA9IHBhcmVudFZpZXcgfHwgY3VycmVudFZpZXdJZlJlbmRlcmluZygpO1xuICByZXR1cm4gKG5ldyBCbGF6ZS5fSFRNTEpTRXhwYW5kZXIoXG4gICAge3BhcmVudFZpZXc6IHBhcmVudFZpZXd9KSkudmlzaXQoaHRtbGpzKTtcbn07XG5cbkJsYXplLl9leHBhbmRBdHRyaWJ1dGVzID0gZnVuY3Rpb24gKGF0dHJzLCBwYXJlbnRWaWV3KSB7XG4gIHBhcmVudFZpZXcgPSBwYXJlbnRWaWV3IHx8IGN1cnJlbnRWaWV3SWZSZW5kZXJpbmcoKTtcbiAgcmV0dXJuIChuZXcgQmxhemUuX0hUTUxKU0V4cGFuZGVyKFxuICAgIHtwYXJlbnRWaWV3OiBwYXJlbnRWaWV3fSkpLnZpc2l0QXR0cmlidXRlcyhhdHRycyk7XG59O1xuXG5CbGF6ZS5fZGVzdHJveVZpZXcgPSBmdW5jdGlvbiAodmlldywgX3NraXBOb2Rlcykge1xuICBpZiAodmlldy5pc0Rlc3Ryb3llZClcbiAgICByZXR1cm47XG4gIHZpZXcuaXNEZXN0cm95ZWQgPSB0cnVlO1xuXG5cbiAgLy8gRGVzdHJveSB2aWV3cyBhbmQgZWxlbWVudHMgcmVjdXJzaXZlbHkuICBJZiBfc2tpcE5vZGVzLFxuICAvLyBvbmx5IHJlY3Vyc2UgdXAgdG8gdmlld3MsIG5vdCBlbGVtZW50cywgZm9yIHRoZSBjYXNlIHdoZXJlXG4gIC8vIHRoZSBiYWNrZW5kIChqUXVlcnkpIGlzIHJlY3Vyc2luZyBvdmVyIHRoZSBlbGVtZW50cyBhbHJlYWR5LlxuXG4gIGlmICh2aWV3Ll9kb21yYW5nZSkgdmlldy5fZG9tcmFuZ2UuZGVzdHJveU1lbWJlcnMoX3NraXBOb2Rlcyk7XG5cbiAgLy8gWFhYOiBmaXJlIGNhbGxiYWNrcyBhZnRlciBwb3RlbnRpYWwgbWVtYmVycyBhcmUgZGVzdHJveWVkXG4gIC8vIG90aGVyd2lzZSBpdCdzIHRyYWNrZXIuZmx1c2ggd2lsbCBjYXVzZSB0aGUgYWJvdmUgbGluZSB3aWxsXG4gIC8vIG5vdCBiZSBjYWxsZWQgYW5kIHRoZWlyIHZpZXdzIHdvbid0IGJlIGRlc3Ryb3llZFxuICAvLyBJbnZvbHZlZCBpc3N1ZXM6IERPTVJhbmdlIFwiTXVzdCBiZSBhdHRhY2hlZFwiIGVycm9yLCBtZW0gbGVha1xuICBcbiAgQmxhemUuX2ZpcmVDYWxsYmFja3ModmlldywgJ2Rlc3Ryb3llZCcpO1xufTtcblxuQmxhemUuX2Rlc3Ryb3lOb2RlID0gZnVuY3Rpb24gKG5vZGUpIHtcbiAgaWYgKG5vZGUubm9kZVR5cGUgPT09IDEpXG4gICAgQmxhemUuX0RPTUJhY2tlbmQuVGVhcmRvd24udGVhckRvd25FbGVtZW50KG5vZGUpO1xufTtcblxuLy8gQXJlIHRoZSBIVE1ManMgZW50aXRpZXMgYGFgIGFuZCBgYmAgdGhlIHNhbWU/ICBXZSBjb3VsZCBiZVxuLy8gbW9yZSBlbGFib3JhdGUgaGVyZSBidXQgdGhlIHBvaW50IGlzIHRvIGNhdGNoIHRoZSBtb3N0IGJhc2ljXG4vLyBjYXNlcy5cbkJsYXplLl9pc0NvbnRlbnRFcXVhbCA9IGZ1bmN0aW9uIChhLCBiKSB7XG4gIGlmIChhIGluc3RhbmNlb2YgSFRNTC5SYXcpIHtcbiAgICByZXR1cm4gKGIgaW5zdGFuY2VvZiBIVE1MLlJhdykgJiYgKGEudmFsdWUgPT09IGIudmFsdWUpO1xuICB9IGVsc2UgaWYgKGEgPT0gbnVsbCkge1xuICAgIHJldHVybiAoYiA9PSBudWxsKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gKGEgPT09IGIpICYmXG4gICAgICAoKHR5cGVvZiBhID09PSAnbnVtYmVyJykgfHwgKHR5cGVvZiBhID09PSAnYm9vbGVhbicpIHx8XG4gICAgICAgKHR5cGVvZiBhID09PSAnc3RyaW5nJykpO1xuICB9XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFRoZSBWaWV3IGNvcnJlc3BvbmRpbmcgdG8gdGhlIGN1cnJlbnQgdGVtcGxhdGUgaGVscGVyLCBldmVudCBoYW5kbGVyLCBjYWxsYmFjaywgb3IgYXV0b3J1bi4gIElmIHRoZXJlIGlzbid0IG9uZSwgYG51bGxgLlxuICogQGxvY3VzIENsaWVudFxuICogQHR5cGUge0JsYXplLlZpZXd9XG4gKi9cbkJsYXplLmN1cnJlbnRWaWV3ID0gbnVsbDtcblxuLyoqXG4gKiBAdGVtcGxhdGUgVFxuICogQHBhcmFtIHtCbGF6ZS5WaWV3fSB2aWV3XG4gKiBAcGFyYW0geygpID0+IFR9IGZ1bmNcbiAqIEByZXR1cm5zIHtUfVxuICovXG5CbGF6ZS5fd2l0aEN1cnJlbnRWaWV3ID0gZnVuY3Rpb24gKHZpZXcsIGZ1bmMpIHtcbiAgdmFyIG9sZFZpZXcgPSBCbGF6ZS5jdXJyZW50VmlldztcbiAgdHJ5IHtcbiAgICBCbGF6ZS5jdXJyZW50VmlldyA9IHZpZXc7XG4gICAgcmV0dXJuIGZ1bmMoKTtcbiAgfSBmaW5hbGx5IHtcbiAgICBCbGF6ZS5jdXJyZW50VmlldyA9IG9sZFZpZXc7XG4gIH1cbn07XG5cbi8vIEJsYXplLnJlbmRlciBwdWJsaWNseSB0YWtlcyBhIFZpZXcgb3IgYSBUZW1wbGF0ZS5cbi8vIFByaXZhdGVseSwgaXQgdGFrZXMgYW55IEhUTUxKUyAoZXh0ZW5kZWQgd2l0aCBWaWV3cyBhbmQgVGVtcGxhdGVzKVxuLy8gZXhjZXB0IG51bGwgb3IgdW5kZWZpbmVkLCBvciBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhbnkgZXh0ZW5kZWRcbi8vIEhUTUxKUy5cbnZhciBjaGVja1JlbmRlckNvbnRlbnQgPSBmdW5jdGlvbiAoY29udGVudCkge1xuICBpZiAoY29udGVudCA9PT0gbnVsbClcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCByZW5kZXIgbnVsbFwiKTtcbiAgaWYgKHR5cGVvZiBjb250ZW50ID09PSAndW5kZWZpbmVkJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCByZW5kZXIgdW5kZWZpbmVkXCIpO1xuXG4gIGlmICgoY29udGVudCBpbnN0YW5jZW9mIEJsYXplLlZpZXcpIHx8XG4gICAgICAoY29udGVudCBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKSB8fFxuICAgICAgKHR5cGVvZiBjb250ZW50ID09PSAnZnVuY3Rpb24nKSlcbiAgICByZXR1cm47XG5cbiAgdHJ5IHtcbiAgICAvLyBUaHJvdyBpZiBjb250ZW50IGRvZXNuJ3QgbG9vayBsaWtlIEhUTUxKUyBhdCB0aGUgdG9wIGxldmVsXG4gICAgLy8gKGkuZS4gdmVyaWZ5IHRoYXQgdGhpcyBpcyBhbiBIVE1MLlRhZywgb3IgYW4gYXJyYXksXG4gICAgLy8gb3IgYSBwcmltaXRpdmUsIGV0Yy4pXG4gICAgKG5ldyBIVE1MLlZpc2l0b3IpLnZpc2l0KGNvbnRlbnQpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgLy8gTWFrZSBlcnJvciBtZXNzYWdlIHN1aXRhYmxlIGZvciBwdWJsaWMgQVBJXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgVGVtcGxhdGUgb3IgVmlld1wiKTtcbiAgfVxufTtcblxuLy8gRm9yIEJsYXplLnJlbmRlciBhbmQgQmxhemUudG9IVE1MLCB0YWtlIGNvbnRlbnQgYW5kXG4vLyB3cmFwIGl0IGluIGEgVmlldywgdW5sZXNzIGl0J3MgYSBzaW5nbGUgVmlldyBvclxuLy8gVGVtcGxhdGUgYWxyZWFkeS5cbnZhciBjb250ZW50QXNWaWV3ID0gZnVuY3Rpb24gKGNvbnRlbnQpIHtcbiAgY2hlY2tSZW5kZXJDb250ZW50KGNvbnRlbnQpO1xuXG4gIGlmIChjb250ZW50IGluc3RhbmNlb2YgQmxhemUuVGVtcGxhdGUpIHtcbiAgICByZXR1cm4gY29udGVudC5jb25zdHJ1Y3RWaWV3KCk7XG4gIH0gZWxzZSBpZiAoY29udGVudCBpbnN0YW5jZW9mIEJsYXplLlZpZXcpIHtcbiAgICByZXR1cm4gY29udGVudDtcbiAgfSBlbHNlIHtcbiAgICB2YXIgZnVuYyA9IGNvbnRlbnQ7XG4gICAgaWYgKHR5cGVvZiBmdW5jICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBmdW5jID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gY29udGVudDtcbiAgICAgIH07XG4gICAgfVxuICAgIHJldHVybiBCbGF6ZS5WaWV3KCdyZW5kZXInLCBmdW5jKTtcbiAgfVxufTtcblxuLy8gRm9yIEJsYXplLnJlbmRlcldpdGhEYXRhIGFuZCBCbGF6ZS50b0hUTUxXaXRoRGF0YSwgd3JhcCBjb250ZW50XG4vLyBpbiBhIGZ1bmN0aW9uLCBpZiBuZWNlc3NhcnksIHNvIGl0IGNhbiBiZSBhIGNvbnRlbnQgYXJnIHRvXG4vLyBhIEJsYXplLldpdGguXG52YXIgY29udGVudEFzRnVuYyA9IGZ1bmN0aW9uIChjb250ZW50KSB7XG4gIGNoZWNrUmVuZGVyQ29udGVudChjb250ZW50KTtcblxuICBpZiAodHlwZW9mIGNvbnRlbnQgIT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGNvbnRlbnQ7XG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gY29udGVudDtcbiAgfVxufTtcblxuQmxhemUuX19yb290Vmlld3MgPSBbXTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZW5kZXJzIGEgdGVtcGxhdGUgb3IgVmlldyB0byBET00gbm9kZXMgYW5kIGluc2VydHMgaXQgaW50byB0aGUgRE9NLCByZXR1cm5pbmcgYSByZW5kZXJlZCBbVmlld10oI0JsYXplLVZpZXcpIHdoaWNoIGNhbiBiZSBwYXNzZWQgdG8gW2BCbGF6ZS5yZW1vdmVgXSgjQmxhemUtcmVtb3ZlKS5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7VGVtcGxhdGV8QmxhemUuVmlld30gdGVtcGxhdGVPclZpZXcgVGhlIHRlbXBsYXRlIChlLmcuIGBUZW1wbGF0ZS5teVRlbXBsYXRlYCkgb3IgVmlldyBvYmplY3QgdG8gcmVuZGVyLiAgSWYgYSB0ZW1wbGF0ZSwgYSBWaWV3IG9iamVjdCBpcyBbY29uc3RydWN0ZWRdKCN0ZW1wbGF0ZV9jb25zdHJ1Y3R2aWV3KS4gIElmIGEgVmlldywgaXQgbXVzdCBiZSBhbiB1bnJlbmRlcmVkIFZpZXcsIHdoaWNoIGJlY29tZXMgYSByZW5kZXJlZCBWaWV3IGFuZCBpcyByZXR1cm5lZC5cbiAqIEBwYXJhbSB7RE9NTm9kZX0gcGFyZW50Tm9kZSBUaGUgbm9kZSB0aGF0IHdpbGwgYmUgdGhlIHBhcmVudCBvZiB0aGUgcmVuZGVyZWQgdGVtcGxhdGUuICBJdCBtdXN0IGJlIGFuIEVsZW1lbnQgbm9kZS5cbiAqIEBwYXJhbSB7RE9NTm9kZX0gW25leHROb2RlXSBPcHRpb25hbC4gSWYgcHJvdmlkZWQsIG11c3QgYmUgYSBjaGlsZCBvZiA8ZW0+cGFyZW50Tm9kZTwvZW0+OyB0aGUgdGVtcGxhdGUgd2lsbCBiZSBpbnNlcnRlZCBiZWZvcmUgdGhpcyBub2RlLiBJZiBub3QgcHJvdmlkZWQsIHRoZSB0ZW1wbGF0ZSB3aWxsIGJlIGluc2VydGVkIGFzIHRoZSBsYXN0IGNoaWxkIG9mIHBhcmVudE5vZGUuXG4gKiBAcGFyYW0ge0JsYXplLlZpZXd9IFtwYXJlbnRWaWV3XSBPcHRpb25hbC4gSWYgcHJvdmlkZWQsIGl0IHdpbGwgYmUgc2V0IGFzIHRoZSByZW5kZXJlZCBWaWV3J3MgW2BwYXJlbnRWaWV3YF0oI3ZpZXdfcGFyZW50dmlldykuXG4gKi9cbkJsYXplLnJlbmRlciA9IGZ1bmN0aW9uIChjb250ZW50LCBwYXJlbnRFbGVtZW50LCBuZXh0Tm9kZSwgcGFyZW50Vmlldykge1xuICBpZiAoISBwYXJlbnRFbGVtZW50KSB7XG4gICAgQmxhemUuX3dhcm4oXCJCbGF6ZS5yZW5kZXIgd2l0aG91dCBhIHBhcmVudCBlbGVtZW50IGlzIGRlcHJlY2F0ZWQuIFwiICtcbiAgICAgICAgICAgICAgICBcIllvdSBtdXN0IHNwZWNpZnkgd2hlcmUgdG8gaW5zZXJ0IHRoZSByZW5kZXJlZCBjb250ZW50LlwiKTtcbiAgfVxuXG4gIGlmIChuZXh0Tm9kZSBpbnN0YW5jZW9mIEJsYXplLlZpZXcpIHtcbiAgICAvLyBoYW5kbGUgb21pdHRlZCBuZXh0Tm9kZVxuICAgIHBhcmVudFZpZXcgPSBuZXh0Tm9kZTtcbiAgICBuZXh0Tm9kZSA9IG51bGw7XG4gIH1cblxuICAvLyBwYXJlbnRFbGVtZW50IG11c3QgYmUgYSBET00gbm9kZS4gaW4gcGFydGljdWxhciwgY2FuJ3QgYmUgdGhlXG4gIC8vIHJlc3VsdCBvZiBhIGNhbGwgdG8gYCRgLiBDYW4ndCBjaGVjayBpZiBgcGFyZW50RWxlbWVudCBpbnN0YW5jZW9mXG4gIC8vIE5vZGVgIHNpbmNlICdOb2RlJyBpcyB1bmRlZmluZWQgaW4gSUU4LlxuICBpZiAocGFyZW50RWxlbWVudCAmJiB0eXBlb2YgcGFyZW50RWxlbWVudC5ub2RlVHlwZSAhPT0gJ251bWJlcicpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiJ3BhcmVudEVsZW1lbnQnIG11c3QgYmUgYSBET00gbm9kZVwiKTtcbiAgaWYgKG5leHROb2RlICYmIHR5cGVvZiBuZXh0Tm9kZS5ub2RlVHlwZSAhPT0gJ251bWJlcicpIC8vICduZXh0Tm9kZScgaXMgb3B0aW9uYWxcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCInbmV4dE5vZGUnIG11c3QgYmUgYSBET00gbm9kZVwiKTtcblxuICBwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCBjdXJyZW50Vmlld0lmUmVuZGVyaW5nKCk7XG5cbiAgdmFyIHZpZXcgPSBjb250ZW50QXNWaWV3KGNvbnRlbnQpO1xuXG4gIC8vIFRPRE86IHRoaXMgaXMgb25seSBuZWVkZWQgaW4gZGV2ZWxvcG1lbnRcbiAgaWYgKCFwYXJlbnRWaWV3KSB7XG4gICAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICAgIEJsYXplLl9fcm9vdFZpZXdzLnB1c2godmlldyk7XG4gICAgfSk7XG5cbiAgICB2aWV3Lm9uVmlld0Rlc3Ryb3llZChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgaW5kZXggPSBCbGF6ZS5fX3Jvb3RWaWV3cy5pbmRleE9mKHZpZXcpO1xuICAgICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgICAgQmxhemUuX19yb290Vmlld3Muc3BsaWNlKGluZGV4LCAxKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIEJsYXplLl9tYXRlcmlhbGl6ZVZpZXcodmlldywgcGFyZW50Vmlldyk7XG4gIGlmIChwYXJlbnRFbGVtZW50KSB7XG4gICAgdmlldy5fZG9tcmFuZ2UuYXR0YWNoKHBhcmVudEVsZW1lbnQsIG5leHROb2RlKTtcbiAgfVxuXG4gIHJldHVybiB2aWV3O1xufTtcblxuQmxhemUuaW5zZXJ0ID0gZnVuY3Rpb24gKHZpZXcsIHBhcmVudEVsZW1lbnQsIG5leHROb2RlKSB7XG4gIEJsYXplLl93YXJuKFwiQmxhemUuaW5zZXJ0IGhhcyBiZWVuIGRlcHJlY2F0ZWQuICBTcGVjaWZ5IHdoZXJlIHRvIGluc2VydCB0aGUgXCIgK1xuICAgICAgICAgICAgICBcInJlbmRlcmVkIGNvbnRlbnQgaW4gdGhlIGNhbGwgdG8gQmxhemUucmVuZGVyLlwiKTtcblxuICBpZiAoISAodmlldyAmJiAodmlldy5fZG9tcmFuZ2UgaW5zdGFuY2VvZiBCbGF6ZS5fRE9NUmFuZ2UpKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCB0ZW1wbGF0ZSByZW5kZXJlZCB3aXRoIEJsYXplLnJlbmRlclwiKTtcblxuICB2aWV3Ll9kb21yYW5nZS5hdHRhY2gocGFyZW50RWxlbWVudCwgbmV4dE5vZGUpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZW5kZXJzIGEgdGVtcGxhdGUgb3IgVmlldyB0byBET00gbm9kZXMgd2l0aCBhIGRhdGEgY29udGV4dC4gIE90aGVyd2lzZSBpZGVudGljYWwgdG8gYEJsYXplLnJlbmRlcmAuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IHRvIHJlbmRlci5cbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBkYXRhIFRoZSBkYXRhIGNvbnRleHQgdG8gdXNlLCBvciBhIGZ1bmN0aW9uIHJldHVybmluZyBhIGRhdGEgY29udGV4dC4gIElmIGEgZnVuY3Rpb24gaXMgcHJvdmlkZWQsIGl0IHdpbGwgYmUgcmVhY3RpdmVseSByZS1ydW4uXG4gKiBAcGFyYW0ge0RPTU5vZGV9IHBhcmVudE5vZGUgVGhlIG5vZGUgdGhhdCB3aWxsIGJlIHRoZSBwYXJlbnQgb2YgdGhlIHJlbmRlcmVkIHRlbXBsYXRlLiAgSXQgbXVzdCBiZSBhbiBFbGVtZW50IG5vZGUuXG4gKiBAcGFyYW0ge0RPTU5vZGV9IFtuZXh0Tm9kZV0gT3B0aW9uYWwuIElmIHByb3ZpZGVkLCBtdXN0IGJlIGEgY2hpbGQgb2YgPGVtPnBhcmVudE5vZGU8L2VtPjsgdGhlIHRlbXBsYXRlIHdpbGwgYmUgaW5zZXJ0ZWQgYmVmb3JlIHRoaXMgbm9kZS4gSWYgbm90IHByb3ZpZGVkLCB0aGUgdGVtcGxhdGUgd2lsbCBiZSBpbnNlcnRlZCBhcyB0aGUgbGFzdCBjaGlsZCBvZiBwYXJlbnROb2RlLlxuICogQHBhcmFtIHtCbGF6ZS5WaWV3fSBbcGFyZW50Vmlld10gT3B0aW9uYWwuIElmIHByb3ZpZGVkLCBpdCB3aWxsIGJlIHNldCBhcyB0aGUgcmVuZGVyZWQgVmlldydzIFtgcGFyZW50Vmlld2BdKCN2aWV3X3BhcmVudHZpZXcpLlxuICovXG5CbGF6ZS5yZW5kZXJXaXRoRGF0YSA9IGZ1bmN0aW9uIChjb250ZW50LCBkYXRhLCBwYXJlbnRFbGVtZW50LCBuZXh0Tm9kZSwgcGFyZW50Vmlldykge1xuICAvLyBXZSBkZWZlciB0aGUgaGFuZGxpbmcgb2Ygb3B0aW9uYWwgYXJndW1lbnRzIHRvIEJsYXplLnJlbmRlci4gIEF0IHRoaXMgcG9pbnQsXG4gIC8vIGBuZXh0Tm9kZWAgbWF5IGFjdHVhbGx5IGJlIGBwYXJlbnRWaWV3YC5cbiAgcmV0dXJuIEJsYXplLnJlbmRlcihCbGF6ZS5fVGVtcGxhdGVXaXRoKGRhdGEsIGNvbnRlbnRBc0Z1bmMoY29udGVudCkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRFbGVtZW50LCBuZXh0Tm9kZSwgcGFyZW50Vmlldyk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbW92ZXMgYSByZW5kZXJlZCBWaWV3IGZyb20gdGhlIERPTSwgc3RvcHBpbmcgYWxsIHJlYWN0aXZlIHVwZGF0ZXMgYW5kIGV2ZW50IGxpc3RlbmVycyBvbiBpdC4gQWxzbyBkZXN0cm95cyB0aGUgQmxhemUuVGVtcGxhdGUgaW5zdGFuY2UgYXNzb2NpYXRlZCB3aXRoIHRoZSB2aWV3LlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtCbGF6ZS5WaWV3fSByZW5kZXJlZFZpZXcgVGhlIHJldHVybiB2YWx1ZSBmcm9tIGBCbGF6ZS5yZW5kZXJgIG9yIGBCbGF6ZS5yZW5kZXJXaXRoRGF0YWAsIG9yIHRoZSBgdmlld2AgcHJvcGVydHkgb2YgYSBCbGF6ZS5UZW1wbGF0ZSBpbnN0YW5jZS4gQ2FsbGluZyBgQmxhemUucmVtb3ZlKFRlbXBsYXRlLmluc3RhbmNlKCkudmlldylgIGZyb20gd2l0aGluIGEgdGVtcGxhdGUgZXZlbnQgaGFuZGxlciB3aWxsIGRlc3Ryb3kgdGhlIHZpZXcgYXMgd2VsbCBhcyB0aGF0IHRlbXBsYXRlIGFuZCB0cmlnZ2VyIHRoZSB0ZW1wbGF0ZSdzIGBvbkRlc3Ryb3llZGAgaGFuZGxlcnMuXG4gKi9cbkJsYXplLnJlbW92ZSA9IGZ1bmN0aW9uICh2aWV3KSB7XG4gIGlmICghICh2aWV3ICYmICh2aWV3Ll9kb21yYW5nZSBpbnN0YW5jZW9mIEJsYXplLl9ET01SYW5nZSkpKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIHRlbXBsYXRlIHJlbmRlcmVkIHdpdGggQmxhemUucmVuZGVyXCIpO1xuXG4gIHdoaWxlICh2aWV3KSB7XG4gICAgaWYgKCEgdmlldy5pc0Rlc3Ryb3llZCkge1xuICAgICAgdmFyIHJhbmdlID0gdmlldy5fZG9tcmFuZ2U7XG4gICAgICByYW5nZS5kZXN0cm95KCk7XG5cbiAgICAgIGlmIChyYW5nZS5hdHRhY2hlZCAmJiAhIHJhbmdlLnBhcmVudFJhbmdlKSB7XG4gICAgICAgIHJhbmdlLmRldGFjaCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZpZXcgPSB2aWV3Ll9oYXNHZW5lcmF0ZWRQYXJlbnQgJiYgdmlldy5wYXJlbnRWaWV3O1xuICB9XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbmRlcnMgYSB0ZW1wbGF0ZSBvciBWaWV3IHRvIGEgc3RyaW5nIG9mIEhUTUwuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IGZyb20gd2hpY2ggdG8gZ2VuZXJhdGUgSFRNTC5cbiAqL1xuQmxhemUudG9IVE1MID0gZnVuY3Rpb24gKGNvbnRlbnQsIHBhcmVudFZpZXcpIHtcbiAgcGFyZW50VmlldyA9IHBhcmVudFZpZXcgfHwgY3VycmVudFZpZXdJZlJlbmRlcmluZygpO1xuXG4gIHJldHVybiBIVE1MLnRvSFRNTChCbGF6ZS5fZXhwYW5kVmlldyhjb250ZW50QXNWaWV3KGNvbnRlbnQpLCBwYXJlbnRWaWV3KSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbmRlcnMgYSB0ZW1wbGF0ZSBvciBWaWV3IHRvIEhUTUwgd2l0aCBhIGRhdGEgY29udGV4dC4gIE90aGVyd2lzZSBpZGVudGljYWwgdG8gYEJsYXplLnRvSFRNTGAuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1RlbXBsYXRlfEJsYXplLlZpZXd9IHRlbXBsYXRlT3JWaWV3IFRoZSB0ZW1wbGF0ZSAoZS5nLiBgVGVtcGxhdGUubXlUZW1wbGF0ZWApIG9yIFZpZXcgb2JqZWN0IGZyb20gd2hpY2ggdG8gZ2VuZXJhdGUgSFRNTC5cbiAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBkYXRhIFRoZSBkYXRhIGNvbnRleHQgdG8gdXNlLCBvciBhIGZ1bmN0aW9uIHJldHVybmluZyBhIGRhdGEgY29udGV4dC5cbiAqL1xuQmxhemUudG9IVE1MV2l0aERhdGEgPSBmdW5jdGlvbiAoY29udGVudCwgZGF0YSwgcGFyZW50Vmlldykge1xuICBwYXJlbnRWaWV3ID0gcGFyZW50VmlldyB8fCBjdXJyZW50Vmlld0lmUmVuZGVyaW5nKCk7XG5cbiAgcmV0dXJuIEhUTUwudG9IVE1MKEJsYXplLl9leHBhbmRWaWV3KEJsYXplLl9UZW1wbGF0ZVdpdGgoXG4gICAgZGF0YSwgY29udGVudEFzRnVuYyhjb250ZW50KSksIHBhcmVudFZpZXcpKTtcbn07XG5cbkJsYXplLl90b1RleHQgPSBmdW5jdGlvbiAoaHRtbGpzLCBwYXJlbnRWaWV3LCB0ZXh0TW9kZSkge1xuICBpZiAodHlwZW9mIGh0bWxqcyA9PT0gJ2Z1bmN0aW9uJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJCbGF6ZS5fdG9UZXh0IGRvZXNuJ3QgdGFrZSBhIGZ1bmN0aW9uLCBqdXN0IEhUTUxqc1wiKTtcblxuICBpZiAoKHBhcmVudFZpZXcgIT0gbnVsbCkgJiYgISAocGFyZW50VmlldyBpbnN0YW5jZW9mIEJsYXplLlZpZXcpKSB7XG4gICAgLy8gb21pdHRlZCBwYXJlbnRWaWV3IGFyZ3VtZW50XG4gICAgdGV4dE1vZGUgPSBwYXJlbnRWaWV3O1xuICAgIHBhcmVudFZpZXcgPSBudWxsO1xuICB9XG4gIHBhcmVudFZpZXcgPSBwYXJlbnRWaWV3IHx8IGN1cnJlbnRWaWV3SWZSZW5kZXJpbmcoKTtcblxuICBpZiAoISB0ZXh0TW9kZSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0ZXh0TW9kZSByZXF1aXJlZFwiKTtcbiAgaWYgKCEgKHRleHRNb2RlID09PSBIVE1MLlRFWFRNT0RFLlNUUklORyB8fFxuICAgICAgICAgdGV4dE1vZGUgPT09IEhUTUwuVEVYVE1PREUuUkNEQVRBIHx8XG4gICAgICAgICB0ZXh0TW9kZSA9PT0gSFRNTC5URVhUTU9ERS5BVFRSSUJVVEUpKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gdGV4dE1vZGU6IFwiICsgdGV4dE1vZGUpO1xuXG4gIHJldHVybiBIVE1MLnRvVGV4dChCbGF6ZS5fZXhwYW5kKGh0bWxqcywgcGFyZW50VmlldyksIHRleHRNb2RlKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgUmV0dXJucyB0aGUgY3VycmVudCBkYXRhIGNvbnRleHQsIG9yIHRoZSBkYXRhIGNvbnRleHQgdGhhdCB3YXMgdXNlZCB3aGVuIHJlbmRlcmluZyBhIHBhcnRpY3VsYXIgRE9NIGVsZW1lbnQgb3IgVmlldyBmcm9tIGEgTWV0ZW9yIHRlbXBsYXRlLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtET01FbGVtZW50fEJsYXplLlZpZXd9IFtlbGVtZW50T3JWaWV3XSBPcHRpb25hbC4gIEFuIGVsZW1lbnQgdGhhdCB3YXMgcmVuZGVyZWQgYnkgYSBNZXRlb3IsIG9yIGEgVmlldy5cbiAqL1xuQmxhemUuZ2V0RGF0YSA9IGZ1bmN0aW9uIChlbGVtZW50T3JWaWV3KSB7XG4gIHZhciB0aGVXaXRoO1xuXG4gIGlmICghIGVsZW1lbnRPclZpZXcpIHtcbiAgICB0aGVXaXRoID0gQmxhemUuZ2V0Vmlldygnd2l0aCcpO1xuICB9IGVsc2UgaWYgKGVsZW1lbnRPclZpZXcgaW5zdGFuY2VvZiBCbGF6ZS5WaWV3KSB7XG4gICAgdmFyIHZpZXcgPSBlbGVtZW50T3JWaWV3O1xuICAgIHRoZVdpdGggPSAodmlldy5uYW1lID09PSAnd2l0aCcgPyB2aWV3IDpcbiAgICAgICAgICAgICAgIEJsYXplLmdldFZpZXcodmlldywgJ3dpdGgnKSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVsZW1lbnRPclZpZXcubm9kZVR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKGVsZW1lbnRPclZpZXcubm9kZVR5cGUgIT09IDEpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBET00gZWxlbWVudFwiKTtcbiAgICB0aGVXaXRoID0gQmxhemUuZ2V0VmlldyhlbGVtZW50T3JWaWV3LCAnd2l0aCcpO1xuICB9IGVsc2Uge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIERPTSBlbGVtZW50IG9yIFZpZXdcIik7XG4gIH1cblxuICByZXR1cm4gdGhlV2l0aCA/IHRoZVdpdGguZGF0YVZhci5nZXQoKSA6IG51bGw7XG59O1xuXG4vLyBGb3IgYmFjay1jb21wYXRcbkJsYXplLmdldEVsZW1lbnREYXRhID0gZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgQmxhemUuX3dhcm4oXCJCbGF6ZS5nZXRFbGVtZW50RGF0YSBoYXMgYmVlbiBkZXByZWNhdGVkLiAgVXNlIFwiICtcbiAgICAgICAgICAgICAgXCJCbGF6ZS5nZXREYXRhKGVsZW1lbnQpIGluc3RlYWQuXCIpO1xuXG4gIGlmIChlbGVtZW50Lm5vZGVUeXBlICE9PSAxKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkV4cGVjdGVkIERPTSBlbGVtZW50XCIpO1xuXG4gIHJldHVybiBCbGF6ZS5nZXREYXRhKGVsZW1lbnQpO1xufTtcblxuLy8gQm90aCBhcmd1bWVudHMgYXJlIG9wdGlvbmFsLlxuXG4vKipcbiAqIEBzdW1tYXJ5IEdldHMgZWl0aGVyIHRoZSBjdXJyZW50IFZpZXcsIG9yIHRoZSBWaWV3IGVuY2xvc2luZyB0aGUgZ2l2ZW4gRE9NIGVsZW1lbnQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0RPTUVsZW1lbnR9IFtlbGVtZW50XSBPcHRpb25hbC4gIElmIHNwZWNpZmllZCwgdGhlIFZpZXcgZW5jbG9zaW5nIGBlbGVtZW50YCBpcyByZXR1cm5lZC5cbiAqL1xuQmxhemUuZ2V0VmlldyA9IGZ1bmN0aW9uIChlbGVtZW50T3JWaWV3LCBfdmlld05hbWUpIHtcbiAgdmFyIHZpZXdOYW1lID0gX3ZpZXdOYW1lO1xuXG4gIGlmICgodHlwZW9mIGVsZW1lbnRPclZpZXcpID09PSAnc3RyaW5nJykge1xuICAgIC8vIG9taXR0ZWQgZWxlbWVudE9yVmlldzsgdmlld05hbWUgcHJlc2VudFxuICAgIHZpZXdOYW1lID0gZWxlbWVudE9yVmlldztcbiAgICBlbGVtZW50T3JWaWV3ID0gbnVsbDtcbiAgfVxuXG4gIC8vIFdlIGNvdWxkIGV2ZW50dWFsbHkgc2hvcnRlbiB0aGUgY29kZSBieSBmb2xkaW5nIHRoZSBsb2dpY1xuICAvLyBmcm9tIHRoZSBvdGhlciBtZXRob2RzIGludG8gdGhpcyBtZXRob2QuXG4gIGlmICghIGVsZW1lbnRPclZpZXcpIHtcbiAgICByZXR1cm4gQmxhemUuX2dldEN1cnJlbnRWaWV3KHZpZXdOYW1lKTtcbiAgfSBlbHNlIGlmIChlbGVtZW50T3JWaWV3IGluc3RhbmNlb2YgQmxhemUuVmlldykge1xuICAgIHJldHVybiBCbGF6ZS5fZ2V0UGFyZW50VmlldyhlbGVtZW50T3JWaWV3LCB2aWV3TmFtZSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGVsZW1lbnRPclZpZXcubm9kZVR5cGUgPT09ICdudW1iZXInKSB7XG4gICAgcmV0dXJuIEJsYXplLl9nZXRFbGVtZW50VmlldyhlbGVtZW50T3JWaWV3LCB2aWV3TmFtZSk7XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgRE9NIGVsZW1lbnQgb3IgVmlld1wiKTtcbiAgfVxufTtcblxuLy8gR2V0cyB0aGUgY3VycmVudCB2aWV3IG9yIGl0cyBuZWFyZXN0IGFuY2VzdG9yIG9mIG5hbWVcbi8vIGBuYW1lYC5cbkJsYXplLl9nZXRDdXJyZW50VmlldyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuY3VycmVudFZpZXc7XG4gIC8vIEJldHRlciB0byBmYWlsIGluIGNhc2VzIHdoZXJlIGl0IGRvZXNuJ3QgbWFrZSBzZW5zZVxuICAvLyB0byB1c2UgQmxhemUuX2dldEN1cnJlbnRWaWV3KCkuICBUaGVyZSB3aWxsIGJlIGEgY3VycmVudFxuICAvLyB2aWV3IGFueXdoZXJlIGl0IGRvZXMuICBZb3UgY2FuIGNoZWNrIEJsYXplLmN1cnJlbnRWaWV3XG4gIC8vIGlmIHlvdSB3YW50IHRvIGtub3cgd2hldGhlciB0aGVyZSBpcyBvbmUgb3Igbm90LlxuICBpZiAoISB2aWV3KVxuICAgIHRocm93IG5ldyBFcnJvcihcIlRoZXJlIGlzIG5vIGN1cnJlbnQgdmlld1wiKTtcblxuICBpZiAobmFtZSkge1xuICAgIHdoaWxlICh2aWV3ICYmIHZpZXcubmFtZSAhPT0gbmFtZSlcbiAgICAgIHZpZXcgPSB2aWV3LnBhcmVudFZpZXc7XG4gICAgcmV0dXJuIHZpZXcgfHwgbnVsbDtcbiAgfSBlbHNlIHtcbiAgICAvLyBCbGF6ZS5fZ2V0Q3VycmVudFZpZXcoKSB3aXRoIG5vIGFyZ3VtZW50cyBqdXN0IHJldHVybnNcbiAgICAvLyBCbGF6ZS5jdXJyZW50Vmlldy5cbiAgICByZXR1cm4gdmlldztcbiAgfVxufTtcblxuQmxhemUuX2dldFBhcmVudFZpZXcgPSBmdW5jdGlvbiAodmlldywgbmFtZSkge1xuICB2YXIgdiA9IHZpZXcucGFyZW50VmlldztcblxuICBpZiAobmFtZSkge1xuICAgIHdoaWxlICh2ICYmIHYubmFtZSAhPT0gbmFtZSlcbiAgICAgIHYgPSB2LnBhcmVudFZpZXc7XG4gIH1cblxuICByZXR1cm4gdiB8fCBudWxsO1xufTtcblxuQmxhemUuX2dldEVsZW1lbnRWaWV3ID0gZnVuY3Rpb24gKGVsZW0sIG5hbWUpIHtcbiAgdmFyIHJhbmdlID0gQmxhemUuX0RPTVJhbmdlLmZvckVsZW1lbnQoZWxlbSk7XG4gIHZhciB2aWV3ID0gbnVsbDtcbiAgd2hpbGUgKHJhbmdlICYmICEgdmlldykge1xuICAgIHZpZXcgPSAocmFuZ2UudmlldyB8fCBudWxsKTtcbiAgICBpZiAoISB2aWV3KSB7XG4gICAgICBpZiAocmFuZ2UucGFyZW50UmFuZ2UpXG4gICAgICAgIHJhbmdlID0gcmFuZ2UucGFyZW50UmFuZ2U7XG4gICAgICBlbHNlXG4gICAgICAgIHJhbmdlID0gQmxhemUuX0RPTVJhbmdlLmZvckVsZW1lbnQocmFuZ2UucGFyZW50RWxlbWVudCk7XG4gICAgfVxuICB9XG5cbiAgaWYgKG5hbWUpIHtcbiAgICB3aGlsZSAodmlldyAmJiB2aWV3Lm5hbWUgIT09IG5hbWUpXG4gICAgICB2aWV3ID0gdmlldy5wYXJlbnRWaWV3O1xuICAgIHJldHVybiB2aWV3IHx8IG51bGw7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHZpZXc7XG4gIH1cbn07XG5cbkJsYXplLl9hZGRFdmVudE1hcCA9IGZ1bmN0aW9uICh2aWV3LCBldmVudE1hcCwgdGhpc0luSGFuZGxlcikge1xuICB0aGlzSW5IYW5kbGVyID0gKHRoaXNJbkhhbmRsZXIgfHwgbnVsbCk7XG4gIHZhciBoYW5kbGVzID0gW107XG5cbiAgaWYgKCEgdmlldy5fZG9tcmFuZ2UpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVmlldyBtdXN0IGhhdmUgYSBET01SYW5nZVwiKTtcblxuICB2aWV3Ll9kb21yYW5nZS5vbkF0dGFjaGVkKGZ1bmN0aW9uIGF0dGFjaGVkX2V2ZW50TWFwcyhyYW5nZSwgZWxlbWVudCkge1xuICAgIE9iamVjdC5rZXlzKGV2ZW50TWFwKS5mb3JFYWNoKGZ1bmN0aW9uIChzcGVjKSB7XG4gICAgICBsZXQgaGFuZGxlciA9IGV2ZW50TWFwW3NwZWNdO1xuICAgICAgdmFyIGNsYXVzZXMgPSBzcGVjLnNwbGl0KC8sXFxzKy8pO1xuICAgICAgLy8gaXRlcmF0ZSBvdmVyIGNsYXVzZXMgb2Ygc3BlYywgZS5nLiBbJ2NsaWNrIC5mb28nLCAnY2xpY2sgLmJhciddXG4gICAgICBjbGF1c2VzLmZvckVhY2goZnVuY3Rpb24gKGNsYXVzZSkge1xuICAgICAgICB2YXIgcGFydHMgPSBjbGF1c2Uuc3BsaXQoL1xccysvKTtcbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMClcbiAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgdmFyIG5ld0V2ZW50cyA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgICAgIHZhciBzZWxlY3RvciA9IHBhcnRzLmpvaW4oJyAnKTtcbiAgICAgICAgaGFuZGxlcy5wdXNoKEJsYXplLl9FdmVudFN1cHBvcnQubGlzdGVuKFxuICAgICAgICAgIGVsZW1lbnQsIG5ld0V2ZW50cywgc2VsZWN0b3IsXG4gICAgICAgICAgZnVuY3Rpb24gKGV2dCkge1xuICAgICAgICAgICAgaWYgKCEgcmFuZ2UuY29udGFpbnNFbGVtZW50KGV2dC5jdXJyZW50VGFyZ2V0LCBzZWxlY3RvciwgbmV3RXZlbnRzKSlcbiAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB2YXIgaGFuZGxlclRoaXMgPSB0aGlzSW5IYW5kbGVyIHx8IHRoaXM7XG4gICAgICAgICAgICB2YXIgaGFuZGxlckFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICAgICAgICByZXR1cm4gQmxhemUuX3dpdGhDdXJyZW50Vmlldyh2aWV3LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIHJldHVybiBoYW5kbGVyLmFwcGx5KGhhbmRsZXJUaGlzLCBoYW5kbGVyQXJncyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuICAgICAgICAgIHJhbmdlLCBmdW5jdGlvbiAocikge1xuICAgICAgICAgICAgcmV0dXJuIHIucGFyZW50UmFuZ2U7XG4gICAgICAgICAgfSkpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIHZpZXcub25WaWV3RGVzdHJveWVkKGZ1bmN0aW9uICgpIHtcbiAgICBoYW5kbGVzLmZvckVhY2goZnVuY3Rpb24gKGgpIHtcbiAgICAgIGguc3RvcCgpO1xuICAgIH0pO1xuICAgIGhhbmRsZXMubGVuZ3RoID0gMDtcbiAgfSk7XG59O1xuIiwiaW1wb3J0IGhhcyBmcm9tICdsb2Rhc2guaGFzJztcbmltcG9ydCBpc09iamVjdCBmcm9tICdsb2Rhc2guaXNvYmplY3QnO1xuXG5CbGF6ZS5fY2FsY3VsYXRlQ29uZGl0aW9uID0gZnVuY3Rpb24gKGNvbmQpIHtcbiAgaWYgKEhUTUwuaXNBcnJheShjb25kKSAmJiBjb25kLmxlbmd0aCA9PT0gMClcbiAgICBjb25kID0gZmFsc2U7XG4gIHJldHVybiAhISBjb25kO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBDb25zdHJ1Y3RzIGEgVmlldyB0aGF0IHJlbmRlcnMgY29udGVudCB3aXRoIGEgZGF0YSBjb250ZXh0LlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtPYmplY3R8RnVuY3Rpb259IGRhdGEgQW4gb2JqZWN0IHRvIHVzZSBhcyB0aGUgZGF0YSBjb250ZXh0LCBvciBhIGZ1bmN0aW9uIHJldHVybmluZyBzdWNoIGFuIG9iamVjdC4gIElmIGFcbiAqICAgZnVuY3Rpb24gaXMgcHJvdmlkZWQsIGl0IHdpbGwgYmUgcmVhY3RpdmVseSByZS1ydW4uXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZW50RnVuYyBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBbKnJlbmRlcmFibGUgY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpLlxuICovXG5CbGF6ZS5XaXRoID0gZnVuY3Rpb24gKGRhdGEsIGNvbnRlbnRGdW5jKSB7XG4gIHZhciB2aWV3ID0gQmxhemUuVmlldygnd2l0aCcsIGNvbnRlbnRGdW5jKTtcblxuICB2aWV3LmRhdGFWYXIgPSBuZXcgUmVhY3RpdmVWYXI7XG5cbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIC8vIGBkYXRhYCBpcyBhIHJlYWN0aXZlIGZ1bmN0aW9uXG4gICAgICB2aWV3LmF1dG9ydW4oZnVuY3Rpb24gKCkge1xuICAgICAgICB2aWV3LmRhdGFWYXIuc2V0KGRhdGEoKSk7XG4gICAgICB9LCB2aWV3LnBhcmVudFZpZXcsICdzZXREYXRhJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZpZXcuZGF0YVZhci5zZXQoZGF0YSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gdmlldztcbn07XG5cblxuLyoqXG4gKiBAc3VtbWFyeSBTaGFsbG93IGNvbXBhcmUgb2YgdHdvIGJpbmRpbmdzLlxuICogQHBhcmFtIHtCaW5kaW5nfSB4XG4gKiBAcGFyYW0ge0JpbmRpbmd9IHlcbiAqL1xuZnVuY3Rpb24gX2lzRXF1YWxCaW5kaW5nKHgsIHkpIHtcbiAgaWYgKHR5cGVvZiB4ID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgeSA9PT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm4geC5lcnJvciA9PT0geS5lcnJvciAmJiBSZWFjdGl2ZVZhci5faXNFcXVhbCh4LnZhbHVlLCB5LnZhbHVlKTtcbiAgfVxuICBlbHNlIHtcbiAgICByZXR1cm4gUmVhY3RpdmVWYXIuX2lzRXF1YWwoeCwgeSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBdHRhY2hlcyBiaW5kaW5ncyB0byB0aGUgaW5zdGFudGlhdGVkIHZpZXcuXG4gKiBAcGFyYW0ge09iamVjdH0gYmluZGluZ3MgQSBkaWN0aW9uYXJ5IG9mIGJpbmRpbmdzLCBlYWNoIGJpbmRpbmcgbmFtZVxuICogY29ycmVzcG9uZHMgdG8gYSB2YWx1ZSBvciBhIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSByZWFjdGl2ZWx5IHJlLXJ1bi5cbiAqIEBwYXJhbSB7QmxhemUuVmlld30gdmlldyBUaGUgdGFyZ2V0LlxuICovXG5CbGF6ZS5fYXR0YWNoQmluZGluZ3NUb1ZpZXcgPSBmdW5jdGlvbiAoYmluZGluZ3MsIHZpZXcpIHtcbiAgZnVuY3Rpb24gc2V0QmluZGluZ1ZhbHVlKG5hbWUsIHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZS50aGVuID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB2YWx1ZS50aGVuKFxuICAgICAgICB2YWx1ZSA9PiB2aWV3Ll9zY29wZUJpbmRpbmdzW25hbWVdLnNldCh7IHZhbHVlIH0pLFxuICAgICAgICBlcnJvciA9PiB2aWV3Ll9zY29wZUJpbmRpbmdzW25hbWVdLnNldCh7IGVycm9yIH0pLFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmlldy5fc2NvcGVCaW5kaW5nc1tuYW1lXS5zZXQoeyB2YWx1ZSB9KTtcbiAgICB9XG4gIH1cblxuICB2aWV3Lm9uVmlld0NyZWF0ZWQoZnVuY3Rpb24gKCkge1xuICAgIE9iamVjdC5lbnRyaWVzKGJpbmRpbmdzKS5mb3JFYWNoKGZ1bmN0aW9uIChbbmFtZSwgYmluZGluZ10pIHtcbiAgICAgIHZpZXcuX3Njb3BlQmluZGluZ3NbbmFtZV0gPSBuZXcgUmVhY3RpdmVWYXIodW5kZWZpbmVkLCBfaXNFcXVhbEJpbmRpbmcpO1xuICAgICAgaWYgKHR5cGVvZiBiaW5kaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHZpZXcuYXV0b3J1bigoKSA9PiBzZXRCaW5kaW5nVmFsdWUobmFtZSwgYmluZGluZygpKSwgdmlldy5wYXJlbnRWaWV3KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldEJpbmRpbmdWYWx1ZShuYW1lLCBiaW5kaW5nKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IENvbnN0cnVjdHMgYSBWaWV3IHNldHRpbmcgdGhlIGxvY2FsIGxleGljYWwgc2NvcGUgaW4gdGhlIGJsb2NrLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gYmluZGluZ3MgRGljdGlvbmFyeSBtYXBwaW5nIG5hbWVzIG9mIGJpbmRpbmdzIHRvXG4gKiB2YWx1ZXMgb3IgY29tcHV0YXRpb25zIHRvIHJlYWN0aXZlbHkgcmUtcnVuLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY29udGVudEZ1bmMgQSBGdW5jdGlvbiB0aGF0IHJldHVybnMgWypyZW5kZXJhYmxlIGNvbnRlbnQqXSgjUmVuZGVyYWJsZS1Db250ZW50KS5cbiAqL1xuQmxhemUuTGV0ID0gZnVuY3Rpb24gKGJpbmRpbmdzLCBjb250ZW50RnVuYykge1xuICB2YXIgdmlldyA9IEJsYXplLlZpZXcoJ2xldCcsIGNvbnRlbnRGdW5jKTtcbiAgQmxhemUuX2F0dGFjaEJpbmRpbmdzVG9WaWV3KGJpbmRpbmdzLCB2aWV3KTtcblxuICByZXR1cm4gdmlldztcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQ29uc3RydWN0cyBhIFZpZXcgdGhhdCByZW5kZXJzIGNvbnRlbnQgY29uZGl0aW9uYWxseS5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNvbmRpdGlvbkZ1bmMgQSBmdW5jdGlvbiB0byByZWFjdGl2ZWx5IHJlLXJ1bi4gIFdoZXRoZXIgdGhlIHJlc3VsdCBpcyB0cnV0aHkgb3IgZmFsc3kgZGV0ZXJtaW5lc1xuICogICB3aGV0aGVyIGBjb250ZW50RnVuY2Agb3IgYGVsc2VGdW5jYCBpcyBzaG93bi4gIEFuIGVtcHR5IGFycmF5IGlzIGNvbnNpZGVyZWQgZmFsc3kuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZW50RnVuYyBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBbKnJlbmRlcmFibGUgY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2Vsc2VGdW5jXSBPcHRpb25hbC4gIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuICBJZiBub1xuICogICBgZWxzZUZ1bmNgIGlzIHN1cHBsaWVkLCBubyBjb250ZW50IGlzIHNob3duIGluIHRoZSBcImVsc2VcIiBjYXNlLlxuICovXG5CbGF6ZS5JZiA9IGZ1bmN0aW9uIChjb25kaXRpb25GdW5jLCBjb250ZW50RnVuYywgZWxzZUZ1bmMsIF9ub3QpIHtcbiAgdmFyIGNvbmRpdGlvblZhciA9IG5ldyBSZWFjdGl2ZVZhcjtcblxuICB2YXIgdmlldyA9IEJsYXplLlZpZXcoX25vdCA/ICd1bmxlc3MnIDogJ2lmJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBjb25kaXRpb25WYXIuZ2V0KCkgPyBjb250ZW50RnVuYygpIDpcbiAgICAgIChlbHNlRnVuYyA/IGVsc2VGdW5jKCkgOiBudWxsKTtcbiAgfSk7XG4gIHZpZXcuX19jb25kaXRpb25WYXIgPSBjb25kaXRpb25WYXI7XG4gIHZpZXcub25WaWV3Q3JlYXRlZChmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5hdXRvcnVuKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBjb25kID0gQmxhemUuX2NhbGN1bGF0ZUNvbmRpdGlvbihjb25kaXRpb25GdW5jKCkpO1xuICAgICAgY29uZGl0aW9uVmFyLnNldChfbm90ID8gKCEgY29uZCkgOiBjb25kKTtcbiAgICB9LCB0aGlzLnBhcmVudFZpZXcsICdjb25kaXRpb24nKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHZpZXc7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEFuIGludmVydGVkIFtgQmxhemUuSWZgXSgjQmxhemUtSWYpLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gY29uZGl0aW9uRnVuYyBBIGZ1bmN0aW9uIHRvIHJlYWN0aXZlbHkgcmUtcnVuLiAgSWYgdGhlIHJlc3VsdCBpcyBmYWxzeSwgYGNvbnRlbnRGdW5jYCBpcyBzaG93bixcbiAqICAgb3RoZXJ3aXNlIGBlbHNlRnVuY2AgaXMgc2hvd24uICBBbiBlbXB0eSBhcnJheSBpcyBjb25zaWRlcmVkIGZhbHN5LlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY29udGVudEZ1bmMgQSBGdW5jdGlvbiB0aGF0IHJldHVybnMgWypyZW5kZXJhYmxlIGNvbnRlbnQqXSgjUmVuZGVyYWJsZS1Db250ZW50KS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFtlbHNlRnVuY10gT3B0aW9uYWwuICBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyBbKnJlbmRlcmFibGUgY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpLiAgSWYgbm9cbiAqICAgYGVsc2VGdW5jYCBpcyBzdXBwbGllZCwgbm8gY29udGVudCBpcyBzaG93biBpbiB0aGUgXCJlbHNlXCIgY2FzZS5cbiAqL1xuQmxhemUuVW5sZXNzID0gZnVuY3Rpb24gKGNvbmRpdGlvbkZ1bmMsIGNvbnRlbnRGdW5jLCBlbHNlRnVuYykge1xuICByZXR1cm4gQmxhemUuSWYoY29uZGl0aW9uRnVuYywgY29udGVudEZ1bmMsIGVsc2VGdW5jLCB0cnVlIC8qX25vdCovKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQ29uc3RydWN0cyBhIFZpZXcgdGhhdCByZW5kZXJzIGBjb250ZW50RnVuY2AgZm9yIGVhY2ggaXRlbSBpbiBhIHNlcXVlbmNlLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gYXJnRnVuYyBBIGZ1bmN0aW9uIHRvIHJlYWN0aXZlbHkgcmUtcnVuLiBUaGUgZnVuY3Rpb24gY2FuXG4gKiByZXR1cm4gb25lIG9mIHR3byBvcHRpb25zOlxuICpcbiAqIDEuIEFuIG9iamVjdCB3aXRoIHR3byBmaWVsZHM6ICdfdmFyaWFibGUnIGFuZCAnX3NlcXVlbmNlJy4gRWFjaCBpdGVyYXRlcyBvdmVyXG4gKiAgICdfc2VxdWVuY2UnLCBpdCBtYXkgYmUgYSBDdXJzb3IsIGFuIGFycmF5LCBudWxsLCBvciB1bmRlZmluZWQuIEluc2lkZSB0aGVcbiAqICAgRWFjaCBib2R5IHlvdSB3aWxsIGJlIGFibGUgdG8gZ2V0IHRoZSBjdXJyZW50IGl0ZW0gZnJvbSB0aGUgc2VxdWVuY2UgdXNpbmdcbiAqICAgdGhlIG5hbWUgc3BlY2lmaWVkIGluIHRoZSAnX3ZhcmlhYmxlJyBmaWVsZC5cbiAqXG4gKiAyLiBKdXN0IGEgc2VxdWVuY2UgKEN1cnNvciwgYXJyYXksIG51bGwsIG9yIHVuZGVmaW5lZCkgbm90IHdyYXBwZWQgaW50byBhblxuICogICBvYmplY3QuIEluc2lkZSB0aGUgRWFjaCBib2R5LCB0aGUgY3VycmVudCBpdGVtIHdpbGwgYmUgc2V0IGFzIHRoZSBkYXRhXG4gKiAgIGNvbnRleHQuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjb250ZW50RnVuYyBBIEZ1bmN0aW9uIHRoYXQgcmV0dXJucyAgWypyZW5kZXJhYmxlXG4gKiBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbZWxzZUZ1bmNdIEEgRnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZVxuICogY29udGVudCpdKCNSZW5kZXJhYmxlLUNvbnRlbnQpIHRvIGRpc3BsYXkgaW4gdGhlIGNhc2Ugd2hlbiB0aGVyZSBhcmUgbm8gaXRlbXNcbiAqIGluIHRoZSBzZXF1ZW5jZS5cbiAqL1xuQmxhemUuRWFjaCA9IGZ1bmN0aW9uIChhcmdGdW5jLCBjb250ZW50RnVuYywgZWxzZUZ1bmMpIHtcbiAgdmFyIGVhY2hWaWV3ID0gQmxhemUuVmlldygnZWFjaCcsIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3Vidmlld3MgPSB0aGlzLmluaXRpYWxTdWJ2aWV3cztcbiAgICB0aGlzLmluaXRpYWxTdWJ2aWV3cyA9IG51bGw7XG4gICAgaWYgKHRoaXMuX2lzQ3JlYXRlZEZvckV4cGFuc2lvbikge1xuICAgICAgdGhpcy5leHBhbmRlZFZhbHVlRGVwID0gbmV3IFRyYWNrZXIuRGVwZW5kZW5jeTtcbiAgICAgIHRoaXMuZXhwYW5kZWRWYWx1ZURlcC5kZXBlbmQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHN1YnZpZXdzO1xuICB9KTtcbiAgZWFjaFZpZXcuaW5pdGlhbFN1YnZpZXdzID0gW107XG4gIGVhY2hWaWV3Lm51bUl0ZW1zID0gMDtcbiAgZWFjaFZpZXcuaW5FbHNlTW9kZSA9IGZhbHNlO1xuICBlYWNoVmlldy5zdG9wSGFuZGxlID0gbnVsbDtcbiAgZWFjaFZpZXcuY29udGVudEZ1bmMgPSBjb250ZW50RnVuYztcbiAgZWFjaFZpZXcuZWxzZUZ1bmMgPSBlbHNlRnVuYztcbiAgZWFjaFZpZXcuYXJnVmFyID0gbmV3IFJlYWN0aXZlVmFyO1xuICBlYWNoVmlldy52YXJpYWJsZU5hbWUgPSBudWxsO1xuXG4gIC8vIHVwZGF0ZSB0aGUgQGluZGV4IHZhbHVlIGluIHRoZSBzY29wZSBvZiBhbGwgc3Vidmlld3MgaW4gdGhlIHJhbmdlXG4gIHZhciB1cGRhdGVJbmRpY2VzID0gZnVuY3Rpb24gKGZyb20sIHRvKSB7XG4gICAgaWYgKHRvID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRvID0gZWFjaFZpZXcubnVtSXRlbXMgLSAxO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSBmcm9tOyBpIDw9IHRvOyBpKyspIHtcbiAgICAgIHZhciB2aWV3ID0gZWFjaFZpZXcuX2RvbXJhbmdlLm1lbWJlcnNbaV0udmlldztcbiAgICAgIHZpZXcuX3Njb3BlQmluZGluZ3NbJ0BpbmRleCddLnNldCh7IHZhbHVlOiBpIH0pO1xuICAgIH1cbiAgfTtcblxuICBlYWNoVmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICAvLyBXZSBldmFsdWF0ZSBhcmdGdW5jIGluIGFuIGF1dG9ydW4gdG8gbWFrZSBzdXJlXG4gICAgLy8gQmxhemUuY3VycmVudFZpZXcgaXMgYWx3YXlzIHNldCB3aGVuIGl0IHJ1bnMgKHJhdGhlciB0aGFuXG4gICAgLy8gcGFzc2luZyBhcmdGdW5jIHN0cmFpZ2h0IHRvIE9ic2VydmVTZXF1ZW5jZSkuXG4gICAgZWFjaFZpZXcuYXV0b3J1bihmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBhcmdGdW5jIGNhbiByZXR1cm4gZWl0aGVyIGEgc2VxdWVuY2UgYXMgaXMgb3IgYSB3cmFwcGVyIG9iamVjdCB3aXRoIGFcbiAgICAgIC8vIF9zZXF1ZW5jZSBhbmQgX3ZhcmlhYmxlIGZpZWxkcyBzZXQuXG4gICAgICB2YXIgYXJnID0gYXJnRnVuYygpO1xuICAgICAgaWYgKGlzT2JqZWN0KGFyZykgJiYgaGFzKGFyZywgJ19zZXF1ZW5jZScpKSB7XG4gICAgICAgIGVhY2hWaWV3LnZhcmlhYmxlTmFtZSA9IGFyZy5fdmFyaWFibGUgfHwgbnVsbDtcbiAgICAgICAgYXJnID0gYXJnLl9zZXF1ZW5jZTtcbiAgICAgIH1cblxuICAgICAgZWFjaFZpZXcuYXJnVmFyLnNldChhcmcpO1xuICAgIH0sIGVhY2hWaWV3LnBhcmVudFZpZXcsICdjb2xsZWN0aW9uJyk7XG5cbiAgICBlYWNoVmlldy5zdG9wSGFuZGxlID0gT2JzZXJ2ZVNlcXVlbmNlLm9ic2VydmUoZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGVhY2hWaWV3LmFyZ1Zhci5nZXQoKTtcbiAgICB9LCB7XG4gICAgICBhZGRlZEF0OiBmdW5jdGlvbiAoaWQsIGl0ZW0sIGluZGV4KSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBuZXdJdGVtVmlldztcbiAgICAgICAgICBpZiAoZWFjaFZpZXcudmFyaWFibGVOYW1lKSB7XG4gICAgICAgICAgICAvLyBuZXctc3R5bGUgI2VhY2ggKGFzIGluIHt7I2VhY2ggaXRlbSBpbiBpdGVtc319KVxuICAgICAgICAgICAgLy8gZG9lc24ndCBjcmVhdGUgYSBuZXcgZGF0YSBjb250ZXh0XG4gICAgICAgICAgICBuZXdJdGVtVmlldyA9IEJsYXplLlZpZXcoJ2l0ZW0nLCBlYWNoVmlldy5jb250ZW50RnVuYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG5ld0l0ZW1WaWV3ID0gQmxhemUuV2l0aChpdGVtLCBlYWNoVmlldy5jb250ZW50RnVuYyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZWFjaFZpZXcubnVtSXRlbXMrKztcblxuICAgICAgICAgIHZhciBiaW5kaW5ncyA9IHt9O1xuICAgICAgICAgIGJpbmRpbmdzWydAaW5kZXgnXSA9IGluZGV4O1xuICAgICAgICAgIGlmIChlYWNoVmlldy52YXJpYWJsZU5hbWUpIHtcbiAgICAgICAgICAgIGJpbmRpbmdzW2VhY2hWaWV3LnZhcmlhYmxlTmFtZV0gPSBpdGVtO1xuICAgICAgICAgIH1cbiAgICAgICAgICBCbGF6ZS5fYXR0YWNoQmluZGluZ3NUb1ZpZXcoYmluZGluZ3MsIG5ld0l0ZW1WaWV3KTtcblxuICAgICAgICAgIGlmIChlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwLmNoYW5nZWQoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGVhY2hWaWV3Ll9kb21yYW5nZSkge1xuICAgICAgICAgICAgaWYgKGVhY2hWaWV3LmluRWxzZU1vZGUpIHtcbiAgICAgICAgICAgICAgZWFjaFZpZXcuX2RvbXJhbmdlLnJlbW92ZU1lbWJlcigwKTtcbiAgICAgICAgICAgICAgZWFjaFZpZXcuaW5FbHNlTW9kZSA9IGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgcmFuZ2UgPSBCbGF6ZS5fbWF0ZXJpYWxpemVWaWV3KG5ld0l0ZW1WaWV3LCBlYWNoVmlldyk7XG4gICAgICAgICAgICBlYWNoVmlldy5fZG9tcmFuZ2UuYWRkTWVtYmVyKHJhbmdlLCBpbmRleCk7XG4gICAgICAgICAgICB1cGRhdGVJbmRpY2VzKGluZGV4KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZWFjaFZpZXcuaW5pdGlhbFN1YnZpZXdzLnNwbGljZShpbmRleCwgMCwgbmV3SXRlbVZpZXcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgcmVtb3ZlZEF0OiBmdW5jdGlvbiAoaWQsIGl0ZW0sIGluZGV4KSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGVhY2hWaWV3Lm51bUl0ZW1zLS07XG4gICAgICAgICAgaWYgKGVhY2hWaWV3LmV4cGFuZGVkVmFsdWVEZXApIHtcbiAgICAgICAgICAgIGVhY2hWaWV3LmV4cGFuZGVkVmFsdWVEZXAuY2hhbmdlZCgpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZWFjaFZpZXcuX2RvbXJhbmdlKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5fZG9tcmFuZ2UucmVtb3ZlTWVtYmVyKGluZGV4KTtcbiAgICAgICAgICAgIHVwZGF0ZUluZGljZXMoaW5kZXgpO1xuICAgICAgICAgICAgaWYgKGVhY2hWaWV3LmVsc2VGdW5jICYmIGVhY2hWaWV3Lm51bUl0ZW1zID09PSAwKSB7XG4gICAgICAgICAgICAgIGVhY2hWaWV3LmluRWxzZU1vZGUgPSB0cnVlO1xuICAgICAgICAgICAgICBlYWNoVmlldy5fZG9tcmFuZ2UuYWRkTWVtYmVyKFxuICAgICAgICAgICAgICAgIEJsYXplLl9tYXRlcmlhbGl6ZVZpZXcoXG4gICAgICAgICAgICAgICAgICBCbGF6ZS5WaWV3KCdlYWNoX2Vsc2UnLGVhY2hWaWV3LmVsc2VGdW5jKSxcbiAgICAgICAgICAgICAgICAgIGVhY2hWaWV3KSwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVhY2hWaWV3LmluaXRpYWxTdWJ2aWV3cy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICAgY2hhbmdlZEF0OiBmdW5jdGlvbiAoaWQsIG5ld0l0ZW0sIG9sZEl0ZW0sIGluZGV4KSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmIChlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwLmNoYW5nZWQoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGl0ZW1WaWV3O1xuICAgICAgICAgICAgaWYgKGVhY2hWaWV3Ll9kb21yYW5nZSkge1xuICAgICAgICAgICAgICBpdGVtVmlldyA9IGVhY2hWaWV3Ll9kb21yYW5nZS5nZXRNZW1iZXIoaW5kZXgpLnZpZXc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpdGVtVmlldyA9IGVhY2hWaWV3LmluaXRpYWxTdWJ2aWV3c1tpbmRleF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoZWFjaFZpZXcudmFyaWFibGVOYW1lKSB7XG4gICAgICAgICAgICAgIGl0ZW1WaWV3Ll9zY29wZUJpbmRpbmdzW2VhY2hWaWV3LnZhcmlhYmxlTmFtZV0uc2V0KHsgdmFsdWU6IG5ld0l0ZW0gfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpdGVtVmlldy5kYXRhVmFyLnNldChuZXdJdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICAgIG1vdmVkVG86IGZ1bmN0aW9uIChpZCwgaXRlbSwgZnJvbUluZGV4LCB0b0luZGV4KSB7XG4gICAgICAgIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGlmIChlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwKSB7XG4gICAgICAgICAgICBlYWNoVmlldy5leHBhbmRlZFZhbHVlRGVwLmNoYW5nZWQoKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGVhY2hWaWV3Ll9kb21yYW5nZSkge1xuICAgICAgICAgICAgZWFjaFZpZXcuX2RvbXJhbmdlLm1vdmVNZW1iZXIoZnJvbUluZGV4LCB0b0luZGV4KTtcbiAgICAgICAgICAgIHVwZGF0ZUluZGljZXMoXG4gICAgICAgICAgICAgIE1hdGgubWluKGZyb21JbmRleCwgdG9JbmRleCksIE1hdGgubWF4KGZyb21JbmRleCwgdG9JbmRleCkpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgc3Vidmlld3MgPSBlYWNoVmlldy5pbml0aWFsU3Vidmlld3M7XG4gICAgICAgICAgICB2YXIgaXRlbVZpZXcgPSBzdWJ2aWV3c1tmcm9tSW5kZXhdO1xuICAgICAgICAgICAgc3Vidmlld3Muc3BsaWNlKGZyb21JbmRleCwgMSk7XG4gICAgICAgICAgICBzdWJ2aWV3cy5zcGxpY2UodG9JbmRleCwgMCwgaXRlbVZpZXcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoZWFjaFZpZXcuZWxzZUZ1bmMgJiYgZWFjaFZpZXcubnVtSXRlbXMgPT09IDApIHtcbiAgICAgIGVhY2hWaWV3LmluRWxzZU1vZGUgPSB0cnVlO1xuICAgICAgZWFjaFZpZXcuaW5pdGlhbFN1YnZpZXdzWzBdID1cbiAgICAgICAgQmxhemUuVmlldygnZWFjaF9lbHNlJywgZWFjaFZpZXcuZWxzZUZ1bmMpO1xuICAgIH1cbiAgfSk7XG5cbiAgZWFjaFZpZXcub25WaWV3RGVzdHJveWVkKGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoZWFjaFZpZXcuc3RvcEhhbmRsZSlcbiAgICAgIGVhY2hWaWV3LnN0b3BIYW5kbGUuc3RvcCgpO1xuICB9KTtcblxuICByZXR1cm4gZWFjaFZpZXc7XG59O1xuXG5CbGF6ZS5fVGVtcGxhdGVXaXRoID0gZnVuY3Rpb24gKGFyZywgY29udGVudEZ1bmMpIHtcbiAgdmFyIHc7XG5cbiAgdmFyIGFyZ0Z1bmMgPSBhcmc7XG4gIGlmICh0eXBlb2YgYXJnICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgYXJnRnVuYyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBhcmc7XG4gICAgfTtcbiAgfVxuXG4gIC8vIFRoaXMgaXMgYSBsaXR0bGUgbWVzc3kuICBXaGVuIHdlIGNvbXBpbGUgYHt7PiBUZW1wbGF0ZS5jb250ZW50QmxvY2t9fWAsIHdlXG4gIC8vIHdyYXAgaXQgaW4gQmxhemUuX0luT3V0ZXJUZW1wbGF0ZVNjb3BlIGluIG9yZGVyIHRvIHNraXAgdGhlIGludGVybWVkaWF0ZVxuICAvLyBwYXJlbnQgVmlld3MgaW4gdGhlIGN1cnJlbnQgdGVtcGxhdGUuICBIb3dldmVyLCB3aGVuIHRoZXJlJ3MgYW4gYXJndW1lbnRcbiAgLy8gKGB7ez4gVGVtcGxhdGUuY29udGVudEJsb2NrIGFyZ319YCksIHRoZSBhcmd1bWVudCBuZWVkcyB0byBiZSBldmFsdWF0ZWRcbiAgLy8gaW4gdGhlIG9yaWdpbmFsIHNjb3BlLiAgVGhlcmUncyBubyBnb29kIG9yZGVyIHRvIG5lc3RcbiAgLy8gQmxhemUuX0luT3V0ZXJUZW1wbGF0ZVNjb3BlIGFuZCBCbGF6ZS5fVGVtcGxhdGVXaXRoIHRvIGFjaGlldmUgdGhpcyxcbiAgLy8gc28gd2Ugd3JhcCBhcmdGdW5jIHRvIHJ1biBpdCBpbiB0aGUgXCJvcmlnaW5hbCBwYXJlbnRWaWV3XCIgb2YgdGhlXG4gIC8vIEJsYXplLl9Jbk91dGVyVGVtcGxhdGVTY29wZS5cbiAgLy9cbiAgLy8gVG8gbWFrZSB0aGlzIGJldHRlciwgcmVjb25zaWRlciBfSW5PdXRlclRlbXBsYXRlU2NvcGUgYXMgYSBwcmltaXRpdmUuXG4gIC8vIExvbmdlciB0ZXJtLCBldmFsdWF0ZSBleHByZXNzaW9ucyBpbiB0aGUgcHJvcGVyIGxleGljYWwgc2NvcGUuXG4gIHZhciB3cmFwcGVkQXJnRnVuYyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgdmlld1RvRXZhbHVhdGVBcmcgPSBudWxsO1xuICAgIGlmICh3LnBhcmVudFZpZXcgJiYgdy5wYXJlbnRWaWV3Lm5hbWUgPT09ICdJbk91dGVyVGVtcGxhdGVTY29wZScpIHtcbiAgICAgIHZpZXdUb0V2YWx1YXRlQXJnID0gdy5wYXJlbnRWaWV3Lm9yaWdpbmFsUGFyZW50VmlldztcbiAgICB9XG4gICAgaWYgKHZpZXdUb0V2YWx1YXRlQXJnKSB7XG4gICAgICByZXR1cm4gQmxhemUuX3dpdGhDdXJyZW50Vmlldyh2aWV3VG9FdmFsdWF0ZUFyZywgYXJnRnVuYyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBhcmdGdW5jKCk7XG4gICAgfVxuICB9O1xuXG4gIHZhciB3cmFwcGVkQ29udGVudEZ1bmMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNvbnRlbnQgPSBjb250ZW50RnVuYy5jYWxsKHRoaXMpO1xuXG4gICAgLy8gU2luY2Ugd2UgYXJlIGdlbmVyYXRpbmcgdGhlIEJsYXplLl9UZW1wbGF0ZVdpdGggdmlldyBmb3IgdGhlXG4gICAgLy8gdXNlciwgc2V0IHRoZSBmbGFnIG9uIHRoZSBjaGlsZCB2aWV3LiAgSWYgYGNvbnRlbnRgIGlzIGEgdGVtcGxhdGUsXG4gICAgLy8gY29uc3RydWN0IHRoZSBWaWV3IHNvIHRoYXQgd2UgY2FuIHNldCB0aGUgZmxhZy5cbiAgICBpZiAoY29udGVudCBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKSB7XG4gICAgICBjb250ZW50ID0gY29udGVudC5jb25zdHJ1Y3RWaWV3KCk7XG4gICAgfVxuICAgIGlmIChjb250ZW50IGluc3RhbmNlb2YgQmxhemUuVmlldykge1xuICAgICAgY29udGVudC5faGFzR2VuZXJhdGVkUGFyZW50ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29udGVudDtcbiAgfTtcblxuICB3ID0gQmxhemUuV2l0aCh3cmFwcGVkQXJnRnVuYywgd3JhcHBlZENvbnRlbnRGdW5jKTtcbiAgdy5fX2lzVGVtcGxhdGVXaXRoID0gdHJ1ZTtcbiAgcmV0dXJuIHc7XG59O1xuXG5CbGF6ZS5fSW5PdXRlclRlbXBsYXRlU2NvcGUgPSBmdW5jdGlvbiAodGVtcGxhdGVWaWV3LCBjb250ZW50RnVuYykge1xuICB2YXIgdmlldyA9IEJsYXplLlZpZXcoJ0luT3V0ZXJUZW1wbGF0ZVNjb3BlJywgY29udGVudEZ1bmMpO1xuICB2YXIgcGFyZW50VmlldyA9IHRlbXBsYXRlVmlldy5wYXJlbnRWaWV3O1xuXG4gIC8vIEhhY2sgc28gdGhhdCBpZiB5b3UgY2FsbCBge3s+IGZvbyBiYXJ9fWAgYW5kIGl0IGV4cGFuZHMgaW50b1xuICAvLyBge3sjd2l0aCBiYXJ9fXt7PiBmb299fXt7L3dpdGh9fWAsIGFuZCB0aGVuIGBmb29gIGlzIGEgdGVtcGxhdGVcbiAgLy8gdGhhdCBpbnNlcnRzIGB7ez4gVGVtcGxhdGUuY29udGVudEJsb2NrfX1gLCB0aGUgZGF0YSBjb250ZXh0IGZvclxuICAvLyBgVGVtcGxhdGUuY29udGVudEJsb2NrYCBpcyBub3QgYGJhcmAgYnV0IHRoZSBvbmUgZW5jbG9zaW5nIHRoYXQuXG4gIGlmIChwYXJlbnRWaWV3Ll9faXNUZW1wbGF0ZVdpdGgpXG4gICAgcGFyZW50VmlldyA9IHBhcmVudFZpZXcucGFyZW50VmlldztcblxuICB2aWV3Lm9uVmlld0NyZWF0ZWQoZnVuY3Rpb24gKCkge1xuICAgIHRoaXMub3JpZ2luYWxQYXJlbnRWaWV3ID0gdGhpcy5wYXJlbnRWaWV3O1xuICAgIHRoaXMucGFyZW50VmlldyA9IHBhcmVudFZpZXc7XG4gICAgdGhpcy5fX2NoaWxkRG9lc250U3RhcnROZXdMZXhpY2FsU2NvcGUgPSB0cnVlO1xuICB9KTtcbiAgcmV0dXJuIHZpZXc7XG59O1xuXG4iLCJpbXBvcnQgaGFzIGZyb20gJ2xvZGFzaC5oYXMnO1xuXG4vKiogQHBhcmFtIHsoYmluZGluZzogQmluZGluZykgPT4gYm9vbGVhbn0gZm4gKi9cbmZ1bmN0aW9uIF9jcmVhdGVCaW5kaW5nc0hlbHBlcihmbikge1xuICAvKiogQHBhcmFtIHtzdHJpbmdbXX0gbmFtZXMgKi9cbiAgcmV0dXJuICguLi5uYW1lcykgPT4ge1xuICAgIGNvbnN0IHZpZXcgPSBCbGF6ZS5jdXJyZW50VmlldztcblxuICAgIC8vIFRoZXJlJ3MgZWl0aGVyIHplcm8gYXJndW1lbnRzIChpLmUuLCBjaGVjayBhbGwgYmluZGluZ3MpIG9yIGFuIGFkZGl0aW9uYWxcbiAgICAvLyBcImhhc2hcIiBhcmd1bWVudCB0aGF0IHdlIGhhdmUgdG8gaWdub3JlLlxuICAgIG5hbWVzID0gbmFtZXMubGVuZ3RoID09PSAwXG4gICAgICAvLyBUT0RPOiBTaG91bGQgd2Ugd2FsayB1cCB0aGUgYmluZGluZ3MgaGVyZT9cbiAgICAgID8gT2JqZWN0LmtleXModmlldy5fc2NvcGVCaW5kaW5ncylcbiAgICAgIDogbmFtZXMuc2xpY2UoMCwgLTEpO1xuXG4gICAgcmV0dXJuIG5hbWVzLnNvbWUobmFtZSA9PiB7XG4gICAgICBjb25zdCBiaW5kaW5nID0gX2xleGljYWxCaW5kaW5nTG9va3VwKHZpZXcsIG5hbWUpO1xuICAgICAgaWYgKCFiaW5kaW5nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQmluZGluZyBmb3IgXCIke25hbWV9XCIgd2FzIG5vdCBmb3VuZC5gKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGZuKGJpbmRpbmcuZ2V0KCkpO1xuICAgIH0pO1xuICB9O1xufVxuXG5CbGF6ZS5fZ2xvYmFsSGVscGVycyA9IHtcbiAgLyoqIEBzdW1tYXJ5IENoZWNrIHdoZXRoZXIgYW55IG9mIHRoZSBnaXZlbiBiaW5kaW5ncyAob3IgYWxsIGlmIG5vbmUgZ2l2ZW4pIGlzIHN0aWxsIHBlbmRpbmcuICovXG4gICdAcGVuZGluZyc6IF9jcmVhdGVCaW5kaW5nc0hlbHBlcihiaW5kaW5nID0+IGJpbmRpbmcgPT09IHVuZGVmaW5lZCksXG4gIC8qKiBAc3VtbWFyeSBDaGVjayB3aGV0aGVyIGFueSBvZiB0aGUgZ2l2ZW4gYmluZGluZ3MgKG9yIGFsbCBpZiBub25lIGdpdmVuKSBoYXMgcmVqZWN0ZWQuICovXG4gICdAcmVqZWN0ZWQnOiBfY3JlYXRlQmluZGluZ3NIZWxwZXIoYmluZGluZyA9PiAhIWJpbmRpbmcgJiYgJ2Vycm9yJyBpbiBiaW5kaW5nKSxcbiAgLyoqIEBzdW1tYXJ5IENoZWNrIHdoZXRoZXIgYW55IG9mIHRoZSBnaXZlbiBiaW5kaW5ncyAob3IgYWxsIGlmIG5vbmUgZ2l2ZW4pIGhhcyByZXNvbHZlZC4gKi9cbiAgJ0ByZXNvbHZlZCc6IF9jcmVhdGVCaW5kaW5nc0hlbHBlcihiaW5kaW5nID0+ICEhYmluZGluZyAmJiAndmFsdWUnIGluIGJpbmRpbmcpLFxufTtcblxuLy8gRG9jdW1lbnRlZCBhcyBUZW1wbGF0ZS5yZWdpc3RlckhlbHBlci5cbi8vIFRoaXMgZGVmaW5pdGlvbiBhbHNvIHByb3ZpZGVzIGJhY2stY29tcGF0IGZvciBgVUkucmVnaXN0ZXJIZWxwZXJgLlxuQmxhemUucmVnaXN0ZXJIZWxwZXIgPSBmdW5jdGlvbiAobmFtZSwgZnVuYykge1xuICBCbGF6ZS5fZ2xvYmFsSGVscGVyc1tuYW1lXSA9IGZ1bmM7XG59O1xuXG4vLyBBbHNvIGRvY3VtZW50ZWQgYXMgVGVtcGxhdGUuZGVyZWdpc3RlckhlbHBlclxuQmxhemUuZGVyZWdpc3RlckhlbHBlciA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgZGVsZXRlIEJsYXplLl9nbG9iYWxIZWxwZXJzW25hbWVdO1xufTtcblxudmFyIGJpbmRJZklzRnVuY3Rpb24gPSBmdW5jdGlvbiAoeCwgdGFyZ2V0KSB7XG4gIGlmICh0eXBlb2YgeCAhPT0gJ2Z1bmN0aW9uJylcbiAgICByZXR1cm4geDtcbiAgcmV0dXJuIEJsYXplLl9iaW5kKHgsIHRhcmdldCk7XG59O1xuXG4vLyBJZiBgeGAgaXMgYSBmdW5jdGlvbiwgYmluZHMgdGhlIHZhbHVlIG9mIGB0aGlzYCBmb3IgdGhhdCBmdW5jdGlvblxuLy8gdG8gdGhlIGN1cnJlbnQgZGF0YSBjb250ZXh0LlxudmFyIGJpbmREYXRhQ29udGV4dCA9IGZ1bmN0aW9uICh4KSB7XG4gIGlmICh0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgZGF0YSA9IEJsYXplLmdldERhdGEoKTtcbiAgICAgIGlmIChkYXRhID09IG51bGwpXG4gICAgICAgIGRhdGEgPSB7fTtcbiAgICAgIHJldHVybiB4LmFwcGx5KGRhdGEsIGFyZ3VtZW50cyk7XG4gICAgfTtcbiAgfVxuICByZXR1cm4geDtcbn07XG5cbkJsYXplLl9PTERTVFlMRV9IRUxQRVIgPSB7fTtcblxuQmxhemUuX2dldFRlbXBsYXRlSGVscGVyID0gZnVuY3Rpb24gKHRlbXBsYXRlLCBuYW1lLCB0bXBsSW5zdGFuY2VGdW5jKSB7XG4gIC8vIFhYWCBDT01QQVQgV0lUSCAwLjkuM1xuICB2YXIgaXNLbm93bk9sZFN0eWxlSGVscGVyID0gZmFsc2U7XG5cbiAgaWYgKHRlbXBsYXRlLl9faGVscGVycy5oYXMobmFtZSkpIHtcbiAgICB2YXIgaGVscGVyID0gdGVtcGxhdGUuX19oZWxwZXJzLmdldChuYW1lKTtcbiAgICBpZiAoaGVscGVyID09PSBCbGF6ZS5fT0xEU1RZTEVfSEVMUEVSKSB7XG4gICAgICBpc0tub3duT2xkU3R5bGVIZWxwZXIgPSB0cnVlO1xuICAgIH0gZWxzZSBpZiAoaGVscGVyICE9IG51bGwpIHtcbiAgICAgIHJldHVybiB3cmFwSGVscGVyKGJpbmREYXRhQ29udGV4dChoZWxwZXIpLCB0bXBsSW5zdGFuY2VGdW5jKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLy8gb2xkLXN0eWxlIGhlbHBlclxuICBpZiAobmFtZSBpbiB0ZW1wbGF0ZSkge1xuICAgIC8vIE9ubHkgd2FybiBvbmNlIHBlciBoZWxwZXJcbiAgICBpZiAoISBpc0tub3duT2xkU3R5bGVIZWxwZXIpIHtcbiAgICAgIHRlbXBsYXRlLl9faGVscGVycy5zZXQobmFtZSwgQmxhemUuX09MRFNUWUxFX0hFTFBFUik7XG4gICAgICBpZiAoISB0ZW1wbGF0ZS5fTk9XQVJOX09MRFNUWUxFX0hFTFBFUlMpIHtcbiAgICAgICAgQmxhemUuX3dhcm4oJ0Fzc2lnbmluZyBoZWxwZXIgd2l0aCBgJyArIHRlbXBsYXRlLnZpZXdOYW1lICsgJy4nICtcbiAgICAgICAgICAgICAgICAgICAgbmFtZSArICcgPSAuLi5gIGlzIGRlcHJlY2F0ZWQuICBVc2UgYCcgKyB0ZW1wbGF0ZS52aWV3TmFtZSArXG4gICAgICAgICAgICAgICAgICAgICcuaGVscGVycyguLi4pYCBpbnN0ZWFkLicpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGVtcGxhdGVbbmFtZV0gIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHdyYXBIZWxwZXIoYmluZERhdGFDb250ZXh0KHRlbXBsYXRlW25hbWVdKSwgdG1wbEluc3RhbmNlRnVuYyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59O1xuXG52YXIgd3JhcEhlbHBlciA9IGZ1bmN0aW9uIChmLCB0ZW1wbGF0ZUZ1bmMpIHtcbiAgaWYgKHR5cGVvZiBmICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICByZXR1cm4gZjtcbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuXG4gICAgcmV0dXJuIEJsYXplLlRlbXBsYXRlLl93aXRoVGVtcGxhdGVJbnN0YW5jZUZ1bmModGVtcGxhdGVGdW5jLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gQmxhemUuX3dyYXBDYXRjaGluZ0V4Y2VwdGlvbnMoZiwgJ3RlbXBsYXRlIGhlbHBlcicpLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIH0pO1xuICB9O1xufTtcblxuZnVuY3Rpb24gX2xleGljYWxLZWVwR29pbmcoY3VycmVudFZpZXcpIHtcbiAgaWYgKCFjdXJyZW50Vmlldy5wYXJlbnRWaWV3KSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuICBpZiAoIWN1cnJlbnRWaWV3Ll9fc3RhcnRzTmV3TGV4aWNhbFNjb3BlKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRWaWV3LnBhcmVudFZpZXc7XG4gIH1cbiAgaWYgKGN1cnJlbnRWaWV3LnBhcmVudFZpZXcuX19jaGlsZERvZXNudFN0YXJ0TmV3TGV4aWNhbFNjb3BlKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRWaWV3LnBhcmVudFZpZXc7XG4gIH1cbiAgXG4gIC8vIGluIHRoZSBjYXNlIG9mIHt7PiBUZW1wbGF0ZS5jb250ZW50QmxvY2sgZGF0YX19IHRoZSBjb250ZW50QmxvY2sgbG9zZXMgdGhlIGxleGljYWwgc2NvcGUgb2YgaXQncyBwYXJlbnQsIHdoZXJhcyB7ez4gVGVtcGxhdGUuY29udGVudEJsb2NrfX0gaXQgZG9lcyBub3RcbiAgLy8gdGhpcyBpcyBiZWNhdXNlIGEgI3dpdGggc2l0cyBiZXR3ZWVuIHRoZSBpbmNsdWRlIEluT3V0ZXJUZW1wbGF0ZVNjb3BlXG4gIGlmIChjdXJyZW50Vmlldy5wYXJlbnRWaWV3Lm5hbWUgPT09IFwid2l0aFwiICYmIGN1cnJlbnRWaWV3LnBhcmVudFZpZXcucGFyZW50VmlldyAmJiBjdXJyZW50Vmlldy5wYXJlbnRWaWV3LnBhcmVudFZpZXcuX19jaGlsZERvZXNudFN0YXJ0TmV3TGV4aWNhbFNjb3BlKSB7XG4gICAgcmV0dXJuIGN1cnJlbnRWaWV3LnBhcmVudFZpZXc7XG4gIH1cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gX2xleGljYWxCaW5kaW5nTG9va3VwKHZpZXcsIG5hbWUpIHtcbiAgdmFyIGN1cnJlbnRWaWV3ID0gdmlldztcblxuICAvLyB3YWxrIHVwIHRoZSB2aWV3cyBzdG9wcGluZyBhdCBhIFNwYWNlYmFycy5pbmNsdWRlIG9yIFRlbXBsYXRlIHZpZXcgdGhhdFxuICAvLyBkb2Vzbid0IGhhdmUgYW4gSW5PdXRlclRlbXBsYXRlU2NvcGUgdmlldyBhcyBhIHBhcmVudFxuICBkbyB7XG4gICAgLy8gc2tpcCBibG9jayBoZWxwZXJzIHZpZXdzXG4gICAgLy8gaWYgd2UgZm91bmQgdGhlIGJpbmRpbmcgb24gdGhlIHNjb3BlLCByZXR1cm4gaXRcbiAgICBpZiAoaGFzKGN1cnJlbnRWaWV3Ll9zY29wZUJpbmRpbmdzLCBuYW1lKSkge1xuICAgICAgcmV0dXJuIGN1cnJlbnRWaWV3Ll9zY29wZUJpbmRpbmdzW25hbWVdO1xuICAgIH1cbiAgfSB3aGlsZSAoY3VycmVudFZpZXcgPSBfbGV4aWNhbEtlZXBHb2luZyhjdXJyZW50VmlldykpO1xuXG4gIHJldHVybiBudWxsO1xufVxuXG5CbGF6ZS5fbGV4aWNhbEJpbmRpbmdMb29rdXAgPSBmdW5jdGlvbiAodmlldywgbmFtZSkge1xuICBjb25zdCBiaW5kaW5nID0gX2xleGljYWxCaW5kaW5nTG9va3VwKHZpZXcsIG5hbWUpO1xuICByZXR1cm4gYmluZGluZyAmJiAoKCkgPT4gYmluZGluZy5nZXQoKT8udmFsdWUpO1xufTtcblxuLy8gdGVtcGxhdGVJbnN0YW5jZSBhcmd1bWVudCBpcyBwcm92aWRlZCB0byBiZSBhdmFpbGFibGUgZm9yIHBvc3NpYmxlXG4vLyBhbHRlcm5hdGl2ZSBpbXBsZW1lbnRhdGlvbnMgb2YgdGhpcyBmdW5jdGlvbiBieSAzcmQgcGFydHkgcGFja2FnZXMuXG5CbGF6ZS5fZ2V0VGVtcGxhdGUgPSBmdW5jdGlvbiAobmFtZSwgdGVtcGxhdGVJbnN0YW5jZSkge1xuICBpZiAoKG5hbWUgaW4gQmxhemUuVGVtcGxhdGUpICYmIChCbGF6ZS5UZW1wbGF0ZVtuYW1lXSBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKSkge1xuICAgIHJldHVybiBCbGF6ZS5UZW1wbGF0ZVtuYW1lXTtcbiAgfVxuICByZXR1cm4gbnVsbDtcbn07XG5cbkJsYXplLl9nZXRHbG9iYWxIZWxwZXIgPSBmdW5jdGlvbiAobmFtZSwgdGVtcGxhdGVJbnN0YW5jZSkge1xuICBpZiAoQmxhemUuX2dsb2JhbEhlbHBlcnNbbmFtZV0gIT0gbnVsbCkge1xuICAgIHJldHVybiB3cmFwSGVscGVyKGJpbmREYXRhQ29udGV4dChCbGF6ZS5fZ2xvYmFsSGVscGVyc1tuYW1lXSksIHRlbXBsYXRlSW5zdGFuY2UpO1xuICB9XG4gIHJldHVybiBudWxsO1xufTtcblxuLy8gTG9va3MgdXAgYSBuYW1lLCBsaWtlIFwiZm9vXCIgb3IgXCIuLlwiLCBhcyBhIGhlbHBlciBvZiB0aGVcbi8vIGN1cnJlbnQgdGVtcGxhdGU7IHRoZSBuYW1lIG9mIGEgdGVtcGxhdGU7IGEgZ2xvYmFsIGhlbHBlcjtcbi8vIG9yIGEgcHJvcGVydHkgb2YgdGhlIGRhdGEgY29udGV4dC4gIENhbGxlZCBvbiB0aGUgVmlldyBvZlxuLy8gYSB0ZW1wbGF0ZSAoaS5lLiBhIFZpZXcgd2l0aCBhIGAudGVtcGxhdGVgIHByb3BlcnR5LFxuLy8gd2hlcmUgdGhlIGhlbHBlcnMgYXJlKS4gIFVzZWQgZm9yIHRoZSBmaXJzdCBuYW1lIGluIGFcbi8vIFwicGF0aFwiIGluIGEgdGVtcGxhdGUgdGFnLCBsaWtlIFwiZm9vXCIgaW4gYHt7Zm9vLmJhcn19YCBvclxuLy8gXCIuLlwiIGluIGB7e2Zyb2J1bGF0ZSAuLi9ibGFofX1gLlxuLy9cbi8vIFJldHVybnMgYSBmdW5jdGlvbiwgYSBub24tZnVuY3Rpb24gdmFsdWUsIG9yIG51bGwuICBJZlxuLy8gYSBmdW5jdGlvbiBpcyBmb3VuZCwgaXQgaXMgYm91bmQgYXBwcm9wcmlhdGVseS5cbi8vXG4vLyBOT1RFOiBUaGlzIGZ1bmN0aW9uIG11c3Qgbm90IGVzdGFibGlzaCBhbnkgcmVhY3RpdmVcbi8vIGRlcGVuZGVuY2llcyBpdHNlbGYuICBJZiB0aGVyZSBpcyBhbnkgcmVhY3Rpdml0eSBpbiB0aGVcbi8vIHZhbHVlLCBsb29rdXAgc2hvdWxkIHJldHVybiBhIGZ1bmN0aW9uLlxuQmxhemUuVmlldy5wcm90b3R5cGUubG9va3VwID0gZnVuY3Rpb24gKG5hbWUsIF9vcHRpb25zKSB7XG4gIHZhciB0ZW1wbGF0ZSA9IHRoaXMudGVtcGxhdGU7XG4gIHZhciBsb29rdXBUZW1wbGF0ZSA9IF9vcHRpb25zICYmIF9vcHRpb25zLnRlbXBsYXRlO1xuICB2YXIgaGVscGVyO1xuICB2YXIgYmluZGluZztcbiAgdmFyIGJvdW5kVG1wbEluc3RhbmNlO1xuICB2YXIgZm91bmRUZW1wbGF0ZTtcblxuICBpZiAodGhpcy50ZW1wbGF0ZUluc3RhbmNlKSB7XG4gICAgYm91bmRUbXBsSW5zdGFuY2UgPSBCbGF6ZS5fYmluZCh0aGlzLnRlbXBsYXRlSW5zdGFuY2UsIHRoaXMpO1xuICB9XG5cbiAgLy8gMC4gbG9va2luZyB1cCB0aGUgcGFyZW50IGRhdGEgY29udGV4dCB3aXRoIHRoZSBzcGVjaWFsIFwiLi4vXCIgc3ludGF4XG4gIGlmICgvXlxcLi8udGVzdChuYW1lKSkge1xuICAgIC8vIHN0YXJ0cyB3aXRoIGEgZG90LiBtdXN0IGJlIGEgc2VyaWVzIG9mIGRvdHMgd2hpY2ggbWFwcyB0byBhblxuICAgIC8vIGFuY2VzdG9yIG9mIHRoZSBhcHByb3ByaWF0ZSBoZWlnaHQuXG4gICAgaWYgKCEvXihcXC4pKyQvLnRlc3QobmFtZSkpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJpZCBzdGFydGluZyB3aXRoIGRvdCBtdXN0IGJlIGEgc2VyaWVzIG9mIGRvdHNcIik7XG5cbiAgICByZXR1cm4gQmxhemUuX3BhcmVudERhdGEobmFtZS5sZW5ndGggLSAxLCB0cnVlIC8qX2Z1bmN0aW9uV3JhcHBlZCovKTtcblxuICB9XG5cbiAgLy8gMS4gbG9vayB1cCBhIGhlbHBlciBvbiB0aGUgY3VycmVudCB0ZW1wbGF0ZVxuICBpZiAodGVtcGxhdGUgJiYgKChoZWxwZXIgPSBCbGF6ZS5fZ2V0VGVtcGxhdGVIZWxwZXIodGVtcGxhdGUsIG5hbWUsIGJvdW5kVG1wbEluc3RhbmNlKSkgIT0gbnVsbCkpIHtcbiAgICByZXR1cm4gaGVscGVyO1xuICB9XG5cbiAgLy8gMi4gbG9vayB1cCBhIGJpbmRpbmcgYnkgdHJhdmVyc2luZyB0aGUgbGV4aWNhbCB2aWV3IGhpZXJhcmNoeSBpbnNpZGUgdGhlXG4gIC8vIGN1cnJlbnQgdGVtcGxhdGVcbiAgaWYgKHRlbXBsYXRlICYmIChiaW5kaW5nID0gQmxhemUuX2xleGljYWxCaW5kaW5nTG9va3VwKEJsYXplLmN1cnJlbnRWaWV3LCBuYW1lKSkgIT0gbnVsbCkge1xuICAgIHJldHVybiBiaW5kaW5nO1xuICB9XG5cbiAgLy8gMy4gbG9vayB1cCBhIHRlbXBsYXRlIGJ5IG5hbWVcbiAgaWYgKGxvb2t1cFRlbXBsYXRlICYmICgoZm91bmRUZW1wbGF0ZSA9IEJsYXplLl9nZXRUZW1wbGF0ZShuYW1lLCBib3VuZFRtcGxJbnN0YW5jZSkpICE9IG51bGwpKSB7XG4gICAgcmV0dXJuIGZvdW5kVGVtcGxhdGU7XG4gIH1cblxuICAvLyA0LiBsb29rIHVwIGEgZ2xvYmFsIGhlbHBlclxuICBpZiAoKGhlbHBlciA9IEJsYXplLl9nZXRHbG9iYWxIZWxwZXIobmFtZSwgYm91bmRUbXBsSW5zdGFuY2UpKSAhPSBudWxsKSB7XG4gICAgcmV0dXJuIGhlbHBlcjtcbiAgfVxuXG4gIC8vIDUuIGxvb2sgdXAgaW4gYSBkYXRhIGNvbnRleHRcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgaXNDYWxsZWRBc0Z1bmN0aW9uID0gKGFyZ3VtZW50cy5sZW5ndGggPiAwKTtcbiAgICB2YXIgZGF0YSA9IEJsYXplLmdldERhdGEoKTtcbiAgICB2YXIgeCA9IGRhdGEgJiYgZGF0YVtuYW1lXTtcbiAgICBpZiAoISB4KSB7XG4gICAgICBpZiAobG9va3VwVGVtcGxhdGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTm8gc3VjaCB0ZW1wbGF0ZTogXCIgKyBuYW1lKTtcbiAgICAgIH0gZWxzZSBpZiAoaXNDYWxsZWRBc0Z1bmN0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIHN1Y2ggZnVuY3Rpb246IFwiICsgbmFtZSk7XG4gICAgICB9IGVsc2UgaWYgKG5hbWUuY2hhckF0KDApID09PSAnQCcgJiYgKCh4ID09PSBudWxsKSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoeCA9PT0gdW5kZWZpbmVkKSkpIHtcbiAgICAgICAgLy8gVGhyb3cgYW4gZXJyb3IgaWYgdGhlIHVzZXIgdHJpZXMgdG8gdXNlIGEgYEBkaXJlY3RpdmVgXG4gICAgICAgIC8vIHRoYXQgZG9lc24ndCBleGlzdC4gIFdlIGRvbid0IGltcGxlbWVudCBhbGwgZGlyZWN0aXZlc1xuICAgICAgICAvLyBmcm9tIEhhbmRsZWJhcnMsIHNvIHRoZXJlJ3MgYSBwb3RlbnRpYWwgZm9yIGNvbmZ1c2lvblxuICAgICAgICAvLyBpZiB3ZSBmYWlsIHNpbGVudGx5LiAgT24gdGhlIG90aGVyIGhhbmQsIHdlIHdhbnQgdG9cbiAgICAgICAgLy8gdGhyb3cgbGF0ZSBpbiBjYXNlIHNvbWUgYXBwIG9yIHBhY2thZ2Ugd2FudHMgdG8gcHJvdmlkZVxuICAgICAgICAvLyBhIG1pc3NpbmcgZGlyZWN0aXZlLlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCBkaXJlY3RpdmU6IFwiICsgbmFtZSk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICghIGRhdGEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHggIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGlmIChpc0NhbGxlZEFzRnVuY3Rpb24pIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgY2FsbCBub24tZnVuY3Rpb246IFwiICsgeCk7XG4gICAgICB9XG4gICAgICByZXR1cm4geDtcbiAgICB9XG4gICAgcmV0dXJuIHguYXBwbHkoZGF0YSwgYXJndW1lbnRzKTtcbiAgfTtcbn07XG5cbi8vIEltcGxlbWVudCBTcGFjZWJhcnMnIHt7Li4vLi59fS5cbi8vIEBwYXJhbSBoZWlnaHQge051bWJlcn0gVGhlIG51bWJlciBvZiAnLi4nc1xuQmxhemUuX3BhcmVudERhdGEgPSBmdW5jdGlvbiAoaGVpZ2h0LCBfZnVuY3Rpb25XcmFwcGVkKSB7XG4gIC8vIElmIGhlaWdodCBpcyBudWxsIG9yIHVuZGVmaW5lZCwgd2UgZGVmYXVsdCB0byAxLCB0aGUgZmlyc3QgcGFyZW50LlxuICBpZiAoaGVpZ2h0ID09IG51bGwpIHtcbiAgICBoZWlnaHQgPSAxO1xuICB9XG4gIHZhciB0aGVXaXRoID0gQmxhemUuZ2V0Vmlldygnd2l0aCcpO1xuICBmb3IgKHZhciBpID0gMDsgKGkgPCBoZWlnaHQpICYmIHRoZVdpdGg7IGkrKykge1xuICAgIHRoZVdpdGggPSBCbGF6ZS5nZXRWaWV3KHRoZVdpdGgsICd3aXRoJyk7XG4gIH1cblxuICBpZiAoISB0aGVXaXRoKVxuICAgIHJldHVybiBudWxsO1xuICBpZiAoX2Z1bmN0aW9uV3JhcHBlZClcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhlV2l0aC5kYXRhVmFyLmdldCgpOyB9O1xuICByZXR1cm4gdGhlV2l0aC5kYXRhVmFyLmdldCgpO1xufTtcblxuXG5CbGF6ZS5WaWV3LnByb3RvdHlwZS5sb29rdXBUZW1wbGF0ZSA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gIHJldHVybiB0aGlzLmxvb2t1cChuYW1lLCB7dGVtcGxhdGU6dHJ1ZX0pO1xufTtcbiIsImltcG9ydCBpc09iamVjdCBmcm9tICdsb2Rhc2guaXNvYmplY3QnO1xuaW1wb3J0IGlzRnVuY3Rpb24gZnJvbSAnbG9kYXNoLmlzZnVuY3Rpb24nO1xuaW1wb3J0IGhhcyBmcm9tICdsb2Rhc2guaGFzJztcbmltcG9ydCBpc0VtcHR5IGZyb20gJ2xvZGFzaC5pc2VtcHR5JztcblxuLy8gW25ld10gQmxhemUuVGVtcGxhdGUoW3ZpZXdOYW1lXSwgcmVuZGVyRnVuY3Rpb24pXG4vL1xuLy8gYEJsYXplLlRlbXBsYXRlYCBpcyB0aGUgY2xhc3Mgb2YgdGVtcGxhdGVzLCBsaWtlIGBUZW1wbGF0ZS5mb29gIGluXG4vLyBNZXRlb3IsIHdoaWNoIGlzIGBpbnN0YW5jZW9mIFRlbXBsYXRlYC5cbi8vXG4vLyBgdmlld0tpbmRgIGlzIGEgc3RyaW5nIHRoYXQgbG9va3MgbGlrZSBcIlRlbXBsYXRlLmZvb1wiIGZvciB0ZW1wbGF0ZXNcbi8vIGRlZmluZWQgYnkgdGhlIGNvbXBpbGVyLlxuXG4vKipcbiAqIEBjbGFzc1xuICogQHN1bW1hcnkgQ29uc3RydWN0b3IgZm9yIGEgVGVtcGxhdGUsIHdoaWNoIGlzIHVzZWQgdG8gY29uc3RydWN0IFZpZXdzIHdpdGggcGFydGljdWxhciBuYW1lIGFuZCBjb250ZW50LlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IFt2aWV3TmFtZV0gT3B0aW9uYWwuICBBIG5hbWUgZm9yIFZpZXdzIGNvbnN0cnVjdGVkIGJ5IHRoaXMgVGVtcGxhdGUuICBTZWUgW2B2aWV3Lm5hbWVgXSgjdmlld19uYW1lKS5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlbmRlckZ1bmN0aW9uIEEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIFsqcmVuZGVyYWJsZSBjb250ZW50Kl0oI1JlbmRlcmFibGUtQ29udGVudCkuICBUaGlzIGZ1bmN0aW9uIGlzIHVzZWQgYXMgdGhlIGByZW5kZXJGdW5jdGlvbmAgZm9yIFZpZXdzIGNvbnN0cnVjdGVkIGJ5IHRoaXMgVGVtcGxhdGUuXG4gKi9cbkJsYXplLlRlbXBsYXRlID0gZnVuY3Rpb24gKHZpZXdOYW1lLCByZW5kZXJGdW5jdGlvbikge1xuICBpZiAoISAodGhpcyBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgQmxhemUuVGVtcGxhdGUodmlld05hbWUsIHJlbmRlckZ1bmN0aW9uKTtcblxuICBpZiAodHlwZW9mIHZpZXdOYW1lID09PSAnZnVuY3Rpb24nKSB7XG4gICAgLy8gb21pdHRlZCBcInZpZXdOYW1lXCIgYXJndW1lbnRcbiAgICByZW5kZXJGdW5jdGlvbiA9IHZpZXdOYW1lO1xuICAgIHZpZXdOYW1lID0gJyc7XG4gIH1cbiAgaWYgKHR5cGVvZiB2aWV3TmFtZSAhPT0gJ3N0cmluZycpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwidmlld05hbWUgbXVzdCBiZSBhIFN0cmluZyAob3Igb21pdHRlZClcIik7XG4gIGlmICh0eXBlb2YgcmVuZGVyRnVuY3Rpb24gIT09ICdmdW5jdGlvbicpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwicmVuZGVyRnVuY3Rpb24gbXVzdCBiZSBhIGZ1bmN0aW9uXCIpO1xuXG4gIHRoaXMudmlld05hbWUgPSB2aWV3TmFtZTtcbiAgdGhpcy5yZW5kZXJGdW5jdGlvbiA9IHJlbmRlckZ1bmN0aW9uO1xuXG4gIHRoaXMuX19oZWxwZXJzID0gbmV3IEhlbHBlck1hcDtcbiAgdGhpcy5fX2V2ZW50TWFwcyA9IFtdO1xuXG4gIHRoaXMuX2NhbGxiYWNrcyA9IHtcbiAgICBjcmVhdGVkOiBbXSxcbiAgICByZW5kZXJlZDogW10sXG4gICAgZGVzdHJveWVkOiBbXVxuICB9O1xufTtcbnZhciBUZW1wbGF0ZSA9IEJsYXplLlRlbXBsYXRlO1xuXG52YXIgSGVscGVyTWFwID0gZnVuY3Rpb24gKCkge307XG5IZWxwZXJNYXAucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gIHJldHVybiB0aGlzWycgJytuYW1lXTtcbn07XG5IZWxwZXJNYXAucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChuYW1lLCBoZWxwZXIpIHtcbiAgdGhpc1snICcrbmFtZV0gPSBoZWxwZXI7XG59O1xuSGVscGVyTWFwLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbiAobmFtZSkge1xuICByZXR1cm4gKHR5cGVvZiB0aGlzWycgJytuYW1lXSAhPT0gJ3VuZGVmaW5lZCcpO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBSZXR1cm5zIHRydWUgaWYgYHZhbHVlYCBpcyBhIHRlbXBsYXRlIG9iamVjdCBsaWtlIGBUZW1wbGF0ZS5teVRlbXBsYXRlYC5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7QW55fSB2YWx1ZSBUaGUgdmFsdWUgdG8gdGVzdC5cbiAqL1xuQmxhemUuaXNUZW1wbGF0ZSA9IGZ1bmN0aW9uICh0KSB7XG4gIHJldHVybiAodCBpbnN0YW5jZW9mIEJsYXplLlRlbXBsYXRlKTtcbn07XG5cbi8qKlxuICogQG5hbWUgIG9uQ3JlYXRlZFxuICogQGluc3RhbmNlXG4gKiBAbWVtYmVyT2YgVGVtcGxhdGVcbiAqIEBzdW1tYXJ5IFJlZ2lzdGVyIGEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdoZW4gYW4gaW5zdGFuY2Ugb2YgdGhpcyB0ZW1wbGF0ZSBpcyBjcmVhdGVkLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQSBmdW5jdGlvbiB0byBiZSBhZGRlZCBhcyBhIGNhbGxiYWNrLlxuICogQGxvY3VzIENsaWVudFxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucHJvdG90eXBlLm9uQ3JlYXRlZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MuY3JlYXRlZC5wdXNoKGNiKTtcbn07XG5cbi8qKlxuICogQG5hbWUgIG9uUmVuZGVyZWRcbiAqIEBpbnN0YW5jZVxuICogQG1lbWJlck9mIFRlbXBsYXRlXG4gKiBAc3VtbWFyeSBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCB3aGVuIGFuIGluc3RhbmNlIG9mIHRoaXMgdGVtcGxhdGUgaXMgaW5zZXJ0ZWQgaW50byB0aGUgRE9NLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgQSBmdW5jdGlvbiB0byBiZSBhZGRlZCBhcyBhIGNhbGxiYWNrLlxuICogQGxvY3VzIENsaWVudFxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucHJvdG90eXBlLm9uUmVuZGVyZWQgPSBmdW5jdGlvbiAoY2IpIHtcbiAgdGhpcy5fY2FsbGJhY2tzLnJlbmRlcmVkLnB1c2goY2IpO1xufTtcblxuLyoqXG4gKiBAbmFtZSAgb25EZXN0cm95ZWRcbiAqIEBpbnN0YW5jZVxuICogQG1lbWJlck9mIFRlbXBsYXRlXG4gKiBAc3VtbWFyeSBSZWdpc3RlciBhIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCB3aGVuIGFuIGluc3RhbmNlIG9mIHRoaXMgdGVtcGxhdGUgaXMgcmVtb3ZlZCBmcm9tIHRoZSBET00gYW5kIGRlc3Ryb3llZC5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIEEgZnVuY3Rpb24gdG8gYmUgYWRkZWQgYXMgYSBjYWxsYmFjay5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLnByb3RvdHlwZS5vbkRlc3Ryb3llZCA9IGZ1bmN0aW9uIChjYikge1xuICB0aGlzLl9jYWxsYmFja3MuZGVzdHJveWVkLnB1c2goY2IpO1xufTtcblxuVGVtcGxhdGUucHJvdG90eXBlLl9nZXRDYWxsYmFja3MgPSBmdW5jdGlvbiAod2hpY2gpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY2FsbGJhY2tzID0gc2VsZlt3aGljaF0gPyBbc2VsZlt3aGljaF1dIDogW107XG4gIC8vIEZpcmUgYWxsIGNhbGxiYWNrcyBhZGRlZCB3aXRoIHRoZSBuZXcgQVBJIChUZW1wbGF0ZS5vblJlbmRlcmVkKCkpXG4gIC8vIGFzIHdlbGwgYXMgdGhlIG9sZC1zdHlsZSBjYWxsYmFjayAoZS5nLiBUZW1wbGF0ZS5yZW5kZXJlZCkgZm9yXG4gIC8vIGJhY2t3YXJkcy1jb21wYXRpYmlsaXR5LlxuICBjYWxsYmFja3MgPSBjYWxsYmFja3MuY29uY2F0KHNlbGYuX2NhbGxiYWNrc1t3aGljaF0pO1xuICByZXR1cm4gY2FsbGJhY2tzO1xufTtcblxudmFyIGZpcmVDYWxsYmFja3MgPSBmdW5jdGlvbiAoY2FsbGJhY2tzLCB0ZW1wbGF0ZSkge1xuICBUZW1wbGF0ZS5fd2l0aFRlbXBsYXRlSW5zdGFuY2VGdW5jKFxuICAgIGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRlbXBsYXRlOyB9LFxuICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBOID0gY2FsbGJhY2tzLmxlbmd0aDsgaSA8IE47IGkrKykge1xuICAgICAgICBjYWxsYmFja3NbaV0uY2FsbCh0ZW1wbGF0ZSk7XG4gICAgICB9XG4gICAgfSk7XG59O1xuXG5UZW1wbGF0ZS5wcm90b3R5cGUuY29uc3RydWN0VmlldyA9IGZ1bmN0aW9uIChjb250ZW50RnVuYywgZWxzZUZ1bmMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgdmlldyA9IEJsYXplLlZpZXcoc2VsZi52aWV3TmFtZSwgc2VsZi5yZW5kZXJGdW5jdGlvbik7XG4gIHZpZXcudGVtcGxhdGUgPSBzZWxmO1xuXG4gIHZpZXcudGVtcGxhdGVDb250ZW50QmxvY2sgPSAoXG4gICAgY29udGVudEZ1bmMgPyBuZXcgVGVtcGxhdGUoJyhjb250ZW50QmxvY2spJywgY29udGVudEZ1bmMpIDogbnVsbCk7XG4gIHZpZXcudGVtcGxhdGVFbHNlQmxvY2sgPSAoXG4gICAgZWxzZUZ1bmMgPyBuZXcgVGVtcGxhdGUoJyhlbHNlQmxvY2spJywgZWxzZUZ1bmMpIDogbnVsbCk7XG5cbiAgaWYgKHNlbGYuX19ldmVudE1hcHMgfHwgdHlwZW9mIHNlbGYuZXZlbnRzID09PSAnb2JqZWN0Jykge1xuICAgIHZpZXcuX29uVmlld1JlbmRlcmVkKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICh2aWV3LnJlbmRlckNvdW50ICE9PSAxKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmICghIHNlbGYuX19ldmVudE1hcHMubGVuZ3RoICYmIHR5cGVvZiBzZWxmLmV2ZW50cyA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAvLyBQcm92aWRlIGxpbWl0ZWQgYmFjay1jb21wYXQgc3VwcG9ydCBmb3IgYC5ldmVudHMgPSB7Li4ufWBcbiAgICAgICAgLy8gc3ludGF4LiAgUGFzcyBgdGVtcGxhdGUuZXZlbnRzYCB0byB0aGUgb3JpZ2luYWwgYC5ldmVudHMoLi4uKWBcbiAgICAgICAgLy8gZnVuY3Rpb24uICBUaGlzIGNvZGUgbXVzdCBydW4gb25seSBvbmNlIHBlciB0ZW1wbGF0ZSwgaW5cbiAgICAgICAgLy8gb3JkZXIgdG8gbm90IGJpbmQgdGhlIGhhbmRsZXJzIG1vcmUgdGhhbiBvbmNlLCB3aGljaCBpc1xuICAgICAgICAvLyBlbnN1cmVkIGJ5IHRoZSBmYWN0IHRoYXQgd2Ugb25seSBkbyB0aGlzIHdoZW4gYF9fZXZlbnRNYXBzYFxuICAgICAgICAvLyBpcyBmYWxzeSwgYW5kIHdlIGNhdXNlIGl0IHRvIGJlIHNldCBub3cuXG4gICAgICAgIFRlbXBsYXRlLnByb3RvdHlwZS5ldmVudHMuY2FsbChzZWxmLCBzZWxmLmV2ZW50cyk7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX19ldmVudE1hcHMuZm9yRWFjaChmdW5jdGlvbiAobSkge1xuICAgICAgICBCbGF6ZS5fYWRkRXZlbnRNYXAodmlldywgbSwgdmlldyk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHZpZXcuX3RlbXBsYXRlSW5zdGFuY2UgPSBuZXcgQmxhemUuVGVtcGxhdGVJbnN0YW5jZSh2aWV3KTtcbiAgdmlldy50ZW1wbGF0ZUluc3RhbmNlID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIFVwZGF0ZSBkYXRhLCBmaXJzdE5vZGUsIGFuZCBsYXN0Tm9kZSwgYW5kIHJldHVybiB0aGUgVGVtcGxhdGVJbnN0YW5jZVxuICAgIC8vIG9iamVjdC5cbiAgICB2YXIgaW5zdCA9IHZpZXcuX3RlbXBsYXRlSW5zdGFuY2U7XG5cbiAgICAvKipcbiAgICAgKiBAaW5zdGFuY2VcbiAgICAgKiBAbWVtYmVyT2YgQmxhemUuVGVtcGxhdGVJbnN0YW5jZVxuICAgICAqIEBuYW1lICBkYXRhXG4gICAgICogQHN1bW1hcnkgVGhlIGRhdGEgY29udGV4dCBvZiB0aGlzIGluc3RhbmNlJ3MgbGF0ZXN0IGludm9jYXRpb24uXG4gICAgICogQGxvY3VzIENsaWVudFxuICAgICAqL1xuICAgIGluc3QuZGF0YSA9IEJsYXplLmdldERhdGEodmlldyk7XG5cbiAgICBpZiAodmlldy5fZG9tcmFuZ2UgJiYgIXZpZXcuaXNEZXN0cm95ZWQpIHtcbiAgICAgIGluc3QuZmlyc3ROb2RlID0gdmlldy5fZG9tcmFuZ2UuZmlyc3ROb2RlKCk7XG4gICAgICBpbnN0Lmxhc3ROb2RlID0gdmlldy5fZG9tcmFuZ2UubGFzdE5vZGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gb24gJ2NyZWF0ZWQnIG9yICdkZXN0cm95ZWQnIGNhbGxiYWNrcyB3ZSBkb24ndCBoYXZlIGEgRG9tUmFuZ2VcbiAgICAgIGluc3QuZmlyc3ROb2RlID0gbnVsbDtcbiAgICAgIGluc3QubGFzdE5vZGUgPSBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBpbnN0O1xuICB9O1xuXG4gIC8qKlxuICAgKiBAbmFtZSAgY3JlYXRlZFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIFRlbXBsYXRlXG4gICAqIEBzdW1tYXJ5IFByb3ZpZGUgYSBjYWxsYmFjayB3aGVuIGFuIGluc3RhbmNlIG9mIGEgdGVtcGxhdGUgaXMgY3JlYXRlZC5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAZGVwcmVjYXRlZCBpbiAxLjFcbiAgICovXG4gIC8vIFRvIGF2b2lkIHNpdHVhdGlvbnMgd2hlbiBuZXcgY2FsbGJhY2tzIGFyZSBhZGRlZCBpbiBiZXR3ZWVuIHZpZXdcbiAgLy8gaW5zdGFudGlhdGlvbiBhbmQgZXZlbnQgYmVpbmcgZmlyZWQsIGRlY2lkZSBvbiBhbGwgY2FsbGJhY2tzIHRvIGZpcmVcbiAgLy8gaW1tZWRpYXRlbHkgYW5kIHRoZW4gZmlyZSB0aGVtIG9uIHRoZSBldmVudC5cbiAgdmFyIGNyZWF0ZWRDYWxsYmFja3MgPSBzZWxmLl9nZXRDYWxsYmFja3MoJ2NyZWF0ZWQnKTtcbiAgdmlldy5vblZpZXdDcmVhdGVkKGZ1bmN0aW9uICgpIHtcbiAgICBmaXJlQ2FsbGJhY2tzKGNyZWF0ZWRDYWxsYmFja3MsIHZpZXcudGVtcGxhdGVJbnN0YW5jZSgpKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqIEBuYW1lICByZW5kZXJlZFxuICAgKiBAaW5zdGFuY2VcbiAgICogQG1lbWJlck9mIFRlbXBsYXRlXG4gICAqIEBzdW1tYXJ5IFByb3ZpZGUgYSBjYWxsYmFjayB3aGVuIGFuIGluc3RhbmNlIG9mIGEgdGVtcGxhdGUgaXMgcmVuZGVyZWQuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQGRlcHJlY2F0ZWQgaW4gMS4xXG4gICAqL1xuICB2YXIgcmVuZGVyZWRDYWxsYmFja3MgPSBzZWxmLl9nZXRDYWxsYmFja3MoJ3JlbmRlcmVkJyk7XG4gIHZpZXcub25WaWV3UmVhZHkoZnVuY3Rpb24gKCkge1xuICAgIGZpcmVDYWxsYmFja3MocmVuZGVyZWRDYWxsYmFja3MsIHZpZXcudGVtcGxhdGVJbnN0YW5jZSgpKTtcbiAgfSk7XG5cbiAgLyoqXG4gICAqIEBuYW1lICBkZXN0cm95ZWRcbiAgICogQGluc3RhbmNlXG4gICAqIEBtZW1iZXJPZiBUZW1wbGF0ZVxuICAgKiBAc3VtbWFyeSBQcm92aWRlIGEgY2FsbGJhY2sgd2hlbiBhbiBpbnN0YW5jZSBvZiBhIHRlbXBsYXRlIGlzIGRlc3Ryb3llZC5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAZGVwcmVjYXRlZCBpbiAxLjFcbiAgICovXG4gIHZhciBkZXN0cm95ZWRDYWxsYmFja3MgPSBzZWxmLl9nZXRDYWxsYmFja3MoJ2Rlc3Ryb3llZCcpO1xuICB2aWV3Lm9uVmlld0Rlc3Ryb3llZChmdW5jdGlvbiAoKSB7XG4gICAgZmlyZUNhbGxiYWNrcyhkZXN0cm95ZWRDYWxsYmFja3MsIHZpZXcudGVtcGxhdGVJbnN0YW5jZSgpKTtcbiAgfSk7XG5cbiAgcmV0dXJuIHZpZXc7XG59O1xuXG4vKipcbiAqIEBjbGFzc1xuICogQHN1bW1hcnkgVGhlIGNsYXNzIGZvciB0ZW1wbGF0ZSBpbnN0YW5jZXNcbiAqIEBwYXJhbSB7QmxhemUuVmlld30gdmlld1xuICogQGluc3RhbmNlTmFtZSB0ZW1wbGF0ZVxuICovXG5CbGF6ZS5UZW1wbGF0ZUluc3RhbmNlID0gZnVuY3Rpb24gKHZpZXcpIHtcbiAgaWYgKCEgKHRoaXMgaW5zdGFuY2VvZiBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlKSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgQmxhemUuVGVtcGxhdGVJbnN0YW5jZSh2aWV3KTtcblxuICBpZiAoISAodmlldyBpbnN0YW5jZW9mIEJsYXplLlZpZXcpKVxuICAgIHRocm93IG5ldyBFcnJvcihcIlZpZXcgcmVxdWlyZWRcIik7XG5cbiAgdmlldy5fdGVtcGxhdGVJbnN0YW5jZSA9IHRoaXM7XG5cbiAgLyoqXG4gICAqIEBuYW1lIHZpZXdcbiAgICogQG1lbWJlck9mIEJsYXplLlRlbXBsYXRlSW5zdGFuY2VcbiAgICogQGluc3RhbmNlXG4gICAqIEBzdW1tYXJ5IFRoZSBbVmlld10oLi4vYXBpL2JsYXplLmh0bWwjQmxhemUtVmlldykgb2JqZWN0IGZvciB0aGlzIGludm9jYXRpb24gb2YgdGhlIHRlbXBsYXRlLlxuICAgKiBAbG9jdXMgQ2xpZW50XG4gICAqIEB0eXBlIHtCbGF6ZS5WaWV3fVxuICAgKi9cbiAgdGhpcy52aWV3ID0gdmlldztcbiAgdGhpcy5kYXRhID0gbnVsbDtcblxuICAvKipcbiAgICogQG5hbWUgZmlyc3ROb2RlXG4gICAqIEBtZW1iZXJPZiBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAc3VtbWFyeSBUaGUgZmlyc3QgdG9wLWxldmVsIERPTSBub2RlIGluIHRoaXMgdGVtcGxhdGUgaW5zdGFuY2UuXG4gICAqIEBsb2N1cyBDbGllbnRcbiAgICogQHR5cGUge0RPTU5vZGV9XG4gICAqL1xuICB0aGlzLmZpcnN0Tm9kZSA9IG51bGw7XG5cbiAgLyoqXG4gICAqIEBuYW1lIGxhc3ROb2RlXG4gICAqIEBtZW1iZXJPZiBCbGF6ZS5UZW1wbGF0ZUluc3RhbmNlXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAc3VtbWFyeSBUaGUgbGFzdCB0b3AtbGV2ZWwgRE9NIG5vZGUgaW4gdGhpcyB0ZW1wbGF0ZSBpbnN0YW5jZS5cbiAgICogQGxvY3VzIENsaWVudFxuICAgKiBAdHlwZSB7RE9NTm9kZX1cbiAgICovXG4gIHRoaXMubGFzdE5vZGUgPSBudWxsO1xuXG4gIC8vIFRoaXMgZGVwZW5kZW5jeSBpcyB1c2VkIHRvIGlkZW50aWZ5IHN0YXRlIHRyYW5zaXRpb25zIGluXG4gIC8vIF9zdWJzY3JpcHRpb25IYW5kbGVzIHdoaWNoIGNvdWxkIGNhdXNlIHRoZSByZXN1bHQgb2ZcbiAgLy8gVGVtcGxhdGVJbnN0YW5jZSNzdWJzY3JpcHRpb25zUmVhZHkgdG8gY2hhbmdlLiBCYXNpY2FsbHkgdGhpcyBpcyB0cmlnZ2VyZWRcbiAgLy8gd2hlbmV2ZXIgYSBuZXcgc3Vic2NyaXB0aW9uIGhhbmRsZSBpcyBhZGRlZCBvciB3aGVuIGEgc3Vic2NyaXB0aW9uIGhhbmRsZVxuICAvLyBpcyByZW1vdmVkIGFuZCB0aGV5IGFyZSBub3QgcmVhZHkuXG4gIHRoaXMuX2FsbFN1YnNSZWFkeURlcCA9IG5ldyBUcmFja2VyLkRlcGVuZGVuY3koKTtcbiAgdGhpcy5fYWxsU3Vic1JlYWR5ID0gZmFsc2U7XG5cbiAgdGhpcy5fc3Vic2NyaXB0aW9uSGFuZGxlcyA9IHt9O1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBGaW5kIGFsbCBlbGVtZW50cyBtYXRjaGluZyBgc2VsZWN0b3JgIGluIHRoaXMgdGVtcGxhdGUgaW5zdGFuY2UsIGFuZCByZXR1cm4gdGhlbSBhcyBhIEpRdWVyeSBvYmplY3QuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge1N0cmluZ30gc2VsZWN0b3IgVGhlIENTUyBzZWxlY3RvciB0byBtYXRjaCwgc2NvcGVkIHRvIHRoZSB0ZW1wbGF0ZSBjb250ZW50cy5cbiAqIEByZXR1cm5zIHtET01Ob2RlW119XG4gKi9cbkJsYXplLlRlbXBsYXRlSW5zdGFuY2UucHJvdG90eXBlLiQgPSBmdW5jdGlvbiAoc2VsZWN0b3IpIHtcbiAgdmFyIHZpZXcgPSB0aGlzLnZpZXc7XG4gIGlmICghIHZpZXcuX2RvbXJhbmdlKVxuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHVzZSAkIG9uIHRlbXBsYXRlIGluc3RhbmNlIHdpdGggbm8gRE9NXCIpO1xuICByZXR1cm4gdmlldy5fZG9tcmFuZ2UuJChzZWxlY3Rvcik7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEZpbmQgYWxsIGVsZW1lbnRzIG1hdGNoaW5nIGBzZWxlY3RvcmAgaW4gdGhpcyB0ZW1wbGF0ZSBpbnN0YW5jZS5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvciBUaGUgQ1NTIHNlbGVjdG9yIHRvIG1hdGNoLCBzY29wZWQgdG8gdGhlIHRlbXBsYXRlIGNvbnRlbnRzLlxuICogQHJldHVybnMge0RPTUVsZW1lbnRbXX1cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuZmluZEFsbCA9IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwodGhpcy4kKHNlbGVjdG9yKSk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IEZpbmQgb25lIGVsZW1lbnQgbWF0Y2hpbmcgYHNlbGVjdG9yYCBpbiB0aGlzIHRlbXBsYXRlIGluc3RhbmNlLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IHNlbGVjdG9yIFRoZSBDU1Mgc2VsZWN0b3IgdG8gbWF0Y2gsIHNjb3BlZCB0byB0aGUgdGVtcGxhdGUgY29udGVudHMuXG4gKiBAcmV0dXJucyB7RE9NRWxlbWVudH1cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uIChzZWxlY3Rvcikge1xuICB2YXIgcmVzdWx0ID0gdGhpcy4kKHNlbGVjdG9yKTtcbiAgcmV0dXJuIHJlc3VsdFswXSB8fCBudWxsO1xufTtcblxuLyoqXG4gKiBAc3VtbWFyeSBBIHZlcnNpb24gb2YgW1RyYWNrZXIuYXV0b3J1bl0oaHR0cHM6Ly9kb2NzLm1ldGVvci5jb20vYXBpL3RyYWNrZXIuaHRtbCNUcmFja2VyLWF1dG9ydW4pIHRoYXQgaXMgc3RvcHBlZCB3aGVuIHRoZSB0ZW1wbGF0ZSBpcyBkZXN0cm95ZWQuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBydW5GdW5jIFRoZSBmdW5jdGlvbiB0byBydW4uIEl0IHJlY2VpdmVzIG9uZSBhcmd1bWVudDogYSBUcmFja2VyLkNvbXB1dGF0aW9uIG9iamVjdC5cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuYXV0b3J1biA9IGZ1bmN0aW9uIChmKSB7XG4gIHJldHVybiB0aGlzLnZpZXcuYXV0b3J1bihmKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQSB2ZXJzaW9uIG9mIFtNZXRlb3Iuc3Vic2NyaWJlXShodHRwczovL2RvY3MubWV0ZW9yLmNvbS9hcGkvcHVic3ViLmh0bWwjTWV0ZW9yLXN1YnNjcmliZSkgdGhhdCBpcyBzdG9wcGVkXG4gKiB3aGVuIHRoZSB0ZW1wbGF0ZSBpcyBkZXN0cm95ZWQuXG4gKiBAcmV0dXJuIHtTdWJzY3JpcHRpb25IYW5kbGV9IFRoZSBzdWJzY3JpcHRpb24gaGFuZGxlIHRvIHRoZSBuZXdseSBtYWRlXG4gKiBzdWJzY3JpcHRpb24uIENhbGwgYGhhbmRsZS5zdG9wKClgIHRvIG1hbnVhbGx5IHN0b3AgdGhlIHN1YnNjcmlwdGlvbiwgb3JcbiAqIGBoYW5kbGUucmVhZHkoKWAgdG8gZmluZCBvdXQgaWYgdGhpcyBwYXJ0aWN1bGFyIHN1YnNjcmlwdGlvbiBoYXMgbG9hZGVkIGFsbFxuICogb2YgaXRzIGluaXRhbCBkYXRhLlxuICogQGxvY3VzIENsaWVudFxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgTmFtZSBvZiB0aGUgc3Vic2NyaXB0aW9uLiAgTWF0Y2hlcyB0aGUgbmFtZSBvZiB0aGVcbiAqIHNlcnZlcidzIGBwdWJsaXNoKClgIGNhbGwuXG4gKiBAcGFyYW0ge0FueX0gW2FyZzEsYXJnMi4uLl0gT3B0aW9uYWwgYXJndW1lbnRzIHBhc3NlZCB0byBwdWJsaXNoZXIgZnVuY3Rpb25cbiAqIG9uIHNlcnZlci5cbiAqIEBwYXJhbSB7RnVuY3Rpb258T2JqZWN0fSBbb3B0aW9uc10gSWYgYSBmdW5jdGlvbiBpcyBwYXNzZWQgaW5zdGVhZCBvZiBhblxuICogb2JqZWN0LCBpdCBpcyBpbnRlcnByZXRlZCBhcyBhbiBgb25SZWFkeWAgY2FsbGJhY2suXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbb3B0aW9ucy5vblJlYWR5XSBQYXNzZWQgdG8gW2BNZXRlb3Iuc3Vic2NyaWJlYF0oaHR0cHM6Ly9kb2NzLm1ldGVvci5jb20vYXBpL3B1YnN1Yi5odG1sI01ldGVvci1zdWJzY3JpYmUpLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gW29wdGlvbnMub25TdG9wXSBQYXNzZWQgdG8gW2BNZXRlb3Iuc3Vic2NyaWJlYF0oaHR0cHM6Ly9kb2NzLm1ldGVvci5jb20vYXBpL3B1YnN1Yi5odG1sI01ldGVvci1zdWJzY3JpYmUpLlxuICogQHBhcmFtIHtERFAuQ29ubmVjdGlvbn0gW29wdGlvbnMuY29ubmVjdGlvbl0gVGhlIGNvbm5lY3Rpb24gb24gd2hpY2ggdG8gbWFrZSB0aGVcbiAqIHN1YnNjcmlwdGlvbi5cbiAqL1xuQmxhemUuVGVtcGxhdGVJbnN0YW5jZS5wcm90b3R5cGUuc3Vic2NyaWJlID0gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHZhciBzdWJIYW5kbGVzID0gc2VsZi5fc3Vic2NyaXB0aW9uSGFuZGxlcztcblxuICAvLyBEdXBsaWNhdGUgbG9naWMgZnJvbSBNZXRlb3Iuc3Vic2NyaWJlXG4gIHZhciBvcHRpb25zID0ge307XG4gIGlmIChhcmdzLmxlbmd0aCkge1xuICAgIHZhciBsYXN0UGFyYW0gPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG5cbiAgICAvLyBNYXRjaCBwYXR0ZXJuIHRvIGNoZWNrIGlmIHRoZSBsYXN0IGFyZyBpcyBhbiBvcHRpb25zIGFyZ3VtZW50XG4gICAgdmFyIGxhc3RQYXJhbU9wdGlvbnNQYXR0ZXJuID0ge1xuICAgICAgb25SZWFkeTogTWF0Y2guT3B0aW9uYWwoRnVuY3Rpb24pLFxuICAgICAgLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjEgb25FcnJvciB1c2VkIHRvIGV4aXN0LCBidXQgbm93IHdlIHVzZVxuICAgICAgLy8gb25TdG9wIHdpdGggYW4gZXJyb3IgY2FsbGJhY2sgaW5zdGVhZC5cbiAgICAgIG9uRXJyb3I6IE1hdGNoLk9wdGlvbmFsKEZ1bmN0aW9uKSxcbiAgICAgIG9uU3RvcDogTWF0Y2guT3B0aW9uYWwoRnVuY3Rpb24pLFxuICAgICAgY29ubmVjdGlvbjogTWF0Y2guT3B0aW9uYWwoTWF0Y2guQW55KVxuICAgIH07XG5cbiAgICBpZiAoaXNGdW5jdGlvbihsYXN0UGFyYW0pKSB7XG4gICAgICBvcHRpb25zLm9uUmVhZHkgPSBhcmdzLnBvcCgpO1xuICAgIH0gZWxzZSBpZiAobGFzdFBhcmFtICYmICEgaXNFbXB0eShsYXN0UGFyYW0pICYmIE1hdGNoLnRlc3QobGFzdFBhcmFtLCBsYXN0UGFyYW1PcHRpb25zUGF0dGVybikpIHtcbiAgICAgIG9wdGlvbnMgPSBhcmdzLnBvcCgpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBzdWJIYW5kbGU7XG4gIHZhciBvbGRTdG9wcGVkID0gb3B0aW9ucy5vblN0b3A7XG4gIG9wdGlvbnMub25TdG9wID0gZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgLy8gV2hlbiB0aGUgc3Vic2NyaXB0aW9uIGlzIHN0b3BwZWQsIHJlbW92ZSBpdCBmcm9tIHRoZSBzZXQgb2YgdHJhY2tlZFxuICAgIC8vIHN1YnNjcmlwdGlvbnMgdG8gYXZvaWQgdGhpcyBsaXN0IGdyb3dpbmcgd2l0aG91dCBib3VuZFxuICAgIGRlbGV0ZSBzdWJIYW5kbGVzW3N1YkhhbmRsZS5zdWJzY3JpcHRpb25JZF07XG5cbiAgICAvLyBSZW1vdmluZyBhIHN1YnNjcmlwdGlvbiBjYW4gb25seSBjaGFuZ2UgdGhlIHJlc3VsdCBvZiBzdWJzY3JpcHRpb25zUmVhZHlcbiAgICAvLyBpZiB3ZSBhcmUgbm90IHJlYWR5ICh0aGF0IHN1YnNjcmlwdGlvbiBjb3VsZCBiZSB0aGUgb25lIGJsb2NraW5nIHVzIGJlaW5nXG4gICAgLy8gcmVhZHkpLlxuICAgIGlmICghIHNlbGYuX2FsbFN1YnNSZWFkeSkge1xuICAgICAgc2VsZi5fYWxsU3Vic1JlYWR5RGVwLmNoYW5nZWQoKTtcbiAgICB9XG5cbiAgICBpZiAob2xkU3RvcHBlZCkge1xuICAgICAgb2xkU3RvcHBlZChlcnJvcik7XG4gICAgfVxuICB9O1xuXG4gIHZhciBjb25uZWN0aW9uID0gb3B0aW9ucy5jb25uZWN0aW9uO1xuICBjb25zdCB7IG9uUmVhZHksIG9uRXJyb3IsIG9uU3RvcCB9ID0gb3B0aW9ucztcbiAgdmFyIGNhbGxiYWNrcyA9IHsgb25SZWFkeSwgb25FcnJvciwgb25TdG9wIH07XG5cbiAgLy8gVGhlIGNhbGxiYWNrcyBhcmUgcGFzc2VkIGFzIHRoZSBsYXN0IGl0ZW0gaW4gdGhlIGFyZ3VtZW50cyBhcnJheSBwYXNzZWQgdG9cbiAgLy8gVmlldyNzdWJzY3JpYmVcbiAgYXJncy5wdXNoKGNhbGxiYWNrcyk7XG5cbiAgLy8gVmlldyNzdWJzY3JpYmUgdGFrZXMgdGhlIGNvbm5lY3Rpb24gYXMgb25lIG9mIHRoZSBvcHRpb25zIGluIHRoZSBsYXN0XG4gIC8vIGFyZ3VtZW50XG4gIHN1YkhhbmRsZSA9IHNlbGYudmlldy5zdWJzY3JpYmUuY2FsbChzZWxmLnZpZXcsIGFyZ3MsIHtcbiAgICBjb25uZWN0aW9uOiBjb25uZWN0aW9uXG4gIH0pO1xuXG4gIGlmICghaGFzKHN1YkhhbmRsZXMsIHN1YkhhbmRsZS5zdWJzY3JpcHRpb25JZCkpIHtcbiAgICBzdWJIYW5kbGVzW3N1YkhhbmRsZS5zdWJzY3JpcHRpb25JZF0gPSBzdWJIYW5kbGU7XG5cbiAgICAvLyBBZGRpbmcgYSBuZXcgc3Vic2NyaXB0aW9uIHdpbGwgYWx3YXlzIGNhdXNlIHVzIHRvIHRyYW5zaXRpb24gZnJvbSByZWFkeVxuICAgIC8vIHRvIG5vdCByZWFkeSwgYnV0IGlmIHdlIGFyZSBhbHJlYWR5IG5vdCByZWFkeSB0aGVuIHRoaXMgY2FuJ3QgbWFrZSB1c1xuICAgIC8vIHJlYWR5LlxuICAgIGlmIChzZWxmLl9hbGxTdWJzUmVhZHkpIHtcbiAgICAgIHNlbGYuX2FsbFN1YnNSZWFkeURlcC5jaGFuZ2VkKCk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHN1YkhhbmRsZTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgQSByZWFjdGl2ZSBmdW5jdGlvbiB0aGF0IHJldHVybnMgdHJ1ZSB3aGVuIGFsbCBvZiB0aGUgc3Vic2NyaXB0aW9uc1xuICogY2FsbGVkIHdpdGggW3RoaXMuc3Vic2NyaWJlXSgjVGVtcGxhdGVJbnN0YW5jZS1zdWJzY3JpYmUpIGFyZSByZWFkeS5cbiAqIEByZXR1cm4ge0Jvb2xlYW59IFRydWUgaWYgYWxsIHN1YnNjcmlwdGlvbnMgb24gdGhpcyB0ZW1wbGF0ZSBpbnN0YW5jZSBhcmVcbiAqIHJlYWR5LlxuICovXG5CbGF6ZS5UZW1wbGF0ZUluc3RhbmNlLnByb3RvdHlwZS5zdWJzY3JpcHRpb25zUmVhZHkgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuX2FsbFN1YnNSZWFkeURlcC5kZXBlbmQoKTtcbiAgdGhpcy5fYWxsU3Vic1JlYWR5ID0gT2JqZWN0LnZhbHVlcyh0aGlzLl9zdWJzY3JpcHRpb25IYW5kbGVzKS5ldmVyeSgoaGFuZGxlKSA9PiB7ICBcbiAgICByZXR1cm4gaGFuZGxlLnJlYWR5KCk7XG4gIH0pO1xuXG4gIHJldHVybiB0aGlzLl9hbGxTdWJzUmVhZHk7XG59O1xuXG4vKipcbiAqIEBzdW1tYXJ5IFNwZWNpZnkgdGVtcGxhdGUgaGVscGVycyBhdmFpbGFibGUgdG8gdGhpcyB0ZW1wbGF0ZS5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7T2JqZWN0fSBoZWxwZXJzIERpY3Rpb25hcnkgb2YgaGVscGVyIGZ1bmN0aW9ucyBieSBuYW1lLlxuICogQGltcG9ydEZyb21QYWNrYWdlIHRlbXBsYXRpbmdcbiAqL1xuVGVtcGxhdGUucHJvdG90eXBlLmhlbHBlcnMgPSBmdW5jdGlvbiAoZGljdCkge1xuICBpZiAoIWlzT2JqZWN0KGRpY3QpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiSGVscGVycyBkaWN0aW9uYXJ5IGhhcyB0byBiZSBhbiBvYmplY3RcIik7XG4gIH1cblxuICBmb3IgKHZhciBrIGluIGRpY3QpIHRoaXMuX19oZWxwZXJzLnNldChrLCBkaWN0W2tdKTtcbn07XG5cbnZhciBjYW5Vc2VHZXR0ZXJzID0gKGZ1bmN0aW9uICgpIHtcbiAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICB0cnkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwgXCJzZWxmXCIsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbiAoKSB7IHJldHVybiBvYmo7IH1cbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIG9iai5zZWxmID09PSBvYmo7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufSkoKTtcblxuaWYgKGNhblVzZUdldHRlcnMpIHtcbiAgLy8gTGlrZSBCbGF6ZS5jdXJyZW50VmlldyBidXQgZm9yIHRoZSB0ZW1wbGF0ZSBpbnN0YW5jZS4gQSBmdW5jdGlvblxuICAvLyByYXRoZXIgdGhhbiBhIHZhbHVlIHNvIHRoYXQgbm90IGFsbCBoZWxwZXJzIGFyZSBpbXBsaWNpdGx5IGRlcGVuZGVudFxuICAvLyBvbiB0aGUgY3VycmVudCB0ZW1wbGF0ZSBpbnN0YW5jZSdzIGBkYXRhYCBwcm9wZXJ0eSwgd2hpY2ggd291bGQgbWFrZVxuICAvLyB0aGVtIGRlcGVuZGVudCBvbiB0aGUgZGF0YSBjb250ZXh0IG9mIHRoZSB0ZW1wbGF0ZSBpbmNsdXNpb24uXG4gIHZhciBjdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmMgPSBudWxsO1xuXG4gIC8vIElmIGdldHRlcnMgYXJlIHN1cHBvcnRlZCwgZGVmaW5lIHRoaXMgcHJvcGVydHkgd2l0aCBhIGdldHRlciBmdW5jdGlvblxuICAvLyB0byBtYWtlIGl0IGVmZmVjdGl2ZWx5IHJlYWQtb25seSwgYW5kIHRvIHdvcmsgYXJvdW5kIHRoaXMgYml6YXJyZSBKU0NcbiAgLy8gYnVnOiBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvOTkyNlxuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoVGVtcGxhdGUsIFwiX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuY1wiLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jO1xuICAgIH1cbiAgfSk7XG5cbiAgVGVtcGxhdGUuX3dpdGhUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IGZ1bmN0aW9uICh0ZW1wbGF0ZUluc3RhbmNlRnVuYywgZnVuYykge1xuICAgIGlmICh0eXBlb2YgZnVuYyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgZnVuY3Rpb24sIGdvdDogXCIgKyBmdW5jKTtcbiAgICB9XG4gICAgdmFyIG9sZFRtcGxJbnN0YW5jZUZ1bmMgPSBjdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG4gICAgdHJ5IHtcbiAgICAgIGN1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IHRlbXBsYXRlSW5zdGFuY2VGdW5jO1xuICAgICAgcmV0dXJuIGZ1bmMoKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gb2xkVG1wbEluc3RhbmNlRnVuYztcbiAgICB9XG4gIH07XG59IGVsc2Uge1xuICAvLyBJZiBnZXR0ZXJzIGFyZSBub3Qgc3VwcG9ydGVkLCBqdXN0IHVzZSBhIG5vcm1hbCBwcm9wZXJ0eS5cbiAgVGVtcGxhdGUuX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IG51bGw7XG5cbiAgVGVtcGxhdGUuX3dpdGhUZW1wbGF0ZUluc3RhbmNlRnVuYyA9IGZ1bmN0aW9uICh0ZW1wbGF0ZUluc3RhbmNlRnVuYywgZnVuYykge1xuICAgIGlmICh0eXBlb2YgZnVuYyAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXhwZWN0ZWQgZnVuY3Rpb24sIGdvdDogXCIgKyBmdW5jKTtcbiAgICB9XG4gICAgdmFyIG9sZFRtcGxJbnN0YW5jZUZ1bmMgPSBUZW1wbGF0ZS5fY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jO1xuICAgIHRyeSB7XG4gICAgICBUZW1wbGF0ZS5fY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gdGVtcGxhdGVJbnN0YW5jZUZ1bmM7XG4gICAgICByZXR1cm4gZnVuYygpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBUZW1wbGF0ZS5fY3VycmVudFRlbXBsYXRlSW5zdGFuY2VGdW5jID0gb2xkVG1wbEluc3RhbmNlRnVuYztcbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogQHN1bW1hcnkgU3BlY2lmeSBldmVudCBoYW5kbGVycyBmb3IgdGhpcyB0ZW1wbGF0ZS5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBwYXJhbSB7RXZlbnRNYXB9IGV2ZW50TWFwIEV2ZW50IGhhbmRsZXJzIHRvIGFzc29jaWF0ZSB3aXRoIHRoaXMgdGVtcGxhdGUuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgdGVtcGxhdGluZ1xuICovXG5UZW1wbGF0ZS5wcm90b3R5cGUuZXZlbnRzID0gZnVuY3Rpb24gKGV2ZW50TWFwKSB7XG4gIGlmICghaXNPYmplY3QoZXZlbnRNYXApKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiRXZlbnQgbWFwIGhhcyB0byBiZSBhbiBvYmplY3RcIik7XG4gIH1cblxuICB2YXIgdGVtcGxhdGUgPSB0aGlzO1xuICB2YXIgZXZlbnRNYXAyID0ge307XG4gIGZvciAodmFyIGsgaW4gZXZlbnRNYXApIHtcbiAgICBldmVudE1hcDJba10gPSAoZnVuY3Rpb24gKGssIHYpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAoZXZlbnQgLyosIC4uLiovKSB7XG4gICAgICAgIHZhciB2aWV3ID0gdGhpczsgLy8gcGFzc2VkIGJ5IEV2ZW50QXVnbWVudGVyXG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICAgICAgLy8gRXhpdGluZyB0aGUgY3VycmVudCBjb21wdXRhdGlvbiB0byBhdm9pZCBjcmVhdGluZyB1bm5lY2Vzc2FyeVxuICAgICAgICAvLyBhbmQgdW5leHBlY3RlZCByZWFjdGl2ZSBkZXBlbmRlbmNpZXMgd2l0aCBUZW1wbGF0ZXMgZGF0YVxuICAgICAgICAvLyBvciBhbnkgb3RoZXIgcmVhY3RpdmUgZGVwZW5kZW5jaWVzIGRlZmluZWQgaW4gZXZlbnQgaGFuZGxlcnNcbiAgICAgICAgcmV0dXJuIFRyYWNrZXIubm9ucmVhY3RpdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBkYXRhID0gQmxhemUuZ2V0RGF0YShldmVudC5jdXJyZW50VGFyZ2V0KTtcbiAgICAgICAgICBpZiAoZGF0YSA9PSBudWxsKSBkYXRhID0ge307XG4gICAgICAgICAgdmFyIHRtcGxJbnN0YW5jZUZ1bmMgPSBCbGF6ZS5fYmluZCh2aWV3LnRlbXBsYXRlSW5zdGFuY2UsIHZpZXcpO1xuICAgICAgICAgIGFyZ3Muc3BsaWNlKDEsIDAsIHRtcGxJbnN0YW5jZUZ1bmMoKSk7XG4gICAgICAgICAgcmV0dXJuIFRlbXBsYXRlLl93aXRoVGVtcGxhdGVJbnN0YW5jZUZ1bmModG1wbEluc3RhbmNlRnVuYywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHYuYXBwbHkoZGF0YSwgYXJncyk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfTtcbiAgICB9KShrLCBldmVudE1hcFtrXSk7XG4gIH1cblxuICB0ZW1wbGF0ZS5fX2V2ZW50TWFwcy5wdXNoKGV2ZW50TWFwMik7XG59O1xuXG4vKipcbiAqIEBmdW5jdGlvblxuICogQG5hbWUgaW5zdGFuY2VcbiAqIEBtZW1iZXJPZiBUZW1wbGF0ZVxuICogQHN1bW1hcnkgVGhlIFt0ZW1wbGF0ZSBpbnN0YW5jZV0oI1RlbXBsYXRlLWluc3RhbmNlcykgY29ycmVzcG9uZGluZyB0byB0aGUgY3VycmVudCB0ZW1wbGF0ZSBoZWxwZXIsIGV2ZW50IGhhbmRsZXIsIGNhbGxiYWNrLCBvciBhdXRvcnVuLiAgSWYgdGhlcmUgaXNuJ3Qgb25lLCBgbnVsbGAuXG4gKiBAbG9jdXMgQ2xpZW50XG4gKiBAcmV0dXJucyB7QmxhemUuVGVtcGxhdGVJbnN0YW5jZX1cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLmluc3RhbmNlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gVGVtcGxhdGUuX2N1cnJlbnRUZW1wbGF0ZUluc3RhbmNlRnVuY1xuICAgICYmIFRlbXBsYXRlLl9jdXJyZW50VGVtcGxhdGVJbnN0YW5jZUZ1bmMoKTtcbn07XG5cbi8vIE5vdGU6IFRlbXBsYXRlLmN1cnJlbnREYXRhKCkgaXMgZG9jdW1lbnRlZCB0byB0YWtlIHplcm8gYXJndW1lbnRzLFxuLy8gd2hpbGUgQmxhemUuZ2V0RGF0YSB0YWtlcyB1cCB0byBvbmUuXG5cbi8qKlxuICogQHN1bW1hcnlcbiAqXG4gKiAtIEluc2lkZSBhbiBgb25DcmVhdGVkYCwgYG9uUmVuZGVyZWRgLCBvciBgb25EZXN0cm95ZWRgIGNhbGxiYWNrLCByZXR1cm5zXG4gKiB0aGUgZGF0YSBjb250ZXh0IG9mIHRoZSB0ZW1wbGF0ZS5cbiAqIC0gSW5zaWRlIGFuIGV2ZW50IGhhbmRsZXIsIHJldHVybnMgdGhlIGRhdGEgY29udGV4dCBvZiB0aGUgdGVtcGxhdGUgb24gd2hpY2hcbiAqIHRoaXMgZXZlbnQgaGFuZGxlciB3YXMgZGVmaW5lZC5cbiAqIC0gSW5zaWRlIGEgaGVscGVyLCByZXR1cm5zIHRoZSBkYXRhIGNvbnRleHQgb2YgdGhlIERPTSBub2RlIHdoZXJlIHRoZSBoZWxwZXJcbiAqIHdhcyB1c2VkLlxuICpcbiAqIEVzdGFibGlzaGVzIGEgcmVhY3RpdmUgZGVwZW5kZW5jeSBvbiB0aGUgcmVzdWx0LlxuICogQGxvY3VzIENsaWVudFxuICogQGZ1bmN0aW9uXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgdGVtcGxhdGluZ1xuICovXG5UZW1wbGF0ZS5jdXJyZW50RGF0YSA9IEJsYXplLmdldERhdGE7XG5cbi8qKlxuICogQHN1bW1hcnkgQWNjZXNzZXMgb3RoZXIgZGF0YSBjb250ZXh0cyB0aGF0IGVuY2xvc2UgdGhlIGN1cnJlbnQgZGF0YSBjb250ZXh0LlxuICogQGxvY3VzIENsaWVudFxuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge0ludGVnZXJ9IFtudW1MZXZlbHNdIFRoZSBudW1iZXIgb2YgbGV2ZWxzIGJleW9uZCB0aGUgY3VycmVudCBkYXRhIGNvbnRleHQgdG8gbG9vay4gRGVmYXVsdHMgdG8gMS5cbiAqIEBpbXBvcnRGcm9tUGFja2FnZSB0ZW1wbGF0aW5nXG4gKi9cblRlbXBsYXRlLnBhcmVudERhdGEgPSBCbGF6ZS5fcGFyZW50RGF0YTtcblxuLyoqXG4gKiBAc3VtbWFyeSBEZWZpbmVzIGEgW2hlbHBlciBmdW5jdGlvbl0oI1RlbXBsYXRlLWhlbHBlcnMpIHdoaWNoIGNhbiBiZSB1c2VkIGZyb20gYWxsIHRlbXBsYXRlcy5cbiAqIEBsb2N1cyBDbGllbnRcbiAqIEBmdW5jdGlvblxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIGhlbHBlciBmdW5jdGlvbiB5b3UgYXJlIGRlZmluaW5nLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZnVuY3Rpb24gVGhlIGhlbHBlciBmdW5jdGlvbiBpdHNlbGYuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgdGVtcGxhdGluZ1xuICovXG5UZW1wbGF0ZS5yZWdpc3RlckhlbHBlciA9IEJsYXplLnJlZ2lzdGVySGVscGVyO1xuXG4vKipcbiAqIEBzdW1tYXJ5IFJlbW92ZXMgYSBnbG9iYWwgW2hlbHBlciBmdW5jdGlvbl0oI1RlbXBsYXRlLWhlbHBlcnMpLlxuICogQGxvY3VzIENsaWVudFxuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZSBUaGUgbmFtZSBvZiB0aGUgaGVscGVyIGZ1bmN0aW9uIHlvdSBhcmUgZGVmaW5pbmcuXG4gKiBAaW1wb3J0RnJvbVBhY2thZ2UgdGVtcGxhdGluZ1xuICovXG5UZW1wbGF0ZS5kZXJlZ2lzdGVySGVscGVyID0gQmxhemUuZGVyZWdpc3RlckhlbHBlcjtcbiIsIlVJID0gQmxhemU7XG5cbkJsYXplLlJlYWN0aXZlVmFyID0gUmVhY3RpdmVWYXI7XG5VSS5fdGVtcGxhdGVJbnN0YW5jZSA9IEJsYXplLlRlbXBsYXRlLmluc3RhbmNlO1xuXG5IYW5kbGViYXJzID0ge307XG5IYW5kbGViYXJzLnJlZ2lzdGVySGVscGVyID0gQmxhemUucmVnaXN0ZXJIZWxwZXI7XG5cbkhhbmRsZWJhcnMuX2VzY2FwZSA9IEJsYXplLl9lc2NhcGU7XG5cbi8vIFJldHVybiB0aGVzZSBmcm9tIHt7Li4ufX0gaGVscGVycyB0byBhY2hpZXZlIHRoZSBzYW1lIGFzIHJldHVybmluZ1xuLy8gc3RyaW5ncyBmcm9tIHt7ey4uLn19fSBoZWxwZXJzXG5IYW5kbGViYXJzLlNhZmVTdHJpbmcgPSBmdW5jdGlvbihzdHJpbmcpIHtcbiAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG59O1xuSGFuZGxlYmFycy5TYWZlU3RyaW5nLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uKCkge1xuICByZXR1cm4gdGhpcy5zdHJpbmcudG9TdHJpbmcoKTtcbn07XG4iXX0=
