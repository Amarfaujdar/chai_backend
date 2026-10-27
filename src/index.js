// require('dotenv').config({path:"./env"})

import dotenv from "dotenv"
dotenv.config({
    path:"./env"
})

import connectDB from "./db/index.js";



















// import express from "express";
// const app = express(); 

// async function connectDB(){
//     try {
//         await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//         app.on("error",(err) => {
//             console.log("ERRR: ",error);
//             throw error
//         })

//         app.listen(process.env.PORT,() => {
//             console.log(`App is listening on port ${process.env.PORT}`)
//         })
//     } catch (err) {
//         console.log("error:",err) 
//         console.error("Error",err)
//         throw err
//     }
// }