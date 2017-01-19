
// A cross-browser requestAnimationFrame
// See https://hacks.mozilla.org/2011/08/animating-with-javascript-from-setinterval-to-requestanimationframe/
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

// Create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
canvas.width = 512;
canvas.height = 768;
document.body.appendChild(canvas);
var bHost = false;

// The main game loop
var lastTime;
function main() {
    var now = Date.now();
    var dt = (now - lastTime) / 1000.0;

    update(dt);
    render();

    lastTime = now;
    requestAnimFrame(main);
};

function init() {
    //terrainPattern = ctx.createPattern(resources.get('img/terrain.png'), 'repeat');

    document.getElementById('play-again').addEventListener('click', function() {
        reset();
    });

    //This is all that needs
    this.socket = io.connect('/');
        //Now we can listen for that event
    socket.on('onconnected', function( data ) {
            //Note that the data is the object we sent from the server, as is. So we can assume its id exists. 
        console.log( 'Connected successfully to the socket.io server. My server side ID is ' + data.id );
        if( data.host )
            player.id = data.id;
        else
            player_2.id = data.id;

        bHost = data.host;
    });
    socket.on('join player', function(id){
        console.log( 'The other player has been join. other player ID is ' + id);
        if( !bHost )
            player.id = id;
        else
            player_2.id = id;
    });
    socket.on('start game', function(hostPos, clientPos){
        console.log( 'host pos x :' + hostPos.x + ', y :' + hostPos.y );
        console.log( 'client pos x :' + clientPos.x + ', y :' + clientPos.y );
        player.pos[0] = hostPos.x;
        player.pos[1] = hostPos.y;
        player_2.pos[0] = clientPos.x;
        player_2.pos[1] = clientPos.y;
    });
    socket.on('move', function(pos, id){
        console.log( 'Move packet arrived. moving obj ID is ' + id );
        if(player.id == id)
        {
            player.pos[0] = pos.x;
            player.pos[1] = pos.y;
        }
        else if(player_2.id == id)
        {
            player_2.pos[0] = pos.x;
            player_2.pos[1] = pos.y;
        }
    });
    socket.on('fire', function(x, y){
        console.log( 'Fire packet arrived.' );
        bullets.push({ pos: [x, y],
                       sprite: new Sprite('img/poop.png', [0, 0], [48, 56]) });
    });
    socket.on('bullet move', function(bulletPos, bulletIndex){
        console.log( 'Bullet move packet arrived. bullet ID is ' + bulletIndex );

        if (null != bullets[bulletIndex])
            bullets[bulletIndex].pos = bulletPos;
    });
    socket.on('bullet remove', function(bulletIndex){
        console.log( 'Bullet remove packet arrived. bullet ID is ' + bulletIndex );

        bullets.splice(bulletIndex, 1);
    });
    socket.on('collide', function(pos, score){
        console.log( 'Collide packet arrived' );

        // Add an explosion
        explosions.push({
            pos: [pos.x, pos.y],
            sprite: new Sprite('img/sprites.png',
                                [0, 117],
                                [39, 39],
                                16,
                                [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
                                null,
                                true)
        });

        player_2.live = false;
        score = score;
    });
    socket.on('bullet move', function(bulletPos, bulletIndex){
        console.log( 'Bullet move packet arrived. bullet ID is ' + bulletIndex );

        if (null != bullets[bulletIndex])
            bullets[bulletIndex].pos = bulletPos;
    });
    socket.on('respawn', function(bulletIndex){
        console.log( 'respawn packet arrived.' );

        player_2.live = true;
    });

    reset();
    lastTime = Date.now();
    main();
}

resources.load([
    'img/sprites.png',
    'img/terrain.png',
	'img/cat_1.png',
	'img/cat_2.png',
	'img/poop.png'
]);
resources.onReady(init);

// Game state
var player = {
    id: 0,
    pos: [0, 0],
    sprite: new Sprite('img/cat_1.png', [0, 0], [128, 124])
};

var player_2 = {
    id: 0,
    pos: [0, 0],
    sprite: new Sprite('img/cat_2.png', [0, 0], [128, 119]),
	live: true,
	deadTime: null
};

var bullets = [];
//var enemies = [];
var explosions = [];

var lastFire = Date.now();
var gameTime = 0;
var isGameOver;
var terrainPattern;

var score = 0;
var scoreEl = document.getElementById('score');

// Speed in pixels per second
var bulletSpeed = 500;
var enemySpeed = 100;

// Update game objects
function update(dt) {
    gameTime += dt;

    handleInput(dt);
    updateEntities(dt);

    scoreEl.innerHTML = score;
};

function handleInput(dt) {
    if(input.isDown('LEFT') || input.isDown('a')) {
        console.log('left button');
        var player_id = player.id;
        if(!bHost)
            player_id = player_2.id;
        this.socket.emit('move', 'KEY_LEFT', player_id);
    }

    if(input.isDown('RIGHT') || input.isDown('d')) {
        console.log('right button');
        var player_id = player.id;
        if(!bHost)
            player_id = player_2.id;
        this.socket.emit('move', 'KEY_RIGHT', player_id);
    }

    if(input.isDown('SPACE') &&
       !isGameOver &&
       Date.now() - lastFire > 500) {
        console.log('space button');
        var player_id = player.id;
        // 호스트가 아니면 쌀수없다
        if(!bHost)
            return;
        this.socket.emit('fire', player_id);

        lastFire = Date.now();
    }
}

function updateEntities(dt) {
    // Update the player sprite animation
    player.sprite.update(dt);

    if( player_2.live ) {
		player_2.sprite.update(dt);
	}

/*
    for(var i=0; i<bullets.length; i++) {
        var bullet = bullets[i];
        bullet.update(dt);
    }
*/

    // Update all the explosions
    for(var i=0; i<explosions.length; i++) {
        explosions[i].sprite.update(dt);

        // Remove if animation is done
        if(explosions[i].sprite.done) {
            explosions.splice(i, 1);
            i--;
        }
    }
}

// Draw everything
function render() {
    ctx.fillStyle = terrainPattern;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render the player if the game isn't over
    if(!isGameOver) {
        renderEntity(player);
		
		if( player_2.live )
			renderEntity(player_2);
    }

    renderEntities(bullets);
    renderEntities(explosions);
};

function renderEntities(list) {
    for(var i=0; i<list.length; i++) {
        renderEntity(list[i]);
    }    
}

function renderEntity(entity) {
    ctx.save();
    ctx.translate(entity.pos[0], entity.pos[1]);
    entity.sprite.render(ctx);
    ctx.restore();
}

// Game over
function gameOver() {
    document.getElementById('game-over').style.display = 'block';
    document.getElementById('game-over-overlay').style.display = 'block';
    isGameOver = true;
}

// Reset game to original state
function reset() {
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('game-over-overlay').style.display = 'none';
    isGameOver = false;
    gameTime = 0;
    score = 0;

    //enemies = [];
    bullets = [];

    player.pos = [canvas.width / 2 - player.sprite.size[0] / 2, 0];
};
