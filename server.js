var express     = require('express'),
    app         = express()
  , io          = require('socket.io')
  , UUID        = require('node-uuid')
  , gameport    = process.env.PORT || 4004
  , verbose     = false;

var http = require('http'),
    server = http.Server(app);

var playerSpeed = 200;
var bulletSpeed = 500;
var width = 512;
var height = 768;
var lastFire = Date.now();
var bullets = [];
var score = 0;

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

// 임시 게임 룸
function GameRoom(max_player_count) {
    this.id;
    this.player_host;
    this.host_pos = { x:0, y:0 };
    this.host_id;
    this.host_sprite_size = { w:128, h:124 };
    this.player_client;
    this.client_pos = { x:0, y:0 };
    this.client_id;
    this.client_sprite_size = { w:128, h:119 };
    this.client_live = true;
    this.client_dead_time = true;
    this.player_count = max_player_count;
    this.current_player_count = 0;
};

var g1 = new GameRoom(2);
var msg_array = new Array();

//Socket.io will call this function when a client connects, 
//So we can send that client a unique ID we use so we can 
//maintain the list of players.
sio.sockets.on('connection', function(client){
    //Generate a new UUID, looks something like 
    //5b2ca132-64bd-4513-99da-90e838ca47d1
    //and store this on their socket/connection
    client.userid = UUID();

    //tell the player they connected, giving them their id
    client.emit('onconnected', {id: client.userid, host:1>g1.current_player_count});

    //Useful to know when someone connects
    console.log('\t socket.io:: player ' + client.userid + ' connected');

    // 일단 두명만 동작
    if(1>g1.current_player_count)
    {
        g1.player_host = client;
        g1.current_player_count++;

        var posX = width / 2;
        g1.host_pos = {x:posX,y:0};
        g1.host_id = client.userid;
    }
    else if(2>g1.current_player_count)
    {
        g1.player_client = client;
        g1.current_player_count++;
        
        var posX = Math.random() * ((width - 39) - (128/2));
        var posY = height - 119;
        g1.client_pos = {x:posX,y:posY};
        g1.client_id = client.userid;

        g1.player_client.emit('join player', g1.host_id);
        g1.player_host.emit('join player', g1.client_id);

        g1.player_host.emit('start game', g1.host_pos, g1.client_pos);
        g1.player_client.emit('start game', g1.host_pos, g1.client_pos);
        console.log( 'host x : ' + g1.host_pos.x + ', y : ' + g1.host_pos.y );
        console.log( 'client x : ' + g1.client_pos.x + ', y : ' + g1.client_pos.y );
    }

    //When this client disconnects
    client.on('disconnect', function(){
        //Useful to know when someone disconnects
        console.log('\t socket.io:: client disconnected ' + client.userid );
    }) //client.on disconnect

    client.on('move', function(dir, id){
        console.log('\t move packet ID : ' + id );

        var msg = {event: 'move', dir:dir, id:id};
        msg_array.push(msg);
    });

    client.on('fire', function(id){
        console.log('\t fire packet ID : ' + id);

        var msg = {event: 'fire', id: id};
        msg_array.push(msg);
    });
}) //sio.sockets.on connection


//server.js 는 브라우저에서 돌아가는게 아니기 때문에 window.을 사용하려면 아래와같이 해야한다
//Since we are sharing code with the browser, we
//are going to include some values to handle that.
global.window = global.document = global;

var requestAnimFrame = (function(){
    return window.requestAnimationFrame       ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame    ||
        window.oRequestAnimationFrame      ||
        window.msRequestAnimationFrame     ||
        function(callback){
            window.setTimeout(callback, 1000 / 60);
        };
})();


//Main update loop
var lastTime;
var update = function(t) {
    var now = Date.now();
    var dt = (now - lastTime) / 1000.0;

    updateEntities(dt);
    checkPlayerBounds();
    checkCollisions();

    lastTime = now;

    //schedule the next update
    this.updateid = requestAnimFrame( update );

}; //game_core.update

update( new Date().getTime() );

function checkPlayerBounds() {
    // Check bounds
    if(g1.client_pos.x < 0) {
        g1.client_pos.x = 0;
    }
    else if(g1.client_pos.x > width - g1.client_sprite_size.w) {
        g1.client_pos.x = width - g1.client_sprite_size.w;
    }

    if(g1.host_pos.x < 0) {
        g1.host_pos.x = 0;
    }
    else if(g1.host_pos.x > width - g1.host_sprite_size.w) {
        g1.host_pos.x = width - g1.host_sprite_size.w;
    }
}

function updateEntities(dt) {
    // Update all the bullets
    for(var i=0; i<bullets.length; i++) {
        var bullet = bullets[i];

        switch(bullet.dir) {
        case 'up': bullet.pos[1] -= bulletSpeed * dt; break;
        case 'down': bullet.pos[1] += bulletSpeed * dt; break;
        default:
            bullet.pos[0] += bulletSpeed * dt;
        }

        // broadcast
        g1.player_host.emit('bullet move', bullet.pos, i);
        g1.player_client.emit('bullet move', bullet.pos, i);

        // Remove the bullet if it goes offscreen
        if(bullet.pos[1] < 0 || bullet.pos[1] > height ||
           bullet.pos[0] > width) {
            bullets.splice(i, 1);
            i--;

            // broadcast
            g1.player_host.emit('bullet remove', i);
            g1.player_client.emit('bullet remove', i);
        }
    }

    msg_array.forEach(function(msg, index, object) {
        // 임시
        if(msg.id == g1.host_id)
        {
            switch(msg.event)
            {
                case 'move':
                    switch(msg.dir)
                    {
                        case 'KEY_LEFT':
                            g1.host_pos.x -= 1;
                            break;
                        case 'KEY_RIGHT':
                            g1.host_pos.x += 1;
                            break;
                    }

                    // broadcast
                    g1.player_host.emit('move', g1.host_pos, msg.id);
                    g1.player_client.emit('move', g1.host_pos, msg.id);
                    break;
                    
                case 'fire':
                    if(Date.now() - lastFire > 500) {
                        var x = g1.host_pos.x + g1.host_sprite_size.w / 2;
                        var y = (g1.host_pos.y + g1.host_sprite_size.h / 2) + 56;

                        console.log("똥 객체 생성 완료");
                        console.log("똥 x : " + x);
                        console.log("똥 y : " + y);
                        console.log("똥 lastFire : " + lastFire);
                        // 똥 객체 생성
                        bullets.push({pos: [x, y], spriteSize: [48, 56], dir: 'down'});

                        g1.player_host.emit('fire', x, y);
                        g1.player_client.emit('fire', x, y);

                        lastFire = Date.now();
                    }
                    break;
            }
        }
        else if(msg.id == g1.client_id)
        {
            switch(msg.event)
            {
                case 'move':
                    switch(msg.dir)
                    {
                        case 'KEY_LEFT':
                            g1.client_pos.x -= 100 * dt;
                            break;
                        case 'KEY_RIGHT':
                            g1.client_pos.x += 100 * dt;
                            break;
                    }

                    // broadcast
                    g1.player_host.emit('move', g1.client_pos, msg.id);
                    g1.player_client.emit('move', g1.client_pos, msg.id);
                    break;

                case 'fire':
                    // 한쪽은 싸는게 불가능하다
                    break;
            }
        }

        object.splice(index, 1);
    });

    if(false == g1.client_live) {
		if( Date.now() - g1.client_dead_time > 5000 )
		{
			g1.client_live = true;

            // broadcast
            g1.player_host.emit('respawn');
            g1.player_client.emit('respawn');
		}
	}
}

// Collisions

function collides(x, y, r, b, x2, y2, r2, b2) {
    return !(r <= x2 || x > r2 ||
             b <= y2 || y > b2);
}

function boxCollides(pos, size, pos2, size2) {
    return collides(pos[0], pos[1],
                    pos[0] + size[0], pos[1] + size[1],
                    pos2[0], pos2[1],
                    pos2[0] + size2[0], pos2[1] + size2[1]);
}

function checkCollisions() {
    //checkPlayerBounds();

    var pos = [g1.client_pos.x, g1.client_pos.y];
    var size = [g1.client_sprite_size.w, g1.client_sprite_size.h];

	if( g1.client_live )
	{
		for(var j=0; j<bullets.length; j++) {
			var pos2 = bullets[j].pos;
			var size2 = bullets[j].spriteSize;

			if(boxCollides(pos, size, pos2, size2)) {
				g1.client_live = false;
				g1.client_dead_time = Date.now();

				// Add score
				score += 100;

				// broadcast
                g1.player_host.emit('collide', g1.client_pos, score);
                g1.player_client.emit('collide', g1.client_pos, score);

                // broadcast
                g1.player_host.emit('bullet remove', j);
                g1.player_client.emit('bullet remove', j);
				break;
			}
		}

		if(boxCollides(pos, size, g1.host_pos, g1.host_sprite_size)) {
			//gameOver();
		}
	}
}