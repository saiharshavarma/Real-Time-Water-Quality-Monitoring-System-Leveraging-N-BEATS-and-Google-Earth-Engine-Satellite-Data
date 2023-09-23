// require('dotenv').config();
// const mongoose=require('mongoose')
// const db=`mongodb+srv://${process.env.ATLAS_USER}:${process.env.ATLAS_PASSWORD}@${process.env.ATLAS_CLUSTER}.fzmhp.mongodb.net/${process.env.ATLAS_DB_NAME}?retryWrites=true&w=majority`;
// // const db=process.env.URI;

// mongoose.connect(db,{
//     useNewUrlParser:true,
//     // useCreateIndex:true,
//     useUnifiedTopology: true,
//     // useFindAndModify:false 
// }).then(()=>{
//     console.log("Connection Successful");
// }).catch((err)=>{
//     console.log(err);
//     console.log("No connection");
// })