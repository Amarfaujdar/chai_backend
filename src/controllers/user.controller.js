import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false})

        return {accessToken,refreshToken}

    }catch(error){
        throw new ApiError(500,"Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req,res) => {
    const {fullName,email,username,password} = req.body;
    console.log(fullName,email,username,password);

    if([fullName,email,username,password].some((field) => field?.trim()==="")){
        throw new ApiError(400,"All fields are required")
    }

    const existedUser = await User.findOne({ 
        $or:[{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409,"User already exists")
    }  
    console.log(req.files);

    const avatarLocalPath = req.files?.avatar?.[0]?.path 

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path; 
    }


    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }  
    
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar upload failed")
    }

    const user = await User.create({
        username:username.toLowerCase(),
        email:email.toLowerCase(),
        fullName:fullName,
        password:password,
        avatar:avatar.url,
        coverImage:coverImage?.url || ""
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    ) 

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully")
    )

})


const loginUser = asyncHandler(async (req,res) => {
    //req body -> data
    //username or email
    //find the user
    //password check
    //access and refresh token
    //send cookie

    const {email,username,password} = req.body;

    if(!username && !email){
        throw new ApiError(400,"username or email is required")
    }

    if(!password){
        throw new ApiError(400,"password is required")
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User doesn't exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid Credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,refreshToken
            },
            "User logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1
            }
        },
        {
            new:true
        }
    )

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
        
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"Invalid token");
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Invalid token");
        }
    
        const options = {
            httpOnly:true,
            secure:true
        } 
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)    
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options) 
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,accessToken,refreshToken
                },  
                "User logged in successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid token")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res) => {
    //get user id from access token
    //get old password and new password from req body
    //check if old password is correct
    //update password
    //return response with access and refresh token

    const {oldPassword,newPassword} = req.body;
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
        throw new ApiError(401,"Invalid Password")
    }
    user.password = newPassword;
    await user.save({validateBeforeSave:false});
    return res
    .status(200)
    .json(new ApiResponse(200,"Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"User fetched successfully"))
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    const {fullName,email} = req.body;
    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")
    }
    const user = await User.findById(req.user?._id);
    user.fullName = fullName;
    user.email = email;
    await user.save({validateBeforeSave:false});
    return res
    .status(200)
    .json(new ApiResponse(200,"Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res) => {
    const avatarLocalPath = req.file?.avatar?.[0]?.path
    if(avatarLocalPath){
        throw new ApiError(400,"Avatar is required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400,"Avatar upload failed")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {   
            new:true
        }
    ).select("-password")
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar updated successfully"))

    //delete old avatar if exist
    
    if(user.avatar){
        //delete using fs-promises 
        try {
            await fs.promises.unlink(user.avatar)
        } catch (error) {
            //we dont want to fail the whole update if the old avatar is not deleted 
            console.log("Error while deleting old avatar:",error);
        }   
    }
})

const updateUserCoverImage = asyncHandler(async(req,res) => {
    const coverImageLocalPath = req.file?.coverImage?.[0]?.path
    if(coverImageLocalPath){
        throw new ApiError(400,"Cover Image is required")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Cover Image upload failed")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {
            new:true
        }
    ).select("-password")
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Cover Image updated successfully"))

    if(user.coverImage){
        try {
            await fs.promises.unlink(user.coverImage)
        } catch (error) {
            console.log("Error while deleting old cover Image:",error);
        }   
    }
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    //get username from params 
    const {username} = req.params;
    if(!username){
        throw new ApiError(400,"Username is required")
    }
    const channel = await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },{
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                subscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribedTo.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,
                avatar:1,
                coverImage:1,
                subscribersCount:1,
                subscribedToCount:1,
                isSubscribed:1,
                username:1,
                createdAt:1,
                email:1
            }
        }
    ])
    if(!channel.length){
        throw new ApiError(404,"Channel not found")
    }
    return res
    .status(200)
    .json(new ApiResponse(200,channel[0],"User channel fetched successfully"))
})

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user  = await User.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        username:1,
                                        avatar:1,
                                        fullName:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $arrayElemAt:["$owner",0]
                            }
                        }
                    }
                ]
            }
        },
        {
            $project:{
                watchHistory:1
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(200,user[0]?.watchHistory,"Watch history fetched successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}