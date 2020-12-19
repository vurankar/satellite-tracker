var express = require('express');
var app = express();
global.config = require('./config/settings.js');

const startup = require('./startup.js');
SatelliteHandlers = require('./route-handlers/satellite.js');

app.get('/', function (req, res) {
    res.send('Use /brighest to get the satellite overhead \n use /nextVisible to check when the satellite will be visible next');
});

app.get('/brighest',SatelliteHandlers.getOverHeadSatellite);
app.get('/nextVisible',SatelliteHandlers.nextVisible);
app.get('/satellitePasses',SatelliteHandlers.countSatellitePasses);

startup(app);


const port = config.server.port;

app.on('ready', function() {
    app.listen(port, function(){
        console.log("Example app listening on port:", port);
    });
});

app.on('error', function() {
    console.log("Could not start app");
});
