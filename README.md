Jester
======

Jester is our implementation of REST, in JavaScript. It provides (nearly) identical syntax to ActiveResource for using REST to find, update, and create data, but from the client side.

It depends on [Prototype](http://prototypejs.org).

DEPRECATED
----------

We no longer use or support this. If you wish to take this project over please
email <support@thoughtbot.com>.

Syntax
------

All examples below are taken from inside the JavaScript console of Firebug.

First, declare a model in Jester by calling model on Base:

    >>> Base.model("User")
    >>> User
    Object _name=User _singular=user _plural=users

This creates a global variable called User. It assumes that the URL prefix it uses to base its HTTP requests from is the current domain and port, and assumes "user" and "users" as single and plural forms to make these URLs. There's no "people/person" intelligence here, so make sure to override these defaults if you need to, like so:

    >>> Base.model("Child", "http://www.thoughtbot.com", "child", "children")
    >>> Child
    Object _name=Child _singular=child _plural=children

If you want to capture the model created in a local variable, or simply prefer more traditional JavaScript syntax, you can do:

    >>> var Child = new Base("Child", "http://www.thoughtbot.com", "child", "children")
    >>> Child
    Object _name=Child _singular=child _plural=children

Find will retrieve a particular instance of your model. Attributes are auto-converted to integer or boolean types if that's what they are on the server side. The "GET" line is not a return value, just Firebug's report of activity, but relevant to understanding what's happening.

    >>> eric = User.find(1)
    GET http://localhost:3000/users/1.xml
    Object _name=User _singular=user _plural=users

    >>> eric.attributes
    ["active", "email", "id", "name"]

    >>> eric.id
    1
    >>> eric.name
    "Eric Mill"
    >>> eric.active
    true

Create takes a hash of attribute values. After calling create, the model will fetch its new ID from the return headers.

    >>> floyd = User.create({name: "Floyd Wright", email: "tfwright@thoughtbot.com"})
    POST http://localhost:3000/users.xml
    Object _name=User _singular=user _plural=users

    >>> floyd.id
    9

    >>> User.find(9).name
    GET http://localhost:3000/users/9.xml
    "Floyd Wright"

Updating is as simple as changing one of the properties and calling save.

    >>> eric = User.find(1)
    GET http://localhost:3000/users/1.xml
    Object _name=User _singular=user _plural=users

    >>> eric.email
    "emill@thoughtbot.com"
    >>> eric.email = "sandybeach@wintermute.com"
    "sandybeach@wintermute.com"

    >>> eric.save()
    POST http://localhost:3000/users/1.xml
    true

    >>> User.find(eric.id).email
    GET http://localhost:3000/users/1.xml
    "sandybeach@wintermute.com"

Sadly, there's one area where Jester's syntax can't match ActiveResource's perfectly. The method "new" has been renamed to build, due to "new" being an illegal method name in JavaScript up to 1.6. Hopefully this can be updated as the browser landscape evolves. Build was chosen because it is similarly used in ActiveRecord to replace "new" on an association array, where "new" cannot be used.

    >>> chad = User.build({email: "cpytel@thoughtbot.com", name: "Chad Pytel"})
    Object _name=User _singular=user _plural=users

    >>> chad.new_record()
    true
    >>> chad.save()
    POST http://localhost:3000/users.xml
    true

    >>> chad.id
    9
    >>> chad.new_record()
    false

Error validations are supported. If a model fails to save, save returns false, and the model's errors property is set with an array of the error messages returned.

    >>> jared = User.build({name: "", email: ""})
    Object _name=User _singular=user _plural=users

    >>> jared.save()
    POST http://localhost:3000/users.xml
    false

    >>> jared.errors
    ["Name can't be blank", "Email can't be blank"]
    >>> jared.valid()
    false

    >>> jared.name = "Jared Carroll"
    "Jared Carroll"
    >>> jared.email = "emill@thoughtbot.com"
    "emill@thoughtbot.com"

    >>> jared.save()
    POST http://localhost:3000/users.xml
    false

    >>> jared.errors
    ["Email has already been taken"]
    >>> jared.email = "jcarroll@thoughtbot.com"
    "jcarroll@thoughtbot.com"

    >>> jared.save()
    POST http://localhost:3000/users.xml
    true

Lastly, associations are also supported. If the association data is included in the XML, they'll be loaded into the returned model as Jester models of their own, using the same assumptions on naming and URL prefix described above. They're full models, so you can edit and save them as you would the parent. Has_many relationships come back as simple arrays, has_one relationships as a property. In this example, User has_many :posts, and Post belongs_to :user.

    >>> eric = User.find(1)
    GET http://localhost:3000/users/1.xml
    Object _name=User _singular=user _plural=users

    >>> eric.posts
    [Object _name=Post _singular=post _plural=posts, Object _name=Post _singular=post _plural=posts]

    >>> eric.posts.first().body
    "Today I passed the bar exam. Tomorrow, I make Nancy my wife."
    >>> eric.posts.first().body = "Today I *almost* passed the bar exam. The ring waits one more day."
    "Today I *almost* passed the bar exam. The ring waits one more day."

    >>> eric.posts.first().save()
    POST http://localhost:3000/posts/1.xml
    true

    >>> post = Post.find(1)
    GET http://localhost:3000/posts/1.xml
    Object _name=Post _singular=post _plural=posts

    >>> post.body
    "Today I *almost* passed the bar exam. The ring waits one more day."
    >>> post.user
    Object _name=User _singular=user _plural=users
    >>> post.user.name
    "Eric Mill"

Using Jester
------------

Jester depends on Prototype, which comes with Rails versions 3.0.x and lower. It includes portions of [ObjTree](http://www.kawa.net/works/js/xml/objtree-e.html), a nice DOM parsing engine for JavaScript.

    <script type="text/javascript" src="/javascripts/prototype.js"></script>
    <script type="text/javascript" src="/javascripts/jester.js"></script>

JavaScript in the browser is limited to requests with in only the same domain as the script is running in, so without iframe hackery, Jester is probably only useful for writing client code in your own apps, to talk to itself. We're investigating whether Jester can use this hackery to make cross-domain requests, but it's not clear if this will be feasible.

There are also some basic unit tests included inside Jester's repository, which run using JsUnit. To run them yourself, from Jester's repository open the file test/jsunit/testRunner.html in your browser, and choose test/jester_test.html as the test file.

The Server Side
---------------

These examples are talking with a Rails application whose controllers were generated with "./script generate scaffold_resource"—in other words, the ideal RESTful controllers. It's very easy to make your controller RESTful. Here's the source for the User controller I'm using. The lines that deal with returning HTML have been removed, and I have added "(:include => :posts)" as an argument to to_xml in two places, so associations are included (it's that easy!).

An example of the XML produced here, of a User with one Post, at /users/2.xml:

    <user>
      <active type="boolean">true</active>
      <email>cpytel@thoughtbot.com</email>
      <id type="integer">2</id>
      <name>Chad Pytel</name>
      <posts>
        <post>
          <title>Life as a Jester</title>
          <body>It's not as hard as Master said it would be.  Today I made 200 dollars.</body>
          <created-at type="datetime">2007-04-01T04:01:56-04:00</created-at>
          <id type="integer">2</id>
          <user-id type="integer">2</user-id>
        </post>
      </posts>
    </user>

JSONic REST
-----------

Using JSON in Jester is easy. Set the "format" option when defining your model, and JSON will be the format used for all requests dealing with that model. Requests are made using ".json" as a URL suffix. Like so:

    >>> Base.model("User", {format: "json"})
    >>> eric = User.find(1)
    GET http://localhost:3000/users/1.json

The controller code for this is simple. I prefer using wants.json, not wants.js, leaving the ".js" extension available for RJS or whatever you want. This works out of the box, with no need to add a mime types. Here's what I did:

    def show
      @user = User.find(params[:id])
      respond_to do |wants|
        wants.xml {render :xml => @user.to_xml(:include => :posts)}
        wants.json {render :text => @user.to_json}
      end
    end

Going to /users/1.json produces the following JSON:

    {
      attributes:
      {
        id: "1",
        bio: "",
        extra_flag: "0",
        middle_name: "Rogers",
        active: "1",
        created_at: "2007-04-25 19:15:10",
        email: "yes"
      }
    }

Note that there isn't any automatic typecasting going on here. The default XML output from an ActiveRecord::Base object includes attributes describing types, but the JSON output doesn't. So, boolean flags will come back as the strings "1" and "0". At the Jester level, I've made two auto-casting assumptions: the ID will be turned into an integer, and any fields named created_at/created_on/updated_at/updated_on will be turned into a Date.

    >>> eric = User.find(1)
    GET http://localhost:3000/users/1.json
    >>> eric.id
    1
    >>> eric.middle_name
    "Rogers"
    >>> eric.active
    "1"
    >>> eric.created_at
    Wed Apr 25 2007 15:15:10 GMT-0400 (Eastern Daylight Time)

As a companion feature, Jester supports passing JSON code through the X-JSON header, passing through the second "json" parameter to any callback you provide to an asynchronous Jester request. I'll just show you.

    >>> var type;
    >>> User.find(1, {}, function(eric, json) {type = json.active.type})
    GET http://localhost:3000/users/1.json
    XMLHttpRequest
    >>> type
    "boolean"

And on the controller side, inside the show action, I have this line:

    headers["X-JSON"] = "{active: {type: 'boolean'}}"

This allows you to pass extra JSON information along with any data returned from the server. You don't have to have the model's format set to "json" for this to operate, either—you can pass JSON information alongside an XML response in the same way.

Credits
-------

Thanks go to Eric Mill for writing Jester, Chad Pytel for the original idea, Jared Pytel for writing Jester's tests, and Floyd Wright for adding the updateAttributes and setAttributes methods.

Thanks to all [the additional contributors](https://github.com/thoughtbot/jester/contributors).

License
-------

Jester is Copyright © 2007-2011 thoughtbot. It is free software, and may be redistributed under the terms specified in the MIT-LICENSE file.
