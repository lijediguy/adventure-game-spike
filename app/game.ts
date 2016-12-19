let gameWidth = 800;
let gameHeight = 600;

const game = new Phaser.Game(gameWidth, gameHeight, Phaser.AUTO, 'game-area', {preload, create, update, render}, false, false );

let player: Phaser.Sprite;
let cursors: Phaser.CursorKeys;
let playerSpeed = 250, playerScale = 3;
let gamepadDebug: HTMLSpanElement;
let gamepads: Phaser.Gamepad;
let weapon: Phaser.Weapon;

let grunts: Phaser.Group;
let statues: Phaser.Group;
let familyMembers: Phaser.Group;

let padStatus: string[] = [];
let pad0mainstick: {x: number, y: number} = undefined;
let pad0secondstick: {x: number, y: number} = undefined;
let gamepadText: Phaser.Text;
let scoreText: Phaser.Text;
let gameStartText: Phaser.Text;
let gameOverText: Phaser.Text;
const freeHeartEveryPoints = 35000;
let level = 0, score = 0, nextFreeHeart = freeHeartEveryPoints;
let awaitingStartGameInput = true;
const playerWorldBoundaries = {
  minX: 10,
  maxX: gameWidth - 10,
  minY: 10,
  maxY: gameHeight - 10
};
const plainWhiteTextStyle = { font: "12px Arial", fill: "#ffffff", align: "left" };
const centeredWhiteTextStyle = { font: "12px Arial", fill: "#ffffff", align: "center", boundsAlignH: "center", boundsAlignV: "middle" };
const bigWhiteTextStyle = {font: "48px Arial", fill: "#ffffff", boundsAlignH: "center", boundsAlignV: "middle"};
let familySavedOnThisLevel = 0;

function startGame() {
  awaitingStartGameInput = false;
  gameStartText.visible = false;
}

function preload() {
    game.load.spritesheet('linkRunning', 'images/LinkRunning.png', 24, 28);
    game.load.spritesheet('princessZelda', 'images/PrincessZelda.png', 16, 23);
    game.load.spritesheet('enemies', 'images/Enemies.png', 18, 33);
    game.load.spritesheet('arrow', 'images/Arrow.png', 20, 9);
    game.load.image('grunt', 'images/grunt.png');
    gamepadDebug = document.getElementById("gamepadDebug");
}


function create() {

    player = game.add.sprite(0, 0, 'linkRunning');
    player.animations.add('runRight', [0,1,2,3,4,5,6,7], 30);
    player.scale.setTo(playerScale, playerScale);
    player.anchor.setTo(0.5, 0.5);
    game.physics.enable(player, Phaser.Physics.ARCADE);
    const playerBody : Phaser.Physics.Arcade.Body = player.body;
    playerBody.setSize(17, 24, 3, 2);
    playerBody.updateBounds();
    player.health = 3;
 
    weapon = game.add.weapon(30, 'arrow', 5);
    weapon.bullets.forEach((b : Phaser.Bullet) => {
      const body = b.body as Phaser.Physics.Arcade.Body;
      b.animations.add("arrowHit", [0,1,2,3,4], 30, false);
      b.scale.setTo(playerScale, playerScale);
      body.updateBounds();
    }, this);

    weapon.bulletKillType = Phaser.Weapon.KILL_WORLD_BOUNDS;
    weapon.bulletSpeed = 700;
    weapon.fireRate = 120;
    weapon.trackSprite(player);
    weapon.onFire.add((b: Phaser.Bullet) => {
      b.frame = 5;
      // trying to get the hitbox to not be wide when firing up or down.
      // this can be improved in the future with some trigonometry.
      // see here: http://www.html5gamedevs.com/topic/27095-bullet-scaling/
      const body = b.body as Phaser.Physics.Arcade.Body;
      const rotationInRadians = Math.abs(b.rotation);
      if (rotationInRadians > 0.78 && rotationInRadians < 2.3) {
        body.setSize(9, 9, 5, 0);
      } else {
        body.setSize(20, 9, 0, 0);
      }
    });

    player.bringToTop();

    grunts = game.add.group();
    grunts.enableBody = true;
    grunts.physicsBodyType = Phaser.Physics.ARCADE;

    statues = game.add.group();
    statues.enableBody = true;
    statues.physicsBodyType = Phaser.Physics.ARCADE;
    const statuesBounce = game.add.tween(statues);
    statuesBounce.to({y: -10}, 500, Phaser.Easing.Bounce.In, true, 0, -1);

    familyMembers = game.add.group();
    familyMembers.enableBody = true;
    familyMembers.physicsBodyType = Phaser.Physics.ARCADE;

    newLevel();

    gamepadText = game.add.text(10, 10, "", plainWhiteTextStyle);
    scoreText = game.add.text(gameWidth / 2, 10, "", plainWhiteTextStyle);
    gameOverText = game.add.text(0, 0, "GAME OVER", bigWhiteTextStyle);
    gameOverText.setTextBounds(0, 0, gameWidth, gameHeight);
    gameOverText.visible = false;

    gamepads = new Phaser.Gamepad(game);

    let instructions = "Zeldatron can be played with mouse and keyboard or dual-analog gamepad.";
    if (gamepads.supported) {
      instructions += "\nConnect a gamepad and press any button or axis to start.\nMove with the left stick, fire in 360° with the right stick.";
    } else {
      instructions += "\nYour browser does not support the Gamepad API.\nPlease try Edge, Firefox, or Chrome.";
    }
    instructions += "\nTo play with the mouse and keyboard, press any key or click on the game area.\nFire by holding down the mouse button and move with\nWASD or the cursor keys.";

    gameStartText = game.add.text(0, 0, instructions,
      {font: "20px Arial", fill: "#ffffff", boundsAlignH: "center", boundsAlignV: "middle", align: "center"});
    gameStartText.setTextBounds(0, 0, gameWidth, gameHeight);

    game.input.gamepad.addCallbacks(this, {
      onDown: (buttonCode: number, value: number, padIndex: number) => {
        startGame();
      },
      onAxis: (pad: Phaser.SinglePad, axis: number, value: number) => {
        startGame();
        const axis0 = pad.axis(0);
        const axis1 = pad.axis(1);
        const axis2 = pad.axis(2);
        const axis3 = pad.axis(3);
        padStatus[pad.index] = `Pad ${pad.index} (${(<any>pad)._rawPad['id']}): Zero: ${axis0}, One: ${axis1}, Two: ${axis2}, Three: ${axis3}`;
        if (pad0mainstick == undefined) {
          pad0mainstick = {x: axis0 || 0, y: axis1 || 0};
        } else {
          pad0mainstick.x = axis0 || 0;
          pad0mainstick.y = axis1 || 0;
        }
        if (pad0secondstick == undefined) {
          pad0secondstick = {x: axis2 || 0, y: axis3 || 0};
        } else {
          pad0secondstick.x = axis2 || 0;
          pad0secondstick.y = axis3 || 0;
        }
      },
      onConnect: (pad) => {
        const result = [];
        if (gamepads.pad1.connected || pad === 0) {
          result.push("Pad 1 connected.");
        }
        if (gamepads.pad2.connected || pad === 1) {
          result.push("Pad 2 connected.");
        }
        if (gamepads.pad3.connected || pad === 2) {
          result.push("Pad 3 connected.");
        }
        if (gamepads.pad4.connected || pad === 3) {
          result.push("Pad 4 connected.");
        }

        gamepadText.text = result.join("  ");
      },
      onDisconnect: (pad) => {
        const result = [];
        if (gamepads.pad1.connected && pad !== 0) {
          result.push("Pad 1 connected.");
        }
        if (gamepads.pad2.connected && pad !== 1) {
          result.push("Pad 2 connected.");
        }
        if (gamepads.pad3.connected && pad !== 2) {
          result.push("Pad 3 connected.");
        }
        if (gamepads.pad4.connected && pad !== 3) {
          result.push("Pad 4 connected.");
        }

        gamepadText.text = result.join("  ");
      }
    });

    game.input.gamepad.start();

    cursors = game.input.keyboard.createCursorKeys();
}

function movePlayerToCenter() {
    player.x = gameWidth / 2;
    player.y = gameHeight / 2;
}

function newLevel() {
    player.data.immune = true;
    movePlayerToCenter();
    weapon.killAll();
    level += 1;
    familySavedOnThisLevel = 0;

    const gruntCount = level + 9;
    const statueCount = Math.floor(level / 3) + 1;
    const familyCount = level < 5 ? level : 5;

    // Enemy boxes: the screen is divided up into four boxes that do not overlap each other or the player,
    //  with a slight margin from the edge and the player.
    // box 0 is the upper-left of the game area including above the player.
    // box 1 is the upper-right of the game area including to the right of the player.
    // box 2 is the lower-right of the game area including below the player.
    // box 3 is the lower-left of the game area including to the left of the player.
    
    const playerWidth = 24, playerHeight = 28;

    const cheesyPreventionRatio = 3.5,   // the higher this ratio, the further the monsters will spawn from the player.
      xMargin = Math.floor(game.width * 0.02),
      yMargin = Math.floor(game.height * 0.02),
      enemyBox0and2Width = (gameWidth / 2) + (playerWidth / 2 * playerScale * cheesyPreventionRatio) - xMargin,
      enemyBox1and3Width = gameWidth - enemyBox0and2Width - (xMargin * 2),
      enemyBox0and2Height = (gameHeight / 2) - (playerHeight / 2 * playerScale * cheesyPreventionRatio) - yMargin,
      enemyBox1and3Height = gameHeight - enemyBox0and2Height - (yMargin * 2);

    const enemyBoxes: PIXI.Rectangle[] = [
      new PIXI.Rectangle(xMargin, yMargin, enemyBox0and2Width, enemyBox0and2Height),
      new PIXI.Rectangle(enemyBox0and2Width + xMargin, yMargin, enemyBox1and3Width, enemyBox1and3Height),
      new PIXI.Rectangle(gameWidth - enemyBox0and2Width - xMargin, gameHeight - enemyBox0and2Height - yMargin, enemyBox0and2Width, enemyBox0and2Height),
      new PIXI.Rectangle(xMargin, gameHeight - enemyBox1and3Height - yMargin, enemyBox1and3Width, enemyBox1and3Height)
    ];

    //drawEnemyBoxesDebug(enemyBoxes);

    function randomCoordsInEnemyBox(boxIndex: number) {
      const enemyBox = enemyBoxes[boxIndex];
      return {
        x: game.rnd.integerInRange(enemyBox.x, enemyBox.x + enemyBox.width),
        y: game.rnd.integerInRange(enemyBox.y, enemyBox.y + enemyBox.height)
      };
    }
    function randomCoordsInWorldMargins() {
      return {
        x: game.rnd.integerInRange(xMargin, game.width - xMargin),
        y: game.rnd.integerInRange(yMargin, game.height - yMargin)
      };
    }

    while (grunts.length < gruntCount) {
      const coords = randomCoordsInEnemyBox(grunts.length % 4),
        grunt = grunts.create(coords.x, coords.y, 'grunt');
        grunt.anchor.setTo(0.5, 0.5);
        grunt.scale.set(1.2, 1.2);
    }

    while (statues.length < statueCount) {
      const coords = randomCoordsInEnemyBox(statues.length % 4),
        statue = statues.create(coords.x, coords.y, 'enemies', 0);
        statue.anchor.setTo(0.5, 0.5);
        statue.scale.set(playerScale * 0.9, playerScale * 0.9);
    }

    while (familyMembers.length < familyCount) {
      const coords = randomCoordsInWorldMargins(),
        family = familyMembers.create(coords.x, coords.y, 'princessZelda', 0);
        family.anchor.setTo(0.5, 0.5);
        family.scale.set(playerScale, playerScale);
    }

    for (let i = 0; i < familyMembers.children.length; i += 1) {
      const coords = randomCoordsInWorldMargins(),
        family: Phaser.Sprite = familyMembers.children[i] as Phaser.Sprite;

        family.body.position.setTo(coords.x, coords.y);
        if (!family.alive) {
          family.revive();
        }
    }

    for (let i = 0; i < grunts.children.length; i += 1) {
      const coords = randomCoordsInEnemyBox(i % 4),
        grunt: Phaser.Sprite = grunts.children[i] as Phaser.Sprite;
        grunt.body.position.setTo(coords.x, coords.y);
        grunt.revive();
    }

    for (let i = 0; i < statues.children.length; i += 1) {
      const coords = randomCoordsInEnemyBox(i % 4),
        statue: Phaser.Sprite = statues.children[i] as Phaser.Sprite;

        statue.body.position.setTo(coords.x, coords.y);
        statue.data.doNotMoveUntil = game.time.now;
        statueSetTarget(statue, familyMembers);
    }

    player.data.immune = false;
 
}

function render() {
   //game.debug.body(player);
   //grunts.forEach((grunt: Phaser.Sprite) => { game.debug.body(grunt)}, this);
   //statues.forEach((statue: Phaser.Sprite) => { game.debug.body(statue)}, this);
   //weapon.bullets.forEach((arrow: Phaser.Sprite) => { game.debug.body(arrow)}, this);
}


function update() {

  if (awaitingStartGameInput) {
    checkForStartGameInput();
    return;
  }

  if (gamepads) {
    gamepadDebug.innerHTML = `${gamepads.supported ? "Your browser indicates that gamepads are supported" : "Your browser does not support the gamepad API"}.  Gamepads connected: ${gamepads.padsConnected}.  gamepad info: ${JSON.stringify(padStatus)}`;
  }

  if (player.data.immune) {
    player.data.immuneFrameCount += 1;
    if (player.data.immuneFrameCount === 3) {
      player.data.immuneFrameCount = 0;
      if (player.tint === 0xFF0000) {
        player.tint = 0x00FF00;
      } else if (player.tint === 0x00FF00) {
        player.tint = 0x0000FF;
      } else {
        player.tint = 0xFF0000;
      }
    }
  }

  scoreText.text = `Hearts: ${player.health} - Level ${level} - Score: ${score}`;
  
  player.body.velocity.setTo(0, 0);

  moveAndFireFromGamepadInput();
  handleKeyboardInput();
  handleMouseInput();
  keepPlayerInBounds();

  const playerBody: Phaser.Physics.Arcade.Body = player.body;
  if (playerBody.velocity.x === 0 && playerBody.velocity.y === 0) {
    player.animations.stop();
    player.frame = 8;
  }

  doGruntAI();
  doStatueAI();

  if (grunts) {
    game.physics.arcade.overlap(grunts, player, damagePlayer, null, this);
  }
  if (statues) {
    game.physics.arcade.overlap(statues, player, damagePlayer, null, this);
  }

  if (weapon && weapon.bullets) {
    game.physics.arcade.overlap(weapon.bullets, statues, freezeStatue, null, this);
    game.physics.arcade.overlap(weapon.bullets, grunts, killGrunt, null, this);
  }

  if (familyMembers) {
    game.physics.arcade.overlap(familyMembers, player, rescueFamilyMember, null, this);
    game.physics.arcade.overlap(familyMembers, statues, killFamilyMember, null, this);
  }

}

function doGruntAI() {
  if (awaitingStartGameInput) {
    return;
  }
  for (let i = 0; i < grunts.children.length; i += 1) {
    game.physics.arcade.moveToObject(grunts.children[i], player, 22 + (level * 1.5));
  }
}

function doStatueAI() {
  if (awaitingStartGameInput) {
    return;
  }
  for (let i = 0; i < statues.children.length; i += 1) {
    const statue = statues.children[i] as Phaser.Sprite;
    if (!statue.data.target || !statue.data.target.alive) {
      statueSetTarget(statue, familyMembers);
    }
    if (statue.data.doNotMoveUntil > game.time.now) {
      game.physics.arcade.moveToObject(statue, statue.data.target, 0);
    } else {
      game.physics.arcade.moveToObject(statue, statue.data.target, 15 + (level * 1.5));
    }
  }
}

function statueSetTarget(statue: Phaser.Sprite, familyMembers: Phaser.Group) {
  let target = player;
  let targetDistance = Infinity;
  for (let i = 0; i < familyMembers.length; i += 1) {
    const family = familyMembers.children[i] as Phaser.Sprite;
    if (family.alive) {
      const distance = distanceBetweenSprites(statue, family);
      if (target === player || distance < targetDistance) {
        target = family;
        targetDistance = distance;
      }
    }
  }
  statue.data.target = target;
}

function distanceBetweenSprites(sprite1: Phaser.Sprite, sprite2: Phaser.Sprite) {
  return Math.sqrt(Math.pow(sprite1.x - sprite2.x, 2) + Math.pow(sprite1.y - sprite2.y, 2));
}

function killFamilyMember(familyMember: Phaser.Sprite, statue: Phaser.Sprite) {
  const deathText = game.add.text(familyMember.x, familyMember.y, "☠", bigWhiteTextStyle);
  familyMember.kill();
  game.time.events.add(Phaser.Timer.SECOND * 3, () => deathText.kill(), this);
}

function rescueFamilyMember(player: Phaser.Sprite, familyMember: Phaser.Sprite) {
  const familyMemberScore = 1000;
  familySavedOnThisLevel += 1;
  scorePoints(familyMemberScore * familySavedOnThisLevel);
  
  const rescueScoreText = game.add.text(familyMember.x - (familyMember.width/2), familyMember.y, (familyMemberScore * familySavedOnThisLevel).toString(), centeredWhiteTextStyle);
  familyMember.kill();

  game.time.events.add(Phaser.Timer.SECOND * 2, () => rescueScoreText.kill(), this);
}

function keepPlayerInBounds() {
  if (player.position.x < playerWorldBoundaries.minX){
    player.position.x = playerWorldBoundaries.minX;
  }
  if (player.position.y < playerWorldBoundaries.minY){
    player.position.y = playerWorldBoundaries.minY;
  }
  if (player.position.x > playerWorldBoundaries.maxX){
    player.position.x = playerWorldBoundaries.maxX;
  }
  if (player.position.y > playerWorldBoundaries.maxY){
    player.position.y = playerWorldBoundaries.maxY;
  }
}

function damagePlayer(player: Phaser.Sprite, grunt: Phaser.Sprite) {
  if (player.alive && grunt.alive && !player.data.immune) {
    player.damage(1);
    if (player.alive) {
      player.data.immune = true;
      player.data.immuneFrameCount = 0;
      player.tint = 0xFF0000;
      game.time.events.add(Phaser.Timer.SECOND, () => {
        player.data.immune = false;
        player.data.immuneFrameCount = 0;
        player.tint = 0xFFFFFF;
      }, this);
    } else {
      movePlayerToCenter();
      gameOverText.visible = true;
    }
  }
}

function freezeStatue(arrow: Phaser.Bullet, statue: Phaser.Sprite) {
  if (arrow.alive && statue.alive) {
    arrow.body.velocity.x = 0;
    arrow.body.velocity.y = 0;
    arrow.play("arrowHit", 10, false, true);
    statue.data.doNotMoveUntil = game.time.now + 1000;
  }
}

function killGrunt(arrow: Phaser.Bullet, grunt: Phaser.Sprite) {
  if (arrow.alive && grunt.alive) {
    arrow.body.velocity.x = 0;
    arrow.body.velocity.y = 0;
    arrow.play("arrowHit", 10, false, true);
    grunt.kill();
    scorePoints(100);
  }

  checkAndHandleNewLevelIfNeeded();
}

function checkAndHandleNewLevelIfNeeded() {
  if (grunts.countLiving() === 0) {
      newLevel();
  }
}

function scorePoints(points: number) {
  score += points;
  if (score >= nextFreeHeart) {
    nextFreeHeart += freeHeartEveryPoints;
    player.heal(1);
  }
}

function drawEnemyBoxesDebug(enemyBoxes: PIXI.Rectangle[]) {
    const g = game.add.graphics(0,0);
    g.lineStyle(2, 0x0000FF, 1);
    g.drawShape(enemyBoxes[0]);
        
    g.lineStyle(2, 0x00FF00, 1);
    g.drawShape(enemyBoxes[1]);

    g.lineStyle(2, 0xFF0000, 1);
    g.drawShape(enemyBoxes[2]);

    g.lineStyle(2, 0xFF00FF, 1);
    g.drawShape(enemyBoxes[3]);
}


function handleMouseInput() {
  if (player.alive && game.input.activePointer.isDown) {
    weapon.bulletAngleVariance = 10;
    weapon.fireAtPointer(game.input.activePointer);
  }
}

function handleKeyboardInput() {
  if (!cursors || !player.alive) {
    return;
  }
  if (cursors.left.isDown || game.input.keyboard.isDown(Phaser.KeyCode.A)) {
    player.body.velocity.x -= playerSpeed;
    player.scale.x = -playerScale;
    player.animations.play('runRight');
  }
  if (cursors.right.isDown || game.input.keyboard.isDown(Phaser.KeyCode.D)) {
    player.body.velocity.x += playerSpeed;
    player.scale.x = playerScale;
    player.animations.play('runRight');
  }
  if (cursors.up.isDown || game.input.keyboard.isDown(Phaser.KeyCode.W)) {
    player.body.velocity.y -= playerSpeed;
    player.animations.play('runRight');
  }
  if (cursors.down.isDown || game.input.keyboard.isDown(Phaser.KeyCode.S)) {
    player.body.velocity.y += playerSpeed;
    player.animations.play('runRight');
  }
}


function checkForStartGameInput() {
  if (game.input.activePointer.isDown || game.input.keyboard.lastKey != undefined) {
    startGame();
  }
}


function moveAndFireFromGamepadInput() {
  if (!player.alive) {
    return;
  }
  if (pad0mainstick) {
    player.body.velocity.x = playerSpeed * pad0mainstick.x;
    player.body.velocity.y = playerSpeed * pad0mainstick.y;
    if (pad0mainstick.x > 0) {
      player.scale.x = playerScale;
    } else if (pad0mainstick.x < 0) {
      player.scale.x = -playerScale;
    }
    player.animations.play('runRight');
  }

  if (pad0secondstick) {
    if (pad0secondstick.x !== 0 || pad0secondstick.y !== 0) {
      weapon.bulletAngleVariance = 0;
      weapon.fireAtXY(player.centerX + (pad0secondstick.x * 10), player.centerY + (pad0secondstick.y * 10));
    }
  }
}