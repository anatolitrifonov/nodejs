const express = require('express');
const proxy = require('http-proxy-middleware')
const { JWT } = require('google-auth-library');
const path = require('path');

///////////////////////////////////////////////////////
//
// Read config files.
//
///////////////////////////////////////////////////////

// This file contains keys for service account.
// Source control has an invalid file. You need to have the correct one in order to connect to cloud or to deploy.
// Connection to local host shold still work OK though.
const keysServiceAccount = require('./keys.service.account.with.iap.access.json');
// This file contains keys for backend. This is what we are trying to acess and forward requests to.
// Source control has an invalid file. You need to have the correct one in order to connect to cloud or to deploy.
// Connection to local host shold still work OK though.
const keysBackEndClient = require('./keys.backend.client.json');
// This file contains a link to backend URL. Local or remote.
const targetApiURL = require('./target.local.json');
// Read the destination client id. This is the back end's client id.
const clientId = keysBackEndClient.web.client_id;
// Create the client that can make a call to back end and authorize
const client = new JWT({
  email: keysServiceAccount.client_email,
  key: keysServiceAccount.private_key,
  additionalClaims: { target_audience: clientId }
});
// Port to use depending on environment
// PORT is set by google cloud
let port = process.env.NVV_ADMIN_NODE_PORT || process.env.PORT || 8080;

console.log('target URL is -> ' + targetApiURL.api_target_url);
console.log('notification URL is -> ' + targetApiURL.api_notification_url);
console.log('enviromnet is -> ' + targetApiURL.environment);

///////////////////////////////////////////////////////
//
// Start things up.
//
///////////////////////////////////////////////////////

// Create express object. This is our web server.
const expressApplication = express();

// Set middleware to serve static content. Tell web server to serve static content.
expressApplication.use(express.static('dist/nvv-admin'));

// ??????
expressApplication.set('trust proxy', true);

///////////////////////////////////////////////////////
//
// Local storage. This is our token to google.
//
///////////////////////////////////////////////////////
let id_token = targetApiURL.environment == 'develop' ? 'hello' : null;

// Create prox options
const proxyOptions = {
  target: targetApiURL.api_target_url,
  changeOrigin: true,
  loglevel: 'debug',
  onProxyReq: function onProxyReq(proxyReq, req, res) {
    if (id_token) {
      console.log('Already have token ' + id_token.substring(0, 5));
      proxyReq.setHeader('Authorization', 'Bearer ' + id_token);
    } else {
      proxyReq.socket.pause();
      client.authorize()
      .then((authorizationResult) => {
        console.log('Autho');
        id_token = authorizationResult.id_token;
        console.log('Authorized ' + id_token);
        proxyReq.setHeader('Authorization', 'Bearer ' + id_token);
        proxyReq.socket.resume();
      }).catch((err) => {
        console.error('error');
        proxyReq.socket.resume();
        console.error(err);
        res.sendStatus(500);
      });
    }
  },
  onError: function onError(err, req, res) {
    console.log('Error!!!', err.reason);
    res.writeHead(500, {
       'Content-Type': 'text/plain'
    });
    res.end(
       'Something went wrong. And we are reporting a custom error message.'
    );
  },
  onProxyRes: function(proxyRes, req, res) {
    // if token expired we get a 401
    // we need to refresh it.
    // here we will simply fail and set the toen to null. It should reset on the next request.
    
    if (proxyRes.statusCode == 401) {
      console.log('got 401 setting token to null');
      id_token = null;
    };
    // console.log(proxyRes.headers);
    // console.log(proxyRes.rawHeaders);
    // console.log(proxyRes.statusCode);
    // add new header to response
    // proxyRes.headers['x-added'] = 'foobar';
  
    // remove header from response
    // delete proxyRes.headers['x-removed'];
  }
};

const proxyOptions2 = {
  target: targetApiURL.api_notification_url,
  changeOrigin: true,
  loglevel: 'debug',
  pathRewrite: {
    '^/notification/api': '/api' // rewrite path
  },
  onProxyReq: function onProxyReq(proxyReq, req, res) {
    // console.log('req');
    // console.log(req);
    if (id_token) {
      console.log('Already have token ' + id_token.substring(0, 5));
      proxyReq.setHeader('Authorization', 'Bearer ' + id_token);
    } else {
      proxyReq.socket.pause();
      client.authorize()
      .then((authorizationResult) => {
        console.log('Autho');
        id_token = authorizationResult.id_token;
        console.log('Authorized ' + id_token);
        proxyReq.setHeader('Authorization', 'Bearer ' + id_token);
        proxyReq.socket.resume();
      }).catch((err) => {
        console.error('error');
        proxyReq.socket.resume();
        console.error(err);
        res.sendStatus(500);
      });
    }
  },
  onError: function onError(err, req, res) {
    console.log('Error!!!', err.reason);
    res.writeHead(500, {
       'Content-Type': 'text/plain'
    });
    res.end(
       'Something went wrong. And we are reporting a custom error message.'
    );
  },
  onProxyRes: function(proxyRes, req, res) {
    // if token expired we get a 401
    // we need to refresh it.
    // here we will simply fail and set the toen to null. It should reset on the next request.
    
    if (proxyRes.statusCode == 401) {
      console.log('got 401 setting token to null');
      id_token = null;
    };
    // console.log(proxyRes.headers);
    // console.log(proxyRes.rawHeaders);
    // console.log(proxyRes.statusCode);
    // add new header to response
    // proxyRes.headers['x-added'] = 'foobar';
  
    // remove header from response
    // delete proxyRes.headers['x-removed'];
  }
};

// Create a proxy that proxies to backend.
// Still need to add extra headers and logging.
const apiProxy = proxy('/api', proxyOptions );
const apiProxy2 = proxy('/notification/api', proxyOptions2 );

// Let server know to use proxy
expressApplication.use(apiProxy);
expressApplication.use(apiProxy2);

// Redirect / to our html file
expressApplication.get('*', (req, res) => res.sendFile(path.resolve('dist/nvv-admin/index.html')));

// Start the server
console.log('running on port ' + port);
const server = expressApplication.listen(port);
console.log('listening started 2');

