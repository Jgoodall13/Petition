const express = require('express');
const app = express();
var hb = require('express-handlebars');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
app.use(cookieParser());
app.use(bodyParser.urlencoded({
    extended: false
}));
var spicedPg = require('spiced-pg');
var db = spicedPg(process.env.DATABASE_URL || 'postgres:postgres:password@localhost:5432/signatures');
var cookieSession = require('cookie-session');
var bcrypt = require('bcryptjs');
var csrf = require('csurf');


app.use(cookieSession({
    secret: 'a really hard to guess secret',
    maxAge: 1000 * 60 * 60 * 24 * 14
}));
app.use(csrf({
    cookie: true
}));
app.use('/public', express.static(__dirname + '/public/'));

app.engine('handlebars', hb());
app.set('view engine', 'handlebars');

app.get('/canvas.js', function(req, res) {
    res.sendFile(__dirname + '/canvas.js')
});


app.get('/', function(req, res) {
    if (req.session.id) {
        res.redirect('/home');
    } else {
        res.redirect('/register');
    }
});

app.get('/register', function(req, res) {
    if (req.session.id || req.session.user) {
        res.redirect('/profile');
    } else {
        res.render('register', {
            layout: 'main-layout-template',
            csrfToken: req.csrfToken()
        });
    }
});

app.get('/login', function(req, res) {
    if (req.session.id || req.session.user) {
        res.redirect('/home');
    } else {
        res.render('login', {
            layout: 'main-layout-template',
            csrfToken: req.csrfToken()
        });
    }
});

app.get('/profile', function(req, res) {
    if (req.session.id) {
        res.redirect('/home');
    } else {
        res.render('profile', {
            layout: 'main-layout-template',
            csrfToken: req.csrfToken()
        });
    }
});


app.post('/register', function(req, res) {
    hashPassword(req.body.password_reg).then(function(hash) {
        db.query("INSERT INTO users (first_name, last_name, email, password) VALUES ($1,$2,$3,$4) RETURNING id", [req.body.first_name_reg, req.body.last_name_reg, req.body.email_reg, hash]).then(function(results) {
            req.session.user = {
                firstname: req.body.first_name_reg,
                lastname: req.body.last_name_reg,
                email: req.body.email_reg,
                password: hash,
                id: results.rows[0].id,
            };
            res.redirect('/profile');
        }).catch(function(err) {
            console.log(err);
            res.render('register', {
                layout: 'main-layout-template',
                error: "This email already exists. You already a member?"
            });
        });
    });
});


app.post('/profile', function(req, res) {
    if (!req.body.age.length) {
        req.body.age = null;
    }
    db.query('INSERT INTO user_profiles (user_id, age, city, homepage) VALUES ($1,$2,$3,$4)', [req.session.user.id, req.body.age, req.body.city, req.body.homepage]).then(function(results) {
        req.session.user.age = req.body.age;
        req.session.user.city = req.body.city;
        req.session.user.homepage = req.body.homepage;
        res.redirect('/home');
    }).catch(function(err) {
        console.log(err);
    });

});


app.post('/login', function(req, res) {
    console.log(req.body.email_log);
    console.log(req.body.password_log);
    db.query("SELECT id, first_name, last_name, email, password FROM users WHERE email=$1", [req.body.email_log])
        .then(function(results) {
            bcrypt.compare(req.body.password_log, results.rows[0].password, function(err, doesMatch) {
                if (!doesMatch) {
                    console.log('not right password');
                    res.render('login', {
                        layout: 'main-layout-template',
                        wrong: 'Inncorrect password, please try again or register.'
                    });
                } else {
                    console.log(doesMatch);
                    console.log(results.rows);
                    req.session.user = {
                        firstname: results.rows[0].first_name,
                        lastname: results.rows[0].last_name,
                        email: results.rows[0].email,
                        id: results.rows[0].id,
                    };
                    res.redirect('/home');
                }
            });
        }).catch(function(err) {
            res.render('login', {
                layout: 'main-layout-template',
                wrong: 'Inncorrect password, please try again or register.'
            });
        });
});


app.get('/home', function(req, res) {
    if (!req.session.user) {
        res.redirect('/');
    } else {
        res.render('home', {
            layout: 'main-layout-template',
            fname: req.session.user.firstname,
            lname: req.session.user.lastname,
            csrfToken: req.csrfToken()
        });
    }
});

app.post('/home', function(req, res) {
    db.query("INSERT INTO signatures (user_id, first_name, last_name, signature) VALUES ($1,$2,$3,$4) RETURNING id", [req.session.user.id, req.body.first_name, req.body.last_name, req.body.signature]).then(function(results) {
        console.log(results.rows);
        req.session.id = results.rows[0].id;
        console.log(req.session.id);
        res.redirect('/signed');
    }).catch(function(err) {
        console.log(err);
    });
});


app.get('/signed', function(req, res) {
    if (!req.session.id) {
        res.redirect('/home');
    }
    db.query('SELECT signature FROM signatures WHERE id = ' + req.session.id).then(function(results) {
        console.log(req.session.user);
        res.render('signed', {
            layout: 'main-layout-template',
            hancock: results.rows[0].signature,
            others: req.session.user.id,
            csrfToken: req.csrfToken()
        });
    });
});

app.get('/signers', (req, res) => {
    db.query("SELECT users.first_name, users.last_name, user_profiles.age, user_profiles.city, user_profiles.homepage FROM users LEFT JOIN user_profiles ON user_profiles.user_id = users.id").then((results) => {
        console.log(results.rows);
        res.render('signers', {
            layout: 'main-layout-template',
            list: results.rows,
            csrfToken: req.csrfToken()
        });
    }).catch((err) => {
        console.log(err);
    });
});


app.get('/edit', function(req, res) {
    db.query("SELECT signatures.first_name, signatures.last_name, user_profiles.age, user_profiles.city, user_profiles.homepage FROM signatures LEFT JOIN user_profiles ON user_profiles.user_id = signatures.user_id").then((results) => {
        var i = results.rows.length - 1;
        res.render('edit', {
            layout: 'main-layout-template',
            fname: req.session.user.firstname,
            lname: req.session.user.lastname,
            email: req.session.user.email,
            age: results.rows[i].age,
            city: results.rows[i].city,
            homepage: results.rows[i].homepage,
            csrfToken: req.csrfToken()
        });
    }).catch((err) => {
        console.log(err);
    });
});

app.post('/edit', function(req, res) {
    console.log(req.session.user.id);
    if (!req.body.age_edit.length) {
        req.body.age_edit = null;
    }
    if (!req.body.password_edit.length) {
        req.body.password_edit = req.session.user.password;
    }
    console.log(req.session.user.password);
    db.query('UPDATE users SET first_name=$1, last_name=$2, email=$3, password=$4 WHERE id=$5', [req.body.first_name_edit, req.body.last_name_edit, req.body.email_edit, req.body.password_edit, req.session.user.id]).then(function() {
        db.query('UPDATE user_profiles SET age=$1, city=$2, homepage=$3 WHERE user_id=$4', [req.body.age_edit, req.body.city_edit, req.body.homepage_edit, req.session.user.id]).then(function() {
            res.redirect('/signed');

        });
    }).catch(function(err) {
        console.log(err);
    });
});

//
app.get('/delete', function(req, res) {
    console.log(req.session.user.firstname);
    console.log(req.session.user.lastname);
    db.query('UPDATE signatures SET first_name=$1, last_name=$2, signature=$3 WHERE user_id=$4', [req.session.user.firstname, req.session.user.lastname, req.session.user, null]).then(function() {
        res.redirect('/home');
    });
});


app.get('/logout', function(req, res) {
    req.session = null;
    res.redirect('/login');
});


function hashPassword(plainTextPassword) {
    return new Promise(function(resolve, reject) {
        bcrypt.genSalt(function(err, salt) {
            if (err) {
                return reject(err);
            }
            bcrypt.hash(plainTextPassword, salt, function(err, hash) {
                if (err) {
                    return reject(err);
                }
                resolve(hash);
            });
        });
    });
}


app.listen(process.env.PORT || 8080, () => console.log("I'm listening old friend"));
