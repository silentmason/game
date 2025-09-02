// Initialize PlayFab
var settings = {
    titleId: "84AC1" // Replace with your PlayFab Title ID
};
PlayFab.settings = settings;
var otherPlayerX = 240; // other player's initial position
var otherPlayerY = 50; // other player's initial position
var playerX = 100;
var playerY = 50;
var photonToken = "GWFH3GO49XNJERSX5YB7KJ7WQ5P9IIJKJ4KXBXFD1DAB3KX1U6";
// Photon initialization
var photonAppId = "5717f161-4fb8-4ca2-94a3-3a461f53f4cf"; // Replace with your Photon App ID
var photonClient = new Photon.PhotonRealtime.LoadBalancingClient({
    appId: photonAppId,
    region: "us" // Replace with your Photon region
});

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Authenticate with PlayFab (using Custom ID - same as before)
function loginWithPlayFab() {
    var loginRequest = {
        CreateAccount: true,
        CustomId: generateUUID(), // Use a unique identifier for each player
        TitleId: PlayFab.settings.titleId
    };
    PlayFabClientSDK.LoginWithCustomID(loginRequest, onLoginSuccess, onLoginFailure);
}

function onLoginSuccess(result) {
    console.log("PlayFab Login Successful!");
    console.log("PlayFab ID: " + result.PlayFabId);
    PlayFab.ClientApi.AuthenticationContext.clientSessionTicket = result.SessionTicket;
    // Get Photon authentication token from PlayFab Cloud Script
    getPhotonToken();
}

function onLoginFailure(error) {
    console.error("PlayFab Login Failed: " + error.errorMessage);
    // Handle login failure (display error message, retry, etc.)
}
// Get Photon token from PlayFab Cloud Script
function getPhotonToken() {
    PlayFabClientSDK.ExecuteCloudScript({
                FunctionName: "authenticateWithPhoton",
        Params: {},
        GeneratePlayStreamEvent: true
    }, onGetPhotonTokenSuccess, onGetPhotonTokenFailure);
}

function onGetPhotonTokenSuccess(result) {
    if (result && result.FunctionResult) {
        var photonToken = result.FunctionResult.PhotonCustomAuthenticationToken;
                        console.log("Photon Token: " + photonToken);
        // Connect to Photon
        connectToPhoton(photonToken);
    } else {
        console.error("Failed to get Photon token from Cloud Script");
        // Handle failure to get token
                }
}

function onGetPhotonTokenFailure(error) {
    console.error("Failed to get Photon token: " + error.errorMessage);
}

function connectToPhoton(photonToken) {
    photonClient.onConnectedToMaster.addEventListener(function() {
        console.log("Connected to Photon Master Server");
        // Join or create a room
        joinOrCreateRoom();
    });

    photonClient.onJoinRoom.addEventListener(function() {
        console.log("Joined Room: " + photonClient.room.name);
        startGame();
     });

    photonClient.onActorJoin.addEventListener(function(actor) {
        console.log("Actor Joined Room: " + actor.actorNr);
    });

    photonClient.onActorLeave.addEventListener(function(actor) {
        console.log("Actor Left Room: " + actor.actorNr);
    });

    photonClient.onEvent.addEventListener(function(code, content, actorNr) {
        // Handle incoming game events (position updates)
        if (code === 1) { // Custom event code for position update
            otherPlayerX = content.x;
            otherPlayerY = content.y;
        }
    });
    photonClient.connectToRegionMaster("us");
    var authenticationValues = new Photon.PhotonRealtime.AuthenticationValues();
    authenticationValues.UserId = PlayFab.settings.PlayFabId; // use PlayFab player id
    authenticationValues.AuthType = Photon.PhotonRealtime.CustomAuthenticationType.Custom;
    authenticationValues.AuthParameters = {
        "username": PlayFab.settings.PlayFabId,
        "token": photonToken
    };
    photonClient.setAuthenticationValues(authenticationValues);
}
loginWithPlayFab();

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBall(playerX, playerY, "#0095DD"); // Current player's ball
    drawBall(otherPlayerX, otherPlayerY, "#FF0000"); // Other player's ball
    // Update velocity based on key presses
    let dx = 0;
    let dy = 0;
    if (upPressed) dy = -2;
    else if (downPressed) dy = 2;
    if (leftPressed) dx = -2;
    else if (rightPressed) dx = 2;
    playerX += dx;
    playerY += dy;
    // Keep the ball within the canvas bounds
    if (playerX + dx > canvas.width - 10 || playerX + dx < 10) {
        playerX -= dx; // Reverse the movement
    }
    if (playerY + dy > canvas.height - 10 || playerY < 10) {
        playerY -= dy;
    }
    // Update PlayFab with the current player's game state
    updateGameState(playerX, playerY);
    requestAnimationFrame(draw);
}

function startGame() {
    draw();
}

function sendPositionToPhoton(x, y) {
    var eventContent = {
        x: x,
        y: y
    };
    var raiseEventOptions = {
        receivers: Photon.PhotonRealtime.ReceiverGroup.Others
    };
    photonClient.raiseEvent(1, eventContent, raiseEventOptions); // 1 is a custom event code
}

function joinOrCreateRoom() {
    var roomOptions = {
        isVisible: true,
        isOpen: true,
        maxPlayers: 2
    };
    photonClient.createRoom(null, roomOptions);
}

function updateGameState(x, y) {
    // Send player position as a Photon event
    var eventContent = {
        x: x,
        y: y
    };
    var raiseEventOptions = {
        receivers: Photon.PhotonRealtime.ReceiverGroup.Others
    }; // Send to other players
    photonClient.raiseEvent(1, eventContent, raiseEventOptions); // 1 is a custom event code
}