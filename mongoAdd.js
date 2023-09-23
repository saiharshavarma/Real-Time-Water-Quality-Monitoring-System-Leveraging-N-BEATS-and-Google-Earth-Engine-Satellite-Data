require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser:true, useUnifiedTopology:true });
const db = mongoose.connection;

db.on("error", (err) => {
    console.log(err);
});

db.once("open",() => {
    console.log("database connected");
});
const Location = require("./models/locationModel");

const locs = [
    {
        uuid: 1,
        lat: 29.336441,
        long: 78.079701,
        name: 'UP02-Madhya Ganga Barrage, Bijnore',
        chl: [],
        updated_on: (new Date()).toLocaleString()
    },
    {
        uuid: 2,
        lat: 28.205734,
        long: 78.388685,
        name: 'UP08-Narora Barrage, Narora',
        chl: [],
        updated_on: (new Date()).toLocaleString()
    },
    {
        uuid: 3,
        lat: 28.060470,
        long: 78.541909,
        name: 'UP09-Kachla Ghat Bridge, Badaun',
        chl: [],
        updated_on: (new Date()).toLocaleString()
    },
    {
        uuid: 4,
        lat: 27.405556,
        long: 79.621833,
        name: 'UP14-Ghatiyaghat Bridge, Farrukhabad',
        chl: [],
        updated_on: (new Date()).toLocaleString()
    },
    {
        uuid: 5,
        lat: 26.511501, 
        long: 80.316126,
        name: 'UP19-Ganga (Luv Kush) Barrage, Kanpur',
        chl: [],
        updated_on: (new Date()).toLocaleString()
    },
    {
        uuid: 6,
        lat: 26.469812, 
        long: 80.374405,
        name: 'UP26-Shuklaganj Bridge, Kanpur',
        chl: [],
        updated_on: (new Date()).toLocaleString()
    },
    {
        uuid: 7,
        lat: 29.964051,  
        long: 78.184342,
        name: 'UP54-Bathing Ghat 1, Varanasi',
        chl: [],
        updated_on: (new Date()).toLocaleString()
    },
    {
        uuid: 8,
        lat: 25.640180,  
        long: 85.144692,
        name: 'BH11-Anta Ghat Nalla, Patna 3a',
        chl: [],
        updated_on: (new Date()).toLocaleString()
    },
    {
        uuid: 9,
        lat: 24.066444,  
        long: 88.229903, 
        name: 'WB11-Bridge at Behrampore, Behrampore (D/s)',
        chl: [],
        updated_on: (new Date()).toLocaleString()
    },
    {
        uuid: 10,
        lat: 22.647843,   
        long: 88.354954, 
        name: 'WB23-Intake Pumping Station at Belgharia, Belgharia',
        chl: [],
        updated_on: (new Date()).toLocaleString()
    },
]

locs.forEach(async element => {
    const newLocation = new Location(element);
    await newLocation.save();
});