const satellite = require('satellite.js');

class SatelliteHandlers {

    /**
     * Interface with the satellite.js library to get the
     * satellites look angels
     * @param satMeta
     * @param observerLocation
     * @param date
     * @return {LookAngles}
     */
    static getSatPosition(satMeta, observerLocation, date){
        var observerGd = {
            longitude: observerLocation.longitude,
            latitude: observerLocation.latitude,
            height: config.observerHeight || 0.1,  // height is in Km ?
        };
        const satrec = satellite.twoline2satrec(satMeta.tleLine1, satMeta.tleLine2);

        const positionAndVelocity = satellite.propagate(satrec, new Date(date));
        var gmst = satellite.gstime(new Date(date));
        var positionEci = positionAndVelocity.position;
        var positionEcf   = satellite.eciToEcf(positionEci, gmst);
        var lookAngles    = satellite.ecfToLookAngles(observerGd, positionEcf);
        return lookAngles;
    }

    /**
     * Returns the elevation of the satellite for given location at given time
     * @param satMeta
     * @param observerLocation
     * @param date
     * @return {Radians}
     */
    static getSatElevation(satMeta, observerLocation, date){
        let elevation = SatelliteHandlers.getSatPosition(satMeta, observerLocation, date).elevation;

        //I think elevation is in Radians, not sure though. Looking at the values it appears to be in Radians.
        // convert Radians to degrees.
        return elevation * 180/3.142;
    }

    /**
     * return range of the satellite for given location at given time
     * @param satMeta
     * @param observerLocation
     * @param date
     * @return {Kilometer}
     */
    static getSatRange(satMeta, observerLocation, date){
        return SatelliteHandlers.getSatPosition(satMeta, observerLocation, date).rangeSat;
    }
    /* end helper functions*/
    ////////////////////////////////////////////////

    /* Route handlers */
    /**
     * route handler for /brighest.
     * Returns satellite that is closest to be overhead at given co-ordinates at given time
     * @param req
     * @param resp
     */
    static getOverHeadSatellite(req, resp) {

        const observerLongitude = req.query.longitude,
            observerLatitude = req.query.latitude,
            dateIn = req.query.date;
        let date = new Date(dateIn);

        //validate user input
        if(!observerLongitude || isNaN(observerLongitude) || !observerLatitude || isNaN(observerLatitude) || isNaN(date)){
            resp.status(400).json({ error: "invalid input" });
            return;
        }

        const observerLocation = {
            longitude: observerLongitude,
            latitude : observerLatitude
        };

        var overHeadSatellite= {
            angle: 90 // default to overhead
        };

        // iterate thru all the satellites to pick one that is closest to be overhead
        Object.entries(sat_data).forEach(([name, data]) => {
            var elevation = SatelliteHandlers.getSatElevation(data, observerLocation, date );
            const normalizeToOverheadAngle = Math.abs(90 - elevation);
            if(normalizeToOverheadAngle <= overHeadSatellite.angle){
                overHeadSatellite.name = name;
                overHeadSatellite.angle = normalizeToOverheadAngle;
            }
        });


        if(!overHeadSatellite.name){
            // no satellite found
            resp.send("Error no satellite found");
        } else{
            resp.send("Brighest satellite overhead is: " + overHeadSatellite.name);
        }

        return ;

    }


    /**
     * Calculate if and when the satellite is visible in the next 24 hours.
     *
     * Assumption: A satellite is considered to be visible if it is within range of 2000 (km ?)
     *
     * @param observer
     * @param satelliteName
     * @return {Promise<void>}
     */
    static nextVisible(req, resp){

        const observerLongitude = req.query.longitude,
            observerLatitude = req.query.latitude,
            name = req.query.name;


        //validate user input
        if(!observerLongitude || isNaN(observerLongitude) || !observerLatitude || isNaN(observerLatitude)){
            resp.status(400).json({ error: "Invalid input" });
            return;
        }

        // validate satellite name
        const data = sat_data[name];
        if(!data){
            resp.status(400).json({ error: "Invalid satellite name" });
            return;
        }

        const observerLocation = {
            longitude: observerLongitude,
            latitude : observerLatitude
        };

        // check if the satellite comes in config.visualRange in 5 min intervals
        const rangeThreshold = config.visualRange;
        let range = config.visualRange;
        const now = new Date();
        const timeInterval = config.nextVisibleCheckIntervalInMin;
        let i;

        for(i = 0; i <= 60 * config.nextVisibleWindowInHrs; i = i+timeInterval){
            range = SatelliteHandlers.getSatRange(data, observerLocation, now );
            now.setMinutes(now.getMinutes()+timeInterval);
            if( range <= rangeThreshold) break;
        }
        if(range <= rangeThreshold){
            console.log (" satellite: " + name + " will be in visible range at " + now);
            resp.send(" satellite: " + name + " will be in visible range at " + now);
        }else{
            console.log(" satellite: " + name + " will not be in visible range in next " + config.nextVisibleWindowInHrs + " hrs till: " + now);
            resp.send(" satellite: " + name + " will not be in visible range in next " + config.nextVisibleWindowInHrs + " hrs");
        }
    }

    /**
     * count the number of times each satellite makes a pass over a given location
     * @param req
     * @param resp
     */
    static countSatellitePasses(req, resp){

       const observerLongitude = req.query.longitude,
            observerLatitude = req.query.latitude,
            name = req.query.name;

        //validate user input
        if(!observerLongitude || isNaN(observerLongitude) || !observerLatitude || isNaN(observerLatitude)){
            resp.status(400).json({ error: "Invalid input" });
            return;
        };

        const observerLocation = {
            longitude: observerLongitude,
            latitude : observerLatitude
        };

        const passCont = {};

        /**
         * Check when the satellite is in visible range in next config.nextVisibleWindowInHrs hours.
         * calculate satellite position every minute.
         * returns a array of windows when the satellite is in range
         * @param name
         * @param data
         * @return {[]}
         * Eg:
         *  [{
			"start": "2020-12-19T09:22:24.162Z",
			"stop": "2020-12-19T09:29:24.162Z"
		}, {
			"start": "2020-12-19T21:06:24.162Z",
			"stop": "2020-12-19T21:13:24.162Z"
		}]
         */
        var getSatPasses = (name, data) => {
            var passdata = [];
            let visible = false;
            let i, range;
            let now = new Date();
            const timeInterval = 1; //check every minute
            let  start, stop;
            for(i=0; i< 60*config.nextVisibleWindowInHrs ; i+=timeInterval){
                range = SatelliteHandlers.getSatRange(data, observerLocation, now );

                if ( range < config.visualRange){
                    // the satellite is in range
                    if(visible){
                        // satellite was in range and is still in range
                        stop = new Date(now);
                    } else {
                        // satellite just entered visual range. create new record
                        start = new Date(now);
                    }

                    visible = true;
                } else {
                    // satellite is out of range
                    if(visible){
                        // was previously in range
                        // save window
                         passdata.push({
                            start: start,
                            stop: stop
                        });
                        start =null;
                        stop=null;
                    } else {
                        // satellite was not visible and is still not visible
                        // do nothing
                    }
                    visible = false;
                }

                now.setMinutes(now.getMinutes()+timeInterval);
            }

            return passdata;
        };

        // iterate over all satellites to calculate their visible windows
        Object.entries(sat_data).forEach(([name, data]) => {
            var pass = getSatPasses(name, data);
            passCont[name] = {
                totalPasses : pass.length,
                visibleWindows: pass
            };
        });
        resp.send(passCont);
    }
}
module.exports = SatelliteHandlers;
global.SatelliteHandlers = SatelliteHandlers;