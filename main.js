#!/usr/bin/env node

'use strict';

require('supererror')({ splatchError: true });
require('colors');

var assert = require('assert'),
    express = require('express'),
    uuid = require('node-uuid'),
    lastMile = require('connect-lastmile'),
    json = require('body-parser').json,
    morgan = require('morgan'),
    timeout = require('connect-timeout'),
    http = require('http'),
    HttpError = require('connect-lastmile').HttpError,
    HttpSuccess = require('connect-lastmile').HttpSuccess;

var gHttpServer = null;

var PORT = 8080;
var CLIENT_ID = 'cid-test-client';

var gUsers = [{
    id: 'uid-test1',
    username: 'apple',
    password: 'Apple?1',
    email: 'apple@cloudron.io',
    displayName: 'Apple Pie',
    isAdmin: true
}, {
    id: 'uid-test2',
    username: 'banana',
    password: 'Banana?1',
    email: 'banana@cloudron.io',
    displayName: 'Banana Boat',
    isAdmin: false
}];

var gAccessTokens = {};

function login(req, res, next) {
    assert.strictEqual(typeof req.body, 'object');

    console.log('login:');
    console.log('  Client:   %s', req.body.clientId);
    console.log('  Username: %s', req.body.username);
    console.log('  Password: %s', req.body.password);

    if (typeof req.body.clientId !== 'string') return next(new HttpError(400, 'clientId is required'));
    if (typeof req.body.username !== 'string') return next(new HttpError(400, 'username is required'));
    if (typeof req.body.password !== 'string') return next(new HttpError(400, 'password is required'));

    if (req.body.clientId !== CLIENT_ID) return next(new HttpError(401, 'Unknown client'));

    var user = gUsers.filter(function (u) {
        if (u.username === req.body.username) return true;
        if (u.email === req.body.username) return true;
        return false;
    })[0];

    if (!user) return next(new HttpError(401, 'Forbidden'));
    if (user.password !== req.body.password) return next(new HttpError(401, 'Forbidden'));

    var accessToken = uuid.v4();
    gAccessTokens[accessToken] = user;

    var tmp = {
        accessToken: accessToken,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            admin: user.isAdmin
        }
    };

    next(new HttpSuccess(200, tmp));
}

function logout(req, res, next) {
    assert.strictEqual(typeof req.query, 'object');

    console.log('logout:');
    console.log('  AccessToken:   %s', req.query.access_token);

    if (typeof req.query.access_token !== 'string') return next(new HttpError(400, 'access_token in query required'));
    if (!gAccessTokens[req.query.access_token])  return next(new HttpError(401, 'Forbidden'));

    delete gAccessTokens[req.query.access_token];

    next(new HttpSuccess(200, {}));
}

function initializeExpressSync() {
    var app = express();
    var httpServer = http.createServer(app);

    httpServer.on('error', console.error);

    var json = json({ strict: true, limit: '100kb' });
    var router = new express.Router();

    // basic auth
    router.post('/api/v1/login', login);
    router.get ('/api/v1/logout', logout);

    app
        .use(morgan('SimpleAuth :method :url :status :response-time ms - :res[content-length]', { immediate: false }))
        .use(timeout(10000))
        .use(json)
        .use(router)
        .use(lastMile());

    return httpServer;
}

gHttpServer = initializeExpressSync();
gHttpServer.listen(PORT, '0.0.0.0', function () {
    console.log('Cloudron SimpleAuth Development Server listening on port %s', String(PORT).cyan);
    console.log();
    console.log('ClientId:   %s', CLIENT_ID.yellow);
    console.log();
    console.log('Users:'.bold);

    gUsers.forEach(function (u) {
        console.log('  UserId:     %s', u.id.yellow);
        console.log('  Username:   %s', u.username.yellow);
        console.log('  Password:   %s', u.password.yellow);
        console.log('  Name:       %s', u.displayName.yellow);
        console.log('  Email:      %s', u.email.yellow);
        console.log();
    });
});
