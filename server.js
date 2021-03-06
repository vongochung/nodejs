// imports. please see package.json for required dependencies.
// install all dependencies with `npm install`.
var fs = require('fs');
var argv = require('optimist').argv;
var utils = require('./lib/utils');
var api = require('./lib/api');
var frontend = require('./lib/frontend');
var listener = require('./lib/listener');
var socketio = require('socket.io');
var request = require('request');
// initialize settings with some default values.
var settings = {
  storage : 'redis',
  redisHost : 'localhost',
  redisPort : 6379,
  redisPassword : null,
  apiHost : 'localhost',
  apiPort : 6600, 
  socketHost :'0.0.0.0',
  socketPort : 5500,
  sslKey : null,
  sslCert : null,
  isVolatile : false
}

if (argv.config) {
  // if a settings JSON file is found,
  // merge it with the options
  var content = fs.readFileSync(argv.config);
  var config = JSON.parse(content);
  settings = utils.mergeOptions(settings, config);
}

// get a storage instance
if (settings.storage == 'redis') {
  console.log('storage backend: Redis');
  var storageBackend = require('./lib/storage/redis');
} else if (settings.storage = 'mem' || settings.storage == 'memory') {
  console.log('storage backend: local memory');
  var storageBackend = require('./lib/storage/memory');
} else {
  console.log('storage backend must be either "redis" or "mem".');
  process.exit(1);
}

var storage = new storageBackend.Storage(settings);

// initialize the internal API server
var apiServer = api.createAPIServer(storage);
apiServer.listen(settings.apiPort, settings.apiHost);
console.log('Started API server on host: ' +
  settings.apiHost +', port: ' + settings.apiPort);

// check if SSL is required
if (settings.sslKey !== null && settings.sslCert !== null) {
  console.log('Running socket.IO in SSL mode');
  var sslOptions = {
    key : fs.readFileSync(settings.sslKey),
    cert : fs.readFileSync(settings.sslCert)
  };
  var frontEndServer = frontend.createRealtimeServer(
    storage, sslOptions
  );
} else {
  var frontEndServer = frontend.createRealtimeServer(
    storage
  );
}

// initialize the external socket.io server
frontEndServer.server.listen(settings.socketPort, settings.socketHost);
console.log('Started socket.io API on host: ' +
  settings.socketHost +', port: ' + settings.socketPort);

// start listening on events
listener.bindEventListener(
  storage,
  frontEndServer.io,
  frontEndServer.authenticatedClients,
  settings.isVolatile
);
console.log('Started pub/sub listener');

frontEndServer.io.on("connect",function(socket){
  console.log("connect"+socket.id);
});

frontEndServer.io.on("connection",function(socket){
  socket.on("chat",function(data){
    if (data.type == "typing"){
      // Gui khong bao gom nguoi gui
      //socket.broadcast.emit("chat",{msg:"chatting...", type :"typing" , emiiter : data.emiiter});
      // Gui bao gom nguoi gui
      frontEndServer.io.emit("chat",{msg:"chatting...", type :"typing" , emiiter : data.emiiter});
    } else {
      //socket.broadcast.emit("chat",{msg:"chatting...", type :"endtyping", emiiter : data.emiiter});
      frontEndServer.io.emit("chat",{msg:"chatting...", type :"endtyping" , emiiter : data.emiiter});
    }
    
  });
  socket.on("enterChat",function(data){
      console.log(socket.id + data.emiiter);
      frontEndServer.io.emit("enterChat",{msg:data.msg, type :"enter" , emiiter : data.emiiter});

      request.post("http://localhost:8000/test/",{form:{"user":data.emiiter,"csrfmiddlewaretoken":data.token}}, function(err, httpResponse, body){
          console.log(body);
      });
  });

  socket.on("disconnect",function(){
    console.log("haha disconnect");
  });
});



