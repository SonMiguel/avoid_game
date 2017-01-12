var express     = require('express'),
    app         = express()
  , io          = require('socket.io')
  , UUID        = require('node-uuid')
  , gameport    = process.env.PORT || 4004
  , verbose     = false;

var http = require('http'),
    server = http.Server(app);


/* Express server set up. */


server.listen(gameport, function(){
  console.log('listening on : ' + gameport);
});

console.log('\t :: Express :: Listening on port ' + gameport);
app.get('/', function(req, res){
    res.sendfile(__dirname + '/index.html');
});

//This handler will listen for requests on /*, any file from the root of our server.
//See expressjs documentation for more info on routing.
app.get('/*', function(req, res, next){
    //This is the current file they have requested
    var file = req.params[0];

    //For debugging, we can track what files are requested.
    if(verbose) console.log('\t :: Express :: file requested : ' + file);

    //Send the requesting client the file.
    res.sendfile(__dirname + '/' + file);
}) // app.get *


/* Socket.IO server set up. */

//Configure the socket.io connection settings. 
//See http://socket.io/

//Create a socket.io instance using our express server
var sio = io.listen(server);

sio.configure(function(){
    sio.set('log level', 0);

    sio.set('authorization', function(handshakeData, callback){
        callback(null, true); // error first callback style
    })
})

//Socket.io will call this function when a client connects, 
//So we can send that client a unique ID we use so we can 
//maintain the list of players.
sio.sockets.on('connection', function(client){
    //Generate a new UUID, looks something like 
    //5b2ca132-64bd-4513-99da-90e838ca47d1
    //and store this on their socket/connection
    client.userid = UUID();

    //tell the player they connected, giving them their id
    client.emit('onconnected', {id: client.userid});

    //Useful to know when someone connects
    console.log('\t socket.io:: player ' + client.userid + ' connected');

    //When this client disconnects
    client.on('disconnect', function(){
        //Useful to know when someone disconnects
        console.log('\t socket.io:: client disconnected ' + client.userid );
    }) //client.on disconnect
}) //sio.sockets.on connection