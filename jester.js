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

This is a lighter form of ObjTree, with the parts I don't use removed to keep jester.js light.  Compressed using http://dean.edwards.name/packer/.

// ========================================================================
//  XML.ObjTree -- XML source code from/to JavaScript object like E4X
// ========================================================================

Copyright (c) 2005-2006 Yusuke Kawasaki. All rights reserved.
This program is free software; you can redistribute it and/or
modify it under the Artistic license. Or whatever license I choose,
which I will do instead of keeping this documentation like it is.

*/

eval(function(p,a,c,k,e,r){e=function(c){return(c<a?'':e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29):c.toString(36))};if(!''.replace(/^/,String)){while(c--)r[e(c)]=k[c]||e(c);k=[function(e){return r[e]}];e=function(){return'\\w+'};c=1};while(c--)if(k[c])p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c]);return p}('5(r(j)==\'D\')j=q(){};j.m=q(){k 9};j.m.10="0.V";j.m.p.S=\'<?E 18="1.0" 14="13-8" ?>\\n\';j.m.p.H=\'-\';j.m.p.W=\'U/E\';j.m.p.T=q(a){6 b;5(N.I){6 c=M I();6 d=c.17(a,"16/E");5(!d)k;b=d.K}u 5(N.J){c=M J(\'12.Z\');c.Y=C;c.X(a);b=c.K}5(!b)k;k 9.G(b)};j.m.p.G=q(a){5(!a)k;9.z={};5(9.B){w(6 i=0;i<9.B.l;i++){9.z[9.B[i]]=1}}6 b=9.A(a);5(9.z[a.x]){b=[b]}5(a.s!=11){6 c={};c[a.x]=b;b=c}k b};j.m.p.A=q(a){5(a.s==7){k}5(a.s==3||a.s==4){6 b=a.y.R(/[^\\Q-\\P]/);5(b==O)k;k a.y}6 c;6 d={};5(a.t&&a.t.l){c={};w(6 i=0;i<a.t.l;i++){6 e=a.t[i].x;5(r(e)!="L")v;6 f=a.t[i].y;5(!f)v;e=9.H+e;5(r(d[e])=="D")d[e]=0;d[e]++;9.F(c,e,d[e],f)}}5(a.o&&a.o.l){6 g=15;5(c)g=C;w(6 i=0;i<a.o.l&&g;i++){6 h=a.o[i].s;5(h==3||h==4)v;g=C}5(g){5(!c)c="";w(6 i=0;i<a.o.l;i++){c+=a.o[i].y}}u{5(!c)c={};w(6 i=0;i<a.o.l;i++){6 e=a.o[i].x;5(r(e)!="L")v;6 f=9.A(a.o[i]);5(!f)v;5(r(d[e])=="D")d[e]=0;d[e]++;9.F(c,e,d[e],f)}}}k c};j.m.p.F=q(a,b,c,d){5(9.z[b]){5(c==1)a[b]=[];a[b][a[b].l]=d}u 5(c==1){a[b]=d}u 5(c==2){a[b]=[a[b],d]}u{a[b][a[b].l]=d}};',62,71,'|||||if|var|||this||||||||||XML|return|length|ObjTree||childNodes|prototype|function|typeof|nodeType|attributes|else|continue|for|nodeName|nodeValue|__force_array|parseElement|force_array|false|undefined|xml|addNode|parseDOM|attr_prefix|DOMParser|ActiveXObject|documentElement|string|new|window|null|x20|x00|match|xmlDecl|parseXML|text|24|overrideMimeType|loadXML|async|XMLDOM|VERSION||Microsoft|UTF|encoding|true|application|parseFromString|version'.split('|'),0,{}))

