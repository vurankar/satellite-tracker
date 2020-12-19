async function startup(app){

    //handle pre start up dependencies.

    //1. Every time the app starts download a fresh copy of the satellite positions.
    const downloadSatData = async () =>{
        const url = config.celestrakURL;
        if(!url){
            console.log("Invalid celestrakURL. Could not download Satellite data");
            app.emit('error')
            return;
        }
        const fetch = require('node-fetch');
            const response = await fetch(url);
            const body = await response.text()
            const satArr = body.trim().split('\n');
            let i = 0;
            const res = {};
            for(i =0; i< satArr.length; ){
                res[satArr[i++].trim()] = {
                    tleLine1 : satArr[i++].trim(),
                    tleLine2 : satArr[i++].trim()
                }
            }
            return res;
    }


    /**
     * wait to being up all dependencies before starting server.
     */
    try{
        global.sat_data = await downloadSatData();
        app.emit('ready');
    } catch (e){
        app.emit('error');
    }

}
module.exports = startup;