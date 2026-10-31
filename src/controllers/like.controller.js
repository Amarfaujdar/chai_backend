import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Like } from "../models/like.model.js";
import mongoose from "mongoose";

// Toggle like on a video
const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }
    const existing = await Like.findOne({ video: videoId, likedBy: req.user._id });
    if (existing) {
        await Like.findByIdAndDelete(existing._id);
        return res.status(200).json(new ApiResponse(200, { liked: false }, "Like removed"));
    }
    await Like.create({ video: videoId, likedBy: req.user._id });
    return res.status(200).json(new ApiResponse(200, { liked: true }, "Video liked"));
});

// Toggle like on a comment
const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }
    const existing = await Like.findOne({ comment: commentId, likedBy: req.user._id });
    if (existing) {
        await Like.findByIdAndDelete(existing._id);
        return res.status(200).json(new ApiResponse(200, { liked: false }, "Like removed"));
    }
    await Like.create({ comment: commentId, likedBy: req.user._id });
    return res.status(200).json(new ApiResponse(200, { liked: true }, "Comment liked"));
});

// Toggle like on a tweet
const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    if (!mongoose.isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }
    const existing = await Like.findOne({ tweet: tweetId, likedBy: req.user._id });
    if (existing) {
        await Like.findByIdAndDelete(existing._id);
        return res.status(200).json(new ApiResponse(200, { liked: false }, "Like removed"));
    }
    await Like.create({ tweet: tweetId, likedBy: req.user._id });
    return res.status(200).json(new ApiResponse(200, { liked: true }, "Tweet liked"));
});

// Get all videos liked by the logged-in user
const getLikedVideos = asyncHandler(async (req, res) => {
    const likedVideos = await Like.find({ likedBy: req.user._id, video: { $exists: true } })
        .populate({
            path: "video",
            populate: { path: "owner", select: "username fullName avatar" }
        });

    return res.status(200).json(new ApiResponse(200, likedVideos, "Liked videos fetched successfully"));
});

export { toggleVideoLike, toggleCommentLike, toggleTweetLike, getLikedVideos };

