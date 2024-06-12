/**
 * @file
 * Drupal Bootstrap object.
 */

/**
 * All Drupal Bootstrap JavaScript APIs are contained in this namespace.
 *
 * @param {underscore} _
 * @param {jQuery} $
 * @param {Drupal} Drupal
 * @param {drupalSettings} drupalSettings
 */
(function (_, $, Drupal, drupalSettings) {
  'use strict';

  /**
   * @typedef Drupal.bootstrap
   */
  var Bootstrap = {
    processedOnce: {},
    settings: drupalSettings.bootstrap || {}
  };

  /**
   * Wraps Drupal.checkPlain() to ensure value passed isn't empty.
   *
   * Encodes special characters in a plain-text string for display as HTML.
   *
   * @param {string} str
   *   The string to be encoded.
   *
   * @return {string}
   *   The encoded string.
   *
   * @ingroup sanitization
   */
  Bootstrap.checkPlain = function (str) {
    return str && Drupal.checkPlain(str) || '';
  };

  /**
   * Creates a jQuery plugin.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} plugin
   *   A constructor function used to initialize the for the jQuery plugin.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.createPlugin = function (id, plugin, noConflict) {
    // Immediately return if plugin doesn't exist.
    if ($.fn[id] !== void 0) {
      return this.fatal('Specified jQuery plugin identifier already exists: @id. Use Drupal.bootstrap.replacePlugin() instead.', {'@id': id});
    }

    // Immediately return if plugin isn't a function.
    if (typeof plugin !== 'function') {
      return this.fatal('You must provide a constructor function to create a jQuery plugin "@id": @plugin', {'@id': id, '@plugin':  plugin});
    }

    // Add a ".noConflict()" helper method.
    this.pluginNoConflict(id, plugin, noConflict);

    $.fn[id] = plugin;
  };

  /**
   * Diff object properties.
   *
   * @param {...Object} objects
   *   Two or more objects. The first object will be used to return properties
   *   values.
   *
   * @return {Object}
   *   Returns the properties of the first passed object that are not present
   *   in all other passed objects.
   */
  Bootstrap.diffObjects = function (objects) {
    var args = Array.prototype.slice.call(arguments);
    return _.pick(args[0], _.difference.apply(_, _.map(args, function (obj) {
      return Object.keys(obj);
    })));
  };

  /**
   * Map of supported events by regular expression.
   *
   * @type {Object<Event|MouseEvent|KeyboardEvent|TouchEvent,RegExp>}
   */
  Bootstrap.eventMap = {
    Event: /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
    MouseEvent: /^(?:click|dblclick|mouse(?:down|enter|leave|up|over|move|out))$/,
    KeyboardEvent: /^(?:key(?:down|press|up))$/,
    TouchEvent: /^(?:touch(?:start|end|move|cancel))$/
  };

  /**
   * Extends a jQuery Plugin.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} callback
   *   A constructor function used to initialize the for the jQuery plugin.
   *
   * @return {Function|Boolean}
   *   The jQuery plugin constructor or FALSE if the plugin does not exist.
   */
  Bootstrap.extendPlugin = function (id, callback) {
    // Immediately return if plugin doesn't exist.
    if (typeof $.fn[id] !== 'function') {
      return this.fatal('Specified jQuery plugin identifier does not exist: @id', {'@id':  id});
    }

    // Immediately return if callback isn't a function.
    if (typeof callback !== 'function') {
      return this.fatal('You must provide a callback function to extend the jQuery plugin "@id": @callback', {'@id': id, '@callback':  callback});
    }

    // Determine existing plugin constructor.
    var constructor = $.fn[id] && $.fn[id].Constructor || $.fn[id];
    var plugin = callback.apply(constructor, [this.settings]);
    if (!$.isPlainObject(plugin)) {
      return this.fatal('Returned value from callback is not a plain object that can be used to extend the jQuery plugin "@id": @obj', {'@obj':  plugin});
    }

    this.wrapPluginConstructor(constructor, plugin, true);

    return $.fn[id];
  };

  Bootstrap.superWrapper = function (parent, fn) {
    return function () {
      var previousSuper = this.super;
      this.super = parent;
      var ret = fn.apply(this, arguments);
      if (previousSuper) {
        this.super = previousSuper;
      }
      else {
        delete this.super;
      }
      return ret;
    };
  };

  /**
   * Provide a helper method for displaying when something is went wrong.
   *
   * @param {String} message
   *   The message to display.
   * @param {Object} [args]
   *   An arguments to use in message.
   *
   * @return {Boolean}
   *   Always returns FALSE.
   */
  Bootstrap.fatal = function (message, args) {
    if (this.settings.dev && console.warn) {
      for (var name in args) {
        if (args.hasOwnProperty(name) && typeof args[name] === 'object') {
          args[name] = JSON.stringify(args[name]);
        }
      }
      Drupal.throwError(new Error(Drupal.formatString(message, args)));
    }
    return false;
  };

  /**
   * Intersects object properties.
   *
   * @param {...Object} objects
   *   Two or more objects. The first object will be used to return properties
   *   values.
   *
   * @return {Object}
   *   Returns the properties of first passed object that intersects with all
   *   other passed objects.
   */
  Bootstrap.intersectObjects = function (objects) {
    var args = Array.prototype.slice.call(arguments);
    return _.pick(args[0], _.intersection.apply(_, _.map(args, function (obj) {
      return Object.keys(obj);
    })));
  };

  /**
   * Normalizes an object's values.
   *
   * @param {Object} obj
   *   The object to normalize.
   *
   * @return {Object}
   *   The normalized object.
   */
  Bootstrap.normalizeObject = function (obj) {
    if (!$.isPlainObject(obj)) {
      return obj;
    }

    for (var k in obj) {
      if (typeof obj[k] === 'string') {
        if (obj[k] === 'true') {
          obj[k] = true;
        }
        else if (obj[k] === 'false') {
          obj[k] = false;
        }
        else if (obj[k].match(/^[\d-.]$/)) {
          obj[k] = parseFloat(obj[k]);
        }
      }
      else if ($.isPlainObject(obj[k])) {
        obj[k] = Bootstrap.normalizeObject(obj[k]);
      }
    }

    return obj;
  };

  /**
   * An object based once plugin (similar to jquery.once, but without the DOM).
   *
   * @param {String} id
   *   A unique identifier.
   * @param {Function} callback
   *   The callback to invoke if the identifier has not yet been seen.
   *
   * @return {Bootstrap}
   */
  Bootstrap.once = function (id, callback) {
    // Immediately return if identifier has already been processed.
    if (this.processedOnce[id]) {
      return this;
    }
    callback.call(this, this.settings);
    this.processedOnce[id] = true;
    return this;
  };

  /**
   * Provide jQuery UI like ability to get/set options for Bootstrap plugins.
   *
   * @param {string|object} key
   *   A string value of the option to set, can be dot like to a nested key.
   *   An object of key/value pairs.
   * @param {*} [value]
   *   (optional) A value to set for key.
   *
   * @returns {*}
   *   - Returns nothing if key is an object or both key and value parameters
   *   were provided to set an option.
   *   - Returns the a value for a specific setting if key was provided.
   *   - Returns an object of key/value pairs of all the options if no key or
   *   value parameter was provided.
   *
   * @see https://github.com/jquery/jquery-ui/blob/master/ui/widget.js
   */
  Bootstrap.option = function (key, value) {
    var options = $.isPlainObject(key) ? $.extend({}, key) : {};

    // Get all options (clone so it doesn't reference the internal object).
    if (arguments.length === 0) {
      return $.extend({}, this.options);
    }

    // Get/set single option.
    if (typeof key === "string") {
      // Handle nested keys in dot notation.
      // e.g., "foo.bar" => { foo: { bar: true } }
      var parts = key.split('.');
      key = parts.shift();
      var obj = options;
      if (parts.length) {
        for (var i = 0; i < parts.length - 1; i++) {
          obj[parts[i]] = obj[parts[i]] || {};
          obj = obj[parts[i]];
        }
        key = parts.pop();
      }

      // Get.
      if (arguments.length === 1) {
        return obj[key] === void 0 ? null : obj[key];
      }

      // Set.
      obj[key] = value;
    }

    // Set multiple options.
    $.extend(true, this.options, options);
  };

  /**
   * Adds a ".noConflict()" helper method if needed.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} plugin
   * @param {Function} plugin
   *   A constructor function used to initialize the for the jQuery plugin.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.pluginNoConflict = function (id, plugin, noConflict) {
    if (plugin.noConflict === void 0 && (noConflict === void 0 || noConflict)) {
      var old = $.fn[id];
      plugin.noConflict = function () {
        $.fn[id] = old;
        return this;
      };
    }
  };

  /**
   * Creates a handler that relays to another event name.
   *
   * @param {HTMLElement|jQuery} target
   *   A target element.
   * @param {String} name
   *   The name of the event to trigger.
   * @param {Boolean} [stopPropagation=true]
   *   Flag indicating whether to stop the propagation of the event, defaults
   *   to true.
   *
   * @return {Function}
   *   An even handler callback function.
   */
  Bootstrap.relayEvent = function (target, name, stopPropagation) {
    return function (e) {
      if (stopPropagation === void 0 || stopPropagation) {
        e.stopPropagation();
      }
      var $target = $(target);
      var parts = name.split('.').filter(Boolean);
      var type = parts.shift();
      e.target = $target[0];
      e.currentTarget = $target[0];
      e.namespace = parts.join('.');
      e.type = type;
      $target.trigger(e);
    };
  };

  /**
   * Replaces a Bootstrap jQuery plugin definition.
   *
   * @param {String} id
   *   A jQuery plugin identifier located in $.fn.
   * @param {Function} callback
   *   A callback function that is immediately invoked and must return a
   *   function that will be used as the plugin constructor.
   * @param {Boolean} [noConflict]
   *   Flag indicating whether or not to create a ".noConflict()" helper method
   *   for the plugin.
   */
  Bootstrap.replacePlugin = function (id, callback, noConflict) {
    // Immediately return if plugin doesn't exist.
    if (typeof $.fn[id] !== 'function') {
      return this.fatal('Specified jQuery plugin identifier does not exist: @id', {'@id':  id});
    }

    // Immediately return if callback isn't a function.
    if (typeof callback !== 'function') {
      return this.fatal('You must provide a valid callback function to replace a jQuery plugin: @callback', {'@callback': callback});
    }

    // Determine existing plugin constructor.
    var constructor = $.fn[id] && $.fn[id].Constructor || $.fn[id];
    var plugin = callback.apply(constructor, [this.settings]);

    // Immediately return if plugin isn't a function.
    if (typeof plugin !== 'function') {
      return this.fatal('Returned value from callback is not a usable function to replace a jQuery plugin "@id": @plugin', {'@id': id, '@plugin': plugin});
    }

    this.wrapPluginConstructor(constructor, plugin);

    // Add a ".noConflict()" helper method.
    this.pluginNoConflict(id, plugin, noConflict);

    $.fn[id] = plugin;
  };

  /**
   * Simulates a native event on an element in the browser.
   *
   * Note: This is a fairly complete modern implementation. If things aren't
   * working quite the way you intend (in older browsers), you may wish to use
   * the jQuery.simulate plugin. If it's available, this method will defer to
   * that plugin.
   *
   * @see https://github.com/jquery/jquery-simulate
   *
   * @param {HTMLElement|jQuery} element
   *   A DOM element to dispatch event on. Note: this may be a jQuery object,
   *   however be aware that this will trigger the same event for each element
   *   inside the jQuery collection; use with caution.
   * @param {String|String[]} type
   *   The type(s) of event to simulate.
   * @param {Object} [options]
   *   An object of options to pass to the event constructor. Typically, if
   *   an event is being proxied, you should just pass the original event
   *   object here. This allows, if the browser supports it, to be a truly
   *   simulated event.
   *
   * @return {Boolean}
   *   The return value is false if event is cancelable and at least one of the
   *   event handlers which handled this event called Event.preventDefault().
   *   Otherwise it returns true.
   */
  Bootstrap.simulate = function (element, type, options) {
    // Handle jQuery object wrappers so it triggers on each element.
    var ret = true;
    if (element instanceof $) {
      element.each(function () {
        if (!Bootstrap.simulate(this, type, options)) {
          ret = false;
        }
      });
      return ret;
    }

    if (!(element instanceof HTMLElement)) {
      this.fatal('Passed element must be an instance of HTMLElement, got "@type" instead.', {
        '@type': typeof element,
      });
    }

    // Defer to the jQuery.simulate plugin, if it's available.
    if (typeof $.simulate === 'function') {
      new $.simulate(element, type, options);
      return true;
    }

    var event;
    var ctor;
    var types = [].concat(type);
    for (var i = 0, l = types.length; i < l; i++) {
      type = types[i];
      for (var name in this.eventMap) {
        if (this.eventMap[name].test(type)) {
          ctor = name;
          break;
        }
      }
      if (!ctor) {
        throw new SyntaxError('Only rudimentary HTMLEvents, KeyboardEvents and MouseEvents are supported: ' + type);
      }
      var opts = {bubbles: true, cancelable: true};
      if (ctor === 'KeyboardEvent' || ctor === 'MouseEvent') {
        $.extend(opts, {ctrlKey: !1, altKey: !1, shiftKey: !1, metaKey: !1});
      }
      if (ctor === 'MouseEvent') {
        $.extend(opts, {button: 0, pointerX: 0, pointerY: 0, view: window});
      }
      if (options) {
        $.extend(opts, options);
      }
      if (typeof window[ctor] === 'function') {
        event = new window[ctor](type, opts);
        if (!element.dispatchEvent(event)) {
          ret = false;
        }
      }
      else if (document.createEvent) {
        event = document.createEvent(ctor);
        event.initEvent(type, opts.bubbles, opts.cancelable);
        if (!element.dispatchEvent(event)) {
          ret = false;
        }
      }
      else if (typeof element.fireEvent === 'function') {
        event = $.extend(document.createEventObject(), opts);
        if (!element.fireEvent('on' + type, event)) {
          ret = false;
        }
      }
      else if (typeof element[type]) {
        element[type]();
      }
    }
    return ret;
  };

  /**
   * Strips HTML and returns just text.
   *
   * @param {String|Element|jQuery} html
   *   A string of HTML content, an Element DOM object or a jQuery object.
   *
   * @return {String}
   *   The text without HTML tags.
   *
   * @todo Replace with http://locutus.io/php/strings/strip_tags/
   */
  Bootstrap.stripHtml = function (html) {
    if (html instanceof $) {
      html = html.html();
    }
    else if (html instanceof Element) {
      html = html.innerHTML;
    }
    var tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').replace(/^[\s\n\t]*|[\s\n\t]*$/, '');
  };

  /**
   * Provide a helper method for displaying when something is unsupported.
   *
   * @param {String} type
   *   The type of unsupported object, e.g. method or option.
   * @param {String} name
   *   The name of the unsupported object.
   * @param {*} [value]
   *   The value of the unsupported object.
   */
  Bootstrap.unsupported = function (type, name, value) {
    Bootstrap.warn('Unsupported by Drupal Bootstrap: (@type) @name -> @value', {
      '@type': type,
      '@name': name,
      '@value': typeof value === 'object' ? JSON.stringify(value) : value
    });
  };

  /**
   * Provide a helper method to display a warning.
   *
   * @param {String} message
   *   The message to display.
   * @param {Object} [args]
   *   Arguments to use as replacements in Drupal.formatString.
   */
  Bootstrap.warn = function (message, args) {
    if (this.settings.dev && console.warn) {
      console.warn(Drupal.formatString(message, args));
    }
  };

  /**
   * Wraps a plugin with common functionality.
   *
   * @param {Function} constructor
   *   A plugin constructor being wrapped.
   * @param {Object|Function} plugin
   *   The plugin being wrapped.
   * @param {Boolean} [extend = false]
   *   Whether to add super extensibility.
   */
  Bootstrap.wrapPluginConstructor = function (constructor, plugin, extend) {
    var proto = constructor.prototype;

    // Add a jQuery UI like option getter/setter method.
    var option = this.option;
    if (proto.option === void(0)) {
      proto.option = function () {
        return option.apply(this, arguments);
      };
    }

    if (extend) {
      // Handle prototype properties separately.
      if (plugin.prototype !== void 0) {
        for (var key in plugin.prototype) {
          if (!plugin.prototype.hasOwnProperty(key)) continue;
          var value = plugin.prototype[key];
          if (typeof value === 'function') {
            proto[key] = this.superWrapper(proto[key] || function () {}, value);
          }
          else {
            proto[key] = $.isPlainObject(value) ? $.extend(true, {}, proto[key], value) : value;
          }
        }
      }
      delete plugin.prototype;

      // Handle static properties.
      for (key in plugin) {
        if (!plugin.hasOwnProperty(key)) continue;
        value = plugin[key];
        if (typeof value === 'function') {
          constructor[key] = this.superWrapper(constructor[key] || function () {}, value);
        }
        else {
          constructor[key] = $.isPlainObject(value) ? $.extend(true, {}, constructor[key], value) : value;
        }
      }
    }
  };

  // Add Bootstrap to the global Drupal object.
  Drupal.bootstrap = Drupal.bootstrap || Bootstrap;

})(window._, window.jQuery, window.Drupal, window.drupalSettings);
;
(function ($, _) {

  /**
   * @class Attributes
   *
   * Modifies attributes.
   *
   * @param {Object|Attributes} attributes
   *   An object to initialize attributes with.
   */
  var Attributes = function (attributes) {
    this.data = {};
    this.data['class'] = [];
    this.merge(attributes);
  };

  /**
   * Renders the attributes object as a string to inject into an HTML element.
   *
   * @return {String}
   *   A rendered string suitable for inclusion in HTML markup.
   */
  Attributes.prototype.toString = function () {
    var output = '';
    var name, value;
    var checkPlain = function (str) {
      return str && str.toString().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '';
    };
    var data = this.getData();
    for (name in data) {
      if (!data.hasOwnProperty(name)) continue;
      value = data[name];
      if (_.isFunction(value)) value = value();
      if (_.isObject(value)) value = _.values(value);
      if (_.isArray(value)) value = value.join(' ');
      output += ' ' + checkPlain(name) + '="' + checkPlain(value) + '"';
    }
    return output;
  };

  /**
   * Renders the Attributes object as a plain object.
   *
   * @return {Object}
   *   A plain object suitable for inclusion in DOM elements.
   */
  Attributes.prototype.toPlainObject = function () {
    var object = {};
    var name, value;
    var data = this.getData();
    for (name in data) {
      if (!data.hasOwnProperty(name)) continue;
      value = data[name];
      if (_.isFunction(value)) value = value();
      if (_.isObject(value)) value = _.values(value);
      if (_.isArray(value)) value = value.join(' ');
      object[name] = value;
    }
    return object;
  };

  /**
   * Add class(es) to the array.
   *
   * @param {string|Array} value
   *   An individual class or an array of classes to add.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.addClass = function (value) {
    var args = Array.prototype.slice.call(arguments);
    this.data['class'] = this.sanitizeClasses(this.data['class'].concat(args));
    return this;
  };

  /**
   * Returns whether the requested attribute exists.
   *
   * @param {string} name
   *   An attribute name to check.
   *
   * @return {boolean}
   *   TRUE or FALSE
   */
  Attributes.prototype.exists = function (name) {
    return this.data[name] !== void(0) && this.data[name] !== null;
  };

  /**
   * Retrieve a specific attribute from the array.
   *
   * @param {string} name
   *   The specific attribute to retrieve.
   * @param {*} defaultValue
   *   (optional) The default value to set if the attribute does not exist.
   *
   * @return {*}
   *   A specific attribute value, passed by reference.
   */
  Attributes.prototype.get = function (name, defaultValue) {
    if (!this.exists(name)) this.data[name] = defaultValue;
    return this.data[name];
  };

  /**
   * Retrieves a cloned copy of the internal attributes data object.
   *
   * @return {Object}
   */
  Attributes.prototype.getData = function () {
    return _.extend({}, this.data);
  };

  /**
   * Retrieves classes from the array.
   *
   * @return {Array}
   *   The classes array.
   */
  Attributes.prototype.getClasses = function () {
    return this.get('class', []);
  };

  /**
   * Indicates whether a class is present in the array.
   *
   * @param {string|Array} className
   *   The class(es) to search for.
   *
   * @return {boolean}
   *   TRUE or FALSE
   */
  Attributes.prototype.hasClass = function (className) {
    className = this.sanitizeClasses(Array.prototype.slice.call(arguments));
    var classes = this.getClasses();
    for (var i = 0, l = className.length; i < l; i++) {
      // If one of the classes fails, immediately return false.
      if (_.indexOf(classes, className[i]) === -1) {
        return false;
      }
    }
    return true;
  };

  /**
   * Merges multiple values into the array.
   *
   * @param {Attributes|Node|jQuery|Object} object
   *   An Attributes object with existing data, a Node DOM element, a jQuery
   *   instance or a plain object where the key is the attribute name and the
   *   value is the attribute value.
   * @param {boolean} [recursive]
   *   Flag determining whether or not to recursively merge key/value pairs.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.merge = function (object, recursive) {
    // Immediately return if there is nothing to merge.
    if (!object) {
      return this;
    }

    // Get attributes from a jQuery element.
    if (object instanceof $) {
      object = object[0];
    }

    // Get attributes from a DOM element.
    if (object instanceof Node) {
      object = Array.prototype.slice.call(object.attributes).reduce(function (attributes, attribute) {
        attributes[attribute.name] = attribute.value;
        return attributes;
      }, {});
    }
    // Get attributes from an Attributes instance.
    else if (object instanceof Attributes) {
      object = object.getData();
    }
    // Otherwise, clone the object.
    else {
      object = _.extend({}, object);
    }

    // By this point, there should be a valid plain object.
    if (!$.isPlainObject(object)) {
      setTimeout(function () {
        throw new Error('Passed object is not supported: ' + object);
      });
      return this;
    }

    // Handle classes separately.
    if (object && object['class'] !== void 0) {
      this.addClass(object['class']);
      delete object['class'];
    }

    if (recursive === void 0 || recursive) {
      this.data = $.extend(true, {}, this.data, object);
    }
    else {
      this.data = $.extend({}, this.data, object);
    }

    return this;
  };

  /**
   * Removes an attribute from the array.
   *
   * @param {string} name
   *   The name of the attribute to remove.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.remove = function (name) {
    if (this.exists(name)) delete this.data[name];
    return this;
  };

  /**
   * Removes a class from the attributes array.
   *
   * @param {...string|Array} className
   *   An individual class or an array of classes to remove.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.removeClass = function (className) {
    var remove = this.sanitizeClasses(Array.prototype.slice.apply(arguments));
    this.data['class'] = _.without(this.getClasses(), remove);
    return this;
  };

  /**
   * Replaces a class in the attributes array.
   *
   * @param {string} oldValue
   *   The old class to remove.
   * @param {string} newValue
   *   The new class. It will not be added if the old class does not exist.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.replaceClass = function (oldValue, newValue) {
    var classes = this.getClasses();
    var i = _.indexOf(this.sanitizeClasses(oldValue), classes);
    if (i >= 0) {
      classes[i] = newValue;
      this.set('class', classes);
    }
    return this;
  };

  /**
   * Ensures classes are flattened into a single is an array and sanitized.
   *
   * @param {...String|Array} classes
   *   The class or classes to sanitize.
   *
   * @return {Array}
   *   A sanitized array of classes.
   */
  Attributes.prototype.sanitizeClasses = function (classes) {
    return _.chain(Array.prototype.slice.call(arguments))
      // Flatten in case there's a mix of strings and arrays.
      .flatten()

      // Split classes that may have been added with a space as a separator.
      .map(function (string) {
        return string.split(' ');
      })

      // Flatten again since it was just split into arrays.
      .flatten()

      // Filter out empty items.
      .filter()

      // Clean the class to ensure it's a valid class name.
      .map(function (value) {
        return Attributes.cleanClass(value);
      })

      // Ensure classes are unique.
      .uniq()

      // Retrieve the final value.
      .value();
  };

  /**
   * Sets an attribute on the array.
   *
   * @param {string} name
   *   The name of the attribute to set.
   * @param {*} value
   *   The value of the attribute to set.
   *
   * @return {Attributes}
   *
   * @chainable
   */
  Attributes.prototype.set = function (name, value) {
    var obj = $.isPlainObject(name) ? name : {};
    if (typeof name === 'string') {
      obj[name] = value;
    }
    return this.merge(obj);
  };

  /**
   * Prepares a string for use as a CSS identifier (element, class, or ID name).
   *
   * Note: this is essentially a direct copy from
   * \Drupal\Component\Utility\Html::cleanCssIdentifier
   *
   * @param {string} identifier
   *   The identifier to clean.
   * @param {Object} [filter]
   *   An object of string replacements to use on the identifier.
   *
   * @return {string}
   *   The cleaned identifier.
   */
  Attributes.cleanClass = function (identifier, filter) {
    filter = filter || {
      ' ': '-',
      '_': '-',
      '/': '-',
      '[': '-',
      ']': ''
    };

    identifier = identifier.toLowerCase();

    if (filter['__'] === void 0) {
      identifier = identifier.replace('__', '#DOUBLE_UNDERSCORE#');
    }

    identifier = identifier.replace(Object.keys(filter), Object.keys(filter).map(function(key) { return filter[key]; }));

    if (filter['__'] === void 0) {
      identifier = identifier.replace('#DOUBLE_UNDERSCORE#', '__');
    }

    identifier = identifier.replace(/[^\u002D\u0030-\u0039\u0041-\u005A\u005F\u0061-\u007A\u00A1-\uFFFF]/g, '');
    identifier = identifier.replace(['/^[0-9]/', '/^(-[0-9])|^(--)/'], ['_', '__']);

    return identifier;
  };

  /**
   * Creates an Attributes instance.
   *
   * @param {object|Attributes} [attributes]
   *   An object to initialize attributes with.
   *
   * @return {Attributes}
   *   An Attributes instance.
   *
   * @constructor
   */
  Attributes.create = function (attributes) {
    return new Attributes(attributes);
  };

  window.Attributes = Attributes;

})(window.jQuery, window._);
;
/**
 * @file
 * Theme hooks for the Drupal Bootstrap base theme.
 */
(function ($, Drupal, Bootstrap, Attributes) {

  /**
   * Fallback for theming an icon if the Icon API module is not installed.
   */
  if (!Drupal.icon) Drupal.icon = { bundles: {} };
  if (!Drupal.theme.icon || Drupal.theme.prototype.icon) {
    $.extend(Drupal.theme, /** @lends Drupal.theme */ {
      /**
       * Renders an icon.
       *
       * @param {string} bundle
       *   The bundle which the icon belongs to.
       * @param {string} icon
       *   The name of the icon to render.
       * @param {object|Attributes} [attributes]
       *   An object of attributes to also apply to the icon.
       *
       * @returns {string}
       */
      icon: function (bundle, icon, attributes) {
        if (!Drupal.icon.bundles[bundle]) return '';
        attributes = Attributes.create(attributes).addClass('icon').set('aria-hidden', 'true');
        icon = Drupal.icon.bundles[bundle](icon, attributes);
        return '<span' + attributes + '></span>';
      }
    });
  }

  /**
   * Callback for modifying an icon in the "bootstrap" icon bundle.
   *
   * @param {string} icon
   *   The icon being rendered.
   * @param {Attributes} attributes
   *   Attributes object for the icon.
   */
  Drupal.icon.bundles.bootstrap = function (icon, attributes) {
    attributes.addClass(['glyphicon', 'glyphicon-' + icon]);
  };

  /**
   * Add necessary theming hooks.
   */
  $.extend(Drupal.theme, /** @lends Drupal.theme */ {

    /**
     * Renders a Bootstrap AJAX glyphicon throbber.
     *
     * @returns {string}
     */
    ajaxThrobber: function () {
      return Drupal.theme('bootstrapIcon', 'refresh', {'class': ['ajax-throbber', 'glyphicon-spin'] });
    },

    /**
     * Renders a button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button. If it contains one of:
     *   - value: The label of the button.
     *   - context: The context type of Bootstrap button, can be one of:
     *     - default
     *     - primary
     *     - success
     *     - info
     *     - warning
     *     - danger
     *     - link
     *
     * @returns {string}
     */
    button: function (attributes) {
      attributes = Attributes.create(attributes).addClass('btn');
      var context = attributes.get('context', 'default');
      var label = attributes.get('value', '');
      attributes.remove('context').remove('value');
      if (!attributes.hasClass(['btn-default', 'btn-primary', 'btn-success', 'btn-info', 'btn-warning', 'btn-danger', 'btn-link'])) {
        attributes.addClass('btn-' + Bootstrap.checkPlain(context));
      }

      // Attempt to, intelligently, provide a default button "type".
      if (!attributes.exists('type')) {
        attributes.set('type', attributes.hasClass('form-submit') ? 'submit' : 'button');
      }

      return '<button' + attributes + '>' + label + '</button>';
    },

    /**
     * Alias for "button" theme hook.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    btn: function (attributes) {
      return Drupal.theme('button', attributes);
    },

    /**
     * Renders a button block element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-block': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-block'));
    },

    /**
     * Renders a large button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-lg': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-lg'));
    },

    /**
     * Renders a small button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-sm': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-sm'));
    },

    /**
     * Renders an extra small button element.
     *
     * @param {object|Attributes} attributes
     *   An object of attributes to apply to the button.
     *
     * @see Drupal.theme.button()
     *
     * @returns {string}
     */
    'btn-xs': function (attributes) {
      return Drupal.theme('button', Attributes.create(attributes).addClass('btn-xs'));
    },

    /**
     * Renders a glyphicon.
     *
     * @param {string} name
     *   The name of the glyphicon.
     * @param {object|Attributes} [attributes]
     *   An object of attributes to apply to the icon.
     *
     * @returns {string}
     */
    bootstrapIcon: function (name, attributes) {
      return Drupal.theme('icon', 'bootstrap', name, attributes);
    }

  });

})(window.jQuery, window.Drupal, window.Drupal.bootstrap, window.Attributes);
;
/*!
Jssor Slider (MIT license)
*/
/* eslint-disable */
!function(i,h,m,e,d,k,f){new(function(){});var c={u:m.PI,l:m.max,j:m.min,H:m.ceil,G:m.floor,P:m.abs,gb:m.sin,Cb:m.cos,Oe:m.tan,Xf:m.atan,Yf:m.atan2,xb:m.sqrt,B:m.pow,dd:m.random,$Round:m.round,Y:function(d,b){var a=c.B(10,b||0);return c.$Round(d*a)/a}};function r(a){return function(b){return c.$Round(b*a)/a}}var g=i.$Jease$={$Swing:function(a){return-c.Cb(a*c.u)/2+.5},$Linear:function(a){return a},$InQuad:function(a){return a*a},$OutQuad:function(a){return-a*(a-2)},$InOutQuad:function(a){return(a*=2)<1?1/2*a*a:-1/2*(--a*(a-2)-1)},$InCubic:function(a){return a*a*a},$OutCubic:function(a){return(a-=1)*a*a+1},$InOutCubic:function(a){return(a*=2)<1?1/2*a*a*a:1/2*((a-=2)*a*a+2)},$InQuart:function(a){return a*a*a*a},$OutQuart:function(a){return-((a-=1)*a*a*a-1)},$InOutQuart:function(a){return(a*=2)<1?1/2*a*a*a*a:-1/2*((a-=2)*a*a*a-2)},$InQuint:function(a){return a*a*a*a*a},$OutQuint:function(a){return(a-=1)*a*a*a*a+1},$InOutQuint:function(a){return(a*=2)<1?1/2*a*a*a*a*a:1/2*((a-=2)*a*a*a*a+2)},$InSine:function(a){return 1-c.Cb(c.u/2*a)},$OutSine:function(a){return c.gb(c.u/2*a)},$InOutSine:function(a){return-1/2*(c.Cb(c.u*a)-1)},$InExpo:function(a){return a==0?0:c.B(2,10*(a-1))},$OutExpo:function(a){return a==1?1:-c.B(2,-10*a)+1},$InOutExpo:function(a){return a==0||a==1?a:(a*=2)<1?1/2*c.B(2,10*(a-1)):1/2*(-c.B(2,-10*--a)+2)},$InCirc:function(a){return-(c.xb(1-a*a)-1)},$OutCirc:function(a){return c.xb(1-(a-=1)*a)},$InOutCirc:function(a){return(a*=2)<1?-1/2*(c.xb(1-a*a)-1):1/2*(c.xb(1-(a-=2)*a)+1)},$InElastic:function(a){if(!a||a==1)return a;var b=.3,d=.075;return-(c.B(2,10*(a-=1))*c.gb((a-d)*2*c.u/b))},$OutElastic:function(a){if(!a||a==1)return a;var b=.3,d=.075;return c.B(2,-10*a)*c.gb((a-d)*2*c.u/b)+1},$InOutElastic:function(a){if(!a||a==1)return a;var b=.45,d=.1125;return(a*=2)<1?-.5*c.B(2,10*(a-=1))*c.gb((a-d)*2*c.u/b):c.B(2,-10*(a-=1))*c.gb((a-d)*2*c.u/b)*.5+1},$InBack:function(a){var b=1.70158;return a*a*((b+1)*a-b)},$OutBack:function(a){var b=1.70158;return(a-=1)*a*((b+1)*a+b)+1},$InOutBack:function(a){var b=1.70158;return(a*=2)<1?1/2*a*a*(((b*=1.525)+1)*a-b):1/2*((a-=2)*a*(((b*=1.525)+1)*a+b)+2)},$InBounce:function(a){return 1-g.$OutBounce(1-a)},$OutBounce:function(a){return a<1/2.75?7.5625*a*a:a<2/2.75?7.5625*(a-=1.5/2.75)*a+.75:a<2.5/2.75?7.5625*(a-=2.25/2.75)*a+.9375:7.5625*(a-=2.625/2.75)*a+.984375},$InOutBounce:function(a){return a<1/2?g.$InBounce(a*2)*.5:g.$OutBounce(a*2-1)*.5+.5},$GoBack:function(a){return 1-c.P(2-1)},$InWave:function(a){return 1-c.Cb(a*c.u*2)},$OutWave:function(a){return c.gb(a*c.u*2)},$OutJump:function(a){return 1-((a*=2)<1?(a=1-a)*a*a:(a-=1)*a*a)},$InJump:function(a){return(a*=2)<1?a*a*a:(a=2-a)*a*a},$Early:c.H,$Late:c.G,$Mid:c.$Round,$Mid2:r(2),$Mid3:r(3),$Mid4:r(4),$Mid5:r(5),$Mid6:r(6)};function v(k,l,p){var d=this,f=[1,0,0,0,0,1,0,0,0,0,1,0,k||0,l||0,p||0,1],j=c.gb,i=c.Cb,n=c.Oe;function h(a){return a*c.u/180}function o(b,c,f,g,i,l,n,o,q,t,u,w,y,A,C,F,a,d,e,h,j,k,m,p,r,s,v,x,z,B,D,E){return[b*a+c*j+f*r+g*z,b*d+c*k+f*s+g*B,b*e+c*m+f*v+g*D,b*h+c*p+f*x+g*E,i*a+l*j+n*r+o*z,i*d+l*k+n*s+o*B,i*e+l*m+n*v+o*D,i*h+l*p+n*x+o*E,q*a+t*j+u*r+w*z,q*d+t*k+u*s+w*B,q*e+t*m+u*v+w*D,q*h+t*p+u*x+w*E,y*a+A*j+C*r+F*z,y*d+A*k+C*s+F*B,y*e+A*m+C*v+F*D,y*h+A*p+C*x+F*E]}function g(b,a){return o.apply(e,(a||f).concat(b))}d.$Scale=function(a,b,c){if(a!=1||b!=1||c!=1)f=g([a,0,0,0,0,b,0,0,0,0,c,0,0,0,0,1])};d.$Move=function(a,b,c){f[12]+=a||0;f[13]+=b||0;f[14]+=c||0};d.$RotateX=function(b){if(b){a=h(b);var c=i(a),d=j(a);f=g([1,0,0,0,0,c,d,0,0,-d,c,0,0,0,0,1])}};d.$RotateY=function(b){if(b){a=h(b);var c=i(a),d=j(a);f=g([c,0,-d,0,0,1,0,0,d,0,c,0,0,0,0,1])}};d.Cg=function(a){d.Vg(h(a))};d.Vg=function(a){if(a){var b=i(a),c=j(a);f=g([b,c,0,0,-c,b,0,0,0,0,1,0,0,0,0,1])}};d.Ug=function(a,b){if(a||b){k=h(a);l=h(b);f=g([1,n(l),0,0,n(k),1,0,0,0,0,1,0,0,0,0,1])}};d.Sg=function(){return"matrix3d("+f.join(",")+")"};d.Og=function(){return"matrix("+[f[0],f[1],f[4],f[5],f[12],f[13]].join(",")+")"}}var b=i.$Jssor$=new function(){var a=this,Eb=/\S+/g,R=1,mb=2,qb=3,pb=4,tb=5,T,t=0,n=0,I=0,M=navigator,Ab=M.appName,o=M.userAgent,r=parseFloat;function w(c,a,b){return c.indexOf(a,b)}function Qb(){if(!T){T={td:"ontouchstart"in i||"createTouch"in h};var a;if(M.pointerEnabled||(a=M.msPointerEnabled))T.re=a?"msTouchAction":"touchAction"}return T}function y(g){if(!t){t=-1;if(Ab=="Microsoft Internet Explorer"&&!!i.attachEvent&&!!i.ActiveXObject){var e=w(o,"MSIE");t=R;n=r(o.substring(e+5,w(o,";",e)))}else if(Ab=="Netscape"&&!!i.addEventListener){var d=w(o,"Firefox"),b=w(o,"Safari"),f=w(o,"Chrome"),c=w(o,"AppleWebKit");if(d>=0){t=mb;n=r(o.substring(d+8))}else if(b>=0){var h=o.substring(0,b).lastIndexOf("/");t=f>=0?pb:qb;n=r(o.substring(h+1,b))}else{var a=/Trident\/.*rv:([0-9]{1,}[\.0-9]{0,})/i.exec(o);if(a){t=R;n=r(a[1])}}if(c>=0)I=r(o.substring(c+12))}else{var a=/(opera)(?:.*version|)[ \/]([\w.]+)/i.exec(o);if(a){t=tb;n=r(a[2])}}}return g==t}function F(){return y(R)}function ob(){return y(qb)}function sb(){return y(tb)}function B(){y();return I>537||n>42||t==R&&n>=11}function U(a){var b;return function(d){if(!b){var c=a.substr(0,1).toUpperCase()+a.substr(1);b=j(["","WebKit","ms","Moz","O","webkit"],function(b){var e=b+(b?c:a);return d.style[e]!=f&&e})||a}return b}}var O=l("transform",8);function J(a){return a}function P(a){return i.SVGElement&&a instanceof i.SVGElement}function Ob(a){return{}.toString.call(a)}var S=Array.isArray||function(a){return N(a)=="array"},wb={};j(["Boolean","Number","String","Function","Array","Date","RegExp","Object"],function(a){wb["[object "+a+"]"]=a.toLowerCase()});function j(b,d){var a,c;if(S(b)){for(a=0;a<m(b);a++)if(c=d(b[a],a,b))return c}else for(a in b)if(c=d(b[a],a,b))return c}function N(a){return a==e?String(a):wb[Ob(a)]||"object"}function Z(a){for(var b in a)return d}function D(a){try{return N(a)=="object"&&!a.nodeType&&a!=a.window&&(!a.constructor||{}.hasOwnProperty.call(a.constructor.prototype,"isPrototypeOf"))}catch(b){}}function Db(a,b){return{x:a,y:b}}function Rb(b,a){setTimeout(b,a||0)}function q(a,b){return a===f?b:a}a.ud=Qb;a.ue=F;a.He=ob;a.gg=B;a.Cd=function(){return n};a.$Delay=Rb;a.wc=q;a.W=function(a,b){b.call(a);return x({},a)};function bb(a){a.constructor===bb.caller&&a.F&&a.F.apply(a,bb.caller.arguments)}a.F=bb;a.$GetElement=function(b){if(a.ag(b))b=h.getElementById(b);return b};a.xc=function(c){var b=[];j(c,function(d){var c=a.$GetElement(d);c&&b.push(c)});return b};function u(a){return a||i.event}a.Zf=u;a.$EvtSrc=function(c){c=u(c);var b=c.target||c.srcElement||h;if(b.nodeType==3)b=a.Lb(b);return b};a.Fe=function(a){a=u(a);return a.relatedTarget||a.toElement};a.Je=function(a){a=u(a);return a.which||([0,1,3,0,2])[a.button]||a.charCode||a.keyCode};a.Tc=function(a){a=u(a);return{x:a.clientX||0,y:a.clientY||0}};a.Ue=function(a,b){return Db(a.x-b.x,a.y-b.y)};a.eg=function(a,b){return a.x>=b.x&&a.x<=b.t&&a.y>=b.y&&a.y<=b.m};a.Ie=function(d,f){var c=b.dg(f),e=b.Tc(d);return a.eg(e,c)};a.Ib=function(b){return P(a.Lb(b))};function A(c,d,a){if(a!==f)c.style[d]=a==f?"":a;else{var b=c.currentStyle||c.style;a=b[d];if(a==""&&i.getComputedStyle){b=c.ownerDocument.defaultView.getComputedStyle(c,e);b&&(a=b.getPropertyValue(d)||b[d])}return a}}function fb(b,c,a,d){if(a===f){a=r(A(b,c));isNaN(a)&&(a=e);return a}d&&a!=e&&(a+=d);A(b,c,a)}function l(g,a,b,d){var c;if(a&2)c="px";if(a&4)c="%";if(a&16)c="em";var f=a&8&&U(g);a&=-9;d=d||(a?fb:A);return function(i,h){b&&h&&(h*=b);var a=d(i,f?f(i):g,h,c);return b&&a!=e?a/b:a}}function C(a){return function(c,b){s(c,a,b)}}var hb={r:["rotate"],sX:["scaleX",2],sY:["scaleY",2],tX:["translateX",1],tY:["translateY",1],kX:["skewX"],kY:["skewY"]};function jb(a){var b="";if(a){j(a,function(d,c){var a=hb[c];if(a){var e=a[1]||0;if(ib[c]!=d)b+=" "+a[0]+"("+d+(["deg","px",""])[e]+")"}});if(B())if(a.tX||a.tY||a.tZ!=f)b+=" translate3d("+(a.tX||0)+"px,"+(a.tY||0)+"px,"+(a.tZ||0)+"px)"}return b}function nb(a){return"rect("+a.y+"px "+a.t+"px "+a.m+"px "+a.x+"px)"}a.ug=l("transformOrigin",8);a.tg=l("backfaceVisibility",8);a.Jc=l("transformStyle",8);a.yg=l("perspective",10);a.xg=l("perspectiveOrigin",8);a.we=function(b,a){O(b,a==1?"":"scale("+a+")")};a.$AddEvent=function(b,c,d,e){b=a.$GetElement(b);b.addEventListener(c,d,e)};a.$RemoveEvent=function(b,c,d,e){b=a.$GetElement(b);b.removeEventListener(c,d,e)};a.$CancelEvent=function(a){a=u(a);a.preventDefault&&a.preventDefault();a.cancel=d;a.returnValue=k};a.$StopEvent=function(a){a=u(a);a.stopPropagation&&a.stopPropagation();a.cancelBubble=d};a.Z=function(d,c){var a=[].slice.call(arguments,2),b=function(){var b=a.concat([].slice.call(arguments,0));return c.apply(d,b)};return b};a.bd=function(b,c){if(c==f)return b.textContent||b.innerText;var d=h.createTextNode(c);a.Rb(b);b.appendChild(d)};a.ng=function(a,b){if(b==f)return a.innerHTML;a.innerHTML=b};a.dg=function(b){var a=b.getBoundingClientRect();return{x:a.left,y:a.top,w:a.right-a.left,h:a.bottom-a.top,t:a.right,m:a.bottom}};a.jb=function(d,c){for(var b=[],a=d.firstChild;a;a=a.nextSibling)(c||a.nodeType==1)&&b.push(a);return b};function zb(a,c,f,b){b=b||"u";for(a=a?a.firstChild:e;a;a=a.nextSibling)if(a.nodeType==1){if(K(a,b)==c)return a;if(!f){var d=zb(a,c,f,b);if(d)return d}}}a.$FindChild=zb;function Y(a,d,g,b){b=b||"u";var c=[];for(a=a?a.firstChild:e;a;a=a.nextSibling)if(a.nodeType==1){K(a,b)==d&&c.push(a);if(!g){var f=Y(a,d,g,b);if(m(f))c=c.concat(f)}}return c}a.rg=function(b,a){return b.getElementsByTagName(a)};a.kb=function(a,f,d,g){d=d||"u";var e;do{if(a.nodeType==1){var c;d&&(c=K(a,d));if(c&&c==q(f,c)||g==a.tagName){e=a;break}}a=b.Lb(a)}while(a&&a!=h.body);return e};a.qe=function(a){return db(["INPUT","TEXTAREA","SELECT"])[a.tagName]};function x(){for(var d=arguments,h=1&d[0],e=1+h,g=d[e-1]||{},c,b,a;e<m(d);e++)if(c=d[e])for(b in c){a=c[b];if(a!==f){a=c[b];var i=g[b];g[b]=h&&(D(i)||D(a))?x(h,{},i,a):a}}return g}a.v=x;function cb(f,g){var d={},c,a,b;for(c in f){a=f[c];b=g[c];if(a!==b){var e=k;if(D(a)&&D(b)){a=cb(a,b);e=!Z(a)}!e&&(d[c]=a)}}return d}a.Zg=cb;a.Pd=function(a,c){if(a){var b;j(c,function(c){if(a[c]!=f)(b=b||{})[c]=a[c];delete a[c]});return b}};a.Ph=function(a){return N(a)=="function"};a.Md=S;a.ag=function(a){return N(a)=="string"};a.Nd=function(a){return!S(a)&&!isNaN(r(a))&&isFinite(a)};a.f=j;a.Th=Z;a.Sh=D;function W(a){return h.createElement(a)}a.bc=function(){return W("DIV")};a.Rd=function(){return W("SPAN")};a.Kc=function(){};function s(b,c,a,d){if(a===f)return b.getAttribute(c);a=a==e?"":d?a+d:a;b.setAttribute(c,a)}function K(a,b){return s(a,b)||s(a,"data-"+b)}a.g=s;a.hb=K;a.q=function(e,c,d){var b=a.od(K(e,c));if(isNaN(b))b=d;return b};a.Hc=function(b,c,a){return eb(s(b,c),a)};function G(b,a){return s(b,"class",a)||""}function db(b){var a={};j(b,function(b){if(b!=f)a[b]=b});return a}function eb(a,b){return a&&a.match(b||Eb)||e}function V(b,a){return db(eb(b||"",a))}a.Fd=db;a.Ud=eb;a.mg=function(a){a&&(a=a.toLowerCase());return a};function gb(b,c){var a="";j(c,function(c){a&&(a+=b);a+=c});return a}function Q(a,c,b){G(a,gb(" ",x(cb(V(G(a)),V(c)),V(b))))}a.je=gb;a.Lb=function(a){return a.parentNode};a.Fc=function(b){a.nb(b,"none")};a.mb=function(b,c){a.nb(b,q(c,d)?"":"none")};a.Oh=function(b,a){b.removeAttribute(a)};a.kh=function(b,a){b.style.clip=nb(a)};a.Tb=function(){return+new Date};a.O=function(b,a){b.appendChild(a)};a.ph=function(c,b){j(b,function(b){a.O(c,b)})};a.pb=function(b,a,c){(c||a.parentNode).insertBefore(b,a)};a.oh=function(b,a,c){b.insertAdjacentHTML(a,c)};a.ib=function(b,a){a=a||b.parentNode;a&&a.removeChild(b)};a.ch=function(b,c){j(b,function(b){a.ib(b,c)})};a.Rb=function(b){a.ch(a.jb(b,d),b)};function Bb(){j([].slice.call(arguments,0),function(b){if(a.Md(b))Bb.apply(e,b);else b&&b.$Destroy&&b.$Destroy()})}a.$Destroy=Bb;a.Uc=function(b,c){var d=a.Lb(b);if(c&1){a.U(b,(a.K(d)-a.K(b))/2);a.Vd(b,e)}if(c&2){a.V(b,(a.J(d)-a.J(b))/2);a.be(b,e)}};var X={$Top:e,$Right:e,$Bottom:e,$Left:e,Eb:e,Gb:e};a.Ch=function(b){var c=a.bc();L(c,{Me:"block",Pb:a.db(b),$Top:0,$Left:0,Eb:0,Gb:0});var e=a.ve(b,X);a.pb(c,b);a.O(c,b);var f=a.ve(b,X),d={};j(e,function(b,a){if(b==f[a])d[a]=b});L(c,X);L(c,d);L(b,{$Top:0,$Left:0});return d};a.Fh=function(b,a){return parseInt(b,a||10)};a.od=r;a.Ae=function(b,a){var c=h.body;while(a&&b!==a&&c!==a)a=a.parentNode;return b===a};function ab(e,d,c){var b=e.cloneNode(!d);!c&&a.Oh(b,"id");return b}a.ab=ab;a.Vb=function(f,g){var b=new Image;function c(f,d){a.$RemoveEvent(b,"load",c);a.$RemoveEvent(b,"abort",e);a.$RemoveEvent(b,"error",e);g&&g(b,d)}function e(a){c(a,d)}if(sb()&&n<11.6||!f)c(!f);else{a.$AddEvent(b,"load",c);a.$AddEvent(b,"abort",e);a.$AddEvent(b,"error",e);b.src=f}};a.Eh=function(g,c,f){var d=1;function e(a){d--;if(c&&a&&a.src==c.src)c=a;!d&&f&&f(c)}j(g,function(f){var c=b.hb(f,"src");if(c){d++;a.Vb(c,e)}});e()};a.Ce=function(a,g,i,h){if(h)a=ab(a);var c=Y(a,g);if(!m(c))c=b.rg(a,g);for(var f=m(c)-1;f>-1;f--){var d=c[f],e=ab(i);G(e,G(d));b.th(e,d.style.cssText);b.pb(e,d);b.ib(d)}return a};function Lb(){var c=this;b.W(c,p);var e,q="",t=["av","pv","ds","dn"],g=[],r,n=0,l=0,k=0;function m(){Q(e,r,(g[k||l&2||l]||"")+" "+(g[n]||""));a.lc(e,k?"none":"")}function d(){n=0;c.T(i,"mouseup",d);c.T(h,"mouseup",d);c.T(h,"touchend",d);c.T(h,"touchcancel",d);c.T(i,"blur",d);m()}function o(){n=4;m();c.a(i,"mouseup",d);c.a(h,"mouseup",d);c.a(h,"touchend",d);c.a(h,"touchcancel",d);c.a(i,"blur",d)}c.Ye=function(a){if(a===f)return l;l=a&2||a&1;m()};c.$Enable=function(a){if(a===f)return!k;k=a?0:3;m()};c.F=function(f){c.$Elmt=e=a.$GetElement(f);s(e,"data-jssor-button","1");var d=b.Ud(G(e));if(d)q=d.shift();j(t,function(a){g.push(q+a)});r=gb(" ",g);g.unshift("");c.a(e,"mousedown",o);c.a(e,"touchstart",o)};b.F(c)}a.Lc=function(a){return new Lb(a)};a.xh=function(a,b){return c.xb(a*a+b*b)};a.R=A;l("backgroundColor");a.Fb=l("overflow");a.lc=l("pointerEvents");a.V=l("top",2);a.U=l("left",2);a.cb=l("opacity",1);a.N=l("zIndex",1);function yb(m,n,a,k,b,g,f){if(b){var h=b[0],d=b[1];if(f){var e=c.l(d*2,1),l=e*(f-1)+1;a=(a*l-h)/e;if(a>0){d/=e;h=0;var j=c.H(a)-1;a=a-j;if(a>d&&j<f-1)a=1-a}}a=(a-h)/d;a=c.j(c.l(a,0),1)}if(g){a=a*g;var i=c.G(a);a-i&&(a-=i);a=c.j(c.l(a,0),1)}if(b||g)a=c.Y(a,3);return m+n*k(a)}function kb(d,e,h,i){d=d||{};var g={},b={};function n(a){b[a]=d[a]}function l(){b.cc=d.x;h&&!e&&(b.cc-=h)}function m(){b.Wb=d.y;i&&!e&&(b.Wb-=i)}var k={cc:0,Wb:0,sX:1,sY:1,r:0,rX:0,rY:0,tX:0,tY:0,tZ:0,kX:0,kY:0},c={};if(!B()||e){c.tZ=a.Kc;c.tX=a.Kc;c.tY=a.Kc}if(B()||e){c.x=l;c.y=m}j(d,function(b,a){(c[a]||n)(a)});j(b,function(c,a){if(k[a]!=f){g[a]=c;delete b[a]}});Z(g)&&(b.Kd=g);return b}function vb(f,e){var b=[],h=e&1;e&2&&(h=!h);for(var k=c.H(f/2),a=0;a<f;a++){var d=a;if(e&4){var g=c.G(c.dd()*f);d=q(b[a],a);b[a]=q(b[g],g);b[g]=d}else{if(e&2){d=a<k?a*2:(f-a-1)*2+1;b[d]=a}if(e&32)d=c.G(a/2)+(a%2?c.H(k):0);b[d]=a}}h&&b.reverse();var i=[];j(b,function(b,a){i[b]=a});return i}function xb(b,h,e,d){for(var g=[],i=e?c.H((b+d)/2):b,f=1/(h*(i-1)+1),a=0;a<b;a++){var j=e?c.G((a+d)/2):a;g[a]=[j*h*f,f]}return g}function Jb(h,u,e){h=h||{d:e.$Elmt?s(e.$Elmt,"d"):""};var E=e.$Easing,k=e.Bd||{},g=k.r,z=g==0,F=k.dl||0;function x(c,a){var d=c[0],o=c[1],e=c[2],p=c[3],g=c[4],q=c[5],h=c[6],r=c[7];if(a===f)a=.5;var b=1-a,i=b*d+a*e,s=b*o+a*p,j=b*e+a*g,t=b*p+a*q,k=b*g+a*h,u=b*q+a*r,l=b*i+a*j,v=b*s+a*t,m=b*j+a*k,w=b*t+a*u,n=b*l+a*m,x=b*v+a*w;return[[d,o,i,s,l,v,n,x],[n,x,m,w,k,u,h,r]]}function w(c,g){for(var d=0,e=0,a=0,b=g?6:0;b<m(c);b+=6){d+=c[b];e+=c[b+1];a++}return{x:a?d/a:f,y:a?e/a:f}}function b(b){var l=m(b),j=b[0]==b[l-2]&&b[1]==b[l-1],g=w(b,j),k=[],h=[];function e(a){return{x:b[a],y:b[a+1]}}function f(j,f,b){var d=a.Ue(j,f);h[b]=a.xh(d.x,d.y);if(!h[b]&&b%6){var g=b%6<3?2:-2;d=a.Ue(e(b+g),f)}var i=c.Yf(d.y,d.x);k[b]=i}for(var d=0;d<m(b);d+=6){var i=e(d);f(i,g,d);f(e(d-2),i,d-2);f(e(d+2),i,d+2)}return{lb:b,qb:(m(b)-2)/6,kc:g.x,ic:g.y,Nc:k,Vc:h,vc:j}}function n(o){function i(a){return a.replace(/[\^\s]*([mhvlzcsqta]|\-?\d*\.?\d+)[,\$\s]*/gi," $1").replace(/([mhvlzcsqta])/gi," $1").trim().split("  ").map(l)}function l(a){return a.split(" ").map(k)}function k(a,b){return b===0?a:+a}var h=[],a,n=i(o||""),d,e,f,g;function c(b){f=b[m(b)-2];g=b[m(b)-1];a=a.concat(b)}j(n,function(i){var j=i.shift();switch(j){case"M":a&&h.push(b(a));a=[];d=i[0];e=i[1];c(i);break;case"L":c([f,g,i[0],i[1],i[0],i[1]]);break;case"C":c(i);break;case"Z":case"z":(f!=d||g!=e)&&c([f,g,d,e,d,e])}});a&&h.push(b(a));return h}function d(a,b){return c.Y(a,2)+","+c.Y(b,2)}function A(a){for(var c="M"+d(a[0],a[1]),b=2;b<m(a)-2;b+=6){c+="C";c+=d(a[b],a[b+1])+" ";c+=d(a[b+2],a[b+3])+" ";c+=d(a[b+4],a[b+5])}return c}function y(b){var a="";j(b,function(b){a+=A(b)});return a}function D(d){for(var c=[],a=0;a<m(d)-2;a+=6)c.push(b(d.slice(a,a+8)));return c}function B(c){var a=[];j(c,function(c,d){var b=c.lb;!d&&a.push(b[0],b[1]);a=a.concat(b.slice(2))});return b(a)}function l(d,a){var p=a.gf=[],q=a.bf=[],e=a.qb+(!d.vc||!d.vc);function n(b){return a.Nc[b]-d.Nc[b]}function h(b,a){a=a||0;return c.Y((b-a+c.u*101)%(c.u*2)-c.u+a,8)}function i(b,f){var e=d.Vc[b],g=a.Vc[b],i=g-e,c=n(b);c=h(c,f);p[b]=i;q[b]=c;return c}for(var l=0,b=0;b<e;b++)l+=h(n(b*6));var f=h(l/e);if(g){var j=g>0?1:-1;f=(f+c.u*2*j)%(c.u*2)||c.u*2*j;f+=c.u*2*(g-j)}for(var b=0;b<m(d.lb);b+=6){var o=i(b,f);i(b-2,o);i(b+2,o)}var s=xb(e,F),r=vb(e,k.o);a.ad=function(b,c){if(b>=0&&b<=a.qb)return yb(0,1,c,E,s[r[b%e]])}}function t(d,a,s,n,i){function q(d){for(var a=[0,.2,0,.09,.09,0,.2,0,.31,0,.4,.09,.4,.2,.4,.31,.31,.4,.2,.4,.09,.4,0,.31,0,.2],c=0;c<m(a);c+=2){a[c]+=d.kc-.2;a[c+1]+=d.ic-.2}var e=b(a);e.vc=d.vc;return e}d=s[i]=d||q(a);a=n[i]=a||q(d);var h=d.qb,g=a&&a.qb;if(h<g)return t(a,d,n,s,i);if(g<h){for(var r=D(a.lb),u=h/g,o=h-g,f=0,p=0;p<10&&f<o;p++){var v=u+u*p/10,e=0;j(r,function(d,g){e+=d.qb;var b=c.$Round((g+1)*v);if(e<b){var a=c.j(b-e,o-f);d.qb+=a;f+=a;e+=a}return o<f})}var k=[];j(r,function(d){var a=d.qb,c=d.lb;while(a-1){var e=x(c,1/a);k.push(b(e[0]));c=e[1];a--}k.push(b(c))});a=n[i]=B(k)}l(d,a);l(a,d)}function r(b,a){if(m(b)<m(a))return r(a,b);j(b,function(d,c){t(d,a[c],b,a,c)})}var o=n(h.d),p=n(u.d);r(o,p);function i(b,h,i,e,a,l){var d=b.lb;if(a>=0&&a<m(b.lb)){var k=h.lb,f,g;if(z){f=d[a]+(k[a]-d[a])*e;g=d[a+1]+(k[a+1]-d[a+1])*e}else{var o=b.Vc[a],p=h.gf[a],q=b.Nc[a],r=h.bf[a],j=o+p*e,n=q+r*e;f=j*c.Cb(n)+i.x;g=j*c.gb(n)+i.y}l[a]=f;l[a+1]=g;return{x:f,y:g}}}var v={E:function(a){if(!a)return h;if(a==1)return u;var b=[];j(o,function(c,n){for(var g=[],d=p[n],e=0;e<m(c.lb);e+=6){var f=d.ad(e/6,a),l=q(d.ad(e/6-1,a),f),k=q(d.ad(e/6+1,a),f),j={x:c.kc+(d.kc-c.kc)*f,y:c.ic+(d.ic-c.ic)*f},h=i(c,d,j,f,e,g);i(c,d,h,(f+l)/2,e-2,g);i(c,d,h,(f+k)/2,e+2,g)}b.push(g)});return{d:y(b)}},X:function(a){return a&&a.d||""},sb:C("d")};return v}function Hb(b){return x({wc:a.Ph(b)?b:g.$Linear},b)}function z(i,u,h,M,o){i=i||{};h=x({},h);var ab=h.$Elmt,p={},W={},w,y,r=h.le,P=h.Ib,F=k(Hb(h.$Easing)),V=k(h.Bd),X=k(h.$During),Z=k(h.$Round),Y=k(h.Pc,E),G=S(u);i=k(i,f,d);u=k(u,f,d);var U=B(),K=o?{c:R,Kd:L,pt:Jb,bl:Q,da:H,fc:n(C("fill"),[0,0,0,1]),sc:n(C("stroke")),cl:n(l("color"),[0,0,0,1]),bgc:n(l("backgroundColor")),bdc:n(l("borderColor")),rp:N}:{},s=h.Yc||o&&{o:4,so:4,Kd:4,ls:4,lh:4,sX:4,sY:4};function T(c){var d=V[c]||{};return b.v({},h,{$Easing:F[c]||F.wc||e,Pc:Y[c]||e,Bd:d,$During:X[c]||e,$Round:Z[c]||e,Mf:d.rd,Yc:a.Nd(s)?s:s&&s[c],le:0})}function t(a){return m(a)%2?a.concat(a):a}function k(a,c,b){a=M?kb(a,P,b&&h.Lf,b&&h.Of):a||{};return o?x({},c,a):a}function n(f,d){function c(a){return a=="transparent"?e:a||d}function a(a,b){a=c(a);b=c(b);if(!a&&b){a=b.slice(0);a[3]=0}return a||[0,0,0,0]}return function(c,d,g){d=a(d,c);c=a(c,d);var e=z(c,d,b.v({Yc:[0,0,0,4]},g));return{E:function(a){return e.E(a)},X:function(a){return"rgba("+a.join(",")+")"},sb:f}}}function I(b,k,a){b=b||0;var f=a.$Easing||g.$Linear,e=a.$During,i=a.$Round,h=a.Mf,j=k-b,d=q(a.Yc,2);return{E:function(a){return c.Y(yb(b,j,a,f,e,i,h),d)},X:J,sb:a.Pc}}function A(c,d,a,b){return{E:z(c,d,a).E,X:function(a){return a.join(",")},sb:b}}function Q(b,c,a){return A(t(b||[0]),t(c),a,C("stdDeviation"))}function H(a,c,h){var e=m(c);c=t(c);if(!a){a=c.slice(0);j(a,function(c,b){b%2&&(a[b]=0)})}a=t(a);for(var d=m(a),f,b=1;b<=d&&b<=e;b++)if(!(d%b)&&!(e%b))f=b;function g(b){var a=b;while(m(a)<d*e/f)a=a.concat(b);return a}return A(g(a),g(c),h,C("stroke-dasharray"))}function R(b,c,a){return{E:z(b,c,a).E,X:function(b){return(b.y||b.x||b.m-a.$OriginalHeight||b.t-a.$OriginalWidth)&&nb(b)||""},sb:l("clip")}}function L(e,f,c){var a=c.Nf,b;function d(b){var d=(b.rX||0)%360,e=(b.rY||0)%360,f=(b.r||0)%360,g=q(b.sX,1),h=q(b.sY,1),i=q(b.sZ,1),c=new v(b.tX,b.tY,b.tZ||0);a&&c.$Move(-a.x,-a.y);c.$Scale(g,h,i);c.Ug(b.kX,b.kY);c.$RotateX(d);c.$RotateY(e);c.Cg(f);a&&c.$Move(a.x,a.y);c.$Move(b.cc,b.Wb);return c}if(c.Ib){y=C("transform");b=function(a){return d(a).Og()}}else{y=O;if(U)b=function(a){return d(a).Sg()};else b=jb}return{E:z(e,f,c).E,sb:y,X:b||J}}function N(){var b=1e-5;return{E:J,X:J,sb:function(d){b*=-1;a.cb(d,c.Y(a.cb(d),4)+b)}}}j(u,function(b,a){var c=i&&i[a]||0;if(G||b!==c){var d=o&&K[a]||(D(b)?z:I);p[a]=d(c,b,T(a))}});w=function(b){var a;j(p,function(c,e){var d=c.E(b);c.sb(c.$Elmt||ab,c.X(d));e=="o"&&(a=d)});return a};r&&b.f(p,function(a,e){for(var d=[],b=0;b<r+1;b++)d[b]=a.X(a.E(b/r));W[e]=d;a.E=function(a){return d[c.$Round(a*r)]};a.X=J});w.E=function(c){var a=x(d,G?[]:{},i);b.f(p,function(b,d){a[d]=b.E(c)});return a};return w}a.Kf=z;a.Zd=vb;a.K=l("width",2);a.J=l("height",2);a.Vd=l("right",2);a.be=l("bottom",2);l("marginLeft",2);l("marginTop",2);a.db=l("position");a.nb=l("display");a.th=function(a,b){if(b!=f)a.style.cssText=b;else return a.style.cssText};a.Jf=function(b,a){if(a===f){a=A(b,"backgroundImage")||"";var c=/\burl\s*\(\s*["']?([^"'\r\n,]+)["']?\s*\)/gi.exec(a)||[];return c[1]}A(b,"backgroundImage",a?"url('"+a+"')":"")};var E;a.If=E={$Opacity:a.cb,$Top:a.V,$Right:a.Vd,$Bottom:a.be,$Left:a.U,Eb:a.K,Gb:a.J,Pb:a.db,Me:a.nb,$ZIndex:a.N,o:a.cb,x:a.U,y:a.V,i:a.N,dO:l("stroke-dashoffset",1),ls:l("letterSpacing",16),lh:l("lineHeight",1),so:l("startOffset",4,100,s)};a.ve=function(c,b){var a={};j(b,function(d,b){if(E[b])a[b]=E[b](c)});return a};function L(b,a){j(a,function(c,a){E[a]&&E[a](b,c)})}a.rb=L;var ib={cc:0,Wb:0,sX:1,sY:1,r:0,rX:0,rY:0,tX:0,tY:0,tZ:0,kX:0,kY:0},Pb=[g.$Linear,g.$Swing,g.$InQuad,g.$OutQuad,g.$InOutQuad,g.$InCubic,g.$OutCubic,g.$InOutCubic,g.$InQuart,g.$OutQuart,g.$InOutQuart,g.$InQuint,g.$OutQuint,g.$InOutQuint,g.$InSine,g.$OutSine,g.$InOutSine,g.$InExpo,g.$OutExpo,g.$InOutExpo,g.$InCirc,g.$OutCirc,g.$InOutCirc,g.$InElastic,g.$OutElastic,g.$InOutElastic,g.$InBack,g.$OutBack,g.$InOutBack,g.$InBounce,g.$OutBounce,g.$InOutBounce,g.$Early,g.$Late,g.$Mid,g.$Mid2,g.$Mid3,g.$Mid4,g.$Mid5,g.$Mid6];function ub(a){var c;if(b.Nd(a))c=Pb[a];else if(b.Sh(a)){c={};j(a,function(a,b){c[b]=ub(a)})}return c||a}a.Ld=ub;function m(a){return a.length}a.A=m;a.Qd=w;a.Vf=function(k,j,n,o){b.cb(k,1);var m={o:{j:0,l:1}},e={x:0,y:0,o:1,r:0,rX:0,rY:0,sX:1,sY:1,tZ:0,kX:0,kY:0};function h(e){var a=[],c=b.jb(e,d);b.f(c,function(d){if(d.nodeType==3){for(var f=b.bd(d),e=0;e<b.A(f);e++){var g=f[e],c=b.Rd();b.nb(c,"inline-block");b.db(c,"relative");g==" "?b.ng(c,"&nbsp;"):b.bd(c,g);b.pb(c,d);a.push(c);b.cb(c,j)}b.ib(d)}else a=a.concat(h(d))});return a}function l(n){var j=this,h=b.Zd(a,4),e=b.Pd(n,["b","d","e","p","dr"])||{},g={};function i(d,g,f){var b=f?a:g,e=0;if(d.Sd&2){b=c.H(b/2);if(!d.$Reverse){e=(b+1)%2*d.ed;b+=e}}return b}function d(d){var g=d&1,i=d&2||1,e=0;if(d&2)e=a%2;var f=d==68?h:b.Zd(a,d);return{Sd:d,ed:e,$Reverse:g,Od:f,Le:function(a){return c.G((f[a]+e*!g)/i)}}}function l(a,b,f,d){var e=i(a,b,f),c=1/(d*(e-1)+1);return{nc:function(e){return a.Od[e]<b&&[a.Le(e)*d*c,c]}}}function m(a){return{Pe:function(b){return a.Od[b]%2?1:-1}}}function k(b,g,k,h,j){var d=i(b,g,k),e=0;function f(a){return c.B(1-a/d,h)}if(b.Sd&2){d=c.H(a/2)-b.ed;e=f(d-1)/2*!b.ed}return{Se:function(a){a=b.Le(a);j&&(a=d-a-1);return f(a)-e}}}j.Uf=e;j.Rf=function(o){var i=g[o];if(!i){var h=e.p&&e.p[o]||{},y=b.wc(h.dl,.5),x=h.o||0,z=h.r||1,p=h.c,r=h.d,n=b.wc(h.dO,8),q=c.$Round(a*z),j=d(x),w=l(j,q,h.dlc,y),t=p&8?j:d(p),v=m(t),s=n&8?j:d(n),u=k(s,q,h.dc,r,n==9);i=g[o]={nc:w.nc,Qf:function(a){return(p!=f?v.Pe(a):1)*(r?u.Se(a):1)}}}return i}}var i=h(k),a=b.A(i),g=[];b.f(i,function(i,h){var a=[],d=b.v({},e),f=b.v({},e,{o:j});b.f(n,function(j,n){var i={},o={},k=g[n]=g[n]||new l(j);b.f(j,function(l,b){var n=k.Rf(b),p=n.nc(h);if(p){var a,g=c.Y(l-d[b],8);if(g){g=c.Y(l-e[b],8);g*=n.Qf(h);a=c.Y(g+e[b],4);var j=m[b];if(j){a=c.l(a,j.j);a=c.j(a,j.l)}}else a=l;if(a-f[b]){i[b]=a;o[b]=p}}});b.v(d,j);b.v(f,i);if(b.Th(i)){b.v(i,k.Uf);i.dr=o;a.push(i)}});b.A(a)&&o(i,a)})}};function p(){var a=this,f,e=[],c=[];function k(a,b){e.push({ec:a,gc:b})}function j(a,c){b.f(e,function(b,d){b.ec==a&&b.gc===c&&e.splice(d,1)})}function h(){e=[]}function g(){b.f(c,function(a){b.$RemoveEvent(a.Ne,a.ec,a.gc,a.Xe)});c=[]}a.Oc=function(){return f};a.a=function(f,d,e,a){b.$AddEvent(f,d,e,a);c.push({Ne:f,ec:d,gc:e,Xe:a})};a.T=function(f,d,e,a){b.f(c,function(g,h){if(g.Ne===f&&g.ec==d&&g.gc===e&&g.Xe==a){b.$RemoveEvent(f,d,e,a);c.splice(h,1)}})};a.Ve=g;a.$On=a.addEventListener=k;a.$Off=a.removeEventListener=j;a.k=function(a){var c=[].slice.call(arguments,1);b.f(e,function(b){b.ec==a&&b.gc.apply(i,c)})};a.$Destroy=function(){if(!f){f=d;g();h()}}}var l=function(C,F,l,m,L,M){C=C||0;var a=this,t,p,n,o,v,D=0,O=1,E,B=0,h=0,r=0,A,j,e,g,u,z,s=[],I=k,J,H=k;function R(a){e+=a;g+=a;j+=a;h+=a;r+=a;B+=a}function y(C){var k=C;if(u)if(!z&&(k>=g||k<e)||z&&k>=e)k=((k-e)%u+u)%u+e;if(!A||v||h!=k){var i=c.j(k,g);i=c.l(i,e);if(l.$Reverse)i=g-i+e;if(!A||v||i!=r){if(t){var y=(i-j)/(F||1),x=t(y),n;if(J){var o=i>e&&i<g;if(o!=H)n=H=o}if(!n&&x!=f){var p=!x;if(p!=I)n=I=p}if(n!=f){n&&b.lc(m,"none");!n&&b.lc(m,b.g(m,"data-events"))}}var w=r,q=r=i;b.f(s,function(c,d){var a=!A&&z||k<=h?s[b.A(s)-d-1]:c;a.L(i-B)});h=k;A=d;a.kd(w-j,q-j);a.zc(w,q)}}}function G(a,b,d){b&&a.$Shift(g);if(!d){e=c.j(e,a.yc()+B);g=c.l(g,a.vb()+B)}s.push(a)}var w=i.requestAnimationFrame||i.webkitRequestAnimationFrame||i.mozRequestAnimationFrame||i.msRequestAnimationFrame;if(b.He()&&b.Cd()<7||!w)w=function(a){b.$Delay(a,l.$Interval)};function N(){if(p){var c=b.Tb(),d=c-D;D=c;var a=h+d*o*O;if(a*o>=n*o)a=n;y(a);if(!v&&a*o>=n*o)P(E);else w(N)}}function x(f,i,j){if(!p){p=d;v=j;E=i;f=c.l(f,e);f=c.j(f,g);n=f;o=n<h?-1:1;a.Qc();D=b.Tb();w(N)}}function P(b){if(p){v=p=E=k;a.Rc();b&&b()}}a.$Play=function(a,b,c){x(a?h+a:g,b,c)};a.tc=x;a.Ff=function(a,b){x(g,a,b)};a.S=P;a.Be=function(){return h};a.Ee=function(){return n};a.z=function(){return r};a.L=y;a.uf=function(){y(g,d)};a.$IsPlaying=function(){return p};a.De=function(a){O=a};a.$Shift=R;a.je=G;a.M=function(a,b){G(a,0,b)};a.zd=function(a){G(a,1)};a.qd=function(a){g+=a};a.yc=function(){return e};a.vb=function(){return g};a.zc=a.Qc=a.Rc=a.kd=b.Kc;b.Tb();a.nf=function(){return t&&t.E(1)};l=b.v({$Interval:16},l);m&&(J=b.g(m,"data-inactive"));u=l.hc;z=l.pf;e=j=C;g=C+F;l.$Elmt=m;m&&(t=b.Kf(L,M,l,d,d))};var u=i.$JssorSlideshowFormations$=new function(){var i=this,e=0,a=1,g=2,f=3,t=1,s=2,u=4,r=8,x=256,y=512,w=1024,v=2048,k=v+t,j=v+s,p=y+t,n=y+s,o=x+u,l=x+r,m=w+u,q=w+r;function z(a){return(a&s)==s}function A(a){return(a&u)==u}function h(b,a,c){c.push(a);b[a]=b[a]||[];b[a].push(c)}i.$FormationStraight=function(f){for(var d=f.$Cols,e=f.$Rows,s=f.$Assembly,t=f.mc,r=[],a=0,b=0,i=d-1,q=e-1,g=t-1,c,b=0;b<e;b++)for(a=0;a<d;a++){switch(s){case k:c=g-(a*e+(q-b));break;case m:c=g-(b*d+(i-a));break;case p:c=g-(a*e+b);case o:c=g-(b*d+a);break;case j:c=a*e+b;break;case l:c=b*d+(i-a);break;case n:c=a*e+(q-b);break;default:c=b*d+a}h(r,c,[b,a])}return r};i.$FormationSwirl=function(r){var y=r.$Cols,z=r.$Rows,C=r.$Assembly,x=r.mc,B=[],A=[],v=0,c=0,i=0,s=y-1,t=z-1,u,q,w=0;switch(C){case k:c=s;i=0;q=[g,a,f,e];break;case m:c=0;i=t;q=[e,f,a,g];break;case p:c=s;i=t;q=[f,a,g,e];break;case o:c=s;i=t;q=[a,f,e,g];break;case j:c=0;i=0;q=[g,e,f,a];break;case l:c=s;i=0;q=[a,g,e,f];break;case n:c=0;i=t;q=[f,e,g,a];break;default:c=0;i=0;q=[e,g,a,f]}v=0;while(v<x){u=i+","+c;if(c>=0&&c<y&&i>=0&&i<z&&!A[u]){A[u]=d;h(B,v++,[i,c])}else switch(q[w++%b.A(q)]){case e:c--;break;case g:i--;break;case a:c++;break;case f:i++}switch(q[w%b.A(q)]){case e:c++;break;case g:i++;break;case a:c--;break;case f:i--}}return B};i.$FormationZigZag=function(q){var x=q.$Cols,y=q.$Rows,A=q.$Assembly,w=q.mc,u=[],v=0,c=0,d=0,r=x-1,s=y-1,z,i,t=0;switch(A){case k:c=r;d=0;i=[g,a,f,a];break;case m:c=0;d=s;i=[e,f,a,f];break;case p:c=r;d=s;i=[f,a,g,a];break;case o:c=r;d=s;i=[a,f,e,f];break;case j:c=0;d=0;i=[g,e,f,e];break;case l:c=r;d=0;i=[a,g,e,g];break;case n:c=0;d=s;i=[f,e,g,e];break;default:c=0;d=0;i=[e,g,a,g]}v=0;while(v<w){z=d+","+c;if(c>=0&&c<x&&d>=0&&d<y&&typeof u[z]=="undefined"){h(u,v++,[d,c]);switch(i[t%b.A(i)]){case e:c++;break;case g:d++;break;case a:c--;break;case f:d--}}else{switch(i[t++%b.A(i)]){case e:c--;break;case g:d--;break;case a:c++;break;case f:d++}switch(i[t++%b.A(i)]){case e:c++;break;case g:d++;break;case a:c--;break;case f:d--}}}return u};i.$FormationStraightStairs=function(i){var u=i.$Cols,v=i.$Rows,e=i.$Assembly,t=i.mc,r=[],s=0,c=0,d=0,f=u-1,g=v-1,x=t-1;switch(e){case k:case n:case p:case j:var a=0,b=0;break;case l:case m:case o:case q:var a=f,b=0;break;default:e=q;var a=f,b=0}c=a;d=b;while(s<t){if(A(e)||z(e))h(r,x-s++,[d,c]);else h(r,s++,[d,c]);switch(e){case k:case n:c--;d++;break;case p:case j:c++;d--;break;case l:case m:c--;d--;break;case q:case o:default:c++;d++}if(c<0||d<0||c>f||d>g){switch(e){case k:case n:a++;break;case l:case m:case p:case j:b++;break;case q:case o:default:a--}if(a<0||b<0||a>f||b>g){switch(e){case k:case n:a=f;b++;break;case p:case j:b=g;a++;break;case l:case m:b=g;a--;break;case q:case o:default:a=0;b++}if(b>g)b=g;else if(b<0)b=0;else if(a>f)a=f;else if(a<0)a=0}d=b;c=a}}return r};i.$FormationRectangle=function(f){var d=f.$Cols||1,e=f.$Rows||1,g=[],a,b,i;i=c.$Round(c.j(d/2,e/2))+1;for(a=0;a<d;a++)for(b=0;b<e;b++)h(g,i-c.j(a+1,b+1,d-a,e-b),[b,a]);return g};i.$FormationRandom=function(d){for(var e=[],a,b=0;b<d.$Rows;b++)for(a=0;a<d.$Cols;a++)h(e,c.H(1e5*c.dd())%13,[b,a]);return e};i.$FormationCircle=function(d){for(var e=d.$Cols||1,f=d.$Rows||1,g=[],a,i=e/2-.5,j=f/2-.5,b=0;b<e;b++)for(a=0;a<f;a++)h(g,c.$Round(c.xb(c.B(b-i,2)+c.B(a-j,2))),[a,b]);return g};i.$FormationCross=function(d){for(var e=d.$Cols||1,f=d.$Rows||1,g=[],a,i=e/2-.5,j=f/2-.5,b=0;b<e;b++)for(a=0;a<f;a++)h(g,c.$Round(c.j(c.P(b-i),c.P(a-j))),[a,b]);return g};i.$FormationRectangleCross=function(f){for(var g=f.$Cols||1,i=f.$Rows||1,j=[],a,d=g/2-.5,e=i/2-.5,k=c.l(d,e)+1,b=0;b<g;b++)for(a=0;a<i;a++)h(j,c.$Round(k-c.l(d-c.P(b-d),e-c.P(a-e)))-1,[a,b]);return j}};i.$JssorSlideshowRunner$=function(n,q,o,r,w,v){var a=this,f,m,i,t=0,s=r.$TransitionsOrder;function h(a){var c={$Left:"x",$Top:"y",$Bottom:"m",$Right:"t",$Rotate:"r",$ScaleX:"sX",$ScaleY:"sY",$TranslateX:"tX",$TranslateY:"tY",$SkewX:"kX",$SkewY:"kY",$Opacity:"o",$ZIndex:"i",$Clip:"c"};b.f(a,function(e,d){var b=c[d];if(b){a[b]=e;delete a[d];b=="c"&&h(e)}});if(a.$Zoom)a.sX=a.sY=a.$Zoom}function j(f,e){var a={$Duration:1,$Delay:0,$Cols:1,$Rows:1,$Opacity:0,$Zoom:0,$Clip:0,$Move:k,$SlideOut:k,$Reverse:k,$Formation:u.$FormationRandom,$Assembly:1032,$ChessMode:{$Column:0,$Row:0},$Easing:g.$Linear,$Round:{},Ic:[],$During:{}};b.v(a,f);if(a.$Rows==0)a.$Rows=c.$Round(a.$Cols*e);a.$Easing=b.Ld(a.$Easing);h(a);h(a.$Easing);h(a.$During);h(a.$Round);a.mc=a.$Cols*a.$Rows;a.Af=function(c,b){c/=a.$Cols;b/=a.$Rows;var f=c+"x"+b;if(!a.Ic[f]){a.Ic[f]={w:c,h:b};for(var d=0;d<a.$Cols;d++)for(var e=0;e<a.$Rows;e++)a.Ic[f][e+","+d]={y:e*b,t:d*c+c,m:e*b+b,x:d*c}}return a.Ic[f]};if(a.$Brother){a.$Brother=j(a.$Brother,e);a.$SlideOut=d}return a}function p(s,g,a,t,o,n){var h,e,j=a.$ChessMode.$Column||0,m=a.$ChessMode.$Row||0,i=a.Af(o,n),p=a.$Formation(a),r=a.$SlideOut;g=b.ab(g);b.N(g,1);b.Fb(g,"hidden");b.db(g,"absolute");v(g,0,0);!a.$Reverse&&p.reverse();var f={x:a.c&1,t:a.c&2,y:a.c&4,m:a.c&8},q=new l(0,0);b.f(p,function(w,v){if(r)v=b.A(p)-v-1;var x=a.$Delay*v;b.f(w,function(G){var J=G[0],I=G[1],O=J+","+I,v=k,w=k,z=k;if(j&&I%2){if(j&3)v=!v;if(j&12)w=!w;if(j&16)z=!z}if(m&&J%2){if(m&3)v=!v;if(m&12)w=!w;if(m&16)z=!z}var E=w?f.m:f.y,B=w?f.y:f.m,D=v?f.t:f.x,C=v?f.x:f.t,H=E||B||D||C,A=b.ab(g);e={x:0,y:0,o:1};h=b.v({},e);if(a.o)e.o=2-a.o;var N=a.$Cols*a.$Rows>1||H;if(a.sX||a.r){var M=d;if(M){e.sX=e.sY=a.sX?a.sX-1:1;h.sX=h.sY=1;var T=a.r||0;e.r=T*360*(z?-1:1);h.r=0}}if(N){var F=i[O];if(H){var p={},y=a.$ScaleClip||1;if(E&&B){p.y=i.h/2*y;p.m=-p.y}else if(E)p.m=-i.h*y;else if(B)p.y=i.h*y;if(D&&C){p.x=i.w/2*y;p.t=-p.x}else if(D)p.t=-i.w*y;else if(C)p.x=i.w*y;if(a.$Move){var R=(p.x||0)+(p.t||0),S=(p.y||0)+(p.m||0);e.x+=R;e.y+=S}h.c=F;b.f(p,function(b,a){p[a]=F[a]+b});e.c=p}else b.kh(A,F)}var P=v?1:-1,Q=w?1:-1;if(a.x)e.x+=o*a.x*P;if(a.y)e.y+=n*a.y*Q;var K={$Elmt:A,$Easing:a.$Easing,$During:a.$During,$Round:a.$Round,$Move:a.$Move,Eb:o,Gb:n,le:c.$Round(a.$Duration/4),$Reverse:!r};e=b.Zg(e,h);var L=new l(t+x,a.$Duration,K,A,h,e);q.M(L);s.Ef(A)})});q.L(-1);return q}a.Bf=function(){var a=0,d=r.$Transitions,e=b.A(d);if(s)a=t++%e;else a=c.G(c.dd()*e);d[a]&&(d[a].Qb=a);return d[a]};a.Ob=function(){n.Ob();m=e;i=e};a.Cf=function(v,y,w,x,s,k){f=j(s,k);var h=x.Re,d=w.Re,e=h,g=d,r=f,b=f.$Brother||j({},k);if(!f.$SlideOut){e=d;g=h}var l=b.$Shift||0,u=c.l(l,0),t=c.l(-l,0);m=p(n,g,b,u,q,o);i=p(n,e,r,t,q,o);a.Qb=v};a.of=function(){var a=e;if(i){a=new l(0,0);a.M(i);a.M(m);a.ye=f}return a}};var o={qf:"data-scale",yb:"data-autocenter",Dd:"data-nofreeze",ze:"data-nodrag"},q=new function(){var a=this;a.Ac=function(c,a,e,d){(d||!b.g(c,a))&&b.g(c,a,e)};a.Cc=function(a){var c=b.q(a,o.yb);b.Uc(a,c)}},s={uc:1};i.$JssorBulletNavigator$=function(){var a=this,E=b.W(a,p),h,v,C,B,m,l=0,g,r,n,z,A,i,k,u,t,x,j;function y(a){j[a]&&j[a].Ye(a==l)}function w(b){a.k(s.uc,b*r)}a.Sc=function(a){if(a!=m){var d=l,b=c.G(a/r);l=b;m=a;y(d);y(b)}};a.id=function(a){b.mb(h,!a)};a.nd=function(J){b.$Destroy(j);m=f;a.Ve();x=[];j=[];b.Rb(h);v=c.H(J/r);l=0;var F=u+z,G=t+A,s=c.H(v/n)-1;C=u+F*(!i?s:n-1);B=t+G*(i?s:n-1);b.K(h,C);b.J(h,B);for(var o=0;o<v;o++){var H=b.Rd();b.bd(H,o+1);var p=b.Ce(k,"numbertemplate",H,d);b.db(p,"absolute");var E=o%(s+1),I=c.G(o/(s+1)),y=g.Yb&&!i?s-E:E;b.U(p,(!i?y:I)*F);b.V(p,(i?y:I)*G);b.O(h,p);x[o]=p;g.$ActionMode&1&&a.a(p,"click",b.Z(e,w,o));g.$ActionMode&2&&a.a(p,"mouseenter",b.Z(e,w,o));j[o]=b.Lc(p)}q.Cc(h)};a.F=function(d,c){a.$Elmt=h=b.$GetElement(d);a.gd=g=b.v({$SpacingX:10,$SpacingY:10,$ActionMode:1},c);k=b.$FindChild(h,"prototype");u=b.K(k);t=b.J(k);b.ib(k,h);r=g.$Steps||1;n=g.$Rows||1;z=g.$SpacingX;A=g.$SpacingY;i=g.$Orientation&2;g.$AutoCenter&&q.Ac(h,o.yb,g.$AutoCenter)};a.$Destroy=function(){b.$Destroy(j,E)};b.F(a)};i.$JssorArrowNavigator$=function(){var a=this,v=b.W(a,p),f,c,g,l,r,k,h,m,j,i;function n(b){a.k(s.uc,b,d)}function u(a){b.mb(f,!a);b.mb(c,!a)}function t(){j.$Enable((g.$Loop||!l.lf(h))&&k>1);i.$Enable((g.$Loop||!l.ef(h))&&k>1)}a.Sc=function(c,a,b){h=a;!b&&t()};a.id=u;a.nd=function(g){k=g;h=0;if(!r){a.a(f,"click",b.Z(e,n,-m));a.a(c,"click",b.Z(e,n,m));j=b.Lc(f);i=b.Lc(c);b.g(f,o.Dd,1);b.g(c,o.Dd,1);r=d}};a.F=function(e,d,h,i){a.gd=g=b.v({$Steps:1},h);f=e;c=d;if(g.Yb){f=d;c=e}m=g.$Steps;l=i;if(g.$AutoCenter){q.Ac(f,o.yb,g.$AutoCenter);q.Ac(c,o.yb,g.$AutoCenter)}q.Cc(f);q.Cc(c)};a.$Destroy=function(){b.$Destroy(j,i,v)};b.F(a)};i.$JssorThumbnailNavigator$=function(){var i=this,E=b.W(i,p),h,B,a,y,C,m,l=[],A,z,g,n,r,w,v,x,t,u;function D(){var c=this;b.W(c,p);var h,f,n,l;function o(){n.Ye(m==h)}function j(e){if(e||!t.$LastDragSucceeded()){var c=g-h%g,a=t.Id((h+c)/g-1),b=a*g+g-c;if(a<0)b+=y%g;if(a>=C)b-=y%g;i.k(s.uc,b,k,d)}}c.Hd=o;c.F=function(g,i){c.Qb=h=i;l=g.nh||g.ih||b.bc();c.Wc=f=b.Ce(u,"thumbnailtemplate",l,d);n=b.Lc(f);a.$ActionMode&1&&c.a(f,"click",b.Z(e,j,0));a.$ActionMode&2&&c.a(f,"mouseenter",b.Z(e,j,1))};b.F(c)}i.Sc=function(a,e,d){if(a!=m){var b=m;m=a;b!=-1&&l[b].Hd();l[a]&&l[a].Hd()}!d&&t.$PlayTo(t.Id(c.G(a/g)))};i.id=function(a){b.mb(h,!a)};i.nd=function(I,J){b.$Destroy(t,l);m=f;l=[];var K=b.ab(B);b.Rb(h);a.Yb&&b.g(h,"dir","rtl");b.ph(h,b.jb(K));var i=b.$FindChild(h,"slides",d);y=I;C=c.H(y/g);m=-1;var e=a.$Orientation&1,s=w+(w+n)*(g-1)*(1-e),p=v+(v+r)*(g-1)*e,E=(e?c.l:c.j)(A,s),u=(e?c.j:c.l)(z,p);x=c.H((A-n)/(w+n)*e+(z-r)/(v+r)*(1-e));var G=s+(s+n)*(x-1)*e,F=p+(p+r)*(x-1)*(1-e);E=c.j(E,G);u=c.j(u,F);b.K(i,E);b.J(i,u);b.Uc(i,3);var o=[];b.f(J,function(k,f){var h=new D(k,f),d=h.Wc,a=c.G(f/g),j=f%g;b.U(d,(w+n)*j*(1-e));b.V(d,(v+r)*j*e);if(!o[a]){o[a]=b.bc();b.O(i,o[a])}b.O(o[a],d);l.push(h)});var H=b.v({$AutoPlay:0,$NaviQuitDrag:k,$SlideWidth:s,$SlideHeight:p,$SlideSpacing:n*e+r*(1-e),$MinDragOffsetToSlide:12,$SlideDuration:200,$PauseOnHover:1,$Cols:x,$PlayOrientation:a.$Orientation,$DragOrientation:a.$NoDrag||a.$DisableDrag?0:a.$Orientation},a);t=new j(h,H);q.Cc(h)};i.F=function(j,f,e){h=j;i.gd=a=b.v({$SpacingX:0,$SpacingY:0,$Orientation:1,$ActionMode:1},f);A=b.K(h);z=b.J(h);var c=b.$FindChild(h,"slides",d);u=b.$FindChild(c,"prototype");e=b.ab(e);b.pb(e,c);w=b.K(u);v=b.J(u);b.ib(u,c);b.db(c,"absolute");b.Fb(c,"hidden");g=a.$Rows||1;n=a.$SpacingX;r=a.$SpacingY;a.$AutoCenter&=a.$Orientation;a.$AutoCenter&&q.Ac(h,o.yb,a.$AutoCenter);B=b.ab(h)};i.$Destroy=function(){b.$Destroy(t,l,E)};b.F(i)};function n(e,d,c){var a=this;b.W(a,p);l.call(a,0,c.$Idle);a.qc=0;a.fd=c.$Idle}n.pc=21;n.Zb=24;var t=i.$JssorCaptionSlideo$=function(){var a=this,db=b.W(a,p);l.call(a,0,0);var f,j,B,C,w=new l(0,0),L=[],u=[],F,q=0;function H(c,f){var a=L[c];if(a==e){a=L[c]={ob:c,Zc:[],Te:[]};var d=0;!b.f(u,function(a,b){d=b;return a.ob>c})&&d++;u.splice(d,0,a)}return a}function Q(f,v){var s=b.K(f),r=b.J(f),m=b.Ib(f),j={x:m?0:b.U(f),y:m?0:b.V(f),cc:0,Wb:0,o:b.cb(f),i:b.N(f)||0,r:0,rX:0,rY:0,sX:1,sY:1,tX:0,tY:0,tZ:0,kX:0,kY:0,ls:0,lh:1,so:0,c:{y:0,t:s,m:r,x:0}},a,g;if(C){var o=C[b.q(f,"c")];if(o){a=H(o.r,0);a.sg=o.e||0}}var h=b.g(f,"data-to");if(h&&m){h=b.Ud(h);h={x:b.od(h[0]),y:b.od(h[1])}}var u={$Elmt:f,$OriginalWidth:s,$OriginalHeight:r,Nf:h,Lf:j.x,Of:j.y,Ib:m};b.f(v,function(e){var m=b.v({$Easing:b.Ld(e.e),$During:e.dr,Bd:e.p},u),i=b.v(d,{},e);b.Pd(i,["b","d","e","p","dr"]);var h=new l(e.b,e.d,m,f,j,i);q=c.l(q,e.b+e.d);if(a){if(!g)g=new l(e.b,0);g.M(h)}else{var k=H(e.b,e.b+e.d);k.Zc.push(h)}j=h.nf()});if(a&&g){g.uf();var i=g,n,k=g.yc(),p=g.vb(),t=c.l(p,a.sg);if(a.ob<p){if(a.ob>k){i=new l(k,a.ob-k);i.M(g,d)}else i=e;n=new l(a.ob,t-k,{hc:t-a.ob,pf:d});n.M(g,d)}i&&a.Zc.push(i);n&&a.Te.push(n)}return j}function N(d,c){b.f(d,function(d){var f=b.q(d,"play");if(c&&f){var e=new t(d,j,{xe:f});E.push(e);a.a(e,n.pc,I);a.a(e,n.Zb,G)}else{N(b.jb(d).concat(b.xc(b.Hc(d,"data-tchd"))),c+1);var g=b.xc(b.Hc(d,"data-tsep"));g.push(d);b.f(g,function(c){var a=B[b.q(c,"t")];a&&Q(c,a)})}})}function cb(f,e,g){var c=f.b-e;if(c){var b=new l(e,c);b.M(w,d);b.$Shift(g);a.M(b)}a.qd(f.d);return c}function bb(e){var c=w.yc(),d=0;b.f(e,function(e,f){e=b.v({d:3e3},e);cb(e,c,d);c=e.b;d+=e.d;if(!f||e.t==2){a.qc=c;a.fd=c+e.d}})}function A(i,d,e){var f=b.A(d);if(f>4)for(var j=c.H(f/4),a=0;a<j;a++){var g=d.slice(a*4,c.j(a*4+4,f)),h=new l(g[0].ob,0);A(h,g,e);i.M(h)}else b.f(d,function(a){b.f(e?a.Te:a.Zc,function(a){e&&a.qd(q-a.vb());i.M(a)})})}var i,M,y=0,g,x,S,R,z,E=[],O=[],r,D,m;function v(a){return a&2||a&4&&b.ud().td}function Z(){if(!z){g&8&&a.a(h,"keydown",J);if(g&32){a.a(h,"mousedown",s);a.a(h,"touchstart",s)}z=d}}function Y(){a.T(h,"keydown",J);a.T(h,"mousedown",s);a.T(h,"touchstart",s);z=k}function T(b){if(!r||b){r=d;a.S();b&&y&&a.L(0);a.De(1);a.Ff();Z();a.k(n.pc,a)}}function o(){if(!D&&(r||a.z())){D=d;a.S();a.Be()>a.qc&&a.L(a.qc);a.De(S||1);a.tc(0)}}function V(){!m&&o()}function U(c){var b=c;if(c<0&&a.z())b=1;if(b!=y){y=b;M&&a.k(n.Zb,a,y)}}function J(a){g&8&&b.Je(a)==27&&o()}function X(a){if(m&&b.Fe(a)!==e){m=k;g&16&&b.$Delay(V,160)}}function s(a){g&32&&!b.Ae(f,b.$EvtSrc(a))&&o()}function W(a){if(!m){m=d;if(i&1)b.Ie(a,f)&&T()}}function ab(j){var h=b.$EvtSrc(j),a=b.kb(h,e,e,"A"),c=a&&(b.qe(a)||a===f||b.Ae(f,a));if(r&&v(g))!c&&o();else if(v(i))!c&&T(d)}function I(b){var c=b.wg(),a=O[c];a!==b&&a&&a.vg();O[c]=b}function G(b,c){a.k(n.Zb,b,c)}a.wg=function(){return R||""};a.vg=o;a.Qc=function(){U(1)};a.Rc=function(){r=k;D=k;U(-1);!a.z()&&Y()};a.zc=function(){!m&&x&&a.Be()>a.fd&&o()};a.F=function(m,k,e){f=m;j=k;i=e.xe;F=e.cg;B=j.$Transitions;C=j.$Controls;N([f],0);A(w,u);if(i){a.M(w);F=d;x=b.q(f,"idle");g=b.q(f,"rollback");S=b.q(f,"speed",1);R=b.hb(f,"group");(v(i)||v(g))&&a.a(f,"click",ab);if((i&1||x)&&!b.ud().td){a.a(f,"mouseenter",W);a.a(f,"mouseleave",X)}M=b.q(f,"pause")}var l=j.$Breaks||[],c=l[b.q(f,"b")]||[],h={b:q,d:b.A(c)?0:e.$Idle||x||0};c=c.concat([h]);bb(c);a.vb();F&&a.qd(1e8);q=a.vb();A(a,u,d);a.L(-1);a.L(b.q(f,"initial")||0)};a.$Destroy=function(){b.$Destroy(db,E);a.S();a.L(-1)};b.F(a)},j=i.$JssorSlider$=(i.module||{}).exports=function(){var a=this,Gc=b.W(a,p),Ob="data-jssor-slider",ic="data-jssor-thumb",u,m,S,Cb,kb,jb,X,J,O,M,Zb,Cc,Hc=1,Bc=1,kc=1,sc=1,nc={},w,R,Mb,bc,Yb,wb,zb,yb,ab,H=[],Rb,r=-1,tc,q,I,G,P,ob,pb,E,N,lb,T,z,W,nb,Z=[],vc,xc,oc,t,vb,Hb,qb,eb,Y,Kb,Gb,Qb,Sb,F,Lb=0,cb=0,Q=Number.MAX_VALUE,K=Number.MIN_VALUE,C,mb,db,U=1,Xb=0,fb,y,Fb,Eb,L,Ab,Db,B,V,rb,A,Bb,cc=b.ud(),Vb=cc.td,x=[],D,hb,bb,Nb,hc,mc,ib;function Jb(){return!U&&Y&12}function Ic(){return Xb||!U&&Y&3}function Ib(){return!y&&!Jb()&&!A.$IsPlaying()}function Wc(){return!Ic()&&Ib()}function jc(){return z||S}function Pc(){return jc()&2?pb:ob}function lc(a,c,d){b.U(a,c);b.V(a,d)}function Fc(c,b){var a=jc(),d=(ob*b+Lb)*(a&1),e=(pb*b+Lb)*(a&2)/2;lc(c,d,e)}function dc(b,f){if(y&&!(C&1)){var e=b,d;if(b<K){e=K;d=-1}if(b>Q){e=Q;d=1}if(d){var a=b-e;if(f){a=c.Xf(a)*2/c.u;a=c.B(a*d,1.6)}else{a=c.B(a*d,.625);a=c.Oe(a*c.u/2)}b=e+a*d}}return b}function qc(a){return dc(a,d)}function Nc(a){return dc(a)}function xb(a,b){if(!(C&1)){var c=a-Q+(b||0),d=K-a+(b||0);if(c>0&&c>d)a=Q;else if(d>0)a=K}return a}function yc(a){return!(C&1)&&a-K<.0001}function wc(a){return!(C&1)&&Q-a<.0001}function sb(a){return!(C&1)&&(a-K<.0001||Q-a<.0001)}function Tb(c,a,d){!ib&&b.f(Z,function(b){b.Sc(c,a,d)})}function ec(b){var a=b,d=sb(b);if(d)a=xb(a);else{b=v(b);a=b}a=c.G(a);a=c.l(a,0);return a}function fd(a){x[r];Rb=r;r=a;tc=x[r]}function zc(){z=0;var b=B.z(),d=ec(b);Tb(d,b);if(sb(b)||b==c.G(b)){if(t&2&&(eb>0&&d==q-1||eb<0&&!d))t=0;fd(d);a.k(j.$EVT_PARK,r,Rb)}}function pc(a,b){if(q&&(!b||!A.$IsPlaying())){A.S();realPosition=qc(a);V.L(realPosition);zc()}}function ub(a){if(q){a=xb(a);a=v(a);fb=k;_IsStandBy=k;y=k;pc(a)}else Tb(0,0)}function Zc(){var b=j.Ke||0,a=mb;j.Ke|=a;return W=a&~b}function Uc(){if(W){j.Ke&=~mb;W=0}}function Dc(c){var a=b.bc();b.rb(a,ab);c&&b.Fb(a,"hidden");return a}function v(b,a){a=a||q||1;return(b%a+a)%a}function fc(c,a,b){t&8&&(t=0);tb(c,Gb,a,b)}function Ub(){b.f(Z,function(a){a.id(a.gd.$ChanceToShow<=U)})}function Mc(c){if(!U&&(b.Fe(c)||!b.Ie(c,u))){U=1;Ub();if(!y){Y&12&&Jc();x[r]&&x[r].Bc()}a.k(j.$EVT_MOUSE_LEAVE)}}function Lc(){if(U){U=0;Ub();y||!(Y&12)||Kc()}a.k(j.$EVT_MOUSE_ENTER)}function Wb(b,a){tb(b,a,d)}function tb(g,h,l,p){if(q&&(!y||m.$NaviQuitDrag)&&!Jb()&&!isNaN(g)){var e=B.z(),a=g;if(l){a=e+g;if(C&2){if(yc(e)&&g<0)a=Q;if(wc(e)&&g>0)a=K}}if(!(C&1))if(p)a=v(a);else a=xb(a,.5);if(l&&!sb(a))a=c.$Round(a);var i=(a-e)%q;a=e+i;if(h==f)h=Gb;var b=c.P(i),j=0;if(b){if(b<1)b=c.B(b,.5);if(b>1){var o=Pc(),n=(S&1?zb:yb)/o;b=c.j(b,n*1.5)}j=h*b}ib=d;A.S();ib=k;A.se(e,a,j)}}function Rc(e,h,n){var l=this,i={$Top:2,$Right:1,$Bottom:2,$Left:1},m={$Top:"top",$Right:"right",$Bottom:"bottom",$Left:"left"},g,a,f,j,k={};l.$Elmt=e;l.$ScaleSize=function(q,p,t){var l,s=q,r=p;if(!f){f=b.Ch(e);g=e.parentNode;j={$Scale:b.q(e,o.qf,1),$AutoCenter:b.q(e,o.yb)};b.f(m,function(c,a){k[a]=b.q(e,"data-scale-"+c,1)});a=e;if(h){a=b.ab(g,d);b.rb(a,{$Top:0,$Left:0});b.O(a,e);b.O(g,a)}}if(n){l=c.l(q,p);if(h)if(t>=0&&t<1){var v=c.j(q,p);l=c.j(l/v,1/(1-t))*v}}else s=r=l=c.B(O<M?p:q,j.$Scale);l*=h&&(l!=1||b.He())?1.001:1;h&&(sc=l);b.we(a,l);b.K(g,f.Eb*s);b.J(g,f.Gb*r);var u=b.ue()&&b.Cd()<9?l:1,w=(s-u)*f.Eb/2,x=(r-u)*f.Gb/2;b.U(a,w);b.V(a,x);b.f(f,function(d,a){if(i[a]&&d){var e=(i[a]&1)*c.B(q,k[a])*d+(i[a]&2)*c.B(p,k[a])*d/2;b.If[a](g,e)}});b.Uc(g,j.$AutoCenter)}}function dd(){var a=this;l.call(a,0,0,{hc:q});b.f(x,function(b){a.zd(b);b.$Shift(F/E)})}function cd(){var a=this,b=Bb.$Elmt;l.call(a,-1,2,{$Easing:g.$Linear,Pc:{Pb:Fc},hc:q,$Reverse:Hb},b,{Pb:1},{Pb:-1});a.Wc=b}function ed(){var b=this;l.call(b,-1e8,2e8);b.zc=function(e,b){if(c.P(b-e)>1e-5){var g=b,f=b;if(c.G(b)!=b&&b>e&&(C&1||b>cb))f++;var h=ec(f);Tb(h,g,d);a.k(j.$EVT_POSITION_CHANGE,v(g),v(e),b,e)}}}function Tc(o,n){var b=this,g,i,f,c,h;l.call(b,-1e8,2e8,{});b.Qc=function(){fb=d;a.k(j.$EVT_SWIPE_START,v(B.z()),V.z())};b.Rc=function(){fb=k;c=k;a.k(j.$EVT_SWIPE_END,v(B.z()),V.z());!y&&zc()};b.zc=function(e,b){var a=b;if(c)a=h;else if(f){var d=b/f;a=m.$SlideEasing(d)*(i-g)+g}a=qc(a);V.L(a)};b.se=function(a,c,h,e){y=k;f=h||1;g=a;i=c;ib=d;V.L(a);ib=k;b.L(0);b.tc(f,e)};b.Ng=function(){c=d;c&&b.$Play(e,e,d)};b.Wg=function(a){h=a};V=new ed;V.M(o);Sb&&V.M(n)}function Qc(){var c=this,a=Dc();b.N(a,0);c.$Elmt=a;c.Ef=function(c){b.O(a,c);b.mb(a)};c.Ob=function(){b.Fc(a);b.Rb(a)}}function bd(w,h){var g=this,hb=b.W(g,p),z,H=0,V,y,u,F,K,o,E=[],U,M,J,i,s,A,S;l.call(g,-N,N+1,{hc:C&1?q:f,$Reverse:Hb});function Q(){z&&z.$Destroy();Xb-=H;H=0;z=new kb.$Class(y,kb,{$Idle:b.q(y,"idle",Kb),cg:!t});z.$On(n.Zb,X)}function X(b,a){H+=a;Xb+=a;if(h==r)!H&&g.Bc()}function P(p,s,n){if(!M){M=d;if(o&&n){var q=b.q(o,"data-expand",0)*2,f=n.width,e=n.height,l=f,i=e;if(f&&e){if(F){if(F&3&&(!(F&4)||f>I||e>G)){var m=k,r=I/G*e/f;if(F&1)m=r>1;else if(F&2)m=r<1;l=m?f*G/e:I;i=m?G:e*I/f}b.K(o,l);b.J(o,i);b.V(o,(G-i)/2);b.U(o,(I-l)/2)}b.we(o,c.l((l+q)/l,(i+q)/i))}b.db(o,"absolute")}a.k(j.$EVT_LOAD_END,h)}s.Qe(k);p&&p(g)}function W(f,b,c,e){if(e==A&&r==h&&t&&Ib()&&!g.Oc()){var a=v(f);D.Cf(a,h,b,g,c,G/I);rb.$Shift(a-rb.yc()-1);rb.L(a);b.Tg();pc(a,d)}}function Z(b){if(b==A&&r==h&&Ib()&&!g.Oc()){if(!i){var a=e;if(D)if(D.Qb==h)a=D.of();else D.Ob();i=new ad(w,h,a,z);i.zg(s)}!i.$IsPlaying()&&i.sd()}}function L(a,d,k){if(a==h){if(a!=d)x[d]&&x[d].Jd();else!k&&i&&i.Ag();s&&s.$Enable();A=b.Tb();g.Vb(b.Z(e,Z,A))}else{var j=c.j(h,a),f=c.l(h,a),n=c.j(f-j,j+q-f),l=N+m.$LazyLoading-1;(!J||n<=l)&&g.Vb()}}function bb(){if(r==h&&i){i.S();s&&s.$Quit();s&&s.$Disable();i.he()}}function fb(){r==h&&i&&i.S()}function Y(b){!db&&a.k(j.$EVT_CLICK,h,b)}g.Qe=function(a){if(S!=a){S=a;a&&b.O(w,K);!a&&b.ib(K)}};g.Vb=function(f,c){c=c||g;if(b.A(E)&&!M){c.Qe(d);if(!U){U=d;a.k(j.$EVT_LOAD_START,h);b.f(E,function(a){var c=b.g(a,"data-load")||"src",d=!b.Qd(c,"data-")?c.substring(5):c;if(!b.g(a,d)){var e=b.hb(a,d)||b.hb(a,"src2");if(e){b.g(a,d,e);b.nb(a,b.g(a,"data-display"))}}})}b.Eh(E,o,b.Z(e,P,f,c))}else P(f,c)};g.Gg=function(){if(Wc())if(q==1){g.Jd();L(h,h)}else{var a;if(D)a=D.Bf(q);if(a){A=b.Tb();var c=h+eb,d=x[v(c)];return d.Vb(b.Z(e,W,c,d,a,A),g)}else(C||!sb(B.z())||!sb(B.z()+eb))&&Wb(eb)}};g.Bc=function(){L(h,h,d)};g.Jd=function(){s&&s.$Quit();s&&s.$Disable();g.Wd();i&&i.Hg();i=e;Q()};g.Tg=function(){b.Fc(w)};g.Wd=function(){b.mb(w)};function T(a,h){if(!h){u=b.$FindChild(a,"bg");y=u&&b.Lb(u)}if(!b.g(a,Ob)&&(h||!u)){var l=b.q(a,"data-arr");if(l!=f){function k(d,c){b.g(d,c,b.g(a,c))}var j=kb&&kb.$Transitions||{};b.Vf(a,b.cb(a),j[l],function(a,c){b.g(a,"data-t",b.A(j));j.push(c);k(a,"data-to");k(a,"data-bf");k(a,"data-c")});b.g(a,"data-arr","")}var c=b.jb(a);if(!u){y=a;u=Dc(d);b.g(u,"data-u","bg");var g="background";b.R(u,g+"Color",b.R(y,g+"Color"));b.R(u,g+"Image",b.R(y,g+"Image"));b.R(y,g,e);b.A(c)?b.pb(u,c[0]):b.O(y,u)}c=c.concat(b.xc(b.Hc(a,"data-tchd")));b.f(c,function(c){if(h<3&&!o)if(b.hb(c,"u")=="image"){o=c;o.border=0;b.rb(o,ab);b.rb(a,ab);b.R(o,"maxWidth","10000px");b.O(u,o)}T(c,h+1)});if(h){b.g(a,"data-events",b.lc(a));b.g(a,"data-display",b.nb(a));!b.Ib(a)&&b.ug(a,b.g(a,"data-to"));b.tg(a,b.g(a,"data-bf"));if(a.tagName=="IMG"){E.push(a);if(!b.g(a,"src")){J=d;b.Fc(a)}}var i=b.g(a,"data-load");i&&E.push(a)&&(J=J||!b.Qd(i,"data-"));var m=i&&b.g(a,i)||b.Jf(a);if(m){var n=new Image;b.g(n,"data-src",m);E.push(n)}b.N(a,(b.N(a)||0)+1)}b.yg(a,b.q(a,"data-p"));b.xg(a,b.hb(a,"po"));b.Jc(a,b.g(a,"data-ts"))}}g.kd=function(c,b){var a=N-b;Fc(V,a)};g.Qb=h;T(w,0);b.rb(w,ab);b.Fb(w,"hidden");b.Jc(w,"flat");F=b.q(y,"data-fillmode",m.$FillMode);var O=b.$FindChild(y,"thumb",d);if(O){g.nh=b.ab(O);b.Fc(O)}b.mb(w);K=b.ab(R);b.N(K,1e3);g.a(w,"click",Y);Q();g.ih=o;g.Re=w;g.Wc=V=w;g.a(a,203,L);g.a(a,28,fb);g.a(a,24,bb);g.$Destroy=function(){b.$Destroy(hb,z,i)}}function ad(F,h,q,s){var c=this,E=b.W(c,p),i=0,u=0,g,m,f,e,o,w,v,z=x[h];l.call(c,0,0);function B(){c.sd()}function C(a){v=a;c.S();c.sd()}function A(){}c.sd=function(){if(!y&&!fb&&!v&&r==h&&!c.Oc()){var k=c.z();if(!k)if(g&&!o){o=d;c.he(d);a.k(j.$EVT_SLIDESHOW_START,h,u,i,u,g,e)}a.k(j.$EVT_STATE_CHANGE,h,k,i,m,f,e);if(!Jb()){var l;if(k==e)t&&b.$Delay(z.Gg,20);else{if(k==f)l=e;else if(!k)l=f;else l=c.Ee();(k!=f||!Ic())&&c.tc(l,B)}}}};c.Ag=function(){f==e&&f==c.z()&&c.L(m)};c.Hg=function(){D&&D.Qb==h&&D.Ob();var b=c.z();b<e&&a.k(j.$EVT_STATE_CHANGE,h,-b-1,i,m,f,e)};c.he=function(a){q&&b.Fb(T,a&&q.ye.$Outside?"":"hidden")};c.kd=function(c,b){if(o&&b>=g){o=k;z.Wd();D.Ob();a.k(j.$EVT_SLIDESHOW_END,h,g,i,u,g,e)}a.k(j.$EVT_PROGRESS_CHANGE,h,b,i,m,f,e)};c.zg=function(a){if(a&&!w){w=a;a.$On($JssorPlayer$.vf,C)}};c.a(s,n.pc,A);q&&c.zd(q);g=c.vb();c.zd(s);m=g+s.qc;e=c.vb();f=t?g+s.fd:e;c.$Destroy=function(){E.$Destroy();c.S()}}function rc(){Nb=fb;hc=A.Ee();bb=B.z();hb=Nc(bb)}function Kc(){rc();if(y||Jb()){A.S();a.k(j.kg)}}function Jc(f){if(Ib()){var b=B.z(),a=hb,e=0;if(f&&c.P(L)>=m.$MinDragOffsetToSlide){a=b;e=Db}a=c.H(a);a=xb(a+e,.5);var d=c.P(a-b);if(d<1&&m.$SlideEasing!=g.$Linear)d=c.B(d,.5);if((!db||!f)&&Nb)A.tc(hc);else if(b==a)tc.Bc();else A.se(b,a,d*Gb)}}function gc(a){!b.kb(b.$EvtSrc(a),f,o.ze)&&b.$CancelEvent(a)}function Ac(b){Fb=k;y=d;Kc();if(!Nb)z=0;a.k(j.$EVT_DRAG_START,v(bb),bb,b)}function Yc(a){Ec(a,1)}function Ec(c,d){L=0;Ab=0;Db=0;kc=sc;if(d){var i=c.touches[0];Eb={x:i.clientX,y:i.clientY}}else Eb=b.Tc(c);var e=b.$EvtSrc(c),g=b.kb(e,"1",ic);if((!g||g===u)&&!W&&(!d||b.A(c.touches)==1)){nb=b.kb(e,f,o.ze)||!mb||!Zc();a.a(h,d?"touchmove":"mousemove",ac);Fb=!nb&&b.kb(e,f,o.Dd);!Fb&&!nb&&Ac(c,d)}}function ac(a){var e,f;a=b.Zf(a);if(a.type!="mousemove")if(b.A(a.touches)==1){f=a.touches[0];e={x:f.clientX,y:f.clientY}}else gb();else e=b.Tc(a);if(e){var i=e.x-Eb.x,j=e.y-Eb.y,g=c.P(i),h=c.P(j);if(z||g>1.5||h>1.5)if(Fb)Ac(a,f);else{if(c.G(hb)!=hb)z=z||S&W;if((i||j)&&!z){if(W==3)if(h>g)z=2;else z=1;else z=W;if(Vb&&z==1&&h>g*2.4)nb=d}var l=i,k=ob;if(z==2){l=j;k=pb}(L-Ab)*qb<-1.5&&(Db=0);(L-Ab)*qb>1.5&&(Db=-1);Ab=L;L=l;mc=hb-L*qb/k/kc*m.$DragRatio;if(L&&z&&!nb){b.$CancelEvent(a);A.Ng(d);A.Wg(mc)}}}}function gb(){Uc();a.T(h,"mousemove",ac);a.T(h,"touchmove",ac);db=L;if(y){db&&t&8&&(t=0);A.S();y=k;var b=B.z();a.k(j.$EVT_DRAG_END,v(b),b,v(bb),bb);Y&12&&rc();Jc(d)}}function Oc(c){var e=b.$EvtSrc(c),a=b.kb(e,"1",Ob);if(u===a)if(db){b.$StopEvent(c);a=b.kb(e,f,"data-jssor-button","A");a&&b.$CancelEvent(c)}else{t&4&&(t=0);a=b.kb(e,f,"data-jssor-click");if(a){b.$CancelEvent(c);hitValues=(b.g(a,"data-jssor-click")||"").split(":");var g=b.Fh(hitValues[1]);hitValues[0]=="to"&&tb(g-1);hitValues[0]=="next"&&tb(g,f,d)}}}a.$SlidesCount=function(){return q};a.$CurrentIndex=function(){return r};a.$CurrentPosition=function(){return B.z()};a.$Idle=function(a){if(a==f)return Kb;Kb=a};a.$AutoPlay=function(a){if(a==f)return t;if(a!=t){t=a;t&&x[r]&&x[r].Bc()}};a.$IsDragging=function(){return y};a.$IsSliding=function(){return fb};a.$IsMouseOver=function(){return!U};a.$LastDragSucceeded=function(){return db};a.$OriginalWidth=function(){return O};a.$OriginalHeight=function(){return M};a.$ScaleHeight=function(b){if(b==f)return Cc||M;a.$ScaleSize(b/M*O,b)};a.$ScaleWidth=function(b){if(b==f)return Zb||O;a.$ScaleSize(b,b/O*M)};a.$ScaleSize=function(c,a,d){b.K(u,c);b.J(u,a);Hc=c/O;Bc=a/M;b.f(nc,function(a){a.$ScaleSize(Hc,Bc,d)});if(!Zb){b.pb(T,w);b.V(T,0);b.U(T,0)}Zb=c;Cc=a};a.lf=yc;a.ef=wc;a.$PlayTo=tb;a.$GoTo=ub;a.$Next=function(){Wb(1)};a.$Prev=function(){Wb(-1)};a.$Pause=function(){t=0};a.$Play=function(){a.$AutoPlay(t||1)};a.$SetSlideshowTransitions=function(a){m.$SlideshowOptions.$Transitions=a};a.Id=function(a){a=v(a);if(C&1){var d=F/E,b=v(B.z()),e=v(a-b+d),f=v(c.P(a-b));if(e>=N){if(f>q/2)if(a>b)a-=q;else a+=q}else if(a>b&&e<d)a-=q;else if(a<b&&e>d)a+=q}return a};function Xc(){cc.re&&b.R(w,cc.re,([e,"pan-y","pan-x","auto"])[mb]||"");a.a(u,"click",Oc,d);a.a(u,"mouseleave",Mc);a.a(u,"mouseenter",Lc);a.a(u,"mousedown",Ec);a.a(u,"touchstart",Yc);a.a(u,"dragstart",gc);a.a(u,"selectstart",gc);a.a(i,"mouseup",gb);a.a(h,"mouseup",gb);a.a(h,"touchend",gb);a.a(h,"touchcancel",gb);a.a(i,"blur",gb);m.$ArrowKeyNavigation&&a.a(h,"keydown",function(c){if(!b.qe(b.$EvtSrc(c))){var a=b.Je(c);if(a==37||a==39){t&8&&(t=0);fc(m.$ArrowKeyNavigation*(a-38)*qb,d)}}})}function uc(d){Gc.Ve();H=[];x=[];var e=b.jb(w),g=b.Fd(["DIV","A","LI"]);b.f(e,function(a){var c=a;if(g[a.tagName.toUpperCase()]&&!b.hb(a,"u")&&b.nb(a)!="none"){b.Jc(a,"flat");b.rb(a,ab);H.push(a)}b.N(c,(b.N(c)||0)+1)});q=b.A(H);if(q){var a=S&1?zb:yb;b.rb(R,ab);F=m.$Align;if(F==f)F=(a-E+P)/2;lb=a/E;N=c.j(q,m.$Cols||q,c.H(lb));C=N<q?m.$Loop:0;if(q*E-P<=a){lb=q-P/E;F=(a-E+P)/2;Lb=(a-E*q+P)/2}if(Cb){Qb=Cb.$Class;Sb=!F&&N==1&&q>1&&Qb&&(!b.ue()||b.Cd()>=9)}if(!(C&1)){cb=F/E;if(cb>q-1){cb=q-1;F=cb*E}K=cb;Q=K+q-lb-P/E}mb=(N>1||F?S:-1)&m.$DragOrientation;if(Sb)D=new Qb(Bb,I,G,Cb,Vb,lc);b.f(H,function(a,b){x.push(new bd(a,b))});rb=new cd;B=new dd;A=new Tc(B,rb);Xc()}b.f(Z,function(a){a.nd(q,x);d&&a.$On(s.uc,fc)})}function Pb(a,d,g){b.Md(a)&&(a=b.je("",a));var c,e;if(q){if(d==f)d=q;e="beforebegin";c=H[d];if(!c){e="afterend";c=H[q-1]}}b.$Destroy(x);a&&b.oh(c||w,e||"afterbegin",a);b.f(g,function(a){b.ib(a)});uc()}a.$AppendSlides=function(e,a){if(a==f)a=r+1;var d=H[r];Pb(e,a);var c=0;b.f(H,function(a,b){a==d&&(c=b)});ub(c)};a.$ReloadSlides=function(a){Pb(a,e,H);ub(0)};a.$RemoveSlides=function(f){var a=r,d=[];b.f(f,function(b){if(b<q&&b>=0){d.push(H[b]);b<r&&a--}});Pb(e,e,d);a=c.j(a,q-1);ub(a)};a.F=function(i,e){a.$Elmt=u=b.$GetElement(i);O=b.K(u);M=b.J(u);m=b.v({$FillMode:0,$LazyLoading:1,$ArrowKeyNavigation:1,$StartIndex:0,$AutoPlay:0,$Loop:1,$HWA:d,$NaviQuitDrag:d,$AutoPlaySteps:1,$Idle:3e3,$PauseOnHover:1,$SlideDuration:500,$SlideEasing:g.$OutQuad,$MinDragOffsetToSlide:20,$DragRatio:1,$SlideSpacing:0,$UISearchMode:1,$PlayOrientation:1,$DragOrientation:1},e);m.$HWA=m.$HWA&&b.gg();if(m.$DisplayPieces!=f)m.$Cols=m.$DisplayPieces;if(m.$ParkingPosition!=f)m.$Align=m.$ParkingPosition;t=m.$AutoPlay&63;!m.$UISearchMode;eb=m.$AutoPlaySteps;Y=m.$PauseOnHover;Y&=Vb?10:5;Kb=m.$Idle;Gb=m.$SlideDuration;S=m.$PlayOrientation&3;vb=b.mg(b.g(u,"dir"))=="rtl";Hb=vb&&(S==1||m.$DragOrientation&1);qb=Hb?-1:1;Cb=m.$SlideshowOptions;kb=b.v({$Class:n},m.$CaptionSliderOptions);jb=m.$BulletNavigatorOptions;X=m.$ArrowNavigatorOptions;J=m.$ThumbnailNavigatorOptions;var c=b.jb(u);b.f(c,function(a,d){var c=b.hb(a,"u");if(c=="loading")R=a;else{if(c=="slides"){w=a;b.R(w,"margin",0);b.R(w,"padding",0);b.Jc(w,"flat")}if(c=="navigator")Mb=a;if(c=="arrowleft")bc=a;if(c=="arrowright")Yb=a;if(c=="thumbnavigator")wb=a;if(a.tagName!="STYLE"&&a.tagName!="SCRIPT")nc[c||d]=new Rc(a,c=="slides",b.Fd(["slides","thumbnavigator"])[c])}});R&&b.ib(R);R=R||b.bc(h);zb=b.K(w);yb=b.J(w);I=m.$SlideWidth||zb;G=m.$SlideHeight||yb;ab={Eb:I,Gb:G,$Top:0,$Left:0,Me:"block",Pb:"absolute"};P=m.$SlideSpacing;ob=I+P;pb=G+P;E=S&1?ob:pb;Bb=new Qc;b.g(u,Ob,"1");b.N(w,b.N(w)||0);b.db(w,"absolute");T=b.ab(w,d);b.R(T,"pointerEvents","none");b.pb(T,w);b.O(T,Bb.$Elmt);b.Fb(w,"hidden");if(Mb&&jb){jb.Yb=vb;vc=new jb.$Class(Mb,jb,O,M);Z.push(vc)}if(X&&bc&&Yb){X.Yb=vb;X.$Loop=m.$Loop;xc=new X.$Class(bc,Yb,X,a);Z.push(xc)}if(wb&&J){J.$StartIndex=m.$StartIndex;J.$ArrowKeyNavigation=J.$ArrowKeyNavigation||0;J.Yb=vb;oc=new J.$Class(wb,J,R);!J.$NoDrag&&b.g(wb,ic,"1");Z.push(oc)}uc(d);a.$ScaleSize(O,M);Ub();ub(m.$StartIndex);b.R(u,"visibility","visible")};a.$Destroy=function(){t=0;b.$Destroy(x,Z,Gc);b.Rb(u)};b.F(a)};j.$EVT_CLICK=21;j.$EVT_DRAG_START=22;j.$EVT_DRAG_END=23;j.$EVT_SWIPE_START=24;j.$EVT_SWIPE_END=25;j.$EVT_LOAD_START=26;j.$EVT_LOAD_END=27;j.kg=28;j.$EVT_MOUSE_ENTER=31;j.$EVT_MOUSE_LEAVE=32;j.$EVT_POSITION_CHANGE=202;j.$EVT_PARK=203;j.$EVT_SLIDESHOW_START=206;j.$EVT_SLIDESHOW_END=207;j.$EVT_PROGRESS_CHANGE=208;j.$EVT_STATE_CHANGE=209}(window,document,Math,null,true,false);
/*!
 * jQuery Expander Plugin - v1.7.0 - 2016-03-12
 * http://plugins.learningjquery.com/expander/
 * Copyright (c) 2016 Karl Swedberg
 * Licensed MIT (http://www.opensource.org/licenses/mit-license.php)
 */
!function(a){"function"==typeof define&&define.amd?define(["jquery"],a):"object"==typeof module&&"object"==typeof module.exports?module.exports=a:a(jQuery)}(function(a){a.expander={version:"1.7.0",defaults:{slicePoint:100,sliceOn:null,preserveWords:!0,normalizeWhitespace:!0,showWordCount:!1,detailPrefix:" ",wordCountText:" ({{count}} words)",widow:4,expandText:"read more",expandPrefix:"&hellip; ",expandAfterSummary:!1,wordEnd:/(&(?:[^;]+;)?|[0-9a-zA-Z\u00C0-\u0100]+|[^\u0000-\u007F]+)$/,summaryClass:"summary",detailClass:"details",moreClass:"read-more",lessClass:"read-less",moreLinkClass:"more-link",lessLinkClass:"less-link",collapseTimer:0,expandEffect:"slideDown",expandSpeed:250,collapseEffect:"slideUp",collapseSpeed:200,userCollapse:!0,userCollapseText:"read less",userCollapsePrefix:" ",onSlice:null,beforeExpand:null,afterExpand:null,onCollapse:null,afterCollapse:null}},a.fn.expander=function(b){function c(a,b){var c="span",d=a.summary,e=q.exec(d),f=e?e[2].toLowerCase():"";return b?(c="div",e&&"a"!==f&&!a.expandAfterSummary?d=d.replace(q,a.moreLabel+"$1"):d+=a.moreLabel,d='<div class="'+a.summaryClass+'">'+d+"</div>"):d+=a.moreLabel,[d,a.detailPrefix||"","<",c+' class="'+a.detailClass+'"',">",a.details,"</"+c+">"].join("")}function d(a,b){var c='<span class="'+a.moreClass+'">'+a.expandPrefix;return a.showWordCount?a.wordCountText=a.wordCountText.replace(/\{\{count\}\}/,b.replace(n,"").replace(/\&(?:amp|nbsp);/g,"").replace(/(?:^\s+|\s+$)/,"").match(/\w+/g).length):a.wordCountText="",c+='<a href="#" class="'+a.moreLinkClass+'">'+a.expandText+a.wordCountText+"</a></span>"}function e(b,c){return b.lastIndexOf("<")>b.lastIndexOf(">")&&(b=b.slice(0,b.lastIndexOf("<"))),c&&(b=b.replace(m,"")),a.trim(b)}function f(a,b){b.stop(!0,!0)[a.collapseEffect](a.collapseSpeed,function(){var c=b.prev("span."+a.moreClass).show();c.length||b.parent().children("div."+a.summaryClass).show().find("span."+a.moreClass).show(),a.afterCollapse&&a.afterCollapse.call(b)})}function g(b,c,d){b.collapseTimer&&(j=setTimeout(function(){f(b,c),a.isFunction(b.onCollapse)&&b.onCollapse.call(d,!1)},b.collapseTimer))}function h(b){var c="ExpandMoreHere374216623",d=b.summaryText.replace(b.sliceOn,c);d=a("<div>"+d+"</div>").text();var e=d.indexOf(c),f=b.summaryText.indexOf(b.sliceOn);return-1!==e&&e<b.slicePoint&&(b.summaryText=b.allHtml.slice(0,f)),b}var i="init";"string"==typeof b&&(i=b,b={});var j,k=a.extend({},a.expander.defaults,b),l=/^<(?:area|br|col|embed|hr|img|input|link|meta|param).*>$/i,m=k.wordEnd,n=/<\/?(\w+)[^>]*>/g,o=/<(\w+)[^>]*>/g,p=/<\/(\w+)>/g,q=/(<\/([^>]+)>)\s*$/,r=/^(<[^>]+>)+.?/,s=/\s\s+/g,t=function(b){return k.normalizeWhitespace?a.trim(b||"").replace(s," "):b},u={init:function(){this.each(function(){var b,i,m,q,s,u,v,w,x,y,z,A,B,C,D,E=[],F=[],G="",H={},I=this,J=a(this),K=a([]),L=a.extend({},k,J.data("expander")||a.meta&&J.data()||{}),M=!!J.find("."+L.detailClass).length,N=!!J.find("*").filter(function(){var b=a(this).css("display");return/^block|table|list/.test(b)}).length,O=N?"div":"span",P=O+"."+L.detailClass,Q=L.moreClass+"",R=L.lessClass+"",S=L.expandSpeed||0,T=t(J.html()),U=T.slice(0,L.slicePoint);if(L.moreSelector="span."+Q.split(" ").join("."),L.lessSelector="span."+R.split(" ").join("."),!a.data(this,"expanderInit")){for(a.data(this,"expanderInit",!0),a.data(this,"expander",L),a.each(["onSlice","beforeExpand","afterExpand","onCollapse","afterCollapse"],function(b,c){H[c]=a.isFunction(L[c])}),U=e(U),s=U.replace(n,"").length;s<L.slicePoint;)q=T.charAt(U.length),"<"===q&&(q=T.slice(U.length).match(r)[0]),U+=q,s++;for(L.sliceOn&&(D=h({sliceOn:L.sliceOn,slicePoint:L.slicePoint,allHtml:T,summaryText:U}),U=D.summaryText),U=e(U,L.preserveWords&&T.slice(U.length).length),u=U.match(o)||[],v=U.match(p)||[],m=[],a.each(u,function(a,b){l.test(b)||m.push(b)}),u=m,i=v.length,b=0;i>b;b++)v[b]=v[b].replace(p,"$1");if(a.each(u,function(b,c){var d=c.replace(o,"$1"),e=a.inArray(d,v);-1===e?(E.push(c),F.push("</"+d+">")):v.splice(e,1)}),F.reverse(),M)x=J.find(P).remove().html(),U=J.html(),T=U+x,w="";else{if(x=T.slice(U.length),y=a.trim(x.replace(n,"")),""===y||y.split(/\s+/).length<L.widow)return;w=F.pop()||"",U+=F.join(""),x=E.join("")+x}L.moreLabel=J.find(L.moreSelector).length?"":d(L,x),N?x=T:"&"===U.charAt(U.length-1)&&(G=/^[#\w\d\\]+;/.exec(x),G&&(x=x.slice(G[0].length),U+=G[0])),U+=w,L.summary=U,L.details=x,L.lastCloseTag=w,H.onSlice&&(m=L.onSlice.call(I,L),L=m&&m.details?m:L),z=c(L,N),J.empty().append(z),B=J.find(P),C=J.find(L.moreSelector),"slideUp"===L.collapseEffect&&"slideDown"!==L.expandEffect||J.is(":hidden")?B.css({display:"none"}):B[L.collapseEffect](0),K=J.find("div."+L.summaryClass),A=function(a){a.preventDefault();var b=a.startExpanded?0:S;C.hide(),K.hide(),H.beforeExpand&&L.beforeExpand.call(I),B.stop(!1,!0)[L.expandEffect](b,function(){B.css({zoom:""}),H.afterExpand&&L.afterExpand.call(I),g(L,B,I)})},C.find("a").unbind("click.expander").bind("click.expander",A),L.userCollapse&&!J.find(L.lessSelector).length&&J.find(P).append('<span class="'+L.lessClass+'">'+L.userCollapsePrefix+'<a href="#" class="'+L.lessLinkClass+'">'+L.userCollapseText+"</a></span>"),J.find(L.lessSelector+" a").unbind("click.expander").bind("click.expander",function(b){b.preventDefault(),clearTimeout(j);var c=a(this).closest(P);f(L,c),H.onCollapse&&L.onCollapse.call(I,!0)}),L.startExpanded&&A({preventDefault:function(){},startExpanded:!0})}})},destroy:function(){this.each(function(){var b,c,d=a(this);d.data("expanderInit")&&(b=a.extend({},d.data("expander")||{},k),c=d.find("."+b.detailClass).contents(),d.removeData("expanderInit"),d.removeData("expander"),d.find(b.moreSelector).remove(),d.find("."+b.summaryClass).remove(),d.find("."+b.detailClass).after(c).remove(),d.find(b.lessSelector).remove())})}};return u[i]&&u[i].call(this),this},a.fn.expander.defaults=a.expander.defaults});;
//Check to see if the window is top if not then display button
jQuery(window).scroll(function(){
	if (jQuery(this).scrollTop() > 100) {
		jQuery('.scrollToTop').fadeIn();
	} else {
		jQuery('.scrollToTop').fadeOut();
	}
});

//Click event to scroll to top
jQuery('.scrollToTop').click(function(){
	jQuery('html, body').animate({scrollTop : 0},800);
	return false;
});

//----------------------------------------------------

jssor_1_slider_init = function() {
            //console.log("jssor_1_slider_init");
	    var jssor_1_SlideshowTransitions = [
                   {$Duration:1200,$Opacity:2}
            ];
            var jssor_1_options = {
              $AutoPlay: 1,
              $PauseOnHover: 1,
              $SlideshowOptions: {
                $Class: $JssorSlideshowRunner$,
                $Transitions: jssor_1_SlideshowTransitions,
                $TransitionsOrder: 1,
                $ShowLink: true
              },
              $ArrowNavigatorOptions: {
                $Class: $JssorArrowNavigator$
              },
              $BulletNavigatorOptions: {
                $Class: $JssorBulletNavigator$,
                $ChanceToShow: 2,  //[Required] 0 Never, 1 Mouse Over, 2 Always
                $Steps: 1,         //[Optional] Steps to go for each navigation request, default value is 1
                $Rows: 1,          //[Optional] Specify lanes to arrange items, default value is 1
                $SpacingX: 10,     //[Optional] Horizontal space between each item in pixel, default value is 0
                $SpacingY: 100,     //[Optional] Vertical space between each item in pixel, default value is 0
                $Orientation: 1    //[Optional] The orientation of the navigator, 1 horizontal, 2 vertical, default value is 1
              }
            };

            //console.log("jssor_1_slider_1");
            var jssor_1_slider = new $JssorSlider$("jssor_1", jssor_1_options);
            //console.log("jssor_1_slider_2");

            /*responsive code begin*/
            /*remove responsive code if you don't want the slider scales while window resizing*/
            function ScaleSlider() {
                var refSize = jssor_1_slider.$Elmt.parentNode.clientWidth;
                //console.log("jssor_1_slider_3");
                if (refSize) {
                    refSize = Math.min(refSize, 600);
                    jssor_1_slider.$ScaleWidth(refSize);
                }
                else {
                    jQuery(window).setTimeout(ScaleSlider, 30);
                }
            }
            //ScaleSlider();
            jQuery(window).bind("load", ScaleSlider);
            jQuery(window).bind("resize", ScaleSlider);
            jQuery(window).bind("orientationchange", ScaleSlider);
            /*responsive code end*/
};
jssor_1_slider_init();

jQuery('.toolong').expander({
  slicePoint: 318,
  preserveWords: true,
  //collapseTimer: 4000,
  widow: 2,
  expandEffect: 'fadeIn',
  userCollapseEffect: 'fadeOut',
  expandText: '<span class="fa fa-plus-square"></span>',
  //expandText: '[...]',
  userCollapseText: '<i class="fa fa-minus-square"></i>'
});
;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function (Drupal, drupalSettings) {
  Drupal.behaviors.activeLinks = {
    attach: function attach(context) {
      var path = drupalSettings.path;
      var queryString = JSON.stringify(path.currentQuery);
      var querySelector = path.currentQuery ? "[data-drupal-link-query='".concat(queryString, "']") : ':not([data-drupal-link-query])';
      var originalSelectors = ["[data-drupal-link-system-path=\"".concat(path.currentPath, "\"]")];
      var selectors;
      if (path.isFront) {
        originalSelectors.push('[data-drupal-link-system-path="<front>"]');
      }
      selectors = [].concat(originalSelectors.map(function (selector) {
        return "".concat(selector, ":not([hreflang])");
      }), originalSelectors.map(function (selector) {
        return "".concat(selector, "[hreflang=\"").concat(path.currentLanguage, "\"]");
      }));
      selectors = selectors.map(function (current) {
        return current + querySelector;
      });
      var activeLinks = context.querySelectorAll(selectors.join(','));
      var il = activeLinks.length;
      for (var i = 0; i < il; i++) {
        activeLinks[i].classList.add('is-active');
      }
    },
    detach: function detach(context, settings, trigger) {
      if (trigger === 'unload') {
        var activeLinks = context.querySelectorAll('[data-drupal-link-system-path].is-active');
        var il = activeLinks.length;
        for (var i = 0; i < il; i++) {
          activeLinks[i].classList.remove('is-active');
        }
      }
    }
  };
})(Drupal, drupalSettings);;
/**
 * @file
 * Webform behaviors.
 */

(function ($, Drupal) {

  'use strict';

  // Trigger Drupal's attaching of behaviors after the page is
  // completely loaded.
  // @see https://stackoverflow.com/questions/37838430/detect-if-page-is-load-from-back-button
  // @see https://stackoverflow.com/questions/20899274/how-to-refresh-page-on-back-button-click/20899422#20899422
  var isChrome = (/chrom(e|ium)/.test(window.navigator.userAgent.toLowerCase()));
  if (isChrome) {
    // Track back button in navigation.
    // @see https://stackoverflow.com/questions/37838430/detect-if-page-is-load-from-back-button
    var backButton = false;
    if (window.performance) {
      var navEntries = window.performance.getEntriesByType('navigation');
      if (navEntries.length > 0 && navEntries[0].type === 'back_forward') {
        backButton = true;
      }
      else if (window.performance.navigation
        && window.performance.navigation.type === window.performance.navigation.TYPE_BACK_FORWARD) {
        backButton = true;
      }
    }

    // If the back button is pressed, delay Drupal's attaching of behaviors.
    if (backButton) {
      var attachBehaviors = Drupal.attachBehaviors;
      Drupal.attachBehaviors = function (context, settings) {
        setTimeout(function (context, settings) {
          attachBehaviors(context, settings);
        }, 300);
      };
    }
  }

})(jQuery, Drupal);
;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Drupal) {
  var states = {
    postponed: []
  };
  Drupal.states = states;
  function invert(a, invertState) {
    return invertState && typeof a !== 'undefined' ? !a : a;
  }
  function _compare2(a, b) {
    if (a === b) {
      return typeof a === 'undefined' ? a : true;
    }
    return typeof a === 'undefined' || typeof b === 'undefined';
  }
  function ternary(a, b) {
    if (typeof a === 'undefined') {
      return b;
    }
    if (typeof b === 'undefined') {
      return a;
    }
    return a && b;
  }
  Drupal.behaviors.states = {
    attach: function attach(context, settings) {
      var $states = $(context).find('[data-drupal-states]');
      var il = $states.length;
      var _loop = function _loop(i) {
        var config = JSON.parse($states[i].getAttribute('data-drupal-states'));
        Object.keys(config || {}).forEach(function (state) {
          new states.Dependent({
            element: $($states[i]),
            state: states.State.sanitize(state),
            constraints: config[state]
          });
        });
      };
      for (var i = 0; i < il; i++) {
        _loop(i);
      }
      while (states.postponed.length) {
        states.postponed.shift()();
      }
    }
  };
  states.Dependent = function (args) {
    var _this = this;
    $.extend(this, {
      values: {},
      oldValue: null
    }, args);
    this.dependees = this.getDependees();
    Object.keys(this.dependees || {}).forEach(function (selector) {
      _this.initializeDependee(selector, _this.dependees[selector]);
    });
  };
  states.Dependent.comparisons = {
    RegExp: function RegExp(reference, value) {
      return reference.test(value);
    },
    Function: function Function(reference, value) {
      return reference(value);
    },
    Number: function Number(reference, value) {
      return typeof value === 'string' ? _compare2(reference.toString(), value) : _compare2(reference, value);
    }
  };
  states.Dependent.prototype = {
    initializeDependee: function initializeDependee(selector, dependeeStates) {
      var _this2 = this;
      this.values[selector] = {};
      Object.keys(dependeeStates).forEach(function (i) {
        var state = dependeeStates[i];
        if ($.inArray(state, dependeeStates) === -1) {
          return;
        }
        state = states.State.sanitize(state);
        _this2.values[selector][state.name] = null;
        $(selector).on("state:".concat(state), {
          selector: selector,
          state: state
        }, function (e) {
          _this2.update(e.data.selector, e.data.state, e.value);
        });
        new states.Trigger({
          selector: selector,
          state: state
        });
      });
    },
    compare: function compare(reference, selector, state) {
      var value = this.values[selector][state.name];
      if (reference.constructor.name in states.Dependent.comparisons) {
        return states.Dependent.comparisons[reference.constructor.name](reference, value);
      }
      return _compare2(reference, value);
    },
    update: function update(selector, state, value) {
      if (value !== this.values[selector][state.name]) {
        this.values[selector][state.name] = value;
        this.reevaluate();
      }
    },
    reevaluate: function reevaluate() {
      var value = this.verifyConstraints(this.constraints);
      if (value !== this.oldValue) {
        this.oldValue = value;
        value = invert(value, this.state.invert);
        this.element.trigger({
          type: "state:".concat(this.state),
          value: value,
          trigger: true
        });
      }
    },
    verifyConstraints: function verifyConstraints(constraints, selector) {
      var result;
      if ($.isArray(constraints)) {
        var hasXor = $.inArray('xor', constraints) === -1;
        var len = constraints.length;
        for (var i = 0; i < len; i++) {
          if (constraints[i] !== 'xor') {
            var constraint = this.checkConstraints(constraints[i], selector, i);
            if (constraint && (hasXor || result)) {
              return hasXor;
            }
            result = result || constraint;
          }
        }
      } else if ($.isPlainObject(constraints)) {
        for (var n in constraints) {
          if (constraints.hasOwnProperty(n)) {
            result = ternary(result, this.checkConstraints(constraints[n], selector, n));
            if (result === false) {
              return false;
            }
          }
        }
      }
      return result;
    },
    checkConstraints: function checkConstraints(value, selector, state) {
      if (typeof state !== 'string' || /[0-9]/.test(state[0])) {
        state = null;
      } else if (typeof selector === 'undefined') {
        selector = state;
        state = null;
      }
      if (state !== null) {
        state = states.State.sanitize(state);
        return invert(this.compare(value, selector, state), state.invert);
      }
      return this.verifyConstraints(value, selector);
    },
    getDependees: function getDependees() {
      var cache = {};
      var _compare = this.compare;
      this.compare = function (reference, selector, state) {
        (cache[selector] || (cache[selector] = [])).push(state.name);
      };
      this.verifyConstraints(this.constraints);
      this.compare = _compare;
      return cache;
    }
  };
  states.Trigger = function (args) {
    $.extend(this, args);
    if (this.state in states.Trigger.states) {
      this.element = $(this.selector);
      if (!this.element.data("trigger:".concat(this.state))) {
        this.initialize();
      }
    }
  };
  states.Trigger.prototype = {
    initialize: function initialize() {
      var _this3 = this;
      var trigger = states.Trigger.states[this.state];
      if (typeof trigger === 'function') {
        trigger.call(window, this.element);
      } else {
        Object.keys(trigger || {}).forEach(function (event) {
          _this3.defaultTrigger(event, trigger[event]);
        });
      }
      this.element.data("trigger:".concat(this.state), true);
    },
    defaultTrigger: function defaultTrigger(event, valueFn) {
      var oldValue = valueFn.call(this.element);
      this.element.on(event, $.proxy(function (e) {
        var value = valueFn.call(this.element, e);
        if (oldValue !== value) {
          this.element.trigger({
            type: "state:".concat(this.state),
            value: value,
            oldValue: oldValue
          });
          oldValue = value;
        }
      }, this));
      states.postponed.push($.proxy(function () {
        this.element.trigger({
          type: "state:".concat(this.state),
          value: oldValue,
          oldValue: null
        });
      }, this));
    }
  };
  states.Trigger.states = {
    empty: {
      keyup: function keyup() {
        return this.val() === '';
      },
      change: function change() {
        return this.val() === '';
      }
    },
    checked: {
      change: function change() {
        var checked = false;
        this.each(function () {
          checked = $(this).prop('checked');
          return !checked;
        });
        return checked;
      }
    },
    value: {
      keyup: function keyup() {
        if (this.length > 1) {
          return this.filter(':checked').val() || false;
        }
        return this.val();
      },
      change: function change() {
        if (this.length > 1) {
          return this.filter(':checked').val() || false;
        }
        return this.val();
      }
    },
    collapsed: {
      collapsed: function collapsed(e) {
        return typeof e !== 'undefined' && 'value' in e ? e.value : !this.is('[open]');
      }
    }
  };
  states.State = function (state) {
    this.pristine = state;
    this.name = state;
    var process = true;
    do {
      while (this.name.charAt(0) === '!') {
        this.name = this.name.substring(1);
        this.invert = !this.invert;
      }
      if (this.name in states.State.aliases) {
        this.name = states.State.aliases[this.name];
      } else {
        process = false;
      }
    } while (process);
  };
  states.State.sanitize = function (state) {
    if (state instanceof states.State) {
      return state;
    }
    return new states.State(state);
  };
  states.State.aliases = {
    enabled: '!disabled',
    invisible: '!visible',
    invalid: '!valid',
    untouched: '!touched',
    optional: '!required',
    filled: '!empty',
    unchecked: '!checked',
    irrelevant: '!relevant',
    expanded: '!collapsed',
    open: '!collapsed',
    closed: 'collapsed',
    readwrite: '!readonly'
  };
  states.State.prototype = {
    invert: false,
    toString: function toString() {
      return this.name;
    }
  };
  var $document = $(document);
  $document.on('state:disabled', function (e) {
    if (e.trigger) {
      $(e.target).closest('.js-form-item, .js-form-submit, .js-form-wrapper').toggleClass('form-disabled', e.value).find('select, input, textarea').prop('disabled', e.value);
    }
  });
  $document.on('state:required', function (e) {
    if (e.trigger) {
      if (e.value) {
        var label = "label".concat(e.target.id ? "[for=".concat(e.target.id, "]") : '');
        var $label = $(e.target).attr({
          required: 'required',
          'aria-required': 'true'
        }).closest('.js-form-item, .js-form-wrapper').find(label);
        if (!$label.hasClass('js-form-required').length) {
          $label.addClass('js-form-required form-required');
        }
      } else {
        $(e.target).removeAttr('required aria-required').closest('.js-form-item, .js-form-wrapper').find('label.js-form-required').removeClass('js-form-required form-required');
      }
    }
  });
  $document.on('state:visible', function (e) {
    if (e.trigger) {
      $(e.target).closest('.js-form-item, .js-form-submit, .js-form-wrapper').toggle(e.value);
    }
  });
  $document.on('state:checked', function (e) {
    if (e.trigger) {
      $(e.target).closest('.js-form-item, .js-form-wrapper').find('input').prop('checked', e.value).trigger('change');
    }
  });
  $document.on('state:collapsed', function (e) {
    if (e.trigger) {
      if ($(e.target).is('[open]') === e.value) {
        $(e.target).find('> summary').trigger('click');
      }
    }
  });
})(jQuery, Drupal);;
/**
 * @file
 * Extends core/misc/states.js.
 */
(function($) {

  // Unbind core state.js from document first so we can then override below.
  $(document).unbind('state:disabled');

  /**
   * Global state change handlers. These are bound to "document" to cover all
   * elements whose state changes. Events sent to elements within the page
   * bubble up to these handlers. We use this system so that themes and modules
   * can override these state change handlers for particular parts of a page.
   */
  $(document).bind('state:disabled', function(e) {
    // Only act when this change was triggered by a dependency and not by the
    // element monitoring itself.
    if (e.trigger) {
      $(e.target)
        .attr('disabled', e.value)
        .closest('.form-item, .form-submit, .form-wrapper').toggleClass('form-disabled', e.value)
        .find(':input').attr('disabled', e.value);

      // Note: WebKit nightlies don't reflect that change correctly.
      // See https://bugs.webkit.org/show_bug.cgi?id=23789
    }
  });

})(jQuery);
;
/**
 * @file
 * JavaScript behaviors for custom webform #states.
 */

(function ($, Drupal, once) {

  'use strict';

  Drupal.webform = Drupal.webform || {};
  Drupal.webform.states = Drupal.webform.states || {};
  Drupal.webform.states.slideDown = Drupal.webform.states.slideDown || {};
  Drupal.webform.states.slideDown.duration = 'slow';
  Drupal.webform.states.slideUp = Drupal.webform.states.slideUp || {};
  Drupal.webform.states.slideUp.duration = 'fast';

  /* ************************************************************************ */
  // jQuery functions.
  /* ************************************************************************ */

  /**
   * Check if an element has a specified data attribute.
   *
   * @param {string} data
   *   The data attribute name.
   *
   * @return {boolean}
   *   TRUE if an element has a specified data attribute.
   */
  $.fn.hasData = function (data) {
    return (typeof this.data(data) !== 'undefined');
  };

  /**
   * Check if element is within the webform or not.
   *
   * @return {boolean}
   *   TRUE if element is within the webform.
   */
  $.fn.isWebform = function () {
    return $(this).closest('form.webform-submission-form, form[id^="webform"], form[data-is-webform]').length ? true : false;
  };

  /**
   * Check if element is to be treated as a webform element.
   *
   * @return {boolean}
   *   TRUE if element is to be treated as a webform element.
   */
  $.fn.isWebformElement = function () {
    return ($(this).isWebform() || $(this).closest('[data-is-webform-element]').length) ? true : false;
  };

  /* ************************************************************************ */
  // Trigger.
  /* ************************************************************************ */

  // The change event is triggered by cut-n-paste and select menus.
  // Issue #2445271: #states element empty check not triggered on mouse
  // based paste.
  // @see https://www.drupal.org/node/2445271
  Drupal.states.Trigger.states.empty.change = function change() {
    return this.val() === '';
  };

  /* ************************************************************************ */
  // Dependents.
  /* ************************************************************************ */

  // Apply solution included in #1962800 patch.
  // Issue #1962800: Form #states not working with literal integers as
  // values in IE11.
  // @see https://www.drupal.org/project/drupal/issues/1962800
  // @see https://www.drupal.org/files/issues/core-states-not-working-with-integers-ie11_1962800_46.patch
  //
  // This issue causes pattern, less than, and greater than support to break.
  // @see https://www.drupal.org/project/webform/issues/2981724
  var states = Drupal.states;
  Drupal.states.Dependent.prototype.compare = function compare(reference, selector, state) {
    var value = this.values[selector][state.name];

    var name = reference.constructor.name;
    if (!name) {
      name = $.type(reference);

      name = name.charAt(0).toUpperCase() + name.slice(1);
    }
    if (name in states.Dependent.comparisons) {
      return states.Dependent.comparisons[name](reference, value);
    }

    if (reference.constructor.name in states.Dependent.comparisons) {
      return states.Dependent.comparisons[reference.constructor.name](reference, value);
    }

    return _compare2(reference, value);
  };
  function _compare2(a, b) {
    if (a === b) {
      return typeof a === 'undefined' ? a : true;
    }

    return typeof a === 'undefined' || typeof b === 'undefined';
  }

  // Adds pattern, less than, and greater than support to #state API.
  // @see http://drupalsun.com/julia-evans/2012/03/09/extending-form-api-states-regular-expressions
  Drupal.states.Dependent.comparisons.Object = function (reference, value) {
    if ('pattern' in reference) {
      return (new RegExp(reference['pattern'])).test(value);
    }
    else if ('!pattern' in reference) {
      return !((new RegExp(reference['!pattern'])).test(value));
    }
    else if ('less' in reference) {
      return (value !== '' && parseFloat(reference['less']) > parseFloat(value));
    }
    else if ('less_equal' in reference) {
      return (value !== '' && parseFloat(reference['less_equal']) >= parseFloat(value));
    }
    else if ('greater' in reference) {
      return (value !== '' && parseFloat(reference['greater']) < parseFloat(value));
    }
    else if ('greater_equal' in reference) {
      return (value !== '' && parseFloat(reference['greater_equal']) <= parseFloat(value));
    }
    else if ('between' in reference || '!between' in reference) {
      if (value === '') {
        return false;
      }

      var between = reference['between'] || reference['!between'];
      var betweenParts = between.split(':');
      var greater = betweenParts[0];
      var less = (typeof betweenParts[1] !== 'undefined') ? betweenParts[1] : null;
      var isGreaterThan = (greater === null || greater === '' || parseFloat(value) >= parseFloat(greater));
      var isLessThan = (less === null || less === '' || parseFloat(value) <= parseFloat(less));
      var result = (isGreaterThan && isLessThan);
      return (reference['!between']) ? !result : result;
    }
    else {
      return reference.indexOf(value) !== false;
    }
  };

  /* ************************************************************************ */
  // States events.
  /* ************************************************************************ */

  var $document = $(document);

  $document.on('state:required', function (e) {
    if (e.trigger && $(e.target).isWebformElement()) {
      var $target = $(e.target);
      // Fix #required file upload.
      // @see Issue #2860529: Conditional required File upload field don't work.
      toggleRequired($target.find('input[type="file"]'), e.value);

      // Fix #required for radios and likert.
      // @see Issue #2856795: If radio buttons are required but not filled form is nevertheless submitted.
      if ($target.is('.js-form-type-radios, .js-form-type-webform-radios-other, .js-webform-type-radios, .js-webform-type-webform-radios-other, .js-webform-type-webform-entity-radios, .webform-likert-table')) {
        $target.toggleClass('required', e.value);
        toggleRequired($target.find('input[type="radio"]'), e.value);
      }

      // Fix #required for checkboxes.
      // @see Issue #2938414: Checkboxes don't support #states required.
      // @see checkboxRequiredhandler
      if ($target.is('.js-form-type-checkboxes, .js-form-type-webform-checkboxes-other, .js-webform-type-checkboxes, .js-webform-type-webform-checkboxes-other')) {
        $target.toggleClass('required', e.value);
        var $checkboxes = $target.find('input[type="checkbox"]');
        if (e.value) {
          // Add event handler.
          $checkboxes.on('click', statesCheckboxesRequiredEventHandler);
          // Initialize and add required attribute.
          checkboxesRequired($target);
        }
        else {
          // Remove event handler.
          $checkboxes.off('click', statesCheckboxesRequiredEventHandler);
          // Remove required attribute.
          toggleRequired($checkboxes, false);
        }
      }

      // Fix #required for tableselect.
      // @see Issue #3212581: Table select does not trigger client side validation
      if ($target.is('.js-webform-tableselect')) {
        $target.toggleClass('required', e.value);
        var isMultiple = $target.is('[multiple]');
        if (isMultiple) {
          // Checkboxes.
          var $tbody = $target.find('tbody');
          var $checkboxes = $tbody.find('input[type="checkbox"]');
          copyRequireMessage($target, $checkboxes);
          if (e.value) {
            $checkboxes.on('click change', statesCheckboxesRequiredEventHandler);
            checkboxesRequired($tbody);
          }
          else {
            $checkboxes.off('click change ', statesCheckboxesRequiredEventHandler);
            toggleRequired($tbody, false);
          }
        }
        else {
          // Radios.
          var $radios = $target.find('input[type="radio"]');
          copyRequireMessage($target, $radios);
          toggleRequired($radios, e.value);
        }
      }

      // Fix required label for elements without the for attribute.
      // @see Issue #3145300: Conditional Visible Select Other not working.
      if ($target.is('.js-form-type-webform-select-other, .js-webform-type-webform-select-other')) {
        var $select = $target.find('select');
        toggleRequired($select, e.value);
        copyRequireMessage($target, $select);
      }
      if ($target.find('> label:not([for])').length) {
        $target.find('> label').toggleClass('js-form-required form-required', e.value);
      }

      // Fix required label for checkboxes and radios.
      // @see Issue #2938414: Checkboxes don't support #states required
      // @see Issue #2731991: Setting required on radios marks all options required.
      // @see Issue #2856315: Conditional Logic - Requiring Radios in a Fieldset.
      // Fix #required for fieldsets.
      // @see Issue #2977569: Hidden fieldsets that become visible with conditional logic cannot be made required.
      if ($target.is('.js-webform-type-radios, .js-webform-type-checkboxes, fieldset')) {
        $target.find('legend span.fieldset-legend:not(.visually-hidden)').toggleClass('js-form-required form-required', e.value);
      }

      // Issue #2986017: Fieldsets shouldn't have required attribute.
      if ($target.is('fieldset')) {
        $target.removeAttr('required aria-required');
      }
    }
  });

  $document.on('state:checked', function (e) {
    if (e.trigger) {
      $(e.target).trigger('change');
    }
  });

  $document.on('state:readonly', function (e) {
    if (e.trigger && $(e.target).isWebformElement()) {
      $(e.target).prop('readonly', e.value).closest('.js-form-item, .js-form-wrapper').toggleClass('webform-readonly', e.value).find('input, textarea').prop('readonly', e.value);

      // Trigger webform:readonly.
      $(e.target).trigger('webform:readonly')
        .find('select, input, textarea, button').trigger('webform:readonly');
    }
  });

  $document.on('state:visible state:visible-slide', function (e) {
    if (e.trigger && $(e.target).isWebformElement()) {
      if (e.value) {
        $(':input', e.target).addBack().each(function () {
          restoreValueAndRequired(this);
          triggerEventHandlers(this);
        });
      }
      else {
        // @see https://www.sitepoint.com/jquery-function-clear-form-data/
        $(':input', e.target).addBack().each(function () {
          backupValueAndRequired(this);
          clearValueAndRequired(this);
          triggerEventHandlers(this);
        });
      }
    }
  });

  $document.on('state:visible-slide', function (e) {
    if (e.trigger && $(e.target).isWebformElement()) {
      var effect = e.value ? 'slideDown' : 'slideUp';
      var duration = Drupal.webform.states[effect].duration;
      $(e.target).closest('.js-form-item, .js-form-submit, .js-form-wrapper')[effect](duration);
    }
  });
  Drupal.states.State.aliases['invisible-slide'] = '!visible-slide';

  $document.on('state:disabled', function (e) {
    if (e.trigger && $(e.target).isWebformElement()) {
      // Make sure disabled property is set before triggering webform:disabled.
      // Copied from: core/misc/states.js
      $(e.target)
        .prop('disabled', e.value)
        .closest('.js-form-item, .js-form-submit, .js-form-wrapper').toggleClass('form-disabled', e.value)
        .find('select, input, textarea, button').prop('disabled', e.value);

      // Never disable hidden file[fids] because the existing values will
      // be completely lost when the webform is submitted.
      var fileElements = $(e.target)
        .find(':input[type="hidden"][name$="[fids]"]');
      if (fileElements.length) {
        // Remove 'disabled' attribute from fieldset which will block
        // all disabled elements from being submitted.
        if ($(e.target).is('fieldset')) {
          $(e.target).prop('disabled', false);
        }
        fileElements.removeAttr('disabled');
      }

      // Trigger webform:disabled.
      $(e.target).trigger('webform:disabled')
        .find('select, input, textarea, button').trigger('webform:disabled');
    }
  });

  /* ************************************************************************ */
  // Behaviors.
  /* ************************************************************************ */

  /**
   * Adds HTML5 validation to required checkboxes.
   *
   * @type {Drupal~behavior}
   *
   * @see https://www.drupal.org/project/webform/issues/3068998
   */
  Drupal.behaviors.webformCheckboxesRequired = {
    attach: function (context) {
      $(once('webform-checkboxes-required', '.js-form-type-checkboxes.required, .js-form-type-webform-checkboxes-other.required, .js-webform-type-checkboxes.required, .js-webform-type-webform-checkboxes-other.required, .js-webform-type-webform-radios-other.checkboxes', context))
        .each(function () {
          var $element = $(this);
          $element.find('input[type="checkbox"]').on('click', statesCheckboxesRequiredEventHandler);
          setTimeout(function () {checkboxesRequired($element);});
        });
    }
  };

  /**
   * Adds HTML5 validation to required radios.
   *
   * @type {Drupal~behavior}
   *
   * @see https://www.drupal.org/project/webform/issues/2856795
   */
  Drupal.behaviors.webformRadiosRequired = {
    attach: function (context) {
      $(once('webform-radios-required', '.js-form-type-radios, .js-form-type-webform-radios-other, .js-webform-type-radios, .js-webform-type-webform-radios-other, .js-webform-type-webform-entity-radios, .js-webform-type-webform-scale', context))
        .each(function () {
          var $element = $(this);
          setTimeout(function () {radiosRequired($element);});
        });
    }
  };

 /**
   * Adds HTML5 validation to required table select.
   *
   * @type {Drupal~behavior}
   *
   * @see https://www.drupal.org/project/webform/issues/2856795
   */
  Drupal.behaviors.webformTableSelectRequired = {
    attach: function (context) {
      $(once('webform-tableselect-required','.js-webform-tableselect.required', context))
        .each(function () {
          var $element = $(this);
          var $tbody = $element.find('tbody');
          var isMultiple = $element.is('[multiple]');

          if (isMultiple) {
            // Check all checkbox triggers checkbox 'change' event on
            // select and deselect all.
            // @see Drupal.tableSelect
            $tbody.find('input[type="checkbox"]').on('click change', function () {
              checkboxesRequired($tbody);
            });
          }

          setTimeout(function () {
            isMultiple ? checkboxesRequired($tbody) : radiosRequired($element);
          });
        });
    }
  };

  /**
   * Add HTML5 multiple checkboxes required validation.
   *
   * @param {jQuery} $element
   *   An jQuery object containing HTML5 radios.
   *
   * @see https://stackoverflow.com/a/37825072/145846
   */
  function checkboxesRequired($element) {
    var $firstCheckbox = $element.find('input[type="checkbox"]').first();
    var isChecked = $element.find('input[type="checkbox"]').is(':checked');
    toggleRequired($firstCheckbox, !isChecked);
    copyRequireMessage($element, $firstCheckbox);
  }

  /**
   * Add HTML5 radios required validation.
   *
   * @param {jQuery} $element
   *   An jQuery object containing HTML5 radios.
   *
   * @see https://www.drupal.org/project/webform/issues/2856795
   */
  function radiosRequired($element) {
    var $radios = $element.find('input[type="radio"]');
    var isRequired = $element.hasClass('required');
    toggleRequired($radios, isRequired);
    copyRequireMessage($element, $radios);
  }

  /* ************************************************************************ */
  // Event handlers.
  /* ************************************************************************ */

  /**
   * Trigger #states API HTML5 multiple checkboxes required validation.
   *
   * @see https://stackoverflow.com/a/37825072/145846
   */
  function statesCheckboxesRequiredEventHandler() {
    var $element = $(this).closest('.js-webform-type-checkboxes, .js-webform-type-webform-checkboxes-other');
    checkboxesRequired($element);
  }

  /**
   * Trigger an input's event handlers.
   *
   * @param {element} input
   *   An input.
   */
  function triggerEventHandlers(input) {
    var $input = $(input);
    var type = input.type;
    var tag = input.tagName.toLowerCase();
    // Add 'webform.states' as extra parameter to event handlers.
    // @see Drupal.behaviors.webformUnsaved
    var extraParameters = ['webform.states'];
    if (type === 'checkbox' || type === 'radio') {
      $input
        .trigger('change', extraParameters)
        .trigger('blur', extraParameters);
    }
    else if (tag === 'select') {
      // Do not trigger the onchange event for Address element's country code
      // when it is initialized.
      // @see \Drupal\address\Element\Country
      if ($input.closest('.webform-type-address').length) {
        if (!$input.data('webform-states-address-initialized')
          && $input.attr('autocomplete') === 'country'
          && $input.val() === $input.find("option[selected]").attr('value')) {
          return;
        }
        $input.data('webform-states-address-initialized', true);
      }

      $input
        .trigger('change', extraParameters)
        .trigger('blur', extraParameters);
    }
    else if (type !== 'submit' && type !== 'button' && type !== 'file') {
      // Make sure input mask is removed and then reset when value is restored.
      // @see https://www.drupal.org/project/webform/issues/3124155
      // @see https://www.drupal.org/project/webform/issues/3202795
      var hasInputMask = ($.fn.inputmask && $input.hasClass('js-webform-input-mask'));
      hasInputMask && $input.inputmask('remove');

      $input
        .trigger('input', extraParameters)
        .trigger('change', extraParameters)
        .trigger('keydown', extraParameters)
        .trigger('keyup', extraParameters)
        .trigger('blur', extraParameters);

      hasInputMask && $input.inputmask();
    }
  }

  /* ************************************************************************ */
  // Backup and restore value functions.
  /* ************************************************************************ */

  /**
   * Backup an input's current value and required attribute
   *
   * @param {element} input
   *   An input.
   */
  function backupValueAndRequired(input) {
    var $input = $(input);
    var type = input.type;
    var tag = input.tagName.toLowerCase(); // Normalize case.

    // Backup required.
    if ($input.prop('required') && !$input.hasData('webform-required')) {
      $input.data('webform-required', true);
    }

    // Backup value.
    if (!$input.hasData('webform-value')) {
      if (type === 'checkbox' || type === 'radio') {
        $input.data('webform-value', $input.prop('checked'));
      }
      else if (tag === 'select') {
        var values = [];
        $input.find('option:selected').each(function (i, option) {
          values[i] = option.value;
        });
        $input.data('webform-value', values);
      }
      else if (type !== 'submit' && type !== 'button') {
        $input.data('webform-value', input.value);
      }
    }
  }

  /**
   * Restore an input's value and required attribute.
   *
   * @param {element} input
   *   An input.
   */
  function restoreValueAndRequired(input) {
    var $input = $(input);

    // Restore value.
    var value = $input.data('webform-value');
    if (typeof value !== 'undefined') {
      var type = input.type;
      var tag = input.tagName.toLowerCase(); // Normalize case.

      if (type === 'checkbox' || type === 'radio') {
        $input.prop('checked', value);
      }
      else if (tag === 'select') {
        $.each(value, function (i, option_value) {
          // Prevent "Syntax error, unrecognized expression" error by
          // escaping single quotes.
          // @see https://forum.jquery.com/topic/escape-characters-prior-to-using-selector
          option_value = option_value.replace(/'/g, "\\\'");
          $input.find("option[value='" + option_value + "']").prop('selected', true);
        });
      }
      else if (type !== 'submit' && type !== 'button') {
        input.value = value;
      }
      $input.removeData('webform-value');
    }

    // Restore required.
    var required = $input.data('webform-required');
    if (typeof required !== 'undefined') {
      if (required) {
        $input.prop('required', true);
      }
      $input.removeData('webform-required');
    }
  }

  /**
   * Clear an input's value and required attributes.
   *
   * @param {element} input
   *   An input.
   */
  function clearValueAndRequired(input) {
    var $input = $(input);

    // Check for #states no clear attribute.
    // @see https://css-tricks.com/snippets/jquery/make-an-jquery-hasattr/
    if ($input.closest('[data-webform-states-no-clear]').length) {
      return;
    }

    // Clear value.
    var type = input.type;
    var tag = input.tagName.toLowerCase(); // Normalize case.
    if (type === 'checkbox' || type === 'radio') {
      $input.prop('checked', false);
    }
    else if (tag === 'select') {
      if ($input.find('option[value=""]').length) {
        $input.val('');
      }
      else {
        input.selectedIndex = -1;
      }
    }
    else if (type !== 'submit' && type !== 'button') {
      input.value = (type === 'color') ? '#000000' : '';
    }

    // Clear required.
    $input.prop('required', false);
  }

  /* ************************************************************************ */
  // Helper functions.
  /* ************************************************************************ */

  /**
   * Toggle an input's required attributes.
   *
   * @param {element} $input
   *   An input.
   * @param {boolean} required
   *   Is input required.
   */
  function toggleRequired($input, required) {
    var isCheckboxOrRadio = ($input.attr('type') === 'radio' || $input.attr('type') === 'checkbox');
    if (required) {
      if (isCheckboxOrRadio) {
        $input.attr({'required': 'required'});
      }
      else {
        $input.attr({'required': 'required', 'aria-required': 'true'});
      }
    }
    else {
      if (isCheckboxOrRadio) {
        $input.removeAttr('required');
      }
      else {
        $input.removeAttr('required aria-required');
      }
    }
  }

  /**
   * Copy the clientside_validation.module's message.
   *
   * @param {jQuery} $source
   *   The source element.
   * @param {jQuery} $destination
   *   The destination element.
   */
  function copyRequireMessage($source, $destination) {
    if ($source.attr('data-msg-required')) {
      $destination.attr('data-msg-required', $source.attr('data-msg-required'));
    }
  }

})(jQuery, Drupal, once);
;
/**
 * @file
 * JavaScript behaviors for custom webform #states.
 */

(function ($, Drupal) {

  'use strict';

  $(document).on('state:required', function (e) {
    if (e.trigger && $(e.target).isWebform()) {
      var $target = $(e.target);

      // @see Issue #2856315: Conditional Logic - Requiring Radios in a Fieldset.
      // Fix #required for fieldsets.
      if ($target.is('.js-form-wrapper.panel')) {
        if (e.value) {
          $target.find('.panel-heading .panel-title').addClass('js-form-required form-required');
        }
        else {
          $target.find('.panel-heading .panel-title').removeClass('js-form-required form-required');
        }
      }

    }
  });

})(jQuery, Drupal);
;
/**
 * @file
 * Bootstrap Popovers.
 */

var Drupal = Drupal || {};

(function ($, Drupal, Bootstrap) {
  "use strict";

  var $document = $(document);

  /**
   * Extend the Bootstrap Popover plugin constructor class.
   */
  Bootstrap.extendPlugin('popover', function (settings) {
    return {
      DEFAULTS: {
        animation: !!settings.popover_animation,
        autoClose: !!settings.popover_auto_close,
        enabled: settings.popover_enabled,
        html: !!settings.popover_html,
        placement: settings.popover_placement,
        selector: settings.popover_selector,
        trigger: settings.popover_trigger,
        title: settings.popover_title,
        content: settings.popover_content,
        delay: parseInt(settings.popover_delay, 10),
        container: settings.popover_container
      }
    };
  });

  /**
   * Bootstrap Popovers.
   *
   * @todo This should really be properly delegated if selector option is set.
   */
  Drupal.behaviors.bootstrapPopovers = {
    $activePopover: null,
    attach: function (context) {
      // Immediately return if popovers are not available.
      if (!$.fn.popover || !$.fn.popover.Constructor.DEFAULTS.enabled) {
        return;
      }

      var _this = this;

      $document
        .on('show.bs.popover', '[data-toggle=popover]', function () {
          var $trigger = $(this);
          var popover = $trigger.data('bs.popover');

          // Only keep track of clicked triggers that we're manually handling.
          if (popover.options.originalTrigger === 'click') {
            if (_this.$activePopover && _this.getOption('autoClose') && !_this.$activePopover.is($trigger)) {
              _this.$activePopover.popover('hide');
            }
            _this.$activePopover = $trigger;
          }
        })
        // Unfortunately, :focusable is only made available when using jQuery
        // UI. While this would be the most semantic pseudo selector to use
        // here, jQuery UI may not always be loaded. Instead, just use :visible
        // here as this just needs some sort of selector here. This activates
        // delegate binding to elements in jQuery so it can work it's bubbling
        // focus magic since elements don't really propagate their focus events.
        // @see https://www.drupal.org/project/bootstrap/issues/3013236
        .on('focus.bs.popover', ':visible', function (e) {
          var $target = $(e.target);
          if (_this.$activePopover && _this.getOption('autoClose') && !_this.$activePopover.is($target) && !$target.closest('.popover.in')[0]) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
        .on('click.bs.popover', function (e) {
          var $target = $(e.target);
          if (_this.$activePopover && _this.getOption('autoClose') && !$target.is('[data-toggle=popover]') && !$target.closest('.popover.in')[0]) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
        .on('keyup.bs.popover', function (e) {
          if (_this.$activePopover && _this.getOption('autoClose') && e.which === 27) {
            _this.$activePopover.popover('hide');
            _this.$activePopover = null;
          }
        })
      ;

      var elements = $(context).find('[data-toggle=popover]').toArray();
      for (var i = 0; i < elements.length; i++) {
        var $element = $(elements[i]);
        var options = $.extend({}, $.fn.popover.Constructor.DEFAULTS, $element.data());

        // Store the original trigger.
        options.originalTrigger = options.trigger;

        // If the trigger is "click", then we'll handle it manually here.
        if (options.trigger === 'click') {
          options.trigger = 'manual';
        }

        // Retrieve content from a target element.
        var target = options.target || $element.is('a[href^="#"]') && $element.attr('href');
        var $target = $document.find(target).clone();
        if (!options.content && $target[0]) {
          $target.removeClass('visually-hidden hidden').removeAttr('aria-hidden');
          options.content = $target.wrap('<div/>').parent()[options.html ? 'html' : 'text']() || '';
        }

        // Initialize the popover.
        $element.popover(options);

        // Handle clicks manually.
        if (options.originalTrigger === 'click') {
          // To ensure the element is bound multiple times, remove any
          // previously set event handler before adding another one.
          $element
            .off('click.drupal.bootstrap.popover')
            .on('click.drupal.bootstrap.popover', function (e) {
              $(this).popover('toggle');
              e.preventDefault();
              e.stopPropagation();
            })
          ;
        }
      }
    },
    detach: function (context) {
      // Immediately return if popovers are not available.
      if (!$.fn.popover || !$.fn.popover.Constructor.DEFAULTS.enabled) {
        return;
      }

      // Destroy all popovers.
      $(context).find('[data-toggle="popover"]')
        .off('click.drupal.bootstrap.popover')
        .popover('destroy')
      ;
    },
    getOption: function(name, defaultValue, element) {
      var $element = element ? $(element) : this.$activePopover;
      var options = $.extend(true, {}, $.fn.popover.Constructor.DEFAULTS, ($element && $element.data('bs.popover') || {}).options);
      if (options[name] !== void 0) {
        return options[name];
      }
      return defaultValue !== void 0 ? defaultValue : void 0;
    }
  };

})(window.jQuery, window.Drupal, window.Drupal.bootstrap);
;
/**
 * @file
 * Bootstrap Tooltips.
 */

var Drupal = Drupal || {};

(function ($, Drupal, Bootstrap) {
  "use strict";

  /**
   * Extend the Bootstrap Tooltip plugin constructor class.
   */
  Bootstrap.extendPlugin('tooltip', function (settings) {
    return {
      DEFAULTS: {
        animation: !!settings.tooltip_animation,
        enabled: settings.tooltip_enabled,
        html: !!settings.tooltip_html,
        placement: settings.tooltip_placement,
        selector: settings.tooltip_selector,
        trigger: settings.tooltip_trigger,
        delay: parseInt(settings.tooltip_delay, 10),
        container: settings.tooltip_container
      }
    };
  });

  /**
   * Bootstrap Tooltips.
   *
   * @todo This should really be properly delegated if selector option is set.
   */
  Drupal.behaviors.bootstrapTooltips = {
    attach: function (context) {
      // Immediately return if tooltips are not available.
      if (!$.fn.tooltip || !$.fn.tooltip.Constructor.DEFAULTS.enabled) {
        return;
      }

      var elements = $(context).find('[data-toggle="tooltip"]').toArray();
      for (var i = 0; i < elements.length; i++) {
        var $element = $(elements[i]);
        var options = $.extend({}, $.fn.tooltip.Constructor.DEFAULTS, $element.data());
        $element.tooltip(options);
      }
    },
    detach: function (context) {
      // Immediately return if tooltips are not available.
      if (!$.fn.tooltip || !$.fn.tooltip.Constructor.DEFAULTS.enabled) {
        return;
      }

      // Destroy all tooltips.
      $(context).find('[data-toggle="tooltip"]').tooltip('destroy');
    }
  };

})(window.jQuery, window.Drupal, window.Drupal.bootstrap);
;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Drupal, drupalSettings, storage) {
  var currentUserID = parseInt(drupalSettings.user.uid, 10);
  var secondsIn30Days = 2592000;
  var thirtyDaysAgo = Math.round(new Date().getTime() / 1000) - secondsIn30Days;
  var embeddedLastReadTimestamps = false;
  if (drupalSettings.history && drupalSettings.history.lastReadTimestamps) {
    embeddedLastReadTimestamps = drupalSettings.history.lastReadTimestamps;
  }
  Drupal.history = {
    fetchTimestamps: function fetchTimestamps(nodeIDs, callback) {
      if (embeddedLastReadTimestamps) {
        callback();
        return;
      }
      $.ajax({
        url: Drupal.url('history/get_node_read_timestamps'),
        type: 'POST',
        data: {
          'node_ids[]': nodeIDs
        },
        dataType: 'json',
        success: function success(results) {
          Object.keys(results || {}).forEach(function (nodeID) {
            storage.setItem("Drupal.history.".concat(currentUserID, ".").concat(nodeID), results[nodeID]);
          });
          callback();
        }
      });
    },
    getLastRead: function getLastRead(nodeID) {
      if (embeddedLastReadTimestamps && embeddedLastReadTimestamps[nodeID]) {
        return parseInt(embeddedLastReadTimestamps[nodeID], 10);
      }
      return parseInt(storage.getItem("Drupal.history.".concat(currentUserID, ".").concat(nodeID)) || 0, 10);
    },
    markAsRead: function markAsRead(nodeID) {
      $.ajax({
        url: Drupal.url("history/".concat(nodeID, "/read")),
        type: 'POST',
        dataType: 'json',
        success: function success(timestamp) {
          if (embeddedLastReadTimestamps && embeddedLastReadTimestamps[nodeID]) {
            return;
          }
          storage.setItem("Drupal.history.".concat(currentUserID, ".").concat(nodeID), timestamp);
        }
      });
    },
    needsServerCheck: function needsServerCheck(nodeID, contentTimestamp) {
      if (contentTimestamp < thirtyDaysAgo) {
        return false;
      }
      if (embeddedLastReadTimestamps && embeddedLastReadTimestamps[nodeID]) {
        return contentTimestamp > parseInt(embeddedLastReadTimestamps[nodeID], 10);
      }
      var minLastReadTimestamp = parseInt(storage.getItem("Drupal.history.".concat(currentUserID, ".").concat(nodeID)) || 0, 10);
      return contentTimestamp > minLastReadTimestamp;
    }
  };
})(jQuery, Drupal, drupalSettings, window.localStorage);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function (window, Drupal, drupalSettings) {
  window.addEventListener('load', function () {
    if (drupalSettings.history && drupalSettings.history.nodesToMarkAsRead) {
      Object.keys(drupalSettings.history.nodesToMarkAsRead).forEach(Drupal.history.markAsRead);
    }
  });
})(window, Drupal, drupalSettings);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
Drupal.debounce = function (func, wait, immediate) {
  var timeout;
  var result;
  return function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    var context = this;
    var later = function later() {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
      }
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) {
      result = func.apply(context, args);
    }
    return result;
  };
};;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function (Drupal, debounce) {
  var liveElement;
  var announcements = [];
  Drupal.behaviors.drupalAnnounce = {
    attach: function attach(context) {
      if (!liveElement) {
        liveElement = document.createElement('div');
        liveElement.id = 'drupal-live-announce';
        liveElement.className = 'visually-hidden';
        liveElement.setAttribute('aria-live', 'polite');
        liveElement.setAttribute('aria-busy', 'false');
        document.body.appendChild(liveElement);
      }
    }
  };
  function announce() {
    var text = [];
    var priority = 'polite';
    var announcement;
    var il = announcements.length;
    for (var i = 0; i < il; i++) {
      announcement = announcements.pop();
      text.unshift(announcement.text);
      if (announcement.priority === 'assertive') {
        priority = 'assertive';
      }
    }
    if (text.length) {
      liveElement.innerHTML = '';
      liveElement.setAttribute('aria-busy', 'true');
      liveElement.setAttribute('aria-live', priority);
      liveElement.innerHTML = text.join('\n');
      liveElement.setAttribute('aria-busy', 'false');
    }
  }
  Drupal.announce = function (text, priority) {
    announcements.push({
      text: text,
      priority: priority
    });
    return debounce(announce, 200)();
  };
})(Drupal, Drupal.debounce);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Drupal, debounce) {
  var offsets = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
  function getRawOffset(el, edge) {
    var $el = $(el);
    var documentElement = document.documentElement;
    var displacement = 0;
    var horizontal = edge === 'left' || edge === 'right';
    var placement = $el.offset()[horizontal ? 'left' : 'top'];
    placement -= window["scroll".concat(horizontal ? 'X' : 'Y')] || document.documentElement["scroll".concat(horizontal ? 'Left' : 'Top')] || 0;
    switch (edge) {
      case 'top':
        displacement = placement + $el.outerHeight();
        break;
      case 'left':
        displacement = placement + $el.outerWidth();
        break;
      case 'bottom':
        displacement = documentElement.clientHeight - placement;
        break;
      case 'right':
        displacement = documentElement.clientWidth - placement;
        break;
      default:
        displacement = 0;
    }
    return displacement;
  }
  function calculateOffset(edge) {
    var edgeOffset = 0;
    var displacingElements = document.querySelectorAll("[data-offset-".concat(edge, "]"));
    var n = displacingElements.length;
    for (var i = 0; i < n; i++) {
      var el = displacingElements[i];
      if (el.style.display === 'none') {
        continue;
      }
      var displacement = parseInt(el.getAttribute("data-offset-".concat(edge)), 10);
      if (isNaN(displacement)) {
        displacement = getRawOffset(el, edge);
      }
      edgeOffset = Math.max(edgeOffset, displacement);
    }
    return edgeOffset;
  }
  function calculateOffsets() {
    return {
      top: calculateOffset('top'),
      right: calculateOffset('right'),
      bottom: calculateOffset('bottom'),
      left: calculateOffset('left')
    };
  }
  function displace(broadcast) {
    offsets = calculateOffsets();
    Drupal.displace.offsets = offsets;
    if (typeof broadcast === 'undefined' || broadcast) {
      $(document).trigger('drupalViewportOffsetChange', offsets);
    }
    return offsets;
  }
  Drupal.behaviors.drupalDisplace = {
    attach: function attach() {
      if (this.displaceProcessed) {
        return;
      }
      this.displaceProcessed = true;
      $(window).on('resize.drupalDisplace', debounce(displace, 200));
    }
  };
  Drupal.displace = displace;
  $.extend(Drupal.displace, {
    offsets: offsets,
    calculateOffset: calculateOffset
  });
})(jQuery, Drupal, Drupal.debounce);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Drupal, drupalSettings) {
  var activeItem = Drupal.url(drupalSettings.path.currentPath);
  $.fn.drupalToolbarMenu = function () {
    var ui = {
      handleOpen: Drupal.t('Extend'),
      handleClose: Drupal.t('Collapse')
    };
    function toggleList($item, switcher) {
      var $toggle = $item.children('.toolbar-box').children('.toolbar-handle');
      switcher = typeof switcher !== 'undefined' ? switcher : !$item.hasClass('open');
      $item.toggleClass('open', switcher);
      $toggle.toggleClass('open', switcher);
      $toggle.find('.action').each(function (index, element) {
        element.textContent = switcher ? ui.handleClose : ui.handleOpen;
      });
    }
    function toggleClickHandler(event) {
      var $toggle = $(event.target);
      var $item = $toggle.closest('li');
      toggleList($item);
      var $openItems = $item.siblings().filter('.open');
      toggleList($openItems, false);
    }
    function linkClickHandler(event) {
      if (!Drupal.toolbar.models.toolbarModel.get('isFixed')) {
        Drupal.toolbar.models.toolbarModel.set('activeTab', null);
      }
      event.stopPropagation();
    }
    function initItems($menu) {
      var options = {
        class: 'toolbar-icon toolbar-handle',
        action: ui.handleOpen,
        text: ''
      };
      $menu.find('li > a').wrap('<div class="toolbar-box">');
      $menu.find('li').each(function (index, element) {
        var $item = $(element);
        if ($item.children('ul.toolbar-menu').length) {
          var $box = $item.children('.toolbar-box');
          var $link = $box.find('a');
          options.text = Drupal.t('@label', {
            '@label': $link.length ? $link[0].textContent : ''
          });
          $item.children('.toolbar-box').append(Drupal.theme('toolbarMenuItemToggle', options));
        }
      });
    }
    function markListLevels($lists, level) {
      level = !level ? 1 : level;
      var $lis = $lists.children('li').addClass("level-".concat(level));
      $lists = $lis.children('ul');
      if ($lists.length) {
        markListLevels($lists, level + 1);
      }
    }
    function openActiveItem($menu) {
      var pathItem = $menu.find("a[href=\"".concat(window.location.pathname, "\"]"));
      if (pathItem.length && !activeItem) {
        activeItem = window.location.pathname;
      }
      if (activeItem) {
        var $activeItem = $menu.find("a[href=\"".concat(activeItem, "\"]")).addClass('menu-item--active');
        var $activeTrail = $activeItem.parentsUntil('.root', 'li').addClass('menu-item--active-trail');
        toggleList($activeTrail, true);
      }
    }
    return this.each(function (selector) {
      var menu = once('toolbar-menu', this);
      if (menu.length) {
        var $menu = $(menu);
        $menu.on('click.toolbar', '.toolbar-box', toggleClickHandler).on('click.toolbar', '.toolbar-box a', linkClickHandler);
        $menu.addClass('root');
        initItems($menu);
        markListLevels($menu);
        openActiveItem($menu);
      }
    });
  };
  Drupal.theme.toolbarMenuItemToggle = function (options) {
    return "<button class=\"".concat(options.class, "\"><span class=\"action\">").concat(options.action, "</span> <span class=\"label\">").concat(options.text, "</span></button>");
  };
})(jQuery, Drupal, drupalSettings);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Drupal, drupalSettings) {
  var options = $.extend({
    breakpoints: {
      'toolbar.narrow': '',
      'toolbar.standard': '',
      'toolbar.wide': ''
    }
  }, drupalSettings.toolbar, {
    strings: {
      horizontal: Drupal.t('Horizontal orientation'),
      vertical: Drupal.t('Vertical orientation')
    }
  });
  Drupal.behaviors.toolbar = {
    attach: function attach(context) {
      if (!window.matchMedia('only screen').matches) {
        return;
      }
      once('toolbar', '#toolbar-administration', context).forEach(function (toolbar) {
        var model = new Drupal.toolbar.ToolbarModel({
          locked: JSON.parse(localStorage.getItem('Drupal.toolbar.trayVerticalLocked')),
          activeTab: document.getElementById(JSON.parse(localStorage.getItem('Drupal.toolbar.activeTabID'))),
          height: $('#toolbar-administration').outerHeight()
        });
        Drupal.toolbar.models.toolbarModel = model;
        Object.keys(options.breakpoints).forEach(function (label) {
          var mq = options.breakpoints[label];
          var mql = window.matchMedia(mq);
          Drupal.toolbar.mql[label] = mql;
          mql.addListener(Drupal.toolbar.mediaQueryChangeHandler.bind(null, model, label));
          Drupal.toolbar.mediaQueryChangeHandler.call(null, model, label, mql);
        });
        Drupal.toolbar.views.toolbarVisualView = new Drupal.toolbar.ToolbarVisualView({
          el: toolbar,
          model: model,
          strings: options.strings
        });
        Drupal.toolbar.views.toolbarAuralView = new Drupal.toolbar.ToolbarAuralView({
          el: toolbar,
          model: model,
          strings: options.strings
        });
        Drupal.toolbar.views.bodyVisualView = new Drupal.toolbar.BodyVisualView({
          el: toolbar,
          model: model
        });
        model.trigger('change:isFixed', model, model.get('isFixed'));
        model.trigger('change:activeTray', model, model.get('activeTray'));
        var menuModel = new Drupal.toolbar.MenuModel();
        Drupal.toolbar.models.menuModel = menuModel;
        Drupal.toolbar.views.menuVisualView = new Drupal.toolbar.MenuVisualView({
          el: $(toolbar).find('.toolbar-menu-administration').get(0),
          model: menuModel,
          strings: options.strings
        });
        Drupal.toolbar.setSubtrees.done(function (subtrees) {
          menuModel.set('subtrees', subtrees);
          var theme = drupalSettings.ajaxPageState.theme;
          localStorage.setItem("Drupal.toolbar.subtrees.".concat(theme), JSON.stringify(subtrees));
          model.set('areSubtreesLoaded', true);
        });
        Drupal.toolbar.views.toolbarVisualView.loadSubtrees();
        $(document).on('drupalViewportOffsetChange.toolbar', function (event, offsets) {
          model.set('offsets', offsets);
        });
        model.on('change:orientation', function (model, orientation) {
          $(document).trigger('drupalToolbarOrientationChange', orientation);
        }).on('change:activeTab', function (model, tab) {
          $(document).trigger('drupalToolbarTabChange', tab);
        }).on('change:activeTray', function (model, tray) {
          $(document).trigger('drupalToolbarTrayChange', tray);
        });
        if (Drupal.toolbar.models.toolbarModel.get('orientation') === 'horizontal' && Drupal.toolbar.models.toolbarModel.get('activeTab') === null) {
          Drupal.toolbar.models.toolbarModel.set({
            activeTab: $('.toolbar-bar .toolbar-tab:not(.home-toolbar-tab) a').get(0)
          });
        }
        $(window).on({
          'dialog:aftercreate': function dialogAftercreate(event, dialog, $element, settings) {
            var $toolbar = $('#toolbar-bar');
            $toolbar.css('margin-top', '0');
            if (settings.drupalOffCanvasPosition === 'top') {
              var height = Drupal.offCanvas.getContainer($element).outerHeight();
              $toolbar.css('margin-top', "".concat(height, "px"));
              $element.on('dialogContentResize.off-canvas', function () {
                var newHeight = Drupal.offCanvas.getContainer($element).outerHeight();
                $toolbar.css('margin-top', "".concat(newHeight, "px"));
              });
            }
          },
          'dialog:beforeclose': function dialogBeforeclose() {
            $('#toolbar-bar').css('margin-top', '0');
          }
        });
      });
    }
  };
  Drupal.toolbar = {
    views: {},
    models: {},
    mql: {},
    setSubtrees: new $.Deferred(),
    mediaQueryChangeHandler: function mediaQueryChangeHandler(model, label, mql) {
      switch (label) {
        case 'toolbar.narrow':
          model.set({
            isOriented: mql.matches,
            isTrayToggleVisible: false
          });
          if (!mql.matches || !model.get('orientation')) {
            model.set({
              orientation: 'vertical'
            }, {
              validate: true
            });
          }
          break;
        case 'toolbar.standard':
          model.set({
            isFixed: mql.matches
          });
          break;
        case 'toolbar.wide':
          model.set({
            orientation: mql.matches && !model.get('locked') ? 'horizontal' : 'vertical'
          }, {
            validate: true
          });
          model.set({
            isTrayToggleVisible: mql.matches
          });
          break;
        default:
          break;
      }
    }
  };
  Drupal.theme.toolbarOrientationToggle = function () {
    return '<div class="toolbar-toggle-orientation"><div class="toolbar-lining">' + '<button class="toolbar-icon" type="button"></button>' + '</div></div>';
  };
  Drupal.AjaxCommands.prototype.setToolbarSubtrees = function (ajax, response, status) {
    Drupal.toolbar.setSubtrees.resolve(response.subtrees);
  };
})(jQuery, Drupal, drupalSettings);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function (Backbone, Drupal) {
  Drupal.toolbar.MenuModel = Backbone.Model.extend({
    defaults: {
      subtrees: {}
    }
  });
})(Backbone, Drupal);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function (Backbone, Drupal) {
  Drupal.toolbar.ToolbarModel = Backbone.Model.extend({
    defaults: {
      activeTab: null,
      activeTray: null,
      isOriented: false,
      isFixed: false,
      areSubtreesLoaded: false,
      isViewportOverflowConstrained: false,
      orientation: 'horizontal',
      locked: false,
      isTrayToggleVisible: true,
      height: null,
      offsets: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    },
    validate: function validate(attributes, options) {
      if (attributes.orientation === 'horizontal' && this.get('locked') && !options.override) {
        return Drupal.t('The toolbar cannot be set to a horizontal orientation when it is locked.');
      }
    }
  });
})(Backbone, Drupal);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Drupal, Backbone) {
  Drupal.toolbar.BodyVisualView = Backbone.View.extend({
    initialize: function initialize() {
      this.listenTo(this.model, 'change:activeTray ', this.render);
      this.listenTo(this.model, 'change:isFixed change:isViewportOverflowConstrained', this.isToolbarFixed);
    },
    isToolbarFixed: function isToolbarFixed() {
      var isViewportOverflowConstrained = this.model.get('isViewportOverflowConstrained');
      $('body').toggleClass('toolbar-fixed', isViewportOverflowConstrained || this.model.get('isFixed'));
    },
    render: function render() {
      $('body').toggleClass('toolbar-tray-open', !!this.model.get('activeTray'));
    }
  });
})(jQuery, Drupal, Backbone);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Backbone, Drupal) {
  Drupal.toolbar.MenuVisualView = Backbone.View.extend({
    initialize: function initialize() {
      this.listenTo(this.model, 'change:subtrees', this.render);
    },
    render: function render() {
      var _this = this;
      var subtrees = this.model.get('subtrees');
      Object.keys(subtrees || {}).forEach(function (id) {
        $(once('toolbar-subtrees', _this.$el.find("#toolbar-link-".concat(id)))).after(subtrees[id]);
      });
      if ('drupalToolbarMenu' in $.fn) {
        this.$el.children('.toolbar-menu').drupalToolbarMenu();
      }
    }
  });
})(jQuery, Backbone, Drupal);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function (Backbone, Drupal) {
  Drupal.toolbar.ToolbarAuralView = Backbone.View.extend({
    initialize: function initialize(options) {
      this.strings = options.strings;
      this.listenTo(this.model, 'change:orientation', this.onOrientationChange);
      this.listenTo(this.model, 'change:activeTray', this.onActiveTrayChange);
    },
    onOrientationChange: function onOrientationChange(model, orientation) {
      Drupal.announce(Drupal.t('Tray orientation changed to @orientation.', {
        '@orientation': orientation
      }));
    },
    onActiveTrayChange: function onActiveTrayChange(model, tray) {
      var relevantTray = tray === null ? model.previous('activeTray') : tray;
      if (!relevantTray) {
        return;
      }
      var action = tray === null ? Drupal.t('closed') : Drupal.t('opened');
      var trayNameElement = relevantTray.querySelector('.toolbar-tray-name');
      var text;
      if (trayNameElement !== null) {
        text = Drupal.t('Tray "@tray" @action.', {
          '@tray': trayNameElement.textContent,
          '@action': action
        });
      } else {
        text = Drupal.t('Tray @action.', {
          '@action': action
        });
      }
      Drupal.announce(text);
    }
  });
})(Backbone, Drupal);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Drupal, drupalSettings, Backbone) {
  Drupal.toolbar.ToolbarVisualView = Backbone.View.extend({
    events: function events() {
      var touchEndToClick = function touchEndToClick(event) {
        event.preventDefault();
        event.target.click();
      };
      return {
        'click .toolbar-bar .toolbar-tab .trigger': 'onTabClick',
        'click .toolbar-toggle-orientation button': 'onOrientationToggleClick',
        'touchend .toolbar-bar .toolbar-tab .trigger': touchEndToClick,
        'touchend .toolbar-toggle-orientation button': touchEndToClick
      };
    },
    initialize: function initialize(options) {
      this.strings = options.strings;
      this.listenTo(this.model, 'change:activeTab change:orientation change:isOriented change:isTrayToggleVisible', this.render);
      this.listenTo(this.model, 'change:mqMatches', this.onMediaQueryChange);
      this.listenTo(this.model, 'change:offsets', this.adjustPlacement);
      this.listenTo(this.model, 'change:activeTab change:orientation change:isOriented', this.updateToolbarHeight);
      this.$el.find('.toolbar-tray .toolbar-lining').has('.toolbar-menu').append(Drupal.theme('toolbarOrientationToggle'));
      this.model.trigger('change:activeTab');
    },
    updateToolbarHeight: function updateToolbarHeight() {
      var toolbarTabOuterHeight = $('#toolbar-bar').find('.toolbar-tab').outerHeight() || 0;
      var toolbarTrayHorizontalOuterHeight = $('.is-active.toolbar-tray-horizontal').outerHeight() || 0;
      this.model.set('height', toolbarTabOuterHeight + toolbarTrayHorizontalOuterHeight);
      $('body').css({
        'padding-top': this.model.get('height')
      });
      $('html').css({
        'scroll-padding-top': this.model.get('height')
      });
      this.triggerDisplace();
    },
    triggerDisplace: function triggerDisplace() {
      _.defer(function () {
        Drupal.displace(true);
      });
    },
    render: function render() {
      this.updateTabs();
      this.updateTrayOrientation();
      this.updateBarAttributes();
      $('body').removeClass('toolbar-loading');
      if (this.model.changed.orientation === 'vertical' || this.model.changed.activeTab) {
        this.loadSubtrees();
      }
      return this;
    },
    onTabClick: function onTabClick(event) {
      if (event.currentTarget.hasAttribute('data-toolbar-tray')) {
        var activeTab = this.model.get('activeTab');
        var clickedTab = event.currentTarget;
        this.model.set('activeTab', !activeTab || clickedTab !== activeTab ? clickedTab : null);
        event.preventDefault();
        event.stopPropagation();
      }
    },
    onOrientationToggleClick: function onOrientationToggleClick(event) {
      var orientation = this.model.get('orientation');
      var antiOrientation = orientation === 'vertical' ? 'horizontal' : 'vertical';
      var locked = antiOrientation === 'vertical';
      if (locked) {
        localStorage.setItem('Drupal.toolbar.trayVerticalLocked', 'true');
      } else {
        localStorage.removeItem('Drupal.toolbar.trayVerticalLocked');
      }
      this.model.set({
        locked: locked,
        orientation: antiOrientation
      }, {
        validate: true,
        override: true
      });
      event.preventDefault();
      event.stopPropagation();
    },
    updateTabs: function updateTabs() {
      var $tab = $(this.model.get('activeTab'));
      $(this.model.previous('activeTab')).removeClass('is-active').prop('aria-pressed', false);
      $(this.model.previous('activeTray')).removeClass('is-active');
      if ($tab.length > 0) {
        $tab.addClass('is-active').prop('aria-pressed', true);
        var name = $tab.attr('data-toolbar-tray');
        var id = $tab.get(0).id;
        if (id) {
          localStorage.setItem('Drupal.toolbar.activeTabID', JSON.stringify(id));
        }
        var $tray = this.$el.find("[data-toolbar-tray=\"".concat(name, "\"].toolbar-tray"));
        if ($tray.length) {
          $tray.addClass('is-active');
          this.model.set('activeTray', $tray.get(0));
        } else {
          this.model.set('activeTray', null);
        }
      } else {
        this.model.set('activeTray', null);
        localStorage.removeItem('Drupal.toolbar.activeTabID');
      }
    },
    updateBarAttributes: function updateBarAttributes() {
      var isOriented = this.model.get('isOriented');
      if (isOriented) {
        this.$el.find('.toolbar-bar').attr('data-offset-top', '');
      } else {
        this.$el.find('.toolbar-bar').removeAttr('data-offset-top');
      }
      this.$el.toggleClass('toolbar-oriented', isOriented);
    },
    updateTrayOrientation: function updateTrayOrientation() {
      var orientation = this.model.get('orientation');
      var antiOrientation = orientation === 'vertical' ? 'horizontal' : 'vertical';
      $('body').toggleClass('toolbar-vertical', orientation === 'vertical').toggleClass('toolbar-horizontal', orientation === 'horizontal');
      var removeClass = antiOrientation === 'horizontal' ? 'toolbar-tray-horizontal' : 'toolbar-tray-vertical';
      var $trays = this.$el.find('.toolbar-tray').removeClass(removeClass).addClass("toolbar-tray-".concat(orientation));
      var iconClass = "toolbar-icon-toggle-".concat(orientation);
      var iconAntiClass = "toolbar-icon-toggle-".concat(antiOrientation);
      var $orientationToggle = this.$el.find('.toolbar-toggle-orientation').toggle(this.model.get('isTrayToggleVisible'));
      var $orientationToggleButton = $orientationToggle.find('button');
      $orientationToggleButton[0].value = antiOrientation;
      $orientationToggleButton.attr('title', this.strings[antiOrientation]).removeClass(iconClass).addClass(iconAntiClass);
      $orientationToggleButton[0].textContent = this.strings[antiOrientation];
      var dir = document.documentElement.dir;
      var edge = dir === 'rtl' ? 'right' : 'left';
      $trays.removeAttr('data-offset-left data-offset-right data-offset-top');
      $trays.filter('.toolbar-tray-vertical.is-active').attr("data-offset-".concat(edge), '');
      $trays.filter('.toolbar-tray-horizontal.is-active').attr('data-offset-top', '');
    },
    adjustPlacement: function adjustPlacement() {
      var $trays = this.$el.find('.toolbar-tray');
      if (!this.model.get('isOriented')) {
        $trays.removeClass('toolbar-tray-horizontal').addClass('toolbar-tray-vertical');
      }
    },
    loadSubtrees: function loadSubtrees() {
      var $activeTab = $(this.model.get('activeTab'));
      var orientation = this.model.get('orientation');
      if (!this.model.get('areSubtreesLoaded') && typeof $activeTab.data('drupal-subtrees') !== 'undefined' && orientation === 'vertical') {
        var subtreesHash = drupalSettings.toolbar.subtreesHash;
        var theme = drupalSettings.ajaxPageState.theme;
        var endpoint = Drupal.url("toolbar/subtrees/".concat(subtreesHash));
        var cachedSubtreesHash = localStorage.getItem("Drupal.toolbar.subtreesHash.".concat(theme));
        var cachedSubtrees = JSON.parse(localStorage.getItem("Drupal.toolbar.subtrees.".concat(theme)));
        var isVertical = this.model.get('orientation') === 'vertical';
        if (isVertical && subtreesHash === cachedSubtreesHash && cachedSubtrees) {
          Drupal.toolbar.setSubtrees.resolve(cachedSubtrees);
        } else if (isVertical) {
          localStorage.removeItem("Drupal.toolbar.subtreesHash.".concat(theme));
          localStorage.removeItem("Drupal.toolbar.subtrees.".concat(theme));
          Drupal.ajax({
            url: endpoint
          }).execute();
          localStorage.setItem("Drupal.toolbar.subtreesHash.".concat(theme), subtreesHash);
        }
      }
    }
  });
})(jQuery, Drupal, drupalSettings, Backbone);;
/*! shepherd.js 9.1.1 */

'use strict';(function(O,pa){"object"===typeof exports&&"undefined"!==typeof module?module.exports=pa():"function"===typeof define&&define.amd?define(pa):(O="undefined"!==typeof globalThis?globalThis:O||self,O.Shepherd=pa())})(this,function(){function O(a,b){return!1!==b.clone&&b.isMergeableObject(a)?da(Array.isArray(a)?[]:{},a,b):a}function pa(a,b,c){return a.concat(b).map(function(d){return O(d,c)})}function Db(a){return Object.getOwnPropertySymbols?Object.getOwnPropertySymbols(a).filter(function(b){return a.propertyIsEnumerable(b)}):
[]}function Ta(a){return Object.keys(a).concat(Db(a))}function Ua(a,b){try{return b in a}catch(c){return!1}}function Eb(a,b,c){var d={};c.isMergeableObject(a)&&Ta(a).forEach(function(e){d[e]=O(a[e],c)});Ta(b).forEach(function(e){if(!Ua(a,e)||Object.hasOwnProperty.call(a,e)&&Object.propertyIsEnumerable.call(a,e))if(Ua(a,e)&&c.isMergeableObject(b[e])){if(c.customMerge){var f=c.customMerge(e);f="function"===typeof f?f:da}else f=da;d[e]=f(a[e],b[e],c)}else d[e]=O(b[e],c)});return d}function da(a,b,c){c=
c||{};c.arrayMerge=c.arrayMerge||pa;c.isMergeableObject=c.isMergeableObject||Fb;c.cloneUnlessOtherwiseSpecified=O;var d=Array.isArray(b),e=Array.isArray(a);return d!==e?O(b,c):d?c.arrayMerge(a,b,c):Eb(a,b,c)}function ea(a){return"function"===typeof a}function qa(a){return"string"===typeof a}function Va(a){let b=Object.getOwnPropertyNames(a.constructor.prototype);for(let c=0;c<b.length;c++){let d=b[c],e=a[d];"constructor"!==d&&"function"===typeof e&&(a[d]=e.bind(a))}return a}function Gb(a,b){return c=>
{if(b.isOpen()){let d=b.el&&c.currentTarget===b.el;(void 0!==a&&c.currentTarget.matches(a)||d)&&b.tour.next()}}}function Hb(a){let {event:b,selector:c}=a.options.advanceOn||{};if(b){let d=Gb(c,a),e;try{e=document.querySelector(c)}catch(f){}if(void 0===c||e)e?(e.addEventListener(b,d),a.on("destroy",()=>e.removeEventListener(b,d))):(document.body.addEventListener(b,d,!0),a.on("destroy",()=>document.body.removeEventListener(b,d,!0)));else return console.error(`No element was found for the selector supplied to advanceOn: ${c}`)}else return console.error("advanceOn was defined, but no event name was passed.")}
function M(a){return a?(a.nodeName||"").toLowerCase():null}function K(a){return null==a?window:"[object Window]"!==a.toString()?(a=a.ownerDocument)?a.defaultView||window:window:a}function fa(a){var b=K(a).Element;return a instanceof b||a instanceof Element}function F(a){var b=K(a).HTMLElement;return a instanceof b||a instanceof HTMLElement}function Ea(a){if("undefined"===typeof ShadowRoot)return!1;var b=K(a).ShadowRoot;return a instanceof b||a instanceof ShadowRoot}function N(a){return a.split("-")[0]}
function ha(a,b){void 0===b&&(b=!1);var c=a.getBoundingClientRect(),d=1,e=1;F(a)&&b&&(b=a.offsetHeight,a=a.offsetWidth,0<a&&(d=ia(c.width)/a||1),0<b&&(e=ia(c.height)/b||1));return{width:c.width/d,height:c.height/e,top:c.top/e,right:c.right/d,bottom:c.bottom/e,left:c.left/d,x:c.left/d,y:c.top/e}}function Fa(a){var b=ha(a),c=a.offsetWidth,d=a.offsetHeight;1>=Math.abs(b.width-c)&&(c=b.width);1>=Math.abs(b.height-d)&&(d=b.height);return{x:a.offsetLeft,y:a.offsetTop,width:c,height:d}}function Wa(a,b){var c=
b.getRootNode&&b.getRootNode();if(a.contains(b))return!0;if(c&&Ea(c)){do{if(b&&a.isSameNode(b))return!0;b=b.parentNode||b.host}while(b)}return!1}function P(a){return K(a).getComputedStyle(a)}function U(a){return((fa(a)?a.ownerDocument:a.document)||window.document).documentElement}function wa(a){return"html"===M(a)?a:a.assignedSlot||a.parentNode||(Ea(a)?a.host:null)||U(a)}function Xa(a){return F(a)&&"fixed"!==P(a).position?a.offsetParent:null}function ra(a){for(var b=K(a),c=Xa(a);c&&0<=["table","td",
"th"].indexOf(M(c))&&"static"===P(c).position;)c=Xa(c);if(c&&("html"===M(c)||"body"===M(c)&&"static"===P(c).position))return b;if(!c)a:{c=-1!==navigator.userAgent.toLowerCase().indexOf("firefox");if(-1===navigator.userAgent.indexOf("Trident")||!F(a)||"fixed"!==P(a).position)for(a=wa(a),Ea(a)&&(a=a.host);F(a)&&0>["html","body"].indexOf(M(a));){var d=P(a);if("none"!==d.transform||"none"!==d.perspective||"paint"===d.contain||-1!==["transform","perspective"].indexOf(d.willChange)||c&&"filter"===d.willChange||
c&&d.filter&&"none"!==d.filter){c=a;break a}else a=a.parentNode}c=null}return c||b}function Ga(a){return 0<=["top","bottom"].indexOf(a)?"x":"y"}function Ya(a){return Object.assign({},{top:0,right:0,bottom:0,left:0},a)}function Za(a,b){return b.reduce(function(c,d){c[d]=a;return c},{})}function ja(a){return a.split("-")[1]}function $a(a){var b,c=a.popper,d=a.popperRect,e=a.placement,f=a.variation,g=a.offsets,l=a.position,m=a.gpuAcceleration,k=a.adaptive,p=a.roundOffsets,q=a.isFixed;a=g.x;a=void 0===
a?0:a;var n=g.y,r=void 0===n?0:n;n="function"===typeof p?p({x:a,y:r}):{x:a,y:r};a=n.x;r=n.y;n=g.hasOwnProperty("x");g=g.hasOwnProperty("y");var x="left",h="top",t=window;if(k){var v=ra(c),A="clientHeight",u="clientWidth";v===K(c)&&(v=U(c),"static"!==P(v).position&&"absolute"===l&&(A="scrollHeight",u="scrollWidth"));if("top"===e||("left"===e||"right"===e)&&"end"===f)h="bottom",r-=(q&&v===t&&t.visualViewport?t.visualViewport.height:v[A])-d.height,r*=m?1:-1;if("left"===e||("top"===e||"bottom"===e)&&
"end"===f)x="right",a-=(q&&v===t&&t.visualViewport?t.visualViewport.width:v[u])-d.width,a*=m?1:-1}c=Object.assign({position:l},k&&Ib);!0===p?(p=r,d=window.devicePixelRatio||1,a={x:ia(a*d)/d||0,y:ia(p*d)/d||0}):a={x:a,y:r};p=a;a=p.x;r=p.y;if(m){var w;return Object.assign({},c,(w={},w[h]=g?"0":"",w[x]=n?"0":"",w.transform=1>=(t.devicePixelRatio||1)?"translate("+a+"px, "+r+"px)":"translate3d("+a+"px, "+r+"px, 0)",w))}return Object.assign({},c,(b={},b[h]=g?r+"px":"",b[x]=n?a+"px":"",b.transform="",b))}
function xa(a){return a.replace(/left|right|bottom|top/g,function(b){return Jb[b]})}function ab(a){return a.replace(/start|end/g,function(b){return Kb[b]})}function Ha(a){a=K(a);return{scrollLeft:a.pageXOffset,scrollTop:a.pageYOffset}}function Ia(a){return ha(U(a)).left+Ha(a).scrollLeft}function Ja(a){a=P(a);return/auto|scroll|overlay|hidden/.test(a.overflow+a.overflowY+a.overflowX)}function bb(a){return 0<=["html","body","#document"].indexOf(M(a))?a.ownerDocument.body:F(a)&&Ja(a)?a:bb(wa(a))}function sa(a,
b){var c;void 0===b&&(b=[]);var d=bb(a);a=d===(null==(c=a.ownerDocument)?void 0:c.body);c=K(d);d=a?[c].concat(c.visualViewport||[],Ja(d)?d:[]):d;b=b.concat(d);return a?b:b.concat(sa(wa(d)))}function Ka(a){return Object.assign({},a,{left:a.x,top:a.y,right:a.x+a.width,bottom:a.y+a.height})}function cb(a,b){if("viewport"===b){b=K(a);var c=U(a);b=b.visualViewport;var d=c.clientWidth;c=c.clientHeight;var e=0,f=0;b&&(d=b.width,c=b.height,/^((?!chrome|android).)*safari/i.test(navigator.userAgent)||(e=b.offsetLeft,
f=b.offsetTop));a={width:d,height:c,x:e+Ia(a),y:f};a=Ka(a)}else fa(b)?(a=ha(b),a.top+=b.clientTop,a.left+=b.clientLeft,a.bottom=a.top+b.clientHeight,a.right=a.left+b.clientWidth,a.width=b.clientWidth,a.height=b.clientHeight,a.x=a.left,a.y=a.top):(f=U(a),a=U(f),d=Ha(f),b=null==(c=f.ownerDocument)?void 0:c.body,c=L(a.scrollWidth,a.clientWidth,b?b.scrollWidth:0,b?b.clientWidth:0),e=L(a.scrollHeight,a.clientHeight,b?b.scrollHeight:0,b?b.clientHeight:0),f=-d.scrollLeft+Ia(f),d=-d.scrollTop,"rtl"===P(b||
a).direction&&(f+=L(a.clientWidth,b?b.clientWidth:0)-c),a=Ka({width:c,height:e,x:f,y:d}));return a}function Lb(a){var b=sa(wa(a)),c=0<=["absolute","fixed"].indexOf(P(a).position)&&F(a)?ra(a):a;return fa(c)?b.filter(function(d){return fa(d)&&Wa(d,c)&&"body"!==M(d)}):[]}function Mb(a,b,c){b="clippingParents"===b?Lb(a):[].concat(b);c=[].concat(b,[c]);c=c.reduce(function(d,e){e=cb(a,e);d.top=L(e.top,d.top);d.right=V(e.right,d.right);d.bottom=V(e.bottom,d.bottom);d.left=L(e.left,d.left);return d},cb(a,
c[0]));c.width=c.right-c.left;c.height=c.bottom-c.top;c.x=c.left;c.y=c.top;return c}function db(a){var b=a.reference,c=a.element,d=(a=a.placement)?N(a):null;a=a?ja(a):null;var e=b.x+b.width/2-c.width/2,f=b.y+b.height/2-c.height/2;switch(d){case "top":e={x:e,y:b.y-c.height};break;case "bottom":e={x:e,y:b.y+b.height};break;case "right":e={x:b.x+b.width,y:f};break;case "left":e={x:b.x-c.width,y:f};break;default:e={x:b.x,y:b.y}}d=d?Ga(d):null;if(null!=d)switch(f="y"===d?"height":"width",a){case "start":e[d]-=
b[f]/2-c[f]/2;break;case "end":e[d]+=b[f]/2-c[f]/2}return e}function ta(a,b){void 0===b&&(b={});var c=b;b=c.placement;b=void 0===b?a.placement:b;var d=c.boundary,e=void 0===d?"clippingParents":d;d=c.rootBoundary;var f=void 0===d?"viewport":d;d=c.elementContext;d=void 0===d?"popper":d;var g=c.altBoundary,l=void 0===g?!1:g;c=c.padding;c=void 0===c?0:c;c=Ya("number"!==typeof c?c:Za(c,ua));g=a.rects.popper;l=a.elements[l?"popper"===d?"reference":"popper":d];e=Mb(fa(l)?l:l.contextElement||U(a.elements.popper),
e,f);f=ha(a.elements.reference);l=db({reference:f,element:g,strategy:"absolute",placement:b});g=Ka(Object.assign({},g,l));f="popper"===d?g:f;var m={top:e.top-f.top+c.top,bottom:f.bottom-e.bottom+c.bottom,left:e.left-f.left+c.left,right:f.right-e.right+c.right};a=a.modifiersData.offset;if("popper"===d&&a){var k=a[b];Object.keys(m).forEach(function(p){var q=0<=["right","bottom"].indexOf(p)?1:-1,n=0<=["top","bottom"].indexOf(p)?"y":"x";m[p]+=k[n]*q})}return m}function Nb(a,b){void 0===b&&(b={});var c=
b.boundary,d=b.rootBoundary,e=b.padding,f=b.flipVariations,g=b.allowedAutoPlacements,l=void 0===g?eb:g,m=ja(b.placement);b=m?f?fb:fb.filter(function(p){return ja(p)===m}):ua;f=b.filter(function(p){return 0<=l.indexOf(p)});0===f.length&&(f=b);var k=f.reduce(function(p,q){p[q]=ta(a,{placement:q,boundary:c,rootBoundary:d,padding:e})[N(q)];return p},{});return Object.keys(k).sort(function(p,q){return k[p]-k[q]})}function Ob(a){if("auto"===N(a))return[];var b=xa(a);return[ab(a),b,ab(b)]}function gb(a,
b,c){void 0===c&&(c={x:0,y:0});return{top:a.top-b.height-c.y,right:a.right-b.width+c.x,bottom:a.bottom-b.height+c.y,left:a.left-b.width-c.x}}function hb(a){return["top","right","bottom","left"].some(function(b){return 0<=a[b]})}function Pb(a,b,c){void 0===c&&(c=!1);var d=F(b),e;if(e=F(b)){var f=b.getBoundingClientRect();e=ia(f.width)/b.offsetWidth||1;f=ia(f.height)/b.offsetHeight||1;e=1!==e||1!==f}f=e;e=U(b);a=ha(a,f);f={scrollLeft:0,scrollTop:0};var g={x:0,y:0};if(d||!d&&!c){if("body"!==M(b)||Ja(e))f=
b!==K(b)&&F(b)?{scrollLeft:b.scrollLeft,scrollTop:b.scrollTop}:Ha(b);F(b)?(g=ha(b,!0),g.x+=b.clientLeft,g.y+=b.clientTop):e&&(g.x=Ia(e))}return{x:a.left+f.scrollLeft-g.x,y:a.top+f.scrollTop-g.y,width:a.width,height:a.height}}function Qb(a){function b(f){d.add(f.name);[].concat(f.requires||[],f.requiresIfExists||[]).forEach(function(g){d.has(g)||(g=c.get(g))&&b(g)});e.push(f)}var c=new Map,d=new Set,e=[];a.forEach(function(f){c.set(f.name,f)});a.forEach(function(f){d.has(f.name)||b(f)});return e}function Rb(a){var b=
Qb(a);return Sb.reduce(function(c,d){return c.concat(b.filter(function(e){return e.phase===d}))},[])}function Tb(a){var b;return function(){b||(b=new Promise(function(c){Promise.resolve().then(function(){b=void 0;c(a())})}));return b}}function Ub(a){var b=a.reduce(function(c,d){var e=c[d.name];c[d.name]=e?Object.assign({},e,d,{options:Object.assign({},e.options,d.options),data:Object.assign({},e.data,d.data)}):d;return c},{});return Object.keys(b).map(function(c){return b[c]})}function ib(){for(var a=
arguments.length,b=Array(a),c=0;c<a;c++)b[c]=arguments[c];return!b.some(function(d){return!(d&&"function"===typeof d.getBoundingClientRect)})}function La(){La=Object.assign||function(a){for(var b=1;b<arguments.length;b++){var c=arguments[b],d;for(d in c)Object.prototype.hasOwnProperty.call(c,d)&&(a[d]=c[d])}return a};return La.apply(this,arguments)}function Vb(){return[{name:"applyStyles",fn(a){let {state:b}=a;Object.keys(b.elements).forEach(c=>{if("popper"===c){var d=b.attributes[c]||{},e=b.elements[c];
Object.assign(e.style,{position:"fixed",left:"50%",top:"50%",transform:"translate(-50%, -50%)"});Object.keys(d).forEach(f=>{let g=d[f];!1===g?e.removeAttribute(f):e.setAttribute(f,!0===g?"":g)})}})}},{name:"computeStyles",options:{adaptive:!1}}]}function Wb(a){let b=Vb(),c={placement:"top",strategy:"fixed",modifiers:[{name:"focusAfterRender",enabled:!0,phase:"afterWrite",fn(){setTimeout(()=>{a.el&&a.el.focus()},300)}}]};return c=La({},c,{modifiers:Array.from(new Set([...c.modifiers,...b]))})}function jb(a){return qa(a)&&
""!==a?"-"!==a.charAt(a.length-1)?`${a}-`:a:""}function Ma(a){a=a.options.attachTo||{};let b=Object.assign({},a);if(qa(a.element)){try{b.element=document.querySelector(a.element)}catch(c){}b.element||console.error(`The element for this Shepherd step was not found ${a.element}`)}return b}function Na(){let a=Date.now();return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,b=>{let c=(a+16*Math.random())%16|0;a=Math.floor(a/16);return("x"==b?c:c&3|8).toString(16)})}function Xb(a,b){let c={modifiers:[{name:"preventOverflow",
options:{altAxis:!0,tether:!1}},{name:"focusAfterRender",enabled:!0,phase:"afterWrite",fn(){setTimeout(()=>{b.el&&b.el.focus()},300)}}],strategy:"absolute"};b.isCentered()?c=Wb(b):c.placement=a.on;(a=b.tour&&b.tour.options&&b.tour.options.defaultStepOptions)&&(c=kb(a,c));return c=kb(b.options,c)}function kb(a,b){if(a.popperOptions){let c=Object.assign({},b,a.popperOptions);if(a.popperOptions.modifiers&&0<a.popperOptions.modifiers.length){let d=a.popperOptions.modifiers.map(e=>e.name);b=b.modifiers.filter(e=>
!d.includes(e.name));c.modifiers=Array.from(new Set([...b,...a.popperOptions.modifiers]))}return c}return b}function G(){}function Yb(a,b){for(let c in b)a[c]=b[c];return a}function ka(a){return a()}function lb(a){return"function"===typeof a}function Q(a,b){return a!=a?b==b:a!==b||a&&"object"===typeof a||"function"===typeof a}function H(a){a.parentNode.removeChild(a)}function mb(a){return document.createElementNS("http://www.w3.org/2000/svg",a)}function ya(a,b,c,d){a.addEventListener(b,c,d);return()=>
a.removeEventListener(b,c,d)}function B(a,b,c){null==c?a.removeAttribute(b):a.getAttribute(b)!==c&&a.setAttribute(b,c)}function nb(a,b){let c=Object.getOwnPropertyDescriptors(a.__proto__);for(let d in b)null==b[d]?a.removeAttribute(d):"style"===d?a.style.cssText=b[d]:"__value"===d?a.value=a[d]=b[d]:c[d]&&c[d].set?a[d]=b[d]:B(a,d,b[d])}function la(a,b,c){a.classList[c?"add":"remove"](b)}function za(){if(!R)throw Error("Function called outside component initialization");return R}function Oa(a){Aa.push(a)}
function ob(){let a=R;do{for(;Ba<va.length;){var b=va[Ba];Ba++;R=b;b=b.$$;if(null!==b.fragment){b.update();b.before_update.forEach(ka);var c=b.dirty;b.dirty=[-1];b.fragment&&b.fragment.p(b.ctx,c);b.after_update.forEach(Oa)}}R=null;for(Ba=va.length=0;ma.length;)ma.pop()();for(b=0;b<Aa.length;b+=1)c=Aa[b],Pa.has(c)||(Pa.add(c),c());Aa.length=0}while(va.length);for(;pb.length;)pb.pop()();Qa=!1;Pa.clear();R=a}function Z(){aa={r:0,c:[],p:aa}}function ba(){aa.r||aa.c.forEach(ka);aa=aa.p}function z(a,b){a&&
a.i&&(Ca.delete(a),a.i(b))}function C(a,b,c,d){a&&a.o&&!Ca.has(a)&&(Ca.add(a),aa.c.push(()=>{Ca.delete(a);d&&(c&&a.d(1),d())}),a.o(b))}function ca(a){a&&a.c()}function W(a,b,c,d){let {fragment:e,on_mount:f,on_destroy:g,after_update:l}=a.$$;e&&e.m(b,c);d||Oa(()=>{let m=f.map(ka).filter(lb);g?g.push(...m):m.forEach(ka);a.$$.on_mount=[]});l.forEach(Oa)}function X(a,b){a=a.$$;null!==a.fragment&&(a.on_destroy.forEach(ka),a.fragment&&a.fragment.d(b),a.on_destroy=a.fragment=null,a.ctx=[])}function S(a,b,
c,d,e,f,g,l){void 0===l&&(l=[-1]);let m=R;R=a;let k=a.$$={fragment:null,ctx:null,props:f,update:G,not_equal:e,bound:Object.create(null),on_mount:[],on_destroy:[],on_disconnect:[],before_update:[],after_update:[],context:new Map(b.context||(m?m.$$.context:[])),callbacks:Object.create(null),dirty:l,skip_bound:!1,root:b.target||m.$$.root};g&&g(k.root);let p=!1;k.ctx=c?c(a,b.props||{},function(q,n){let r=(2>=arguments.length?0:arguments.length-2)?2>=arguments.length?void 0:arguments[2]:n;if(k.ctx&&e(k.ctx[q],
k.ctx[q]=r)){if(!k.skip_bound&&k.bound[q])k.bound[q](r);p&&(-1===a.$$.dirty[0]&&(va.push(a),Qa||(Qa=!0,Zb.then(ob)),a.$$.dirty.fill(0)),a.$$.dirty[q/31|0]|=1<<q%31)}return n}):[];k.update();p=!0;k.before_update.forEach(ka);k.fragment=d?d(k.ctx):!1;b.target&&(b.hydrate?(c=Array.from(b.target.childNodes),k.fragment&&k.fragment.l(c),c.forEach(H)):k.fragment&&k.fragment.c(),b.intro&&z(a.$$.fragment),W(a,b.target,b.anchor,b.customElement),ob());R=m}function $b(a){let b,c,d,e,f;return{c(){b=document.createElement("button");
B(b,"aria-label",c=a[3]?a[3]:null);B(b,"class",d=`${a[1]||""} shepherd-button ${a[4]?"shepherd-button-secondary":""}`);b.disabled=a[2];B(b,"tabindex","0")},m(g,l){g.insertBefore(b,l||null);b.innerHTML=a[5];e||(f=ya(b,"click",function(){lb(a[0])&&a[0].apply(this,arguments)}),e=!0)},p(g,l){[l]=l;a=g;l&32&&(b.innerHTML=a[5]);l&8&&c!==(c=a[3]?a[3]:null)&&B(b,"aria-label",c);l&18&&d!==(d=`${a[1]||""} shepherd-button ${a[4]?"shepherd-button-secondary":""}`)&&B(b,"class",d);l&4&&(b.disabled=a[2])},i:G,o:G,
d(g){g&&H(b);e=!1;f()}}}function ac(a,b,c){function d(n){return ea(n)?n.call(f):n}let {config:e,step:f}=b,g,l,m,k,p,q;a.$$set=n=>{"config"in n&&c(6,e=n.config);"step"in n&&c(7,f=n.step)};a.$$.update=()=>{a.$$.dirty&192&&(c(0,g=e.action?e.action.bind(f.tour):null),c(1,l=e.classes),c(2,m=e.disabled?d(e.disabled):!1),c(3,k=e.label?d(e.label):null),c(4,p=e.secondary),c(5,q=e.text?d(e.text):null))};return[g,l,m,k,p,q,e,f]}function qb(a,b,c){a=a.slice();a[2]=b[c];return a}function rb(a){let b,c,d=a[1],
e=[];for(let g=0;g<d.length;g+=1)e[g]=sb(qb(a,d,g));let f=g=>C(e[g],1,1,()=>{e[g]=null});return{c(){for(let g=0;g<e.length;g+=1)e[g].c();b=document.createTextNode("")},m(g,l){for(let m=0;m<e.length;m+=1)e[m].m(g,l);g.insertBefore(b,l||null);c=!0},p(g,l){if(l&3){d=g[1];let m;for(m=0;m<d.length;m+=1){let k=qb(g,d,m);e[m]?(e[m].p(k,l),z(e[m],1)):(e[m]=sb(k),e[m].c(),z(e[m],1),e[m].m(b.parentNode,b))}Z();for(m=d.length;m<e.length;m+=1)f(m);ba()}},i(g){if(!c){for(g=0;g<d.length;g+=1)z(e[g]);c=!0}},o(g){e=
e.filter(Boolean);for(g=0;g<e.length;g+=1)C(e[g]);c=!1},d(g){var l=e;for(let m=0;m<l.length;m+=1)l[m]&&l[m].d(g);g&&H(b)}}}function sb(a){let b,c;b=new bc({props:{config:a[2],step:a[0]}});return{c(){ca(b.$$.fragment)},m(d,e){W(b,d,e);c=!0},p(d,e){let f={};e&2&&(f.config=d[2]);e&1&&(f.step=d[0]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function cc(a){let b,c,d=a[1]&&rb(a);return{c(){b=document.createElement("footer");d&&d.c();B(b,"class","shepherd-footer")},
m(e,f){e.insertBefore(b,f||null);d&&d.m(b,null);c=!0},p(e,f){[f]=f;e[1]?d?(d.p(e,f),f&2&&z(d,1)):(d=rb(e),d.c(),z(d,1),d.m(b,null)):d&&(Z(),C(d,1,1,()=>{d=null}),ba())},i(e){c||(z(d),c=!0)},o(e){C(d);c=!1},d(e){e&&H(b);d&&d.d()}}}function dc(a,b,c){let d,{step:e}=b;a.$$set=f=>{"step"in f&&c(0,e=f.step)};a.$$.update=()=>{a.$$.dirty&1&&c(1,d=e.options.buttons)};return[e,d]}function ec(a){let b,c,d,e,f;return{c(){b=document.createElement("button");c=document.createElement("span");c.textContent="\u00d7";
B(c,"aria-hidden","true");B(b,"aria-label",d=a[0].label?a[0].label:"Close Tour");B(b,"class","shepherd-cancel-icon");B(b,"type","button")},m(g,l){g.insertBefore(b,l||null);b.appendChild(c);e||(f=ya(b,"click",a[1]),e=!0)},p(g,l){[l]=l;l&1&&d!==(d=g[0].label?g[0].label:"Close Tour")&&B(b,"aria-label",d)},i:G,o:G,d(g){g&&H(b);e=!1;f()}}}function fc(a,b,c){let {cancelIcon:d,step:e}=b;a.$$set=f=>{"cancelIcon"in f&&c(0,d=f.cancelIcon);"step"in f&&c(2,e=f.step)};return[d,f=>{f.preventDefault();e.cancel()},
e]}function gc(a){let b;return{c(){b=document.createElement("h3");B(b,"id",a[1]);B(b,"class","shepherd-title")},m(c,d){c.insertBefore(b,d||null);a[3](b)},p(c,d){[d]=d;d&2&&B(b,"id",c[1])},i:G,o:G,d(c){c&&H(b);a[3](null)}}}function hc(a,b,c){let {labelId:d,element:e,title:f}=b;za().$$.after_update.push(()=>{ea(f)&&c(2,f=f());c(0,e.innerHTML=f,e)});a.$$set=g=>{"labelId"in g&&c(1,d=g.labelId);"element"in g&&c(0,e=g.element);"title"in g&&c(2,f=g.title)};return[e,d,f,function(g){ma[g?"unshift":"push"](()=>
{e=g;c(0,e)})}]}function tb(a){let b,c;b=new ic({props:{labelId:a[0],title:a[2]}});return{c(){ca(b.$$.fragment)},m(d,e){W(b,d,e);c=!0},p(d,e){let f={};e&1&&(f.labelId=d[0]);e&4&&(f.title=d[2]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function ub(a){let b,c;b=new jc({props:{cancelIcon:a[3],step:a[1]}});return{c(){ca(b.$$.fragment)},m(d,e){W(b,d,e);c=!0},p(d,e){let f={};e&8&&(f.cancelIcon=d[3]);e&2&&(f.step=d[1]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),
c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function kc(a){let b,c,d,e=a[2]&&tb(a),f=a[3]&&a[3].enabled&&ub(a);return{c(){b=document.createElement("header");e&&e.c();c=document.createTextNode(" ");f&&f.c();B(b,"class","shepherd-header")},m(g,l){g.insertBefore(b,l||null);e&&e.m(b,null);b.appendChild(c);f&&f.m(b,null);d=!0},p(g,l){[l]=l;g[2]?e?(e.p(g,l),l&4&&z(e,1)):(e=tb(g),e.c(),z(e,1),e.m(b,c)):e&&(Z(),C(e,1,1,()=>{e=null}),ba());g[3]&&g[3].enabled?f?(f.p(g,l),l&8&&z(f,1)):(f=ub(g),f.c(),
z(f,1),f.m(b,null)):f&&(Z(),C(f,1,1,()=>{f=null}),ba())},i(g){d||(z(e),z(f),d=!0)},o(g){C(e);C(f);d=!1},d(g){g&&H(b);e&&e.d();f&&f.d()}}}function lc(a,b,c){let {labelId:d,step:e}=b,f,g;a.$$set=l=>{"labelId"in l&&c(0,d=l.labelId);"step"in l&&c(1,e=l.step)};a.$$.update=()=>{a.$$.dirty&2&&(c(2,f=e.options.title),c(3,g=e.options.cancelIcon))};return[d,e,f,g]}function mc(a){let b;return{c(){b=document.createElement("div");B(b,"class","shepherd-text");B(b,"id",a[1])},m(c,d){c.insertBefore(b,d||null);a[3](b)},
p(c,d){[d]=d;d&2&&B(b,"id",c[1])},i:G,o:G,d(c){c&&H(b);a[3](null)}}}function nc(a,b,c){let {descriptionId:d,element:e,step:f}=b;za().$$.after_update.push(()=>{let {text:g}=f.options;ea(g)&&(g=g.call(f));g instanceof HTMLElement?e.appendChild(g):c(0,e.innerHTML=g,e)});a.$$set=g=>{"descriptionId"in g&&c(1,d=g.descriptionId);"element"in g&&c(0,e=g.element);"step"in g&&c(2,f=g.step)};return[e,d,f,function(g){ma[g?"unshift":"push"](()=>{e=g;c(0,e)})}]}function vb(a){let b,c;b=new oc({props:{labelId:a[1],
step:a[2]}});return{c(){ca(b.$$.fragment)},m(d,e){W(b,d,e);c=!0},p(d,e){let f={};e&2&&(f.labelId=d[1]);e&4&&(f.step=d[2]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function wb(a){let b,c;b=new pc({props:{descriptionId:a[0],step:a[2]}});return{c(){ca(b.$$.fragment)},m(d,e){W(b,d,e);c=!0},p(d,e){let f={};e&1&&(f.descriptionId=d[0]);e&4&&(f.step=d[2]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function xb(a){let b,
c;b=new qc({props:{step:a[2]}});return{c(){ca(b.$$.fragment)},m(d,e){W(b,d,e);c=!0},p(d,e){let f={};e&4&&(f.step=d[2]);b.$set(f)},i(d){c||(z(b.$$.fragment,d),c=!0)},o(d){C(b.$$.fragment,d);c=!1},d(d){X(b,d)}}}function rc(a){let b,c=void 0!==a[2].options.title||a[2].options.cancelIcon&&a[2].options.cancelIcon.enabled,d,e=void 0!==a[2].options.text,f,g=Array.isArray(a[2].options.buttons)&&a[2].options.buttons.length,l,m=c&&vb(a),k=e&&wb(a),p=g&&xb(a);return{c(){b=document.createElement("div");m&&m.c();
d=document.createTextNode(" ");k&&k.c();f=document.createTextNode(" ");p&&p.c();B(b,"class","shepherd-content")},m(q,n){q.insertBefore(b,n||null);m&&m.m(b,null);b.appendChild(d);k&&k.m(b,null);b.appendChild(f);p&&p.m(b,null);l=!0},p(q,n){[n]=n;n&4&&(c=void 0!==q[2].options.title||q[2].options.cancelIcon&&q[2].options.cancelIcon.enabled);c?m?(m.p(q,n),n&4&&z(m,1)):(m=vb(q),m.c(),z(m,1),m.m(b,d)):m&&(Z(),C(m,1,1,()=>{m=null}),ba());n&4&&(e=void 0!==q[2].options.text);e?k?(k.p(q,n),n&4&&z(k,1)):(k=wb(q),
k.c(),z(k,1),k.m(b,f)):k&&(Z(),C(k,1,1,()=>{k=null}),ba());n&4&&(g=Array.isArray(q[2].options.buttons)&&q[2].options.buttons.length);g?p?(p.p(q,n),n&4&&z(p,1)):(p=xb(q),p.c(),z(p,1),p.m(b,null)):p&&(Z(),C(p,1,1,()=>{p=null}),ba())},i(q){l||(z(m),z(k),z(p),l=!0)},o(q){C(m);C(k);C(p);l=!1},d(q){q&&H(b);m&&m.d();k&&k.d();p&&p.d()}}}function sc(a,b,c){let {descriptionId:d,labelId:e,step:f}=b;a.$$set=g=>{"descriptionId"in g&&c(0,d=g.descriptionId);"labelId"in g&&c(1,e=g.labelId);"step"in g&&c(2,f=g.step)};
return[d,e,f]}function yb(a){let b;return{c(){b=document.createElement("div");B(b,"class","shepherd-arrow");B(b,"data-popper-arrow","")},m(c,d){c.insertBefore(b,d||null)},d(c){c&&H(b)}}}function tc(a){let b,c,d,e,f,g,l,m,k=a[4].options.arrow&&a[4].options.attachTo&&a[4].options.attachTo.element&&a[4].options.attachTo.on&&yb();d=new uc({props:{descriptionId:a[2],labelId:a[3],step:a[4]}});let p=[{"aria-describedby":e=void 0!==a[4].options.text?a[2]:null},{"aria-labelledby":f=a[4].options.title?a[3]:
null},a[1],{role:"dialog"},{tabindex:"0"}],q={};for(let n=0;n<p.length;n+=1)q=Yb(q,p[n]);return{c(){b=document.createElement("div");k&&k.c();c=document.createTextNode(" ");ca(d.$$.fragment);nb(b,q);la(b,"shepherd-has-cancel-icon",a[5]);la(b,"shepherd-has-title",a[6]);la(b,"shepherd-element",!0)},m(n,r){n.insertBefore(b,r||null);k&&k.m(b,null);b.appendChild(c);W(d,b,null);a[13](b);g=!0;l||(m=ya(b,"keydown",a[7]),l=!0)},p(n,r){var [x]=r;n[4].options.arrow&&n[4].options.attachTo&&n[4].options.attachTo.element&&
n[4].options.attachTo.on?k||(k=yb(),k.c(),k.m(b,c)):k&&(k.d(1),k=null);r={};x&4&&(r.descriptionId=n[2]);x&8&&(r.labelId=n[3]);x&16&&(r.step=n[4]);d.$set(r);r=b;x=[(!g||x&20&&e!==(e=void 0!==n[4].options.text?n[2]:null))&&{"aria-describedby":e},(!g||x&24&&f!==(f=n[4].options.title?n[3]:null))&&{"aria-labelledby":f},x&2&&n[1],{role:"dialog"},{tabindex:"0"}];let h={},t={},v={$$scope:1},A=p.length;for(;A--;){let u=p[A],w=x[A];if(w){for(let y in u)y in w||(t[y]=1);for(let y in w)v[y]||(h[y]=w[y],v[y]=
1);p[A]=w}else for(let y in u)v[y]=1}for(let u in t)u in h||(h[u]=void 0);nb(r,q=h);la(b,"shepherd-has-cancel-icon",n[5]);la(b,"shepherd-has-title",n[6]);la(b,"shepherd-element",!0)},i(n){g||(z(d.$$.fragment,n),g=!0)},o(n){C(d.$$.fragment,n);g=!1},d(n){n&&H(b);k&&k.d();X(d);a[13](null);l=!1;m()}}}function zb(a){return a.split(" ").filter(b=>!!b.length)}function vc(a,b,c){let {classPrefix:d,element:e,descriptionId:f,firstFocusableElement:g,focusableElements:l,labelId:m,lastFocusableElement:k,step:p,
dataStepId:q}=b,n,r,x;za().$$.on_mount.push(()=>{c(1,q={[`data-${d}shepherd-step-id`]:p.id});c(9,l=e.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]'));c(8,g=l[0]);c(10,k=l[l.length-1])});za().$$.after_update.push(()=>{if(x!==p.options.classes){var h=x;qa(h)&&(h=zb(h),h.length&&e.classList.remove(...h));h=x=p.options.classes;qa(h)&&(h=zb(h),h.length&&e.classList.add(...h))}});a.$$set=h=>{"classPrefix"in
h&&c(11,d=h.classPrefix);"element"in h&&c(0,e=h.element);"descriptionId"in h&&c(2,f=h.descriptionId);"firstFocusableElement"in h&&c(8,g=h.firstFocusableElement);"focusableElements"in h&&c(9,l=h.focusableElements);"labelId"in h&&c(3,m=h.labelId);"lastFocusableElement"in h&&c(10,k=h.lastFocusableElement);"step"in h&&c(4,p=h.step);"dataStepId"in h&&c(1,q=h.dataStepId)};a.$$.update=()=>{a.$$.dirty&16&&(c(5,n=p.options&&p.options.cancelIcon&&p.options.cancelIcon.enabled),c(6,r=p.options&&p.options.title))};
return[e,q,f,m,p,n,r,h=>{const {tour:t}=p;switch(h.keyCode){case 9:if(0===l.length){h.preventDefault();break}if(h.shiftKey){if(document.activeElement===g||document.activeElement.classList.contains("shepherd-element"))h.preventDefault(),k.focus()}else document.activeElement===k&&(h.preventDefault(),g.focus());break;case 27:t.options.exitOnEsc&&p.cancel();break;case 37:t.options.keyboardNavigation&&t.back();break;case 39:t.options.keyboardNavigation&&t.next()}},g,l,k,d,()=>e,function(h){ma[h?"unshift":
"push"](()=>{e=h;c(0,e)})}]}function wc(a){a&&({steps:a}=a,a.forEach(b=>{b.options&&!1===b.options.canClickTarget&&b.options.attachTo&&b.target instanceof HTMLElement&&b.target.classList.remove("shepherd-target-click-disabled")}))}function xc(a){let b,c,d,e,f;return{c(){b=mb("svg");c=mb("path");B(c,"d",a[2]);B(b,"class",d=`${a[1]?"shepherd-modal-is-visible":""} shepherd-modal-overlay-container`)},m(g,l){g.insertBefore(b,l||null);b.appendChild(c);a[11](b);e||(f=ya(b,"touchmove",a[3]),e=!0)},p(g,l){[l]=
l;l&4&&B(c,"d",g[2]);l&2&&d!==(d=`${g[1]?"shepherd-modal-is-visible":""} shepherd-modal-overlay-container`)&&B(b,"class",d)},i:G,o:G,d(g){g&&H(b);a[11](null);e=!1;f()}}}function Ab(a){if(!a)return null;let b=a instanceof HTMLElement&&window.getComputedStyle(a).overflowY;return"hidden"!==b&&"visible"!==b&&a.scrollHeight>=a.clientHeight?a:Ab(a.parentElement)}function yc(a,b,c){function d(){c(4,p={width:0,height:0,x:0,y:0,r:0})}function e(){c(1,q=!1);l()}function f(h,t,v,A){void 0===h&&(h=0);void 0===
t&&(t=0);if(A){var u=A.getBoundingClientRect();let y=u.y||u.top;u=u.bottom||y+u.height;if(v){var w=v.getBoundingClientRect();v=w.y||w.top;w=w.bottom||v+w.height;y=Math.max(y,v);u=Math.min(u,w)}let {y:Y,height:E}={y,height:Math.max(u-y,0)},{x:I,width:D,left:na}=A.getBoundingClientRect();c(4,p={width:D+2*h,height:E+2*h,x:(I||na)-h,y:Y-h,r:t})}else d()}function g(){c(1,q=!0)}function l(){n&&(cancelAnimationFrame(n),n=void 0);window.removeEventListener("touchmove",x,{passive:!1})}function m(h){let {modalOverlayOpeningPadding:t,
modalOverlayOpeningRadius:v}=h.options,A=Ab(h.target),u=()=>{n=void 0;f(t,v,A,h.target);n=requestAnimationFrame(u)};u();window.addEventListener("touchmove",x,{passive:!1})}let {element:k,openingProperties:p}=b;Na();let q=!1,n=void 0,r;d();let x=h=>{h.preventDefault()};a.$$set=h=>{"element"in h&&c(0,k=h.element);"openingProperties"in h&&c(4,p=h.openingProperties)};a.$$.update=()=>{if(a.$$.dirty&16){let {width:h,height:t,x:v=0,y:A=0,r:u=0}=p,{innerWidth:w,innerHeight:y}=window;c(2,r=`M${w},${y}\
H0\
V0\
H${w}\
V${y}\
Z\
M${v+u},${A}\
a${u},${u},0,0,0-${u},${u}\
V${t+A-u}\
a${u},${u},0,0,0,${u},${u}\
H${h+v-u}\
a${u},${u},0,0,0,${u}-${u}\
V${A+u}\
a${u},${u},0,0,0-${u}-${u}\
Z`)}};return[k,q,r,h=>{h.stopPropagation()},p,()=>k,d,e,f,function(h){l();h.tour.options.useModalOverlay?(m(h),g()):e()},g,function(h){ma[h?"unshift":"push"](()=>{k=h;c(0,k)})}]}var Fb=function(a){var b;if(b=!!a&&"object"===typeof a)b=Object.prototype.toString.call(a),b=!("[object RegExp]"===b||"[object Date]"===b||a.$$typeof===zc);return b},zc="function"===typeof Symbol&&Symbol.for?Symbol.for("react.element"):60103;da.all=function(a,b){if(!Array.isArray(a))throw Error("first argument should be an array");
return a.reduce(function(c,d){return da(c,d,b)},{})};var Ac=da;class Ra{on(a,b,c,d){void 0===d&&(d=!1);void 0===this.bindings&&(this.bindings={});void 0===this.bindings[a]&&(this.bindings[a]=[]);this.bindings[a].push({handler:b,ctx:c,once:d});return this}once(a,b,c){return this.on(a,b,c,!0)}off(a,b){if(void 0===this.bindings||void 0===this.bindings[a])return this;void 0===b?delete this.bindings[a]:this.bindings[a].forEach((c,d)=>{c.handler===b&&this.bindings[a].splice(d,1)});return this}trigger(a){for(var b=
arguments.length,c=Array(1<b?b-1:0),d=1;d<b;d++)c[d-1]=arguments[d];void 0!==this.bindings&&this.bindings[a]&&this.bindings[a].forEach((e,f)=>{let {ctx:g,handler:l,once:m}=e;l.apply(g||this,c);m&&this.bindings[a].splice(f,1)});return this}}var ua=["top","bottom","right","left"],fb=ua.reduce(function(a,b){return a.concat([b+"-start",b+"-end"])},[]),eb=[].concat(ua,["auto"]).reduce(function(a,b){return a.concat([b,b+"-start",b+"-end"])},[]),Sb="beforeRead read afterRead beforeMain main afterMain beforeWrite write afterWrite".split(" "),
L=Math.max,V=Math.min,ia=Math.round,Ib={top:"auto",right:"auto",bottom:"auto",left:"auto"},Da={passive:!0},Jb={left:"right",right:"left",bottom:"top",top:"bottom"},Kb={start:"end",end:"start"},Bb={placement:"bottom",modifiers:[],strategy:"absolute"},Bc=function(a){void 0===a&&(a={});var b=a.defaultModifiers,c=void 0===b?[]:b;a=a.defaultOptions;var d=void 0===a?Bb:a;return function(e,f,g){function l(){k.orderedModifiers.forEach(function(r){var x=r.name,h=r.options;h=void 0===h?{}:h;r=r.effect;"function"===
typeof r&&(x=r({state:k,name:x,instance:n,options:h}),p.push(x||function(){}))})}function m(){p.forEach(function(r){return r()});p=[]}void 0===g&&(g=d);var k={placement:"bottom",orderedModifiers:[],options:Object.assign({},Bb,d),modifiersData:{},elements:{reference:e,popper:f},attributes:{},styles:{}},p=[],q=!1,n={state:k,setOptions:function(r){r="function"===typeof r?r(k.options):r;m();k.options=Object.assign({},d,k.options,r);k.scrollParents={reference:fa(e)?sa(e):e.contextElement?sa(e.contextElement):
[],popper:sa(f)};r=Rb(Ub([].concat(c,k.options.modifiers)));k.orderedModifiers=r.filter(function(x){return x.enabled});l();return n.update()},forceUpdate:function(){if(!q){var r=k.elements,x=r.reference;r=r.popper;if(ib(x,r))for(k.rects={reference:Pb(x,ra(r),"fixed"===k.options.strategy),popper:Fa(r)},k.reset=!1,k.placement=k.options.placement,k.orderedModifiers.forEach(function(v){return k.modifiersData[v.name]=Object.assign({},v.data)}),x=0;x<k.orderedModifiers.length;x++)if(!0===k.reset)k.reset=
!1,x=-1;else{var h=k.orderedModifiers[x];r=h.fn;var t=h.options;t=void 0===t?{}:t;h=h.name;"function"===typeof r&&(k=r({state:k,options:t,name:h,instance:n})||k)}}},update:Tb(function(){return new Promise(function(r){n.forceUpdate();r(k)})}),destroy:function(){m();q=!0}};if(!ib(e,f))return n;n.setOptions(g).then(function(r){if(!q&&g.onFirstUpdate)g.onFirstUpdate(r)});return n}}({defaultModifiers:[{name:"eventListeners",enabled:!0,phase:"write",fn:function(){},effect:function(a){var b=a.state,c=a.instance;
a=a.options;var d=a.scroll,e=void 0===d?!0:d;a=a.resize;var f=void 0===a?!0:a,g=K(b.elements.popper),l=[].concat(b.scrollParents.reference,b.scrollParents.popper);e&&l.forEach(function(m){m.addEventListener("scroll",c.update,Da)});f&&g.addEventListener("resize",c.update,Da);return function(){e&&l.forEach(function(m){m.removeEventListener("scroll",c.update,Da)});f&&g.removeEventListener("resize",c.update,Da)}},data:{}},{name:"popperOffsets",enabled:!0,phase:"read",fn:function(a){var b=a.state;b.modifiersData[a.name]=
db({reference:b.rects.reference,element:b.rects.popper,strategy:"absolute",placement:b.placement})},data:{}},{name:"computeStyles",enabled:!0,phase:"beforeWrite",fn:function(a){var b=a.state,c=a.options;a=c.gpuAcceleration;a=void 0===a?!0:a;var d=c.adaptive;d=void 0===d?!0:d;c=c.roundOffsets;c=void 0===c?!0:c;a={placement:N(b.placement),variation:ja(b.placement),popper:b.elements.popper,popperRect:b.rects.popper,gpuAcceleration:a,isFixed:"fixed"===b.options.strategy};null!=b.modifiersData.popperOffsets&&
(b.styles.popper=Object.assign({},b.styles.popper,$a(Object.assign({},a,{offsets:b.modifiersData.popperOffsets,position:b.options.strategy,adaptive:d,roundOffsets:c}))));null!=b.modifiersData.arrow&&(b.styles.arrow=Object.assign({},b.styles.arrow,$a(Object.assign({},a,{offsets:b.modifiersData.arrow,position:"absolute",adaptive:!1,roundOffsets:c}))));b.attributes.popper=Object.assign({},b.attributes.popper,{"data-popper-placement":b.placement})},data:{}},{name:"applyStyles",enabled:!0,phase:"write",
fn:function(a){var b=a.state;Object.keys(b.elements).forEach(function(c){var d=b.styles[c]||{},e=b.attributes[c]||{},f=b.elements[c];F(f)&&M(f)&&(Object.assign(f.style,d),Object.keys(e).forEach(function(g){var l=e[g];!1===l?f.removeAttribute(g):f.setAttribute(g,!0===l?"":l)}))})},effect:function(a){var b=a.state,c={popper:{position:b.options.strategy,left:"0",top:"0",margin:"0"},arrow:{position:"absolute"},reference:{}};Object.assign(b.elements.popper.style,c.popper);b.styles=c;b.elements.arrow&&
Object.assign(b.elements.arrow.style,c.arrow);return function(){Object.keys(b.elements).forEach(function(d){var e=b.elements[d],f=b.attributes[d]||{};d=Object.keys(b.styles.hasOwnProperty(d)?b.styles[d]:c[d]).reduce(function(g,l){g[l]="";return g},{});F(e)&&M(e)&&(Object.assign(e.style,d),Object.keys(f).forEach(function(g){e.removeAttribute(g)}))})}},requires:["computeStyles"]},{name:"offset",enabled:!0,phase:"main",requires:["popperOffsets"],fn:function(a){var b=a.state,c=a.name;a=a.options.offset;
var d=void 0===a?[0,0]:a;a=eb.reduce(function(g,l){var m=b.rects;var k=N(l);var p=0<=["left","top"].indexOf(k)?-1:1,q="function"===typeof d?d(Object.assign({},m,{placement:l})):d;m=q[0];q=q[1];m=m||0;q=(q||0)*p;k=0<=["left","right"].indexOf(k)?{x:q,y:m}:{x:m,y:q};g[l]=k;return g},{});var e=a[b.placement],f=e.x;e=e.y;null!=b.modifiersData.popperOffsets&&(b.modifiersData.popperOffsets.x+=f,b.modifiersData.popperOffsets.y+=e);b.modifiersData[c]=a}},{name:"flip",enabled:!0,phase:"main",fn:function(a){var b=
a.state,c=a.options;a=a.name;if(!b.modifiersData[a]._skip){var d=c.mainAxis;d=void 0===d?!0:d;var e=c.altAxis;e=void 0===e?!0:e;var f=c.fallbackPlacements,g=c.padding,l=c.boundary,m=c.rootBoundary,k=c.altBoundary,p=c.flipVariations,q=void 0===p?!0:p,n=c.allowedAutoPlacements;c=b.options.placement;p=N(c);f=f||(p!==c&&q?Ob(c):[xa(c)]);var r=[c].concat(f).reduce(function(E,I){return E.concat("auto"===N(I)?Nb(b,{placement:I,boundary:l,rootBoundary:m,padding:g,flipVariations:q,allowedAutoPlacements:n}):
I)},[]);c=b.rects.reference;f=b.rects.popper;var x=new Map;p=!0;for(var h=r[0],t=0;t<r.length;t++){var v=r[t],A=N(v),u="start"===ja(v),w=0<=["top","bottom"].indexOf(A),y=w?"width":"height",Y=ta(b,{placement:v,boundary:l,rootBoundary:m,altBoundary:k,padding:g});u=w?u?"right":"left":u?"bottom":"top";c[y]>f[y]&&(u=xa(u));y=xa(u);w=[];d&&w.push(0>=Y[A]);e&&w.push(0>=Y[u],0>=Y[y]);if(w.every(function(E){return E})){h=v;p=!1;break}x.set(v,w)}if(p)for(d=function(E){var I=r.find(function(D){if(D=x.get(D))return D.slice(0,
E).every(function(na){return na})});if(I)return h=I,"break"},e=q?3:1;0<e&&"break"!==d(e);e--);b.placement!==h&&(b.modifiersData[a]._skip=!0,b.placement=h,b.reset=!0)}},requiresIfExists:["offset"],data:{_skip:!1}},{name:"preventOverflow",enabled:!0,phase:"main",fn:function(a){var b=a.state,c=a.options;a=a.name;var d=c.mainAxis,e=void 0===d?!0:d;d=c.altAxis;var f=void 0===d?!1:d;d=c.tether;var g=void 0===d?!0:d;d=c.tetherOffset;var l=void 0===d?0:d,m=ta(b,{boundary:c.boundary,rootBoundary:c.rootBoundary,
padding:c.padding,altBoundary:c.altBoundary}),k=N(b.placement),p=ja(b.placement),q=!p,n=Ga(k);c="x"===n?"y":"x";d=b.modifiersData.popperOffsets;var r=b.rects.reference,x=b.rects.popper;l="function"===typeof l?l(Object.assign({},b.rects,{placement:b.placement})):l;var h="number"===typeof l?{mainAxis:l,altAxis:l}:Object.assign({mainAxis:0,altAxis:0},l),t=b.modifiersData.offset?b.modifiersData.offset[b.placement]:null;l={x:0,y:0};if(d){if(e){var v,A="y"===n?"top":"left",u="y"===n?"bottom":"right",w=
"y"===n?"height":"width";e=d[n];var y=e+m[A],Y=e-m[u],E=g?-x[w]/2:0,I="start"===p?r[w]:x[w];p="start"===p?-x[w]:-r[w];var D=b.elements.arrow;D=g&&D?Fa(D):{width:0,height:0};var na=b.modifiersData["arrow#persistent"]?b.modifiersData["arrow#persistent"].padding:{top:0,right:0,bottom:0,left:0};A=na[A];u=na[u];D=L(0,V(r[w],D[w]));I=q?r[w]/2-E-D-A-h.mainAxis:I-D-A-h.mainAxis;q=q?-r[w]/2+E+D+u+h.mainAxis:p+D+u+h.mainAxis;w=(w=b.elements.arrow&&ra(b.elements.arrow))?"y"===n?w.clientTop||0:w.clientLeft||
0:0;E=null!=(v=null==t?void 0:t[n])?v:0;v=e+q-E;y=g?V(y,e+I-E-w):y;v=g?L(Y,v):Y;v=L(y,V(e,v));d[n]=v;l[n]=v-e}if(f){var J;f=d[c];e="y"===c?"height":"width";v=f+m["x"===n?"top":"left"];m=f-m["x"===n?"bottom":"right"];k=-1!==["top","left"].indexOf(k);n=null!=(J=null==t?void 0:t[c])?J:0;J=k?v:f-r[e]-x[e]-n+h.altAxis;r=k?f+r[e]+x[e]-n-h.altAxis:m;g&&k?(J=L(J,V(f,r)),J=J>r?r:J):J=L(g?J:v,V(f,g?r:m));d[c]=J;l[c]=J-f}b.modifiersData[a]=l}},requiresIfExists:["offset"]},{name:"arrow",enabled:!0,phase:"main",
fn:function(a){var b,c=a.state,d=a.name,e=a.options,f=c.elements.arrow,g=c.modifiersData.popperOffsets,l=N(c.placement);a=Ga(l);l=0<=["left","right"].indexOf(l)?"height":"width";if(f&&g){e=e.padding;e="function"===typeof e?e(Object.assign({},c.rects,{placement:c.placement})):e;e=Ya("number"!==typeof e?e:Za(e,ua));var m=Fa(f),k="y"===a?"top":"left",p="y"===a?"bottom":"right",q=c.rects.reference[l]+c.rects.reference[a]-g[a]-c.rects.popper[l];g=g[a]-c.rects.reference[a];f=(f=ra(f))?"y"===a?f.clientHeight||
0:f.clientWidth||0:0;g=f/2-m[l]/2+(q/2-g/2);l=L(e[k],V(g,f-m[l]-e[p]));c.modifiersData[d]=(b={},b[a]=l,b.centerOffset=l-g,b)}},effect:function(a){var b=a.state;a=a.options.element;a=void 0===a?"[data-popper-arrow]":a;if(null!=a){if("string"===typeof a&&(a=b.elements.popper.querySelector(a),!a))return;Wa(b.elements.popper,a)&&(b.elements.arrow=a)}},requires:["popperOffsets"],requiresIfExists:["preventOverflow"]},{name:"hide",enabled:!0,phase:"main",requiresIfExists:["preventOverflow"],fn:function(a){var b=
a.state;a=a.name;var c=b.rects.reference,d=b.rects.popper,e=b.modifiersData.preventOverflow,f=ta(b,{elementContext:"reference"}),g=ta(b,{altBoundary:!0});c=gb(f,c);d=gb(g,d,e);e=hb(c);g=hb(d);b.modifiersData[a]={referenceClippingOffsets:c,popperEscapeOffsets:d,isReferenceHidden:e,hasPopperEscaped:g};b.attributes.popper=Object.assign({},b.attributes.popper,{"data-popper-reference-hidden":e,"data-popper-escaped":g})}}]});let R,va=[],ma=[],Aa=[],pb=[],Zb=Promise.resolve(),Qa=!1,Pa=new Set,Ba=0,Ca=new Set,
aa;class T{$destroy(){X(this,1);this.$destroy=G}$on(a,b){let c=this.$$.callbacks[a]||(this.$$.callbacks[a]=[]);c.push(b);return()=>{let d=c.indexOf(b);-1!==d&&c.splice(d,1)}}$set(a){this.$$set&&0!==Object.keys(a).length&&(this.$$.skip_bound=!0,this.$$set(a),this.$$.skip_bound=!1)}}class bc extends T{constructor(a){super();S(this,a,ac,$b,Q,{config:6,step:7})}}class qc extends T{constructor(a){super();S(this,a,dc,cc,Q,{step:0})}}class jc extends T{constructor(a){super();S(this,a,fc,ec,Q,{cancelIcon:0,
step:2})}}class ic extends T{constructor(a){super();S(this,a,hc,gc,Q,{labelId:1,element:0,title:2})}}class oc extends T{constructor(a){super();S(this,a,lc,kc,Q,{labelId:0,step:1})}}class pc extends T{constructor(a){super();S(this,a,nc,mc,Q,{descriptionId:1,element:0,step:2})}}class uc extends T{constructor(a){super();S(this,a,sc,rc,Q,{descriptionId:0,labelId:1,step:2})}}class Cc extends T{constructor(a){super();S(this,a,vc,tc,Q,{classPrefix:11,element:0,descriptionId:2,firstFocusableElement:8,focusableElements:9,
labelId:3,lastFocusableElement:10,step:4,dataStepId:1,getElement:12})}get getElement(){return this.$$.ctx[12]}}var Cb=function(a,b){return b={exports:{}},a(b,b.exports),b.exports}(function(a,b){(function(){a.exports={polyfill:function(){function c(h,t){this.scrollLeft=h;this.scrollTop=t}function d(h){if(null===h||"object"!==typeof h||void 0===h.behavior||"auto"===h.behavior||"instant"===h.behavior)return!0;if("object"===typeof h&&"smooth"===h.behavior)return!1;throw new TypeError("behavior member of ScrollOptions "+
h.behavior+" is not a valid value for enumeration ScrollBehavior.");}function e(h,t){if("Y"===t)return h.clientHeight+x<h.scrollHeight;if("X"===t)return h.clientWidth+x<h.scrollWidth}function f(h,t){h=k.getComputedStyle(h,null)["overflow"+t];return"auto"===h||"scroll"===h}function g(h){var t=e(h,"Y")&&f(h,"Y");h=e(h,"X")&&f(h,"X");return t||h}function l(h){var t=(r()-h.startTime)/468;var v=.5*(1-Math.cos(Math.PI*(1<t?1:t)));t=h.startX+(h.x-h.startX)*v;v=h.startY+(h.y-h.startY)*v;h.method.call(h.scrollable,
t,v);t===h.x&&v===h.y||k.requestAnimationFrame(l.bind(k,h))}function m(h,t,v){var A=r();if(h===p.body){var u=k;var w=k.scrollX||k.pageXOffset;h=k.scrollY||k.pageYOffset;var y=n.scroll}else u=h,w=h.scrollLeft,h=h.scrollTop,y=c;l({scrollable:u,method:y,startTime:A,startX:w,startY:h,x:t,y:v})}var k=window,p=document;if(!("scrollBehavior"in p.documentElement.style&&!0!==k.__forceSmoothScrollPolyfill__)){var q=k.HTMLElement||k.Element,n={scroll:k.scroll||k.scrollTo,scrollBy:k.scrollBy,elementScroll:q.prototype.scroll||
c,scrollIntoView:q.prototype.scrollIntoView},r=k.performance&&k.performance.now?k.performance.now.bind(k.performance):Date.now,x=/MSIE |Trident\/|Edge\//.test(k.navigator.userAgent)?1:0;k.scroll=k.scrollTo=function(h,t){void 0!==h&&(!0===d(h)?n.scroll.call(k,void 0!==h.left?h.left:"object"!==typeof h?h:k.scrollX||k.pageXOffset,void 0!==h.top?h.top:void 0!==t?t:k.scrollY||k.pageYOffset):m.call(k,p.body,void 0!==h.left?~~h.left:k.scrollX||k.pageXOffset,void 0!==h.top?~~h.top:k.scrollY||k.pageYOffset))};
k.scrollBy=function(h,t){void 0!==h&&(d(h)?n.scrollBy.call(k,void 0!==h.left?h.left:"object"!==typeof h?h:0,void 0!==h.top?h.top:void 0!==t?t:0):m.call(k,p.body,~~h.left+(k.scrollX||k.pageXOffset),~~h.top+(k.scrollY||k.pageYOffset)))};q.prototype.scroll=q.prototype.scrollTo=function(h,t){if(void 0!==h)if(!0===d(h)){if("number"===typeof h&&void 0===t)throw new SyntaxError("Value could not be converted");n.elementScroll.call(this,void 0!==h.left?~~h.left:"object"!==typeof h?~~h:this.scrollLeft,void 0!==
h.top?~~h.top:void 0!==t?~~t:this.scrollTop)}else t=h.left,h=h.top,m.call(this,this,"undefined"===typeof t?this.scrollLeft:~~t,"undefined"===typeof h?this.scrollTop:~~h)};q.prototype.scrollBy=function(h,t){void 0!==h&&(!0===d(h)?n.elementScroll.call(this,void 0!==h.left?~~h.left+this.scrollLeft:~~h+this.scrollLeft,void 0!==h.top?~~h.top+this.scrollTop:~~t+this.scrollTop):this.scroll({left:~~h.left+this.scrollLeft,top:~~h.top+this.scrollTop,behavior:h.behavior}))};q.prototype.scrollIntoView=function(h){if(!0===
d(h))n.scrollIntoView.call(this,void 0===h?!0:h);else{for(h=this;h!==p.body&&!1===g(h);)h=h.parentNode||h.host;var t=h.getBoundingClientRect(),v=this.getBoundingClientRect();h!==p.body?(m.call(this,h,h.scrollLeft+v.left-t.left,h.scrollTop+v.top-t.top),"fixed"!==k.getComputedStyle(h).position&&k.scrollBy({left:t.left,top:t.top,behavior:"smooth"})):k.scrollBy({left:v.left,top:v.top,behavior:"smooth"})}}}}}})()});Cb.polyfill;Cb.polyfill();class Sa extends Ra{constructor(a,b){void 0===b&&(b={});super(a,
b);this.tour=a;this.classPrefix=this.tour.options?jb(this.tour.options.classPrefix):"";this.styles=a.styles;Va(this);this._setOptions(b);return this}cancel(){this.tour.cancel();this.trigger("cancel")}complete(){this.tour.complete();this.trigger("complete")}destroy(){this.tooltip&&(this.tooltip.destroy(),this.tooltip=null);this.el instanceof HTMLElement&&this.el.parentNode&&(this.el.parentNode.removeChild(this.el),this.el=null);this._updateStepTargetOnHide();this.trigger("destroy")}getTour(){return this.tour}hide(){this.tour.modal.hide();
this.trigger("before-hide");this.el&&(this.el.hidden=!0);this._updateStepTargetOnHide();this.trigger("hide")}isCentered(){let a=Ma(this);return!a.element||!a.on}isOpen(){return!(!this.el||this.el.hidden)}show(){if(ea(this.options.beforeShowPromise)){let a=this.options.beforeShowPromise();if(void 0!==a)return a.then(()=>this._show())}this._show()}updateStepOptions(a){Object.assign(this.options,a);this.shepherdElementComponent&&this.shepherdElementComponent.$set({step:this})}getElement(){return this.el}getTarget(){return this.target}_createTooltipContent(){this.shepherdElementComponent=
new Cc({target:this.tour.options.stepsContainer||document.body,props:{classPrefix:this.classPrefix,descriptionId:`${this.id}-description`,labelId:`${this.id}-label`,step:this,styles:this.styles}});return this.shepherdElementComponent.getElement()}_scrollTo(a){let {element:b}=Ma(this);ea(this.options.scrollToHandler)?this.options.scrollToHandler(b):b instanceof Element&&"function"===typeof b.scrollIntoView&&b.scrollIntoView(a)}_getClassOptions(a){var b=this.tour&&this.tour.options&&this.tour.options.defaultStepOptions;
b=b&&b.classes?b.classes:"";a=[...(a.classes?a.classes:"").split(" "),...b.split(" ")];a=new Set(a);return Array.from(a).join(" ").trim()}_setOptions(a){void 0===a&&(a={});let b=this.tour&&this.tour.options&&this.tour.options.defaultStepOptions;b=Ac({},b||{});this.options=Object.assign({arrow:!0},b,a);let {when:c}=this.options;this.options.classes=this._getClassOptions(a);this.destroy();this.id=this.options.id||`step-${Na()}`;c&&Object.keys(c).forEach(d=>{this.on(d,c[d],this)})}_setupElements(){void 0!==
this.el&&this.destroy();this.el=this._createTooltipContent();this.options.advanceOn&&Hb(this);this.tooltip&&this.tooltip.destroy();let a=Ma(this),b=a.element,c=Xb(a,this);this.isCentered()&&(b=document.body,this.shepherdElementComponent.getElement().classList.add("shepherd-centered"));this.tooltip=Bc(b,this.el,c);this.target=a.element}_show(){this.trigger("before-show");this._setupElements();this.tour.modal||this.tour._setupModal();this.tour.modal.setupForStep(this);this._styleTargetElementForStep(this);
this.el.hidden=!1;this.options.scrollTo&&setTimeout(()=>{this._scrollTo(this.options.scrollTo)});this.el.hidden=!1;let a=this.shepherdElementComponent.getElement(),b=this.target||document.body;b.classList.add(`${this.classPrefix}shepherd-enabled`);b.classList.add(`${this.classPrefix}shepherd-target`);a.classList.add("shepherd-enabled");this.trigger("show")}_styleTargetElementForStep(a){let b=a.target;b&&(a.options.highlightClass&&b.classList.add(a.options.highlightClass),b.classList.remove("shepherd-target-click-disabled"),
!1===a.options.canClickTarget&&b.classList.add("shepherd-target-click-disabled"))}_updateStepTargetOnHide(){let a=this.target||document.body;this.options.highlightClass&&a.classList.remove(this.options.highlightClass);a.classList.remove("shepherd-target-click-disabled",`${this.classPrefix}shepherd-enabled`,`${this.classPrefix}shepherd-target`)}}class Dc extends T{constructor(a){super();S(this,a,yc,xc,Q,{element:0,openingProperties:4,getElement:5,closeModalOpening:6,hide:7,positionModal:8,setupForStep:9,
show:10})}get getElement(){return this.$$.ctx[5]}get closeModalOpening(){return this.$$.ctx[6]}get hide(){return this.$$.ctx[7]}get positionModal(){return this.$$.ctx[8]}get setupForStep(){return this.$$.ctx[9]}get show(){return this.$$.ctx[10]}}let oa=new Ra;class Ec extends Ra{constructor(a){void 0===a&&(a={});super(a);Va(this);this.options=Object.assign({},{exitOnEsc:!0,keyboardNavigation:!0},a);this.classPrefix=jb(this.options.classPrefix);this.steps=[];this.addSteps(this.options.steps);"active cancel complete inactive show start".split(" ").map(b=>
{(c=>{this.on(c,d=>{d=d||{};d.tour=this;oa.trigger(c,d)})})(b)});this._setTourID();return this}addStep(a,b){a instanceof Sa?a.tour=this:a=new Sa(this,a);void 0!==b?this.steps.splice(b,0,a):this.steps.push(a);return a}addSteps(a){Array.isArray(a)&&a.forEach(b=>{this.addStep(b)});return this}back(){let a=this.steps.indexOf(this.currentStep);this.show(a-1,!1)}cancel(){this.options.confirmCancel?window.confirm(this.options.confirmCancelMessage||"Are you sure you want to stop the tour?")&&this._done("cancel"):
this._done("cancel")}complete(){this._done("complete")}getById(a){return this.steps.find(b=>b.id===a)}getCurrentStep(){return this.currentStep}hide(){let a=this.getCurrentStep();if(a)return a.hide()}isActive(){return oa.activeTour===this}next(){let a=this.steps.indexOf(this.currentStep);a===this.steps.length-1?this.complete():this.show(a+1,!0)}removeStep(a){let b=this.getCurrentStep();this.steps.some((c,d)=>{if(c.id===a)return c.isOpen()&&c.hide(),c.destroy(),this.steps.splice(d,1),!0});b&&b.id===
a&&(this.currentStep=void 0,this.steps.length?this.show(0):this.cancel())}show(a,b){void 0===a&&(a=0);void 0===b&&(b=!0);if(a=qa(a)?this.getById(a):this.steps[a])this._updateStateBeforeShow(),ea(a.options.showOn)&&!a.options.showOn()?this._skipStep(a,b):(this.trigger("show",{step:a,previous:this.currentStep}),this.currentStep=a,a.show())}start(){this.trigger("start");this.focusedElBeforeOpen=document.activeElement;this.currentStep=null;this._setupModal();this._setupActiveTour();this.next()}_done(a){let b=
this.steps.indexOf(this.currentStep);Array.isArray(this.steps)&&this.steps.forEach(c=>c.destroy());wc(this);this.trigger(a,{index:b});oa.activeTour=null;this.trigger("inactive",{tour:this});this.modal&&this.modal.hide();"cancel"!==a&&"complete"!==a||!this.modal||(a=document.querySelector(".shepherd-modal-overlay-container"))&&a.remove();this.focusedElBeforeOpen instanceof HTMLElement&&this.focusedElBeforeOpen.focus()}_setupActiveTour(){this.trigger("active",{tour:this});oa.activeTour=this}_setupModal(){this.modal=
new Dc({target:this.options.modalContainer||document.body,props:{classPrefix:this.classPrefix,styles:this.styles}})}_skipStep(a,b){a=this.steps.indexOf(a);a===this.steps.length-1?this.complete():this.show(b?a+1:a-1,b)}_updateStateBeforeShow(){this.currentStep&&this.currentStep.hide();this.isActive()||this._setupActiveTour()}_setTourID(){this.id=`${this.options.tourName||"tour"}--${Na()}`}}Object.assign(oa,{Tour:Ec,Step:Sa});return oa})

;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Backbone, Drupal, settings, document, Shepherd) {
  var queryString = decodeURI(window.location.search);
  Drupal.behaviors.tour = {
    attach: function attach(context) {
      once('tour', 'body').forEach(function () {
        var model = new Drupal.tour.models.StateModel();
        new Drupal.tour.views.ToggleTourView({
          el: $(context).find('#toolbar-tab-tour'),
          model: model
        });
        model.on('change:isActive', function (tourModel, isActive) {
          $(document).trigger(isActive ? 'drupalTourStarted' : 'drupalTourStopped');
        });
        if (settings._tour_internal) {
          model.set('tour', settings._tour_internal);
        }
        if (/tour=?/i.test(queryString)) {
          model.set('isActive', true);
        }
      });
    }
  };
  Drupal.tour = Drupal.tour || {
    models: {},
    views: {}
  };
  Drupal.tour.models.StateModel = Backbone.Model.extend({
    defaults: {
      tour: [],
      isActive: false,
      activeTour: []
    }
  });
  Drupal.tour.views.ToggleTourView = Backbone.View.extend({
    events: {
      click: 'onClick'
    },
    initialize: function initialize() {
      this.listenTo(this.model, 'change:tour change:isActive', this.render);
      this.listenTo(this.model, 'change:isActive', this.toggleTour);
    },
    render: function render() {
      this.$el.toggleClass('hidden', this._getTour().length === 0);
      var isActive = this.model.get('isActive');
      this.$el.find('button').toggleClass('is-active', isActive).attr('aria-pressed', isActive);
      return this;
    },
    toggleTour: function toggleTour() {
      if (this.model.get('isActive')) {
        this._removeIrrelevantTourItems(this._getTour());
        var tourItems = this.model.get('tour');
        var that = this;
        if (tourItems.length) {
          settings.tourShepherdConfig.defaultStepOptions.popperOptions.modifiers.push({
            name: 'moveArrowJoyridePosition',
            enabled: true,
            phase: 'write',
            fn: function fn(_ref) {
              var state = _ref.state;
              var arrow = state.elements.arrow;
              var placement = state.placement;
              if (arrow && /^top|bottom/.test(placement) && /-start|-end$/.test(placement)) {
                var horizontalPosition = placement.split('-')[1];
                var offset = horizontalPosition === 'start' ? 28 : state.elements.popper.clientWidth - 56;
                arrow.style.transform = "translate3d(".concat(offset, "px, 0px, 0px)");
              }
            }
          });
          var shepherdTour = new Shepherd.Tour(settings.tourShepherdConfig);
          shepherdTour.on('cancel', function () {
            that.model.set('isActive', false);
          });
          shepherdTour.on('complete', function () {
            that.model.set('isActive', false);
          });
          tourItems.forEach(function (tourStepConfig, index) {
            var tourItemOptions = {
              title: tourStepConfig.title ? Drupal.checkPlain(tourStepConfig.title) : null,
              text: function text() {
                return Drupal.theme('tourItemContent', tourStepConfig);
              },
              attachTo: tourStepConfig.attachTo,
              buttons: [Drupal.tour.nextButton(shepherdTour, tourStepConfig)],
              classes: tourStepConfig.classes,
              index: index
            };
            tourItemOptions.when = {
              show: function show() {
                var nextButton = shepherdTour.currentStep.el.querySelector('footer button');
                nextButton.focus();
                if (Drupal.tour.hasOwnProperty('convertToJoyrideMarkup')) {
                  Drupal.tour.convertToJoyrideMarkup(shepherdTour);
                }
              }
            };
            shepherdTour.addStep(tourItemOptions);
          });
          shepherdTour.start();
          this.model.set({
            isActive: true,
            activeTour: shepherdTour
          });
        }
      } else {
        this.model.get('activeTour').cancel();
        this.model.set({
          isActive: false,
          activeTour: []
        });
      }
    },
    onClick: function onClick(event) {
      this.model.set('isActive', !this.model.get('isActive'));
      event.preventDefault();
      event.stopPropagation();
    },
    _getTour: function _getTour() {
      return this.model.get('tour');
    },
    _removeIrrelevantTourItems: function _removeIrrelevantTourItems(tourItems) {
      var tips = /tips=([^&]+)/.exec(queryString);
      var filteredTour = tourItems.filter(function (tourItem) {
        if (tips && tourItem.hasOwnProperty('classes') && tourItem.classes.indexOf(tips[1]) === -1) {
          return false;
        }
        return !(tourItem.selector && !document.querySelector(tourItem.selector));
      });
      if (tourItems.length !== filteredTour.length) {
        filteredTour.forEach(function (filteredTourItem, filteredTourItemId) {
          filteredTour[filteredTourItemId].counter = Drupal.t('!tour_item of !total', {
            '!tour_item': filteredTourItemId + 1,
            '!total': filteredTour.length
          });
          if (filteredTourItemId === filteredTour.length - 1) {
            filteredTour[filteredTourItemId].cancelText = Drupal.t('End tour');
          }
        });
        this.model.set('tour', filteredTour);
      }
    }
  });
  Drupal.tour.nextButton = function (shepherdTour, tourStepConfig) {
    return {
      classes: 'button button--primary',
      text: tourStepConfig.cancelText ? tourStepConfig.cancelText : Drupal.t('Next'),
      action: tourStepConfig.cancelText ? shepherdTour.cancel : shepherdTour.next
    };
  };
  Drupal.theme.tourItemContent = function (tourStepConfig) {
    return "".concat(tourStepConfig.body, "<div class=\"tour-progress\">").concat(tourStepConfig.counter, "</div>");
  };
})(jQuery, Backbone, Drupal, drupalSettings, document, window.Shepherd);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }
function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
(function ($, Drupal, _ref) {
  var tabbable = _ref.tabbable,
    isTabbable = _ref.isTabbable;
  function TabbingManager() {
    this.stack = [];
  }
  function TabbingContext(options) {
    $.extend(this, {
      level: null,
      $tabbableElements: $(),
      $disabledElements: $(),
      released: false,
      active: false,
      trapFocus: false
    }, options);
  }
  $.extend(TabbingManager.prototype, {
    constrain: function constrain(elements) {
      var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref2$trapFocus = _ref2.trapFocus,
        trapFocus = _ref2$trapFocus === void 0 ? false : _ref2$trapFocus;
      var il = this.stack.length;
      for (var i = 0; i < il; i++) {
        this.stack[i].deactivate();
      }
      var tabbableElements = [];
      $(elements).each(function (index, rootElement) {
        tabbableElements = [].concat(_toConsumableArray(tabbableElements), _toConsumableArray(tabbable(rootElement)));
        if (isTabbable(rootElement)) {
          tabbableElements = [].concat(_toConsumableArray(tabbableElements), [rootElement]);
        }
      });
      var tabbingContext = new TabbingContext({
        level: this.stack.length,
        $tabbableElements: $(tabbableElements),
        trapFocus: trapFocus
      });
      this.stack.push(tabbingContext);
      tabbingContext.activate();
      $(document).trigger('drupalTabbingConstrained', tabbingContext);
      return tabbingContext;
    },
    release: function release() {
      var toActivate = this.stack.length - 1;
      while (toActivate >= 0 && this.stack[toActivate].released) {
        toActivate--;
      }
      this.stack.splice(toActivate + 1);
      if (toActivate >= 0) {
        this.stack[toActivate].activate();
      }
    },
    activate: function activate(tabbingContext) {
      var $set = tabbingContext.$tabbableElements;
      var level = tabbingContext.level;
      var $disabledSet = $(tabbable(document.body)).not($set);
      tabbingContext.$disabledElements = $disabledSet;
      var il = $disabledSet.length;
      for (var i = 0; i < il; i++) {
        this.recordTabindex($disabledSet.eq(i), level);
      }
      $disabledSet.prop('tabindex', -1).prop('autofocus', false);
      var $hasFocus = $set.filter('[autofocus]').eq(-1);
      if ($hasFocus.length === 0) {
        $hasFocus = $set.eq(0);
      }
      $hasFocus.trigger('focus');
      if ($set.length && tabbingContext.trapFocus) {
        $set.last().on('keydown.focus-trap', function (event) {
          if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            $set.first().focus();
          }
        });
        $set.first().on('keydown.focus-trap', function (event) {
          if (event.key === 'Tab' && event.shiftKey) {
            event.preventDefault();
            $set.last().focus();
          }
        });
      }
    },
    deactivate: function deactivate(tabbingContext) {
      var $set = tabbingContext.$disabledElements;
      var level = tabbingContext.level;
      var il = $set.length;
      tabbingContext.$tabbableElements.first().off('keydown.focus-trap');
      tabbingContext.$tabbableElements.last().off('keydown.focus-trap');
      for (var i = 0; i < il; i++) {
        this.restoreTabindex($set.eq(i), level);
      }
    },
    recordTabindex: function recordTabindex($el, level) {
      var tabInfo = $el.data('drupalOriginalTabIndices') || {};
      tabInfo[level] = {
        tabindex: $el[0].getAttribute('tabindex'),
        autofocus: $el[0].hasAttribute('autofocus')
      };
      $el.data('drupalOriginalTabIndices', tabInfo);
    },
    restoreTabindex: function restoreTabindex($el, level) {
      var tabInfo = $el.data('drupalOriginalTabIndices');
      if (tabInfo && tabInfo[level]) {
        var data = tabInfo[level];
        if (data.tabindex) {
          $el[0].setAttribute('tabindex', data.tabindex);
        } else {
          $el[0].removeAttribute('tabindex');
        }
        if (data.autofocus) {
          $el[0].setAttribute('autofocus', 'autofocus');
        }
        if (level === 0) {
          $el.removeData('drupalOriginalTabIndices');
        } else {
          var levelToDelete = level;
          while (tabInfo.hasOwnProperty(levelToDelete)) {
            delete tabInfo[levelToDelete];
            levelToDelete++;
          }
          $el.data('drupalOriginalTabIndices', tabInfo);
        }
      }
    }
  });
  $.extend(TabbingContext.prototype, {
    release: function release() {
      if (!this.released) {
        this.deactivate();
        this.released = true;
        Drupal.tabbingManager.release(this);
        $(document).trigger('drupalTabbingContextReleased', this);
      }
    },
    activate: function activate() {
      if (!this.active && !this.released) {
        this.active = true;
        Drupal.tabbingManager.activate(this);
        $(document).trigger('drupalTabbingContextActivated', this);
      }
    },
    deactivate: function deactivate() {
      if (this.active) {
        this.active = false;
        Drupal.tabbingManager.deactivate(this);
        $(document).trigger('drupalTabbingContextDeactivated', this);
      }
    }
  });
  if (Drupal.tabbingManager) {
    return;
  }
  Drupal.tabbingManager = new TabbingManager();
})(jQuery, Drupal, window.tabbable);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Drupal, Backbone) {
  var strings = {
    tabbingReleased: Drupal.t('Tabbing is no longer constrained by the Contextual module.'),
    tabbingConstrained: Drupal.t('Tabbing is constrained to a set of @contextualsCount and the edit mode toggle.'),
    pressEsc: Drupal.t('Press the esc key to exit.')
  };
  function initContextualToolbar(context) {
    if (!Drupal.contextual || !Drupal.contextual.collection) {
      return;
    }
    var contextualToolbar = Drupal.contextualToolbar;
    contextualToolbar.model = new contextualToolbar.StateModel({
      isViewing: localStorage.getItem('Drupal.contextualToolbar.isViewing') !== 'false'
    }, {
      contextualCollection: Drupal.contextual.collection
    });
    var viewOptions = {
      el: $('.toolbar .toolbar-bar .contextual-toolbar-tab'),
      model: contextualToolbar.model,
      strings: strings
    };
    new contextualToolbar.VisualView(viewOptions);
    new contextualToolbar.AuralView(viewOptions);
  }
  Drupal.behaviors.contextualToolbar = {
    attach: function attach(context) {
      if (once('contextualToolbar-init', 'body').length) {
        initContextualToolbar(context);
      }
    }
  };
  Drupal.contextualToolbar = {
    model: null
  };
})(jQuery, Drupal, Backbone);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function (Drupal, Backbone) {
  Drupal.contextualToolbar.StateModel = Backbone.Model.extend({
    defaults: {
      isViewing: true,
      isVisible: false,
      contextualCount: 0,
      tabbingContext: null
    },
    initialize: function initialize(attrs, options) {
      this.listenTo(options.contextualCollection, 'reset remove add', this.countContextualLinks);
      this.listenTo(options.contextualCollection, 'add', this.lockNewContextualLinks);
      this.listenTo(this, 'change:contextualCount', this.updateVisibility);
      this.listenTo(this, 'change:isViewing', function (model, isViewing) {
        options.contextualCollection.each(function (contextualModel) {
          contextualModel.set('isLocked', !isViewing);
        });
      });
    },
    countContextualLinks: function countContextualLinks(contextualModel, contextualCollection) {
      this.set('contextualCount', contextualCollection.length);
    },
    lockNewContextualLinks: function lockNewContextualLinks(contextualModel, contextualCollection) {
      if (!this.get('isViewing')) {
        contextualModel.set('isLocked', true);
      }
    },
    updateVisibility: function updateVisibility() {
      this.set('isVisible', this.get('contextualCount') > 0);
    }
  });
})(Drupal, Backbone);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Drupal, Backbone, _) {
  Drupal.contextualToolbar.AuralView = Backbone.View.extend({
    announcedOnce: false,
    initialize: function initialize(options) {
      this.options = options;
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'change:isViewing', this.manageTabbing);
      $(document).on('keyup', _.bind(this.onKeypress, this));
      this.manageTabbing();
    },
    render: function render() {
      this.$el.find('button').attr('aria-pressed', !this.model.get('isViewing'));
      return this;
    },
    manageTabbing: function manageTabbing() {
      var tabbingContext = this.model.get('tabbingContext');
      if (tabbingContext) {
        if (tabbingContext.active) {
          Drupal.announce(this.options.strings.tabbingReleased);
        }
        tabbingContext.release();
      }
      if (!this.model.get('isViewing')) {
        tabbingContext = Drupal.tabbingManager.constrain($('.contextual-toolbar-tab, .contextual'));
        this.model.set('tabbingContext', tabbingContext);
        this.announceTabbingConstraint();
        this.announcedOnce = true;
      }
    },
    announceTabbingConstraint: function announceTabbingConstraint() {
      var strings = this.options.strings;
      Drupal.announce(Drupal.formatString(strings.tabbingConstrained, {
        '@contextualsCount': Drupal.formatPlural(Drupal.contextual.collection.length, '@count contextual link', '@count contextual links')
      }));
      Drupal.announce(strings.pressEsc);
    },
    onKeypress: function onKeypress(event) {
      if (!this.announcedOnce && event.keyCode === 9 && !this.model.get('isViewing')) {
        this.announceTabbingConstraint();
        this.announcedOnce = true;
      }
      if (event.keyCode === 27) {
        this.model.set('isViewing', true);
      }
    }
  });
})(jQuery, Drupal, Backbone, _);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function (Drupal, Backbone) {
  Drupal.contextualToolbar.VisualView = Backbone.View.extend({
    events: function events() {
      var touchEndToClick = function touchEndToClick(event) {
        event.preventDefault();
        event.target.click();
      };
      return {
        click: function click() {
          this.model.set('isViewing', !this.model.get('isViewing'));
        },
        touchend: touchEndToClick
      };
    },
    initialize: function initialize() {
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'change:isViewing', this.persist);
    },
    render: function render() {
      this.$el.toggleClass('hidden', !this.model.get('isVisible'));
      this.$el.find('button').toggleClass('is-active', !this.model.get('isViewing'));
      return this;
    },
    persist: function persist(model, isViewing) {
      if (!isViewing) {
        localStorage.setItem('Drupal.contextualToolbar.isViewing', 'false');
      } else {
        localStorage.removeItem('Drupal.contextualToolbar.isViewing');
      }
    }
  });
})(Drupal, Backbone);;
/**
* DO NOT EDIT THIS FILE.
* See the following change record for more information,
* https://www.drupal.org/node/2815083
* @preserve
**/
(function ($, Drupal, drupalSettings) {
  var pathInfo = drupalSettings.path;
  var escapeAdminPath = sessionStorage.getItem('escapeAdminPath');
  var windowLocation = window.location;
  if (!pathInfo.currentPathIsAdmin && !/destination=/.test(windowLocation.search)) {
    sessionStorage.setItem('escapeAdminPath', windowLocation);
  }
  Drupal.behaviors.escapeAdmin = {
    attach: function attach() {
      var toolbarEscape = once('escapeAdmin', '[data-toolbar-escape-admin]');
      if (toolbarEscape.length && pathInfo.currentPathIsAdmin) {
        if (escapeAdminPath !== null) {
          $(toolbarEscape).attr('href', escapeAdminPath);
        } else {
          toolbarEscape[0].textContent = Drupal.t('Home');
        }
      }
    }
  };
})(jQuery, Drupal, drupalSettings);;
