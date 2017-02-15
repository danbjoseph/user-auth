var settings = require('./settings.js');
var fs = require('fs');
var flow = require('flow');
var path = require('path');
var crypto = require('crypto');
var sqlite3 = require('sqlite3');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcrypt');
const saltRounds = 10;

// initialize database
var file = path.join(settings.app.db);
fs.existsSync(file);
var db = new sqlite3.Database(file);

// initialize db table for admin users
db.run("CREATE TABLE IF NOT EXISTS users ( id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, password TEXT, permissions TEXT )", function(err) {
    if(err) { console.log(err); }
    db.get("SELECT user from users", function(err, row) {
      if(err) { console.log(err); }
      if(!row) {
        bcrypt.hash(settings.app.defaultpass, saltRounds, function(err, hash) {
          db.run("INSERT INTO users ( user, password, permissions ) VALUES( ?, ?, 'admin' )", settings.app.defaultuser, hash, function(err) {
            if(err) { console.log(err); }
          });
        });
      }
    });
});

// db functions
var createUser = function(req, res) {
  var user = req.body.user;
  var permissions = req.body.permissions;
  db.get('SELECT user FROM users WHERE user = ?', user, function(err, row) {
    // if(err)
    if(row) {
      req.flash('errorMessage', " there is already a user with that name");
      res.redirect('/admin/users');
    } else {
      bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        db.run('INSERT INTO users ( user, password, permissions ) VALUES( ?, ?, ? )', user, hash, permissions, function(err) {
          // if(err)
          if(this.lastID) {
            req.flash('successMessage', " user created");
            res.redirect('/admin/users');
          } else {
            req.flash('errorMessage', " something went wrong");
            res.redirect('/admin/users');
          }
        });
      });
    }
  });
}

var deleteUser = function(req, res) {
  if(req.user.id == req.body.id) {
    req.flash('errorMessage', " you can't delete yourself");
    res.redirect('/admin/users');
  } else {
    db.run('DELETE FROM users WHERE id = ?', req.body.id, function(err) {
      if(err) {
        //...
      } else {
        req.flash('successMessage', " user deleted");
        res.redirect('/admin/users');
      }
    });
  }
}

// # hashing the password takes a second
// # need to let it complete before moving on
// # when updating a user
var updatePassword = function(req, res, cb) {
  if(req.body.password.length == 0) {
    req.flash('successMessage', " password not changed");
    cb(req, res);
  } else {
    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
      if(err) console.log(err)
      req.flash('successMessage', " password updated");
      req.query += "password = '" + hash + "', " ;
      req.runquery = true;
      cb(req, res);
    });
  }
}

var updatePermissions = function(req, res, cb) {
  if(req.user.id == req.body.id && req.body.permissions != "admin") {
    req.flash('errorMessage', " you can't remove your own admin status");
    cb(req, res);
  } else {
    req.query += "permissions = '" + req.body.permissions + "'";
    req.runquery = true;
    cb(req, res);
  }
}

var editUser = flow.define(
  function(req, res) {
    req.runquery = false;
    req.query = "UPDATE users SET ";
    updatePassword(req, res, this);
  }
  ,function(req, res) {
    updatePermissions(req, res, this);
  }
  ,function(req, res) {
    if(req.runquery == true) {
      req.query += " WHERE id = " + req.body.id;
      db.run(req.query, function(err) {
        if(err) {
          //...
          console.log(err);
          req.flash('errorMessage', " something went wrong");
          res.redirect('/admin/users');
        } else {
          req.flash('successMessage', " user updated");
          res.redirect('/admin/users');
        }
      });
    } else {
      req.flash('errorMessage', " something went wrong");
      res.redirect('/admin/users');
    }
  }
);

var listUsers = function(cb) {
  db.all('SELECT id, user, permissions FROM users', function(err, rows) {
    // if(err)
    cb(rows);
  });
}

// setting up user authentication
passport.use(new LocalStrategy({ usernameField: 'user' }, function(user, password, done) {
  db.get('SELECT password FROM users WHERE user = ?', user, function(err, row) {
    if (!row) return done(null, false);
    bcrypt.compare(password, row.password, function(err, res) {
      if(!res) return done(null, false);
      db.get('SELECT user, id FROM users WHERE user = ?', user, function(err, row) {
        return done(null, row);
      });
    });
  });
}));

passport.serializeUser(function(user, done) {
  return done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  db.get('SELECT id, user, permissions FROM users WHERE id = ?', id, function(err, row) {
    if (!row) { return done(null, false); }
    return done(null, row);
  });
});

// setting up the app
var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var SQLiteStore = require('connect-sqlite3')(session);
var flash = require('express-flash');
var exphbs  = require('express-handlebars');
var bodyParser = require('body-parser');

var app = express();
// bodyParser to let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cookieParser('secret'));
app.use(session({
  store: new SQLiteStore,
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

app.engine('handlebars', exphbs({
  defaultLayout: 'main',
  helpers: {
    eq: function(v1,v2,options) {
			if (v1 && v2 && v1.toString() === v2.toString()) {
				return options.fn(this);
			}
			return options.inverse(this);
		}
  }
}));
app.set('view engine', 'handlebars');

app.use(express.static('public'));

app.post('/login', passport.authenticate('local', {
    failureRedirect: '/'
  }), function(req, res) {
    res.redirect('/');
  }
);

app.post('/logout', function(req, res) {
	req.session.destroy(function(err) {
		res.redirect('/');
	})
});

app.get('/', function(req, res) {
		res.render('home',{
			user:req.user
		});
});

app.get('/admin/users', function(req, res) {
  if(req.user && req.user.permissions == "admin") {
    listUsers(function(result) {
      res.render('users',{
        user:req.user,
        users: result,
        error:req.flash("errorMessage"),
        success:req.flash("successMessage")
      });
    });
  } else {
    res.redirect('/');
  }
});

app.post('/admin/user', function(req, res) {
  if (req.user && req.user.permissions == "admin") {
    switch(req.body["_method"]) {
      case "DELETE":
        deleteUser(req, res);
      break;
      case "PUT":
        editUser(req, res);
      break;
      default:
        createUser(req, res);
      break;
    }
  } else { res.redirect('/admin/users'); }
});

app.listen(settings.app.port, function() {
  console.log('app listening on port ' + settings.app.port);
});
