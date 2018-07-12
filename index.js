var express = require('express');
var basicAuth = require('basic-auth-connect');
var RateLimit = require('express-rate-limit');
var bodyParser = require('body-parser');

var path = require('path');
var app = express();

var redis = require('redis');

var DBPORT = process.env.DBPORT;
var DBHOST = process.env.DBHOST;
var ADMIN = process.env.ADMIN;
var PASSWORD = process.env.PASSWORD;

var db = redis.createClient(DBPORT, DBHOST); //creates a new client

const MB = 1024 * 1024;

app.enable('trust proxy'); // only if you're behind a reverse proxy (Heroku, Bluemix, AWS if you use an ELB, custom Nginx setup, etc) 

var limiter = new RateLimit({
  windowMs: 1000, // 15 minutes 
  max: 2, // limit each IP to 100 requests per windowMs 
  delayMs: 0 // disable delaying - full speed until the max limit is reached 
});

//  apply to all requests 
app.use('/save/', limiter);
app.use(bodyParser());

//app.use(basicAuth(function(username, password, cb) {
//	if (username == ADMIN && password == PASSWORD) {
//		cb(null, true);
//	} else {
//		cb("wrong username password");
//	}
//}));


var http = require('http').createServer(app);
var io = require('socket.io')(http);

db.on('connect', function() {
	app.post('/keys', function(req, res) {
		db.keys('*', function (err, keys) {
			if (err) {
				res.status(500).end(err);
				console.log(err);
				return;
			}
			res.send(keys);
		});
	});

	app.post('/callback', function(req, res) {
		console.log(req.body, req.params);
		res.status(200).end();
	});

app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === '123') {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }  
});

	
	app.post('/read/:path*?', function(req, res) {
		db.get(req.params.path || "", function(err, reply) {
			if (err) {
				console.log(err);
				res.status(500).send(err);
				return;
			}
			reply = reply || "";
			res.send(reply);
		});
	});

	app.post('/save/:path*?', function(req, res) {
		var path = req.params.path || "";
		var content = req.body.content;
		if (content.length > 1 * MB) {
			res.status(500).send("content too large, must less than 1MB");
			return;
		}
		
		db.set(path, content, function(err, reply) {
			if (err) {
				console.log(err);
				res.status(500).send(err);
				return;
			}
			res.status(200).send();
		});
	});

// viewed at http://localhost:8080
app.get('/*?', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});


	http.listen(3000, '0.0.0.0', function() {
		console.log('listening on *:3000');
	});
});
