/*
(c) 2007, thoughtbot, inc.

Jester is a JavaScript implementation of REST, modeled after ActiveResource.

More details can be found at:
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
  this._name = name;
  
  if (singular)
    this._singular = singular;
  else
    this._singular = name.toLowerCase();
  
  if (plural)
    this._plural = plural;
  else
    this._plural = this._singular + "s";
  
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
  
  // Initialize with no errors
  this.errors = [];
  
  // Initialize XML tree once
  this._tree = new XML.ObjTree();
  this._tree.attr_prefix = "@";
}

// Model declaration helper
Base.model = function(name, prefix, singular, plural) {eval(name + " = new Base(name, prefix, singular, plural);")}

// helper URLs
Base.prototype.singular_url = function() {return (this.id ? this._prefix + "/" + this._plural + "/" + this.id + ".xml" : "");}
Base.prototype.plural_url = function() {return this._prefix + "/" + this._plural + ".xml";}

// And a record shall be judged new or old by its ID
Base.prototype.new_record = function() {return !(this.id);}
// Valid helper
Base.prototype.valid = function() {return ! this.errors.any();}

// Find by ID
Base.prototype.find = function(id) {  
  var doc = this._tree.parseHTTP(this._prefix + "/" + this._plural + "/" + id + ".xml", {});
  return this.build(this.attributesFromTree(doc[this._singular]));
};


// Converts the XML tree returned from an errors object into an array of error messages
Base.prototype.errorsFromTree = function(elements) {

  var errors = [];
  if (typeof(elements.error) == "string")
    elements.error = [elements.error];
  
  elements.error.each(function(value, index) {
    errors.push(value);
  });
  
  return errors;
}

// Sets errors with an array.  Could be extended at some point to include breaking error messages into pairs (attribute, msg).
Base.prototype.setErrors = function(errors) {
  this.errors = errors;
}

// New (no Save)
Base.prototype.build = function(attributes, name, prefix, singular, plural) {
  var base;
  if (name)
    base = new Base(name, prefix, singular, plural)
  else
    base = new Base(this._name, this._prefix, this._singular, this._plural);
    
  base.setAttributes(attributes);
  return base;
};

// Create (New + Save)
Base.prototype.create = function(attributes) {
  var base = this.build(attributes);
  var saved = base.save();
  
  return base;
};

// Converts the XML tree returned from a single object into a hash of attribute values
Base.prototype.attributesFromTree = function(elements) {
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
      // else if (elements[attr].@type == "datetime")
      // how do I parse "2007-03-24T14:01:37-04:00" in JavaScript?
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
          value.push(this.build(this.attributesFromTree(single), name, this._prefix, singular, plural));
        }.bind(this));
      }
      // has_one or belongs_to
      else {
        singular = attr;
        var name = singular.capitalize();
        value = this.build(this.attributesFromTree(value), name, this._prefix, singular);
      }
    }
    
    // transform attribute name if needed
    attribute = attr.replace(/-/, "_");
    attributes[attribute] = value;
  }
  
  return attributes;
};

// sets all the attribute accessors
Base.prototype.setAttributes = function(attributes) {
  this.attributes = [];
  for (var attr in attributes)
    this.setAttribute(attr, attributes[attr]);
};

// set a property accessor for an attribute
// I don't see any issue with calling this publicly, either
Base.prototype.setAttribute = function(attribute, value) {
  this[attribute] = value;
  if (!(typeof(value) == "object") && !(this.attributes.include(attribute)))
    this.attributes.push(attribute);
};

// Destroy
Base.prototype.destroy = function(given_id) {
  var id = given_id || this.id;
  var req = new Ajax.Request(this.singular_url(), {
    method: "delete",
    asynchronous: false
  });
 if (req.transport.status == 200) {
    this.id = null;
    return this;
  }
  else 
    return false; 
};

// Save (Create and Update)
Base.prototype.save = function() {

  // reset errors
  this.setErrors([]);

  var url = null;
  var method = null;
  
  // distinguish between create and update
  if (this.new_record()) {
    url = this.plural_url();
    method = "post";
  }
  else {
    url = this.singular_url();
    method = "put";
  }
  
  // collect params
  var params = {};
  (this.attributes).each(function(value, i) {
    params[this._singular + "[" + value + "]"] = this[value];
  }.bind(this));
  
  // send the request
  var req = new Ajax.Request(url, {
    parameters: params,
    method: method,
    asynchronous: false
  });
  
  var status = req.transport.status;
  var saved = false;
  
  // create response
  if (this.new_record()) {
    if (status == 201) {
      loc = req.getHeader("location");
      if (loc) {
        id = loc.match(/\/([^\/]*?)(\.\w+)?$/)[1];
        if (id) {
          this.id = parseInt(id);
          saved = true;
        }
      }
    }
    // check for errors
    else if (status == 200) {
      if (req.transport.responseText) {
        var doc = this._tree.parseXML(req.transport.responseText);
        if (doc.errors)
          this.setErrors(this.errorsFromTree(doc.errors));
      }
    }
  }
  // update response
  else {
    if (status == 200) {
      saved = true;
      // check for errors
      if (req.transport.responseText) {
        var doc = this._tree.parseXML(req.transport.responseText);
        if (doc.errors) {
          this.setErrors(this.errorsFromTree(doc.errors));
          saved = false;
        }
      }
    }
  }
  
  // return whether the save succeeded
  return saved;
};
