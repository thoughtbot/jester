/* 

Jester is a JavaScript implementation of REST, modeled after ActiveResource.

For more details, see:
http://giantrobots.thoughtbot.com/2007/4/2/jester-javascriptian-rest

*/


/* The standard way of declaring a model is:
   Base.model("User")
   This assumes "user" as a singular form, and "users" as a plural.
   Prefix rules: If no prefix given, default to the local domain
     If prefix given, and prefix begins with "http:", take that as the entire prefix,
        otherwise, treat it as a relative path and append it to the default prefix, adding a slash if necessary.
     Example valid prefixes, assuming current domain is "www.thoughtbot.com:8080":
       "http://www.google.com" => http://www.google.com
       "" or null => http://www.thoughtbot.com:8080
       "public/forum" => http://www.thoughtbot.com:8080/public/forum
       "/public/forum" => http://www.thoughtbot.com:8080/public/forum
*/
function Base(name, prefix, singular, plural) {
  // We delay instantiating XML.ObjTree() so that it can be listed at the end of this file instead of the beginning
  // And hey, maybe a load performance benefit too.
  if (!Base._tree) {
    Base._tree = new XML.ObjTree();
    Base._tree.attr_prefix = "@";
  }

  this._name = name;
  
  if (singular)
    this._singular = singular;
  else
    this._singular = name.toLowerCase();
  
  this._plural = this._singular.pluralize(plural);    
  
  // Establish prefix
  default_prefix = function() {return "http://" + window.location.hostname + (window.location.port ? ":" + window.location.port : "");}
  if (prefix) {
    if (!prefix.match(/^http:/))
       this._prefix = default_prefix() + (prefix.match(/^\//) ? "" : "/") + prefix
    else
      this._prefix = prefix;
  }
  else
    this._prefix = default_prefix();
  
  // Initialize no attributes, no associations
  this._properties = [];
  this._associations = [];
  
  // Initialize with no errors
  this.errors = [];
}

// Model declaration helper
Base.model = function(name, prefix, singular, plural) {eval(name + " = new Base(name, prefix, singular, plural);")}

// does a request that expects XML, and parses it on return before passing it back
Base.requestXML = function(callback, url, options, user_callback) {
  parse_and_callback = function(transport) {
    return callback(Base._tree.parseXML(transport.responseText));
  }
  
  // most XML requests are going to be a GET
  if (!(options.postBody || options.parameters || options.postbody || options.method == "post"))
    options.method = "get";
    
  return Base.request(parse_and_callback, url, options, user_callback);
}

// Helper to aid in handling either async or synchronous requests
Base.request = function(callback, url, options, user_callback) {
  if (user_callback) options.asynchronous = true;
  else options.asynchronous = false;
  
  if (options.asynchronous) {
    options.onComplete = function(transport) {user_callback(callback(transport));}
    return new Ajax.Request(url, options).transport;
  }
  else
    return callback(new Ajax.Request(url, options).transport);
}

// Logic taken from Prototype
extend = function(object, properties) {for (var property in properties) object[property] = properties[property];}

extend(Base.prototype, {
  new_record : function() {return !(this.id);},
  valid : function() {return ! this.errors.any();},
  
  find : function(id, callback) {
    findAllWork = function(doc) {
      // if only one result, wrap it in an array
      if (!Base.elementHasMany(doc[this._plural]))
        doc[this._plural][this._singular] = [doc[this._plural][this._singular]];
      
      var results = doc[this._plural][this._singular].map(function(elem) {
        return this.build(this._attributesFromTree(elem));
      }.bind(this));
      
      // This is better than requiring the controller to support a "limit" parameter
      if (id == "first")
        return results[0];
        
      return results; 
    }.bind(this);
    
    findOneWork = function(doc) {
      attributes = this._attributesFromTree(doc[this._singular]);
      return this.build(attributes);
    }.bind(this);
    
    if (id == "first" || id == "all") {
      var url = this._plural_url();
      return Base.requestXML(findAllWork, url, {}, callback);
    }
    else {
      if (isNaN(parseInt(id))) return null;
      url = this._singular_url(id);
      return Base.requestXML(findOneWork, url, {}, callback);
    }
  },
  
  reload : function(callback) {
    reloadWork = function(copy) {
      for (var i=0; i<copy._properties.length; i++)
        this._setProperty(copy._properties[i], copy[copy._properties[i]]);
      for (var i=0; i<copy._associations.length; i++)
        this._setAssociation(copy._associations[i], copy[copy._associations[i]]);
  
      if (callback)
        return callback(this);
      else
        return this;
    }.bind(this);
    
    if (this.id) {
      if (callback)
        return this.find(this.id, reloadWork);
      else
        return reloadWork(this.find(this.id));
    }
    else
      return this;
  },
  
  // This function would be named "new", if JavaScript in IE allowed that.
  build : function(attributes, name, prefix, singular, plural) {
    var base;
    if (name)
      base = new Base(name, prefix, singular, plural)
    else
      base = new Base(this._name, this._prefix, this._singular, this._plural);
    
    base._setAttributes(attributes);
    return base;
  },
  
  create : function(attributes, callback) {
    var base = this.build(attributes);
    
    createWork = function(saved) {
      if (callback)
        return callback(base);
      else
        return base;
    }.bind(this);
    
    if (callback)
      return base.save(createWork);
    else
      return createWork(base.save());
  },
  
  // If not given an ID, destroys itself, if it has an ID.  If given an ID, destroys that record.
  // You can call destroy(), destroy(1), destroy(callback()), or destroy(1, callback()), and it works as you expect.
  destroy : function(given_id, callback) {
    if (typeof(given_id) == "function") {
      callback = given_id;
      given_id = null;
    }
    var id = given_id || this.id;
    if (!id) return false;
    
    destroyWork = function(transport) {
      if (transport.status == 200) {
        if (!given_id || this.id == given_id)
          this.id = null;
        return this;
      }
      else
        return false;
    }.bind(this);
    
    return Base.request(destroyWork, this._singular_url(id), {method: "delete"}, callback);
  },
  
  save : function(callback) {
    saveWork = function(transport) {
      var saved = false;

      // create response
      if (this.new_record()) {
        if (transport.status == 201) {
          loc = transport.getResponseHeader("location");
          if (loc) {
            id = loc.match(/\/([^\/]*?)(\.\w+)?$/)[1];
            if (id) {
              this.id = parseInt(id);
              saved = true;
            }
          }
        }
        // check for errors
        else if (transport.status == 200) {
          if (transport.responseText) {
            var doc = Base._tree.parseXML(transport.responseText);
            if (doc.errors)
              this._setErrors(this._errorsFromTree(doc.errors));
          }
        }
      }
      // update response
      else {
        if (transport.status == 200) {
          saved = true;
          // check for errors
          if (transport.responseText) {
            var doc = Base._tree.parseXML(transport.responseText);
            if (doc.errors) {
              this._setErrors(this._errorsFromTree(doc.errors));
              saved = false;
            }
          }
        }
      }
      
      return saved;
    }.bind(this);
  
    // reset errors
    this._setErrors([]);
  
    var url = null;
    var method = null;
    
    // distinguish between create and update
    if (this.new_record()) {
      url = this._plural_url();
      method = "post";
    }
    else {
      url = this._singular_url();
      method = "put";
    }
    
    // collect params
    var params = {};
    (this._properties).each(function(value, i) {
      params[this._singular + "[" + value + "]"] = this[value];
    }.bind(this));
    
    // send the request
    return Base.request(saveWork, url, {parameters: params, method: method}, callback);
  },
  
  // mimics ActiveRecord's behavior of omitting associations, but keeping foreign keys
  attributes : function() {
    var attributes = {}
    for (var i=0; i<this._properties.length; i++)
      attributes[this._properties[i]] = this[this._properties[i]];
    return attributes;
  },
    
  
  /*
    Internal methods.
  */
  
  _errorsFromTree : function(elements) {
  
    var errors = [];
    if (typeof(elements.error) == "string")
      elements.error = [elements.error];
    
    elements.error.each(function(value, index) {
      errors.push(value);
    });
    
    return errors;
  },
  
  // Sets errors with an array.  Could be extended at some point to include breaking error messages into pairs (attribute, msg).
  _setErrors : function(errors) {
    this.errors = errors;
  },
  
  // Converts the XML tree returned from a single object into a hash of attribute values
  _attributesFromTree : function(elements) {
    var attributes = {}
    for (var attr in elements) {
      // pull out the value
      var value;
      if (elements[attr]["#text"])
        value = elements[attr]["#text"];
      else
        value = elements[attr];
      
      // handle scalars
      if (typeof(value) == "string") {
        // perform any useful type transformations
        if (elements[attr]["@type"] == "integer")
          value = parseInt(value);
        else if (elements[attr]["@type"] == "boolean")
          value = (value == "true");
        else if (elements[attr]["@type"] == "datetime") {
          date = Date.parse(value);
          if (!isNaN(date)) value = date;
        }
      }
      // handle arrays (associations)
      else {
        var relation = value; // rename for clarity in the context of an association
        
        // first, detect if it's has_one/belongs_to, or has_many
        var i = 0;
        var singular = null;
        var has_many = false;
        for (var val in relation) {
          if (i == 0)
            singular = val;
          i += 1;
        }
        
        
        // has_many
        if (relation[singular] && typeof(relation[singular]) == "object" && i == 1) {
          var value = [];
          var plural = attr;
          var name = singular.capitalize();
          
          // force array
          if (!(elements[plural][singular].length > 0))
            elements[plural][singular] = [elements[plural][singular]];
          
          elements[plural][singular].each(function(single) {
            value.push(this.build(this._attributesFromTree(single), name, this._prefix, singular, plural));
          }.bind(this));
        }
        // has_one or belongs_to
        else {
          singular = attr;
          var name = singular.capitalize();
          value = this.build(this._attributesFromTree(value), name, this._prefix, singular);
        }
      }
      
      // transform attribute name if needed
      attribute = attr.replace(/-/, "_");
      attributes[attribute] = value;
    }
    
    return attributes;
  },
  
  
  // Sets all attributes and associations at once
  // Deciding between the two on whether the attribute is a complex object or a scalar
  _setAttributes : function(attributes) {
    this._clear();
    for (var attr in attributes) {
      if (typeof(attributes[attr]) == "object")
        this._setAssociation(attr, attributes[attr]);
      else
        this._setProperty(attr, attributes[attr]);
    }
  },
  
  // Set attributes
  // Force this array to be treated as attributes
  _setProperties : function(properties) {
    this._clearProperties();
    for (var prop in properties)
      this._setProperty(prop, properties[prop])
  },
  
  _setAssociations : function(associations) {
    this._clearAssociations();
    for (var assoc in associations)
      this._setAssociation(assoc, associations[assoc])
  },
      
  _setProperty : function(property, value) {  
    this[property] = value;
    if (!(this._properties.include(property)))
      this._properties.push(property);  
  },
  
  _setAssociation : function(association, value) {
    this[association] = value;
    if (!(this._associations.include(association)))
      this._associations.push(association);
  },
  
  _clear : function() {
    this._clearProperties();
    this._clearAssociations();
  },
  
  _clearProperties : function() {
    for (var i=0; i<this._properties.length; i++)
      this[this._properties[i]] = null;
    this._properties = [];
  },
  
  _clearAssociations : function() {
    for (var i=0; i<this._associations.length; i++)
      this[this._associations[i]] = null;
    this._associations = [];
  },
  
  // helper URLs
  _singular_url : function(id) {return ((id || this.id) ? this._prefix + "/" + this._plural + "/" + (id || this.id) + ".xml" : "");},
  _plural_url : function() {return this._prefix + "/" + this._plural + ".xml";},

});

// Returns true if the element has more objects beneath it, or just 1 or more attributes.
// It's not perfect, this would mess up if an object had only one attribute, and it was an array.
// For now, this is just one of the difficulties of dealing with ObjTree.
Base.elementHasMany = function(element) {
  var i = 0;
  var singular = null;
  var has_many = false;
  for (var val in element) {
    if (i == 0)
      singular = val;
    i += 1;
  }
  
  return (element[singular] && typeof(element[singular]) == "object" && element[singular].length != null && i == 1);
}

/* 
  Inflector library, contributed graciously to Jester by Ryan Schuft.
  The library in full is a complete port of Rails' Inflector, though Jester only uses its pluralization.
  Its home page, including its MIT license, can be found at http://code.google.com/p/inflection-js/
*/

if (!String.prototype.pluralize) String.prototype.pluralize = function(plural) {
  var str=this;
  if(plural)str=plural;
  else {
    var uncountable_words=['equipment','information','rice','money','species','series','fish','sheep','moose'];
    var uncountable=false;
    for(var x=0;!uncountable&&x<uncountable_words.length;x++)uncountable=(uncountable_words[x].toLowerCase()==str.toLowerCase());
    if(!uncountable) {
      var rules=[
        [new RegExp('(m)an$','gi'),'$1en'],
        [new RegExp('(pe)rson$','gi'),'$1ople'],
        [new RegExp('(child)$','gi'),'$1ren'],
        [new RegExp('(ax|test)is$','gi'),'$1es'],
        [new RegExp('(octop|vir)us$','gi'),'$1i'],
        [new RegExp('(alias|status)$','gi'),'$1es'],
        [new RegExp('(bu)s$','gi'),'$1ses'],
        [new RegExp('(buffal|tomat)o$','gi'),'$1oes'],
        [new RegExp('([ti])um$','gi'),'$1a'],
        [new RegExp('sis$','gi'),'ses'],
        [new RegExp('(?:([^f])fe|([lr])f)$','gi'),'$1$2ves'],
        [new RegExp('(hive)$','gi'),'$1s'],
        [new RegExp('([^aeiouy]|qu)y$','gi'),'$1ies'],
        [new RegExp('(x|ch|ss|sh)$','gi'),'$1es'],
        [new RegExp('(matr|vert|ind)ix|ex$','gi'),'$1ices'],
        [new RegExp('([m|l])ouse$','gi'),'$1ice'],
        [new RegExp('^(ox)$','gi'),'$1en'],
        [new RegExp('(quiz)$','gi'),'$1zes'],
        [new RegExp('s$','gi'),'s'],
        [new RegExp('$','gi'),'s']
      ];
      var matched=false;
      for(var x=0;!matched&&x<=rules.length;x++) {
        matched=str.match(rules[x][0]);
        if(matched)str=str.replace(rules[x][0],rules[x][1]);
      }
    }
  }
  return str;
};

/*

This is a lighter form of ObjTree, with the parts I don't use removed to keep jester.js light.

// ========================================================================
//  XML.ObjTree -- XML source code from/to JavaScript object like E4X
// ========================================================================

Copyright (c) 2005-2006 Yusuke Kawasaki. All rights reserved.
This program is free software; you can redistribute it and/or
modify it under the Artistic license. Or whatever license I choose,
which I will do instead of keeping this documentation like it is.

*/

if ( typeof(XML) == 'undefined' ) XML = function() {};

//  constructor
XML.ObjTree = function () {
    return this;
};

//  class variables
XML.ObjTree.VERSION = "0.24";

//  object prototype
XML.ObjTree.prototype.xmlDecl = '<?xml version="1.0" encoding="UTF-8" ?>\n';
XML.ObjTree.prototype.attr_prefix = '-';
XML.ObjTree.prototype.overrideMimeType = 'text/xml';

//  method: parseXML( xmlsource )
XML.ObjTree.prototype.parseXML = function ( xml ) {
    var root;
    if ( window.DOMParser ) {
        var xmldom = new DOMParser();
//      xmldom.async = false;           // DOMParser is always sync-mode
        var dom = xmldom.parseFromString( xml, "application/xml" );
        if ( ! dom ) return;
        root = dom.documentElement;
    } else if ( window.ActiveXObject ) {
        xmldom = new ActiveXObject('Microsoft.XMLDOM');
        xmldom.async = false;
        xmldom.loadXML( xml );
        root = xmldom.documentElement;
    }
    if ( ! root ) return;
    return this.parseDOM( root );
};

//  method: parseDOM( documentroot )
XML.ObjTree.prototype.parseDOM = function ( root ) {
    if ( ! root ) return;

    this.__force_array = {};
    if ( this.force_array ) {
        for( var i=0; i<this.force_array.length; i++ ) {
            this.__force_array[this.force_array[i]] = 1;
        }
    }

    var json = this.parseElement( root );   // parse root node
    if ( this.__force_array[root.nodeName] ) {
        json = [ json ];
    }
    if ( root.nodeType != 11 ) {            // DOCUMENT_FRAGMENT_NODE
        var tmp = {};
        tmp[root.nodeName] = json;          // root nodeName
        json = tmp;
    }
    return json;
};

//  method: parseElement( element )
XML.ObjTree.prototype.parseElement = function ( elem ) {
    //  COMMENT_NODE
    if ( elem.nodeType == 7 ) {
        return;
    }

    //  TEXT_NODE CDATA_SECTION_NODE
    if ( elem.nodeType == 3 || elem.nodeType == 4 ) {
        var bool = elem.nodeValue.match( /[^\x00-\x20]/ );
        if ( bool == null ) return;     // ignore white spaces
        return elem.nodeValue;
    }

    var retval;
    var cnt = {};

    //  parse attributes
    if ( elem.attributes && elem.attributes.length ) {
        retval = {};
        for ( var i=0; i<elem.attributes.length; i++ ) {
            var key = elem.attributes[i].nodeName;
            if ( typeof(key) != "string" ) continue;
            var val = elem.attributes[i].nodeValue;
            if ( ! val ) continue;
            key = this.attr_prefix + key;
            if ( typeof(cnt[key]) == "undefined" ) cnt[key] = 0;
            cnt[key] ++;
            this.addNode( retval, key, cnt[key], val );
        }
    }

    //  parse child nodes (recursive)
    if ( elem.childNodes && elem.childNodes.length ) {
        var textonly = true;
        if ( retval ) textonly = false;        // some attributes exists
        for ( var i=0; i<elem.childNodes.length && textonly; i++ ) {
            var ntype = elem.childNodes[i].nodeType;
            if ( ntype == 3 || ntype == 4 ) continue;
            textonly = false;
        }
        if ( textonly ) {
            if ( ! retval ) retval = "";
            for ( var i=0; i<elem.childNodes.length; i++ ) {
                retval += elem.childNodes[i].nodeValue;
            }
        } else {
            if ( ! retval ) retval = {};
            for ( var i=0; i<elem.childNodes.length; i++ ) {
                var key = elem.childNodes[i].nodeName;
                if ( typeof(key) != "string" ) continue;
                var val = this.parseElement( elem.childNodes[i] );
                if ( ! val ) continue;
                if ( typeof(cnt[key]) == "undefined" ) cnt[key] = 0;
                cnt[key] ++;
                this.addNode( retval, key, cnt[key], val );
            }
        }
    }
    return retval;
};

//  method: addNode( hash, key, count, value )
XML.ObjTree.prototype.addNode = function ( hash, key, cnts, val ) {
    if ( this.__force_array[key] ) {
        if ( cnts == 1 ) hash[key] = [];
        hash[key][hash[key].length] = val;      // push
    } else if ( cnts == 1 ) {                   // 1st sibling
        hash[key] = val;
    } else if ( cnts == 2 ) {                   // 2nd sibling
        hash[key] = [ hash[key], val ];
    } else {                                    // 3rd sibling and more
        hash[key][hash[key].length] = val;
    }
};