const express=require('express')
const privateKey = require('./.private-key.json');
const ee = require('@google/earthengine');
const {PythonShell} = require('python-shell')
const CronJob = require('cron').CronJob;
const homeRouter=require('./routes/homeRouter')
const testRouter=require('./routes/testRouter')
const {autoTimeSeries}=require('./controllers/homeController')
require("dotenv").config();
const mongoose = require('mongoose')
const Location = require('./models/locationModel')
const admin = require('./firebase.js');

const app=express()
const port=process.env.PORT||3000

// const uri = 'mongodb://localhost:27017/antakshariDB';
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser:true, useUnifiedTopology:true });
const db = mongoose.connection;

db.on("error", (err) => {
    console.log(err);
});

db.once("open",() => {
    console.log("database connected");
});
// const {sendNotification} = require('./controllers/homeController')
// console.log('Start');
// sendNotification();

app.use(express.json())
app.use(express.urlencoded({extended: true}))

app.use('/', homeRouter)
app.use('/test', testRouter)
const job = new CronJob("00 00 12 * * 0", async function jobYouNeedToExecute() {
  // Do whatever you want in here. Send email, Make  database backup or download data.
  console.log(new Date().toLocaleString());
  for (let index = 1; index < 11; index++) {
    await autoTimeSeries(index);
  }
});
job.start();

ee.data.authenticateViaPrivateKey(
    privateKey,
    () => {
      console.log('Authentication successful.');
      ee.initialize(
          null, null,
          async () => {
            console.log('Earth Engine client library initialized.');
            // let options = {
            //   mode: 'text',
            //   // pythonPath: 'path/to/python',
            //   pythonOptions: ['-u'], // get print results in real-time
            //   scriptPath: './controllers',
            //   args: []
            // };
            // const { success, err='', results } = await new Promise(function(myResolve, myReject) {
            //   console.log('Loading model...');
            //   PythonShell.run('load.py', options, function (err, results) {
            //     if (err) {
            //       myReject({ success: false, err });
            //     }
            //     // results is an array consisting of messages collected during execution
            //     // console.log(results[2]);
            //     // console.log(results);
            //     // console.log(results[2].substring(2, results[2].length-2));
            //     myResolve({ success: true, results: results}); // when successful
            //   });
            //     // myReject();  // when error
            //   });
              
            //   if (success)
            //   {
            //     console.log(results[results.length-1]);
            //     app.listen(port,()=>{
            //       console.log('Server is up on the port '+port+" !")
            //   })
            //   } else {
            //           console.log("Error: " + err);
            //       return;
            //   }
              app.listen(port,()=>{
                console.log('Server is up on the port '+port+" !")
            })
            // console.log(`Listening on port ${port}`);
          },
          (err) => {
            console.log(err);
            console.log(
                `Please make sure you have created a service account and have been approved.
Visit https://developers.google.com/earth-engine/service_account#how-do-i-create-a-service-account to learn more.`);
          });
    },
    (err) => {
      console.log(err);
    });


