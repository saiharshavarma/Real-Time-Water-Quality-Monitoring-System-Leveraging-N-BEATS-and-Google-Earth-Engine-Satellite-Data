const mongoose=require('mongoose')

const locationSchema=new mongoose.Schema({
    uuid:String,
    lat:Number,
    long:Number,
    name: String,
    chl:[
        {
            date: String,
            value: Number
        }
    ],
    updated_on: String
});

const Location=mongoose.model('location',locationSchema);
module.exports=Location;