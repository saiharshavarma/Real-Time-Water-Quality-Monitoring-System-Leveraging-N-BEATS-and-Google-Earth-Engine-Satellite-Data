const mongoose=require('mongoose')

const tokenSchema=new mongoose.Schema({
    token:String,
});

const Token=mongoose.model('token',tokenSchema);
module.exports=Token;